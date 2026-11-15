// Logik der Spiele, ohne Browser: node --test spiele/_test/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pruefeSchema } from '../_gemeinsam/schema.js';
import { neuesProtokoll, ereignisFehler, rollenZuordnung, sterne } from '../_gemeinsam/protokoll.js';
import { mische, mischeOhneFixpunkte, hash } from '../_gemeinsam/zufall.js';
import { text, grosseZahl, mitEinheit } from '../_gemeinsam/sprache.js';
import * as puzzle from '../bildpuzzle/logik.js';
import * as schaetzen from '../schaetzen/logik.js';
import * as dilemma from '../dilemma/logik.js';
import * as sortieren from '../sortieren/logik.js';
import * as suche from '../bildsuche/logik.js';
import { figurSvg, figurText, vollstaendig } from '../figur/index.js';
import { anordnen, einstellungen, REGLER } from '../collage/regeln.js';
import { bauePrompt } from '../collage/prompt.js';
import { readFileSync } from 'node:fs';

test('Zufall: gleicher Startwert, gleiche Reihenfolge; nie schon gelöst', () => {
  assert.deepEqual(mische([1, 2, 3, 4, 5], 'a'), mische([1, 2, 3, 4, 5], 'a'));
  assert.notDeepEqual(mische([1, 2, 3, 4, 5, 6, 7, 8], 'a'), mische([1, 2, 3, 4, 5, 6, 7, 8], 'b'));
  for (let n = 2; n <= 25; n++) {
    for (const start of [1, 42, 'x', 1851]) {
      const lage = mischeOhneFixpunkte(n, start, 1);
      assert.equal(lage.length, n);
      assert.deepEqual([...lage].sort((a, b) => a - b), [...Array(n).keys()]);
      assert.ok(lage.filter((w, i) => w === i).length <= 1, `n=${n}`);
    }
  }
  assert.equal(typeof hash('Bastei'), 'number');
});

test('Sprache: Zweitext, große Zahlen, Einheiten', () => {
  assert.equal(text({ standard: 'A', einfach: 'B' }, 'einfach'), 'B');
  assert.equal(text({ standard: 'A' }, 'einfach'), 'A');
  assert.equal(text('C', 'einfach'), 'C');
  assert.equal(grosseZahl(26000000, 'einfach'), '26 Millionen');
  assert.equal(grosseZahl(26000000, 'standard'), '26.000.000');
  assert.equal(grosseZahl(1.44, 'standard'), '1,44');
  assert.equal(mitEinheit(1, { eins: 'Ziegel', viele: 'Ziegel' }), '1 Ziegel');
});

test('Protokoll: nur erlaubte Arten und Werte, Zeit in ms seit Start, Ergebnis nach Vertrag', () => {
  let jetzt = 1000;
  const gemeldet = [];
  const p = neuesProtokoll({ melde: (e) => gemeldet.push(e), aufgabe: { rollen: ['vorlesen', 'navigation'] }, jetzt: () => jetzt });
  jetzt = 1500; p.versuch(false);
  jetzt = 1600; p.aktion(true);
  p.aktion(false); // zweite Aktion nach dem Fehlversuch: kein weiteres Ereignis
  p.hilfe(1);
  p.rolle('vorlesen');
  p.rolle('steuern'); // über die Zuordnung navigation → steuern
  p.rolle('pruefen'); // nicht in den Rollen der Aufgabe: kein Ereignis
  p.weg('schaetzrunde');
  p.abstimmung('einig');
  p.weg('Freitext mit Leerzeichen'); // keine Kennung: verworfen
  jetzt = 4000; p.versuch(true);
  const e = p.abschluss({ geloest: true, punkte: 2.6, items: ['felsturm'] });
  assert.deepEqual(e.ereignisse.map((x) => x.art), ['versuch', 'neuer-anlauf', 'hilfe', 'rolle', 'rolle', 'weg', 'abstimmung', 'versuch']);
  assert.deepEqual(e.ereignisse.find((x) => x.art === 'rolle' && x.wert === 'navigation')?.wert, 'navigation');
  assert.equal(e.ereignisse[0].zeit, 500);
  assert.equal(e.versuche, 2);
  assert.equal(e.punkte, 3);
  assert.equal(e.dauerSekunden, 3);
  assert.deepEqual(gemeldet[0], { art: 'versuch', wert: false }, 'melde bekommt { art, wert }');
  for (const ereignis of e.ereignisse) assert.equal(ereignisFehler(ereignis), null, JSON.stringify(ereignis));
  assert.deepEqual(p.abschluss({ geloest: false }), e, 'Abschluss ist endgültig');
});

