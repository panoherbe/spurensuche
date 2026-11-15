// Die Figur der Gruppe als kleines Bild (Karte, Feier). Gezeichnet vom Modul spiele/figur mit dem Katalog
// inhalte/figur.json. Fehlt eines von beiden im Inhalt (offline-liste.json nennt alle Dateien), gibt es kein Bild
// und auch keine vergebliche Anfrage.

import { h } from './ui.js';
import { url } from './inhalte.js';

let bereit = null;

async function lade() {
  const liste = await (await fetch(url('offline-liste.json'))).json();
  const pfade = new Set((liste.dateien ?? []).map((d) => d.pfad));
  if (!pfade.has('spiele/figur/index.js') || !pfade.has('inhalte/figur.json')) return null;
  const [modul, katalog] = await Promise.all([import(url('spiele/figur/index.js')), fetch(url('inhalte/figur.json')).then((r) => r.json())]);
  return typeof modul.figurSvg === 'function' ? { modul, katalog } : null;
}

/** Bild der Figur zur Auswahl (leer: die Figur mit den Voreinstellungen) oder null. Schmuck: aria-hidden. */
export async function figurBild(auswahl, klasse = 'figur-bild') {
  bereit ??= lade().catch(() => null);
  const f = await bereit;
  if (!f) return null;
  try {
    const svg = document.importNode(new DOMParser().parseFromString(f.modul.figurSvg(auswahl ?? {}, f.katalog), 'image/svg+xml').documentElement, true);
    svg.querySelector('title')?.remove();
    return h('span', { class: klasse, 'aria-hidden': 'true' }, svg);
  } catch {
    return null;
  }
}
