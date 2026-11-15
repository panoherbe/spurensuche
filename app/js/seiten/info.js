// Über die Spurensuche: Version, Lizenzen, Quellen, Offline-Stand.

import { h, leere, formatiereBytes } from '../ui.js';
import { KARTE } from '../karte-daten.js';

export async function zeige({ haupt, konfig, api }) {
  let liste = null;
  try { liste = await (await fetch(new URL('offline-liste.json', document.baseURI), { cache: 'no-cache' })).json(); } catch { /* offline */ }
  let gespeichert = null;
  try { const s = await navigator.storage?.estimate?.(); gespeichert = s?.usage ?? null; } catch { /* nicht verfügbar */ }
  leere(haupt,
    h('h1', {}, 'Über die Spurensuche'),
    h('section', { class: 'karte' },
      h('h2', {}, 'Stand'),
      h('ul', {},
        h('li', {}, `Version ${konfig?.version ?? '–'}${api.vorfuehrung ? ' (Vorführung ohne Server)' : ''}`),
        h('li', {}, `Inhalte ${konfig?.inhaltVersion ?? '–'}`),
        liste ? h('li', {}, `Offline-Paket: ${liste.dateien.length} Dateien, ${formatiereBytes(liste.gesamtBytes)}`) : null,
        gespeichert !== null ? h('li', {}, `Auf diesem Gerät belegt: ${formatiereBytes(gespeichert)}`) : null)),
    h('section', { class: 'karte' },
      h('h2', {}, 'Lizenzen'),
      h('ul', {},
        h('li', {}, 'Programmcode: GNU Affero General Public License 3.0 (AGPL-3.0-only), frei nutzbar und veränderbar.'),
        h('li', {}, 'Texte, Aufgaben und Bilder: Creative Commons BY-SA 4.0, als offene Bildungsmaterialien weiterverwendbar.'),
        h('li', {}, KARTE.quelle))),
  );
  return 'Über die Spurensuche';
}
