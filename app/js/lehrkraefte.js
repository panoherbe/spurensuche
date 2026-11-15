// Bereich für Lehrkräfte: Lerngruppen, Quest freigeben, Gruppen, laufende Übersicht, Auswertung mit
// Kompetenzraster, Gruppenbericht, Formulierungsentwurf, Löschen, Bildbeiträge, Rückmeldungen, Einwilligung.

import { h, leere, knopf, link, symbol, dialog, frage, melde, seitenwechsel, herunterladen } from './ui.js';
import { ladeEinstellungen, zeigeEinstellungen } from './einstellungen.js';
import { holeApi } from './api.js';
import { ladeInhalte, aufgabenVon } from './inhalte.js';
import { freieVorschlaege, pruefeBezeichnung } from './kern/namen.js';
import { datum, datumZeit, vorZeit } from './kern/zeit.js';
import { STUFEN, stufeName, rollenName } from './kern/raster.js';
import { qrSvg } from './kern/qr.js';
import { gruppenbericht } from './bericht.js';
import { qrSchilder } from './qr-bogen.js';
import { KARTE } from './karte-daten.js';

let api;
let inhalte;
let haupt;
let ich = null;
let aktualisierung = null;
const basisUrl = () => new URL('./', document.baseURI).href;

const STATUS = { offen: ['offen', 'Noch nicht begonnen'], begonnen: ['begonnen', 'In Arbeit'], abgeschlossen: ['haken', 'Fertig'], abgebrochen: ['kreuz', 'Unterbrochen'] };
const ZEITRAHMEN = { stunde: 'Unterrichtsstunde', projekttag: 'Projekttag', ausflug: 'Tagesausflug', eigen: 'Eigene Auswahl' };

function logo() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', `0 0 ${KARTE.breite} ${KARTE.hoehe}`);
  s.setAttribute('class', 'logo');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', KARTE.sachsen);
  p.setAttribute('fill', 'currentColor');
  s.append(p);
  return s;
}

function svgAusText(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  return document.importNode(doc.documentElement, true);
}

function zeichneKopf() {
  leere(document.getElementById('kopf'),
    h('a', { class: 'marke-app', href: '#/' }, logo(), 'Spurensuche · Für Lehrkräfte'),
    api.vorfuehrung ? h('span', { class: 'marke warten' }, 'Vorführung mit Beispieldaten') : null,
    api.konfiguration?.stand ? h('span', { class: 'marke' }, api.konfiguration.stand) : null,
    h('a', { class: 'knopf leise', href: 'index.html' }, 'Zur Spieler-Ansicht'),
    h('button', { type: 'button', class: 'knopf leise symbolknopf', 'aria-label': 'Einstellungen', onclick: () => zeigeEinstellungen() }, symbol('zahnrad')),
    ich ? knopf('Abmelden', async () => {
      const r = await api.abmelden().catch(() => ({}));
      ich = null;
      if (r?.weiter) location.href = r.weiter; else { location.hash = '#/'; zeige(); }
    }, { art: 'leise' }) : null);
}

const krumen = (...teile) => h('nav', { 'aria-label': 'Brotkrumen' }, h('ol', { class: 'brotkrumen' }, teile.map(([text, href]) => h('li', {}, href ? h('a', { href }, text) : h('span', { 'aria-current': 'page' }, text)))));

// --- Anmeldung -------------------------------------------------------------------------------------------------

const ANMELDE_FEHLER = {
  'nicht-erreichbar': 'Der Anmeldedienst ist gerade nicht erreichbar. Bereits angemeldete Geräte und vorgeladene Quests laufen weiter. Sie können sich mit einem Zugangsschlüssel anmelden.',
  rolle: 'Der Anmeldedienst hat keine Rolle „Lehrkraft“ übermittelt. Bitte wenden Sie sich an die Verwaltung Ihrer Schule.',
  token: 'Die Antwort des Anmeldedienstes ließ sich nicht prüfen. Bitte erneut versuchen.',
  vorgang: 'Die Anmeldung war abgelaufen oder wurde in einem anderen Fenster begonnen. Bitte erneut versuchen.',
  'kein-anmeldedienst': 'Für diese Instanz ist kein Anmeldedienst eingerichtet.',
};

