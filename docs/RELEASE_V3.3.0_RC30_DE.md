# Polizzenvergleich V3.3.0 RC30 – Heizungsanlage in Leitungswasser vollständig belegen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.30`

## Zweck

RC30 schließt die verbleibende Recall-Lücke bei `LW-11`. Das LF-Dokument
nennt im Leitungswasserkapitel Zentral- und Fußbodenheizungsanlagen und sagt
ausdrücklich, dass eine wasserführende Fußboden- und Wandheizung
mitversichert ist. Heizkessel und Heizkörper waren bereits auf der Folgeseite
belegt; die zusammengesetzte Heizungsformulierung wurde bisher nur für
`LW-12`, nicht als Heizungsanlage in `LW-11`, erkannt.

RC30 ergänzt die versichererneutralen Synonyme `Fußboden- und Wandheizung`
und `Wasser führende Fußboden- und Wandheizung` für die
Heizungsanlagenkomponente. Die normale Scope-Prüfung bleibt unverändert: Ein
ähnlicher Heizungsanlagen-Treffer im Feuerkapitel wird weiterhin als fremder
Spartenkontext verworfen.

## Reale 27B-Abnahme

### LF

```text
36/36 Triage-Kandidaten
52/52 atomare Komponenten
36/36 LW-Endzeilen
27 ausgewählte Quellen

LW-11:
  TEILBELEGT / Nicht feststellbar
  -> BELEGT / Ja
  Heizungsanlage, Heizkessel und Heizkörper jeweils eingeschlossen
```

Gegen den aktuellen Vorzustand ändert sich nur `LW-11` in Status, Deckung und
Quellen. Bei `LW-18` variiert ausschließlich die Wiedergabe desselben
Quellensatzes; Status, Deckung, Betrag und Quelle bleiben gleich. Die übrigen
34 Zeilen sind vollständig identisch.

### WEVIG

```text
33/33 Triage-Kandidaten
52/52 atomare Komponenten
36/36 LW-Endzeilen
24 ausgewählte Quellen
0 Änderungen gegenüber RC21
kein neuer LW-11-Kandidat
```

Artefakte:

```text
RC30-LF-LW-CANDIDATE-20260829-123322
RC30-WEVIG-LW-CONTROL-20260829-123739
```

## Technische Gates

```text
PASS: 93 Jest-Suites / 1065 Tests
PASS: Katalog-Recall-Test für dieselbe reale Formulierung
PASS: Server-Lint, Prettier und git diff --check
PASS: LF-Worksheet bindet die neue Fundstelle nur im Leitungswasserkapitel
PASS: Feuerkapitel-Treffer bleibt EXPLICIT_OTHER_CATEGORY_SECTION
PASS: frische LF- und WEVIG-LW-27B-Läufe
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.30
./doctor.command
```

## Beweisgrenze

RC30 beweist eine ausdrücklich mitversicherte wasserführende Fußboden- und
Wandheizung als Heizungsanlage. Ein Heizungswort in einer anderen Sparte oder
eine bloße Erwähnung ohne positiven Klauselkontext bleibt unzureichend.
