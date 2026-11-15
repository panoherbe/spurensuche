// Vorführung ohne Server: dieselben Aufrufe wie HttpApi, nachgebildet im Browser (IndexedDB). Für die statische
// Seite (tools/statisch-bauen.js). Beispieldaten: eine Klasse 6 mit vier Gruppen, deren Spiele simuliert sind;
// die Gruppe mit dem Code DEMO-2026 ist leer und gehört dem Besuch, der sie in der Spieler-Ansicht spielt.
// Die Regeln (Bereinigung, Auswertung, Fristen) kommen aus denselben Kern-Modulen wie auf dem Server.

import { lies, schreibe, bild as ladeBild } from './speicher.js';
import { ladeInhalte, aufgabenVon } from './inhalte.js';
import { bereinigeEreignisse } from './kern/ereignisse.js';
import { beobachtungen, kompetenzraster, formulierungsentwurf } from './kern/raster.js';
import { pruefeBezeichnung } from './kern/namen.js';
import { loeschtermin, schuljahresende, datum } from './kern/zeit.js';
import { ApiFehler } from './api.js';

const SCHLUESSEL = 'vorfuehrung';
const STAND = 2;
const DEMO_CODE = 'DEMO-2026';
const jetzt = () => new Date().toISOString();
const id = () => crypto.randomUUID().slice(0, 12);

