"""Schreibt PROTOKOLL.md aus messwerte.json und tests.tap: jede Zahl aus der Messdatei, nichts von Hand.

    python3 protokoll.py <ordner mit messwerte.json und tests.tap>
"""

import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

ordner = Path(sys.argv[1])
m = json.loads((ordner / "messwerte.json").read_text(encoding="utf-8"))
tap = (ordner / "tests.tap").read_text(encoding="utf-8") if (ordner / "tests.tap").exists() else ""
node = (ordner / "node.txt").read_text(encoding="utf-8").strip() if (ordner / "node.txt").exists() else "?"
zahl = lambda name: int(re.search(rf"^# {name} (\d+)", tap, re.M).group(1)) if re.search(rf"^# {name} (\d+)", tap, re.M) else None
z = m["zusammenfassung"]
laeufe = m["laeufe"]
de = lambda x: f"{x:,}".replace(",", ".") if isinstance(x, int) else str(x).replace(".", ",")

zeilen = []
a = zeilen.append
a("# Messprotokoll der Spiele")
a("")
a(f"Gemessen von **{m['beginn']}** bis **{m['ende']}** (UTC), Stand `{m.get('stand') or '?'}`. Alle Zahlen stammen aus")
a("[`messwerte.json`](messwerte.json) und [`tests.tap`](tests.tap) dieses Laufs; nichts ist geschätzt.")
a("")
a(f"**Hinweis:** {m['hinweis']}")
a("")
a("**Umgebung:** Container ohne Netz auf einem Mini-PC (Intel Core i7, Linux). Browser über Playwright "
  + ", ".join(f"{b} {v}" for b, v in m["umgebung"]["browser"].items())
  + f"; {m['umgebung']['axe']}, Regeln {', '.join(m['umgebung']['regeln'])}; {node} für die Logiktests.")
a("")
a("## 1. Logik und Inhalte (`node --test`)")
a("")
a(f"**{zahl('pass')} von {zahl('tests')} Tests bestanden**, {zahl('fail')} fehlgeschlagen.")
a("Geprüft: Mischen mit Startwert, Ereignisse nach Schnittstelle 2.5, Ergebnis nach 2.4, Schema-Prüfer, Logik aller fünf")
a("Formate, Collage-Regeln, Figur; jede Aufgabe gegen ihr Schema, jede Belohnung, jedes Bild, jeder Ort, jedes Sammelstück.")
a("")
a("## 2. Spiele im Browser, nur mit der Tastatur")
a("")
a(f"**{z['geloest']} von {z['laeufe']} Läufen gelöst**, jeder nur per Tastatur (Fokus und Eingabe, Leertaste, Pfeiltasten).")
a(f"axe-core prüfte **{de(z['axeZustaende'])} Zustände** (Startkarte, Spiel, Tipp, Rückmeldung, Lösung, Abschluss):")
a(f"**{z['axeVerstoesse']} Verstöße** gegen WCAG 2.0/2.1/2.2 A und AA. Schemafehler {z['schemaFehler']},")
a(f"Ereignisse außerhalb der Schnittstelle {z['ereignisFehler']}, Konsolenmeldungen {z['konsolenmeldungen']}.")
if "ueberlauf" in z:
    a(f"Text über den Kartenrand oder abgeschnitten (in jedem geprüften Zustand gemessen): **{z['ueberlauf']} Stellen**.")
    if "ueberlaufCollageFigur" in z:
        a(f"Auf den Testseiten von Collage und Figur: {z['ueberlaufCollageFigur']} Stellen.")
if z.get("breitenProben"):
    breiten = ", ".join(str(b) for b in z["breiten"])
    a("")
    a(f"**Breiten-Durchlauf:** Startkarte jeder Aufgabe in {len(z['breiten'])} Fensterbreiten ({breiten} px; Chromium, dazu WebKit in den")
    a(f"iPad-Breiten), Standard- und einfache Sprache: {de(z['breitenProben'])} Proben, davon **{z['breitenMitUeberlauf']} mit Überlauf**.")
    a("Die Spalten der Startkarte richten sich nach der Breite der Karte, nicht nach dem Fenster; damit decken die Breiten")
    a("auch den Rahmen der App ab (iPad hochkant: 820 px Fenster, gut 700 px Karte).")
    funde = [b for b in m.get("breiten", []) if b["anzahl"]]
    for b in funde[:10]:
        stellen = "; ".join(f"„{x['text']}“ in {x['kasten']} ({x['px']} px)" for x in b["stellen"][:3]) or f"Seite {b['seite']} px breiter"
        a(f"- {b['browser']} {b['breite']} px {b['aufgabe']} {b['einstellung']}: {stellen}")
if z["fehlgeschlagen"]:
    a("")
    a("**Nicht gelöst:** " + "; ".join(z["fehlgeschlagen"]))
a("")
a("| Format | Aufgaben | Läufe | gelöst | axe-Zustände | Verstöße | Browser | Geräte | Einstellungen |")
a("|---|---|---|---|---|---|---|---|---|")
nach_format = defaultdict(list)
for l in laeufe:
    nach_format[l["format"]].append(l)
for fmt in sorted(nach_format):
    ls = nach_format[fmt]
    a(f"| {fmt} | {len({l['aufgabe'] for l in ls})} | {len(ls)} | {sum(1 for l in ls if l.get('geloest'))} | {sum(l['axeZustaende'] for l in ls)} | "
      f"{sum(l['axeVerstoesse'] for l in ls)} | {', '.join(sorted({l['browser'] for l in ls}))} | {', '.join(sorted({l['geraet'] for l in ls}))} | "
      f"{', '.join(sorted({l['einstellung'] for l in ls}))} |")
