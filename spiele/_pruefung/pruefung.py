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
}
EINSTELLUNGEN = {
    "standard": {},
    "einfach": {"sprache": "einfach"},
    "kontrast": {"kontrast": "1"},
    "dunkel": {"dunkel": "1"},
    "ruhig-langsam": {"ruhig": "1", "tempo": "0.5"},
}
AXE_REGELN = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]


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


class Lauf:
    def __init__(self, seite, axe_quelle, name, bilder, fotos):
        self.seite, self.axe_quelle, self.name, self.bilder, self.fotos = seite, axe_quelle, name, bilder, fotos
        self.axe = {}
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
        if foto and self.fotos:
            self.seite.screenshot(path=str(self.bilder / f"{self.name}-{zustand}.png"), full_page=True)
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
        seite.wait_for_function("window.spielTest && window.spielTest.fertig", timeout=10000)
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
            plan += [("chromium", aufgabe, "tablet", "standard")]
            plan += [("chromium", aufgabe, "desktop", e) for e in ("einfach", "kontrast", "dunkel", "ruhig-langsam")]
            plan += [("chromium", aufgabe, "telefon", e) for e in ("einfach", "kontrast")]
            plan += [("firefox", aufgabe, "desktop", "standard"), ("webkit", aufgabe, "tablet", "standard")]
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
        "formate": sorted({l["format"] for l in laeufe}),
        "aufgaben": sorted({l["aufgabe"] for l in laeufe}),
    }
    messwerte = {
        "beginn": start.isoformat(timespec="seconds"),
        "ende": ende.isoformat(timespec="seconds"),
        "umgebung": {"browser": versionen, "axe": f"axe-core {axe_quelle.split('axe v', 1)[1].split()[0] if 'axe v' in axe_quelle else '?'}", "regeln": AXE_REGELN, "python": platform.python_version()},
        "hinweis": "Alle Spielenden sind simuliert: Ein Skript bedient die Seite nur mit der Tastatur. axe-core findet einen Teil der WCAG-Verstöße automatisch; es ersetzt keine Prüfung durch Menschen.",
        "zusammenfassung": zusammen,
        "laeufe": laeufe,
    }
    (aus / "messwerte.json").write_text(json.dumps(messwerte, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(zusammen, ensure_ascii=False))


if __name__ == "__main__":
    main()
