# Polizzenvergleich – Tests, Messwerte und Entwicklungserkenntnisse

Stand: 24. August 2026
Letzte ausgewertete Version: `policy-v0.3.22` (`17a556dc`)

## 1. Zweck

Dieses Dokument trennt vier Arten von Evidenz:

1. automatisierte Tests,
2. synthetische fachliche Golden Cases,
3. reale technische Messungen am 32-GB-Kunden-Mac,
4. Annahmen, die noch nicht bewiesen sind.

Ein grüner Test darf nicht als Beleg für reale Laufzeit oder fachliche
Vollständigkeit umgedeutet werden.

## 2. Referenzumgebung

### Kunden-Mac

- Apple Silicon, M2 Max,
- 32 GB Unified Memory,
- lokaler LM-Studio-Daemon über CLI/API, kein LM-Studio-Frontend erforderlich,
- AnythingLLM-Server `127.0.0.1:3002`,
- Collector `127.0.0.1:8888`,
- LM Studio `127.0.0.1:1234`,
- lokale Single-User-Installation ohne Login.

### Empfohlener Modellvertrag

| Rolle | Modell | Identifier | Speicher | Vertrag |
| --- | --- | --- | ---: | --- |
| Chat/Analyse | Qwen 3.8 27B MLX 4-bit | `qwen/qwen3.8-27b` | ca. 16,08 GB installiert; ca. 14,98 GB geladen | Kontext mindestens 32768, Parallelität 1 |
| Embedding | Dinghy-Law-4B-v1 Q6 | `dinghy-embed` | ca. 3,31 GB | exakt 2560 Dimensionen |
| Alternative, nicht Standard | Gemma 4 26B A4B | `gemma` | ca. 15,64 GB | technisch lauffähig, nicht fachlich freigegeben |

Qwen und Gemma dürfen auf dem 32-GB-Mac nicht gleichzeitig geladen werden.
Dinghy und genau ein Chatmodell dürfen geladen sein. Auch bei geladenen
Modellen dürfen Qwen-Generierung und Dinghy-Embedding nicht gleichzeitig aktiv
rechnen.

## 3. Reale Dokumentcharakteristik, anonymisiert

Die Originaldokumente dürfen nicht committed werden. Zulässig sind ausschließlich
folgende anonymisierten Struktur- und Messwerte.

| Merkmal | Dokument A | Dokument B |
| --- | ---: | ---: |
| ungefährer Textumfang | 86.543 Zeichen / ca. 87,9 KB | 69.898 Zeichen / ca. 71,3 KB |
| Wortzahl ungefähr | 10.219 | 8.833 |
| physische Struktur | 21 Seiten | ungefähr 33, über Page-Map zu bestätigen |
| Charakter | kurze, sehr dichte Polizze mit Bedingungsanhang | längere, ungleich gefüllte Rahmenvereinbarung |
| sichtbares `Vandalismus` | 0 | 3 |
| sichtbares `Selbstbehalt` | 3 | 5 |
| sichtbares `Erstes Risiko` | 41 | 17 |
| sichtbares `Versicherungssumme` | 26 | 50 |

Dokument A enthält zwei gedruckte Seitennummernkreise. Dokument B enthält
unzuverlässige Footer-/Seitentextartefakte. Deshalb ist ausschließlich die
kanonische physische Page-Map eine zulässige Quellenbasis.

## 4. Fachliche Golden Cases

### 4.1 Vandalismus-Asymmetrie

Dokument A:

- keine belegte allgemeine Vandalismusfundstelle,
- Einbruch-bedingte Gebäudebeschädigung darf nicht als allgemeine
  Vandalismusdeckung klassifiziert werden.

Dokument B besitzt unter einem Themencluster getrennte Fakten:

1. Deckung,
2. `1 %`, maximal `EUR 10.000`,
3. `EUR 500` Selbstbehalt,
4. Einbruch-/Raub-Abgrenzung,
5. Graffiti-Ausschluss,
6. Melde-/Polizeiobliegenheit.

Keine dieser Rollen darf nur aufgrund des gemeinsamen Labels „Vandalismus“
dedupliziert werden.

### 4.2 Selbstbehalte und Limits

Die Referenzstruktur enthält belegte Selbstbehalte und
Höchstentschädigungen. Ein reales Fehlresultat lautete dennoch „keine belegte
Fundstelle“, obwohl der Text zahlreiche Vorkommen von Versicherungssumme,
Sublimit und Höchstentschädigung enthält.

