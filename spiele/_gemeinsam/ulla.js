// Ulla Uhu: die Begleiterin durch die Spiele. Der Uhu brütet wirklich in den Felsen der Sächsischen Schweiz.
// Eigene Vektorzeichnung, CC BY-SA 4.0. Posen: gruesst, denkt, jubelt, staunt.
// Rein dekorativ: Was Ulla sagt, steht immer auch als Text daneben.

const TINTE = '#263238';
const FEDER = '#B8773D';
const FEDER_DUNKEL = '#91592B';
const BAUCH = '#F1D6A8';
const SCHEIBE = '#F7E6C6';
const SCHNABEL = '#E39A2D';
const SCHAL = '#1E7A4C';

// Linker Flügel (vom Betrachter aus), Schulter bei (36, 116); der rechte ist gespiegelt.
const FLUEGEL = 'M34 112 C16 132 18 170 46 184 C48 152 46 130 34 112 Z';

function fluegel(seite, drehung) {
  const spiegel = seite > 0 ? 'translate(200 0) scale(-1 1)' : '';
  const dreh = drehung ? `rotate(${drehung} 36 116)` : '';
  return `<g transform="${spiegel}"><path d="${FLUEGEL}" transform="${dreh}" fill="${FEDER_DUNKEL}" stroke="${TINTE}" stroke-width="4" stroke-linejoin="round"/></g>`;
}

// Drehung je Flügel und Pose; Flügel mit Drehung liegen vor dem Körper.
const FLUEGELHALTUNG = {
  gruesst: { links: 0, rechts: 170 },
  denkt: { links: 0, rechts: -92 },
  jubelt: { links: 170, rechts: 170 },
  staunt: { links: 0, rechts: 0 },
};

function augen(pose) {
  if (pose === 'jubelt') {
    return `<path d="M60 88 q14 -16 28 0 M112 88 q14 -16 28 0" fill="none" stroke="${TINTE}" stroke-width="5" stroke-linecap="round"/>`;
  }
  const dx = pose === 'denkt' ? 4 : 0;
  const dy = pose === 'denkt' ? -6 : 1;
  const iris = pose === 'staunt' ? 20 : 18;
  const pupille = pose === 'staunt' ? 7 : 9;
  return `
  <circle cx="74" cy="84" r="${iris}" fill="#F6B13A" stroke="${TINTE}" stroke-width="3"/>
  <circle cx="126" cy="84" r="${iris}" fill="#F6B13A" stroke="${TINTE}" stroke-width="3"/>
  <circle cx="${76 + dx}" cy="${85 + dy}" r="${pupille}" fill="${TINTE}"/>
  <circle cx="${124 + dx}" cy="${85 + dy}" r="${pupille}" fill="${TINTE}"/>
  <circle cx="${79 + dx}" cy="${80 + dy}" r="3.4" fill="#fff"/>
  <circle cx="${127 + dx}" cy="${80 + dy}" r="3.4" fill="#fff"/>`;
}

/** SVG-Markup von Ulla in einer Pose. Feste Zeichnung, keine Inhalte aus Daten. */
export function ullaSvg(pose = 'gruesst') {
  const haltung = FLUEGELHALTUNG[pose] ?? FLUEGELHALTUNG.gruesst;
  const hinten = [];
  const vorne = [];
  (haltung.links ? vorne : hinten).push(fluegel(-1, haltung.links));
  (haltung.rechts ? vorne : hinten).push(fluegel(1, haltung.rechts));
  const schnabel = pose === 'staunt'
    ? `<path d="M93 102 L107 102 L100 112 Z" fill="${SCHNABEL}" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="100" cy="119" rx="5" ry="6" fill="${TINTE}"/>`
    : `<path d="M92 102 L108 102 L100 118 Z" fill="${SCHNABEL}" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" width="200" height="220" aria-hidden="true" focusable="false">
  <ellipse cx="100" cy="210" rx="54" ry="7" fill="${TINTE}" opacity=".12"/>
  <path d="M60 56 L50 16 L88 42 Z" fill="${FEDER_DUNKEL}" stroke="${TINTE}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M140 56 L150 16 L112 42 Z" fill="${FEDER_DUNKEL}" stroke="${TINTE}" stroke-width="4" stroke-linejoin="round"/>
  ${hinten.join('')}
  <path d="M100 32 C150 32 170 72 170 122 C170 172 140 200 100 200 C60 200 30 172 30 122 C30 72 50 32 100 32 Z" fill="${FEDER}" stroke="${TINTE}" stroke-width="4"/>
  <path d="M100 100 C130 100 146 124 144 152 C142 180 124 194 100 194 C76 194 58 180 56 152 C54 124 70 100 100 100 Z" fill="${BAUCH}"/>
  <path d="M82 150 q6 6 12 0 M106 150 q6 6 12 0 M72 168 q6 6 12 0 M94 168 q6 6 12 0 M116 168 q6 6 12 0 M84 184 q6 6 12 0 M106 184 q6 6 12 0" fill="none" stroke="#CFA066" stroke-width="3" stroke-linecap="round"/>
  <circle cx="74" cy="84" r="30" fill="${SCHEIBE}"/>
  <circle cx="126" cy="84" r="30" fill="${SCHEIBE}"/>
  ${augen(pose)}
  <circle cx="74" cy="84" r="25" fill="none" stroke="${TINTE}" stroke-width="4"/>
  <circle cx="126" cy="84" r="25" fill="none" stroke="${TINTE}" stroke-width="4"/>
  <path d="M97 81 q3 -5 6 0" fill="none" stroke="${TINTE}" stroke-width="4" stroke-linecap="round"/>
  ${schnabel}
  <path d="M58 122 C82 134 118 134 142 122 L145 136 C118 149 82 149 55 136 Z" fill="${SCHAL}" stroke="${TINTE}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M118 140 L128 174 L111 171 Z" fill="${SCHAL}" stroke="${TINTE}" stroke-width="3.5" stroke-linejoin="round"/>
  ${vorne.join('')}
  <path d="M80 200 l-7 9 M87 201 v10 M94 200 l7 9 M106 200 l-7 9 M113 201 v10 M120 200 l7 9" stroke="${SCHNABEL}" stroke-width="5" stroke-linecap="round"/>
</svg>`;
}

/** Ulla als DOM-Element (span mit SVG), ohne innerHTML. */
export function ullaElement(pose = 'gruesst', klasse = '') {
  const huelle = document.createElement('span');
  huelle.className = `sp-ulla ${klasse}`.trim();
  huelle.setAttribute('aria-hidden', 'true');
  huelle.append(document.importNode(new DOMParser().parseFromString(ullaSvg(pose), 'image/svg+xml').documentElement, true));
  return huelle;
}
