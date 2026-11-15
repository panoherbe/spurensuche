// Sachsen-Karte: SVG aus offenen Daten (karte-daten.js, Natural Earth, gemeinfrei) und darüber Knöpfe für die
// Orte. Die Karte selbst ist Schmuck (aria-hidden); bedient wird über die Knöpfe, und die Liste darunter nennt
// dieselben Orte noch einmal.

import { KARTE, projiziere } from './karte-daten.js';
import { h, s, symbol } from './ui.js';

const STATUS_TEXT = { offen: 'noch offen', begonnen: 'begonnen', abgeschlossen: 'geschafft', abgebrochen: 'unterbrochen' };
const GROSSE_STAEDTE = new Set(['Leipzig', 'Dresden', 'Chemnitz']);

/**
 * `eintraege`: [{ ort, status, nummer, finale }]; `beiWahl(ortId)` beim Antippen.
 * Liefert ein <figure>-Element.
 */
export function zeichneKarte(eintraege, beiWahl, { titel = 'Karte von Sachsen' } = {}) {
  const svg = s('svg', { viewBox: `0 0 ${KARTE.breite} ${KARTE.hoehe}`, 'aria-hidden': 'true', focusable: 'false', class: 'karte-svg', preserveAspectRatio: 'xMidYMid meet' },
    s('rect', { class: 'karte-grund', x: 0, y: 0, width: KARTE.breite, height: KARTE.hoehe }),
    s('g', { class: 'karte-nachbarn' }, KARTE.nachbarn.map((n) => s('path', { d: n.d }))),
    s('path', { class: 'karte-sachsen', d: KARTE.sachsen }),
    s('g', { class: 'karte-fluesse' }, KARTE.fluesse.map((f) => s('path', { d: f.d }))),
    s('g', { class: 'karte-staedte' }, KARTE.staedte.map((st) => s('circle', { cx: st.x, cy: st.y, r: GROSSE_STAEDTE.has(st.name) ? 6 : 4 }))),
  );

  const flaeche = h('div', { class: 'karte-flaeche' }, svg);
  for (const st of KARTE.staedte) {
    flaeche.append(h('span', { class: `karte-stadt${GROSSE_STAEDTE.has(st.name) ? ' gross' : ''}`, 'aria-hidden': 'true', stil: { left: `${(st.x / KARTE.breite) * 100}%`, top: `${(st.y / KARTE.hoehe) * 100}%` } }, st.name));
  }
  for (const e of eintraege) {
    const [x, y] = projiziere(e.ort.lage.lat, e.ort.lage.lon);
    const status = e.status ?? 'offen';
    const knopfInhalt = status === 'abgeschlossen' ? symbol('haken', { klasse: 'marker-symbol' }) : e.finale ? symbol('stern', { klasse: 'marker-symbol' }) : h('span', { class: 'marker-zahl' }, String(e.nummer));
    flaeche.append(h('button', {
      type: 'button', class: `karte-marker status-${status}${e.finale ? ' finale' : ''}`,
      stil: { left: `${(x / KARTE.breite) * 100}%`, top: `${(y / KARTE.hoehe) * 100}%` },
      'aria-label': `${e.ort.name}, ${e.ort.region}${e.finale ? ', Abschluss' : ''}: ${STATUS_TEXT[status] ?? status}`,
      onclick: () => beiWahl(e.ort.id),
    }, h('span', { class: 'marker-punkt' }, knopfInhalt), h('span', { class: 'marker-name', 'aria-hidden': 'true' }, e.ort.name)));
  }
  return h('figure', { class: 'karte-rahmen' },
    h('div', { class: 'nur-vorlesbar' }, `${titel} mit ${eintraege.length} Orten. Die Orte stehen auch in der Liste unter der Karte.`),
    flaeche,
    h('figcaption', { class: 'karte-quelle' }, KARTE.quelle.replace('Kartengrundlage: ', 'Karte: ')));
}

export { STATUS_TEXT };
