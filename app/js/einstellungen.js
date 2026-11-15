// Einstellungen je Gerät: einfache Sprache, Vorlesen, Tempo, Darstellung, Kontrast, Bewegung, Schriftgröße, Töne.
// Wirken sofort auf die ganze Seite (Attribute am <html>) und werden an die Spiele weitergegeben.

import { lies, schreibe } from './speicher.js';
import { h, dialog, knopf } from './ui.js';
import { vorlesen, kannVorlesen } from './vorlesen.js';

export const STANDARD = Object.freeze({
  sprache: 'standard',       // 'standard' | 'einfach'
  autoVorlesen: false,
  tempo: 1,                  // 0,5 bis 1,5
  darstellung: 'auto',       // 'auto' | 'hell' | 'dunkel'
  kontrast: 'normal',        // 'normal' | 'hoch'
  bewegung: 'auto',          // 'auto' | 'reduziert'
  schrift: 'normal',         // 'normal' | 'gross' | 'sehr-gross'
  ton: false,
});

let aktuell = { ...STANDARD };
const beobachter = new Set();

export function einstellungen() { return aktuell; }
export function beiAenderung(fn) { beobachter.add(fn); return () => beobachter.delete(fn); }

export function reduzierteBewegung() {
  return aktuell.bewegung === 'reduziert' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function anwenden() {
  const r = document.documentElement;
  r.dataset.sprache = aktuell.sprache;
  if (aktuell.darstellung === 'auto') delete r.dataset.darstellung; else r.dataset.darstellung = aktuell.darstellung;
  if (aktuell.kontrast === 'hoch') r.dataset.kontrast = 'hoch'; else delete r.dataset.kontrast;
  if (reduzierteBewegung()) r.dataset.bewegung = 'reduziert'; else delete r.dataset.bewegung;
  if (aktuell.schrift === 'normal') delete r.dataset.schrift; else r.dataset.schrift = aktuell.schrift;
  r.style.setProperty('--sp-tempo', String(aktuell.tempo));
}

export async function ladeEinstellungen() {
  try { aktuell = { ...STANDARD, ...(await lies('einstellungen')) }; } catch { aktuell = { ...STANDARD }; }
  anwenden();
  return aktuell;
}

export async function aendere(teil) {
  aktuell = { ...aktuell, ...teil };
  aktuell.tempo = Math.min(1.5, Math.max(0.5, Math.round(Number(aktuell.tempo) * 10) / 10 || 1));
  anwenden();
  try { await schreibe('einstellungen', aktuell); } catch { /* privates Fenster: gilt bis zum Schließen */ }
  for (const fn of beobachter) fn(aktuell);
}

/** Text in der eingestellten Sprachfassung aus einem Zweitext `{ standard, einfach }` oder einem String. */
export function t(zweitext) {
  if (zweitext && typeof zweitext === 'object') return zweitext[aktuell.sprache] ?? zweitext.standard ?? '';
  return zweitext ?? '';
}

function auswahl(name, titel, optionen, wert, beiWahl) {
  return h('fieldset', {}, h('legend', {}, titel), h('div', { class: 'wahl' }, optionen.map(([w, text]) => {
    const id = `e-${name}-${w}`;
    return [h('input', { type: 'radio', name, id, value: w, checked: w === wert, onchange: () => beiWahl(w) }), h('label', { for: id }, text)];
  })));
}

/** Dialog mit allen Einstellungen. */
export function zeigeEinstellungen() {
  return dialog('Einstellungen', (inhalt) => {
    const e = aktuell;
    const tempoText = h('output', { id: 'e-tempo-wert', for: 'e-tempo' }, tempoBeschreibung(e.tempo));
    inhalt.append(
      auswahl('sprache', 'Sprache', [['standard', 'Standard'], ['einfach', 'Einfache Sprache']], e.sprache, (w) => aendere({ sprache: w })),
      h('fieldset', {}, h('legend', {}, 'Vorlesen'),
        kannVorlesen() ? null : h('p', { class: 'leise' }, 'Dieser Browser bietet kein Vorlesen an.'),
        h('label', { class: 'schalter' }, h('input', { type: 'checkbox', checked: e.autoVorlesen, onchange: (ev) => aendere({ autoVorlesen: ev.target.checked }) }), 'Texte beim Öffnen automatisch vorlesen'),
        h('label', { for: 'e-tempo' }, 'Tempo von Vorlesen und Spielen'),
        h('input', { id: 'e-tempo', type: 'range', min: '0.5', max: '1.5', step: '0.1', value: String(e.tempo), 'aria-describedby': 'e-tempo-wert',
          oninput: (ev) => { tempoText.textContent = tempoBeschreibung(Number(ev.target.value)); }, onchange: (ev) => aendere({ tempo: Number(ev.target.value) }) }),
        tempoText,
        h('div', { class: 'knopfreihe', stil: { 'margin-top': '10px' } }, knopf('Probe hören', () => vorlesen('So klingt das Vorlesen mit diesem Tempo.'), { art: 'zweit', sym: 'lautsprecher' }))),
      auswahl('darstellung', 'Darstellung', [['auto', 'Wie das Gerät'], ['hell', 'Hell'], ['dunkel', 'Dunkel']], e.darstellung, (w) => aendere({ darstellung: w })),
      auswahl('kontrast', 'Kontrast', [['normal', 'Normal'], ['hoch', 'Hoch']], e.kontrast, (w) => aendere({ kontrast: w })),
      auswahl('schrift', 'Schriftgröße', [['normal', 'Normal'], ['gross', 'Groß'], ['sehr-gross', 'Sehr groß']], e.schrift, (w) => aendere({ schrift: w })),
      auswahl('bewegung', 'Bewegung', [['auto', 'Wie das Gerät'], ['reduziert', 'Wenig Bewegung']], e.bewegung, (w) => aendere({ bewegung: w })),
      h('label', { class: 'schalter' }, h('input', { type: 'checkbox', checked: e.ton, onchange: (ev) => aendere({ ton: ev.target.checked }) }), 'Töne in Spielen'),
    );
  });
}

function tempoBeschreibung(w) {
  const n = Number(w);
  const zahl = n.toLocaleString('de-DE', { minimumFractionDigits: 1 });
  if (n < 0.95) return `${zahl}-fach: langsamer`;
  if (n > 1.05) return `${zahl}-fach: schneller`;
  return '1,0-fach: normal';
}
