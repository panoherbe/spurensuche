// Kleiner Prüfer für JSON-Schema (Teilmenge von Draft 2020-12), ohne Abhängigkeiten.
// Unterstützt: type, enum, const, required, properties, additionalProperties, items, prefixItems,
// minItems, maxItems, uniqueItems, minLength, maxLength, pattern, minimum, maximum, exclusiveMinimum,
// exclusiveMaximum, oneOf, anyOf, allOf, if/then, $ref auf "#/$defs/…". Meldungen auf Deutsch, mit Fundstelle.

const TYPNAMEN = {
  string: 'Text', number: 'Zahl', integer: 'ganze Zahl', boolean: 'ja/nein', object: 'Objekt', array: 'Liste', null: 'leer',
};

function typVon(wert) {
  if (wert === null) return 'null';
  if (Array.isArray(wert)) return 'array';
  if (Number.isInteger(wert)) return 'integer';
  return typeof wert;
}

function passtTyp(wert, typ) {
  const ist = typVon(wert);
  if (typ === 'number') return ist === 'number' || ist === 'integer';
  return ist === typ;
}

function aufloesen(wurzel, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Nur lokale Verweise werden unterstützt: ${ref}`);
  return ref.slice(2).split('/').reduce((knoten, teil) => knoten?.[teil.replace(/~1/g, '/').replace(/~0/g, '~')], wurzel);
}

const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function pruefe(schema, wert, pfad, wurzel, fehler) {
  if (schema === true || schema == null) return;
  if (schema === false) { fehler.push({ pfad, meldung: 'Hier ist kein Wert erlaubt' }); return; }
  if (schema.$ref) { pruefe(aufloesen(wurzel, schema.$ref), wert, pfad, wurzel, fehler); }

  if (schema.type) {
    const typen = [].concat(schema.type);
    if (!typen.some((t) => passtTyp(wert, t))) {
      fehler.push({ pfad, meldung: `Erwartet: ${typen.map((t) => TYPNAMEN[t] ?? t).join(' oder ')}` });
      return;
    }
  }
  if (schema.const !== undefined && !gleich(schema.const, wert)) fehler.push({ pfad, meldung: `Erwartet genau: ${JSON.stringify(schema.const)}` });
  if (schema.enum && !schema.enum.some((e) => gleich(e, wert))) fehler.push({ pfad, meldung: `Erlaubt sind: ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}` });

  if (typeof wert === 'string') {
    if (schema.minLength != null && [...wert].length < schema.minLength) fehler.push({ pfad, meldung: schema.minLength === 1 ? 'Darf nicht leer sein' : `Mindestens ${schema.minLength} Zeichen` });
    if (schema.maxLength != null && [...wert].length > schema.maxLength) fehler.push({ pfad, meldung: `Höchstens ${schema.maxLength} Zeichen (jetzt ${[...wert].length})` });
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(wert)) fehler.push({ pfad, meldung: schema.patternMeldung ?? `Passt nicht zum Muster ${schema.pattern}` });
  }
  if (typeof wert === 'number') {
    if (schema.minimum != null && wert < schema.minimum) fehler.push({ pfad, meldung: `Mindestens ${schema.minimum}` });
    if (schema.maximum != null && wert > schema.maximum) fehler.push({ pfad, meldung: `Höchstens ${schema.maximum}` });
    if (schema.exclusiveMinimum != null && wert <= schema.exclusiveMinimum) fehler.push({ pfad, meldung: `Größer als ${schema.exclusiveMinimum}` });
    if (schema.exclusiveMaximum != null && wert >= schema.exclusiveMaximum) fehler.push({ pfad, meldung: `Kleiner als ${schema.exclusiveMaximum}` });
  }
  if (Array.isArray(wert)) {
    if (schema.minItems != null && wert.length < schema.minItems) fehler.push({ pfad, meldung: `Mindestens ${schema.minItems} Einträge (jetzt ${wert.length})` });
    if (schema.maxItems != null && wert.length > schema.maxItems) fehler.push({ pfad, meldung: `Höchstens ${schema.maxItems} Einträge (jetzt ${wert.length})` });
    if (schema.uniqueItems) {
      const gesehen = new Set();
      wert.forEach((eintrag, i) => {
        const schluessel = JSON.stringify(eintrag);
        if (gesehen.has(schluessel)) fehler.push({ pfad: `${pfad}[${i}]`, meldung: 'Doppelter Eintrag' });
        gesehen.add(schluessel);
      });
    }
    const vorne = schema.prefixItems ?? [];
    wert.forEach((eintrag, i) => {
      if (i < vorne.length) pruefe(vorne[i], eintrag, `${pfad}[${i}]`, wurzel, fehler);
      else if (schema.items !== undefined) pruefe(schema.items, eintrag, `${pfad}[${i}]`, wurzel, fehler);
    });
  }
  if (wert && typeof wert === 'object' && !Array.isArray(wert)) {
    for (const name of schema.required ?? []) {
      if (!(name in wert)) fehler.push({ pfad: `${pfad}.${name}`, meldung: 'Pflichtfeld fehlt' });
    }
    const eigenschaften = schema.properties ?? {};
    for (const [name, inhalt] of Object.entries(wert)) {
      if (name in eigenschaften) pruefe(eigenschaften[name], inhalt, `${pfad}.${name}`, wurzel, fehler);
      else if (schema.additionalProperties === false) fehler.push({ pfad: `${pfad}.${name}`, meldung: 'Unbekanntes Feld' });
      else if (typeof schema.additionalProperties === 'object') pruefe(schema.additionalProperties, inhalt, `${pfad}.${name}`, wurzel, fehler);
    }
  }
  if (schema.allOf) schema.allOf.forEach((teil) => pruefe(teil, wert, pfad, wurzel, fehler));
  if (schema.anyOf) {
    const ok = schema.anyOf.some((teil) => { const f = []; pruefe(teil, wert, pfad, wurzel, f); return f.length === 0; });
    if (!ok) fehler.push({ pfad, meldung: schema.anyOfMeldung ?? 'Passt zu keiner der erlaubten Formen' });
  }
  if (schema.oneOf) {
    const passend = schema.oneOf.filter((teil) => { const f = []; pruefe(teil, wert, pfad, wurzel, f); return f.length === 0; }).length;
    if (passend !== 1) fehler.push({ pfad, meldung: passend === 0 ? (schema.oneOfMeldung ?? 'Passt zu keiner der erlaubten Formen') : 'Passt zu mehr als einer Form' });
  }
  if (schema.if) {
    const f = [];
    pruefe(schema.if, wert, pfad, wurzel, f);
    if (f.length === 0 && schema.then) pruefe(schema.then, wert, pfad, wurzel, fehler);
    if (f.length > 0 && schema.else) pruefe(schema.else, wert, pfad, wurzel, fehler);
  }
}

/** Prüft `daten` gegen `schema`. Liefert eine Liste { pfad, meldung }; leer heißt gültig. */
export function pruefeSchema(schema, daten, wurzelname = 'aufgabe') {
  const fehler = [];
  pruefe(schema, daten, wurzelname, schema, fehler);
  return fehler;
}

/** Fehlerliste als lesbarer Text, eine Zeile je Fehler. */
export const fehlerText = (fehler) => fehler.map((f) => `${f.pfad}: ${f.meldung}`).join('\n');
