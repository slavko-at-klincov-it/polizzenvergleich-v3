# Lokaler Polizzenvergleich – Einrichtung und Betrieb

Diese Fork-Variante ist auf einen einfachen Ablauf für Versicherungsmakler
ausgelegt: neuer Vergleich, zwei PDFs in den Chat ziehen, Frage oder Auftrag
eingeben, fertig. Die technische Verarbeitung läuft threadbezogen im
Hintergrund.

## Festgelegtes Start-Setup für den 32-GB-Mac

- Chatmodell: Gemma 4 26B-A4B Instruct, MLX 4-bit
- Embeddingmodell: Dinghy-Law-4B-v1 GGUF Q6_K
- Modellserver: LM Studio
- Vektordatenbank: LanceDB; andere Vektordatenbanken werden für den sicheren
  Vergleich absichtlich abgelehnt
- Kontextfenster: zunächst 32.768 Tokens
- OCR: Deutsch und Englisch, maximal zwei Worker
- Suche: exakte Volltextsuche/BM25 und semantische Suche, getrennt für Dokument
  A und Dokument B

TurboQuant ist keine Voraussetzung. Es wird in diesem Stand weder benötigt
noch von LM Studio als einfache produktive Option vorausgesetzt.

## Was der Makler sieht

1. Workspace `Polizzenvergleich` öffnen.
2. `New Thread` ist nicht manuell erforderlich: Beim ersten PDF wird automatisch
   ein echter Thread erzeugt.
3. Genau zwei PDFs hineinziehen.
4. Warten, bis beide Chips `Bereit` zeigen.
5. Zum Beispiel `Vergleiche die beiden Policen vollständig` oder
   `Wo unterscheiden sich die Selbstbehalte?` schreiben.
6. Ergebnis mit Dokumentname und Seitennummer prüfen.

Alte Kundendokumente werden nicht in neue Vergleiche einbezogen. Das Löschen
eines Vergleichsthreads entfernt dessen Vergleichsdokumente, Vektoren,
Volltextindex und lokale Quelldateien.

## Einmalige Admin-Einrichtung

### 1. Modelle in LM Studio

Beide Modelle installieren und als lokale Servermodelle verfügbar machen. Beim
Chatmodell in LM Studio `context length = 32768` setzen. Das tatsächlich geladene
Fenster anschließend im Terminal prüfen:

```bash
lms ps
```

Die Spalte `CONTEXT` ist maßgeblich. Alternativ zeigt die REST-API den
Runtime-Wert unter `loaded_instances[].config.context_length`:

```bash
curl -sS http://127.0.0.1:1234/api/v1/models | python3 -m json.tool
```

Nicht `max_context_length` als AnythingLLM-Kontextwert übernehmen. Erst wenn ein
vollständiger Vergleich ohne gelben/roten Speicherdruck und ohne nennenswerten
Swap stabil läuft, kann 42.496 getestet werden.

### 2. AnythingLLM-Umgebung

Aus `server/.env.example` eine lokale `server/.env` anlegen. Geheimnisse und
Storage niemals committen. Die relevanten Werte sind:

```dotenv
SERVER_PORT=3002
STORAGE_DIR='/absoluter/pfad/zu/privatem/anythingllm-storage'
COLLECTOR_HOTDIR_PATH='/absoluter/pfad/zum/repo/collector/hotdir'

LLM_PROVIDER='lmstudio'
LMSTUDIO_BASE_PATH='http://127.0.0.1:1234/v1'
LMSTUDIO_MODEL_PREF='EXAKTE_LM_STUDIO_MODELL_ID_VON_GEMMA'
LMSTUDIO_MODEL_TOKEN_LIMIT=32768

MODEL_TOKENIZER_PATH='/absoluter/pfad/zum/gemma-modellordner-mit-tokenizer.json'
MODEL_TOKENIZER_LABEL='Gemma 4'

EMBEDDING_ENGINE='lmstudio'
EMBEDDING_BASE_PATH='http://127.0.0.1:1234/v1'
EMBEDDING_MODEL_PREF='EXAKTE_LM_STUDIO_MODELL_ID_VON_DINGHY'
EMBEDDING_MODEL_MAX_CHUNK_LENGTH=8192
EMBEDDING_QUERY_PREFIX='Instruct: Retrieve all relevant passages from German and Austrian insurance contracts for exact clause comparison, including deductibles, exclusions, limits, monetary amounts, percentages, conditions, and synonymous wording.'

VECTOR_DB='lancedb'
TARGET_OCR_LANG='deu,eng'
```

