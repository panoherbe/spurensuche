# Item-Collage

**Kurz:** Aus den gesammelten Sammelstücken entsteht nach festen Regeln ein Bild für den Bildbeitrag: PNG in
2048 × 2048 px, eine kleine Vorschau und Metadaten. Keine generative KI, kein Zufall ohne Startwert.

```js
import { erzeugeCollage, regler } from './spiele/collage/index.js';
const { png, vorschau, metadaten } = await erzeugeCollage(items, { anordnung: 'kreis', groesse: 'mittel', farbstimmung: 'sommer' });
```

## Regeln

| Regler (`regler`) | Werte | was passiert |
|---|---|---|
| Anordnung | Kreis, Raster, Wirbel, Stapel | Kreis: gleichmäßig auf einem Ring, ab sieben Stücken eins in der Mitte; Raster: Reihen, die letzte mittig; Wirbel: Spirale im goldenen Winkel, die ersten Stücke groß vorn; Stapel: überlappend, leicht gedreht, in der Bildmitte |
| Größe | klein, mittel, groß | Faktor 0,8 / 1 / 1,2 auf die Grundgröße; die Grundgröße sinkt mit der Anzahl (1 Stück: halbe Bildbreite, 12 Stücke: knapp ein Fünftel) |
| Farbstimmung | Morgen, Sommertag, Abendrot, Sternennacht, Sandstein | Verlauf und Muster des Hintergrunds: Wolken, Sonne über Hügeln, Abendhügel, Sterne mit Mond, Sandsteinschichten |

- Gleiche Sammelstücke in gleicher Reihenfolge und gleiche Einstellungen ergeben dasselbe Bild. Drehungen hängen nur von der
  Kennung des Stücks ab.
- Kein Sticker ragt über den Rahmen. Unten rechts steht klein „Item-Collage“, sonst kein Text: kein Name, keine
  Gruppenbezeichnung.
- `metadaten`: `kennung` (UUID), `erstellt` (ISO 8601, UTC), `art: "item-collage"`, `items` (Kennungen in
  Zeichenreihenfolge, hinten zuerst).
- `vorschau`: WebP mit 512 × 512 px; wo der Browser kein WebP speichern kann (ältere Safari), JPEG.
- `optionen.kantenlaenge` (z. B. 512) liefert eine schnelle Vorschau während des Einstellens; das endgültige Bild hat
  immer 2048 px.
- Inhaltsrichtlinie: Die Sticker kommen aus `assets/spiele/items/` (gleiche Herkunft); für die Vorschau als Bild braucht
  die Seite `img-src blob:`.
