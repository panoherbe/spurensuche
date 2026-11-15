# Messprotokoll der Spiele

Gemessen von **2026-11-15T04:29:36+00:00** bis **2026-11-15T04:38:25+00:00** (UTC), Stand `6be9e74`. Alle Zahlen stammen aus
[`messwerte.json`](messwerte.json) und [`tests.tap`](tests.tap) dieses Laufs; nichts ist geschätzt.

**Hinweis:** Alle Spielenden sind simuliert: Ein Skript bedient die Seite nur mit der Tastatur. axe-core findet einen Teil der WCAG-Verstöße automatisch; es ersetzt keine Prüfung durch Menschen.

**Umgebung:** Container ohne Netz auf einem Mini-PC (Intel Core i7, Linux). Browser über Playwright chromium 141.0.7390.37, firefox 142.0.1, webkit 26.0; axe-core 4.14.0, Regeln wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa; v24.22.2 für die Logiktests.

## 1. Logik und Inhalte (`node --test`)

**22 von 22 Tests bestanden**, 0 fehlgeschlagen.
Geprüft: Mischen mit Startwert, Ereignisse nach Schnittstelle 2.5, Ergebnis nach 2.4, Schema-Prüfer, Logik aller fünf
Formate, Collage-Regeln, Figur; jede Aufgabe gegen ihr Schema, jede Belohnung, jedes Bild, jeder Ort, jedes Sammelstück.

## 2. Spiele im Browser, nur mit der Tastatur

**81 von 81 Läufen gelöst**, jeder nur per Tastatur (Fokus und Eingabe, Leertaste, Pfeiltasten).
axe-core prüfte **537 Zustände** (Startkarte, Spiel, Tipp, Rückmeldung, Lösung, Abschluss):
**0 Verstöße** gegen WCAG 2.0/2.1/2.2 A und AA. Schemafehler 0,
Ereignisse außerhalb der Schnittstelle 0, Konsolenmeldungen 33.
Text über den Kartenrand oder abgeschnitten (in jedem geprüften Zustand gemessen): **0 Stellen**.
Auf den Testseiten von Collage und Figur: 0 Stellen.

**Breiten-Durchlauf:** Startkarte jeder Aufgabe in 13 Fensterbreiten (320, 360, 390, 600, 680, 744, 768, 800, 820, 900, 1024, 1180, 1280 px; Chromium, dazu WebKit in den
iPad-Breiten), Standard- und einfache Sprache: 432 Proben, davon **0 mit Überlauf**.
Die Spalten der Startkarte richten sich nach der Breite der Karte, nicht nach dem Fenster; damit decken die Breiten
auch den Rahmen der App ab (iPad hochkant: 820 px Fenster, gut 700 px Karte).

| Format | Aufgaben | Läufe | gelöst | axe-Zustände | Verstöße | Browser | Geräte | Einstellungen |
|---|---|---|---|---|---|---|---|---|
| bildpuzzle | 2 | 15 | 15 | 90 | 0 | chromium, firefox, webkit | desktop, ipad, klein, tablet, telefon | dunkel, einfach, kontrast, ruhig-langsam, standard |
| bildsuche | 2 | 15 | 15 | 90 | 0 | chromium, firefox, webkit | desktop, ipad, klein, tablet, telefon | dunkel, einfach, kontrast, ruhig-langsam, standard |
| dilemma | 2 | 15 | 15 | 120 | 0 | chromium, firefox, webkit | desktop, ipad, klein, tablet, telefon | dunkel, einfach, kontrast, ruhig-langsam, standard |
| schaetzen | 3 | 18 | 18 | 144 | 0 | chromium, firefox, webkit | desktop, ipad, klein, tablet, telefon | dunkel, einfach, kontrast, ruhig-langsam, standard |
| sortieren | 3 | 18 | 18 | 93 | 0 | chromium, firefox, webkit | desktop, ipad, klein, tablet, telefon | dunkel, einfach, kontrast, ruhig-langsam, standard |

Geräte: Desktop 1280 × 800, Tablet hochkant 800 × 1280 (Touch), Telefon 390 × 844 (mobil, Touch). Einstellungen:
Standardsprache, einfache Sprache, hoher Kontrast, dunkle Darstellung, wenig Bewegung mit Tempo 0,5.

### Ereignisse, die die Spiele gemeldet haben

| Art | Anzahl |
|---|---|
| `rolle` | 864 |
| `versuch` | 262 |
| `neuer-anlauf` | 81 |
| `hilfe` | 63 |
| `abstimmung` | 51 |
| `weg` | 33 |

### Alle Läufe

