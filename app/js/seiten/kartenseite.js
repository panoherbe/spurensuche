// Karte mit allen Orten des Teams und Liste darunter. Reihenfolge frei, kein Ort gesperrt.

import { h, leere, symbol } from '../ui.js';
import { t } from '../einstellungen.js';
import { aktuellesTeam, orteDesTeams, stationVon, finaleGeschafft } from '../spielstand.js';
import { zeichneKarte, STATUS_TEXT } from '../karte.js';
import { url } from '../inhalte.js';

export async function zeige({ haupt, inhalte, navigiere }) {
  const team = aktuellesTeam();
  const orte = orteDesTeams(inhalte);
  const eintraege = orte.map(({ ort, aufgaben }, i) => {
    const st = stationVon(ort.id);
    const fertig = aufgaben.filter((nr) => team.laeufe[`${ort.id}/${nr}`]).length;
    return { ort, aufgaben, fertig, nummer: i + 1, finale: ort.id === inhalte.finale, status: st?.status === 'abgeschlossen' || fertig === aufgaben.length ? 'abgeschlossen' : st?.status ?? 'offen' };
  });
  const geschafft = eintraege.filter((e) => e.status === 'abgeschlossen').length;
  const bildBereit = finaleGeschafft(inhalte);
  leere(haupt,
    h('div', { class: 'seitenkopf' }, h('div', {},
      h('h1', { 'data-vorlesen': '' }, team.modus === 'schule' ? team.freigabe.titel : 'Eure Entdeckungsreise'),
      h('p', { class: 'leise', 'data-vorlesen': '' }, t({ standard: 'Wählt einen Ort auf der Karte. Die Reihenfolge bestimmt ihr.', einfach: 'Tippt auf einen Ort. Ihr sucht euch die Reihenfolge aus.' })))),
    h('div', { class: 'fortschritt' },
      h('span', { class: 'marke gut' }, symbol('haken'), `${geschafft} von ${eintraege.length} Orten geschafft`),
      h('span', { class: 'marke' }, symbol('buch'), `${team.items.length} von ${inhalte.items.length} Sammelstücken`),
      bildBereit ? h('a', { class: 'marke warten', href: '#/bild' }, symbol('bild'), team.bild ? 'Euer Bild ansehen' : 'Jetzt euer Bild gestalten') : null),
    zeichneKarte(eintraege, (id) => navigiere(`/ort/${id}`)),
    h('h2', {}, 'Alle Orte'),
    h('ul', { class: 'ortsliste' }, eintraege.map((e) => h('li', {},
      h('button', { type: 'button', class: 'ortskarte', onclick: () => navigiere(`/ort/${e.ort.id}`) },
        h('img', { src: url(e.ort.bild), alt: '', loading: 'lazy' }),
        h('span', { class: 'text' },
          h('strong', {}, `${e.nummer}. ${e.ort.name}`),
          h('span', { class: 'leise' }, `${e.ort.region}${e.finale ? ' · Abschluss' : ''}`),
          h('span', { class: `marke${e.status === 'abgeschlossen' ? ' gut' : e.status === 'begonnen' ? ' warten' : ''}` },
            e.status === 'abgeschlossen' ? symbol('haken') : null, `${STATUS_TEXT[e.status]} · ${e.fertig} von ${e.aufgaben.length} Aufgaben`)))))),
  );
  return team.modus === 'schule' ? team.freigabe.titel : 'Karte';
}
