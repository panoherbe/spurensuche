// Tests des Servers über die echte HTTP-Schnittstelle: Lehrkraft, Gruppen, Übertragung ohne Doppelzählung,
// Datensparsamkeit, Bildbeiträge, Ausstellung, Archiv, Löschfristen, Anmeldung über OpenID Connect.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { starteInstanz, klient, testPng, testWebp } from './hilfe.js';
import { pruefeArchiv, importiereArchiv, erstelleArchiv, vergleicheManifeste } from '../server/archiv.js';
import { oeffne, raeumeAuf } from '../server/db.js';
import { ladeInhalte } from '../server/inhalte.js';

let inst;
let lk;
const jetzt = () => new Date().toISOString();

async function alsLehrkraft(i = inst) {
  const v = klient(i.url);
  assert.equal((await v.anfrage('/api/v1/anmeldung/verwaltung', { methode: 'POST', json: { schluessel: 'VERW-ALTUNG-TEST' } })).status, 200);
  const s = await v.anfrage('/api/v1/verwaltung/zugangsschluessel', { methode: 'POST', json: { bezeichnung: 'Testschule, Lehrkraft 1' } });
  assert.equal(s.status, 201);
  const l = klient(i.url);
  assert.equal((await l.anfrage('/api/v1/anmeldung/schluessel', { methode: 'POST', json: { schluessel: s.daten.schluessel } })).status, 200);
  return l;
}

async function questMitGruppe(l, { klassenstufe = 6, einwilligung = true, gruppe = 'Biber', rueckmeldung = false } = {}) {
  const lg = await l.anfrage('/api/v1/lerngruppen', { methode: 'POST', json: { bezeichnung: `Klasse ${klassenstufe}x`, klassenstufe, einwilligung } });
  assert.equal(lg.status, 201);
  const q = await l.anfrage(`/api/v1/lerngruppen/${lg.daten.id}/freigaben`, { methode: 'POST', json: { titel: 'Testquest', zeitrahmen: 'projekttag', orte: [{ ort: 'testort-nord' }, { ort: 'testort-sued' }], rueckmeldung } });
  assert.equal(q.status, 201);
  const g = await l.anfrage(`/api/v1/freigaben/${q.daten.id}/gruppen`, { methode: 'POST', json: { bezeichnung: gruppe } });
  assert.equal(g.status, 201);
  const geraet = klient(inst.url);
  const b = await geraet.anfrage('/api/v1/beitritt', { methode: 'POST', json: { code: g.daten.code.toLowerCase().replace('-', '') } });
  assert.equal(b.status, 200);
  return { lerngruppe: lg.daten.id, quest: q.daten.id, gruppe: g.daten, token: b.daten.token, beitritt: b.daten, geraet };
}

const lauf = (aufgabe, ereignisse, geloest = true) => ({ id: randomUUID(), aufgabe, geloest, versuche: 99, dauerSekunden: 120, items: ['test-stein', 'fremd'], ereignisse, beendet: jetzt() });

before(async () => { inst = await starteInstanz(); lk = await alsLehrkraft(); });
after(async () => { await inst.stopp(); });

test('Status, Startseite mit strenger Inhaltsrichtlinie, kein Zugriff außerhalb der Ordner', async () => {
  const k = klient(inst.url);
  const s = await k.anfrage('/api/v1/status');
  assert.equal(s.daten.ok, true);
  assert.equal(s.daten.inhaltFehler, 0);
  const seite = await k.anfrage('/');
  assert.equal(seite.status, 200);
  assert.match(seite.kopf.get('content-security-policy'), /script-src 'self'/);
  assert.doesNotMatch(seite.kopf.get('content-security-policy'), /unsafe-inline/);
  assert.equal((await k.anfrage('/app/../server/app.js')).status, 404);
  assert.equal((await k.anfrage('/server/app.js')).status, 404);
  assert.equal((await k.anfrage('/inhalte/orte.json')).status, 200);
  const liste = await k.anfrage('/offline-liste.json');
  assert.ok(liste.daten.dateien.some((d) => d.pfad === 'spiele/probe/index.js'));
  assert.ok(liste.daten.dateien.some((d) => d.pfad === 'inhalte/testort-nord/ort.json'), 'Ortsdateien gehören ins Offline-Paket');
  assert.ok(liste.daten.dateien.every((d) => !d.pfad.startsWith('server/')));
  assert.ok(liste.daten.jeOrtBytes['testort-nord'] > 0);
});