| Browser | Gerät | Einstellung | Aufgabe | gelöst | Sterne | Versuche | axe-Zustände | Verstöße | Sekunden |
|---|---|---|---|---|---|---|---|---|---|
| chromium | desktop | standard | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,29 |
| chromium | telefon | standard | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,06 |
| chromium | klein | standard | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,03 |
| chromium | tablet | standard | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,36 |
| chromium | desktop | einfach | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,25 |
| chromium | desktop | kontrast | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,27 |
| chromium | desktop | dunkel | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,34 |
| chromium | desktop | ruhig-langsam | bastei/1 | ja | 2 | 2 | 6 | 0 | 3,55 |
| chromium | telefon | einfach | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,19 |
| chromium | telefon | kontrast | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,18 |
| firefox | desktop | standard | bastei/1 | ja | 1 | 6 | 6 | 0 | 4,84 |
| webkit | ipad | standard | bastei/1 | ja | 1 | 5 | 6 | 0 | 6,25 |
| chromium | desktop | standard | bastei/2 | ja | 3 | 2 | 8 | 0 | 6,02 |
| chromium | telefon | standard | bastei/2 | ja | 3 | 2 | 8 | 0 | 5,78 |
| chromium | klein | standard | bastei/2 | ja | 3 | 2 | 8 | 0 | 5,75 |
| chromium | tablet | standard | bastei/2 | ja | 3 | 2 | 8 | 0 | 5,91 |
| chromium | desktop | einfach | bastei/2 | ja | 3 | 2 | 8 | 0 | 5,8 |
| chromium | desktop | kontrast | bastei/2 | ja | 3 | 2 | 8 | 0 | 5,83 |
| chromium | desktop | dunkel | bastei/2 | ja | 3 | 2 | 8 | 0 | 5,81 |
| chromium | desktop | ruhig-langsam | bastei/2 | ja | 3 | 2 | 8 | 0 | 3,71 |
| chromium | telefon | einfach | bastei/2 | ja | 3 | 2 | 8 | 0 | 5,63 |
| chromium | telefon | kontrast | bastei/2 | ja | 3 | 2 | 8 | 0 | 5,63 |
| firefox | desktop | standard | bastei/2 | ja | 3 | 2 | 8 | 0 | 5,7 |
| webkit | ipad | standard | bastei/2 | ja | 3 | 2 | 8 | 0 | 6,06 |
| chromium | desktop | standard | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,93 |
| chromium | telefon | standard | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,86 |
| chromium | klein | standard | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,82 |
| chromium | tablet | standard | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,89 |
| chromium | desktop | einfach | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,91 |
| chromium | desktop | kontrast | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,95 |
| chromium | desktop | dunkel | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,95 |
| chromium | desktop | ruhig-langsam | bastei/3 | ja | 3 | 2 | 8 | 0 | 3,69 |
| chromium | telefon | einfach | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,83 |
| chromium | telefon | kontrast | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,86 |
| firefox | desktop | standard | bastei/3 | ja | 3 | 2 | 8 | 0 | 4,85 |
| webkit | ipad | standard | bastei/3 | ja | 3 | 2 | 8 | 0 | 5,08 |
| chromium | desktop | standard | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,98 |
| chromium | telefon | standard | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,83 |
| chromium | klein | standard | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,81 |
| chromium | tablet | standard | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 4,09 |
| chromium | desktop | einfach | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,96 |
| chromium | desktop | kontrast | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,97 |
| chromium | desktop | dunkel | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,98 |
| chromium | desktop | ruhig-langsam | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,18 |
| chromium | telefon | einfach | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,81 |
| chromium | telefon | kontrast | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,83 |
| firefox | desktop | standard | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 3,91 |
| webkit | ipad | standard | frauenkirche/1 | ja | 1 | 5 | 6 | 0 | 4,7 |
| chromium | desktop | standard | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,3 |
| chromium | telefon | standard | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,28 |
| chromium | klein | standard | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,24 |
| chromium | tablet | standard | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,34 |
| chromium | desktop | einfach | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,29 |
| chromium | desktop | kontrast | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,3 |
| chromium | desktop | dunkel | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,31 |
| chromium | desktop | ruhig-langsam | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 2,57 |
| chromium | telefon | einfach | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,22 |
| chromium | telefon | kontrast | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,25 |
| firefox | desktop | standard | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,3 |
| webkit | ipad | standard | frauenkirche/2 | ja | 2 | 2 | 5 | 0 | 3,66 |
| chromium | desktop | standard | frauenkirche/3 | ja | 3 | 2 | 8 | 0 | 4,94 |
| chromium | telefon | standard | frauenkirche/3 | ja | 3 | 2 | 8 | 0 | 4,85 |
| chromium | klein | standard | frauenkirche/3 | ja | 3 | 2 | 8 | 0 | 4,85 |
| chromium | desktop | standard | goeltzschtal/1 | ja | 3 | 2 | 8 | 0 | 5,88 |
| chromium | telefon | standard | goeltzschtal/1 | ja | 3 | 2 | 8 | 0 | 5,63 |
| chromium | klein | standard | goeltzschtal/1 | ja | 3 | 2 | 8 | 0 | 5,61 |
| chromium | desktop | standard | goeltzschtal/2 | ja | 1 | 6 | 6 | 0 | 4,0 |
| chromium | telefon | standard | goeltzschtal/2 | ja | 1 | 6 | 6 | 0 | 3,86 |
| chromium | klein | standard | goeltzschtal/2 | ja | 1 | 6 | 6 | 0 | 3,81 |
| chromium | desktop | standard | goeltzschtal/3 | ja | 2 | 2 | 5 | 0 | 3,29 |
| chromium | telefon | standard | goeltzschtal/3 | ja | 2 | 2 | 5 | 0 | 3,25 |
| chromium | klein | standard | goeltzschtal/3 | ja | 2 | 2 | 5 | 0 | 3,26 |
| chromium | desktop | standard | bautzen/1 | ja | 2 | 2 | 6 | 0 | 3,55 |
| chromium | telefon | standard | bautzen/1 | ja | 2 | 2 | 6 | 0 | 3,48 |
| chromium | klein | standard | bautzen/1 | ja | 2 | 2 | 6 | 0 | 3,46 |
| chromium | desktop | standard | bautzen/2 | ja | 1 | 5 | 6 | 0 | 4,0 |
| chromium | telefon | standard | bautzen/2 | ja | 1 | 5 | 6 | 0 | 3,85 |
| chromium | klein | standard | bautzen/2 | ja | 1 | 5 | 6 | 0 | 3,8 |
| chromium | desktop | standard | bautzen/3 | ja | 3 | 2 | 8 | 0 | 5,84 |
| chromium | telefon | standard | bautzen/3 | ja | 3 | 2 | 8 | 0 | 5,63 |
| chromium | klein | standard | bautzen/3 | ja | 3 | 2 | 8 | 0 | 5,65 |

