// Bildpuzzle: Ein Foto des Orts ist in Teile zerschnitten und gemischt. Die Gruppe tauscht je zwei Teile,
// bis das Bild wieder stimmt. Tippen, Ziehen oder Tastatur (Pfeiltasten, Leertaste); ohne Zeitdruck.
// Tipps: 1 ganzes Foto zeigen, 2 richtige Teile markieren, 3 ein Teil legen (wiederholbar).

import { spielRahmen, h, bewege, neueId, bildnachweis } from '../_gemeinsam/ui.js';
import { symbol } from '../_gemeinsam/symbole.js';
import { sterne } from '../_gemeinsam/protokoll.js';
import { startlage, tausche, geloest, richtigAnzahl, liegtRichtig, naechsterZug, stelle, nachbar } from './logik.js';

export const meta = { id: 'bildpuzzle', titel: 'Bildpuzzle', dauerMinuten: [5, 10], offline: true };

const TIPPS = [
  { text: { standard: 'Jetzt seht ihr das ganze Foto. Vergleicht es mit dem Puzzle.', einfach: 'Hier seht ihr das ganze Foto.' } },
  { text: { standard: 'Teile mit Haken liegen schon richtig. Die lasst ihr liegen.', einfach: 'Ein Haken heißt: Dieses Teil ist richtig.' } },
  { text: { standard: 'Ulla legt ein Teil an seinen Platz. Ecken zuerst!', einfach: 'Ulla legt ein Teil für euch hin.' }, nochmal: { standard: 'Noch ein Teil legen', einfach: 'Noch ein Teil' } },
];

const TASTEN = { ArrowLeft: 'links', ArrowRight: 'rechts', ArrowUp: 'hoch', ArrowDown: 'runter', Home: 'anfang', End: 'ende' };

export async function starte(wurzel, aufgabe, umgebung = {}) {
  return spielRahmen({ wurzel, aufgabe, umgebung, meta, stil: new URL('./stil.css', import.meta.url), aufbau, startbild: false });
}

