// Entdeckerkarte mit allen Orten des Teams und Liste darunter. Reihenfolge frei, kein Ort gesperrt.
// Oben: Wappen der Gruppe, ihre Figur und der Fortschritt als Sterne.

import { h, leere, symbol } from '../ui.js';
import { t } from '../einstellungen.js';
import { aktuellesTeam, orteDesTeams, stationVon, finaleGeschafft } from '../spielstand.js';
import { zeichneKarte, STATUS_TEXT } from '../karte.js';
import { url } from '../inhalte.js';
import { wappen, stern, sternLeer, stempel, ortFarbe } from '../zeichnungen.js';
import { figurBild } from '../figurbild.js';

export async function zeige({ haupt, inhalte, navigiere }) {
  const team = aktuellesTeam();
  const orte = orteDesTeams(inhalte);
  const eintraege = orte.map(({ ort, aufgaben }, i) => {
    const st = stationVon(ort.id);
    const fertig = aufgaben.filter((nr) => team.laeufe[`${ort.id}/${nr}`]).length;
    return { ort, aufgaben, fertig, nummer: i + 1, finale: ort.id === inhalte.finale, farbe: ortFarbe(inhalte, ort.id),
      status: st?.status === 'abgeschlossen' || fertig === aufgaben.length ? 'abgeschlossen' : st?.status ?? 'offen' };
  });
  const geschafft = eintraege.filter((e) => e.status === 'abgeschlossen').length;
  const bildBereit = finaleGeschafft(inhalte);
  const figur = await figurBild(team.figur);
  const titel = team.modus === 'schule' ? team.freigabe.titel : 'Eure Entdeckungsreise';
  leere(haupt,
    h('div', { class: 'team-banner' },
      wappen(team.name),
      h('div', { class: 'team-text' },
        h('p', { class: 'team-name' }, team.modus === 'schule' ? `Gruppe ${team.name}` : team.name),
        h('h1', { 'data-vorlesen': '' }, titel),
        h('p', { class: 'leise', 'data-vorlesen': '' }, t({ standard: 'Tippt auf einen Ort. Die Reihenfolge bestimmt ihr.', einfach: 'Tippt auf einen Ort. Ihr sucht euch die Reihenfolge aus.' }))),
      figur ? h('a', { class: 'team-figur', href: '#/figur', 'aria-label': 'Eure Figur ansehen und ändern' }, figur) : null),
    h('div', { class: 'fortschritt' },
      h('span', { class: 'marke gut' }, eintraege.map((e) => (e.status === 'abgeschlossen' ? stern() : sternLeer())), `${geschafft} von ${eintraege.length} Orten geschafft`),
      h('span', { class: 'marke' }, symbol('buch'), `${team.items.length} von ${inhalte.items.length} Sammelstücken`),
      bildBereit ? h('a', { class: 'marke warten', href: '#/bild' }, symbol('bild'), team.bild ? 'Euer Bild ansehen' : 'Jetzt euer Bild gestalten') : null),
    zeichneKarte(eintraege, (id) => navigiere(`/ort/${id}`)),
    h('h2', {}, 'Alle Orte'),
    h('ul', { class: 'ortsliste' }, eintraege.map((e) => h('li', {},
      h('button', { type: 'button', class: `ortskarte ${e.farbe}`, onclick: () => navigiere(`/ort/${e.ort.id}`) },
        h('img', { src: url(e.ort.bild), alt: '', loading: 'lazy' }),
        h('span', { class: 'text' },
          h('strong', {}, `${e.nummer}. ${e.ort.name}`),
          h('span', { class: 'leise' }, `${e.ort.region}${e.finale ? ' · Abschluss' : ''}`),
          h('span', { class: `marke${e.status === 'abgeschlossen' ? ' gut' : e.status === 'begonnen' ? ' warten' : ''}` },
            `${STATUS_TEXT[e.status]} · ${e.fertig} von ${e.aufgaben.length} Aufgaben`)),
        e.status === 'abgeschlossen' ? stempel() : null)))),
  );
  return team.modus === 'schule' ? team.freigabe.titel : 'Karte';
}
