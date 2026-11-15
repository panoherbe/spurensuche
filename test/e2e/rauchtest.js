// Rauchtest im echten Browser (Chrome ohne Oberfläche, über CDP): Familie spielt eine Station, Lehrkraft meldet
// sich über die Attrappe an, legt Lerngruppe, Quest und Gruppe an, eine Schulgruppe tritt bei und spielt, die
// Lehrkraft sieht Übersicht und Auswertung. Bildschirmfotos nach AUSGABE/bilder, Fehler der Seite im Protokoll.
// Alle Personen sind simuliert: Dieses Skript klickt.

import { mkdirSync, writeFileSync } from 'node:fs';
import { Cdp } from './cdp.js';

const APP = process.env.APP_URL ?? 'http://spur:8080';
const AUSGABE = process.env.AUSGABE ?? 'nachweis/tmp';
mkdirSync(`${AUSGABE}/bilder`, { recursive: true });
const fehler = [];
const schritte = [];

async function seite({ breite = 1280, hoehe = 900, mobil = false, dunkel = false, kontext } = {}) {
  const s = await Cdp.neueSeite('http://127.0.0.1:9222', kontext);
  await s.sende('Emulation.setDeviceMetricsOverride', { width: breite, height: hoehe, deviceScaleFactor: 1, mobile: mobil });
  if (dunkel) await s.sende('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  return s;
}

const js = (s, ausdruck) => s.werte(ausdruck);
async function klick(s, text, wahl = 'button, a, label, summary') {
  await s.warte(`[...document.querySelectorAll(${JSON.stringify(wahl)})].some((e) => e.offsetParent !== null && e.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)}))`);
  await js(s, `(() => { const e = [...document.querySelectorAll(${JSON.stringify(wahl)})].find((e) => e.offsetParent !== null && e.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)})); e.scrollIntoView(); e.click(); return true; })()`);
}
async function tippe(s, wahl, wert) {
  await s.warte(`document.querySelector(${JSON.stringify(wahl)})`);
  await js(s, `(() => { const e = document.querySelector(${JSON.stringify(wahl)}); e.focus(); e.value = ${JSON.stringify(wert)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
}
const warteText = (s, text, zeit = 10000) => s.warte(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`, zeit);
/** Seitenwechsel innerhalb der App (nur der Teil nach #): kein neues Laden der Seite */
const springe = (s, ziel) => js(s, `(location.hash = ${JSON.stringify(ziel)}, true)`);
async function foto(s, name) {
  await new Promise((r) => setTimeout(r, 350));
  writeFileSync(`${AUSGABE}/bilder/${name}.png`, await s.bild({ ganz: true }));
  schritte.push(name);
}
async function schritt(name, fn) {
  const t = Date.now();
  try { await fn(); console.log(`✓ ${name} (${Date.now() - t} ms)`); } catch (e) { fehler.push(`${name}: ${e.message}`); console.log(`✗ ${name}: ${e.message.split('\n')[0]}`); }
}

const familie = await seite();
await schritt('Startseite', async () => { await familie.gehe(`${APP}/`); await warteText(familie, 'Wie spielt ihr?'); await foto(familie, '01-start'); });
await schritt('Familie: Teamname', async () => { await klick(familie, 'Als Familie oder Gruppe'); await tippe(familie, '#teamname', 'Die Spurenfinder'); await foto(familie, '02-familie'); await klick(familie, 'Los geht'); await warteText(familie, 'Alle Orte'); await foto(familie, '03-karte'); });
await schritt('Familie: Ort im Klassenzimmer', async () => { await klick(familie, 'Testort Nord', 'button.ortskarte'); await warteText(familie, 'Seid ihr vor Ort?'); await foto(familie, '04-ort'); await klick(familie, 'Im Klassenzimmer spielen'); await warteText(familie, 'Aufgaben (2'); await foto(familie, '05-ort-aufgaben'); });
await schritt('Familie: Aufgabe spielen', async () => {
  await klick(familie, 'Los geht');
  await warteText(familie, 'Welche Farbe');
  await foto(familie, '06-aufgabe');
  await klick(familie, 'Hinweis');
  await klick(familie, 'Rot', 'button[data-antwort]');
  await warteText(familie, 'Noch nicht');
  await klick(familie, 'Grün', 'button[data-antwort]');
  await klick(familie, 'Weiter', 'button');
  await warteText(familie, 'Neu im Sammelbuch');
  await foto(familie, '07-aufgabe-geschafft');
});
await schritt('Familie: Sammelbuch', async () => { await springe(familie, '#/sammlung'); await warteText(familie, 'Sammelbuch'); await foto(familie, '08-sammelbuch'); });
await schritt('Einstellungen', async () => { await js(familie, `(document.querySelector('button[aria-label^="Einstellungen"]').click(), true)`); await warteText(familie, 'Einfache Sprache'); await foto(familie, '09-einstellungen'); await js(familie, 'document.querySelector("dialog")?.close(); true'); });

const lehrkraft = await seite({ kontext: await Cdp.neuerKontext() });
let code = null;
await schritt('Lehrkraft: Anmeldung über Attrappe', async () => {
  await lehrkraft.gehe(`${APP}/lehrkraefte.html`);
  await warteText(lehrkraft, 'Mit Schulkonto');
  await foto(lehrkraft, '10-lk-anmeldung');
  await klick(lehrkraft, 'Mit Schulkonto anmelden', 'a');
  await warteText(lehrkraft, 'Lehrkraft A');
  await foto(lehrkraft, '11-attrappe');
  await klick(lehrkraft, 'Lehrkraft A', 'button');
  await warteText(lehrkraft, 'Ihre Lerngruppen');
});
await schritt('Lehrkraft: Lerngruppe, Quest, Gruppe', async () => {
  await klick(lehrkraft, 'Neue Lerngruppe');
  await tippe(lehrkraft, '#lg-name', 'Klasse 6a');
  await js(lehrkraft, `(() => { const s = document.querySelector('#lg-stufe'); s.value = '6'; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('#lg-einw').checked = true; return true; })()`);
  await foto(lehrkraft, '12-lk-lerngruppe-dialog');
  await klick(lehrkraft, 'Anlegen', 'button');
  await warteText(lehrkraft, 'Klasse 6a');
  await klick(lehrkraft, 'Klasse 6a', 'a');
  await warteText(lehrkraft, 'Quest freigeben');
  await klick(lehrkraft, 'Quest freigeben', 'a');
  await warteText(lehrkraft, 'Zeitrahmen');
  await klick(lehrkraft, 'Projekttag', 'button');
  await foto(lehrkraft, '13-lk-freigeben');
  await klick(lehrkraft, 'Freigeben', 'button[type="submit"]');
  await warteText(lehrkraft, 'Gruppe hinzufügen');
  await klick(lehrkraft, 'Biber', 'button');
  await warteText(lehrkraft, 'Code:');
  code = await js(lehrkraft, `document.querySelector('.code-gross')?.textContent`);
  await foto(lehrkraft, '14-lk-gruppen');
});
const schule = await seite({ breite: 820, hoehe: 1180, mobil: true, kontext: await Cdp.neuerKontext() });
await schritt('Schulgruppe: Beitritt und Spiel', async () => {
  await schule.gehe(`${APP}/#/beitritt`);
  await tippe(schule, '#code', code ?? 'XXXX-XXXX');
  await klick(schule, 'Beitreten', 'button');
  await warteText(schule, 'Ihr seid Gruppe Biber');
  await foto(schule, '15-schule-beitritt');
  await klick(schule, 'Zur Karte', 'a');
  await warteText(schule, 'Alle Orte');
  await foto(schule, '16-schule-karte');
  await springe(schule, '#/ort/testort-nord?code=NORD-1234');
  await warteText(schule, 'vor Ort, QR-Code gescannt');
  await klick(schule, 'Los geht');
  await warteText(schule, 'Welche Farbe');
  await klick(schule, 'Grün', 'button[data-antwort]');
  await klick(schule, 'Weiter', 'button');
  await warteText(schule, 'Nächste Aufgabe');
  await klick(schule, 'Nächste Aufgabe', 'a');
  await warteText(schule, 'zuerst schützen');
  await klick(schule, 'Den Wald', 'button[data-antwort]');
  await klick(schule, 'Alle sind einverstanden', 'button');
  await klick(schule, 'Weiter', 'button');
  await warteText(schule, 'geschafft');
  await foto(schule, '17-schule-ort-geschafft');
  await new Promise((r) => setTimeout(r, 2500)); // Übertragung abwarten
});
await schritt('Lehrkraft: laufende Übersicht und Auswertung', async () => {
  await klick(lehrkraft, 'Laufende Übersicht', 'a');
  await warteText(lehrkraft, 'Zuletzt übertragen');
  await foto(lehrkraft, '18-lk-uebersicht');
  await klick(lehrkraft, 'Auswertung', 'a');
  await warteText(lehrkraft, 'Kompetenzraster');
  await foto(lehrkraft, '19-lk-auswertung');
});

for (const [name, s] of [['familie', familie], ['lehrkraft', lehrkraft], ['schule', schule]]) {
  for (const zeile of s.protokoll.filter((z) => /Ausnahme|console\.error|log: .*(Failed|Refused|error)/i.test(z) && !/Cross-Origin-Opener-Policy/.test(z))) fehler.push(`${name}: ${zeile}`);
}
writeFileSync(`${AUSGABE}/rauchtest.json`, JSON.stringify({ zeitpunkt: new Date().toISOString(), schritte, fehler }, null, 2));
console.log(fehler.length ? `\n${fehler.length} Fehler:\n${fehler.join('\n')}` : '\nKeine Fehler.');
process.exit(fehler.length ? 1 : 0);