test('Protokoll: Ereignisprüfung nach Schnittstelle 2.5', () => {
  assert.equal(ereignisFehler({ art: 'versuch', wert: true }), null);
  assert.ok(ereignisFehler({ art: 'versuch', wert: 'ja' }));
  assert.ok(ereignisFehler({ art: 'start', wert: null }), 'start meldet nur die App');
  assert.ok(ereignisFehler({ art: 'abstimmung', wert: 'alle' }));
  assert.equal(ereignisFehler({ art: 'hilfe', wert: 3 }), null);
  assert.ok(ereignisFehler({ art: 'rolle', wert: 'Anna' }), 'keine Namen');
  assert.deepEqual([...rollenZuordnung(['navigation', 'protokoll', 'recherche'])], [['steuern', 'navigation'], ['pruefen', 'protokoll'], ['nachschlagen', 'recherche']]);
  assert.equal(sterne({ geloest: true, versuche: 1, hilfen: 0 }), 3);
  assert.equal(sterne({ geloest: true, versuche: 3, hilfen: 1 }), 2);
  assert.equal(sterne({ geloest: true, versuche: 5, hilfen: 3 }), 1);
  assert.equal(sterne({ geloest: false, versuche: 1, hilfen: 0 }), 0);
});

test('Schema-Prüfer: Fundstelle und deutsche Meldung', () => {
  const schema = { type: 'object', required: ['a'], additionalProperties: false, properties: { a: { type: 'string', minLength: 1 }, b: { $ref: '#/$defs/n' } }, $defs: { n: { type: 'integer', minimum: 2 } } };
  assert.deepEqual(pruefeSchema(schema, { a: 'x', b: 3 }), []);
  const fehler = pruefeSchema(schema, { b: 1, c: true });
  assert.deepEqual(fehler.map((f) => f.pfad).sort(), ['aufgabe.a', 'aufgabe.b', 'aufgabe.c']);
  assert.ok(fehler.some((f) => f.meldung === 'Pflichtfeld fehlt'));
});

test('Bildpuzzle: Tauschen, Lösen, Hilfe legt Ecken zuerst', () => {
  let lage = puzzle.startlage(9, 1851);
  assert.ok(!puzzle.geloest(lage));
  let zuege = 0;
  while (!puzzle.geloest(lage)) {
    const [a, b] = puzzle.naechsterZug(lage, 3);
    lage = puzzle.tausche(lage, a, b);
    zuege += 1;
    assert.ok(zuege <= 9);
  }
  assert.equal(puzzle.richtigAnzahl(lage), 9);
  const erster = puzzle.naechsterZug([8, 1, 2, 3, 4, 5, 6, 7, 0], 3);
  assert.equal(erster[0], 0, 'Ecke zuerst');
  assert.equal(puzzle.nachbar(0, 'links', 3, 9), 0);
  assert.equal(puzzle.nachbar(4, 'runter', 3, 9), 7);
});

