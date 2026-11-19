// Dilemma: Die Gruppe liest eine echte Streitfrage zum Ort, hört verschiedene Stimmen, stimmt ab, begründet ihre
// Entscheidung mit Meinungen, die dazu passen, nimmt eine Meinung der Gegenseite ernst und sieht dann, was passieren
// könnte und was wirklich geschah. Es gibt keine falsche Entscheidung, nur passende und unpassende Begründungen.

import { spielRahmen, h, neueId, schritte, bildnachweis } from '../_gemeinsam/ui.js';
import { symbol } from '../_gemeinsam/symbole.js';
import { auszaehlen, pruefeBegruendung, dilemmaSterne } from './logik.js';

export const meta = { id: 'dilemma', titel: 'Dilemma', dauerMinuten: [6, 10], offline: true };

const BUCHSTABEN = ['A', 'B', 'C'];

export async function starte(wurzel, aufgabe, umgebung = {}) {
  return spielRahmen({ wurzel, aufgabe, umgebung, meta, stil: new URL('./stil.css', import.meta.url), aufbau });
}

function aufbau(k) {
  const { aufgabe, t, protokoll, flaeche, u } = k;
  const einfach = u.sprache === 'einfach';
  const SCHRITTE = einfach ? ['Lesen', 'Meinungen', 'Abstimmen', 'Begründen', 'Folgen'] : ['Lesen', 'Meinungen hören', 'Abstimmen', 'Begründen', 'Folgen'];
  const optionen = aufgabe.optionen;
  const argumente = aufgabe.argumente;
  const option = (id) => optionen.find((o) => o.id === id);
  const buchstabe = (id) => BUCHSTABEN[optionen.findIndex((o) => o.id === id)];
  const stimmen = Object.fromEntries(optionen.map((o) => [o.id, 0]));
  let entscheidung = null;
  let begruendet = false;
  const gewaehlt = new Set();
  const gegenseite = new Set();
  let unpassendZuletzt = null;

  const leiste = h('div', { class: 'sp-dilemma-leiste' });
  const inhalt = h('div', { class: 'sp-dilemma' });
  flaeche.buehne.append(leiste, inhalt);
  k.vorleseText = () => `${t(aufgabe.text)} ${t(aufgabe.frage)}`;
  if (aufgabe.tipps?.length) k.tipps({ liste: aufgabe.tipps });

  function zeige(nr, titel, ...teile) {
    leiste.replaceChildren(schritte(SCHRITTE, nr));
    const titelId = neueId('schritt');
    const abschnitt = h('section', { class: 'sp-dilemma-schritt', 'aria-labelledby': titelId },
      h('h3', { class: 'sp-zwischentitel sp-schritt-titel', id: titelId, tabindex: '-1' }, titel), ...teile);
    inhalt.replaceChildren(abschnitt);
    flaeche.aktionen.replaceChildren();
    k.sage('');
    abschnitt.querySelector('.sp-schritt-titel').focus();
    return abschnitt;
  }

  const argumentText = (a) => `${t(a.wer)}: ${t(a.text)}`;

  // 1. Lesen
  function lesen() {
    const bild = aufgabe.bild ? h('figure', { class: 'sp-situation-bild' },
      h('img', { src: k.pfad(aufgabe.bild.datei), alt: t(aufgabe.bild.alt), width: aufgabe.bild.breite, height: aufgabe.bild.hoehe, decoding: 'async' }),
      h('figcaption', { class: 'sp-bildnachweis' }, bildnachweis(aufgabe.bild.quelle))) : null;
    zeige(0, einfach ? 'Was ist los?' : 'Worum es geht',
      h('div', { class: 'sp-situation' }, bild,
        h('div', { class: 'sp-situation-text' },
          h('p', { 'data-vorlesen': '' }, t(aufgabe.situation)),
          h('p', { class: 'sp-dilemma-frage', 'data-vorlesen': '' }, t(aufgabe.frage)),
          k.vorleseKnopf(() => `${t(aufgabe.situation)} ${t(aufgabe.frage)}`))));
    flaeche.aktionen.append(k.knopf({ text: einfach ? 'Weiter: Meinungen' : 'Weiter: Was sagen die Leute?', symbol: 'weiter', art: 'haupt', rolle: 'steuern', beiKlick: meinungen }));
  }

  // 2. Meinungen hören (noch ohne Seiten: Die Gruppe soll selbst abwägen)
  function meinungen() {
    zeige(1, einfach ? 'Das sagen die Leute' : 'Was sagen die Leute?',
      h('p', {}, einfach ? 'Lest jede Meinung. Redet darüber.' : 'Lest jede Meinung laut vor und redet darüber: Wer hätte etwas davon, wer nicht?'),
      h('ul', { class: 'sp-meinungen' }, argumente.map((a) => h('li', { class: 'sp-meinung' },
        symbol('figur', 'sp-meinung-symbol'),
        h('div', {}, h('p', { class: 'sp-meinung-wer' }, t(a.wer)), h('p', { 'data-vorlesen': '' }, t(a.text)))))),
      k.vorleseKnopf(() => argumente.map(argumentText).join(' '), { label: 'Alle Meinungen vorlesen' }));
    flaeche.aktionen.append(k.knopf({ text: einfach ? 'Weiter: abstimmen' : 'Weiter: abstimmen', symbol: 'weiter', art: 'haupt', rolle: 'steuern', beiKlick: abstimmen }));
  }

  // 3. Abstimmen: Stimmen je Möglichkeit zählen, ohne Namen
  function abstimmen() {
    const zaehler = {};
    const karten = optionen.map((o) => {
      const anzeige = h('span', { class: 'sp-stimmzahl', 'aria-live': 'polite' }, String(stimmen[o.id]));
      zaehler[o.id] = anzeige;
      const aendere = (d) => () => {
        stimmen[o.id] = Math.max(0, stimmen[o.id] + d);
        anzeige.textContent = String(stimmen[o.id]);
      };
      return h('li', { class: 'sp-option' },
        h('div', { class: 'sp-option-kopf' }, h('span', { class: 'sp-option-buchstabe', 'aria-hidden': 'true' }, buchstabe(o.id)), h('span', { class: 'sp-option-titel' }, t(o.titel))),
        h('p', { 'data-vorlesen': '' }, t(o.text)),
        h('div', { class: 'sp-stimmen', role: 'group', 'aria-label': `Stimmen für ${buchstabe(o.id)}: ${t(o.titel)}` },
          k.knopf({ text: '', symbol: 'minus', art: 'zweit', rolle: 'steuern', label: `eine Stimme weniger für ${buchstabe(o.id)}`, beiKlick: aendere(-1) }),
          anzeige,
          k.knopf({ text: '', symbol: 'plus', art: 'zweit', rolle: 'steuern', label: `eine Stimme mehr für ${buchstabe(o.id)}`, beiKlick: aendere(1) })));
    });
    zeige(2, einfach ? 'Stimmt ab' : 'Stimmt ab',
      h('p', { class: 'sp-dilemma-frage', 'data-vorlesen': '' }, t(aufgabe.frage)),
      h('p', {}, einfach ? 'Jede und jeder hat eine Stimme. Drückt Plus bei eurer Wahl.' : 'Jede und jeder hat eine Stimme: Reicht das Gerät herum und drückt Plus bei eurer Wahl. Namen braucht ihr nicht.'),
      h('ul', { class: 'sp-optionen' }, karten));
    flaeche.aktionen.append(k.knopf({
      text: 'Abstimmung auswerten', symbol: 'stimme', art: 'haupt', rolle: 'pruefen',
      beiKlick: () => {
        const ergebnis = auszaehlen(stimmen);
        if (ergebnis.gesamt === 0) { k.sage(einfach ? 'Gebt zuerst eure Stimmen ab.' : 'Gebt zuerst eure Stimmen ab: Plus bei eurer Wahl.', 'hinweis'); return; }
        if (ergebnis.gleichstand) { k.sage(einfach ? 'Gleich viele Stimmen. Redet noch einmal und stimmt neu ab.' : 'Unentschieden! Redet noch einmal miteinander und ändert eure Stimmen.', 'hinweis'); return; }
        entscheidung = ergebnis.gewinner;
        protokoll.abstimmung(ergebnis.art);
        protokoll.weg(entscheidung);
        begruenden(ergebnis);
      },
    }));
  }

  // 4. Begründen: Meinungen wählen, die zur Entscheidung passen; dann eine der Gegenseite ernst nehmen
  function begruenden(ergebnis) {
    const fehlerId = neueId('begruendung');
    const knoepfe = argumente.map((a) => {
      const knopf = h('button', { type: 'button', class: 'sp-argument', 'aria-pressed': 'false', 'data-argument': a.id, 'aria-describedby': fehlerId },
        h('span', { class: 'sp-argument-haken', 'aria-hidden': 'true' }, symbol('haken')),
        h('span', {}, h('span', { class: 'sp-argument-wer' }, t(a.wer)), h('span', { class: 'sp-argument-text' }, t(a.text)),
          h('span', { class: 'sp-argument-hinweis', hidden: true }, einfach ? ' Passt nicht zu eurer Wahl.' : ' Spricht eher für die andere Seite.')));
      knopf.addEventListener('click', () => {
        protokoll.rolle('steuern');
        if (unpassendZuletzt) { protokoll.aktion(unpassendZuletzt.includes(a.id)); unpassendZuletzt = null; }
        if (gewaehlt.has(a.id)) gewaehlt.delete(a.id); else gewaehlt.add(a.id);
        knopf.setAttribute('aria-pressed', String(gewaehlt.has(a.id)));
        knopf.classList.remove('sp-argument--unpassend');
        knopf.querySelector('.sp-argument-hinweis').hidden = true;
      });
      return h('li', {}, knopf);
    });
    const wahl = option(entscheidung);
    const abstimmungsText = ergebnis.art === 'einig' ? 'Alle waren dafür.' : 'Die Mehrheit war dafür.';
    zeige(3, einfach ? 'Warum?' : 'Warum habt ihr so entschieden?',
      h('p', { class: 'sp-entscheidung' }, h('span', { class: 'sp-option-buchstabe', 'aria-hidden': 'true' }, buchstabe(entscheidung)), h('span', {}, `Eure Entscheidung: ${t(wahl.titel)}. ${abstimmungsText}`)),
      h('p', { id: fehlerId }, einfach ? 'Welche Meinungen passen zu eurer Wahl? Tippt sie an.' : 'Welche Meinungen haben euch überzeugt? Wählt mindestens eine, die zu eurer Entscheidung passt.'),
      h('ul', { class: 'sp-argumente' }, knoepfe));
    flaeche.aktionen.append(k.knopf({
      text: 'Begründung abgeben', symbol: 'pruefen', art: 'haupt', rolle: 'pruefen',
      beiKlick: () => {
        if (gewaehlt.size === 0) { k.sage(einfach ? 'Tippt mindestens eine Meinung an.' : 'Wählt mindestens eine Meinung, die zu eurer Entscheidung passt.', 'hinweis'); return; }
        if (unpassendZuletzt) { protokoll.aktion(false); unpassendZuletzt = null; }
        const pruefung = pruefeBegruendung([...gewaehlt], argumente, entscheidung);
        protokoll.versuch(pruefung.gueltig);
        if (!pruefung.gueltig) {
          unpassendZuletzt = pruefung.unpassend;
          for (const id of pruefung.unpassend) {
            const knopf = inhalt.querySelector(`[data-argument="${id}"]`);
            knopf.classList.add('sp-argument--unpassend');
            knopf.querySelector('.sp-argument-hinweis').hidden = false;
          }
          const wer = pruefung.unpassend.map((id) => t(argumente.find((a) => a.id === id).wer)).join(', ');
          k.sage(pruefung.passend.length === 0 && pruefung.unpassend.length === gewaehlt.size
            ? (einfach ? `Diese Meinung passt nicht zu eurer Wahl: ${wer}. Schaut noch einmal.` : `Die gewählte Meinung (${wer}) spricht eher für die andere Seite. Welche passt zu eurer Entscheidung?`)
            : (einfach ? `Eine Meinung passt nicht: ${wer}. Tippt sie noch einmal an.` : `Fast: Die Meinung von ${wer} spricht eher für die andere Seite. Nehmt sie heraus.`), 'hinweis');
          return;
        }
        begruendet = true;
        gegenSeite();
      },
    }));
  }

  function gegenSeite() {
    const andere = argumente.filter((a) => a.fuer !== entscheidung);
    const knoepfe = andere.map((a) => {
      const knopf = h('button', { type: 'button', class: 'sp-argument', 'aria-pressed': 'false', 'data-argument': a.id },
        h('span', { class: 'sp-argument-haken', 'aria-hidden': 'true' }, symbol('haken')),
        h('span', {}, h('span', { class: 'sp-argument-wer' }, t(a.wer)), h('span', { class: 'sp-argument-text' }, t(a.text))));
      knopf.addEventListener('click', () => {
        protokoll.rolle('steuern');
        if (gegenseite.has(a.id)) gegenseite.delete(a.id); else gegenseite.add(a.id);
        knopf.setAttribute('aria-pressed', String(gegenseite.has(a.id)));
      });
      return h('li', {}, knopf);
    });
    zeige(3, einfach ? 'Und die anderen?' : 'Und die andere Seite?',
      h('p', {}, einfach
        ? 'Manche Menschen sehen es anders. Welche Meinung findet ihr trotzdem wichtig? Ihr könnt auch keine wählen.'
        : 'Gute Entscheidungen nehmen auch die Gegenseite ernst. Welche Meinung der anderen Seite findet ihr trotzdem wichtig? Ihr könnt auch keine wählen.'),
      h('ul', { class: 'sp-argumente' }, knoepfe));
    k.sage(einfach ? 'Gut begründet!' : 'Gut begründet: Eure Meinungen passen zu eurer Entscheidung.', 'gut');
    flaeche.aktionen.append(k.knopf({ text: 'Weiter: Was passiert dann?', symbol: 'weiter', art: 'haupt', rolle: 'pruefen', beiKlick: folgen }));
  }

  // 5. Folgen und was wirklich geschah
  function folgen() {
    const andere = optionen.filter((o) => o.id !== entscheidung);
    const andereFolgen = h('details', { class: 'sp-andere' },
      h('summary', {}, einfach ? 'Und wenn ihr anders gewählt hättet?' : 'Und wenn ihr anders entschieden hättet?'),
      andere.map((o) => h('p', { 'data-vorlesen': '' }, h('strong', {}, `${buchstabe(o.id)}: `), t(o.folge))));
    zeige(4, einfach ? 'Was passiert dann?' : 'Was passiert dann?',
      h('div', { class: 'sp-folge' }, h('p', { class: 'sp-folge-titel' }, einfach ? 'So könnte es weitergehen' : 'So könnte es nach eurer Entscheidung weitergehen'), h('p', { 'data-vorlesen': '' }, t(option(entscheidung).folge))),
      andereFolgen,
      h('div', { class: 'sp-wirklich' }, h('p', { class: 'sp-folge-titel' }, symbol('info'), h('span', {}, 'So war es wirklich')), h('p', { 'data-vorlesen': '' }, t(aufgabe.wirklichkeit)),
        k.vorleseKnopf(() => `${t(option(entscheidung).folge)} So war es wirklich: ${t(aufgabe.wirklichkeit)}`)));
    const punkte = dilemmaSterne({ begruendet, gegenseite: gegenseite.size > 0 });
    k.sage(gegenseite.size > 0
      ? (einfach ? 'Stark: Ihr habt auch an die anderen gedacht.' : 'Stark: Ihr habt eure Entscheidung begründet und die Gegenseite ernst genommen.')
      : (einfach ? 'Ihr habt gut begründet.' : 'Ihr habt eure Entscheidung gut begründet.'), 'gut');
    const weiter = k.knopf({ text: 'Weiter', symbol: 'weiter', art: 'haupt', gross: true, beiKlick: () => k.fertig({ geloest: true, punkte, kopfzeile: aufgabe.abschluss }) });
    flaeche.werkzeuge.replaceChildren();
    flaeche.tippBox.hidden = true;
    flaeche.aktionen.append(weiter);
  }

  lesen();
}
