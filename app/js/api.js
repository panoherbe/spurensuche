// Zugang zur Schnittstelle /api/v1. Im Vorführmodus (statische Seite ohne Server) ersetzt vorfuehrung.js
// dieselben Aufrufe durch eine Nachbildung im Browser.

export class ApiFehler extends Error {
  constructor(status, meldung, daten = {}) { super(meldung); this.status = status; this.daten = daten; }
  get offline() { return this.status === 0; }
}

const basis = () => new URL('./', document.baseURI);

async function aufruf(pfad, { methode = 'GET', daten, token, roh = false } = {}) {
  const kopf = { Accept: 'application/json' };
  if (daten !== undefined) kopf['Content-Type'] = 'application/json';
  if (token) kopf.Authorization = `Bearer ${token}`;
  let r;
  try {
    r = await fetch(new URL(pfad.replace(/^\//, ''), basis()), { method: methode, headers: kopf, body: daten === undefined ? undefined : JSON.stringify(daten), credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiFehler(0, 'Keine Verbindung. Die Daten bleiben im Gerät und werden später übertragen.');
  }
  if (roh && r.ok) return r;
  let inhalt = null;
  try { inhalt = await r.json(); } catch { /* kein JSON */ }
  if (!r.ok) throw new ApiFehler(r.status, inhalt?.fehler ?? `Fehler ${r.status}`, inhalt ?? {});
  return inhalt;
}

export class HttpApi {
  constructor(konfiguration) { this.konfiguration = konfiguration; this.vorfuehrung = false; }

  // Geräte einer Gruppe
  beitritt(code) { return aufruf('api/v1/beitritt', { methode: 'POST', daten: { code } }); }
  geraet(token) { return aufruf('api/v1/geraet', { token }); }
  sync(token, daten) { return aufruf('api/v1/sync', { methode: 'POST', daten, token }); }
  bildbeitrag(daten, token = null) { return aufruf('api/v1/bildbeitraege', { methode: 'POST', daten, token }); }

  // Anmeldung
  ich() { return aufruf('api/v1/ich'); }
  anmeldenMitSchluessel(schluessel) { return aufruf('api/v1/anmeldung/schluessel', { methode: 'POST', daten: { schluessel } }); }
  anmeldenVerwaltung(schluessel) { return aufruf('api/v1/anmeldung/verwaltung', { methode: 'POST', daten: { schluessel } }); }
  abmelden() { return aufruf('api/v1/abmeldung', { methode: 'POST', daten: {} }); }
  anmeldedienstUrl(ziel = 'lehrkraft') { return new URL(`anmeldung/start?ziel=${ziel}`, basis()).href; }

  // Lehrkräfte
  lerngruppen() { return aufruf('api/v1/lerngruppen'); }
  lerngruppeAnlegen(d) { return aufruf('api/v1/lerngruppen', { methode: 'POST', daten: d }); }
  lerngruppeAendern(id, d) { return aufruf(`api/v1/lerngruppen/${id}`, { methode: 'PATCH', daten: d }); }
  lerngruppeLoeschen(id) { return aufruf(`api/v1/lerngruppen/${id}`, { methode: 'DELETE' }); }
  questFreigeben(lerngruppeId, d) { return aufruf(`api/v1/lerngruppen/${lerngruppeId}/freigaben`, { methode: 'POST', daten: d }); }
  quest(id) { return aufruf(`api/v1/freigaben/${id}`); }
  questBeenden(id) { return aufruf(`api/v1/freigaben/${id}/beenden`, { methode: 'POST', daten: {} }); }
  questLoeschen(id) { return aufruf(`api/v1/freigaben/${id}`, { methode: 'DELETE' }); }
  gruppeAnlegen(questId, d) { return aufruf(`api/v1/freigaben/${questId}/gruppen`, { methode: 'POST', daten: d }); }
  gruppeAendern(id, d) { return aufruf(`api/v1/gruppen/${id}`, { methode: 'PATCH', daten: d }); }
  gruppeLoeschen(id) { return aufruf(`api/v1/gruppen/${id}`, { methode: 'DELETE' }); }
  auswertung(id) { return aufruf(`api/v1/gruppen/${id}/auswertung`); }
  bildbeitraege(questId) { return aufruf(`api/v1/freigaben/${questId}/bildbeitraege`); }
  bildbeitraegeEntscheiden(kennungen, freigeben) { return aufruf('api/v1/bildbeitraege/entscheidung', { methode: 'POST', daten: { kennungen, freigeben } }); }
  async vorschauUrl(eintrag) { return new URL(eintrag.vorschau.replace(/^\//, ''), basis()).href; }
  rueckmeldungenCsvUrl(questId) { return new URL(`api/v1/freigaben/${questId}/rueckmeldungen.csv`, basis()).href; }

  // Verwaltung
  uebersicht() { return aufruf('api/v1/verwaltung/uebersicht'); }
  zugangsschluessel() { return aufruf('api/v1/verwaltung/zugangsschluessel'); }
  zugangsschluesselAnlegen(bezeichnung) { return aufruf('api/v1/verwaltung/zugangsschluessel', { methode: 'POST', daten: { bezeichnung } }); }
  zugangsschluesselSperren(id, gesperrt) { return aufruf(`api/v1/verwaltung/zugangsschluessel/${id}`, { methode: 'PATCH', daten: { gesperrt } }); }
  protokoll() { return aufruf('api/v1/verwaltung/protokoll'); }
  inhalteNeuLaden() { return aufruf('api/v1/verwaltung/inhalte-neu-laden', { methode: 'POST', daten: {} }); }
  archivUrl(umfang) { return new URL(`api/v1/verwaltung/archiv.zip?umfang=${umfang}`, basis()).href; }
}

let api = null;
let konfig = null;

/** Liest konfiguration.json und liefert die passende Schnittstelle (Server oder Vorführung). */
export async function holeApi() {
  if (api) return api;
  try {
    konfig = await (await fetch(new URL('konfiguration.json', basis()), { cache: 'no-cache' })).json();
  } catch {
    konfig = (await caches?.match?.(new URL('konfiguration.json', basis()).href).then((r) => r?.json()).catch(() => null)) ?? { modus: 'server' };
  }
  if (konfig.modus === 'vorfuehrung') {
    const { VorfuehrApi } = await import('./vorfuehrung.js');
    api = new VorfuehrApi(konfig);
  } else api = new HttpApi(konfig);
  return api;
}
