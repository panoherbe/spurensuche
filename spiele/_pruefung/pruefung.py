"""Messlauf der Spiele: jede Aufgabe per Tastatur durchspielen, in jedem Zustand axe-core prüfen, Bilder machen.

Läuft im Playwright-Container (Python) gegen einen statischen Server, der den Repo-Stand ausliefert:
    python3 pruefung.py --basis http://127.0.0.1:8737 --repo /repo --aus /aus --axe /werkzeug/axe.min.js

Je Lauf (Aufgabe × Gerät × Einstellung × Browser):
  1. Startkarte: axe, Foto. „Los geht’s“ per Tastatur (Fokus + Eingabetaste).
  2. Spielfläche: axe, Foto; ein Tipp, axe; ein falscher Versuch, axe (Rückmeldung).
  3. Lösen nur mit der Tastatur (Pfeiltasten, Leertaste, Eingabe, Ziffern); axe vor dem Abschluss.
  4. Abschlusskarte: axe, Foto; „Weiter“ → Ergebnis aus window.spielTest (Schema, Ereignisse, Belohnung).
Alle Personen sind simuliert: Ein Skript drückt die Tasten. Schreibt messwerte.json und bilder/*.png.
"""

import argparse
import json
import platform
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

GERAETE = {
    "desktop": {"viewport": {"width": 1280, "height": 800}},
    "tablet": {"viewport": {"width": 800, "height": 1280}, "has_touch": True},
    "telefon": {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True},
    "ipad": {"viewport": {"width": 820, "height": 1180}, "has_touch": True},  # iPad hochkant (Air, 10. Generation)
    "klein": {"viewport": {"width": 320, "height": 640}, "is_mobile": True, "has_touch": True},  # kleinstes Telefon
}
EINSTELLUNGEN = {
    "standard": {},
    "einfach": {"sprache": "einfach"},
    "kontrast": {"kontrast": "1"},
    "dunkel": {"dunkel": "1"},
    "ruhig-langsam": {"ruhig": "1", "tempo": "0.5"},
}
AXE_REGELN = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

# Überlauf: Text, der über den Rand seines Kastens läuft oder dort abgeschnitten wird (axe sieht das nicht).
# Für jeden sichtbaren Textknoten werden seine Zeilenrechtecke mit den umgebenden Kästen verglichen, bis zum
# ersten Kasten mit eigener Bildlaufleiste. Dazu: waagerechter Bildlauf der ganzen Seite.
UEBERLAUF_JS = """() => {
  const wurzel = document.querySelector('.sp-spiel') || document.body;
  const name = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).join('.') : '');
  const funde = [];
  const bereich = document.createRange();
  const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  for (let n = gang.nextNode(); n; n = gang.nextNode()) {
    const text = n.textContent.trim();
    const el = n.parentElement;
    if (!text || !el || el.closest('svg, .sp-unsichtbar, [hidden]')) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ visibilityProperty: true })) continue;
    bereich.selectNodeContents(n);
    let fund = null;
    for (const r of bereich.getClientRects()) {
      if (r.width < 1) continue;
      for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
        const st = getComputedStyle(a);
        if (st.display === 'inline' || st.display === 'contents') continue;
        const b = a.getBoundingClientRect();
        const ueber = Math.max(r.right - b.right, b.left - r.left);
        if (ueber > 1) { fund = { text: text.slice(0, 40), kasten: name(a), px: Math.round(ueber) }; break; }
        if (st.overflowX === 'auto' || st.overflowX === 'scroll') break;
      }
      if (fund) break;
    }
    if (fund) funde.push(fund);
  }
  const seite = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
  return { seite, anzahl: funde.length + (seite > 1 ? 1 : 0), stellen: funde.slice(0, 12) };
}"""
# Breiten-Durchlauf der Startkarten. Die Spalten der Startkarte richten sich nach der Breite der Karte
# (Container-Abfrage), nicht nach dem Fenster; viele Fensterbreiten decken damit auch jeden Rahmen der App ab.
BREITEN = [320, 360, 390, 600, 680, 744, 768, 800, 820, 900, 1024, 1180, 1280]
IPAD_BREITEN = [744, 768, 820, 1024, 1180]  # WebKit: iPad mini, iPad, iPad Air hochkant; iPad und Air quer


def lies(repo, aufgabe):
    ort, nr = aufgabe.split("/")
    return json.loads((Path(repo) / "inhalte" / ort / f"{nr}.json").read_text(encoding="utf-8"))


def alle_aufgaben(repo):
    orte = json.loads((Path(repo) / "inhalte" / "orte.json").read_text(encoding="utf-8"))["orte"]
    liste = []
    for ort in orte:
        daten = json.loads((Path(repo) / "inhalte" / ort / "ort.json").read_text(encoding="utf-8"))
        liste += [f"{ort}/{nr}" for nr in daten["aufgaben"]]
    return liste


