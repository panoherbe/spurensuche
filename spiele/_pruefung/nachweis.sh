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
cp "$AUS/messwerte.json" "$AUS/tests.tap" "$AUS/node.txt" "$NACHWEIS/"
cp "$AUS"/konzept/*.png "$NACHWEIS/konzept/" 2>/dev/null || true
docker run --rm --network none --user "$IDS" -e HOME=/tmp -v "$REPO":/repo:ro -v "$NACHWEIS":/n spurensuche-pruefung:1.56.0 \
  python3 /repo/spiele/_pruefung/protokoll.py /n
# Bilder: je Format die Zustände auf Desktop (Standard) und Telefon, dazu kontrastreich und dunkel; als WebP
docker run --rm --network none --user "$IDS" -e HOME=/tmp -v "$AUS":/a:ro -v "$NACHWEIS":/n spurensuche-bilder:1 sh -c '
  for f in /a/bilder/chromium-desktop-standard-*.png /a/bilder/chromium-telefon-standard-*.png /a/bilder/chromium-desktop-kontrast-*.png /a/bilder/chromium-desktop-dunkel-*.png /a/bilder/chromium-desktop-einfach-*.png /a/bilder/figur-*.png /a/bilder/collage-*.png; do
    [ -f "$f" ] || continue
    magick "$f" -strip -resize "1280x>" -quality 78 "/n/bilder/$(basename "$f" .png).webp"
  done
  for f in /a/collagen/*.png; do magick "$f" -strip -resize 1024x1024 -quality 82 "/n/collagen/$(basename "$f" .png).webp"; done
' 2>&1 | grep -v -i -E "fontconfig|unable to read font" || true
du -sh "$NACHWEIS"
