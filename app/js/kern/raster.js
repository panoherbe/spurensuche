// Auswertung für Lehrkräfte: Beobachtungen einer Gruppe, Kompetenzraster und Formulierungsentwürfe.
//
// Grundsätze, die dieser Code umsetzt:
// - nur Gruppenebene: Eingabe ist immer eine Gruppe, nie eine Person;
// - keine Note, keine Punktzahl, kein Prozentwert als Gesamturteil, keine Rangfolge zwischen Gruppen;
// - Vorgehen vor Ergebnis: Versuche, Hilfen, Wechsel des Vorgehens, Lösungswege, Rollen und Abstimmungen;
// - das Raster schlägt nur vor; die Einschätzung trifft die Lehrkraft.
//
// Die Stufen folgen der Stufenfolge der sächsischen Lehrpläne.

export const STUFEN = Object.freeze([
  { id: 'einblick', name: 'Einblick gewinnen' },
  { id: 'kennen', name: 'Kennen' },
  { id: 'anwenden', name: 'Anwenden' },
  { id: 'beurteilen', name: 'Beurteilen / Sich positionieren' },
  { id: 'gestalten', name: 'Gestalten' },
]);

export const BEREICHE = Object.freeze([
  { id: 'teamleistung', name: 'Teamleistung' },
  { id: 'problemloesung', name: 'Problemlösung' },
  { id: 'beteiligung', name: 'Beteiligung' },
]);

const RANG = Object.fromEntries(STUFEN.map((s, i) => [s.id, i + 1]));
export const stufeName = (id) => STUFEN.find((s) => s.id === id)?.name ?? id;
export const bereichName = (id) => BEREICHE.find((b) => b.id === id)?.name ?? id;

/** Ausformulierte Beschreibung je Bereich und Stufe (Rasteransicht, Gegenwart). */
export const BESCHREIBUNG = Object.freeze({
  teamleistung: {
    einblick: 'Die Gruppe beginnt Stationen und macht sich mit dem Ablauf vertraut.',
    kennen: 'Die Gruppe schließt einzelne Aufgaben gemeinsam ab.',
    anwenden: 'Die Gruppe schließt Stationen vollständig ab und behält die Abfolge im Blick.',
    beurteilen: 'Die Gruppe bringt Aufgaben mit offenen Entscheidungen gemeinsam zu einem Ergebnis.',
    gestalten: 'Die Gruppe gestaltet gemeinsam ein eigenes Ergebnis, etwa den Bildbeitrag.',
  },
  problemloesung: {
    einblick: 'Die Gruppe probiert Lösungen aus.',
    kennen: 'Die Gruppe löst Aufgaben, in denen sie Wissen abruft.',
    anwenden: 'Die Gruppe wendet Wissen auf neue Aufgaben an und ändert nach einem Fehlversuch ihr Vorgehen.',
    beurteilen: 'Die Gruppe wägt mehrere Lösungswege gegeneinander ab.',
    gestalten: 'Die Gruppe entwickelt eigenständig Lösungen und nutzt Hilfen gezielt.',
  },
  beteiligung: {
    einblick: 'Einzelne Rollen der Gruppe bringen Eingaben ein.',
    kennen: 'Mehrere Rollen bringen Eingaben ein.',
    anwenden: 'Alle vorgesehenen Rollen bringen Eingaben ein.',
    beurteilen: 'Die Gruppe nutzt Abstimmungen für gemeinsame Entscheidungen.',
    gestalten: 'Die Gruppe kommt in Abstimmungen meist zu einer einigen Entscheidung.',
  },
});

/** Dieselben Aussagen in der Vergangenheit, für Formulierungsentwürfe. */
const FORMULIERUNG = Object.freeze({
  teamleistung: {
    einblick: 'Die Gruppe begann Stationen und machte sich mit dem Ablauf vertraut.',
    kennen: 'Die Gruppe schloss einzelne Aufgaben gemeinsam ab.',
    anwenden: 'Die Gruppe schloss Stationen vollständig ab und behielt die Abfolge im Blick.',
    beurteilen: 'Die Gruppe brachte Aufgaben mit offenen Entscheidungen gemeinsam zu einem Ergebnis.',
    gestalten: 'Die Gruppe gestaltete gemeinsam ein eigenes Ergebnis, etwa den Bildbeitrag.',
  },
  problemloesung: {
    einblick: 'Die Gruppe probierte Lösungen aus.',
    kennen: 'Die Gruppe löste Aufgaben, in denen sie Wissen abrief.',
    anwenden: 'Die Gruppe wendete Wissen auf neue Aufgaben an und änderte nach einem Fehlversuch ihr Vorgehen.',
    beurteilen: 'Die Gruppe wog mehrere Lösungswege gegeneinander ab.',
    gestalten: 'Die Gruppe entwickelte eigenständig Lösungen und nutzte Hilfen gezielt.',
  },
  beteiligung: {
    einblick: 'Einzelne Rollen der Gruppe brachten Eingaben ein.',
    kennen: 'Mehrere Rollen brachten Eingaben ein.',
    anwenden: 'Alle vorgesehenen Rollen brachten Eingaben ein.',
    beurteilen: 'Die Gruppe nutzte Abstimmungen für gemeinsame Entscheidungen.',
    gestalten: 'Die Gruppe kam in Abstimmungen meist zu einer einigen Entscheidung.',
  },
});

