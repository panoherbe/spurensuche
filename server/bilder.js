// Prüfung hochgeladener Bilder anhand ihrer Kopfdaten (ohne sie zu dekodieren): Format, Breite, Höhe.

/** Liefert `{ typ, breite, hoehe }` oder null, wenn das Format nicht erkannt wird. */
export function bildInfo(b) {
  if (!b || b.length < 30) return null;
  // PNG: Signatur, danach IHDR mit Breite und Höhe (Big Endian)
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b.toString('ascii', 12, 16) === 'IHDR') {
    return { typ: 'image/png', breite: b.readUInt32BE(16), hoehe: b.readUInt32BE(20) };
  }
  // JPEG: Segmente bis zum ersten SOF
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const laenge = b.readUInt16BE(i + 2);
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { typ: 'image/jpeg', hoehe: b.readUInt16BE(i + 5), breite: b.readUInt16BE(i + 7) };
      }
      i += 2 + laenge;
    }
    return null;
  }
  // WebP: RIFF....WEBP mit VP8, VP8L oder VP8X
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const art = b.toString('ascii', 12, 16);
    if (art === 'VP8 ') return { typ: 'image/webp', breite: b.readUInt16LE(26) & 0x3fff, hoehe: b.readUInt16LE(28) & 0x3fff };
    if (art === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { typ: 'image/webp', breite: (bits & 0x3fff) + 1, hoehe: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (art === 'VP8X') return { typ: 'image/webp', breite: 1 + b.readUIntLE(24, 3), hoehe: 1 + b.readUIntLE(27, 3) };
  }
  return null;
}
