// Teile der Spielfigur als Vektorzeichnungen (CC BY-SA 4.0). viewBox 0 0 240 320, Blick von vorn.
// Jede Funktion liefert SVG-Markup für eine Ebene; Farben kommen aus der Auswahl. Keine Inhalte aus Daten im Markup:
// Nur Farbwerte aus dem Katalog werden eingesetzt, und die werden vorher auf #RRGGBB geprüft.

const T = '#263238';
const farbe = (wert, ersatz) => (/^#[0-9a-fA-F]{6}$/.test(wert ?? '') ? wert : ersatz);
const dunkler = (hex, anteil = 0.18) => {
  const n = parseInt(hex.slice(1), 16);
  const k = (x) => Math.max(0, Math.round(x * (1 - anteil)));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map(k).map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

export function schatten() {
  return `<ellipse cx="120" cy="308" rx="62" ry="9" fill="${T}" opacity=".14"/>`;
}

export function rucksack(art, f) {
  if (art !== 'rucksack') return '';
  return `<path d="M70 158 C64 160 58 170 58 186 V224 C58 232 64 236 72 236 H80 V158 Z" fill="#E39A2D" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M170 158 C176 160 182 170 182 186 V224 C182 232 176 236 168 236 H160 V158 Z" fill="#E39A2D" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>`;
}

export function haareHinten(frisur, f) {
  const h = farbe(f.haare, '#5A3825');
  if (frisur === 'zoepfe') {
    return `<path d="M64 100 C56 140 58 176 66 196 L80 194 C76 170 76 140 80 110 Z M176 100 C184 140 182 176 174 196 L160 194 C164 170 164 140 160 110 Z" fill="${h}" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="72" cy="200" r="8" fill="#E25B45" stroke="${T}" stroke-width="3"/><circle cx="168" cy="200" r="8" fill="#E25B45" stroke="${T}" stroke-width="3"/>`;
  }
  if (frisur === 'lang') {
    return `<path d="M62 96 C56 150 60 184 70 206 H170 C180 184 184 150 178 96 Z" fill="${h}" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  if (frisur === 'pferdeschwanz') {
    return `<path d="M164 70 C196 70 204 110 196 150 C192 170 182 182 172 186 C178 160 178 120 160 96 Z" fill="${h}" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  return '';
}

export function koerper(oberteil, f) {
  const haut = farbe(f.haut, '#E8B48F');
  const stoff = farbe(f.oberteil, '#2E8B57');
  const hose = farbe(f.hose, '#3E5C80');
  const schatten = dunkler(stoff);
  let extra = '';
  if (oberteil === 'pulli') {
    extra = `<path d="M92 150 C96 168 144 168 148 150" fill="none" stroke="${schatten}" stroke-width="6" stroke-linecap="round"/>
    <path d="M110 176 V214 M130 176 V214" stroke="${schatten}" stroke-width="3"/><path d="M98 206 H142" stroke="${schatten}" stroke-width="5" stroke-linecap="round"/>`;
  } else if (oberteil === 'weste') {
    extra = `<path d="M80 160 L104 152 L110 232 H80 Z M160 160 L136 152 L130 232 H160 Z" fill="#C9B07A" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M86 186 H100 M140 186 H154" stroke="${T}" stroke-width="3"/>`;
  } else {
    extra = `<path d="M104 150 L120 164 L136 150" fill="none" stroke="${schatten}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<path d="M94 228 H116 V290 H94 Z M124 228 H146 V290 H124 Z" fill="${hose}" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M88 290 H118 V300 C118 304 114 306 110 306 H86 C82 306 80 302 82 298 Z M122 290 H152 L156 298 C158 302 156 306 152 306 H128 C124 306 122 304 122 300 Z" fill="#3B3F44" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M108 136 H132 V156 H108 Z" fill="${haut}" stroke="${T}" stroke-width="4"/>
  <path d="M84 152 C96 146 144 146 156 152 C166 156 168 166 168 176 V232 H72 V176 C72 166 74 156 84 152 Z" fill="${stoff}" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M74 160 C62 170 58 196 60 214 L76 216 C76 200 78 184 84 174 Z M166 160 C178 170 182 196 180 214 L164 216 C164 200 162 184 156 174 Z" fill="${stoff}" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="68" cy="222" r="10" fill="${haut}" stroke="${T}" stroke-width="4"/><circle cx="172" cy="222" r="10" fill="${haut}" stroke="${T}" stroke-width="4"/>
  ${extra}`;
}

export function rucksackRiemen(art) {
  if (art !== 'rucksack') return '';
  return `<path d="M88 152 C86 176 84 200 84 230 M152 152 C154 176 156 200 156 230" fill="none" stroke="#B9731C" stroke-width="7" stroke-linecap="round"/>`;
}

export function kopf(f) {
  const haut = farbe(f.haut, '#E8B48F');
  return `<circle cx="66" cy="102" r="11" fill="${haut}" stroke="${T}" stroke-width="4"/><circle cx="174" cy="102" r="11" fill="${haut}" stroke="${T}" stroke-width="4"/>
  <circle cx="120" cy="96" r="54" fill="${haut}" stroke="${T}" stroke-width="4"/>`;
}

export function gesicht(art) {
  const wangen = `<ellipse cx="90" cy="114" rx="9" ry="6" fill="#F28B82" opacity=".55"/><ellipse cx="150" cy="114" rx="9" ry="6" fill="#F28B82" opacity=".55"/>`;
  const brauen = `<path d="M92 82 Q100 77 108 81 M132 81 Q140 77 148 82" fill="none" stroke="${T}" stroke-width="4" stroke-linecap="round"/>`;
  const augen = `<circle cx="100" cy="98" r="6" fill="${T}"/><circle cx="140" cy="98" r="6" fill="${T}"/><circle cx="102" cy="96" r="2" fill="#fff"/><circle cx="142" cy="96" r="2" fill="#fff"/>`;
  if (art === 'lacht') {
    return `${wangen}${brauen}<path d="M93 99 Q100 92 107 99 M133 99 Q140 92 147 99" fill="none" stroke="${T}" stroke-width="4" stroke-linecap="round"/>
    <path d="M104 116 Q120 136 136 116 Z" fill="#8C2F39" stroke="${T}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  if (art === 'staunt') {
    return `${wangen}<path d="M92 78 Q100 72 108 77 M132 77 Q140 72 148 78" fill="none" stroke="${T}" stroke-width="4" stroke-linecap="round"/>${augen}
    <ellipse cx="120" cy="122" rx="8" ry="10" fill="#8C2F39" stroke="${T}" stroke-width="4"/>`;
  }
  if (art === 'zwinkert') {
    return `${wangen}${brauen}<circle cx="100" cy="98" r="6" fill="${T}"/><circle cx="102" cy="96" r="2" fill="#fff"/>
    <path d="M133 99 Q140 94 147 99" fill="none" stroke="${T}" stroke-width="4" stroke-linecap="round"/>
    <path d="M106 118 Q120 130 136 116" fill="none" stroke="${T}" stroke-width="4" stroke-linecap="round"/>`;
  }
  return `${wangen}${brauen}${augen}<path d="M106 117 Q120 129 134 117" fill="none" stroke="${T}" stroke-width="4" stroke-linecap="round"/>`;
}

export function brille(art) {
  if (art === 'rund') return `<g fill="none" stroke="${T}" stroke-width="4"><circle cx="100" cy="98" r="14"/><circle cx="140" cy="98" r="14"/><path d="M114 97 Q120 93 126 97 M86 96 L68 92 M154 96 L172 92"/></g>`;
  if (art === 'sonne') return `<path d="M84 88 H116 V102 C116 112 108 114 100 114 C92 114 84 112 84 102 Z M124 88 H156 V102 C156 112 148 114 140 114 C132 114 124 112 124 102 Z" fill="#30373C" stroke="${T}" stroke-width="4" stroke-linejoin="round"/><path d="M116 92 H124 M84 92 L68 90 M156 92 L172 90" stroke="${T}" stroke-width="4"/><path d="M90 94 L98 94" stroke="#7B8A93" stroke-width="3" stroke-linecap="round"/>`;
  return '';
}

export function haareVorn(frisur, f, kopfbedeckung) {
  if (kopfbedeckung === 'kopftuch') return '';
  const h = farbe(f.haare, '#5A3825');
  const s = `stroke="${T}" stroke-width="4" stroke-linejoin="round"`;
  if (frisur === 'glatt') return '';
  if (frisur === 'locken') {
    const kreise = [[74, 84], [84, 62], [104, 48], [128, 46], [150, 54], [166, 72], [172, 92], [68, 104]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17"/>`).join('');
    return `<g fill="${h}" ${s}>${kreise}</g><path d="M80 82 C96 70 144 70 162 84 C150 74 96 66 80 82 Z" fill="${h}"/>`;
  }
  if (frisur === 'dutt') {
    return `<circle cx="120" cy="40" r="20" fill="${h}" ${s}/><path d="M66 96 C66 60 90 44 120 44 C150 44 174 60 174 96 C160 78 140 70 120 70 C100 70 80 78 66 96 Z" fill="${h}" ${s}/>`;
  }
  // kurz, zoepfe, lang, pferdeschwanz: Haaransatz mit Pony
  return `<path d="M66 98 C64 60 90 42 120 42 C150 42 176 60 174 98 C170 86 160 76 146 72 C140 82 128 86 114 82 C104 80 96 76 92 72 C80 78 70 88 66 98 Z" fill="${h}" ${s}/>`;
}

export function kopfbedeckung(art, f) {
  const s = `stroke="${T}" stroke-width="4" stroke-linejoin="round"`;
  switch (art) {
    case 'schirmmuetze':
      return `<path d="M68 82 C68 52 92 38 120 38 C148 38 172 52 172 82 Z" fill="#D64545" ${s}/><path d="M120 82 H190 C194 82 196 88 192 90 C176 96 140 94 120 92 Z" fill="#B53A3A" ${s}/><circle cx="120" cy="40" r="5" fill="#B53A3A" ${s}/>`;
    case 'pudelmuetze':
      return `<path d="M66 84 C66 50 90 36 120 36 C150 36 174 50 174 84 Z" fill="#2A6FA8" ${s}/><path d="M62 76 H178 V92 H62 Z" fill="#1F5A8A" ${s}/><circle cx="120" cy="30" r="14" fill="#F2B233" ${s}/><path d="M86 52 V74 M104 44 V74 M136 44 V74 M154 52 V74" stroke="#1F5A8A" stroke-width="4"/>`;
    case 'kopftuch':
      return `<path d="M60 102 C58 58 88 36 120 36 C152 36 182 58 180 102 C178 124 170 140 158 150 C150 156 132 160 120 160 C108 160 90 156 82 150 C70 140 62 124 60 102 Z M78 100 C82 132 100 146 120 146 C140 146 158 132 162 100 C158 80 142 70 120 70 C98 70 82 80 78 100 Z" fill="#7E57C2" fill-rule="evenodd" ${s}/>`;
    case 'kletterhelm':
      return `<path d="M64 88 C64 50 90 34 120 34 C150 34 176 50 176 88 Z" fill="#F2B233" ${s}/><path d="M64 88 H176" stroke="${T}" stroke-width="6"/><path d="M100 40 C104 56 104 70 102 86 M140 40 C136 56 136 70 138 86" stroke="#D99A1E" stroke-width="5" fill="none"/><path d="M70 92 C72 116 84 134 100 144 M170 92 C168 116 156 134 140 144" fill="none" stroke="${T}" stroke-width="4"/>`;
    case 'lokmuetze':
      return `<path d="M70 80 C70 56 92 44 120 44 C148 44 170 56 170 80 Z" fill="#3D5A80" ${s}/><path d="M66 78 H174 V90 H66 Z" fill="#2C4361" ${s}/><path d="M100 90 H140 C150 90 156 96 152 100 H88 C84 96 90 90 100 90 Z" fill="#1E2A38" ${s}/><circle cx="120" cy="66" r="9" fill="#F2B233" ${s}/>`;
    case 'krone':
      return `<path d="M70 82 L74 40 L96 62 L120 34 L144 62 L166 40 L170 82 Z" fill="#F2B233" ${s}/><circle cx="120" cy="66" r="6" fill="#D64545"/><circle cx="92" cy="72" r="5" fill="#2A6FA8"/><circle cx="148" cy="72" r="5" fill="#2E8B57"/>`;
    default:
      return '';
  }
}

export function zubehoer(art) {
  const s = `stroke="${T}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  switch (art) {
    case 'karte':
      return `<path d="M168 196 L188 190 L206 198 L224 192 V236 L206 242 L188 234 L168 240 Z" fill="#FFF4D6" ${s}/><path d="M188 190 V234 M206 198 V242" stroke="${T}" stroke-width="3"/><path d="M174 214 C182 206 196 222 214 210" fill="none" stroke="#E25B45" stroke-width="3" stroke-dasharray="4 4"/>`;
    case 'lupe':
      return `<path d="M176 226 L196 206" ${s}/><circle cx="204" cy="198" r="16" fill="#CFE6F5" ${s}/><path d="M196 192 Q200 186 208 188" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
    case 'fernrohr':
      return `<path d="M166 224 L222 186 L230 198 L176 236 Z" fill="#B07A47" ${s}/><path d="M206 196 L214 208" stroke="${T}" stroke-width="4"/><path d="M222 186 L232 180 L240 192 L230 198 Z" fill="#E8B13A" ${s}/>`;
    case 'laterne':
      return `<path d="M172 214 V200" ${s}/><path d="M160 200 H184 L180 212 H164 Z" fill="#30373C" ${s}/><path d="M164 212 H180 V244 H164 Z" fill="#FFE08A" ${s}/><path d="M160 244 H184 V250 H160 Z" fill="#30373C" ${s}/>`;
    case 'fahne':
      return `<path d="M178 230 V150" ${s}/><path d="M178 152 H222 V168 H178 Z" fill="#FFFFFF" ${s}/><path d="M178 168 H222 V184 H178 Z" fill="#2E8B57" ${s}/>`;
    default:
      return '';
  }
}

export function begleiter(art) {
  const s = `stroke="${T}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  switch (art) {
    case 'dackel':
      return `<g transform="translate(150 252)"><path d="M10 34 C10 20 20 16 40 16 H66 C76 16 80 22 80 30 V36 H10 Z" fill="#9A5B32" ${s}/><path d="M14 36 V50 M26 36 V50 M60 36 V50 M72 36 V50" ${s}/><path d="M66 16 C70 2 88 2 90 14 C92 22 84 26 76 24" fill="#9A5B32" ${s}/><path d="M74 8 C70 18 66 22 62 22" fill="#7A4524" ${s}/><circle cx="84" cy="12" r="2.5" fill="${T}"/><path d="M10 24 L0 16" ${s}/></g>`;
    case 'katze':
      return `<g transform="translate(160 244)"><path d="M14 58 C10 40 14 26 30 24 C46 22 54 36 52 58 Z" fill="#9AA7AE" ${s}/><circle cx="34" cy="20" r="16" fill="#9AA7AE" ${s}/><path d="M22 10 L20 -4 L32 6 M46 10 L48 -4 L38 6" fill="#9AA7AE" ${s}/><circle cx="28" cy="20" r="2.5" fill="${T}"/><circle cx="40" cy="20" r="2.5" fill="${T}"/><path d="M52 52 C66 48 66 30 58 26" fill="none" ${s}/></g>`;
    case 'eichhoernchen':
      return `<g transform="translate(160 240)"><path d="M44 60 C70 56 74 20 56 8 C46 2 40 12 46 22 C54 34 50 46 40 50" fill="#C4562E" ${s}/><path d="M14 62 C10 46 16 34 28 34 C40 34 44 46 40 62 Z" fill="#D9744A" ${s}/><circle cx="26" cy="30" r="12" fill="#D9744A" ${s}/><path d="M20 20 L18 10 L26 18" fill="#D9744A" ${s}/><circle cx="22" cy="30" r="2.5" fill="${T}"/></g>`;
    case 'uhu':
      return `<g transform="translate(164 246)"><path d="M10 14 L6 0 L18 8 M46 14 L50 0 L38 8" fill="#91592B" ${s}/><path d="M28 6 C46 6 52 22 52 38 C52 54 42 62 28 62 C14 62 4 54 4 38 C4 22 10 6 28 6 Z" fill="#B8773D" ${s}/><circle cx="19" cy="28" r="8" fill="#F6B13A" ${s}/><circle cx="37" cy="28" r="8" fill="#F6B13A" ${s}/><circle cx="19" cy="28" r="3" fill="${T}"/><circle cx="37" cy="28" r="3" fill="${T}"/><path d="M25 36 L31 36 L28 42 Z" fill="#E39A2D" ${s}/></g>`;
    default:
      return '';
  }
}
