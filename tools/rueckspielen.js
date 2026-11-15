#!/usr/bin/env node
// Spielt eine verschlüsselte Sicherung zurück. Server vorher anhalten (docs/BETRIEB.md, Rückspielen).
// Aufruf: node tools/rueckspielen.js <sicherung.db.enc> [--ziel <pfad>] [--ueberschreiben]
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spieleZurueck, schluesselAus } from '../server/sicherung.js';

const e = process.env;
const args = process.argv.slice(2);
const datei = args.find((a) => !a.startsWith('--'));
const zielIndex = args.indexOf('--ziel');
const ziel = resolve(zielIndex >= 0 ? args[zielIndex + 1] : join(e.SPUR_DATEN ?? 'daten', 'spurensuche.db'));
if (!datei) { console.error('Aufruf: node tools/rueckspielen.js <sicherung.db.enc> [--ziel <pfad>] [--ueberschreiben]'); process.exit(2); }
const roh = e.SPUR_SICHERUNG_SCHLUESSEL || (e.SPUR_SICHERUNG_SCHLUESSELDATEI ? readFileSync(e.SPUR_SICHERUNG_SCHLUESSELDATEI, 'utf8') : '');
const r = await spieleZurueck({ datei: resolve(datei), ziel, schluessel: schluesselAus(roh), ueberschreiben: args.includes('--ueberschreiben') });
console.log(`Zurückgespielt nach ${r.ziel}: ${r.bytes} Byte in ${r.dauerMs} ms, Integritätsprüfung ok.`);
