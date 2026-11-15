// Logik der Bildsuche, ohne Oberfläche (in Node testbar). Alle Koordinaten relativ zum Bild: 0 … 1.
// Ein Bereich ist { x, y, b, h } (links, oben, Breite, Höhe).

/** Trifft der Punkt (px, py) einen der Bereiche? toleranz erweitert jeden Bereich ringsum (relativ). */
export function trifft(px, py, bereiche, toleranz = 0.02) {
  return bereiche.some(({ x, y, b, h }) => px >= x - toleranz && px <= x + b + toleranz && py >= y - toleranz && py <= y + h + toleranz);
}

/** Feld (spalte, zeile) im Raster als Bereich. */
export function feldBereich(spalte, zeile, spalten, zeilen) {
  return { x: spalte / spalten, y: zeile / zeilen, b: 1 / spalten, h: 1 / zeilen };
}

/** Überlappen zwei Bereiche (mit Fläche > 0)? */
export function ueberlappt(a, b) {
  return a.x < b.x + b.b && b.x < a.x + a.b && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Trifft das Feld eines der Ziel-Bereiche? (Suche per Tastatur oder Bildschirmleser.) */
export function feldTrifft(spalte, zeile, spalten, zeilen, bereiche) {
  const feld = feldBereich(spalte, zeile, spalten, zeilen);
  return bereiche.some((bereich) => ueberlappt(feld, bereich));
}

/** Mittelpunkt und Größe eines Ziels (über alle Bereiche) für Markierung und Hilfe. */
export function zielKreis(bereiche) {
  const x1 = Math.min(...bereiche.map((b) => b.x));
  const y1 = Math.min(...bereiche.map((b) => b.y));
  const x2 = Math.max(...bereiche.map((b) => b.x + b.b));
  const y2 = Math.max(...bereiche.map((b) => b.y + b.h));
  const erster = bereiche[0];
  return { x: erster.x + erster.b / 2, y: erster.y + erster.h / 2, rahmen: { x: x1, y: y1, b: x2 - x1, h: y2 - y1 } };
}

/** Grobe Lage in Worten: „oben links“, „in der Mitte“, „unten rechts“ … */
export function lageInWorten(x, y) {
  const senkrecht = y < 0.34 ? 'oben' : y > 0.66 ? 'unten' : 'in der Mitte';
  const waagerecht = x < 0.34 ? 'links' : x > 0.66 ? 'rechts' : '';
  if (senkrecht === 'in der Mitte') return waagerecht ? `in der Mitte ${waagerecht}` : 'in der Mitte';
  return waagerecht ? `${senkrecht} ${waagerecht}` : `${senkrecht} in der Mitte`;
}

/** Neuer Anlauf nach einem Fehlklick: true, wenn der nächste Klick deutlich woanders liegt (mehr als `abstand`). */
export const anderswo = (alt, neu, abstand = 0.2) => Math.hypot(neu.x - alt.x, neu.y - alt.y) > abstand;
