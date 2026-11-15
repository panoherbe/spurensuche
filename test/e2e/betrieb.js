// Prüflauf der Betriebsseite im Browser (compose.betrieb.yaml): öffentliche Statusseite, Anmeldung, Ampel, und jeder
// Knopf wirklich gedrückt: Neustart (Docker startet den Container neu), Sicherung anlegen und zurückspielen (Daten
// danach auf dem Stand der Sicherung), Inhalt tauschen (gutes Paket aktiv, fehlerhaftes abgelehnt, zurück),
// letzte Version zurückspielen (der Betriebsdienst am Server ist hier nachgestellt; der echte Versionswechsel ist in
// tools/betriebstest.sh gemessen). axe-core auf jeder Ansicht, auch Telefon und dunkel.

import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { seite, js, klick, klickWahl, tippe, warteText, foto, schritt, axe, sammleProtokoll, abschluss, pause, AUSGABE } from './werkzeug.js';
import { klient } from '../hilfe.js';
import { zip } from '../../app/js/kern/zip.js';

const APP = process.env.APP_URL ?? 'http://localhost:8080';
const BETRIEB = process.env.BETRIEB_SCHLUESSEL ?? 'TEST-BETR-IEB1-2345';
const AGENT = process.env.AGENT_TOKEN ?? '';
const messung = {};
const erlaubt = [/ERR_CONNECTION_(REFUSED|RESET)|ERR_EMPTY_RESPONSE|Failed to fetch|status of (401|409|422)/];

async function warteBis(fn, zeit = 30000) {
  const ende = Date.now() + zeit;
  while (Date.now() < ende) { try { const w = await fn(); if (w) return w; } catch { /* noch nicht */ } await pause(300); }
  throw new Error('Zeit abgelaufen');
}

