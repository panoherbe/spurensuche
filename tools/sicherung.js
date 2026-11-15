#!/usr/bin/env node
// Verschlüsselte Sicherung der Datenbank. Einmal: node tools/sicherung.js [--art hand|vor-aktualisierung]
// Dauerbetrieb: --taeglich (beim Start und danach jeden Tag um 02:00 Uhr)
// Umgebung: SPUR_DATEN (Ordner mit spurensuche.db), SPUR_SICHERUNG_SCHLUESSEL (Base64, 32 Byte) oder
// SPUR_SICHERUNG_SCHLUESSELDATEI, SPUR_SICHERUNG_ORDNER (Standard: SPUR_DATEN/sicherungen), SPUR_SICHERUNG_ANZAHL (14).
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sichere, schluesselAus, ARTEN } from '../server/sicherung.js';

const e = process.env;
const daten = resolve(e.SPUR_DATEN ?? 'daten');
const datenbank = join(daten, 'spurensuche.db');
const ordner = resolve(e.SPUR_SICHERUNG_ORDNER ?? join(daten, 'sicherungen'));
const roh = e.SPUR_SICHERUNG_SCHLUESSEL || (e.SPUR_SICHERUNG_SCHLUESSELDATEI ? readFileSync(e.SPUR_SICHERUNG_SCHLUESSELDATEI, 'utf8') : '');
if (!roh) { console.error('Kein Sicherungsschlüssel (SPUR_SICHERUNG_SCHLUESSEL oder SPUR_SICHERUNG_SCHLUESSELDATEI). Ohne Schlüssel wird nicht gesichert.'); process.exit(2); }
const schluessel = schluesselAus(roh);
const artIndex = process.argv.indexOf('--art');
const art = artIndex >= 0 ? process.argv[artIndex + 1] : null;
if (art !== null && !ARTEN.includes(art)) { console.error(`Unbekannte Art: ${art} (erlaubt: ${ARTEN.join(', ')})`); process.exit(2); }

async function einmal() {
  const r = await sichere({ datenbank, ordner, schluessel, behalten: Number(e.SPUR_SICHERUNG_ANZAHL ?? 14), art });
  const db = new DatabaseSync(datenbank);
  try {
    db.exec('PRAGMA busy_timeout = 10000');
    db.prepare("INSERT INTO einstellung (schluessel, wert) VALUES ('letzte_sicherung', ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert").run(new Date().toISOString());
  } finally { db.close(); }
  console.log(JSON.stringify({ zeit: new Date().toISOString(), aktion: 'sicherung', art: art ?? 'taeglich', datei: r.datei, bytes: r.bytes, dauerMs: r.dauerMs }));
}

if (!process.argv.includes('--taeglich')) { await einmal(); process.exit(0); }
// Dauerbetrieb: beim Start einmal, danach jeden Tag um 02:00 Uhr (Zeitzone aus TZ)
for (;;) {
  try { await einmal(); } catch (f) { console.error(`Sicherung fehlgeschlagen: ${f.message}`); }
  const naechste = new Date();
  naechste.setHours(2, 0, 0, 0);
  if (naechste <= new Date()) naechste.setDate(naechste.getDate() + 1);
  await new Promise((r) => setTimeout(r, naechste - new Date()));
}
