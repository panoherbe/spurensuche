// Betrieb: Statusseite mit Ampel und Verlauf, dazu wenige sichere Knöpfe für Menschen ohne Entwicklerwissen
// (docs/BETRIEBSHANDBUCH.md): Neustart, Sicherung anlegen und zurückspielen, Inhalt tauschen, letzte Version
// zurückspielen. Jeder Punkt der Ampel sagt in einem Satz, was los ist und was zu tun ist. Jede Aktion ist
// umkehrbar: vor dem Zurückspielen wird der jetzige Stand gesichert, ein Inhaltspaket wird vor dem Aktivieren
// geprüft und der vorherige Inhalt bleibt, eine Version geht nur auf die vorher installierte zurück.
//
// Versionen tauscht nicht die Anwendung selbst (sie hat keinen Zugriff auf Docker), sondern der Betriebsdienst am
// Server (betrieb/spur wache): Er fragt alle zehn Sekunden über 127.0.0.1 nach Aufträgen und führt nur fest
// eingebaute Aktionen aus.

import { statfs, readFile, stat, rm } from 'node:fs/promises';
import { connect as tlsVerbindung } from 'node:tls';
import { totalmem } from 'node:os';
import { join, dirname } from 'node:path';
import { sichere, listeSicherungen, bereiteZurueckspielenVor, SICHERUNG_NAME } from './sicherung.js';
import { liesZip, ordneDateien, legeAb, schreibeBeschreibung, liesBeschreibung, entferne, liesAktiv, setzeAktiv, listePakete, raeumeAuf as raeumePaketeAuf, paketWurzel, PaketFehler, PAKET_ID, MITGELIEFERT } from './inhaltspaket.js';
import { ladeInhalte } from './inhalte.js';

const RANG = { gut: 0, info: 0, achtung: 1, stoerung: 2 };
const MB = 1048576;
const GB = 1024 * MB;

/** Zählt Anfragen je Minute (Anzahl, Fehler, Antwortzeiten als Histogramm) für Ampel und Verlauf. */
export class Messreihe {
  constructor(grenzen = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, Infinity]) {
    this.grenzen = grenzen;
    this.minuten = new Map();
    this.cpu = process.cpuUsage();
    this.cpuZeit = performance.now();
    this.geschrieben = null;
  }

  minute(t = Date.now()) {
    const k = Math.floor(t / 60_000);
    let m = this.minuten.get(k);
    if (!m) {
      m = { anfragen: 0, fehler: 0, sync: 0, hist: this.grenzen.map(() => 0) };
      this.minuten.set(k, m);
      for (const alt of this.minuten.keys()) if (alt < k - 90) this.minuten.delete(alt);
    }
    return m;
  }

  zaehle(status, ms, t = Date.now()) {
    const m = this.minute(t);
    m.anfragen++;
    if (status >= 500) m.fehler++;
    m.hist[this.grenzen.findIndex((g) => ms <= g)]++;
  }

  syncAngenommen(n = 1) { this.minute().sync += n; }

  /** Summe über die Minuten [von, bis] (Minutenzähler seit 1970). */
  summe(von, bis) {
    const s = { anfragen: 0, fehler: 0, sync: 0, hist: this.grenzen.map(() => 0) };
    for (let k = von; k <= bis; k++) {
      const m = this.minuten.get(k);
      if (!m) continue;
      s.anfragen += m.anfragen; s.fehler += m.fehler; s.sync += m.sync;
      m.hist.forEach((n, i) => { s.hist[i] += n; });
    }
    return { ...s, p95: this.p95(s.hist) };
  }

  /** Die letzten `n` Minuten einschließlich der laufenden. */
  letzte(n, t = Date.now()) {
    const k = Math.floor(t / 60_000);
    return this.summe(k - n + 1, k);
  }

  /** Obere Grenze der Klasse, in der 95 % der Antworten liegen (null: keine Anfragen, Infinity: über 2,5 s). */
  p95(hist) {
    const gesamt = hist.reduce((a, b) => a + b, 0);
    if (!gesamt) return null;
    let summe = 0;
    for (let i = 0; i < hist.length; i++) { summe += hist[i]; if (summe >= Math.ceil(gesamt * 0.95)) return this.grenzen[i]; }
    return Infinity;
  }

  /** CPU-Anteil des Prozesses seit dem letzten Aufruf in Prozent eines Kerns. */
  cpuProzent() {
    const verbraucht = process.cpuUsage(this.cpu);
    const t = performance.now();
    const p = ((verbraucht.user + verbraucht.system) / 1000) / Math.max(1, t - this.cpuZeit) * 100;
    this.cpu = process.cpuUsage();
    this.cpuZeit = t;
    return Math.round(p);
  }

  /** Schreibt jedes abgeschlossene Fünf-Minuten-Fenster einmal in die Tabelle messreihe (nach einem Neustart addiert). */
  schreibe(db, { gruppenAktiv }, t = Date.now()) {
    const fenster = Math.floor(t / 300_000) - 1;
    if (this.geschrieben === fenster) return;
    const s = this.summe(fenster * 5, fenster * 5 + 4);
    db.prepare(`INSERT INTO messreihe (zeit, anfragen, fehler, p95_ms, sync, gruppen_aktiv, speicher_mb, cpu_prozent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(zeit) DO UPDATE SET anfragen = messreihe.anfragen + excluded.anfragen, fehler = messreihe.fehler + excluded.fehler,
                p95_ms = max(coalesce(messreihe.p95_ms, 0), coalesce(excluded.p95_ms, 0)), sync = messreihe.sync + excluded.sync,
                gruppen_aktiv = excluded.gruppen_aktiv, speicher_mb = excluded.speicher_mb, cpu_prozent = excluded.cpu_prozent`)
      .run(new Date(fenster * 300_000).toISOString(), s.anfragen, s.fehler, s.p95 === null ? null : s.p95 === Infinity ? 9999 : s.p95, s.sync, gruppenAktiv(),
        Math.round(process.memoryUsage.rss() / MB), this.cpuProzent());
    this.geschrieben = fenster;
  }
}

