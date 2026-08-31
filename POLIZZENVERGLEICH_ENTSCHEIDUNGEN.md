# Polizzenvergleich – Architekturentscheidungen und Loop-Schutz

Stand: 25. August 2026
Entscheidungsbasis: reale Kunden-Mac-Messungen bis `policy-v0.3.22`

## 1. Verwendung

Dieses Dokument hält nicht nur den Zielzustand fest, sondern auch verworfene
Alternativen und ihre Begründung. Ein verworfener Ansatz darf nicht erneut als
„neuer Fix“ implementiert werden, solange keine neue Evidenz seine damalige
Root Cause widerlegt.

Statuswerte:

- **AKZEPTIERT** – verbindliche Richtung,
- **BEGRENZT** – nur in ausdrücklich genanntem Scope zulässig,
- **VERWORFEN** – nicht erneut versuchen,
- **ZU EVALUIEREN** – noch keine Produktionsentscheidung.

## ADR-001: Basisindex und Faktenanalyse sind getrennte Phasen

**Status:** AKZEPTIERT

### Entscheidung

PDF/OCR, kanonische Page-Map, Basis-FTS und Basis-Lance/Dinghy werden dauerhaft
abgeschlossen, bevor eine generative Faktenanalyse beginnt. Ein Analysefehler
darf den Basisindex nicht zurückrollen.

### Begründung

In früheren Releases lief das Inventar synchron im `afterEmbedded`-Hook.
Timeout, JSON- oder Evidence-Fehler löschten dadurch bereits erfolgreiche
Vektoren und FTS-Daten. Das vermittelte fälschlich, die PDF-Indexierung sei
kaputt.

### Invariante

`comparison_documents.status=ready` bezeichnet ausschließlich den fertigen
Basisindex. Analysezustand wird separat geführt.

## ADR-002: Kein großes generatives Vollinventar im kritischen Pfad

**Status:** VERWORFEN

### Verworfener Ansatz

Alle Seiten oder fast alle Clause Blocks werden vor einer Antwort seriell an
Qwen geschickt, damit das Modell ein vollständiges JSON-Inventar erzeugt.

### Evidenz

- Gemma: 7.616 Inputtokens, 1.535 Outputtokens, 90 Sekunden, JSON unvollständig.
- Qwen `v0.3.22`: 690 Blocks, davon 577 nach Minuten weiter ambig.
- Elf erfolgreiche Calls benötigten zusammen etwa 446 Sekunden.
- Extrapolierte Restlaufzeit deutlich über eine Stunde.

### Entscheidung

`ensureForDocuments()` darf nicht mehr Voraussetzung jeder konkreten
Dokumentfrage sein. Weitere JSON-, Grounding-, `unitKey`- oder
Batchgrößen-Hotfixes gelten nicht als Lösung der Root Cause.

## ADR-003: Occurrence-zentrierter Pfad für konkrete exhaustive Fragen

**Status:** AKZEPTIERT, als nächster Umsetzungsschritt

### Entscheidung

Konkrete Themenfragen werden nicht über Top-K-RAG und nicht über ein
Vollinventar beantwortet. Der Server enumeriert zunächst alle kontrollierten
exakten Vorkommen in Clause-Block-FTS und ergänzt sie semantisch mit Dinghy.

### Ablauf

1. Prompt in fachliches Thema, echte Qualifier und Ausgabeanforderung trennen.
2. Versionierte Aliasgruppe und kontrollierte Präfixe expandieren.
3. Alle run-/dokumentgescopten FTS-Treffer paginiert enumerieren.
4. Trefferfenster anhand Clause Blocks, Heading-Pfad, Nachbarordinalen,
   Tabellenkopf und Variante bilden.
5. Dinghy-Kandidaten additiv ergänzen und gegen Dokumentscope validieren.
6. Beträge, Prozente, Zeiträume, Negationen und Bedingungen deterministisch
   extrahieren.
7. Nur mehrdeutige Gruppen an ein Modell senden.
8. Code rendert alle validierten Fakten und Quellen.

### Nicht zulässig

- globale Top-N-Kürzung,
- FTS5 als implizites deutsches Stemming,
- pauschale `±3` Vollseiten pro Treffer,
- Qwen-Auswahl der Ergebniszeilen,
- fehlender Keywordtreffer als Beweis der Nichtexistenz.

## ADR-004: Clause-Struktur statt Seitenfenster als primärer Kontext

**Status:** AKZEPTIERT

### Entscheidung

Die physische Seite bleibt Provenienz und äußerer Kontextdeckel. Die primäre
fachliche Kontextgrenze bilden:

- Überschriftspfad,
- Klauselblock,
- fortgesetzte Nachbarblöcke,
- Tabellenkopf und Tabellenzeile,
- Gültigkeits-/Variantenscope,
- nächster stabiler Heading-Wechsel.

### Begründung

Mehrere rohe Seiten pro Treffer können bei zehn Treffern nahezu das gesamte
21-Seiten-Dokument erneut in Modellprompts kopieren. Außerdem sind Seiten keine
verlässlichen Klauselgrenzen; eine Klausel kann über eine Seite fortgesetzt
werden oder eine Seite kann viele Sparten enthalten.