`MODEL_TOKENIZER_PATH` verbessert nur die sichtbare Tokenanzeige. Fehlt ein
passender `tokenizer.json`, arbeitet die Dokumentverarbeitung weiter und fällt
auf die vorhandene Schätzung zurück.

### 3. Installieren, migrieren und bauen

Node.js gemäß `.nvmrc` und Corepack verwenden:

```bash
corepack enable
corepack yarn install
corepack yarn --cwd server install
corepack yarn --cwd collector install
corepack yarn --cwd frontend install
corepack yarn prisma:generate
cd server && npx prisma migrate deploy --schema=./prisma/schema.prisma
cd ../frontend && corepack yarn build
```

Für den Bare-Metal-Produktionsbetrieb anschließend den Inhalt von
`frontend/dist` nach `server/public` übernehmen und Server sowie Collector als
getrennte Prozesse starten. Die allgemeinen Hinweise stehen in `BARE_METAL.md`.

### 4. AnythingLLM-Oberfläche

1. Unter `Settings → Security` Multi-User aktivieren.
2. Der erste Account bleibt Admin.
3. Den Makler unter `Settings → Users` mit Rolle `Default` anlegen.
4. Einen leeren Workspace `Polizzenvergleich` anlegen und nur diesem Benutzer
   zuweisen.
5. Keine normalen oder gepinnten Dokumente in diesem Workspace hinterlegen.
6. Chat-Modus verwenden; die Vergleichspipeline übernimmt die beleggebundene
   Suche selbst.
7. Unter den Modell-/Embedding-Einstellungen dieselben LM-Studio-Modelle und
   LanceDB auswählen.

## Sicherheits- und Qualitätsverhalten dieser Fork

- Ein Vergleich ist erst mit genau zwei erfolgreich indexierten PDFs aktiv.
- Jeder semantische Suchlauf ist auf die Dokument-ID von A beziehungsweise B
  begrenzt; beide Dokumente erhalten eigene Trefferbudgets.
- Exakte Begriffe, Beträge und Synonyme wie `Selbstbehalt`,
  `Selbstbeteiligung` und `Franchise` werden zusätzlich lexikalisch gesucht.
- PDF-Seiten werden einzeln extrahiert. Nur leere oder offensichtlich defekte
  Textlayer-Seiten werden mit `deu,eng` OCR verarbeitet.
- Fehlende oder technisch gescheiterte Seiten lassen den Import sichtbar
  fehlschlagen; sie werden nicht still übersprungen.
- Chunks überschreiten keine Seitengrenzen und tragen Dokumentname,
  Seitennummer, Extraktionsart und Quell-Hash.
- Aussagen ohne Fundstelle müssen als `keine belegte Fundstelle gefunden`
  gekennzeichnet werden, nicht als sicherer Vertragsausschluss.

## Abnahmetest am Kundenrechner

Da im Entwicklungsstand keine echten Kundendokumente oder die Kundenmodelle
verfügbar waren, ist dieser Test vor dem produktiven Einsatz verpflichtend:

1. Ein synthetisches oder freigegebenes PDF-Paar mit bekannten Fundstellen
   verwenden; keine Kundendaten in Support-Chats kopieren.
2. Mindestens je eine Fundstelle für Selbstbehalt, Ausschluss, Geldbetrag,
   Prozentwert und Obliegenheit in beiden Dokumenten prüfen.
3. Eine Fundstelle muss auf einer gescannten Seite liegen, damit selektives OCR
   geprüft wird.
4. Seitennummern im PDF visuell gegen die Antwort vergleichen.
5. Während Upload, Indexierung und Antwort ausführen:

   ```bash
   lms ps
   memory_pressure
   sysctl vm.swapusage
   ```

6. Abnahme nur bei stabilem Prozess, grünem Speicherdruck und keinem stetig
   wachsenden Swap. Falls Q6 zu knapp ist, zuerst Dinghy Q4_K_M gegen Q6 messen;
   nicht das Kontextfenster erhöhen.
7. Einen Thread löschen und danach kontrollieren, dass seine PDFs in einem neuen
   Thread weder als Treffer noch als Quelle auftauchen.

## Entwicklerprüfung

```bash
npx jest --runInBand
npm --prefix server run lint:check
npm --prefix collector run lint:check
npm --prefix frontend run lint:check
npm --prefix frontend run build
git diff --check
```

Der Modellvergleich BGE-M3 gegen Dinghy bleibt ein Abnahmetest, keine Annahme:
Dinghy ist für deutsches Recht plausibel, aber nicht speziell für österreichische
Versicherungspolicen belegt. Die exakte Suche und die Dokumentisolation sind
daher unabhängig vom ausgewählten Embedder umgesetzt.
