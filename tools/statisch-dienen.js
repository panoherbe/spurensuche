#!/usr/bin/env node
// Kleiner Server für die gebaute Vorführung (Tests und Aufnahmen): liefert einen Ordner unter einem Unterpfad aus,
// mit denselben Sicherheits-Kopfzeilen wie der Server. Aufruf: node tools/statisch-dienen.js <ordner> [port] [unterpfad]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';
import { kopfzeilen } from '../server/sicherheit.js';

const ordner = resolve(process.argv[2] ?? 'export/vorfuehrung');
const port = Number(process.argv[3] ?? 8090);
const unterpfad = (process.argv[4] ?? '/').replace(/\/?$/, '/');
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
const kopf = kopfzeilen();

createServer(async (req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!pfad.startsWith(unterpfad)) { res.writeHead(302, { Location: unterpfad }); res.end(); return; }
  let rel = pfad.slice(unterpfad.length) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const datei = resolve(ordner, rel);
  if (relative(ordner, datei).startsWith('..')) { res.writeHead(404); res.end(); return; }
  try {
    if (!(await stat(datei)).isFile()) throw new Error('kein');
    res.writeHead(200, { ...kopf, 'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(datei));
  } catch {
    res.writeHead(404, { ...kopf, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  }
}).listen(port, '0.0.0.0', () => console.log(`Vorführung aus ${ordner} auf Port ${port}, Pfad ${unterpfad}`));
