// Liste aller Dateien, die die Spiele offline brauchen (für den Service Worker der App), mit Größe und SHA-256.
//   node spiele/_werkzeuge/dateiliste.js  →  schreibt spiele/dateien.json
// Ohne Testseiten, Tests, Messlauf und Nachweise. Je Ort zusätzlich die Summe seiner Bilder.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const WURZEL = fileURLToPath(new URL('../../', import.meta.url));
const AUSLASSEN = /\/_(test|pruefung|vorschau|nachweis|werkzeuge)\/|\/(package\.json|README\.md|dateien\.json)$|\.DS_Store$/;

function sammle(ordner) {
  const dateien = [];
  for (const eintrag of readdirSync(join(WURZEL, ordner), { withFileTypes: true })) {
    const pfad = `${ordner}/${eintrag.name}`;
    if (eintrag.isDirectory()) dateien.push(...sammle(pfad));
    else if (!AUSLASSEN.test(`/${pfad}`)) dateien.push(pfad);
  }
  return dateien;
}

const liste = ['spiele', 'assets/spiele', 'inhalte'].flatMap(sammle).sort().map((pfad) => {
  const inhalt = readFileSync(join(WURZEL, pfad));
  return { pfad, bytes: statSync(join(WURZEL, pfad)).size, sha256: createHash('sha256').update(inhalt).digest('hex') };
});
const summe = (filter) => liste.filter((d) => filter(d.pfad)).reduce((s, d) => s + d.bytes, 0);
const orte = JSON.parse(readFileSync(join(WURZEL, 'inhalte/orte.json'), 'utf8')).orte;
const ergebnis = {
  beschreibung: 'Dateien der Spiele zum Vorhalten offline: spiele/ (ohne Test- und Prüfordner), assets/spiele/, inhalte/.',
  dateien: liste.length,
  bytes: summe(() => true),
  jeBereich: {
    code: summe((p) => p.startsWith('spiele/')),
    inhalte: summe((p) => p.startsWith('inhalte/')),
    sammelstuecke: summe((p) => p.startsWith('assets/spiele/items/') || p.startsWith('assets/spiele/vergleich/')),
    schrift: summe((p) => p.startsWith('assets/spiele/schrift/')),
    orte: Object.fromEntries(orte.map((ort) => [ort, summe((p) => p.startsWith(`assets/spiele/orte/${ort}/`) || p.startsWith(`inhalte/${ort}/`))])),
  },
  liste,
};
writeFileSync(join(WURZEL, 'spiele/dateien.json'), `${JSON.stringify(ergebnis, null, 2)}\n`);
console.log(`${liste.length} Dateien, ${(ergebnis.bytes / 1048576).toFixed(2)} MB → spiele/dateien.json`);
