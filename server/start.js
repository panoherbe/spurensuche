#!/usr/bin/env node
// Startet den Server mit der Konfiguration aus Umgebungsvariablen (alle Werte: docs/KONFIGURATION.md).

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { erstelleApp, VERSION } from './app.js';
import { schluesselAus, vollendeZurueckspielen } from './sicherung.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..');
const e = process.env;
const ja = (w) => ['1', 'true', 'ja', 'yes'].includes(String(w ?? '').toLowerCase());

const port = Number(e.SPUR_PORT ?? 8080);
const host = e.SPUR_HOST ?? '127.0.0.1';
const daten = resolve(e.SPUR_DATEN ?? resolve(WURZEL, 'daten'));
mkdirSync(daten, { recursive: true });
const oeffentlicheUrl = (e.SPUR_OEFFENTLICHE_URL ?? `http://localhost:${port}`).replace(/\/+$/, '');
const attrappe = ja(e.SPUR_ATTRAPPE);
const datenbank = resolve(daten, 'spurensuche.db');

// Sicherungsschlüssel (für „Sicherung jetzt anlegen“ und „Sicherung zurückspielen“ auf der Betriebsseite)
let sicherungsSchluessel = null;
try {
  const roh = e.SPUR_SICHERUNG_SCHLUESSEL || (e.SPUR_SICHERUNG_SCHLUESSELDATEI ? readFileSync(e.SPUR_SICHERUNG_SCHLUESSELDATEI, 'utf8') : '');
  if (roh) sicherungsSchluessel = schluesselAus(roh);
} catch (f) { console.error(`Sicherungsschlüssel unbrauchbar: ${f.message}`); }

// Vorgemerktes Zurückspielen (Betriebsseite) ausführen, bevor die Datenbank geöffnet wird
const zurueckgespielt = await vollendeZurueckspielen({ datenbank });
if (zurueckgespielt?.fehler) console.error(`Zurückspielen von ${zurueckgespielt.datei} abgebrochen: ${zurueckgespielt.fehler}`);
else if (zurueckgespielt) console.log(`Sicherung ${zurueckgespielt.datei} zurückgespielt.`);

let app = null;
let beendet = false;
function beende(grund) {
  if (beendet) return;
  beendet = true;
  console.log(`${grund}: Server wird beendet`);
  if (!app) process.exit(0);
  app.server.close(() => { app.schliesse(); process.exit(0); });
  app.server.closeIdleConnections?.();
  setTimeout(() => process.exit(0), 5000).unref();
}

const cfg = {
  datenbank,
  datenOrdner: daten,
  appWurzel: WURZEL,
  inhaltsWurzel: resolve(e.SPUR_INHALTE ?? WURZEL),
  oeffentlicheUrl,
  sichereCookies: e.SPUR_SICHERE_COOKIES ? ja(e.SPUR_SICHERE_COOKIES) : oeffentlicheUrl.startsWith('https://'),
  verwaltungSchluessel: e.SPUR_VERWALTUNG_SCHLUESSEL || null,
  ausstellungToken: e.SPUR_AUSSTELLUNG_TOKEN || null,
  ausstellungOffen: ja(e.SPUR_AUSSTELLUNG_OFFEN),
  messwerteToken: e.SPUR_MESSWERTE_TOKEN || null,
  aufbewahrungWochen: Number(e.SPUR_AUFBEWAHRUNG_WOCHEN ?? 12),
  lernendeAnmeldung: e.SPUR_LERNENDE_ANMELDUNG === 'pflicht' ? 'pflicht' : 'optional',
  werkstatt: ja(e.SPUR_WERKSTATT),
  standBezeichnung: (e.SPUR_STAND_BEZEICHNUNG ?? '').slice(0, 40) || null,
  versionBild: (e.SPUR_VERSION_BILD ?? '').replace(/[^\w.+-]/g, '').slice(0, 40) || null,
  betriebSchluessel: e.SPUR_BETRIEB_SCHLUESSEL || null,
  betriebAgentToken: e.SPUR_BETRIEB_AGENT_TOKEN || null,
  betriebKontakt: (e.SPUR_BETRIEB_KONTAKT ?? '').slice(0, 160) || null,
  sicherung: { schluessel: sicherungsSchluessel, ordner: resolve(e.SPUR_SICHERUNG_ORDNER ?? resolve(daten, 'sicherungen')), anzahl: Number(e.SPUR_SICHERUNG_ANZAHL ?? 14) },
  // Neustart über die Betriebsseite: der Prozess endet, Docker startet ihn neu (restart: unless-stopped)
  imContainer: existsSync('/.dockerenv') || existsSync('/run/.containerenv'),
  beende,
  zurueckgespielt,
  protokollAufrufe: ja(e.SPUR_PROTOKOLL_AUFRUFE),
  attrappe,
  oidc: attrappe || e.SPUR_OIDC_AUSSTELLER ? {
    aussteller: (e.SPUR_OIDC_AUSSTELLER || `${oeffentlicheUrl}/attrappe`).replace(/\/+$/, ''),
    clientId: e.SPUR_OIDC_CLIENT_ID || 'spurensuche',
    clientSecret: e.SPUR_OIDC_CLIENT_SECRET || (attrappe ? 'nur-fuer-die-attrappe' : ''),
    rollenMerkmal: e.SPUR_OIDC_ROLLEN_MERKMAL || 'rolle',
    rollenLehrkraft: (e.SPUR_OIDC_ROLLEN_LEHRKRAFT || 'lehrkraft').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    rollenLernende: (e.SPUR_OIDC_ROLLEN_LERNENDE || 'schueler,lernende').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    // Server-zu-Server-Aufrufe zur Attrappe gehen direkt an den eigenen Port, nicht über den Proxy.
    intern: e.SPUR_OIDC_INTERN || (attrappe && !e.SPUR_OIDC_AUSSTELLER ? `http://127.0.0.1:${port}/attrappe` : null),
  } : null,
  log: {
    info: (m) => console.log(m),
    warn: (m) => console.warn(m),
    error: (m) => console.error(m),
  },
};

if (cfg.oidc && !cfg.oidc.clientSecret) {
  console.error('SPUR_OIDC_CLIENT_SECRET fehlt');
  process.exit(2);
}

app = await erstelleApp(cfg);
app.server.listen(port, host, () => {
  console.log(`spurensuche ${VERSION} auf http://${host}:${port} (öffentlich ${oeffentlicheUrl}), Inhalte ${app.inhalte.inhaltVersion}: `
    + `${app.inhalte.orte.length} Orte, ${app.inhalte.aufgaben.length} Aufgaben, ${app.inhalte.fehler.length} Inhaltsfehler`);
  if (attrappe) console.warn('Achtung: Attrappe des Anmeldedienstes ist eingeschaltet (nur für Tests und Vorführung).');
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => beende(signal));