function zeigeAnmeldung(fehler) {
  const feld = h('input', { id: 'schluessel', type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters' });
  const meldung = h('p', { class: 'hinweisfeld fehler', role: 'alert', hidden: !fehler }, fehler ? ANMELDE_FEHLER[fehler] ?? 'Die Anmeldung hat nicht geklappt.' : '');
  leere(haupt,
    h('h1', {}, 'Anmelden'),
    meldung,
    api.vorfuehrung ? h('section', { class: 'karte' }, h('h2', {}, 'Vorführung'),
      h('p', {}, 'Diese Seite läuft ohne Server mit Beispieldaten: eine Klasse 6, eine Quest, vier Gruppen mit gespielten Aufgaben. Nichts verlässt diesen Browser.'),
      knopf('Vorführung ansehen', async () => { await api.anmeldenMitSchluessel('VORFUEHRUNG'); await zeige(); }, { art: 'gross', sym: 'augen' })) : null,
    api.konfiguration?.anmeldung?.anmeldedienst ? h('section', { class: 'karte' }, h('h2', {}, 'Mit dem Schulkonto'),
      h('p', {}, 'Anmeldung über den schulischen Anmeldedienst. Gespeichert wird nur ein Pseudonym, kein Name und keine E-Mail-Adresse.',
        api.konfiguration.anmeldung.attrappe ? ' In dieser Testinstanz antwortet eine Attrappe mit Testkonten.' : ''),
      link('Mit Schulkonto anmelden', api.anmeldedienstUrl('lehrkraft'), { art: 'gross', sym: 'schloss' })) : null,
    h('form', { class: 'karte', onsubmit: async (ev) => {
      ev.preventDefault();
      try { await api.anmeldenMitSchluessel(feld.value); await zeige(); } catch (e) { meldung.textContent = e.message; meldung.hidden = false; feld.focus(); }
    } },
    h('h2', {}, 'Mit Zugangsschlüssel'),
    h('p', { class: 'leise' }, 'Für die Erprobung, solange die Schulanmeldung noch nicht angebunden ist. Den Schlüssel gibt die Verwaltung aus.'),
    h('div', { class: 'feld' }, h('label', { for: 'schluessel' }, 'Zugangsschlüssel'), feld),
    knopf('Anmelden', null, { typ: 'submit' })));
  return 'Anmelden';
}

// --- Übersicht: Lerngruppen ----------------------------------------------------------------------------------

async function zeigeUebersicht() {
  const gruppen = await api.lerngruppen();
  leere(haupt,
    h('div', { class: 'seitenkopf' }, h('h1', {}, 'Ihre Lerngruppen'), knopf('Neue Lerngruppe', () => lerngruppeDialog(), { sym: 'stift' })),
    gruppen.length ? h('div', { class: 'raster-karten' }, gruppen.map((lg) => h('section', { class: 'karte lerngruppe-karte' },
      h('h2', {}, h('a', { href: `#/lerngruppe/${lg.id}` }, lg.bezeichnung)),
      h('p', { class: 'leise' }, lg.klassenstufe ? `Klassenstufe ${lg.klassenstufe}` : 'ohne Klassenstufe', ` · bis ${datum(lg.loeschenAm)}`),
      h('div', { class: 'kennzahlen' },
        h('span', { class: `marke${lg.erfassung.erfassung ? ' gut' : ' warten'}` }, lg.erfassung.erfassung ? 'Auswertung an' : 'ohne Auswertung'),
        h('span', { class: 'marke' }, `${lg.freigaben.length} ${lg.freigaben.length === 1 ? 'Quest' : 'Quests'}`)),
      lg.freigaben.slice(0, 3).map((f) => h('p', {}, h('a', { href: `#/quest/${f.id}` }, f.titel), h('span', { class: 'leise' }, ` · ${f.gruppen} Gruppen · ${f.beendet ? 'beendet' : 'läuft'}`)))))) :
      h('div', { class: 'karte' }, h('p', {}, 'Noch keine Lerngruppe. Legen Sie zuerst eine an, zum Beispiel „Klasse 6a“. Namen von Schülerinnen und Schülern braucht die Anwendung nicht.')),
    h('section', { class: 'karte', stil: { 'margin-top': '18px' } }, h('h2', {}, 'Material'),
      h('div', { class: 'knopfreihe' },
        link('Einwilligungsbrief für Eltern', '#/einwilligung', { art: 'zweit', sym: 'pdf' }),
        knopf('QR-Schilder der Orte (PDF)', () => herunterladen(qrSchilder(inhalte.orte, basisUrl()), 'qr-schilder-spurensuche.pdf', 'application/pdf'), { art: 'zweit', sym: 'qr' }))));
  return 'Lerngruppen';
}

function lerngruppeDialog(lg = null) {
  return dialog(lg ? 'Lerngruppe ändern' : 'Neue Lerngruppe', (inhalt, schliesse) => {
    const name = h('input', { id: 'lg-name', type: 'text', maxlength: '40', value: lg?.bezeichnung ?? '', 'aria-describedby': 'lg-name-hilfe' });
    const stufe = h('select', { id: 'lg-stufe' }, h('option', { value: '' }, 'keine Klassenstufe (z. B. Jugendgruppe)'),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => h('option', { value: String(n), selected: lg?.klassenstufe === n }, `Klassenstufe ${n}`)));
    const einwilligung = h('input', { type: 'checkbox', id: 'lg-einw', checked: !!lg?.einwilligungAm });
    const fehler = h('p', { class: 'hinweisfeld fehler', role: 'alert', hidden: true });
    inhalt.append(h('form', { onsubmit: async (ev) => {
      ev.preventDefault();
      const daten = { bezeichnung: name.value, klassenstufe: stufe.value === '' ? null : Number(stufe.value), einwilligung: einwilligung.checked };
      try {
        if (lg) await api.lerngruppeAendern(lg.id, daten); else await api.lerngruppeAnlegen(daten);
        schliesse(true);
        zeige();
      } catch (e) { fehler.textContent = e.message; fehler.hidden = false; }
    } },
    h('div', { class: 'feld' }, h('label', { for: 'lg-name' }, 'Bezeichnung'), name, h('p', { class: 'erklaerung', id: 'lg-name-hilfe' }, 'Zum Beispiel „Klasse 6a“ oder „Projektgruppe Geschichte“. Keine Namen von Schülerinnen und Schülern.')),
    h('div', { class: 'feld' }, h('label', { for: 'lg-stufe' }, 'Klassenstufe'), stufe, h('p', { class: 'erklaerung' }, 'Ausgewertet wird nur für die Klassenstufen 4 bis 8. Andere Gruppen spielen ohne Auswertung; es entstehen keine Beobachtungsdaten.')),
    h('label', { class: 'schalter' }, einwilligung, 'Die Einwilligungen der Erziehungsberechtigten liegen vor.'),
    h('p', { class: 'erklaerung' }, h('a', { href: '#/einwilligung' }, 'Einwilligungsbrief öffnen'), '. Ohne Bestätigung entstehen keine Beobachtungsdaten.'),
    fehler, h('div', { class: 'knopfreihe' }, knopf(lg ? 'Speichern' : 'Anlegen', null, { typ: 'submit' }))));
    setTimeout(() => name.focus(), 50);
  });
}

// --- Lerngruppe --------------------------------------------------------------------------------------------------

async function zeigeLerngruppe(id) {
  const lg = (await api.lerngruppen()).find((x) => x.id === id);
  if (!lg) { leere(haupt, h('h1', {}, 'Lerngruppe nicht gefunden'), h('a', { href: '#/' }, 'Zur Übersicht')); return 'Nicht gefunden'; }
  leere(haupt,
    krumen(['Lerngruppen', '#/'], [lg.bezeichnung]),
    h('div', { class: 'seitenkopf' }, h('div', {}, h('h1', {}, lg.bezeichnung),
      h('p', { class: 'leise' }, lg.klassenstufe ? `Klassenstufe ${lg.klassenstufe}` : 'ohne Klassenstufe', ` · angelegt am ${datum(lg.erstellt)} · wird am ${datum(lg.loeschenAm)} gelöscht (Ende des Schuljahres)`)),
    h('div', { class: 'knopfreihe' }, knopf('Ändern', () => lerngruppeDialog(lg), { art: 'leise', sym: 'stift' }), link('Quest freigeben', `#/lerngruppe/${lg.id}/freigeben`, { sym: 'karte' }))),
    h('p', { class: `hinweisfeld${lg.erfassung.erfassung ? ' gut' : ''}` }, lg.erfassung.grund),
    h('h2', {}, 'Quests'),
    lg.freigaben.length ? h('div', { class: 'tabelle-rahmen', tabindex: '0', role: 'region', 'aria-label': 'Quests' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Quest', 'Zeitrahmen', 'Gruppen', 'Stand', 'Löschung'].map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', {}, lg.freigaben.map((f) => h('tr', {},
        h('th', { scope: 'row' }, h('a', { href: `#/quest/${f.id}` }, f.titel)),
        h('td', {}, ZEITRAHMEN[f.zeitrahmen] ?? f.zeitrahmen), h('td', {}, String(f.gruppen)),
        h('td', {}, f.beendet ? `beendet am ${datum(f.beendet)}` : `läuft seit ${datum(f.erstellt)}`),
        h('td', {}, datum(f.loeschenAm))))))) : h('p', {}, 'Noch keine Quest freigegeben.'),
    h('div', { class: 'knopfreihe', stil: { 'margin-top': '24px' } }, knopf('Lerngruppe löschen', async () => {
      if (await frage('Lerngruppe löschen?', 'Alle Quests, Gruppen und Beobachtungen dieser Lerngruppe werden sofort und endgültig gelöscht. Freigegebene Bildbeiträge bleiben ohne Bezug zur Gruppe in der Ausstellung.', { ja: 'Endgültig löschen', gefaehrlich: true })) {
        await api.lerngruppeLoeschen(lg.id);
        melde('Lerngruppe gelöscht.');
        location.hash = '#/';
      }
    }, { art: 'warnung', sym: 'muell' })));
  return lg.bezeichnung;
}

