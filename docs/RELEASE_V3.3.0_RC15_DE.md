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

Vor Freigabe werden mit dem unveränderlichen RC15-Tag frische
`qwen/qwen3.8-27b`-Läufe für WEVIG-LW und LF-EL ausgeführt. Die Ergebnisse
werden anschließend hier und im Implementierungs-Tracker dokumentiert.

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
