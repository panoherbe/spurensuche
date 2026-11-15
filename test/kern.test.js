// Tests der gemeinsamen Bausteine (laufen in Node.js, dieselben Module laufen im Browser).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeSchema } from '../app/js/kern/schema.js';
import { bereinigeEreignisse, pruefeErgebnis, pruefeModul } from '../app/js/kern/ereignisse.js';
import { kompetenzraster, beobachtungen, formulierungsentwurf } from '../app/js/kern/raster.js';
import { PdfDokument, umbrechen } from '../app/js/kern/pdf.js';
import { zip, entpacke, crc32 } from '../app/js/kern/zip.js';
import { qrMatrix, qrSvg } from '../app/js/kern/qr.js';
import { loeschtermin, schuljahresende } from '../app/js/kern/zeit.js';
import { pruefeBezeichnung, freieVorschlaege } from '../app/js/kern/namen.js';

test('Schema: Typen, Pflichtfelder, Muster, Verweise, unbekannte Schlüsselwörter', () => {
  const schema = { type: 'object', required: ['a'], additionalProperties: false, properties: { a: { type: 'string', pattern: '^x+$' }, b: { $ref: '#/$defs/zahl' } }, $defs: { zahl: { type: 'integer', minimum: 1 } } };
  assert.deepEqual(pruefeSchema(schema, { a: 'xx', b: 2 }), []);
  const f = pruefeSchema(schema, { b: 0, c: 1 }).map((x) => x.meldung);
  assert.ok(f.some((m) => m.includes('Pflichtfeld „a“')));
  assert.ok(f.some((m) => m.includes('mindestens 1')));
  assert.ok(f.some((m) => m.includes('„c“ ist nicht vorgesehen')));
  assert.ok(pruefeSchema({ type: 'string', format: 'email' }, 'x').some((x) => x.meldung.includes('nicht unterstützt')));
  assert.equal(pruefeSchema({ oneOf: [{ type: 'string' }, { type: 'integer' }] }, 3).length, 0);
});

test('Ereignisse: nur erlaubte Arten und Werte, kein Freitext', () => {
  const { ereignisse, verworfen } = bereinigeEreignisse([
    { art: 'versuch', zeit: 10, wert: false },
    { art: 'versuch', zeit: 20, wert: 'Mein Name ist Lisa' },
    { art: 'hilfe', zeit: 30, wert: 1, name: 'Lisa' },
    { art: 'rolle', zeit: 40, wert: 'navigation' },
    { art: 'rolle', zeit: 41, wert: 'chef' },
    { art: 'standort', zeit: 50, wert: '51.05,13.73' },
    { art: 'abstimmung', zeit: 60, wert: 'einig' },
  ], { aufgabe: { rollen: ['navigation', 'protokoll'] } });
  assert.deepEqual(ereignisse, [{ art: 'versuch', zeit: 10, wert: false }, { art: 'hilfe', zeit: 30, wert: 1 }, { art: 'rolle', zeit: 40, wert: 'navigation' }, { art: 'abstimmung', zeit: 60, wert: 'einig' }]);
  assert.equal(verworfen.length, 3);
  assert.ok(!JSON.stringify(ereignisse).includes('Lisa'));
});

test('Ergebnis: Vertrag geprüft, Punkte nicht übernommen, Items nur aus der Belohnung', () => {
  const { fehler, ergebnis } = pruefeErgebnis({ geloest: true, punkte: 3, versuche: 2, dauerSekunden: 61.4, items: ['a', 'z'], ereignisse: [{ art: 'versuch', zeit: 1, wert: false }, { art: 'versuch', zeit: 2, wert: true }] }, { belohnung: ['a'] });
  assert.equal(ergebnis.punkte, undefined);
  assert.deepEqual(ergebnis.items, ['a']);
  assert.equal(ergebnis.versuche, 2);
  assert.equal(ergebnis.dauerSekunden, 61);
  assert.ok(fehler.some((f) => f.includes('„z“')));
  assert.deepEqual(pruefeModul({ meta: { id: 'x', titel: 'X', dauerMinuten: [5, 10], offline: true }, starte() {} }, 'x'), []);
  assert.ok(pruefeModul({ meta: { id: 'y', titel: 'X', dauerMinuten: [5], offline: false } }, 'x').length >= 3);
});

