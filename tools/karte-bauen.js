#!/usr/bin/env node
// Baut die Sachsen-Karte (app/js/karte-daten.js) aus offenen Daten von Natural Earth (gemeinfrei):
// Umriss Sachsens, Nachbarregionen zur Orientierung, große Flüsse. Ergebnis sind SVG-Pfade ohne
// Laufzeitabhängigkeit; die Karte braucht damit kein Netz und keine Kachel-Server.
//
// Aufruf: node tools/karte-bauen.js <ne_10m_admin_1_states_provinces.geojson> <ne_10m_rivers_lake_centerlines.geojson>
//         [<ne_10m_rivers_europe.geojson>] > app/js/karte-daten.js

import { readFileSync } from 'node:fs';

const [admin1, fluesse1, fluesse2] = process.argv.slice(2);
if (!admin1 || !fluesse1) { console.error('Aufruf: karte-bauen.js admin1.geojson fluesse.geojson [fluesse-europa.geojson]'); process.exit(2); }

const BREITE = 1000;
const RAND = 0.12; // Grad Rand um Sachsen
const lat0 = 50.93;
const lon0 = 13.46;
const kos = Math.cos((lat0 * Math.PI) / 180);

const laden = (p) => JSON.parse(readFileSync(p, 'utf8'));
const land = laden(admin1);
const sachsen = land.features.find((f) => f.properties.iso_3166_2 === 'DE-SN');
if (!sachsen) throw new Error('DE-SN nicht gefunden');

function ringe(geom) {
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  return [];
}
function linien(geom) {
  if (geom.type === 'LineString') return [geom.coordinates];
  if (geom.type === 'MultiLineString') return geom.coordinates;
  return [];
}

// Begrenzung: Sachsen plus Rand
let [minLon, minLat, maxLon, maxLat] = [180, 90, -180, -90];
for (const r of ringe(sachsen.geometry)) for (const [lo, la] of r) {
  minLon = Math.min(minLon, lo); maxLon = Math.max(maxLon, lo); minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
}
minLon -= RAND / kos; maxLon += RAND / kos; minLat -= RAND; maxLat += RAND;

const skala = BREITE / ((maxLon - minLon) * kos);
const HOEHE = Math.round((maxLat - minLat) * skala);
const projiziere = (lon, lat) => [((lon - minLon) * kos) * skala, (maxLat - lat) * skala];

function douglasPeucker(punkte, toleranz) {
  if (punkte.length < 3) return punkte;
  const [ax, ay] = punkte[0];
  const [bx, by] = punkte[punkte.length - 1];
  let max = 0;
  let index = 0;
  const dx = bx - ax;
  const dy = by - ay;
  const laenge = Math.hypot(dx, dy);
  for (let i = 1; i < punkte.length - 1; i++) {
    const [px, py] = punkte[i];
    // geschlossener Ring (Anfang = Ende): Abstand zum Anfangspunkt, sonst Abstand zur Strecke
    const d = laenge < 1e-6 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / laenge;
    if (d > max) { max = d; index = i; }
  }
  if (max <= toleranz) return [punkte[0], punkte[punkte.length - 1]];
  return [...douglasPeucker(punkte.slice(0, index + 1), toleranz).slice(0, -1), ...douglasPeucker(punkte.slice(index), toleranz)];
}

// Polygon an einem Rechteck zuschneiden (Sutherland-Hodgman), damit ferne Teile der Nachbarn wegfallen
function zuschneiden(punkte, [x0, y0, x1, y1]) {
  const kanten = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let aus = punkte;
  for (const [innen, schnitt] of kanten) {
    const ein = aus;
    aus = [];
    for (let i = 0; i < ein.length; i++) {
      const a = ein[(i + ein.length - 1) % ein.length];
      const b = ein[i];
      if (innen(b)) { if (!innen(a)) aus.push(schnitt(a, b)); aus.push(b); } else if (innen(a)) aus.push(schnitt(a, b));
    }
    if (!aus.length) break;
  }
  return aus;
}

