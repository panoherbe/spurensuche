// Ereignisse und Ergebnisse der Spiele: was erlaubt ist und wie es bereinigt wird (docs/SCHNITTSTELLE.md 2.4/2.5).
// Dieselben Regeln gelten im Gerät, in der Werkstatt-Seite und auf dem Server; was hier nicht durchkommt, wird
// nirgends gespeichert.

/** Ereignisarten, die ein Spiel melden darf. */
export const SPIEL_ARTEN = Object.freeze(['versuch', 'weg', 'hilfe', 'neuer-anlauf', 'rolle', 'abstimmung']);
/** Ereignisarten, die nur die App erzeugt. */
export const APP_ARTEN = Object.freeze(['start', 'ende', 'aktiv', 'offline', 'online', 'sync']);

export const KENNUNG = /^[a-z0-9-]{1,40}$/;
const SECHS_STUNDEN_MS = 6 * 3600 * 1000;

/** Erlaubte Werte je Art. `aufgabe` liefert die Rollen, gegen die `rolle` geprüft wird. */
function wertPasst(art, wert, aufgabe) {
  switch (art) {
    case 'versuch':
    case 'neuer-anlauf':
      return typeof wert === 'boolean';
    case 'weg':
      return typeof wert === 'string' && KENNUNG.test(wert);
    case 'hilfe':
      return (Number.isInteger(wert) && wert >= 1 && wert <= 9) || (typeof wert === 'string' && KENNUNG.test(wert));
    case 'rolle':
      return typeof wert === 'string' && KENNUNG.test(wert)
        && (!Array.isArray(aufgabe?.rollen) || aufgabe.rollen.includes(wert));
    case 'abstimmung':
      return wert === 'einig' || wert === 'mehrheit';
    case 'start':
      return wert === true || wert === undefined || wert === null;
    case 'ende':
      return wert === 'abgeschlossen' || wert === 'abgebrochen';
    case 'aktiv':
      return Number.isFinite(wert) && wert >= 0 && wert <= 6 * 3600;
    case 'offline':
    case 'online':
    case 'sync':
      return wert === true || wert === undefined || wert === null || (Number.isFinite(wert) && wert >= 0);
    default:
      return false;
  }
}

/**
 * Bereinigt eine Liste von Ereignissen. Übernommen wird nur `{ art, zeit, wert }` mit erlaubter Art, gültiger
 * Zeit und gültigem Wert; jedes andere Feld fällt weg. Liefert `{ ereignisse, verworfen }`, `verworfen` mit Grund.
 */
export function bereinigeEreignisse(liste, { aufgabe = null, arten = SPIEL_ARTEN, max = 500 } = {}) {
  const ereignisse = [];
  const verworfen = [];
  if (!Array.isArray(liste)) return { ereignisse, verworfen: [{ ereignis: liste, grund: 'keine Liste' }] };
  for (const e of liste) {
    if (ereignisse.length >= max) { verworfen.push({ ereignis: e, grund: `mehr als ${max} Ereignisse` }); continue; }
    if (!e || typeof e !== 'object') { verworfen.push({ ereignis: e, grund: 'kein Objekt' }); continue; }
    const { art, zeit, wert } = e;
    if (!arten.includes(art)) { verworfen.push({ ereignis: e, grund: `Art „${art}“ ist nicht erlaubt` }); continue; }
    if (!Number.isFinite(zeit) || zeit < 0 || zeit > SECHS_STUNDEN_MS) {
      verworfen.push({ ereignis: e, grund: 'zeit muss Millisekunden seit dem Start sein (0 bis 6 Stunden)' });
      continue;
    }
    if (!wertPasst(art, wert, aufgabe)) { verworfen.push({ ereignis: e, grund: `Wert ${JSON.stringify(wert)} passt nicht zu „${art}“` }); continue; }
    const sauber = { art, zeit: Math.round(zeit) };
    if (wert !== undefined && wert !== null) sauber.wert = wert;
    ereignisse.push(sauber);
  }
  ereignisse.sort((a, b) => a.zeit - b.zeit);
  return { ereignisse, verworfen };
}

