# Polizzenvergleich V3.3.0 RC32 – Haftpflichtsummen aus Produktübersichten

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.32`

## Zweck

RC32 schließt zwei belegte Recall-Lücken in kompakten
Haftpflicht-Produktübersichten:

- `HP-01`: Eine eigenständige `Pauschalversicherungssumme` im
  Haftpflichtkapitel wird als gemeinsame Deckungssumme für Personen- und
  Sachschäden erkannt.
- `HP-08`: Die Produktform `Bauherr - Umbau-, Neubau- und
  Sanierungshaftpflichtrisiko` wird zusammen mit ihrer ausdrücklich genannten
  Gesamtbaukostengrenze erkannt.

Bloße Verweise auf eine Pauschalversicherungssumme, Sublimits und
Kostenanrechnungen sind für `HP-01` ausdrücklich nicht beweisend. Bei `HP-08`
wird die Gesamtbaukostengrenze getrennt vom danebenstehenden
Haftpflicht-Sublimit materialisiert.

## Reale 27B-Abnahme

### WEVIG

```text
34/34 Triage-Kandidaten
63/63 atomare Komponenten
36/36 HP-Endzeilen
13 ausgewählte Quellen

HP-01:
  UNGEKLÄRT / Nicht feststellbar
  -> BELEGT / Ja / EUR 3.000.000,00

HP-08:
  UNGEKLÄRT / Nicht feststellbar
  -> BELEGT / Ja / EUR 1.000.000 Gesamtbaukosten

Übrige 34 HP-Zeilen exakt identisch.
```

### LF

```text
61/61 Triage-Kandidaten
63/63 atomare Komponenten
36/36 HP-Endzeilen
27 ausgewählte Quellen

HP-08 bleibt BELEGT / Ja:
  EUR 440.000 oder 20 % des Gebäudeneuwerts

HP-02 und HP-21 variieren nur in der Qwen-Textwiedergabe;
Status, Deckung, Betrag und Quelle bleiben unverändert.
Alle übrigen HP-Zeilen bleiben semantisch stabil.
```

Artefakte:

```text
RC32-WEVIG-HP-CANDIDATE-20260829-131001
RC32-LF-HP-CONTROL-20260829-131801
```

## Technische Gates

```text
PASS: 93 Jest-Suites / 1079 Tests
PASS: Server-Lint, Prettier und git diff --check
PASS: reale WEVIG- und LF-Worksheets mit enger Scope-Bindung
PASS: frische WEVIG- und LF-HP-27B-Läufe
PASS: exakter 36-Zeilen-Diff gegen RC22
PASS: Tag a39f90db auf Mac Studio installiert; beide Doctor-Läufe grün
PASS: exakter Tag/SHA und sauberer Ziel-Checkout bestätigt
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.32
./doctor.command
```

## Beweisgrenze

RC32 beweist nur eine eigenständige Pauschalversicherungssumme im
Haftpflicht-Scope und eine Bauherren-Klausel mit lokal genannter
Gesamtbaukostengrenze. Ein referenziertes Sublimit, eine Kostenanrechnung oder
eine Pauschalsumme aus einer anderen Sparte erzeugt keine positive Deckung.
