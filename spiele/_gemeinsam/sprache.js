// Texte in Standardsprache und einfacher Sprache, Zahlen auf Deutsch.
// Ein Textfeld in den Inhalten ist entweder ein String (gilt für beide Sprachstufen) oder
// { standard: "…", einfach: "…" }. Fehlt die einfache Fassung, gilt die Standardfassung.

/** Text in der gewählten Sprachstufe. */
export function text(feld, sprache = 'standard') {
  if (feld == null) return '';
  if (typeof feld === 'string') return feld;
  if (typeof feld === 'object') return feld[sprache] ?? feld.standard ?? '';
  return String(feld);
}

const zahlFormat = new Map();

/** Zahl mit deutschem Tausenderpunkt und Komma, höchstens `stellen` Nachkommastellen. */
export function zahl(n, stellen = 2) {
  if (!zahlFormat.has(stellen)) {
    zahlFormat.set(stellen, new Intl.NumberFormat('de-DE', { maximumFractionDigits: stellen }));
  }
  return zahlFormat.get(stellen).format(n);
}

/**
 * Große Zahlen lesbar: in einfacher Sprache gerundet mit Wort („26 Millionen“),
 * sonst mit Tausenderpunkten („26.021.000“).
 */
export function grosseZahl(n, sprache = 'standard') {
  const betrag = Math.abs(n);
  if (sprache === 'einfach' || betrag >= 1e9) {
    if (betrag >= 1e9) return `${zahl(n / 1e9, betrag >= 1e10 ? 0 : 1)} ${Math.abs(n / 1e9) < 2 ? 'Milliarde' : 'Milliarden'}`;
    if (betrag >= 1e6) return `${zahl(n / 1e6, betrag >= 1e7 ? 0 : 1)} ${Math.abs(n / 1e6) < 2 ? 'Million' : 'Millionen'}`;
    if (betrag >= 1e4) return `${zahl(Math.round(n / 1000), 0)} Tausend`;
  }
  return zahl(n, betrag >= 100 ? 0 : 2);
}

/** Wert mit Einheit, Einzahl oder Mehrzahl: einheit = "Meter" oder { eins: "Ziegel", viele: "Ziegel" }. */
export function mitEinheit(n, einheit, sprache = 'standard') {
  if (!einheit) return grosseZahl(n, sprache);
  const wort = typeof einheit === 'string' ? einheit : (n === 1 ? einheit.eins : einheit.viele) ?? einheit.eins;
  return `${grosseZahl(n, sprache)} ${wort}`;
}

/** „3 von 5“ als Text. */
export const vonText = (teil, ganz) => `${teil} von ${ganz}`;