// --- Texte -----------------------------------------------------------------------------------------------------------

const zahl = (n, d = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const groesse = (b) => (b >= GB ? `${zahl(b / GB, 1)} GB` : b >= MB ? `${zahl(b / MB, 1)} MB` : `${zahl(Math.max(1, Math.round(b / 1024)))} KB`);
export function dauer(sekunden) {
  const s = Math.max(0, Math.round(sekunden));
  if (s < 90) return `${s} Sekunden`;
  if (s < 5400) return `${Math.round(s / 60)} Minuten`;
  if (s < 2 * 86400) return `${Math.round(s / 3600)} Stunden`;
  return `${Math.round(s / 86400)} Tagen`;
}
const uhrzeit = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const datumText = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const punkt = (id, titel, stufe, wert, text, tun = null) => ({ id, titel, stufe, wert, text, tun });
const ARTEN_TEXT = { hand: 'von Hand angelegt', 'vor-zurueckspielen': 'vor dem Zurückspielen', 'vor-aktualisierung': 'vor einer neuen Version' };
/** „Sicherung vom 15.11.2026, 04:12 Uhr (von Hand angelegt)“ aus dem Dateinamen (Zeit des Servers). */
function sicherungsName(datei) {
  const m = SICHERUNG_NAME.exec(String(datei ?? ''));
  if (!m) return String(datei ?? '');
  const [, d, t, art] = m;
  return `Sicherung vom ${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}, ${t.slice(0, 2)}:${t.slice(2, 4)} Uhr${art ? ` (${ARTEN_TEXT[art] ?? art})` : ''}`;
}

/** Arbeitsspeicher: Grenze des Containers (cgroup v2 oder v1), sonst der ganze Rechner. */
async function speicherGrenze(gesamt) {
  for (const datei of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const w = (await readFile(datei, 'utf8')).trim();
      const n = Number(w);
      if (w !== 'max' && Number.isFinite(n) && n > 0 && n < gesamt) return n;
    } catch { /* nicht vorhanden */ }
  }
  return gesamt;
}

/**
 * Registriert Anmeldung, Statusseite und Knöpfe des Betriebs. `k` bringt die Bausteine aus server/app.js mit.
 * Liefert Funktionen für app.js (öffentlicher Zustand, Aufräumen der Zeitgeber).
 */
