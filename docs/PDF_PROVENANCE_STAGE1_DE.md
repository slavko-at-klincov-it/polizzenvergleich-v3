# PDF-Provenienz Stufe 1

Diese V3-Stufe bindet jeden eingebetteten PDF-Chunk an die physische PDF-Seite.
Sie verändert weder Systemprompt noch Top-N, Temperatur, Reranking oder
fachliche Versicherungslogik.

## Neuer Vertrag

- Der Collector speichert `documentType: "pdf"`, `pageMap` und
  `pdfExtraction.schemaVersion: 1`.
- Leere physische Seiten bleiben als leere PageMap-Bereiche erhalten.
- PDF-Chunks werden ausschließlich innerhalb einer physischen Seite erzeugt.
- Lance-Zeilen und Vector-Caches tragen
  `provenanceSchemaVersion`, `docId`, `sourceDocumentId`, `title`,
  `pageNumber`, `chunkIndex` und `pageChunkIndex`.
- `pageNumber: 0` bedeutet: kein PDF-Dokument.

## Legacy-Daten

Ein altes flaches PDF-JSON besitzt keine rekonstruierbaren Seitengrenzen. Es
darf nicht lediglich neu eingebettet werden, sondern die Original-PDF muss
erneut durch den Collector laufen. Ein alter Vector-Cache wird verworfen. Ein
alter Lance-Namespace ohne die Pflichtspalten endet mit
`LANCE_PROVENANCE_REINDEX_REQUIRED`.

## Kontrollierter Neuaufbau

1. V3 stoppen und diese Verzeichnisse gemeinsam sichern:
   `server/storage/anythingllm.db`, `server/storage/lancedb`,
   `server/storage/vector-cache` und `server/storage/documents`.
2. Für einen Vergleichslauf einen neuen Workspace verwenden.
3. Die Original-PDF erneut hochladen und die automatische Indexierung
   vollständig abwarten.
4. Keine alten Collector-JSONs oder Lance-Namespaces in den neuen Workspace
   kopieren.
5. Bei einem bestehenden Workspace vor einem Vector-Reset alle zugeordneten
   Dokumente inventarisieren. Der Reset fügt sie nicht automatisch wieder
   hinzu.

## Rollback

Ein Rollback benötigt gemeinsam den vorherigen Code-Tag sowie die gesicherten
SQLite-, Lance-, Vector-Cache- und Dokumentdaten. Nur den Code zurückzusetzen
ist kein vollständiger Rollback.

## R10/R11-Abnahme

Die lokalen Läufe erfolgen getrennt mit einem frischen Workspace und frischem
Index:

1. `Musterberechnung WEVIG Premiumschutz.pdf`
2. `GENERALI-LF Immo-Exklusivschutz 2023 ... .pdf`

Embedder: lokal geladenes Dinghy-Law-4B Q6 mit 2.560 Dimensionen. Chatmodell:
`qwen3.5-4b-mlx`. Alias, tatsächlich geladenes Modell, Parameter,
Datei-SHA-256, Laufzeit, PageMap, Lance-Schema, Retrievalquellen und manuelle
Seitenstichproben werden je Lauf protokolliert.