test('Schätzfrage: Regler linear und logarithmisch, Bewertung, Richtung', () => {
  const linear = { min: 0, max: 500, schritt: 5 };
  assert.equal(schaetzen.reglerZuWert(0, linear), 0);
  assert.equal(schaetzen.reglerZuWert(1000, linear), 500);
  assert.equal(schaetzen.reglerZuWert(schaetzen.wertZuRegler(190, linear), linear), 190);
  const log = { min: 1000, max: 1e9, schritt: 1 };
  assert.equal(schaetzen.reglerZuWert(0, log, 'log'), 1000);
  assert.equal(schaetzen.reglerZuWert(1000, log, 'log'), 1e9);
  const mitte = schaetzen.reglerZuWert(500, log, 'log');
  assert.ok(mitte > 9e5 && mitte < 1.1e6, `Mitte ${mitte}`);
  assert.ok(schaetzen.schrittWert(26e6, 1, log, 'log') > 26e6);
  assert.equal(schaetzen.leseZahl('26.000.000'), 26e6);
  assert.equal(schaetzen.leseZahl('1,44'), 1.44);
  assert.equal(schaetzen.leseZahl('abc'), null);
  assert.deepEqual(schaetzen.bewerte(195, 190).sterne, 3);
  assert.equal(schaetzen.bewerte(230, 190).sterne, 2);
  assert.equal(schaetzen.bewerte(500, 190).richtig, false);
  assert.equal(schaetzen.bewerte(500, 190).richtung, 'zu-hoch');
  assert.equal(schaetzen.bewerte(22e6, 26e6, 'log').sterne, 3);
  assert.equal(schaetzen.bewerte(20e6, 26e6, 'log').sterne, 2);
  assert.equal(schaetzen.bewerte(1e6, 26e6, 'log').richtig, false);
  assert.equal(schaetzen.mitte([10, 300, 120]), 120);
  assert.equal(schaetzen.inRichtigeRichtung(500, 300, 190), true);
  assert.equal(schaetzen.inRichtigeRichtung(500, 500, 190), false);
});

test('Dilemma: Auszählen, Gleichstand, Begründung passend oder nicht', () => {
  assert.deepEqual(dilemma.auszaehlen({ a: 3, b: 0 }), { gesamt: 3, gewinner: 'a', art: 'einig', gleichstand: false });
  assert.equal(dilemma.auszaehlen({ a: 2, b: 1 }).art, 'mehrheit');
  assert.equal(dilemma.auszaehlen({ a: 2, b: 2 }).gleichstand, true);
  assert.equal(dilemma.auszaehlen({ a: 0, b: 0 }).gewinner, null);
  const argumente = [{ id: 'x', fuer: 'a' }, { id: 'y', fuer: 'b' }];
  assert.equal(dilemma.pruefeBegruendung(['x'], argumente, 'a').gueltig, true);
  assert.deepEqual(dilemma.pruefeBegruendung(['x', 'y'], argumente, 'a').unpassend, ['y']);
  assert.equal(dilemma.dilemmaSterne({ begruendet: true, gegenseite: true }), 3);
});

test('Sortieren: Reihe verschieben und prüfen; Gruppen zuordnen', () => {
  const karten = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  let reihe = sortieren.startreihe(karten, 1743);
  assert.notDeepEqual(reihe, ['a', 'b', 'c', 'd']);
  while (sortieren.pruefeReihe(reihe, ['a', 'b', 'c', 'd']).some((x) => !x)) {
    const [von, nach] = sortieren.naechsteKarte(reihe, ['a', 'b', 'c', 'd']);
    reihe = sortieren.setze(reihe, von, nach);
  }
  assert.deepEqual(reihe, ['a', 'b', 'c', 'd']);
  assert.deepEqual(sortieren.verschiebe(['a', 'b'], 0, -1), ['a', 'b']);
  const g = [{ id: 'k1', gruppe: 'g1' }, { id: 'k2', gruppe: 'g2' }];
  const stand = sortieren.pruefeGruppen({ k1: 'g1', k2: null }, g);
  assert.deepEqual([stand.richtig, stand.offen, stand.geloest], [1, 1, false]);
  assert.deepEqual(sortieren.naechsteZuordnung({ k1: 'g1', k2: 'g1' }, g), ['k2', 'g2']);
});