function aufbau(k) {
  const { aufgabe, t, protokoll, flaeche } = k;
  const spalten = aufgabe.raster?.spalten ?? 3;
  const zeilen = aufgabe.raster?.zeilen ?? 3;
  const anzahl = spalten * zeilen;
  const bild = aufgabe.bild;
  const bildUrl = k.pfad(bild.datei);
  const teilText = (teil) => t(aufgabe.teile?.[teil]) || `Teil ${teil + 1}`;

  let lage = startlage(anzahl, k.startwert);
  let gewaehlt = null;
  let fokusPlatz = 0;
  let markieren = false;
  let fertig = false;
  let falschBeimPruefen = null;
  let unterdrueckeKlick = false;

  const anleitungId = neueId('anleitung');
  const ansageLeise = h('p', { class: 'sp-unsichtbar', 'aria-live': 'polite' });
  const brett = h('div', { class: 'sp-puzzle', role: 'group', 'aria-label': `Puzzle, ${zeilen} Reihen mit je ${spalten} Teilen`, 'aria-describedby': anleitungId });
  brett.style.setProperty('--sp-spalten', String(spalten));
  brett.style.setProperty('--sp-kachel-seiten', String((bild.breite / spalten) / (bild.hoehe / zeilen)));

  const kacheln = Array.from({ length: anzahl }, (_, teil) => {
    const x = teil % spalten;
    const y = Math.floor(teil / spalten);
    const kachel = h('button', { type: 'button', class: 'sp-kachel', dataset: { teil: String(teil) } });
    kachel.style.setProperty('background-image', `url("${bildUrl}")`);
    kachel.style.setProperty('background-size', `${spalten * 100}% ${zeilen * 100}%`);
    kachel.style.setProperty('background-position', `${spalten > 1 ? (x / (spalten - 1)) * 100 : 0}% ${zeilen > 1 ? (y / (zeilen - 1)) * 100 : 0}%`);
    return kachel;
  });

  const platzVon = (kachel) => lage.indexOf(Number(kachel.dataset.teil));

  function beschrifte() {
    lage.forEach((teil, platz) => {
      const kachel = kacheln[teil];
      const { reihe, spalte } = stelle(platz, spalten);
      const richtig = markieren && liegtRichtig(lage, platz);
      const teile = [`Reihe ${reihe}, Platz ${spalte}: ${teilText(teil)}`];
      if (richtig) teile.push('liegt richtig');
      kachel.setAttribute('aria-label', teile.join('. '));
      kachel.setAttribute('aria-pressed', String(gewaehlt === platz));
      kachel.tabIndex = fertig ? -1 : platz === fokusPlatz ? 0 : -1;
      kachel.classList.toggle('sp-kachel--gewaehlt', gewaehlt === platz);
      const haken = kachel.querySelector('.sp-kachel-haken');
      if (richtig && !haken) kachel.append(symbol('haken', 'sp-kachel-haken'));
      if (!richtig && haken) haken.remove();
    });
  }

  function ordne() {
    brett.append(...lage.map((teil) => kacheln[teil]));
  }

  function fokussiere(platz) {
    fokusPlatz = platz;
    beschrifte();
    kacheln[lage[platz]].focus({ preventScroll: true });
  }

  async function tauscheAuf(a, b, { durchTipp = false } = {}) {
    if (fertig || a === b) return;
    if (!durchTipp) protokoll.aktion(falschBeimPruefen ? falschBeimPruefen.has(a) || falschBeimPruefen.has(b) : false);
    falschBeimPruefen = null;
    const beide = [kacheln[lage[a]], kacheln[lage[b]]];
    lage = tausche(lage, a, b);
    gewaehlt = null;
    // Fokus sofort mit dem Umstellen setzen, nicht erst nach der Bewegung: sonst springt er zurück, wenn die Gruppe
    // während der Bewegung schon das nächste Teil wählt.
    await bewege(k, beide, () => {
      ordne();
      fokusPlatz = b;
      beschrifte();
      if (!durchTipp) kacheln[lage[b]].focus({ preventScroll: true });
    }, 280);
    k.ton('klick');
    if (geloest(lage)) { loese(); return; }
    ansageLeise.textContent = `Getauscht. Auf Reihe ${stelle(b, spalten).reihe}, Platz ${stelle(b, spalten).spalte} liegt jetzt: ${teilText(lage[b])}.`;
    if (markieren) k.sage(`${richtigAnzahl(lage)} von ${anzahl} Teilen liegen richtig.`, 'neutral');
  }

  function waehle(platz) {
    if (fertig) return;
    protokoll.rolle('steuern');
    fokusPlatz = platz;
    if (gewaehlt === null) {
      gewaehlt = platz;
      beschrifte();
      ansageLeise.textContent = `Ausgewählt: ${teilText(lage[platz])}. Wählt jetzt das Teil, mit dem es tauschen soll.`;
      return;
    }
    if (gewaehlt === platz) {
      gewaehlt = null;
      beschrifte();
      ansageLeise.textContent = 'Auswahl aufgehoben.';
      return;
    }
    tauscheAuf(gewaehlt, platz);
  }

  // Tippen und Tastatur
  k.lausche(brett, 'click', (ereignis) => {
    const kachel = ereignis.target.closest('.sp-kachel');
    if (!kachel) return;
    if (unterdrueckeKlick) { unterdrueckeKlick = false; return; }
    waehle(platzVon(kachel));
  });
  k.lausche(brett, 'keydown', (ereignis) => {
    const kachel = ereignis.target.closest('.sp-kachel');
    if (!kachel || fertig) return;
    if (ereignis.key === 'Escape' && gewaehlt !== null) { gewaehlt = null; beschrifte(); ansageLeise.textContent = 'Auswahl aufgehoben.'; return; }
    const richtung = TASTEN[ereignis.key];
    if (!richtung) return;
    ereignis.preventDefault();
    fokussiere(nachbar(platzVon(kachel), richtung, spalten, anzahl));
  });

  // Ziehen mit Finger oder Maus: Teil auf ein anderes ziehen, dann tauschen beide.
  let zug = null;
  k.lausche(brett, 'pointerdown', (ereignis) => {
    const kachel = ereignis.target.closest('.sp-kachel');
    if (!kachel || fertig || ereignis.button > 0) return;
    zug = { kachel, platz: platzVon(kachel), x: ereignis.clientX, y: ereignis.clientY, zieht: false, geist: null, ziel: null, id: ereignis.pointerId };
  });
  k.lausche(brett, 'pointermove', (ereignis) => {
    if (!zug || ereignis.pointerId !== zug.id) return;
    const dx = ereignis.clientX - zug.x;
    const dy = ereignis.clientY - zug.y;
    if (!zug.zieht && Math.hypot(dx, dy) < 10) return;
    if (!zug.zieht) {
      zug.zieht = true;
      try { zug.kachel.setPointerCapture(zug.id); } catch { /* weiter ohne */ }
      const rechteck = zug.kachel.getBoundingClientRect();
      zug.geist = h('div', { class: 'sp-schwebend', 'aria-hidden': 'true' });
      for (const eigenschaft of ['background-image', 'background-size', 'background-position']) zug.geist.style.setProperty(eigenschaft, zug.kachel.style.getPropertyValue(eigenschaft));
      zug.geist.style.setProperty('width', `${rechteck.width}px`);
      zug.geist.style.setProperty('height', `${rechteck.height}px`);
      zug.versatz = { x: zug.x - rechteck.left, y: zug.y - rechteck.top };
      k.spiel.append(zug.geist);
      zug.kachel.classList.add('sp-kachel--zieht');
    }
    zug.geist.style.setProperty('left', `${ereignis.clientX - zug.versatz.x}px`);
    zug.geist.style.setProperty('top', `${ereignis.clientY - zug.versatz.y}px`);
    const unten = document.elementFromPoint(ereignis.clientX, ereignis.clientY)?.closest?.('.sp-kachel');
    const ziel = unten && brett.contains(unten) && unten !== zug.kachel ? unten : null;
    if (ziel !== zug.ziel) {
      zug.ziel?.classList.remove('sp-kachel--ziel');
      ziel?.classList.add('sp-kachel--ziel');
      zug.ziel = ziel;
    }
  });
  const zugEnde = (ereignis) => {
    if (!zug || ereignis.pointerId !== zug.id) return;
    const { zieht, ziel, platz, geist, kachel } = zug;
    zug = null;
    if (!zieht) return;
    unterdrueckeKlick = true;
    setTimeout(() => { unterdrueckeKlick = false; }, 400);
    geist?.remove();
    kachel.classList.remove('sp-kachel--zieht');
    ziel?.classList.remove('sp-kachel--ziel');
    if (ziel && ereignis.type === 'pointerup') {
      protokoll.rolle('steuern');
      gewaehlt = null;
      tauscheAuf(platz, platzVon(ziel));
    }
  };
  k.lausche(brett, 'pointerup', zugEnde);
  k.lausche(brett, 'pointercancel', zugEnde);
  k.aufraeumen.push(() => zug?.geist?.remove());

  // Seitenspalte: Anleitung, später das ganze Foto
  const anleitung = h('p', { class: 'sp-hilfetext', id: anleitungId },
    k.u.sprache === 'einfach'
      ? 'Tippt auf ein Teil. Tippt dann auf ein anderes Teil. Die beiden Teile tauschen den Platz.'
      : 'Tippt auf ein Teil und dann auf ein zweites: Die beiden tauschen die Plätze. Ihr könnt ein Teil auch auf ein anderes ziehen. Mit der Tastatur: Pfeiltasten und Leertaste.');
  const vorlage = h('figure', { class: 'sp-vorlage', hidden: true },
    h('img', { src: bildUrl, alt: t(bild.alt), width: bild.breite, height: bild.hoehe }),
    h('figcaption', {}, k.u.sprache === 'einfach' ? 'So sieht das ganze Foto aus.' : 'So soll das Foto am Ende aussehen.'));
  const seite = h('div', { class: 'sp-puzzle-seite' }, anleitung, vorlage);
  const nachweis = bild.quelle ? h('p', { class: 'sp-bildnachweis' }, bildnachweis(bild.quelle)) : null;
  flaeche.buehne.append(h('div', { class: 'sp-puzzle-feld' }, h('div', { class: 'sp-puzzle-spalte' }, brett, nachweis), seite), ansageLeise);
  ordne();
  beschrifte();

  // Tipps und Prüfen
  k.tipps({
    liste: (aufgabe.tipps?.length === 3 ? aufgabe.tipps : TIPPS),
    wiederholbar: true,
    beiTipp: (stufe) => {
      if (stufe >= 1) vorlage.hidden = false;
      if (stufe >= 2) { markieren = true; beschrifte(); k.sage(`${richtigAnzahl(lage)} von ${anzahl} Teilen liegen richtig.`, 'neutral'); }
      if (stufe >= 3) {
        const naechster = naechsterZug(lage, spalten);
        if (naechster) tauscheAuf(naechster[0], naechster[1], { durchTipp: true });
      }
    },
  });
  const pruefen = k.knopf({
    text: 'Prüfen', symbol: 'pruefen', art: 'haupt', rolle: 'pruefen',
    beiKlick: () => {
      if (fertig) return;
      protokoll.aktion(false);
      protokoll.versuch(false);
      falschBeimPruefen = new Set(lage.flatMap((teil, platz) => (teil === platz ? [] : [platz])));
      const richtig = richtigAnzahl(lage);
      const ermutigung = richtig >= anzahl - 2 ? 'Fast geschafft!' : richtig >= anzahl / 2 ? 'Gut, weiter so!' : 'Schaut auf Ränder und Ecken.';
      k.sage(`${richtig} von ${anzahl} Teilen liegen schon richtig. ${ermutigung}`, 'hinweis');
    },
  });
  flaeche.aktionen.append(pruefen);

  function loese() {
    fertig = true;
    protokoll.versuch(true);
    brett.classList.add('sp-puzzle--fertig');
    for (const kachel of kacheln) { kachel.disabled = true; kachel.removeAttribute('aria-pressed'); kachel.setAttribute('aria-hidden', 'true'); }
    brett.removeAttribute('aria-describedby');
    brett.setAttribute('aria-label', `Fertiges Foto: ${t(bild.alt)}`);
    k.sage(k.u.sprache === 'einfach' ? 'Geschafft! Das Foto ist wieder ganz.' : 'Geschafft! Das Foto ist wieder ganz.', 'gut');
    const punkte = sterne({ geloest: true, versuche: protokoll.versuche, hilfen: protokoll.hilfen, glatt: 1, gut: 3 });
    const weiter = k.knopf({ text: 'Weiter', symbol: 'weiter', art: 'haupt', gross: true, beiKlick: () => k.fertig({ geloest: true, punkte }) });
    flaeche.werkzeuge.replaceChildren();
    flaeche.aktionen.replaceChildren(weiter);
    flaeche.tippBox.hidden = true;
    weiter.focus();
  }
}
