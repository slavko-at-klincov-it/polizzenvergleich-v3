# Polizzenvergleich V3.4.0 RC2 – bedingungssichere Punktentscheidung

Stand: 31. August 2026

Release-Tag: `v3.4.0-rc.2`

## Zweck

RC2 schließt die Abnahme des vollständigen A/B-Paketvergleichs auf der
Zielhardware ab und korrigiert eine fachlich unsichere Annahme aus RC1:
Ein kurzer ausgewählter Beleg darf nicht als unbedingter Einschluss,
Ausschluss oder Gleichstand bewertet werden, wenn die gebundene lokale Klausel
eine Ausnahme oder Bedingung enthält.

Die technische Produktfunktion bleibt unverändert:

- bis zu neun private PDFs je Paket A und B;
- acht Kategorieansichten und 320 feste Vergleichszeilen;
- getrennte Inhalte, Deckungen, Werte, Prüfstatus und Quellen je Paket;
- punktweise Entscheidung mit Begründung und versionierter Regel;
- Markdown-, UI- und XLSX-Ausgabe mit acht Blättern und 18 Spalten.

## Frischer Zehn-Dokumente-End-to-End-Lauf

RC1 wurde auf dem Mac Studio mit einer LF-Hauptpolizze als Paket A und einer
WEVIG-Hauptpolizze samt acht Zusatz- beziehungsweise Bedingungsdokumenten als
Paket B vollständig ausgeführt.

```text
Session: 6c3a1a8c-9e58-4965-8720-0545aabbf889
Release-Commit: d78c80bfbc9797635ae4823ab0327a03299d2919
Modell: qwen/qwen3.8-27b
Embedding: dinghy-embed
PASS: 10/10 Dokumente
PASS: 80/80 Dokument-Kategorie-Schritte
PASS: 320/320 Vergleichszeilen
PASS: Status COMPLETED, keine Verarbeitungsfehler
PASS: 8 XLSX-Blätter, jeweils 18 Spalten A–R
```

Dieser Lauf beweist die vollständige technische Verarbeitung genau dieses
Zehn-Dokumente-Pakets. Die Laufzeit lag bei ungefähr vier Stunden und verfehlt
damit das angestrebte Produktbudget von ungefähr einer Stunde deutlich.

## Befund und allgemeiner Fix

RC1 bewertete `LW-22` in zwei gespeicherten Modellläufen unterschiedlich. Die
WEVIG-Klausel schließt Holzfäule, Vermorschung und Schwamm grundsätzlich aus,
enthält aber unmittelbar anschließend eine Rückausnahme für nachweislich auf
ein versichertes Ereignis zurückzuführende Schäden. Weder ein unbedingtes
`INCLUDED` noch ein unbedingtes `EXCLUDED` reicht deshalb für einen sicheren
Punktentscheid.

RC2 implementiert keinen Versicherer-, Seiten- oder Kategorien-Sonderfall.
Die Entscheidungsschicht prüft für Deckungsrollen einen lokalen, an den
servergebundenen Quellspan gekoppelten Klauselkontext. Erkannte Bedingungen
oder Ausnahmen führen zur versionierten Regel
`FAIL_CLOSED_CONDITIONAL_SOURCE_V1` und zum Ergebnis `UNKLAR`. Weit entfernte
Klauseln werden nicht eingemischt; reine Definitionen wie „Blitzschlag ...
wenn er unmittelbar einschlägt“ werden nicht fälschlich als bedingtes
Deckungsversprechen behandelt.

Der 320-Zeilen-Replay zeigte dadurch drei gezielte Sicherheitskorrekturen:

```text
LW-22: GLEICHWERTIG -> UNKLAR (Ausnahme zum Ausschluss)
ST-16: GLEICHWERTIG -> UNKLAR (Deckung nur unter zusätzlichem Scope)
HP-26: GLEICHWERTIG -> UNKLAR (Ausnahme innerhalb des Ausschlusses)
```

`FE-A04` bleibt als reine Gefahren-Definition `GLEICHWERTIG`. Alle übrigen
317 Zeilen bleiben gegenüber dem frischen RC1-Ergebnis in der
Punktentscheidung unverändert.

## RC2-Prüfung auf dem Mac Studio

```text
PASS: Prettier der geänderten Code- und Testdateien
PASS: fokussierte Entscheidung/Result-Verträge 2 Suites / 23 Tests
PASS: vollständige Serverregression 90 Suites / 1.043 Tests
PASS: frischer Artefaktreplay 320/320 Zeilen
PASS: 0 VORTEIL_A / 0 VORTEIL_B / 4 GLEICHWERTIG /
      11 NICHT_VERGLEICHBAR / 305 UNKLAR
PASS: älterer Artefaktreplay 320/320 Zeilen
PASS: früherer unsicherer LW-22-VORTEIL_B wird UNKLAR
PASS: beide Replays mit 8 XLSX-Blättern und 18 Spalten A–R
```

Nach diesem rein deterministischen Fix ist kein erneuter vierstündiger
Modelllauf notwendig: Kandidaten, atomare Fakten, Quellen und alle 80
Dokument-Kategorie-Ergebnisse bleiben unverändert. RC2 erzeugt ausschließlich
die Vergleichsentscheidung und die drei Ergebnisartefakte erneut aus den
vollständig gespeicherten frischen RC1-Artefakten.

## Update auf RC2

Nach Veröffentlichung von Commit und annotiertem Tag auf `origin/main`:

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.4.0-rc.2
./doctor.command
```

## Beweisgrenze

RC2 beweist den vollständigen technischen End-to-End-Weg und das konservative
Verhalten der Punktentscheidung für die dokumentierten LF-/WEVIG-Artefakte.
Dass in diesem konkreten Paket kein sicherer Vorteil verbleibt, ist ein
korrektes Ergebnis: Die Software erfindet keinen Gewinner aus unvollständigem
oder qualifiziertem Beleg.

Nicht bewiesen sind 99 Prozent fachliche Richtigkeit, beliebige zukünftige
Polizzen, eine vollständige Dokumentrang-/Ersetzungslogik oder eine
fachkundige Freigabe aller 320 Zeilen. Dafür bleiben ein versioniertes
Expertenoracle und zuvor ungesehene Mehrversicherer-Holdouts erforderlich.
