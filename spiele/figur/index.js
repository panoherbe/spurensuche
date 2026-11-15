// Spielfigur der Gruppe: zusammensetzen, zeichnen und im Baukasten gestalten (Charakteranpassung).
//
//   figurSvg(auswahl, katalog)             → SVG-Markup der Figur (für Bild, Sammelbuch, Dashboard-freie Ansicht)
//   zeichneFigur(ziel, auswahl, katalog)   → Figur als Element in ziel (ohne innerHTML)
//   starteGestaltung(wurzel, { katalog, items, freigeschaltet, auswahl, umgebung }) → Promise mit der neuen Auswahl
//
// Teile, die ein Sammelstück freischaltet (freiDurch in inhalte/figur.json), sind bis dahin sichtbar, aber gesperrt,
// mit dem Hinweis, wofür es sie gibt. Die Figur trägt keine Namen und keine Daten über Personen.

import * as teil from './teile.js';
import { h, neueId } from '../_gemeinsam/ui.js';

/** basis.css und stil.css als <link> in ziel (strenge CSP: kein <style>). */
function ladeStilFuer(ziel, href) {
  const dateien = [new URL('../_gemeinsam/basis.css', import.meta.url).href, href];
  return Promise.all(dateien.map((datei) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = datei;
    const geladen = new Promise((ok) => { link.addEventListener('load', ok, { once: true }); link.addEventListener('error', ok, { once: true }); });
    ziel.append(link);
    return geladen;
  }));
}

/** Farbwert einer Farb-Option aus dem Katalog. */
function farbeAus(katalog, gruppe, id) {
  return katalog.gruppen.find((g) => g.id === gruppe)?.optionen.find((o) => o.id === id)?.farbe;
}

/** Auswahl mit Voreinstellungen auffüllen; unbekannte Werte werden zur Voreinstellung. */
export function vollstaendig(auswahl = {}, katalog) {
  const ergebnis = { ...katalog.standard };
  for (const gruppe of katalog.gruppen) {
    const wert = auswahl[gruppe.id];
    if (gruppe.optionen.some((o) => o.id === wert)) ergebnis[gruppe.id] = wert;
  }
  return ergebnis;
}

