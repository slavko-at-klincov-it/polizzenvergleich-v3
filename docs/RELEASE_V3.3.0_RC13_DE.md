# Polizzenvergleich V3.3.0 RC13 – vollständiger EL-Vandalismusscope

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.13`

## Zweck

RC13 schließt den einzigen im vollständigen RC12-LF-Gegenlauf verbliebenen
Scopefehler. `EL-25` beschreibt Vandalismus ohne vorangegangenen Einbruch.
Eine ausdrücklich aktivierte Feuer-Erweiterung mit genau diesem Risiko ist
deshalb ein gültiger enger Vertragsbeleg und keine fachfremde Erwähnung.

## Änderung

- `EL-25` akzeptiert `FEUER_INSURANCE` als katalogisierten engen Scope.
- Ein positiver passender Scope reicht für den vollständigen Einzelbeleg.
- Voll- und Pilotkatalog tragen denselben Vertrag.
- Modellprompt, Modellparameter, Extraktion, übrige Kategorien und allgemeine
  Fremdsparten-Sperren bleiben unverändert.

## Nachweis auf dem Mac Studio mit Qwen 3.8 27B

Der vollständige RC12-LF-Lauf erzeugte alle 320 Zeilen. Gegenüber dem
akzeptierten RC9-LF-Lauf blieben VS, FE, HP und VB vollständig byte-identisch.
LW-11, ST-14 und WE-09 verloren jeweils eine nachweislich fachfremde Quelle.
EL-10 und EL-21 verbesserten sich. Dabei wurde EL-25 als einziger Restfehler
sichtbar.

Ein anschließend frischer EL-Lauf mit der RC13-Regel ergab:

```text
LF:    EL-25 BELEGT / Ja
       Quelle: ausdrücklicher erweiterter Vandalismus ohne Einbruch
       ausschließlich EL-25 geändert; übrige 35 EL-Zeilen stabil

WEVIG: EL-25 UNGEKLÄRT
       keine passende Vertragsstelle erfunden
       alle 36 EL-Zeilen semantisch stabil

beide Läufe: sämtliche Artefakt- und Tabellen-Gates bestanden
89 Jest-Suites / 977 Tests bestanden
Server-, Frontend- und Collector-Lint bestanden
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.13
./doctor.command
```

## Beweisgrenze

RC13 ist gegen die zwei derzeitigen realen Referenzdokumente LF und WEVIG
geprüft. Das belegt den konkreten qualitativen Vorteil und die Regression der
bekannten Fälle, aber keine mathematische 99-Prozent-Garantie für beliebige
zukünftige Polizzen ohne vollständige fachliche Oracles.
