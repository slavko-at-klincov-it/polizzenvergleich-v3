# Polizzenvergleich V3.4.0 RC1 – beleggebundener Paketvergleich

Stand: 30. August 2026

Release-Tag: `v3.4.0-rc.1`

## Zweck

V3.4.0 RC1 führt den vollständigen produktiven A/B-Paketvergleich ein. Im
Chat können Dokumente getrennt Paket A und Paket B zugeordnet werden. Jede
Seite darf aus einer Hauptpolizze und zusätzlichen Vertragsdokumenten
bestehen. Der Server analysiert jedes Dokument in allen acht Kategorieansichten
und führt die Ergebnisse anschließend zu 320 vorgegebenen Vergleichspunkten
zusammen.

Die sichtbare Ausgabe umfasst:

- die getrennten belegten Inhalte, Deckungen, Beträge, Prüfstatus und Quellen
  von Paket A und Paket B;
- einen technischen Unterschiedshinweis;
- eine eigene punktweise Entscheidung `VORTEIL_A`, `VORTEIL_B`,
  `GLEICHWERTIG`, `NICHT_VERGLEICHBAR` oder `UNKLAR`;
- eine konkrete Begründung und die angewendete versionierte Regel;
- acht Tabellenansichten sowie einen Excel-Export mit 18 Spalten.

Es gibt bewusst keinen pauschalen Gesamtsieger und keine Bewertung anhand der
Textlänge oder der Zahl gefundener Klauseln.

## Fachlicher Sicherheitsvertrag

Eine Vorteilsentscheidung entsteht nur aus vollständig belegten atomaren
Vertragsfakten. Vor jeder Regel prüft der Server insbesondere:

- beidseitigen Status `BELEGT`;
- konfliktfreie, vollständig aufgelöste Evidenz;
- exakte, seitengebundene und serverseitig ausgewählte Quellen;
- Objekt, Gefahr, Faktenrolle, Dokumentgeltung, Scope und Variante;
- bei Werten zusätzlich Werttyp, Einheit, Limitart und Qualifier.

Freigegebene Regeln sind:

- `INCLUDED_OVER_EXCLUDED_V1`;
- `HIGHER_COVERAGE_LIMIT_V1`;
- `LOWER_DEDUCTIBLE_V1`;
- `ATOMIC_COVERAGE_EQUALITY_V1`;
- `TYPED_VALUE_EQUALITY_V1`.

Fehlende Evidenz ist kein Ausschluss. Teilbelege, Widersprüche, Bedingungen,
Optionen, ungeklärte Dokumentrangfolge, mehrere nicht trennbare Fakten oder
gemischte Gewinner bleiben `UNKLAR`. Nicht identische Vergleichsdimensionen
werden als `NICHT_VERGLEICHBAR` ausgewiesen.

## Prüfung vor RC1

Die Prüfungen wurden ausschließlich auf dem Mac Studio mit Node 18.18.0
ausgeführt.

```text
PASS: fokussierte Entscheidung/Result/UI-Verträge 3 Suites / 21 Tests
PASS: vollständige Serverregression 90 Suites / 1.039 Tests
PASS: Prettier-Prüfung der geänderten Code- und Testdateien
PASS: Frontend-Produktionsbuild einschließlich Postbuild
PASS: gespeicherter Zehn-Dokumente-Artefaktreplay 320/320 Zeilen
PASS: Replay 1 VORTEIL_B / 7 GLEICHWERTIG /
      9 NICHT_VERGLEICHBAR / 303 UNKLAR
PASS: LW-22 bewertet B nur aus zwei gleichgerichteten, vollständig
      belegten atomaren Komponenten besser
PASS: alte Schema-V1-Ergebnisse werden in der UI fail-closed UNKLAR
PASS: Excel behält die bisherigen Spalten A–O und ergänzt P–R
```

Der Replay verwendete die unveränderten Artefakte der Session
`5a8c6b3d-94fa-4ed9-84bc-4fff2cfa1e85`. Er validiert die neue
Zusammenführungs- und Entscheidungsschicht, ist aber kein neuer Modelllauf.

## RC1-Abnahme

Nach Installation des RC1 sind noch auszuführen:

1. `doctor.command` auf dem installierten Kundenpfad;
2. ein frischer vollständiger Lauf mit der LF-Hauptpolizze als Paket A und
   der WEVIG-Hauptpolizze samt acht Zusatz-/Bedingungsdokumenten als Paket B;
3. Prüfung der 80 Dokument-Kategorie-Schritte, der 320 Vergleichszeilen, der
   acht Excel-Blätter und aller Punktentscheidungen;
4. Vergleich mit dem gespeicherten Replay und Prüfung auf neue Regressionen;
5. erst danach Freigabe des stabilen Tags `v3.4.0`.

## Update auf RC1

Nach Veröffentlichung von Commit und annotiertem Tag auf `origin/main`:

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.4.0-rc.1
./doctor.command
```

## Beweisgrenze

RC1 beweist die technische A/B-Maschine und die konservative regelgebundene
Entscheidungsschicht für die dokumentierten Tests und den gespeicherten
LF/WEVIG-Artefaktreplay. Der noch ausstehende frische Lauf prüft den neuen
Releasepfad auf der Zielhardware.

Auch ein erfolgreicher LF/WEVIG-Lauf beweist keine 99-Prozent-Qualität für
beliebige künftige Polizzen. Dafür bleiben ein versioniertes Expertenoracle
und zuvor ungesehene vollständige Multi-Versicherer-Holdouts erforderlich.