a("")
a("Geräte: Desktop 1280 × 800, Tablet hochkant 800 × 1280 (Touch), Telefon 390 × 844 (mobil, Touch). Einstellungen:")
a("Standardsprache, einfache Sprache, hoher Kontrast, dunkle Darstellung, wenig Bewegung mit Tempo 0,5.")
a("")
a("### Ereignisse, die die Spiele gemeldet haben")
a("")
arten = Counter(e for l in laeufe for e in l.get("ereignisse") or [])
a("| Art | Anzahl |")
a("|---|---|")
for art, n in arten.most_common():
    a(f"| `{art}` | {de(n)} |")
a("")
a("### Alle Läufe")
a("")
a("| Browser | Gerät | Einstellung | Aufgabe | gelöst | Sterne | Versuche | axe-Zustände | Verstöße | Sekunden |")
a("|---|---|---|---|---|---|---|---|---|---|")
for l in laeufe:
    a(f"| {l['browser']} | {l['geraet']} | {l['einstellung']} | {l['aufgabe']} | {'ja' if l.get('geloest') else 'nein'} | {l.get('punkte')} | {l.get('versuche')} | {l['axeZustaende']} | {l['axeVerstoesse']} | {de(l['sekunden'])} |")
verstoesse = [(l, zustand, v) for l in laeufe for zustand, vs in l["axe"].items() for v in vs]
if verstoesse:
    a("")
    a("### Verstöße im Einzelnen")
    a("")
    for l, zustand, v in verstoesse:
        a(f"- {l['browser']} {l['geraet']} {l['einstellung']} {l['aufgabe']}, {zustand}: `{v['id']}` ({v['auswirkung']}), {v['stellen']} Stellen, z. B. `{v['beispiel']}`")
a("")
a("## 3. Item-Collage im Headless-Browser")
a("")
if m.get("collagen"):
    c0 = m["collagen"][0]
    a(f"Ein Bild in 2048 × 2048 px entsteht in **{de(int(statistics.median(c0['dauerMs'])))} ms** (Median aus {len(c0['dauerMs'])} Läufen,")
    a(f"{c0['anzahl']} Sammelstücke, Headless-Chromium im Container). Alle {len(m['collagen'])} Einstellungen:")
    a("")
    a("| Anordnung | Größe | Farbstimmung | Stücke | Dauer (ms) | PNG | Vorschau | Metadaten | axe-Verstöße |")
    a("|---|---|---|---|---|---|---|---|---|")
    for c in m["collagen"]:
        meta = f"{', '.join(c['metadatenFelder'])}; UUID {'ja' if c['kennungIstUuid'] else 'nein'}, Zeitzone {'ja' if c['erstelltMitZeitzone'] else 'nein'}"
        a(f"| {c['anordnung']} | {c['groesse']} | {c['farbstimmung']} | {c['anzahl']} | {', '.join(str(x) for x in c['dauerMs'])} | {c['png']['breite']} × {c['png']['hoehe']}, {de(round(c['png']['bytes'] / 1024))} KB | "
          f"{c['vorschau']['typ']}, {c['vorschau']['breite']} × {c['vorschau']['hoehe']} | {meta} | {c['axeVerstoesse']} |")
    a("")
    a("Die Bilder liegen in [`collagen/`](collagen/) (als WebP verkleinert).")
a("")
a("## 4. Spielfigur")
a("")
for f in m.get("figur", []):
    a(f"- {f['geraet']}: per Tastatur gewählt {', '.join(f'{k} = {v}' for k, v in f['auswahl'].items())}; gesperrt geblieben: {', '.join(f['gesperrt'])}; axe-Verstöße {f['axeVerstoesse']}.")
a("")
if (ordner / "groessen.json").exists():
    g = json.loads((ordner / "groessen.json").read_text(encoding="utf-8"))
    a("## 5. Größe")
    a("")
    a("Je Format JS + CSS samt gemeinsamer Teile (Obergrenze, unkomprimiert): " + ", ".join(f"{k} {round(v / 1024)} KB" for k, v in g["formate"].items()) + ".")
    a(f"Alles, was die App von den Spielen ausliefert (Spiele ohne Test- und Prüfordner, Inhalte, Bilder, Schrift): {g['dateien']} Dateien, {round(g['gesamt'] / 1024 / 1024, 1)} MB.")
    a("")
a("## 6. Was diese Messung nicht zeigt")
a("")
a("- Keine echten Geräte: Safari ist nur über die WebKit-Engine von Playwright geprüft, nicht auf einem iPad.")
a("- axe-core findet einen Teil der WCAG-Verstöße automatisch; es ersetzt kein Audit durch Menschen und keinen Test mit")
a("  Bildschirmleser (VoiceOver, NVDA, TalkBack).")
a("- Vorlesen nutzt die Sprachausgabe des Geräts; im Container gibt es keine Stimmen, gemessen ist nur, dass die Knöpfe da sind.")
a("- Keine Tests mit Kindern: Die Spieldauern sind geplant, nicht beobachtet.")
a("- Die Farben stammen aus der Testseite der Spiele; in der App gelten deren Variablen.")
a("")
(ordner / "PROTOKOLL.md").write_text("\n".join(zeilen) + "\n", encoding="utf-8")
print(f"PROTOKOLL.md geschrieben: {len(zeilen)} Zeilen")
