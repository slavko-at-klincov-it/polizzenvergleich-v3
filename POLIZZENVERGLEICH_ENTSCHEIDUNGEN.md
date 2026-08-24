# Polizzenvergleich – Architekturentscheidungen und Loop-Schutz

Stand: 24. August 2026
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

| Komponente | Verbindliche Rolle | Darf nicht |
| --- | --- | --- |
| SQLite | Scope, Ledger, Checkpoints, vollständige Enumeration, Joins, atomare Veröffentlichung | semantische Bedeutung erfinden |
| FTS5 | exakte Phrasen/Tokens und kontrollierte Präfixe | als Synonym- oder Stemmingmaschine gelten |
| Alias-Katalog | bekannte Schreibweisen und Synonyme additiv erweitern | Vollständigkeit definieren |
| Dinghy | Paraphrasen und unbekannte semantische Beziehungen als Kandidaten finden | sichere Negativbehauptungen liefern |
| kleines Extraktionsmodell | kompakte, ambige Klauselgruppen klassifizieren | dauerhaft zusätzlich neben Qwen geladen werden, bevor evaluiert |
| Qwen | schwierige Klauseln und beleggebundene Endformulierung | alle Blocks inventarisieren oder Rows auswählen |
| Servercode | Faktenmenge, Rollen, Quellen und sämtliche Rows besitzen | unvalidierte Modellaussagen publizieren |

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

**Status:** IMPLEMENTIERT im Entwicklungsstand nach `policy-v0.3.22`

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

Bewusste Grenze: Semantische Dinghy-Treffer ohne deterministisch belegbares
Selbstbehalt-Signal werden noch nicht als Fakt ausgegeben. Damit bleibt der
Pfad bei unbekannten Umschreibungen fail-closed, bis eine kleine, streng
beleggebundene Ambiguitätsprüfung separat evaluiert wurde.
