// Datum, Uhrzeit und Löschfristen. Anzeige deutsch (TT.MM.JJJJ), gespeichert in ISO 8601 (UTC).

const zwei = (n) => String(n).padStart(2, '0');

/** „20.11.2026“ in der Zeitzone des Geräts. */
export function datum(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** „20.11.2026, 09:41 Uhr“ */
export function datumZeit(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return `${datum(iso)}, ${zwei(d.getHours())}:${zwei(d.getMinutes())} Uhr`;
}

/** „vor 3 Minuten“, „gerade eben“ */
export function vorZeit(iso, jetzt = Date.now()) {
  if (!iso) return 'noch nie';
  const s = Math.max(0, Math.round((jetzt - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'gerade eben';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'vor 1 Minute' : `vor ${m} Minuten`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'vor 1 Stunde' : `vor ${h} Stunden`;
  return `am ${datum(iso)}`;
}

export const AUFBEWAHRUNG_WOCHEN = 12;

/** Ende des Schuljahres, in das `iso` fällt: 31. Juli, 23:59:59 Uhr (Ortszeit des Servers). */
export function schuljahresende(iso) {
  const d = new Date(iso);
  const jahr = d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear(); // ab August gilt das nächste Ende
  return new Date(jahr, 6, 31, 23, 59, 59).toISOString();
}

/**
 * Wann Gruppendaten spätestens gelöscht werden: zwölf Wochen nach Abschluss der Quest, höchstens aber zum Ende
 * des Schuljahres. Ohne Abschluss zählt der Beginn.
 */
export function loeschtermin({ abgeschlossen = null, begonnen }, wochen = AUFBEWAHRUNG_WOCHEN) {
  const basis = new Date(abgeschlossen ?? begonnen);
  const nachFrist = new Date(basis.getTime() + wochen * 7 * 86400000).toISOString();
  const ende = schuljahresende(begonnen);
  return nachFrist < ende ? nachFrist : ende;
}

/** Schuljahr als Text, z. B. „2026/27“. */
export function schuljahr(iso) {
  const d = new Date(iso);
  const start = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}
