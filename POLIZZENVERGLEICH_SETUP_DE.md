# Lokaler Polizzenvergleich – Einrichtung und Betrieb

> [!WARNING]
> Der technisch installierte Kundenstand ist `v3.5.1` / `ca2add77`. Installation,
> Doctor und Datenintegrität sind bestätigt; die fachliche Kundenfreigabe bleibt
> wegen dokumentierter Recall- und Klauselscopefehler `NO GO`. Ergebnisse müssen
> bis zu deren Behebung fachlich geprüft werden. Weder beliebige Polizzen noch
> das 99-Prozent-Ziel sind belegt.

## Aktuell installierter Kundenstand

Am 31. August 2026 wurde der annotierte Tag `v3.5.1` auf dem Mac Studio unter
`/Users/michaelmischkot/Code/polizzenvergleich-v3` installiert. Der aktive
Modellvertrag lautet:

- LM-Studio-ID `qwen/qwen3.6-35b-a3b`;
- Qwen 3.6 MLX 4-bit als einzig geladenes Modell;
- exakt 42.496 Token Kontext und Parallelität 1;
- kein automatisch geladenes Qwen-3.8- oder Dinghy-Embeddingmodell;
- automatische Ablage fertiger Vollvergleichsdateien unter
  `/Users/michaelmischkot/Downloads/Projekt Lokale KI/Vergleiche`.

Die externe Rückfallsicherung vor dem Update liegt unter
`/Users/michaelmischkot/Polizzenvergleich-Backups/pre-v3.5.1-20260831-093731`.
Der vorherige Code-Rückfallpunkt ist `v3.4.0` / `977ed40f`.

Diese Fork-Variante ist auf einen einfachen Ablauf für Versicherungsmakler
ausgelegt: normal chatten oder bis zu zwei unterstützte Dokumente in den Chat
ziehen, Frage oder Auftrag eingeben, fertig. Mit einem Dokument erfolgt eine
Einzelanalyse, mit zwei Dokumenten ein Vergleich. Die technische Verarbeitung
läuft threadbezogen im Hintergrund.

Unterstützt werden PDF, DOCX, ODT, TXT, MD, CSV, XLSX und PPTX. Nur PDFs
erhalten physische Seitenangaben; bei den übrigen Formaten werden keine Seiten
erfunden.

## Empfohlene Kundeninstallation

Voraussetzung ist eine einmal gestartete LM-Studio-Installation mit aktivierter
`lms`-CLI. Der private GitHub-Zugriff muss einmalig eingerichtet sein. Danach
lädt und installiert diese einzelne Terminalzeile das Produkt:

```bash
gh repo clone slavko-at-klincov-it/polizzenvergleich-v3 "$HOME/Code/polizzenvergleich-v3" -- --branch v3.5.1 && "$HOME/Code/polizzenvergleich-v3/install.command"
```

Der Installer:

- prüft macOS, Apple Silicon, freien Speicher und LM Studio,
- installiert eine eigene, geprüfte Node-Laufzeit ohne Homebrew oder `sudo`,
- lädt und prüft Qwen 3.6 MLX mit 42.496 Token Kontext und Parallelität 1,
- erzeugt lokale Geheimnisse und schützt Konfiguration und Kundendaten,
- baut Frontend, Server und Collector und führt Produktionsmigrationen aus,
- richtet den lokalen Workspace `Polizzenvergleich` ohne Login ein,
- installiert benutzerspezifische macOS-Autostartdienste,
- führt einen Doctor-Test aus und öffnet erst danach die Oberfläche.

Falls das Modell bereits in LM Studio vorhanden ist:

```bash
"$HOME/Code/polizzenvergleich-v3/install.command" --skip-model-download
```

Beim ersten Lauf werden andere geladene LM-Studio-Modelle standardmäßig
entladen, damit auf dem 32-GB-Mac genug RAM frei ist. Mit
`--keep-loaded-models` lässt sich das bewusst verhindern; der Autostartjob
entlädt später keine fremden Modelle.

LM Studio selbst und die private GitHub-Anmeldung werden bewusst nicht still
installiert oder umgangen. AnythingLLM läuft danach lokal ohne Benutzerlogin.
Server, Collector und LM Studio lauschen ausschließlich auf diesem Mac. Jeder
Prozess im selben macOS-Benutzerkonto kann die lokale Anwendung grundsätzlich
aufrufen; eine gemeinsam oder von nicht vertrauenswürdigen Personen genutzte
macOS-Sitzung ist deshalb ungeeignet.

### Betrieb und Diagnose

Der Installer legt `~/.local/bin/polizzenvergleich` an:

```bash
~/.local/bin/polizzenvergleich status
~/.local/bin/polizzenvergleich doctor
~/.local/bin/polizzenvergleich restart
~/.local/bin/polizzenvergleich open
~/.local/bin/polizzenvergleich logs
```

