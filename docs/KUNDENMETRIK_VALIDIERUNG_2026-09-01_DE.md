# Kundenmetrik- und Kommunikationskorrektur

Stand: 1. September 2026

## Anlass

Ein gespeicherter technischer Differenzzähler wurde als Kundenreviewzahl
bezeichnet. Das frische V7-Ergebnis enthielt gleichzeitig:

- `totals.reviewRequired = 105` nach einer historischen technischen Formel;
- `totals.pointDecisionReviewRequired = 67` aus den tatsächlichen
  Punktentscheidungen;
- `pointDecisions.UNKLAR = 67`.

Die Zahl 105 durfte deshalb nicht als „Review erforderlich“ berichtet werden.

## Verbindliche Kundenmetrik

Ab Ergebnisschema V6 gilt der maschinenlesbare Vertrag
`CUSTOMER_COMPARISON_METRICS_V2`:

```text
Kundenprüfung erforderlich
= Anzahl eindeutiger Kundenzeilen
  mit pointDecision.outcome == UNKLAR
  und pointDecision.reviewRequired == true
```

Der unpräzise Aggregatschlüssel `totals.reviewRequired` wird in V6 nicht mehr
erzeugt. Autoritativ ist ausschließlich `totals.customerReviewRequired`.
`legacyTechnicalDifferences` bleibt als klar benannte private Diagnosemetrik
erhalten und wird nicht als Kundenreview angezeigt.

Alte Ergebnisse werden aus ihren Einzelzeilen neu gezählt. Eine Zeile ohne
gespeicherte Punktentscheidung wird fail-closed als kundenprüfpflichtig
behandelt. Alte Aggregate werden nur auf Abweichung geprüft und nie als
primäre Kundenkennzahl verwendet.

## Technische Kontrollkette

Neue Ergebnisse werden aus den Einzelzeilen aggregiert und anschließend durch
eine zweite Iteration validiert. Folgende Abweichungen stoppen die
Materialisierung:

- Punktentscheidungen summieren sich nicht zur sichtbaren Zeilenzahl;
- ein Outcome ist unbekannt;
- eine Kategorie-/Zeilenidentität kommt doppelt vor;
- `reviewRequired` stimmt nicht exakt mit `outcome == UNKLAR` überein;
- ein gespeicherter Aggregatwert weicht von der Neuberechnung ab;
- Kennzahlenvertrag oder neutraler Materialisierungsstatus weichen ab.

Der Worker liest `comparison.private.json` nach dem Schreiben erneut ein und
validiert es vor Archivierung und `COMPLETED`. Ergebnis- und XLSX-Endpunkt
validieren neue Ergebnisse erneut vor Auslieferung. Die UI zählt die sichtbaren
Zeilen unabhängig nach und zeigt den Kundenreviewwert ausdrücklich an.

## Verständliche Begriffe

Der Ausdruck `Nulltreffer` wird nicht mehr als Kundenbegriff verwendet.
Kundenwortlaut ist:

> In beiden Polizzen wurde nach vollständiger kontrollierter Suche keine
> passende Vertragsregelung gefunden.

Dieser Zustand wird nicht mehr als `ungeklärt` formuliert. Er ist auch keine
behauptete Gleichheit und kein ausdrücklicher Ausschluss.

## Exakte Partition der 67 Kundenreviewzeilen

Die folgende Aufteilung wird ohne manuelle fachliche Umgruppierung direkt aus
`pointDecision.reasonCode` jeder einzelnen Zeile abgeleitet. Die Gruppen sind
dadurch gegenseitig ausschließend und summieren sich maschinell geprüft zu 67:

