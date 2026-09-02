# Paketvergleich: Fehler-, Abhängigkeits- und Fixarbeitsplan

Stand: 1. September 2026  
Status: lebendes, commit- und rungebundenes Arbeitsdokument  
Aktives Repository: `polizzenvergleich-v3`  
Aktueller Entwicklungsstand bei Anlage: `df3348c04ce57d78c2f9dd933d580cc5139cd3d7`

## 1. Zweck und Arbeitsvertrag

Dieses Dokument ist die verbindliche Arbeitsliste für die schrittweise
Korrektur des aktuellen LF-/WEVIG-Paketvergleichs. Es soll verhindern, dass:

- Kennzahlen unterschiedlicher Granularität addiert oder verwechselt werden;
- ein grober Sammelstatus ohne Prüfung seiner atomaren Ursachen gelockert wird;
- ein dokumentbezogener Fix andere Versicherer, Kategorien, Dokumentrollen,
  Werte, Scopes oder Kundenmetriken unbemerkt verschlechtert;
- ein neuer Run ohne exakte Commit-, Modell-, Eingabe- und Artefaktbindung mit
  einem früheren Run verglichen wird;
- eine Verringerung von `UNKLAR` fälschlich als Qualitätsgewinn bezeichnet
  wird, obwohl nur Sicherheitsgates entfernt wurden.

Für jedes Arbeitspaket gilt folgende Reihenfolge:

1. gespeicherte Zeilenmitgliedschaft und Real-Artefakte prüfen;
2. Root Cause und betroffene Abhängigkeiten dokumentieren;
3. genau einen kleinen, wiederverwendbaren Vertrag ändern;
4. den Fix als eigenen Commit sichern;
5. den exakten Commit in einem isolierten Mac-Studio-Checkout ausführen;
6. einen vollständigen Lauf mit den gebundenen zehn Dokumenten durchführen;
7. Ergebnis, Laufzeit und Zeilenänderungen gegen die bestätigten
   Favoriten-/Baseline-Reports vergleichen;
8. Verbesserung, Regression, Beweisgrenze und nächsten Schritt hier
   protokollieren.

Ein Dokumentationscommit allein verändert keine Laufzeit- oder Fachlogik und
benötigt keinen Modelllauf. Jeder verhaltensrelevante Code-Fix erhält dagegen
einen eigenen vollständigen Mac-Studio-Lauf. Der installierte Kunden-Checkout
bleibt unverändert, solange kein Deployment ausdrücklich beauftragt wurde.

## 2. Verbindliche Produkt- und Sicherheitsinvarianten

Folgende Regeln dürfen durch keinen Fix verletzt werden:

1. Fehlende oder unvollständig geprüfte Evidenz ist kein Ausschluss und kein
   Nachteil.
2. Vorteile sind nur punktweise, atomar, scopegleich und durch eine
   versionierte Serverregel zulässig.
3. Ein enger Objekt-, Gefahren-, Varianten- oder Klauselscope darf nicht als
   allgemeine Deckung ausgegeben werden.
4. Bei `componentSatisfactionPolicy: ALL` müssen alle erforderlichen
   Komponenten vollständig erfüllt sein. Ein Fix darf `ALL` nicht faktisch zu
   `ANY` machen.
5. Bei `ANY` müssen die verwendeten Alternativen beidseitig vollständig und
   identisch vergleichbar sein.
6. Limit, Selbstbehalt, Kosten, Prozent, Dauer, Bedingung und Qualifier müssen
   an die richtige Faktrolle, Komponente, Quelle und den richtigen Scope
   gebunden bleiben.
7. `PROPOSAL` beziehungsweise `PROPOSED_ONLY` ist kein aktiver
   Vertragsbestand. Ein Angebotsfakt darf nicht stillschweigend einen aktiven
   Vorteil erzeugen.
8. Hauptpolizze, Angebot, Supplement und Bedingungen bleiben getrennte
   Dokumentfakten, bis Rang, Geltung und Ersetzung nachgewiesen sind.
9. Quellen, physische Seiten und exakte Textspannen bleiben servereigen.
10. Eine sinkende Reviewzahl ist nur dann besser, wenn die neu entschiedenen
    Zeilen gegen ein fachliches Oracle richtig sind.
11. LF und WEVIG sind Regressionsexemplare, kein Beweis beliebiger
    Versicherer oder des 99-Prozent-Ziels.

Relevante Wissensverträge:

- `INV-002`: fehlende Evidenz ist kein Beweis fehlenden Schutzes;
- `INV-007`: Vorteile sind atomar und regelgebunden;
- `INV-008`: kontrolliertes Nichtfinden bleibt fachlich typisiert;
- `INV-009`: Produktprofil und Kundenexport sind versionierte Verträge;
- Produktcharter:
  `docs/PRODUKTZIEL_GENERALISIERUNG_UND_ABNAHME_DE.md`;
- Wissensrouter:
  `policy-project-documentation/POLIZZENVERGLEICH_KB_INDEX.md`.

## 3. Gebundene Ausgangsevidenz

### 3.1 Vollständiger Real-Run

Die aktuelle Fehlerliste stammt aus diesem Mac-Studio-Artefakt:

```text
/Users/michaelmischkot/Library/Application Support/
at.klincov.polizzenvergleich-v3/QA/
COMBINED-LIVE-SHADOW-D973977F-20260901-093350/
PACKAGE-COMPARISON/comparison.private.json
```

```text
Run-Implementierungscommit:
d973977f54b9d21a08bf34bdcde85e6d4e3cf047

comparison.private.json SHA-256:
3cc0ec829897a0674fe9183301b54dfb6f534935ebb1f45fcf925bdbb9cbbe4f

Produktprofil: CUSTOMER_CORE_5_V7
Kategorien: VS, FE, LW, ST, EL
Dokumente: 10
sichtbare Vergleichszeilen: 224
gespeichertes Ergebnisschema: V5
```

Der spätere Stand `66aabfe4` beziehungsweise `df3348c0` wurde auf dem Mac
Studio deterministisch gegen dieses Artefakt neu aggregiert und validiert. Es
gab seitdem noch keinen neuen vollständigen Modelllauf auf `df3348c0`.
Der aktuelle Quellbaum erzeugt Ergebnisschema V6. Aussagen über das
eingefrorene V5-Artefakt und Aussagen über den aktuellen Implementierungsstand
werden deshalb getrennt gehalten; das Originalartefakt wird nicht
rückwirkend überschrieben.

### 3.2 Verbindliche Kundenmetriken

Die sieben Ergebnisgruppen sind gegenseitig ausschließend und summieren sich
zu 224:

| Ergebnis                    |  Zeilen |
| --------------------------- | ------: |
| Vorteil A                   |       0 |
| Vorteil B                   |       0 |
| Dokumentationsunterschied   |      38 |
| Gleichwertig                |       7 |
| Kein dokumentierter Vorteil |      99 |
| Nicht vergleichbar          |      13 |
| Unklar                      |      67 |
| **Gesamt**                  | **224** |

Nur die 67 Zeilen mit `pointDecision.outcome == UNKLAR` sind
Kundenreviewzeilen. Die frühere Zahl 105 war ein historischer technischer
Differenzzähler und darf nicht mehr als Reviewzahl verwendet werden.

Die 67 Reviewzeilen besitzen folgende persistierte, disjunkte Reason-Gruppen:

| Gespeicherter Reasoncode                | Zeilen | Bearbeitungsstatus                            |
| --------------------------------------- | -----: | --------------------------------------------- |
| `PACKAGE_REVIEW_STATUS_BLOCKS_DECISION` |     39 | in diesem Dokument vollständig erstanalysiert |
| `MISSING_BOTH`                          |      9 | noch einzeln zu analysieren                   |
| `MISSING_ONE_SIDE`                      |      7 | noch einzeln zu analysieren                   |
| `ATOMIC_DOCUMENT_RANK_UNRESOLVED`       |      3 | noch einzeln zu analysieren                   |
| `ATOMIC_EVIDENCE_INCOMPLETE`            |      3 | noch einzeln zu analysieren                   |
| `NO_APPROVED_RULE_FOR_ALL_DIMENSIONS`   |      3 | noch einzeln zu analysieren                   |
| `ANY_COMPONENT_EVIDENCE_INCOMPLETE`     |      2 | noch einzeln zu analysieren                   |
| `CONDITIONAL_OR_EXCEPTION_SCOPE`        |      1 | noch einzeln zu analysieren                   |
| **Gesamt**                              | **67** |                                               |

Diese Reason-Gruppen dürfen nicht mit darunterliegenden Komponenten- oder
Dokumentproblemen addiert werden. Eine Vergleichszeile kann intern mehrere
Komponentenprobleme besitzen, bleibt aber genau eine Kundenzeile.

## 4. Arbeitspaket PBR-01: pauschaler Paket-Prüfstatus, 39 Zeilen

### 4.1 Was der Status bedeutet

`PACKAGE_REVIEW_STATUS_BLOCKS_DECISION` bedeutet nicht, dass keine Evidenz
gefunden wurde. Bei allen 39 Zeilen ist `evidenceFound == true` auf beiden
Paketseiten.

Der Status bedeutet ausschließlich:

```text
Mindestens eine Paketseite hat nach dem Dokumentrollup
reviewStatus != BELEGT.
```

Statusverteilung:

| Paket A / Paket B           | Zeilen |
| --------------------------- | -----: |
| `BELEGT / TEILBELEGT`       |     22 |
| `TEILBELEGT / TEILBELEGT`   |     14 |
| `TEILBELEGT / BELEGT`       |      1 |
| `BELEGT / RANGFOLGE_PRÜFEN` |      2 |
| **Gesamt**                  | **39** |

Kategorieverteilung:

| Kategorie  | Zeilen |
| ---------- | -----: |
| VS         |      8 |
| FE         |      7 |
| LW         |      7 |
| ST         |      8 |
| EL         |      9 |
| **Gesamt** | **39** |

### 4.2 Exakte Entstehungskette im Code

#### Stufe 1: atomare Dokumentbeurteilung

`server/utils/policyAnalysis/preparedEvidenceContract.js`

- materialisiert pro Requirement und Komponente `evidencePresence`,
  `coverageEffect`, `conflictState`, `selectedScopePicture`,
  `documentApplicability`, Kandidaten und Quellen;
- ungelöste Kandidaten und fehlende Komponenten bleiben sichtbar;
- die atomare Information ist in den Dokumentartefakten vorhanden.

#### Stufe 2: Dokumentrollup

`server/utils/policyAnalysis/categoryResultContract.js`

- rollt Komponenten zu einer Dokumentanforderung zusammen;
- unvollständige Komponenten, unbekannte Wirkungen und Präzedenzkonflikte
  werden nicht zu vollständig belegter Deckung hochgestuft.

`server/utils/policyAnalysis/categoryTableRenderer.js`, Funktion `reviewFor`

- setzt `WIDERSPRÜCHLICH` bei aktivem Same-Scope-Konflikt;
- setzt `UNGEKLÄRT` bei ungelöster Präzedenz oder ungeklärtem Rollup;
- setzt `TEILBELEGT`, wenn mindestens eines gilt:
  - Evidenzvollständigkeit nicht `COMPLETE`;
  - angeforderte Werte nicht vollständig;
  - Scope nicht vollständig;
  - eine erforderliche Deckungsentscheidung ist nicht bestimmbar;
- setzt nur sonst `BELEGT`.

#### Stufe 3: Paketrollup über mehrere Dokumente

`server/utils/policyComparison/resultBuilder.js`, Funktion
`summarizePackage`

- betrachtet alle Dokumentzeilen mit vorhandener Evidenz als Fakten;
- setzt `RANGFOLGE_PRÜFEN`, sobald mehrere Deckungswerte oder kanonische
  Betragswerte vorhanden sind;
- setzt `BELEGT` nur, wenn jeder einzelne Dokumentfakt `BELEGT` ist;
- setzt ansonsten das gesamte Paket pauschal auf `TEILBELEGT`;
- löst an dieser Stelle weder Dokumentgeltung noch Ersetzung noch
  komponentenbezogene Relevanz auf.

#### Stufe 4: vorzeitiger Punktentscheidungsabbruch

`server/utils/policyComparison/pointDecision.js`, Funktion `decidePoint`

```text
if packageA.reviewStatus != BELEGT
or packageB.reviewStatus != BELEGT
then PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
```

Dieser Guard läuft vor:

- `ALL`-/`ANY`-Behandlung;
- Gruppierung der atomaren Komponenten;
- Prüfung fehlender Komponenten;
- Mehrfachatom-/Dokumentrangprüfung;
- Quellen- und Kandidatenvollständigkeit;
- Scope- und Geltungsvergleich;
- Included-/Excluded-Vergleich;
- typisiertem Limit-/Selbstbehaltvergleich;
- Bedingungs- und Ausnahmeprüfung.

Die späteren atomaren Gates sind im Code vorhanden, werden für diese 39
Zeilen aber nicht erreicht. Deshalb bleiben `pointDecision.dimensions` in den
39 Vergleichszeilen leer und der persistierte Reasoncode kann die wirkliche
Ursache nicht erklären.

#### Stufe 5: Persistenz, Metrik, UI und XLSX

Betroffene nachgelagerte Pfade:

- `server/utils/policyComparison/resultBuilder.js`
  - baut `comparison.private.json`;
  - aggregiert Reasoncode-Zähler und Zeilenmitgliedschaften;
  - erzeugt Markdown und XLSX.
- `server/utils/policyComparison/customerMetricContract.js`
  - berechnet die 67 Reviewzeilen aus den Einzelzeilen;
  - validiert Reasoncode-Summen und exakte Mitgliedschaften.
- `server/utils/policyComparison/customerResultPresenter.js`
  - übersetzt den Reasoncode in verständlichen XLSX-Kundentext.
- `frontend/src/utils/chat/policyComparisonResultPresenter.cjs`
  - zählt Zeilen und Reviewgründe unabhängig neu;
  - zeigt derzeit alle 39 unter einem einzigen Label.
- `frontend/src/components/WorkspaceChat/ChatContainer/PolicyComparisonPanel/index.jsx`
  - rendert die Kundenmetriken und Prüfgrundaufschlüsselung.
- `server/endpoints/policyComparisons.js` und
  `server/scripts/policyComparisonWorker.cjs`
  - validieren beziehungsweise liefern das Ergebnis aus.

Eine Reasoncode-Änderung betrifft daher nicht nur `pointDecision.js`, sondern
auch Metrikvertrag, Legacy-Lesen, UI-Labels, XLSX-Text, Tests und gespeicherte
Mitgliedschaftslisten.

### 4.2.1 Quell- und Teststellen am Anlagestand `df3348c0`

Die Zeilenangaben sind an den Anlagestand gebunden und müssen nach jedem Fix
neu ermittelt werden. Funktionsnamen bleiben die stabilere Referenz.

