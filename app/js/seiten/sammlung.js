// Sammelbuch: alle Sammelstücke; noch offene als Schattenbild mit dem Ort, an dem es sie gibt.

import { h, leere } from '../ui.js';
import { t } from '../einstellungen.js';
import { url, aufgabenVon } from '../inhalte.js';
import { aktuellesTeam, orteDesTeams } from '../spielstand.js';

export async function zeige({ haupt, inhalte }) {
  const team = aktuellesTeam();
  const wo = new Map();
  for (const { ort, aufgaben } of orteDesTeams(inhalte)) {
    for (const a of await aufgabenVon(ort, aufgaben).catch(() => [])) {
      for (const id of a.belohnung ?? []) if (!wo.has(id)) wo.set(id, ort.name);
    }
  }
  const items = inhalte.items.filter((i) => team.items.includes(i.id) || wo.has(i.id));
  const gesammelt = items.filter((i) => team.items.includes(i.id)).length;
  leere(haupt,
    h('h1', { 'data-vorlesen': '' }, 'Sammelbuch'),
    h('p', { 'data-vorlesen': '' }, t({
      standard: `${gesammelt} von ${items.length} Sammelstücken gefunden. Jedes Stück gibt es für eine bestimmte Aufgabe; nichts ist Zufall.`,
      einfach: `Ihr habt ${gesammelt} von ${items.length} Dingen gefunden. Jedes Ding gibt es bei einer Aufgabe.`,
    })),
    h('ul', { class: 'sammelbuch' }, items.map((i) => {
      const hat = team.items.includes(i.id);
      return h('li', { class: `sammelstueck${hat ? '' : ' offen'}` },
        h('img', { src: url(i.bild), alt: hat ? i.alt : '' }),
        h('strong', {}, hat ? i.name : 'Noch offen'),
        h('span', { class: 'leise' }, hat ? i.kategorie : `zu finden: ${wo.get(i.id) ?? '–'}`));
    })),
  );
  return 'Sammelbuch';
}
