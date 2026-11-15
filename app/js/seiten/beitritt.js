// Beitritt einer Schulgruppe mit dem Code der Lehrkraft (optional nach Anmeldung mit dem Schulkonto).

import { h, leere, knopf, symbol } from '../ui.js';
import { t } from '../einstellungen.js';
import { neuesTeam } from '../spielstand.js';
import { bald } from '../sync.js';

const FEHLER = {
  'nicht-erreichbar': 'Die Schulanmeldung ist gerade nicht erreichbar. Wenn ihr schon einen Code habt, könnt ihr ihn direkt eingeben.',
  rolle: 'Die Anmeldung hat keine passende Rolle geliefert. Bitte die Lehrkraft fragen.',
  token: 'Die Anmeldung konnte nicht geprüft werden. Bitte noch einmal versuchen.',
};

export async function zeige({ haupt, api, konfig, navigiere, params }) {
  const fehler = params.get('fehler');
  const feld = h('input', { id: 'code', type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '9', placeholder: 'ABCD-EFGH', 'aria-describedby': 'code-hilfe code-fehler', required: true });
  const meldung = h('p', { id: 'code-fehler', class: 'hinweisfeld fehler', role: 'alert', hidden: true });
  feld.addEventListener('input', () => {
    const roh = feld.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    feld.value = roh.length > 4 ? `${roh.slice(0, 4)}-${roh.slice(4)}` : roh;
  });
  const sende = async (ev) => {
    ev.preventDefault();
    meldung.hidden = true;
    try {
      const r = await api.beitritt(feld.value);
      await neuesTeam({ modus: 'schule', name: r.gruppe.bezeichnung, token: r.token, freigabe: r.freigabe });
      bald();
      leere(haupt, h('div', { class: 'karte feier' }, symbol('haken'),
        h('h1', { 'data-vorlesen': '' }, `Ihr seid Gruppe ${r.gruppe.bezeichnung}`),
        h('p', { 'data-vorlesen': '' }, `Quest: ${r.freigabe.titel} · ${r.freigabe.orte.length} ${r.freigabe.orte.length === 1 ? 'Ort' : 'Orte'}`),
        r.freigabe.erfassung ? null : h('p', { class: 'leise' }, 'Für diese Quest wird nichts ausgewertet; ihr spielt frei.'),
        h('div', { class: 'knopfreihe', stil: { 'justify-content': 'center' } }, h('a', { class: 'knopf gross', href: '#/karte' }, symbol('karte'), 'Zur Karte'))));
      document.title = `Gruppe ${r.gruppe.bezeichnung} – Spurensuche Sachsen`;
      haupt.querySelector('h1')?.focus();
    } catch (e) {
      meldung.textContent = e.offline ? 'Für den Beitritt braucht das Gerät einmal Netz. Danach geht alles auch offline.' : e.message;
      meldung.hidden = false;
      feld.focus();
    }
  };
  leere(haupt,
    h('div', { class: 'seitenkopf' }, h('div', {}, h('h1', { 'data-vorlesen': '' }, 'Mit der Klasse spielen'),
      h('p', { class: 'leise', 'data-vorlesen': '' }, t({ standard: 'Eure Lehrkraft gibt euch einen Code für eure Gruppe.', einfach: 'Ihr bekommt einen Code von der Lehrkraft.' })))),
    fehler ? h('p', { class: 'hinweisfeld fehler', role: 'alert' }, FEHLER[fehler] ?? 'Die Anmeldung hat nicht geklappt.') : null,
    konfig?.anmeldung?.anmeldedienst ? h('div', { class: 'karte' },
      h('h2', {}, 'Mit dem Schulkonto'),
      h('p', { class: 'leise' }, konfig.lernendeAnmeldung === 'pflicht' ? 'Zuerst mit dem Schulkonto anmelden, dann den Code eingeben.' : 'Wenn eure Schule es so eingerichtet hat. Es wird dabei nichts über euch gespeichert.'),
      h('a', { class: 'knopf zweit', href: api.anmeldedienstUrl('lernende') }, symbol('schloss'), 'Mit Schulkonto anmelden')) : null,
    h('form', { class: 'karte', onsubmit: sende, novalidate: true },
      h('div', { class: 'feld' }, h('label', { for: 'code' }, 'Code der Gruppe'), feld,
        h('p', { class: 'erklaerung', id: 'code-hilfe' }, 'Acht Zeichen, zum Beispiel K7QH-M3PZ. Groß- und Kleinschreibung ist egal.')),
      meldung,
      h('div', { class: 'knopfreihe' }, knopf('Beitreten', null, { typ: 'submit', art: 'gross', sym: 'weiter' }), h('a', { href: '#/' }, 'Zurück'))),
    h('p', { class: 'leise' }, t({ standard: 'Es werden keine Namen gespeichert. Bezugspunkt ist nur der Gruppenname.', einfach: 'Eure Namen werden nicht gespeichert.' })),
  );
  if (params.get('code')) feld.value = String(params.get('code')).toUpperCase().slice(0, 9); // vom QR-Code der Lehrkraft
  else if (api.vorfuehrung) feld.value = 'DEMO-2026';
  return 'Mit der Klasse';
}
