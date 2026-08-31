# Polizzenvergleich – Tests, Messwerte und Entwicklungserkenntnisse

Stand: 30. August 2026
Letzte ausgewertete Version: V3-Entwicklungsstand `b761e3c4`

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

| Rolle                       | Modell                 | Identifier         |                                       Speicher | Vertrag                                         |
| --------------------------- | ---------------------- | ------------------ | ---------------------------------------------: | ----------------------------------------------- |
| Chat/Analyse                | Qwen 3.8 27B MLX 4-bit | `qwen/qwen3.8-27b` | ca. 16,08 GB installiert; ca. 14,98 GB geladen | Kontext mindestens 32768, Parallelität 1        |
| Embedding                   | Dinghy-Law-4B-v1 Q6    | `dinghy-embed`     |                                    ca. 3,31 GB | exakt 2560 Dimensionen                          |
| Alternative, nicht Standard | Gemma 4 26B A4B        | `gemma`            |                                   ca. 15,64 GB | technisch lauffähig, nicht fachlich freigegeben |

Qwen und Gemma dürfen auf dem 32-GB-Mac nicht gleichzeitig geladen werden.
Dinghy und genau ein Chatmodell dürfen geladen sein. Auch bei geladenen
Modellen dürfen Qwen-Generierung und Dinghy-Embedding nicht gleichzeitig aktiv
rechnen.

## 3. Reale Dokumentcharakteristik, anonymisiert

Die Originaldokumente dürfen nicht committed werden. Zulässig sind ausschließlich
folgende anonymisierten Struktur- und Messwerte.

| Merkmal                         |                                      Dokument A |                                    Dokument B |
| ------------------------------- | ----------------------------------------------: | --------------------------------------------: |
| ungefährer Textumfang           |                    86.543 Zeichen / ca. 87,9 KB |                  69.898 Zeichen / ca. 71,3 KB |
| Wortzahl ungefähr               |                                          10.219 |                                         8.833 |
| physische Struktur              |                                       21 Seiten |      ungefähr 33, über Page-Map zu bestätigen |
| Charakter                       | kurze, sehr dichte Polizze mit Bedingungsanhang | längere, ungleich gefüllte Rahmenvereinbarung |
| sichtbares `Vandalismus`        |                                               0 |                                             3 |
| sichtbares `Selbstbehalt`       |                                               3 |                                             5 |
| sichtbares `Erstes Risiko`      |                                              41 |                                            17 |
| sichtbares `Versicherungssumme` |                                              26 |                                            50 |

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

| Kennzahl  |                                Messwert |
| --------- | --------------------------------------: |
| Input     |                            7.616 Tokens |
| Output    |                            1.535 Tokens |
| Dauer     |                           90,0 Sekunden |
| Durchsatz |                           16,9 Tokens/s |
| Ergebnis  | unvollständiges JSON am damaligen Limit |

Bei fünf solchen Batches ergeben sich bereits ungefähr 7,5 bis 10 Minuten pro
Dokument. Korrekturversuche können die Laufzeit verdoppeln. Kleinere
Inputbatches stabilisieren JSON, reduzieren aber nicht automatisch die gesamte
zu generierende Faktmenge.

### 5.3 Qwen-Faktenlauf `policy-v0.3.22`

Der erste Lauf ohne sofortigen Format-/Groundingabbruch zeigte:

| Status                   | Blöcke |
| ------------------------ | -----: |
| Gesamt                   |    690 |
| `deterministic_facts`    |     45 |
| `model_validated_facts`  |     46 |
| `model_verified_no_fact` |     22 |
| `ambiguous_pending`      |    577 |

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

| Symptom                                           | Root Cause                                                      | Status in `v0.3.22`                                      | Bleibende Lehre                                          |
| ------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Qwen und Gemma gleichzeitig im Speicher           | Modellwechsel lud neues Modell, ohne altes sicher zu entladen   | behoben/fail-closed                                      | genau ein Chatmodell laden                               |
| Doctor meldet Gemma ohne Antwort                  | Smoke-Ausgabe mit 12 Tokens vollständig im Reasoning verbraucht | behoben, Budget 256                                      | sichtbaren Output prüfen                                 |
| Qwen-Tokenizerwarnung nach Gemma-Wechsel          | stale `MODEL_TOKENIZER_PATH`                                    | nicht blockierend, Konfigurationsrefresh vorhanden       | Tokenizer ist advisory; keine falsche Modellbeschriftung |
| Upload wirkt endlos                               | Basisindex fertig, synchrones LLM-Inventar läuft weiter         | Basis getrennt, aber erste Frage erzwingt Analyse erneut | Analyse nie mit Basisindex gleichsetzen                  |
| `Policy model call timed out`                     | zu große/zu lange generative Batches                            | Queue stabilisiert, Grundkosten bleiben                  | Timeout ist keine Performancearchitektur                 |
| unvollständiges JSON                              | Outputlimit bei klauseldichtem Batch erreicht                   | kompakteres Mapping/Split-Logik                          | großen Volltext-JSON-Output vermeiden                    |
| vier Evidenzen nicht wortgetreu                   | Modell paraphrasierte Belege                                    | strikte Evidence-Prüfung                                 | Zitat/Offsets serverseitig besitzen                      |
| `Failed to decode batch` bei Dinghy               | konkurrierende Modell-/Embeddinglast vermutet                   | gemeinsame Queue                                         | lokale Ressourcen global serialisieren                   |
| `createMany ... does not match any query`         | Prisma-/SQLite-Kompatibilitätslücke                             | in `v0.3.19` durch Einzelwrites behoben                  | SQLite-Livepfad testen, nicht nur Mocks                  |
| `Inventory JSON contains an unsupported value`    | nicht unterstützte Faktwerte aus Modelloutput                   | Normalisierung gehärtet                                  | Modellwerte nie ungeprüft persistieren                   |
| Topic `Versicherer-Identifikation` nicht grounded | administratives Modelllabel und atomare Unit-Validierung        | Metadatenfilter/Partial Accept                           | Metadaten nicht als Deckungsfakt behandeln               |
| Topic `Firmenbuchnummer` nicht grounded           | `FN` im Text, abstraktes Modelllabel                            | Metadatenfilter                                          | keine Alias-Patches pro Modellwort                       |
| `unknown unitKey`                                 | Modell kopierte/längte Blockhash fehlerhaft                     | kurze `b1..b4` IDs + Evidence-Rebinding                  | Modell-IDs nie als alleinige Identität vertrauen         |
| 577 Blöcke nach Minuten noch offen                | fast gesamter Inhalt wird als ambig an Qwen delegiert           | **nicht behoben**                                        | Vollmapper aus kritischem Pfad entfernen                 |

## 7. Release-Lernhistorie

### Infrastruktur und Modellbetrieb

| Release  | Absicht                   | Ergebnis/Lehre                                                        |
| -------- | ------------------------- | --------------------------------------------------------------------- |
| `v0.3.0` | Dokumentworkflow härten   | Basis für threadisolierten A/B-Workflow                               |
| `v0.3.1` | Kunden-Qwen-Vertrag       | Modellvariante und Kontext festgelegt                                 |
| `v0.3.2` | macOS Runtime             | lokales Bootstrap repariert                                           |
| `v0.3.3` | MLX Auto-Fit              | effektiven größeren Kontext akzeptieren, Mindestkontext weiter prüfen |
| `v0.3.4` | sicherer No-Login-Modus   | lokaler Single-User-Betrieb ohne Login                                |
| `v0.3.5` | Chatmodell selbst wählbar | alternative Chatmodelle möglich, Dinghy-Vertrag unverändert           |

### Erstes generatives Vollinventar

| Release   | Absicht                             | Ergebnis/Lehre                                     |
| --------- | ----------------------------------- | -------------------------------------------------- |
| `v0.3.6`  | Reasoning für Inventar deaktivieren | behebt Reasoningkosten, nicht Gesamtmenge          |
| `v0.3.7`  | Evidence-Retry korrigieren          | einzelne Validierungsfehler besser isoliert        |
| `v0.3.8`  | JSON-Recovery                       | Syntax reparierbar, Semantik/Evidenz weiter streng |
| `v0.3.9`  | Inferenz begrenzen                  | verhindert ungebremste Calls, löst Vollscan nicht  |
| `v0.3.10` | Indexing stabilisieren              | Basis- und Inventarfehler besser getrennt          |
| `v0.3.11` | dichten Output erhalten             | höhere Faktmenge verschärft Generationszeit        |
| `v0.3.12` | Inferenzkosten reduzieren           | weniger Batches, aber dichte Outputs bleiben teuer |
| `v0.3.13` | Trunkierung verhindern              | 2048 Outputtokens erhöhen mögliche Callzeit        |

### Dual Mode und atomare Faktenpipeline

| Release   | Absicht                       | Ergebnis/Lehre                                              |
| --------- | ----------------------------- | ----------------------------------------------------------- |
| `v0.3.14` | Tiefeninventar optional       | Basisfragen konnten grundsätzlich entkoppelt werden         |
| `v0.3.15` | Releasevorbereitung           | kein grundlegender Architekturwechsel                       |
| `v0.3.16` | vollständige belegte Tabellen | server-owned Row Coverage eingeführt                        |
| `v0.3.17` | kurze Prompts analysieren     | Regression: erste Frage erzwingt wieder Vollanalyse         |
| `v0.3.18` | dichte Heading-Pfade          | Quellen-/Gruppierungskontext verbessert                     |
| `v0.3.19` | SQLite-Faktenpipeline         | Live-DB-Schreibpfade stabilisiert                           |
| `v0.3.20` | isolierte Groundingkorrektur  | Korrektur konnte weiter in Split-/Retrypfad fallen          |
| `v0.3.21` | Grounding non-fatal           | Partial Accept und Metadatenfilter verbessert               |
| `v0.3.22` | Receipt an Quellblock binden  | `unknown unitKey` gehärtet; reale Laufzeit bleibt untragbar |

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

## 13. Vertikale Abnahme Selbstbehalt nach `policy-v0.3.22`

Der neue gezielte Selbstbehalt-Pfad ist durch fokussierte Regressionen
abgesichert:

- derselbe Kundenprompt startet `ensureForDocuments()` nicht,
- sämtliche paginierten Clause-FTS-Treffer werden enumeriert; der Test umfasst
  237 Treffer über drei SQL-Seiten,
- ein und zwei Dokumente bleiben getrennt,
- Betrag, Bedingung, Heading/Variante und physische Seite werden codebasiert
  gerendert,
- ein unmittelbar angrenzender kompatibler Tabellenwert wird übernommen,
  ein Wert auf einer anderen physischen Seite nicht,
- die anonymisierte Goldstandard-Erwartung für Dokument B bleibt in vier
  getrennten Zeilen erhalten: EUR 500, EUR 350, 10 Prozent und 25 Prozent,
- der Pfad meldet `modelCalls: 0`,
- ein veröffentlichter Run wird wiederverwendet und nicht neu gestaged,
- die vorhandenen atomaren Publish-/Evidence-Gates bleiben unverändert.

Der erste fokussierte Stand vor dem vollständigen Release-Gate war 5 Suites /
79 Tests PASS. Die anschließende Systemprüfung zeigte zusätzliche Grenzen, die
in einem Korrekturlauf abgesichert wurden:

- `ledger_ready` bleibt nach Neustart ein fertiger deterministischer Ledger und
  erzeugt keinen falschen Tiefenanalyse-Fehler,
- Targeted-Ledger und Full-Analyse werden pro Dokument serialisiert,
- normale Nachbarabsätze dürfen keine fremden Beträge liefern,
- „selbst zu tragen“ ohne Selbstbehalt-Kontext wird nicht deterministisch als
  Selbstbehalt ausgegeben,
- eine semantische Bestätigung muss ein exaktes, eindeutiges Quellzitat liefern,
- gemischte Themenfragen werden nicht als reine Selbstbehalt-Frage geroutet.

Der fokussierte Korrekturstand umfasst 5 Suites / 83 Tests PASS. Er beweist
weiterhin nicht die reale Erstlaufzeit der vollständigen Clause-Dinghy-
Vorbereitung auf dem Kunden-Mac; diese Messung bleibt vor Freigabe verpflichtend.

Der anschließend genau einmal ausgeführte vollständige technische Gate-Lauf
war grün: 44 Suites / 304 Tests sowie Installer-, additive Migrations-,
LM-Studio-, OCR-, FTS-, Lance- und 2560-Dimensionsverträge PASS.

Nach der Lifecycle-/Ambiguitätskorrektur wurde das vollständige Gate wiederum
genau einmal ausgeführt: 44 Suites / 309 Tests sowie Installer-, additive
Migration-, LM-Studio-, OCR-, FTS-, Lance- und 2560-Dimensionsverträge PASS.
Der neue isolierte Candidate-Resolver-Test war im fokussierten 5-Suite-Lauf
enthalten und wurde anschließend zusätzlich in die künftige Gate-Liste
aufgenommen.

## 14. Lokale Realstruktur-Abnahme des Selbstbehalt-Pfads

**Datum:** 24. August 2026

**Entwicklungsstand:** `9c6e263c`

**Lokales Chatmodell:** Qwen 3.5 4B ausschließlich als technischer Smoke-Test

**Embedding:** Dinghy Law 4B, 2.560 Dimensionen

Als Testquelle diente ein lokal bereitgestellter, nicht versionierter
Dokumenttext mit 87.905 Zeichen. Aus den 21 wiederkehrenden Druckkopfmarken
wurde ausschließlich für diesen lokalen Test ein PDF mit 21 physischen Seiten
rekonstruiert. Die gedruckte Seitennummerierung begann nach `1 von 7` erneut
mit `1 von 14`; sie wurde nicht als physische Provenienz verwendet. Weil die
Quelle bereits linearisiert war, beweist dieser Test nicht die Güte der
Tabellengeometrie des Original-PDFs.

### Messwerte

| Stufe                                              |      Ergebnis |
| -------------------------------------------------- | ------------: |
| Collector und Page-Map                             |  1,2 Sekunden |
| erkannte physische Seiten                          |            21 |
| Modell-Tokens laut lokalem Tokenizer               |    ca. 24.900 |
| Basisindex mit Dinghy                              | 62,9 Sekunden |
| erzeugte Klauselblöcke                             |            79 |
| erstmalige Clause-Embeddings                       |    10 Batches |
| erster gezielter Selbstbehaltlauf inklusive Ledger | 67,3 Sekunden |
| identische Abfrage nach Serverneustart             |  2,6 Sekunden |
| generative Vollinventar-/Fact-Mapper-Aufrufe       |             0 |

Der Run wechselte nach der gezielten Vorbereitung korrekt auf `ledger_ready`.
`comparison_documents.status` blieb `ready`, `inventoryStatus` blieb leer und
ein Serverneustart erzeugte keinen falschen Tiefenanalysefehler. Nach dem Test
wurden Dokument, Thread, Chats, Runs, Clause Blocks, FTS- und Lance-Artefakte
über die Produkt-APIs vollständig entfernt.

### Fachliches Soll für die gefundenen Selbstbehaltstellen

1. Physische Seite 4: Erdbeben-Selbstbehalt `EUR 350`; die daneben genannte
   Jahreshöchstentschädigung `EUR 20.000` ist eine getrennte Faktrolle.
2. Physische Seite 5: Ein vereinbarter Selbstbehalt gilt nicht für
   Personenschäden.
3. Physische Seite 8: Betraglich fixierte Selbstbehalte bleiben trotz
   Wertanpassung unverändert.

Alle drei Fundstellen und physischen Seiten wurden enumeriert. Die erste Zeile
war jedoch fachlich falsch zusammengesetzt: Der Renderer gab sowohl `EUR 350`
als auch `EUR 20.000` als Selbstbehalt aus und übernahm zusätzlich eine weit
entfernte Passage als Bedingung. Die Deckungsposition `Erdbeben` wurde nicht
stabil zugeordnet.

### Root Cause und Entscheidung

Dieser konkrete Fehler stammt nicht vom kleinen Chatmodell. Der Targeted-Pfad
ließ Qwen weder Treffer noch Beträge oder Ergebniszeilen auswählen. Ursache ist
die deterministische Struktur-/Assoziationslogik bei einem dichten, durch
Linearisation zusammengezogenen Klauselblock:

- mehrere fachlich verschiedene Geldbeträge lagen im selben Belegblock,
- der Betrag wurde nicht eng genug an seinen Rollenbegriff gebunden,
- die Bedingungssuche durfte über die lokale Klauselgrenze hinausgreifen.

Ein größeres Qwen-Modell würde denselben bereits falsch zusammengesetzten Fakt
erhalten und ist daher kein Fix. Vor fachlicher Freigabe muss gelten:

- `Selbstbehalt` bindet nur den lokal zugehörigen Betrag,
- `Jahreshöchstentschädigung`, `Versicherungssumme` und `Sublimit` bleiben
  getrennte Rollen,
- Bedingungen stammen nur aus derselben Klausel oder einer nachweislich
  zugehörigen Fortsetzungs-/Tabellenzeile,
- bei Mehrdeutigkeit wird kein Betrag geraten,
- dieser Seite-4-Fall wird anonymisiert als Regressionstest aufgenommen.

**Urteil:** technischer Datenfluss und Laufzeitarchitektur PASS; fachliche
Betrags-/Bedingungszuordnung REVISE. Der vertikale Selbstbehalt-Pfad ist erst
nach dieser Regression kundenfähig.

## 15. Nicht übernommener Rollenbinder-Spike für `FAIL-003`

**Datum:** 25. August 2026

**Scope:** temporärer, am selben Tag wieder entfernter Spike auf Basis
`9c6e263c`; synthetische anonymisierte Klausel und direkt angrenzende
PolicyComparison-Module. Diese Implementierung ist nicht Bestandteil des
aktuellen Arbeitsbaums.

### RED vor der Korrektur

Die dichte Klausel mit `Jahreshöchstentschädigung EUR 20.000`, einer daran
anschließenden Bedingung und `Selbstbehalt EUR 350` reproduzierte zwei Fehler:

- Der deterministische Extractor klassifizierte beide Geldbeträge als
  Selbstbehalt.
- Der Targeted-Renderer übernahm zusätzlich `EUR 20.000` und die fremde
  Bedingung in die Selbstbehaltzeile.

### Im Spike geprüfte Korrekturhypothese

`ComparisonRoleLocalSignalBinder` partitioniert eine belegte Evidenzspanne an
geordneten harten Rollenankern. Geld- und Bedingungssignale gehören zum
lokalen Rollenabschnitt; bei gleichzeitig konkurrierenden Rollenankern wird
fail-closed kein Kandidat geliefert. Extractor und Selbstbehalt-Renderer nutzten
diese reine Grenze im Experiment unabhängig voneinander.

### GREEN im temporären Spike

- Selbstbehaltzeile enthält ausschließlich `350 EUR`.
- `20.000 EUR` bleibt eine getrennte Limitrolle.
- Die zum Limit gehörende Bedingung wird nicht übernommen.
- Konfligierende Rollen am selben Anker liefern keine Betragsbehauptung.
- 3 fokussierte Suites / 18 Tests PASS.
- 6 direkt angrenzende Suites / 75 Tests PASS.
- Gesamt: 9 Suites / 93 Tests PASS.
- `node --check`, Prettier, Katalogvalidator und `git diff --check` PASS.

ESLint war wegen einer bereits vorhandenen ESLint-9-/React-Plugin-
Inkompatibilität (`context.getFirstTokens is not a function`) kein verwertbares
Signal. Es wurde keine breite Release-Suite ausgeführt.

### Beweisgrenze

Der Test verwendet eine linearisierte synthetische Klausel. Er beweist weder
Original-PDF-Tabellengeometrie noch Seitenfortsetzungen, Kundenhardware,
Laufzeit oder die Erkennung unbekannter Rollenformulierungen. Er beweist auch
nicht, dass dieser Binder die beste Zielarchitektur oder der bestehende Branch
die richtige Implementierungsbasis ist.

Nach der Nutzerkorrektur wurde der Spike vollständig aus Produktcode und Tests
entfernt. `FAIL-003` bleibt im aktuellen Produktcode offen. Dauerhaft übernommen
wird ausschließlich die Erkenntnis: Rollenpartitionierung und fail-closed
Mehrdeutigkeitsbehandlung sind eine plausible, später gegen andere Varianten
und Realstruktur zu prüfende Hypothese.

## 16. Original-AnythingLLM: Default-N32-Vollkontextprobe

**Datum:** 25. August 2026