// --- Quest freigeben ---------------------------------------------------------------------------------------------

async function zeigeFreigeben(lgId) {
  const lg = (await api.lerngruppen()).find((x) => x.id === lgId);
  if (!lg) { location.hash = '#/'; return ''; }
  const aufgabenJeOrt = new Map();
  for (const ort of inhalte.orte) aufgabenJeOrt.set(ort.id, await aufgabenVon(ort).catch(() => []));
  const auswahl = new Map(); // ort → Set(nr)
  const summe = h('p', { class: 'marke', role: 'status' });
  const titel = h('input', { id: 'q-titel', type: 'text', maxlength: '60', value: '' });
  const rueckmeldung = h('input', { type: 'checkbox', id: 'q-rueck' });
  let zeitrahmen = 'eigen';

  const aktualisiereSumme = () => {
    let min = 0;
    let n = 0;
    for (const [ort, nrn] of auswahl) for (const nr of nrn) { min += aufgabenJeOrt.get(ort)?.find((a) => a.nr === nr)?.dauerMinuten ?? 0; n++; }
    summe.textContent = `${auswahl.size} ${auswahl.size === 1 ? 'Ort' : 'Orte'}, ${n} Aufgaben, etwa ${min} Minuten`;
  };
  const ortsListe = h('div', {});
  const zeichneOrte = () => leere(ortsListe, inhalte.orte.map((ort) => {
    const gewaehlt = auswahl.get(ort.id);
    const alle = aufgabenJeOrt.get(ort.id) ?? [];
    return h('fieldset', {}, h('legend', {}, h('label', { class: 'schalter' }, h('input', { type: 'checkbox', checked: !!gewaehlt, onchange: (ev) => {
      if (ev.target.checked) auswahl.set(ort.id, new Set(ort.aufgaben)); else auswahl.delete(ort.id);
      zeitrahmen = 'eigen'; zeichneOrte(); aktualisiereSumme();
    } }), `${ort.name} (${ort.region})`)),
    gewaehlt ? h('div', { class: 'wahl' }, alle.map((a) => {
      const id = `q-${ort.id}-${a.nr}`;
      return [h('input', { type: 'checkbox', id, checked: gewaehlt.has(a.nr), onchange: (ev) => {
        if (ev.target.checked) gewaehlt.add(a.nr); else gewaehlt.delete(a.nr);
        if (!gewaehlt.size) auswahl.delete(ort.id);
        zeitrahmen = 'eigen'; zeichneOrte(); aktualisiereSumme();
      } }), h('label', { for: id }, `${a.titel} · ${a.dauerMinuten} Min.`)];
    })) : null);
  }));
  const vorschlag = (ab) => {
    auswahl.clear();
    for (const o of ab.orte) auswahl.set(o.ort, new Set(o.aufgaben));
    zeitrahmen = ab.id;
    if (!titel.value) titel.value = `${ab.name}: ${ab.orte.map((o) => inhalte.ortNach.get(o.ort)?.name).filter(Boolean).slice(0, 2).join(', ')}`.slice(0, 60);
    zeichneOrte(); aktualisiereSumme();
  };
  const fehler = h('p', { class: 'hinweisfeld fehler', role: 'alert', hidden: true });
  leere(haupt,
    krumen(['Lerngruppen', '#/'], [lg.bezeichnung, `#/lerngruppe/${lg.id}`], ['Quest freigeben']),
    h('h1', {}, 'Quest freigeben'),
    h('p', { class: `hinweisfeld${lg.erfassung.erfassung ? ' gut' : ''}` }, lg.erfassung.grund),
    inhalte.ablaeufe.length ? h('section', { class: 'karte' }, h('h2', {}, '1. Zeitrahmen wählen'),
      h('div', { class: 'knopfreihe' }, inhalte.ablaeufe.map((ab) => knopf(`${ab.name} (${ab.minuten} Min.)`, () => vorschlag(ab), { art: 'zweit' }))),
      h('p', { class: 'leise' }, 'Ein Vorschlag lässt sich danach beliebig ändern.')) : null,
    h('section', { class: 'karte' }, h('h2', {}, `${inhalte.ablaeufe.length ? '2' : '1'}. Orte und Aufgaben`), summe, ortsListe),
    h('form', { class: 'karte', onsubmit: async (ev) => {
      ev.preventDefault();
      const orte = [...auswahl].map(([ort, nrn]) => ({ ort, aufgaben: inhalte.ortNach.get(ort).aufgaben.filter((nr) => nrn.has(nr)) }));
      try {
        const r = await api.questFreigeben(lg.id, { titel: titel.value, zeitrahmen, orte, rueckmeldung: rueckmeldung.checked });
        melde('Quest freigegeben. Legen Sie jetzt die Gruppen an.');
        location.hash = `#/quest/${r.id}/gruppen`;
      } catch (e) { fehler.textContent = e.message; fehler.hidden = false; }
    } },
    h('h2', {}, `${inhalte.ablaeufe.length ? '3' : '2'}. Titel und Freigabe`),
    h('div', { class: 'feld' }, h('label', { for: 'q-titel' }, 'Titel der Quest'), titel),
    h('label', { class: 'schalter' }, rueckmeldung, 'Nach jeder Aufgabe kurz nach Rückmeldung fragen (für Workshops, anonym)'),
    fehler, knopf('Freigeben', null, { typ: 'submit', art: 'gross', sym: 'haken' })));
  zeichneOrte();
  aktualisiereSumme();
  return 'Quest freigeben';
}

