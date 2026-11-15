// Spurensuche im Bild: Auf einem Foto des Orts stecken Details, die die Gruppe finden soll (in beliebiger Reihenfolge).
// Antippen genügt; per Tastatur wandert ein Suchrahmen über ein Raster (Pfeiltasten, Eingabe). Für Bildschirmleser
// beschreibt jedes Feld, was darin zu sehen ist. Vergrößern per Knopf. Tipps je Detail: Hinweis, Bereich, genaue Stelle.

import { spielRahmen, h, neueId } from '../_gemeinsam/ui.js';
import { symbol } from '../_gemeinsam/symbole.js';
import { sterne } from '../_gemeinsam/protokoll.js';
import { trifft, feldTrifft, zielKreis, lageInWorten, anderswo } from './logik.js';

export const meta = { id: 'bildsuche', titel: 'Spurensuche im Bild', dauerMinuten: [5, 10], offline: true };

const ZOOMSTUFEN = [1, 1.5, 2, 3];
const TASTEN = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export async function starte(wurzel, aufgabe, umgebung = {}) {
  return spielRahmen({ wurzel, aufgabe, umgebung, meta, stil: new URL('./stil.css', import.meta.url), aufbau, startbild: true });
}

function aufbau(k) {
  const { aufgabe, t, protokoll, flaeche, u } = k;
  const bild = aufgabe.bild;
  const spalten = aufgabe.raster?.spalten ?? 4;
  const zeilen = aufgabe.raster?.zeilen ?? 4;
  const ziele = aufgabe.ziele;
  const gefunden = new Set();
  let zoom = 0;
  let fokus = { spalte: 0, zeile: 0 };
  let letzterFehlklick = null;
  let fertig = false;
  const naechstesZiel = () => ziele.find((z) => !gefunden.has(z.id));

  // Bild mit Raster
  const rahmen = h('div', { class: 'sp-suchbild-rahmen' });
  const flaecheBild = h('div', { class: 'sp-suchbild' });
  flaecheBild.style.setProperty('--sp-seiten', String(bild.breite / bild.hoehe));
  const img = h('img', { src: k.pfad(bild.datei), alt: t(bild.alt), width: bild.breite, height: bild.hoehe, draggable: 'false' });
  const markierungen = h('div', { class: 'sp-marken', 'aria-hidden': 'true' });
  const rasterId = neueId('raster');
  const raster = h('div', { class: 'sp-suchraster', role: 'group', 'aria-label': `Suchfelder, ${zeilen} Reihen mit je ${spalten} Feldern`, 'aria-describedby': `${rasterId}-hilfe` });
  raster.style.setProperty('--sp-felder-x', String(spalten));
  raster.style.setProperty('--sp-felder-y', String(zeilen));
  const felder = [];
  for (let zeile = 0; zeile < zeilen; zeile++) {
    for (let spalte = 0; spalte < spalten; spalte++) {
      const beschreibung = t(aufgabe.felder?.[zeile * spalten + spalte]);
      const feld = h('button', {
        type: 'button', class: 'sp-feld', tabindex: zeile === 0 && spalte === 0 ? '0' : '-1', dataset: { spalte: String(spalte), zeile: String(zeile) },
        'aria-label': `Reihe ${zeile + 1}, Feld ${spalte + 1}${beschreibung ? `: ${beschreibung}` : ''}. Hier suchen`,
      });
      felder.push(feld);
      raster.append(feld);
    }
  }
  flaecheBild.append(img, markierungen, raster);
  rahmen.append(flaecheBild);
  const ansageLeise = h('p', { class: 'sp-unsichtbar', 'aria-live': 'polite' });

  // Zielliste
  const zielListe = h('ol', { class: 'sp-ziele', 'aria-label': 'Das sollt ihr finden' });
  const zielEintraege = new Map();
  for (const [i, ziel] of ziele.entries()) {
    const erklaerung = h('small', { hidden: true });
    const eintrag = h('li', { class: 'sp-ziel' },
      h('span', { class: 'sp-ziel-nr', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 'sp-ziel-text' }, h('span', { 'data-vorlesen': '' }, t(ziel.frage)), h('span', { class: 'sp-unsichtbar sp-ziel-stand' }, ' (noch nicht gefunden)'), erklaerung));
    zielEintraege.set(ziel.id, { eintrag, erklaerung, nr: i + 1 });
  }
  zielListe.append(...[...zielEintraege.values()].map((e) => e.eintrag));

  const zoomAnzeige = h('span', { class: 'sp-zoom-wert', 'aria-live': 'polite' }, '100 %');
  const kleiner = k.knopf({ text: 'Kleiner', symbol: 'minus', art: 'zweit', klein: true, rolle: 'steuern', beiKlick: () => setzeZoom(zoom - 1) });
  const groesser = k.knopf({ text: 'Größer', symbol: 'plus', art: 'zweit', klein: true, rolle: 'steuern', beiKlick: () => setzeZoom(zoom + 1) });
  function setzeZoom(stufe) {
    zoom = Math.max(0, Math.min(ZOOMSTUFEN.length - 1, stufe));
    flaecheBild.style.setProperty('--sp-zoom', String(ZOOMSTUFEN[zoom]));
    zoomAnzeige.textContent = `${Math.round(ZOOMSTUFEN[zoom] * 100)} %`;
    kleiner.setAttribute('aria-disabled', String(zoom === 0));
    groesser.setAttribute('aria-disabled', String(zoom === ZOOMSTUFEN.length - 1));
  }

  flaeche.buehne.append(h('div', { class: 'sp-suche' },
    h('div', { class: 'sp-suche-bild' }, rahmen,
      h('div', { class: 'sp-suche-unter' }, h('div', { class: 'sp-zoom' }, kleiner, zoomAnzeige, groesser), h('p', { class: 'sp-bildnachweis' }, bild.quelle))),
    h('div', { class: 'sp-suche-seite' },
      h('h3', { class: 'sp-zwischentitel' }, u.sprache === 'einfach' ? 'Findet diese Dinge:' : 'Das sollt ihr finden'),
      zielListe,
      h('p', { class: 'sp-hilfetext', id: `${rasterId}-hilfe` }, u.sprache === 'einfach'
        ? 'Tippt auf das Bild, wo ihr etwas seht. Mit der Tastatur: Pfeiltasten und Eingabe.'
        : 'Tippt im Foto auf die Stelle. Mit der Tastatur wandert ein Suchrahmen mit den Pfeiltasten; Eingabe sucht im Feld.'))), ansageLeise);
  setzeZoom(0);
  aktualisiereListe();

  function aktualisiereListe() {
    const naechstes = naechstesZiel();
    for (const ziel of ziele) {
      const { eintrag } = zielEintraege.get(ziel.id);
      eintrag.classList.toggle('sp-ziel--gefunden', gefunden.has(ziel.id));
      eintrag.classList.toggle('sp-ziel--jetzt', naechstes?.id === ziel.id);
      eintrag.querySelector('.sp-ziel-stand').textContent = gefunden.has(ziel.id) ? ' (gefunden)' : ' (noch nicht gefunden)';
      const nr = eintrag.querySelector('.sp-ziel-nr');
      nr.replaceChildren(gefunden.has(ziel.id) ? symbol('haken') : String(zielEintraege.get(ziel.id).nr));
    }
  }

  function setzeMarke(klasse, x, y, groesse, inhalt) {
    const marke = h('span', { class: klasse }, inhalt);
    marke.style.setProperty('left', `${x * 100}%`);
    marke.style.setProperty('top', `${y * 100}%`);
    if (groesse) { marke.style.setProperty('width', `${groesse}px`); marke.style.setProperty('height', `${groesse}px`); }
    markierungen.append(marke);
    return marke;
  }

  function entferneHilfen() {
    markierungen.querySelectorAll('.sp-leuchten, .sp-licht').forEach((m) => m.remove());
  }

  function finde(ziel) {
    gefunden.add(ziel.id);
    protokoll.versuch(true);
    letzterFehlklick = null;
    entferneHilfen();
    const kreis = zielKreis(ziel.bereiche);
    setzeMarke('sp-fund', kreis.x, kreis.y, 64, h('span', { class: 'sp-fund-nr' }, String(zielEintraege.get(ziel.id).nr)));
    const { erklaerung } = zielEintraege.get(ziel.id);
    erklaerung.textContent = t(ziel.gefunden);
    erklaerung.hidden = false;
    aktualisiereListe();
    tipps.zuruecksetzen();
    if (gefunden.size === ziele.length) { loese(); return; }
    k.sage(`${u.sprache === 'einfach' ? 'Gefunden!' : 'Gefunden!'} ${t(ziel.gefunden)} ${gefunden.size} von ${ziele.length}.`, 'gut');
  }

  function fehlklick(punkt, ort) {
    protokoll.versuch(false);
    letzterFehlklick = punkt;
    const marke = setzeMarke('sp-fehlklick', punkt.x, punkt.y, 0, null);
    k.warte(1400).then(() => marke.remove());
    k.sage(u.sprache === 'einfach' ? `Hier ist es nicht${ort}. Schaut genau hin!` : `Hier ist nichts zu finden${ort}. Schaut genauer hin!`, 'hinweis');
  }

  function suche(punkt, feld) {
    if (fertig) return;
    protokoll.rolle('steuern');
    protokoll.aktion(letzterFehlklick ? anderswo(letzterFehlklick, punkt) : false);
    const offen = ziele.filter((z) => !gefunden.has(z.id));
    const treffer = feld
      ? offen.find((z) => feldTrifft(feld.spalte, feld.zeile, spalten, zeilen, z.bereiche))
      : offen.find((z) => trifft(punkt.x, punkt.y, z.bereiche, 0.02));
    if (treffer) finde(treffer);
    else fehlklick(punkt, feld ? ` (Reihe ${feld.zeile + 1}, Feld ${feld.spalte + 1})` : '');
  }

  // Antippen (genaue Stelle) oder Tastatur (Feld)
  k.lausche(raster, 'click', (ereignis) => {
    const feldEl = ereignis.target.closest('.sp-feld');
    if (!feldEl) return;
    const feld = { spalte: Number(feldEl.dataset.spalte), zeile: Number(feldEl.dataset.zeile) };
    if (ereignis.detail === 0) {
      // Tastatur oder Bildschirmleser: das ganze Feld zählt
      suche({ x: (feld.spalte + 0.5) / spalten, y: (feld.zeile + 0.5) / zeilen }, feld);
    } else {
      const r = flaecheBild.getBoundingClientRect();
      suche({ x: (ereignis.clientX - r.left) / r.width, y: (ereignis.clientY - r.top) / r.height }, null);
    }
  });
  k.lausche(raster, 'keydown', (ereignis) => {
    const richtung = TASTEN[ereignis.key];
    if (!richtung) return;
    ereignis.preventDefault();
    fokus = { spalte: Math.max(0, Math.min(spalten - 1, fokus.spalte + richtung[0])), zeile: Math.max(0, Math.min(zeilen - 1, fokus.zeile + richtung[1])) };
    felder.forEach((f) => f.setAttribute('tabindex', '-1'));
    const ziel = felder[fokus.zeile * spalten + fokus.spalte];
    ziel.setAttribute('tabindex', '0');
    ziel.focus();
    ziel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  k.lausche(raster, 'focusin', (ereignis) => {
    const feldEl = ereignis.target.closest('.sp-feld');
    if (feldEl) fokus = { spalte: Number(feldEl.dataset.spalte), zeile: Number(feldEl.dataset.zeile) };
  });

  // Tipps für das erste noch offene Detail: 1 Hinweis, 2 Bereich, 3 genaue Stelle
  const tipps = k.tipps({
    liste: [
      { get text() { return naechstesZiel()?.tipp ?? { standard: 'Schaut genau hin.', einfach: 'Schaut genau hin.' }; } },
      { get text() { const z = naechstesZiel(); const kr = z && zielKreis(z.bereiche); return kr ? { standard: `Sucht ${lageInWorten(kr.x, kr.y)} im Foto. Der helle Rahmen zeigt den Bereich.`, einfach: `Sucht ${lageInWorten(kr.x, kr.y)}. Im hellen Rahmen.` } : ''; } },
      { get text() { return { standard: 'Der leuchtende Kreis zeigt die Stelle. Tippt darauf!', einfach: 'Tippt auf den leuchtenden Kreis.' }; } },
    ],
    beiTipp: (stufe) => {
      const ziel = naechstesZiel();
      if (!ziel) return;
      const kreis = zielKreis(ziel.bereiche);
      entferneHilfen();
      if (stufe >= 2) {
        const r = kreis.rahmen;
        const rand = 0.06;
        const licht = setzeMarke('sp-licht', Math.max(0, r.x - rand), Math.max(0, r.y - rand), 0, null);
        licht.style.setProperty('width', `${Math.min(1, r.b + 2 * rand) * 100}%`);
        licht.style.setProperty('height', `${Math.min(1, r.h + 2 * rand) * 100}%`);
      }
      if (stufe >= 3) setzeMarke('sp-leuchten', kreis.x, kreis.y, 80, null);
    },
  });

  function loese() {
    fertig = true;
    felder.forEach((f) => { f.disabled = true; });
    const fehl = protokoll.versuche - ziele.length;
    k.sage(u.sprache === 'einfach' ? 'Super! Ihr habt alles gefunden.' : `Super, alle ${ziele.length} Dinge gefunden!`, 'gut');
    const punkte = sterne({ geloest: true, versuche: ziele.length + Math.max(0, fehl), hilfen: protokoll.hilfen, glatt: ziele.length + 2, gut: ziele.length + 6 });
    const weiter = k.knopf({ text: 'Weiter', symbol: 'weiter', art: 'haupt', gross: true, beiKlick: () => k.fertig({ geloest: true, punkte }) });
    flaeche.werkzeuge.replaceChildren();
    flaeche.tippBox.hidden = true;
    flaeche.aktionen.replaceChildren(weiter);
    weiter.focus();
  }
}
