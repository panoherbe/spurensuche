#!/usr/bin/env node
// Rückspieltest: Sicherung einer Datenbank (verschlüsselt), Rückspielen in einen leeren Ordner, Vergleich jeder
// Tabelle über SHA-256. Ergebnis als JSON. Aufruf: node tools/rueckspieltest.js <datenbank> <ergebnis.json>
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { sichere, spieleZurueck, pruefsummen } from '../server/sicherung.js';

const [datenbank, ausgabe] = process.argv.slice(2);
const ordner = mkdtempSync(join(tmpdir(), 'spur-rueck-'));
try {
  const schluessel = randomBytes(32); // nur für diesen Test, wird nicht gespeichert
  const vorher = pruefsummen(datenbank);
  const s = await sichere({ datenbank, ordner: join(ordner, 'sicherungen'), schluessel });
  const ziel = join(ordner, 'zurueck', 'spurensuche.db');
  const r = await spieleZurueck({ datei: s.datei, ziel, schluessel });
  const nachher = pruefsummen(ziel);
  const tabellen = Object.keys(vorher);
  const abweichend = tabellen.filter((t) => JSON.stringify(vorher[t]) !== JSON.stringify(nachher[t]));
  const zeilen = tabellen.reduce((summe, t) => summe + vorher[t].zeilen, 0);
  const ergebnis = {
    zeitpunkt: new Date().toISOString(), verfahren: 'VACUUM INTO, AES-256-GCM, Rückspielen mit GCM-Prüfung und PRAGMA integrity_check',
    datenbankBytes: statSync(datenbank).size, sicherungBytes: s.bytes, sicherungMs: s.dauerMs, rueckspielenMs: r.dauerMs,
    tabellen: tabellen.length, zeilen, abweichend, gleich: abweichend.length === 0, jeTabelle: Object.fromEntries(tabellen.map((t) => [t, vorher[t].zeilen])),
  };
  writeFileSync(ausgabe, JSON.stringify(ergebnis, null, 2));
  console.log(`Rückspieltest: ${tabellen.length} Tabellen, ${zeilen} Zeilen, Sicherung ${s.dauerMs} ms, Rückspielen ${r.dauerMs} ms, ${abweichend.length ? `${abweichend.length} abweichend` : 'alle gleich'}`);
  process.exit(abweichend.length ? 1 : 0);
} finally { rmSync(ordner, { recursive: true, force: true }); }
