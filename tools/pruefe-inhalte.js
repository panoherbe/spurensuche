#!/usr/bin/env node
// Prüft alle Inhalte: Orte, Aufgaben gegen das Schema ihres Formats, Sammelstücke und Bilder.
// Aufruf: node tools/pruefe-inhalte.js [wurzel]   Rückgabewert 1 bei Fehlern.

import { readFile, access } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { pruefeInhalte } from '../app/js/kern/inhalte.js';

const wurzel = resolve(process.argv[2] ?? '.');
const imRepo = (pfad) => {
  const voll = resolve(wurzel, pfad);
  if (relative(wurzel, voll).startsWith('..') || voll.includes(`${sep}..${sep}`)) throw new Error(`Pfad außerhalb des Repos: ${pfad}`);
  return voll;
};

const leser = {
  json: async (pfad) => JSON.parse(await readFile(imRepo(pfad), 'utf8')),
  existiert: async (pfad) => { try { await access(imRepo(pfad)); return true; } catch { return false; } },
};

const bericht = await pruefeInhalte(leser);
for (const f of bericht.fehler) console.log(`✗ ${f.datei} ${f.pfad}: ${f.meldung}`);
console.log(`${bericht.orte.length} Orte, ${bericht.aufgaben.length} Aufgaben, ${bericht.items.length} Sammelstücke geprüft: ${bericht.fehler.length ? `${bericht.fehler.length} Fehler` : 'keine Fehler'}.`);
process.exit(bericht.fehler.length ? 1 : 0);