test('Gruppen: Vorschlag ohne Rückfrage, freie Bezeichnung erst nach Bestätigung', async () => {
  const q = await questMitGruppe(lk);
  const frei = await lk.anfrage(`/api/v1/freigaben/${q.quest}/gruppen`, { methode: 'POST', json: { bezeichnung: 'Lisa' } });
  assert.equal(frei.status, 409);
  assert.ok(frei.daten.hinweis.includes('keine Namen'));
  assert.equal((await lk.anfrage(`/api/v1/freigaben/${q.quest}/gruppen`, { methode: 'POST', json: { bezeichnung: 'Team Ost', bestaetigt: true } })).status, 201);
  assert.equal((await lk.anfrage(`/api/v1/freigaben/${q.quest}/gruppen`, { methode: 'POST', json: { bezeichnung: 'Biber' } })).status, 409, 'doppelt');
  assert.equal((await klient(inst.url).anfrage('/api/v1/beitritt', { methode: 'POST', json: { code: 'XXXX-YYYY' } })).status, 404);
});

test('Übertragung: bereinigt, wiederholungssicher, ohne Doppelzählung', async () => {
  const q = await questMitGruppe(lk, { gruppe: 'Eule' });
  const daten = {
    schluessel: randomUUID(),
    stationen: [{ ort: 'testort-nord', status: 'begonnen', verifikation: 'qr', begonnen: jetzt(), aktivSekunden: 30 }],
    laeufe: [lauf('testort-nord/1', [{ art: 'rolle', zeit: 5, wert: 'navigation' }, { art: 'versuch', zeit: 10, wert: false }, { art: 'neuer-anlauf', zeit: 12, wert: true }, { art: 'versuch', zeit: 20, wert: true }, { art: 'versuch', zeit: 21, wert: 'Lisa Müller' }, { art: 'gps', zeit: 22, wert: '51.05,13.73' }])],
    technik: [{ schluessel: randomUUID(), art: 'offline', zeit: jetzt() }],
    name: 'Lisa Müller',
  };
  const r1 = await q.geraet.anfrage('/api/v1/sync', { methode: 'POST', json: daten, token: q.token });
  assert.equal(r1.status, 200);
  assert.equal(r1.daten.angenommen.laeufe, 1);
  const r2 = await q.geraet.anfrage('/api/v1/sync', { methode: 'POST', json: daten, token: q.token });
  assert.equal(r2.daten.doppelt, true);
  const r3 = await q.geraet.anfrage('/api/v1/sync', { methode: 'POST', json: { ...daten, schluessel: randomUUID() }, token: q.token });
  assert.equal(r3.daten.angenommen.laeufe, 0, 'derselbe Lauf mit neuem Schlüssel zählt nicht doppelt');
  const zeilen = inst.app.db.prepare('SELECT * FROM lauf WHERE gruppe_id = ?').all(q.gruppe.id);
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].versuche, 2, 'Versuche aus den Ereignissen gezählt, nicht vom Gerät übernommen');
  assert.deepEqual(JSON.parse(zeilen[0].items), ['test-stein'], 'nur Sammelstücke aus der Belohnung');
  const alles = JSON.stringify(inst.app.db.prepare('SELECT * FROM lauf').all()) + JSON.stringify(inst.app.db.prepare('SELECT * FROM station').all());
  assert.ok(!alles.includes('Lisa') && !alles.includes('51.05'), 'kein Freitext, keine Koordinate gespeichert');
  // Abgeschlossen bleibt abgeschlossen, auch wenn später „begonnen“ eintrifft
  await q.geraet.anfrage('/api/v1/sync', { methode: 'POST', json: { schluessel: randomUUID(), stationen: [{ ort: 'testort-nord', status: 'abgeschlossen', begonnen: jetzt(), beendet: jetzt(), aktivSekunden: 600 }] }, token: q.token });
  await q.geraet.anfrage('/api/v1/sync', { methode: 'POST', json: { schluessel: randomUUID(), stationen: [{ ort: 'testort-nord', status: 'begonnen', begonnen: jetzt(), aktivSekunden: 10 }] }, token: q.token });
  const st = inst.app.db.prepare('SELECT status, aktiv_sekunden FROM station WHERE gruppe_id = ?').get(q.gruppe.id);
  assert.deepEqual({ ...st }, { status: 'abgeschlossen', aktiv_sekunden: 600 });
  const uebersicht = await lk.anfrage(`/api/v1/freigaben/${q.quest}`);
  assert.equal(uebersicht.daten.gruppen[0].stationen.find((s) => s.ort === 'testort-nord').status, 'abgeschlossen');
});