| Verantwortung                                               | Datei / Bereich am Anlagestand                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| atomare Judgements zu Requirement-Rollups                   | `server/utils/policyAnalysis/preparedEvidenceContract.js:647-715`, `materializePreparedEvidence` |
| Dokumentstatus aus Vollständigkeit, Wert, Scope und Wirkung | `server/utils/policyAnalysis/categoryTableRenderer.js:365-386`, `reviewFor`                      |
| Tabellenzeilen aus Dokumentrollup                           | `server/utils/policyAnalysis/categoryTableRenderer.js:404-590`, `buildCategoryTableRows`         |
| Paketstatus aus allen beitragenden Dokumentzeilen           | `server/utils/policyComparison/resultBuilder.js:271-388`, `summarizePackage`                     |
| Atome aus Worksheet, Wirkung, Feldern und Quellen           | `server/utils/policyComparison/resultBuilder.js:615-715`, `materializeAtomicFacts`               |
| Paketmaterialisierung und Aufruf der Punktentscheidung      | `server/utils/policyComparison/resultBuilder.js:838-939`, `buildComparisonResult`                |
| Vollständigkeit eines Entscheidungsatoms                    | `server/utils/policyComparison/pointDecision.js:117-169`, `validSource`, `completeAtom`          |
| gegenwärtiger Paketstatus-Frühabbruch                       | `server/utils/policyComparison/pointDecision.js:623-627`, `decidePoint`                          |
| nachgelagerte Komponenten-/Atomgates                        | `server/utils/policyComparison/pointDecision.js:629-707`, `decidePoint`                          |
| Outcome-, Review- und Reason-Mitgliedschaften erzeugen      | `server/utils/policyComparison/customerMetricContract.js:25-73`, `deriveCustomerMetrics`         |
| gespeicherte Kundenmetriken unabhängig validieren           | `server/utils/policyComparison/customerMetricContract.js:140-273`, `validateCustomerComparison`  |
| XLSX-Kundentext für ungeklärte Gründe                       | `server/utils/policyComparison/customerResultPresenter.js:3-24,68-113`                           |
| UI-Nachzählung und Reason-Labels                            | `frontend/src/utils/chat/policyComparisonResultPresenter.cjs:3-25,53-119`                        |
| grober bestehender Point-Decision-Testvertrag               | `server/__tests__/utils/policyComparisonPointDecision.test.js:214-230`                           |
| Paket-/Atom-/Totals-Integrationstests                       | `server/__tests__/utils/policyComparisonResultBuilder.test.js`                                   |
| Metrik-Manipulations- und Paritätstests                     | `server/__tests__/utils/policyComparisonCustomerMetricContract.test.js`                          |
| XLSX-Presenter-Vertrag                                      | `server/__tests__/utils/policyComparisonCustomerResultPresenter.test.js`                         |
| unabhängiger Frontend-Presenter-Vertrag                     | `server/__tests__/frontend/policyComparisonResultPresenter.test.js`                              |
| Worker-Lifecycle-Vertrag                                    | `server/__tests__/scripts/qa/policyComparisonWorkerContract.test.js`                             |

Bei PBR-01.1 dürfen Änderungen voraussichtlich auf `pointDecision.js`, einen
kleinen Diagnosevertrag und die fokussierten Vergleichstests begrenzt werden.
Sobald neue Aggregate, Kundenlabels oder Schemafelder verpflichtend werden,
sind zusätzlich `resultBuilder`, `customerMetricContract`, beide Presenter,
Worker/API und ihre Tests betroffen.

### 4.3 Überschneidungsfreie Root-Cause-Taxonomie der 39 Zeilen

Die Detailursachen sind aus den zehn darunterliegenden Real-Dokumentartefakten
rekonstruiert. Sie sind noch nicht als `pointDecision.dimensions` im
Vergleichsartefakt gespeichert. Wo mehrere unabhängige Signale vorliegen,
wird die Zeile nicht willkürlich einem Einzelgrund zugeordnet, sondern der
Mehrfachgruppe.

#### PBR-01A: nur erforderliche Komponente fehlt, 11 Zeilen

Mindestens eine fachlich erforderliche Nicht-Wert-Komponente ist in einem
beitragenden Dokument `NOT_FOUND`. Es besteht kein zusätzlicher Wert-, Scope-
oder Rangblocker.

```text
VS-02, VS-15, VS-18, FE-D05, LW-07, LW-11,
ST-15, ST-18, ST-19, ST-25, EL-19
```

Beispiele:

- `VS-02`: `residual_value_threshold` fehlt im beitragenden Dokumentfakt;
- `LW-07`: `sanitary_ceramics` fehlt;
- `LW-11`: `boiler` und `radiator` fehlen;
- `ST-25`: `branch_removal_costs` fehlt;
- `EL-19`: die erforderliche Maschinenbruchkomponente bleibt unvollständig.

Risiko eines falschen Fixes: Das Ignorieren dieser Komponenten würde bei
`ALL` aus einem Teilbeleg eine Vollbejahung machen.

#### PBR-01B: Dokumentaggregation, Rang oder Geltung, 12 Zeilen

Echte explizite Rang-/Wirkungskonflikte:

```text
LW-18, ST-16
```

- `LW-18`: B enthält gleichgeltende Rahmenbedingungsfakten mit
  unterschiedlichen Wirkungen zur Rückstau-Spartenzuordnung.
- `ST-16`: B enthält Rahmenbedingungsfakten mit eingeschlossenen und
  ausgeschlossenen Markisen/Beschattungen.

Diese zwei Zeilen müssen fail-closed bleiben, bis Dokumentrang, Scope oder
Ersetzung nachgewiesen ist.

Gemischte vollständig und teilweise belegte Dokumentfakten im selben Paket:

```text
VS-21, VS-25, FE-A05, FE-D01, FE-E16,
FE-F05, LW-08, LW-12, ST-17, ST-21
```

Der aktuelle Paketrollup lässt den schwächeren Dokumentfakt die gesamte
Paketseite blockieren. Das Artefakt beweist aber noch nicht, ob der Teilfakt:

- irrelevant ist;
- denselben Inhalt nur unvollständig wiederholt;
- eine weiterhin geltende Ergänzung oder Einschränkung ist;
- durch ein ranghöheres Dokument ersetzt wird;
- einen anderen Scope betrifft.

Diese zehn Zeilen sind deshalb die wichtigsten Kandidaten für eine
komponentenbezogene Dokumentgeltungsprüfung, aber noch keine bewiesenen
Fehlblockaden.

#### PBR-01C: nur Werte- oder Limitbindung, 3 Zeilen

```text
VS-24, VS-36, LW-26
```

- `VS-24`: das erforderliche Gerüstkostenlimit ist nicht vollständig
  materialisiert;
- `VS-36`: auf B ist kein eindeutiger Ereignishöchstwert gebunden;
- `LW-26`: Rohrverstopfung/Reinigung ist gefunden, das erforderliche Limit
  bleibt jedoch unvollständig.

Risiko eines falschen Fixes: Ein fehlender Wert darf nicht als unbegrenzt,
null oder gleichwertig interpretiert werden.

#### PBR-01D: nur Scope oder Geltung, 3 Zeilen

```text
FE-A06, FE-A10, ST-27
```

- `FE-A06`: der B-Limitbeleg ist nur `NARROW_ONLY`;
- `FE-A10`: Anprall fremder Fahrzeuge ist auf B nur in engem Scope belegt;
- `ST-27`: auf A ist Lawine enger belegt, während Schneerutsch einen
  allgemeineren Scope besitzt.

Risiko eines falschen Fixes: Ein enger Objekt- oder Gefahrenscope würde als
allgemeine Deckung hochgerollt.

#### PBR-01E: mehrere unabhängige Blocker, 10 Zeilen

Komponente plus Wert:

```text
VS-22, EL-16
```

Wert plus Scope:

```text
EL-04, EL-17
```

Komponente plus Scope:

```text
EL-05, EL-08, EL-21, EL-27, EL-35
```

Wert plus ungelöster Kandidat beziehungsweise gegensätzliche
Dokumentwirkung:

```text
LW-27
```

Diese Zeilen dürfen nicht durch einen Einzelfix als vollständig gelöst
gelten. Jeder unabhängige Blocker muss bestehen oder typisiert als für die
Entscheidung irrelevant nachgewiesen sein.

Summenkontrolle:

```text
11 + 12 + 3 + 3 + 10 = 39 eindeutige Vergleichszeilen
```

### 4.4 Sekundärmerkmale, nicht als zusätzliche Fehler addieren

- 24 von 39 Zeilen enthalten mindestens einen `PROPOSAL`-Fakt.
- Bei 0 von 39 Zeilen ist `PROPOSED_ONLY` allein die technische Ursache für
  `TEILBELEGT`.
- 38 von 39 Zeilen verwenden `componentSatisfactionPolicy: ALL`.
- Nur `LW-08` verwendet `ANY`.
- Acht Zeilen besitzen eine Komponente; 31 besitzen zwei bis vier
  Komponenten.

Diese Zahlen überschneiden sich mit den fünf Root-Cause-Gruppen und dürfen
nicht zu 39 addiert werden.

### 4.5 Root Cause des Systems

Der Guard ist nicht einfach fachlich falsch. Er schützt momentan davor, aus
unvollständigen oder ungeklärten Fakten einen Gewinner abzuleiten. Der
Architekturfehler besteht in seiner Granularität:

```text
Dokumentstatus -> gröbster Paketstatus -> sofortiger Zeilenabbruch
```

Benötigt wird langfristig:

```text
Dokumentatome
-> komponentenbezogene Geltung/Rang/Ersetzung
-> dimensionsbezogene Zulässigkeit
-> Vergleich vollständiger entscheidender Atome
-> Zeilenrollup
```

Ein unvollständiger unterstützender Fakt darf nicht automatisch eine
vollständig belegte entscheidende Dimension vergiften. Er darf aber auch
nicht ohne Nachweis verworfen werden.

## 5. Sichere Fixreihenfolge für PBR-01

### Fix PBR-01.1: typisierte Blocker persistieren, keine Outcome-Änderung

Ziel:

- den generischen 39er-Sammelgrund in einem privaten Auditfeld durch konkrete
  komponenten- und seitenspezifische Blocker erklären;
- keine der 224 Kundenentscheidungen verändern;
- die heutige Sicherheitsgrenze vollständig erhalten.

Vorgeschlagene private Auditstruktur pro blockierter Seite und Komponente:

```text
packageReviewStatus
requirementId
componentId
factRole
evidencePresence
coverageEffect
conflictState
requestedFieldStatus
selectedScopePicture
documentApplicability
documentUuids
documentRole
documentStatus
selectedCandidateIds
unresolvedCandidateIds
blockerCodes
```

Implementierte versionierte Blockercodes in
`PACKAGE_REVIEW_BLOCKERS_V1`:

```text
MISSING_REQUIRED_COMPONENT
UNKNOWN_COVERAGE_EFFECT
COVERAGE_EFFECT_NOT_DECISIVE
FIELD_INCOMPLETE
SCOPE_INCOMPLETE
SOURCE_BINDING_INCOMPLETE
UNRESOLVED_CANDIDATE
MULTIPLE_ATOMS_SAME_COMPONENT
UNRESOLVED_DOCUMENT_PRECEDENCE
CONFLICTING_COVERAGE
UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER
```

Implementierte Signalcodes:

```text
PROPOSED_ONLY
CONDITIONAL_APPLICABILITY
```

Wichtig: `PROPOSED_ONLY` und `CONDITIONAL_APPLICABILITY` sind auditierbare
Geltungssignale, nicht automatisch primäre Blocker.

Implementierungsstand seit Commit
`1fb797d38035392a3e21c38b2e0cf65d80c5ef3f`:

- neues reines Diagnosemodul
  `server/utils/policyComparison/packageReviewAudit.js`;
- `pointDecision.js` ruft die Diagnose ausschließlich im bereits bestehenden
  Guard `PACKAGE_REVIEW_STATUS_BLOCKS_DECISION` auf;
- äußerer Outcome, Reasoncode, Reviewflag, Regel-ID und Dimensionen bleiben
  unverändert;
- `resultBuilder.js` persistiert zusätzlich
  `coverageAggregationPolicy`, `scopePolicy` und `requestedFields` in den
  Atomen und schreibt Ergebnisschema V7;
- `customerMetricContract.js` validiert den V7-Audit fail-closed gegen Seite,
  Requirement, Komponente, Dokument-UUID, Atomzustand, bekannte Codes sowie
  kanonische Sortierung;
- V6 bleibt ohne Audit lesbar; eine In-place-Migration alter Artefakte findet
  nicht statt;
- UI, Markdowntext und 17-spaltige XLSX-Struktur wurden nicht erweitert.

Abnahmekriterien:

- 224/224 Punktentscheidungen bleiben identisch;
- 67 Reviewzeilen und alle sieben Outcomezahlen bleiben identisch;
- die bisherigen 39 Zeilen bleiben zunächst `UNKLAR`;
- jede der 39 Zeilen besitzt mindestens einen konkreten Blocker mit Seite,
  Requirement, Komponente und vorhandener Dokumentidentität;
- Blocker referenzieren ausschließlich persistierte Serveratome;
- keine modellgenerierten Quellen oder freien Begründungen;
- privates JSON erhält die Diagnose; das 17-spaltige Kundenblatt bleibt
  strukturell unverändert;
- Legacy-Ergebnisse ohne Auditfeld bleiben lesbar und werden nicht
  rückwirkend umgedeutet;
- keine zusätzlichen Qwen- oder Embeddingaufrufe durch den Fix.

### Fix PBR-01.2: Reason-Diagnose für Metrik, UI und XLSX verständlich machen

Erst nachdem PBR-01.1 die atomaren Blocker persistiert und validiert, kann die
Darstellung differenzieren. Dabei muss entschieden werden, ob:

- der äußere Reasoncode aus Kompatibilitätsgründen bestehen bleibt und nur
  eine Blockeraufschlüsselung ergänzt wird; oder
- neue gegenseitig ausschließende Hauptreasoncodes eingeführt werden.

Bevorzugt wird zunächst der kompatible Weg: Outcome und äußerer Reasoncode
bleiben stabil, private Blockercodes werden zusätzlich gezählt. Dadurch
bleiben die 67er-Kundenmetrik und historische Reason-Mitgliedschaften
vergleichbar.

Implementierungsstand seit Commit
`766125f7e4a2adde955bd6f5218bb899f543397c`:

- `server/utils/policyComparison/customerResultPresenter.js:8-118` ordnet
  ausschließlich validierte Blockercodes festen deutschen Erklärfamilien zu,
  gruppiert sie nach Polizze A/B und dedupliziert gleiche Familien innerhalb
  derselben Seite;
- Signale wie `PROPOSED_ONLY` und `CONDITIONAL_APPLICABILITY` werden bewusst
  nicht als zusätzliche Kundenprobleme dargestellt;
- `server/utils/policyComparison/customerMetricContract.js:315-348`
  validiert zuerst das vollständige V7-Ergebnis und erzeugt danach eine neue,
  nicht mutierende Kundenlesesicht; ausschließlich der Begründungstext der 39
  Paketstatuszeilen wird darin ersetzt;
- das gespeicherte private Ergebnis, der äußere Reasoncode, das Outcome,
  `reviewRequired`, die 67er-Kundenmetrik und alle Mitgliedslisten bleiben
  unverändert;
- die Excel-Ausgabe nutzt dieselbe validierte Kundenlesesicht. Dadurch können
  UI und XLSX nicht unabhängig voneinander eigene Blockerlogik entwickeln;
- `frontend/src/utils/chat/policyComparisonResultPresenter.cjs:15-16`
  bezeichnet die Gruppe als „Offene Teilpunkte in mindestens einer Polizze“;
- `frontend/src/components/WorkspaceChat/ChatContainer/PolicyComparisonPanel/index.jsx:506-510`
  stellt klar, dass mehrere Hinweise in derselben Zeile nicht zusätzlich
  gezählt werden;
