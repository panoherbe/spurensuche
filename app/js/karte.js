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
// Liegen zwei Orte dichter als MIN_ABSTAND (Karteneinheiten, die Karte ist 1000 breit), würden sich ihre runden Marken
// auf einem Tablet überdecken (Frauenkirche und Bastei: 102). Dann rückt eine Marke ein Stück weg, höchstens
// MAX_RUECKEN; nur die Anzeige, die Lage im Inhalt bleibt.
const MIN_ABSTAND = 140;
const MAX_RUECKEN = 40;

/** Marken auseinanderrücken: Es bewegt sich nie der Abschlussort, sonst der spätere Ort der Liste. */
function auseinander(punkte) {
  for (let i = 0; i < punkte.length; i++) {
    for (let j = 0; j < punkte.length; j++) {
      const p = punkte[i];
      const q = punkte[j];
      if (p === q || p.finale || (!q.finale && j > i)) continue;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const d = Math.hypot(dx, dy);
      if (!d || d >= MIN_ABSTAND) continue;
      const weg = Math.min(MIN_ABSTAND - d, MAX_RUECKEN);
      p.x += (dx / d) * weg;
      p.y += (dy / d) * weg;
    }
  }
  return punkte;
}

/** Berührt das Rechteck `r` das runde Bild in `k` (Rechteck des Kreises, dazu 3 px Umriss)? */
function ueberKreis(r, k) {
  const cx = (k.left + k.right) / 2;
  const cy = (k.top + k.bottom) / 2;
  const nx = Math.max(r.left, Math.min(cx, r.right));
  const ny = Math.max(r.top, Math.min(cy, r.bottom));
  return Math.hypot(nx - cx, ny - cy) < k.width / 2 + 3;
}

/**
 * Namensschild über dem Bild einer anderen Marke: zur Seite schieben, auf der es weniger weit muss; ein Stempel dort:
 * auf die andere Seite der eigenen Marke. Danach Stadtnamen, die eine Ortsmarke (Bild, Name, Stempel, Zähler)
 * verdecken würde oder die über den Kartenrand ragen: erst links vom Punkt versuchen, sonst ausblenden. Hängt von der
 * Größe der Karte ab, darum bei jeder Größenänderung neu.
 */
function stadtnamenOrdnen(flaeche) {
  const rahmen = flaeche.getBoundingClientRect();
  if (!rahmen.width) return;
  const schneidet = (a, b, rand = 0) => a.left < b.right + rand && a.right > b.left - rand && a.top < b.bottom + rand && a.bottom > b.top - rand;
  for (const n of flaeche.querySelectorAll('.marker-name')) {
    n.style.removeProperty('--schieben');
    const r = n.getBoundingClientRect();
    if (!r.width) continue;
    let dx = 0;
    for (const m of flaeche.querySelectorAll('.marker-punkt')) {
      if (n.parentElement.contains(m)) continue;
      const b = m.getBoundingClientRect();
      if (!schneidet(r, b)) continue;
      const links = r.right - b.left + 6;
      const rechts = b.right - r.left + 6;
      dx = links < rechts ? -links : rechts;
    }
    if (dx) n.style.setProperty('--schieben', `${Math.round(dx)}px`);
  }
  // Stempel (geschaffter Ort) über dem Bild einer anderen Marke: auf die linke Seite, wenn es dort frei ist
  const bilder = [...flaeche.querySelectorAll('.marker-punkt')];
  const aufBild = (st) => bilder.some((m) => !st.parentElement.contains(m) && ueberKreis(st.getBoundingClientRect(), m.getBoundingClientRect()));
  for (const st of flaeche.querySelectorAll('.marker-stempel')) {
    st.classList.remove('links');
    if (!aufBild(st)) continue;
    st.classList.add('links');
    if (aufBild(st)) st.classList.remove('links');
  }
  const marken = [...flaeche.querySelectorAll('.karte-marker, .karte-marker > *')]
    .map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height);
  const RAND = 4;
  const stoesst = (r) => r.left < rahmen.left + RAND || r.right > rahmen.right - RAND || marken.some((m) => schneidet(r, m, RAND));
  for (const el of flaeche.querySelectorAll('.karte-stadt')) {
    el.classList.remove('links', 'verdeckt');
    const r = el.getBoundingClientRect();
    if (!r.width || !stoesst(r)) continue;
    el.classList.add('links');
    if (stoesst(el.getBoundingClientRect())) el.classList.replace('links', 'verdeckt');
  }
}

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
  const punkte = auseinander(eintraege.map((e) => {
    const [x, y] = projiziere(e.ort.lage.lat, e.ort.lage.lon);
    return { ...e, x, y };
  }));
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
    // Liegt ein anderer Ort dicht darunter, steht der Name über der Marke statt darunter (160: auch die Bastei nach
    // dem Wegrücken unter Bautzen).
    const oben = punkte.some((q) => q !== p && Math.abs(q.x - p.x) < 170 && q.y > p.y && q.y - p.y < 160);
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
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => stadtnamenOrdnen(flaeche)).observe(flaeche);
  document.fonts?.ready.then(() => stadtnamenOrdnen(flaeche)).catch(() => {});
  return h('figure', { class: 'karte-rahmen' },
    h('div', { class: 'nur-vorlesbar' }, `${titel} mit ${eintraege.length} Orten. Die Orte stehen auch in der Liste unter der Karte.`),
    flaeche,
    h('figcaption', { class: 'karte-quelle' }, KARTE.quelle.replace('Kartengrundlage: ', 'Karte: '), ' · Bäume, Berge und Weg: gezeichnet'));
}

export { STATUS_TEXT };
