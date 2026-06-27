import { uuid } from "@/lib/uuid";
import type {
  Marriage,
  ParentChild,
  Partnership,
  Person,
  Relationship,
  Sex,
} from "@/lib/types";

/**
 * GEDCOM 5.5.1 parser tuned for MyHeritage exports.
 *
 * Scope: enough to round-trip what MyHeritage's "Export to GEDCOM"
 * actually emits — INDI/FAM records with NAME (+ GIVN / SURN / _MARNM
 * / _AKA), SEX, BIRT, DEAT, NOTE, FAMC, FAMS on individuals; HUSB,
 * WIFE, CHIL, MARR, DIV on families. Anything else (RIN, _UID,
 * RESI, OCCU, OBJE, etc.) is silently skipped so unfamiliar dialects
 * still import cleanly — nothing throws on unknown tags.
 *
 * Output is in our domain shape (`Person[]`, `Relationship[]`) with
 * freshly-generated UUIDs — GEDCOM xrefs like `@I47@` are NOT reused
 * as our IDs. A xref→UUID map keeps cross-references consistent.
 */

const MONTHS: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

/**
 * Tolerant GEDCOM date → ISO partial.
 *
 *   "12 MAR 1950"        → "1950-03-12"
 *   "MAR 1950"           → "1950-03"
 *   "1950"               → "1950"
 *   "ABT 1950" / "EST"   → "1950"  (qualifier dropped)
 *   "BEF 1950" / "AFT"   → "1950"  (bound dropped)
 *   "BET 1950 AND 1960"  → "1950"  (lower bound only)
 *
 * Returns undefined when nothing parseable was found — better than
 * shipping a junk string into the JSON store.
 */
export function parseGedcomDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // Strip qualifiers and noisy parens.
  let s = raw.trim().toUpperCase();
  if (!s) return undefined;
  s = s.replace(/^(ABT|EST|CAL|BEF|AFT)\s+/, "");
  // Date ranges: take the first bound.
  const range = s.match(/^BET\s+(.+?)\s+AND\s+.+$/);
  if (range) s = range[1].trim();
  // INT 1950 (some text)
  s = s.replace(/^INT\s+/, "").replace(/\s*\(.*\)\s*$/, "");

  // Full day-month-year
  const full = s.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})$/);
  if (full) {
    const day = full[1].padStart(2, "0");
    const mon = MONTHS[full[2]];
    if (mon) return `${full[3].padStart(4, "0")}-${mon}-${day}`;
  }
  // Month-year
  const ym = s.match(/^([A-Z]{3})\s+(\d{3,4})$/);
  if (ym) {
    const mon = MONTHS[ym[1]];
    if (mon) return `${ym[2].padStart(4, "0")}-${mon}`;
  }
  // Year only
  const y = s.match(/^(\d{3,4})$/);
  if (y) return y[1].padStart(4, "0");
  return undefined;
}

// ---- Line + tree representation ----------------------------------

type GedLine = {
  level: number;
  xref?: string; // record id on level-0 only ("@I1@")
  tag: string;
  value?: string;
};

type GedNode = GedLine & { children: GedNode[] };

const LINE_RE = /^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z_][A-Z0-9_]*)\s?(.*)?$/;

function tokenize(text: string): GedLine[] {
  // Strip UTF-8 BOM that MyHeritage prepends, normalize CRLF.
  const cleaned = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const out: GedLine[] = [];
  for (const raw of cleaned.split("\n")) {
    if (!raw) continue;
    const m = raw.match(LINE_RE);
    if (!m) continue;
    const level = Number(m[1]);
    const xref = m[2];
    const tag = m[3];
    const value = m[4]?.trim() || undefined;
    out.push({ level, xref, tag, value });
  }
  return out;
}

