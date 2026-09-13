# LF-1+9-Konsolidierung vor Gold-283 und dynamischem Produktlauf

Stand: 13. September 2026

## 1. Verbindlicher Stoppzustand

Die Arbeit ist an einer vollständigen Artefaktgrenze gestoppt. Auf dem Mac
Studio läuft kein vollständiger Reviewer- oder Modelllauf. Es wurde kein neues
Produkt-Routing aktiviert, keine Kunden-XLSX erzeugt und nichts deployed.
Bestehende Ergebnis-, Gold-, Qwen- und Blindreview-Artefakte wurden weder
gelöscht noch überschrieben.

Repositoryzustand beim Stopp:

```text
Branch: codex/v3.7.5-lf-retrieval-shadow
HEAD:   a667b26b0f7ddfcfbe4a06714893a0e2a8dee103
Status: sauber
```

`a667b26b0` enthält einen nach dem validierten V2-Stand begonnenen
V3-Navigationsentwurf. Auf dem Mac Studio stoppte dessen Prüfung bereits beim
Formatcheck; Jest wurde nicht ausgeführt. Der Commit bleibt unverändert als
Diagnose- und Arbeitsstand erhalten, gilt aber nicht als validiert,
produktiv wiederverwendbar oder freigegeben. Bis diese Konsolidierung
abgeschlossen ist, wird daran nicht weiter implementiert.

Der letzte vollständig validierte Blindquellenstand ist
`8da2dd6a7ab166b14a76fe578dea13c828fb8afa`. Auf dem Mac Studio bestanden
Syntax, Formatcheck und 314/314 fokussierte und angrenzende Tests. Der
ESLint-Lauf ist wegen der auf dem Mac installierten inkompatiblen Kombination
aus ESLint 9.39.3 und dem alten React-Plugin bereits beim Laden der Regel
abgebrochen und darf nicht als Lint-PASS bezeichnet werden.

## 2. Gesicherte Sol-30- und Astra-9-Ergebnisse

Beide Reviews verwendeten dasselbe unveränderliche Blindpaket:

```text
Commit/Packet-Code:
  8da2dd6a7ab166b14a76fe578dea13c828fb8afa

Pfad:
  /Users/michaelmischkot/Library/Application Support/
  at.klincov.polizzenvergleich-v3/QA/
  LF-1PLUS9-SOL-BLIND-V2-20260913-8DA2DD6A7/
  blind-evidence-packet.private.json

Datei-SHA-256:
  df2eec7382eb9b73be3bd7600582f70193769b10fa154fa155ba31b0f0ebed16

Interner Packet-SHA-256:
  3586b97ff0bc97aff40259e41ebb4f431055a1fd6ec4b76a2d3303076e06a722
```

Das Paket enthält 283 Zeilen, 631 Komponenten, neun B-Dokumente, 1.071
vollständige Evidenzgruppen und 4.806 exakte Quellspans. Es zertifiziert für
keine Zeile Abwesenheit.

### Sol-Gold-30

```text
Modell:                         gpt-5.6-sol
Reasoning:                      high
Kontext:                        frisch und getrennt je Zeile
Blindheit:                      für alle finalen Entscheidungen bestätigt
Gültige Entscheidungen:        30/30
Verworfene Schemaantworten:     3
Infrastrukturfehler vor Retry:  1
Summe gültiger Modellzeiten:    4.141 s
Durchschnitt:                   138,033 s/Zeile
Parallel-Wandzeit:              nicht belastbar erfasst
Ergebnis:                       23 gefunden, 7 nicht gefunden
Klassen:                        2 FULL, 20 PARTIAL, 1 CONTRADICTED, 7 NONE
Gegen Frozen Gold-30:           23/30 binär, 21/30 Klasse
Gate:                           nicht bestanden; nicht auf 283 skaliert
```

Unveränderliche Konsolidierungsdatei:

```text
/Users/michaelmischkot/Library/Application Support/
at.klincov.polizzenvergleich-v3/QA/
LF-1PLUS9-CONSOLIDATION-V1-20260913-A667B26B0/
sol-gold30-summary.private.json

SHA-256:
031e64deb1facdd02c61b5c0b287228ea82d37064006b398c62d30de6e182223
```