/**
 * Prüft ein Ergebnis gegen den Vertrag und liefert `{ fehler, ergebnis }`. `ergebnis` ist die bereinigte Fassung,
 * die die App speichert (ohne `punkte`). `fehler` listet jede Abweichung; die Werkstatt-Seite zeigt sie an.
 */
export function pruefeErgebnis(roh, aufgabe) {
  const fehler = [];
  if (!roh || typeof roh !== 'object') return { fehler: ['Ergebnis ist kein Objekt'], ergebnis: null };
  if (typeof roh.geloest !== 'boolean') fehler.push('geloest muss true oder false sein');
  if (!Number.isInteger(roh.punkte) || roh.punkte < 0) fehler.push('punkte muss eine ganze Zahl ≥ 0 sein');
  if (!Number.isInteger(roh.versuche) || roh.versuche < 0) fehler.push('versuche muss eine ganze Zahl ≥ 0 sein');
  if (!Number.isFinite(roh.dauerSekunden) || roh.dauerSekunden < 0) fehler.push('dauerSekunden muss eine Zahl ≥ 0 sein');
  if (!Array.isArray(roh.items)) fehler.push('items muss eine Liste sein');
  const belohnung = Array.isArray(aufgabe?.belohnung) ? aufgabe.belohnung : [];
  const items = (Array.isArray(roh.items) ? roh.items : []).filter((id) => {
    const ok = typeof id === 'string' && belohnung.includes(id);
    if (!ok) fehler.push(`Sammelstück „${id}“ steht nicht in aufgabe.belohnung`);
    return ok;
  });
  const { ereignisse, verworfen } = bereinigeEreignisse(roh.ereignisse ?? [], { aufgabe });
  for (const v of verworfen) fehler.push(`Ereignis verworfen: ${v.grund}`);
  const zahlVersuche = ereignisse.filter((e) => e.art === 'versuch').length;
  if (Number.isInteger(roh.versuche) && roh.versuche !== zahlVersuche) {
    fehler.push(`versuche (${roh.versuche}) passt nicht zur Zahl der Ereignisse „versuch“ (${zahlVersuche})`);
  }
  for (const feld of Object.keys(roh)) {
    if (!['geloest', 'punkte', 'versuche', 'dauerSekunden', 'items', 'ereignisse'].includes(feld)) fehler.push(`Feld „${feld}“ ist nicht vorgesehen`);
  }
  const ergebnis = {
    geloest: roh.geloest === true,
    versuche: zahlVersuche,
    dauerSekunden: Number.isFinite(roh.dauerSekunden) && roh.dauerSekunden >= 0 ? Math.round(roh.dauerSekunden) : 0,
    items: [...new Set(items)],
    ereignisse,
  };
  return { fehler, ergebnis };
}

/** Prüft die Exporte eines Spielmoduls (`meta`, `starte`). */
export function pruefeModul(modul, ordner) {
  const fehler = [];
  const meta = modul?.meta;
  if (!meta || typeof meta !== 'object') return ['export const meta fehlt'];
  if (meta.id !== ordner) fehler.push(`meta.id („${meta.id}“) muss dem Ordnernamen („${ordner}“) entsprechen`);
  if (typeof meta.titel !== 'string' || !meta.titel.trim()) fehler.push('meta.titel fehlt');
  const d = meta.dauerMinuten;
  if (!Array.isArray(d) || d.length !== 2 || !d.every(Number.isFinite) || d[0] > d[1] || d[0] < 1) {
    fehler.push('meta.dauerMinuten muss [min, max] in Minuten sein');
  }
  if (meta.offline !== true) fehler.push('meta.offline muss true sein');
  if (typeof modul.starte !== 'function') fehler.push('export async function starte fehlt');
  return fehler;
}
