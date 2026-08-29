# Polizzenvergleich V3.3.0 RC29 – Sachverständigenverfahren vollständig belegen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.29`

## Zweck

RC29 schließt eine nachweisbare Bindungslücke bei `VB-24`. Das LF-Dokument
räumt dem Versicherungsnehmer auf PDF-Seite 30 ausdrücklich das Recht ein,
bei Uneinigkeit mit dem vom Versicherer bestellten Sachverständigen einen
eigenen Sachverständigen namhaft zu machen. Dessen Gutachten tritt an die
Stelle des Schiedsgutachterverfahrens.

Die bisherige Pipeline fand diesen vollständigen Satz, verwarf ihn aber, weil
ein verfahrensrechtlicher Anspruch keinen klassischen Deckungs-Governor wie
`mitversichert` enthält. RC29 bindet nur den vollständigen Drei-Anker-Satz:
Uneinigkeit mit dem Versicherer-Gutachten, Recht auf Benennung eines anderen
Sachverständigen und Ersetzung des Schiedsgutachterverfahrens. Überschriften,
Kostenklauseln und Treffer in fremden Versicherungskapiteln bleiben offen.

## Reale 27B-Abnahme

### LF

```text
37/37 Triage-Kandidaten
52/52 atomare Komponenten
36/36 VB-Endzeilen
25 ausgewählte Quellen

VB-24:
  Sachverständigenverfahren: nicht feststellbar
  -> eingeschlossen, mit Beleg von PDF-Seite 30

Exakt 1 von 36 Zeilen geändert; die übrigen 35 Zeilen sind identisch.
```

`VB-24` bleibt insgesamt korrekt `TEILBELEGT`, weil die Kostentragung nur
bedingt vereinbart ist. Die Verbesserung besteht darin, dass der zuvor
verlorene Verfahrensanspruch nun vollständig und quellengebunden ausgegeben
wird; sie erzwingt keine sachlich falsche Vollabdeckung.

### WEVIG

```text
20/20 Triage-Kandidaten
52/52 atomare Komponenten
36/36 VB-Endzeilen
9 ausgewählte Quellen
0 Differenzen gegenüber RC28
```

Artefakte:

```text
RC29-LF-VB-CANDIDATE-20260829-122244
RC29-WEVIG-VB-CONTROL-20260829-122703
```

## Technische Gates

```text
PASS: 93 Jest-Suites / 1065 Tests
PASS: fokussierte Regeltests einschließlich Negativfällen
PASS: Server-Lint, Prettier und git diff --check
PASS: reale LF-Vorbereitung bindet genau den vollständigen VB-24-Satz
PASS: WEVIG-Vorbereitung erzeugt keinen VB-24-Kandidaten
PASS: frische LF- und WEVIG-VB-27B-Läufe
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.29
./doctor.command
```

## Beweisgrenze

RC29 beweist einen ausdrücklich geregelten Sachverständigenverfahrensanspruch.
Eine bloße Überschrift beweist kein Verfahren; eine
Sachverständigenkostenregel beweist kein Benennungsrecht; bedingte
Kostentragung wird nicht in eine uneingeschränkte Leistung umgedeutet.
