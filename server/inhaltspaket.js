// Inhaltspakete: ein ZIP mit den Ordnern inhalte/ (vollständig) und assets/spiele/ (Bilder, Töne, Schriften).
// Nur Daten, nie Programmcode: Spiele (spiele/) kommen ausschließlich mit einer Version der Anwendung. Ablauf auf der
// Betriebsseite: hochladen → prüfen (Aufbau, Dateitypen, Pflichtfelder, Verweise) → aktivieren. Der vorherige Stand
// bleibt erhalten und ist mit einem Knopf wieder aktiv; der mitgelieferte Inhalt ist immer die letzte Rückfalllinie.

import { inflateRawSync } from 'node:zlib';
import { mkdir, writeFile, readFile, rm, readdir, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { crc32 } from '../app/js/kern/zip.js';

export const ORDNER = 'inhalte-pakete';
const AKTIV = 'aktiv.json';
export const PAKET_ID = /^\d{8}-\d{6}(-\d{1,3})?$/;
/** Erlaubte Dateitypen: Daten, Bilder, Töne, Schriften, Texte. */
export const ERLAUBT = /\.(json|svg|png|webp|jpe?g|mp3|ogg|woff2|css|txt|md)$/i;
// Beiwerk von Packprogrammen, das still übergangen wird
const BEIWERK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/i;
const SVG_AKTIV = /<script|javascript:|\son[a-z]+\s*=|<foreignObject|<iframe|<embed|<object|<use[^>]+href\s*=\s*["']\s*(https?:|data:)/i;
export const GRENZEN = { dateien: 3000, bytes: 300 * 1048576, datei: 30 * 1048576 };

export class PaketFehler extends Error {}

/**
 * Liest ein ZIP-Archiv (ungepackt oder „deflate“, wie es Windows, macOS und übliche Packprogramme erzeugen).
 * Prüft Grenzen vor dem Entpacken (Anzahl, Größe je Datei, Gesamtgröße) und die Prüfsumme jeder Datei.
 */
export function liesZip(bytes, grenzen = GRENZEN) {
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  let ende = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { ende = i; break; }
  }
  if (ende < 0) throw new PaketFehler('Die Datei ist kein ZIP-Archiv.');
  const anzahl = b.readUInt16LE(ende + 10);
  if (anzahl > grenzen.dateien) throw new PaketFehler(`Das Paket enthält zu viele Dateien (${anzahl}, erlaubt sind ${grenzen.dateien}).`);
  let p = b.readUInt32LE(ende + 16);
  let summe = 0;
  const aus = [];
  for (let i = 0; i < anzahl; i++) {
    if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) throw new PaketFehler('Das Inhaltsverzeichnis des ZIP-Archivs ist beschädigt.');
    const merkmale = b.readUInt16LE(p + 8);
    const methode = b.readUInt16LE(p + 10);
    const pruef = b.readUInt32LE(p + 16);
    const gepackt = b.readUInt32LE(p + 20);
    const groesse = b.readUInt32LE(p + 24);
    const nLaenge = b.readUInt16LE(p + 28);
    const xLaenge = b.readUInt16LE(p + 30);
    const kLaenge = b.readUInt16LE(p + 32);
    const lokal = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nLaenge).toString((merkmale & 0x800) ? 'utf8' : 'latin1');
    p += 46 + nLaenge + xLaenge + kLaenge;
    if (name.endsWith('/')) continue; // Ordnereintrag
    if (merkmale & 1) throw new PaketFehler(`${name}: verschlüsselte Einträge werden nicht gelesen. Bitte ohne Kennwort packen.`);
    if (groesse === 0xffffffff || gepackt === 0xffffffff) throw new PaketFehler('Das Paket ist zu groß (ZIP64 wird nicht gelesen).');
    if (groesse > grenzen.datei) throw new PaketFehler(`${name}: Datei zu groß (${Math.round(groesse / 1048576)} MB, erlaubt sind ${grenzen.datei / 1048576} MB).`);
    summe += groesse;
    if (summe > grenzen.bytes) throw new PaketFehler(`Das Paket ist ausgepackt zu groß (mehr als ${grenzen.bytes / 1048576} MB).`);
    if (lokal + 30 > b.length || b.readUInt32LE(lokal) !== 0x04034b50) throw new PaketFehler(`${name}: Eintrag im ZIP-Archiv beschädigt.`);
    const start = lokal + 30 + b.readUInt16LE(lokal + 26) + b.readUInt16LE(lokal + 28);
    if (start + gepackt > b.length) throw new PaketFehler(`${name}: Eintrag im ZIP-Archiv unvollständig.`);
    const roh = b.subarray(start, start + gepackt);
    let inhalt;
    if (methode === 0) inhalt = Buffer.from(roh);
    else if (methode === 8) {
      try { inhalt = inflateRawSync(roh, { maxOutputLength: Math.max(1, groesse) }); } catch { throw new PaketFehler(`${name}: Datei im ZIP-Archiv beschädigt.`); }
    } else throw new PaketFehler(`${name}: Packverfahren ${methode} wird nicht gelesen. Bitte als gewöhnliches ZIP speichern.`);
    if (inhalt.length !== groesse || crc32(inhalt) !== pruef) throw new PaketFehler(`${name}: Prüfsumme stimmt nicht, die Datei ist beschädigt.`);
    aus.push({ name, inhalt });
  }
  return aus;
}

