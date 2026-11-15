// Sortieren und Zuordnen: Karten in die richtige Reihenfolge bringen (art „reihenfolge“, etwa eine Zeitleiste oder
// Arbeitsschritte) oder Gruppen zuordnen (art „gruppen“, etwa deutsche und sorbische Ortsnamen).
// Bedienung: Pfeil-Knöpfe, Ziehen am Griff oder Auswählen und Ablegen; alles auch mit der Tastatur. Kein Zeitdruck.

import { spielRahmen, h, neueId, bewege } from '../_gemeinsam/ui.js';
import { symbol } from '../_gemeinsam/symbole.js';
import { sterne } from '../_gemeinsam/protokoll.js';
import { startreihe, verschiebe, setze, pruefeReihe, naechsteKarte, pruefeGruppen, naechsteZuordnung } from './logik.js';
import { mische } from '../_gemeinsam/zufall.js';

export const meta = { id: 'sortieren', titel: 'Sortieren und Zuordnen', dauerMinuten: [5, 10], offline: true };

export async function starte(wurzel, aufgabe, umgebung = {}) {
  return spielRahmen({ wurzel, aufgabe, umgebung, meta, stil: new URL('./stil.css', import.meta.url), aufbau });
}

function aufbau(k) {
  if (k.aufgabe.art === 'gruppen') zuordnen(k);
  else reihenfolge(k);
}

function weiterNachLoesung(k, punkte) {
  const { flaeche } = k;
  const weiter = k.knopf({ text: 'Weiter', symbol: 'weiter', art: 'haupt', gross: true, beiKlick: () => k.fertig({ geloest: true, punkte }) });
  flaeche.werkzeuge.replaceChildren();
  flaeche.tippBox.hidden = true;
  flaeche.aktionen.replaceChildren(weiter);
  weiter.focus();
}