**Scope:** unverändertes Original-AnythingLLM auf dem Kunden-Mac-Studio, ein
ungepinntes und mit Dinghy indexiertes 21-seitiges Referenzdokument, derselbe
breite Vollanalyseprompt, Temperatur 0, Search Preference `Default`, maximale
Kontext-Snippets 32 und neuer leerer Chat. Die Rohdaten bleiben wegen
Dokument- und Vertragsinhalten außerhalb des Repositorys.

### Ungültiger Vorlauf und Root Cause

Ein erster instrumentierter N32-Vorlauf zeigte zwar den letzten Kontextmarker
`[END CONTEXT 31]`, Qwen verarbeitete aber nur 2.450 Prompttokens. Der
Embeddingrequest verwendete korrekt `dinghy`; der Chatrequest wurde
versehentlich ebenfalls mit `model=dinghy` gesendet und von LM Studio dennoch
mit Qwen ausgeführt. Dieser Lauf ist wegen der dadurch ausgelösten
Promptkompression kein gültiger N32-Qualitätsbeleg.

Nach Korrektur der Chatmodell-ID auf `qwen` blieben Index, Prompt, Search,
Top-N und Temperatur unverändert.

### Technische Messung des korrigierten Laufs

| Messwert                             |                   Ergebnis |
| ------------------------------------ | -------------------------: |
| Query-Embedding                      |   `dinghy`, 3,283 Sekunden |
| Chatmodell                           | Alias `qwen`, Qwen 3.8 27B |
| letzter sichtbarer Kontextmarker     |                         31 |
| uncached Prompttokens                |                     29.882 |
| reales geladenes Qwen-Kontextfenster |                     42.496 |
| Promptverarbeitung                   |           364,479 Sekunden |
| Chatrequest bis Streamende           |           956,062 Sekunden |
| End-to-End ab Query-Embedding        |           959,622 Sekunden |
| Runtimefehler                        |             keine sichtbar |

Der frühere 2.450-Token-Kollaps trat nicht erneut auf. Der Server meldete ein
sauberes Streamende. Finish-Reason, Outputtokenzahl, vollständige Chunkkörper,
Chunk-IDs und Retrievalscores sind im LM-Studio-Log weiterhin nicht sichtbar.

### Antwortmessung

| Messwert                                 |                  Ergebnis |
| ---------------------------------------- | ------------------------: |
| Tabellenzeilen                           |      98, alle achtspaltig |
| eindeutige Positionsnamen                |                        75 |
| exakt identische Duplikatzeilen          |                         0 |
| Klauselcodes in der Antwort              |                  0 von 51 |
| Quellen mit Klausel- oder Punktnummer    |                  0 von 98 |
| Quellen mit unmöglichen Seiten 22 bis 29 |                        15 |
| Premiumklassifikation                    | 98 von 98 unbelegt `nein` |

Positiv wurden nahezu alle Leitungswasseranker, die konkrete negative
Glasfassadenangabe, die korrekte Wirkungsrichtung bei blitzbedingt
umstürzenden Bäumen oder Masten sowie die zentralen Erdbeben- und
Hochwasserwerte einschließlich Selbstbehalt, 72-Stunden-Regel, Karenz und
Kumulgrenzen gefunden.

Die Hard-Gates wurden dennoch nicht bestanden:

- Das Terrorlimit wurde rollenverkehrt als Poolgrenze bezeichnet; das
  getrennte Poollimit fehlte.
- Einbruchdiebstahl erhielt trotz Pflichtgliederung keinen eigenen Abschnitt.
- Die spartenübergreifende Tabelle überdehnte mehrere Leistungen auf Glas.
- Haftpflichtbedingungen, Ausschlüsse, Subsidiarität, mitversicherte Personen
  und die Personenschaden-Selbstbehaltsregel blieben unvollständig.
- Vorschlagsseiten und die neu beginnende Seitennummerierung des
  Bedingungsanhangs wurden nicht sauber getrennt.
- Fehlende Inhalte wurden still ausgelassen statt als unaufgelöst sichtbar zu
  bleiben.

### Urteil und Beweisgrenze

**Urteil:** `REVISE`. Default-N32 beseitigt einen großen beobachteten
Kontextzufuhrengpass und liefert den bisher breitesten technisch validen
Ein-Prompt-RAG-Lauf. Der monolithische Qwen-Output ist trotzdem weder
beweissicher noch kundenfähig.

Dieser Lauf beweist nicht, dass alle 32 Chunkkörper unverändert ankamen, dass
die Antwort vollständig ist oder dass ein anderes Chatmodell beziehungsweise
ein anderer Prompt dieselben Fehler erzeugt. Er bestätigt jedoch erneut
`INV-003` und `INV-004`: Ein Pfad mit Vollständigkeitsanspruch darf seine
Ergebniszeilen, Rollen, Negativzustände und Quellen nicht allein aus einer
freien Modellgeneration ableiten.

**Nächster kontrollierter Test:** Bei unverändertem Dinghy-Index,
Default-N32, Temperatur 0 und identischem Prompt nur das Chatmodell wechseln.
Wenn auch der zweite Generator die Hard-Gates für Quellen, Premiumrolle,
Terror, Spartenabgrenzung und Pflichtsektionen verfehlt, wird der
monolithische Ein-Prompt-Volloutput zugunsten abschnittsweiser Extraktion und
eines getrennten Auditpasses verworfen.

### Generator-A/B mit Gemma 4 26B A4B

Der kontrollierte Folgelauf änderte nur das Chatmodell von Qwen auf den Alias
`gemma`. Dinghy-Index, ungepinnter Transfer, Default-N32, Temperatur 0,
Analyseprompt und leerer Chat blieben gleich. Gemma war real mit 80.128
Kontexttokens geladen; AnythingLLM blieb auf 65.536 begrenzt. Der Prompt lag
mit 30.524 Tokens innerhalb beider Grenzen.

| Messwert                                   |      Qwen |     Gemma |
| ------------------------------------------ | --------: | --------: |
| uncached Prompttokens                      |    29.882 |    30.524 |
| End-to-End ab Query-Embedding              | 959,622 s | 634,155 s |
| Promptverarbeitung                         | 364,479 s |  75,447 s |
| Tabellenzeilen                             |        98 |        45 |
| eindeutige Positionsnamen                  |        75 |        37 |
| Leitungswasserzeilen                       |        31 |         5 |
| Sturmzeilen                                |        18 |         4 |
| echte Klauselcodes irgendwo in der Antwort |  0 von 51 | 23 von 51 |
| Quellen mit vollständigem Quellvertrag     |         0 |         0 |

Das Modellrouting war korrekt: Query-Embedding an `dinghy`, Chatrequest an
`gemma`, Runtimeausführung durch Gemma, letzter sichtbarer Kontextmarker 31,
kein Cachetreffer und kein geloggter Runtime- oder Kontextfehler. Gemma war
End-to-End 33,9 Prozent schneller; mangels Outputtokenzahl ist dies kein
isolierter Decode-Speed-Beweis.

Gemma behandelte die Einzelprämienrolle vorsichtiger und erhielt mehrere echte
Klauselcodes als Auditanker. 33 der 45 Werte waren allerdings durch den
Tippfehler `nicht erkennant` formwidrig. Drei Glas-Codes waren verstümmelt.

Fachlich entstand eine deutliche Regression der Breiten-Proxys:

- die konkrete Angabe `keine Glasfassade vorhanden` fehlte;
- Einbruchdiebstahl fehlte sowohl als Pflichtabschnitt als auch inhaltlich;
- fast alle Leitungswasseranker und Sublimits verschwanden;
- Sturm blieb ohne Erdbebenbetrag, Selbstbehalt, 72-Stunden-Regel,
  Kumulgrenze, Niederschlag, Hochwasser und Karenz;
- Vertragslimit und Poolgrenze für Terror fehlten;
- Gebäudesumme, spartenübergreifende Summen und große Teile der
  Haftpflichtbedingungen blieben aus;
- keine der 45 Quellenzellen erfüllte Dokumentname, Abschnitt,
  Klausel-/Punktnummer und eindeutige Seite gemeinsam.

**Urteil:** `REVISE`. Qwen bleibt in diesem Setup der Generator mit den
höheren Breiten-Proxys; Gemma ist schneller und stellenweise vorsichtiger, verliert
aber zu viele kritische Deckungsinhalte. Weder Generator besteht die
fachlichen und quellenbezogenen Hard-Gates.

Der Generator-A/B schließt die für Abschnitt 16 formulierte nächste
Beweisfrage: Ein isolierter Modellwechsel löst den monolithischen
Ein-Prompt-Volloutput nicht. Weitere freie Modell-, Top-N- oder
Search-Variationen werden daher gestoppt. Der nächste Prüfpfad ist eine
abschnittsweise Mehrpass-Extraktion mit getrenntem Quellen- und
Vollständigkeitsvalidator, beginnend mit dem Leitungswasser-Golden-Case. Ein
einziger sichtbarer Nutzerauftrag darf dabei mehrere kontrollierte interne
Schritte auslösen; er ist nicht mit nur einem freien Modellaufruf
gleichzusetzen.

## 17. Original-AnythingLLM: vollständige Built-in-Konfigurationskampagne

**Beobachtungsfenster:** 24. bis 25. August 2026

Dieser Abschnitt ergänzt Abschnitt 16 um die zuvor nur in einzelnen
Chat- und Laufanalysen vorhandenen Vorläufe. Das maschinenlesbare,
datenschutzgeprüfte Register liegt unter
[`experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json`](./experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json).
Rohdokument, Rohprompts, vollständige Antworten und Logs werden nicht
versioniert.

### Gemeinsamer Versuchsrahmen

- unverändertes Original-AnythingLLM mit LM Studio auf dem Kunden-Mac-Studio,
- ein 21-seitiges Wohngebäude-Angebot mit Bedingungsanhang,
- derselbe breite Vollinventarprompt und pro Lauf ein neuer leerer Chat,
- LanceDB, Workspace-Vektorzahl 32, Ähnlichkeitsschwelle 0,
- AnythingLLM-Kontextfenster 65.536 und Chunkobergrenze 8.192 **Zeichen**,
- Qwen 3.8 27B; bei Embedderwechsel von AnythingLLM erzwungene
  Neuindexierung,
- ungepinnte Läufe verwenden den Workspace-Index; gepinnte Läufe stellen
  einen anderen Kontextpfad dar.

Qwen war real mit 42.496 Kontexttokens geladen. Alle technisch validen
gemessenen Inputs blieben mit höchstens 30.524 Prompttokens darunter. Das
schließt einen Input-Overflow in diesen Läufen aus, nicht aber ein unbekanntes
Outputlimit: LM Studio lieferte kein `finish_reason` und keine
Outputtokenzahl.

### Verifizierte Bedeutungen der Built-in-Einstellungen

- `Vektoranzahl 32` ist der damals sichtbare Umfang des Workspace-Namespaces,
  nicht Top-N und kein Vollständigkeitsbeweis für ein bestimmtes Dokument.
- `Maximale Kontext-Snippets` ist das Top-N-Limit für an den Generator
  übergebene Retrievalkontexte.
- `Keine Einschränkung` entspricht einer Ähnlichkeitsschwelle von 0. Sie
  entfernt keinen bereits ausgewählten Treffer, erweitert Top-N aber nicht.
- `Accuracy Optimized` aktiviert einen getrennten nativen Reranker. Es
  bedeutet weder, dass BGE-M3 der Embedder ist, noch dass der Reranker den
  gesamten Index sieht.
- `Max embedding chunk length 8192` ist in AnythingLLM eine Zeichenobergrenze;
  LM Studios `loaded_context_length` wird in Tokens angegeben. Die Werte
  dürfen nicht direkt gegeneinander verglichen werden.
- AnythingLLM zwang bei jedem Embedderwechsel zur Neuindexierung und entfernte
  das Dokument bis zum Abschluss aus dem geladenen Workspacekontext. Deshalb
  wurden BGE- und Dinghy-Indizes nicht absichtlich gemischt.
- Pinning und ungepinntes Workspace-RAG sind unterschiedliche
  Dokumenttransferpfade. Ein queryseitiger Embeddingaufruf beweist beim
  Pin-Pfad nicht, dass das Embedderranking den Dokumentinhalt begrenzt hat.
- Exakte Modell-Identifier sind Teil des Kontextvertrags. Die falsche
  Chatmodell-ID `dinghy` ließ LM Studio zwar Qwen ausführen, veranlasste
  AnythingLLM aber vorher zu einer 16.384-Token-Fallbackplanung und starker
  Promptkompression.
- `lms ps` zeigt den aktuellen Ladezustand, nicht zuverlässig die gesamte
  frühere Aufrufsequenz. Ein nach dem Chat nicht sichtbarer Embedder widerlegt
  daher keinen vorherigen Query- oder Ingestaufruf.
- `encoding_format=base64` beschreibt die Drahtdarstellung des Vektors, nicht
  seine semantische Qualität.
- Ein Promptcache-Hit ist von einem Vector-DB-Treffer zu trennen. Die
  instrumentierten Qualitätsläufe meldeten jeweils 0 gecachte Prompttokens.
- `parallel=1` und ausgeschaltetes Thinking wurden nicht als Felder im
  Chatrequest belegt. Der besonders schnelle falsche N32-Lauf war wegen der
  2.450-Token-Kompression kurz und darf nicht als Geschwindigkeitsbeweis für
  diese Einstellungen gelten.

Beim Dinghy-Ingest wurden echte Dokumentchunks seriell an den Embedder
geschickt. Neun sauber paarbare Aufrufe dauerten im Mittel ungefähr 1,571
Sekunden; hochgerechnet auf 32 Chunks waren allein ungefähr 50 Sekunden
Embeddingzeit plausibel. Diese Beobachtung belegt den dokumentseitigen
Dinghy-Aufruf, nicht die vollständige Speicherung aller Vektoren. Die
wiederholte SEP-/EOS-Warnung war nicht fatal, kann bei einem
last-token-pooling-basierten Modell aber die Rangfolge beeinflussen; ihr
Qualitätseffekt wurde nicht quantifiziert.

### Vollständige Laufmatrix

`Positionen` und `Codes` sind nur Proxys. Unterschiedliche Aggregation,
Duplikate und fehlende Rollen können mehr Zeilen erzeugen, ohne die fachliche
Vollständigkeit zu verbessern.

| ID        | Konfiguration und einzige beabsichtigte Änderung                                   | Runtime-Evidenz                                                          | Antwort-Proxys                                                       | Urteil                                                                                    |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `OAL-01`  | Qwen + BGE-M3, **gepinnt**, Accuracy, N6, T0,7                                     | kein Laufzeitlog; Konfiguration vom Nutzer bestätigt                     | 67 Zeilen, 49 Codes                                                  | `REVISE`; Pin-Pfad, daher kein valider Embeddervergleich                                  |
| `OAL-02`  | Qwen + Dinghy, **gepinnt**, Accuracy, N6, T0,7; nach Embedderwechsel neu indexiert | Dinghy-Query; wahrscheinlich ein großer `CONTEXT 0`; 25.543 Prompttokens | 16 Zeilen, 0 Codes                                                   | `REVISE`; semantische Kompression trotz großem Kontext, keine sichtbare harte Trunkierung |
| `OAL-03`  | Qwen + Dinghy, **ungepinnt**, Accuracy, N6, T0,7                                   | kein Laufzeitlog; Transferweg vom Nutzer bestätigt                       | 85 Zeilen, 64 eindeutige Namen, 39 Codes, 21 Duplikat-Extras         | `REVISE`; breites, aber partielles Retrieval mit falschen globalen Negativbehauptungen    |
| `OAL-04`  | Qwen + BGE-M3, **ungepinnt**, Accuracy, N6, T0,7; neu indexiert                    | sechs Kontexte, 5.560 Prompttokens, ca. 5:52 Minuten                     | 26 eindeutige Namen, 10 Codes                                        | `REVISE`; eng, in einzelnen geholten Klauseln jedoch tiefer und vorsichtiger              |
| `OAL-05`  | wie `OAL-04`, nur N6 auf N10                                                       | zehn Kontexte, 9.322 Prompttokens, ca. 7:21 Minuten                      | 36 eindeutige Namen, 26 Codes                                        | `REVISE`; N10 hilft BGE klar, Pflichtsektion Sturm und weitere Fakten fehlen              |
| `OAL-06`  | Qwen + Dinghy, ungepinnt, Accuracy, N10, T0,7; neu indexiert                       | zehn Kontexte, 10.699 Prompttokens, ca. 9:37 Minuten                     | 82 Zeilen, 65 eindeutige Namen, 42 Codes                             | `REVISE`; hohe Breite, aber kritische Rollen-, Quellen-, Premium- und Auslassungsfehler   |
| `OAL-07`  | wie `OAL-06`, nur T0,7 auf T0                                                      | identische zehn Kontexte und 10.699 Prompttokens, ca. 12:45 Minuten      | 99 Zeilen, 69 eindeutige Namen, 30 Duplikat-Extras, 11 Codes         | `REVISE`; länger und konsistenter in teils falscher Interpretation, nicht faktentreuer    |
| `OAL-08A` | Dinghy-Index, Default, N32, T0; Chatmodell versehentlich als `dinghy` konfiguriert | kein Laufzeitlog                                                         | 21 Zeilen, 6 Codes                                                   | **UNGÜLTIG**; Engführung auf wenige Seiten, Root Cause erst in Wiederholung belegt        |
| `OAL-08B` | instrumentierte Wiederholung von `OAL-08A`                                         | Marker 31, aber nur 2.450 Prompttokens; LM Studio führte Qwen aus        | 22 Zeilen, 7 Codes                                                   | **UNGÜLTIG** für N32-Qualität; falscher Modellvertrag löste starke Promptkompression aus  |
| `OAL-09`  | `OAL-08B` mit korrigierter Chatmodell-ID `qwen`                                    | Marker 31, 29.882 Prompttokens, ca. 16:00 Minuten                        | 98 Zeilen, 75 eindeutige Namen, 0 Codes, 15 unmögliche Seiten        | `REVISE`; breitester valider Qwen-Lauf, aber nicht auditierbar oder kundenfähig           |
| `OAL-10`  | wie `OAL-09`, nur Qwen auf Gemma 4 26B A4B                                         | Marker 31, 30.524 Prompttokens, ca. 10:34 Minuten                        | 45 Zeilen, 37 eindeutige Namen, 23 korrekte und 3 verstümmelte Codes | `REVISE`; schneller und bei Premium vorsichtiger, massive Breiten-Regression              |

`OAL-08A` und `OAL-08B` sind dieselbe Konfiguration, aber zwei getrennte
Ausführungen. Die Wiederholung reproduzierte dieselbe Engführung auf wenige
Seiten und belegte erst dann die falsche Chatmodell-ID als Root Cause. Beide
Antworten sind ungültige N32-Qualitätsläufe.

### Kontrollierte Vergleiche

#### Pin versus ungepinnt

Pinning und ungepinntes Workspace-RAG sind verschiedene Versuchsebenen. Beim
Pinning gelangte wahrscheinlich ein sehr großer Volltextkontext direkt in den
Systemprompt. Dinghy wurde zwar queryseitig aufgerufen, seine Rangfolge war
für die Dokumentvollständigkeit aber nicht der zentrale Hebel. `OAL-01` gegen
`OAL-02` darf deshalb nicht zu „BGE ist besser als Dinghy“ verdichtet werden.
Der Chat-Upload-Pfad `added as context` wurde nicht getestet.

#### BGE-M3 versus Dinghy

Im ungepinnten Accuracy-Pfad war Dinghy für dieses Dokument der klare Kandidat
mit den höheren Breiten-Proxys:

| Top-N | BGE-M3                        | Dinghy                        | Beweisgrenze                                                          |
| ----- | ----------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| N6    | 26 eindeutige Namen, 10 Codes | 64 eindeutige Namen, 39 Codes | Dinghy-Lauf ohne Runtime-Log; Proxys statt vollständigem Oracle       |
| N10   | 36 eindeutige Namen, 26 Codes | 65 eindeutige Namen, 42 Codes | gleiche Pipeline, aber Generationsauswahl bleibt Teil des Ergebnisses |

Bei N10 überschnitten sich 22 Codes. Dinghy brachte 20 zusätzliche
Codeanker, BGE vier. Zwei der vier BGE-Codes waren bei Dinghy semantisch
vorhanden, nur nicht als Code ausgegeben; die praktisch zusätzlichen
BGE-Funde lagen vor allem bei wasserbezogenen Positionen. Die Union beider
N10-Ausgaben erreichte 46 von 51 bekannten Codeankern, gemeinsam fehlten fünf
wasserlastige Codes.