// --- Quest: Reiter -----------------------------------------------------------------------------------------------

async function zeigeQuest(id, reiter = 'uebersicht', gruppeId = null) {
  const q = await api.quest(id);
  const reiterListe = [['uebersicht', 'Laufende Übersicht', 'aktualisieren'], ['gruppen', 'Gruppen', 'familie'], ['auswertung', 'Auswertung', 'buch'], ['bilder', `Bildbeiträge${q.bildbeitraegeWartend ? ` (${q.bildbeitraegeWartend})` : ''}`, 'bild']];
  if (q.rueckmeldung) reiterListe.push(['rueckmeldungen', 'Rückmeldungen', 'stern']);
  const kopf = [
    krumen(['Lerngruppen', '#/'], [q.lerngruppe.bezeichnung, `#/lerngruppe/${q.lerngruppe.id}`], [q.titel]),
    h('div', { class: 'seitenkopf' }, h('div', {}, h('h1', {}, q.titel),
      h('p', { class: 'leise' }, `${ZEITRAHMEN[q.zeitrahmen] ?? ''} · ${q.orte.length} ${q.orte.length === 1 ? 'Ort' : 'Orte'} · ${q.beendet ? `beendet am ${datum(q.beendet)}` : `seit ${datum(q.erstellt)}`} · Daten werden am ${datum(q.loeschenAm)} gelöscht`)),
    h('div', { class: 'knopfreihe' },
      q.beendet ? null : knopf('Quest beenden', async () => {
        if (await frage('Quest beenden?', 'Gruppen können danach nicht mehr beitreten. Die Löschfrist von zwölf Wochen beginnt jetzt.', { ja: 'Beenden' })) { await api.questBeenden(id); zeige(); }
      }, { art: 'leise' }),
      knopf('Quest löschen', async () => {
        if (await frage('Quest löschen?', 'Alle Gruppen und Beobachtungen dieser Quest werden sofort und endgültig gelöscht.', { ja: 'Endgültig löschen', gefaehrlich: true })) { await api.questLoeschen(id); location.hash = `#/lerngruppe/${q.lerngruppe.id}`; }
      }, { art: 'warnung' }))),
    q.erfassung ? null : h('p', { class: 'hinweisfeld' }, 'Für diese Quest werden keine Beobachtungen erfasst (Klassenstufe außerhalb 4 bis 8 oder Einwilligungen nicht bestätigt). Übersicht und Auswertung bleiben deshalb leer.'),
    h('nav', { class: 'reiter', 'aria-label': 'Bereiche der Quest' }, reiterListe.map(([r, text, sym]) => h('a', { href: `#/quest/${id}/${r}`, 'aria-current': r === reiter ? 'page' : null }, symbol(sym), text))),
  ];
  const bereich = h('div', {});
  leere(haupt, ...kopf, bereich);
  if (reiter === 'gruppen') await zeigeGruppen(q, bereich);
  else if (reiter === 'auswertung') await zeigeAuswertung(q, bereich, gruppeId);
  else if (reiter === 'bilder') await zeigeBilder(q, bereich);
  else if (reiter === 'rueckmeldungen') zeigeRueckmeldungen(q, bereich);
  else zeigeLaufend(q, bereich);
  return q.titel;
}

