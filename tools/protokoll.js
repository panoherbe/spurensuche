#!/usr/bin/env node
// Erzeugt PROTOKOLL.md eines Messlaufs aus den Ergebnisdateien im Ordner. Keine Zahl wird von Hand geschrieben:
// Jede Zeile nennt die Datei, aus der sie stammt. Aufruf: node tools/protokoll.js nachweis/<datum>
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ordner = process.argv[2];
const lies = (n) => (existsSync(join(ordner, n)) ? readFileSync(join(ordner, n), 'utf8') : null);
const json = (n) => { const t = lies(n); try { return t ? JSON.parse(t) : null; } catch { return null; } };
const zahl = (n, stellen = 0) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
const mb = (b) => `${zahl(b / 1048576, 1)} MB`;
const zeilen = [];
const z = (...t) => zeilen.push(t.join(''));

const stand = (lies('stand.txt') ?? '').trim();
z(`# Messprotokoll ${ordner.split('/').pop()}`);
z('');
z(`> Erzeugt mit \`tools/protokoll.js\` aus den Dateien dieses Ordners. Stand des Codes: ${stand ? `\`${stand}\`` : 'nicht angegeben'}.`);
z('> **Alle Nutzerinnen und Nutzer in diesen Messungen sind simuliert**: Ein Skript klickt im Browser oder schickt Anfragen.');
z('> Es gab keine echten Schulklassen, Lehrkräfte oder Familien.');
z('');

const vorher = lies('rechner-vorher.txt');
if (vorher) {
  z('## Rechner');
  z('');
  z(`- Last vor dem Lauf: \`${vorher.split('\n')[0].trim()}\` (rechner-vorher.txt)`);
  const nachher = lies('rechner-nachher.txt');
  if (nachher) z(`- Last nach dem Lauf: \`${nachher.trim()}\` (rechner-nachher.txt)`);
  z(`- Node.js im Container: ${(lies('node-version.txt') ?? '–').trim()} (node-version.txt)`);
  z('');
}

const tap = lies('tests.tap');
if (tap) {
  const w = (k) => Number(new RegExp(`^# ${k} (\\d+)`, 'm').exec(tap)?.[1] ?? NaN);
  z('## Automatische Tests');
  z('');
  z(`- **${w('pass')} von ${w('tests')}** bestanden, ${w('fail')} fehlgeschlagen, Dauer ${zahl(w('duration_ms') / 1000, 1)} s (tests.tap)`);
  z('');
}

const inhalte = lies('inhalte.txt');
if (inhalte) { z('## Inhalte'); z(''); z(`- ${inhalte.trim().split('\n').at(-1)} (inhalte.txt)`); z(''); }

const qrErw = json('qr/erwartet.json');
const qrGel = lies('qr/zbar.txt');
if (qrErw && qrGel) {
  const gelesen = new Map(qrGel.split('\n').filter((l) => l.startsWith('qr-')).map((l) => { const [d, ...t] = l.split('\t'); return [d, t.join('\t')]; }));
  const ok = qrErw.filter((e) => gelesen.get(e.datei) === e.text).length;
  z('## QR-Codes');
  z('');
  z(`- **${ok} von ${qrErw.length}** QR-Codes des eigenen Erzeugers von einem fremden Decoder (${qrGel.split('\n')[0].trim()}) korrekt gelesen; Versionen ${[...new Set(qrErw.map((e) => e.version))].sort((a, b) => a - b).join(', ')} (qr/erwartet.json, qr/zbar.txt)`);
  z('');
}

