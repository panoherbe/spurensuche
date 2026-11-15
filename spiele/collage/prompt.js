// Vorschau auf Option 1 (KI-Bild): Der Prompt entsteht nur aus geprüften Bausteinen der gewählten Sammelstücke und der
// Regler; es gibt kein Freitextfeld. So lassen sich unangemessene Bilder schon beim Prompt vermeiden, und die Gruppe sieht
// in einfachen Worten, was die KI malen soll. Ohne angebundenes Bildmodell bleibt es bei der Item-Collage.

import { einstellungen } from './regeln.js';

/**
 * bausteine: inhalte/prompt-bausteine.json. Liefert { de, en, items }: den Prompt auf Deutsch (zum Zeigen und Vorlesen)
 * und auf Englisch (für das Bildmodell) sowie die verwendeten Kennungen. Unbekannte Sammelstücke fallen weg.
 */
export function bauePrompt(itemIds, optionen, bausteine) {
  const o = einstellungen(optionen);
  const ids = itemIds.filter((id) => bausteine.items[id]);
  const liste = (sprache) => {
    const teile = ids.map((id) => bausteine.items[id][sprache]);
    if (teile.length <= 1) return teile.join('');
    return sprache === 'de' ? `${teile.slice(0, -1).join(', ')} und ${teile.at(-1)}` : `${teile.slice(0, -1).join(', ')} and ${teile.at(-1)}`;
  };
  const satz = (sprache) => [
    `${bausteine.stil[sprache]}: ${liste(sprache)}`,
    bausteine.anordnung[o.anordnung][sprache],
    bausteine.groesse[o.groesse][sprache],
    bausteine.farbstimmung[o.farbstimmung][sprache],
  ].join(', ');
  return {
    de: `${satz('de')}. ${bausteine.ausschluss.de}.`,
    en: `${satz('en')}. ${bausteine.ausschluss.en}.`,
    items: ids,
  };
}