| Gespeicherter Blockiergrund                                                              | Eindeutige Zeilen |
| ---------------------------------------------------------------------------------------- | ----------------: |
| Mindestens ein Paket-Prüfstatus blockiert (`PACKAGE_REVIEW_STATUS_BLOCKS_DECISION`)      |                39 |
| Auf beiden Seiten fehlt ein belastbarer Beleg (`MISSING_BOTH`)                           |                 9 |
| Nur eine Seite enthält einen belastbaren Beleg (`MISSING_ONE_SIDE`)                      |                 7 |
| Dokumentrang oder Ersetzung ungeklärt (`ATOMIC_DOCUMENT_RANK_UNRESOLVED`)                |                 3 |
| Erforderlicher Teilpunkt unvollständig (`ATOMIC_EVIDENCE_INCOMPLETE`)                    |                 3 |
| Freigegebene Vergleichsregel fehlt (`NO_APPROVED_RULE_FOR_ALL_DIMENSIONS`)               |                 3 |
| Erforderliche alternative Teilpunkte unvollständig (`ANY_COMPONENT_EVIDENCE_INCOMPLETE`) |                 2 |
| Bedingung oder Ausnahmebereich ungeklärt (`CONDITIONAL_OR_EXCEPTION_SCOPE`)              |                 1 |
| **Gesamt**                                                                               |            **67** |

Die frühere Aussage `16 + 18 + weitere Klassen` war eine nachträgliche
manuelle Umgruppierung ohne persistierte Mitgliedsliste. Sie wird deshalb
nicht als verifizierte Kennzahl fortgeführt. Sicher belegt sind neun plus sieben
= 16 Zeilen mit den beiden vollständigen Zeilenfehlgründen. Eine zusätzliche
Zahl 18 ist auf derselben Granularität nicht durch den Ergebnisvertrag belegt
und darf weder addiert noch als Teilmenge behauptet werden.

Ab V2 speichert das Ergebnis zu jedem Blockiergrund nicht nur den Zähler,
sondern auch die eindeutigen `categoryView:categoryId`-Mitgliedsschlüssel. Der
Validator prüft Gruppenmitgliedschaft, Summengleichheit und Überschneidungsfreiheit.

## Mac-Studio-Validierung

Validierter Entwicklungsstand:

```text
Commit: 66e537a849c7958c0daad2421a2e94d6ac8af277
Checkout: /private/tmp/pv3-metric-2ed516a6
Runtime der Prüfungen: Node v26.7.0
Produktprofil des Replay-Artefakts: CUSTOMER_CORE_5_V7
Replay-Artefakt-SHA-256:
3cc0ec829897a0674fe9183301b54dfb6f534935ebb1f45fcf925bdbb9cbbe4f
```

Ergebnis:

```text
PASS: echte 224 Zeilen neu aggregiert
PASS: customerReviewRequired = 67
PASS: noCustomerReviewRequired = 157
PASS: sieben Punktoutcomes summieren sich exakt zu 224
PASS: acht Blockiergrundgruppen summieren sich exakt zu 67
PASS: jede Gruppe enthält ihre eindeutigen Zeilenschlüssel
PASS: 5 fokussierte Suites / 52 Tests
PASS: Manipulationsfälle für Summe, Flag, Outcome, Zeilenidentität, Status,
      Blockiergrundzähler und Gruppenmitgliedschaft
PASS: Prettier aller geänderten Dateien
PASS: Frontend-ESLint der geänderten Produktquellen
PASS: Frontend-Produktionsbuild / 6.170 Module
```

Die vollständige Repository-Suite ist in der vorhandenen Node-26-/Dependency-
Umgebung nicht vollständig grün. Ein unmittelbar nacheinander ausgeführter
Baselinevergleich mit identischen Abhängigkeitspfaden zeigt auf beiden Ständen
dieselben 20 Fehlsuites und drei fehlgeschlagene Tests. Der neue Stand ergänzt
eine grüne Suite und 13 grüne Tests:

```text
Baseline d973977f: 91/111 Suites, 1.070/1.073 Tests
Stand 66e537a8:    92/112 Suites, 1.083/1.086 Tests
```

Die offenen Baselinefehler betreffen unter anderem die bekannte Node-26-
Inkompatibilität alter JWT-Abhängigkeiten, FFMPEG und historische Shelltests;
keiner liegt in der geänderten Vergleichsmetrik.

Der Server-ESLint-Lauf ist in genau dieser Dependency-Umgebung nicht
ausführbar: ESLint 9.39.3 und das vorhandene React-Plugin brechen bereits im
unveränderten Baselinecode mit `context.getScope is not a function` ab. Dieser
Punkt wird deshalb nicht als bestanden ausgewiesen.

## Beweisgrenze

Diese Änderung korrigiert Kennzahlen, Benennung, UI und Kontrollfluss. Sie
verändert noch keine fachliche Vorteilsentscheidung und ist kein Deployment.
