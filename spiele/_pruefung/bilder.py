"""Bildschirmfotos einzelner Spielzustände (für die Gestaltung). Läuft im Playwright-Container.

Aufruf:  python3 bilder.py <basis-url> <ausgabe-ordner> <aufgabe> [<aufgabe> …]
Je Aufgabe: Startkarte, Spielfläche, nach einem Tipp; Desktop 1280 × 800 und Telefon 390 × 844.
Gibt Konsolenfehler aus. Keine Messung: Die Messung macht pruefung.py.
"""

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

basis, ausgabe, *aufgaben = sys.argv[1:]
ziel = Path(ausgabe)
ziel.mkdir(parents=True, exist_ok=True)
GERAETE = {"desktop": {"width": 1280, "height": 800}, "telefon": {"width": 390, "height": 844}}

with sync_playwright() as p:
    browser = p.chromium.launch()
    for aufgabe in aufgaben:
        for name, groesse in GERAETE.items():
            kontext = browser.new_context(viewport=groesse, device_scale_factor=1.5, is_mobile=name == "telefon", has_touch=name == "telefon")
            seite = kontext.new_page()
            fehler = []
            seite.on("console", lambda m: fehler.append(m.text) if m.type in ("error", "warning") else None)
            seite.on("pageerror", lambda e: fehler.append(str(e)))
            kurz = aufgabe.replace("/", "-")
            seite.goto(f"{basis}/spiele/_vorschau/spiel.html?a={aufgabe}")
            seite.wait_for_selector(".sp-start")
            seite.wait_for_timeout(400)
            seite.screenshot(path=str(ziel / f"{kurz}-{name}-1-start.png"), full_page=True)
            seite.get_by_role("button", name="Los geht’s").click()
            seite.wait_for_selector(".sp-flaeche")
            seite.wait_for_timeout(500)
            seite.screenshot(path=str(ziel / f"{kurz}-{name}-2-spiel.png"), full_page=True)
            tipp = seite.locator(".sp-knopf--tipp")
            if tipp.count():
                tipp.click()
                seite.wait_for_timeout(500)
                seite.screenshot(path=str(ziel / f"{kurz}-{name}-3-tipp.png"), full_page=True)
            print(json.dumps({"aufgabe": aufgabe, "geraet": name, "konsole": fehler}, ensure_ascii=False))
            kontext.close()
    browser.close()
