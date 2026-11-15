// Prüflauf im echten Browser (Chrome ohne Oberfläche, über CDP) gegen die Instanz mit Testinhalten:
// Familie spielt, Lehrkraft meldet sich über die Attrappe an und legt Lerngruppe, Quest und Gruppe an, eine
// Schulgruppe tritt bei, spielt, geht offline, spielt weiter und überträgt danach ohne Doppelzählung; die Lehrkraft
// sieht Übersicht und Auswertung. axe-core auf jeder Ansicht, auch Telefon und dunkel. Alle Personen sind simuliert.

import { seite, neuerKontext, js, klick, klickWahl, tippe, warteText, springe, foto, schritt, axe, sammleProtokoll, abschluss, pause } from './werkzeug.js';
import { offline, offlineBereit } from './offline.js';

const APP = process.env.APP_URL ?? 'http://localhost:8080';
const messung = {};

const familie = await seite();
await schritt('Startseite', async () => { await familie.gehe(`${APP}/`); await warteText(familie, 'Wie spielt ihr?'); await foto(familie, '01-start'); await axe(familie, 'start'); });
await schritt('Familie: Teamname', async () => { await klick(familie, 'Als Familie oder Gruppe'); await tippe(familie, '#teamname', 'Die Spurenfinder'); await foto(familie, '02-familie'); await axe(familie, 'familie'); await klick(familie, 'Los geht'); await warteText(familie, 'Alle Orte'); await foto(familie, '03-karte'); await axe(familie, 'karte'); });
await schritt('Familie: Ort im Klassenzimmer', async () => { await klick(familie, 'Testort Nord', 'button.ortskarte'); await warteText(familie, 'Seid ihr vor Ort?'); await foto(familie, '04-ort'); await axe(familie, 'ort-pruefung'); await klick(familie, 'Im Klassenzimmer spielen'); await warteText(familie, 'Aufgaben (2'); await foto(familie, '05-ort-aufgaben'); await axe(familie, 'ort-aufgaben'); });
await schritt('Familie: Aufgabe spielen', async () => {
  await klick(familie, 'Los geht');
  await warteText(familie, 'Welche Farbe');
  await foto(familie, '06-aufgabe');
  await axe(familie, 'aufgabe');
  await klick(familie, 'Hinweis');
  await klick(familie, 'Rot', 'button[data-antwort]');
  await warteText(familie, 'Noch nicht');
  await klick(familie, 'Grün', 'button[data-antwort]');
  await klick(familie, 'Weiter', 'button');
  await warteText(familie, 'Neu im Sammelbuch');
  await foto(familie, '07-aufgabe-geschafft');
  await axe(familie, 'aufgabe-geschafft');
});
await schritt('Familie: Sammelbuch, Datenschutz, Info, Bild', async () => {
  await springe(familie, '#/sammlung'); await warteText(familie, 'Sammelbuch'); await foto(familie, '08-sammelbuch'); await axe(familie, 'sammelbuch');
  await springe(familie, '#/datenschutz'); await warteText(familie, 'Kamera und Standort'); await axe(familie, 'datenschutz');
  await springe(familie, '#/info'); await warteText(familie, 'Lizenzen'); await axe(familie, 'info');
  await springe(familie, '#/bild'); await warteText(familie, 'Euer Bild'); await axe(familie, 'bild-gesperrt');
});
await schritt('Einstellungen', async () => { await klickWahl(familie, 'button[aria-label^="Einstellungen"]'); await warteText(familie, 'Einfache Sprache'); await foto(familie, '09-einstellungen'); await axe(familie, 'einstellungen'); await js(familie, 'document.querySelector("dialog")?.close(); true'); });
await schritt('Einfache Sprache und hoher Kontrast', async () => {
  await js(familie, `import('./app/js/einstellungen.js').then((m) => m.aendere({ sprache: 'einfach', kontrast: 'hoch' })).then(() => true)`);
  await springe(familie, '#/sammlung'); await warteText(familie, 'Sammelbuch');
  await springe(familie, '#/karte'); await warteText(familie, 'Tippt auf einen Ort'); await foto(familie, '10-einfach-kontrast'); await axe(familie, 'karte-einfach-kontrast');
  await js(familie, `import('./app/js/einstellungen.js').then((m) => m.aendere({ sprache: 'standard', kontrast: 'normal' })).then(() => true)`);
});