- unbekannte, fehlende oder ungültige Audits fallen fail-closed auf den
  bisherigen generischen Kundentext zurück;
- technische Codes, Dokument-UUIDs und Kandidaten-IDs werden nicht in den
  Kundentext übernommen.

Damit wurde PBR-01.2 als Darstellungs- und Nachvollziehbarkeitsfix umgesetzt,
nicht als fachliche Freischaltung. Die detaillierten Blocker bleiben im
privaten Audit vollständig erhalten; Kunden sehen nur kontrollierte, stabile
Begriffsfamilien.

### Fix PBR-01.3: dokumentbezogene Zulässigkeit für die zehn Mischfälle

Kein globales Lockerungsgate. Pro Komponente muss nachgewiesen werden, dass
ein Teilfakt:

- nicht entscheidend ist;
- identisch zu einem bereits vollständigen Fakt ist;
- nachweislich ersetzt wurde; oder
- einen anderen, für die konkrete Dimension nicht einschlägigen Scope hat.

Benötigter versionierter Dokumentbeziehungsvertrag, mindestens:

```text
SUPPLEMENTS
REPLACES
NARROWS
BROADENS
APPLIES_TO_COMPONENT
SAME_SCOPE
DIFFERENT_SCOPE
```

Eine generische Regel wie „Supplement schlägt Bedingungen“ ist verboten. Ein
Supplement kann nur einen Teilbereich erweitern, während die Grundbedingungen
für andere Bereiche fortgelten.

### Fix PBR-01.4: einzelne reine Komponenten-, Wert- und Scopefälle

Danach werden ausschließlich einzeln abgegrenzte semantische Verträge
bearbeitet:

- fehlende Requirement-Komponente;
- Werte-/Limitbindung;
- Scope-/Applicability-Bindung;
- Mehrfachblocker erst nach Abschluss aller enthaltenen Einzelverträge.

Jeder dokumentbezogene Fix benötigt positive, negative, adversariale und
Scopevarianten sowie LF-/WEVIG-Regression und – sobald vorhanden – einen
unbekannten Versicherer-/Dokument-Holdout.

## 6. Nicht zulässige Schnellfixes

Folgende Änderungen sind ausdrücklich gesperrt:

- den Paketstatus-Guard vollständig entfernen;
- jedes `TEILBELEGT` zur atomaren Gewinnerentscheidung durchlassen;
- nur den stärksten oder ersten Dokumentfakt behalten;
- `PROPOSAL` pauschal als aktiv behandeln;
- `SUPPLEMENT` pauschal über `TERMS` stellen;
- fehlende Komponenten bei `ALL` ignorieren;
- fehlende Limits als unbegrenzt oder gleich behandeln;
- `NARROW_ONLY` zu `GENERAL` erweitern;
- Nullfunde ohne zertifizierten Such-/Fachvertrag als nicht enthalten
  behandeln;
- Reviewzahlen reduzieren, ohne die geänderten Zeilen und ihre Oracleurteile
  auszuweisen.

## 7. Systemauswirkungen und zu prüfende Abhängigkeiten

### 7.1 Korrektheit

Must change:

- die 39 Zeilen müssen konkrete persistierte Blocker erhalten;
- eine spätere Entscheidung darf nur vollständige, quellengebundene,
  rangaufgelöste und vergleichbare Atome verwenden.

### 7.2 Persistenz und Schemas

Zu prüfen:

- `comparison.private.json`-Schema und Schema-Version;
- `pointDecision.schemaVersion`;
- Legacy-Adapter für ältere Ergebnisse;
- `customerMetricContract` und Mitgliedschaftsvalidierung;
- Worker-Validierung vor `COMPLETED`;
- API- und Download-Gates;
- Run-Signatur und Releasebindung.

### 7.3 Kundenoberfläche und Export

Zu prüfen:

- Reviewzahl bleibt zeilenbasiert;
- neue Diagnosedetails werden nicht als zusätzliche Probleme addiert;
- Kundenbegriffe bleiben verständlich;
- das XLSX bleibt bei einem Blatt, 17 Spalten und 224 Zeilen;
- technische Blocker gehören primär ins private Audit beziehungsweise ein
  technisches Prüfblatt, nicht ungefragt in neue Kundenspalten;
- UI- und XLSX-Presenter dürfen semantisch nicht auseinanderlaufen.

### 7.4 Laufzeit und Modellbetrieb

PBR-01.1 ist ein deterministischer Materialisierungsfix und soll keine neuen
Modellaufrufe erzeugen. Ein deutlicher Laufzeitanstieg wäre eine Regression.
Spätere Recall-, Triage- oder Feldextraktionsfixes können Modellaufrufe
verändern und müssen separat gemessen werden.

### 7.5 Sicherheit und Datenschutz

- private Quellen, Kandidaten und Dokument-UUIDs bleiben in privaten
  Artefakten;
- Kundenexporte dürfen keine internen absoluten Pfade oder freien
  Modellantworten erhalten;
- alle neuen Artefakte erhalten restriktive Dateirechte und SHA-Bindung.

## 8. Test- und Runvertrag pro Code-Fix

Alle Tests und Läufe erfolgen ausschließlich über `ssh macstudio` in einem
isolierten Checkout des exakten Commits.

Zu protokollieren:

```text
Fix-ID
Commit SHA
Mac-Studio-Checkout
Git-Status vor und nach dem Lauf
Node-Version
Produktprofil
Qwen-Modell-ID
Kontextlänge
Parallelität
Embeddingmodell geladen: ja/nein
Dokumentliste, Rollen, Stati und SHA-256
Run-Signatur
Start, Ende, Wandzeit
Modellaufrufe und Retries
224-Zeilen-Parität
XLSX-/JSON-/Markdown-SHA-256
Zitatprovenienz
Outcomeverteilung
Review-Reasonverteilung
exakte geänderte Zeilenschlüssel
neue Vorteile mit Regel-ID und Oracleurteil
Regressionen gegenüber jedem Favoriten-Report
Beweisgrenze
GO / REVISE / REVERT-Entscheidung
```

Abbruch- und Revertkriterien:

- weniger oder mehr als 224 sichtbare Zeilen;
- fehlende oder doppelte Zeilenschlüssel;
- erfundene oder nicht seitengebundene Quelle;
- neue Vorteile ohne vollständig belegte freigegebene Regel;
- `PROPOSED_ONLY` erzeugt aktiven Vorteil;
- `ALL` wird unvollständig erfüllt;
- Scope wird erweitert;
- Wert oder Qualifier wird an falsche Rolle gebunden;
- Paket-/Dokumentidentität oder Modellvertrag weicht ab;
- Kundenmetrik, UI und Export widersprechen einander;
- ungeklärte Regression in nicht beauftragten Zeilen.

## 9. Favoriten- und Baseline-Reports

Die Favoriten- und Baseline-Artefakte wurden auf dem Mac Studio read-only
inventarisiert. Sie haben unterschiedliche Beweisrollen und dürfen nicht als
ein gemeinsames Oracle behandelt werden.

### 9.1 Primäre Qualitätsbaseline: `d973977f`

```text
Commit:
d973977f54b9d21a08bf34bdcde85e6d4e3cf047

Run-Root:
/Users/michaelmischkot/Library/Application Support/
at.klincov.polizzenvergleich-v3/QA/
COMBINED-LIVE-SHADOW-D973977F-20260901-093350

Profil: CUSTOMER_CORE_5_V7
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42.496
Dokumente/Kategorien/Paketzeilen: 10 / 50 / 224
Primärlaufzeit: 1.806 s = ungefähr 30:06
Run-Signatur:
94da3d184e8015826e7fbad09560fa8593f54427e07ba89d292fb38db768e122

comparison.private.json SHA-256:
3cc0ec829897a0674fe9183301b54dfb6f534935ebb1f45fcf925bdbb9cbbe4f
comparison.md SHA-256:
a505c46ed85dfcbab0518c179988785e0fc7094c2139baece180da7c5fb9a391
polizzenvergleich.xlsx SHA-256:
8280e192fa39cf38ed2ca1b9810a246c2cf76f0b4a82e735d9f26f00bc2c52a2
```

Dies ist die primäre Qualitäts- und aktuelle Fehlerbaseline. Sie enthält die
verbindliche 224er-Outcomeverteilung sowie 67 Review- und 39
Paketstatuszeilen.

### 9.2 Eingefrorene Reproduzierbarkeitsbaseline: `63ecc750`

```text
Commit:
63ecc750f0663e6cb771ffd8ef13a153ddada4cc
Tag:
baseline/v7-63ecc750-20260901

Rerun-Root:
/private/tmp/pv3-63ecc750-rerun-20260901-0619

exportiertes XLSX:
/Users/michaelmischkot/Downloads/Projekt Lokale KI/Vergleiche/
Gesamtvergleich-rerun-63ecc750-20260901-0619.xlsx
XLSX SHA-256:
e0529ef09467d9b2912b9f71603065c8a2cbafd2eca2ce7eb5299af4f0bd7742
Run-Signatur:
f98d66666dcd80bf07f4d98600530aed9e546d9c32a3906cf4d10f5d9c422645
Markdown SHA-256:
a505c46ed85dfcbab0518c179988785e0fc7094c2139baece180da7c5fb9a391
```

Diese Baseline besitzt dieselben 224 Entscheidungen wie `d973977f` und ist
zusätzlich als Git-Bundle und Run-ZIP außerhalb des Arbeitscheckouts gesichert.
Sie dient als Rückfall- und Reproduzierbarkeitskontrolle, nicht als neues
fachliches Oracle.

### 9.3 Historische Laufzeitbaseline: `343a665e`

```text
Gesamtzeit: 27:01,550
Dokumente: 10/10
Paketzeilen: 224/224
```

Dieser Lauf verwendet ein älteres Profil und ältere Fachlogik mit bekannten
Recallfehlern. Er ist ausschließlich eine Performance-Orientierung. Ein neuer
Lauf darf fachlich besser und geringfügig langsamer sein. Die vom Nutzer
genannte akzeptable Obergrenze von ungefähr 30 bis 40 Minuten bleibt zu
beobachten.

### 9.4 Metrik-Replay: `66aabfe4`

Das Replay beweist die korrekte Kundenreviewzahl 67 sowie Server-/UI-Parität.
Es ist kein Modell-Full-Run und darf nicht zur Aussage über Recall,
Extraktionsqualität oder Laufzeit verwendet werden.

### 9.5 Shadow-Report: getrennte Diagnose

```text
XLSX:
/Users/michaelmischkot/Downloads/Projekt Lokale KI/Vergleiche/
Live-Shadow-Gesamtvergleich-d973977f-20260901-093350.xlsx
SHA-256:
1319d313d4a3a971d88583f46d16f04e4dd5480ce9f721e9d4b4aad18c8428ae
Shadowzeit: ungefähr 6:03,5
Gesamtsequenz Primär + Shadow: ungefähr 37:26
Pipeline-Recall im Pilot: 4/7
Selection-FPR auf True-Null: 0/3
adversariale Ablehnung: 3/6
```

Shadow bleibt ein Add-on-Audit und darf weder Primärergebnis noch
Favoritenbaseline ersetzen.

### 9.6 Kuratierte Goldstandarddateien

`Goldstandard-Codex-Draft-LF-WEVIG-5-Kategorien-v0.1.xlsx` sowie die getrennten
LF-/WEVIG-Dateien sind hilfreiche kuratierte Arbeitsreferenzen. Sie sind aber
kein vollständig expertengelabeltes Oracle und werden deshalb nur
zeilenbezogen als Gegenprüfung verwendet.

### 9.7 Verbindlicher Vergleich jedes neuen Runs

Jeder neue Code-Fix-Run wird mindestens gegen `d973977f` und `63ecc750`
verglichen. `343a665e` liefert nur die historische Zeitgrenze. Shadow und
kuratierte Goldstandarddateien werden getrennt ausgewiesen.

## 10. Run-Protokoll

### RUN-PBR-BASELINE-D973

```text
Status: abgeschlossen, gebundene Ausgangsbasis
Commit: d973977f54b9d21a08bf34bdcde85e6d4e3cf047
Profil: CUSTOMER_CORE_5_V7
Zeilen: 224
Vorteil A/B: 0 / 0
Dokumentationsunterschied: 38
Gleichwertig: 7
Kein dokumentierter Vorteil: 99
Nicht vergleichbar: 13
Unklar: 67
Paketstatus-Blocker: 39
Primärlaufzeit: ungefähr 30:06
Artefakt-SHA: 3cc0ec829897a0674fe9183301b54dfb6f534935ebb1f45fcf925bdbb9cbbe4f
```

### RUN-PBR-01.1

```text
Status: Full Run und Favoritenvergleich bestanden
Fix-Commit: 1fb797d38035392a3e21c38b2e0cf65d80c5ef3f
Mac-Studio-Checkout:
/private/tmp/pv3-pbr-1fb797d3-xTgyGV/repo
Mac-Studio-Gitstatus vor und nach dem Lauf: sauber
Node: v22.23.2
Profil: CUSTOMER_CORE_5_V7
Vergleichsvertrag: CERTIFIED_COVERAGE_ONLY_TYPED_V2
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42.496
Parallelität: 1; zehn Dokumente strikt seriell
Dinghy: not-loaded
Dokumente/Kategorien/Paketzeilen: 10 / 50 / 224
erfolgreicher Lauf: ungefähr 18:10:07 bis 18:40:52 Europe/Vienna
Wandzeit: 1.845 s = 30:45
Run-Signatur:
9203011830b10a2f2bad7ee8e3f92607feb3dd6e8fbe57bbda12d61e6e7618fc
Run-Root:
/Users/michaelmischkot/Library/Application Support/
at.klincov.polizzenvergleich-v3/QA/
PBR-01-1-1FB797D3-20260901-180917

Inputmanifest SHA-256:
50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
Paketvertrag SHA-256:
b3da785b5f5be6dfcbb96cb078ade4a04520a2eba8c1a6534201ee71eee86158
comparison.private.json SHA-256:
febf5c2ef91fe6ec19f80bd127ff52ecd0910578267185ead21d1f1ac51c8853
comparison.md SHA-256:
e1b3b9e7d630de179aeea1c9133d211e1e15cf37c0b3d2b995e73e45629bea47
polizzenvergleich.xlsx SHA-256:
4e7983b028dbe96d07f670fd00f2a10d8871c273c171c5f6a772a4dea297b128

Produktiver V7-Validator: PASS
Zeilen-/Outcome-/Reason-Recount: PASS
Outcome-Mitgliedschaften gegen d973977f: exakt identisch
Review-Reason-Mitgliedschaften gegen d973977f: exakt identisch
Entscheidungsprojektion gegen d973977f: 0 Übergänge
Vergleich gegen 63ecc750: dieselben 224 Kundenentscheidungen bestätigt

Vorteil A/B: 0 / 0
Dokumentationsunterschied: 38
Gleichwertig: 7
Kein dokumentierter Vorteil: 99
Nicht vergleichbar: 13
Unklar/Kundenprüfung: 67
Paketstatus-Blocker: 39
Audits auf Paketstatuszeilen: 39/39
fehlende Audits: 0
Audits außerhalb des Sammelgrunds: 0
UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER: 0 Records / 0 Zeilen

Blockerverteilung, Records / eindeutige Zeilen:
COVERAGE_EFFECT_NOT_DECISIVE: 10 / 8
FIELD_INCOMPLETE: 17 / 14
MISSING_REQUIRED_COMPONENT: 75 / 24
MULTIPLE_ATOMS_SAME_COMPONENT: 13 / 12
SCOPE_INCOMPLETE: 12 / 9
UNRESOLVED_CANDIDATE: 2 / 2
UNRESOLVED_DOCUMENT_PRECEDENCE: 2 / 2

Signalverteilung, Records / eindeutige Zeilen:
CONDITIONAL_APPLICABILITY: 69 / 35
PROPOSED_ONLY: 20 / 17

Favoriten-Laufzeitdelta zu d973977f: +39 s, ungefähr +2,2 Prozent
historische 27:01-Laufzeit: nur Performancebeobachtung, kein Qualitätsoracle
Entscheidung: GO für den Diagnosevertrag; keine fachliche Freischaltung
```

