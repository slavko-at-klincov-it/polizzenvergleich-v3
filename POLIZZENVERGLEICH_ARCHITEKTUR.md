# Polizzenvergleich – aktuelle Architektur und Datenfluss

Stand: 30. August 2026
Aktiver Code: `polizzenvergleich-v3`, Punktentscheidungsstand
`b761e3c4`

Die Abschnitte 1 bis 13 unterhalb des folgenden aktuellen V3-Überblicks
beschreiben den historischen Versuchspfad `policy-v0.3.22`. Dessen
`comparison_documents`-Slotmodell mit höchstens zwei indexierten Dokumenten
ist **nicht** der aktive Produktpfad und darf nicht als Implementierungsbasis
verwendet werden. Es bleibt als Versuchsevidenz für Retrieval-, Ledger- und
Cleanup-Erkenntnisse erhalten.

## 0. Aktueller V3-Datenfluss

```text
Paket A (1–9 private PDFs)      Paket B (1–9 private PDFs)
             \                 /
          Rolle + Geltungsstatus
                    |
       persistenter, resumierbarer Vergleichsjob
                    |
      je Dokument isoliert VS/FE/LW/ST/EL/HP/VB/WE
                    |
 Worksheet + atomare Komponenten + Evidence-Spans
                    |
 Wirkungsurteil + Requested-Field-Fakten + Quellen
                    |
       dokumentisolierte Tabellenzeilen
                    |
      paketweiser serverseitiger Rollup
                    |
 technischer Diff + regelgebundene pointDecision
                    |
       UI + privates JSON + Markdown + XLSX
```

Die PDFs bleiben in einer privaten Vergleichsablage und werden weder als
Chat-Anhang noch als Workspace-Dokument indexiert. Jede Datei behält Seite,
Rolle, Geltungsstatus, SHA-256 und stabile Identität. Der Laufvertrag ist
content-addressed; bei unverändertem Dokument-/Releasevertrag setzt ein
unterbrochener Job bei der ersten offenen Kategorie fort.

Der technische Diff vergleicht weiterhin dokumentbezogene Paketdarstellungen.
Die fachliche Punktentscheidung ist davon getrennt und arbeitet nur auf den
atomaren Artefakten. Zulässige Resultate sind `VORTEIL_A`, `VORTEIL_B`,
`GLEICHWERTIG`, `NICHT_VERGLEICHBAR` und `UNKLAR`. Ein Vorteil benötigt
beidseitig vollständige, konfliktfreie, rangaufgelöste und gültig
quellengebundene Fakten desselben Component-, Rollen-, Geltungs-, Scope-,
Varianten-, Werttyp-, Einheiten- und Qualifier-Schlüssels sowie eine
versionierte Serverregel. Fehlender Beleg ist kein Ausschluss. Ein
Gesamtsieger, Score oder freie LLM-Wertung existiert nicht.

Die UI zeigt pro Paket Vertragsinhalt, Deckung, Betrag, Prüfstatus und Quellen.
Die Entscheidungsspalte zeigt Zustand, konkrete Begründung, Regel-ID und den
älteren technischen Diagnoseausgang. Ergebnisschema V2 ist additiv;
gespeicherte V1-Ergebnisse werden in der UI fail-closed als `UNKLAR`
präsentiert. XLSX behält die ursprünglichen Spalten A bis O und ergänzt
Punktentscheidung, Begründung und Regel in P bis R.

## Historische Architektur ab `policy-v0.3.22`

## 1. Systemgrenzen

Die Fork besteht aus sechs fachlichen Grenzen:

1. Collector: Dateiextraktion und selektive OCR.
2. Vergleichsdokument-Lifecycle: Slot A/B, Basisindex, Cleanup.
3. Basis-Retrieval: page-bound FTS und Lance/Dinghy.
4. Analyse-Ledger: Clause Blocks, Signale, Fakten, Evidenzen und Checkpoints.
5. Chat-Retrieval und Ausgabeplanung.
6. macOS-/LM-Studio-Betrieb auf einem lokalen 32-GB-Apple-Silicon-Mac.

## 2. Tatsächlicher Datenfluss in `policy-v0.3.22`

