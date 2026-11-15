"""Größen der Spiele als JSON: je Format JS + CSS samt gemeinsamer Teile (`_gemeinsam`, Obergrenze: ein Format lädt
nicht jede gemeinsame Datei), dazu alles, was die App ausliefert (Spiele ohne Test- und Prüfordner, Inhalte, Bilder,
Schrift). Läuft im Prüf-Container:  python3 spiele/_pruefung/groessen.py /repo > groessen.json"""
import json
import sys
from pathlib import Path

repo = Path(sys.argv[1])
spiele = repo / "spiele"


def summe(dateien):
    return sum(p.stat().st_size for p in dateien if p.is_file())


gemeinsam = [p for p in (spiele / "_gemeinsam").rglob("*") if p.suffix in (".js", ".css")]
formate = {}
for d in sorted(spiele.iterdir()):
    if d.is_dir() and not d.name.startswith("_") and (d / "index.js").exists() and (d / "schema.json").exists():
        formate[d.name] = summe([p for p in d.rglob("*") if p.suffix in (".js", ".css")] + gemeinsam)
WEG = {"_nachweis", "_pruefung", "_test", "_vorschau", "_werkzeug"}
ausgeliefert = [p for p in spiele.rglob("*") if not (set(p.relative_to(spiele).parts) & WEG)]
ausgeliefert += list((repo / "inhalte").rglob("*")) + list((repo / "assets" / "spiele").rglob("*"))
print(json.dumps({"formate": formate, "gemeinsam": summe(gemeinsam), "gesamt": summe(ausgeliefert),
                  "dateien": sum(1 for p in ausgeliefert if p.is_file())}, ensure_ascii=False, indent=2))