def warte_bis(seite, ausdruck, timeout=10000):
    """Wartet, bis ausdruck (JavaScript) wahr ist. Abfrage über das DevTools-Protokoll statt wait_for_function:
    Die strenge CSP der Seite verbietet eval, das wait_for_function zum Abfragen braucht."""
    ende = time.perf_counter() + timeout / 1000
    while time.perf_counter() < ende:
        if seite.evaluate(f"() => Boolean({ausdruck})"):
            return
        seite.wait_for_timeout(100)
    raise TimeoutError(f"Zeitüberschreitung beim Warten auf: {ausdruck}")


class Lauf:
    def __init__(self, seite, axe_quelle, name, bilder, fotos):
        self.seite, self.axe_quelle, self.name, self.bilder, self.fotos = seite, axe_quelle, name, bilder, fotos
        self.axe = {}
        self.ueberlauf = {}
        self.schritte = []

    def ruhe(self):
        for _ in range(2):  # zweimal: Übergänge, die erst nach einem Bild starten, werden so mit abgewartet
            self.seite.wait_for_timeout(150)
            self.seite.evaluate("""() => Promise.all(document.getAnimations()
                .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
                .map((a) => a.finished.catch(() => null)))""")

    def pruefe(self, zustand, foto=True):
        self.ruhe()
        if not self.seite.evaluate("typeof axe !== 'undefined'"):
            # Über das DevTools-Protokoll, nicht als <script>: Die strenge CSP der Seite bleibt für die Spiele aktiv.
            self.seite.evaluate("() => {" + self.axe_quelle + "\n;return typeof axe;}")
        ergebnis = self.seite.evaluate(
            """(regeln) => axe.run(document, { runOnly: regeln, resultTypes: ['violations'], preload: false })
                .then((r) => r.violations.map((v) => ({ id: v.id, auswirkung: v.impact, stellen: v.nodes.length,
                    beispiel: v.nodes[0]?.target?.join(' '), hilfe: v.help })))""",
            AXE_REGELN,
        )
        self.axe[zustand] = ergebnis
        self.seite.evaluate("() => document.fonts.ready.then(() => true)")
        self.ueberlauf[zustand] = self.seite.evaluate(UEBERLAUF_JS)
        if foto and self.fotos:
            self.seite.screenshot(path=str(self.bilder / f"{self.name}-{zustand}.png"), full_page=True, caret="initial")
        return ergebnis

    def taste(self, locator, taste="Enter"):
        """Bedienelement per Tastatur auslösen: fokussieren, dann Taste drücken (kein Mausklick)."""
        locator.focus()
        self.seite.keyboard.press(taste)
        self.schritte.append(taste)


# ---------- Lösen je Format, nur mit der Tastatur ----------

def spiele_bildpuzzle(lauf, aufgabe):
    s = lauf.seite
    tipp = s.locator(".sp-knopf--tipp")
    lauf.taste(tipp)
    lauf.pruefe("tipp")
    lauf.taste(s.get_by_role("button", name="Prüfen"))
    s.wait_for_selector(".sp-ansage--hinweis")
    lauf.pruefe("rueckmeldung")
    # Pfeiltasten wandern über die Teile (Fokus folgt)
    erste = s.locator(".sp-kachel").first
    erste.focus()
    s.keyboard.press("ArrowRight")
    assert s.evaluate("document.activeElement.classList.contains('sp-kachel')"), "Pfeiltaste verlässt das Puzzle"
    # Auswahl-Tausch: für jeden Platz das richtige Teil holen (Leertaste wählt, Leertaste tauscht)
    anzahl = aufgabe["raster"]["spalten"] * aufgabe["raster"]["zeilen"]
    for platz in range(anzahl):
        lage = s.evaluate("() => [...document.querySelectorAll('.sp-kachel')].map((k) => Number(k.dataset.teil))")
        if lage[platz] == platz:
            continue
        von = lage.index(platz)
        lauf.taste(s.locator(".sp-kachel").nth(von), " ")
        lauf.taste(s.locator(".sp-kachel").nth(platz), " ")
        s.wait_for_timeout(50)
        if s.locator(".sp-puzzle--fertig").count():
            break
    s.wait_for_selector(".sp-puzzle--fertig")
    lauf.pruefe("geloest")
    lauf.taste(s.get_by_role("button", name="Weiter"))


def spiele_schaetzen(lauf, aufgabe):
    s = lauf.seite
    lauf.taste(s.locator("[data-weg='schaetzrunde']"))
    feld = s.locator(".sp-runde .sp-zahl")
    for wert in (aufgabe["bereich"]["min"] + aufgabe["bereich"]["schritt"], aufgabe["antwort"] * 2):
        feld.focus()
        s.keyboard.type(str(wert).replace(".", ","))
        s.keyboard.press("Enter")
    lauf.pruefe("schaetzrunde")
    lauf.taste(s.get_by_role("button", name="Weiter: gemeinsam einigen"))
    s.wait_for_selector(".sp-einigen")
    regler = s.locator(".sp-regler")
    regler.focus()
    s.keyboard.press("End")  # ganz nach oben: weit daneben
    s.keyboard.press("ArrowLeft")
    lauf.pruefe("einigen")
    lauf.taste(s.get_by_role("button", name="Die Mehrheit ist dafür"))
    s.wait_for_selector(".sp-ansage--hinweis")
    lauf.pruefe("rueckmeldung")
    lauf.taste(s.locator(".sp-knopf--tipp"))
    lauf.pruefe("tipp")
    feld = s.locator(".sp-einigen .sp-zahl")
    feld.focus()
    s.keyboard.press("Control+A")
    s.keyboard.type(str(aufgabe["antwort"]).replace(".", ","))
    s.keyboard.press("Tab")
    lauf.taste(s.get_by_role("button", name="Alle sind einverstanden"))
    s.wait_for_selector(".sp-aufloesung")
    lauf.pruefe("aufloesung")
    lauf.taste(s.get_by_role("button", name="Weiter"))


