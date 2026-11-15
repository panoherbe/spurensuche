#!/usr/bin/env node
// Erzeugt das App-Symbol (app/bilder/symbol.svg) aus dem Umriss Sachsens: grüne Fläche, heller Umriss, Spur aus Punkten.
import { writeFileSync } from 'node:fs';
import { KARTE } from '../app/js/karte-daten.js';

const k = 400 / KARTE.breite;
const x = (512 - KARTE.breite * k) / 2;
const y = (512 - KARTE.hoehe * k) / 2 + 6;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="#1d6b47"/>
<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(4)})"><path d="${KARTE.sachsen}" fill="#f5f2ea"/></g>
<g fill="#e0a920"><circle cx="160" cy="300" r="16"/><circle cx="214" cy="262" r="14"/><circle cx="268" cy="276" r="12"/><circle cx="318" cy="240" r="11"/></g>
<circle cx="364" cy="214" r="26" fill="none" stroke="#e0a920" stroke-width="12"/>
</svg>
`;
writeFileSync(new URL('../app/bilder/symbol.svg', import.meta.url), svg);
console.log(`symbol.svg: ${svg.length} Zeichen`);
