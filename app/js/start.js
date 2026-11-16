// Start der Spieler-Ansicht: Einstellungen, Service Worker, Kopfleiste, Seitenwechsel über den Hash (#/karte).

import { h, leere, symbol, seitenwechsel, melde } from './ui.js';
import { ladeEinstellungen, zeigeEinstellungen, einstellungen, beiAenderung } from './einstellungen.js';
import { setzeTempoQuelle, vorlesenBereich, stoppeAlles, kannVorlesen } from './vorlesen.js';
import { holeApi } from './api.js';
import { ladeInhalte } from './inhalte.js';
import { ladeTeam, aktuellesTeam, beiTeamAenderung } from './spielstand.js';
import { starteSync, syncZustand, beiSyncAenderung } from './sync.js';
import { dauerhaftBitten } from './speicher.js';
import { KARTE } from './karte-daten.js';
import { wappen } from './zeichnungen.js';

const SEITEN = {
  '': () => import('./seiten/startseite.js'),
  beitritt: () => import('./seiten/beitritt.js'),
  anmeldung: () => import('./seiten/beitritt.js'),
  familie: () => import('./seiten/familie.js'),
  karte: () => import('./seiten/kartenseite.js'),
  ort: () => import('./seiten/ort.js'),
  aufgabe: () => import('./seiten/aufgabe.js'),
  sammlung: () => import('./seiten/sammlung.js'),
  figur: () => import('./seiten/figur.js'),
  bild: () => import('./seiten/bild.js'),
  datenschutz: () => import('./seiten/datenschutz.js'),
  info: () => import('./seiten/info.js'),
};

const app = { api: null, inhalte: null, konfig: null, haupt: null, aufraeumen: [] };

export function navigiere(ziel) {
  if (location.hash === `#${ziel}`) zeige();
  else location.hash = ziel;
}

function logo() {
  return h('span', { class: 'logo', 'aria-hidden': 'true' }, (() => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', `0 0 ${KARTE.breite} ${KARTE.hoehe}`);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', KARTE.sachsen);
    s.append(p);
    return s;
  })());
}

function netzAnzeige() {
  const z = syncZustand();
  const team = aktuellesTeam();
  if (!team || team.modus !== 'schule') return h('span', { class: 'netz', id: 'netz', hidden: true });
  const offline = !navigator.onLine;
  // In der Vorführung gibt es keinen Server: Ergebnisse werden im Browser gespeichert, nicht übertragen.
  const vorf = app.api?.vorfuehrung;
  const text = offline ? (z.offen ? `Offline · ${z.offen} warten` : 'Offline')
    : z.offen ? `${z.offen} werden ${vorf ? 'gespeichert' : 'übertragen'}` : vorf ? 'Alles gespeichert' : 'Alles übertragen';
  return h('span', { class: `netz${offline ? ' offline' : ''}`, id: 'netz', role: 'status' }, symbol(offline ? 'ohneNetz' : vorf ? 'haken' : 'wolke'), h('span', { class: 'netz-text' }, text));
}

function zeichneKopf() {
  const kopf = document.getElementById('kopf');
  const team = aktuellesTeam();
  const vorleseKnopf = h('button', { type: 'button', class: 'knopf leise symbolknopf', 'aria-label': 'Vorlesen', title: 'Vorlesen', hidden: !kannVorlesen(),
    onclick: () => vorlesenBereich(app.haupt, (an) => {
      vorleseKnopf.setAttribute('aria-label', an ? 'Vorlesen stoppen' : 'Vorlesen');
      leere(vorleseKnopf, symbol(an ? 'stopp' : 'lautsprecher'));
    }) }, symbol('lautsprecher'));
  leere(kopf,
    h('a', { class: `marke-app${team ? ' mit-team' : ''}`, href: team ? '#/karte' : '#/' }, logo(), h('span', { class: 'wortmarke' }, 'Spurensuche'),
      team ? h('span', { class: 'team' }, wappen(team.name, 'wappen klein'), h('span', { class: 'name' }, team.name)) : null),
    netzAnzeige(),
    vorleseKnopf,
    h('button', { type: 'button', class: 'knopf leise symbolknopf', 'aria-label': 'Einstellungen: Sprache, Vorlesen, Tempo, Darstellung', title: 'Einstellungen', onclick: async () => { await zeigeEinstellungen(); zeige(); } }, symbol('zahnrad')));
}