// ---------------------------------------------------------------- Reihenfolge
function reihenfolge(k) {
  const { aufgabe, t, protokoll, flaeche, u } = k;
  const karten = aufgabe.karten;
  const richtig = karten.map((karte) => karte.id);
  const nachId = new Map(karten.map((karte) => [karte.id, karte]));
  let reihe = startreihe(karten, k.startwert);
  let markieren = false;
  let falschBeimPruefen = null;
  let fertig = false;

  const ansageLeise = h('p', { class: 'sp-unsichtbar', 'aria-live': 'polite' });
  const listeId = neueId('liste');
  const liste = h('ol', { class: 'sp-liste', id: listeId, 'aria-label': `${t(aufgabe.enden?.anfang) || 'Anfang'} oben, ${t(aufgabe.enden?.ende) || 'Ende'} unten` });
  const elemente = new Map();

  for (const karte of karten) {
    const text = t(karte.text);
    const hoch = k.knopf({ text: '', symbol: 'hoch', art: 'zweit', label: `nach oben: ${text}`, beiKlick: () => bewegeKarte(karte.id, -1, 'hoch') });
    const runter = k.knopf({ text: '', symbol: 'runter', art: 'zweit', label: `nach unten: ${text}`, beiKlick: () => bewegeKarte(karte.id, 1, 'runter') });
    const griff = h('span', { class: 'sp-griff', 'aria-hidden': 'true', title: 'Ziehen' }, symbol('ziehen'));
    const markierung = h('span', { class: 'sp-markierung', hidden: true });
    const zusatz = karte.zusatz ? h('small', { class: 'sp-zusatz', hidden: true }, t(karte.zusatz)) : null;
    const li = h('li', { class: 'sp-sortkarte', dataset: { karte: karte.id } },
      griff,
      h('span', { class: 'sp-platz', 'aria-hidden': 'true' }),
      karte.bild ? h('img', { src: k.pfad(karte.bild.datei), alt: t(karte.bild.alt), width: 64, height: 64 }) : null,
      h('span', { class: 'sp-sorttext' }, h('span', { 'data-vorlesen': '' }, text), zusatz, markierung),
      h('span', { class: 'sp-pfeile' }, hoch, runter));
    elemente.set(karte.id, { li, hoch, runter, markierung, zusatz, griff });
  }

  function zeichne() {
    liste.append(...reihe.map((id) => elemente.get(id).li));
    const stand = pruefeReihe(reihe, richtig);
    reihe.forEach((id, platz) => {
      const { li, hoch, runter, markierung } = elemente.get(id);
      li.querySelector('.sp-platz').textContent = String(platz + 1);
      li.setAttribute('aria-label', `Platz ${platz + 1} von ${reihe.length}: ${t(nachId.get(id).text)}`);
      hoch.setAttribute('aria-disabled', String(platz === 0 || fertig));
      runter.setAttribute('aria-disabled', String(platz === reihe.length - 1 || fertig));
      const zeigen = markieren || fertig;
      li.classList.toggle('sp-sortkarte--richtig', zeigen && stand[platz]);
      li.classList.toggle('sp-sortkarte--falsch', zeigen && !stand[platz]);
      markierung.hidden = !zeigen;
      if (zeigen) markierung.replaceChildren(symbol(stand[platz] ? 'haken' : 'info'), h('span', {}, stand[platz] ? 'richtiger Platz' : 'noch nicht'));
    });
  }

  async function bewegeKarte(id, schritt, knopfName, { durchTipp = false } = {}) {
    if (fertig) return;
    const von = reihe.indexOf(id);
    const neu = verschiebe(reihe, von, schritt);
    if (neu.join() === reihe.join()) return;
    if (!durchTipp) {
      protokoll.rolle('steuern');
      protokoll.aktion(falschBeimPruefen ? falschBeimPruefen.has(id) : false);
    }
    falschBeimPruefen = null;
    const betroffen = [...elemente.values()].map((e) => e.li);
    reihe = neu;
    // Fokus sofort mit dem Umstellen setzen (nicht nach der Bewegung), damit schnelle Eingaben nicht verrutschen.
    await bewege(k, betroffen, () => {
      zeichne();
      if (durchTipp) return;
      const ziel = elemente.get(id)[knopfName];
      if (ziel && ziel.getAttribute('aria-disabled') !== 'true') ziel.focus({ preventScroll: true });
      else elemente.get(id)[knopfName === 'hoch' ? 'runter' : 'hoch']?.focus({ preventScroll: true });
    }, 240);
    const platz = reihe.indexOf(id);
    ansageLeise.textContent = `${t(nachId.get(id).text)}: jetzt Platz ${platz + 1} von ${reihe.length}.`;
    k.ton('klick');
  }

  // Ziehen am Griff
  let zug = null;
  k.lausche(liste, 'pointerdown', (ereignis) => {
    const griff = ereignis.target.closest('.sp-griff');
    if (!griff || fertig) return;
    const li = griff.closest('.sp-sortkarte');
    zug = { id: li.dataset.karte, li, ziel: null, zeiger: ereignis.pointerId };
    try { griff.setPointerCapture(ereignis.pointerId); } catch { /* weiter */ }
    li.classList.add('sp-sortkarte--zieht');
    ereignis.preventDefault();
  });
  k.lausche(liste, 'pointermove', (ereignis) => {
    if (!zug || ereignis.pointerId !== zug.zeiger) return;
    const unter = document.elementFromPoint(ereignis.clientX, ereignis.clientY)?.closest?.('.sp-sortkarte');
    const ziel = unter && liste.contains(unter) && unter !== zug.li ? unter : null;
    if (ziel !== zug.ziel) { zug.ziel?.classList.remove('sp-sortkarte--ziel'); ziel?.classList.add('sp-sortkarte--ziel'); zug.ziel = ziel; }
  });
  const zugEnde = (ereignis) => {
    if (!zug || ereignis.pointerId !== zug.zeiger) return;
    const { id, li, ziel } = zug;
    zug = null;
    li.classList.remove('sp-sortkarte--zieht');
    ziel?.classList.remove('sp-sortkarte--ziel');
    if (ziel && ereignis.type === 'pointerup') {
      const von = reihe.indexOf(id);
      const nach = reihe.indexOf(ziel.dataset.karte);
      bewegeKarte(id, nach - von, 'hoch');
    }
  };
  k.lausche(liste, 'pointerup', zugEnde);
  k.lausche(liste, 'pointercancel', zugEnde);

  const enden = (text, art) => (text ? h('p', { class: `sp-ende sp-ende--${art}`, 'aria-hidden': 'true' }, symbol(art === 'anfang' ? 'hoch' : 'runter'), h('span', {}, text)) : null);
  flaeche.buehne.append(h('div', { class: 'sp-sortieren' },
    aufgabe.bild ? h('figure', { class: 'sp-sortier-bild' }, h('img', { src: k.pfad(aufgabe.bild.datei), alt: t(aufgabe.bild.alt), width: aufgabe.bild.breite, height: aufgabe.bild.hoehe }), h('figcaption', { class: 'sp-bildnachweis' }, aufgabe.bild.quelle)) : null,
    h('div', { class: 'sp-sortier-spalte' },
      h('p', { class: 'sp-hilfetext' }, u.sprache === 'einfach' ? 'Verschiebt die Karten mit den Pfeilen.' : 'Verschiebt die Karten mit den Pfeilen oder zieht sie am Griff links.'),
      enden(t(aufgabe.enden?.anfang), 'anfang'), liste, enden(t(aufgabe.enden?.ende), 'ende'))), ansageLeise);
  zeichne();

  k.tipps({
    liste: aufgabe.tipps,
    wiederholbar: true,
    beiTipp: (stufe) => {
      if (stufe >= 2) { markieren = true; zeichne(); }
      if (stufe >= 3) {
        const zug3 = naechsteKarte(reihe, richtig);
        if (zug3) bewegeKarte(reihe[zug3[0]], zug3[1] - zug3[0], 'hoch', { durchTipp: true }).then(pruefeLoesung);
      }
    },
  });

  function pruefeLoesung() {
    if (fertig || pruefeReihe(reihe, richtig).some((x) => !x)) return false;
    fertig = true;
    protokoll.versuch(true);
    for (const e of elemente.values()) if (e.zusatz) e.zusatz.hidden = false;
    zeichne();
    k.sage(u.sprache === 'einfach' ? 'Richtig! Alle Karten liegen gut.' : 'Richtig! Alle Karten liegen an ihrem Platz.', 'gut');
    weiterNachLoesung(k, sterne({ geloest: true, versuche: protokoll.versuche, hilfen: protokoll.hilfen, glatt: 1, gut: 3 }));
    return true;
  }

  flaeche.aktionen.append(k.knopf({
    text: 'Prüfen', symbol: 'pruefen', art: 'haupt', rolle: 'pruefen',
    beiKlick: () => {
      if (fertig) return;
      if (falschBeimPruefen) protokoll.aktion(false);
      const stand = pruefeReihe(reihe, richtig);
      if (stand.every(Boolean)) { pruefeLoesung(); return; }
      protokoll.versuch(false);
      falschBeimPruefen = new Set(reihe.filter((_, platz) => !stand[platz]));
      markieren = true;
      zeichne();
      const anzahl = stand.filter(Boolean).length;
      k.sage(u.sprache === 'einfach'
        ? `${anzahl} von ${reihe.length} Karten sind richtig. Ein Haken heißt: richtig.`
        : `${anzahl} von ${reihe.length} Karten liegen richtig. Karten mit Haken passen schon.`, 'hinweis');
    },
  }));
}

