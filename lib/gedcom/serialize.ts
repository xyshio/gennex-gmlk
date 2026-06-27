import { isParentChild } from "@/lib/graph";
import type {
  FamilyTree,
  Marriage,
  Partnership,
  Person,
  Relationship,
} from "@/lib/types";

/**
 * Serialize an in-memory FamilyTree to GEDCOM 5.5.1 text — the same
 * dialect MyHeritage / Ancestry / FamilySearch all import. The output
 * round-trips: feeding it back through `parseGedcom()` produces the
 * same persons + relationships (modulo extra metadata like `_UID`
 * which we don't store).
 *
 * Conventions:
 *   - Encoding: UTF-8 (with BOM, like MyHeritage). Newlines: CRLF.
 *   - Individuals get xrefs `@I1@`, `@I2@`, ...
 *   - Families get `@F1@`, `@F2@`, ...
 *   - A FAM record is emitted for every distinct PARENT-PAIR (or
 *     single-parent set) that appears in the relationship list, plus
 *     every marriage / partnership pair even if they have no children.
 *   - Surname semantics mirror the parser: when `maidenName` is set,
 *     `SURN` carries the birth surname and `_MARNM` carries the
 *     post-marriage `lastName` (MyHeritage convention).
 */

const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** Inverse of `parseGedcomDate` — write a partial ISO date as GEDCOM. */
export function formatGedcomDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const full = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) {
    const m = Number(full[2]);
    if (m >= 1 && m <= 12) {
      return `${Number(full[3])} ${MONTH_NAMES[m - 1]} ${full[1]}`;
    }
  }
  const ym = iso.match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    const m = Number(ym[2]);
    if (m >= 1 && m <= 12) {
      return `${MONTH_NAMES[m - 1]} ${ym[1]}`;
    }
  }
  const y = iso.match(/^(\d{4})$/);
  if (y) return y[1];
  // Anything else passes through — better an odd date than no date.
  return iso;
}

type Line = string;

class Writer {
  private lines: Line[] = [];

  push(level: number, tag: string, value?: string): void {
    const v = value?.trim();
    this.lines.push(v ? `${level} ${tag} ${v}` : `${level} ${tag}`);
  }

  /** Multi-line text — first line as TAG, subsequent as CONT. Anything
   *  past 248 characters per line is split via CONC to stay inside the
   *  GEDCOM line-length limit (some strict parsers reject longer). */
  pushText(level: number, tag: string, text: string): void {
    const paragraphs = text.replace(/\r\n?/g, "\n").split("\n");
    paragraphs.forEach((para, idx) => {
      const chunks = chunkLine(para, 248);
      chunks.forEach((chunk, ci) => {
        if (idx === 0 && ci === 0) this.push(level, tag, chunk);
        else if (ci === 0) this.push(level + 1, "CONT", chunk);
        else this.push(level + 1, "CONC", chunk);
      });
    });
  }

  /** Reference an xref as the VALUE of a line — `1 HUSB @I12@`. */
  pushRef(level: number, tag: string, xref: string): void {
    this.lines.push(`${level} ${tag} ${xref}`);
  }

  declareRecord(xref: string, type: "INDI" | "FAM"): void {
    this.lines.push(`0 ${xref} ${type}`);
  }

  toString(): string {
    return this.lines.join("\r\n") + "\r\n";
  }
}

function chunkLine(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    out.push(s.slice(i, i + max));
    i += max;
  }
  return out;
}

type FamilyKey = string; // sorted "parentIdA|parentIdB" or "parentIdA|" for single-parent

function familyKey(parentA?: string, parentB?: string): FamilyKey {
  const ids = [parentA, parentB].filter(Boolean).sort();
  return ids.join("|");
}

type FamRecord = {
  xref: string;
  husb?: string;       // person id, gets mapped to xref at write time
  wife?: string;
  children: string[];  // person ids
  marriage?: Marriage;
  partnership?: Partnership;
};

/** Pick a stable "husb" vs "wife" assignment for a parent pair, using
 *  the persons' `sex` field. Falls back to alphabetical order when sex
 *  is unset on both. Mirrors what most genealogy tools assume — HUSB
 *  for M, WIFE for F — but doesn't break for same-sex / unspecified
 *  pairs (they just land deterministically). */
