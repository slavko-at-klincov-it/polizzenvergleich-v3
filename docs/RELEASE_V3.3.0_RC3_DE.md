# Polizzenvergleich V3.3.0 RC3 – fortsetzbarer VS-Vollvergleich

Stand: 28. August 2026

Release-Tag: `v3.3.0-rc.3`

## Zweck

RC3 ersetzt RC2 ausschließlich für die robuste Ausführung des vollständigen
LF-/WEVIG-Qualitätsvergleichs. Die fachliche Analyseimplementierung aus RC2
bleibt unverändert.

RC2 materialisierte LF vollständig, beendete den Shell-Runner aber beim
technischen Exit-Code 2 des Status `REVISE`. Dadurch wurde WEVIG nicht mehr
gestartet. RC3:

- verarbeitet das zweite Dokument auch dann, wenn das erste
  `REVIEW_REQUIRED` meldet;
- gibt den zusammengefassten Exit-Code erst nach beiden Dokumenten zurück;
- kann einen vorhandenen vollständigen Dokumentteil sicher überspringen;
- verweigert die Fortsetzung eines nur teilweise geschriebenen
  Dokumentordners;
- erlaubt Resume ausschließlich in einem privaten
  `VS-FULL-QUALITY-AB-...`-QA-Ordner.

## Tests

Ein isolierter Shell-Vertrag simuliert den Fehlerfall:

```text
PASS: LF-Materialisierung liefert Exit 2
PASS: WEVIG wird trotzdem vollständig materialisiert
PASS: vorhandenes vollständiges LF wird beim Resume übersprungen
PASS: fehlendes WEVIG wird beim Resume berechnet
```

Zusätzlich bleiben die vollständigen RC2-Analyse-, Installer-, Lint- und
Buildprüfungen maßgeblich.

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.3
./doctor.command
```

## Abgebrochenen RC2-Lauf fortsetzen

Für den Kundenlauf vom 28. August 2026:

```bash
cd "$HOME/Code/polizzenvergleich-v3"

RUN="$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-FULL-QUALITY-AB-20260828-141736"

./run-vs-full-quality-ab.command \
  "/ABSOLUTER/PFAD/LF-GENERALI.pdf" \
  "/ABSOLUTER/PFAD/Musterberechnung-WEVIG-Premiumschutz.pdf" \
  "$RUN"
```

Der Runner muss melden, dass LF bereits vollständig ist und übersprungen wird.
Danach verarbeitet er nur WEVIG. Am Schluss kann der Prozess weiterhin mit
`REVIEW_REQUIRED` und Exit-Code 2 enden. Das ist für die Diagnose korrekt;
entscheidend sind der ausgegebene `FERTIG`-Hinweis und die vorhandenen
Ergebnisordner für beide Dokumente.

## Artefakte packen

```bash
RUN="$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-FULL-QUALITY-AB-20260828-141736"

cd "$(dirname "$RUN")"
zip -r "$HOME/Desktop/VS-FULL-QUALITY-27B-RC3.zip" "$(basename "$RUN")"
```

Die ZIP enthält vertrauliche Dokumentauszüge und bleibt im vorgesehenen
internen Übertragungsweg.