function zellenStatus(st) {
  const [sym, text] = STATUS[st.status] ?? STATUS.offen;
  const detail = st.status === 'begonnen' ? ` (${st.aufgabenFertig}/${st.aufgaben})` : '';
  return h('span', { class: `zelle-status ${st.status}` }, sym === 'offen' ? h('span', { 'aria-hidden': 'true' }, '–') : symbol(sym === 'begonnen' ? 'stift' : sym), `${text}${detail}`);
}

function zeigeLaufend(q, bereich) {
  const zeichne = (q2) => leere(bereich,
    h('p', { class: 'leise', role: 'status', 'aria-live': 'polite' }, `Stand ${datumZeit(new Date().toISOString())}. Aktualisiert sich alle zehn Sekunden.`),
    q2.gruppen.length ? h('div', { class: 'tabelle-rahmen', tabindex: '0', role: 'region', 'aria-label': 'Laufende Übersicht' }, h('table', {},
      h('caption', { class: 'nur-vorlesbar' }, 'Bearbeitungsstand je Gruppe und Ort'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Gruppe'), q2.orte.map((o) => h('th', { scope: 'col' }, o.name)), h('th', { scope: 'col' }, 'Zuletzt übertragen'))),
      h('tbody', {}, q2.gruppen.map((g) => h('tr', {},
        h('th', { scope: 'row' }, g.bezeichnung, g.aktuell ? h('div', { class: 'leise' }, `gerade: ${q2.orte.find((o) => o.ort === g.aktuell)?.name ?? g.aktuell}`) : null),
        g.stationen.map((st) => h('td', {}, zellenStatus(st))),
        h('td', {}, g.letzteSync ? vorZeit(g.letzteSync) : 'noch nicht')))))) :
      h('p', {}, 'Noch keine Gruppen. ', h('a', { href: `#/quest/${q.id}/gruppen` }, 'Gruppen anlegen')),
    h('p', { class: 'leise' }, 'Die Übersicht zeigt nur Station und Stand, keine Stufen. Geräte ohne Netz übertragen später; dann springt die Anzeige nach.'));
  zeichne(q);
  aktualisierung = setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    try { zeichne(await api.quest(q.id)); } catch { /* nächster Versuch */ }
  }, 10_000);
}

async function zeigeGruppen(q, bereich) {
  const vergeben = q.gruppen.map((g) => g.bezeichnung);
  const frei = freieVorschlaege(vergeben);
  const anlegen = async (name, bestaetigt = false) => {
    try {
      await api.gruppeAnlegen(q.id, { bezeichnung: name, bestaetigt });
      melde(`Gruppe ${name} angelegt.`);
      zeige();
    } catch (e) {
      if (e.status === 409 && e.daten?.bestaetigen) {
        if (await frage('Freie Bezeichnung', `${e.daten.hinweis} Trotzdem „${name}“ verwenden?`, { ja: 'Ja, ohne Namen von Kindern' })) anlegen(name, true);
      } else melde(e.message, { dauer: 6000 });
    }
  };
  const freiFeld = h('input', { id: 'g-frei', type: 'text', maxlength: '24', 'aria-describedby': 'g-frei-hinweis' });
  leere(bereich,
    q.beendet ? h('p', { class: 'hinweisfeld' }, 'Die Quest ist beendet; neue Gruppen können nicht mehr beitreten.') : h('section', { class: 'karte' },
      h('h2', {}, 'Gruppe hinzufügen'),
      h('p', { class: 'leise' }, 'Wählen Sie eine neutrale Bezeichnung. Welche Kinder in welcher Gruppe sind, wissen nur Sie; die Anwendung speichert es nicht.'),
      Object.entries(frei).map(([kategorie, namen]) => h('div', { class: 'feld' }, h('p', { class: 'leise', stil: { 'margin-bottom': '4px' } }, kategorie),
        h('div', { class: 'wahl' }, namen.slice(0, 12).map((n) => knopf(n, () => anlegen(n), { art: 'leise' }))))),
      h('form', { onsubmit: (ev) => {
        ev.preventDefault();
        const p = pruefeBezeichnung(freiFeld.value);
        if (!p.ok) { melde(p.fehler); return; }
        anlegen(p.name);
      } },
      h('div', { class: 'feld' }, h('label', { for: 'g-frei' }, 'Eigene Bezeichnung'), freiFeld,
        h('p', { class: 'erklaerung', id: 'g-frei-hinweis' }, 'Vor dem Speichern erscheint ein Hinweis: keine Namen oder Namensteile von Schülerinnen und Schülern.')),
      knopf('Hinzufügen', null, { typ: 'submit', art: 'zweit' }))),
    h('h2', {}, `Gruppen (${q.gruppen.length})`),
    h('ul', { class: 'gruppenliste' }, q.gruppen.map((g) => {
      const beitrittsLink = new URL(`index.html#/beitritt?code=${g.code}`, basisUrl()).href;
      return h('li', { class: 'karte gruppenkarte' },
        h('div', { class: 'qr-klein', 'aria-hidden': 'true' }, svgAusText(qrSvg(beitrittsLink))),
        h('div', { class: 'text' }, h('h3', {}, g.bezeichnung), h('p', {}, 'Code: ', h('span', { class: 'code-gross' }, g.code)),
          h('div', { class: 'knopfreihe' },
            knopf('Umbenennen', () => umbenennen(g), { art: 'leise', sym: 'stift' }),
            knopf('Löschen', async () => {
              if (await frage(`Gruppe ${g.bezeichnung} löschen?`, 'Alle Beobachtungen dieser Gruppe werden sofort gelöscht. Das Gerät der Gruppe kann danach nichts mehr übertragen.', { ja: 'Löschen', gefaehrlich: true })) { await api.gruppeLoeschen(g.id); zeige(); }
            }, { art: 'leise', sym: 'muell' }))));
    })),
    q.gruppen.length ? h('p', { class: 'leise' }, 'Die Gruppe tippt in der Spieler-Ansicht „Mit der Klasse“ und gibt den Code ein oder scannt den QR-Code.') : null);
}

