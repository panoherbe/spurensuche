// Kleine DOM-Helfer: Elemente bauen (nur textContent, nie innerHTML), Dialoge, Meldungen, Fokus, Symbole.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Baut ein Element. `h('button', { class: 'knopf', onclick: fn, 'aria-label': 'x' }, 'Text', kind)`.
 * Kinder: Text, Elemente, Arrays, null/false (übersprungen).
 */
export function h(tag, eigenschaften = {}, ...kinder) {
  const el = document.createElement(tag);
  setze(el, eigenschaften);
  anhaengen(el, kinder);
  return el;
}

function setze(el, eigenschaften) {
  for (const [k, v] of Object.entries(eigenschaften ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'stil') for (const [p, w] of Object.entries(v)) el.style.setProperty(p, w);
    else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'indeterminate') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function anhaengen(el, kinder) {
  for (const k of kinder.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

/** Ersetzt den Inhalt eines Elements. */
export function leere(el, ...kinder) {
  el.replaceChildren();
  anhaengen(el, kinder);
  return el;
}

/** SVG-Element bauen. */
export function s(tag, eigenschaften = {}, ...kinder) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(eigenschaften ?? {})) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, String(v));
  for (const k of kinder.flat(Infinity)) if (k) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}

// Symbole als Pfade (eigene Zeichnung, 24 × 24). Dekorativ: aria-hidden; die Bedeutung trägt immer der Text.
const PFADE = {
  zurueck: 'M15 5l-7 7 7 7',
  weiter: 'M9 5l7 7-7 7',
  lautsprecher: 'M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12',
  stopp: 'M7 7h10v10H7z',
  zahnrad: 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.6a7 7 0 01-1.7 1l-.4 2h-3.6l-.4-2a7 7 0 01-1.7-1l-1.9.6L5 14.7l1.6-1.2a7 7 0 010-2L5 10.3 6.8 7.2l1.9.6a7 7 0 011.7-1l.4-2h3.6l.4 2a7 7 0 011.7 1l1.9-.6 1.8 3.1-1.6 1.2a7 7 0 010 2z',
  karte: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  buch: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7',
  bild: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15.5 9.5a1.5 1.5 0 100-.01',
  haken: 'M5 12.5l4.5 4.5L19 7',
  kreuz: 'M6 6l12 12M18 6L6 18',
  ort: 'M12 21s-6-5.6-6-11a6 6 0 0112 0c0 5.4-6 11-6 11zM12 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2',
  tastatur: 'M3 7h18v10H3zM6 10h1M9 10h1M12 10h1M15 10h1M18 10h1M7 14h10',
  standort: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 7a5 5 0 100 10 5 5 0 000-10z',
  schule: 'M3 9l9-5 9 5-9 5zM7 11.5V16c2.5 2 7.5 2 10 0v-4.5M21 9v6',
  familie: 'M8 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 21v-5a5 5 0 0110 0v5M13 21v-4a4 4 0 018 0v4',
  stern: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  schloss: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  muell: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  stift: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  pdf: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
  herunter: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  wolke: 'M7 18a4 4 0 01-.5-8 6 6 0 0111.5 1.5A3.5 3.5 0 0117.5 18z',
  ohneNetz: 'M3 3l18 18M7 18a4 4 0 01-.5-8M10 6.4A6 6 0 0118 11.5a3.5 3.5 0 011.5 6.4',
  figur: 'M12 3a3 3 0 110 6 3 3 0 010-6zM6 21v-4a6 6 0 0112 0v4',
  info: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 11v6M12 7.5v.5',
  warnung: 'M12 3.5l9.5 17h-19zM12 10v4.5M12 17.5v.5',
  aktualisieren: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  augen: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
};

