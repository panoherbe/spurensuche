// Lasttest mit simulierten Gruppen und Lehrkräften über die echte Schnittstelle (ohne Browser).
//
// Ablauf je Gruppe (Gerät): Start zufällig in den ersten RAMPE Minuten (Unterrichtsbeginn), App und alle Inhalte
// laden (wie der Service Worker beim ersten Öffnen), mit Code beitreten, dann bis zum Ende der Messdauer Stationen
// spielen: Station beginnen, je Aufgabe Denkzeit, Ergebnis übertragen, Station beenden; nach dem Ort der
// Abschlussaufgabe einmal einen Bildbeitrag (PNG 2048 × 2048) hochladen. Lehrkräfte rufen alle 10 Sekunden die
// laufende Übersicht und alle 2 Minuten eine Auswertung ab.
//
// Umgebung: APP_URL, SITZUNGEN (400), DAUER_MIN (45), RAMPE_MIN (5), DENKZEIT_S ("90-180"),
// GRUPPEN_JE_KLASSE (8; je Klasse eine Lehrkraft), VERWALTUNG (Schlüssel), AUSGABE (Ordner). Ergebnis: AUSGABE/last-<sitzungen>.json mit Perzentilen je Anfrageart.

import { writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { crc32 } from '../app/js/kern/zip.js';

const e = process.env;
const APP = e.APP_URL ?? 'http://localhost:8080';
const SITZUNGEN = Number(e.SITZUNGEN ?? 400);
const DAUER = Number(e.DAUER_MIN ?? 45) * 60_000;
const RAMPE = Number(e.RAMPE_MIN ?? 5) * 60_000;
const [DENK_MIN, DENK_MAX] = (e.DENKZEIT_S ?? '90-180').split('-').map((x) => Number(x) * 1000);
const GRUPPEN_JE_KLASSE = Number(e.GRUPPEN_JE_KLASSE ?? 8); // eine Klasse mit acht Gruppen zu drei bis vier Kindern
const LEHRKRAEFTE = Math.ceil(SITZUNGEN / GRUPPEN_JE_KLASSE);
const AUSGABE = e.AUSGABE ?? 'nachweis/tmp';
mkdirSync(AUSGABE, { recursive: true });

const messwerte = new Map();
const fehlerListe = [];
function notiere(art, ms, ok, status) {
  if (!messwerte.has(art)) messwerte.set(art, { zeiten: [], fehler: 0, status: {} });
  const m = messwerte.get(art);
  m.zeiten.push(ms);
  m.status[status] = (m.status[status] ?? 0) + 1;
  if (!ok) { m.fehler++; if (fehlerListe.length < 50) fehlerListe.push(`${art}: ${status}`); }
}

async function anfrage(art, pfad, { methode = 'GET', json, token, cookie, roh = false } = {}) {
  const kopf = {};
  if (json !== undefined) kopf['Content-Type'] = 'application/json';
  if (token) kopf.Authorization = `Bearer ${token}`;
  if (cookie) kopf.Cookie = cookie;
  const t = performance.now();
  try {
    const r = await fetch(APP + pfad, { method: methode, headers: kopf, body: json === undefined ? undefined : JSON.stringify(json) });
    const inhalt = roh ? await r.arrayBuffer() : await r.text();
    notiere(art, performance.now() - t, r.ok, r.status);
    return { status: r.status, kopf: r.headers, text: roh ? null : inhalt, daten: !roh && inhalt && r.headers.get('content-type')?.includes('json') ? JSON.parse(inhalt) : null };
  } catch (f) {
    notiere(art, performance.now() - t, false, `netz:${f.cause?.code ?? f.message}`);
    return { status: 0 };
  }
}

const schlafe = (ms) => new Promise((r) => setTimeout(r, ms));
const zufall = (a, b) => a + Math.random() * (b - a);

// Bild für den Bildbeitrag: 2048 × 2048, farbige Flächen und ein Achtel Rauschen, damit die PNG-Datei etwa so groß
// wird wie eine Collage aus gezeichneten Sammelstücken (gut 1,5 MB)
function testbild() {
  const breite = 2048;
  const zeilen = [];
  let saat = 12345;
  const rauschen = () => { saat = (saat * 1103515245 + 12345) >>> 0; return saat >>> 24; };
  for (let y = 0; y < breite; y++) {
    const z = Buffer.alloc(1 + breite * 3);
    for (let x = 0; x < breite; x++) {
      const bx = Math.floor(x / 256);
      const by = Math.floor(y / 256);
      if ((bx + by) % 8 === 0) { z[1 + x * 3] = rauschen(); z[2 + x * 3] = rauschen(); z[3 + x * 3] = rauschen(); continue; }
      const feld = (bx + by) % 4;
      const rausch = (x * 7 + y * 13) % 23;
      z[1 + x * 3] = [230, 70, 200, 30][feld] + rausch;
      z[2 + x * 3] = [200, 140, 90, 120][feld];
      z[3 + x * 3] = [150, 60, 40, 200][feld] - rausch;
    }
    zeilen.push(z);
  }
  const chunk = (typ, daten) => { const l = Buffer.alloc(4); l.writeUInt32BE(daten.length); const td = Buffer.concat([Buffer.from(typ), daten]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(breite, 0); ihdr.writeUInt32BE(breite, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(zeilen), { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
function webpKopf() {
  const b = Buffer.alloc(30); b.write('RIFF', 0); b.writeUInt32LE(22, 4); b.write('WEBP', 8); b.write('VP8L', 12); b.writeUInt32LE(10, 16); b[20] = 0x2f; b.writeUInt32LE(511 | (511 << 14), 21); return b;
}

// --- Vorbereitung: Lehrkräfte, Lerngruppen, Quests, Gruppen -----------------------------------------------------
const beginnVorbereitung = Date.now();
const verwaltung = await anfrage('vorbereitung', '/api/v1/anmeldung/verwaltung', { methode: 'POST', json: { schluessel: e.VERWALTUNG ?? 'TEST-VERWALTUNG' } });
const vCookie = verwaltung.kopf.get('set-cookie')?.split(';')[0];
const inhalte = await (await fetch(`${APP}/offline-liste.json`)).json();
const orteIndex = await (await fetch(`${APP}/inhalte/orte.json`)).json();
const orte = [];
for (const id of orteIndex.orte) orte.push(await (await fetch(`${APP}/inhalte/${id}/ort.json`)).json());
const aufgabenJeOrt = new Map();
for (const o of orte) aufgabenJeOrt.set(o.id, await Promise.all(o.aufgaben.map(async (nr) => ({ nr, ...(await (await fetch(`${APP}/inhalte/${o.id}/${nr}.json`)).json()) }))));

const gruppenJeLehrkraft = GRUPPEN_JE_KLASSE;
const lehrkraefte = [];
const codes = [];
for (let i = 0; i < LEHRKRAEFTE; i++) {
  const s = await anfrage('vorbereitung', '/api/v1/verwaltung/zugangsschluessel', { methode: 'POST', json: { bezeichnung: `Lasttest Lehrkraft ${i + 1}` }, cookie: vCookie });
  const a = await anfrage('vorbereitung', '/api/v1/anmeldung/schluessel', { methode: 'POST', json: { schluessel: s.daten.schluessel } });
  const cookie = a.kopf.get('set-cookie').split(';')[0];
  const lg = await anfrage('vorbereitung', '/api/v1/lerngruppen', { methode: 'POST', json: { bezeichnung: `Klasse ${5 + (i % 3)}${String.fromCharCode(97 + (i % 4))}`, klassenstufe: 5 + (i % 3), einwilligung: true }, cookie });
  const q = await anfrage('vorbereitung', `/api/v1/lerngruppen/${lg.daten.id}/freigaben`, { methode: 'POST', json: { titel: 'Lasttest Projekttag', zeitrahmen: 'projekttag', orte: orte.map((o) => ({ ort: o.id })) }, cookie });
  const gruppen = [];
  for (let k = 0; k < gruppenJeLehrkraft && codes.length < SITZUNGEN; k++) {
    const g = await anfrage('vorbereitung', `/api/v1/freigaben/${q.daten.id}/gruppen`, { methode: 'POST', json: { bezeichnung: `Gruppe ${k + 1}`, bestaetigt: true }, cookie });
    if (g.status !== 201) throw new Error(`Gruppe nicht angelegt: ${g.status} ${g.text}`);
    gruppen.push(g.daten.id);
    codes.push(g.daten.code);
  }
  lehrkraefte.push({ cookie, quest: q.daten.id, gruppen });
}
const vorbereitungMs = Date.now() - beginnVorbereitung;
console.log(`Vorbereitung: ${LEHRKRAEFTE} Lehrkräfte, ${codes.length} Gruppen, ${orte.length} Orte, ${inhalte.dateien.length} Dateien je Gerät (${Math.round(inhalte.gesamtBytes / 1024)} KB), ${vorbereitungMs} ms`);
messwerte.delete('vorbereitung');

const bildPng = testbild().toString('base64');
const vorschau = webpKopf().toString('base64');
const start = Date.now();
const ende = start + DAUER;
let laufendeSitzungen = 0;
let maxGleichzeitig = 0;
const zaehler = { beitritte: 0, laeufe: 0, bilder: 0, stationen: 0 };

async function geraet(code) {
  await schlafe(zufall(0, RAMPE));
  laufendeSitzungen++;
  maxGleichzeitig = Math.max(maxGleichzeitig, laufendeSitzungen);
  try {
    await anfrage('seite', '/');
    await anfrage('konfiguration', '/konfiguration.json');
    await anfrage('offline-liste', '/offline-liste.json');
    // Vorladen wie der Service Worker: in Gruppen zu acht
    for (let i = 0; i < inhalte.dateien.length; i += 8) await Promise.all(inhalte.dateien.slice(i, i + 8).map((d) => anfrage('statisch', `/${d.pfad}`, { roh: true })));
    const b = await anfrage('beitritt', '/api/v1/beitritt', { methode: 'POST', json: { code } });
    if (b.status !== 200) return;
    zaehler.beitritte++;
    const token = b.daten.token;
    let bildGesendet = false;
    const reihenfolge = [...orte].sort(() => Math.random() - 0.5);
    for (let runde = 0; Date.now() < ende; runde++) {
      for (const ort of reihenfolge) {
        if (Date.now() >= ende) break;
        const begonnen = new Date().toISOString();
        await anfrage('sync', '/api/v1/sync', { methode: 'POST', token, json: { schluessel: randomUUID(), stationen: [{ ort: ort.id, status: 'begonnen', verifikation: Math.random() < 0.5 ? 'qr' : 'ersatz', begonnen, aktivSekunden: 0 }] } });
        zaehler.stationen++;
        const aufgaben = aufgabenJeOrt.get(ort.id);
        for (const [i, a] of aufgaben.entries()) {
          await schlafe(zufall(DENK_MIN, DENK_MAX));
          if (Date.now() >= ende) break;
          const ereignisse = [{ art: 'versuch', zeit: 20_000, wert: Math.random() < 0.7 }, { art: 'hilfe', zeit: 25_000, wert: 1 }, { art: 'versuch', zeit: 60_000, wert: true }];
          if (Array.isArray(a.rollen)) for (const r of a.rollen) ereignisse.push({ art: 'rolle', zeit: 30_000, wert: r });
          const letzte = i === aufgaben.length - 1;
          await anfrage('sync', '/api/v1/sync', { methode: 'POST', token, json: {
            schluessel: randomUUID(),
            laeufe: [{ id: randomUUID(), aufgabe: `${ort.id}/${a.nr}`, geloest: true, versuche: 2, dauerSekunden: 300, items: a.belohnung ?? [], ereignisse, beendet: new Date().toISOString() }],
            stationen: letzte ? [{ ort: ort.id, status: 'abgeschlossen', begonnen, beendet: new Date().toISOString(), aktivSekunden: 600 }] : [],
          } });
          zaehler.laeufe++;
        }
        if (ort.id === orteIndex.finale && !bildGesendet && Date.now() < ende) {
          const r = await anfrage('bildbeitrag', '/api/v1/bildbeitraege', { methode: 'POST', token, json: { metadaten: { kennung: randomUUID(), erstellt: new Date().toISOString(), art: 'item-collage', items: bildItems }, png: bildPng, vorschau } });
          if (r.status === 201) { zaehler.bilder++; bildGesendet = true; }
        }
      }
    }
  } finally {
    laufendeSitzungen--;
  }
}

const inhalteItems = (await (await fetch(`${APP}/inhalte/items.json`)).json()).map((i) => i.id);
const bildItems = [...new Set((aufgabenJeOrt.get(orteIndex.finale) ?? []).flatMap((a) => a.belohnung ?? []))].slice(0, 3);
if (!bildItems.length) bildItems.push(inhalteItems[0]);

async function lehrkraft(l) {
  await schlafe(zufall(0, 60_000));
  let naechsteAuswertung = Date.now() + zufall(60_000, 120_000);
  while (Date.now() < ende) {
    await anfrage('lk-uebersicht', `/api/v1/freigaben/${l.quest}`, { cookie: l.cookie });
    if (Date.now() >= naechsteAuswertung) {
      await anfrage('lk-auswertung', `/api/v1/gruppen/${l.gruppen[Math.floor(Math.random() * l.gruppen.length)]}/auswertung`, { cookie: l.cookie });
      naechsteAuswertung = Date.now() + 120_000;
    }
    await schlafe(10_000);
  }
}

const zwischenstaende = [];
const beobachter = setInterval(() => {
  const s = Math.round((Date.now() - start) / 1000);
  zwischenstaende.push({ sekunde: s, sitzungen: laufendeSitzungen, ...zaehler });
  if (s % 60 < 10) console.log(`${s} s: ${laufendeSitzungen} Sitzungen aktiv, ${zaehler.laeufe} Läufe, ${zaehler.bilder} Bilder`);
}, 10_000);

await Promise.all([...codes.map(geraet), ...lehrkraefte.map(lehrkraft)]);
clearInterval(beobachter);

const perzentil = (sortiert, p) => sortiert[Math.min(sortiert.length - 1, Math.floor((p / 100) * sortiert.length))];
const auswertung = {};
let gesamt = 0;
let fehlerGesamt = 0;
for (const [art, m] of messwerte) {
  const s = m.zeiten.sort((a, b) => a - b);
  gesamt += s.length;
  fehlerGesamt += m.fehler;
  auswertung[art] = { anfragen: s.length, fehler: m.fehler, fehlerquote: s.length ? m.fehler / s.length : 0, p50: Math.round(perzentil(s, 50)), p95: Math.round(perzentil(s, 95)), p99: Math.round(perzentil(s, 99)), max: Math.round(s.at(-1) ?? 0), status: m.status };
}
const ergebnis = {
  art: 'simuliert', zeitpunkt: new Date(start).toISOString(), app: APP,
  parameter: { sitzungen: SITZUNGEN, gruppenJeKlasse: GRUPPEN_JE_KLASSE, dauerMinuten: DAUER / 60000, rampeMinuten: RAMPE / 60000, denkzeitSekunden: [DENK_MIN / 1000, DENK_MAX / 1000], lehrkraefte: LEHRKRAEFTE, orte: orte.length, aufgaben: [...aufgabenJeOrt.values()].reduce((s, a) => s + a.length, 0), dateienJeGeraet: inhalte.dateien.length, bytesJeGeraet: inhalte.gesamtBytes, bildBytes: Buffer.from(bildPng, 'base64').length },
  dauerSekunden: Math.round((Date.now() - start) / 1000), maxGleichzeitig, zaehler,
  anfragen: gesamt, fehler: fehlerGesamt, fehlerquote: gesamt ? fehlerGesamt / gesamt : 0,
  jeArt: auswertung, ersteFehler: fehlerListe, verlauf: zwischenstaende,
};
writeFileSync(`${AUSGABE}/last-${SITZUNGEN}.json`, JSON.stringify(ergebnis, null, 2));
console.log(`\n${SITZUNGEN} simulierte Sitzungen, ${ergebnis.dauerSekunden} s: ${gesamt} Anfragen, ${fehlerGesamt} Fehler (${(ergebnis.fehlerquote * 100).toFixed(3)} %), höchstens ${maxGleichzeitig} gleichzeitig`);
for (const [art, a] of Object.entries(auswertung)) console.log(`  ${art.padEnd(14)} ${String(a.anfragen).padStart(7)}  p50 ${a.p50} ms  p95 ${a.p95} ms  p99 ${a.p99} ms  max ${a.max} ms  Fehler ${a.fehler}`);
process.exit(0);