/**
 * Ordnet die Einträge eines Pakets: entfernt einen gemeinsamen obersten Ordner (wer einen Ordner packt, bekommt
 * „mein-paket/inhalte/…“), übergeht Beiwerk und versteckte Dateien, lehnt alles ab, was nicht in ein Inhaltspaket
 * gehört. Liefert `{ dateien: Map(pfad → Buffer), fehler: [{ datei, pfad, meldung }] }`.
 */
export function ordneDateien(eintraege) {
  const fehler = [];
  const melde = (datei, meldung) => fehler.push({ datei, pfad: '/', meldung });
  let liste = eintraege.filter((e) => !BEIWERK.test(e.name));
  const oben = new Set(liste.map((e) => e.name.split('/')[0]));
  if (oben.size === 1 && liste.every((e) => e.name.includes('/'))) {
    const [o] = oben;
    if (o !== 'inhalte' && o !== 'assets') liste = liste.map((e) => ({ ...e, name: e.name.slice(o.length + 1) }));
  }
  const dateien = new Map();
  for (const { name, inhalt } of liste) {
    const teile = name.split('/');
    if (name.includes('\\') || name.includes('\0') || name.startsWith('/') || /^[A-Za-z]:/.test(name) || teile.some((t) => t === '..' || t === '.' || t === '')) {
      melde(name, 'Ungültiger Dateiname: Pfadangaben wie „..“ oder ein „/“ am Anfang sind nicht erlaubt.');
      continue;
    }
    if (teile.some((t) => t.startsWith('.'))) continue; // versteckte Dateien
    if (!/^(inhalte|assets\/spiele)\//.test(name)) { melde(name, 'Liegt außerhalb der Ordner inhalte/ und assets/spiele/. Ein Inhaltspaket enthält nur diese beiden Ordner.'); continue; }
    if (!ERLAUBT.test(name)) {
      const endung = /\.[^./]+$/.exec(name)?.[0] ?? '(ohne Endung)';
      melde(name, `Dateityp ${endung} ist in Inhaltspaketen nicht erlaubt. Programmcode (zum Beispiel .js oder .html) kommt nur mit einer neuen Version der Anwendung.`);
      continue;
    }
    if (name.length > 200 || !/^[A-Za-z0-9_./-]+$/.test(name)) { melde(name, 'Dateinamen bitte nur mit Buchstaben ohne Umlaute, Ziffern, Bindestrich, Unterstrich und Punkt.'); continue; }
    if (/\.svg$/i.test(name) && SVG_AKTIV.test(inhalt.toString('utf8'))) { melde(name, 'Die SVG-Grafik enthält Skript, Ereignisse oder eingebettete fremde Inhalte; das ist nicht erlaubt.'); continue; }
    dateien.set(name, inhalt);
  }
  for (const pflicht of ['inhalte/orte.json', 'inhalte/items.json']) {
    if (!dateien.has(pflicht)) melde(pflicht, 'Pflichtdatei fehlt. Ein Inhaltspaket enthält immer den ganzen Ordner inhalte/.');
  }
  return { dateien, fehler };
}

const zwei = (n) => String(n).padStart(2, '0');
const stempel = (d) => `${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}-${zwei(d.getHours())}${zwei(d.getMinutes())}${zwei(d.getSeconds())}`;

export const paketWurzel = (datenOrdner, id) => {
  if (!PAKET_ID.test(String(id))) throw new PaketFehler('Unbekanntes Paket');
  return join(datenOrdner, ORDNER, id);
};

/** Legt die Dateien als neues Paket ab (noch nicht aktiv). Liefert die Kennung. */
export async function legeAb(datenOrdner, dateien, { jetzt = new Date() } = {}) {
  await mkdir(join(datenOrdner, ORDNER), { recursive: true });
  let id = stempel(jetzt);
  const vorhanden = new Set(await readdir(join(datenOrdner, ORDNER)));
  for (let n = 2; vorhanden.has(id) || vorhanden.has(`.${id}`); n++) id = `${stempel(jetzt)}-${n}`;
  const teil = join(datenOrdner, ORDNER, `.${id}`);
  for (const [pfad, inhalt] of dateien) {
    await mkdir(dirname(join(teil, pfad)), { recursive: true });
    await writeFile(join(teil, pfad), inhalt);
  }
  await rename(teil, join(datenOrdner, ORDNER, id));
  return id;
}

export async function schreibeBeschreibung(datenOrdner, id, beschreibung) {
  await writeFile(join(paketWurzel(datenOrdner, id), 'paket.json'), JSON.stringify(beschreibung, null, 2));
}

export async function liesBeschreibung(datenOrdner, id) {
  try { return JSON.parse(await readFile(join(paketWurzel(datenOrdner, id), 'paket.json'), 'utf8')); } catch { return null; }
}

export async function entferne(datenOrdner, id) {
  await rm(paketWurzel(datenOrdner, id), { recursive: true, force: true });
}

/** „mitgeliefert“ steht für den Inhalt, der mit der Version der Anwendung kommt. */
export const MITGELIEFERT = 'mitgeliefert';
const gueltig = (w) => w === MITGELIEFERT || PAKET_ID.test(String(w ?? ''));

/** Welcher Inhalt aktiv ist: `{ paket, vorher, seit }` mit Paketkennung oder „mitgeliefert“; `vorher` kann null sein. */
export async function liesAktiv(datenOrdner) {
  try {
    const a = JSON.parse(await readFile(join(datenOrdner, ORDNER, AKTIV), 'utf8'));
    return { paket: gueltig(a.paket) ? a.paket : MITGELIEFERT, vorher: gueltig(a.vorher) ? a.vorher : null, seit: a.seit ?? null };
  } catch { return { paket: MITGELIEFERT, vorher: null, seit: null }; }
}

export async function setzeAktiv(datenOrdner, paket, vorher, jetzt = new Date()) {
  if (!gueltig(paket) || (vorher !== null && !gueltig(vorher))) throw new PaketFehler('Unbekanntes Paket');
  await mkdir(join(datenOrdner, ORDNER), { recursive: true });
  const ziel = join(datenOrdner, ORDNER, AKTIV);
  await writeFile(`${ziel}.teil`, JSON.stringify({ paket, vorher, seit: jetzt.toISOString() }));
  await rename(`${ziel}.teil`, ziel);
}

/** Alle abgelegten Pakete mit Beschreibung, neueste zuerst. */
export async function listePakete(datenOrdner) {
  let namen = [];
  try { namen = await readdir(join(datenOrdner, ORDNER)); } catch { return []; }
  const aus = [];
  for (const id of namen.filter((n) => PAKET_ID.test(n)).sort().reverse()) aus.push({ id, ...(await liesBeschreibung(datenOrdner, id)) });
  return aus;
}

/** Behält die neuesten `behalten` Pakete sowie das aktive und das vorherige; entfernt halbe Ablagen. */
export async function raeumeAuf(datenOrdner, { behalten = 5 } = {}) {
  let namen = [];
  try { namen = await readdir(join(datenOrdner, ORDNER)); } catch { return; }
  const { paket, vorher } = await liesAktiv(datenOrdner);
  const pakete = namen.filter((n) => PAKET_ID.test(n)).sort().reverse();
  for (const id of pakete.slice(behalten)) if (id !== paket && id !== vorher) await entferne(datenOrdner, id);
  for (const n of namen.filter((x) => x.startsWith('.') && PAKET_ID.test(x.slice(1)))) await rm(join(datenOrdner, ORDNER, n), { recursive: true, force: true });
}