test('Auswertung: Beobachtungen, Raster mit Vorschlag, Einschätzung, Entwurf', async () => {
  const q = await questMitGruppe(lk, { gruppe: 'Fuchs' });
  await q.geraet.anfrage('/api/v1/sync', { methode: 'POST', token: q.token, json: {
    schluessel: randomUUID(),
    stationen: [{ ort: 'testort-nord', status: 'abgeschlossen', verifikation: 'ersatz', begonnen: jetzt(), beendet: jetzt(), aktivSekunden: 700 }],
    laeufe: [
      lauf('testort-nord/1', [{ art: 'rolle', zeit: 1, wert: 'navigation' }, { art: 'versuch', zeit: 2, wert: true }]),
      lauf('testort-nord/2', [{ art: 'weg', zeit: 1, wert: 'wald' }, { art: 'weg', zeit: 2, wert: 'fluss' }, { art: 'abstimmung', zeit: 3, wert: 'einig' }, { art: 'versuch', zeit: 4, wert: true }]),
    ] } });
  const a = await lk.anfrage(`/api/v1/gruppen/${q.gruppe.id}/auswertung`);
  assert.equal(a.status, 200);
  assert.equal(a.daten.raster.zeilen.find((z) => z.bereich === 'problemloesung').vorschlag, 'beurteilen');
  assert.ok(a.daten.entwurf.startsWith('Entwurf'));
  assert.ok(a.daten.beobachtungen.teamleistung.saetze.length > 0);
  assert.equal((await lk.anfrage(`/api/v1/gruppen/${q.gruppe.id}`, { methode: 'PATCH', json: { einschaetzung: { problemloesung: 'anwenden' } } })).status, 200);
  const b = await lk.anfrage(`/api/v1/gruppen/${q.gruppe.id}/auswertung`);
  assert.equal(b.daten.raster.zeilen.find((z) => z.bereich === 'problemloesung').stufe, 'anwenden');
  assert.equal((await lk.anfrage(`/api/v1/gruppen/${q.gruppe.id}`, { methode: 'PATCH', json: { einschaetzung: { problemloesung: 'note-1' } } })).status, 400);
  // fremde Lehrkraft sieht nichts
  const andere = await alsLehrkraft();
  assert.equal((await andere.anfrage(`/api/v1/gruppen/${q.gruppe.id}/auswertung`)).status, 404);
});

