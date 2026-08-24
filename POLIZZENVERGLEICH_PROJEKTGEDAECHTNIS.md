# Polizzenvergleich – Projektgedächtnis

Stand: 24. August 2026
Dokumentationsbasis: Entwicklungsstand nach `policy-v0.3.22` (`17a556dc`)
Gültigkeit: Dieses Dokument ist der Einstiegspunkt für Entwicklung, Diagnose
und weitere Architekturentscheidungen dieser Fork.

## 1. Zweck dieses Dokuments

Dieses Projektgedächtnis verhindert, dass Erkenntnisse nur in Chatverläufen,
Terminalausgaben oder persönlicher Erinnerung existieren. Vor jeder Änderung
am Polizzenvergleich sind mindestens diese vier Dokumente zu lesen:

1. dieses Projektgedächtnis,
2. [POLIZZENVERGLEICH_ARCHITEKTUR.md](./POLIZZENVERGLEICH_ARCHITEKTUR.md),
3. [POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md),
4. [POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md).

Einrichtung und Kundenbetrieb stehen weiterhin in
[POLIZZENVERGLEICH_SETUP_DE.md](./POLIZZENVERGLEICH_SETUP_DE.md). Die hier
genannten Ist-Grenzen haben Vorrang, falls ältere Abschnitte der Setup-Datei
oder Kommentare im Code noch einen früheren Entwicklungsstand beschreiben.

## 2. Produktziel

Der Makler soll in einem lokalen AnythingLLM-Thread:

- kein, ein oder zwei Versicherungsdokumente verwenden können,
- nach dem fertigen Basisindex unmittelbar Fragen stellen können,
- konkrete Fragen wie „Ermittle alle Selbstbehalte“ vollständig und
  beleggebunden beantwortet bekommen,
- ein oder zwei Dokumente mit einem ausführlichen Maklerprompt analysieren
  können,
- ausschließlich Aussagen erhalten, die auf kanonischen Dokumentstellen
  beruhen,
- physische PDF-Seiten als Provenienz sehen,
- weder interne Index-, Inventar- noch Recovery-Entscheidungen treffen müssen.

Der gewünschte Bedienablauf lautet:

```text
Dokument(e) hochladen -> kurzen oder langen Prompt senden -> Antwort erhalten
```

Interne Phasen dürfen sichtbar diagnostizierbar sein, sind aber keine
fachlichen Entscheidungen des Benutzers.

## 3. Ehrliche Qualitätsgrenze

Technisch garantierbar sind:

- vollständige Verarbeitung aller kanonischen physischen Seiten,
- lückenlose Coverage aller erzeugten Primärblöcke,
- exakte Belegspannen und dokumentbezogene Isolation,
- verlustfreie Ausgabe aller vom System validierten Fakten,
- keine stillen Top-N-Auslassungen in einem als „alle“ bezeichneten Pfad,
- keine sichere Negativbehauptung ohne Beleg.

Nicht mathematisch garantierbar ist, dass ein probabilistisches Modell jede
juristisch relevante Bedeutung korrekt erkennt. Das Produkt darf deshalb eine
„vollständig seitenabgedeckte, belegte maschinelle Auswertung“ versprechen,
nicht eine garantierte rechtliche Vollprüfung. Die fachliche Endkontrolle bleibt
beim Makler.

## 4. Aktueller Gesamtstatus

### Was technisch funktioniert

- native PDF-Textextraktion und selektive OCR,
- kanonische physische Page-Map und Source-SHA-256,
- schneller Basisindex mit SQLite FTS5 und LanceDB,
- Dinghy-Law-4B mit festem 2.560-Dimensionsvertrag,
- A/B-, Workspace-, Thread- und Benutzerisolation,
- maximal zwei Vergleichsdokumente pro Thread,
- persistente Klauselblöcke, Signale, Embedding-Ledger, Fakten und Evidenzen,
- resumierbare, run-scoped Staging-Läufe,
- atomare Veröffentlichung eines vollständig validierten Analyse-Laufs,
- Erhalt des letzten veröffentlichten Laufs bei Fehler oder Neustart,
- strikte Evidenzprüfung gegen den kanonischen Quelltext,
- globale Serialisierung lokaler Modell- und Embeddingoperationen,
- deterministic Row Planner, der keine validierten Fakten still auslassen darf,
- lokaler Single-User-Betrieb ohne Login und ausschließlich lokale Ports.
- gezielte Selbstbehalt-Fragen vor dem Vollinventar: vollständige Clause-FTS-
  Enumeration, Dinghy-Ergänzung, codebasierte Zeilen und höchstens kleine,
  beleggebundene Ambiguitätsbatches,
