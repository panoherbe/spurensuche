// Prüfung von JSON-Daten gegen eine Teilmenge von JSON Schema (Draft 2020-12), ohne Fremdbibliothek.
// Läuft im Browser und in Node.js. Unterstützt: type, properties, required, additionalProperties (false),
// items, minItems, maxItems, enum, const, minimum, maximum, minLength, maxLength, pattern, $ref (#/$defs/…),
// $defs, oneOf. Unbekannte Schlüsselwörter werden als Fehler gemeldet, damit niemand sich auf eine Prüfung
// verlässt, die gar nicht stattfindet.

const BESCHREIBEND = new Set(['$schema', '$id', '$comment', 'title', 'description', 'default', 'examples', '$defs']);
const PRUEFEND = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems',
  'enum', 'const', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', '$ref', 'oneOf']);

function typVon(wert) {
  if (wert === null) return 'null';
  if (Array.isArray(wert)) return 'array';
  if (typeof wert === 'number') return Number.isInteger(wert) ? 'integer' : 'number';
  return typeof wert;
}

function passtTyp(erwartet, wert) {
  const ist = typVon(wert);
  if (erwartet === 'number') return ist === 'number' || ist === 'integer';
  return ist === erwartet;
}

function gleich(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function aufloesen(ref, wurzel) {
  const m = /^#\/\$defs\/([A-Za-z0-9_-]+)$/.exec(ref);
  if (!m || !wurzel.$defs || !wurzel.$defs[m[1]]) return null;
  return wurzel.$defs[m[1]];
}

/**
 * Prüft `wert` gegen `schema`. Liefert eine Liste von Fehlern `{ pfad, meldung }`; leer heißt gültig.
 * `pfad` ist ein JSON-Pointer-ähnlicher Pfad wie `/text/einfach` oder `/antworten/2`.
 */
export function pruefeSchema(schema, wert, wurzel = schema, pfad = '') {
  const fehler = [];
  const melde = (meldung, p = pfad) => fehler.push({ pfad: p || '/', meldung });
  if (schema === true) return fehler;
  if (schema === false) { melde('hier ist kein Wert erlaubt'); return fehler; }
  if (typeof schema !== 'object' || schema === null) { melde('Schema ist kein Objekt'); return fehler; }

  for (const schluessel of Object.keys(schema)) {
    if (!BESCHREIBEND.has(schluessel) && !PRUEFEND.has(schluessel)) melde(`Schlüsselwort „${schluessel}“ wird nicht unterstützt`);
  }

  if (schema.$ref !== undefined) {
    const ziel = aufloesen(schema.$ref, wurzel);
    if (!ziel) melde(`Verweis ${schema.$ref} nicht gefunden`);
    else fehler.push(...pruefeSchema(ziel, wert, wurzel, pfad));
  }

  if (schema.type !== undefined) {
    const typen = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!typen.some((t) => passtTyp(t, wert))) {
      melde(`erwartet ${typen.join(' oder ')}, gefunden ${typVon(wert)}`);
      return fehler; // weitere Prüfungen wären hier nur Folgefehler
    }
  }

  if (schema.const !== undefined && !gleich(schema.const, wert)) melde(`muss ${JSON.stringify(schema.const)} sein`);
  if (schema.enum !== undefined && !schema.enum.some((e) => gleich(e, wert))) {
    melde(`muss einer dieser Werte sein: ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  }

  if (typeof wert === 'number') {
    if (schema.minimum !== undefined && wert < schema.minimum) melde(`muss mindestens ${schema.minimum} sein`);
    if (schema.maximum !== undefined && wert > schema.maximum) melde(`darf höchstens ${schema.maximum} sein`);
  }

  if (typeof wert === 'string') {
    const laenge = [...wert].length;
    if (schema.minLength !== undefined && laenge < schema.minLength) melde(`mindestens ${schema.minLength} Zeichen`);
    if (schema.maxLength !== undefined && laenge > schema.maxLength) melde(`höchstens ${schema.maxLength} Zeichen`);
    if (schema.pattern !== undefined) {
      let re = null;
      try { re = new RegExp(schema.pattern, 'u'); } catch { melde(`Muster ${schema.pattern} ist ungültig`); }
      if (re && !re.test(wert)) melde(`passt nicht zum Muster ${schema.pattern}`);
    }
  }

  if (Array.isArray(wert)) {
    if (schema.minItems !== undefined && wert.length < schema.minItems) melde(`mindestens ${schema.minItems} Einträge`);
    if (schema.maxItems !== undefined && wert.length > schema.maxItems) melde(`höchstens ${schema.maxItems} Einträge`);
    if (schema.items !== undefined) {
      wert.forEach((eintrag, i) => fehler.push(...pruefeSchema(schema.items, eintrag, wurzel, `${pfad}/${i}`)));
    }
  }

  if (wert && typeof wert === 'object' && !Array.isArray(wert)) {
    const eigenschaften = schema.properties ?? {};
    for (const name of schema.required ?? []) {
      if (!(name in wert)) melde(`Pflichtfeld „${name}“ fehlt`, `${pfad}/${name}`);
    }
    for (const [name, teil] of Object.entries(eigenschaften)) {
      if (name in wert) fehler.push(...pruefeSchema(teil, wert[name], wurzel, `${pfad}/${name}`));
    }
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(wert)) {
        if (!(name in eigenschaften)) melde(`Feld „${name}“ ist nicht vorgesehen`, `${pfad}/${name}`);
      }
    } else if (schema.additionalProperties !== undefined && schema.additionalProperties !== true) {
      melde('additionalProperties wird nur als false unterstützt');
    }
  }

  if (schema.oneOf !== undefined) {
    const treffer = schema.oneOf.filter((teil) => pruefeSchema(teil, wert, wurzel, pfad).length === 0).length;
    if (treffer !== 1) melde(treffer === 0 ? 'passt zu keiner der erlaubten Formen' : 'passt zu mehreren Formen zugleich');
  }

  return fehler;
}

/** Ein Zweitext: dieselbe Aussage in Standard- und einfacher Sprache. */
export const ZWEITEXT = {
  type: 'object',
  required: ['standard', 'einfach'],
  additionalProperties: false,
  properties: {
    standard: { type: 'string', minLength: 1, maxLength: 2000 },
    einfach: { type: 'string', minLength: 1, maxLength: 2000 },
  },
};