const zahl = (n) => (Math.round(n * 10) / 10).toString();
function pfad(liste, { geschlossen, toleranz = 0.7, schneiden = false }) {
  return liste.map((punkte) => {
    let projiziert = punkte.map(([lo, la]) => projiziere(lo, la));
    if (schneiden) projiziert = zuschneiden(projiziert, [-15, -15, BREITE + 15, HOEHE + 15]);
    if (projiziert.length && geschlossen) projiziert.push(projiziert[0]);
    const p = douglasPeucker(projiziert, toleranz);
    if (p.length < (geschlossen ? 3 : 2)) return '';
    return `M${p.map(([x, y]) => `${zahl(x)} ${zahl(y)}`).join('L')}${geschlossen ? 'Z' : ''}`;
  }).join('');
}

const imRahmen = (lo, la) => lo >= minLon - 1 && lo <= maxLon + 1 && la >= minLat - 1 && la <= maxLat + 1;
const nachbarn = land.features.filter((f) => f !== sachsen && ringe(f.geometry).some((r) => r.some(([lo, la]) => imRahmen(lo, la))));

const FLUESSE = new Set(['Elbe', 'Mulde', 'Zwickauer Mulde', 'Freiberger Mulde', 'Spree', 'Neisse', 'Neiße', 'Lausitzer Neiße', 'Weiße Elster', 'Weisse Elster', 'Saale']);
const flussLinien = new Map();
for (const datei of [fluesse1, fluesse2].filter(Boolean)) {
  for (const f of laden(datei).features) {
    const name = f.properties.name_de || f.properties.name;
    if (!FLUESSE.has(name)) continue;
    const teile = linien(f.geometry).map((l) => l.filter(([lo, la]) => imRahmen(lo, la))).filter((l) => l.length > 1);
    if (!teile.length) continue;
    flussLinien.set(name, [...(flussLinien.get(name) ?? []), ...teile]);
  }
}

// Orientierungspunkte: Lage der großen Städte (Fakten, eigene Liste)
const STAEDTE = [
  ['Leipzig', 51.3397, 12.3731], ['Dresden', 51.0504, 13.7373], ['Chemnitz', 50.8278, 12.9214], ['Zwickau', 50.7189, 12.4964],
  ['Plauen', 50.4974, 12.1374], ['Görlitz', 51.1528, 14.9874], ['Bautzen', 51.1814, 14.4240], ['Meißen', 51.1636, 13.4775],
  ['Freiberg', 50.9119, 13.3428], ['Torgau', 51.5603, 13.0059], ['Hoyerswerda', 51.4389, 14.2440],
];

const daten = {
  breite: BREITE,
  hoehe: HOEHE,
  begrenzung: { minLon: Number(minLon.toFixed(5)), minLat: Number(minLat.toFixed(5)), maxLon: Number(maxLon.toFixed(5)), maxLat: Number(maxLat.toFixed(5)) },
  kos: Number(kos.toFixed(8)),
  skala: Number(skala.toFixed(6)),
  sachsen: pfad(ringe(sachsen.geometry), { geschlossen: true }),
  nachbarn: nachbarn.map((f) => ({ name: f.properties.name_de || f.properties.name, d: pfad(ringe(f.geometry), { geschlossen: true, toleranz: 1.2, schneiden: true }) })).filter((n) => n.d),
  fluesse: [...flussLinien].map(([name, teile]) => ({ name, d: pfad(teile, { geschlossen: false }) })).filter((f) => f.d),
  staedte: STAEDTE.map(([name, la, lo]) => { const [x, y] = projiziere(lo, la); return { name, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) }; }),
  quelle: 'Kartengrundlage: Natural Earth (gemeinfrei), naturalearthdata.com, Version 5.1.2',
};

process.stdout.write(`// Erzeugt mit tools/karte-bauen.js aus Natural Earth 5.1.2 (gemeinfrei). Nicht von Hand ändern.
export const KARTE = ${JSON.stringify(daten)};

/** Rechnet geografische Koordinaten (WGS 84) in Kartenkoordinaten um. */
export function projiziere(lat, lon) {
  const b = KARTE.begrenzung;
  return [((lon - b.minLon) * KARTE.kos) * KARTE.skala, (b.maxLat - lat) * KARTE.skala];
}
`);
console.error(`Karte ${BREITE} × ${HOEHE}: Sachsen ${daten.sachsen.length} Zeichen, ${daten.nachbarn.length} Nachbarn, Flüsse: ${daten.fluesse.map((f) => f.name).join(', ')}`);
