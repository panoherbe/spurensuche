// Spielrahmen und Bausteine, die alle Minispiele teilen (nach docs/SCHNITTSTELLE.md, Version 1):
// Startkarte mit Rollen und Sammelstück, Aufgabe mit Vorlesen, Tipps in Stufen, Rückmeldung mit role="status",
// Abschlusskarte mit Sternen und „Wusstet ihr?“.
//
// Ein Format ruft spielRahmen({ wurzel, aufgabe, umgebung, meta, stil, aufbau }) auf. aufbau(k) baut die
// Spielfläche und ruft am Ende k.fertig({ geloest, punkte }). Texte kommen nur über textContent ins Dokument.

import { text } from './sprache.js';
import { symbol } from './symbole.js';
import { ullaElement } from './ulla.js';
import { neuesProtokoll } from './protokoll.js';
import { erzeugeVorlesen } from './vorlesen.js';
import { ton } from './ton.js';

const WURZEL_URL = new URL('../../', import.meta.url);
const BASIS_CSS = new URL('./basis.css', import.meta.url).href;

/** Element bauen: h('button', { class, text, on: { click }, style: { … }, …Attribute }, …Kinder). */
export function h(tag, eigenschaften = {}, ...kinder) {
  const el = document.createElement(tag);
  for (const [name, wert] of Object.entries(eigenschaften ?? {})) {
    if (wert == null || wert === false) continue;
    if (name === 'class') el.setAttribute('class', wert);
    else if (name === 'text') el.textContent = wert;
    else if (name === 'on') for (const [ereignis, fn] of Object.entries(wert)) el.addEventListener(ereignis, fn);
    else if (name === 'style') for (const [eigenschaft, w] of Object.entries(wert)) el.style.setProperty(eigenschaft, w);
    else if (name === 'dataset') Object.assign(el.dataset, wert);
    else el.setAttribute(name, wert === true ? '' : String(wert));
  }
  for (const kind of kinder.flat(Infinity)) {
    if (kind == null || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return el;
}

let laufendeNummer = 0;
/** Eindeutige id für aria-Verweise. */
export const neueId = (vorsilbe = 'sp') => `${vorsilbe}-${++laufendeNummer}`;

/** Pfad aus den Inhalten (relativ zur Repo-Wurzel) als URL. */
export const pfad = (p) => (p ? new URL(p, WURZEL_URL).href : '');

/** Stylesheet als <link> in `ziel` einhängen und auf das Laden warten (strenge CSP: kein <style>). */
function verlinkeStil(ziel, href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  const geladen = new Promise((ok) => {
    link.addEventListener('load', ok, { once: true });
    link.addEventListener('error', ok, { once: true });
  });
  ziel.append(link);
  return geladen;
}

const kataloge = new Map();
/** Sammelstücke der Belohnung: aus umgebung.items, sonst aus inhalte/items.json. */
async function ladeItems(umgebung) {
  if (Array.isArray(umgebung.items)) return umgebung.items;
  const url = pfad('inhalte/items.json');
  if (!kataloge.has(url)) {
    kataloge.set(url, fetch(url).then((a) => (a.ok ? a.json() : [])).then((d) => (Array.isArray(d) ? d : d.items ?? [])).catch(() => []));
  }
  return kataloge.get(url);
}

/** Umgebung nach Vertrag 2.3, mit sicheren Voreinstellungen. */
export function normalisiere(umgebung = {}) {
  const tempo = Math.min(1.5, Math.max(0.5, Number(umgebung.tempo) || 1));
  const ruhigSystem = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ruhigApp = document.documentElement.dataset.bewegung === 'reduziert';
  return {
    ...umgebung,
    sprache: umgebung.sprache === 'einfach' ? 'einfach' : 'standard',
    tempo,
    vorlesen: typeof umgebung.vorlesen === 'function' ? umgebung.vorlesen : erzeugeVorlesen({ tempo }),
    hoherKontrast: !!umgebung.hoherKontrast || document.documentElement.dataset.kontrast === 'hoch',
    reduzierteBewegung: !!umgebung.reduzierteBewegung || ruhigSystem || ruhigApp,
    melde: typeof umgebung.melde === 'function' ? umgebung.melde : () => {},
    signal: umgebung.signal ?? null,
    ton: !!umgebung.ton,
  };
}

/** Knopf-Rollen: Jede hat ihre eigenen Knöpfe im Spiel; jede Eingabe dort meldet „rolle“. */
export const KNOPF_ROLLEN = {
  vorlesen: { name: 'Vorlesen', symbol: 'lesen', aufgabe: { standard: 'drückt „Vorlesen“ oder liest selbst laut vor', einfach: 'liest vor' } },
  steuern: { name: 'Steuern', symbol: 'steuern', aufgabe: { standard: 'macht die Züge am Gerät, so wie die Gruppe es sagt', einfach: 'tippt auf das Gerät' } },
  nachschlagen: { name: 'Nachschlagen', symbol: 'tipp', aufgabe: { standard: 'holt einen Tipp, wenn ihr nicht weiterkommt', einfach: 'holt Tipps' } },
  pruefen: { name: 'Prüfen', symbol: 'pruefen', aufgabe: { standard: 'fragt, ob alle einverstanden sind, und drückt dann „Prüfen“', einfach: 'fragt alle und drückt „Prüfen“' } },
};

const SPRUECHE = {
  standard: { 3: ['Uhuuu! Das war spitze!', 'Stark wie Sandstein!', 'Eulenstark gemacht!'], 2: ['Geschafft! Richtig gut.', 'Prima, ihr habt es!'], 1: ['Geschafft! Dranbleiben lohnt sich.', 'Hurra, gelöst!'] },
  einfach: { 3: ['Super gemacht!'], 2: ['Gut gemacht!'], 1: ['Geschafft!'] },
};

/**
 * Rahmen eines Minispiels. Liefert ein Promise mit dem Ergebnis nach Vertrag 2.4:
 * { geloest, punkte, versuche, dauerSekunden, items, ereignisse }.
 */
export async function spielRahmen({ wurzel, aufgabe, umgebung, meta, stil, aufbau, startbild = true }) {
  if (!wurzel) throw new Error('starte(): Es fehlt das Element, in dem das Spiel laufen soll.');
  if (!aufgabe || aufgabe.format !== meta.id) throw new Error(`starte(): Die Aufgabe gehört nicht zum Format „${meta.id}“.`);
  const u = normalisiere(umgebung);
  const protokoll = neuesProtokoll({ melde: u.melde, aufgabe });
  const t = (feld) => text(feld, u.sprache);

  const klassen = ['sp-spiel', u.hoherKontrast && 'sp-kontrast', u.reduzierteBewegung && 'sp-ruhig', u.sprache === 'einfach' && 'sp-einfach'].filter(Boolean).join(' ');
  const spiel = h('div', { class: klassen, lang: 'de', 'data-format': meta.id });
  spiel.style.setProperty('--sp-tempo', String(u.tempo));
  wurzel.replaceChildren();
  await Promise.all([verlinkeStil(wurzel, BASIS_CSS), stil ? verlinkeStil(wurzel, String(stil)) : null]);
  wurzel.append(spiel);

  const katalog = await ladeItems(u);
  const belohnung = (aufgabe.belohnung ?? []).map((id) => katalog.find((item) => item.id === id) ?? { id, name: id, bild: `assets/spiele/items/${id}.svg`, alt: '' });

  const aufraeumen = [];
  let beendet = false;
  const k = {
    spiel, u, t, protokoll, aufgabe, meta, belohnung, aufraeumen, pfad, startbild,
    get beendet() { return beendet; },
    get animiert() { return !u.reduzierteBewegung; },
    ton: (art) => ton(art, u.ton),
    /** Wartezeit, an das Tempo angepasst (Tempo 0,5 = doppelt so lang). */
    warte: (ms) => new Promise((fertig) => { const id = setTimeout(fertig, ms / u.tempo); aufraeumen.push(() => clearTimeout(id)); }),
    /** Dauer einer Bewegung in ms; 0 bei reduzierter Bewegung. */
    dauer: (ms) => (u.reduzierteBewegung ? 0 : ms / u.tempo),
    /** Mischen nur mit dem Startwert der Aufgabe (Schnittstelle 2.6, Regel 7). */
    startwert: aufgabe.mischen ?? `${meta.id}|${aufgabe.titel}`,
    knopf: (optionen) => knopf(k, optionen),
    vorleseKnopf: (gibText, optionen) => vorleseKnopf(k, gibText, optionen),
    /** Lauscher, der mit dem Spiel endet. */
    lausche: (ziel, art, fn, optionen) => { ziel.addEventListener(art, fn, optionen); aufraeumen.push(() => ziel.removeEventListener(art, fn, optionen)); },
  };

  return new Promise((ergebnisFertig) => {
    const schliessen = (daten) => {
      if (beendet) return;
      beendet = true;
      for (const fn of aufraeumen.splice(0)) { try { fn(); } catch { /* weiter */ } }
      ergebnisFertig(protokoll.abschluss(daten));
    };
    const abbruch = () => {
      u.vorlesen?.stopp?.();
      schliessen({ geloest: false, punkte: 0, items: [] });
    };
    if (u.signal?.aborted) { abbruch(); return; }
    u.signal?.addEventListener('abort', abbruch, { once: true });
    aufraeumen.push(() => u.signal?.removeEventListener('abort', abbruch));

    zeigeStart(k).then(() => {
      if (beendet) return;
      k.flaeche = baueFlaeche(k);
      k.sage = (inhalt, art) => sage(k, inhalt, art);
      k.tipps = (optionen) => tippLeiste(k, optionen);
      k.fertig = async ({ geloest = true, punkte = 0, kopfzeile, wusstet } = {}) => {
        if (beendet) return;
        k.ton('fertig');
        await zeigeAbschluss(k, { geloest, punkte, kopfzeile, wusstet: wusstet ?? aufgabe.wusstetIhr });
        schliessen({ geloest, punkte, items: geloest ? belohnung.map((b) => b.id) : [] });
      };
      Promise.resolve(aufbau(k)).catch((fehler) => {
        console.error(fehler);
        k.sage(`Das Spiel hat einen Fehler: ${fehler.message}`, 'fehler');
      });
    });
  });
}

function bildElement(k, bild, klasse) {
  if (!bild?.datei) return null;
  return h('img', { class: klasse, src: k.pfad(bild.datei), alt: k.t(bild.alt) ?? '', width: bild.breite, height: bild.hoehe, decoding: 'async' });
}

/** Sammelstück als Sticker mit Namen. */
export function itemSticker(k, item, klasse = '') {
  return h('figure', { class: `sp-item ${klasse}`.trim() },
    item.bild ? h('img', { src: k.pfad(item.bild), alt: item.alt || item.name, width: 512, height: 512, decoding: 'async' }) : null,
    h('figcaption', {}, item.name));
}

function rollenBlock(k) {
  const rollen = k.aufgabe.rollen ?? [];
  if (rollen.length === 0) return null;
  const alias = { lesen: 'vorlesen', navigation: 'steuern', recherche: 'nachschlagen', protokoll: 'pruefen' };
  const eintraege = rollen.map((kennung) => {
    const knopfRolle = KNOPF_ROLLEN[alias[kennung] ?? kennung];
    const name = KNOPF_ROLLEN[kennung]?.name ?? kennung.charAt(0).toUpperCase() + kennung.slice(1);
    return h('li', { class: 'sp-rolle', dataset: { rolle: kennung } },
      symbol(knopfRolle?.symbol ?? 'figur', 'sp-rolle-symbol'),
      h('span', { class: 'sp-rolle-name' }, name),
      knopfRolle ? h('span', { class: 'sp-rolle-aufgabe' }, k.t(knopfRolle.aufgabe)) : null);
  });
  return h('div', { class: 'sp-rollen' },
    h('h3', { class: 'sp-zwischentitel' }, k.u.sprache === 'einfach' ? 'Wer macht was?' : 'So teilt ihr euch die Arbeit'),
    h('ul', { class: 'sp-rollenliste' }, eintraege));
}

async function zeigeStart(k) {
  const { t, aufgabe, meta, belohnung } = k;
  const titelId = neueId('titel');
  const titel = h('h2', { class: 'sp-titel', id: titelId, tabindex: '-1' }, aufgabe.titel);
  const los = knopf(k, { text: 'Los geht’s', symbol: 'weiter', art: 'haupt', gross: true });
  const gewinn = belohnung.length === 0 ? null : h('div', { class: 'sp-gewinnvorschau' },
    h('h3', { class: 'sp-zwischentitel' }, k.u.sprache === 'einfach' ? 'Das könnt ihr sammeln' : 'Hier könnt ihr sammeln'),
    h('div', { class: 'sp-gewinnliste' }, belohnung.map((item) => itemSticker(k, item, 'sp-item--klein'))));
  const minuten = aufgabe.dauerMinuten ?? meta.dauerMinuten[1];
  const karte = h('section', { class: 'sp-start', 'aria-labelledby': titelId },
    h('div', { class: 'sp-start-kopf' },
      (k.startbild && bildElement(k, aufgabe.bild, 'sp-start-bild')) || ullaElement('gruesst', 'sp-start-ulla'),
      h('div', { class: 'sp-start-text' },
        h('p', { class: 'sp-ueberzeile' }, symbol(meta.id), h('span', {}, meta.titel), h('span', { class: 'sp-trenner', 'aria-hidden': 'true' }, '·'), symbol('uhr'), h('span', {}, `etwa ${minuten} Minuten`)),
        titel,
        h('p', { class: 'sp-auftrag-text', 'data-vorlesen': '' }, t(aufgabe.text)),
        vorleseKnopf(k, () => `${aufgabe.titel}. ${t(aufgabe.text)}`))),
    rollenBlock(k) || gewinn ? h('div', { class: 'sp-start-unten' }, rollenBlock(k), gewinn) : null,
    h('div', { class: 'sp-aktionen sp-aktionen--mitte' }, los));
  k.spiel.replaceChildren(karte);
  titel.focus();
  await new Promise((weiter) => los.addEventListener('click', weiter, { once: true }));
  k.u.vorlesen?.stopp?.();
}

function baueFlaeche(k) {
  const { t, aufgabe, meta } = k;
  const titelId = neueId('titel');
  const titel = h('h2', { class: 'sp-aufgabe-titel', id: titelId, tabindex: '-1' }, symbol(meta.id), h('span', {}, k.u.sprache === 'einfach' ? 'Eure Aufgabe' : `${meta.titel}: eure Aufgabe`));
  const auftrag = h('p', { class: 'sp-auftrag-text', 'data-vorlesen': '' }, t(aufgabe.text));
  const kopf = h('header', { class: 'sp-kopf' },
    h('div', { class: 'sp-kopf-text' }, titel, auftrag),
    vorleseKnopf(k, () => t(aufgabe.text)));
  const buehne = h('div', { class: 'sp-buehne' });
  const tippBox = h('aside', { class: 'sp-tippbox', hidden: true, 'aria-label': 'Tipp' });
  const ansage = h('p', { class: 'sp-ansage', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const werkzeuge = h('div', { class: 'sp-werkzeuge' });
  const aktionen = h('div', { class: 'sp-aktionen' });
  const fuss = h('div', { class: 'sp-fuss' }, werkzeuge, aktionen);
  const bereich = h('section', { class: 'sp-flaeche', 'aria-labelledby': titelId }, kopf, buehne, tippBox, ansage, fuss);
  k.spiel.replaceChildren(bereich);
  titel.focus();
  return { bereich, kopf, titel, auftrag, buehne, tippBox, ansage, werkzeuge, aktionen };
}

/** Schaltfläche. rolle: welche Knopf-Rolle sie bedient (meldet „rolle“, wenn die Aufgabe Rollen hat). */
function knopf(k, { text: beschriftung, symbol: name, art = 'zweit', rolle, beiKlick, gross, klein, label, ...attribute }) {
  const klassen = ['sp-knopf', `sp-knopf--${art}`, gross && 'sp-knopf--gross', klein && 'sp-knopf--klein'].filter(Boolean).join(' ');
  const el = h('button', { type: 'button', class: klassen, 'aria-label': label, ...attribute },
    name ? symbol(name) : null,
    beschriftung != null ? h('span', { class: 'sp-knopf-text' }, beschriftung) : null);
  if (rolle) el.dataset.rolle = rolle;
  el.addEventListener('click', (ereignis) => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    if (rolle) k.protokoll.rolle(rolle);
    beiKlick?.(ereignis);
  });
  return el;
}

function vorleseKnopf(k, gibText, { klein = true, label } = {}) {
  if (!k.u.vorlesen) return null;
  return knopf(k, {
    text: 'Vorlesen', symbol: 'vorlesen', art: 'leise', klein, rolle: 'vorlesen', label,
    beiKlick: () => { k.u.vorlesen(typeof gibText === 'function' ? gibText() : gibText); },
  });
}

function sage(k, inhalt, art = 'neutral') {
  const { ansage } = k.flaeche;
  ansage.className = `sp-ansage sp-ansage--${art}`;
  if (!inhalt) { ansage.replaceChildren(); return; }
  ansage.replaceChildren(symbol(art === 'gut' ? 'haken' : 'info'), h('span', {}, inhalt));
  if (art === 'gut') k.ton('gut');
  else if (art === 'hinweis') k.ton('falsch');
}

/**
 * Tipps in Stufen. liste: [{ text }]; beiTipp(stufe, tipp) führt die Hilfe der Stufe aus.
 * wiederholbar: Die letzte Stufe lässt sich wiederholen (etwa „noch ein Teil legen“), damit jede Gruppe ans Ziel kommt.
 */
function tippLeiste(k, { liste, beiTipp, wiederholbar = false }) {
  const { werkzeuge, tippBox } = k.flaeche;
  let stufe = 0;
  const zaehler = h('span', { class: 'sp-zaehler', 'aria-hidden': 'true' }, `0/${liste.length}`);
  const tippText = h('p', { class: 'sp-tipp-text', 'data-vorlesen': '' });
  const tippTitel = h('p', { class: 'sp-tipp-titel' });
  tippBox.replaceChildren(ullaElement('denkt', 'sp-tipp-ulla'), h('div', { class: 'sp-tipp-inhalt' }, tippTitel, tippText, vorleseKnopf(k, () => tippText.textContent)));

  const el = knopf(k, {
    text: 'Tipp holen', symbol: 'tipp', art: 'tipp', rolle: 'nachschlagen',
    beiKlick: () => {
      if (stufe < liste.length) stufe += 1;
      else if (!wiederholbar) return;
      const tipp = liste[stufe - 1];
      k.protokoll.aktion(true);
      k.protokoll.hilfe(stufe);
      k.ton('tipp');
      tippTitel.textContent = `Tipp ${stufe} von ${liste.length}`;
      tippText.textContent = k.t(tipp.text);
      tippBox.hidden = false;
      zaehler.textContent = `${stufe}/${liste.length}`;
      el.setAttribute('aria-label', `Tipp holen, ${stufe} von ${liste.length} genutzt`);
      if (stufe >= liste.length) {
        if (wiederholbar) el.querySelector('.sp-knopf-text').textContent = k.t(tipp.nochmal) || 'Noch ein Tipp';
        else { el.setAttribute('aria-disabled', 'true'); el.classList.add('sp-knopf--aus'); }
      }
      beiTipp?.(stufe, tipp);
    },
  });
  el.setAttribute('aria-label', `Tipp holen, 0 von ${liste.length} genutzt`);
  el.append(zaehler);
  werkzeuge.append(el);
  return { get stufe() { return stufe; }, knopf: el };
}

/** Schrittanzeige für Spiele mit mehreren Teilen. */
export function schritte(namen, aktiv) {
  return h('ol', { class: 'sp-schritte', 'aria-label': 'Fortschritt' },
    namen.map((name, i) => h('li', {
      class: i < aktiv ? 'sp-schritt sp-schritt--fertig' : i === aktiv ? 'sp-schritt sp-schritt--jetzt' : 'sp-schritt',
      'aria-current': i === aktiv ? 'step' : null,
    }, h('span', { class: 'sp-schritt-nr', 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, name),
    i < aktiv ? h('span', { class: 'sp-unsichtbar' }, ' (erledigt)') : null)));
}

/** Sterne als Bild mit Text: „2 von 3 Sternen“. */
export function sterneAnzeige(anzahl, von = 3) {
  const reihe = h('p', { class: 'sp-sterne', role: 'img', 'aria-label': `${anzahl} von ${von} Sternen` });
  for (let i = 0; i < von; i++) reihe.append(symbol(i < anzahl ? 'stern' : 'sternLeer', i < anzahl ? 'sp-stern sp-stern--an' : 'sp-stern'));
  return reihe;
}

async function zeigeAbschluss(k, { geloest, punkte, kopfzeile, wusstet }) {
  const { u, t, belohnung } = k;
  u.vorlesen?.stopp?.();
  const liste = SPRUECHE[u.sprache][Math.max(1, Math.min(3, punkte))];
  const ueberschrift = kopfzeile ? t(kopfzeile) : liste[(k.aufgabe.titel?.length ?? 0) % liste.length];
  const titelId = neueId('titel');
  const titel = h('h2', { class: 'sp-titel sp-titel--gross', id: titelId, tabindex: '-1' }, geloest ? ueberschrift : 'Für heute beendet');
  const weiter = knopf(k, { text: 'Weiter', symbol: 'weiter', art: 'haupt', gross: true });
  const wusstetText = wusstet ? t(wusstet) : '';
  const karte = h('section', { class: 'sp-abschluss', 'aria-labelledby': titelId },
    h('div', { class: 'sp-abschluss-kopf' }, ullaElement(geloest ? 'jubelt' : 'gruesst', 'sp-abschluss-ulla'), h('div', {}, titel, geloest ? sterneAnzeige(punkte) : null)),
    geloest && belohnung.length ? h('div', { class: 'sp-gewinn' },
      h('h3', { class: 'sp-zwischentitel' }, 'Neu in eurer Sammlung'),
      h('div', { class: 'sp-gewinnliste' }, belohnung.map((item) => itemSticker(k, item, 'sp-item--gross')))) : null,
    wusstetText ? h('div', { class: 'sp-wusstet' },
      h('h3', { class: 'sp-zwischentitel' }, 'Wusstet ihr?'),
      h('p', { 'data-vorlesen': '' }, wusstetText),
      vorleseKnopf(k, wusstetText)) : null,
    h('div', { class: 'sp-aktionen sp-aktionen--mitte' }, weiter));
  k.spiel.replaceChildren(karte);
  titel.focus();
  await new Promise((fertig) => weiter.addEventListener('click', fertig, { once: true }));
  u.vorlesen?.stopp?.();
}

/**
 * Bewegung von alten zu neuen Plätzen (FLIP): aenderung() verschiebt die Elemente im DOM;
 * bei reduzierter Bewegung wird nur verschoben.
 */
export async function bewege(k, elemente, aenderung, ms = 260) {
  const dauer = k.dauer(ms);
  if (!dauer || typeof Element.prototype.animate !== 'function') { aenderung(); return; }
  const vorher = new Map(elemente.map((el) => [el, el.getBoundingClientRect()]));
  aenderung();
  const animationen = [];
  for (const el of elemente) {
    const alt = vorher.get(el);
    const neu = el.getBoundingClientRect();
    const dx = alt.left - neu.left;
    const dy = alt.top - neu.top;
    if (!dx && !dy) continue;
    animationen.push(el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: dauer, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.catch(() => null));
  }
  await Promise.all(animationen);
}