Anlaufbeobachtungen:

- Der erste Wrapperversuch stoppte vor Dokument 1 wegen des in Zsh
  schreibgeschützten Variablennamens `status`; kein Modellaufruf und kein
  fachliches Artefakt entstanden.
- Der zweite Versuch stoppte ebenfalls vor dem ersten Modellaufruf, weil dem
  Unit-Test-Dependency-Symlink das Collector-Paket `pdf-parse` fehlte. Der
  isolierte Checkout erhielt danach einen Symlink auf den unveränderten
  installierten `collector/node_modules`-Baum.
- Die Laufzeit ist daher nicht vollständig hermetisch bezüglich
  Dependencies; Quellcode, Release-ID, Manifest, Modell, Kontext und PDFs
  waren dagegen exakt gebunden.
- Beim GenVerbund-PDF meldete der Parser `TT: undefined function: 21`; die
  Extraktion schloss dennoch mit 15 Seiten ab. Diese Warnung bleibt unter
  Beobachtung.

### RUN-PBR-01.2

```text
Status: Full Run und Favoritenvergleich bestanden
Fix-Commit: 766125f7e4a2adde955bd6f5218bb899f543397c
Mac-Studio-Checkout:
/private/tmp/pv3-pbr012-766125f7-3woHDq/repo
Mac-Studio-Gitstatus nach Lauf und Nachvalidierung: sauber
Profil: CUSTOMER_CORE_5_V7
Vergleichsvertrag: CERTIFIED_COVERAGE_ONLY_TYPED_V2
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42.496
Parallelität: 1; zehn Dokumente strikt seriell
Dinghy: not-loaded
Dokumente/Kategorien/Paketzeilen: 10 / 50 / 224
Wandzeit: 1.827 s = 30:27
Run-Signatur:
2e444b76f36a1c2b8d70b68748567a4131975f7ca30f5cdd791a098333291323
Run-Root:
/Users/michaelmischkot/Library/Application Support/
at.klincov.polizzenvergleich-v3/QA/
PBR-01-2-766125F7-20260901-185258

Inputmanifest SHA-256:
50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
Paketvertrag SHA-256:
d2555257835a1ca1cf90e71b0a142d05d0ea0055ce744ca05d2e89895885909c
comparison.private.json SHA-256:
0cc0f18180eadde357ea42edaddec88878200856e29467875d7fe07825727710
comparison.md SHA-256:
e1b3b9e7d630de179aeea1c9133d211e1e15cf37c0b3d2b995e73e45629bea47
polizzenvergleich.xlsx SHA-256:
2bf40c1980d09c861ee626764d5825580aa195e53bb28a820f395dda7f22b19a
package-report.private.json SHA-256:
0c515c6669235cfec8c5906412debfead0f3e58c9187e84ef1f6172143e35018

Produktiver V7-Validator: PASS
Zeilen-/Outcome-/Reason-Recount: PASS
224 eindeutige Zeilenschlüssel: PASS
Outcome-Mitgliedschaften gegen d973977f: exakt identisch
Review-Reason-Mitgliedschaften gegen d973977f: exakt identisch
Entscheidungsprojektion gegen d973977f: 0 Übergänge
Entscheidungsprojektion gegen 63ecc750: 0 Übergänge
Entscheidungsprojektion gegen PBR-01.1: 0 Übergänge
vollständiger Kategorienbaum gegen PBR-01.1: byte-inhaltlich identisch

Vorteil A/B: 0 / 0
Dokumentationsunterschied: 38
Gleichwertig: 7
Kein dokumentierter Vorteil: 99
Nicht vergleichbar: 13
Unklar/Kundenprüfung: 67
Paketstatus-Blocker: 39
Audits auf Paketstatuszeilen: 39/39
fehlende Audits: 0
UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER: 0 Records / 0 Zeilen

Validierte Kundenlesesicht:
39/39 Paketstatuszeilen mit seitenspezifischer Erklärung
39/39 mit Hinweis, dass Mehrfachhinweise nicht zusätzlich gezählt werden
0 technische Code-/UUID-/Kandidaten-ID-Leaks
Quellergebnis durch die Transformation nicht mutiert

Excel-Gegenprüfung PBR-01.1 -> PBR-01.2:
ein Blatt „Gesamtvergleich“
225 Zeilen inklusive Kopfzeile
17 Spalten
genau 39 geänderte Zellen
alle 39 Änderungen ausschließlich in Spalte 17 „KI-Ergebnis“
185/185 übrige Datenzeilen zellgleich
39/39 verständliche Paketblockererklärungen
0 technische Code-/UUID-/Kandidaten-ID-Leaks

Favoriten-Laufzeitdelta zu d973977f: +21 s, ungefähr +1,2 Prozent
Laufzeitdelta zu PBR-01.1: -18 s
Entscheidung: GO für PBR-01.2; weiterhin keine fachliche Freischaltung
```

Warum sich die Hashes trotz identischer Entscheidungen unterscheiden:

- das private V7-Ergebnis enthält seit PBR-01.1 zusätzlich den versionierten
  Paketreviewaudit und laufgebundene Metadaten;
- PBR-01.2 lässt den vollständigen Kategorienbaum gegenüber PBR-01.1
  unverändert;
- die XLSX-Datei ändert sich absichtlich, weil genau die 39 generischen
  Begründungen verständlich ersetzt werden;
- der identische Markdown-Hash gegenüber PBR-01.1 ist erwartet, weil der
  gespeicherte technische Reasontext nicht mutiert wird.

## 11. Weitere Arbeitspakete der 67 Reviewzeilen

Diese Pakete werden strikt in der gespeicherten Reihenfolge bearbeitet, sobald
PBR-01 abgeschlossen oder bewusst in kleinere Folgeschritte zerlegt wurde:

1. `PBR-02`: `MISSING_BOTH`, 9 Zeilen;
2. `PBR-03`: `MISSING_ONE_SIDE`, 7 Zeilen;
3. `PBR-04`: `ATOMIC_DOCUMENT_RANK_UNRESOLVED`, 3 Zeilen;
4. `PBR-05`: `ATOMIC_EVIDENCE_INCOMPLETE`, 3 Zeilen;
5. `PBR-06`: `NO_APPROVED_RULE_FOR_ALL_DIMENSIONS`, 3 Zeilen;
6. `PBR-07`: `ANY_COMPONENT_EVIDENCE_INCOMPLETE`, 2 Zeilen;
7. `PBR-08`: `CONDITIONAL_OR_EXCEPTION_SCOPE`, 1 Zeile.

Für jedes Paket werden vor einer Implementierung dieselben Abschnitte wie für
PBR-01 ergänzt: exakte Mitgliedsliste, Real-Artefakte, Root Cause,
Abhängigkeiten, Nicht-Ziele, Fixvertrag, Risiken, Abnahmekriterien und
Favoriten-Run-Vergleich.

## 12. Offene Annahmen und Beweisgrenzen

- Die zehn gemischten `BELEGT`-/`TEILBELEGT`-Fälle sind noch nicht als
  unnötige Blockaden bewiesen. Es fehlt eine fachlich belastbare
  Dokumentgeltungs-/Ersetzungsauflösung.
- `NARROW_ONLY` beweist nicht automatisch einen wirtschaftlichen Nachteil;
  sicher ist nur, dass es nicht als allgemeiner Scope ausgegeben werden darf.
- Ein gefundenes Angebot kann vollständig belegt sein und bleibt trotzdem
  vorgeschlagen statt aktiv.
- Die aktuelle Real-Analyse beweist Fehler und Verhalten für die gebundenen
  LF-/WEVIG-Dokumente. Sie beweist keine allgemeine Versichererabdeckung.
- Shadow-Suche löst PBR-01 nicht allgemein, weil in allen 39 Zeilen bereits
  Evidenz vorhanden ist. Die offenen Ursachen liegen überwiegend in
  Komponente, Wirkung, Wert, Scope, Rang und Rollup.
- Ein neuer Vorteil ist erst dann eine Verbesserung, wenn seine Atomfakten,
  Quellen, Geltung, Vergleichsregel und fachliche Richtigkeit unabhängig
  geprüft sind.
- Eine erneute Quellprüfung der 39 Paketstatuszeilen fand keine Zeile, die
  ohne neuen semantischen Vertrag sicher zu einem Vorteil oder einer anderen
  Endentscheidung freigeschaltet werden kann. Das ist kein Beweis, dass alle
  39 fachlich unentscheidbar sind; es ist ein Beweis, dass die bestehende
  Atombindung noch nicht genügt, um den heutigen Guard gefahrlos zu entfernen.
- Besonders aussichtsreich, aber noch nicht freigabereif, sind unter anderem:
  `LW-12` mit einem auf maximal eine Heizungsschleife begrenzten Fund,
  `ST-25` mit fehlender `branch_removal_costs`-Komponente,
  `ST-17` mit Definitions-/Dokumentrangfrage, `FE-D05` mit fehlendem
  `without_own_fire`-Teilpunkt sowie `FE-A05`, `FE-A06`, `FE-D01`, `LW-26`,
  `ST-21` und `ST-27` mit Scope-, Vorschlags-, Wert- oder Rangbindungen.
- Diese Fälle dürfen nicht über eine gemeinsame Lockerung gelöst werden. Ein
  erster enger Folgevertrag könnte für `LW-12` die semantische Form
  `INSURED_OBJECT_COVERAGE_WITH_BOUND_SCOPE_LIMIT_V1` abbilden. Er muss den
  Wortlaut „maximal eine Heizungsschleife“ als gebundenes Scope-Limit, die
  Rollen Definition versus Deckung sowie Dokumentgeltung und Rang gemeinsam
  prüfen.

## 13. Aktueller nächster Schritt

PBR-01.1 und PBR-01.2 sind umgesetzt und durch je einen vollständigen
Mac-Studio-Lauf abgesichert. Der nächste sichere Schritt ist nicht das
globale Entfernen des Paketstatus-Guards, sondern die Einzelanalyse des ersten
engen semantischen Vertrags aus PBR-01.3/PBR-01.4.

Vorgesehene Reihenfolge:

1. `LW-12` vollständig auf Atom-, Scope-, Wert- und Dokumentrangebene gegen
   die Realquellen rekonstruieren;
2. den wiederverwendbaren Vertrag
   `INSURED_OBJECT_COVERAGE_WITH_BOUND_SCOPE_LIMIT_V1` spezifizieren;
3. vor Codeänderung positive, negative, adversariale und Scopevarianten sowie
   das erwartete LF-/WEVIG-Oracleurteil dokumentieren;
4. erst danach einen kleinen Codefix committen;
5. wieder einen isolierten vollständigen Mac-Studio-Lauf durchführen und
   Outcome-, Reason-, Zeilen- und XLSX-Delta gegen `d973977f`, `63ecc750` und
   den unmittelbar vorherigen Fixrun protokollieren.

Falls die Realquelle oder Dokumentbeziehung das erwartete Urteil nicht
eindeutig trägt, wird kein Outcome entsperrt. Dann bleibt `LW-12` offen und
der Befund wird als fehlender Vertrag beziehungsweise fehlendes Oracle
dokumentiert, statt die Sicherheitsgrenze pauschal zu lockern.

## 14. Einzelklassifikation der zehn aussichtsreichsten PBR-01-Kandidaten

Die zehn Kandidaten wurden nicht als gemeinsamer Lockerungsblock behandelt.
Jede Zeile wurde gegen gespeicherte Atome, Dokumentstatus, Scope, Rang,
Komponentenvertrag und den produktiven Entscheidungsweg geprüft.

| Zeile    | Befund                                                                                          | Freigabe                                  | Benötigter wiederverwendbarer Vertrag                  |
| -------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| `FE-A05` | Mehrere Atome, Rollen und Scope-Stufen auf B; kein eindeutiger atomarer Vergleich               | NO-GO                                     | Objekt-Scope-Set und Dokumentrang gemeinsam binden     |
| `FE-A06` | Ein einziger Scope-Unterschied bei sonst vollständigen Atomen ist eng entscheidbar              | GO, umgesetzt und im Vollauf bestätigt    | `SOLE_SCOPE_REVIEW_BLOCKER_TO_ATOMIC_NONCOMPARABLE_V1` |
| `FE-D01` | Feldvollständigkeit, Aggregation und Dokumentrang gleichzeitig offen                            | NO-GO                                     | typisierte Feld- und Rangauflösung                     |
| `LW-26`  | erforderliches B-Limit fehlt                                                                    | NO-GO                                     | belastbare lokale Limitbindung                         |
| `LW-12`  | Fund gilt nur für maximal eine Heizungsschleife/Reparaturbedingung                              | NO-GO                                     | `INSURED_OBJECT_COVERAGE_WITH_BOUND_SCOPE_LIMIT_V1`    |
| `ST-17`  | Objektliste, Governor, Limit und Dokumentbeziehung vermischt                                    | NO-GO                                     | Objektklassifikation plus Rang und Limit               |
| `ST-25`  | beide Seiten belegen Baumkosten, aber nicht die erforderlichen Astkosten                        | NO-GO                                     | keine Lockerung; `ALL` bleibt korrekt                  |
| `FE-D05` | Rauch-/Rußtrigger kann „ohne eigenes Feuer“ semantisch implizieren, aber nicht als bloßes Alias | GO nur für spätere Semantik               | versionierter Ausdrucks-/Implikationsvertrag           |
| `ST-21`  | EABS-Objektliste wurde durch vorherige lokale Negation fälschlich als `EXCLUDED` bewertet       | MUST-FIX der Evidenzwirkung; kein Vorteil | getrennte Listen- und Objektklassifikationsverträge    |
| `ST-27`  | bestehende Lawinenquelle und Gruppenlimit auffindbar, Ausgang bleibt wegen Ontologie/Rang offen | GO für Quellenwahl, NO-GO für Ausgang     | Gruppenlimit-, Ontologie- und Rangvertrag              |

Abhängigkeiten und Nicht-Ziele:

- `FE-A06` darf nur freigeschaltet werden, wenn beide Seiten genau denselben
  Ein-Komponenten-`ALL`-Vertrag, je genau ein vollständiges Atom und keinerlei
  Rang-, Konflikt- oder Unresolved-Signal besitzen. Der einzige Auditblocker
  muss komponentengenau `SCOPE_INCOMPLETE` sein. Ziel wäre ausschließlich
  `NICHT_VERGLEICHBAR`, niemals ein Vorteil.
- `FE-D05` darf nicht über zusätzliche Wortaliasse gelöst werden. Ursache,
  Objekt, Trigger und Negation müssen in einem versionierten Ausdruck
  gemeinsam ausgewertet werden.