export function symbol(name, { klasse = 'symbol' } = {}) {
  return s('svg', { class: klasse, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('path', { d: PFADE[name] ?? PFADE.info }));
}

/** Knopf mit optionalem Symbol. */
export function knopf(text, onclick, { art = '', sym = null, typ = 'button', ...rest } = {}) {
  return h('button', { type: typ, class: `knopf ${art}`.trim(), onclick, ...rest }, sym ? symbol(sym) : null, text);
}

export function link(text, href, { art = '', sym = null, ...rest } = {}) {
  return h('a', { href, class: `knopf ${art}`.trim(), ...rest }, sym ? symbol(sym) : null, text);
}

let meldeZeit = null;
/** Kurze Meldung unten, auch für Bildschirmleser (role=status). */
export function melde(text, { dauer = 3500 } = {}) {
  let el = document.getElementById('meldung');
  if (!el) {
    el = h('div', { id: 'meldung', class: 'meldung', role: 'status', 'aria-live': 'polite', hidden: true });
    document.body.append(el);
  }
  el.textContent = text;
  el.hidden = false;
  clearTimeout(meldeZeit);
  meldeZeit = setTimeout(() => { el.hidden = true; }, dauer);
}

/** Modaler Dialog. Liefert ein Promise mit dem Rückgabewert von `schliesse(wert)`. */
export function dialog(titel, baue, { schliessbar = true } = {}) {
  return new Promise((ok) => {
    const d = h('dialog', { 'aria-labelledby': 'dialog-titel' });
    const schliesse = (wert) => { d.close(); d.remove(); ok(wert); };
    const kopf = h('div', { class: 'kopf' }, h('h2', { id: 'dialog-titel' }, titel),
      schliessbar ? h('button', { type: 'button', class: 'knopf leise symbolknopf', 'aria-label': 'Schließen', onclick: () => schliesse(null) }, symbol('kreuz')) : null);
    const inhalt = h('div', { class: 'inhalt' });
    d.append(kopf, inhalt);
    d.addEventListener('cancel', (e) => { if (!schliessbar) e.preventDefault(); else { e.preventDefault(); schliesse(null); } });
    document.body.append(d);
    baue(inhalt, schliesse);
    d.showModal();
  });
}

/** Ja/Nein-Abfrage. */
export function frage(titel, text, { ja = 'Ja', nein = 'Abbrechen', gefaehrlich = false } = {}) {
  return dialog(titel, (inhalt, schliesse) => {
    inhalt.append(h('p', {}, text), h('div', { class: 'knopfreihe' },
      knopf(ja, () => schliesse(true), { art: gefaehrlich ? 'warnung' : '' }),
      knopf(nein, () => schliesse(false), { art: 'leise' })));
  });
}

/** Setzt Seitentitel und Fokus auf die Hauptüberschrift (für Bildschirmleser nach jedem Seitenwechsel). */
export function seitenwechsel(titel, haupt) {
  document.title = titel;
  const h1 = haupt.querySelector('h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: false }); }
  window.scrollTo({ top: 0 });
}

export const formatiereBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024)).toLocaleString('de-DE')} KB`);

/** Lädt eine Datei im Browser herunter. */
export function herunterladen(inhalt, name, typ) {
  const blob = inhalt instanceof Blob ? inhalt : new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, hidden: true });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

// Lizenzname → Lizenztext. CC BY, CC BY-SA und die Freie-Kunst-Lizenz verlangen bei jeder Nutzung einen Link zum
// Lizenztext. Gleiche Tabelle in app/js/ui.js und spiele/_gemeinsam/ui.js; spiele/_test/inhalte.test.js prüft, dass
// jede Bildquelle der Inhalte in beiden genau einen Link bekommt. Spezielle Namen vor allgemeinen.
const LIZENZEN = [
  [/\bCC BY-SA 4\.0\b/i, 'https://creativecommons.org/licenses/by-sa/4.0/deed.de'],
  [/\bCC BY-SA 3\.0 DE\b/i, 'https://creativecommons.org/licenses/by-sa/3.0/de/deed.de'],
  [/\bCC BY-SA 3\.0\b/i, 'https://creativecommons.org/licenses/by-sa/3.0/deed.de'],
  [/\bCC BY 4\.0\b/i, 'https://creativecommons.org/licenses/by/4.0/deed.de'],
  [/\bCC BY 3\.0\b/i, 'https://creativecommons.org/licenses/by/3.0/deed.de'],
  [/\bCC0(?: 1\.0)?\b/i, 'https://creativecommons.org/publicdomain/zero/1.0/deed.de'],
  [/\bFreie-Kunst-Lizenz(?: 1\.3)? \(FAL(?: 1\.3)?\)|\bFAL 1\.3\b/i, 'https://artlibre.org/licence/lal/de1-3/'],
];

/** Teilt eine Quellenangabe in Text und Lizenz: ['Foto: …, ', { name: 'CC BY-SA 4.0', url }, ', Wikimedia …']. */
export function lizenzTeile(text) {
  const s = String(text ?? '');
  for (const [muster, url] of LIZENZEN) {
    const m = muster.exec(s);
    if (m) return [s.slice(0, m.index), { name: m[0], url }, s.slice(m.index + m[0].length)].filter((teil) => teil !== '');
  }
  return s ? [s] : [];
}

/** Quellenangabe als Kinder für h(): der Lizenzname als Link zum Lizenztext, in einem neuen Fenster (die App bleibt offen). */
export const bildnachweis = (text) => lizenzTeile(text).map((teil) => (typeof teil === 'string' ? teil
  : h('a', { href: teil.url, rel: 'license noopener', target: '_blank' }, teil.name)));