Die damalige Root Cause lag in der Query-Aufbereitung: Ausgabeanweisungen wie
`Betrag`, `physische`, `PDF`, `Seite` wurden als zwingende fachliche Qualifier
behandelt. Der ALL-Match filterte echte Treffer aus. Zusätzlich enthielt eine
Vandalismus-Suchanfrage Füllwörter wie `durch`, `nach` und `Seite`, wodurch
irrelevante Seiten als lexikalische Treffer akzeptiert wurden.

Diese Erkenntnis ist allgemein:

- Suchthema, fachliche Bedingung und Ausgabeanweisung müssen getrennt werden.
- Exakte Auto-Akzeptanz darf nur auf fachlichen Core Terms beruhen.
- Chat-History darf ein neues Thema nicht mit dem vorherigen Themenheader
  überschreiben.

## 5. Reale Laufzeitmessungen

### 5.1 Gemma-Gesundheitsprüfung

Gemma verwendete standardmäßig Reasoning. Ein Smoke-Test mit nur `12`
Ausgabetokens verbrauchte seine Tokens im verborgenen Reasoning und lieferte
keinen sichtbaren Inhalt. AnythingLLM blieb deshalb am Start-Gate stehen, obwohl
ein direkter Call mit `256` Tokens korrekt `bereit` ausgab.

Erkenntnis:

- Health Checks müssen sichtbaren Content verlangen,
- das Budget muss Reasoningmodelle berücksichtigen,
- `reasoning_content` allein ist kein betriebsfähiger Chatoutput,
- ein fehlgeschlagener Health Check erzeugt kaskadierend die Doctor-Fehler
  „LM-Studio-Modellprüfung“, „Server nicht erreichbar“ und „Port 3002“.

### 5.2 Gemma-Inventar

Ein gemessener Batch:

| Kennzahl | Messwert |
| --- | ---: |
| Input | 7.616 Tokens |
| Output | 1.535 Tokens |
| Dauer | 90,0 Sekunden |
| Durchsatz | 16,9 Tokens/s |
| Ergebnis | unvollständiges JSON am damaligen Limit |

Bei fünf solchen Batches ergeben sich bereits ungefähr 7,5 bis 10 Minuten pro
Dokument. Korrekturversuche können die Laufzeit verdoppeln. Kleinere
Inputbatches stabilisieren JSON, reduzieren aber nicht automatisch die gesamte
zu generierende Faktmenge.

### 5.3 Qwen-Faktenlauf `policy-v0.3.22`

Der erste Lauf ohne sofortigen Format-/Groundingabbruch zeigte:

| Status | Blöcke |
| --- | ---: |
| Gesamt | 690 |
| `deterministic_facts` | 45 |
| `model_validated_facts` | 46 |
| `model_verified_no_fact` | 22 |
| `ambiguous_pending` | 577 |

Die elf beobachteten Modellaufrufe mit Batchgröße `4` wurden technisch
erfolgreich beendet. Ihre Providerzeiten summierten sich auf ungefähr
`446 Sekunden` beziehungsweise `7 Minuten 26 Sekunden`. Einzelne Calls lagen
zwischen etwa `18` und `73 Sekunden`.

Nach 113 terminalen Blöcken waren noch 577 offen. Eine lineare Extrapolation
ergab deutlich über eine Stunde Restlaufzeit, zusätzliche Zweitprüfungen noch
nicht eingerechnet.

Erkenntnis:

- Queue und Receipt-Binding funktionierten,
- der Lauf hing nicht technisch,
- die deterministische Terminalquote war unzureichend,
- die Architektur war trotz grüner Tests betrieblich nicht tragfähig.

## 6. Fehlerchronik und Root Causes

