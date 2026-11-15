// Startseite: mit der Klasse (Code) oder als Familie (Teamname). Läuft schon ein Team, geht es weiter.

import { h, leere, symbol, frage } from '../ui.js';
import { t } from '../einstellungen.js';
import { aktuellesTeam, teamVerlassen } from '../spielstand.js';
import { himmel, wappen, BEISPIEL_TIERE } from '../zeichnungen.js';

export async function zeige({ haupt, navigiere, inhalte, api }) {
  const team = aktuellesTeam();
  const anzahl = inhalte.orte.length;
  leere(haupt,
    h('section', { class: 'start-buehne' }, himmel(),
      h('div', { class: 'start-text' },
        h('h1', { 'data-vorlesen': '' }, 'Spurensuche Sachsen'),
        h('p', { class: 'start-satz', 'data-vorlesen': '' }, t({
          standard: `Entdeckt ${anzahl} Orte, löst Rätsel im Team und findet Sammelstücke für euer eigenes Bild.`,
          einfach: `Ihr entdeckt ${anzahl} Orte. Ihr löst Rätsel im Team. Ihr sammelt Dinge für ein Bild.`,
        })),
        h('p', { class: 'start-marken', 'data-vorlesen': '' }, h('span', { class: 'marke' }, 'vor Ort oder in der Schule'), ' ', h('span', { class: 'marke' }, 'auch ohne Netz'))),
      h('div', { class: 'start-wiese', 'aria-hidden': 'true' }, BEISPIEL_TIERE.map((tier) => wappen(tier)))),
    team ? h('div', { class: 'karte', stil: { 'margin-bottom': '18px' } },
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
      h('a', { class: 'wahlkarte klasse', href: '#/beitritt' }, symbol('schule'), h('strong', { 'data-vorlesen': '' }, 'Mit der Klasse'),
        h('span', { 'data-vorlesen': '' }, t({ standard: 'Mit dem Code von eurer Lehrkraft. Ohne Namen.', einfach: 'Ihr habt einen Code von der Lehrkraft. Ihr braucht keine Namen.' }))),
      h('a', { class: 'wahlkarte familie', href: '#/familie' }, symbol('familie'), h('strong', { 'data-vorlesen': '' }, 'Als Familie oder Gruppe'),
        h('span', { 'data-vorlesen': '' }, t({ standard: 'Ohne Anmeldung. Denkt euch einen Teamnamen aus.', einfach: 'Ihr braucht keine Anmeldung. Ihr denkt euch einen Teamnamen aus.' })))),
    h('nav', { class: 'fusslinks', 'aria-label': 'Weitere Seiten' },
      h('a', { href: 'lehrkraefte.html' }, 'Für Lehrkräfte'),
      h('a', { href: '#/datenschutz' }, 'Datenschutz'),
      h('a', { href: '#/info' }, 'Über die Spurensuche')),
    api.vorfuehrung ? h('p', { class: 'hinweisfeld', stil: { 'margin-top': '18px' } }, 'Vorführung: Alles läuft in diesem Browser, ohne Server. Mit der Klasse spielt ihr mit dem Code ', h('strong', {}, 'DEMO-2026'), '; die Lehrkräfte-Ansicht zeigt den Fortschritt live.') : null,
  );
  return '';
}
