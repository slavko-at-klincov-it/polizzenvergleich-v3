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

## Kumulative Vollabnahme RC33

Nach der Kategorieabnahme wurde der exakt installierte RC33-Tag mit beiden
Dokumenten noch einmal über alle acht Kategorien ausgeführt.

```text
WEVIG: 320/320 Zeilen, 15 Statusverbesserungen gegenüber RC11, 0 Regressionen
LF:    320/320 Zeilen, 17 Statusverbesserungen gegenüber RC12, 0 Regressionen
Gesamt: 640/640 Zeilen, 32 Statusverbesserungen, 0 Regressionen
```

Artefakte:

```text
RC33-WEVIG-ALL-CATEGORIES-20260829-135136
RC33-LF-ALL-CATEGORIES-20260829-145113
```

WEVIG verbessert `VS-21`, `VS-28`, `FE-E16`, `FE-F05`, `LW-03`, `LW-04`,
`LW-05`, `LW-08`, `LW-26`, `ST-27`, `HP-01`, `HP-08`, `VB-01`, `VB-27`
und `VB-36`. LF verbessert `FE-E16`, `FE-F02`, `LW-08`, `LW-11`, `LW-31`,
`ST-16`, `ST-34`, `EL-01`, `EL-05`, `EL-11`, `EL-15`, `EL-25`, `HP-02`,
`HP-24`, `HP-27`, `VB-16` und `VB-26`.

## Technische Gates

```text
PASS: 93 Jest-Suites / 1085 Tests
PASS: Server-Lint, Prettier und git diff --check
PASS: gemeinsamer kontrollierter Span für beide VB-36-Rollen
PASS: frische WEVIG- und LF-VB-27B-Läufe
PASS: exakter 36-Zeilen-Diff gegen RC29
PASS: Tag 3ef0e950 auf Mac Studio installiert; beide Doctor-Läufe grün
PASS: exakter Tag/SHA und sauberer Ziel-Checkout bestätigt
PASS: kumulative Fullruns mit 640/640 Zeilen und 0 Statusregressionen
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
