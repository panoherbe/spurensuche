// Vorlesen über die Sprachausgabe des Browsers (Web Speech API), ohne Server und ohne Netz, wenn das Gerät
// eine eingebaute deutsche Stimme hat (iPad, Windows, macOS, Android meist ja). Die App kann eine eigene
// Funktion als umgebung.vorlesen übergeben, etwa vorab erzeugte Tonaufnahmen; dann gilt diese.

function deutscheStimme() {
  const stimmen = globalThis.speechSynthesis?.getVoices?.() ?? [];
  const deutsch = stimmen.filter((s) => s.lang?.toLowerCase().startsWith('de'));
  // Eingebaute Stimmen zuerst: Sie funktionieren auch offline.
  return deutsch.find((s) => s.localService && s.lang === 'de-DE') ?? deutsch.find((s) => s.localService) ?? deutsch[0] ?? null;
}

/** Ob der Browser vorlesen kann. */
export const kannVorlesen = () => typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance === 'function';

/**
 * Erzeugt vorlesen(text) mit dem eingestellten Tempo (0,5–1,5; 1 = normal).
 * Ein neuer Aufruf beendet den vorigen. Liefert ein Promise, das am Ende des Vorlesens erfüllt wird.
 */
export function erzeugeVorlesen({ tempo = 1 } = {}) {
  if (!kannVorlesen()) return null;
  const rate = Math.min(1.5, Math.max(0.5, tempo));
  const vorlesen = (text) => {
    const synth = globalThis.speechSynthesis;
    synth.cancel();
    if (!text) return Promise.resolve();
    const aeusserung = new SpeechSynthesisUtterance(String(text));
    aeusserung.lang = 'de-DE';
    aeusserung.rate = rate;
    const stimme = deutscheStimme();
    if (stimme) aeusserung.voice = stimme;
    return new Promise((fertig) => {
      aeusserung.onend = () => fertig();
      aeusserung.onerror = () => fertig();
      synth.speak(aeusserung);
    });
  };
  vorlesen.stopp = () => globalThis.speechSynthesis?.cancel();
  return vorlesen;
}