Die Datei ist eine unveränderliche Zusammenfassung der finalen
Zeilenentscheidungen und berichteten Einzelzeiten. Die ursprünglichen
Agenten-Rohantworten wurden beim Lauf nicht gemeinsam serialisiert; die
Zusammenfassung darf daher nicht als Rohantwortarchiv ausgegeben werden.

### Neun Astra-Streitprüfungen

```text
Modell:                       gpt-6-astra
Reasoning:                    high
Kontext:                      frisch und getrennt je Zeile
Blindheit:                    für alle finalen Entscheidungen bestätigt
Gültige Entscheidungen:      9/9
Verworfene Schemaantworten:   3
SSH-Fehler vor Retry:         3
Falscher Pfad vor Retry:      2
Summe gültiger Modellzeiten:  593 s
Durchschnitt:                 65,889 s/Zeile
Parallel-Wandzeit:            nicht belastbar erfasst
Ergebnis:                     4 gefunden, 5 nicht gefunden
Klassen:                      4 PARTIAL, 5 NONE
Gegen Sol:                    7/9 binär, 6/9 Klasse
```

Der tatsächlich verwendete Reasoning-Aufwand war `high`, nicht `xhigh`.

Unveränderliche Konsolidierungsdatei:

```text
/Users/michaelmischkot/Library/Application Support/
at.klincov.polizzenvergleich-v3/QA/
LF-1PLUS9-CONSOLIDATION-V1-20260913-A667B26B0/
astra9-dispute-summary.private.json

SHA-256:
b6fdc544fbee56bc9de0dfffced738377b554466e402b0e557ad24d7c98ce3f1
```

## 3. Gold-30 bleibt unverändert

Beide vorhandenen Freeze-Dateien sind hashgleich zu ihrem Zustand vor dieser
Konsolidierung:

```text
LF-1PLUS9-GOLD-30-V1-20260913-1E90C0C3/gold-30.private.json
SHA-256 2ac65301d6bba2fcc278bf180d145abaa7bc1c042537986afc90b8908a3faf97
interner Gold-SHA 87e5bf619377454b4190dc743b70ad03ac97ef8e05e3f81da0fadaa8d996bc35

LF-1PLUS9-GOLD-30-V2-20260913-02039DB4/gold-30.private.json
SHA-256 cff20090e2382b1131454f8d9a47f5dba3ca252deb8a1f8d5b95258dfec74f71
interner Gold-SHA 01b534e7bff717f3db3ce8a0742356e1644c7d489daf31ea549cbc10d9781747
```

Die jüngere Datei materialisiert weiterhin den Vertrag
`LF_1PLUS9_GOLD_30_V1` mit 30 Zeilen, 22 gefunden, 8 nicht gefunden,
3 FULL und 19 PARTIAL. Sie wird nicht überschrieben.

Die neuen Blindprüfungen ergeben für `VS-25`, `PR-01` und `PR-09` einen
abweichenden Korrekturvorschlag. Er ist ausdrücklich `PROPOSAL_NOT_GOLD` und
liegt getrennt unter:

```text
LF-1PLUS9-CONSOLIDATION-V1-20260913-A667B26B0/
gold30-correction-proposal-v1.private.json

SHA-256:
d99394a51b56c149f62b0c39da0a3917ca54bb96b42b172310a0acf0887f7bb6
```

`FE-03`, `VS-02` und `ST-10` werden trotz negativer Blindantwort nicht
umklassifiziert, weil beim nachgelagerten Quellenabgleich vollständige
Gold-Quellgruppen im Blindinput fehlten. Das ist ein Befund zum
Evidenzvertrag, keine neue Goldentscheidung.

## 4. Gemeinsame Vergleichsmatrix

Eine modellfreie Matrix wurde ausschließlich aus vorhandenen Dateien
materialisiert. Sie ruft kein Modell auf, sucht nicht neu, adjudiziert keine
Zeile und verändert kein Eingabeartefakt.

```text
Pfad:
  /Users/michaelmischkot/Library/Application Support/
  at.klincov.polizzenvergleich-v3/QA/
  LF-1PLUS9-CONSOLIDATION-V1-20260913-A667B26B0/
  review-comparison-matrix-v1.private.json

SHA-256:
  b9b602a849054242e57ef8ad377e6ad696ce2a642d9c35664b316eff158e6c5d

Status:
  INCOMPLETE_MISSING_ASTRA283_ARTIFACT_NOT_GOLD
```

