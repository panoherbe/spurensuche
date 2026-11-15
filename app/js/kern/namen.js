// Gruppenbezeichnungen ohne Personenbezug: neutrale Vorschläge und ein Hinweis bei freier Eingabe.

export const VORSCHLAEGE = Object.freeze({
  Tiere: ['Biber', 'Eule', 'Fuchs', 'Luchs', 'Otter', 'Dachs', 'Falke', 'Igel', 'Kranich', 'Wiesel', 'Elster', 'Hirsch', 'Lerche', 'Specht', 'Storch', 'Wolf'],
  Farben: ['Rot', 'Orange', 'Gelb', 'Grün', 'Türkis', 'Blau', 'Violett', 'Silber', 'Gold', 'Bernstein'],
  Dinge: ['Kompass', 'Laterne', 'Fernrohr', 'Anker', 'Kristall', 'Schlüssel', 'Pinsel', 'Feder', 'Brücke', 'Turm'],
});

export const HINWEIS_FREI = 'Bitte keine Namen oder Namensteile von Schülerinnen und Schülern verwenden. Nehmen Sie lieber einen Vorschlag aus der Liste.';

/** Alle Vorschläge, die in `vergeben` noch nicht vorkommen (ohne Groß-/Kleinschreibung). */
export function freieVorschlaege(vergeben = []) {
  const belegt = new Set(vergeben.map((v) => v.toLocaleLowerCase('de')));
  return Object.fromEntries(Object.entries(VORSCHLAEGE).map(([k, liste]) => [k, liste.filter((n) => !belegt.has(n.toLocaleLowerCase('de')))]));
}

export function istVorschlag(name) {
  const n = String(name).trim().toLocaleLowerCase('de');
  return Object.values(VORSCHLAEGE).some((liste) => liste.some((v) => v.toLocaleLowerCase('de') === n));
}

/**
 * Prüft eine Bezeichnung. Liefert `{ ok, fehler, hinweis }`: `fehler` verhindert das Speichern (leer, zu lang,
 * Sonderzeichen), `hinweis` muss vor dem Speichern einer freien Bezeichnung bestätigt werden.
 */
export function pruefeBezeichnung(name) {
  const n = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!n) return { ok: false, fehler: 'Bitte eine Bezeichnung wählen.', name: n };
  if ([...n].length > 24) return { ok: false, fehler: 'Höchstens 24 Zeichen.', name: n };
  if (!/^[\p{L}\p{N} .\-]+$/u.test(n)) return { ok: false, fehler: 'Nur Buchstaben, Ziffern, Leerzeichen, Punkt und Bindestrich.', name: n };
  if (/@|\d{4,}/.test(n)) return { ok: false, fehler: 'Keine Adressen oder langen Zahlen.', name: n };
  return { ok: true, name: n, hinweis: istVorschlag(n) ? null : HINWEIS_FREI };
}

/** Teamname im Familienmodus: frei gewählt, bleibt nur auf dem Gerät. */
export function pruefeTeamname(name) {
  const n = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!n) return { ok: false, fehler: 'Wie soll euer Team heißen?' };
  if ([...n].length > 30) return { ok: false, fehler: 'Höchstens 30 Zeichen.' };
  return { ok: true, name: n };
}