function axeZeile(datei) {
  const r = json(datei);
  if (!r?.barrierefreiheit) return null;
  const eintraege = Object.entries(r.barrierefreiheit);
  const mit = eintraege.filter(([, x]) => x.verstoesse?.length);
  const nicht = eintraege.filter(([, x]) => x.fehler);
  return { r, ansichten: eintraege.length, mitVerstoss: mit.length, nichtGeprueft: nicht.length, verstoesse: mit.flatMap(([n, x]) => x.verstoesse.map((v) => `${n}: ${v.id} (${v.stellen})`)) };
}
z('## Browser-Prüfläufe (Chrome ohne Oberfläche, simuliert)');
z('');
for (const [datei, titel] of [['browser/rauchtest.json', 'Instanz mit Testinhalten'], ['browser/vorfuehrung.json', 'Vorführung mit echten Inhalten'], ['browser/spiele.json', 'alle Spiele der echten Inhalte'], ['browser/betrieb-seite.json', 'Betriebsseite (Knöpfe wirklich gedrückt)']]) {
  const a = axeZeile(datei);
  if (!a) continue;
  z(`### ${titel}`);
  z('');
  z(`- Schritte: ${a.r.schritte.length} Bildschirmfotos, **${a.r.fehler.length} Fehler** (${datei})`);
  z(`- axe-core ${a.r.axe} (WCAG 2.0/2.1 A und AA): **${a.ansichten} Ansichten, ${a.mitVerstoss} mit Verstößen**${a.nichtGeprueft ? `, ${a.nichtGeprueft} nicht geprüft` : ''}`);
  for (const v of a.verstoesse) z(`  - ${v}`);
  const m = a.r.messung ?? {};
  if (m.offlinePaket) z(`- Offline-Paket: ${m.offlinePaket.vorhanden} von ${m.offlinePaket.dateien} Dateien im Gerät, ${mb(m.offlinePaket.bytes)}`);
  if (m.offlineGeladen) z('- Ohne Netz neu geladen und gespielt: ja');
  if (m.ausgangOffline) z(`- Anzeige ohne Netz: „${m.ausgangOffline}“, nach Rückkehr des Netzes: „${m.nachOnline}“`);
  if (m.auswertungSaetze) z(`- Auswertung danach: „${m.auswertungSaetze.find((s) => s.includes('Aufgaben gelöst')) ?? '–'}“ (ohne Doppelzählung)`);
  if (m.neustartMs) z(`- Neustart über den Knopf: wieder erreichbar nach **${zahl(m.neustartMs / 1000, 1)} s** (vom Klick bis zur Meldung der Seite; Docker startet den Container neu)`);
  if (m.zurueckspielenMs) z(`- Sicherung zurückspielen über den Knopf: **${zahl(m.zurueckspielenMs / 1000, 1)} s** bis zur Meldung; danach Lerngruppen ${JSON.stringify(m.nachDemZurueckspielen)} (vorher ${JSON.stringify(m.vorDemZurueckspielen)})`);
  if (m.ortAktiv) z(`- Inhalt tauschen: Paket geprüft und aktiviert (Ort heißt „${m.ortAktiv}“), fehlerhaftes Paket abgelehnt, vorheriger Inhalt wiederhergestellt („${m.ortZurueck}“)`);
  if (m.versionAuftragMs) z(`- Letzte Version zurückspielen: Auftrag bis „Erledigt“ ${zahl(m.versionAuftragMs / 1000, 1)} s (Betriebsdienst in diesem Lauf nachgestellt; echter Wechsel unten im Betriebstest)`);
  for (const f of a.r.fehler) z(`  - Fehler: ${f.split('\n')[0]}`);
  z('');
}

const bt = json('betriebstest.json');
if (bt) {
  const s = (ms) => (Number.isFinite(ms) ? `${zahl(ms / 1000, 1)} s` : '–');
  const vz = typeof bt.versionZurueck === 'object' ? bt.versionZurueck : {};
  z('## Betriebstest: Werkzeug betrieb/spur und Betriebsdienst (simuliert, echte Container)');
  z('');
  z(`- Einrichten (Schlüssel erzeugen, bauen, starten): ${s(bt.einrichtenMs)}; Docker ${bt.docker} (betriebstest.json)`);
  z(`- Neu starten: **${s(bt.neustartMs)}** bis die Anwendung wieder antwortet; Daten danach vollständig`);
  z(`- Sicherung anlegen: ${s(bt.sicherungMs)}; Sicherung zurückspielen: **${s(bt.zurueckspielenMs)}**, danach Stand der Sicherung, jetziger Stand vorher gesichert`);
  z(`- Neue Version einspielen (bauen, Sicherung vorher, starten): ${s(bt.aktualisierenMs)}`);
  z(`- Letzte Version zurück über die Betriebsseite und den Betriebsdienst: **${s(vz.dauerMs)}** vom Knopf bis „Erledigt“ (Status ${vz.status ?? '–'}; ${vz.sekundenOhneAntwort ?? '–'} Sekunden ohne Antwort)`);
  z(`- Defekte neue Version: automatisch zurück auf die laufende Version: ${bt.defektAutomatischZurueck} nach ${s(bt.defektBisZurueckMs)}`);
  z(`- Hänger (Prozess angehalten): vom Betriebsdienst erkannt und neu gestartet nach **${s(bt.haengerBisWiederDaMs)}**`);
  z(`- **${bt.fehler} Fehler** in den Prüfungen (betriebstest.log)`);
  z('');
}

const nb = json('nachbau.json');
if (nb) {
  z('## Nachbau aus frischem Klon');
  z('');
  z(`- **${zahl(nb.sekundenGesamt, 1)} s** vom Klonen bis zur ersten erfolgreichen Statusabfrage (Klonen ${zahl(nb.sekundenKlonen, 1)} s, Bauen ${zahl(nb.sekundenBauen, 1)} s, Starten ${zahl(nb.sekundenStarten, 1)} s); Bau ${nb.bau}; erste verschlüsselte Sicherung: ${nb.ersteSicherung} (nachbau.json)`);
  z('- Hinweis: Das Basis-Image `node:24-alpine` lag auf dem Prüfrechner schon vor; auf einem neuen Rechner kommt sein Herunterladen hinzu.');
  z('');
}