- terminaler `ledger_ready`-Zustand ohne falsche Tiefenanalyse-Meldung sowie
  gemeinsame Dokument-Serialisierung für Targeted- und Full-Analyse.

### Was fachlich noch nicht kundenfähig ist

Der breite Vollanalysepfad aus `policy-v0.3.22` markiert bei realen,
klauseldichten Dokumenten weiterhin zu viele Blöcke als `ambiguous_pending`.
Fast alle diese Blöcke werden anschließend an Qwen geschickt. Reine
Selbstbehalt-Fragen umgehen diesen Pfad im aktuellen Entwicklungsstand bereits;
für weitere Themen und den vollständigen Maklerprompt ist die Umstellung noch
nicht abgeschlossen.

Der gemessene reale Lauf hatte:

| Kennzahl | Wert |
| --- | ---: |
| Primärblöcke gesamt | 690 |
| deterministisch erledigt | 45 |
| vom Modell mit Fakten validiert | 46 |
| vom Modell als ohne Fakt bestätigt | 22 |
| noch `ambiguous_pending` | 577 |
| erledigt | 113 / 690, ca. 16 % |
| Modellbatchgröße | 4 Blöcke |
| gemessene Dauer einzelner Calls | ca. 18–73 Sekunden |
| elf erfolgreiche Calls zusammen | ca. 446 Sekunden |
| extrapolierter Rest | deutlich über eine Stunde |

Das ist kein neuer JSON- oder `unitKey`-Fehler. `v0.3.22` band die
Modellantworten korrekt an Quellblöcke; alle beobachteten Calls wurden vom
Provider erfolgreich beendet. Der verbleibende Fehler ist die Architektur der
Arbeitsteilung: Qwen wird als Volltext-Klassifikator für beinahe das ganze
Dokument verwendet.

### Betriebsentscheidung

Die aktuelle Tiefenanalyse darf auf dem Kunden-Mac nicht weiter als normaler
Produktpfad verwendet werden. Ein laufender Versuch wird mit folgenden Befehlen
gestoppt:

```bash
"$HOME/.local/bin/polizzenvergleich" stop
lms daemon down
```

SQL-Checkpoints und der Basisindex bleiben erhalten. Eine PDF muss deswegen
nicht erneut hochgeladen werden.

## 5. Das eigentliche Problem

Das Problem ist **nicht**, dass das Modell eine erste PDF-Seite grundsätzlich
nicht lesen kann. Es sind vier miteinander verwechselte Aufgaben:

1. **Dokumenterfassung** – Seiten, Text, OCR, Tabellenartefakte und Provenienz.
2. **Exakte und semantische Suche** – relevante Vorkommen finden.
3. **Faktenbildung** – Deckung, Limit, Selbstbehalt, Ausschluss, Bedingung und
   Obliegenheit auseinanderhalten.
4. **Darstellung** – die vom Server festgelegten Fakten in Maklersprache und
   Tabellenform ausgeben.

Der bisherige Vollinventarpfad gab Qwen gleichzeitig die Aufgaben 2 bis 4 für
nahezu jeden Block. Strenge Beleg- und Vollständigkeitsregeln machten jeden
kleinen Modellfehler teuer. Korrektheitsfixes stabilisierten zwar einzelne
Antworten, beseitigten aber weder die Zahl der Modellaufrufe noch deren
autoregressive Ausgabedauer.

## 6. Verbindliche neue Richtung

### 6.1 Konkrete und exhaustive Themenfragen

Fragen wie:

- „Ermittle alle Selbstbehalte“,
- „Nenne alle Sublimits und Höchstentschädigungen“,
- „Suche Vandalismus, böswillige Beschädigung und Graffiti“,
- „Welche Ausschlüsse gelten bei Leitungswasser?“

