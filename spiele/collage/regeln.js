// Regeln der Item-Collage, ohne Zeichnen (in Node testbar): Wo liegt welches Sammelstück, wie groß, wie gedreht.
// Gleiche Sammelstücke und gleiche Einstellungen ergeben immer dieselbe Anordnung (kein Zufall ohne Startwert).
// Alle Maße relativ zur Kantenlänge (0–1), damit Vorschau und 2048-px-Bild gleich aussehen.

import { zufallsquelle, hash } from '../_gemeinsam/zufall.js';

export const REGLER = [
  {
    id: 'anordnung', name: 'Anordnung',
    werte: [{ id: 'kreis', name: 'Kreis' }, { id: 'raster', name: 'Raster' }, { id: 'wirbel', name: 'Wirbel' }, { id: 'stapel', name: 'Stapel' }],
  },
  {
    id: 'groesse', name: 'Größe',
    werte: [{ id: 'klein', name: 'klein' }, { id: 'mittel', name: 'mittel' }, { id: 'gross', name: 'groß' }],
  },
  {
    id: 'farbstimmung', name: 'Farbstimmung',
    werte: [{ id: 'morgen', name: 'Morgen' }, { id: 'sommer', name: 'Sommertag' }, { id: 'abend', name: 'Abendrot' }, { id: 'nacht', name: 'Sternennacht' }, { id: 'sandstein', name: 'Sandstein' }],
  },
];

export const STANDARD = { anordnung: 'kreis', groesse: 'mittel', farbstimmung: 'sommer' };
const GROESSE = { klein: 0.8, mittel: 1, gross: 1.2 };
const RAND = 0.075; // innerer Rand des Bildes (Rahmen)

/** Einstellungen prüfen und mit Voreinstellungen auffüllen; unbekannte Werte werden zur Voreinstellung. */
export function einstellungen(optionen = {}) {
  const ergebnis = {};
  for (const regler of REGLER) {
    const wert = optionen[regler.id];
    ergebnis[regler.id] = regler.werte.some((w) => w.id === wert) ? wert : STANDARD[regler.id];
  }
  return ergebnis;
}

/** Grundgröße eines Stickers (Durchmesser relativ zur Kantenlänge) je nach Anzahl. */
function grundgroesse(anzahl) {
  if (anzahl <= 1) return 0.5;
  if (anzahl === 2) return 0.38;
  if (anzahl <= 4) return 0.3;
  if (anzahl <= 6) return 0.25;
  if (anzahl <= 9) return 0.21;
  return 0.18;
}

/**
 * Anordnung der Sammelstücke. ids: Kennungen in Auswahlreihenfolge. Liefert
 * [{ id, x, y, groesse, drehung }] in Zeichenreihenfolge (hinten zuerst); x, y = Mittelpunkt (0–1), groesse = Durchmesser.
 */