for (const n of [400, 600]) {
  const l = json(`last-${n}.json`);
  if (!l) continue;
  z(`## Lasttest ${n} Sitzungen (simuliert)`);
  z('');
  const p = l.parameter;
  z(`- Ablauf: ${p.sitzungen} simulierte Gruppen-Geräte in ${Math.ceil(p.sitzungen / p.gruppenJeKlasse)} Klassen, Start in den ersten ${p.rampeMinuten} Minuten, ${p.dauerMinuten} Minuten Messdauer, Denkzeit je Aufgabe ${p.denkzeitSekunden.join(' bis ')} s (verdichtet gegenüber 5 bis 10 Minuten im Unterricht), je Gerät App und alle Inhalte geladen (${p.dateienJeGeraet} Dateien, ${mb(p.bytesJeGeraet)}), ein Bildbeitrag von ${mb(p.bildBytes)}, Lehrkräfte rufen alle 10 s die Übersicht ab; Instanz begrenzt auf 2 CPU-Kerne und 2 GB (last-${n}.json)`);
  z(`- **Höchstens ${l.maxGleichzeitig} Sitzungen gleichzeitig**, ${zahl(l.anfragen)} Anfragen, **${l.fehler} Fehler** (${zahl(l.fehlerquote * 100, 3)} %), Dauer ${zahl(l.dauerSekunden)} s`);
  z('');
  z('| Anfrage | Anzahl | p50 | p95 | p99 | max | Fehler |');
  z('|---|---|---|---|---|---|---|');
  for (const [art, a] of Object.entries(l.jeArt)) z(`| ${art} | ${zahl(a.anfragen)} | ${a.p50} ms | ${a.p95} ms | ${a.p99} ms | ${a.max} ms | ${a.fehler} |`);
  const stats = lies(`last-${n}-docker-stats.csv`);
  if (stats) {
    const werte = stats.split('\n').filter(Boolean).map((zeile) => zeile.split(';')).filter((t) => t.length >= 4);
    const cpu = werte.map((t) => parseFloat(t[2])).filter(Number.isFinite);
    const speicher = werte.map((t) => t[3].split('/')[0].trim());
    if (cpu.length) z(`\n- Container während des Laufs (alle 10 s): CPU höchstens ${zahl(Math.max(...cpu), 1)} % (200 % = 2 Kerne), Arbeitsspeicher zuletzt ${speicher.at(-1)} (last-${n}-docker-stats.csv)`);
  }
  z('');
}

const rs = json('rueckspiel.json');
if (rs) {
  z('## Rückspieltest (auf der Datenbank des Lasttests)');
  z('');
  z(`- Datenbank ${mb(rs.datenbankBytes)}, ${rs.tabellen} Tabellen, ${zahl(rs.zeilen)} Zeilen; Sicherung ${zahl(rs.sicherungMs)} ms, Rückspielen ${zahl(rs.rueckspielenMs)} ms; **${rs.gleich ? 'alle Tabellen mit gleicher SHA-256-Prüfsumme' : `${rs.abweichend.length} Tabellen abweichend`}** (rueckspiel.json)`);
  z('');
}
const ar = json('archiv.json');
if (ar) {
  z('## Archiv und Übergabe (auf der Datenbank des Lasttests)');
  z('');
  z(`- Export ${ar.export.dateien} Dateien (${mb(ar.export.zipBytes)}, davon ${ar.export.bildbeitraege} Bildbeiträge) in ${zahl(ar.export.dauerMs)} ms; Prüfung nach BagIt ${ar.pruefung.ok ? 'ohne Fehler' : 'mit Fehlern'}; Übernahme in leere Instanz ${zahl(ar.uebernahme.dauerMs)} ms; **${ar.vergleich.gleich ? `alle ${ar.vergleich.dateien} Prüfsummen gleich` : `${ar.vergleich.abweichend.length} abweichend`}** (archiv.json)`);
  z('');
}

const rueck = lies('rueckgaben.txt');
if (rueck) { z('## Rückgabewerte der Schritte'); z(''); z('```'); z(rueck.trim()); z('```'); z(''); }
z('## Grenzen');
z('');
z('- axe-core findet nur einen Teil der Barrierefreiheitsprobleme; ein Audit nach EN 301 549 ersetzt es nicht.');
z('- Der Lasttest misst Server und Netz im selben Rechner; Funknetze an Schulen und Endgeräte sind nicht Teil der Messung.');
z(`- Dateien in diesem Ordner: ${readdirSync(ordner).filter((d) => !d.endsWith('.png')).join(', ')}`);
writeFileSync(join(ordner, 'PROTOKOLL.md'), `${zeilen.join('\n')}\n`);
console.log(`PROTOKOLL.md: ${zeilen.length} Zeilen`);