Das ist **kein reiner Embedder-Benchmark**. Gemessen wurde der
AnythingLLM-End-to-End-Pfad einschließlich Query, Kandidatenwahl, Reranking und
freier Qwen-Synthese. Zusätzlich fehlte beim Dinghy-Query die vom Herausgeber
empfohlene Aufgabeninstruktion; Dinghy meldete eine nicht quantifizierte
SEP-/EOS-GGUF-Warnung. Beide Embedder waren in LM Studio mit 2.048
Kontexttokens geladen, während AnythingLLM 8.192 Zeichen als Chunkobergrenze
verwendete. Diese unterschiedlichen Einheiten beweisen keine Trunkierung,
schließen sie für ungewöhnlich lange Chunks aber auch nicht aus.

Die einzelne BGE-Query war mit ungefähr 0,1 Sekunden deutlich schneller als
die beobachteten Dinghy-Queries von ungefähr 1 bis 5,7 Sekunden. Das sind
keine kontrollierten Durchsatzbenchmarks und keine Qualitätsentscheidung.

#### Top-N und Search Preference

Bei BGE erhöhte N6 auf N10 die eindeutigen Namen von 26 auf 36 und die
Codeanker von 10 auf 26; kein alter Codeanker ging verloren. Top-N6 war dort
ein klarer Ankerfundengpass. Bei Dinghy veränderte N6 auf N10 die Proxys nur von
64 auf 65 eindeutige Namen und von 39 auf 42 Codes. Der N6-Dinghy-Lauf war
allerdings nicht instrumentiert, daher ist dieser Vergleich schwächer.

`Default + N32` änderte bewusst zwei gekoppelte Einstellungen. Im inspizierten
Accuracy-Pfad bestand bei 32 Vektoren nur ein Zehner-Kandidatenpool; ein
Accuracy-N32 hätte deshalb nicht automatisch 32 Kontexte geliefert. Die
N32-Probe war eine Architektur-Escape-Probe, kein sauberer
Einvariablenvergleich. Der korrigierte Lauf belegte: breiterer Kontext behebt
viele Fundlücken, nicht aber die freie Zuordnung von Rollen, Quellen,
Pflichtsektionen und Negativzuständen.

#### Temperatur

`OAL-06` und `OAL-07` erhielten beide zehn Kontexte und exakt 10.699
Prompttokens. Die Antwortunterschiede entstanden daher nach dem Retrieval.
Temperatur 0 erhöhte Zeilenzahl und Laufzeit, erzeugte aber mehr Duplikate,
falsche Spartenkopien und weniger Codeanker. Dieser Einzelvergleich beweist
nicht, dass T0 allgemein schlechter ist; er beweist, dass T0 den
monolithischen Prompt nicht zuverlässig korrigiert.

#### Generator

Gemma war bei nahezu identischem N32-Kontext End-to-End 33,9 Prozent schneller
und klassifizierte die nicht einzeln bepreisten Deckungen vorsichtiger. Es
verlor jedoch mehr als die Hälfte von Qwens Breitenproxy sowie zentrale
Glasfassaden-, Einbruch-, Wasser- und Sturmanker. Ein Modellwechsel allein ist
damit für diese Pipeline kein Vollständigkeitsfix.

### Übergreifende fachliche Fehler

Kein valider Lauf bestand alle Hard-Gates. Wiederkehrend waren:

- `nicht retrieved` wurde zu `im Dokument nicht gefunden` umgedeutet;
- Pflichtabschnitte, insbesondere Einbruchdiebstahl, fehlten oder wurden unter
  einer falschen Sparte versteckt;
- Deckung, Limit, Selbstbehalt, Bedingung und Poolgrenze wurden vermischt;
- die Wirkungsrichtung einzelner Klauseln kippte;
- Einzelprämien wurden trotz nur ausgewiesener Gesamtprämie pauschal als `ja`
  oder `nein` erfunden;
- Vorschlagsseiten und neu beginnende Anhangseiten wurden nicht eindeutig
  rekonstruiert;
- zusätzliche Zeilen entstanden durch Duplikation oder Sammel-/Splittingwahl,
  nicht zwingend durch zusätzliche Fakten;
- fehlende Inhalte wurden entweder falsch negiert oder still ausgelassen.

### Was die Kampagne beweist und nicht beweist

**Beweist für die getestete Installation und das Referenzdokument:**

- Pinning, Accuracy-RAG und Default-N32 sind unterschiedliche Kontextpfade.
- Dinghy lieferte im ungepinnten Accuracy-Pfad mehr Breiten-Proxys als BGE;
  BGE war lokal teils tiefer.
- N10 beseitigte bei BGE einen beobachteten N6-Ankerfundengpass.
- N32 beseitigte nach korrektem Modellrouting einen großen
  Kontextzufuhrengpass.
- Weder T0 noch Gemma reparierten den freien monolithischen Volloutput.
- Keine getestete Built-in-Konfiguration ist als kundenfähige Vollinventur
  freigegeben.

**Beweist ausdrücklich nicht:**

- einen universellen Embedder- oder Generator-Sieger,
- tatsächlichen Faktenrecall nur aus Zeilen- oder Codezählung,
- Stabilität ohne Wiederholung und festen Seed,
- Universalität über andere Policen, OCR, Tabellen oder lange Dokumentpakete,
- bytevollständige Übertragung aller Chunkkörper,
- natürliches Modellende ohne `finish_reason`,
- dass mehr als 42.496 Qwen-Kontexttokens auf dieser Runtime funktionieren,
- dass `parallel=1` oder ausgeschaltetes Thinking den schnellen ungültigen
  N32-Lauf verursacht hätten.

### Kampagnenentscheidung

Die Built-in-Parametersuche wird als eigenständige Kampagne geschlossen.
Breitenproxy-first bleibt für den nächsten Prototyp auf diesem Dokument
`Dinghy + ungepinnt + Default-N32`; das ist eine kontrollierte Arbeitsbasis,
keine Produktfreigabe und keine dauerhafte universelle Konfiguration.

Der nächste Versuch ändert die **Workflowarchitektur**: abschnittsweise
Mehrpass-Extraktion, getrennte Rollenbildung, deterministische
Quellenrekonstruktion, Pflichtanker-/Vollständigkeitsvalidator und sichtbare
`unresolved`-Zustände. Weitere freie Wechsel von Top-N, Search Preference,
Temperatur oder Generator sind erst wieder begründet, wenn ein solcher Lauf
eine klar isolierte neue Hypothese prüft.

## 18. Zwei isolierte Strategie-PoCs auf synthetischem A/B-Korpus

### Ziel und Zustandsgrenze

Am 25. August 2026 wurden außerhalb der bestehenden Produktworktrees zwei
standalone Python-PoCs erstellt und nacheinander auf inhaltlich identischen,
rein synthetischen Gebäudeversicherungs-PDFs ausgeführt:

1. katalog-/Occurrence-gesteuerter Vergleich nach
   `INT-20260825-028`,
2. bidirektionaler Klausel-Diff nach `INT-20260825-030`.

Die Ordner liegen unter `strategy-pocs/`. Sie sind isolierte
Architekturbeweise und weder freigegebener Produktcode noch Aussage über den
unveränderten Agentic-Prototyp oder eine Kundeninstallation.

### Gemeinsamer Korpus

- vier textnative physische Seiten pro Dokument,
- identische extrahierte Texthashes in beiden PoC-Ordnern,
- Implosion: A ausgeschlossen, B gedeckt,
- unterschiedliche Fahrzeuganprall- und Suchkostenlimits,
- Selbstbehalt und Jahreslimit im selben Klauselblock,
- Außenrohre: A ausgeschlossen, B gedeckt,
- Synonyme Suchkosten/Schadenortung und Glasfassade/Fassadenverglasung,
- eine katalogfremde Zusatzklausel nur in B.

Die PDFs besitzen keine OCR-, Mehrspalten-, Tabellengeometrie-, Nachtrags- oder
Cross-Page-Komplexität. Der Korpus ist ein kontrollierter Mechaniktest, kein
Realstrukturbeweis.

### Katalog-/Occurrence-PoC

| Metrik                         | Ergebnis |
| ------------------------------ | -------: |
| Katalogpunkte / Ergebniszeilen |    8 / 8 |
| Seiten A/B                     |    4 / 4 |
| Klauseln A/B                   |  12 / 13 |
| exakte Occurrences A/B         |  17 / 15 |
| deterministische LLM-Aufrufe   |        0 |
| deterministische Laufzeit      |  0,007 s |
| Live-Qwen-Aufrufe              |        1 |
| Live-Gesamtlaufzeit            | 17,483 s |
| fokussierte Tests              | 8/8 PASS |

Der Pfad trennte `EUR 350` Selbstbehalt korrekt von `EUR 20.000`
Jahreslimit und erzeugte die erwarteten A/B-Richtungen. Ein erster Fehler band
den Variantenscope wegen generischer Statuspriorität an eine spätere
Glasfundstelle. Die Definitionsrolle wurde daraufhin separat behandelt und
der physische Seite-1-Beleg als E2E-Regression gesichert.

Der erste Live-Qwen-Lauf formulierte alle Inhalte, lieferte aber keine
maschinenprüfbaren Row-IDs. Der Ausgabevertrag wurde auf ein striktes
JSON-Schema mit exakter Set-Gleichheit aller acht Row-IDs geändert. Der zweite
Live-Lauf bestand dieses Gate. Qwen wählte weder Fakten noch Zeilen.

**Beweis:** Der bekannte-Punkte-Mechanismus kann code-first, vollständig über
seine geplante kleine Taxonomie und mit optionaler fester Formulierung laufen.

**Nicht bewiesen:** Partner-Crosswalk, vollständige Realpolizzen-Taxonomie,
semantische unbekannte Inhalte, Tabellen, Variantenhierarchie, Verweise oder
fachliche Kundenreife. Die katalogfremde B-Klausel wird ohne Discovery-Pass
nicht zur Vergleichszeile.

### Bidirektionaler Vertrags-Diff-PoC

| Metrik                           | Ergebnis |
| -------------------------------- | -------: |
| Inhaltsgruppen A/B               |  12 / 13 |
| Alignment-Kandidaten A->B / B->A |  45 / 45 |
| bestätigte 1:1-Paarungen         |       12 |
| nur in B beobachtete Gruppen     |        1 |
| Diff-Zeilen                      |       16 |
| deterministische LLM-Aufrufe     |        0 |
| deterministische Laufzeit        |  0,010 s |
| Live-Qwen-Aufrufe                |        1 |
| Live-Gesamtlaufzeit              | 32,504 s |
| fokussierte Tests                | 8/8 PASS |

Der Diff paarte Suchkosten und Schadenortung ohne Vergleichspunktkatalog,
trennte Selbstbehalt und Jahreslimit in zwei Diff-Zeilen und hielt die
zusätzliche B-Klausel als `only_b/unresolved` sichtbar.

Ein erster Fehler übernahm für das Jahreslimit die Basis `je
Schadenereignis` aus dem vorherigen Satz. Ursache waren ein zu breites
Zeichenfenster und die Fehlinterpretation des Tausenderpunkts als Satzende.
Die Basis wird nun aus dem exakten Satz sowie dem Rollenanker
`Jahreslimit/Jahreshöchstleistung` abgeleitet. Regressionen sichern den
Selbstbehalt, expliziten Jahresbezug und impliziten Jahresanker.

**Beweis:** Der bidirektionale 1:1-Mechanismus kann ohne vorab vollständigen
Katalog korrespondierende Klauseln und einen katalogfremden Zusatzinhalt
sichtbar machen.

**Nicht bewiesen:** robuste 1:n-, n:1- oder n:m-Zuordnung, abweichende
Dokumentreihenfolge, Tabellen, Cross-References, AVB/Nachträge, reale
Synonymbreite oder fachliche Alignment-Qualität.

### Live-Modell und Ressourcenbeobachtung

Auf dem verwendeten Laptop war kein Qwen 27B installiert. Für den
Integrations-Smoke wurde Qwen 3.5 4B MLX als `qwen-poc` seriell geladen. Der
Modellaufruf formulierte ausschließlich feste Row-/Diff-IDs. Die Messung
beweist daher LM-Studio- und JSON-Vertragsintegration, nicht Qualität oder
Laufzeit des Zielmodells Qwen 27B.

Auf dem kleinen Korpus dominierte bereits ein einziger Formulierungsaufruf die
Gesamtlaufzeit vollständig. Das stützt die code-first-Richtung: Struktur,
Occurrences, Rollen, Beträge, Pairing und Ergebniszeilen deterministisch;
Qwen nur für begrenzte Ambiguität oder Sprache.

### Ausgeführte AnythingLLM-Agent-Skill-Smokes

Nach Nutzerkorrektur wurden die beiden PoCs nicht nur direkt per Python und
LM Studio, sondern nacheinander über echte lokale AnythingLLM-REST-Chats
ausgeführt. Jeder PoC erhielt einen eigenen importierten Agent-Skill,
Loopback-Port, Skill-Storage, API-Schlüsselpfad, Serverlog und Outputordner.
AnythingLLM lief aus `anythingllm-polizzenvergleich`; dessen Repository-
Datenbank blieb die gemeinsame Workspace-Persistenz. Telemetrie war in beiden
Serverprozessen deaktiviert.

Der aktive System-Node `v26.7.0` ließ AnythingLLM zunächst wegen der entfernten
`SlowBuffer`-API nicht booten. Ein eng begrenzter, PoC-lokaler Preload stellte
den fehlenden Alias für den Testprozess wieder her. Das ist Runtime-
Kompatibilitätsevidenz, keine Produktänderung.

LM Studio lud Qwen 3.5 4B MLX seriell als `qwen-strategy` mit angeforderten
32.768 Kontexttokens und Parallelität 1. `lms ps` meldete danach abweichend
77.312 Kontexttokens und rund 3,06 GB. Diese Beobachtung wird nicht als
garantierter Kontextvertrag interpretiert.

#### Katalog-/Occurrence über AnythingLLM

- AnythingLLM-Workspace `strategy-e2e-slavko-1787642486`;
- Agent-Tool `slavko-policy-comparison` im Serverlog angehängt und aufgerufen;
- vorhandener Seed `building-insurance-partner-276-seed@0.1.0-unvalidated`:
  276 geplante, 276 ausgegebene und 276 eindeutige Row-IDs;
- Dokument A/B: 77/65 Zeilen mit mindestens einem mechanisch abgeleiteten
  lexikalischen Kandidaten; alle 276 Vergleiche bleiben `unresolved`;
- Grund: Der Seed besitzt Labels, aber noch keine validierten atomaren Rollen,
  Aliase, Scopes und Vergleichsrichtungen. Kein Kandidat wurde fachlich
  hochgestuft;
- zusätzlicher atomarer 8-Punkte-Lauf: erwartete Vorteile für Implosion,
  Fahrzeuganprall-Limit, Suchkostenlimit, Selbstbehalt und Außenrohre; ein
  Qwen-Aufruf; 8,35 s innerhalb des Skills;
- AnythingLLM-Chatfehler: keiner.

#### Bidirektionaler Diff über AnythingLLM

- AnythingLLM-Workspace `strategy-e2e-codex-1787642530`;
- Agent-Tool `codex-contract-diff` im Serverlog angehängt und aufgerufen;
- 12/13 Inhaltsgruppen, 45/45 gerichtete Kandidaten, 12 bestätigte 1:1-Paare,
  eine `only_b`-Gruppe und 16 eindeutige Diff-IDs;
- Selbstbehalt und Jahreslimit blieben getrennte Diff-Zeilen;
- 25 entdeckte Inhaltsgruppen wurden nachgelagert gegen die 276 Partnerlabels
  gespiegelt; 21 erhielten mindestens einen lexikalischen Kandidaten, alle
  Crosswalks bleiben `candidate_only`;
- ein Qwen-Aufruf; 20,128 s innerhalb des Skills;
- AnythingLLM-Chatfehler: keiner.

**Beweis:** AnythingLLM kann für beide Strategieformen der echte Chat-
Einstiegspunkt sein und einen isolierten code-first Lauf auslösen. Qwen kann
das Tool wählen und anschließend nur die vom Tool gelieferten Kennzahlen bzw.
festen Rows formulieren.

**Beweisgrenze dieses ersten Smokes:** Zu diesem Zeitpunkt las der Skill noch
keine über AnythingLLM hochgeladenen PDFs, sondern feste synthetische Fixture-
Pfade. Der folgende Nachtest ersetzt genau diese inzwischen veraltete Grenze.
Ein synthetischer Lauf ersetzt dennoch kein Realstruktur- oder Fach-Gate.

### Vollständiger AnythingLLM-Dokument-Pipeline-Nachtest

Die vorstehende Beweisgrenze wurde am 25. August 2026 nach ausdrücklicher
Nutzerkorrektur geschlossen. Beide synthetischen Vierseiter wurden je Strategie
wirklich über `POST /api/v1/document/upload` eingelesen. Der Collector erzeugte
für beide Dokumente vollständige kanonische PageMaps (`4/4`,
`pdfExtraction.complete=true`). Dokument A und B wurden in getrennte
AnythingLLM-Workspaces eingebettet.

LM Studio führte dabei lokal aus:

- Qwen 3.5 4B MLX als `qwen-strategy`, Parallelität 1;
- Dinghy Law 4B als `dinghy-embed`;
- gemessene Embeddingdimension 2.560 entsprechend dem Managed Contract;
- je Dokument vier Dinghy-Chunks in getrennten LanceDB-Namespaces;
- je eine getrennte Vektorsuche mit vier Ergebnissen.

Danach rief ein AnythingLLM-Agent den jeweiligen importierten Skill auf. Beide
Strategieprogramme lasen diesmal die vom Collector gespeicherten JSON-
Dokumente über deren PageMap, nicht die festen PDF-Fixture-Pfade. Der
Katalog-/Occurrence-Pfad benötigte innerhalb der Fachmechanik einen begrenzten
Qwen-Formulierungsaufruf und lief insgesamt 50,178 s; der bidirektionale Diff
ebenfalls einen Qwen-Formulierungsaufruf und insgesamt 58,861 s. Beide Chat-
und Dokumentläufe endeten ohne Fehler.

**Neue Beweisgrenze:** REST-Upload, Collector, PageMap, getrennte
Dokumentworkspaces, Dinghy-Embedding, LanceDB, Vector Search, Agent-Skill,
Strategiecode und Qwen-Ausgabe sind synthetisch end-to-end bestanden. Die
Vektorsuche ist nur eine additive Kandidatenspur; der Vollständigkeitspfad
durchläuft alle Collector-Seiten und darf nicht auf globalem Vector-Top-N
beruhen. Weiter offen bleiben grafische A/B-Auswahl, OCR-/Tabellen-/Nachtrags-
Realstruktur, Qwen 27B, Kundenhardware und fachliche Kundenfreigabe.

### Vorläufige Entscheidung

- Katalog-/Occurrence-PoC: `PASS` für synthetische bekannte Punkte,
  `REVISE` für Realstruktur und Vollständigkeit.
- Vertrags-Diff-PoC: `PASS` für synthetisches 1:1-Alignment und
  katalogfremde Discovery, `REVISE` für Many-to-many und Realstruktur.
- Wenn nur ein MVP-Hauptpfad gewählt werden müsste, ist der
  Katalog-/Occurrence-Pfad kontrollierbarer und näher an Partnerkatalog sowie
  Excel-Ausgabe.
- Der Vertrags-Diff bleibt ein sinnvoller unabhängiger Discovery-/Auditpfad,
  nicht ein zu verwerfender Konkurrent.
- Der vollständige AnythingLLM-REST-Dokumentpfad ist synthetisch bestanden.
  Produktintegration bleibt bis zum schwierigeren Korpus und Holdout begrenzt;
  offen ist die grafische A/B-Auswahl statt eines orchestrierten API-Laufs.

Die vollständige PoC-Auswertung steht in
[`strategy-pocs/EVALUATION.md`](../strategy-pocs/EVALUATION.md). Dieser relative
Link dient der lokalen Workspace-Navigation; die kanonische Versuchswahrheit
bleibt dieser Abschnitt.

## 19. Reales Ein-Dokument-Lernexperiment der Katalog-/Occurrence-Variante

Am 25. August 2026 wurde die isolierte Slavko-Strategie mit einem lokalen,
textnativen 21-Seiten-Paket und einer getrennten kuratierten
Drei-Spalten-Referenzliste ausgeführt. Originaldateien, Belegtexte, lokale
Pfade und Fingerprints bleiben außerhalb dieser Wissensbasis.

