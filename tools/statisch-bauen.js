#!/usr/bin/env node
// Baut die Vorführung als statische Seite (ohne Server): App, Lehrkräfte-Ansicht, Spiele, Inhalte, Service Worker,
// konfiguration.json mit modus „vorfuehrung“ und die Offline-Liste. Läuft unter jedem Unterpfad.
// Aufruf: node tools/statisch-bauen.js <zielordner>

import { mkdir, cp, writeFile, rm, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladeInhalte } from '../server/inhalte.js';
import { VERSION } from '../server/app.js';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ziel = resolve(process.argv[2] ?? join(WURZEL, 'export', 'vorfuehrung'));
await rm(ziel, { recursive: true, force: true });
await mkdir(ziel, { recursive: true });

const inhalte = await ladeInhalte({ appWurzel: WURZEL, inhaltsWurzel: WURZEL });
if (inhalte.fehler.length) {
  for (const f of inhalte.fehler) console.error(`✗ ${f.datei} ${f.pfad}: ${f.meldung}`);
  process.exit(1);
}
for (const d of inhalte.offlineListe.dateien) {
  const quelle = inhalte.quellen.get(d.pfad);
  await mkdir(dirname(join(ziel, d.pfad)), { recursive: true });
  await cp(quelle, join(ziel, d.pfad));
}
for (const datei of ['sw.js', 'manifest.webmanifest', 'betrieb.html', 'status.html']) await cp(join(WURZEL, 'app', datei), join(ziel, datei));
// ohne eigene Vorschläge je Zeitrahmen: leere Liste, damit die Seite keine 404 sieht
if (!inhalte.offlineListe.dateien.some((d) => d.pfad === 'inhalte/ablaeufe.json')) {
  await mkdir(join(ziel, 'inhalte'), { recursive: true });
  await writeFile(join(ziel, 'inhalte', 'ablaeufe.json'), JSON.stringify({ ablaeufe: [] }));
}
const konfiguration = { modus: 'vorfuehrung', version: VERSION, inhaltVersion: inhalte.inhaltVersion, anmeldung: { anmeldedienst: false, zugangsschluessel: false, attrappe: false }, lernendeAnmeldung: 'optional' };
await writeFile(join(ziel, 'konfiguration.json'), JSON.stringify(konfiguration));
await writeFile(join(ziel, 'offline-liste.json'), JSON.stringify(inhalte.offlineListe));
// Hinweis für Server, die keine Kopfzeilen aus der Konfiguration setzen können: dieselbe Inhaltsrichtlinie als Datei
await writeFile(join(ziel, 'KOPFZEILEN.txt'), `Empfohlene Kopfzeilen für diesen Ordner (wie im Server, server/sicherheit.js):
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(self), geolocation=(self), microphone=()
`);
const index = await readFile(join(ziel, 'index.html'), 'utf8');
if (!index.includes('app/js/start.js')) throw new Error('index.html ohne Einstiegsskript');
console.log(`Vorführung gebaut: ${ziel}, ${inhalte.offlineListe.dateien.length + 4} Dateien, ${Math.round(inhalte.offlineListe.gesamtBytes / 1024)} KB, Inhalte ${inhalte.inhaltVersion}`);
