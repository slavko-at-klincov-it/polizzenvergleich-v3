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
  36/36 Endzeilen verglichen
  ausschließlich FE-F05 verbessert
  TEILBELEGT / Versicherungsbeginn 19
    -> BELEGT / Ja
       vollständige Periode und Datum 19.01.2026
  übrige 35 FE-Zeilen unverändert

LF-FE-Worksheet-Kontrolle:
  25 -> 25 Kandidaten, keine neue Fundstelle
```

## Mac-Studio-Nachweis

Noch ausständig. RC19 wird erst nach Installation des unveränderlichen Tags,
beiden Doctor-Prüfungen, einem frischen WEVIG-FE-Lauf mit
`qwen/qwen3.8-27b` und einem LF-FE-Kontrollvergleich bewertet.

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
