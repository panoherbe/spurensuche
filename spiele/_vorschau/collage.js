// Testseite der Item-Collage: wählt Sammelstücke, zeichnet die Regler aus `regler`, zeigt eine schnelle Vorschau
// (512 px) und erzeugt das Bild in 2048 × 2048 px. Messwerte für den Messlauf in window.collageTest.
import { erzeugeCollage, regler } from '../collage/index.js';

const WURZEL = new URL('../../', import.meta.url);
const el = (tag, eigenschaften = {}, ...kinder) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(eigenschaften)) e.setAttribute(k, v); e.append(...kinder); return e; };
const parameter = new URLSearchParams(location.search);
const items = await (await fetch(new URL('inhalte/items.json', WURZEL))).json();
const gewaehlt = new Set((parameter.get('items') ?? 'basteibruecke,felsturm,kuppel,turmkreuz,goeltzschtalbruecke,ortsschild').split(',').filter((id) => items.some((i) => i.id === id)));
const optionen = Object.fromEntries(regler.map((r) => [r.id, parameter.get(r.id) ?? r.werte[0].id]));
window.collageTest = { fertig: false };

const liste = document.getElementById('cl-items');
const anzahl = document.getElementById('cl-anzahl');
const status = document.getElementById('cl-status');
const vorschauBild = document.getElementById('cl-vorschau');
for (const item of items) {
  const knopf = el('button', { type: 'button', class: 'cl-item', 'aria-pressed': String(gewaehlt.has(item.id)), 'data-item': item.id },
    el('img', { src: new URL(item.bild, WURZEL).href, alt: '' }), item.name);
  knopf.addEventListener('click', () => {
    if (gewaehlt.has(item.id)) gewaehlt.delete(item.id);
    else if (gewaehlt.size < 12) gewaehlt.add(item.id);
    else { status.textContent = 'Höchstens 12 Sammelstücke.'; return; }
    knopf.setAttribute('aria-pressed', String(gewaehlt.has(item.id)));
    zeichneVorschau();
  });
  liste.append(el('li', {}, knopf));
}

const formular = document.getElementById('cl-regler');
for (const r of regler) {
  const feld = el('fieldset', {}, el('legend', {}, r.name));
  for (const w of r.werte) {
    const eingabe = el('input', { type: 'radio', name: r.id, value: w.id });
    eingabe.checked = optionen[r.id] === w.id;
    eingabe.addEventListener('change', () => { optionen[r.id] = w.id; zeichneVorschau(); });
    feld.append(el('label', {}, eingabe, w.name));
  }
  formular.append(feld);
}

const auswahl = () => items.filter((i) => gewaehlt.has(i.id));
let laufend = 0;
async function zeichneVorschau() {
  anzahl.textContent = `(${gewaehlt.size} gewählt)`;
  if (gewaehlt.size === 0) { status.textContent = 'Wählt mindestens ein Sammelstück.'; return; }
  const nr = ++laufend;
  const { vorschau } = await erzeugeCollage(auswahl(), { ...optionen, kantenlaenge: 512 });
  if (nr !== laufend) return;
  URL.revokeObjectURL(vorschauBild.src);
  vorschauBild.src = URL.createObjectURL(vorschau);
  vorschauBild.alt = `Vorschau der Collage mit ${auswahl().map((i) => i.name).join(', ')}; ${regler.map((r) => r.werte.find((w) => w.id === optionen[r.id]).name).join(', ')}`;
}

async function groesse(blob) {
  const kopf = new DataView(await blob.slice(0, 32).arrayBuffer());
  if (blob.type === 'image/png') return { breite: kopf.getUint32(16), hoehe: kopf.getUint32(20) };
  const bild = await createImageBitmap(blob);
  return { breite: bild.width, hoehe: bild.height };
}

document.getElementById('cl-erzeugen').addEventListener('click', async () => {
  if (gewaehlt.size === 0) return;
  status.textContent = 'Bild wird erzeugt …';
  const beginn = performance.now();
  const { png, vorschau, metadaten } = await erzeugeCollage(auswahl(), optionen);
  const dauerMs = Math.round(performance.now() - beginn);
  const [g, v] = await Promise.all([groesse(png), groesse(vorschau)]);
  document.getElementById('cl-png').href = URL.createObjectURL(png);
  document.getElementById('cl-json').href = URL.createObjectURL(new Blob([JSON.stringify(metadaten, null, 2)], { type: 'application/json' }));
  document.getElementById('cl-metadaten').textContent = JSON.stringify(metadaten, null, 2);
  document.getElementById('cl-messung').textContent = `PNG ${g.breite} × ${g.hoehe} px, ${Math.round(png.size / 1024)} KB; Vorschau ${vorschau.type}, ${v.breite} × ${v.hoehe} px; erzeugt in ${dauerMs} ms.`;
  document.getElementById('cl-ergebnis').hidden = false;
  status.textContent = 'Fertig.';
  window.collagePng = png;
  Object.assign(window.collageTest, { fertig: true, dauerMs, png: { typ: png.type, bytes: png.size, ...g }, vorschau: { typ: vorschau.type, bytes: vorschau.size, ...v }, metadaten, optionen: { ...optionen }, items: [...gewaehlt] });
});

zeichneVorschau();