const lehrkraft = await seite({ kontext: await neuerKontext() });
let code = null;
await schritt('Lehrkraft: Anmeldung über Attrappe', async () => {
  await lehrkraft.gehe(`${APP}/lehrkraefte.html`);
  await warteText(lehrkraft, 'Mit Schulkonto');
  await foto(lehrkraft, '11-lk-anmeldung');
  await axe(lehrkraft, 'lk-anmeldung');
  await klick(lehrkraft, 'Mit Schulkonto anmelden', 'a');
  await warteText(lehrkraft, 'Lehrkraft A');
  await foto(lehrkraft, '12-attrappe');
  await klick(lehrkraft, 'Lehrkraft A', 'button');
  await warteText(lehrkraft, 'Ihre Lerngruppen');
  await axe(lehrkraft, 'lk-uebersicht-leer');
});
await schritt('Lehrkraft: Lerngruppe, Quest, Gruppen', async () => {
  await klick(lehrkraft, 'Neue Lerngruppe');
  await tippe(lehrkraft, '#lg-name', 'Klasse 6a');
  await js(lehrkraft, `(() => { const s = document.querySelector('#lg-stufe'); s.value = '6'; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('#lg-einw').checked = true; return true; })()`);
  await foto(lehrkraft, '13-lk-lerngruppe-dialog');
  await axe(lehrkraft, 'lk-lerngruppe-dialog');
  await klick(lehrkraft, 'Anlegen', 'button');
  await warteText(lehrkraft, 'Klasse 6a');
  await axe(lehrkraft, 'lk-uebersicht');
  await klick(lehrkraft, 'Klasse 6a', 'a');
  await warteText(lehrkraft, 'Quest freigeben');
  await axe(lehrkraft, 'lk-lerngruppe');
  await klick(lehrkraft, 'Quest freigeben', 'a');
  await warteText(lehrkraft, 'Zeitrahmen');
  await klick(lehrkraft, 'Projekttag', 'button');
  await foto(lehrkraft, '14-lk-freigeben');
  await axe(lehrkraft, 'lk-freigeben');
  await klick(lehrkraft, 'Freigeben', 'button[type="submit"]');
  await warteText(lehrkraft, 'Gruppe hinzufügen');
  await klick(lehrkraft, 'Biber', 'button');
  await warteText(lehrkraft, 'Code:');
  code = await js(lehrkraft, `document.querySelector('.code-gross')?.textContent`);
  await klick(lehrkraft, 'Falke', 'button');
  await warteText(lehrkraft, 'Gruppen (2)');
  await foto(lehrkraft, '15-lk-gruppen');
  await axe(lehrkraft, 'lk-gruppen');
});

const schule = await seite({ breite: 820, hoehe: 1180, mobil: true, kontext: await neuerKontext() });
await schritt('Schulgruppe: Beitritt und Spiel vor Ort', async () => {
  await schule.gehe(`${APP}/#/beitritt?code=${code}`);
  await warteText(schule, 'Code der Gruppe');
  await axe(schule, 'tablet-beitritt');
  await klick(schule, 'Beitreten', 'button');
  await warteText(schule, 'Ihr seid Gruppe Biber');
  await foto(schule, '16-schule-beitritt');
  await klick(schule, 'Zur Karte', 'a');
  await warteText(schule, 'Alle Orte');
  await foto(schule, '17-schule-karte');
  await axe(schule, 'tablet-karte');
  await springe(schule, '#/ort/testort-nord?code=NORD-1234');
  await warteText(schule, 'vor Ort, QR-Code gescannt');
  await klick(schule, 'Los geht');
  await warteText(schule, 'Welche Farbe');
  await axe(schule, 'tablet-aufgabe');
  await klick(schule, 'Grün', 'button[data-antwort]');
  await klick(schule, 'Weiter', 'button');
  await warteText(schule, 'Nächste Aufgabe');
  await klick(schule, 'Nächste Aufgabe', 'a');
  await warteText(schule, 'zuerst schützen');
  await klick(schule, 'Den Wald', 'button[data-antwort]');
  await klick(schule, 'Alle sind einverstanden', 'button');
  await klick(schule, 'Weiter', 'button');
  await warteText(schule, 'geschafft');
  await foto(schule, '18-schule-ort-geschafft');
  await springe(schule, '#/karte');
  await warteText(schule, 'Alles übertragen', 20000);
});