### Deterministischer Lauf

- 21/21 physische Seiten verarbeitet;
- 183 seitenlokale Klauselgruppen;
- 153 bereinigte Referenz-Prüfzeilen exakt einmal geplant;
- 276/276 Partner-Seed-Zeilen im getrennten Gegenlauf geplant;
- Referenzlauf: 58 lexikalische Kandidatenzeilen, 94 `not_evidenced` und ein
  semantischer Kandidat;
- Partnerlauf: 29 lexikalische Kandidatenzeilen und 247 `not_evidenced`;
- null Qwen-Aufrufe im deterministischen Hauptlauf;
- 23 fokussierte Unit-/Regressionstests grün.

Die Workbook-Ansicht behält genau eine Target-Zeile für Review, weist aber
ausgewählte Fact-ID, Anzahl und Mehrfachkandidaten sichtbar aus. Die
vollständige `0..n`-Menge bleibt getrennt im Fact-Ledger. Nach dem Recheck
stammen Seite, Block, Klausel und Beleg einer Target-Zeile ausschließlich vom
ausgewählten Fact; im Nachtest gab es null Page- oder Blockabweichungen. Eine
XLSX-Auditdatei klassifiziert alle 182 logischen Quellzeilen als Target,
Hierarchie oder begründet ausgeschlossen und weist Hidden-/Merge-Merkmale aus.

### Dinghy und Qwen

Dinghy wurde nur für die 95 lexikalisch offenen Referenzziele ausgeführt. Die
Top-1-Scoreverteilung hatte einen Median um 0,40. Bei der konservativen
Schwelle 0,62 blieb genau ein candidate-only Treffer. Schwächere Top-K-Treffer
wurden nicht als Abdeckung erzwungen. Das Übergabeartefakt ist jetzt an
Dokumentrolle A/B sowie lokale Dokument- und Katalogfingerprints gebunden;
Fingerprints selbst werden hier nicht gespeichert. Ein nachträglicher Recheck
deckte zusätzlich einen Legacy-Bypass über rohe Kandidatenlisten auf. Dieser
wurde geschlossen: Sobald Bindungswerte erwartet werden, ist ein typisiertes
Envelope Pflicht; eine Regression sichert das Verhalten.

Eine strukturdiverse Qwen-4B-Stichprobe prüfte acht bereits codegefundene
Kandidaten. Drei Antworten bestanden ID-, Enum- und exakte-Teilzitatprüfung;
fünf scheiterten und wurden fail-closed `unresolved`. Das entspricht 62,5 %
technischen Validierungsfehlern und ist ausdrücklich `REVISE`, kein
Qualitäts-PASS. Auch bei den drei formal validierten Antworten bleibt die
fachliche Rollenrichtigkeit ungeprüft.

### Urteil und Beweisgrenze

`PASS` als lokaler, reproduzierbarer Kandidaten-/Review-Harness;
`NICHT_BESTANDEN` als fachliche Einzeldokumentanalyse oder A/B-Produktbeweis.
Ein einzelnes natives PDF und eine unvalidierte Referenzliste messen weder
Recall noch Vertragsvollständigkeit. Offen bleiben manuelles Fact-Oracle,
Cross-Page-Fortsetzungen, Tabellengeometrie, Varianten, Vertragsrang,
Querverweise, WEG-Objektscope, OCR/Scans und reale A/B-Comparability.

Konsequenz: Die Katalog-/Occurrence-Variante bleibt ein kontrollierbarer
Hauptkandidat. Sie darf erst nach Rollen-/Scope-Golden-Cases und mindestens
einem gehaltenen A/B-Paar aus `candidate_only` in einen fachlichen
Vergleichspfad promoviert werden.

### Unabhängiger Struktur-/Crosswalk-Gegenlauf

Dieselbe lokale 21-Seiten-Quelle wurde anschließend mit der unabhängig
entwickelten Codex-Variante geprüft. Dieser Pfad beginnt nicht mit
Prüfpunktzeilen, sondern mit einem vollständigen, begrenzten
Dokumentstruktur-Ledger und spiegelt dessen Gruppen erst danach gegen
Kataloge.

- 21/21 physische Seiten und 1.093 behaltene Inhaltszeilen;
- 63 wiederholte Randzeilen gefiltert;
- 35 terminale Strukturgruppen, keine größer als 3.000 Zeichen;
- 25 kontrollierte Größensplits;
- 153 bereinigte Referenzzeilen und 276 Partner-Seed-Zeilen getrennt geladen;
- 35/35 candidate-only Crosswalk-Zeilen je Kataloglauf;
- null LLM-Aufrufe;
- 18 fokussierte Unit-/Regressionstests grün, einschließlich fail-closed
  Abbruch bei einer einzelnen überlangen Extraktionszeile.

Der Realtest fand und schloss einen zuvor synthetisch unsichtbaren
Segmentierungsfehler: Eine vierstellige Orts-/Adresszeile durfte nicht als
nummerierte Kapitelüberschrift gelten. Der Crosswalk erzeugt weiterhin nur
Kandidaten. Da nahezu jede gematchte Strukturgruppe das Kandidatenlimit
erreichte, ist seine Präzision ohne manuelles Oracle ausdrücklich ungeklärt.

**Vergleichsurteil:** Die katalog-/occurrence-zentrierte Variante liegt näher
an der gewünschten zeilenweisen Excel-Befüllung und bleibt der primäre
Hauptkandidat. Die strukturzentrierte Codex-Variante ist der unabhängige
Discovery-/Auditpfad für dokumenteigene Inhalte, ungewöhnliche Gliederung und
Kataloglücken. Keine Variante ist mit diesem Ein-Dokument-Lauf als fachlicher
A/B-Vergleich freigegeben.

## 20. Reales FEUER-A/B-Kandidatenexperiment mit Dinghy und Qwen

Am 25. August 2026 wurde der isolierte strukturzentrierte PoC mit zwei lokalen
realen Dokumentpaketen auf die Kategorie FEUER begrenzt ausgeführt. Lokale
Dateinamen, Pfade, Hashes, Texte, Zitate, Werte und Vertragsidentifikatoren
bleiben außerhalb dieser Wissensbasis.

### Vollständige technische Zielmengen

- 40/21 physische Seiten gelesen;
- eine tatsächlich leere Seite terminal als `blank` erhalten;
- alle 39/21 inhaltlichen Seiten durch 34/35 begrenzte Strukturgruppen
  abgedeckt; maximale Gruppe kleiner als 3.000 Zeichen;
- exakt 36/36 FEUER-Partner-IDs und 22/22 getrennte
  Taxonomie-Discovery-IDs, jeweils unique und `candidate_only`;
- 331 eindeutige Retrieval-Kandidaten;
- 319 lexikalisch enumerierte Kandidaten;
- 42 Kandidaten mit Dinghy-Spur, davon 30 hybrid und 12 ausschließlich
  semantisch;
- bestätigte Dinghy-Dimension 2.560.

Die semantische Suche hatte Schwelle 0,50 und ein Top-3-Reviewlimit. Dieses
Limit ist ausschließlich eine additive Kandidatenspur und kein
Vollständigkeitsbeweis. Partner- und automatisch abgeleitete
Taxonomiebegriffe blieben getrennte Ergebnisräume.

### Qwen-Review und Ressourcenbefund

Die Qwen-Phase verwendete das lokale 4B-Modell, nicht Qwen 27B. Mehrzeilige
Strict-JSON-Batches waren mit der beobachteten LM-Studio-Konstellation nicht
stabil. Zusätzlich verschwand das Chatmodell während gemeinsamer Residenz mit
Dinghy. Nach Persistierung der Retrieval-Kandidaten, Entladen von Dinghy und
Neuladen von Qwen als alleinige Inferenzphase lief der Review terminal.

- 71 kandidatentragende Target-/Dokumentzeilen;
- 71 serielle Einzelaufrufe;
- 41 formal gültige Antworten;
- 30 fail-closed Antworten: 29 nicht wortgleich belegte Zitate, eine
  abgeschnittene Ausgabe;
- unter den 41 gültigen Antworten: 16 `relevant`, 25 `unclear` und 40 mit
  Polarität `unresolved`;
- Reviewdauer der stabilen Qwen-Phase rund 563 Sekunden.

Die 57,7 % formale Akzeptanz messen nur ID-, Schema- und
Teilzeichenfolgen-Grounding. Sie messen keine fachliche Rollenrichtigkeit.
Kandidatenüberlauf blieb sichtbar und verhindert jede Vollständigkeitsannahme.

### A/B-Ausgabe und Urteil

Nach Härtung der Ergebnissemantik enthalten die 36 Partnerzeilen 33
`unresolved` und drei
`candidate_found_in_one_or_both_documents_unresolved`. Die 22
Taxonomiezeilen enthalten elf `unresolved` und elf gleichartig offene
Kandidatenzustände. Es gibt keine freigegebene zweiseitige Differenz, keinen
Vertragsvorteil und keinen Gesamtsieger. Jede Zeile trägt
`domain_validated=false`.

`PASS` als lokales, fail-closed Architektur- und Kandidatenexperiment;
`REVISE` als fachlicher FEUER-A/B-Vergleich. Noch offen sind insbesondere:

- manuelles FEUER-Faktenoracle und Holdout;
- occurrence-lokale Originalspans statt ganzer Kandidatengruppen;
- Rollen-, Varianten-, Objekt-, Vertragsrang- und Querverweisbindung;
- vollständige Reviewbehandlung bei Kandidatenüberlauf;
- kryptografische Bindung eines Resume-Laufs an Gruppen-, Retrieval-,
  Dokument- und Katalogartefakte;
- kanonische Collector-PageMap statt direkter PDF-Seitenreihenfolge;
- OCR-, Tabellen- und Nachtragsfälle.

24 fokussierte Unit-/Regressionstests waren nach der Ausgabehärtung grün.
Lokale Ergebnisverzeichnisse hatten Rechte `0700`, Dateien `0600`.

## 21. Span-ID- und dynamische-Discovery-Iteration im Feuerpilot

Am 25. August 2026 wurde die lokale experimentelle Umsetzung auf ausdrücklichen
Nutzerwunsch im Upstream-basierten Worktree `policy-clean-implementation`,
Branch `codex/policy-clean-implementation`, fortgesetzt. Ausgangs-HEAD war
`a1935f16`; die hier beschriebenen Änderungen waren bei der Messung noch nicht
committed. Der frühere Agent-Flow-Prototyp war nicht der bearbeitete Pfad.

### Konfigurationsbefund

Die gewünschte Baseline war bereits im idempotenten Pilot-Provisioner
verankert:

- Workspace-Top-N 32;
- Temperatur 0;
- Suchmodus `default` beziehungsweise kein Reranking;
- Dinghy-Identifier `dinghy-embed` und 2.560 Dimensionen.

Die Werte wurden in einen testbaren reinen Konfigurationsvertrag ausgelagert.
Globale AnythingLLM-Defaults wurden bewusst nicht verändert. Der
dokumentgebundene Ein-/Zwei-Dokument-Pfad fragt Dinghy nun ebenfalls mit dem
Workspacewert Top-N 32 ab. Die tatsächlich an Qwen übergebene Menge bleibt
durch das Kontextbudget begrenzt und wird im Retrievalmanifest ausgewiesen;
Top-N 32 ist daher Baseline und kein Vollständigkeitsbeweis.

### Dynamische, katalogunabhängige Sammlung

Ein neuer deterministischer Collector schreibt jede nichtleere PDF-Textzeile
genau einmal in ein stabiles Line-Ledger. Die terminale Disposition lautet
Strukturkandidat, Inhaltslabel-Kandidat oder `body_or_unresolved`. Wortlaut,
Dokument, physische Seite, Seiten- und Dokumentoffset sowie stabile Line- und
Occurrence-ID bleiben erhalten. Nummerierte Überschriften, explizite Labels,
Kolon- und Bullet-Labels werden getrennt klassifiziert. Nummerierungstiefen
wie `1.`, `1.1.`, römische und alphabetische Gliederungen werden vor der
Parentbildung normalisiert; wiederholte Randlabels können kein Parent werden.
Ein Parent wird außerdem nur bei kompatiblem Nummerierungspräfix gesetzt;
ein beobachtetes `2.1` ohne vorheriges `2.` bleibt mit
`hierarchyStatus=unresolved` offen.
Der Partnerkatalog ist kein Input dieses Collectors und kann das
Dokumentinventar nicht verändern.

Aggregierter lokaler Realstruktur-Smoke:

| Dokumentrolle | physische Seiten | nichtleere Zeilen | verbuchte Zeilen | Discovery-Vorkommen | eindeutige Labelcluster |
| ------------- | ---------------: | ----------------: | ---------------: | ------------------: | ----------------------: |
| A             |               40 |             1.193 |            1.193 |                 166 |                     153 |
| B             |               21 |             1.544 |            1.544 |                 517 |                     283 |

Die Zahlen messen technische Source-Line-Disposition und Kandidatenmenge,
nicht OCR-/Layoutvollständigkeit, fachlichen Recall oder
Taxonomievollständigkeit. Der sichtbare Vergleich trennt explizite
Dokumentstruktur von zusätzlichen Inhalts-/Feldlabels. Die begrenzte
Kurzansicht bleibt ungeprüft; das vollständige Line-/Occurrence-Ledger wird
einmal content-addressiert je exaktem Payload als lokales Artefakt mit
Dateirechten `0600` gespeichert. Der Chat hält nur Artifact-ID und kompakte
Zähler. Die Discovery läuft auch bei einem Dokument und ohne vorhandene
Embeddings; ihr Anhang bleibt sichtbar, selbst wenn die normale Query keine
Vektortreffer besitzt. Verwaiste Nummerierung propagiert ihren ungeklärten
Hierarchiestatus transitiv an tiefere Unterpunkte. Content-addressierte
Discovery-Artefakte werden referenzbasiert gegen persistierte Chats geprüft;
Persistente In-flight-Leases schützen auch lang laufende Analysen bis zur
Chat-Persistenz. Danach wird die Lease freigegeben; abgebrochene Leases laufen
zeitgebunden aus. Alte, nicht mehr referenzierte und nicht geleaste Artefakte
werden bei neuen Discovery-Läufen sowie Chat-, Thread- und
Workspace-Löschungen entfernt. Ein verzögerter Sweep räumt zuvor durch die
kurze Dateialter-Frist geschützte Orphans nach.

### Serverseitige Span-IDs statt Modellzitate

Kandidatenfenster werden nun vor Qwen in feste, occurrence-genaue
`SPAN-*`-Einheiten mit Quellfingerprint, physischer Seite, Originaloffset und
exaktem Originalsubstring zerlegt. Lange Fenster überlappen, damit
Tabellenzeilen und Satzgrenzen nicht hart auseinanderfallen. Semantische
Kandidaten werden gegen die kanonische PageMap rückgebunden; nicht eindeutige
oder veraltete Kandidatentexte werden verworfen und im Span-Manifest gezählt.
Ein vorgelagertes Retrievalmanifest zählt je Kategorie enumerierte,
ausgewählte und einbezogene kontrollierte Occurrences sowie die einbezogenen
semantischen Kandidaten. Sampling und Kontextverlust vor der Spanbildung sind
damit sichtbar; semantisches Top-N bleibt trotzdem nur additive Auswahl.
Qwen liefert pro serverseitig festgelegter
Kategoriezeile nur noch Span-ID oder `NONE` sowie Modellaspekte. Zitat und
physische Seite stammen aus dem ausgewählten Span. Bei `NONE` überschreibt der
Server alle Modellfelder deterministisch mit dem offenen Evidenzzustand.
Der Produktparser akzeptiert ausschließlich den Drei-Spalten-Vertrag;
neunspaltige Legacyantworten werden abgelehnt. Mehrfach ausgegebene IDs kollabieren nicht in eine beliebige Modellzeile,
sondern werden als `UNGEKLÄRT` mit Vertragsfehlerhinweis erhalten. Eine
gewählte Span-ID ist ausschließlich `source_bound_candidate`; freie
Modellfelder werden nicht als validierte Fakten verwendet und können keinen
automatischen A/B-Vorteil oder Gleichwertigkeitsclaim auslösen.

Synthetischer Loopback-Smoke mit Qwen 3.5 4B und Dinghy Law 4B:

- 2/2 erwartete feste Zeilen geparst;
- 2/2 servereigene Span-IDs ausgewählt;
- 2/2 kontrollierte Kategorienmatcher bestanden;
- regulärer `stop`-Abschluss;
- 2.560 Embeddingdimensionen bestätigt;
- Gesamtdauer im neuesten strikt dreispaltigen Lauf rund 13,9 Sekunden.

Realer, inhaltlich nicht offengelegter Smoke über vier Querschnittskategorien
und zwei Dokumentrollen mit Qwen 3.5 4B:

- Per-Category: acht serielle Modellaufrufe, 8/8 feste Ergebniszeilen,
  39 servereigene Spans, 4/8 source-bound und vom kontrollierten Matcher
  passende Kandidaten und 4/8 offen in rund 58 Sekunden. Diese frühere
  Messung besaß noch kein vorgelagertes Occurrence-Samplingmanifest.
- Ein zunächst reiches Neun-Spalten-Batch lieferte 7/8 source-bound passende
  Kandidaten in rund 41 Sekunden, erzeugte aber fachlich unvalidierte freie
  Rollen-/Wertfelder und wurde deshalb nicht als Produktvertrag beibehalten.
- Der reduzierte Drei-Spalten-Vertrag `ID | Span-ID | Relevanz` mit expliziter
  codebasierter Kandidatenzuordnung lieferte in zwei Modellaufrufen 8/8 feste
  Ergebniszeilen, 33 servereigene Spans, 6/8 source-bound und vom
  kontrollierten Matcher passende Kandidaten und 2/8 offen. Nach Einbezug der
  vorgelagerten Occurrence-Auswahl meldeten beide Dokumentbatches Sampling
  sichtbar im Manifest. Der erste kompakte Lauf dauerte rund 27 Sekunden, ein
  unmittelbar wiederholter warmer Lauf rund 9 Sekunden; daraus folgt keine
  belastbare Latenzprognose. Das Modell
  extrahiert in diesem Schritt keine Beträge, Rollen oder Ausschlüsse mehr.
- Alle acht Zeilen blieben fachlich `candidateOnly`; weder 6/8 noch 7/8 sind
  Precision- oder Recallquote und kein Deckungsbeweis.

Dieser kleine Lauf ist nicht mit den früheren 71 FEUER-Zeilen als
Qualitätsquote vergleichbar. Er zeigt, dass servereigene IDs die zuvor
dominanten freien Zitatfehler vermeiden und dass Batchbildung bei diesem
kleinen Sample günstiger als Einzelaufrufe war. Die Reduktion des
Modellvertrags senkte Laufzeit und verhinderte ungeprüfte freie Faktenfelder,
kostete gegenüber dem reicheren Lauf aber einen passenden Kandidaten. Wegen
dieses Trade-offs und eines sichtbaren Overflow-Batches wird die
Produktionsbatchgröße noch nicht geändert. Der
nächste Engpass ist ein manuelles Oracle für Kandidatenrelevanz sowie
Rollen-/Scopebindung, nicht Zitatschreiben.

### Kleiner Embedder

Ein isolierter synthetischer Dreier-Ranking-Smoke verglich Dinghy Law 0,6B mit
Dinghy Law 4B. Beide rankten die passende Selbstbehaltparaphrase zuerst. Der
0,6B-Lauf war in dieser winzigen Probe schneller, erzeugte aber 1.024 statt
2.560 Dimensionen. Das beweist weder gleichwertigen Real-Recall noch eine
Freigabe. Der verwaltete 4B-/2.560D-Vertrag bleibt bestehen. Ein 0,6B-Versuch
benötigt einen getrennten Namespace und vollständige Neueinbettung.

### Regressionen und Beweisgrenze

- 16 fokussierte Policy-/Chat-/Konfigurations-Suites mit 153 Tests grün;
- zusätzlich Node-Syntaxprüfungen und `git diff --check` grün;
- ESLint war wegen der vorhandenen ESLint-/Scope-Manager-Inkompatibilität
  `scopeManager.addGlobals is not a function` nicht als Signal verwendbar.

