// Betrieb: Anmeldung und Rollen, Ampel, Neustart, Sicherung anlegen und zurückspielen (vorgemerkt, beim Start
// ausgeführt), Inhalt tauschen (Prüfung, Ablehnung, Aktivieren, Zurück, Start mit Paket), Betriebsdienst und
// „letzte Version zurückspielen“, Messreihe, Schema-Erweiterung einer Datenbank der Version 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { starteInstanz, klient, BEISPIEL } from './hilfe.js';
import { oeffne, SCHEMA, SCHEMA_VERSION } from '../server/db.js';
import { sichere, listeSicherungen, vollendeZurueckspielen } from '../server/sicherung.js';
import { liesZip, ordneDateien, PaketFehler } from '../server/inhaltspaket.js';
import { Messreihe } from '../server/betrieb.js';
import { zip, crc32 } from '../app/js/kern/zip.js';

const BETRIEB = 'BETR-IEBS-TEST-1234';
const AGENT = 'agent-token-fuer-die-tests-0123456789';
const jetzt = () => new Date().toISOString();

function ordnerMitDaten() {
  const ordner = mkdtempSync(join(tmpdir(), 'spur-betrieb-'));
  const schluessel = randomBytes(32);
  return {
    ordner,
    schluessel,
    optionen: (extra = {}) => ({
      datenbank: join(ordner, 'spurensuche.db'), datenOrdner: ordner, betriebSchluessel: BETRIEB, betriebAgentToken: AGENT,
      sicherung: { schluessel, ordner: join(ordner, 'sicherungen'), anzahl: 14 }, ...extra,
    }),
    weg: () => rmSync(ordner, { recursive: true, force: true }),
  };
}

async function alsBetrieb(i) {
  const b = klient(i.url);
  assert.equal((await b.anfrage('/api/v1/anmeldung/betrieb', { methode: 'POST', json: { schluessel: BETRIEB.toLowerCase() } })).status, 200);
  return b;
}

async function alsLehrkraft(i) {
  const v = klient(i.url);
  assert.equal((await v.anfrage('/api/v1/anmeldung/verwaltung', { methode: 'POST', json: { schluessel: 'VERW-ALTUNG-TEST' } })).status, 200);
  const s = await v.anfrage('/api/v1/verwaltung/zugangsschluessel', { methode: 'POST', json: { bezeichnung: 'Testschule, Lehrkraft 1' } });
  const l = klient(i.url);
  assert.equal((await l.anfrage('/api/v1/anmeldung/schluessel', { methode: 'POST', json: { schluessel: s.daten.schluessel } })).status, 200);
  return { l, v };
}

async function lerngruppe(l, bezeichnung) {
  const r = await l.anfrage('/api/v1/lerngruppen', { methode: 'POST', json: { bezeichnung, klassenstufe: 6, einwilligung: true } });
  assert.equal(r.status, 201);
  return r.daten.id;
}

/** Alle Dateien unter inhalte/ und assets/spiele/ eines Inhaltsordners als [{ name, inhalt }]. */
async function inhaltsDateien(wurzel) {
  const aus = [];
  async function gehe(pfad) {
    for (const e of await readdir(pfad, { withFileTypes: true })) {
      const voll = join(pfad, e.name);
      if (e.isDirectory()) await gehe(voll);
      else aus.push({ name: relative(wurzel, voll).split(sep).join('/'), inhalt: await readFile(voll) });
    }
  }
  await gehe(join(wurzel, 'inhalte'));
  await gehe(join(wurzel, 'assets', 'spiele'));
  return aus;
}

