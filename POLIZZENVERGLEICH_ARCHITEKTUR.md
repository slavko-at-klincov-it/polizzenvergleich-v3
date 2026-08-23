# Polizzenvergleich – Modul- und Datenfluss

Dieses Dokument beschreibt nur die Fork-spezifischen Grenzen. Die allgemeine
AnythingLLM-Architektur bleibt unverändert.

## Ablauf

```text
Chat-Drop (PDF A/B)
  -> threadbezogen parsen
  -> PDFLoader: jede physische Seite
  -> PageTextQuality: native Seite akzeptieren oder OCR anfordern
  -> OCRLoader: selektiv deu+eng, vollständige Seite
  -> PdfExtractionAssembler: lückenloser Text + pageMap + SHA-256
  -> ComparisonDocumentService: Slot reservieren, einbetten, rollbacken
       -> LanceDB: page-bound Vektoren
       -> SQLite FTS5: page-bound Volltext/BM25
  -> ComparisonHybridRetriever: separat A und B, RRF-Zusammenführung
  -> Chatprompt: nur Belegstellen dieses Threads
  -> Antwort + Dokument-/Seitenzitate
```

## Modulverträge

### Collector

- `PDFLoader.loadPages(file)` liefert für `1..N` genau einen PageCandidate.
- `PageTextQuality` ist rein und entscheidet nicht anhand einer einzelnen
  OCR-Confidence-Schwelle.
- `OCRLoader.ocrPDFPages(file, {pageNumbers,maxWorkers})` liefert für jede
  angeforderte Seite ein terminales Resultat.
- `PdfExtractionAssembler` akzeptiert keine fehlenden, doppelten oder technisch
  gescheiterten Seiten.
- Output bleibt genau ein JSON pro PDF. `pageContent.slice(start,end)` entspricht
  für jeden `pageMap`-Eintrag exakt dem Seitentext.

### Vergleichs-Lifecycle

- `comparison_documents` besitzt den fachlichen Scope: Workspace, Thread,
  Benutzer, Slot A/B, Parsed-Datei, Workspace-Dokument und Doc-ID.
- POST `.../comparison-documents/:fileId` ist die einzige Default-User-fähige
  Einbettungsroute für diesen Workflow.
- Maximal zwei Slots pro Thread; der DB-Unique-Constraint ist die letzte
  Parallelitätsbarriere.
- `afterEmbedded` indexiert FTS. Ein Fehler löst Vektor-/Datei-Rollback aus und
  hält die Parsed-Datei für Retry.
- `beforeRemoved` entfernt FTS vor Vektor- und Datei-Cleanup.
- Thread-, Workspace- und Benutzerlöschung müssen über den Cleanup-Service
  laufen; direkte DB-Cascades sind keine zulässige externe Löschgrenze.

### Retrieval

- `PageAwareTextSplitter` erzeugt niemals Cross-Page-Chunks.
- Vektormetadaten bleiben skalar und klein; `pageMap/pdfExtraction` werden nicht
  in jeden Vektor kopiert.
- `ComparisonChunkIndex` ist der lokale exakte/BM25-Kanal.
- `ComparisonHybridRetriever` fragt A und B getrennt ab und erlaubt ausschließlich
  LanceDB, weil nur der Fork-Lance-Adapter den `includeDocIds`-Filter vor `topN`
  garantiert.
- Ergebnisse aus FTS und Vektorsuche werden per Reciprocal Rank Fusion
  zusammengeführt. Ein Dokument darf das andere nicht aus dem Trefferbudget
  verdrängen.
- Ein Vergleichsprompt darf weder generische Workspace-Dokumente noch
  `parsedFiles` aus dem Full-Context-Pfad beimischen.

### UI

- Vor dem ersten PDF muss eine persistierte Thread-ID existieren.
- Während Parse/Index/Delete/Hydrate ist Senden gesperrt.
- Der Status wird nach Navigation und Reload erneut vom Server hydriert.
- Das X am Chip ruft den threadgescopten DELETE-Endpunkt auf; es ist keine rein
  lokale UI-Aktion.
- Zitate werden nach `docId` gruppiert und zeigen `pageNumber`.

## Invarianten für künftige Änderungen

1. Kein Suchtreffer ohne `threadId` und konkrete Vergleichs-Dokument-ID.
2. Kein stilles Überspringen einer physischen PDF-Seite.
3. Keine sichere Negativbehauptung nur aufgrund fehlender Retrievaltreffer.
4. Kein Wechsel der Vektordatenbank ohne gleichwertigen serverseitigen
   Dokumentfilter und eigene Isolationstests.
5. Kein Wechsel des Embeddingmodells ohne vollständige Neueinbettung; Dimensionen
   dürfen nicht im selben Lance-Namespace gemischt werden.
6. Kein Push von `.env`, Storage, Datenbanken, Dokumenten, Vektoren, Logs oder
   privaten Schlüsseln.

## Erweiterungspunkte

- Neue Synonyme und Vergleichskategorien: `ComparisonChunkIndex`.
- Neue Fusion/Top-k-Strategie: `ComparisonHybridRetriever`, immer pro Dokument.
- Weitere OCR-Sprachen: Admin-Konfiguration `TARGET_OCR_LANG`; Standard bleibt
  `deu,eng`.
- Anderer Embedder: unveränderter Retrievalvertrag; modellabhängige
  Query-Instruktion über `EMBEDDING_QUERY_PREFIX`.
- Andere Vector-DB: erst eigenen `includeDocIds`-Filter vor `topN` implementieren,
  testen und dann die Fail-closed-Prüfung erweitern.