Updates werden absichtlich nicht direkt von einem veränderlichen `main`-Branch
eingespielt. Dafür wird ein geprüfter Release-Stand mit Sicherungs- und
Rollbackpfad bereitgestellt.

`uninstall.command` entfernt nur Dienste und Starter. Kundendaten werden nicht
automatisch gelöscht. Laufzeitdaten liegen in `server/storage`; Upload-Hotdir,
Konfigurationen und Logs sind nur für den installierenden macOS-Benutzer lesbar.

Die nachfolgenden manuellen Schritte bleiben als Reparatur- und
Entwicklerreferenz erhalten.

## Festgelegtes Start-Setup für den 32-GB-Mac

- Produktives Chatmodell: Qwen 3.6 35B A3B, MLX 4-bit, LM-Studio-Key
  `qwen/qwen3.6-35b-a3b`, exakt 42.496 Runtime-Tokens und Parallelität 1.
- Kein automatisch geladenes separates Embeddingmodell; der produktive
  Vergleichspfad setzt Qwen 3.8 und Dinghy nicht voraus.
- Modellserver: LM Studio
- Vektordatenbank: LanceDB; andere Vektordatenbanken werden für den sicheren
  Vergleich absichtlich abgelehnt
- Kontextfenster: exakt 42.496 Tokens; ein anderer Runtime-Wert blockiert den
  Vergleich vor der PDF-Verarbeitung
- OCR: Deutsch und Englisch, maximal zwei Worker
- Suche: exakte Volltextsuche/BM25 und semantische Suche, getrennt für Dokument
  A und Dokument B

Für den produktiven Vollvergleich sind Modell-ID, 42.496 Runtime-Tokens und
Parallelität 1 Teil des fail-closed Laufzeitvertrags. Eine abweichende
LM-Studio-Konfiguration ist für diesen Pfad nicht freigegeben.

TurboQuant ist keine Voraussetzung. Es wird in diesem Stand weder benötigt
noch von LM Studio als einfache produktive Option vorausgesetzt.

Zum Wechsel zuerst das gewünschte LLM in LM Studio laden; die AnythingLLM-
Auswahl zeigt ausschließlich geladene Chatmodelle und niemals `dinghy-embed`.
Auf einem 32-GB-Mac das bisherige Chatmodell vorher in LM Studio entladen, damit
nicht zwei große LLMs gleichzeitig Speicher belegen; die Einstellungsseite
bleibt währenddessen erreichbar.
Danach das Modell und sein Kontextfenster unter den LM-Studio-Einstellungen
speichern und einmal `~/.local/bin/polizzenvergleich restart` ausführen.
Alias und physischer Modell-Key werden gemeinsam gespeichert. Autostart und
Doctor laden beziehungsweise prüfen danach genau diese Auswahl. Beim Neustart
wird nur das zuvor von der Anwendung verwaltete Chatmodell entladen; Dinghy und
LanceDB bleiben unberührt. Reasoning-Modelle werden unterstützt, können die
Inventarbildung jedoch deutlich verlängern; für den produktiven Vergleich ist
Reasoning `off` weiterhin die Empfehlung.

## Was der Makler sieht

1. Workspace `Polizzenvergleich` öffnen.
2. `New Thread` ist nicht manuell erforderlich: Beim ersten Dokument wird automatisch
   ein echter Thread erzeugt.
3. Kein, ein oder zwei unterstützte Dokumente hineinziehen.
4. Bei Anhängen warten, bis alle Chips `Bereit` zeigen. `Bereit` bezeichnet den
   schnellen Basisindex aus OCR/Text, FTS und Dinghy/Lance.
5. Im derzeitigen `v0.3.22`-Stand noch keine Dokumentfrage im Kundenbetrieb
   absenden: Der Retriever startet sonst vor der Antwort den noch zu teuren
   vollständigen Faktenlauf.
6. Nach Veröffentlichung des occurrence-zentrierten Pfads werden konkrete
   Fragen wieder direkt aus vollständigen Clause-FTS-Treffern,
   deterministischen Signalen und Dinghy beantwortet; Qwen prüft dann nur
   verbleibende ambige Klauselgruppen.

Alte Kundendokumente werden nicht in neue Vergleiche einbezogen. Das Löschen
eines Vergleichsthreads entfernt die zugeordneten Vergleichsdokumente,
Vektoren und Volltexttreffer aus der aktiven Anwendung. Dateisystem-Backups und
historische technische Metadaten unterliegen dem lokalen Backup- und
Aufbewahrungskonzept; eine sichere SSD-Löschung wird nicht versprochen.

## Manuelle Einrichtung und Reparatur

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

