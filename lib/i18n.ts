/**
 * Minimal i18n — flat string-key dictionary per locale, reactive via
 * `LocaleProvider`. Polish is the default; English is a one-toggle
 * away. New strings get added once per locale; `t(key)` returns the
 * Polish value if the English one is missing (and vice-versa) so the
 * UI never shows a raw key when a translator forgets a pair.
 *
 * Why not next-intl / next-i18next: this app is solo + tiny, and
 * those libraries bring routing assumptions (locale-prefixed URLs,
 * middleware, message-format AST) that would dwarf the rest of the
 * codebase. A direct dictionary keeps everything in one file and
 * stays easy to grep.
 */

export type Locale = "pl" | "en";
export const DEFAULT_LOCALE: Locale = "pl";

/** All translatable strings. PL first since it's the default; EN fills
 *  the second column. Keep keys hierarchical (`section.subkey`) so the
 *  file stays scannable as the app grows. */
const dict = {
  nav: {
    dashboard: { pl: "Pulpit", en: "Dashboard" },
    people: { pl: "Osoby", en: "People" },
    tree: { pl: "Drzewo", en: "Tree" },
    table: { pl: "Tabela", en: "Table" },
    import: { pl: "Import", en: "Import" },
    export: { pl: "Eksport", en: "Export" },
    language: { pl: "Język", en: "Language" },
  },
  common: {
    save: { pl: "Zapisz", en: "Save" },
    saveChanges: { pl: "Zapisz zmiany", en: "Save changes" },
    cancel: { pl: "Anuluj", en: "Cancel" },
    close: { pl: "Zamknij", en: "Close" },
    delete: { pl: "Usuń", en: "Delete" },
    edit: { pl: "Edytuj", en: "Edit" },
    add: { pl: "Dodaj", en: "Add" },
    loading: { pl: "Ładowanie…", en: "Loading…" },
    back: { pl: "Powrót", en: "Back" },
    confirm: { pl: "Potwierdź", en: "Confirm" },
    of: { pl: "z", en: "of" },
  },
  dashboard: {
    countPersons: { pl: "Osoby", en: "People" },
    countRelationships: { pl: "Relacje", en: "Relationships" },
    mostRecent: { pl: "Ostatnia edycja", en: "Most recent edit" },
    addPerson: { pl: "Dodaj osobę", en: "Add person" },
    recentlyEdited: { pl: "Ostatnio edytowane", en: "Recently edited" },
    noPeopleYet: { pl: "Brak osób — ", en: "No people yet — " },
    addTheFirst: { pl: "dodaj pierwszą", en: "add the first person" },
    intro: {
      pl: "Baza rodzinna solo. Dane mieszkają w ",
      en: "Solo family-tree database. Data lives at ",
    },
    introTail: {
      pl: " obok aplikacji.",
      en: " next to the app.",
    },
  },
  people: {
    title: { pl: "Osoby", en: "People" },
    filter: {
      pl: "Filtruj po imieniu, miejscu, czymkolwiek…",
      en: "Filter by name, place, anything…",
    },
    colLast: { pl: "Nazwisko", en: "Last name" },
    colFirst: { pl: "Imię", en: "First name" },
    colSex: { pl: "Płeć", en: "Sex" },
    colBorn: { pl: "Ur.", en: "Born" },
    colDied: { pl: "Zm.", en: "Died" },
    noMatch: { pl: "Brak wyników dla filtra.", en: "No people match the filter." },
    backToList: { pl: "Wróć do listy", en: "Back to list" },
  },
  personForm: {
    edit: { pl: "Edytuj osobę", en: "Edit person" },
    add: { pl: "Dodaj osobę", en: "Add person" },
    firstName: { pl: "Imię", en: "First name" },
    lastName: { pl: "Nazwisko", en: "Last name" },
    maidenName: { pl: "Nazwisko rodowe", en: "Maiden name" },
    maidenHint: {
      pl: "Nazwisko z urodzenia, jeśli inne",
      en: "Birth surname if different",
    },
    sex: { pl: "Płeć", en: "Sex" },
    sexUnknown: { pl: "— nieznana —", en: "— unknown —" },
    sexMale: { pl: "Mężczyzna", en: "Male" },
    sexFemale: { pl: "Kobieta", en: "Female" },
    sexOther: { pl: "Inna / nieokreślona", en: "Other / unspecified" },
    birthDate: { pl: "Data urodzenia", en: "Birth date" },
    birthPlace: { pl: "Miejsce urodzenia", en: "Birth place" },
    deathDate: { pl: "Data śmierci", en: "Death date" },
    deathPlace: { pl: "Miejsce śmierci", en: "Death place" },
    notes: { pl: "Notatki", en: "Notes" },
    dateHint: {
      pl: "RRRR, RRRR-MM lub RRRR-MM-DD — daty częściowe są OK",
      en: "YYYY, YYYY-MM or YYYY-MM-DD — partial dates are OK",
    },
    deathHint: {
      pl: "Zostaw puste jeśli osoba żyje",
      en: "Leave empty if the person is alive",
    },
    createBtn: { pl: "Utwórz osobę", en: "Create person" },
    deletePrompt: {
      pl: 'Usunąć osobę "{name}"? To również usuwa wszystkie relacje, w których uczestniczy.',
      en: 'Delete {name}? This also drops every relationship that mentions them.',
    },
    setCentral: { pl: "Ustaw jako osobę centralną", en: "Set as central person" },
    isCentral: { pl: "Osoba centralna ✓", en: "Central person ✓" },
    clearCentral: { pl: "Usuń status centralnej", en: "Unset central" },
  },
  relationships: {
    title: { pl: "Relacje", en: "Relationships" },
    around: { pl: "Edytuj graf rodzinny wokół osoby ", en: "Edit the family graph around " },
    aroundTail: {
      pl: ". Dodanie tutaj aktualizuje główną tablicę relacji — rodzeństwo, kuzyni, dziadkowie wyliczają się z niej automatycznie.",
      en: ". Adding here updates the canonical relationships table — siblings / cousins / grandparents are derived from it automatically.",
    },
    parents: { pl: "Rodzice", en: "Parents" },
    partners: { pl: "Partnerzy", en: "Partners" },
    children: { pl: "Dzieci", en: "Children" },
    noParents: { pl: "Brak zapisanych rodziców.", en: "No parents recorded yet." },
    noPartners: {
      pl: "Brak zapisanych małżeństw / partnerstw.",
      en: "No marriages or partnerships recorded yet.",
    },
    noChildren: { pl: "Brak zapisanych dzieci.", en: "No children recorded yet." },
    addParent: { pl: "Dodaj rodzica", en: "Add parent" },
    addChild: { pl: "Dodaj dziecko", en: "Add child" },
    addPartner: { pl: "Dodaj partnera", en: "Add partner" },
    adoptive: {
      pl: "Adopcyjny / przybrany (nie biologiczny)",
      en: "Adoptive / step (not biological)",
    },
    partnerType: { pl: "Typ relacji", en: "Relationship type" },
    marriage: { pl: "Małżeństwo", en: "Marriage" },
    partnership: { pl: "Partnerstwo (bez ślubu)", en: "Partnership (unmarried)" },
    divorced: { pl: "Rozwiedzeni", en: "Divorced" },
    from: { pl: "Od", en: "From" },
    to: { pl: "Do (jeśli zakończona)", en: "To (if ended)" },
    changePerson: { pl: "Zmień osobę", en: "Change person" },
    removePrompt: {
      pl: "Usunąć tę relację? Osoby pozostają — usuwany jest tylko łącznik.",
      en: "Remove this relationship? The persons stay; only the link is deleted.",
    },
    typeMarriage: { pl: "Małżeństwo", en: "Marriage" },
    typePartnership: { pl: "Partnerstwo", en: "Partnership" },
    fromShort: { pl: "od", en: "from" },
    toShort: { pl: "do", en: "to" },
    divorcedTag: { pl: "rozwód", en: "divorced" },
  },
  photoGallery: {
    title: { pl: "Zdjęcia", en: "Photos" },
    intro: {
      pl: "Przeciągnij obrazki tutaj lub kliknij kafelek wgrania. JPEG / PNG / WebP / GIF do 15 MB. Pierwsze zdjęcie jest używane jako awatar w pozostałych miejscach aplikacji.",
      en: "Drop images here or click the upload tile. JPEG / PNG / WebP / GIF up to 15 MB. The first photo is used as the avatar everywhere else in the app.",
    },
    clickOrDrop: { pl: "Kliknij lub upuść plik", en: "Click or drop file" },
    uploading: { pl: "Wgrywanie…", en: "Uploading…" },
    primary: { pl: "Główne", en: "Primary" },
    setPrimary: { pl: "Ustaw jako główne", en: "Set as primary" },
    viewOriginal: { pl: "Zobacz oryginał", en: "View original" },
    deletePrompt: {
      pl: "Usunąć to zdjęcie? Tej operacji nie można cofnąć.",
      en: "Delete this photo? This cannot be undone.",
    },
  },
  tree: {
    nee: { pl: "z domu", en: "née" },
    centralPerson: { pl: "Osoba centralna:", en: "Central person:" },
    pickCentral: { pl: "Wybierz osobę centralną…", en: "Pick a central person…" },
    upGenerations: { pl: "Przodkowie:", en: "Ancestors:" },
    downGenerations: { pl: "Potomkowie:", en: "Descendants:" },
    generations: { pl: "pokolenia", en: "generations" },
    generation: { pl: "pokolenie", en: "generation" },
    legend: {
      pl: "Kliknij kartę, by edytować daną osobę. Partnerzy na różowo; rozwiedzeni linią przerywaną.",
      en: "Click a card to open / edit that person. Spouse links shown in pink; divorced marriages are dashed.",
    },
    emptyRoot: {
      pl: "Brak osoby centralnej — wybierz kogoś z listy powyżej.",
      en: "Root person not found — pick someone from the list above.",
    },
    emptyView: {
      pl: "Brak osób w widoku. Spróbuj zwiększyć głębokość.",
      en: "No people in this view. Try increasing depth.",
    },
    emptyTreeTitle: { pl: "Brak osób w drzewie.", en: "No people in the tree yet." },
    emptyTreeBody: {
      pl: "Dodaj kogoś ręcznie lub zaimportuj plik GEDCOM.",
      en: "Add someone manually or import a GEDCOM file.",
    },
  },
} as const;

