# Kennungen in diesen Nachweisen

Die Rohdateien dieses Ordners nennen Commit-Kennungen aus einem früheren Stand des Verlaufs. Der Inhalt ist derselbe
(gleicher Baum, außer wo vermerkt); heute liegt er unter diesen Kennungen:

| In den Dateien | Datei | Heute | Tag | Baum |
|---|---|---|---|---|
| `02a07c7` | `stand.txt`, `PROTOKOLL.md`, `nachbau.json` | `34408d1` | `probe-2026-11-15` | `21b2e491a28d` |
| `a202dfc+Arbeitskopie` | `betrieb/betriebstest.json` | Arbeitskopie auf `9f3dce8`, committet als `9bb1ec0` (bis dahin nur noch Betriebsseite im Browser, ihr Prüflauf und Doku geändert; `9bb1ec0` weicht vom gemessenen Stand außerdem im voreingestellten Ordner von `tools/betriebstest.sh` ab) | `betrieb-2026-11-15` | `4ec1ab01c1c7` |
| `6b9f3ae` | `nach-merge/stand.txt` (Lauf nach dem Merge der Spiele) | `a5e3224` | – | `def454469f1b` |

Den Baum eines Stands zeigt `git rev-parse <tag>^{tree}`. Die Logdateien (`*.log`), die `PROTOKOLL.md` aufzählt,
bleiben außerhalb des Repositorys. Test 16 in `tests.tap` heißt heute „Außerhalb der Klassen 4 bis 8 oder ohne
Einwilligung entstehen keine Datensätze“; die Rohdatei nennt noch seinen früheren Namen.
