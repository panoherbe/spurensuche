// ZIP-Archiv ohne Kompression („stored“), ohne Fremdbibliothek. PNG und JPEG sind schon komprimiert; JSON und
// CSV bleiben lesbar. Dateinamen in UTF-8. Läuft im Browser und in Node.js. Grenze: 4 GB und 65.535 Dateien.

const TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const kodierer = new TextEncoder();
const alsBytes = (inhalt) => (typeof inhalt === 'string' ? kodierer.encode(inhalt) : inhalt instanceof Uint8Array ? inhalt : new Uint8Array(inhalt));

function dosZeit(d) {
  const zeit = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const datum = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { zeit, datum };
}

/**
 * Baut ein ZIP aus `[{ name, inhalt }]` (`inhalt` als Text oder Bytes). `datum` gilt für alle Einträge, damit
 * derselbe Inhalt dasselbe Archiv ergibt.
 */
export function zip(dateien, { datum = new Date() } = {}) {
  const { zeit, datum: tag } = dosZeit(datum);
  const lokal = [];
  const zentral = [];
  let versatz = 0;
  for (const { name, inhalt } of dateien) {
    const n = kodierer.encode(name);
    const daten = alsBytes(inhalt);
    const pruef = crc32(daten);
    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true);
    kopf.setUint16(4, 20, true);
    kopf.setUint16(6, 0x0800, true); // Bit 11: Name in UTF-8
    kopf.setUint16(8, 0, true); // gespeichert, nicht komprimiert
    kopf.setUint16(10, zeit, true);
    kopf.setUint16(12, tag, true);
    kopf.setUint32(14, pruef, true);
    kopf.setUint32(18, daten.length, true);
    kopf.setUint32(22, daten.length, true);
    kopf.setUint16(26, n.length, true);
    kopf.setUint16(28, 0, true);
    lokal.push(new Uint8Array(kopf.buffer), n, daten);

    const z = new DataView(new ArrayBuffer(46));
    z.setUint32(0, 0x02014b50, true);
    z.setUint16(4, 20, true);
    z.setUint16(6, 20, true);
    z.setUint16(8, 0x0800, true);
    z.setUint16(10, 0, true);
    z.setUint16(12, zeit, true);
    z.setUint16(14, tag, true);
    z.setUint32(16, pruef, true);
    z.setUint32(20, daten.length, true);
    z.setUint32(24, daten.length, true);
    z.setUint16(28, n.length, true);
    z.setUint32(42, versatz, true);
    zentral.push(new Uint8Array(z.buffer), n);
    versatz += 30 + n.length + daten.length;
  }
  const groesseZentral = zentral.reduce((s, t) => s + t.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true);
  ende.setUint16(8, dateien.length, true);
  ende.setUint16(10, dateien.length, true);
  ende.setUint32(12, groesseZentral, true);
  ende.setUint32(16, versatz, true);
  const teile = [...lokal, ...zentral, new Uint8Array(ende.buffer)];
  const gesamt = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
  let p = 0;
  for (const t of teile) { gesamt.set(t, p); p += t.length; }
  return gesamt;
}

/** Liest ein ungepacktes ZIP (wie von `zip` erzeugt) zurück: `[{ name, inhalt }]`. Für Tests und den Import. */
export function entpacke(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const sicht = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let ende = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (sicht.getUint32(i, true) === 0x06054b50) { ende = i; break; }
  }
  if (ende < 0) throw new Error('Kein ZIP-Archiv');
  const anzahl = sicht.getUint16(ende + 10, true);
  let p = sicht.getUint32(ende + 16, true);
  const dekodierer = new TextDecoder();
  const aus = [];
  for (let i = 0; i < anzahl; i++) {
    if (sicht.getUint32(p, true) !== 0x02014b50) throw new Error('Inhaltsverzeichnis beschädigt');
    const methode = sicht.getUint16(p + 10, true);
    const pruef = sicht.getUint32(p + 16, true);
    const groesse = sicht.getUint32(p + 20, true);
    const nLaenge = sicht.getUint16(p + 28, true);
    const xLaenge = sicht.getUint16(p + 30, true);
    const kLaenge = sicht.getUint16(p + 32, true);
    const lokal = sicht.getUint32(p + 42, true);
    const name = dekodierer.decode(b.subarray(p + 46, p + 46 + nLaenge));
    if (methode !== 0) throw new Error(`${name}: nur ungepackte Einträge werden gelesen`);
    const start = lokal + 30 + sicht.getUint16(lokal + 26, true) + sicht.getUint16(lokal + 28, true);
    const inhalt = b.slice(start, start + groesse);
    if (crc32(inhalt) !== pruef) throw new Error(`${name}: Prüfsumme stimmt nicht`);
    aus.push({ name, inhalt });
    p += 46 + nLaenge + xLaenge + kLaenge;
  }
  return aus;
}
