# Polizzenvergleich V3.3.0 RC33 – Schadenservice und Ansprechpartner belegen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.33`

## Zweck

RC33 schließt die Recall-Lücke bei `VB-36`. Ein Produkt kann die
Schadenabwicklung nicht als klassische Vertragsklausel, sondern als konkreten
Serviceblock formulieren. WEVIG nennt ein rund um die Uhr erreichbares
Schadenmanagement unter `0800 204 44 00`, eine telefonische Schadenmeldung
sowie Beratung und Hilfestellung.

Die serverseitige Bindung verlangt gemeinsam Schadenmanagement, eine lokale
Telefonnummer, Rund-um-die-Uhr-Erreichbarkeit, telefonische Schadenmeldung und
eine ausdrückliche Unterstützungsleistung. Allgemeine Kontaktdaten oder eine
isolierte Schadenmanagement-Überschrift reichen nicht.

## Reale 27B-Abnahme

### WEVIG

```text
22/22 Triage-Kandidaten
52/52 atomare Komponenten
36/36 VB-Endzeilen
11 ausgewählte Quellen

VB-36:
  UNGEKLÄRT / Nicht feststellbar
  -> BELEGT / Ja
  Schadenabwicklung und Ansprechpartner aus demselben Seite-6-Serviceblock

Übrige 35 VB-Zeilen exakt identisch.
```

### LF

```text
37/37 Triage-Kandidaten
52/52 atomare Komponenten
36/36 VB-Endzeilen
25 ausgewählte Quellen
0 Änderungen gegenüber RC29
kein neuer Schadenmanagement-Kandidat
```

Artefakte:

```text
RC33-WEVIG-VB-FINAL-20260829-134237
RC33-LF-VB-CONTROL-20260829-134520
```

## Technische Gates

```text
PASS: 93 Jest-Suites / 1085 Tests
PASS: Server-Lint, Prettier und git diff --check
PASS: gemeinsamer kontrollierter Span für beide VB-36-Rollen
PASS: frische WEVIG- und LF-VB-27B-Läufe
PASS: exakter 36-Zeilen-Diff gegen RC29
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.33
./doctor.command
```

## Beweisgrenze

RC33 beweist nur einen vollständigen, lokal zusammenhängenden
Schadenserviceblock. Eine Telefonnummer, ein allgemeiner Kundenservice oder
eine bloße Überschrift wird nicht als Regelung zu Schadenabwicklung und
Ansprechpartner ausgegeben.
