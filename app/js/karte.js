// Entdeckerkarte von Sachsen: SVG aus offenen Daten (karte-daten.js, Natural Earth, gemeinfrei), darauf gezeichnet
// Bäume, Berge, Felsen und ein gepunkteter Weg von Ort zu Ort; darüber große runde Marken mit dem Bild des Orts.
// Die Karte selbst ist Schmuck (aria-hidden); bedient wird über die Marken, und die Liste darunter nennt dieselben
// Orte noch einmal. Der Weg ist nur ein Vorschlag: Jeder Ort lässt sich jederzeit antippen.

import { KARTE, projiziere } from './karte-daten.js';
import { h, s } from './ui.js';
import { url } from './inhalte.js';
import { kartenSchmuck, stempel, faehnchen } from './zeichnungen.js';

const STATUS_TEXT = { offen: 'noch offen', begonnen: 'begonnen', abgeschlossen: 'geschafft', abgebrochen: 'unterbrochen' };
const GROSSE_STAEDTE = new Set(['Leipzig', 'Dresden', 'Chemnitz']);

/** Reihenfolge des gezeichneten Wegs: im Westen beginnen, immer zum nächsten Ort, der Abschlussort zuletzt. */
function wegFolge(punkte) {
  const offen = punkte.filter((p) => !p.finale);
  const ziel = punkte.filter((p) => p.finale);
  const folge = [];
  let jetzt = offen.reduce((a, b) => (a && a.x <= b.x ? a : b), null);
  while (jetzt) {
    folge.push(jetzt);
    offen.splice(offen.indexOf(jetzt), 1);
    const von = jetzt;
    jetzt = offen.reduce((a, b) => (a && Math.hypot(a.x - von.x, a.y - von.y) <= Math.hypot(b.x - von.x, b.y - von.y) ? a : b), null);
  }
  return [...folge, ...ziel];
}

/** Geschwungener Weg durch die Punkte (abwechselnd nach links und rechts ausgebaucht). */
function wegPfad(folge) {
  if (folge.length < 2) return '';
  let d = `M${folge[0].x.toFixed(1)} ${folge[0].y.toFixed(1)}`;
  for (let i = 1; i < folge.length; i++) {
    const a = folge[i - 1];
    const b = folge[i];
    const lang = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const bauch = (i % 2 ? 1 : -1) * Math.min(70, lang * 0.22);
    const mx = (a.x + b.x) / 2 - ((b.y - a.y) / lang) * bauch;
    const my = (a.y + b.y) / 2 + ((b.x - a.x) / lang) * bauch;
    d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

/**
 * `eintraege`: [{ ort, status, nummer, finale, fertig, aufgaben, farbe }]; `beiWahl(ortId)` beim Antippen.
 * Liefert ein <figure>-Element.
 */
export function zeichneKarte(eintraege, beiWahl, { titel = 'Karte von Sachsen' } = {}) {
  const punkte = eintraege.map((e) => {
    const [x, y] = projiziere(e.ort.lage.lat, e.ort.lage.lon);
    return { ...e, x, y };
  });
  const weg = wegPfad(wegFolge(punkte));
  const svg = s('svg', { viewBox: `0 0 ${KARTE.breite} ${KARTE.hoehe}`, 'aria-hidden': 'true', focusable: 'false', class: 'karte-svg', preserveAspectRatio: 'xMidYMid meet' },
    s('rect', { class: 'karte-grund', x: 0, y: 0, width: KARTE.breite, height: KARTE.hoehe }),
    s('g', { class: 'karte-nachbarn' }, KARTE.nachbarn.map((n) => s('path', { d: n.d }))),
    s('path', { class: 'karte-sachsen-schatten', d: KARTE.sachsen, transform: 'translate(0 9)' }),
    s('path', { class: 'karte-sachsen', d: KARTE.sachsen }),
    s('g', { class: 'karte-fluesse' }, KARTE.fluesse.map((f) => s('path', { d: f.d }))),
    kartenSchmuck(),
    s('g', { class: 'karte-staedte' }, KARTE.staedte.map((st) => s('circle', { cx: st.x, cy: st.y, r: GROSSE_STAEDTE.has(st.name) ? 6 : 4 }))),
    weg ? s('path', { class: 'karte-weg-grund', d: weg }) : null,
    weg ? s('path', { class: 'karte-weg', d: weg }) : null,
  );

  const flaeche = h('div', { class: 'karte-flaeche' }, svg);
  for (const st of KARTE.staedte) {
    flaeche.append(h('span', { class: `karte-stadt${GROSSE_STAEDTE.has(st.name) ? ' gross' : ''}`, 'aria-hidden': 'true', stil: { left: `${(st.x / KARTE.breite) * 100}%`, top: `${(st.y / KARTE.hoehe) * 100}%` } }, st.name));
  }
  for (const p of punkte) {
    const status = p.status ?? 'offen';
    // Liegt ein anderer Ort dicht darunter, steht der Name über der Marke statt darunter.
    const oben = punkte.some((q) => q !== p && Math.abs(q.x - p.x) < 170 && q.y > p.y && q.y - p.y < 110);
    const anzahl = p.aufgaben?.length ?? 0;
    flaeche.append(h('button', {
      type: 'button', class: `karte-marker status-${status}${p.finale ? ' finale' : ''} ${p.farbe ?? ''}`.trim(),
      stil: { left: `${(p.x / KARTE.breite) * 100}%`, top: `${(p.y / KARTE.hoehe) * 100}%` },
      'aria-label': `${p.ort.name}, ${p.ort.region}${p.finale ? ', Abschluss' : ''}: ${STATUS_TEXT[status] ?? status}`,
      onclick: () => beiWahl(p.ort.id),
    },
    h('span', { class: 'marker-punkt' }, p.ort.bild ? h('img', { src: url(p.ort.bild), alt: '', loading: 'lazy' }) : null),
    status === 'abgeschlossen' ? stempel('marker-stempel') : p.finale ? faehnchen('marker-ziel') : null,
    status !== 'abgeschlossen' && p.fertig > 0 && anzahl ? h('span', { class: 'marker-teil', 'aria-hidden': 'true' }, `${p.fertig}/${anzahl}`) : null,
    h('span', { class: `marker-name${oben ? ' oben' : ''}`, 'aria-hidden': 'true' }, p.ort.name)));
  }
  return h('figure', { class: 'karte-rahmen' },
    h('div', { class: 'nur-vorlesbar' }, `${titel} mit ${eintraege.length} Orten. Die Orte stehen auch in der Liste unter der Karte.`),
    flaeche,
    h('figcaption', { class: 'karte-quelle' }, KARTE.quelle.replace('Kartengrundlage: ', 'Karte: '), ' · Bäume, Berge und Weg: gezeichnet'));
}

export { STATUS_TEXT };
