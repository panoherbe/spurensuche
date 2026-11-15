# Testumgebung

Kurz: Eine vollständige Testumgebung entsteht aus dem Repository mit einem Befehl, ohne echte Daten von Lernenden.
Sie enthält die Anwendung mit Beispielinhalten, die Attrappe des Anmeldedienstes mit Testkonten, einen Chrome ohne
Oberfläche und die Prüfläufe.

## Unit- und Schnittstellentests (ohne Browser)

```bash
docker run --rm -v "$PWD":/app -w /app node:24-alpine node --test test/*.test.js
```

Prüft unter anderem: Schema der Inhalte, Bereinigung der Ereignisse, Kompetenzraster, PDF, ZIP, QR-Codes,
Löschfristen, Übertragung ohne Doppelzählung, keine Datensätze außerhalb der Klassen 4 bis 8 oder ohne Einwilligung, Anmeldung über
OpenID Connect (Attrappe), Ausfall und Schlüsselwechsel des Anmeldedienstes, Sicherung und Rückspielen, Archiv
(Export → Übernahme in leere Instanz → gleiche Prüfsummen), Übereinstimmung von `docs/openapi.json` mit den Routen.

## Browser-Prüfläufe

```bash
export UID_GID="$(id -u):$(id -g)"
docker compose -p spur-test -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from pruefer
PRUEFSKRIPT=test/e2e/vorfuehrung.js docker compose -p spur-test -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from pruefer
docker compose -p spur-test -f compose.test.yaml down -v
```

`compose.test.yaml` startet die Instanz mit Testinhalten (`test/fixtures/inhalt`, Variable `SPUR_TEST_INHALTE`
für andere), die gebaute Vorführung unter `/spurensuche/`, Chrome und den Prüflauf; alle im selben Netzbereich, nach
außen offen ist nichts. Ergebnisse: `nachweis/tmp/` (Bildschirmfotos, `rauchtest.json`, `vorfuehrung.json` mit den
axe-Ergebnissen je Ansicht).

## Lasttest (simuliert)

```bash
SITZUNGEN=400 DAUER_MIN=45 docker compose -p spur-last -f compose.last.yaml up --build --abort-on-container-exit --exit-code-from last
```

Instanz auf 2 CPU-Kerne und 2 GB begrenzt; Ablauf und Parameter in `test/last.js`.

## Testkonten der Attrappe

| Konto | Rolle | Zweck |
|---|---|---|
| Lehrkraft A, Lehrkraft B | `lehrkraft` | Anmeldung, getrennte Lerngruppen |
| Schülerin/Schüler | `schueler` | Anmeldung Lernender ohne gespeicherten Bezug |
| Konto ohne Rollenmerkmal | – | Fehlerweg „Rolle fehlt“ |

Die Attrappe liefert absichtlich Name, E-Mail und Schule mit; die Tests zeigen, dass nichts davon gespeichert wird.
`POST /attrappe/ausfall?an=1` stellt einen Ausfall nach, `POST /attrappe/schluesselwechsel` einen Schlüsselwechsel.