test('Außerhalb der Klassen 4 bis 8 oder ohne Einwilligung entstehen keine Datensätze', async () => {
  for (const art of [{ klassenstufe: 9, einwilligung: true, gruppe: 'Luchs' }, { klassenstufe: 6, einwilligung: false, gruppe: 'Otter' }]) {
    const q = await questMitGruppe(lk, art);
    assert.equal(q.beitritt.freigabe.erfassung, false);
    const r = await q.geraet.anfrage('/api/v1/sync', { methode: 'POST', token: q.token, json: { schluessel: randomUUID(), stationen: [{ ort: 'testort-nord', status: 'begonnen', begonnen: jetzt() }], laeufe: [lauf('testort-nord/1', [{ art: 'versuch', zeit: 1, wert: true }])], technik: [{ schluessel: randomUUID(), art: 'offline', zeit: jetzt() }] } });
    assert.equal(r.daten.erfasst, false);
    for (const t of ['station', 'lauf', 'technik']) assert.equal(inst.app.db.prepare(`SELECT count(*) AS n FROM ${t} WHERE gruppe_id = ?`).get(q.gruppe.id).n, 0, t);
    if (!art.einwilligung) {
      assert.equal((await lk.anfrage(`/api/v1/lerngruppen/${q.lerngruppe}`, { methode: 'PATCH', json: { einwilligung: true } })).daten.erfassung.erfassung, true);
      const r2 = await q.geraet.anfrage('/api/v1/sync', { methode: 'POST', token: q.token, json: { schluessel: randomUUID(), laeufe: [lauf('testort-nord/1', [{ art: 'versuch', zeit: 1, wert: true }])] } });
      assert.equal(r2.daten.erfasst, true, 'nach bestätigter Einwilligung wird erfasst');
    }
  }
});

test('Bildbeiträge: Schule wartet auf Freigabe, Familie nur selbst freigegeben, Ausstellung sieht nur Freigegebenes', async () => {
  const q = await questMitGruppe(lk, { gruppe: 'Igel' });
  const png = testPng();
  const bild = (kennung, extra = {}) => ({ metadaten: { kennung, erstellt: jetzt(), art: 'item-collage', items: ['test-stein', 'test-krone'] }, png: png.toString('base64'), vorschau: testWebp().toString('base64'), ...extra });
  const schule = randomUUID();
  assert.equal((await q.geraet.anfrage('/api/v1/bildbeitraege', { methode: 'POST', token: q.token, json: bild(schule) })).status, 201);
  assert.equal((await q.geraet.anfrage('/api/v1/bildbeitraege', { methode: 'POST', token: q.token, json: bild(schule) })).status, 200, 'wiederholt: kein zweiter Eintrag');
  const familie = klient(inst.url);
  assert.equal((await familie.anfrage('/api/v1/bildbeitraege', { methode: 'POST', json: bild(randomUUID()) })).status, 400, 'Familie ohne Freigabe');
  const famKennung = randomUUID();
  assert.equal((await familie.anfrage('/api/v1/bildbeitraege', { methode: 'POST', json: bild(famKennung, { freigabe: true }) })).status, 201);
  assert.equal((await familie.anfrage('/api/v1/bildbeitraege', { methode: 'POST', json: { ...bild(randomUUID(), { freigabe: true }), png: testPng(1024, 1024).toString('base64') } })).status, 400, 'falsche Größe');
  assert.equal((await familie.anfrage('/api/v1/bildbeitraege', { methode: 'POST', json: bild(randomUUID(), { freigabe: true, metadaten: { kennung: randomUUID(), erstellt: jetzt(), art: 'item-collage', items: ['test-stein'], gruppe: 'Igel' } }) })).status, 400, 'Gruppenname in Metadaten');

  const aus = klient(inst.url);
  assert.equal((await aus.anfrage('/api/v1/ausstellung/bildbeitraege')).status, 401);
  let liste = (await aus.anfrage('/api/v1/ausstellung/bildbeitraege', { token: 'ausstellung-test-token' })).daten.eintraege.map((e) => e.kennung);
  assert.ok(liste.includes(famKennung) && !liste.includes(schule));
  const lehr = await lk.anfrage(`/api/v1/freigaben/${q.quest}/bildbeitraege`);
  assert.equal(lehr.daten[0].gruppe, 'Igel');
  assert.equal((await lk.anfrage('/api/v1/bildbeitraege/entscheidung', { methode: 'POST', json: { kennungen: [schule], freigeben: true } })).daten.geaendert, 1);
  liste = (await aus.anfrage('/api/v1/ausstellung/bildbeitraege', { token: 'ausstellung-test-token' })).daten.eintraege;
  const eintrag = liste.find((e) => e.kennung === schule);
  assert.ok(eintrag);
  assert.ok(!JSON.stringify(eintrag).includes('Igel'), 'kein Gruppenname in den Metadaten');
  const datei = await aus.anfrage(eintrag.bild, { token: 'ausstellung-test-token' });
  assert.equal(datei.kopf.get('content-type'), 'image/png');
  assert.equal(createHash('sha256').update(datei.roh).digest('hex'), createHash('sha256').update(png).digest('hex'));
  const archiv = await aus.anfrage('/api/v1/ausstellung/archiv.zip', { token: 'ausstellung-test-token' });
  const p = pruefeArchiv(archiv.roh);
  assert.ok(p.ok, p.fehler.join('; '));
  assert.ok(p.nutzlast.some((d) => d.pfad === `data/bildbeitraege/${schule}.png`));
});

