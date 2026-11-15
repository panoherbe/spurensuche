// Werkstatt: ein Spiel einzeln starten, Umgebung einstellen, Ereignisse mitlesen, Ergebnis gegen den Vertrag prüfen.

import { h, leere, knopf } from './ui.js';
import { ladeEinstellungen, aendere } from './einstellungen.js';
import { vorlesen, setzeTempoQuelle } from './vorlesen.js';
import { ladeInhalte, aufgabe as ladeAufgabe, url, alsDatei } from './inhalte.js';
import { pruefeErgebnis, pruefeModul, bereinigeEreignisse } from './kern/ereignisse.js';
import { pruefeSchema } from './kern/schema.js';
import { AUFGABE_GEMEINSAM } from './kern/inhalte.js';

const haupt = document.getElementById('inhalt');
await ladeEinstellungen();
const inhalte = await ladeInhalte();
const kennungen = inhalte.orte.flatMap((o) => o.aufgaben.map((nr) => `${o.id}/${nr}`));
const params = new URLSearchParams(location.search);

const wahl = h('select', { id: 'w-aufgabe' }, kennungen.map((k) => h('option', { value: k, selected: k === params.get('aufgabe') }, k)));
const sprache = h('select', { id: 'w-sprache' }, h('option', { value: 'standard' }, 'Standard'), h('option', { value: 'einfach' }, 'Einfache Sprache'));
const tempo = h('input', { id: 'w-tempo', type: 'range', min: '0.5', max: '1.5', step: '0.1', value: '1' });
const kontrast = h('input', { type: 'checkbox', id: 'w-kontrast' });
const bewegung = h('input', { type: 'checkbox', id: 'w-bewegung' });
const rollen = h('input', { type: 'checkbox', id: 'w-rollen', checked: true });
const wurzelRahmen = h('div', { class: 'aufgabe-rahmen' });
const protokoll = h('pre', { class: 'karte', stil: { 'white-space': 'pre-wrap', 'font-size': '0.85rem', 'max-height': '24rem', overflow: 'auto' } });
const bericht = h('div', {});
let abbruch = null;
let laufNr = 0;

async function starte() {
  abbruch?.abort();
  abbruch = new AbortController();
  const lauf = ++laufNr;
  leere(protokoll);
  leere(bericht);
  const kennung = wahl.value;
  const aufgabe = alsDatei(await ladeAufgabe(kennung));
  await aendere({ sprache: sprache.value, tempo: Number(tempo.value), kontrast: kontrast.checked ? 'hoch' : 'normal', bewegung: bewegung.checked ? 'reduziert' : 'auto' });
  setzeTempoQuelle(() => Number(tempo.value));
  const fehler = [];
  fehler.push(...pruefeSchema(AUFGABE_GEMEINSAM, aufgabe).map((f) => `Aufgabe ${f.pfad}: ${f.meldung}`));
  let modul;
  try {
    modul = await import(url(`spiele/${aufgabe.format}/index.js`));
    fehler.push(...pruefeModul(modul, aufgabe.format));
    const schema = await (await fetch(url(`spiele/${aufgabe.format}/schema.json`))).json();
    fehler.push(...pruefeSchema(schema, aufgabe).map((f) => `Schema ${f.pfad}: ${f.meldung}`));
  } catch (e) { fehler.push(`Modul nicht ladbar: ${e.message}`); }
  const wurzel = h('section', { class: 'spiel-wurzel', 'aria-label': `Spiel ${aufgabe.titel}` });
  leere(wurzelRahmen, h('h1', {}, aufgabe.titel), wurzel);
  if (!modul?.starte) { leere(bericht, h('p', { class: 'hinweisfeld fehler' }, fehler.join('\n'))); return; }
  const gemeldet = [];
  const umgebung = Object.freeze({
    sprache: sprache.value, vorlesen, tempo: Number(tempo.value), hoherKontrast: kontrast.checked, reduzierteBewegung: bewegung.checked,
    melde: (e) => {
      gemeldet.push(e);
      const { verworfen } = bereinigeEreignisse([e], { aufgabe });
      protokoll.append(`${verworfen.length ? '✗' : '✓'} ${JSON.stringify(e)}${verworfen.length ? `  ← ${verworfen[0].grund}` : ''}\n`);
    },
    signal: abbruch.signal, basisUrl: new URL('./', document.baseURI).href, ton: false,
    rollen: rollen.checked && Array.isArray(aufgabe.rollen) ? aufgabe.rollen : false, katalog: inhalte.items,
  });
  const start = performance.now();
  let roh;
  try { roh = await modul.starte(wurzel, aufgabe, umgebung); } catch (e) { fehler.push(`starte() hat geworfen: ${e.message}`); }
  if (lauf !== laufNr) return; // inzwischen neu gestartet: dieses Ergebnis nicht mehr anzeigen
  const dauer = Math.round(performance.now() - start);
  if (roh) {
    const p = pruefeErgebnis(roh, aufgabe);
    fehler.push(...p.fehler);
    if (JSON.stringify(roh.ereignisse ?? []) !== JSON.stringify(gemeldet)) fehler.push('ergebnis.ereignisse weicht von den gemeldeten Ereignissen ab');
    leere(bericht,
      h('h2', {}, fehler.length ? `${fehler.length} Abweichungen vom Vertrag` : 'Ergebnis passt zum Vertrag'),
      fehler.length ? h('ul', { class: 'hinweisfeld fehler' }, fehler.map((f) => h('li', {}, f))) : h('p', { class: 'hinweisfeld gut' }, `Dauer im Browser: ${dauer} ms; ${p.ergebnis.ereignisse.length} Ereignisse, ${p.ergebnis.items.length} Sammelstücke.`),
      h('pre', { class: 'karte', stil: { 'white-space': 'pre-wrap' } }, JSON.stringify(roh, null, 2)));
  } else leere(bericht, h('ul', { class: 'hinweisfeld fehler' }, fehler.map((f) => h('li', {}, f))));
}

leere(haupt,
  h('div', { class: 'karte' },
    h('div', { class: 'feld' }, h('label', { for: 'w-aufgabe' }, 'Aufgabe'), wahl),
    h('div', { class: 'feld' }, h('label', { for: 'w-sprache' }, 'Sprache'), sprache),
    h('div', { class: 'feld' }, h('label', { for: 'w-tempo' }, 'Tempo'), tempo),
    h('label', { class: 'schalter' }, kontrast, 'Hoher Kontrast'),
    h('label', { class: 'schalter' }, bewegung, 'Reduzierte Bewegung'),
    h('label', { class: 'schalter' }, rollen, 'Mit Rollen'),
    h('div', { class: 'knopfreihe' }, knopf('Starten', starte), knopf('Abbrechen (signal)', () => abbruch?.abort(), { art: 'leise' }))),
  wurzelRahmen,
  h('h2', {}, 'Gemeldete Ereignisse'), protokoll,
  bericht);
if (params.get('aufgabe')) starte();
