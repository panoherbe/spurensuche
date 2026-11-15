#!/usr/bin/env node
// Baut ein Inhaltspaket für „Inhalt tauschen“ auf der Betriebsseite: ZIP mit inhalte/ und assets/spiele/ aus einem
// Checkout (oder dem Ordner aus SPUR_INHALTE). Prüft vorher alles, was auch die Anwendung prüft; mit Fehlern entsteht
// kein Paket. Aufruf: node tools/inhalt-paket.js <ziel.zip> [inhaltsordner]
import { writeFile, readdir, readFile } from 'node:fs/promises';
import { resolve, join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip } from '../app/js/kern/zip.js';
import { ladeInhalte } from '../server/inhalte.js';
import { ordneDateien } from '../server/inhaltspaket.js';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ziel = process.argv[2];
const quelle = resolve(process.argv[3] ?? process.env.SPUR_INHALTE ?? WURZEL);
if (!ziel) { console.error('Aufruf: node tools/inhalt-paket.js <ziel.zip> [inhaltsordner]'); process.exit(2); }

const dateien = [];
async function gehe(pfad) {
  let eintraege = [];
  try { eintraege = await readdir(pfad, { withFileTypes: true }); } catch { return; }
  for (const e of eintraege) {
    if (e.name.startsWith('.')) continue;
    const voll = join(pfad, e.name);
    if (e.isDirectory()) await gehe(voll);
    else if (e.isFile()) dateien.push({ name: relative(quelle, voll).split(sep).join('/'), inhalt: await readFile(voll) });
  }
}
await gehe(join(quelle, 'inhalte'));
await gehe(join(quelle, 'assets', 'spiele'));

const { dateien: geordnet, fehler } = ordneDateien(dateien);
const pruefung = await ladeInhalte({ appWurzel: WURZEL, inhaltsWurzel: WURZEL, datenWurzel: quelle });
const alle = [...fehler, ...pruefung.fehler];
if (alle.length) {
  for (const f of alle) console.error(`✗ ${f.datei} ${f.pfad ?? ''}: ${f.meldung}`);
  console.error(`${alle.length} Fehler: kein Paket erzeugt.`);
  process.exit(1);
}
const bytes = zip([...geordnet].map(([name, inhalt]) => ({ name, inhalt })));
await writeFile(resolve(ziel), bytes);
console.log(`${ziel}: ${geordnet.size} Dateien, ${(bytes.length / 1048576).toFixed(1)} MB, ${pruefung.orte.length} Orte, ${pruefung.aufgaben.length} Aufgaben, Inhaltsversion ${pruefung.inhaltVersion}`);