## ADR-005: SQL/FTS/Dinghy/LLM haben getrennte Rollen

**Status:** AKZEPTIERT

| Komponente                | Verbindliche Rolle                                                                    | Darf nicht                                                      |
| ------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| SQLite                    | Scope, Ledger, Checkpoints, vollständige Enumeration, Joins, atomare Veröffentlichung | semantische Bedeutung erfinden                                  |
| FTS5                      | exakte Phrasen/Tokens und kontrollierte Präfixe                                       | als Synonym- oder Stemmingmaschine gelten                       |
| Alias-Katalog             | bekannte Schreibweisen und Synonyme additiv erweitern                                 | Vollständigkeit definieren                                      |
| Dinghy                    | Paraphrasen und unbekannte semantische Beziehungen als Kandidaten finden              | sichere Negativbehauptungen liefern                             |
| kleines Extraktionsmodell | kompakte, ambige Klauselgruppen klassifizieren                                        | dauerhaft zusätzlich neben Qwen geladen werden, bevor evaluiert |
| Qwen                      | schwierige Klauseln und beleggebundene Endformulierung                                | alle Blocks inventarisieren oder Rows auswählen                 |
| Servercode                | Faktenmenge, Rollen, Quellen und sämtliche Rows besitzen                              | unvalidierte Modellaussagen publizieren                         |

## ADR-006: Vollständigkeit bedeutet terminale Primärblock-Coverage

**Status:** AKZEPTIERT

### Entscheidung

Jeder nichtleere Primärblock endet begründet in genau einer Klasse:

- deterministisch erkannte Fakten,
- positiv nachgewiesener technischer Nicht-Inhalt,
- modellvalidierte Fakten,
- modellverifiziert ohne Vertragsfakt,
- retrybarer Fehler.

Fehlende bekannte Risikosignale dürfen niemals allein `kein Fakt` bedeuten.

### Vollständigkeitsgrenze

Diese Zustände beweisen Prozesscoverage, nicht juristische Unfehlbarkeit. Für
höhere Sicherheit kann ein späterer Audit-Pass über `no_fact`-Blöcke laufen.

## ADR-007: Fakten sind belegpositionsgebunden und mehrwertig

**Status:** AKZEPTIERT

### Entscheidung

Ein Clause Block kann null bis mehrere Fakten erzeugen. Deckung, Limit,
Selbstbehalt, Ausschluss, Bedingung und Obliegenheit bleiben getrennte Fakten,
auch wenn sie dasselbe Thema tragen.

Ein Fakt besitzt mindestens:

- run-scoped Identität,
- Thema und Faktrolle,
- Gültigkeits-/Variantenscope soweit belegbar,
- strukturierte Werte,
- Primärblock,
- eine oder mehrere exakte Evidenzspannen,
- physische Seite oder bewusst `null`.

Kein Dedupe allein anhand des Themenlabels.

## ADR-008: Atomare Staging-Publikation

**Status:** AKZEPTIERT und implementiert

### Entscheidung

Jeder Analyseversuch besitzt eine `analysisRunId`. Alle Child-Artefakte gehören
zu genau diesem Lauf. Ein Dokument zeigt über `publishedAnalysisRunId` auf den
letzten vollständig validierten Snapshot.

### Folgen

- Fehler und Neustart lassen Published unverändert.
- Checkpoints eines Staging-Laufs bleiben retrybar.
- Published Daten sind immutable.
- Source-/Pipelineversionen werden nicht vermischt.
- Cleanup löscht nur bekannte run-scoped Artefakte.

## ADR-009: Modelloperationen werden global serialisiert

**Status:** AKZEPTIERT und implementiert

### Entscheidung

Alle LM-Studio-Generierungen und Dinghy-Embeddings im Vergleichspfad verwenden
eine gemeinsame Lease. Ein Caller-Timeout löst die Lease erst nach tatsächlichem
Provider-Settlement.

### Begründung

Auf dem 32-GB-Mac führten überlappende Chat-/Embeddinglast und mehrere geladene
Chatmodelle zu Swap, Decodefehlern und einem scheinbar hängenden System.

### Grenze

Serialisierung verhindert Ressourcenfehler, macht eine lineare Kette aus
hunderten Calls aber nicht akzeptabel schnell.

## ADR-010: Genau ein geladenes Chatmodell

**Status:** AKZEPTIERT

### Entscheidung

- Standard: Qwen 3.8 27B, Kontext 32768, Parallelität 1.
- Dinghy 4B bleibt der einzige verwaltete Embedder.
- Gemma ist als alternative Chatwahl technisch möglich.
- Beim Wechsel wird das zuvor verwaltete Chatmodell fail-closed entladen.
- Qwen und Gemma werden niemals gleichzeitig geladen.

### Gemma-Lehre

Gemma war nur etwa 0,44 GB kleiner als Qwen. Der Engpass war nicht dieser
Unterschied, sondern lange generative Ausgabe und zeitweilig konkurrierende
Operationen. Ein Modellwechsel ersetzt keine passende Verarbeitungspipeline.

## ADR-011: Kleineres Extraktionsmodell erst nach Goldstandard-Eval