/** ZIP mit „deflate“ wie von Windows oder macOS (der eigene Packer schreibt ungepackt). */
function zipGepackt(dateien) {
  const lokal = [];
  const zentral = [];
  let versatz = 0;
  for (const { name, inhalt } of dateien) {
    const n = Buffer.from(name, 'utf8');
    const roh = Buffer.from(inhalt);
    const gepackt = deflateRawSync(roh);
    const k = Buffer.alloc(30);
    k.writeUInt32LE(0x04034b50, 0); k.writeUInt16LE(20, 4); k.writeUInt16LE(0x800, 6); k.writeUInt16LE(8, 8);
    k.writeUInt32LE(crc32(roh), 14); k.writeUInt32LE(gepackt.length, 18); k.writeUInt32LE(roh.length, 22); k.writeUInt16LE(n.length, 26);
    lokal.push(k, n, gepackt);
    const z = Buffer.alloc(46);
    z.writeUInt32LE(0x02014b50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt16LE(0x800, 8); z.writeUInt16LE(8, 10);
    z.writeUInt32LE(crc32(roh), 16); z.writeUInt32LE(gepackt.length, 20); z.writeUInt32LE(roh.length, 24); z.writeUInt16LE(n.length, 28); z.writeUInt32LE(versatz, 42);
    zentral.push(z, n);
    versatz += 30 + n.length + gepackt.length;
  }
  const zb = Buffer.concat(zentral);
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(dateien.length, 8); e.writeUInt16LE(dateien.length, 10); e.writeUInt32LE(zb.length, 12); e.writeUInt32LE(versatz, 16);
  return Buffer.concat([...lokal, zb, e]);
}

const hochladen = (b, bytes, name = 'inhalt.zip') => b.anfrage('/api/v1/betrieb/inhalt', { methode: 'POST', text: bytes, kopf: { 'Content-Type': 'application/zip', 'X-Dateiname': encodeURIComponent(name) } });

test('Schema: eine Datenbank der Version 1 wird erweitert, Sitzungen und Daten bleiben', () => {
  const ordner = mkdtempSync(join(tmpdir(), 'spur-schema-'));
  try {
    const pfad = join(ordner, 'alt.db');
    const alt = new DatabaseSync(pfad);
    alt.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
    alt.exec(SCHEMA[0]);
    alt.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
    alt.prepare("INSERT INTO sitzung (token_hash, rolle, ablauf) VALUES ('h1', 'verwaltung', ?)").run(jetzt());
    alt.close();
    const db = oeffne(pfad);
    assert.equal(db.prepare('SELECT max(version) AS v FROM schema_version').get().v, SCHEMA_VERSION);
    assert.equal(db.prepare("SELECT rolle FROM sitzung WHERE token_hash = 'h1'").get().rolle, 'verwaltung');
    db.prepare("INSERT INTO sitzung (token_hash, rolle, ablauf) VALUES ('h2', 'betrieb', ?)").run(jetzt());
    assert.throws(() => db.prepare("INSERT INTO sitzung (token_hash, rolle, ablauf) VALUES ('h3', 'fremd', ?)").run(jetzt()));
    assert.ok(db.prepare('PRAGMA table_info(rueckmeldung)').all().some((s) => s.name === 'stand'));
    for (const t of ['betriebsauftrag', 'messreihe']) assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(t), t);
    db.close();
  } finally { rmSync(ordner, { recursive: true, force: true }); }
});

