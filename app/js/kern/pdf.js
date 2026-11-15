// Kleiner PDF-Schreiber ohne Fremdbibliothek (PDF 1.4): Text in Helvetica und Helvetica-Bold, Linien, Rechtecke,
// Seitenumbruch und Zeilenumbruch mit den Zeichenbreiten der Standardschrift. Läuft im Browser und in Node.js.
// Genutzt für den Gruppenbericht und die QR-Schilder. Umlaute und typografische Zeichen über WinAnsiEncoding.

const A4 = { breite: 595.28, hoehe: 841.89 };

// Zeichenbreiten in 1/1000 em (Helvetica, Helvetica-Bold), Zeichen 32 bis 126.
const ASCII = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
const BREITE_NORMAL = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BREITE_FETT = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

// Zeichen außerhalb von ASCII: [WinAnsi-Code, Breite normal, Breite fett]
const ERWEITERT = {
  'ä': [0xe4, 556, 556], 'ö': [0xf6, 556, 611], 'ü': [0xfc, 556, 611], 'Ä': [0xc4, 667, 722], 'Ö': [0xd6, 778, 778],
  'Ü': [0xdc, 722, 722], 'ß': [0xdf, 611, 611], 'é': [0xe9, 556, 556], 'è': [0xe8, 556, 556], 'à': [0xe0, 556, 556],
  'á': [0xe1, 556, 556], 'ç': [0xe7, 500, 556], 'ñ': [0xf1, 556, 611], 'ó': [0xf3, 556, 611], 'ú': [0xfa, 556, 611],
  '€': [0x80, 556, 556], '‚': [0x82, 222, 278], '„': [0x84, 333, 500], '…': [0x85, 1000, 1000], '‘': [0x91, 222, 278],
  '’': [0x92, 222, 278], '“': [0x93, 333, 500], '”': [0x94, 333, 500], '•': [0x95, 350, 350], '–': [0x96, 556, 556],
  '—': [0x97, 1000, 1000], '°': [0xb0, 400, 400], '§': [0xa7, 556, 556], '·': [0xb7, 278, 278], '×': [0xd7, 584, 584],
  '½': [0xbd, 834, 834], ' ': [0x20, 278, 278], '→': [0x2d, 333, 333],
};

function zeichen(c, fett) {
  const i = ASCII.indexOf(c);
  if (i >= 0) return [c.charCodeAt(0), (fett ? BREITE_FETT : BREITE_NORMAL)[i]];
  const e = ERWEITERT[c];
  if (e) return [e[0], fett ? e[2] : e[1]];
  return [0x3f, fett ? 611 : 556]; // „?“ für Zeichen ohne Entsprechung
}

/** Breite eines Textes in Punkt. */
export function textbreite(text, groesse, fett = false) {
  let summe = 0;
  for (const c of String(text)) summe += zeichen(c, fett)[1];
  return (summe * groesse) / 1000;
}

/** Bricht Text an Leerzeichen so um, dass jede Zeile höchstens `breite` Punkt breit ist. */
export function umbrechen(text, breite, groesse, fett = false) {
  const zeilen = [];
  for (const absatz of String(text).split('\n')) {
    let zeile = '';
    for (const wort of absatz.split(/\s+/).filter(Boolean)) {
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (textbreite(probe, groesse, fett) <= breite || !zeile) zeile = probe;
      else { zeilen.push(zeile); zeile = wort; }
    }
    zeilen.push(zeile);
  }
  return zeilen;
}

function pdfText(text, fett) {
  let s = '';
  for (const c of String(text)) {
    const code = zeichen(c, fett)[0];
    if (code === 0x28 || code === 0x29 || code === 0x5c) s += `\\${String.fromCharCode(code)}`;
    else if (code < 0x20 || code > 0x7e) s += `\\${code.toString(8).padStart(3, '0')}`;
    else s += String.fromCharCode(code);
  }
  return `(${s})`;
}

const zahl = (n) => (Math.round(n * 100) / 100).toString();
function farbe(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '#000000');
  return m ? [1, 2, 3].map((i) => zahl(parseInt(m[i], 16) / 255)).join(' ') : '0 0 0';
}

/**
 * Ein PDF-Dokument. Koordinaten in Punkt, Ursprung oben links (wie auf dem Bildschirm); die Umrechnung auf das
 * PDF-System (unten links) passiert intern.
 */
export class PdfDokument {
  constructor({ titel = 'Dokument', rand = 56 } = {}) {
    this.titel = titel;
    this.rand = rand;
    this.seiten = [];
    this.neueSeite();
  }

  get breite() { return A4.breite; }
  get hoehe() { return A4.hoehe; }
  get nutzbreite() { return A4.breite - 2 * this.rand; }

  neueSeite() {
    this.seite = [];
    this.seiten.push(this.seite);
    this.y = this.rand;
    return this;
  }