// Daten anlegen wie eine Lehrkraft (für den Vergleich nach dem Zurückspielen)
const v = klient(APP);
const lk = klient(APP);
async function lerngruppe(bezeichnung) {
  const r = await lk.anfrage('/api/v1/lerngruppen', { methode: 'POST', json: { bezeichnung, klassenstufe: 6, einwilligung: true } });
  if (r.status !== 201) throw new Error(`Lerngruppe ${r.status}`);
}
const lerngruppen = async () => (await lk.anfrage('/api/v1/lerngruppen')).daten.map((l) => l.bezeichnung).sort();
const agent = (felder) => fetch(`${APP}/api/v1/betrieb/agent`, { method: 'POST', headers: { Authorization: `Bearer ${AGENT}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(felder) }).then((r) => r.text());

/** Inhaltspaket aus den Testinhalten, wahlweise mit geändertem Ortsnamen oder einer verbotenen Datei. */
async function paket({ name = null, boese = false } = {}) {
  const wurzel = '/app/test/fixtures/inhalt';
  const dateien = [];
  async function gehe(pfad) {
    for (const e of await readdir(pfad, { withFileTypes: true })) {
      const voll = join(pfad, e.name);
      if (e.isDirectory()) await gehe(voll);
      else dateien.push({ name: relative(wurzel, voll).split(sep).join('/'), inhalt: await readFile(voll) });
    }
  }
  await gehe(join(wurzel, 'inhalte'));
  await gehe(join(wurzel, 'assets', 'spiele'));
  const aus = dateien.map((d) => (name && d.name === 'inhalte/testort-nord/ort.json' ? { name: d.name, inhalt: JSON.stringify({ ...JSON.parse(d.inhalt), name }) } : d));
  if (boese) aus.push({ name: 'inhalte/zusatz.js', inhalt: 'alert(1)' }, { name: 'spiele/neu/index.js', inhalt: 'x' });
  return Buffer.from(zip(aus)).toString('base64');
}
const waehleDatei = (s, base64, name) => js(s, `(() => {
  const b = Uint8Array.from(atob(${JSON.stringify(base64)}), (c) => c.charCodeAt(0));
  const dt = new DataTransfer();
  dt.items.add(new File([b], ${JSON.stringify(name)}, { type: 'application/zip' }));
  const i = document.getElementById('k-inhalt-datei');
  i.files = dt.files;
  i.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
const ortName = async () => JSON.parse((await klient(APP).anfrage('/inhalte/testort-nord/ort.json')).text).name;

const s = await seite({ breite: 1280, hoehe: 1000 });

await schritt('Öffentliche Statusseite', async () => {
  await s.gehe(`${APP}/status.html`);
  await warteText(s, 'Die Spurensuche läuft.');
  await foto(s, 'b01-status');
  await axe(s, 'b-status');
});

await schritt('Anmeldung: falscher Schlüssel, dann richtig', async () => {
  await s.gehe(`${APP}/betrieb.html`);
  await warteText(s, 'Betriebsschlüssel');
  await axe(s, 'b-anmeldung');
  await tippe(s, '#b-schluessel', 'FALSCH-0000');
  await klick(s, 'Anmelden', 'button');
  await warteText(s, 'Der Schlüssel stimmt nicht');
  await axe(s, 'b-anmeldung-fehler');
  await tippe(s, '#b-schluessel', BETRIEB.toLowerCase());
  await klick(s, 'Anmelden', 'button');
  await warteText(s, 'Was Sie tun können');
  messung.punkte = await js(s, `document.querySelectorAll('#b-punkte > li').length`);
  messung.ampel = await js(s, `document.querySelector('#b-ampel h2').textContent`);
  if (messung.punkte !== 11) throw new Error(`${messung.punkte} Punkte statt 11`);
  await foto(s, 'b02-uebersicht');
  await axe(s, 'b-uebersicht');
});

await schritt('Telefon, dunkel', async () => {
  const t = await seite({ breite: 390, hoehe: 844, mobil: true, dunkel: true });
  await t.gehe(`${APP}/betrieb.html`);
  await warteText(t, 'Was Sie tun können');
  messung.telefonBreite = await js(t, `document.documentElement.scrollWidth`);
  if (messung.telefonBreite > 390) throw new Error(`waagrecht scrollbar: ${messung.telefonBreite}px`);
  await foto(t, 'b03-telefon-dunkel');
  await axe(t, 'b-uebersicht-telefon-dunkel');
  await t.gehe(`${APP}/status.html`);
  await warteText(t, 'Die Spurensuche läuft.');
  await axe(t, 'b-status-telefon-dunkel');
  sammleProtokoll('telefon', t, erlaubt);
  t.schliesse();
});

await schritt('Neustart: Knopf, Bestätigung, Docker startet neu, Seite meldet die Dauer', async () => {
  const vorher = (await klient(APP).anfrage('/api/v1/status')).daten.gestartet;
  await klick(s, 'Neu starten …', 'button');
  await warteText(s, 'Anwendung neu starten?');
  await axe(s, 'b-neustart-frage');
  const t0 = Date.now();
  await klick(s, 'Jetzt neu starten', 'dialog button');
  await warteText(s, 'Die Anwendung ist wieder erreichbar', 90000);
  messung.neustartMs = Date.now() - t0;
  messung.neustartSeite = await js(s, `document.querySelector('dialog p[role=status]').textContent`);
  const danach = (await klient(APP).anfrage('/api/v1/status')).daten.gestartet;
  if (danach === vorher) throw new Error('Startzeit unverändert: kein Neustart');
  await axe(s, 'b-neustart-fertig');
  await foto(s, 'b04-neustart-fertig', { ganz: false });
  await klick(s, 'Schließen', 'dialog button');
  await warteText(s, 'Was Sie tun können');
});

await schritt('Sicherung anlegen und zurückspielen: Daten auf dem Stand der Sicherung, Betrieb bleibt angemeldet', async () => {
  if ((await v.anfrage('/api/v1/anmeldung/verwaltung', { methode: 'POST', json: { schluessel: 'TEST-VERWALTUNG' } })).status !== 200) throw new Error('Verwaltung');
  const z = await v.anfrage('/api/v1/verwaltung/zugangsschluessel', { methode: 'POST', json: { bezeichnung: 'Prüflauf Betrieb' } });
  if ((await lk.anfrage('/api/v1/anmeldung/schluessel', { methode: 'POST', json: { schluessel: z.daten.schluessel } })).status !== 200) throw new Error('Lehrkraft');
  await lerngruppe('Klasse 6a vor der Sicherung');
  await klick(s, 'Sicherung jetzt anlegen', 'button');
  await warteText(s, 'Sicherung angelegt');
  await pause(1200);
  await lerngruppe('Klasse 6b nach der Sicherung');
  messung.vorDemZurueckspielen = await lerngruppen();
  await s.gehe(`${APP}/betrieb.html`);
  await warteText(s, 'Welcher Stand?');
  messung.sicherungAuswahl = await js(s, `document.querySelector('label[for="' + document.querySelector('input[name=k-sicherung]:checked').id + '"]').textContent`);
  if (!/von Hand angelegt/.test(messung.sicherungAuswahl)) throw new Error(`gewählt: ${messung.sicherungAuswahl}`);
  await klick(s, 'Zurückspielen …', 'button');
  await warteText(s, 'Sicherung zurückspielen?');
  if (!(await js(s, `[...document.querySelectorAll('dialog button')].find((b) => b.textContent.trim() === 'Zurückspielen').disabled`))) throw new Error('Knopf ohne Bestätigung frei');
  await klickWahl(s, '#z-verstanden');
  await axe(s, 'b-zurueckspielen-frage');
  await foto(s, 'b05-zurueckspielen-frage', { ganz: false });
  const t0 = Date.now();
  await js(s, `([...document.querySelectorAll('dialog button')].find((b) => b.textContent.trim() === 'Zurückspielen').click(), true)`);
  await warteText(s, 'ist zurückgespielt', 90000);
  messung.zurueckspielenMs = Date.now() - t0;
  messung.nachDemZurueckspielen = await warteBis(async () => { const l = await lerngruppen(); return l; });
  if (messung.nachDemZurueckspielen.join() !== 'Klasse 6a vor der Sicherung') throw new Error(`Lerngruppen ${messung.nachDemZurueckspielen.join(', ')}`);
  await axe(s, 'b-zurueckgespielt');
  await klick(s, 'Schließen', 'dialog button');
  await warteText(s, 'Zuletzt zurückgespielt');
  messung.betriebAngemeldet = await js(s, `!!document.querySelector('#b-ampel')`);
  messung.sicherungVorDemZurueckspielen = await js(s, `[...document.querySelectorAll('.sicherungswahl label')].some((o) => o.textContent.includes('vor dem Zurückspielen'))`);
  if (!messung.sicherungVorDemZurueckspielen) throw new Error('keine Sicherung „vor dem Zurückspielen“ in der Liste');
});

await schritt('Inhalt tauschen: prüfen, aktivieren, Fehlerhaftes ablehnen, zurück', async () => {
  messung.ortVorher = await ortName();
  await waehleDatei(s, await paket({ name: 'Testort Nord (aus dem Paket)' }), 'Inhalt Prüflauf.zip');
  await klick(s, 'Prüfen', 'button');
  await warteText(s, 'Geprüft, keine Fehler');
  await axe(s, 'b-inhalt-geprueft');
  await foto(s, 'b06-inhalt-geprueft', { ganz: false });
  await klick(s, 'Jetzt aktivieren …', 'button');
  await klick(s, 'Aktivieren', 'dialog button');
  await warteText(s, 'Jetzt aktiv: Inhalt Prüflauf.zip');
  messung.ortAktiv = await ortName();
  if (messung.ortAktiv !== 'Testort Nord (aus dem Paket)') throw new Error(`Ort ${messung.ortAktiv}`);
  await waehleDatei(s, await paket({ boese: true }), 'mit Programmcode.zip');
  await klick(s, 'Prüfen', 'button');
  await warteText(s, 'Nicht übernommen');
  messung.ablehnung = await js(s, `document.querySelector('.k-inhalt-ergebnis').innerText.slice(0, 400)`);
  await axe(s, 'b-inhalt-fehler');
  await foto(s, 'b07-inhalt-fehler', { ganz: false });
  if ((await ortName()) !== messung.ortAktiv) throw new Error('Abgelehntes Paket hat etwas verändert');
  await klick(s, 'Vorherigen Inhalt wiederherstellen', 'button');
  await klick(s, 'Wiederherstellen', 'dialog button');
  await warteText(s, 'Jetzt aktiv: mitgelieferter Inhalt');
  messung.ortZurueck = await ortName();
  if (messung.ortZurueck !== messung.ortVorher) throw new Error(`Ort ${messung.ortZurueck}`);
});

await schritt('Letzte Version zurückspielen: ohne Betriebsdienst gesperrt, mit Betriebsdienst ausgeführt', async () => {
  await s.gehe(`${APP}/betrieb.html`);
  await warteText(s, 'Installiert:');
  messung.ohneDienst = await js(s, `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Letzte Version zurückspielen')).disabled`);
  if (!messung.ohneDienst) throw new Error('Knopf ohne Betriebsdienst frei');
  // Betriebsdienst nachstellen (im echten Betrieb: betrieb/spur wache auf dem Server)
  await agent({ version: '0.1.1-pruefung', vorher: '0.1.0', gesund: 'healthy' });
  await s.gehe(`${APP}/betrieb.html`);
  await warteText(s, 'davor: 0.1.0');
  await klick(s, 'Letzte Version zurückspielen …', 'button');
  await warteText(s, 'von Version 0.1.1-pruefung auf 0.1.0');
  await axe(s, 'b-version-frage');
  const t0 = Date.now();
  await klick(s, 'Zurückspielen', 'dialog button');
  const zeile = await warteBis(async () => { const a = await agent({ version: '0.1.1-pruefung', vorher: '0.1.0' }); return /^auftrag (\d+) version-zurueck$/m.exec(a)?.[1]; }, 20000);
  await pause(1500);
  await agent({ version: '0.1.0', vorher: '', erledigt: zeile, ok: '1', meldung: 'Version 0.1.0 läuft wieder (Betriebsdienst im Prüflauf nachgestellt).' });
  await warteText(s, 'Erledigt nach', 20000);
  messung.versionAuftragMs = Date.now() - t0;
  await axe(s, 'b-version-fertig');
  await foto(s, 'b08-version-fertig', { ganz: false });
  await klick(s, 'Schließen', 'dialog button');
  await warteText(s, 'Protokoll');
  messung.protokoll = await js(s, `[...document.querySelectorAll('[aria-label="Protokoll des Betriebs"] tbody tr td:nth-child(2)')].map((t) => t.textContent).slice(0, 12)`);
  await axe(s, 'b-ende');
});

await schritt('Bild für das README: Betriebsseite auf dem iPad hochkant (doppelte Auflösung)', async () => {
  // Betriebsdienst wie im Betrieb: Version der Prüfung installiert, die vorige verfügbar (Knopf frei)
  await agent({ version: '0.1.1-pruefung', vorher: '0.1.0', gesund: 'healthy' });
  const k = await seite({ breite: 820, hoehe: 1180, mobil: true });
  await k.sende('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true });
  await k.gehe(`${APP}/betrieb.html`);
  await warteText(k, 'Was Sie tun können');
  await pause(600);
  const { data } = await k.sende('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  mkdirSync(`${AUSGABE}/konzept`, { recursive: true });
  writeFileSync(`${AUSGABE}/konzept/5-betriebsseite.png`, Buffer.from(data, 'base64'));
  messung.konzeptAmpel = await js(k, `document.querySelector('#b-ampel h2').textContent`);
  k.schliesse();
});

sammleProtokoll('betrieb', s, erlaubt);
abschluss('betrieb-seite.json', { messung, hinweis: 'Neustart, Zurückspielen und Inhalt tauschen echt (Docker, Volume). Den Betriebsdienst für „letzte Version zurückspielen“ stellt dieser Prüflauf nach; der echte Versionswechsel steht in betriebstest.json.' });