def haupt(lauf):
    """Der Hauptknopf unten rechts (Weiter, Auswerten, Abgeben …)."""
    return lauf.seite.locator(".sp-aktionen .sp-knopf--haupt").last


def spiele_dilemma(lauf, aufgabe):
    s = lauf.seite
    lauf.taste(haupt(lauf))                      # Lesen → Meinungen
    s.wait_for_selector(".sp-meinungen")
    lauf.pruefe("meinungen")
    lauf.taste(haupt(lauf))                      # Meinungen → Abstimmen
    s.wait_for_selector(".sp-optionen")
    plus = s.locator(".sp-stimmen .sp-knopf").filter(has=s.locator(".sp-symbol"))
    a, b = aufgabe["optionen"][0], aufgabe["optionen"][1]
    lauf.taste(s.get_by_role("button", name="eine Stimme mehr für A"))
    lauf.taste(s.get_by_role("button", name="eine Stimme mehr für A"))
    lauf.taste(s.get_by_role("button", name="eine Stimme mehr für B"))
    lauf.pruefe("abstimmen")
    lauf.taste(haupt(lauf))                      # Auswerten → Begründen (A gewinnt 2:1)
    s.wait_for_selector(".sp-argumente")
    falsch = next(x for x in aufgabe["argumente"] if x["fuer"] != a["id"])
    richtig = next(x for x in aufgabe["argumente"] if x["fuer"] == a["id"])
    lauf.taste(s.locator(f"[data-argument='{falsch['id']}']"))
    lauf.taste(haupt(lauf))                      # unpassende Begründung
    s.wait_for_selector(".sp-ansage--hinweis")
    lauf.pruefe("begruendung-hinweis")
    lauf.taste(s.locator(f"[data-argument='{falsch['id']}']"))
    lauf.taste(s.locator(f"[data-argument='{richtig['id']}']"))
    lauf.taste(haupt(lauf))                      # passende Begründung → Gegenseite
    s.wait_for_selector(".sp-ansage--gut")
    lauf.pruefe("gegenseite")
    lauf.taste(s.locator(".sp-argument").first)
    lauf.taste(haupt(lauf))                      # → Folgen
    s.wait_for_selector(".sp-wirklich")
    lauf.taste(s.locator(".sp-andere summary"))
    lauf.pruefe("folgen")
    lauf.taste(haupt(lauf))


def spiele_sortieren(lauf, aufgabe):
    s = lauf.seite
    pruefen = s.get_by_role("button", name="Prüfen")
    if aufgabe["art"] == "reihenfolge":
        lauf.taste(pruefen)
        s.wait_for_selector(".sp-ansage--hinweis")
        lauf.pruefe("rueckmeldung")
        richtig = [k["id"] for k in aufgabe["karten"]]
        for platz, kid in enumerate(richtig):
            while True:
                reihe = s.evaluate("() => [...document.querySelectorAll('.sp-liste [data-karte]')].map((e) => e.dataset.karte)")
                if reihe.index(kid) <= platz:
                    break
                lauf.taste(s.locator(f".sp-liste [data-karte='{kid}'] .sp-pfeile .sp-knopf").first)
                s.wait_for_timeout(30)
        lauf.taste(pruefen)
    else:
        karten = aufgabe["karten"]
        gruppen = {g["id"]: g["titel"]["standard"] for g in aufgabe["gruppen"]}
        erste, zweite = karten[0], karten[1]
        lauf.taste(s.locator(f".sp-chip[data-karte='{erste['id']}']"))
        lauf.taste(s.get_by_role("button", name=f"Hierher legen: {gruppen[zweite['gruppe']]}"))
        lauf.taste(pruefen)
        s.wait_for_selector(".sp-ansage--hinweis")
        lauf.pruefe("rueckmeldung")
        for karte in karten:
            lauf.taste(s.locator(f".sp-chip[data-karte='{karte['id']}']"))
            lauf.taste(s.get_by_role("button", name=f"Hierher legen: {gruppen[karte['gruppe']]}"))
        lauf.pruefe("zugeordnet")
        if pruefen.count():  # nach einem früheren Prüfen löst das Spiel beim letzten richtigen Ablegen selbst
            lauf.taste(pruefen)
    s.wait_for_selector(".sp-ansage--gut")
    lauf.pruefe("geloest")
    lauf.taste(s.get_by_role("button", name="Weiter"))