- `ST-21` und `ST-16` teilen die technische Ursache: Ein lokaler
  Klammerausschluss in einem vorherigen oder demselben Listenpunkt darf nicht
  als globale Wirkung auf andere definierte Objekte übertragen werden.
- Kein Kandidat beweist derzeit einen neuen Vorteil A oder B. Fehlende oder
  neutrale Definitionsevidenz darf weiterhin keinen Vorteil erzeugen.

## 15. RUN-CANDIDATE-LIST-BOUNDARY-2AC7D41A

```text
Status: REVISE / unvollständig; ausdrücklich kein Favoritenlauf
Commit: 2ac7d41a486060ed367a89ef9aa20a371e62e8df
Mac-Studio-Checkout:
/private/tmp/pv3-list-boundary-5d295ec3-pvGiTw/repo
Run-Root:
/Users/michaelmischkot/Library/Application Support/
at.klincov.polizzenvergleich-v3/QA/
CANDIDATE-LIST-BOUNDARY-2AC7D41A-20260901-204322
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42.496
Temperatur: 0
Inputmanifest SHA-256:
50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
Erhaltene Laufzeit bis Abbruch: ungefähr 29:50
Fertig: neun Dokumente plus DOC-10/VS, FE und LW = 48/50 Kategorien
Fehlend: DOC-10/ST, DOC-10/EL, Paketvergleich, 224-Zeilen-Auswertung, XLSX
```

Reproduzierbarer DOC-10/ST-Befund:

- Worksheet-SHA-256:
  `b586a12be1504fc7520ebc2ed3fb72fa06dbd627674300e7fa02ae7e6bb6a579`;
- Triage: `TECHNICAL_PASS_REVIEW_REQUIRED`, 18/18 Entscheidungen formal
  bestanden;
- Effects: `REVISE` mit
  `PREPARED_MISSING_EVIDENCE_INCONSISTENT: prepared-target:ST-16:shading_system`;
- zwei erhaltene interne Modellversuche lieferten bei Temperatur null
  identisch `selectedCandidateIds: []`, `coverageEffect: EXCLUDED`;
- gleichzeitig existierten zwei gültige direkte Kandidaten: `Jalousien`
  (PDF-Seite 4, Dokumentoffset 9167–9176) und `Rollläden` (9181–9190);
- der nun korrekt isolierte Quelltext lautet sinngemäß `Jalousien und
Rollläden ... (nicht Sonnensegel und nicht Markisen)`. Die Negation betrifft
  nicht Jalousien und Rollläden;
- der fail-closed Validator verhinderte korrekt die Materialisierung des
  unbelegten Ausschlusses;
- `ST-21` wurde nach diesem Abbruch nicht mehr fachlich bewertet. Aus zwei
  gefundenen Solar-/Photovoltaik-Kandidaten darf daher noch kein neues
  Ergebnis abgeleitet werden.

Ein äußerer Wiederholungsversuch wurde als Operatorbeobachtung gesehen, ist
aber nicht als separates, hashbares Artefakt erhalten. Belastbar gespeichert
sind die zwei identischen internen Zielversuche. Der Lauf darf weder als
vollständige Laufzeit noch als Qualitätsbaseline verwendet werden.

## 16. Listen- und Objektklassifikations-Forward-Fixes

### Listenbegrenzung

Commits in Ausführungsreihenfolge:

- `5d295ec3`: mittlere Punkt-Bullets als echte Listenelemente;
- `13cf565a`: List-Governor ohne Geschwisterüberlauf;
- `ef46939d`: Scope-Trim nur für echte Bullets;
- `2ac7d41a`: Formatfix;
- `70ca7ad0`: verschachtelte, umbrochene und seitenübergreifende Listen;
- `3c6b8dea`: Listenkontext endet vor neuer Klausel;
- `59da7187`: rückwärts gelesene Listenabstammung endet an neuer Klausel;
- `db203389`: abschließende Formatierung.

Mac-Studio-Validierung für `db203389`: Node `22.23.2`, 74/74
Worksheet-Varianten bestanden, Prettier bestanden. Ein eigener vollständiger
Lauf für `70ca7ad0` wurde nicht wiederholt, weil die konkrete ST-16-Eingabe
gegenüber dem reproduzierbar abgebrochenen 2ac-Lauf unverändert blieb. Ein
weiterer 30-Minuten-Lauf hätte voraussichtlich denselben Abbruch, aber keinen
Paketvergleich erzeugt.

### Objektklassifikation

Zwei getrennte Verträge verhindern, dass Definition und Deckung vermischt
werden:

1. `CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1` transportiert eine
   syntaktisch und semantisch geprüfte Objektgruppenüberschrift mit exakten
   Offsets höchstens auf die unmittelbar folgende PDF-Seite. Eine neue
   Klausel, Coverage-Grenze, andere `das sind:`-Klassifikation oder ein neues
   gedrucktes Dokument setzt sie zurück.
2. `OBJECT_CLASSIFICATION_IS_NOT_GLOBAL_COVERAGE_V1` wählt ausschließlich
   reine `INSURED_OBJECT`-Kandidaten aus einer solchen Liste aus und gibt
   `DEFINED` zurück. Der Vertrag erzeugt weder `INCLUDED` noch `EXCLUDED`,
   keine Requested-Field-Freigabe und keinen Vorteil.

Commits:

- `07ee48e1`: versionierter Objektklassifikationskontext und Varianten;
- `ac6a1edf`: gebeugte Coverage-Überschriften wie „Versicherte Sachen“ sicher
  ausgeschlossen;
- `01bf9e7f`: neutrale Prepared-Evidenzentscheidung, Mischkandidaten bleiben
  modelloffen.

Mac-Studio-Nachweise:

- Kontextvertrag: 81/81 Varianten plus Prettier bestanden;
- kumulierte Entscheidungspfade: 234/234 Tests in Worksheet,
  Deterministic-Category, Prepared-Evidence und Requested-Field bestanden;
- erwartetes Real-Orakel für EABS/ST-16: beide exakten Kandidaten ausgewählt,
  `DEFINED`, kein Ausschluss;
- erwartetes Real-Orakel für EABS/ST-21: Objektdefinition bleibt neutral und
  darf keine Deckung oder Vorteilspromotion auslösen;
- jede darüber hinaus geänderte Paketzeile ist zunächst `REVISE`, bis ihr
  Atom-, Quellen-, Scope- und Rangdelta erklärt wurde.

## 17. Vollständiger Lauf der erweiterten Objektneutralität

Nach den ersten Objektklassifikationsverträgen wurden zwei zusätzliche
sprachliche Varianten und eine Prioritätsgrenze getrennt umgesetzt:

- `9a0f535f`: negative Zugehörigkeitsaussagen wie „Nicht als Betriebsinhalt
  gelten“ oder „Nicht als Gebäude zählen“ bleiben Objektklassifikation statt
  Versicherungsausschluss;
- `3fac56de`: der neutrale Objektvertrag hat Vorrang vor älteren
  VS-Sonderregeln, damit eine Definition nicht nachträglich wieder als
  Deckung ausgegeben wird;
- `f11b5572`: positive Gegenprobe, dass eine echte Klausel „Mitversichert
  sind ...“ weiterhin Deckung bleibt.

Fokussierte Mac-Studio-Validierung vor dem Vollauf:

```text
Commit: f11b55728386790c900c2c862f0687b1d20b959d
Checkout: /private/tmp/pv3-object-class-9a0f535f-A360UH/repo
Node: 22.23.2
Tests: 268/268 bestanden
Prettier: bestanden
```

Vollständiger Lauf:

```text
Run-Root:
/Users/michaelmischkot/Library/Application Support/
at.klincov.polizzenvergleich-v3/QA/
CANDIDATE-OBJECT-NEUTRALITY-F11B5572-20260901-220150

Commit: f11b55728386790c900c2c862f0687b1d20b959d
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42.496
Start: 2026-09-01T20:01:50Z
Ende: 2026-09-01T20:28:33Z
Wandzeit: 26:43
Inputmanifest SHA-256:
50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
Hard-Gate: PASS, 10 Dokumente, 50 Kategorien, 224 Paketzeilen
Strict V7: PASS
Run-Signatur:
62c494f7eb22eb784f7a570c996dcf0a35db93851101bb0541e3cf2b9c4dd1ba
JSON SHA-256:
5d34e5910f40c664821bd5475bf1ee6d32fa75e5c61721f3c96bcaf1ce123088
Markdown SHA-256:
9458c04fde0af00c919ad90f7f22009bf2065b1554c5eb79119aab6f3a2eece5
XLSX SHA-256:
a9c36c5fa3b75a912ad19bc9a337f5efac9ffee8d79a73a8a2c4e25f78d022be
```

Kundenmetriken:

```text
Vorteil A/B: 0 / 0
Dokumentationsunterschied: 38
Gleichwertig: 6
Kein dokumentierter Vorteil: 99
Nicht vergleichbar: 13
Unklar/Kundenprüfung: 68
Paketstatus-Blocker: 41
```

Exakter Vergleich zum unmittelbar vorherigen Vollauf `4edca52a`:

- unveränderte Anzahl Vorteile, Dokumentationsunterschiede,
  Nichtvergleichbarkeiten und beidseitige kontrollierte Nichtfunde;
- `FE-C02` wechselt von `GLEICHWERTIG` auf `UNKLAR`; damit sinkt
  `GLEICHWERTIG` von 7 auf 6 und die Kundenprüfung steigt von 67 auf 68;
- `VS-19` bleibt `UNKLAR`, der technische Grund wechselt aber von einem
  unvollständigen `ANY`-Fakt auf den transparenten Paketstatusblocker;
- keine weitere Paketentscheidung änderte sich.

Die Änderung von `FE-C02` ist kein Recallverlust. Die EABS-Fundstelle
beschreibt, welche Photovoltaikanlagen zu einer Objektklasse zählen. Sie ist
keine eigenständige Feuerdeckung. Die alte Gleichwertigkeit beruhte auf dem
falschen `INCLUDED`; der neue Zustand `DEFINED` entfernt diese unbelegte
Kundenaussage. Damit ist die höhere Reviewzahl fachlich ehrlicher als die
numerisch günstigere 67 des Vorgängers.

Atom- und XLSX-Abgrenzung:

- exakt 12 Atome änderten sich, ausschließlich im erwarteten EABS-Dokument
  `DOC-10-759b582e-bb83-40c0-9b2a-4b917f0c7e03`;
- die betroffenen Atome liegen in `VS-18`, `VS-19`, `FE-C02`, `ST-15`,
  `ST-16`, `ST-18`, `ST-19`, `ST-21`, `EL-16`, `EL-20` und `EL-23`;
- `ST-21` enthält nun die beiden echten Solar-/Photovoltaik-Definitionen als
  `DEFINED`, ohne daraus Deckung oder einen Vorteil zu erzeugen;
- der XLSX-Vergleich zu `4edca52a` behält ein Blatt, 225 Zeilen und 17
  Spalten; 13 Zellen in fünf Zeilen (`VS-18`, `VS-19`, `FE-C02`, `ST-21`,
  `EL-20`) änderten sich;
- keine Änderung außerhalb des kausal erwarteten EABS-Dokuments wurde
  gefunden.

Entscheidung: **GO als Korrektheitsbaseline**, aber nicht als numerisch
günstigerer Review-Favorit. Die bekannte falsche Gleichwertigkeit darf nicht
zurückkehren. Der folgende FE-A06-Kandidat wird deshalb gegen diesen Lauf und
zusätzlich gegen PBR-01.2/`4edca52a` verglichen.

## 18. FE-A06: einzelner Scope-Blocker wird atomar nicht vergleichbar

### 18.1 Fachlicher Vertrag und Sicherheitsgrenze

Der Kandidat wurde nicht über eine allgemeine Lockerung des Paketstatus
gelöst. Stattdessen wurde der versionierte Vertrag
`SOLE_SCOPE_REVIEW_BLOCKER_TO_ATOMIC_NONCOMPARABLE_V1` eingeführt. Er darf
ausschließlich `NICHT_VERGLEICHBAR` liefern; Vorteil, Gleichwertigkeit oder
ein ausdrücklicher Ausschluss können dadurch nicht entstehen.

Die Regel greift nur, wenn sämtliche folgenden Bedingungen gemeinsam erfüllt
sind:

- beide Seiten besitzen gefundene, relevante Evidenz ohne besonderes
  `comparisonTreatment`;
- die Paketstatus sind exakt `BELEGT` und `TEILBELEGT`;
- beide Seiten verwenden denselben Ein-Komponenten-`ALL`-Vertrag mit gleicher
  Komponentenrolle und gleichem Vertragsdigest;
- pro Seite existiert genau ein vollständiges gefundenes Atom; alle übrigen
  Atome und angeforderten Felder sind kontrolliert `NOT_FOUND`;
- Konflikt, Unresolved-Kandidat und Dokumentrangproblem fehlen;
- der gefundene Inhalt, seine Dokument-UUID, der Paketstatus und der
  beitragende Fakt sind exakt miteinander gebunden;
- beide Seiten verlangen `GENERAL_REQUIRED`, die ausgewählten Scopes sind
  aber exakt `GENERAL` gegen `NARROW_ONLY`;
- der einzige Paketblocker ist komponentengenau `SCOPE_INCOMPLETE`; ein
  optionales Bedingungssignal muss exakt denselben Fakt beschreiben;
- die normale Dimensionsprüfung bestätigt anschließend
  `COMPARABILITY_KEY_DIFFERS`.

Ein unvollständiger oder unbekannter Nullpfad, mehrere gefundene Atome, ein
zweiter Blocker oder eine abweichende Dokumentbindung führen weiterhin
fail-closed zu `UNKLAR`.

### 18.2 Getrennte Commits und fokussierte Mac-Studio-Validierung

Commits in Ausführungsreihenfolge:

- `a3e60008`: enger Vergleichsvertrag für einen alleinigen Scope-Blocker;
- `6d6518f6`: kontrollierte `NOT_FOUND`-Felder in den Vertrag einbeziehen;
- `0233b42d`: vollständigen Abwesenheitsvertrag der Felder validieren;
- `a36dcccd`: realen V7-Paketpfad des Scope-Falls prüfen;
- `ad88b00f`: Feld-, Null- und adversariale Gegenpfade schließen;
- `fa780902`: ausschließlich Formatierung des geprüften Vertrags.

Exakte abschließende Remote-Validierung:

```text
Commit: fa78090269a23e0f45223546fc9b57f10e78f843
Checkout: /private/tmp/pv3-fe-a06-fa780902-m9mku2/repo
Node: 22.23.2
Tests: 6 Suites, 85/85 bestanden
Prettier: bestanden
Git-Status des isolierten Checkouts: sauber
```

Die Tests decken den realen Ein-Fund-plus-acht-Nichtfunde-Paketpfad sowie
positive, negative, adversariale, Feld-, Audit-, Rang-, Konflikt- und
V7-Präsentationsvarianten ab. Eine unabhängige statische Abschlussprüfung
meldete keine P1- oder P2-Feststellung.

### 18.3 Vollständiger Mac-Studio-Lauf

