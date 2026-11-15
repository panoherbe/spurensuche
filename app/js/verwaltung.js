// Verwaltung des Betriebs: Zustand, Zugangsschlüssel für Lehrkräfte, Archiv und Übergabe, QR-Schilder, Protokoll.
// Sieht keine Lerngruppen und keine Beobachtungen.

import { h, leere, knopf, link, melde, seitenwechsel, herunterladen, formatiereBytes } from './ui.js';
import { ladeEinstellungen } from './einstellungen.js';
import { holeApi } from './api.js';
import { ladeInhalte } from './inhalte.js';
import { datumZeit } from './kern/zeit.js';
import { qrSchilder } from './qr-bogen.js';

const haupt = document.getElementById('inhalt');
await ladeEinstellungen();
const api = await holeApi();
const inhalte = await ladeInhalte();

function anmeldung(fehler = null) {
  const feld = h('input', { id: 'v-schluessel', type: 'text', autocomplete: 'off', spellcheck: 'false' });
  const meldung = h('p', { class: 'hinweisfeld fehler', role: 'alert', hidden: !fehler }, fehler ?? '');
  leere(haupt, h('h1', {}, 'Verwaltung'), h('form', { class: 'karte', onsubmit: async (ev) => {
    ev.preventDefault();
    try { await api.anmeldenVerwaltung(feld.value); await zeige(); } catch (e) { meldung.textContent = e.message; meldung.hidden = false; }
  } }, h('div', { class: 'feld' }, h('label', { for: 'v-schluessel' }, 'Schlüssel der Verwaltung'), feld), meldung, knopf('Anmelden', null, { typ: 'submit' })));
  seitenwechsel('Verwaltung – Spurensuche', haupt);
}

async function zeige() {
  let u;
  try { u = await api.uebersicht(); } catch (e) { if (e.status === 401) { anmeldung(); return; } throw e; }
  const schluessel = await api.zugangsschluessel();
  const protokoll = await api.protokoll();
  const kachel = (wert, text) => h('div', { class: 'kachel' }, h('span', { class: 'wert' }, String(wert)), text);
  const neu = h('input', { id: 'v-bez', type: 'text', maxlength: '60', placeholder: 'z. B. Pilotschule 1, Lehrkraft 3' });
  leere(haupt,
    h('h1', {}, 'Verwaltung'),
    h('section', { class: 'kacheln', 'aria-label': 'Zustand' },
      kachel(u.version, 'Version der Anwendung'), kachel(u.inhaltVersion, `Inhalte (${u.inhaltFehler.length} Fehler)`),
      kachel(formatiereBytes(u.offline.gesamtBytes), `Offline-Paket, ${u.offline.dateien} Dateien`),
      kachel(u.anzahl.gruppen, 'Gruppen'), kachel(u.anzahl.bildbeitraegeFreigegeben, 'freigegebene Bildbeiträge'),
      kachel(u.letzteSicherung ? datumZeit(u.letzteSicherung) : 'noch keine', 'letzte Sicherung')),
    u.inhaltFehler.length ? h('div', { class: 'hinweisfeld fehler' }, h('strong', {}, 'Inhaltsfehler:'), h('ul', {}, u.inhaltFehler.slice(0, 20).map((f) => h('li', {}, `${f.datei} ${f.pfad}: ${f.meldung}`)))) : null,
    h('section', { class: 'karte' }, h('h2', {}, 'Archiv und Übergabe'),
      h('p', {}, 'Paket nach BagIt (RFC 8493) mit SHA-256 je Datei. „Archiv“: Inhalte, Konfiguration, freigegebene Bildbeiträge, ohne Personendaten. „Vollständig“: zusätzlich Lerngruppen, Quests, Gruppen und Beobachtungen als JSON und CSV.'),
      h('div', { class: 'knopfreihe' }, link('Archiv herunterladen', api.archivUrl('archiv'), { sym: 'herunter' }), link('Vollständigen Export herunterladen', api.archivUrl('vollstaendig'), { art: 'zweit', sym: 'herunter' }))),
    h('section', { class: 'karte' }, h('h2', {}, 'QR-Schilder'),
      h('p', {}, `${inhalte.orte.length} Orte, ein Schild je Seite (A4), mit Code zum Eintippen.`),
      knopf('QR-Schilder als PDF', () => herunterladen(qrSchilder(inhalte.orte, new URL('./', document.baseURI).href), 'qr-schilder-spurensuche.pdf', 'application/pdf'), { art: 'zweit', sym: 'qr' })),
    h('section', { class: 'karte' }, h('h2', {}, 'Zugangsschlüssel für Lehrkräfte'),
      h('p', { class: 'leise' }, 'Für die Erprobung ohne Schulanmeldung. Der Schlüssel erscheint nur einmal.'),
      h('form', { onsubmit: async (ev) => {
        ev.preventDefault();
        try {
          const r = await api.zugangsschluesselAnlegen(neu.value);
          await zeige();
          melde(`Neuer Schlüssel: ${r.schluessel}`, { dauer: 30000 });
        } catch (e) { melde(e.message); }
      } }, h('div', { class: 'feld' }, h('label', { for: 'v-bez' }, 'Bezeichnung'), neu), knopf('Schlüssel anlegen', null, { typ: 'submit' })),
      schluessel.length ? h('div', { class: 'tabelle-rahmen', stil: { 'margin-top': '12px' } }, h('table', {},
        h('thead', {}, h('tr', {}, ['Bezeichnung', 'Angelegt', 'Zustand', ''].map((x) => h('th', { scope: 'col' }, x)))),
        h('tbody', {}, schluessel.map((z) => h('tr', {}, h('th', { scope: 'row' }, z.bezeichnung), h('td', {}, datumZeit(z.erstellt)), h('td', {}, z.gesperrt ? 'gesperrt' : 'aktiv'),
          h('td', {}, knopf(z.gesperrt ? 'Entsperren' : 'Sperren', async () => { await api.zugangsschluesselSperren(z.id, !z.gesperrt); zeige(); }, { art: 'leise' }))))))) : null),
    h('section', { class: 'karte' }, h('h2', {}, 'Inhalte'),
      knopf('Inhalte neu laden und prüfen', async () => { const r = await api.inhalteNeuLaden(); melde(`Inhalte ${r.inhaltVersion}: ${r.fehler.length} Fehler`); zeige(); }, { art: 'leise' })),
    h('section', { class: 'karte' }, h('h2', {}, 'Protokoll (ohne Personendaten)'),
      h('div', { class: 'tabelle-rahmen' }, h('table', {}, h('thead', {}, h('tr', {}, ['Zeit', 'Rolle', 'Aktion', 'Ziel'].map((x) => h('th', { scope: 'col' }, x)))),
        h('tbody', {}, protokoll.slice(0, 50).map((p) => h('tr', {}, h('td', {}, datumZeit(p.zeit)), h('td', {}, p.rolle), h('td', {}, p.aktion), h('td', {}, p.ziel ?? '')))))))
  );
  seitenwechsel('Verwaltung – Spurensuche', haupt);
}

zeige();
