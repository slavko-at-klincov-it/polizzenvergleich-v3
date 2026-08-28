# Polizzenvergleich V3.3.0 RC6 – Recall- und Scope-Härtung nach dem 27B-Gesamtlauf

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.6`

## Zweck

RC6 ist die ursachengebundene Korrektur des echten RC5-LF-Gesamtlaufs. RC5
hatte 320/320 Zeilen erzeugt, aber 253 Zeilen blieben unbekannt und mehrere
vorhandene Vertragsklauseln wurden falsch oder gar nicht zugeordnet. RC6
erweitert den gemeinsamen Evidenzpfad für alle acht Kategorien, ohne die
bereits bewährten VS-Regeln zu ersetzen.

## Wesentliche Änderungen

- konservativ erweiterter Recall für FE, LW, ST, EL, HP, VB und WE;
- satzzeichenrobuste Suche mit unveränderten Originalzitaten und Offsets;
- Scopegrenzen für Glasbruch, Allgemeinen Teil und Ökoschutz;
- explizite Deckungs-Governors werden bei fortgesetzten Listen genau über
  einen PDF-Seitenwechsel erhalten;
- getrennte Wirkung für `EL-16`: Wintergarten eingeschlossen, Vitrinen
  ausgeschlossen, kein Widerspruch;
- korrekter Regressverzicht gegenüber Mietern und korrekter
  Mietsachschaden-Ausschluss in HP;
- quellengebundene Beträge mit `EUR` oder `€` und vollständige reine
  Limit-/Selbstbehalt-/Dokumentstatuszeilen;
- sichtbare Kennzeichnung von Rahmenbedingungen in der Ergebnistabelle.

## Nachweis vor dem Kundenlauf

```text
88 Jest-Suites / 933 Tests: PASS
Lint, Formatierung und Git-Diff-Prüfung: PASS
LF-Katalog-Replay: 381 statt 264 kontrollierte Kandidaten
Lokaler Qwen-4B-Full-Run: 320/320 Zeilen
Lokaler Vorfilter: 75 BELEGT, 59 TEILBELEGT, 186 UNGEKLÄRT
HP-16-Replay: BELEGT + Ja
HP-26-Replay: BELEGT + Nein
EL-16-Replay: Wintergarten eingeschlossen / Vitrinen ausgeschlossen
```

Der lokale 4B-Lauf ist ein Vorfilter, kein Ersatz für die Abnahme mit
Qwen 3.8 27B auf dem Kunden-Mac-Studio.

## Beweisgrenze

```text
GO: kontrollierter LF-Gesamtlauf mit Qwen 3.8 27B
REVIEW_REQUIRED: qualitativer 320-Zeilen-Vergleich gegen RC5 und die alte Baseline
REVIEW_REQUIRED: vollständige Fachoracles für alle Kategorien und Dokumentvarianten
NO CLAIM: allgemeine 99-Prozent-Genauigkeit oder finale V3.3.0-Freigabe
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.6
./doctor.command
```

## Vollständiger LF-Lauf

```bash
cd "$HOME/Code/polizzenvergleich-v3"

./run-all-categories-quality.command \
  "/ABSOLUTER/PFAD/LF-GENERALI.pdf" \
  FRAMEWORK_TERMS
```

Der Runner gibt am Ende den Ergebnisordner und den fertigen ZIP-Befehl aus.