def spiele_bildsuche(lauf, aufgabe):
    s = lauf.seite
    sp, ze = aufgabe["raster"]["spalten"], aufgabe["raster"]["zeilen"]

    def trifft_feld(x, y):
        fx, fy, fb, fh = x / sp, y / ze, 1 / sp, 1 / ze
        return any(fx < b["x"] + b["b"] and b["x"] < fx + fb and fy < b["y"] + b["h"] and b["y"] < fy + fh
                   for z in aufgabe["ziele"] for b in z["bereiche"])

    leer = next((x, y) for y in range(ze) for x in range(sp) if not trifft_feld(x, y))
    pos = [0, 0]
    s.locator(".sp-feld").first.focus()

    def gehe(x, y):
        while pos[0] < x: s.keyboard.press("ArrowRight"); pos[0] += 1
        while pos[0] > x: s.keyboard.press("ArrowLeft"); pos[0] -= 1
        while pos[1] < y: s.keyboard.press("ArrowDown"); pos[1] += 1
        while pos[1] > y: s.keyboard.press("ArrowUp"); pos[1] -= 1
        s.keyboard.press("Enter")
        lauf.schritte.append("Enter")

    gehe(*leer)
    s.wait_for_selector(".sp-ansage--hinweis")
    lauf.pruefe("fehlklick")
    lauf.taste(s.locator(".sp-knopf--tipp"))
    lauf.taste(s.locator(".sp-knopf--tipp"))
    lauf.pruefe("tipp")
    s.locator(".sp-feld").nth(pos[1] * sp + pos[0]).focus()
    for ziel in aufgabe["ziele"]:
        if s.locator(".sp-abschluss").count() or s.locator(".sp-ansage--gut").count() and s.locator(".sp-suche .sp-ziel--gefunden").count() == len(aufgabe["ziele"]):
            break
        b = ziel["bereiche"][0]
        x = min(sp - 1, int((b["x"] + b["b"] / 2) * sp))
        y = min(ze - 1, int((b["y"] + b["h"] / 2) * ze))
        s.locator(".sp-feld").nth(pos[1] * sp + pos[0]).focus()
        gehe(x, y)
        s.wait_for_timeout(60)
    s.wait_for_selector(".sp-suche .sp-ziel--gefunden >> nth=" + str(len(aufgabe["ziele"]) - 1))
    lauf.pruefe("geloest")
    lauf.taste(s.get_by_role("button", name="Weiter"))


LOESER = {"bildpuzzle": spiele_bildpuzzle, "schaetzen": spiele_schaetzen, "dilemma": spiele_dilemma, "sortieren": spiele_sortieren, "bildsuche": spiele_bildsuche}


COLLAGEN = [
    ("kreis", "mittel", "sommer", "basteibruecke,felsturm,kuppel,turmkreuz,goeltzschtalbruecke,ortsschild"),
    ("raster", "klein", "sandstein", "basteibruecke,felsturm,wanderschuh,alter-stein,kuppel,turmkreuz,dampflok,ziegel,lot"),
    ("wirbel", "gross", "abend", "basteibruecke,felsturm,wanderschuh,alter-stein,kuppel,turmkreuz,dampflok,goeltzschtalbruecke,ziegel,ortsschild,schiefer-turm,lot"),
    ("stapel", "mittel", "nacht", "schiefer-turm,ortsschild,lot,dampflok"),
    ("kreis", "gross", "morgen", "kuppel"),
]


