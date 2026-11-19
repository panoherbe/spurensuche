# Schnittstelle zwischen App und Spielen

> **Version 1.3, Stand 19.11.2026.** Dieses Dokument ist der Vertrag zwischen der App (Karte, Ablauf, Speicher,
> Auswertung) und den Spielen (Minigames, Sammelstücke, Collage). Beide Seiten bauen gegen genau diese Fassung.
> Jede Änderung erhöht die Versionsnummer und steht unten im Verlauf; eine Änderung, die bestehende Spiele bricht,
> gibt es nur gemeinsam und mit Übergangsfrist.

## 1. Wem welcher Ordner gehört

| Pfad | Inhalt | Zweig |
|---|---|---|
| `spiele/` | Minigame-Formate, gemeinsame Spiel-Helfer (`spiele/_gemeinsam/`), Collage (`spiele/collage/`) | `spiele` |
| `inhalte/` | Orte, Aufgaben, Sammelstücke (`inhalte/items.json`) | `spiele` |
| `assets/spiele/` | Bilder der Sammelstücke (`assets/spiele/items/`) und der Orte (`assets/spiele/orte/`) | `spiele` |
| alles andere | App (`app/`), Server (`server/`), Doku (`docs/`), Tests (`test/`), Werkzeuge (`tools/`), Bereitstellung | `main` |

- Der Zweig `spiele` ändert nur diese drei Pfade. `main` übernimmt ihn regelmäßig mit `git merge --no-ff spiele`.
  Weil sich die Pfade nicht überschneiden, gibt es keine Konflikte; `main` ändert in diesen Pfaden nichts.
- Der Zweig `spiele` darf `main` jederzeit hereinholen (`git merge main`), um die App und die Prüfwerkzeuge zu nutzen.
- Lizenz: Code unter `AGPL-3.0-only` (Datei `LICENSE`). Texte und Aufgaben in `inhalte/` und eigene Zeichnungen in
  `assets/spiele/` stehen als offene Bildungsmaterialien unter **CC BY-SA 4.0**; Fotos der Orte und die Schrift haben
  eigene freie Lizenzen (Abschnitt 8).

## 2. Ein Minigame

### 2.1 Datei und Exporte

Ein Format liegt in `spiele/<format>/` (Kennung `<format>`: Kleinbuchstaben, Ziffern, Bindestrich). Pflicht sind
`index.js` und `schema.json`, dazu nach Bedarf `stil.css` und eine kurze `README.md` mit den Spielregeln.

```js
// spiele/schaetzen/index.js — ES-Modul, ohne Build-Schritt, ohne Laufzeit-Abhängigkeiten
export const meta = {
  id: 'schaetzen',          // gleich dem Ordnernamen
  titel: 'Schätzfrage',     // so heißt das Format in der App und im Dashboard
  dauerMinuten: [5, 10],    // erwartete Spieldauer [min, max] in Minuten
  offline: true             // Pflicht: läuft ohne Netz
};

export async function starte(wurzel, aufgabe, umgebung) {
  // zeichnet in `wurzel`, begleitet die Gruppe durch die Aufgabe
  // und liefert am Ende `ergebnis` (Abschnitt 2.4)
}
```

- `wurzel` ist ein leeres `<section>`-Element. Das Spiel zeichnet nur darin und fasst nichts außerhalb an.
  Die App leert `wurzel`, sobald `starte` zurückkehrt.
- Importe nur relativ (`./…`, `../_gemeinsam/…`). Kein `fetch` außer auf Dateien im eigenen Ordner, in
  `spiele/_gemeinsam/` und `assets/spiele/`; die App hält genau diese Ordner offline bereit.
- Stil: eine Datei `stil.css`, die das Spiel selbst einbindet (Beispiel in 2.6). Kein `<style>`-Element, kein
  `style="…"` im Markup; die App setzt eine strenge Inhaltsrichtlinie (CSP). Positionen zur Laufzeit gehen über
  `element.style.setProperty(…)`.
- Größe: JavaScript und CSS je Format höchstens 100 KB, ohne Bilder.

### 2.2 `aufgabe`