`PASS` für auditierbare Source-Line-Disposition, feste Row-IDs,
occurrence-genaue Span-/Seiten-/Offsetbindung, sichtbaren Span-Overflow und
verwaltete Konfiguration. `REVISE` für fachliche Rollen, Werte, Negation,
Variante, Vertragsrang, Tabellen, Querverweise und A/B-Vorteile. Kein
manuelles FEUER-Oracle, kein unabhängiger Holdout und keine Kundenhardware
wurden damit bestanden.

## 22. Neun-Dokumente-Paket mit globalem N32

**Beobachtungsfenster:** 26. August 2026

**Versuchsebene:** Konfigurationstest auf Kundenhardware, keine Produktabnahme

Zwei Modellinput-Logs und die zugehörigen Tabellenoutputs wurden erneut
mechanisch ausgewertet. Kundendokumentnamen, Volltexte, lokale Pfade und
Fingerprints bleiben außerhalb dieser Wissensbasis. Das anonymisierte
maschinenlesbare Register liegt unter
[`experiment-ledgers/multidocument-built-in-runs.v0.1.json`](./experiment-ledgers/multidocument-built-in-runs.v0.1.json).

### Versuchsgrenze

Der Nutzer bestätigte für den ersten Lauf dieselbe Workspace-Konfiguration wie
in der unmittelbar vorangegangenen Default-N32-Baseline; geändert wurde die
Dokumentmenge auf neun gemeinsam zu betrachtende Vertragsdokumente. Der
Runtime-Log belegt Qwen 3.8 27B und exakt 32 übertragene Kontexte, aber nicht
jeden UI-Wert unabhängig. Der zweite Lauf verwendete denselben Dokumentbestand
und die gleiche technische Konfiguration, aber einen anderen Fachkatalog und
Benutzerauftrag. Die beiden Läufe sind daher zwei Messungen desselben
globalen Retrievalpfads, kein kontrollierter fachlicher A/B-Vergleich.

### Mechanische Messung

| Run                 | Fachauftrag     | Kontexte | Dokumente im Modellinput | anonymisierte Chunkverteilung | Inputzeichen | B/T/U       | wörtliche Quellenfragmente exakt im Input |
| ------------------- | --------------- | -------: | -----------------------: | ----------------------------- | -----------: | ----------- | ----------------------------------------: |
| `MDP-20260826-VS01` | VS-01 bis VS-36 |       32 |                      6/9 | 7 / 7 / 6 / 6 / 5 / 1         |      110.597 | 15 / 0 / 21 |                             6/18 = 33,3 % |
| `MDP-20260826-LW01` | LW-01 bis LW-36 |       32 |                      7/9 | 8 / 7 / 5 / 5 / 5 / 1 / 1     |      108.305 | 16 / 5 / 15 |                              2/29 = 6,9 % |

Beide Ausgaben enthielten genau 36 Datenzeilen. Die Zitatprüfung normalisierte
ausschließlich Unicode mit NFKC, entfernte Soft-Hyphens und vereinheitlichte
Leerraum. Ein Fragment galt nur dann als exakt, wenn es danach als
zusammenhängender Teilstring im tatsächlich an Qwen übertragenen Input stand.
Auslassungspunkte, zusammengesetzte Satzteile und neu verbundene Beträge
bestanden diese Prüfung nicht.

Die Quote misst die Einhaltung des ausdrücklich geforderten wörtlichen
Quellenvertrags, nicht die inhaltliche Wahrheit jedes nicht exakten Fragments.

### Lauf der Kategorienserie mit noch unvollständiger Runtimeevidenz

Für `MDP-20260826-ST01` liegt bislang nur der Tabellenoutput vor. Er enthält
36/36 Kategorien in korrekter Reihenfolge und acht Spalten. Die
Statusverteilung beträgt 11 `BELEGT`, 6 `TEILBELEGT`, 0
`WIDERSPRÜCHLICH` und 19 `UNGEKLÄRT`. In 17 Zeilen stehen insgesamt 25
modellgenerierte Zitatfragmente; 19 Zeilen verwenden exakt die vorgesehene
Fallback-Quellenphrase.

Fünf Zeilen (`ST-04`, `ST-17`, `ST-18`, `ST-19`, `ST-29`) kombinieren
`TEILBELEGT` dennoch mit `Deckung = Ja` und verletzen damit den formalen
Entscheidungsvertrag der Kampagne. Keine Quellenzelle nennt eine eindeutige
Dokumentkennung; eine reine PDF-Seite ist im Neun-Dokumente-Paket nicht
eindeutig. Ohne den zugehörigen Modellinput-Log bleiben Kontextanzahl,
Dokumentabdeckung, Chunkverteilung, wörtliche Zitattreue und fachliche
Richtigkeit ungemessen. Dieser Output-only-Stand wird daher nicht in die
vollständig gemessene Tabelle oben eingereiht und nicht als Qualitätsrang
gegen VS oder Leitungswasser verwendet.

Auch für `MDP-20260826-EL01` liegt bislang nur der Tabellenoutput vor. Er
enthält 36/36 Kategorien in korrekter Reihenfolge und acht Spalten, aber alle
36 Zeilen enden `UNGEKLÄRT + Nicht feststellbar`. 34 Zeilen halten die
zwingende UNGEKLÄRT-Fallbackbelegung vollständig ein. `EL-07` und `EL-08`
geben trotz `UNGEKLÄRT` einen abweichenden Vertragsinhalt und jeweils ein
Zitat aus; damit verletzen sie die Zellbelegungsregel des aktuellen
Promptkandidaten. Die Zitate belegen jeweils nur eine
Erdbeben-Ereignisdefinition beziehungsweise eine Erdrutschdefinition, nicht
die zusätzlich behauptete Haftpflicht-, Sturm- oder fehlende
Gebäudezuordnung. Keine Quellenzelle nennt eine eindeutige Dokumentkennung.

Der Output allein beweist weder, dass alle 36 Themen im Dokumentpaket fehlen,
noch einen Retrievalfehler. Ohne Modellinput-Log bleiben tatsächliche
Kontextanzahl, Dokumentabdeckung, Chunkverteilung, wörtliche Zitattreue und
die Ursache des Nulltrefferbilds offen. Auch dieser Lauf wird deshalb nicht
als Qualitätsrang gegen andere Fachkataloge verwendet.

### Retrievalbefund

- Das globale N32 verteilte seine Plätze ungleich über das Paket.
- Im VS-Lauf fehlten drei Dokumente vollständig im Modellinput.
- Im Leitungswasserlauf fehlten zwei Dokumente; das zentrale allgemeine
  Leitungswasser-Bedingungsdokument erhielt nur einen Chunk, der Text aus zwei
  physischen Seiten enthielt. Seine dritte Seite war nicht im Kontext.
- Dass ein Dokument im Modellinput fehlt, beweist nicht, dass es nicht
  importiert, gechunkt oder eingebettet wurde. Der Log beweist nur, dass es in
  dieser konkreten Retrievalauswahl nicht an Qwen übertragen wurde.
- Der Wechsel von sechs auf sieben vertretene Dokumente ist keine
  Verbesserung des Systems. VS und Leitungswasser erzeugten unterschiedliche
  Suchqueries und Trefferverteilungen.
- Die 36 Kategorien des Systemprompts wurden nicht als 36 dokumentgebundene
  Suchaufträge ausgeführt. Die Generatorantwort beruhte weiterhin auf einer
  global begrenzten Kontextstichprobe.

Damit ist `FAIL-005` belegt: Ein globales Top-N darf keinen als vollständig
bezeichneten Mehrdokumentpfad begrenzen. Eine bloße Erhöhung von 32 auf 55
kann die Stichprobe verändern, erzeugt aber weder eine Mindestabdeckung je
Dokument noch einen terminalen Zustand je Kategorie.

### Fach- und Quellenfehler im Leitungswasserlauf

Die folgenden Fehler sind direkt aus Kategorie, Modellinput und Ausgabe
ableitbar; sie sind kein vollständiges fachliches Oracle:

- `LW-03` und `LW-04` verlangten Rohre außerhalb des Gebäudes **auf** dem
  Versicherungsgrundstück. Gewählt wurde stattdessen eine Klausel für Rohre
  **außerhalb des Versicherungsgrundstücks**, obwohl ein enger passender
  On-Property-Anker ebenfalls im Modellinput stand. Das belegt zusätzlich zur
  Retrievallücke einen Modell-/Scope-Auswahlfehler.
- `LW-06` behandelte die Definition eines Rohrbruchs „ohne Mitwirkung von
  Frost“ als vollständigen ausdrücklichen Ausschluss aller Frostschäden.
- `LW-16` erklärte Haushaltsgeräte ohne ausdrückliche Vertragsgleichsetzung zu
  angeschlossenen Einrichtungen.
- `LW-21` setzte Schimmel mit Holzfäule, Vermorschung oder Schwamm gleich.
- `LW-22` gab einen pauschalen Ausschluss aus und verlor die ausdrückliche
  Rückausnahme für Schäden infolge eines versicherten Ereignisses.
- `LW-23` verwechselte Alterung als Schadensursache mit einem Altersabzug bei
  der Entschädigung.
- `LW-25` fragte nach einem Ausschluss allmählicher Einwirkung, während der
  Beleg gerade deren Mitversicherung beschreibt. `Deckung = Nein` bildet die
  abstrakte Regelungsfrage nicht eindeutig ab.

Diese Fälle zeigen: Selbst wenn ein relevanter Gegenbeleg im Kontext liegt,
garantiert mehr globaler Kontext keine korrekte Rollen-, Wirkungsrichtungs-
oder Scopeentscheidung.

### Prompt- und Mehrdokumentvertrag

Der VS-Systemprompt bezeichnete den Auftrag weiterhin als Analyse eines
einzelnen Dokuments. Der Leitungswasser-Systeminput enthielt zusätzlich noch
die falsche Bereichsbezeichnung „Versicherungssumme und versicherte Sachen“
und den Ausführungsprompt sowohl im Systeminput als auch erneut als
Benutzerprompt. Diese Widersprüche sind zu bereinigen, erklären aber nicht die
globale N32-Auswahl.

Für ein gemeinsam geltendes Vertragsdokumentpaket ist ein Mehrdokumentvertrag
erforderlich:

- mehrere Dokumente dürfen dieselbe Kategorie mit getrennten Belegen tragen;
- jeder Beleg behält Dokument-ID, Dokumentrolle, physische Seite,
  Originaloffset, Originalwortlaut, Betrag und Geltungsbereich;
- Beträge, Limits, Bedingungen oder Varianten verschiedener Dokumente werden
  nicht automatisch addiert oder verschmolzen;
- Vertragsrang, Nachtrag, besondere und allgemeine Bedingungen bleiben
  sichtbar; echte unauflösbare Gegensätze enden `WIDERSPRÜCHLICH`;
- der Quellenvertrag muss neben der physischen Seite zwingend den eindeutigen
  Dokumentnamen verlangen.

### Architekturfolgerung und Beweisgrenze

Der PageMap-/page-aware Ingest bleibt notwendig, hätte diese beiden Läufe aber
nicht vollständig repariert. Er kann Seitengrenzen, Dokumentidentität und
Quellenprovenienz sichern; er erzeugt keine Dokument- oder Kategorienquote im
Retrieval.

Ein vollständiger Mehrdokumentpfad benötigt mindestens:

1. Importmanifest je Dokument mit Seiten-, Chunk-, Vektor- und Ready-Status;
2. terminale Coverage-Matrix `Kategorie × Dokument`;
3. lexikalische vollständige Occurrence-Enumeration je Zelle und Dinghy nur
   als additive Kandidatenspur;
4. servereigene Belegspans statt frei formulierter Modellzitate;
5. Dokumentrollen- und Vertragsrangbindung;
6. serverseitige Zusammenführung in genau 36 Zeilen, wobei mehrere getrennte
   Belege pro Zeile zulässig bleiben.

**Beweist:** Globales Default-N32 kann bei neun Dokumenten eine unvollständige
und stark ungleich verteilte Kontextstichprobe erzeugen; der freie
Modelloutput verletzt häufig den wörtlichen Quellenvertrag und macht trotz
vorhandener Gegenbelege Scopefehler.

**Beweist nicht:** dass nicht vertretene Dokumente fehlerhaft importiert oder
nicht eingebettet wurden; tatsächlichen Faktenrecall; Vollständigkeit der neun
Quelldokumente; Universalität über andere Pakete; dass Top-N 55 schlechter
oder besser wäre; eine fachliche Gesamtbewertung der beiden Outputs.

**Urteil:** `REVISE`. Die Messung stärkt `INV-003`, `INV-004`, `FAIL-004` und
den Span-ID-Vertrag aus ADR-018. Der nächste Architekturtest muss Abdeckung je
Kategorie und Dokument sowie servereigene Quellen messen, nicht erneut nur ein
globales Top-N variieren.

## 23. Top-N 32 gegen früher als 55 bezeichneten Einzeldokumentlauf

**Beobachtungsfenster:** 26. August 2026

**Versuchsebene:** Outputvergleich mit unvollständiger Runtimeprovenienz,
keine kontrollierte Top-N-Abnahme

Ein neuer 36-Zeilen-Output wurde vom Nutzer einem vor dem Chat eingestellten
Top N 32 zugeordnet. Verwendet wurde eine bereits gecachte Dokumentvariante;
Modellinput, zeitgleicher Konfigurationssnapshot und eindeutige
Einbettungsprovenienz liegen für diesen Lauf noch nicht vor.

Ein nachgereichter Side-by-Side-Screenshot bestätigt durch mehrere
Zeilenfingerprints eindeutig die Outputzuordnung: links der frühere, rechts
der neue Lauf. Der Nutzer ordnet links Top N 55 und rechts Top N 32 zu. Da die
Workspaceeinstellungen im Screenshot selbst nicht sichtbar sind, stärkt dies
die manuelle Laufzuordnung, ist aber kein unabhängiger Runtimebeleg für die
beiden Höchstwerte.

### Technisch belegte Trennung

Im unveränderten AnythingLLM ist `Maximale Kontext-Snippets` das Workspacefeld
`topN`. Es wird bei jeder Chatabfrage an LanceDB übergeben und begrenzt die
abgerufenen Treffer. Textchunk-Größe und Überlappung werden dagegen beim
Einbetten verwendet. Ein Wechsel von Top N 32 auf 55 oder zurück erfordert
deshalb keine Neueinbettung.

Der vorhandene frühere Modellinput enthält 27 Kontextblöcke. Diese Zahl liegt
unter beiden diskutierten Limits. Sie beweist daher weder Top N 32 noch Top N 55. Der aktuelle Datenbankwert ist ebenfalls kein historisches Auditlog.

### Outputmessung

| Messwert                                           | früherer Lauf | neuer gemeldeter N32-Lauf |
| -------------------------------------------------- | ------------: | ------------------------: |
| B/T/U                                              |        25/3/8 |                    28/1/7 |
| Nicht-ungeklärt                                    |            28 |                        29 |
| Oracle-Statusmatch, drei offene IDs ausgeschlossen |         27/33 |                     25/33 |
| Oracle-Statusquote                                 |       81,82 % |                   75,76 % |
| Zitatfragmente                                     |            39 |                        39 |
| klar falsche Seitenbindungen                       | mindestens 12 |             mindestens 13 |

Der neue Output entfernt eine sachfremde Haftpflichtsumme aus der
Summenermittlung und wählt die richtige Art behördlicher Mehrkosten. Er wird
gleichzeitig bei namentlich angeführten Nebengebäuden sowie allgemeinen
Umzugs-/Zwischenlagerungskosten zu sicher und überdehnt einen engeren Beleg für
privat genutzte Einheiten auf Eigennutzer. Mehr positive Zeilen bedeuten daher
keine höhere Richtigkeit.

**Beweist:** Der frühere Output liegt beim aktuellen Arbeitsoracle vor dem
neuen Output. Top N ist kein Einbettungsparameter.

**Beweist nicht:** einen Vorteil von Top N 55 gegenüber 32, identische
Dokumentvektoren, eine identische gecachte Dokumentvariante oder
Reproduzierbarkeit.

**Urteil:** `REVISE`. Historische Läufe mit höchstens 32 tatsächlich
übertragenen Kontextblöcken werden ohne zeitgleichen Einstellungsbeleg als
`topN nicht identifizierbar` geführt. Ein sauberer A/B-Lauf verwendet denselben
unveränderten Index, neue Chats, einen Konfigurationssnapshot vor jedem Lauf
und vollständige Modellinputs; eine Neueinbettung zwischen 32 und 55 ist
ausdrücklich ausgeschlossen.

Die daraus abgeleitete Faustregel `ein Dokument -> 55, mehrere Dokumente ->
32` ist nicht zulässig. Beim Einzeldokument ist kein 55-Effekt identifiziert;
beim Neun-Dokumente-Paket ließ N32 nachweislich zwei beziehungsweise drei
Dokumente aus. N32 bleibt während der laufenden Fachkategorienserie lediglich
eine Vergleichskonstante. Für einen vollständigen Mehrdokumentpfad ersetzt
weder N32 noch N55 die dokument- und kategoriengebundene Abdeckung.

## 24. LM-Studio-Prompt-Cache gegen tatsächliches Kontextfenster

**Beobachtungsfenster:** 26. August 2026

Während eines laufenden FEUER-Kategorienlaufs meldete LM Studio einen nahezu
vollen `VLM prompt cache disk usage` mit ungefähr 41.680 MiB Kapazität und
steigendem `lifetime_evicted_mib`. Die Zahl wurde wegen ihrer Nähe zum
geladenen Kontextfenster von ungefähr 42.496 Tokens als möglicher
Kontextüberlauf interpretiert.

Diese Interpretation ist falsch. `MiB` bezeichnet Speichergröße; die Zeilen
sind Cache-INFO-Meldungen. Der steigende Eviction-Wert und die wechselnde Zahl
der Records zeigen, dass ältere Prompt-Cache-Einträge verdrängt werden. Das
kann Cachetreffer reduzieren und spätere Promptverarbeitung verlangsamen. Es
beweist keine Kürzung des aktuellen Prompts und keinen fachlichen
Qualitätsverlust.

Ein tatsächlicher Kontextüberlauf ist getrennt zu prüfen. Das Modellfenster
umfasst Eingabe und erzeugte Ausgabe. Maßgeblich sind die tatsächlich geladene
Kontextlänge, der an das Modell übertragene Input, Completion-Tokens und
Kürzungs- beziehungsweise Overflow-Signale.

Der lokale V3-Code enthält dabei ein unabhängiges Risiko: Der
LM-Studio-Connector speichert `max_context_length`, nicht nachweislich die
kleinere geladene Kontextlänge. Der AnythingLLM-Compressor kann deshalb zu spät
aktiv werden. Wird er aktiv, kürzt seine Cannonball-Logik Text aus der Mitte;
sie ist kein fachlich kontrollierter Dokument-Coverage-Mechanismus.

**Beweist:** Die beobachteten MiB-Zeilen sind kein Tokenzähler und allein kein
Abbruchgrund. Der Prompt-Cache verdrängt Einträge.

**Beweist nicht:** Dass der konkrete FEUER-Input sicher unter dem geladenen
Kontextfenster liegt; dass alle Dokumente oder Kategorien vollständig
übertragen wurden; dass Cacheverdrängung keinerlei Laufzeiteffekt hat.

**Urteil:** `PASS` für die Loginterpretation, `OFFEN` für das reale
Tokenbudget des konkreten Laufs. Künftige Run-Ledger führen Cache-MiB,
geladene Kontext-Tokens, Prompt-/Completion-Tokens und Top N als getrennte
Felder.

## 25. V3.2.0-Einzeldokumentlauf VS-01 bis VS-36 auf Kundenhardware

**Run-ID:** `EXP-20260826-V320-VS36-01`

**Beobachtungsfenster:** 26. August 2026

**Versuchsebene:** beaufsichtigter Produktpilot; keine fachliche
Autofreigabe

Ein V3.2.0-Lauf analysierte auf dem Kunden-Mac ein einzelnes textnatives
Gebäudeversicherungs-Deckungskonzept mit dem unveränderten
VS-01-bis-VS-36-Systemprompt. Verwendet wurde die autoritative, 31-seitige
Dokumentfassung. Eine zuvor zur Nachprüfung herangezogene 40-seitige
Arbeitsfassung war nicht das Laufdokument; alle daraus abgeleiteten
Seitenabweichungen wurden verworfen. Weder Dokumentname, lokaler Pfad,
Dokumenthash, Rohtext noch Rohlog werden versioniert.

### Laufvertrag und Runtime