test('Anmeldung und Rollen: Betrieb sieht Technik, aber keine Lerngruppen; Verwaltung nicht den Betrieb', async () => {
  const d = ordnerMitDaten();
  const inst = await starteInstanz(d.optionen());
  try {
    const falsch = klient(inst.url);
    assert.equal((await falsch.anfrage('/api/v1/anmeldung/betrieb', { methode: 'POST', json: { schluessel: 'VERW-ALTUNG-TEST' } })).status, 401);
    const b = await alsBetrieb(inst);
    assert.equal((await b.anfrage('/api/v1/ich')).daten.rolle, 'betrieb');
    const z = await b.anfrage('/api/v1/betrieb/zustand');
    assert.equal(z.status, 200);
    assert.deepEqual(z.daten.punkte.map((p) => p.id), ['anwendung', 'datenbank', 'sicherung', 'speicherplatz', 'fehler', 'antwortzeit', 'arbeitsspeicher', 'anmeldedienst', 'inhalte', 'betriebsdienst', 'zertifikat']);
    for (const p of z.daten.punkte) {
      assert.ok(['gut', 'info', 'achtung', 'stoerung'].includes(p.stufe), p.id);
      assert.ok(p.titel && p.wert !== undefined && p.text, p.id);
      if (p.stufe === 'achtung' || p.stufe === 'stoerung') assert.ok(p.tun, `${p.id} sagt, was zu tun ist`);
    }
    assert.equal(z.daten.punkte.find((p) => p.id === 'datenbank').stufe, 'gut');
    assert.equal(z.daten.punkte.find((p) => p.id === 'anmeldedienst').stufe, 'info', 'Attrappe im Test');
    for (const pfad of ['/api/v1/lerngruppen', '/api/v1/verwaltung/uebersicht', '/api/v1/verwaltung/archiv.zip']) assert.equal((await b.anfrage(pfad)).status, 401, pfad);
    const { v } = await alsLehrkraft(inst);
    for (const pfad of ['/api/v1/betrieb/zustand', '/api/v1/betrieb/sicherungen', '/api/v1/betrieb/inhalt', '/api/v1/betrieb/protokoll']) assert.equal((await v.anfrage(pfad)).status, 401, pfad);
    const st = await klient(inst.url).anfrage('/api/v1/status');
    assert.equal(st.daten.betrieb.zustand, 'gut');
    assert.ok(Date.parse(st.daten.gestartet) <= Date.now());
    for (const seite of ['/betrieb.html', '/status.html', '/betrieb', '/status']) {
      const r = await klient(inst.url).anfrage(seite);
      assert.equal(r.status, 200, seite);
      assert.match(r.kopf.get('content-security-policy') ?? '', /script-src 'self'/);
    }
    const prot = await b.anfrage('/api/v1/betrieb/protokoll');
    assert.ok(prot.daten.some((p) => p.aktion === 'start') && prot.daten.every((p) => ['betrieb', 'system'].includes(p.rolle)));
  } finally { await inst.stopp(); d.weg(); }
});

test('Neustart: nur bestätigt und nur im Container; die Anwendung beendet sich, Docker startet sie neu', async () => {
  const d = ordnerMitDaten();
  let grund = null;
  const ohne = await starteInstanz(d.optionen());
  try {
    const b = await alsBetrieb(ohne);
    assert.equal((await b.anfrage('/api/v1/betrieb/neustart', { methode: 'POST', json: { bestaetigt: true } })).status, 409);
    assert.equal((await b.anfrage('/api/v1/betrieb/zustand')).daten.knoepfe.neustart, false);
  } finally { await ohne.stopp(); }
  const mit = await starteInstanz(d.optionen({ imContainer: true, beende: (g) => { grund = g; } }));
  try {
    const b = await alsBetrieb(mit);
    assert.equal((await b.anfrage('/api/v1/betrieb/neustart', { methode: 'POST', json: {} })).status, 400, 'ohne Bestätigung');
    const r = await b.anfrage('/api/v1/betrieb/neustart', { methode: 'POST', json: { bestaetigt: true } });
    assert.equal(r.status, 202);
    await new Promise((ok) => setTimeout(ok, 450));
    assert.match(grund ?? '', /Neustart/);
  } finally { await mit.stopp(); d.weg(); }
});

