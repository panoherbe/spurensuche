// Archiv- und Übergabepaket nach BagIt 1.0 (RFC 8493) in einer ZIP-Datei: offener Standard, jede Datei mit
// SHA-256 im Manifest, prüfbar ohne diese Software (z. B. mit bagit-python oder `sha256sum -c`).
//
// Umfang „archiv“: Inhalte (Orte, Aufgaben, Spiele, Bilder), Konfiguration ohne Geheimnisse, freigegebene
// Bildbeiträge mit Metadaten. Das ist der Teil, der übergeben und archiviert wird; er enthält keine
// personenbezogenen Daten.
// Umfang „vollstaendig“: zusätzlich Lerngruppen, Freigaben, Gruppen und Beobachtungen als JSON und CSV, für die
// Einsicht bei einer Übergabe. Gruppendaten werden nicht in eine neue Instanz übernommen, sondern nach der
// Übergabe gelöscht (kurze Aufbewahrung, docs/DATENSCHUTZ.md).

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { zip, entpacke } from '../app/js/kern/zip.js';

const WURZEL = 'spurensuche-archiv';
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const enc = new TextEncoder();

function csv(zeilen, spalten) {
  const feld = (v) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${spalten.join(',')}\n${zeilen.map((z) => spalten.map((s) => feld(z[s])).join(',')).join('\n')}\n`;
}

const LIESMICH = `Spurensuche – Archiv- und Übergabepaket
=========================================

Format: BagIt 1.0 (RFC 8493). Jede Datei unter data/ steht mit ihrer SHA-256-Prüfsumme in manifest-sha256.txt.
Prüfen ohne diese Software: im entpackten Ordner „sha256sum -c manifest-sha256.txt“.

data/konfiguration.json      Version der Anwendung, Version der Inhalte, Einstellungen (ohne Geheimnisse)
data/inhaltspaket/           Orte, Aufgaben (JSON), Spiele (JavaScript), Bilder – wie im Repository
data/bildbeitraege/index.json  freigegebene Bildbeiträge: kennung, erstellt (ISO 8601), art, items, datei, vorschau
data/bildbeitraege/index.csv   dieselben Angaben als CSV (UTF-8, Komma)
data/bildbeitraege/<kennung>.png            Bild, 2048 × 2048 px, verlustfrei
data/bildbeitraege/<kennung>-vorschau.*     Vorschau, höchstens 512 × 512 px (WebP oder JPEG)

Nur im Umfang „vollständig“:
data/gruppen/*.json, *.csv   Lerngruppen, Freigaben, Gruppen, Stationen, Aufgabenläufe, Rückmeldungen.
                             Es gibt keine Daten einzelner Personen; Bezugspunkt ist die Gruppenbezeichnung.

Lizenzen: Inhalte und Bilder CC BY-SA 4.0, Programmcode AGPL-3.0-only (siehe data/inhaltspaket).
`;

/** Erzeugt das Paket. `inhalte` ist das Ergebnis von ladeInhalte(), `einstellungen` ein flaches Objekt. */
export async function erstelleArchiv({ db, inhalte, umfang = 'archiv', version, einstellungen = {}, jetzt = new Date() }) {
  const nutzlast = [];
  const lege = (pfad, inhalt) => nutzlast.push({ pfad: `data/${pfad}`, inhalt: typeof inhalt === 'string' ? enc.encode(inhalt) : new Uint8Array(inhalt) });

  lege('LIESMICH.txt', LIESMICH);
  lege('konfiguration.json', JSON.stringify({ anwendung: 'spurensuche', version, inhaltVersion: inhalte.inhaltVersion, umfang, einstellungen }, null, 2));
  for (const [pfad, quelle] of [...inhalte.quellen].sort(([a], [b]) => a.localeCompare(b))) {
    if (/^(inhalte|spiele|assets\/spiele)\//.test(pfad)) lege(`inhaltspaket/${pfad}`, await readFile(quelle));
  }

  const bilder = db.prepare("SELECT kennung, herkunft, art, items, erstellt, entschieden, png, png_sha256, vorschau, vorschau_typ FROM bildbeitrag WHERE status = 'freigegeben' ORDER BY erstellt, kennung").all();
  const index = bilder.map((b) => {
    const endung = b.vorschau_typ === 'image/webp' ? 'webp' : 'jpg';
    lege(`bildbeitraege/${b.kennung}.png`, b.png);
    lege(`bildbeitraege/${b.kennung}-vorschau.${endung}`, b.vorschau);
    return { kennung: b.kennung, erstellt: b.erstellt, freigegeben: b.entschieden, art: b.art, herkunft: b.herkunft, items: JSON.parse(b.items), datei: `${b.kennung}.png`, vorschau: `${b.kennung}-vorschau.${endung}`, sha256: b.png_sha256 };
  });
  lege('bildbeitraege/index.json', JSON.stringify(index, null, 2));
  lege('bildbeitraege/index.csv', csv(index.map((i) => ({ ...i, items: i.items.join(' ') })), ['kennung', 'erstellt', 'freigegeben', 'art', 'herkunft', 'items', 'datei', 'vorschau', 'sha256']));

  if (umfang === 'vollstaendig') {
    const tabellen = {
      lerngruppen: ['SELECT id, bezeichnung, klassenstufe, einwilligung_am, erstellt, loeschen_am FROM lerngruppe ORDER BY erstellt, id', ['id', 'bezeichnung', 'klassenstufe', 'einwilligung_am', 'erstellt', 'loeschen_am']],
      freigaben: ['SELECT id, lerngruppe_id, titel, zeitrahmen, orte, erfassung, rueckmeldung, inhalt_version, erstellt, beendet, loeschen_am FROM freigabe ORDER BY erstellt, id', ['id', 'lerngruppe_id', 'titel', 'zeitrahmen', 'orte', 'erfassung', 'rueckmeldung', 'inhalt_version', 'erstellt', 'beendet', 'loeschen_am']],
      gruppen: ['SELECT id, freigabe_id, bezeichnung, einschaetzung, erstellt, letzte_sync FROM gruppe ORDER BY erstellt, id', ['id', 'freigabe_id', 'bezeichnung', 'einschaetzung', 'erstellt', 'letzte_sync']],
      stationen: ['SELECT gruppe_id, ort, status, verifikation, begonnen, beendet, aktiv_sekunden FROM station ORDER BY gruppe_id, ort', ['gruppe_id', 'ort', 'status', 'verifikation', 'begonnen', 'beendet', 'aktiv_sekunden']],
      laeufe: ['SELECT id, gruppe_id, aufgabe, geloest, versuche, dauer_sekunden, items, ereignisse, beendet FROM lauf ORDER BY beendet, id', ['id', 'gruppe_id', 'aufgabe', 'geloest', 'versuche', 'dauer_sekunden', 'items', 'ereignisse', 'beendet']],
      rueckmeldungen: ['SELECT id, freigabe_id, aufgabe, verstaendlich, spass, schwierigkeit, stand, zeit FROM rueckmeldung ORDER BY zeit, id', ['id', 'freigabe_id', 'aufgabe', 'verstaendlich', 'spass', 'schwierigkeit', 'stand', 'zeit']],
    };
    for (const [name, [sql, spalten]] of Object.entries(tabellen)) {
      const zeilen = db.prepare(sql).all();
      lege(`gruppen/${name}.json`, JSON.stringify(zeilen, null, 2));
      lege(`gruppen/${name}.csv`, csv(zeilen, spalten));
    }
  }

  const manifest = nutzlast.map((d) => `${sha256(d.inhalt)}  ${d.pfad}`).join('\n') + '\n';
  const bytes = nutzlast.reduce((s, d) => s + d.inhalt.length, 0);
  const bagit = 'BagIt-Version: 1.0\nTag-File-Character-Encoding: UTF-8\n';
  const info = [
    'Source-Organization: Betreiber der Instanz',
    `Bagging-Date: ${jetzt.toISOString().slice(0, 10)}`,
    `Payload-Oxum: ${bytes}.${nutzlast.length}`,
    `Bag-Software-Agent: spurensuche ${version}`,
    `External-Description: Spurensuche, Umfang ${umfang}`,
  ].join('\n') + '\n';
  const tag = [['bagit.txt', bagit], ['bag-info.txt', info], ['manifest-sha256.txt', manifest]];
  const tagmanifest = tag.map(([n, t]) => `${sha256(enc.encode(t))}  ${n}`).join('\n') + '\n';
  const dateien = [
    ...tag.map(([n, t]) => ({ name: `${WURZEL}/${n}`, inhalt: t })),
    { name: `${WURZEL}/tagmanifest-sha256.txt`, inhalt: tagmanifest },
    ...nutzlast.map((d) => ({ name: `${WURZEL}/${d.pfad}`, inhalt: d.inhalt })),
  ];
  return { zip: zip(dateien, { datum: jetzt }), dateien: nutzlast.length, bytes, bildbeitraege: index.length, manifest };
}

/** Prüft ein Paket: BagIt-Erklärung, jede Prüfsumme, Payload-Oxum. Liefert `{ ok, fehler, nutzlast, manifest }`. */
export function pruefeArchiv(zipBytes) {
  const fehler = [];
  let eintraege;
  try { eintraege = entpacke(zipBytes); } catch (e) { return { ok: false, fehler: [e.message], nutzlast: [] }; }
  const nach = new Map(eintraege.map((e) => [e.name.replace(/^[^/]+\//, ''), e.inhalt]));
  const text = (n) => (nach.has(n) ? new TextDecoder().decode(nach.get(n)) : null);
  if (!/^BagIt-Version: 1\.0$/m.test(text('bagit.txt') ?? '')) fehler.push('bagit.txt fehlt oder ist keine Version 1.0');
  const manifest = text('manifest-sha256.txt') ?? '';
  if (!manifest) fehler.push('manifest-sha256.txt fehlt');
  const nutzlast = [];
  for (const zeile of manifest.split('\n').filter(Boolean)) {
    const m = /^([0-9a-f]{64})\s+(data\/.+)$/.exec(zeile);
    if (!m) { fehler.push(`Manifestzeile unlesbar: ${zeile}`); continue; }
    const inhalt = nach.get(m[2]);
    if (!inhalt) { fehler.push(`${m[2]} fehlt`); continue; }
    if (sha256(inhalt) !== m[1]) fehler.push(`${m[2]}: Prüfsumme stimmt nicht`);
    nutzlast.push({ pfad: m[2], inhalt, sha256: m[1] });
  }
  const imPaket = [...nach.keys()].filter((n) => n.startsWith('data/'));
  for (const n of imPaket) if (!nutzlast.some((d) => d.pfad === n)) fehler.push(`${n} steht nicht im Manifest`);
  const oxum = /Payload-Oxum: (\d+)\.(\d+)/.exec(text('bag-info.txt') ?? '');
  if (oxum) {
    const bytes = nutzlast.reduce((s, d) => s + d.inhalt.length, 0);
    if (Number(oxum[1]) !== bytes || Number(oxum[2]) !== nutzlast.length) fehler.push('Payload-Oxum stimmt nicht');
  } else fehler.push('Payload-Oxum fehlt');
  for (const zeile of (text('tagmanifest-sha256.txt') ?? '').split('\n').filter(Boolean)) {
    const [h, n] = zeile.split(/\s+/);
    if (nach.has(n) && sha256(nach.get(n)) !== h) fehler.push(`${n}: Prüfsumme im Tag-Manifest stimmt nicht`);
  }
  return { ok: fehler.length === 0, fehler, nutzlast, manifest };
}

async function istLeer(ordner) {
  try { return (await readdir(ordner)).filter((n) => !n.startsWith('.')).length === 0; } catch { return true; }
}

/**
 * Übernimmt ein Paket (Umfang „archiv“) in eine leere Instanz: Inhaltsdateien nach `zielWurzel`, freigegebene
 * Bildbeiträge in die Datenbank. Bricht ab, wenn die Instanz nicht leer ist oder eine Prüfsumme nicht stimmt.
 */
export async function importiereArchiv({ db, zielWurzel, zipBytes, jetzt = new Date() }) {
  const p = pruefeArchiv(zipBytes);
  if (!p.ok) throw new Error(`Paket fehlerhaft: ${p.fehler.slice(0, 5).join('; ')}`);
  for (const o of ['inhalte', 'spiele', 'assets/spiele']) {
    if (!(await istLeer(resolve(zielWurzel, o)))) throw new Error(`Ziel ist nicht leer: ${o}/`);
  }
  if (db.prepare('SELECT count(*) AS n FROM bildbeitrag').get().n > 0) throw new Error('Die Datenbank enthält schon Bildbeiträge');

  let dateien = 0;
  for (const d of p.nutzlast.filter((x) => x.pfad.startsWith('data/inhaltspaket/'))) {
    const rel = d.pfad.slice('data/inhaltspaket/'.length);
    const ziel = resolve(zielWurzel, rel);
    if (relative(zielWurzel, ziel).startsWith('..')) throw new Error(`Pfad außerhalb des Ziels: ${rel}`);
    await mkdir(dirname(ziel), { recursive: true });
    await writeFile(ziel, d.inhalt);
    dateien++;
  }
  const index = JSON.parse(new TextDecoder().decode(p.nutzlast.find((d) => d.pfad === 'data/bildbeitraege/index.json')?.inhalt ?? enc.encode('[]')));
  const lies = (name) => p.nutzlast.find((d) => d.pfad === `data/bildbeitraege/${name}`)?.inhalt;
  const einfuegen = db.prepare(`INSERT INTO bildbeitrag (kennung, gruppe_id, herkunft, art, items, erstellt, status, entschieden, png, png_sha256, vorschau, vorschau_typ, empfangen)
                                VALUES (?, NULL, ?, ?, ?, ?, 'freigegeben', ?, ?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  try {
    for (const b of index) {
      const png = lies(b.datei);
      const vorschau = lies(b.vorschau);
      if (!png || !vorschau || sha256(png) !== b.sha256) throw new Error(`Bildbeitrag ${b.kennung} unvollständig`);
      einfuegen.run(b.kennung, b.herkunft, b.art, JSON.stringify(b.items), b.erstellt, b.freigegeben ?? jetzt.toISOString(), png, b.sha256, vorschau, b.vorschau.endsWith('.webp') ? 'image/webp' : 'image/jpeg', jetzt.toISOString());
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { dateien, bildbeitraege: index.length };
}

/** Vergleicht zwei Manifeste ohne die Konfiguration (die die Herkunft nennen darf). */
export function vergleicheManifeste(a, b) {
  const zeilen = (m) => new Map(m.split('\n').filter(Boolean).map((z) => { const [h, ...n] = z.split(/\s+/); return [n.join(' '), h]; }));
  const x = zeilen(a);
  const y = zeilen(b);
  const abweichend = [];
  for (const [n, h] of x) if (y.get(n) !== h) abweichend.push(n);
  for (const n of y.keys()) if (!x.has(n)) abweichend.push(n);
  return { gleich: abweichend.length === 0, dateien: x.size, abweichend };
}
