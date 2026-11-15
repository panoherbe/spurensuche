// Prüfung der Inhalte (Orte, Aufgaben, Sammelstücke) nach docs/SCHNITTSTELLE.md Abschnitt 3 und 4.
// Ohne Dateisystem: Wer prüft, übergibt einen `leser` (Node.js: tools/pruefe-inhalte.js, Browser: fetch).

import { pruefeSchema, ZWEITEXT } from './schema.js';

const KENNUNG = '^[a-z0-9-]{1,40}$';
const PFAD = '^assets/spiele/[A-Za-z0-9_./-]+\\.(svg|png|webp|jpg|jpeg)$';

export const STUFEN_IDS = ['einblick', 'kennen', 'anwenden', 'beurteilen', 'gestalten'];

export const ORTE_SCHEMA = {
  type: 'object',
  required: ['version', 'orte', 'finale'],
  additionalProperties: false,
  properties: {
    version: { type: 'integer', minimum: 1 },
    orte: { type: 'array', minItems: 1, maxItems: 30, items: { type: 'string', pattern: KENNUNG } },
    finale: { type: 'string', pattern: KENNUNG },
  },
};

export const ORT_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'region', 'lage', 'qr', 'text', 'bild', 'alt', 'bildQuelle', 'aufgaben', 'ersatz'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', pattern: KENNUNG },
    name: { type: 'string', minLength: 2, maxLength: 60 },
    region: { type: 'string', minLength: 2, maxLength: 60 },
    lage: {
      type: 'object',
      required: ['lat', 'lon'],
      additionalProperties: false,
      properties: {
        lat: { type: 'number', minimum: 50.1, maximum: 51.7 },
        lon: { type: 'number', minimum: 11.8, maximum: 15.1 },
        radius: { type: 'number', minimum: 50, maximum: 500 },
      },
    },
    qr: { type: 'string', pattern: '^[A-Z0-9-]{4,16}$' },
    text: ZWEITEXT,
    bild: { type: 'string', pattern: PFAD },
    alt: { type: 'string', minLength: 3, maxLength: 300 },
    bildQuelle: { type: 'string', minLength: 3, maxLength: 300 },
    aufgaben: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', pattern: KENNUNG } },
    ersatz: {
      type: 'object',
      required: ['text'],
      additionalProperties: false,
      properties: {
        text: ZWEITEXT,
        bild: { type: 'string', pattern: PFAD },
        alt: { type: 'string', minLength: 3, maxLength: 300 },
      },
    },
  },
};

/** Felder, die jede Aufgabe hat; die formatspezifischen prüft das Schema des Formats. */
export const AUFGABE_GEMEINSAM = {
  type: 'object',
  required: ['format', 'titel', 'text', 'dauerMinuten', 'belohnung', 'stufe'],
  properties: {
    format: { type: 'string', pattern: KENNUNG },
    titel: { type: 'string', minLength: 2, maxLength: 60 },
    text: ZWEITEXT,
    dauerMinuten: { type: 'number', minimum: 5, maximum: 10 },
    belohnung: { type: 'array', maxItems: 6, items: { type: 'string', pattern: KENNUNG } },
    stufe: { type: 'string', enum: STUFEN_IDS },
    rollen: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string', pattern: KENNUNG } },
    mischen: { type: 'integer', minimum: 0 },
    quelle: { type: 'string', maxLength: 300 },
  },
};

export const ITEMS_SCHEMA = {
  type: 'array',
  minItems: 1,
  items: {
    type: 'object',
    required: ['id', 'name', 'bild', 'alt', 'kategorie'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: KENNUNG },
      name: { type: 'string', minLength: 2, maxLength: 30 },
      bild: { type: 'string', pattern: PFAD },
      alt: { type: 'string', minLength: 3, maxLength: 300 },
      kategorie: { type: 'string', pattern: KENNUNG },
      quelle: { type: 'string', maxLength: 300 },
    },
  },
};

/**
 * Prüft alle Inhalte. `leser.json(pfad)` liefert das geparste JSON oder wirft; `leser.existiert(pfad)` sagt, ob
 * eine Datei da ist. Pfade sind relativ zur Wurzel des Repos (`inhalte/orte.json`, `spiele/quiz/schema.json`).
 * Ergebnis: `{ fehler: [{ datei, pfad, meldung }], orte, items, aufgaben }`.
 */
