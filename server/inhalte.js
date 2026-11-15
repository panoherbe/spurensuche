// Inhalte vom Dateisystem: prüfen beim Start, Version berechnen, Offline-Liste für den Service Worker erzeugen.

import { readFile, readdir, stat, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative, sep } from 'node:path';
import { pruefeInhalte } from '../app/js/kern/inhalte.js';

/** Ordner, die die App offline bereithält (relativ zur jeweiligen Wurzel). */
export const OFFLINE_ORDNER = {
  app: ['app'],
  inhalt: ['spiele', 'inhalte', 'assets/spiele'],
};
const SEITEN = ['index.html', 'lehrkraefte.html'];
// ausgelassen: versteckte Dateien, Entwürfe, Testordner, Lies-mich-Dateien, die Werkstatt-Seite und Arbeitsordner
// der Spiele mit Unterstrich (Prüfung, Nachweis, Vorschau, Werkzeuge); nur spiele/_gemeinsam brauchen die Geräte
const AUSGESCHLOSSEN = /(^|\/)(\.[^/]*|_entwurf[^/]*|tests?)(\/|$)|(^|\/)README\.md$|(^|\/)werkstatt\.|(^|\/)_(?!gemeinsam(\/|$))[^/]*\//;

async function dateienIn(wurzel, ordner) {
  const aus = [];
  const basis = resolve(wurzel, ordner);
  async function gehe(pfad) {
    let eintraege;
    try { eintraege = await readdir(pfad, { withFileTypes: true }); } catch { return; }
    for (const e of eintraege) {
      if (e.name.startsWith('.')) continue;
      const voll = join(pfad, e.name);
      if (e.isDirectory()) await gehe(voll);
      else if (e.isFile()) aus.push(relative(wurzel, voll).split(sep).join('/'));
    }
  }
  await gehe(basis);
  return aus.sort();
}

async function sha256(datei) {
  return createHash('sha256').update(await readFile(datei)).digest('hex');
}

/** Wurzel für einen Inhaltspfad: Spiele (Programmcode) immer aus `inhaltsWurzel`, Daten aus `datenWurzel`. */
export const wurzelFuer = (pfad, { inhaltsWurzel, datenWurzel = inhaltsWurzel }) => (/^(inhalte|assets\/spiele)(\/|$)/.test(pfad) ? datenWurzel : inhaltsWurzel);

/**
 * Lädt und prüft die Inhalte. `appWurzel` enthält `app/`, `inhaltsWurzel` enthält `spiele/` und den mitgelieferten
 * Inhalt (`inhalte/`, `assets/spiele/`; im Betrieb das Verzeichnis der Anwendung, in Tests ein Beispielordner).
 * `datenWurzel` ersetzt `inhalte/` und `assets/spiele/`, wenn ein Inhaltspaket aktiv ist (server/inhaltspaket.js).
 */
export async function ladeInhalte({ appWurzel, inhaltsWurzel, datenWurzel = inhaltsWurzel }) {
  const imInhalt = (pfad) => {
    const wurzel = wurzelFuer(pfad, { inhaltsWurzel, datenWurzel });
    const voll = resolve(wurzel, pfad);
    if (relative(wurzel, voll).startsWith('..')) throw new Error(`Pfad außerhalb: ${pfad}`);
    return voll;
  };
  const bericht = await pruefeInhalte({
    json: async (pfad) => JSON.parse(await readFile(imInhalt(pfad), 'utf8')),
    existiert: async (pfad) => { try { await access(imInhalt(pfad)); return true; } catch { return false; } },
  });

  let ablaeufe = [];
  try { ablaeufe = JSON.parse(await readFile(imInhalt('inhalte/ablaeufe.json'), 'utf8')).ablaeufe ?? []; } catch { /* optional */ }

  // Offline-Liste: alle Dateien der App und der Inhalte mit Größe und SHA-256
  const dateien = [];
  for (const seite of SEITEN) {
    const voll = resolve(appWurzel, 'app', seite);
    try { const s = await stat(voll); dateien.push({ pfad: seite, quelle: voll, groesse: s.size, sha256: await sha256(voll) }); } catch { /* fehlt in Tests */ }
  }
  for (const [wurzel, ordner] of [[appWurzel, OFFLINE_ORDNER.app], ...OFFLINE_ORDNER.inhalt.map((o) => [wurzelFuer(o, { inhaltsWurzel, datenWurzel }), [o]])]) {
    for (const o of ordner) {
      for (const pfad of await dateienIn(wurzel, o)) {
        if (AUSGESCHLOSSEN.test(pfad) || /\.html$/.test(pfad)) continue;
        const voll = resolve(wurzel, pfad);
        const s = await stat(voll);
        dateien.push({ pfad, quelle: voll, groesse: s.size, sha256: await sha256(voll) });
      }
    }
  }
  const version = createHash('sha256').update(dateien.map((d) => `${d.pfad}:${d.sha256}`).join('\n')).digest('hex').slice(0, 16);
  const inhaltVersion = createHash('sha256').update(dateien.filter((d) => !d.pfad.startsWith('app/') && !SEITEN.includes(d.pfad)).map((d) => `${d.pfad}:${d.sha256}`).join('\n')).digest('hex').slice(0, 16);

  // Größe je Ort: Dateien im Ortsordner und alle Bilder, auf die er verweist
  const groesse = new Map(dateien.map((d) => [d.pfad, d.groesse]));
  const jeOrt = {};
  for (const ort of bericht.orte) {
    const pfade = new Set(dateien.filter((d) => d.pfad.startsWith(`inhalte/${ort.id}/`)).map((d) => d.pfad));
    for (const p of [ort.bild, ort.ersatz?.bild]) if (p) pfade.add(p);
    for (const a of bericht.aufgaben.filter((x) => x.ort === ort.id)) {
      for (const p of JSON.stringify(a).match(/assets\/spiele\/[A-Za-z0-9_./-]+\.(svg|png|webp|jpg|jpeg|mp3|ogg)/g) ?? []) pfade.add(p);
    }
    jeOrt[ort.id] = [...pfade].reduce((s, p) => s + (groesse.get(p) ?? 0), 0);
  }

  return {
    ...bericht,
    ablaeufe,
    version,
    inhaltVersion,
    offlineListe: {
      version,
      gesamtBytes: dateien.reduce((s, d) => s + d.groesse, 0),
      jeOrtBytes: jeOrt,
      dateien: dateien.map(({ pfad, groesse: g, sha256: h }) => ({ pfad, groesse: g, sha256: h })),
    },
    quellen: new Map(dateien.map((d) => [d.pfad, d.quelle])),
    aufgabeNach: new Map(bericht.aufgaben.map((a) => [a.kennung, a])),
    ortNach: new Map(bericht.orte.map((o) => [o.id, o])),
    itemIds: new Set(bericht.items.map((i) => i.id)),
  };
}