| Symptom | Root Cause | Status in `v0.3.22` | Bleibende Lehre |
| --- | --- | --- | --- |
| Qwen und Gemma gleichzeitig im Speicher | Modellwechsel lud neues Modell, ohne altes sicher zu entladen | behoben/fail-closed | genau ein Chatmodell laden |
| Doctor meldet Gemma ohne Antwort | Smoke-Ausgabe mit 12 Tokens vollständig im Reasoning verbraucht | behoben, Budget 256 | sichtbaren Output prüfen |
| Qwen-Tokenizerwarnung nach Gemma-Wechsel | stale `MODEL_TOKENIZER_PATH` | nicht blockierend, Konfigurationsrefresh vorhanden | Tokenizer ist advisory; keine falsche Modellbeschriftung |
| Upload wirkt endlos | Basisindex fertig, synchrones LLM-Inventar läuft weiter | Basis getrennt, aber erste Frage erzwingt Analyse erneut | Analyse nie mit Basisindex gleichsetzen |
| `Policy model call timed out` | zu große/zu lange generative Batches | Queue stabilisiert, Grundkosten bleiben | Timeout ist keine Performancearchitektur |
| unvollständiges JSON | Outputlimit bei klauseldichtem Batch erreicht | kompakteres Mapping/Split-Logik | großen Volltext-JSON-Output vermeiden |
| vier Evidenzen nicht wortgetreu | Modell paraphrasierte Belege | strikte Evidence-Prüfung | Zitat/Offsets serverseitig besitzen |
| `Failed to decode batch` bei Dinghy | konkurrierende Modell-/Embeddinglast vermutet | gemeinsame Queue | lokale Ressourcen global serialisieren |
| `createMany ... does not match any query` | Prisma-/SQLite-Kompatibilitätslücke | in `v0.3.19` durch Einzelwrites behoben | SQLite-Livepfad testen, nicht nur Mocks |
| `Inventory JSON contains an unsupported value` | nicht unterstützte Faktwerte aus Modelloutput | Normalisierung gehärtet | Modellwerte nie ungeprüft persistieren |
| Topic `Versicherer-Identifikation` nicht grounded | administratives Modelllabel und atomare Unit-Validierung | Metadatenfilter/Partial Accept | Metadaten nicht als Deckungsfakt behandeln |
| Topic `Firmenbuchnummer` nicht grounded | `FN` im Text, abstraktes Modelllabel | Metadatenfilter | keine Alias-Patches pro Modellwort |
| `unknown unitKey` | Modell kopierte/längte Blockhash fehlerhaft | kurze `b1..b4` IDs + Evidence-Rebinding | Modell-IDs nie als alleinige Identität vertrauen |
| 577 Blöcke nach Minuten noch offen | fast gesamter Inhalt wird als ambig an Qwen delegiert | **nicht behoben** | Vollmapper aus kritischem Pfad entfernen |

## 7. Release-Lernhistorie

### Infrastruktur und Modellbetrieb

| Release | Absicht | Ergebnis/Lehre |
| --- | --- | --- |
| `v0.3.0` | Dokumentworkflow härten | Basis für threadisolierten A/B-Workflow |
| `v0.3.1` | Kunden-Qwen-Vertrag | Modellvariante und Kontext festgelegt |
| `v0.3.2` | macOS Runtime | lokales Bootstrap repariert |
| `v0.3.3` | MLX Auto-Fit | effektiven größeren Kontext akzeptieren, Mindestkontext weiter prüfen |
| `v0.3.4` | sicherer No-Login-Modus | lokaler Single-User-Betrieb ohne Login |
| `v0.3.5` | Chatmodell selbst wählbar | alternative Chatmodelle möglich, Dinghy-Vertrag unverändert |

### Erstes generatives Vollinventar

| Release | Absicht | Ergebnis/Lehre |
| --- | --- | --- |
| `v0.3.6` | Reasoning für Inventar deaktivieren | behebt Reasoningkosten, nicht Gesamtmenge |
| `v0.3.7` | Evidence-Retry korrigieren | einzelne Validierungsfehler besser isoliert |
| `v0.3.8` | JSON-Recovery | Syntax reparierbar, Semantik/Evidenz weiter streng |
| `v0.3.9` | Inferenz begrenzen | verhindert ungebremste Calls, löst Vollscan nicht |
| `v0.3.10` | Indexing stabilisieren | Basis- und Inventarfehler besser getrennt |
| `v0.3.11` | dichten Output erhalten | höhere Faktmenge verschärft Generationszeit |
| `v0.3.12` | Inferenzkosten reduzieren | weniger Batches, aber dichte Outputs bleiben teuer |
| `v0.3.13` | Trunkierung verhindern | 2048 Outputtokens erhöhen mögliche Callzeit |

### Dual Mode und atomare Faktenpipeline