`aufgabe` ist der geparste Inhalt von `inhalte/<ort>/<nr>.json`. Die Datei wird gegen `spiele/<format>/schema.json`
geprüft (Teilmenge von JSON Schema, Abschnitt 7). Diese Felder hat jede Aufgabe, gleich welches Format:

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `format` | ja | Text | Kennung des Formats, z. B. `"schaetzen"` |
| `titel` | ja | Text | Titel der Aufgabe, höchstens 60 Zeichen |
| `text` | ja | Zweitext | Aufgabenstellung in Standard- und einfacher Sprache |
| `dauerMinuten` | ja | Zahl | geplante Dauer, 5 bis 10 |
| `belohnung` | ja | Liste von Item-Kennungen | Sammelstücke, die das Spiel vergeben **kann** (Abschnitt 4) |
| `stufe` | ja | Text | Anspruch der Aufgabe: `einblick`, `kennen`, `anwenden`, `beurteilen` oder `gestalten` |
| `rollen` | nein | Liste | Rollenpositionen in der Gruppe, z. B. `["navigation", "protokoll", "recherche"]` |
| `mischen` | nein | Zahl | fester Startwert, falls das Spiel Antworten mischt |
| `quelle` | nein | Text | Herkunft des Inhalts, wenn nicht eigener Text |

**Zweitext** heißt `{ "standard": "…", "einfach": "…" }`. Jeder Text, den die Gruppe liest oder hört, gibt es in
beiden Fassungen, auch in den formatspezifischen Feldern.

`stufe` folgt der Stufenfolge der sächsischen Lehrpläne (Einblick gewinnen, Kennen, Anwenden, Beurteilen / Sich
positionieren, Gestalten). Die App nutzt sie für das Kompetenzraster im Dashboard; das Spiel braucht sie nicht.

### 2.3 `umgebung`

```js
{
  sprache: 'standard',        // oder 'einfach': welche Fassung jedes Zweitexts gezeigt wird
  vorlesen(text),             // liest `text` vor (Promise, erfüllt nach dem Ende); bricht laufendes Vorlesen ab
  tempo: 1,                   // 0,5 bis 1,5; 0,5 = halb so schnell
  hoherKontrast: false,       // hoher Kontrast eingeschaltet
  reduzierteBewegung: false,  // keine Animationen
  melde(ereignis),            // meldet ein Ereignis sofort ({ art, zeit, wert }, Abschnitt 2.5)
  signal,                     // AbortSignal: ausgelöst, wenn die Gruppe die Station verlässt
  basisUrl,                   // URL der Wurzel (endet auf „/“); Bildpfade wie assets/spiele/… dagegen auflösen
  ton: false,                 // Effekttöne erlaubt (Standard: aus)
  rollen,                     // Rollenpositionen dieser Gruppe (Liste) oder false, wenn ohne Rollen gespielt wird
  katalog                     // alle Einträge aus inhalte/items.json, z. B. für die Abschlusskarte
}
```

- **Pfade:** `new URL(aufgabe.bild, umgebung.basisUrl)` statt fester Pfade; so läuft dasselbe Spiel auf dem Server,
  in der Vorführung unter einem Unterpfad und offline.
- **Rollen:** Ist `umgebung.rollen` `false`, zeigt das Spiel keine Rollen und meldet kein `rolle`. Sonst nutzt es
  `aufgabe.rollen` (oder `umgebung.rollen`, wenn die Aufgabe keine eigenen hat).

- **Tempo:** Alles Zeitgesteuerte im Spiel (Animationen, automatisches Weiterblättern, Zeitanzeigen) dauert
  `dauer / tempo`. Die App liest mit derselben Rate vor. Kein Spiel endet wegen Zeitablauf; eine Zeitanzeige ist
  nur ein Hinweis.
- **Kontrast und Bewegung:** Die App setzt dafür auch Attribute am Dokument (`data-kontrast="hoch"`,
  `data-bewegung="reduziert"`) und passt die Farbvariablen aus 2.6 an. Wer die Variablen nutzt, bekommt helle,
  dunkle und kontrastreiche Darstellung ohne eigenen Code.
