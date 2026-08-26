# Polizzenvergleich V3.2.0

## Inhalt

- kanonische PageMap für jede PDF-Datei
- Erhalt leerer physischer PDF-Seiten
- Chunks überschreiten keine Seitengrenze
- Dokument-ID, Dokumentname, physische Seite und Chunkindizes in LanceDB
- alte Vektorcaches ohne Seitenprovenienz werden nicht still wiederverwendet
- Quellenanzeige trennt gleichnamige Dokumente und zeigt physische PDF-Seiten
- numerische Transportlabels werden bei seitengebundenen PDF-Quellen vermieden
- promptneutraler lokaler Akzeptanzrunner mit deterministischer Prüfung von
  Kategorie-ID, Reihenfolge, Spalten, Status, Deckung und exaktem Seitenzitat

Die fachlichen Kategorie-Systemprompts werden nicht automatisch geladen und
nicht in der V3-Datenbank persistiert. Sie bleiben separate Dateien und werden
dem Akzeptanzrunner nur für den jeweiligen Lauf übergeben.

## Update beim Kunden

```bash
cd ~/Code/polizzenvergleich-v3
./doctor.command
./update.command v3.2.0
./doctor.command
open http://127.0.0.1:3004
```

Danach in V3 einen neuen Workspace anlegen und die Original-PDF neu hochladen.
Erst fortfahren, wenn die automatische Indexierung vollständig beendet ist.
PDFs aus einem älteren V3-Index müssen neu hochgeladen werden.

## Kategorieprompt ohne V3-Datenbankpersistenz testen

Das separat ausgelieferte Promptpaket wird außerhalb des Git-Repositories
entpackt:

```bash
mkdir -p ~/Documents/Polizzenvergleich-Prompts
ditto -x -k \
  ~/Downloads/polizzenvergleich-v3.2.0-kategorie-systemprompts-v2.zip \
  ~/Documents/Polizzenvergleich-Prompts
```

LM Studio muss das Chatmodell und Dinghy bereits unter ihren API-Identifiern
geladen haben. Für den Kunden-Mac mit den bestehenden Aliasen lautet der
EL-01-bis-EL-36-Lauf:

```bash
cd ~/Code/polizzenvergleich-v3

EMBEDDING_MODEL_PREF='dinghy-embed' \
LMSTUDIO_MODEL_PREF='qwen/qwen3.8-27b' \
./.runtime/node-v22.23.2/bin/node \
  server/scripts/qa/pdfProvenanceLiveRun.cjs \
  --pdf '/ABSOLUTER/PFAD/ZUR/DATEI.pdf' \
  --output "$HOME/Documents/Polizzenvergleich-QA/EL-$(date +%Y%m%d-%H%M%S)" \
  --systemPromptFile \
    "$HOME/Documents/Polizzenvergleich-Prompts/05_elementar_und_zusatzdeckungen.md" \
  --userPrompt 'Analysiere die vollständig im Kontext bereitgestellten Vertragsdokumente gemäß dem Systemprompt. Gib ausschließlich die definierte Tabelle für EL-01 bis EL-36 und anschließend den vorgeschriebenen Hinweis aus.' \
  --topN 55 \
  --modelTokenLimit 42496
```

Der Lauf erzeugt im angegebenen Ausgabeordner:

- `answer.md`: unveränderte Modellantwort
- `report.json`: Modelle, Seiten, Chunks, Retrieval, Tokenverbrauch und Gate
- `retrieved-sources.private.json`: private abgerufene Vertragsquellen
- `messages.private.json`: privater vollständiger Modellrequest

Diese Dateien enthalten Vertragsinhalt und dürfen nicht in GitHub, öffentliche
Issues oder ungeschützte Cloudspeicher hochgeladen werden.

Ein `PASS` des technischen Runners ersetzt keine fachliche oder rechtliche
Endprüfung. Ein `REVISE` nennt die konkreten Vertragsabweichungen, etwa fehlende
Zeilen, falsche Statuskombinationen oder ein Zitat, das auf der behaupteten
physischen PDF-Seite nicht wörtlich gefunden wurde.

## Bekannte Grenze

Der lokale Qwen-3.5-4B-Test erhielt bei WEVIG 39/39 und bei Generali 42/42
Dokumentchunks, erfüllte den vollständigen EL-01-bis-EL-36-Vertrag aber nicht.
Der Kundenlauf mit Qwen 27B ist daher ein eigener Akzeptanztest und keine
automatische Freigabe.

## Rollback

Keinen alten Code-Tag allein über eine bereits mit V3.2.0 verwendete
Installation legen. Ein Rollback muss Code, SQLite-Datenbank, LanceDB,
Vektorcache und Dokumentdaten als zusammengehörigen Stand behandeln. Der
V3.2.0-Kundentest soll deshalb zunächst in einem neuen Workspace erfolgen.
