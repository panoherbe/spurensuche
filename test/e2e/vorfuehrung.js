// Prüflauf der Vorführung (statische Seite ohne Server, unter einem Unterpfad): Lehrkräfte-Ansicht mit
// Beispielklasse, Schulgruppe mit dem Code DEMO-2026 spielt die echten Inhalte, die Lehrkraft sieht es live,
// alles läuft auch offline. axe-core auf jeder Ansicht. Alle Personen sind simuliert.

import { seite, neuerKontext, js, klick, tippe, warteText, springe, foto, schritt, axe, sammleProtokoll, abschluss, pause } from './werkzeug.js';
import { offline, offlineBereit } from './offline.js';

const VORF = process.env.VORF_URL ?? 'http://localhost:8090/spurensuche';
const messung = {};
const kontext = await neuerKontext(); // ein Browser für beide Ansichten, wie bei einem Besuch der Vorführung
const lk = await seite({ kontext });

await schritt('Vorführung: Lehrkräfte-Ansicht mit Beispielklasse', async () => {
  await lk.gehe(`${VORF}/lehrkraefte.html`);
  await warteText(lk, 'Vorführung ansehen');
  await axe(lk, 'v-lk-anmeldung');
  await klick(lk, 'Vorführung ansehen', 'button');
  await warteText(lk, 'Klasse 6a (Beispiel)');
  await foto(lk, 'v01-lk-uebersicht');
  await axe(lk, 'v-lk-uebersicht');
  await klick(lk, 'Projekttag: Spurensuche Sachsen', 'a');
  await warteText(lk, 'Zuletzt übertragen');
  await foto(lk, 'v02-lk-laufend');
  await axe(lk, 'v-lk-laufend');
  await klick(lk, 'Auswertung', 'a');
  await warteText(lk, 'Kompetenzraster');
  messung.vorschlaegeBiber = await js(lk, `[...document.querySelectorAll('.raster tbody tr')].map((tr) => tr.querySelector('th').textContent + ': ' + ([...tr.querySelectorAll('.raster-zelle')].find((z) => z.querySelector('.marke:not(.gut)'))?.querySelector('strong')?.textContent ?? '–'))`);
  await foto(lk, 'v03-lk-auswertung');
  await axe(lk, 'v-lk-auswertung');
});

const spiel = await seite({ breite: 820, hoehe: 1180, mobil: true, kontext });
await schritt('Vorführung: Schulgruppe mit DEMO-2026', async () => {
  await spiel.gehe(`${VORF}/index.html`);
  await warteText(spiel, 'Wie spielt ihr?');
  await foto(spiel, 'v04-start');
  await axe(spiel, 'v-start');
  await klick(spiel, 'Mit der Klasse');
  await warteText(spiel, 'Code der Gruppe');
  await klick(spiel, 'Beitreten', 'button');
  await warteText(spiel, 'Ihr seid Gruppe Eule');
  await klick(spiel, 'Zur Karte', 'a');
  await warteText(spiel, 'Alle Orte');
  await foto(spiel, 'v05-karte');
  await axe(spiel, 'v-karte');
  messung.orte = await js(spiel, `document.querySelectorAll('.ortskarte').length`);
  await js(spiel, `(document.querySelector('.ortskarte').click(), true)`);
  await warteText(spiel, 'Seid ihr vor Ort?');
  await foto(spiel, 'v06-ort');
  await axe(spiel, 'v-ort');
  await klick(spiel, 'Im Klassenzimmer spielen');
  await warteText(spiel, 'Aufgaben (');
  await klick(spiel, 'Los geht');
  await spiel.warte(`document.querySelector('.spiel-wurzel')?.children.length > 0`, 15000);
  await pause(800);
  await foto(spiel, 'v07-spiel-start');
  await axe(spiel, 'v-spiel-start');
  messung.spielText = (await js(spiel, `document.querySelector('.spiel-wurzel')?.innerText.slice(0, 200)`)).replace(/\s+/g, ' ');
});

await schritt('Vorführung: offline laden', async () => {
  messung.offlinePaket = await offlineBereit(spiel);
  await offline(spiel, true);
  await spiel.sende('Page.reload', {});
  await warteText(spiel, 'Aufgabe 1 von', 15000); // dieselbe Aufgabe wie vor dem Neuladen, jetzt ohne Netz
  await foto(spiel, 'v08-offline-aufgabe');
  await springe(spiel, '#/karte');
  await warteText(spiel, 'Alle Orte', 15000);
  await springe(spiel, '#/sammlung');
  await warteText(spiel, 'Sammelbuch');
  await foto(spiel, 'v09-offline-sammelbuch');
  messung.offlineGeladen = true;
  await offline(spiel, false);
});