Nicht `max_context_length` als AnythingLLM-Kontextwert übernehmen. Für das
empfohlene Standardmodell verwendet dieser Release aus Speicher- und
Stabilitätsgründen 32.768 AnythingLLM-Tokens; LM Studio darf per MLX-Auto-Fit
einen höheren effektiven Runtime-Wert anzeigen.

### 2. AnythingLLM-Umgebung

Aus `server/.env.example` eine lokale `server/.env` anlegen. Geheimnisse und
Storage niemals committen. Die relevanten Werte sind:

```dotenv
SERVER_PORT=3002
STORAGE_DIR='/absoluter/pfad/zu/privatem/anythingllm-storage'
COLLECTOR_HOTDIR_PATH='/absoluter/pfad/zum/repo/collector/hotdir'
AUTH_TOKEN=''
POLICY_SINGLE_USER_NO_AUTH='true'

LLM_PROVIDER='lmstudio'
LMSTUDIO_BASE_PATH='http://127.0.0.1:1234/v1'
LMSTUDIO_MODEL_PREF='qwen/qwen3.8-27b'
LMSTUDIO_MODEL_TOKEN_LIMIT=32768

MODEL_TOKENIZER_PATH='/absoluter/pfad/zum/chatmodellordner-mit-tokenizer.json'
MODEL_TOKENIZER_LABEL='qwen/qwen3.8-27b'

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

- Der normale Chat funktioniert ohne Dokument. Dokumentanalyse ist mit einem
  oder zwei erfolgreich indexierten Dokumenten möglich.
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
- Der Basisindex ist von der vollständigen Faktenanalyse getrennt. Ein
  Analysefehler löscht weder OCR/Text noch FTS noch LanceDB.
- Clause Blocks, Signale, Embedding-Zuordnungen, Fakten und Evidenzen werden
  run-scoped staged. Erst ein vollständig validierter Lauf ersetzt den zuletzt
  veröffentlichten Snapshot atomar.
- Der bisherige automatische vollständige Faktenlauf bei der ersten Frage ist
  als Produktionspfad verworfen. Der nächste Pfad enumeriert konkrete Themen
  vollständig über Clause-FTS und ergänzt sie semantisch mit Dinghy, ohne einen
  Qwen-Vollscan vorauszusetzen.

## Abnahmetest am Kundenrechner

Die folgende Abnahme ist erst nach Veröffentlichung des neuen
occurrence-zentrierten Pfads auszuführen. `v0.3.22` erhält wegen der gemessenen
Vollanalyse-Laufzeit keine fachliche Produktivfreigabe.

1. Ein synthetisches oder freigegebenes PDF-Paar mit bekannten Fundstellen
   verwenden; keine Kundendaten in Support-Chats kopieren.
2. Zuerst den vertikalen Pfad `Ermittle alle Selbstbehalte` prüfen: vollständige
   Trefferenumeration, Betrag, Bedingung, Variante und physische Seite; kein
   vollständiger Analysis Run und keine globale Top-N-Kürzung.
3. Danach mindestens je eine Fundstelle für Ausschluss, Geldbetrag,
   Prozentwert, Obliegenheit und eine seltene Deckung wie Vandalismus prüfen.
4. Eine Fundstelle muss auf einer gescannten Seite liegen, damit selektives OCR
   geprüft wird.
5. Seitennummern im PDF visuell gegen die Antwort vergleichen.
6. Während Upload, Indexierung und Antwort ausführen:

   ```bash
   lms ps
   memory_pressure
   sysctl vm.swapusage
   ```

7. Abnahme nur bei stabilem Prozess, grünem Speicherdruck und keinem stetig
   wachsenden Swap. Falls Q6 zu knapp ist, zuerst Dinghy Q4_K_M gegen Q6 messen;
   nicht das Kontextfenster erhöhen.
8. Einen Thread löschen und danach kontrollieren, dass seine PDFs in einem neuen
   Thread weder als Treffer noch als Quelle auftauchen.

## Entwicklerprüfung

Der vollständige, repository-spezifische Release-Gate-Lauf ist:

```bash
/bin/bash scripts/macos/tests/run.sh
git diff --check
```

Während einer Implementierung werden zunächst nur die unmittelbar betroffenen
fokussierten Tests ausgeführt. Das vollständige Gate wird vor einem Release
genau einmal ausgeführt. Zusätzlich ist die dokumentierte reale Laufzeit- und
Coverage-Abnahme verpflichtend; grüne Unit-Tests allein genügen nicht.

Der Modellvergleich BGE-M3 gegen Dinghy bleibt ein Abnahmetest, keine Annahme:
Dinghy ist für deutsches Recht plausibel, aber nicht speziell für österreichische
Versicherungspolicen belegt. Die exakte Suche und die Dokumentisolation sind
daher unabhängig vom ausgewählten Embedder umgesetzt.
