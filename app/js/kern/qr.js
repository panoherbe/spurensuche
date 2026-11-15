// QR-Code-Erzeugung nach ISO/IEC 18004, ohne Fremdbibliothek: Byte-Modus, Fehlerkorrektur M (etwa 15 %),
// Versionen 1 bis 10 (bis 213 Byte), automatische Wahl der Maske. Für die Schilder an den Orten und die
// Beitrittscodes der Gruppen. Ausgabe als Matrix, SVG-Pfad oder Liste dunkler Module (für PDF).

const EC_JE_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // Stufe M, Index = Version
const BLOECKE = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

function rohModule(v) {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const a = Math.floor(v / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (v >= 7) n -= 36;
  }
  return n;
}
const datenCodewoerter = (v) => Math.floor(rohModule(v) / 8) - EC_JE_BLOCK[v] * BLOECKE[v];

function ausrichtung(v) {
  if (v === 1) return [];
  const anzahl = Math.floor(v / 7) + 2;
  const schritt = Math.ceil((v * 4 + 4) / (anzahl * 2 - 2)) * 2;
  const pos = [6];
  for (let p = v * 4 + 10; pos.length < anzahl; p -= schritt) pos.splice(1, 0, p);
  return pos;
}

// Rechnen im Galois-Feld GF(2^8) mit dem Polynom x^8 + x^4 + x^3 + x^2 + 1
function mal(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function teiler(grad) {
  const r = new Array(grad).fill(0);
  r[grad - 1] = 1;
  let wurzel = 1;
  for (let i = 0; i < grad; i++) {
    for (let j = 0; j < grad; j++) {
      r[j] = mal(r[j], wurzel);
      if (j + 1 < grad) r[j] ^= r[j + 1];
    }
    wurzel = mal(wurzel, 2);
  }
  return r;
}

function rest(daten, t) {
  const r = new Array(t.length).fill(0);
  for (const b of daten) {
    const faktor = b ^ r.shift();
    r.push(0);
    t.forEach((k, i) => { r[i] ^= mal(k, faktor); });
  }
  return r;
}

function bitsFuer(bytes, v) {
  const bits = [];
  const schreibe = (wert, laenge) => { for (let i = laenge - 1; i >= 0; i--) bits.push((wert >>> i) & 1); };
  schreibe(0b0100, 4); // Byte-Modus
  schreibe(bytes.length, v <= 9 ? 8 : 16);
  for (const b of bytes) schreibe(b, 8);
  const kapazitaet = datenCodewoerter(v) * 8;
  schreibe(0, Math.min(4, kapazitaet - bits.length));
  while (bits.length % 8) bits.push(0);
  const woerter = [];
  for (let i = 0; i < bits.length; i += 8) woerter.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; woerter.length < datenCodewoerter(v); pad ^= 0xec ^ 0x11) woerter.push(pad);
  return woerter;
}

function mitFehlerkorrektur(daten, v) {
  const anzahl = BLOECKE[v];
  const ec = EC_JE_BLOCK[v];
  const roh = Math.floor(rohModule(v) / 8);
  const kurz = anzahl - (roh % anzahl);
  const kurzLaenge = Math.floor(roh / anzahl);
  const t = teiler(ec);
  const bloecke = [];
  for (let i = 0, k = 0; i < anzahl; i++) {
    const n = kurzLaenge - ec + (i < kurz ? 0 : 1);
    const d = daten.slice(k, k + n);
    k += n;
    const block = [...d, ...rest(d, t)];
    if (i < kurz) block.splice(n, 0, null); // Platzhalter, damit alle Blöcke gleich lang verschachtelt werden
    bloecke.push(block);
  }
  const aus = [];
  for (let i = 0; i < bloecke[0].length; i++) {
    for (const b of bloecke) if (b[i] !== null) aus.push(b[i]);
  }
  return aus;
}

const MASKEN = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function grundmuster(v) {
  const n = v * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const fest = Array.from({ length: n }, () => new Array(n).fill(false));
  const setze = (x, y, dunkel) => { m[y][x] = dunkel; fest[y][x] = true; };
  for (let i = 0; i < n; i++) { setze(6, i, i % 2 === 0); setze(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const abstand = Math.max(Math.abs(dx), Math.abs(dy));
        setze(x, y, abstand !== 2 && abstand !== 4);
      }
    }
  }
  const pos = ausrichtung(v);
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setze(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  formatinfo(m, fest, 0, setze); // reserviert die Felder; die echten Bits folgen nach der Maskenwahl
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bits = (v << 12) | r;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setze(a, b, bit);
      setze(b, a, bit);
    }
  }
  return { m, fest, n };
}

