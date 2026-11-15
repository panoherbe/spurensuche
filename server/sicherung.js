// Sicherung und Rückspielen der Datenbank: konsistente Kopie im laufenden Betrieb (VACUUM INTO), verschlüsselt mit
// AES-256-GCM. Ohne Schlüssel gibt es keine Sicherung: unverschlüsselte Kopien entstehen nie.
//
// Dateiformat: "SPURSICH1" (9 Byte) | IV (12 Byte) | verschlüsselte Datenbank | Prüfwert GCM (16 Byte).

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, rm, readdir, mkdir, rename, stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join, dirname, basename } from 'node:path';

const KENNUNG = Buffer.from('SPURSICH1', 'ascii');
/** Dateiname einer Sicherung: Zeitstempel (Ortszeit nach TZ) und bei besonderen Sicherungen die Art. */
export const SICHERUNG_NAME = /^spurensuche-(\d{8})-(\d{6})(?:-([a-z][a-z-]{1,30}))?\.db\.enc$/;
/** Besondere Arten (ohne Art: die tägliche Sicherung). Von jeder Art bleiben die neuesten zehn. */
export const ARTEN = ['hand', 'vor-zurueckspielen', 'vor-aktualisierung'];
const VORMERKUNG = 'zurueckspielen.json';

/** Schlüssel aus Base64 (32 Byte) prüfen. */
export function schluesselAus(text) {
  const s = Buffer.from(String(text ?? '').trim(), 'base64');
  if (s.length !== 32) throw new Error('Der Sicherungsschlüssel muss 32 Byte lang sein (Base64, z. B. aus „openssl rand -base64 32“).');
  return s;
}

const zwei = (n) => String(n).padStart(2, '0');
const stempel = (d) => `${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}-${zwei(d.getHours())}${zwei(d.getMinutes())}${zwei(d.getSeconds())}`;

/**
 * Erstellt eine verschlüsselte Sicherung von `datenbank` im Ordner `ordner`. Behält die neuesten `behalten`.
 * Liefert `{ datei, bytes, sha256, dauerMs }`.
 */
export async function sichere({ datenbank, ordner, schluessel, behalten = 14, jetzt = new Date(), art = null }) {
  if (art !== null && !ARTEN.includes(art)) throw new Error(`Unbekannte Art der Sicherung: ${art}`);
  const beginn = performance.now();
  await mkdir(ordner, { recursive: true });
  const kopie = join(ordner, `.kopie-${process.pid}-${Date.now()}.db`);
  const db = new DatabaseSync(datenbank, { readOnly: false });
  try {
    db.exec('PRAGMA busy_timeout = 10000');
    db.prepare('VACUUM INTO ?').run(kopie);
  } finally { db.close(); }
  const klar = await readFile(kopie);
  await rm(kopie, { force: true });
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', schluessel, iv);
  const inhalt = Buffer.concat([KENNUNG, iv, c.update(klar), c.final(), c.getAuthTag()]);
  const datei = join(ordner, `spurensuche-${stempel(jetzt)}${art ? `-${art}` : ''}.db.enc`);
  await writeFile(`${datei}.teil`, inhalt, { mode: 0o600 });
  await rename(`${datei}.teil`, datei);
  const sha256 = createHash('sha256').update(inhalt).digest('hex');
  await writeFile(`${datei}.sha256`, `${sha256}  ${basename(datei)}\n`);
  // ältere Sicherungen derselben Art über die Anzahl hinaus entfernen (täglich: `behalten`, besondere: zehn)
  const alle = (await readdir(ordner)).filter((n) => { const m = SICHERUNG_NAME.exec(n); return m && (m[3] ?? null) === art; }).sort();
  for (const alt of alle.slice(0, Math.max(0, alle.length - (art ? 10 : behalten)))) {
    await rm(join(ordner, alt), { force: true });
    await rm(join(ordner, `${alt}.sha256`), { force: true });
  }
  return { datei, bytes: inhalt.length, klarBytes: klar.length, sha256, dauerMs: Math.round(performance.now() - beginn) };
}

/** Entschlüsselt eine Sicherung nach `ziel`. Bricht ab, wenn der Prüfwert nicht stimmt oder `ziel` existiert. */
export async function spieleZurueck({ datei, ziel, schluessel, ueberschreiben = false }) {
  const beginn = performance.now();
  if (!ueberschreiben) {
    let vorhanden = true;
    try { await stat(ziel); } catch { vorhanden = false; }
    if (vorhanden) throw new Error(`Ziel ${ziel} gibt es schon (zum Ersetzen --ueberschreiben).`);
  }
  const inhalt = await readFile(datei);
  if (!inhalt.subarray(0, KENNUNG.length).equals(KENNUNG)) throw new Error('Keine Sicherung der Spurensuche');
  const iv = inhalt.subarray(KENNUNG.length, KENNUNG.length + 12);
  const tag = inhalt.subarray(inhalt.length - 16);
  const d = createDecipheriv('aes-256-gcm', schluessel, iv);
  d.setAuthTag(tag);
  const klar = Buffer.concat([d.update(inhalt.subarray(KENNUNG.length + 12, inhalt.length - 16)), d.final()]); // wirft bei falschem Schlüssel oder Veränderung
  await mkdir(dirname(ziel), { recursive: true });
  await writeFile(`${ziel}.teil`, klar, { mode: 0o600 });
  for (const endung of ['-wal', '-shm']) await rm(`${ziel}${endung}`, { force: true });
  await rename(`${ziel}.teil`, ziel);
  const db = new DatabaseSync(ziel);
  try {
    const pruefung = db.prepare('PRAGMA integrity_check').get();
    if (Object.values(pruefung)[0] !== 'ok') throw new Error(`Integritätsprüfung: ${JSON.stringify(pruefung)}`);
  } finally { db.close(); }
  return { ziel, bytes: klar.length, dauerMs: Math.round(performance.now() - beginn) };
}

