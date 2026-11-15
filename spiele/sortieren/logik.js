// Logik von Sortieren (Reihenfolge) und Zuordnen (Gruppen), ohne Oberfläche (in Node testbar).

import { mischeOhneFixpunkte } from '../_gemeinsam/zufall.js';

/** Startreihenfolge: Kennungen gemischt, höchstens eine Karte schon am richtigen Platz. */
export function startreihe(karten, startwert) {
  return mischeOhneFixpunkte(karten.length, startwert, 1).map((i) => karten[i].id);
}

/** Verschiebt die Karte an Platz `von` um `schritt` Plätze (−1 hoch, +1 runter); liefert eine neue Reihe. */
export function verschiebe(reihe, von, schritt) {
  const nach = Math.min(reihe.length - 1, Math.max(0, von + schritt));
  if (nach === von) return [...reihe];
  const neu = [...reihe];
  const [karte] = neu.splice(von, 1);
  neu.splice(nach, 0, karte);
  return neu;
}

/** Setzt die Karte an einen neuen Platz (Ziehen und Ablegen). */
export function setze(reihe, von, nach) {
  return verschiebe(reihe, von, nach - von);
}

/** Je Platz: liegt die richtige Karte dort? richtig = Kennungen in der richtigen Reihenfolge. */
export const pruefeReihe = (reihe, richtig) => reihe.map((id, platz) => id === richtig[platz]);

/** Hilfe „eine Karte legen“: erster Platz mit falscher Karte; liefert [von, nach] oder null. */
export function naechsteKarte(reihe, richtig) {
  const nach = reihe.findIndex((id, platz) => id !== richtig[platz]);
  if (nach < 0) return null;
  return [reihe.indexOf(richtig[nach]), nach];
}

/**
 * Zuordnen: zuordnung = { kartenId: gruppenId | null }. Liefert je Karte richtig/falsch/offen
 * und ob alles stimmt.
 */
export function pruefeGruppen(zuordnung, karten) {
  const stand = {};
  let richtig = 0;
  let offen = 0;
  for (const karte of karten) {
    const gruppe = zuordnung[karte.id] ?? null;
    if (gruppe == null) { stand[karte.id] = 'offen'; offen += 1; }
    else if (gruppe === karte.gruppe) { stand[karte.id] = 'richtig'; richtig += 1; }
    else stand[karte.id] = 'falsch';
  }
  return { stand, richtig, offen, falsch: karten.length - richtig - offen, geloest: richtig === karten.length };
}

/** Hilfe beim Zuordnen: eine noch nicht richtig liegende Karte in ihre Gruppe legen. */
export function naechsteZuordnung(zuordnung, karten) {
  const karte = karten.find((k) => zuordnung[k.id] !== k.gruppe);
  return karte ? [karte.id, karte.gruppe] : null;
}
