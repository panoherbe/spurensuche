// Vorlesen mit der Sprachausgabe des Geräts (Web Speech API). Läuft offline, wenn das Gerät eine deutsche
// Stimme mitbringt (iPadOS, Android, Windows und ChromeOS tun das). Tempo aus den Einstellungen.

let tempo = () => 1;
let laufend = null;

export function setzeTempoQuelle(fn) { tempo = fn; }
export const kannVorlesen = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function stimme() {
  const stimmen = speechSynthesis.getVoices().filter((v) => /^de(-|_|$)/i.test(v.lang));
  return stimmen.find((v) => v.localService && /de-DE/i.test(v.lang)) ?? stimmen.find((v) => v.localService) ?? stimmen[0] ?? null;
}

export function stoppe() {
  if (!kannVorlesen()) return;
  speechSynthesis.cancel();
  laufend?.ende?.();
  laufend = null;
}

/** Liest einen Text vor. Promise erfüllt sich am Ende oder beim Abbruch. */
export function vorlesen(text) {
  if (!kannVorlesen() || !String(text ?? '').trim()) return Promise.resolve();
  stoppe();
  return new Promise((ok) => {
    const a = new SpeechSynthesisUtterance(String(text));
    a.lang = 'de-DE';
    const v = stimme();
    if (v) a.voice = v;
    a.rate = Math.min(1.5, Math.max(0.5, tempo()));
    const ende = () => { if (laufend?.a === a) laufend = null; ok(); };
    a.onend = ende;
    a.onerror = ende;
    laufend = { a, ende };
    speechSynthesis.speak(a);
  });
}

/**
 * Liest die markierten Elemente in `bereich` nacheinander vor (`[data-vorlesen]`, sonst Überschriften und Absätze)
 * und hebt das gerade gelesene hervor. Ein zweiter Aufruf während des Lesens stoppt.
 */
let bereichsLauf = null;
export async function vorlesenBereich(bereich, beiStatus = () => {}) {
  if (bereichsLauf) { stoppeAlles(); beiStatus(false); return; }
  let teile = [...bereich.querySelectorAll('[data-vorlesen]')];
  if (!teile.length) teile = [...bereich.querySelectorAll('h1, h2, h3, p, li')];
  teile = teile.filter((el) => el.getClientRects().length > 0 && el.textContent.trim());
  if (!teile.length || !kannVorlesen()) return;
  const lauf = {};
  bereichsLauf = lauf;
  beiStatus(true);
  for (const el of teile) {
    if (bereichsLauf !== lauf) break;
    el.classList.add('wird-gelesen');
    await vorlesen(el.getAttribute('aria-label') || el.textContent.replace(/\s+/g, ' ').trim());
    el.classList.remove('wird-gelesen');
  }
  if (bereichsLauf === lauf) bereichsLauf = null;
  beiStatus(false);
}

/** Stoppt auch ein laufendes Bereichs-Vorlesen. */
export function stoppeAlles() {
  bereichsLauf = null;
  stoppe();
  for (const el of document.querySelectorAll('.wird-gelesen')) el.classList.remove('wird-gelesen');
}