- **Vorlesen:** Die App hat einen eigenen Vorlese-Knopf. Er liest alle Elemente mit dem Attribut `data-vorlesen` in
  `wurzel` der Reihe nach vor. Spiele markieren damit Aufgabentext und Antwortmöglichkeiten und können zusätzlich
  `umgebung.vorlesen(text)` aufrufen.
- **Abbruch:** Löst `signal` aus, kehrt `starte` binnen einer Sekunde mit dem bisherigen Ergebnis zurück
  (`geloest: false`). Die App vermerkt die Station dann als abgebrochen.

### 2.4 `ergebnis`

```js
{
  geloest: true,          // Aufgabe gelöst bzw. Entscheidung getroffen
  punkte: 3,              // ganze Zahl ≥ 0, nur für die Rückmeldung im Spiel
  versuche: 2,            // Anzahl der abgegebenen Lösungen (= Ereignisse „versuch“)
  dauerSekunden: 312,     // Zeit vom Start bis zum Ende des Spiels
  items: ['sandstein'],   // vergebene Sammelstücke, Teilmenge von aufgabe.belohnung
  ereignisse: [           // alle gemeldeten Ereignisse, in Reihenfolge
    { art: 'versuch', zeit: 81234, wert: false },   // zeit = Millisekunden seit dem Aufruf von starte
    { art: 'hilfe', zeit: 95000, wert: 1 },
    { art: 'neuer-anlauf', zeit: 120400, wert: true },
    { art: 'versuch', zeit: 150210, wert: true }
  ]
}
```

Spiele dürfen am Ende eine eigene kurze Abschlusskarte zeigen („Geschafft“, Sammelstück, „Wusstet ihr?“) und erst
nach „Weiter“ zurückkehren. Die App zeigt danach nur noch den Fortschritt.

So geht die App damit um:
- `punkte` speichert und überträgt sie nicht und zeigt sie in keiner Übersicht. Es gibt keine Punktzahl, keine Note
  und keine Rangfolge zwischen Gruppen.
- `items` außerhalb von `aufgabe.belohnung` verwirft sie. Belohnungen sind nachvollziehbar und nie zufällig: Die
  Spielregeln in `spiele/<format>/README.md` sagen, wofür es welches Sammelstück gibt.
- Ereignisse sichert sie schon beim Melden im Gerät, damit nach einem Absturz nichts verloren ist. Kommt `ergebnis`,
  ersetzt dessen Liste die gemeldete; doppelt gezählt wird nichts.
- Nur in Schulgruppen werden Ereignisse überhaupt gespeichert. Im Familienmodus verwirft die App sie, bevor etwas
  entsteht.

### 2.5 Ereignisse

Spiele melden nur diese Arten, jedes Ereignis als `{ art, zeit, wert }`. `zeit` ist eine Zahl: Millisekunden seit
dem Aufruf von `starte` (kein Datumstext; den Zeitpunkt setzt die App). `wert` ist eine Zahl, `true`/`false` oder eine Kennung aus der Aufgabe
(Kleinbuchstaben, Ziffern, Bindestrich, höchstens 40 Zeichen). Alles andere verwirft die App, und die
Werkstatt-Seite (Abschnitt 7) meldet es als Fehler.

| `art` | wann | `wert` | zeigt im Dashboard |
|---|---|---|---|
| `versuch` | die Gruppe gibt eine Lösung ab | `true` richtig, `false` falsch | Problemlösung: Versuche je Aufgabe |
| `weg` | die Gruppe wählt einen von mehreren Lösungswegen | Kennung des Wegs | Problemlösung: Abfolge der Wege |
| `hilfe` | die Gruppe öffnet einen Hinweis oder schlägt nach | Stufe (1, 2, 3) oder Kennung | Problemlösung: Hilfen mit Zeitpunkt |
| `neuer-anlauf` | erste Aktion nach einem falschen Versuch | `true`, wenn das Vorgehen wechselt, sonst `false` | Problemlösung: Umgang mit Fehlern |
| `rolle` | eine Eingabe auf einer Rollenposition | Kennung aus `aufgabe.rollen` | Beteiligung: Eingaben je Rolle |
| `abstimmung` | die Gruppe nutzt die vorgesehene Abstimmung | `einig` oder `mehrheit` | Beteiligung: gemeinsame Entscheidungen |

