// Gemeinsame Helfer der Browser-Prüfungen: Seiten öffnen, klicken, tippen, warten, Bildschirmfotos, axe-core.

import { mkdirSync, writeFileSync } from 'node:fs';
import { Cdp } from './cdp.js';

export const AUSGABE = process.env.AUSGABE ?? 'nachweis/tmp';
mkdirSync(`${AUSGABE}/bilder`, { recursive: true });
export const fehler = [];
export const schritte = [];
export const barrierefreiheit = {};
const AXE_URL = 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js';
let axeQuelle = null;

export async function seite({ breite = 1280, hoehe = 900, mobil = false, dunkel = false, kontext } = {}) {
  const s = await Cdp.neueSeite('http://127.0.0.1:9222', kontext);
  await s.sende('Emulation.setDeviceMetricsOverride', { width: breite, height: hoehe, deviceScaleFactor: 1, mobile: mobil });
  if (mobil) await s.sende('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (dunkel) await s.sende('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await s.sende('Network.enable');
  return s;
}
export const neuerKontext = () => Cdp.neuerKontext();
export const js = (s, ausdruck) => s.werte(ausdruck);

export async function klick(s, text, wahl = 'button, a, label, summary') {
  const finde = `[...document.querySelectorAll(${JSON.stringify(wahl)})].find((e) => e.getClientRects().length && e.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)}))`;
  await s.warte(finde);
  await js(s, `(() => { const e = ${finde}; e.scrollIntoView({ block: 'center' }); e.click(); return true; })()`);
}
export async function klickWahl(s, wahl) {
  await s.warte(`document.querySelector(${JSON.stringify(wahl)})`);
  await js(s, `(document.querySelector(${JSON.stringify(wahl)}).click(), true)`);
}
export async function tippe(s, wahl, wert) {
  await s.warte(`document.querySelector(${JSON.stringify(wahl)})`);
  await js(s, `(() => { const e = document.querySelector(${JSON.stringify(wahl)}); e.focus(); e.value = ${JSON.stringify(wert)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
}
export const warteText = (s, text, zeit = 10000) => s.warte(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`, zeit);
export const springe = (s, ziel) => js(s, `(location.hash = ${JSON.stringify(ziel)}, true)`);
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export async function foto(s, name, { ganz = true } = {}) {
  await js(s, `(document.getElementById('meldung')?.setAttribute('hidden', ''), true)`).catch(() => {});
  await pause(350);
  writeFileSync(`${AUSGABE}/bilder/${name}.png`, await s.bild({ ganz }));
  schritte.push(name);
}

export async function schritt(name, fn) {
  const t = Date.now();
  try { await fn(); console.log(`✓ ${name} (${Date.now() - t} ms)`); } catch (e) { fehler.push(`${name}: ${e.message}`); console.log(`✗ ${name}: ${e.message.split('\n')[0]}`); }
}

/** axe-core (WCAG 2.0/2.1 A und AA) auf der aktuellen Ansicht; Ergebnis unter `name`. */
export async function axe(s, name) {
  if (!axeQuelle) {
    try { axeQuelle = await (await fetch(AXE_URL)).text(); } catch (e) { barrierefreiheit[name] = { fehler: `axe nicht geladen: ${e.message}` }; return; }
  }
  await js(s, `Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))).then(() => true)`).catch(() => {});
  if (!(await js(s, 'typeof axe !== "undefined"'))) await js(s, `${axeQuelle};true`);
  const r = await js(s, `axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }).then((r) => ({
    verstoesse: r.violations.map((v) => ({ id: v.id, auswirkung: v.impact, stellen: v.nodes.length, beispiel: v.nodes[0]?.target?.join(' '), hilfe: v.help })),
    bestanden: r.passes.length, unvollstaendig: r.incomplete.length }))`);
  barrierefreiheit[name] = r;
  if (r.verstoesse.length) console.log(`  axe ${name}: ${r.verstoesse.map((v) => `${v.id} (${v.stellen})`).join(', ')}`);
}

export const AXE_VERSION = '4.10.2';

/** Fehler aus dem Browserprotokoll sammeln (ohne erwartbare Hinweise). */
export function sammleProtokoll(name, s, erlaubt = []) {
  for (const zeile of s.protokoll.filter((z) => /Ausnahme|console\.error|log: .*(Failed|Refused|error)/i.test(z) && !/Cross-Origin-Opener-Policy/.test(z) && !erlaubt.some((e) => e.test(z)))) fehler.push(`${name}: ${zeile}`);
}

export function abschluss(datei, extra = {}) {
  writeFileSync(`${AUSGABE}/${datei}`, JSON.stringify({ zeitpunkt: new Date().toISOString(), axe: AXE_VERSION, schritte, fehler, barrierefreiheit, ...extra }, null, 2));
  const verstoesse = Object.entries(barrierefreiheit).filter(([, r]) => r.verstoesse?.length);
  console.log(`\naxe: ${Object.keys(barrierefreiheit).length} Ansichten, ${verstoesse.length} mit Verstößen`);
  console.log(fehler.length ? `${fehler.length} Fehler:\n${fehler.join('\n')}` : 'Keine Fehler.');
  process.exit(fehler.length || verstoesse.length ? 1 : 0);
}