/** Möglicher nächster Schritt, je Bereich und erreichter Stufe (ganze Sätze für den Entwurf). */
const NAECHSTER_SCHRITT = Object.freeze({
  teamleistung: {
    einblick: 'Als nächster Schritt bietet sich an, eine Station gemeinsam bis zur letzten Aufgabe zu begleiten.',
    kennen: 'Als nächster Schritt bietet sich an, eine ganze Station gemeinsam abzuschließen.',
    anwenden: 'Als nächster Schritt bietet sich an, Aufgaben mit offenen Entscheidungen gemeinsam zu einem Ergebnis zu bringen.',
    beurteilen: 'Als nächster Schritt bietet sich an, gemeinsam ein eigenes Ergebnis zu gestalten.',
  },
  problemloesung: {
    einblick: 'Als nächster Schritt bieten sich Aufgaben an, in denen die Gruppe gezielt Wissen abruft.',
    kennen: 'Als nächster Schritt bieten sich Aufgaben an, in denen die Gruppe ihr Wissen auf eine neue Lage anwendet.',
    anwenden: 'Als nächster Schritt bieten sich Aufgaben mit mehreren Lösungswegen an, die die Gruppe vergleicht.',
    beurteilen: 'Als nächster Schritt bieten sich Aufgaben an, in denen die Gruppe eigene Lösungen entwickelt.',
  },
  beteiligung: {
    einblick: 'Als nächster Schritt bietet sich an, die Rollen bewusst zu wechseln, damit mehrere Rollen Eingaben machen.',
    kennen: 'Als nächster Schritt bietet sich an, jede vorgesehene Rolle zu Wort kommen zu lassen.',
    anwenden: 'Als nächster Schritt bietet sich an, Entscheidungen mit der Abstimmung gemeinsam zu treffen.',
    beurteilen: 'Als nächster Schritt bietet sich an, in Abstimmungen gemeinsam zu einer einigen Entscheidung zu finden.',
  },
});

// --- Hilfen für die Läufe ---------------------------------------------------------------------------------------

const rang = (lauf) => RANG[lauf.stufe] ?? 0;
const arten = (lauf, art) => (lauf.ereignisse ?? []).filter((e) => e.art === art);
const titel = (lauf) => `„${lauf.titel ?? lauf.aufgabe}“`;
const rollenMitEingabe = (lauf) => new Set(arten(lauf, 'rolle').map((e) => e.wert));
const wegeVerschieden = (lauf) => new Set(arten(lauf, 'weg').map((e) => e.wert));
const wechselNachFehler = (lauf) => arten(lauf, 'neuer-anlauf').some((e) => e.wert === true);