/** Prüfsumme je Tabelle (alle Zeilen in fester Reihenfolge), um Original und Rückspielung zu vergleichen. */
export function pruefsummen(datenbank) {
  const db = new DatabaseSync(datenbank, { readOnly: true });
  try {
    const tabellen = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((t) => t.name);
    const aus = {};
    for (const t of tabellen) {
      const h = createHash('sha256');
      let n = 0;
      const spalten = db.prepare(`PRAGMA table_info("${t}")`).all().length;
      const ordnung = Array.from({ length: Math.min(3, spalten) }, (_, i) => i + 1).join(', ');
      for (const zeile of db.prepare(`SELECT * FROM "${t}" ORDER BY ${ordnung}`).iterate()) {
        h.update(JSON.stringify(zeile, (k, v) => (v instanceof Uint8Array ? Buffer.from(v).toString('base64') : typeof v === 'bigint' ? v.toString() : v)));
        n++;
      }
      aus[t] = { zeilen: n, sha256: h.digest('hex') };
    }
    return aus;
  } finally { db.close(); }
}

/** Sicherungen im Ordner, neueste zuerst: `{ datei, art, stempel, bytes, zeit }` (zeit: Änderungszeit der Datei). */
export async function listeSicherungen(ordner) {
  let namen = [];
  try { namen = await readdir(ordner); } catch { return []; }
  const aus = [];
  for (const n of namen) {
    const m = SICHERUNG_NAME.exec(n);
    if (!m) continue;
    let s;
    try { s = await stat(join(ordner, n)); } catch { continue; }
    aus.push({ datei: n, art: m[3] ?? 'taeglich', stempel: `${m[1]}-${m[2]}`, bytes: s.size, zeit: s.mtime.toISOString() });
  }
  return aus.sort((a, b) => b.zeit.localeCompare(a.zeit) || b.stempel.localeCompare(a.stempel));
}

/**
 * Bereitet das Zurückspielen im laufenden Betrieb vor: entschlüsselt und prüft die Sicherung neben der Datenbank
 * (`<datenbank>.zurueck`) und merkt sie vor. Ersetzt wird erst beim nächsten Start (vollendeZurueckspielen), damit
 * nie eine geöffnete Datenbank überschrieben wird.
 */
export async function bereiteZurueckspielenVor({ datei, datenbank, schluessel, jetzt = new Date() }) {
  const r = await spieleZurueck({ datei, ziel: `${datenbank}.zurueck`, schluessel, ueberschreiben: true });
  const marke = join(dirname(datenbank), VORMERKUNG);
  await writeFile(`${marke}.teil`, JSON.stringify({ datei: basename(datei), vorgemerkt: jetzt.toISOString() }));
  await rename(`${marke}.teil`, marke);
  return r;
}

/**
 * Beim Start, bevor die Datenbank geöffnet wird: ersetzt sie durch die vorgemerkte Sicherung. Sitzungen der Rollen
 * `behalten` (der Betrieb, der gerade zurückspielt) werden übernommen. Liefert null, wenn nichts vorgemerkt ist.
 */
export async function vollendeZurueckspielen({ datenbank, behalten = ['betrieb'], jetzt = new Date() }) {
  const marke = join(dirname(datenbank), VORMERKUNG);
  let v;
  try { v = JSON.parse(await readFile(marke, 'utf8')); } catch { return null; }
  const neu = `${datenbank}.zurueck`;
  try {
    await stat(neu);
    const pruefung = new DatabaseSync(neu);
    try {
      const ergebnis = pruefung.prepare('PRAGMA integrity_check').get();
      if (Object.values(ergebnis)[0] !== 'ok') throw new Error(`Integritätsprüfung: ${JSON.stringify(ergebnis)}`);
    } finally { pruefung.close(); }
  } catch (e) {
    await rm(marke, { force: true });
    await rm(neu, { force: true });
    return { datei: v.datei, fehler: e.message };
  }
  let sitzungen = [];
  try {
    const alt = new DatabaseSync(datenbank);
    try {
      const platz = behalten.map(() => '?').join(', ');
      sitzungen = alt.prepare(`SELECT token_hash, rolle, ablauf FROM sitzung WHERE rolle IN (${platz}) AND ablauf > ?`).all(...behalten, jetzt.toISOString());
    } finally { alt.close(); }
  } catch { /* keine alte Datenbank oder ohne Sitzungen */ }
  for (const endung of ['-wal', '-shm']) await rm(`${datenbank}${endung}`, { force: true });
  await rename(neu, datenbank);
  await rm(marke, { force: true });
  return { datei: v.datei, vorgemerkt: v.vorgemerkt, sitzungen };
}