function umbenennen(g) {
  return dialog(`Gruppe ${g.bezeichnung} umbenennen`, (inhalt, schliesse) => {
    const feld = h('input', { id: 'g-neu', type: 'text', maxlength: '24', value: g.bezeichnung });
    inhalt.append(h('form', { onsubmit: async (ev) => {
      ev.preventDefault();
      const senden = async (bestaetigt) => {
        try { await api.gruppeAendern(g.id, { bezeichnung: feld.value, bestaetigt }); schliesse(true); zeige(); } catch (e) {
          if (e.status === 409 && e.daten?.bestaetigen && await frage('Freie Bezeichnung', `${e.daten.hinweis} Trotzdem verwenden?`, { ja: 'Ja, ohne Namen von Kindern' })) senden(true);
          else if (e.status !== 409) melde(e.message);
        }
      };
      senden(false);
    } }, h('div', { class: 'feld' }, h('label', { for: 'g-neu' }, 'Neue Bezeichnung'), feld), knopf('Speichern', null, { typ: 'submit' })));
  });
}

// --- Auswertung ------------------------------------------------------------------------------------------------

async function zeigeAuswertung(q, bereich, gruppeId) {
  if (!q.gruppen.length) { leere(bereich, h('p', {}, 'Noch keine Gruppen.')); return; }
  const id = gruppeId ?? q.gruppen[0].id;
  const a = await api.auswertung(id);
  const wahl = h('select', { id: 'ausw-gruppe', onchange: (ev) => { location.hash = `#/quest/${q.id}/auswertung/${ev.target.value}`; } },
    q.gruppen.map((g) => h('option', { value: g.id, selected: g.id === id }, g.bezeichnung)));
  const entwurf = h('textarea', { id: 'entwurf', rows: '10', 'aria-describedby': 'entwurf-hinweis' }, a.entwurf);
  const b = a.beobachtungen;
  const abschnitt = (titel, saetze, extra = null) => h('section', { class: 'karte' }, h('h3', {}, titel), h('ul', {}, saetze.map((s) => h('li', {}, s))), extra);
  const rollen = Object.entries(b.beteiligung.eingabenJeRolle);

  const raster = h('table', { class: 'raster' },
    h('caption', { class: 'nur-vorlesbar' }, 'Kompetenzraster: Bereiche in Zeilen, Stufen in Spalten'),
    h('thead', {}, h('tr', {}, h('td', {}), STUFEN.map((s) => h('th', { scope: 'col' }, s.name)))),
    h('tbody', {}, a.raster.zeilen.map((z) => h('tr', {},
      h('th', { scope: 'row' }, z.name),
      z.zellen.map((c) => {
        const gewaehlt = z.stufe === c.stufe;
        const name = `einschaetzung-${z.bereich}`;
        return h('td', {}, h('div', { class: `raster-zelle${c.belege.length ? ' beobachtet' : ''}${gewaehlt ? ' gewaehlt' : ''}` },
          h('div', { class: 'zelle-kopf' }, h('strong', { class: 'nur-vorlesbar' }, `${z.name}, ${c.name}`),
            z.vorschlag === c.stufe ? h('span', { class: 'marke' }, 'Vorschlag') : null,
            c.belege.length ? h('span', { class: 'marke gut' }, 'beobachtet') : null),
          h('span', {}, c.beschreibung),
          c.belege.length ? h('details', {}, h('summary', {}, `${c.belege.length} ${c.belege.length === 1 ? 'Beleg' : 'Belege'}`), h('ul', {}, c.belege.map((x) => h('li', {}, x)))) : null,
          h('label', { class: 'raster-wahl' }, h('input', { type: 'radio', name, value: c.stufe, checked: z.einschaetzung === c.stufe, onchange: async () => {
            const einschaetzung = { ...a.einschaetzung, [z.bereich]: c.stufe };
            await api.gruppeAendern(id, { einschaetzung });
            melde(`${z.name}: Stufe „${c.name}“ gewählt.`);
            zeige();
          } }), 'Ihre Einschätzung')));
      })))));

  leere(bereich,
    h('div', { class: 'feld' }, h('label', { for: 'ausw-gruppe' }, 'Gruppe'), wahl),
    h('p', { class: 'leise' }, a.stand ? `Letzte Beobachtung am ${datumZeit(a.stand)}.` : 'Noch keine Beobachtung.', ` Die Daten dieser Gruppe werden spätestens am ${datum(a.loeschenAm)} gelöscht.`),
    h('h2', {}, 'Beobachtungen'),
    h('div', { class: 'beobachtungen' },
      abschnitt('Teamleistung', b.teamleistung.saetze),
      abschnitt('Problemlösung', b.problemloesung.saetze),
      abschnitt('Beteiligung', b.beteiligung.saetze, rollen.length ? h('p', { class: 'leise' }, 'Rollen sind Positionen in der Gruppe, keine Personen.') : null),
      abschnitt('Zeit und Technik', [b.kontext.satz, b.technik.satz])),
    h('h2', { stil: { 'margin-top': '22px' } }, 'Kompetenzraster'),
    h('p', { class: 'leise' }, 'Markiert sind Stufen, zu denen es Beobachtungen gibt. Der Vorschlag ist die höchste beobachtete Stufe. Ihre Einschätzung geht dem Vorschlag vor und steht im Bericht.'),
    h('div', { class: 'tabelle-rahmen', stil: { padding: '6px' }, tabindex: '0', role: 'region', 'aria-label': 'Kompetenzraster' }, raster),
    h('h2', { stil: { 'margin-top': '22px' } }, 'Formulierungsentwurf'),
    h('div', { class: 'karte entwurf-rahmen' }, h('span', { class: 'marke' }, 'Entwurf'),
      h('label', { for: 'entwurf' }, 'Textbausteine für eine Verbaleinschätzung'), entwurf,
      h('p', { class: 'erklaerung', id: 'entwurf-hinweis' }, 'Bitte prüfen und anpassen. Der Text wird nicht gespeichert; er geht nur in den Bericht, den Sie herunterladen.')),
    h('div', { class: 'knopfreihe', stil: { 'margin-top': '16px' } },
      knopf('Gruppenbericht als PDF', () => {
        herunterladen(gruppenbericht({ auswertung: a, entwurf: entwurf.value }), `gruppenbericht-${a.gruppe.bezeichnung.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`, 'application/pdf');
        melde('Bericht erstellt. Er liegt jetzt in Ihren Downloads.');
      }, { art: 'gross', sym: 'pdf' }),
      knopf('Gruppendaten jetzt löschen', async () => {
        if (await frage(`Daten der Gruppe ${a.gruppe.bezeichnung} löschen?`, 'Beobachtungen, Raster und Einschätzung dieser Gruppe werden sofort und endgültig gelöscht. Einen heruntergeladenen Bericht betrifft das nicht.', { ja: 'Endgültig löschen', gefaehrlich: true })) {
          await api.gruppeLoeschen(id);
          melde('Gruppendaten gelöscht.');
          location.hash = `#/quest/${q.id}/auswertung`;
        }
      }, { art: 'warnung', sym: 'muell' })));
}