Diese Arten erzeugt nur die App, nie ein Spiel: `start`, `ende` (`abgeschlossen` oder `abgebrochen`),
`aktiv` (aktive Sekunden), `offline`, `online`, `sync`. Beginn, Ende und aktive Zeit misst also die App um das Spiel
herum; das Spiel meldet nur, was in ihm passiert.

Eine Rolle ist eine Aufgabe in der Gruppe und keine Person; sie trägt keinen Namen. Wer gerade „Navigation“ ist, weiß nur die Gruppe.

### 2.6 Regeln für jedes Spiel

1. **Offline:** kein Netzzugriff (2.1), keine Schriften oder Bilder von außen.
2. **Keine personenbezogenen Daten:** kein Name, keine Kamera, kein Mikrofon, kein Standort im Spiel (die
   Ortsprüfung macht die App). Freitext nur, wenn er die Lösung ist; er bleibt im Spiel und geht nie in `wert`.
3. **Barrierefrei nach WCAG 2.1 AA:**
   - alles per Tastatur bedienbar (Tab, Eingabe, Leertaste, Pfeiltasten); Ziehen und Ablegen hat immer einen Weg per
     Tippen oder Tastatur
   - sichtbarer Fokus, Bedienflächen mindestens 44 × 44 px
   - jedes Bedienelement mit Beschriftung, jedes Bild mit `alt` aus der Aufgabe oder `items.json`
   - Farbe nie als einziges Signal, kein Blinken, Bewegung nur ohne `reduzierteBewegung`
   - Rückmeldungen („richtig“, „noch nicht“) zusätzlich in einem Element mit `role="status"`
   - Überschriften in `wurzel` beginnen bei `<h2>` (die Seite hat die `<h1>`)
   - Texte nur über `textContent`, nie über `innerHTML`
4. **Aussehen:** Farben und Maße nur über diese CSS-Variablen der App. Die Farben der App sind auf mindestens
   4,5 : 1 Kontrast für Text auf Grund und Fläche ausgelegt, hell, dunkel und kontrastreich:

   | Variable | wofür |
   |---|---|
   | `--sp-grund` | Hintergrund der Seite |
   | `--sp-flaeche` | Karten, Felder, Antwortknöpfe |
   | `--sp-text` | Text |
   | `--sp-text-leise` | Nebentext (immer noch ≥ 4,5 : 1) |
   | `--sp-rand` | Ränder, Trennlinien |
   | `--sp-akzent`, `--sp-akzent-text` | Akzentfarbe und Schrift darauf; in einer Aufgabe ist das die Farbe des Orts |
   | `--sp-akzent-weich` | zarter Ton der Akzentfarbe für Flächen (optional) |
   | `--sp-knopf`, `--sp-knopf-text` | Hauptknopf und seine Schrift (optional, sonst die Akzentfarbe) |
   | `--sp-kontur` | Umriss von Karten und Knöpfen (optional) |
   | `--sp-erfolg`, `--sp-hinweis`, `--sp-fehler` | Rückmeldung (immer mit Text oder Symbol) |
   | `--sp-fokus` | Fokusrahmen |
   | `--sp-radius`, `--sp-abstand` | Ecken, Grundabstand |
   | `--sp-schrift` | Schriftfamilie |
   | `--sp-schrift-titel` | Schrift für Überschriften und Knöpfe (optional) |

   Stil einbinden:
   ```js
   const stil = document.createElement('link');
   stil.rel = 'stylesheet';
   stil.href = new URL('./stil.css', import.meta.url).href;
   const geladen = new Promise((ok) => stil.addEventListener('load', ok, { once: true }));
   wurzel.append(stil);
   await geladen;
   ```
5. **Sicherheit:** kein `eval`, kein `new Function`, keine `on…=`-Attribute.
6. **Aufräumen:** Zeitgeber und Ereignis-Lauscher enden mit dem Spiel oder dem Abbruch.
7. **Wiederholbar:** Zufall nur für die Anordnung und nur mit dem Startwert `aufgabe.mischen`, damit Tests und
   Rundgang gleich ablaufen.

