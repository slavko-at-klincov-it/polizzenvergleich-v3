# Polizzenvergleich V3.3.0 RC15 – Rollengetrenntes Deckungsbild und definitiver Host-Scope

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.15`

## Zweck

RC15 korrigiert zwei allgemeine Vertragsauswertungsfehler nach bereits
vollständiger Fundstellen- und Wirkungsprüfung:

1. Eine erforderliche Bedingung mit Wirkung `CONDITIONAL` durfte bislang eine
   ausdrücklich eingeschlossene versicherte Sache im gemeinsamen Deckungsbild
   auf `Nicht feststellbar` zurücksetzen.
2. Definitive, aber gemischte Wirkungen (`INCLUDED` und `EXCLUDED`) wurden in
   einem ausdrücklich katalogisierten passenden Versicherungsscope trotzdem
   als unvollständig verworfen.

Die Korrektur ist deklarativ und fail-closed. Sie gilt nicht global für jede
Bedingung oder jeden engeren Scope.

## Änderung

- Der Kategorie-Rollup kann für ausdrücklich katalogisierte Anforderungen
  zwischen deckungsentscheidenden Komponenten und weiterhin erforderlichen
  unterstützenden Fakten unterscheiden.
- `LW-03` und `LW-04` verwenden diese Rollenaggregation. Rohr und Ortsbedingung
  bleiben beide Pflicht; nur das Rohr entscheidet über `Ja/Nein/Gemischt`.
- `EL-05` akzeptiert im bereits erlaubten Sturm-Host-Scope eine servergebundene
  unterstützende Definition oder Bedingung, ohne `UNKNOWN` oder `OPTION_ONLY`
  freizugeben.
- `EL-15` verwendet eine neue ausdrückliche Policy für definitive positive
  und negative Wirkungen im erlaubten Glas-Host-Scope.
- Die definitive Scope-Policy ist ohne konkrete `narrowScopeKeys` ungültig.
- Eine Rollenaggregation ohne mindestens eine deckungsentscheidende
  Komponente ist ungültig.
- Das sparse Dokument-Oracle enthält neue `DRAFT`-Erwartungen für WEVIG
  `LW-03/04` und LF `EL-05/15`.

## Sicherheitsgrenzen

- Eine deckungsentscheidende `PERIL`-, `BENEFIT`- oder
  `INSURED_OBJECT`-Komponente mit `CONDITIONAL` bleibt `Nicht feststellbar`.
- Eine unterstützende `OPTION_ONLY`-Komponente bleibt partiell.
- Fremdscope, `UNKNOWN`, ungelöste Kandidaten und nicht katalogisierte enge
  Scopes bleiben gesperrt.
- `ST-27` besitzt keine freigebende Scope-Policy und bleibt deshalb bewusst
  `TEILBELEGT / Nicht feststellbar`.

## Nachweis vor dem Mac-Studio-Lauf

```text
91/91 Jest-Suites, 998/998 Tests: PASS
Server-, Frontend- und Collector-ESLint: PASS
Prettier und git diff --check: PASS
Replay von 640 Endzeilen mit eingefrorenen Qwen-Artefakten: PASS

Neue beabsichtigte Änderungen:
  WEVIG LW-03: TEILBELEGT / Nicht feststellbar -> BELEGT / Ja
  WEVIG LW-04: TEILBELEGT / Nicht feststellbar -> BELEGT / Ja
  LF EL-05:    TEILBELEGT / Nicht feststellbar -> BELEGT / Ja
  LF EL-15:    TEILBELEGT / Nicht feststellbar -> BELEGT / Gemischt

Keine neue Änderung in HP, FE, ST, VB oder WE.
ST-27 bleibt unverändert fail-closed.
```

## Mac-Studio-Nachweis

RC15 wurde als unveränderlicher Tag auf dem Mac Studio installiert. Update,
integrierter Doctor, separater Doctor, Tag, SHA und sauberer Checkout wurden
geprüft. Zwei frische Läufe mit `qwen/qwen3.8-27b` ergaben:

```text
WEVIG-LW:
  33/33 Triage-Kandidaten
  52/52 atomare Komponenten
  36/36 Endzeilen
  24 ausgewählte Quellen
  127/127 DRAFT-Oracle-Aussagen

LF-EL:
  48/48 Triage-Kandidaten
  69/69 atomare Komponenten
  36/36 Endzeilen
  40 ausgewählte Quellen
  76/76 DRAFT-Oracle-Aussagen
```

Der vollständige Vergleich mit den zuletzt akzeptierten Kategorie-Läufen
zeigt exakt die vier beabsichtigten Unterschiede:

```text
WEVIG-LW gegen RC14: nur LW-03 und LW-04 verbessert
LF-EL gegen RC13:    nur EL-05 und EL-15 verbessert
alle übrigen 68 Endzeilen semantisch identisch
```

Die RC14-Korrekturen bleiben erhalten: `LW-05` ist `BELEGT / Ja`; `LW-26`
enthält beide belegten Einschlüsse, bleibt wegen des fehlenden Limits aber
korrekt `TEILBELEGT / Nicht feststellbar`.

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.15
./doctor.command
```

## Beweisgrenze

Die neuen Oracle-Zeilen bleiben `DRAFT`, bis ein fachlicher Reviewer sie
explizit freigibt. RC15 verbessert allgemeine, kataloggesteuerte
Entscheidungsverträge; es behauptet keine mathematische 99-Prozent-Garantie
für beliebige zukünftige Polizzen.