**Status:** ZU EVALUIEREN

### Zulässige Evaluation

Ein kleines Modell darf auf einem Entwicklerrechner ausschließlich technisch
und anhand anonymisierter Golden Cases geprüft werden. Es darf Qwen in der
Extraktionsphase nur ersetzen, wenn es:

- dieselbe Fakt-/Evidenzcoverage erreicht,
- deutlich weniger Laufzeit benötigt,
- die Rollen des Vandalismus-Goldfalls getrennt erhält,
- Varianten- und Dokumentisolation einhält,
- keinerlei neue Halluzinationsklasse öffnet.

Es wird auf dem Kunden-Mac nicht als drittes Modell zusätzlich dauerhaft
geladen. Falls verwendet, erfolgt ein kontrollierter Phasenwechsel
Small-Extractor -> unload/settle -> Qwen-Endformulierung.

## ADR-012: Das Modell formuliert, der Server besitzt die Rows

**Status:** AKZEPTIERT und teilweise implementiert

### Entscheidung

Der Server enumeriert alle validierten Fakten, gruppiert sie unter harten
Dokument-/Varianten-/Clause-Grenzen und erzeugt stabile Row-IDs. Ein Modell darf
nur Zellen fester Row-IDs umformulieren.

### Gate

Die zurückgegebenen Row-IDs müssen exakt der geplanten Menge entsprechen.
Fehlende, unbekannte oder doppelte IDs führen zum deterministischen Fallback,
niemals zum Weglassen einer Zeile.

## ADR-013: Keine normalen Tiefenanalyse-Buttons als Prozessvoraussetzung

**Status:** AKZEPTIERT für das Zielprodukt

Der Benutzer lädt null, ein oder zwei Dokumente hoch und sendet Prompts. Die
Pipeline entscheidet intern zwischen normalem Chat, konkreter Themenanalyse und
vollständiger Auswertung. Manuelle Buttons dürfen kein notwendiger Teil des
Maklerprozesses sein.

Diese Entscheidung ist keine Einladung, automatisch nach jedem Upload einen
stundenlangen Qwen-Lauf zu starten. Automatisierung muss aus einem effizienten,
checkpointbaren Verarbeitungskern entstehen.

## ADR-014: Testgate und reale Abnahme sind zwei getrennte Gates

**Status:** AKZEPTIERT

### Entscheidung

Ein Release benötigt:

1. fokussierte Regressionstests,
2. genau einen vollständigen technischen Gate-Lauf,
3. realistische anonymisierte Coverage- und Laufzeitmessung,
4. technische Kunden-Mac-Abnahme mit dem tatsächlichen Modell.

`43 Suites / 296 Tests PASS` in `v0.3.22` bewies Datenintegrität und viele
Fehlerpfade, aber nicht die betriebliche Laufzeit. Kein Release darf erneut nur
aufgrund grüner Unit-Tests als fachlich kundenfähig bezeichnet werden.

## 2. Loop-Schutz vor jeder neuen Änderung

Vor Implementierung sind fünf Fragen schriftlich zu beantworten:

1. Welcher reale Fehler oder welche konkrete Abnahme wird adressiert?
2. Ist die Root Cause Datenfindung, Modellsemantik, Persistenz, Ressourcenlast
   oder Darstellung?
3. Welche bereits verworfene Lösung ähnelt dem Vorschlag?
4. Welche Metrik muss sich messbar verbessern?
5. Was beweist der fokussierte Test ausdrücklich **nicht**?

Wenn die Änderung nur ein neues Modelllabel, eine größere Batchgröße, ein
höheres Outputlimit oder einen weiteren Retry ergänzt, ohne die Anzahl der
notwendigen Modellaufrufe zu reduzieren, ist sie für das aktuelle Hauptproblem
abzulehnen.

## 3. Priorisierte Umsetzung

### Jetzt

1. Clause Blocks/Clause-FTS für konkrete Fragen ohne Vollanalyse verfügbar
   machen.
2. Exhaustive Selfbehalt-Pfad implementieren und messen.
3. Dinghy als additive semantische Erweiterung verdrahten.
4. Server-owned Rendering aller Treffer.
5. Golden A/B und reale Laufzeit abnehmen.

### Danach

1. Limits/Höchstentschädigungen,
2. Ausschlüsse,
3. Obliegenheiten,
4. versicherte Sachen,
5. Deckungspositionen und Sparten,
6. vollständigen Maklerprompt aus der vollständigen Faktenunion.

### Später

- kleines Extraktionsmodell evaluieren,
- Heading-Fortsetzung über Seiten verbessern,
- Tabellengeometrie/Variantenzuordnung ausbauen,
- optionaler Audit-Pass für `no_fact`,
- progressive Hintergrundanreicherung nur bei bewiesener Notwendigkeit.

## ADR-015: Exhaustive Selbstbehalt-Abfrage vor dem Vollinventar

**Status:** IMPLEMENTIERT, fachliche Freigabe wegen Rollenassoziation `REVISE`

Die gezielte Frage nach Selbstbehalten wird vor `ensureForDocuments()`
geroutet. Sie darf keinen vollständigen Qwen-Faktenlauf starten.

Der Pfad:

1. baut beziehungsweise verwendet das vollständige, source-hash-gebundene
   Clause-Block-Ledger,
2. enumeriert sämtliche exakten FTS-Fundstellen der versionierten
   Selbstbehalt-Aliasgruppe ohne Top-K-Grenze,
3. nutzt vorhandene beziehungsweise dabei erzeugte Dinghy-Blockembeddings nur
   additiv,
4. übernimmt ausschließlich deterministisch belegte Selbstbehalt-Fakten,
5. verbindet Beträge und Bedingungen innerhalb des Belegblocks oder eines
   unmittelbar kompatiblen Tabellen-Nachbarblocks,
6. rendert alle Zeilen im Servercode mit physischer PDF-Seite.

Qwen wählt in diesem Pfad keine Treffer oder Zeilen aus. Der aktuelle erste
vertikale Schnitt benötigt für die Antwort null generative Modellaufrufe.
Ein bereits veröffentlichter Analyse-Run wird unverändert wiederverwendet; eine
kurze Frage erzeugt daneben keinen neuen Staging-Run.

### Nachschärfung nach dem ersten Systemvergleich

Der deterministische Ledger erhält den terminalen Zustand `ledger_ready`.
Dieser Zustand bedeutet ausschließlich, dass Clause Blocks, Signale, FTS und
Dinghy vollständig vorbereitet sind. Er veröffentlicht kein Vollinventar und
wird nach einem Neustart nicht als abgebrochene Tiefenanalyse markiert.

Gezielte Ledger-Vorbereitung und vollständige Analyse teilen eine serielle
Dokument-Sperre. Sie dürfen nicht gleichzeitig FTS, Signale oder Blockstatus
desselben staged Runs verändern.

Beträge und Bedingungen werden nur aus der exakten Fakt-Evidenz oder aus einer
unmittelbar benachbarten, gleich gescopten Tabellenzeile übernommen. Eine bloß
gleiche Überschrift in zwei normalen Nachbarabsätzen reicht nicht.

Dinghy-only- und schwache Alias-Kandidaten dürfen eine kleine, streng
beleggebundene Ambiguitätsprüfung auslösen. Sie ist auf höchstens 16 Kandidaten
und Batches zu je höchstens 8 Kandidaten begrenzt. Qwen bestätigt nur die Rolle
`Selbstbehalt`; der Server validiert das exakte Zitat, leitet Betrag und Seite
aus dem Quellblock ab und besitzt weiterhin jede Ergebniszeile. Nicht eindeutig
bestätigte Kandidaten werden sichtbar gemeldet und nicht als Treffer ausgegeben.
Wird das Kandidatenbudget überschritten oder bleiben Kandidaten ungelöst, darf
die Antwort nicht als vollständig erscheinen. Sie muss die Unvollständigkeit
sichtbar ausweisen oder fail-closed ohne Vollständigkeitsbehauptung enden.

Gemischte Anfragen wie „Selbstbehalte und Deckungsgrenzen“ dürfen den
Selbstbehalt-Spezialpfad nicht kapern. Bis weitere vertikale Resolver existieren,
ist dieser Pfad ausschließlich für reine Selbstbehalt-Fragen zuständig.

### Empirische Korrektur aus dem 21-Seiten-Test

Der lokale Realstruktur-Test vom 24. August 2026 bestätigte den Bypass des
Vollinventars, `ledger_ready`, Neustartfestigkeit und vollständige
Fundstellenenumeration. Er widerlegte jedoch die Annahme, dass die bisherige
Nachbarschaftsregel Beträge und Bedingungen bereits zuverlässig verbindet.

In einer dichten linearisierten Klausel standen `Selbstbehalt EUR 350` und eine
separate `Jahreshöchstentschädigung EUR 20.000` nahe beieinander. Der Code gab
beide Werte als Selbstbehalt aus und übernahm zusätzlich eine nicht zugehörige
Bedingung aus demselben großen Block.

Verbindliche Folgerung:

1. Geldbeträge werden an den nächsten kompatiblen Rollenbegriff innerhalb der
   gleichen Klauselspanne gebunden.
2. `Selbstbehalt`, `Limit`, `Jahreshöchstentschädigung`, `Sublimit` und
   `Versicherungssumme` sind harte, getrennte Rollen.
3. Eine Nachbarzeile darf nur bei belegter Fortsetzungs- oder Tabellenrelation
   Werte beziehungsweise Bedingungen ergänzen.
4. Mehrdeutige Zuordnung führt zu keiner Betragsbehauptung.
5. Ein größeres Chatmodell ist kein Ersatz für diese deterministische
   Invariante; im reproduzierten Fehlerpfad traf Qwen keine Auswahlentscheidung.

### Nicht übernommener Implementierungs-Spike vom 25. August 2026

Der anonymisierte Erdbebenfall `EUR 350` versus `EUR 20.000` wurde zuerst als
Fehler reproduziert und anschließend durch eine reine rollenlokale
Signalbindung korrigiert. Extractor und Targeted-Renderer verwendeten im Spike
dieselbe fail-closed Rollenregel. Die fokussierten und direkt angrenzenden
Tests waren grün.

