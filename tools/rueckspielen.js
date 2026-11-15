#!/usr/bin/env node
// Spielt eine verschlüsselte Sicherung zurück. Server vorher anhalten (docs/BETRIEB.md, Rückspielen).
// Aufruf: node tools/rueckspielen.js <sicherung.db.enc> [--ziel <pfad>] [--ueberschreiben] [--vorher-sichern]
// --vorher-sichern: den jetzigen Stand vorher verschlüsselt sichern („…-vor-zurueckspielen.db.enc“), damit man zurückkann.
// --liste: vorhandene Sicherungen zeigen (neueste zuerst).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spieleZurueck, schluesselAus, sichere, listeSicherungen } from '../server/sicherung.js';

const e = process.env;
const args = process.argv.slice(2);
const zielIndex = args.indexOf('--ziel');
const ziel = resolve(zielIndex >= 0 ? args[zielIndex + 1] : join(e.SPUR_DATEN ?? 'daten', 'spurensuche.db'));
const ordner = resolve(e.SPUR_SICHERUNG_ORDNER ?? join(e.SPUR_DATEN ?? 'daten', 'sicherungen'));
if (args.includes('--liste')) {
  for (const s of await listeSicherungen(ordner)) console.log(`${s.datei}\t${s.art}\t${s.bytes}\t${s.zeit}`);
  process.exit(0);
}
const datei = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--ziel');
if (!datei) { console.error('Aufruf: node tools/rueckspielen.js <sicherung.db.enc> [--ziel <pfad>] [--ueberschreiben] [--vorher-sichern] | --liste'); process.exit(2); }
const roh = e.SPUR_SICHERUNG_SCHLUESSEL || (e.SPUR_SICHERUNG_SCHLUESSELDATEI ? readFileSync(e.SPUR_SICHERUNG_SCHLUESSELDATEI, 'utf8') : '');
const schluessel = schluesselAus(roh);
// ohne Pfad: Name einer Sicherung im Sicherungsordner
const quelle = existsSync(resolve(datei)) ? resolve(datei) : join(ordner, datei);
if (args.includes('--vorher-sichern') && existsSync(ziel)) {
  const s = await sichere({ datenbank: ziel, ordner, schluessel, art: 'vor-zurueckspielen' });
  console.log(`Jetziger Stand gesichert: ${s.datei}`);
}
const r = await spieleZurueck({ datei: quelle, ziel, schluessel, ueberschreiben: args.includes('--ueberschreiben') });
console.log(`Zurückgespielt nach ${r.ziel}: ${r.bytes} Byte in ${r.dauerMs} ms, Integritätsprüfung ok.`);