test('Archiv: Export, Übernahme in eine leere Instanz, gleiche Prüfsummen', async () => {
  const v = klient(inst.url);
  await v.anfrage('/api/v1/anmeldung/verwaltung', { methode: 'POST', json: { schluessel: 'VERW-ALTUNG-TEST' } });
  const a = await v.anfrage('/api/v1/verwaltung/archiv.zip?umfang=archiv');
  assert.equal(a.status, 200);
  const p = pruefeArchiv(a.roh);
  assert.ok(p.ok, p.fehler.join('; '));
  assert.ok(!a.roh.toString('latin1').includes('Lisa'));
  const ziel = mkdtempSync(join(tmpdir(), 'spur-ziel-'));
  try {
    const db = oeffne(join(ziel, 'neu.db'));
    const r = await importiereArchiv({ db, zielWurzel: join(ziel, 'inhalt'), zipBytes: a.roh });
    assert.ok(r.dateien > 10 && r.bildbeitraege >= 2);
    const inhalte = await ladeInhalte({ appWurzel: inst.cfg.appWurzel, inhaltsWurzel: join(ziel, 'inhalt') });
    assert.equal(inhalte.fehler.length, 0, JSON.stringify(inhalte.fehler));
    const zweit = await erstelleArchiv({ db, inhalte, umfang: 'archiv', version: '0.1.0', einstellungen: { aufbewahrungWochen: 12, lernendeAnmeldung: 'optional' } });
    const vergleich = vergleicheManifeste(p.manifest, zweit.manifest);
    assert.ok(vergleich.gleich, `abweichend: ${vergleich.abweichend.join(', ')}`);
    await assert.rejects(importiereArchiv({ db, zielWurzel: join(ziel, 'inhalt'), zipBytes: a.roh }), /nicht leer/);
    db.close();
  } finally { rmSync(ziel, { recursive: true, force: true }); }
  const voll = await v.anfrage('/api/v1/verwaltung/archiv.zip?umfang=vollstaendig');
  assert.ok(pruefeArchiv(voll.roh).nutzlast.some((d) => d.pfad === 'data/gruppen/laeufe.json'));
});

