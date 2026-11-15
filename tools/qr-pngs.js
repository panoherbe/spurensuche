#!/usr/bin/env node
// Schreibt QR-Codes als PNG (für die Gegenprobe mit einem fremden Decoder, z. B. zbarimg) und die erwarteten Texte.
// Aufruf: node tools/qr-pngs.js <ordner> [basis-url]
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { qrMatrix } from '../app/js/kern/qr.js';
import { crc32 } from '../app/js/kern/zip.js';

const ordner = process.argv[2] ?? 'nachweis/tmp/qr';
const basis = process.argv[3] ?? 'https://spurensuche.example.org/';
mkdirSync(ordner, { recursive: true });

function png(matrix, modul = 8) {
  const n = matrix.length + 8;
  const breite = n * modul;
  const zeilen = [];
  for (let y = 0; y < breite; y++) {
    const z = Buffer.alloc(breite + 1, 255);
    z[0] = 0;
    const my = Math.floor(y / modul) - 4;
    for (let x = 0; x < breite; x++) {
      const mx = Math.floor(x / modul) - 4;
      if (my >= 0 && mx >= 0 && my < matrix.length && mx < matrix.length && matrix[my][mx]) z[x + 1] = 0;
    }
    zeilen.push(z);
  }
  const chunk = (typ, daten) => { const l = Buffer.alloc(4); l.writeUInt32BE(daten.length); const td = Buffer.concat([Buffer.from(typ), daten]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(breite, 0); ihdr.writeUInt32BE(breite, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(zeilen))), chunk('IEND', Buffer.alloc(0))]);
}

const texte = ['NORD-1234', 'K7QH-M3PZ', `${basis}index.html#/beitritt?code=K7QH-M3PZ`];
for (let laenge = 10; laenge <= 168; laenge += 17) texte.push(`${basis}#/` + 'x'.repeat(laenge)); // Versionen 1 bis 10
if (existsSync('inhalte/orte.json')) {
  for (const id of JSON.parse(readFileSync('inhalte/orte.json', 'utf8')).orte) {
    const ort = JSON.parse(readFileSync(`inhalte/${id}/ort.json`, 'utf8'));
    texte.push(`${basis}#/ort/${ort.id}?code=${encodeURIComponent(ort.qr)}`);
  }
}
const erwartet = texte.map((text, i) => {
  const { matrix, version, maske } = qrMatrix(text);
  const datei = `qr-${String(i).padStart(2, '0')}.png`;
  writeFileSync(join(ordner, datei), png(matrix));
  return { datei, text, version, maske };
});
writeFileSync(join(ordner, 'erwartet.json'), JSON.stringify(erwartet, null, 2));
console.log(`${erwartet.length} QR-Codes, Versionen ${[...new Set(erwartet.map((e) => e.version))].sort((a, b) => a - b).join(', ')}, Masken ${[...new Set(erwartet.map((e) => e.maske))].sort().join(', ')}`);
