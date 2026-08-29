# Polizzenvergleich V3.3.0 RC19 – Beschriftete Versicherungsperiode

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.19`

## Zweck

RC19 schließt einen Rollen- und Satzgrenzenfehler in `FE-F05`. WEVIG enthält
auf der ersten PDF-Seite eine ausdrückliche Zugangsbedingung sowie die
beschrifteten Werte `Versicherungsbeginn 19.01.2026` und
`Versicherungsablauf 01.01.2037`. Der bisherige Satztrenner behandelte den
ersten Punkt im Startdatum als Satzende. Sichtbar blieb deshalb nur
`Versicherungsbeginn 19`; das Datumsfeld war `NOT_FOUND` und die getrennte
Komponente der zeitlichen Geltung hatte keine Fundstelle.

## Änderung

- Die FE-Taxonomie erkennt `Versicherungsablauf` und `Ablauf der Versicherung`
  als Rollenanker der zeitlichen Geltung.
- Eine vollständig beschriftete Start-/Ablaufzeile wird nur in `FE-F05` als
  operative Versicherungsperiode autoritativ `DIRECT / DEFINED` gebunden.
- Das Startdatum wird ausschließlich hinter `Versicherungsbeginn` oder
  `Beginn der Versicherung` extrahiert und mit exaktem Quellspan als `DATE`
  gespeichert.
- Die Zugangsbedingung und die vollständige Periodenzeile bleiben getrennte
  `condition`-Fakten. Punkte innerhalb eines Datums schneiden sie nicht mehr
  ab.

## Sicherheitsgrenzen

- Eine Druck-, Angebots- oder sonstige unbeschriftete Datumsangabe ist kein
  Versicherungsbeginn.
- `Versicherungsbeginn 19.` ist kein vollständiges Datum.
- Nur Start ohne Ablauf oder Ablauf ohne Start beweist keine vollständige
  Versicherungsperiode.
- Der Startwert wird nur an die Komponente `coverage_start` gebunden; das
  Ablaufdatum wird nicht fälschlich als Startdatum ausgegeben.
- Versicherer, Dokumentname und Seitennummer sind keine Produktionsregeln.

## Nachweis vor dem Mac-Studio-Lauf

```text
91/91 Jest-Suites, 1028/1028 Tests: PASS
Server-, Frontend- und Collector-ESLint: PASS
Prettier und git diff --check: PASS
Positive Start-/Ablauf- und Zugangsvarianten: PASS
Unvollständige und rollenfremde Datumsvarianten: PASS

Echter WEVIG-FE-27B-Replay:
  Kandidaten 44 -> 45, genau eine neue FE-F05-Fundstelle
  80/80 Endzeilen verglichen
  ausschließlich FE-F05 verbessert
  TEILBELEGT / Versicherungsbeginn 19
    -> BELEGT / Ja
       vollständige Periode und Datum 19.01.2026
  übrige 79 FE-Zeilen unverändert

LF-FE-Worksheet-Kontrolle:
  25 -> 25 Kandidaten, keine neue Fundstelle
```

## Mac-Studio-Nachweis

Die Vorabfassung dieses Dokuments nannte irrtümlich 36 FE-Endzeilen. Der
FE-Vertrag besitzt 80 Endzeilen; die Zahlen sind hier nach dem vollständigen
Lauf korrigiert. Der unveränderliche RC19-Tag selbst bleibt unangetastet.

RC19 wurde auf dem Mac Studio installiert. Update, integrierter Doctor,
separater Doctor, Tag, SHA und sauberer Checkout wurden geprüft. Zwei frische
Läufe mit `qwen/qwen3.8-27b` ergaben:

```text
WEVIG-FE:
  45/45 Triage-Kandidaten
  138/138 atomare Komponenten
  80/80 Endzeilen
  21 ausgewählte Quellen

Vollständiger Vergleich gegen den akzeptierten RC11-FE-Lauf:
  nur FE-F05 verbessert
  TEILBELEGT / "Versicherungsbeginn 19"
    -> BELEGT / Ja
       Versicherungsbeginn 19.01.2026
       Versicherungsablauf 01.01.2037
  übrige 79 FE-Zeilen semantisch identisch

LF-FE-Kontrolllauf:
  25/25 Triage-Kandidaten
  138/138 atomare Komponenten
  80/80 Endzeilen
  13 ausgewählte Quellen
  0 semantische Änderungen gegenüber dem akzeptierten RC12-FE-Lauf
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.19
./doctor.command
```

## Beweisgrenze

Die Änderung belegt ausdrücklich beschriftete Start-/Ablaufzeilen. Andere
Datumsformulierungen bleiben offen. LF und WEVIG sind bekannte
Regressionsexemplare; externe Generalisierung und fachliche Gesamtfreigabe
sind damit nicht bewiesen.