## 3. Orte und Aufgaben (`inhalte/`)

### 3.1 `inhalte/orte.json`

```json
{
  "version": 1,
  "orte": ["festung-koenigstein", "bastei", "…"],
  "finale": "<kennung eines Orts aus orte>"
}
```

- `orte` legt die Reihenfolge in Listen fest. Spielen dürfen die Gruppen in jeder Reihenfolge; kein Ort ist gesperrt.
- `finale` ist der Ort der Abschlussaufgabe. Erst wenn eine Gruppe dort alle Aufgaben abgeschlossen hat, öffnet die
  App den Bildbeitrag (Collage, Abschnitt 5).

### 3.2 `inhalte/<ort>/ort.json`

```json
{
  "id": "bastei",
  "name": "Basteibrücke",
  "region": "Sächsische Schweiz",
  "lage": { "lat": 50.9620, "lon": 14.0733, "radius": 150 },
  "qr": "BASTEI-4F7K",
  "text": { "standard": "…", "einfach": "…" },
  "bild": "assets/spiele/orte/bastei.webp",
  "alt": "…",
  "bildQuelle": "eigene Zeichnung, CC BY-SA 4.0",
  "aufgaben": ["1", "2", "3"],
  "ersatz": {
    "text": { "standard": "…", "einfach": "…" },
    "bild": "assets/spiele/orte/bastei-ersatz.webp",
    "alt": "…"
  }
}
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | gleich dem Ordnernamen |
| `name`, `region` | ja | wie auf der Karte angezeigt |
| `lage` | ja | Mittelpunkt in WGS 84 (Dezimalgrad) und Radius in Metern (50–500) für die GPS-Prüfung |
| `qr` | ja | Code auf dem QR-Schild, 4–16 Zeichen aus `A–Z`, `0–9`, `-`; steht klein unter dem QR-Code zum Eintippen |
| `text` | ja | Einführung am Ort |
| `bild`, `alt`, `bildQuelle` | ja | Bild des Orts, Alternativtext, Herkunft mit Lizenz |
| `aufgaben` | ja | Dateinamen ohne `.json`, in Spielreihenfolge; 1 bis 5 Aufgaben |
| `ersatz` | ja | ortsunabhängige Fassung: Was die Gruppe im Klassenzimmer statt des Orts sieht und liest |

Die Ortsprüfung (QR-Code, eingetippter Code oder GPS) läuft nur im Gerät. Gespeichert wird allein „Station erreicht“
oder „ortsunabhängig gespielt“, nie eine Koordinate. Alle Aufgaben eines Orts sind auch in der Ersatzfassung
spielbar; die Ersatzfassung ersetzt nur das Erleben vor Ort.

### 3.3 `inhalte/<ort>/<nr>.json`

Eine Aufgabe mit den Feldern aus 2.2 und den Feldern ihres Formats. Kennung in der App: `<ort>/<nr>`.

### 3.4 `inhalte/ablaeufe.json` (Vorschläge je Zeitrahmen)

```json
{
  "ablaeufe": [
    { "id": "stunde", "name": "Unterrichtsstunde", "minuten": 45,
      "orte": [{ "ort": "bastei", "aufgaben": ["1", "2", "3"] }] },
    { "id": "projekttag", "name": "Projekttag", "minuten": 240, "orte": [{ "ort": "…", "aufgaben": ["…"] }] },
    { "id": "ausflug", "name": "Tagesausflug", "minuten": 360, "orte": [{ "ort": "…", "aufgaben": ["…"] }] }
  ]
}
```

Die Lehrkraft wählt beim Freigeben einen Vorschlag und kann Orte und Aufgaben danach ändern. Die App zeigt die Summe
der geplanten Dauer (`dauerMinuten`) neben dem Zeitrahmen.

## 4. Sammelstücke (`inhalte/items.json`)

```json
[
  { "id": "sandstein", "name": "Sandstein", "bild": "assets/spiele/items/sandstein.svg",
    "alt": "Ein gelblicher Sandsteinblock mit Schichten", "kategorie": "natur" }
]
```

- `id`: eindeutig, Kleinbuchstaben, Ziffern, Bindestrich.
- `name`: höchstens 30 Zeichen; `alt`: beschreibt das Bild für Vorlesen und Bildschirmleser.
- `bild`: SVG bevorzugt (es wird für die Collage auf bis zu 2048 px gezeichnet), sonst PNG oder WebP mit mindestens
  1024 × 1024 px, quadratisch, transparenter Hintergrund.
- `kategorie`: frei wählbare, kurze Kennung (z. B. `natur`, `bauwerk`, `brauch`); die Collage darf danach ordnen.
- Jede Kennung in `belohnung` einer Aufgabe muss hier stehen.

### 4.1 Figur (`inhalte/figur.json`, `spiele/figur/index.js`)

Die Gruppe gestaltet eine Spielfigur; Teile werden mit Sammelstücken freigeschaltet. Die App lädt den Katalog
`inhalte/figur.json` und übergibt ihn; sie speichert die Auswahl nur im Gerät, nie auf dem Server.

```js
export async function starteGestaltung(wurzel, { katalog, items, freigeschaltet, auswahl, umgebung }) → auswahl | null
export function figurSvg(auswahl, katalog) → string      // SVG-Markup, ohne style-Attribute (CSP)
export function figurText(auswahl, katalog) → string     // Beschreibung in Worten (Alternativtext)
```

- `auswahl` ist ein kleines JSON-Objekt `{ <gruppe>: <option> }` (höchstens 2 KB); `{}` heißt Grundfigur.
- `items` sind alle Sammelstücke (für Namen bei gesperrten Teilen), `freigeschaltet` die Kennungen der gesammelten.
- `null` heißt abgebrochen (`umgebung.signal`). Die App zeigt die gespeicherte Figur mit `figurSvg` und `figurText`.
- Ältere Form (bis 1.1, weiter unterstützt): `gestalte(wurzel, { figur, freigeschaltet, umgebung })` und
  `figurElement(figur, { groesse })`.

## 5. Collage (`spiele/collage/index.js`)

```js
export async function erzeugeCollage(items, optionen) → {
  png,        // Blob, image/png, genau 2048 × 2048 px
  vorschau,   // Blob, image/webp oder image/jpeg, höchstens 512 × 512 px
  metadaten: {
    kennung,  // UUID (crypto.randomUUID())
    erstellt, // Zeitpunkt in ISO 8601 mit Zeitzone, z. B. "2026-11-20T09:41:00Z"
    art,      // "item-collage" (eine spätere KI-Fassung schriebe "ki-generiert")
    items     // Kennungen der verwendeten Sammelstücke, in Bildreihenfolge
  }
}
```

- `items` sind die Einträge aus `items.json`, die die Gruppe für ihr Bild ausgewählt hat (1 bis 12).
- `optionen` sind die Regler, die die Gruppe einstellt, mindestens `anordnung`, `groesse` und `farbstimmung`.
  Die Collage beschreibt ihre Regler in `export const regler = [{ id, name, werte: [{ id, name }] }]`; die App
  zeichnet daraus die Bedienung. Zusätzlich darf `optionen.kantenlaenge` (z. B. 512) eine schnelle Vorschau
  während des Einstellens anfordern; das endgültige Bild hat immer 2048 px.
- **Regelbasiert:** Gleiche `items` und gleiche `optionen` ergeben das gleiche Bild. Keine generative KI.
- **Ohne Personenbezug:** Das Bild enthält keinen Namen, keine Gruppenbezeichnung und keinen sonstigen Text über die
  Gruppe. `metadaten` enthält keine Gruppenbezeichnung.
- Läuft im Browser ohne Netz (Canvas bzw. `OffscreenCanvas`).

Was danach passiert, macht die App: Sie speichert den Bildbeitrag, zeigt ihn der Lehrkraft zur Freigabe (bei Familien
gibt das Team selbst frei) und stellt nur freigegebene Beiträge über die Schnittstelle bereit.

## 6. Was die App den Spielen garantiert

- `starte` wird erst aufgerufen, wenn alle Dateien des Formats und die Bilder der Aufgabe im Gerät liegen.
- Die App zeigt Titel, Ort, Fortschritt, Vorlese-Knopf, Einstellungen und „Station verlassen“ um `wurzel` herum. Das
  Spiel braucht dafür nichts zu zeichnen.
- Die App fängt Fehler ab: Wirft `starte`, sieht die Gruppe eine freundliche Meldung und kann neu beginnen.

## 7. Prüfen

- `node tools/pruefe-inhalte.js` prüft alle Aufgaben gegen das Schema ihres Formats, die gemeinsamen Felder aus 2.2,
  jede Item-Kennung, jedes Bild und jede `ort.json`. Ausgabe je Fehler: Datei, Feld, Grund; Rückgabewert 1 bei Fehlern.
- Die Werkstatt-Seite `app/werkstatt.html?aufgabe=<ort>/<nr>` startet ein einzelnes Spiel mit einstellbarer
  `umgebung`, zeigt das Ergebnis und prüft es gegen 2.4 und 2.5.
- **Unterstützte Teilmenge von JSON Schema** in `schema.json`: `type` (`object`, `array`, `string`, `number`,
  `integer`, `boolean`), `properties`, `required`, `additionalProperties` (nur `false`), `items`, `minItems`,
  `maxItems`, `enum`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `$ref` auf
  `#/$defs/<name>`, `$defs`, `oneOf`. Andere Schlüsselwörter meldet das Werkzeug als „nicht unterstützt“.