test('Löschfristen und vorzeitige Löschung: Gruppendaten weg, freigegebene Bilder bleiben ohne Gruppe', async () => {
  // eigene Instanz: die Zeitreise unten räumt sonst auch die Daten der anderen Tests ab
  const haupt = inst;
  inst = await starteInstanz();
  try {
  let lk = await alsLehrkraft();
  const q = await questMitGruppe(lk, { gruppe: 'Kranich' });
  await q.geraet.anfrage('/api/v1/sync', { methode: 'POST', token: q.token, json: { schluessel: randomUUID(), laeufe: [lauf('testort-sued/1', [{ art: 'versuch', zeit: 1, wert: true }])] } });
  const frei = randomUUID();
  const wartet = randomUUID();
  for (const k of [frei, wartet]) await q.geraet.anfrage('/api/v1/bildbeitraege', { methode: 'POST', token: q.token, json: { metadaten: { kennung: k, erstellt: jetzt(), art: 'item-collage', items: ['test-krone'] }, png: testPng().toString('base64'), vorschau: testWebp().toString('base64') } });
  await lk.anfrage('/api/v1/bildbeitraege/entscheidung', { methode: 'POST', json: { kennungen: [frei], freigeben: true } });
  await lk.anfrage(`/api/v1/freigaben/${q.quest}/beenden`, { methode: 'POST', json: {} });
  const db = inst.app.db;
  const termin = db.prepare('SELECT loeschen_am FROM freigabe WHERE id = ?').get(q.quest).loeschen_am;
  assert.ok(Date.parse(termin) - Date.now() > 83 * 86400000 || termin.includes('-07-31'), 'zwölf Wochen oder Schuljahresende');
  raeumeAuf(db, new Date(Date.parse(termin) + 1000));
  lk = await alsLehrkraft(); // die Zeitreise hat auch die Sitzung beendet
  assert.equal(db.prepare('SELECT count(*) AS n FROM gruppe WHERE id = ?').get(q.gruppe.id).n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM lauf WHERE gruppe_id = ?').get(q.gruppe.id).n, 0);
  assert.equal(db.prepare('SELECT gruppe_id FROM bildbeitrag WHERE kennung = ?').get(frei).gruppe_id, null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM bildbeitrag WHERE kennung = ?').get(wartet).n, 0);
  // vorzeitig: Lehrkraft löscht eine Gruppe
  const q2 = await questMitGruppe(lk, { gruppe: 'Specht' });
  await q2.geraet.anfrage('/api/v1/sync', { methode: 'POST', token: q2.token, json: { schluessel: randomUUID(), laeufe: [lauf('testort-nord/1', [{ art: 'versuch', zeit: 1, wert: true }])] } });
  assert.equal((await lk.anfrage(`/api/v1/gruppen/${q2.gruppe.id}`, { methode: 'DELETE' })).status, 200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM lauf WHERE gruppe_id = ?').get(q2.gruppe.id).n, 0);
  assert.equal((await q2.geraet.anfrage('/api/v1/sync', { methode: 'POST', token: q2.token, json: { schluessel: randomUUID() } })).status, 410);
  } finally { await inst.stopp(); inst = haupt; }
});

test('Anmeldung über OpenID Connect: Rolle aus Merkmalen, Name und E-Mail nie gespeichert', async () => {
  const b = klient(inst.url);
  const start = await b.anfrage('/anmeldung/start');
  assert.equal(start.status, 302);
  const ziel = new URL(start.kopf.get('location'));
  assert.equal(ziel.pathname, '/attrappe/authorize');
  assert.equal(ziel.searchParams.get('code_challenge_method'), 'S256');
  const seite = await b.anfrage(ziel.pathname + ziel.search);
  assert.equal(seite.status, 200);
  const felder = Object.fromEntries(['client_id', 'redirect_uri', 'state', 'nonce', 'code_challenge'].map((k) => [k, ziel.searchParams.get(k)]));
  const wahl = await b.anfrage('/attrappe/authorize', { methode: 'POST', text: new URLSearchParams({ ...felder, konto: 'lehrkraft-1' }).toString() });
  assert.equal(wahl.status, 302);
  const rueck = new URL(wahl.kopf.get('location'));
  const ende = await b.anfrage(rueck.pathname + rueck.search);
  assert.equal(ende.status, 302);
  assert.equal(ende.kopf.get('location'), '/lehrkraefte.html');
  assert.equal((await b.anfrage('/api/v1/ich')).daten.rolle, 'lehrkraft');
  // dieselbe Rückkehr ein zweites Mal: abgelehnt (Code und Zustand nur einmal gültig)
  assert.match((await b.anfrage(rueck.pathname + rueck.search)).kopf.get('location'), /fehler=vorgang/);
  const dbDatei = readFileSync(inst.cfg.datenbank);
  const wal = readdirSync(inst.ordner).filter((n) => n.endsWith('-wal')).map((n) => readFileSync(join(inst.ordner, n)));
  for (const roh of [dbDatei, ...wal]) {
    const t = roh.toString('latin1');
    for (const verboten of ['Erika', 'lehrkraft-a@schule.test', 'a1f3c9e2-lk-0001', 'Testschule Nord']) assert.ok(!t.includes(verboten), `${verboten} in der Datenbank`);
  }
  const ab = await b.anfrage('/api/v1/abmeldung', { methode: 'POST', json: {} });
  assert.match(ab.daten.weiter, /\/attrappe\/abmelden\?client_id=spurensuche/);
  assert.equal((await b.anfrage('/api/v1/ich')).daten.rolle, null);
});

test('Anmeldung: fehlende Rolle, Schlüsselwechsel beim Anbieter, Ausfall des Anbieters', async () => {
  const anmelden = async (b, konto) => {
    const ziel = new URL((await b.anfrage('/anmeldung/start')).kopf.get('location'));
    const felder = Object.fromEntries(['client_id', 'redirect_uri', 'state', 'nonce', 'code_challenge'].map((k) => [k, ziel.searchParams.get(k)]));
    const rueck = new URL((await b.anfrage('/attrappe/authorize', { methode: 'POST', text: new URLSearchParams({ ...felder, konto }).toString() })).kopf.get('location'));
    return (await b.anfrage(rueck.pathname + rueck.search)).kopf.get('location');
  };
  assert.match(await anmelden(klient(inst.url), 'ohne-rolle'), /fehler=rolle/);
  await klient(inst.url).anfrage('/attrappe/schluesselwechsel', { methode: 'POST' });
  assert.equal(await anmelden(klient(inst.url), 'lehrkraft-2'), '/lehrkraefte.html', 'neuer Schlüssel wird nachgeladen');
  assert.equal(await anmelden(klient(inst.url), 'lernende-1'), '/#/beitritt');
  // Ausfall: eine frische Instanz, deren Anbieter nicht antwortet
  const zweite = await starteInstanz();
  try {
    await klient(zweite.url).anfrage('/attrappe/ausfall?an=1', { methode: 'POST' });
    const r = await klient(zweite.url).anfrage('/anmeldung/start');
    assert.match(r.kopf.get('location'), /fehler=nicht-erreichbar/);
    // Zugangsschlüssel funktioniert trotzdem
    const l = await alsLehrkraft(zweite);
    assert.equal((await l.anfrage('/api/v1/ich')).daten.rolle, 'lehrkraft');
  } finally { await zweite.stopp(); }
});

test('Messwerte nur mit Schlüssel; Verwaltung sieht Übersicht ohne Personendaten', async () => {
  const k = klient(inst.url);
  assert.equal((await k.anfrage('/api/v1/betrieb/messwerte')).status, 401);
  const m = await k.anfrage('/api/v1/betrieb/messwerte', { token: 'messwerte-test-token' });
  assert.match(m.text, /spur_anfragen_gesamt/);
  const v = klient(inst.url);
  await v.anfrage('/api/v1/anmeldung/verwaltung', { methode: 'POST', json: { schluessel: 'VERW-ALTUNG-TEST' } });
  const u = await v.anfrage('/api/v1/verwaltung/uebersicht');
  assert.ok(u.daten.anzahl.gruppen > 0);
  assert.equal((await v.anfrage('/api/v1/lerngruppen')).status, 401, 'Verwaltung sieht keine Lerngruppen');
  assert.equal((await klient(inst.url).anfrage('/api/v1/anmeldung/verwaltung', { methode: 'POST', json: { schluessel: 'falsch' } })).status, 401);
  // gesperrter Zugangsschlüssel meldet sofort ab
  const s = await v.anfrage('/api/v1/verwaltung/zugangsschluessel', { methode: 'POST', json: { bezeichnung: 'Wird gesperrt' } });
  const l = klient(inst.url);
  await l.anfrage('/api/v1/anmeldung/schluessel', { methode: 'POST', json: { schluessel: s.daten.schluessel } });
  assert.equal((await l.anfrage('/api/v1/lerngruppen')).status, 200);
  await v.anfrage(`/api/v1/verwaltung/zugangsschluessel/${s.daten.id}`, { methode: 'PATCH', json: { gesperrt: true } });
  assert.equal((await l.anfrage('/api/v1/lerngruppen')).status, 401);
  assert.equal((await klient(inst.url).anfrage('/api/v1/anmeldung/schluessel', { methode: 'POST', json: { schluessel: s.daten.schluessel } })).status, 401);
});
