// Logik des Bildpuzzles, ohne Oberfläche (in Node testbar).
// lage[platz] = Nummer des Teils, das auf diesem Platz liegt. Gelöst, wenn lage[platz] === platz für alle Plätze.

import { mischeOhneFixpunkte } from '../_gemeinsam/zufall.js';

/** Gemischte Startlage: höchstens ein Teil liegt schon richtig, nie schon gelöst. */
export const startlage = (anzahl, startwert) => mischeOhneFixpunkte(anzahl, startwert, 1);

export const richtigAnzahl = (lage) => lage.reduce((summe, teil, platz) => summe + (teil === platz ? 1 : 0), 0);
export const geloest = (lage) => lage.every((teil, platz) => teil === platz);
export const liegtRichtig = (lage, platz) => lage[platz] === platz;

/** Tauscht die Teile auf zwei Plätzen; liefert eine neue Lage. */
export function tausche(lage, a, b) {
  const neu = [...lage];
  [neu[a], neu[b]] = [neu[b], neu[a]];
  return neu;
}

/**
 * Hilfe „ein Teil legen“: der erste Platz (Ecken zuerst, dann Rand, dann Mitte), auf dem das falsche Teil liegt,
 * bekommt sein richtiges Teil. Liefert die beiden Plätze, die zu tauschen sind, oder null.
 */
export function naechsterZug(lage, spalten) {
  const zeilen = lage.length / spalten;
  const rang = (platz) => {
    const x = platz % spalten;
    const y = Math.floor(platz / spalten);
    const randX = x === 0 || x === spalten - 1;
    const randY = y === 0 || y === zeilen - 1;
    return randX && randY ? 0 : randX || randY ? 1 : 2;
  };
  const plaetze = [...lage.keys()].sort((a, b) => rang(a) - rang(b) || a - b);
  const ziel = plaetze.find((platz) => lage[platz] !== platz);
  if (ziel === undefined) return null;
  return [ziel, lage.indexOf(ziel)];
}

/** Reihe und Platz in der Reihe (ab 1) für Ansagen. */
export function stelle(platz, spalten) {
  return { reihe: Math.floor(platz / spalten) + 1, spalte: (platz % spalten) + 1 };
}

/** Nachbarplatz für die Pfeiltasten; bleibt am Rand stehen. */
export function nachbar(platz, richtung, spalten, anzahl) {
  const x = platz % spalten;
  const y = Math.floor(platz / spalten);
  const zeilen = anzahl / spalten;
  if (richtung === 'links') return x > 0 ? platz - 1 : platz;
  if (richtung === 'rechts') return x < spalten - 1 ? platz + 1 : platz;
  if (richtung === 'hoch') return y > 0 ? platz - spalten : platz;
  if (richtung === 'runter') return y < zeilen - 1 ? platz + spalten : platz;
  if (richtung === 'anfang') return 0;
  if (richtung === 'ende') return anzahl - 1;
  return platz;
}
