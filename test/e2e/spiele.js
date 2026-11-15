// Alle Aufgaben der echten Inhalte einzeln in der Werkstatt: Spiel lädt, axe-core auf dem Startbildschirm (Standard
// und einfache Sprache mit hohem Kontrast), Abbruch über `signal` liefert binnen einer Sekunde ein Ergebnis, das zum
// Vertrag passt. Kein Spiel wird hier gelöst; das prüft jedes Format in seinen eigenen Tests.
import { seite, js, warteText, foto, schritt, axe, sammleProtokoll, abschluss, pause, fehler } from './werkzeug.js';

const APP = process.env.APP_URL ?? 'http://localhost:8080';
const s = await seite({ breite: 820, hoehe: 1180, mobil: true });
await s.gehe(`${APP}/werkstatt.html`);
await s.warte(`document.querySelectorAll('#w-aufgabe option').length > 0`, 15000);
const aufgaben = await js(s, `[...document.querySelectorAll('#w-aufgabe option')].map((o) => o.value)`);
const messung = { aufgaben: aufgaben.length, ergebnisse: {} };
const formateGesehen = new Set();

for (const kennung of aufgaben) {
  await schritt(`Spiel ${kennung}`, async () => {
    await s.gehe(`${APP}/werkstatt.html?aufgabe=${encodeURIComponent(kennung)}`);
    await s.warte(`document.querySelector('.spiel-wurzel')?.children.length > 0`, 15000);
    await pause(900);
    const format = await js(s, `fetch('inhalte/${kennung}.json').then((r) => r.json()).then((a) => a.format)`);
    await foto(s, `spiel-${kennung.replace('/', '-')}`);
    await axe(s, `spiel-${kennung}`);
    if (!formateGesehen.has(format)) {
      formateGesehen.add(format);
      await js(s, `(() => { document.querySelector('#w-sprache').value = 'einfach'; document.querySelector('#w-kontrast').checked = true; return true; })()`);
      await js(s, `([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Starten').click(), true)`);
      await s.warte(`document.querySelector('.spiel-wurzel')?.children.length > 0`, 15000);
      await pause(900);
      await axe(s, `spiel-${kennung}-einfach-kontrast`);
    }
    const t = Date.now();
    await js(s, `([...document.querySelectorAll('button')].find((b) => b.textContent.includes('Abbrechen (signal)')).click(), true)`);
    await s.warte(`document.body.innerText.includes('passt zum Vertrag') || document.body.innerText.includes('Abweichungen vom Vertrag') || document.body.innerText.includes('Modul nicht ladbar')`, 5000);
    const ms = Date.now() - t;
    const passt = await js(s, `document.body.innerText.includes('Ergebnis passt zum Vertrag')`);
    const abweichungen = await js(s, `[...document.querySelectorAll('.hinweisfeld.fehler li')].map((l) => l.textContent)`);
    messung.ergebnisse[kennung] = { format, abbruchMs: ms, vertrag: passt, abweichungen };
    if (!passt) throw new Error(`Vertrag nicht eingehalten: ${abweichungen.join('; ')}`);
    if (ms > 1500) throw new Error(`Abbruch dauerte ${ms} ms`);
  });
}
messung.formate = [...formateGesehen];
sammleProtokoll('werkstatt', s);
if (!aufgaben.length) fehler.push('keine Aufgaben gefunden');
abschluss('spiele.json', { messung });