| Achse                   | Beobachtung                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Kundenstatus            | V3.2.0 installiert; Doctor laut Nutzer `PASS`                                                 |
| Dokument                | ein PDF, 31 physische Seiten, alle 31 verarbeitet und textführend                             |
| Index                   | 38 seitengebundene Chunks im Modellkontext sichtbar                                           |
| Embedder                | geladener Alias `dinghy`; 4B-Law-Q6-Familie                                                   |
| Chatmodell              | `qwen/qwen3.8-27b`, MLX 4-bit                                                                 |
| geladener Modellkontext | 42.496 Tokens                                                                                 |
| Workspace-Top-N         | 55, nutzerseitig gemeldet; tatsächlich übertragen wurden 38 Quellenblöcke                     |
| Ähnlichkeitsschwelle    | keine Einschränkung / 0, nutzerseitig gemeldet                                                |
| Temperatur              | 0, im Modellrequest belegt                                                                    |
| Chatcalls               | ein Query-Embedding und ein gestreamter Qwen-Chatcall                                         |
| wirksamer Modellinput   | 32.195 uncached Prompttokens                                                                  |
| Promptverarbeitung      | ungefähr 7 Minuten 20 Sekunden bis 100 %                                                      |
| Finish-Evidenz          | vollständiger Chatoutput liegt vor; der übermittelte LM-Studio-Log endet vor dem Finish-Event |

Der LM-Studio-Log enthält zwei zeitlich getrennte Serien mit jeweils 38
Dokument-Embeddingcalls. Das beweist zwei Ingest-/Embeddingversuche, aber ohne
zeitgleichen Datenbank-/Lance-Snapshot weder zwei committed Dokumente noch
doppelte Vektoren. Vor dem nächsten Lauf ist deshalb die Workspace-Vektorzahl
zu protokollieren; das PDF wird nur einmal abgelegt.

### Outputvertrag

| Messwert                                                        |                                   Ergebnis |
| --------------------------------------------------------------- | -----------------------------------------: |
| Datenzeilen                                                     |                                    36 / 36 |
| Spalten je Zeile                                                |                                      8 / 8 |
| Reihenfolge                                                     |    VS-01 bis VS-36 vollständig und korrekt |
| Statusverteilung                                                | 27 `BELEGT`, 2 `TEILBELEGT`, 7 `UNGEKLÄRT` |
| Status-/Deckungskombinationen                                   |                 nur erlaubte Kombinationen |
| parsebare Quellenzitate                                         |                                         40 |
| streng wortgetreu auf behaupteter physischer Seite              |                                    20 / 40 |
| auf derselben Seite nach Layout-/Interpunktionsnormalisierung   |                            weitere 16 / 40 |
| richtige Seite, aber durch Ellipsen/Verkürzung nicht wortgetreu |                                     4 / 40 |
| Zitate auf einer anderen physischen Seite                       |                                     0 / 40 |

Die PageMap-/page-aware Ingeststufe besteht damit den beobachteten
Seitenbindungstest. Der freie Modelloutput besteht den strengen
Originalwortlautvertrag noch nicht vollständig. Sieben `UNGEKLÄRT`-Zeilen
verwenden außerdem ein großgeschriebenes `Keine` statt des vorgeschriebenen
exakten Missing-Texts; eine Quellenzelle enthält einen Zeilenumbruch innerhalb
des Zitats und ist formal nicht parsebar.

### Fachliche manuelle Reviewpunkte

Die nachfolgende Liste ist eine begrenzte Reviewmenge, kein vollständiges
Fachoracle. Mindestens sechs Zeilen sind zu sicher eingestuft:

1. Eine Haftpflicht-Pauschalsumme wird mit Gebäudeindex und Gutachten zu einer
   allgemeinen Summenermittlung zusammengeführt.
2. Ein Eingangstor aus einem engeren Vandalismusscope wird als allgemeine
   Tordeckung verwendet.
3. Ein belegter Kinderspielplatz wird ohne ausdrücklichen Beleg für
   Spielgeräte zur vollständigen verbundenen Kategorie hochgestuft.
4. Gerüstkosten aus dem Glasbruchscope werden als allgemeiner Schadenfall
   behandelt.
5. Lager-/Zwischenlagerungskosten werden trotz fehlendem Umzugskostenbeleg als
   vollständige verbundene Kategorie ausgegeben.
6. Die bedingte Klausel `wenn vereinbart` zur Vorsorgeversicherung wird als
   konkrete Vereinbarung interpretiert.

### Beweisgrenze und Urteil

**Beweist:** Der V3.2.0-Kundenpfad kann das autoritative Einzeldokument neu
parsen, seitengebunden indexieren, 38 Quellenblöcke innerhalb eines
32.195-Token-Inputs an Qwen 27B übertragen und den geforderten
36-Zeilen-/8-Spalten-Vertrag strukturell erzeugen. Sämtliche geprüften
Quellenangaben zeigen auf die richtige physische PDF-Seite.

**Beweist nicht:** vollständigen Faktenrecall, vollständige fachliche
Korrektheit, belastbare Negativaussagen, Universalität über andere
Dokumentklassen oder Kategorien, einen Vorteil von Top N 55 gegenüber 32 oder
eine unbeaufsichtigte Produktionsfreigabe. Top N 55 war nur der Laufparameter;
da 38 Quellenblöcke übertragen wurden, ist kein kausaler 55-Effekt
identifiziert.

**Urteil nach Achsen:**

- Installation und Laufweg: `PASS` laut Nutzer-Doctor und Runtimebeleg,
- PageMap, seitengebundener Index und Retrieval: `PASS` für dieses Dokument,
- Tabellenstruktur: `PASS`,
- strenger Quellenwortlaut: `REVISE`,
- fachliche Status-/Scopebindung: `REVISE`,
- beaufsichtigter Kundenpilot: `CONDITIONAL GO`,
- ungeprüfte produktive Deckungsaussage: `NO GO`.

Der nächste kontrollierte Lauf wechselt ausschließlich den Fachkatalog auf
EL-01 bis EL-36. Dokumentfassung, V3.2.0, Modelle, Temperatur, Top N,
Threshold und Einzeldokumentmodus bleiben unverändert. Damit wird geprüft, ob
die technische Stabilität über einen zweiten Kategorievertrag trägt; der Lauf
ist keine Wiederholung oder unabhängige Fachverifikation des VS-Ergebnisses.

## 26. V3.3.0 RC18 – Rollenlokales Jahresaggregat-Vielfaches

**Beobachtungsfenster:** 29. August 2026

Im aktuellen LF-HP-Artefakt war `HP-02` bereits mit einer allgemeinen,
servergebundenen Quelle auf physischer PDF-Seite 17 vorhanden und vom
27B-Modell als `DEFINED` bewertet. Der Wertevertrag extrahierte die vollständige
Bedingung, kannte aber für das Pflichtfeld `limit` nur Geld- und Prozentwerte.
`maximal dreimal` ging daher vor dem Tabellenrendering verloren.

Die Korrektur erkennt ein Vielfaches ausschließlich innerhalb von `HP-02`,
wenn Jahresbezug, Deckungssummenbasis, Begrenzungsanker und `mal`-/`fach`-Wert
gemeinsam im kontrollierten Klauselkontext vorkommen. Der Server bindet den
exakten Wertspan und normalisiert beispielsweise `dreimal` zu `3-fach`.
Prämienzahlungsintervalle, Summen ohne Jahresbezug und Jahreszählungen ohne
Summenbasis bestehen die Negativtests nicht.

| Prüfung                                |                      Ergebnis |
| -------------------------------------- | ----------------------------: |
| Jest                                   | 91/91 Suites, 1021/1021 Tests |
| vollständiger Lint                     |                          PASS |
| aktuelle LF-/WEVIG-Worksheets gescannt |                            24 |
| autoritative neue Treffer              |             1, nur LF `HP-02` |
| echter LF-HP-27B-Replay                |                  36/36 Zeilen |
| geänderte Zeilen                       |                             1 |
| übrige HP-Zeilen                       |           35 bytegenau gleich |

Im Replay wechselte `HP-02` von `TEILBELEGT / Nicht feststellbar` zu
`BELEGT / Ja / 3-fach`. Quelle, physische Seite, Bedingung und alle anderen
HP-Zeilen blieben unverändert.

**Beweist:** Der konkrete Wertverlust ist eine deterministische
Rollenassoziationslücke und kann ohne freie Modellzahl behoben werden. Der
Produktionsvertrag verwendet keine Versicherer-, Dokument- oder Seitenkennung
und besteht synthetische positive und negative Formulierungsvarianten.

**Beweist nicht:** fachliche Freigabe aller HP-Zeilen, beliebige
Jahresaggregat-Formulierungen, Paketlogik oder externe Generalisierung auf
unbekannte Versicherer. Der frische Mac-Studio-27B-Lauf und ein unabhängiger
Holdout bleiben getrennte Gates.

### Zielhardwarebefund

Der unveränderliche RC18-Tag `e11db5d2` bestand auf dem Mac Studio Update,
integrierten und separaten Doctor sowie die Prüfung auf einen sauberen
Checkout. Der frische LF-HP-Lauf bestand 37/37 Triage-Kandidaten, 63/63
Komponenten und 36/36 Endzeilen. Gegen den akzeptierten RC12-HP-Lauf änderte
sich ausschließlich `HP-02` zu `BELEGT / Ja / 3-fach`; Quelle und
dokumentierter Inhalt blieben identisch, die übrigen 35 Zeilen semantisch
gleich.

Der frische WEVIG-HP-Kontrolllauf bestand 23/23 Kandidaten, 63/63 Komponenten
und 36/36 Endzeilen. Gegen RC11 gab es keine semantische Änderung. WEVIG
`HP-02` blieb ohne Beleg `UNGEKLÄRT / Nicht feststellbar`. Damit ist der
bekannte LF-Verlust auf Zielhardware behoben und der bekannte Negativfall
stabil; eine unabhängige Holdout-Generalisierung bleibt offen.

## 27. V3.3.0 RC19 – Beschriftete Versicherungsperiode

**Beobachtungsfenster:** 29. August 2026

WEVIG `FE-F05` besaß bereits zwei richtige allgemeine Kandidaten auf der
ersten physischen PDF-Seite: die Zugangsbedingung für den Versicherungsschutz
und die Zeile mit Versicherungsbeginn und Versicherungsablauf. Der
Satzbereich stoppte am ersten Punkt des Startdatums. Dadurch wurde
`Versicherungsbeginn 19.` als Bedingung gespeichert und kein `date`-Fakt
erzeugt. `Versicherungsablauf` war außerdem nicht als atomarer Rollenanker
katalogisiert.

Die Korrektur erkennt eine vollständige Versicherungsperiode nur bei getrennt
beschriftetem Start und Ablauf. Das Startdatum wird ausschließlich aus dem
Startrollenanker extrahiert. Zugangsbedingung, Start-/Ablaufzeile und Datum
behalten eigene exakte Quellspannen. Unbeschriftete Druckdaten, ein
abgeschnittenes Datum und nur eine der beiden Periodengrenzen bleiben
Negativfälle.

| Prüfung                        |                          Ergebnis |
| ------------------------------ | --------------------------------: |
| Jest                           |     91/91 Suites, 1028/1028 Tests |
| vollständiger Lint             |                              PASS |
| WEVIG-FE-Kandidaten            |                          44 -> 45 |
| neue kontrollierte Fundstellen | 1, nur `FE-F05 temporal_validity` |
| WEVIG-FE-Replay                |                      80/80 Zeilen |
| geänderte Endzeilen            |                   1, nur `FE-F05` |
| LF-FE-Kandidaten               |                    unverändert 25 |

Der WEVIG-Replay wechselte `FE-F05` von `TEILBELEGT` mit abgeschnittenem
`Versicherungsbeginn 19` zu `BELEGT / Ja` mit der vollständigen Periode und
dem Startdatum `19.01.2026`. Alle übrigen 79 FE-Zeilen blieben unverändert.

**Beweist:** Rollenlokal beschriftete Punktdaten können ohne freien Modellwert
und ohne globale Lockerung der Satzgrenze vollständig gebunden werden.

**Beweist nicht:** beliebige Datumsformulierungen, aktive Deckung eines bloßen
Vorschlags, fachliche Freigabe aller FE-Zeilen oder Generalisierung auf einen
unbekannten Versicherer. Frische Zielhardwareläufe bleiben ein eigenes Gate.

### Zielhardwarebefund und Zeilenzahlkorrektur

Die Vorabnotiz hatte den 36-Zeilen-Umfang anderer Kategorien irrtümlich auf FE
übertragen. Der FE-Vertrag besitzt 80 Endzeilen. Diese Dokumentationszahl wurde
nach dem vollständigen Lauf korrigiert; der unveränderliche Release-Tag wurde
nicht umgeschrieben.

RC19 bestand auf dem Mac Studio Update, beide Doctor-Prüfungen, Tag-/SHA- und
Checkoutkontrolle. Der frische WEVIG-FE-Lauf bestand 45/45 Kandidaten, 138/138
Komponenten und 80/80 Endzeilen. Gegen RC11 änderte sich ausschließlich
`FE-F05`; die übrigen 79 Zeilen blieben semantisch gleich. Der frische
LF-FE-Kontrolllauf bestand 25/25 Kandidaten, 138/138 Komponenten und 80/80
Zeilen mit null semantischen Änderungen gegenüber RC12.

## 28. V3.3.0 RC20 – Wiederherstellungsfrist als servergebundene Dauer

**Beobachtungsfenster:** 29. August 2026

LF `VB-26` enthielt bereits vier kontrollierte Fundstellen zur
Wiederherstellungsfrist. Triage, Wirkung und Quellen waren vorhanden; nur das
angeforderte Feld `duration` blieb leer. Ursache war die gebeugte Form
`dreier Jahre`, die der allgemeine Dauerextraktor nicht normalisierte. Die
Endzeile blieb deshalb fälschlich `TEILBELEGT`.

RC20 erkennt ausschließlich in `VB-26` eine unmittelbar mit
Wiederbeschaffung oder Wiederherstellung verbundene `innerhalb`-/`binnen`-Frist.
Ziffern und deutsche Zahlwörter mit Fallendung werden mit exaktem Quellspan als
Stunden, Tage, Wochen, Monate oder Jahre gespeichert. Eine
Deckungsprozess-Verlängerung definiert die Regel, erzeugt allein aber keine
numerische Dauer. Fremde Kündigungs- und Vertragsdauern sowie eine bloße
Wiederherstellungserwähnung bestehen die Negativtests.

| Prüfung                   |                                          Ergebnis |
| ------------------------- | ------------------------------------------------: |
| Jest                      |                     91/91 Suites, 1034/1034 Tests |
| vollständiger Lint        |                                              PASS |
| LF-VB-Frischlauf          | 35/35 Kandidaten, 52/52 Komponenten, 36/36 Zeilen |
| LF-Endzeilenänderung      |                                    1, nur `VB-26` |
| übrige LF-VB-Zeilen       |                              35 semantisch gleich |
| WEVIG-VB-Frischlauf       | 20/20 Kandidaten, 52/52 Komponenten, 36/36 Zeilen |
| WEVIG-Endzeilenänderungen |                                                 0 |

Im frischen LF-Lauf wechselte `VB-26` von
`TEILBELEGT / Nicht feststellbar` zu `BELEGT / Ja / Dauer: 3 Jahre`. Beide
tatsächlichen Vorkommen von `dreier Jahre` blieben als getrennte exakte
Quellspannen erhalten. Alle übrigen 35 VB-Zeilen waren gegenüber RC12
semantisch identisch.

Der frische WEVIG-Kontrolllauf blieb gegenüber dem akzeptierten RC17-VB-Lauf
über alle 36 Zeilen unverändert. Ohne Fundstelle blieb WEVIG `VB-26` korrekt
`UNGEKLÄRT / Nicht feststellbar`.

**Beweist:** Der konkrete Verlust lag zwischen bereits gefundener Evidenz und
dem Pflichtfeld der Endzeile. Die allgemeine, rollenlokale Korrektur behebt
ihn auf Zielhardware, ohne den bekannten Negativfall zu aktivieren.

**Beweist nicht:** beliebige Fristformulierungen, fachliche Freigabe aller
VB-Zeilen oder Generalisierung auf unbekannte Versicherer und Layouts. Diese
bleiben unabhängige Holdout-Gates.

## 29. V3.3.0 RC21 – Leckortung und Suchkosten sind Alternativwortlaute

**Beobachtungsfenster:** 29. August 2026

LF und WEVIG enthielten in `LW-08` jeweils eine richtige Suchkosten-Fundstelle
mit eigenem Limit. Trotzdem blieb die Endzeile `TEILBELEGT`, weil der aktive
Katalog gleichzeitig eine zweite Pflichtkomponente `Leckortungskosten`
forderte. Historische Taxonomie, Golden Cases und frühere Strategiearbeit
führten `Leckortung`, `Lecksuche`, `Rohrbruchsuche` und `Suchkosten` dagegen
als starke Alternativbezeichnungen desselben Lecksuche-Sachverhalts.

RC21 verwendet daher nur für `LW-08` die vorhandene ANY-Semantik. Eine
gefundene Alternative genügt; ohne Fundstelle bleibt die Kategorie offen.
Nach einem Treffer rendert die Tabelle keine unbelegte Synonymalternative als
scheinbar getrennte fehlende Objektfakt. Tatsächlich gefundene Alternativen,
ihre Wirkungen, Konflikte, Beträge und Quellen bleiben erhalten.

| Prüfung                   |                                          Ergebnis |
| ------------------------- | ------------------------------------------------: |
| Jest                      |                     91/91 Suites, 1037/1037 Tests |
| vollständiger Lint        |                                              PASS |
| LF-LW-Frischlauf          | 33/33 Kandidaten, 52/52 Komponenten, 36/36 Zeilen |
| LF-Endzeilenänderung      |                                    1, nur `LW-08` |
| LF-Limit                  |                       EUR 2.500 auf Erstes Risiko |
| WEVIG-LW-Frischlauf       | 33/33 Kandidaten, 52/52 Komponenten, 36/36 Zeilen |
| WEVIG-Endzeilenänderung   |                                    1, nur `LW-08` |
| WEVIG-Limit               |                    EUR 1.500,00 auf Erstes Risiko |
| Zielhardware-Installation |          `v3.3.0-rc.21` / `3e5a0f02`, Doctor PASS |

In beiden Zielhardwareläufen wechselte ausschließlich `LW-08` von
`TEILBELEGT / Nicht feststellbar` zu `BELEGT / Ja` mit dem jeweils eigenen
quellengebundenen Limit. Die übrigen 35 LW-Zeilen blieben gegenüber den
akzeptierten Baselines semantisch identisch.

**Beweist:** Eine historisch belegte Synonym-Aufspaltung kann als allgemeiner
Alternativwortlaut korrigiert werden, ohne Betragstransfer oder Änderungen an
anderen LW-Zeilen.

**Beweist nicht:** beliebige neue Synonyme, unbekannte Versicherer,
fachliche Freigabe aller LW-Zeilen oder Generalisierung ohne externe Holdouts.

## 30. V3.3.0 RC22 – Unterstützende HP-Bedingungen bestimmen nicht die Deckungspolarität

**Beobachtungsfenster:** 29. August 2026

Bei LF waren `HP-24` und `HP-27` intern vollständig und quellengebunden. Die
eigentliche Kosten- beziehungsweise Schadensrolle war eingeschlossen; die
zugehörige Vertragsbedingung war korrekt bedingt geregelt. Die sichtbare
Tabelle wurde dennoch herabgestuft, weil der alte Rollup beide Rollen für das
Deckungsbild verwendete.

RC22 setzt für genau diese beiden Anforderungen die bereits in RC15 bewiesene
Deckungsrollen-Aggregation. Bedingungen bleiben Pflichtbelege und sichtbar,
ändern aber nicht die Polarität einer ausdrücklich eingeschlossenen Leistung.

| Prüfung                   |                                          Ergebnis |
| ------------------------- | ------------------------------------------------: |
| Jest                      |                     91/91 Suites, 1037/1037 Tests |
| vollständiger Lint        |                                              PASS |
| LF-HP-Frischlauf          | 37/37 Kandidaten, 63/63 Komponenten, 36/36 Zeilen |
| LF-Endzeilenänderungen    |                        2, nur `HP-24` und `HP-27` |
| übrige LF-HP-Zeilen       |                              34 semantisch gleich |
| WEVIG-HP-Kontrolllauf     | 23/23 Kandidaten, 63/63 Komponenten, 36/36 Zeilen |
| WEVIG-Endzeilenänderungen |                                                 0 |
| Zielhardware-Installation |          `v3.3.0-rc.22` / `139f53d7`, Doctor PASS |