test('Sicherung: anlegen, zurückspielen (vorher gesichert, beim Start ausgeführt), angemeldet bleiben', async () => {
  const d = ordnerMitDaten();
  let beendet = null;
  let inst = await starteInstanz(d.optionen({ imContainer: true, beende: (g) => { beendet = g; } }));
  try {
    const b = await alsBetrieb(inst);
    const { l } = await alsLehrkraft(inst);
    await lerngruppe(l, 'Klasse 6a');
    const s = await b.anfrage('/api/v1/betrieb/sicherung', { methode: 'POST', json: {} });
    assert.equal(s.status, 201);
    await new Promise((ok) => setTimeout(ok, 1100)); // eigener Zeitstempel für die nächste Sicherung
    await lerngruppe(l, 'Klasse 6b');
    assert.equal(inst.app.db.prepare('SELECT count(*) AS n FROM lerngruppe').get().n, 2);
    const liste = (await b.anfrage('/api/v1/betrieb/sicherungen')).daten;
    assert.equal(liste.schluessel, true);
    assert.equal(liste.liste[0].art, 'hand');
    assert.equal((await b.anfrage('/api/v1/betrieb/zurueckspielen', { methode: 'POST', json: { datei: s.daten.datei } })).status, 400, 'ohne Bestätigung');
    assert.equal((await b.anfrage('/api/v1/betrieb/zurueckspielen', { methode: 'POST', json: { datei: '../spurensuche.db', bestaetigt: true } })).status, 404);
    // beschädigte Sicherung: nichts wird vorgemerkt
    const kaputtName = 'spurensuche-20200101-000000-hand.db.enc';
    const roh = readFileSync(join(d.ordner, 'sicherungen', s.daten.datei));
    roh[roh.length - 20] ^= 0xff;
    writeFileSync(join(d.ordner, 'sicherungen', kaputtName), roh);
    assert.equal((await b.anfrage('/api/v1/betrieb/zurueckspielen', { methode: 'POST', json: { datei: kaputtName, bestaetigt: true } })).status, 422);
    assert.ok(!existsSync(join(d.ordner, 'zurueckspielen.json')));
    unlinkSync(join(d.ordner, 'sicherungen', kaputtName));

    // angemeldet erst nach der Sicherung: Diese Sitzung steht nicht in der Sicherung und muss übernommen werden
    const spaet = await alsBetrieb(inst);
    const r = await spaet.anfrage('/api/v1/betrieb/zurueckspielen', { methode: 'POST', json: { datei: s.daten.datei, bestaetigt: true } });
    assert.equal(r.status, 202);
    assert.equal(r.daten.neustart, true);
    assert.match(r.daten.sicherheit, /-vor-zurueckspielen\.db\.enc$/);
    assert.ok(existsSync(join(d.ordner, 'zurueckspielen.json')));
    await new Promise((ok) => setTimeout(ok, 450));
    assert.match(beendet ?? '', /zurückspielen/);
    await inst.stopp();

    // nächster Start: erst vollenden, dann öffnen
    const zurueckgespielt = await vollendeZurueckspielen({ datenbank: join(d.ordner, 'spurensuche.db') });
    assert.equal(zurueckgespielt.datei, s.daten.datei);
    assert.equal(zurueckgespielt.sitzungen.length, 2, 'Sitzungen des Betriebs werden übernommen');
    inst = await starteInstanz(d.optionen({ zurueckgespielt }));
    assert.equal(inst.app.db.prepare('SELECT count(*) AS n FROM lerngruppe').get().n, 1, 'Stand der Sicherung');
    const weiter = klient(inst.url);
    for (const [n, w] of spaet.cookies) weiter.cookies.set(n, w);
    const z = await weiter.anfrage('/api/v1/betrieb/zustand');
    assert.equal(z.status, 200, 'weiter angemeldet');
    assert.match(z.daten.punkte.find((p) => p.id === 'datenbank').text, /Zuletzt zurückgespielt/);
    assert.ok((await listeSicherungen(join(d.ordner, 'sicherungen'))).some((x) => x.art === 'vor-zurueckspielen'));
    assert.ok((await weiter.anfrage('/api/v1/betrieb/protokoll')).daten.some((p) => p.aktion === 'sicherung-zurueckgespielt'));
    assert.equal(await vollendeZurueckspielen({ datenbank: join(d.ordner, 'spurensuche.db') }), null, 'nichts mehr vorgemerkt');
  } finally { await inst.stopp(); d.weg(); }
});

test('Sicherungen: besondere Arten bleiben getrennt erhalten (je zehn), tägliche nach Anzahl', async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'spur-arten-'));
  try {
    const pfad = join(ordner, 'spurensuche.db');
    oeffne(pfad).close();
    const schluessel = randomBytes(32);
    const ziel = join(ordner, 'sicherungen');
    for (let i = 0; i < 4; i++) await sichere({ datenbank: pfad, ordner: ziel, schluessel, behalten: 2, jetzt: new Date(2026, 10, 1 + i, 2) });
    for (let i = 0; i < 12; i++) await sichere({ datenbank: pfad, ordner: ziel, schluessel, art: 'hand', jetzt: new Date(2026, 10, 10, 9, i) });
    await assert.rejects(sichere({ datenbank: pfad, ordner: ziel, schluessel, art: 'boese' }));
    const liste = await listeSicherungen(ziel);
    assert.equal(liste.filter((x) => x.art === 'taeglich').length, 2);
    assert.equal(liste.filter((x) => x.art === 'hand').length, 10);
    assert.ok(readdirSync(ziel).every((n) => /\.db\.enc(\.sha256)?$/.test(n)));
  } finally { rmSync(ordner, { recursive: true, force: true }); }
});

