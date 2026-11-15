// Datenhaltung mit SQLite (node:sqlite, in Node.js enthalten; keine Fremdbibliothek, eine Datei, leicht zu sichern).
//
// Datensparsam von Grund auf (docs/DATENSCHUTZ.md):
// - keine Tabelle für Lernende: Gruppen sind der einzige Bezugspunkt, Rollen sind Positionen ohne Namen;
// - Lehrkräfte nur als HMAC eines Pseudonyms des Anmeldedienstes bzw. als Zugangsschlüssel-Hash;
// - keine Koordinaten, keine Gerätekennungen, keine IP-Adressen, keine Freitexte außer Bezeichnungen;
// - Löschfristen sind Teil des Schemas (loeschen_am) und werden täglich durchgesetzt; Lerngruppen enden mit dem
//   Schuljahr.

import { DatabaseSync } from 'node:sqlite';

export const SCHEMA = [
  // Version 1
  `CREATE TABLE lehrkraft (
     id INTEGER PRIMARY KEY,
     kennung_hash TEXT NOT NULL UNIQUE,
     herkunft TEXT NOT NULL CHECK (herkunft IN ('anmeldedienst', 'zugangsschluessel')),
     erstellt TEXT NOT NULL, zuletzt TEXT NOT NULL);
   CREATE TABLE zugangsschluessel (
     id INTEGER PRIMARY KEY, bezeichnung TEXT NOT NULL, schluessel_hash TEXT NOT NULL UNIQUE,
     gesperrt INTEGER NOT NULL DEFAULT 0, erstellt TEXT NOT NULL);
   CREATE TABLE sitzung (
     token_hash TEXT PRIMARY KEY,
     rolle TEXT NOT NULL CHECK (rolle IN ('lehrkraft', 'lernende', 'verwaltung')),
     lehrkraft_id INTEGER REFERENCES lehrkraft(id) ON DELETE CASCADE,
     ueber_anmeldedienst INTEGER NOT NULL DEFAULT 0,
     zugang_id INTEGER REFERENCES zugangsschluessel(id) ON DELETE CASCADE,
     ablauf TEXT NOT NULL);
   CREATE TABLE anmeldevorgang (
     zustand_hash TEXT PRIMARY KEY, nonce TEXT NOT NULL, pruefcode TEXT NOT NULL, ziel TEXT NOT NULL, ablauf TEXT NOT NULL);
   CREATE TABLE lerngruppe (
     id TEXT PRIMARY KEY,
     lehrkraft_id INTEGER NOT NULL REFERENCES lehrkraft(id) ON DELETE CASCADE,
     bezeichnung TEXT NOT NULL,
     klassenstufe INTEGER CHECK (klassenstufe IS NULL OR klassenstufe BETWEEN 1 AND 13),
     einwilligung_am TEXT,
     erstellt TEXT NOT NULL, loeschen_am TEXT NOT NULL);
   CREATE TABLE freigabe (
     id TEXT PRIMARY KEY,
     lerngruppe_id TEXT NOT NULL REFERENCES lerngruppe(id) ON DELETE CASCADE,
     titel TEXT NOT NULL,
     zeitrahmen TEXT NOT NULL,
     orte TEXT NOT NULL,
     erfassung INTEGER NOT NULL CHECK (erfassung IN (0, 1)),
     rueckmeldung INTEGER NOT NULL DEFAULT 0,
     inhalt_version TEXT NOT NULL,
     erstellt TEXT NOT NULL, beendet TEXT, loeschen_am TEXT NOT NULL);
   CREATE INDEX freigabe_lerngruppe ON freigabe(lerngruppe_id);
   CREATE TABLE gruppe (
     id TEXT PRIMARY KEY,
     freigabe_id TEXT NOT NULL REFERENCES freigabe(id) ON DELETE CASCADE,
     bezeichnung TEXT NOT NULL,
     code TEXT NOT NULL UNIQUE,
     einschaetzung TEXT,
     erstellt TEXT NOT NULL, letzte_sync TEXT);
   CREATE INDEX gruppe_freigabe ON gruppe(freigabe_id);
   CREATE TABLE geraet (
     token_hash TEXT PRIMARY KEY,
     gruppe_id TEXT NOT NULL REFERENCES gruppe(id) ON DELETE CASCADE,
     erstellt TEXT NOT NULL);
   CREATE TABLE station (
     gruppe_id TEXT NOT NULL REFERENCES gruppe(id) ON DELETE CASCADE,
     ort TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('begonnen', 'abgeschlossen', 'abgebrochen')),
     verifikation TEXT CHECK (verifikation IS NULL OR verifikation IN ('qr', 'code', 'gps', 'ersatz')),
     begonnen TEXT NOT NULL, beendet TEXT, aktiv_sekunden INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (gruppe_id, ort));
   CREATE TABLE lauf (
     id TEXT PRIMARY KEY,
     gruppe_id TEXT NOT NULL REFERENCES gruppe(id) ON DELETE CASCADE,
     aufgabe TEXT NOT NULL,
     geloest INTEGER NOT NULL, versuche INTEGER NOT NULL, dauer_sekunden INTEGER NOT NULL,
     items TEXT NOT NULL, ereignisse TEXT NOT NULL,
     beendet TEXT NOT NULL, empfangen TEXT NOT NULL);
   CREATE INDEX lauf_gruppe ON lauf(gruppe_id);
   CREATE TABLE technik (
     gruppe_id TEXT NOT NULL REFERENCES gruppe(id) ON DELETE CASCADE,
     schluessel TEXT NOT NULL, art TEXT NOT NULL CHECK (art IN ('offline', 'online', 'sync')), zeit TEXT NOT NULL,
     PRIMARY KEY (gruppe_id, schluessel));
   CREATE TABLE rueckmeldung (
     id TEXT PRIMARY KEY,
     freigabe_id TEXT NOT NULL REFERENCES freigabe(id) ON DELETE CASCADE,
     aufgabe TEXT NOT NULL, verstaendlich TEXT, spass TEXT, schwierigkeit TEXT, zeit TEXT NOT NULL);
   CREATE TABLE bildbeitrag (
     kennung TEXT PRIMARY KEY,
     gruppe_id TEXT REFERENCES gruppe(id) ON DELETE SET NULL,
     herkunft TEXT NOT NULL CHECK (herkunft IN ('schule', 'familie')),
     art TEXT NOT NULL CHECK (art IN ('item-collage', 'ki-generiert')),
     items TEXT NOT NULL, erstellt TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('wartet', 'freigegeben', 'abgelehnt')),
     entschieden TEXT,
     png BLOB NOT NULL, png_sha256 TEXT NOT NULL, vorschau BLOB NOT NULL, vorschau_typ TEXT NOT NULL,
     empfangen TEXT NOT NULL);
   CREATE INDEX bildbeitrag_status ON bildbeitrag(status, entschieden);
   CREATE TABLE eingang (schluessel TEXT PRIMARY KEY, zeit TEXT NOT NULL);
   CREATE TABLE protokoll (
     id INTEGER PRIMARY KEY, zeit TEXT NOT NULL, rolle TEXT NOT NULL, aktion TEXT NOT NULL, ziel TEXT);
   CREATE INDEX protokoll_zeit ON protokoll(zeit);
   CREATE TABLE einstellung (schluessel TEXT PRIMARY KEY, wert TEXT NOT NULL);`,
  // Version 2: Rolle „betrieb“ (Betriebsseite), Aufträge an den Betriebsdienst am Server, Messreihe für die
  // Statusseite, Stand der Anwendung je Rückmeldung. Nur Erweiterungen: Version 1 läuft auf dieser Datenbank weiter.
  `CREATE TABLE sitzung_neu (
     token_hash TEXT PRIMARY KEY,
     rolle TEXT NOT NULL CHECK (rolle IN ('lehrkraft', 'lernende', 'verwaltung', 'betrieb')),
     lehrkraft_id INTEGER REFERENCES lehrkraft(id) ON DELETE CASCADE,
     ueber_anmeldedienst INTEGER NOT NULL DEFAULT 0,
     zugang_id INTEGER REFERENCES zugangsschluessel(id) ON DELETE CASCADE,
     ablauf TEXT NOT NULL);
   INSERT INTO sitzung_neu (token_hash, rolle, lehrkraft_id, ueber_anmeldedienst, zugang_id, ablauf)
     SELECT token_hash, rolle, lehrkraft_id, ueber_anmeldedienst, zugang_id, ablauf FROM sitzung;
   DROP TABLE sitzung;
   ALTER TABLE sitzung_neu RENAME TO sitzung;
   ALTER TABLE rueckmeldung ADD COLUMN stand TEXT;
   CREATE TABLE betriebsauftrag (
     id INTEGER PRIMARY KEY,
     aktion TEXT NOT NULL CHECK (aktion IN ('version-zurueck')),
     status TEXT NOT NULL CHECK (status IN ('offen', 'laeuft', 'fertig', 'fehler')),
     erstellt TEXT NOT NULL, begonnen TEXT, erledigt TEXT, meldung TEXT);
   CREATE TABLE messreihe (
     zeit TEXT PRIMARY KEY,
     anfragen INTEGER NOT NULL, fehler INTEGER NOT NULL, p95_ms INTEGER,
     sync INTEGER NOT NULL, gruppen_aktiv INTEGER NOT NULL, speicher_mb INTEGER, cpu_prozent INTEGER);`,
];