Gebundene Daten:

| Quelle                       |          Stand | Bindung / Ergebnis                                                           |
| ---------------------------- | -------------: | ---------------------------------------------------------------------------- |
| Fable-/Claude-283-Projektion |        283/283 | im Gold-Candidate, 219 `Ja`, 41 `Teilweise`, 23 `Nein`; Kandidat, nicht Gold |
| altes System                 |        283/283 | im Gold-Candidate, 148 gefunden, 135 nicht gefunden                          |
| Qwen                         |         98/283 | 57 gefunden, 41 nicht gefunden; `NOT_GOLD`, resumierbar                      |
| Sol-Gold-30                  |          30/30 | 23 gefunden, 7 nicht gefunden                                                |
| Astra-Streitprüfung          |            9/9 | 4 gefunden, 5 nicht gefunden                                                 |
| Frozen Gold-30               |          30/30 | 22 gefunden, 8 nicht gefunden                                                |
| blinder Astra-283-Lauf       | 0/283 gebunden | angekündigtes Abschlussartefakt nicht auffindbar                             |

Der verwendete Gold-Candidate liegt unter
`LF-1PLUS9-GOLD-CANDIDATE-V1-20260913-65BE17FB/gold-candidate.private.json`
und besitzt den Datei-SHA
`c6022cc4f280d67d3410992d0c6dfa69090b1856c6b751fb19473bccc325d385`.
Er enthält die Fable-/Claude- und Altsystemprojektion, ist aber
`SOURCE_REVIEW_REQUIRED` und kein Gold.

Die 98 gültigen Qwen-Zeilen liegen unverändert in
`LF-1PLUS9-SOURCE-REVIEW-283-V1-20260913-21577084/qwen-review-v10/rows`.
Sie stammen aus Commit `2e15135a58e47c208e00f5fb56b4e228c6282ce4`, Modell
`qwen/qwen3.6-35b-a3b`, Kontext 42.496, Request-Timeout 240.000 ms,
Abort-Settlement 15.000 ms, Recovery 180.000 ms und maximal drei Versuchen.
Der gesamte erhaltene Qwen-V10-Baum umfasst 227 Dateien. Der SHA über die
sortierte Liste aus absoluten Dateipfaden und Einzelhashes ist
`f942da9459c270554f2af53166c5c4aa55b060e5a92f4a53ca7e757361a61600`.
Die drei ungültigen ST-20-Versuche bleiben erhalten; keine ungültige 99. Zeile
wurde gespeichert.

Die aktuelle Matrix meldet 143 binäre Widerspruchszeilen und 156 Zeilen, für
die mindestens eine vorhandene Stimme einen Nullfund behauptet. Das ist
ausschließlich eine breite Triage gegen teils nichtautoritative Systeme.
Diese Zahlen sind weder Fehlerzahlen noch der verbleibende manuelle
Gold-Aufwand.

Der angekündigte bereits abgeschlossene blinde Astra-283-Lauf wurde weder im
Mac-Studio-QA-Baum noch in Repository und vorhandenen Anhängen als eigene
hashbindbare Datei gefunden. Modell, Reasoning, Laufzeit, Inputhash und
Zeilenentscheidungen können daher derzeit nicht beweisbar in die Matrix
übernommen werden. Es wird kein Ersatzlauf gestartet und kein Ergebnis aus
Erinnerung rekonstruiert.

## 5. Klassifikation der letzten 36 Stunden

### 5.1 Produktiv wiederverwendbar

- Der dynamische A-Pfad mit SourceBlockLedger, stabilen Source-IDs,
  Source-Unit-Planung, terminaler Blockzuständigkeit, sicherem Resume und
  hashgebundenen Artefakten.
- Harte Modelltimeouts, echter Abort, Settlement-Barriere, begrenzte Retries,
  Recovery und fail-closed Paket-/Batchgrenzen.
- Allgemeine A-Rollen- und Atomisierungsregeln für Listen-Governor,
  Fortsetzungen, Bedingungen, Limits, Kosten, Ausschlüsse, Definitionen und
  Quellspannengrenzen, soweit sie im aktuellen Code und in Mac-Studio-Tests
  bestehen.