Dieser Code wurde nach Auswertung des Experiments wieder vollständig entfernt.
ADR-015 und `FAIL-003` bleiben im Produktcode `REVISE`. Das Experiment
unterstützt die Hypothese einer rollenpartitionierenden, fail-closed
Modulgrenze; es entscheidet weder ihre spätere konkrete Implementierung noch
die allgemeine Occurrence-, Tabellen- oder Variantenarchitektur.

## ADR-016: Analysephase vor neuer Implementierungsbasis

**Status:** AKZEPTIERT am 25. August 2026

Der aktuelle Entwicklungsbranch ist keine freigegebene Basis für weitere
Produktimplementierung. Er enthält wertvolle Versuchsevidenz, aber auch viele
Änderungen und einen nachweislich nicht kundenfähigen Stand. Eine unkritische
Fortsetzung würde schwer erkennbar machen, welche Komponenten bewiesen,
provisorisch, widersprüchlich oder überholt sind.

Bis zu einem ausdrücklichen Decision-Gate gilt deshalb:

1. Analyse, Wissensaufnahme, Diskussion, Testdesign und Falsifikation haben
   Vorrang vor Produktcode.
2. Der bestehende Branch ist Evidenzquelle, nicht automatisch Codequelle.
3. Der am 25. August 2026 vorbereitete Branch
   `codex/policy-clean-implementation` bleibt während der Analysephase ohne
   Produktänderungen.
4. Vor seiner Verwendung werden Zielvertrag, Architekturentscheidung,
   Golden Cases, Messverträge und Übernahmeliste beschlossen.
5. Die Git-Baseline wird ausdrücklich gewählt; weder aktueller HEAD noch ein
   früherer Tag gelten ohne Vergleich automatisch als sauber.
6. Erst eine neue, eindeutige Nutzerfreigabe öffnet die Implementierungsphase.

Temporäre Spikes sind nur zulässig, wenn sie ausdrücklich als Experiment
gekennzeichnet, von behaltenem Produktcode isoliert und nach Sicherung der
Erkenntnisse entfernt werden.

**Vorbereiteter historischer Worktree:** `policy-clean-implementation` wurde
auf ausdrücklichen Nutzerwunsch aus dem offiziellen Repository
`https://github.com/Mintplex-Labs/anything-llm.git` erstellt. Dafür wurde das
Remote `upstream` registriert. Branch:
`codex/policy-clean-implementation`; Tracking: `upstream/master`;
Start-HEAD: `72aabbd15481ae405434efd4c83d46026eef1173`.

Der zuvor irrtümlich aus dem projektspezifischen `origin/main` bei
`17a556dc / policy-v0.3.22` erzeugte saubere Worktree wurde vor dieser
Neuanlage entfernt. Er ist nicht die Basis des neuen Branches.

**Nicht entschieden:** Ob der gepinnte Upstream-Commit vor der späteren
Implementierung aktualisiert wird und welche Teile des bestehenden Codes
übernommen, neu geschrieben oder verworfen werden.

**Nachtrag zum aktuellen Status:** Später wurde in einem separaten
Upstream-basierten Worktree der prototypische Agent-Flow-Stand `fb5198ab`
erstellt. Das hebt die Schutzabsicht dieser ADR nicht auf. Auf Nutzerwunsch ist
die weitere Umsetzung erneut pausiert; der Prototyp ist Versuchsevidenz und
keine freigegebene Produktionsbasis. Die aktuelle Fortsetzungsentscheidung
richtet sich zusätzlich nach ADR-017 und dem vollständigen Run-Ledger.

## ADR-017: Built-in-Parametersuche schließen, Mehrpass-Workflow prüfen

**Status:** AKZEPTIERT ALS EXPERIMENTENTSCHEIDUNG am 25. August 2026;
konkrete Produktarchitektur noch offen

Die vollständige Original-AnythingLLM-Kampagne hat Pinning, ungepinntes
Accuracy-RAG mit BGE-M3 und Dinghy bei N6/N10, Temperatur 0,7/0,
Default-N32 sowie Qwen/Gemma geprüft. Kein valider Lauf bestand gemeinsam die
fachlichen Hard-Gates für Rollen, Quellen, Pflichtsektionen, Negativzustände
und Vollständigkeit.

Verbindliche Entscheidung:

1. Keine weitere freie Folge aus Top-N-, Search-, Temperatur- oder
   Generatorwechseln wird als wahrscheinlicher Root-Cause-Fix behandelt.
2. `Dinghy + ungepinnt + Default-N32` bleibt nur
   Breitenproxy-first-Baseline für das eine Referenzdokument, nicht
   Produktvertrag oder universeller Embedder-Sieger.
3. Der nächste Versuch prüft eine andere Workflowhypothese: abschnittsweise
   Enumeration und Extraktion, getrennte Rollenbildung, deterministische
   Quellenrekonstruktion, Pflichtanker-/Vollständigkeitsvalidierung und
   sichtbare `unresolved`-Zustände.
4. Ein sichtbarer Nutzerprompt darf intern mehrere kontrollierte Schritte
   auslösen. „Ein Prompt für den Nutzer“ bedeutet nicht „ein freier
   Modellaufruf“.