  /** Text an fester Stelle. `y` ist die Grundlinie, von oben gemessen. */
  text(x, y, inhalt, { groesse = 11, fett = false, farbe: f = '#000000' } = {}) {
    this.seite.push(`BT /${fett ? 'F2' : 'F1'} ${zahl(groesse)} Tf ${farbe(f)} rg ${zahl(x)} ${zahl(A4.hoehe - y)} Td ${pdfText(inhalt, fett)} Tj ET`);
    return this;
  }

  linie(x1, y1, x2, y2, { staerke = 0.75, farbe: f = '#000000' } = {}) {
    this.seite.push(`${zahl(staerke)} w ${farbe(f)} RG ${zahl(x1)} ${zahl(A4.hoehe - y1)} m ${zahl(x2)} ${zahl(A4.hoehe - y2)} l S`);
    return this;
  }

  rechteck(x, y, b, h, { fuellung = null, rand: r = null, staerke = 0.75 } = {}) {
    const teile = [];
    if (fuellung) teile.push(`${farbe(fuellung)} rg`);
    if (r) teile.push(`${zahl(staerke)} w ${farbe(r)} RG`);
    teile.push(`${zahl(x)} ${zahl(A4.hoehe - y - h)} ${zahl(b)} ${zahl(h)} re`);
    teile.push(fuellung && r ? 'B' : fuellung ? 'f' : 'S');
    this.seite.push(teile.join(' '));
    return this;
  }

  /** Viele gefüllte Quadrate auf einmal (QR-Codes), als ein Pfad. */
  quadrate(liste, kante, { fuellung = '#000000' } = {}) {
    const teile = [`${farbe(fuellung)} rg`];
    for (const [x, y] of liste) teile.push(`${zahl(x)} ${zahl(A4.hoehe - y - kante)} ${zahl(kante)} ${zahl(kante)} re`);
    teile.push('f');
    this.seite.push(teile.join(' '));
    return this;
  }

  /** Platz prüfen; reicht er nicht, beginnt eine neue Seite. */
  platz(hoehe) {
    if (this.y + hoehe > A4.hoehe - this.rand) this.neueSeite();
    return this;
  }

  /** Fließtext ab der aktuellen Position, mit Umbruch und Seitenwechsel. */
  absatz(inhalt, { groesse = 11, fett = false, farbe: f = '#000000', abstand = 6, einzug = 0, breite = null } = {}) {
    const zeilenhoehe = groesse * 1.35;
    for (const zeile of umbrechen(inhalt, (breite ?? this.nutzbreite) - einzug, groesse, fett)) {
      this.platz(zeilenhoehe);
      this.y += zeilenhoehe;
      this.text(this.rand + einzug, this.y - groesse * 0.3, zeile, { groesse, fett, farbe: f });
    }
    this.y += abstand;
    return this;
  }

  /** Erzeugt die PDF-Datei als Uint8Array. */
  alsBytes({ erstellt = new Date() } = {}) {
    const objekte = [];
    const neu = (inhalt) => { objekte.push(inhalt); return objekte.length; };
    const katalog = neu(null);
    const seitenbaum = neu(null);
    const f1 = neu('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = neu('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kinder = [];
    for (const seite of this.seiten) {
      const strom = seite.join('\n');
      const inhalt = neu(`<< /Length ${strom.length} >>\nstream\n${strom}\nendstream`);
      kinder.push(neu(`<< /Type /Page /Parent ${seitenbaum} 0 R /MediaBox [0 0 ${zahl(A4.breite)} ${zahl(A4.hoehe)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${inhalt} 0 R >>`));
    }
    objekte[katalog - 1] = `<< /Type /Catalog /Pages ${seitenbaum} 0 R >>`;
    objekte[seitenbaum - 1] = `<< /Type /Pages /Kids [${kinder.map((k) => `${k} 0 R`).join(' ')}] /Count ${kinder.length} >>`;
    const d = erstellt;
    const zwei = (n) => String(n).padStart(2, '0');
    const datum = `D:${d.getUTCFullYear()}${zwei(d.getUTCMonth() + 1)}${zwei(d.getUTCDate())}${zwei(d.getUTCHours())}${zwei(d.getUTCMinutes())}${zwei(d.getUTCSeconds())}Z`;
    const info = neu(`<< /Title ${pdfText(this.titel, false)} /Producer (Spurensuche) /CreationDate (${datum}) >>`);

    // Alle Inhalte sind 8-Bit-Zeichen (WinAnsi); deshalb ist die Länge in Zeichen gleich der Länge in Byte.
    let aus = '%PDF-1.4\n%âãÏÓ\n';
    const versatz = [];
    objekte.forEach((inhalt, i) => {
      versatz.push(aus.length);
      aus += `${i + 1} 0 obj\n${inhalt}\nendobj\n`;
    });
    const xref = aus.length;
    aus += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
    for (const v of versatz) aus += `${String(v).padStart(10, '0')} 00000 n \n`;
    aus += `trailer\n<< /Size ${objekte.length + 1} /Root ${katalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(aus.length);
    for (let i = 0; i < aus.length; i++) bytes[i] = aus.charCodeAt(i) & 0xff;
    return bytes;
  }
}
