// Offline-Prüfung: warten, bis der Service Worker alles vorgeladen hat; Netz für Seite und Service Worker kappen.

import { Cdp } from './cdp.js';

const BEDINGUNGEN = (aus) => ({ offline: aus, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const verbunden = new Map();

/** Wartet, bis die Seite vom Service Worker gesteuert wird und jede Datei der Offline-Liste im Speicher liegt. */
export async function offlineBereit(s, zeit = 60000) {
  await s.warte(`navigator.serviceWorker && navigator.serviceWorker.controller !== null`, zeit).catch(async () => {
    // erste Seite nach der Installation ist noch nicht gesteuert: einmal neu laden
    await s.sende('Page.reload', {});
    await s.warte(`navigator.serviceWorker && navigator.serviceWorker.controller !== null`, zeit);
  });
  // `warte` prüft nur synchrone Ausdrücke; hier wird ein Promise abgewartet, deshalb eine eigene Schleife
  const pruefe = `(async () => {
    const liste = await (await fetch('offline-liste.json', { cache: 'no-store' })).json();
    const namen = await caches.keys();
    const c = await caches.open(namen.find((n) => n.endsWith(liste.version)) ?? 'fehlt');
    const da = await Promise.all(liste.dateien.map((d) => c.match(new URL(d.pfad, document.baseURI).href)));
    window.__offline = { dateien: liste.dateien.length, bytes: liste.gesamtBytes, vorhanden: da.filter(Boolean).length, cache: namen };
    return da.every(Boolean);
  })()`;
  const ende = Date.now() + zeit;
  while (!(await s.werte(pruefe).catch(() => false))) {
    if (Date.now() > ende) throw new Error(`Offline-Paket unvollständig: ${JSON.stringify(await s.werte('window.__offline').catch(() => null))}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  return s.werte('window.__offline');
}

/** Schaltet das Netz für die Seite und alle Service Worker ab (an = true) oder wieder an. */
export async function offline(s, an) {
  await s.sende('Network.emulateNetworkConditions', BEDINGUNGEN(an));
  const ziele = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  for (const z of ziele.filter((x) => x.type === 'service_worker' && x.webSocketDebuggerUrl)) {
    let c = verbunden.get(z.id);
    if (!c) {
      c = await Cdp.verbinde(z.webSocketDebuggerUrl);
      await c.sende('Network.enable');
      verbunden.set(z.id, c);
    }
    await c.sende('Network.emulateNetworkConditions', BEDINGUNGEN(an));
  }
}