function formatinfo(m, fest, maske, setze) {
  const n = m.length;
  const daten = (0b00 << 3) | maske; // Stufe M = 00
  let r = daten;
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  const bits = ((daten << 10) | r) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) setze(8, i, bit(i));
  setze(8, 7, bit(6));
  setze(8, 8, bit(7));
  setze(7, 8, bit(8));
  for (let i = 9; i < 15; i++) setze(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setze(n - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setze(8, n - 15 + i, bit(i));
  setze(8, n - 8, true);
}

function platziere(m, fest, woerter) {
  const n = m.length;
  let i = 0;
  for (let rechts = n - 1; rechts >= 1; rechts -= 2) {
    if (rechts === 6) rechts = 5;
    for (let senkrecht = 0; senkrecht < n; senkrecht++) {
      for (let j = 0; j < 2; j++) {
        const x = rechts - j;
        const aufwaerts = ((rechts + 1) & 2) === 0;
        const y = aufwaerts ? n - 1 - senkrecht : senkrecht;
        if (!fest[y][x] && i < woerter.length * 8) {
          m[y][x] = ((woerter[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }
}

function strafe(m) {
  const n = m.length;
  let s = 0;
  const reihe = (lese) => {
    let lauf = 1;
    for (let i = 1; i < n; i++) {
      if (lese(i) === lese(i - 1)) {
        lauf++;
        if (lauf === 5) s += 3;
        else if (lauf > 5) s += 1;
      } else lauf = 1;
    }
    // Muster ähnlich den Suchmarken: 1011101 mit vier hellen Modulen davor oder danach
    for (let i = 0; i + 10 < n; i++) {
      const muster = [];
      for (let k = 0; k < 11; k++) muster.push(lese(i + k) ? 1 : 0);
      const t = muster.join('');
      if (t === '10111010000' || t === '00001011101') s += 40;
    }
  };
  for (let y = 0; y < n; y++) reihe((i) => m[y][i]);
  for (let x = 0; x < n; x++) reihe((i) => m[i][x]);
  for (let y = 0; y + 1 < n; y++) {
    for (let x = 0; x + 1 < n; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) s += 3;
    }
  }
  let dunkel = 0;
  for (const z of m) for (const c of z) if (c) dunkel++;
  const k = Math.ceil(Math.abs(dunkel * 20 - n * n * 10) / (n * n)) - 1;
  return s + Math.max(0, k) * 10;
}

/** Erzeugt einen QR-Code für `text` und liefert die Matrix (true = dunkel). */
export function qrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text));
  let v = 1;
  while (v <= 10 && 4 + (v <= 9 ? 8 : 16) + bytes.length * 8 > datenCodewoerter(v) * 8) v++;
  if (v > 10) throw new Error('Text zu lang für einen QR-Code bis Version 10');
  const woerter = mitFehlerkorrektur(bitsFuer(bytes, v), v);
  let beste = null;
  for (let maske = 0; maske < 8; maske++) {
    const { m, fest, n } = grundmuster(v);
    platziere(m, fest, woerter);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fest[y][x] && MASKEN[maske](x, y)) m[y][x] = !m[y][x];
    formatinfo(m, fest, maske, (x, y, d) => { m[y][x] = d; });
    const p = strafe(m);
    if (!beste || p < beste.p) beste = { p, m, maske, v };
  }
  return { matrix: beste.m, version: beste.v, maske: beste.maske };
}

/** SVG-Text eines QR-Codes, mit vier Modulen Ruhezone. */
export function qrSvg(text, { titel = null, vordergrund = '#000000', hintergrund = '#ffffff' } = {}) {
  const { matrix } = qrMatrix(text);
  const n = matrix.length;
  const g = n + 8;
  let pfad = '';
  matrix.forEach((zeile, y) => zeile.forEach((d, x) => { if (d) pfad += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  const t = titel ? `<title>${String(titel).replace(/[<&>]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' })[c])}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g} ${g}" shape-rendering="crispEdges" role="img">${t}<rect width="${g}" height="${g}" fill="${hintergrund}"/><path d="${pfad}" fill="${vordergrund}"/></svg>`;
}

/** Dunkle Module als Koordinatenliste für den PDF-Schreiber: `[x, y]` in Punkt ab (links, oben). */
export function qrQuadrate(text, links, oben, kantenlaenge) {
  const { matrix } = qrMatrix(text);
  const n = matrix.length + 8;
  const k = kantenlaenge / n;
  const liste = [];
  matrix.forEach((zeile, y) => zeile.forEach((d, x) => { if (d) liste.push([links + (x + 4) * k, oben + (y + 4) * k]); }));
  return { liste, modul: k };
}
