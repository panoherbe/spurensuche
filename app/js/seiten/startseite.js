// Startseite: mit der Klasse (Code) oder als Familie (Teamname). Läuft schon ein Team, geht es weiter.

import { h, leere, symbol, frage } from '../ui.js';
import { t } from '../einstellungen.js';
import { aktuellesTeam, teamVerlassen } from '../spielstand.js';
import { KARTE } from '../karte-daten.js';

function silhouette() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', `0 0 ${KARTE.breite} ${KARTE.hoehe}`);
  s.setAttribute('class', 'silhouette');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', KARTE.sachsen);
  s.append(p);
  return s;
}

export async function zeige({ haupt, navigiere, inhalte, api }) {
  const team = aktuellesTeam();
  const anzahl = inhalte.orte.length;
  leere(haupt,
    h('section', { class: 'start-buehne' }, silhouette(),
      h('h1', { 'data-vorlesen': '' }, 'Spurensuche Sachsen'),
      h('p', { 'data-vorlesen': '' }, t({
        standard: `Entdeckt ${anzahl} Orte in Sachsen, löst kurze Rätsel im Team und sammelt Spuren für euer eigenes Bild. Vor Ort oder im Klassenzimmer, auch ohne Netz.`,
        einfach: `Ihr entdeckt ${anzahl} Orte in Sachsen. Ihr löst Rätsel im Team. Ihr sammelt Dinge für ein Bild. Das geht vor Ort und in der Schule.`,
      }))),
    team ? h('div', { class: 'karte', stil: { 'margin-bottom': '14px' } },
      h('p', { 'data-vorlesen': '' }, `Auf diesem Gerät spielt gerade ${team.modus === 'schule' ? 'die Gruppe' : 'das Team'} „${team.name}“.`),
      h('div', { class: 'knopfreihe' },
        h('a', { class: 'knopf gross', href: '#/karte' }, symbol('karte'), 'Weiterspielen'),
        h('button', { type: 'button', class: 'knopf leise', onclick: async () => {
          if (await frage('Neues Team beginnen?', 'Der Spielstand dieses Teams auf dem Gerät wird gelöscht. Schon übertragene Ergebnisse bleiben bei der Lehrkraft.', { ja: 'Neu beginnen', gefaehrlich: true })) {
            await teamVerlassen();
            navigiere('/');
          }
        } }, 'Anderes Team'))) : null,
    h('h2', { 'data-vorlesen': '' }, t({ standard: 'Wie spielt ihr?', einfach: 'Wie spielt ihr?' })),
    h('div', { class: 'wahlkarten' },
      h('a', { class: 'wahlkarte', href: '#/beitritt' }, symbol('schule'), h('strong', { 'data-vorlesen': '' }, 'Mit der Klasse'),
        h('span', { 'data-vorlesen': '' }, t({ standard: 'Code von der Lehrkraft eingeben. Keine Namen nötig.', einfach: 'Ihr gebt den Code von der Lehrkraft ein. Ihr braucht keine Namen.' }))),
      h('a', { class: 'wahlkarte', href: '#/familie' }, symbol('familie'), h('strong', { 'data-vorlesen': '' }, 'Als Familie oder Gruppe'),
        h('span', { 'data-vorlesen': '' }, t({ standard: 'Ohne Anmeldung. Den Teamnamen wählt ihr selbst; er bleibt auf diesem Gerät.', einfach: 'Ihr braucht keine Anmeldung. Ihr denkt euch einen Teamnamen aus. Der Name bleibt auf diesem Gerät.' })))),
    h('nav', { class: 'fusslinks', 'aria-label': 'Weitere Seiten' },
      h('a', { href: 'lehrkraefte.html' }, 'Für Lehrkräfte'),
      h('a', { href: '#/datenschutz' }, 'Datenschutz'),
      h('a', { href: '#/info' }, 'Über die Spurensuche')),
    api.vorfuehrung ? h('p', { class: 'hinweisfeld', stil: { 'margin-top': '18px' } }, 'Vorführung: Alles läuft in diesem Browser, ohne Server. Mit der Klasse spielt ihr mit dem Code ', h('strong', {}, 'DEMO-2026'), '; die Lehrkräfte-Ansicht zeigt den Fortschritt live.') : null,
  );
  return '';
}
