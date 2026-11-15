// Schätzfrage: Die Gruppe schätzt eine Zahl zum Ort, erst jede und jeder allein (Schätzrunde) oder gleich gemeinsam,
// einigt sich auf einen Wert und sieht dann die Auflösung mit einem Vergleich zum Anfassen.
// Regler, Zahlenfeld und Knöpfe „weniger“/„mehr“; Tastatur und Bildschirmleser vollständig. Kein Zeitdruck.

import { spielRahmen, h, neueId } from '../_gemeinsam/ui.js';
import { symbol } from '../_gemeinsam/symbole.js';
import { mitEinheit, grosseZahl } from '../_gemeinsam/sprache.js';
import { REGLER_MAX, reglerZuWert, wertZuRegler, schrittWert, leseZahl, bewerte, mitte, inRichtigeRichtung, runde } from './logik.js';

export const meta = { id: 'schaetzen', titel: 'Schätzfrage', dauerMinuten: [5, 10], offline: true };

export async function starte(wurzel, aufgabe, umgebung = {}) {
  return spielRahmen({ wurzel, aufgabe, umgebung, meta, stil: new URL('./stil.css', import.meta.url), aufbau });
}

function aufbau(k) {
  const { aufgabe, t, protokoll, flaeche, u } = k;
  const skala = aufgabe.skala === 'log' ? 'log' : 'linear';
  const bereich = aufgabe.bereich;
  const einheit = aufgabe.einheit;
  const wertText = (w) => mitEinheit(w, einheit, u.sprache);
  const einheitWort = typeof einheit === 'string' ? einheit : einheit?.viele ?? '';

  let weg = null;
  let runde1 = [];
  let wert = runde(aufgabe.start ?? reglerZuWert(REGLER_MAX / 2, bereich, skala), bereich, skala);
  let letzterVersuch = null;
  let anlaufOffen = false;

  const phase = h('div', { class: 'sp-phase' });
  const frage = h('p', { class: 'sp-frage', 'data-vorlesen': '' }, t(aufgabe.frage));
  const bild = aufgabe.bild ? h('figure', { class: 'sp-frage-bild' },
    h('img', { src: k.pfad(aufgabe.bild.datei), alt: t(aufgabe.bild.alt), width: aufgabe.bild.breite, height: aufgabe.bild.hoehe, decoding: 'async' }),
    h('figcaption', { class: 'sp-bildnachweis' }, aufgabe.bild.quelle)) : null;
  k.vorleseText = () => `${t(aufgabe.text)} ${t(aufgabe.frage)}`;
  flaeche.buehne.append(h('div', { class: 'sp-schaetzen' }, h('div', { class: 'sp-schaetzen-kopf' }, bild, h('div', { class: 'sp-frage-feld' }, frage)), phase));

  k.tipps({ liste: aufgabe.tipps });

  // 1. Wie wollt ihr schätzen?
  function zeigeWahl() {
    const titelId = neueId('wahl');
    const optionen = [
      { id: 'schaetzrunde', symbol: 'stimme', titel: u.sprache === 'einfach' ? 'Erst jede und jeder allein' : 'Erst jede und jeder allein, dann einigen',
        text: u.sprache === 'einfach' ? 'Alle sagen eine Zahl. Dann sucht ihr gemeinsam eine Zahl aus.' : 'Jede Schätzung kommt ins Gerät, ohne Namen. Danach seht ihr, wie weit ihr auseinanderliegt.' },
      { id: 'gemeinsam', symbol: 'figur', titel: 'Gleich gemeinsam',
        text: u.sprache === 'einfach' ? 'Ihr redet und sucht zusammen eine Zahl aus.' : 'Ihr besprecht euch und stellt eure gemeinsame Zahl direkt ein.' },
    ];
    phase.replaceChildren(h('section', { class: 'sp-wahl', 'aria-labelledby': titelId },
      h('h3', { class: 'sp-zwischentitel', id: titelId }, 'Wie wollt ihr schätzen?'),
      h('div', { class: 'sp-wahl-optionen' }, optionen.map((option) => k.knopf({
        art: 'karte', rolle: 'steuern',
        beiKlick: () => { weg = option.id; protokoll.weg(option.id); option.id === 'schaetzrunde' ? zeigeRunde() : zeigeEinigen(); },
        'data-weg': option.id,
      })))));
    // Inhalt der Kartenknöpfe: Symbol, Titel, Text
    phase.querySelectorAll('.sp-knopf--karte').forEach((knopf, i) => {
      knopf.replaceChildren(symbol(optionen[i].symbol, 'sp-wahl-symbol'), h('span', { class: 'sp-wahl-titel' }, optionen[i].titel), h('span', { class: 'sp-wahl-text' }, optionen[i].text));
    });
  }

  // 2a. Schätzrunde: Schätzungen nacheinander eingeben, ohne Namen
  function zeigeRunde() {
    k.sage('');
    const feldId = neueId('schaetzung');
    const eingabe = h('input', { id: feldId, type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'sp-zahl', 'aria-describedby': `${feldId}-hinweis` });
    const liste = h('ol', { class: 'sp-runde-liste', 'aria-label': 'Eure Schätzungen' });
    const weiter = k.knopf({ text: 'Weiter: gemeinsam einigen', symbol: 'weiter', art: 'haupt', rolle: 'steuern', 'aria-disabled': 'true', beiKlick: () => {
      if (runde1.length < 2) return;
      zeigeEinigen();
    } });
    const fuegeHinzu = () => {
      const zahl = leseZahl(eingabe.value);
      if (zahl == null || zahl < bereich.min || zahl > bereich.max) {
        k.sage(`Bitte eine Zahl zwischen ${grosseZahl(bereich.min, 'standard')} und ${grosseZahl(bereich.max, 'standard')} eingeben.`, 'hinweis');
        eingabe.focus();
        return;
      }
      runde1.push(zahl);
      liste.append(h('li', {}, `${runde1.length}: ${wertText(zahl)}`));
      eingabe.value = '';
      eingabe.focus();
      k.sage(`Schätzung ${runde1.length} ist drin: ${wertText(zahl)}.`, 'neutral');
      if (runde1.length >= 2) weiter.removeAttribute('aria-disabled');
    };
    const dazu = k.knopf({ text: 'Schätzung dazu', symbol: 'plus', art: 'zweit', rolle: 'steuern', beiKlick: fuegeHinzu });
    eingabe.addEventListener('keydown', (ereignis) => { if (ereignis.key === 'Enter') { ereignis.preventDefault(); protokoll.rolle('steuern'); fuegeHinzu(); } });
    phase.replaceChildren(h('section', { class: 'sp-runde', 'aria-labelledby': `${feldId}-titel` },
      h('h3', { class: 'sp-zwischentitel', id: `${feldId}-titel` }, 'Schätzrunde'),
      h('p', { id: `${feldId}-hinweis` }, u.sprache === 'einfach'
        ? 'Reicht das Gerät weiter. Jede und jeder tippt eine Zahl ein. Namen braucht ihr nicht.'
        : 'Reicht das Gerät herum: Jede und jeder tippt eine Schätzung ein und drückt „Schätzung dazu“. Namen braucht ihr nicht.'),
      h('div', { class: 'sp-zahlfeld' }, h('label', { for: feldId }, `Schätzung in ${einheitWort}`), eingabe, dazu),
      liste,
      h('div', { class: 'sp-aktionen sp-aktionen--start' }, weiter)));
    eingabe.focus();
  }

  // 2b. Gemeinsame Schätzung einstellen und abgeben
  function zeigeEinigen() {
    k.sage('');
    if (runde1.length >= 2) wert = runde(mitte(runde1), bereich, skala);
    const reglerId = neueId('regler');
    const feldId = neueId('zahl');
    const anzeige = h('output', { class: 'sp-wert', for: reglerId, 'aria-live': 'off' }, grosseZahl(wert, u.sprache));
    const regler = h('input', { id: reglerId, type: 'range', class: 'sp-regler', min: '0', max: String(REGLER_MAX), step: '1', value: String(wertZuRegler(wert, bereich, skala)) });
    const feld = h('input', { id: feldId, type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'sp-zahl', value: String(wert).replace('.', ',') });
    const setze = (neu, quelle) => {
      wert = Math.min(bereich.max, Math.max(bereich.min, neu));
      anzeige.textContent = grosseZahl(wert, u.sprache);
      regler.setAttribute('aria-valuetext', wertText(wert));
      if (quelle !== 'regler') regler.value = String(wertZuRegler(wert, bereich, skala));
      if (quelle !== 'feld') feld.value = String(wert).replace('.', ',');
    };
    const aktion = () => {
      protokoll.rolle('steuern');
      if (anlaufOffen && letzterVersuch != null) { protokoll.aktion(inRichtigeRichtung(letzterVersuch, wert, aufgabe.antwort)); anlaufOffen = false; }
    };
    regler.addEventListener('input', () => setze(reglerZuWert(Number(regler.value), bereich, skala), 'regler'));
    regler.addEventListener('change', aktion);
    feld.addEventListener('change', () => {
      const zahl = leseZahl(feld.value);
      if (zahl == null) { k.sage('Bitte nur Ziffern eingeben, zum Beispiel 120 oder 1,5.', 'hinweis'); return; }
      setze(zahl, 'feld');
      aktion();
    });
    const weniger = k.knopf({ text: 'weniger', symbol: 'minus', art: 'zweit', label: `weniger ${einheitWort}`, beiKlick: () => { setze(schrittWert(wert, -1, bereich, skala)); aktion(); } });
    const mehr = k.knopf({ text: 'mehr', symbol: 'plus', art: 'zweit', label: `mehr ${einheitWort}`, beiKlick: () => { setze(schrittWert(wert, 1, bereich, skala)); aktion(); } });
    setze(wert);

    const spanne = runde1.length >= 2
      ? h('p', { class: 'sp-spanne' }, u.sprache === 'einfach'
        ? `Eure Zahlen: von ${wertText(Math.min(...runde1))} bis ${wertText(Math.max(...runde1))}. Die Mitte ist ${wertText(runde(mitte(runde1), bereich, skala))}.`
        : `Eure Schätzungen liegen zwischen ${wertText(Math.min(...runde1))} und ${wertText(Math.max(...runde1))}. Die Mitte ist ${wertText(runde(mitte(runde1), bereich, skala))}; dort steht der Regler.`)
      : null;
    const abgeben = (art) => () => {
      if (anlaufOffen) { protokoll.aktion(false); anlaufOffen = false; }
      protokoll.abstimmung(art);
      werte(wert);
    };
    const einig = k.knopf({ text: 'Alle sind einverstanden', symbol: 'haken', art: 'haupt', rolle: 'pruefen', beiKlick: abgeben('einig') });
    const mehrheit = k.knopf({ text: 'Die Mehrheit ist dafür', symbol: 'stimme', art: 'zweit', rolle: 'pruefen', beiKlick: abgeben('mehrheit') });

    phase.replaceChildren(h('section', { class: 'sp-einigen', 'aria-labelledby': `${reglerId}-titel` },
      h('h3', { class: 'sp-zwischentitel', id: `${reglerId}-titel` }, 'Eure gemeinsame Schätzung'),
      spanne,
      h('div', { class: 'sp-eingabe' },
        h('div', { class: 'sp-wertzeile' }, anzeige, h('span', { class: 'sp-einheit' }, einheitWort)),
        h('label', { class: 'sp-unsichtbar', for: reglerId }, `Schätzung in ${einheitWort}`),
        regler,
        h('div', { class: 'sp-skala', 'aria-hidden': 'true' }, h('span', {}, grosseZahl(bereich.min, u.sprache)), h('span', {}, grosseZahl(bereich.max, u.sprache))),
        h('div', { class: 'sp-zahlfeld' }, weniger, h('label', { for: feldId }, 'genau:'), feld, h('span', {}, einheitWort), mehr)),
      h('p', { class: 'sp-hilfetext' }, u.sprache === 'einfach' ? 'Seid ihr euch einig? Dann drückt einen grünen Knopf.' : 'Wenn alle einverstanden sind oder die Mehrheit dafür ist, gebt ihr ab.'),
      h('div', { class: 'sp-aktionen sp-aktionen--start' }, einig, mehrheit)));
    regler.focus();
  }

  // 3. Bewerten: Beim ersten Versuch weit daneben gibt es eine zweite Runde mit Hinweis auf die Richtung.
  function werte(schaetzung) {
    const bewertung = bewerte(schaetzung, aufgabe.antwort, skala, aufgabe.toleranz);
    protokoll.versuch(bewertung.richtig);
    if (!bewertung.richtig && protokoll.versuche === 1) {
      letzterVersuch = schaetzung;
      anlaufOffen = true;
      const richtung = bewertung.richtung === 'zu-hoch' ? 'zu hoch' : 'zu niedrig';
      k.sage(u.sprache === 'einfach'
        ? `Eure Zahl ist noch weit weg. Sie ist ${richtung}. Holt euch einen Tipp und schätzt noch einmal.`
        : `Noch ziemlich weit weg: Eure Schätzung ist ${richtung}. Holt euch einen Tipp, wenn ihr mögt, und schätzt noch einmal.`, 'hinweis');
      return;
    }
    zeigeAufloesung(schaetzung, bewertung);
  }

  // 4. Auflösung mit Balken und Vergleich
  function zeigeAufloesung(schaetzung, bewertung) {
    const groesster = Math.max(schaetzung, aufgabe.antwort);
    const anteil = (w) => `${Math.max(2, (w / groesster) * 100).toFixed(1)}%`;
    const balken = (name, w, art) => {
      const fuellung = h('span', { class: `sp-balken-fuellung sp-balken-fuellung--${art}` });
      const zeile = h('div', { class: 'sp-balken-zeile' },
        h('span', { class: 'sp-balken-name' }, name),
        h('span', { class: 'sp-balken-spur' }, fuellung),
        h('span', { class: 'sp-balken-wert' }, wertText(w)));
      fuellung.style.setProperty('--sp-anteil', k.animiert ? '0%' : anteil(w));
      if (k.animiert) requestAnimationFrame(() => requestAnimationFrame(() => fuellung.style.setProperty('--sp-anteil', anteil(w))));
      return zeile;
    };
    const naehe = bewertung.sterne === 3 ? (u.sprache === 'einfach' ? 'Sehr nah dran!' : 'Volltreffer, sehr nah dran!')
      : bewertung.sterne === 2 ? (u.sprache === 'einfach' ? 'Gut geschätzt!' : 'Gut geschätzt, ziemlich nah dran!')
        : (u.sprache === 'einfach' ? 'Mutig geschätzt!' : 'Mutig geschätzt! Jetzt wisst ihr es genau.');
    const vergleich = aufgabe.vergleich ? h('div', { class: 'sp-vergleich' },
      aufgabe.vergleich.bild ? h('div', { class: 'sp-vergleich-bild', 'aria-hidden': 'true' },
        Array.from({ length: Math.min(12, aufgabe.vergleich.anzahl ?? 1) }, () => h('img', { src: k.pfad(aufgabe.vergleich.bild), alt: '' }))) : null,
      h('p', { class: 'sp-vergleich-text', 'data-vorlesen': '' }, t(aufgabe.vergleich.satz))) : null;
    flaeche.werkzeuge.replaceChildren();
    flaeche.tippBox.hidden = true;
    k.sage(naehe, bewertung.sterne >= 2 ? 'gut' : 'neutral');
    phase.replaceChildren(h('section', { class: 'sp-aufloesung', 'aria-label': 'Auflösung' },
      h('div', { class: 'sp-balken' }, balken('Eure Schätzung', schaetzung, 'wir'), balken('So viel ist es', aufgabe.antwort, 'echt')),
      h('p', { class: 'sp-aufloesung-text', 'data-vorlesen': '' }, t(aufgabe.aufloesung)),
      vergleich));
    const weiter = k.knopf({ text: 'Weiter', symbol: 'weiter', art: 'haupt', gross: true, beiKlick: () => k.fertig({ geloest: true, punkte: bewertung.sterne }) });
    flaeche.aktionen.replaceChildren(weiter);
    weiter.focus();
  }

  zeigeWahl();
}