test('Bildsuche: Treffer mit Toleranz, Felder, Lage in Worten', () => {
  const b = [{ x: 0.5, y: 0.1, b: 0.05, h: 0.05 }];
  assert.ok(suche.trifft(0.52, 0.12, b));
  assert.ok(suche.trifft(0.49, 0.09, b), 'Toleranz');
  assert.ok(!suche.trifft(0.3, 0.5, b));
  assert.ok(suche.feldTrifft(2, 0, 4, 6, b));
  assert.ok(!suche.feldTrifft(0, 5, 4, 6, b));
  assert.equal(suche.lageInWorten(0.5, 0.1), 'oben in der Mitte');
  assert.equal(suche.lageInWorten(0.9, 0.9), 'unten rechts');
  assert.ok(suche.anderswo({ x: 0, y: 0 }, { x: 0.5, y: 0.5 }));
});

test('Collage-Regeln: wiederholbar, im Rahmen, Größe nach Anzahl', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
  for (const r of REGLER.find((x) => x.id === 'anordnung').werte) {
    for (const n of [1, 2, 5, 9, 12]) {
      const o = { anordnung: r.id, groesse: 'gross', farbstimmung: 'nacht' };
      const a = anordnen(ids.slice(0, n), o);
      assert.deepEqual(a, anordnen(ids.slice(0, n), o), `${r.id} ${n}: gleich bei gleicher Eingabe`);
      assert.equal(a.length, n);
      for (const p of a) {
        assert.ok(p.x - p.groesse / 2 >= 0.07 && p.x + p.groesse / 2 <= 0.93, `${r.id} ${n}: x im Rahmen`);
        assert.ok(p.y - p.groesse / 2 >= 0.07 && p.y + p.groesse / 2 <= 0.93, `${r.id} ${n}: y im Rahmen`);
      }
    }
  }
  assert.deepEqual(einstellungen({ anordnung: 'quatsch' }), { anordnung: 'kreis', groesse: 'mittel', farbstimmung: 'sommer' });
});

test('Figur: jede Option zeichnet sich, Text beschreibt sie, unbekannte Werte fallen zurück', () => {
  const katalog = JSON.parse(readFileSync(new URL('../../inhalte/figur.json', import.meta.url), 'utf8'));
  let anzahl = 0;
  for (const gruppe of katalog.gruppen) {
    for (const option of gruppe.optionen) {
      const svg = figurSvg({ [gruppe.id]: option.id }, katalog);
      assert.match(svg, /^<svg[^>]+viewBox="0 0 240 320"/);
      assert.doesNotMatch(svg, /undefined|NaN/, `${gruppe.id}=${option.id}`);
      if (option.farbe) assert.match(option.farbe, /^#[0-9A-Fa-f]{6}$/);
      anzahl += 1;
    }
  }
  assert.ok(anzahl >= 50);
  assert.equal(vollstaendig({ frisur: '<script>' }, katalog).frisur, katalog.standard.frisur);
  assert.match(figurText({ begleiter: 'dackel' }, katalog), /Begleiter: Dackel/);
});

test('Prompt-Baukasten (Vorschau Option 1): nur geprüfte Bausteine, kein Freitext', () => {
  const bausteine = JSON.parse(readFileSync(new URL('../../inhalte/prompt-bausteine.json', import.meta.url), 'utf8'));
  const p = bauePrompt(['kuppel', 'dampflok', '<script>'], { anordnung: 'wirbel', farbstimmung: 'nacht' }, bausteine);
  assert.deepEqual(p.items, ['kuppel', 'dampflok']);
  assert.match(p.de, /Kirchenkuppel/);
  assert.match(p.de, /Sternenhimmel/);
  assert.match(p.en, /no people/);
  assert.doesNotMatch(p.de + p.en, /script/);
  const items = JSON.parse(readFileSync(new URL('../../inhalte/items.json', import.meta.url), 'utf8'));
  for (const item of items) assert.ok(bausteine.items[item.id], `Baustein für ${item.id} fehlt`);
});
