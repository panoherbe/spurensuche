#!/usr/bin/env node
// Probelauf Archiv und Übergabe: Export aus einer Datenbank (Umfang „archiv“), Übernahme in eine leere Instanz,
// erneuter Export dort, Vergleich aller Prüfsummen. Ergebnis als JSON.
// Aufruf: node tools/archiv-probelauf.js <datenbank> <ergebnis.json> [inhaltswurzel]
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { oeffne } from '../server/db.js';
import { ladeInhalte } from '../server/inhalte.js';
import { erstelleArchiv, pruefeArchiv, importiereArchiv, vergleicheManifeste } from '../server/archiv.js';
import { VERSION } from '../server/app.js';

const [quelleDb, ausgabe, wurzel = '.'] = process.argv.slice(2);
const appWurzel = resolve('.');
const inhalte = await ladeInhalte({ appWurzel, inhaltsWurzel: resolve(wurzel) });
const quelle = new DatabaseSync(quelleDb, { readOnly: true });
const einstellungen = { aufbewahrungWochen: 12, lernendeAnmeldung: 'optional' };
let t = performance.now();
const a = await erstelleArchiv({ db: quelle, inhalte, umfang: 'archiv', version: VERSION, einstellungen });
const exportMs = Math.round(performance.now() - t);
quelle.close();
t = performance.now();
const p = pruefeArchiv(a.zip);
const pruefMs = Math.round(performance.now() - t);
const ziel = mkdtempSync(join(tmpdir(), 'spur-uebernahme-'));
try {
  const db = oeffne(join(ziel, 'neu.db'));
  t = performance.now();
  const imp = await importiereArchiv({ db, zielWurzel: join(ziel, 'inhalt'), zipBytes: a.zip });
  const importMs = Math.round(performance.now() - t);
  const neueInhalte = await ladeInhalte({ appWurzel, inhaltsWurzel: join(ziel, 'inhalt') });
  const b = await erstelleArchiv({ db, inhalte: neueInhalte, umfang: 'archiv', version: VERSION, einstellungen });
  const v = vergleicheManifeste(a.manifest, b.manifest);
  db.close();
  const ergebnis = {
    zeitpunkt: new Date().toISOString(), format: 'BagIt 1.0 (RFC 8493) in ZIP, SHA-256 je Datei',
    export: { dateien: a.dateien, bytes: a.bytes, zipBytes: a.zip.length, bildbeitraege: a.bildbeitraege, dauerMs: exportMs },
    pruefung: { ok: p.ok, fehler: p.fehler, dauerMs: pruefMs },
    uebernahme: { dateien: imp.dateien, bildbeitraege: imp.bildbeitraege, inhaltFehler: neueInhalte.fehler.length, dauerMs: importMs },
    vergleich: { gleich: v.gleich, dateien: v.dateien, abweichend: v.abweichend },
  };
  writeFileSync(ausgabe, JSON.stringify(ergebnis, null, 2));
  console.log(`Archiv: ${a.dateien} Dateien (${Math.round(a.zip.length / 1024)} KB, ${a.bildbeitraege} Bildbeiträge), Export ${exportMs} ms, Übernahme ${importMs} ms, Prüfsummen ${v.gleich ? 'alle gleich' : `${v.abweichend.length} abweichend`}`);
  process.exit(v.gleich && p.ok ? 0 : 1);
} finally { rmSync(ziel, { recursive: true, force: true }); }