def collage_laeufe(browser, basis, aus, axe_quelle, wiederholungen=5):
    """Collage im Headless-Browser: je Einstellung ein Bild in 2048 × 2048 (Dauer, Größen, Metadaten, axe)."""
    import base64
    ergebnisse = []
    for nr, (anordnung, groesse, farbe, items) in enumerate(COLLAGEN):
        kontext = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
        seite = kontext.new_page()
        lauf = Lauf(seite, axe_quelle, f"collage-{nr + 1}-{anordnung}-{farbe}", aus / "bilder", True)
        seite.goto(f"{basis}/spiele/_vorschau/collage.html?items={items}&anordnung={anordnung}&groesse={groesse}&farbstimmung={farbe}")
        warte_bis(seite, "document.getElementById('cl-vorschau').src.startsWith('blob:')", 20000)
        lauf.pruefe("auswahl")
        dauer = []
        for i in range(wiederholungen if nr == 0 else 1):
            seite.evaluate("window.collageTest.fertig = false")
            lauf.taste(seite.locator("#cl-erzeugen"))
            warte_bis(seite, "window.collageTest.fertig", 60000)
            dauer.append(seite.evaluate("window.collageTest.dauerMs"))
        lauf.pruefe("fertig")
        test = seite.evaluate("window.collageTest")
        # FileReader statt fetch: Die CSP der Seite (connect-src) erlaubt kein fetch auf blob:-Adressen.
        daten = seite.evaluate("() => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(window.collagePng); })")
        (aus / "collagen").mkdir(exist_ok=True)
        (aus / "collagen" / f"collage-{nr + 1}-{anordnung}-{groesse}-{farbe}.png").write_bytes(base64.b64decode(daten))
        m = test["metadaten"]
        ergebnisse.append({
            "anordnung": anordnung, "groesse": groesse, "farbstimmung": farbe, "anzahl": len(items.split(",")),
            "dauerMs": dauer, "png": test["png"], "vorschau": test["vorschau"],
            "metadatenFelder": sorted(m.keys()), "art": m["art"], "itemsInMetadaten": len(m["items"]),
            "kennungIstUuid": bool(__import__("re").match(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", m["kennung"])),
            "erstelltMitZeitzone": m["erstellt"].endswith("Z"),
            "axe": lauf.axe, "axeVerstoesse": sum(len(v) for v in lauf.axe.values()),
            "ueberlaufStellen": sum(w["anzahl"] for w in lauf.ueberlauf.values()),
        })
        print(json.dumps({k: ergebnisse[-1][k] for k in ("anordnung", "farbstimmung", "anzahl", "dauerMs", "png", "axeVerstoesse")}, ensure_ascii=False), flush=True)
        kontext.close()
    return ergebnisse


def figur_laeufe(browser, basis, aus, axe_quelle):
    """Figur-Baukasten: axe auf Desktop und Telefon, Bedienung nur mit der Tastatur, gesperrte Teile bleiben gesperrt."""
    ergebnisse = []
    for geraet in ("desktop", "telefon"):
        kontext = browser.new_context(**GERAETE[geraet], device_scale_factor=1)
        seite = kontext.new_page()
        lauf = Lauf(seite, axe_quelle, f"figur-{geraet}", aus / "bilder", True)
        seite.goto(f"{basis}/spiele/_vorschau/figur.html")
        seite.wait_for_selector(".sp-figur-baukasten svg")
        lauf.pruefe("baukasten")
        seite.locator("input[name='frisur']:checked").focus()
        seite.keyboard.press("ArrowRight")            # kurz → Locken
        seite.locator("input[name='kopfbedeckung']:checked").focus()
        for _ in range(4):
            seite.keyboard.press("ArrowRight")        # … → Kletterhelm (frei durch Abzeichen Bastei)
        seite.locator("input[name='begleiter']:checked").focus()
        seite.keyboard.press("ArrowLeft")             # rückwärts auf das letzte freie Teil: Uhu-Küken (frei durch Felsturm)
        gesperrt = seite.evaluate("() => [...document.querySelectorAll('.sp-figur-radio:disabled')].map((e) => e.value)")
        lauf.pruefe("gewaehlt")
        lauf.taste(seite.get_by_role("button", name="Fertig"))
        warte_bis(seite, "window.figurTest && window.figurTest.fertig", 10000)
        auswahl = seite.evaluate("window.figurTest.auswahl")
        ergebnisse.append({"geraet": geraet, "auswahl": auswahl, "gesperrt": gesperrt, "axe": lauf.axe, "axeVerstoesse": sum(len(v) for v in lauf.axe.values()),
                           "ueberlaufStellen": sum(w["anzahl"] for w in lauf.ueberlauf.values())})
        print(json.dumps({"figur": geraet, "auswahl": {k: auswahl.get(k) for k in ("frisur", "kopfbedeckung", "begleiter")}, "gesperrt": gesperrt, "axeVerstoesse": ergebnisse[-1]["axeVerstoesse"]}, ensure_ascii=False), flush=True)
        kontext.close()
    return ergebnisse


def breiten_laeufe(browser_fuer, basis, aufgaben, aus, fotos):
    """Startkarte jeder Aufgabe in vielen Fensterbreiten (Chromium) und in den iPad-Breiten (WebKit), in Standard- und
    einfacher Sprache: Überlauf je Probe. Bildschirmfoto der Startkarte frauenkirche/2 in 820 px (iPad hochkant)."""
    ergebnisse = []
    for browsername, breiten in (("chromium", BREITEN), ("webkit", IPAD_BREITEN)):
        for breite in breiten:
            kontext = browser_fuer(browsername).new_context(viewport={"width": breite, "height": 1180}, device_scale_factor=1)
            seite = kontext.new_page()
            for aufgabe in aufgaben:
                for einstellung in ("standard", "einfach"):
                    parameter = {"a": aufgabe, **EINSTELLUNGEN[einstellung]}
                    seite.goto(f"{basis}/spiele/_vorschau/spiel.html?" + "&".join(f"{k}={v}" for k, v in parameter.items()))
                    seite.wait_for_selector(".sp-start", timeout=15000)
                    Lauf(seite, "", "", aus / "bilder", False).ruhe()
                    seite.evaluate("() => document.fonts.ready.then(() => true)")
                    w = seite.evaluate(UEBERLAUF_JS)
                    ergebnisse.append({"browser": browsername, "breite": breite, "aufgabe": aufgabe, "einstellung": einstellung, **w})
                    if fotos and breite == 820 and aufgabe == "frauenkirche/2" and einstellung == "standard":
                        seite.screenshot(path=str(aus / "bilder" / f"breite-820-{browsername}-frauenkirche-2-start.png"), full_page=True, caret="initial")
            kontext.close()
            print(json.dumps({"breiten": browsername, "breite": breite, "proben": sum(1 for e in ergebnisse if e["browser"] == browsername and e["breite"] == breite),
                              "ueberlauf": sum(e["anzahl"] for e in ergebnisse if e["browser"] == browsername and e["breite"] == breite)}, ensure_ascii=False), flush=True)
    return ergebnisse


def konzeptbilder(browser, basis, aus):
    """Bilder für Konzept und README: 1280 × 800 bei doppelter Pixeldichte (2560 × 1600 px), nach allen Animationen."""
    ziel = aus / "konzept"
    ziel.mkdir(exist_ok=True)
    def seite_neu(groesse=(1280, 800)):
        k = browser.new_context(viewport={"width": groesse[0], "height": groesse[1]}, device_scale_factor=2)
        return k, k.new_page()
    def ruhig(s):
        for _ in range(2):
            s.wait_for_timeout(200)
            s.evaluate("() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null)))")
    def nur_spiel(s):
        # Nur das Spiel zeigen: Kopf und Protokoll der Testseite ausblenden (über das DevTools-Protokoll, nicht per Stil-Element)
        s.evaluate("() => { for (const e of document.querySelectorAll('.vs-kopf, .vs-protokoll')) e.style.setProperty('display', 'none'); }")
    bilder = []
    # 1 Schätzfrage in einfacher Sprache
    k, s = seite_neu()
    s.goto(f"{basis}/spiele/_vorschau/spiel.html?a=bastei/2&sprache=einfach")
    s.get_by_role("button", name="Los geht’s").click(); s.wait_for_selector(".sp-wahl")
    s.locator("[data-weg='gemeinsam']").click(); s.wait_for_selector(".sp-einigen")
    nur_spiel(s); ruhig(s); s.screenshot(path=str(ziel / "1-schaetzfrage-einfache-sprache.png")); bilder.append("1-schaetzfrage-einfache-sprache.png"); k.close()
    # 2 Dilemma: Begründen
    k, s = seite_neu()
    s.goto(f"{basis}/spiele/_vorschau/spiel.html?a=frauenkirche/3")
    s.get_by_role("button", name="Los geht’s").click()
    for _ in range(2): s.locator(".sp-aktionen .sp-knopf--haupt").last.click()
    s.get_by_role("button", name="eine Stimme mehr für B").click(); s.get_by_role("button", name="eine Stimme mehr für B").click(); s.get_by_role("button", name="eine Stimme mehr für A").click()
    s.locator(".sp-aktionen .sp-knopf--haupt").last.click(); s.wait_for_selector(".sp-argumente")
    s.locator("[data-argument='steinmetzin']").click(); s.locator("[data-argument='pfarrerin']").click()
    nur_spiel(s); ruhig(s); s.screenshot(path=str(ziel / "2-dilemma-begruenden.png")); bilder.append("2-dilemma-begruenden.png"); k.close()
    # 3 Bildsuche mit Tipp
    k, s = seite_neu()
    s.goto(f"{basis}/spiele/_vorschau/spiel.html?a=bautzen/2")
    s.get_by_role("button", name="Los geht’s").click(); s.wait_for_selector(".sp-suche")
    s.locator(".sp-knopf--tipp").click(); s.locator(".sp-knopf--tipp").click()
    nur_spiel(s); ruhig(s); s.screenshot(path=str(ziel / "3-bildsuche-tipp.png")); bilder.append("3-bildsuche-tipp.png"); k.close()
    # 4 Abschluss mit Sammelstück
    k, s = seite_neu()
    s.goto(f"{basis}/spiele/_vorschau/spiel.html?a=goeltzschtal/3")
    s.get_by_role("button", name="Los geht’s").click(); s.wait_for_selector(".sp-liste")
    for _ in range(3): s.locator(".sp-knopf--tipp").click(); s.wait_for_timeout(300)
    for _ in range(6):
        if s.locator(".sp-ansage--gut").count(): break
        s.locator(".sp-knopf--tipp").click(); s.wait_for_timeout(300)
    s.get_by_role("button", name="Weiter").click(); s.wait_for_selector(".sp-abschluss")
    nur_spiel(s); ruhig(s); s.screenshot(path=str(ziel / "4-abschluss-sammelstueck.png")); bilder.append("4-abschluss-sammelstueck.png"); k.close()
    # 5 Collage mit Reglern
    k, s = seite_neu((1280, 900))
    s.goto(f"{basis}/spiele/_vorschau/collage.html?anordnung=wirbel&groesse=mittel&farbstimmung=abend&items=basteibruecke,felsturm,wanderschuh,alter-stein,kuppel,turmkreuz,dampflok,goeltzschtalbruecke,ziegel,ortsschild")
    warte_bis(s, "document.getElementById('cl-vorschau').src.startsWith('blob:')", 20000)
    s.evaluate("() => document.querySelector('.vs-kopf').style.setProperty('display', 'none')")
    ruhig(s); s.screenshot(path=str(ziel / "5-collage-regler.png")); bilder.append("5-collage-regler.png"); k.close()
    # 6 Figur
    k, s = seite_neu((1280, 900))
    s.goto(f"{basis}/spiele/_vorschau/figur.html")
    s.wait_for_selector(".sp-figur-baukasten svg")
    s.evaluate("() => { for (const e of document.querySelectorAll('.vs-kopf, .vs-protokoll')) e.style.setProperty('display', 'none'); }")
    ruhig(s); s.screenshot(path=str(ziel / "6-figur-baukasten.png")); bilder.append("6-figur-baukasten.png"); k.close()
    # 7 Startkarte auf dem iPad hochkant (820 × 1180, doppelte Dichte: 1640 × 2360 px), Rollen 2 × 2
    k, s = seite_neu((820, 1180))
    s.goto(f"{basis}/spiele/_vorschau/spiel.html?a=frauenkirche/2")
    s.wait_for_selector(".sp-start")
    nur_spiel(s); ruhig(s); s.screenshot(path=str(ziel / "7-startkarte-ipad-hochkant.png")); bilder.append("7-startkarte-ipad-hochkant.png"); k.close()
    return bilder


def ein_lauf(browser, basis, repo, aufgabe_id, geraet, einstellung, axe_quelle, bilder, fotos, browsername):
    aufgabe = lies(repo, aufgabe_id)
    kontext = browser.new_context(**GERAETE[geraet], device_scale_factor=1, reduced_motion="reduce" if "ruhig" in einstellung else "no-preference")
    seite = kontext.new_page()
    konsole = []
    seite.on("console", lambda m: konsole.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    seite.on("pageerror", lambda e: konsole.append(f"pageerror: {e}"))
    parameter = {"a": aufgabe_id, **EINSTELLUNGEN[einstellung]}
    abfrage = "&".join(f"{k}={v}" for k, v in parameter.items())
    name = f"{browsername}-{geraet}-{einstellung}-{aufgabe_id.replace('/', '-')}"
    lauf = Lauf(seite, axe_quelle, name, bilder, fotos)
    beginn = time.perf_counter()
    eintrag = {"aufgabe": aufgabe_id, "format": aufgabe["format"], "geraet": geraet, "einstellung": einstellung, "browser": browsername}
    try:
        seite.goto(f"{basis}/spiele/_vorschau/spiel.html?{abfrage}")
        seite.wait_for_selector(".sp-start", timeout=15000)
        lauf.pruefe("start")
        lauf.taste(seite.get_by_role("button", name="Los geht’s"))
        seite.wait_for_selector(".sp-flaeche")
        lauf.pruefe("spiel")
        LOESER[aufgabe["format"]](lauf, aufgabe)
        seite.wait_for_selector(".sp-abschluss")
        lauf.pruefe("abschluss")
        lauf.taste(seite.get_by_role("button", name="Weiter"))
        warte_bis(seite, "window.spielTest && window.spielTest.fertig", 10000)
        test = seite.evaluate("window.spielTest")
        ergebnis = test.get("ergebnis") or {}
        eintrag.update({
            "geloest": ergebnis.get("geloest"),
            "punkte": ergebnis.get("punkte"),
            "versuche": ergebnis.get("versuche"),
            "items": ergebnis.get("items"),
            "ereignisse": [e["art"] for e in ergebnis.get("ereignisse", [])],
            "schemaFehler": test.get("schemaFehler"),
            "ereignisFehler": test.get("ereignisFehler"),
            "fehler": test.get("fehler"),
            "nurTastatur": True,
        })
    except Exception as fehler:  # Lauf gescheitert: festhalten, nicht verschweigen
        eintrag["fehler"] = f"{type(fehler).__name__}: {fehler}"
        try:
            seite.screenshot(path=str(bilder / f"{name}-FEHLER.png"), full_page=True)
        except Exception:
            pass
    eintrag["sekunden"] = round(time.perf_counter() - beginn, 2)
    eintrag["axe"] = lauf.axe
    eintrag["axeVerstoesse"] = sum(len(v) for v in lauf.axe.values())
    eintrag["axeZustaende"] = len(lauf.axe)
    eintrag["ueberlauf"] = {z: w for z, w in lauf.ueberlauf.items() if w["anzahl"]}
    eintrag["ueberlaufStellen"] = sum(w["anzahl"] for w in lauf.ueberlauf.values())
    eintrag["tasten"] = len(lauf.schritte)
    eintrag["konsole"] = [z for z in konsole if "AtkinsonHyperlegible" not in z]
    kontext.close()
    return eintrag


def main():
    arg = argparse.ArgumentParser()
    arg.add_argument("--basis", required=True)
    arg.add_argument("--repo", required=True)
    arg.add_argument("--aus", required=True)
    arg.add_argument("--axe", required=True)
    arg.add_argument("--nur", default="")
    arg.add_argument("--umfang", default="voll", choices=["voll", "schnell"])
    arg.add_argument("--fotos", default="1")
    arg.add_argument("--collage", default="1")
    arg.add_argument("--konzept", default="0")
    arg.add_argument("--breiten", default="1")
    arg.add_argument("--stand", default="")
    a = arg.parse_args()
    aus = Path(a.aus)
    bilder = aus / "bilder"
    bilder.mkdir(parents=True, exist_ok=True)
    axe_quelle = Path(a.axe).read_text(encoding="utf-8")
    aufgaben = [x for x in a.nur.split(",") if x] or alle_aufgaben(a.repo)
    fotos = a.fotos == "1"
    formate_gesehen = set()
    plan = []
    for aufgabe in aufgaben:
        fmt = lies(a.repo, aufgabe)["format"]
        plan += [("chromium", aufgabe, "desktop", "standard"), ("chromium", aufgabe, "telefon", "standard")]
        if a.umfang == "voll" and fmt not in formate_gesehen:
            formate_gesehen.add(fmt)
            plan += [("chromium", aufgabe, "tablet", "standard"), ("chromium", aufgabe, "klein", "standard")]
            plan += [("chromium", aufgabe, "desktop", e) for e in ("einfach", "kontrast", "dunkel", "ruhig-langsam")]
            plan += [("chromium", aufgabe, "telefon", e) for e in ("einfach", "kontrast")]
            plan += [("firefox", aufgabe, "desktop", "standard"), ("webkit", aufgabe, "ipad", "standard")]
    laeufe = []
    start = datetime.now(timezone.utc)
    with sync_playwright() as p:
        browser = {}
        versionen = {}
        for browsername, aufgabe, geraet, einstellung in plan:
            if browsername not in browser:
                browser[browsername] = getattr(p, browsername).launch()
                versionen[browsername] = browser[browsername].version
            eintrag = ein_lauf(browser[browsername], a.basis, a.repo, aufgabe, geraet, einstellung, axe_quelle, bilder, fotos, browsername)
            laeufe.append(eintrag)
            print(json.dumps({k: eintrag.get(k) for k in ("browser", "geraet", "einstellung", "aufgabe", "geloest", "axeVerstoesse", "axeZustaende", "sekunden", "fehler")}, ensure_ascii=False), flush=True)
        collagen = collage_laeufe(browser["chromium"], a.basis, aus, axe_quelle) if a.collage == "1" else []
        figuren = figur_laeufe(browser["chromium"], a.basis, aus, axe_quelle) if a.collage == "1" else []
        konzept = konzeptbilder(browser["chromium"], a.basis, aus) if a.konzept == "1" else []

        def browser_fuer(name):
            if name not in browser:
                browser[name] = getattr(p, name).launch()
                versionen[name] = browser[name].version
            return browser[name]
        breiten = breiten_laeufe(browser_fuer, a.basis, aufgaben, aus, fotos) if a.breiten == "1" else []
        for b in browser.values():
            b.close()
    ende = datetime.now(timezone.utc)
    zusammen = {
        "laeufe": len(laeufe),
        "geloest": sum(1 for l in laeufe if l.get("geloest")),
        "fehlgeschlagen": [f"{l['browser']}-{l['geraet']}-{l['einstellung']}-{l['aufgabe']}: {l['fehler']}" for l in laeufe if l.get("fehler")],
        "axeZustaende": sum(l["axeZustaende"] for l in laeufe),
        "axeVerstoesse": sum(l["axeVerstoesse"] for l in laeufe),
        "schemaFehler": sum(len(l.get("schemaFehler") or []) for l in laeufe),
        "ereignisFehler": sum(len(l.get("ereignisFehler") or []) for l in laeufe),
        "konsolenmeldungen": sum(len(l["konsole"]) for l in laeufe),
        "ueberlauf": sum(l.get("ueberlaufStellen", 0) for l in laeufe),
        "breitenProben": len(breiten),
        "breitenMitUeberlauf": sum(1 for b in breiten if b["anzahl"]),
        "breiten": sorted({b["breite"] for b in breiten}),
        "formate": sorted({l["format"] for l in laeufe}),
        "aufgaben": sorted({l["aufgabe"] for l in laeufe}),
    }
    messwerte = {
        "stand": a.stand,
        "beginn": start.isoformat(timespec="seconds"),
        "ende": ende.isoformat(timespec="seconds"),
        "umgebung": {"browser": versionen, "axe": f"axe-core {axe_quelle.split('axe v', 1)[1].split()[0] if 'axe v' in axe_quelle else '?'}", "regeln": AXE_REGELN, "python": platform.python_version()},
        "hinweis": "Alle Spielenden sind simuliert: Ein Skript bedient die Seite nur mit der Tastatur. axe-core findet einen Teil der WCAG-Verstöße automatisch; es ersetzt keine Prüfung durch Menschen.",
        "zusammenfassung": zusammen,
        "collagen": collagen,
        "figur": figuren,
        "konzeptbilder": konzept,
        "breiten": breiten,
        "laeufe": laeufe,
    }
    (aus / "messwerte.json").write_text(json.dumps(messwerte, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(zusammen, ensure_ascii=False))


if __name__ == "__main__":
    main()
