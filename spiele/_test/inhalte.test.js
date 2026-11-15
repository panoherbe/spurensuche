// Inhalte gegen Schemas und Schnittstelle prüfen: jede Aufgabe, jeder Ort, jedes Sammelstück, jede Datei.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pruefeSchema, fehlerText } from '../_gemeinsam/schema.js';

const WURZEL = fileURLToPath(new URL('../../', import.meta.url));
const lies = (pfad) => JSON.parse(readFileSync(WURZEL + pfad, 'utf8'));
const KENNUNG = /^[a-z0-9-]{1,40}$/;
const FORMATE = readdirSync(WURZEL + 'spiele', { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(`${WURZEL}spiele/${d.name}/schema.json`)).map((d) => d.name);
const orte = lies('inhalte/orte.json');
const items = lies('inhalte/items.json');
const itemIds = new Set(items.map((i) => i.id));
const aufgaben = orte.orte.flatMap((ort) => lies(`inhalte/${ort}/ort.json`).aufgaben.map((nr) => ({ id: `${ort}/${nr}`, daten: lies(`inhalte/${ort}/${nr}.json`) })));

// Erlaubte Schlüsselwörter laut Schnittstelle Abschnitt 7 (dazu Beschreibungen, die kein Prüfer auswertet)
const ERLAUBT = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'enum', 'const', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', '$ref', '$defs', 'oneOf', '$id', 'title', 'description']);
function schluessel(schema, pfad, fehler) {
  if (Array.isArray(schema)) { schema.forEach((s, i) => schluessel(s, `${pfad}[${i}]`, fehler)); return; }
  if (!schema || typeof schema !== 'object') return;
  for (const [k, v] of Object.entries(schema)) {
    if (!ERLAUBT.has(k)) fehler.push(`${pfad}.${k}`);
    if (k === 'additionalProperties' && v !== false) fehler.push(`${pfad}.additionalProperties ist nicht false`);
    if (k === 'type' && typeof v !== 'string') fehler.push(`${pfad}.type ist keine einzelne Angabe`);
    if (k === 'properties' || k === '$defs') for (const [name, teil] of Object.entries(v)) schluessel(teil, `${pfad}.${k}.${name}`, fehler);
    else if (k === 'items' || k === 'oneOf') schluessel(v, `${pfad}.${k}`, fehler);
  }
}

test('Fünf Formate mit index.js, schema.json, stil.css und README.md', () => {
  assert.deepEqual(FORMATE.sort(), ['bildpuzzle', 'bildsuche', 'dilemma', 'schaetzen', 'sortieren']);
  for (const format of FORMATE) {
    for (const datei of ['index.js', 'schema.json', 'stil.css', 'README.md']) assert.ok(existsSync(`${WURZEL}spiele/${format}/${datei}`), `${format}/${datei}`);
  }
});

test('Schemas nutzen nur die Teilmenge der Schnittstelle (Abschnitt 7)', () => {
  for (const format of FORMATE) {
    const fehler = [];
    schluessel(lies(`spiele/${format}/schema.json`), format, fehler);
    assert.deepEqual(fehler, [], fehler.join('\n'));
  }
});

test('Jede Aufgabe ist gültig gegen das Schema ihres Formats', () => {
  assert.ok(aufgaben.length >= 12);
  for (const { id, daten } of aufgaben) {
    const fehler = pruefeSchema(lies(`spiele/${daten.format}/schema.json`), daten, id);
    assert.deepEqual(fehler, [], fehlerText(fehler));
  }
});

test('Gemeinsame Felder (Schnittstelle 2.2), Belohnungen, Bilder und Zählungen stimmen', () => {
  for (const { id, daten: a } of aufgaben) {
    assert.ok(a.titel.length <= 60, `${id}: Titel zu lang`);
    assert.ok(a.dauerMinuten >= 5 && a.dauerMinuten <= 10, `${id}: Dauer`);
    for (const b of a.belohnung) assert.ok(itemIds.has(b), `${id}: Sammelstück ${b} fehlt in items.json`);
    const bilder = [a.bild?.datei, ...(a.karten ?? []).map((k) => k.bild?.datei), a.vergleich?.bild].filter(Boolean);
    for (const b of bilder) assert.ok(existsSync(WURZEL + b), `${id}: Datei fehlt: ${b}`);
    // wie die Inhaltsprüfung der App (Schnittstelle 1.2): jeder Pfad assets/spiele/… irgendwo in der Aufgabe existiert
    const pfade = [];
    const sammle = (w) => { if (typeof w === 'string') { if (w.startsWith('assets/spiele/')) pfade.push(w); } else if (w && typeof w === 'object') Object.values(w).forEach(sammle); };
    sammle(a);
    for (const b of pfade) assert.ok(existsSync(WURZEL + b), `${id}: Datei ${b} fehlt`);
    if (a.format === 'bildpuzzle') assert.equal(a.teile.length, a.raster.spalten * a.raster.zeilen, `${id}: teile`);
    if (a.format === 'bildsuche') {
      if (a.felder) assert.equal(a.felder.length, a.raster.spalten * a.raster.zeilen, `${id}: felder`);
      for (const z of a.ziele) for (const b of z.bereiche) assert.ok(b.x + b.b <= 1.0001 && b.y + b.h <= 1.0001, `${id}: Bereich außerhalb`);
    }
    if (a.format === 'sortieren' && a.art === 'gruppen') {
      const gruppen = new Set(a.gruppen.map((g) => g.id));
      for (const k of a.karten) assert.ok(gruppen.has(k.gruppe), `${id}: Karte ${k.id} ohne gültige Gruppe`);
    }
    if (a.format === 'sortieren' && a.art === 'reihenfolge') assert.ok(a.karten.every((k) => !k.gruppe), `${id}: Reihenfolge ohne Gruppen`);
    if (a.format === 'dilemma') {
      const optionen = new Set(a.optionen.map((o) => o.id));
      for (const arg of a.argumente) assert.ok(optionen.has(arg.fuer), `${id}: Argument ${arg.id} zeigt auf keine Möglichkeit`);
      for (const o of optionen) assert.ok(a.argumente.filter((arg) => arg.fuer === o).length >= 2, `${id}: zu wenige Meinungen für ${o}`);
    }
    if (a.format === 'schaetzen') {
      assert.ok(a.antwort >= a.bereich.min && a.antwort <= a.bereich.max, `${id}: Antwort außerhalb des Bereichs`);
      if (a.skala === 'log') assert.ok(a.bereich.min > 0, `${id}: log braucht min > 0`);
    }
  }
});

test('Orte nach Schnittstelle 3.1 und 3.2', () => {
  assert.equal(orte.version, 1);
  assert.ok(orte.orte.includes(orte.finale), 'finale ist ein Ort aus orte');
  for (const id of orte.orte) {
    const ort = lies(`inhalte/${id}/ort.json`);
    assert.equal(ort.id, id);
    for (const feld of ['name', 'region', 'lage', 'qr', 'text', 'bild', 'alt', 'bildQuelle', 'aufgaben', 'ersatz']) assert.ok(ort[feld], `${id}: ${feld} fehlt`);
    assert.ok(ort.lage.radius >= 50 && ort.lage.radius <= 500, `${id}: radius`);
    assert.ok(ort.lage.lat > 50 && ort.lage.lat < 52 && ort.lage.lon > 11.8 && ort.lage.lon < 15.1, `${id}: liegt nicht in Sachsen`);
    assert.match(ort.qr, /^[A-Z0-9-]{4,16}$/);
    assert.ok(ort.aufgaben.length >= 1 && ort.aufgaben.length <= 5);
    assert.ok(existsSync(WURZEL + ort.bild) && existsSync(WURZEL + ort.ersatz.bild), `${id}: Bild fehlt`);
    assert.ok(ort.text.standard && ort.text.einfach && ort.ersatz.text.standard && ort.ersatz.text.einfach, `${id}: Zweitext`);
  }
});

test('Sammelstücke nach Schnittstelle 4: Kennung, Name, Bild, Alternativtext', () => {
  assert.ok(Array.isArray(items) && items.length >= 12);
  for (const item of items) {
    assert.match(item.id, KENNUNG);
    assert.ok(item.name.length <= 30, `${item.id}: Name zu lang`);
    assert.ok(item.alt.length >= 10, `${item.id}: Alternativtext`);
    assert.match(item.kategorie, KENNUNG);
    assert.ok(existsSync(WURZEL + item.bild), `${item.id}: Bild fehlt`);
    const svg = readFileSync(WURZEL + item.bild, 'utf8');
    assert.match(svg, /<svg[^>]+width="512"[^>]+height="512"/, `${item.id}: Breite und Höhe für das Zeichnen auf Canvas`);
    assert.match(svg, /<title>[^<]+<\/title>/, `${item.id}: <title>`);
    assert.doesNotMatch(svg, /<script|on[a-z]+=|xlink:href="http|href="http/i, `${item.id}: kein Skript, keine fremden Verweise`);
  }
});

test('Jedes Sammelstück ist erreichbar: steht in einer Belohnung; jedes Figurteil mit freiDurch hängt an so einem', () => {
  const vergeben = new Set(aufgaben.flatMap((a) => a.daten.belohnung));
  for (const item of lies('inhalte/items.json')) assert.ok(vergeben.has(item.id), `${item.id}: keine Aufgabe vergibt es`);
  const teile = JSON.stringify(lies('inhalte/figur.json')).match(/"freiDurch":"[^"]+"/g) ?? [];
  for (const t of teile) { const id = t.split(':')[1].replaceAll('"', ''); assert.ok(vergeben.has(id), `Figurteil frei durch ${id}: nie erreichbar`); }
});

test('Abläufe nach Zeit: nur vorhandene Aufgaben, Dauer passt in die Zeit', () => {
  const { ablaeufe } = lies('inhalte/ablaeufe.json');
  const nachId = new Map(aufgaben.map((a) => [a.id, a.daten]));
  for (const ablauf of ablaeufe) {
    // Form nach Schnittstelle 3.4: orte: [{ ort, aufgaben: ["1", …] }], Kennungen stunde, projekttag, ausflug
    assert.ok(['stunde', 'projekttag', 'ausflug'].includes(ablauf.id), `${ablauf.id}: Kennung nach 3.4`);
    assert.ok(Array.isArray(ablauf.orte) && ablauf.orte.length > 0, `${ablauf.id}: orte fehlt`);
    const ids = ablauf.orte.flatMap((o) => o.aufgaben.map((nr) => `${o.ort}/${nr}`));
    for (const id of ids) assert.ok(nachId.has(id), `${ablauf.id}: ${id} fehlt`);
    const summe = ids.reduce((s, id) => s + nachId.get(id).dauerMinuten, 0);
    assert.ok(summe <= ablauf.minuten, `${ablauf.id}: ${summe} Minuten Spiel passen nicht in ${ablauf.minuten}`);
  }
});
