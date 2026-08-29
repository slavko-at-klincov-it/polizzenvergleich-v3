# Polizzenvergleich V3.3.0 RC12 – vollständiger VS-Sachspartenscope

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.12`

## Zweck

RC12 schließt die letzte im vollständigen WEVIG-RC11-Lauf sichtbare
Statusunterbewertung. Die Inhalte von VS-21 und VS-28 waren bereits korrekt
gefunden und atomar bewertet, wurden wegen ihres ausdrücklich engen
Sachspartenscopes jedoch nur als Teilbeleg gerendert.

## Änderung

- `VS-21` (Aufräum- und Abbruchkosten) und `VS-28` (Mietzinsentgang und Dauer)
  verwenden `MATCHING_SCOPE_INCLUDED_SUFFICIENT`.
- Dies gilt ausschließlich für die bereits katalogisierten ScopeKeys Feuer,
  Leitungswasser, Sturm und Glasbruch.
- Kandidaten, Modellprompts, Modellparameter, Wirkungsentscheidungen und
  Fremdsparten-Sperren bleiben unverändert.
- Voll- und Pilotkatalog tragen denselben Vertrag.

## Nachweis mit frischem RC11-27B-Artefakt

```text
VS-21: BELEGT / Ja / EUR 6.121.600,00 auf Erstes Risiko
VS-28: BELEGT / Ja / Dauer 6 Monate
36/36 VS-Zeilen materialisiert
120 ausgewählte VS-Quellen unverändert
89 Jest-Suites / 977 Tests bestanden
Server-, Frontend- und Collector-Lint bestanden
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.12
./doctor.command
```

## Beweisgrenze

RC12 ändert nur den deterministischen Status-/Deckungsabschluss für zwei
bereits vollständig belegte VS-Zeilen. Der große Folge-Test ist deshalb das
LF-Gesamtregressionsgate; WEVIG wird aus dem frischen RC11-Qwen-Artefakt mit
dem RC12-Katalog erneut materialisiert. Eine 99-Prozent-Aussage bleibt ohne
vollständige fachliche Oracles ausgeschlossen.