## 3. Item-Collage im Headless-Browser

Ein Bild in 2048 × 2048 px entsteht in **161 ms** (Median aus 5 Läufen,
6 Sammelstücke, Headless-Chromium im Container). Alle 5 Einstellungen:

| Anordnung | Größe | Farbstimmung | Stücke | Dauer (ms) | PNG | Vorschau | Metadaten | axe-Verstöße |
|---|---|---|---|---|---|---|---|---|
| kreis | mittel | sommer | 6 | 161, 154, 167, 163, 159 | 2048 × 2048, 2.684 KB | image/webp, 512 × 512 | art, erstellt, items, kennung; UUID ja, Zeitzone ja | 0 |
| raster | klein | sandstein | 9 | 155 | 2048 × 2048, 2.760 KB | image/webp, 512 × 512 | art, erstellt, items, kennung; UUID ja, Zeitzone ja | 0 |
| wirbel | gross | abend | 12 | 201 | 2048 × 2048, 3.418 KB | image/webp, 512 × 512 | art, erstellt, items, kennung; UUID ja, Zeitzone ja | 0 |
| stapel | mittel | nacht | 4 | 179 | 2048 × 2048, 3.351 KB | image/webp, 512 × 512 | art, erstellt, items, kennung; UUID ja, Zeitzone ja | 0 |
| kreis | gross | morgen | 1 | 133 | 2048 × 2048, 1.517 KB | image/webp, 512 × 512 | art, erstellt, items, kennung; UUID ja, Zeitzone ja | 0 |

Die Bilder liegen in [`collagen/`](collagen/) (als WebP verkleinert).

## 4. Spielfigur

- desktop: per Tastatur gewählt haut = haut-3, frisur = locken, haare = dunkelbraun, gesicht = froh, brille = keine, kopfbedeckung = kletterhelm, oberteil = shirt, oberteilFarbe = gruen, hose = jeans, zubehoer = karte, rucksack = rucksack, begleiter = uhu; gesperrt geblieben: lokmuetze, krone, fernrohr; axe-Verstöße 0.
- telefon: per Tastatur gewählt haut = haut-3, frisur = locken, haare = dunkelbraun, gesicht = froh, brille = keine, kopfbedeckung = kletterhelm, oberteil = shirt, oberteilFarbe = gruen, hose = jeans, zubehoer = karte, rucksack = rucksack, begleiter = uhu; gesperrt geblieben: lokmuetze, krone, fernrohr; axe-Verstöße 0.

## 5. Größe

Je Format JS + CSS samt gemeinsamer Teile (Obergrenze, unkomprimiert): bildpuzzle 84 KB, bildsuche 84 KB, dilemma 86 KB, schaetzen 90 KB, sortieren 90 KB.
Alles, was die App von den Spielen ausliefert (Spiele ohne Test- und Prüfordner, Inhalte, Bilder, Schrift): 104 Dateien, 4.2 MB.

## 6. Was diese Messung nicht zeigt

- Keine echten Geräte: Safari ist nur über die WebKit-Engine von Playwright geprüft, nicht auf einem iPad.
- axe-core findet einen Teil der WCAG-Verstöße automatisch; es ersetzt kein Audit durch Menschen und keinen Test mit
  Bildschirmleser (VoiceOver, NVDA, TalkBack).
- Vorlesen nutzt die Sprachausgabe des Geräts; im Container gibt es keine Stimmen, gemessen ist nur, dass die Knöpfe da sind.
- Keine Tests mit Kindern: Die Spieldauern sind geplant, nicht beobachtet.
- Die Farben stammen aus der Testseite der Spiele; in der App gelten deren Variablen.