// --- Bildbeiträge ------------------------------------------------------------------------------------------------

async function zeigeBilder(q, bereich) {
  const liste = await api.bildbeitraege(q.id);
  const gewaehlt = new Set();
  const STAT = { wartet: 'wartet auf Ihre Entscheidung', freigegeben: 'freigegeben', abgelehnt: 'nicht freigegeben' };
  const entscheide = async (kennungen, freigeben) => {
    if (!kennungen.length) { melde('Bitte zuerst Bilder auswählen.'); return; }
    const r = await api.bildbeitraegeEntscheiden(kennungen, freigeben);
    melde(`${r.geaendert} ${r.geaendert === 1 ? 'Bild' : 'Bilder'} ${freigeben ? 'freigegeben' : 'nicht freigegeben'}.`);
    zeige();
  };
  const karten = [];
  for (const b of liste) {
    const id = `bb-${b.kennung}`;
    karten.push(h('li', {},
      h('img', { src: await api.vorschauUrl(b), alt: `Bildbeitrag der Gruppe ${b.gruppe}: Collage aus ${b.items.length} Sammelstücken` }),
      h('strong', {}, b.gruppe), h('span', { class: `marke${b.status === 'freigegeben' ? ' gut' : b.status === 'wartet' ? ' warten' : ''}` }, STAT[b.status]),
      h('span', { class: 'leise' }, datumZeit(b.erstellt)),
      h('label', { class: 'schalter' }, h('input', { type: 'checkbox', id, onchange: (ev) => { if (ev.target.checked) gewaehlt.add(b.kennung); else gewaehlt.delete(b.kennung); } }), 'auswählen')));
  }
  leere(bereich,
    h('p', {}, 'Bildbeiträge entstehen nach der Abschlussaufgabe. Nur freigegebene Bilder gehen über die Schnittstelle an die Ausstellung; im Bild und in den Metadaten steht kein Gruppenname.'),
    liste.length ? [
      h('div', { class: 'knopfreihe', stil: { 'margin-bottom': '14px' } },
        knopf('Ausgewählte freigeben', () => entscheide([...gewaehlt], true), { sym: 'haken' }),
        knopf('Ausgewählte nicht freigeben', () => entscheide([...gewaehlt], false), { art: 'leise' }),
        knopf('Alle wartenden freigeben', () => entscheide(liste.filter((b) => b.status === 'wartet').map((b) => b.kennung), true), { art: 'zweit' })),
      h('ul', { class: 'bildraster' }, karten)] : h('p', { class: 'leise' }, 'Noch keine Bildbeiträge.'));
}

function zeigeRueckmeldungen(q, bereich) {
  leere(bereich,
    h('p', {}, 'Nach jeder Aufgabe beantworten die Gruppen drei kurze Fragen (verständlich, Spaß, Schwierigkeit). Es gibt keine Freitexte und keine Namen. Die Liste geht in den Änderungsbericht des Workshops.'),
    api.vorfuehrung ? knopf('Rückmeldungen als CSV', async () => herunterladen(await api.rueckmeldungenCsv(q.id), 'rueckmeldungen.csv', 'text/csv'), { sym: 'herunter' })
      : link('Rückmeldungen als CSV', api.rueckmeldungenCsvUrl(q.id), { sym: 'herunter' }));
}