- Vollständige B-Kandidatensuche als Union aus CURRENT/BM25, Struktur,
  Dinghy, Werten und Rollen sowie unveränderliche servereigene Evidenzspans.
- Die binäre Kundensemantik: Ein quellengebundenes Gegenstück zum selben
  fachlichen Element ist gefunden; Wert-, Limit-, Bedingungs-, Scope- oder
  Wirkungsabweichungen werden getrennt dargestellt. Bloße Keywords und
  verwandte Themen sind kein Treffer.
- Vollständige Satz-, Klausel-, Listen- und Tabellen-Evidenzgruppen sowie
  dokumentgebundene Mehrquellenkombinationen aus Commit `8da2dd6a7` als
  wiederverwendbare Grundlage. Das QA-Paket selbst bleibt Regression, nicht
  Produktionsrouting.
- Tailscale-SSH (`ssh macstudio`) als einziger zulässiger Fernzugriff für
  Test, QA und Modellläufe.

### 5.2 Gold- und Regressionsevidenz

- Frozen Gold-30-V1/V2: einzige bereits zeilenweise source-bound
  Gold-Teilmenge; unverändert.
- Fable-/Claude-283: vollständiger starker Gold-Kandidat mit Quellen, aber
  nicht source-bound final adjudiziert.
- Sol-Gold-30: blindes Modellbenchmark; Gate nicht bestanden, daher nicht
  Gold und nicht auf 283 skaliert.
- Astra-9: blinde unabhängige Streitfallevidenz; drei Korrekturvorschläge,
  aber kein automatisches Gold.
- Qwen-98: gültiger, resumierbarer unabhängiger Benchmark; nicht Gold.
- Altsystem 148/135 und frühere V3.7.2-Läufe: Regression und Fehlervergleich,
  nicht fachliche Wahrheit.
- Gold-Candidate-283 und vollständiges Blindquellenpaket: unveränderliche
  Vergleichs- und Quellenbasis, aber noch kein Gold-283.

### 5.3 Diagnostisch wertvoll

- V12 und seine Folgeiterationen belegen 1.005/1.005 terminale A-Blöcke,
  364 Requirements, 755 Komponenten und null `UNRESOLVED`; der 631er
  Crosswalk zeigt jedoch weiterhin Rollen- und Atomisierungsrisiken und ist
  kein fachlicher Vollständigkeitsbeweis.
- 333 rolleninkompatible Legacy-Überlappungen, Split-/Merge-Kandidaten und
  risikobehaftete Komponenten zeigen konkrete Fehlerklassen, dürfen aber
  nicht als 333 bewiesene Produktfehler oder als neue Sperrarchitektur
  behandelt werden.
- Der B-Shadow belegt komplementären Retrievalnutzen: 208/220 historische
  positive Zitate in der Union, davon zehn nur durch Dinghy und 49 nur durch
  deterministische Kanäle. Er beweist keine semantische Richtigkeit.
- `GL-26` und `VS-31` zeigen Sol-Falschpositive aus spartenfremden oder
  zusammengesetzten verwandten Elementen. `FE-18` zeigt eine zu breite
  `CONTRADICTED`-Bewertung.
- `FE-03`, `VS-02` und `ST-10` zeigen, dass vollständige Originalquellen
  trotz vorhandener Gruppen durch die V2-Auswahl fehlen konnten.
- `a667b26b0` ist ein unvalidierter V3-Navigationsentwurf und bleibt reine
  Diagnose-/Arbeitsgrundlage.

### 5.4 Verworfen oder methodisch ungültig

- Agentenerfundene menschliche Qualifikations-, Signatur-, Ed25519-,
  Trust-Root- und externe Autorisierungsgates als Voraussetzung für B oder
  das Produktziel.
- 1.005/1.005 Blockbesitz, Test-PASS oder technische Reviewer-Vollständigkeit
  als Ersatz für fachliches Gold oder Produktqualität.
- Der Claude-beeinflusste Source-Review-Paketpfad als angeblich blinder
  Reviewerinput.
