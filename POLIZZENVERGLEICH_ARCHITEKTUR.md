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
       -> offenes LLM-Inventar: alle Seitenbatches, Belege gegen Seite validiert
       -> Prisma: persistente Inventarfakten + Version/Seitenabdeckung
  -> ComparisonHybridRetriever: jedes Union-Thema separat für A und B
       -> FTS und LanceDB je Thema/Dokument, ohne globale Themenkonkurrenz
  -> ComparisonBatchSynthesizer: vollständige A/B-Themenblöcke im Promptbudget
       -> beleggebundene Gesamtbewertung über alle Themenblöcke
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
- Eine OCR-Seite wird nur akzeptiert, wenn auch ihr erkannter Text die
  Qualitätsprüfung besteht. Leere oder weiterhin mangelhafte OCR darf nicht auf
  eine zuvor bereits abgelehnte native Textschicht zurückfallen.
- Output bleibt genau ein JSON pro PDF. `pageContent.slice(start,end)` entspricht
  für jeden `pageMap`-Eintrag exakt dem Seitentext.

### Vergleichs-Lifecycle

- `comparison_documents` besitzt den fachlichen Scope: Workspace, Thread,
  Benutzer, Slot A/B, Parsed-Datei, Workspace-Dokument und Doc-ID.
- POST `.../comparison-documents/:fileId` ist die einzige Default-User-fähige
  Einbettungsroute für diesen Workflow.
- Maximal zwei Slots pro Thread; der DB-Unique-Constraint ist die letzte
  Parallelitätsbarriere.
- `afterEmbedded` indexiert FTS und erstellt anschließend aus allen kanonischen
  Seiten das offene Inventar. Ein Fehler löst Vektor-/Datei-Rollback aus und
  hält die Parsed-Datei für Retry.
- `beforeRemoved` entfernt FTS und Inventar vor Vektor- und Datei-Cleanup.
- Thread-, Workspace- und Benutzerlöschung müssen über den Cleanup-Service
  laufen; direkte DB-Cascades sind keine zulässige externe Löschgrenze.

### Retrieval

- `PageAwareTextSplitter` erzeugt niemals Cross-Page-Chunks.
- Vektormetadaten bleiben skalar und klein; `pageMap/pdfExtraction` werden nicht
  in jeden Vektor kopiert.
- `ComparisonChunkIndex` ist der lokale exakte/BM25-Kanal.
- `ComparisonInventoryExtractor` erhält alle Seiten ohne Top-N-Vorauswahl. Es
  akzeptiert nur striktes JSON und nur Belege, die auf der angegebenen
  kanonischen Seite tatsächlich vorkommen.
- `ComparisonDocumentInventory` ersetzt einen guten Bestand erst atomar nach
  erfolgreicher Neuerzeugung. Alte `ready`-Dokumente werden bei der ersten
  Anfrage aus ihrer gespeicherten Seiten-JSON lazy und single-flight
  nachindexiert; FTS, Vektoren, Chats und Dokument-IDs bleiben dabei unverändert.
- Ein Inventar gilt nur als aktuell, wenn Version, positive Item-/Seitenzahlen
  und der SHA-256 des kanonischen PDF-Textbestands exakt übereinstimmen.
- Generative Inventaraufrufe beider PDF-Uploads laufen serverweit mit
  Concurrency 1, begrenztem Retry und Timeout. Semantische Kandidaten werden
  gesammelt in begrenzten Batches validiert, nicht pro Thema und Dokument mit
  einem eigenen LLM-Aufruf.
- `ComparisonHybridRetriever` fragt A und B getrennt ab und erlaubt ausschließlich
  LanceDB, weil nur der Fork-Lance-Adapter den `includeDocIds`-Filter vor `topN`
  garantiert.
- Die Themenunion A ∪ B ist die fachliche Suchplanung. Jedes Thema besitzt eine
  eigene A/B-Zelle; FTS- und Vektortreffer konkurrieren nur innerhalb dieser
  Zelle. Unbelegte Standardanker sind additiver Fallback und niemals
  Vollständigkeitsdefinition oder Vertragsfakt.
- Große Inventare werden in vollständigen Themenblöcken sequenziell ausgewertet;
  kein generisches Kürzen darf die Mitte eines A/B-Belegblocks entfernen.
- Mehrere Themenblöcke werden zunächst einzeln belegt verglichen und danach
  hierarchisch zu einer Gesamtbewertung reduziert. Teilvergleiche und
  Gesamtbewertung werden beide live an den Chat gestreamt und identisch
  persistiert.
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
7. `keine belegte Fundstelle gefunden` ist kein Synonym für `nicht versichert`.
   Ein Ausschluss erfordert einen konkreten Seitenbeleg.

## Bestandsmigration

- Die Prisma-Migration fügt ausschließlich nullable Inventar-Metadaten und eine
  Child-Tabelle mit `ON DELETE CASCADE` hinzu. Bestehende Vergleichsdokumente,
  Threads, Chats, Workspace-Zuordnungen und Vektoren werden nicht umgeschrieben.
- `inventoryStatus = NULL` kennzeichnet einen sicheren Legacy-Bestand. Vor der
  nächsten gezielten oder generischen Vergleichsfrage wird sein Inventar aus der
  gespeicherten, source-gehashten Seiten-JSON erzeugt.
- Fehlt diese kanonische Quelle oder ist die Page-Map unvollständig, bricht der
  Vergleich sichtbar ab und verlangt erneutes Ablegen der PDF. Es gibt keinen
  stillen Rückfall auf eine scheinbar vollständige Standardthemenliste.
- Der Doctor validiert die neuen Spalten und die Inventar-Child-Tabelle gegen
  die Live-Datenbank. Nach erfolgreich ausgeführter additiver Migration wird
  bei einem späteren Installationsfehler kein schema-inkonsistenter DB-only
  Rollback auf den alten Stand durchgeführt.

## Erweiterungspunkte

- Transparente Recovery-Synonyme: `ComparisonTopicInventory`; sie ergänzen das
  offene Inventar, bestimmen es aber nicht.
- Offene Inventarextraktion: `ComparisonInventoryExtractor`.
- Neue Fusion/Top-k-Strategie: `ComparisonHybridRetriever`, immer pro Dokument.
- Weitere OCR-Sprachen: Admin-Konfiguration `TARGET_OCR_LANG`; Standard bleibt
  `deu,eng`.
- Anderer Embedder: unveränderter Retrievalvertrag; modellabhängige
  Query-Instruktion über `EMBEDDING_QUERY_PREFIX`.
- Andere Vector-DB: erst eigenen `includeDocIds`-Filter vor `topN` implementieren,
  testen und dann die Fail-closed-Prüfung erweitern.