type DictTree = typeof dict;
type Leaf = { pl: string; en: string };

type PathOf<T> = T extends Leaf
  ? ""
  : {
      [K in keyof T & string]: PathOf<T[K]> extends infer P
        ? P extends ""
          ? K
          : `${K}.${P & string}`
        : never;
    }[keyof T & string];

export type TKey = PathOf<DictTree>;

function lookup(key: string, locale: Locale): string {
  const parts = key.split(".");
  // Walk the dict tree; bail out to the key itself if anything is
  // missing so a stale call still gives a hint about what's wrong.
  let node: unknown = dict;
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  if (
    node &&
    typeof node === "object" &&
    "pl" in node &&
    "en" in node
  ) {
    const v = (node as Leaf)[locale];
    if (v) return v;
    // Fallback to the other locale — better than rendering nothing.
    const other: Locale = locale === "pl" ? "en" : "pl";
    return (node as Leaf)[other] ?? key;
  }
  return key;
}

/** Substitute `{name}` and similar placeholders in a translated string. */
export function format(text: string, params?: Record<string, string>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
}

/** Server-side variant — pass the active locale explicitly. */
export function tFor(
  locale: Locale,
  key: TKey,
  params?: Record<string, string>,
): string {
  return format(lookup(key, locale), params);
}
