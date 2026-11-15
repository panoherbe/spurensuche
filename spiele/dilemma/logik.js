// Logik des Dilemmas, ohne Oberfläche (in Node testbar).

/**
 * Wertet die Stimmen aus. stimmen: { optionId: anzahl }.
 * Liefert { gesamt, gewinner (id oder null bei Gleichstand), art: 'einig' | 'mehrheit' | null, gleichstand }.
 */
export function auszaehlen(stimmen) {
  const eintraege = Object.entries(stimmen).filter(([, n]) => n > 0);
  const gesamt = eintraege.reduce((s, [, n]) => s + n, 0);
  if (gesamt === 0) return { gesamt, gewinner: null, art: null, gleichstand: false };
  const hoechste = Math.max(...eintraege.map(([, n]) => n));
  const vorn = eintraege.filter(([, n]) => n === hoechste);
  if (vorn.length > 1) return { gesamt, gewinner: null, art: null, gleichstand: true };
  return { gesamt, gewinner: vorn[0][0], art: eintraege.length === 1 ? 'einig' : 'mehrheit', gleichstand: false };
}

/**
 * Prüft eine Begründung: alle gewählten Argumente müssen zur Entscheidung passen.
 * Liefert { gueltig, passend: [ids], unpassend: [ids] }.
 */
export function pruefeBegruendung(gewaehlt, argumente, entscheidung) {
  const nachId = new Map(argumente.map((a) => [a.id, a]));
  const passend = [];
  const unpassend = [];
  for (const id of gewaehlt) {
    const argument = nachId.get(id);
    if (!argument) continue;
    (argument.fuer === entscheidung ? passend : unpassend).push(id);
  }
  return { gueltig: passend.length > 0 && unpassend.length === 0, passend, unpassend };
}

/** Sterne: 3, wenn die Gruppe begründet und eine Meinung der Gegenseite ernst nimmt; 2 mit Begründung. */
export const dilemmaSterne = ({ begruendet, gegenseite }) => (begruendet ? (gegenseite ? 3 : 2) : 0);