function assignHusbWife(
  a: string,
  b: string,
  byId: Map<string, Person>,
): { husb?: string; wife?: string } {
  const pa = byId.get(a);
  const pb = byId.get(b);
  if (pa?.sex === "M" && pb?.sex !== "M") return { husb: a, wife: b };
  if (pb?.sex === "M" && pa?.sex !== "M") return { husb: b, wife: a };
  if (pa?.sex === "F" && pb?.sex !== "F") return { wife: a, husb: b };
  if (pb?.sex === "F" && pa?.sex !== "F") return { wife: b, husb: a };
  // Both same / unknown — alphabetical by id.
  const [x, y] = [a, b].sort();
  return { husb: x, wife: y };
}

export function serializeGedcom(tree: FamilyTree): string {
  const w = new Writer();
  const byId = new Map(tree.persons.map((p) => [p.id, p]));

  // ---- xref allocation -----------------------------------------------
  // Persons get @I1..@IN in tree.persons order so re-export is stable
  // for a given tree.
  const personXref = new Map<string, string>();
  tree.persons.forEach((p, i) => personXref.set(p.id, `@I${i + 1}@`));

  // ---- group parent-child edges into FAM records --------------------
  // For each child collect its parent set; any unique parent set is a
  // family. A child with two parents whose order isn't deterministic
  // would otherwise produce two FAMs, so we always sort parent ids.
  const childParents = new Map<string, Set<string>>();
  for (const r of tree.relationships) {
    if (isParentChild(r)) {
      const set = childParents.get(r.child) ?? new Set<string>();
      set.add(r.parent);
      childParents.set(r.child, set);
    }
  }

  const familyByKey = new Map<FamilyKey, FamRecord>();
  let nextFamN = 1;
  function getOrCreateFam(parentA?: string, parentB?: string): FamRecord {
    const key = familyKey(parentA, parentB);
    let fam = familyByKey.get(key);
    if (fam) return fam;
    const xref = `@F${nextFamN++}@`;
    fam = { xref, children: [] };
    if (parentA && parentB) {
      const { husb, wife } = assignHusbWife(parentA, parentB, byId);
      fam.husb = husb;
      fam.wife = wife;
    } else if (parentA) {
      // Single-parent family — slot them into husb or wife by sex.
      const p = byId.get(parentA);
      if (p?.sex === "F") fam.wife = parentA;
      else fam.husb = parentA;
    }
    familyByKey.set(key, fam);
    return fam;
  }

  // Children → families
  for (const [childId, parents] of childParents) {
    const arr = [...parents].sort();
    const fam = getOrCreateFam(arr[0], arr[1]);
    fam.children.push(childId);
  }

  // Marriages + partnerships — attach to existing parent-set family
  // when both partners parented somebody together, otherwise create a
  // childless FAM record for the marriage alone.
  for (const r of tree.relationships) {
    if (r.type === "marriage" || r.type === "partnership") {
      const fam = getOrCreateFam(r.personA, r.personB);
      if (r.type === "marriage") fam.marriage = r;
      else fam.partnership = r;
    }
  }

  // Stable ordering of FAM emission — by xref number — so byte-for-byte
  // diffs are sane after edits.
  const familyList: FamRecord[] = [...familyByKey.values()].sort(
    (a, b) => famNum(a.xref) - famNum(b.xref),
  );

  // ---- person → families lookup for FAMC / FAMS pointers -------------
  const famsByPerson = new Map<string, string[]>(); // person id → [@Fn@]
  const famcByPerson = new Map<string, string>(); // person id → @Fn@
  for (const fam of familyList) {
    if (fam.husb) push(famsByPerson, fam.husb, fam.xref);
    if (fam.wife) push(famsByPerson, fam.wife, fam.xref);
    for (const c of fam.children) {
      // A child may appear in multiple parent-pair sets if relationships
      // were entered inconsistently (e.g. parent listed twice). The
      // first wins — GEDCOM expects at most one FAMC per child.
      if (!famcByPerson.has(c)) famcByPerson.set(c, fam.xref);
    }
  }

  // ---- HEAD ----------------------------------------------------------
  w.push(0, "HEAD");
  w.push(1, "GEDC");
  w.push(2, "VERS", "5.5.1");
  w.push(2, "FORM", "LINEAGE-LINKED");
  w.push(1, "CHAR", "UTF-8");
  w.push(1, "SOUR", "gennex");
  w.push(2, "NAME", "gennex (https://github.com/local)");
  w.push(2, "VERS", "0.1.0");
  w.push(1, "DATE", formatGedcomDate(new Date().toISOString().slice(0, 10)) ?? "");
  if (tree.metadata?.name) {
    w.push(1, "FILE", tree.metadata.name);
  }

  // ---- INDI records --------------------------------------------------
  for (const p of tree.persons) {
    const xref = personXref.get(p.id)!;
    w.declareRecord(xref, "INDI");

    // NAME line — GEDCOM uses "Given /Surname/ Suffix" form.
    const surForName =
      p.maidenName && p.maidenName !== p.lastName ? p.maidenName : p.lastName;
    w.push(
      1,
      "NAME",
      `${p.firstName} /${surForName}/`.trim(),
    );
    if (p.firstName) w.push(2, "GIVN", p.firstName);
    if (surForName) w.push(2, "SURN", surForName);
    // Married surname (different from birth surname) → _MARNM convention.
    if (p.maidenName && p.maidenName !== p.lastName && p.lastName) {
      w.push(2, "_MARNM", p.lastName);
    }

    if (p.sex) w.push(1, "SEX", p.sex);

    if (p.birthDate || p.birthPlace) {
      w.push(1, "BIRT");
      const d = formatGedcomDate(p.birthDate);
      if (d) w.push(2, "DATE", d);
      if (p.birthPlace) w.push(2, "PLAC", p.birthPlace);
    }
    if (p.deathDate || p.deathPlace) {
      w.push(1, "DEAT");
      const d = formatGedcomDate(p.deathDate);
      if (d) w.push(2, "DATE", d);
      if (p.deathPlace) w.push(2, "PLAC", p.deathPlace);
    }

    if (p.notes) {
      w.pushText(1, "NOTE", p.notes);
    }

    const famc = famcByPerson.get(p.id);
    if (famc) w.pushRef(1, "FAMC", famc);
    const fams = famsByPerson.get(p.id) ?? [];
    for (const f of fams) w.pushRef(1, "FAMS", f);
  }

  // ---- FAM records ---------------------------------------------------
  for (const fam of familyList) {
    w.declareRecord(fam.xref, "FAM");
    if (fam.husb) {
      const xref = personXref.get(fam.husb);
      if (xref) w.pushRef(1, "HUSB", xref);
    }
    if (fam.wife) {
      const xref = personXref.get(fam.wife);
      if (xref) w.pushRef(1, "WIFE", xref);
    }
    for (const c of fam.children) {
      const xref = personXref.get(c);
      if (xref) w.pushRef(1, "CHIL", xref);
    }
    if (fam.marriage) {
      w.push(1, "MARR");
      const d = formatGedcomDate(fam.marriage.from);
      if (d) w.push(2, "DATE", d);
      if (fam.marriage.to) {
        // Best we can do for "marriage ended on X" within plain MARR.
        w.push(2, "NOTE", `Ended: ${fam.marriage.to}`);
      }
      if (fam.marriage.divorced) {
        w.push(1, "DIV", "Y");
      }
    } else if (fam.partnership) {
      // Emit as ENGA (engagement) — closest standard GEDCOM tag for
      // "couple, not married". Our parser keys partnership detection
      // off the presence of this tag, so round-trip is lossless.
      w.push(1, "ENGA");
      const d = formatGedcomDate(fam.partnership.from);
      if (d) w.push(2, "DATE", d);
    }
  }

  // ---- TRLR ----------------------------------------------------------
  w.push(0, "TRLR");

  // UTF-8 BOM up front to match the convention every export tool uses.
  return "﻿" + w.toString();
}

function famNum(xref: string): number {
  const m = xref.match(/^@F(\d+)@$/);
  return m ? Number(m[1]) : 0;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const arr = m.get(k) ?? [];
  arr.push(v);
  m.set(k, arr);
}

// Re-export so a future caller writing single-record exports has the
// helpers without dipping into internals.
export type { Marriage, Partnership, Relationship };