| Release | Absicht | Ergebnis/Lehre |
| --- | --- | --- |
| `v0.3.14` | Tiefeninventar optional | Basisfragen konnten grundsätzlich entkoppelt werden |
| `v0.3.15` | Releasevorbereitung | kein grundlegender Architekturwechsel |
| `v0.3.16` | vollständige belegte Tabellen | server-owned Row Coverage eingeführt |
| `v0.3.17` | kurze Prompts analysieren | Regression: erste Frage erzwingt wieder Vollanalyse |
| `v0.3.18` | dichte Heading-Pfade | Quellen-/Gruppierungskontext verbessert |
| `v0.3.19` | SQLite-Faktenpipeline | Live-DB-Schreibpfade stabilisiert |
| `v0.3.20` | isolierte Groundingkorrektur | Korrektur konnte weiter in Split-/Retrypfad fallen |
| `v0.3.21` | Grounding non-fatal | Partial Accept und Metadatenfilter verbessert |
| `v0.3.22` | Receipt an Quellblock binden | `unknown unitKey` gehärtet; reale Laufzeit bleibt untragbar |

Die zentrale Lehre der Historie: Ab `v0.3.6` wurden wiederholt Symptome eines
zu großen generativen Vollinventars behoben. Ab `v0.3.14` war der richtige
Dual-Mode kurz vorhanden; `v0.3.17` führte die Vollanalyse für kurze Prompts
wieder in den kritischen Pfad ein. Diese Entscheidung wird nicht fortgeführt.

## 8. Was die automatisierten Tests tatsächlich beweisen

Der vollständige Gate-Lauf für `policy-v0.3.22` war grün:

- 43 Suites,
- 296 Tests.

Wesentliche Testbereiche:

### Collector und Coverage

- 21 physische Seiten lückenlos abgedeckt,
- keine Cross-Page-Primärblöcke,
- keine erfundene Seite für Non-PDF,
- Layoutgrenzen aus nativen Spans,
- dichte Heading-Pfade,
- selective OCR fail-closed.

### FTS, Dinghy und Isolation

- exakte deutsche Clause-FTS-Treffer,
- 198-Seiten-Fixture findet seltene späte Klausel,
- A/B und identische Dateinamen bleiben thread-/dokumentisoliert,
- Aliasgruppen sind versioniert und additiv,
- FTS verwendet kein implizites Stemming,
- Clause-Dinghy besitzt genau ein run-scoped Ledger pro Block,
- falsche Dimension wird vor LanceDB abgelehnt,
- semantische Links sind auf die Vector-IDs eines Runs begrenzt.

### Staging und Datenintegrität

- neuer Lauf löscht Published Snapshot nicht,
- identische Source/Version kann neben Published neu staged werden,
- unterbrochener Lauf wird wiederverwendet,
- Legacy-ready bleibt bei Fehler erhalten,
- Fakten und mehrere Evidenzen sind run-scoped,
- atomarer Pointer-Switch erst nach vollständigen Gates,
- unvollständige Coverage lässt Published Pointer unverändert,
- Cross-Run-Evidence wird abgelehnt,
- Cleanup erfolgt FTS -> Lance IDs -> SQL,
- SQLite-Trigger schützen Published Child-Daten.

### Mapper und Queue

- mehrere Faktrollen aus einem Block,
- risikosignalhaltiges Nullergebnis wird zweitgeprüft,
- Timeout startet keinen parallelen Review,
- harte Inputbudgets,
- administrative Metadaten werden gefiltert,
- unbekannte abstrakte Labels werden source-bound zurückgestuft,
- maximal vier Blocks pro Batch,
- Heading-Pfad im Modellpayload,
- kurze Response-ID wird auf langen Block-Key gemappt,
- beschädigte ID kann über eindeutige exakte Evidenz gebunden werden,
- Queue bleibt nach Caller-Timeout bis Provider-Settlement gesperrt.

### Ausgabe

- Promptspalten und Gliederung bleiben erhalten,
- verwandte Vandalismusrollen werden in einer code-owned Row gruppiert,
- Varianten bleiben getrennt,
- Quellen verwenden alle Belege,
- A/B mit gleichem Fact-Key kollidieren nicht,
- fehlende oder doppelte Fact-Ownership wird abgelehnt.

## 9. Was die Tests nicht bewiesen haben

Der grüne Gate-Lauf bewies **nicht**:

- akzeptable Laufzeit auf einem realen 21-Seiten-Dokument,
- akzeptable Quote deterministisch terminaler Blöcke,
- geringe Zahl tatsächlicher Qwen-Aufrufe,
- dass ein vollständiger Published Run mit Qwen 27B jemals fertig wird,
- dass `4` Blöcke pro Call auf realen Policen wirtschaftlich sind,
- dass ein kleineres Extraktionsmodell fachlich gleichwertig ist,
- vollständige Tabellen-/Variantenzuordnung aus linearisiertem realem PDF-Text,
- dass eine kurze Frage ohne Vollanalyse beantwortet wird,
- dass „alle Selbstbehalte“ ohne Top-N-Verlust funktioniert.

