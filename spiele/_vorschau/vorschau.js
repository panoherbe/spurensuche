// Testseite der Spiele: Liste aller Aufgaben und ein einzelnes Spiel mit einstellbarer Umgebung.
// Prüft beim Start die Aufgabe gegen das Schema ihres Formats und am Ende jedes Ereignis gegen die Schnittstelle.
// Für Messläufe stehen Ergebnis und Prüfung in window.spielTest bereit.

import { pruefeSchema } from '../_gemeinsam/schema.js';
import { ereignisFehler } from '../_gemeinsam/protokoll.js';

const WURZEL = new URL('../../', import.meta.url);
const lade = async (pfad) => {
  const antwort = await fetch(new URL(pfad, WURZEL));
  if (!antwort.ok) throw new Error(`${pfad}: HTTP ${antwort.status}`);
  return antwort.json();
};
const el = (tag, eigenschaften = {}, ...kinder) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(eigenschaften)) e.setAttribute(k, v);
  e.append(...kinder);
  return e;
};

async function liste() {
  const ziel = document.getElementById('vs-liste');
  const { orte } = await lade('inhalte/orte.json');
  for (const id of orte) {
    const ort = await lade(`inhalte/${id}/ort.json`);
    const eintraege = await Promise.all(ort.aufgaben.map(async (nr) => {
      const aufgabe = await lade(`inhalte/${id}/${nr}.json`);
      return el('li', {}, el('a', { href: `spiel.html?a=${id}/${nr}` }, aufgabe.titel), ` (${aufgabe.format})`);
    }));
    ziel.append(el('li', { class: 'vs-ort' },
      el('img', { src: new URL(ort.bild, WURZEL).href, alt: ort.alt }),
      el('h2', {}, `${ort.name}`),
      el('p', {}, ort.region),
      el('ol', {}, ...eintraege)));
  }
}

async function spiel() {
  const parameter = new URLSearchParams(location.search);
  const formular = document.getElementById('vs-regler');
  const aufgabeId = parameter.get('a') ?? 'bastei/1';
  for (const name of ['sprache', 'tempo']) if (parameter.has(name)) formular.elements[name].value = parameter.get(name);
  for (const name of ['kontrast', 'ruhig', 'dunkel']) formular.elements[name].checked = parameter.get(name) === '1';
  formular.addEventListener('submit', (ereignis) => {
    ereignis.preventDefault();
    const neu = new URLSearchParams({ a: aufgabeId, sprache: formular.elements.sprache.value, tempo: formular.elements.tempo.value });
    for (const name of ['kontrast', 'ruhig', 'dunkel']) if (formular.elements[name].checked) neu.set(name, '1');
    location.search = neu.toString();
  });

  const kontrast = parameter.get('kontrast') === '1';
  const ruhig = parameter.get('ruhig') === '1';
  if (kontrast) document.documentElement.dataset.kontrast = 'hoch';
  if (ruhig) document.documentElement.dataset.bewegung = 'reduziert';
  if (parameter.get('dunkel') === '1') document.documentElement.dataset.thema = 'dunkel';

  const ausgabe = document.getElementById('vs-ausgabe');
  const pruefung = document.getElementById('vs-pruefung');
  const gemeldet = [];
  const test = { aufgabe: aufgabeId, gemeldet, schemaFehler: null, ergebnis: null, ereignisFehler: null, fertig: false, fehler: null };
  window.spielTest = test;
  const zeige = () => { ausgabe.textContent = JSON.stringify({ gemeldet, ergebnis: test.ergebnis }, null, 2); };

  try {
    const [ort, nr] = aufgabeId.split('/');
    const aufgabe = await lade(`inhalte/${ort}/${nr}.json`);
    document.getElementById('vs-titel').textContent = `Spiel testen: ${aufgabe.titel}`;
    document.title = `${aufgabe.titel} – Spiel testen`;
    const schema = await lade(`spiele/${aufgabe.format}/schema.json`);
    test.schemaFehler = pruefeSchema(schema, aufgabe);
    pruefung.textContent = test.schemaFehler.length ? `Schema: ${test.schemaFehler.length} Fehler` : 'Schema: gültig';
    if (test.schemaFehler.length) pruefung.className = 'vs-fehler';

    const modul = await import(new URL(`spiele/${aufgabe.format}/index.js`, WURZEL).href);
    const steuerung = new AbortController();
    window.spielAbbrechen = () => steuerung.abort();
    const wurzel = document.getElementById('wurzel');
    const ergebnis = await modul.starte(wurzel, aufgabe, {
      sprache: parameter.get('sprache') === 'einfach' ? 'einfach' : 'standard',
      tempo: Number(parameter.get('tempo') ?? 1),
      hoherKontrast: kontrast,
      reduzierteBewegung: ruhig,
      melde: (ereignis) => { gemeldet.push(ereignis); zeige(); },
      signal: steuerung.signal,
    });
    test.ergebnis = ergebnis;
    test.ereignisFehler = ergebnis.ereignisse.map(ereignisFehler).filter(Boolean);
    // Strom über melde(): jedes Ereignis { art, zeit, wert } mit zeit als Zahl, und genau die Ereignisse des Ergebnisses
    for (const e of gemeldet) {
      if (typeof e.zeit !== 'number' || !Number.isFinite(e.zeit)) test.ereignisFehler.push(`melde() ohne zeit: ${e.art}`);
      const f = ereignisFehler(e);
      if (f) test.ereignisFehler.push(`melde(): ${f}`);
    }
    if (JSON.stringify(gemeldet) !== JSON.stringify(ergebnis.ereignisse)) test.ereignisFehler.push('melde() und ergebnis.ereignisse weichen ab');
    const unbekannt = ergebnis.items.filter((id) => !aufgabe.belohnung.includes(id));
    if (unbekannt.length) test.ereignisFehler.push(`items außerhalb der Belohnung: ${unbekannt.join(', ')}`);
    pruefung.textContent += test.ereignisFehler.length ? ` · Ergebnis: ${test.ereignisFehler.join('; ')}` : ' · Ergebnis: passt zur Schnittstelle';
    wurzel.replaceChildren(el('p', {}, 'Spiel beendet. Mit „Neu starten“ beginnt es von vorn.'));
    zeige();
  } catch (fehler) {
    test.fehler = String(fehler?.message ?? fehler);
    pruefung.className = 'vs-fehler';
    pruefung.textContent = `Fehler: ${test.fehler}`;
    console.error(fehler);
  } finally {
    test.fertig = true;
  }
}

if (document.body.dataset.seite === 'liste') liste();
else spiel();