- Der Sol-Erstlauf mit zehn Zeilen in einem Sammelkontext als Skalierungsbeleg.
- Feste 600-Zeichen-Ausschnitte und feste maximale Top-Gruppen, wenn dadurch
  vollständige Klauseln oder notwendige Mehrquellenkombinationen abgeschnitten
  werden.
- Ungültige Schemaantworten, das unsicher erzeugte/quarantänisierte PR-05 und
  technische Timeout-/Transportfehler als semantische Entscheidungen.
- Modellkonsens ohne Prüfung der Originalquelle als Gold.
- Screen Sharing, CUA, Accessibility oder Screenshots als Ersatz für
  Tailscale-SSH.

## 6. Verbleibender Weg bis Gold-283-V1

1. Das angekündigte Astra-283-Abschlussartefakt muss mit exaktem Pfad,
   Datei-SHA-256, Input-/Packet-SHA, Modell, Reasoning und Laufzeit gefunden
   und nur-lesend gebunden werden. Falls es tatsächlich nie serialisiert
   wurde, muss dieser Sachverhalt als fehlende Evidenz festgehalten werden;
   ein neuer Vollreview ist durch den aktuellen Auftrag ausgeschlossen.
2. Die bestehende Matrix wird deterministisch um genau dieses Artefakt
   ergänzt. Keine andere Stimme und keine fertige Zeile wird neu berechnet.
3. Automatisch übernommen werden nur Entscheidungen mit gültiger Original-
   quelle und übereinstimmendem fachlichem Kern. Modellmehrheiten ohne Quelle
   reichen nicht.
4. Nur verbleibende binäre Widersprüche, behauptete Nullfunde und
   Hochrisikofälle werden gegen die originalen neun B-Dokumente entschieden.
   Fehlende Evidenz bleibt offen und wird nie als Nullfund materialisiert.
5. `Gold-283-V1` darf erst mit 283/283 source-bound Entscheidungen, null
   ungeklärten Zeilen, vollständigem Eingabemanifest und Hashbindung
   eingefroren werden. Das Gold bleibt Regression für genau das bekannte
   LF-1+9-Set und ist kein Produktionszeilenvertrag und kein
   Generalisierungsnachweis.

Aktueller ehrlicher Stand: Gold-283-V1 ist noch nicht einfrierbar, weil ein
vom Auftrag ausdrücklich verlangter Reviewerbestand nicht artefaktgebunden
ist. Ein Freeze ohne diesen Beleg würde die Matrixvollständigkeit nur
vortäuschen.

## 7. Danach: erster dynamischer Produktlauf

Nach Gold-283 wird ausschließlich `LF_REFERENCE_A_DRIVEN_V2` fortgesetzt:

1. tatsächliches A-Paket laden und vollständiges SourceBlockLedger bilden;
2. Kategorien, Reihenfolge, operative Anforderungen und atomare Komponenten
   dynamisch aus A erzeugen;
3. jede A-Komponente über BM25/CURRENT, Struktur, Dinghy, Werte und Rollen im
   gesamten B-Paket suchen;
4. vollständige klausellokale und notwendige Mehrquellenevidenz kompaktieren;
5. Gegenstücke komponentenweise und quellengebunden prüfen;
6. serverseitig binär `Gefunden`/`Nicht gefunden` ausgeben und jeden Fund mit
   B-Fundstelle darstellen;
7. echten LF-1+9-Produktlauf auf dem Mac Studio ausführen und gegen
   Gold-283-V1 messen;
8. nur allgemeine semantische Regeln übernehmen und jede Änderung als
   besser, schlechter oder unverändert auf konkreten Goldzeilen ausweisen.

Nicht erlaubt bleiben feste 283 Produktionszeilen, dokument- oder
seitenbezogene Sonderregeln, neue Nebenarchitekturen, zusätzliche
agentenerfundene Gates, Produktdeployment oder Kunden-XLSX vor dem
nachvollziehbaren dynamischen Endlauf.

## 8. Beweisgrenze

Auch ein perfektes Ergebnis gegen Gold-283-V1 belegt nur Regression auf dem
bekannten LF-1+9-Set. Produktgeneralisierung und ein 99-Prozent-Anspruch
erfordern weiterhin zuvor unbekannte, versionierte und fachlich gelabelte
Mehrversicherer-Holdouts nach dem Produktcharter.