/** SVG-Markup der Figur. Nur Kennungen und geprüfte Farbwerte aus dem Katalog fließen ein. */
export function figurSvg(auswahl, katalog, { titel = 'Eure Figur' } = {}) {
  const a = vollstaendig(auswahl, katalog);
  const f = { haut: farbeAus(katalog, 'haut', a.haut), haare: farbeAus(katalog, 'haare', a.haare), oberteil: farbeAus(katalog, 'oberteilFarbe', a.oberteilFarbe), hose: farbeAus(katalog, 'hose', a.hose) };
  const sicher = String(titel).replace(/[<>&"]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320"><title>${sicher}</title>
  ${teil.schatten()}${teil.rucksack(a.rucksack, f)}${teil.haareHinten(a.kopfbedeckung === 'kopftuch' ? '' : a.frisur, f)}${teil.koerper(a.oberteil, f)}${teil.rucksackRiemen(a.rucksack)}
  ${teil.kopf(f)}${teil.gesicht(a.gesicht)}${teil.haareVorn(a.frisur, f, a.kopfbedeckung)}${teil.brille(a.brille)}${teil.kopfbedeckung(a.kopfbedeckung, f)}
  ${teil.zubehoer(a.zubehoer)}${teil.begleiter(a.begleiter)}
</svg>`;
}

/** Beschreibung der Figur in Worten (Alternativtext). */
export function figurText(auswahl, katalog) {
  const a = vollstaendig(auswahl, katalog);
  const name = (gruppe) => katalog.gruppen.find((g) => g.id === gruppe).optionen.find((o) => o.id === a[gruppe]).name;
  const teile = [`Haut ${name('haut')}`, a.frisur === 'glatt' ? 'ohne Haare' : `Frisur ${name('frisur')}, ${name('haare')}`, `Gesicht ${name('gesicht')}`];
  if (a.brille !== 'keine') teile.push(name('brille'));
  if (a.kopfbedeckung !== 'keine') teile.push(name('kopfbedeckung'));
  teile.push(`${name('oberteil')} ${name('oberteilFarbe')}`, `Hose ${name('hose')}`);
  if (a.zubehoer !== 'keins') teile.push(`in der Hand: ${name('zubehoer')}`);
  if (a.rucksack === 'rucksack') teile.push('Rucksack');
  if (a.begleiter !== 'keiner') teile.push(`Begleiter: ${name('begleiter')}`);
  return `Spielfigur: ${teile.join(', ')}`;
}

/** Figur als Element (span mit SVG) in ziel einsetzen. */
export function zeichneFigur(ziel, auswahl, katalog) {
  const svg = new DOMParser().parseFromString(figurSvg(auswahl, katalog), 'image/svg+xml').documentElement;
  const huelle = h('span', { class: 'sp-figur', role: 'img', 'aria-label': figurText(auswahl, katalog) });
  svg.setAttribute('aria-hidden', 'true');
  huelle.append(document.importNode(svg, true));
  ziel.replaceChildren(huelle);
  return huelle;
}

/**
 * Baukasten zur Charakteranpassung. freigeschaltet: Kennungen der Sammelstücke der Gruppe.
 * Liefert ein Promise mit der neuen Auswahl („Fertig“) oder null (Abbruch über umgebung.signal).
 */
export async function starteGestaltung(wurzel, { katalog, items = [], freigeschaltet = [], auswahl = {}, umgebung = {} } = {}) {
  await ladeStilFuer(wurzel, new URL('./stil.css', import.meta.url).href);
  const frei = new Set(freigeschaltet);
  const itemName = (id) => items.find((i) => i.id === id)?.name ?? id;
  let stand = vollstaendig(auswahl, katalog);
  const einfach = umgebung.sprache === 'einfach';

  const vorschau = h('div', { class: 'sp-figur-vorschau' });
  const zeigen = () => zeichneFigur(vorschau, stand, katalog);
  const titelId = neueId('figur');
  const felder = katalog.gruppen.map((gruppe) => {
    const legende = h('legend', {}, gruppe.name);
    const optionen = gruppe.optionen.map((option) => {
      const gesperrt = option.freiDurch && !frei.has(option.freiDurch);
      const eingabeId = neueId('option');
      const eingabe = h('input', { type: 'radio', name: gruppe.id, value: option.id, id: eingabeId, class: 'sp-figur-radio', disabled: gesperrt || null });
      eingabe.checked = stand[gruppe.id] === option.id;
      eingabe.addEventListener('change', () => { stand = { ...stand, [gruppe.id]: option.id }; zeigen(); });
      let bild;
      if (gruppe.art === 'farbe') {
        bild = h('span', { class: 'sp-figur-farbe', 'aria-hidden': 'true' });
        bild.style.setProperty('background-color', option.farbe);
      } else {
        bild = h('span', { class: 'sp-figur-mini', 'aria-hidden': 'true' });
        bild.append(document.importNode(new DOMParser().parseFromString(figurSvg({ ...stand, [gruppe.id]: option.id }, katalog), 'image/svg+xml').documentElement, true));
      }
      const sperre = gesperrt ? h('span', { class: 'sp-figur-sperre' }, einfach ? `mit ${itemName(option.freiDurch)}` : `frei mit: ${itemName(option.freiDurch)}`) : null;
      return h('label', { class: `sp-figur-option${gesperrt ? ' sp-figur-option--gesperrt' : ''}`, for: eingabeId }, eingabe, bild, h('span', { class: 'sp-figur-name' }, option.name), sperre);
    });
    return h('fieldset', { class: `sp-figur-gruppe sp-figur-gruppe--${gruppe.art ?? 'form'}` }, legende, h('div', { class: 'sp-figur-optionen' }, optionen));
  });

  return new Promise((fertig) => {
    const fertigKnopf = h('button', { type: 'button', class: 'sp-knopf sp-knopf--haupt sp-knopf--gross' }, 'Fertig');
    const zuruck = h('button', { type: 'button', class: 'sp-knopf sp-knopf--zweit' }, 'Zurücksetzen');
    const titel = h('h2', { class: 'sp-titel', id: titelId, tabindex: '-1' }, einfach ? 'Gestaltet eure Figur' : 'Gestaltet eure Spielfigur');
    const bereich = h('section', { class: 'sp-spiel sp-figur-baukasten', lang: 'de', 'aria-labelledby': titelId },
      h('div', { class: 'sp-figur-links' }, titel,
        h('p', { class: 'sp-hilfetext' }, einfach ? 'Wählt aus. Manche Teile bekommt ihr erst mit einem Sammelstück.' : 'Wählt Teile aus. Manche Teile werden frei, wenn ihr ein bestimmtes Sammelstück habt.'),
        vorschau, h('div', { class: 'sp-aktionen sp-aktionen--start' }, fertigKnopf, zuruck)),
      h('form', { class: 'sp-figur-felder', 'aria-label': 'Teile der Figur' }, felder));
    if (umgebung.hoherKontrast) bereich.classList.add('sp-kontrast');
    if (umgebung.reduzierteBewegung) bereich.classList.add('sp-ruhig');
    wurzel.append(bereich);
    zeigen();
    titel.focus();
    fertigKnopf.addEventListener('click', () => fertig({ ...stand }));
    zuruck.addEventListener('click', () => {
      stand = vollstaendig({}, katalog);
      for (const eingabe of bereich.querySelectorAll('input[type="radio"]')) eingabe.checked = stand[eingabe.name] === eingabe.value;
      zeigen();
    });
    umgebung.signal?.addEventListener('abort', () => fertig(null), { once: true });
  });
}