function zeichneUnten(aktiv) {
  const nav = document.getElementById('unten');
  const team = aktuellesTeam();
  nav.hidden = !team || ['', 'beitritt', 'familie', 'anmeldung'].includes(aktiv);
  if (nav.hidden) return;
  const eintrag = (ziel, text, sym) => h('a', { href: `#/${ziel}`, class: `nav-${ziel}`, 'aria-current': aktiv === ziel || (ziel === 'karte' && ['ort', 'aufgabe'].includes(aktiv)) ? 'page' : null },
    h('span', { class: 'nav-symbol' }, symbol(sym)), text);
  leere(nav, eintrag('karte', 'Karte', 'karte'), eintrag('sammlung', 'Sammelbuch', 'buch'), eintrag('figur', 'Figur', 'figur'), eintrag('bild', 'Bild', 'bild'));
}

let zeigeNr = 0;
async function zeige() {
  const nr = ++zeigeNr;
  stoppeAlles();
  for (const fn of app.aufraeumen.splice(0)) { try { fn(); } catch { /* egal */ } }
  const roh = location.hash.replace(/^#\/?/, '');
  const [pfad, abfrage = ''] = roh.split('?');
  const teile = pfad.split('/').filter(Boolean);
  let name = teile[0] ?? '';
  const team = aktuellesTeam();
  if (!SEITEN[name]) name = '';
  if (name === '' && team && !roh.includes('neu')) { location.replace('#/karte'); return; }
  if (['karte', 'ort', 'aufgabe', 'sammlung', 'figur', 'bild'].includes(name) && !team) {
    // QR-Code an einem Ort gescannt, aber noch kein Team: zuerst ein Team wählen, danach geht es dorthin zurück.
    if (name === 'ort') sessionStorage.setItem('spur-nach-start', `#${roh}`);
    location.replace('#/');
    return;
  }
  zeichneKopf();
  zeichneUnten(name);
  try {
    const modul = await SEITEN[name]();
    if (nr !== zeigeNr) return;
    const params = new URLSearchParams(abfrage);
    const titel = await modul.zeige({ ...app, teile: teile.slice(1), params, navigiere, neuZeichnen: zeige, seite: name });
    if (nr !== zeigeNr) return;
    seitenwechsel(`${titel ? `${titel} – ` : ''}Spurensuche Sachsen`, app.haupt);
    if (einstellungen().autoVorlesen && kannVorlesen()) setTimeout(() => { if (nr === zeigeNr) vorlesenBereich(app.haupt); }, 300);
  } catch (e) {
    console.error(e);
    leere(app.haupt, h('div', { class: 'karte' }, h('h1', {}, 'Das hat nicht geklappt'),
      h('p', {}, 'Diese Seite konnte nicht geladen werden. Ist das Gerät offline und die Spurensuche noch nicht vorgeladen?'),
      h('p', {}, h('a', { href: '#/' }, 'Zur Startseite'))));
  }
}

async function starte() {
  app.haupt = document.getElementById('inhalt');
  await ladeEinstellungen();
  setzeTempoQuelle(() => einstellungen().tempo);
  beiAenderung(() => zeichneKopf());
  app.api = await holeApi();
  app.konfig = app.api.konfiguration;
  await ladeTeam();
  try {
    app.inhalte = await ladeInhalte();
  } catch (e) {
    leere(app.haupt, h('div', { class: 'karte' }, h('h1', {}, 'Inhalte nicht erreichbar'), h('p', {}, 'Bitte einmal mit Netz öffnen, damit die Spurensuche alles vorlädt.')));
    return;
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    try {
      await navigator.serviceWorker.register('sw.js', { scope: './' });
      navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ art: 'pruefen' })).catch(() => {});
      navigator.serviceWorker.addEventListener('message', (ev) => {
        if (ev.data?.art === 'vorgeladen') melde(`Offline bereit: ${ev.data.dateien} Dateien gespeichert.`);
      });
    } catch (e) { console.warn('Service Worker nicht registriert', e); }
  }
  dauerhaftBitten();
  starteSync(app.api);
  beiSyncAenderung(() => { const alt = document.getElementById('netz'); if (alt) alt.replaceWith(netzAnzeige()); });
  beiTeamAenderung(() => zeichneKopf());
  window.addEventListener('hashchange', zeige);
  await zeige();
}

starte();
