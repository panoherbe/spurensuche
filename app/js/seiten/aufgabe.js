// Aufgabenrahmen: lädt das Spielmodul, gibt ihm `umgebung` (docs/SCHNITTSTELLE.md 2.3), misst die aktive Zeit,
// prüft und speichert das Ergebnis und zeigt den Fortschritt. Ereignisse werden beim Melden gepuffert.

import { h, leere, knopf, symbol, frage, melde } from '../ui.js';
import { t, einstellungen, reduzierteBewegung } from '../einstellungen.js';
import { vorlesen } from '../vorlesen.js';
import { aufgabe as ladeAufgabe, aufgabenVon, url, alsDatei } from '../inhalte.js';
import { aktuellesTeam, orteDesTeams, stationVon, speichereLauf, zaehleAktiv, notiereRueckmeldung, erfassung } from '../spielstand.js';
import { pruefeErgebnis, pruefeModul } from '../kern/ereignisse.js';
import { schreibe, entferne } from '../speicher.js';
import { bald } from '../sync.js';

export async function zeige(ctx) {
  const { haupt, inhalte, teile, navigiere, aufraeumen } = ctx;
  const kennung = `${teile[0]}/${teile[1]}`;
  const team = aktuellesTeam();
  const eintrag = orteDesTeams(inhalte).find((x) => x.ort.id === teile[0]);
  if (!eintrag || !eintrag.aufgaben.includes(teile[1])) {
    leere(haupt, h('h1', {}, 'Diese Aufgabe gehört nicht zu eurer Quest'), h('p', {}, h('a', { href: '#/karte' }, 'Zur Karte')));
    return 'Aufgabe nicht gefunden';
  }
  const { ort } = eintrag;
  if (!stationVon(ort.id)) { location.replace(`#/ort/${ort.id}`); return ort.name; }
  const alle = await aufgabenVon(ort, eintrag.aufgaben);
  const aufgabe = await ladeAufgabe(kennung);
  const position = alle.findIndex((a) => a.kennung === kennung) + 1;

  const wurzel = h('section', { class: 'spiel-wurzel', 'aria-label': `Spiel: ${aufgabe.titel}` });
  const rahmen = h('div', { class: 'aufgabe-rahmen' },
    h('div', { class: 'aufgabe-kopf' },
      // Die Spiele zeigen den Titel groß auf ihrer Startkarte; die Seitenüberschrift bleibt für Bildschirmleser da.
      h('div', {}, h('p', { class: 'wo' }, `Aufgabe ${position} von ${alle.length} · ${ort.name}`), h('h1', { class: 'nur-vorlesbar' }, aufgabe.titel)),
      knopf('Station verlassen', async () => {
        if (await frage('Aufgabe verlassen?', 'Der Stand dieser Aufgabe geht verloren; begonnene Sammelstücke bekommt ihr beim nächsten Mal.', { ja: 'Verlassen' })) navigiere(`/ort/${ort.id}`);
      }, { art: 'leise' })),
    wurzel);
  leere(haupt, rahmen);

  // Spielmodul laden und Vertrag prüfen
  let modul;
  try {
    modul = await import(url(`spiele/${aufgabe.format}/index.js`));
    const fehler = pruefeModul(modul, aufgabe.format);
    if (fehler.length) throw new Error(fehler.join('; '));
  } catch (e) {
    console.error(e);
    leere(wurzel, h('div', { class: 'spiel-fehler' }, h('p', {}, 'Dieses Spiel lässt sich gerade nicht laden.'), h('a', { class: 'knopf', href: `#/ort/${ort.id}` }, 'Zurück zum Ort')));
    return aufgabe.titel;
  }

  // Aktive Zeit: zählt nur, solange die Seite sichtbar ist
  let aktivSeit = document.visibilityState === 'visible' ? performance.now() : null;
  const sichtbarkeit = () => {
    if (document.visibilityState === 'visible') aktivSeit = performance.now();
    else if (aktivSeit !== null) { zaehleAktiv(ort.id, (performance.now() - aktivSeit) / 1000); aktivSeit = null; }
  };
  document.addEventListener('visibilitychange', sichtbarkeit);
  const abschliessen = () => {
    document.removeEventListener('visibilitychange', sichtbarkeit);
    if (aktivSeit !== null) { zaehleAktiv(ort.id, (performance.now() - aktivSeit) / 1000); aktivSeit = null; }
  };

  const abbruch = new AbortController();
  let beendet = false;
  aufraeumen.push(() => { if (!beendet) abbruch.abort(); abschliessen(); });

  const e = einstellungen();
  const puffer = [];
  const umgebung = Object.freeze({
    sprache: e.sprache,
    vorlesen: (text) => vorlesen(text),
    tempo: e.tempo,
    hoherKontrast: e.kontrast === 'hoch',
    reduzierteBewegung: reduzierteBewegung(),
    melde: (ereignis) => {
      if (!ereignis || typeof ereignis !== 'object') return;
      puffer.push({ art: ereignis.art, zeit: ereignis.zeit, wert: ereignis.wert });
      // Absturzsicher im Gerät, bis das Ergebnis da ist; ohne Erfassung (Familie, andere Gruppen) nur im Arbeitsspeicher
      if (erfassung()) schreibe(`puffer:${kennung}`, puffer.slice(-200)).catch(() => {});
    },
    signal: abbruch.signal,
    basisUrl: new URL('./', document.baseURI).href,
    ton: e.ton,
    rollen: Array.isArray(aufgabe.rollen) ? aufgabe.rollen : false,
    katalog: inhalte.items,
  });

  let roh;
  try {
    roh = await modul.starte(wurzel, alsDatei(aufgabe), umgebung); // genau der Inhalt der Datei (Vertrag 2.2)
  } catch (err) {
    console.error(err);
    if (abbruch.signal.aborted) return aufgabe.titel;
    abschliessen();
    leere(wurzel, h('div', { class: 'spiel-fehler', role: 'alert' }, h('p', {}, 'Hoppla, im Spiel ist ein Fehler passiert.'),
      h('div', { class: 'knopfreihe', stil: { 'justify-content': 'center' } }, knopf('Noch einmal', () => ctx.neuZeichnen()), h('a', { class: 'knopf leise', href: `#/ort/${ort.id}` }, 'Zurück zum Ort'))));
    return aufgabe.titel;
  }
  beendet = true;
  abschliessen();
  if (abbruch.signal.aborted) return aufgabe.titel; // Seite schon verlassen: Teilergebnis wird nicht gezählt

  const { fehler, ergebnis } = pruefeErgebnis({ ...roh, ereignisse: roh?.ereignisse ?? puffer }, aufgabe);
  if (fehler.length) console.warn('Ergebnis weicht vom Vertrag ab:', fehler);
  entferne(`puffer:${kennung}`).catch(() => {});
  const { neueItems, stationFertig } = await speichereLauf(aufgabe, ergebnis, { gesamtAufgaben: alle.map((a) => a.kennung) });
  bald();

  const naechste = alle.find((a) => !aktuellesTeam().laeufe[a.kennung]);
  const weiterKnopf = naechste
    ? h('a', { class: 'knopf gross', href: `#/aufgabe/${naechste.kennung}` }, symbol('weiter'), 'Nächste Aufgabe')
    : h('a', { class: 'knopf gross', href: '#/karte' }, symbol('karte'), 'Zur Karte');
  const items = neueItems.map((id) => inhalte.itemNach.get(id)).filter(Boolean);
  const abschluss = h('div', { class: 'feier' },
    symbol(stationFertig ? 'stern' : 'haken'),
    h('h2', { 'data-vorlesen': '', tabindex: '-1' }, stationFertig ? `${ort.name} geschafft!` : ergebnis.geloest ? 'Geschafft!' : 'Aufgabe beendet'),
    items.length ? h('div', {}, h('p', { 'data-vorlesen': '' }, items.length === 1 ? 'Neu im Sammelbuch:' : 'Neu im Sammelbuch:'),
      items.map((i) => h('div', { class: 'neues-item' }, h('img', { src: url(i.bild), alt: i.alt }), h('strong', {}, i.name)))) : null,
    stationFertig && ort.id === inhalte.finale ? h('p', { class: 'hinweisfeld gut' }, 'Ihr habt die Abschlussaufgabe geschafft. Jetzt könnt ihr euer Bild gestalten.', ' ', h('a', { href: '#/bild' }, 'Zum Bild')) : null,
    h('div', { class: 'knopfreihe', stil: { 'justify-content': 'center' } }, weiterKnopf, h('a', { class: 'knopf leise', href: `#/ort/${ort.id}` }, 'Zum Ort')));

  if (team.modus === 'schule' && team.freigabe?.rueckmeldung) leere(wurzel, rueckmeldungsKarte(kennung, () => { leere(wurzel, abschluss); abschluss.querySelector('h2')?.focus(); }));
  else { leere(wurzel, abschluss); abschluss.querySelector('h2')?.focus(); }
  if (neueItems.length) melde(`${neueItems.length === 1 ? 'Ein neues Sammelstück' : `${neueItems.length} neue Sammelstücke`} im Sammelbuch.`);
  return aufgabe.titel;
}

