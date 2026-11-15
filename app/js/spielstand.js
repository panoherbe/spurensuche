// Spielstand des Teams auf diesem Gerät und der Ausgang für die Übertragung.
//
// Schulgruppe: Jede Änderung (Station begonnen/beendet, Aufgabe beendet, offline/online) landet zusätzlich als
// Eintrag im Ausgang und wird übertragen, sobald Netz da ist. Jeder Eintrag trägt einen eigenen Schlüssel; der
// Server zählt ihn auch bei mehrfachem Senden nur einmal.
// Familie: Nichts verlässt das Gerät, außer einem Bild, das das Team selbst freigibt.

import { lies, schreibe, entferne, legeInAusgang } from './speicher.js';

let team = null;
const beobachter = new Set();

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
const jetzt = () => new Date().toISOString();

export async function ladeTeam() {
  try { team = (await lies('team')) ?? null; } catch { team = null; }
  return team;
}
export const aktuellesTeam = () => team;
export function beiTeamAenderung(fn) { beobachter.add(fn); return () => beobachter.delete(fn); }

async function speichere() {
  await schreibe('team', team);
  for (const fn of beobachter) fn(team);
}

/** Neues Team: `{ modus: 'schule', name, token, freigabe }` oder `{ modus: 'familie', name }`. */
export async function neuesTeam(daten) {
  team = { ...daten, begonnen: jetzt(), stationen: {}, laeufe: {}, items: [], figur: null, bild: null };
  await speichere();
  return team;
}

export async function teamVerlassen() {
  team = null;
  await entferne('team');
  for (const fn of beobachter) fn(null);
}

export const istSchule = () => team?.modus === 'schule';
export const erfassung = () => istSchule() && team.freigabe?.erfassung === true;

/** Orte, die das Team spielt: in der Schule die freigegebenen, in der Familie alle. */
export function orteDesTeams(inhalte) {
  if (istSchule()) {
    return team.freigabe.orte.map((f) => ({ ort: inhalte.ortNach.get(f.ort), aufgaben: f.aufgaben })).filter((x) => x.ort);
  }
  return inhalte.orte.map((ort) => ({ ort, aufgaben: ort.aufgaben }));
}

export function stationVon(ortId) { return team?.stationen?.[ortId] ?? null; }
export function laufVon(kennung) { return team?.laeufe?.[kennung] ?? null; }

async function inAusgang(daten) {
  if (!erfassung()) return; // ohne Erfassung entsteht kein Datensatz, auch nicht im Ausgang
  await legeInAusgang({ art: 'sync', schluessel: uuid(), daten });
}

function stationFuerServer(ortId) {
  const s = team.stationen[ortId];
  return { ort: ortId, status: s.status, verifikation: s.verifikation ?? null, begonnen: s.begonnen, beendet: s.beendet ?? null, aktivSekunden: Math.round(s.aktivSekunden ?? 0) };
}

/** Station beginnen, sobald die Gruppe den Ort bestätigt hat (vor Ort oder ortsunabhängig). */
export async function beginneStation(ortId, verifikation) {
  const s = team.stationen[ortId];
  if (s?.status === 'abgeschlossen') { s.verifikation ??= verifikation; await speichere(); return s; }
  team.stationen[ortId] = { ...(s ?? {}), status: 'begonnen', verifikation, begonnen: s?.begonnen ?? jetzt(), beendet: null, aktivSekunden: s?.aktivSekunden ?? 0 };
  await speichere();
  await inAusgang({ stationen: [stationFuerServer(ortId)] });
  return team.stationen[ortId];
}

/** Aktive Zeit an der Station aufaddieren (Sekunden, nur solange die Seite sichtbar ist). */
export async function zaehleAktiv(ortId, sekunden) {
  const s = team?.stationen?.[ortId];
  if (!s || !(sekunden > 0)) return;
  s.aktivSekunden = (s.aktivSekunden ?? 0) + sekunden;
  await speichere();
}

/** Ergebnis einer Aufgabe übernehmen (bereinigt, siehe kern/ereignisse.js). */
export async function speichereLauf(aufgabe, ergebnis, { gesamtAufgaben }) {
  const lauf = { id: uuid(), aufgabe: aufgabe.kennung, geloest: ergebnis.geloest, versuche: ergebnis.versuche, dauerSekunden: ergebnis.dauerSekunden, items: ergebnis.items, ereignisse: ergebnis.ereignisse, beendet: jetzt() };
  const vorher = team.laeufe[aufgabe.kennung];
  // Gelöst bleibt gelöst; ein neuer Versuch ersetzt sonst den alten Stand im Gerät.
  team.laeufe[aufgabe.kennung] = { ...lauf, geloest: lauf.geloest || !!vorher?.geloest, ereignisse: undefined };
  const neu = ergebnis.items.filter((i) => !team.items.includes(i));
  team.items.push(...neu);

  const ortId = aufgabe.ort;
  const s = team.stationen[ortId];
  const fertig = gesamtAufgaben.every((k) => team.laeufe[k]);
  if (s && fertig) { s.status = 'abgeschlossen'; s.beendet = jetzt(); }
  await speichere();
  await inAusgang({ laeufe: [lauf], stationen: s ? [stationFuerServer(ortId)] : [] });
  return { neueItems: neu, stationFertig: fertig };
}

/** Station verlassen, ohne alle Aufgaben fertig zu haben. */
export async function brichStationAb(ortId) {
  const s = team?.stationen?.[ortId];
  if (!s || s.status === 'abgeschlossen') return;
  s.status = 'abgebrochen';
  s.beendet = jetzt();
  await speichere();
  await inAusgang({ stationen: [stationFuerServer(ortId)] });
}

/** Netzwechsel festhalten (nur Zeitpunkt, keine Ortsangabe). */
export async function notiereNetz(art) {
  if (!erfassung()) return;
  await inAusgang({ technik: [{ schluessel: uuid(), art, zeit: jetzt() }] });
}

export async function notiereRueckmeldung(aufgabeKennung, antwort) {
  if (!istSchule() || !team.freigabe?.rueckmeldung) return;
  await legeInAusgang({ art: 'sync', schluessel: uuid(), daten: { rueckmeldungen: [{ id: uuid(), aufgabe: aufgabeKennung, ...antwort }] } });
}

export async function setzeFigur(figur) { team.figur = figur; await speichere(); }
export async function setzeBild(bild) { team.bild = bild; await speichere(); }
export async function aktualisiereFreigabe(freigabe) { if (team) { team.freigabe = { ...team.freigabe, ...freigabe }; await speichere(); } }

/** Ist die Abschlussaufgabe (alle Aufgaben am Ort `finale`) erledigt? */
export function finaleGeschafft(inhalte) {
  const eintrag = orteDesTeams(inhalte).find((x) => x.ort.id === inhalte.finale);
  if (!eintrag) return false;
  return eintrag.aufgaben.every((nr) => team?.laeufe?.[`${inhalte.finale}/${nr}`]);
}