5. Eine neue Parameterprobe ist nur zulässig, wenn sie eine neue
   falsifizierbare Hypothese isoliert und vorher Hard-Gates sowie
   `PROVES`/`DOES_NOT_PROVE` festlegt.

Nicht entschieden sind die konkrete Umsetzung mit AnythingLLM Agent Builder,
Agent Flows, serverseitiger Orchestrierung oder einem separaten lokalen
Harness sowie die spätere Produktionskonfiguration für lange Dokumentpakete.

Kanonischer Messbeleg:
[Tests und Erkenntnisse, Abschnitt 17](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#17-original-anythingllm-vollständige-built-in-konfigurationskampagne).

## ADR-018: Modell wählt servereigene Span-ID; dynamische Kategorien bleiben Discovery

**Status:** BEGRENZT AKZEPTIERT ALS EXPERIMENTRICHTUNG am 25. August 2026;
keine fachliche Kundenfreigabe

Die reale FEUER-Kandidatenprobe scheiterte bei 29 von 30 formalen Fehlern am
freien Abschreiben eines Zitats. Gleichzeitig benötigt der Partnerkatalog
einen unabhängigen Gegenpfad für dokumenteigene Gliederungen und unbekannte
Bezeichnungen.

Verbindliche Richtung für den experimentellen Feuerpilot:

1. Code erzeugt occurrence-genaue Evidence-Spans mit stabiler ID aus
   Quellfingerprint, physischer Seite, Originaloffset und exaktem Substring;
   die kanonische PageMap wird rückgeprüft und Overflow sichtbar manifestiert.
2. Qwen wählt nur eine erlaubte Span-ID oder `NONE`; Zitat und physische Seite
   werden nicht mehr vom Modell geschrieben.
3. Code besitzt die vollständige Ergebniszeilenmenge. `NONE` und doppelte
   Modell-IDs enden deterministisch `UNGEKLÄRT`.
4. Dynamische Kategorien werden katalogunabhängig und wortgetreu gesammelt.
   Sie bleiben `unmapped_discovery` und dürfen Partner-IDs, Fakten oder
   A/B-Joins nicht automatisch verändern.
5. Der Partnerkatalog bleibt eine priorisierte Review-/Ausgabeansicht. Der
   spätere Vergleich verbindet Rollen und Scopes, nicht ähnlich klingende
   Überschriften.
6. Eine gewählte Span-ID ist nur ein `source_bound_candidate`. Bis Rollen-,
   Scope-, Varianten- und Vertragsranggates fachlich bestanden sind, dürfen
   freie Modellfelder weder als Dokumentfakt noch als Gleichwertigkeit oder
   Vorteil erscheinen.
7. Der Modellvertrag besitzt im Produktpfad genau drei Spalten:
   `CAT-ID | Span-ID/NONE | RELEVANT/UNCLEAR/NONE`. Reichere freie
   Faktenfelder sind in diesem Schritt unzulässig.
8. Sampling vor der Spanbildung und Span-Overflow werden getrennt
   manifestiert. Dynamische Vollledger werden content-addressiert einmal
   lokal gespeichert; Chatzeilen halten nur Referenz und Kurzmetriken.
9. Ungeklärte Nummerierungshierarchie propagiert an tiefere Nachfahren.
   Discovery-Vollledger besitzen bis zur Chat-Persistenz eine persistente
   In-flight-Lease und unterliegen danach einem referenzbasierten lokalen GC.
   Abgebrochene Leases laufen zeitgebunden aus; fehlgeschlagene und gelöschte
   Läufe dürfen keine dauerhaften, unreferenzierten Policenartefakte erzeugen.

Begrenzt oder offen bleiben Rollen-, Wert-, Negations-, Varianten-,
Vertragsrang-, Tabellen- und Querverweisbindung sowie die fachliche
Entscheidung, wann ein Discovery-Kandidat zu einer neuen Taxonomieversion wird.
Ein formaler Span-Pass ist kein Deckungs- oder Vergleichsbeweis.

Kanonischer Messbeleg:
[Tests und Erkenntnisse, Abschnitt 21](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#21-span-id-und-dynamische-discovery-iteration-im-feuerpilot).

## ADR-019: Fachvorlagen werden beim normalen Workspace-Anlegen ausgewählt

**Status:** UMGESETZT und lokal verifiziert am 26. August 2026; V3.2.1 auf
Basis `v3.2.0`

Die kurzlebigen Tags `v3.3.0` und `v3.3.1` ergänzten ein separates
CLI-Script zur Workspace-Provisionierung. Dieser Bedienweg wird verworfen und
die beiden Tags werden zurückgezogen. Die Funktion gehört in den bestehenden
zentralen Dialog `Neuer Workspace`, nicht in einen zweiten administrativen
Erstellpfad.

Verbindlicher Vertrag:

1. Die kanonische lokale Promptablage ist `kategorie-systemprompts/` mit genau
   den acht Präfixen `VS`, `FE`, `LW`, `ST`, `EL`, `HP`, `VB` und `WE`.
   Frühere Verweise auf einen `-v2`-Ordner oder nummerierte Dateinamen sind
   überholt.
2. Der Dialog erlaubt neben dem Workspace-Namen optional genau eine dieser
   Fachvorlagen. Ohne Auswahl verwendet AnythingLLM weiterhin seinen normalen
   Default-Systemprompt; die Anwendung darf dann keinen Fachprompt
   unterschieben.
3. Die Fachprompttexte werden serverseitig aus versionierten, mit V3
   ausgelieferten Vorlagendateien gelesen. Der Browser übermittelt nur eine
   erlaubte Vorlagen-ID, niemals einen lokalen Dateipfad oder freien
   Systemprompt.
4. Jeder über diesen Dialog angelegte Workspace erhält unabhängig von der
   Fachvorlage: Workspace-Anbieter `System default`, Chatmodus `chat`,
   Chatverlauf `1`, Temperatur `0`, Search Preference `default`, Top N `55`
   und Ähnlichkeitsschwelle `0`/keine Einschränkung.
5. Das globale Chat- oder Embeddingmodell wird durch die Workspace-Anlage
   nicht verändert. Insbesondere ist keine Prüfung oder Umschaltung einer
   Dinghy-Modell-ID Teil dieses Dialogs.
6. Existierende Workspaces, Dokumente, Chats und globale Einstellungen werden
   nicht migriert. Das Preset gilt nur für neu angelegte Workspaces.

Die Servergrenze validiert die Vorlagen-ID und besitzt die tatsächliche
Promptzuordnung. Damit bleiben UI, API-Erstellung und spätere weitere
Erstellcaller konsistent; eine manipulierte Browseranfrage kann keine
beliebige lokale Datei lesen.

## ADR-020: Breite Chunks nur als Navigation zu exakter Evidenz

**Status:** AKZEPTIERT und für `HP-12` umgesetzt am 30. August 2026

Der V3.2.1/RC33-Vergleich belegt, dass breite `3000/250`-Chunks unbekannte
Wortlaute sichtbar machen, aber im monolithischen Pfad verschiedene Rollen,
Scopes und Polaritäten unzulässig verbinden können. Reine Dinghy-Schwellen
lieferten ebenfalls falsche positive Kandidaten und sind kein Faktenvertrag.

Verbindliche Entscheidung:

1. Breite page-aware Chunks und Dinghy sind nur Navigationsmittel für
   weiterhin offene atomare Komponenten.
2. Je Ziel werden höchstens drei Chunks geprüft. Eine globale Top-N-Liste ist
   kein Vollständigkeits- oder Abwesenheitsbeweis.
3. Ein Hybridkandidat benötigt einen exakten, eindeutigen Originalspan,
   servergeprüfte Dokumentoffsets und einen zielbezogenen Wortanker.
4. Der breite Chunk wird nicht in Triage oder Wirkung übernommen. Nur der
   exakte Span wird als `HYBRID_EXACT_SPAN` weitergereicht.
5. Hybridkandidaten erhalten keine deterministische Positivbindung. Sie
   durchlaufen die normale Rollen-, Scope- und Wirkungsprüfung.
6. Ein atomarer Hybrid-Semantikvertrag formuliert die Frage, ist aber kein
   Beweis. Seine Promptpräzisierung darf normale Kandidaten nicht verändern.
7. Ungültige Modellzitate enden fail-closed `UNRESOLVED`; automatische
   Zitatreparatur ist in diesem Pfad unzulässig.
8. Die technische Grundlage darf nur zielweise mit fachlichen Positiv-,
   Negativ-, Nachbar- und Zielhardwarekontrollen aktiviert werden.

Die erste freigegebene Aktivierung gilt für `HP-12`. Der historische,
zurückgezogene CLI-Preset-Tag gleichen Namens war nicht veröffentlicht und
gehört zu einer anderen, verworfenen Bedienlinie. Der am 30. August neu
vergebene Release-Tag `v3.3.1` bezeichnet ausschließlich den aktuellen
evidenzgebundenen V3-Pfad.

Kanonischer Messbeleg:
[Tests und Erkenntnisse, Abschnitt 42](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#42-v331--evidenzgebundener-hybridfallback).

## ADR-021: Vorteile sind punktweise, atomar und regelgebunden

**Status:** AKZEPTIERT, in V3 Ergebnisschema V2 umgesetzt und mit `v3.4.0`
am 31. August 2026 stabil veröffentlicht

Der technische Paketrollup darf nicht aus gerenderten Tabellenstrings oder
den Zuständen `NUR_A_BELEGT`, `NUR_B_BELEGT` und
`UNTERSCHIED_FACHLICH_PRÜFEN` ableiten, welches Paket besser ist. In diesen
Daten fehlen atomarer Scope, Faktrolle, Geltung, Variante, Bedingung,
Qualifier, Dokumentrang und Ersetzung.

Verbindliche Entscheidung:

1. Der bestehende technische `outcome` bleibt erhalten.
2. Eine additive servereigene `pointDecision` liest Worksheet-Komponenten,
   Wirkungsurteile, typisierte Requested-Field-Fakten und servergebundene
   Quellen.
3. Jede Seite muss vollständig `BELEGT`, konfliktfrei, rangaufgelöst und
   quellengebunden sein.
4. Component, Faktrolle, Geltung, Scope, Variante, Werttyp, Einheit, Limitart
   und Qualifier bilden das Comparability Gate.
5. Freigegeben sind zunächst nur eingeschlossen gegenüber ausdrücklich
   ausgeschlossen, höheres vergleichbares Deckungslimit, niedrigerer
   vergleichbarer Selbstbehalt und echte atomare Gleichwertigkeit.
6. Fehlender Beleg, Bedingungen/Optionen, mehrere abweichende Dokumentfakten,
   unbekannte Bewertungsrichtungen und gemischte Gewinner enden
   `UNKLAR`.
7. Abweichende Vergleichsschlüssel enden `NICHT_VERGLEICHBAR`.
8. Es gibt keinen Gesamtsieger, Score, Zeilenzähler als Rangfolge oder freie
   LLM-Wertung.
9. Alte Ergebnisschemata werden nicht umgedeutet; die UI zeigt sie fail-closed
   als `UNKLAR`.
10. Ein kurzer Quellspan darf eine unmittelbar gebundene Bedingung oder
    Ausnahme nicht verlieren. Die Entscheidung prüft einen lokalen
    Klauselkontext; qualifizierte Deckung endet bis zur Scope-Auflösung
    `UNKLAR`. Weit entfernte Klauseln und reine Gefahren-Definitionen dürfen
    diesen Guard nicht auslösen.

Der erste reale Artefakt-Replay mit genau einem `VORTEIL_B` bei `LW-22` wurde
durch den frischen End-to-End-Lauf widerlegt: dieselbe Klausel wurde einmal
binär eingeschlossen und einmal binär ausgeschlossen, obwohl sie eine
Rückausnahme enthält. `v3.4.0` korrigiert `LW-22`, `ST-16` und `HP-26`
fail-closed. Der frische 320-Zeilen-Replay liefert 0 Vorteile, 4
Gleichwertigkeiten, 11 nicht vergleichbare und 305 unklare Punkte. Diese
konservative Verteilung ist Teil des Sicherheitsvertrags, keine
Recall-Regression.

Kanonischer Messbeleg:
[Tests und Erkenntnisse, Abschnitt 45](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#45-v340-frischer-zehn-dokumente-lauf-und-bedingungssichere-punktentscheidung).

## ADR-022: Qualifiziertes Nichtfinden ist Vergleichsannahme, kein Ausschluss

**Status:** AKZEPTIERT UND BEGRENZT, in V3 Ergebnisschema V3 für `VS-16`
umgesetzt und am 31. August 2026 auf dem Mac Studio synthetisch validiert

`ADR-021` bleibt für fehlende, alte oder unvollständig geprüfte Evidenz
unverändert gültig. Neu ist ausschließlich ein stärkerer, separat
maschinenlesbarer Suchbefund:

```text
coverageEffect:       UNKNOWN
searchDisposition:    NOT_FOUND_AFTER_COMPLETE_SEARCH
comparisonTreatment:  ASSUMED_NOT_INCLUDED_V1
```

Verbindliche Entscheidung:

1. Ein `NOT_FOUND` aus der Evidenzmaterialisierung allein reicht niemals aus.
2. Der Vergleichspunkt muss den versionierten Negativbefund ausdrücklich im
   Katalog freigeben.
3. Alle bereitgestellten Paketdokumente müssen identitätsgeprüft und
   verarbeitet sein; alle physischen Seiten müssen Text enthalten.
4. Kategoriebericht, Worksheet, Targets und Judgements müssen vollständig,
   identitätsgebunden und ohne offene technische Gates sein.
5. Jede kontrollierte Komponente muss mit null Occurrences, null Kandidaten,
   null Rejects und null ungelösten Candidate-IDs serverseitig terminieren.
6. Nur dann darf die Ausgabe „im vollständig geprüften bereitgestellten Paket
   nicht gefunden“ lauten. Sie muss zusätzlich sagen, dass kein ausdrücklicher
   Ausschluss belegt ist.
7. `INCLUDED_OVER_ASSUMED_NOT_INCLUDED_V1` darf einen punktweisen Vorteil für
   die ausdrücklich eingeschlossene Seite erzeugen.
8. Beidseitiger qualifizierter Negativbefund ergibt
   `KEIN_DOKUMENTIERTER_VORTEIL`, nicht `GLEICHWERTIG`.
9. Bildseiten in gemischten PDFs, alte Artefakte, offene Kandidaten und nicht
   freigegebene Punkte bleiben `SEARCH_INCOMPLETE` und `UNKLAR`.
10. Die Regel gilt nur für das bereitgestellte Paket, nicht für den
    möglicherweise außerhalb des Uploads existierenden Gesamtvertrag.

Erste Freigabe ist `VS-16` mit getrennten atomaren Komponenten und exakten
Aliasgruppen für Garage, Tiefgarage, Stell-/Parkplatz, Parkdeck und Carport.
Rohe Präfixe wie `GARAG*` bleiben unzulässig, weil sie Nachbarbegriffe wie
Garagentor oder Garagenhaftpflicht erfassen würden.

Kanonischer Messbeleg:
[Tests und Erkenntnisse, Abschnitt 46](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#46-qualifizierter-negativbefund-für-vs-16).
