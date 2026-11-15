# Kennungen in diesen Nachweisen

Die Rohdateien dieses Ordners (`stand.txt`, `PROTOKOLL.md`, `betriebstest.json`, `nachbau.json`) nennen den gemessenen
Code-Stand `33ee143` aus einem früheren Stand des Verlaufs. Derselbe Inhalt (gleicher Baum) liegt heute unter:

| In den Dateien | Heute | Tag | Baum |
|---|---|---|---|
| `33ee143` | `57e4222` | `messlauf-2026-11-15` | `dd43599ee838` |

Den Baum zeigt `git rev-parse messlauf-2026-11-15^{tree}`. Die Logdateien (`*.log`), die `PROTOKOLL.md` aufzählt, und
die Bildschirmfotos des Laufs (`browser/bilder/`) bleiben außerhalb des Repositorys.

## PROTOKOLL.md neu erzeugt

`PROTOKOLL.md` ist am 15.11.2026 um 16:25 Uhr mit dem korrigierten `tools/protokoll.js` aus denselben Rohdateien
neu erzeugt worden. Neu sind der Abschnitt „Betriebsseite“ (er fehlte wegen eines Klammerfehlers in der Liste der
Prüfläufe) und die Zeile `protokoll=0` unter „Rückgabewerte“ (sie entstand erst nach dem ersten Erzeugen). Alle
anderen Zeilen sind gleich geblieben. Um 17:07 Uhr noch einmal erzeugt, nachdem der Generator im Hinweis zum
Nachbau „Messrechner“ statt „Prüfrechner“ schreibt; sonst unverändert.
