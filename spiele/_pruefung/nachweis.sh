#!/bin/sh
# Nachweis aus einem Messlauf zusammenstellen: PROTOKOLL.md aus messwerte.json, ausgewählte Bilder als WebP,
# Konzeptbilder als PNG. Läuft in Containern ohne Netz.
#
#   AUS=/pfad/zum/messlauf NACHWEIS=/pfad/spiele/_nachweis/JJJJ-MM-TT REPO=/pfad/zum/repo sh spiele/_pruefung/nachweis.sh
set -eu
: "${AUS:?AUS = Ordner des Messlaufs}"
: "${NACHWEIS:?NACHWEIS = Zielordner im Repo}"
: "${REPO:?REPO = Repo-Stand}"
IDS="$(id -u):$(id -g)"
mkdir -p "$NACHWEIS/bilder" "$NACHWEIS/collagen" "$NACHWEIS/konzept"
cp "$AUS/messwerte.json" "$AUS/tests.tap" "$AUS/node.txt" "$AUS/groessen.json" "$NACHWEIS/"
cp "$AUS"/konzept/*.png "$NACHWEIS/konzept/" 2>/dev/null || true
docker run --rm --network none --user "$IDS" -e HOME=/tmp -v "$REPO":/repo:ro -v "$NACHWEIS":/n spurensuche-pruefung:1.56.0 \
  python3 /repo/spiele/_pruefung/protokoll.py /n
# Bilder ins Repo nur als Auswahl (alle liegen weiter im Ausgabeordner des Messlaufs): je Format die erste Aufgabe mit
# Start, Spiel und Abschluss auf dem Desktop, das Spiel auf Telefon, kontrastreich, dunkel und in einfacher Sprache; dazu
# Figur, Collage und die Startkarte im Breiten-Durchlauf bei 820 px (iPad hochkant). Als WebP.
docker run --rm --network none --user "$IDS" -e HOME=/tmp -v "$AUS":/a:ro -v "$NACHWEIS":/n spurensuche-bilder:1 sh -c '
  for b in bastei-1 bastei-2 bastei-3 frauenkirche-1 frauenkirche-2; do
    set -- "$@" /a/bilder/chromium-desktop-standard-$b-start.png /a/bilder/chromium-desktop-standard-$b-spiel.png /a/bilder/chromium-desktop-standard-$b-abschluss.png \
      /a/bilder/chromium-telefon-standard-$b-spiel.png /a/bilder/chromium-desktop-kontrast-$b-spiel.png /a/bilder/chromium-desktop-dunkel-$b-spiel.png /a/bilder/chromium-desktop-einfach-$b-spiel.png
  done
  for f in "$@" /a/bilder/figur-*.png /a/bilder/collage-1-*.png /a/bilder/breite-820-*.png; do
    [ -f "$f" ] || continue
    magick "$f" -strip -resize "1280x>" -quality 78 "/n/bilder/$(basename "$f" .png).webp"
  done
  for f in /a/collagen/*.png; do magick "$f" -strip -resize 1024x1024 -quality 82 "/n/collagen/$(basename "$f" .png).webp"; done
' 2>&1 | grep -v -i -E "fontconfig|unable to read font" || true
du -sh "$NACHWEIS"
