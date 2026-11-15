// Ereignisse eines Minispiels und das Ergebnis, nach docs/SCHNITTSTELLE.md (2.4, 2.5).
//
// Erfasst wird nur, was die Gruppe am Gerät tut, nie wer: keine Namen, keine Freitexte, keine Standorte.
// Ein Spiel meldet nur diese Arten; wert ist eine Zahl, true/false oder eine Kennung aus der Aufgabe:
//   versuch       die Gruppe gibt eine Lösung ab                 true richtig, false falsch
//   weg           die Gruppe wählt einen von mehreren Wegen      Kennung des Wegs
//   hilfe         die Gruppe holt einen Tipp                     Stufe 1, 2, 3
//   neuer-anlauf  erste Aktion nach einem falschen Versuch       true, wenn sie anders vorgeht
//   rolle         eine Eingabe auf einer Rollenposition         Kennung aus aufgabe.rollen
//   abstimmung    die Gruppe nutzt die Abstimmung                einig | mehrheit
// start, ende, aktiv, offline, online und sync meldet die App selbst.

export const ARTEN = ['versuch', 'weg', 'hilfe', 'neuer-anlauf', 'rolle', 'abstimmung'];
export const KENNUNG = /^[a-z0-9-]{1,40}$/;

/** Prüft ein Ereignis gegen den Vertrag; liefert eine Fehlermeldung oder null. */
export function ereignisFehler({ art, wert }) {
  if (!ARTEN.includes(art)) return `unbekannte Art „${art}“`;
  if (art === 'versuch' || art === 'neuer-anlauf') return typeof wert === 'boolean' ? null : `${art}: wert muss true oder false sein`;
  if (art === 'hilfe') return (Number.isInteger(wert) && wert >= 1) || (typeof wert === 'string' && KENNUNG.test(wert)) ? null : 'hilfe: wert muss eine Stufe ab 1 oder eine Kennung sein';
  if (art === 'abstimmung') return wert === 'einig' || wert === 'mehrheit' ? null : 'abstimmung: wert muss „einig“ oder „mehrheit“ sein';
  return typeof wert === 'string' && KENNUNG.test(wert) ? null : `${art}: wert muss eine Kennung sein (a–z, 0–9, -)`;
}

// Rollenkennungen anderer Inhalte, die auf die Knöpfe dieser Spiele passen.
const ROLLEN_ALIAS = { lesen: 'vorlesen', navigation: 'steuern', recherche: 'nachschlagen', protokoll: 'pruefen' };

/** Zuordnung Knopf-Rolle (vorlesen, steuern, nachschlagen, pruefen) → Kennung aus aufgabe.rollen. */
export function rollenZuordnung(rollen = []) {
  const zuordnung = new Map();
  for (const kennung of rollen) {
    const knopfRolle = ROLLEN_ALIAS[kennung] ?? kennung;
    if (!zuordnung.has(knopfRolle)) zuordnung.set(knopfRolle, kennung);
  }
  return zuordnung;
}

export function neuesProtokoll({ melde = () => {}, aufgabe = {}, jetzt = () => Date.now() } = {}) {
  const beginn = jetzt();
  const ereignisse = [];
  const rollen = rollenZuordnung(aufgabe.rollen ?? []);
  let versuche = 0;
  let hilfen = 0;
  let anlaufOffen = false;
  let ergebnis = null;

  function eintragen(art, wert) {
    if (ergebnis) return null;
    const fehler = ereignisFehler({ art, wert });
    if (fehler) { console.warn(`Ereignis verworfen: ${fehler}`); return null; }
    const ereignis = { art, zeit: Math.max(0, Math.round(jetzt() - beginn)), wert };
    ereignisse.push(ereignis);
    try { melde({ art, wert }); } catch (f) { console.warn('melde() ist fehlgeschlagen', f); }
    return ereignis;
  }

  return {
    get ereignisse() { return ereignisse; },
    get versuche() { return versuche; },
    get hilfen() { return hilfen; },
    get rollen() { return rollen; },

    /** Eine Lösung wurde abgegeben. */
    versuch(richtig) {
      versuche += 1;
      anlaufOffen = !richtig;
      return eintragen('versuch', !!richtig);
    },
    /**
     * Jede Aktion der Gruppe meldet sich hier. Ist sie die erste nach einem falschen Versuch, entsteht
     * „neuer-anlauf“: true, wenn die Gruppe anders vorgeht (das entscheidet das Format), sonst false.
     */
    aktion(gewechselt) {
      if (!anlaufOffen) return null;
      anlaufOffen = false;
      return eintragen('neuer-anlauf', !!gewechselt);
    },
    hilfe(stufe) {
      hilfen += 1;
      return eintragen('hilfe', stufe);
    },
    weg(kennung) { return eintragen('weg', kennung); },
    abstimmung(art) { return eintragen('abstimmung', art); },
    /** Eingabe auf einer Knopf-Rolle; meldet die Kennung aus aufgabe.rollen, falls die Aufgabe Rollen hat. */
    rolle(knopfRolle) {
      const kennung = rollen.get(knopfRolle);
      return kennung ? eintragen('rolle', kennung) : null;
    },

    /** Ergebnis nach Vertrag; danach werden keine Ereignisse mehr angenommen. */
    abschluss({ geloest, punkte = 0, items = [] }) {
      if (ergebnis) return ergebnis;
      ergebnis = {
        geloest: !!geloest,
        punkte: Math.max(0, Math.round(punkte)),
        versuche,
        dauerSekunden: Math.round((jetzt() - beginn) / 1000),
        items: [...items],
        ereignisse: ereignisse.map((e) => ({ ...e })),
      };
      return ergebnis;
    },
  };
}

/**
 * Sterne 1–3 für ein gelöstes Spiel: 3 ohne Tipp und mit höchstens `glatt` Versuchen,
 * 2 mit höchstens einem Tipp und höchstens `gut` Versuchen, sonst 1. Nicht gelöst: 0.
 * Die Sterne sind nur Rückmeldung im Spiel; die App speichert und zeigt sie nicht (Schnittstelle 2.4).
 */
export function sterne({ geloest, versuche, hilfen, glatt = 1, gut = 3 }) {
  if (!geloest) return 0;
  if (hilfen === 0 && versuche <= glatt) return 3;
  if (hilfen <= 1 && versuche <= gut) return 2;
  return 1;
}