function buildForest(lines: GedLine[]): GedNode[] {
  const roots: GedNode[] = [];
  const stack: GedNode[] = [];
  for (const ln of lines) {
    const node: GedNode = { ...ln, children: [] };
    if (ln.level === 0) {
      roots.push(node);
      stack.length = 0;
      stack.push(node);
      continue;
    }
    // Walk back until we find a parent at level-1.
    while (stack.length > 0 && stack[stack.length - 1].level >= ln.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    stack.push(node);
  }
  return roots;
}

/** Find the first direct child with the matching tag. `node` may be
 *  undefined to make chained lookups (`child(child(n, "NAME"), "_AKA")`)
 *  pass through without a null-check explosion. */
function child(node: GedNode | undefined, tag: string): GedNode | undefined {
  return node?.children.find((c) => c.tag === tag);
}

/** All direct children with the matching tag. */
function children(node: GedNode, tag: string): GedNode[] {
  return node.children.filter((c) => c.tag === tag);
}

/**
 * Multi-line text values use CONT (new line) and CONC (concatenated)
 * sub-records. Walk them once when extracting a NOTE / similar field.
 */
function readText(node: GedNode): string {
  const parts: string[] = node.value ? [node.value] : [];
  for (const c of node.children) {
    if (c.tag === "CONT") parts.push("\n" + (c.value ?? ""));
    else if (c.tag === "CONC") parts.push(c.value ?? "");
  }
  return parts.join("");
}

// ---- INDI / FAM extraction --------------------------------------

type NameParts = {
  firstName: string;
  lastName: string;
  maidenName?: string;
};

/**
 * Parse a GEDCOM NAME line + its sub-tags. NAME values look like
 *
 *   "Wojciech /Tokarczyk/"
 *
 * with slashes around the surname. Sub-tags GIVN / SURN are usually
 * present too; MyHeritage adds `_MARNM` (married name) for women who
 * took a husband's surname. When both `SURN` and `_MARNM` are present
 * and differ, we treat `_MARNM` as the current `lastName` and `SURN`
 * as the `maidenName` (matches our schema's intent).
 */
function parseName(nameNode: GedNode | undefined): NameParts {
  if (!nameNode) {
    return { firstName: "", lastName: "" };
  }
  const raw = nameNode.value ?? "";
  const slash = raw.match(/^(.*?)\s*\/(.+?)\/\s*(.*)$/);
  let firstName = slash ? slash[1] : raw;
  let lastName = slash ? slash[2] : "";
  let maidenName: string | undefined;

  const givn = child(nameNode, "GIVN")?.value;
  const surn = child(nameNode, "SURN")?.value;
  const marnm = child(nameNode, "_MARNM")?.value;

  if (givn) firstName = givn;
  if (surn) lastName = surn;
  if (marnm && surn && marnm !== surn) {
    maidenName = surn;
    lastName = marnm;
  }
  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    maidenName: maidenName?.trim(),
  };
}

function parseSex(s: string | undefined): Sex | undefined {
  if (!s) return undefined;
  const v = s.trim().toUpperCase();
  if (v === "M") return "M";
  if (v === "F") return "F";
  return "U";
}

function parseEvent(node: GedNode | undefined): {
  date?: string;
  place?: string;
} {
  if (!node) return {};
  // Lone "BIRT Y" / "DEAT Y" means the event is known but no details.
  return {
    date: parseGedcomDate(child(node, "DATE")?.value),
    place: child(node, "PLAC")?.value?.trim() || undefined,
  };
}

export type ParseResult = {
  persons: Person[];
  relationships: Relationship[];
  /** Tags / records we skipped — surfaced to the UI so the user knows
   *  what didn't round-trip (e.g. multimedia, citations). */
  skipped: { tag: string; count: number }[];
  /** Headline counts for the import-review screen. */
  stats: {
    indi: number;
    fam: number;
    parentChild: number;
    marriages: number;
    partnerships: number;
  };
};