function beispielGruppe() {
  return {
    stationen: [{ ort: 'a', ortName: 'Ort A', status: 'abgeschlossen', verifikation: 'qr', begonnen: '2026-11-20T08:00:00Z', beendet: '2026-11-20T08:30:00Z', aktivSekunden: 1500 },
      { ort: 'b', ortName: 'Ort B', status: 'begonnen', verifikation: 'ersatz', begonnen: '2026-11-20T08:40:00Z', aktivSekunden: 300 }],
    laeufe: [
      { aufgabe: 'a/1', titel: 'Kennfrage', stufe: 'kennen', geloest: true, ereignisse: [{ art: 'versuch', zeit: 1, wert: true }] },
      { aufgabe: 'a/2', titel: 'Anwenden', stufe: 'anwenden', rollen: ['navigation', 'protokoll'], geloest: true, ereignisse: [
        { art: 'rolle', zeit: 1, wert: 'navigation' }, { art: 'versuch', zeit: 2, wert: false }, { art: 'neuer-anlauf', zeit: 3, wert: true },
        { art: 'rolle', zeit: 4, wert: 'protokoll' }, { art: 'versuch', zeit: 5, wert: true }] },
      { aufgabe: 'b/1', titel: 'Dilemma', stufe: 'beurteilen', geloest: true, ereignisse: [{ art: 'weg', zeit: 1, wert: 'wald' }, { art: 'weg', zeit: 2, wert: 'fluss' }, { art: 'abstimmung', zeit: 3, wert: 'einig' }, { art: 'versuch', zeit: 4, wert: true }] },
    ],
    technik: [{ art: 'offline', zeit: '2026-11-20T08:10:00Z' }, { art: 'sync', zeit: '2026-11-20T09:00:00Z' }],
    bildbeitrag: null,
  };
}

test('Kompetenzraster: Belege nach festen Regeln, Vorschlag, Einschätzung geht vor', () => {
  const r = kompetenzraster(beispielGruppe());
  const zeile = (b) => r.zeilen.find((z) => z.bereich === b);
  assert.equal(zeile('teamleistung').vorschlag, 'beurteilen');
  assert.equal(zeile('problemloesung').vorschlag, 'beurteilen');
  assert.equal(zeile('beteiligung').vorschlag, 'beurteilen');
  assert.ok(zeile('problemloesung').zellen.find((c) => c.stufe === 'anwenden').belege.some((b) => b.includes('Vorgehen gewechselt')));
  const mitWahl = kompetenzraster(beispielGruppe(), { problemloesung: 'kennen' });
  assert.equal(mitWahl.zeilen.find((z) => z.bereich === 'problemloesung').stufe, 'kennen');
  // keine Zahl als Gesamturteil: keine Prozent- oder Punktangaben im Raster
  assert.ok(!/%|Punkte/.test(JSON.stringify(r)));
});

test('Beobachtungen und Entwurf: beschreibend, als Entwurf gekennzeichnet', () => {
  const b = beobachtungen(beispielGruppe());
  assert.ok(b.teamleistung.saetze[0].startsWith('1 Station abgeschlossen'));
  assert.ok(b.problemloesung.saetze.some((s) => s.includes('Vorgehen gewechselt')));
  const e = formulierungsentwurf(kompetenzraster(beispielGruppe()), { gruppe: 'Biber', quest: 'Test', datum: '20.11.2026' });
  assert.ok(e.startsWith('Entwurf'));
  assert.ok(!/Note|Punkt/.test(e));
});