await schritt('Schulgruppe: offline weiterspielen, danach übertragen', async () => {
  messung.offlinePaket = await offlineBereit(schule);
  await offline(schule, true);
  await pause(500);
  await schule.sende('Page.reload', { ignoreCache: false });
  await warteText(schule, 'Alle Orte', 15000);
  messung.offlineGeladen = true;
  await springe(schule, '#/ort/testort-sued');
  await klick(schule, 'Im Klassenzimmer spielen');
  await klick(schule, 'Los geht');
  await warteText(schule, 'Wie viele Testorte');
  await klick(schule, 'Einen', 'button[data-antwort]');
  await klick(schule, 'Zwei', 'button[data-antwort]');
  await klick(schule, 'Weiter', 'button');
  await warteText(schule, 'geschafft');
  await springe(schule, '#/karte');
  await warteText(schule, 'Offline', 10000);
  await foto(schule, '19-schule-offline');
  messung.ausgangOffline = await js(schule, `document.getElementById('netz')?.textContent ?? ''`);
  await offline(schule, false);
  await warteText(schule, 'Alles übertragen', 40000);
  messung.nachOnline = await js(schule, `document.getElementById('netz')?.textContent ?? ''`);
});

await schritt('Lehrkraft: Übersicht, Auswertung, Einwilligungsbrief', async () => {
  await klick(lehrkraft, 'Laufende Übersicht', 'a');
  await warteText(lehrkraft, 'Zuletzt übertragen');
  await js(lehrkraft, '(location.reload(), true)');
  await warteText(lehrkraft, 'Zuletzt übertragen');
  const zeile = await js(lehrkraft, `[...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('Biber'))?.innerText ?? ''`);
  messung.uebersichtBiber = zeile.replace(/\s+/g, ' ');
  if ((zeile.match(/Fertig/g) ?? []).length < 2) throw new Error(`Übersicht zeigt nicht beide Stationen fertig: ${messung.uebersichtBiber}`);
  await foto(lehrkraft, '20-lk-uebersicht');
  await axe(lehrkraft, 'lk-laufend');
  await klick(lehrkraft, 'Auswertung', 'a');
  await warteText(lehrkraft, 'Kompetenzraster');
  messung.auswertungSaetze = await js(lehrkraft, `[...document.querySelectorAll('.beobachtungen li')].map((l) => l.textContent)`);
  if (!messung.auswertungSaetze.some((t) => t.startsWith('3 Aufgaben gelöst'))) throw new Error(`Erwartet 3 gelöste Aufgaben ohne Doppelzählung: ${messung.auswertungSaetze.join(' | ')}`);
  await foto(lehrkraft, '21-lk-auswertung');
  await axe(lehrkraft, 'lk-auswertung');
  await klick(lehrkraft, 'Ihre Einschätzung', 'label.raster-wahl');
  await warteText(lehrkraft, 'gewählt');
  await klick(lehrkraft, 'Bildbeiträge', 'a');
  await warteText(lehrkraft, 'Noch keine Bildbeiträge');
  await axe(lehrkraft, 'lk-bilder');
  await springe(lehrkraft, '#/einwilligung');
  await warteText(lehrkraft, 'Einwilligung der Erziehungsberechtigten');
  await foto(lehrkraft, '22-lk-einwilligung');
  await axe(lehrkraft, 'lk-einwilligung');
});

// Dunkle Darstellung und Telefonbreite für die wichtigsten Ansichten
const dunkel = await seite({ breite: 390, hoehe: 844, mobil: true, dunkel: true, kontext: await neuerKontext() });
await schritt('Telefon, dunkel', async () => {
  await dunkel.gehe(`${APP}/`);
  await warteText(dunkel, 'Wie spielt ihr?');
  await foto(dunkel, '23-telefon-dunkel-start');
  await axe(dunkel, 'telefon-dunkel-start');
  await klick(dunkel, 'Als Familie oder Gruppe');
  await tippe(dunkel, '#teamname', 'Nachtfalter');
  await klick(dunkel, 'Los geht');
  await warteText(dunkel, 'Alle Orte');
  await foto(dunkel, '24-telefon-dunkel-karte');
  await axe(dunkel, 'telefon-dunkel-karte');
  await springe(dunkel, '#/ort/testort-nord');
  await warteText(dunkel, 'Seid ihr vor Ort?');
  await axe(dunkel, 'telefon-dunkel-ort');
  await dunkel.gehe(`${APP}/lehrkraefte.html`);
  await warteText(dunkel, 'Anmelden');
  await axe(dunkel, 'telefon-dunkel-lk-anmeldung');
});

for (const [name, s] of [['familie', familie], ['lehrkraft', lehrkraft], ['schule', schule], ['dunkel', dunkel]]) sammleProtokoll(name, s, [/ERR_INTERNET_DISCONNECTED/, /Failed to fetch/]);
abschluss('rauchtest.json', { messung });
