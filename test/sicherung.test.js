// Sicherung und Rückspielen: verschlüsselt, vollständig, gleiche Prüfsummen; falscher Schlüssel scheitert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { oeffne } from '../server/db.js';
import { sichere, spieleZurueck, pruefsummen } from '../server/sicherung.js';

test('Sicherung verschlüsselt, Rückspielen ergibt dieselben Tabellen', async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'spur-sich-'));
  try {
    const pfad = join(ordner, 'spurensuche.db');
    const db = oeffne(pfad);
    const jetzt = new Date().toISOString();
    db.prepare("INSERT INTO lehrkraft (kennung_hash, herkunft, erstellt, zuletzt) VALUES ('abc', 'zugangsschluessel', ?, ?)").run(jetzt, jetzt);
    db.prepare("INSERT INTO lerngruppe (id, lehrkraft_id, bezeichnung, klassenstufe, erstellt, loeschen_am) VALUES ('lg1', 1, 'Klasse 6a', 6, ?, ?)").run(jetzt, jetzt);
    db.prepare("INSERT INTO freigabe (id, lerngruppe_id, titel, zeitrahmen, orte, erfassung, inhalt_version, erstellt, loeschen_am) VALUES ('f1', 'lg1', 'Test', 'stunde', '[]', 1, 'x', ?, ?)").run(jetzt, jetzt);
    db.prepare("INSERT INTO gruppe (id, freigabe_id, bezeichnung, code, erstellt) VALUES ('g1', 'f1', 'Biber', 'ABCD-EFGH', ?)").run(jetzt);
    for (let i = 0; i < 200; i++) db.prepare("INSERT INTO lauf (id, gruppe_id, aufgabe, geloest, versuche, dauer_sekunden, items, ereignisse, beendet, empfangen) VALUES (?, 'g1', 'a/1', 1, 2, 60, '[]', '[]', ?, ?)").run(randomUUID(), jetzt, jetzt);
    db.close();
    const schluessel = randomBytes(32);
    const r = await sichere({ datenbank: pfad, ordner: join(ordner, 'sicherungen'), schluessel });
    const roh = readFileSync(r.datei);
    assert.ok(!roh.toString('latin1').includes('Klasse 6a'), 'Inhalt ist verschlüsselt');
    const ziel = join(ordner, 'zurueck', 'spurensuche.db');
    await spieleZurueck({ datei: r.datei, ziel, schluessel });
    assert.deepEqual(pruefsummen(ziel), pruefsummen(pfad));
    assert.equal(pruefsummen(ziel).lauf.zeilen, 200);
    await assert.rejects(spieleZurueck({ datei: r.datei, ziel: join(ordner, 'x.db'), schluessel: randomBytes(32) }));
    const kaputt = Buffer.from(roh); kaputt[100] ^= 0xff;
    writeFileSync(join(ordner, 'kaputt.enc'), kaputt);
    await assert.rejects(spieleZurueck({ datei: join(ordner, 'kaputt.enc'), ziel: join(ordner, 'y.db'), schluessel }));
    await assert.rejects(spieleZurueck({ datei: r.datei, ziel, schluessel }), /gibt es schon/);
  } finally { rmSync(ordner, { recursive: true, force: true }); }
});
