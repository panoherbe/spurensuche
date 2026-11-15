// Eigene Zeichnungen der Spieler-Ansicht (CC BY-SA 4.0): Gruppenwappen (Tier, Wimpel), Stern, Stempel, Konfetti,
// Schmuck der Karte (Bäume, Berge, Windrose) und die Farbe je Ort. Alles feste SVG-Formen; aus Daten kommt nur,
// welches Wappen und welche Farbe gewählt wird. Die Zeichnungen sind Schmuck (aria-hidden): Was sie bedeuten,
// steht immer als Text daneben.

const TINTE = '#1b2340';
const SVG_KOPF = 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';

/** Festes SVG-Markup als Element (ohne innerHTML). */
function alsElement(markup, klasse) {
  const svg = document.importNode(new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement, true);
  if (klasse) svg.setAttribute('class', klasse);
  return svg;
}

// ── Farbe je Ort ────────────────────────────────────────────────────────────────────────────────────────────────
// Sechs Farben (basis.css, .ort-farbe-1 … -6). Ein Ort bekommt die Farbe nach seinem Platz in der Liste der Orte;
// sie gilt auf der Karte, am Ort, in seinen Aufgaben und bei seinen Sammelstücken.
export const ORT_FARBEN = 6;
export function ortFarbe(inhalte, ortId) {
  const i = inhalte.orte.findIndex((o) => o.id === ortId);
  return `ort-farbe-${((i < 0 ? 0 : i) % ORT_FARBEN) + 1}`;
}

// ── Stern und Stempel ───────────────────────────────────────────────────────────────────────────────────────────
const STERN = 'M50 6 L62.5 34.5 L93.5 37.5 L70 58 L77 88.5 L50 72.5 L23 88.5 L30 58 L6.5 37.5 L37.5 34.5 Z';

/** Gelber Stern mit Tintenrand. */
export function stern(klasse = 'stern') {
  return alsElement(`<svg ${SVG_KOPF} viewBox="0 0 100 100"><path d="${STERN}" fill="#ffd43b" stroke="${TINTE}" stroke-width="6" stroke-linejoin="round"/><path d="M40 40 L46 27" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/></svg>`, klasse);
}

/** Leerer Stern (noch nicht geschafft). */
export function sternLeer(klasse = 'stern leer') {
  return alsElement(`<svg ${SVG_KOPF} viewBox="0 0 100 100"><path d="${STERN}" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-dasharray="9 8"/></svg>`, klasse);
}

/** Runder Stempel „geschafft“: Zackenrand, Stern in der Mitte. */
export function stempel(klasse = 'stempel') {
  const zacken = Array.from({ length: 16 }, (_, i) => {
    const w = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 44 : 49;
    return `${(50 + Math.cos(w) * r).toFixed(1)} ${(50 + Math.sin(w) * r).toFixed(1)}`;
  }).join(' L');
  return alsElement(`<svg ${SVG_KOPF} viewBox="0 0 100 100"><path d="M${zacken} Z" fill="#ffd43b" stroke="${TINTE}" stroke-width="5" stroke-linejoin="round"/><circle cx="50" cy="50" r="33" fill="none" stroke="${TINTE}" stroke-width="3" stroke-dasharray="5 5"/><path d="${STERN}" transform="translate(22 21) scale(.56)" fill="#fff" stroke="${TINTE}" stroke-width="8" stroke-linejoin="round"/></svg>`, klasse);
}

/** Fähnchen für den Abschlussort. */
export function faehnchen(klasse = 'faehnchen') {
  return alsElement(`<svg ${SVG_KOPF} viewBox="0 0 100 100"><path d="M26 92 V10" stroke="${TINTE}" stroke-width="9" stroke-linecap="round"/><path d="M30 14 H86 L70 33 L86 52 H30 Z" fill="#ff5d5d" stroke="${TINTE}" stroke-width="6" stroke-linejoin="round"/></svg>`, klasse);
}

