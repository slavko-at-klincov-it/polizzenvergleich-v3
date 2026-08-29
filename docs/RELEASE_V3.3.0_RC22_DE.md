# Polizzenvergleich V3.3.0 RC22 – Haftpflichtbedingungen getrennt vom Deckungsbild

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.22`

## Zweck

RC22 schließt zwei falsche Herabstufungen in der Haftpflichtauswertung. Bei
LF waren `HP-24` und `HP-27` vollständig quellengebunden. Die eigentliche
Leistung beziehungsweise Schadendeckung war eingeschlossen; die zugehörige
Bedingung war korrekt als `CONDITIONAL` klassifiziert. Weil beide Rollen das
Deckungsbild gemeinsam bestimmten, wurde die sichtbare Zeile trotzdem
`TEILBELEGT / Nicht feststellbar`.

## Änderung

- `HP-24` und `HP-27` verwenden die bereits in RC15 bewiesene
  `COVERAGE_ROLES_ONLY`-Aggregation.
- Alle Pflichtkomponenten bleiben für Evidenzvollständigkeit, Text, Quellen
  und Konflikte erforderlich.
- Nur die deckungsentscheidende Kosten- beziehungsweise Schadensrolle bestimmt
  `Ja`, `Nein` oder `Gemischt`.
- Eine gefundene Bedingung kann eine belegte Deckung nicht mehr in
  `Nicht feststellbar` umwandeln.

## Sicherheitsgrenzen

- Die Policy ist ausschließlich für `HP-24` und `HP-27` katalogisiert.
- Fehlende Abwehrkosten oder fehlende Personalschadendeckung bleiben offen.
- `UNKNOWN`, `OPTION_ONLY`, ungelöste Kandidaten und fehlende Pflichtwerte
  werden nicht freigegeben.
- Die Bedingung bleibt sichtbar und quellengebunden; sie wird nicht verworfen.
- Versicherer, Dokumentname und Seite sind keine Aktivierungsmerkmale.

## Lokaler Nachweis

```text
91/91 Jest-Suites, 1037/1037 Tests: PASS
Server-, Frontend- und Collector-ESLint: PASS
git diff --check: PASS

LF-HP-Artefaktreplay:
  36/36 Zeilen verglichen
  nur HP-24 und HP-27 verbessert
  übrige 34 Zeilen semantisch identisch

WEVIG-HP-Kontrollreplay:
  36/36 Zeilen verglichen
  0 semantische Änderungen
```

## Mac-Studio-Nachweis

Der funktionale Commit `40ed3ba4` wurde sauber mit `qwen/qwen3.8-27b`
geprüft:

```text
LF-HP:
  37/37 Triage-Kandidaten
  63/63 atomare Komponenten
  36/36 Endzeilen
  27 ausgewählte Quellen
  gegenüber RC18 nur HP-24 und HP-27 verbessert
  TEILBELEGT / Nicht feststellbar -> BELEGT / Ja
  übrige 34 HP-Zeilen semantisch identisch

WEVIG-HP:
  23/23 Triage-Kandidaten
  63/63 atomare Komponenten
  36/36 Endzeilen
  8 ausgewählte Quellen
  0 semantische Änderungen gegenüber RC18
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.22
./doctor.command
```

## Beweisgrenze

LF belegt die beiden positiven Rollenverträge, WEVIG die fehlende
Deckungskomponente als Negativgate. Andere Anforderungen erhalten die Policy
nicht automatisch. Externe Holdouts und die fachliche Freigabe aller
HP-Zeilen bleiben offen.
