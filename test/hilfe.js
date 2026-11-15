// Hilfen für die Tests: Server mit Beispielinhalten starten, Anfragen mit Cookies, Testbilder erzeugen.

import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { erstelleApp } from '../server/app.js';
import { crc32 } from '../app/js/kern/zip.js';

export const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BEISPIEL = resolve(WURZEL, 'test/fixtures/inhalt');

export function freierPort() {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
  });
}

/** Startet eine Instanz mit leerer Datenbank. `optionen` überschreibt die Konfiguration. */
export async function starteInstanz(optionen = {}) {
  const port = await freierPort();
  const ordner = mkdtempSync(join(tmpdir(), 'spur-test-'));
  const url = `http://127.0.0.1:${port}`;
  const cfg = {
    datenbank: join(ordner, 'test.db'),
    datenOrdner: ordner,
    appWurzel: WURZEL,
    inhaltsWurzel: BEISPIEL,
    oeffentlicheUrl: url,
    sichereCookies: false,
    verwaltungSchluessel: 'VERW-ALTUNG-TEST',
    ausstellungToken: 'ausstellung-test-token',
    messwerteToken: 'messwerte-test-token',
    aufbewahrungWochen: 12,
    lernendeAnmeldung: 'optional',
    attrappe: true,
    oidc: { aussteller: `${url}/attrappe`, clientId: 'spurensuche', clientSecret: 'test-geheim', rollenMerkmal: 'rolle', rollenLehrkraft: ['lehrkraft'], rollenLernende: ['schueler'], intern: `${url}/attrappe` },
    log: { info() {}, warn() {}, error() {} },
    ...optionen,
  };
  const app = await erstelleApp(cfg);
  await new Promise((ok) => app.server.listen(port, '127.0.0.1', ok));
  return {
    app, url, ordner, cfg,
    async stopp() { await new Promise((ok) => app.server.close(ok)); app.schliesse(); rmSync(ordner, { recursive: true, force: true }); },
  };
}

/** Kleiner HTTP-Klient mit Cookie-Speicher (wie ein Browser, aber ohne Weiterleitungen). */
export function klient(basis) {
  const cookies = new Map();
  async function anfrage(pfad, { methode = 'GET', json, text, token, kopf = {}, folgen = false } = {}) {
    const k = {};
    if (json !== undefined) k['Content-Type'] = 'application/json';
    if (text !== undefined) k['Content-Type'] = 'application/x-www-form-urlencoded';
    if (token) k.Authorization = `Bearer ${token}`;
    Object.assign(k, kopf); // ausdrücklich gesetzte Kopfzeilen gehen vor
    if (cookies.size) k.Cookie = [...cookies].map(([n, w]) => `${n}=${w}`).join('; ');
    const r = await fetch(pfad.startsWith('http') ? pfad : basis + pfad, { method: methode, headers: k, body: json !== undefined ? JSON.stringify(json) : text, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) {
      const [paar] = c.split(';');
      const [n, ...w] = paar.split('=');
      if (/Max-Age=0/.test(c)) cookies.delete(n.trim()); else cookies.set(n.trim(), w.join('='));
    }
    const typ = r.headers.get('content-type') ?? '';
    const roh = Buffer.from(await r.arrayBuffer());
    let daten = null;
    if (typ.includes('application/json')) { try { daten = JSON.parse(roh.toString('utf8')); } catch { /* leer */ } }
    if (folgen && r.status === 302) return anfrage(r.headers.get('location'), { folgen: true });
    return { status: r.status, daten, roh, kopf: r.headers, text: roh.toString('utf8') };
  }
  return { anfrage, cookies };
}

function chunk(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const td = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(td));
  return Buffer.concat([laenge, td, pruef]);
}

/** Gültiges PNG (Graustufen) der Größe breite × hoehe mit einem Grauwert. */
export function testPng(breite = 2048, hoehe = 2048, grau = 200) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const zeile = Buffer.alloc(breite + 1, grau);
  zeile[0] = 0;
  const roh = Buffer.concat(Array.from({ length: hoehe }, () => zeile));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(roh)), chunk('IEND', Buffer.alloc(0))]);
}

/** Kopf einer verlustfreien WebP-Datei (reicht für die Größenprüfung des Servers). */
export function testWebp(breite = 512, hoehe = 512) {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(22, 4);
  b.write('WEBP', 8, 'ascii');
  b.write('VP8L', 12, 'ascii');
  b.writeUInt32LE(10, 16);
  b[20] = 0x2f;
  b.writeUInt32LE(((breite - 1) & 0x3fff) | (((hoehe - 1) & 0x3fff) << 14), 21);
  return b;
}
