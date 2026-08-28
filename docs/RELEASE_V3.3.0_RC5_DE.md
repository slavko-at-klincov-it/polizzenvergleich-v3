# Polizzenvergleich V3.3.0 RC5 – gemeinsamer Evidenzpfad für alle Kategorien

Stand: 28. August 2026

Release-Tag: `v3.3.0-rc.5`

## Zweck

RC5 ist der erste Release Candidate, der den evidenzgebundenen V3.3-Pfad für
alle acht Ansichten `VS`, `FE`, `LW`, `ST`, `EL`, `HP`, `VB` und `WE`
technisch ausführt. Er ersetzt nicht die fachliche Abnahme der sieben neuen
Ansichten. Der Kundenlauf soll erstmals messen, ob der gemeinsame Pfad die
eingefrorene monolithische 320-Zeilen-Baseline qualitativ verbessert.

## Wesentliche Änderungen

- Das PDF wird einmal seitengetreu vorbereitet und für alle Ansichten
  wiederverwendet.
- Rollen-, Scope-, Wirkungs- und Werteverträge sind kategorieneutral; die
  bereits validierten VS-Spezialregeln bleiben erhalten.
- Eine allgemeine Deckungsregel und eine enge Ausnahme bleiben getrennt.
- Lokale Beträge, Selbstbehalte, Fristen, Intervalle, Schwellenwerte, Daten und
  Bedingungen werden quellengebunden materialisiert.
- Der neue Runner erzeugt alle 320 Tabellenzeilen und einen Gesamtbericht.
- Ein abgebrochener Lauf kann mit demselben expliziten Ausgabeordner fortgesetzt
  werden; fertige Kategorien werden übersprungen.

## Nachweis vor dem Kundenlauf

```text
73 Jest-Suites / 793 Tests: PASS
Lint der geänderten Laufzeitdateien: PASS
Syntax, Formatierung und Git-Diff-Prüfung: PASS
Generischer ST-Materialisierer, 36/36 Zeilen: PASS
LF-ST-Gegenprobe, 8/8 kritische Komponenten: PASS
WEVIG-ST-Gegenprobe mit abweichenden Formulierungen: PASS
```

Der alte LF-Lauf lieferte für ST-04, ST-06 und ST-11 jeweils ein falsches
`Nein`. RC5 trennt die enge Schnee-/Eisrutsch-Ausnahme von der allgemeinen
Hagel- und Schneedruckdeckung:

```text
ST-04 Dach + Fassade: INCLUDED / GENERAL
ST-06 Dach + Tragkonstruktion: INCLUDED / GENERAL
ST-11 eigenes Sublimit: UNKNOWN statt falschem EXCLUDED
```

## Beweisgrenze

```text
GO: kontrollierter LF-Gesamtlauf mit Qwen 3.8 27B auf dem Kunden-Mac-Studio
REVIEW_REQUIRED: qualitativer 320-Zeilen-Vergleich gegen die alte Baseline
REVIEW_REQUIRED: Fachoracles für FE, LW, ST, EL, HP, VB und WE
NO CLAIM: allgemeine 99-Prozent-Genauigkeit oder finale V3.3.0-Freigabe
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.5
./doctor.command
```

## Vollständiger LF-Lauf

```bash
cd "$HOME/Code/polizzenvergleich-v3"

./run-all-categories-quality.command \
  "/ABSOLUTER/PFAD/LF-GENERALI.pdf" \
  FRAMEWORK_TERMS
```

Der Runner gibt am Ende den Ergebnisordner sowie einen fertigen ZIP-Befehl für
die Übermittlung der privaten Diagnoseartefakte aus.
