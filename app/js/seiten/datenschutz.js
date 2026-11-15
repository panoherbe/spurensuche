// Datenschutz in einfachen Worten, mit Knopf zum Löschen aller Daten auf dem Gerät.

import { h, leere, knopf, frage, melde } from '../ui.js';
import { t } from '../einstellungen.js';
import { allesLoeschen } from '../speicher.js';
import { teamVerlassen } from '../spielstand.js';

export async function zeige({ haupt, api, navigiere }) {
  const abschnitt = (titel, standard, einfach) => h('section', { class: 'karte' }, h('h2', { 'data-vorlesen': '' }, titel), h('p', { 'data-vorlesen': '' }, t({ standard, einfach })));
  leere(haupt,
    h('h1', { 'data-vorlesen': '' }, 'Datenschutz'),
    api.vorfuehrung ? h('p', { class: 'hinweisfeld' }, 'Vorführung: Diese Seite läuft ohne Server. Nichts wird übertragen; alles bleibt in diesem Browser.') : null,
    abschnitt('Was auf diesem Gerät bleibt',
      'Einstellungen, der Name eurer Gruppe oder eures Teams, welche Orte und Aufgaben ihr geschafft habt, eure Sammelstücke, eure Figur und euer Bild. Das bleibt so lange, bis ihr es hier löscht.',
      'Auf dem Gerät bleiben: eure Einstellungen, euer Teamname, eure Spiele und Sammelstücke, eure Figur und euer Bild.'),
    abschnitt('Was eine Schulgruppe überträgt',
      'Nur wenn die Lehrkraft die Auswertung eingeschaltet hat: welche Stationen begonnen und beendet wurden (vor Ort oder im Klassenzimmer), und je Aufgabe Versuche, genutzte Hilfen, Wechsel des Vorgehens, gewählte Lösungswege, Eingaben je Rolle und Abstimmungen. Alles gehört zur Gruppe, nie zu einer Person. Keine Namen, keine Standorte, keine Fotos, keine Gerätekennung.',
      'Die Lehrkraft sieht nur, wie die Gruppe gespielt hat. Sie sieht keine Namen und keinen Standort.'),
    abschnitt('Kamera und Standort',
      'Die Kamera braucht ihr nur zum Scannen des QR-Codes; das Bild bleibt im Gerät. Den Standort vergleicht das Gerät nur mit dem Ort der Station. Gespeichert wird allein „Station erreicht“.',
      'Die Kamera liest nur den QR-Code. Der Standort wird nur im Gerät geprüft und nicht gespeichert.'),
    abschnitt('Wann gelöscht wird',
      'Gruppendaten löscht der Server zwölf Wochen nach dem Ende der Quest, spätestens am Ende des Schuljahres. Die Lehrkraft kann früher löschen. Ein Bild für die Ausstellung bleibt nur, wenn es freigegeben wurde; es enthält keinen Namen.',
      'Nach zwölf Wochen wird alles gelöscht. Die Lehrkraft kann es auch früher löschen.'),
    abschnitt('Familien und Gruppen ohne Schule',
      'Im Familienmodus verlässt nichts das Gerät. Nur ein Bild, das ihr selbst für die Ausstellung freigebt, wird übertragen, ohne euren Teamnamen.',
      'Als Familie bleibt alles auf dem Gerät. Nur euer Bild schickt ihr, wenn ihr das wollt.'),
    h('section', { class: 'karte' }, h('h2', {}, 'Alles auf diesem Gerät löschen'),
      h('p', {}, 'Löscht Spielstand, Sammelstücke, Figur, Bild und wartende Übertragungen. Die Einstellungen bleiben.'),
      knopf('Daten auf diesem Gerät löschen', async () => {
        if (await frage('Wirklich löschen?', 'Spielstand, Sammelstücke und Bild auf diesem Gerät sind danach weg. Das lässt sich nicht rückgängig machen.', { ja: 'Löschen', gefaehrlich: true })) {
          await allesLoeschen();
          await teamVerlassen();
          melde('Alle Daten auf diesem Gerät sind gelöscht.');
          navigiere('/');
        }
      }, { art: 'warnung', sym: 'muell' })),
  );
  return 'Datenschutz';
}
