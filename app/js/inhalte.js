// Inhalte im Browser: Orte, Aufgaben, Sammelstücke, Abläufe. Offline liefert der Service Worker dieselben Dateien.

const basis = () => new URL('./', document.baseURI);
export const url = (pfad) => new URL(String(pfad).replace(/^\//, ''), basis()).href;

let geladen = null;
const aufgabenCache = new Map();

async function json(pfad) {
  const r = await fetch(url(pfad), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
  return r.json();
}

/** Lädt Orte, Sammelstücke und Abläufe einmal und hält sie im Speicher. */
export function ladeInhalte() {
  if (!geladen) {
    geladen = (async () => {
      const index = await json('inhalte/orte.json');
      const [orte, items, ablaeufe] = await Promise.all([
        Promise.all(index.orte.map((id) => json(`inhalte/${id}/ort.json`))),
        json('inhalte/items.json'),
        json('inhalte/ablaeufe.json').then((a) => a.ablaeufe ?? []).catch(() => []),
      ]);
      return {
        orte, finale: index.finale, items, ablaeufe,
        ortNach: new Map(orte.map((o) => [o.id, o])),
        itemNach: new Map(items.map((i) => [i.id, i])),
      };
    })();
    geladen.catch(() => { geladen = null; });
  }
  return geladen;
}

/** Eine Aufgabe `<ort>/<nr>`. */
export async function aufgabe(kennung) {
  if (!aufgabenCache.has(kennung)) {
    const [ort, nr] = kennung.split('/');
    aufgabenCache.set(kennung, json(`inhalte/${ort}/${nr}.json`).then((a) => ({ ...a, kennung, ort, nr })));
    aufgabenCache.get(kennung).catch(() => aufgabenCache.delete(kennung));
  }
  return aufgabenCache.get(kennung);
}

/** Die Aufgabe so, wie sie in der Datei steht (ohne die Felder, die die App ergänzt), für die Spielmodule. */
export function alsDatei(aufgabe) {
  const { kennung, ort, nr, ...datei } = aufgabe;
  return datei;
}

/** Alle Aufgaben eines Orts (für Dauer und Belohnungen). */
export async function aufgabenVon(ort, auswahl = null) {
  const nrn = auswahl ?? ort.aufgaben;
  return Promise.all(nrn.map((nr) => aufgabe(`${ort.id}/${nr}`)));
}