```text
Upload in einem Thread
  -> Parsed-Datei threadbezogen reservieren
  -> Collector
       -> native PDF-Seiten extrahieren
       -> mangelhafte Seiten selektiv OCR (deu+eng)
       -> lückenlose kanonische Page-Map + Source-SHA-256 erzeugen
  -> ComparisonDocumentService
       -> Slot A oder B reservieren
       -> Basisvektoren mit Dinghy -> LanceDB
       -> page-bound Text -> SQLite FTS5
       -> comparison_documents.status = ready
       -> Parsed-Quelle kontrolliert entfernen

Erste Chatfrage mit mindestens einem Vergleichsdokument
  -> ComparisonHybridRetriever
       -> alle Dokumente müssen basis-ready sein
       -> readyForDocuments()
       -> wenn kein aktueller Published Analysis Run:
            ensureForDocuments() synchron abwarten
              -> Clause Blocks aus allen Seiten
              -> Signale persistieren
              -> Clause-Block-FTS
              -> Clause-Block-Dinghy/Lance + Ledger
              -> deterministische Fakten
              -> alle ambiguous_pending-Blöcke seriell an Qwen
              -> vollständige Evidence-/Coverage-Gates
              -> Published Pointer atomar umschalten
       -> vollständiger Maklerprompt:
            FactRowPlan + deterministisches Markdown
       -> sonst:
            Themenunion + page-bound FTS/Lance-Retrieval + Chatantwort
```

Die entscheidende Ist-Eigenschaft lautet: Obwohl Kommentare und frühere
Releases ein optionales Inventar beschreiben, ruft der aktuelle produktive
Retriever bei der ersten Dokumentfrage `ensureForDocuments()` auf. Damit wartet
auch eine kurze Frage wie „Ermittle alle Selbstbehalte“ auf den vollständigen
Analyse-Lauf.

## 3. Collector und kanonische Provenienz

### Module

- `collector/processSingleFile/convert/asPDF/PDFLoader`
- `collector/processSingleFile/convert/asPDF/PageTextQuality`
- `collector/processSingleFile/convert/asPDF/OCRLoader`
- `collector/processSingleFile/convert/asPDF/PdfExtractionAssembler`

### Vertrag

- Jede physische PDF-Seite besitzt genau einen terminalen Kandidaten.
- Eine native Textschicht wird nur akzeptiert, wenn die Qualitätsprüfung
  besteht; andernfalls wird diese Seite selektiv OCR-verarbeitet.
- OCR-Ergebnisse werden ebenfalls geprüft; fehlgeschlagene OCR darf nicht
  unbemerkt auf bereits verworfenen nativen Text zurückfallen.
- `pageContent.slice(start, end)` muss exakt dem Text des Page-Map-Eintrags
  entsprechen.
- Physische Seite und im Dokument gedruckte Seitennummer bleiben getrennt.
- Wiederholte gedruckte Nummern wie `1 von 7` und später `1 von 14` verändern
  die kanonische physische Seite nicht.
- Nicht-PDF-Dokumente dürfen keine physische PDF-Seite erfinden.

### Erhaltene Layoutinformation

Der Collector kann native Spans und Geometrie weitergeben. Die nachgelagerte
Blockbildung darf Fontgewicht, Koordinaten oder Tabellenstruktur nur verwenden,
wenn diese Daten in der konkreten Extraktion vorhanden sind. Bei `text_only`
bleiben tabellarische Wertzuordnungen bewusst mehrdeutig.

## 4. Vergleichsdokument-Lifecycle

### Persistenter Scope

`comparison_documents` bindet ein Dokument an:

- Workspace,
- Thread,
- optionalen Benutzer,
- Slot `A` oder `B`,
- Parsed-Datei,
- Workspace-Dokument,
- Vektor-`docId`,
- kanonischen Source-Hash.

Die Datenbank erzwingt maximal einen Datensatz je `(threadId, slot)`. Die
Anwendung erlaubt höchstens zwei Vergleichsdokumente pro Thread.

### Basisindex

Der Uploadpfad endet nach:

1. kanonischer Extraktion,
2. LanceDB-Basisvektoren,
3. page-bound `ComparisonChunkIndex`-FTS,
4. dauerhaftem `status=ready`.

Die offene Faktenanalyse wird nicht im `afterEmbedded`-Hook gestartet. Dadurch
bleiben PDF/OCR, Dinghy/Lance und Basis-FTS bei einem späteren Analysefehler
erhalten.

### Cleanup

Das Entfernen eines Vergleichsdokuments:

1. tombstoned den Dokumentzustand,
2. wartet auf einen laufenden, nicht abbrechbaren Analyseaufruf,
3. liest danach die Artefakte neu,
4. löscht run-scoped Clause-FTS,
5. löscht ausschließlich die bekannten Lance-Vector-IDs,
6. löscht SQL-Staging und Dokumentzuordnung,
7. entfernt Workspace- und Parsed-Artefakte.

Neue Analyse-Starts werden während `deleting` abgewiesen.

## 5. Basis-Retrieval

### SQLite FTS5

`ComparisonChunkIndex` indexiert page-bound Text. FTS5 wird ausschließlich für
exakte Phrasen, Token und kontrollierte Präfixe verwendet. Es ist keine deutsche
Stemming- oder Synonymmaschine.

Die versionierte Alias-/Synonymtabelle ergänzt bekannte Varianten. Sie ist
additiv und niemals eine abschließende Themenliste.

### LanceDB und Dinghy

Der verwaltete Embeddingvertrag ist fest:

- Engine: LM Studio,
- Identifier: `dinghy-embed`,
- Modell: Dinghy-Law-4B-v1 Q6,
- Dimensionen: exakt `2560`,
- Vector DB: LanceDB,
- lokale Loopback-API.

Der Adapter muss `includeDocIds` vor `topN` anwenden. Ohne diese Garantie wird
der Vergleich fail-closed abgewiesen, weil Treffer sonst zwischen Dokumenten
oder Threads vermischt werden könnten.

### Grenze des bisherigen Targeted-Retrievals

Der aktuelle Chatpfad verwendet Kandidatenlimits (`8` Kandidaten und `6`
Belege pro Themen-/Dokumentzelle). Das ist für normale Antwortkontexte nützlich,
aber kein Vollständigkeitsvertrag für „alle Selbstbehalte“ oder „alle Limits“.

## 6. Analyse-Ledger und atomare Veröffentlichung

### Tabellen

| Tabelle | Zweck |
| --- | --- |
| `comparison_document_analysis_runs` | run-scoped Staging, Version, Source-Hash und Coverage |
| `comparison_document_clause_blocks` | alle Primärblöcke mit Seite, Offsets, Hash, Struktur und Status |
| `comparison_document_block_signals` | positionierte deterministische Signale |
| `comparison_document_block_embeddings` | stabile Vector-ID und Dinghy-Ledger je Block |
| `comparison_document_inventory_items` | validierte, veröffentlichbare Vertragsfakten |
| `comparison_document_fact_evidence` | eine oder mehrere exakte Belegspannen je Fakt |
| `comparison_document_term_aliases` | versionierte additive Begriffsvarianten |
| `comparison_document_clause_blocks_fts` | run-scoped FTS über Clause Blocks |

### Run-Invariante

- Jeder Lauf besitzt eine stabile `analysisRunId`.
- Block-, Signal-, Embedding-, Fakt- und Evidenz-Eindeutigkeit ist run-scoped.
- Ein neuer Lauf wird vollständig staged.
- `comparison_documents.publishedAnalysisRunId` zeigt nur auf einen fertigen,
  kohärenten `ready`-Lauf.
- Der Pointer-Switch geschieht in derselben DB-Transaktion wie die
  Finalisierung.
- Ein `building`- oder `retryable_failed`-Lauf verändert den letzten Published
  Snapshot nicht.
- Published Child-Daten sind durch SQLite-Trigger gegen spätere Mutation
  geschützt.
- Alte Published Läufe werden erst nach erfolgreichem Wechsel kontrolliert
  bereinigt.

### Publish-Gates

Ein Lauf darf nur veröffentlicht werden, wenn unter anderem:

- erwartete und terminale Blockzahl übereinstimmen,
- jeder Primärblock einen zulässigen terminalen Status besitzt,
- Clause-FTS und genau ein passendes Dinghy-Ledger je Block vorhanden sind,
- Modell, Dimension, Run, Block und Text-Hash kohärent sind,
- jeder Fakt demselben Dokument und Lauf gehört,
- jeder Fakt mindestens einen validierten Beleg besitzt,
- der Primärbeleg zum `primaryBlockId` gehört,
- Offsets innerhalb des Blocks liegen,
- `text.slice(offsets)` exakt dem Beleg entspricht,
- Seite und Evidence-Hash übereinstimmen.