await schritt('Vorführung: Lehrkraft sieht die Gruppe Eule', async () => {
  await springe(lk, '#/quest/quest-beispiel/gruppen');
  await warteText(lk, 'Gruppe hinzufügen');
  await springe(lk, '#/quest/quest-beispiel/uebersicht');
  await warteText(lk, 'Eule');
  messung.zeileEule = (await js(lk, `[...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('Eule'))?.innerText ?? ''`)).replace(/\s+/g, ' ');
  await foto(lk, 'v10-lk-eule');
});

await schritt('Vorführung: Lehrkraft gibt eine Quest nach Zeitrahmen frei (Vorschlag aus ablaeufe.json)', async () => {
  await springe(lk, '#/lerngruppe/lg-beispiel/freigeben');
  await warteText(lk, 'Zeitrahmen wählen');
  messung.zeitrahmen = await js(lk, `[...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /Min\\.\\)$/.test(t))`);
  await klick(lk, 'Unterrichtsstunde', 'button');
  await lk.warte(`/\\d+ Aufgaben/.test(document.querySelector('p.marke[role=status]')?.textContent ?? '')`);
  messung.vorschlagStunde = await js(lk, `document.querySelector('p.marke[role=status]').textContent + ' · ' + document.getElementById('q-titel').value`);
  await foto(lk, 'v12-lk-freigabe-zeitrahmen');
  await axe(lk, 'v-lk-freigabe-zeitrahmen');
});

await schritt('Vorführung: Figur gestalten und speichern', async () => {
  await springe(spiel, '#/figur');
  await warteText(spiel, 'Gestaltet eure', 15000);
  await axe(spiel, 'v-figur-baukasten');
  await foto(spiel, 'v13-figur');
  await klick(spiel, 'Fertig', 'button');
  await warteText(spiel, 'Figur gespeichert');
  messung.figurText = await js(spiel, `document.querySelector('.figur-gross')?.getAttribute('aria-label') ?? ''`);
  if (!messung.figurText) throw new Error('gespeicherte Figur ohne Beschreibung');
  await axe(spiel, 'v-figur-gespeichert');
});

await schritt('Vorführung: Bild für die Ausstellung mit Reglern (Abschlussaufgabe simuliert)', async () => {
  await js(spiel, `(async () => {
    const sp = await import('./app/js/speicher.js');
    const m = await import('./app/js/inhalte.js');
    const i = await m.ladeInhalte();
    const t = await sp.lies('team');
    const f = i.ortNach.get(i.finale);
    t.stationen[f.id] = { status: 'abgeschlossen', verifikation: 'ersatz', begonnen: new Date().toISOString(), beendet: new Date().toISOString(), aktivSekunden: 900 };
    for (const nr of f.aufgaben) { const a = await m.aufgabe(f.id + '/' + nr); t.laeufe[a.kennung] = { id: crypto.randomUUID(), aufgabe: a.kennung, geloest: true, versuche: 1, dauerSekunden: 300, items: a.belohnung, beendet: new Date().toISOString() }; for (const x of a.belohnung) if (!t.items.includes(x)) t.items.push(x); }
    t.bild = null;
    await sp.schreibe('team', t);
    return true;
  })()`);
  await springe(spiel, '#/karte'); // neu laden auf der Karte, damit die App den eingetragenen Stand liest
  await warteText(spiel, 'Alle Orte', 15000);
  await spiel.sende('Page.reload', {});
  await warteText(spiel, 'Alle Orte', 15000);
  await springe(spiel, '#/bild');
  await warteText(spiel, 'Euer Bild für die Ausstellung', 15000);
  await spiel.warte(`document.querySelector('.vorschau-rahmen img')`, 20000);
  messung.collageRegler = await js(spiel, `[...document.querySelectorAll('fieldset legend')].map((l) => l.textContent)`);
  await js(spiel, `(() => { const r = [...document.querySelectorAll('input[type=radio][name^=regler-]')].find((x) => !x.checked); r?.click(); return !!r; })()`);
  await pause(800);
  await foto(spiel, 'v14-bild-regler');
  await axe(spiel, 'v-bild-regler');
});

const dunkel = await seite({ breite: 390, hoehe: 844, mobil: true, dunkel: true, kontext: await neuerKontext() });
await schritt('Vorführung: Telefon dunkel', async () => {
  await dunkel.gehe(`${VORF}/index.html`);
  await warteText(dunkel, 'Wie spielt ihr?');
  await axe(dunkel, 'v-telefon-dunkel-start');
  await klick(dunkel, 'Als Familie oder Gruppe');
  await tippe(dunkel, '#teamname', 'Elbpiraten');
  await klick(dunkel, 'Los geht');
  await warteText(dunkel, 'Alle Orte');
  await foto(dunkel, 'v11-telefon-dunkel-karte');
  await axe(dunkel, 'v-telefon-dunkel-karte');
});

for (const [name, s] of [['lk', lk], ['spiel', spiel], ['dunkel', dunkel]]) sammleProtokoll(name, s, [/ERR_INTERNET_DISCONNECTED/, /Failed to fetch/]);
abschluss('vorfuehrung.json', { messung });
