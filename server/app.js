// HTTP-Server: Oberfläche (App, Lehrkräfte, Verwaltung), Inhalte und die Schnittstelle /api/v1 (docs/openapi.json).
// Nur Node.js-Bordmittel. Bindet standardmäßig nur an 127.0.0.1; davor gehört ein Reverse Proxy mit TLS.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve, extname, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';

import { oeffne, transaktion, raeumeAuf, SCHEMA_VERSION } from './db.js';
import { ladeInhalte } from './inhalte.js';
import { oidcKlient, AnmeldeFehler } from './oidc.js';
import { attrappe as erstelleAttrappe } from './attrappe.js';
import { bildInfo } from './bilder.js';
import { erstelleArchiv } from './archiv.js';
import { registriereBetrieb, Messreihe } from './betrieb.js';
import { liesAktiv, liesBeschreibung, paketWurzel, MITGELIEFERT } from './inhaltspaket.js';
import { COOKIE, hash, hmac, token, kennung, code as neuerCode, normalisiereCode, gleich, leseCookies, cookieKopf, bremse, kopfzeilen, SVG_RICHTLINIE } from './sicherheit.js';
import { bereinigeEreignisse } from '../app/js/kern/ereignisse.js';
import { beobachtungen, kompetenzraster, formulierungsentwurf, BEREICHE, STUFEN } from '../app/js/kern/raster.js';
import { pruefeBezeichnung } from '../app/js/kern/namen.js';
import { loeschtermin, schuljahresende, datum } from '../app/js/kern/zeit.js';

export const VERSION = '0.1.0';

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};
const TEXT = /^(text\/|application\/(json|manifest\+json)|image\/svg)/;
const SEITEN = {
  '/': 'index.html', '/index.html': 'index.html', '/lehrkraefte': 'lehrkraefte.html', '/lehrkraefte.html': 'lehrkraefte.html',
  '/verwaltung': 'verwaltung.html', '/verwaltung.html': 'verwaltung.html', '/betrieb': 'betrieb.html', '/betrieb.html': 'betrieb.html',
  '/status': 'status.html', '/status.html': 'status.html',
};
const MAX_KOERPER = 1024 * 1024;
const MAX_BILD_KOERPER = 16 * 1024 * 1024;
const SITZUNG_STUNDEN = { lehrkraft: 12, lernende: 8, verwaltung: 2, betrieb: 8 };
const GERAET_TAGE = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export class HttpFehler extends Error {
  constructor(status, meldung, daten = {}) { super(meldung); this.status = status; this.daten = daten; }
}

class Antwort {
  constructor(status, daten, kopf = {}, roh = null) { this.status = status; this.daten = daten; this.kopf = kopf; this.roh = roh; }
}
const mit = (status, daten, kopf) => new Antwort(status, daten, kopf);
const datei = (inhalt, typ, kopf = {}) => new Antwort(200, null, { 'Content-Type': typ, ...kopf }, inhalt);
const weiter = (ort, kopf = {}) => new Antwort(302, null, { Location: ort, ...kopf }, '');

