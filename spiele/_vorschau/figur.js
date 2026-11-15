// Testseite des Figur-Baukastens. Ergebnis für den Messlauf in window.figurTest.
import { starteGestaltung } from '../figur/index.js';
const WURZEL = new URL('../../', import.meta.url);
const lade = async (p) => (await fetch(new URL(p, WURZEL))).json();
const [katalog, items] = await Promise.all([lade('inhalte/figur.json'), lade('inhalte/items.json')]);
const parameter = new URLSearchParams(location.search);
if (parameter.get('kontrast') === '1') document.documentElement.dataset.kontrast = 'hoch';
if (parameter.get('dunkel') === '1') document.documentElement.dataset.thema = 'dunkel';
window.figurTest = { fertig: false };
const auswahl = await starteGestaltung(document.getElementById('wurzel'), {
  katalog, items, freigeschaltet: ['abzeichen-bastei', 'felsturm'], auswahl: {},
  umgebung: { sprache: parameter.get('sprache') === 'einfach' ? 'einfach' : 'standard', hoherKontrast: parameter.get('kontrast') === '1' },
});
document.getElementById('fi-ausgabe').textContent = JSON.stringify(auswahl, null, 2);
Object.assign(window.figurTest, { fertig: true, auswahl });
