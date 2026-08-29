# Polizzenvergleich V3.3.0 RC27 – stabile Gemeinschaftseinrichtungen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.27`

## Zweck

RC27 beseitigt eine Modellstreuung bei `VS-34`. WEVIG enthält eine
Klauselüberschrift zu gemeinschaftlichen Einrichtungen, unmittelbar gefolgt
vom positiven Governor `Als mitversichert gelten` und der konkreten
Gerätedefinition. Qwen bewertete dieselbe Überschrift in zwei vollständigen
Läufen einmal als bloße Erwähnung und einmal als `UNRESOLVED`. Der zweite Fall
stufte die ansonsten vollständig belegte Zeile auf `TEILBELEGT` zurück.

Die Korrektur bindet nur die enge Struktur
`gemeinschaftliche Einrichtungen ... Als mitversichert gelten`
serverautoritativ. Eine bloße Überschrift ohne positiven Governor bleibt
modelloffen. LF besitzt keinen neu erfassten Kandidaten.

## Reale WEVIG-27B-Abnahme

Der vollständige VS-Lauf verwendete `qwen/qwen3.8-27b` und den gesamten
Produktionspfad:

```text
155/155 Triage-Kandidaten
65/65 atomare Komponenten
36/36 VS-Endzeilen
121 ausgewählte Quellen
```

Gegenüber dem unmittelbar vorherigen RC26-Lauf änderte sich semantisch exakt
eine Zeile:

```text
VS-34:
  TEILBELEGT / Nicht feststellbar
  -> BELEGT / Ja / Gemeinschaftsgeräte: EUR 15.000,00 auf Erstes Risiko
```

`VS-21` bleibt `BELEGT / Ja / EUR 6.121.600,00 auf Erstes Risiko` und
`VS-28` bleibt `BELEGT / Ja / 6 Monate`. Die übrigen 33 VS-Zeilen sind
semantisch identisch.

Artefakt:

```text
RC27-WEVIG-VS-CANDIDATE-20260829-114115
```

## Technische Gates

```text
PASS: 93 Jest-Suites / 1062 Tests
PASS: Server-Lint
PASS: Prettier und git diff --check
PASS: echte WEVIG-Worksheet-Reichweite – genau ein neu gebundener Kandidat
PASS: LF-Worksheet-Reichweite – kein neu gebundener Kandidat
PASS: frischer WEVIG-VS-27B-Lauf und exakter 36-Zeilen-Vergleich
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.27
./doctor.command
```

## Beweisgrenze

RC27 beweist die konkrete allgemeine Klauselstruktur an den zwei vorhandenen
Referenzdokumenten. Bloße Überschriften, andere Gemeinschaftsobjekte und
unbekannte Versicherer bleiben ohne positiven lokalen Governor fail-closed.
