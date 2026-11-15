// Öffentliche Statusseite: Läuft die Spurensuche? Ohne Anmeldung, ohne Zahlen, für Lehrkräfte und den Telefondienst.
// Prüft jede Minute neu; Bildschirmleser hören nur Änderungen.

import { h, leere, link, seitenwechsel, symbol } from './ui.js';
import { ladeEinstellungen } from './einstellungen.js';
import { holeApi } from './api.js';

const haupt = document.getElementById('inhalt');
await ladeEinstellungen();
const api = await holeApi();

const TEXTE = {
  gut: ['haken', 'Die Spurensuche läuft.', 'Alles in Ordnung.'],
  eingeschraenkt: ['warnung', 'Die Spurensuche läuft mit Einschränkungen.', 'Die Anmeldung über das Schulkonto ist gestört. Lehrkräfte können sich mit einem Zugangsschlüssel anmelden; laufende Quests laufen weiter.'],
  stoerung: ['kreuz', 'Störung', 'Die Spurensuche antwortet gerade nicht oder meldet einen Fehler. Geräte speichern Ergebnisse und übertragen sie, sobald es wieder geht. Wir arbeiten daran.'],
};
const DIENST = { gut: 'erreichbar', stoerung: 'gestört', unbekannt: 'wird geprüft', 'nicht-eingerichtet': 'nicht eingerichtet (Anmeldung mit Zugangsschlüssel)' };
let zuletzt = null;

// Feste Bereiche: Die Ansage wird nur bei einer Änderung ersetzt, damit Bildschirmleser nicht jede Minute vorlesen.
const ansage = h('div', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
const liste = h('ul', { class: 'status-liste' });
const zeitZeile = h('p', { class: 'leise-zeile' });
leere(haupt,
  h('h1', {}, 'Zustand der Spurensuche'),
  api.vorfuehrung ? h('p', { class: 'hinweisfeld vorfuehrung-hinweis', role: 'note' }, h('strong', {}, 'Vorführung ohne Server: '), 'Der Zustand ist nachgebildet.') : null,
  ansage, liste, zeitZeile,
  h('div', { class: 'knopfreihe' }, link('Zur Spurensuche', './', { sym: 'karte' }), link('Für Lehrkräfte', 'lehrkraefte.html', { art: 'leise', sym: 'schule' })));
seitenwechsel('Zustand – Spurensuche', haupt);

async function pruefe() {
  let st = null;
  try { st = await api.status(); } catch { /* nicht erreichbar */ }
  const zustand = st?.ok ? st.betrieb?.zustand ?? 'gut' : 'stoerung';
  if (zustand !== zuletzt) {
    const [sym, titel, text] = TEXTE[zustand];
    leere(ansage, h('div', { class: `ampel ${zustand}` }, symbol(sym), h('div', {}, h('h2', {}, titel), h('p', {}, text))));
    zuletzt = zustand;
  }
  leere(liste, st?.ok ? [
    h('li', {}, h('strong', {}, 'Anwendung:'), 'läuft'),
    h('li', {}, h('strong', {}, 'Anmeldung über das Schulkonto:'), DIENST[st.betrieb?.anmeldedienst] ?? 'unbekannt'),
    h('li', {}, h('strong', {}, 'Inhalte:'), st.betrieb?.inhalte === 'stoerung' ? 'gestört' : 'vollständig'),
  ] : []);
  zeitZeile.textContent = `Geprüft um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Uhr. Die Seite prüft jede Minute von selbst.`;
}

await pruefe();
setInterval(() => { if (!document.hidden) pruefe(); }, 60_000);