## 7. Clause-Block-Bildung

`ComparisonClauseBlockBuilder` erzeugt lückenlose, seitengebundene Primärblöcke
mit standardmäßig höchstens etwa `2400` Zeichen. Grenzen stammen soweit
verfügbar aus:

- Überschriften,
- Absätzen,
- Listenpunkten,
- Tabellenzeilen,
- nativer Span-Geometrie,
- kontrolliertem Hard-Split für übergroße Bereiche.

Jeder Block besitzt:

- `blockKey`, Ordinal und Text-Hash,
- physische Seite oder `null`,
- page- und source-relative halb-offene Offsets,
- Originaltext,
- Strukturart und Heading-Pfad,
- Layoutqualität,
- kurzen Nachbarkontext nur zur Interpretation.

Primärblöcke decken den kanonischen Text vollständig ab. Kontextüberlappung ist
kein zweiter Primärblock und darf nicht als fremde Evidenz verwendet werden.

## 8. Deterministische Signale und Fakten

`ComparisonFactRiskSignals` persistiert positionierte Treffer für unter anderem:

- EUR-Beträge,
- Prozente,
- Zeiträume,
- Limits und „auf Erstes Risiko“,
- Selbstbehalt/Selbstbeteiligung/Franchise,
- Deckungssprache,
- Ausschlüsse und Negationen,
- Obliegenheiten,
- Bedingungen,
- versicherte Sachen,
- Varianten,
- Klauselreferenzen.

`ComparisonDeterministicFactExtractor` erzeugt daraus null bis mehrere
beleggebundene Fakten. Es darf nicht die Regel geben:

```text
kein bekanntes Signal = kein Vertragsfakt
```

Ein signalfreier inhaltlicher Block bleibt `ambiguous_pending`. Nur positiv
erkannter technischer Nicht-Inhalt darf ohne Modell terminalisiert werden.

Der derzeitige entscheidende Schwachpunkt: Die Regeln lösen bei realen
Dokumenten nur einen kleinen Anteil terminal. Im beobachteten 690-Block-Lauf
waren lediglich 45 Blöcke deterministisch abgeschlossen; 577 blieben nach
weiteren Modellresultaten noch ambig.

## 9. Ambige Modellprüfung

`ComparisonAmbiguousFactResolver` verwendet derzeit:

- Extraktionsversion `4`,
- maximal `4096` geschätzte Inputtokens,
- maximal `1024` sichtbare Outputtokens,
- höchstens `4` Blöcke pro Call,
- Temperatur `0`,
- globale `PolicyInferenceQueue`,
- kurze Response-IDs `b1` bis `b4`, die serverseitig auf lange Block-Keys
  zurückgebunden werden.

Die Antwort enthält null bis mehrere Fakten pro Unit. Der Server validiert:

- bekannte Unit-ID oder eindeutige Rückbindung über exakte Evidenz,
- erlaubten Faktentyp,
- exakte zusammenhängende Evidenz im Primärblock,
- Source-Offets,
- geschützte Themenfamilien,
- administrative Metadaten,
- Fakt-/Signal-Kohärenz.

Reale Fehler der Versionen `v0.3.19` bis `v0.3.22` betrafen SQLite-Schreibweise,
ungrounded Modelllabels und beschädigte Unit-IDs. Diese Fehler sind im aktuellen
Code fokussiert abgesichert. Sie waren jedoch Symptome; die verbleibende
untragbare Laufzeit entsteht durch die Menge ambiger Blöcke.

## 10. Modell- und Ressourcenserialisierung

`PolicyInferenceQueue` ist die gemeinsame lokale Ressourcenlease für:

- Vergleichs-Hilfsinferenz,
- Clause-Block-Dinghy,
- Basis-Dinghy-Embedding,
- Query-Embedding,
- Vergleichssynthese.

Invarianten:

- genau eine aktive lokale Modelloperation,
- Operationstimeout beginnt erst nach Erwerb der Lease,
- ein sichtbarer Timeout gibt die Lease nicht frei,
- die Lease bleibt bis zum tatsächlichen Provider-Settlement gesperrt,
- ein wartender Aufruf kann timeouten, ohne später heimlich gestartet zu werden,
- Queue-Wartezeit und Providerzeit werden getrennt gemessen.

Das verhindert Parallel-Retries, löst aber keine schlechte serielle
Gesamtkomplexität.