export const SCHEMA_VERSION = SCHEMA.length;

export function oeffne(pfad) {
  const db = new DatabaseSync(pfad);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const aktuell = db.prepare('SELECT max(version) AS v FROM schema_version').get().v ?? 0;
  for (let v = aktuell; v < SCHEMA.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(SCHEMA[v]);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v + 1);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

/** Führt fn in einer Transaktion aus. */
export function transaktion(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/**
 * Setzt die Löschfristen durch: Quest-Daten nach `loeschen_am` (zwölf Wochen nach Abschluss, spätestens Ende des
 * Schuljahres), abgelaufene Sitzungen und Anmeldevorgänge, Eingangsschlüssel nach zwei Tagen, Protokoll nach
 * `protokollTage`, Messreihe der Statusseite nach 14 Tagen, Aufträge an den Betriebsdienst nach 90 Tagen. Nicht
 * freigegebene Bildbeiträge gelöschter Gruppen gehen mit; freigegebene bleiben ohne Bezug zur Gruppe für die
 * Ausstellung erhalten.
 */
export function raeumeAuf(db, jetzt = new Date(), { protokollTage = 365 } = {}) {
  const t = jetzt.toISOString();
  return transaktion(db, () => {
    const lerngruppen = db.prepare('DELETE FROM lerngruppe WHERE loeschen_am <= ?').run(t).changes;
    const freigaben = db.prepare('DELETE FROM freigabe WHERE loeschen_am <= ?').run(t).changes;
    const bilder = db.prepare("DELETE FROM bildbeitrag WHERE gruppe_id IS NULL AND herkunft = 'schule' AND status <> 'freigegeben'").run().changes;
    const sitzungen = db.prepare('DELETE FROM sitzung WHERE ablauf <= ?').run(t).changes;
    db.prepare('DELETE FROM anmeldevorgang WHERE ablauf <= ?').run(t);
    db.prepare('DELETE FROM eingang WHERE zeit <= ?').run(new Date(jetzt.getTime() - 2 * 86400000).toISOString());
    db.prepare('DELETE FROM protokoll WHERE zeit <= ?').run(new Date(jetzt.getTime() - protokollTage * 86400000).toISOString());
    db.prepare('DELETE FROM messreihe WHERE zeit <= ?').run(new Date(jetzt.getTime() - 14 * 86400000).toISOString());
    db.prepare('DELETE FROM betriebsauftrag WHERE erstellt <= ?').run(new Date(jetzt.getTime() - 90 * 86400000).toISOString());
    return { lerngruppen, freigaben, bilder, sitzungen };
  });
}
