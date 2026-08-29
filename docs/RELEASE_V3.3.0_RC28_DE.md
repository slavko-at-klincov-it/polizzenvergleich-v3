# Polizzenvergleich V3.3.0 RC28 – Regressverzicht für Mieter und Haushaltsangehörige

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.28`

## Zweck

RC28 schließt die nachweisbare Recall- und Bindungslücke bei `VB-16`. Das
LF-Dokument regelt auf Seite 26 ausdrücklich den Regressverzicht gegenüber
einem Mieter des versicherten Gebäudes und einem mit ihm in häuslicher
Gemeinschaft lebenden Familienangehörigen. Die Pipeline erkannte zuvor nur
die Überschrift `Regressverzicht`; Mieter und Bewohner blieben unbekannt.

Die bereits für `HP-16` bewiesene reale Mieterklausel wird nun auch im
allgemeinen Vertragsbereich für `VB-16` verwendet. Die Bewohnerkomponente
wird nur gebunden, wenn derselbe Klauselkontext die häuslich lebenden
Familienangehörigen ausdrücklich nennt. `VB-15` für Wohnungseigentümer bleibt
unverändert offen.

## Reale 27B-Abnahme

### LF

```text
37/37 Triage-Kandidaten
52/52 atomare Komponenten
36/36 VB-Endzeilen
24 ausgewählte Quellen

VB-16:
  TEILBELEGT / Nicht feststellbar
  -> BELEGT / Ja
  Regressverzicht, Bewohner und Mieter jeweils eingeschlossen

VB-15:
  unverändert UNGEKLÄRT
```

Status, Deckung und Betrag der übrigen 34 VB-Zeilen bleiben unverändert. Vier
bereits belegte Zeilen zeigen gegenüber der älteren RC20-Baseline nur die seit
RC26 vollständigeren Bedingungssätze.

### WEVIG

```text
20/20 Triage-Kandidaten
52/52 atomare Komponenten
36/36 VB-Endzeilen
9 ausgewählte Quellen
0 semantische Änderungen gegenüber RC20
VB-15 und VB-16 weiterhin UNGEKLÄRT
```

Artefakte:

```text
RC28-LF-VB-CANDIDATE-20260829-115322
RC28-WEVIG-VB-CONTROL-20260829-120636
```

## Technische Gates

```text
PASS: 93 Jest-Suites / 1064 Tests
PASS: Server-Lint
PASS: Prettier und git diff --check
PASS: LF-Worksheet – alle drei VB-16-Komponenten aus derselben realen Klausel
PASS: WEVIG-Worksheet – kein neuer VB-15-/VB-16-Kandidat
PASS: frische LF- und WEVIG-VB-27B-Läufe
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.28
./doctor.command
```

## Beweisgrenze

RC28 beweist die konkrete, versichererneutrale Mieterklausel mit ausdrücklich
genannten Haushaltsangehörigen. Eine reine Mieternennung beweist keine
Bewohnerdeckung; Mieter beweisen keine Wohnungseigentümer; unbekannte
Formulierungen bleiben fail-closed.