test('PDF: gültiger Aufbau mit Querverweistabelle, Umlaute', () => {
  const pdf = new PdfDokument({ titel: 'Prüfung äöü' });
  pdf.absatz('Grüße aus Dresden – „Zwinger“ und Größe ß €.', { groesse: 12 });
  for (let i = 0; i < 80; i++) pdf.absatz(`Zeile ${i}`);
  const bytes = pdf.alsBytes({ erstellt: new Date('2026-11-20T09:00:00Z') });
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.ok(pdf.seiten.length >= 2);
  const xref = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.equal(text.slice(xref, xref + 4), 'xref');
  const versatz = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  for (const [i, v] of versatz.entries()) assert.ok(text.slice(v).startsWith(`${i + 1} 0 obj`), `Objekt ${i + 1} an ${v}`);
  assert.ok(text.includes('\\344') || text.includes('\\374'), 'Umlaute als WinAnsi-Oktal');
  assert.ok(umbrechen('ein sehr langer Satz '.repeat(20), 200, 11).length > 3);
});

test('ZIP: Hin und zurück, CRC32 bekannt', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const bytes = zip([{ name: 'a.txt', inhalt: 'Hallo' }, { name: 'ordner/ü.json', inhalt: new Uint8Array([1, 2, 3]) }], { datum: new Date('2026-11-20T09:00:00Z') });
  const zurueck = entpacke(bytes);
  assert.equal(zurueck.length, 2);
  assert.equal(new TextDecoder().decode(zurueck[0].inhalt), 'Hallo');
  assert.equal(zurueck[1].name, 'ordner/ü.json');
  assert.deepEqual([...zurueck[1].inhalt], [1, 2, 3]);
});

test('QR: Größe je Version, Suchmarken, Zeitmuster', () => {
  const kurz = qrMatrix('NORD-1234');
  assert.equal(kurz.version, 1);
  assert.equal(kurz.matrix.length, 21);
  const lang = qrMatrix('https://spurensuche.example/index.html#/ort/basteibruecke?code=BASTEI-4F7K');
  assert.ok(lang.version >= 4 && lang.version <= 6);
  const m = lang.matrix;
  const n = m.length;
  assert.equal(n, lang.version * 4 + 17);
  // Suchmarke oben links: 7 × 7 mit dunklem Rand und dunklem 3 × 3-Kern
  for (let i = 0; i < 7; i++) { assert.ok(m[0][i] && m[6][i] && m[i][0] && m[i][6]); }
  assert.ok(m[3][3] && !m[1][1] && !m[5][5]);
  for (let i = 8; i < n - 8; i++) assert.equal(m[6][i], i % 2 === 0);
  assert.ok(m[n - 8][8], 'dunkles Modul');
  assert.ok(qrSvg('x').startsWith('<svg'));
});

test('Löschfristen: zwölf Wochen, spätestens Ende des Schuljahres', () => {
  assert.equal(loeschtermin({ begonnen: '2026-11-20T09:00:00Z', abgeschlossen: '2026-11-20T12:00:00Z' }), new Date(Date.parse('2026-11-20T12:00:00Z') + 84 * 86400000).toISOString());
  const spaet = loeschtermin({ begonnen: '2027-07-01T09:00:00Z', abgeschlossen: '2027-07-01T12:00:00Z' });
  assert.equal(spaet, schuljahresende('2027-07-01T09:00:00Z'));
  assert.ok(spaet.startsWith('2027-07-31'));
});

test('Gruppenbezeichnungen: Vorschläge ohne Hinweis, freie Namen mit Hinweis, Unzulässiges abgelehnt', () => {
  assert.equal(pruefeBezeichnung('Biber').hinweis, null);
  assert.ok(pruefeBezeichnung('Lisa').hinweis);
  assert.equal(pruefeBezeichnung('lisa@schule.de').ok, false);
  assert.equal(pruefeBezeichnung('').ok, false);
  assert.ok(!freieVorschlaege(['Biber']).Tiere.includes('Biber'));
});