## 11. Ausgabeplanung

Der `PromptOutputContractParser` liest Gliederung und Tabellenspalten eines
Maklerprompts. Der `ComparisonFactRowPlanner`:

- arbeitet ausschließlich auf Published Facts,
- verwendet run-scoped Fact-Referenzen,
- isoliert Dokument A und B,
- hält Varianten wie Grunddeckung, C, D und Premiumschutz getrennt,
- gruppiert zusammengehörige Faktrollen innerhalb stabiler Clause Blocks,
- erzeugt Quellen aus allen verwendeten Evidenzen,
- verlangt Set-Gleichheit zwischen allen Fakten und allen Row-Ownern,
- weist unbekannte, fehlende oder doppelte Fact-Ownership fail-closed zurück.

Qwen darf Zellen sprachlich formulieren, aber keine Row-ID auswählen,
hinzufügen oder auslassen. Bei unvollständiger Modellantwort bleibt die
deterministische Fassung maßgeblich.

## 12. Zielarchitektur für den nächsten Schritt

```text
Basisindex ready
  -> Nutzerfrage klassifizieren

  konkrete/exhaustive Themenfrage
    -> Clause-FTS: alle Alias-/Präfixtreffer enumerieren
    -> strukturelle Trefferfenster laden
    -> deterministische Werte/Bedingungen/Faktrollen
    -> Dinghy: additive semantische Kandidaten
    -> Kandidaten beidseitig validieren
    -> nur ambige Klauselgruppen ans Modell
    -> Code rendert alle Fakten

  vollständiger Maklerprompt
    -> vollständiges Clause Ledger
    -> deterministische Fakten + gruppierte ambige Restmenge
    -> austauschbarer kleiner Extractor nach Goldstandard-Eval
    -> Qwen nur für schwierige Zuordnung/Endformulierung
    -> Code besitzt und rendert jede Tabellenzeile
```

### Implementierter erster vertikaler Pfad

- Konkrete Selbstbehaltfragen werden vor `ensureForDocuments()` geroutet.
- `ComparisonClauseBlockIndex.searchAllRun()` paginiert alle exakten
  Aliasfundstellen ohne Top-K-Grenze.
- `ComparisonClauseEmbeddingIndex.semanticLinks()` ergänzt semantische
  Kandidaten; ausgegeben werden nur deterministisch belegbare
  Selbstbehalt-Fakten.
- Clause Blocks entstehen source-hash-gebunden in einem resumierbaren
  Staging-Run. Ein vorhandener Published Run wird unverändert wiederverwendet.
- Betrag, Bedingung, Heading/Variante, Beleg und physische Seite werden vom
  Server zusammengeführt und gerendert. Der Pfad hat null generative
  Modellaufrufe.

### Geprüfter, nicht übernommener Rollenbinder-Entwurf

Am 25. August 2026 wurde ein temporärer Spike für eine mögliche
rollenlokale Signalbindung ausgeführt und danach vollständig aus dem
Produktcode entfernt. Der Entwurf band positionierte Geld- und
Bedingungssignale innerhalb derselben Evidenzspanne an geordnete harte
Rollenanker. Seine vorgeschlagene Modulgrenze war eine reine Funktion ohne
Datenbank-, Modell- oder Render-Seiteneffekte:

```text
positionierte Signale + Evidenzspannen + Ziel-/Konkurrenzrollen
  -> rollenlokal zugeordnete Kandidatensignale oder leer bei Konflikt
```

Im Spike verwendeten Extractor und Targeted-Renderer dieselbe fail-closed
Grenze für Werte und Bedingungen. Der dichte `EUR 350`-/`EUR 20.000`-Fall war
damit grün. Das ist Evidenz für eine Lösungsrichtung, aber keine Entscheidung,
diesen konkreten Code oder den bestehenden Branch zu übernehmen.

Der aktuelle Produktcode enthält diesen Binder nicht. `FAIL-003` bleibt dort
offen. Vor einer späteren Neuimplementierung müssen Rollenpartitionierung,
Occurrence-Spans, Tabellen-/Fortsetzungsrelationen und unbekannte
Rollenformulierungen im Gesamtplan gegeneinander geprüft werden.

### Weiter offen

