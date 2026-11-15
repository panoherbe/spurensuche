// Wiederholbares Mischen: Derselbe Startwert ergibt dieselbe Reihenfolge (für Tests und Rundgänge).
// Ohne Startwert wird zufällig gemischt. Belohnungen hängen nie vom Zufall ab.

/** 32-Bit-Hash eines Strings (FNV-1a). */
export function hash(text) {
  let h = 0x811c9dc5;
  for (const zeichen of String(text)) {
    h ^= zeichen.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Zahlenfolge in [0, 1) aus einem Startwert (mulberry32). */
export function zufallsquelle(startwert) {
  let a = typeof startwert === 'number' ? startwert >>> 0 : hash(startwert ?? String(Math.random()));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gemischte Kopie (Fisher-Yates). */
export function mische(liste, startwert) {
  const zufall = zufallsquelle(startwert);
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

/**
 * Gemischte Reihenfolge der Zahlen 0 … n−1, in der höchstens `hoechstensRichtig` Zahlen an ihrem
 * Platz stehen (bei n ≥ 2 nie schon gelöst). Wiederholbar für denselben Startwert.
 */
export function mischeOhneFixpunkte(n, startwert, hoechstensRichtig = 0) {
  if (n < 2) return [...Array(n).keys()];
  const basis = [...Array(n).keys()];
  for (let versuch = 0; versuch < 200; versuch++) {
    const lage = mische(basis, `${startwert}|${versuch}`);
    const richtig = lage.filter((wert, platz) => wert === platz).length;
    if (richtig <= hoechstensRichtig) return lage;
  }
  // Rückfall: um eins verschieben (keine Zahl an ihrem Platz)
  return basis.map((_, i) => (i + 1) % n);
}