```text
Run-Root:
/Users/michaelmischkot/Library/Application Support/
at.klincov.polizzenvergleich-v3/QA/
CANDIDATE-FE-A06-FA780902-20260901-223450

Commit: fa78090269a23e0f45223546fc9b57f10e78f843
Checkout: /private/tmp/pv3-fe-a06-fa780902-m9mku2/repo
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42.496
Erster Start: 2026-09-01T20:34:50Z
Erster Versuch: PRE_DOCUMENT_DEPENDENCY_ABORT
Validierter Neustart: 2026-09-01T20:35:38Z
Ende: 2026-09-01T21:02:25Z
Wandzeit des validierten Laufs: 26:47
Inputmanifest SHA-256:
50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
Hard-Gate: PASS, 10 Dokumente, 50 Kategorien, 224 Paketzeilen
Strict V7: PASS
Run-Signatur:
1b3bf66f63a19dd6d2328702ee1516df23a4c75bc7b0eed8547aafb74ffc6926
JSON SHA-256:
52ce41d2246203eabaa4c34814d3744d938b87cf11813ec707d889bece9d0ff4
Markdown SHA-256:
e19d18c05e39bad90ab149d1a46b37f4690b31e8fa88a22e5e97b59f59e1e4d0
XLSX SHA-256:
a276925b62baa721750642fcbfa84c271275cec2aa582d0017c43ea2a9b71c3b
```

Der erste Versuch erreichte keine Dokumentanalyse. Ursache war ausschließlich
eine fehlende auflösbare ESM-Abhängigkeit `pdf-parse` im frisch isolierten
Checkout. Nach Wiederherstellung der bereits verwendeten isolierten
Abhängigkeitsbindung startete der Lauf neu. Der abgebrochene Versuch wird
weder als Qualitätslauf noch als Laufzeitmessung verwendet; er veränderte den
installierten Kundencheckout nicht.

Kundenmetriken des validierten Laufs:

```text
Vorteil A/B: 0 / 0
Dokumentationsunterschied: 38
Gleichwertig: 6
Kein dokumentierter Vorteil: 99
Nicht vergleichbar: 14
Unklar/Kundenprüfung: 67
Paketstatus-Blocker: 40
```

### 18.4 Exakte Abgrenzung gegen die Favoritenläufe

Gegen den unmittelbaren Objektneutralitäts-Favoriten `f11b5572` änderte sich
im kundenrelevanten Ergebnis genau eine Zeile:

```text
FE-A06
vorher: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION /
         FAIL_CLOSED_V1 / Kundenprüfung=true
nachher: NICHT_VERGLEICHBAR / COMPARABILITY_GATE_FAILED /
         SOLE_SCOPE_REVIEW_BLOCKER_TO_ATOMIC_NONCOMPARABLE_V1 /
         Kundenprüfung=false
```

Die beiden Evidenzseiten selbst blieben `BELEGT` und `TEILBELEGT`. Neu ist
nicht mehr Evidenz, sondern die zulässige Aussage, dass das allgemeine
A-Limit `1 %` plus `EUR 10.000` nicht direkt mit dem nur für einen engeren
Scope belegten B-Limit `EUR 5.000` gereiht werden darf.

Kausale Kontrollen:

- alle zehn `document.private.json` sind bytegenau identisch zu `f11b5572`;
- alle 50 `worksheet.private.json` sind bytegenau identisch;
- alle zehn Einzel-`report.json` sind bytegenau identisch;
- das XLSX behält ein Blatt, 225 Zeilen und 17 Spalten;
- im XLSX änderte sich exakt eine Zelle: `Gesamtvergleich!Q15`, die
  Kundenerklärung für `FE-A06`;
- kein anderer Ergebniszustand, Reviewstatus oder Regelpfad änderte sich.

Eine zweite, unabhängige Read-only-Auswertung prüfte alle 224 Zeilen und 890
Dokumentartefakte pro Lauf. Neben den oben genannten fachlichen Dateien waren
auch Triage-Antworten, materialisierte Triage, Effects-Ziele, materialisierte
Effects, Quellenauswahl, angeforderte Felder, Ergebniszeilen und Ergebnistext
inhaltlich beziehungsweise bytegenau unverändert. Die 155 verbleibenden
Datei-Hashunterschiede betrafen ausschließlich Laufzeitmetriken, Zeitstempel,
Release-ID sowie Lauf- und temporäre Pfade. `packageA`, `packageB`, der
Legacy-Ausgang und der Legacy-Differenztext änderten sich in keiner der 224
Zeilen.

Die kumulierte kundenrelevante Zustandsprojektion unterscheidet sich vom
älteren `4edca52a` in genau drei Zeilen: `VS-19` besitzt einen transparenteren
Paketstatusgrund, `FE-C02` ist wegen der korrigierten Objektdefinition nicht
mehr fälschlich gleichwertig, und `FE-A06` ist nun nicht vergleichbar. Gegen
PBR-01.2 kommt als vierte technische Zustandsänderung der präzisere
`ST-16`-Reviewstatus hinzu. Keine dieser Änderungen erzeugt einen Vorteil.

### 18.5 Abschlussentscheidung über alle Kandidaten

**GO als neuer Korrektheits- und Review-Favorit.** Gegen `f11b5572` wurde ein
echter, eng begrenzter Reviewfall ohne Evidenz- oder Ergebnisdrift entschieden:
Kundenprüfung `68 -> 67`, Paketstatus-Blocker `41 -> 40`, nicht vergleichbar
`13 -> 14`. Die Wandzeit `26:47` liegt praktisch auf dem Niveau des direkten
Favoriten `26:43`.

Damit ist die in Abschnitt 14 untersuchte Kandidatenmenge vollständig
entschieden. Für `FE-A05`, `FE-D01`, `LW-26`, `LW-12`, `ST-17`, `ST-25` und
`ST-27` existiert ohne neue semantische Verträge beziehungsweise belastbare
Dokumentorakel kein sicherer Outcome-Fix. `ST-21` wurde bereits auf neutrale
Objektdefinition korrigiert, darf aber keinen Vorteil erzeugen. `FE-D05`
bleibt ein späterer Semantik- und Implikationsspike und darf nicht als bloße
Aliasergänzung umgesetzt werden.

Weitere Änderungen an diesen Kandidaten ohne neue fachliche Evidenz würden
die Sicherheitsgrenze lockern, aber kein aussagekräftigeres, belegtes Ergebnis
erzeugen. Deshalb endet diese Kandidatenserie hier mit einem kleinen echten
Gewinn und einer dokumentierten NO-GO-Grenze für jede übrige Variante.

## 19. Paket-first-Korrektur: Dokumentart ist kein Vergleichsblocker

### 19.1 Korrigierter fachlicher Auftrag

Paket A und Paket B werden durch die Upload-Zuordnung des Benutzers definiert.
Beide Seiten enthalten Gebäudeversicherungsunterlagen und dürfen beliebige
unterstützte Mischungen aus Angebot, Polizze, Vertrag, Zusatzpolizze,
Zusatzvertrag, Nachtrag, Rahmenvereinbarung und Bedingungen enthalten. Die
Dokumentart darf einen gefundenen Inhalt weder allein abwerten noch eine
Vergleichsentscheidung allein blockieren.

Damit werden die früheren Arbeitsinvarianten 1, 7 und 8 dieses historischen
Dokuments nur in folgendem Umfang ersetzt:

- aus der bloßen Dokumentklassifikation abgeleitete Stati sind
  Provenienzmetadaten;
- Dokumentidentität und Rohfakten bleiben vollständig erhalten;
- unterschiedliche Inhalte, Wirkungen, Werte, Bedingungen, Scopes, Varianten,
  Versionen, Widersprüche und Ersetzungen bleiben getrennt;
- unbekannte bloße Dokumentart darf nicht sperren; unbekannte Klauselwirkung,
  unbekannter Scope und inhaltlich belegte Optionalität bleiben fail-closed;
- Rohfakten werden niemals vereinigt oder überschrieben. Nur die abgeleitete
  Vergleichsdimension darf semantisch identische Beitragsfakten gruppieren;
  alle Dokument-UUIDs, Quellen und Rohstatus bleiben erhalten.

### 19.2 Fakten aus dem aktuellen Favoritenlauf

Geprüfte Quelle:

```text
Run: CANDIDATE-FE-A06-FA780902-20260901-223450
Commit: fa78090269a23e0f45223546fc9b57f10e78f843
Wandzeit: 26:47
Zeilen: 224
Kundenmetriken: A 0 / B 0 / Doku 38 / Gleich 6 / Null 99 /
               Nicht vergleichbar 14 / Unklar 67
```

Die drei auffälligen Mengen sind disjunkt als Ergebniszeilen. Sie dürfen nicht
ohne benannte Metrik und insbesondere nicht als Kundenreviewzahl addiert
werden; für eine ausdrücklich definierte Union ist ihre Summe zulässig:

1. **99 beidseitige Nulltreffer:** In allen 99 Zeilen wurden beide Pakete je
   Zeile unter demselben Requirement-Vertrag vollständig kontrolliert geprüft;
   auf keiner Seite wurde ein passender Fakt gefunden. Auf Vergleichsebene
   sollen diese Zeilen künftig `GLEICHWERTIG` heißen: beidseitig nicht
   enthalten oder nicht geregelt. Auf Faktenebene bleibt die Wirkung
   `UNKNOWN`; ein ausdrücklicher Ausschluss wird nicht behauptet.
2. **38 einseitige Dokumentationsunterschiede:** 19 besitzen nur auf A, 19 nur
   auf B einen Fund. Davon sind 17 im gespeicherten Artefakt als
   `evidenceFound=true`, `BELEGT`, `coverage=Ja` geführt; ihre fachliche
   Quellenrichtigkeit ist noch nicht unabhängig abgenommen. Zunächst sind nur
   9 reine `COVERAGE_ONLY`-Positionen mechanische Kandidaten: 7 auf A
   (`VS-13`, `VS-14`, `VS-16`, `ST-29`, `EL-25`, `EL-28`, `EL-29`) und 2 auf
   B (`FE-A09`, `ST-05`). Vier `COVERAGE_MIXED`-Fälle (`LW-01` bis `LW-04`)
   und vier `VALUE_TERM`-Fälle (`FE-F03`, `LW-31`, `ST-34`, `EL-01`)
   benötigen eigene Richtungsverträge. Die übrigen 21 bestehen aus 4
   vollständigen Ausschlüssen, 1 gemischten Fall und 16 Teilbelegen.
3. **67 unklare Zeilen:** 40 Paketstatus-Blocker, 9 beidseitig fehlende
   belastbare Evidenz, 7 einseitig fehlende Evidenz, 3 Rangfälle, 3
   unvollständige atomare Anforderungen, 3 fehlende Vergleichsregeln, 1
   unvollständige Alternative und 1 ungeklärter Bedingungs-/Ausnahmescope.
   Diese 67 sind die tatsächliche Kundenreviewmenge des Favoritenlaufs.

### 19.3 Versionierte Zielverträge

`PACKAGE_MEMBER_DOCUMENT_STATUS_METADATA_V1`:

- `ACTIVE`, `FRAMEWORK_TERMS` und `PROPOSED_ONLY` sind für die
  Vergleichsidentität semantisch passender Fakten gleichwertig;
- Rohstatus, Dokument-UUIDs, Quellen, Kandidaten und Auditpfade bleiben
  erhalten;
- Status-only-Beitragsfakten werden ausschließlich in der abgeleiteten
  Vergleichsdimension kanonisch und permutationsstabil gruppiert;
- Unterschiede in Wirkung, Wert, Scope, Bedingung, Ereignisvariante oder
  Feldinhalt bleiben getrennt;
- unbekannte Klauselwirkung oder unbekannter Scope bleibt ein Blocker; eine
  bloß unbekannte Dokumentart nicht.

`EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1`:

- beide Seiten besitzen qualifizierte Abwesenheit unter demselben
  versionierten Requirement- und Suchvertrag;
- alle Paketdokumente und Textseiten sind erfasst;
- keine Seite enthält einen gefundenen Fakt;
- Ergebnis ist `GLEICHWERTIG`, nicht zwei behauptete Ausschlüsse.

`COMPLETE_POSITIVE_POINT_OVER_CONTROLLED_ABSENCE_V1`:

- die Gegenseite besitzt qualifizierte Abwesenheit;
- der Zeilenvertrag ist `COVERAGE_ONLY`; Bedingungen, Werte und gemischte
  Anforderungen benötigen eigene Richtungsverträge;
- die Fundseite ist `BELEGT`, serverseitig `Ja`, quellengebunden,
  konfliktfrei und komponentenvollständig;
- bei `ALL` ist jede deklarierte Komponente erfüllt; bei `ANY` mindestens eine
  zulässige Alternative und alle tatsächlich gefundenen Komponenten sauber;
- keine Ausschlussrolle und keine Wirkung `EXCLUDED` oder `UNKNOWN`;
- bekannte Dokumentarten und -stati dürfen den Pfad nicht sperren;
- Teilbeleg, gemischte Wirkung, Konflikt oder unbekannte Geltung sperren.

### 19.4 Sicherheitsabhängigkeiten vor der Statusneutralität

Die Realquellen zeigen zwei Semantikgrenzen, die der bisherige Statusblocker
teilweise verdeckt. Vor einer Statusvereinigung müssen sie in den atomaren
Vergleichsschlüssel aufgenommen werden:

- Warte- und Karenzbedingungen gegenüber bedingungsloser Geltung;
- `bestimmungsgemäße Auslösung` gegenüber `bestimmungswidrigem Austritt` als
  unterschiedliche Ereignisvarianten.

Insbesondere darf `LW-13` nicht zu einem Vorteil werden: A beschreibt die
bestimmungsgemäße Auslösung als Ausschluss, B den bestimmungswidrigen Austritt
als Einschluss. Das ist keine identische Ereignisvariante. Ein bloßes Löschen
von `documentApplicability` aus dem Schlüssel wäre daher fachlich falsch.

### 19.5 Reihenfolge und Messvertrag

1. Semantikmarker implementieren, committen, fokussiert auf dem Mac Studio
   validieren und vollständigen Lauf ausführen.
2. Dokumentstatus-neutralen, provenienzerhaltenden Merge implementieren,
   committen und ebenso vollständig messen.
3. Beidseitige kontrollierte Abwesenheit implementieren und messen.
4. Vollständigen positiven `COVERAGE_ONLY`-Einseitenfund gegen kontrollierte
   Abwesenheit implementieren und messen.
5. Erst danach `COVERAGE_MIXED`, `VALUE_TERM` und die verbleibenden 21
   einseitigen Fälle jeweils über eigene Richtungsverträge typisieren.

Nach jedem Verhaltensthema werden gegen den unmittelbaren Favoriten und den
letzten guten Lauf mindestens protokolliert:

- exakter Commit, Remote-Checkout, Node-, Modell- und Konfigurationsvertrag;
- fokussierte und adversariale Tests;
- Start, Ende und Wandzeit des vollständigen Laufs;
- 224-Zeilen-Hard-Gate und Kundenmetriken;
- zeilenweises Delta mit Regel-ID und Kundenerklärung;
- Dokument-, Worksheet-, Report-, JSON-, Markdown- und XLSX-Hashes;
- jede unerwartete Änderung außerhalb der kausal erwarteten Zeilen.