- Clause Blocks sind noch kein eigenständiger Basisindex-Baustein; beim ersten
  gezielten Prompt kann daher die schnelle FTS-/Dinghy-Ledgerbereitung nötig
  sein.
- Heading-Kontinuität über physische Seiten muss kontrolliert behandelt werden.
- Tabellenköpfe und Variantenbezüge brauchen realstrukturnahe Tests.
- Der Rollenbinder-Entwurf muss vor einer Übernahme am 21-Seiten-
  Realstrukturfall und am Original-PDF mit Tabellengeometrie nachgeprüft
  werden.
- Semantische Treffer ohne deterministisches Selbstbehalt-Signal bleiben bis
  zu einer evaluierten, kleinen Ambiguitätsprüfung bewusst unberücksichtigt.

## 13. Harte Invarianten für künftige Änderungen

1. Kein Suchtreffer ohne Thread- und konkrete Dokument-ID.
2. Kein stilles Überspringen einer kanonischen Seite oder eines Primärblocks.
3. Kein `nicht versichert` allein aufgrund fehlender Treffer.
4. Keine physische Seite aus gedruckten Seitenzahlen oder Textreferenzen
   erfinden.
5. Kein globales Top-N in einem als vollständig bezeichneten Pfad.
6. Kein Themen-Dedupe, das Deckung, Limit, Selbstbehalt, Ausschluss, Bedingung
   oder Obliegenheit vernichtet.
7. Keine Mischung unterschiedlicher Varianten oder Dokumente.
8. Kein Wechsel des Embeddingmodells ohne kontrollierte Neueinbettung.
9. Keine gemischten Vektordimensionen in LanceDB.
10. Kein Modellretry vor tatsächlichem Settlement des vorherigen Aufrufs.
11. Kein Staging-Schreibzugriff auf einen Published Run.
12. Kein Analysefehler darf den Basisindex oder letzten Published Snapshot
    löschen.
13. Keine Kunden-PDFs, Storage-Dateien, Logs oder Schlüssel in Git.

## 14. Experimenteller Feuerpilot: dynamische Discovery und Span-ID-Vertrag

Stand 25. August 2026, uncommitteter Entwicklungszustand auf Basis
`policy-clean-implementation` / `a1935f16`:

```text
Canonical Comparison Source mit PageMap
  -> codebasierte dynamische Zeilen-Discovery
       jede nichtleere Zeile als stabile Ledgerzeile terminal disponiert
       wortgetreue Struktur-/Inhaltslabel mit stabiler ID
       Struktur und zusätzliche Feldlabels als getrennte Views
       kompatibles Nummerierungspräfix oder Hierarchie unresolved
       content-addressiertes lokales Artifact je exaktem Ledger
       Partnerkatalog bleibt getrennte View
  -> feste FEUER-Occurrence-Enumeration
  -> additive dokumentgebundene Dinghy-Suche
  -> begrenzte Candidate Sources
       Retrievalmanifest: enumeriert -> ausgewählt -> einbezogen -> verworfen
  -> serverseitige Evidence Spans
       SPAN-ID + Quellfingerprint + physische Seite + Originaloffset
       exakter Originalsubstring + überlappende Langtextfenster
       kanonische PageMap-Rückprüfung + sichtbares Overflowmanifest
  -> Qwen: strikt drei Spalten je fester CAT-Zeile
       CAT-ID -> SPAN-ID oder NONE -> RELEVANT/UNCLEAR/NONE
  -> Code: NONE-Normalisierung, doppelte ID -> unresolved
  -> kontrollierter Kategorienmatcher
  -> source-bound Kandidaten; freie Modellfelder bleiben unvalidiert
  -> deterministische A/B-Tabelle ohne automatisches Fachurteil
  -> getrennt markierter Discovery-Anhang
  -> Chat: kompakte Zähler + Artifact-ID + Span-/Retrievalmanifest
  -> Artifact-Lifecycle: persistente In-flight-Lease + referenzbasierter GC
```