export function anordnen(ids, optionen = {}) {
  const o = einstellungen(optionen);
  const n = ids.length;
  const faktor = GROESSE[o.groesse];
  const zufall = zufallsquelle(hash(`${ids.join('|')}|${o.anordnung}|${o.groesse}`));
  const drehungFuer = (id, staerke) => ((hash(id) % 1000) / 1000 - 0.5) * 2 * staerke;
  const innen = 1 - 2 * RAND;
  let plaetze;

  if (o.anordnung === 'raster') {
    const spalten = Math.ceil(Math.sqrt(n));
    const zeilen = Math.ceil(n / spalten);
    const zelle = innen / Math.max(spalten, zeilen);
    const g = Math.min(zelle * 0.86, grundgroesse(n) * 1.25) * faktor;
    plaetze = ids.map((id, i) => {
      const zeile = Math.floor(i / spalten);
      const inZeile = zeile === zeilen - 1 ? n - zeile * spalten : spalten;
      const spalte = i % spalten;
      const versatz = (spalten - inZeile) / 2;
      return { id, x: 0.5 + (spalte + versatz - (spalten - 1) / 2) * zelle, y: 0.5 + (zeile - (zeilen - 1) / 2) * zelle, groesse: Math.min(g, zelle * 0.95), drehung: 0 };
    });
  } else if (o.anordnung === 'wirbel') {
    const winkel = Math.PI * (3 - Math.sqrt(5)); // goldener Winkel
    const g = grundgroesse(n) * faktor;
    plaetze = ids.map((id, i) => {
      const r = n === 1 ? 0 : 0.36 * Math.sqrt((i + 0.6) / n);
      return { id, x: 0.5 + r * Math.cos(i * winkel), y: 0.5 + r * Math.sin(i * winkel), groesse: g * (1.12 - 0.3 * (i / Math.max(1, n - 1))), drehung: drehungFuer(id, 10) };
    }).reverse(); // die ersten (größten) liegen oben
  } else if (o.anordnung === 'stapel') {
    const g = grundgroesse(n) * faktor * 1.08;
    const roh = ids.map((id, i) => {
      const a = zufall() * Math.PI * 2;
      const r = Math.sqrt(zufall()) * Math.min(0.3, 0.07 + 0.035 * n);
      return { id, x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a), groesse: g, drehung: drehungFuer(id, 18) + (i % 2 ? 6 : -6) };
    });
    // Stapel in die Bildmitte rücken
    const mx = roh.reduce((s, p) => s + p.x, 0) / n - 0.5;
    const my = roh.reduce((s, p) => s + p.y, 0) / n - 0.5;
    plaetze = roh.map((p) => ({ ...p, x: p.x - mx, y: p.y - my }));
  } else {
    // Kreis: gleichmäßig auf einem Ring, bei mehr als sechs mit einem Stück in der Mitte
    const g = grundgroesse(n) * faktor;
    const mitte = n >= 7 ? 1 : 0;
    const ring = n - mitte;
    const radius = n === 1 ? 0 : Math.min(0.33, 0.12 + 0.028 * ring);
    plaetze = ids.map((id, i) => {
      if (mitte && i === 0) return { id, x: 0.5, y: 0.5, groesse: g * 1.15, drehung: 0 };
      const k = i - mitte;
      const a = -Math.PI / 2 + (k / ring) * Math.PI * 2;
      return { id, x: 0.5 + radius * Math.cos(a), y: 0.5 + radius * Math.sin(a), groesse: g, drehung: drehungFuer(id, 8) };
    });
  }

  // Im Bild halten: Kein Sticker ragt über den Rahmen.
  return plaetze.map((p) => {
    const halb = p.groesse / 2;
    return { ...p, x: Math.min(1 - RAND - halb, Math.max(RAND + halb, p.x)), y: Math.min(1 - RAND - halb, Math.max(RAND + halb, p.y)) };
  });
}

/** Farbstimmungen: Verlauf von oben nach unten und Farbe des Musters. */
export const STIMMUNGEN = {
  morgen: { verlauf: ['#FFE3C2', '#FFF4E4', '#CBE7F7'], muster: 'wolken', musterFarbe: 'rgba(255,255,255,0.75)', rahmen: '#FFFFFF' },
  sommer: { verlauf: ['#7FC6F2', '#BFE3F8', '#EAF6FD'], muster: 'sonne', musterFarbe: '#FFD34D', rahmen: '#FFFFFF' },
  abend: { verlauf: ['#3A3F8F', '#C8607A', '#FFC27A'], muster: 'huegel', musterFarbe: 'rgba(40,30,70,0.55)', rahmen: '#FFF4E8' },
  nacht: { verlauf: ['#0D1736', '#1C2D5E', '#33497F'], muster: 'sterne', musterFarbe: '#FFF6C8', rahmen: '#F2F4FA' },
  sandstein: { verlauf: ['#F6E7C9', '#EBD3A7', '#DDBE8A'], muster: 'schichten', musterFarbe: 'rgba(150,110,60,0.22)', rahmen: '#FFFBF2' },
};