Diese Lücken erklären, warum 296 grüne Tests und ein unbrauchbarer Kundenlauf
gleichzeitig möglich waren.

## 10. Zwingende neue Abnahmemetriken

Jeder künftige Analyse- oder Targeted-Lauf muss mindestens erfassen:

- Seiten und Clause Blocks gesamt,
- deterministisch terminale Blöcke,
- ambige Blöcke,
- Modellbatches erster und zweiter Prüfung,
- Queue-Wartezeit,
- Providerzeit,
- Input-, sichtbare Output- und Reasoningtokens,
- Tokens pro Sekunde,
- Split-, Retry- und Timeoutzahl,
- FTS-Trefferzahl vor und nach Gruppierung,
- Dinghy-Kandidaten und validierte semantische Ergänzungen,
- validierte Fakten je Faktrolle,
- Gesamt-Wall-Clock-Zeit,
- finaler Runstatus.

Zusätzlich sind während Kundenabnahmen Memory Pressure und Swap zu beobachten.
Eine Fortschrittszahl wie `113 / 690` ist aussagekräftiger als ein allgemeiner
Spinner.

## 11. Abnahmekriterien für den nächsten Targeted-Pfad

### Selbstbehalte

- alle exakten Aliasfundstellen enumeriert,
- kein Top-K,
- strukturbezogene Nachbarblöcke/Tabellenkontext,
- Betrag und Bedingung richtig verbunden,
- physische Seite korrekt,
- Dinghy ergänzt belegte Paraphrasen,
- kein Qwen-Vollscan,
- Modellaufrufe nur für ambige Gruppen,
- Ergebniszeilen vollständig server-owned.

### Danach Limits

- Versicherungssumme, Sublimit, Höchstentschädigung, erstes Risiko,
  maximal/bis und Prozentwerte,
- Tabellenkopf-/Variantenscope wird weitergetragen,
- C/D/Premium/Grunddeckung nicht vermischt.

### Danach Vandalismus

- Dokument A bleibt ohne allgemeine Vandalismusbehauptung,
- Dokument B behält alle getrennten Rollen,
- exakte und semantische Kandidaten werden nicht als sichere Abwesenheit
  missbraucht,
- Graffiti-Ausschluss und positive Deckung koexistieren korrekt.

## 12. Diagnosekommandos

### Modelle

```bash
lms ps
lms ls
```

### Dienste

```bash
"$HOME/.local/bin/polizzenvergleich" doctor
"$HOME/.local/bin/polizzenvergleich" restart
"$HOME/.local/bin/polizzenvergleich" stop
```

### Live-Logs

```bash
REPO="$HOME/Code/Polizzenvergleich"

tail -n 0 -F \
  "$REPO/server/storage/logs/server.log" \
  "$REPO/server/storage/logs/server-error.log" \
  "$REPO/collector/storage/logs/collector.log"
```

`tail -F` endet absichtlich nicht. Mit `Ctrl-C` wird nur die Beobachtung
beendet, nicht der Server.

### Dokumentstatus

```bash
REPO="$HOME/Code/Polizzenvergleich"

sqlite3 -header -column "$REPO/server/storage/anythingllm.db" "
SELECT id, slot, status AS basisindex,
       COALESCE(inventoryStatus, '-') AS analyse,
       inventoryItemCount AS fakten,
       substr(COALESCE(error, inventoryError, ''), 1, 180) AS problem
FROM comparison_documents
ORDER BY id DESC
LIMIT 4;
"
```

### Analysefortschritt nach Blockstatus

```bash
REPO="$HOME/Code/Polizzenvergleich"

sqlite3 -header -column "$REPO/server/storage/anythingllm.db" "
SELECT r.id, r.status,
       r.terminalBlockCount || ' / ' || r.expectedBlockCount AS bloecke,
       r.factCount AS fakten,
       substr(COALESCE(r.error, ''), 1, 160) AS problem
FROM comparison_document_analysis_runs r
ORDER BY r.id DESC
LIMIT 3;

SELECT status, COUNT(*) AS anzahl
FROM comparison_document_clause_blocks
WHERE analysisRunId = (
  SELECT id FROM comparison_document_analysis_runs ORDER BY id DESC LIMIT 1
)
GROUP BY status
ORDER BY status;
"
```

Die gruppierten Blockstatus sind im aktuellen Stand verlässlicher als die
denormalisierten Run-Zähler, die während eines laufenden Jobs verzögert wirken
können.