Der Modelloutput besitzt weder Zeilenmenge noch Quelle. Er darf eine
serverseitig geplante Zeile nicht auslassen und kein Zitat oder keine Seite
erfinden. Eine gewählte Span-ID bestätigt nur die technische Herkunft. Rolle,
Wert, Geltungsbereich, Variante, Ausschlusswirkung und Vergleichbarkeit bleiben
eigene Validierungsgrenzen. Dynamische Labels erhalten zunächst
`unmapped_discovery`; sie verändern weder Partner-IDs noch A/B-Joins.
Ein ungeklärter Nummerierungspfad bleibt auch für tiefere Nachfahren
`unresolved`. Das vollständige Line-Ledger bleibt ein lokales sensibles
Artefakt und wird nach Wegfall aller Chat-Referenzen zeitverzögert bereinigt.
Lang laufende Analysen halten bis zur Chat-Persistenz eine dateibasierte Lease;
abgebrochene Leases besitzen eine begrenzte Lebensdauer.

Die verwaltete Workspace-Konfiguration bleibt Top-N 32, Temperatur 0,
Similarity Threshold 0 und Suchmodus `default`. Der Feuerpfad begrenzt die
semantischen Kandidaten weiterhin batchweise. Daher darf aus der Zahl 32 oder
der dynamischen Line-Coverage keine fachliche Vollständigkeit abgeleitet
werden.

## 15. Aktueller V3-Hybridfallback: breite Navigation, exakte Evidenz

Stand 30. August 2026, produktiver V3-Pfad in `polizzenvergleich-v3`:

```text
kontrolliertes atomare Ziel bleibt ungelöst
  -> seitengebundene 3000/250-Navigationschunks
  -> Dinghy-Ranking, maximal drei Chunks je Ziel
  -> getrennte semantische Spanauswahl je Ziel und Chunk
  -> Server: exakter eindeutiger Originalsubstring + Zielanker + Offset
  -> HYBRID_EXACT_SPAN, nicht der breite Chunk
  -> normale Rollen-/Scope-Triage
  -> normale Wirkungsprüfung
  -> serverseitige Tabellenzeile
```

Der Embedder findet nur Navigationskandidaten. Weder Score noch Chunk erzeugen
einen Fakt. Die Modellauswahl darf ausschließlich einen wortgetreuen,
eindeutigen Span bis 900 Zeichen zurückgeben. Nicht exakte, erfundene,
mehrdeutige oder nicht zielverankerte Zitate werden zu `UNRESOLVED`
herabgestuft und nicht repariert.

Hybridkandidaten bleiben in der Triage vollständig modelloffen. Ihr atomarer
Semantikvertrag präzisiert die Rollenfrage, beweist sie aber nicht. Diese
Präzisierung wird nur für Hybridziele an den bestehenden Systemprompt
angehängt; normale Kandidaten verwenden byteidentisch den bisherigen Prompt.
Modell- und Embedding-ID sind Teil des privaten Laufmanifests, und ein Resume
mit abweichender Identität wird abgelehnt.

Die technische Modulgrenze ist wiederverwendbar. Produktiv aktiviert sind in
V3.3.1 nur die beiden Komponenten von `HP-12`. Eine Aktivierung weiterer
Anforderungen ist eine fachliche Katalogänderung und benötigt eigene
Positiv-, Negativ-, Nachbar- und Zielhardwarekontrollen.

## 16. V3.4.0: lokale Klauselgrenze der Punktentscheidung

Die Punktentscheidung liest keine sichtbaren Tabellenstrings. Sie
materialisiert für jede ausgewählte atomare Quelle intern zusätzlich einen
lokalen Kontext von höchstens 240 Zeichen vor und nach dem servergebundenen
Originalspan. Dieser Kontext ist nur ein Sicherheitsinput und wird nicht als
zusätzliche sichtbare Evidenz ausgegeben.

```text
ausgewählte Candidate-ID + exakter Quellspan + Dokumentoffset
  -> lokaler Bedingungsprüftext
  -> starke Ausnahme-/Bedingungsmarker oder deckungsbezogenes wenn/falls
  -> FAIL_CLOSED_CONDITIONAL_SOURCE_V1
  -> UNKLAR statt Vorteil oder Gleichwertigkeit
```

Ist der Offset ungültig, fällt die Prüfung auf den exakten Span zurück; ein
breites Kontextfenster wird nicht blind verwendet. Damit beeinflussen weit
entfernte Bedingungen keine unbeteiligte Vergleichsdimension. Reine
Definitionen einer Gefahr sind von einem bedingten Deckungsversprechen zu
trennen. Der lokale Prüftext bleibt absichtlich außerhalb des öffentlichen
Auditobjekts; dort erscheinen weiterhin nur Candidate-ID, physische Seite und
exakter Originaltext.
