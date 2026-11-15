// Rendert app/bilder/symbol.svg als PNG (180, 192, 512 und 512 maskierbar) mit Chrome ohne Oberfläche (CDP).
// Aufruf im Prüf-Container: PRUEFSKRIPT=tools/symbole-rendern.js docker compose -f compose.test.yaml up …
import { writeFileSync, readFileSync } from 'node:fs';
import { Cdp } from '../test/e2e/cdp.js';

const svg = readFileSync('app/bilder/symbol.svg', 'utf8');
const s = await Cdp.neueSeite('http://127.0.0.1:9222');
for (const [name, groesse, rand] of [['symbol-180.png', 180, 0], ['symbol-192.png', 192, 0], ['symbol-512.png', 512, 0], ['symbol-maskierbar-512.png', 512, 0.1]]) {
  await s.sende('Emulation.setDeviceMetricsOverride', { width: groesse, height: groesse, deviceScaleFactor: 1, mobile: false });
  const innen = Math.round(groesse * (1 - 2 * rand));
  const seite = `data:text/html;base64,${Buffer.from(`<!doctype html><html><body style="margin:0;background:${rand ? '#1d6b47' : 'transparent'}"><img style="display:block;margin:${Math.round(groesse * rand)}px;width:${innen}px;height:${innen}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`).toString('base64')}`;
  await s.gehe(seite);
  await s.sende('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const { data } = await s.sende('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: groesse, height: groesse, scale: 1 } });
  writeFileSync(`app/bilder/${name}`, Buffer.from(data, 'base64'));
  console.log(name);
}
process.exit(0);