export async function pruefeInhalte(leser) {
  const fehler = [];
  const melde = (datei, liste) => { for (const f of liste) fehler.push({ datei, pfad: f.pfad ?? '/', meldung: f.meldung }); };
  const lies = async (datei) => {
    try { return await leser.json(datei); } catch (e) { fehler.push({ datei, pfad: '/', meldung: `nicht lesbar: ${e.message}` }); return null; }
  };

  const items = (await lies('inhalte/items.json')) ?? [];
  melde('inhalte/items.json', pruefeSchema(ITEMS_SCHEMA, items));
  const itemIds = new Set();
  for (const [i, item] of (Array.isArray(items) ? items : []).entries()) {
    if (itemIds.has(item.id)) fehler.push({ datei: 'inhalte/items.json', pfad: `/${i}/id`, meldung: `Kennung „${item.id}“ doppelt` });
    itemIds.add(item.id);
    if (item.bild && !(await leser.existiert(item.bild))) fehler.push({ datei: 'inhalte/items.json', pfad: `/${i}/bild`, meldung: `Bild ${item.bild} fehlt` });
  }

  const index = await lies('inhalte/orte.json');
  const orte = [];
  const aufgaben = [];
  if (index) {
    melde('inhalte/orte.json', pruefeSchema(ORTE_SCHEMA, index));
    if (Array.isArray(index.orte) && !index.orte.includes(index.finale)) {
      fehler.push({ datei: 'inhalte/orte.json', pfad: '/finale', meldung: `Finale „${index.finale}“ steht nicht in orte` });
    }
    const schemata = new Map();
    for (const id of Array.isArray(index.orte) ? index.orte : []) {
      const datei = `inhalte/${id}/ort.json`;
      const ort = await lies(datei);
      if (!ort) continue;
      melde(datei, pruefeSchema(ORT_SCHEMA, ort));
      if (ort.id !== id) fehler.push({ datei, pfad: '/id', meldung: `id „${ort.id}“ muss dem Ordner „${id}“ entsprechen` });
      for (const feld of ['bild']) if (ort[feld] && !(await leser.existiert(ort[feld]))) fehler.push({ datei, pfad: `/${feld}`, meldung: `Bild ${ort[feld]} fehlt` });
      if (ort.ersatz?.bild && !(await leser.existiert(ort.ersatz.bild))) fehler.push({ datei, pfad: '/ersatz/bild', meldung: `Bild ${ort.ersatz.bild} fehlt` });
      if (ort.ersatz?.bild && !ort.ersatz.alt) fehler.push({ datei, pfad: '/ersatz/alt', meldung: 'Alternativtext zum Ersatzbild fehlt' });
      orte.push(ort);
      for (const nr of Array.isArray(ort.aufgaben) ? ort.aufgaben : []) {
        const adatei = `inhalte/${id}/${nr}.json`;
        const aufgabe = await lies(adatei);
        if (!aufgabe) continue;
        melde(adatei, pruefeSchema(AUFGABE_GEMEINSAM, aufgabe));
        const format = aufgabe.format;
        if (typeof format === 'string') {
          if (!schemata.has(format)) {
            const schemaDatei = `spiele/${format}/schema.json`;
            const vorhanden = (await leser.existiert(`spiele/${format}/index.js`)) && (await leser.existiert(schemaDatei));
            schemata.set(format, vorhanden ? await lies(schemaDatei) : null);
            if (!vorhanden) fehler.push({ datei: adatei, pfad: '/format', meldung: `Format „${format}“ fehlt (spiele/${format}/index.js und schema.json)` });
          }
          const schema = schemata.get(format);
          if (schema) melde(adatei, pruefeSchema(schema, aufgabe));
        }
        for (const [i, b] of (Array.isArray(aufgabe.belohnung) ? aufgabe.belohnung : []).entries()) {
          if (!itemIds.has(b)) fehler.push({ datei: adatei, pfad: `/belohnung/${i}`, meldung: `Sammelstück „${b}“ steht nicht in inhalte/items.json` });
        }
        aufgaben.push({ kennung: `${id}/${nr}`, ort: id, nr, ...aufgabe });
      }
    }
  }
  return { fehler, orte, items: Array.isArray(items) ? items : [], aufgaben, finale: index?.finale ?? null };
}