Die aus dem gespeicherten Artefakt abgeleitete erste mechanische Projektion
nach beidseitiger Abwesenheitsgleichheit und ausschließlich den 9 reinen
`COVERAGE_ONLY`-Kandidaten lautet `A 7 / B 2 / Doku 29 / Gleich 105 / Null 0 /
Nicht vergleichbar 14 / Unklar 67`. Sie ist ausdrücklich keine Messung und
keine fachliche Quellenabnahme. Die 8 `COVERAGE_MIXED`-/`VALUE_TERM`-Fälle
werden erst nach eigenen Verträgen projiziert. Die
Dokumentstatus-Neutralität besitzt wegen der genannten
Semantikabhängigkeiten eine eigene, erst durch den frischen Lauf gültige
Delta-Matrix.

### 19.6 Messergebnis PAV8-01

Status: **GO als Sicherheitsinkrement, kein neuer Ergebnisfavorit**

Commit `30e5c3f7299f297f86f54b344f19814e70d9de4b` wurde im isolierten
Mac-Studio-Checkout `/private/tmp/pv3-pav8-01-30e5c3f7/repo` auf Node
`22.23.2` fokussiert und anschließend mit allen zehn Dokumenten geprüft.
Sechs Suites und 92/92 Tests sowie Prettier bestanden. Der vollständige Lauf
`PAV8-01-30E5C3F7-20260902-014244` verwendete
`qwen/qwen3.6-35b-a3b`, Kontext `42496`, lief von
`2026-09-01T23:43:41Z` bis `2026-09-02T00:10:37Z` und benötigte `26:56`.

Das 224-Zeilen-Hard-Gate und der V7-Strict-Gate bestanden. Die Kundenmetrik
blieb bei `0/0/38/6/99/14/67`; Kundenreview blieb exakt 67. Das ist für dieses
reine Schutzinkrement das erwartete Ergebnis und keine gescheiterte
Verbesserung.

Der vollständige Favoritenvergleich ergab:

- 10/10 Dokument-JSONs und 10/10 Einzelreports byteidentisch zu `fa780902`;
- 224/224 A-Paketobjekte, 224/224 B-Paketobjekte und alle Zeilen ohne die
  private Entscheidung JSON-identisch;
- 0 Änderungen bei Outcome, Reason-Code, Rule-ID oder Review-Flag;
- 0 Änderungen an den Mitgliedschaften der 67 Reviewgründe;
- 62 neue Auditfelder in 23 privaten Entscheidungen und 31 Dimensionen; 22
  Zeilen nur `UNSPECIFIED`, genau zwei gebundene nicht-neutrale Modi in
  `LW-13`;
- `LW-13` bleibt wegen verschiedener Ereignisvarianten nicht vergleichbar;
  die Erklärung unterscheidet nun A `bestimmungsgemäße Auslösung` von B
  `bestimmungswidrigem Austritt`;
- `EL-09` bleibt bis `PAV8-02` unverändert, weil dort weiterhin nur der
  Klassifikationsstatus den Vergleich trennt;
- nach Entfernung flüchtiger Laufmetadaten und neutraler
  `UNSPECIFIED`-Materialisierung existiert kein weiteres semantisches Delta.
  Im Markdown änderte sich exakt die `LW-13`-Zeile, im XLSX exakt
  `Gesamtvergleich!Q139`;
- von 890 geprüften Dokumentartefakten sind 735 byteidentisch. Die 155
  übrigen Hashdifferenzen sind vollständig durch Laufmetriken,
  Laufzeit-/Pfadangaben und Manifestmetadaten erklärt; nach Normalisierung
  sind auch sie inhaltlich identisch.

Damit ist belegt, dass PAV8-01 die vor PAV8-02 benötigte Schutzgrenze setzt,
ohne Suche, Extraktion oder bestehende Ergebnisse zu verschlechtern. Die
Laufzeitabweichung von +9 Sekunden gegenüber `26:47` beträgt rund 0,6 Prozent
und ist nicht als Performanceänderung zu werten.

```text
Run-Signatur: bb687dacee5c3ae09cdb575f4e13a6811c16ab97558d67dc601733e7682ecc0f
comparison JSON: fe303a95acc3edff5d9a7271110dbfa1214a77815bf54c76c425c1a16e51691d
comparison Markdown: 7a6be19708df20dcce8d82fc7b84eea60b307e52ef21d4a7abaab0fb78d2a277
XLSX: 8a6c6eb9631a99e5701787f592971dd051083d49d59dcab86cca6db0132d33bb
```

Der installierte Kundencheckout blieb auf `c7d3b16d...`; es erfolgte kein
Deployment. Nächster eigenständiger Fix ist `PAV8-02`.

### 19.7 Messergebnis PAV8-01b

Status: **GO als zusätzlicher Schutzvertrag, kein neuer Ergebnisfavorit**

Die Senior-/Junior-Gegenprüfung von PAV8-02 identifizierte vor der
Statusneutralität einen fehlenden Fail-closed-Vertrag für ausdrückliche
Deckungsoptionen. Er wurde bewusst als eigenes Inkrement
`c2e3a155060c04e63d6956c9f24ffb192a082586` umgesetzt. Positive Marker
(`optional`, `wahlweise`, `gegen Mehrprämie`, `auf Wunsch`, einschließbare
Bausteine und gesonderte Vereinbarung), markerlokale Negativkontrollen und
die Prüfung aller Rohatome vor jeder Deduplizierung sind damit Teil des
versionierten Vertrags `OPTIONALITY_GUARDED_TYPED_V1`.

Im isolierten Mac-Studio-Checkout
`/private/tmp/pv3-pav8-01b-c2e3a155/repo` bestanden 8 fokussierte Suites mit
121/121 Tests und Prettier. Der vollständige Lauf
`PAV8-01B-C2E3A155-20260902-024400` verwendete Node `22.23.2`,
`qwen/qwen3.6-35b-a3b`, Kontext `42496`, lief von
`2026-09-02T00:42:50Z` bis `2026-09-02T01:09:33Z` und benötigte `26:43`.

Der Strict-Gate bestand mit 224/224 Zeilen. Die Kundenmetrik ist exakt
unverändert `0/0/38/6/99/14/67`; Kundenreview bleibt 67. Zwei unabhängige
Delta-Auswertungen bestätigten 0 Änderungen an Outcome, Reason-Code,
Rule-ID, Review-Flag, Reviewgrundmitgliedschaften oder Paket-
Zusammenfassungen. Gegen PAV8-01 änderte sich nur der generische Grundtext
von `LW-22`, ohne dessen unklare Entscheidung zu verändern. Das entspricht
in der XLSX exakt `Gesamtvergleich!Q144`.

Wichtig für die Beweisgrenze: Der produktive Helper erkannte in den realen
`FOUND`-Atomen dieses Fünferpakets keinen Optionalitätsmarker. Der Vollrun
belegt damit die Regressionsfreiheit, aber nicht die positive Wirkung an
einem echten optionalen Kundenbeleg. Diese Wirkung ist derzeit durch die
fokussierten positiven, negativen, adversarialen und permutationsstabilen
Vertragstests belegt.

Von 890 Dokumentartefakten sind 725 byteidentisch. Alle 165 Unterschiede
sind auf Laufzeitmetriken, Laufpfade, Zeitstempel oder die erwartete neue
Profil-/Vertragsversion begrenzt. Die fachlich kritischen Worksheets,
Triagen, Effects, Quellenauswahlen, Ergebniszeilen und Feldextraktionen sind
vollständig byteidentisch. Eine bekannte nichtfatale PDF-Warnung trat einmal
auf. Der installierte Kundencheckout blieb auf `c7d3b16d...`; kein
Deployment.

```text
Run-Signatur: 6935a154d89af5276aaa744de1097693a9a822a559adf4e7000fa37fd8748828
comparison JSON: 22867def8512b46fc793bfdc8d51ba0915397da21546716021d9ce20ab37b251
comparison Markdown: 92438cc2d55972f1182a6d24d3df91b0bb8ecd64b30f892edb244757445cf289
XLSX: ab11e6868622b4a265a9dd069c8a638c0827d48300a0d2f914e4447bfa675fc7
```

Nächster eigenständiger Verhaltensfix bleibt `PAV8-02`. Er darf nur die
abgeleitete beidseitige Vergleichsdimension statusneutralisieren; Rohfakten,
Abwesenheitspfad, Bedingungen, Optionalität, Konflikte, Scope, Werte,
Ereignisvarianten und Contributor-Provenienz bleiben fail-closed.

### 19.8 Messergebnis PAV8-02

Status: **GO als notwendiger Paket-first-Unterbau, NO-GO als neuer
Ergebnisfavorit**

Commit `52f0c497086b467869691be0acfefa393535ca16` behandelt die aus der
Dokumentklassifikation abgeleiteten Stati ausschließlich in der abgeleiteten
Vergleichsdimension als Paketmetadatum. Die Rohfakten bleiben unverändert und
behalten Dokument-UUID, Quelle, Offsets, Rohstatus, Geltung und vollständige
Contributor-Provenienz. Eine Kanonisierung ist nur für gefundene, beidseitig
`BELEGT` geführte Fakten mit semantisch identischen Werten, Rollen, Wirkungen,
Scopes, Varianten, Bedingungen sowie angeforderten und optionalen Feldern
zulässig. Abwesenheit, Teilbeleg, Konflikt, Rangproblem, unterschiedliche
Werte, echte Optionalität und Bedingung bleiben fail-closed.

Fokussierte Validierung im isolierten Mac-Studio-Checkout
`/private/tmp/pv3-pav8-02-52f0c497-IbPiZn/repo`:

- Node `22.23.2`, Prettier bestanden;
- 8 Suites und 145/145 Tests bestanden;
- positive, negative, adversariale und permutationsstabile Statusvarianten;
- vollständige Rohprovenienz und Audit V2;
- Scope-, Wert-, Limit-, Selbstbehalt-, Bedingungs-, Optionalitäts-,
  Abwesenheits- und Paketreview-Gegenpfade;
- Schema-8-, Profil-, Presenter-, Metrik- und Shell-Runner-Verträge.

Vollständiger Zehn-Dokument-Lauf:

```text
Run: PAV8-02-52F0C497-20260902-035452
Commit: 52f0c497086b467869691be0acfefa393535ca16
Checkout: /private/tmp/pv3-pav8-02-52f0c497-IbPiZn/repo
Node: 22.23.2
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Start UTC: 2026-09-02T01:54:52Z
Dokumentanalyse abgeschlossen: 2026-09-02T02:21:39Z
Paketartefakt abgeschlossen: 2026-09-02T02:21:51Z
Wandzeit bis vollständigem Paketartefakt: 26:59
Dokumente: 10/10, jeweils 224/224
Paketzeilen: 224/224
Kundenmetriken: A 0 / B 0 / Doku 38 / Gleich 10 / Null 99 /
               Nicht vergleichbar 8 / Unklar 69
Kundenreview: 69; ohne Kundenreview: 155
Schema: 8
Profil: CUSTOMER_CORE_5_V8_STATUS_METADATA
Vertrag: PACKAGE_FIRST_STATUS_METADATA_TYPED_V1
```

Der Runner hatte den leeren Zielordner `PACKAGE-COMPARISON` vor der
deterministischen Materialisierung angelegt. Deshalb stoppte ausschließlich
der erste Exportversuch mit `OUTPUT_ALREADY_EXISTS`, nachdem bereits alle zehn
Dokumente vollständig analysiert waren. Der nachweislich leere Ordner wurde
mit `rmdir` entfernt und nur die deterministische Paketmaterialisierung erneut
ausgeführt. Kein Dokument und kein Modellaufruf wurde wiederholt.

Exaktes Delta gegen PAV8-01b und den Favoriten:

- Kundenmetrik `0/0/38/6/99/14/67 -> 0/0/38/10/99/8/69`;
- vier echte Statusblocker-Auflösungen zu `GLEICHWERTIG`: `LW-05`, `LW-06`,
  `EL-10`, `EL-13`;
- `VS-29` wird von `UNKLAR` zu eindeutig `NICHT_VERGLEICHBAR`, weil die
  getrennte Prüfung optionaler Felder den unvollständigen Feldpfad nicht mehr
  fälschlich vor die Inhaltsdifferenz stellt;
- `VS-08` und `VS-10` werden nach Entfernung des Statushindernisses korrekt
  `UNKLAR`, weil für die verbleibenden Dimensionen keine freigegebene
  Vergleichsregel existiert;
- `VS-20` und `EL-09` werden korrekt `UNKLAR`, weil nun die zuvor vom
  Statusblocker verdeckte Bedingungssemantik sichtbar wird; `EL-09` enthält
  ausdrücklich eine Karenzfrist von 21 Tagen und darf nicht gleichwertig
  werden;
- `FE-A07` bleibt `UNKLAR`; nur der Grund wird präziser von einer fehlenden
  allgemeinen Regel auf Bedingungs-/Ausnahmescope eingegrenzt;
- Kundenreview schaltet für `VS-08`, `VS-10`, `VS-20`, `EL-09` ein und für
  `VS-29`, `LW-05` aus; netto `67 -> 69`;
- alle 40 `PACKAGE_REVIEW_STATUS_BLOCKS_DECISION`, alle 99 beidseitig
  qualifizierten Nulltreffer und alle 38 Dokumentationsunterschiede behalten
  exakt ihre Zeilenmitgliedschaften;
- `LW-13` sowie `VS-09`, `VS-11`, `VS-28`, `VS-34`, `FE-A06` und `EL-07`
  bleiben wegen Ereignisvariante, Wert, Scope oder Inhalt geschützt
  `NICHT_VERGLEICHBAR`;
- 224/224 Paket-A- und 224/224 Paket-B-Zusammenfassungen sind bytegenau
  unverändert;
- 65 private Entscheidungen ändern sich erwartbar durch Audit V2,
  Kanonisierung und Contributor-Provenienz; genau 10 Entscheidungssignaturen
  und 20 Kundentexte ändern sich gegen PAV8-01b;
- in der XLSX ändern sich ausschließlich 20 Zellen der KI-Ergebnisspalte:
  `Q5`, `Q6`, `Q7`, `Q11`, `Q32`, `Q67`, `Q75`, `Q78`, `Q86`, `Q89`,
  `Q109`, `Q134`, `Q139`, `Q160`, `Q171`, `Q173`, `Q189`, `Q214`, `Q219`,
  `Q220`; gegen den älteren Favoriten zusätzlich die bereits bekannte
  PAV8-01b-Änderung `Q144`.

Der unabhängige Dokumentartefakt-Audit bestätigt keine Modell-, Such-,
Extraktions- oder Evidenzdrift:

- 890/890 gemeinsame Dokumentartefakte, davon 725 byteidentisch;
- 10/10 `document.private.json` byteidentisch;
- je 50/50 Worksheets, materialisierte und validierte Triagen,
  Wirkungsartefakte, Ziel- und Quellenauswahlen, Ergebniszeilen und
  Feldextraktionen byteidentisch;
- die 165 übrigen Unterschiede bestehen ausschließlich aus 45
  Laufzeitmetriken, 100 Laufzeit-/Pfadangaben, 10 erwarteten Profilreports und
  10 Manifest-Provenienzen;
- 329 gefundene Rohatome besitzen 251-mal
  `FRAMEWORK_TERMS/CONDITIONAL` und 78-mal `PROPOSAL/PROPOSED_ONLY`; es gibt
  0 Status-/Geltungs-Mismatches, und alle Rohstatus und Quellen bleiben in den
  Contributors erhalten.

Artefakte:

```text
Inputmanifest: 50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
Run-Signatur: c9edceeb43bb0395dfcd6d404497eb2a2347b3b742de3d43147656755b6e2368
package-contract: cc2a59913eaa27a867c7556e54250257eaec95af368b6f8f9780a93f03edaf55
package-report: 3d0e33d6ff4b64e95e8b81131391954333c3d6c99600f5c620c164c746b21e78
comparison JSON: 050adbfa9315fd3ac9174500a5267e1bac4d564686a0136f4a49e4db632adc58
comparison Markdown: 65de0d5c33376dca439311f8ba9e540619ffb5b89768bcda3cd9c30cce3d5950
XLSX: 87741c94e238afc918338efd7e00b54260475be73d4d39c3a4796df4e6eb1560
```

Die Wandzeit liegt 16 Sekunden über PAV8-01b und 12 Sekunden über dem
Favoriten; das ist kein belastbarer Performanceunterschied. Der operative
Runner schrieb bei diesem Lauf versehentlich kein dauerhaftes
`full-run.private.log`. Ergebnisartefakte, Manifeste, Hashes und
Vollständigkeitsgates sind vorhanden und geprüft; der vollständige
Konsolenwarnungsstrom ist jedoch nicht nachträglich als Datei auditierbar.
Diese Log-Lücke betrifft die Nachvollziehbarkeit des Operators, nicht die
Ergebnisberechnung, und muss beim nächsten Vollrun geschlossen werden.

Der installierte Kundencheckout blieb sauber und unverändert auf
`c7d3b16d400ea4d65b558ef091781da5df82d610`. Es erfolgte kein Deployment.
PAV8-02 bleibt als notwendige Architekturgrundlage erhalten, wird wegen
`Review 67 -> 69` aber nicht zum neuen Ergebnisfavoriten erklärt. Die
fehlenden Richtungsverträge für `VS-08`, `VS-10`, `VS-20` und `EL-09` dürfen
nicht durch Rückkehr zum falschen Dokumentstatusblocker verdeckt werden.

## 20. PAV8-03a – beidseitig vollständig kontrollierter Nichtfund

### 20.1 Fehlerbild und fachliche Grenze

PAV8-02 enthielt 99 Zeilen mit dem Kundenergebnis
`KEIN_DOKUMENTIERTER_VORTEIL`. Die Rohdaten dieser 99 Zeilen zeigten jedoch
nicht 99 offene oder unvollständig geprüfte Fälle. Für beide hochgeladenen
Polizzenpositionen waren sämtliche zum jeweiligen Katalogpunkt gehörenden
Dokumente und Komponenten unter demselben versionierten Suchvertrag
vollständig kontrolliert worden, ohne dass eine passende Vertragsregelung
gefunden wurde.

Der Fehler lag damit in der letzten Vergleichsabbildung: Die bereits
feststehende Gleichheit des dokumentierten Suchzustands wurde nicht als
Punktvergleich ausgegeben. PAV8-03a behebt ausschließlich diesen Fall.

Die neue Aussage ist eng begrenzt:

- `GLEICHWERTIG` bedeutet hier: Beide Polizzen besitzen für diesen
  Vergleichspunkt dieselbe vollständig kontrollierte dokumentierte Fundlage.
- Sie bedeutet nicht, dass beide Polizzen eine positive Deckung enthalten.
- Sie bedeutet nicht, dass ein ausdrücklicher Ausschluss nachgewiesen ist.
- Sie bedeutet nicht, dass außerhalb der bereitgestellten Dokumente keine
  weitere Regelung existieren kann.
- Ein einseitiger Fund, ein Teilfund, ein Rangproblem, eine Bedingung, ein
  Konflikt oder ein unvollständiger Suchlauf bleibt von diesem Vertrag
  ausgeschlossen.

### 20.2 Wiederverwendbarer Vertrag und Codeabhängigkeiten

Verhaltenscommit:
`9564bcb77b368c684182111d83215167bec96661`
(`fix(comparison): equalize qualified bilateral absence`).

Der neue allgemeine Vertrag ist nicht an LF, WEVIG, einen Versicherer, eine
Seite oder eine konkrete Kundenformulierung gebunden:

- `server/utils/policyComparison/bilateralAbsenceContract.js`
  baut und validiert den Auditvertrag
  `BILATERAL_QUALIFIED_ABSENCE_AUDIT_V1`;
- `server/utils/policyComparison/pointDecision.js` verwendet die Regel
  `EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1` erst nach erfolgreicher
  Vertragsbildung;
- `server/utils/policyComparison/resultBuilder.js` liefert dafür die
  dokument- und komponentengenaue Suchprovenienz;
- `server/utils/policyComparison/customerMetricContract.js` berechnet den
  erwarteten Audit unabhängig aus den Paketdaten neu und erzwingt die
  Entscheidung in beide Richtungen: Ein qualifizierter Fall darf weder
  ausgelassen noch ohne Qualifikation behauptet werden;
- `server/utils/policyComparison/customerResultPresenter.js` lässt die neue
  Regel kundenseitig zu, ohne technische IDs als Ergebnistext auszugeben;
- `server/utils/policyComparison/productContract.js` und
  `server/utils/policyComparison/resultBuilder.js` versionieren das Ergebnis
  als Schema 9, Profil
  `CUSTOMER_CORE_5_V9_BILATERAL_ABSENCE_EQUALITY` und Vergleichsvertrag
  `PACKAGE_FIRST_BILATERAL_ABSENCE_EQUALITY_V1`.

Eine Seite qualifiziert nur, wenn alle folgenden Bindungen gleichzeitig
belegt sind:

1. Die Paketzusammenfassung enthält keinen Fund und keine übernommenen
   Fakten.
2. Der Suchstatus ist vollständig und ausschließlich
   `CONTROLLED_NOT_FOUND` oder vollständig
   `VERIFIED_NOT_FOUND`; Mischzustände werden abgelehnt.
3. Die Vergleichsbehandlung ist auf beiden Seiten identisch und passt zum
   Suchstatus.
4. Der Anforderungsvertrag besitzt denselben Digest, dieselben Komponenten,
   Rollen sowie dieselbe `ALL`- oder `ANY`-Semantik.
5. Jedes bereitgestellte Dokument der betreffenden Polizzenseite kommt genau
   einmal je erforderlicher Komponente vor; fehlende oder zusätzliche
   Dokument-UUIDs sperren die Regel.
6. Katalog-, Kategorie-, Komponenten- und Suchplan-ID sind kanonisch
   gebunden.
7. Seitenzahl, geprüfte physische Seiten, Kandidaten-, Triage-, Wirkungs- und
   Feldprüfgates sind vollständig.
8. Die Rohatome enthalten keine ausgewählten oder ungelösten Kandidaten,
   Quellen, Konflikte oder positive Wirkungen.
9. Angeforderte und optionale Felder sind vollständig an den
   Anforderungsvertrag gebunden; der materialisierte saubere
   `NOT_EVALUATED`-Nullpfad bleibt nur erlaubt, wenn alle Atomfelder
   tatsächlich `NOT_FOUND` sind.
10. Der Audit wird kanonisch und reihenfolgeunabhängig gehasht und im
    Kundenvalidator bytegenau gegen eine Neuberechnung geprüft.

Damit können weder ein unvollständiges `ANY`, ein fehlendes Dokument, eine
falsche Plan-ID, ein Teilbeleg noch ein manipuliertes Audit als Gleichheit
durchrutschen.

### 20.3 Prüfungen vor dem Vollrun

Isolierter Mac-Studio-Checkout:
`/private/tmp/pv3-pav8-03a-9564bcb7-Ty1KwF/repo`, exakt auf Commit
`9564bcb77b368c684182111d83215167bec96661`.

- Prettier: bestanden;
- 9 fokussierte Suites: bestanden;
- 167/167 Tests: bestanden;
- positive kontrollierte und zertifizierte Nichtfundvarianten: bestanden;
- gemischte kontrollierte/zertifizierte Zustände: korrekt abgelehnt;
- vollständige `ANY`-Alternativen: bestanden;
- fehlende `ANY`-Alternative: korrekt abgelehnt;
- fehlende oder zusätzliche Dokumente, Plan-, Digest-, Komponenten-,
  Feld-, Kandidaten-, Scope- und Audit-Manipulationen: fail-closed;
- Reihenfolgevarianten über mehrere Dokumente: stabil.

Ein deterministischer In-Memory-Replay von `buildComparisonResult()` auf den
unveränderten PAV8-02-Dokumentartefakten ergab vor dem Modelllauf:

```text
Zeilen: 224
Erwartete Metrik: 0/0/38/109/0/8/69
Geänderte Punktentscheidungen: 99
Davon unerwartet: 0
Rohzeilen geändert: 0
Review: 69 -> 69, identische Zeilenmitgliedschaft
Paket-A/B-Zusammenfassungen geändert: 0
Technische Altentscheidungen geändert: 0
```

### 20.4 Vollständiger Mac-Studio-Lauf

Der erste Operatorstart
`PAV8-03A-9564BCB7-20260902-045311` stoppte vor dem ersten Modellaufruf, weil
das wiederverwendete Inputmanifest relative Uploadpfade enthält und der
isolierte Checkout zunächst keine absolute Speicherbasis ergänzte. Der
Abbruch ist im Operatorprotokoll als
`preflight_before_model_call` dokumentiert. Es wurden keine
Dokumentergebnisse erzeugt und kein Kundencheckout verändert.

Nach read-only Prüfung aller zehn absoluten Quelldateien und SHA-256-Werte
lief der getrennte vollständige Run:

```text
Run: PAV8-03A-9564BCB7-20260902-045443
Commit: 9564bcb77b368c684182111d83215167bec96661
Checkout: /private/tmp/pv3-pav8-03a-9564bcb7-Ty1KwF/repo
Node: 22.23.2
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Start UTC: 2026-09-02T02:54:43Z
Abschluss UTC: 2026-09-02T03:21:35Z
Wandzeit: 26:52
Dokumente: 10/10, jeweils 224/224 Zeilen
Paket: 224/224 Zeilen
Schema: 9
Profil: CUSTOMER_CORE_5_V9_BILATERAL_ABSENCE_EQUALITY
Vertrag: PACKAGE_FIRST_BILATERAL_ABSENCE_EQUALITY_V1
Kundenmetrik: A 0 / B 0 / Doku 38 / Gleich 109 / Null 0 /
              Nicht vergleichbar 8 / Unklar 69
Kundenreview: 69; ohne Kundenreview: 155
```

Die Wandzeit ist sieben Sekunden kürzer als PAV8-02 (`26:59`) und fünf
Sekunden länger als der historische Favorit (`26:47`). Das ist kein
belastbarer Performanceunterschied.

### 20.5 Exaktes Delta

Gegen PAV8-02:

- exakt 99 Outcomes ändern sich von `KEIN_DOKUMENTIERTER_VORTEIL` zu
  `GLEICHWERTIG`;
- alle 99 und nur diese 99 Entscheidungen tragen Regel, Grund, Behandlung
  und Audit des neuen Vertrags;
- `VORTEIL_A`, `VORTEIL_B`, `DOKUMENTATIONSUNTERSCHIED`,
  `NICHT_VERGLEICHBAR` und `UNKLAR` behalten exakt ihre
  Zeilenmitgliedschaften;
- Kundenreview bleibt exakt 69 mit identischer Zeilenmitgliedschaft;
- 224/224 Paket-A- und 224/224 Paket-B-Zusammenfassungen bleiben
  byteidentisch;
- außerhalb der Punktentscheidung ändern sich 0/224 Vergleichszeilen;
- technische Altentscheidungen ändern sich 0-mal;
- die XLSX ändert genau 99 Zellwerte und ausschließlich in Spalte Q; Höhe,
  Breite und alle anderen Zellwerte bleiben unverändert.

Gegen den historischen Favoriten ändert sich die Metrik von
`0/0/38/6/99/14/67` auf `0/0/38/109/0/8/69`. Davon stammen 99 Änderungen
aus PAV8-03a und die übrigen fachlichen Änderungen aus PAV8-01b/PAV8-02.
In der XLSX unterscheiden sich 120 Zellwerte, weiterhin ausschließlich in
Spalte Q.

Der vollständige Dokumentartefakt-Audit gegen PAV8-02 bestätigt:

- 890/890 gemeinsame Dokumentartefakte;
- 725 byteidentisch;
- 410/410 fachlich relevante Extraktions-, Worksheet-, Triage-, Wirkungs-,
  Quellen-, Ergebniszeilen- und Feldartefakte byteidentisch;
- 0 fachliche Dokumentartefaktdifferenzen;
- die 165 übrigen Deltas bestehen erneut ausschließlich aus 45
  Laufantwort-/Zeitdateien, 100 Laufreports, 10 Manifest-Provenienzen und 10
  Dokumentreports.

Damit ist belegt, dass die neue Kennzahl nicht durch neue Modellantworten,
andere Evidenz oder veränderte Suche entstand, sondern ausschließlich durch
die neue, versionierte Paketvergleichsregel.

### 20.6 Artefakte, Entscheidung und Restgrenze

```text
Inputmanifest: 50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
Run-Signatur: 7f9f92d2c69bf371a77505f5585f2bf046a86f717fc4f714341e483a394f7215
full-run.log: 900d82b41fa7e2eff07c8a340df93cc5e5932cf060b443c9f7d637e12dd32ce8
package-contract: 6a63de2ca390e129b2c59d843103468b93c849c26037cac883d11575895c85f2
package-report: a8e02e60f984e037d2eade191a21d548b5053bc1f0aadff3388a3a07d3eab745
comparison JSON: 91eec292a8e7835797707e2fb2171c4c5603d9a94cc2d0573a9c153ca21e1c18
comparison Markdown: d617b89c285c9aa94685bb6618b01115d0f09415ec02e6f9d55b2b642bc25d62
XLSX: d317bf137c3b2397d3f002156b9118ffc62439e07083453d55115c0cd67b9715
```

PAV8-03a ist **GO** und ersetzt PAV8-02 als aktuelle technische
Vergleichsbasis, weil es dessen vollständige Rohdaten und Reviewmenge
unverändert lässt, aber den 99-Zeilen-Nullbucket durch ein ehrliches
Vergleichsergebnis ersetzt. Es ist noch kein finales Kundenergebnis:

- Die aggregierten 109 Gleichwertigkeiten müssen in jeder Auswertung als
  `99 x gleiche dokumentierte Fundlage nach vollständigem beidseitigem
Nichtfund` und `10 x positiv beziehungsweise inhaltlich belegte
Gleichwertigkeit` getrennt ausgewiesen werden. Sie dürfen nie pauschal als
  109 identische Deckungen bezeichnet werden.
- `VORTEIL_A` und `VORTEIL_B` bleiben 0, weil der nächste eigenständige
  Richtungsvertrag für einseitig belegte Inhalte noch nicht umgesetzt ist;
- 69 Zeilen bleiben reviewpflichtig und müssen grundweise in getrennten
  kleinen Fixes bearbeitet werden;
- die neue Gleichheit darf nicht als positive Deckungsgleichheit oder
  Ausschlussnachweis gelesen werden;
- der installierte Kundencheckout blieb sauber und unverändert auf
  `c7d3b16d400ea4d65b558ef091781da5df82d610`; kein Deployment.

Nächster eigenständiger Verhaltensfix ist die sichere Richtungsentscheidung
für die 38 einseitig dokumentierten Punkte. Er darf nur nach einem eigenen
versionierten Vertrag, adversarialen Kontrollen, Commit und vollständigem
Mac-Studio-Lauf erfolgen.