**Beweist:** Unterstützende Bedingungen können kataloggesteuert von der
Deckungspolarität getrennt werden, ohne fehlende Deckungsrollen zu erfinden.

**Beweist nicht:** dass jede `CONDITION` ignoriert werden darf. Die Trennung
gilt nur für Anforderungen mit expliziter Rollenpolicy; externe Holdouts und
fachliche Gesamtfreigabe bleiben offen.

## 31. V3.3.0 RC23 – Elementarwerte im deklarierten Host-Scope

**Beobachtungsfenster:** 29. August 2026

LF `EL-01` und `EL-11` enthielten bereits vollständige Werte und Quellen. Der
Katalog erlaubte für beide den Sturm-Host-Scope, aber die Zeilenpolicy blieb
auf `GENERAL_REQUIRED`. Dadurch wurden die Werte nur als Teilbeleg gezeigt.

RC23 aktiviert den Matching-Scope-Abschluss ausschließlich für diese beiden
Anforderungen. Die existierenden ScopeKeys, Kandidaten und Werteextraktoren
werden nicht erweitert.

| Prüfung                   |                                          Ergebnis |
| ------------------------- | ------------------------------------------------: |
| Jest                      |                     91/91 Suites, 1040/1040 Tests |
| vollständiger Lint        |                                              PASS |
| LF-EL-Frischlauf          | 48/48 Kandidaten, 69/69 Komponenten, 36/36 Zeilen |
| LF-Endzeilenänderungen    |                        2, nur `EL-01` und `EL-11` |
| übrige LF-EL-Zeilen       |                              34 semantisch gleich |
| WEVIG-EL-Kontrolllauf     | 58/58 Kandidaten, 69/69 Komponenten, 36/36 Zeilen |
| WEVIG-Endzeilenänderungen |                                                 0 |
| Zielhardware-Installation |          `v3.3.0-rc.23` / `a776bc0e`, Doctor PASS |

`EL-01` trägt nun `1 %`, `EUR 20.000` und `EUR 100.000` jeweils auf Erstes
Risiko in der Betragsspalte. `EL-11` trägt `EUR 350 je Schadenfall`. Beide
Zeilen sind `BELEGT / Ja`.

**Beweist:** Vollständige Wertfakten können im bereits deklarierten
Elementar-Host-Scope abgeschlossen werden, ohne neue Scope- oder Suchregeln.

**Beweist nicht:** beliebige Sturmwerte als Elementarwerte oder unbekannte
Host-Scopes. Externe Holdouts und fachliche Gesamtfreigabe bleiben offen.

## 32. V3.3.0 RC24 – Allgemeine Sparten-Höchstentschädigung

**Beobachtungsfenster:** 29. August 2026

LF enthält im allgemeinen Vertragsteil eine Höchstentschädigung von
`150 % der vereinbarten Versicherungssumme`, ausdrücklich inklusive aller
für die jeweilige Sparte vereinbarten Positionen. VS verwendete die Klausel
bereits richtig. ST behandelte denselben Satz als engen Teilbeleg; FE und LW
riefen ihn nicht kontrolliert ab.

RC24 löst dies als allgemeinen, aber eng gebundenen Vertrag. Recall und
deterministische Bindung wurden für die drei tatsächlichen
Höchstentschädigungsziele gemeinsam ergänzt. Autoritativ ist ein Treffer nur
im allgemeinen Vertragsteil und nur dann, wenn derselbe Satz die operative
Höchstentschädigung, den Wortlaut `jeweilige Sparte`, einen numerischen
Prozentsatz und die vereinbarte Versicherungssumme enthält. Der konkrete Wert
150, Versicherer, Dateiname und Seite sind keine Aktivierungsmerkmale.

| Prüfung                   |                                         Ergebnis |
| ------------------------- | -----------------------------------------------: |
| Jest                      |                    92/92 Suites, 1054/1054 Tests |
| Server-Lint               |                                             PASS |
| LF-FE                     | nur `FE-F02` verbessert, übrige 79 Zeilen gleich |
| LF-LW                     |  nur `LW-31` verbessert, übrige 35 Zeilen gleich |
| LF-ST                     |  nur `ST-34` verbessert, übrige 35 Zeilen gleich |
| WEVIG FE/LW/ST            |                     152/152 Zeilen, 0 Änderungen |
| Zielhardware-Installation |         `v3.3.0-rc.24` / `73e3218f`, Doctor PASS |

`FE-F02` wechselt korrekt von `UNGEKLÄRT` zu `TEILBELEGT`: Die
Höchstentschädigung Feuer mit 150 Prozent ist belegt, die getrennte
Jahreshöchstleistung bleibt nicht feststellbar. `LW-31` wechselt zu
`BELEGT / Ja / 150 %`; `ST-34` von `TEILBELEGT` zu
`BELEGT / Ja / 150 %`. Die Quelle bleibt in allen drei Fällen die reale
LF-Seite 25.

Die WEVIG-Kontrolle ist besonders wichtig: Trotz ähnlicher Limit- und
Spartenbegriffe entsteht ohne den vollständigen Satz kein neuer Beleg. Alle
152 Zeilen der drei Kategorien bleiben gegenüber ihren akzeptierten
Baselines identisch.

**Beweist:** Eine ausdrücklich spartenübergreifend formulierte allgemeine
Vertragsklausel kann kontrolliert in mehrere sachlich betroffene Kategorien
projiziert werden, ohne ein Jahresaggregat zu erfinden oder das
Negativdokument zu verändern.

**Beweist nicht:** unbekannte Wortlautvarianten und externe Versicherer.
Diese bleiben Holdouts; eine bloße Höchstentschädigung ohne Spartenanker darf
nicht automatisch übertragen werden.

## 33. V3.3.0 RC25 – Konkrete Beschattungsobjekte

**Beobachtungsfenster:** 29. August 2026

LF nennt `Markisen, Jalousien und Rollläden` in derselben versicherten
Objektliste. `ST-17` belegte Jalousien und Rollläden bereits korrekt, während
`ST-16` nur Markisen erkannte. Die historische Taxonomie gruppiert
`Markisen, Beschattung, Rollläden` ebenfalls gemeinsam. Ursache war damit ein
enger Aliasvertrag, nicht fehlende Evidenz oder schwache Modellleistung.

RC25 ergänzt Jalousie und Rollladen ausschließlich als kontrollierte
Ausprägungen von `ST-16/shading_system`. Scope- und Wirkungsregeln ändern sich
nicht.

| Prüfung                   |                                        Ergebnis |
| ------------------------- | ----------------------------------------------: |
| Jest                      |                   92/92 Suites, 1055/1055 Tests |
| LF-ST                     | nur `ST-16` verbessert, übrige 35 Zeilen gleich |
| WEVIG-ST                  |                      36/36 Zeilen, 0 Änderungen |
| Zielhardware-Installation |        `v3.3.0-rc.25` / `2689af8d`, Doctor PASS |

LF `ST-16` wechselt von `TEILBELEGT / Nicht feststellbar` zu
`BELEGT / Ja`. WEVIG bleibt unverändert, weil seine Markisenklausel nur in
Feuer aktiviert ist und keine Jalousien oder Rollläden für Sturm enthält.

**Beweist:** Konkrete physische Unterarten können einen Oberbegriff erfüllen,
wenn dieselben Unterarten bereits im gleichen Katalog und Vertragskontext
fachlich geführt werden.

**Beweist nicht:** dass beliebige Sonnenschutzbegriffe austauschbar sind oder
fremde Spartenaktivierungen ignoriert werden dürfen.

## 34. V3.3.0 RC26 – Rechtsfolgen und grammatische PDF-Fortsetzungen

**Beobachtungsfenster:** 29. August 2026

`FE-E16` war in LF und WEVIG inhaltlich vollständig vorhanden, aber der
Katalog kannte die konkreten Formulierungen nicht. LF sagt, dass die
Verletzung der Verpflichtungen nach Maßgabe des VersVG zur Leistungsfreiheit
führt. WEVIG versichert Verletzungen vereinbarter Obliegenheiten innerhalb
einer Deckungserweiterung und nennt anschließend deren Ausnahmen.

RC26 ergänzt beide Formulierungen als enge Recall-Anker. Die während der
Endprüfung sichtbar gewordenen Textabbrüche an `Abs.` sowie an PDF-Zeilenenden
nach `und` oder `von` wurden strukturell korrigiert. Echte Satz- und
Abschnittsgrenzen bleiben erhalten.

| Prüfung                   |                                         Ergebnis |
| ------------------------- | -----------------------------------------------: |
| Jest                      |                    93/93 Suites, 1059/1059 Tests |
| LF-FE                     | nur `FE-E16` verbessert, übrige 79 Zeilen gleich |
| WEVIG-FE                  | nur `FE-E16` verbessert, übrige 79 Zeilen gleich |
| Zielhardware-Installation |         `v3.3.0-rc.26` / `a58fc9d8`, Doctor PASS |

Beide `FE-E16`-Zeilen wechseln von `TEILBELEGT` zu `BELEGT / Ja`. LF zeigt
den vollständigen §-6-/§-62-VersVG-Satz. WEVIG zeigt sowohl die versicherten
Obliegenheitsverletzungen als auch die Grenzen für gesetzliche, behördliche
und vereinbarte Sicherheitsvorschriften.

**Beweist:** Semantisch vollständige Rechtsfolgensätze dürfen über
kontrollierte Sprachvarianten gefunden werden; Layoutumbrüche dürfen ihren
Inhalt nicht verstümmeln.

**Beweist nicht:** dass beliebige Rechtsbegriffe zusammengehören. Unbekannte
Formulierungen und externe Versicherer bleiben Holdouts.

## 35. V3.3.0 RC27 – Modellstabile Gemeinschaftseinrichtungen

**Beobachtungsfenster:** 29. August 2026

Ein frischer WEVIG-VS-Lauf auf RC26 bestätigte `VS-21` und `VS-28`, legte
aber eine Modellstreuung bei `VS-34` offen. Die aktivierte Klausel enthält
eine Überschrift zu gemeinschaftlichen Einrichtungen, danach den lokalen
Governor `Als mitversichert gelten` und anschließend die konkrete Definition
der versicherten Geräte. Qwen stufte die Überschrift einmal als Erwähnung und
einmal als `UNRESOLVED` ein. Der zweite Lauf wurde deshalb trotz vollständiger
Gerätedeckung auf `TEILBELEGT` herabgestuft.

RC27 bindet nur diese enge Überschrift-Governor-Struktur serverautoritativ.
Eine bloße Überschrift ohne positiven Governor bleibt modelloffen.

| Prüfung                   |                                            Ergebnis |
| ------------------------- | --------------------------------------------------: |
| Jest                      |                       93/93 Suites, 1062/1062 Tests |
| Server-Lint               |                                                PASS |
| WEVIG-VS                  | 155/155 Kandidaten, 65/65 Komponenten, 36/36 Zeilen |
| Semantischer Diff zu RC26 |                              nur `VS-34` verbessert |
| LF-Worksheet-Reichweite   |                        kein neu gebundener Kandidat |
| Zielhardware-Installation |            `v3.3.0-rc.27` / `3334616c`, Doctor PASS |

`VS-34` wechselt von `TEILBELEGT / Nicht feststellbar` zu
`BELEGT / Ja / Gemeinschaftsgeräte: EUR 15.000,00 auf Erstes Risiko`.
`VS-21` bleibt mit `EUR 6.121.600,00 auf Erstes Risiko` belegt, `VS-28` mit
sechs Monaten. Die übrigen 33 WEVIG-VS-Zeilen bleiben semantisch identisch.

**Beweist:** Ein lokal positiver Klausel-Governor kann eine sonst
modellabhängige Überschriften-Dublette deterministisch binden, ohne den Scope
auf andere Dokumente auszuweiten.

**Beweist nicht:** dass bloße Überschriften Deckung beweisen oder beliebige
Gemeinschaftsobjekte austauschbar sind.

## 36. V3.3.0 RC28 – Regressverzicht für Mieter und Haushaltsangehörige

**Beobachtungsfenster:** 29. August 2026

LF enthält einen vollständigen Regressverzicht gegenüber einem Mieter des
versicherten Gebäudes und einem mit ihm in häuslicher Gemeinschaft lebenden
Familienangehörigen. `VB-16` erkannte zuvor nur die Klauselüberschrift. Die
Begünstigten fehlten im VB-Recall, obwohl dieselbe reale Mieterklausel für
`HP-16` bereits bewiesen und abgesichert war.

RC28 überträgt den engen bestehenden Klauselvertrag auf `VB-16`. Der
Bewohnerbeleg erfordert weiterhin die ausdrückliche Haushaltsformulierung.
`VB-15` für Wohnungseigentümer wird nicht aus einer Mieterklausel abgeleitet.

| Prüfung                   |                                     Ergebnis |
| ------------------------- | -------------------------------------------: |
| Jest                      |                93/93 Suites, 1064/1064 Tests |
| Server-Lint               |                                         PASS |
| LF-VB                     | nur `VB-16` in Status und Deckung verbessert |
| WEVIG-VB                  |       36/36 Zeilen, 0 semantische Änderungen |
| Zielhardware-Installation |     `v3.3.0-rc.28` / `fc59ddf0`, Doctor PASS |

LF `VB-16` wechselt zu `BELEGT / Ja`; Regressverzicht, Bewohner und Mieter
sind jeweils aus derselben Seite-26-Klausel gebunden. `VB-15` bleibt
`UNGEKLÄRT`. WEVIG enthält die Klausel nicht und bleibt vollständig stabil.

**Beweist:** Ein bereits in einer anderen Kategorie bewiesener
Klauselvertrag darf wiederverwendet werden, wenn Rollen und Zielbedeutung
explizit getrennt bleiben.

**Beweist nicht:** dass eine Mieterklausel Wohnungseigentümer oder nicht
genannte Bewohner umfasst.

## 37. V3.3.0 RC29 – Sachverständigenverfahren vollständig belegen

**Beobachtungsfenster:** 29. August 2026

LF `VB-24` enthält auf PDF-Seite 30 ein ausdrückliches Recht des
Versicherungsnehmers, bei Uneinigkeit mit dem Versicherer-Gutachten einen
anderen Sachverständigen namhaft zu machen. Dessen Gutachten tritt an die
Stelle des Schiedsgutachterverfahrens. Der Treffer war vorhanden, wurde aber
ohne klassisches Wort wie `mitversichert` nicht als operativer Beleg gebunden.

RC29 verlangt gemeinsam drei Anker: Uneinigkeit mit dem bestellten Gutachten,
Benennungsrecht und Ersetzung des Schiedsgutachterverfahrens. Ein Titel oder
eine Sachverständigenkostenklausel allein reicht nicht.

| Prüfung                   |                                             Ergebnis |
| ------------------------- | ---------------------------------------------------: |
| Jest                      |                        93/93 Suites, 1065/1065 Tests |
| Server-Lint               |                                                 PASS |
| LF-VB                     | nur `VB-24` um den echten Verfahrensbeleg verbessert |
| WEVIG-VB                  |                   36/36 Zeilen, 0 Änderungen zu RC28 |
| LF-Artefakt               |               `RC29-LF-VB-CANDIDATE-20260829-122244` |
| WEVIG-Artefakt            |              `RC29-WEVIG-VB-CONTROL-20260829-122703` |
| Zielhardware-Installation |             `v3.3.0-rc.29` / `00b60a53`, Doctor PASS |

`VB-24` bleibt korrekt `TEILBELEGT`, weil die Kostenübernahme ausdrücklich
bedingt ist. Der dokumentierte Inhalt gewinnt aber den zuvor fehlenden
Verfahrensanspruch samt zitierter Quelle zurück.

**Beweist:** Operative Vertragsrechte benötigen rollenbezogene
Bindungsregeln; klassische Deckungswörter sind dafür nicht zwingend.

**Beweist nicht:** dass Sachverständigenüberschriften oder Kostenregelungen
automatisch ein Benennungs- oder Schiedsgutachterrecht einräumen.

## 38. V3.3.0 RC30 – Heizungsanlage in Leitungswasser vollständig belegen

**Beobachtungsfenster:** 29. August 2026

LF nennt im Leitungswasserkapitel Zentral-/Fußbodenheizungsanlagen und erklärt
eine wasserführende Fußboden- und Wandheizung ausdrücklich für mitversichert.
`LW-11` hatte Kessel und Heizkörper bereits belegt, verlor aber die
Heizungsanlage wegen der zusammengesetzten Benennung.

RC30 ergänzt die beiden realen, versichererneutralen Wortformen für die
Heizungsanlagenkomponente. Der bestehende Sparten-Scope verwirft einen
ähnlichen Treffer aus der Feuerversicherung weiterhin deterministisch.

| Prüfung                   |                                  Ergebnis |
| ------------------------- | ----------------------------------------: |
| Jest                      |             93/93 Suites, 1065/1065 Tests |
| Server-Lint               |                                      PASS |
| LF-LW                     | `LW-11` von `TEILBELEGT` zu `BELEGT / Ja` |
| WEVIG-LW                  |        36/36 Zeilen, 0 Änderungen zu RC21 |
| LF-Artefakt               |    `RC30-LF-LW-CANDIDATE-20260829-123322` |
| WEVIG-Artefakt            |   `RC30-WEVIG-LW-CONTROL-20260829-123739` |
| Zielhardware-Installation |  `v3.3.0-rc.30` / `ca7d5e32`, Doctor PASS |

**Beweist:** Ein reales Objekt darf mehreren fachlich überlappenden
Kategorien dienen, wenn Rollen- und Spartenscope separat geprüft bleiben.

**Beweist nicht:** dass jede Heizungserwähnung Leitungswasserdeckung oder eine
beliebige Produktvariante nachweist.

## 39. V3.3.0 RC31 – Dachlawine als Schnee- und Eisrutsch belegen

**Beobachtungsfenster:** 29. August 2026

WEVIG nennt im Sturmkapitel `Dachlawinen (Schnee und Eis) auf Erstes Risiko`.
Die bisherige Taxonomie erkannte daraus keine Schneerutschkomponente, obwohl
der reale Klauseltext beide Bedeutungen explizit verbindet.

RC31 ergänzt Dachlawinenformen für beide `ST-27`-Rollen. Eine
serverseitige Positivbindung verlangt gemeinsam Klammerzusatz, Erstrisiko und
Sturm-Scope. Der gemeinsame Span bleibt damit enger als eine allgemeine
Lawinensuche.

| Prüfung                   |                                      Ergebnis |
| ------------------------- | --------------------------------------------: |
| Jest                      |                 93/93 Suites, 1067/1067 Tests |
| Server-Lint               |                                          PASS |
| WEVIG-ST                  | nur `ST-27` von `TEILBELEGT` zu `BELEGT / Ja` |
| LF-ST                     |            36/36 Zeilen, 0 Änderungen zu RC25 |
| WEVIG-Artefakt            |     `RC31-WEVIG-ST-CANDIDATE-20260829-125259` |
| LF-Artefakt               |          `RC31-LF-ST-CONTROL-20260829-125402` |
| Zielhardware-Installation |      `v3.3.0-rc.31` / `b21f7a8b`, Doctor PASS |

**Beweist:** Ein etablierter Versicherungsbegriff kann mehrere atomare Rollen
belegen, wenn derselbe operative Klauselspan die gemeinsame Bedeutung trägt.

**Beweist nicht:** dass jede Lawinenerwähnung einen Schneerutsch oder eine
operative Deckung nachweist.

## 40. V3.3.0 RC32 – Haftpflichtsummen aus Produktübersichten

**Beobachtungsfenster:** 29. August 2026

WEVIG führt im Haftpflichtkapitel eine eigenständige
`Pauschalversicherungssumme` von EUR 3 Mio. sowie eine mitversicherte
Bauherrenhaftpflicht mit EUR 1 Mio. Gesamtbaukosten an. Die bisherige
Taxonomie kannte nur ausführlichere Satzformen; beide Tabellenzeilen blieben
deshalb vollständig ungeklärt.

RC32 ergänzt die kompakten Produktformen und bindet sie nur im
Haftpflicht-Scope. Eine eigenständige Pauschalsumme wird von späteren
Sublimit- und Kostenreferenzen unterschieden. Für `HP-08` wird ausschließlich
die grammatisch an `Gesamtbaukosten` gebundene Grenze materialisiert; ein
danebenstehendes Haftpflicht-Sublimit fließt nicht in dieses Tabellenfeld ein.

