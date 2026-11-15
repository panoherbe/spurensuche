// Sammelbuch: je Ort eine Seite in seiner Farbe. Gefundene Sammelstücke kleben als Sticker, offene Plätze zeigen
// das Stück als Schattenbild. Was gerade neu dazukam, klebt sich beim Öffnen sichtbar ein.

import { h, leere } from '../ui.js';
import { t } from '../einstellungen.js';
import { url, aufgabenVon } from '../inhalte.js';
import { aktuellesTeam, orteDesTeams } from '../spielstand.js';
import { ortFarbe } from '../zeichnungen.js';

/** Kennungen der Sammelstücke, die seit dem letzten Blick ins Sammelbuch dazukamen (nur für die Anzeige). */
function neueStuecke() {
  try {
    const neu = JSON.parse(sessionStorage.getItem('spur-neu-im-buch') ?? '[]');
    sessionStorage.removeItem('spur-neu-im-buch');
    return new Set(Array.isArray(neu) ? neu : []);
  } catch { return new Set(); }
}

export async function zeige({ haupt, inhalte }) {
  const team = aktuellesTeam();
  const neu = neueStuecke();
  const seiten = [];
  const zugeordnet = new Set();
  for (const { ort, aufgaben } of orteDesTeams(inhalte)) {
    const ids = [];
    for (const a of await aufgabenVon(ort, aufgaben).catch(() => [])) {
      for (const id of a.belohnung ?? []) if (!zugeordnet.has(id)) { zugeordnet.add(id); ids.push(id); }
    }
    const items = inhalte.items.filter((i) => ids.includes(i.id));
    if (items.length) seiten.push({ ort, items });
  }
  const sonst = inhalte.items.filter((i) => team.items.includes(i.id) && !zugeordnet.has(i.id));
  if (sonst.length) seiten.push({ ort: null, items: sonst });
  const alle = seiten.flatMap((s) => s.items);
  const gesammelt = alle.filter((i) => team.items.includes(i.id)).length;

  const stueck = (i, ort) => {
    const hat = team.items.includes(i.id);
    return h('li', { class: `sammelstueck${hat ? '' : ' offen'}${hat && neu.has(i.id) ? ' neu' : ''}` },
      hat && neu.has(i.id) ? h('span', { class: 'neu-marke' }, 'Neu!') : null,
      h('span', { class: 'platz' }, h('img', { src: url(i.bild), alt: hat ? i.alt : '' })),
      h('strong', {}, hat ? i.name : 'Noch offen'),
      hat ? null : h('span', { class: 'leise' }, `zu finden: ${ort?.name ?? '–'}`));
  };

  leere(haupt,
    h('div', { class: 'album-kopf' }, h('h1', { 'data-vorlesen': '' }, 'Sammelbuch'), h('span', { class: 'album-zahl', 'aria-hidden': 'true' }, `${gesammelt} / ${alle.length}`)),
    h('p', { 'data-vorlesen': '' }, t({
      standard: `${gesammelt} von ${alle.length} Sammelstücken gefunden. Jedes Stück gibt es für eine bestimmte Aufgabe; nichts ist Zufall.`,
      einfach: `Ihr habt ${gesammelt} von ${alle.length} Dingen gefunden. Jedes Ding gibt es bei einer Aufgabe.`,
    })),
    seiten.map(({ ort, items }) => {
      const hat = items.filter((i) => team.items.includes(i.id)).length;
      return h('section', { class: `album-seite ${ort ? ortFarbe(inhalte, ort.id) : ''}`.trim() },
        h('h2', {}, ort ? ort.name : 'Außerdem gefunden', h('span', { class: 'zahl' }, `${hat} von ${items.length}`)),
        h('ul', { class: 'sammelbuch' }, items.map((i) => stueck(i, ort))));
    }),
  );
  return 'Sammelbuch';
}
