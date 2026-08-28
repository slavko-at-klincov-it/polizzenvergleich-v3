# Polizzenvergleich V3.3.0 RC2 – vollständiger VS-01-bis-VS-36-Vergleich

Stand: 28. August 2026

Release-Tag: `v3.3.0-rc.2`

## Zweck

Dieser Release Candidate erweitert `v3.3.0-rc.1` vom Vier-Kategorien-Piloten
auf den vollständigen, servergebundenen VS-Pfad für VS-01 bis VS-36. Er ist
für den kontrollierten Vollvergleich mit LF und WEVIG auf dem
Kunden-Mac-Studio bestimmt.

RC2 bleibt Teil der V3.3.0-Entwicklungslinie: Die Architekturänderung war
bereits mit RC1 begonnen worden; RC2 ergänzt und korrigiert ihre vollständige
36-Kategorien-Ausprägung. Es handelt sich weiterhin nicht um die endgültige
V3.3.0-Produktfreigabe.

## Qualitativer lokaler Freigabebefund

Der frische lokale 72-Zellen-Vergleich gegen die eingefrorene
V3.2.1-kompatible 4B-Baseline ergab:

```text
57 BESSER
13 GLEICH
 2 UNKLAR
 0 SCHLECHTER
```

Beide Dokumente bestanden jeweils 36/36 Zeilen, 64/64 atomisierte
Komponenten, 64/64 Kontrollen und den achtspaltigen Tabellenvertrag.

Der vollständige Befund steht in
`docs/VS_01_36_QUALITAETSVERGLEICH_V321_V33_DE.md`.

## Wesentliche Änderungen gegenüber RC1

- vollständiger VS-Katalog V0.2 für VS-01 bis VS-36;
- kontrollierte Klauselabschnitte statt ausschließlich globalem Retrieval;
- atomare Objekt-, Wirkungs-, Bedingungs-, Scope- und Wertrollen;
- deterministische, lokal gebundene Beträge, Prozentsätze, Dauern und
  Berechnungsgrundlagen;
- kein Cross-Binding fremder Haftpflicht-, Gefahren-, Kosten- oder
  Jahresaggregatwerte;
- vollständiger LF-/WEVIG-Runner `run-vs-full-quality-ab.command`;
- serverseitige Materialisierung der 36 Tabellenzeilen und privater
  Quellenartefakte;
- formal gültige Kombinationen aus Deckung und Prüfstatus.

## Releaseprüfungen

```text
Vollständige Repository-Tests: 79 Suites / 863 Tests PASS
Policy-Analyse und QA-CLI:     12 Suites / 204 Tests PASS
Frontend-Produktionsbuild:    PASS
macOS-Installer-Test:         PASS
ESLint/Prettier:              PASS
Shell-/Node-Syntax:           PASS
Lokaler LF-/WEVIG-Volltest:   PASS
```

## Update auf dem Kunden-Mac-Studio

```bash
cd "$HOME/Code/polizzenvergleich-v3"

./doctor.command
./update.command v3.3.0-rc.2
./doctor.command
```

Der Updater akzeptiert nur einen annotierten Release-Tag auf dem
veröffentlichten `origin/main`. Anwendungskonfiguration, Datenbank und lokale
Dokumente werden durch das Codeupdate nicht ersetzt. Vor der Aktivierung wird
die bestehende Datenbank gesichert; ein fehlgeschlagenes Update rollt Code und
Dienste zurück.

## Voraussetzungen für den 27B-Vollvergleich

LM Studio muss laufen und exakt diese Modelle bereitstellen:

- Chatmodell: `qwen/qwen3.8-27b`
- Embeddingmodell: `dinghy-embed`

Die beiden PDFs müssen unverändert vorliegen. Der Runner fixiert Chat- und
Embedding-Endpunkt auf `127.0.0.1:1234`; geerbte Remote-Endpunkte werden nicht
verwendet.

## Vollständigen Vergleich starten

```bash
cd "$HOME/Code/polizzenvergleich-v3"

./run-vs-full-quality-ab.command \
  "/ABSOLUTER/PFAD/LF-GENERALI.pdf" \
  "/ABSOLUTER/PFAD/Musterberechnung-WEVIG-Premiumschutz.pdf"
```

Der Lauf verarbeitet beide Dokumente und schreibt die privaten Artefakte
standardmäßig nach:

```text
$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/
```

Der konkrete neue Ordner beginnt mit `VS-FULL-QUALITY-AB-`. Je Dokument sind
Legacy-Replay, Worksheet, Candidate-Triage, Wirkungsprüfung, Quellenbindungen,
36-Zeilen-Antwort und Vergleich enthalten. Je nach lokaler Modellleistung kann
der vollständige Lauf deutlich länger als der bisherige Vier-Zeilen-Pilot
dauern; bis zu ungefähr einer Stunde ist für diesen beaufsichtigten Test
akzeptiert.

## Ergebnis für die Rückübermittlung packen

Nach Laufende den vom Runner ausgegebenen Ordner einsetzen:

```bash
RUN="$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-FULL-QUALITY-AB-YYYYMMDD-HHMMSS"

cd "$(dirname "$RUN")"
zip -r "$HOME/Desktop/VS-FULL-QUALITY-27B-RC2.zip" "$(basename "$RUN")"
```

Die ZIP enthält vertrauliche Vertragsauszüge und darf nur über den dafür
vorgesehenen internen Übertragungsweg weitergegeben werden.

## Freigabegrenze

```text
GO: kontrollierter VS-01-bis-VS-36-Vollvergleich auf Kundenhardware
NO CLAIM: 27B-Qualitätsgewinn vor Auswertung des Kundenlaufs
NO CLAIM: hundertprozentige fachliche Vollständigkeit
NO PRODUCT RELEASE: gewöhnlicher UI-Chat und Mehrdokumentpakete bleiben separat
```

Die zwei im lokalen Vergleich noch unentschiedenen Zellen sind LF VS-17 und
WEVIG VS-18. Sie sind keine bekannte Regression, müssen bei der fachlichen
Kundenauswertung aber ausdrücklich beobachtet werden.