werden über einen occurrence-zentrierten Pfad beantwortet:

1. alle passenden Clause-Block-FTS-Treffer enumerieren, nicht Top-K auswählen,
2. kontrollierte Aliasgruppen und Präfixe verwenden,
3. strukturgebundenen Kontext laden: Heading-Pfad, Tabellenkopf,
   Nachbarblöcke und Variante,
4. Dinghy für anders formulierte semantische Kandidaten ergänzen,
5. Beträge, Prozente, Zeiträume, Negationen und Bedingungen deterministisch
   auswerten,
6. nur verbleibende mehrdeutige Klauselgruppen durch ein Modell prüfen,
7. sämtliche validierten Fakten und Quellen durch Code rendern.

Keine pauschalen `±3` Vollseiten werden an das Modell geschickt. Seiten sind
Provenienz und äußerer Sicherheitsrahmen; die primäre Kontextgrenze ist die
Klausel-/Heading-/Tabellenstruktur.

### 6.2 Vollständiger Maklerprompt

Der vollständige Maklerprompt bleibt ein berechtigtes Produktziel, wird aber
nicht wieder als ein großes LLM-Inventar implementiert.

Die Basis dafür ist ein vollständiges Clause Ledger:

- jeder Primärblock wird gespeichert,
- jeder Primärblock erhält einen begründeten terminalen Status,
- bekannte Signale erzeugen beleggebundene Fakten deterministisch,
- rein technischer Nicht-Inhalt darf nur durch positive, enge Regeln
  ausgeschlossen werden,
- unbekannter Klauselinhalt wird niemals wegen fehlender Katalogbegriffe
  verworfen,
- ähnliche ambige Blöcke werden gebündelt statt einzeln inferiert,
- ein kleineres Extraktionsmodell darf austauschbar evaluiert werden,
- Qwen bleibt Eskalation für schwierige Zuordnungen und beleggebundene
  Endformulierung,
- der Server bestimmt alle Fakten und Tabellenzeilen.

## 7. Komponenten, die erhalten bleiben

Die bisherige Arbeit wird nicht weggeworfen. Folgende Bausteine sind
weiterzuverwenden:

- `PdfExtractionAssembler` und die kanonische Page-Map,
- `ComparisonDocumentService` und der getrennte Basisindex,
- `ComparisonAnalysisUnitBuilder` / `ComparisonClauseBlockBuilder`,
- `ComparisonFactRiskSignals`,
- `ComparisonDeterministicFactExtractor`,
- `ComparisonClauseBlockIndex`,
- `ComparisonClauseEmbeddingIndex`,
- `ComparisonDocumentInventory` mit run-scoped Staging,
- `PolicyInferenceQueue` und `PolicyComparisonMetrics`,
- `ComparisonFactRowPlanner`,
- Source-Hash-, Thread-, Dokument- und A/B-Isolation,
- die strikten Evidenz- und Publish-Gates.

Neu verdrahtet oder begrenzt werden müssen:

- `ComparisonHybridRetriever`, weil er aktuell vor jeder Dokumentfrage
  `ensureForDocuments()` erzwingt,
- `ComparisonAmbiguousFactResolver`, weil er aktuell für 577 von 690 Blöcken
  benötigt wurde,
- der Zugriff auf Clause-Block-FTS und Clause-Dinghy, die zwar implementiert,
  aber nicht als produktiver exhaustive Targeted-Pfad verwendet werden,
- kontrollierte `facetKey`-/Faktrollen, damit alle Selbstbehalte oder Limits
  serverseitig gruppiert werden können.

## 8. Nicht noch einmal versuchen

Diese Liste ist verbindlich, bis neue Messdaten ausdrücklich etwas anderes
beweisen:

- kein großes freies JSON-Inventar über den gesamten Dokumenttext,
- kein Qwen-Aufruf für jeden Textblock oder jede Seite,
- keine reine Batchgrößenänderung als Laufzeitlösung,
- kein blindes Retry desselben zu großen oder semantisch falschen Inputs,
- keine Alias-Ausnahme pro neu auftretendem Modelllabel,
- kein RAG-Top-K als Quelle für das Wort „alle“ oder „vollständig“,
- keine reine Keyword-Suche als Beweis, dass eine Klausel nicht existiert,
- kein gleichzeitiges Laden von Qwen und Gemma auf dem 32-GB-Mac,
- keine parallele aktive Qwen- und Dinghy-Inferenz,
- kein Löschen eines guten Basisindexes wegen eines Analysefehlers,
- keine echten Kundendokumente, Namen oder Vertragsdaten in Git oder Fixtures,
- kein neues Release allein aufgrund grüner Unit-Tests ohne realistische
  Laufzeit- und Coverage-Abnahme.

## 9. Nächste kontrollierte Abnahme

Der nächste Implementierungsschritt ist bewusst nur eine vertikale Funktion:

> Ermittle alle Selbstbehalte im Dokument. Nenne jeweils Betrag, Bedingung und
> physische PDF-Seite.

Die Funktion ist erst akzeptiert, wenn:

- sie keinen vollständigen Analyse-Run benötigt,
- alle Clause-FTS-Treffer enumeriert werden,
- Aliasvarianten wie Selbstbeteiligung, Franchise, Eigenanteil und „selbst zu
  tragen“ kontrolliert berücksichtigt werden,
- Dinghy anders formulierte Kandidaten ergänzt,
- Betrag, Bedingung, Sparte/Variante und physische Seite richtig verbunden sind,
- keine globale Top-N-Kürzung stattfindet,
- das Modell keine Ergebniszeile auswählen oder entfernen kann,
- die anonymisierten Referenzfälle vollständig getroffen werden,
- Laufzeit und Modellaufrufe gemessen werden,
- der Pfad auf dem Kunden-Mac in akzeptabler Zeit endet.

Erst danach wird dasselbe Muster auf Limits, Ausschlüsse, Obliegenheiten,
versicherte Sachen und Deckungspositionen erweitert.

## 10. Golden Cases

Die folgenden anonymisierten fachlichen Orakel dürfen nicht regressieren:

### Dokument A

- keine belegte allgemeine Vandalismusdeckung,
- eine engere Beschädigungsdeckung im Zusammenhang mit Einbruch darf nicht als
  allgemeiner Vandalismus umbenannt werden,
- Selbstbehalte, Höchstentschädigungen und Bedingungen müssen als getrennte,
  zusammengehörige Fakten erhalten bleiben,
- physische Seiten stammen ausschließlich aus der Page-Map.

### Dokument B

Ein Vandalismuscluster enthält getrennte Rollen für:

- positive Deckung,
- `1 %`, maximal `EUR 10.000`,
- `EUR 500` Selbstbehalt,
- die einschlägige Einbruch-/Raub-Abgrenzung,
- Graffiti-Ausschluss,
- Melde-/Polizeiobliegenheit.

Diese Fakten dürfen nicht nur anhand des Themenlabels dedupliziert werden. Eine
physische Seite wird nur verwendet, wenn sie aus einer validierten Page-Map
stammt; für Dokument B darf aus einer reinen Textreferenz keine Seite erfunden
werden.

## 11. Datenschutz

- Reale Kunden-PDFs, extrahierte Volltexte, Namen, Adressen, Polizzennummern,
  Logs mit Vertragsinhalten, Datenbanken und Vektoren werden nie committed.
- Goldstandardtests verwenden ausschließlich synthetische oder vollständig
  anonymisierte Strukturen.
- Die lokale unversionierte Findings-Datei ist kein Repository-Artefakt und
  darf weder verschoben noch blind eingecheckt werden.
- Diagnosemetriken enthalten ausschließlich allowlistete Laufzeitwerte, keine
  Kundentexte.

## 12. Pflege dieses Projektgedächtnisses

Bei jeder fachlich relevanten Änderung müssen mindestens aktualisiert werden:

- aktueller Release und Commit,
- Ist-Datenfluss,
- neu belegte oder widerlegte Annahmen,
- reale Laufzeit-/Coverage-Messungen,
- Status des betroffenen Failure Modes,
- neue oder geänderte Golden Cases,
- Entscheidung, ob ein Ansatz weitergeführt, begrenzt oder verworfen wird.

Ein grünes Release-Gate ersetzt diese Aktualisierung nicht.
