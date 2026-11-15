// Familienmodus: ohne Anmeldung, frei gewählter Teamname, nichts verlässt das Gerät.

import { h, leere, knopf, symbol } from '../ui.js';
import { t } from '../einstellungen.js';
import { neuesTeam } from '../spielstand.js';
import { pruefeTeamname } from '../kern/namen.js';

const IDEEN = ['Die Spurenfinder', 'Elbpiraten', 'Team Sandstein', 'Die Bergfüchse', 'Burgfräuleins & Co.', 'Die Entdecker'];

export async function zeige({ haupt, navigiere }) {
  const feld = h('input', { id: 'teamname', type: 'text', maxlength: '30', autocomplete: 'off', 'aria-describedby': 'teamname-hilfe teamname-fehler', required: true });
  const fehler = h('p', { id: 'teamname-fehler', class: 'hinweisfeld fehler', role: 'alert', hidden: true });
  const sende = async (ev) => {
    ev.preventDefault();
    const p = pruefeTeamname(feld.value);
    if (!p.ok) { fehler.textContent = p.fehler; fehler.hidden = false; feld.focus(); return; }
    await neuesTeam({ modus: 'familie', name: p.name });
    const zurueck = sessionStorage.getItem('spur-nach-start');
    sessionStorage.removeItem('spur-nach-start');
    if (zurueck) location.hash = zurueck; else navigiere('/karte');
  };
  leere(haupt,
    h('h1', { 'data-vorlesen': '' }, 'Als Familie oder Gruppe'),
    h('p', { 'data-vorlesen': '' }, t({
      standard: 'Ihr braucht kein Konto. Wählt einen Teamnamen; er bleibt nur auf diesem Gerät und wird nirgends hingeschickt.',
      einfach: 'Ihr braucht keine Anmeldung. Denkt euch einen Namen für euer Team aus. Der Name bleibt auf diesem Gerät.',
    })),
    h('form', { class: 'karte', onsubmit: sende, novalidate: true },
      h('div', { class: 'feld' }, h('label', { for: 'teamname' }, 'Teamname'), feld,
        h('p', { class: 'erklaerung', id: 'teamname-hilfe' }, 'Ein Fantasiename reicht, zum Beispiel:')),
      h('div', { class: 'wahl', stil: { 'margin-bottom': '14px' } }, IDEEN.map((idee) => h('button', { type: 'button', class: 'knopf leise', onclick: () => { feld.value = idee; feld.focus(); } }, idee))),
      fehler,
      h('div', { class: 'knopfreihe' }, knopf('Los geht’s', null, { typ: 'submit', art: 'gross', sym: 'weiter' }), h('a', { href: '#/' }, 'Zurück'))),
    h('p', { class: 'leise' }, symbol('info'), ' Spielstand und Sammelstücke bleiben auf diesem Gerät. Euer Bild schickt ihr nur, wenn ihr es selbst für die Ausstellung freigebt.'),
  );
  return 'Als Familie spielen';
}
