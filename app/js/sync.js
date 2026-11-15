// Übertragung des Ausgangs: sobald Netz da ist, alle 20 Sekunden und nach jeder Änderung. Wiederholungen sind
// unschädlich (jeder Eintrag hat einen eigenen Schlüssel). Kommt der Server mit 4xx zurück, wird der Eintrag
// verworfen und gezählt; bei fehlendem Netz bleibt er liegen.

import { ausgang, ausgangErledigt, ausgangAktualisieren, bild as bildAusSpeicher } from './speicher.js';
import { aktuellesTeam, notiereNetz, aktualisiereFreigabe, setzeBild } from './spielstand.js';

let api = null;
let laeuft = false;
let zeitgeber = null;
const zustand = { online: typeof navigator === 'undefined' ? true : navigator.onLine, offen: 0, letzte: null, fehler: null, verworfen: 0 };
const beobachter = new Set();

export const syncZustand = () => ({ ...zustand });
export function beiSyncAenderung(fn) { beobachter.add(fn); return () => beobachter.delete(fn); }
const melde = () => { for (const fn of beobachter) fn(syncZustand()); };

async function zaehleOffen() {
  try { zustand.offen = (await ausgang()).length; } catch { zustand.offen = 0; }
  melde();
}

async function alsBase64(blob) {
  const puffer = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < puffer.length; i += 0x8000) s += String.fromCharCode(...puffer.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Sendet alles, was im Ausgang liegt, in der Reihenfolge des Entstehens. */
export async function sende() {
  if (laeuft || !api) return;
  laeuft = true;
  try {
    const team = aktuellesTeam();
    for (const e of await ausgang()) {
      try {
        if (e.art === 'sync') {
          if (!team?.token) continue;
          const r = await api.sync(team.token, { schluessel: e.schluessel, ...e.daten });
          if (typeof r?.erfassung === 'boolean' && r.erfassung !== team.freigabe?.erfassung) await aktualisiereFreigabe({ erfassung: r.erfassung });
        } else if (e.art === 'bild') {
          const b = await bildAusSpeicher(e.kennung);
          if (!b) { await ausgangErledigt(e.id); continue; }
          const daten = { metadaten: b.metadaten, png: await alsBase64(b.png), vorschau: await alsBase64(b.vorschau), freigabe: e.freigabe === true };
          const r = await api.bildbeitrag(daten, e.mitToken ? team?.token : null);
          if (team?.bild?.kennung === b.metadaten.kennung) await setzeBild({ ...team.bild, status: r.status === 'freigegeben' ? 'freigegeben' : 'gesendet' });
        }
        await ausgangErledigt(e.id);
        zustand.letzte = new Date().toISOString();
        zustand.fehler = null;
      } catch (fehler) {
        if (fehler.status === 0) { zustand.fehler = 'offline'; break; } // kein Netz: später weiter
        if (fehler.status >= 400 && fehler.status < 500 && ![408, 425, 429].includes(fehler.status)) {
          await ausgangErledigt(e.id); // dauerhaft abgelehnt: nicht endlos wiederholen
          zustand.verworfen++;
          zustand.fehler = fehler.message;
          continue;
        }
        await ausgangAktualisieren({ ...e, versuche: (e.versuche ?? 0) + 1 });
        zustand.fehler = fehler.message;
        break;
      }
    }
  } finally {
    laeuft = false;
    await zaehleOffen();
  }
}

let warte = null;
/** Nach einer Änderung kurz warten und dann senden (bündelt mehrere Einträge). */
export function bald() {
  clearTimeout(warte);
  warte = setTimeout(() => { if (navigator.onLine) sende(); else zaehleOffen(); }, 1500);
}

export function starteSync(schnittstelle) {
  api = schnittstelle;
  window.addEventListener('online', async () => { zustand.online = true; await notiereNetz('online'); melde(); sende(); });
  window.addEventListener('offline', async () => { zustand.online = false; await notiereNetz('offline'); melde(); });
  clearInterval(zeitgeber);
  zeitgeber = setInterval(() => { if (navigator.onLine) sende(); }, 20_000);
  zaehleOffen();
  if (navigator.onLine) sende();
}
