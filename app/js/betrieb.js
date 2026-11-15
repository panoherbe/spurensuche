// Betriebsseite: Ampel mit Erklärungen, vier sichere Knöpfe (neu starten, Sicherung zurückspielen, Inhalt tauschen,
// letzte Version zurückspielen), Verlauf der letzten 24 Stunden und Protokoll. Für Menschen ohne Entwicklerwissen:
// Jeder Knopf sagt vorher, was passiert, wie lange es dauert und wie man zurückkommt (docs/BETRIEBSHANDBUCH.md).
// Zeigt keine Lerngruppen, keine Ergebnisse und keine Bilder.

import { h, s, leere, knopf, link, melde, dialog, frage, seitenwechsel, symbol, formatiereBytes } from './ui.js';
import { ladeEinstellungen } from './einstellungen.js';
import { holeApi } from './api.js';
import { datumZeit } from './kern/zeit.js';

const haupt = document.getElementById('inhalt');
const kopf = document.getElementById('kopf');
await ladeEinstellungen();
const api = await holeApi();
const HANDBUCH = 'https://github.com/panoherbe/spurensuche/blob/main/docs/BETRIEBSHANDBUCH.md';

const STUFEN = { gut: ['Gut', 'haken'], info: ['Hinweis', 'info'], achtung: ['Achtung', 'warnung'], stoerung: ['Störung', 'kreuz'] };
const ARTEN = { taeglich: 'tägliche Sicherung', hand: 'von Hand angelegt', 'vor-zurueckspielen': 'vor dem Zurückspielen', 'vor-aktualisierung': 'vor einer neuen Version' };
const AKTIONEN = {
  start: 'Anwendung gestartet', neustart: 'Neustart ausgelöst', anmeldung: 'Anmeldung', 'sicherung-angelegt': 'Sicherung angelegt',
  'zurueckspielen-vorgemerkt': 'Zurückspielen ausgelöst', 'sicherung-zurueckgespielt': 'Sicherung zurückgespielt', 'zurueckspielen-fehlgeschlagen': 'Zurückspielen fehlgeschlagen',
  'inhaltspaket-geprueft': 'Inhaltspaket geprüft', 'inhalt-aktiviert': 'Inhalt aktiviert', 'version-zurueck-beauftragt': 'Letzte Version zurückspielen beauftragt',
  'auftrag-erledigt': 'Auftrag erledigt', 'auftrag-fehlgeschlagen': 'Auftrag fehlgeschlagen', loeschfrist: 'Löschfristen angewandt',
};
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const sekunden = (ms) => (ms / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const uhr = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const zahl = (n) => Number(n).toLocaleString('de-DE');
function seit(iso) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 90) return `${Math.round(s)} Sekunden`;
  if (s < 5400) return `${Math.round(s / 60)} Minuten`;
  if (s < 2 * 86400) return `${Math.round(s / 3600)} Stunden`;
  return `${Math.round(s / 86400)} Tagen`;
}
const stufe = (st) => h('span', { class: `stufe ${st}` }, symbol(STUFEN[st][1]), STUFEN[st][0]);
let zeitgeber = null;

function kopfzeile(angemeldet) {
  leere(kopf, h('a', { class: 'marke-app', href: 'betrieb.html' }, 'Spurensuche · Betrieb'),
    angemeldet ? knopf('Abmelden', async () => { clearInterval(zeitgeber); await api.abmeldenBetrieb().catch(() => {}); anmeldung(); }, { art: 'leise' }) : null);
}

const vorfuehrHinweis = () => (api.vorfuehrung ? h('p', { class: 'hinweisfeld vorfuehrung-hinweis', role: 'note' },
  h('strong', {}, 'Vorführung ohne Server: '), 'Werte und Abläufe sind nachgebildet. Auf einem Server wirken die Knöpfe wirklich. Schlüssel für die Vorführung: BETRIEB-DEMO') : null);