/** Kurze Rückmeldung für Workshops: drei feste Fragen, keine Freitexte, keine Namen. */
function rueckmeldungsKarte(kennung, weiter) {
  const antwort = {};
  const frageFeld = (name, titel, optionen) => h('fieldset', {}, h('legend', {}, titel), h('div', { class: 'wahl' }, optionen.map(([w, text]) => {
    const id = `r-${name}-${w}`;
    return [h('input', { type: 'radio', name, id, value: w, onchange: () => { antwort[name] = w; } }), h('label', { for: id }, text)];
  })));
  return h('form', { class: 'rueckmeldung', onsubmit: async (ev) => { ev.preventDefault(); await notiereRueckmeldung(kennung, antwort); bald(); weiter(); } },
    h('h2', { tabindex: '-1' }, 'Wie war diese Aufgabe?'),
    h('p', { class: 'leise' }, t({ standard: 'Eure Rückmeldung hilft, die Spiele zu verbessern. Sie ist anonym.', einfach: 'Sagt uns, wie die Aufgabe war. Wir speichern keine Namen.' })),
    frageFeld('verstaendlich', 'Habt ihr verstanden, was zu tun war?', [['ja', 'Ja'], ['teils', 'Teils'], ['nein', 'Nein']]),
    frageFeld('spass', 'Hat es Spaß gemacht?', [['ja', 'Ja'], ['teils', 'Geht so'], ['nein', 'Nein']]),
    frageFeld('schwierigkeit', 'Wie schwer war es?', [['zu-leicht', 'Zu leicht'], ['passend', 'Passend'], ['zu-schwer', 'Zu schwer']]),
    h('div', { class: 'knopfreihe' }, knopf('Absenden', null, { typ: 'submit' }), knopf('Überspringen', () => weiter(), { art: 'leise' })));
}