export function registriereBetrieb(k) {
  const { route, db, cfg, log, jetzt, protokolliere, koerper, koerperRoh, sitzung, HttpFehler, mit, datei, VERSION, SCHEMA_VERSION, messreihe, gestartet, datenOrdner } = k;
  const extern = { anmeldedienst: null, zertifikat: null, datenbank: null };
  let agent = null;
  try { agent = JSON.parse(db.prepare("SELECT wert FROM einstellung WHERE schluessel = 'agent'").get()?.wert ?? 'null'); } catch { agent = null; }
  if (agent) agent.ausAltemStart = true;
  if (!db.prepare("SELECT 1 FROM einstellung WHERE schluessel = 'erster_start'").get()) {
    db.prepare("INSERT INTO einstellung (schluessel, wert) VALUES ('erster_start', ?)").run(jetzt());
  }
  const einstellung = (s) => db.prepare('SELECT wert FROM einstellung WHERE schluessel = ?').get(s)?.wert ?? null;
  const setzeEinstellung = (s, w) => db.prepare('INSERT INTO einstellung (schluessel, wert) VALUES (?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert').run(s, w);
  const sicherungsOrdner = cfg.sicherung?.ordner ?? join(datenOrdner, 'sicherungen');

  function betrieb(req) {
    const s = sitzung(req);
    if (!s || s.rolle !== 'betrieb') throw new HttpFehler(401, 'Bitte mit dem Betriebsschlüssel anmelden');
    return s;
  }
  const bestaetigt = (b) => { if (b?.bestaetigt !== true) throw new HttpFehler(400, 'Bitte die Aktion bestätigen'); };
  const nachKurzemNeustart = (grund) => { if (cfg.imContainer && cfg.beende) setTimeout(() => cfg.beende(grund), 300); };

  // --- Prüfungen im Hintergrund (das Ergebnis liest die Statusseite, keine Anfrage wartet darauf) -------------------

  function pruefeDatenbank() {
    try {
      const r = Object.values(db.prepare('PRAGMA quick_check').get())[0];
      extern.datenbank = { ok: r === 'ok', meldung: r, zeit: jetzt() };
    } catch (e) { extern.datenbank = { ok: false, meldung: e.message, zeit: jetzt() }; }
  }

  async function pruefeAnmeldedienst() {
    if (!cfg.oidc?.aussteller || cfg.attrappe) return;
    const basis = String(cfg.oidc.intern ?? cfg.oidc.aussteller).replace(/\/+$/, '');
    try {
      const r = await fetch(`${basis}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5000) });
      extern.anmeldedienst = { ok: r.ok, meldung: r.ok ? null : `antwortet mit Fehler ${r.status}`, zeit: jetzt() };
    } catch (e) {
      extern.anmeldedienst = { ok: false, meldung: e?.name === 'TimeoutError' ? 'antwortet nicht (Zeitüberschreitung)' : 'nicht erreichbar', zeit: jetzt() };
    }
  }

  function pruefeZertifikat() {
    let u;
    try { u = new URL(cfg.oeffentlicheUrl); } catch { return Promise.resolve(); }
    if (u.protocol !== 'https:') return Promise.resolve();
    return new Promise((fertig) => {
      const ende = (w) => { extern.zertifikat = { ...w, zeit: jetzt() }; fertig(); };
      const s = tlsVerbindung({ host: u.hostname, port: Number(u.port || 443), servername: u.hostname, rejectUnauthorized: false, timeout: 5000 }, () => {
        const c = s.getPeerCertificate();
        ende({ gueltigBis: c?.valid_to ? new Date(c.valid_to).toISOString() : null, gueltig: s.authorized, problem: s.authorized ? null : String(s.authorizationError ?? 'ungültig') });
        s.end();
      });
      s.on('timeout', () => { s.destroy(); ende({ nichtPruefbar: 'Zeitüberschreitung' }); });
      s.on('error', (e) => ende({ nichtPruefbar: e.code ?? 'nicht erreichbar' }));
    });
  }

  const zeitgeber = [];
  const alle = (ms, fn) => { const t = setInterval(() => { Promise.resolve().then(fn).catch((e) => log.warn?.(`Betrieb: ${e.message}`)); }, ms); t.unref(); zeitgeber.push(t); };
  pruefeDatenbank();
  const erst = setTimeout(() => { pruefeAnmeldedienst(); pruefeZertifikat(); }, 2000);
  erst.unref();
  zeitgeber.push(erst);
  alle(10 * 60_000, pruefeDatenbank);
  alle(5 * 60_000, pruefeAnmeldedienst);
  alle(6 * 3600_000, pruefeZertifikat);
  const gruppenAktiv = () => db.prepare('SELECT count(*) AS n FROM gruppe WHERE letzte_sync > ?').get(new Date(Date.now() - 15 * 60_000).toISOString()).n;
  alle(60_000, () => messreihe.schreibe(db, { gruppenAktiv }));

  // --- Ampel -----------------------------------------------------------------------------------------------------

  async function zustand() {
    const inhalte = k.inhalte.holen();
    const jetztMs = Date.now();
    const laufzeit = (jetztMs - gestartet) / 1000;
    const punkte = [];

    punkte.push(punkt('anwendung', 'Anwendung', 'gut', `Version ${cfg.versionBild ?? VERSION}, läuft seit ${dauer(laufzeit)}`, 'Die Anwendung antwortet.'));

    let dbBytes = 0;
    for (const endung of ['', '-wal']) { try { dbBytes += (await stat(`${cfg.datenbank}${endung}`)).size; } catch { /* im Speicher oder ohne WAL */ } }
    const zurueck = (() => { try { return JSON.parse(einstellung('zurueckgespielt') ?? 'null'); } catch { return null; } })();
    const zurueckText = zurueck && !zurueck.fehler ? ` Zuletzt zurückgespielt am ${datumText(zurueck.zeit)} um ${uhrzeit(zurueck.zeit)} Uhr: ${sicherungsName(zurueck.datei)}.` : '';
    if (extern.datenbank && !extern.datenbank.ok) {
      punkte.push(punkt('datenbank', 'Datenbank', 'stoerung', groesse(dbBytes), `Die Prüfung der Datenbank meldet einen Fehler (${extern.datenbank.meldung}).`, 'Die letzte Sicherung zurückspielen (Knopf unten). Danach die Entwicklung informieren.'));
    } else if (zurueck?.fehler) {
      punkte.push(punkt('datenbank', 'Datenbank', 'achtung', groesse(dbBytes), `Das Zurückspielen von ${zurueck.datei} ist fehlgeschlagen (${zurueck.fehler}); der vorherige Stand läuft weiter.`, 'Eine andere Sicherung wählen oder die Entwicklung informieren.'));
    } else {
      punkte.push(punkt('datenbank', 'Datenbank', 'gut', groesse(dbBytes), `Die Datenbank ist in Ordnung (Prüfung alle 10 Minuten).${zurueckText}`));
    }

    const sicherungen = await listeSicherungen(sicherungsOrdner);
    const zuletzt = [einstellung('letzte_sicherung'), sicherungen[0]?.zeit].filter(Boolean).sort().pop() ?? null;
    const alter = zuletzt ? (jetztMs - Date.parse(zuletzt)) / 1000 : null;
    const instanzAlter = (jetztMs - Date.parse(einstellung('erster_start') ?? jetzt())) / 1000;
    const anzahl = `${sicherungen.length} ${sicherungen.length === 1 ? 'Sicherung' : 'Sicherungen'} vorhanden`;
    if (!cfg.sicherung?.schluessel) {
      punkte.push(punkt('sicherung', 'Sicherung', 'stoerung', 'nicht eingerichtet', 'Ohne Sicherungsschlüssel wird nicht gesichert.', 'Die Entwicklung informieren: In der Einstellungsdatei fehlt SPUR_SICHERUNG_SCHLUESSEL.'));
    } else if (alter === null) {
      punkte.push(instanzAlter < 26 * 3600
        ? punkt('sicherung', 'Sicherung', 'info', 'noch keine', 'Die erste Sicherung entsteht beim Start des Sicherungsdienstes und danach jede Nacht um 2 Uhr.', 'Wer nicht warten will: Knopf „Sicherung jetzt anlegen“.')
        : punkt('sicherung', 'Sicherung', 'stoerung', 'keine', 'Es gibt keine Sicherung.', 'Knopf „Sicherung jetzt anlegen“ drücken und die Entwicklung informieren: Der nächtliche Sicherungsdienst läuft nicht.'));
    } else if (alter < 26 * 3600) {
      punkte.push(punkt('sicherung', 'Sicherung', 'gut', `vor ${dauer(alter)}, ${anzahl}`, 'Die Datenbank wird jede Nacht verschlüsselt gesichert.'));
    } else {
      punkte.push(punkt('sicherung', 'Sicherung', alter < 50 * 3600 ? 'achtung' : 'stoerung', `vor ${dauer(alter)}, ${anzahl}`, 'Die nächtliche Sicherung fehlt.',
        alter < 50 * 3600 ? 'Knopf „Sicherung jetzt anlegen“ drücken. Ist es morgen wieder gelb: Entwicklung informieren.' : 'Knopf „Sicherung jetzt anlegen“ drücken und die Entwicklung informieren: Der nächtliche Sicherungsdienst läuft nicht.'));
    }

    try {
      const f = await statfs(datenOrdner);
      const frei = f.bavail * f.bsize;
      const gesamt = f.blocks * f.bsize;
      const anteil = gesamt ? frei / gesamt : 0;
      const stufe = anteil >= 0.15 && frei >= 2 * GB ? 'gut' : anteil >= 0.05 && frei >= 0.5 * GB ? 'achtung' : 'stoerung';
      punkte.push(punkt('speicherplatz', 'Speicherplatz', stufe, `${groesse(frei)} frei von ${groesse(gesamt)}`, 'Platz für Datenbank, Sicherungen und Inhaltspakete.',
        stufe === 'gut' ? null : stufe === 'achtung' ? 'Die Entwicklung informieren, damit Platz geschaffen wird. Bis dahin läuft alles weiter.' : 'Sofort die Entwicklung informieren: Ist die Platte voll, können keine Ergebnisse mehr gespeichert werden.'));
    } catch {
      punkte.push(punkt('speicherplatz', 'Speicherplatz', 'info', 'nicht messbar', 'Der freie Platz lässt sich hier nicht messen.'));
    }

    const v = messreihe.letzte(15);
    if (v.anfragen < 20) {
      punkte.push(punkt('fehler', 'Fehler in den letzten 15 Minuten', 'gut', `${v.fehler} von ${v.anfragen} Anfragen`, 'Wenig Betrieb; jeder Fehler würde hier gezählt.'));
      punkte.push(punkt('antwortzeit', 'Antwortzeit', 'gut', v.p95 === null ? 'keine Anfragen' : `95 von 100 Antworten in höchstens ${zahl(v.p95)} ms`, 'Wenig Betrieb in den letzten 15 Minuten.'));
    } else {
      const quote = v.fehler / v.anfragen;
      const fs = v.fehler === 0 || quote < 0.005 ? 'gut' : quote < 0.05 ? 'achtung' : 'stoerung';
      punkte.push(punkt('fehler', 'Fehler in den letzten 15 Minuten', fs, `${v.fehler} von ${zahl(v.anfragen)} Anfragen (${zahl(quote * 100, 1)} %)`, 'Anfragen, bei denen in der Anwendung ein Fehler auftrat.',
        fs === 'gut' ? null : 'Neu starten (Knopf unten). Bleibt es danach gelb oder rot: Entwicklung informieren.'));
      const as = v.p95 <= 250 ? 'gut' : v.p95 <= 1000 ? 'achtung' : 'stoerung';
      punkte.push(punkt('antwortzeit', 'Antwortzeit', as, v.p95 === Infinity ? '95 von 100 Antworten in mehr als 2,5 Sekunden' : `95 von 100 Antworten in höchstens ${zahl(v.p95)} ms`, 'So lange warten Nutzende höchstens auf eine Antwort.',
        as === 'gut' ? null : as === 'achtung' ? 'Beobachten. Bleibt es länger als eine Stunde gelb: Entwicklung informieren.' : 'Neu starten. Hilft das nicht: Entwicklung informieren.'));
    }

    const rss = process.memoryUsage.rss();
    const grenze = await speicherGrenze(totalmem());
    const ms = rss / grenze <= 0.7 ? 'gut' : rss / grenze <= 0.9 ? 'achtung' : 'stoerung';
    punkte.push(punkt('arbeitsspeicher', 'Arbeitsspeicher', ms, `${groesse(rss)} von ${groesse(grenze)}`, 'Speicher, den die Anwendung gerade belegt.',
      ms === 'gut' ? null : ms === 'achtung' ? 'In einer ruhigen Zeit neu starten, zum Beispiel am Abend.' : 'Neu starten (Knopf unten).'));

    if (cfg.attrappe) punkte.push(punkt('anmeldedienst', 'Anmeldung über das Schulkonto', 'info', 'Attrappe', 'Nur für Test und Vorführung: Anmeldung mit Testkonten.'));
    else if (!cfg.oidc?.aussteller) punkte.push(punkt('anmeldedienst', 'Anmeldung über das Schulkonto', 'info', 'nicht eingerichtet', 'Lehrkräfte melden sich mit Zugangsschlüssel an.'));
    else if (!extern.anmeldedienst) punkte.push(punkt('anmeldedienst', 'Anmeldung über das Schulkonto', 'info', 'wird geprüft', 'Die erste Prüfung läuft gleich nach dem Start.'));
    else if (extern.anmeldedienst.ok) punkte.push(punkt('anmeldedienst', 'Anmeldung über das Schulkonto', 'gut', `erreichbar (geprüft ${uhrzeit(extern.anmeldedienst.zeit)} Uhr)`, 'Der Anmeldedienst der Schulen antwortet.'));
    else {
      punkte.push(punkt('anmeldedienst', 'Anmeldung über das Schulkonto', 'achtung', `${extern.anmeldedienst.meldung} (geprüft ${uhrzeit(extern.anmeldedienst.zeit)} Uhr)`, 'Der Anmeldedienst der Schulen antwortet nicht.',
        'Laufende Quests laufen weiter. Lehrkräfte können sich mit einem Zugangsschlüssel anmelden. Hält es länger als eine Stunde an: Störung beim Anbieter des Schulkontos melden.'));
    }

    const paket = k.inhalte.paket();
    const name = paket.beschreibung?.name ?? 'mitgelieferter Inhalt';
    if (inhalte.fehler.length) {
      punkte.push(punkt('inhalte', 'Inhalte', 'stoerung', `${inhalte.fehler.length} Fehler`, `In den Inhalten (${name}) stecken Fehler.`, 'Im Abschnitt „Inhalt tauschen“ den vorherigen Inhalt wiederherstellen.'));
    } else if (paket.warnung) {
      punkte.push(punkt('inhalte', 'Inhalte', 'stoerung', 'mitgelieferter Inhalt', paket.warnung, 'Das Inhaltspaket erneut hochladen und prüfen lassen oder die Entwicklung informieren.'));
    } else {
      punkte.push(punkt('inhalte', 'Inhalte', 'gut', `${name}: ${inhalte.orte.length} Orte, ${inhalte.aufgaben.length} Aufgaben`, 'Die Inhalte sind vollständig und geprüft.'));
    }

    const gesehen = agent?.gesehen && !agent.ausAltemStart ? (jetztMs - Date.parse(agent.gesehen)) / 1000 : null;
    if (!cfg.betriebAgentToken) punkte.push(punkt('betriebsdienst', 'Betriebsdienst am Server', 'info', 'nicht eingerichtet', 'Ohne Betriebsdienst geht der Knopf „Letzte Version zurückspielen“ nicht; alle anderen Knöpfe schon.'));
    else if (gesehen === null) {
      punkte.push(laufzeit < 60
        ? punkt('betriebsdienst', 'Betriebsdienst am Server', 'info', 'wird erwartet', 'Der Dienst meldet sich alle zehn Sekunden.')
        : punkt('betriebsdienst', 'Betriebsdienst am Server', 'achtung', 'meldet sich nicht', 'Der Betriebsdienst am Server hat sich seit dem Start nicht gemeldet.', 'Im Handbuch den Abschnitt „Wenn die Betriebsseite nicht hilft“ befolgen oder die Entwicklung informieren.'));
    } else if (gesehen <= 60) {
      punkte.push(punkt('betriebsdienst', 'Betriebsdienst am Server', 'gut', `meldet sich (vor ${dauer(gesehen)})`, 'Er kann die letzte Version zurückspielen und startet die Anwendung neu, wenn sie hängt.'));
    } else {
      punkte.push(punkt('betriebsdienst', 'Betriebsdienst am Server', 'achtung', `zuletzt vor ${dauer(gesehen)}`, 'Der Betriebsdienst am Server meldet sich nicht mehr.', 'Im Handbuch den Abschnitt „Wenn die Betriebsseite nicht hilft“ befolgen oder die Entwicklung informieren.'));
    }

    const z = extern.zertifikat;
    if (!String(cfg.oeffentlicheUrl).startsWith('https://')) punkte.push(punkt('zertifikat', 'Zertifikat (https)', 'info', 'nicht geprüft', 'Die Adresse beginnt nicht mit https (Test oder Vorführung).'));
    else if (!z) punkte.push(punkt('zertifikat', 'Zertifikat (https)', 'info', 'wird geprüft', 'Die erste Prüfung läuft gleich nach dem Start.'));
    else if (z.nichtPruefbar) punkte.push(punkt('zertifikat', 'Zertifikat (https)', 'info', 'von innen nicht prüfbar', `Die eigene Adresse ist vom Server aus nicht erreichbar (${z.nichtPruefbar}).`));
    else {
      const tage = z.gueltigBis ? (Date.parse(z.gueltigBis) - jetztMs) / 86400_000 : -1;
      const zs = !z.gueltig || tage < 7 ? 'stoerung' : tage < 21 ? 'achtung' : 'gut';
      punkte.push(punkt('zertifikat', 'Zertifikat (https)', zs, z.gueltigBis ? `gültig bis ${datumText(z.gueltigBis)}` : 'ohne Ablaufdatum', z.gueltig ? 'Das Zertifikat für die verschlüsselte Verbindung ist gültig.' : `Das Zertifikat ist ungültig (${z.problem}).`,
        zs === 'gut' ? null : 'Die Entwicklung informieren: Das Zertifikat erneuert sich sonst von selbst, hier hat das nicht geklappt.'));
    }

    const schlimmste = punkte.reduce((a, p) => Math.max(a, RANG[p.stufe]), 0);
    const gesamt = ['gut', 'achtung', 'stoerung'][schlimmste];
    const betroffen = punkte.filter((p) => RANG[p.stufe] === schlimmste && schlimmste > 0).map((p) => p.titel);
    return {
      gesamt,
      ueberschrift: gesamt === 'gut' ? 'Alles in Ordnung' : `${gesamt === 'achtung' ? 'Bitte ansehen' : 'Störung'}: ${betroffen.join(', ')}`,
      geprueft: jetzt(),
      punkte,
      // installiert: das laufende Bild weiß es selbst (SPUR_VERSION_BILD); sonst die Angabe des Betriebsdienstes
      version: { anwendung: VERSION, installiert: cfg.versionBild ?? agent?.version ?? VERSION, vorher: agent && !agent.ausAltemStart ? agent.vorher : null, schema: SCHEMA_VERSION, gestartet: new Date(gestartet).toISOString() },
      knoepfe: {
        neustart: !!(cfg.imContainer && cfg.beende),
        sicherung: !!cfg.sicherung?.schluessel,
        versionZurueck: !!(cfg.betriebAgentToken && gesehen !== null && gesehen <= 90 && agent?.vorher),
      },
      kontakt: cfg.betriebKontakt ?? null,
    };
  }

  /** Grober Zustand für die öffentliche Statusseite (ohne Zahlen): gut, eingeschraenkt oder stoerung. */
  function oeffentlich() {
    const inhalte = k.inhalte.holen();
    const dienst = !cfg.oidc?.aussteller || cfg.attrappe ? 'nicht-eingerichtet' : !extern.anmeldedienst ? 'unbekannt' : extern.anmeldedienst.ok ? 'gut' : 'stoerung';
    const kern = extern.datenbank && !extern.datenbank.ok ? 'stoerung' : inhalte.fehler.length ? 'stoerung' : 'gut';
    return { zustand: kern === 'stoerung' ? 'stoerung' : dienst === 'stoerung' ? 'eingeschraenkt' : 'gut', anmeldedienst: dienst, inhalte: inhalte.fehler.length ? 'stoerung' : 'gut' };
  }

  // --- Anmeldung -------------------------------------------------------------------------------------------------

  route('POST', '/api/v1/anmeldung/betrieb', async (req) => {
    if (!k.fehlversuche.erlaubt(k.absender(req))) throw new HttpFehler(429, 'Zu viele Versuche. Bitte eine Minute warten.');
    const { schluessel } = await koerper(req);
    const soll = einstellung('betrieb');
    if (!soll || !k.gleich(k.hash(k.normalisiereCode(schluessel)), soll)) { k.fehlversuche.fehlschlag(k.absender(req)); throw new HttpFehler(401, 'Schlüssel falsch'); }
    protokolliere('betrieb', 'anmeldung');
    return mit(200, { rolle: 'betrieb' }, { 'Set-Cookie': k.neueSitzung('betrieb') });
  });

  // --- Statusseite ------------------------------------------------------------------------------------------------

  route('GET', '/api/v1/betrieb/zustand', async (req) => {
    betrieb(req);
    const z = await zustand();
    const seit = new Date(Date.now() - 24 * 3600_000).toISOString();
    const verlauf = db.prepare('SELECT zeit, anfragen, fehler, p95_ms AS p95, sync, gruppen_aktiv AS gruppen, speicher_mb AS speicher, cpu_prozent AS cpu FROM messreihe WHERE zeit > ? ORDER BY zeit').all(seit);
    const auftraege = db.prepare('SELECT id, aktion, status, erstellt, begonnen, erledigt, meldung FROM betriebsauftrag ORDER BY id DESC LIMIT 5').all();
    return { ...z, verlauf, auftraege };
  });

  route('GET', '/api/v1/betrieb/protokoll', (req) => {
    betrieb(req);
    return db.prepare("SELECT zeit, rolle, aktion, ziel FROM protokoll WHERE rolle IN ('betrieb', 'system') ORDER BY id DESC LIMIT 100").all();
  });

  // --- Neustart --------------------------------------------------------------------------------------------------

  route('POST', '/api/v1/betrieb/neustart', async (req) => {
    betrieb(req);
    bestaetigt(await koerper(req));
    if (!cfg.imContainer || !cfg.beende) throw new HttpFehler(409, 'Neustart über die Seite geht nur, wenn die Anwendung im Container läuft. Am Server: betrieb/spur neustart');
    protokolliere('betrieb', 'neustart');
    nachKurzemNeustart('Neustart über die Betriebsseite');
    return mit(202, { ok: true, gestartet: new Date(gestartet).toISOString() });
  });

  // --- Sicherungen -----------------------------------------------------------------------------------------------

  route('GET', '/api/v1/betrieb/sicherungen', async (req) => {
    betrieb(req);
    return { schluessel: !!cfg.sicherung?.schluessel, liste: await listeSicherungen(sicherungsOrdner) };
  });

  route('POST', '/api/v1/betrieb/sicherung', async (req) => {
    betrieb(req);
    await koerper(req);
    if (!cfg.sicherung?.schluessel) throw new HttpFehler(409, 'Ohne Sicherungsschlüssel kann nicht gesichert werden. Bitte die Entwicklung informieren.');
    const r = await sichere({ datenbank: cfg.datenbank, ordner: sicherungsOrdner, schluessel: cfg.sicherung.schluessel, behalten: cfg.sicherung.anzahl ?? 14, art: 'hand' });
    setzeEinstellung('letzte_sicherung', jetzt());
    const name = r.datei.split('/').pop();
    protokolliere('betrieb', 'sicherung-angelegt', name);
    return mit(201, { ok: true, datei: name, bytes: r.bytes, dauerMs: r.dauerMs });
  });

  route('POST', '/api/v1/betrieb/zurueckspielen', async (req) => {
    betrieb(req);
    const b = await koerper(req);
    bestaetigt(b);
    if (!cfg.sicherung?.schluessel) throw new HttpFehler(409, 'Ohne Sicherungsschlüssel lässt sich keine Sicherung öffnen. Bitte die Entwicklung informieren.');
    const name = String(b.datei ?? '');
    if (!SICHERUNG_NAME.test(name) || !(await listeSicherungen(sicherungsOrdner)).some((s) => s.datei === name)) throw new HttpFehler(404, 'Diese Sicherung gibt es nicht');
    const ziel = `${cfg.datenbank}.zurueck`;
    try {
      await bereiteZurueckspielenVor({ datei: join(sicherungsOrdner, name), datenbank: cfg.datenbank, schluessel: cfg.sicherung.schluessel });
    } catch (e) {
      await rm(ziel, { force: true });
      await rm(join(dirname(cfg.datenbank), 'zurueckspielen.json'), { force: true });
      log.warn?.(`Zurückspielen von ${name} abgebrochen: ${e.message}`);
      throw new HttpFehler(422, 'Die Sicherung lässt sich nicht öffnen (falscher Schlüssel oder beschädigte Datei). Es wurde nichts verändert.');
    }
    let sicherheit;
    try {
      sicherheit = (await sichere({ datenbank: cfg.datenbank, ordner: sicherungsOrdner, schluessel: cfg.sicherung.schluessel, art: 'vor-zurueckspielen' })).datei.split('/').pop();
    } catch (e) {
      await rm(ziel, { force: true });
      await rm(join(dirname(cfg.datenbank), 'zurueckspielen.json'), { force: true });
      throw new HttpFehler(500, `Der jetzige Stand ließ sich nicht sichern (${e.message}); deshalb wurde nichts zurückgespielt.`);
    }
    protokolliere('betrieb', 'zurueckspielen-vorgemerkt', name);
    nachKurzemNeustart(`Sicherung ${name} zurückspielen`);
    return mit(202, { ok: true, datei: name, sicherheit, neustart: !!(cfg.imContainer && cfg.beende), hinweis: cfg.imContainer ? null : 'Wird beim nächsten Start der Anwendung ausgeführt.' });
  });

  // --- Inhalt tauschen -------------------------------------------------------------------------------------------

  route('GET', '/api/v1/betrieb/inhalt', async (req) => {
    betrieb(req);
    const aktiv = await liesAktiv(datenOrdner);
    const inhalte = k.inhalte.holen();
    return {
      aktiv: { paket: k.inhalte.paket().id, name: k.inhalte.paket().beschreibung?.name ?? 'mitgelieferter Inhalt', seit: aktiv.seit, orte: inhalte.orte.map((o) => o.name), aufgaben: inhalte.aufgaben.length, inhaltVersion: inhalte.inhaltVersion },
      vorher: aktiv.vorher,
      vorherName: aktiv.vorher === MITGELIEFERT ? 'mitgelieferter Inhalt' : aktiv.vorher ? (await liesBeschreibung(datenOrdner, aktiv.vorher))?.name ?? aktiv.vorher : null,
      pakete: await listePakete(datenOrdner),
    };
  });

  route('POST', '/api/v1/betrieb/inhalt', async (req) => {
    betrieb(req);
    // nur ausdrücklich als Datei gesendet (ein Formular einer fremden Seite kann diesen Typ nicht ohne Vorabfrage senden)
    if (!/^application\/(zip|x-zip-compressed|octet-stream)\b/.test(req.headers['content-type'] ?? '')) throw new HttpFehler(415, 'Erwartet wird eine ZIP-Datei');
    const bytes = await koerperRoh(req, 120 * MB);
    let roherName = String(req.headers['x-dateiname'] ?? 'inhalt.zip');
    try { roherName = decodeURIComponent(roherName); } catch { /* unverändert */ }
    const name = roherName.split(/[\\/]/).pop().replace(/[^\wäöüÄÖÜß .()-]/g, '').slice(0, 60) || 'inhalt.zip';
    let eintraege;
    try { eintraege = liesZip(bytes); } catch (e) {
      if (e instanceof PaketFehler) return mit(422, { ok: false, name, fehler: [{ datei: name, pfad: '/', meldung: e.message }], anzahlFehler: 1 });
      throw e;
    }
    const { dateien, fehler } = ordneDateien(eintraege);
    if (fehler.length) return mit(422, { ok: false, name, fehler: fehler.slice(0, 50), anzahlFehler: fehler.length });
    const id = await legeAb(datenOrdner, dateien);
    const probe = await ladeInhalte({ appWurzel: cfg.appWurzel, inhaltsWurzel: cfg.inhaltsWurzel, datenWurzel: paketWurzel(datenOrdner, id) });
    if (probe.fehler.length) {
      await entferne(datenOrdner, id);
      return mit(422, { ok: false, name, fehler: probe.fehler.slice(0, 50), anzahlFehler: probe.fehler.length });
    }
    // laufende Quests, die Aufgaben nutzen, die es im neuen Inhalt nicht mehr gibt
    const fehlend = new Set();
    let betroffen = 0;
    for (const f of db.prepare('SELECT orte FROM freigabe WHERE beendet IS NULL').all()) {
      let fehlt = false;
      for (const o of JSON.parse(f.orte)) for (const nr of o.aufgaben) if (!probe.aufgabeNach.has(`${o.ort}/${nr}`)) { fehlt = true; fehlend.add(`${o.ort}/${nr}`); }
      if (fehlt) betroffen++;
    }
    const beschreibung = {
      id, name, hochgeladen: jetzt(), dateien: dateien.size, bytes: [...dateien.values()].reduce((s, d) => s + d.length, 0),
      orte: probe.orte.map((o) => o.name), aufgaben: probe.aufgaben.length, sammelstuecke: probe.items.length,
      inhaltVersion: probe.inhaltVersion, offlineBytes: probe.offlineListe.gesamtBytes,
    };
    await schreibeBeschreibung(datenOrdner, id, beschreibung);
    await raeumePaketeAuf(datenOrdner);
    protokolliere('betrieb', 'inhaltspaket-geprueft', id);
    const warnungen = betroffen ? [`${betroffen} laufende ${betroffen === 1 ? 'Quest nutzt' : 'Quests nutzen'} Aufgaben, die es im neuen Inhalt nicht gibt (${[...fehlend].slice(0, 5).join(', ')}). Ergebnisse dieser Aufgaben nimmt die Anwendung nach dem Aktivieren nicht mehr an. Am besten aktivieren, wenn diese Quests beendet sind.`] : [];
    return { ok: true, paket: beschreibung, warnungen };
  });

  route('POST', '/api/v1/betrieb/inhalt/aktivieren', async (req) => {
    betrieb(req);
    const { paket } = await koerper(req);
    const aktiv = await liesAktiv(datenOrdner);
    if (paket !== MITGELIEFERT && (!PAKET_ID.test(String(paket ?? '')) || !(await liesBeschreibung(datenOrdner, paket)))) throw new HttpFehler(404, 'Dieses Inhaltspaket gibt es nicht (mehr)');
    const wurzel = paket === MITGELIEFERT ? cfg.inhaltsWurzel : paketWurzel(datenOrdner, paket);
    const neu = await ladeInhalte({ appWurzel: cfg.appWurzel, inhaltsWurzel: cfg.inhaltsWurzel, datenWurzel: wurzel });
    if (neu.fehler.length) throw new HttpFehler(422, 'Dieser Inhalt hat Fehler und wird nicht aktiviert.', { fehler: neu.fehler.slice(0, 50) });
    await setzeAktiv(datenOrdner, paket, aktiv.paket === paket ? aktiv.vorher : aktiv.paket);
    await k.inhalte.setze(neu, paket, wurzel);
    protokolliere('betrieb', 'inhalt-aktiviert', paket);
    return { ok: true, aktiv: paket, vorher: aktiv.paket, inhaltVersion: neu.inhaltVersion, orte: neu.orte.length, aufgaben: neu.aufgaben.length };
  });

  // --- Letzte Version zurückspielen (über den Betriebsdienst am Server) -------------------------------------------

  route('POST', '/api/v1/betrieb/version-zurueck', async (req) => {
    betrieb(req);
    bestaetigt(await koerper(req));
    const gesehen = agent?.gesehen && !agent.ausAltemStart ? (Date.now() - Date.parse(agent.gesehen)) / 1000 : null;
    if (!cfg.betriebAgentToken || gesehen === null || gesehen > 90) throw new HttpFehler(409, 'Der Betriebsdienst am Server meldet sich nicht. Bitte im Handbuch den Abschnitt „Wenn die Betriebsseite nicht hilft“ befolgen.');
    if (!agent.vorher) throw new HttpFehler(409, 'Auf diesem Server ist keine frühere Version installiert.');
    if (db.prepare("SELECT 1 FROM betriebsauftrag WHERE status IN ('offen', 'laeuft') AND erstellt > ?").get(new Date(Date.now() - 15 * 60_000).toISOString())) throw new HttpFehler(409, 'Ein Auftrag läuft schon. Bitte warten.');
    const r = db.prepare("INSERT INTO betriebsauftrag (aktion, status, erstellt) VALUES ('version-zurueck', 'offen', ?)").run(jetzt());
    protokolliere('betrieb', 'version-zurueck-beauftragt', `${agent.version} → ${agent.vorher}`);
    return mit(202, { ok: true, auftrag: Number(r.lastInsertRowid), von: agent.version, auf: agent.vorher });
  });

  route('GET', '/api/v1/betrieb/auftraege/(\\d+)', (req, url, [id]) => {
    betrieb(req);
    const a = db.prepare('SELECT id, aktion, status, erstellt, begonnen, erledigt, meldung FROM betriebsauftrag WHERE id = ?').get(Number(id));
    if (!a) throw new HttpFehler(404, 'Auftrag nicht gefunden');
    return a;
  });

  // Betriebsdienst am Server: meldet Stand und Ergebnisse, holt Aufträge. Antwort als Textzeilen, damit ein
  // Shell-Skript sie ohne weitere Werkzeuge lesen kann: „zustand gut“, „auftrag 12 version-zurueck“.
  route('POST', '/api/v1/betrieb/agent', async (req) => {
    const t = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!cfg.betriebAgentToken || !t || !k.gleich(t, cfg.betriebAgentToken)) throw new HttpFehler(401, 'Nur für den Betriebsdienst');
    const f = new URLSearchParams(await koerper(req, 'text', 16 * 1024));
    const kurz = (n, max = 40) => (f.get(n) ?? '').replace(/[^\w .:+-]/g, '').slice(0, max) || null;
    agent = { gesehen: jetzt(), version: kurz('version'), vorher: kurz('vorher'), gesund: kurz('gesund'), neustarts: Number(f.get('neustarts')) || 0 };
    setzeEinstellung('agent', JSON.stringify(agent));
    const erledigt = f.get('erledigt');
    if (/^\d{1,9}$/.test(erledigt ?? '')) {
      const ok = f.get('ok') === '1';
      const meldung = (f.get('meldung') ?? '').replace(/[\r\n]+/g, ' ').slice(0, 300);
      const n = db.prepare("UPDATE betriebsauftrag SET status = ?, erledigt = ?, meldung = ? WHERE id = ? AND status IN ('offen', 'laeuft')").run(ok ? 'fertig' : 'fehler', jetzt(), meldung, Number(erledigt)).changes;
      if (n) protokolliere('system', ok ? 'auftrag-erledigt' : 'auftrag-fehlgeschlagen', `${erledigt}: ${meldung}`.slice(0, 200));
    }
    const zeilen = [`zustand ${(await zustand()).gesamt}`];
    if (f.get('nur') !== 'zustand') {
      for (const a of db.prepare("SELECT id, aktion FROM betriebsauftrag WHERE status = 'offen' ORDER BY id LIMIT 1").all()) {
        db.prepare("UPDATE betriebsauftrag SET status = 'laeuft', begonnen = ? WHERE id = ?").run(jetzt(), a.id);
        zeilen.push(`auftrag ${a.id} ${a.aktion}`);
      }
    }
    return datei(`${zeilen.join('\n')}\n`, 'text/plain; charset=utf-8');
  });

  return {
    oeffentlich,
    zustand,
    pruefeJetzt: async () => { pruefeDatenbank(); await pruefeAnmeldedienst(); await pruefeZertifikat(); },
    schliesse() { for (const t of zeitgeber) { clearInterval(t); clearTimeout(t); } },
  };
}