export function parseGedcom(text: string): ParseResult {
  const lines = tokenize(text);
  const forest = buildForest(lines);

  // First pass — every INDI / FAM xref gets a fresh UUID so children
  // can resolve their FAMC/FAMS pointers.
  const xrefToUuid = new Map<string, string>();
  for (const node of forest) {
    if (node.xref && (node.tag === "INDI" || node.tag === "FAM")) {
      xrefToUuid.set(node.xref, uuid());
    }
  }

  const now = new Date().toISOString();
  const persons: Person[] = [];
  const relationships: Relationship[] = [];
  const skipped = new Map<string, number>();

  function bump(tag: string) {
    skipped.set(tag, (skipped.get(tag) ?? 0) + 1);
  }

  for (const node of forest) {
    if (!node.xref) continue;

    if (node.tag === "INDI") {
      const id = xrefToUuid.get(node.xref);
      if (!id) continue;
      const name = parseName(child(node, "NAME"));
      const birth = parseEvent(child(node, "BIRT"));
      const death = parseEvent(child(node, "DEAT"));
      // NOTE blocks — concat if more than one.
      const notes = children(node, "NOTE")
        .map(readText)
        .filter(Boolean)
        .join("\n\n");
      const akaName = child(child(node, "NAME"), "_AKA")?.value?.trim();
      const personNotes = [
        notes,
        akaName ? `Also known as: ${akaName}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      // Track skipped tags so the user knows what didn't come over.
      for (const c of node.children) {
        if (
          ![
            "NAME",
            "SEX",
            "BIRT",
            "DEAT",
            "FAMC",
            "FAMS",
            "NOTE",
            "RIN",
            "_UID",
            "_UPD",
          ].includes(c.tag)
        ) {
          bump(`INDI:${c.tag}`);
        }
      }

      persons.push({
        id,
        firstName: name.firstName || "(unknown)",
        lastName: name.lastName || "(unknown)",
        maidenName: name.maidenName,
        sex: parseSex(child(node, "SEX")?.value),
        birthDate: birth.date,
        birthPlace: birth.place,
        deathDate: death.date,
        deathPlace: death.place,
        notes: personNotes || undefined,
        photos: [],
        createdAt: now,
        updatedAt: now,
      });
    } else if (node.tag === "FAM") {
      // Family resolves into 0-1 marriage edge + N parent-child edges.
      const husb = child(node, "HUSB")?.value;
      const wife = child(node, "WIFE")?.value;
      const husbId = husb ? xrefToUuid.get(husb) : undefined;
      const wifeId = wife ? xrefToUuid.get(wife) : undefined;

      // Track skipped sub-tags on the family record itself.
      for (const c of node.children) {
        if (
          ![
            "HUSB",
            "WIFE",
            "CHIL",
            "MARR",
            "DIV",
            "ENGA",
            "RIN",
            "_UID",
            "_UPD",
          ].includes(c.tag)
        ) {
          bump(`FAM:${c.tag}`);
        }
      }

      if (husbId && wifeId) {
        const marr = child(node, "MARR");
        const div = child(node, "DIV");
        // Spouses are recorded as a marriage edge when MARR is present
        // OR when neither MARR nor a competing tag (engagement only)
        // is present — GEDCOM convention is "no MARR block means
        // unconfirmed marriage between spouses pointed by HUSB/WIFE".
        const isMarriage = !!marr || !!div || !child(node, "ENGA");
        if (isMarriage) {
          const ev = parseEvent(marr);
          const m: Marriage = {
            id: uuid(),
            type: "marriage",
            personA: husbId,
            personB: wifeId,
            from: ev.date,
            to: undefined,
            divorced: !!div,
          };
          relationships.push(m);
        } else {
          const p: Partnership = {
            id: uuid(),
            type: "partnership",
            personA: husbId,
            personB: wifeId,
          };
          relationships.push(p);
        }
      }

      // CHIL pointers — emit parent-child for BOTH parents if present.
      for (const chilNode of children(node, "CHIL")) {
        const chilId = chilNode.value
          ? xrefToUuid.get(chilNode.value)
          : undefined;
        if (!chilId) continue;
        if (husbId) {
          const r: ParentChild = {
            id: uuid(),
            type: "parent-child",
            parent: husbId,
            child: chilId,
          };
          relationships.push(r);
        }
        if (wifeId) {
          const r: ParentChild = {
            id: uuid(),
            type: "parent-child",
            parent: wifeId,
            child: chilId,
          };
          relationships.push(r);
        }
      }
    }
  }

  const indi = persons.length;
  const fam = forest.filter((n) => n.tag === "FAM" && n.xref).length;
  const parentChild = relationships.filter(
    (r) => r.type === "parent-child",
  ).length;
  const marriages = relationships.filter((r) => r.type === "marriage").length;
  const partnerships = relationships.filter(
    (r) => r.type === "partnership",
  ).length;

  return {
    persons,
    relationships,
    skipped: [...skipped.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
    stats: { indi, fam, parentChild, marriages, partnerships },
  };
}
