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

| Ergebnis | Zeilen |
| --- | ---: |
| Vorteil A | 0 |
| Vorteil B | 0 |
| Dokumentationsunterschied | 38 |
| Gleichwertig | 7 |
| Kein dokumentierter Vorteil | 99 |
| Nicht vergleichbar | 13 |
| Unklar | 67 |
| **Gesamt** | **224** |

Nur die 67 Zeilen mit `pointDecision.outcome == UNKLAR` sind
Kundenreviewzeilen. Die frühere Zahl 105 war ein historischer technischer
Differenzzähler und darf nicht mehr als Reviewzahl verwendet werden.

Die 67 Reviewzeilen besitzen folgende persistierte, disjunkte Reason-Gruppen:

| Gespeicherter Reasoncode | Zeilen | Bearbeitungsstatus |
| --- | ---: | --- |
| `PACKAGE_REVIEW_STATUS_BLOCKS_DECISION` | 39 | in diesem Dokument vollständig erstanalysiert |
| `MISSING_BOTH` | 9 | noch einzeln zu analysieren |
| `MISSING_ONE_SIDE` | 7 | noch einzeln zu analysieren |
| `ATOMIC_DOCUMENT_RANK_UNRESOLVED` | 3 | noch einzeln zu analysieren |
| `ATOMIC_EVIDENCE_INCOMPLETE` | 3 | noch einzeln zu analysieren |
| `NO_APPROVED_RULE_FOR_ALL_DIMENSIONS` | 3 | noch einzeln zu analysieren |
| `ANY_COMPONENT_EVIDENCE_INCOMPLETE` | 2 | noch einzeln zu analysieren |
| `CONDITIONAL_OR_EXCEPTION_SCOPE` | 1 | noch einzeln zu analysieren |
| **Gesamt** | **67** | |

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

| Paket A / Paket B | Zeilen |
| --- | ---: |
| `BELEGT / TEILBELEGT` | 22 |
| `TEILBELEGT / TEILBELEGT` | 14 |
| `TEILBELEGT / BELEGT` | 1 |
| `BELEGT / RANGFOLGE_PRÜFEN` | 2 |
| **Gesamt** | **39** |

Kategorieverteilung:

| Kategorie | Zeilen |
| --- | ---: |
| VS | 8 |
| FE | 7 |
| LW | 7 |
| ST | 8 |
| EL | 9 |
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

| Verantwortung | Datei / Bereich am Anlagestand |
| --- | --- |
| atomare Judgements zu Requirement-Rollups | `server/utils/policyAnalysis/preparedEvidenceContract.js:647-715`, `materializePreparedEvidence` |
| Dokumentstatus aus Vollständigkeit, Wert, Scope und Wirkung | `server/utils/policyAnalysis/categoryTableRenderer.js:365-386`, `reviewFor` |
| Tabellenzeilen aus Dokumentrollup | `server/utils/policyAnalysis/categoryTableRenderer.js:404-590`, `buildCategoryTableRows` |
| Paketstatus aus allen beitragenden Dokumentzeilen | `server/utils/policyComparison/resultBuilder.js:271-388`, `summarizePackage` |
| Atome aus Worksheet, Wirkung, Feldern und Quellen | `server/utils/policyComparison/resultBuilder.js:615-715`, `materializeAtomicFacts` |
| Paketmaterialisierung und Aufruf der Punktentscheidung | `server/utils/policyComparison/resultBuilder.js:838-939`, `buildComparisonResult` |
| Vollständigkeit eines Entscheidungsatoms | `server/utils/policyComparison/pointDecision.js:117-169`, `validSource`, `completeAtom` |
| gegenwärtiger Paketstatus-Frühabbruch | `server/utils/policyComparison/pointDecision.js:623-627`, `decidePoint` |
| nachgelagerte Komponenten-/Atomgates | `server/utils/policyComparison/pointDecision.js:629-707`, `decidePoint` |
| Outcome-, Review- und Reason-Mitgliedschaften erzeugen | `server/utils/policyComparison/customerMetricContract.js:25-73`, `deriveCustomerMetrics` |
| gespeicherte Kundenmetriken unabhängig validieren | `server/utils/policyComparison/customerMetricContract.js:140-273`, `validateCustomerComparison` |
| XLSX-Kundentext für ungeklärte Gründe | `server/utils/policyComparison/customerResultPresenter.js:3-24,68-113` |
| UI-Nachzählung und Reason-Labels | `frontend/src/utils/chat/policyComparisonResultPresenter.cjs:3-25,53-119` |
| grober bestehender Point-Decision-Testvertrag | `server/__tests__/utils/policyComparisonPointDecision.test.js:214-230` |
| Paket-/Atom-/Totals-Integrationstests | `server/__tests__/utils/policyComparisonResultBuilder.test.js` |
| Metrik-Manipulations- und Paritätstests | `server/__tests__/utils/policyComparisonCustomerMetricContract.test.js` |
| XLSX-Presenter-Vertrag | `server/__tests__/utils/policyComparisonCustomerResultPresenter.test.js` |
| unabhängiger Frontend-Presenter-Vertrag | `server/__tests__/frontend/policyComparisonResultPresenter.test.js` |
| Worker-Lifecycle-Vertrag | `server/__tests__/scripts/qa/policyComparisonWorkerContract.test.js` |

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

Vorgeschlagene versionierte Blockercodes:

```text
MISSING_REQUIRED_COMPONENT
UNKNOWN_COVERAGE_EFFECT
FIELD_INCOMPLETE
SCOPE_INCOMPLETE
PROPOSED_ONLY
CONDITIONAL_APPLICABILITY
SOURCE_BINDING_INCOMPLETE
UNRESOLVED_CANDIDATE
MULTIPLE_ATOMS_SAME_COMPONENT
UNRESOLVED_DOCUMENT_PRECEDENCE
CONFLICTING_COVERAGE
REQUIREMENT_CONTRACT_MISMATCH
```

Wichtig: `PROPOSED_ONLY` ist zunächst ein auditierbares Geltungssignal, nicht
automatisch der primäre Blocker.

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
Status: noch nicht gestartet
Fix-Commit: offen
Erwartung: identische 224 Kundenentscheidungen; zusätzliche private,
           komponentenbezogene Blockerdiagnose für 39/39 Zeilen
```

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

## 13. Aktueller nächster Schritt

```text
PBR-01.1 implementieren:
typisierte private Blockerdiagnose aus bereits vorhandenen Atomen,
ohne Paketstatus, Outcome oder Kundentabelle zu lockern.
```

Danach:

```text
eigener Commit
-> exakter isolierter Mac-Studio-Checkout
-> vollständiger V7-Lauf
-> Vergleich mit allen bestätigten Favoriten-/Baseline-Reports
-> Protokollierung in Abschnitt 10
-> Entscheidung über PBR-01.2 oder Revert
```
