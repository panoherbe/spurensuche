// Logik der Schätzfrage, ohne Oberfläche (in Node testbar).
// Der Regler läuft von 0 bis 1000; „linear“ verteilt den Bereich gleichmäßig, „log“ in Zehnerpotenzen
// (für sehr große Zahlen wie 26 Millionen Ziegel).

export const REGLER_MAX = 1000;

/** Rundet auf den Schritt (linear) oder auf zwei geltende Ziffern (log), damit runde Zahlen entstehen. */
export function runde(wert, { schritt = 1 } = {}, skala = 'linear') {
  if (skala === 'log') {
    if (wert <= 0) return 0;
    const stellen = Math.floor(Math.log10(wert)) - 1;
    const faktor = 10 ** stellen;
    return Math.max(1, Math.round(wert / faktor) * faktor);
  }
  const gerundet = Math.round(wert / schritt) * schritt;
  return Number(gerundet.toFixed(6));
}

export function reglerZuWert(regler, bereich, skala = 'linear') {
  const anteil = Math.min(1, Math.max(0, regler / REGLER_MAX));
  if (skala === 'log') {
    const a = Math.log10(bereich.min);
    const b = Math.log10(bereich.max);
    return runde(10 ** (a + anteil * (b - a)), bereich, 'log');
  }
  return runde(bereich.min + anteil * (bereich.max - bereich.min), bereich, 'linear');
}

export function wertZuRegler(wert, bereich, skala = 'linear') {
  const w = Math.min(bereich.max, Math.max(bereich.min, wert));
  if (skala === 'log') {
    const a = Math.log10(bereich.min);
    const b = Math.log10(bereich.max);
    return Math.round(((Math.log10(w) - a) / (b - a)) * REGLER_MAX);
  }
  return Math.round(((w - bereich.min) / (bereich.max - bereich.min)) * REGLER_MAX);
}

/** Nächster Wert für die Knöpfe „weniger“ und „mehr“: ein Schritt (linear) oder ein Zehntel einer Zehnerpotenz (log). */
export function schrittWert(wert, richtung, bereich, skala = 'linear') {
  if (skala === 'log') {
    const regler = wertZuRegler(Math.max(wert, bereich.min), bereich, 'log');
    const neu = reglerZuWert(regler + richtung * 25, bereich, 'log');
    return neu === wert ? reglerZuWert(regler + richtung * 50, bereich, 'log') : neu;
  }
  return Math.min(bereich.max, Math.max(bereich.min, runde(wert + richtung * bereich.schritt, bereich)));
}

/** Liest eine eingetippte Zahl: „26.000.000“, „26 000 000“, „1,44“, „1.5“. */
export function leseZahl(text) {
  const roh = String(text).trim().replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(roh)) return null;
  let normal = roh;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(roh)) normal = roh.replace(/\./g, '').replace(',', '.');
  else if (/,/.test(roh)) normal = roh.replace(/\./g, '').replace(',', '.');
  const zahl = Number(normal);
  return Number.isFinite(zahl) ? zahl : null;
}

export const STANDARD_TOLERANZ = {
  linear: { drei: 10, zwei: 25, eins: 50 },
  log: { drei: 1.25, zwei: 2, eins: 4 },
};

/**
 * Bewertung einer Schätzung. linear: Abweichung in Prozent; log: Faktor (2 = halb oder doppelt so viel).
 * sterne 1–3; richtig = innerhalb der äußeren Grenze; richtung: 'zu-hoch', 'zu-niedrig' oder 'genau'.
 */
export function bewerte(schaetzung, antwort, skala = 'linear', toleranz) {
  const grenzen = { ...STANDARD_TOLERANZ[skala === 'log' ? 'log' : 'linear'], ...toleranz };
  const richtung = schaetzung === antwort ? 'genau' : schaetzung > antwort ? 'zu-hoch' : 'zu-niedrig';
  if (skala === 'log') {
    const faktor = schaetzung > 0 ? Math.max(schaetzung / antwort, antwort / schaetzung) : Infinity;
    const sterne = faktor <= grenzen.drei ? 3 : faktor <= grenzen.zwei ? 2 : 1;
    return { faktor, prozent: (Math.abs(schaetzung - antwort) / antwort) * 100, sterne, richtig: faktor <= grenzen.eins, richtung };
  }
  const prozent = (Math.abs(schaetzung - antwort) / antwort) * 100;
  const sterne = prozent <= grenzen.drei ? 3 : prozent <= grenzen.zwei ? 2 : 1;
  return { faktor: schaetzung > 0 ? Math.max(schaetzung / antwort, antwort / schaetzung) : Infinity, prozent, sterne, richtig: prozent <= grenzen.eins, richtung };
}

/** Mittlerer Wert (Median) einer Schätzrunde. */
export function mitte(werte) {
  if (werte.length === 0) return null;
  const sortiert = [...werte].sort((a, b) => a - b);
  const m = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 ? sortiert[m] : (sortiert[m - 1] + sortiert[m]) / 2;
}

/**
 * „Neuer Anlauf“ nach einer zu weit entfernten Schätzung: true, wenn die neue Schätzung in die richtige
 * Richtung geht (auf die Rückmeldung reagiert), sonst false.
 */
export function inRichtigeRichtung(alt, neu, antwort) {
  if (neu === alt) return false;
  return Math.abs(neu - antwort) < Math.abs(alt - antwort);
}
