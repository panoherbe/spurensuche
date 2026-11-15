// Kurze Effekttöne, im Browser erzeugt (Web Audio): keine Tondateien, offline, leise.
// Nur wenn umgebung.ton an ist (Voreinstellung: aus). Töne tragen nie allein eine Bedeutung:
// Jede Rückmeldung steht auch als Text da.

let kontext = null;

function audio() {
  if (kontext) return kontext;
  const Klasse = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Klasse) return null;
  kontext = new Klasse();
  return kontext;
}

function note(ac, frequenz, start, dauer, lautstaerke = 0.08, form = 'sine') {
  const osz = ac.createOscillator();
  const pegel = ac.createGain();
  osz.type = form;
  osz.frequency.value = frequenz;
  pegel.gain.setValueAtTime(0, start);
  pegel.gain.linearRampToValueAtTime(lautstaerke, start + 0.015);
  pegel.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
  osz.connect(pegel).connect(ac.destination);
  osz.start(start);
  osz.stop(start + dauer + 0.02);
}

const MELODIEN = {
  klick: [[660, 0, 0.06, 0.04, 'triangle']],
  gut: [[523.25, 0, 0.16], [783.99, 0.09, 0.22]],
  falsch: [[311.13, 0, 0.18, 0.05, 'triangle'], [261.63, 0.1, 0.22, 0.05, 'triangle']],
  tipp: [[880, 0, 0.12, 0.05], [1174.66, 0.08, 0.18, 0.04]],
  fertig: [[523.25, 0, 0.18], [659.25, 0.1, 0.18], [783.99, 0.2, 0.2], [1046.5, 0.32, 0.4]],
};

/** Spielt einen Effekt: klick, gut, falsch, tipp, fertig. Tut nichts, wenn `an` falsch ist. */
export function ton(art, an) {
  if (!an) return;
  try {
    const ac = audio();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    const jetzt = ac.currentTime + 0.01;
    for (const [frequenz, versatz, dauer, lautstaerke, form] of MELODIEN[art] ?? []) {
      note(ac, frequenz, jetzt + versatz, dauer, lautstaerke, form);
    }
  } catch {
    // Ohne Ton geht es weiter.
  }
}