// ── Konfetti ────────────────────────────────────────────────────────────────────────────────────────────────────
const KONFETTI_FARBEN = ['#ffd43b', '#ff7fae', '#3fd0dd', '#ff9a3d', '#a78bfa', '#69db7c'];

/** Konfetti als Schmuck einer Feier. Die Bewegung macht das CSS, und nur, wenn Bewegung erlaubt ist. */
export function konfetti(anzahl = 22) {
  const feld = document.createElement('span');
  feld.className = 'konfetti';
  feld.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < anzahl; i++) {
    const teil = document.createElement('i');
    // feste Folge statt Zufall: gleiche Feier bei jedem Mal, auch im Prüflauf
    teil.style.setProperty('--k-x', `${Math.round(((i * 37) % 100))}%`);
    teil.style.setProperty('--k-zeit', `${(i % 7) * 90}ms`);
    teil.style.setProperty('--k-dreh', `${((i * 53) % 360) - 180}deg`);
    teil.style.setProperty('--k-farbe', KONFETTI_FARBEN[i % KONFETTI_FARBEN.length]);
    teil.style.setProperty('--k-weg', `${150 + ((i * 29) % 110)}px`);
    if (i % 3 === 0) teil.className = 'rund';
    feld.append(teil);
  }
  return feld;
}

// ── Gruppenwappen ───────────────────────────────────────────────────────────────────────────────────────────────
// Schulgruppen heißen nach Tieren, Farben oder Dingen (kern/namen.js). Für jedes Tier gibt es einen gezeichneten
// Kopf; alle anderen Namen bekommen einen Wimpel mit dem Anfangsbuchstaben.