export async function erstelleApp(cfg) {
  const log = cfg.log ?? console;
  const db = oeffne(cfg.datenbank);
  const jetzt = () => new Date().toISOString();
  const gestartet = Date.now();
  const datenOrdner = cfg.datenOrdner ?? dirname(resolve(cfg.datenbank));

  // Inhalte: das aktive Inhaltspaket (Betriebsseite, „Inhalt tauschen“) oder der mitgelieferte Inhalt. Hat das Paket
  // Fehler oder fehlt es, läuft die Anwendung mit dem mitgelieferten Inhalt weiter und die Ampel zeigt das.
  const paket = { id: MITGELIEFERT, beschreibung: null, warnung: null };
  let datenWurzel = cfg.inhaltsWurzel;
  let inhalte = null;
  const aktiv = await liesAktiv(datenOrdner);
  if (aktiv.paket !== MITGELIEFERT) {
    const beschreibung = await liesBeschreibung(datenOrdner, aktiv.paket);
    const probe = beschreibung ? await ladeInhalte({ appWurzel: cfg.appWurzel, inhaltsWurzel: cfg.inhaltsWurzel, datenWurzel: paketWurzel(datenOrdner, aktiv.paket) }) : null;
    if (probe && !probe.fehler.length) {
      Object.assign(paket, { id: aktiv.paket, beschreibung });
      datenWurzel = paketWurzel(datenOrdner, aktiv.paket);
      inhalte = probe;
    } else {
      paket.warnung = `Das aktive Inhaltspaket ${beschreibung?.name ?? aktiv.paket} ließ sich nicht laden${probe ? ` (${probe.fehler.length} Fehler)` : ''}; der mitgelieferte Inhalt ist aktiv.`;
      log.error?.(paket.warnung);
    }
  }
  inhalte ??= await ladeInhalte({ appWurzel: cfg.appWurzel, inhaltsWurzel: cfg.inhaltsWurzel });
  for (const f of inhalte.fehler) log.error?.(`Inhalt: ${f.datei} ${f.pfad}: ${f.meldung}`);

  // Geheimer Pfeffer für die HMAC der Pseudonyme; liegt nur in der Datenbank der Instanz.
  let pfeffer = db.prepare("SELECT wert FROM einstellung WHERE schluessel = 'pfeffer'").get()?.wert;
  if (!pfeffer) {
    pfeffer = token(32);
    db.prepare("INSERT INTO einstellung (schluessel, wert) VALUES ('pfeffer', ?)").run(pfeffer);
  }
  // Schlüssel der Verwaltung: aus der Umgebung oder beim ersten Start erzeugt (einmal im Protokoll ausgegeben).
  if (cfg.verwaltungSchluessel) {
    db.prepare("INSERT INTO einstellung (schluessel, wert) VALUES ('verwaltung', ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert").run(hash(normalisiereCode(cfg.verwaltungSchluessel)));
  } else if (!db.prepare("SELECT 1 FROM einstellung WHERE schluessel = 'verwaltung'").get()) {
    const s = neuerCode(16);
    db.prepare("INSERT INTO einstellung (schluessel, wert) VALUES ('verwaltung', ?)").run(hash(normalisiereCode(s)));
    log.info?.(`Erster Start: Schlüssel der Verwaltung ${s} (nur jetzt sichtbar; ändern mit SPUR_VERWALTUNG_SCHLUESSEL)`);
  }
  // Schlüssel des Betriebs (Betriebsseite): ebenso aus der Umgebung oder beim ersten Start erzeugt.
  if (cfg.betriebSchluessel) {
    db.prepare("INSERT INTO einstellung (schluessel, wert) VALUES ('betrieb', ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert").run(hash(normalisiereCode(cfg.betriebSchluessel)));
  } else if (!db.prepare("SELECT 1 FROM einstellung WHERE schluessel = 'betrieb'").get()) {
    const s = neuerCode(16);
    db.prepare("INSERT INTO einstellung (schluessel, wert) VALUES ('betrieb', ?)").run(hash(normalisiereCode(s)));
    log.info?.(`Erster Start: Schlüssel des Betriebs ${s} (nur jetzt sichtbar; ändern mit SPUR_BETRIEB_SCHLUESSEL)`);
  }
  // Wurde beim Start eine Sicherung zurückgespielt (server/start.js), bleibt angemeldet, wer sie ausgelöst hat.
  if (cfg.zurueckgespielt) {
    const z = cfg.zurueckgespielt;
    for (const t of z.sitzungen ?? []) db.prepare('INSERT OR IGNORE INTO sitzung (token_hash, rolle, ablauf) VALUES (?, ?, ?)').run(t.token_hash, t.rolle, t.ablauf);
    db.prepare("INSERT INTO einstellung (schluessel, wert) VALUES ('zurueckgespielt', ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert")
      .run(JSON.stringify({ datei: z.datei, zeit: jetzt(), fehler: z.fehler ?? null }));
  }

  const attrappe = cfg.attrappe ? erstelleAttrappe({
    aussteller: `${cfg.oeffentlicheUrl}/attrappe`,
    clients: { [cfg.oidc.clientId]: { geheimnis: cfg.oidc.clientSecret, weiterleitungen: [`${cfg.oeffentlicheUrl}/anmeldung/rueckkehr`], abmeldeZiele: [`${cfg.oeffentlicheUrl}/lehrkraefte.html`, `${cfg.oeffentlicheUrl}/`] } },
  }) : null;
  const oidc = cfg.oidc?.aussteller ? oidcKlient({ ...cfg.oidc, rueckkehrUrl: `${cfg.oeffentlicheUrl}/anmeldung/rueckkehr` }) : null;
  const kopf = kopfzeilen();
  const fehlversuche = bremse(cfg.maxFehlversuche ?? 20);
  const familienBremse = bremse(cfg.maxFamilienbilder ?? 30);
  const messung = { start: Date.now(), anfragen: new Map(), dauer: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], grenzen: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, Infinity], sync: { angenommen: 0, doppelt: 0 } };
  const messreihe = new Messreihe(messung.grenzen);
  const dateiCache = new Map();

  const protokolliere = (rolle, aktion, ziel = null) => db.prepare('INSERT INTO protokoll (zeit, rolle, aktion, ziel) VALUES (?, ?, ?, ?)').run(jetzt(), rolle, aktion, ziel);
  protokolliere('system', 'start', cfg.versionBild ?? VERSION);
  if (cfg.zurueckgespielt) protokolliere('betrieb', cfg.zurueckgespielt.fehler ? 'zurueckspielen-fehlgeschlagen' : 'sicherung-zurueckgespielt', cfg.zurueckgespielt.datei);
  const aufraeumen = () => {
    const r = raeumeAuf(db, new Date());
    if (r.lerngruppen || r.freigaben || r.bilder) protokolliere('system', 'loeschfrist', JSON.stringify(r));
    return r;
  };
  aufraeumen();
  const zeitgeber = setInterval(aufraeumen, 3600_000);
  zeitgeber.unref();

  // --- Eingaben ----------------------------------------------------------------------------------------------------

  async function koerper(req, art = 'json', max = MAX_KOERPER) {
    if (art === 'json' && !/^application\/json\b/.test(req.headers['content-type'] ?? '')) throw new HttpFehler(415, 'Erwartet wird application/json');
    const teile = [];
    let n = 0;
    for await (const t of req) {
      n += t.length;
      if (n > max) throw new HttpFehler(413, `Anfrage zu groß (höchstens ${Math.round(max / 1048576)} MB)`);
      teile.push(t);
    }
    const text = Buffer.concat(teile).toString('utf8');
    if (art === 'text') return text;
    try { return JSON.parse(text || '{}'); } catch { throw new HttpFehler(400, 'JSON nicht lesbar'); }
  }

  /** Roher Körper (Dateien wie Inhaltspakete), höchstens `max` Byte. */
  async function koerperRoh(req, max) {
    const teile = [];
    let n = 0;
    for await (const t of req) {
      n += t.length;
      if (n > max) throw new HttpFehler(413, `Datei zu groß (höchstens ${Math.round(max / 1048576)} MB)`);
      teile.push(t);
    }
    return Buffer.concat(teile);
  }

  const absender = (req) => req.socket.remoteAddress ?? 'unbekannt';

  function sitzung(req) {
    const t = leseCookies(req.headers.cookie)[COOKIE];
    if (!t) return null;
    const s = db.prepare('SELECT rolle, lehrkraft_id, ueber_anmeldedienst FROM sitzung WHERE token_hash = ? AND ablauf > ?').get(hash(t), jetzt());
    return s ?? null;
  }
  function lehrkraft(req) {
    const s = sitzung(req);
    if (!s || s.rolle !== 'lehrkraft') throw new HttpFehler(401, 'Bitte als Lehrkraft anmelden');
    return s;
  }
  function verwaltung(req) {
    const s = sitzung(req);
    if (!s || s.rolle !== 'verwaltung') throw new HttpFehler(401, 'Bitte mit dem Schlüssel der Verwaltung anmelden');
    return s;
  }
  function geraet(req) {
    const t = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!t) throw new HttpFehler(401, 'Gerät nicht angemeldet');
    const g = db.prepare(`SELECT g.id AS gruppe_id, g.bezeichnung, f.id AS freigabe_id, f.erfassung, f.rueckmeldung, f.orte, f.titel, f.beendet
                          FROM geraet d JOIN gruppe g ON g.id = d.gruppe_id JOIN freigabe f ON f.id = g.freigabe_id WHERE d.token_hash = ?`).get(hash(t));
    if (!g) throw new HttpFehler(410, 'Diese Gruppe gibt es nicht mehr. Die Lehrkraft hat sie gelöscht oder die Frist ist abgelaufen.');
    return g;
  }
  function ausstellung(req) {
    if (cfg.ausstellungOffen) return;
    const t = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!cfg.ausstellungToken || !t || !gleich(t, cfg.ausstellungToken)) throw new HttpFehler(401, 'Schlüssel der Ausstellung fehlt oder ist falsch');
  }

  function neueSitzung(rolle, lehrkraftId = null, ueberAnmeldedienst = false, zugangId = null) {
    const t = token();
    const stunden = SITZUNG_STUNDEN[rolle];
    db.prepare('INSERT INTO sitzung (token_hash, rolle, lehrkraft_id, ueber_anmeldedienst, zugang_id, ablauf) VALUES (?, ?, ?, ?, ?, ?)')
      .run(hash(t), rolle, lehrkraftId, ueberAnmeldedienst ? 1 : 0, zugangId, new Date(Date.now() + stunden * 3600_000).toISOString());
    return cookieKopf(t, stunden * 3600, cfg.sichereCookies);
  }

  function lehrkraftFuer(kennungHash, herkunft) {
    const vorhanden = db.prepare('SELECT id FROM lehrkraft WHERE kennung_hash = ?').get(kennungHash);
    if (vorhanden) {
      db.prepare('UPDATE lehrkraft SET zuletzt = ? WHERE id = ?').run(jetzt(), vorhanden.id);
      return vorhanden.id;
    }
    return Number(db.prepare('INSERT INTO lehrkraft (kennung_hash, herkunft, erstellt, zuletzt) VALUES (?, ?, ?, ?)').run(kennungHash, herkunft, jetzt(), jetzt()).lastInsertRowid);
  }

  // --- Prüfen und Zusammensetzen -----------------------------------------------------------------------------------

  const klassen4bis8 = (klassenstufe) => Number.isInteger(klassenstufe) && klassenstufe >= 4 && klassenstufe <= 8;

  function erfassungFuer(lg) {
    if (!klassen4bis8(lg.klassenstufe)) return { erfassung: false, grund: 'Diese Lerngruppe gehört nicht zu den Klassenstufen 4 bis 8. Die Gruppen spielen ohne Auswertung; es entstehen keine Beobachtungsdaten.' };
    if (!lg.einwilligung_am) return { erfassung: false, grund: 'Die Einwilligungen der Erziehungsberechtigten sind noch nicht bestätigt. Bis dahin entstehen keine Beobachtungsdaten.' };
    return { erfassung: true, grund: 'Beobachtungen werden auf Gruppenebene erfasst.' };
  }

  function eigeneLerngruppe(s, id) {
    const lg = db.prepare('SELECT * FROM lerngruppe WHERE id = ? AND lehrkraft_id = ?').get(id, s.lehrkraft_id);
    if (!lg) throw new HttpFehler(404, 'Lerngruppe nicht gefunden');
    return lg;
  }
  function eigeneFreigabe(s, id) {
    const f = db.prepare('SELECT f.*, l.bezeichnung AS lerngruppe, l.klassenstufe FROM freigabe f JOIN lerngruppe l ON l.id = f.lerngruppe_id WHERE f.id = ? AND l.lehrkraft_id = ?').get(id, s.lehrkraft_id);
    if (!f) throw new HttpFehler(404, 'Quest nicht gefunden');
    return f;
  }
  function eigeneGruppe(s, id) {
    const g = db.prepare(`SELECT g.*, f.titel AS quest, f.orte, f.erfassung, f.erstellt AS freigabe_erstellt, f.loeschen_am FROM gruppe g JOIN freigabe f ON f.id = g.freigabe_id
                          JOIN lerngruppe l ON l.id = f.lerngruppe_id WHERE g.id = ? AND l.lehrkraft_id = ?`).get(id, s.lehrkraft_id);
    if (!g) throw new HttpFehler(404, 'Gruppe nicht gefunden');
    return g;
  }

  function pruefeOrte(orte) {
    if (!Array.isArray(orte) || orte.length === 0 || orte.length > 15) throw new HttpFehler(400, 'Bitte 1 bis 15 Orte wählen');
    const gesehen = new Set();
    return orte.map((o) => {
      const ort = inhalte.ortNach.get(o?.ort);
      if (!ort || gesehen.has(ort.id)) throw new HttpFehler(400, `Ort ${o?.ort} unbekannt oder doppelt`);
      gesehen.add(ort.id);
      const aufgaben = Array.isArray(o.aufgaben) && o.aufgaben.length ? o.aufgaben : ort.aufgaben;
      for (const nr of aufgaben) if (!ort.aufgaben.includes(nr)) throw new HttpFehler(400, `Aufgabe ${ort.id}/${nr} unbekannt`);
      return { ort: ort.id, aufgaben: [...new Set(aufgaben)] };
    });
  }

  function questOrte(orte) {
    return orte.map(({ ort, aufgaben }) => {
      const o = inhalte.ortNach.get(ort);
      return {
        ort, name: o?.name ?? ort, region: o?.region ?? '',
        aufgaben: aufgaben.map((nr) => { const a = inhalte.aufgabeNach.get(`${ort}/${nr}`); return { nr, titel: a?.titel ?? nr, format: a?.format ?? null, dauerMinuten: a?.dauerMinuten ?? null, stufe: a?.stufe ?? null }; }),
      };
    });
  }

  function gruppeDaten(gruppeId) {
    const stationen = db.prepare('SELECT ort, status, verifikation, begonnen, beendet, aktiv_sekunden FROM station WHERE gruppe_id = ? ORDER BY begonnen').all(gruppeId)
      .map((s) => ({ ort: s.ort, ortName: inhalte.ortNach.get(s.ort)?.name ?? s.ort, status: s.status, verifikation: s.verifikation, begonnen: s.begonnen, beendet: s.beendet, aktivSekunden: s.aktiv_sekunden }));
    const laeufe = db.prepare('SELECT aufgabe, geloest, versuche, dauer_sekunden, items, ereignisse, beendet FROM lauf WHERE gruppe_id = ? ORDER BY beendet').all(gruppeId).map((l) => {
      const a = inhalte.aufgabeNach.get(l.aufgabe);
      return { aufgabe: l.aufgabe, ort: l.aufgabe.split('/')[0], titel: a?.titel ?? l.aufgabe, format: a?.format ?? null, stufe: a?.stufe ?? null, rollen: a?.rollen ?? null, geloest: !!l.geloest, versuche: l.versuche, dauerSekunden: l.dauer_sekunden, items: JSON.parse(l.items), ereignisse: JSON.parse(l.ereignisse), beendet: l.beendet };
    });
    const technik = db.prepare('SELECT art, zeit FROM technik WHERE gruppe_id = ? ORDER BY zeit').all(gruppeId);
    const bild = db.prepare('SELECT erstellt FROM bildbeitrag WHERE gruppe_id = ? ORDER BY erstellt DESC LIMIT 1').get(gruppeId);
    return { stationen, laeufe, technik, bildbeitrag: bild ?? null };
  }

  // --- Routen ------------------------------------------------------------------------------------------------------

  const routen = [];
  const route = (methode, muster, fn) => routen.push({ methode, muster: new RegExp(`^${muster}$`), fn });

  route('GET', '/api/v1/status', () => ({
    ok: true, version: VERSION, installiert: cfg.versionBild ?? VERSION, schema: SCHEMA_VERSION, inhaltVersion: inhalte.inhaltVersion, inhaltFehler: inhalte.fehler.length,
    zeit: jetzt(), gestartet: new Date(gestartet).toISOString(), betrieb: betriebTeil.oeffentlich(),
    anmeldung: { anmeldedienst: !!oidc, zugangsschluessel: true, attrappe: !!attrappe }, lernendeAnmeldung: cfg.lernendeAnmeldung,
  }));

  // Betrieb: Statusseite, Knöpfe und Betriebsdienst (server/betrieb.js)
  const betriebTeil = registriereBetrieb({
    route, db, cfg, log, jetzt, protokolliere, koerper, koerperRoh, sitzung, HttpFehler, mit, datei, VERSION, SCHEMA_VERSION, messreihe, gestartet, datenOrdner,
    fehlversuche, absender, gleich, hash, normalisiereCode, neueSitzung,
    inhalte: {
      holen: () => inhalte,
      paket: () => paket,
      async setze(neu, id, wurzel) {
        inhalte = neu;
        datenWurzel = wurzel;
        Object.assign(paket, { id, beschreibung: id === MITGELIEFERT ? null : await liesBeschreibung(datenOrdner, id), warnung: null });
        dateiCache.clear();
      },
    },
  });

  // Gerät einer Gruppe: Beitritt mit Code, danach Übertragung mit Gerätetoken
  route('POST', '/api/v1/beitritt', async (req) => {
    if (!fehlversuche.erlaubt(absender(req))) throw new HttpFehler(429, 'Zu viele falsche Codes. Bitte eine Minute warten.');
    if (cfg.lernendeAnmeldung === 'pflicht' && sitzung(req)?.rolle !== 'lernende') throw new HttpFehler(401, 'Bitte zuerst mit dem Schulkonto anmelden');
    const { code } = await koerper(req);
    const g = db.prepare(`SELECT g.id, g.bezeichnung, f.id AS freigabe_id, f.titel, f.orte, f.erfassung, f.rueckmeldung, f.beendet
                          FROM gruppe g JOIN freigabe f ON f.id = g.freigabe_id WHERE g.code = ?`).get(normalisiereCode(code));
    if (!g || g.beendet) {
      fehlversuche.fehlschlag(absender(req));
      throw new HttpFehler(404, g ? 'Diese Quest ist schon beendet.' : 'Diesen Code gibt es nicht. Bitte noch einmal nachsehen.');
    }
    const t = token();
    db.prepare('INSERT INTO geraet (token_hash, gruppe_id, erstellt) VALUES (?, ?, ?)').run(hash(t), g.id, jetzt());
    return { token: t, gruppe: { bezeichnung: g.bezeichnung }, freigabe: { id: g.freigabe_id, titel: g.titel, orte: JSON.parse(g.orte), erfassung: !!g.erfassung, rueckmeldung: !!g.rueckmeldung } };
  });

  route('GET', '/api/v1/geraet', (req) => {
    const g = geraet(req);
    return { gruppe: { bezeichnung: g.bezeichnung }, freigabe: { id: g.freigabe_id, titel: g.titel, orte: JSON.parse(g.orte), erfassung: !!g.erfassung, rueckmeldung: !!g.rueckmeldung, beendet: g.beendet } };
  });

  route('POST', '/api/v1/sync', async (req) => {
    const g = geraet(req);
    const k = await koerper(req);
    if (typeof k.schluessel !== 'string' || !UUID.test(k.schluessel)) throw new HttpFehler(400, 'schluessel (UUID) fehlt');
    if (!g.erfassung) return { erfasst: false, hinweis: 'Für diese Gruppe werden keine Beobachtungen gespeichert.', erfassung: false };
    const orte = new Map(JSON.parse(g.orte).map((o) => [o.ort, new Set(o.aufgaben)]));
    const ergebnis = { erfasst: true, erfassung: true, doppelt: false, angenommen: { stationen: 0, laeufe: 0, technik: 0, rueckmeldungen: 0 }, abgelehnt: [] };
    transaktion(db, () => {
      if (db.prepare('SELECT 1 FROM eingang WHERE schluessel = ?').get(k.schluessel)) { ergebnis.doppelt = true; return; }
      db.prepare('INSERT INTO eingang (schluessel, zeit) VALUES (?, ?)').run(k.schluessel, jetzt());

      for (const s of Array.isArray(k.stationen) ? k.stationen.slice(0, 50) : []) {
        if (!orte.has(s?.ort) || !['begonnen', 'abgeschlossen', 'abgebrochen'].includes(s.status) || !ISO.test(s.begonnen ?? '')
          || (s.beendet && !ISO.test(s.beendet)) || (s.verifikation && !['qr', 'code', 'gps', 'ersatz'].includes(s.verifikation))) {
          ergebnis.abgelehnt.push({ art: 'station', ort: s?.ort ?? null }); continue;
        }
        const aktiv = Number.isFinite(s.aktivSekunden) ? Math.max(0, Math.min(6 * 3600, Math.round(s.aktivSekunden))) : 0;
        // Abgeschlossen bleibt abgeschlossen; sonst gilt der zuletzt gemeldete Stand. Zeiten: frühester Beginn, spätestes Ende.
        db.prepare(`INSERT INTO station (gruppe_id, ort, status, verifikation, begonnen, beendet, aktiv_sekunden) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(gruppe_id, ort) DO UPDATE SET
                      status = CASE WHEN station.status = 'abgeschlossen' THEN 'abgeschlossen' ELSE excluded.status END,
                      verifikation = COALESCE(excluded.verifikation, station.verifikation),
                      begonnen = MIN(station.begonnen, excluded.begonnen),
                      beendet = CASE WHEN excluded.beendet IS NULL THEN station.beendet WHEN station.beendet IS NULL THEN excluded.beendet ELSE MAX(station.beendet, excluded.beendet) END,
                      aktiv_sekunden = MAX(station.aktiv_sekunden, excluded.aktiv_sekunden)`)
          .run(g.gruppe_id, s.ort, s.status, s.verifikation ?? null, s.begonnen, s.beendet ?? null, aktiv);
        ergebnis.angenommen.stationen++;
      }

      for (const l of Array.isArray(k.laeufe) ? k.laeufe.slice(0, 100) : []) {
        const [ort, nr] = String(l?.aufgabe ?? '').split('/');
        const aufgabe = inhalte.aufgabeNach.get(l?.aufgabe);
        if (typeof l?.id !== 'string' || !UUID.test(l.id) || !aufgabe || !orte.get(ort)?.has(nr) || !ISO.test(l.beendet ?? '')) {
          ergebnis.abgelehnt.push({ art: 'lauf', aufgabe: l?.aufgabe ?? null }); continue;
        }
        const { ereignisse } = bereinigeEreignisse(l.ereignisse ?? [], { aufgabe });
        const items = (Array.isArray(l.items) ? l.items : []).filter((i) => (aufgabe.belohnung ?? []).includes(i));
        const versuche = ereignisse.filter((e) => e.art === 'versuch').length;
        const dauer = Number.isFinite(l.dauerSekunden) ? Math.max(0, Math.min(6 * 3600, Math.round(l.dauerSekunden))) : 0;
        const r = db.prepare('INSERT OR IGNORE INTO lauf (id, gruppe_id, aufgabe, geloest, versuche, dauer_sekunden, items, ereignisse, beendet, empfangen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(l.id, g.gruppe_id, l.aufgabe, l.geloest === true ? 1 : 0, versuche, dauer, JSON.stringify([...new Set(items)]), JSON.stringify(ereignisse), l.beendet, jetzt());
        if (r.changes) ergebnis.angenommen.laeufe++;
      }

      for (const t of Array.isArray(k.technik) ? k.technik.slice(0, 200) : []) {
        if (typeof t?.schluessel !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(t.schluessel) || !['offline', 'online'].includes(t.art) || !ISO.test(t.zeit ?? '')) continue;
        ergebnis.angenommen.technik += db.prepare('INSERT OR IGNORE INTO technik (gruppe_id, schluessel, art, zeit) VALUES (?, ?, ?, ?)').run(g.gruppe_id, t.schluessel, t.art, t.zeit).changes;
      }
      db.prepare("INSERT OR IGNORE INTO technik (gruppe_id, schluessel, art, zeit) VALUES (?, ?, 'sync', ?)").run(g.gruppe_id, `sync-${k.schluessel}`, jetzt());

      if (g.rueckmeldung) {
        const erlaubt = { verstaendlich: ['ja', 'teils', 'nein'], spass: ['ja', 'teils', 'nein'], schwierigkeit: ['zu-leicht', 'passend', 'zu-schwer'] };
        for (const r of Array.isArray(k.rueckmeldungen) ? k.rueckmeldungen.slice(0, 50) : []) {
          if (typeof r?.id !== 'string' || !UUID.test(r.id) || !inhalte.aufgabeNach.has(r.aufgabe)) continue;
          const wert = (feld) => (erlaubt[feld].includes(r[feld]) ? r[feld] : null);
          ergebnis.angenommen.rueckmeldungen += db.prepare('INSERT OR IGNORE INTO rueckmeldung (id, freigabe_id, aufgabe, verstaendlich, spass, schwierigkeit, stand, zeit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(r.id, g.freigabe_id, r.aufgabe, wert('verstaendlich'), wert('spass'), wert('schwierigkeit'), cfg.standBezeichnung ?? VERSION, jetzt()).changes;
        }
      }
      db.prepare('UPDATE gruppe SET letzte_sync = ? WHERE id = ?').run(jetzt(), g.gruppe_id);
    });
    if (ergebnis.doppelt) messung.sync.doppelt++; else { messung.sync.angenommen++; messreihe.syncAngenommen(); }
    return ergebnis;
  });

  // Bildbeiträge: Schulgruppen laden mit Gerätetoken hoch (wartet auf Freigabe der Lehrkraft); Familien nur,
  // wenn sie selbst freigegeben haben.
  route('POST', '/api/v1/bildbeitraege', async (req) => {
    const mitToken = /^Bearer /.test(req.headers.authorization ?? '');
    const g = mitToken ? geraet(req) : null;
    if (!g && !familienBremse.erlaubt(absender(req))) throw new HttpFehler(429, 'Gerade zu viele Bilder. Bitte etwas später noch einmal.');
    const k = await koerper(req, 'json', MAX_BILD_KOERPER);
    const m = k.metadaten ?? {};
    if (typeof m.kennung !== 'string' || !UUID.test(m.kennung)) throw new HttpFehler(400, 'metadaten.kennung muss eine UUID sein');
    if (!ISO.test(m.erstellt ?? '')) throw new HttpFehler(400, 'metadaten.erstellt muss ein Zeitpunkt nach ISO 8601 sein');
    if (m.art !== 'item-collage') throw new HttpFehler(400, 'metadaten.art muss "item-collage" sein');
    if (!Array.isArray(m.items) || m.items.length < 1 || m.items.length > 12 || !m.items.every((i) => inhalte.itemIds.has(i))) throw new HttpFehler(400, 'metadaten.items: 1 bis 12 bekannte Sammelstücke');
    if (Object.keys(m).some((f) => !['kennung', 'erstellt', 'art', 'items'].includes(f))) throw new HttpFehler(400, 'metadaten enthält nicht vorgesehene Felder');
    const png = Buffer.from(String(k.png ?? ''), 'base64');
    const vorschau = Buffer.from(String(k.vorschau ?? ''), 'base64');
    const pi = bildInfo(png);
    const vi = bildInfo(vorschau);
    if (pi?.typ !== 'image/png' || pi.breite !== 2048 || pi.hoehe !== 2048) throw new HttpFehler(400, 'png muss ein PNG mit 2048 × 2048 Pixeln sein');
    if (!vi || !['image/webp', 'image/jpeg'].includes(vi.typ) || vi.breite > 512 || vi.hoehe > 512) throw new HttpFehler(400, 'vorschau muss WebP oder JPEG mit höchstens 512 × 512 Pixeln sein');
    if (vorschau.length > 1024 * 1024) throw new HttpFehler(400, 'vorschau zu groß');
    if (!g && k.freigabe !== true) throw new HttpFehler(400, 'Ohne Freigabe wird ein Familienbild nicht übertragen');
    const status = g ? 'wartet' : 'freigegeben';
    if (!g) familienBremse.fehlschlag(absender(req)); // zählt jede Familien-Übertragung, nicht nur Fehler
    const r = db.prepare(`INSERT OR IGNORE INTO bildbeitrag (kennung, gruppe_id, herkunft, art, items, erstellt, status, entschieden, png, png_sha256, vorschau, vorschau_typ, empfangen)
                          VALUES (?, ?, ?, 'item-collage', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(m.kennung, g?.gruppe_id ?? null, g ? 'schule' : 'familie', JSON.stringify(m.items), m.erstellt, status, g ? null : jetzt(), png, createHash('sha256').update(png).digest('hex'), vorschau, vi.typ, jetzt());
    return mit(r.changes ? 201 : 200, { kennung: m.kennung, status, neu: r.changes === 1 });
  });

  // --- Anmeldung -------------------------------------------------------------------------------------------------

  route('GET', '/anmeldung/start', async (req, url) => {
    if (!oidc) return weiter('/lehrkraefte.html#fehler=kein-anmeldedienst');
    const ziel = url.searchParams.get('ziel') === 'lernende' ? 'lernende' : 'lehrkraft';
    try {
      const v = await oidc.beginne();
      const bindung = token(16);
      db.prepare('INSERT INTO anmeldevorgang (zustand_hash, nonce, pruefcode, ziel, ablauf) VALUES (?, ?, ?, ?, ?)')
        .run(hash(`${v.zustand}.${bindung}`), v.nonce, v.pruefcode, ziel, new Date(Date.now() + 10 * 60_000).toISOString());
      return weiter(v.url, { 'Set-Cookie': cookieKopf(bindung, 600, cfg.sichereCookies, 'spur_anmeldung', 'Lax') });
    } catch (e) {
      const art = e instanceof AnmeldeFehler ? e.art : 'unbekannt';
      return weiter(ziel === 'lernende' ? `/#/anmeldung?fehler=${art}` : `/lehrkraefte.html#fehler=${art}`);
    }
  });

  route('GET', '/anmeldung/rueckkehr', async (req, url) => {
    const bindung = leseCookies(req.headers.cookie).spur_anmeldung ?? '';
    const zustand = url.searchParams.get('state') ?? '';
    const v = db.prepare('SELECT * FROM anmeldevorgang WHERE zustand_hash = ? AND ablauf > ?').get(hash(`${zustand}.${bindung}`), jetzt());
    db.prepare('DELETE FROM anmeldevorgang WHERE zustand_hash = ?').run(hash(`${zustand}.${bindung}`));
    const loesche = cookieKopf('', 0, cfg.sichereCookies, 'spur_anmeldung', 'Lax');
    if (!v) return weiter('/lehrkraefte.html#fehler=vorgang', { 'Set-Cookie': loesche });
    try {
      const { sub, rolle } = await oidc.schliesseAb({ code: url.searchParams.get('code') ?? '', nonce: v.nonce, pruefcode: v.pruefcode });
      if (rolle === 'lehrkraft') {
        const id = lehrkraftFuer(hmac(pfeffer, `${cfg.oidc.aussteller}|${sub}`), 'anmeldedienst');
        protokolliere('lehrkraft', 'anmeldung', 'anmeldedienst');
        return weiter('/lehrkraefte.html', { 'Set-Cookie': [loesche, neueSitzung('lehrkraft', id, true)] });
      }
      // Lernende: Sitzung ohne jeden Bezug zur Person; das Pseudonym wird hier verworfen.
      return weiter('/#/beitritt', { 'Set-Cookie': [loesche, neueSitzung('lernende', null, true)] });
    } catch (e) {
      const art = e instanceof AnmeldeFehler ? e.art : 'unbekannt';
      log.warn?.(`Anmeldung fehlgeschlagen: ${art}`);
      return weiter(v.ziel === 'lernende' ? `/#/anmeldung?fehler=${art}` : `/lehrkraefte.html#fehler=${art}`, { 'Set-Cookie': loesche });
    }
  });

  route('POST', '/api/v1/anmeldung/schluessel', async (req) => {
    if (!fehlversuche.erlaubt(absender(req))) throw new HttpFehler(429, 'Zu viele Versuche. Bitte eine Minute warten.');
    const { schluessel } = await koerper(req);
    const z = db.prepare('SELECT id, gesperrt FROM zugangsschluessel WHERE schluessel_hash = ?').get(hash(normalisiereCode(schluessel)));
    if (!z || z.gesperrt) { fehlversuche.fehlschlag(absender(req)); throw new HttpFehler(401, 'Schlüssel unbekannt oder gesperrt'); }
    const id = lehrkraftFuer(hmac(pfeffer, `schluessel|${z.id}`), 'zugangsschluessel');
    protokolliere('lehrkraft', 'anmeldung', 'zugangsschluessel');
    return mit(200, { rolle: 'lehrkraft' }, { 'Set-Cookie': neueSitzung('lehrkraft', id, false, z.id) });
  });

  route('POST', '/api/v1/anmeldung/verwaltung', async (req) => {
    if (!fehlversuche.erlaubt(absender(req))) throw new HttpFehler(429, 'Zu viele Versuche. Bitte eine Minute warten.');
    const { schluessel } = await koerper(req);
    const soll = db.prepare("SELECT wert FROM einstellung WHERE schluessel = 'verwaltung'").get()?.wert;
    if (!soll || !gleich(hash(normalisiereCode(schluessel)), soll)) { fehlversuche.fehlschlag(absender(req)); throw new HttpFehler(401, 'Schlüssel falsch'); }
    protokolliere('verwaltung', 'anmeldung');
    return mit(200, { rolle: 'verwaltung' }, { 'Set-Cookie': neueSitzung('verwaltung') });
  });

  route('POST', '/api/v1/abmeldung', async (req) => {
    const t = leseCookies(req.headers.cookie)[COOKIE];
    const s = sitzung(req);
    if (t) db.prepare('DELETE FROM sitzung WHERE token_hash = ?').run(hash(t));
    const zentral = s?.ueber_anmeldedienst && oidc ? await oidc.abmeldeUrl(`${cfg.oeffentlicheUrl}/${s.rolle === 'lernende' ? '' : 'lehrkraefte.html'}`) : null;
    return mit(200, { abgemeldet: true, weiter: zentral }, { 'Set-Cookie': cookieKopf('', 0, cfg.sichereCookies) });
  });

  // Ohne Sitzung: 200 mit rolle null (die Anmeldeseite fragt das bei jedem Aufruf; kein Fehler im Browserprotokoll)
  route('GET', '/api/v1/ich', (req) => {
    const s = sitzung(req);
    return { rolle: s?.rolle ?? null, ueberAnmeldedienst: !!s?.ueber_anmeldedienst };
  });

  // --- Lehrkräfte ------------------------------------------------------------------------------------------------

  route('GET', '/api/v1/lerngruppen', (req) => {
    const s = lehrkraft(req);
    return db.prepare('SELECT * FROM lerngruppe WHERE lehrkraft_id = ? ORDER BY erstellt DESC').all(s.lehrkraft_id).map((lg) => ({
      id: lg.id, bezeichnung: lg.bezeichnung, klassenstufe: lg.klassenstufe, einwilligungAm: lg.einwilligung_am, erstellt: lg.erstellt, loeschenAm: lg.loeschen_am,
      klassen4bis8: klassen4bis8(lg.klassenstufe), erfassung: erfassungFuer(lg),
      freigaben: db.prepare('SELECT f.id, f.titel, f.zeitrahmen, f.erstellt, f.beendet, f.loeschen_am, f.erfassung, (SELECT count(*) FROM gruppe g WHERE g.freigabe_id = f.id) AS gruppen FROM freigabe f WHERE f.lerngruppe_id = ? ORDER BY f.erstellt DESC').all(lg.id)
        .map((f) => ({ id: f.id, titel: f.titel, zeitrahmen: f.zeitrahmen, erstellt: f.erstellt, beendet: f.beendet, loeschenAm: f.loeschen_am, erfassung: !!f.erfassung, gruppen: f.gruppen })),
    }));
  });

  function pruefeLerngruppe(k) {
    const name = String(k.bezeichnung ?? '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 40 || !/^[\p{L}\p{N} .\-/]+$/u.test(name)) throw new HttpFehler(400, 'Bezeichnung: 2 bis 40 Zeichen, z. B. „Klasse 6a“');
    const stufe = k.klassenstufe === null || k.klassenstufe === undefined || k.klassenstufe === '' ? null : Number(k.klassenstufe);
    if (stufe !== null && (!Number.isInteger(stufe) || stufe < 1 || stufe > 13)) throw new HttpFehler(400, 'Klassenstufe 1 bis 13 oder leer');
    return { name, stufe };
  }

  route('POST', '/api/v1/lerngruppen', async (req) => {
    const s = lehrkraft(req);
    const k = await koerper(req);
    const { name, stufe } = pruefeLerngruppe(k);
    const id = kennung();
    const erstellt = jetzt();
    db.prepare('INSERT INTO lerngruppe (id, lehrkraft_id, bezeichnung, klassenstufe, einwilligung_am, erstellt, loeschen_am) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, s.lehrkraft_id, name, stufe, k.einwilligung === true ? erstellt : null, erstellt, schuljahresende(erstellt));
    protokolliere('lehrkraft', 'lerngruppe-angelegt', id);
    return mit(201, { id });
  });

  route('PATCH', '/api/v1/lerngruppen/([A-Za-z0-9_-]+)', async (req, url, [id]) => {
    const s = lehrkraft(req);
    const lg = eigeneLerngruppe(s, id);
    const k = await koerper(req);
    const { name, stufe } = pruefeLerngruppe({ bezeichnung: k.bezeichnung ?? lg.bezeichnung, klassenstufe: 'klassenstufe' in k ? k.klassenstufe : lg.klassenstufe });
    const einwilligung = 'einwilligung' in k ? (k.einwilligung === true ? (lg.einwilligung_am ?? jetzt()) : null) : lg.einwilligung_am;
    transaktion(db, () => {
      db.prepare('UPDATE lerngruppe SET bezeichnung = ?, klassenstufe = ?, einwilligung_am = ? WHERE id = ?').run(name, stufe, einwilligung, id);
      const e = erfassungFuer({ klassenstufe: stufe, einwilligung_am: einwilligung }).erfassung ? 1 : 0;
      db.prepare('UPDATE freigabe SET erfassung = ? WHERE lerngruppe_id = ? AND beendet IS NULL').run(e, id);
    });
    protokolliere('lehrkraft', 'lerngruppe-geaendert', id);
    return { ok: true, erfassung: erfassungFuer({ klassenstufe: stufe, einwilligung_am: einwilligung }) };
  });

  route('DELETE', '/api/v1/lerngruppen/([A-Za-z0-9_-]+)', (req, url, [id]) => {
    const s = lehrkraft(req);
    eigeneLerngruppe(s, id);
    transaktion(db, () => {
      db.prepare('DELETE FROM lerngruppe WHERE id = ?').run(id);
      db.prepare("DELETE FROM bildbeitrag WHERE gruppe_id IS NULL AND herkunft = 'schule' AND status <> 'freigegeben'").run();
    });
    protokolliere('lehrkraft', 'lerngruppe-geloescht', id);
    return { geloescht: true };
  });

  route('POST', '/api/v1/lerngruppen/([A-Za-z0-9_-]+)/freigaben', async (req, url, [id]) => {
    const s = lehrkraft(req);
    const lg = eigeneLerngruppe(s, id);
    const k = await koerper(req);
    const titel = String(k.titel ?? '').trim();
    if (titel.length < 2 || titel.length > 60) throw new HttpFehler(400, 'Titel der Quest: 2 bis 60 Zeichen');
    const zeitrahmen = ['stunde', 'projekttag', 'ausflug', 'eigen'].includes(k.zeitrahmen) ? k.zeitrahmen : 'eigen';
    const orte = pruefeOrte(k.orte);
    const e = erfassungFuer(lg);
    const fid = kennung();
    const erstellt = jetzt();
    db.prepare('INSERT INTO freigabe (id, lerngruppe_id, titel, zeitrahmen, orte, erfassung, rueckmeldung, inhalt_version, erstellt, loeschen_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(fid, id, titel, zeitrahmen, JSON.stringify(orte), e.erfassung ? 1 : 0, k.rueckmeldung === true ? 1 : 0, inhalte.inhaltVersion, erstellt, loeschtermin({ begonnen: erstellt }, cfg.aufbewahrungWochen));
    protokolliere('lehrkraft', 'quest-freigegeben', fid);
    return mit(201, { id: fid, erfassung: e });
  });

  route('GET', '/api/v1/freigaben/([A-Za-z0-9_-]+)', (req, url, [id]) => {
    const s = lehrkraft(req);
    const f = eigeneFreigabe(s, id);
    const orte = JSON.parse(f.orte);
    const gruppen = db.prepare('SELECT id, bezeichnung, code, erstellt, letzte_sync FROM gruppe WHERE freigabe_id = ? ORDER BY erstellt').all(id).map((g) => {
      const stationen = db.prepare('SELECT ort, status, begonnen, beendet FROM station WHERE gruppe_id = ?').all(g.id);
      const laeufe = db.prepare('SELECT aufgabe FROM lauf WHERE gruppe_id = ?').all(g.id).map((l) => l.aufgabe);
      const aktuell = stationen.filter((x) => x.status === 'begonnen').sort((a, b) => (b.begonnen > a.begonnen ? 1 : -1))[0]?.ort ?? null;
      return {
        id: g.id, bezeichnung: g.bezeichnung, code: g.code, erstellt: g.erstellt, letzteSync: g.letzte_sync, aktuell,
        stationen: orte.map(({ ort, aufgaben }) => {
          const st = stationen.find((x) => x.ort === ort);
          return { ort, status: st?.status ?? 'offen', aufgabenFertig: laeufe.filter((a) => a.startsWith(`${ort}/`) && aufgaben.includes(a.split('/')[1])).length, aufgaben: aufgaben.length };
        }),
      };
    });
    const wartend = db.prepare("SELECT count(*) AS n FROM bildbeitrag b JOIN gruppe g ON g.id = b.gruppe_id WHERE g.freigabe_id = ? AND b.status = 'wartet'").get(id).n;
    return {
      id: f.id, titel: f.titel, zeitrahmen: f.zeitrahmen, lerngruppe: { id: f.lerngruppe_id, bezeichnung: f.lerngruppe, klassenstufe: f.klassenstufe },
      erfassung: !!f.erfassung, rueckmeldung: !!f.rueckmeldung, erstellt: f.erstellt, beendet: f.beendet, loeschenAm: f.loeschen_am,
      orte: questOrte(orte), gruppen, bildbeitraegeWartend: wartend,
    };
  });

  route('POST', '/api/v1/freigaben/([A-Za-z0-9_-]+)/beenden', (req, url, [id]) => {
    const s = lehrkraft(req);
    const f = eigeneFreigabe(s, id);
    const ende = jetzt();
    db.prepare('UPDATE freigabe SET beendet = ?, loeschen_am = ? WHERE id = ?').run(ende, loeschtermin({ abgeschlossen: ende, begonnen: f.erstellt }, cfg.aufbewahrungWochen), id);
    protokolliere('lehrkraft', 'quest-beendet', id);
    return { beendet: ende };
  });

  route('DELETE', '/api/v1/freigaben/([A-Za-z0-9_-]+)', (req, url, [id]) => {
    const s = lehrkraft(req);
    eigeneFreigabe(s, id);
    transaktion(db, () => {
      db.prepare('DELETE FROM freigabe WHERE id = ?').run(id);
      db.prepare("DELETE FROM bildbeitrag WHERE gruppe_id IS NULL AND herkunft = 'schule' AND status <> 'freigegeben'").run();
    });
    protokolliere('lehrkraft', 'quest-geloescht', id);
    return { geloescht: true };
  });

  route('POST', '/api/v1/freigaben/([A-Za-z0-9_-]+)/gruppen', async (req, url, [id]) => {
    const s = lehrkraft(req);
    const f = eigeneFreigabe(s, id);
    if (f.beendet) throw new HttpFehler(409, 'Die Quest ist beendet');
    const k = await koerper(req);
    const p = pruefeBezeichnung(k.bezeichnung);
    if (!p.ok) throw new HttpFehler(400, p.fehler);
    if (p.hinweis && k.bestaetigt !== true) throw new HttpFehler(409, p.hinweis, { hinweis: p.hinweis, bestaetigen: true });
    if (db.prepare('SELECT 1 FROM gruppe WHERE freigabe_id = ? AND lower(bezeichnung) = lower(?)').get(id, p.name)) throw new HttpFehler(409, 'Diese Bezeichnung gibt es in der Quest schon');
    if (db.prepare('SELECT count(*) AS n FROM gruppe WHERE freigabe_id = ?').get(id).n >= 16) throw new HttpFehler(409, 'Höchstens 16 Gruppen je Quest');
    const gid = kennung();
    let c = neuerCode();
    while (db.prepare('SELECT 1 FROM gruppe WHERE code = ?').get(c)) c = neuerCode();
    db.prepare('INSERT INTO gruppe (id, freigabe_id, bezeichnung, code, erstellt) VALUES (?, ?, ?, ?, ?)').run(gid, id, p.name, c, jetzt());
    protokolliere('lehrkraft', 'gruppe-angelegt', gid);
    return mit(201, { id: gid, bezeichnung: p.name, code: c });
  });

  route('PATCH', '/api/v1/gruppen/([A-Za-z0-9_-]+)', async (req, url, [id]) => {
    const s = lehrkraft(req);
    const g = eigeneGruppe(s, id);
    const k = await koerper(req);
    if ('bezeichnung' in k) {
      const p = pruefeBezeichnung(k.bezeichnung);
      if (!p.ok) throw new HttpFehler(400, p.fehler);
      if (p.hinweis && k.bestaetigt !== true) throw new HttpFehler(409, p.hinweis, { hinweis: p.hinweis, bestaetigen: true });
      db.prepare('UPDATE gruppe SET bezeichnung = ? WHERE id = ?').run(p.name, id);
    }
    if ('einschaetzung' in k) {
      const e = {};
      for (const b of BEREICHE) {
        const w = k.einschaetzung?.[b.id];
        if (w !== undefined && w !== null && !STUFEN.some((x) => x.id === w)) throw new HttpFehler(400, `Stufe ${w} unbekannt`);
        if (w) e[b.id] = w;
      }
      db.prepare('UPDATE gruppe SET einschaetzung = ? WHERE id = ?').run(JSON.stringify(e), id);
    }
    protokolliere('lehrkraft', 'gruppe-geaendert', g.id);
    return { ok: true };
  });

  route('DELETE', '/api/v1/gruppen/([A-Za-z0-9_-]+)', (req, url, [id]) => {
    const s = lehrkraft(req);
    eigeneGruppe(s, id);
    transaktion(db, () => {
      db.prepare('DELETE FROM gruppe WHERE id = ?').run(id);
      db.prepare("DELETE FROM bildbeitrag WHERE gruppe_id IS NULL AND herkunft = 'schule' AND status <> 'freigegeben'").run();
    });
    protokolliere('lehrkraft', 'gruppe-geloescht', id);
    return { geloescht: true };
  });

  route('GET', '/api/v1/gruppen/([A-Za-z0-9_-]+)/auswertung', (req, url, [id]) => {
    const s = lehrkraft(req);
    const g = eigeneGruppe(s, id);
    const daten = gruppeDaten(id);
    const einschaetzung = g.einschaetzung ? JSON.parse(g.einschaetzung) : {};
    const raster = kompetenzraster(daten, einschaetzung);
    return {
      gruppe: { id: g.id, bezeichnung: g.bezeichnung }, quest: g.quest, erfassung: !!g.erfassung, loeschenAm: g.loeschen_am,
      beobachtungen: beobachtungen(daten), raster, einschaetzung,
      entwurf: formulierungsentwurf(raster, { gruppe: g.bezeichnung, quest: g.quest, datum: datum(daten.laeufe.at(-1)?.beendet ?? g.erstellt) }),
      stand: daten.laeufe.at(-1)?.beendet ?? null,
    };
  });

  route('GET', '/api/v1/freigaben/([A-Za-z0-9_-]+)/bildbeitraege', (req, url, [id]) => {
    const s = lehrkraft(req);
    eigeneFreigabe(s, id);
    return db.prepare(`SELECT b.kennung, b.erstellt, b.status, b.items, b.entschieden, g.bezeichnung FROM bildbeitrag b JOIN gruppe g ON g.id = b.gruppe_id
                       WHERE g.freigabe_id = ? ORDER BY b.erstellt`).all(id)
      .map((b) => ({ kennung: b.kennung, gruppe: b.bezeichnung, erstellt: b.erstellt, status: b.status, entschieden: b.entschieden, items: JSON.parse(b.items), vorschau: `/api/v1/bildbeitraege/${b.kennung}/vorschau` }));
  });

  route('POST', '/api/v1/bildbeitraege/entscheidung', async (req) => {
    const s = lehrkraft(req);
    const k = await koerper(req);
    if (!Array.isArray(k.kennungen) || !k.kennungen.length || typeof k.freigeben !== 'boolean') throw new HttpFehler(400, 'kennungen (Liste) und freigeben (true/false) erwartet');
    let n = 0;
    transaktion(db, () => {
      for (const kn of k.kennungen.slice(0, 200)) {
        n += db.prepare(`UPDATE bildbeitrag SET status = ?, entschieden = ? WHERE kennung = ? AND gruppe_id IN (
                           SELECT g.id FROM gruppe g JOIN freigabe f ON f.id = g.freigabe_id JOIN lerngruppe l ON l.id = f.lerngruppe_id WHERE l.lehrkraft_id = ?)`)
          .run(k.freigeben ? 'freigegeben' : 'abgelehnt', jetzt(), String(kn), s.lehrkraft_id).changes;
      }
    });
    protokolliere('lehrkraft', k.freigeben ? 'bildbeitraege-freigegeben' : 'bildbeitraege-abgelehnt', String(n));
    return { geaendert: n };
  });

  route('GET', '/api/v1/bildbeitraege/([0-9a-fA-F-]{36})/vorschau', (req, url, [kn]) => {
    const s = lehrkraft(req);
    const b = db.prepare(`SELECT b.vorschau, b.vorschau_typ FROM bildbeitrag b JOIN gruppe g ON g.id = b.gruppe_id JOIN freigabe f ON f.id = g.freigabe_id
                          JOIN lerngruppe l ON l.id = f.lerngruppe_id WHERE b.kennung = ? AND l.lehrkraft_id = ?`).get(kn, s.lehrkraft_id);
    if (!b) throw new HttpFehler(404, 'Bildbeitrag nicht gefunden');
    return datei(b.vorschau, b.vorschau_typ, { 'Cache-Control': 'private, no-store' });
  });

  route('GET', '/api/v1/freigaben/([A-Za-z0-9_-]+)/rueckmeldungen.csv', (req, url, [id]) => {
    const s = lehrkraft(req);
    eigeneFreigabe(s, id);
    const zeilen = db.prepare('SELECT aufgabe, verstaendlich, spass, schwierigkeit, stand, zeit FROM rueckmeldung WHERE freigabe_id = ? ORDER BY zeit').all(id);
    const text = `aufgabe,titel,verstaendlich,spass,schwierigkeit,stand,zeit\n${zeilen.map((z) => [z.aufgabe, `"${(inhalte.aufgabeNach.get(z.aufgabe)?.titel ?? '').replace(/"/g, '""')}"`, z.verstaendlich ?? '', z.spass ?? '', z.schwierigkeit ?? '', `"${(z.stand ?? '').replace(/"/g, '""')}"`, z.zeit].join(',')).join('\n')}\n`;
    return datei(text, 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="rueckmeldungen.csv"' });
  });

  // --- Ausstellung: nur freigegebene Bildbeiträge ------------------------------------------------------------------

  const ausstellungsEintrag = (b) => ({
    kennung: b.kennung, erstellt: b.erstellt, freigegeben: b.entschieden, art: b.art, items: JSON.parse(b.items),
    bild: `/api/v1/ausstellung/bildbeitraege/${b.kennung}/bild.png`, vorschau: `/api/v1/ausstellung/bildbeitraege/${b.kennung}/vorschau`,
    sha256: b.png_sha256,
  });

  route('GET', '/api/v1/ausstellung/bildbeitraege', (req, url) => {
    ausstellung(req);
    const seit = url.searchParams.get('seit');
    const grenze = Math.min(500, Math.max(1, Number(url.searchParams.get('grenze') ?? 100) || 100));
    if (seit && !ISO.test(seit)) throw new HttpFehler(400, 'seit muss ein Zeitpunkt nach ISO 8601 sein');
    const zeilen = db.prepare(`SELECT kennung, erstellt, entschieden, art, items, png_sha256 FROM bildbeitrag WHERE status = 'freigegeben' AND entschieden > ?
                               ORDER BY entschieden, kennung LIMIT ?`).all(seit ? new Date(seit).toISOString() : '', grenze + 1);
    const eintraege = zeilen.slice(0, grenze).map(ausstellungsEintrag);
    return { eintraege, weitere: zeilen.length > grenze, naechsteSeit: eintraege.at(-1)?.freigegeben ?? null };
  });

  route('GET', '/api/v1/ausstellung/bildbeitraege/([0-9a-fA-F-]{36})', (req, url, [kn]) => {
    ausstellung(req);
    const b = db.prepare("SELECT kennung, erstellt, entschieden, art, items, png_sha256 FROM bildbeitrag WHERE kennung = ? AND status = 'freigegeben'").get(kn);
    if (!b) throw new HttpFehler(404, 'Nicht gefunden oder nicht freigegeben');
    return ausstellungsEintrag(b);
  });

  route('GET', '/api/v1/ausstellung/bildbeitraege/([0-9a-fA-F-]{36})/bild.png', (req, url, [kn]) => {
    ausstellung(req);
    const b = db.prepare("SELECT png, png_sha256 FROM bildbeitrag WHERE kennung = ? AND status = 'freigegeben'").get(kn);
    if (!b) throw new HttpFehler(404, 'Nicht gefunden oder nicht freigegeben');
    return datei(b.png, 'image/png', { ETag: `"${b.png_sha256}"`, 'Cache-Control': 'private, max-age=3600' });
  });

  route('GET', '/api/v1/ausstellung/bildbeitraege/([0-9a-fA-F-]{36})/vorschau', (req, url, [kn]) => {
    ausstellung(req);
    const b = db.prepare("SELECT vorschau, vorschau_typ FROM bildbeitrag WHERE kennung = ? AND status = 'freigegeben'").get(kn);
    if (!b) throw new HttpFehler(404, 'Nicht gefunden oder nicht freigegeben');
    return datei(b.vorschau, b.vorschau_typ, { 'Cache-Control': 'private, max-age=3600' });
  });

  route('GET', '/api/v1/ausstellung/archiv.zip', async (req) => {
    ausstellung(req);
    const a = await erstelleArchiv({ db, inhalte: { ...inhalte, quellen: new Map() }, umfang: 'archiv', version: VERSION });
    return datei(a.zip, 'application/zip', { 'Content-Disposition': `attachment; filename="bildbeitraege-${jetzt().slice(0, 10)}.zip"` });
  });

  // --- Verwaltung ------------------------------------------------------------------------------------------------

  route('GET', '/api/v1/verwaltung/uebersicht', async (req) => {
    verwaltung(req);
    const zaehle = (t, w = '') => db.prepare(`SELECT count(*) AS n FROM ${t} ${w}`).get().n;
    let dbGroesse = null;
    try { dbGroesse = (await stat(cfg.datenbank)).size; } catch { /* im Speicher */ }
    return {
      version: VERSION, schema: SCHEMA_VERSION, inhaltVersion: inhalte.inhaltVersion, inhaltFehler: inhalte.fehler,
      laufzeitSekunden: Math.round((Date.now() - messung.start) / 1000), datenbankBytes: dbGroesse,
      offline: { gesamtBytes: inhalte.offlineListe.gesamtBytes, jeOrtBytes: inhalte.offlineListe.jeOrtBytes, dateien: inhalte.offlineListe.dateien.length },
      anzahl: {
        lehrkraefte: zaehle('lehrkraft'), lerngruppen: zaehle('lerngruppe'), quests: zaehle('freigabe'), gruppen: zaehle('gruppe'), laeufe: zaehle('lauf'),
        bildbeitraegeWartend: zaehle('bildbeitrag', "WHERE status = 'wartet'"), bildbeitraegeFreigegeben: zaehle('bildbeitrag', "WHERE status = 'freigegeben'"),
      },
      letzteSicherung: db.prepare("SELECT wert FROM einstellung WHERE schluessel = 'letzte_sicherung'").get()?.wert ?? null,
      anmeldung: { anmeldedienst: !!oidc, attrappe: !!attrappe, aussteller: cfg.oidc?.aussteller ?? null },
    };
  });

  route('GET', '/api/v1/verwaltung/zugangsschluessel', (req) => {
    verwaltung(req);
    return db.prepare('SELECT id, bezeichnung, gesperrt, erstellt FROM zugangsschluessel ORDER BY erstellt DESC').all().map((z) => ({ ...z, gesperrt: !!z.gesperrt }));
  });

  route('POST', '/api/v1/verwaltung/zugangsschluessel', async (req) => {
    verwaltung(req);
    const k = await koerper(req);
    const b = String(k.bezeichnung ?? '').trim();
    if (b.length < 2 || b.length > 60) throw new HttpFehler(400, 'Bezeichnung 2 bis 60 Zeichen, z. B. „Pilotschule 1, Lehrkraft 3“');
    const s = neuerCode(12);
    const r = db.prepare('INSERT INTO zugangsschluessel (bezeichnung, schluessel_hash, erstellt) VALUES (?, ?, ?)').run(b, hash(normalisiereCode(s)), jetzt());
    protokolliere('verwaltung', 'zugangsschluessel-angelegt', String(r.lastInsertRowid));
    return mit(201, { id: Number(r.lastInsertRowid), schluessel: s, hinweis: 'Nur jetzt sichtbar. Bitte sicher weitergeben.' });
  });

  route('PATCH', '/api/v1/verwaltung/zugangsschluessel/(\\d+)', async (req, url, [id]) => {
    verwaltung(req);
    const k = await koerper(req);
    db.prepare('UPDATE zugangsschluessel SET gesperrt = ? WHERE id = ?').run(k.gesperrt ? 1 : 0, Number(id));
    if (k.gesperrt) db.prepare('DELETE FROM sitzung WHERE zugang_id = ?').run(Number(id)); // gesperrt: sofort abgemeldet
    protokolliere('verwaltung', k.gesperrt ? 'zugangsschluessel-gesperrt' : 'zugangsschluessel-entsperrt', id);
    return { ok: true };
  });

  route('GET', '/api/v1/verwaltung/archiv.zip', async (req, url) => {
    verwaltung(req);
    const umfang = url.searchParams.get('umfang') === 'vollstaendig' ? 'vollstaendig' : 'archiv';
    const a = await erstelleArchiv({ db, inhalte, umfang, version: VERSION, einstellungen: { aufbewahrungWochen: cfg.aufbewahrungWochen, lernendeAnmeldung: cfg.lernendeAnmeldung } });
    protokolliere('verwaltung', `export-${umfang}`, String(a.dateien));
    return datei(a.zip, 'application/zip', { 'Content-Disposition': `attachment; filename="spurensuche-${umfang}-${jetzt().slice(0, 10)}.zip"` });
  });

  route('GET', '/api/v1/verwaltung/protokoll', (req) => {
    verwaltung(req);
    return db.prepare('SELECT zeit, rolle, aktion, ziel FROM protokoll ORDER BY id DESC LIMIT 500').all();
  });

  route('POST', '/api/v1/verwaltung/inhalte-neu-laden', async (req) => {
    verwaltung(req);
    inhalte = await ladeInhalte({ appWurzel: cfg.appWurzel, inhaltsWurzel: cfg.inhaltsWurzel, datenWurzel });
    dateiCache.clear();
    protokolliere('verwaltung', 'inhalte-neu-geladen', inhalte.inhaltVersion);
    return { inhaltVersion: inhalte.inhaltVersion, fehler: inhalte.fehler };
  });

  // Messwerte für das Monitoring (Prometheus-Textformat), ohne personenbezogene Daten
  route('GET', '/api/v1/betrieb/messwerte', (req) => {
    const t = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!cfg.messwerteToken || !t || !gleich(t, cfg.messwerteToken)) throw new HttpFehler(401, 'Messwerte nur mit Schlüssel');
    const zeilen = ['# TYPE spur_anfragen_gesamt counter'];
    for (const [k, n] of messung.anfragen) { const [klasse, status] = k.split('|'); zeilen.push(`spur_anfragen_gesamt{route="${klasse}",status="${status}"} ${n}`); }
    zeilen.push('# TYPE spur_antwortzeit_ms histogram');
    let summe = 0;
    messung.grenzen.forEach((g, i) => { summe += messung.dauer[i]; zeilen.push(`spur_antwortzeit_ms_bucket{le="${g === Infinity ? '+Inf' : g}"} ${summe}`); });
    zeilen.push(`spur_sync_angenommen_gesamt ${messung.sync.angenommen}`, `spur_sync_doppelt_gesamt ${messung.sync.doppelt}`);
    zeilen.push(`spur_laufzeit_sekunden ${Math.round((Date.now() - messung.start) / 1000)}`);
    zeilen.push(`spur_gruppen_aktiv ${db.prepare("SELECT count(*) AS n FROM gruppe WHERE letzte_sync > ?").get(new Date(Date.now() - 15 * 60_000).toISOString()).n}`);
    return datei(zeilen.join('\n') + '\n', 'text/plain; version=0.0.4; charset=utf-8');
  });

  // --- Statische Dateien ---------------------------------------------------------------------------------------------

  function konfiguration() {
    return { modus: 'server', version: VERSION, inhaltVersion: inhalte.inhaltVersion, stand: cfg.standBezeichnung ?? null, anmeldung: { anmeldedienst: !!oidc, zugangsschluessel: true, attrappe: !!attrappe }, lernendeAnmeldung: cfg.lernendeAnmeldung };
  }

  async function statisch(req, pfad) {
    let quelle = null;
    if (SEITEN[pfad]) quelle = resolve(cfg.appWurzel, 'app', SEITEN[pfad]);
    else if (pfad === '/werkstatt.html' && cfg.werkstatt) quelle = resolve(cfg.appWurzel, 'app', 'werkstatt.html');
    else if (pfad === '/sw.js') quelle = resolve(cfg.appWurzel, 'app', 'sw.js');
    else if (pfad === '/manifest.webmanifest') quelle = resolve(cfg.appWurzel, 'app', 'manifest.webmanifest');
    else if (pfad === '/konfiguration.json') return datei(JSON.stringify(konfiguration()), TYPEN['.json'], { 'Cache-Control': 'no-cache' });
    else if (pfad === '/offline-liste.json') return datei(JSON.stringify(inhalte.offlineListe), TYPEN['.json'], { 'Cache-Control': 'no-cache' });
    else {
      const rel = decodeURIComponent(pfad).replace(/^\/+/, '');
      if (rel.split('/').some((teil) => teil.startsWith('.') || teil === '')) return null;
      let wurzel = null;
      if (/^app\//.test(rel)) wurzel = cfg.appWurzel;
      else if (/^spiele\//.test(rel)) wurzel = cfg.inhaltsWurzel;
      else if (/^(inhalte|assets\/spiele)\//.test(rel)) wurzel = datenWurzel;
      if (!wurzel) return null;
      const voll = resolve(wurzel, rel);
      if (relative(wurzel, voll).startsWith('..')) return null;
      quelle = voll;
    }
    let s;
    try { s = await stat(quelle); } catch {
      // ohne eigene Vorschläge je Zeitrahmen: leere Liste statt 404 (die Lehrkraft wählt dann Orte selbst)
      if (pfad === '/inhalte/ablaeufe.json') return datei(JSON.stringify({ ablaeufe: [] }), TYPEN['.json'], { 'Cache-Control': 'no-cache' });
      return null;
    }
    if (!s.isFile()) return null;
    const schluessel = `${quelle}:${s.mtimeMs}:${s.size}`;
    let eintrag = dateiCache.get(quelle);
    if (!eintrag || eintrag.schluessel !== schluessel) {
      const inhalt = await readFile(quelle);
      const typ = TYPEN[extname(quelle).toLowerCase()] ?? 'application/octet-stream';
      eintrag = { schluessel, inhalt, typ, etag: `"${createHash('sha1').update(inhalt).digest('hex')}"`, gzip: TEXT.test(typ) && inhalt.length > 1024 ? gzipSync(inhalt) : null };
      if (dateiCache.size > 2000) dateiCache.clear();
      dateiCache.set(quelle, eintrag);
    }
    const extra = { ETag: eintrag.etag, 'Cache-Control': 'no-cache' };
    if (eintrag.typ === 'image/svg+xml') extra['Content-Security-Policy'] = SVG_RICHTLINIE;
    if (pfad === '/sw.js') extra['Service-Worker-Allowed'] = '/';
    if (req.headers['if-none-match'] === eintrag.etag) return new Antwort(304, null, extra, '');
    if (eintrag.gzip && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) return new Antwort(200, null, { 'Content-Type': eintrag.typ, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', ...extra }, eintrag.gzip);
    return new Antwort(200, null, { 'Content-Type': eintrag.typ, ...extra }, eintrag.inhalt);
  }

  // --- Verteiler -----------------------------------------------------------------------------------------------------

  function sende(res, a) {
    const basis = { ...kopf, ...a.kopf };
    if (a.roh !== null) {
      res.writeHead(a.status, basis);
      res.end(a.roh);
      return;
    }
    const text = JSON.stringify(a.daten);
    res.writeHead(a.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...basis });
    res.end(text);
  }

  const klasseVon = (pfad) => pfad.replace(/\/[0-9a-fA-F-]{36}/g, '/:kennung').replace(/\/(lerngruppen|freigaben|gruppen|zugangsschluessel)\/[A-Za-z0-9_-]+/g, '/$1/:id').replace(/^\/(app|spiele|inhalte|assets)\/.*/, '/$1/*');

  async function bearbeite(req, res) {
    const beginn = performance.now();
    let status = 500;
    let pfad = '/';
    try {
      const url = new URL(req.url, 'http://lokal');
      pfad = url.pathname;
      if (attrappe && pfad.startsWith('/attrappe')) {
        await attrappe.bearbeite(req, res, url, koerper);
        status = res.statusCode;
        return;
      }
      let antwort = null;
      for (const r of routen) {
        const m = r.muster.exec(pfad);
        if (!m) continue;
        if (r.methode !== req.method) { antwort = antwort ?? mit(405, { fehler: 'Methode nicht erlaubt' }); continue; }
        const ergebnis = await r.fn(req, url, m.slice(1));
        antwort = ergebnis instanceof Antwort ? ergebnis : mit(200, ergebnis);
        break;
      }
      if (!antwort && (req.method === 'GET' || req.method === 'HEAD')) antwort = await statisch(req, pfad);
      if (!antwort) antwort = mit(404, { fehler: 'Nicht gefunden' });
      status = antwort.status;
      sende(res, antwort);
    } catch (e) {
      if (e instanceof HttpFehler) {
        status = e.status;
        sende(res, mit(e.status, { fehler: e.message, ...e.daten }));
      } else {
        status = 500;
        log.error?.(`Fehler bei ${req.method} ${klasseVon(pfad)}: ${e.stack ?? e}`);
        if (!res.headersSent) sende(res, mit(500, { fehler: 'Interner Fehler' }));
        else res.end();
      }
    } finally {
      const ms = performance.now() - beginn;
      const k = `${klasseVon(pfad)}|${status}`;
      messung.anfragen.set(k, (messung.anfragen.get(k) ?? 0) + 1);
      messung.dauer[messung.grenzen.findIndex((g) => ms <= g)]++;
      messreihe.zaehle(status, ms);
      if (cfg.protokollAufrufe) log.info?.(JSON.stringify({ zeit: jetzt(), methode: req.method, route: klasseVon(pfad), status, ms: Math.round(ms) }));
    }
  }

  const server = createServer({ keepAliveTimeout: 65_000, requestTimeout: 60_000 }, bearbeite);
  server.headersTimeout = 66_000;

  return {
    server, db,
    get inhalte() { return inhalte; },
    aufraeumen,
    async notiereSicherung(zeit) { db.prepare("INSERT INTO einstellung (schluessel, wert) VALUES ('letzte_sicherung', ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert").run(zeit); },
    schliesse() { clearInterval(zeitgeber); betriebTeil.schliesse(); server.close(); db.close(); },
  };
}
