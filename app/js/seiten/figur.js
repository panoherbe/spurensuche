// Spielfigur gestalten (Modul spiele/figur, docs/SCHNITTSTELLE.md 4.1). Die Auswahl bleibt nur im Gerät.
// Zwei Formen des Moduls: `starteGestaltung` mit Katalog aus inhalte/figur.json (Stand der Spiele seit 15.11.2026)
// und die ältere Form `gestalte`/`figurElement`.

import { h, leere, symbol } from '../ui.js';
import { t, einstellungen, reduzierteBewegung } from '../einstellungen.js';
import { vorlesen } from '../vorlesen.js';
import { url } from '../inhalte.js';
import { aktuellesTeam, setzeFigur } from '../spielstand.js';
import { konfetti } from '../zeichnungen.js';

export async function zeige({ haupt, inhalte, aufraeumen }) {
  const team = aktuellesTeam();
  let modul = null;
  try { modul = await import(url('spiele/figur/index.js')); } catch { /* noch nicht vorhanden */ }
  let katalog = null;
  if (modul?.starteGestaltung) {
    try { katalog = await (await fetch(url('inhalte/figur.json'))).json(); } catch { katalog = null; }
  }
  if (!(modul?.starteGestaltung && katalog) && !modul?.gestalte) {
    leere(haupt, h('h1', {}, 'Eure Figur'), h('p', {}, 'Die Figur kommt mit dem nächsten Stand der Spiele.'));
    return 'Figur';
  }
  const abbruch = new AbortController();
  aufraeumen.push(() => abbruch.abort());
  const wurzel = h('section', { class: 'spiel-wurzel', 'aria-label': 'Figur gestalten' });
  leere(haupt,
    h('h1', { 'data-vorlesen': '' }, 'Eure Figur'),
    h('p', { 'data-vorlesen': '' }, t({ standard: 'Mit Sammelstücken schaltet ihr neue Teile frei.', einfach: 'Mit gesammelten Dingen bekommt ihr neue Teile für die Figur.' })),
    h('div', { class: 'aufgabe-rahmen' }, wurzel));
  const e = einstellungen();
  const umgebung = { sprache: e.sprache, vorlesen, tempo: e.tempo, hoherKontrast: e.kontrast === 'hoch', reduzierteBewegung: reduzierteBewegung(), melde: () => {}, signal: abbruch.signal, basisUrl: new URL('./', document.baseURI).href, ton: e.ton, rollen: false, katalog: inhalte.items };
  try {
    const figur = katalog
      ? await modul.starteGestaltung(wurzel, { katalog, items: inhalte.items, freigeschaltet: [...team.items], auswahl: team.figur ?? {}, umgebung })
      : await modul.gestalte(wurzel, { figur: team.figur ?? null, freigeschaltet: [...team.items], umgebung });
    if (figur !== undefined && figur !== null && !abbruch.signal.aborted) {
      await setzeFigur(figur);
      let bild = null;
      if (katalog && modul.figurSvg) {
        const svg = new DOMParser().parseFromString(modul.figurSvg(figur, katalog), 'image/svg+xml').documentElement;
        bild = h('div', { class: 'figur-gross', role: 'img', 'aria-label': modul.figurText ? modul.figurText(figur, katalog) : 'Eure Figur' }, document.importNode(svg, true));
      } else if (modul.figurElement) bild = modul.figurElement(figur, { groesse: 220 });
      leere(wurzel, h('div', { class: 'feier' }, konfetti(), symbol('haken'), h('h2', { tabindex: '-1' }, 'Figur gespeichert'), bild,
        h('p', {}, h('a', { class: 'knopf', href: '#/karte' }, 'Zur Karte'))));
      wurzel.querySelector('h2')?.focus();
    }
  } catch (err) {
    if (!abbruch.signal.aborted) { console.error(err); leere(wurzel, h('p', { role: 'alert' }, 'Die Figur ließ sich gerade nicht laden.')); }
  }
  return 'Figur';
}
