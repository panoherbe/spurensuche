// Spielfigur gestalten (Modul spiele/figur, docs/SCHNITTSTELLE.md 4.1). Die Auswahl bleibt nur im Gerät.

import { h, leere, symbol } from '../ui.js';
import { t, einstellungen, reduzierteBewegung } from '../einstellungen.js';
import { vorlesen } from '../vorlesen.js';
import { url } from '../inhalte.js';
import { aktuellesTeam, setzeFigur } from '../spielstand.js';

export async function zeige({ haupt, inhalte, aufraeumen }) {
  const team = aktuellesTeam();
  let modul = null;
  try { modul = await import(url('spiele/figur/index.js')); } catch { /* noch nicht vorhanden */ }
  if (!modul?.gestalte) {
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
  try {
    const figur = await modul.gestalte(wurzel, {
      figur: team.figur ?? null,
      freigeschaltet: [...team.items],
      umgebung: { sprache: e.sprache, vorlesen, tempo: e.tempo, hoherKontrast: e.kontrast === 'hoch', reduzierteBewegung: reduzierteBewegung(), melde: () => {}, signal: abbruch.signal, basisUrl: new URL('./', document.baseURI).href, ton: e.ton, rollen: false, katalog: inhalte.items },
    });
    if (figur !== undefined && !abbruch.signal.aborted) {
      await setzeFigur(figur);
      leere(wurzel, h('div', { class: 'feier' }, symbol('haken'), h('h2', { tabindex: '-1' }, 'Figur gespeichert'), modul.figurElement ? modul.figurElement(figur, { groesse: 220 }) : null,
        h('p', {}, h('a', { class: 'knopf', href: '#/karte' }, 'Zur Karte'))));
      wurzel.querySelector('h2')?.focus();
    }
  } catch (err) {
    if (!abbruch.signal.aborted) { console.error(err); leere(wurzel, h('p', { role: 'alert' }, 'Die Figur ließ sich gerade nicht laden.')); }
  }
  return 'Figur';
}
