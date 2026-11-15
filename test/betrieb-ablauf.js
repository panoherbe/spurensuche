// Schritte des Betriebstests (tools/betriebstest.sh) über die Schnittstelle, wie die Betriebsseite und eine Lehrkraft
// sie auslösen. Läuft in einem Container im Netz der Testinstanz. Cookies bleiben zwischen den Aufrufen in einer
// Zustandsdatei. Ausgabe: eine Zeile JSON je Aufruf.
//   node test/betrieb-ablauf.js anlegen <bezeichnung> | zaehlen | zustand | version-zurueck
import { readFileSync, writeFileSync } from 'node:fs';
import { klient } from './hilfe.js';

const APP = process.env.APP_URL ?? 'http://spurensuche:8080';
const ZUSTAND = process.env.ZUSTAND ?? '/tmp/betriebstest-zustand.json';
const [schritt, wert] = process.argv.slice(2);
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

let gespeichert = {};
try { gespeichert = JSON.parse(readFileSync(ZUSTAND, 'utf8')); } catch { /* erster Aufruf */ }
const mitCookies = (name) => { const k = klient(APP); for (const [n, w] of Object.entries(gespeichert[name] ?? {})) k.cookies.set(n, w); return k; };
const merke = (name, k) => { gespeichert[name] = Object.fromEntries(k.cookies); writeFileSync(ZUSTAND, JSON.stringify(gespeichert)); };

async function betrieb() {
  const b = mitCookies('betrieb');
  if ((await b.anfrage('/api/v1/ich')).daten?.rolle !== 'betrieb') {
    const r = await b.anfrage('/api/v1/anmeldung/betrieb', { methode: 'POST', json: { schluessel: process.env.BETRIEB_SCHLUESSEL } });
    if (r.status !== 200) throw new Error(`Anmeldung Betrieb: ${r.status}`);
    merke('betrieb', b);
  }
  return b;
}

async function lehrkraft() {
  const l = mitCookies('lehrkraft');
  if ((await l.anfrage('/api/v1/ich')).daten?.rolle === 'lehrkraft') return l;
  const v = klient(APP);
  if ((await v.anfrage('/api/v1/anmeldung/verwaltung', { methode: 'POST', json: { schluessel: process.env.VERWALTUNG_SCHLUESSEL } })).status !== 200) throw new Error('Anmeldung Verwaltung');
  const z = await v.anfrage('/api/v1/verwaltung/zugangsschluessel', { methode: 'POST', json: { bezeichnung: 'Betriebstest' } });
  if ((await l.anfrage('/api/v1/anmeldung/schluessel', { methode: 'POST', json: { schluessel: z.daten.schluessel } })).status !== 200) throw new Error('Anmeldung Lehrkraft');
  merke('lehrkraft', l);
  return l;
}

const aus = (o) => console.log(JSON.stringify(o));

if (schritt === 'anlegen') {
  const l = await lehrkraft();
  const r = await l.anfrage('/api/v1/lerngruppen', { methode: 'POST', json: { bezeichnung: wert, klassenstufe: 6, einwilligung: true } });
  if (r.status !== 201) throw new Error(`Lerngruppe: ${r.status}`);
  aus({ angelegt: wert });
} else if (schritt === 'zaehlen') {
  const l = await lehrkraft();
  const r = await l.anfrage('/api/v1/lerngruppen');
  aus({ lerngruppen: r.daten.map((x) => x.bezeichnung).sort() });
} else if (schritt === 'zustand') {
  const z = (await (await betrieb()).anfrage('/api/v1/betrieb/zustand')).daten;
  aus({ gesamt: z.gesamt, version: z.version, knoepfe: z.knoepfe, punkte: Object.fromEntries(z.punkte.map((p) => [p.id, p.stufe])) });
} else if (schritt === 'version-zurueck') {
  const b = await betrieb();
  const beginn = Date.now();
  const r = await b.anfrage('/api/v1/betrieb/version-zurueck', { methode: 'POST', json: { bestaetigt: true } });
  if (r.status !== 202) throw new Error(`Auftrag: ${r.status} ${JSON.stringify(r.daten)}`);
  let a = null;
  let unerreichbar = 0;
  while (Date.now() - beginn < 300_000) {
    await pause(1000);
    try { a = (await b.anfrage(`/api/v1/betrieb/auftraege/${r.daten.auftrag}`)).daten; } catch { unerreichbar++; continue; }
    if (a?.status === 'fertig' || a?.status === 'fehler') break;
  }
  aus({ auftrag: r.daten.auftrag, von: r.daten.von, auf: r.daten.auf, status: a?.status, meldung: a?.meldung, dauerMs: Date.now() - beginn, sekundenOhneAntwort: unerreichbar });
} else {
  console.error('Aufruf: node test/betrieb-ablauf.js anlegen <bezeichnung> | zaehlen | zustand | version-zurueck');
  process.exit(2);
}