## 8. Lizenzen der Inhalte

- Texte, Aufgaben und eigene Zeichnungen in `inhalte/` und `assets/spiele/` stehen unter **CC BY-SA 4.0**
  (<https://creativecommons.org/licenses/by-sa/4.0/legalcode.de>), Namensnennung „Panagiotis Herbe“.
- Fotos der Orte stammen aus Wikimedia Commons und behalten ihre Lizenzen, je Bild in `inhalte/BILDNACHWEIS.md`.
- Die Schrift Atkinson Hyperlegible Next in `assets/spiele/schrift/` steht unter der SIL Open Font License 1.1
  (`assets/spiele/schrift/OFL.txt`).
- Fremdes Material nur mit einer Lizenz, die CC BY-SA 4.0 erlaubt (z. B. CC0, CC BY, CC BY-SA), mit Quelle und Lizenz
  im Feld `quelle` bzw. `bildQuelle`. App und Spiele zeigen den Lizenznamen dort als Link zum Lizenztext
  (`bildnachweis()` in `spiele/_gemeinsam/ui.js` und `app/js/ui.js`); bekannt sind CC BY 3.0 und 4.0, CC BY-SA 3.0,
  3.0 DE und 4.0, CC0 1.0 und die Freie-Kunst-Lizenz 1.3. Eine neue Lizenz kommt dort in die Tabelle, sonst prüft der Inhaltstest rot.
- Keine Texte, Bilder oder Logos von Einrichtungen, die einen Ort betreiben.

## 9. Verlauf

| Version | Datum | Änderung |
|---|---|---|
| 1 | 15.11.2026 | erste Fassung |
| 1.1 | 15.11.2026 | `umgebung` um `basisUrl`, `ton`, `rollen`, `katalog` ergänzt; Abschlusskarte im Spiel erlaubt; `zeit` ausdrücklich als Zahl; `inhalte/ablaeufe.json` (3.4) und Figur (4.1) neu. Alles abwärtskompatibel. |
| 1.2 | 15.11.2026 | Figur (4.1) wie gebaut: `starteGestaltung` mit Katalog, `figurSvg`, `figurText`; die ältere Form bleibt gültig. Inhalte lassen sich als Inhaltspaket tauschen (docs/BETRIEB.md): `inhalte/` und `assets/spiele/` ohne Programmcode. |
| 1.3 | 19.11.2026 | §8: Lizenzname der Bildquelle als Link zum Lizenztext (`bildnachweis()`); eine neue Lizenz kommt in die Tabelle, sonst prüft der Inhaltstest rot |