function anmeldung(fehler = null) {
  clearInterval(zeitgeber);
  kopfzeile(false);
  const feld = h('input', { id: 'b-schluessel', type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters', required: true });
  const meldung = h('p', { class: 'hinweisfeld fehler', role: 'alert', hidden: !fehler }, fehler ?? '');
  leere(haupt,
    h('h1', {}, 'Betrieb'),
    vorfuehrHinweis(),
    h('p', {}, 'Hier sehen Sie, ob die Spurensuche läuft. Sie können sie neu starten, Sicherungen zurückspielen, Inhalte tauschen und die letzte Version zurückholen. Lerngruppen, Ergebnisse und Bilder sind hier nicht zu sehen.'),
    h('form', { class: 'karte', onsubmit: async (ev) => {
      ev.preventDefault();
      try { await api.anmeldenBetrieb(feld.value); await zeige(); } catch (e) {
        meldung.textContent = e.status === 401 ? 'Der Schlüssel stimmt nicht. Bitte genau so eingeben, wie er Ihnen gegeben wurde.' : e.message;
        meldung.hidden = false;
        feld.focus();
      }
    } }, h('div', { class: 'feld' }, h('label', { for: 'b-schluessel' }, 'Betriebsschlüssel'), feld), meldung, knopf('Anmelden', null, { typ: 'submit' })),
    h('p', {}, link('Öffentliche Statusseite', 'status.html', { art: 'leise' })));
  seitenwechsel('Betrieb – Spurensuche', haupt);
}

// --- Ampel und Punkte --------------------------------------------------------------------------------------------

function ampel(z) {
  const sym = z.gesamt === 'gut' ? 'haken' : z.gesamt === 'achtung' ? 'warnung' : 'kreuz';
  return h('div', { class: `ampel ${z.gesamt}`, id: 'b-ampel' }, symbol(sym),
    h('div', {},
      h('h2', {}, z.ueberschrift),
      h('p', {}, `Geprüft um ${uhr(z.geprueft)} Uhr · Version ${z.version.installiert} · läuft seit ${seit(z.version.gestartet)}`),
      h('p', { class: 'leise-zeile' }, 'Die Seite prüft jede Minute von selbst.')));
}

const punktZeile = (p) => h('li', { class: p.stufe },
  h('div', { class: 'punkt-kopf' }, stufe(p.stufe), h('strong', {}, p.titel), h('span', { class: 'punkt-wert' }, p.wert)),
  h('p', {}, p.text),
  p.tun ? h('p', { class: 'tun' }, `Was tun: ${p.tun}`) : null);

/** Was gerade gelb oder rot ist, mit „Was tun“: direkt unter der Ampel, damit niemand suchen muss. */
function zuTun(z) {
  const offen = z.punkte.filter((p) => p.stufe === 'achtung' || p.stufe === 'stoerung');
  return h('section', { id: 'b-zutun', 'aria-labelledby': 'b-zutun-titel', hidden: !offen.length },
    h('h2', { id: 'b-zutun-titel' }, 'Das ist zu tun'), h('ul', { class: 'punkte' }, offen.map(punktZeile)));
}

async function aktualisiereZustand() {
  let z;
  try { z = await api.betriebZustand(); } catch (e) { if (e.status === 401) anmeldung('Die Anmeldung ist abgelaufen. Bitte neu anmelden.'); return; }
  document.getElementById('b-ampel')?.replaceWith(ampel(z));
  document.getElementById('b-zutun')?.replaceWith(zuTun(z));
  const liste = document.getElementById('b-punkte');
  if (liste) leere(liste, z.punkte.map(punktZeile));
}

// --- Warten auf Neustart und Aufträge ----------------------------------------------------------------------------

/** Wartet, bis die Anwendung mit einer neuen Startzeit antwortet. Meldet höchstens alle fünf Sekunden (Vorlesen). */
function warteAufNeustart({ titel, vorher, fertig, max = 120 }) {
  return dialog(titel, (inhalt, schliesse) => {
    const text = h('p', { role: 'status', 'aria-live': 'polite' }, 'Die Anwendung startet neu …');
    const weiter = knopf('Schließen', () => { schliesse(true); zeige(); });
    weiter.hidden = true;
    inhalt.append(text, h('div', { class: 'knopfreihe' }, weiter));
    const beginn = performance.now();
    (async () => {
      for (let runde = 1; ; runde++) {
        await pause(500);
        const t = performance.now() - beginn;
        let st = null;
        try { st = await api.status(); } catch { /* noch nicht wieder da */ }
        if (st?.ok && st.gestartet && st.gestartet !== vorher) { text.textContent = `${fertig} (nach ${sekunden(t)} Sekunden).`; weiter.hidden = false; weiter.focus(); return; }
        if (t > max * 1000) { text.textContent = `Nach ${Math.round(max / 60)} Minuten ist die Anwendung nicht wieder da. Bitte im Handbuch den Abschnitt „Wenn die Betriebsseite nicht hilft“ befolgen.`; weiter.hidden = false; weiter.focus(); return; }
        if (runde % 10 === 0) text.textContent = `Warte auf die Anwendung … ${Math.round(t / 1000)} Sekunden`;
      }
    })();
  }, { schliessbar: false });
}

function warteAufAuftrag(auftrag, { max = 300 } = {}) {
  return dialog('Version wird gewechselt', (inhalt, schliesse) => {
    const text = h('p', { role: 'status', 'aria-live': 'polite' }, 'Der Auftrag ist beim Betriebsdienst angekommen …');
    const weiter = knopf('Schließen', () => { schliesse(true); zeige(); });
    weiter.hidden = true;
    inhalt.append(text, h('div', { class: 'knopfreihe' }, weiter));
    const beginn = performance.now();
    const setze = (x) => { if (text.textContent !== x) text.textContent = x; };
    (async () => {
      for (;;) {
        await pause(2000);
        const t = performance.now() - beginn;
        let a = null;
        try { a = await api.auftrag(auftrag.auftrag); } catch { /* die Anwendung startet gerade mit der anderen Version */ }
        if (a?.status === 'fertig') { setze(`Erledigt nach ${Math.round(t / 1000)} Sekunden. ${a.meldung || `Version ${auftrag.auf} läuft.`}`); weiter.hidden = false; weiter.focus(); return; }
        if (a?.status === 'fehler') { setze(`Nicht geklappt: ${a.meldung || 'ohne Angabe'}. Die bisherige Version läuft weiter. Bitte die Entwicklung informieren.`); weiter.hidden = false; weiter.focus(); return; }
        if (t > max * 1000) { setze('Nach fünf Minuten kam keine Rückmeldung. Bitte den Zustand prüfen und im Zweifel die Entwicklung informieren.'); weiter.hidden = false; weiter.focus(); return; }
        setze(a?.status === 'laeuft' ? 'Der Betriebsdienst wechselt die Version …' : a ? 'Wartet auf den Betriebsdienst …' : 'Die Anwendung startet mit der anderen Version …');
      }
    })();
  }, { schliessbar: false });
}

// --- Knöpfe ------------------------------------------------------------------------------------------------------

const grund = (text) => h('p', { class: 'grund' }, text);
const karte = (id, sym, titel, ...inhalt) => h('section', { class: 'karte', 'aria-labelledby': id }, h('h3', { id }, symbol(sym), titel), ...inhalt);

function karteNeustart(z) {
  return karte('k-neustart', 'aktualisieren', 'Neu starten',
    h('p', {}, 'Hilft, wenn die Anwendung langsam ist, Fehler meldet oder hängt. Dauert meist nur wenige Sekunden. Es geht nichts verloren: Geräte speichern Ergebnisse und übertragen sie danach.'),
    z.knoepfe.neustart ? null : grund('Nicht verfügbar: Die Anwendung läuft hier nicht im Container. Am Server: betrieb/spur neustart'),
    h('div', { class: 'knopfreihe' }, knopf('Neu starten …', neustart, { disabled: !z.knoepfe.neustart })));
}

async function neustart() {
  const ja = await frage('Anwendung neu starten?', 'Die Spurensuche ist dabei einige Sekunden nicht erreichbar. Geräte, die gerade übertragen, versuchen es danach von selbst noch einmal.', { ja: 'Jetzt neu starten' });
  if (!ja) return;
  const vorher = (await api.status().catch(() => null))?.gestartet;
  try { await api.neustart(); } catch (e) { melde(e.message, { dauer: 8000 }); return; }
  await warteAufNeustart({ titel: 'Neustart läuft', vorher, fertig: 'Die Anwendung ist wieder erreichbar' });
}

function karteSicherung(sich) {
  // Auswahl als Optionsfelder (ganzer Text lesbar, auch schmal); die neuesten sechs sofort, ältere aufklappbar
  const option = (x, i) => h('div', { class: 'wahl-zeile' },
    h('input', { type: 'radio', name: 'k-sicherung', id: `k-sicherung-${i}`, value: x.datei, checked: i === 0 }),
    h('label', { for: `k-sicherung-${i}` }, `${datumZeit(x.zeit)}, ${ARTEN[x.art] ?? x.art}`));
  const neueste = sich.liste.slice(0, 6);
  const aeltere = sich.liste.slice(6);
  const moeglich = sich.schluessel && sich.liste.length > 0;
  const gewaehlt = () => document.querySelector('input[name="k-sicherung"]:checked')?.value;
  return karte('k-sicherung', 'schloss', 'Sicherung zurückspielen',
    h('p', {}, 'Holt einen früheren Stand der Daten zurück, zum Beispiel wenn die Datenbank einen Fehler meldet. Vorher wird der jetzige Stand gesichert. Sie können also wieder zurück.'),
    !sich.schluessel ? grund('Nicht verfügbar: Es ist kein Sicherungsschlüssel eingerichtet. Bitte die Entwicklung informieren.')
      : !sich.liste.length ? grund('Noch keine Sicherung vorhanden.')
        : h('fieldset', { class: 'sicherungswahl' }, h('legend', {}, 'Welcher Stand?'), neueste.map(option),
          aeltere.length ? h('details', {}, h('summary', {}, `Ältere Sicherungen (${aeltere.length})`), aeltere.map((x, i) => option(x, i + 6))) : null),
    h('div', { class: 'knopfreihe' },
      knopf('Zurückspielen …', () => zurueckspielen(sich.liste.find((x) => x.datei === gewaehlt())), { disabled: !moeglich }),
      knopf('Sicherung jetzt anlegen', sicherungAnlegen, { art: 'leise', disabled: !sich.schluessel })));
}

async function sicherungAnlegen(ev) {
  const k = ev.currentTarget;
  k.disabled = true;
  try {
    const r = await api.sicherungAnlegen();
    melde(`Sicherung angelegt (${formatiereBytes(r.bytes)}, ${sekunden(r.dauerMs)} Sekunden).`, { dauer: 6000 });
    await zeige({ fokus: false });
  } catch (e) { melde(e.message, { dauer: 8000 }); k.disabled = false; }
}

async function zurueckspielen(sicherung) {
  if (!sicherung) return;
  const ok = await dialog('Sicherung zurückspielen?', (inhalt, schliesse) => {
    const haken = h('input', { type: 'checkbox', id: 'z-verstanden' });
    const los = knopf('Zurückspielen', () => schliesse(true), { art: 'warnung', disabled: true });
    haken.addEventListener('change', () => { los.disabled = !haken.checked; });
    inhalt.append(
      h('p', {}, h('strong', {}, `Stand vom ${datumZeit(sicherung.zeit)}`), ` (${ARTEN[sicherung.art] ?? sicherung.art}).`),
      h('p', {}, 'Alles, was danach eingegeben wurde (Gruppen, Ergebnisse, Bildbeiträge, Zugangsschlüssel), ist danach nicht mehr da. Der jetzige Stand wird vorher gesichert („vor dem Zurückspielen“). Damit können Sie zurück.'),
      h('p', {}, 'Die Anwendung startet dabei neu und ist einige Sekunden nicht erreichbar.'),
      h('label', { class: 'verstanden', for: 'z-verstanden' }, haken, 'Verstanden: Neuere Eingaben gehen verloren.'),
      h('div', { class: 'knopfreihe' }, los, knopf('Abbrechen', () => schliesse(false), { art: 'leise' })));
  });
  if (!ok) return;
  const vorher = (await api.status().catch(() => null))?.gestartet;
  let r;
  try { r = await api.zurueckspielen(sicherung.datei); } catch (e) { melde(e.message, { dauer: 10000 }); return; }
  if (!r.neustart) { melde(r.hinweis ?? 'Vorgemerkt.', { dauer: 10000 }); await zeige({ fokus: false }); return; }
  await warteAufNeustart({ titel: 'Sicherung wird zurückgespielt', vorher, fertig: `Der Stand vom ${datumZeit(sicherung.zeit)} ist zurückgespielt. Der vorherige Stand liegt als Sicherung „vor dem Zurückspielen“ bereit` });
}

function karteInhalt(inh) {
  const datei = h('input', { type: 'file', id: 'k-inhalt-datei', accept: '.zip,application/zip' });
  const ergebnis = h('div', { class: 'k-inhalt-ergebnis' });
  const pruefen = knopf('Prüfen', async () => {
    const f = datei.files?.[0];
    if (!f) return;
    pruefen.disabled = true;
    leere(ergebnis, h('p', { role: 'status' }, 'Wird geprüft …'));
    let r;
    try { r = await api.inhaltPruefen(f); } catch (e) {
      leere(ergebnis, h('div', { class: 'ergebnis hinweisfeld fehler', role: 'alert' }, e.message));
      pruefen.disabled = false;
      return;
    }
    if (!r.ok) {
      leere(ergebnis, h('div', { class: 'ergebnis hinweisfeld fehler', role: 'alert' },
        h('strong', {}, `Nicht übernommen: ${r.anzahlFehler} ${r.anzahlFehler === 1 ? 'Fehler' : 'Fehler'} in ${r.name}. Es wurde nichts verändert.`),
        h('ul', {}, r.fehler.slice(0, 20).map((x) => h('li', {}, `${x.datei}${x.pfad && x.pfad !== '/' ? ` (${x.pfad})` : ''}: ${x.meldung}`))),
        r.anzahlFehler > 20 ? h('p', {}, `… und ${r.anzahlFehler - 20} weitere.`) : null,
        h('p', {}, 'Bitte diese Liste an das Redaktionsteam weitergeben.')));
      pruefen.disabled = false;
      return;
    }
    const p = r.paket;
    leere(ergebnis, h('div', { class: 'ergebnis hinweisfeld gut', role: 'status' },
      h('strong', {}, `Geprüft, keine Fehler: ${p.name}`),
      h('ul', {}, h('li', {}, `${p.orte.length} Orte: ${p.orte.join(', ')}`), h('li', {}, `${p.aufgaben} Aufgaben, ${p.sammelstuecke} Sammelstücke`), h('li', {}, `${zahl(p.dateien)} Dateien, ${formatiereBytes(p.bytes)}`)),
      r.warnungen.length ? h('p', {}, h('strong', {}, 'Bitte beachten: '), r.warnungen.join(' ')) : null,
      h('div', { class: 'knopfreihe' }, knopf('Jetzt aktivieren …', () => aktivieren(p.id, p.name)))));
  }, { disabled: true });
  datei.addEventListener('change', () => { pruefen.disabled = !datei.files?.length; leere(ergebnis); });
  return karte('k-inhalt', 'karte', 'Inhalt tauschen',
    h('p', {}, 'Neue Orte, Aufgaben und Bilder einspielen. Die ZIP-Datei dafür bekommen Sie vom Redaktionsteam. Die Anwendung prüft sie, bevor Sie sie aktivieren; vorher ändert sich nichts.'),
    h('p', {}, h('strong', {}, 'Jetzt aktiv: '), `${inh.aktiv.name}, ${inh.aktiv.orte.length} Orte, ${inh.aktiv.aufgaben} Aufgaben${inh.aktiv.seit ? `, seit ${datumZeit(inh.aktiv.seit)}` : ''}`),
    inh.vorher ? h('p', {}, h('strong', {}, 'Davor: '), inh.vorherName) : null,
    h('div', { class: 'feld' }, h('label', { for: 'k-inhalt-datei' }, 'Inhaltspaket (ZIP-Datei)'), datei),
    h('div', { class: 'knopfreihe' }, pruefen,
      inh.vorher ? knopf('Vorherigen Inhalt wiederherstellen', () => aktivieren(inh.vorher, inh.vorherName, true), { art: 'leise' }) : null,
      inh.aktiv.paket !== 'mitgeliefert' && inh.vorher !== 'mitgeliefert' ? knopf('Mitgelieferten Inhalt verwenden', () => aktivieren('mitgeliefert', 'mitgelieferter Inhalt', true), { art: 'leise' }) : null),
    ergebnis);
}

async function aktivieren(paket, name, zurueck = false) {
  const ja = await frage(zurueck ? 'Inhalt wiederherstellen?' : 'Inhalt aktivieren?',
    `„${name}“ wird sofort aktiv. Geräte laden den neuen Inhalt beim nächsten Öffnen mit Netz. Zurück geht es jederzeit mit „Vorherigen Inhalt wiederherstellen“.`,
    { ja: zurueck ? 'Wiederherstellen' : 'Aktivieren' });
  if (!ja) return;
  try {
    const r = await api.inhaltAktivieren(paket);
    melde(`Aktiv: ${name} (${r.orte} Orte, ${r.aufgaben} Aufgaben).`, { dauer: 6000 });
    await zeige({ fokus: false });
  } catch (e) { melde(e.message, { dauer: 10000 }); }
}

function karteVersion(z) {
  const v = z.version;
  return karte('k-version', 'zurueck', 'Letzte Version zurückspielen',
    h('p', {}, 'Wenn nach einer neuen Version etwas nicht stimmt: zurück auf die Version davor. Dauert etwa eine Minute. Daten, Inhalte und Anmeldungen bleiben erhalten.'),
    h('p', {}, h('strong', {}, 'Installiert: '), `Version ${v.installiert}`, v.vorher ? `, davor: ${v.vorher}` : ''),
    z.knoepfe.versionZurueck ? null : grund(v.vorher
      ? 'Nicht verfügbar: Der Betriebsdienst am Server meldet sich nicht (siehe Zustand).'
      : 'Nicht verfügbar: Keine frühere Version installiert, oder der Betriebsdienst am Server meldet sich nicht (siehe Zustand).'),
    h('div', { class: 'knopfreihe' }, knopf('Letzte Version zurückspielen …', () => versionZurueck(z), { disabled: !z.knoepfe.versionZurueck })));
}

async function versionZurueck(z) {
  const ja = await frage('Letzte Version zurückspielen?', `Die Spurensuche wechselt von Version ${z.version.installiert} auf ${z.version.vorher}. Sie ist dabei bis zu einer Minute nicht erreichbar. Daten, Inhalte und Anmeldungen bleiben erhalten.`, { ja: 'Zurückspielen' });
  if (!ja) return;
  let r;
  try { r = await api.versionZurueck(); } catch (e) { melde(e.message, { dauer: 10000 }); return; }
  await warteAufAuftrag(r);
}

// --- Verlauf und Protokoll ---------------------------------------------------------------------------------------

const FENSTER = 288; // 24 Stunden in Fünf-Minuten-Fenstern

function balken(punkte, klasse = '') {
  const breite = 288;
  const hoehe = 60;
  const max = Math.max(1, ...punkte.map((p) => p.wert));
  return s('svg', { viewBox: `0 0 ${breite} ${hoehe}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
    s('line', { x1: 0, y1: hoehe - 0.5, x2: breite, y2: hoehe - 0.5, class: 'achse', 'stroke-width': 1 }),
    punkte.filter((p) => p.wert > 0).map((p) => {
      const hb = Math.max(1, (p.wert / max) * (hoehe - 2));
      return s('rect', { x: p.index * (breite / FENSTER), y: (hoehe - hb).toFixed(1), width: Math.max(0.8, breite / FENSTER - 0.2).toFixed(2), height: hb.toFixed(1), fill: 'currentColor', class: klasse || null });
    }));
}

function verlauf(reihe) {
  if (!reihe?.length) return h('p', { class: 'leise' }, 'Noch keine Messwerte: Die Anwendung sammelt alle fünf Minuten einen Wert.');
  const beginn = Date.now() - 24 * 3600_000;
  const punkte = (feld) => reihe.map((r) => ({ index: Math.min(FENSTER - 1, Math.max(0, Math.floor((Date.parse(r.zeit) - beginn) / 300_000))), wert: Number(r[feld]) || 0, zeit: r.zeit }));
  const hoechst = (p) => p.reduce((a, b) => (b.wert > a.wert ? b : a), { wert: 0, zeit: null });
  const summe = (p) => p.reduce((a, b) => a + b.wert, 0);
  const anfragen = punkte('anfragen');
  const fehler = punkte('fehler');
  const antwort = punkte('p95').map((p) => ({ ...p, wert: p.wert >= 9999 ? 2500 : p.wert }));
  const gruppen = punkte('gruppen');
  const ha = hoechst(anfragen);
  const hf = fehler.filter((p) => p.wert > 0);
  const hr = hoechst(antwort);
  const hg = hoechst(gruppen);
  const figur = (titel, text, svg) => h('figure', {}, h('figcaption', {}, h('strong', {}, titel), text), svg);
  return h('div', { class: 'verlauf' },
    figur('Anfragen je 5 Minuten', `Zusammen ${zahl(summe(anfragen))}; am meisten ${zahl(ha.wert)}${ha.zeit ? ` um ${uhr(ha.zeit)} Uhr` : ''}.`, balken(anfragen)),
    figur('Fehler', hf.length ? `${zahl(summe(fehler))} Fehler, zuletzt um ${uhr(hf.at(-1).zeit)} Uhr.` : 'Keine Fehler.', balken(fehler, 'fehler')),
    figur('Antwortzeit (95 von 100 Antworten)', hr.wert ? `Höchstens ${zahl(hr.wert)} ms${hr.zeit ? ` um ${uhr(hr.zeit)} Uhr` : ''}.` : 'Keine Anfragen.', balken(antwort)),
    figur('Aktive Gruppen', hg.wert ? `Am meisten ${zahl(hg.wert)} gleichzeitig${hg.zeit ? ` um ${uhr(hg.zeit)} Uhr` : ''}.` : 'Keine aktiven Gruppen.', balken(gruppen)));
}

function protokoll(eintraege) {
  if (!eintraege.length) return h('p', { class: 'leise' }, 'Noch keine Einträge.');
  return h('div', { class: 'tabelle-rahmen', tabindex: '0', role: 'region', 'aria-label': 'Protokoll des Betriebs' }, h('table', {},
    h('thead', {}, h('tr', {}, ['Zeit', 'Was', 'Wer', 'Einzelheit'].map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, eintraege.slice(0, 25).map((p) => h('tr', {}, h('td', {}, datumZeit(p.zeit)), h('td', {}, AKTIONEN[p.aktion] ?? p.aktion), h('td', {}, p.rolle === 'system' ? 'Anwendung' : 'Betrieb'), h('td', {}, p.ziel ?? ''))))));
}

// --- Seite -------------------------------------------------------------------------------------------------------

async function zeige({ fokus = true } = {}) {
  let z;
  let sicherungen;
  let inhalt;
  let eintraege;
  try {
    [z, sicherungen, inhalt, eintraege] = await Promise.all([api.betriebZustand(), api.sicherungen(), api.inhaltStand(), api.betriebProtokoll()]);
  } catch (e) {
    if (e.status === 401) { anmeldung(); return; }
    kopfzeile(false);
    leere(haupt, h('h1', {}, 'Betrieb'),
      h('div', { class: 'ampel stoerung', role: 'alert' }, symbol('kreuz'), h('div', {}, h('h2', {}, 'Die Anwendung antwortet nicht'),
        h('p', {}, 'Bitte in einer Minute neu laden. Bleibt es so: im Handbuch den Abschnitt „Wenn die Betriebsseite nicht hilft“ befolgen.'))),
      h('p', {}, link('Betriebshandbuch öffnen', HANDBUCH, { art: 'leise', sym: 'buch', target: '_blank', rel: 'noopener' })));
    return;
  }
  kopfzeile(true);
  leere(haupt,
    h('h1', {}, 'Betrieb'),
    vorfuehrHinweis(),
    ampel(z),
    zuTun(z),
    h('section', { 'aria-labelledby': 'b-knoepfe' }, h('h2', { id: 'b-knoepfe' }, 'Was Sie tun können'),
      h('div', { class: 'knopfkarten' }, karteNeustart(z), karteSicherung(sicherungen), karteInhalt(inhalt), karteVersion(z))),
    h('section', { 'aria-labelledby': 'b-zustand' }, h('h2', { id: 'b-zustand' }, 'Zustand im Einzelnen'),
      h('div', { class: 'knopfreihe' }, knopf('Jetzt neu prüfen', aktualisiereZustand, { art: 'leise', sym: 'aktualisieren' })),
      h('ul', { class: 'punkte', id: 'b-punkte' }, z.punkte.map(punktZeile))),
    h('section', { 'aria-labelledby': 'b-verlauf' }, h('h2', { id: 'b-verlauf' }, 'Verlauf der letzten 24 Stunden'), verlauf(z.verlauf)),
    h('section', { 'aria-labelledby': 'b-protokoll' }, h('h2', { id: 'b-protokoll' }, 'Protokoll'), protokoll(eintraege)),
    h('section', { class: 'karte', 'aria-labelledby': 'b-hilfe' }, h('h2', { id: 'b-hilfe' }, 'Hilfe'),
      h('p', {}, 'Jeder Knopf Schritt für Schritt, typische Anrufe und was im Notfall zu tun ist: ', h('a', { href: HANDBUCH, target: '_blank', rel: 'noopener' }, 'Betriebshandbuch'), '.'),
      z.kontakt ? h('p', {}, h('strong', {}, 'Wenn nichts hilft: '), z.kontakt) : null));
  if (fokus) seitenwechsel('Betrieb – Spurensuche', haupt);
  clearInterval(zeitgeber);
  zeitgeber = setInterval(() => { if (!document.hidden && !document.querySelector('dialog[open]')) aktualisiereZustand(); }, 60_000);
}

let ich = null;
try { ich = await api.ichBetrieb(); } catch { /* keine Verbindung */ }
if (ich?.rolle === 'betrieb') zeige(); else anmeldung();