| Prüfung                   |                                             Ergebnis |
| ------------------------- | ---------------------------------------------------: |
| Jest                      |                        93/93 Suites, 1079/1079 Tests |
| Server-Lint               |                                                 PASS |
| WEVIG-HP                  | `HP-01` und `HP-08` von `UNGEKLÄRT` zu `BELEGT / Ja` |
| LF-HP                     |      bestehende Baukostengrenze vollständig erhalten |
| WEVIG-Artefakt            |            `RC32-WEVIG-HP-CANDIDATE-20260829-131001` |
| LF-Artefakt               |                 `RC32-LF-HP-CONTROL-20260829-131801` |
| Zielhardware-Installation |             `v3.3.0-rc.32` / `a39f90db`, Doctor PASS |

WEVIG `HP-01` enthält nun EUR 3 Mio. `HP-08` enthält nur EUR 1 Mio.
Gesamtbaukosten und nicht zusätzlich das EUR-3-Mio.-Haftpflicht-Sublimit. LF
`HP-08` bleibt mit den beiden vertraglichen Alternativen EUR 440.000 oder
20 % des Gebäudeneuwerts belegt. Andere LF-Unterschiede beschränken sich auf
bedeutungsgleiche Qwen-Textwiedergabe bei unverändertem Status, Betrag und
derselben Quelle.

**Beweist:** Kompakte Produktübersichten können deterministisch ausgewertet
werden, wenn Zielrolle, Spartenscope und Wert-Governor getrennt geprüft werden.

**Beweist nicht:** dass eine referenzierte Pauschalsumme, ein Sublimit oder
eine Kostenanrechnung die allgemeine Personen-/Sachschadendeckung nachweist.

## 41. V3.3.0 RC33 – Schadenservice und Ansprechpartner

**Beobachtungsfenster:** 29. August 2026

WEVIG nennt auf PDF-Seite 6 ein kostenloses Schadenmanagement unter
`0800 204 44 00`, das rund um die Uhr eine telefonische Schadenmeldung sowie
Beratung und Hilfestellung ermöglicht. `VB-36` blieb dennoch vollständig
ungeklärt, weil diese Serviceform nicht als Schadenabwicklung und Kontaktweg
erkannt wurde.

RC33 ergänzt die reale Form `telefonische Schadenmeldung` für beide atomaren
Rollen. Die Positivbindung verlangt zusätzlich Schadenmanagement,
Telefonnummer, 24-Stunden-Erreichbarkeit und Unterstützungsleistung im selben
lokalen Kontext.

| Prüfung                   |                                          Ergebnis |
| ------------------------- | ------------------------------------------------: |
| Jest                      |                     93/93 Suites, 1085/1085 Tests |
| Server-Lint               |                                              PASS |
| WEVIG-VB                  |      nur `VB-36` von `UNGEKLÄRT` zu `BELEGT / Ja` |
| LF-VB                     |                    36/36 Zeilen exakt unverändert |
| WEVIG-Artefakt            |             `RC33-WEVIG-VB-FINAL-20260829-134237` |
| LF-Artefakt               |              `RC33-LF-VB-CONTROL-20260829-134520` |
| Zielhardware-Installation |          `v3.3.0-rc.33` / `3ef0e950`, Doctor PASS |
| WEVIG-Fullrun             | 320/320 Zeilen, 15 Verbesserungen, 0 Regressionen |
| LF-Fullrun                | 320/320 Zeilen, 17 Verbesserungen, 0 Regressionen |

**Beweist:** Ein Serviceblock kann beide Zielrollen belegen, wenn Leistung und
konkreter Kontakt gemeinsam und quellengebunden vorkommen.

**Beweist nicht:** dass allgemeine Kundenservice- oder Beschwerdekontakte eine
Schadenabwicklungsregel darstellen.

Die kumulative Vollabnahme des exakt installierten RC33-Tags liegt in
`RC33-WEVIG-ALL-CATEGORIES-20260829-135136` und
`RC33-LF-ALL-CATEGORIES-20260829-145113`. Beide Läufe bestehen sämtliche
technischen Gates. Gegenüber den alten Fullruns RC11/RC12 gibt es zusammen
32 Statusverbesserungen bei 640 vollständig erzeugten Tabellenzeilen und
keine Statusverschlechterung.

## 42. V3.3.1 – evidenzgebundener Hybridfallback

**Beobachtungsfenster:** 30. August 2026

Der vollständige V3.2.1/RC33-Vergleich zeigte echte Recall-Verluste des engen
Occurrence-Pfads, während der alte breite Promptweg gleichzeitig gefährliche
Scope- und Polaritätsverbindungen erzeugte. Eine reine Similarity-Schwelle
war ebenfalls ungeeignet: Sie erreichte nicht alle positiven Kontrollen und
ließ fünf falsche Kandidaten zu.

V3.3.1 verwendet das historische `3000/250`-Chunking deshalb nur für
Navigation. Dinghy rankt maximal drei Chunks je atomarem Ziel; Qwen darf
daraus nur einen exakten Originalspan wählen. Eindeutigkeit, Zielanker,
Offset, Länge und Originalsubstring werden serverseitig geprüft. Erst danach
laufen unverändert Rollen-/Scope-Triage, Wirkungsprüfung und Tabellenrollup.

Im ersten WEVIG-27B-Versuch enthielt der gewählte Kontext noch eine
benachbarte Ausschlussklausel. Beide Hybridziele wurden zwar als direkt
klassifiziert, die Wirkung blieb aber fälschlich negativ. Die Root Cause war
die Kontextgrenze, nicht Retrieval oder PDF-Erfassung. Nach Übergabe nur des
exakten positiven Spans wurde `HP-12` korrekt positiv.

Eine zweite Nebenwirkung traf `HP-25`, weil die Hybridpräzisierung zunächst
global im gemeinsamen Triage-Prompt stand. Nach Isolation in einen nur für
Hybridziele geladenen Zusatzprompt ist der normale Prompt-Hash wieder exakt
identisch zur Basis.

| Prüfung                                    |                             Ergebnis |
| ------------------------------------------ | -----------------------------------: |
| fokussierte Verträge                       |              4/4 Suites, 79/79 Tests |
| vollständige Regression unter Node 22.23.2 |        94/94 Suites, 1098/1098 Tests |
| WEVIG / Qwen 3.8 27B Triage                |      38/38 Kandidaten und Kontrollen |
| WEVIG / Qwen 3.8 27B Wirkung               |     63/63 Komponenten und Kontrollen |
| WEVIG HP-Endtabelle                        |                         36/36 Zeilen |
| semantischer Diff zur Basis                | nur `HP-12` verbessert; 35/35 stabil |
| GRAWE-Nichtaktivierung                     |       0 zugelassene Hybridkandidaten |
| UNIQA-Nichtaktivierung                     |       0 zugelassene Hybridkandidaten |

`HP-12` wechselt von `Umweltschäden: ausgeschlossen / Nein` zu
`Umweltschäden: eingeschlossen / Ja`. Quelle ist ausschließlich der exakte
positive Versicherungsschutzspan auf PDF-Seite 16. `HP-25` und alle übrigen
HP-Zeilen sind exakt identisch zur kontrollierten Basis.

**Beweist:** Breite semantische Navigation kann einen realen Recall-Verlust
zurückgewinnen, wenn ausschließlich ein servervalidierter exakter Span in die
vorhandenen Faktengates gelangt. Die Promptisolation schützt normale
Kandidaten vor Hybrid-Nebenwirkungen.

**Beweist nicht:** vollständige HP-Fachrichtigkeit, beliebige Polizzen,
Multi-Dokument-Ranglogik oder 99 Prozent. GRAWE und UNIQA waren nur
Nichtaktivierungskontrollen, keine vollständigen Expertenoracles.

## 43. Vier Fehlalarme aus dem Zehn-Dokumente-Vergleich

**Beobachtungsfenster:** 30. August 2026

Der vollständige A/B-Lauf der Session
`5a8c6b3d-94fa-4ed9-84bc-4fff2cfa1e85` materialisierte 3.200
dokumentbezogene Rohzeilen und 320 Paketzeilen. Vier Paket-B-Zeilen standen
auf `RANGFOLGE_PRÜFEN`: `VS-25`, `LW-20`, `HP-36` und `VB-14`.

Der Lauf verwendete Release-ID `50130ae31ed68509ba008b28d8a22dcceea871d4`.
Damit fehlten ihm spätere V3-Korrekturen gegen Scope-Leakage und für
bedingte Vorsatzausschlüsse. Die gespeicherten Run-Artefakte wurden nicht
verändert. Stattdessen wurden ihre Original-Rows und Original-Occurrences im
isolierten Mac-Studio-Prüfworktree mit dem neuen deterministischen Code
erneut abgespielt.

| Fall    | Root Cause                                                                                     | Ergebnis des Artefakt-Replays                                                 |
| ------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `VS-25` | 5 % des NBW und der exakt berechnete Absolutbetrag wurden als verschiedene Textwerte behandelt | `TEILBELEGT / Ja / EUR 1.530.400,00 auf Erstes Risiko`; kein Rangfolgenfehler |
| `VB-14` | EUR 5 Mio. mit und ohne Dezimalstellen wurden als verschiedene Textwerte behandelt             | `BELEGT / Ja / EUR 5.000.000,00 auf Erstes Risiko`                            |
| `LW-20` | Ein Sturm-Ausschluss und ein Leitungswasser-Ausschluss wurden zusammengeführt                  | Sturmfundstelle `MENTION_ONLY`; Leitungswasserfundstelle `EXCLUDED`           |
| `HP-36` | `nicht ... vorsätzlich` war durch PDF-Zeilenumbrüche getrennt                                  | `DIRECT / EXPLICIT_NEGATIVE_CLAUSE_GOVERNOR / EXCLUDED`                       |

Die erste Erweiterung des mehrzeiligen Negativbinders übernahm
`exklusive` fälschlich in den nächsten Listenpunkt. Ein vorhandener
Nachbartest erkannte diese Regression. Die finale Fassung erlaubt nur dem
engen Vorsatzmuster den begrenzten Zeilenübergriff; der allgemeine
`exklusive`-Binder bleibt lokal.

| Prüfung auf Mac Studio                                        |                                                                       Ergebnis |
| ------------------------------------------------------------- | -----------------------------------------------------------------------------: |
| angrenzende Policy-Analyse-/Vergleichstests                   |                                                      8/8 Suites, 173/173 Tests |
| vollständige Jest-Regression mit definiertem Prozessabschluss |                                                98/98 Suites, 1.130/1.130 Tests |
| Prettier der vier geänderten Code-/Testdateien                |                                                                           PASS |
| ESLint                                                        | Infrastruktur-Blocker: ESLint 9 und vorhandenes React-Plugin sind inkompatibel |

Der normale vollständige Jest-Aufruf meldet ebenfalls 1.130 bestandene
Tests, endet aber wegen eines bestehenden asynchronen Model-Pricing-Loggers
mit Exit 1. Mit `--forceExit` endet derselbe Bestand nach 1.130 PASS regulär.
Dieser Prozessfehler wurde nicht als fachlicher Testfehler der vier Änderungen
umgedeutet.

**Beweist:** Die vier konkreten Fehlalarme besitzen wiederverwendbare,
serverseitige Korrekturen: centgenaue Wertidentität, streng belegte
NBW-Ableitung, expliziter Spartenscope und eng begrenzte mehrzeilige
Negativ-Governors.

**Beweist nicht:** dass der alte Modelllauf den neuen Code ausgeführt hat,
dass weitere Dokumentrang- oder Ersetzungsfragen gelöst sind oder dass eine
99-Prozent-/Fremdversichererfreigabe vorliegt. Dafür ist ein frischer Lauf mit
versioniertem neuen Build und weiterhin ein zuvor unbekannter Expertenholdout
erforderlich.

## 44. Regelgebundene Punktentscheidung V2

**Beobachtungsfenster:** 30. August 2026  
**Implementierungsstand:** `b761e3c4`

Der bisherige Ergebnis-Builder verglich gerenderte Paketstrings. Das reichte
für einen technischen Diff, aber nicht für ein belastbares „Wer ist warum
besser?“. Die neue reine Serverschicht liest deshalb pro Requirement die
atomaren Komponenten, Faktrollen, Coverage Effects, Dokumentgeltung,
Scopebild, Requested-Field-Status, typisierte Werte, Qualifier und
servergebundenen Quellen.

Zwei zusätzliche Adversarial-Gates wurden dabei geschlossen:

- Gleiche Klausel und gleicher Geldbetrag bleiben verschieden, wenn beide
  Seiten ausdrücklich unterschiedliche Perioden wie `je Ereignis` und
  `Jahreshöchstlimit` nennen.
- Eine Neubauwertbasis darf nur aus einer Zeile mit Prüfstatus `BELEGT`
  stammen. Teilbelegte oder ungeklärte Basen dürfen Prozent-/Absolutwerte
  nicht künstlich versöhnen.

| Prüfung auf Mac Studio                       |                                                 Ergebnis |
| -------------------------------------------- | -------------------------------------------------------: |
| fokussierte Decision-/Result-/V1-UI-Verträge |                                  3/3 Suites, 21/21 Tests |
| vollständige Regression, Node 18.18.0        |                          90/90 Suites, 1.039/1.039 Tests |
| Prettier der geänderten Dateien              |                                                     PASS |
| Frontend-Produktionsbuild                    |                                                     PASS |
| gespeicherter Zehn-Dokumente-Replay          |                                           320/320 Zeilen |
| Punktentscheidungen                          | 0 A / 1 B / 7 gleich / 9 nicht vergleichbar / 303 unklar |
| freigegebener Vorteil                        | `LW-22`: B eingeschlossen, A ausdrücklich ausgeschlossen |

Die Gleichwertigkeiten betreffen `FE-A04`, `FE-A06`, `ST-04`,
`ST-06`, `ST-16`, `ST-26` und `HP-26`. Alte Schema-V1-Ergebnisse
werden nicht rückwirkend verändert, sondern von der UI mit dem vorhandenen
Prüfhinweis als `UNKLAR` dargestellt.

**Beweist:** Die Software kann innerhalb eines vollständig belegten,
vergleichbaren atomaren Scopes deterministisch und quellengebunden einen
Punktvorteil oder Gleichwertigkeit begründen. Einseitig fehlende Evidenz,
Mixed-/Conditional-/Option-Fälle, Rangfragen, Quellenfehler,
Periodenunterschiede und gemischte Gewinner bleiben fail-closed.

**Beweist nicht:** Fachrichtigkeit aller 320 Zeilen, Rang und Ersetzung in
beliebigen Mehrdokumentpaketen, einen Gesamtvertragssieger, das Laufzeitbudget,
einen frischen End-to-End-Lauf des neuen Builds, unbekannte
Versicherer-Holdouts oder 99 Prozent.

## 45. V3.4.0: frischer Zehn-Dokumente-Lauf und bedingungssichere Punktentscheidung

**Beobachtungsfenster:** 30.–31. August 2026
**Release:** `v3.4.0` / `977ed40f`

Der frische RC1-Lauf verwendete eine LF-Hauptpolizze als Paket A und eine
WEVIG-Hauptpolizze samt acht Zusatz-/Bedingungsdokumenten als Paket B. Auf dem
Mac Studio mit `qwen/qwen3.8-27b` und `dinghy-embed` wurden 10/10 Dokumente,
80/80 Dokument-Kategorie-Schritte und 320/320 Vergleichszeilen ohne
Verarbeitungsfehler abgeschlossen. Die Laufzeit betrug ungefähr vier Stunden.

Die erste Punktentscheidung aus einem älteren Replay hatte `LW-22` als
`VORTEIL_B` bewertet; der frische Lauf machte beide Seiten `EXCLUDED` und
damit `GLEICHWERTIG`. Die Originalklausel enthält jedoch direkt nach
Holzfäule, Vermorschung und Schwamm eine Rückausnahme. Beide binären
Interpretationen waren daher als sichere Punktentscheidung zu stark.

Ein erster Guard über den gesamten Kandidatenkontext korrigierte `LW-22`,
blockierte aber auch `FE-A04`, weil eine weit entfernte oder definitorische
„wenn“-Formulierung enthalten war. Der finale Guard verwendet nur einen
offsetgebundenen lokalen 240-Zeichen-Kontext und trennt starke
Ausnahme-/Bedingungsmarker von einem deckungsbezogenen `wenn/falls`.

| Prüfung auf Mac Studio  |                                                    Ergebnis |
| ----------------------- | ----------------------------------------------------------: |
| fokussierte Verträge    |                                     2/2 Suites, 23/23 Tests |
| vollständige Regression |                             90/90 Suites, 1.043/1.043 Tests |
| Prettier                |                                                        PASS |
| frischer Artefaktreplay |                                              320/320 Zeilen |
| finaler Punktentscheid  |   0 A / 0 B / 4 gleich / 11 nicht vergleichbar / 305 unklar |
| gezielte Änderungen     | `LW-22`, `ST-16`, `HP-26`: gleich/älterer Vorteil -> unklar |
| negative Kontrolle      |           `FE-A04` bleibt gleichwertige Gefahren-Definition |
| XLSX                    |                           8 Blätter, jeweils 18 Spalten A–R |
| Installation            |                                       `v3.4.0`, Doctor PASS |

Die neue RC2-Ausgabe liegt neben der unveränderten RC1-Ausgabe im selben
privaten Run-Verzeichnis; die persistente Session verweist auf `result-rc2`.
Es war kein neuer Modelllauf nötig, weil ausschließlich die deterministische
Vergleichsschicht aus den vollständig gespeicherten Artefakten neu erzeugt
wurde.

**Beweist:** Der technische Upload-bis-Export-Weg funktioniert für das
dokumentierte Zehn-Dokumente-Paket. Bedingungen und Ausnahmen verhindern
einen nicht belegbaren Vorteil oder Gleichstand, ohne eine reine Definition
zu sperren.

**Beweist nicht:** fachliche Richtigkeit aller 320 Zeilen, eine sichere
Vorteilsmenge in anderen Verträgen, unbekannte Versicherer, Dokumentrang und
Ersetzung, das Ein-Stunden-Laufzeitbudget oder 99 Prozent.

## 46. Qualifizierter Negativbefund für VS-16

Geprüft wurde der exakte Codecommit
`a4e286d6395de9c921098d2883f72d4e13391f90` auf dem Mac Studio in
`/tmp/pv3-validate-a4e286d6` mit Node `v26.7.0`, npm `11.19.0` und ohne
Modelllauf oder Kunden-PDF.

| Prüfung                                            |                       Ergebnis |
| -------------------------------------------------- | -----------------------------: |
| fokussierte und angrenzende Jest-Verträge          |    11/11 Suites, 189/189 Tests |
| Prettier über alle geänderten Produkt-/Testdateien |                           PASS |
| ESLint geänderte Serverquellen                     |                           PASS |
| ESLint PolicyComparisonPanel                       |                           PASS |
| Frontend-Produktionsbuild                          | PASS, Vite 4.5.3, 6.170 Module |

Synthetisch belegt sind:

- ausdrückliches `INCLUDED` gegen qualifiziertes Nichtfinden ergibt den
  richtigen A-/B-Vorteil;
- die Begründung nennt ausdrücklich, dass kein Vertragsausschluss belegt ist;
- beidseitiges qualifiziertes Nichtfinden ergibt
  `KEIN_DOKUMENTIERTER_VORTEIL`;
- eine textlose physische Seite kippt den Befund auf `SEARCH_INCOMPLETE`;
- Groß-/Kleinschreibung und PDF-Zeilentrennung funktionieren für kontrollierte
  Garagen-/Stellplatzbegriffe;
- Garagentor, Garagenhaftpflicht, Garagengasse und Parkverbot erzeugen keine
  falschen Objekt-Treffer;
- Prompt und Vollkatalog bleiben in vollständiger Zeilen-/Labelparität; der
  historische Pilotkatalog wird nicht umgeschrieben.

Der direkte ESLint-Aufruf auf der vorhandenen CommonJS-Presenterdatei meldet
weiterhin `module/no-undef`, weil die Frontend-ESLint-Konfiguration `.cjs`
nicht als Node/CommonJS behandelt. Die Datei wird durch Jest ausgeführt; diese
Konfigurationswarnung ist keine neue Produktregression.

Nicht belegt sind gemischte PDFs mit seitenweiser OCR, fremde
Versichererformulierungen, Vollständigkeit aller Synonyme oder eine globale
Aktivierung außerhalb `VS-16`.