function zaehle(n, einzahl, mehrzahl) {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`;
}

function minuten(sekunden) {
  const m = Math.round((sekunden ?? 0) / 60);
  return m < 1 ? 'unter 1 Minute' : zaehle(m, 'Minute', 'Minuten');
}

// --- Beobachtungen (Gruppenansicht) ------------------------------------------------------------------------------

/**
 * Fasst die Beobachtungen einer Gruppe beschreibend zusammen, gegliedert nach Teamleistung, Problemlösung und
 * Beteiligung. `gruppe` = `{ stationen: [...], laeufe: [...], technik: [...], bildbeitrag }` (siehe docs/DATENSCHUTZ.md).
 */
export function beobachtungen(gruppe) {
  const stationen = gruppe.stationen ?? [];
  const laeufe = gruppe.laeufe ?? [];
  const technik = gruppe.technik ?? [];

  const abgeschlossen = stationen.filter((s) => s.status === 'abgeschlossen');
  const abgebrochen = stationen.filter((s) => s.status === 'abgebrochen');
  const laufend = stationen.filter((s) => s.status === 'begonnen');
  const geloest = laeufe.filter((l) => l.geloest);
  const aktivSekunden = stationen.reduce((summe, s) => summe + (s.aktivSekunden ?? 0), 0);

  const teamleistung = {
    saetze: [],
    stationen: stationen.map((s) => ({
      ort: s.ort, ortName: s.ortName ?? s.ort, status: s.status, verifikation: s.verifikation ?? null,
      begonnen: s.begonnen ?? null, beendet: s.beendet ?? null, aktivMinuten: Math.round((s.aktivSekunden ?? 0) / 60),
    })),
  };
  if (!stationen.length) teamleistung.saetze.push('Die Gruppe hat noch keine Station begonnen.');
  else {
    teamleistung.saetze.push(`${zaehle(abgeschlossen.length, 'Station', 'Stationen')} abgeschlossen`
      + (abgebrochen.length ? `, ${zaehle(abgebrochen.length, 'Station', 'Stationen')} abgebrochen` : '')
      + (laufend.length ? `, ${zaehle(laufend.length, 'Station', 'Stationen')} in Arbeit` : '') + '.');
    teamleistung.saetze.push(`${zaehle(geloest.length, 'Aufgabe', 'Aufgaben')} gelöst bzw. entschieden, ${zaehle(laeufe.length, 'Aufgabe', 'Aufgaben')} bearbeitet.`);
    const vorOrt = stationen.filter((s) => ['qr', 'code', 'gps'].includes(s.verifikation)).length;
    const ersatz = stationen.filter((s) => s.verifikation === 'ersatz').length;
    if (vorOrt || ersatz) teamleistung.saetze.push(`${zaehle(vorOrt, 'Station', 'Stationen')} vor Ort, ${zaehle(ersatz, 'Station', 'Stationen')} ortsunabhängig gespielt.`);
  }
  if (gruppe.bildbeitrag) teamleistung.saetze.push('Die Gruppe hat einen Bildbeitrag gestaltet.');

  const proAufgabe = laeufe.map((l) => ({
    aufgabe: l.aufgabe, titel: l.titel ?? l.aufgabe, stufe: l.stufe ?? null, geloest: !!l.geloest,
    versuche: arten(l, 'versuch').length,
    fehlversuche: arten(l, 'versuch').filter((e) => e.wert === false).length,
    hilfen: arten(l, 'hilfe').map((e) => ({ zeitSekunden: Math.round(e.zeit / 1000), wert: e.wert })),
    neuerAnlauf: { ja: arten(l, 'neuer-anlauf').filter((e) => e.wert === true).length, nein: arten(l, 'neuer-anlauf').filter((e) => e.wert === false).length },
    wege: arten(l, 'weg').map((e) => e.wert),
  }));
  const problemloesung = { saetze: [], aufgaben: proAufgabe };
  if (laeufe.length) {
    const ersterVersuch = proAufgabe.filter((a) => a.geloest && a.versuche === 1).length;
    const mitFehler = proAufgabe.filter((a) => a.fehlversuche > 0);
    const hilfen = proAufgabe.reduce((s, a) => s + a.hilfen.length, 0);
    const ja = proAufgabe.reduce((s, a) => s + a.neuerAnlauf.ja, 0);
    const nein = proAufgabe.reduce((s, a) => s + a.neuerAnlauf.nein, 0);
    problemloesung.saetze.push(`${zaehle(ersterVersuch, 'Aufgabe', 'Aufgaben')} im ersten Versuch gelöst; in ${zaehle(mitFehler.length, 'Aufgabe', 'Aufgaben')} gab es Fehlversuche.`);
    if (ja + nein) problemloesung.saetze.push(`Nach einem Fehlversuch hat die Gruppe ${ja}-mal ihr Vorgehen gewechselt und ${nein}-mal dasselbe noch einmal versucht.`);
    problemloesung.saetze.push(hilfen ? `${zaehle(hilfen, 'Hilfe', 'Hilfen')} genutzt.` : 'Keine Hilfe genutzt.');
    const mitWegen = proAufgabe.filter((a) => a.wege.length > 0);
    if (mitWegen.length) problemloesung.saetze.push(`In ${zaehle(mitWegen.length, 'Aufgabe', 'Aufgaben')} mit mehreren Wegen gewählt: ${mitWegen.map((a) => `„${a.titel}“ (${a.wege.join(' → ')})`).join('; ')}.`);
  } else problemloesung.saetze.push('Noch keine Aufgabe bearbeitet.');

  const eingabenJeRolle = {};
  let einig = 0;
  let mehrheit = 0;
  for (const l of laeufe) {
    for (const e of arten(l, 'rolle')) eingabenJeRolle[e.wert] = (eingabenJeRolle[e.wert] ?? 0) + 1;
    einig += arten(l, 'abstimmung').filter((e) => e.wert === 'einig').length;
    mehrheit += arten(l, 'abstimmung').filter((e) => e.wert === 'mehrheit').length;
  }
  const beteiligung = { saetze: [], eingabenJeRolle, abstimmungen: { einig, mehrheit } };
  const rollen = Object.entries(eingabenJeRolle);
  if (rollen.length) beteiligung.saetze.push(`Eingaben je Rolle: ${rollen.map(([r, n]) => `${rollenName(r)} ${n}`).join(', ')}.`);
  else beteiligung.saetze.push('Keine Eingaben einer Rolle erfasst.');
  if (einig + mehrheit) beteiligung.saetze.push(`${zaehle(einig + mehrheit, 'Abstimmung', 'Abstimmungen')}: ${einig} einig, ${mehrheit} mit Mehrheit.`);

  const offline = technik.filter((t) => t.art === 'offline').length;
  const syncs = technik.filter((t) => t.art === 'sync').map((t) => t.zeit).sort();
  return {
    teamleistung,
    problemloesung,
    beteiligung,
    kontext: { aktiveMinuten: Math.round(aktivSekunden / 60), satz: `Aktive Bearbeitungszeit: ${minuten(aktivSekunden)}.` },
    technik: {
      offlinePhasen: offline,
      letzteSynchronisation: syncs.at(-1) ?? null,
      satz: offline ? `${zaehle(offline, 'Phase', 'Phasen')} ohne Netz; Daten danach übertragen.` : 'Durchgehend mit Netz oder noch nicht übertragen.',
    },
  };
}

export function rollenName(id) {
  const namen = {
    navigation: 'Navigation', protokoll: 'Protokoll', recherche: 'Recherche', sprecher: 'Sprecher', material: 'Material', zeit: 'Zeit',
    vorlesen: 'Vorlesen', steuern: 'Steuern', nachschlagen: 'Nachschlagen', pruefen: 'Prüfen',
  };
  return namen[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

// --- Kompetenzraster -----------------------------------------------------------------------------------------------

/** Belege je Bereich und Stufe, nach festen, offen dokumentierten Regeln (docs/AUSWERTUNG.md). */
function belege(gruppe) {
  const b = Object.fromEntries(BEREICHE.map((x) => [x.id, Object.fromEntries(STUFEN.map((s) => [s.id, []]))]));
  const stationen = gruppe.stationen ?? [];
  const laeufe = gruppe.laeufe ?? [];
  const name = (s) => `„${s.ortName ?? s.ort}“`;

  // Teamleistung
  for (const s of stationen.filter((x) => x.status && x.status !== 'offen')) b.teamleistung.einblick.push(`Station ${name(s)} begonnen`);
  for (const l of laeufe.filter((x) => x.geloest)) b.teamleistung.kennen.push(`Aufgabe ${titel(l)} abgeschlossen`);
  for (const s of stationen.filter((x) => x.status === 'abgeschlossen')) b.teamleistung.anwenden.push(`Station ${name(s)} vollständig abgeschlossen`);
  for (const l of laeufe.filter((x) => x.geloest && x.stufe === 'beurteilen')) b.teamleistung.beurteilen.push(`Entscheidungsaufgabe ${titel(l)} gemeinsam abgeschlossen`);
  for (const l of laeufe.filter((x) => x.geloest && x.stufe === 'gestalten')) b.teamleistung.gestalten.push(`Gestaltungsaufgabe ${titel(l)} abgeschlossen`);
  if (gruppe.bildbeitrag) b.teamleistung.gestalten.push('Bildbeitrag gemeinsam gestaltet');

  // Problemlösung
  for (const l of laeufe.filter((x) => arten(x, 'versuch').length > 0)) b.problemloesung.einblick.push(`In ${titel(l)} ${zaehle(arten(l, 'versuch').length, 'Lösung', 'Lösungen')} ausprobiert`);
  for (const l of laeufe.filter((x) => x.geloest && rang(x) >= 2)) b.problemloesung.kennen.push(`${titel(l)} gelöst (Aufgabe zum ${stufeName(l.stufe)})`);
  for (const l of laeufe.filter((x) => x.geloest && rang(x) >= 3)) {
    const v = arten(l, 'versuch').length;
    if (v === 1) b.problemloesung.anwenden.push(`${titel(l)} im ersten Versuch gelöst`);
    else if (wechselNachFehler(l)) b.problemloesung.anwenden.push(`${titel(l)} gelöst, nach einem Fehlversuch das Vorgehen gewechselt`);
  }
  for (const l of laeufe.filter((x) => x.geloest && rang(x) >= 4 && wegeVerschieden(x).size >= 2)) {
    b.problemloesung.beurteilen.push(`In ${titel(l)} ${wegeVerschieden(l).size} Lösungswege abgewogen`);
  }
  for (const l of laeufe.filter((x) => x.geloest && rang(x) === 5 && arten(x, 'hilfe').length <= 1)) {
    b.problemloesung.gestalten.push(`${titel(l)} eigenständig gelöst (${arten(l, 'hilfe').length === 0 ? 'ohne Hilfe' : 'eine Hilfe'})`);
  }

  // Beteiligung
  const alleRollen = new Set();
  for (const l of laeufe) for (const r of rollenMitEingabe(l)) alleRollen.add(r);
  for (const r of alleRollen) b.beteiligung.einblick.push(`Eingaben der Rolle ${rollenName(r)}`);
  for (const l of laeufe.filter((x) => rollenMitEingabe(x).size >= 2)) b.beteiligung.kennen.push(`In ${titel(l)} Eingaben aus ${rollenMitEingabe(l).size} Rollen`);
  for (const l of laeufe.filter((x) => Array.isArray(x.rollen) && x.rollen.length >= 2 && x.rollen.every((r) => rollenMitEingabe(x).has(r)))) {
    b.beteiligung.anwenden.push(`In ${titel(l)} Eingaben aus allen ${l.rollen.length} Rollen`);
  }
  let abstimmungen = 0;
  let einig = 0;
  for (const l of laeufe) {
    const a = arten(l, 'abstimmung');
    if (a.length) b.beteiligung.beurteilen.push(`In ${titel(l)} ${zaehle(a.length, 'Abstimmung', 'Abstimmungen')} genutzt`);
    abstimmungen += a.length;
    einig += a.filter((e) => e.wert === 'einig').length;
  }
  if (abstimmungen >= 2 && einig * 2 >= abstimmungen) b.beteiligung.gestalten.push(`${abstimmungen} Abstimmungen, davon ${einig} einig`);
  return b;
}

/**
 * Kompetenzraster einer Gruppe: je Bereich alle fünf Stufen mit Beschreibung und Belegen, dazu ein Vorschlag
 * (höchste Stufe mit Beleg). `einschaetzung` ist die Wahl der Lehrkraft und geht dem Vorschlag vor.
 */
export function kompetenzraster(gruppe, einschaetzung = {}) {
  const b = belege(gruppe);
  return {
    stufen: STUFEN,
    zeilen: BEREICHE.map((bereich) => {
      const zellen = STUFEN.map((s) => ({ stufe: s.id, name: s.name, beschreibung: BESCHREIBUNG[bereich.id][s.id], belege: b[bereich.id][s.id] }));
      const mitBeleg = zellen.filter((z) => z.belege.length > 0);
      const vorschlag = mitBeleg.length ? mitBeleg.at(-1).stufe : null;
      const gewaehlt = STUFEN.some((s) => s.id === einschaetzung[bereich.id]) ? einschaetzung[bereich.id] : null;
      return { bereich: bereich.id, name: bereich.name, zellen, vorschlag, einschaetzung: gewaehlt, stufe: gewaehlt ?? vorschlag };
    }),
  };
}

/**
 * Formulierungsentwurf für eine Verbaleinschätzung auf Grundlage der Stufen. Immer als Entwurf gekennzeichnet;
 * die Lehrkraft bearbeitet ihn vor dem Export.
 */
export function formulierungsentwurf(raster, { gruppe, quest, datum }) {
  const zeilen = [`Entwurf – Grundlage: Beobachtungen der Gruppe „${gruppe}“ bei der Quest „${quest}“ am ${datum}. Bitte prüfen und anpassen.`];
  for (const z of raster.zeilen) {
    if (!z.stufe) { zeilen.push(`${z.name}: noch keine Beobachtung.`); continue; }
    const weiter = NAECHSTER_SCHRITT[z.bereich][z.stufe];
    zeilen.push(`${z.name} (Stufe „${stufeName(z.stufe)}“): ${FORMULIERUNG[z.bereich][z.stufe]}${weiter ? ` ${weiter}` : ''}`);
  }
  return zeilen.join('\n\n');
}