test('Inhalt tauschen: prüfen, aktivieren, zurück; Fehlerhaftes wird abgelehnt und nichts ändert sich', async () => {
  const d = ordnerMitDaten();
  let inst = await starteInstanz(d.optionen());
  try {
    const b = await alsBetrieb(inst);
    const { l } = await alsLehrkraft(inst);
    // laufende Quest mit allen Aufgaben von testort-nord
    const lg = await lerngruppe(l, 'Klasse 6c');
    assert.equal((await l.anfrage(`/api/v1/lerngruppen/${lg}/freigaben`, { methode: 'POST', json: { titel: 'Quest', zeitrahmen: 'projekttag', orte: [{ ort: 'testort-nord' }] } })).status, 201);

    const vorher = (await klient(inst.url).anfrage('/api/v1/status')).daten.inhaltVersion;
    const dateien = await inhaltsDateien(BEISPIEL);
    const ort = dateien.find((x) => x.name === 'inhalte/testort-nord/ort.json');
    const neuerOrt = { ...JSON.parse(ort.inhalt), name: 'Testort Nord (neu)', aufgaben: ['1'] };
    const paket = dateien.filter((x) => x.name !== 'inhalte/testort-nord/2.json').map((x) => (x === ort ? { name: x.name, inhalt: Buffer.from(JSON.stringify(neuerOrt)) } : x));
    // gepackt wie unter Windows, mit einem gemeinsamen obersten Ordner und Beiwerk von macOS
    const zipBytes = zipGepackt([...paket.map((x) => ({ ...x, name: `mein-paket/${x.name}` })), { name: 'mein-paket/.DS_Store', inhalt: Buffer.from('x') }]);
    const r = await hochladen(b, zipBytes, 'Inhalt März 2027.zip');
    assert.equal(r.status, 200, JSON.stringify(r.daten));
    assert.equal(r.daten.ok, true);
    assert.equal(r.daten.paket.name, 'Inhalt März 2027.zip');
    assert.ok(r.daten.paket.orte.includes('Testort Nord (neu)'));
    assert.equal(r.daten.warnungen.length, 1, 'laufende Quest nutzt eine Aufgabe, die es im neuen Inhalt nicht gibt');
    assert.match(r.daten.warnungen[0], /testort-nord\/2/);
    // noch nicht aktiv
    assert.equal(JSON.parse((await klient(inst.url).anfrage('/inhalte/testort-nord/ort.json')).text).name, 'Testort Nord');

    const a = await b.anfrage('/api/v1/betrieb/inhalt/aktivieren', { methode: 'POST', json: { paket: r.daten.paket.id } });
    assert.equal(a.status, 200);
    assert.equal(a.daten.vorher, 'mitgeliefert');
    assert.equal(JSON.parse((await klient(inst.url).anfrage('/inhalte/testort-nord/ort.json')).text).name, 'Testort Nord (neu)');
    assert.equal((await klient(inst.url).anfrage('/inhalte/testort-nord/2.json')).status, 404);
    assert.notEqual((await klient(inst.url).anfrage('/api/v1/status')).daten.inhaltVersion, vorher);
    assert.ok((await klient(inst.url).anfrage('/spiele/probe/index.js')).status === 200, 'Spiele kommen weiter aus der Anwendung');
    const stand = (await b.anfrage('/api/v1/betrieb/inhalt')).daten;
    assert.equal(stand.aktiv.paket, r.daten.paket.id);
    assert.equal(stand.vorher, 'mitgeliefert');

    // Neustart mit aktivem Paket
    await inst.stopp();
    inst = await starteInstanz(d.optionen());
    assert.equal(JSON.parse((await klient(inst.url).anfrage('/inhalte/testort-nord/ort.json')).text).name, 'Testort Nord (neu)');
    const b2 = await alsBetrieb(inst);
    // zurück auf den mitgelieferten Inhalt
    assert.equal((await b2.anfrage('/api/v1/betrieb/inhalt/aktivieren', { methode: 'POST', json: { paket: 'mitgeliefert' } })).status, 200);
    assert.equal(JSON.parse((await klient(inst.url).anfrage('/inhalte/testort-nord/ort.json')).text).name, 'Testort Nord');
    assert.equal((await klient(inst.url).anfrage('/api/v1/status')).daten.inhaltVersion, vorher);
    assert.equal((await b2.anfrage('/api/v1/betrieb/inhalt')).daten.vorher, r.daten.paket.id, 'das Paket bleibt als „vorher“');

    // Ablehnungen: jeweils 422, nichts aktiviert, kein Paket abgelegt
    const anzahl = () => readdirSync(join(d.ordner, 'inhalte-pakete')).filter((n) => /^\d{8}-/.test(n)).length;
    const pakete = anzahl();
    const faelle = [
      ['kein ZIP', Buffer.from('kein zip'), /kein ZIP-Archiv/],
      ['Programmcode', zip([...paket, { name: 'inhalte/hilfe.js', inhalt: 'alert(1)' }]), /Dateityp \.js/],
      ['Spiele-Ordner', zip([...paket, { name: 'spiele/probe/index.js', inhalt: 'x' }]), /außerhalb der Ordner/],
      ['Pfad nach oben', zip([...paket, { name: 'inhalte/../../daten.json', inhalt: '{}' }]), /Ungültiger Dateiname/],
      ['Skript im Bild', zip([...paket, { name: 'assets/spiele/items/boese.svg', inhalt: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>' }]), /SVG-Grafik/],
      ['ohne orte.json', zip(paket.filter((x) => x.name !== 'inhalte/orte.json')), /Pflichtdatei fehlt/],
      ['Pflichtfeld leer', zip(paket.map((x) => (x.name === 'inhalte/testort-sued/ort.json' ? { name: x.name, inhalt: JSON.stringify({ ...JSON.parse(x.inhalt), name: '' }) } : x))), /testort-sued\/ort\.json/],
      ['Bild fehlt', zip(paket.filter((x) => x.name !== 'assets/spiele/orte/sued.svg')), /sued\.svg fehlt/],
    ];
    for (const [name, bytes, muster] of faelle) {
      const f = await hochladen(b2, bytes, `${name}.zip`);
      assert.equal(f.status, 422, name);
      assert.equal(f.daten.ok, false, name);
      assert.ok(f.daten.fehler.some((x) => muster.test(`${x.datei} ${x.meldung}`)), `${name}: ${JSON.stringify(f.daten.fehler)}`);
    }
    assert.equal((await b2.anfrage('/api/v1/betrieb/inhalt', { methode: 'POST', text: 'a=b' })).status, 415, 'kein Formular');
    assert.equal(anzahl(), pakete, 'abgelehnte Pakete werden nicht abgelegt');
    assert.equal(JSON.parse((await klient(inst.url).anfrage('/inhalte/testort-nord/ort.json')).text).name, 'Testort Nord');
    assert.equal((await b2.anfrage('/api/v1/betrieb/inhalt/aktivieren', { methode: 'POST', json: { paket: '../../etc' } })).status, 404);

    // beschädigtes aktives Paket beim Start: mitgelieferter Inhalt läuft, die Ampel zeigt rot
    assert.equal((await b2.anfrage('/api/v1/betrieb/inhalt/aktivieren', { methode: 'POST', json: { paket: r.daten.paket.id } })).status, 200);
    await inst.stopp();
    unlinkSync(join(d.ordner, 'inhalte-pakete', r.daten.paket.id, 'inhalte', 'orte.json'));
    inst = await starteInstanz(d.optionen());
    assert.equal(JSON.parse((await klient(inst.url).anfrage('/inhalte/testort-nord/ort.json')).text).name, 'Testort Nord');
    const b3 = await alsBetrieb(inst);
    const p = (await b3.anfrage('/api/v1/betrieb/zustand')).daten.punkte.find((x) => x.id === 'inhalte');
    assert.equal(p.stufe, 'stoerung');
    assert.match(p.text, /mitgelieferte Inhalt ist aktiv/);
  } finally { await inst.stopp(); d.weg(); }
});

test('Inhaltspakete: Grenzen beim Lesen (Größe, Beschädigung, Verschlüsselung)', () => {
  const gut = zip([{ name: 'inhalte/orte.json', inhalt: '{}' }]);
  assert.equal(liesZip(gut).length, 1);
  assert.throws(() => liesZip(gut, { dateien: 10, bytes: 1, datei: 1 }), PaketFehler);
  const kaputt = Buffer.from(gut);
  kaputt[30 + kaputt.readUInt16LE(26) + kaputt.readUInt16LE(28)] ^= 0xff; // erstes Byte des Dateiinhalts verändert
  assert.throws(() => liesZip(kaputt), /Prüfsumme|beschädigt/);
  const verschluesselt = Buffer.from(gut);
  const z = verschluesselt.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  verschluesselt.writeUInt16LE(verschluesselt.readUInt16LE(z + 8) | 1, z + 8);
  assert.throws(() => liesZip(verschluesselt), /verschlüsselt/);
  // „Zip-Bombe“: angegebene Größe klein, ausgepackt groß
  const bombe = zipGepackt([{ name: 'inhalte/orte.json', inhalt: Buffer.alloc(5_000_000) }]);
  const zb = bombe.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bombe.writeUInt32LE(100, zb + 24);
  assert.throws(() => liesZip(bombe), /beschädigt|Prüfsumme/);
  const { fehler } = ordneDateien([{ name: 'C:/x/inhalte/a.json', inhalt: Buffer.from('{}') }, { name: 'inhalte/ä.json', inhalt: Buffer.from('{}') }]);
  assert.ok(fehler.some((f) => /Ungültiger Dateiname/.test(f.meldung)) && fehler.some((f) => /Umlaute/.test(f.meldung)));
});

test('Betriebsdienst und „letzte Version zurückspielen“: Auftrag, Ausführung am Server, Rückmeldung', async () => {
  const d = ordnerMitDaten();
  const inst = await starteInstanz(d.optionen());
  try {
    const b = await alsBetrieb(inst);
    assert.equal((await b.anfrage('/api/v1/betrieb/version-zurueck', { methode: 'POST', json: { bestaetigt: true } })).status, 409, 'ohne Betriebsdienst');
    const agent = (felder, token = AGENT) => klient(inst.url).anfrage('/api/v1/betrieb/agent', { methode: 'POST', text: new URLSearchParams(felder).toString(), token });
    assert.equal((await agent({ version: '0.2.0' }, 'falsch-falsch-falsch-falsch')).status, 401);
    const erst = await agent({ version: '0.2.0', vorher: '0.1.0', gesund: 'healthy' });
    assert.equal(erst.status, 200);
    assert.match(erst.text, /^zustand (gut|achtung|stoerung)\n$/);
    const z = (await b.anfrage('/api/v1/betrieb/zustand')).daten;
    assert.equal(z.knoepfe.versionZurueck, true);
    assert.equal(z.version.vorher, '0.1.0');
    assert.equal(z.version.installiert, '0.2.0');
    assert.equal(z.punkte.find((p) => p.id === 'betriebsdienst').stufe, 'gut');
    assert.equal((await b.anfrage('/api/v1/betrieb/version-zurueck', { methode: 'POST', json: {} })).status, 400, 'ohne Bestätigung');
    const auftrag = await b.anfrage('/api/v1/betrieb/version-zurueck', { methode: 'POST', json: { bestaetigt: true } });
    assert.equal(auftrag.status, 202);
    assert.equal(auftrag.daten.auf, '0.1.0');
    assert.equal((await b.anfrage('/api/v1/betrieb/version-zurueck', { methode: 'POST', json: { bestaetigt: true } })).status, 409, 'ein Auftrag läuft schon');
    assert.ok(!(await agent({ version: '0.2.0', vorher: '0.1.0', nur: 'zustand' })).text.includes('auftrag'), 'Statusabfrage holt keine Aufträge');
    const geholt = await agent({ version: '0.2.0', vorher: '0.1.0' });
    assert.ok(geholt.text.includes(`auftrag ${auftrag.daten.auftrag} version-zurueck`));
    assert.equal((await b.anfrage(`/api/v1/betrieb/auftraege/${auftrag.daten.auftrag}`)).daten.status, 'laeuft');
    assert.ok(!(await agent({ version: '0.2.0', vorher: '0.1.0' })).text.includes('auftrag'), 'jeder Auftrag nur einmal');
    await agent({ version: '0.1.0', vorher: '', erledigt: String(auftrag.daten.auftrag), ok: '1', meldung: 'Version 0.1.0 läuft wieder (14 Sekunden).' });
    const fertig = (await b.anfrage(`/api/v1/betrieb/auftraege/${auftrag.daten.auftrag}`)).daten;
    assert.equal(fertig.status, 'fertig');
    assert.match(fertig.meldung, /0\.1\.0 läuft wieder/);
    const danach = (await b.anfrage('/api/v1/betrieb/zustand')).daten;
    assert.equal(danach.knoepfe.versionZurueck, false, 'keine frühere Version mehr');
  } finally { await inst.stopp(); d.weg(); }
});

test('Messreihe: Anfragen, Fehler und Antwortzeit je Minute; jedes Fünf-Minuten-Fenster einmal, nach Neustart addiert', () => {
  const m = new Messreihe();
  for (let i = 0; i < 95; i++) m.zaehle(200, 8);
  for (let i = 0; i < 5; i++) m.zaehle(503, 900);
  const s = m.letzte(15);
  assert.equal(s.anfragen, 100);
  assert.equal(s.fehler, 5);
  assert.equal(s.p95, 10);
  const ordner = mkdtempSync(join(tmpdir(), 'spur-mess-'));
  try {
    const db = oeffne(join(ordner, 'm.db'));
    const t = Date.now();
    const vorher = new Messreihe();
    for (let i = 0; i < 7; i++) vorher.zaehle(200, 3, t - 300_000);
    vorher.schreibe(db, { gruppenAktiv: () => 2 }, t);
    vorher.schreibe(db, { gruppenAktiv: () => 2 }, t);
    const nachNeustart = new Messreihe();
    for (let i = 0; i < 3; i++) nachNeustart.zaehle(200, 3, t - 300_000);
    nachNeustart.schreibe(db, { gruppenAktiv: () => 1 }, t);
    const zeilen = db.prepare('SELECT anfragen, gruppen_aktiv FROM messreihe').all();
    assert.equal(zeilen.length, 1);
    assert.equal(zeilen[0].anfragen, 10, 'Fenster einmal geschrieben und nach Neustart addiert');
    assert.equal(zeilen[0].gruppen_aktiv, 1);
    db.close();
  } finally { rmSync(ordner, { recursive: true, force: true }); }
});

test('Die Anwendung schreibt nichts außerhalb ihres Datenordners (Pakete, Vormerkung, Sicherungen)', async () => {
  const d = ordnerMitDaten();
  const inst = await starteInstanz(d.optionen());
  try {
    const b = await alsBetrieb(inst);
    await b.anfrage('/api/v1/betrieb/sicherung', { methode: 'POST', json: {} });
    await hochladen(b, zip(await inhaltsDateien(BEISPIEL)), 'gleich.zip');
    const erlaubt = new Set(['spurensuche.db', 'spurensuche.db-wal', 'spurensuche.db-shm', 'sicherungen', 'inhalte-pakete']);
    for (const n of readdirSync(d.ordner)) assert.ok(erlaubt.has(n), n);
    assert.ok(!readdirSync(d.ordner).includes('zurueckspielen.json'));
  } finally { await inst.stopp(); d.weg(); }
});