function zufall(saat) {
  let s = saat >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Simulierte Spielverläufe je Gruppe, nach festem Startwert (gleich bei jedem Aufruf). */
async function beispieldaten() {
  const inhalte = await ladeInhalte();
  const orte = [];
  for (const ort of inhalte.orte) orte.push({ ort: ort.id, aufgaben: ort.aufgaben, liste: await aufgabenVon(ort).catch(() => []) });
  const basis = Date.now() - 3 * 3600_000;
  const lg = { id: 'lg-beispiel', bezeichnung: 'Klasse 6a (Beispiel)', klassenstufe: 6, einwilligungAm: new Date(basis - 86400_000 * 3).toISOString(), erstellt: new Date(basis - 86400_000 * 7).toISOString() };
  lg.loeschenAm = schuljahresende(lg.erstellt);
  const quest = { id: 'quest-beispiel', lerngruppeId: lg.id, titel: 'Projekttag: Spurensuche Sachsen', zeitrahmen: 'projekttag', orte: orte.map(({ ort, aufgaben }) => ({ ort, aufgaben })), erfassung: true, rueckmeldung: true, erstellt: new Date(basis).toISOString(), beendet: null };
  quest.loeschenAm = loeschtermin({ begonnen: quest.erstellt });
  const profile = [
    { name: 'Biber', code: 'BIBR-4821', orte: orte.length, fehler: 0.2, hilfen: 0.15, wechsel: 0.85, einig: 0.8, saat: 11 },
    { name: 'Fuchs', code: 'FUCH-7310', orte: Math.max(1, orte.length - 1), fehler: 0.55, hilfen: 0.5, wechsel: 0.4, einig: 0.35, saat: 23 },
    { name: 'Luchs', code: 'LUCH-2954', orte: 1, fehler: 0.35, hilfen: 0.3, wechsel: 0.6, einig: 0.6, saat: 37, offen: true },
    { name: 'Eule', code: DEMO_CODE, orte: 0, saat: 41 },
  ];
  const d = { stand: STAND, angemeldet: false, lerngruppen: [lg], freigaben: [quest], gruppen: [], stationen: [], laeufe: [], technik: [], rueckmeldungen: [], bildbeitraege: [], eingang: [] };
  for (const p of profile) {
    const g = { id: `g-${p.name.toLowerCase()}`, freigabeId: quest.id, bezeichnung: p.name, code: p.code, einschaetzung: null, erstellt: quest.erstellt, letzteSync: null };
    d.gruppen.push(g);
    const r = zufall(p.saat);
    let t = basis + 10 * 60_000;
    for (const o of orte.slice(0, p.orte)) {
      const beginn = t;
      const laufListe = p.offen ? o.liste.slice(0, 1) : o.liste;
      for (const a of laufListe) {
        const ereignisse = [];
        let zeit = 20_000;
        const ev = (art, wert) => { ereignisse.push({ art, zeit, wert }); zeit += 15_000 + Math.round(r() * 30_000); };
        const rollen = Array.isArray(a.rollen) ? a.rollen : [];
        if (r() < p.hilfen) ev('hilfe', 1);
        if (a.stufe === 'beurteilen') {
          const wege = ['weg-a', 'weg-b', 'weg-c'].slice(0, 2 + Math.round(r()));
          for (const w of wege) { if (rollen.length) ev('rolle', rollen[Math.floor(r() * rollen.length)]); ev('weg', w); }
          ev('abstimmung', r() < p.einig ? 'einig' : 'mehrheit');
          ev('versuch', true);
        } else {
          const fehlversuche = r() < p.fehler ? 1 + Math.round(r()) : 0;
          for (let i = 0; i < fehlversuche; i++) {
            if (rollen.length) ev('rolle', rollen[Math.floor(r() * rollen.length)]);
            ev('versuch', false);
            ev('neuer-anlauf', r() < p.wechsel);
          }
          for (const rolle of rollen) if (r() < 0.8) ev('rolle', rolle);
          ev('versuch', true);
        }
        const dauer = Math.round(zeit / 1000);
        t += dauer * 1000 + 60_000;
        d.laeufe.push({ id: crypto.randomUUID(), gruppeId: g.id, aufgabe: `${o.ort}/${a.nr}`, geloest: true, versuche: ereignisse.filter((e) => e.art === 'versuch').length, dauerSekunden: dauer, items: a.belohnung ?? [], ereignisse, beendet: new Date(t).toISOString() });
      }
      const fertig = laufListe.length === o.liste.length;
      d.stationen.push({ gruppeId: g.id, ort: o.ort, status: fertig ? 'abgeschlossen' : 'begonnen', verifikation: r() < 0.5 ? 'qr' : 'ersatz', begonnen: new Date(beginn).toISOString(), beendet: fertig ? new Date(t).toISOString() : null, aktivSekunden: Math.round((t - beginn) / 1000 * 0.85) });
      t += 15 * 60_000;
    }
    if (p.orte) {
      d.technik.push({ gruppeId: g.id, schluessel: `${g.id}-off`, art: 'offline', zeit: new Date(basis + 40 * 60_000).toISOString() }, { gruppeId: g.id, schluessel: `${g.id}-sync`, art: 'sync', zeit: new Date(t).toISOString() });
      g.letzteSync = new Date(Math.min(t, Date.now() - 5 * 60_000)).toISOString();
    }
  }
  return d;
}

export class VorfuehrApi {
  constructor(konfiguration) {
    this.konfiguration = { ...konfiguration, anmeldung: { anmeldedienst: false, zugangsschluessel: false, attrappe: false } };
    this.vorfuehrung = true;
    this.zustand = null;
  }

  // Bei jedem Aufruf frisch aus dem Gerät lesen: Spieler- und Lehrkräfte-Ansicht laufen in getrennten Fenstern
  // und sehen so dieselben Daten (wie zwei Geräte an einem Server).
  async daten() {
    const gespeichert = await lies(SCHLUESSEL).catch(() => null);
    if (gespeichert?.stand === STAND) this.zustand = gespeichert;
    else {
      this.zustand = await beispieldaten();
      await this.speichern();
    }
    return this.zustand;
  }
  async speichern() { await schreibe(SCHLUESSEL, this.zustand).catch(() => {}); }
  fehler(status, meldung, daten) { return new ApiFehler(status, meldung, daten); }

  // --- Geräte ---
  async beitritt(code) {
    const d = await this.daten();
    const c = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const g = d.gruppen.find((x) => x.code.replace('-', '') === c);
    if (!g) throw this.fehler(404, 'Diesen Code gibt es nicht. In der Vorführung: DEMO-2026.');
    const f = d.freigaben.find((x) => x.id === g.freigabeId);
    return { token: `vorf-${g.id}`, gruppe: { bezeichnung: g.bezeichnung }, freigabe: { id: f.id, titel: f.titel, orte: f.orte, erfassung: f.erfassung, rueckmeldung: f.rueckmeldung } };
  }
  async geraet(token) {
    const d = await this.daten();
    const g = d.gruppen.find((x) => `vorf-${x.id}` === token);
    if (!g) throw this.fehler(410, 'Diese Gruppe gibt es nicht mehr.');
    const f = d.freigaben.find((x) => x.id === g.freigabeId);
    return { gruppe: { bezeichnung: g.bezeichnung }, freigabe: { id: f.id, titel: f.titel, orte: f.orte, erfassung: f.erfassung, rueckmeldung: f.rueckmeldung, beendet: f.beendet } };
  }
  async sync(token, k) {
    const d = await this.daten();
    const g = d.gruppen.find((x) => `vorf-${x.id}` === token);
    if (!g) throw this.fehler(410, 'Diese Gruppe gibt es nicht mehr.');
    const f = d.freigaben.find((x) => x.id === g.freigabeId);
    if (!f.erfassung) return { erfasst: false, erfassung: false };
    if (d.eingang.includes(k.schluessel)) return { erfasst: true, erfassung: true, doppelt: true };
    d.eingang.push(k.schluessel);
    const inhalte = await ladeInhalte();
    for (const s of k.stationen ?? []) {
      const alt = d.stationen.find((x) => x.gruppeId === g.id && x.ort === s.ort);
      if (alt) {
        alt.status = alt.status === 'abgeschlossen' ? 'abgeschlossen' : s.status;
        alt.verifikation = s.verifikation ?? alt.verifikation;
        alt.beendet = s.beendet ?? alt.beendet;
        alt.aktivSekunden = Math.max(alt.aktivSekunden, s.aktivSekunden ?? 0);
      } else d.stationen.push({ gruppeId: g.id, ort: s.ort, status: s.status, verifikation: s.verifikation ?? null, begonnen: s.begonnen, beendet: s.beendet ?? null, aktivSekunden: s.aktivSekunden ?? 0 });
    }
    for (const l of k.laeufe ?? []) {
      if (d.laeufe.some((x) => x.id === l.id)) continue;
      const [ort] = l.aufgabe.split('/');
      const ortDaten = inhalte.ortNach.get(ort);
      const aufgabe = ortDaten ? (await aufgabenVon(ortDaten)).find((a) => a.kennung === l.aufgabe) : null;
      const { ereignisse } = bereinigeEreignisse(l.ereignisse ?? [], { aufgabe });
      d.laeufe.push({ id: l.id, gruppeId: g.id, aufgabe: l.aufgabe, geloest: !!l.geloest, versuche: ereignisse.filter((e) => e.art === 'versuch').length, dauerSekunden: l.dauerSekunden ?? 0, items: (l.items ?? []).filter((i) => aufgabe?.belohnung?.includes(i)), ereignisse, beendet: l.beendet });
    }
    for (const t of k.technik ?? []) if (!d.technik.some((x) => x.gruppeId === g.id && x.schluessel === t.schluessel)) d.technik.push({ gruppeId: g.id, ...t });
    for (const r of k.rueckmeldungen ?? []) if (!d.rueckmeldungen.some((x) => x.id === r.id)) d.rueckmeldungen.push({ ...r, freigabeId: f.id, zeit: jetzt() });
    d.technik.push({ gruppeId: g.id, schluessel: `sync-${k.schluessel}`, art: 'sync', zeit: jetzt() });
    g.letzteSync = jetzt();
    await this.speichern();
    return { erfasst: true, erfassung: true, doppelt: false };
  }
  async bildbeitrag(daten, token) {
    const d = await this.daten();
    const g = token ? d.gruppen.find((x) => `vorf-${x.id}` === token) : null;
    const m = daten.metadaten;
    if (!d.bildbeitraege.some((b) => b.kennung === m.kennung)) {
      d.bildbeitraege.push({ kennung: m.kennung, gruppeId: g?.id ?? null, herkunft: g ? 'schule' : 'familie', art: m.art, items: m.items, erstellt: m.erstellt, status: g ? 'wartet' : 'freigegeben', entschieden: g ? null : jetzt() });
      await this.speichern();
    }
    return { kennung: m.kennung, status: g ? 'wartet' : 'freigegeben' };
  }

  // --- Anmeldung ---
  async ich() { const d = await this.daten(); return { rolle: d.angemeldet ? 'lehrkraft' : null, ueberAnmeldedienst: false }; }
  async anmeldenMitSchluessel() { const d = await this.daten(); d.angemeldet = true; await this.speichern(); return { rolle: 'lehrkraft' }; }
  async abmelden() { const d = await this.daten(); d.angemeldet = false; await this.speichern(); return { abgemeldet: true, weiter: null }; }
  anmeldedienstUrl() { return '#'; }

  // --- Lehrkräfte ---
  erfassungFuer(lg) {
    if (!(lg.klassenstufe >= 4 && lg.klassenstufe <= 8)) return { erfassung: false, grund: 'Diese Lerngruppe gehört nicht zu den Klassenstufen 4 bis 8. Die Gruppen spielen ohne Auswertung; es entstehen keine Beobachtungsdaten.' };
    if (!lg.einwilligungAm) return { erfassung: false, grund: 'Die Einwilligungen der Erziehungsberechtigten sind noch nicht bestätigt. Bis dahin entstehen keine Beobachtungsdaten.' };
    return { erfassung: true, grund: 'Beobachtungen werden auf Gruppenebene erfasst.' };
  }
  async lerngruppen() {
    const d = await this.daten();
    return d.lerngruppen.map((lg) => ({
      ...lg, klassen4bis8: lg.klassenstufe >= 4 && lg.klassenstufe <= 8, erfassung: this.erfassungFuer(lg),
      freigaben: d.freigaben.filter((f) => f.lerngruppeId === lg.id).map((f) => ({ id: f.id, titel: f.titel, zeitrahmen: f.zeitrahmen, erstellt: f.erstellt, beendet: f.beendet, loeschenAm: f.loeschenAm, erfassung: f.erfassung, gruppen: d.gruppen.filter((g) => g.freigabeId === f.id).length })),
    }));
  }
  async lerngruppeAnlegen(k) {
    const d = await this.daten();
    const name = String(k.bezeichnung ?? '').trim();
    if (name.length < 2) throw this.fehler(400, 'Bezeichnung: 2 bis 40 Zeichen, z. B. „Klasse 6a“');
    const lg = { id: id(), bezeichnung: name, klassenstufe: k.klassenstufe ?? null, einwilligungAm: k.einwilligung ? jetzt() : null, erstellt: jetzt() };
    lg.loeschenAm = schuljahresende(lg.erstellt);
    d.lerngruppen.unshift(lg);
    await this.speichern();
    return { id: lg.id };
  }
  async lerngruppeAendern(lgId, k) {
    const d = await this.daten();
    const lg = d.lerngruppen.find((x) => x.id === lgId);
    if ('bezeichnung' in k) lg.bezeichnung = String(k.bezeichnung).trim();
    if ('klassenstufe' in k) lg.klassenstufe = k.klassenstufe;
    if ('einwilligung' in k) lg.einwilligungAm = k.einwilligung ? (lg.einwilligungAm ?? jetzt()) : null;
    const e = this.erfassungFuer(lg);
    for (const f of d.freigaben.filter((x) => x.lerngruppeId === lgId && !x.beendet)) f.erfassung = e.erfassung;
    await this.speichern();
    return { ok: true, erfassung: e };
  }
  async lerngruppeLoeschen(lgId) {
    const d = await this.daten();
    for (const f of d.freigaben.filter((x) => x.lerngruppeId === lgId)) await this.questLoeschen(f.id, false);
    d.lerngruppen = d.lerngruppen.filter((x) => x.id !== lgId);
    await this.speichern();
    return { geloescht: true };
  }
  async questFreigeben(lgId, k) {
    const d = await this.daten();
    const lg = d.lerngruppen.find((x) => x.id === lgId);
    if (!k.orte?.length) throw this.fehler(400, 'Bitte 1 bis 15 Orte wählen');
    const f = { id: id(), lerngruppeId: lgId, titel: String(k.titel ?? '').trim() || 'Quest', zeitrahmen: k.zeitrahmen ?? 'eigen', orte: k.orte, erfassung: this.erfassungFuer(lg).erfassung, rueckmeldung: !!k.rueckmeldung, erstellt: jetzt(), beendet: null };
    f.loeschenAm = loeschtermin({ begonnen: f.erstellt });
    d.freigaben.unshift(f);
    await this.speichern();
    return { id: f.id, erfassung: this.erfassungFuer(lg) };
  }
  async quest(questId) {
    const d = await this.daten();
    const f = d.freigaben.find((x) => x.id === questId);
    if (!f) throw this.fehler(404, 'Quest nicht gefunden');
    const lg = d.lerngruppen.find((x) => x.id === f.lerngruppeId);
    const inhalte = await ladeInhalte();
    const orte = [];
    for (const { ort, aufgaben } of f.orte) {
      const o = inhalte.ortNach.get(ort);
      const liste = o ? await aufgabenVon(o, aufgaben).catch(() => []) : [];
      orte.push({ ort, name: o?.name ?? ort, region: o?.region ?? '', aufgaben: liste.map((a) => ({ nr: a.nr, titel: a.titel, format: a.format, dauerMinuten: a.dauerMinuten, stufe: a.stufe })) });
    }
    const gruppen = d.gruppen.filter((g) => g.freigabeId === f.id).map((g) => {
      const st = d.stationen.filter((x) => x.gruppeId === g.id);
      const l = d.laeufe.filter((x) => x.gruppeId === g.id).map((x) => x.aufgabe);
      return {
        id: g.id, bezeichnung: g.bezeichnung, code: g.code, erstellt: g.erstellt, letzteSync: g.letzteSync,
        aktuell: st.filter((x) => x.status === 'begonnen').sort((a, b) => (b.begonnen > a.begonnen ? 1 : -1))[0]?.ort ?? null,
        stationen: f.orte.map(({ ort, aufgaben }) => ({ ort, status: st.find((x) => x.ort === ort)?.status ?? 'offen', aufgabenFertig: l.filter((a) => a.startsWith(`${ort}/`) && aufgaben.includes(a.split('/')[1])).length, aufgaben: aufgaben.length })),
      };
    });
    return { id: f.id, titel: f.titel, zeitrahmen: f.zeitrahmen, lerngruppe: { id: lg.id, bezeichnung: lg.bezeichnung, klassenstufe: lg.klassenstufe }, erfassung: f.erfassung, rueckmeldung: f.rueckmeldung, erstellt: f.erstellt, beendet: f.beendet, loeschenAm: f.loeschenAm, orte, gruppen, bildbeitraegeWartend: d.bildbeitraege.filter((b) => b.status === 'wartet' && gruppen.some((g) => g.id === b.gruppeId)).length };
  }
  async questBeenden(questId) {
    const d = await this.daten();
    const f = d.freigaben.find((x) => x.id === questId);
    f.beendet = jetzt();
    f.loeschenAm = loeschtermin({ abgeschlossen: f.beendet, begonnen: f.erstellt });
    await this.speichern();
    return { beendet: f.beendet };
  }
  async questLoeschen(questId, speichern = true) {
    const d = await this.daten();
    for (const g of d.gruppen.filter((x) => x.freigabeId === questId)) await this.gruppeLoeschen(g.id, false);
    d.freigaben = d.freigaben.filter((x) => x.id !== questId);
    if (speichern) await this.speichern();
    return { geloescht: true };
  }
  async gruppeAnlegen(questId, k) {
    const d = await this.daten();
    const p = pruefeBezeichnung(k.bezeichnung);
    if (!p.ok) throw this.fehler(400, p.fehler);
    if (p.hinweis && k.bestaetigt !== true) throw this.fehler(409, p.hinweis, { hinweis: p.hinweis, bestaetigen: true });
    if (d.gruppen.some((g) => g.freigabeId === questId && g.bezeichnung.toLowerCase() === p.name.toLowerCase())) throw this.fehler(409, 'Diese Bezeichnung gibt es in der Quest schon');
    const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const zufallsCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => zeichen[b % zeichen.length]).join('').replace(/^(.{4})/, '$1-');
    const g = { id: id(), freigabeId: questId, bezeichnung: p.name, code: zufallsCode(), einschaetzung: null, erstellt: jetzt(), letzteSync: null };
    d.gruppen.push(g);
    await this.speichern();
    return { id: g.id, bezeichnung: g.bezeichnung, code: g.code };
  }
  async gruppeAendern(gruppeId, k) {
    const d = await this.daten();
    const g = d.gruppen.find((x) => x.id === gruppeId);
    if ('bezeichnung' in k) {
      const p = pruefeBezeichnung(k.bezeichnung);
      if (!p.ok) throw this.fehler(400, p.fehler);
      if (p.hinweis && k.bestaetigt !== true) throw this.fehler(409, p.hinweis, { hinweis: p.hinweis, bestaetigen: true });
      g.bezeichnung = p.name;
    }
    if ('einschaetzung' in k) g.einschaetzung = k.einschaetzung;
    await this.speichern();
    return { ok: true };
  }
  async gruppeLoeschen(gruppeId, speichern = true) {
    const d = await this.daten();
    d.gruppen = d.gruppen.filter((x) => x.id !== gruppeId);
    d.stationen = d.stationen.filter((x) => x.gruppeId !== gruppeId);
    d.laeufe = d.laeufe.filter((x) => x.gruppeId !== gruppeId);
    d.technik = d.technik.filter((x) => x.gruppeId !== gruppeId);
    d.bildbeitraege = d.bildbeitraege.filter((b) => b.gruppeId !== gruppeId || b.status === 'freigegeben').map((b) => (b.gruppeId === gruppeId ? { ...b, gruppeId: null } : b));
    if (speichern) await this.speichern();
    return { geloescht: true };
  }
  async auswertung(gruppeId) {
    const d = await this.daten();
    const g = d.gruppen.find((x) => x.id === gruppeId);
    if (!g) throw this.fehler(404, 'Gruppe nicht gefunden');
    const f = d.freigaben.find((x) => x.id === g.freigabeId);
    const inhalte = await ladeInhalte();
    const aufgabenInfo = new Map();
    for (const ort of inhalte.orte) for (const a of await aufgabenVon(ort).catch(() => [])) aufgabenInfo.set(a.kennung, a);
    const daten = {
      stationen: d.stationen.filter((x) => x.gruppeId === g.id).map((s) => ({ ...s, ortName: inhalte.ortNach.get(s.ort)?.name ?? s.ort })),
      laeufe: d.laeufe.filter((x) => x.gruppeId === g.id).sort((a, b) => (a.beendet < b.beendet ? -1 : 1)).map((l) => {
        const a = aufgabenInfo.get(l.aufgabe);
        return { ...l, ort: l.aufgabe.split('/')[0], titel: a?.titel ?? l.aufgabe, format: a?.format ?? null, stufe: a?.stufe ?? null, rollen: a?.rollen ?? null };
      }),
      technik: d.technik.filter((x) => x.gruppeId === g.id),
      bildbeitrag: d.bildbeitraege.find((b) => b.gruppeId === g.id) ?? null,
    };
    const einschaetzung = g.einschaetzung ?? {};
    const raster = kompetenzraster(daten, einschaetzung);
    return {
      gruppe: { id: g.id, bezeichnung: g.bezeichnung }, quest: f.titel, erfassung: f.erfassung, loeschenAm: f.loeschenAm,
      beobachtungen: beobachtungen(daten), raster, einschaetzung,
      entwurf: formulierungsentwurf(raster, { gruppe: g.bezeichnung, quest: f.titel, datum: datum(daten.laeufe.at(-1)?.beendet ?? g.erstellt) }),
      stand: daten.laeufe.at(-1)?.beendet ?? null,
    };
  }
  async bildbeitraege(questId) {
    const d = await this.daten();
    const gruppen = d.gruppen.filter((g) => g.freigabeId === questId);
    return d.bildbeitraege.filter((b) => gruppen.some((g) => g.id === b.gruppeId)).map((b) => ({ ...b, gruppe: gruppen.find((g) => g.id === b.gruppeId).bezeichnung }));
  }
  async bildbeitraegeEntscheiden(kennungen, freigeben) {
    const d = await this.daten();
    let n = 0;
    for (const b of d.bildbeitraege) if (kennungen.includes(b.kennung)) { b.status = freigeben ? 'freigegeben' : 'abgelehnt'; b.entschieden = jetzt(); n++; }
    await this.speichern();
    return { geaendert: n };
  }
  async vorschauUrl(eintrag) {
    const b = await ladeBild(eintrag.kennung).catch(() => null);
    return b ? URL.createObjectURL(b.vorschau) : 'app/bilder/symbol.svg';
  }
  async rueckmeldungenCsv(questId) {
    const d = await this.daten();
    const zeilen = d.rueckmeldungen.filter((r) => r.freigabeId === questId);
    return `aufgabe,verstaendlich,spass,schwierigkeit,zeit\n${zeilen.map((z) => [z.aufgabe, z.verstaendlich ?? '', z.spass ?? '', z.schwierigkeit ?? '', z.zeit].join(',')).join('\n')}\n`;
  }
  rueckmeldungenCsvUrl() { return '#'; }

  /** Setzt die Vorführung auf die Beispieldaten zurück. */
  async zuruecksetzen() { this.zustand = await beispieldaten(); await this.speichern(); }

  // --- Betrieb (nachgebildet: keine echte Anwendung dahinter; die Seite sagt das oben) ---

  async betrieb() {
    let b = await lies(BETRIEB).catch(() => null);
    if (b?.stand !== 1) {
      const t = Date.now();
      const nacht = (tage) => { const d = new Date(t - tage * 86400_000); d.setHours(2, 0, 0, 0); return d; };
      const sicherung = (d) => ({ datei: `spurensuche-${stempel(d)}.db.enc`, art: 'taeglich', stempel: stempel(d), bytes: 1_400_000 + Math.round(d.getDate() * 9000), zeit: d.toISOString() });
      b = {
        stand: 1, angemeldet: false, gestartet: new Date(t - 3 * 86400_000 - 4 * 3600_000).toISOString(), neustartBis: 0,
        sicherungen: [0, 1, 2].map((n) => sicherung(nacht(n))).filter((x) => Date.parse(x.zeit) < t),
        inhalt: { paket: 'mitgeliefert', vorher: null, seit: null, pakete: [] },
        auftraege: [], protokoll: [{ zeit: new Date(t - 3 * 86400_000 - 4 * 3600_000).toISOString(), rolle: 'system', aktion: 'start', ziel: this.konfiguration.version }],
      };
      await schreibe(BETRIEB, b).catch(() => {});
    }
    return b;
  }
  async betriebSpeichern(b) { await schreibe(BETRIEB, b).catch(() => {}); }
  async betriebMerken(b, aktion, ziel = null, rolle = 'betrieb') { b.protokoll.unshift({ zeit: jetzt(), rolle, aktion, ziel }); await this.betriebSpeichern(b); }

  async ichBetrieb() { return { rolle: (await this.betrieb()).angemeldet ? 'betrieb' : null }; }
  async anmeldenBetrieb(schluessel) {
    if (String(schluessel ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') !== 'BETRIEBDEMO') throw this.fehler(401, 'Schlüssel falsch');
    const b = await this.betrieb();
    b.angemeldet = true;
    await this.betriebMerken(b, 'anmeldung');
    return { rolle: 'betrieb' };
  }
  async abmeldenBetrieb() { const b = await this.betrieb(); b.angemeldet = false; await this.betriebSpeichern(b); return { abgemeldet: true }; }
  async angemeldetBetrieb() { const b = await this.betrieb(); if (!b.angemeldet) throw this.fehler(401, 'Bitte mit dem Betriebsschlüssel anmelden'); return b; }

  async status() {
    const b = await this.betrieb();
    if (b.neustartBis && Date.now() < b.neustartBis) throw this.fehler(0, 'Keine Verbindung');
    if (b.neustartBis) { b.neustartBis = 0; b.gestartet = jetzt(); await this.betriebMerken(b, 'start', this.konfiguration.version, 'system'); }
    return { ok: true, version: this.konfiguration.version, installiert: this.konfiguration.version, gestartet: b.gestartet, betrieb: { zustand: 'gut', anmeldedienst: 'gut', inhalte: 'gut' } };
  }

  async betriebZustand() {
    const b = await this.angemeldetBetrieb();
    const inhalte = await ladeInhalte();
    const t = Date.now();
    const letzte = b.sicherungen[0]?.zeit;
    const stunden = letzte ? Math.max(1, Math.round((t - Date.parse(letzte)) / 3600_000)) : null;
    const reihe = beispielVerlauf(t);
    const letzte15 = reihe.slice(-3).reduce((a, r) => a + r.anfragen, 0);
    const p = (id, titel, wert, text) => ({ id, titel, stufe: 'gut', wert, text, tun: null });
    const name = b.inhalt.paket === 'mitgeliefert' ? 'mitgelieferter Inhalt' : b.inhalt.pakete.find((x) => x.id === b.inhalt.paket)?.name ?? 'Inhaltspaket';
    return {
      gesamt: 'gut', ueberschrift: 'Alles in Ordnung', geprueft: jetzt(),
      punkte: [
        p('anwendung', 'Anwendung', `Version ${this.konfiguration.version}, läuft seit ${Math.max(1, Math.round((t - Date.parse(b.gestartet)) / 86400_000))} Tagen`, 'Die Anwendung antwortet.'),
        p('datenbank', 'Datenbank', '1,4 MB', 'Die Datenbank ist in Ordnung (Prüfung alle 10 Minuten).'),
        p('sicherung', 'Sicherung', stunden ? `vor ${stunden} Stunden, ${b.sicherungen.length} Sicherungen vorhanden` : 'noch keine', 'Die Datenbank wird jede Nacht verschlüsselt gesichert.'),
        p('speicherplatz', 'Speicherplatz', '31,2 GB frei von 40 GB', 'Platz für Datenbank, Sicherungen und Inhaltspakete.'),
        p('fehler', 'Fehler in den letzten 15 Minuten', `0 von ${letzte15.toLocaleString('de-DE')} Anfragen (0 %)`, 'Anfragen, bei denen in der Anwendung ein Fehler auftrat.'),
        p('antwortzeit', 'Antwortzeit', '95 von 100 Antworten in höchstens 25 ms', 'So lange warten Nutzende höchstens auf eine Antwort.'),
        p('arbeitsspeicher', 'Arbeitsspeicher', '96 MB von 2 GB', 'Speicher, den die Anwendung gerade belegt.'),
        p('anmeldedienst', 'Anmeldung über das Schulkonto', `erreichbar (geprüft ${new Date(t - 120_000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr)`, 'Der Anmeldedienst der Schulen antwortet.'),
        p('inhalte', 'Inhalte', `${name}: ${inhalte.orte.length} Orte, ${inhalte.aufgaben?.length ?? inhalte.orte.reduce((n, o) => n + o.aufgaben.length, 0)} Aufgaben`, 'Die Inhalte sind vollständig und geprüft.'),
        p('betriebsdienst', 'Betriebsdienst am Server', 'meldet sich (vor 4 Sekunden)', 'Er kann die letzte Version zurückspielen und startet die Anwendung neu, wenn sie hängt.'),
        p('zertifikat', 'Zertifikat (https)', `gültig bis ${datum(new Date(t + 61 * 86400_000).toISOString())}`, 'Das Zertifikat für die verschlüsselte Verbindung ist gültig.'),
      ],
      version: { anwendung: this.konfiguration.version, installiert: this.konfiguration.version, vorher: 'Vorversion (nachgebildet)', schema: 2, gestartet: b.gestartet },
      knoepfe: { neustart: true, sicherung: true, versionZurueck: true },
      kontakt: null, verlauf: reihe, auftraege: b.auftraege.slice(0, 5),
    };
  }
  async betriebProtokoll() { return (await this.angemeldetBetrieb()).protokoll.slice(0, 100); }

  async neustart() {
    const b = await this.angemeldetBetrieb();
    b.neustartBis = Date.now() + 2600;
    await this.betriebMerken(b, 'neustart');
    return { ok: true, gestartet: b.gestartet };
  }
  async sicherungen() { return { schluessel: true, liste: (await this.angemeldetBetrieb()).sicherungen }; }
  async sicherungAnlegen() {
    const b = await this.angemeldetBetrieb();
    const d = new Date();
    const neu = { datei: `spurensuche-${stempel(d)}-hand.db.enc`, art: 'hand', stempel: stempel(d), bytes: 1_402_368, zeit: d.toISOString() };
    b.sicherungen.unshift(neu);
    await this.betriebMerken(b, 'sicherung-angelegt', neu.datei);
    return { ok: true, datei: neu.datei, bytes: neu.bytes, dauerMs: 180 };
  }
  async zurueckspielen(datei) {
    const b = await this.angemeldetBetrieb();
    if (!b.sicherungen.some((x) => x.datei === datei)) throw this.fehler(404, 'Diese Sicherung gibt es nicht');
    const d = new Date();
    const sicherheit = { datei: `spurensuche-${stempel(d)}-vor-zurueckspielen.db.enc`, art: 'vor-zurueckspielen', stempel: stempel(d), bytes: 1_402_368, zeit: d.toISOString() };
    b.sicherungen.unshift(sicherheit);
    b.neustartBis = Date.now() + 3200;
    await this.betriebMerken(b, 'zurueckspielen-vorgemerkt', datei);
    return { ok: true, datei, sicherheit: sicherheit.datei, neustart: true };
  }

  async inhaltStand() {
    const b = await this.angemeldetBetrieb();
    const inhalte = await ladeInhalte();
    const name = (id) => (id === 'mitgeliefert' ? 'mitgelieferter Inhalt' : b.inhalt.pakete.find((x) => x.id === id)?.name ?? id);
    return {
      aktiv: { paket: b.inhalt.paket, name: name(b.inhalt.paket), seit: b.inhalt.seit, orte: inhalte.orte.map((o) => o.name), aufgaben: inhalte.orte.reduce((n, o) => n + o.aufgaben.length, 0), inhaltVersion: this.konfiguration.inhaltVersion },
      vorher: b.inhalt.vorher, vorherName: b.inhalt.vorher ? name(b.inhalt.vorher) : null, pakete: b.inhalt.pakete,
    };
  }
  async inhaltPruefen(datei) {
    const b = await this.angemeldetBetrieb();
    const name = String(datei?.name ?? 'inhalt.zip').slice(0, 60);
    if (!/\.zip$/i.test(name)) return { ok: false, name, fehler: [{ datei: name, pfad: '/', meldung: 'Die Datei ist kein ZIP-Archiv.' }], anzahlFehler: 1 };
    const inhalte = await ladeInhalte();
    const paket = { id: stempel(new Date()), name, hochgeladen: jetzt(), dateien: 87, bytes: datei.size ?? 0, orte: inhalte.orte.map((o) => o.name), aufgaben: inhalte.orte.reduce((n, o) => n + o.aufgaben.length, 0), sammelstuecke: inhalte.items?.length ?? 16 };
    b.inhalt.pakete.unshift(paket);
    await this.betriebMerken(b, 'inhaltspaket-geprueft', paket.id);
    return { ok: true, paket, warnungen: ['Vorführung: Der Inhalt wurde hier nicht wirklich geprüft. Auf dem Server prüft die Anwendung Aufbau, Dateitypen, Pflichtfelder und Verweise jeder Datei.'] };
  }
  async inhaltAktivieren(paket) {
    const b = await this.angemeldetBetrieb();
    if (paket !== 'mitgeliefert' && !b.inhalt.pakete.some((x) => x.id === paket)) throw this.fehler(404, 'Dieses Inhaltspaket gibt es nicht (mehr)');
    const vorher = b.inhalt.paket;
    b.inhalt = { ...b.inhalt, paket, vorher: vorher === paket ? b.inhalt.vorher : vorher, seit: jetzt() };
    await this.betriebMerken(b, 'inhalt-aktiviert', paket);
    const inhalte = await ladeInhalte();
    return { ok: true, aktiv: paket, vorher, orte: inhalte.orte.length, aufgaben: inhalte.orte.reduce((n, o) => n + o.aufgaben.length, 0) };
  }
  async versionZurueck() {
    const b = await this.angemeldetBetrieb();
    const a = { id: b.auftraege.length + 1, aktion: 'version-zurueck', status: 'laeuft', erstellt: jetzt(), begonnen: jetzt(), erledigt: null, meldung: null, fertigAb: Date.now() + 7000 };
    b.auftraege.unshift(a);
    await this.betriebMerken(b, 'version-zurueck-beauftragt', `${this.konfiguration.version} → Vorversion (nachgebildet)`);
    return { ok: true, auftrag: a.id, von: this.konfiguration.version, auf: 'Vorversion (nachgebildet)' };
  }
  async auftrag(nummer) {
    const b = await this.angemeldetBetrieb();
    const a = b.auftraege.find((x) => x.id === Number(nummer));
    if (!a) throw this.fehler(404, 'Auftrag nicht gefunden');
    const rest = a.fertigAb - Date.now();
    if (a.status === 'laeuft' && rest <= 0) {
      Object.assign(a, { status: 'fertig', erledigt: jetzt(), meldung: 'Nachgebildet: Auf einem Server liefe jetzt die Version davor.' });
      await this.betriebMerken(b, 'auftrag-erledigt', `${a.id}: Vorversion`, 'system');
    } else if (a.status === 'laeuft' && rest < 4500) throw this.fehler(0, 'Keine Verbindung'); // Neustart mit der anderen Version
    const { fertigAb, ...sichtbar } = a;
    return sichtbar;
  }
}

const BETRIEB = 'vorfuehrung-betrieb';
const zwei = (n) => String(n).padStart(2, '0');
function stempel(d) { return `${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}-${zwei(d.getHours())}${zwei(d.getMinutes())}${zwei(d.getSeconds())}`; }

/** Nachgebildeter Verlauf der letzten 24 Stunden: Schultage zwischen 8 und 15 Uhr mit Betrieb, sonst wenig. */
function beispielVerlauf(t) {
  const reihe = [];
  const r = zufall(7);
  const ende = Math.floor(t / 300_000) * 300_000;
  for (let i = 287; i >= 0; i--) {
    const zeit = new Date(ende - i * 300_000);
    const stunde = zeit.getHours() + zeit.getMinutes() / 60;
    const schultag = zeit.getDay() >= 1 && zeit.getDay() <= 5;
    const betrieb = schultag && stunde >= 8 && stunde < 15 ? Math.sin(((stunde - 8) / 7) * Math.PI) : 0;
    const anfragen = Math.round(6 + r() * 10 + betrieb * (420 + r() * 160));
    reihe.push({ zeit: zeit.toISOString(), anfragen, fehler: 0, p95: betrieb > 0.2 ? 25 : 10, sync: Math.round(anfragen / 12), gruppen: Math.round(betrieb * (40 + r() * 12)), speicher: 96, cpu: Math.round(1 + betrieb * 9) });
  }
  return reihe;
}