// --- Einwilligungsbrief ------------------------------------------------------------------------------------------

function zeigeEinwilligung() {
  const absatz = (t) => h('p', {}, t);
  leere(haupt,
    krumen(['Lerngruppen', '#/'], ['Einwilligungsbrief']),
    h('div', { class: 'knopfreihe nicht-drucken', stil: { 'margin-bottom': '14px' } }, knopf('Drucken', () => window.print(), { sym: 'pdf' })),
    h('article', { class: 'brief' },
      h('h1', {}, 'Einwilligung der Erziehungsberechtigten: Spurensuche Sachsen'),
      absatz('Liebe Eltern, liebe Erziehungsberechtigte,'),
      absatz('unsere Klasse spielt die „Spurensuche Sachsen“: eine Entdeckungsreise mit kurzen Spielen an Orten in Sachsen oder im Klassenzimmer. Die Kinder spielen in kleinen Gruppen auf Geräten der Schule.'),
      h('h2', {}, 'Was gespeichert wird'),
      absatz('Gespeichert wird nur, wie eine Gruppe gespielt hat: welche Stationen sie begonnen und beendet hat, wie viele Versuche und Hinweise sie gebraucht hat, welche Lösungswege sie gewählt hat und wie oft die Rollen in der Gruppe (zum Beispiel „Navigation“) etwas eingegeben haben. Bezugspunkt ist ein neutraler Gruppenname wie „Biber“.'),
      absatz('Nicht gespeichert werden: Namen, Fotos, Ton, Standorte und Gerätekennungen. Welches Kind in welcher Gruppe ist, weiß nur die Lehrkraft.'),
      h('h2', {}, 'Wozu'),
      absatz('Die Lehrkraft nutzt die Beobachtungen als Grundlage für Gespräche und für die Einschätzung von Teamarbeit, Problemlösen und Beteiligung. Es gibt keine Noten, keine Punktzahlen und keine Rangfolge.'),
      h('h2', {}, 'Wie lange'),
      absatz('Die Daten werden zwölf Wochen nach der Quest automatisch gelöscht, spätestens am Ende des Schuljahres. Die Lehrkraft kann sie früher löschen. Gespeichert wird auf Servern in der EU.'),
      h('h2', {}, 'Bildbeitrag'),
      absatz('Am Ende gestaltet jede Gruppe ein Bild aus ihren Sammelstücken, ohne Namen. Es wird nur in der Ausstellung gezeigt, wenn die Lehrkraft es freigibt.'),
      h('h2', {}, 'Freiwillig und widerruflich'),
      absatz('Die Einwilligung ist freiwillig und kann jederzeit ohne Nachteile widerrufen werden. Ohne Einwilligung spielt Ihr Kind ohne Auswertung mit.'),
      h('h2', {}, 'In einfacher Sprache'),
      absatz('Die Kinder spielen in Gruppen. Wir speichern nur, wie die Gruppe gespielt hat. Wir speichern keine Namen, keine Fotos und keinen Ort. Nach zwölf Wochen löschen wir alles. Sie können Nein sagen. Dann spielt Ihr Kind trotzdem mit.'),
      h('div', { class: 'unterschrift' },
        h('div', {}, h('p', {}, '☐ Ich willige ein.   ☐ Ich willige nicht ein.'), h('div', { class: 'linie' }, 'Name des Kindes (bleibt bei der Schule)')),
        h('div', {}, h('p', {}, ' '), h('div', { class: 'linie' }, 'Datum, Unterschrift der Erziehungsberechtigten')))),
    h('p', { class: 'leise nicht-drucken' }, 'Die unterschriebenen Briefe bleiben in der Schule. In der Anwendung bestätigen Sie nur, dass sie vorliegen.'));
  return 'Einwilligungsbrief';
}

// --- Verteiler ---------------------------------------------------------------------------------------------------

let nr = 0;
async function zeige() {
  const meine = ++nr;
  clearInterval(aktualisierung);
  const roh = location.hash.replace(/^#\/?/, '');
  const fehler = /fehler=([a-z-]+)/.exec(roh)?.[1] ?? null;
  const teile = roh.split('?')[0].split('#')[0].split('/').filter(Boolean);
  try {
    ich = await api.ich().catch(() => null);
    zeichneKopf();
    let titel;
    if (!ich || ich.rolle !== 'lehrkraft') titel = zeigeAnmeldung(fehler);
    else if (teile[0] === 'lerngruppe' && teile[2] === 'freigeben') titel = await zeigeFreigeben(teile[1]);
    else if (teile[0] === 'lerngruppe') titel = await zeigeLerngruppe(teile[1]);
    else if (teile[0] === 'quest') titel = await zeigeQuest(teile[1], teile[2], teile[3]);
    else if (teile[0] === 'einwilligung') titel = zeigeEinwilligung();
    else titel = await zeigeUebersicht();
    if (meine === nr) seitenwechsel(`${titel} – Spurensuche für Lehrkräfte`, haupt);
  } catch (e) {
    console.error(e);
    if (e.status === 401) { ich = null; zeichneKopf(); zeigeAnmeldung(); return; }
    leere(haupt, h('h1', {}, 'Das hat nicht geklappt'), h('p', {}, e.offline ? 'Keine Verbindung zum Server. Bitte später erneut versuchen.' : e.message), h('p', {}, h('a', { href: '#/' }, 'Zur Übersicht')));
  }
}

async function starte() {
  haupt = document.getElementById('inhalt');
  await ladeEinstellungen();
  api = await holeApi();
  inhalte = await ladeInhalte();
  window.addEventListener('hashchange', zeige);
  await zeige();
}

starte();
