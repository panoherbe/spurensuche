// Symbole der Spiele: eigene Linienzeichnungen, 24 × 24, Farbe aus der Schriftfarbe (currentColor).
// Sie sind immer Beiwerk: Jede Schaltfläche trägt zusätzlich ein Wort (WCAG 1.1.1, 1.4.1).
// Lizenz der Zeichnungen: CC BY-SA 4.0, wie alle neuen Inhalte der Spurensuche.

const linie = (inhalt) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inhalt}</svg>`;
const flaeche = (inhalt) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${inhalt}</svg>`;

export const SYMBOLE = {
  vorlesen: linie('<path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" fill="currentColor" stroke-width="1.6"/><path d="M15.6 9.2a3.8 3.8 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
  tipp: linie('<path d="M9.2 18.2h5.6M10.2 21.2h3.6"/><path d="M12 2.8a6.2 6.2 0 0 0-3.7 11.2c.7.6 1 1.3 1 2.1v.3h5.4v-.3c0-.8.3-1.5 1-2.1A6.2 6.2 0 0 0 12 2.8z"/>'),
  haken: linie('<path d="M5 12.6l4.4 4.4L19 7.4"/>'),
  kreuz: linie('<path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4"/>'),
  stern: flaeche('<path d="M12 2.6l2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 16.95 6.38 19.9l1.07-6.27L2.9 9.2l6.3-.9z" fill="#F2B233" stroke="#5C3D00" stroke-width="1.3" stroke-linejoin="round"/>'),
  sternLeer: flaeche('<path d="M12 2.6l2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 16.95 6.38 19.9l1.07-6.27L2.9 9.2l6.3-.9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'),
  hoch: linie('<path d="M12 19V5.5M6.5 11L12 5.5 17.5 11"/>'),
  runter: linie('<path d="M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5"/>'),
  tauschen: linie('<path d="M4.5 8.5h14l-3.2-3.2M19.5 15.5h-14l3.2 3.2"/>'),
  weiter: linie('<path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5"/>'),
  zurueck: linie('<path d="M19 12H5.5M11 6.5L5.5 12l5.5 5.5"/>'),
  lupe: linie('<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2l5.3 5.3"/>'),
  plus: linie('<path d="M12 5v14M5 12h14"/>'),
  minus: linie('<path d="M5 12h14"/>'),
  nochmal: linie('<path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.3"/><path d="M4.6 4.2v4.4H9"/>'),
  info: linie('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.7v.1"/>'),
  ort: linie('<path d="M12 21s-6.8-6-6.8-11.4a6.8 6.8 0 0 1 13.6 0C18.8 15 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.4"/>'),
  uhr: linie('<circle cx="12" cy="12.5" r="8.3"/><path d="M12 8.2v4.5l3 2"/>'),
  auge: linie('<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  hand: linie('<path d="M8.4 12.6V5.4a1.6 1.6 0 0 1 3.2 0v5.8M11.6 10.6V4.2a1.6 1.6 0 0 1 3.2 0v6.6M14.8 10.8V6.2a1.6 1.6 0 0 1 3.2 0v7.4c0 4-2.6 7-6.4 7-2.6 0-4.1-1.1-5.3-2.9l-2.4-3.9a1.6 1.6 0 0 1 2.6-1.9l2.1 2.4"/>'),
  stimme: linie('<path d="M4 13.5h16v6.5H4z"/><path d="M8.5 13.5V6.5l3.5-3 3.5 3v7"/><path d="M10.5 9.5l1.2 1.2 2.3-2.4"/>'),
  ziehen: linie('<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>'),
  // Rollen (Positionen in der Gruppe, nie Personen)
  lesen: linie('<path d="M3.5 6.2c2.9-1.3 5.9-1.3 8.5.8 2.6-2.1 5.6-2.1 8.5-.8v12.2c-2.9-1.3-5.9-1.3-8.5.8-2.6-2.1-5.6-2.1-8.5-.8z"/><path d="M12 7v12.2"/>'),
  steuern: linie('<circle cx="12" cy="12" r="8.8"/><path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5z" fill="currentColor"/>'),
  pruefen: linie('<path d="M7 3.8h10a1.5 1.5 0 0 1 1.5 1.5v14.4A1.5 1.5 0 0 1 17 21.2H7a1.5 1.5 0 0 1-1.5-1.5V5.3A1.5 1.5 0 0 1 7 3.8z"/><path d="M9 12.3l2.1 2.1 4.1-4.3"/>'),
  // Formate
  bildpuzzle: linie('<path d="M4 4h6.5v2.2a1.8 1.8 0 1 0 3 0V4H20v6.5h-2.2a1.8 1.8 0 1 0 0 3H20V20h-6.5v-2.2a1.8 1.8 0 1 0-3 0V20H4v-6.5h2.2a1.8 1.8 0 1 0 0-3H4z"/>'),
  schaetzen: linie('<path d="M4.5 18.5a8.5 8.5 0 1 1 15 0"/><path d="M12 13.2l4.2-4.4"/><circle cx="12" cy="13.6" r="1.4" fill="currentColor"/><path d="M6.5 13.6h1.2M16.3 13.6h1.2M12 6.8v1.2"/>'),
  dilemma: linie('<path d="M12 3.5v16.5M7.5 20.5h9M4.5 7h15"/><path d="M4.5 7L2 12.8a2.6 2.6 0 0 0 5 0zM19.5 7L17 12.8a2.6 2.6 0 0 0 5 0z"/>'),
  sortieren: linie('<rect x="3.5" y="3.8" width="17" height="4.4" rx="1.4"/><rect x="3.5" y="9.8" width="17" height="4.4" rx="1.4"/><rect x="3.5" y="15.8" width="17" height="4.4" rx="1.4"/>'),
  bildsuche: linie('<rect x="2.8" y="4" width="18.4" height="14.5" rx="2.2"/><path d="M2.8 15.5l4.6-4.2 3.6 3.2 2.5-2.2 3 2.6"/><circle cx="16.6" cy="8.6" r="1.6"/>'),
  collage: linie('<rect x="3" y="3" width="8" height="8" rx="2"/><circle cx="17" cy="7" r="4"/><rect x="13" y="13" width="8" height="8" rx="2" transform="rotate(8 17 17)"/><path d="M4 20l3.5-6 3.5 6z"/>'),
  figur: linie('<circle cx="12" cy="7.2" r="3.8"/><path d="M4.8 20.5c.6-4 3.4-6.6 7.2-6.6s6.6 2.6 7.2 6.6"/>'),
};

const vorlagen = new Map();

/** Symbol als DOM-Element (span mit SVG), ohne innerHTML: Die festen Zeichnungen oben werden einmal geparst. */
export function symbol(name, klasse = '') {
  const huelle = document.createElement('span');
  huelle.className = `sp-symbol ${klasse}`.trim();
  huelle.setAttribute('aria-hidden', 'true');
  const schluessel = SYMBOLE[name] ? name : 'info';
  if (!vorlagen.has(schluessel)) {
    vorlagen.set(schluessel, new DOMParser().parseFromString(SYMBOLE[schluessel], 'image/svg+xml').documentElement);
  }
  huelle.append(document.importNode(vorlagen.get(schluessel), true));
  return huelle;
}