// ---------------------------------------------------------------- Gruppen (Zuordnen)
function zuordnen(k) {
  const { aufgabe, t, protokoll, flaeche, u } = k;
  const karten = aufgabe.karten;
  const gruppen = aufgabe.gruppen;
  const zuordnung = Object.fromEntries(karten.map((karte) => [karte.id, null]));
  let gewaehlt = null;
  let markieren = false;
  let falschBeimPruefen = null;
  let fertig = false;

  const ansageLeise = h('p', { class: 'sp-unsichtbar', 'aria-live': 'polite' });
  const chips = new Map();
  for (const karte of karten) {
    const chip = h('button', { type: 'button', class: 'sp-chip', 'aria-pressed': 'false', dataset: { karte: karte.id } },
      h('span', { 'data-vorlesen': '' }, t(karte.text)), h('span', { class: 'sp-chip-stand' }));
    chip.addEventListener('click', () => waehle(karte.id));
    chips.set(karte.id, chip);
  }

  const ablageListe = h('div', { class: 'sp-ablage-karten' });
  const ablageKnopf = k.knopf({ text: 'Zurück in die Ablage', symbol: 'zurueck', art: 'leise', klein: true, rolle: 'steuern', 'aria-disabled': 'true', beiKlick: () => lege(null) });
  const ablage = h('section', { class: 'sp-ablage', 'aria-label': 'Ablage: Karten ohne Gruppe' },
    h('p', { class: 'sp-ablage-titel' }, u.sprache === 'einfach' ? 'Diese Karten liegen noch hier:' : 'Noch nicht zugeordnet:'), ablageListe, ablageKnopf);
  const gruppenListen = new Map();
  const gruppenKnoepfe = new Map();
  const gruppenFelder = gruppen.map((gruppe) => {
    const titel = t(gruppe.titel);
    const listeG = h('div', { class: 'sp-gruppe-karten' });
    const knopf = k.knopf({ text: 'Hierher legen', symbol: 'hand', art: 'zweit', klein: true, rolle: 'steuern', label: `Hierher legen: ${titel}`, 'aria-disabled': 'true', beiKlick: () => lege(gruppe.id) });
    gruppenListen.set(gruppe.id, listeG);
    gruppenKnoepfe.set(gruppe.id, knopf);
    return h('section', { class: 'sp-gruppe', dataset: { gruppe: gruppe.id }, 'aria-label': titel },
      h('p', { class: 'sp-gruppe-titel' }, gruppe.bild ? h('img', { src: k.pfad(gruppe.bild.datei), alt: '', width: 44, height: 44 }) : null, h('span', { 'data-vorlesen': '' }, titel)),
      listeG, knopf);
  });

  function zeichne() {
    const reihenfolge = mische(karten.map((karte) => karte.id), k.startwert);
    ablageListe.replaceChildren(...reihenfolge.filter((id) => zuordnung[id] == null).map((id) => chips.get(id)));
    for (const gruppe of gruppen) {
      gruppenListen.get(gruppe.id).replaceChildren(...karten.filter((karte) => zuordnung[karte.id] === gruppe.id).map((karte) => chips.get(karte.id)));
    }
    const stand = pruefeGruppen(zuordnung, karten).stand;
    for (const karte of karten) {
      const chip = chips.get(karte.id);
      const zeigen = (markieren || fertig) && stand[karte.id] !== 'offen';
      chip.classList.toggle('sp-chip--richtig', zeigen && stand[karte.id] === 'richtig');
      chip.classList.toggle('sp-chip--falsch', zeigen && stand[karte.id] === 'falsch');
      const anzeige = chip.querySelector('.sp-chip-stand');
      anzeige.replaceChildren(...(zeigen ? [symbol(stand[karte.id] === 'richtig' ? 'haken' : 'info'), h('span', { class: 'sp-unsichtbar' }, stand[karte.id] === 'richtig' ? ' (richtig)' : ' (noch nicht)')] : []));
      chip.setAttribute('aria-pressed', String(gewaehlt === karte.id));
      if (fertig) chip.setAttribute('aria-disabled', 'true');
    }
    const aktiv = gewaehlt != null && !fertig;
    for (const knopf of gruppenKnoepfe.values()) knopf.setAttribute('aria-disabled', String(!aktiv));
    ablageKnopf.setAttribute('aria-disabled', String(!aktiv || zuordnung[gewaehlt] == null));
    ablageKnopf.hidden = karten.every((karte) => zuordnung[karte.id] == null);
    for (const feld of gruppenFelder) feld.classList.toggle('sp-gruppe--ziel', aktiv);
  }

  function waehle(id) {
    if (fertig) return;
    protokoll.rolle('steuern');
    gewaehlt = gewaehlt === id ? null : id;
    zeichne();
    if (gewaehlt) ansageLeise.textContent = `${t(karten.find((karte) => karte.id === id).text)} ausgewählt. Wählt jetzt „Hierher legen“ bei der passenden Gruppe.`;
  }

  function lege(gruppeId, { durchTipp = false } = {}) {
    if (fertig || gewaehlt == null) return;
    if (!durchTipp) protokoll.aktion(falschBeimPruefen ? falschBeimPruefen.has(gewaehlt) : false);
    falschBeimPruefen = null;
    const id = gewaehlt;
    zuordnung[id] = gruppeId;
    gewaehlt = null;
    zeichne();
    chips.get(id).focus();
    const ziel = gruppeId ? t(gruppen.find((g) => g.id === gruppeId).titel) : 'die Ablage';
    ansageLeise.textContent = `${t(karten.find((karte) => karte.id === id).text)} liegt jetzt bei ${ziel}.`;
    k.ton('klick');
    if (pruefeGruppen(zuordnung, karten).geloest && markieren) loesung();
  }

  flaeche.buehne.append(h('div', { class: 'sp-sortieren' },
    aufgabe.bild ? h('figure', { class: 'sp-sortier-bild sp-sortier-bild--klein' }, h('img', { src: k.pfad(aufgabe.bild.datei), alt: t(aufgabe.bild.alt), width: aufgabe.bild.breite, height: aufgabe.bild.hoehe }), h('figcaption', { class: 'sp-bildnachweis' }, aufgabe.bild.quelle)) : null,
    h('div', { class: 'sp-sortier-spalte' },
      h('p', { class: 'sp-hilfetext' }, u.sprache === 'einfach' ? 'Tippt eine Karte an. Tippt dann bei der passenden Gruppe auf „Hierher legen“.' : 'Tippt eine Karte an und dann bei der passenden Gruppe auf „Hierher legen“.'),
      ablage,
      h('div', { class: 'sp-gruppen' }, gruppenFelder))), ansageLeise);
  zeichne();

  k.tipps({
    liste: aufgabe.tipps,
    wiederholbar: true,
    beiTipp: (stufe) => {
      if (stufe >= 2) { markieren = true; zeichne(); }
      if (stufe >= 3) {
        const zug = naechsteZuordnung(zuordnung, karten);
        if (zug) { gewaehlt = zug[0]; lege(zug[1], { durchTipp: true }); }
      }
    },
  });

  function loesung() {
    if (fertig) return;
    fertig = true;
    protokoll.versuch(true);
    gewaehlt = null;
    zeichne();
    for (const knopf of gruppenKnoepfe.values()) knopf.hidden = true;
    ablage.hidden = true;
    k.sage(u.sprache === 'einfach' ? 'Richtig! Alle Karten passen.' : 'Richtig! Jede Karte liegt in der passenden Gruppe.', 'gut');
    weiterNachLoesung(k, sterne({ geloest: true, versuche: protokoll.versuche, hilfen: protokoll.hilfen, glatt: 1, gut: 3 }));
  }

  flaeche.aktionen.append(k.knopf({
    text: 'Prüfen', symbol: 'pruefen', art: 'haupt', rolle: 'pruefen',
    beiKlick: () => {
      if (fertig) return;
      if (falschBeimPruefen) protokoll.aktion(false);
      const ergebnis = pruefeGruppen(zuordnung, karten);
      if (ergebnis.geloest) { loesung(); return; }
      protokoll.versuch(false);
      falschBeimPruefen = new Set(Object.entries(ergebnis.stand).filter(([, s]) => s !== 'richtig').map(([id]) => id));
      markieren = true;
      zeichne();
      const offen = ergebnis.offen ? (u.sprache === 'einfach' ? ` ${ergebnis.offen} Karten liegen noch in der Ablage.` : ` ${ergebnis.offen} liegen noch in der Ablage.`) : '';
      k.sage(`${ergebnis.richtig} von ${karten.length} Karten sind richtig zugeordnet.${offen}`, 'hinweis');
    },
  }));
}