const auge = (x, y, r = 3.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${TINTE}"/><circle cx="${x + 1.1}" cy="${y - 1.2}" r="${(r * 0.32).toFixed(1)}" fill="#fff"/>`;
const AUGEN = auge(40, 53) + auge(60, 53);
const MAUL = `<ellipse cx="50" cy="61.5" rx="4.2" ry="3.1" fill="${TINTE}"/><path d="M50 64 v3 M50 67 q-4 4.5 -8.5 1.5 M50 67 q4 4.5 8.5 1.5" fill="none" stroke="${TINTE}" stroke-width="2.4" stroke-linecap="round"/>`;
const kopf = (fell, rx = 27, ry = 24) => `<ellipse cx="50" cy="56" rx="${rx}" ry="${ry}" fill="${fell}" stroke="${TINTE}" stroke-width="3.5"/>`;
const ohrenRund = (fell, innen, r = 9, y = 35) => [29, 71].map((x) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fell}" stroke="${TINTE}" stroke-width="3.5"/><circle cx="${x}" cy="${y}" r="${(r * 0.45).toFixed(1)}" fill="${innen}"/>`).join('');
const ohrenSpitz = (fell, innen) => `<path d="M24 46 L26 17 L45 35 Z M76 46 L74 17 L55 35 Z" fill="${fell}" stroke="${TINTE}" stroke-width="3.5" stroke-linejoin="round"/><path d="M29 38 L30 26 L38 34 Z M71 38 L70 26 L62 34 Z" fill="${innen}"/>`;
const latz = (hell) => `<path d="M24.5 60 Q50 96 75.5 60 Q62 70 50 61 Q38 70 24.5 60 Z" fill="${hell}"/>`;
const bauch = (hell) => `<ellipse cx="50" cy="65" rx="15" ry="11" fill="${hell}"/>`;
const vogelkopf = (feder) => `<circle cx="50" cy="55" r="26" fill="${feder}" stroke="${TINTE}" stroke-width="3.5"/>`;
const vogelaugen = (ring = '#fff') => [40, 60].map((x) => `<circle cx="${x}" cy="50" r="7" fill="${ring}" stroke="${TINTE}" stroke-width="2.5"/><circle cx="${x}" cy="50.5" r="3.3" fill="${TINTE}"/><circle cx="${x + 1.2}" cy="49.2" r="1.1" fill="#fff"/>`).join('');
const schnabel = (d, farbe) => `<path d="${d}" fill="${farbe}" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/>`;

const TIERE = {
  biber: ['#ffd8a8', () => ohrenRund('#9c6b3c', '#6f4a26', 7.5, 37) + kopf('#9c6b3c') + bauch('#dcb888') + AUGEN + MAUL
    + `<path d="M45.5 67 h9 v8 h-9 Z M50 67 v8" fill="#fff" stroke="${TINTE}" stroke-width="2.2" stroke-linejoin="round"/>`],
  eule: ['#c8f0d2', () => `<path d="M30 40 L27 17 L46 33 Z M70 40 L73 17 L54 33 Z" fill="#8a5a2b" stroke="${TINTE}" stroke-width="3.5" stroke-linejoin="round"/>`
    + vogelkopf('#b8773d')
    + [39, 61].map((x) => `<circle cx="${x}" cy="51" r="12.5" fill="#f7e6c6" stroke="${TINTE}" stroke-width="3"/><circle cx="${x}" cy="51" r="7.5" fill="#f6b13a" stroke="${TINTE}" stroke-width="2"/><circle cx="${x}" cy="51.5" r="3.8" fill="${TINTE}"/><circle cx="${x + 1.4}" cy="50" r="1.3" fill="#fff"/>`).join('')
    + schnabel('M45.5 60 L54.5 60 L50 69 Z', '#e39a2d')
    + `<path d="M40 73 q5 5 10 0 M50 73 q5 5 10 0" fill="none" stroke="#8a5a2b" stroke-width="2.6" stroke-linecap="round"/>`],
  fuchs: ['#d0ebff', () => ohrenSpitz('#f08c2e', TINTE) + kopf('#f08c2e') + latz('#fff') + AUGEN + MAUL],
  luchs: ['#e5dbff', () => ohrenSpitz('#d9a45b', '#f7e7c6') + `<path d="M26 17 l-4 -9 M74 17 l4 -9" stroke="${TINTE}" stroke-width="4" stroke-linecap="round"/>`
    + `<path d="M24 58 l-9 7 l10 3 Z M76 58 l9 7 l-10 3 Z" fill="#f7e7c6" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/>`
    + kopf('#d9a45b') + bauch('#f7e7c6') + AUGEN + MAUL + `<circle cx="44" cy="40" r="1.8" fill="#8a5a2b"/><circle cx="50" cy="37" r="1.8" fill="#8a5a2b"/><circle cx="56" cy="40" r="1.8" fill="#8a5a2b"/>`],
  otter: ['#c5f6fa', () => ohrenRund('#7a5a43', '#5a3f2d', 6, 39) + kopf('#7a5a43', 26, 23) + bauch('#e6d2b8') + AUGEN + MAUL
    + `<path d="M33 63 h-12 M33 67 l-11 4 M67 63 h12 M67 67 l11 4" stroke="${TINTE}" stroke-width="1.8" stroke-linecap="round"/>`],
  dachs: ['#ffe3e3', () => ohrenRund('#2b2f3a', '#fff', 6.5, 37) + kopf('#f4f4ef')
    + `<path d="M35 35 Q30 54 37 74 L46 70 Q41 52 44 34 Z M65 35 Q70 54 63 74 L54 70 Q59 52 56 34 Z" fill="#2b2f3a"/>`
    + `<circle cx="40" cy="53" r="3.4" fill="#fff"/><circle cx="60" cy="53" r="3.4" fill="#fff"/><circle cx="40" cy="53" r="1.8" fill="${TINTE}"/><circle cx="60" cy="53" r="1.8" fill="${TINTE}"/>` + MAUL],
  falke: ['#fff3bf', () => vogelkopf('#6c7a89') + `<path d="M27 62 Q50 92 73 62 Q62 66 50 62 Q38 66 27 62 Z" fill="#f1ead8"/>`
    + `<path d="M37 57 q-1 10 4 13 M63 57 q1 10 -4 13" fill="none" stroke="${TINTE}" stroke-width="4" stroke-linecap="round"/>` + vogelaugen('#ffe066')
    + schnabel('M44 57 Q50 53 56 57 Q55 65 50 70 Q49 62 44 57 Z', '#f2b632')],
  igel: ['#d3f9d8', () => `<path d="M17 62 L19 46 L26 52 L27 34 L36 43 L40 24 L48 38 L54 22 L59 38 L68 26 L70 44 L79 36 L77 54 L84 50 L82 66 Z" fill="#6b4a2f" stroke="${TINTE}" stroke-width="3.5" stroke-linejoin="round"/>`
    + ohrenRund('#c9a27a', '#a57c52', 5.5, 43) + kopf('#e8cfa8', 23, 21) + AUGEN + MAUL],
  kranich: ['#ffe8cc', () => vogelkopf('#a5b0bd') + `<path d="M30 40 Q50 20 70 40 Q50 31 30 40 Z" fill="#e03131" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M26 60 Q34 52 44 60 M74 60 Q66 52 56 60" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>` + vogelaugen()
    + schnabel('M45 59 L55 59 L51 90 Z', '#d9b24c')],
  wiesel: ['#ffec99', () => ohrenRund('#b8763e', '#8a5226', 6, 38) + kopf('#b8763e', 23, 23) + latz('#fff') + AUGEN + MAUL],
  elster: ['#dbe4ff', () => vogelkopf('#2b2f3a') + `<path d="M28 66 Q50 90 72 66 Q60 60 50 62 Q40 60 28 66 Z" fill="#fff"/>` + vogelaugen()
    + schnabel('M45 58 L55 58 L50 71 Z', '#5c6370') + `<path d="M34 36 q6 -6 13 -5" fill="none" stroke="#4c6ef5" stroke-width="4" stroke-linecap="round"/>`],
  hirsch: ['#d8f5a2', () => `<path d="M38 36 C35 25 30 18 22 13 M33 24 l-9 3 M36 30 l3 -11 M62 36 C65 25 70 18 78 13 M67 24 l9 3 M64 30 l-3 -11" fill="none" stroke="#8a5a2b" stroke-width="4.5" stroke-linecap="round"/>`
    + `<path d="M22 44 l-8 -6 l12 -3 Z M78 44 l8 -6 l-12 -3 Z" fill="#b07a46" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/>`
    + kopf('#b07a46', 24, 24) + bauch('#e9d3b1') + AUGEN + MAUL],
  lerche: ['#ffd8e4', () => `<path d="M43 34 L46 14 L51 30 L56 17 L57 34 Z" fill="#8f7248" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/>`
    + vogelkopf('#b89765') + `<path d="M29 66 Q50 90 71 66 Q60 62 50 64 Q40 62 29 66 Z" fill="#f1e3c4"/>` + vogelaugen()
    + schnabel('M46 58 L54 58 L50 68 Z', '#c9a04a') + `<path d="M42 38 v4 M50 36 v4 M58 38 v4" stroke="#8f7248" stroke-width="2.4" stroke-linecap="round"/>`],
  specht: ['#c3fae8', () => vogelkopf('#f4f4ef') + `<path d="M28 42 Q50 16 72 42 Q50 34 28 42 Z" fill="#e03131" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M25 56 H38 M62 56 H75" stroke="${TINTE}" stroke-width="5" stroke-linecap="round"/>` + vogelaugen()
    + schnabel('M45.5 58 L54.5 58 L50 86 Z', '#8d95a3')],
  storch: ['#ffdeeb', () => vogelkopf('#fafaf5') + `<path d="M30 50 H36 M64 50 H70" stroke="${TINTE}" stroke-width="3.5" stroke-linecap="round"/>` + vogelaugen()
    + schnabel('M44.5 58 L55.5 58 L50 93 Z', '#f76707')],
  wolf: ['#e9ecef', () => ohrenSpitz('#8b93a1', '#e8ebef') + kopf('#8b93a1') + latz('#f1f3f5') + AUGEN + MAUL],
};

const WIMPEL_FARBEN = { rot: '#ff6b6b', orange: '#ff9a3d', gelb: '#ffd43b', 'grün': '#69db7c', 'türkis': '#3fd0dd', blau: '#6ea8ff', violett: '#a78bfa', silber: '#ced4da', gold: '#f5c542', bernstein: '#f0a93b' };
const WIMPEL_REIHE = ['#ff9a3d', '#3fd0dd', '#ff7fae', '#69db7c', '#a78bfa', '#6ea8ff', '#ffd43b'];

function wimpel(name) {
  const klein = name.toLocaleLowerCase('de');
  let summe = 0;
  for (const z of klein) summe = (summe * 31 + z.codePointAt(0)) % 9973;
  const farbe = WIMPEL_FARBEN[klein] ?? WIMPEL_REIHE[summe % WIMPEL_REIHE.length];
  const buchstabe = ([...name.replace(/^(die|der|das|team)\s+/i, '').trim()][0] ?? '?').toLocaleUpperCase('de').replace(/[<>&"']/g, '?');
  return ['#ffffff', () => `<path d="M24 90 V14" stroke="${TINTE}" stroke-width="6" stroke-linecap="round"/><path d="M27 17 H84 L72 38 L84 59 H27 Z" fill="${farbe}" stroke="${TINTE}" stroke-width="3.5" stroke-linejoin="round"/>`
    + `<text x="50" y="47" text-anchor="middle" font-family="Grandstander, sans-serif" font-weight="800" font-size="27" fill="${TINTE}">${buchstabe}</text>`];
}

/** Ist der Name ein Tier mit eigenem Wappen? */
export const istTier = (name) => Object.hasOwn(TIERE, String(name ?? '').trim().toLocaleLowerCase('de'));

/** Rundes Wappen zum Namen einer Gruppe oder eines Teams (Schmuck, der Name steht daneben). */
export function wappen(name, klasse = 'wappen') {
  const klein = String(name ?? '').trim().toLocaleLowerCase('de');
  const [grund, zeichne] = TIERE[klein] ?? wimpel(String(name ?? '?'));
  return alsElement(`<svg ${SVG_KOPF} viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="${grund}" stroke="${TINTE}" stroke-width="4"/>${zeichne()}</svg>`, klasse);
}

/** Einige Tierwappen nebeneinander (Startseite). */
export const BEISPIEL_TIERE = ['fuchs', 'eule', 'biber', 'igel', 'luchs'];

// ── Schmuck der Karte ───────────────────────────────────────────────────────────────────────────────────────────
// Koordinaten im Kartenbild (1000 × 792). Die Stellen liegen im Land, abseits der großen Städte.
const baum = (x, y, g = 1) => `<g transform="translate(${x} ${y}) scale(${g})"><path d="M0 0 v14" stroke="#7a4a21" stroke-width="5" stroke-linecap="round"/><path d="M0 -30 L13 -6 H5 L15 8 H-15 L-5 -6 H-13 Z" fill="#2f9e44" stroke="${TINTE}" stroke-width="2.6" stroke-linejoin="round"/></g>`;
const laubbaum = (x, y, g = 1) => `<g transform="translate(${x} ${y}) scale(${g})"><path d="M0 2 v14" stroke="#7a4a21" stroke-width="5" stroke-linecap="round"/><path d="M-13 -4 a9 9 0 0 1 6 -14 a10 10 0 0 1 17 2 a9 9 0 0 1 3 15 a9 9 0 0 1 -11 6 a10 10 0 0 1 -15 -9 Z" fill="#51cf66" stroke="${TINTE}" stroke-width="2.6" stroke-linejoin="round"/></g>`;
const berg = (x, y, g = 1) => `<g transform="translate(${x} ${y}) scale(${g})"><path d="M-30 14 L-6 -24 L6 -8 L14 -18 L34 14 Z" fill="#b5c0cf" stroke="${TINTE}" stroke-width="2.8" stroke-linejoin="round"/><path d="M-13.5 -12 L-6 -24 L1.5 -14 L-3 -9 L-7 -13 Z" fill="#fff" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/></g>`;
const fels = (x, y, g = 1) => `<g transform="translate(${x} ${y}) scale(${g})"><path d="M-14 12 L-12 -14 L-4 -18 L-2 -6 L4 -22 L12 -18 L14 12 Z" fill="#f2c078" stroke="${TINTE}" stroke-width="2.6" stroke-linejoin="round"/><path d="M-6 0 v8 M7 -8 v10" stroke="${TINTE}" stroke-width="1.8" stroke-linecap="round" opacity=".5"/></g>`;

/** Bäume, Berge und Felsen im Land, Windrose in der Ecke: als <g> für das Kartenbild. */
export function kartenSchmuck() {
  const teile = [
    berg(318, 590, 1.05), berg(388, 566, 0.9), berg(452, 526, 1), berg(528, 492, 0.85),
    fels(668, 440, 0.95), fels(706, 420, 0.8), fels(850, 352, 0.85),
    baum(262, 296, 0.95), baum(292, 318, 0.75), baum(430, 196, 0.9), baum(640, 222, 0.95), baum(668, 244, 0.75),
    baum(858, 196, 0.9), baum(884, 222, 0.7), baum(180, 520, 0.85),
    laubbaum(128, 286, 0.9), laubbaum(300, 150, 0.85), laubbaum(560, 150, 0.9), laubbaum(420, 330, 0.85), laubbaum(806, 150, 0.8),
  ];
  const rose = `<g transform="translate(905 668)"><circle r="46" fill="#fff" stroke="${TINTE}" stroke-width="3.5"/><path d="M0 -38 L9 -9 L38 0 L9 9 L0 38 L-9 9 L-38 0 L-9 -9 Z" fill="#ffd43b" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/><path d="M0 -38 L9 -9 L0 0 Z M0 38 L-9 9 L0 0 Z" fill="#ff7fae" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/><circle r="4" fill="${TINTE}"/><text y="-52" text-anchor="middle" font-family="Grandstander, sans-serif" font-weight="800" font-size="26" fill="${TINTE}">N</text></g>`;
  return alsElement(`<svg ${SVG_KOPF}><g class="karte-schmuck">${teile.join('')}${rose}</g></svg>`).firstElementChild;
}

/** Zwei Wolken und eine Sonne für die Bühne der Startseite. */
export function himmel(klasse = 'himmel') {
  const wolke = (x, y, g) => `<g transform="translate(${x} ${y}) scale(${g})"><path d="M-44 14 a17 17 0 0 1 5 -33 a24 24 0 0 1 45 -6 a19 19 0 0 1 30 14 a14 14 0 0 1 -4 25 Z" fill="#fff" stroke="${TINTE}" stroke-width="3.5" stroke-linejoin="round"/></g>`;
  return alsElement(`<svg ${SVG_KOPF} viewBox="0 0 600 200" preserveAspectRatio="xMaxYMin meet"><g transform="translate(520 62)"><path d="M0 -58 v-16 M41 -41 l11 -11 M58 0 h16 M41 41 l11 11 M-41 -41 l-11 -11 M-58 0 h-16 M-41 41 l-11 11" stroke="${TINTE}" stroke-width="6" stroke-linecap="round"/><circle r="40" fill="#ffd43b" stroke="${TINTE}" stroke-width="4"/></g>${wolke(372, 138, 0.9)}${wolke(250, 44, 0.6)}</svg>`, klasse);
}
