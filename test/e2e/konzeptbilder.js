// Bilder für Präsentation und Angebot: iPad hochkant (820 × 1180 CSS-Pixel, doppelte Auflösung = 1640 × 2360 px),
// aufgenommen in der Vorführung mit den echten Inhalten. Der Spielstand auf der Karte ist simuliert (eingesetzt per
// Skript), ebenso die Gruppen der Beispielklasse. Ergebnis: AUSGABE/konzept/*.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { Cdp } from './cdp.js';
import { js, klick, warteText, springe, pause, schritt, abschluss, AUSGABE } from './werkzeug.js';

const VORF = process.env.VORF_URL ?? 'http://localhost:8090/spurensuche';
mkdirSync(`${AUSGABE}/konzept`, { recursive: true });
const kontext = await Cdp.neuerKontext();
const s = await Cdp.neueSeite('http://127.0.0.1:9222', kontext);
await s.sende('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true });
await s.sende('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

async function bild(name) {
  await js(s, `(document.getElementById('meldung')?.setAttribute('hidden', ''), window.scrollTo(0, 0), true)`);
  await js(s, `Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))).then(() => true)`).catch(() => {});
  await pause(500);
  const { data } = await s.sende('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`${AUSGABE}/konzept/${name}.png`, Buffer.from(data, 'base64'));
}

await schritt('Karte mit Fortschritt (simuliert)', async () => {
  await s.gehe(`${VORF}/index.html#/beitritt?code=DEMO-2026`);
  await warteText(s, 'Code der Gruppe');
  await klick(s, 'Beitreten', 'button');
  await warteText(s, 'Ihr seid Gruppe Eule');
  // simulierter Spielstand: eine Station geschafft, eine begonnen, Sammelstücke der geschafften Station
  await js(s, `(async () => {
    const sp = await import('./app/js/speicher.js');
    const t = await sp.lies('team');
    const inhalte = await (await import('./app/js/inhalte.js')).ladeInhalte();
    const jetzt = new Date().toISOString();
    const erster = inhalte.orte[0];
    const zweiter = inhalte.orte[2];
    t.stationen[erster.id] = { status: 'abgeschlossen', verifikation: 'qr', begonnen: jetzt, beendet: jetzt, aktivSekunden: 1200 };
    t.stationen[zweiter.id] = { status: 'begonnen', verifikation: 'ersatz', begonnen: jetzt, beendet: null, aktivSekunden: 300 };
    for (const nr of erster.aufgaben) {
      const a = await (await import('./app/js/inhalte.js')).aufgabe(erster.id + '/' + nr);
      t.laeufe[a.kennung] = { id: crypto.randomUUID(), aufgabe: a.kennung, geloest: true, versuche: 1, dauerSekunden: 360, items: a.belohnung, beendet: jetzt };
      for (const i of a.belohnung) if (!t.items.includes(i)) t.items.push(i);
    }
    const a1 = await (await import('./app/js/inhalte.js')).aufgabe(zweiter.id + '/' + zweiter.aufgaben[0]);
    t.laeufe[a1.kennung] = { id: crypto.randomUUID(), aufgabe: a1.kennung, geloest: true, versuche: 2, dauerSekunden: 420, items: a1.belohnung, beendet: jetzt };
    for (const i of a1.belohnung) if (!t.items.includes(i)) t.items.push(i);
    await sp.schreibe('team', t);
    return true;
  })()`);
  await s.sende('Page.reload', {});
  await warteText(s, 'Alle Orte');
  await bild('1-karte');
});

await schritt('Spiel mit einfacher Sprache und Vorlesen', async () => {
  await js(s, `import('./app/js/einstellungen.js').then((m) => m.aendere({ sprache: 'einfach' })).then(() => true)`);
  const ziel = await js(s, `import('./app/js/inhalte.js').then((m) => m.ladeInhalte()).then((i) => i.finale + '/' + i.ortNach.get(i.finale).aufgaben[1])`);
  await springe(s, `#/ort/${ziel.split('/')[0]}`);
  await warteText(s, ziel.split('/')[0] === 'frauenkirche' ? 'Frauenkirche' : 'Aufgaben');
  if (await js(s, `document.body.innerText.includes('Im Klassenzimmer spielen')`)) await klick(s, 'Im Klassenzimmer spielen');
  await springe(s, `#/aufgabe/${ziel}`);
  await s.warte(`document.querySelector('.spiel-wurzel')?.children.length > 0`, 15000);
  await pause(1200);
  // so sieht es während des Vorlesens aus: der gerade gelesene Text ist gerahmt (Klasse der App, hier gesetzt)
  await js(s, `(() => { const e = document.querySelector('.spiel-wurzel [data-vorlesen]'); e?.classList.add('wird-gelesen'); return !!e; })()`);
  await bild('2-spiel-einfach-vorlesen');
  await js(s, `import('./app/js/einstellungen.js').then((m) => m.aendere({ sprache: 'standard' })).then(() => true)`);
});

await schritt('Collage mit Reglern', async () => {
  const da = await js(s, `fetch('spiele/collage/index.js').then((r) => r.ok).catch(() => false)`);
  if (!da) throw new Error('Collage-Modul fehlt noch (spiele/collage/index.js)');
  // Abschlussaufgabe als geschafft eintragen (simuliert), damit das Bild sich öffnet
  await js(s, `(async () => {
    const sp = await import('./app/js/speicher.js');
    const m = await import('./app/js/inhalte.js');
    const i = await m.ladeInhalte();
    const t = await sp.lies('team');
    const f = i.ortNach.get(i.finale);
    t.stationen[f.id] = { status: 'abgeschlossen', verifikation: 'qr', begonnen: new Date().toISOString(), beendet: new Date().toISOString(), aktivSekunden: 900 };
    for (const nr of f.aufgaben) { const a = await m.aufgabe(f.id + '/' + nr); t.laeufe[a.kennung] = { id: crypto.randomUUID(), aufgabe: a.kennung, geloest: true, versuche: 1, dauerSekunden: 300, items: a.belohnung, beendet: new Date().toISOString() }; for (const x of a.belohnung) if (!t.items.includes(x)) t.items.push(x); }
    t.bild = null;
    await sp.schreibe('team', t);
    return true;
  })()`);
  await s.sende('Page.reload', {});
  await warteText(s, 'Alle Orte');
  await springe(s, '#/bild');
  await warteText(s, 'Euer Bild für die Ausstellung', 15000);
  await s.warte(`document.querySelector('.vorschau-rahmen img')`, 20000);
  await bild('3-collage-regler');
});

const lk = await Cdp.neueSeite('http://127.0.0.1:9222', kontext);
await lk.sende('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true });
await schritt('Kompetenzraster der Lehrkraft', async () => {
  await lk.gehe(`${VORF}/lehrkraefte.html`);
  await warteText(lk, 'Vorführung ansehen');
  await klick(lk, 'Vorführung ansehen', 'button');
  await warteText(lk, 'Klasse 6a (Beispiel)');
  await lk.werte(`(location.hash = '#/quest/quest-beispiel/auswertung/g-biber', true)`);
  await warteText(lk, 'Kompetenzraster');
  await lk.werte(`(document.querySelector('.raster').scrollIntoView({ block: 'start' }), window.scrollBy(0, -90), true)`);
  await pause(600);
  const { data } = await lk.sende('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`${AUSGABE}/konzept/4-kompetenzraster.png`, Buffer.from(data, 'base64'));
});

abschluss('konzeptbilder.json');
