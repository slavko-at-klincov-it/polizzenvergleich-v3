# V3 Polizzenanalyse – Implementierungs- und Testtracker

Stand: 30. August 2026

## 1. Zweck und verbindlicher Arbeitsmodus

Dieses Dokument steuert die schrittweise Weiterentwicklung der Polizzenanalyse
in V3. Es ist Roadmap, Experiment-Ledger und Übergabedokument zwischen lokaler
Entwicklung und den kontrollierten Tests auf dem Kunden-Mac-Studio.

Der verbindliche Produkt-, Generalisierungs- und Abnahmevertrag steht in
[`PRODUKTZIEL_GENERALISIERUNG_UND_ABNAHME_DE.md`](./PRODUKTZIEL_GENERALISIERUNG_UND_ABNAHME_DE.md).
LF IMMO und WEVIG sind Regressionsexemplare; ein Erfolg auf diesen Dokumenten
allein ist weder das Produktziel noch ein Beweis für allgemeine fachliche
Richtigkeit.

Der verbindliche Ablauf lautet:

```text
Baseline einfrieren
  -> genau eine fachliche oder technische Hypothese wählen
  -> kleinste sinnvolle Implementierung
  -> fokussierte und angrenzende lokale Tests
  -> lokaler Vorher-/Nachher-Realtest
  -> strukturierter Review
  -> Release Candidate bauen
  -> identischer Test in frischem Workspace auf dem Kunden-Mac-Studio
  -> Ergebnisse vergleichen
  -> PASS, REVISE oder ROLLBACK
```

Es werden keine großen Umbauten mit mehreren gleichzeitig veränderten
Qualitätsvariablen durchgeführt. Prompt, Retrieval, Extraktion, Modell,
Ergebnisvertrag und Darstellung werden nur gemeinsam geändert, wenn sie
untrennbar zu derselben kleinen vertikalen Funktion gehören. Diese Kopplung
muss vor der Implementierung ausdrücklich dokumentiert werden.

## 2. Zustands-Lock

Einziger aktiver Implementierungspfad:

```text
Repository: polizzenvergleich-v3
Branch: codex/polizzenvergleich-v3
Ausgangs-HEAD: c2e9cb27
Tag: v3.2.1
```

`policy-clean-implementation`, `policy-agent-orchestration` und frühere
Repositories sind ausschließlich historische Versuchsevidenz. Dortige
Implementierungen werden weder fortgesetzt noch ungeprüft nach V3 kopiert.
Nachgewiesene Invarianten, Fehlermuster und Tests dürfen als Designinput für
eine V3-native Umsetzung verwendet werden.

Vor jeder Implementierung werden erneut festgehalten:

- Branch, HEAD und Dirty State;
- tatsächlich gestarteter Repositorypfad;
- V3-Version und Release Candidate;
- Storage- und Workspace-Identität;
- Dokumenthashes;
- Prompt- und Kataloghashes;
- LLM-, Embedding- und Kontextkonfiguration;
- Testhardware und Laufzeitumgebung.

## 3. Aktuelle V3-Baseline

V3.2.1 besitzt aktuell:

- kanonische physische PDF-PageMap;
- seitengebundene Chunks und Quellenmetadaten;
- automatische Einbettung hochgeladener Dokumente;
- acht Fachansichten `VS`, `FE`, `LW`, `ST`, `EL`, `HP`, `VB`, `WE`;
- einen formalen Kategorievalidator im separaten QA-Runner;
- einen normalen Chatpfad mit globaler Vektorsuche und freiem Modelloutput.

V3.2.1 besitzt aktuell noch nicht:

- dokumentweite lexikalische Occurrence-/Alias-Suche pro Requirement;
- Überschriften-, Klausel- und Tabellenstruktur;
- atomare Requirements und Fakten;
- servereigene Evidence-Spans mit Originaloffsets;
- sichere Rollen-, Scope-, Varianten- und Betragsbindung;
- Dokumentrollen, Versionen, Rang und Ersetzungsbeziehungen;
- serverseitig erzeugte fachliche Ergebniszeilen;
- einen persistenten, wiederaufnehmbaren Analysejob;
- ein fachlich bestätigtes EL-Oracle.

Fokussierte technische Baseline am 26. August 2026:

```text
4 Jest-Suites bestanden
30 Tests bestanden
0 fehlgeschlagen
```

Geprüft wurden Workspace-Fachvorlagen, PageMap, PageAwareTextSplitter und der
formale Kategorie-Outputvertrag. Diese Baseline ist kein fachlicher
Genauigkeitsnachweis.

## 4. Unveränderliche Produkt- und Qualitätsregeln

1. Fehlende Evidenz ist niemals automatisch ein Ausschluss oder `Nein`.
2. Unterschiedliche Objekte, Gefahren, Rollen, Varianten oder Geltungsbereiche
   sind nicht automatisch widersprüchlich.
3. Ein Widerspruch benötigt gegensätzliche aktive Fakten desselben Scopes und
   darf nicht durch eine bekannte Rang- oder Ersetzungsregel auflösbar sein.
4. Jede sichtbare Aussage, Quelle, Seite und Zahl muss auf servereigene
   Dokumentevidenz zurückführbar sein.
5. Kategorien sind Kunden- und Exportansichten, keine Faktenidentitäten.
6. Ein Vergleichspunkt kann null bis viele atomare Requirements, Fakten und
   Evidence-Spans besitzen.
7. Eine Kategorie mit `und` oder einer Aufzählung wird in getrennte
   Komponenten zerlegt.
8. Allgemeine Bedingungen, besondere Bedingungen und Nachträge bleiben als
   getrennte Dokumentfakten erhalten, bis ihre Beziehung geklärt ist.
9. Globale Top-N-Suche ist kein Vollständigkeitsbeweis für ein
   Mehrdokumentpaket.
10. Unsicherheit, fehlende Kandidaten oder ungeklärter Dokumentrang werden
    sichtbar ausgegeben und nicht durch Modellraten geschlossen.
11. Ein technisches `PASS` ersetzt keine fachliche oder rechtliche Endprüfung.
12. Private Policen, Rohzitate und vollständige Modellrequests werden nicht in
    Git eingecheckt.

## 5. Zielmodell für atomare Ergebnisse

Die interne Wahrheit wird nicht mehr durch genau eine Tabellenzelle
repräsentiert. Mindestens drei voneinander unabhängige Achsen werden benötigt:

```text
evidenceCompleteness = COMPLETE | PARTIAL | NONE

coverageEffect je atomarem Requirement =
  INCLUDED | EXCLUDED | CONDITIONAL | OPTION_ONLY | UNKNOWN

coveragePicture je sichtbarer Kategorie =
  INCLUDED | EXCLUDED | MIXED | NOT_DETERMINABLE

conflictState =
  NONE | ACTIVE_SAME_SCOPE | UNRESOLVED_PRECEDENCE
```

Beispiel EL-16, sofern die autoritativen Belege fachlich bestätigt wurden:

```text
Wintergarten -> INCLUDED
Vitrine       -> EXCLUDED

evidenceCompleteness = COMPLETE
coveragePicture       = MIXED
conflictState         = NONE
```

Der sichtbare Legacy-Prüfstatus wird erst aus diesen Fakten abgeleitet. Das
Modell darf ihn nicht frei bestimmen.

## 6. Zielworkflow

```text
Vertragspaket
  -> Dokumentidentität, Rolle, Version und Rang
  -> kanonische Seiten- und Strukturartefakte
  -> atomare Requirements
  -> vollständige Alias-/Occurrence-Suche je Requirement und Dokument
  -> kleinster Klausel-/Tabellenkontext plus Heading und Fortsetzungen
  -> servereigene Evidence-Spans
  -> begrenzte LLM-Klassifikation nur bei Ambiguität
  -> deterministische Fakten- und Scope-Gates
  -> serverseitiger Kategorie-Rollup
  -> Kundenansicht, Detailansicht und Excel
```

Kapitel dienen als Navigation und Scopekontext. Die primäre Faktgrenze ist die
kleinste vollständige Klausel, Aufzählung oder Tabellenzeile. Ein Fenster von
etwa 120 bis 200 Wörtern ist nur Lesefallback, nicht der fachliche Belegvertrag.

## 7. Geplante kleine Implementierungsschritte

Die Reihenfolge ist ein Arbeitsvorschlag. Jeder Schritt benötigt vor Beginn
einen ausgefüllten Change Brief aus Abschnitt 8.

| ID         | Kleine vertikale Funktion                                             | Lokales Hauptgate                                                                             | Kunden-Gate                                                          | Status         |
| ---------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------- |
| `INC-000`  | Reproduzierbare Current-HEAD-Baseline für EL-16 einfrieren            | Run-ID, Dokument-/Prompt-/Runner-/Modellidentität, gehashte Artefakte und Messwerte vorhanden | eigener Ausgangslauf auf Mac Studio mit dortigem Modell              | `IN ARBEIT`    |
| `INC-001`  | Atomarer EL-16-Ergebnisvertrag und deterministischer Rollup           | synthetische Komponenten- und Konflikttests                                                   | noch kein Kundenrelease erforderlich, sofern ohne Produktintegration | `PASS`         |
| `INC-002`  | Serverseitiger Renderer für `COMPLETE + MIXED + NONE`                 | keine frei erfundene Zeile; bestehende Kategorien regressionsfrei                             | EL-16 wird korrekt und nachvollziehbar dargestellt                   | `OFFEN`        |
| `INC-003`  | V3-native dokumentweite Alias-/Occurrence-Suche; Pilot VS-16/17/21/28 | alle deklarierten Vorkommen mit richtiger Seite, Originaloffset und Klauselkontext            | bestätigte Pilot-Fundstellen werden vollständig gefunden             | `PASS (PILOT)` |
| `INC-003B` | Begrenzte LLM-Kandidatentriage für den VS-Pilot                       | ausschließlich bekannte Candidate-IDs; jeder Kandidat genau einmal klassifiziert              | noch kein Kundenrelease                                              | `REVISE`       |
| `INC-004`  | Stabile servereigene Evidence-Spans                                   | jede Span-ID rekonstruiert exakt Dokument, Seite und Originaltext                             | Quellen bleiben auf Mac Studio identisch prüfbar                     | `OFFEN`        |
| `INC-005`  | Begrenzte EL-16-Klassifikation über erlaubte Span-IDs                 | Modell kann keine fremde Quelle, Seite oder ID erzeugen                                       | reproduzierbarer EL-16-Output auf Kundenhardware                     | `OFFEN`        |
| `INC-006`  | Rollen-/Scope-Gates für EL-16 und Geldwerte                           | kein Cross-Binding benachbarter Rollen; kein falscher Widerspruch                             | gleiche fachliche Verbesserung im Realpaket                          | `OFFEN`        |
| `INC-007`  | Privates EL-Oracle für EL-16 und synthetisches Repository-Oracle      | Candidate-, Span-, Fact- und Rollup-Gates getrennt messbar                                    | bestätigte Kundenbelege bestehen                                     | `OFFEN`        |
| `INC-008`  | Erweiterung auf die schwierigen EL-Fälle                              | keine Regression bei EL-16; offene Fälle bleiben offen                                        | kontrollierter EL-Teilrelease                                        | `OFFEN`        |
| `INC-009`  | EL-01 bis EL-36 auf einem Dokument                                    | vollständige Requirement-Terminierung und serverseitige Rows                                  | beaufsichtigter Einzelpaketlauf                                      | `OFFEN`        |
| `INC-010`  | Vertragspaket mit 1, 3 und 9 Dokumenten                               | Suche je Requirement und Dokument; Rolle, Version und Rang sichtbar                           | kein Dokumentverlust im Mac-Studio-Paket                             | `OFFEN`        |
| `INC-011`  | Persistenter Ein-Klick-Analysejob                                     | Progress, Resume, Cancel, Fehler- und Cleanup-Pfade                                           | Lauf übersteht Navigation; Betriebsabnahme                           | `OFFEN`        |
| `INC-012`  | Weitere Fachansichten und A/B-Vergleich                               | dokumentisolierte Fakten vor dem Join                                                         | LF IMMO gegen zweiten Anbieter                                       | `OFFEN`        |

Ein Schritt darf geteilt werden, wenn sein Change Brief mehr als eine
unabhängig messbare Hypothese enthält. Schritte dürfen nicht zusammengelegt
werden, nur um schneller einen großen Release zu erzeugen.

## 8. Change Brief vor jeder Implementierung

```text
Increment-ID:
Datum:
Ausgangs-Branch / HEAD:

Nutzerproblem:
Beobachtete Baseline:
Hypothese:
Genau eine primäre Messvariable:

In Scope:
Out of Scope:
Betroffene Module und Caller:
Persistenz-/UI-/Runtime-Auswirkung:
Historische Versuchsevidenz:
Bekanntes Fehlermuster, das nicht wiederholt werden darf:

Erwartete Verbesserung:
Mögliche Regression:
Rollbackgrenze:

Fokussierter Reproduktionstest:
Angrenzende Regressionstests:
Lokaler Realtest:
Kunden-Mac-Studio-Test:

PASS-Kriterien:
REVISE-Kriterien:
ROLLBACK-Kriterien:
```

## 9. Modulvertrag für neue V3-Bausteine

Jeder wichtige neue Baustein dokumentiert knapp:

```text
Modulname und Verantwortung
Rolle im Workflow
Explizite Inputs
Explizite Outputs
Lese- und Schreibseitenwirkungen
Fehlermodi und Fail-Closed-Verhalten
Unit-, Integrations- und Realstrukturtests
Invarianten, die spätere Änderungen bewahren müssen
```

Parsing, Suche, Modellaufruf, Faktentscheidung, Persistenz und Rendering werden
nicht in einem einzigen Runner oder God-Modul vermischt.

Voraussichtliche, noch nicht implementierte Verantwortungsgrenzen:

```text
policyPackageManifest   -> Paket- und Dokumentidentität
requirementCatalog      -> stabile Views und atomare Requirements
documentStructure       -> Seiten, Klauseln, Tabellen, Headings, Fortsetzungen
occurrenceSearch        -> vollständige kontrollierte Vorkommen
evidenceSpanRegistry    -> unveränderliche servereigene Belege
factClassification      -> begrenzte Rollen-/Wirkungskandidaten
factValidation          -> deterministische Quellen-, Rollen- und Scope-Gates
categoryRollup          -> Vollständigkeit, Deckungsbild und Konflikt
categoryRenderer        -> Kundenansicht und Excel
analysisJob             -> Checkpoints, Resume, Cancel und Veröffentlichung
```

Diese Namen sind Planungsnamen und werden erst beim jeweiligen Change Brief
gegen die tatsächlichen V3-Muster geprüft.

## 10. Testpyramide pro Increment

### A. Reproduktion vor der Änderung

- Fehler am eingefrorenen Ausgangsstand reproduzieren oder originalgetreu
  simulieren;
- bei Realpolicen Run-ID, Dokumenthash und private Artefakte sichern;
- eindeutig festhalten, ob der Fehler fachlich bestätigt oder noch eine
  Annahme ist.

### B. Fokussierte Unit- und Vertragstests

- kleinster Test für die neue Regel;
- negative Kontrolle;
- Grenz- und Missing-Evidence-Fälle;
- deterministische Wiederholung;
- keine Netzwerk- oder LLM-Abhängigkeit, wenn reine Logik geprüft wird.

### C. Angrenzende Regressionstests

- Caller und Datenfluss;
- bestehende PDF-PageMap und Quellenanzeige;
- Workspace-Upload und Embedding;
- Kategorie-ID-, Reihenfolge- und Ausgabeformat;
- Fehler-, Cleanup- und Wiederaufnahmepfade, sofern betroffen.

### D. Lokaler Realtest

- identische autoritative Dokumentfassung wie in der Baseline;
- identische Modelle und Parameter;
- nur der implementierte Codepfad wird verändert;
- Antwort, Quellen, Modellinput, Zeitmessung und Gate-Report werden getrennt
  gespeichert;
- Vorher-/Nachher-Vergleich pro Requirement, nicht nur Gesamteindruck.

### E. Kunden-Mac-Studio-Test

- signierter beziehungsweise eindeutig gehashter Release Candidate;
- `doctor.command` vor und nach dem Update;
- neuer Test-Workspace und zwingende Neuindexierung, wenn sich das
  Extraktions- oder Vektorschema geändert hat;
- kein stilles Testen auf einem alten Vektorcache;
- identische Dokument-, Prompt-, Katalog- und Modellidentität protokollieren;
- Ergebnis gegen lokale Messung und Oracle vergleichen.

### F. Reviewentscheidung

- `PASS`: Increment erfüllt alle vorher festgelegten Gates;
- `REVISE`: Hypothese bleibt plausibel, Implementierung oder Nachweis reicht
  noch nicht;
- `ROLLBACK`: Regression, unvertretbare Laufzeit oder widerlegte Hypothese;
- `BLOCKED`: fehlende autoritative Unterlage, Hardwareevidenz oder fachliche
  Entscheidung verhindert einen ehrlichen Abschluss.

## 11. Verbindliche EL-16-Golden-Cases

| Fall                                                                      | Erwartung                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------- |
| Wintergarten eingeschlossen, Vitrine ausgeschlossen                       | `COMPLETE + MIXED + NONE`; niemals Widerspruch           |
| Dasselbe Objekt im selben aktiven Scope eingeschlossen und ausgeschlossen | Konfliktkandidat `ACTIVE_SAME_SCOPE`                     |
| Unterschiedliche Objekte mit unterschiedlicher Wirkung                    | kein Konflikt                                            |
| Nur eine von zwei Pflichtkomponenten belegt                               | `PARTIAL + NOT_DETERMINABLE`; niemals pauschal `Nein`    |
| Späterer Nachtrag ersetzt die ältere Regel eindeutig                      | kein aktiver Widerspruch; gültige Nachtragswirkung       |
| Vorrang zweier Dokumente ungeklärt                                        | `UNRESOLVED_PRECEDENCE`, kein erfundener Sieger          |
| Span stammt aus anderem Dokument oder falscher Seite                      | fail-closed                                              |
| Bekannter Alias fehlt, semantischer Kandidat existiert                    | lexikalische und semantische Coverage getrennt berichten |

Das echte EL-16-Oracle wird erst nach Bestätigung der autoritativen PDF-Fassung,
der exakten Fundstellen und der erwarteten fachlichen Wirkungen als
`CONFIRMED` geführt.

## 12. Messwerte und Vorher-/Nachher-Vergleich

Jeder Lauf berichtet mindestens:

### Daten- und Retrievalqualität

- Paketdokumente erwartet / verarbeitet / durchsucht;
- physische Seiten erwartet / extrahiert / textführend;
- Requirements erwartet / terminal bearbeitet;
- bestätigte Occurrences gefunden / erwartet;
- semantische Zusatzkandidaten;
- sichtbare Kandidatenverluste oder Overflow;
- Evidence-Spans gültig / ungültig.

### Fachliche Bindung

- korrekte Komponentenwirkung;
- korrekte Rollenbindung;
- korrekte Objekt-, Gefahren-, Varianten- und Geltungsbereichsbindung;
- falsche `Nein`-Aussagen;
- falsche Widersprüche;
- unzulässige Verallgemeinerungen;
- ehrlich offene Requirements.

### Ausgabe

- vollständig serverseitig rekonstruierbare Quellen;
- korrekte Dokumentkennung, physische Seite und Originalspan;
- deterministische Row-Anzahl und Reihenfolge;
- korrekter Rollup;
- keine freie modellgenerierte Quelle oder Zahl.

### Laufzeit

- Extraktion/OCR;
- Strukturierung;
- lexikalische Suche;
- Embedding und semantische Suche;
- Modellcalls nach Anzahl, Input- und Outputtokens;
- Validierung, Rollup und Rendering;
- Gesamtzeit kalt und warm;
- Peak-Ressourcen, soweit zuverlässig messbar.

Das Produktziel `< 60 Minuten` für bis zu neun Dokumente ist ein noch
unbewiesenes SLO. Es wird erst nach festen 1-, 3- und 9-Dokumentläufen auf der
Kundenhardware als bestanden geführt. Ein Zeitbudget darf zu sichtbaren offenen
Fällen führen, niemals zu geratenen Ergebnissen.

## 13. Release- und Rollbackregeln

1. Ein lokaler grüner Test erzeugt noch keinen Kundenrelease.
2. Ein Release Candidate erhält eindeutige Version, Git-Commit und Paket-Hash.
3. Private Policen und Run-Artefakte bleiben außerhalb des öffentlichen
   Releasepakets.
4. Datenbank, Dokumentartefakte, Vektorindex und Code werden als
   zusammengehöriger Zustand behandelt.
5. Änderungen am Extraktions- oder Vektorschema erzwingen einen neuen
   Test-Workspace und eine vollständige Neuindexierung.
6. Der bestehende Kundenstand wird vor einem riskanten Update gesichert.
7. Rollbackbefehle und betroffene Zustände werden vor dem Update festgelegt.
8. Ein Kunden-`PASS` gilt nur für die dokumentierte Hardware, Modelle,
   Dokumente und Konfiguration.
9. Ein erfolgreiches EL-16-Ergebnis ist keine automatische Freigabe für EL-36,
   neun Dokumente oder andere Versicherer.

## 14. Fortlaufendes Experiment-Ledger

| Increment  | Baseline                            | Implementierung                                                                | Lokale Tests                                                                                     | Lokaler Realtest                                                                                         | RC  | Mac Studio         | Entscheidung   | Nächster Schritt                                                                  |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --- | ------------------ | -------------- | --------------------------------------------------------------------------------- |
| `INC-000`  | V3.2.1 / `c2e9cb27`                 | keine                                                                          | technische Baseline 30/30 grün; aktuelle Revalidierung: 36 Zeilen, 8 Spalten, 108 formale Gründe | `R01 REVISE`; 31/31 Seiten und 38/38 Chunks im Kontext; EL-16 findet beide Objektregeln                  | –   | ausständig         | `IN ARBEIT`    | Mac-Studio-Ausgangslauf und fachliche EL-16-Bestätigung                           |
| `INC-001`  | lokaler INC-000-Lock                | isolierter atomarer Komponentenvertrag und deterministischer Rollup            | 14/14 fokussiert; 45/45 fokussiert plus angrenzend; Format und Diff sauber                       | nicht anwendbar, noch kein produktiver Caller                                                            | –   | nicht erforderlich | `PASS`         | vor INC-002 Kunden-Ausgangslauf einfrieren                                        |
| `INC-003`  | autoritative 31-seitige LF-IMMO-PDF | kontrollierte VS-Alias-/Occurrence-Suche plus Kandidaten-Arbeitsblatt          | 8/8 fokussiert; 53/53 fokussiert plus angrenzend; 17/17 Realoffsets rekonstruiert                | R01 fand 14; Alias-Lücke erkannt; R02/R03 finden 17 Kandidaten in 6/8 Komponenten und sind byteidentisch | –   | nicht erforderlich | `PASS (PILOT)` | Arbeitsblatt reviewen; danach LLM-Aktivierung oder Katalogausweitung entscheiden  |
| `INC-003B` | INC-003-Worksheet mit 17 Kandidaten | begrenzter Qwen-Triagevertrag, Servermaterialisierung und drei Golden-Controls | 11/11 fokussiert; 65/65 inklusive angrenzender Tests; Format und Diff sauber                     | R05: 17/17 formal, aber 2/3 fachliche Kontrollen; koordinierter Abbruch bleibt falsch klassifiziert      | –   | nicht erforderlich | `REVISE`       | INC-003C: serverseitige Koordinationsstruktur und erlaubte Rollen getrennt prüfen |

Für jedes abgeschlossene Increment wird eine Detailsektion ergänzt:

```text
## INC-XXX – Titel

Change Brief:
Geänderte Dateien und Modulgrenzen:
Commit / Release Candidate:
Lokale Testbefehle und Resultate:
Lokaler Vorher-/Nachher-Vergleich:
Mac-Studio-Konfiguration und Resultat:
Abweichungen lokal gegen Kunde:
Reviewentscheidung:
Restrisiko:
Folgeentscheidung:
```

## 15. INC-000 – Current-HEAD-Ausgangslauf für EL-16

### Zustands- und Eingabe-Lock

```text
Run-ID: INC-000-V321-EL16-LOCAL-QWEN4B-R01
Repository: polizzenvergleich-v3
Branch: codex/polizzenvergleich-v3
HEAD / Tag: c2e9cb27 / v3.2.1
Produktcodeänderung: keine

Referenz-PDF: ausschließlich die 31-seitige *_mod.pdf
PDF-SHA-256: 2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62
Systemprompt-SHA-256: d5b1c465f20836d6d3069aaba89b1d5d22d3eaeed1649a92638c7e1d3b304628
Runner-SHA-256: 02008e3b3a83aeebff2f8171b3f8d5c3e9fd62b9ff9c564ee55ff657265234b3
Validator-SHA-256: a79a358244ebdbfd3964a0ed502aae32452d1fedd8a866d597933ab96ff55bfa
```

Die frühere 40-seitige Generali-Datei ist für diesen Test ausdrücklich keine
Referenz. Private Antwort-, Quellen-, Nachrichten- und Manifestdateien liegen
außerhalb von Git unter der Run-ID. Der Laufordner wurde nach dem Lauf auf
Benutzerzugriff `700/600` beschränkt. Künftige private Läufe beginnen mit
`umask 077`.

### Lokale Laufkonfiguration

```text
Hardware: Apple M3 Pro, 18 GiB RAM, arm64
System: macOS 26.5 (25F71)
Node: v22.23.2
LLM: qwen3.5-4b-mlx, LM Studio
Embedding: text-embedding-dinghy-law-4b-v1
Top-N: 55
Chunkgröße / Überlappung: 3000 / 250
Deklariertes modelTokenLimit: 32768
Tatsächlich geladener LM-Studio-Kontext: 77312
```

Wichtige Reproduzierbarkeitsgrenze: Der QA-Runner protokolliert das deklarierte
`modelTokenLimit`, erzwingt aber nicht den normalen Kompressions- und
Kontextlimitpfad. Außerdem wurde kein Seed gesetzt. Der Lauf ist anhand seiner
Eingaben und Artefakte nachvollziehbar, aber nicht als byteidentisch
deterministisch behauptet.

Der lokale 4B-Lauf und der Kundenlauf mit Qwen 27B sind keine identischen
Modellläufe. Daher werden auf jeder Maschine eigene Vorher-/Nachher-Paare
gebildet. Verglichen werden die fachlichen Invarianten und Gates; rohe
Antwortunterschiede zwischen 4B und 27B gelten nicht als Wirkung eines
Code-Increments.

### Lokales Resultat R01

```text
Gesamtdauer: 265,666 Sekunden
Extraktion: 31/31 physische Seiten, 31/31 textführend
Index: 38 Chunks / 38 gespeicherte Zeilen
Retrieval: 38 Quellen; physische Seiten 1 bis 31 vollständig im Kontext
Tokens: 31.852 Prompt / 3.717 Completion / 35.569 gesamt
Modellgenerierung: 195,398 Sekunden; 19,02 Output-Tokens/s
Ausgabeform: 36/36 IDs in Reihenfolge; jede Zeile genau 8 Spalten
Validator: REVISE; 108 Gründe
```

Die aktuelle HEAD-Revalidierung reproduziert genau drei formale Fehlerklassen
für jede der 36 Zeilen:

- `INVALID_STATUS`: Das Modell kombiniert Prüfstatus und Deckungswert in der
  Statuszelle, statt nur den erlaubten Prüfstatus auszugeben.
- `INVALID_STATUS_COVERAGE`: Durch diese Kombination ist auch die zulässige
  Status-/Deckungskombination formal verletzt.
- `INVALID_SOURCE_FORMAT`: Die Modellquellen entsprechen nicht dem geforderten
  physischen Seiten- und Vollzitatformat; teilweise enthalten sie Auslassungen.

Das ist kein Spalten- oder ID-Parserfehler. Die Tabellenform mit 36 Zeilen und
acht Spalten wurde korrekt erkannt.

### EL-16-Beobachtung

R01 findet auf der physischen PDF-Seite 15 beide unterschiedlichen
Objektaussagen: die einschließende Wintergartenregel und die ausschließende
Vitrinenregel. Der Lauf erzeugt diesmal nicht `WIDERSPRÜCHLICH`, kann das
vollständig belegte gemischte Deckungsbild aber ebenfalls nicht korrekt
darstellen. Er weicht auf eine in sich inkonsistente Kombination aus `Ja`,
`TEILBELEGT` und `Nicht feststellbar` aus.

Damit ist für INC-001 lokal belegt:

1. Bloßes Hinzufügen der Regel „verschiedene Objekte sind kein Widerspruch“
   ist kein hinreichender Fix; diese Regel steht bereits im Current-HEAD-Prompt.
2. Beide benötigten EL-16-Textstellen waren in diesem Lauf vorhanden.
3. Der aktuelle Ergebnisvertrag besitzt keinen sauberen Zustand für
   `COMPLETE + MIXED + NONE`.
4. Status, Deckungsbild und Konflikt müssen intern getrennt werden.
5. Quellenformat und serverseitige Quellenbindung sind ein eigener späterer
   Nachweis und dürfen nicht durch Promptkosmetik als gelöst gelten.

Eine vollständige fachliche Bewertung aller 36 Zeilen wurde in INC-000 nicht
durchgeführt. Auffälligkeiten außerhalb von EL-16 werden deshalb nicht als
bestätigte Regressionen oder Verbesserungen verbucht.

### Offene Gates

- Fachliche Bestätigung, dass genau die festgehaltenen EL-16-Wirkungen für die
  autoritative 31-seitige PDF das erwartete Soll sind.
- Eigener Current-HEAD-Ausgangslauf auf dem Kunden-Mac-Studio mit dessen exakt
  protokolliertem Qwen-27B-Modell und neuem Workspace.
- Hashes und private Artefakte des Kundenlaufs.

Reviewentscheidung: `IN ARBEIT`. Der lokale Baseline-Anteil ist eingefroren;
INC-000 bleibt bis zum Kundenlauf und zur fachlichen Bestätigung offen.

## 16. INC-001 – Change Brief

```text
Increment-ID: INC-001
Datum: 26. August 2026
Ausgangs-Branch / HEAD: codex/polizzenvergleich-v3 / c2e9cb27

Nutzerproblem:
EL-16 kann zwei vollständig belegte, unterschiedliche Objektwirkungen nicht
ohne falschen Teilstatus oder Widerspruch darstellen.

Beobachtete Baseline:
R01 findet beide Objektregeln, erzeugt aber eine inkonsistente Kombination aus
Ja, TEILBELEGT und Nicht feststellbar.

Hypothese:
Ein reiner atomarer Komponentenvertrag mit drei getrennten Rollup-Achsen kann
EL-16 und die negativen Kontrollen deterministisch und fail-closed abbilden.

Genau eine primäre Messvariable:
Der deterministische Rollup liefert für jeden Golden Case exakt das festgelegte
Quadrupel aus Evidenzvollständigkeit, Deckungsbild, Konflikt und abgeleitetem
Prüfstatus.

In Scope:
- reine Enums, Eingabevalidierung und Rollup-Funktion ohne I/O;
- EL-16- und Konflikt-Golden-Cases;
- explizite Ablehnung fehlender, doppelter oder inkonsistenter Komponenten.

Out of Scope:
- bestehender QA-Validator und Fachprompts;
- Retrieval, LLM, Dokumentevidenz, Scope-Erkennung und Dokumentrang;
- Chatpfad, UI, Persistenz, Excel und Kundenrelease.

Betroffene Module und Caller:
Neues isoliertes Modul unter server/utils/policyAnalysis; zunächst ausschließlich
fokussierter Test-Caller. Kein produktiver Caller in INC-001.

Persistenz-/UI-/Runtime-Auswirkung:
Keine.

Historische Versuchsevidenz:
Frühere Rollen-/Occurrence-Prototypen beweisen diese Rollup-Grenze nicht; nur
ihre Fehlermuster und Invarianten werden übernommen.

Bekanntes Fehlermuster, das nicht wiederholt werden darf:
MIXED darf niemals automatisch Konflikt bedeuten. Fehlende Evidenz darf niemals
als EXCLUDED oder Nein gerollt werden.

Erwartete Verbesserung:
COMPLETE + MIXED + NONE wird erstmals intern eindeutig repräsentierbar.

Mögliche Regression:
Zu permissive Eingaben könnten unvollständige Pipelinezustände als fachliches
Ergebnis tarnen; deshalb fordert der Vertrag genau ein terminales Resultat je
Pflichtkomponente.

Rollbackgrenze:
Neues Modul und sein fokussierter Test; keine Migration und keine Datenänderung.

Fokussierter Reproduktionstest:
Wintergarten INCLUDED + Vitrine EXCLUDED.

Angrenzende Regressionstests:
Bestehender Kategorievertrag, Workspace-Templates, PageMap und Splitter.

Lokaler Realtest:
Nicht zutreffend; INC-001 ist absichtlich noch nicht produktiv verdrahtet.

Kunden-Mac-Studio-Test:
Nicht erforderlich für INC-001 allein.

PASS-Kriterien:
Alle Golden Cases und Invalid-Input-Kontrollen grün; angrenzende Baseline grün;
keine produktiven Caller und keine I/O-Seitenwirkung.

REVISE-Kriterien:
Ein Golden Case benötigt weiterhin vermischte Achsen oder unklare Semantik.

ROLLBACK-Kriterien:
Bestehendes Produktverhalten, Persistenz oder Ausgabe wird unbeabsichtigt
verändert.
```

INC-001 darf vor dem ausstehenden Kunden-Ausgangslauf implementiert werden,
weil sein Modul noch keinen produktiven Caller besitzt und keinen Release
erzeugt. Vor dem ersten integrierten Release Candidate bleibt der
Mac-Studio-V3.2.1-Ausgangslauf zwingend.

### INC-001-Resultat

Geänderte Modulgrenze:

- `server/utils/policyAnalysis/categoryResultContract.js` ist eine reine
  Entscheidungsfunktion ohne I/O, Persistenz, Netzwerk oder globale Mutation.
- Das Modul verlangt genau ein terminales Resultat pro Pflichtkomponente.
- Scope- und Rangermittlung bleiben ausdrücklich außerhalb dieses Moduls und
  müssen ihre Konfliktentscheidung später als validierten Input liefern.
- Es existiert noch kein produktiver Caller; nur der fokussierte Test importiert
  das Modul.

Nachgewiesene Regeln:

- Wintergarten `INCLUDED` plus Vitrine `EXCLUDED` ergibt
  `COMPLETE + MIXED + NONE + BELEGT`.
- Unterschiedliche Komponentenwirkungen werden niemals allein wegen ihrer
  Verschiedenheit zum Konflikt.
- Ein bereits validierter aktiver Same-Scope-Konflikt bleibt
  `ACTIVE_SAME_SCOPE + WIDERSPRÜCHLICH`, ohne eine Wirkung zu erfinden.
- Ungeklärter Dokumentvorrang bleibt
  `UNRESOLVED_PRECEDENCE + UNGEKLÄRT`.
- Teilweise oder vollständig fehlende Evidenz bleibt
  `NOT_DETERMINABLE` und kann nicht als Ausschluss eingegeben werden.
- Fehlende, doppelte, fremde und inkonsistente Komponenten brechen fail-closed
  mit stabilen Fehlercodes ab.
- Vollständig belegte Bedingungen und bloße Optionen bleiben als atomare
  Wirkungen erhalten, ohne sie fälschlich in `INCLUDED` oder `EXCLUDED`
  umzudeuten.

Verifikation:

```text
Fokussierte Tests: 1 Suite, 14/14 Tests bestanden
Fokussiert plus angrenzend: 6 Suites, 45/45 Tests bestanden
Prettier: PASS
git diff --check: PASS
Produktive Caller außerhalb des Moduls: 0
```

Der erste Testaufruf scheiterte ausschließlich an einem falschen relativen
Importpfad im neuen Test-Harness. Nach dessen Korrektur waren alle fachlichen
Tests grün. Der gezielte ESLint-Aufruf konnte wegen einer bereits bestehenden
Inkompatibilität von ESLint 9 mit `eslint-plugin-react` (`context.getScope`)
nicht als Gate verwendet werden. Es wurde kein dateibezogener Lintfehler
gemeldet; Format- und Testgates sind grün. Die Lint-Infrastruktur bleibt als
separater technischer Befund offen und ist keine fachliche Freigabe.

Reviewentscheidung: `PASS` für INC-001. Das neue Modul ist noch keine
Produktverbesserung und verändert den aktuellen V3-Output nicht. Seine Wirkung
kann erst mit INC-002 über einen serverseitigen Renderer beziehungsweise einen
eng begrenzten Integrationspfad beobachtet werden.

## 17. INC-003 – Change Brief: VS-Occurrence-Arbeitsblatt

```text
Increment-ID: INC-003
Datum: 26. August 2026
Ausgangs-Branch / HEAD: codex/polizzenvergleich-v3 / c2e9cb27

Nutzerproblem:
V3 übergibt heute globale Ähnlichkeits-Chunks an das LLM. Vor dem Modell ist
nicht prüfbar, ob jede Pflichtkomponente einer VS-Kategorie dokumentweit gesucht
und mit richtiger Seite sowie richtigem Kontext bereitgestellt wurde.

Beobachtete Baseline:
Für den neuen atomaren Rollup existiert noch keine PDF-zu-Komponenten-Zufuhr.
Der normale Chatpfad und der QA-Runner kennen das neue Modul nicht.

Hypothese:
Eine generische kontrollierte Alias-/Occurrence-Suche auf der kanonischen
PageMap kann für vier repräsentative VS-Punkte ein vollständiges, vor dem LLM
prüfbares Kandidaten-Arbeitsblatt erzeugen.

Genau eine primäre Messvariable:
Alle im Golden Fixture und im manuell geprüften LF-IMMO-Pilot erwarteten
kontrollierten Aliasvorkommen besitzen richtige physische Seite und exakte
Originaloffsets.

In Scope:
- VS-16, VS-17, VS-21 und VS-28 als versionierter Pilotkatalog;
- Normalisierung mit Rückabbildung auf Originaloffsets;
- dokumentweite Aliasvorkommen je atomarer Komponente;
- kleinster verfügbarer Listen-/Absatzkontext;
- candidate-only Arbeitsblatt vor dem LLM;
- privater LF-IMMO-Reallauf ohne Modellaufruf.

Out of Scope:
- Deckungsentscheidung, Rollen-/Scope-/Rangentscheidung und Betragsbindung;
- semantische Synonymsuche außerhalb des kontrollierten Katalogs;
- Tabellen-/Heading-Fortsetzungen über Seiten;
- produktiver Chatpfad, UI, Persistenz, Excel, LLM-Aufruf und Kundenrelease;
- vollständige VS-01-bis-VS-36-Abdeckung.

Betroffene Module und Caller:
Neues reines Such-/Kontextmodul, versionierter Pilotkatalog, fokussierte Tests
und ein separater privater QA-Worksheet-Runner. Keine produktiven Caller.

Persistenz-/UI-/Runtime-Auswirkung:
Keine Produktwirkung. Der QA-Runner schreibt nur eine explizit angegebene
private Ausgabedatei mit restriktiven Rechten.

Historische Versuchsevidenz:
Occurrence-Suche und Klauselkontext waren historisch vielversprechend, banden
aber Rollen und Beträge falsch. Deshalb erzeugt INC-003 ausschließlich
Kandidaten und keine Fakten oder Deckungswerte.

Bekanntes Fehlermuster, das nicht wiederholt werden darf:
Ein Treffer auf Garage darf nicht Tiefgarage oder Garageneinrichtung als
Garage zählen. Müllsammelplatz darf nicht automatisch Müllraum beweisen.
Aufräumungs- und Abbruchkosten dürfen nicht ohne Geltungsbereich und Limit
zusammengeführt werden.

Erwartete Verbesserung:
Vor dem LLM wird sichtbar, welche Komponenten, Seiten, Originalstellen und
Kontexte tatsächlich vorbereitet wurden und welche lexikalisch offenbleiben.

Mögliche Regression:
Fehlerhafte Normalisierung oder Offsets könnten falsche Quellen erzeugen;
überbreite Aliase könnten Candidate-Noise als Recallgewinn tarnen.

Rollbackgrenze:
Neue isolierte Module, Pilotkatalog, Tests und QA-Skript; keine Migration.

Fokussierter Reproduktionstest:
Synthetische PageMap mit Flexion, Umlaut, Soft-Hyphen, Zeilenumbruch,
Wortgrenzen, Listenfortsetzung und fehlender Komponente.

Angrenzende Regressionstests:
PageMap, PageAwareTextSplitter, Fachvorlagen und bestehender Outputvertrag.

Lokaler Realtest:
Autoritative 31-seitige LF-IMMO-PDF, kein LLM; privates Arbeitsblatt und
manuelle Prüfung der Pilotfundstellen.

Kunden-Mac-Studio-Test:
Für diesen isolierten candidate-only Pilot noch nicht erforderlich.

PASS-Kriterien:
Alle synthetischen Treffer und Offsets korrekt; keine Substring-Falschtreffer;
LF-Arbeitsblatt reproduzierbar, Seiten/Originaltexte rekonstruierbar und kein
LLM-/Produkt-Caller.

REVISE-Kriterien:
Erwartete kontrollierte Vorkommen fehlen, Kontexte überschreiten die definierte
Grenze oder Kandidaten werden als Fakten dargestellt.

ROLLBACK-Kriterien:
Bestehender Produktpfad oder gespeicherte Dokumentdaten werden verändert.
```

Die Reihenfolge wurde auf ausdrücklichen Nutzerwunsch geändert: INC-003 wird
vor dem Renderer INC-002 ausgeführt, damit zuerst die reale Vorbereitung bis
zum LLM sichtbar und prüfbar wird.

### INC-003-Resultat

Neue Modulgrenzen:

- `controlledOccurrenceWorksheet.js` normalisiert Text mit Rückabbildung auf
  Originaloffsets, enumeriert kontrollierte Aliase auf jeder physischen Seite
  und bildet Listen-/Absatzkontext. Das Modul besitzt keine I/O-Seitenwirkung.
- `vs-occurrence-pilot.v0.1.json` enthält nur den versionierten Pilotkatalog für
  VS-16, VS-17, VS-21 und VS-28.
- `buildVsOccurrenceWorksheet.cjs` extrahiert die echte PDF über den aktuellen
  V3-PDFLoader und schreibt ausschließlich eine explizit angegebene private
  Worksheet-Datei mit `700/600`-Rechten.
- Es existiert kein produktiver Caller und kein LLM-Aufruf.

Fokussierte Golden-Case-Verifikation:

```text
1 Suite / 8 Tests bestanden
- Umlaut- und Soft-Hyphen-Normalisierung
- Zeilenhyphenierung mit Originaloffset
- vollständige dokumentweite Enumeration
- Garage ungleich Tiefgarage ungleich Garageneinrichtung
- koordinierte Form Aufräumungs-
- kleinster vollständiger Listenpunkt
- explizites NO_CONTROLLED_CANDIDATE ohne Ausschluss
- fail-closed bei unvollständiger PageMap
```

Angrenzende Verifikation:

```text
7 Suites / 53 Tests bestanden
Prettier: PASS
git diff --check: PASS
Produktive Caller: 0
```

LF-IMMO-Reallauf:

```text
PDF-SHA-256: 2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62
Physische Seiten: 31
PageContent-SHA-256: b2458f8a78074908a0723c0f374f82866ef65b5c8ada913cc57b1828abd8bd85
Pilotkatalog-SHA-256: e91f0295a77119514549669f913de166ef13fcfaeb0dd409c060286186dc3a7e
Suchmodul-SHA-256: c2138838f8d7be9eef5398db172e00de8237d51e2bc8d35b8e7bb5e04c752c35
Worksheet-Runner-SHA-256: b0d871f532b794a79ff73e1aed47799d56bfed3dd38d7f0ce0d95152852fa4d6

R01: 14 Kandidaten / 6 von 8 Komponenten
Beobachtung: Aufräumungs- auf Seite 5 und 30 fehlte im Aliasvertrag.

R02: 17 Kandidaten / 6 von 8 Komponenten
R03: 17 Kandidaten / 6 von 8 Komponenten
R02-SHA-256 = R03-SHA-256:
5af16ad3ae25f5657a5b21b75207364339365162dc0b39fded0fdf63d928054c

17/17 exakte Originalspans rekonstruiert
17/17 Kontextspans rekonstruiert
17/17 Candidate-IDs eindeutig
```

Pilot-Arbeitsblatt nach R02/R03:

| Requirement | Komponente                  | Kandidaten | physische Seiten |
| ----------- | --------------------------- | ---------: | ---------------- |
| VS-16       | Garage                      |          1 | 3                |
| VS-16       | Tiefgarage                  |          1 | 4                |
| VS-17       | Müllraum                    |          0 | –                |
| VS-17       | Fahrradraum                 |          1 | 4                |
| VS-17       | Kinderwagenraum             |          0 | –                |
| VS-21       | Aufräumkosten               |          8 | 5, 6, 22, 27, 30 |
| VS-21       | Abbruchkosten               |          5 | 5, 6, 18, 27     |
| VS-28       | Mietzinsentgang/Mietverlust |          1 | 5                |

Der Reallauf hat zwei wichtige Systemgrenzen sichtbar gemacht:

1. Der Treffer `Abbruch` auf Seite 18 gehört zur Bauherrenhaftpflicht und ist
   für VS-21 wahrscheinlich Scope-Noise. Das ist korrektes candidate-only
   Verhalten und darf erst durch einen späteren Scope-Binder entschieden werden.
2. Für Müllraum existiert kein kontrollierter Direktalias, obwohl verwandte
   Begriffe wie Müllentsorgungsanlage oder Müllsammelplatz vorkommen. Diese
   dürfen nicht still als Müllraum gelten. Ein späterer semantischer Zusatzpfad
   muss sie getrennt als semantische Kandidaten ausweisen.

Reviewentscheidung: `PASS (PILOT)`. Bewiesen sind kontrollierter lexikalischer
Recall für den eingefrorenen Pilotkatalog, Seiten-/Offsetkorrektheit,
reproduzierbare Vorbereitung und ehrliche offene Komponenten. Nicht bewiesen
sind fachliche Deckung, vollständige Synonymabdeckung, Scope-/Betragsbindung,
WEVIGA, alle 36 VS-Punkte oder eine Verbesserung des LLM-Outputs.

## 18. INC-003B – Change Brief: begrenzte LLM-Kandidatentriage

```text
Increment-ID: INC-003B
Datum: 26. August 2026
Ausgangs-Branch / HEAD: codex/polizzenvergleich-v3 / c2e9cb27

Nutzerproblem:
Das candidate-only Arbeitsblatt zeigt 17 Fundstellen, enthält aber bewusst auch
Scope-Noise. Vor einer Deckungsentscheidung muss geprüft werden, ob ein kleines
LLM diese Kandidaten begrenzt und vollständig triagieren kann.

Beobachtete Baseline:
VS-21 enthält unter anderem einen Abbruch-Treffer aus der
Bauherrenhaftpflicht auf Seite 18 und Aufräumungsarbeiten auf Seite 30. Der
heutige monolithische V3-Pfad macht diese Zwischenentscheidung nicht sichtbar.

Hypothese:
Qwen kann jeden servereigenen Kandidaten genau einmal als DIRECT, NARROW_SCOPE,
MENTION_ONLY oder UNRESOLVED klassifizieren, ohne IDs, Quellen, Seiten oder
Texte zu erzeugen. Ein serverseitiger Validator kann alle Abweichungen
fail-closed zurückweisen.

Genau eine primäre Messvariable:
17 von 17 erlaubten Candidate-IDs werden genau einmal und mit einem erlaubten
Triagewert zurückgegeben; null fremde oder fehlende IDs.

In Scope:
- kompakter LLM-Input für die vier Pilotpunkte und 17 Kandidaten;
- nur Kategorie, Komponente, Candidate-ID und serverseitiger Kontext;
- vier erlaubte Triagewerte;
- strikter Parser/Validator und serverseitige Rekonstruktion;
- lokaler Qwen-4B-Reallauf mit Temperatur 0;
- harte Negativkontrolle für den VS-21-Treffer aus Seite 18.

Out of Scope:
- Deckungswirkung, Betrag, Frist, Konflikt, Rollup und Kundenzeile;
- freie Begründungen, freie Zitate oder modellgenerierte Seiten;
- Retry-Reparaturprompt, produktiver Chatpfad, UI und Kundenrelease;
- WEVIGA und VS-01 bis VS-36.

Betroffene Module und Caller:
Neuer reiner Triagevertrag, fokussierte Tests und separater privater
LM-Studio-QA-Runner. Keine produktiven Caller.

Persistenz-/UI-/Runtime-Auswirkung:
Keine Produktwirkung. Private Nachrichten, Rohantwort, validiertes Ergebnis und
Report werden nur im expliziten Laufordner mit 700/600 geschrieben.

Historische Versuchsevidenz:
Freie Qwen-Zitate waren historisch unzuverlässig. Deshalb darf das Modell nur
vorhandene Candidate-IDs klassifizieren; Texte und Seiten bleiben Serverbesitz.

Bekanntes Fehlermuster, das nicht wiederholt werden darf:
Ein irrelevanter Worttreffer darf nicht durch Modellformulierung zur VS-Evidenz
werden. Fehlende oder zusätzliche IDs dürfen nicht still toleriert werden.

Erwartete Verbesserung:
Die erste Modellentscheidung wird klein, prüfbar und vollständig sichtbar,
bevor Deckungslogik oder Rendering hinzukommen.

Mögliche Regression:
Zu grobe Triagewerte können fachliche Nuancen verlieren. Qwen 4B kann trotz
Schema ungültiges JSON oder plausible, aber fachlich falsche Bindungen liefern.

Rollbackgrenze:
Neue isolierte Module, Tests und QA-Skript; keine Migration.

Fokussierter Reproduktionstest:
Erlaubte IDs vollständig; fremde, doppelte, fehlende und ungültige Werte werden
abgewiesen; Materialisierung übernimmt nur Servertexte.

Angrenzende Regressionstests:
Occurrence-Arbeitsblatt, atomarer Rollup, PageMap, Fachvorlagen und bestehender
Outputvertrag.

Lokaler Realtest:
Byteidentisches LF-Worksheet R02/R03, Qwen 3.5 4B, Temperatur 0.

Kunden-Mac-Studio-Test:
Für den isolierten Pilot noch nicht erforderlich.

PASS-Kriterien:
Formaler Vertrag vollständig grün; Seite-18-Abbruch mindestens nicht DIRECT;
keine modellgenerierten Quellen im materialisierten Ergebnis.

REVISE-Kriterien:
Schemafehler, fehlende/fremde IDs oder harte Negativkontrolle verletzt.

ROLLBACK-Kriterien:
Produktpfad, gespeicherte Dokumente oder bestehende Ausgabe werden verändert.
```

### INC-003B-Resultat

#### Implementierte Grenze

- Qwen erhält ausschließlich vier VS-Requirements, deren atomare Komponenten,
  17 servereigene Candidate-IDs und serverseitig extrahierten Kontext.
- Das Modell darf pro ID nur `DIRECT`, `NARROW_SCOPE`, `MENTION_ONLY` oder
  `UNRESOLVED` zurückgeben. Es darf weder Quellen, Seiten, Zitate, Beträge,
  Deckungswirkungen noch Prüfstatus erzeugen.
- Der Server verlangt jede bekannte ID genau einmal, lehnt fremde, doppelte,
  fehlende oder erweiterte Einträge ab und rekonstruiert Seite, Text und
  Originaloffset ausschließlich aus dem Worksheet.
- Genau ein äußerer Markdown-JSON-Codeblock wird als Transporthülle
  deterministisch entfernt. Zusatztext, mehrere Blöcke und jeder innere
  Vertragsfehler bleiben fail-closed.
- Der V3-Produkt-, Chat-, UI- und Persistenzpfad wurde nicht verdrahtet.

Das INC-003-Worksheet wurde vor der Modelltriage um einen separaten
`scopeLead` ergänzt. Der kleinste Kontextspan bleibt unverändert; zusätzlich
darf Qwen bis zu 120 Wörter rückwärts lesen, um eine übergeordnete
Versicherungs- oder Spartenzuordnung zu erkennen. Die Candidate-IDs blieben
unverändert. Das neue private Worksheet R04 besitzt den SHA-256
`c6fda6ba09a8fe47055b434a0cb8859e4e06c2e5d8630735bd1cf02d7238a763`.

#### Lokale Realtests auf der LF-IMMO-PDF

Alle Läufe verwendeten Qwen 3.5 4B über LM Studio, Temperatur 0, keinen Seed
und dieselben 17 Candidate-IDs. Der tatsächlich geladene LM-Studio-Kontext war
77.312 Tokens; das im Runner deklarierte Limit von 32.768 Tokens wurde nicht
über den normalen Kompressionspfad erzwungen.

| Lauf | Inputzustand                         | Formal | Kontrollen | Beobachtung                                                    |
| ---- | ------------------------------------ | -----: | ---------: | -------------------------------------------------------------- |
| R01  | kleinster Kontext, eine Kontrolle    |  17/17 |        0/1 | Haftpflicht-Abbruch `NARROW_SCOPE`; Fahrradraum `MENTION_ONLY` |
| R02  | zusätzlicher `scopeLead`, zwei Gates |  17/17 |        2/2 | beide bekannten Fehler korrigiert                              |
| R03  | identisch zu R02                     |   0/17 |        0/0 | gleiche Semantik, aber als Markdown-JSON-Codeblock abgewiesen  |
| R04  | Transportnormalisierung              |  17/17 |        2/2 | kanonisch 0/17 Abweichungen zu R02/R03                         |
| R05  | Koordinationsregel, drei Gates       |  17/17 |        2/3 | koordinierter `Abbruch` weiterhin fälschlich `MENTION_ONLY`    |

Die R03-Rohantwort wurde nach Einführung der engen
Transportnormalisierung ohne neuen Modellaufruf revalidiert. Danach waren
17/17 IDs gültig, beide damaligen Kontrollen grün und alle 17 Bindings exakt
identisch zu R02. R02, R03 und R04 besitzen denselben kanonischen
Triage-SHA-256
`66c53a6f1d211a4357c3fe65aefa807e83d41fcf3d92620da688c26b912398c1`.
Damit war die Semantik in diesen drei Läufen stabil, das Rohformat jedoch nicht.

Die anschließende manuelle Kontextprüfung fand einen bis dahin nicht
abgesicherten fachlichen Fehler auf physischer Seite 27. In derselben Klausel
„Kosten für Aufräumung, Abbruch und Isolierung … sind … mitversichert“ erhielt
`Aufräumung` stabil `NARROW_SCOPE`, `Abbruch` aber stabil `MENTION_ONLY`.
Eine dritte Golden-Control reproduziert diesen Fehler. Die allgemeine
Promptregel, dass der gemeinsame Kostenbezug für alle koordinierten Glieder
gilt, änderte R05 an keiner der 17 Entscheidungen und beseitigte den Fehler
nicht. Prompttext allein ist für diese Fehlerklasse damit erneut kein
hinreichender Fix.

Laufzeit und Tokens:

```text
R01: 4.554 Prompt + 1.416 Completion; 46,249 Sekunden
R02: 8.757 Prompt + 1.410 Completion; 49,177 Sekunden
R03: 8.757 Prompt + 1.415 Completion; 33,931 Sekunden
R04: 8.757 Prompt + 1.415 Completion; 34,435 Sekunden
R05: 8.800 Prompt + 1.160 Completion; 43,343 Sekunden
```

Der zusätzliche `scopeLead` vergrößerte den Prompt erheblich. Die gemessenen
Einzelläufe reichen wegen fehlendem Seed und schwankender Generierungsrate
nicht für eine belastbare Laufzeitaussage. Sie zeigen nur, dass der
Vier-Punkte-Pilot lokal weiterhin unter einer Minute blieb.

#### Verifikation und Entscheidung

```text
Triagevertrag: 1 Suite / 11 Tests bestanden
Fokussiert plus angrenzend: 8 Suites / 65 Tests bestanden
Prettier: PASS
git diff --check: PASS
Private Laufordner: 700; private Dateien: 600
Produktive Caller: 0
Kundenrelease: keiner
```

Aktuelle Modul-/Vertragshashes:

```text
Triagevertrag: 8efa3b5ef5cf783523ced1ae8d1aee30b4e9f8b405905eaeefeecf8bd3322ee1
Occurrence-Modul: 7221b9f974638aeda4678128632f38df216118e245c358eb506a2ec83c697447
Triage-Systemprompt: 5a7d401cd97012a02a7bf65862fa6691a172304eacf574460baee9501b6b4982
Golden-Controls: 9d0b226da55a8cbc9e0832c0dd2e4bd11938fc96427358b2441a441a228a92ac
QA-Runner: 85dad15434904bcf9c1fa69132cb2183ba5a813886ba1351b83453f3039631ba
R05-Report: 6c91862bf8a1dc099e4a4fc3328e196d7adcea73aaf4b5263337768f6fc226ec
```

Reviewentscheidung: `REVISE`. Bewiesen sind die begrenzte Candidate-ID-
Schnittstelle, servereigene Quellenmaterialisierung, fail-closed Validierung,
enge Transportnormalisierung und stabile Reproduktion zweier bekannter
Scopefälle. Nicht bestanden ist die neue koordinierte Komponenten-Kontrolle.
Dieser Befund darf nicht durch weitere Promptverlängerung oder eine
automatische Nachkorrektur verdeckt werden.

Es gibt weiterhin keine sichtbare Verbesserung im Kundenprodukt. WEVIGA,
alle 36 VS-Punkte, Deckungswirkung, Betragsbindung und Kunden-Mac-Studio sind
nicht getestet.

## 19. INC-003C – Change Brief: serverattestierte Bindungsgruppen

```text
Increment-ID: INC-003C
Datum: 26. August 2026
Ausgangs-Branch / HEAD: codex/polizzenvergleich-v3 / c2e9cb27

Nutzerproblem:
Qwen klassifiziert in derselben Klausel „Kosten für Aufräumung, Abbruch und
Isolierung“ Aufräumung als NARROW_SCOPE, Abbruch aber als MENTION_ONLY. Eine
allgemeine Promptregel änderte keine der 17 Entscheidungen.

Beobachtete Baseline:
INC-003B R05 liefert 17/17 formal gültige Candidate-IDs, aber nur 2/3
fachliche Golden-Controls. Der koordinierte Abbruch auf physischer Seite 27
bleibt reproduzierbar falsch gebunden.

Hypothese:
Eine katalogseitig erlaubte und serverseitig konservativ erkannte
SHARED_GOVERNOR-Gruppe kann Qwen sichtbar mitteilen und anschließend
fail-closed prüfen, dass grammatisch gleichrangige Kandidaten dieselbe
Kandidatenbindung besitzen müssen.

Genau eine primäre Messvariable:
Drei von drei fachlichen Golden-Controls bestehen in mindestens zwei frischen
Realläufen; alle 17 Kandidatenbindungen sind zwischen diesen Läufen identisch.

In Scope:
- optionale Binding-Structure-Deklaration im VS-Pilotkatalog;
- Gruppenbildung nur bei demselben Requirement, derselben Seite, demselben
  Strukturkontext, demselben expliziten Governor und kontrollierter
  Aufzählungssyntax;
- stabile servereigene Binding-Group-ID und Candidate-Mitgliedschaft;
- Gruppe im begrenzten Qwen-Payload;
- fail-closed Ablehnung unterschiedlicher Bindings innerhalb einer Gruppe;
- synthetische Positiv- und Übergruppierungs-Gegenkontrollen;
- mindestens zwei frische LF-IMMO-Qwen-4B-Läufe.

Out of Scope:
- automatische Nachkorrektur eines Modellwertes;
- Ableitung von Deckung, Betrag, Frist, Konflikt oder Kundenzeile;
- produktiver Caller, UI, Persistenz, WEVIGA, VS-01 bis VS-36 und Kundenrelease.

Betroffene Module und Caller:
Pilotkatalog, reines Occurrence-/Strukturmodul, reiner Triagevertrag,
Systemprompt, fokussierte Tests und privater QA-Runner. Keine produktiven Caller.

Persistenz-/UI-/Runtime-Auswirkung:
Keine Produktwirkung. Nur private QA-Artefakte im expliziten Laufordner.

Historische Versuchsevidenz:
R05 falsifiziert Prompt-only. Frühere Rollenbinder zeigten, dass plausible
Modellzuordnungen ohne serverseitige Struktur- und Rollenregeln nicht genügen.

Bekanntes Fehlermuster, das nicht wiederholt werden darf:
Der Server darf nicht still MENTION_ONLY in NARROW_SCOPE umschreiben. Eine
gemeinsame Bindungsgruppe darf keine gemeinsame Deckungswirkung behaupten.

Erwartete Verbesserung:
Das Modell erhält eine kleine, belegte Strukturrelation und kann nicht mehr
unbemerkt zwei gleichrangige Glieder derselben Kostenphrase unterschiedlich
triagieren.

Mögliche Regression:
Übergruppierung könnte getrennte Klauseln, kontrastierende Prädikate oder
gliedspezifische Bedingungen fälschlich koppeln.

Rollbackgrenze:
Neue optionale Katalog-/Worksheet-/Triagefelder und isolierte Tests/Runner;
keine Migration und keine Produktverdrahtung.

Fokussierter Reproduktionstest:
„Kosten für Aufräumung und Abbruch“ erzeugt eine Gruppe; getrennte Sätze,
Listenpunkte und kontrastierende Prädikate erzeugen keine Gruppe.

Angrenzende Regressionstests:
Occurrence-Suche, Triagevertrag, atomarer Rollup, PageMap, Splitter,
Fachvorlagen und bestehender Outputvertrag.

Lokaler Realtest:
Autoritative 31-seitige LF-IMMO-PDF, Worksheet neu erzeugen, zwei frische
Qwen-4B-Läufe mit identischen Hashes und drei Golden-Controls vergleichen.

Kunden-Mac-Studio-Test:
Für den weiterhin isolierten Pilot noch nicht erforderlich.

PASS-Kriterien:
Zwei frische Läufe mit 17/17 IDs, 3/3 Controls und identischen 17 Bindings;
keine Modellquelle, keine Übergruppierung, alle Regressionen grün.

REVISE-Kriterien:
Gruppenbildung ist zu breit/zu eng, Modell verletzt die Gruppe oder ein
fachliches Gate bleibt rot.

ROLLBACK-Kriterien:
Produktpfad, Dokumentpersistenz oder bestehende Ausgabe werden verändert.
```

### Ergebnis INC-003C

Die servereigene `SHARED_GOVERNOR`-Gruppe wurde isoliert umgesetzt und gegen
Übergruppierung getestet. Der Katalog erlaubt sie nur für VS-21, dieselbe
Klausel, denselben Governor und dieselbe kontrollierte Aufzählung. Zwei
Vorkommen auf den physischen Seiten 6 und 27 wurden gruppiert; der
Haftpflicht-Treffer auf Seite 18 blieb ausdrücklich ungruppiert.

Die Modellintegration erreichte allein noch keinen stabilen PASS:

```text
R01: doppelte Zielrepräsentation; formal REVISE
R02: ein Ziel ausgelassen; formal REVISE
R03: eine lange ID beschädigt; formal REVISE
R04: 17/17 formal, 1/3 Controls
R05: 17/17 formal, 1/3 Controls
Entscheidung INC-003C allein: REVISE
```

Das positive Teilergebnis ist die nachgewiesene Strukturgruppe. Der offene
Fehler war nicht mehr die Gruppenbildung, sondern die Vermischung von
Faktrolle und Scope im Modellurteil. Deshalb wurde kein produktiver Caller
verdrahtet und INC-003D gestartet.

## 20. INC-003D – Change Brief: Rollen- und Scopeachse trennen

```text
Increment-ID: INC-003D
Datum: 26. August 2026
Ausgangs-Branch / HEAD: codex/polizzenvergleich-v3 / c2e9cb27

Nutzerproblem:
Der kombinierte Triagewert vermischt Faktrollenpassung und Scopeweite. Im
Einzelziellauf wird deshalb die Haftpflicht-Abbruchtätigkeit als engerer
Abbruchkostenfall und eine echte enge Abbruchkostenklausel als bloße Erwähnung
klassifiziert.

Baseline:
INC-003C R05: 15/15 Ziele und 17/17 Kandidaten formal, aber 1/3 fachliche
Controls. Die serverattestierte Koordinationsgruppe funktioniert technisch.

Hypothese und primäre Messvariable:
Qwen entscheidet getrennt roleMatch und scopeMatch; der Server leitet den
Legacy-Bindingwert deterministisch ab. Zwei frische Läufe erreichen jeweils
17/17 Kandidaten, 3/3 Controls und identische Entscheidungen.

In Scope:
- katalogseitige Faktrollen für den VS-Pilot;
- getrennte Enumachsen MATCH/MISMATCH/UNRESOLVED und
  GENERAL/NARROW/OTHER_SCOPE/UNRESOLVED;
- deterministische, getestete Ableitung auf DIRECT/NARROW_SCOPE/
  MENTION_ONLY/UNRESOLVED;
- weiterhin ein kleines Ziel pro Modellcall und serverseitige Aggregation.

Out of Scope:
Deckungswirkung, Betrag, Konflikt, Quellenformulierung, Produktcaller, UI,
WEVIGA, VS-36 und Kundenrelease.

Hauptrisiko:
Das Modell kann auch die getrennten Achsen semantisch verwechseln. Der Server
darf daraus keine Deckung ableiten und muss ungültige Kombinationen ablehnen.

PASS:
Zwei frische LF-Läufe mit 3/3 Controls, identischen 17 Bindings, allen
Regressionen grün und ohne modellgenerierte IDs oder Quellen.
```

### Ergebnis INC-003D

`roleMatch` und `scopeMatch` sind nun orthogonale Achsen. Der Server leitet
daraus ausschließlich den Kandidatenbindungswert ab; Deckung, Betrag,
Konflikt und Kundenzeile bleiben außerhalb dieses Inkrements. Für die
VS-21-Kostenrollen gelten konservative Regeln:

- Eine nachgewiesene gemeinsame Kosten-Governor-Struktur oder ein explizites
  Kostenwort belegt nur die Faktrolle `COST`.
- Fehlt dieser Rollenbeleg, bleibt der Kandidat serverseitig `UNRESOLVED`.
- Katalogseitig deklarierte, im selben Strukturkontext gefundene Sonderfall-
  Aliase belegen nur `scopeMatch: NARROW`.
- Alle nicht serverseitig belegten Achsen bleiben Modellentscheidungen; ein
  ungültiges oder zusätzliches Modellfeld beendet den Lauf fail-closed.

Der Verlauf war bewusst nicht glattgebügelt:

```text
R01: 17/17 formal, 1/3 Controls – Modell verwechselt Rolle und Scope weiter
R02: 17/17 formal, 3/3 Controls – erster PASS
R03: 17/17 formal, 2/3 Controls – Spezialmüll schwankt DIRECT/NARROW_SCOPE
R04: fail-closed – Modell liefert ein nicht angefordertes Zusatzfeld
R05: 17/17 formal, 3/3 Controls – PASS
R06: 17/17 formal, 3/3 Controls – PASS
```

R05 und R06 verwendeten unverändert dasselbe neu aus der autoritativen
31-seitigen LF-IMMO-PDF erzeugte Worksheet und dieselben Verträge:

```text
PDF-SHA256: 2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62
Worksheet-SHA256: e583e0cae4cf2d3b375c96d75dd7c639a392ca481a13b779b8f6b2e6aa97838e
Triagevertrag-SHA256: 2d02e757e0aa8b61d4bafd9677df40b2190eef7695e2e8eab4f5019720d7fbe2
Occurrence-Modul-SHA256: 7b645e3ea95738fafce4a17b2e1c8b3e0c9b4679efc3160c403a4456cbe1ff02
Pilotkatalog-SHA256: 32b2dcef749820610fe4ec699c4863fa8c1fcae0a77ebdc7abb11d27370f0822
Systemprompt-SHA256: 88839028e15b3aea90111f5fca05b25ba40176ba1e1b90cfe62a4b49d6805f51
Controls-SHA256: 1c6744a63b83b5e1a5ecfcc1d2c2af76f59447e8a4dd311ae907a923184fe667
QA-Runner-SHA256: d2d2d0f3f65d3382dbe6f3857e9684e4a66cdd703a92e4667904400950899a64
Validierte R05/R06-SHA256: 8d39c1269e02f7709e046aa83d466a605f5bca4de42e32efa96cf5f76ba8b947
R05-Report-SHA256: 71ddd7ab175c397e4b93156fba9525afa9f4253e9fede3fea5911a0025cc6b75
R06-Report-SHA256: 08acc575dd5281ff024e6e3cbeb28c3ceb8c613693c40f4d3e2f9e499bb7607e
```

Beide Läufe erzeugten 15 Ziele für 17 Kandidaten. Elf Ziele wurden
fail-closed oder positiv serverseitig terminiert; nur vier isolierte Ziele
gingen an Qwen 4B. Die validierten 17 Bindings sind bytegenau identisch.
Die drei Controls liefern in beiden Läufen:

```text
Haftpflicht-Abbruch, Seite 18: UNRESOLVED (kein falsches COST-Direktbinding)
Sondermüll-Abbruchkosten, Seite 27: NARROW_SCOPE
radioaktiver Abbruch, Seite 27: NARROW_SCOPE
```

Verifikation:

```text
Fokussiert: 2 Suites / 36 Tests bestanden
Fokussiert plus angrenzend: 8 Suites / 81 Tests bestanden
Prettier: PASS
git diff --check: PASS
Private Laufordner: 700; private Dateien: 600
Produktive Caller: 0
Kundenrelease: keiner
```

Reviewentscheidung: `PASS` für den isolierten LF-IMMO-VS-Kandidatenpilot.
Das ist ausdrücklich kein PASS für VS-01 bis VS-36, WEVIGA, Deckungswirkung,
Betragsbindung, Excel-Ausgabe oder das Kundenprodukt. Das Scope-Alias-Gate ist
deterministisch, aber nur innerhalb des serverseitig gewählten
Strukturkontexts; seine Aliasabdeckung und Überbindungsrate müssen vor einer
Ausweitung mit einem größeren Oracle gemessen werden.

## 21. Unmittelbar nächster kontrollierter Schritt

1. Den erreichten Pilot-PASS nicht direkt in den Produktpfad übernehmen.
2. Als eigenes nächstes Inkrement ein kleines, prüferbestätigtes VS-Oracle mit
   positiven und negativen Scope-Alias-Gegenfällen definieren.
3. Erst danach denselben Candidate-Preparation-Pfad auf einen begrenzten
   WEVIGA-VS-Ausschnitt anwenden und LF gegen WEVIGA vergleichen.
4. Bei stabiler Candidate-Bindung als separates Inkrement die Betrags- und
   Limitrolle prüfen; erst anschließend ist ein VS-Kundenzeilen-Rollup zulässig.
5. Ein Kunden-Mac-Studio-A/B erfolgt erst mit einem expliziten Releasekandidaten
   und identischen PDF-, Katalog-, Modell- und Prompt-Hashes.

## 22. INC-003E - Change Brief: Scope-Oracle und begrenzter WEVIG-Vergleich

```text
Increment-ID: INC-003E
Datum: 27. August 2026
Ausgangs-Branch / HEAD: codex/polizzenvergleich-v3 / c2e9cb27

Nutzerproblem:
Der LF-Pilot ist auf drei Controls positiv, beweist aber weder ausreichende
positive/negative Scope-Abdeckung noch die Übertragbarkeit auf WEVIG.

Autoritative Quellen:
LF: 31 Seiten, SHA256 2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62
WEVIG: 21 Seiten, SHA256 a476cc2e0d970c0143e552bd7d901d82abd89324ba4cf316bc7ee3202a8b0b16

Unveränderte WEVIG-Baseline:
13 Kandidaten, aber nur 1/8 Komponenten. Gefunden wurde nur demolition_costs.
Die PDF enthält zusätzlich die kontrollierbaren Varianten „Aufräum- und
Abbruchkosten“ sowie „Entgang von Mietzinseinnahmen“. Fehlende Treffer waren
daher Aliaslücken, keine belegten Inhaltslücken.

Zusätzlicher Baselinefehler:
In langen Fallback-Kontexten markierte ein späteres „radioaktiv“ eine frühere
allgemeine Abbruchkostenstelle als NARROW. Der Scope-Alias war nur an den
gesamten Kontext, nicht an den Satz der Occurrence gebunden.

Hypothese:
Scope-Aliase müssen auf den occurrence-genauen Satz begrenzt werden.
Katalogdeklarierte, identische Mehrkomponenten-Spans dürfen Aufräum- und
Abbruchkosten als gemeinsame Kandidatenbindung tragen, ohne Deckung oder
Beträge abzuleiten.

In Scope:
- Satzgebundenes Scope-Alias-Gate mit Überbindungs-Gegenkontrolle;
- katalogdeklarierter SHARED_SPAN für exakte zusammengesetzte Kostenphrasen;
- zwei belegte WEVIG-Aliasvarianten;
- kleiner WEVIG-Control-Draft mit Sparten-Positivfällen und zwei
  Haftpflicht-Negativfällen;
- isolierte LF-/WEVIG-Worksheets und Qwen-4B-Läufe.

Out of Scope:
Prüferfreigabe vortäuschen, Coverage-/Betragsrollup, VS-36, Produktcaller,
UI, Excel, Kundenrelease.

PASS-Kriterien:
- allgemeine Abbruchkosten werden durch ein späteres Sonderwort nicht narrow;
- WEVIG erreicht kontrollierte Kandidaten für cleanup_costs, demolition_costs
  und rent_loss, ohne Garage/Räume aus Oberbegriffen zu erfinden;
- alle neun WEVIG-Draft-Controls in zwei unveränderten Läufen stabil;
- LF-Golden-Controls und angrenzende Regressionen bleiben grün.

REVIEW_REQUIRED:
Die fachliche Einstufung der spartenbezogenen WEVIG-Fälle als NARROW_SCOPE
muss vor Produktfreigabe vom Prüfer bestätigt werden. Ein technischer PASS
ersetzt diese Bestätigung nicht.
```

### Ergebnis INC-003E

Der begrenzte Vergleich ist technisch positiv. Der unveränderte WEVIG-
Ausgangspunkt fand 13 Kandidaten und nur `demolition_costs` (1/8
Pilotkomponenten). Nach der kataloggebundenen Erweiterung entstanden 22
Kandidaten für `cleanup_costs`, `demolition_costs` und `rent_loss` (3/8),
darunter sechs `SHARED_SPAN`-Gruppen. Für Garagen oder Räume wurden keine
unbelegten Oberbegriffe ergänzt.

Dabei wurde ein systemischer Fehler vor der Ausweitung behoben: Scope-Aliase
werden nur noch im occurrence-genauen Satz ausgewertet. Ein späteres
`radioaktiv` im selben langen Fallback-Kontext kann daher eine frühere
allgemeine Abbruchkostenstelle nicht mehr als engen Sonderfall markieren.
Zusätzlich verwendet die Modelltriage nun ein einheitliches Schema mit
`roleMatch` und `scopeMatch`. Serverseitig belegte Achsen müssen exakt
zurückgegeben werden; ein Modellwiderspruch beendet den Lauf fail-closed.

Der reale Laufverlauf bleibt vollständig sichtbar:

```text
WEVIG R01: REVISE – Qwen lieferte im alten dynamischen Schema ein Zusatzfeld
WEVIG R02: ABGEBROCHEN – erste Modellantwort hing; LM-Studio-Umgebungsfehler
WEVIG R03: technischer PASS – 22/22 Kandidaten, 9/9 Draft-Controls
WEVIG R04: technischer PASS – 22/22 Kandidaten, 9/9 Draft-Controls
WEVIG R05: TECHNICAL_PASS_REVIEW_REQUIRED – 22/22, 9/9
LF R01:    PASS – 17/17 Kandidaten, 3/3 bestehende Controls
```

R03 und R04 erzeugten bytegenau dieselben 22 validierten Bindings. Die neun
WEVIG-Controls bestehen aus sieben spartenbezogenen Kosten-/Mietverlustfällen
und zwei Haftpflicht-Negativkontrollen. Ihre Datei trägt ausdrücklich
`reviewStatus: REVIEW_REQUIRED`. Die beiden bereits erzeugten Reports zeigen
noch `PASS`, weil die Runner-Ausgabe für diesen Reviewstatus erst anschließend
präzisiert wurde. R05 bestätigt den neuen Status
`TECHNICAL_PASS_REVIEW_REQUIRED` im echten Lauf. Die historischen Reports
werden nicht nachträglich verändert. R03, R04 und R05 enthalten bytegenau
dieselben validierten Bindings.

```text
WEVIG-PDF-SHA256: a476cc2e0d970c0143e552bd7d901d82abd89324ba4cf316bc7ee3202a8b0b16
WEVIG-Worksheet-SHA256: 050c3ae9a9c61b6ece65e4b336703b34caad7f8af9d70de61a0fad6625d73fdc
LF-Worksheet-SHA256: d4f9fa134359aecb93721f2f8f5702bcffe690795ad2442f4ee81b3fe5ab30f1
Triagevertrag-SHA256: 344c7f59318dc32405d1c10a53d5d3034149ae419c3dff84a8e3af4323b771e8
Occurrence-Modul-SHA256: 9d9c71d5b361849b6b8c075dbd457e195fa2e16c5aa1cf92bbac999326559d72
Pilotkatalog-SHA256: c86443c02b89a1c3b9dbd14d93df1823c1f0273c9ae117a38d738a1beb5a23a9
Systemprompt-SHA256: 154cb54212239b39946e7870cb817c47cf69591232393dcf3ae30995324f4274
WEVIG-Draft-Controls-SHA256: 0d62def42c70d66b552a712975c8abaeecda855a750758860b39fa5a50193929
QA-Runner-SHA256: 0a6779833bd764efc328a4fd7af43718de14460ecd7d56f4cfd2905937192215
Oracle-Draft-SHA256: 9c92211f93cbc8777eb735ea0640d4eb5d01fd7e1726623270d89fe31b317928
WEVIG R03/R04/R05 validiert-SHA256: e39fee4eeade7787621f2189bb7b76889f8a94aa065a6de986289c6b9e30c2c3
LF R01 validiert-SHA256: ba88f7841c981be3d097efd8ed979648c96c0ee67e74d02eb4ea5942b843c5a0
WEVIG R03-Report-SHA256: 8023944e799a58acc28c2f649f7aa9e042593a3d75f7fa4c02f68a8f0d40f1f6
WEVIG R04-Report-SHA256: 454b8edb04286b20854ca23c38b80d406aa96e13c64c9145f54aa0f97659d4a3
WEVIG R05-Report-SHA256: 21180261ff14174a3aecef57b07d566a5f9f16479d81c9c9a986ddc1cf241676
LF R01-Report-SHA256: 929ae5940a312ab83d1d2579cd1fb0cb68009e2ce2a60af3d42ab020c9e8360d
```

Verifikation:

```text
Finale angrenzende Regression: 8 Suites / 79 Tests bestanden
Prettier: PASS
Node-Syntax: PASS
git diff --check: PASS
Private Laufordner: 700; private Dateien: 600
Produktive Caller: 0
Kundenrelease: keiner
```

Die Laufzeit ist noch kein PASS-Kriterium: R03 und R04 schwankten bereits
stark; R05 meldet bei identischen 18.600 Tokens nochmals eine auffällige
interne Modelldauer. Diese Metrik wird nicht als fachlicher Fehler gewertet,
aber vor einem Kundenrelease separat gegen das Laufzeitbudget geprüft.

Reviewentscheidung: `PASS` für den isolierten technischen Oracle-Draft und
den begrenzten LF-/WEVIG-Kandidatenvergleich. `REVIEW_REQUIRED` bleibt für die
fachliche Scope-Freigabe und jede Produktübernahme. Die zwölf zu bestätigenden
Fälle stehen in `docs/VS_SCOPE_ROLLEN_ORACLE_DRAFT_DE.md`. Zwei bekannte
Implementierungslücken bleiben bewusst offen: rechtsköpfige Kostenkoordination
bei LF (OR-03) und beim radioaktiven WEVIG-Fall (OR-09). Beide bleiben
`UNRESOLVED`; es wird keine Deckung daraus abgeleitet.

## 23. INC-003F - Change Brief: Koordination und VS-/EL-/FE-Prompt-A/B

```text
Increment-ID: INC-003F
Datum: 27. August 2026
Ausgangs-Branch / HEAD: codex/polizzenvergleich-v3 / c2e9cb27

Nutzerziel:
Die offenen Koordinationsfälle nicht isoliert belassen, sondern auf LF und
WEVIG mehrere echte Beispiele in VS, EL und Feuer prüfen. Die fertigen
Kategorieprompts müssen als unveränderte Baseline erhalten bleiben; getrennte
angepasste Prompts sollen den Nutzen occurrence-genauer Vorbereitung messen.

Originalprompt-Lock:
VS: 0ff41d99eaa30eb516af5c60f536a39f381ce7184a46bbed4ce69525e47f466a
EL: d5b1c465f20836d6d3069aaba89b1d5d22d3eaeed1649a92638c7e1d3b304628
FE: f2bf41109b04e9d907ed7a9af82c1c4270b653718e2f168beb9c5f6132039637

Beobachtete Baselinehürde:
Der generische Kategorievalidator liest derzeit nur IDs im Muster EL-01.
FE-A01 bis FE-F10 werden nicht erkannt. Das muss vor einem belastbaren
Feuer-Baselinelauf mit einem fokussierten Test korrigiert werden.

In Scope:
- OR-03/OR-09 und synthetische Koordinations-Gegenfälle;
- mehrere belegte und negative Fälle je VS, EL und FE auf beiden PDFs;
- Originalprompt-/globaler Kontext als Baseline;
- getrennte angepasste Prompts mit serverseitig enumerierten Evidenzspans;
- mindestens zwei Wiederholungen kritischer angepasster Pfade;
- formale, evidenzielle und fachliche Draft-Controls.

Out of Scope:
Originalprompts überschreiben, Produktcaller, UI/Excel, Kundenrelease,
juristische Vollgarantie und automatische Freigabe ungeprüfter Domainwerte.

PASS:
Die Koordinationsfehler sind fail-closed oder korrekt gruppiert; die
angepasste Vorbereitung verbessert messbar Quellenbindung/Komponentenabdeckung
ohne neue False Positives; Wiederholungsläufe sind stabil; bestehende LF- und
WEVIG-Regressionen bleiben grün.
```

### Ergebnis INC-003F

Der lokale A/B-Vergleich ist für den isolierten technischen Pilot positiv.
Die unveränderten fertigen VS-, EL- und FE-Prompts blieben bytegleich; alle
sechs Vollprompt-Gegenläufe auf LF und WEVIG endeten `REVISE`. Die finalen
angepassten Läufe erreichten dagegen:

```text
VS LF:      17/17 Kandidaten, 5/5 Controls; zweimal grün
VS WEVIG:   28/28 Kandidaten, 13/13 Controls; zweimal grün
EL LF:      12/12 Komponenten, 11/11 Controls; zweimal grün
EL WEVIG:   12/12 Komponenten, 11/11 Controls; zweimal grün
FE LF:      9/9 Komponenten, 9/9 Controls; zweimal grün
FE WEVIG:   9/9 Komponenten, 9/9 Controls; zweimal grün
```

Wesentliche erreichte Invarianten:

- rechtsköpfige Kostenkoordination ist nur katalogdeklariert zulässig;
- occurrence-genauer Fokus verhindert Scope-Überfärbung durch Nachbarklauseln;
- physische PDF-Seite und sichtbare Seitenbezeichnung bleiben getrennt;
- EL-16 rollt zu `COMPLETE + MIXED + NONE`, nicht zu Widerspruch;
- Objektfund und verlangte Schadenart sind getrennte Komponenten;
- eindeutiger Haftpflicht- und enger Sondermüll-Scope wird fail-closed und
  auditierbar aus der generischen Deckungsentscheidung gehalten;
- Modellquellen und unbekannte Candidate-IDs sind nicht zulässig;
- WEVIG wird als `PROPOSED_ONLY` geführt;
- FE-IDs mit Buchstabengruppe werden vom QA-Vertrag erkannt.

Finale Regression:

```text
6 Suites / 87 Tests bestanden
Prettier: PASS
Baseline: 6/6 REVISE
Angepasste finale Paare: 6/6 technisch positiv
Produktive Caller: 0
Kundenrelease: keiner
```

Die vollständige Laufmatrix, konkrete Fehlervorher-/nachher-Beispiele,
Report-Hashes und Grenzen stehen in
`docs/VS_EL_FE_PROMPT_AB_VERGLEICH_DE.md`.

Reviewentscheidung:

```text
PASS: isolierter technischer Pilot und lokale A/B-Evidenz
REVIEW_REQUIRED: Fachoracle, Aliasabdeckung und WEVIG-Dokumentstatus
NO_RELEASE: keine Produktintegration, kein Kunden-Mac-Studio-Gegenlauf
```

## 24. INC-004 - Vollkategorie-Baseline und finaler Pilotgegenlauf

```text
Increment-ID: INC-004
Datum: 27. August 2026
Branch / HEAD: codex/polizzenvergleich-v3 / c2e9cb27

Ziel:
LF und WEVIG über alle acht Kundenkategorien als aktuelle Baseline laufen
lassen, die occurrence-genaue Vorbereitung auf alle 320 sichtbaren IDs
erweitern und den wirklich kontrollierten VS-/EL-/FE-Pfad aus demselben
Code-/Promptstand wiederholen.

Harte Grenze:
Ein Vollkatalog ohne flächendeckendes Oracle, Wertbindung und Produktcaller
darf nicht als fachlich evaluiert oder releasefähig bezeichnet werden.
```

### Ergebnis

- Originalprompt-Baseline: 16/16 terminal, 636/640 Zeilen, 15 `REVISE`.
- VB/LF war der einzige formale PASS, aber 36/36 Zeilen waren `UNGEKLÄRT`.
- Baseline: 3.490,299 Sekunden Modellzeit und 77:29 Minuten Wandzeit.
- Finale Full-Draft-Worksheets: 16/16, 320/320 IDs, 533 atomare
  Komponenten, exakte Prompt-ID-/Reihenfolge-/Label-Parität.
- Aktueller VS-/EL-/FE-Gegenlauf: 6/6
  `TECHNICAL_PASS_REVIEW_REQUIRED`, 60/60 Kontrollen, 4:25 Minuten Wandzeit.
- EL/LF: EL-16 = `COMPLETE + MIXED + NONE`; EL-08 und EL-19 =
  `PARTIAL + NOT_DETERMINABLE`.
- Fokussierte Endregression: 7 Suites / 104 Tests bestanden.

Neu gehärtete Gates:

- leere, doppelte, unbekannte oder unvollständig abgedeckte Prepared-Controls
  scheitern fail-closed;
- leere, doppelte oder unvollständige VS-Triage-Controls scheitern
  fail-closed;
- nur `APPROVED` darf einen echten PASS erzeugen;
- angeforderte Werte/Felder werden bis zu ihrer Implementierung ausdrücklich
  `NOT_EVALUATED`, nie still als geprüft markiert;
- alle acht Full-Draft-Kataloge werden persistent gegen die ausgelieferten
  Prompts auf ID, Reihenfolge und sichtbares Label geprüft.

Reviewentscheidung:

```text
POSITIVE: occurrence-genaue Vorbereitung und 17 kontrollierte Pilot-IDs
REVISE: vollständige 320-ID-Semantik, Werte/Relationen und Produktintegration
NO_RELEASE: kein Kunden-Mac-Lauf und keine unabhängigen Holdouts
```

Die vollständige Matrix und Beweisgrenze stehen in
`docs/VOLLKATEGORIE_AB_VERGLEICH_INC004_DE.md`.

## 25. INC-005 - VS-Pilot-Renderer und Kunden-Hardware-RC

```text
Increment-ID: INC-005
Datum: 27. August 2026
Branch / Ausgangs-HEAD: codex/polizzenvergleich-v3 / c2e9cb27

Ziel:
Den occurrence-genauen VS-Pilot für vier vorab eingefrorene Kategorien auf
LF und WEVIG bis zur gleichen achtspaltigen Kundentabelle führen, lokal gegen
ein Oracle stabilisieren und als diagnostischen RC für Qwen 3.8 27B auf dem
Kunden-Mac bereitstellen.

Scope:
VS-16, VS-17, VS-21 und VS-28 × LF/WEVIG = 8 Dokument-/Zeilenzellen.

Harte Grenze:
GO für Kunden-A/B bedeutet nicht Produkt-PASS für VS-36 oder alle acht
Kategorien. Fehlende Evidenz bleibt offen; WEVIG bleibt PROPOSED_ONLY.
```

### Implementierung

Der Pilotpfad ist jetzt als expliziter QA-Vertical-Slice ausführbar:

1. vollständige occurrence-genaue Kandidatensuche auf der V3-PageMap;
2. begrenzte Kandidatentriage;
3. begrenzte Komponentenwirkung mit bekannten Candidate-IDs;
4. serverseitige Bindung von `VS-21.limit` und `VS-28.duration`;
5. deterministischer Renderer im bestehenden Acht-Spalten-Vertrag;
6. PDF-/Dokumentstatus-/Oracle-Gates und semantischer Wiederholungsvergleich;
7. ein A/B-Befehl für denselben Modell- und Hardwarezustand.

Im ersten realen Gegenlauf wählte Qwen 4B bei WEVIG nur allgemeine
Definitionen und ließ positive spartenspezifische Positionen aus. Die Lösung
ist kein freies Promptversprechen: Nach einem `INCLUDED`-Modellurteil vereinigt
der Server ausschließlich triagierte `NARROW_SCOPE`-Kandidaten mit explizitem
Positivmarker. Negativ- und Unklarheitskontrollen verhindern die automatische
Übernahme von Ausschlüssen. Der gezielte Lauf verbesserte sich dadurch von
5/8 auf 8/8 Wirkungskontrollen.

### Lokales Ergebnis

```text
Modell: qwen3.5-4b-mlx
Wiederholungen: 2
Dokumentläufe: 4/4 PASS
Oracle: 16/16 Zeilen PASS
Triage: LF 5/5, WEVIG 13/13 je Lauf
Wirkung: LF 8/8, WEVIG 8/8 je Lauf
Tabellenvertrag: 4/4 PASS
Stabilität: LF und WEVIG PASS, semantische Snapshots je Dokument identisch
```

Der abschließende Current-Tree-Lauf `R11` bestand den Pilotpfad zweimal mit
4/4 Dokumentläufen und 16/16 Oracle-Zeilen. Der vollständige A/B-Smoke `R12`
ergab auf beiden Dokumenten einen messbaren Vorteil:

```text
LF:    Legacy A 0/4, Pilot B 4/4 Oracle-Zeilen
WEVIG: Legacy A 0/4, Pilot B 4/4 Oracle-Zeilen
A/B-Gate: PASS, positiveEffectObserved = true
```

Das A/B-Gesamttor verlangt nun zusätzlich exakte Completion- und
Embedding-Modell-IDs, ein nach dem Lauf exakt geladenes LM-Studio-Modell, die
finale servergerenderte Zeile einschließlich Inhalt/Wert/Seite/Candidate-ID
sowie einen echten Oracle-Vorteil von B gegenüber A. Candidate- und
Quellenmengen werden geschlossen verglichen; zusätzliche Quellen sind damit
ebenso ein Fehler wie fehlende. Die WEVIG-Dauer für `VS-28` wird nur noch aus
den Mietzinspositionen auf den physischen Seiten 1, 2 und 4 gebunden, nicht aus
dem davorstehenden Ersatzunterkunftsabschnitt auf Seite 9. Private
Laufartefakte landen standardmäßig unter dem lokalen
macOS-Application-Support-Pfad und nicht in `Documents`.

Release-Gates des finalen Arbeitsstands:

```text
Jest: 76 Suites / 790 Tests PASS
Server-Lint: PASS
Frontend-Produktionsbuild: PASS
macOS-Installer-Test: PASS
git diff --check / Shell-Syntax: PASS
```

Der sichtbare Pilot unterscheidet nun korrekt zwischen belegter Deckung,
Teilbeleg und fehlender Evidenz. Limits und Dauer stammen ausschließlich aus
servergebundenen Kandidaten. WEVIG-Zeilen tragen sichtbar den Vorschlagsstatus.

Releaseentscheidung:

```text
PASS: lokaler 4B-Vertical-Slice und eingefrorenes 8-Zellen-Oracle
GO: diagnostischer Kunden-Hardware-RC v3.2.2-rc.1
REVIEW_REQUIRED: Qwen-3.8-27B-A/B auf Kunden-Mac
NO PRODUCT PASS: VS-36, übrige Kategorien, Holdouts und Mehrdokumentpakete
```

Bedienung, erwartete Tabellenwerte und Beweisgrenzen stehen in
`docs/RELEASE_V3.2.2_RC1_DE.md`.

## 26. INC-005A – Korrektur des 27B-Kundenbefunds

Der Kundenlauf widerlegte die lokale RC1-Annahme: LF und WEVIG erreichten in
beiden Wiederholungen jeweils nur `2/4`. Die Fehler lagen nicht ausschließlich
am Modell, sondern auch an deterministischer Nachverarbeitung, Scope-Erkennung,
Oracle- und A/B-Logik.

Nach den Korrekturen gilt lokal:

```text
Echter 27B-Artefakt-Replay: LF 4/4, WEVIG 4/4
Realer WEVIG-Worksheet: 7/7 kritische Vorschlagspositionen mit exaktem Scope
Policy-Analyse: 10 Suites / 157 Tests PASS
Gesamtregression: 77 Suites / 816 Tests PASS
```

Entscheidung:

```text
PASS: deterministische lokale Korrektur und Kundenartefakt-Replay
GO: v3.3.0-rc.1 für den beaufsichtigten Kunden-A/B-Test
REVIEW_REQUIRED: neuer Live-Lauf mit Qwen 3.8 27B auf Kundenhardware
```

Vollständiger Befund:
`docs/VS_PILOT_27B_KUNDENBEFUND_FIX_VALIDIERUNG_DE.md`.

## 27. INC-006 – Vollständiger qualitativer VS-01-bis-VS-36-Vergleich

Der vollständige lokale A/B-Lauf gegen LF und WEVIG ist abgeschlossen. Der
V3.3-Evidenzweg besteht das 8-Zellen-Pilot-Oracle, erreicht über alle 72
fachlich geprüften Dokument-Kategorie-Zellen aber noch keinen Gesamtvorteil:

```text
BESSER:      31
SCHLECHTER:  31
GLEICH:       4
UNKLAR:       6
```

Entscheidung:

```text
PASS: vollständige technische VS-01-bis-VS-36-Verarbeitung
PASS: manueller PDF-Qualitätsvergleich für 72 Zellen
NO-GO: aktueller Stand als qualitativer V3.3-Vollrelease
NO-GO: 27B-Kundenlauf vor Behebung der bekannten Recall-Regressionen
```

Vollständiger Befund und priorisierte Korrekturfamilien:
`docs/VS_01_36_QUALITAETSVERGLEICH_V321_V33_DE.md`.

## 28. INC-007 – VS-07 bis VS-11 als klauselsichere Korrekturfamilie

```text
Increment-ID: INC-007
Datum: 28. August 2026
Scope: VS-07, VS-08, VS-09, VS-10 und VS-11 × LF/WEVIG
Ausgangsbefund: 9× SCHLECHTER, 1× GLEICH gegenüber V3.2.1
```

### Ableitung aus den bisherigen Erfahrungen

Die Korrektur folgt ausdrücklich den bereits dokumentierten Befunden und ist
kein neuer freier Retrievalversuch:

- Beide benötigten Vertragsklauseln waren in den Kundenartefakten bereits auf
  LF-Seite 31 beziehungsweise WEVIG-Seite 8 vorhanden. Die PDF-Erfassung und
  ein global höheres Top-N waren daher nicht die Ursache.
- Frühere große Kontextblöcke führten zu falscher Rollenbindung zwischen
  benachbarten Beträgen und Bedingungen. Deshalb werden Werte und Wirkungen
  nur über rollenbezogene, explizite Phrasen gebunden.
- Frühere Qwen-Triage war formal instabil und unnötig teuer. Eindeutige
  Fundstellen werden daher vom Server entschieden; nur unbekannte
  Formulierungen bleiben modelloffen.
- Die Klausel reicht von einer kontrolliert erkannten Überschrift bis zur
  nächsten Überschrift auf derselben physischen Seite. Vierstellige
  Adresszeilen können wegen der auf ein- bis dreistellige Nummern begrenzten
  Überschriftenregel nicht erneut als Klauselüberschrift fehlklassifiziert
  werden.

### Kleine Implementierung

1. Fehlende direkte Anker für die Unterversicherungs- und
   Wertanpassungsklauseln wurden im VS-Katalog ergänzt.
2. VS-07 bis VS-11 verwenden den vollständigen Klauselabschnitt statt eines
   pauschalen Seiten- oder Wortfensters.
3. Bedingung, Voraussetzungen und Indexart werden als exakte,
   quellgebundene Textfakten extrahiert.
4. Allgemeine Erwähnungen von `Baukostenindex` gelten bei VS-11 nicht als
   Beleg der Indexart. Nur eine explizit benannte Indexart wird direkt
   gebunden.
5. Identische Klausel- beziehungsweise Indexwertbelege werden für die
   Entscheidung minimiert; unterschiedliche Indexarten bleiben erhalten.
6. Der Tabellenrenderer wiederholt bei vorhandenen Feldbelegen nicht noch
   einmal denselben allgemeinen Kandidatenausschnitt.

### Reale LF-/WEVIG-Ergebnisse

```text
LF:
  VS-07 Unterversicherungsverzicht: Ja / BELEGT
  VS-08 bedingt: vollständig / BELEGT
  VS-09 Gutachten + Summengleichheit + ca. 3 Jahre: vollständig / BELEGT
  VS-10 automatische Indexanpassung: Ja / BELEGT
  VS-11 Baukostenindex Wohnungs- und Siedlungsbau: vollständig / BELEGT

WEVIG:
  VS-07 Unterversicherungsverzicht: Ja / BELEGT
  VS-08 bedingt: vollständig / BELEGT
  VS-09 Bedingungen a–c plus Mehrfachversicherungsbegrenzung: vollständig / BELEGT
  VS-10 jährliche automatische Wertanpassung: Ja / BELEGT
  VS-11 BKI 2020 plus Baukostenindex (Baumeisterarbeiten): vollständig / BELEGT
```

Vorher benötigte dieser Fünferblock lokal insgesamt 36 Qwen-Entscheidungen:

```text
LF:    7 Triage + 5 Wirkung
WEVIG: 19 Triage + 5 Wirkung
```

Nach der Korrektur sind beide Dokumente für diesen Block vollständig
serverterminal:

```text
LF:    0 Modellaufrufe, 7/7 Triagekontrollen, 5/5 Wirkungskontrollen
WEVIG: 0 Modellaufrufe, 19/19 Triagekontrollen, 5/5 Wirkungskontrollen
Jest: 6 fokussierte Suites / 129 Tests PASS
```

Qualitatives Urteil gegenüber den vorhandenen V3.2.1-Ausgaben:

```text
LF:    5× GLEICH, 0× SCHLECHTER
WEVIG: 2× BESSER, 3× GLEICH, 0× SCHLECHTER
Gewinne: VS-09 Mehrfachversicherungsbegrenzung und VS-11 vollständige Indexart
```

Entscheidung:

```text
POSITIVE: VS-07 bis VS-11 als abgegrenzte Korrekturfamilie
KEEP: klauselsichere Kandidaten- und deterministische Rollenbindung
REVIEW_REQUIRED: vollständiger VS-01-bis-VS-36-Regressionslauf
NO_RELEASE: übrige bekannte Recall- und Feldfamilien sind noch offen
```

## 29. INC-008 – VS-01/VS-02 ohne erneute Wert- und Klauselverwechslung

```text
Increment-ID: INC-008
Datum: 28. August 2026
Scope: VS-01 und VS-02 × LF/WEVIG
Zu behebende Verluste: LF VS-02 und WEVIG VS-01
Zu erhaltender Gewinn: WEVIG VS-02 darf nicht erneut als Indexklausel fehlgedeutet werden
```

### Historisch begründete Grenze

Der alte WEVIG-Lauf hatte die Baukostenindex-Wertanpassung fälschlich als
Zeitwertklausel ausgegeben. Das aktuelle `UNGEKLÄRT` für WEVIG VS-02 ist daher
korrekt und wurde nicht durch breitere Stichwörter aufgeweicht. Behoben wurden
nur zwei belegte Verluste:

- LF-Seite 26 enthält die Zeitwertentschädigung nach ausbleibender
  Wiederherstellung/Wiederbeschaffung innerhalb von drei Jahren und die
  Zeitwertuntergrenze von 30 %.
- WEVIG enthält `Wohngebäude zum NeuwertEUR30.608.000,00`; der fehlende
  Zwischenraum zwischen kontrolliertem Begriff und EUR-Wert führte zuvor zur
  Ablehnung durch die Wortgrenzenlogik.

### Implementierung und verworfene Variante

- Ein PDF-konkatenierter `EUR`-Wert wird nur dann als kontrollierte
  Begriffgrenze akzeptiert, wenn unmittelbar `EUR` plus Zahl folgt. Normale
  Wortsuffixe bleiben ausgeschlossen.
- PDF-Aufzählungen wie `-Wohngebäude` werden auch ohne extrahierten Leerraum
  als Listenpunkt erkannt. Dadurch bleibt die Wertebindung im kleinen
  Listeneintrag statt in einem ganzen Seitenrest.
- VS-01 besitzt ein optionales Betragsfeld: Ein fehlender Betrag macht die
  LF-Neuwertklausel nicht unvollständig, ein unmittelbar anschließender
  WEVIG-EUR-Wert wird aber ausgegeben.
- VS-02 bindet die 3-Jahres-Regel und die 30-%-Schwelle als zwei getrennte,
  quellgebundene Bedingungen.
- Verworfen wurde ein allgemeiner Limit-Extractor für VS-01. Er band im ersten
  Realtest fälschlich `30 % Zeitwert` beziehungsweise `33 % gewerbliche
Nutzung` als Deckungssumme. Die endgültige Regel erlaubt für VS-01 nur den
  unmittelbar anschließenden EUR-Betrag; ein Negativtest schützt diese Grenze.

### Reales Ergebnis

```text
LF VS-01: Ja / BELEGT / kein erfundener Betrag
LF VS-02: Ja / BELEGT / 3 Jahre + Zeitwert mindestens 30 %
WEVIG VS-01: Ja / BELEGT / lokal gebundener Neuwertbetrag / PROPOSED_ONLY
WEVIG VS-02: UNGEKLÄRT / keine Zeitwertklausel belegt

LF:    7/7 Triage, 3/3 Komponenten, 0 Modellaufrufe
WEVIG: 4/4 Triage, 3/3 Komponenten, 0 Modellaufrufe
Jest: 6 fokussierte Suites / 137 Tests PASS
```

Qualitatives Urteil gegenüber V3.2.1:

```text
LF VS-01: BESSER bleibt erhalten
LF VS-02: SCHLECHTER -> GLEICH
WEVIG VS-01: SCHLECHTER -> GLEICH
WEVIG VS-02: BESSER bleibt erhalten, weil die alte Falschaussage ausbleibt
```

Entscheidung:

```text
POSITIVE: zweite abgegrenzte Korrekturfamilie
KEEP: EUR-Grenze, kompakte PDF-Listenpunkte, rollenlokales optionales Betragsfeld
REVIEW_REQUIRED: vollständige Regression und weitere INC-006-Familien
NO_RELEASE: noch bekannte schlechtere VS-Zellen offen
```

## 30. INC-009 – vollständiger positiver VS-01-bis-VS-36-Gegenlauf

```text
Increment-ID: INC-009
Datum: 28. August 2026
Scope: VS-01 bis VS-36 × LF/WEVIG
Baseline: INC-006-VS-FULL-QUALITY-AB-LOCAL-4B-R01
Abschlusslauf: INC-009-VS-FULL-QUALITY-AB-LOCAL-4B-R07
Modell: qwen3.5-4b-mlx
```

### Umgesetzte Problemfamilien

Nach INC-007 und INC-008 wurden die verbleibenden Verluste nicht mit globalem
Top-N oder allgemeinem Prompt-Tuning korrigiert. Die Servervorbereitung wurde
gezielt erweitert:

- kontrollierte Aliase und Klauselabschnitte für VS-13 bis VS-36;
- explizite Rollenbindungen für Innenausbau, Sonderausstattung, Außenanlagen,
  Spielplatz, Kosten, Mietzinsentgang, Unterkunft, Vorsorge,
  Gemeinschaftsvermögen und Ereignishöchstentschädigung;
- `ANY` nur bei echten Alternativen, während alle beobachteten Komponenten im
  Ergebnis sichtbar bleiben;
- enger Sparten- oder Gefahrenscope wird nicht auf die allgemeine Kategorie
  übertragen;
- Beträge, Prozentsätze, Dauer und Berechnungsgrundlagen werden nur lokal an
  die passende Rolle gebunden;
- die bloße Nennung einer `Pauschalversicherungssumme`, eines
  Schaden-Sachverständigengutachtens oder eines Haftpflichtlimits beantwortet
  VS-04 nicht;
- ein Jahresaggregat beantwortet VS-36 nicht als Höchstentschädigung pro
  Ereignis;
- vollständige Condition-/Definition-Zeilen werden als formal zulässiges
  `BELEGT + Ja` gerendert.

### Vollständiger Realbefund

```text
LF:    36/36 Zeilen, 64/64 Komponenten, 64/64 Kontrollen, Tabellenvertrag PASS
WEVIG: 36/36 Zeilen, 64/64 Komponenten, 64/64 Kontrollen, Tabellenvertrag PASS

Qualität gegenüber V3.2.1:
LF:    27 BESSER, 8 GLEICH, 1 UNKLAR, 0 SCHLECHTER
WEVIG: 30 BESSER, 5 GLEICH, 1 UNKLAR, 0 SCHLECHTER
Gesamt: 57 BESSER, 13 GLEICH, 2 UNKLAR, 0 SCHLECHTER
```

Besonders relevante bestätigte Ergebnisse:

```text
LF VS-19:  Wege + Beleuchtung + Bepflanzung, enger Scope sichtbar
LF VS-22:  Entsorgung + Sondermüll, unterschiedliche Limits rollenlokal
LF VS-31:  Ersatzunterkunft, Betrag und Leistungsdauer lokal gebunden
LF VS-36:  Ereignishöchstentschädigung lokal gebunden
WEVIG VS-25: behördliche Mehrkosten mit lokalem Limit
WEVIG VS-29: Mietzinsentgang mit Betrag und Berechnungsgrundlage
WEVIG VS-31: Ersatzunterkunft mit Betrag und Leistungsdauer
WEVIG VS-36: UNGEKLÄRT; Jahreshöchstbetrag nicht als Ereignislimit umgedeutet
```

### Entscheidung und Grenze

```text
PASS: lokaler qualitativer Architekturvergleich gegenüber V3.2.1
GO: Release Candidate für den kontrollierten Qwen-3.8-27B-Kundenvergleich
REVIEW_REQUIRED: absolutes fachlich freigegebenes 72-Zellen-Oracle
REVIEW_REQUIRED: Verhaltensbestätigung auf dem Kunden-Mac-Studio
NO CLAIM: hundertprozentige fachliche Vollständigkeit
```

Der vollständige Befund und die 72-Zellen-Matrix stehen in
`docs/VS_01_36_QUALITAETSVERGLEICH_V321_V33_DE.md`. Die privaten Laufartefakte
liegen bewusst außerhalb des Repositories im lokalen QA-Archiv.

## 31. INC-010 – RC4 nach dem vollständigen Qwen-3.8-27B-Kundenlauf

```text
Increment-ID: INC-010
Datum: 28. August 2026
Scope: die vier im RC3-Kundenlauf nachgewiesenen Verlust-/Integrationszellen
Quelle: VS-FULL-QUALITY-27B-RC3.zip
Zielrelease: v3.3.0-rc.4
```

### Befund aus RC3

Der echte Kundenlauf war technisch vollständig und benötigte für beide
Dokumente ungefähr 41 Minuten aktive Modellzeit. Gegenüber V3.2.1 ergab die
erste Bewertung 55 bessere, zwölf gleiche, zwei unklare und drei schlechtere
Zellen. Die Ursachen lagen nicht in fehlender PDF-Erfassung:

- Pilotregeln für VS-16, VS-21 und VS-28 waren nicht in den Full-Katalog
  übernommen worden.
- VS-15 modellierte eine allgemeine Nebengebäudefundstelle fälschlich als
  Beweis einer namentlichen Anführung.
- Der sichere WEVIG-Teilbeleg für VS-15 ging einschließlich seines Betrags
  verloren.
- Die vorhandene LF-Wiederherstellungsklausel für VS-35 wurde nicht in Dauer
  und Bedingungen materialisiert.
- Der kandidatengenaue Pilot-Oracle setzte Alias-IDs des kleinen
  Pilotkatalogs fälschlich auch für den größeren Full-Katalog voraus.

### Kleine, ursachengebundene Implementierung

1. Die Pilot-Scope-Regeln werden vollständig in die entsprechenden
   Full-Katalogdefinitionen übernommen und durch einen Gleichheitstest gegen
   erneutes Auseinanderlaufen geschützt.
2. VS-15 besitzt getrennte Komponenten für allgemeine
   Nebengebäudedeckung und namentliche Anführung. Nur eine ausdrückliche
   Formulierung kann die zweite Komponente belegen.
3. Lokal gebundene Teilbeträge bleiben im dokumentierten Inhalt sichtbar,
   werden aber nicht als Deckungssumme einer unbelegten Gesamtanforderung
   ausgegeben.
4. VS-35 extrahiert ausschließlich aus der kontrollierten
   Wiederherstellungsklausel die Dreijahresfrist, Zeitwertfolge und
   Deckungsprozessverlängerung.
5. Der Full-Katalog-Oracle erlaubt Alias-ID-Drift, prüft jedoch weiterhin
   Semantik, physische Seiten, Werte, Quellen und verbotene Kandidaten. Der
   kleine Pilotlauf bleibt kandidatengenau streng.

### Nachspieltest der echten 27B-Artefakte

```text
LF:    36 Anforderungen, 65 Komponenten, 122 Kandidaten, Oracle 4/4 PASS
WEVIG: 36 Anforderungen, 65 Komponenten, 155 Kandidaten, Oracle 4/4 PASS

LF VS-15:    TEILBELEGT, 5 % sichtbar, keine falsche namentliche Anführung
WEVIG VS-15: TEILBELEGT, EUR 1.530.400,00 sichtbar, keine falsche Benennung
LF VS-16:    Ja / BELEGT
LF VS-21:    Ja / BELEGT / 10 %, 15 %
LF VS-35:    Ja / BELEGT / 3 Jahre + Bedingungen
WEVIG VS-21: Ja / BELEGT / EUR 6.121.600,00
```

Aktualisierte Bewertung gegenüber V3.2.1:

```text
59 BESSER, 12 GLEICH, 1 UNKLAR, 0 SCHLECHTER
```

Release-Gates:

```text
PASS: 80 Jest-Suites / 876 Tests
PASS: Lint, Syntax, Git-Diff-Prüfung und Produktionsbuild
PASS: deterministischer Replay mit echten 27B-Entscheidungen
GO: v3.3.0-rc.4 für den frischen kontrollierten Kundenlauf
REVIEW_REQUIRED: frische Qwen-3.8-27B-Ausführung beider PDFs
NO CLAIM: finale fachliche Freigabe von v3.3.0
```

## 32. LF-Gesamtbaseline – acht monolithische Kategorieprompts mit 27B

```text
Datum: 28. August 2026
Lauf: LF-ALL-CATEGORIES-27B-RC4-20260828-180411
Dokument: LF IMMO
Ansichten: VS, FE, LW, ST, EL, HP, VB, WE
Umfang: 320 sichtbare Zeilen
```

Der Lauf ist vollständig, testet aber nicht den neuen Evidenzweg über alle
Kategorien. Er ruft den monolithischen `pdfProvenanceLiveRun.cjs` achtmal auf.
RC4 bezeichnet lediglich den installierten Codezustand.

```text
320/320 Zeilen erzeugt
124/320 Zeilen formal sauber
196/320 Zeilen mit mindestens einer Vertragsabweichung
101 nicht seitengetreue Zitate
115 unzulässige Missing-Formulierungen
8 weitere Status-, Deckungs- oder Quellenfehler
2:06:58 Stunden Wandzeit
292.732 verarbeitete Tokens
```

Die vollständige PDF-Erfassung, alle 31 Seiten und alle 38 Chunks waren bei
jeder Ansicht vorhanden. Die Fehler entstehen überwiegend bei monolithischer
Schlussfolgerung und Ausgabe: enger Scope wird übertragen, bedingte Klauseln
werden als aktiv behandelt, getrennte Rollen und Beträge werden verbunden und
mehrteilige Kategorien verlieren Einzelwirkungen.

Entscheidung:

```text
PASS: eingefrorene vollständige LF-27B-Baseline
NO-GO: monolithischer Weg als Produkt-Gesamtlauf
NO-GO: weiterer identischer Großlauf vor einem echten All-Kategorien-Runner
```

Vollständiger Befund:
`docs/LF_ALL_CATEGORIES_27B_MONOLITHISCHER_BEFUND_DE.md`.

## 33. INC-011 – ST-Scope-Vertikalschnitt und gemeinsamer Acht-Kategorien-Pfad

```text
Increment-ID: INC-011
Datum: 28. August 2026
Scope: allgemeine Rollen-, Scope- und Wertebindung; ST als erster neuer Slice
Ziel: ein wiederverwendbarer Evidenzpfad für VS, FE, LW, ST, EL, HP, VB, WE
```

### Implementierung

- Die PDF wird mit `extractPolicyDocument.cjs` einmalig als privates,
  seitengetreues Dokumentartefakt vorbereitet.
- `buildCategoryOccurrenceWorksheet.cjs` erzeugt daraus beliebig viele
  Kategoriensichten, ohne die PDF erneut zu extrahieren.
- `deterministicCategoryEvidenceRules.js` trennt allgemeine Regel, enge
  Ausnahme, Faktrolle und Kategorieabschnitt. Die bewährten VS-Sonderregeln
  bleiben unverändert eingebunden.
- Eine allgemeine eindeutige Regel bleibt für eine breite Zielkomponente
  maßgeblich; engere Ausnahmen werden separat erhalten und nicht zu einem
  Widerspruch oder allgemeinen Ausschluss hochgezogen.
- Eine bloße Objekt- oder Begriffsfundstelle ohne lokal gebundenen Betrag,
  Prozentsatz oder Limitbegriff kann keine `LIMIT`-Komponente belegen.
- Nummerierte und fortgeführte Überschriften für FE, LW, ST, EL, HP, VB und WE
  werden als Scopehinweise weitergegeben. Eine andere Überschrift ist ein
  Hinweis, aber ohne weiteren Rollenbeweis kein automatischer Ausschluss.
- Generische, quellengebundene Extraktoren materialisieren Beträge,
  Selbstbehalte, Dauer, Intervall, Schwellenwerte, Datum, Jahresanzahl und
  textuelle Bedingungen. Die validierten VS-Spezialextraktoren bleiben
  stabil.
- `run-all-categories-quality.command` führt alle acht Ansichten auf demselben
  Dokumentartefakt aus und erzeugt 320 Tabellenzeilen plus Gesamtbericht.

### Reale ST-Gegenprobe

Die vorhandenen seitengetreuen Extraktionen der echten LF- und
WEVIG-Kundenläufe wurden wiederverwendet; Vertragsinhalte wurden nicht als
Anweisungen interpretiert.

```text
LF ST vorher:     9/53 Komponenten, 13 Kandidaten
LF ST nachher:   16/53 Komponenten, 28 Kandidaten
WEVIG ST vorher:  5/53 Komponenten,  7 Kandidaten
WEVIG ST nachher: 6/53 Komponenten, 13 Kandidaten
```

Kritischer LF-Teiltest (`ST-01`, `ST-04`, `ST-06`, `ST-11`, `ST-27`):

```text
8/8 atomare Komponenten formal vollständig
0 Triage-Modellaufrufe
0 Wirkungs-Modellaufrufe
ST-04 Dach + Fassade: INCLUDED / GENERAL
ST-06 Dach + Tragkonstruktion: INCLUDED / GENERAL
ST-11 eigenes Sublimit: UNKNOWN statt falschem EXCLUDED
ST-27 Lawine + Schnee-/Eisrutsch: beide INCLUDED, getrennte Scopes sichtbar
```

Damit sind die falschen alten LF-Urteile `ST-04 Nein`, `ST-06 Nein` und
`ST-11 Nein` ursachengebunden korrigiert. Der WEVIG-Gegenfall erfasst außerdem
die anders formulierten Komponenten „optische Hagelschäden“ und
„Photovoltaikanlagen auf Grund eines Sturmschadens“. Nicht belegte verbundene
Teile bleiben `UNKNOWN`.

### Entscheidung und Grenze

```text
PASS: ST-Scope-Hypothese auf LF, WEVIG und synthetischen Gegenfällen
PASS: gemeinsamer technischer Pfad für alle acht Ansichten
PASS: einmalige PDF-Vorbereitung im neuen Vollrunner
PASS: 73 Jest-Suites / 793 Tests, Lint, Syntax und Diff-Prüfung
REVIEW_REQUIRED: frischer vollständiger Qwen-3.8-27B-Lauf auf Zielhardware
REVIEW_REQUIRED: fachliche Oracles für FE, LW, ST, EL, HP, VB und WE
NO CLAIM: 99 Prozent oder allgemeine fachliche Vollständigkeit
```

## 34. INC-012 – RC5-Gesamtbefund und Recall-/Scope-Härtung für RC6

```text
Increment-ID: INC-012
Datum: 29. August 2026
Quelle: ALL-CATEGORIES-QUALITY.zip, echter LF-Qwen-3.8-27B-Kundenlauf
Zielrelease: v3.3.0-rc.6
```

### Fachlicher Befund zu RC5

RC5 erzeugte technisch alle 320 Zeilen, war fachlich aber kein Release-PASS.
Die technische Kontrolle hatte nur Format, IDs und Quellenintegrität geprüft;
sie war kein vollständiges Fach-Oracle.

```text
320/320 Zeilen technisch erzeugt
38 BELEGT
29 TEILBELEGT
253 UNGEKLÄRT
264 kontrollierte Kandidaten
137 ausgewählte Quellen
```

Die Ursachen waren nicht eine unvollständige PDF-Erfassung, sondern zu wenig
Recall in den sieben neuen Katalogen, verlorene Kapitel- und
Ausschluss-Governors an Seitenwechseln, zu enge Satzzeichen-Aliase sowie
fehlende generische Euro- und reine Limitmaterialisierung. Beispiele:

- `FE-A13`, `FE-D01`, `LW-05` und `LW-12` waren im Dokument ausdrücklich
  vorhanden, blieben aber unbekannt.
- `EL-16` verband Wintergarten und Vitrinen zu einer falschen gemeinsamen
  Wirkung, obwohl der Wintergarten eingeschlossen und die Vitrine
  ausgeschlossen ist.
- `HP-34` und `HP-35` erhielten sachfremde Haftpflichtfundstellen.
- Die Ausschlussüberschrift zu `HP-26` stand auf Seite 20, die fortgesetzte
  Aufzählung auf Seite 21. Ohne Seitenwechsel-Governor wurde der Ausschluss
  als Einschluss interpretiert.
- Rahmenbedingungen waren in der Tabelle nicht sichtbar als solche markiert.

Entscheidung:

```text
NO-GO: RC5 als fachlich freizugebendes Produktrelease
PASS: RC5 als reale Fehlerbaseline und Ursachenbeweis
```

### Kleine, ursachengebundene Implementierung

1. FE, LW, ST, EL, HP, VB und WE erhielten konservative, atomare Suchaliase
   für die im echten LF-Lauf sicher fehlenden Vertragsformulierungen. Unklare
   Teilaspekte bleiben ausdrücklich unbekannt.
2. Suche normalisiert harmlose Satzzeichen- und PDF-Trennungsvarianten, ohne
   die servereigenen Originaloffsets oder Zitate zu verlieren.
3. `7. Glasbruch`, `B. ALLGEMEINER TEIL` und der Ökoschutz-Übergang bilden
   korrekte Scopegrenzen.
4. Ein expliziter positiver oder negativer Deckungs-Governor wird genau auf
   die unmittelbar folgende PDF-Seite weitergegeben. Eine neue
   Kapitelüberschrift oder die übernächste Seite beendet die Vererbung.
5. `EL-16` besitzt eine enge serverautoritäre Regel für die beiden getrennten
   Glasobjekte. Unterschiedliche Objektwirkungen sind kein Widerspruch.
6. `HP-16` erkennt den Regressverzicht samt Mieterbedingung; `weder ... noch`
   wird nicht mehr als Ausschluss des Mieters umgedeutet.
7. Beträge mit `EUR` und `€` werden quellengebunden normalisiert. Vollständige
   reine LIMIT-, DEDUCTIBLE- und DOCUMENT_STATUS-Zeilen können als belegt
   ausgegeben werden.
8. Ergebnisse aus `FRAMEWORK_TERMS` werden im dokumentierten Inhalt sichtbar
   als Rahmenbedingung bezeichnet und nicht als aktive Polizze ausgegeben.

### Lokaler Full-Run als Vorfilter

Ein vollständiger LF-Lauf über alle acht Ansichten wurde lokal mit
`qwen3.5-4b-mlx` durchgeführt. Das kleinere Modell ist kein Ersatz für den
Kunden-27B-Lauf, belegt aber die komplette technische Verarbeitung und dient
als schneller qualitativer Vorfilter.

```text
320/320 Zeilen
75 BELEGT
59 TEILBELEGT
186 UNGEKLÄRT
381 kontrollierte Kandidaten
290 ausgewählte Quellen
```

Sicher korrigierte Beispiele im lokalen Lauf beziehungsweise im
anschließenden deterministischen Replay:

```text
FE-A06: BELEGT, Limit indirekter Blitzschlag geregelt
FE-A13: BELEGT, Luftfahrzeug + Teile + Ladung eingeschlossen
FE-D01: BELEGT, Feuerwehr-/Einsatzkosten und Höhe geregelt
LW-05:  BELEGT, Rohrbruch und Rohr selbst eingeschlossen
LW-12:  BELEGT, Fußbodenheizung eingeschlossen
LW-26:  BELEGT, C-/D-Deckung bleibt trotz vorheriger Grunddeckungsausnahme positiv
ST-18/19/21/29/34: BELEGT
EL-16:  Wintergarten eingeschlossen; Vitrinen ausgeschlossen; kein Widerspruch
HP-16:  BELEGT + Ja, Regressverzicht gegenüber Mietern
HP-26:  BELEGT + Nein, Mietsachschäden in der fortgesetzten Ausschlussliste
HP-34/35: sachfremde RC5-Fundstellen entfernt und wieder UNGEKLÄRT
VB-05/06/17/22/36: BELEGT
WE-07/13/14: BELEGT
```

### Validierung und Freigabegrenze

```text
PASS: 88 Jest-Suites / 933 Tests
PASS: Katalog-Recall-Replays gegen das echte RC5-Dokumentartefakt
PASS: Lint, Formatierung und Git-Diff-Prüfung
PASS: lokaler 320-Zeilen-Qwen-4B-Vorfilter
GO: frischer vollständiger Qwen-3.8-27B-Lauf auf dem Kunden-Mac-Studio
REVIEW_REQUIRED: fachlicher Vergleich der neuen 320 Zeilen mit RC5/RC4
REVIEW_REQUIRED: vollständige Fachoracles für alle Dokument-/Kategoriepaare
NO CLAIM: 99 Prozent oder finale V3.3.0-Freigabe
```

## 42. RC11-27B-Befund und RC12-VS-Scopeabschluss

Der frische vollständige WEVIG-RC11-Lauf war technisch vollständig:

```text
320/320 Zeilen
369 kontrollierte Kandidaten
224 ausgewählte Quellen
31 BELEGT / 24 TEILBELEGT / 265 UNGEKLÄRT
qwen/qwen3.8-27b
PROPOSAL
```

FE, LW, ST, HP, VB und WE blieben gegenüber dem positiven RC10-Befund
byte-identisch. Die vier RC11-EL-Zeilen verhielten sich exakt wie vorgesehen:
`EL-10` wurde vollständig belegt, `EL-21`, `EL-27` und `EL-34` erhielten nur
die jeweils atomar vorhandenen Teilbelege. `EL-04` blieb mit EUR 20.000,00
belegt; `EL-16` blieb ohne falschen Widerspruch offen.

`VS-21` enthielt nach RC11 wieder beide echten Kostenwirkungen und den
richtigen Betrag, blieb aber ebenso wie `VS-28` formal `TEILBELEGT`, weil der
Renderer einen ausschließlich katalogisierten engen Sachspartenscope ohne
Zeilenfreigabe nicht als vollständig anerkennt. Für genau diese beiden
spartenübergreifenden Leistungszeilen gilt nun
`MATCHING_SCOPE_INCLUDED_SUFFICIENT`. Die zugelassenen ScopeKeys waren bereits
vorhanden; RC12 öffnet keine neue Sparte und verändert weder Kandidatensuche
noch Modellentscheidung.

Die deterministische Re-Materialisierung des vollständigen frischen
RC11-27B-Artefakts ergibt:

```text
VS-21: BELEGT / Ja / EUR 6.121.600,00 auf Erstes Risiko
VS-28: BELEGT / Ja / Dauer 6 Monate
alle übrigen VS-Zeilen unverändert
```

RC12 ist deshalb ein reiner Katalog-/Rendererabschluss. Der WEVIG-Beweis kann
gegen das frische RC11-Modellartefakt wiederholt werden; der nächste große
Modell-Gesamtlauf wird als LF-Regressionsgate verwendet.

```text
PASS: 89 Jest-Suites / 977 Tests
PASS: Server-, Frontend- und Collector-Lint
PASS: exakte RC11-WEVIG-Re-Materialisierung für VS-21 und VS-28
NEXT: RC12 deployen, remote re-materialisieren und LF vollständig regressieren
```

## 41. RC10-27B-Befund und RC11-Nachschärfung

Der frische vollständige WEVIG-RC10-Lauf war technisch vollständig:

```text
320/320 Zeilen
369 kontrollierte Kandidaten
190 ausgewählte Quellen
29 BELEGT / 22 TEILBELEGT / 269 UNGEKLÄRT
qwen/qwen3.8-27b
PROPOSAL
```

Die mit RC10 adressierten Fremdspartenfehler wurden im echten Modelllauf
beseitigt: `FE-A10` ist nur noch ein enger Teilbeleg, `LW-20` und `ST-16`
sind offen, `ST-21` ist enger Teilbeleg, `EL-04` enthält das Limit von
EUR 20.000,00, `HP-05`, `HP-13` und `HP-21` sind offen und die vier falschen
WE-Sachspartenbelege wurden entfernt. Echte Haftpflicht- und
Leitungswasserbelege blieben erhalten; `FE-D01`, `HP-25` und `VB-02` wurden
vollständiger ausgewertet.

Der Vollvergleich zeigte zwei begrenzte Nachschärfungen:

1. Bei `VS-21` wurden zwei Haftpflichtklauseln mit dem Wort `Abbruch` als
   allgemeiner Kostenausschluss ausgewählt, obwohl zwölf echte
   Aufräum-/Abbruchkostenquellen vorhanden waren. Ein eindeutiger
   Haftpflicht-Abschnitt ist für diese beiden VS-Kostenkomponenten nun
   `MENTION_ONLY`.
2. EL umfasst laut Produkttaxonomie auch Zusatzdeckungen. Deshalb sind die
   aktivierten Sachsparten-Scopes für `EL-10` (64er Sturm/Katastrophe) sowie
   `EL-21`, `EL-27` und `EL-34` (12er Feuer/Zusatzklauseln) ausdrücklich als
   enger, zulässiger Scope katalogisiert. Die harte Fremdspartenregel bleibt
   für nicht deklarierte Zeilen unverändert.

Replays der exakt frischen RC10-Artefakte ergeben:

```text
VS-21: 2 Haftpflichttreffer verworfen, 12 echte Abbruchkostenquellen erhalten
EL-10: 5 passende 64er-Fundstellen als enger Scope
EL-21: 2 passende 12er-Objektfundstellen; fremde Fundstelle bleibt gesperrt
EL-27: 9 passende 12er-Fundstellen als enger Scope
EL-34: 11 passende 12er-Fundstellen als enger Scope
```

```text
PASS: 89 Jest-Suites / 975 Tests
PASS: Server-, Frontend- und Collector-Lint
PASS: Syntax-, Diff- und echte RC10-Artefakt-Replays
NEXT: RC11 auf Mac Studio installieren und WEVIG + LF mit 27B regressieren
NO CLAIM: 99 Prozent oder finale V3.3.0-Freigabe
```

## 35. Betriebs-Härtung für unbeaufsichtigte All-Kategorien-Läufe

`run-all-categories-quality.command` startet einen Modelllauf nur noch, wenn
eine atomar erworbene globale Runner-Sperre vorliegt und LM Studio das exakt
angeforderte Modell unter `/v1/models` meldet. Damit können zwei Instanzen
desselben Großläufers nicht mehr gleichzeitig auf das lokale Chatmodell
zugreifen.

Vor der PDF-Extraktion wird `manifest.private.json` atomar angelegt. Ein Resume
wird ausschließlich zugelassen, wenn Release-Identität, Modell,
Modell-Tokenlimit, Dokumentstatus und SHA-256 des PDFs unverändert sind. Ein
bereits befüllter Ausgabeordner ohne Manifest wird fail-closed abgelehnt.

```text
PASS: Shell-Vertrag für neuen Lauf und identischen Resume
PASS: abweichendes Release, Modell, Tokenlimit, Dokumentstatus oder PDF abgelehnt
PASS: fehlendes Modell und konkurrierender Lauf vor Ausgabeerzeugung abgelehnt
BEGRENZUNG: SIGKILL oder Stromverlust kann eine verwaiste Sperre hinterlassen;
            sie wird bewusst nicht automatisch übernommen.
```

## 36. RC6-27B-Befund: gemischte Objekte und variantenbezogene Werte

Der vollständige RC6-Lauf auf `qwen/qwen3.8-27b` bestätigte die allgemeinen
Recall-Gewinne, legte aber zwei bereits historisch bekannte Restlücken frei:

- vollständig geklärte, unterschiedliche Objektwirkungen wurden intern als
  `MIXED` gehalten, im sichtbaren Vertrag aber zu `TEILBELEGT` und
  `Nicht feststellbar` herabgestuft;
- Beträge, explizit unbegrenzte Leistungen und vorangestellte Listenlimits
  verloren beim Rendern ihren C-/D-Variantenscope.

Die Korrektur bleibt kategorienunabhängig: `COMPLETE + MIXED + NONE` wird als
`BELEGT + Gemischt` ausgegeben; Fundstellen tragen einen strukturierten
Variantenscope; Limits unterscheiden `CAPPED` und `UNBOUNDED`; ein expliziter
Listen-Governor bleibt quellengebunden; die Vollständigkeit wird je ausgewählter
Variante geprüft. Ein fehlender Wert oder ungeklärter Scope bleibt weiterhin
`TEILBELEGT`.

Deterministische Replays der echten RC6-27B-Artefakte ergeben:

```text
LW-26: C-Deckung EUR 2.000 je Schadenfall;
       D-Deckung ohne betragliche Beschränkung je Schadenfall
LW-27: C-Deckung EUR 7.500,00 auf Erstes Risiko;
       D-Deckung EUR 10.000,00 je Schadenfall
EL-16: Wintergarten eingeschlossen; Vitrinen ausgeschlossen;
       Deckung Gemischt; Wintergarten bis 10 m² Einzelscheibengröße
```

Zusätzlich wurden drei reale Scopefehler geschlossen: Ein lokaler positiver
Gefahrenhöchstbetrag wird nicht mehr durch einen älteren negativen Scope-Lead
zum Ausschluss (`EL-04`), der Elementar-Einschluss von Erdbeben erhält denselben
kontrollierten Sturm-Kapitel-Scope wie die benachbarten Katastrophenpositionen
(`EL-07`), und der wörtliche Mieter-Regressverzicht wird bereits in der
Kandidatenschicht serverautoritär als direkter Beleg gebunden (`HP-16`).

Die abschließende RC6-Prüfung von WE zeigte außerdem eine lokale
Polaritätsinvertierung: Der übernommene Listen-Governor `Versichert sind`
überstimmte in `WE-14` das spätere wörtliche `jedoch exklusive deren Inhalt`.
`exklusive` ist nun ein expliziter negativer Klausel-Governor. Das reale
RC6-Artefakt-Replay ergibt deshalb quellengebunden `BELEGT + Nein`, während
`WE-13` für die Kellerabteile selbst unverändert `BELEGT + Ja` bleibt.

```text
PASS: 88 Jest-Suites / 961 Tests
PASS: Server-Lint
PASS: echte RC6-Artefakt-Replays für LW-26, LW-27 und EL-16
PASS: echtes RC6-Artefakt-Replay für WE-14
REVIEW_REQUIRED: frischer vollständiger 27B-Lauf mit neuem Release-Fingerprint
```

## 37. RC8: Standalone-Doctor verwendet die gebündelte Laufzeit

Beim echten RC7-Update über `ssh macstudio` bestand der im Updateprozess
aufgerufene Doctor, weil der Build zuvor die gebündelte Node-Laufzeit in den
`PATH` aufgenommen hatte. Ein unmittelbar danach separat gestartetes
`doctor.command` meldete die intakte Datenbank dagegen fälschlich als nicht
migriert: Der Prisma-Shebang `/usr/bin/env node` fand in der
nichtinteraktiven SSH-Shell kein `node`.

Der Datenbankcheck startet Prisma deshalb nun ausdrücklich über
`$V3_NODE_BIN`. Diese RC8-Korrektur ändert keine Analyse- oder
Modellsemantik; sie macht lediglich den dokumentierten Standalone-Doctor
reproduzierbar.

## 38. RC8-27B-Befund: Variantenbindung und Haftpflichtgrenze

Der frische vollständige RC8-Lauf war technisch vollständig:

```text
320/320 Zeilen
381 kontrollierte Kandidaten
233 ausgewählte Quellen
qwen/qwen3.8-27b
FRAMEWORK_TERMS
```

Die RC7-Korrekturen wurden bestätigt: `EL-04`, `EL-07`, `EL-16`, `HP-16`
und `WE-14` verhalten sich wie beabsichtigt. Zwei neue Modell-/Scopegrenzen
wurden sichtbar:

1. Das Modell markierte beide expliziten D-Deckungs-Kandidaten für `LW-26`
   als `UNRESOLVED`, obwohl Variantenüberschrift, positiver Listen-Governor
   und lokale Klausel übereinstimmten. Solche strukturell vollständigen
   Varianten-Listeneinträge sind nun serverautoritär; dieselbe Bindung gilt
   auch für die Wertextraktion.
2. `HP-11` übernahm einen Heizöltank aus der Liste versicherter Gebäudesachen
   als Haftpflichtbeleg. Ein reines Tankobjekt ohne Haftpflicht-,
   Gewässerschaden- oder Anlagenrisiko-Kontext ist nun nur `MENTION_ONLY`.

Zusätzlich wurde die im RC8-Lauf sichtbare Reichweite von `exklusive`
präzisiert: Der Ausdruck beendet nur den lokalen Listeneintrag und darf nicht
auf später genannte Objekte fortwirken.

Replays der exakt frischen RC8-Artefakte ergeben:

```text
LW-26: BELEGT + Ja
       C-Deckung EUR 2.000 je Schadenfall
       D-Deckung ohne betragliche Beschränkung je Schadenfall
HP-11: UNGEKLÄRT statt falschem Ja oder falschem Nein
WE-14: weiterhin BELEGT + Nein
```

## 39. RC9-27B-Befund: positiver vollständiger LF-Vertikalfall

Der frische vollständige RC9-Lauf auf dem LF-Rahmenbedingungsdokument war
technisch vollständig und bestätigte die zuvor isolierten Korrekturen:

```text
320/320 Zeilen
381 kontrollierte Kandidaten
238 ausgewählte Quellen
70 BELEGT / 43 TEILBELEGT / 207 UNGEKLÄRT
qwen/qwen3.8-27b
FRAMEWORK_TERMS
```

Gegenüber RC8 änderten sich nur vier Zeilen. `LW-26` erhielt beide
Variantenwerte vollständig; `HP-11` wurde auf die korrekte Haftpflichtgrenze
zurückgesetzt. `LW-22` und `ST-19` erhielten zusätzliche gültige Quellen ohne
inhaltliche Statusänderung. VS, FE, EL, VB und WE blieben stabil. Damit ist LF
als positiver vertikaler RC9-Fall akzeptiert, aber noch kein Beweis für eine
beliebige zukünftige Polizze.

## 40. WEVIG-RC9-Befund und RC10-Klauselscope

Der vollständige WEVIG-RC9-Lauf war ebenfalls technisch vollständig:

```text
320/320 Zeilen
369 kontrollierte Kandidaten
225 ausgewählte Quellen
33 BELEGT / 31 TEILBELEGT / 256 UNGEKLÄRT
qwen/qwen3.8-27b
PROPOSAL
```

Die Gegenprobe zeigte eine allgemeine Restursache: Klauseltexte im
Bedingungsanhang verloren die Information, unter welcher Sparte ihre
Besondere-Bedingungsnummer im Vorschlag aktiviert worden war. Dadurch wurden
unter anderem ein 64er-Grundwasserausschluss zu `LW-20`, eine nur unter Feuer
aktivierte Markisenklausel zu `ST-16`, Erdbebenformulierungen zu `HP-05` und
`HP-21` sowie Sachspartenbelege zu WE übertragen. Zusätzlich blieb das direkt
bei EL-04 stehende gemeinsame Limit von EUR 20.000,00 leer.

RC10 bildet deshalb die Aktivierung von Klauselcodes je Versicherungssparte
ab, trägt eindeutige und mehrfache Aktivierungsscopes bis in den Klauselanhang
und weist fremde Sparten in FE, LW, ST, EL, HP und WE serverseitig ab.
Katalogisierte enge Scopes und allgemeine Vertragsbestimmungen bleiben
zulässig. Lokale Beträge im selben Gefahren-Listeneintrag werden
quellengebunden extrahiert.

Replays des exakt extrahierten WEVIG-RC9-Artefakts ergeben:

```text
LW-20, ST-16, HP-05, HP-13, HP-21: fremde Quellen MENTION_ONLY
WE-07, WE-09, WE-12, WE-17: fremde Sachspartenquellen MENTION_ONLY
FE-A10 und ST-21: enger Scope statt allgemeiner Vollbeleg
EL-04: EUR 20.000,00, Requested-Field-Status COMPLETE
```

```text
PASS: 89 Jest-Suites / 972 Tests
PASS: Server-, Frontend- und Collector-Lint
PASS: Syntax-, Diff- und echte WEVIG-Artefakt-Replays
GO: RC10 auf Mac Studio installieren und vollständigen WEVIG-27B-Lauf starten
REVIEW_REQUIRED: frischer LF-Regressionslauf mit RC10
NO CLAIM: 99 Prozent oder finale V3.3.0-Freigabe
```

## 43. RC12-LF-Gesamtregression und RC13-EL-25-Abschluss

Der vollständige RC12-Lauf auf dem LF-Rahmenbedingungsdokument wurde direkt
auf dem Mac Studio mit `qwen/qwen3.8-27b` ausgeführt:

```text
320/320 Zeilen
381 kontrollierte Kandidaten
234 ausgewählte Quellen
71 BELEGT / 40 TEILBELEGT / 209 UNGEKLÄRT
FRAMEWORK_TERMS
```

VS (36), FE (80), HP (36) und VB (36) waren vollständig byte-identisch zum
akzeptierten RC9-LF-Ergebnis. Die übrigen Änderungen wurden anhand ihrer
Originalquellen geprüft:

- `LW-11` verwirft eine Feuer-Kapitelstelle zu elektrischen Teilen von
  Heizungsanlagen; Heizkessel und Heizkörper bleiben durch die echte
  Leitungswasserstelle belegt.
- `ST-14` verwirft eine Glasversicherungsstelle zu Lichtkuppeln.
- `WE-09` verwirft Glas-/Feuerstellen, die Fenster oder Türen versichern, aber
  keine wohnungseigentumsrechtliche Zuordnung regeln.
- `EL-10` wird aus der aktivierten Sturm-Katastrophendeckung vollständig
  belegt; `EL-21` hält die Gegensprechanlage als Teilbeleg, ohne daraus eine
  Elektronikdeckung zu erfinden.

Dabei zeigte `EL-25` den einzigen verbliebenen Fehler: Die Feuer-Erweiterung
versichert ausdrücklich böswillige Beschädigung ohne vorangegangenen Einbruch,
wurde aber als Fremdscope verworfen. RC13 katalogisiert deshalb für genau diese
EL-Zeile `FEUER_INSURANCE` als zulässigen engen Scope.

Frische Kategorie-Läufe über den vollständigen Produktionspfad belegen:

```text
LF:    EL-25 BELEGT / Ja; nur diese eine von 36 EL-Zeilen geändert
WEVIG: EL-25 UNGEKLÄRT; alle 36 EL-Zeilen semantisch unverändert
PASS:  alle Artefakt- und Tabellen-Gates
PASS:  89 Jest-Suites / 977 Tests
PASS:  Server-, Frontend- und Collector-Lint
```

RC13 ist damit der aktuelle positive Zwei-Dokument-Kandidat. Die Aussage bleibt
auf die vorhandenen Referenzdokumente und bekannten Befunde begrenzt; eine
99-Prozent-Garantie setzt weiterhin vollständige fachliche Oracles voraus.

## 44. RC14: Operative Deckungsklauseln und messbares Dokument-Oracle

Die Auswertung der vollständigen RC11-/RC12-Artefakte zeigte einen weiteren
allgemeinen Fehler zwischen kontrollierter Suche und Wirkungsermittlung. WEVIG
enthält für `LW-05` unter `Mitversichert gelten` einen eindeutigen Rohrersatz
bei Rohrbruch. Für `LW-26` steht im aktivierten Leitungswasser-Klauselanhang
ausdrücklich, dass die Kosten der Verstopfungsbeseitigung ersetzt werden. Das
Modell stufte die vier atomaren Komponenten trotzdem als `UNRESOLVED` oder
`MENTION_ONLY` ein; der Server verwarf daraufhin die richtigen Fundstellen.

RC14 bindet deshalb nur zwei explizite, versichererneutrale Vertragsformen
serverautoritär: lokale Listenpositionen unter einem spartengleichen
Deckungs-Governor und operative Ersatz-/Entschädigungssätze innerhalb desselben
Satzes. Negative operative Sätze bleiben ausgeschlossen; reine Erwähnungen und
Fremdsparten bleiben gesperrt.

Parallel wurde das fehlende Messinstrument geschaffen. Das generische sparse
Dokument-Oracle prüft reviewer-eigene `APPROVED`- oder `DRAFT`-Erwartungen über
Endzeilen, Komponenten, Scope, Konflikt, Dokumentgeltung, Werte/Rollen und
Quellen. Ein Offline-CLI wertet vorhandene QA-Artefakte aus, ohne sie zu
verändern. Die ersten WEVIG-LW-Erwartungen bleiben bis zur fachlichen Prüfung
ausdrücklich `DRAFT`.

```text
PASS: 91 Jest-Suites / 986 Tests
PASS: ESLint, Prettier und Diff-Check
PASS: echtes RC11-Artefakt-Replay für LW-05 und LW-26
PASS: Seiteneffektprüfung über alle LF-/WEVIG-Kategorien
      genau vier beabsichtigte Overrides, keine weiteren Änderungen
RED:  altes WEVIG-RC11-Artefakt erfüllt nur 34/65 DRAFT-Aussagen
PASS: RC14-Update und beide Doctor-Läufe auf dem Mac Studio
PASS: frischer WEVIG-LW-27B-Lauf, 33/33 Kandidaten, 52/52 Komponenten,
      36/36 Zeilen, 65/65 DRAFT-Oracle-Aussagen
PASS: genau LW-05 und LW-26 verbessert; übrige 34 LW-Zeilen stabil
NO CLAIM: DRAFT ist keine fachliche Freigabe und keine 99-Prozent-Garantie
```

## 45. RC15: Deckungsrollen und definitive Wirkungen im erlaubten Host-Scope

Die vollständigen WEVIG-RC11- und LF-RC12-Artefakte zeigten vier Zeilen, bei
denen Suche, Triage, atomare Wirkung, Quellenbindung und Werte bereits korrekt
waren, die sichtbare Endzeile aber trotzdem herabgestuft wurde.

Bei `LW-03` und `LW-04` waren die Rohre ausdrücklich `INCLUDED`, während die
erforderliche Ortsbedingung korrekt `CONDITIONAL` war. Der bisherige Rollup
ließ die Bedingung das Deckungsbild auf `NOT_DETERMINABLE` setzen. RC15 trennt
deshalb nur für ausdrücklich katalogisierte Anforderungen die
deckungsentscheidenden Rollen von weiterhin erforderlichen Bedingungen.

Bei LF `EL-05` waren beide Gefahren eingeschlossen und die unterstützende
Abgrenzung definiert; bei `EL-15` waren Sonderverglasungen teilweise
eingeschlossen und eine konkrete Verbundglasart ausgeschlossen. Beide
Sachverhalte lagen in katalogisierten, aktivierten Host-Scopes. Der Renderer
akzeptiert nun die unterstützende Definition von `EL-05` sowie definitive
positive und negative Wirkungen für die neue, nur bei `EL-15` deklarierte
Scope-Policy.

Die Gegenregeln sind Bestandteil des Vertrags: deckungsentscheidendes
`CONDITIONAL`, unterstützendes `OPTION_ONLY`, `UNKNOWN`, ungelöste Kandidaten
und nicht katalogisierte enge Scopes bleiben partiell oder ungeklärt. Die
definitive Policy ist ohne konkrete Host-Scope-Schlüssel ungültig. `ST-27`
bleibt als reale Negativprobe unverändert fail-closed.

```text
PASS: 91 Jest-Suites / 998 Tests
PASS: Server-, Frontend- und Collector-Lint
PASS: Replay aller 640 LF-/WEVIG-Endzeilen
PASS: nur WEVIG LW-03/04 und LF EL-05/15 neu verbessert
PASS: keine neue Endzeilenänderung in HP, FE, ST, VB oder WE
PASS: ST-27 bleibt TEILBELEGT / Nicht feststellbar
PASS: RC15-Tag a8884715 auf Mac Studio installiert; beide Doctor-Läufe grün
PASS: frischer WEVIG-LW-Lauf, 33/33 Kandidaten, 52/52 Komponenten,
      36/36 Zeilen, 127/127 DRAFT-Oracle-Aussagen
PASS: frischer LF-EL-Lauf, 48/48 Kandidaten, 69/69 Komponenten,
      36/36 Zeilen, 76/76 DRAFT-Oracle-Aussagen
PASS: gegen die letzten akzeptierten Kategorie-Läufe exakt vier Änderungen:
      WEVIG LW-03/04 und LF EL-05/15; alle übrigen 68 Zeilen stabil
NO CLAIM: DRAFT-Oracle ist keine fachliche Freigabe
```

## 46. RC16: Allgemeine Vertragszusammenfassung und belegte VB-Werte

Die WEVIG-Auswertung zeigte einen strukturellen Seitenübergangsfehler: Nach der
Haftpflichtseite erbte die folgende Angebotszusammenfassung weiterhin
`HAFTPFLICHT_INSURANCE` und `Mitversichert gelten`. Deshalb wurden allgemeine
Vertragsfakten wie Laufzeit, Dauerrabatt und Gesamtprämie trotz vollständigem
PDF-Kontext verworfen.

RC16 führt die konkrete Zusammenfassungsüberschrift als allgemeine
Vertragsgrenze ein. Die Governor-Vererbung ist positionsabhängig und bleibt auf
Seiten mit dieser kontrollierten Grenze beschränkt. Die breite Überschrift
`WICHTIGE INFORMATIONEN` wird ausdrücklich nicht global umgedeutet.

Zusätzlich erhält `VB-01` eine konservative Mindestlaufzeit-Extraktion und
`VB-27` eine operative Gesamtprämien-Extraktion. Prämie und Steuerinklusion
bleiben zwei getrennte Pflichtfakten. Negative Tests sperren Höchstlaufzeiten,
Kündigungsfristen, bloße Laufzeiterwähnungen sowie fremde periodische Beträge.

```text
PASS: 91 Jest-Suites / 1006 Tests
PASS: Server-, Frontend- und Collector-Lint
PASS: vollständiger LF-/WEVIG-Worksheet-Replay
PASS: keine LF-Fundstellen- oder Scope-Änderung
PASS: WEVIG-Änderungsfläche auf VB-01/02/27 und die echte gemeinsame
      Zusammenfassungsgrenze bei EL-21 begrenzt
PASS: alle übrigen Kategorie-Fundstellen unverändert
PENDING: frischer WEVIG-VB- und EL-Lauf mit qwen/qwen3.8-27b
NO CLAIM: DRAFT-Oracle ist keine fachliche Freigabe
```

## 47. RC16-Modellbefund und RC17-Ursachenbehebung

Der unveränderte RC16-Tag bestand auf dem Mac Studio Update, beide
Doctor-Läufe und alle technischen 27B-Gates. Qualitativ blieb er jedoch rot:
`VB-01` und `VB-27` waren weiterhin `UNGEKLÄRT`, das neue DRAFT-Oracle bestand
nur 17 von 47 Aussagen. Die neue Suche und Abschnittsgrenze waren korrekt;
Qwen stufte die eindeutigen Sätze trotzdem als `MENTION_ONLY` ein, sodass der
Server sie vor Wirkung und Wertebindung entfernte. Dieser Befund verhindert,
dass RC16 fälschlich als positiver Release gilt.

RC17 ergänzt deshalb keine breite Prompt-Ausnahme, sondern drei enge
serverprüfbare allgemeine Vertragsformen: numerische Vertragslaufzeit,
operativ erklärte Gesamtprämie und explizite Steuerinklusion. Nur im
VB-Allgemeinscope und nur für die passenden Komponenten werden diese Formen
autoritativ `DIRECT / DEFINED`. Negative Formen bleiben gesperrt.

Das echte RC16-27B-Artefakt wurde mit der neuen Entscheidungslogik vollständig
replayt. Ohne einen neuen Modellaufruf änderten sich von 36 VB-Zeilen exakt
`VB-01` und `VB-27`; `VB-02` und alle übrigen 33 Zeilen blieben semantisch
identisch.

```text
PASS: 91 Jest-Suites / 1013 Tests und vollständiger Lint
PASS: gezielte Candidate-, Prepared-, Werte- und Materializer-Tests
PASS: LF-/WEVIG-Bindungsflächen-Scan
PASS: nur vier WEVIG-VB-Kandidaten auf PDF-Seite 6 neu autoritativ
PASS: RC16-27B-Replay, exakt VB-01 und VB-27 verbessert
PASS: mindestens 10 Jahre; EUR 14.747,66 vierteljährlich
PASS: 20 % und 25 % bleiben ausschließlich VB-02-Rabattwerte
PASS: RC17-Tag 6575af55 auf Mac Studio installiert; beide Doctor-Läufe grün
PASS: frischer WEVIG-VB-Lauf, 20/20 Kandidaten, 52/52 Komponenten,
      36/36 Zeilen und 47/47 DRAFT-Oracle-Aussagen
PASS: gegen RC16 exakt VB-01 und VB-27 verbessert; übrige 34 Zeilen stabil
PASS: WEVIG-EL-Kontrolllauf, 58/58 Kandidaten, 69/69 Komponenten,
      36/36 Zeilen und keine semantische Änderung gegenüber RC11
NO CLAIM: DRAFT-Oracle ist keine fachliche Freigabe
```

## 48. RC18: Jahresaggregat-Vielfaches als servergebundener Wert

Die aktuelle LF-HP-Auswertung zeigte einen isolierten Verlust zwischen
korrekter Evidenz und sichtbarer Zeile. `HP-02` war bereits als allgemeine,
definierte Jahreshöchstleistung belegt; der Text `maximal dreimal` wurde aber
nicht vom bisherigen Geld-/Prozent-/Dauer-Wertevertrag erfasst. Deshalb blieb
die Zeile `TEILBELEGT`, obwohl die Vertragsaussage vollständig war.

RC18 führt keinen LF-Wortlautparser ein. Der allgemeine Vertrag verlangt im
selben kontrollierten Haftpflicht-Klauselkontext einen Jahresbezug, eine
Deckungssummenbasis, einen Begrenzungsanker und ein numerisches oder
ausgeschriebenes `mal`-/`fach`-Vielfaches. Nur `HP-02` darf daraus ein
servergebundenes `MULTIPLE` mit exaktem Quellspan erhalten. Rollenfremde
Zählungen, eine Summe ohne Jahresbezug und ein Jahresbezug ohne Summenbasis
bleiben gesperrt.

```text
PASS: 91 Jest-Suites / 1021 Tests und vollständiger Lint
PASS: positive Wort-/Zahlvarianten und adversariale Negativvarianten
PASS: Scan über 24 aktuelle LF-/WEVIG-Worksheets, genau ein Treffer
PASS: echter LF-HP-27B-Replay, 36/36 Zeilen verglichen
PASS: ausschließlich HP-02 verbessert
      TEILBELEGT / Nicht feststellbar -> BELEGT / Ja / 3-fach
PASS: übrige 35 HP-Zeilen bytegenau unverändert
PASS: RC18-Tag e11db5d2 auf Mac Studio installiert; beide Doctor-Läufe grün
PASS: frischer LF-HP-Lauf, 37/37 Kandidaten, 63/63 Komponenten,
      36/36 Zeilen und 27 Quellen
PASS: gegen RC12 exakt HP-02 verbessert; übrige 35 Zeilen stabil
PASS: frischer WEVIG-HP-Kontrolllauf, 23/23 Kandidaten,
      63/63 Komponenten, 36/36 Zeilen und 0 semantische Änderungen
PASS: WEVIG HP-02 bleibt ehrlich UNGEKLÄRT / Nicht feststellbar
NO CLAIM: externe Mehrversicherer-Generalisierung ohne Holdout nicht bewiesen
```

## 49. RC19: Beschriftete Versicherungsperiode ohne Datumsabbruch

Die aktuelle WEVIG-FE-Auswertung enthielt bereits die richtige Seite und die
richtigen Startkandidaten. Der generische Satzbereich endete jedoch am ersten
Punkt in `19.01.2026`; der Wertevertrag sah deshalb kein vollständiges Datum
und die Ausgabe zeigte `Versicherungsbeginn 19`. Gleichzeitig fehlte
`Versicherungsablauf` als Rollenanker für die getrennte zeitliche Geltung.

RC19 behandelt keine beliebigen Zahlen als Datum. Nur eine beschriftete
Versicherungsbeginn-Zeile liefert das Startdatum. Eine vollständige
Start-/Ablaufzeile kann in `FE-F05` die Periodenkomponente serverautoritär
definieren. Zugangsbedingung, Startdatum und Ablauf bleiben getrennte
quellengebundene Fakten. Unbeschriftete Druckdaten, unvollständige Daten und
einseitige Start-/Ablaufangaben bleiben gesperrt.

```text
PASS: 91 Jest-Suites / 1028 Tests und vollständiger Lint
PASS: positive Periodenvarianten und adversariale Datums-Negativvarianten
PASS: echter WEVIG-FE-27B-Replay, 80/80 Zeilen verglichen
PASS: genau eine neue Fundstelle und ausschließlich FE-F05 verbessert
      TEILBELEGT / "Versicherungsbeginn 19"
      -> BELEGT / Ja / Datum 19.01.2026 / vollständige Periode
PASS: übrige 79 FE-Zeilen unverändert
PASS: LF-FE-Worksheet weiterhin 25 Kandidaten, keine neue Fundstelle
PASS: Vorab-Dokumentationsfehler 36 FE-Zeilen -> korrekt 80 berichtigt
PASS: RC19-Tag 56aebcb8 auf Mac Studio installiert; beide Doctor-Läufe grün
PASS: frischer WEVIG-FE-Lauf, 45/45 Kandidaten, 138/138 Komponenten,
      80/80 Zeilen und 21 Quellen
PASS: gegen RC11 exakt FE-F05 verbessert; übrige 79 Zeilen stabil
PASS: frischer LF-FE-Kontrolllauf, 25/25 Kandidaten,
      138/138 Komponenten, 80/80 Zeilen und 0 semantische Änderungen
NO CLAIM: andere Datumsformen und externe Holdouts bleiben offen
```

## 50. RC20: Wiederherstellungsfrist vollständig in die Endzeile übertragen

LF `VB-26` war kein Such- oder Modellproblem. Das Worksheet enthielt vier
passende Wiederherstellungsfristen und die Wirkung war bereits bedingt
geregelt. Der angeforderte Wert `duration` blieb jedoch leer, weil die
allgemeine Dauerextraktion `dreier Jahre` nicht normalisierte. Der Renderer
musste die Zeile deshalb trotz richtiger Quellen auf `TEILBELEGT` begrenzen.

RC20 bindet nur in `VB-26` eine grammatisch unmittelbar mit
Wiederbeschaffung oder Wiederherstellung verbundene `innerhalb`-/`binnen`-Frist.
Zahl, Einheit und exakter Quellspan bleiben servergebunden. Eine ausdrückliche
Deckungsprozess-Verlängerung wird als Regel definiert, liefert allein aber
keine erfundene Zahl. Fremde Kündigungs- oder Vertragsdauern bleiben gesperrt.

```text
PASS: 91 Jest-Suites / 1034 Tests und vollständiger Lint
PASS: positive Zahlwort-/Ziffervarianten und adversariale Negativvarianten
PASS: echter LF-VB-27B-Artefaktreplay, 36/36 Zeilen verglichen
PASS: ausschließlich VB-26 verbessert
      TEILBELEGT -> BELEGT / Ja / Dauer 3 Jahre
PASS: übrige 35 LF-VB-Zeilen unverändert
PASS: WEVIG-VB-Kontrollreplay, 36/36 Zeilen und 0 Änderungen
PASS: RC20-Tag 32bb07fb auf Mac Studio installiert; beide Doctor-Läufe grün
PASS: frischer LF-VB-Lauf, 35/35 Kandidaten, 52/52 Komponenten,
      36/36 Zeilen und 22 Quellen
PASS: gegen RC12 exakt VB-26 verbessert; übrige 35 Zeilen stabil
PASS: frischer WEVIG-VB-Kontrolllauf, 20/20 Kandidaten,
      52/52 Komponenten, 36/36 Zeilen und 0 semantische Änderungen
PASS: WEVIG VB-26 bleibt ehrlich UNGEKLÄRT / Nicht feststellbar
NO CLAIM: externe Mehrversicherer-Generalisierung ohne Holdout nicht bewiesen
```

## 51. RC21: Leckortung und Suchkosten als Alternativwortlaut behandeln

`LW-08` war in LF und WEVIG nicht wegen fehlender Suche oder schwacher
Modellklassifikation unvollständig. Beide Dokumente enthielten `Suchkosten`
mit einem quellengebundenen Limit. Der aktive Katalog verlangte jedoch
zusätzlich das synonyme Wort `Leckortungskosten` und erzeugte dadurch eine
Scheinteilbelegung.

RC21 setzt ausschließlich für `LW-08` die bereits vorhandene ANY-Semantik.
Ein tatsächlich gefundener Alternativwortlaut erfüllt den Sachverhalt; nicht
gefundene Synonyme werden dann nicht mehr als getrennte fehlende Objektfakten
ausgegeben. Mehrere tatsächlich gefundene, abweichende Wirkungen bleiben für
die Konfliktprüfung erhalten. Ohne Fundstelle wird nichts aktiviert.

```text
PASS: 91 Jest-Suites / 1037 Tests und vollständiger Lint
PASS: synthetische Varianten Leckortungskosten und Suchkosten
PASS: Zeilenvertrag BELEGT / Ja mit quellengebundenem Limit
PASS: frischer LF-LW-Lauf, 33/33 Kandidaten, 52/52 Komponenten,
      36/36 Zeilen und 25 Quellen
PASS: gegen RC12 exakt LW-08 verbessert
      TEILBELEGT -> BELEGT / Ja / EUR 2.500 auf Erstes Risiko
PASS: übrige 35 LF-LW-Zeilen semantisch identisch
PASS: frischer WEVIG-LW-Lauf, 33/33 Kandidaten, 52/52 Komponenten,
      36/36 Zeilen und 24 Quellen
PASS: gegen RC15 exakt LW-08 verbessert
      TEILBELEGT -> BELEGT / Ja / EUR 1.500,00 auf Erstes Risiko
PASS: übrige 35 WEVIG-LW-Zeilen semantisch identisch
PASS: RC21-Tag 3e5a0f02 auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: unbekannte Versicherer und Formulierungen bleiben Holdouts
```

## 52. RC22: Haftpflichtbedingungen getrennt vom Deckungsbild

LF `HP-24` und `HP-27` waren bereits vollständig gefunden und quellengebunden.
Die Abwehrkosten beziehungsweise die durch Personal verursachten Schäden waren
`INCLUDED`; die Anrechnungs- beziehungsweise Personalbedingung war korrekt
`CONDITIONAL`. Der gemeinsame Rollup machte daraus trotzdem ein
unbestimmbares Deckungsbild.

RC22 überträgt die in RC15 bewiesene Deckungsrollen-Aggregation gezielt auf
diese beiden katalogisierten HP-Anforderungen. Bedingungen bleiben für
Vollständigkeit, Text und Quellen erforderlich, bestimmen aber nicht mehr die
Polarität der eigentlichen Leistung. Fehlende Deckungskomponenten bleiben
fail-closed.

```text
PASS: 91 Jest-Suites / 1037 Tests und vollständiger Lint
PASS: echter LF-HP-Replay, 36/36 Zeilen
PASS: nur HP-24 und HP-27 verbessert
      TEILBELEGT / Nicht feststellbar -> BELEGT / Ja
PASS: übrige 34 LF-HP-Zeilen semantisch identisch
PASS: frischer LF-HP-Lauf, 37/37 Kandidaten, 63/63 Komponenten,
      36/36 Zeilen und 27 Quellen
PASS: frischer WEVIG-HP-Kontrolllauf, 23/23 Kandidaten,
      63/63 Komponenten, 36/36 Zeilen und 8 Quellen
PASS: WEVIG gegenüber RC18 über alle 36 Zeilen semantisch unverändert
PASS: RC22-Tag 139f53d7 auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: andere HP-Anforderungen oder externe Holdouts automatisch freigegeben
```

## 53. RC23: Elementarwerte im bereits deklarierten Sturm-Host-Scope abschließen

LF `EL-01` und `EL-11` besaßen vollständige Werte, serverautoritäre
`DEFINED`-Wirkungen und exakte Quellen. Beide Anforderungen führten
`STURM_INSURANCE` bereits als zulässigen Host-Scope, verwendeten aber noch die
allgemeine Scope-Policy und blieben deshalb sichtbar `TEILBELEGT`.

RC23 aktiviert für genau diese beiden Wertanforderungen den bereits bewiesenen
Matching-Scope-Abschluss. Ohne passende Komponente, vollständiges Pflichtfeld
und deklarierte ScopeKeys bleibt der Vertrag fail-closed.

```text
PASS: 91 Jest-Suites / 1040 Tests und vollständiger Lint
PASS: echter LF-EL-Replay, 36/36 Zeilen
PASS: nur EL-01 und EL-11 verbessert
PASS: EL-01 -> 1 %; EUR 20.000; EUR 100.000 auf Erstes Risiko
PASS: EL-11 -> EUR 350 je Schadenfall
PASS: übrige 34 LF-EL-Zeilen semantisch identisch
PASS: frischer LF-EL-Lauf, 48/48 Kandidaten, 69/69 Komponenten,
      36/36 Zeilen und 40 Quellen
PASS: frischer WEVIG-EL-Kontrolllauf, 58/58 Kandidaten,
      69/69 Komponenten, 36/36 Zeilen und 42 Quellen
PASS: WEVIG gegenüber RC17 über alle 36 Zeilen semantisch unverändert
PASS: RC23-Tag a776bc0e auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: andere Wertzeilen oder Host-Scopes automatisch freigegeben
```

## 54. RC24: Allgemeine Sparten-Höchstentschädigung streng binden

LF enthält im allgemeinen Vertragsteil eine 150-Prozent-Klausel, die
ausdrücklich für die jeweilige Sparte gilt. VS verwendete sie bereits korrekt.
ST zeigte sie nur als engen Teilbeleg; FE und LW verloren sie im Recall.

RC24 erweitert Recall und Bindung gemeinsam. Nur die drei katalogisierten
Höchstentschädigungsziele in FE, LW und ST dürfen eine allgemeine Klausel
verwenden, und nur wenn derselbe Satz operative Höchstentschädigung,
`jeweilige Sparte` sowie Prozentwert und Versicherungssummenbasis enthält.
Die FE-Jahreshöchstleistung bleibt separat und offen.

```text
PASS: 92 Jest-Suites / 1054 Tests und Server-Lint
PASS: positive FE-/LW-/ST-Varianten und adversariale Negativvarianten
PASS: frischer LF-FE-Lauf, 27/27 Kandidaten, 138/138 Komponenten,
      80/80 Zeilen; nur FE-F02 verbessert
PASS: FE-F02 UNGEKLÄRT -> TEILBELEGT / Höchstentschädigung 150 %
PASS: frischer LF-LW-Lauf, 35/35 Kandidaten, 52/52 Komponenten,
      36/36 Zeilen; nur LW-31 verbessert
PASS: LW-31 UNGEKLÄRT -> BELEGT / Ja / 150 %
PASS: frischer LF-ST-Lauf, 51/51 Kandidaten, 54/54 Komponenten,
      36/36 Zeilen; nur ST-34 verbessert
PASS: ST-34 TEILBELEGT -> BELEGT / Ja / 150 %
PASS: übrige 149 LF-Zeilen unverändert
PASS: frische WEVIG-FE-/LW-/ST-Kontrollläufe, 152/152 Zeilen,
      0 semantische Änderungen
PASS: RC24-Tag 73e3218f auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: unbekannte Wortlaute oder externe Versicherer ohne Holdout bewiesen
```

## 55. RC25: Jalousien und Rollläden als Beschattungseinrichtungen

LF `ST-16` war kein Modell- oder Scopefehler. Dieselbe Objektliste belegte
Markisen, Jalousien und Rollläden; `ST-17` verwendete sie bereits korrekt.
Nur der Aliasvertrag von `ST-16/shading_system` kannte die konkreten
Beschattungsobjekte nicht.

RC25 ergänzt diese physischen Synonyme ohne Änderung an Scope oder Wirkung.
Die WEVIG-Markisenquelle bleibt wegen ihrer Feueraktivierung in ST gesperrt.

```text
PASS: 92 Jest-Suites / 1055 Tests und Server-Lint
PASS: LF-ST 53/53 Kandidaten, 54/54 Komponenten, 36/36 Zeilen
PASS: ausschließlich ST-16 verbessert
      TEILBELEGT / Nicht feststellbar -> BELEGT / Ja
PASS: ST-17 und übrige 34 LF-ST-Zeilen unverändert
PASS: WEVIG-ST 15/15 Kandidaten, 54/54 Komponenten, 36/36 Zeilen
PASS: WEVIG über alle 36 Zeilen unverändert
PASS: RC25-Tag 2689af8d auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: beliebige Beschattungsobjekte oder externe Holdouts bewiesen
```

## 56. RC26: Rechtsfolgenformulierungen und PDF-Satzfortsetzung

LF und WEVIG regelten `FE-E16` vollständig, verwendeten aber nicht den engen
Katalogwortlaut `Verletzung einer Obliegenheit`. LF formuliert eine
Pflichtverletzung mit anschließender Leistungsfreiheit; WEVIG versichert
Verletzungen vereinbarter Obliegenheiten und nennt danach die Grenzen der
Deckungserweiterung.

RC26 ergänzt beide Vertragsvarianten als kontrollierte Recall-Anker. Bei der
Endprüfung wurden zwei allgemeine Layoutverluste sichtbar und behoben:
Gesetzesabkürzungen beenden keinen Satz, und ein PDF-Umbruch nach einem klaren
Fortsetzungswort trennt keine zusammengehörige Bedingung. Die Regel bleibt an
strukturelle Absätze beziehungsweise grammatische Fortsetzung gebunden.

```text
PASS: 93 Jest-Suites / 1059 Tests und Server-Lint
PASS: LF-FE 28/28 Kandidaten, 138/138 Komponenten, 80/80 Zeilen
PASS: LF nur FE-E16 verbessert -> BELEGT / Ja; übrige 79 Zeilen stabil
PASS: WEVIG-FE 46/46 Kandidaten, 138/138 Komponenten, 80/80 Zeilen
PASS: WEVIG nur FE-E16 verbessert -> BELEGT / Ja; übrige 79 Zeilen stabil
PASS: Gesetzesverweis und WEVIG-Sicherheitsausnahmen vollständig sichtbar
PASS: RC26-Tag a58fc9d8 auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: beliebige Rechtsformulierungen oder externe Holdouts bewiesen
```

## 57. RC27: modellstabile Gemeinschaftseinrichtungen

Der erste frische WEVIG-VS-Lauf auf RC26 bestätigte die seit RC12
katalogisierte Scope-Freigabe: `VS-21` und `VS-28` wurden vollständig belegt.
Gleichzeitig bewertete Qwen die Überschrift der aktivierten
Gemeinschaftseinrichtungen diesmal als `UNRESOLVED`. Diese zusätzliche
Überschrift stufte `VS-34` trotz der bereits serverautoritativ gebundenen
Gerätedefinition auf `TEILBELEGT` zurück.

RC27 bindet genau die Überschriftenform mit lokal folgendem
`Als mitversichert gelten`. Eine Überschrift ohne positiven Governor bleibt
modelloffen. Der reale Worksheet-Vergleich zeigt genau einen neu erfassten
WEVIG-Kandidaten und keinen LF-Kandidaten.

```text
PASS: 93 Jest-Suites / 1062 Tests und Server-Lint
PASS: WEVIG-VS 155/155 Kandidaten, 65/65 Komponenten, 36/36 Zeilen
PASS: gegenüber RC26 ausschließlich VS-34 verbessert
      TEILBELEGT -> BELEGT / Ja / EUR 15.000,00 auf Erstes Risiko
PASS: VS-21 und VS-28 bleiben vollständig belegt
PASS: übrige 33 WEVIG-VS-Zeilen semantisch identisch
PASS: LF-Reichweite unverändert
PASS: RC27-Tag 3334616c auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: bloße Überschriften oder unbekannte Gemeinschaftsobjekte bewiesen
```

## 58. RC28: Regressverzicht für Mieter und Haushaltsangehörige

LF `VB-16` enthielt bereits den vollständigen Regressverzicht gegenüber einem
Mieter und einem mit ihm in häuslicher Gemeinschaft lebenden
Familienangehörigen. Der VB-Katalog kannte die bei `HP-16` bereits bewiesene
reale Formulierung nicht und fand nur die Überschrift.

RC28 ergänzt die beiden Begünstigtenwortlaute und verwendet denselben engen
Klauselvertrag für VB. Bewohner werden nur gebunden, wenn der Haushaltssatz
im selben Kontext steht. `VB-15` bleibt ohne Wohnungseigentümerbeleg offen.

```text
PASS: 93 Jest-Suites / 1064 Tests und Server-Lint
PASS: LF-VB 37/37 Kandidaten, 52/52 Komponenten, 36/36 Zeilen
PASS: ausschließlich VB-16 in Status/Deckung verbessert
      TEILBELEGT / Nicht feststellbar -> BELEGT / Ja
PASS: VB-15 weiterhin UNGEKLÄRT
PASS: WEVIG-VB 20/20 Kandidaten, 52/52 Komponenten, 36/36 Zeilen
PASS: WEVIG gegenüber RC20 exakt 0 semantische Änderungen
PASS: RC28-Tag fc59ddf0 auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: Mieter implizieren Wohnungseigentümer oder beliebige Bewohner
```

## 59. RC29: Sachverständigenverfahren vollständig belegen

LF `VB-24` enthielt bereits den vollständigen verfahrensrechtlichen Anspruch:
Bei Uneinigkeit mit dem Versicherer-Gutachten darf der Versicherungsnehmer
einen anderen Sachverständigen namhaft machen; dessen Gutachten ersetzt das
Schiedsgutachterverfahren. Die Pipeline fand den Satz, ließ ihn aber ohne
klassischen Deckungs-Governor modellabhängig und verlor ihn im Ergebnis.

RC29 bindet nur diese vollständige Drei-Anker-Klausel. Überschriften,
Kostenformulierungen und andere Versicherungskapitel reichen nicht. Die
bedingte Kostentragung bleibt unverändert bedingt; deshalb bleibt die
Gesamtzeile fachlich korrekt `TEILBELEGT`.

```text
PASS: 93 Jest-Suites / 1065 Tests und Server-Lint
PASS: LF-VB 37/37 Kandidaten, 52/52 Komponenten, 36/36 Zeilen
PASS: ausschließlich VB-24 um den echten Verfahrensbeleg verbessert
PASS: übrige 35 LF-VB-Zeilen exakt identisch
PASS: WEVIG-VB 20/20 Kandidaten, 52/52 Komponenten, 36/36 Zeilen
PASS: WEVIG gegenüber RC28 exakt 0 Änderungen
PASS: RC29-Tag 00b60a53 auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: Überschrift oder Kostenklausel beweist ein Verfahrensrecht
```

## 60. RC30: Heizungsanlage in Leitungswasser vollständig belegen

LF `LW-11` hatte Heizkessel und Heizkörper bereits korrekt erkannt. Die
ausdrücklich mitversicherte wasserführende Fußboden- und Wandheizung aus dem
Leitungswasserkapitel wurde wegen der zusammengesetzten deutschen Benennung
nur `LW-12`, nicht der Heizungsanlagenkomponente von `LW-11`, zugeordnet.

RC30 ergänzt diese versichererneutrale Heizungsanlagenform. Die vorhandene
Spartenprüfung bleibt maßgeblich und verwirft einen separaten Treffer aus dem
Feuerkapitel weiterhin.

```text
PASS: 93 Jest-Suites / 1065 Tests und Server-Lint
PASS: LF-LW 36/36 Kandidaten, 52/52 Komponenten, 36/36 Zeilen
PASS: LW-11 TEILBELEGT / Nicht feststellbar -> BELEGT / Ja
PASS: alle drei LW-11-Komponenten quellengebunden eingeschlossen
PASS: übrige LF-Zeilen in Status/Deckung/Betrag stabil
PASS: WEVIG-LW 33/33 Kandidaten, 52/52 Komponenten, 36/36 Zeilen
PASS: WEVIG gegenüber RC21 exakt 0 Änderungen
PASS: RC30-Tag ca7d5e32 auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: Heizungsnennung in fremder Sparte beweist Leitungswasserdeckung
```

## 61. RC31: Dachlawine als Schnee- und Eisrutsch belegen

WEVIG `ST-27` blieb teilweise, obwohl das Sturmkapitel ausdrücklich
`Dachlawinen (Schnee und Eis) auf Erstes Risiko` nennt. Die Taxonomie kannte
Lawinen, aber nicht die Dachlawine als gemeinsamen Beleg für Lawine und
Schneerutsch.

RC31 ergänzt diese fachliche Synonymie und bindet sie nur mit Klammerzusatz,
Erstrisiko-Governor und Sturm-Scope. Beide Rollen teilen denselben realen
Klauselspan und werden serverseitig entschieden.

```text
PASS: 93 Jest-Suites / 1067 Tests und Server-Lint
PASS: WEVIG-ST 17/17 Kandidaten, 54/54 Komponenten, 36/36 Zeilen
PASS: ST-27 TEILBELEGT / Nicht feststellbar -> BELEGT / Ja
PASS: übrige 35 WEVIG-ST-Zeilen exakt identisch
PASS: LF-ST 53/53 Kandidaten, 54/54 Komponenten, 36/36 Zeilen
PASS: LF gegenüber RC25 exakt 0 Änderungen
PASS: RC31-Tag b21f7a8b auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: Vorschadenangabe oder bloße Lawinennennung beweist Deckung
```

## 62. RC32: Haftpflichtsummen aus kompakten Produktübersichten

WEVIG nennt im Haftpflichtkapitel eine eigenständige
`Pauschalversicherungssumme` von EUR 3 Mio. und eine ausdrücklich
mitversicherte Bauherrenhaftpflicht bis EUR 1 Mio. Gesamtbaukosten. Beide
Zeilen blieben vollständig ungeklärt, weil die kompakten Produktformen im
HP-Recall fehlten.

RC32 erkennt diese Formen und trennt bei `HP-08` die fachlich gefragte
Gesamtbaukostengrenze vom separaten Haftpflicht-Sublimit. Spätere bloße
Pauschalsummen-Referenzen werden serverseitig verworfen.

```text
PASS: 93 Jest-Suites / 1079 Tests und Server-Lint
PASS: WEVIG-HP 34/34 Kandidaten, 63/63 Komponenten, 36/36 Zeilen
PASS: HP-01 UNGEKLÄRT -> BELEGT / Ja / EUR 3.000.000,00
PASS: HP-08 UNGEKLÄRT -> BELEGT / Ja / EUR 1.000.000
PASS: übrige 34 WEVIG-HP-Zeilen exakt identisch
PASS: LF-HP 61/61 Kandidaten, 63/63 Komponenten, 36/36 Zeilen
PASS: LF HP-08 bleibt BELEGT mit EUR 440.000 oder 20 % des Gebäudeneuwerts
PASS: übrige LF-Änderungen nur bedeutungsgleiche Qwen-Textvariation
PASS: RC32-Tag a39f90db auf Mac Studio installiert; beide Doctor-Läufe grün
NO CLAIM: Sublimit- oder Kostenreferenz beweist eine Pauschaldeckungssumme
```

## 63. RC33: Schadenservice und Ansprechpartner gemeinsam belegen

WEVIG `VB-36` blieb ungeklärt, obwohl ein lokaler Serviceblock eine
24-Stunden-Telefonnummer, telefonische Schadenmeldung sowie Beratung und
Hilfestellung ausdrücklich nennt. Die produktübliche Form
`telefonische Schadenmeldung` fehlte im VB-Recall.

RC33 bindet beide Rollen nur, wenn Schadenmanagement, Telefonnummer,
Rund-um-die-Uhr-Erreichbarkeit, Schadenmeldung und Unterstützungsleistung im
selben Kontext vorkommen. Ein gemeinsamer Ausdruck vermeidet unnötige
Synonym- und Quellenverdopplung.

```text
PASS: 93 Jest-Suites / 1085 Tests und Server-Lint
PASS: WEVIG-VB 22/22 Kandidaten, 52/52 Komponenten, 36/36 Zeilen
PASS: ausschließlich VB-36 UNGEKLÄRT -> BELEGT / Ja
PASS: übrige 35 WEVIG-VB-Zeilen exakt identisch
PASS: LF-VB 37/37 Kandidaten, 52/52 Komponenten, 36/36 Zeilen
PASS: LF gegenüber RC29 exakt 0 Änderungen
PASS: RC33-Tag 3ef0e950 auf Mac Studio installiert; beide Doctor-Läufe grün
PASS: RC33-WEVIG-Fullrun 320/320 Zeilen, 15 Verbesserungen, 0 Regressionen
PASS: RC33-LF-Fullrun 320/320 Zeilen, 17 Verbesserungen, 0 Regressionen
PASS: kumulativ 640/640 Zeilen und 32 Statusverbesserungen
NO CLAIM: allgemeine Telefonnummer oder Überschrift beweist Schadenabwicklung
```

## 64. V3.2.1-Vollvergleich und R1-Konzeptgruppen für unbekannte Wortlaute

Ein exakter WEVIG-Vollvergleich stellte den historischen monolithischen Pfad
`v3.2.1` dem kontrollierten `v3.3.0-rc.33`-Pfad gegenüber. Alle acht
Kategorien und 320 Tabellenzeilen wurden mit derselben PDF, demselben
Qwen-27B-Modell und derselben Retrievalkonfiguration ausgeführt. 221
Kernzeilen blieben gleich, 99 änderten sich. Die Änderungen enthalten sowohl
klare Scope-/Wertbindungsverbesserungen als auch echte Kandidatenverluste und
sind deshalb keine Qualitätsquote.

Als kleinster allgemeiner Fix ergänzt Commit `27cb643a` deklarative
lexikalische Konzeptgruppen. Sie erlauben Morphologie und Koordination in
einer begrenzten Originalspanne, bleiben aber ausschließlich Kandidaten. Für
LW wurden zunächst die bereits belegten Recall-Lücken aktiviert.

```text
PASS: vollständiger V3.2.1/RC33-WEVIG-Vergleich 320/320 Zeilen
PASS: R1-Unit-/Regressionstestbestand 93 Suites / 1088 Tests
PASS: UNIQA-LW-Mikroreferenz 8/8 Kandidatengruppen
PASS: UNIQA-Abwesenheitskontrollen 0/16 unerwünschte Kandidaten
PASS: WEVIG-LW auf Mac Studio / Qwen 3.8 27B 36/36 Zeilen
PASS: genau LW-09, LW-13, LW-14 und LW-27 gegenüber RC33 verbessert
PASS: übrige 32 WEVIG-LW-Kernzeilen unverändert
PASS: LW-31 bleibt offen; keine Gebäudesumme als Spartenmaximum
PASS: 4B und 27B liefern 36/36 identische Kernzeilen
NO-GO: reine Similarity-Schwelle oder bestehende breite Alias-Triage
NO CLAIM: 99 Prozent oder beliebige Polizzen fachlich bewiesen
```

Der vollständige Befund, die bekannten Recall-Lücken und die nächsten Gates
stehen in
`docs/V321_RC33_R1_GENERALISIERUNGSBEFUND_DE.md`.

## 65. V3.3.1: breites Chunking als evidenzgebundener Kandidatenfallback

Der V3.2.1/RC33-Vergleich zeigte gleichzeitig zwei Wahrheiten: Breite
`3000/250`-Chunks gewinnen unbekannte Wortlaute zurück, dürfen aber nicht wie
im alten monolithischen Pfad direkt Vertragsfakten oder globale
Negativbehauptungen erzeugen. V3.3.1 kombiniert deshalb nur den
Navigationsvorteil mit dem kontrollierten V3.3-Faktenpfad.

Dinghy rankt für eine weiterhin offene atomare Komponente höchstens drei
seitengebundene Chunks. Qwen darf je Ziel und Chunk nur einen exakten,
eindeutigen Originalspan auswählen. Serverprüfungen erzwingen Zielanker,
Dokumentoffset, Maximallänge und unveränderten Originaltext. Danach durchläuft
der Span die normale Rollen-, Scope- und Wirkungsprüfung. Der breite Chunk ist
zu keinem Zeitpunkt selbst Evidenz.

Die erste Aktivierung gilt nur für die zwei Komponenten von `HP-12`. Ein
anfangs erkannter Nachbareffekt auf `HP-25` entstand durch eine globale
Promptänderung. Die Hybridpräzisierung wurde deshalb in einen ausschließlich
für Hybridziele geladenen Zusatzprompt verschoben; der normale Systemprompt
ist wieder byteidentisch zur Basis.

```text
PASS: fokussierte Verträge 4 Suites / 79 Tests
PASS: Gesamtregression 94 Suites / 1.098 Tests unter Node 22.23.2
PASS: WEVIG / Qwen 3.8 27B 38/38 Triage-Kandidaten
PASS: WEVIG / Qwen 3.8 27B 63/63 Komponenten, 36/36 HP-Zeilen
PASS: ausschließlich HP-12 von Nein zu Ja korrigiert
PASS: übrige 35 HP-Zeilen einschließlich HP-25 exakt stabil
PASS: lokaler 4B-Lauf mit derselben beabsichtigten HP-12-Verbesserung
PASS: GRAWE und UNIQA jeweils 0 zugelassene Hybridkandidaten
NO CLAIM: vollständiges Fremdversicherer-Oracle oder 99 Prozent bewiesen
```

Der Releasevertrag steht in `docs/RELEASE_V3.3.1_DE.md`.

## 66. Persistenter Polizzenvergleich A/B als technischer MVP

Die bisher manuelle Trennung in Einzelläufe, Excel-Zusammenführung und einen
erneuten freien LLM-Vergleich ist als eigene Produktfunktion umgesetzt. Unter
dem Chat-Eingabefeld stehen zwei eindeutig getrennte Dokumentpakete A und B
mit jeweils bis zu neun PDFs. Rollen und Geltungsstatus bleiben je Dokument
erhalten; die PDFs liegen ausschließlich in einer privaten Vergleichsablage
und gelangen nicht in den Workspace-Index.

Ein persistenter Worker prüft vor der Analyse die SHA-256-Identität und führt
jedes Dokument einmal durch den bestehenden Acht-Kategorien-Evidenzpfad. Der
serverseitige Rollup erhält dokumentbezogene Fakten und Quellen. Mehrere Werte
führen zu `RANGFOLGE_PRÜFEN`, nicht automatisch zu `WIDERSPRÜCHLICH`. Nur
einseitige Evidenz führt ebenfalls nicht automatisch zu einem Vorteil. Das
Ergebnis bleibt deshalb ausdrücklich `TECHNICAL_RESULT_REVIEW_REQUIRED` und
wird in der UI sowie als XLSX mit acht Kategorieblättern angeboten.

```text
PASS: neue Prisma-Migration auf isolierter Mac-Studio-Datenbank
PASS: Server-Lint und Frontend-Lint
PASS: Frontend-Produktionsbuild
PASS: aktuelle gezielte Vergleichsverträge 4 Suites / 11 Tests
PASS: bestehende Gesamtregression 97 Suites / 1.108 Tests auf Mac Studio
PASS: echte LF-/WEVIG-Uploads mit Rollen- und Statuspersistenz
PASS: ungültige PDF wird mit 415 abgewiesen und vollständig bereinigt
PASS: Vergleichsuploads 2; Workspace-Index 0; Parserdokumente 0
PASS: UI-Sperre Vergleich -> normaler Chat-Upload
PASS: UI-Sperre normaler Chat-Anhang -> Paket A/B
PASS: LF und WEVIG jeweils 320/320 materialisierte Kategoriezeilen
PASS: gemeinsamer Rollup 8 Ansichten / 320 Zeilen / 132 Review-Fälle
PASS: Ergebnisverteilung 188 ohne beidseitigen Beleg / 66 nur A / 18 nur B /
      48 inhaltliche Unterschiede zur fachlichen Prüfung
PASS: EL-16 hält Wintergarten eingeschlossen und Vitrinen ausgeschlossen als
      getrennte Objektfakten; kein erfundener Widerspruch
PASS: Ergebnis enthält keine privaten Speicherpfade
PASS: XLSX 8/8 Blätter, 15 Spalten, erwartete Zeilenzahlen, ZIP-Integrität
PASS: Produktions-UI zeigt 8 Tabs, 320 Zeilen und aktiven Excel-Download
FAIL: Laufzeitbudget; zwei Dokumente sequenziell in 2:02:35 statt ca. 1 Stunde
OBSERVE: LF 86/320 und WEVIG 46/320 Zeilen `BELEGT`; WEVIG-WE 0/24. Ohne
         fachliches Oracle ist daraus weder Vollständigkeit noch Recall ableitbar.
NO CLAIM: Dokumentrang, Ersetzung, fachlicher Vorteil oder 99 Prozent bewiesen
```

Die technische Grenze und die verbleibenden MVP-Gates sind in
`docs/POLIZZENVERGLEICH_A_B_MVP_DE.md` festgeschrieben. Besonders wichtig:
die sequenzielle Verarbeitung skaliert bei bis zu 18 PDFs derzeit linear und
ist noch kein Beleg für das angestrebte Laufzeitbudget.

## 67. Vier falsche Rangfolge-Fälle aus dem ersten Zehn-Dokumente-Lauf

Der erste vollständige Vergleich eines LF-Dokuments gegen ein neunteiliges
WEVIG-Paket erzeugte vier `RANGFOLGE_PRÜFEN`-Fälle, die nicht alle echte
Dokumentrangfragen waren. Die Fehler lagen in zwei getrennten Schichten:

1. `VS-25` und `VB-14` verglichen Beträge nur als Anzeigetext. Dadurch galten
   EUR 5 Mio. mit unterschiedlicher Formatierung sowie 5 % des NBW und der
   exakt daraus berechnete Absolutbetrag als verschiedene Werte.
2. `LW-20` und `HP-36` verwendeten noch einen älteren Runtime-Commit. Dort
   wurde ein Sturm-Ausschluss dem Leitungswasser zugerechnet und ein durch
   PDF-Zeilenumbruch geteilter Satz `nicht ... vorsätzlich` nicht als
   bedingter Ausschluss erkannt.

Die Korrektur ist nicht an Versicherer, Seitenzahl oder Kundenwortlaut
gebunden. Geldbeträge werden centgenau normalisiert; Zeitraum- und
Erstrisiko-Governors bleiben erhalten. Eine Prozent-/Absolutwert-Beziehung
wird nur bei gemeinsamer Klausel-ID, ausdrücklichem NBW-Bezug, genau einer
passenden Paketbasis und exakter Rechnung akzeptiert. Ein Seitentitel darf
nur dann Scope liefern, wenn kein Abschnittsscope vorhanden ist, genau eine
Versicherungssparte am Seitenanfang genannt wird und der Hinweis tatsächlich
`Versicherung` enthält. Der mehrzeilige Vorsatz-Binder ist eng begrenzt;
`exklusive` bleibt weiterhin auf den lokalen Listenpunkt beschränkt.

```text
PASS: 8 angrenzende Suites / 173 Tests auf dem Mac Studio
PASS: Gesamtregression 98 Suites / 1.130 Tests auf dem Mac Studio
PASS: Prettier-Prüfung der vier geänderten Code-/Testdateien
PASS: Original-Rollup VS-25 -> TEILBELEGT / Ja / EUR 1.530.400,00
PASS: Original-Rollup VB-14 -> BELEGT / Ja / EUR 5.000.000,00
PASS: Original-Occurrence LW-20 Sturm -> MENTION_ONLY
PASS: Original-Occurrence LW-20 Leitungswasser -> EXCLUDED
PASS: Original-Occurrence HP-36 -> EXCLUDED
OBSERVE: normaler Jest-Prozess bleibt wegen bestehendem asynchronem
         Model-Pricing-Logger offen; --forceExit beendet nach 1.130 PASS
BLOCKED: ESLint-9/react-plugin-Inkompatibilität der geteilten Test-Runtime;
         kein fachlicher oder dateispezifischer Lintfehler festgestellt
NO CLAIM: Der gespeicherte Modelllauf selbst wurde nicht nachträglich
          umgedeutet; eine neue End-to-End-Ausführung benötigt den neuen Build
NO CLAIM: keine 99-Prozent- oder Fremdversichererfreigabe
```

Die vier Fälle belegen allgemeine Verträge für Wertidentität, abgeleitete
Werte, Spartenscope und bedingte Ausschlüsse. Sie beweisen nicht, dass alle
weiteren Rang-, Ersetzungs- oder Geltungsbeziehungen eines beliebigen
Dokumentpakets automatisch aufgelöst werden können.

## 68. Regelgebundene Punktentscheidung „Wer ist warum besser?“

Der frühere A/B-MVP stellte Paket A und B technisch gegenüber, durfte aus
Anzeigetexten aber keinen fachlichen Vorteil ableiten. Ergebnisschema V2
ergänzt deshalb eine eigene reine Serverschicht. Sie liest pro
Kategoriezeile die bereits erzeugten atomaren Komponenten aus Worksheet,
Wirkungsmaterialisierung, Requested-Field-Fakten und servergebundenen
Quellen.

Der bestehende technische `outcome` bleibt unverändert. Additiv enthält jede
Zeile:

```json
{
  "pointDecision": {
    "outcome": "VORTEIL_A | VORTEIL_B | GLEICHWERTIG | NICHT_VERGLEICHBAR | UNKLAR",
    "reasonCode": "stabiler maschinenlesbarer Grund",
    "reason": "konkrete A-/B-Begründung mit Wirkung oder Wert",
    "reviewRequired": true,
    "ruleId": "versionierte Serverregel",
    "dimensions": []
  }
}
```

Freigegebene Regeln sind `INCLUDED_OVER_EXCLUDED_V1`,
`HIGHER_COVERAGE_LIMIT_V1`, `LOWER_DEDUCTIBLE_V1`,
`ATOMIC_COVERAGE_EQUALITY_V1` und `TYPED_VALUE_EQUALITY_V1`. Vor jeder
Regel liegen Gates für `BELEGT`, vollständige Requested Fields,
Konfliktfreiheit, aufgelöste Kandidaten, gültige servergebundene Quellen,
Component/Faktrolle, Dokumentgeltung, Scope, Variante, Werttyp, Einheit,
Limitart und Qualifier.

Fail-closed bleiben ein-/beidseitig fehlende Evidenz, `TEILBELEGT`,
`WIDERSPRÜCHLICH`, `RANGFOLGE_PRÜFEN`, Bedingungen/Optionen, unbekannte
Bewertungsrichtung, mehrere verschiedene Dokumentfakten und gemischte
Gewinner. Es gibt keinen Gesamtsieger und keine Gewichtung.

```text
PASS: fokussierte Entscheidung/Result/UI-Verträge 3 Suites / 21 Tests
PASS: Gesamtregression 90 Suites / 1.039 Tests auf Mac Studio / Node 18.18.0
PASS: Prettier der geänderten Code-/Testdateien
PASS: Frontend-Produktionsbuild
PASS: gespeicherter Zehn-Dokumente-Replay 320/320 Zeilen
PASS: 1 VORTEIL_B / 7 GLEICHWERTIG / 9 NICHT_VERGLEICHBAR / 303 UNKLAR
PASS: LW-22 B-Vorteil nur aus zwei gleichgerichteten atomaren Komponenten
PASS: alte Schema-V1-Ergebnisse werden in der UI fail-closed UNKLAR
PASS: XLSX behält Spalten A–O und ergänzt P–R; Markdown zeigt Status/Quellen
NO CLAIM: kein fachliches Oracle für alle 320 Zeilen
NO CLAIM: keine Rang-/Ersetzungsautomatik und kein Gesamtsieger
NO CLAIM: keine 99-Prozent- oder Fremdversichererfreigabe
```

Der Replay verwendete unverändert die gespeicherten Artefakte der Session
`5a8c6b3d-94fa-4ed9-84bc-4fff2cfa1e85`. Er beweist die neue
Entscheidungslogik, ersetzt aber nicht den noch ausstehenden frischen
Zehn-Dokumente-Lauf mit dem neuen Release Candidate.

## 68a. V3.4.0 RC2: frischer Zehn-Dokumente-Lauf und bedingungssichere Entscheidung

Der RC1-Lauf auf dem Mac Studio hat den vollständigen Produktweg mit einer
LF-Hauptpolizze gegen eine WEVIG-Hauptpolizze und acht Zusatz-/Bedingungs-
dokumente technisch abgeschlossen. Alle 10 Dokumente, 80 Dokument-Kategorie-
Schritte und 320 Vergleichszeilen wurden ohne Verarbeitungsfehler erzeugt.
Der Lauf benötigte ungefähr vier Stunden und überschreitet damit das
angestrebte Produktbudget deutlich.

Die Gegenprüfung der Punktentscheidungen zeigte am Beispiel `LW-22`, dass ein
kurzer Quellspan die direkt anschließende Rückausnahme verlieren kann. Ein
erster breiter Kontextschutz blockierte zusätzlich eine reine Blitzschlag-
Definition und war deshalb zu grob. RC2 bindet die Schutzprüfung an einen
lokalen 240-Zeichen-Radius um den servergebundenen Quellspan und trennt starke
Ausnahme-/Bedingungsmarker von einem definitorischen „wenn“.

```text
PASS: frischer RC1-Lauf 10/10 Dokumente, 80/80 Schritte, 320/320 Zeilen
PASS: fokussierte Verträge 2 Suites / 23 Tests
PASS: Gesamtregression 90 Suites / 1.043 Tests auf Mac Studio / Node 18.18.0
PASS: frischer RC2-Replay 320/320 Zeilen und 8 XLSX-Blätter A–R
PASS: 0 VORTEIL_A / 0 VORTEIL_B / 4 GLEICHWERTIG /
      11 NICHT_VERGLEICHBAR / 305 UNKLAR
PASS: genau LW-22, ST-16 und HP-26 werden aus unsicherer Gleichwertigkeit
      fail-closed UNKLAR; FE-A04 bleibt korrekt GLEICHWERTIG
PASS: älterer Replay verliert den früheren unsicheren LW-22-VORTEIL_B
NO CLAIM: fachliche Richtigkeit aller 320 Zeilen oder beliebige Polizzen
NO CLAIM: Laufzeitbudget; gemessener Vollaufwand derzeit ungefähr vier Stunden
```

Die Punktentscheidung ist damit als konservative fachliche Sicherheitsschicht
technisch belegt. Ein `UNKLAR` ist hier kein fehlender Produktwert, sondern
verhindert einen nicht beweisbaren Gewinner. Für mehr entscheidbare Punkte
müssen Bedingungsscope, Dokumentrang und Werte fachlich atomar aufgelöst
werden; sichtbare Zeilentexte dürfen diese Arbeit nicht ersetzen.

## 69. V3.5.0: produktiver Wechsel auf Qwen 3.6 35B-A3B

Der produktive LM-Studio-Vertrag verwendet ab V3.5.0 ausschließlich
`qwen/qwen3.6-35b-a3b`. Der Mac-Startpfad entlädt andere Chat- und
Embeddingmodelle, erstellt ohne Gewichtsduplikation eine text-only MLX-Ansicht
und lädt sie mit 42.496 Token Kontext, Parallelität 1, 8-Bit-KV-Cache,
deaktiviertem MTP-Draft und standardmäßig ausgeschaltetem Thinking. Die
Serverkonfiguration und alle aktiven Vergleichsrunner verwenden denselben
Identifier und dasselbe Tokenlimit.

Die Modellentscheidung beruht auf einem kontrollierten VS-Vergleich mit
identischen LF-/WEVIG-Worksheets, Systemprompts und Payload-Hashes:

```text
Qwen 3.6: 219,324 s / 3:39,3 Modellstufen-Wandzeit
Qwen 3.8: 1.101,400 s / 18:21,4 Modellstufen-Wandzeit
ERGEBNIS: Qwen 3.6 ist 5,02x so schnell und benötigt 80,1 % weniger Zeit
QUALITÄTSGATE: Qwen 3.6 72/72 VS-Kernzeilen gegen akzeptierte RC33-Basis
FRISCHER DIREKTVERGLEICH: 71/72 Kernzeilen identisch
WEVIG: 36/36 Kernzeilen identisch
LF VS-21: Qwen 3.6 korrekt; frischer Qwen-3.8-Lauf verfehlte die Seite-5-Quelle
```

Dinghy wird nicht mehr automatisch geladen. Damit entfällt im produktiven
Acht-Kategorien-Runner auch der HP-12-Hybridfallback. Resume-Manifeste und
persistente Run-Verträge wechseln auf Schema Version 2, damit frühere
Embeddingläufe nicht still fortgesetzt werden.

```text
IMPLEMENTIERT: Qwen-3.6-Autoload 42.496 / parallel 1 / MLX-KV 8 Bit
IMPLEMENTIERT: Qwen-3.8- und Embedding-Autoload entfernt
IMPLEMENTIERT: produktiver HP-Hybridfallback entfernt
DOKUMENTIERT: VS-Speed- und Kernzeilenevidenz mit exakten Zahlen
NICHT AUSGEFÜHRT: Tests, Lint, Build, Doctor, Installer- und neue Modellläufe
OFFEN: vollständige Acht-Kategorien- und HP-12-Nichtregression
NO CLAIM: keine beliebigen Polizzen und kein 99-Prozent-Nachweis
```

Die ausgelassene Validierung ist eine ausdrückliche Sequenzentscheidung: In
diesem Schritt wurden nur Code, Versionierung und Dokumentation geändert. Die
Abnahme folgt separat auf dem Mac Studio.

## 70. Qualifiziertes „im bereitgestellten Paket nicht gefunden“

Die Vergleichsschicht unterscheidet ab Ergebnisschema V3 drei unabhängige
Achsen: Vertragswirkung, Suchbefund und Vergleichsannahme. Ein vollständiger
Negativbefund wird nicht als `EXCLUDED` gespeichert. Er bleibt
`coverageEffect: UNKNOWN`, erhält aber
`searchDisposition: NOT_FOUND_AFTER_COMPLETE_SEARCH` und darf für einen
ausdrücklich freigegebenen Punkt als `ASSUMED_NOT_INCLUDED_V1` gewertet
werden.

Die Aktivierung ist fail-closed und zunächst auf `VS-16` begrenzt. Erforderlich
sind vollständige Verarbeitung aller Paketdokumente, Text auf jeder physischen
PDF-Seite, vollständig bestandene technische Kategorie-Gates, vollständige
Worksheet-/Target-/Judgement-Parität und pro Komponente null Occurrences,
Kandidaten, Rejects und ungelöste Candidate-IDs. Alte Artefakte und gemischte
PDFs mit textlosen Bildseiten bleiben `SEARCH_INCOMPLETE`.

`VS-16` verwendet den Katalogvertrag `vs-occurrence-full-draft-v0.3`,
`componentSatisfactionPolicy: ANY` und kontrollierte getrennte Komponenten für
Garage, Tiefgarage, Stell-/Parkplatz, Parkdeck und Carport. Exakte Wortgrenzen
verhindern Nachbartreffer wie Garagentor, Garagenhaftpflicht, Garagengasse und
Parkverbot.

Neue Punktregeln:

```text
ausdrücklich INCLUDED gegen qualifiziert nicht gefunden
  -> VORTEIL_A/B
  -> INCLUDED_OVER_ASSUMED_NOT_INCLUDED_V1

beidseitig qualifiziert nicht gefunden
  -> KEIN_DOKUMENTIERTER_VORTEIL
  -> COMPLETE_SEARCH_ABSENCE_BOTH_V1
```

Die Nutzerbegründung sagt stets, dass nur im vollständig geprüften
bereitgestellten Paket nichts gefunden wurde und dass kein ausdrücklicher
Ausschluss belegt ist. XLSX ergänzt die Dokumentbefunde additiv in S/T; alte
Ergebnisse bleiben ohne Rückinterpretation `UNKLAR`.

Mac-Studio-Abnahme des exakten Commits `a4e286d6395de9c921098d2883f72d4e13391f90`
im isolierten Worktree `/tmp/pv3-validate-a4e286d6`:

```text
PASS: 11 relevante Jest-Suites / 189 Tests
PASS: Prettier für alle 12 geänderten Produkt-, Test- und Promptdateien
PASS: ESLint für geänderte Serverquellen und PolicyComparisonPanel
PASS: Frontend-Produktionsbuild, Vite 4.5.3, 6.170 Module
HINWEIS: direkter ESLint-Aufruf auf der bestehenden .cjs-Presenterdatei meldet
         module/no-undef; die Datei wird per Jest geprüft und unverändert als
         CommonJS geladen
RUNTIME: Node v26.7.0 / npm 11.19.0
NO MODEL RUN: keine Kunden-PDFs und kein neuer LLM-Lauf in diesem Schritt
NO CLAIM: keine beliebigen Polizzen, kein OCR-Vollständigkeitsnachweis und
          kein 99-Prozent-Nachweis
```

## 71. Fünf-Kategorien-Profil und Einblatt-Kundenexport

Der produktive A/B-Lauf verwendet jetzt den versionierten Vertrag
`CUSTOMER_CORE_5_V2`. Er analysiert ausschließlich VS, FE, LW, ST und EL und
materialisiert damit 224 sichtbare Zeilen (36 + 80 + 36 + 36 + 36). HP, VB
und WE werden nicht gelöscht: Ihre Kataloge und historischen Tests bleiben als
interne Evidenz erhalten, sie werden jedoch weder gestartet noch in neue
Kundenergebnisse gerollt. Queue-, Worker-, QA- und Resume-Manifeste tragen das
Profil explizit und lehnen alte oder abweichende Laufkontexte fail-closed ab.

Der Excel-Download folgt dem manuell freigegebenen `Gesamtvergleich`-Vertrag:
ein Arbeitsblatt, 17 Spalten, Aptos Narrow 12, Referenzbreiten, weißer
Hintergrund, 80 Prozent Zoom, vollständiger Autofilter und Sortierung nach
Stufe K/S/V sowie danach Kategorie und Katalogreihenfolge. Kategorie-ID,
Stufe und Name werden für Polizze A und B sichtbar wiederholt.

`KI-Ergebnis` wird ausschließlich aus der servereigenen `pointDecision`
erzeugt. Die Präsentationsschicht kennt sechs Kundensignale: Vorteil Polizze A,
Vorteil Polizze B, gleichwertig, Dokumentationsunterschied, nicht vergleichbar
und ungeklärt. Unbekannte,
unvollständige oder inkonsistente Regeln werden immer zu ungeklärt
herabgestuft. Insbesondere bleibt beim qualifizierten Negativbefund sichtbar,
dass kein ausdrücklicher Ausschluss belegt ist. Technische Outcomes, Regeln,
Blocker und Suchaudits bleiben vollständig in `comparison.private.json` und
werden nicht als zusätzliche Kundenspalten ausgegeben.

```text
IMPLEMENTIERT: kanonisches Profil VS/FE/LW/ST/EL mit 224 Sollzeilen
IMPLEMENTIERT: neue Runs und Resume-Verträge profilgebunden
IMPLEMENTIERT: ein XLSX-Blatt mit 17 freigegebenen Kundenspalten
IMPLEMENTIERT: deterministisches, fail-closed KI-Ergebnis
KOMPATIBILITÄT: gespeicherte alte Acht-Kategorien-Ergebnisse bleiben lesbar
PASS: 8 fokussierte Suites / 58 Tests auf dem Mac Studio
PASS: Prettier für alle geänderten Code-, Test- und Dokumentdateien
PASS: ESLint der geänderten Produktquellen und UI ohne Fehler; fünf
      Testdateien werden von der bestehenden ESLint-Konfiguration ignoriert
PASS: Bash-Syntaxvertrag und Frontend-Produktionsbuild mit 6.170 Modulen
PASS: synthetischer Voll-Export 1 Blatt / 17 Spalten / 224 Datenzeilen
PASS: VS 36 / FE 80 / LW 36 / ST 36 / EL 36, Filter A1:Q225, Zoom 80
PASS: Quick-Look-Sichtprüfung ohne Spaltenüberlappung oder Zellgrenzfehler
NO MODEL RUN: diese Änderung benötigt keinen neuen LLM- oder Kunden-PDF-Lauf
NO CLAIM: keine fachliche 224-Zeilen-Abnahme und kein 99-Prozent-Nachweis
```

Die Abnahme lief auf dem Mac Studio unter Node `v22.23.2` im isolierten
Verzeichnis `/tmp/pv3-validate-d771e47f` für Commit
`d771e47fcad6e2e61d1552711d91aae0024def03`. Der installierte Kunden-Checkout
`/Users/michaelmischkot/Code/polizzenvergleich-v3` blieb auf seinem stabilen
Stand und wurde nicht verändert. Der visuelle Voll-Export verwendete nur die
bereits vorhandenen Tabellenwerte als synthetische Layout-Fixture; er ist kein
neuer fachlicher Modelllauf.

## 72. Allgemeines Prinzip für kontrolliertes Nichtfinden

Das produktive Profil `CUSTOMER_CORE_5_V2` trennt ab Ergebnisschema V5 den
technischen Nulltreffer strikt von seiner fachlichen Vergleichswirkung. Alle
224 Zeilen besitzen einen expliziten `negativeSearchPolicy` und eine
`absenceMeaning`. Die acht gegenseitig ausschließenden Bedeutungsgruppen sind:

```text
COVERAGE_ONLY       90
COVERAGE_MIXED      25
COST_COVERAGE       24
EXCLUSION           14
VALUE_TERM          16
CONDITION_ONLY      44
DEFINITION_ONLY     10
DOCUMENT_REFERENCE   1
```

Ein technisch vollständig abgeschlossener Nulltreffer eines noch nicht
fachlich zertifizierten Suchplans wird als
`NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH` mit
`DOCUMENTATION_ONLY_V1` ausgegeben. Gegen belegten Inhalt auf der anderen
Seite entsteht die neutrale Punktentscheidung
`DOKUMENTATIONSUNTERSCHIED` nach
`QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1`. Insbesondere bedeuten ein
nicht gefundenes Limit nicht unbegrenzte Deckung, ein nicht gefundener
Selbstbehalt nicht null Euro und ein nicht gefundener Ausschluss keinen
automatischen Vorteil.

Die stärkere Stufe `NOT_FOUND_AFTER_COMPLETE_SEARCH` mit
`ASSUMED_NOT_INCLUDED_V1` bleibt ein eigener Zertifizierungsvertrag für
positive Schutzpositionen. `VS-16` ist weiterhin der erste und derzeit einzige
zertifizierte Vertrag. Ein Punktvorteil verlangt zusätzlich einen aktiven,
vollständig belegten, unbedingten Einschluss; `CONDITIONAL`, `PROPOSED_ONLY`
und `UNKNOWN` sind dafür gesperrt.

Die vorhandenen 1.326 Aliase in 381 Komponenten sind Suchkandidaten und kein
pauschaler Beweis vollständiger Synonymabdeckung. Weitere automatische
Schutzannahmen werden deshalb nur zeilenweise nach Alias-/Konzeptprüfung,
Negativnachbarn und adversarialen Varianten freigegeben. Vollständige
Dokumentverarbeitung, Text auf jeder physischen Seite, technische
Worksheet-/Target-/Judgement-Parität und null offene Kandidaten bleiben für
beide Nulltrefferstufen zwingend. Alte Ergebnisse werden nicht rückwirkend
umgedeutet; das versionierte Profil und die Katalog-IDs sperren unsichere
Resumes.

```text
IMPLEMENTIERT: zwei getrennte Achsen für Suchbefund und Vergleichswirkung
IMPLEMENTIERT: explizite Abwesenheitssemantik für 224/224 Produktzeilen
IMPLEMENTIERT: neutrales Kundensignal Dokumentationsunterschied
IMPLEMENTIERT: ACTIVE-Gate vor Einschluss-gegen-Nichtfinden-Vorteil
KATALOGE: VS v0.4; FE/LW/ST/EL v0.2; Worksheet-Schema V2
ERGEBNIS: comparison.private.json V5; pointDecision V3
NO CLAIM: keine fachliche Zertifizierung aller 224 Negativlexika
NO CLAIM: keine beliebigen Polizzen und kein 99-Prozent-Nachweis
```

Mac-Studio-Abnahme des exakten Code-Commits
`e3cdaecd744626cbeca4cc5054bfaa157e162e05` im isolierten Worktree
`/tmp/pv3-validate-ff95d896`:

```text
PASS: 14 relevante Jest-Suites / 164 Tests
PASS: Prettier für alle geänderten Produkt-, Test- und Dokumentdateien
PASS: ESLint der fünf geänderten Serverquellen
PASS: ESLint der geänderten JSX-Oberfläche
PASS: Frontend-Produktionsbuild / Vite 4.5.3 / 6.170 Module
FULL JEST: 103/105 Suites und 1.173/1.178 Tests bestanden
BASELINE OFFEN: historischer VS-Legacy-Shelltest verlangt weiterhin das in
                V3.5.0 bewusst entfernte Embeddingmodell
UMGEBUNG OFFEN: isolierter FFMPEG-Test findet ohne Binärpfad kein ffmpeg
HINWEIS: direkter ESLint-Aufruf auf dem bestehenden CommonJS-Presenter meldet
         weiterhin module/no-undef; Jest und Prettier für die Datei bestehen
NO MODEL RUN: keine Kunden-PDFs und kein neuer LLM-Lauf
NO CLAIM: keine fachliche Zertifizierung aller 224 Negativlexika
```

## 73. Erster Qwen-3.6-Fünf-Kategorien-Vollvergleich und Recall-Audit

Der aktuelle Entwicklungsstand `343a665e3ffb3462fdcef5852a28ccddb64ffd1f`
wurde am 31. August 2026 in einer vom installierten Kundenstand getrennten
Mac-Studio-Instanz ausgeführt. Qwen 3.6 war als einziges Modell mit exakt
42.496 Token Kontext und Parallelität 1 geladen. Der Lauf verarbeitete die
LF-Hauptpolizze gegen das neunteilige WEVIG-Paket mit den ausdrücklich
gesetzten Rollen und Geltungsstati.

```text
PASS: 10/10 Dokumente, 108/108 Seiten mit Text
PASS: 50/50 Dokument-Kategorie-Schritte, 0 Resume-Schritte
PASS: 224/224 Ergebniszeilen, CUSTOMER_CORE_5_V2
PASS: 1.621,550 s / 27:01,550 Gesamtwandzeit
PASS: Excel 1 Blatt / 17 Spalten / 224 Datenzeilen
PASS: 416/416 ausgegebene PDF-Zitate auf behaupteter Seite exakt vorhanden
PASS: 0 Vorteile A/B; 5 Gleichwertigkeiten; 11 nicht vergleichbar
FAIL: kontrollierte Nullsuche übersieht mehrere exakte relevante Klauseln
FAIL: LW-08 übernimmt Ausschlussscope über eine neue Überschrift hinweg
NO GO: keine ungeprüfte Kundenfreigabe dieses fachlichen Ergebnisses
```

Der faire gemeinsame Fünf-Kategorien-Zeitvergleich aus persistenten
Dokumentartefakten beträgt 8.206,345 Sekunden für den historischen
Qwen-3.8-Lauf und 1.617,626 Sekunden für Qwen 3.6. Das entspricht 5,073x und
80,29 Prozent weniger Zeit, ist wegen zusätzlicher Katalog-/Codeänderungen
aber kein isolierter Modellbenchmark.

Bestätigte Gegenstellen zu Nullbefunden betreffen unter anderem allgemeine
Entschädigungsgrenzen, Schäden durch unbekannte Fahrzeuge, Luftfahrzeugteile
und -ladung, Sprinklerbetätigung, Kanalrückstau, Sturmdefinition, Dachlawine,
geworfene Gegenstände, Baumentsorgung, Photovoltaik, Lösch-/Abbruchschäden,
Zwischenlagerung und HQ30. Der systemische Vertrag ist daher nachzuschärfen:
Alias-/Konzeptbreite, Klausel- und Heading-Grenzen, paketweite allgemeine
Vertragsregeln sowie Rangbindung mehrerer Werte. Dokumentseiten dienen nur als
Regressionsevidenz und dürfen nicht als Produktionssonderregeln eingebaut
werden.

Zusätzliche Routingbefunde: `VS-16` verliert beim B-Beleg die 10-Prozent-
Grenze, erweitert `überdachte Abstellplätze` zu Kfz-Stell-/Parkplätzen und
wird trotz `componentSatisfactionPolicy: ANY` von der Punktentscheidung wie
ein ALL-Vertrag behandelt. `LW-08` leidet sowohl unter einem über die
Überschrift laufenden Ausschlussscope als auch unter einer falschen
Triagepriorität: Der einschlägige GenVerbund-Beleg mit EUR 2.000 wird
verworfen, ein enger Erdkabelbeleg bevorzugt. `EL-07` entscheidet sicher,
übernimmt aber vorhandene Limits und Selbstbehalte nicht in die Kundenzeile.

Der Worker archiviert den fertigen Kundenexport ab dem Entwicklungscommit
`7ab999c6` vor `COMPLETED` atomar im konfigurierten Vergleichsordner. Der
Auditexport liegt als eindeutig benannte Datei unter
`/Users/michaelmischkot/Downloads/Projekt Lokale KI/Vergleiche`. Der
installierte Kunden-Checkout blieb unverändert; die Dauerfunktion wird dort
erst mit einer ausdrücklich autorisierten Bereitstellung aktiv.

Vollständiger Prüfbericht:
`docs/VOLLLAUF_AUDIT_QWEN36_2026-08-31_DE.md`.

## 74. V3.5.1: technisches Deployment mit vollständiger Rückfallsicherung

Der Entwicklungsstand wurde vor dem Deployment mit dem abweichenden
`origin/main` zusammengeführt. Dadurch bleiben die V3.4.0-RC2-Korrekturen für
lokale Bedingungs- und Rückausnahmescopes erhalten. Der kombinierte Stand
wurde als neuer, annotierter und vorwärts gerichteter Patchrelease
`v3.5.1` veröffentlicht; der unveränderliche Tag `v3.5.0` wurde nicht bewegt.

Vor der Aktivierung entstand bei gestoppten Diensten eine externe Kopie von
Storage, Environmentdateien, LaunchAgents und Vergleichsexporten unter:

```text
/Users/michaelmischkot/Polizzenvergleich-Backups/
pre-v3.5.1-20260831-093731
```

```text
RELEASE: v3.5.1
COMMIT: ca2add77ddee4b21099f24983774dc8b35b046d7
VORHER: v3.4.0 / 977ed40f735762132aec5aa5cfd91a46c2c2efcf
PASS: macOS-Installervertrag
PASS: 7 fokussierte Suites / 65 Tests
PASS: Bash-Syntax und Prettier der relevanten Dateien
PASS: isolierter Frontend-Build / 6.170 Module
PASS: Update-Build / 6.181 Module
PASS: 41 Prisma-Migrationen / keine offene Migration
PASS: integrierter und separater Doctor
PASS: aktuelle und gesicherte SQLite-Datenbank quick_check = ok
PASS: Bestandszahlen vor/nach Update identisch
PASS: vorhandene Exporte und private Vergleichsartefakte unverändert
PASS: nur Qwen 3.6 / 42.496 Kontext / parallel 1 geladen
PASS: Server und Collector laufen ausschließlich auf Loopback
```

Der produktive `server/.env` enthält jetzt den dauerhaften Exportpfad
`/Users/michaelmischkot/Downloads/Projekt Lokale KI/Vergleiche`. Damit wird
jede nach `COMPLETED` terminierende neue Arbeitsmappe vor Abschluss atomar und
eindeutig benannt dort archiviert.

Das Deployment ist eine technische Bereitstellung für weitere Tests. Es hebt
das fachliche `NO GO` aus Abschnitt 73 nicht auf: Die bestätigten
Nulltreffer-, Heading-, `ANY`-Aggregations-, Objekt-/Limit- und
Rollen-/Statusfehler bleiben offen und Ergebnisse benötigen fachlichen Review.

## 75. Interner HP-25-Katalogvertrag v0.2

Der interne HP-Katalog wurde für den räumlichen Geltungsbereich von v0.1 auf
v0.2 versioniert. Der reale Satztyp `weltweit eingetretene
Schadenereignisse` und wiederverwendbare Umstellungen beziehungsweise
Flexionen binden nun dieselbe servereigene Fundstelle an beide fachlich
erforderlichen Komponenten von HP-25:

```text
territorial_scope  -> CONDITION für den angeforderten Geltungsbereich
foreign_coverage   -> BENEFIT für die eigentliche Deckungswirkung
```

Ein `SHARED_SPAN`-Vertrag verlangt dieselbe Kandidatenbindung. Die
Deckungsaggregation verwendet `COVERAGE_ROLES_ONLY`, während die
Vollständigkeit weiterhin beide Komponenten benötigt. Exakte Varianten und
eine enge Konzeptsuche aus `weltweit` plus Schadenereignis beziehungsweise
Versicherungsfall decken bekannte Wortlaute, Umstellungen, Flexionen und eine
typische OCR-Trennung ab. Bloße weltweite Erwähnungen oder isolierte
Schadenereignisse bleiben ohne Kandidat; ein semantisch passender bloßer
Hinweis wird durch `MENTION_ONLY` downstream zu keiner Deckung.

Der alte Katalogname und die alte Katalog-ID wurden entfernt. Der nicht aktive
HP-Zweig des QA-Resolvers verweist auf v0.2, ohne HP dem produktiven Profil
hinzuzufügen. `CUSTOMER_CORE_5_V2` bleibt unverändert bei VS, FE, LW, ST und EL
mit 224 Zeilen.

Mac-Studio-Abnahme des exakten Code-Commits
`5457309cb5531c001d3fa1705f33b11042928db9` im isolierten Repository
`/tmp/pv3-hp25-5457309c`:

```text
PASS: 9 relevante Jest-Suites / 221 Tests
PASS: Konzept-, exakte Positiv-, OCR-, Negativ- und Downstream-Verträge
PASS: positiver Einschluss -> Ja/BELEGT mit servergebundener Quelle
PASS: ausdrücklicher Ausschluss -> Nein/BELEGT mit servergebundener Quelle
PASS: MENTION_ONLY -> Nicht feststellbar/UNGEKLÄRT
PASS: aktives Produktprofil bleibt VS/FE/LW/ST/EL mit 224 Zeilen
PASS: Prettier der geänderten Code-, Katalog-, Test- und Kurztrackerdateien
PASS: Bash-Syntax des All-Kategorien-Runners
PASS: ESLint der geänderten Tests ohne Fehler; Tests sind durch die bestehende
      Konfiguration ignoriert und werden über Jest ausgeführt
FULL JEST: 105/107 Suites und 1.193/1.198 Tests bestanden
BASELINE OFFEN: VS-Legacy-Shelltest erwartet weiterhin das in V3.5.0
                entfernte automatische Embeddingmodell
UMGEBUNG OFFEN: isolierter FFMPEG-Test findet ohne Binärpfad kein ffmpeg
NO MODEL RUN: keine Kunden-PDFs und kein LLM-Lauf
NO DEPLOY: installierter Kundenstand v3.5.1 / ca2add77 blieb unverändert
NO CLAIM: kein unbekannter HP-Holdout und kein allgemeiner Qualitätsnachweis
```

## 76. Dreiphasiger Recall-, Shadow- und Zertifizierungsvertrag

Der Primärpfad wurde in sechs getrennten Themencommits um allgemeine
Konzeptfamilien, semantischen Heading-Reset, rollenrichtige lokale
Wertebindung, flektierte Suchstämme, klausellokale Erdbebenwerte und eine
neutrale `VS-16`-Wirkung erweitert. Produktive automatische
`COVERAGE_ONLY`-Annahmen benötigen nun eine zeilenweise Registryfreigabe; die
Registry ist leer, daher ist aktuell keine Zeile zertifiziert.

Ein neuer Hybridweg ist ausschließlich als separater, manueller
Shadow-QA-Lauf implementiert. Er ist nicht mit Kundenworker, Primärrunner,
Resume oder Ergebnisbildung verbunden. Breite Chunks navigieren nur;
servereigene exakte Spannen durchlaufen anschließend den normalen Triage- und
Evidenzvertrag. Manifest-, Release-, Modell-, Runtime-, Dokumentstatus- und
Artefakt-Hashes verhindern fremde oder stale Kombinationen. Recall und FPR
werden erst nach reviewer- und oraclegebundener Kennzeichnung berechnet.

Vollständige Implementierungsdokumentation:
`docs/DREIPHASEN_RECALL_SHADOW_ZERTIFIZIERUNG_2026-08-31_DE.md`.

```text
IMPLEMENTIERT: Phase A, isolierter Phase-B-Shadowweg, Phase-C-Gates
MAC-STUDIO TECHNISCH: e86cb782 mit 109/109 Suites, 1.255/1.255 Tests,
                      vollständigem Lint und Frontend-Build
MAC-STUDIO MODELL: e86cb782, Qwen 3.6, zehn LF-/WEVIG-Dokumente,
                   2.240/2.240 Dokumentzeilen; REVIEW_REQUIRED
NICHT ZERTIFIZIERT: alle COVERAGE_ONLY-Zeilen; Registry ist leer
NO DEPLOY: installierter Kundenstand blieb unverändert
NO CLAIM: keine fachliche Freigabe, kein Holdout- oder 99-Prozent-Nachweis
```

## 77. Forward-Fixes nach dem ersten V7-Paketlauf

Der erste frische V7-Lauf auf dem Mac Studio hat neben bestätigten
Recall-Verbesserungen weitere systematische Abweichungen sichtbar gemacht.
Diese wurden thematisch getrennt korrigiert:

- explizite Triage-, Feldextraktions- und Worksheet-Rückgaben;
- weiche PDF-Zeilenumbrüche bei Limit-Qualifiern;
- Klauselzitate statt reiner Deckungsüberschriften;
- enger Objekt-, Baum-/Ast- und Entsorgungsscope;
- strukturierte B2/B3/B4-Spartenüberschriften und Kosten-Heading-Reset;
- Kompositum `Kanalrückstau` und lokaler LW/ST-Scope;
- explizite zonenbedingte Hochwasserfolgen einschließlich Limits.

Alle Themencommits wurden mit fokussierten Jest-Verträgen und vollständigem
Repository-Lint auf dem Mac Studio geprüft. Vor Abschluss dieser Fixserie war
der vollständige technische Stand bei 109/109 Suites und 1.258/1.258 Tests
sowie erfolgreichem Frontend-Build. Die exakte End-SHA wird nach diesem
Dokumentationscommit erneut vollständig technisch und dokumentbezogen
validiert.

Offen bleibt `FE-D03`: Die generische AFB-Klausel zu Schäden durch Löschen,
Niederreißen oder Ausräumen darf nicht durch ein einfaches `ANY` so behandelt
werden, als wären Wasser, Schaum und Pulver jeweils belegt. Dafür ist ein
versionierter alternativer Satisfaction-Ausdruck erforderlich. Shadow bleibt
wegen des deaktivierten Embeddingvertrags gesperrt; Zertifizierungsregistry
und unbekannter Holdout bleiben leer beziehungsweise nicht vorhanden.

## 78. Selbstvalidierende Kundenreview-Metrik

Ein V7-Laufergebnis wies gleichzeitig einen historischen technischen
Differenzzähler von 105 und 67 tatsächlich unklare Punktentscheidungen aus.
Der technische Zähler war im Markdown fälschlich als fachlich zu prüfende
Unterschiede benannt und durfte nicht als Kundenreviewzahl verwendet werden.

Ab Ergebnisschema V6 gilt `CUSTOMER_COMPARISON_METRICS_V2`.
`customerReviewRequired` wird ausschließlich aus den eindeutigen Zeilen mit
`pointDecision.outcome == UNKLAR` abgeleitet. Der unpräzise V5-Schlüssel
`reviewRequired` wird nicht fortgeführt. Alte Ergebnisse werden aus ihren
Einzelzeilen nachgezählt; fehlende Punktentscheidungen bleiben fail-closed
kundenprüfpflichtig.

Worker, Ergebnisendpunkt und XLSX-Download validieren neue Ergebnisse vor
Weitergabe. Doppelte Zeilen, unbekannte fachliche oder technische Outcomes,
widersprüchliche Reviewflags, fehlende Blockiergründe und manipulierte Aggregate
oder Gruppenmitgliedschaften stoppen fail-closed. Alte API-Antworten entfernen
den mehrdeutigen Zähler und liefern eine getrennte normalisierte Kundenmetrik.
Die Oberfläche zählt Zeilen, alle sieben Outcomes und Reviewgründe unabhängig
neu und warnt bei einer gespeicherten Abweichung.
Beidseitig nicht gefundene passende Vertragsregelungen werden verständlich
benannt und nicht mehr als ungeklärt formuliert.

Der neutrale Materialisierungsstatus lautet ab V6
`COMPARISON_RESULT_MATERIALIZED`. Historische Trackerabschnitte mit
`TECHNICAL_RESULT_REVIEW_REQUIRED` beschreiben ausschließlich ältere
Ergebnisschemata.

Vollständiger Prüfbericht:
`docs/KUNDENMETRIK_VALIDIERUNG_2026-09-01_DE.md`.

```text
IMPLEMENTIERT: zeilenbasierte Kundenmetrik, unabhängige Neuberechnung,
               Worker-/API-/Download-Gate, UI-Recount und Legacy-Adapter
PASS: Real-Artefakt-Replay 224/224 und Kundenreview 67
PASS: 5 fokussierte Suites / 55 Tests auf 66aabfe4
PASS: Blockiergrund- und Outcomezähler mit eindeutigen Zeilenmitgliedschaften
PASS: Server-/UI-Parität im Replay des echten 224-Zeilen-Artefakts
PASS: Prettier und Frontend-ESLint der geänderten Produktquellen
PASS: Frontend-Build / 6.170 Module
BASELINE-PARITÄT: auf Baseline und neuem Stand dieselben 20 Fehlsuites
                  und 3 Fehltests; neuer Stand ergänzt 1 grüne Suite
                  und 16 grüne Tests
BLOCKED: Server-ESLint bricht bereits auf unverändertem Baselinecode wegen
         ESLint-9-/React-Plugin-Inkompatibilität ab
NO MODEL RUN: bestehendes Vergleichsartefakt nur deterministisch neu aggregiert
NO DEPLOY: installierter Kundenstand unverändert
NO CLAIM: keine fachliche Vorteilskorrektur in diesem Inkrement
```

## 79. Paket-first-Nachfolgevertrag V8

Am 2. September 2026 wurde die fachliche Bedeutung von Paket A und Paket B
präzisiert. Die Upload-Zuordnung des Benutzers definiert zwei
gleichberechtigte Gebäudeversicherungspakete. Aus der bloßen
Dokumentklassifikation abgeleitete Stati sind Herkunftsmetadaten und dürfen
einen inhaltlich passenden Vergleich nicht allein sperren. Inhaltlich belegte
Optionalität oder Bedingung sowie Wirkung, Wert, Scope, Variante, Version,
Widerspruch und Ersetzung bleiben unverändert entscheidungsrelevant.

Ausgangsbasis ist der Favoritenlauf `CANDIDATE-FE-A06-FA780902-20260901-223450`
auf Commit `fa78090269a23e0f45223546fc9b57f10e78f843` mit 224 Zeilen, 26:47
Wandzeit und den Kundenmetriken `0/0/38/6/99/14/67`. Der lokale
Implementierungsstart ist Commit `00d4d2ad56ab4361f20d754643c77813dada8e79`.
Eine datenbasierte Prüfung des Favoritenartefakts ergab:

- alle 99 Zeilen `KEIN_DOKUMENTIERTER_VORTEIL` sind beidseitig qualifizierte,
  vollständige Nulltreffer; je Zeile stimmen der A/B-Requirement- und
  Suchvertrag überein;
- von 38 Dokumentationsunterschieden besitzen 17 genau eine im Artefakt als
  `BELEGT`, `coverage=Ja` geführte Fundseite und eine qualifiziert fundlose
  Gegenseite. Davon sind zunächst nur 9 reine `COVERAGE_ONLY`-Positionen
  mechanische Kandidaten: 7 für A und 2 für B;
- die übrigen 8 dieser 17 sind 4 `COVERAGE_MIXED`- und 4
  `VALUE_TERM`-Positionen und benötigen eigene Richtungsverträge;
- 4 vollständige Ausschlüsse, 1 gemischter Fall und 16 Teilbelege dürfen
  nicht in diesen positiven Pfad gelangen;
- die 67 Kundenreviewzeilen bleiben eine eigenständige Ursachenmenge. Sie
  dürfen nicht zusammen mit den 99 beidseitigen Nulltreffern als
  Kundenreviewzahl ausgegeben werden; eine Addition ist nur für eine
  ausdrücklich benannte Union der disjunkten Mengen zulässig.

Geplante, getrennt zu commitende Inkremente:

1. `PAV8-01`: semantische Schutzmarker für Warte-/Karenzbedingungen sowie
   bestimmungsgemäße gegenüber bestimmungswidriger Ereignisvariante;
2. `PAV8-02`: aus der Dokumentklassifikation abgeleitete Stati als
   Vergleichsmetadatum behandeln und semantisch identische Beitragsfakten nur
   in der abgeleiteten Vergleichsdimension provenienzerhaltend gruppieren;
3. `PAV8-03a`: beidseitige qualifizierte Abwesenheit als
   Vergleichsgleichheit darstellen;
4. `PAV8-03b`: vollständigen positiven `COVERAGE_ONLY`-Einseitenfund gegenüber
   qualifizierter Abwesenheit als Vorteil entscheiden;
5. `PAV8-04+`: die verbleibenden Ausschluss-, Misch-, Teilbeleg-, Wert-,
   Selbstbehalt-, Bedingungs- und Definitionsfälle nur über eigene typisierte
   Richtungsverträge bearbeiten;
6. Discovery/Crosswalk getrennt von der festen Kundenansicht ausbauen; eine
   freie Strukturinventur darf die 224 Zeilen nicht ungeprüft ersetzen.

Sicherheitsgrenzen:

- `documentApplicability` darf nicht blind aus einem Vergleichsschlüssel
  entfernt werden; sonst gehen Quellen, Bedingungen und Varianten verloren;
- unbekannte bloße Dokumentart darf nicht sperren; unbekannte Klauselwirkung,
  unbekannter Scope oder inhaltlich belegte Optionalität bleiben fail-closed;
- unterschiedliche Werte oder semantische Inhalte werden nie durch
  Statusneutralität gleichgesetzt;
- Rohfakten werden nie vereinigt oder überschrieben; alle Dokument-UUIDs,
  Quellen und Statuswerte bleiben erhalten;
- `bestimmungsgemäße Auslösung` und `bestimmungswidriger Austritt` sind
  unterschiedliche Ereignisvarianten;
- ein Warte-/Karenzzeit-Fakt darf nicht mit einer bedingungslosen Deckung
  gleichgesetzt werden;
- Nulltreffer ändern niemals den Rohfakt zu `EXCLUDED`.

Jedes Verhaltensinkrement erhält seinen eigenen Commit, fokussierte positive,
negative und adversariale Verträge, eine Validierung im isolierten
Mac-Studio-Checkout und anschließend einen vollständigen Zehn-Dokument-Lauf.
Favoritenvergleich, Laufzeit, Commit, Modelle, Konfiguration und Artefakthashes
werden im Fehler- und Fixarbeitsplan protokolliert. Der installierte
Kundencheckout bleibt ohne ausdrückliche Deployment-Freigabe unverändert.

```text
VERTRAG: als V8-Nachfolgevertrag dokumentiert, im V7-Code noch nicht vollständig implementiert
BASELINE: fa780902 / 224 Zeilen / 26:47 / 0-0-38-6-99-14-67
NO DEPLOY: installierter Kundenstand bleibt unverändert
NO CLAIM: Projektionen sind keine Messergebnisse; maßgeblich ist jeder neue Lauf
```

## 80. PAV8-01 – Schutz der Bedingungs- und Ereignissemantik

Commit `30e5c3f7299f297f86f54b344f19814e70d9de4b` implementiert ausschließlich
die vor der Statusneutralität erforderlichen Semantikschutzmarker. Aktive
Warte-/Karenzbedingungen werden erkannt, ausdrücklich negierte Formen nicht.
Außerdem werden `bestimmungsgemäßer Betrieb oder Auslösung` und
`bestimmungswidriges Ereignis` als verschiedene gebundene Ereignisvarianten
im atomaren Vergleichsschlüssel und Audit geführt. Rohfakten, Suche,
Extraktion und Dokumentklassifikation bleiben unverändert.

Validierung im isolierten Mac-Studio-Checkout
`/private/tmp/pv3-pav8-01-30e5c3f7/repo` auf Node `22.23.2`:

- 6 fokussierte Suites mit 92/92 bestandenen Tests;
- positive, negative und adversariale Varianten einschließlich negierter
  Karenz-/Warteformulierungen, `Wartezimmer`, Satzgrenzen und negierter
  Ereignisformulierungen;
- Point-Decision-, Result-Builder-, Customer-Presenter-,
  Customer-Metric-, Product-Contract- und Frontend-Presenter-Suite grün;
- Prettier vollständig grün; isolierter Checkout anschließend sauber.

Vollständiger Zehn-Dokument-Lauf:

```text
Run: PAV8-01-30E5C3F7-20260902-014244
Commit: 30e5c3f7299f297f86f54b344f19814e70d9de4b
Checkout: /private/tmp/pv3-pav8-01-30e5c3f7/repo
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Start UTC: 2026-09-01T23:43:41Z
Ende UTC: 2026-09-02T00:10:37Z
Wandzeit: 26:56
Dokumente: 10/10, jeweils 224/224
Paketzeilen: 224/224
Kundenmetriken: A 0 / B 0 / Doku 38 / Gleich 6 / Null 99 /
               Nicht vergleichbar 14 / Unklar 67
Kundenreview: 67; ohne Kundenreview: 157
V7-Strict-Gate: PASS
```

Der Favoritenvergleich gegen `fa780902` ist kausal sauber:

- alle 10 `document.private.json` und alle 10 `report.json` sind bytegenau
  identisch; es gibt keine Modell-, Extraktions- oder Suchdrift;
- alle 224 `packageA`- und 224 `packageB`-Objekte sowie alle 224 Zeilen nach
  Ausblendung von `pointDecision` sind JSON-identisch;
- Outcome, Reason-Code, Rule-ID und Review-Flag sind in allen 224 Zeilen
  unverändert;
- die 67 Reviewgründe besitzen exakt dieselben Mitgliedschaften und Zähler;
- 23 private Entscheidungen erhielten über 31 Dimensionen zusammen 62 neue
  `operationalEventMode`-Auditfelder; 22 Zeilen enthalten ausschließlich den
  neutralen Wert `UNSPECIFIED`, nur `LW-13` besitzt zwei nicht-neutrale Modi;
- `LW-13` bleibt korrekt `NICHT_VERGLEICHBAR`: A betrifft die
  bestimmungsgemäße Auslösung, B den bestimmungswidrigen Austritt. Die
  Kundenerklärung nennt diese Abgrenzung jetzt ausdrücklich;
- `EL-09` bleibt in diesem Inkrement unverändert `NICHT_VERGLEICHBAR`, weil
  die Dokumentstatusdifferenz erst Gegenstand von `PAV8-02` ist;
- der einzige normalisierte semantische Artefaktdelta ist damit die
  Ereignisvarianten-Provenienz und Erklärung von `LW-13`. Im Markdown änderte
  sich exakt eine Zeile, im XLSX exakt `Gesamtvergleich!Q139`;
- von 890 geprüften Dokumentartefakten waren 735 byteidentisch. Die 155
  übrigen Hashdifferenzen bestanden ausschließlich aus 45 Laufmetriken, 100
  Laufzeit-/Pfadangaben und 10 Manifest-Metadaten; nach deren Ausblendung
  waren auch diese 155 inhaltlich identisch. Insbesondere waren 50/50
  Worksheets, Triagen, Wirkungsartefakte, Quellenauswahlen, Ergebniszeilen
  und Feldextraktionen identisch.

Artefakte:

```text
Run-Signatur: bb687dacee5c3ae09cdb575f4e13a6811c16ab97558d67dc601733e7682ecc0f
package-contract: 48b18f7e9fb2f09118057e01b274eec6e90b1b0d8b101fcdcfeed386335ff9f8
package-report: f0ac7d58cedd230e451b0eac3bbb9e3d0bab32e0f8d3d89445e08c1891e7e201
comparison JSON: fe303a95acc3edff5d9a7271110dbfa1214a77815bf54c76c425c1a16e51691d
comparison Markdown: 7a6be19708df20dcce8d82fc7b84eea60b307e52ef21d4a7abaab0fb78d2a277
XLSX: 8a6c6eb9631a99e5701787f592971dd051083d49d59dcab86cca6db0132d33bb
```

Die Wandzeit liegt 9 Sekunden beziehungsweise rund 0,6 Prozent über dem
Favoriten `26:47`; daraus folgt kein belastbarer Performanceunterschied.
Der installierte Kundencheckout blieb unverändert auf `c7d3b16d...`.

```text
PASS: Schutzmarker und adversariale Verträge
PASS: vollständiger Mac-Studio-Lauf ohne Analyse-/Modelldrift
PASS: erwartete LW-13-Abgrenzung; keine unerwartete Ergebnisänderung
NO DEPLOY: installierter Kundenstand unverändert
NEXT: PAV8-02 – Statusmetadatum und provenienzerhaltende Vergleichsgruppierung
```

## 81. PAV8-01b – Schutz ausdrücklicher Deckungsoptionen

Die unabhängige Vorprüfung von PAV8-02 zeigte eine zusätzliche
Sicherheitsabhängigkeit: Ein statusneutraler Vergleich darf eine ausdrücklich
optionale Deckung nicht als festen Einschluss behandeln. Dieser Schutz wurde
deshalb als eigenes, kausal messbares Inkrement vor PAV8-02 umgesetzt.

Commit `c2e3a155060c04e63d6956c9f24ffb192a082586` erkennt gebundene
Formulierungen wie `optional`, `wahlweise`, `gegen Mehrprämie`, `auf Wunsch`,
`kann eingeschlossen werden` und `nur bei gesonderter Vereinbarung`.
Markerlokale Negativkontrollen verhindern unter anderem Treffer auf `nicht
optional`, `nicht wahlweise`, `nicht auf Wunsch`, `kann nicht eingeschlossen
werden` und `ohne Mehrprämie`. Alle rohen Fundatome werden vor einer
Deduplizierung vollständig auf Rolle, Wirkung, aktive Geltung, Quellen,
Konflikte, Bedingungen und Optionalität geprüft. Damit kann ein unsicheres
Duplikat nicht mehr durch seine Eingabereihenfolge verdeckt werden.

Das Verhalten ist unter dem neuen Produktprofil
`CUSTOMER_CORE_5_V8_OPTIONALITY_GUARD` und dem Vergleichsvertrag
`OPTIONALITY_GUARDED_TYPED_V1` versioniert. Fokussierte Validierung im
isolierten Mac-Studio-Checkout
`/private/tmp/pv3-pav8-01b-c2e3a155/repo`:

- 8 Suites und 121/121 Tests bestanden;
- positive, negative, adversariale und permutationsstabile
  Optionalitätsvarianten bestanden;
- Point Decision, Result Builder, Kundenmetriken, Presenter,
  Produktvertrag, Frontend-Presenter und Shell-Runner bestanden;
- Prettier bestand; der isolierte Checkout blieb sauber;
- der fokussierte Jest-Harness lief mit Node `26.7.0`, der Produktlauf mit
  der gebündelten Runtime Node `22.23.2`.

Ein erster Laufversuch
`PAV8-01B-C2E3A155-20260902-024046` endete vor der ersten Analyse wegen
einer im isolierten Checkout noch fehlenden
`collector/node_modules`-Verknüpfung (`pdf-parse`). Das war ein reiner
Checkout-Aufbaufehler; es entstand kein Vergleichsergebnis und der
installierte Kundencheckout wurde nicht berührt. Nach Ergänzung der
isolierten Abhängigkeitsverknüpfung lief derselbe Commit vollständig:

```text
Run: PAV8-01B-C2E3A155-20260902-024400
Commit: c2e3a155060c04e63d6956c9f24ffb192a082586
Checkout: /private/tmp/pv3-pav8-01b-c2e3a155/repo
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Start UTC: 2026-09-02T00:42:50Z
Ende UTC: 2026-09-02T01:09:33Z
Wandzeit: 26:43
Dokumente: 10/10, jeweils 224/224
Paketzeilen: 224/224
Kundenmetriken: A 0 / B 0 / Doku 38 / Gleich 6 / Null 99 /
               Nicht vergleichbar 14 / Unklar 67
Kundenreview: 67; ohne Kundenreview: 157
Strict-Gate: PASS
```

Der unabhängig doppelt ausgeführte Delta-Audit gegen PAV8-01 und den
Favoriten ergab:

- 0 Änderungen an Outcome, Reason-Code, Rule-ID oder Review-Flag in 224
  Zeilen;
- alle Reviewgrundzähler und deren Zeilenmitgliedschaften sind identisch;
- 224/224 Paket-A- und 224/224 Paket-B-Zusammenfassungen sowie alle Zeilen
  außerhalb der privaten Entscheidung sind gegen PAV8-01 identisch;
- nur `LW-22` erhielt einen präziseren generischen Grundtext: `Bedingung oder
Ausnahme` wurde zu `Bedingung, Ausnahme oder Optionalität`, und
  `Bedingungsscope` zu `Geltungsscope`. Die Entscheidung bleibt unverändert
  `UNKLAR`, `CONDITIONAL_OR_EXCEPTION_SCOPE`,
  `FAIL_CLOSED_CONDITIONAL_SOURCE_V1`, kundenprüfpflichtig;
- im Markdown änderte sich nur `LW-22`, in der XLSX exakt
  `Gesamtvergleich!Q144`. Gegen den Favoriten bestehen zusätzlich nur die
  bereits abgenommene `LW-13`-Erklärung in `Q139` und die privaten
  PAV8-01-Auditfelder;
- der produktive Optionalitätshelper fand in allen realen `FOUND`-Atomen
  dieses Pakets 0 optionale Marker. Der neue Schutz ist für diesen Korpus
  daher dormant: regressionsfrei, aber noch nicht durch einen echten
  positiven Dokumentfall belegt;
- von 890 gemeinsamen Dokumentartefakten sind 725 byteidentisch. Die 165
  Unterschiede bestehen ausschließlich aus 45 Answer-Dateien mit
  Laufzeitmetriken, 100 Kategorie-Reports mit Laufzeiten/Pfaden, 10
  Dokumentreports mit der neuen Profil-/Vertrags-ID und 10 Manifesten mit
  Zeit, Release und Profil;
- Worksheets, materialisierte und validierte Triagen, Effects,
  Quellenauswahlen, Ergebniszeilen und Requested Fields sind jeweils 50/50,
  `document.private.json` 10/10 byteidentisch;
- eine bekannte nichtfatale PDF-Warnung `TT: undefined function: 21` trat
  einmal auf; alle Dokumente und Paketzeilen wurden dennoch vollständig
  materialisiert.

Artefakte:

```text
Run-Signatur: 6935a154d89af5276aaa744de1097693a9a822a559adf4e7000fa37fd8748828
package-contract: 81621b97014ee211b6882d7838591cb7ae4999e555d727362840489f5040e465
package-report: 65cb96dfbda53f8f4421220d7a892370e001071856d74b5a32c2197b4865518f
comparison JSON: 22867def8512b46fc793bfdc8d51ba0915397da21546716021d9ce20ab37b251
comparison Markdown: 92438cc2d55972f1182a6d24d3df91b0bb8ecd64b30f892edb244757445cf289
XLSX: ab11e6868622b4a265a9dd069c8a638c0827d48300a0d2f914e4447bfa675fc7
```

Die Wandzeit liegt 4 Sekunden unter dem Favoriten und 13 Sekunden unter
PAV8-01; das ist kein belastbarer Performanceunterschied. Der installierte
Kundencheckout blieb sauber und unverändert auf `c7d3b16d...`.

```text
PASS: fokussierte Optionalitäts- und Adversarialverträge
PASS: vollständiger Mac-Studio-Lauf ohne fachliche Regression
LIMIT: kein echter positiver Optionalitätsmarker im aktuellen Fünferkorpus
NO DEPLOY: installierter Kundenstand unverändert
NEXT: PAV8-02 – Statusmetadatum und provenienzerhaltende Vergleichsgruppierung
```

## 82. PAV8-02 – Dokumentstatus als Paketmetadatum

Commit `52f0c497086b467869691be0acfefa393535ca16` implementiert den
versionierten Vergleichsvertrag `PACKAGE_FIRST_STATUS_METADATA_TYPED_V1` im
Profil `CUSTOMER_CORE_5_V8_STATUS_METADATA`. Semantisch identische gefundene
Paketfakten werden nur in der abgeleiteten Vergleichsdimension über
`ACTIVE`, `FRAMEWORK_TERMS` und `PROPOSED_ONLY` gruppiert. Rohfakten,
Dokument-UUIDs, Quellen, Offsets, Status, Geltung und Contributor-Provenienz
bleiben unverändert. Bedingungen, Optionalität, Wirkung, Wert, Scope,
Variante, Konflikt, Abwesenheit, Teilbeleg und Paketreview bleiben
entscheidungsrelevant und fail-closed.

Mac-Studio-Validierung im isolierten Checkout
`/private/tmp/pv3-pav8-02-52f0c497-IbPiZn/repo` auf Node `22.23.2`:

- Prettier bestanden;
- 8 fokussierte Suites, 145/145 Tests bestanden;
- Schema 8, Audit V2, Profil-, Metrik-, Presenter- und Shell-Verträge grün;
- positive, negative, adversariale und permutationsstabile Provenienz-,
  Optionalitäts-, Bedingungs-, Wert-, Scope- und Abwesenheitskontrollen grün.

Vollrun `PAV8-02-52F0C497-20260902-035452` mit
`qwen/qwen3.6-35b-a3b`, Kontext `42496`, von
`2026-09-02T01:54:52Z` bis `2026-09-02T02:21:51Z`: 10/10 Dokumente mit
jeweils 224/224 Zeilen, Paket 224/224, Wandzeit `26:59`. Ein vorzeitig
angelegter, nachweislich leerer Exportordner verursachte nach den zehn
vollständigen Analysen einmal `OUTPUT_ALREADY_EXISTS`; nur die
deterministische Paketmaterialisierung wurde nach `rmdir` wiederholt.

Gemessen wurde `0/0/38/10/99/8/69`, Kundenreview 69. Gegen PAV8-01b:

- `LW-05`, `LW-06`, `EL-10`, `EL-13` werden korrekt `GLEICHWERTIG`;
- `VS-29` wird eindeutig `NICHT_VERGLEICHBAR`;
- `VS-08`, `VS-10`, `VS-20`, `EL-09` werden nach Sichtbarwerden der
  verbleibenden Regel- beziehungsweise Bedingungslücke korrekt `UNKLAR`;
- `FE-A07` bleibt unklar mit präziserem Bedingungsgrund;
- netto steigt Kundenreview `67 -> 69`; deshalb kein neuer Ergebnisfavorit;
- die 99 qualifizierten beidseitigen Nulltreffer, 38
  Dokumentationsunterschiede und 40 Paketreviewzeilen bleiben exakt stabil;
- 224/224 Paket-A/B-Zusammenfassungen bleiben byteidentisch.

Der 890-Artefakt-Audit weist keine Modell-, Such-, Extraktions- oder
Evidenzdrift aus: 725 Dateien byteidentisch; alle 10 Dokumentextraktionen und
alle je 50 Worksheets, Triagen, Wirkungs-, Quellen-, Ergebniszeilen- und
Feldartefakte byteidentisch. Die übrigen 165 Deltas sind vollständig
Laufmetriken, Pfade, Profilreports und Manifest-Provenienz. In der XLSX ändern
sich gegen PAV8-01b genau 20 Zellen und ausschließlich Spalte Q.

```text
Run-Signatur: c9edceeb43bb0395dfcd6d404497eb2a2347b3b742de3d43147656755b6e2368
comparison JSON: 050adbfa9315fd3ac9174500a5267e1bac4d564686a0136f4a49e4db632adc58
comparison Markdown: 65de0d5c33376dca439311f8ba9e540619ffb5b89768bcda3cd9c30cce3d5950
XLSX: 87741c94e238afc918338efd7e00b54260475be73d4d39c3a4796df4e6eb1560
PASS: fokussierte Verträge und vollständiger Mac-Studio-Lauf
PASS: keine Modell-/Evidenzdrift und keine Paketreview-/Absenzumgehung
GO: notwendiger Paket-first-Unterbau
NO-GO: kein neuer Ergebnisfavorit wegen Kundenreview 67 -> 69
LIMIT: kein dauerhaftes full-run.private.log für diesen Operatorlauf
NO DEPLOY: installierter Kundenstand unverändert c7d3b16d
NEXT: PAV8-03a – beidseitige qualifizierte Abwesenheit als Gleichheit
```

## 83. PAV8-03a – qualifizierte bilaterale Abwesenheit

Commit `9564bcb77b368c684182111d83215167bec96661` implementiert den
allgemeinen Auditvertrag `BILATERAL_QUALIFIED_ABSENCE_AUDIT_V1` und die
Entscheidungsregel `EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1`. Der Vertrag
ordnet eine Zeile nur dann `GLEICHWERTIG` zu, wenn beide bereitgestellten
Polizzenpositionen unter demselben versionierten Anforderungs- und
Suchvertrag vollständig kontrolliert wurden und auf beiden Seiten keine
passende Vertragsregelung gefunden wurde.

Die Aussage betrifft ausschließlich die Gleichheit der dokumentierten
Fundlage. Sie behauptet weder positiven Deckungsgleichstand noch einen
ausdrücklichen Ausschluss. Einseitige Funde, Teilbelege, Konflikte,
Rangprobleme, Bedingungen, unvollständige `ANY`-Alternativen, fehlende
Dokumente, abweichende Komponenten-/Planbindungen oder unreine Rohatome
bleiben fail-closed.

Produktversion:

```text
Schema: 9
Profil: CUSTOMER_CORE_5_V9_BILATERAL_ABSENCE_EQUALITY
Vergleichsvertrag: PACKAGE_FIRST_BILATERAL_ABSENCE_EQUALITY_V1
Audit: BILATERAL_QUALIFIED_ABSENCE_AUDIT_V1
Regel: EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1
```

Mac-Studio-Prüfung im isolierten Checkout
`/private/tmp/pv3-pav8-03a-9564bcb7-Ty1KwF/repo`:

- Prettier bestanden;
- 9 Suites / 167 Tests bestanden;
- kontrollierte, zertifizierte, gemischte, `ALL`-, vollständige und
  unvollständige `ANY`-Varianten geprüft;
- Dokument-, Komponenten-, Plan-, Digest-, Feld-, Seiten-, Kandidaten-,
  Scope-, Reihenfolge- und Auditmanipulationen fail-closed;
- In-Memory-Replay auf PAV8-02: exakt 99 erwartete Umklassifizierungen,
  0 Rohänderungen, Reviewmenge 69 unverändert.

Vollrun:

```text
Run: PAV8-03A-9564BCB7-20260902-045443
Commit: 9564bcb77b368c684182111d83215167bec96661
Node: 22.23.2
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Start: 2026-09-02T02:54:43Z
Ende: 2026-09-02T03:21:35Z
Wandzeit: 26:52
Dokumente: 10/10 mit je 224/224 Zeilen
Paket: 224/224 Zeilen
Metrik: 0/0/38/109/0/8/69
Kundenreview: 69
```

Der erste getrennte Startordner
`PAV8-03A-9564BCB7-20260902-045311` brach vor jedem Modellaufruf ab, weil
ein relativer Manifestpfad im isolierten Checkout noch nicht gegen die
absolute Uploadbasis aufgelöst war. Der erfolgreiche Lauf verifizierte vorab
alle zehn Quelldateien und SHA-256-Werte. Das vollständige Konsolenprotokoll
des erfolgreichen Laufs wurde erstmals dauerhaft in
`full-run.private.log` gespeichert.

Exaktes Delta gegen PAV8-02:

- `0/0/38/10/99/8/69 -> 0/0/38/109/0/8/69`;
- genau 99 und nur 99 Outcomes wechseln
  `KEIN_DOKUMENTIERTER_VORTEIL -> GLEICHWERTIG`;
- Review bleibt 69 mit identischer Mitgliedschaft;
- Paket A/B, technische Altentscheidungen und alle nicht betroffenen
  Punktentscheidungen bleiben unverändert;
- 410/410 fachlich relevante Dokumentartefakte byteidentisch;
- 99 XLSX-Zellwerte ändern sich, ausschließlich Spalte Q; keine Höhen-,
  Breiten- oder weiteren Zellwertänderungen;
- Laufzeitdifferenz zu PAV8-02: minus 7 Sekunden, nicht signifikant.

Berichtspflicht: Die 109 Gleichwertigkeiten bestehen aus 99 gleichen
dokumentierten Fundlagen nach vollständigem beidseitigem Nichtfund und 10
positiv beziehungsweise inhaltlich belegten Gleichwertigkeiten. Die
Gesamtsumme darf nicht als 109 identische Deckungen kommuniziert werden.

```text
Run-Signatur: 7f9f92d2c69bf371a77505f5585f2bf046a86f717fc4f714341e483a394f7215
full-run.log: 900d82b41fa7e2eff07c8a340df93cc5e5932cf060b443c9f7d637e12dd32ce8
comparison JSON: 91eec292a8e7835797707e2fb2171c4c5603d9a94cc2d0573a9c153ca21e1c18
comparison Markdown: d617b89c285c9aa94685bb6618b01115d0f09415ec02e6f9d55b2b642bc25d62
XLSX: d317bf137c3b2397d3f002156b9118ffc62439e07083453d55115c0cd67b9715
PASS: fokussierte Verträge, Replay und vollständiger Mac-Studio-Lauf
PASS: keine Modell-, Such-, Extraktions-, Evidenz- oder Reviewdrift
GO: aktuelle technische Vergleichsbasis
LIMIT: weiterhin 0 Richtungsentscheidungen und 69 Reviewzeilen
NO DEPLOY: installierter Kundenstand unverändert c7d3b16d
NEXT: einseitig belegte Inhalte als eigener geprüfter Richtungsvertrag
```

## 84. PAV8-03b – qualifizierter einseitiger Einschluss

Geprüfter Gesamtstand `45591f76afce85142d3fc4feaeb31a474559bca1`
implementiert Schema 10 mit:

```text
CUSTOMER_CORE_5_V10_QUALIFIED_ONE_SIDED_INCLUSION
PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_V1
QUALIFIED_COVERAGE_OVER_ABSENCE_AUDIT_V1
INCLUDED_OVER_QUALIFIED_ABSENCE_V1
QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V2
```

Der Vertrag bewertet jede technische Einseitenzeile. Nur eine vollständig
belegte, reine `ALL`-Coverage aus `INCLUDED`-Komponenten darf gegenüber der
unter demselben Vertrag vollständig kontrolliert fundlosen Gegenseite einen
Vorteil erhalten. Scope, Rolle, Quellen, Dokumentstatus/-geltung,
Komponentenmatrix, Seiten, Bedingungen, Optionalität, Felder und rohe
Contributor bleiben gebunden. Der Kundentext behauptet auf der Gegenseite
nur „keine entsprechende Regelung gefunden“, niemals einen ausdrücklichen
Ausschluss.

Mac-Studio-Prüfung im isolierten Checkout
`/private/tmp/pv3-pav8-03b-dca1dfb5-7sIPQu/repo`:

- Prettier bestanden;
- 9 Suites / 154 Tests bestanden;
- Richtungen A/B, Blocker, Manipulation, Kundentext, Dimensionen,
  Fail-closed und historische Schema-9-Bindung geprüft;
- Replay auf PAV8-03a: exakt fünf erwartete Outcomeänderungen, 38 Audits,
  keine Paket-/Roh-/Reviewänderung;
- Vollrun `PAV8-03B-45591F76-20260902-061200`, 10/10 Dokumente mit je
  224/224 Zeilen, Paket 224/224, Qwen `qwen/qwen3.6-35b-a3b`, Kontext 42496,
  Wandzeit `26:42`;
- Vollrun und Replay: byteidentische Kategorien und zellwertgleiche XLSX;
  360/360 semantische Dokumentartefakte byteidentisch zu PAV8-03a.

Ergebnis:

```text
PAV8-03a: 0/0/38/109/0/8/69
PAV8-03b: 3/2/33/109/0/8/69
Vorteil A: VS-13, VS-14, EL-25
Vorteil B: FE-A09, ST-05
XLSX: nur Q8, Q69, Q88, Q182, Q213 geändert
Review: 69 -> 69, identische Mitgliedschaft
```

`VS-16` bleibt getrennt: Der aktuelle Vertrag sperrt `ANY`, weil sichere
Parkplatzalternativen und eine bedingte Garagenalternative nicht ohne
eigenen Alternativenvertrag vermischt werden dürfen. Die weiteren 32
blockierten Einseitenzeilen benötigen Teilkomponenten-, Ausschluss-,
Kosten-/Deckungs-, Mischdeckungs-, Wert-/Limit- oder Bedingungsverträge.

```text
Run-Signatur: 03458fce1550cea41c5e20f8a49ececbf85c687307065ad4d5b59beaa239052f
comparison JSON: a91e9043372807ca6c827a50c88b1eaab3ed7f07455fcafd32cec31fa89c8942
comparison Markdown: 16ff9e714659df4969b26cf402628f3716132cbe06fb585dae502c914c16221e
XLSX: 34ae559191b5d9130790ccdc69a84ad0213ed6279d2f2c5f5f0d01b50c3624d9
PASS: fokussierte Verträge, Replay und vollständiger Mac-Studio-Lauf
PASS: erstmals fünf sichere Richtungsvorteile ohne Roh-/Reviewdrift
GO: neue technische Vergleichsbasis
LIMIT: VS-16 und 32 weitere Einseitenfälle bleiben typisiert blockiert
LIMIT: 69 Reviewzeilen unverändert
NO DEPLOY: installierter Kundenstand unverändert c7d3b16d
NEXT: VS-16 als eigener ANY-Alternativenvertrag; danach typisierte Familien
```

## 85. PAV8-03c/03d – Textpräzision und VS-14-Fachkorrektur

Die unabhängige Einzelfundprüfung nach PAV8-03b verwarf `VS-14` als
fachlichen Vorteil. Der verwendete Text "Adaptierungen und Investitionen der
Bewohner" beweist `VS-13` (Wohnungsinnenausbau), aber nicht ohne Weiteres
`VS-14` (Sonderausstattung einzelner Wohnungen über Standard). PAV8-03b ist
damit eine reproduzierbare technische Zwischenstufe, aber kein fachlicher
Favorit mit fünf bestätigten Vorteilen.

Commit `69386053` korrigierte zunächst isoliert die Kundentexte für
Mehrkomponenten- und `NARROW_ONLY`-Fälle. Der Vollrun
`PAV8-03C-TEXT-69386053-20260902-064500` dauerte `26:48`; nur die
Begründungstexte von `ST-05` und `EL-25` änderten sich. Ergebnis,
Paketdaten und Reviewmitgliedschaft blieben bei `3/2/33/109/0/8/69`.

Commit `2d964b45d6bbf8a1ca0769ad25bc3b59d3a7c42b` trennt danach die
Konzeptfamilien:

- VS-13 behält Adaptierungen und Investitionen der Bewohner;
- VS-14 verlangt explizite wohnungsbezogene Sonderausstattung oberhalb der
  Standardausführung;
- Katalog `vs-occurrence-full-draft-v0.7`, Profil
  `CUSTOMER_CORE_5_V11_VS_SPECIAL_EQUIPMENT_PRECISION` und Schema 11 sind
  gemeinsam versioniert;
- Schema 10 bleibt historisch gebunden und validierbar.

Mac-Studio-Gates:

```text
Prettier: PASS
Fokussierte Suites: 13/13 PASS
Tests: 307/307 PASS
Vollrun: PAV8-03D-VS14-2D964B45-20260902-073000
Dokumente: 10/10, jeweils 224/224
Paket: 224/224
Wandzeit: 26:52
Ergebnis: 2/2/33/110/0/8/69
Review: 69 -> 69, identische Mitgliedschaft
```

Gegen PAV8-03c ändert sich genau ein Outcome:

```text
VS-14: VORTEIL_A -> GLEICHWERTIG
Paket A: unzutreffender Fund -> vollständig kontrollierter Nichtfund
Paket B: vollständig kontrollierter Nichtfund -> unverändert
```

`VS-13` und `EL-25` bleiben Vorteil A; `FE-A09` und `ST-05` bleiben Vorteil
B. Alle Nicht-VS-Zeilen sind byteidentisch. Die 36 VS-Zeilen tragen die neue
Katalogversion und neue abgeleitete Digests; nach Entfernung dieser reinen
Versions-/Hashunterschiede bleibt VS-14 die einzige semantische Änderung.
Die zehn Dokumentobjekte sind byteidentisch.

Die erstmals für diesen Lauf vollständig materialisierte formale
Paketprovenienz ist konsistent:

```text
Run-Signatur: e3fa86164b0a027dbc219681bd308a1f7e027e0e5297f70b122feebf4e18d55e
package-contract: 2b390be8aa5597a9990735151b5458e023c9b561134e4c1023f5e6a765479173
package-report: 3b1b7047dd1977f9c99738ac5892029ae40b11576635e2d6b1b104bfb7771b9e
comparison JSON: 4b0714d8d0667cdcd5d52c1f5377e2c65dd6a7fd47530c2ac95f8244b6d7c6b5
comparison Markdown: ae1474543db724e544693d24a11551001e12f41d328fe3cb7fbba13ad075e87d
XLSX: a1b2396bd732aa73942b9286f375f6db2acd8d056a8b1f9bbb3c6b65dcc1bbac
```

Die Signatur wurde unabhängig neu berechnet; Comparison und Report tragen
dieselbe Signatur, und alle Reporthashes stimmen mit ihren Ergebnisdateien
überein. Das Log enthält zehn Abschlüsse, eine bekannte nicht fatale
PDF-Warnung und keinen tatsächlichen Lauf- oder Modellfehler. Der Package
Report wiederholt die Reviewzahl wegen einer veralteten Feldprojektion noch
nicht; der autoritative und validierte Wert steht in
`comparison.totals.customerReviewRequired = 69`. Der nächste versionierte
Run-Report-Builder muss dieses Feld explizit übernehmen.

```text
GO: PAV8-03d ist die neue technische und fachliche Vergleichsbasis
PASS: eine falsche VS-14-Freigabe entfernt
PASS: vier bestätigte Richtungsentscheidungen erhalten
PASS: keine Review-, Dokument- oder Nicht-VS-Semantikdrift
LIMIT: 69 Reviewzeilen unverändert
LIMIT: Package Report wiederholt customerReviewRequired noch nicht
NO DEPLOY: installierter Kundenstand sauber auf c7d3b16d
NEXT: Reviewfamilien einzeln und mit eigenem Vertrag abarbeiten
```

## 86. QA Target Selection V1 – kanonische Teilmengenidentität

Commit `bba9670d5f314df50f4ffb43c710d2cb9818b0fe` ersetzt den unsicheren
QA-Teilmengenpfad, der bisher `:subset:<ids>` an die fachliche `catalogId`
angehängt hatte. Zielauswahl und Fachvertrag sind jetzt getrennt:

- die kanonische Katalog-ID und vollständigen Requirement-Objekte bleiben
  unverändert;
- die Auswahl folgt immer der Katalogreihenfolge;
- ein versionierter Selection-Digest bindet Ziel-IDs und die jeweiligen
  `requirementSearchContractDigest`-Werte;
- Triage und Prepared Evidence unterstützen einen extern erwarteten Digest
  und sperren fehlende oder manipulierte Target-Provenienz;
- Leerwerte, unbekannte IDs, Duplikate und Kategorievermischungen scheitern
  fail-closed;
- Full-vs-Target-Parität ist für einzelne Triage-/Prepared-Evidence-Payloads,
  reale `ANY`-Requirements und Binding Groups sowie einen synthetischen
  zertifizierten Schema-2-Vertrag abgesichert.

Mac-Studio-Nachweis:

```text
Checkout: /private/tmp/pv3-pav8-03b-dca1dfb5-7sIPQu/repo
Commit: bba9670d5f314df50f4ffb43c710d2cb9818b0fe
Runtime: Node.js 22.23.2
Prettier: 6/6 PASS
Direkte Suites: 88/88 PASS
Angrenzende Suites: 115/115 PASS
Breite Policy-Analysis-Suite: 574/575 PASS
Baseline-Gegenprobe ST-11 auf 2d964b45: identisch FAIL
Modell-/Embedding-Aufrufe: keine
```

Der eine rote ST-11-Test betrifft ausschließlich eine schon am Favoriten
abweichende `scopeLead`-Erwartung und wurde durch diesen Commit nicht erzeugt.
Der installierte Kundencheckout blieb sauber auf `c7d3b16d`.

```text
PASS: kanonische Target-Auswahl und Downstream-Digest-Grenze
PASS: keine Regression in den direkt oder angrenzend betroffenen Suites
LIMIT: Target-Manifest/Materializer, 10-Dokument-Gate, 224-Overlay und 155-Guard fehlen
NO DEPLOY: installierter Kundenstand unverändert
NEXT: QA-Target-Manifest und vollständige Dokumentmatrix implementieren
```

## 87. QA Target Manifest V1 – PAV8-Byte- und Matrixbindung

Commit `e15dc228b82692a9befd7ed57f4a352eea26248f` ergänzt einen privaten
Manifestvertrag für den 69er-Target-Loop. Die erste Fassung wurde nach einem
unabhängigen Senior-Review vor dem Commit verworfen, weil Hashwerte nur als
Strings übernommen, die Dokumentmatrix vom Aufrufer gewählt und Selections
nicht gegen Katalogdateien authentifiziert worden wären.

Die korrigierte Fassung:

- hasht Registry, Paketvertrag, Baseline-Vergleich und fünf Kataloge aus
  Rohbytes;
- parst Paket und Vergleich erst nach bestandenem Registry-Hashabgleich;
- bindet Baseline-Commit, Run-Signatur, Produktprofil und
  Vergleichsdokumentprojektion;
- erzwingt `A:0 + B:0..8`, `224/69/155` und dieselben 69 Review-/UNKLAR-Keys;
- baut alle fünf Selections aus den kanonischen Katalogbytes und den 69
  Registry-IDs intern neu auf;
- bindet neue Release-, Modell-, Kontext-, Node- und Promptidentität;
- bleibt `TARGETED_QA_ONLY` und kann weder den Produktworker noch einen
  vollständigen Kundenmaterializer aufrufen.

Mac-Studio-Nachweis auf exakt diesem Commit:

```text
Prettier: PASS (3 Dateien)
Manifest/Selection/Registry: 27/27 PASS
Full-Materializer/Worker-Grenzen: 18/18 PASS
Worksheet/Triage/Evidence/Katalog: 173/173 PASS
Realer PAV8-Bytevertrag: PASS
Dokumentmatrix: A=1, B=9
Targetverteilung: VS=19, FE=14, LW=10, ST=13, EL=13
Modell-/Embedding-Aufrufe: keine
```

```text
PASS: reale PAV8-Paket-/Comparison-/Katalogstruktur kann fail-closed gebunden werden
PASS: 218/218 direkte und angrenzende Mac-Studio-Prüfungen
LIMIT: fester Registrypfad/-SHA und reale Prompt-/Runtimeermittlung fehlen noch im CLI
LIMIT: Target-Materializer, 224-Overlay und 155-Guard fehlen
NO DEPLOY: installierter Kundencheckout unverändert
NEXT: QA-only Manifest-CLI mit externem Registry- und Manifest-Digest-Gate
```

## 88. Trusted Target Manifest CLI V2

Commit `b5a2157046a4b1171af80152664d7d821072d6b3` implementiert den festen
QA-Einstieg für den PAV8-69er-Lauf. Der Manifestvertrag wurde wegen der neuen
Phasenprompt- und Hybridmodusfelder von V1 auf V2 erhöht.

Die CLI lädt Registry, Kataloge und Prompts nur aus fest definierten
Repositorypfaden, prüft den committed Registry-SHA, ermittelt Release und
Node selbst und bindet Modell sowie 42.496 Kontexttoken. Je Kategorie werden
Workspace-, Triage-, Effects- und Hybrid-Addon-Prompt getrennt gehasht;
Hybrid bleibt explizit deaktiviert.

Pfad-, Resume- und Schreibgrenzen sind fail-closed:

- nur absolute Baseline-/Outputpfade;
- physische Realpath-Prüfung gegen Repository und Baseline;
- keine Output- oder Manifest-Symlinks;
- exklusive Neuanlage und atomare No-Clobber-Publikation;
- identischer Resume ohne Dateiänderung;
- fremde, leere, zusätzliche oder abweichende Ausgabe wird abgelehnt.

Mac Studio:

```text
227/227 direkte und angrenzende Prüfungen PASS
Reale PAV8-Erstanlage und Resume PASS
Manifest-Datei: d88d1fc077460fc9f4c4adc22044c05e9b8150ae1831f36822fd95da55ff905d
Manifest-Digest: 9da51e813953f456e958ed501d6ec6bf546ea4f1b86a7f05bb8e5ea8a9d77f75
A:1/B:9; Targets VS19/FE14/LW10/ST13/EL13
Modell-/Embedding-Aufrufe: keine
```

```text
PASS: feste Registry-/Katalog-/Prompt-/Runtime-Identität
PASS: reale private Create-/Resume-Grenze
LIMIT: Target-Artefaktmaterialisierung und externe Consumer-Prüfung fehlen
LIMIT: 224-Overlay und 155-Guard fehlen
NO DEPLOY: Kundencheckout unverändert auf c7d3b16d
NEXT: separater privater Target-Materializer mit verpflichtendem Expected-Digest
```

## 89. Target-Selection-Digest durch beide Modellphasen

Commit `3663b850fc7067e65612276b8be486ed13bfb61b` ergänzt beide bestehenden
Phasen-CLIs um `--expectedTargetSelectionDigestSha256`.

- Target-Worksheet ohne externe Erwartung: Abbruch vor Modellinstanz;
- Full-Worksheet mit Target-Erwartung: Abbruch;
- Digestformat und Worksheet-Digest müssen exakt passen;
- erwarteter und beobachteter Digest werden in Triage- und Effects-Report
  persistiert;
- Full-Worksheet ohne Targetmarker bleibt unverändert kompatibel.

```text
Mac Studio: Prettier PASS; 80/80 direkte Prüfungen PASS
Modell-/Embedding-Aufrufe: keine
NEXT: Target-Materializer prüft Manifest-, Phase- und Artefakthashkette
```

## 90. Target-Input-Provenienz und Dokumentartefakt-Hash V3

Die QA-only Consumer-Grenze prüft Manifest, extern erwartete Execution,
Katalog- und Prompt-Rohbytes, den deterministischen Target-Worksheet-Neubau
sowie die komplette Triage-/Effects-/Sources-Hashkette. Die Phasenreports
tragen nun Release-ID, Node-Version, Modell-ID und Kontextlimit.

Manifest V3 ergänzt pro Paket-UUID den exakten Rohbytehash des zugehörigen
`document.private.json`. Die Manifest-CLI löst am PAV8-Pfad ausschließlich die
zehn erwarteten `DOC-01-<uuid>` bis `DOC-10-<uuid>` auf und lehnt Matrixdrift,
Mehrdeutigkeit und Symlinks fail-closed ab. Der Consumer bindet UUID,
Paketposition, PDF-SHA und Artefakt-SHA gemeinsam.

```text
Commit: b5792a4ef20fb1bc1432876a7df07e0c377a7270
Mac Studio: Prettier PASS; 50/50 fokussierte Prüfungen PASS
Reales V3-Manifest: 10/10 Artefakte, 69 Targets, Resume unverändert PASS
Manifest-Datei: 4978df6e49f006633822cc808bd6c819b36660f0291f3f54ca95d134d228e52e
Manifest-Digest: 842243b889c71f167b7d0b6a0b557712aac2b6cf733a6b625f192e12b0ede887
NO DEPLOY: Kundencheckout unverändert
LIMIT: keine rückwirkende kryptografische Aussage über Änderungen vor V3-Erzeugung
NEXT: Baseline-Worksheet-Neubau, privater Target-Materializer, 224-Overlay und 155-Guard
```

## 91. Baseline-Rebuild, private Target-Materialisierung und All-50-Runner

Die QA-Kette für die 69 PAV8-Reviewzeilen ist bis unmittelbar vor dem realen
Modelllauf geschlossen:

1. `ece288a6` prüft jeden primären Baseline-Manifest-Hash gegen den
   Paketvertrag und bindet Release, PDF-SHA und Dokumentstatus.
2. `4ca4aa86` baut die 50 vollständigen Baseline-Worksheets deterministisch
   neu; die reale Mac-Studio-Prüfung ergab 50/50 semantische Parität.
3. `7ae4233c` projiziert daraus ausschließlich die kanonischen 69 Targets.
4. `65c12278` rekonstruiert alle selektierten Quellen samt Seite, Offset,
   exaktem Text, Kontext und Candidate-Ownership.
5. `07fbfb51` veröffentlicht ein privates, exakt resumierbares Paket aus
   50 Dokument/Kategorie-Paaren und 101 Dateien.
6. `30e1eda9` materialisiert daraus QA-only Rows, Requested Fields, Markdown
   und einen nicht veröffentlichbaren Report.
7. `9108fd6c` ergänzt die streng gebundene Einzel-CLI; `7e651202` erlaubt im
   Phasenroot ausschließlich deren festen `result`-Unterordner.
8. `63942e0d` orchestriert alle 50 Paare sequenziell unter der globalen
   Modellsperre.

Der Runner akzeptiert nur ein einziges geladenes Qwen-LLM mit exakt gebundenem
Kontext. Ein geladener Embedder ist verboten. Es gibt keine Hybridargumente,
keinen automatischen Modellwechsel und keine Kandidaten-ID-Reparatur. Jede
Resume-Phase wird anhand ihrer Release-, Runtime-, Prompt-, Worksheet-,
Selection- und Ergebnisartefakthashes erneut geprüft.

```text
Reale Baseline-Neubauten: 50/50 PASS
Prepared Target-Paare: 50
Target-Instanzen: 690
Candidate-belegte Komponenten: 283
Candidate-Vorkommen: 663
Runner-Commit: 63942e0d723e9d57bc34d537b9273eba27094945
Mac Studio: Prettier PASS; 32/32 fokussierte/angrenzende Tests PASS
LIMIT: realer 50-Paar-Modelllauf und Ergebnisdelta noch offen
LIMIT: 224-Overlay und 155-Nicht-Review-Guard noch offen
NO DEPLOY: installierter Kundencheckout unverändert
NEXT: Finales Manifest/Prepared-Paket am dokumentierten Commit erzeugen und All-50-Lauf starten
```

## 92. Result-Replay für servernormalisierte Wirkung idempotent

Der erste reale All-50-Versuch am Commit `8f5661dc` stoppte nach neun
vollständigen Paaren korrekt bei `Dokument 2 / EL`. Zwei EL-04-Judgements
waren vom Server aus dem Modellrohwert `DEFINED` auf `INCLUDED` normalisiert
worden. Die QA-Kontrollwiedergabe verwendete fälschlich den bereits
normalisierten Wert als neuen Rohwert und aktivierte dadurch erneut die
Positive-Scope-Union. Die persistierte Auswahl mit zwei Kandidaten wurde beim
Replay auf vier erweitert und deshalb zurecht als ungleich abgelehnt.

Commit `b0a1a9d38995d3646b623cd94720150eb37dbcf8` rekonstruiert nur für den
gebundenen Owner `MODEL_SELECTION_SERVER_EFFECT_RULE` den ursprünglichen
`DEFINED`-Wert und lässt denselben normalen Prepared-Evidence-Vertrag erneut
laufen. Es gibt keine Änderung an Candidate Search, Triage, fachlicher
Wirkungsnormalisierung oder Kundenmaterialisierung.

```text
Abgebrochener Lauf: /private/tmp/pav8-final-8f5661dc-ld66Er
Vollständige Paare vor Abbruch: 9/50
Betroffene Targets: EL-04:flood, EL-04:inundation
Mac Studio: 38/38 direkte/angrenzende Tests PASS
PASS: adversariale Mehrkandidaten-Replayprüfung
NO PRODUCT SEMANTIC CHANGE
NO DEPLOY
NEXT: neues commitgebundenes Manifest/Prepared-Paket und kompletter Target-Lauf
```

## 93. VS-24-Nachaudit und VS-25 relative behördliche Mehrkosten

Der R69-Ziellauf wurde nach VS-24 mit VS-25 fortgesetzt. Alle Ausführungen
liefen im isolierten Mac-Studio-Worktree
`/private/tmp/pv3-vs19-amount-LOqa66/repo`; der installierte Kundencheckout
wurde nicht verändert.

VS-24 blieb nach zwei Audit-Härtungen (`8d6d563ad`, `b890d0d7a`) und nach allen
VS-25-Änderungen stabil:

```text
Commit: 22dab16c74ac789e2cf310a09b520593985f4290
Artefakt: QA/VS-24-POST-VS25-22DAB16C-20260903
Summary: 8dd5afa277a53987ef8ce4daf0785fa2d6e03dc093b64e18b38db53577f20f73
Ergebnis: GLEICHWERTIG / kein Review
```

Der erste VS-25-Vorteilsstand auf `2165289ad` wurde verworfen, weil ein
`SEARCH_INCOMPLETE`-Dokument fälschlich als belastbare Abwesenheit akzeptiert
worden wäre. Die Folgecommits binden vollständige Negativsuche, ein enges
Summenausgleich-Terminal, lokale Limitbasis, exakte VS-01-Basisquelle,
centgenaue Prozent-/Euro-Reconciliation, Dokumentmanifest und Customer-Replay.
Ein zu enges 240-Zeichen-Basisfenster wurde nicht zurückgebaut, sondern durch
die persistierte `comparisonBasisSource` auf `22dab16c7` vorwärts korrigiert.

```text
Produktprofil: CUSTOMER_CORE_5_V78_VS25_PERCENT_DOCUMENT_BASIS_PROOF
Artefakt: QA/VS-25-BASIS-SOURCE-PROOF-22DAB16C-20260903
Summary: 4b76d2f4843961ccd60e1779d7dc789fd030dece30399059a03c708e2552b8db
Ergebnis: VORTEIL_A / kein Review
Fachliche Aussage: 10 % > 5 %; kein absoluter Eurovorteil behauptet
Standalone-Replay: PASS
Fokussiert: 349/349 PASS
Breit: 1609/1633 PASS; 24 bekannte historische VS-Katalog-Fixturefehler
```

VS-22 blieb im Nachbarlauf `VORTEIL_A / kein Review` mit Summary
`83b90509ab02daa415b3704f020d3fa923763ea3576ef6e1c22b5cac3cddbf5c`.

```text
R69-A: 10/40 abgeschlossen, 30 offen
Unbestätigte 224-Zeilen-Projektion:
VORTEIL_A 4 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 122 / NICHT_VERGLEICHBAR 12 / UNKLAR 50
LIMIT: kein neuer 224-Zeilen-Gesamtlauf und kein unbekannter Holdout
NO DEPLOY
NEXT: nächsten offenen R69-Kandidaten isoliert reproduzieren
```

Ein anschließender Mehrdokument-Audit fand noch eine fehlende Bindung zwischen
dem VS-01-Neuwertbeleg und genau dem Dokument der VS-25-Prozentklausel.
`95e4912ad` schließt diese Lücke mit einer zusätzlichen adversarialen
Gegenprobe. Der echte Zehn-Dokument-Lauf bleibt unverändert
`VORTEIL_A / kein Review`:

```text
Profil: CUSTOMER_CORE_5_V78_VS25_PERCENT_DOCUMENT_BASIS_PROOF
Artefakt: QA/VS-25-PERCENT-DOCUMENT-BASIS-95E4912A-20260903
Summary: 8e9998d6bf6de8ec66640c81d80d3a3e94ce959365fffb2349aea2d7a070ee6a
Fokussiert: 350/350 PASS
Breit: 1610/1634 PASS; ausschließlich 24 bekannte VS-Katalog-Fixturefehler
NO RESULT DELTA / NO DEPLOY
```

## 94. VS-36-Feldvertrag gehärtet; Ergebnisrang bleibt offen

VS-36 wurde auf dem gebundenen Zehn-Dokument-Paket isoliert geprüft. Der
Ausgangsfehler war teilweise technisch: Vier belegte B-Klauseln beschrieben
die Höchstentschädigung über Versicherungssumme, Positionssumme,
Haftungshöchstsumme oder Versicherungswert, wurden aber nicht als
source-gebundene symbolische Limits materialisiert. Paket B endete deshalb
mit `FIELD_INCOMPLETE`.

Die Commits `cee57f3b7`, `c5f2255d2`, `dbe871d8d`, `d99e60dca` und
`90f40478a` führen einen engen VS-36-Vertrag ein, verhindern die Übernahme
benachbarter fremder Prozentwerte und binden die A-Klausel exakt als
`150 % / PER_LOSS_EVENT / BUILDING_INSURANCE_SUM`. Ein im ersten Vertrag
fehlender `LIST_ITEM`-Scope wurde durch einen beobachtbaren Zwischenlauf
entdeckt und vorwärts korrigiert.

```text
Commit: 90f40478ae9b250c4a4c4ec4b226079789322b38
Profil: CUSTOMER_CORE_5_V81_VS36_LIST_EVENT_LIMITS
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Artefakt: QA/VS-36-LIST-EVENT-90F40478-20260903
Summary: 187f91649dc341a5b29555e455a3e8ca18b74c7a073d7d8fc1b0021f4bc3e3f7
Fokussiert: 225/225 PASS
Breit: 1623/1647 PASS; nur 24 bekannte historische VS-Katalog-Fixturefehler
Ergebnis: UNKLAR / Review
Behoben: FIELD_INCOMPLETE
Offen: MULTIPLE_ATOMS_SAME_COMPONENT, UNRESOLVED_DOCUMENT_PRECEDENCE
```

Der verbleibende Blocker ist fachlich real: DOC-10 enthält die einzige klare
B-Ereignisklausel, aber keine dokumentgleiche VS-01-Basisbrücke; weitere
B-Dokumente enthalten Positions- und Haftungshöchstgrenzen. Ohne belegte
Dokumentrangfolge und identische Vergleichsbasis darf daraus weder `100 %`
noch ein Vorteil abgeleitet werden.

VS-25 blieb nach der Änderung im echten Nachbarlauf stabil:

```text
Artefakt: QA/VS-25-POST-VS36-90F40478-20260903
Summary: 672ef9ef60f4791459e526333a175533b637f0061db886b0d44f1560dafdaa1d
Ergebnis: VORTEIL_A / kein Review
```

R69-A bleibt `10/40`; die 224-Zeilen-Projektion ändert sich nicht. VS-36 ist
technisch verbessert und als gegenwärtig nicht sicher entscheidbar
dokumentiert. Kein Vollrun, kein Deployment. Nächster Schritt: nächsten
offenen R69-Kandidaten einzeln reproduzieren und nur bei belegbarer
semantischer Generalisierung ändern.

## 95. FE-A05 Cross-Page-Listenproof – Provenienz geschlossen, Outcome offen

Der frische Ausgangslauf `QA/FE-A05-BASELINE-BF152F4B-20260903` bestätigt
FE-A05 als `A BELEGT / B TEILBELEGT / UNKLAR`. Die Ursache ist kein Recall:
Die positiven Klauseln in A/DOC-01 und B/DOC-02/DOC-03 wurden gefunden; sieben
weitere B-Dokumente besitzen kontrollierte lokale Nichtfunde.

Die A-Klausel läuft jedoch von einem Parent-Listitem auf PDF-Seite 7 über eine
Objekt-Unterliste bis Seite 8. Der normale seitenlokale Kontext endete vor
dieser Liste. `bc309cfb9` ergänzt daher outcome-neutral den opt-in Vertrag
`NESTED_LIST_CONTINUATION_PROOF_V1`; `f59ba5f64` formatiert ihn. `79f8eec38`
versioniert den FE-Katalog auf v0.9 und das Produktprofil auf V82.

```text
Commit: 79f8eec38f17cadfbc1892de9762360d343be460
Profil: CUSTOMER_CORE_5_V82_FE_A05_LIST_CONTINUATION_PROOF
Artefakt: QA/FE-A05-A06-VERSIONED-PROOF-79F8EEC3-20260903
Summary: 7a5fae57bade9489ffcd4ceb4f614df25f6029fc6fb549fc100915d7ed7b96fc
Selection: d3a10795341c8e8b572957f868615c9b347377e45033b99c13060d4fc61c613b
Proof: a0b21d86e558d1df1d79d344a853fc7d467d0065f39fcd82b92fbb958cec984c
Fokussierte Prüfungen: 206/206 und 159/159 PASS
Breit: 1630/1654 PASS; nur 24 bekannte historische VS-Katalog-Fixturefehler
Ergebnis: unverändert UNKLAR / Review
```

Der neue Proof hält `context` seitenlokal, speichert beide physischen
Quellsegmente samt Offsets/Text/Hashes und stoppt fail-closed an Struktur- und
Sibling-Grenzen. Er ist derzeit nur für FE-A05 aktiv und besitzt noch keinen
Outcome-Consumer.

FE-A05 bleibt deshalb offen. Nächster Schritt: typisierte, sourcegebundene
Objekt-Scope-IDs für A und B materialisieren; anschließend paketweiten
Scope-Set-Vertrag entwickeln, ohne FE-A06-Limits einzumischen. R69-A bleibt
`10/40`; kein Vollrun und kein Deployment.

## 96. FE-A05 Listenproof-Validator – Replay vor fachlicher Nutzung

`6a48d2dba` ergänzt für `NESTED_LIST_CONTINUATION_PROOF_V1` einen unabhängigen
Replay-Validator; `618bcaeb2` formatiert den Schritt. Der Validator baut den
Proof aus Originalbytes und PageMap neu auf und verlangt kanonische exakte
Übereinstimmung aller Offsets, Seiten, Texte, Hashes, Seitenübergänge,
Stop-Grenzen und des Gesamtdigests. Manipulierte Quelldaten oder PageMap-Grenzen
schlagen fail-closed fehl. Es gibt weiterhin keinen Outcome-Consumer.

```text
Commit: 618bcaeb2da86b0706268039cb4d410b98ab1f6c
Mac-Studio fokussiert/angrenzend: 198/198 PASS
Artefakt: QA/FE-A05-A06-PROOF-VALIDATOR-618BCAEB-20260903
Summary: 3d7b99c41cb844aa38565bdb301f2b5197d0bfed7e8290c5deeb1bda11be6991
Ergebnis: A BELEGT / B TEILBELEGT / UNKLAR
Delta zu 79f8eec38: keines bei Status, Ergebnis oder Aufrufzahlen
```

Nächster Schritt: `SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_V1` diagnostisch
materialisieren. Erst nach quellgenauer Abbildung von Objekt, Ort, Nutzung,
Installation und Bedingungen ist für FE-A05 eine Ergebnisänderung zulässig.
R69-A bleibt `10/40`; kein Vollrun und kein Deployment.

## 97. FE-A05 Objekt-Scope-Provenienz – diagnostisch und outcome-neutral

`aa417dec5`/`b74d5c265` implementieren
`SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_V1`; `622ee50ae` hebt den FE-Katalog auf
v0.10 und das Produktprofil auf V83. `bf6e87c86` ist der isolierte
QA-Erwartungsfix.

Der Vertrag akzeptiert ausschließlich lokale Listen-/Absatzkontexte oder zuvor
vollständig replay-validierte Seitenfortsetzungen. Er speichert exakte
Quelloffsets, Texte, Hashes, Scope-Keys, Matcher- und Parent-Proof-Digests. Im
echten Lauf erhält A/DOC-01 drei Keys; B/DOC-02 erhält zwei Keys aus getrennten
Seite-1-Listenpunkten und B/DOC-03 den Erdkabel-Key aus seinem eigenen Absatz.
Die breiten Seite-11-Fenster in DOC-02 erzeugen absichtlich keinen Scope-Fakt.

```text
Commit: bf6e87c860a4037173418cb1910315691ea5daed
Mac-Studio fokussiert: 212/212 PASS
Mac-Studio breit: 1125/1149 PASS; 24 bekannte historische VS-Fixturefehler
Artefakt: QA/FE-A05-A06-OBJECT-SCOPE-BF6E87C8-20260903
Summary: f78f3ac1aa0a31195359555c019c873aa5d74820cd82fe445b4ae57825c29994
Selection: 387784fb7b4506bd9cad04dbeaf127280e03cf593cc7e98cd25f865c55be0120
Ergebnis: unverändert A BELEGT / B TEILBELEGT / UNKLAR
```

Nächster Schritt: den Proof serverseitig nur über ausgewählte Candidate-IDs
in die atomare Source-Provenienz weiterreichen, ohne Prompt, Atomidentität,
Paketstatus oder Ergebnis zu ändern. R69-A bleibt `10/40`; kein Vollrun und
kein Deployment.

## 98. FE-A05 interne Prepared-Provenienz – Modellpfad bleibt bytegleich

`be7b27c25` kopiert validierte Objekt-Scope-Proofs in serverinterne Prepared
Candidates und führt den Parent-Listenproof nur bei echten Nested-Assertions
mit. Die Modellprojektion entfernt beide Provenienzfelder; Payload und
materialisiertes Judgement bleiben gegenüber dem provenienzfreien Target
unverändert. `fc2bd524f` versioniert den Schritt als Profil V84.

```text
Commit: fc2bd524f63c8f2a89111ee6a13faf5692fa1586
Mac-Studio fokussiert: 199/199 PASS
Artefakt: QA/FE-A05-A06-INTERNAL-SCOPE-FC2BD524-20260903
Summary: d15d807dfac2f01717b95bad2293de33b8743d066b533bfc887a8f0fd3aaf390
Target-Proofs: A/DOC-01 1; B/DOC-02 2; B/DOC-03 1
Modellnachrichten: 0 Provenienzfelder
Selected Sources: 0 Provenienzfelder, bis Originalbyte-Replay ergänzt ist
Ergebnis: unverändert A BELEGT / B TEILBELEGT / UNKLAR
```

Nächster Schritt: Object-Scope-konditionalen `--documentArtifact`-Input im
Effects-CLI und ausgewählten Source-Replay gegen Originalbytes/PageMap
ergänzen. R69-A bleibt `10/40`; kein Vollrun und kein Deployment.

## 99. FE-A05 Selected-Source-Replay – Originalbyte-Trust-Boundary geschlossen

`ad3448dfc`/`69bbc48c2` replayen ausgewählte Object-Scope-Proofs gegen
Worksheet, Komponentenvertrag, Occurrence, Dokumentfingerprint, Originalbytes
und PageMap. Presence-Parität und Komponenten-Opt-in werden für alle Candidates
geprüft; nur ausgewählte Proofs werden ausgegeben. `6d70af9b4` versioniert den
Schritt als Profil V85.

```text
Commit: 6d70af9b479dda1f67367e1e6e33a4a65b54ef96
Mac-Studio fokussiert: 224/224 PASS
Artefakt: QA/FE-A05-A06-SELECTED-REPLAY-6D70AF9B-20260903
Summary: 0e4fff646b1417fc480935eb77f1033a05de605929ad9b690caf16fdb84a68d5
Replay-SHA: ec8b9d984ba7ec1461a08dbe45d54105af7eebeab2424f28398f6acde21c9208
Ausgewählte Sources: 8; davon 4 mit replay-validiertem Scope-Proof
Ergebnis: unverändert A BELEGT / B TEILBELEGT / UNKLAR
```

Nächster Schritt: Dokumentartefakt im Effects-CLI für Object-Scope-Opt-in
zwingend machen und den Replay dort statt der lokalen ungeprüften
Source-Projektion verwenden. R69-A bleibt `10/40`; kein Vollrun und kein
Deployment.

## 100. FE-A05 Effects-Artefakt-Gate – aktive Runner geschlossen

Die Effects-CLI verwendet bei geliefertem Dokumentartefakt den gemeinsamen
Selected-Source-Replay und bindet Artefakt-SHA, Dokumentfingerprint und
Targets-SHA in den Report. Für Object-Scope-Komponenten ist das Artefakt jetzt
Pflicht; verwaiste Object- oder Listenproofs werden vor Modellarbeit
abgewiesen. All-Category, Hybrid-Shadow, Targeted-All-50 und der zweiphasige
Hybrid-Qwen-Pilot reichen das eindeutig zugeordnete Originalartefakt durch und
prüfen die Reportbindung fail-closed.

```text
Funktions-/Wiring-Commits:
6c116f959, 938c5e8fb, b7156cda7, 592317199
Format-/Testvertrags-Commits:
153bf990f, c44f0eca9, eaf9cc9d4, 7fb93adce, a2b2a662e,
3324aeb5d, 4655877c3
Historische Fixture-Grenze wiederhergestellt:
13d1f0c17 -> e63b855b5

Mac Studio fokussiert: 72/72 PASS
Mac Studio breit: 1039/1063 PASS; nur 24 bekannte historische
TARGETED_QA_PROFILE_CATALOG_MISMATCH-Tests
Artefakt: QA/FE-A05-A06-EFFECTS-ARTIFACT-GATE-A2B2A662-20260903
Summary: dfcf80c7339b92e26bf2d288ed6c8ee20fad4c146f73c2549d77c0c17e0a1b71
Dokument-/Targets-gebundene Effects-Reports: 10/10
Ergebnis: unverändert A BELEGT / B TEILBELEGT / UNKLAR
```

Damit ist die FE-A05-Provenienz vom Originaldokument bis zur persistierten
Selected Source geschlossen. Eine Ergebnisänderung bleibt verboten, bis ein
typisierter Set-/Bedingungsvertrag die echte Schnittmenge und den belegten
A-exklusiven Bereich vergleicht. R69-A bleibt `10/40`; kein Vollrun und kein
Deployment.

## 101. FE-C02 Baseline-Audit – Paketkomposition fehlt

FE-C02 ist kein Recall-, Feld- oder Rangproblem. B/DOC-10 definiert
Photovoltaik korrekt als Mitglied der haustechnischen Anlagen und diese unter
Bedingungen als Gebäudebestandteil; B/DOC-02 aktiviert Feuerversicherung,
Wohngebäude und EABS 2023. Der aktuelle Code hält den isolierten Definitionsfund
zu Recht wirkungsneutral, besitzt aber keinen Vertrag, der diese
sourcegebundene Paketkette zusammensetzt.

Nächster geplanter Schritt:
`PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_V1` mit Gefahren-/Paketscope,
Aktivierungsreferenz, gerichteter Objektmitgliedschaft, Bedingungsforttragung
und Ausschluss-/Rangprüfung. Eine globale Promotion `DEFINED -> INCLUDED` ist
ausgeschlossen. Vor jeder Vorteilsaussage ist danach ein eigener typisierter
Bedingungs- und Teilmengenvergleich erforderlich.

## 102. FE-C02 Objektmitgliedschaft – Proof-Persistenz abgeschlossen

`5e5a5cf51` führt `SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_V1` und den
FE-Katalog `v0.11` ein. Die Verträge unterscheiden gerichtete Zugehörigkeit
von gerichteter Nichtzugehörigkeit und transportieren keine Deckungswirkung.
Prepared Evidence hält den Proof nur serverintern; der Selected-Source-Replay
validiert ihn gegen Worksheet, Katalogvertrag, Originalbytes, PageMap und
Dokumentfingerprint. Atomic Sources erhalten anschließend eine private Kopie.
`6ee2f959f` formatiert die betroffenen Dateien; `ee9d0493a` korrigiert die
zweite, beim ersten Mac-Lauf sichtbar gewordene Produktprofil-Erwartung.

```text
Mac Studio: 8 Suites / 239 Tests PASS
Baseline: QA/FE-C02-BASELINE-6D3A455A-20260903
Baseline-SHA: 95e9dee7d9a21c98df954bb84e8df17aa1e5f5f9b30b7fced95140948742755f
Nachlauf: QA/FE-C02-MEMBERSHIP-EE9D0493-20260903
Nachlauf-SHA: 0c61bb884735248216ec71db140d38419ee3be216ab3a0970be4ee0a64227b74
Ergebnisdelta: keines
Call-Delta: keines
Persistierte B-Kanten: 2
```

Offen bleibt der outcome-neutrale Paket-Audit für die vollständige Kette
`Feuer/Wohngebäude -> EABS 2023 -> Gebäude -> Haustechnik -> Photovoltaik`
einschließlich Editionsmatch, Bedingungen, Konflikt und Rang. Erst danach darf
ein eigener Entscheidungsvertrag vor dem allgemeinen Paketstatus-Gate geprüft
werden. R69-A bleibt `10/40`; kein Vollrun und kein Deployment.

## 103. FE-C02 Membership V2 – Qualifier-Provenienz ergänzt

`996ea4be0`/`3a35c2924` versionieren den Membership-Beweis auf V2 und binden
den vollständigen Listenpunkt samt Seite, Offsets und SHA als
`memberContextSpan`. Das Ergebnis bleibt unverändert; die Erweiterung ist die
Voraussetzung, um Bedingungen der nächsten gerichteten Elternkante ohne
Textverlust fortzutragen.

```text
Mac Studio: Format PASS; 8 Suites / 239 Tests PASS
Artefakt: QA/FE-C02-QUALIFIER-3A35C292-20260903
Summary: 7c428399e5b9906d68c44de842b08bba6a705f0328623ebbe65ea51e852350e6
Ergebnis-/Call-/Terminal-Delta: keines
```

Nächster Schritt ist die outcome-neutrale Extraktion von
`BUILDING_TECHNICAL_INSTALLATION -> BUILDING` aus demselben aktiven
Bedingungsdokument. Kein Vollrun und kein Deployment.

## 104. FE-C02 Membership V3 – Elternkante real belegt

`68ad285f3` bis `70c18d2cb` erweitern den FE-C02-Vertrag um die gerichtete,
sourcegebundene Unterstützungskante
`BUILDING_TECHNICAL_INSTALLATION -> BUILDING`. Sie wird ohne künstliche
Vergleichskomponente aus demselben kontrollierten Worksheet-Parser gewonnen,
im Requirement- und Zertifizierungsdigest gebunden und als outcome-neutraler
Atomnachweis persistiert.

```text
Commit: 70c18d2cb06b9823ca6b8639f347d6cd3e3a55e6
Mac Studio: Format PASS; 8 Suites / 239 Tests PASS
Artefakt: QA/FE-C02-PARENT-70C18D2C-20260903
Summary: 6cefb22c4b86f7fe0c007c784a3fb4bf76de94a6a74e5840c0af05deb75b78f2
Target Selection: f3c201fa0c7921bdee91f50a70e7871bbe24459a51fe21aa8b2904b335b40892
Ergebnis: unverändert A BELEGT / B TEILBELEGT / UNKLAR
Aufrufe: unverändert 2 Triage / 0 Effects
Persistierte Elternkanten in B: 1
```

Der reale Proof trägt alle drei Bedingungen des Listenpunkts. Seine
Kontextspanne schließt derzeit jedoch bereits die unmittelbar folgende
Objektklassifikationsüberschrift ein. Das ist kein falscher Membership-Fund,
aber eine unnötig weite Beleggrenze. Vor dem Paket-Audit wird deshalb
`structuralBoundaryLineStarts()` so gehärtet, dass ein neuer
Objektklassifikations-Governor die vorherige Listeneinheit beendet. Erst ein
erneuter Zehn-Dokument-Lauf darf diesen Punkt schließen.

Kein Vollrun, keine Ergebnisfreigabe und kein Deployment.

## 105. FE-C02 Membership V4 – nächste Klassifikationsgrenze respektiert

`d5fa7a72e` ergänzt `objectClassificationGovernors` in der gemeinsamen
Strukturgrenzenmenge. Der Regressionstest bildet eine positive
Gebäude-Mitgliedschaft direkt vor einer negativen Folgeklassifikation ab und
fordert, dass deren Überschrift nicht in den vorherigen Listenpunkt gelangt.
Vertrag, Katalog und Produktprofil wurden auf V4/v0.14/V89 erhöht.

```text
Mac Studio: Format PASS; 8 Suites / 239 Tests PASS
Artefakt: QA/FE-C02-BOUNDARY-D5FA7A72-20260903
Summary: 2b1cce10adaa1635a6c937b6a0f464f6b3d0d44e5e3d237c51b392aa4ee4d3d4
Target Selection: bfe8938b65efb1cdcef544b104c29e160c8e107acd798e88b0d1a31a9692a8ae
Elternproof: da49981d791755ff6d48d9a73a5826caa34ed30e11844f2f714970a4428b0a8d
Belegspan: 1893–2120; nächste Überschrift ausgeschlossen
Ergebnis-/Call-/Terminal-Delta: keines
```

Damit sind beide gerichteten Objektkanten und die Bedingungen präzise
persistiert. Offen sind weiterhin Feuer-/Gebäudeaktivierung, exakter
EABS-Referenz-/Editionsmatch, Konfliktfreiheit und Rang. Diese werden im
nächsten Schritt zunächst nur als Audit materialisiert; die Entscheidung
bleibt unverändert. Kein Vollrun und kein Deployment.

## 106. FE-C02 – scopespezifische Paketreferenz belegt

`b4b97c74c`/`ad8e6b09c`/`9246c4135` implementieren und härten
`SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_V1`; `e0e1fccf2` ergänzt den
eng begrenzten PDF-Join `NeuwertEUR`. Der Proof bindet Feuerüberschrift,
versichertes Gebäude, Referenztitel, Kürzel, quellgelesene Edition,
vollständige Referenzzeile und nächste Spartengrenze an Originalbytes, Seite,
Offsets und SHA. ResultBuilder replayt die Worksheet-Proofs gegen das
servereigene Dokumentartefakt, bevor sie ins Atom gelangen.

```text
Mac Studio: Format PASS; 9 Suites / 247 Tests PASS
Erster Real-Lauf: QA/FE-C02-SCOPED-REFERENCE-9246C413-20260903
Erster Lauf: 0 Proofs; reale PDF-Verklebung NeuwertEUR erkannt
Finaler Real-Lauf: QA/FE-C02-SCOPED-REFERENCE-E0E1FCCF-20260903
Summary: 12c933b31b79242d9cfd6a44828fd297e9415444caf663aed57aaa288bd00dc0
Target Selection: c1b1dbfb8c029e6b0417b53cd9f0e5b1aec553bae83dc45bb5467a0c1714f84d
Final: genau 1 Proof, nur B/DOC-02, FEUER_INSURANCE, EABS@2023
Proof: 5bfa2686a9a3a7a2432bc5d9032d528c9165d2c017311b4f43f101fe3cfd5cbf
Ergebnis-/Call-/Terminal-Delta: keines
```

Der Proof belegt noch nicht, dass B/DOC-10 genau die referenzierte EABS-Ausgabe
ist. Nächster getrennter Schritt ist deshalb
`SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_V1`. Dateiname,
Dokumentrolle und feste Edition bleiben als Join-Kriterien verboten. Kein
Vollrun und kein Deployment.

## 107. FE-C02 – referenzierte Bedingungsidentität belegt

`ff11bf446`/`bc596a5c3` implementieren den sourcegebundenen
Erstseiten-Titelblock-Proof; `73f09df57` lässt mehrere passende Titelblöcke
fail-closed enden. Worksheet und Atomic Fact tragen nur gegen das
Dokumentartefakt replayte Proofs. Der Vertrag enthält keine Wirkung,
Applicability oder Entscheidung.

```text
Mac Studio: Format PASS; 10 Suites / 254 Tests PASS
Artefakt: QA/FE-C02-TERMS-IDENTITY-73F09DF5-20260903
Summary: 744e43ae05536a9328e6607cd1e19c089eb6bce0fc55a64587238ec24c1f87a9
Target Selection: cf561e85872ce6e1e36bee2e2a229be443679b67ef906d97242cb4c6dc1f570e
Identitätsproofs: genau 1, nur B/DOC-10, EABS@2023
Proof: 042612468b3a47f75cc608906d800a02164bce6f13687d7392490d8a02c15148
Scopespezifische Referenz: genau 1, nur B/DOC-02, EABS@2023
Ergebnis-/Call-/Terminal-Delta: keines
```

Damit stimmen Referenz- und Identitätsschlüssel erstmals unabhängig und
sourcegebunden überein. Offen bleiben deren paketweiter Join, typisierte
Forttragung der drei Membership-Bedingungen, Gegenbeweis-/Konfliktprüfung und
Dokumentpräzedenz. Der nächste Commit materialisiert diese Lage nur als Audit;
er ändert kein Kundenergebnis. Kein Vollrun und kein Deployment.

## 108. FE-C02 – Paketaktivierungskette vollständig, Wirkung weiter gesperrt

`e96c1179e`/`476d71401` materialisieren die bisher getrennten Proofs in
`PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_V1`. Der Vertrag verbindet nur
denselben dynamischen Referenzschlüssel, exakt gerichtete Membership-Kanten und
konfliktfreie, vollständig replayte Quellproofs. Er besitzt bewusst keine
Regel `DEFINED -> INCLUDED` und setzt `readyForDecision` selbst bei einer
vollständigen Kette auf `false`.

```text
Mac Studio: Format PASS; 12 Suites / 340 Tests PASS
Commit: 476d71401d1f3b410c550162f642daaefec06543
Artefakt: QA/FE-C02-PACKAGE-AUDIT-476D7140-20260903
Summary: 1031550333b4925e70f8dfc849ba4e5cdfc9219ccf885729f256aae6f0ce6e30
Target Selection: 150778e3ad58d488ec08f884a8b0e63d85c6d3bd4cca5a5a02f7acf9998e4e12
B: EABS@2023, beide gerichteten Kanten, keine Konflikte
B-Status: COMPLETE_SOURCE_CHAIN_REQUIRES_TYPED_CONDITION_AND_PRECEDENCE
A-Status: INCOMPLETE_SOURCE_CHAIN
Ergebnis-/Call-/Terminal-Delta: keines
```

Der Lauf belegt damit erstmals die vollständige B-Quellkette, aber noch nicht
deren konkrete Deckungswirkung. Als nächste getrennte Forward-Fixes sind
erforderlich:

1. die Quellbedingungen `Eigentum`, `nachweisliche Wiederherstellungspflicht`
   und `im Gebäudeneuwert enthalten` als typisierte, sourcegebundene Prädikate
   erhalten und auswerten;
2. danach die gemeinsame Geltung und Dokumentpräzedenz zwischen der
   Feuer-Polizzenreferenz und EABS 2023 prüfen;
3. erst nach einem weiteren realen Zehn-Dokument-Replay entscheiden, ob und
   unter welchen Bedingungen die Kette `INCLUDED` tragen darf.

Keine Ergebnisfreigabe, kein 224-Zeilen-Vollrun und kein Deployment.

## 109. FE-C02 – autoritativer Replay der Supporting-Membership-Kanten

`1fc1cc71f` bis `a881858c4` schließen den im Senior-Review gefundenen
Trust-Boundary-Fehler: Supporting-Membership-Proofs werden nicht mehr direkt
aus dem Worksheet kopiert. Der ResultBuilder validiert das vollständige
Dokumentartefakt, baut die erwartete Proof-Menge neu, vergleicht sie exakt und
persistiert ausschließlich die serverseitige Rekonstruktion.

```text
Mac Studio: Format PASS; 4 Suites / 171 Tests PASS
Commit: a881858c43df290ad10ced051d30cf5f1abff179
Artefakt: QA/FE-C02-MEMBERSHIP-REPLAY-A881858C-20260903
Summary: bb999dd458c3bf10375be44c9ee69abf57fe824af096940b21ce78930acf2cac
Target Selection: 150778e3ad58d488ec08f884a8b0e63d85c6d3bd4cca5a5a02f7acf9998e4e12
Ergebnis-/Proof-/Call-Delta: keines
```

Getestet sind positiver Replay, Proof-Tamper, fehlende und doppelte Proofs
sowie ein fremder `sourceDocumentId`. Der Paket-Audit bleibt outcome-neutral.
Als nächster Sicherheitsfix folgt dessen strikte Kundenmetrik-Validierung.

## 110. FE-C02 – Paket-Audit in der Kundenmetrik abgesichert

`4dc017345`/`d60c74c31` validieren den neuen Audit an der finalen
`validateCustomerComparison()`-Grenze. Eine aktuelle unklare FE-C02-Zeile mit
Paketstatusblocker muss exakt je einen Audit für A und B führen. Geänderte
Digests, Status, Gates, Proof-Mengen, Kontextspannen oder seitenfremde
Dokument-UUIDs werden abgewiesen. Das Produktprofil ist V93/V54.

```text
Mac Studio: Format PASS; 5 Suites / 148 Tests PASS
Commit: d60c74c3174b8fed94617568d4b770956d9cf54d
Artefakt: QA/FE-C02-CUSTOMER-AUDIT-D60C74C3-20260903
Summary: d75124e5caa0ff5ab20cecf78b285bc1edc28c386023b201455b9802e2d9e3ba
Target Selection: 150778e3ad58d488ec08f884a8b0e63d85c6d3bd4cca5a5a02f7acf9998e4e12
Ergebnis-/Proof-/Call-Delta: keines
```

Der technische Audit-Unterbau ist nun replay- und exportseitig abgesichert.
Als nächster fachlicher Einzelbaustein folgt die outcome-neutrale Typisierung
der drei sourcegebundenen Membership-Bedingungen. Kein Vollrun, kein
Deployment.

## 111. FE-C02 – typisierte Membership-Voraussetzungen vollständig

`809ac148c` bis `755f5d374` führen die drei Voraussetzungen der realen
Haustechnik-Elternkante als eigene sourcegebundene Prädikate fort. Der erste
Mac-Studio-Lauf deckte eine globale Alias-Eindeutigkeitsannahme auf;
`3d2cd4dd6` ersetzt sie durch eine auf zwei Möglichkeiten gesättigte Suche
nach vollständigen geordneten Gruppenfolgen. Die Matchersemantik ist als
Condition-Vertrag V2, FE-Katalog v0.19 und Produktprofil V95/V56 versioniert.

```text
Commit: 755f5d3749b7a3e50cab4b9fde4dbeae65b1f87f
Mac Studio: Format PASS; 11 Suites / 356 Tests PASS
Artefakt: QA/FE-C02-TYPED-CONDITIONS-755F5D37-20260903
Summary: 87311f05b74d02cc99a59b2cd7b4a73dabd38e6ab87c8b7d17f061e3cb9c0b04
Target Selection: cd204b9df65eba2588e15c9812d41459ba7d3f31a19bc58bb141ac8f6e6b974b
B: 3/3 Bedingungen COMPLETE; keine Negation; Konjunktion belegt
Ergebnis: unverändert A BELEGT / B TEILBELEGT / UNKLAR
Aufrufe: unverändert 2 Triage / 0 Effects
```

Der Fix entfernt einen falschen technischen Blocker, gibt aber bewusst noch
keine Deckungswirkung frei. Offen sind nun nur der Vergleich der drei
Membership-Voraussetzungen mit dem A-Nachweis und die Dokumentpräzedenz der
paketweit verbundenen EABS-Ausgabe. Kein Vollrun und kein Deployment.

## 112. FE-C02 – globale A-Bedingungsformel vollständig belegt

`d2aee5541` bis `1a15bc7b8` implementieren und härten den eigenständigen
`SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_V1`. `0f163b8ba` bis `263796c06`
verdrahten ihn katalog-, Worksheet-, Requirement-Digest- und atomweit. Der
ResultBuilder baut den Proof aus autoritativen Worksheet-Occurrences neu und
prüft deren Identität gegen die selektierten Prepared Targets; der Modellinput
erhält keine neuen privaten Felder.

Der Mac-Studio-Gate fand und der Forward-Fix `6da7e4778` korrigierte einen
allgemeinen Source-Offsetfehler: Regex-basierte Coverage-Governors hatten
getrimmten Text, aber ungetrimmte Offsets. Text und Span sind nun wieder
identisch replaybar.

```text
Commit: 263796c062cf8a2303cf898dd31eb1962084187a
Mac Studio: Format PASS; 8 Suites / 237 Tests PASS
Artefakt: QA/FE-C02-COVERAGE-FORMULA-263796C0-20260903
Summary: d574b61e8fbff01add62045d4b00f63af60728a35f1eb4c2cca67b3e49faa36a
Target Selection: 12456418ad9653cbc51a411e54b9cfdb5f651a29604c0cef33ce5c8bb9136fae
A-Formelproofs: genau 1, nur DOC-01
Governor: Seite 3
Allgemeines PV-Ziel: Seite 4
Proof: 775c662243dfe64a13b045e158b2a64ee729363c0667c21bcc506fe22bfb01c7
Enger Blitz-/Überspannungs-Treffer im Proof: nein
Ergebnis: unverändert A BELEGT / B TEILBELEGT / UNKLAR
Aufrufe: unverändert 2 Triage / 0 Effects
```

Damit sind beide Vertragsformeln sourcegebunden verfügbar: A als globale
Boolesche Formel und B als vollständige konjunktive Membership-Bedingungsmenge.
Offen ist nur noch ein eigener, side-neutraler Vergleichsvertrag. Er darf
`satisfaction=NOT_EVALUATED` nicht zu einer Tatsachenbehauptung über das
konkrete Gebäude umdeuten. Zulässig ist ausschließlich der Schluss, dass A
einen breiteren vertraglichen Voraussetzungsscope besitzt, wenn `B => A`, aber
nicht `A => B` beweisbar ist. Kein Vollrun und kein Deployment.

## 113. FE-C02 – Bedingungsumfang vollständig verglichen

`65c6b8c0e` bis `5ddf2e9f3` führen den outcome-neutralen
`MEMBERSHIP_CONDITION_SCOPE_COMPARISON_V1` ein und härten seine
Trust-Boundaries. Alle beteiligten Atome müssen `INSURED_OBJECT`, denselben
kanonischen Vergleichsvertrag, denselben Requirement-Digest und dieselbe
deklarierte Komponente tragen. Formula-Proof, Katalogformel,
Membership-Prädikate, Implikationen, Paket-Audit und Source-Atom-Replay werden
fail-closed gegeneinander gebunden.

Eine Architekturprüfung fand rechtzeitig einen CommonJS-Zirkel vom Worksheet
über den Comparison-Layer zurück in den Worksheet-Unterbau. `92d0ccbe8`
entfernte ihn durch ein reines dependency-leaf. Zwei nachfolgende kleine
Commits reparierten ausschließlich kanonische Digestbildung und
Objektisolation in der neuen Testfixture.

```text
Commit: 5ddf2e9f3c0b7ca07d7dd7b847d736455f3a90c9
Mac Studio: Format PASS; 8 Suites / 209 Tests PASS
Artefakt: QA/FE-C02-CONDITION-SCOPE-AUDIT-5DDF2E9F-20260903
Summary: 0afaacb6f62bdcf9989ba8e2d73b5dd2ce14f3cd2ccae2a50548b630c17084aa
Target Selection: cdf7f6e9946923eae3f1ce412290249faaafa9e98282afaa8627befa8f4084aa
Audit: A direkt / B Membership / A strikt breiter / 48 gültige Belegungen
Aufrufe: 2 Triage / 0 Effects
Kundenergebnis: unverändert UNKLAR / Review
```

Der echte Zehn-Dokument-Lauf beweist `B => A` und widerlegt `A => B`. Diese
Stufe behauptet ausdrücklich nicht, dass B ausgeschlossen oder am konkreten
Gebäude nicht erfüllt ist. Offen ist nur die getrennte, replay-validierte
Entscheidungs- und Kundenmetrik-Integration. Kein Vollrun und kein Deployment.

## 114. FE-C02 – Vorteil entschieden und gegen Auslassung abgesichert

`6a64a5357` übersetzt den vollständigen side-neutralen Booleschen Audit in
`VORTEIL_A` beziehungsweise beim Pakettausch `VORTEIL_B`. Der Schluss bewertet
nur den breiteren vertraglichen Voraussetzungsscope; ein Ausschluss oder eine
konkrete Nichterfüllung auf der engeren Seite wird nicht behauptet.

Der Senior-Review fand anschließend eine P1-Lücke: Audit und Atomdigest wurden
nur bei bereits gewählter Spezialentscheidung persistiert. `b7acb4f2f` bis
`daac8477a` führen deshalb Comparison-Schema 13,
`MEMBERSHIP_CONDITION_SCOPE_QUALIFICATION_REPLAY_V2` und Produktprofil
V99/V60 ein. Jede FE-C02-Zeile muss nun unabhängig vom Ergebnis die privaten
vollständigen A/B-Atomprojektionen tragen. Der Customer-Validator rekonstruiert
daraus den erwarteten Audit und erzwingt die exakte Entscheidung. Andere
Kategorien dürfen den Replay nicht tragen; Customer-Read-View, Markdown und
XLSX entfernen ihn vollständig.

Der erste reale Lauf legte eine Digest-Domänenabweichung offen: Der rohe
FE-Katalog ergibt `4a4d…`, das produktiv validierte Worksheet-Requirement auf
allen zehn Dokumenten dagegen `e81f…`. `b40405e63` bindet den Replay an den
normalisierten Worksheet-Digest; `d69130b6e` setzt denselben Anchor bereits in
der Auditbildung durch. Eine globale Digestmigration wurde bewusst vermieden.

```text
Finaler Commit: 6df8f3b069dfde9cf68d05c4238ebaa7046d551e
Mac Studio: Format PASS; 2 Load-Order-Smokes PASS; 6 Suites / 185 Tests PASS
Artefakt: QA/FE-C02-QUALIFICATION-REPLAY-6DF8F3B0-20260903
Summary: 62a2fd833ae33bb786dc52d395840c9e0aa49d046914a1b649039bb2b0feabe4
Customer Validation: d4093178ca685e499a292d96d8381af6b98ec578e269d474fe680685396ea047
Omission Validation: 3adb2de22d8f5878997048092db4709cc5846161b1005b055b97360d67d7fa99
Target Selection: cdf7f6e9946923eae3f1ce412290249faaafa9e98282afaa8627befa8f4084aa
Qualification Replay: 841c122fe316d52af9c83ca0225eeafe266a58451c3c8b6088b65ce877dd0197
Audit: 641f6fc1952fe999272e8779694fc0eb15c51347f8a91f9f356552965322d0fc
A/B: BELEGT / TEILBELEGT
Ergebnis: VORTEIL_A / Review nein
Aufrufe: 2 Triage / 0 Effects
```

Der reale Omission-Loop weist den alten generischen Paket-Review mit
`COMPARISON_FE_C02_CONDITION_SCOPE_DECISION_OMISSION` und einen fehlenden
Replay mit `COMPARISON_FE_C02_QUALIFICATION_REPLAY_REQUIRED` zurück. Gegenüber
dem guten Entscheidungsartefakt `35C29986` bleiben Entscheidung, Audit-Digest,
Paketstatus und Modellaufrufe unverändert; neu ist ausschließlich die
Auslassungssicherheit. Kein 224-Zeilen-Vollrun, kein Deployment.

## 115. Kontrollierter Stop-Checkpoint

Nach Abschluss von FE-C02 wurde die Arbeit auf Nutzerwunsch sicher beendet.
Der fachliche Code endet bei `6df8f3b06`, die vollständige FE-C02-Dokumentation
bei `0afe62062`. Beide Stände sind auf
`origin/codex/polizzenvergleich-v3` gesichert. Der isolierte Mac-Studio-Worktree
stand beim Stop ebenfalls auf `0afe62062`; der installierte Kundencheckout
blieb unverändert.

Es wurde danach kein weiterer Fix, Testlauf, Vollrun oder Deploy begonnen.
Die nur read-only begonnene FE-A05-Analyse hat keine Produktdatei verändert;
die drei Analyseagenten wurden kontrolliert unterbrochen. Wiederaufnahmeziel
ist das vorhandene Artefakt
`QA/FE-A05-A06-EFFECTS-ARTIFACT-GATE-A2B2A662-20260903` mit dem bekannten
Stand `A BELEGT / B TEILBELEGT / UNKLAR` und vier ausgewählten
Object-Scope-Proofs. Vor einer FE-A05-Entscheidung müssen die A/B-Objektmengen
und Bedingungen vollständig aus den persistierten Atomen inventarisiert und
in einem side-neutralen, replaybaren Set-/Bedingungsvertrag modelliert werden.

Der vollständige Wiederanlaufpunkt, die FE-C02-Artefakthashes und die genaue
FE-A05-Fortsetzungsreihenfolge stehen in Abschnitt 10.53 des Target-Loop-
Dokuments. Kein Fortschritt hängt ausschließlich an einem temporären Skript
oder nicht versionierten Chatkontext.

## 116. V3.6.0 – kontrollierte Release-Vorbereitung

Nach ausdrücklicher Nutzerfreigabe wird der gesamte gesicherte
Entwicklungsstand als V3.6.0-Kandidat geprüft. Die Veröffentlichung bleibt bis
zum vollständigen Mac-Studio-Gate gesperrt. Der Releasevertrag verlangt einen
annotierten Tag `v3.6.0`, der exakt auf dem installierten Commit liegt; damit
kann der Doctor keinen ungetaggten oder nur namensgleichen Checkout mehr als
gültigen Release melden.

```text
Release-Vorbereitungs-Ausgangs-HEAD: dc1fa925ccf8c5678e285b13996f2c11c8faa411
Aktuelle Release-Codebasis: 97e3140b4dee734feb611861e9205408759c089e
Installierter Kundenstand: c7d3b16d400ea4d65b558ef091781da5df82d610
Geplanter Release: v3.6.0
Produktprofil: CUSTOMER_CORE_5_V103_SPECIALIZED_QUALIFICATION_REPLAY
Vergleichsvertrag: V64
Ergebnisschema: 14
Main: noch nicht aktualisiert
Tag: noch nicht erstellt
Deployment: noch nicht begonnen
```

Vor `main`, Tag und Deployment folgen vollständige Regression,
Produktionsbuild, FE-A01-, FE-C02- und FE-C07-Entscheidungs-,
Qualifikations- und Auslassungsreplays, VS-08-Worksheet-Trust-Anchor-Prüfung,
frischer Zehn-Dokument-/224-Zeilen-Vollrun, unabhängiger Metrik- und
Favoritenvergleich sowie eine externe Kundendatensicherung. Jeder rote Befund
stoppt die Release-Kette vor dem Deployment.

Der nachgelagerte Release-Review erweitert das Gate um drei Invarianten:

- der getaggte Checkout muss vollständig sauber sein;
- der annotierte Tag muss exakt auf `HEAD` zeigen und auf dem lokal bekannten
  `origin/main` veröffentlicht sein;
- die Neuinstallation prüft diese Releaseidentität vor Abhängigkeitsaufbau,
  Datenbank- oder Dienstmutation.

Positive, fehlende, leichtgewichtige, fremde-HEAD-, Dirty-Checkout- und
nicht-auf-main-veröffentlichte Tagvarianten werden im macOS-Vertragstest
getrennt geprüft. Das spätere Deploymentprotokoll entsteht nach der Abnahme in
einem eigenen Commit; der geprüfte Release-Tag bleibt unveränderlich.

### Release-Härtung vor dem finalen Vollrun

Der erste isolierte Zehn-Dokument-Lauf auf dem Mac Studio verarbeitete alle 50
Kategorien, scheiterte danach jedoch beim Vergleichsaufbau an zwei
Replay-/Projektionsfehlern. Die anschließenden kleinen Forward-Fixes wurden
einzeln versioniert:

- `5a9709e6d` kanonisiert VS-22-Replay-Proofs;
- `b6993994c` erhält einseitige Scope-Provenienz im Replay;
- `b244f7d67` erhält enge Scope-Provenienz im Vergleich;
- `495297ca4` akzeptiert nur nachweisbar zugeordnete enge Überschriften;
- `0c3e85498` bindet VS-08 an den normalisierten Worksheet-Trust-Anchor;
- `3a0ef494e` ergänzt die quellgebundene Qualifikationswiedergabe für FE-A01
  und FE-C07;
- `603a5552d` lässt mehrdeutige Mehrfach-Scope-Zuordnungen bewusst ungelöst;
- `97e3140b4` behebt ausschließlich die danach gemeldeten
  Formatabweichungen.

Ein gespeicherter Replay des ersten Vollruns ist auf dem gehärteten Stand
vollständig validierbar und ergibt 224 Zeilen mit 5 Vorteilen für A, 5
Vorteilen für B, 34 Dokumentationsunterschieden, 122 Gleichwertigkeiten, 12
nicht vergleichbaren und 46 unklaren Zeilen. Dieses Ergebnis beweist nur die
deterministische Wiederverarbeitung der alten Analyseartefakte. Es ersetzt
nicht den noch ausstehenden frischen Vollrun, weil die alten Artefakte die neu
eingeführte Scope-Provenienz nicht enthalten können.

Die zehn konkreten Vorteile wurden unabhängig gegen ihre gespeicherten Quellen
geprüft. Die zuvor vorhandenen vier Vorteile bleiben erhalten. Ein
Regression-Audit fand danach die Scope-Fälle EL-06, EL-09 und EL-10; die oben
genannten Scope-Fixes behandeln deren gemeinsame Ursache fail-closed. VS-21
bleibt dagegen absichtlich unklar, weil seine vorhandenen Fundstellen dem
Haftpflicht- und nicht dem benötigten Gebäudeschaden-Scope zugeordnet sind.

Der letzte vollständige statische Lauf vor `603a5552d` zeigte genau einen
fachlichen Fehler bei einer mehrdeutigen VS-24-Scope-Zuordnung sowie drei
reine ffmpeg-PATH-Fehler der SSH-Umgebung. `603a5552d` behebt den fachlichen
Fehler; der gezielte Mac-Studio-Rerun bestand mit 4 Suites und 94 Tests. Der
abschließende vollständige Test-, Lint-, Installer- und Buildlauf sowie der
frische Zehn-Dokument-/224-Zeilen-Lauf bleiben harte Gates vor `main`, Tag und
Deployment.

## 117. V3.6.0 – erster frischer Vollrun gestoppt und fachlich gehärtet

Der frische, isolierte Mac-Studio-Lauf auf `35308a11a` verarbeitete alle zehn
gebundenen PDFs und alle 50 Kategorien ohne Workerfehler. Die Kundeninstallation
und ihre SQLite-Datenbank blieben unverändert. Der Lauf war technisch gültig,
aber fachlich kein Deployment-GO.

```text
QA-Root: QA/RELEASE-V3.6.0-FULL-35308A11-20260903-163505
Session: 12e1857c-5e39-44f9-96d2-d6bf46ed78f8
Commit: 35308a11a2f7e3f27aacdda304839d2740fcf8ae
Modell: qwen/qwen3.6-35b-a3b
Kontext / Parallelität: 42496 / 1
Workerzeit: 29:35,190
Dokumente / Kategorien / Zeilen: 10 / 50 / 224
Vorteil A / Vorteil B: 5 / 5
Dokumentationsunterschied / Gleichwertig: 34 / 120
Nicht vergleichbar / Unklar / Kundenreview: 10 / 50 / 50
comparison.private.json: e20344910f1ef02fd9fd563127f5cce703a07a0510650422e06aa3bfaede3732
comparison.md: 57f5847c81b0bc0f37a96c6ae53073b819bb29e05f63b5b361ee6be72e3b8daf
XLSX: a763c5a5c8c58e71fe13e17130caea5903c16bf7f3e292165b3b082f52130393
```

Der vollständige 224-Key-Diff gegen gespeicherten Replay und Favoritenlauf
ergab vier Replay-Regressionen: `EL-07` und `EL-11` wechselten von
`NICHT_VERGLEICHBAR` zu `UNKLAR`, `EL-13` und `VS-24` von `GLEICHWERTIG` zu
`UNKLAR`. Gemeinsame Ursache war ein Producer-/Validator-Widerspruch:
`explicitSectionHeadings()` trimmte den Überschriftentext, speicherte aber die
Offsets einschließlich Leerraum. Der strenge source-bound Validator verwarf
die dadurch nicht mehr identischen Spans zu Recht. `7a45a4c09` richtet Text und
Offsets aus; `df0ad7fac` verwendet den korrigierten Start auch zur
Deduplizierung. Der Validator wurde nicht gelockert, und mehrdeutige
Multi-Scope-Überschriften bleiben fail-closed. 174/174 fokussierte Tests waren
auf dem Mac Studio grün.

Der Scope-Fix hätte zwei bereits vorhandene semantische Fehler sichtbar
gemacht. Erstens lag das A-seitige HQ30-Hochwasserlimit im breiten
`CLAUSE_SECTION`-Fenster von `EL-07` und wurde dadurch fälschlich als
Erdbebenlimit extrahiert. `78bce51c3` führt einen allgemeinen, sourcegebundenen
Feldeigentümervertrag ein: Für numerische oder zeitliche Felder von
Gefahrenkomponenten besitzt der kleinste gültige ausgewählte Gefahrenkontext
den Wert; gleich lokale konkurrierende Gefahren werden verworfen. A behält den
Erdbeben-Selbstbehalt von 350 Euro, nicht aber das fremde HQ30-Limit. 130/130
relevante Tests bestanden.

Zweitens war der Vorteil `FE-A09` falsch: Der Beleg nannte nur allgemeine
Explosion beziehungsweise Verpuffung von Gasen und Dämpfen, aber keine Heiz-,
Gas- oder Feuerungsanlage. `a075bc564` macht dafür den bestehenden
`SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_V1` komponentenlokal verpflichtend. Nur
enge Anlagenbegriffe können die Komponente erzeugen; allgemeine Gase, Kessel
oder Rohrleitungen reichen nicht. FE-Katalog v0.22, Produktprofil V102 und
Vergleichsvertrag V63 verhindern die stille Wiederverwendung alter Artefakte.
Die beiden Test-Follow-ups `76f3ae017` und `53dd4c2bc` binden die Trust-Digests
an die normalisierten Worksheet-Verträge. Das abschließende fokussierte Gate
bestand mit 243/243 Tests.

Für `EL-13` reicht derselbe Glasbruch-Hostscope nicht zur Gleichwertigkeit:
Eine Seite belegt die Verglasung der versicherten Gebäude, die andere nur die
Gebäudeverglasung allgemein zugänglicher Bereiche. `a7510e2db` führt deshalb
den opt-in `SOURCE_BOUND_OBJECT_SCOPE_IDENTITY_GATE_V1` ein. Gleiche, exakt
belegte Objektkeys dürfen den regulären Vergleich fortsetzen; unterschiedliche
Keys ergeben side-neutral `NICHT_VERGLEICHBAR`; fehlende, mehrdeutige oder
manipulierte Proofs bleiben `UNKLAR`. Der Vertrag behauptet noch keinen Vorteil
für den breiteren Scope, weil die ebenfalls genannten 10-m²-Grenzen noch nicht
als typisierte Vergleichsfakten modelliert sind. `c1dc185cd` kanonisiert gültige
Verträge unabhängig von ihrer Array-Reihenfolge. 315/315 fokussierte Tests
bestanden.

Aktueller Vorbereitungsstand vor dem neuen Vollgate:

```text
Code-HEAD vor Dokumentationscommit: c1dc185cd4fd18f317c5213d413e3339cd79319e
Produktprofil: CUSTOMER_CORE_5_V103_SPECIALIZED_QUALIFICATION_REPLAY
Vergleichsvertrag: V64
FE-Katalog: fe-occurrence-full-draft-v0.22
EL-Katalog: el-occurrence-full-draft-v0.9
origin/main: unverändert c7d3b16d400ea4d65b558ef091781da5df82d610
Kundeninstallation: unverändert c7d3b16d400ea4d65b558ef091781da5df82d610
Release/Tag/Deployment: nicht freigegeben und nicht begonnen
```

Nächste harte Gates sind der vollständige Mac-Studio-Test-, Lint-, Installer-
und Buildlauf auf exakt dem Dokumentationscommit sowie ein neuer frischer
Zehn-Dokument-/224-Zeilen-Lauf. Erst ein vollständig geprüfter Outcome-Diff
ohne neue falsche Vorteile oder gute Non-Review-zu-Review-Regression erlaubt
`main`, annotierten Tag und Kundenupdate.

## 118. V3.6.0 – finales Vollgate und technisches Kundendeployment

Der abschließende Commit `2804fa56361084c0ee74fca6f54ef6365d65aeeb`
bestand auf dem Mac Studio die vollständige statische Freigabe mit 162/162
Testsuites, 2162/2162 Tests, Lint, macOS-Installerverträgen und
Frontend-Produktionsbuild. Der frische isolierte Lauf verwendete zehn
Dokumente, das Produktprofil
`CUSTOMER_CORE_5_V103_SPECIALIZED_QUALIFICATION_REPLAY`, Vergleichsvertrag V64,
Qwen 3.6 mit 42.496 Token Kontext und Parallelität 1.

```text
QA-Root: QA/RELEASE-V3.6.0-FULL-2804FA56-20260903-182148
Session: 27918d93-4f0d-47a5-88a7-c13e418b05e5
Workerzeit: 29:06,430
Dokumente / Kategorien / Zeilen: 10 / 50 / 224
Vorteil A / Vorteil B: 5 / 4
Dokumentationsunterschied / Gleichwertig: 34 / 125
Nicht vergleichbar / Unklar / Kundenreview: 13 / 43 / 43
```

Der unabhängige 224-Key-Diff bestand. Gegen den vorigen frischen Lauf sank
Review von 50 auf 43; gegen den früheren Favoriten von 69 auf 43. Alle neun
bestätigten Vorteile blieben erhalten, der falsche zehnte Vorteil `FE-A09`
wurde entfernt, und keine abgeschlossene Favoriten- oder Replay-Zeile wurde zu
Review. Die erwarteten Korrekturen für `VS-24`, `EL-06`, `EL-07`, `EL-09`,
`EL-10`, `EL-11` und `EL-13` traten exakt ein. Der separate XLSX-Audit fand
keine Abweichung in 224 mal 17 Kundenzellen.

Der getestete Commit wurde per Fast-Forward nach `origin/main` veröffentlicht
und mit dem annotierten Tag `v3.6.0` unveränderlich markiert. Nach externer
Sicherung unter
`/Users/michaelmischkot/Polizzenvergleich-Backups/pre-v3.6.0-20260903-185658`
installierte der offizielle Updater denselben Commit. Integrierter und
separater Doctor bestanden. Datenbankintegrität, Bestandszahlen, 23 Exporte,
Loopback-Dienste und der ausschließliche Qwen-Laufzeitvertrag blieben erhalten.
Die vollständigen Hashes und die weiterhin geltende Beweisgrenze stehen im
Releaseprotokoll `docs/RELEASE_V3.6.0_DE.md`.

## 119. QA-only LF-Referenzschema und 1-gegen-9-Gegenstückpilot

Auf Nutzerwunsch wurde am 4. September 2026 zusätzlich zur allgemeinen
produktiven Kategorienlogik eine kundennähere LF-IMMO-Referenzsicht erprobt.
Der Katalog `LF_IMMO_REFERENCE_COUNTERPART_PILOT_V1` bindet 35 Punkte in zehn
Ansichten an die exakte 31-seitige LF-Datei. Commit `e6c6cd4de0` bestand im
isolierten Mac-Studio-Checkout 5/5 fokussierte Tests, Prettier und ESLint.

Der echte Lauf mit LF auf A und den neun WEVIG-/Bedingungsdokumenten auf B
beendete 35/35 Punkte. Die Modellrohdaten lauteten 16 direkte, 14 partielle und
5 nicht in den Kandidaten gefundene Gegenstücke. Eine unabhängige Stichprobe
belegte jedoch zwei Retrieval-Misses und mindestens zwei überzogene
Direktzuordnungen. Der Ansatz ist deshalb als zusätzliche Referenznavigation
sinnvoll, aber noch nicht als produktiver Ersatz für atomare Fakten- und
Komponentenverträge freigegeben.

Kanonische Messung, Fehleranalyse und Beweisgrenze:
`../policy-project-documentation/POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md`,
Abschnitt 53.

## 120. Zwei persistente Workspace-Analyseverfahren und kontrollierter LF-A→B-Pfad

Am 4. September 2026 wurde die Nutzerkorrektur als neuer Produkt- und
Routingvertrag umgesetzt: Der Dialog „Neues Workspace“ zeigt keine einzelnen
Fachvorlagen mehr, sondern ausschließlich den gerichteten
`LF_IMMO_REFERENCE_A_TO_B_V1` und den bestehenden vollständigen
`SYMMETRIC_A_B_CORE5_V1`. Die Auswahl wird am Workspace und an jeder
Vergleichssitzung gespeichert; bestehende Workspaces migrieren kompatibel auf
den symmetrischen V3.6.0-Modus.

Der gerichtete Modus erzwingt genau ein LF-Referenzdokument auf A und erlaubt
bis zu neun B-Dokumente. Sein Laufvertrag verwendet keine Embeddings. Er nutzt
PageMap, kontrollierte Occurrence-Worksheets, Qwen-Kandidatentriage,
Prepared-Evidence-Wirkungsprüfung und servereigene Quellen aus dem
V3.6.0-Pfad. Der eigene Ergebnis-Builder iteriert ausschließlich über die 35
versionierten A-Referenzzeilen in zehn LF-Ansichten; `sideBOnlyRows` muss null
bleiben. Mehrteilige Punkte wie Nebengebäude/Limit/Ausschluss,
Glasbruchkosten und Umweltdeckung/Limit/Selbstbehalt wurden in verpflichtende
typisierte Komponenten getrennt.

```text
LF-PR   Produktgrundlage und Geltungsvoraussetzungen                 2 Zeilen
LF-VS   Versicherte Gebäude, Sachen und Grundstücksbestandteile      4 Zeilen
LF-KO   Spartenübergreifende Kosten und Ertragsausfälle              3 Zeilen
LF-FE   Feuerversicherung                                             4 Zeilen
LF-ST   Sturm und Elementargefahren                                   4 Zeilen
LF-LW   Leitungswasser und Deckungsvarianten                          5 Zeilen
LF-GL   Glasbruch                                                     3 Zeilen
LF-HP   Gebäude- und Grundstückshaftpflicht                           3 Zeilen
LF-OK   Ökoschutz, zeitliche und örtliche Geltung                     2 Zeilen
LF-AV   Allgemeine Entschädigungs- und Vertragsbestimmungen           5 Zeilen
SUMME                                                               35 Zeilen
```

Beweisgrenze: Die 35 Zeilen sind ein erster kontrollierter Produktvertrag und
noch kein vollständiges LF-Inventar. Die Implementierung beweist vor dem
Mac-Studio-Gate weder fachliche Trefferqualität noch Laufzeit oder
Generalisierung. Der frühere Dinghy-/Top-5-Pilot bleibt historische
QA-Evidenz und wird vom produktiven Referenzpfad nicht aufgerufen.

## 121. Mac-Studio-Gate und frischer LF-1-gegen-9-Lauf

Der Implementierungscommit
`18d87b7dd4f916139b53946c3f78240aa7703d9b` wurde am 4. September 2026 im
isolierten Mac-Studio-Worktree
`/Users/michaelmischkot/Code/validation-worktrees/workspace-modes-18d87b7dd`
geprüft. Der installierte Kundencheckout blieb unverändert auf
`2804fa56361084c0ee74fca6f54ef6365d65aeeb`. Verwendet wurden Node 22.23.2,
Qwen `qwen/qwen3.6-35b-a3b`, 42.496 Token Kontext und eine aus allen 42
Migrationen frisch erzeugte isolierte SQLite-Datenbank.

Die statischen Gates bestanden vollständig:

```text
Fokussierte Tests: 6/6 Suites, 30/30 Tests
Gesamttests:       166/166 Suites, 2172/2172 Tests
Lint:              Server, Frontend und Collector bestanden
Frontend-Build:    bestanden, 6170 Module
Prisma:            Schema validiert, 42/42 Migrationen auf frischer DB
```

Der anschließende echte Lauf verwendete genau ein LF-Dokument auf A und neun
WEVIG-/Bedingungsdokumente auf B. Er wurde über die produktiven
`PolicyComparison`-Erstellungs-, Upload- und Queue-Verträge gestartet.

```text
Session:                    8969a32b-7cd7-4177-be5c-c060ea7a8a5c
Modus:                      LF_IMMO_REFERENCE_A_TO_B_V1
Profil:                     LF_IMMO_REFERENCE_35_V1_CONTROLLED
Dokumente:                  1 A / 9 B
Dokument-/Kategorieschritte: 100/100
LF-Kategorien / LF-Zeilen:  10 / 35
analysierte A-Zeilen:       35/35
voll belegt / teilbelegt A: 17 / 18
B-only-Zeilen:              0
Gegenstück / teilweise:     2 / 9
Gegenstück unklar:          3
kontrollierter Nullfund:    3
Referenzzeile unklar:       18
Kundenreview:               30
Workerzeit:                 2869 s (47:49)
Modellaufrufe:              526
Prompt-/Completiontoken:    1.351.569 / 28.197
```

Alle 100 Dokument-/Kategorieartefakte wurden materialisiert. Der XLSX-Export
enthält ein Blatt, 35 Datenzeilen plus Kopfzeile und elf Spalten. Die
Ergebnishashes lauten:

```text
comparison.private.json  f7a10799373cf5a479d815b069fc702dfd80ac465000e7cd29060bfe8d9384ad
comparison.md            9eadb50c321faa1f3d4bf20d3691a8651fab5592849f490ab6659f0e34e993e1
polizzenvergleich.xlsx   f78b6b0ab1c366992dbf29f9e8b0390b2137024ff7775ea36bd1973862078990
```

Die Fehlerstichprobe des früheren Piloten verbesserte sich fail-closed:
`LF-VS-02` findet nun ein partielles Nebengebäude-Gegenstück statt eines
Retrieval-Misses; `LF-GL-03` bleibt wegen fehlender Bewachung korrekt
partiell; `LF-HP-03` wird nicht mehr unzulässig als direktes Gegenstück
ausgegeben. `LF-GL-01` bleibt trotz sichtbarem 10-m²-Beleg bereits auf A
teilbelegt und zeigt eine offene Kalibrierungslücke der komponentenweisen
Wirkungsbewertung. Der Lauf ist daher ein technischer Funktionsnachweis, keine
fachliche Freigabe der 35 Status.

Der Referenzrunner ruft weder einen Embedder noch einen Embedding-Endpunkt auf.
Der allgemeine `LMStudioLLM`-Konstruktor protokolliert beim Erzeugen einer
Modellinstanz dennoch ein `NativeEmbedder Initialized`; ohne Aufruf einer
Embed-Funktion wird dabei keine Embedding-Suche oder -Berechnung ausgeführt.

## 122. Vollständiger manueller PDF-Audit der 35 LF-Referenzzeilen

Am 4. September 2026 wurden alle 35 LF-Referenzzeilen und die zugehörigen
Gegenstückstellen in den neun B-PDFs manuell gegen die sichtbaren
Originalseiten geprüft. Daraus entstand vor dem Endlauf eine versionierte
Entwickler-Sollmatrix mit 16 vollständigen, 15 teilweisen und vier
kontrollierten Nullfunden. Der Ausgangsstand `c0b0de626` traf davon 31/35.

Vier wiederverwendbare semantische Lücken wurden anschließend geschlossen:

1. Mietzinsentgang wird auch in den Varianten „Entgang von
   Mietzinseinnahmen“ und „Entgang an Erträgen aus Miet-, Pacht-,
   Leasingverträgen“ erkannt.
2. Das Tabellenformat „Einzelscheiben bis m²: 10“ wird als lokales
   Dimensionslimit gebunden.
3. Bepreiste Erstrisikoleistungen und operative Zusagen mit „ersetzt der
   Versicherer“ werden als eingeschlossene Leistung bewertet; negative
   Varianten bleiben fail-closed.
4. Vertragsgebundene Versicherungssummengrenzen werden als symbolische Limits
   materialisiert, ohne eine Prozentzahl zu erfinden.

Kleine Abschlusscommits: `1ce62e00a`, `16a502186`; reine Formatierung:
`34217eb81`. Der frische 1+9-Lauf wurde auf dem exakten Logikcommit
`16a502186b4eda0bda6b062b39af948205457270` im isolierten Mac-Studio-Worktree
ausgeführt. Er verwendete Qwen `qwen/qwen3.6-35b-a3b`, 42.496 Token Kontext
und keine Embeddings.

```text
Session:                     c10d4c3a-4a0b-404c-b8bf-027b41879979
Run-Signatur:                fdd84a933c8df4aa58090ee8e7dc955d3bfd4d68e3cff7fd8faa01bc1c706b17
Dokumente / Schritte:        10 / 100
Kategorien / Zeilen:         10 / 35
Pflichtkomponenten:          113
A vollständig belegt:        35 / 35
B-only-Zeilen:               0
Gegenstück / teilweise:      16 / 15
kontrollierter Nullfund:     4
A unklar / B unklar:         0 / 0
Kundenreview:                15
Workerzeit:                  20:05,275
Qwen-Aufrufe:                237
Prompt-/Completiontoken:     519.517 / 15.995
manuelle Sollübereinstimmung: 35 / 35
```

Auf dem danach ausschließlich formatierten Commit `34217eb816` bestanden
ESLint für die geänderten Produktionsdateien, 6/6 fokussierte Suites mit
284/284 Tests und die vollständige Serversuite mit 156/156 Suites sowie
2.089/2.089 Tests. Die 35-Zeilen-Matrix wurde auf dem Mac Studio maschinell
gegen die manuelle Annotation geprüft: null Abweichungen. Der installierte
Kundencheckout blieb unverändert auf V3.6.0 (`2804fa563`).

Der vollständige zeilenweise Quellenbefund, Seitenangaben, Korrekturhistorie
und Ergebnishashes stehen in
`docs/LF_REFERENCE_35_MANUAL_AUDIT_DE.md`.

Beweisgrenze: Die 35/35-Übereinstimmung gilt ausschließlich für das bekannte,
versionierte 1+9-Entwicklungsset. Sie ist kein Nachweis eines vollständigen
LF-Inventars, unbekannter Versicherer, beliebiger Vertragsvarianten oder des
99-Prozent-Ziels.

## 123. LF-Referenzvertrag V2 und Release-Härtung

Der anschließende System- und Releaseaudit zeigte fünf zu optimistische
Entscheidungswege im V1-Ergebnisbuilder: unaufgelöste Kandidaten konnten als
kontrollierter Nullfund enden, nicht entscheidungsreife Komponenten konnten
ein Paket vervollständigen, interne Konflikte konnten herausgefiltert werden,
`TERMS`-Evidenz wurde allein aufgrund der Dokumentrolle verdrängt und die
Vertragsidentität blieb trotz geänderter Semantik auf V1.

Die Commits `57eb33903`, `50ee41568`, `b12d34d99`, `4c5992ad0`,
`aa50f38b3` und `273c6ce60` schließen diese Wege und versionieren Profil,
Katalog, Komponenten-, Negativsuch- und Ergebnisvertrag auf V2. Jeder kleine
Fix erhielt einen eigenen Commit und eine fokussierte Mac-Studio-Prüfung.

Die reine Neuauswertung des gespeicherten Endlaufs ergibt unter dem
gehärteten Vertrag 12 vollständige, 13 partielle, vier kontrollierte
Nullfunde, sechs unklare B-Gegenstücke und 19 Kundenreviews. Das ist noch kein
frischer Modelllauf. Die sieben strengeren Einstufungen betreffen
`LF-FE-02`, `LF-ST-03`, `LF-LW-03`, `LF-KO-02`, `LF-KO-03`, `LF-GL-03` und
`LF-OK-02`; Gründe sind Paketkonflikte, unaufgelöste Kandidaten oder fehlende
typisierte Scope-Freigabe.

Zusätzlich sichern `dd3854b31`, `6a752c211`, `bff715d16`, `02d33c475`,
`52db4ca8a` und `62e4fdef6` Update-Quieszenz, Session-/Resultatmodus,
modusabhängige Archive, API-Modusvertrag, sichtbare Template-Ladefehler und
die V3.7.0-Kandidatenidentität. Die jeweiligen fokussierten Mac-Studio-Gates,
der Installertest sowie Frontend-Lint und -Build bestanden.

Vollständige Ursachen, Callgraph-Abhängigkeiten, Vorher-/Nachher-Zahlen und
offene Release-Gates stehen in
`docs/LF_REFERENCE_V2_HARDENING_AUDIT_DE.md`. Bis zum befüllten
V3.6.0-Upgrade-Test, frischen LF-V2-Lauf und frischen symmetrischen
224-Zeilen-Nichtregressionslauf bleibt der Kandidat NO-GO und die
Kundeninstallation unverändert auf V3.6.0.

## 124. Kontrollierte Arbeitsunterbrechung nach frischem LF-V2-Lauf

Die Arbeit wurde am 4. September 2026 auf Wunsch des Auftraggebers sicher
beendet. Der frische LF-V2-Lauf auf `03c584155` ist mit 100/100 Schritten in
20:08,371 abgeschlossen und stimmt ohne Partitionsabweichung mit der zuvor
gespeicherten gehärteten Neuauswertung überein: 12 vollständige, 13 partielle,
vier kontrollierte Nullfunde, sechs unklare B-Gegenstücke und 19
Kundenreviews. JSON und XLSX stimmen in allen 35 mal elf Datenzellen überein.

Der vollständige symmetrische 224-Zeilen-Nichtregressionslauf wurde noch nicht
gestartet. Drei offene Read-only-Einzelquellenaudits wurden kontrolliert
unterbrochen; aus ihnen wurde kein unvollständiger Befund und keine
Codeänderung übernommen. Auf dem Mac Studio läuft kein Vergleichs- oder
Testprozess. V3.7.0 ist weder gemergt noch getaggt noch deployed; der
Kundencheckout bleibt sauber auf V3.6.0 (`2804fa563`).

Der vollständige Wiederaufnahmezustand mit Branch-SHAs, Artefaktpfaden,
Hashes, offenen Gates, First-Hop-Deploymentgrenze und Fortsetzungsreihenfolge
steht in `docs/ARBEITSUNTERBRECHUNG_V3.7.0_2026-09-04_DE.md`.

## 125. Sieben LF-V2-Einzelquellenaudits und kontrollierte Forward-Fixes

Die nach der Unterbrechung fortgesetzten Audits trennten sechs allgemein
behebbare Semantiklücken von einem weiterhin nicht beweisbaren Paketkonflikt.
Kleine Commits korrigieren eine zu breite Bedingungsklausel, den fehlenden
Elementar-Scope der gerichteten Sturmreferenz, gerichtete lokale
Kostendefinitionen sowie Glasüberschrift, Glas-Scope und unlokalisierte
Glaskosten. Eine zunächst sichtbare Nachbarregression von `LF-GL-02` wurde mit
einem deklarationspflichtigen, vollständig validierten engen Sturm-Scope
geschlossen.

Der abschließende gemischte Diagnoselauf auf `60d87bff6` ergibt gegenüber dem
frischen LF-V2-Ausgangslauf 15 statt 12 vollständige, 15 statt 13 teilweise,
weiterhin vier kontrollierte Nullfunde, nur noch eine statt sechs unklare Zeile
und 16 statt 19 Kundenreviews. `LF-FE-02` bleibt als einzige unklare Zeile
offen, weil B02 einen Einschluss elektrischer Energie und B05 einen Ausschluss
„so ferne nicht anders vereinbart“ enthält, ohne dass der derzeitige
Paketvertrag die konkrete Aktivierung beziehungsweise Variantenidentität
beweist. Eine pauschale Rangregel wäre fachlich unsicher und wurde nicht
implementiert.

Der genaue Quellenbefund, alle kleinen Commits, fokussierten Mac-Studio-Tests,
Diagnosepfade, Laufzeiten, Tokenzahlen, Hashes und Beweisgrenzen stehen in
`docs/LF_REFERENCE_V2_SEVEN_FIX_AUDIT_2026-09-04_DE.md`. Die 15/15/4/1-
Partition ist noch kein End-to-End-Releasebeleg, da unveränderte Kategorien
aus verifizierten Vorläufen wiederverwendet wurden. Vollständige statische
Gates sowie frische LF- und symmetrische Gesamtläufe auf einem identischen
finalen SHA bleiben vor Merge, Tag und Deployment verpflichtend.

## 126. Nachgelagerte V3.7-Sicherheitsgrenzen und Finalgate-Freeze

Der unabhängige Review des vollständigen Vorfix-Stands `14c2bb1b0` fand drei
Releaseblocker, die von den bekannten PDFs allein nicht ausgelöst worden waren:

1. Die Triage wies unscopierte Kosten im gerichteten Glasvergleich korrekt als
   `RG_COST_WITHOUT_EXPLICIT_GLASS_LOSS_SCOPE` ab; eine autoritative
   deterministische Bindung konnte diese Ablehnung in der Preparation jedoch
   überstimmen. `2405de721` macht den gemeinsamen Scopevertrag in beiden
   Stufen autoritativ, `82ccabf3a` hält Rollen- und Scopediagnose getrennt.
2. Der erlaubte Sturm-Scope von `LF-GL-02` galt zunächst für alle drei
   Komponenten. `faad2e2ba` macht ihn ausschließlich für `solar_glass`
   wirksam, `a66f91071` persistiert den Komponentenvertrag. Die nachgelagerten
   Commits `f385a75e0`, `9f2b75a0d` und `7de9306b8` schließen Fremdscope-,
   Digest-, Atom- und Profilversionsgrenzen.
3. Im privaten JSON waren `VS-10`, `VS-25`, `ST-01` und `VS-34` gültig
   entschieden, im Kunden-XLSX aber wegen fehlender Rule-ID-Freigaben als
   `UNKLAR` dargestellt. `9065aac91` ergänzt die vier erzeugenden Regeln und
   eine semantische Outcomeprüfung; `6c9cc7ae4` bindet jede neue Freigabe an
   ihre zulässigen Outcomes.
4. `4d27cf5bf` ersetzt die nur für vier Regeln geschlossene Prüfung durch den
   vollständigen versionierten `CUSTOMER_RESULT_RULE_OUTCOME_V1`-Vertrag für
   alle 33 freigegebenen aktuellen und historischen Presenter-Regeln.
5. `e29cbe897` ergänzt die häufigen Formen `Glasschäden`,
   `Glasbruchschäden` und die Bindestrichvariante. `8658d82be` verlangt für
   strukturelle Scope-Hinweise eine source-gebundene Seiten-/Offsetbeziehung
   und macht einen so belegten Fremd-Scope auch gegen angeliefertes `DIRECT`
   oder fehlende Triage autoritativ. `e3a8555b6` und `86a2c7b22` sind reine
   Forward-Korrekturen der zugehörigen Testassertion.
6. `c8b821440` führte den Worksheet-Replay des Requirement-Digests ein. Der
   Mac-Test deckte dabei die unterschiedliche Roh-/Worksheet-Normalisierung
   auf. `95727b701` versioniert den Vertrag deshalb als
   `QA_TARGET_REQUIREMENT_SELECTION_V2_WORKSHEET_REPLAY`; `525e2601e` trennt
   dessen Normalisierung von der unverändert strengen späteren
   Zertifizierungsprüfung.
7. `1be7264e3` bindet Narrow-Aliasfamilien an eine kanonische Scope-Identität
   und lässt beidseitig enge Atome ohne Identität fail-closed. `0d82cc3ea`
   korrigiert ausschließlich die Initialisierungsreihenfolge; `528083b1d`
   begrenzt den Identitätsgate korrekt auf fachlich vergleichbare
   Eng-gegen-Eng-Fälle, ohne den freigegebenen Allgemein-gegen-Eng-Ausgang
   `NICHT_VERGLEICHBAR` zu blockieren.

Die frühere QA-Prüfung verglich das XLSX mit einer durch denselben Presenter
erzeugten Sollprojektion. Sie belegte Serialisierungs-, aber keine unabhängige
Semantikparität. Tatsächlich galt auf `14c2bb1b0`:

```text
JSON: A 5 / B 4 / Doku 34 / Gleich 125 / NC 13 / Unklar 43
XLSX: A 4 / B 4 / Doku 34 / Gleich 123 / NC 12 / Unklar 47
```

Status vor dem finalen Lauf auf Implementierungsbasis `528083b1d`:
`IMPLEMENTIERT, FINALGATES OFFEN`. Erforderlich
sind vollständige statische Gates, ein frischer LF-Lauf, ein frischer
symmetrischer 224-Zeilen-Lauf und ein aus dem geschriebenen XLSX unabhängig
zurückgelesener Outcomevergleich gegen `pointDecision.outcome`. Merge, Tag und
Deployment bleiben bis dahin gesperrt.

## 127. Source-Bindung und atomare Ergebnisveröffentlichung

Der nachfolgende Systemreview erweiterte die Implementierungsbasis bis
`c839a2834`, ohne die fachlich erwartete 35-/224-Zeilen-Partition als bereits
bewiesen auszugeben.

### 127.1 Eingangs- und Profilbindung

- `820a35e46`, `3384e59c8`, `75fd6d183`, `679b6f258` und `49a66cb2b`
  binden Scope-Hinweise, Triage und jeden Evidenzkandidaten an verifizierte
  Dokumentartefakte, physische Seiten und Offsets;
- `cf264f63c` sowie `cfe7d4649` versionieren die dadurch veränderte Semantik
  als Ergebnisschema 15, Produktprofil
  `CUSTOMER_CORE_5_V105_SOURCE_BOUND_TRIAGE` / Vergleichsvertrag V66 und
  LF-Profil `LF_IMMO_REFERENCE_35_V5_SOURCE_BOUND_TRIAGE`;
- V104/V65 und LF-V4 bleiben als explizite historische Identitäten lesbar,
  werden aber nicht als aktueller Produktionsvertrag ausgegeben.

### 127.2 Ergebnis- und Downloadvertrag

- `73db76ec9`, `40aa06d89` und `b656bab16` veröffentlichen JSON, Markdown und
  XLSX erst nach vollständiger Validierung atomar und gemeinsam mit einem
  versionierten SHA-256-Manifest;
- `d270b1272`, `10e6df830` und `1904d8c6f` binden Export und Archivkopie an
  diese Hashkette und prüfen alle 17 symmetrischen beziehungsweise 11
  gerichteten Zellen je Zeile gegen die kanonische Projektion;
- `69f769217` und `123f22538` erlauben nach einem Crash ausschließlich die
  Wiederverwendung eines vollständig validierten, session- und
  signaturgleichen Ergebnissatzes;
- `9448df0fe`, `aaa222924`, `f3ce91589` und `a4b1b6ac6` prüfen gespeicherte
  Resultate vor JSON- und XLSX-Zugriff und senden exakt die verifizierten
  Workbook-Bytes; eine später fehlende Archivkopie macht den internen
  Originalexport nicht unzugänglich;
- `6c55cb27d` schützt die Veröffentlichung durch PID-/Nonce-Claims, verwirft
  nur nachweislich verwaiste Claims und synchronisiert das Elternverzeichnis.

### 127.3 Mac-Studio-Vorprüfung

```text
Implementierungsbasis:       c839a28342b619aa3dcc166d32cf9a7e725ea036
Checkout:                    /Users/michaelmischkot/Code/validation-worktrees/v370-final-ace2b626
Node:                        22.23.2
Jest:                        171/171 Suites, 2317/2317 Tests PASS
Lint:                        PASS
Frontend-Produktionsbuild:   PASS
Prisma validate/generate:    PASS
Migration leer/befüllt:      42/42, quick_check=ok, 0 FK-Fehler
macOS-Installerverträge:     PASS
```

Die installierte V3.6.0-Kundeninstanz blieb dabei unverändert. Diese
Vorprüfung ist noch keine V3.7-Freigabe: Die vollständigen Gates sowie die
frischen LF- und symmetrischen Modellläufe müssen auf dem unveränderten
Dokumentations-Freeze-SHA wiederholt werden.

## 128. Finalgate-Fund: Triage-Promptversion

Der erste LF-Finalgate-Versuch auf `2309a52f4` stoppte nach der vorbereiteten
ersten A-Dokumentkategorie und zwei Modellantworten. Qwen lieferte exakt das in
beiden Triage-Systemprompts verlangte Root-Schema V6; der bereits
source-gebundene Parser verlangt korrekt V7. Der Lauf wurde deshalb mit
`TRIAGE_SCHEMA_VERSION_INVALID: 6` fail-closed beendet und ist kein
Qualitäts- oder Laufzeitnachweis.

Der kleinste allgemeine Forward-Fix hebt die beiden produktiv verwendeten
Promptbeispiele auf V7. Ein Vertragstest bindet künftig beide Promptdateien an
`TRIAGE_SCHEMA_VERSION`, damit Parser- und Promptversion nicht erneut
auseinanderlaufen. Rollen-, Scope-, Kandidaten-, Evidenz- und
Vergleichssemantik werden nicht verändert. Die abgebrochene Session bleibt als
Fehlernachweis erhalten; der Finalgate-Lauf beginnt mit einer neuen Session.

## 129. LF-Finalgate-Differentialaudit: gerichteter Haftpflicht-Scope

Der vollständige LF-Lauf auf `4ce19f37f` terminierte in 1.201.411 ms und sein
Artefaktsatz bestand die unabhängige Hash-, Struktur- und XLSX-Zellprüfung.
Gegen den vollständigen Vorlauf auf `14c2bb1b0` änderte sich genau eine der 35
Zeilen: `RH-03` wechselte von `TEILWEISES_GEGENSTUECK` zu
`REFERENZZEILE_UNKLAR`. Alle anderen Punktentscheidungen blieben gleich.

Der zeilen- und kandidatengenaue Vergleich lokalisiert die Abweichung auf den
unveränderten A-Kandidaten
`candidate:8c11cacc51a87a4c1d91587d11658fdafc9d45467184202499f5e32543ea26ff`:
Die Versicherungssumme für Umweltstörungen von 50 Prozent liegt physisch auf
Seite 19 unter der source-verifizierten Überschrift „Gebäude- und
Grundstückshaftpflichtversicherung“. V6 klassifizierte denselben LIMIT-Span als
`GENERAL`, V7 in diesem Lauf als `NARROW`; die normalisierten Modellnachrichten
sind abgesehen von der erforderlichen Schemaangabe identisch.

Root Cause ist eine Scopevertragslücke, nicht ein geänderter Quelltext: Die
symmetrische Haftpflichtansicht `HP` war bereits mit
`HAFTPFLICHT_INSURANCE` verbunden, ihre gerichtete Entsprechung `RH` jedoch
nicht. `RS` und `RG` besitzen die entsprechende Referenzabbildung schon. Der
kleine allgemeine Forward-Fix ordnet daher `RH` derselben Haftpflichtsparte zu
und nimmt die Ansicht in die strikte Fremdspartenprüfung auf. Ein LIMIT im
echten Haftpflichtabschnitt erhält damit serverseitig `GENERAL`; derselbe Text
in einem Feuerabschnitt wird durch die strikte Fremdspartenbindung als
`MENTION_ONLY` terminiert. Ein katalogseitig ausdrücklich als enger
deklarierter Haftpflichtscope bleibt `NARROW`. Qwen entscheidet weiterhin die
fachliche Rollenpassung und sämtliche Fälle ohne beweiskräftigen
Section-Scope.

Nicht-Ziele sind eine LF-Wortlautregel, eine pauschale Direktbindung von
Umweltklauseln oder eine Aufweichung des Source-/Offsetvertrags. Der Fix
beweist nur die deterministische Scopeparität von `HP` und `RH`; der frische
35-Zeilen-Lauf und der symmetrische Nichtregressionslauf bleiben auf dem neuen
SHA erforderlich.

## 130. LF-Nachlauf: RH-03 repariert, RH-01-Modellrolle driftet

Der frische LF-Vollauf auf `2ec71e4e6` lief auf dem Mac Studio ohne Resume in
1.213.448 ms durch. Die technische Artefaktprüfung bestand: 10 eindeutige
Dokumente, 100 Result-, 100 Triage- und 100 Effects-Reports, null Hybrid- oder
Embeddingziele, vollständige Manifest-Hashkette und null Abweichungen in den
35 mal 11 aus dem geschriebenen XLSX zurückgelesenen Datenzellen.

Der beabsichtigte Fix ist fachlich wirksam: `RH-03` wechselte bei identischem
Quellkandidaten von `REFERENZZEILE_UNKLAR` zu
`TEILWEISES_GEGENSTUECK`; A ist wieder `BELEGT`, B bleibt `TEILBELEGT`.
Der Lauf ist dennoch kein fachlicher Gesamtpass. `RH-01` wechselte im selben
Lauf von `GEGENSTUECK_GEFUNDEN` zu `REFERENZZEILE_UNKLAR`. Suche, Seite,
Offsets und der source-verifizierte Scope sind korrekt und unverändert. Qwen
änderte allein die Rollenbewertung desselben Kandidaten
`candidate:c48a3495b0b68bb1a14737b610a36acaf289f8e75fb9a331f9e262e57b241e88`
von `MATCH` zu `MISMATCH`:

```text
Bei der Gebäudehaftpflichtversicherung steht die jeweils maßgebende
Pauschalversicherungssumme für alle Versicherungsfälle eines Jahres zusammen
maximal dreimal zur Verfügung.
```

Die gerichtete Komponente `RH-01/annual_aggregate` ist korrekt als Bedingung
modelliert; eine Profil- oder Rollenänderung wäre ein größerer Wertvertrag und
ist nicht Teil dieses Fixes. Stattdessen bindet ein enger semantischer Vertrag
eine Haftpflicht-Jahreshöchstleistung nur dann direkt, wenn dieselbe lokale
Klausel die Versicherungssumme, den Jahresbezug und ein ausdrückliches
maximales Vielfaches enthält und der source-verifizierte Abschnitt zur
Haftpflicht gehört. Negierte, optionale, unvollständige und fremdspartige
Formulierungen bleiben ausgeschlossen. Die nachgelagerte Effektentscheidung
ist nur bei ausschließlich direkt gebundenen Kandidaten ohne ungelöste IDs
serverseitig `DEFINED`; andernfalls bleibt der normale fail-closed Pfad aktiv.

Die erste fokussierte Mac-Prüfung des neuen Vertrags wies zwei präzise
Testvertragskorrekturen nach: Die servereigene Scope-Auflösung behält als
Provenienzgrund `MATCHING_CATEGORY_SECTION`, während die neue RH-Basis nur die
Rollenauflösung trägt. Außerdem muss die semantisch gleichwertige Form
„höchstens das Dreifache der Versicherungssumme“ neben den
Pauschalsummenformen ausdrücklich akzeptiert werden. Der zugehörige
Forward-Fix ändert weder Scope noch Ergebnisaggregation.

Die zweite fokussierte Prüfung zeigte, dass die erste Regex-Erweiterung wegen
zweier benachbarter, ähnlich aufgebauter Verträge irrtümlich den bestehenden
`HP-02`-Anker statt des neuen `RH-01`-Ankers erweitert hatte. Der nächste
Forward-Fix setzt `HP-02` bytegenau auf seinen bisherigen Summenanker zurück
und ergänzt `Versicherungssumme` ausschließlich im gerichteten RH-Vertrag.

Der vollständige Laufbeweis einschließlich Zeilenpartition, Hashes und
Gate-Urteil liegt außerhalb des Repositorys im privaten QA-Root als
`FACHLICHER_LF_LAUFBERICHT_DE.md`. Nach diesem separaten Forward-Fix sind ein
fokussierter Mac-Test und erneut ein frischer LF-Vollauf auf dem neuen SHA
verpflichtend. Der symmetrische Lauf, Merge, Tag und Deployment bleiben offen.

## 131. LF-Gate bestanden und Source-Artefaktvertrag der Shell-Runner

Der frische LF-Vollauf auf `67dcb847a` bestand in 1.205.808 ms sowohl den
technischen als auch den fachlichen Gate. Die unabhängig nachgerechnete
Partition lautet:

```text
GEGENSTUECK_GEFUNDEN                         15
TEILWEISES_GEGENSTUECK                      15
KEIN_GEGENSTUECK_NACH_KONTROLLIERTER_SUCHE   4
REFERENZZEILE_UNKLAR                          0
GEGENSTUECK_UNKLAR                            1
```

`RH-01` ist wieder beidseitig `BELEGT`; `RH-03` bleibt A `BELEGT` und B
`TEILBELEGT`. Gegen `2ec71e4e6` änderte sich ausschließlich `RH-01`. Alle 35
mal 11 XLSX-Datenzellen stimmen mit dem kanonischen JSON überein. Nach der
verbindlichen Kundenmetrik existiert genau eine echte unklare Zeile:
`LF-FE-02 (RF-02)`. Das gespeicherte Feld `customerReviewRequired=16` ist die
breitere interne Altzählung einschließlich Teilbelegen und darf nicht als
Kundenreviewzahl berichtet werden.

Der anschließende Runner-Audit bestätigte eine davon unabhängige technische
Lücke seit dem source-gebundenen Triage-Vertrag: Drei manuelle QA-Shellpfade
reichten das bereits vorhandene Dokumentartefakt nicht vollständig an Triage
und Effects weiter. Nichtleere Worksheets würden deshalb vor der fachlichen
Prüfung fail-closed abbrechen.

Der kleine Runner-Fix:

- übergibt im All-Category- und Hybrid-Shadow-Runner das bereits einmal
  erzeugte `document.private.json` zusätzlich an die Triage;
- lässt den historischen VS-A/B-Runner beim bestehenden Worksheet-Parsing
  genau ein Dokumentartefakt erzeugen und reicht dasselbe Artefakt an Triage
  und Effects weiter;
- ergänzt statische und dynamische Shell-Harness-Verträge, die fehlende oder
  nicht existente Artefakte ablehnen.

Es entstehen dadurch keine zusätzlichen Modellaufrufe und kein zweites
PDF-Parsing. Vergleichs-, Evidenz- und Produktsemantik bleiben unverändert.
Da dieser Fix einen neuen SHA erzeugt, müssen LF- und symmetrischer Finalgate
auf dem resultierenden gemeinsamen Release-SHA wiederholt werden.

Die erste Runner-Prüfung bestand alle 18 fokussierten Vertragstests. Der
Server-Lint beanstandete ausschließlich den Prettier-Zeilenumbruch des zuvor
ergänzten RH-Basisvergleichs; ein eigener semantikneutraler Format-Forward-Fix
stellt den vollständigen Lint-Gate wieder her.

## 132. Symmetrischer Finalgate: strukturgebundene Konzeptfenster

Die vollständigen statischen Gates auf `eb7004273` bestanden auf dem Mac
Studio: 171/171 Jest-Suites, 2.335/2.335 Tests, Repository- und Server-Lint,
Frontend-Produktionsbuild, macOS-Installerverträge sowie Prisma validate und
generate. Alle 42 Migrationen liefen auf einer leeren Datenbank und auf einer
Kopie der Kunden-SQLite-Datenbank; `quick_check=ok`, null
Fremdschlüsselfehler und unveränderte Zeilenzahlen in 35 Fachtabellen.

Der frische LF-Fünferlauf auf demselben Commit terminierte ohne Resume in
1.198.772 ms. Seine unabhängige Prüfung bestätigte 10 Dokumentartefakte, je
100 Result-/Triage-/Effects-Reports, 237 Qwen-Aufrufe, null Hybrid- oder
Embeddingziele, null XLSX-Zellabweichungen und die unveränderte Partition
15 vollständig / 15 teilweise / 4 kontrolliert ohne Gegenstück / 0 Referenz
unklar / 1 Gegenstück unklar. Tatsächliche Kundenreviewzahl bleibt genau 1;
die breitere gespeicherte Altzählung 16 enthält zusätzlich Teilbelege.

Der folgende symmetrische Lauf stoppte nach drei Sekunden vor dem ersten
Modellaufruf mit `SOURCE_SCOPE_OCCURRENCE_RANGE_INVALID`. Die neue
Runner-Weitergabe des Dokumentartefakts arbeitete korrekt und machte einen
älteren Producerfehler sichtbar. Der erste falsche Span
(`VS-32/temporary_storage_costs`) verband die Fortsetzungszeile eines
Zwischenlagerungs-Listeneintrags mit dem folgenden Geschwisterpunkt. Sein
Quellspan `[10059,10238)` war source-exakt, lag aber 95 Zeichen außerhalb des
korrekt bei `[9961,10143)` endenden `LIST_ITEM`-Kontexts. Ein Audit der 948
historischen Kandidaten fand genau einen weiteren solchen Widerspruch:
`ST-08` verband dagegen den echten Deckungs-Governor „Zusätzlich versichert
sind Schäden durch“ mit seinem ersten Schnee-/Eisrutsch-Listeneintrag.

Der Source-Validator bleibt unverändert fail-closed. Der generische
Producer-Fix prüft jeden Concept-Search-Span vor der Überlappungsauswahl gegen
denselben Strukturkontext, der später persistiert wird. Spans über
Geschwisterpunkte werden verworfen, bevor ein kürzerer falscher Span den
gültigen Treffer verdrängen kann. Ein nicht als Bullet formulierter,
syntaktisch offener Governor darf mit genau seinem ersten Listeneintrag und
dessen Fortsetzungszeilen verbunden werden; die nächste Bullet-, Leer-,
Heading- oder registrierte Strukturgrenze beendet den Kontext. Direkte
Alias-Treffer bleiben unverändert.

Die symmetrische Produktidentität wird wegen der geänderten Suchsemantik auf
`CUSTOMER_CORE_5_V106_STRUCTURAL_CONCEPT_CONTEXT` / Vergleichsvertrag V67
gehoben. V105/V66 bleibt für gespeicherte Schema-15-Ergebnisse explizit
lesbar. Positive Tests schützen umgebrochene Einzelpunkte und echte
Governor→Erstpunkt-Beziehungen; adversariale Tests verhindern die Vermischung
zweier Geschwisterpunkte und führen das erzeugte Worksheet anschließend durch
den source-gebundenen Triagevertrag. Vor Merge, Tag oder Deployment sind nach
dem Commit erneut fokussierte Mac-Studio-Prüfungen sowie vollständige LF- und
symmetrische Läufe erforderlich.

Der erste Real-Artefakt-Neuaufbau auf dem Fix-SHA bestätigte modellfrei alle
fünf Kataloge: 224 Anforderungen, 326 Fundstellen, 311 Triage-Ziele und null
Source-Range-Fehler. Der falsche `VS-32`-Kandidat ist entfallen; der vollständige
Zwischenlagerungs-Listenpunkt und die echte `ST-08`-Governor→Erstpunkt-Bindung
bleiben erhalten. Ein unabhängiger Review fand vor dem Modelllauf noch eine
zu breite Ausnahme: Ein syntaktisch offener Nicht-Bullet-Satz konnte allein
wegen seiner Form als Governor gelten. Der abschließende Präzisions-Fix lässt
die Ausnahme deshalb nur zu, wenn die Startzeile bereits vom bestehenden
semantischen Parser als expliziter Coverage-Governor mit exakt demselben
Quellbereich registriert wurde. Nummerierte Überschriften und beliebige offene
Fließtextsätze werden adversarial abgewiesen; die nächste Geschwister-Bullet
bleibt auch beim echten Governor ausgeschlossen. Das ist eine Härtung der noch
nicht freigegebenen V106/V67-Semantik und benötigt denselben vollständigen
Finalgate.

## 133. Finalgate-Differential und VS-22-Seitenfortsetzungsbeweis

### 133.1 Tatsächliche Laufdaten auf `7ccef337a`

Der frische LF-Lauf auf dem Mac Studio terminierte ohne Resume in
1.206.334 ms. Er verarbeitete 10/10 Dokumente und 100/100
Dokument-Kategorie-Schritte mit 237 Qwen-Aufrufen, ohne Embedding oder Hybrid.
Alle 35 Ergebniszeilen und 385 Kundenzellen blieben gegenüber dem letzten
fachlich guten LF-Lauf stabil. Die tatsächliche Kundenreviewzahl ist genau
eins (`LF-FE-02 / RF-02`); der gespeicherte breitere Altzähler 16 ist keine
Kundenreviewzahl.

Der symmetrische Lauf auf demselben Commit terminierte ebenfalls ohne Resume
in 1.698.241 ms mit 330 Qwen-Aufrufen. Technische Verträge bestanden: 224
Zeilen, 225 mal 17 Workbookzellen einschließlich Kopfzeile, null
JSON-/XLSX-Outcomeabweichungen und vollständige Artefakt-Hashkette. Die
fachliche Partition lautete:

```text
VORTEIL_A                 4
VORTEIL_B                 4
DOKUMENTATIONSUNTERSCHIED 34
GLEICHWERTIG              125
KEIN_DOKUMENTIERTER_VORTEIL 0
NICHT_VERGLEICHBAR        12
UNKLAR                    45
```

Diese korrigierte Partition ist direkt aus
`comparison.private.json` des Laufs aggregiert und summiert sich exakt auf 224. Die zuvor an dieser Stelle notierte Zahl 12 für
`KEIN_DOKUMENTIERTER_VORTEIL` war ein Dokumentationsfehler: 12 gehört
ausschließlich zu `NICHT_VERGLEICHBAR`; mit beiden 12er-Werten hätte die
Tabelle unmögliche 236 Zeilen ergeben. Für Laufmetriken gelten fortan nur die
aus dem validierten Ergebnisartefakt neu aggregierten sieben disjunkten
Outcomegruppen, deren Summe der eindeutigen Zeilenzahl entsprechen muss.

Gegen den bevorzugten Vorlauf änderten sich exakt drei Zeilen:

1. `VS-22`: `VORTEIL_A` zu `UNKLAR`;
2. `FE-A10`: `NICHT_VERGLEICHBAR` zu `UNKLAR`;
3. `FE-D01`: weiterhin `UNKLAR`, aber A von `BELEGT` zu `UNGEKLÄRT`.

Diese drei Änderungen dürfen nicht als ein einziger Fehlerblock behandelt
werden. `FE-A10` ist auf dem neuen Lauf fachlich sicherer: Der frühere
Nichtvergleichbarkeitsschluss setzte unterschiedliche enge Fahrzeugobjekte
ohne vollständigen source-bound Scope-Vektor gleich. Ein sicherer späterer
Fix benötigt Fahrzeugidentität, Fahrzeugklasse und exakte Objektmenge. Ein
generischer Entscheidungs-Bypass wurde nach Senior-Review vollständig
verworfen. `FE-D01` ist dagegen ein separater Parserfehler an einer
mehrzeiligen kombinierten Spartenüberschrift; die Zeile bleibt in beiden
Läufen unklar und wird in einem eigenen Forward-Fix behandelt.

### 133.2 Root Cause `VS-22`

Der A-Quelltext und das Worksheet sind bytegleich zum bevorzugten Lauf. Das
materialisierte `hazardous_waste`-Atom ist `FOUND`, `INCLUDED`, konfliktfrei,
ohne ungelöste Candidate-IDs und enthält 13 ausgewählte Quellen:

- zwölf `DIRECT`-Quellen mit
  `EXPLICIT_HAZARDOUS_WASTE_COSTS`;
- genau eine `NARROW_SCOPE`-Quelle, Candidate `31b7b46f…`, physische Seite 28,
  Exact-Span `[62612,62632)` und lokaler Kontext `[62602,62796)`;
- der syntaktisch offene Vorläufer `d8d0c9dc…` endet auf Seite 27 mit
  „Behandlung von Sondermüll,“ bei `[62570,62580)`; sein voller
  Klauselkontext endet exakt an der Seitengrenze 62581;
- die Originalbytes bis zum Start der Seite 28 bei 62602 bestehen nur aus dem
  kanonischen Marker `\n\n[DOCUMENT_PAGE 28]\n`;
- `5230e5aa…` belegt getrennt im lokalen 240-Zeichen-Kontext die positive
  allgemeine Mitversicherung;
- das separate Limitatom bleibt `GENERAL`, `DEFINED` und typisiert mit
  3 Prozent, 1,5 Prozent beziehungsweise EUR 7.300.

Die Modellentscheidung `GENERAL_AND_NARROW` ist damit kein Widerspruch und
kein fehlender Schutz. Der alte VS-22-Portfoliovertrag verlangte jedoch
bytegenau `GENERAL` und blockierte deshalb allein den Vorteilspfad.

### 133.3 Kleiner source-bound Forward-Fix

Die verworfene erste Lösung hätte PreparedEvidence und deterministische
Selektion über sechs Dateien und 643 geänderte Zeilen erweitert. Zwei
unabhängige Reviews fanden dort lokale Negations-, Optionalitäts- und
Kontextgrenzen. Diese Änderung wurde vor Test und Commit vollständig
zurückgeführt.

Der kleinere Vertrag arbeitet erst beim Materialisieren der Atome:

- `VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_V1` wird ausschließlich für
  `VS-22/hazardous_waste/GENERAL_AND_NARROW` erzeugt;
- Candidate-IDs und Atomquellen müssen eine eindeutige Bijektion bilden;
- Dokumentfingerprint, physische Seiten, Candidate- und Condition-Offsets,
  Originaltext und SHA-256 werden gegen `document.private.json` replayt;
- genau eine unscoped Narrow-Quelle muss die lokal positive
  Eindringen-/Vermischen-Fortsetzung bilden;
- ein eindeutiger offener Vorläufer muss auf der unmittelbar vorangehenden
  physischen Seite enden; im Bridgebereich sind nur Whitespace und der
  kanonische Seitenmarker zulässig;
- mindestens eine davon getrennte DIRECT-Quelle muss die allgemeine positive
  Sondermülldeckung im selben lokalen Satzteil belegen; eine bloße Definition
  neben einem positiven Satz zu einem anderen Objekt genügt nicht;
- Candidate-Kontexte dürfen ihre deklarierte physische Seite nicht
  überschreiten, und Proof-Fingerprint sowie sämtliche Atomquellen müssen mit
  dem SHA-256 des zugehörigen Dokuments im Paketmanifest übereinstimmen;
- optionale, negierte, Haftpflicht-, Lagerungs-, ScopeKey-, Mehrfach-Narrow-
  und Hash-/Offset-/PageMap-Lookalikes liefern keinen Proof.

Der Portfoliovertrag behält den bisherigen `GENERAL`-Pfad unverändert. Der
neue Mischpfad verlangt zusätzlich den vollständig validierten Proof, zwölf
direkt gebundene beziehungsweise allgemein gesprochen mindestens eine
direkte Quelle, genau eine sichere Narrow-Fortsetzung, keine fremden
ScopeKeys, keine Optionalität, kein ungelöstes Candidate und das unverändert
separate sichere Limitatom. Das vollständige Proofobjekt bleibt im privaten
Atom und im Atomdigest; der Audit weist seinen Contract und Digest aus.

Die Semantik ist als
`CUSTOMER_CORE_5_V107_VS22_SOURCE_BOUND_CONTINUATION` / Vergleichsvertrag V68,
Portfolioaudit V3 und Source-Atom-Replay V2 versioniert. V106/V67,
Portfolioaudit V2 und Replay V1 bleiben über den historischen ausschließlich
`GENERAL` akzeptierenden Pfad lesbar. Das Top-Level-Ergebnisschema bleibt 15.

Status: `IMPLEMENTIERT, TECHNISCHE MAC-STUDIO-GATES UND REAL-ARTEFAKT-REPLAY
BESTANDEN, FRISCHER VOLLLAUF NOCH OFFEN`. Verbindlicher nächster Schritt ist
ein frischer symmetrischer 224-Zeilen-Lauf auf demselben exakten
Implementierungsstand.

### 133.4 Technischer Mac-Studio-Nachweis für `494f0cb74`

Der source-bound VS-22-Fix wurde in den getrennten Commits
`0896e3aaa626bbde8b6ee161f28a176b426cb00b` (Semantik) und
`494f0cb74eed2f2cdfb547b5bab7ccad78e7d061` (ausschließlich Formatierung)
gesichert und auf `origin/codex/polizzenvergleich-v3` veröffentlicht. Alle
Validierungen liefen im isolierten Mac-Studio-Worktree
`/Users/michaelmischkot/Code/validation-worktrees/v370-final-ace2b626` auf
exakt `494f0cb74eed2f2cdfb547b5bab7ccad78e7d061`. Die installierte
Kundenfassung blieb sauber und unverändert auf
`2804fa56361084c0ee74fca6f54ef6365d65aeeb`.

Verbindliche Runtime war Node `v22.23.2` über `fnm exec --using=22.23.2`.
Damit bestanden:

- Prettier auf allen geänderten JavaScript- und Dokumentationsdateien;
- fünf fokussierte Suites mit 145/145 Tests;
- die vollständige Serverregression mit 172/172 Suites und 2.396/2.396 Tests
  in 31,683 Sekunden;
- Server-, Frontend- und Collector-Lint;
- der Frontend-Produktionsbuild;
- Prisma-Schemavalidierung und Clientgenerierung;
- die macOS-Installer-Suite;
- 42/42 Migrationen auf einer neuen temporären Datenbank;
- 42/42 Migrationen auf einer Kopie der Kundendatenbank, mit 35/35 stabilen
  Domänentabellen, unveränderten Zeilenzahlen, `quick_check=ok` und null
  Foreign-Key-Verstößen.

Ein erster Gesamt-Testversuch über den ungepinnten Homebrew-Pfad benutzte
Node `v26.7.0` und scheiterte in der unveränderten Alt-Abhängigkeit
`buffer-equal-constant-time`, weil Node 26 `SlowBuffer` nicht mehr anbietet.
Das ist kein Produktfehler und kein gültiger Release-Gate-Lauf. Derselbe
Commit bestand danach vollständig unter der projektverbindlichen Node-22-
Runtime. Der Worktree war nach den Gates sauber. Noch nicht erbracht ist der
frische modellgestützte 224-Zeilen-Vollvergleich; deshalb ist dies noch keine
Merge-, Tag- oder Deploymentfreigabe.

### 133.5 Real-Artefakt-Replay auf `21841672a`

Der vorhandene modellfreie Stored-Comparison-Replay wurde auf dem Mac Studio
unter Node `v22.23.2` gegen die zehn unveränderten Dokumentläufe des
symmetrischen `7ccef337a`-Laufs ausgeführt. Er las Extraktion, Worksheets,
Targets, Modellwirkungen, angeforderte Felder und Dokumentquellen nur lesend,
materialisierte aber Atome, Punktentscheidungen sowie JSON, Markdown und XLSX
vollständig mit dem aktuellen V107/V68-Code neu.

```text
Commit: 21841672a16529100a8d938916541bf3b4d990ac
Replay-Ausgabe: QA/REPLAY-V3.7.0-VS22-21841672-20260905-031033
Session: b8bb856f-1d63-428f-a10e-745dd2629536
Zeilen: 224
Vorteil A / Vorteil B: 5 / 4
Dokumentationsunterschied / Gleichwertig: 34 / 125
Kein dokumentierter Vorteil / Nicht vergleichbar: 0 / 12
Unklar / tatsächliche Kundenreviewzahl: 44 / 44
comparison.private.json: 2f1f4b76163b8a36baafcdd562b342ac34807419878b9b2e5b93d66f1b7cb4b1
comparison.md: 031534cbf5e2a7601921944b01e69cde8a52a29b7b51f6cfea777ca34ba76587
polizzenvergleich.xlsx: 97f9dee77b0fb9e676eac37b6fa329e1f4532b7d0511b5443e1652b7ce28e8a3
```

Der unabhängige 224-Key-Diff bestand. Exakt eine vollständige Row änderte
sich: `VS:VS-22` von `UNKLAR` zu `VORTEIL_A`; die übrigen 223 vollständigen
Row-Objekte blieben bytegleich in ihrer kanonischen JSON-Darstellung. Der neue
VS-22-Entscheid enthält Portfolioaudit V3, Vergleichsbehandlung V2,
Source-Atom-Replay V2, `GENERAL_AND_NARROW` und den eingebetteten
`VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_V1`-Nachweis. Schema 15,
V107/V68, Kundenmetrik, JSON-/Markdown-/224×17-XLSX-Roundtrip und
Artefakt-Hashkette bestanden. Der Replay isoliert die deterministische Wirkung
des Fixes, ersetzt aber nicht den noch ausstehenden frischen Modelllauf.

### 133.6 Frischer symmetrischer Vollvergleich auf `0090b3ccc`

Nach der Korrektur der alten falsch dokumentierten Outcomezahl und der rein
formatierenden Nacharbeit lief der frische symmetrische Finalvergleich auf dem
Mac Studio im isolierten QA-Root. Vor dem Start waren Worktree und installierte
Kundenfassung sauber, es gab keinen aktiven Vergleichsworker und LM Studio
hatte ausschließlich Qwen 3.6 mit 42.496 Token Kontext geladen. Die erste
Harness-Ausführung erreichte wegen einer in die Shellvariable geratenen
Prisma-Infozeile den Worker nicht; die korrekt erzeugte Session blieb
unverändert `QUEUED`, erzeugte keinen Modellaufruf und wurde danach mit ihrer
bereinigten UUID gestartet.

```text
Commit: 0090b3cccfeb03f3f71a6fefb4e999e055ff4eca
QA-Root: QA/RELEASE-V3.7.0-SYMMETRIC-0090B3CC-20260905-032251
Session: c8813aa8-5853-4425-baec-1caf834e04ea
Run: resume-76ad44490f39c38c3cb81ad4
Modell / Kontext: qwen/qwen3.6-35b-a3b / 42496
Workerzeit: 1.704 Sekunden (28:24)
Dokumente / Kategorien / Resume: 10/10 / 50/50 / 0
Qwen-Aufrufe: 330 (243 Triage, 87 Wirkungsprüfung)
Prompt- / Completion-Token: 742.527 / 22.197
Embedding-/Hybridartefakte: 0
Vorteil A / Vorteil B: 5 / 4
Dokumentationsunterschied / Gleichwertig: 34 / 125
Kein dokumentierter Vorteil / Nicht vergleichbar: 0 / 12
Unklar / tatsächliche Kundenreviewzahl: 44 / 44
comparison.private.json: 0d7262149be6c591714beb457c86a2ede0fd667c680740f35d6a9f057a8dc5c2
comparison.md: 031534cbf5e2a7601921944b01e69cde8a52a29b7b51f6cfea777ca34ba76587
polizzenvergleich.xlsx: ecb8e6d2c550ebacd68108804ac2dace28b3f2b6dfb01ff1394d46e52838b86a
artifact-set-manifest.private.json: 16d93112ffb4352260499edeb2d375b909f9cdb1b8f5b2a6e35320de88a3fb4d
export.private.json: 667bd5b2d9ac37a02c78de6fea778ad276b1b326d4e0cf0517102280820dfaf0
```

Der unabhängig validierte Artefaktsatz bestand Schema 15, V107/V68,
Kundenmetrik, 224 eindeutige Schlüssel, Exportvertrag, JSON-/Markdown-/
224×17-XLSX-Parität und Archivhashgleichheit. Gegen den frischen
`7ccef337a`-Lauf änderte sich exakt `VS:VS-22` von `UNKLAR` zu `VORTEIL_A`;
die übrigen 223 Outcomes blieben identisch. Der frische Lauf hatte null
Outcomeabweichungen gegen den vorherigen Stored-Comparison-Replay.

Gegen den bevorzugten Lauf `14c2bb1b` blieben alle neun bestätigten
Vorteilsschlüssel erhalten. Der einzige Outcomeunterschied ist der bereits
begründete, sicherere Ausgang `FE:FE-A10: NICHT_VERGLEICHBAR -> UNKLAR`.
Insgesamt 18 Kundenarbeitsblattzellen in acht Zeilen unterscheiden sich:
`VS-18`, `VS-19`, `FE-A05`, `FE-A10`, `FE-D01`, `FE-E16`, `ST-08` und
`ST-21`. Sechs dieser Zeilen ändern ausschließlich Belegtext, Quelle oder die
präzisere Reviewbegründung bei stabilem Outcome; `ST-08` enthält jetzt den
vollständigen source-bound Governor-/Listenbeleg. `FE-D01` bleibt der bekannte
echte Recallfehler: A fiel trotz vorhandener Feuerwehr-/Einsatzkostenklausel
von `BELEGT` auf `UNGEKLÄRT`. Er wird als eigener Forward-Fix behandelt und
nicht mit VS-22 vermischt.

Die installierte Kundenfassung blieb sauber auf
`2804fa56361084c0ee74fca6f54ef6365d65aeeb`; der isolierte Worktree blieb
sauber auf `0090b3cccfeb03f3f71a6fefb4e999e055ff4eca`. VS-22 ist damit für
diese bekannten zehn Dokumente technisch und im frischen Modelllauf belegt.
Dies ist kein unbekannter Versicherer-Holdout und kein 99-Prozent-Nachweis.

### 133.7 LF-Referenzprofil: source-bound A-Zeilenmanifest

Die LF-Referenzstrecke verwendet ab dem Branch
`codex/lf-reference-complete-template` keinen festen Dokument-SHA mehr als
Zulassungskriterium. Der Worker extrahiert Paket A zuerst in das kanonische
Dokumentartefakt, prüft die versionierte LF-Familienstruktur und erzeugt pro
Session ein unveränderliches, gehashtes A-Zeilenmanifest. Jede Manifestzeile
bindet physische Seite, Dokument-Offsets, exakten Quelltext, Text-Hash,
Kategorie, Unterkategorie, Faktenrolle, Scope sowie gefundene Prozent- und
Betragswerte. Bei fehlender Berechnungsbasis bleiben Prozentwert, Basis,
Formel und berechneter Betrag ausdrücklich getrennt; es wird kein Betrag
erfunden.

Die dynamischen LF-Verträge werden ausschließlich aus diesem Manifest gebaut.
Paket B liefert nur kontrollierte Gegenstücke zu diesen A-Zeilen; B-only-Inhalt
erzeugt keine Ergebniszeile. Das bestehende symmetrische Core-5-Verfahren mit
224 Vergleichspunkten und die zwei Workspace-Templates bleiben außerhalb
dieses gerichteten Pfads unverändert. Eine strukturell nicht kompatible
Dokumentvariante bricht fail-closed mit `neues LF-Profil erforderlich` ab.

Der Vertrag verbessert damit Inventarisierung, Persistenz und sichtbare
Abdeckungsdarstellung. Er ist noch kein fachlicher Semantikbeweis für alle
österreichischen Versicherer: Die aktuelle dynamische Gegenstücksuche ist
source-bound und kontrolliert, ein unbekannter Wortlaut kann daher weiterhin
als Review-/Nullfund enden. Vollständigkeit und semantische Korrektheit sind
erst nach versioniertem Experten-Holdout gemäß Produktcharter belegbar.

Bezug: INV-003, INV-004, INV-008, INV-011, FAIL-001, FAIL-005 und ADR-027.

### 133.8 Reviewkorrektur: Rohblockmanifest nicht als Produktprofil zugelassen

Der unabhaengige Nachreview am 6. September 2026 widerlegte die
Freigabefaehigkeit von `126ab03b`. Die 506 gezaehlten Einheiten sind
extraktionsabhaengige Quellbloecke und keine atomaren fachlichen
Vergleichspunkte. Jeder Block erhielt nur eine regex-abgeleitete Rolle und den
vollstaendigen A-Wortlaut als einzigen B-Suchalias. Eine fachlich gleiche
Paraphrase in B konnte dadurch unentdeckt bleiben und dennoch in den
qualifizierten Nullfundpfad gelangen. Prozentbasen, Mehrfachrollen,
seitenuebergreifende Fortsetzungen und die LF-Version wurden nicht belastbar
gebunden.

Weitere Blocker waren ein zu permissiver 8-aus-9-Strukturcheck, eine nur durch
geaenderte Metadaten simulierte „kompatible Revision“, fehlende
Manifestregeneration beim Readback sowie unterschiedliche Profilidentitaeten
in Queue-/Resume- und Ergebnisvertrag. Die gemeldeten 39 Jest- und sechs
Presenter-Tests prueften keinen dynamischen Runner-zu-Resultat-End-to-End-Pfad.
Ein echter LF-1+9-Lauf und die symmetrische 224-Zeilen-Nichtregression wurden
nicht ausgefuehrt.

Der dynamische Rohblock-zu-Ergebnisweg wird deshalb nicht als Produktvertrag
fortgefuehrt. Korrekturcommit
`31334873506f175458db1588bc983796c7b941bb` stellt sicher, dass der Worker
wieder ausschliesslich das versionierte,
kuratiert atomisierte 35-Punkte-Profil verwendet; dessen feste
Dokumentidentitaet bleibt
bis zu einem wirklich versionierten LF-Familien- und Semantikvertrag erhalten.
Der vollstaendige Korrekturbefund und der sichere Ausbaupfad stehen in
`docs/LF_REFERENCE_COMPLETE_TEMPLATE_IMPLEMENTATION_DE.md`.

Die fokussierte Mac-Studio-Pruefung lief im isolierten Worktree
`/Users/michaelmischkot/Code/validation-worktrees/lf-review-313348735` mit
Node 22.23.2. Fuenf Suites mit 40/40 Tests sowie der vollstaendige Server-Lint
bestanden. Qwen 3.6 war mit 42.496 Kontext geladen, wurde fuer diese
bytegenaue Ruecknahme aber nicht aufgerufen. Gegenueber `d266b48ae` sind alle
Produktdateien identisch; uebrig bleiben nur Dokumentation und der Guard-Test.
Der installierte Kundencheckout blieb sauber auf `2804fa563`.

Beweisgrenze: Diese Korrektur verhindert die neue unqualifizierte
Nullfund-/Vorteilsregression. Sie implementiert noch kein vollstaendiges
LF-Inventar. Ein spaeterer Ausbau benoetigt getrennt ein deterministisch
regenerierbares Source-Block-Ledger und ein versioniertes atomisiertes
Semantic-Requirement-Manifest mit Crosswalk, Werte-/Basisrelationen,
adversarialen Tests und frischem Mac-Studio-Endlauf.

### 133.9 Vollstaendiger source-bound LF-Familienvertrag und 1+1-Endlauf

Der in Abschnitt 133.8 geforderte sichere Ausbau ist auf dem Branch
`codex/lf-reference-complete-template` umgesetzt. Das semantikfreie
`SOURCE_BLOCK_LEDGER_V1` inventarisiert fuer das bekannte 31-seitige
LF-Dokument 1.005 Quellbloecke. Das getrennte
`LF_A_SEMANTIC_REQUIREMENT_MANIFEST_V1` materialisiert daraus ueber ein
versioniertes servereigenes Oracle 283 atomare Anforderungen in 13
Kategorien, 631 Komponenten, 116 source-bound Werte, sechs gemeinsame
Wertregeln und eine gemeinsame semantische Regel. Alle B-Kataloge werden nur
aus diesem A-Manifest gebaut; B-only-Inhalte koennen keine Zeile erzeugen.

Der alte feste PDF-SHA ist fuer neue dynamische Laeufe durch einen
wertunabhaengigen Vollstrukturvertrag ersetzt. Echte numerische Aenderungen
werden aus dem aktuellen A-Dokument gebunden. Neue, fehlende, umformulierte
oder umgeordnete operative Struktur bricht fail-closed mit
`NEUES_LF_PROFIL_ERFORDERLICH` ab. Der Readback regeneriert Ledger und
Manifest aus dem gespeicherten A-Dokumentartefakt und prueft die Digestkette.

Ein frischer serieller Mac-Studio-Endlauf auf Produktcode-Commit
`81f9601506a6f27711e00c5cf392e25cabf29058` verwendete exakt ein LF-Dokument
A und ein WEVIG-Dokument B mit Qwen 3.6 und 42.496 Kontext. Er erzeugte 13/13
Kategorien und 283/283 eindeutige Zeilen, null B-only-Zeilen, 16 gefundene, 70
teilweise, eine referenzseitig unklare und 196 gegenstueckseitig unklare
Zeilen. Kontrollierte Nullfunde blieben bei null, weil alle 283 Suchplaene
weiterhin ehrlich `EXPLORATORY_INCOMPLETE` sind. Das XLSX bestand mit einem
Blatt, 12 Spalten und 283 Datenzeilen. Artefakt- und Readbackvalidierung
bestanden.

Die UI-Korrektur `db9f9eba79b7adea5e3dd22e045bec55d3a3973a` zeigt die
tatsaechlichen dynamischen Abdeckungszahlen und uebersetzt eine unbekannte
LF-Struktur in eine verstaendliche Aufforderung fuer ein neues fachlich
geprueftes Profil. Vier fokussierte Mac-Studio-Suites bestanden mit 19/19
Tests.

Der getrennte symmetrische 1+1-Nichtregressionslauf bestand danach auf
`db9f9eba79b7adea5e3dd22e045bec55d3a3973a`: beide Dokumente 224/224
Kategoriezeilen, Paketresultat 5 Kategorien und 224 eindeutige Zeilen,
Outcomeverteilung `13/1/38/126/0/16/30`, Kundenreview 30 sowie XLSX mit einem
Blatt, 17 Spalten und 224 Datenzeilen. Der unabhaengige Ergebnis-,
Artefakt- und XLSX-Validator bestand.

Auf dem nachfolgenden Dokumentations-HEAD bestanden im isolierten Mac-Studio-
Worktree die vollstaendige Serverregression mit 167/167 Suites und
2.336/2.336 Tests, Server- und Frontend-Lint sowie der
Frontend-Produktionsbuild. Der zusaetzliche Root-Gesamttest fand nur die
bekannte Worktree-Umgebungsgrenze der drei unveraenderten
Collector-FFmpeg-Tests; der separate vollstaendige Serverlauf war gruen.

Status: `IMPLEMENTIERT; LF-1+1, SYMMETRISCHER 1+1 UND TECHNISCHE FINAL-GATES
BESTANDEN; KEINE RELEASEFREIGABE OHNE HOLDOUT/FACHABNAHME`.

Beweisgrenze: bekannte LF-Familie und ein bekanntes B-Dokument; keine
Expertenabnahme aller Zeilen, kein unbekannter Mehrversicherer-Holdout und
kein 99-Prozent-Nachweis. Kein Merge, Tag oder Deployment.

### 133.10 Vorlagen-Button, Lauflebenszyklus und lokale Sichtprüfung

Der vollständige Erstellungs- und Startpfad hinter beiden Vorlagen wurde bis
zum Worker gehärtet. Alle drei Workspace-Erstellungsrouten lösen
`analysisMode`, `templateId` und `policyComparisonMode` über denselben
fail-closed Vertrag auf. Widersprüche und explizit leere Werte werden
abgewiesen; nur vollständig fehlende Alt-Clients erhalten den symmetrischen
Standard. Synchrone Speichersperren verhindern doppelte Workspaces bei einem
Doppelklick.

Vergleichsläufe verwenden eine unveränderliche Lease-Nonce, atomare
Statusübergänge und einen begrenzten FIFO-Supervisor. Start, Abbruch,
Dokumentänderung, Reset und Workspace-Löschung prüfen Session, Manifest und
Lease erneut. Ein gespeicherter Prozessbezeichner allein darf keinen Prozess
beenden. Die Löschung räumt Uploads, Laufartefakte und sitzungsspezifische
Exporte auf und bricht bei einem nicht sicher zuordenbaren laufenden Worker
fail-closed ab. Der Artefakt-Readback regeneriert Source-Ledger und
Semantikmanifest aus dem gespeicherten A-Dokument und validiert die gesamte
Digestkette. Interne Dateipfade und Worker-Logs werden nicht an die UI
weitergegeben.

Auf Commit `be607f4133f95e6812e090d8062c2ddf0123b283` bestanden im isolierten
Mac-Studio-Worktree
`/Users/michaelmischkot/Code/validation-worktrees/lf-complete-template` mit
Node 22.23.2 die vollständigen 175/175 Server-Suites mit 2.377/2.377 Tests,
Server- und Frontend-Lint sowie der Frontend-Produktionsbuild. Die
Worker-Grenze verwendete mangels Override den Standardwert eins; in diesem
abschließenden technischen Lauf wurde kein LLM aufgerufen.

Die lokale Browser-Sichtprüfung erstellte über den sichtbaren Vorlagen-Dialog
jeweils genau einen LF- und einen symmetrischen Workspace, obwohl der
Erstellen-Button doppelt betätigt wurde. Je ein synthetisches PDF auf A und B
aktivierte den jeweiligen Start-Button und erreichte den korrekt gespeicherten
Modus sowie den Worker. Das bewusst inkompatible LF-Dokument brach mit
`NEUES_LF_PROFIL_ERFORDERLICH` fail-closed ab; der symmetrische Lauf erreichte
den unveränderten symmetrischen Analysepfad. Das sehr kurze synthetische
Dokument beendete die Analyse vor dem manuellen Abbruchversuch; die
Abbruch-/PID-Rennen sind daher durch die automatisierten CAS- und
Supervisor-Tests abgedeckt, nicht durch diesen Browser-Smoke.

Status: `IMPLEMENTIERT, AUF MAC STUDIO VALIDIERT UND LOKAL SICHTGEPRUEFT;
KEINE RELEASEFREIGABE OHNE HOLDOUT/FACHABNAHME`.

Beweisgrenze: Der Browser-Smoke beweist Verdrahtung, Persistenz und
Laufanstoß, nicht fachliche Vergleichsgüte. Die fachliche 1+1-Evidenz bleibt
die in Abschnitt 133.9 dokumentierte bekannte LF/WEVIG-Paarung. Es gibt
weiterhin keinen unbekannten Mehrversicherer-Holdout und keinen
99-Prozent-Nachweis.

### 133.11 LF-Laufzeit: verworfene Parallel-/Batchversuche und sicherer Replay-Cache

Nutzerproblem / gewünschtes Ergebnis: Der gerichtete LF-Lauf mit einem
A-Dokument und neun B-Dokumenten benötigte bei 613 lokalen Modellaufrufen rund
eine Stunde. Alle 283 A-Zeilen und ihre Reihenfolge müssen erhalten bleiben;
ein vollständiger Lauf muss weiterhin eine validierte Kunden-XLSX erzeugen.

Beobachtete Evidenz: Auf dem eingefrorenen realen Abschnitt `B-01/LR05`
benötigte der serielle Einzelzielweg 233 Sekunden. Zwei gleichzeitig
ausgeführte Einzelanfragen lieferten bytegleiche Triage-, Wirkungs- und
Quellartefakte, reduzierten die Wandzeit aber nur auf 232 Sekunden. Ein
homogener Drei-Ziel-Batch bestand zwar die formalen Validatoren und benötigte
211 Sekunden, änderte jedoch die Triage, sieben Wirkungsentscheidungen und die
ausgewählten Quellen. Beide Ansätze verfehlten damit die Freigabegrenze und
wurden aus dem Produktcode zurückgenommen.

Root-Cause-Klasse: Ressourcen und Prozess. Das lokale MLX-Modell gewinnt auf
dieser Hardware durch parallele Einzelgenerierung praktisch keinen Durchsatz;
gemeinsame Generierungen verletzen trotz isolierter Hülle die semantische
Unabhängigkeit der atomaren Entscheidungen.

Betroffene Verträge: `INV-003`, `INV-004`, `INV-008`, `INV-009`, `INV-011`,
`FAIL-001`, `FAIL-004`, `ADR-017`, `ADR-023`, `ADR-027`.

Sicherer Kandidat: Für den LF-Pfad wird ein sitzungsgebundener,
inhaltsadressierter Cache ausschließlich für bereits erzeugte
Einzelzielantworten eingeführt. Der Schlüssel bindet Phase, Provider,
Modell-ID, Kontextlimit, Temperatur und den Hash der vollständigen
System-/Benutzernachrichten. Der Cache speichert keine Prompt- oder
Dokumenttexte. Jeder Treffer wird vor Verwendung erneut durch den aktuellen
Einzelzielvalidator geprüft; beschädigte oder heute ungültige Einträge werden
aus dem aktiven Namensraum verschoben. Neue Einträge werden erst nach
erfolgreicher Modellidentitäts- und Ergebnisvalidierung atomar publiziert.
Reset/Löschung des sitzungsspezifischen Run-Verzeichnisses entfernt auch den
Cache.

Scope und Nicht-Ziele: Der erste Lauf über bisher unbekannte Dokumente wird
nicht künstlich beschleunigt. Es werden keine Zeilen gefiltert, keine
Modellentscheidungen über mehrere Ziele vermischt und keine Ergebnisse
workspace- oder nutzerübergreifend geteilt. Wiederholungen derselben
Dokumente unter identischen Verträgen sollen dagegen ohne erneute 613
Modellaufrufe auskommen.

Retry-Invariante: Ein vollständig erfolgreicher Phasenreport kann mehrere
Antwortversuche für dasselbe atomare Ziel enthalten. Nur die letzte Antwort
dieses Ziels hat den Phasenvalidator bestanden. Der Seeder veröffentlicht
daher diese akzeptierte Zielantwort unter allen aufgezeichneten
Promptvarianten desselben Ziels; eine Zuordnung auf andere Ziel-IDs bleibt
ausgeschlossen. Der aktuelle Parser validiert auch diese Treffer erneut.

Realer Mac-Studio-Canary auf Commit `7800e3942a2a560f41070f63a8bbcd5dd15fbc10`
verwendete den zuvor problematischen Abschnitt `B-01/LR02`. Das Seeding aus
dem vollständig abgeschlossenen 1+9-Lauf fand 613 Antwortversuche für 610
erfolgreiche Einzelziele und veröffentlichte 613 promptgebundene Einträge.
Der Replay benötigte für 23 Triage- und 11 Wirkungsziele null Modellaufrufe;
Triage-, Wirkungs- und ausgewählte Quellartefakte waren jeweils bytegleich
zum erfolgreichen Originallauf. 77 angrenzende QA-/Policy-Analysis-Suites mit
1.262/1.262 Tests bestanden auf demselben Commit.

Der erste vollständige Cachelauf deckte anschließend noch eine persistente
Altlast auf: Ein bereits vorhandener, formal intakter Cacheeintrag enthielt
den verworfenen Erstversuch von `B-01/LR04`, sodass der Leser ihn korrekt
quarantänisierte und genau einen neuen Modellaufruf ausführte. Commit
`6556b0e1350e448944b7741d9322bd62468e6df5` überspringt beim historischen
Seeding cache-unterstützte Phasenreports und ersetzt einen vorhandenen
Erstversuch nur dann, wenn sein Hash exakt dem nachweislich verworfenen
Versuch desselben Ziels entspricht. Der reale `B-01/LR04`-Canary erreichte
danach 22 Triage- und neun Wirkungstreffer, null Modellaufrufe, null
Schreibfehler und bytegleiche Triage-, Wirkungs- und Quellartefakte.

Messbare Freigabegrenze: Ein realer Cache-Replay muss null Modellaufrufe, null
Cache-Schreibfehler, bytegleiche materialisierte Triage-/Wirkungs-/Quellwerte
und einen vollständigen 1+9-Endlauf mit 283/283 Zeilen sowie validierter XLSX
erreichen. Jede Abweichung beendet den Kandidaten. Dies beweist
Wiederholbarkeit auf bekannten Entwicklungsfixtures, nicht semantische Güte
auf unbekannten Versicherern und keine 99-Prozent-Zuverlässigkeit.

Der vollständige 1+9-Replay auf Commit
`35fb7052d711f09a61b51d73e02a21e2c3e6c301` erfüllte diese Grenze auf dem
Mac Studio. Er benötigte 123,17 Sekunden, verarbeitete 117/117
B-Kategorieprüfungen und verwendete 610 validierte Cachetreffer bei null
Modellaufrufen und null Cache-Schreibfehlern. Das Ergebnis enthält unverändert
13 Kategorien, 55 Unterkategorien, 283 eindeutige A-Zeilen in Quellreihenfolge
und 1.005 A-Quellblöcke; B-only-Inhalte erzeugten null zusätzliche Zeilen.
Die exklusiven Ergebnisgruppen sind 26 gefundene, 79 teilweise gefundene,
null kontrolliert nicht gefundene, eine referenzseitig unklare und 177
gegenstückseitig unklare Zeilen und summieren sich auf 283.

API-Readback, Artefaktset, dynamischer Ergebnisvalidator und XLSX-Download
bestanden. Source-Block-Ledger und Semantic-Requirement-Manifest waren zum
eingefrorenen Baseline-Lauf bytegleich; die 283 A-Zeilen samt Reihenfolge und
Werten waren strukturell gleich, und die XLSX-Spalten A:G waren zellgenau
gleich. Das ist ein Wiederholungsnachweis mit bekannten Entwicklungsfixtures,
kein erster Lauf für unbekannte Dokumente, kein Versicherer-Holdout und kein
99-Prozent-Nachweis.

### 133.12 LF-Gegenstücksuche: enger Discovery-Fix aus dem 177-Fälle-Zweitaudit

Der dokumentgebundene Zweitaudit zeigte mehrere Fälle, in denen das
B-Dokument ein fachlich passendes Gegenstück enthielt, der unvollständige
Suchvertrag dieses aber nicht als Kandidat bereitstellte. Commit
`778f4f6c43f1a9779e2742e3433e575149cd6121` ergänzt deshalb eine getrennte,
versionierte Side-B-Discovery-Schicht. Sie erweitert ausschließlich bestätigte
LF-Anforderungen; A-Oracle, A-Manifest und die 283-zeilige Topologie bleiben
unverändert.

Die neue Schicht deckt PR-01, PR-03, PR-04, PR-05, PR-06 und PR-08 mit
begrenzten exakten Begriffen oder Begriffskombinationen ab. PR-02 wurde bewusst
nicht erweitert, weil die derzeitige Quellkomponente Muttergesellschaft und
Tochtergesellschaften bündelt und ein breiter Alias einen Teiltreffer
fälschlich zum Volltreffer machen könnte. Eine Ausschlussausnahme in PR-05
bindet die exakte Fundstelle über Quelloffsets und behandelt den darin nur
referenzierten Deckungsnamen als `MENTION_ONLY`; direkte Ausschlüsse und der
symmetrische Vergleichspfad bleiben unverändert.

Auf dem Mac Studio bestanden auf dem finalen Commit 187/187 Server-Suites mit
2.499/2.499 Tests und der vollständige Server-Lint. Der frische vollständige
1+9-Lauf mit `qwen/qwen3.6-35b-a3b` benötigte 60 Minuten und 59,628 Sekunden
und schloss 117/117 Kategorieprüfungen ab. Das Ergebnis verbesserte sich von
26 auf 31 gefundene Gegenstücke; teilweise gefundene Zeilen blieben bei 79,
gegenstückseitig unklare Zeilen sanken von 177 auf 172. Die fünf Änderungen
betreffen LR01-001, LR01-003, LR01-004, LR01-005 und LR01-006.

API-Readback, Artefaktmanifest und XLSX-Download bestanden. Source-Block-Ledger
und Semantic-Requirement-Manifest waren zur V3.7.1-Baseline bytegleich; alle
283 A-Zeilen waren nach Abzug der laufabhängigen Dokument-UUID strukturell
identisch, und XLSX A:G war zellgenau identisch. Der Lauf ist ein
dokumentgebundener Nachweis auf bekannten Entwicklungsfixtures, keine
fachliche Expertenabnahme, kein unbekannter Holdout und kein
99-Prozent-Nachweis.

### 133.13 Audit der 79 Teiltreffer und kundenlesbare Review-Arbeitsmappe

Der nicht autoritative Audit aller 79 aktuellen LF-Teiltreffer ist auf dem
Mac Studio am Source-Commit `b759c60607d48a64d19dc8c62b64269285ce927f`
abgeschlossen. Qwen 3.6 lief mit 42.496 Kontext rund 125 Minuten. Der
Gesamtvalidator bestand mit 79/79 Ergebnisrecords und null Findings. Die
maschinelle Verteilung lautet: 9 vollstaendige Gegenstueck-Kandidaten, 52
bestaetigte Teiltreffer, 6 Zeilen ohne entscheidungsreife Komponente, 2
Widerspruchshinweise, 7 Audit-unklare Zeilen und 3 Zeilen ohne zusaetzlichen
Auditfund.

Die manuelle Hochrisikostichprobe aller neun Promotions und beider
Widerspruchshinweise bestaetigte sieben starke Promotionskandidaten. Sie
verwarf die Promotions fuer `LR13-002` und `LR13-012` sowie die angeblichen
Widersprueche fuer `LR09-025` und `LR13-023`; diese vier Zeilen bleiben
Teiltreffer beziehungsweise fachlich offen. Modell-Audit und manuelle
Stichprobe sind in der Kundenarbeitsmappe sichtbar getrennt.

Die wiederverwendbaren Guards verbieten die wirtschaftliche Substitution
unterschiedlicher Kostenarten, verwaiste Limits ohne belegten Gegenstand und
Limit-Rebinds aus blossen Dauer- oder Nebenbedingungen. Abweichende B-Werte
bleiben dagegen als Werte desselben Gegenstands vergleichbar und werden
separat von A ausgegeben. Nach drei nicht bindbaren Zitatversuchen wird nur
die betroffene Komponente fail-closed unklar.

Die Arbeitsmappe `LF-IMMO-Review-V3.7.2-2026-09-08.xlsx` enthaelt 283
LF-Reviewzeilen, 253 komponentenbezogene Auditbelegzeilen und 172 getrennte
Alt-Audit-Hinweise. A:G ist fuer alle 283 Zeilen zellgenau zur validierten
V3.7.2-Referenz, die letzte manuelle Bewertungsspalte ist 283/283 leer und der
XLSX-Fehlerscan ist leer. Der produktive Basiszaehlstand 31 gefunden, 79
teilweise, 172 Gegenstuecke unklar und 1 Referenz unklar bleibt unveraendert.

Vollstaendige Bindungen, Hashes, Einzelfallkorrekturen und Beweisgrenzen sind
in `docs/LF_REFERENCE_PARTIAL_AUDIT_2026-09-08_DE.md` dokumentiert.

Status: `79/79 AUDIT UND KUNDENREVIEW-ARBEITSMAPPE BESTANDEN; KEINE
AUTOMATISCHE PRODUKTMUTATION, KEIN DEPLOYMENT`.

Beweisgrenze: bekannte Entwicklungsdokumente, kein fachlich gelabelter
unbekannter Mehrversicherer-Holdout und kein 99-Prozent-Nachweis. Die sieben
starken Promotionskandidaten benoetigen vor einer Produktuebernahme jeweils
eine semantische Regel, positive und negative Regressionen sowie die
Fachfreigabe.

### 133.14 V3.7.4: binäre LF-Kundensicht und Discovery-V2-Präzisionstranche

Die V3.7.4-Arbeit folgt der persistenten Checkliste unter
`.codex/test-fix-loop/` und trennt drei bisher vermischte Ebenen. Der private
LF-Ergebnisvertrag behält die fünf differenzierten Analyseoutcomes. Neu
erzeugte LF-Ergebnisse tragen zusätzlich den Marker
`LF_REFERENCE_CUSTOMER_PRESENTATION_V1`; nur diese Ergebnisse werden in API,
UI und XLSX auf die binäre Kundensicht `Gefunden`/`Nicht gefunden` projiziert.
Historische V3.7.3-Ergebnisse bleiben ohne nachträgliche Umdeutung lesbar. Die
öffentliche Projektion entfernt private Outcomes, Regelcodes und
Reviewfelder; der sichtbare Status wird aus darstellbarem B-Inhalt,
B-Fundstelle oder darstellbarem Contributor nachgezählt.

Die Ursachenanalyse der offenen und teilweisen Fälle führte nicht zu einem
pauschalen Prompt. Drei voneinander unabhängige Semantikfehler wurden
test-first behoben: `Kosten der/des <Gegenstand>` als lokale Kostengrammatik,
die source-gebundene Fachkategorie für dynamische LR-Anforderungen und
`DURATION` als `CONDITION` statt `LIMIT`. Echte B01-/B06-Canaries bestätigen
die neuen Quellen; abweichende Werte oder fehlende weitere Komponenten
bleiben intern korrekt teilweise belegt.

Die versionierte Datei `lf-dynamic-side-b-discovery.v2.json` ergänzt eng
begrenzte Discovery-Verträge für die bestätigten Komponenten von VS-03,
VS-04, VS-18, VS-21, GL-18, GL-24, HP-02, HP-X01, GLT-02 und GLT-05. Eine
Vollinventur über alle neun bekannten B-Dokumente fand alle zwölf geplanten
Komponenten. Fünf kleine Qwen-Pakete bestanden vollständig. `LR02-021` fand
nur die Messgeräte, nicht die weiter fehlende Ersatzpflicht; `LR08-024`
blieb ausgeschlossen; `LR11-002` fand beide Zeitkomponenten. Die
Negativkontrolle `LR01-008` blieb trotz Kandidat ohne akzeptierte Quelle.

Zwei erste Regelentwürfe wurden nach echten Gegenbelegen verworfen oder
nachgeschärft. Der breite Alias `Versicherungsnehmer selbst` band im
B01-Dokument fälschlich eine Sanitärpflicht und wurde durch vollständige
Ein-/Ausschlussformulierungen einschließlich OCR-Variante ersetzt. Die
Hindernisbeseitigung in GL-18 benötigte eine eng begrenzte positive
Nebenleistungsregel für ausdrücklich inklusive versicherte Beseitigung und
Wiederanbringung; bloße Tätigkeits- oder Prüfverweise bleiben negativ.

Auf dem Mac Studio bestanden am Implementierungscommit
`82e6ab4ab8a5f0a3c0e2a69c0001fbe191d7de7d` das breite betroffene Gate mit
37/37 Suites und 840/840 Tests, der Candidate-Vertrag mit 77/77 und das
Discovery-V2-Profil mit 6/6 Tests. Der frische symmetrische 1+1-Lauf unter
Session `a1c1ee60-f187-42b8-84cb-4975068d4331` verwendete exakt LF SHA
`2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62`
gegen WEVIG-Muster SHA
`a476cc2e0d970c0143e552bd7d901d82abd89324ba4cf316bc7ee3202a8b0b16`.
Er endete in 1.019.345 ms mit 2/2 Dokumenten, 10/10 Kategorien, 224/224
eindeutigen Zeilen, der unveränderten Outcomeverteilung
`13/1/38/126/0/16/30` und Kundenreview 30. Artefaktmanifest, JSON-Reihenfolge
und XLSX mit einem Blatt, 17 Spalten und 224 Datenzeilen bestanden; XLSX
SHA-256 ist
`604485e5d134b335da8659ee3d4c8f0491b1a90be4716e715b452fcf1c0e2560`.

Zwei vorangegangene 1+1-Harnessstarts endeten vor jedem Modellaufruf wegen
fehlender Runtime- beziehungsweise Collector-Abhängigkeitslinks im isolierten
Worktree. Nach Spiegelung der unveränderten installierten Abhängigkeiten war
keine Produktkorrektur nötig. Diese Ereignisse sind als QA-Umgebungsfehler,
nicht als Produkt- oder Modellregression klassifiziert.

Der erste LF-1+9-Endlauf auf RC `c7b4b002e` brach bei B01/LR07 nach 6/117
Kategorie-Dokument-Prüfungen fail-closed ab. Qwen wählte für `LR07-011` die
einzige echte Candidate-ID, fügte aber ein unerlaubtes Feld hinzu; der Retry
verstümmelte dieselbe ID reproduzierbar. Zugleich wurde die positive Klausel
`auf Erstes Risiko` fälschlich als Ausschluss bezeichnet. Die Korrektur ist
nicht ein breiterer ID-Reparaturmechanismus, der die falsche Semantik
durchgelassen hätte, sondern eine allgemeine, enge serverseitige
First-Risk-Positivregel mit negativer Gegenkontrolle. Synthetischer Test und
echter B01/LR07-Canary sind grün; letzterer materialisiert 42/42 Zeilen und
besteht 67/67 Komponenten sowie 67/67 Kontrollen. Wegen der neuen Produktlogik
werden vollständige technische Gates und LF-1+9 auf einem neuen exakten RC
wiederholt.

Auf RC2 `e8e9e94862acf1e48a7f8110382af084e5d37439` bestanden anschließend
190/190 Suites und 2.570/2.570 Tests, alle Lints, Frontend-Build,
Prisma-Validierung und Installer-Suite. Der frische cachefreie Ersatzlauf
`df7d7179-1c49-412b-b2ff-0ec6b1fdc52f` schloss in 44:30,203 mit 10/10
Dokumenten und 117/117 Kategorieprüfungen ab. Die private Verteilung lautet
40 gefunden, 91 teilweise gefunden, 151 gegenstückseitig unklar und eine
Referenzzeile unklar; öffentlich werden 148 `Gefunden` und 135
`Nicht gefunden` dargestellt.

Alle 13 geplanten neuen Fundstellen wurden im Endartefakt bestätigt. Der
einzige öffentliche Rückgang `ST-07` ist eine Präzisionskorrektur: Der alte
Beleg nannte ein Regenablaufrohr in einer Außenmauer und belegte keinen
Fassadenschaden. `LW-G-15` und `HP-18` behalten ihre Fundstellen, zeigen aber
nun korrekt den dokumentierten Einschluss statt des alten falschen
Ausschlusses. Weitere interne Outcomeänderungen betreffen bereits vorher
öffentlich sichtbare Quellen und sind wegen der differenzierten privaten
Diagnose kein zusätzlicher Kundenfund.

Der Lauf verwendete 550 Modellaufrufe, 1.227.028 Prompt-Tokens und 30.618
Completion-Tokens bei null Cachetreffern und null Cache-Schreibfehlern. Das
sind 86 Aufrufe und 17:02,572 Laufzeit weniger als V3.7.3. Strikter
Artefakt-/Export-/API-Readback, 283-A-Zeilen-Parität und die 283×14-XLSX
bestanden. Das Source-Ledger blieb bytegleich; im semantischen Manifest
änderten sich ausschließlich elf beabsichtigte Dauer-/Fristrollen. Die
Kundenkopie `LF-IMMO-Referenzvergleich-V3.7.4-2026-09-10.xlsx` hat SHA-256
`972d6a7db623d71d1f98f32e2e80effde786e9d82421bb4699498e6dbd982b8c`.

Status: `RELEASEFÄHIG; IMPLEMENTIERUNG, TECHNISCHE GATES, 1+1-
NICHTREGRESSION, FRISCHER 1+9-ENDLAUF UND KUNDEN-XLSX BESTANDEN; ANNOTIERTER
TAG, DEPLOYMENT UND DOCTOR FOLGEN NACH DIESEM DOKUMENTATIONSCOMMIT`.

Beweisgrenze: bekannte LF-/WEVIG-Entwicklungsdokumente, keine vollständige
fachliche Expertenabnahme, kein unbekannter Mehrversicherer-Holdout und kein
99-Prozent-Nachweis. `Nicht gefunden` bedeutet ausschließlich, dass der
aktuelle Lauf keine robuste darstellbare Fundstelle lieferte; es bedeutet
nicht automatisch fehlenden Versicherungsschutz.

### 133.15 V3.7.5: vollständiger LF-Retrieval-Shadow mit Dinghy

Der ergebnisneutrale V3.7.5-Shadow inventarisiert den bekannten
V3.7.4-1+9-Lauf vollständig: 283 LF-Zeilen, 631 Komponenten, neun
B-Dokumente, 5.679 Komponenten-Dokument-Zellen, davon 5.278 ohne
CURRENT-Kandidat. Bestehende Funde bleiben als False-Positive-Kontrolle im
Register. BM25, Struktur- und Dinghy-Kanal laufen nur auf CURRENT-Nullzellen;
alle Ausgaben sind exakte Originalspans mit Dokumentfingerprint, physischer
Seite und Offset. Der Produktpfad, die API und die Kunden-XLSX werden nicht
verändert.

Auf dem Mac Studio erzeugte Commit
`ec69212c04ad30ff6be72b8c6d3baa196953b28b` 2.164 CURRENT-, 12.013 BM25-,
18.459 Struktur- und 14.499 Dinghy-Kandidaten sowie 42.429 UNION-Spans. Das
Embedding-Modell `text-embedding-dinghy-law-4b-v1` mit 2.560 Dimensionen war
174,709 Sekunden in 55 API-Batches aktiv. Der sichere Wrapper stellte danach
`qwen/qwen3.6-35b-a3b` mit Kontext 42.496 wieder her. Kundencheckout und
installierter Ergebnisstand blieben sauber und unverändert.

Der auf Commit `87bc6f77305e68eb96bfca72b27282ec152bf88f`
materialisierte Rücktest gegen die exakten Evidenzzitate des früheren
177er-Qwen-Audits misst bei 220 positiven Zitaten: CURRENT 44/220, Dinghy
159/220, deterministische Union 198/220 und vollständige Union 208/220.
Dinghy ergänzt zehn Zitate, die deterministischen Kanäle ergänzen umgekehrt 49
Zitate. Zwölf positive Zitate bleiben offen. Das belegt komplementären
Embedding-Nutzen und zugleich die Überlegenheit des kombinierten Suchpfads.

Der neue `LF_COUNTERPART_GOLD_ORACLE_V1`-Draft umfasst alle 283 Zeilen, 631
Komponenten und 42.429 Kandidaten. Er bleibt vollständig `UNREVIEWED` und
berechnet vor fachlicher Freigabe keine Qualitätsmetriken. Zertifizierte
Abwesenheit verlangt vollständige Dokument- und Kanalbindung sowie zwei
Reviewer.

Nächster Gate: überlappende Kandidaten kompakt zusammenführen, ein kleines
dokumentübergreifendes Qwen-Reviewpaket bei unverändertem 208/220-Rücktest-
Recall bilden, die zwölf Misses mit generischen Aufzählungs-, Negations-,
Subsidiaritäts- und Definitionskontextregeln schließen und erst danach eine
komponentenweise Produktions-Allowlist bewerten.

Vollständige Messwerte, Artefakthashes und Beweisgrenzen stehen in
`docs/V3.7.5_LF_RETRIEVAL_SHADOW_DE.md`.

Status: `SHADOW UND LIVE-DINGHY BESTANDEN; KEINE PRODUKTMUTATION, KEIN
DEPLOYMENT, KEIN GOLD- ODER 99-PROZENT-NACHWEIS`.

### 133.16 Zielkorrektur: dynamisch A-getriebener LF-Vertrag V2

Die Nutzerkorrektur vom 10. September 2026 ersetzt für neue LF-Läufe die
feste 31-Seiten-/283-Zeilen-Familienannahme. Paket A ist das Referenzprodukt
und muss seine Kategorien, Kapitel, operativen Aussagen, Komponenten,
Reihenfolge und Ergebniszeilen bei jedem Lauf selbst bestimmen. Ein neues,
verschobenes, umformuliertes oder in einem weiteren A-Dokument enthaltenes
Element darf nicht mehr mit `NEUES_LF_PROFIL_ERFORDERLICH` aus dem Lauf
fallen. Das bestehende 283-Oracle bleibt Regression und Crosswalk, aber keine
Produktionszeilenquelle.

Der neue Shadow-Laufvertrag heißt `LF_REFERENCE_A_DRIVEN_V2`. V3.7.4,
`LF_IMMO_REFERENCE_A_TO_B_V1`, gespeicherte Ergebnisse und der getrennte
symmetrische A/B-Modus bleiben während der Entwicklung unverändert.

Change Brief:

```text
Nutzerproblem / Ergebnis:
  Neue oder geänderte A-Inhalte müssen automatisch als geordnete,
  source-bound Vergleichszeilen entstehen und gezielt in B gesucht werden.
Beobachtete Evidenz:
  Der aktuelle V3.7.4-Pfad materialisiert 283 Anforderungen aus einem festen
  Oracle und lehnt unbekannte Text-/Strukturänderungen fail-closed ab.
Root-Cause-Klasse:
  Semantikquelle, Segmentierung, Rollenassoziation und Laufvertragsrouting.
Betroffene Verträge:
  INV-001..004, INV-009..011, FAIL-001, FAIL-003, FAIL-005,
  ADR-027..031.
Caller und Seiteneffekte:
  Uploadlimits, Queue/InputManifest, Worker, A-Template, Resume/Readback,
  B-Retrieval, Resultatbuilder, API, UI und XLSX; symmetrischer Pfad getrennt.
Verworfene Negativreferenz:
  126ab03b: Source-Linien direkt als Rows, Einzelrolle, Exact-Alias-Suche.
Scope:
  Modularer Shadow von A-Paket-Ledger über bounded Atomisierung,
  Oracle-Crosswalk, Hybrid-B-Suche und servervalidierte Ergebnisse.
Nicht-Ziele:
  Kein Produkt-Routing, kein Deployment, keine 99-%- oder Holdout-Aussage.
Riskanteste Annahme:
  Deterministische Segmentierung bildet Klauseln, Listen, Tabellen und
  Seitenfortsetzungen ausreichend vollständig für bounded Atomisierung ab.
Messbare Verbesserung:
  100 % terminale A-Block-Abdeckung; 283/283 Legacy-Crosswalk; Mutationen
  erzeugen stabile neue/verschobene Rows; keine B-only-Zeilen.
Realstrukturregression:
  Bekanntes LF A + 1/9 B, zusätzliche A-Dokumente sowie Struktur-, Text-,
  Tabellen-, Cross-Page- und OCR-Mutationen.
Beweisgrenze:
  Synthetische und bekannte Fixtures beweisen keine unbekannte reale
  Versicherer-/Layoutgeneralisierung.
Wissens-Write-back:
  Produktcharter, ADR-031, Architektur Abschnitt 24, KB-Intake und -Index;
  Messungen nach Ausführung zusätzlich in Tests und Erkenntnisse.
```

Verbindliche Arbeitsreihenfolge:

1. Produktcharter, ADR, Architektur, Intake und Tracker korrigieren.
2. `126ab03b` als Negativreferenz gegen die aktuelle Caller-Kette prüfen.
3. Paketfähiges Source-Ledger und stabile bounded Analyse-Units bauen.
4. Terminale Blockklassifikation und streng validierten
   Atomisierungsvertrag implementieren.
5. Dynamisches Manifest und 283/631-Crosswalk als getrennte Schichten bauen.
6. V3.7.5-Kandidatenkanäle pro Komponente/Dokument integrieren und
   klausellokal kompaktieren.
7. Kleine servergebundene Qwen-Gegenstückentscheidungen integrieren.
8. Mutation, Wiederholung, Symmetrie, Lint, Build und E2E ausschließlich auf
   dem Mac Studio prüfen.
9. Erst nach allen Gates Produkt-Routing und Deployment gesondert freigeben.

Implementierungsstand vom 10. September 2026: Der Shadow besitzt nun
getrennte, gehashte Verträge für Source-Units (`LF_A_SOURCE_UNIT_PLAN_V4`),
bounded Klassifikation (`LF_A_BOUNDED_CLASSIFICATION_PROMPT_V6`), das
dynamische Manifest (`LF_A_DYNAMIC_SEMANTIC_REQUIREMENT_MANIFEST_V5`), die
vollständige Komponenten×B-Dokument-Suchmatrix, die Dinghy-Rankings
(`LF_DINGHY_RANKING_RESULT_V2`), Kandidatenkompaktierung und die
komponentenweise semantische Entscheidung
(`LF_COUNTERPART_SEMANTIC_REVIEW_V4`). Generische BM25-/Token-Bausteine sind
aus dem alten LF-Benchmark in ein produktneutrales Retrieval-Modul
verschoben. Bounded Top-K bleibt ausdrücklich Navigation und kann keinen
Nullfund zertifizieren.

Der erste reale A-Klassifikationspilot auf Source-Unit-Plan V3 wurde nach 21
von 60 Batches kontrolliert beendet und vollständig als Negativbeleg
erhalten: 11 Batches bestanden, 10 blieben nach insgesamt 46 Versuchen mit
24 ungeklärten Units offen. Die Logs zeigten zwei allgemeine Ursachen:
vertauschte Prozentwert-/Limitbasis-Komponenten sowie Aufzählungspunkte, deren
Deckungswirkung nur im vorangestellten Governor steht. V4 bindet solche
Governor-Blöcke nun als expliziten Evidenzkontext, ohne ihre einmalige
Blockzuständigkeit zu duplizieren. Auf dem bekannten A-Dokument entstehen
damit weiterhin 1.005 einmalig besessene Blöcke und 388 Units; 44
Listeneinheiten tragen 50 Governor-Beziehungen, maximal zwei Governor je
Einheit. 31 Units sind deterministisch nichtoperativ, 357 benötigen bounded
Klassifikation in 60 Batches.

Am exakten Shadow-Commit `b8c211520` bestanden auf dem Mac Studio Format und
Lint der betroffenen Module sowie 42/42 A-driven Vertrags-, Mutations-,
Retrieval- und Runner-Tests. Der vollständige reale V4-Klassifikationslauf
läuft im isolierten QA-Artefakt
`LF-A-DRIVEN-V2-SHADOW-20260910-B8C21152`; sein Ergebnis ist noch kein Gate.
Die 283 Legacy-Anforderungen und 631 Komponenten sind im Crosswalk-Entwurf
vorhanden, aber ihre vollständige fachliche Abdeckung ist erst nach gültiger
A-Klassifikation und Doppelreview bewiesen. Produkt-Routing, Kunden-XLSX und
Deployment wurden nicht verändert.

Status: `A- UND B-SHADOWVERTRÄGE IMPLEMENTIERT; REALER V4-A-LAUF LÄUFT;
283/631-CROSSWALK, NULLFUND-ZERTIFIZIERUNG, VOLLGATES UND HOLDOUT OFFEN;
KEIN DEPLOYMENT`.

Nachtrag zum kontrollierten A-Pilotzyklus: Der reale V4-Lauf wurde nach
7/60 Batches bewusst beendet und als Negativbeleg erhalten, nachdem eine
Aufzählungsklausel auf Seite 4 mitten im Satz endete und erst nach dem
Seitenmarker auf Seite 5 fortgesetzt wurde. Source-Plan V6 hält nun acht
echte seitenübergreifende Inhaltsfortsetzungen als jeweils eine Unit,
besitzt den Seitenmarker weiterhin separat und blockgenau und bewahrt den
Listengovernor für nachfolgende Punkte. Auf dem bekannten A-Dokument bleiben
1.005/1.005 Blöcke genau einmal besessen; es entstehen 380 Units, davon 349
bounded zu klassifizieren und 31 deterministisch nichtoperativ. Acht
Fortsetzungsrelationen sind interne Blockrelationen; falsch positive
Heading-Verknüpfungen wurden durch Erhalt von `structuralKind` entfernt.

Der erste Sechs-Batch-Pilot nach dem Cross-Page-Fix bestand 6/6, offenbarte
bei der Artefaktprüfung aber eine formal gültige, fachlich falsche Zerlegung
des einen über Seiten umbrochenen Listenpunkts in vier Requirements. Der
neue `logicalSourceSegments`-Vertrag erzwingt deshalb genau eine Requirement
pro Listenmarker, hält dessen Umbruchblöcke zusammen und verhindert zugleich
das Zusammenziehen verschiedener Bullet-Elemente. Weitere gestoppte Piloten
legten getrennt offen: Verwechslung von Terminalklassen und
Komponententypen, reine Produkttitel als operative Definition, typografische
Quote-Glyphen sowie erfundene COVERAGE_EFFECT-Belege in reinen Objektlisten.
Jeder Befund wurde fail-closed erhalten; kein unvollständiger Pilot wurde
als bestanden oder als Produktresultat weiterverwendet.

Am exakten Commit `b653e64ff7d69e29f6ef6f22559b8ff87ff61562`
bestehen auf dem Mac Studio Format und 43/43 A-driven Vertrags- und
Mutationstests. Der aktuelle Manifestvertrag V11 akzeptiert äquivalente
typografische Doppelquotes, bewahrt aber den Originalspan. Vor allem darf
der Server unvollständige Modell-Source-IDs nicht mehr durch einen anderen,
nur textähnlichen Evidenzblock erweitern. Stattdessen nennt
`COMPONENT_SOURCE_TEXT_INVALID` die konkret fehlenden serverbekannten
Block-IDs; Qwen muss sie im Repair ausdrücklich deklarieren. Ein weiterer
Real-Pilot V12 steht aus. Der projektweite ESLint-Aufruf ist unabhängig von
diesen Änderungen derzeit durch die installierte Kombination ESLint 9 /
älteres `eslint-plugin-react` blockiert (`context.getFirstTokens is not a
function`); Format und Jest laufen im isolierten Worktree.

Aktueller Status: `SOURCE- UND ATOMISIERUNGSVERTRÄGE NACH REALBEFUND
GEHÄRTET; NÄCHSTER V12-FRÜHPILOT, VOLLSTÄNDIGE A-KLASSIFIKATION,
283/631-DOPPELREVIEW, B-SUCHE, NULLFUND-ZERTIFIZIERUNG, E2E/XLSX,
VOLLGATES UND HOLDOUT OFFEN; KEIN KUNDEN-DEPLOYMENT`.

### 133.17 A-getriebener V12-Realbefund vor Timeout-Härtung

Der reale V12-A-Klassifikationslauf auf dem Mac Studio wurde am exakten
Quellcommit `b653e64ff7d69e29f6ef6f22559b8ff87ff61562` aus dem isolierten
Worktree `/private/tmp/lf-v2-validate.CJAIPu` gestartet. Sein unveränderter
Laufpfad ist:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-SHADOW-20260910-08E9DC70/qwen-classification-v12
```

Die Eingabe ist Source-Unit-Plan `LF_A_SOURCE_UNIT_PLAN_V6` mit SHA-256
`9f7c392a83b76b9df3e300174642da76fce92ebd10ff729bedacb511c3520485`:
1 A-Dokument, 1.005 Source-Blöcke, 380 Units, 349 zu klassifizierende Units,
31 deterministisch nichtoperative Units, acht Fortsetzungs- und 50
Governor-Beziehungen. `LF_A_BOUNDED_CLASSIFICATION_V4` teilt die 349 Units
in 59 Batches mit höchstens sechs Units beziehungsweise 12.000 Zeichen.

Laufkonfiguration: Runnervertrag `LF_A_BOUNDED_CLASSIFICATION_RUN_V12`,
Promptvertrag `LF_A_BOUNDED_CLASSIFICATION_PROMPT_V14`, Modell
`qwen/qwen3.6-35b-a3b`, Kontext 42.496, Temperatur 0, maximal 12.000
Completion-Tokens und maximal drei semantische Versuche je Batch über
`http://127.0.0.1:1234/v1`. Ein harter Request-Timeout war in diesem Stand
noch nicht implementiert.

Der tatsächliche Befund lautet:

- Batch 1/59, `AUB-7b4369194ffd155cf2362c0d`: PASS im ersten Versuch;
  Artefakt-SHA-256
  `4be95beae73f9fb9963a81a96321d96d91af6329910df3d02d756a312bb4aaf0`.
- Batch 2/59, `AUB-65106db5de0ff5b053ee65f3`: PASS nach drei
  semantischen Versuchen; Artefakt-SHA-256
  `f09ce7883d8929db3f2d4c04a35f4ab7a8970fc079e3d0d5933bdd8340c87a79`.
- Batch 3/59, `AUB-05b8b536e0f07bb5483e0230`: PASS nach drei
  semantischen Versuchen; Artefakt-SHA-256
  `e28b087ed0dc40fd8069a8536565916064a9497782f194af587ca368aa1c33a2`.
- Batch 4/59, `AUB-0627307b04acb0ed597fb6da`, blieb im
  `chat.completions.create`-Aufruf länger als sechs Minuten ohne Antwort
  hängen. Der Prozess wurde danach kontrolliert abgebrochen und ist nicht
  mehr aktiv.

Der Abbruch bewahrte den Resume-Vertrag: Es existieren genau die drei
vollständigen, validierten PASS-Batchdateien. Für Batch 4 wurde keine Datei
und für den Gesamtlauf keine `summary.private.json` geschrieben. Damit darf
ein korrigierter Runner Batch 1–3 wiederverwenden und muss beim ersten
unvollständigen Batch 4 beginnen. Dieser Zwischenstand ist ausdrücklich kein
vollständiger A-Befund und kein fachliches Gate.

Root Cause: Jeder Qwen-Aufruf war unbegrenzt. Zusätzlich hätte der bisherige
Runner nach ausgeschöpften Versuchen auch ein nicht bestandenes Batchresultat
materialisiert und mit späteren Batches fortgesetzt. Der nächste Fix muss
daher Transport-Timeout, tatsächlichen Abort, sichere Server-Settlement-
Barriere, Late-Response-Isolation, append-only Fehlerprotokollierung und
fail-closed Persistenz gemeinsam umsetzen.

Status: `V12 BATCH 1-3 PASS UND RESUMIERBAR GESICHERT; BATCH 4 TECHNISCH
HÄNGENGEBLIEBEN UND KONTROLLIERT BEENDET; TIMEOUT-/RESUME-HÄRTUNG,
VOLLSTÄNDIGE 59-BATCH-A-KLASSIFIKATION UND 283/631-CROSSWALK OFFEN; KEIN
PRODUKT-ROUTING, KEINE KUNDEN-XLSX, KEIN DEPLOYMENT`.

### 133.18 V12-Timeout-Härtung, vollständiger A-Lauf und Crosswalk-Gate

Der technische Root Cause aus Abschnitt 133.17 ist behoben und auf
`origin/codex/v3.7.5-lf-retrieval-shadow` veröffentlicht. Der Kernfix beginnt
mit Commit `398676659` und ist im abschließend geprüften Stand
`9836216b9db6fc0b83bc65177f69f9fa6a938acc` enthalten. Jeder
Qwen-Klassifikationsrequest besitzt nun einen konfigurierbaren harten Timeout,
einen echten `AbortController`, eine Settlement-Barriere und eine sichere
LM-Studio-Wiederherstellung durch gezieltes Entladen, Neuladen und Prüfung von
exakter Modell-ID und Kontextlänge. Erst danach darf ein begrenzter Retry
beginnen. Versuche werden append-only mit Versuch, Dauer, Timeout-/Abortstatus,
Fehlerklasse, Response-Hash und Recovery-Nachweis protokolliert. Nicht
bestandene Batches werden nicht als PASS gespeichert; nach ausgeschöpften
Retries stoppt der Lauf fail-closed und bleibt resumierbar.

Im unveränderten V12-Laufpfad liegen 573 private Versuchsjournale. Vier reale
Batch-4-Requests erreichten den konfigurierten Timeout von 180.000 ms. Bei
allen vier wurde der Abort ausgelöst, der Request settelte danach, und LM
Studio wurde vor einem Folgeversuch jeweils `SAFE_RELOADED`; die geprüfte
Modell-ID blieb `qwen/qwen3.6-35b-a3b`, der Kontext 42.496. Die gemessenen
Gesamtdauern einschließlich Recovery betrugen 192.099 bis 192.328 ms. Dreizehn
weitere Versuchsjournale enthalten ungültige beziehungsweise abgeschnittene
JSON-Antworten als technische Fehler; sie wurden nicht als Semantikresultat
übernommen.

Der vollständige Real-Lauf wurde am Klassifikationsstand
`bd051b23f1facb15943ca0de5312e387aa2dd10a` abgeschlossen. Der abschließende
Integritäts-Resume lief aus dem isolierten Mac-Studio-Worktree
`/private/tmp/lf-a-verified59.cpf7ge/repo` auf
`9836216b9db6fc0b83bc65177f69f9fa6a938acc` mit:

```text
model: qwen/qwen3.6-35b-a3b
modelContext: 42496
maximumAttempts: 8
requestTimeoutMs: 180000
abortSettlementTimeoutMs: 15000
modelRecoveryTimeoutMs: 180000
qwenModelKey: qwen3.6-35b-a3b-mlx-text
```

Die bereits gespeicherten Batches 1 bis 38 wurden wiederverwendet. Nur Batch
39 wurde aus seinem archivierten Resultat neu materialisiert, weil die reine
Überschrift „3. Obliegenheiten des Versicherungsnehmers im Schadenfall“ in
einem alten PASS fälschlich als `INSURED_OBJECT` gespeichert war. Batch 40 bis
59 wurden wiederverwendet. Der Abschluss dauerte deshalb 394 ms und machte
keinen neuen Modellrequest. Reine Aufzählungsmarker innerhalb operativer Units
werden nun blockweise als Struktur terminiert, statt den operativen Unitstatus
ohne Requirement-Beleg zu erben.

Wichtige Abweichung: Während einer früheren Validatorhärtung in diesem
Arbeitszyklus wurden Batch 2 und 3 entgegen der Vorgabe neu berechnet. Die
ursprünglichen Dateien sind unverändert unter `superseded-batches` erhalten;
sie enthielten unter anderem semantisch unzulässige Coverage-Effekte wie das
bloße „ist“, „mit einer“ oder „gilt“. Der finale Integritäts-Resume hat Batch 1
bis 3 nicht erneut berechnet. Ihre aktuellen SHA-256-Werte sind:

```text
Batch 1: 4be95beae73f9fb9963a81a96321d96d91af6329910df3d02d756a312bb4aaf0
Batch 2: 17acb45439f4cc82e41cac3d4b802fa56b9d1bfb3aaa33bafad021995f554b34
Batch 3: 9816cd5e782a52889ea5ea931bf07af07df0e0396b728238ca73c5bdb51ae360
```

Finaler A-Befund: 59/59 Batches PASS, 349/349 erwartete Modellantwort-Units
genau einmal vorhanden, keine fehlenden, unbekannten oder doppelten
Antwort-IDs, keine ungültigen oder still ergänzten Source-IDs, 364 dynamische
Requirements, 755 Komponenten und null `UNRESOLVED`-Units. Alle 1.005
Source-Blöcke sind genau einmal besessen und genau einmal terminalisiert;
`allBlocksTerminal` ist jetzt wahr und kein operativer Block bleibt ohne
Requirement-ID. Der zusätzliche Fehlklassifikationsaudit fand null verdächtig
operative und null verdächtig nichtoperative Units. Von 68 geprüften
nichtoperativen Risikoeinheiten wurden 52 als Strukturüberschriften, neun als
Seitenmarker, zwei als Strukturlabel und fünf als wiederverwendete operative
Governor-Evidenz erklärt. Das ist eine source- und regelgebundene Prüfung,
kein Expertenbeweis beliebiger fachlicher Vollständigkeit.

Der mechanische Crosswalk gegen die historische 283/631-Regression ist
vollständig, aber der semantische Doppelreview-Gate ist nicht bestanden:

```text
Legacy-Requirements: 171 1:1-Kandidaten, 112 Split-Kandidaten, 0 fehlend
Dynamic-Requirements: 228 1:1-Kandidaten, 110 Merge-Kandidaten, 26 zusätzlich
Legacy-Komponenten: 188 1:1-Kandidaten, 102 Split-Kandidaten,
                   341 rolleninkompatible Source-Overlaps, 0 source-fehlend
Dynamic-Komponenten: 148 1:1-Kandidaten, 122 Merge-Kandidaten,
                     325 rolleninkompatible Source-Overlaps, 160 zusätzlich
```

Damit sind Blockbesitz, Response-Hülle, Source-Referenzintegrität,
Nonoperative-/Operative-Risikofilter und mechanische Source-Abdeckung PASS.
`semanticCrosswalkApproved` und `acceptanceReady` bleiben bewusst falsch: Der
Crosswalk-Vertrag verlangt für alle 631 Komponenten eine gültige semantische
Relation, `APPROVED` und zwei unabhängige Reviewer. Source-Overlap oder ein
zweiter Modelllauf darf diese fachliche Doppelreview nicht vortäuschen.

Beweishashes im V12-Laufpfad:

```text
summary.private.json: 062ea40a24bf4ccfad2d26efde663e98e6ab209470f5935a7f3e4f691cb8b77f
responses.private.json: dfc81ade63c098fca6de4d0a4a1bcc709d59deea1b01f6c3e269e34c035e9e3c
dynamic-semantic-manifest.private.json: d39ff07f4cfa1137a62c1fd340cc31bfbc4f807a1e550375a24fc6f9adcc5d33
a-status-audit-v12-9836216b.private.json:
  332a3e88ef71ad0e57f6c087061ca2009be983f91980aae95cd22745ddc8d2f5
resume-9836216b-final-integrity.runner.log:
  deb52eeeadca7f633499b6eb4723fb72299271992ae37e27a289c6bd8c2c93a8
```

Auf dem Mac Studio bestanden am exakten Commit `9836216b9` Format, Lint und
beide A-driven Jest-Suites mit 92/92 Tests. Wegen des offenen semantischen
283/631-Doppelreviews wurden Kandidatenkompaktierung, vollständige B-Suche,
Produkt-Routing, Kunden-XLSX und Deployment nicht gestartet.

Status: `V12 A-KLASSIFIKATION 59/59 TECHNISCH UND SOURCE-SEITIG PASS;
283/631 MECHANISCH VOLLSTÄNDIG, ABER SEMANTISCHER DOPPELREVIEW OFFEN; B-GATE
NICHT FREIGEGEBEN; KEIN PRODUKT-ROUTING, KEINE KUNDEN-XLSX, KEIN DEPLOYMENT`.

### 133.19 Korrigierte V3.7.4-Reviewbasis und 631er-Doppelreview-Vertrag

Vor Beginn der fachlichen Doppelprüfung wurde der in Abschnitt 133.18
verwendete mechanische Crosswalk nochmals gegen Laufprovenienz und Release
gebunden. Dabei wurden zwei veraltete Eingaben entdeckt: Der vorherige
Root-Crosswalk referenzierte ein leeres Vorklassifikationsmanifest, und der
erste finale A-Audit verglich gegen das Legacy-Manifest aus V3.7.3 statt gegen
das im V3.7.4-Lauf tatsächlich verwendete Manifest. Diese Artefakte bleiben
historische Befunde, dürfen aber nicht als Oracle für die nächste Iteration
verwendet werden.

Die korrigierte V3.7.4-Basis ist:

```text
Dynamic V12 manifestSha256:
  5fcb889c0352f3808afeffda9f6801d987b61e0cccb18899c97ba90d0eacab6a
Dynamic V12 file SHA-256:
  d39ff07f4cfa1137a62c1fd340cc31bfbc4f807a1e550375a24fc6f9adcc5d33
Legacy V3.7.4 manifestSha256:
  3697afe4a18760bd893d50e0c3f8dadf48ff0106447829d32f1cb7845011efb0
Legacy V3.7.4 file SHA-256:
  c8e4c7cb303879d0efb35eb8215be6b6b75a75332e8a1b892c5f1bc85d6be4c7
Korrigierter A-Audit file SHA-256:
  5c7a98ff3d9532b4f98eec78ef77b89d327da9d7ed07f5f567c6bcba5ed2c17c
```

Damit ändern sich die mechanischen Komponentenzahlen aus Abschnitt 133.18.
Die aktuelle Wahrheit lautet 333 statt 341 rolleninkompatible
Legacy-Komponenten, 107 statt 102 Split-Kandidaten, 324 statt 325
rolleninkompatible dynamische Komponenten und 123 statt 122
Merge-Kandidaten. Die Requirement-Zahlen bleiben 283 Legacy-Requirements,
364 dynamische Requirements, 112 Split-, 110 Merge- und 26 zusätzliche
dynamische Requirement-Kandidaten. Es fehlen weiterhin weder ein
Legacy-Requirement noch eine Legacy-Komponente auf reiner Source-Ebene. Diese
Zahlen sind Kandidatenstatistik und ausdrücklich keine semantische Freigabe.

Der neue Vertrag `LF_A_LEGACY_DOUBLE_REVIEW_V1` friert diese exakte Kampagne
unveränderlich ein und validiert die vollständige Kette PDF ->
Dokumentartefakt -> Source-Ledger -> Lauf-/Input-Manifest -> Source-Unit-Plan
-> 59 Batchartefakte -> 349 Responses -> Dynamic-Manifest -> korrigierter
A-Audit. Er bindet außerdem Quellcommit, Release-ID, Laufpfad, Modell,
Kontext, Timeouts, Promptvertrag und alle relevanten Datei- und intrinsischen
Hashes. Die Materialisierung kopiert reguläre Dateien ohne Hardlinks oder
Symlinks, prüft sie nach dem Kopieren erneut, setzt Dateien auf Modus `0400`,
Verzeichnisse auf `0500` und verweigert das Überschreiben eines vorhandenen
Ziels.

Der eingefrorene Reviewstand liegt auf dem Mac Studio unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-V12-REVIEW-FREEZE-20260912-5FCB889C
review-basis.private.json basisSha256:
  d7b1bd772bf8a76cc0082ebfeca26defef95004e19e4635a37e6da09bdf4f283
review-basis.private.json file SHA-256:
  78ecb488a27a9ad856df66354a58ad344aff60c832b1adf7e00f65a922cd04b3
```

Eine unabhängige Nachprüfung am Implementierungscommit
`dc60d98c845ca914a9cead3798ccc1edaad185d3` bestätigte 74 reguläre Dateien,
null Symlinks, null mehrfach verlinkte Dateien und 70/70 hashgleiche
referenzierte Eingabeartefakte. Ein erneuter Materialisierungsversuch auf
dasselbe Ziel stoppte erwartungsgemäß mit
`LF_A_DOUBLE_REVIEW_TARGET_EXISTS`.

Der erste deterministische V1-Draft blieb unverändert und `UNREVIEWED`, wurde
aber vor Ausgabe an Reviewer durch die härtere V2-Fassung ersetzt. V2 markiert
die mechanischen Rollenabweichungen explizit als Priorität 1, übernimmt die
identische Rollenmatrix des A-Audits und weist die vier mechanischen Klassen
vollständig aus. Er liegt getrennt unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-V12-REVIEW-DRAFT-V2-20260912-5FCB889C
crosswalk-draft.private.json draftSha256:
  b01c87012b9ace268572c50dba3c3d3b4c81f020991b269208f1c491fbb0b42d
crosswalk-draft.private.json file SHA-256:
  9e16f0ed3d40d419f6b4063ade4deaf80dd3d4ab295e9d9c6b76ad7b9d1dd021
```

Der Draft enthält 631/631 Legacy-Komponenten, 283/283 Legacy-Requirements,
die exakten Legacy-Quelltexte und -positionen sowie den vollständigen
dynamischen Geschwisterkontext aller source-überlappenden Requirements. Kein
Record ist kandidatenlos. Er klassifiziert mechanisch 333 Records als
`P1_ROLE_INCOMPATIBLE`, 191 als 1:1-Kandidaten, 107 als Split-Kandidaten und
null als kandidatenlos; 333/333 P1-Records tragen die richtige Priorität.
Seine Reverse-Diagnostik nennt 42 dynamische
Komponenten ohne Kandidatenkontext. Diese 42 sind nicht mit den 160
source-exakt zusätzlichen Komponenten des korrigierten A-Audits gleichzusetzen:
Der Review-Draft erweitert ausschließlich den sichtbaren Kontext um
Geschwisterkomponenten überlappender Requirements, ohne daraus Äquivalenz oder
Freigabe abzuleiten.

Pro Reviewerentscheidung sind ausschließlich die Relationen `EQUIVALENT`,
`REPHRASED_EQUIVALENT`, `MOVED_EQUIVALENT`, `SPLIT_INTO_DYNAMIC`,
`MERGED_INTO_DYNAMIC`, `MISSING` oder `AMBIGUOUS` zulässig. Für
Rollenabweichungen ist zusätzlich genau eine Ursachenklasse erforderlich:
`DYNAMIC_CLASSIFICATION_ERROR`, `ROLE_MAPPING_TOO_NARROW`,
`SPLIT_OR_MERGE_RELATION`, `DYNAMIC_COMPONENT_MISSING`, `UNDETERMINED` oder
bei nachweislich keinem Upstream-Defekt `NO_UPSTREAM_DEFECT`. Ein Merge ist nur
mit gemeinsamer Merge-Gruppen-ID und mindestens zwei Legacy-Komponenten auf
dasselbe dynamische Ziel gültig.

Der Stand `a7a4ee34b` erzwingt zusätzlich: Ein mechanisch
rolleninkompatibler Record darf nicht als `NO_UPSTREAM_DEFECT` eingereicht
werden; Split und Merge verlangen `SPLIT_OR_MERGE_RELATION`, `MISSING`
verlangt `DYNAMIC_COMPONENT_MISSING`, und `UNDETERMINED` kann niemals den
Freigabegate passieren. Auf dem Mac Studio bestanden für diesen Stand Format,
serverseitiges ESLint ohne Fehler und drei A-driven Suites mit 98/98 Tests.

Reviewer A und B müssen getrennte, durch eine externe Autorität registrierte
Signaturschlüssel und fachliche Qualifikationsnachweise besitzen. Jeder prüft
alle 631 Records unabhängig. Gleiche Modellläufe, AI-Selbstaussagen oder ein
Source-Overlap dürfen kein `APPROVED` erzeugen. Erst exakte Übereinstimmung
beider signierter Reviewartefakte über alle Records kann einen freigegebenen
Legacy-Crosswalk erzeugen; `MISSING`, `AMBIGUOUS`, unbestimmte Ursachen oder
eine Abweichung zwischen A und B stoppen fail-closed. Auch ein bestandener
Legacy-Crosswalk gibt die 42 Reverse-Diagnostikfälle oder B nicht automatisch
frei.

Aktueller fachlicher Stand: Der technische Reviewvertrag, Freeze und
631er-Draft sind fertig; `reviewedRecords` ist korrekt 0/631 und
`approvalStatus` ist `UNREVIEWED`, weil noch keine zwei realen unabhängigen
Fachreviewer registriert und keine signierten Entscheidungen eingereicht
wurden. Erkannte fachliche Fehler dürfen nicht im Draft oder Endartefakt
korrigiert werden. Sie müssen als allgemeine Rollen- oder Atomisierungsregel
implementiert, auf dem Mac Studio getestet und durch erneute V12-
Materialisierung sichtbar gemacht werden.

Status: `V12-BASIS HASHGEBUNDEN UND EINGEFROREN; 631/631 REVIEWRECORDS
VORBEREITET, 0/631 FACHLICH DOPPELT GEPRÜFT; SEMANTIKGATE OFFEN; B-SUCHE,
PRODUKT-ROUTING, KUNDEN-XLSX UND DEPLOYMENT NICHT GESTARTET`.

### 133.20 V30: requirement-lokale Rollenvollständigkeit und eingefrorene neue Reviewbasis

Die 631er-Triage zeigte, dass die ursprüngliche A-Klassifikation fachliche
Rollen teilweise in breiten Komponenten verlor. Deshalb wurde nicht die
Rollenmatrix pauschal verbreitert, sondern der allgemeine semantische Vertrag
gehärtet: Explizite Bedingungen, Ausschlüsse, Gefahren, Kosten, Werte,
Limitbasen, Selbstbehalte und Definitionen müssen innerhalb derselben
Requirement quellgebunden materialisiert sein. Governor-Evidenz darf nur
begrenzt und nachvollziehbar vererbt werden. Alte valide Batchantworten werden
unter dem aktuellen Kontext erneut geprüft; nur tatsächlich unvollständige
Batches werden per Resume neu berechnet.

Die Iterationen V22 bis V24 reduzierten die direkten Rollenabweichungen durch
allgemeine Regeln von 102 auf 99. Sie ergänzten insbesondere über Quellblöcke
gesplittete Gefahren-/Definitionsrelationen und eine eng begrenzte quantitative
Anapher wie „bis zu dieser Größe“. Die zwischenzeitlichen V25-/V26-Regeln für
kopulare Definitionen wurden nicht als Reviewbasis akzeptiert: Eine zu breite
Regel interpretierte Deckungsaussagen wie „Versichert sind …“ und „Zusätzlich
versichert sind …“ fälschlich als Definitionen. Diese Fehlversuche blieben als
resumierbare Diagnoseartefakte erhalten.

Der finale allgemeine Definitionsvertrag verlangt jetzt ein fachliches
Subjekt vor `ist/sind`, einen Definitionsgegenstand im Prädikat und schließt
satzabschließende Deckungsprädikate aus. Mehrblockige Definitionen werden als
vollständige Quellspanne materialisiert. Positive, negative und gesplittete
Formulierungsvarianten sind getestet; insbesondere werden
„Gebäude sind versichert“, „Gebäude sind samt Anlagen mitversichert“ und die
reale „Zusätzlich sind … mitversichert“-Klausel nicht zu `FACT_ROLE`.

Der daraus erzeugte V30-Lauf liegt ausschließlich auf dem Mac Studio unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V30-TERMINAL-PREDICATE-20260912-653ECE7A
```

Laufkonfiguration und Ergebnis:

```text
Manifest-Implementierungscommit: 653ece7a0ff517dda1d0216e2f80566e89789a15
Qwen-Modell: qwen/qwen3.6-35b-a3b
Modellschlüssel: qwen3.6-35b-a3b-mlx-text
Kontext: 42496
Request-Timeout: 180000 ms
Abort-Settlement-Timeout: 15000 ms
Model-Recovery-Timeout: 180000 ms
Maximum Attempts: 8
Batches: 59/59 PASS
Responses: 349/349 eindeutig
Source-Blöcke: 1005/1005 genau einmal besessen und terminal
Requirements: 354
Komponenten: 1036
UNRESOLVED: 0
```

Gegenüber V24 kam exakt eine zusätzliche fachliche Komponente hinzu: die
vollständige, vier Source-Blöcke umfassende Definition der Nebengebäude. Nur
`VS-08/outbuilding_definition` wechselte dadurch von `ROLE_INCOMPATIBLE` zu
`ONE_TO_ONE_CANDIDATE`. Es wurden weder Komponenten entfernt noch die drei
zuvor beobachteten falschen „Zusätzlich sind …“-Rollen übernommen.

Beweishashes:

```text
dynamic manifestSha256:
  683cd3f304203d4d1c95bfc92221b726c852c6d7cc64974269875787b544d9ad
dynamic-semantic-manifest.private.json:
  4a38c40b5b365e0c55fa5e26a73e4dd9e958d75b6a345eb3955ecaacd16c9648
responses.private.json:
  9d6d835ccd06c052aec954a98be661b55348abd918734155e97fac5ae5bae12d
summary.private.json:
  aaee4c376a2a5d549c9a88cfc5c9236f1628f0521e6ee284e0744385627ae27a
a-status-audit-v30-653ece7a.private.json:
  e9a0aaab54dca45e501a8f975ed26fb29e6357afb97f502a96495e4f71779da8
```

Die neue immutable Reviewbasis und der getrennte Draft liegen unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-V30-REVIEW-FREEZE-20260912-683CD3F3
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-V30-REVIEW-DRAFT-20260912-2F63B522
```

Ihre intrinsischen Digests sind
`2f63b52291b40353b456c398b8ad212bf4f2893821bc1e7b77027a701195eb6e`
und
`69575563a024b1cdb5d680f8b363856284dee4aec4a8e54145294ff2a834d2e3`.
Der Draft enthält 631 Records: 271 direkte 1:1-, 200 Split-, 62 geerbte
Rollenkandidaten, 98 direkte Rollenabweichungen und null kandidatenlose
Records. Die 98 direkten Abweichungen verteilen sich auf 60 Bedingungen, 25
Leistungen, sieben Ausschlüsse, zwei Kosten, zwei Dokumentstatusfälle, eine
Definition und ein Versicherungsobjekt. Diese Verteilung ist Triage, keine
Fehler- oder Freigabeentscheidung.

Am finalen Codecommit `5622bf8037f0fe2ea4ee8edfd7cf8320321ee794`
bestanden auf dem Mac Studio der Formatcheck, serverseitiges ESLint und die
vollständige Server-Suite mit 187/187 Suites und 2.644/2.644 Tests. Ein erster
Root-Jest-Lauf unter dem dort standardmäßig aktiven Node 26 scheiterte an
vorhandenen, nicht LF-bezogenen Dependency-/Runtimeproblemen; derselbe
vollständige Serverbestand bestand unter Node 22.23.2. Collector-Suites sind in
diesem isolierten Worktree nicht installiert und deshalb kein behaupteter PASS.

Der technische A-Pfad ist damit bereit für die fachliche Doppelprüfung, aber
noch nicht für B. Es fehlen weiterhin zwei reale, unabhängig registrierte
Fachreviewer und 631/631 übereinstimmende, signierte Entscheidungen ohne
`MISSING`, `AMBIGUOUS` oder offene Upstream-Ursache. Weitere breit wirkende
Regex- oder Rollenmatrixänderungen allein aufgrund der verbleibenden 98 Fälle
wären ohne diese Entscheidungen nicht evidenzgerecht. Kandidatenkompaktierung,
vollständige B-Suche, Produkt-Routing, Kunden-XLSX und Deployment bleiben
gesperrt.

Status: `V30 A TECHNISCH PASS UND IMMUTABLE EINGEFROREN; 631/631 RECORDS
VORBEREITET, 0/631 FACHLICH DOPPELT GEPRÜFT; B-GATE NICHT FREIGEGEBEN`.

### 133.21 Ausführbarer 631er- und dynamischer Rest-Doppelreview

Die technische Reviewvorbereitung ist nun als vollständiger write-once
Kommandoablauf ausführbar. `materializeADrivenLegacyDoubleReview.cjs`
materialisiert nach der bereits eingefrorenen Basis und dem Draft eine durch
eine externe Akzeptanzautorität signierte Reviewer-Registry, getrennte
Templates für Slot A und B, getrennt signierte Reviewartefakte und den
deterministisch reconcilierten 631er-Crosswalk. Private Schlüssel werden nur
aus regulären Einzeldateien gelesen und niemals in ein Zielartefakt kopiert.
Vorhandene Zielverzeichnisse werden nicht überschrieben; alle erzeugten
Artefakte bleiben an Basis-, Draft-, Registry-, Reviewer- und Quelldigests
gebunden.

Dabei wurde ein weiterer Gatefehler geschlossen: Die im V30-Draft genannten
42 `dynamicOnlyComponents` sind nur der vor dem fachlichen Review sicher
sichtbare Mindestrest ohne Legacy-Quellkontext. Sie sind nicht automatisch
die vollständige Menge dynamischer Zusatzkomponenten. Erst nach einem
bestandenen 631er-Crosswalk kennt das System alle tatsächlich gewählten
dynamischen Ziele. Der neue Vertrag
`LF_A_DYNAMIC_REMAINDER_REVIEW_DRAFT_V1` bildet deshalb anschließend
deterministisch die Differenz aus allen 1.036 dynamischen Komponenten und
allen im freigegebenen Crosswalk verwendeten Zielkomponenten. Damit kann keine
nicht gewählte dynamische Komponente still aus der Vollständigkeitsprüfung
fallen.

Auch dieser Rest wird von denselben zwei autorisierten menschlichen
Fachreviewern unabhängig und signiert geprüft. Zulässige Befunde sind
`VALID_DYNAMIC_ADDITION`, `LEGACY_CANDIDATE_MISSING`,
`DYNAMIC_COMPONENT_DUPLICATE`, `DYNAMIC_ATOMIZATION_ERROR`,
`DYNAMIC_SOURCE_BINDING_ERROR` und `AMBIGUOUS`. Nur vollständige exakte
Übereinstimmung beider Reviewer und ausschließlich
`VALID_DYNAMIC_ADDITION` für jeden Restrecord setzt
`dynamicManifestSemanticCompletenessApproved` und `bPilotAllowed` auf wahr.
Jeder andere übereinstimmende Befund erzeugt
`REMEDIATION_REQUIRED`; eine Reviewerabweichung stoppt fail-closed. Selbst
der bestandene QA-Gate setzt `productRoutingAllowed` und
`resultMutationAllowed` weiterhin ausdrücklich auf falsch.

Der ausführbare Ablauf umfasst jetzt:

```text
registry -> template A/B -> seal A/B -> reconcile
         -> reverse-draft -> reverse-template A/B
         -> reverse-seal A/B -> reverse-reconcile
```

Die Implementierung wurde am exakten Commit
`ff57ae7b632b6490a2a8bbef9ecbcefe84c6c336` im isolierten Mac-Studio-
Worktree
`/Users/michaelmischkot/Code/validation-worktrees/lf-signal-24b5bda51`
unter Node 22.23.2 geprüft. Prettier und serverseitiges ESLint bestanden. Die
fokussierte Suite bestand 10/10 Tests einschließlich eines synthetischen
vollständigen 631er- plus Rest-End-to-End-Laufs, unabhängiger Signaturen,
write-once Materialisierung, nicht kopierter privater Schlüssel und eines
fail-closed Restbefunds. Anschließend bestanden 187/187 Server-Suites mit
2.646/2.646 Tests.

Es wurden bewusst keine künstlichen Revieweridentitäten für die reale V30-
Kampagne erzeugt. Deshalb existieren weiterhin keine fachlich signierten
631er-Entscheidungen und folglich noch kein realer dynamischer Rest-Draft. Die
exakte Restzahl kann erst aus den echten 631 Entscheidungen berechnet werden;
42 ist nur ihre garantierte Untergrenze. Der nächste externe Eingang sind die
Identitäten, Qualifikationsnachweise und getrennten öffentlichen Schlüssel
zweier realer Fachreviewer sowie der Schlüssel der Akzeptanzautorität.

Status: `TECHNISCHER DOPPELREVIEW UND EXHAUSTIVER DYNAMISCHER RESTGATE
AUSFÜHRBAR UND GETESTET; REALE FACHREVIEWS 0/631; KONTROLLIERTER B-PILOT,
1+9-LAUF, PRODUKT-ROUTING, KUNDEN-XLSX UND DEPLOYMENT WEITERHIN GESPERRT`.

### 133.22 Review-Gate gegen False-Open und Freeze-Austausch gehärtet

Eine erneute unabhängige Systemprüfung des ausführbaren Reviewpfads fand vier
weitere technische Vertrauenslücken. Diese wurden am Commit
`537c245d00481b4b241b72f5abc66014b065eef6` geschlossen:

- `SPLIT_OR_MERGE_RELATION` ist jetzt bidirektional an
  `SPLIT_INTO_DYNAMIC` oder `MERGED_INTO_DYNAMIC` gebunden. Die Ursache kann
  nicht mehr zusammen mit einer einfachen `EQUIVALENT`-Entscheidung
  eingeschleust werden.
- Der Freeze-Index prüft nicht mehr nur seine eigene interne Konsistenz. Jede
  eingefrorene Eingabedatei wird erneut gegen den in Reviewbasis,
  Klassifikationsevidenz oder Run-Provenienz gebundenen SHA-256 geprüft.
- Die finale Rest-Reconciliation muss zusätzlich gegen erwartete `profileId`,
  `runSignature` und `basisSha256` validiert werden. Damit kann kein formal
  valides Ergebnis einer älteren Kampagne als aktuelles Ergebnis abgespielt
  werden.
- Die Signaturprüfung einer im selben CLI-Aufruf gelieferten Autoritäts-
  Fingerprint wird nicht mehr als externe Freigabe bezeichnet. Selbst wenn
  631er- und dynamischer Rest-Doppelreview technisch vollständig bestehen,
  setzt der QA-Vertrag nur
  `technicalBPilotPrerequisitesSatisfied:true`. `bPilotAllowed` bleibt
  fail-closed `false`, bis eine separat administrierte, außerhalb des
  Reviewaufrufs verankerte Freigabeautorität implementiert und geprüft ist.
- Auch der Top-Level-Status und die historischen `*Approved`-Felder bleiben
  jetzt fail-closed. Ein erfolgreicher technischer Review heißt ausschließlich
  `TECHNICAL_PREREQUISITES_SATISFIED`; nur explizit mit `technical*`
  bezeichnete Felder können wahr werden. Damit kann ein älterer oder
  unvollständiger Consumer nicht versehentlich `APPROVED` als B-Freigabe
  interpretieren.

Wegen der geänderten Feld- und Gate-Semantik wurden die Verträge für
dynamischen Rest-Draft, Reviewer-Input, Reviewer-Artefakt und Reconciliation
auf V2 angehoben. Ein zuvor zulässiger synthetischer End-to-End-Test mit
absichtlich erfundenen Dateihashes wurde entfernt; er hätte die neue
Source-Bindung nur über eine Test-Ausnahme umgehen können. Stattdessen prüfen
die Tests explizit, dass falsche Source-Hashes und nachträgliche
Freeze-Mutationen abgewiesen werden. Die echte Mac-Studio-V30-Freeze dient als
Integrationsevidenz.

Die verschärfte Prüfung materialisierte aus der echten Freeze

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-V30-REVIEW-FREEZE-V2-20260912-94002DCB
```

den neuen write-once Draft

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-V30-REVIEW-DRAFT-V3-STRICT-20260912-537C245D
```

erfolgreich. Das Ergebnis ist deterministisch unverändert:

```text
Draft intrinsic SHA-256:
  077a2cd5ccc797200926c9f700451cecf919e4340c8a21e796c90766ad65410e
Draft file SHA-256:
  9d7eff57a355daa783d6ff6ea2cb8f6f849c836000f5b5164df1463860947c51
Records: 631
mechanischer dynamischer Vorabrest: 42
approvalStatus: UNREVIEWED
```

Am exakten finalen Commit bestanden im isolierten Mac-Studio-Worktree unter
Node 22.23.2 der fokussierte Vertragstest 10/10, Prettier, serverseitiges
ESLint ohne Fehler sowie die vollständige Server-Suite mit 187/187 Suites und
2.646/2.646 Tests. Der ESLint-Aufruf meldete nur, dass die Jest-Datei gemäß
bestehender Ignore-Konfiguration nicht gelintet wird; beide geänderten
Produkt-/CLI-Dateien wurden fehlerfrei geprüft.

Aktueller Wahrheitsstand: Die technische Kampagne ist reproduzierbar und
strenger fail-closed als zuvor, aber fachlich weiterhin bei 0/631 realen
Doppelreviews. Es wurden keine Reviewer, Berechtigungsnachweise oder Schlüssel
erfunden. Für den B-Pilot fehlen damit weiterhin zwei echte unabhängige
Fachreviewer und zusätzlich eine extern verankerte Freigabeautorität. Der
vollständige 1+9-Lauf, Produkt-Routing, Kunden-XLSX und Deployment wurden nicht
gestartet.

Status: `A-REVIEWINFRASTRUKTUR TECHNISCH PASS; ECHTE V30-FREEZE STRENG
VALIDIERT; 0/631 FACHREVIEWS; B-PILOT UND 1+9 WEITER FAIL-CLOSED`.

### 133.23 V35: quellgebundene Leistungsrollen und strenge neue Reviewbasis

Die nächste Iteration bearbeitete gezielt die im V30-Draft auffälligen
Leistungsrollen. Der erste Realversuch V31 blieb in Batch 55 fail-closed: Acht
vollständig beantwortete Qwen-Versuche für `AU-d853135b13905dac104eb396`
lieferten keine semantisch gültige, exakt quellgebundene Leistungsrolle. Dies
war kein Timeout oder Transportfehler. Der Batch wurde nicht als `PASS`
gespeichert; die bisherigen 54 Batches und sämtliche Attempt-Artefakte blieben
resumierbar unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V31-CONTRACTUAL-BENEFIT-20260912-304B3E96
```

Die Ursache lag nicht in fehlender Modellantwort, sondern in der nachgelagerten
Materialisierung: Mehrblockige Vertragsvorteile konnten auf einen verkürzten
lokalen Bestandteil oder auf modellseitig umformatierte Evidenz gebunden
werden. Die Korrektur wurde als versionierter allgemeiner Semantikvertrag
`LF_A_REQUIREMENT_ROLE_EVIDENCE_COMPLETENESS_V6` umgesetzt. Er bindet
Leistungsrollen an den exakten kanonischen Source-Blockbereich, bevorzugt bei
zusammenhängender Evidenz die vollständige Mehrblockspanne, erhält Punkte in
Zahlen wie `EUR 8.000`, akzeptiert eng begrenzte aktive Anspruchs-,
Freigabe-, Teilzahlungs-, Wiederherstellungs- und Verzichtsformulierungen und
behandelt eine autoritative Leistungsfundstelle nicht als mehrdeutig, nur weil
Qwen denselben Text zusätzlich als `OBJECT` oder `CONDITION` ausgab.

Jede Verhaltensänderung erhielt eine eigene Signalvertragsversion. Alte
Attempt-Journale dürfen nur aus einer expliziten Vorgängerliste gelesen werden
und werden unter dem aktuellen Vertrag erneut vollständig validiert; ein alter
Response kann daher weder eine neuere Entscheidung überschreiben noch ohne
aktuelle Validierung als `PASS` gelten. Die Regressionstests umfassen
Mehrblockbindung, kanonische Quelltexte, Dezimal-/Tausenderpunkte,
Bindestrichfortsetzungen, Negativformulierungen, umgekehrte Anspruchssätze und
zeitlich quantifizierte Verzichtsklauseln.

Die Zwischenläufe V32 bis V34 und der aktuelle V35-Lauf wurden ausschließlich
im isolierten Mac-Studio-Worktree materialisiert. V35 liegt unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V35-FINAL-BENEFIT-EVIDENCE-20260912-828DAFDD
```

Sein belegbarer A-Status lautet:

```text
Manifest-Commit: 828dafddd26f90a298f486455ff1f967371bdcdd
Klassifikationsvertrag: LF_A_BOUNDED_CLASSIFICATION_RUN_V13
Promptvertrag: LF_A_BOUNDED_CLASSIFICATION_PROMPT_V14
Semantiksignalvertrag: LF_A_REQUIREMENT_ROLE_EVIDENCE_COMPLETENESS_V6
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Timeout/Abort-Settlement/Recovery: 180000/15000/180000 ms
Maximum Attempts: 8
Batches: 59/59 PASS
Responses: 349/349 eindeutig und unter V6 erneut validiert
Neue Modellaufrufe in V35: 0
Source-Blöcke: 1005/1005 genau einmal besessen und terminal
Requirements: 357
Komponenten: 1054
UNRESOLVED: 0
verdächtig nichtoperative/operative Einheiten: 0/0
```

Beweishashes:

```text
dynamic manifestSha256:
  d7ce4316c9c416e10aff6348d6f8ef573de19b12f5d7743dc83a475bd240fbce
dynamic-semantic-manifest.private.json:
  a4651bc1a9864a516823926d512d9ffd4be9bf8c09ecc559a9e7737834d7a1d1
responses.private.json:
  184e2537e0e6d6194b51a92718ccb1c17e2592cc37782ec0503c436e3da58dfa
summary.private.json:
  6a4b5acb1c5bd4a91c4cac06d64c05700d770ad18434e47041f334f4ddcc0886
a-status-audit-v35-828dafdd.private.json intrinsisch:
  578a51fac8cda964d127ef77f076b1801e92b3d840cbfbf07c65b2eab0c8cdb9
a-status-audit-v35-828dafdd.private.json als Datei:
  ebd49df641447e59ab82e0d28b492581d2554fae8aa2806d4270725b6aacc8c9
```

Gegenüber V30 sank die mechanische Zahl direkter Rollenabweichungen von 98
auf 79. Der strenge V35-Draft enthält nun 287 direkte 1:1-, 203 Split-, 62
geerbte Rollenkandidaten, 79 direkte Rollenabweichungen und null
kandidatenlose Records. Die verbleibenden 79 verteilen sich auf 60 historische
`CONDITION`-Komponenten, sieben `BENEFIT`, sieben `EXCLUSION`, zwei
`DOCUMENT_STATUS` sowie je einen `COST`-, `DEFINITION`- und
`INSURED_OBJECT`-Fall. Die Einzelfallprüfung zeigt keine gemeinsame sichere
Regex: Zahlreiche Legacy-Labels beschreiben Bedingungen, Leistungen oder
Ausschlüsse, während V35 denselben Quellinhalt bereits als Objekt, Wirkung,
Ursache, Wert oder breit gebundene Klausel atomisiert. Diese 79 sind daher
Reviewprioritäten und weder 79 nachgewiesene A-Fehler noch 79 fehlende
B-Gegenstücke.

Die V35-Kampagne wurde am Codecommit
`f6c4f3cc145b8087ebeaa6d9e75831fd7a1ee3fd` registriert und streng
rekonstruiert:

```text
Freeze:
  /Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-V35-REVIEW-FREEZE-V1-20260912-D7CE4316
review-basis.private.json basisSha256:
  c983db1f8c208eee86b317cdc447ad6b229aa05443d8498e9f650204708fa340
review-basis.private.json file SHA-256:
  b0e0a47889ce1d2acba146325107c0542fbabb79a45e23e3fb44626a08081c68
freeze-artifact-set.private.json file SHA-256:
  f4f13a410cb6c67f464441bd6f5380d6cf83c4c8ad0dd224d8d1000d18a0fc3d

Draft:
  /Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-V35-REVIEW-DRAFT-V1-STRICT-20260912-F6C4F3CC
crosswalk-draft.private.json draftSha256:
  caccf75988264ce12b64a4c34b8b41165d1f2e1e2c0a53205533819f2ba0db8d
crosswalk-draft.private.json file SHA-256:
  1c26f0eca35066ba701c00823d1ebc27ffce9016a9acc09b5548ce4d127a3382
Records: 631
approvalStatus: UNREVIEWED
```

Am exakten Commit `f6c4f3cc145b8087ebeaa6d9e75831fd7a1ee3fd`
bestanden auf dem Mac Studio unter Node 22.23.2 Prettier, serverseitiges ESLint,
die zwei fokussierten A-Suites mit 169/169 Tests und anschließend die
vollständige Server-Suite mit 187/187 Suites und 2.674/2.674 Tests.

V35 ist damit die derzeit beste, reproduzierbare technische A-Reviewbasis.
Sie beweist jedoch weiterhin keine fachliche Vollständigkeit: `reviewedRecords`
bleibt 0/631. Ohne zwei echte unabhängige, registrierte Fachreviewer, eine
vollständige übereinstimmende 631er-Prüfung, die anschließende exhaustive
dynamische Restprüfung und eine extern verankerte B-Pilot-Autorisierung darf
weder der B-Pilot noch der vollständige 1+9-Lauf gestartet werden. Breite
weitere Rollenregeln allein zur Reduktion der Zahl 79 wären ohne diese
Relationsevidenz voraussichtlich Überanpassung an LF IMMO.

Status: `V35 A TECHNISCH PASS, HASHGEBUNDEN UND STRENG EINGEFROREN;
ROLLENABWEICHUNGEN 98 -> 79; 631/631 REVIEWRECORDS VORBEREITET, 0/631 REAL
FACHLICH DOPPELT GEPRÜFT; B-PILOT UND 1+9 WEITER FAIL-CLOSED`.

### 133.24 Kontrollierte B-Pilot-Autorisierung mit extern gepinntem Trust Root

Die V35-Reviewkette hatte nach einem künftig vollständig bestandenen
Legacy- und dynamischen Restreview noch keinen ausführbaren Übergang in einen
eng begrenzten B-Shadow-Pilot: Die finale technische Reconciliation setzte
`bPilotAllowed` absichtlich immer auf `false`. Diese Sperre war korrekt, ließ
aber auch keinen sicheren, prüfbaren Autorisierungsschritt zu.

Der Vertrag wurde deshalb um eine getrennte, write-once materialisierte
Freigabekette ergänzt:

```text
TECHNICAL_PREREQUISITES_SATISFIED
  -> LF_A_CONTROLLED_B_PILOT_AUTHORIZATION_REQUEST_V1
  -> LF_A_CONTROLLED_B_PILOT_AUTHORIZATION_V1
  -> LF_A_CONTROLLED_B_PILOT_GATE_V1
```

Der Request ist nur aus einer vollständig validierten, exakt an Profil,
Run-Signatur und Basisdigest gebundenen technischen Reconciliation ohne
Remediation- oder Dynamic-Restdefekte erzeugbar. Die Autorisierung muss mit
einem separaten Ed25519-Autoritätsschlüssel signiert werden. Sie enthält
selbst keinen öffentlichen Schlüssel und kann sich deshalb nicht selbst als
vertrauenswürdig erklären. Das finale Gate verlangt zusätzlich ein getrenntes
Trust-Anchor-Artefakt und dessen außerhalb des Aufrufs administrativ
konfigurierten erwarteten SHA-256. Private-Key-Material wird nur gelesen und
nie in die QA-Artefakte kopiert; als Public Key übergebenes Private-Key-PEM
wird abgelehnt. Ein fremder Schlüssel, ein mutierter Trust Anchor, ein
fehlender erwarteter Trust-Anchor-Hash oder eine technisch nicht bestandene
Reconciliation stoppen fail-closed.

Das Gate erlaubt ausschließlich den privaten QA-Scope
`LF_REFERENCE_A_DRIVEN_CONTROLLED_B_RETRIEVAL_SHADOW_PILOT` über alle
B-Dokumente mit BM25, Struktur, Dinghy und komponentenweiser Qwen-Prüfung.
Auch bei gültiger Autorisierung bleiben folgende Felder ausdrücklich falsch:

```text
fullOnePlusNineAllowed: false
productRoutingAllowed: false
resultMutationAllowed: false
customerWorkbookAllowed: false
deploymentAllowed: false
```

Die Materialisierungs-CLI besitzt dafür die getrennten Befehle
`b-pilot-request`, `b-pilot-authorize` und `b-pilot-gate`. Sämtliche Ausgaben
werden write-once im privaten Reviewbaum gespeichert. Die Gate-Datei ist noch
nicht an einen produktiven B-Runner angeschlossen; ein künftiger Pilot-Runner
muss sie vor jedem Start vollständig validieren. Es wurden bewusst weder
echte Autoritätsartefakte noch Schlüssel oder Reviewerentscheidungen erzeugt.

Implementiert wurde dies mit Commit
`e1724594ac27b498f05a8be6c85ab0fd2315bdfc`. Ein unabhängiger Alt-Test legte
bei der anschließenden Vollregression einen matcherabhängigen Testfehler offen:
Der VS36-Vertrag liefert absichtlich ein Array, der Test prüfte es jedoch mit
`objectContaining`. Commit
`ce63f53a090a2468d1885dc00d5e5810a540297a` änderte ausschließlich diese
Testaussage auf `arrayContaining`; Produktlogik und fachliche Werte blieben
unverändert.

Am exakten Commit `ce63f53a090a2468d1885dc00d5e5810a540297a` im isolierten
Mac-Studio-Worktree
`/private/tmp/lf-bpilot-e1724594-hmTls2/repo` unter Node 22.23.2 bestanden:

```text
VS36-Vertragstest:       11/11 PASS
Server-Gesamtregression: 187/187 Suites, 2.674/2.674 Tests PASS
Prettier:                PASS
ESLint Produkt/CLI:      PASS, 0 Fehler
```

Ein zusätzlicher Root-Jest-Aufruf nahm Collector-Suites auf und scheiterte in
sieben Suites an im isolierten Worktree nicht installierten
Collector-Abhängigkeiten (`ignore`, `@langchain/community`, `slugify`,
`dotenv`, `fix-path`, `uuid`). Dieser Lauf wird nicht als Collector- oder
Monorepo-PASS gewertet; die verbindliche vollständige Serverregression ist
davon getrennt grün.

Status: `KONTROLLIERTER B-PILOT-AUTORISIERUNGSVERTRAG TECHNISCH PASS; KEINE
REALE AUTORISIERUNG, 0/631 FACHREVIEWS, PILOT-RUNNER NOCH NICHT GEGATET;
B-PILOT UND 1+9 REAL WEITER GESPERRT`.

### 133.25 B-only-Launchgate, transportfeste Qwen-Prüfung und Bypass-Sperre

Der kontrollierte Autorisierungsvertrag wurde bis zum tatsächlichen
Ausführungseinstieg geschlossen. Der neue Runner
`run-a-driven-controlled-b-pilot.command` übernimmt ein bereits
eingefrorenes A-Final und berechnet A ausdrücklich nicht erneut. Noch vor
jeder LM-Studio- oder Retrieval-Aktion prüft er:

- Request, Ed25519-Autorisierung, Trust Anchor und finales Gate als
  zusammenhängende Hash- und Signaturkette;
- den erwarteten Trust-Anchor-SHA ausschließlich aus einer separaten,
  regulären, nicht verlinkten und nicht gruppen-/weltbeschreibbaren
  Pin-Datei;
- den exakten dynamischen A-Manifesthash und die A-Dokument-UUID samt
  Dokument-SHA;
- dass das Laufmanifest ausschließlich die gebundenen A-Dokumente plus
  mindestens ein B-Dokument enthält und alle B-Positionen vollständig und
  eindeutig sind.

Danach führt der Runner ausschließlich die B-Stufen aus: vollständige
BM25-/Struktur-/Dinghy-Kandidatensuche über alle B-Dokumente und
komponentenweise Qwen-Gegenstückprüfung. Das private Launch-Receipt bindet
Gate, A-Manifest, Input-Manifest-Dateihash und jede B-Dokumentidentität. Es
enthält weiterhin harte Sperren für Voll-Lauf, Produkt-Routing,
Resultatmutation, Kunden-XLSX und Deployment.

Die B-Qwen-Phase wurde gleichzeitig von
`LF_A_DRIVEN_COUNTERPART_DECISION_RUN_V1` auf V2 gehärtet. Jeder Aufruf
besitzt jetzt konfigurierbaren Request-Timeout, Abort, Settlement-Wartezeit,
gezieltes LM-Studio-Unload/Reload mit exakter Modell-/Kontextprüfung und
begrenzte Retries. OpenAI-interne Retries sind deaktiviert. Jeder Versuch
wird privat mit Dauer, Fehlerklasse, Timeout-, Abort-, Settlement- und
Recoverydaten sowie den beobachteten Responses journalisiert. Bereits
einzeln terminale Paketantworten werden beim Resume wiederverwendet.
Unvollständige Batches werden niemals als PASS-Datei gespeichert; nach
ausgeschöpften Versuchen stoppt die Kette am ersten offenen Batch
fail-closed. Alte gültige V1-Batchantworten können nach aktueller
Einzelvalidierung ohne neuen Modellaufruf in V2 übernommen werden.

Die abschließende Bypass-Prüfung fand den historischen Runner
`run-a-driven-reference-shadow-v2.command`, der A und B noch ohne das neue
Autorisierungsgate starten konnte. Dieser Einstieg beendet sich jetzt vor
jeder Argument-, Modell- oder Retrievalverarbeitung mit Exit 2 und verweist
auf den kontrollierten B-only-Runner. Damit existiert im vorgesehenen
A-getriebenen QA-Pfad kein dokumentierter ungateter B-Einstieg mehr.

Der echte eingefrorene V35-Input bestand die neue Dokumentbindung:

```text
dynamicManifestSha256:
  d7ce4316c9c416e10aff6348d6f8ef573de19b12f5d7743dc83a475bd240fbce
inputManifestFileSha256:
  9c114a33e2241ca7e2a6bc5e9c4301bef9bfb3a9ca02af8d56c34baf64a4d609
A-Dokumente: 1
B-Dokumente: 9
B-Positionen: 0..8 vollständig
```

Am exakten Commit `d335fcf3e2cc253ca79d0f01444d64ba3c3a0ef6`
im isolierten Mac-Studio-Worktree
`/private/tmp/lf-bfinal-d335-8s5YtQ/repo` unter Node 22.23.2 bestanden
Shell- und Node-Syntax, Prettier, ESLint der Produkt-/CLI-Dateien und die
vollständige Serverregression mit 188/188 Suites und 2.680/2.680 Tests.

Es wurde kein echtes Launch-Receipt erzeugt und kein B-Modelllauf gestartet:
Der reale V35-Stand bleibt bei 0/631 menschlichen Doppelreviews, ohne
dynamischen Restreview, externe Autorität, Trust-Anchor-Pin und signierte
Autorisierung. Ein künstlicher Schlüssel oder synthetisches Review darf
diesen Zustand nicht ersetzen.

Status: `TECHNISCHER B-ONLY-PILOTPFAD UND B-TRANSPORT PASS; ECHTE V35-
DOKUMENTBINDUNG 1+9 PASS; ALTER UNGATED BYPASS GESPERRT; REALER B-PILOT UND
VOLLSTÄNDIGER 1+9-LAUF WEITER FAIL-CLOSED BEI 0/631 FACHREVIEWS`.

### 133.26 Manipulationsfester Excel-Rückweg für die reale 631er-Doppelprüfung

Der nächste Engpass war nicht mehr die A-Materialisierung, sondern die
praktische Durchführung der 631 menschlichen Entscheidungen. Rohes JSON ist
für zwei unabhängige Fachreviewer zu fehleranfällig. Deshalb wurde eine
private V35-Arbeitsmappe mit drei Sichten erstellt:

- `Anleitung` bindet Basis- und Draft-SHA, erklärt die sieben zulässigen
  Relationen und sechs Ursachenklassen und verlangt Reviewer-Slot,
  Reviewer-ID sowie eine ausgeschriebene Unabhängigkeitsattestierung;
- `Review` enthält exakt 631 Legacy-Komponenten mit Legacy-Quellbeleg,
  mechanischem Rollenbefund, zulässigen Kandidaten-IDs und gelben
  Entscheidungsspalten;
- `Kandidaten` normalisiert alle 5.678 dynamischen Kandidaten mit
  Anforderungs-, Komponenten-, Rollen-, Seiten- und Quelltextbeleg.

Die Mappe ist ausdrücklich kein Reviewer-Artefakt, keine Signatur, keine
Freigabe und kein Kundenergebnis. Der neue QA-only-Befehl `workbook-import`
akzeptiert ausschließlich ein frisches, registriertes Reviewer-Template. Er
prüft vor jedem write-once Output:

- Basis- und Draft-Bindung sowie Reviewer-Slot und Reviewer-ID;
- alle 631 Record-IDs und sämtliche sichtbaren Legacy-Belege;
- alle 5.678 Kandidatenzeilen und sämtliche sichtbaren Dynamic-Belege;
- unveränderte Kopfzeilen, keine zusätzlichen Sparse-Zeilen und keine
  Formeln oder komplexen Zellobjekte in menschlichen Eingabefeldern;
- ausschließlich Targets aus dem jeweiligen Record;
- Relations-, Kardinalitäts-, Mergegruppen-, Ursachen- und
  Begründungsvertrag;
- die explizite Erklärung, dass das andere Reviewer-Ergebnis vor Abgabe nicht
  gesehen wurde.

Der Rückimport erzeugt nur ein ausgefülltes, weiterhin unsigniertes
`REVIEW_INPUT_V2`. Signatur, Crosswalk-Approval, dynamischer Restreview,
B-Autorisierung und B-Gate bleiben getrennte spätere Schritte.

Die Iteration fand zwei reale Integrationsfehler. Erstens erfasst
`ExcelJS.actualRowCount` bei angehängten Sparse-Zeilen nicht zuverlässig die
höchste Blattzeile; die zusätzliche Zeile konnte dadurch unentdeckt bleiben.
Der Importer verwendet nun `rowCount`, und der Negativtest besteht. Zweitens
war die direkt mit dem Spreadsheet-Runtime erzeugte XLSX dort zwar lesbar und
visuell korrekt, für ExcelJS 4.4 aber nicht importierbar. Die ausgelieferte
Arbeitsmappe wurde deshalb über LibreOffice auf dem Mac Studio nach OOXML
normalisiert und anschließend mit beiden Engines erneut geprüft.

Finale private Arbeitsmappe:

```text
/Users/slavkoklincov/Code/AnythingLLMStudio-Versicherung/outputs/lf-v35-review-20260912/LF-A-V35-631-Review-Arbeitsmappe.xlsx
SHA-256:
  2ee7d9d1ce98363cb7871d2db7d9b5632108adb0277c30ec4cf602918062ed20
Zeilen:
  631 Reviewrecords, 5.678 Kandidatenrecords
Ausgangsstatus:
  631 OFFEN, 0 Eingaben
```

Ein echter V35-Vertragstest auf dem Mac Studio las die normalisierte Datei,
validierte alle 631 Review- und 5.678 Kandidatenzeilen gegen den eingefrorenen
Draft und stoppte anschließend erwartungsgemäß fail-closed an der ersten
leeren Fachentscheidung
`LF_A_DOUBLE_REVIEW_DECISION_INVALID:DR-6e7f2bc9ca6b36b25bd10dd8`.
Damit ist belegt, dass weder die Belege noch leere Felder still als Review
übernommen werden.

Am exakten Codecommit `086fa312cfad73b5d87698ce2ba696cce78ecddb`
im isolierten Mac-Studio-Worktree
`/private/tmp/lf-review-import-086f-FhCyt6` unter Node 22.23.2 bestanden
Node-Syntax, Prettier, Produkt-/CLI-ESLint ohne Fehler, 20/20 fokussierte Tests
und die vollständige Serverregression mit 189/189 Suites und 2.690/2.690
Tests. Die XLSX bestand außerdem den Formel-Fehlerscan ohne Treffer; alle
drei Blätter wurden nach der Normalisierung erneut gerendert und visuell
geprüft.

Status: `631ER REVIEW-ARBEITSMAPPE UND FAIL-CLOSED RÜCKIMPORT TECHNISCH PASS;
0/631 REALE FACHENTSCHEIDUNGEN; KEINE REGISTRY, SIGNATUR ODER AUTORISIERUNG;
B-PILOT UND 1+9 WEITER GESPERRT`.

### 133.27 Identitätsgebundener, deterministischer Workbook-Export

Die allgemeine V35-Arbeitsmappe aus Abschnitt 133.26 ist eine geeignete
Vorbereitung, aber noch kein reproduzierbarer Reviewer-Paketvertrag. Eine
manuelle Kopie könnte Slot oder Reviewer-ID vertauschen und würde erneut eine
externe OOXML-Normalisierung benötigen. Deshalb erzeugt die QA-CLI nun mit
`workbook-template` direkt aus einem frischen registrierten
`REVIEW_INPUT_V2` eine write-once Arbeitsmappe für genau diesen Reviewer.

Export und Import verwenden dieselben Projektionen für alle 631 Legacy- und
5.678 Kandidatenzeilen. Der Export setzt Basis-SHA, Draft-SHA, Reviewer-Slot
und Reviewer-ID bereits unveränderlich aus dem registrierten Template. Nur
die ausgeschriebene Unabhängigkeitsattestierung und die fünf fachlichen
Entscheidungsfelder bleiben leer. Nach dem Schreiben wird die XLSX erneut mit
ExcelJS geladen und vollständig gegen Draft und Template geprüft. Identische
Eingaben erzeugen byteidentische Dateien; ein wiederverwendetes oder bereits
ausgefülltes Reviewer-Template wird abgelehnt.

Die XLSX wird nun direkt mit der im Produkt bereits verwendeten ExcelJS-
Version erzeugt. Dadurch entfällt für künftige reale Reviewer-Pakete die in
Abschnitt 133.26 benötigte LibreOffice-Normalisierung. Ein echter V35-
Vertragstest mit einer ausdrücklich synthetischen Identität, aber ohne
synthetische Fachentscheidung, erzeugte auf dem Mac Studio:

```text
Dateigröße:       511.059 Bytes
Reviewzeilen:     631
Kandidatenzeilen: 5.678
Review-Blatt:     Zeilen 1..636
Kandidaten-Blatt: Zeilen 1..5.682
Importresultat:   erwarteter fail-closed Stopp am ersten leeren Record
                  DR-6e7f2bc9ca6b36b25bd10dd8
```

Zwei unmittelbar aufeinanderfolgende Exporte mit denselben Eingaben waren
byteidentisch. Die Datei wurde zusätzlich mit dem unabhängigen
Spreadsheet-Runtime importiert, alle drei Blätter wurden gerendert und der
Formelfehlerscan fand keine Treffer. Damit ist die Export-/Importgrenze nun
ohne manuelle Konvertierung reproduzierbar.

Am exakten Commit `284ed43931128db6820ca6e77662243d20cd0edd`
im isolierten Mac-Studio-Worktree
`/private/tmp/lf-review-export-284e-EZMLP7` unter Node 22.23.2 bestanden
Node-Syntax, Prettier, Produkt-/CLI-ESLint, 20/20 fokussierte Tests und
189/189 Server-Suites mit 2.690/2.690 Tests.

Der Exporter erzeugt keine Registry und keine Fachentscheidung. Ohne echte
Reviewer- und Autoritätsdaten konnten daher weiterhin keine realen
identitätsgebundenen Pakete materialisiert werden.

Status: `REPRODUZIERBARER REVIEWER-WORKBOOK-EXPORT UND RÜCKIMPORT TECHNISCH
PASS; REALE REVIEWER-IDENTITÄTEN UND 631ER ENTSCHEIDUNGEN FEHLEN; B-PILOT UND
1+9 WEITER FAIL-CLOSED`.

### 133.28 Korrektur des Startgates: dynamisches A statt Legacy-Review und Kryptoschlüssel

Die in 133.24 bis 133.27 eingeführte 631er-Doppelreview- und
Ed25519-Autorisierungskette wurde irrtümlich zur Voraussetzung für den
internen B-Shadow gemacht. Das widerspricht dem A-getriebenen Produktziel:
Die aktuelle Eingabe A muss selbst Kategorien, Reihenfolge, Anforderungen,
Komponenten und damit das Ergebniszeilenuniversum bestimmen. Ein historischer
283/631-Crosswalk darf diese dynamische Ableitung nur regressiv beurteilen,
nicht den Lauf gegen ein geändertes oder erweitertes A sperren.

Der neue automatische Vertrag `LF_A_AUTOMATED_B_SHADOW_READINESS_V1` prüft
deshalb ausschließlich maschinell belegbare Eigenschaften des aktuellen
Laufs:

- das Inputmanifest bindet alle A- und B-Dokumente eindeutig;
- der A-Source-Unit-Plan wird aus den aktuellen Dokumentartefakten erneut
  aufgebaut und muss byteäquivalent zum gespeicherten Plan sein;
- Batchplan, Batchresultate, Modellantworten und Manifest werden aus der
  deterministisch rekonstruierten Klassifikation erneut validiert;
- jeder A-Quellblock besitzt genau einen terminalen Status;
- offene Units oder Blöcke, fehlende Besitzer und verdächtig als
  nichtoperativ verworfene operative Blöcke stoppen fail-closed;
- Anforderungs- und Komponentenzahl bleiben vollständig dynamisch; es gibt
  weder eine feste Seitenzahl noch ein 283-/631- oder Ein-Dokument-Gate.

Der freigegebene Scope bleibt eng: nur privater B-Retrieval- und
Gegenstück-Shadow. Produkt-Routing, Kundenergebnis, XLSX und Deployment
bleiben ausdrücklich unzulässig. SHA-256 dient dabei nur als technischer
Fingerabdruck gespeicherter Artefakte. Eine Ed25519-Signatur, ein Public Key,
menschliche Reviewer oder der Legacy-Crosswalk sind für diesen internen
Shadow nicht erforderlich.

Der reale V35-Freeze bestand das automatische Gate auf Commit
`e67900f240e704b51f39828e178e6bda894ee11c` im isolierten Mac-Studio-
Worktree `/private/tmp/lf-auto-gate-e679-vcozsT`:

```text
A-Dokumente:                 1
B-Dokumente:                 9
A-Quellblöcke:               1.005
geplante A-Units:              380
A-Batches:                      59
terminale Modellantworten:     349
dynamische Anforderungen:      357
dynamische Komponenten:      1.054
UNRESOLVED Units/Blöcke:         0/0
Legacy-/Reviewer-/Krypto-Gate:  nicht erforderlich
Readiness-SHA-256:
  f2bd24e788b5cf8aad280b7abca6e178dbb27f4414fc158d2054abe0c35fc124
```

Der erste Realcheck deckte einen Integrationsfehler auf: Der gespeicherte
Batchplan bindet den Basis-Source-Plan, die Modellantworten werden jedoch
gegen den daraus deterministisch abgeleiteten Evidence-Plan validiert. Der
Verifier verwendete zunächst fälschlich den Basisplan auch für die
Responsevalidierung und stoppte korrekt. Commit `e67900f24` trennt beide
Kontexte; danach bestand derselbe unveränderte V35-Freeze.

Am exakten Commit bestanden auf dem Mac Studio Node- und Shellsyntax,
Prettier, Produkt-ESLint, 15/15 fokussierte Tests sowie 190/190 Server-Suites
mit 2.693/2.693 Tests. Anschließend wurde der vollständige private B-Shadow
über alle neun B-Dokumente mit BM25, Struktur, Dinghy und Qwen gestartet.
Sein Ergebnis ist noch kein Produkt- oder Qualitätsnachweis und wird erst
nach vollständigem Abschluss separat ausgewertet.

Status: `DYNAMISCHES AUTOMATISCHES A-GATE PASS; FESTE 283/631-ZAHLEN,
REVIEWER UND ED25519 AUS DEM INTERNEN SHADOW-START ENTFERNT; 1+9-B-SHADOW
GESTARTET; PRODUKTROUTING, KUNDEN-XLSX UND DEPLOYMENT WEITER GESPERRT`.

### 133.29 Realer B-Lauf: Paketbudget korrigiert und Retrieval resumierbar gemacht

Der erste automatische 1+9-Start schloss die vollständige B-Suche erfolgreich
ab:

```text
A-Komponenten:                 1.054
B-Dokumente:                       9
Komponente-x-Dokument-Pakete:  9.486/9.486
Dinghy-Rankings:               9.486/9.486
kompaktierte Kandidaten:          50.627
Pakete ohne Kandidat:                  3
maximale Kandidaten pro Paket:        15
```

Vor dem ersten Qwen-Aufruf stoppte der Lauf korrekt mit
`LF_A_DRIVEN_DECISION_PACKAGE_TOO_LARGE`. Die bisherige feste
14.000-Zeichen-Grenze war nur an synthetischen Paketen kalibriert. Im realen
Lauf überschritten 1.518 Pakete diese Grenze; das größte gültig kompaktierte
Paket hatte 26.274 Zeichen. Das war kein A-, Such- oder Modellfehler, sondern
ein zu enger technischer Batchvertrag.

Die allgemeine Korrektur setzt das sichere Standardbudget auf 30.000 Zeichen,
behält maximal vier Pakete pro Modellaufruf bei und macht beide vorgelagerten
Artefaktgrenzen wiederaufnahmefähig:

- ein bereits vorhandenes automatisches A-Receipt wird nur bei vollständiger
  Inhaltsgleichheit wiederverwendet;
- ein vorhandener Dinghy-Lauf wird gegen aktuelles A-Manifest,
  B-Dokumentidentitäten, Embeddingvertrag, Search-Plan, Retrieval,
  rekonstruierte Search-Execution, Rankings und Summary-Digest erneut geprüft;
- erst danach darf der Qwen-Runner vorhandene terminale Batches übernehmen
  und beim ersten unvollständigen Batch fortsetzen;
- unvollständige oder mutierte Retrievalordner bleiben fail-closed und werden
  nicht überschrieben.

Der echte Resume-Check auf Commit
`a1bf3319138eb988fcd836c019cbb6edc2a7ef52` übernahm 9.486/9.486 Rankings,
ohne ein Dokument oder eine Query neu zu embeddeten. Im isolierten
Mac-Studio-Worktree `/private/tmp/lf-b-resume-a1bf-Z3nn7K` bestanden Syntax,
Shellsyntax, Prettier, Produkt-ESLint, 174/174 fokussierte Tests und 190/190
Server-Suites mit 2.694/2.694 Tests.

Der reale Qwen-Lauf wurde mit maximal vier Paketen, 60.000 Zeichen
Gesamtbatchbudget, acht Versuchen, 180 Sekunden Request-Timeout, 15 Sekunden
Abort-Settlement und 180 Sekunden Modell-Recovery fortgesetzt. Der
materialisierte Plan umfasst 2.372 Batches; Batch 1 bestand. Diese Zahlen
sind Laufkonfiguration und keine feste Produktannahme.

Status: `B-RETRIEVAL 9.486/9.486 PASS UND HASHGEBUNDEN RESUMIERBAR;
QWEN-ENTSCHEIDUNGEN 1/2.372 PASS UND LAUFEND; KEIN PRODUKTROUTING, KEINE
KUNDEN-XLSX, KEIN DEPLOYMENT`.

### 133.30 Reale Qwen-Antworten: `NOT_ESTABLISHED` explizit ohne Kandidaten-IDs

Batch 2 des ersten fortgesetzten Qwen-Laufs lieferte in zwei Versuchen
dieselbe formal ungültige, aber diagnostisch klare Struktur: Alle vier
Pakete wurden als `NOT_SUPPORTED` bewertet und alle Dimensionen als
`NOT_ESTABLISHED`, gleichzeitig trug das Modell jedoch sämtliche geprüften
Kandidaten-IDs in diese nicht belegten Dimensionen ein. Der Server lehnte
alle vier Antworten zu Recht als `INVALID_PACKAGE_DECISION` ab.

Der V1-Prompt erklärte bereits, dass ein vollständig fehlender Beleg leere
`selectedCandidateIds` benötigt. Er sagte jedoch nicht unmittelbar bei der
Definition jeder einzelnen `NOT_ESTABLISHED`-Dimension, dass deren
`candidateIds` zwingend leer sein müssen. Der Promptvertrag V2 macht diese
Invariante im Haupt- und Retrytext explizit: Kandidaten-IDs sind ausschließlich
bei `MATCH` oder `MISMATCH` erlaubt; jeder `NOT_ESTABLISHED`-Check trägt
`candidateIds: []`.

Gültige terminale V1-Antworten werden nach einem Promptwechsel nicht blind
übernommen. Sie werden nur bei anerkannter Vorgängerversion, unveränderter
Search-/Plan-/Batch-/Modellbindung und erneut bestandener aktueller
Einzelvalidierung migriert. Alte ungültige Attempt-Antworten bleiben
unverwendet. Damit konnte Batch 1 ohne Modellneuberechnung übernommen werden;
Batch 2 bestand mit Prompt V2 im ersten neuen Versuch.

Commit `31adbb10c` bestand auf dem Mac Studio Syntax, Prettier, Produkt-ESLint,
175/175 fokussierte Tests und 190/190 Server-Suites mit 2.695/2.695 Tests.
Der reale Lauf wurde aus denselben Retrievalartefakten fortgesetzt.

Status: `QWEN-PROMPT V2 UND VALIDIERTE VORGÄNGERMIGRATION PASS;
B-ENTSCHEIDUNGEN 2/2.372 PASS UND LAUFEND; KEIN KUNDENARTEFAKT ODER
DEPLOYMENT`.

### 133.31 Reale B-Retries sind paketisoliert und pro Paket begrenzt

Der fortgesetzte reale B-Shadow legte nach 25 bestandenen Batches zwei weitere
allgemeine Antwortmuster offen. Erstens lieferte ein als `SUPPORTED`
bewertetes Paket zwar belegte `FACT_ROLE`- und `SCOPE`-Dimensionen, führte in
`selectedCandidateIds` aber nur einen Teil ihrer Kandidaten-Union. Zweitens
enthielt ein als `NOT_SUPPORTED` bewertetes Paket gleichzeitig eine
`MISMATCH`- und eine `MATCH`-Dimension. Beide Antworten waren semantisch
inkonsistent und wurden vom unveränderten Validator korrekt verworfen.

Die bereits eingeführte serielle Reparatur ungültiger Pakete verhinderte,
dass ein Modellfehler weitere Pakete desselben Batches verunreinigte. Ihr
Versuchslimit galt jedoch noch für den gesamten Batch. Ein schwieriges erstes
Paket konnte dadurch alle acht Versuche verbrauchen, bevor die übrigen
Pakete ihr eigenes begrenztes Reparaturbudget erhielten. Der Runner behandelt
`maximumAttempts` nun als Grenze je Paket. Der erste Mehrpaketaufruf bleibt
für den Normalfall erhalten; danach werden ausschließlich die noch
ungültigen Pakete einzeln repariert. Die maximale Zahl der Modellaufrufe ist
deterministisch auf `1 + offene Pakete * (maximumAttempts - 1)` begrenzt.

Ungültige Antworten erhalten zusätzlich maschinenlesbare Ursachen, darunter
ungültige Ergebniswerte, unbekannte oder doppelte Kandidaten-IDs, eine
abweichende Kandidaten-Union sowie nicht zusammenpassende
`SUPPORTED`-/`CONTRADICTED`-/`NOT_SUPPORTED`-Dimensionsmuster. Diese
Diagnostik lockert keine gültige Ergebnisregel und ändert den V4-Vertrag
gespeicherter PASS-Artefakte nicht.

Beim echten Resume wurden die 25 bestandenen Batches nicht neu berechnet.
Für Batch 26 wurde ein bereits gültiges Paket aus dem alten Attempt-Journal
übernommen; nur die drei noch offenen Pakete wurden erneut angefragt und der
Batch anschließend PASS materialisiert. Am exakten Commit
`9c102daba` bestanden im isolierten Mac-Studio-Worktree
`/private/tmp/lf-b-retry-9c1-t2NGx2/repo` Node-Syntax, Prettier, der
vollständige Server-Lint sowie 190/190 Suites mit 2.700/2.700 Tests. Der reale
Lauf erreichte danach mindestens 37/2.372 PASS-Batches und lief weiter.

Status: `PER-PAKET-RETRY UND GRANULARE FEHLERDIAGNOSTIK PASS; BESTEHENDE
PASS- UND TEILARTEFAKTE WIEDERVERWENDET; B-SHADOW LÄUFT; KEINE
PRODUKTFREIGABE`.

### 133.32 Blockabdeckung ist noch kein Atomizitätsnachweis

Das automatische A-Gate belegt für den eingefrorenen V35-Lauf weiterhin die
eindeutige terminale Verarbeitung aller 1.005 A-Quellblöcke. Es beweist aber
nicht, dass jede der 1.054 dynamischen Komponenten fachlich minimal und
richtig typisiert ist. Der Klassifikationsprompt verlangt atomare
Anforderungen, erlaubt als Komponentenlabel jedoch jeden nichtleeren
wörtlichen Quellsubstring und verwendet im Listenbeispiel den vollständigen
Listenpunkt als `OBJECT`. Der serverseitige Validator prüft Quellenbindung,
Typen, Rollenpflichten und Blockabdeckung, aber bislang keine fachliche
Minimalität eines Komponentenlabels.

Der neue getrennte Diagnosevertrag
`LF_A_DYNAMIC_ATOMICITY_RISK_AUDIT_V1` verändert deshalb weder Manifest noch
historischen Statusaudit. Er markiert source-bound Hochrisikofälle für eine
nachfolgende gezielte Re-Atomisierung und darf weder automatisch splitten
noch einen Fachfehler behaupten. Im realen unveränderten V35-Manifest meldet
er:

```text
dynamische Anforderungen:                  357
dynamische Komponenten:                  1.054
reviewpflichtige Risikokomponenten:         141
Risikosignale insgesamt:                    177
Label enthält anders typisierte Schwester: 122
überbreites Label (> 240 Zeichen):           53
zusammengesetzte Parteienrolle:               1
isolierte Parteienrolle mit Folgekontext:     1
Atomicity-Review:                          FAIL
```

Das private Audit liegt im B-Shadow-Ordner als
`a-atomicity-risk-audit.private.json`; sein Dateihash ist
`0deb39dd57b62f94547314bb3c7527ca8fc3dcbc093f1c4eda68c4b0d43e502e`.
Ein Treffer ist nur Reviewevidenz, null Treffer wären ebenfalls kein
Vollständigkeitsbeweis. Die nächste zulässige Änderung ist daher eine
begrenzte, source-bound Re-Atomisierung der betroffenen Units mit vollständigem
Manifest-Rebuild und Vorher-/Nachher-Audit. Eine Regex-Zerlegung oder eine
direkte Korrektur gespeicherter Ergebnisartefakte bleibt unzulässig.

Status: `A-QUELLABDECKUNG PASS; A-ATOMIZITÄT NICHT BEWIESEN; 141
RISIKOKOMPONENTEN VOR PRODUKTROUTING GEZIELT ZU PRÜFEN`.

### 133.33 Syntaktischer A-Neuplan: Strukturpfad ist kein Ausschlussbeleg

Der auf Commit `f36bb7155fbc6cbc5470c6299171bed5d43e1b55` neu gebaute
syntaktische A-Plan besitzt weiterhin 1.005/1.005 Quellblöcke, aber durch die
allgemeine Klausel-, Listen- und Fortsetzungssegmentierung 376 statt 380
Units und 58 statt 59 Batches. Aus dem vollständig validierten V35-Seed waren
312 von 345 neu zu klassifizierenden Units nach aktueller Revalidierung
source-identisch wiederverwendbar; 40 Batches waren vollständig und 18
teilweise vorbesetzt.

Der reale V57-Lauf übernahm beziehungsweise materialisierte Batch 1 bis 14
als `PASS`. Batch 15 blieb nach acht begrenzten Modellversuchen korrekt
fail-closed und wurde nicht als `PASS` gespeichert. Es gab keinen Timeout und
keinen Transportfehler. Qwen deutete einen nur zur Navigation erhaltenen
`structurePath` mit dem Text `Nicht versichert sind:` wiederholt als
fachlichen Ausschluss. Der serverseitig verknüpfte `governingContext` enthielt
hingegen ausschließlich Katastrophen-, Limit- und Gefahrkontext ohne
wörtlichen Deckungswirkungs- oder Ausschlussausdruck. Zusätzlich zitierte die
verbleibende Hochwasserkomponente nur den ersten Block eines einzigen über
zwei Blöcke fortgesetzten Klammer-Listeneintrags. Der Validator verwarf alle
acht Varianten; die 14 früheren PASS-Batches und alle Attempt-Artefakte
blieben resumierbar erhalten.

Commit `7d7f76e0a325bec0e8ff365319b40f4a8a3fd7c0` hebt Runner und Prompt auf
V58/V26 und implementiert die allgemeine Grenze:

- `structurePath` ist ausschließlich Navigation und nie semantische Evidenz;
- `governingContext` trägt nur jene Dimensionen, die dort wörtlich belegt
  sind; Limit, Scope oder Gefahr erzeugen keine Deckungswirkung;
- ohne wörtlichen Wirkungsbeleg werden sowohl
  `OPERATIVE_COVERAGE_STATEMENT` als auch `EXCLUSION` entfernt und die
  verbleibenden source-bound Komponenten bestimmen die tatsächliche Klasse;
- bei genau einem syntaktisch fortgesetzten, geklammerten Listenpunkt darf
  eine einzige belegte Objekt-, Gefahren-, Schadens- oder Rollenkomponente
  alle Blöcke dieses einen Segments zitieren;
- echte wörtliche Ausschlüsse bleiben unverändert; mehrere unabhängige
  Listensegmente werden niemals zusammengezogen.

Die unveränderte reale V57-Antwort aus Versuch 2 wurde auf dem Mac Studio
gegen den neuen Code erneut ausgewertet. Sie terminiert nun als
`PERIL_OR_DAMAGE`, bindet beide Hochwasserblöcke, übernimmt die tatsächlich
belegten Governor-Limits serverseitig und besteht den aktuellen
Manifestvalidator. Am selben Byte-Stand bestanden auf dem Mac Studio:

```text
Node-Syntax:                         PASS
Prettier:                            PASS
fokussierter A-Vertrag:              291/291 PASS
vollständiger Server-Lint:           PASS
vollständige Server-Suites:          190/190 PASS
vollständige Servertests:          2.823/2.823 PASS
```

Das beweist die allgemeine Korrektur des beobachteten Struktur-/Wirkungsfehlers
und die sichere Wiederaufnahmefähigkeit. Es beweist noch keine vollständige
A-Atomizität, keine vollständige B-Suche, keinen Holdout und keine
Produktfreigabe. Der nächste Schritt ist die Wiederaufnahme desselben
58-Batch-A-Laufs auf dem exakten Fix-Commit; neue Modellfehler bleiben
inkrementell und fail-closed zu behandeln.

Status: `V58/V26 STRUKTUR-EVIDENZGRENZE UND REALE BATCH-15-GEGENPROBE PASS;
14/58 A-BATCHES RESUMIERBAR; VOLLSTÄNDIGER A-LAUF, B-SHADOW,
PRODUKTROUTING, XLSX UND DEPLOYMENT OFFEN`.

### 133.34 Zeilenweiser Gold-Kurs: 30er-Quellenkalibrierung statt technischer Stellvertretermetriken

Die bisherige bekannte 1+9-Auswertung besaß keinen fachlich entschiedenen
Zeilenstandard: `LF_COUNTERPART_GOLD_ORACLE_V1` enthielt zwar 283 Zeilen und
631 Komponenten, war aber vollständig `UNREVIEWED`. Deshalb durfte weder ein
technisches PASS noch die Zahl verarbeiteter A-Blöcke als Beleg für das beste
Kundenergebnis gelten. Die Kurskorrektur priorisiert nun Originalstellen und
misst jede weitere Änderung gegen einen source-bound Entscheid.

Die allgemeine Quellensuche wurde dafür erweitert: A-Wortlaut wird unabhängig
vom bisherigen Zeilenretrieval im gesamten bekannten B-Korpus gesucht,
deutsche Komposita wie `Einbruch`/`Einbruchdiebstahl` werden erkannt,
inzidentelle kurze Suffixe wie `Bruch`/`Einbruch` verworfen, pro semantischem
Check werden bis zu drei dokumentdiverse globale Kandidaten gehalten und
Modellzitate auf 600 Zeichen kompaktiert. Dadurch wurde für FE-18 erstmals die
konkrete B-Stelle auf Seite 12 der Musterberechnung gefunden, die Schäden an
Gebäudebestandteilen und Einfriedungen im Zuge eines Einbruchdiebstahls
versichert.

Die 30-Zeilen-Kalibrierung deckte anschließend zwei grundlegende
Entscheidungsfehler auf und führte zu allgemeinen Verträgen:

- Ein Match nur auf dem synthetischen Zeilenkontext darf ohne mindestens eine
  gefundene fachliche Komponente niemals `gefunden` erzeugen.
- Ein B-Gegenstück muss nicht wort- oder wertgleich sein. Derselbe fachliche
  Vergleichskern mit anderem Wert, Limit, Selbstbehalt, Zeitraum, Scope oder
  anderer Bedingung ist `COUNTERPART_WITH_DIFFERENCE` und bleibt für den
  Kunden gefunden. Ein anderes Objekt, eine andere Gefahr, Wirkung oder Rolle
  ist dagegen nur `RELATED_ONLY`.
- Bei einer Kernkomponente bleibt der Kern `MATCH`, wenn lediglich ein
  Modifikator abweicht; der Modifikator wird separat source-bound ausgewiesen.
  Eine echte gegenteilige Wirkung desselben Scopes ist `OPPOSITE`.
- Der Server leitet daraus zusätzlich strikt binär `customerFound` ab. Interne
  Unterschiede bleiben für die Darstellung erhalten, erzeugen aber keinen
  dritten Kundenstatus.

Der finale Qwen-Review lief auf dem Mac Studio aus
`/private/tmp/lf-gold-v10-0dd8a65a` und wurde nach einem fail-closed Stopp bei
FE-03 auf Commit `a252ba7d8a90bf74a365553677e2c2539c3febf8` ab Zeile 12
fortgesetzt. Zeilen 1 bis 11 wurden unverändert wiederverwendet. Konfiguration:

```text
Paketvertrag: LF_1PLUS9_SOURCE_REVIEW_PACKET_V6
Prompt/Run: LF_1PLUS9_SOURCE_REVIEW_PROMPT_V10 / RUN_V10
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Request-Timeout: 240000 ms
Abort-Settlement: 15000 ms
Model-Recovery: 180000 ms
Maximum Attempts: 3
```

Ergebnis des vollständigen Modellreviews:

```text
Zeilen:                         30/30
FULL_COUNTERPART:                  5
PARTIAL_COUNTERPART:              10
NO_COUNTERPART_ESTABLISHED:       15
customerFound ja/nein:         15/15
Modellversuche:                   38
echte Timeouts:                    2
semantisch ungültige Versuche:     6
validierte Antworten:             30
```

Beide Timeouts wurden als Transportfehler protokolliert, abgebrochen, settled
und erst nach gezieltem Entladen, Neuladen und exakter Modell-/Kontextprüfung
wiederholt. Kein Timeout wurde als fachliches Nein gespeichert. Der
Qwen-Summary-Dateihash ist
`80a69912f996e06b690d2216f9d44167555d18e3ed56def83a7b2eaf3a22db5c`;
der Paket-Dateihash ist
`d7ec58b69cdc26018a44fb28180152c7533c09eda98db1aa611eb3a8de72ab86`.

Qwen bleibt ausdrücklich `NOT_GOLD`. Der neue private
`LF_1PLUS9_SOURCE_ADJUDICATION_DRAFT_V1` bindet deshalb die unabhängige
Codex-Originalstellenprüfung und lässt negative Abwesenheit offen. Der
Materialisierer verwirft erfundene Kandidaten-IDs, positive Entscheide ohne
Quelle und widersprüchliche Originalrange-Hashes. Mehrere Ausschnitte derselben
hashgebundenen Originalrange bleiben zulässig.

Der 30er-Codex-Entwurf ergibt:

```text
customerFound:                         21
negative Vollkorpussuche noch offen:    9
FULL_COUNTERPART:                       3
PARTIAL_COUNTERPART:                   18
Qwen-Übereinstimmung:                    22
Qwen-Abweichung:                         8
Expertenreview erforderlich:            15
Abwesenheit zertifiziert:                0
```

Die acht binären Konflikte sind sieben von Codex positiv entschiedene
Qwen-Misses (`FE-18`, `ST-17`, `PR-08`, `VS-01`, `KO-04`, `VS-03`, `SP-02`)
und ein von Codex verworfener Qwen-Treffer (`OK-09`: allgemeine
Vertragskündigung ist keine Kündigung des Ökoschutz-Bausteins). Gegenüber dem
alten Systemstatus auf denselben 30 Zeilen wurden 15 zusätzliche echte
Fundstellenkandidaten aufgenommen und sechs alte falsche Treffer verworfen;
der binäre Nettoanstieg beträgt neun Zeilen. Das ist ein fachlicher
Reviewbefund für den bekannten 30er-Satz, noch keine 283er- oder
Generalisierungsmetrik.

Private Artefakte auf dem Mac Studio:

```text
Qwen:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-1PLUS9-SOURCE-REVIEW-30-V8-20260913-761B609A/qwen-review-v10

Codex-Adjudikation:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-1PLUS9-SOURCE-ADJUDICATION-30-V1-20260913-D32FA6F1/source-adjudication.draft.private.json
```

Der interne Adjudikationshash ist
`c4ea8d196ae7d26af9bbabdff43465b5d4699c310289e583f20c6acafeb41f20`,
der Dateihash
`e9afd9632e606d879b227b726258348f9c3c355950ed701a8d9609afbb9e2f6b`.
Beide privaten Eingabedateien besitzen Modus `0600`.

Auf Commit `536d367bbf65aa8a415b9c32340fc41d9a67ba10` bestanden im
isolierten Mac-Studio-Worktree `/private/tmp/lf-adjudication-d32fa6f1`
Syntax, Prettier und die drei fokussierten Suites mit 14/14 Tests.

Nächster Gate: Für die neun Negativzeilen müssen alle neun Dokumente und die
definierten Suchwege vollständig geprüft werden. Danach werden die 15
reviewpflichtigen Zeilen fachlich bestätigt. Erst dann darf die
Quellenadjudikation auf alle 283 Zeilen skaliert und anschließend als
unveränderliches Gold eingefroren werden.

Status: `30/30 QWEN-REVIEW UND SOURCE-BOUND CODEX-ENTWURF VORHANDEN; 21
POSITIVE FUNDSTELLENENTSCHEIDE, 9 NEGATIVE VOLLKORPUSPRÜFUNGEN UND 15
EXPERTENREVIEWS OFFEN; NOCH KEIN GOLD, KEINE KUNDEN-XLSX, KEIN DEPLOYMENT`.

### 133.35 Erster verbindlicher Gold-Slice: 30/30 quellenentschieden, ohne unklar

Die neun zuvor offenen Negativzeilen wurden nicht aus Retrieval-Top-N
abgeleitet, sondern auf dem Mac Studio gegen die neun originalen B-PDFs
geprüft. Der neue QA-Vertrag verifiziert für jede Datei zuerst den SHA-256-
Fingerprint aus dem Oracle und extrahiert anschließend mit macOS PDFKit jede
physische Seite. Der Lauf umfasste neun Dokumente, 77 Seiten, elf explizite
Wortlaut-/Synonymrouten und 15 zu prüfende Fundstellen. Die Ausführung bindet
also den vollständigen bekannten PDF-Textkorpus; sie beansprucht weder
allgemeine Synonymvollständigkeit noch einen Holdoutbeweis.

Der Vollscan korrigierte `PR-02`: Auf Seite 6 der Musterberechnung steht
`RV WEVIG/Familienwohnbau gilt als vereinbart`, auf Seite 1 der konkrete
Versicherungsnehmer `Firma WEG Treustraße 57`. Das ist kein vollständiger
Gleichlaut des in A definierten Kreises aus Familienwohnbau,
Tochtergesellschaften und LF-Immo-Betreuung, aber ein echtes Gegenstück mit
abweichendem Scope. Die binäre Goldentscheidung lautet deshalb `gefunden`,
fachlich `PARTIAL_COUNTERPART`. Claude hatte diesen Punkt bereits teilweise
gefunden; Qwen und das alte System hatten ihn verfehlt.

Die technische Ursache des Qwen-Misses lag zusätzlich in der
Quellenkompaktierung: Der richtige globale Originalkandidat war vorhanden,
der 600-Zeichen-Ausschnitt wurde jedoch auf das häufige längere Wort
`Versicherungsnehmer` zentriert und endete unmittelbar vor dem spezifischen
Wort `Familienwohnbau`. Die allgemeine Regel priorisiert nun zuerst den
atomaren Komponentenbegriff, danach Prüfpunkt, A-Wortlaut und Claude-Zitat.
Der neu materialisierte V9-Paketstand enthält die Seite-6-Stelle vollständig.

Die verbleibenden acht Negativentscheidungen wurden nach Sichtung aller
thematisch ähnlichen Vollkorpustreffer für genau diesen bekannten Fixture
bestätigt:

```text
VS-25  gewerblich genutzte Nebengebäude
SP-03  Zwischenlagerung im Gebäudeschadenscope
LW-G-06 automatische Grünflächenberegnung/-bewässerung
GL-26  definierter Glas-Ausschluss für Feuer-/Flugkörpergefahren
OK-09  Kündigung eines eigenständigen Ökoschutz-Bausteins
VS-31  Freileitungen, technische Bauten und Grabungsarbeiten
PR-09  Nichtaddition paralleler Versicherungssummen
VS-08  vollständige A-Definition Nebengebäude
```

Der unveränderliche private Gold-Slice lautet:

```text
Vertrag: LF_1PLUS9_GOLD_30_V1
Status: FROZEN_SOURCE_BOUND_GOLD_FOR_KNOWN_30_ROWS
Zeilen: 30/30
Gefunden: 22
Nicht gefunden: 8
FULL_COUNTERPART: 3
PARTIAL_COUNTERPART: 19
NO_COUNTERPART_ESTABLISHED: 8
Unklar: 0
bekannter Fixture-Nullfund über 9 PDFs/77 Seiten: 8
interner Gold-Hash: 01b534e7bff717f3db3ce8a0742356e1644c7d489daf31ea549cbc10d9781747
Dateihash: cff20090e2382b1131454f8d9a47f5dba3ca252deb8a1f8d5b95258dfec74f71
```

Artefakte auf dem Mac Studio:

```text
PDF-Vollkorpusaudit:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-1PLUS9-FULL-CORPUS-AUDIT-9-V2-20260913-86FE866E/full-corpus-audit.private.json

Quellenpaket mit korrigierter Ausschnittwahl:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-1PLUS9-SOURCE-REVIEW-30-V9-20260913-21577084/review-packet.private.json

Gold-Slice:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-1PLUS9-GOLD-30-V2-20260913-02039DB4/gold-30.private.json
```

Auf Commit `02039db40` bestanden im isolierten Mac-Studio-Worktree
`/private/tmp/lf-gold-02039db4` Syntax und Prettier sowie vier fokussierte
Suites mit 14/14 Tests. Der systemweit installierte ESLint-9.39.3-Lauf ist
derzeit wegen einer inkompatiblen installierten `eslint-plugin-react`-API
(`context.getFirstTokens`) bereits beim Laden der Regel blockiert; dies ist
kein fachlicher Test-PASS und wird nicht verschwiegen.

Der nächste Schritt ist keine neue Nebenarchitektur. Derselbe Quellenvertrag
wurde bereits auf alle 283 Zeilen materialisiert: 283 Zeilen, 631 fachliche
Komponenten, 914 semantische Checks, 7.173 ausgewählte exakte Quellen sowie
2.737 globale A- und 780 globale Claude-Rückbindungen über jeweils alle neun
B-Dokumente. Der private Paket-Dateihash ist
`1d932a0b1dc79cf4c5a6c42f81a0ce5dd6df7435376845ae38c6986d521d95ae`.
Danach werden nur die konkreten
Claude-/Qwen-/Systemabweichungen und negativen Zeilen gegen Originalstellen
entschieden; das bekannte 283er-Gold bleibt Regression und darf nie
Produktionszeilen eines neuen A-Dokuments vorgeben.

Status: `LF_1PLUS9_GOLD_30_V1 FROZEN; 30/30 ENTSCHIEDEN, 22 GEFUNDEN, 8 NICHT
GEFUNDEN, 0 UNKLAR; 283ER QUELLENPAKET VOLLSTÄNDIG UND QWEN-REVIEW GESTARTET; KEINE KUNDEN-XLSX,
KEIN DEPLOYMENT UND KEIN GENERALISIERUNGS-/99-PROZENT-NACHWEIS`.

### 133.36 Verbindliche binäre Gegenstücksemantik und sichere 283er-Wiederaufnahme

Der Auftraggeber hat die fachliche Semantik am 13. September 2026
ausdrücklich bestätigt: `GEFUNDEN` bedeutet, dass B eine quellengebundene
Fundstelle zum selben fachlichen Element besitzt. Abweichende Werte, Limits,
Bedingungen, Umfänge oder ein ausdrücklicher Ausschluss werden separat
dargestellt und ändern den Fundstatus nicht. Keyword-Nennung, allgemeine
Überschrift oder eine nur entfernt verwandte Deckung bleiben ohne Treffer.
Diese Regel ist nun zusätzlich in Produktvertrag und ADR-031 verankert.

Der bestehende V10-Quellenvertrag setzte diese Semantik bereits technisch um:
`MATCH`, `COUNTERPART_WITH_DIFFERENCE` und `OPPOSITE` können je nach
Komponentenrollup `customerFound: true` ergeben; ein synthetischer
Zeilenkontext, `RELATED_ONLY` oder eine bloße Wortähnlichkeit kann keinen
Treffer begründen. Daher war kein Neustart des 283er-Modellreviews wegen der
fachlichen Bestätigung nötig.

Beim ersten 283er-Start wurde nach vier gültigen Zeilen ein falscher
LM-Studio-SDK-Pfad in der Timeout-Wiederherstellung beobachtet. Eine weitere
Antwort für PR-05 war nach fehlgeschlagener sicherer Wiederherstellung unter
dem alten Runner dennoch versucht worden. Ergebnis und beide Versuche wurden
unverändert in eine private Quarantäne verschoben; sie gelten nicht als
aktive Reviewevidenz. Der Runner bricht auf Commit
`2e15135a58e47c208e00f5fb56b4e228c6282ce4` bei `retrySafe === false` nun
fail-closed ohne weiteren Modellaufruf ab. Der neue Test belegt genau einen
Versuch, ein Fehlerartefakt und kein Ergebnisartefakt; auf dem Mac Studio
bestanden 7/7 fokussierte Tests.

Der Lauf wurde aus dem isolierten Mac-Studio-Worktree
`/Users/michaelmischkot/Code/validation-worktrees/lf-source-review-2e15135a5`
mit Qwen `qwen/qwen3.6-35b-a3b`, Kontext 42.496 und dem verifizierten lokalen
SDK `1.5.0` wiederaufgenommen. Die vier gültigen Zeilen werden
wiederverwendet; weitergearbeitet wird ab PR-05. Die Modellentscheidungen
bleiben `NOT_GOLD` und werden anschließend gegen Originalquellen und die
anderen unabhängigen Ergebnisse adjudiziert.

Status: `BINÄRE GEGENSTÜCKSEMANTIK VERBINDLICH; 283ER REVIEW SICHER
WIEDERAUFGENOMMEN; QWEN BLEIBT NOT_GOLD; KEINE KUNDEN-XLSX UND KEIN
DEPLOYMENT`.

### 133.37 Qwen aus dem kritischen Goldpfad genommen und Sol-Blindpilot gestoppt

Auf Auftrag des Auftraggebers ist Qwen keine blockierende Voraussetzung für
die Gold-Erstellung mehr. Der V10-Lauf blieb unverändert erhalten und stoppte
nach 98/283 gültigen Zeilen an der vollständigen Zeilengrenze ST-20
fail-closed. Drei Antworten verletzten nacheinander
`LF_SOURCE_REVIEW_DIFFERENCE_EVIDENCE_MISSING`; es wurde keine ungültige 99. Zeile gespeichert. Alle 98 gültigen Zeilen sowie die drei
Versuchsartefakte bleiben resumierbarer, unabhängiger Benchmark.

Der bisherige Quellenreview-Paketvertrag war nicht blind nutzbar: Claude war
nicht nur als sichtbares Label enthalten, sondern konnte über
`globalClaudeRebind` und die komponentenweise Rangfolge die Kandidatenauswahl
beeinflussen. Commit `f345a24a655b374f17472535ce1365f3227ae0c9`
materialisiert deshalb einen getrennten
`LF_1PLUS9_BLIND_SOURCE_REVIEW_PACKET_V1`. Dessen Reviewzeilen enthalten nur
A-Referenz, A-Komponenten, Dokumentmetadaten und exakte B-Quellenkandidaten;
Kandidatenranking und Ausschnittwahl sind A-only. Qwen-, Claude-, System-B-,
Relation- und bisherige Goldentscheidungen sind ausgeschlossen. Auf dem Mac
Studio bestanden Syntax, Prettier und 8/8 fokussierte Vertragstests.

Das vollständige Blindpaket umfasst 283 Zeilen, 631 Komponenten, 914 Checks,
42.429 verfügbare und 6.394 ausgewählte exakte Kandidaten über neun
B-Dokumente. Interner Pakethash:
`02aae693a1b1872963aecd1832ef170ffa20367dfb42e6cd7f407a78eda74293`;
Dateihash:
`48f7219514b115879465442b5fc1ce307d5207ae4a6e8048a822a967e62c0231`.

Der isolierte erste Blindpilot lief mit `gpt-5.6-sol`, Reasoning `high`, für
PR-01 bis PR-10 in 158 Sekunden beziehungsweise 15,8 Sekunden pro Zeile.
10/10 Antworten und 24/24 Komponentenfindings bestanden anschließend auf dem
Mac Studio den bestehenden Quellen- und Candidate-ID-Validator. Der
deterministische Rollup ergab einmal `FULL_COUNTERPART`, dreimal
`PARTIAL_COUNTERPART` und sechsmal `NO_COUNTERPART_ESTABLISHED`.

Die nach dem Blindpass zulässige Kontrolle gegen das eingefrorene Gold-30
zeigte jedoch ein fachliches Stoppsignal: Vier der zehn Zeilen besitzen
bereits eine finale Goldentscheidung, und Sol wich bei allen vier binären
Fundstati ab. PR-01, PR-02 und PR-08 wurden fälschlich nicht gefunden; PR-09
wurde fälschlich gefunden. Bei PR-01 und PR-02 lag die jeweilige richtige
Gold-Fundstelle bereits im blinden Kandidateninput; bei PR-08 lag eine von
zwei Gold-Fundstellen vor. PR-09 verwechselte eine Regel zur
Mehrfachversicherung mit der gesuchten Nichtaddition paralleler
Exklusivschutz-Summen. Damit ist die Hauptursache nicht bloß fehlendes
Retrieval, sondern der Zehn-Zeilen-Sammelkontext beziehungsweise die
fachliche Modellentscheidung.

Der Sol-Pass ist zwar gegenüber den ersten zehn Qwen-Zeilen um Faktor 2,76
schneller (Qwen 436,069 Sekunden beziehungsweise 43,607 Sekunden pro Zeile),
darf in dieser Form aber nicht auf 283 Zeilen skaliert werden. Seine lineare
Zeitprojektion läge bei rund 74,5 Minuten; Geschwindigkeit allein erfüllt den
Goldvertrag nicht. Vor einer Fortsetzung müssen zeilenisolierte frische
Kontexte gegen die vier bekannten Kalibrierzeilen geprüft werden. Danach
werden echte Abweichungen und Hochrisikofälle wie vereinbart mit
`gpt-6-astra`, Reasoning `xhigh`, anhand der Originalquellen adjudiziert.

Private Artefakte auf dem Mac Studio:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-1PLUS9-SOL-BLIND-V1-20260913-F345A24A/blind-review-packet.private.json
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-1PLUS9-SOL-BLIND-V1-20260913-F345A24A/sol-blind-first10.raw.private.json
```

Status: `QWEN 98/283 RESUMIERBAR UND NICHTBLOCKIEREND; SOL-BLINDPILOT 10/10
TECHNISCH GÜLTIG, ABER QUALITÄTSGATE 0/4 GEGEN BEKANNTES GOLD; SOL NICHT AUF
283 SKALIERT; KEINE KUNDEN-XLSX UND KEIN DEPLOYMENT`.

### 133.38 Zweistufiges Sol-Gate: Problem-4 vor Gold-30 vor 283

Der Auftraggeber verschärfte den Freigabevertrag: Auch ein bestandener
isolierter Problemtest mit PR-01, PR-02, PR-08 und PR-09 darf niemals direkt
zur 283er-Skalierung führen. Danach müssen zwingend alle 30 bereits
eingefrorenen Goldzeilen jeweils in einem getrennten frischen blinden
`gpt-5.6-sol`-Kontext mit Reasoning `high` geprüft werden. Erst dieses
30er-Gate bewertet binären Fundstatus, `FULL`/`PARTIAL`/`CONTRADICTED`/`NO`,
Quellenwahl, False Positives, False Negatives, Detailfehler, technische Fehler
und Laufzeit. Nur bei klar bestandenem 30er-Gate darf Sol für 283 verwendet
werden; andernfalls muss Astra den primären Goldpass übernehmen.

Der erste zeilenisolierte Problem-4-Test wurde in vier voneinander getrennten
frischen Sol-Kontexten durchgeführt. Sämtliche Modellinputs blieben A-only;
Gold, Qwen, Claude und System-B-Entscheidungen wurden erst nach Abschluss und
Mac-Studio-Validierung eingeblendet. Die kumulierte Modellzeit betrug 412,276
Sekunden, durchschnittlich 103,069 Sekunden pro Zeile. Wegen paralleler
Ausführung lag die beobachtete Spanne zwischen erstem Start und letztem Ende
bei 254 Sekunden. Einzelzeiten: PR-01 43 Sekunden, PR-02 172,332 Sekunden,
PR-08 32,944 Sekunden und PR-09 164 Sekunden.

Das Vor-Gate ist nicht bestanden:

- PR-01: technisch gültig, aber weiterhin falsch negativ gegenüber
  `FULL_COUNTERPART`;
- PR-02: technisch ungültig, weil der zwingende synthetische Kontextcheck
  fehlte; die sichtbare Familienwohnbau-Fundstelle wurde außerdem nur als
  entfernt verwandt bewertet;
- PR-08: technisch gültig, aber weiterhin falsch negativ gegenüber
  `PARTIAL_COUNTERPART`;
- PR-09: technisch gültiger Rollup `NO_COUNTERPART_ESTABLISHED` und damit
  binär korrekt, obwohl die Einzelkomponente die scopefremde
  Mehrfachversicherungsregel noch als abweichendes Gegenstück bewertete.

Die anschließende Inputprüfung trennt Modell- und Retrievalursachen. Der
richtige PR-01-Kandidat war zwar anhand seiner ID enthalten, sein
600-Zeichen-Ausschnitt endete aber unmittelbar vor der entscheidenden Passage
über Neuverträge und Konvertierungen. Bei PR-08 war ebenfalls nur der
vorangestellte Rahmenvereinbarungsausschnitt vorhanden; die zweite
Gold-Fundstelle zur Günstigkeitsklausel fehlte vollständig. PR-02 enthielt den
Wortlaut `RV WEVIG/Familienwohnbau gilt als vereinbart`, aber nicht die zweite
vollständige Goldquelle zum konkreten Versicherungsnehmerkreis in einer
gleichwertig klaren Quellenkombination. Damit ist der jetzige A-only-
Kandidatenkompaktierungsvertrag für eine blinde Goldentscheidung noch nicht
evidenzvollständig.

Folgerung: Das Gold-30-Gate wurde nicht gestartet. Zuerst muss der blinde
Quellenvertrag pro Zeile einen vollständigen, hashgebundenen Zugriff auf den
relevanten Originalkorpus erlauben, ohne frühere Entscheidungslabels oder
Goldsuchbegriffe einzublenden. Danach wird Problem-4 erneut frisch geprüft.
Selbst bei 4/4 folgt weiterhin zwingend Gold-30; erst danach kann zwischen Sol
und Astra als primärem 283er-Reviewer entschieden werden.

Status: `SOL PROBLEM-4 NICHT BESTANDEN; BLINDQUELLENINPUT NICHT
EVIDENZVOLLSTÄNDIG; GOLD-30 NICHT GESTARTET; 283 NICHT FREIGEGEBEN; QWEN
98/283 UNVERÄNDERT RESUMIERBAR`.

### 133.39 LF_REFERENCE_A_DRIVEN_V2: B-Pilot, ehrliche Gold-Messung und kontextfester Rescue

Die Produktarbeit wurde auf dem sauberen Entwicklungsbranch
`codex/lf-reference-a-driven-v2` fortgesetzt. Gold-283 blieb unverändert und
ist weiterhin ausschließlich QA-Regression für das bekannte LF-1+9-Set. Das
V61-A-Manifest blieb ebenfalls unverändert bei 1.005 Quellblöcken, 364
dynamischen Requirements, 1.210 Komponenten und null `UNRESOLVED`.

Für dieselben neun hashgebundenen B-Dokumente wurde der vollständige
extrahierte Klauselkorpus mit 322 Klauselgrenzen materialisiert. Die
Mehrkanalsuche umfasst 10.890 Komponenten-Dokument-Pakete und 58.010
kompaktisierte Kandidaten. Der Korpus liegt ausschließlich auf dem Mac Studio
unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-BASELINE-20260914-4E44C037/complete-b-corpus.private.json
```

Korpus-Hash:
`28ed0da539dd0f215d0c66ec7c3f0c1d60da1dd8a86802f593d40f152a7f6754`.
Die Existenz dieses vollständigen Extraktionskorpus zertifiziert noch keinen
fachlichen Nullfund.

Der erste Gold-Crosswalk hatte Ergebnisdetails über reine gemeinsame
A-SourceBlock-IDs gemessen. Das war methodisch zu breit: Mehrere fachlich
verschiedene Goldzeilen und dynamische Requirements können denselben Absatz
teilen. Commit `6435c1f14` stellt deshalb auf
`LF_A_DRIVEN_GOLD_283_REGRESSION_V2` um und erlaubt eine Ergebnismessung ohne
weitere semantische Adjudikation nur bei bijektiver Blockzuordnung. Der neue
Befund lautet:

```text
A-Quellabdeckung:              283/283
eindeutig ergebnismessbar:     144
Split-/Merge-mehrdeutig:       139
Rollenkomponenten abgedeckt:   567/631
Rollenlücken:                  64
```

Artefakt:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-BASELINE-20260914-4E44C037/gold-regression-v2.private.json
```

Dateihash:
`567c22bc22c13dce3163e2f90b240ae817675eec4b6f45cc0f957b835bbda05a`;
interner Regressionshash:
`779600811262d1d253fed12c45ae5211c42084bd868ece5a0458eeb1a9004be9`.

Der erste source-bound Requirement-Pilot verwendete Qwen
`qwen/qwen3.6-35b-a3b`, Kontext 42.496, je einen frischen Requirement-Batch
und den Plan `LF_A_DRIVEN_REQUIREMENT_DECISION_PLAN_V2`. 13 Batches wurden
gültig abgeschlossen und bleiben unverändert gespeichert. Batch 12 stoppte
zunächst nach einer formal ungültigen Antwort und zwei harten Timeouts
fail-closed. Die Antwort enthielt dieselben gültigen Candidate-IDs mehrfach.
Commit `b1b32e41e` entfernt ausschließlich solche Wiederholungen vor der
weiterhin strikten Validierung; Rohantwort und Anzahl der entfernten Duplikate
bleiben im privaten Versuchsjournal. Derselbe Batch bestand danach im ersten
neuen Versuch. Commit `9c8fd3aac` verschärft zusätzlich den fachlichen
Rollup: `GEFUNDEN` verlangt nun alle Komponenten des Identitätskerns desselben
fachlichen Elements; ein einzelner passender Kernteil genügt nicht.

Ein zweites Stoppsignal war fachlich-technisch relevanter: Der zusätzliche
Vollkorpus-Rescue wurde bisher pro Komponente und B-Dokument wiederholt. Ein
8-Komponenten-Fall enthielt dadurch 34 vollständige Klauselkandidaten,
78.874 JSON-Zeichen und 45.743 Zeichen reine B-Evidenz; drei Versuche liefen
jeweils in den harten Timeout. Commit `1e66b2c63` ändert keine Quellen- oder
Klauselgrenze, sondern nur die Navigation: Retrieval bleibt pro Komponente,
der ergänzende Vollkorpus-Rescue wird einmal pro Requirement und B-Dokument
gewählt. Ganze Satz-/Klausel-/Listen-/Tabellenkontexte und kombinierte
Mehrquellenbelege bleiben erhalten; es gibt kein Zeichen-Clipping.

Der neue Plan `LF_A_DRIVEN_REQUIREMENT_DECISION_PLAN_V3` enthält 4.488 statt
8.798 ausgewählte Kandidaten. Die maximale Requirement-Größe sank von rund
112.000 auf 55.943 Zeichen; kein Requirement überschreitet 70.000 Zeichen.
Der zuvor dreimal timeoutende Batch sank von 34 auf 15 Kandidaten und bestand
im ersten Versuch nach 80.337 ms. Zusätzlich bestand der größte verbleibende
V3-Batch mit 14 Komponenten und 21 Kandidaten im ersten Versuch nach
107.182 ms. Private Pilotartefakte:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-REQ-PILOT-V3-B14-20260914-1E66B2C6/
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-REQ-PILOT-V3-MAX-B42-20260914-1E66B2C6/
```

Auf Commit `1e66b2c63` bestanden im isolierten Mac-Studio-Worktree
`/private/tmp/lf-reference-a-driven-v2-8da2` drei fokussierte Suites mit
333/333 Tests sowie Syntax und Prettier. Es wurde kein vollständiger
Modelllauf, keine Kunden-XLSX, kein Deployment und keine Releasefreigabe
ausgeführt.

Nächster verbindlicher Schritt: den V3-Requirement-Entscheidungspfad mit der
vollständigen, partitionierten B-Abwesenheitsprüfung verbinden. Ein
`FALLBACK_REQUIRED` darf erst dann zu `NICHT GEFUNDEN` werden, wenn jede
hashgebundene B-Klausel des betreffenden Requirements terminal geprüft wurde.
Danach folgen der dynamische Ergebnisbuilder, ein kontrollierter V3-Lauf und
die ehrliche Messung ausschließlich der eindeutig zuordenbaren Goldzeilen;
mehrdeutige Crosswalk-Fälle bleiben sichtbar statt als Treffer oder Fehler
gerechnet zu werden.

Status: `A DYNAMISCH VOLLSTÄNDIG; B-RETRIEVAL VOLLSTÄNDIG; REQUIREMENT-PILOT
KONTEXTFEST AUF ZWEI WORST-CASE-BATCHES BESTANDEN; QUALIFIZIERTER NULLFUND,
PRODUKTINTEGRATION, XLSX UND VOLLSTÄNDIGER 1+9-LAUF NOCH OFFEN; KEIN
DEPLOYMENT`.

### 133.40 Erster vollständiger dynamischer Nullfund über 322/322 B-Klauseln

Der bisherige Requirement-Entscheidungsvertrag konnte positive Gegenstücke
source-bound bestätigen, durfte einen `FALLBACK_REQUIRED`-Fall aber nicht als
`NICHT GEFUNDEN` ausgeben. Die Commits `2fc9cb944`, `ec404ff4b` und
`9da74b176` ergänzen deshalb einen getrennten, hashgebundenen
Vollkorpusvertrag. Er plant ausschließlich für ungelöste Requirements jede
extrahierte B-Klausel genau einmal ein, teilt nur an vollständigen
Klauselgrenzen und bleibt bei fehlenden oder ungültigen Partitionsantworten
fail-closed. Erst wenn jede Partition terminal negativ ist, wird
`customerStatus=NOT_FOUND` mit `absenceCertified=true` zulässig. Ein
positiver Kandidat führt dagegen nur zu `COUNTERPART_REVIEW_REQUIRED` und
nicht automatisch zu `FOUND`.

Der erste reale Pilot deckte eine dynamische Fallback-Anforderung gegen alle
neun B-Dokumente und alle 322 Klauseln ab. Der Plan bestand aus 13
vollständigen Partitionen. Ein anfängliches technisches Stoppsignal wurde
korrekt fail-closed behandelt: Qwen lieferte deterministisch ein einzelnes
negatives JSON-Objekt, der Parser erwartete trotz Einzelelementvertrag noch
ein JSON-Array. Keine dieser Antworten wurde als PASS oder fachlicher
Nullfund gespeichert. Commit `322854aad`, formatiert in `ddbea6f43`,
normalisiert genau eine Objektantwort und weiterhin auch ein Array mit genau
einem Objekt; leere Arrays, mehrere Objekte und fehlende Antworten bleiben
ungültig. Promptvertrag V3 verlangt nun explizit genau ein JSON-Objekt.

Danach bestand dieselbe erste Partition im ersten neuen Versuch. Der Lauf
wurde an der sicheren Artefaktgrenze fortgesetzt und schloss 13/13
Partitionen mit 13 gültigen Modellversuchen, null Timeouts und null
ungültigen neuen Antworten ab. Damit ist genau diese eine Anforderung nach
Prüfung von 9/9 Dokumenten und 322/322 Klauseln als `NICHT GEFUNDEN`
zertifiziert. Das ist ein technischer und empirischer Vollkorpusnachweis für
diesen extrahierten B-Korpus, keine mathematische 100-Prozent- oder
Generalisierungsbehauptung.

Private Artefakte auf dem Mac Studio:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-ABSENCE-PILOT-B19-20260914-9DA74B17/absence-plan.private.json
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-ABSENCE-PILOT-B19-20260914-9DA74B17/absence-decisions.private.json
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-ABSENCE-PILOT-B19-20260914-9DA74B17/summary.private.json
```

Interner Plan-Hash:
`1e70b5ad494c4d44f2cac9a1ade026ac8dd63714fc71e5e8ffe9cfbaa0c48ad3`;
interner Entscheidungshash:
`cb64a29983a45ed684a716cc4790fe8a69c4d2f2585a7962f9263635ce9f6c7a`;
Dateihash der Entscheidung:
`633575a98c6501ef08d7eb066cf28fce00e95225fcb1d049410bf1d745cd4596`.
Der letzte Resume-Abschnitt mit zwölf neuen Partitionen dauerte 360.239 ms.

Auf Commit `ddbea6f43` bestanden im isolierten Mac-Studio-Worktree zwei
fokussierte Suites mit 330/330 Tests sowie Syntax und Prettier. Alte
Fehlversuche und alle zuvor gültigen Requirement-Batches blieben unverändert
erhalten. Es gab keinen Produkt- oder Reviewer-Vollauf, keine Kunden-XLSX,
kein Deployment und keine Releasefreigabe.

Nächster Schritt: den resumierbaren V3-Requirement-Lauf ab der ersten
fehlenden Batchgrenze fortsetzen, anschließend alle real verbleibenden
Fallback-Requirements mit diesem Vollkorpusvertrag abschließen und erst dann
den binären dynamischen Ergebnisbuilder sowie den Produktworker integrieren.

Status: `ERSTER VOLLSTÄNDIGER NULLFUND 13/13 PARTITIONEN, 322/322 KLAUSELN UND
9/9 DOKUMENTE PASS; VOLLSTÄNDIGER 364ER-ENTSCHEIDUNGSSTAND,
PRODUKTINTEGRATION, XLSX UND DYNAMISCHER 1+9-ENDLAUF NOCH OFFEN; KEIN
DEPLOYMENT`.

### 133.41 Vollkorpus-Rescue und finaler binärer 364er-Requirement-Stand

Der vollständige Abwesenheitslauf wurde bis 495/495 Partitionen fortgesetzt.
Alle 45 Fallback-Requirements wurden damit gegen neun Dokumente und 322
extrahierte B-Klauseln geprüft. Das Ergebnis enthielt 28 direkte terminale
Nullfunde und 17 Fälle mit insgesamt 24 positiven Klauselkandidaten. Diese 17
Fälle wurden anschließend mit dem unveränderten Requirement-Identitätsvertrag
jeweils in einem eigenen, vollständigen Kontext nachgeprüft. Gold-Labels oder
Legacy-Zeilen waren kein Modelleingang.

Der Rescue-Lauf verwendete Qwen `qwen/qwen3.6-35b-a3b`, Kontext 42.496 und
Parallelität 1. Alle 17 Batches bestanden; 21 Modellversuche enthielten vier
begrenzte Validierungs-Retries, null Timeouts und null persistierte ungültige
PASS-Antworten. Elf Fälle sind echte Gegenstücke, sechs blieben nach Prüfung
der positiven Kandidaten negativ. Neun der elf bestätigten Treffer verwenden
mindestens eine neue, erst durch die vollständige B-Korpusprüfung gefundene
Quelle. Damit ist ein realer Suchqualitätsgewinn gegenüber der kompakten
Erstnavigation belegt.

Private Rescue-Artefakte auf dem Mac Studio:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-RESCUE-17-20260914-1DEF62FD/decision-plan.private.json
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-RESCUE-17-20260914-1DEF62FD/requirement-decisions.private.json
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-RESCUE-17-20260914-1DEF62FD/checkpoint.private.json
```

Interner Rescue-Plan-Hash:
`5ad61695013b1c091ea0200e1160a320964e25fa913f8306c9606c8078bdaaa5`;
interner Rescue-Entscheidungshash:
`e5848576383d70f30877fb32ddfabe189f927bbde9f2a6286d943c5d3bc1b826`;
Dateihash der Rescue-Entscheidung:
`630a52612723da8fb85c3834115648c250047b81393fec1db3e9e720b231efb8`.

Commit `36ab0e29d` ergänzt anschließend einen allgemeinen, hashgebundenen
Finalvertrag. Er übernimmt 319 bereits source-bound bestätigte Ersttreffer,
28 direkte Vollkorpus-Nullfunde, elf Rescue-Treffer und sechs erst nach
Rescue zulässige Nullfunde. Plan-, Entscheidungs- und Quellenlinien werden
erneut semantisch validiert; ein bloß neu berechneter Hash über manipulierte
abgeleitete Stati genügt nicht. Das finale Ergebnis lautet:

```text
dynamische A-Requirements:       364/364 terminal
GEFUNDEN:                        330
NICHT GEFUNDEN:                   34
UNRESOLVED:                        0
B-only-Zeilen:                     0
```

Finales privates Artefakt:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-RESCUE-17-20260914-1DEF62FD/final-requirement-decisions.private.json
```

Interner Final-Hash:
`8c615a783bdb15d6017ebbf0815db0cccc538078f113414de25561962f9bddfe`;
Dateihash:
`fc0703c4571d3088286b0210779ffd62730744287db75fdbe8fbfacacd134667`.
Die erneute Materialisierung mit denselben Inputs ergab exakt dieselben Werte
und Hashes.

Auf dem exakten Commit `36ab0e29d6abf90376cafa974bae8dc9363f9c62`
bestanden im isolierten Mac-Studio-Worktree Syntax, Prettier und 314/314
fokussierte Tests. Qwen blieb danach idle geladen; kein Modellrunner war
aktiv. Es gab keinen Produkt- oder Reviewer-Neulauf, keine Kunden-XLSX, kein
Deployment und keine Releasefreigabe.

Die Verteilung 330/34 gehört zum dynamischen Universum von 364 A-Requirements
und ist nicht direkt mit Gold-283 beziehungsweise dessen 273/10-Verteilung
vergleichbar. Gold bleibt eine getrennte QA-Regression für das bekannte
1+9-Set und kein Produktionsschema. Nächster Schritt ist die Integration des
finalen Requirement-Vertrags in den A-geordneten Ergebnisbuilder, den Worker
und die interne XLSX; erst danach folgt ein echter dynamischer Produktlauf und
die sichtbare Split-/Merge-bewusste Goldmessung.

Status: `SUCH- UND ENTSCHEIDUNGSPFAD 364/364 BINÄR ABGESCHLOSSEN; 11 ECHTE
VOLLKORPUS-RESCUE-TREFFER; PRODUKTINTEGRATION, INTERNE XLSX, DYNAMISCHER
1+9-PRODUKTLAUF UND GOLD-REGRESSION NOCH OFFEN; KEIN DEPLOYMENT`.

### 133.42 A-geordnete Ergebnisprojektion und interne Review-XLSX

Die Commits `7d307c660`, `1e01a29dc`, `7bd528b9e`, `cc1b30097`,
`19140e991` und `f3d42d9fa` projizieren den finalen 364er-Requirement-Stand
in einen A-geordneten binären Ergebnisvertrag und eine interne
Review-Arbeitsmappe. Der neue Builder arbeitet ausschließlich aus dem
hashgebundenen dynamischen Manifest und den bereits validierten finalen
Entscheidungen; er fügt keine B-only-Zeilen hinzu und verwendet Gold weder
als Zeilenschema noch als Modelleingang.

Das Ergebnis bleibt:

```text
dynamische A-Ergebniszeilen:      364
GEFUNDEN:                         330
NICHT GEFUNDEN:                    34
UNRESOLVED:                         0
B-only-Zeilen:                      0
Vergleich FULL:                    232
Vergleich PARTIAL:                  96
Vergleich CONTRADICTED:              2
Vergleich NO_COUNTERPART:           34
```

Privates Ergebnisartefakt:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-RESCUE-17-20260914-1DEF62FD/binary-reference-result-v2.private.json
```

Interner Ergebnishash:
`20fb73d940f7c317444ebecfeb75af3a48bcdb2a1038db2a7015606388d92282`;
Dateihash:
`b2c7641bdd4656ed211649b468e55e1104e9a887fa27968a43e96e364124200f`.

Die interne Review-Arbeitsmappe enthält genau ein Blatt, 364 Datenzeilen,
keine Formeln und getrennte A-/B-Inhalte, Quellen, Werte, Abweichungen,
binären Fundstatus und Vergleichsart. Die letzte gelb markierte Spalte
`Fachliche Bewertung (manuell)` bleibt absichtlich leer. Der Writer ist
fail-closed und unveränderlich: Eine bereits vorhandene Datei wird nicht
überschrieben, sondern vollständig gegen das gebundene Ergebnis validiert.

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-RESCUE-17-20260914-1DEF62FD/LF-IMMO-A-Driven-V2-Interne-Pruefung-2026-09-14.xlsx
```

Dateihash:
`32461c5383c6d254cb0e9157d04baa3d99c2d912c19f0ba2abae59cb1209fc6f`.
Eine zweite Materialisierung auf dem exakten Commit
`f3d42d9fa6195cba92bd1ccfa50eddfe663d6599` validierte die vorhandene
Datei und lieferte denselben Hash. Quick Look erzeugte auf dem Mac Studio
headless eine Vorschau mit 1.352 x 1.800 Pixeln; weder Arbeitsmappe noch
Vorschau wurden auf den MacBook übertragen.

Auf demselben exakten Commit bestanden Syntax, Prettier und 314/314
fokussierte Vertragstests. Vor der Fortsetzung wurde Qwen
`qwen/qwen3.6-35b-a3b` mit Kontext 42.496 und Parallelität 1 geladen und als
`idle` mit leerer Warteschlange bestätigt. Es gab keinen neuen
Reviewer-/Gold-Vollauf, kein Deployment und keine Releasefreigabe.

Nächster verbindlicher Schritt: den vorhandenen V2-Vertrag ohne neue
Nebenarchitektur in einen kontrollierten Shadow-Produktlauf integrieren,
anschließend das echte dynamische 1+9-Ergebnis gegen die eindeutig
zuordenbaren Goldzeilen messen. Gold-283 bleibt Regressionsevidenz und darf
die dynamischen A-Zeilen weder erzeugen noch verändern.

Status: `A-GEORDNETE BINÄRPROJEKTION UND INTERNE XLSX PASS; 364/364 ZEILEN
TERMINAL; SHADOW-PRODUKTINTEGRATION, ECHTER DYNAMISCHER 1+9-LAUF UND
GOLD-REGRESSION NOCH OFFEN; KEIN DEPLOYMENT`.

### 133.43 V2-Produktprojektion und erste ehrliche Gold-283-Ergebnismessung

Vor der Fortsetzung wurde auf dem freigegebenen Mac Studio Qwen
`qwen/qwen3.6-35b-a3b` mit dem Modellschlüssel
`qwen3.6-35b-a3b-mlx-text`, Kontext 42.496 und Parallelität 1 geladen. LM
Studio meldete vor und nach den Prüfungen `idle` und eine leere Warteschlange.

Die Commits `0b6a5e878`, `a13d43bf3` und `14639ef9a` ergänzen eine eng
abgegrenzte Produktprojektion des bestehenden V2-Vertrags. Sie erzeugt keine
neuen fachlichen Entscheidungen, sondern validiert die gesamte bereits
gespeicherte A-/B-Entscheidungslinie, ordnet die 364 Zeilen dynamisch nach A
und übersetzt sie in die bestehende API-/Kundenpresenter-Form. Der neue
Profilvertrag erlaubt ein oder mehrere A-Dokumente, verlangt die vollständige
B-Paketsuche, kennt ausschließlich binäre Kundenstati und erklärt Gold
ausdrücklich nicht zur Produktionszeilenquelle.

Der erste reale 1+9-Shadow verwendete ausschließlich die vorhandenen,
hashgebundenen V2-Artefakte und erzeugte ohne Modellaufruf:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-PRODUCT-SHADOW-20260914-14639EF9/comparison.private.json
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-PRODUCT-SHADOW-20260914-14639EF9/comparison.customer.private.json
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-PRODUCT-SHADOW-20260914-14639EF9/summary.private.json
```

Ergebnis:

```text
A-Dokumente:                       1
B-Dokumente:                       9
dynamische A-Zeilen:             364
GEFUNDEN:                         330
NICHT GEFUNDEN:                    34
UNRESOLVED:                         0
B-only-Zeilen:                      0
Gold als Produktionseingang:     nein
Kunden-XLSX erzeugt:             nein
Deployment:                      nein
```

Interner Produkt-Result-Hash:
`532a6fb85c175895c587eaf63d07c3ce2cc1f01f8bcc7b21bdeabce787db29f2`;
Dateihash privates Produktresultat:
`3f658fa64b2c8194715c185b3c7293c99aa1f18e6b0ac2d1c4a04f9310b62d02`;
Dateihash Customer-Presenter-Readview:
`8a0a2bb0143c78603bbfef207ccd7aaf6649c300bb0355595421d44bf5ba41b6`.
Eine zweite Materialisierung mit identischem Laufvertrag verwendete die
Dateien unverändert und ergab dieselben Hashes. Alle drei Dateien besitzen
Modus `0600`.

Die Commits `7252ce213`, `23587837e` und `7c3030165` erweitern danach nur die
QA-Goldmessung für den requirement-basierten V6-Binärvertrag. Gold bleibt
unverändert hashgeprüft:

```text
Gold intern:  d9475c0e8145b5f326ae54ffaab58e5b2c2d154521837452993fc72712257179
Gold-Datei:   9ed4ab6ba3dbd896de48ecf94e6874881391600ef2cc027afae5af5d21123a55
```

Erste Ergebnismessung:

```text
Gold-A-Quellen abgedeckt:        283/283
eindeutig ergebnismessbar:       144
Split-/Merge-mehrdeutig:         139
binäre Übereinstimmungen:      134/144
binäre Abweichungen:             10
False Positives:                   1
False Negatives:                   9
Gold-Quellen textgebunden:        24/374
gleiches B-Dokument:             133/374
gleiches B-Dokument und Seite:   111/374
```

Das versionierte Diagnoseartefakt liegt unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-PRODUCT-SHADOW-20260914-14639EF9/gold-regression-v3.private.json
```

Interner Regressionshash:
`92a95998d547d2fff564eb499187b4ce952ac30f762c8bcfa8614e0eb875cebe`;
Dateihash:
`9214fc7b1f61d0d6b698c8f21b12fc203fddc1892e95990322ad767cdd8c6127`.
Die Datei-/Seitenmetrik ist nur Diagnose und lockert `BOUND` nicht. Die
niedrige Textbindung darf weder als 350 fachliche Fehler noch als PASS
interpretiert werden: In 111 Fällen liegt eine gewählte V2-Evidenz im selben
Dokument auf derselben Seite wie die Gold-Quelle, aber mit einem anderen
Span. Diese Fälle benötigen eine quellengebundene Bewertung statt einer
automatischen Gleichsetzung.

Auf dem exakten Commit `7c3030165de5be64d468be579f7a0bea17ae8276`
bestanden Syntax, Prettier und 315/315 fokussierte Tests. Die zehn eindeutig
messbaren binären Abweichungen sind der nächste fachliche Block. Eine
detaillierte private Provenienz-/Quellenprüfung wurde nicht ausgeführt, weil
die frühere Freigabe auf exakt 76 IDs begrenzt war und deren maschinenlesbare
Liste nicht an diesen Lauf gebunden ist. Ohne ausdrückliche Freigabe wird der
Prüfumfang nicht erweitert.

Status: `ECHTER 1+9-V2-PRODUKT-SHADOW UND API-PROJEKTION PASS; GOLDMESSUNG
134/144 EINDEUTIGE ZEILEN KORREKT, 10 ABWEICHUNGEN OFFEN; DETAILPRÜFUNG DIESER
10 IDs FREIGABEPFLICHTIG; KEINE KUNDEN-XLSX, KEIN DEPLOYMENT`.

### 133.44 Atomare V2-Produktartefakte und bestehende Exportkette

Die Commits `802ef731c`, `aa23df3cc`, `d3eb777c9`, `fa2219b03` und
`a45d70bdb` binden den neuen A-getriebenen Produktresultatvertrag an die
bereits vorhandene atomare Artifact-Set-, Reader-, Export- und gespeicherte
Downloadgrenze. Das Ergebnis wird vor Ausgabe gegen seine dynamische
A-Topologie, binäre 364er-Entscheidungslinie, Dokumentseiten, Evidenz und den
eigenen SHA-256-Digest validiert. Der bestehende Exportvertrag akzeptiert den
neuen Schema-1-Vertrag nur zusammen mit seiner exakten Vertragskennung;
historische LF-Schemata 2 und 3 bleiben unverändert lesbar. Ein neues
V2-Ergebnis kann nicht durch Entfernen des Manifests in den schwächeren
Legacy-Zugriff zurückfallen.

Aus dem bereits abgeschlossenen 1+9-Entscheidungsstand wurde ohne Modellaufruf
ein neuer Standard-Artefaktsatz erzeugt und unmittelbar ein zweites Mal als
unverändertes Resume validiert:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-PRODUCT-ARTIFACTSET-20260915-A45D70BD/
```

```text
Zeilen:                           364
GEFUNDEN:                         330
NICHT GEFUNDEN:                    34
UNRESOLVED:                         0
B-only-Zeilen:                      0
Artifact-Set-Manifest intern:      88ddaafb7cb5ff8af459d45554c9879c87a7a0dc236df68c2902586b4ea3fc87
comparison.private.json:           3f658fa64b2c8194715c185b3c7293c99aa1f18e6b0ac2d1c4a04f9310b62d02
comparison.md:                     c2a0ca4be1df94fea9395f1d6205d2dd025f069eadd253198943a92e513f5e12
polizzenvergleich.xlsx:            2a38d3cb4c50118c43a487d2887fd23317f009007cbad2c018fdddbe93cff819
```

Alle Dateien besitzen Modus `0600`. Die Arbeitsmappe ist weiterhin die
interne Review-Ausgabe, keine freigegebene Kunden-XLSX. Auf dem exakten Commit
`a45d70bdb7ade7aec75515d24f9bee059683b039` bestanden im isolierten
Mac-Studio-Worktree Syntax, Prettier und 331/331 fokussierte Vertragstests.
Qwen `qwen/qwen3.6-35b-a3b` blieb mit Kontext 42.496 und Parallelität 1
korrekt geladen, `idle` und ohne Warteschlange. Es gab keinen Modellbatch,
keine Worker-Umschaltung und kein Deployment.

Nächster Schritt ist die zusammenhängende Integration von Queue, Modus und
Worker-Orchestrierung. Der frische dynamische Endlauf muss Qwen für die
A-Klassifikation, danach Dinghy exklusiv für Retrieval und anschließend Qwen
erneut exklusiv für die Entscheidungen laden. Gold-283 bleibt dabei ein
getrennter QA-Messwert und erzeugt keine Produktionszeile.

Status: `V2-STANDARD-ARTEFAKTGRENZE PASS; 364/364 ZEILEN BINÄR UND ATOMAR
PUBLIZIERT; WORKER-ROUTING UND FRISCHER DYNAMISCHER 1+9-ENDLAUF NOCH OFFEN;
KEIN DEPLOYMENT`.

### 133.45 Worker-Produktpfad, begrenzter B-Pilot und hashgebundener 1+9-Integrationslauf

Die Commits `1e12e5e78` bis `6b53aa0e4` verbinden den dynamischen
`LF_REFERENCE_A_DRIVEN_V2`-Vertrag mit Queue, Worker, Modellwechseln und der
bestehenden atomaren Ergebnis-/Exportgrenze. Neue LF-Läufe akzeptieren ein bis
neun A-Dokumente. Der Worker extrahiert alle A-/B-Dokumente, bindet den
versionierten Dinghy-Vertrag in die Laufsignatur und ruft den Produkt-Runner
mit seiner eigenen Node-22-Laufzeit auf. Der Produkt-Runner verwendet nach der
terminalen A-Klassifikation deren validiertes semantisches Manifest direkt;
ein zuvor nachgeschalteter, verlustbehafteter zweiter Shadow-Rebuild wurde mit
`6b53aa0e4` entfernt.

Ein erster realer Fortsetzungsversuch auf demselben 1+9-Korpus bestätigte die
vollständige Wiederverwendung von 58/58 A-Batches, 10.890/10.890
Retrievalrankings, 58.010 kompakten Suchkandidaten, neun B-Dokumenten und 322
Klauseln. Die damalige Produktverdrahtung fügte jedoch zwei vollständige
Korpuskandidaten pro Requirement und B-Dokument in den primären Prompt ein.
Der Plan enthielt 7.413 Kandidaten, 178 Batches und durchschnittlich 91.778
JSON-Zeichen pro Batch. Batch 1 bestand erst nach einem harten Timeout von
192.565 ms und einem zweiten Versuch von 138.332 ms. Der Lauf wurde danach
kontrolliert gestoppt; genau ein vollständiger Batch blieb erhalten, Batch 2
blieb resumierbar.

Zwei streng auf je drei neue Batches begrenzte Piloten trennten Batchgröße und
Evidenzmenge:

```text
Korpus-Backstop 2/Dokument, 80.000 Zeichen:
  332 Batches, 3/3 PASS, 0 Timeouts, 377.423 ms gesamt

Korpus-Backstop 1/Dokument, 70.000 Zeichen:
  201 Batches, 3/3 PASS, 0 Timeouts, 312.728 ms gesamt
  4.488 Kandidaten, Zeilen 11.256 bis 55.943 Zeichen
```

Der zweite Wert entspricht dem bereits in Abschnitt 133.39 validierten
V3-Evidenzvertrag. Die vollständige Mehrkanalsuche bleibt unverändert; ein
primärer Korpus-Backstop wird nicht als Nullfundbeweis verwendet. Für
`FALLBACK_REQUIRED` bleibt weiterhin die getrennte vollständige Prüfung aller
322 hashgebundenen B-Klauseln verbindlich. Commit
`03000528e9a405aac847f834085b8151e1a994b2`, formatiert in
`d139eda853976263c03403cb4c87f46f4e83e150`, korrigiert deshalb nur die
Produktdefaults auf einen Korpus-Backstop pro Dokument, höchstens zwei
Requirements und 70.000 Zeichen pro primärem Batch. Derselbe Commit leitet
SIGTERM an das gerade aktive Kind weiter, bevor der EXIT-Trap Modelle und
globale Sperre bereinigt.

Weil dynamisches Manifest, Suchplan, Suchausführung und vollständiger B-Korpus
byte- und hashgleich mit dem bereits abgeschlossenen 364er-V3-Stand waren,
wurden weder die 364 Primärentscheidungen noch die 495 Vollkorpuspartitionen
erneut berechnet. Die bestehende Artefaktkette wurde innerhalb des Mac Studio
kopiert, jeweils gegen ihre Originaldatei verglichen und anschließend durch
alle bestehenden Downstream-Validatoren des Produkt-Runners geprüft. Der neue
private QA-Lauf liegt unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-PRODUCT-REUSE-20260915-D139EDA8/
```

Der integrierte Lauf auf Commit
`d139eda853976263c03403cb4c87f46f4e83e150` bestand und wurde ein zweites Mal
unverändert als Resume validiert:

```text
A-Dokumente:                         1
B-Dokumente:                         9
dynamische A-Requirements:         364
Komponenten:                      1.210
GEFUNDEN:                           330
NICHT GEFUNDEN:                      34
UNRESOLVED:                           0
B-only-Zeilen:                        0
FULL/PARTIAL/CONTRADICTED:     232/96/2
```

Zentrale Hashes:

```text
dynamisches Manifest: 6796617ee1f020bf57cbe7f45ac6fa875d52b5c09006bd66ea1ff2c435bec1e2
finale Entscheidungen: 8c615a783bdb15d6017ebbf0815db0cccc538078f113414de25561962f9bddfe
binäres Ergebnis:       20fb73d940f7c317444ebecfeb75af3a48bcdb2a1038db2a7015606388d92282
comparison.private:     1bb42ef9378552c3963f499c9760cc214dd52ed196da488bbc4dda4625a79384
polizzenvergleich.xlsx: bf0f151c6d880d1954e8f930b5d60ca169c93fbf9c4906995c61ba74e77fba71
```

Die getrennte Gold-283-Messung ist reproduzierbar unverändert: 283/283
A-Quellen abgedeckt, 144 eindeutig messbar, 139 Split-/Merge-mehrdeutig,
134/144 binär übereinstimmend, zehn Abweichungen (ein False Positive, neun
False Negatives). Regressionshash
`92a95998d547d2fff564eb499187b4ce952ac30f762c8bcfa8614e0eb875cebe`,
Dateihash
`9214fc7b1f61d0d6b698c8f21b12fc203fddc1892e95990322ad767cdd8c6127`.
Die zehn privaten Abweichungs-IDs wurden nicht geöffnet oder neu adjudiziert.

Auf dem Mac Studio bestanden Shellsyntax, Prettier und 17/17 fokussierte
Runner-/Worker-Vertragstests. Ein realer SIGTERM-Test gegen den validierenden
Resume-Lauf endete mit Status 130, null aktiven Kindprozessen, freigegebener
globaler Modellsperre und Qwen `qwen/qwen3.6-35b-a3b` weiterhin `idle`, Kontext
42.496, Parallelität 1 und Queue 0.

Der anschließend verbreiterte Policy-Comparison-Testlauf deckte einen
veralteten UI-Vertragstest auf, der noch das verworfene feste
„283 Zeilen/13 Kategorien“-Schema verlangte. Commit
`001743eed3b66e4767cdcaecee374f332d3cbd85` richtet ausschließlich diesen Test
am bereits implementierten dynamischen A-Vertrag aus. Auf genau diesem Commit
bestanden im neuen isolierten Mac-Studio-Worktree Shellsyntax, Prettier und
32/32 Suites mit 716/716 Tests; der Endpoint-Test verwendete ein isoliertes
temporäres `STORAGE_DIR`.

Der erzeugte XLSX ist ein privates QA-/Review-Artefakt, keine freigegebene
Kunden-XLSX. Der Lauf beweist die integrierte, resumierbare Produktgrenze und
reproduziert den bekannten 1+9-Stand; wegen der hashgebundenen Wiederverwendung
ist er kein vollständig neu berechneter Modell-Endlauf, kein Holdout- oder
Generalisierungsnachweis und keine Deploymentfreigabe.

Status: `LF_REFERENCE_A_DRIVEN_V2 WORKER-/RUNNER-INTEGRATION PASS;
HASHGEBUNDENER 1+9-PRODUKTLAUF 364/364 TERMINAL UND RESUMIERBAR; SUCHQUALITÄT
GEGEN GOLD UNVERÄNDERT 134/144 AUF EINDEUTIGEN MAPPINGS; 139 CROSSWALK-FÄLLE
NICHT BINÄR MESSBAR; KEIN DEPLOYMENT`.

### 133.46 Frischer V62-Lauf: mehrblockige Listenprovenienz und Vertragsupgrade

Der frische 1+9-Lauf
`LF-A-DRIVEN-V2-FRESH-1PLUS9-20260915-001743EE` stoppte nach zehn
vollständigen Batches an einer Listen-Unit. Qwen erkannte deren zwei
fachlichen Segmente und die richtigen Komponenten, band bei einer langen
Klausel aber drei reine `BODY_LINE`-Fortsetzungsblöcke nicht an die kurzen
wörtlichen Gefahr-/Schadensanker. Fünf weitere Modellzyklen reproduzierten
denselben Fehler timeout- und abortfrei. Transport, Modellladung und
Retry-Scheduler waren damit nicht die Ursache.

Commit `0b2054a9132911b6ac20af429cb860f74a4b76af` ergänzt ausschließlich bei
strukturell eindeutigen `LIST_ITEM_WITH_CONTINUATIONS`-Segmenten die
Quellenblockspanne zwischen geordneten, wörtlich im Segment vorhandenen
Komponentenankern. Labels, Komponententypen, Coverage-Wirkung und Anzahl der
Komponenten bleiben unverändert. Fehlt ein erster Anker oder ist die Struktur
mehrdeutig, bleibt die Unit fail-closed. Der echte Batch 11 wurde dadurch aus
dem unveränderten Attemptjournal 6/6 valide; ein neuer Modellaufruf war nicht
nötig.

Die Anhebung des dynamischen Manifestvertrags von V13 auf V14 deckte danach
eine getrennte Resume-Lücke im deterministischen A-Plan-Builder auf. Commit
`866416d0550c1c6140a4cec394cf9eb9045e31d8` erlaubt ausschließlich ein
digestgültiges V13-Platzhaltermanifest, dessen gesamter Payload bis auf
Vertragskennung und Selbsthash exakt dem neu berechneten V14-Payload
entspricht. Manifest und gebundene Summary werden vor der V14-Materialisierung
versioniert unter `a-plan/superseded/` erhalten. Jede fachliche oder
strukturelle Planabweichung stoppt weiterhin mit Resume-Mismatch.

Mac-Studio-Nachweise auf dem exakten finalen Commit:

```text
Syntax und Prettier:                    PASS
fokussierte A-/Runner-Vertragstests:    324/324 PASS
angrenzende Policy-Comparison-Suites:   32/32 Suites, 722/722 Tests PASS
alter V13-Manifesthash:                 f6527b3ecbe75ae25e121774aa03a2e155db2d0f4ae2780b2d90333433751931
neuer V14-Manifesthash:                 9b28c37e5637fe407668f280fdfdef4a78f364cee7d540b7c25ff65ad3112d5f
Batch 11:                               V62, 6/6 journalisiert, PASS
Batch 12:                               drei timeoutfreie Aufrufe, 6/6, PASS
A-Klassifikation:                       58/58 Batches PASS
dynamische Requirements/Komponenten:   363/1.274
ungeklärte Units/Review-Blöcke:         0/0
aus V61 source-identisch übernommen:    267 Units
Dinghy-Retrieval:                       9 Dokumente, 322 Klauseln,
                                        1.274 Queries, 11.466 Rankings PASS
Qwen-B-Entscheidungen:                  4/204 Batches PASS, aktiv
```

Der Produkt-Runner arbeitet auf dem Mac Studio seriell weiter. Nach 58/58
A-Batches wurde Qwen vollständig entladen, Dinghy exklusiv geladen, die
Mehrkanalsuche terminalisiert, Dinghy wieder entladen und Qwen mit Kontext
42.496/Parallelität 1 exakt wiederhergestellt. Die verbleibenden A-Units wurden
nicht unnötig neu berechnet: Der vollständige V61-Integritätssnapshot bestand
den existierenden Seedvertrag mit 376/376 source-identischen Units und allen
58 hashgebundenen Batches; 267 Antworten wurden tatsächlich übernommen.

Das V14-A-Manifest besitzt Hash
`e6965f3121b763a59c5f2c48553fd37e45bca4a51edea9b5b8e8a3b2c0330483`.
Der neue Suchplan enthält 363 Requirements, 1.274 Komponenten, 4.511
selektierte Kandidaten und 204 Qwen-Batches. Die ersten vier Batches bestanden
timeout- und abortfrei; Batch 4 benötigte zwei semantische Versuche. Es gibt
weiterhin kein
Deployment und keine freigegebene Kunden-XLSX. Dieser Zwischenstand belegt
die terminale A- und Retrievalphase, aber noch keinen vollständigen
1+9-Endlauf, Holdout oder Generalisierung.

Status: `V62-LISTENPROVENIENZ UND V13→V14-RESUME REAL PASS; A 58/58 UND
DINGHY-RETRIEVAL TERMINAL; QWEN-B-ENTSCHEIDUNGEN 4/204 AKTIV; KEIN
DEPLOYMENT`.

### 133.47 Adaptiver, resume-sicherer Timeout-Split für B-Requirements

Der frische Lauf stoppte später kontrolliert an Planbatch 38. Dieser Batch
enthielt zwei fachlich unabhängige Requirements, 14 Komponenten, 24
Kandidaten und 66.984 serialisierte Zeichen. Alle drei zulässigen
Gruppenrequests endeten nach der harten Grenze von 180 Sekunden ohne
Modellantwort. Jeder Request wurde abgebrochen, vollständig gesettelt und
Qwen vor dem nächsten Versuch als exakt `qwen/qwen3.6-35b-a3b` mit Kontext
42.496 sicher neu geladen. Es gab weder eine Teilantwort noch ein
Batch-PASS-Artefakt; 37 Vorgängerbatches blieben gültig.

Commit `c87aadf9d483d72ddce0bc67aacd529c19b54788` übernimmt für den
Requirement-Runner das bereits im A-Klassifikationspfad bewährte allgemeine
Schedulerprinzip. Nach einem sicher abgewickelten Timeout eines
Mehr-Requirement-Requests wird deterministisch genau ein ausstehendes
Requirement angefragt. Retrybudgets gelten pro Requirement. Terminale
Einzelantworten werden einzeln gegen ihre vollständigen Komponenten und
Kandidaten validiert, im Speicher zusammengeführt und erst nach erneuter
Validierung des unveränderten Originalbatches als PASS persistiert. Unsafe
Recovery, ausgeschöpfte Budgets und unvollständige Merges bleiben
fail-closed. Attemptjournale sind weiterhin append-only.

Ein gebundenes, sicheres Gruppen-Timeoutjournal setzt beim Resume die
Startstrategie auf ein Einzel-Requirement. Es gilt nicht als semantische
Antwort und verbraucht im neuen, geänderten Resume-Zyklus kein
Einzel-Requirement-Budget. Ungültige oder nicht vollständig gebundene
Journale beeinflussen diese Strategie nicht.

Mac-Studio-Nachweise auf dem exakten Commit:

```text
isolierter Worktree:                    /private/tmp/lf-reference-a-driven-v2-c87aad
Syntax und Prettier:                    PASS
fokussierter A-driven-Vertragstest:     321/321 PASS
breite Policy-Regression:               102/102 Suites, 1.981/1.981 PASS
alte PASS-Batches wiederverwendet:      37/37
Batch 38, Requirement 1:                88.914 ms, terminal
Batch 38, Requirement 2:                47.588 ms, terminal
Batch 38 gesamt:                        2/2, null Diagnosen, PASS
neuer Gruppenrequest beim Resume:       0
Checkpoint:                             38/204, Resume ab Batch 39
```

Die Änderung erhöht weder den Request-Timeout noch verkleinert sie jeden
Batch pauschal. Kleine Gruppen bleiben für die Laufzeitoptimierung erlaubt;
nur ein real sicher gesettelter Timeout löst die adaptive Verkleinerung aus.
Sie verändert weder Retrieval, Kandidaten, Quellen, fachlichen Prompt noch
Gold-283. Der restliche Primär-B-Lauf wurde nach bestandenem Ein-Batch-Gate
ab Batch 39 fortgesetzt.

Status: `B-TIMEOUT-SPLIT SYNTHETISCH UND REAL PASS; BATCH 38 TERMINAL;
PRIMÄR-B AB 39 AKTIV; KEIN DEPLOYMENT`.

### 133.48 Kanonisches Capability-Inventar und Workflow-Wiederverwendungsindex

Change-Set `CAPABILITY-INVENTORY-20260915-001` konsolidiert die bisher über
Produktvertrag, KB, Architektur, Entscheidungen, Tests, Tracker und Quellcode
verteilte Methodenwahrheit. Die Arbeit ist als `ADAPT_EXISTING` klassifiziert:
Es entsteht keine zweite Knowledge Base und keine neue Produktarchitektur.

Neu vorbereitet sind:

```text
docs/POLIZZENVERGLEICH_CAPABILITY_INVENTAR_V1.json
docs/POLIZZENVERGLEICH_WORKFLOW_MAPS_DE.md
server/scripts/qa/validateCapabilityInventory.cjs
server/__tests__/scripts/qa/validateCapabilityInventory.test.js
```

Das Inventar trennt Reife-/Erkenntnisstatus von Aktivierungsstatus, bindet
fachlich relevante Modulgrenzen an Implementierungsdateien, öffentliche
Einstiegspunkte, tatsächliche Caller, Inputs/Outputs, Seiteneffekte,
Abhängigkeiten, Qualitäts-/Ressourcenwirkung, Risiken, Tests, Runs, ADR-/FAIL-
Evidenz, letzten verifizierten Commit und Reaktivierungskriterien. Zwei
Workflow-Maps beschreiben den tatsächlich verdrahteten
`LF_REFERENCE_A_DRIVEN_V2`-Pfad und den vollständigen symmetrischen A/B-Pfad.

Der statische Validator prüft Dateipfade, Einstiegspunktsymbole,
Callerbindungen, referenzierte Tests, Vertrags-IDs, stabile Capability-IDs,
Statuswerte, Relationen und Workflowknoten. `ACTIVE_*` ohne nachweisbaren
Caller ist fail-closed ungültig.

Der 204-Batch-Befund lautet vorläufig: Die primären Entscheidungen bleiben für
den bereits hashgebunden gestarteten V62-Lauf unverändert notwendig. Suchplan,
BM25, Synonyme, Struktur, Dinghy, Kandidatenunion, Kompaktierung, Quellen- und
PASS-Prüfung sind bereits deterministisch. Nicht deterministisch ersetzt ist
die fachliche Identitätskernentscheidung bei abweichendem Wortlaut. Ein
späterer gemeinsamer A/B-Retrievalkern ist `EXTRACT_SHARED_CORE`, aber weder
Voraussetzung noch zulässiger Ersatz für den laufenden 204er-Vertrag.

Mac-Studio-Validierung auf dem exakten, sauberen Commit
`4fb2aec73429b712deb04c82642b69d007c9031d` im isolierten Worktree
`/private/tmp/capability-inventory-4d5d76144` mit Node `v22.23.2`:

```text
Inventarvalidator:                         PASS
Capabilities:                             25
Workflow-Maps:                             2
Vertragsbindungen:                        20
fail-closed Negativfälle:                3/3 PASS
ACTIVE_PRODUCTION / ACTIVE_SHADOW / QA:  9 / 13 / 1
Inventar SHA-256: 1f623b7c2ee0110b5121223ef7e800849373ba1694f97ff6f1f2974a7ee6a215
Workflow SHA-256: 3f5c48394605a0f2db2b2d8ab545915b563197cc56902a8cbb7a35cf36c131f0
```

Der erste Validatorlauf fand eine ungenaue Resume-Callerbeschreibung. Commit
`4fb2aec73` korrigiert sie auf den tatsächlich im Runner vorhandenen
fail-closed Batchvertrag; die Wiederholung bestand. Ein Jest-Vertragstest ist
zusätzlich eingecheckt. Da im isolierten Worktree keine Jest-Dev-Abhängigkeit
vorlag, wurden die drei zentralen Negativfälle direkt mit der Node-22-Runtime
ausgeführt; es wurde keine Abhängigkeit nachinstalliert.

Der bereits zuvor autorisierte, isolierte V62-B-Lauf wurde durch diese
Konsolidierung weder neu gestartet noch verändert. Kein zusätzlicher
Modelllauf, kein Produkt-Routing und kein Deployment.

### 133.49 Vollständiger V62-Endlauf und partielle Identitätskernregel

Der frische Lauf
`LF-A-DRIVEN-V2-FRESH-1PLUS9-20260915-001743EE` wurde unter dem dynamischen
V14-A-Manifest vollständig abgeschlossen. Die Primärprüfung endete mit
204/204 PASS-Batches. Die anschließende Vollkorpus-Abwesenheitsprüfung
terminalisierte 330/330 Partitionen; 176 davon wurden über den exakten,
hashgebundenen Seedvertrag übernommen, die übrigen 154 waren bereits im
aktuellen Lauf berechnet. Der Rescue-Plan umfasste neun Requirements und
bestand 9/9 Batches. Daraus entstand zunächst ein vollständig validiertes
privates Ergebnis mit 363/363 terminalen Zeilen, 337 `FOUND`, 26 `NOT_FOUND`
und null `UNRESOLVED`.

Die getrennte Gold-283-Regression zeigte auf den 144 eindeutig zuordenbaren
Gold-Zeilen 134 Übereinstimmungen, zwei False Positives und acht False
Negatives. Eine source-bound Prüfung der zehn Abweichungen belegte einen
allgemeinen Aggregationsfehler: Bei passendem fachlichem Kontext verlangte die
Primärentscheidung bisher, dass jede als Identitätskern typisierte Komponente
positiv ist. Dadurch wurden Zeilen trotz belegtem Teilgegenstück als
Fallback/Abwesenheit behandelt. Das widerspricht der bestätigten Fachregel,
dass ein quellengebundenes Gegenstück zum selben fachlichen Element
`GEFUNDEN` ist und fehlende Teile, Bedingungen, Werte oder Limits getrennt als
Abweichung erscheinen.

Commit `237cb785a` ändert ausschließlich diese Aggregation von `every` auf
`some`; Kontextbindung und mindestens ein positiver Identitätskern bleiben
Pflicht. Eine rein deterministische Vorabmessung auf allen vorhandenen 363
Modellantworten änderte fünf Zeilen. Auf den 144 eindeutigen Gold-Mappings
verbesserte sie 134/144 auf 137/144, reduzierte False Negatives von acht auf
fünf und erzeugte kein zusätzliches False Positive. Eine pauschale Begrenzung
der Evidenzanzahl wurde ausdrücklich verworfen: 161/363 legitime Fundzeilen
besitzen mehr als acht zusammengeführte B-Fundstellen, sodass ein solcher
Grenzwert echte Treffer beschädigen würde.

Mac-Studio-Nachweise auf dem exakten Commit im isolierten Worktree
`/private/tmp/lf-partial-core-237cb785a`:

```text
Syntax und Prettier:                    PASS
fokussierter A-driven-Vertragstest:     321/321 PASS
Primärantworten:                        204/204 Batches wiederverwendet
neue Primärverteilung:                  338 FOUND / 25 Fallback / 0 unresolved
Vollkorpusprüfung:                      275/275 Partitionen wiederverwendet
neue Modellaufrufe Abwesenheit:         0
Rescue:                                 6/6 Batches, 9 Versuche, PASS
finale dynamische Zeilen:               363/363 terminal
FOUND / NOT_FOUND / UNRESOLVED:         343 / 20 / 0
FULL / PARTIAL / CONTRADICTED / NO:     240 / 102 / 1 / 20
```

Die revidierte private Artefaktkette liegt unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-FRESH-1PLUS9-20260915-001743EE/a-driven-v2-revision-237cb785a/
```

Zentrale Hashes:

```text
Primärentscheidung:     e9f2d0e1a71e67ebc6a3e763648ddcbb016b5172e5a972c850b974580dedf558
Abwesenheitsplan:       bad0af5f084a639ba8226040a605dd3f3683aa48e94ea4ad908cefa940f44035
Abwesenheitsentscheidung: b02050b35574d7bd38078dd8afa69db260ebe026e07b864676b902094c5bbd66
Rescue-Entscheidung:    1105861e2a3e47d7eb2633c42c92bfea57d3a962a9ba464360bb9e87b83b89e6
finale Entscheidung:    3521d363e9663ccf7da398254ec6cb26d2970bafc0e3f46679985a8602a01eaf
binäres Ergebnis:       e1f7770833a9a2ea0451064db3a61d3de8200cb987d82238f034eb868b8ebed5
comparison.private:     344ba569500411666ccaf3808cf199aa98f1fc97f8e95f07cab56e4f45b12659
polizzenvergleich.xlsx: ab46c15a451196f4ebffe467bb64f35b7ed840ae1bd98e757ed9af4e1fba6ee3
```

Die erneute Produktmaterialisierung und eine zweite unveränderte
Artefakt-/XLSX-Validierung bestanden. Gold-283 blieb unverändert und war kein
Produktionseingang. Der Crosswalk deckt 283/283 Legacy-Anforderungen ab; 144
sind bijektiv messbar, 139 bleiben wegen echter Split-/Merge-Zuordnungen
nicht ohne semantische Adjudikation zeilenbinär messbar. Auf den 144
eindeutigen Fällen verbleiben sieben Abweichungen: zwei False Positives
(`HP-24`, `AV-30`) und fünf False Negatives (`VS-14`, `VS-15`, `ST-18`,
`AV-06`, `AV-22`). Die revidierte Regression besitzt Hash
`4fc7047788ce44f57318d4bef77d00fb32432f0f0f14280a34e24e0bb547777f`.

Der XLSX ist weiterhin ein internes QA-/Review-Artefakt. Es erfolgte weder
Kundendeployment noch Releasefreigabe. Der bekannte 1+9-Lauf belegt eine
reale Qualitätsverbesserung dieses Fixtures, aber keinen Holdout- oder
99-Prozent-Generalisierungsnachweis.

Status: `LF_REFERENCE_A_DRIVEN_V2 V62 363/363 TERMINAL; 343 FOUND / 20
NOT_FOUND; GOLD EINDEUTIG 137/144; 7 BELEGTE QUALITÄTSABWEICHUNGEN VERBLEIBEN;
INTERNE XLSX VALID; KEIN DEPLOYMENT`.

### 133.50 Gezielte Fehlerzerlegung vor dem nächsten vollständigen V2-Lauf

Die sieben eindeutigen Gold-Abweichungen aus Abschnitt 133.49 wurden nicht
blind durch weitere Volläufe bearbeitet, sondern an den bereits gespeicherten
A-Komponenten, B-Kandidaten und Modellantworten getrennt untersucht.

Die Primärprompt-Präzisierung V2 beseitigte `HP-24`, ließ `AV-30` aber
unverändert falsch positiv. Eine noch engere Promptvariante V3 änderte
`AV-30` ebenfalls nicht und wurde vollständig revertiert. Die
Vollkorpus-Abwesenheitsprüfung V4 hob `ST-18` zu
`COUNTERPART_REVIEW_REQUIRED`, weil die EABS-Schadenminderungsklausel ein
fachlich relevantes Gegenstück enthält. Eine weitere Parent-/Subtype-Regel
V5 änderte `VS-14` und `VS-15` nicht und wurde ebenfalls revertiert.
`AV-06` und `AV-22` sind nach erneuter Originalquellenprüfung keine belegten
System-Fehlnegativen: Bestklausel und Günstigkeitsklausel sind nicht dasselbe;
die Erlaubnis eigener Mitarbeiter belegt keine Erstattung ihrer Lohn- oder
Gemeinkosten. Beide Fälle bleiben deshalb Gold-Korrekturvorschläge, ohne das
eingefrorene Gold-283 zu überschreiben.

Die A-Klassifikation wurde anschließend aus den unveränderten, hashgleichen
58/58 PASS-Batches ohne Modellaufruf neu materialisiert. Commit `b7d6e4ed6`
trennt ausschließlich selbstständig suchbare koordinierte `OBJECT`-Nomen und
bewahrt elliptische Komposita wie „Heizungs- und Klimaanlagen“. Betroffen
sind vier Requirements; die Requirementzahl bleibt 363, die
Komponentenzahl steigt von 1.274 auf 1.278, `UNRESOLVED` bleibt null.
Seedquelle und Batches wurden bytegleich verifiziert. Das neue Manifest liegt
unter:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-A-DRIVEN-V2-FRESH-1PLUS9-20260915-001743EE/a-driven-v2-a-atomization-c48fc1588/a-classification/
```

Manifest-SHA-256:
`bb87772549a77522147b059b7cb51a003881706cef9250c39da582b091e10050`.
Die fokussierte Mac-Studio-Suite bestand auf dem exakten Commit
`c48fc1588` mit 329/329 Tests.

Der erste Zielbatch zeigte danach: Die korrekte Atomisierung allein genügt
nicht, weil die AW03-Quelle „überdachte Abstellplätze“ für das A-Kompositum
„Autoabstellplätze“ nicht in den begrenzten Kandidatensatz gelangte. Commit
`c370428e5` ergänzt deshalb eine konservative, rein navigierende
Kompositum-Erweiterung. Sie gilt nur für `OBJECT`, nur für großgeschriebene
deutsche A-Nomen, nur vom längeren A-Kompositum zum mindestens zehn Zeichen
langen B-Nomenkopf, bei mindestens 70 Prozent Wortlängenanteil und
korpusweiter Seltenheit. Sie besitzt ausdrücklich keine semantische
Entscheidungsautorität.

Die 11.502/11.502 vorhandenen Dinghy-Rankings wurden hashgebunden und ohne
Modellaufruf wiederverwendet. Die endgültige Retrieval-Matrix verändert nur
16/11.502 Pakete und 15/363 Requirements; die Kandidatenzahl ändert sich von
60.681 auf 60.682 und die Batchzahl bleibt 204. Artefaktpfad und Hash:

```text
.../a-driven-v2-a-atomization-c48fc1588/b-retrieval-compound-v2/
retrievalSha256: 2c568929d4d0470671a2b4fca693460586aefae9db32b8752eef1eeb1e1f5608
executionSha256: e089565436b0834fa17d49a8b3c5bce16d8d7e2209b9ce7a2c066504fa1385de
```

Der einzelne VS-14/15-Zielbatch bestand auf Anhieb. `VS-14` besitzt nun für
die Komponente `Autoabstellplätze` ein source-bound `MATCH` gegen AW03,
Seite 10; `Tiefgaragen` bleibt nicht etabliert. Nach der bestätigten
Teilkernregel ist die dynamische Zeile damit `FOUND / PARTIAL_COUNTERPART`.
`VS-15` bleibt unverändert negativ. Batchartefakt-SHA-256:
`20c54ac80e1794710a928902b6fc33b9522e84a4e03e9c53a401f1da1503db3a`.

`AV-30` war ein anderer Fehlertyp: Qwen setzte eine fehlende Anzeigepflicht
bei Betriebsverlegung einer fehlenden Obliegenheitsverletzung bei temporärer
Abweichung von Sicherheitsvorschriften gleich. Commit `476177d97` ergänzt
für positive administrative `FACT_ROLE`-Entscheidungen einen eng begrenzten
source-bound Anzeige-/Meldepflichtanker. Belegte Synonyme werden akzeptiert;
ohne einen solchen Begriff in den ausgewählten Originalquellen wird nur auf
`FALLBACK_REQUIRED` zurückgestuft, niemals direkt auf `NOT_FOUND`.
Die rein deterministische Nevalidierung des gespeicherten AV-30-Responses
weist exakt die falsche FACT_ROLE-Komponente zurück.

Mac-Studio-Nachweise auf Commit `476177d97` im isolierten Worktree
`/private/tmp/lf-fact-role-guard-476177d97`:

```text
Prettier:                                      PASS
A-driven Mutation + Reference Contracts:      351/351 PASS
Qwen: qwen/qwen3.6-35b-a3b, Kontext 42.496, Parallelität 1, IDLE
```

Der vollständige 204-Batch-Primärlauf wurde auf dieser Basis gestartet. Der
bereits bestandene Batch 12 wird unverändert wiederverwendet. Abwesenheit,
Rescue, binäres Ergebnis, Gold-Regression und interne XLSX folgen erst nach
204/204 PASS. Kein Deployment und keine Kundenfreigabe.

Status: `A 363/363 REQUIREMENTS, 1.278 COMPONENTS, 0 UNRESOLVED; RETRIEVAL
11.502/11.502; VS-14 TARGET PASS; AV-30 GUARD PASS; PRIMÄRER 204-BATCH-LAUF
LÄUFT; KEIN DEPLOYMENT`.

### 133.51 Fail-closed Batch 50 und schemafeste Reparatur

Der Primärlauf stoppte nach 49/204 gültigen Batches korrekt fail-closed an
Batch 50. Es lag kein Timeout und kein Modelltransportfehler vor. Qwen lieferte
bei deterministisch identischen Aufrufen zunächst ungültiges JSON und danach
Komponenten mit falscher Dimension beziehungsweise nicht zugelassener
Kandidaten-ID. Zwei unveränderte Laufzyklen erzeugten dieselben Antwort-Hashes;
weitere blinde Wiederholungen wurden deshalb beendet. Alle 49 PASS-Batches und
ihre privaten Append-only-Attempts blieben unverändert erhalten.

Change-Set `LF-V2-REPAIR-SCHEMA-20260915-001` klassifiziert die Korrektur als
`ADAPT_EXISTING` von `CAP-B-006`. Commit `5bc7aacdba008c10de69a7bf669c4cf92721fd7e`
präzisiert ausschließlich den bereits vorhandenen semantischen
Einzel-Requirement-Reparaturhinweis: Für beanstandete Antworten werden das
vollständige serverseitige Komponenten-ID-/Dimensionsschema, die exakte
Kandidatenliste und der konservative `NOT_ESTABLISHED`-Fallback wiederholt.
Basisprompt, Validator, Entscheidungsplan und bestehende PASS-Batch-Identität
bleiben unverändert; es gibt keine automatische semantische Korrektur.

Auf dem exakten Mac-Studio-Commit im isolierten Worktree
`/private/tmp/lf-repair-5bc7aacdb` bestanden der gezielte Vertragstest und
Prettier. Das anschließende Realbatch-Gate bestand mit einem auf vier weiterhin
begrenzten Versuchskontingent. Die vorher falschen Komponenten wurden
schema- und ID-konform repariert; Batch 50 wurde als PASS gespeichert. Der
vollständige Lauf wurde danach gestartet und verwendet 50/204 Batches wieder.

Status: `BATCH 50 ROOT-CAUSE REPAIR PASS; 50/204 WIEDERVERWENDET; PRIMÄRLAUF
AB BATCH 51 LÄUFT; KEIN DEPLOYMENT`.

### 133.52 Batch 117: gebundene Modifier-Abweichung ohne Verlust des Gegenstücks

Der nach Batch 50 fortgesetzte Primärlauf erreichte 116/204 unveränderliche
PASS-Batches und stoppte anschließend an Batch 117 fail-closed. Transport,
Timeout und Modellzustand waren gesund. Acht gespeicherte Versuche nannten
denselben servergebundenen B-Kandidaten, positiven Kontext und dasselbe
fachliche Gegenstück. Qwen verwendete für die breite
Identitätskernkomponente dennoch wiederholt
`COUNTERPART_WITH_DIFFERENCE`, obwohl die genannten Unterschiede
ausschließlich Wert, Berechnungsbasis oder Bedingung betrafen und separat in
`unmodeledDifferences` gebunden waren. Der V1-Validator verbietet diesen
Outcome auf einer Identitätskerndimension ohne weitere Absicherung.

Change-Set `LF-V2-CORE-MODIFIER-NORMALIZATION-20260916-001` adaptiert deshalb
den bestehenden Runner aus `CAP-B-006`. Vor der unveränderten strikten
V1-Validierung wird ein solcher Kernstatus nur dann zu `MATCH` normalisiert,
wenn:

- der Requirement-Kontext selbst `MATCH` ist;
- jede verwendete Kandidaten-ID bereits servergebunden und auch im
  Kontextfund enthalten ist;
- jede Kandidaten-ID durch mindestens eine ausdrückliche
  `unmodeledDifference` belegt ist;
- diese Unterschiede ausschließlich Scope, Bedingung, Wert, Limit,
  Selbstbehalt oder zeitliche Geltung betreffen;
- keine Kerndifferenz für dieselben Kandidaten behauptet wird.

Ohne diese Voraussetzungen bleibt die Antwort unverändert ungültig. Rohtext
und alle acht alten Attempts bleiben append-only erhalten. Bestehende
PASS-Batches, Manifest, Retrieval und Entscheidungsplan ändern sich nicht.

Mac-Studio-Nachweise auf dem exakten Commit
`7800b11a5bb1db199b78a507898281f3370fd902` im isolierten Worktree
`/private/tmp/lf-core-modifier-197481fc6` mit Node `v22.23.2`:

```text
Prettier:                                         PASS
gezielte Positiv-/Negativ-/Resume-Tests:          4/4 PASS
vollständige A-driven-Vertragssuite:              334/334 PASS
Batch 117 aus vorhandenem Journal:                PASS
neue Modellaufrufe für Batch 117:                 0
unverändert wiederverwendete Vorgänger:            116/116
Resume-Start:                                      Batch 118
Modell:                                            qwen/qwen3.6-35b-a3b
Kontext:                                           42.496
```

Eine zusätzliche read-only Prüfung des aktuellen A-Manifests mit dem bereits
vorhandenen heuristischen Atomizitätsaudit meldete 138 Risiken in 85 Units.
Sie beweisen nicht 138 fachliche Fehler, zeigen aber, dass die frühere Aussage
„A fertig“ nur Block-/Responsevollständigkeit und nicht vollständig geprüfte
fachliche Atomizität meinte. Außerdem ist dieses vorhandene Audit im
vollständigen Produktkommando derzeit nicht vor der B-Phase verdrahtet. Dieser
Befund bleibt als separates Produktintegritätsproblem offen und darf bei einer
späteren Produktionsfreigabe nicht verschwiegen werden; er rechtfertigt aber
keinen Verlust der bereits source-bound geprüften B-Arbeit.

Der restliche Primärlauf wurde SSH-unabhängig ab Batch 118 fortgesetzt. Kein
Deployment und keine Kundenfreigabe.

Status: `117/204 PRIMÄRBATCHES PASS; RESUME AB 118 AKTIV; 0 NEUE
MODELLAUFRUFE FÜR BATCH 117; A-ATOMIZITÄTSGATE-VERDRAHTUNG OFFEN; KEIN
DEPLOYMENT`.

### 133.53 Batch 120: derselbe Kernvertrag in positivem Differenzkontext

Der Resume-Lauf bestand Batch 118 und 119 und stoppte an Batch 120 erneut
fail-closed. Die strukturelle, inhaltsminimierte Diagnose der vier privaten
Attempts zeigte keinen neuen fachlichen Fehlertyp: Kontext und breite
OBJECT-Kernkomponente waren jeweils
`COUNTERPART_WITH_DIFFERENCE`, dieselbe servergebundene Kandidaten-ID war
vorhanden und die einzigen ausgewiesenen Abweichungen betrafen `SCOPE` sowie
teilweise `CONDITION`. Eine zweite Requirement-Antwort desselben Batches war
bereits gültig journalisiert.

Commit `938ab782948b2c44ac4d846122cc0797a706a43e` präzisiert deshalb dieselbe
allgemeine Regel aus `INT-20260916-038`: Als positiver Kontext ist neben
`MATCH` auch `COUNTERPART_WITH_DIFFERENCE` zulässig. Alle übrigen Schranken
bleiben unverändert. Insbesondere wird `RELATED_ONLY` ausdrücklich nicht
normalisiert; fehlende Modifier-Evidenz oder eine OBJECT-/Peril-/Rollen-
Kerndifferenz bleiben fail-closed. Es entstand keine neue Architektur und der
Entscheidungsplan blieb hashidentisch.

Mac-Studio-Nachweise auf exakt diesem Commit im isolierten Worktree
`/private/tmp/lf-core-modifier-197481fc6`:

```text
Prettier:                                         PASS
gezielte Positiv-/Negativ-/Resume-Tests:          5/5 PASS
vollständige A-driven-Vertragssuite:              335/335 PASS
Batch 120 aus vorhandenem Journal:                PASS
neue Modellaufrufe für Batch 120:                 0
journalisiert übernommene Requirements:            2/2
vorhandene Batch-Artefakte:                        120/204
Resume-Start:                                      Batch 121
Modell:                                            qwen/qwen3.6-35b-a3b
Kontext:                                           42.496
```

Der Primärlauf läuft seitdem SSH-unabhängig mit PID `19915` weiter und
verwendet Batch 1 bis 120 unverändert wieder. Kein Deployment und keine
Kundenfreigabe.

Status: `120/204 PRIMÄRBATCHES PASS; RESUME AB 121 AKTIV; 0 NEUE
MODELLAUFRUFE FÜR BATCH 120; KEIN DEPLOYMENT`.

### 133.54 Primäre B-Gegenstückprüfung 204/204 abgeschlossen

Der auf Commit `938ab782948b2c44ac4d846122cc0797a706a43e` fortgesetzte
Primärlauf wurde vollständig abgeschlossen. Batch 1 bis 120 wurden
unverändert wiederverwendet; Batch 121 bis 204 wurden danach ohne weiteren
fail-closed Stopp terminalisiert. Es wurde weder A neu klassifiziert noch der
Retrievalplan verändert.

```text
Primärbatches:                                  204/204 PASS
Requirements:                                  363/363 terminal
vorläufig FOUND / FALLBACK_REQUIRED:            311 / 52
UNRESOLVED:                                           0
Modellversuche gesamt:                              228
gemessene Resume-Wandzeit:                    5.997.300 ms
Entscheidungsplan-Dateihash:
7dd62f6c98ae37be5c5dfdd51dd083553fa93263bebac1d052d22b69791385c0
Primärentscheidungs-Dateihash:
aa86199088250863ae5b3d47044f4e1ab31ef35d7a1f82e73e0eacc7f5bcaf45
Responses-Dateihash:
2401089571ccbb68bd577f3066e4d913c97a75526be1bf14638ac653ad2cd945
Summary-Dateihash:
6eeb2280ccf3ae3ead2262ffac442288c69f09bd44cfe7e4dd7660a61f94b22c
```

Die 52 vorläufig negativen Requirements sind noch keine fachlichen
`NOT_FOUND`-Entscheidungen. Der unveränderte Vollkorpusvertrag erzeugte dafür
einen hashgebundenen Plan mit 572 Partitionen über alle 322 B-Klauseln.
`LF_A_DRIVEN_REQUIREMENT_ABSENCE_PROMPT_V4` läuft unter demselben Qwen-Modell
mit Kontext 42.496 weiter. Nur ein vollständig kompatibler V4-Seed mit 22
Partitionen ist zulässig; ältere vollständige Abwesenheitsläufe besitzen
einen anderen Promptvertrag und werden bewusst nicht als aktueller Beweis
umetikettiert.

```text
Abwesenheitsplan: 52 Requirements, 572 Partitionen, 322 Klauseln
Plan-SHA-256: 5ec82b5cf50b38adc6c75975afddf41ba5698f2127479794bd5d3379efd52643
Complete-B-Corpus-SHA-256:
28ed0da539dd0f215d0c66ec7c3f0c1d60da1dd8a86802f593d40f152a7f6754
```

Status: `PRIMÄR-B 204/204 PASS; 311 FOUND, 52 FALLBACK_REQUIRED;
VOLLKORPUS-ABWESENHEIT 572 PARTITIONEN AKTIV; KEIN DEPLOYMENT`.

### 133.55 Koordinierte Gefahren atomisiert und dynamischer 1+9-Lauf binär abgeschlossen

Der vollständige Abwesenheitslauf aus Abschnitt 133.54 endete mit 572/572
terminalen Partitionen, 43 Nullfund-Kandidaten, neun Rescue-Fällen und null
ungeklärten Partitionen. Im anschließenden Rescue wiederholte Qwen für die
source-bound A-Komponente „Bruch-, Frost-, Verstopfungs- und
Korrosionsschäden“ dreimal denselben fachlich plausiblen Teilfund: Bruch war
in B belegt, die übrigen Gefahren nicht. Der strikte Validator lehnte die
Antwort zu Recht ab, weil A diese vier Gefahren noch als einen unteilbaren
`PERIL_OR_CAUSE`-Identitätskern führte. Das war ein A-Atomisierungsfehler und
kein Grund, den B-Validator abzuschwächen.

Change-Set `LF-V2-COORDINATED-PERIL-ATOMIZATION-20260916-001` adaptiert
deshalb `CAP-A-004`. Die source-bound Normalisierung trennt ausschließlich
eindeutig koordinierte Gefahrennomen und elliptische Formen. Alternativen,
Schutz-Komposita und abhängige Phrasen bleiben unverändert. Die sichtbare
A-Zeile, Reihenfolge und Quellenbindung werden nicht umgeschrieben. Commits:

```text
b6cf6efe6  Atomize coordinated peril components
40bb22387  Format coordinated peril atomization
51b522ce9  Handle singular peril nouns
```

Mac-Studio-Gate auf `51b522ce93b732bf7811c16d836c4ff8c3b61299`:

```text
Node:                                      v22.23.2
Prettier:                                  PASS
gezielte Positiv-/Negativvarianten:        6/6 PASS
vollständige A-driven-Vertragssuite:       341/341 PASS
A-Rematerialisierung:                      58/58 PASS, 0 Modellaufrufe
Manifest:                                  363 Requirements, 1.282 Komponenten
UNRESOLVED:                                0
Manifest-Datei-SHA-256:
55b521e0b831af10b43d8752bc0d9bf6974958352eb8df20c52c8370e2ef250
```

Nur zwei Requirements änderten ihre Identität. Die erste Gefahrenliste wurde
in vier statt eine Kernkomponente zerlegt; „Schwamm- und
Vermorschungsschäden“ wurde ebenfalls quellwörtlich in zwei Gefahren
materialisiert. Alle übrigen 361 Requirements blieben einschließlich ihrer
B-Kandidaten byteidentisch.

Change-Set `LF-V2-B-DECISION-SEED-REVALIDATION-20260916-001` adaptiert
`CAP-B-006` und `CAP-CACHE-001`. Ein vollständiger Seed-Lauf wird nur bei
gültiger Plan-, Entscheidungs-, Prompt-, Validator-, Modell- und
Kontextbindung akzeptiert. Danach wird jede Antwort ausschließlich für eine
byteidentische aktuelle Planzeile übernommen und nochmals gegen den aktuellen
Einzelzeilenvertrag validiert. Geänderte Zeilen werden nicht übernommen.
Commits `724d41636` und `fbdfdb7ee411ac801e2cd09b93c9f323d39f1b33`.

Mac-Studio-Gate auf exakt `fbdfdb7ee411ac801e2cd09b93c9f323d39f1b33`:

```text
Syntax / Prettier:                         PASS / PASS
vollständige A-driven-Vertragssuite:       344/344 PASS
Primärbatches:                             204/204 PASS
Requirements:                              363/363 terminal
Seed-Revalidierung:                        361 übernommen, 2 neu geprüft
vollständig gesäte Batches:                202
neue Modellversuche:                       2
Wandzeit Primärresume:                     87.781 ms
FOUND / FALLBACK_REQUIRED / UNRESOLVED:    312 / 51 / 0
Entscheidungs-SHA-256:
0d2aceb3e4e19189bdba34d42a98aebc15bf69bbf52ff77dbd5acd515379e467
```

Die neue Vollkorpusprüfung übernahm 561/561 aktuelle Partitionen nach
Revalidierung und benötigte null Modellaufrufe. Sie endete nach 111 ms mit 43
Nullfund-Kandidaten und acht Rescue-Fällen. Der neue Rescue umfasste exakt
acht Requirements; sechs wurden als Gegenstück bestätigt, zwei nach
Vollkorpusprüfung als Abwesenheit abgeschlossen. Die acht Rescue-Batches
benötigten elf Modellversuche und 350.122 ms.

Das finale binäre Ergebnis ist technisch vollständig:

```text
Requirements / Zeilen:                    363
GEFUNDEN / NICHT GEFUNDEN / UNKLAR:       318 / 45 / 0
FULL / PARTIAL / CONTRADICTED / NONE:      198 / 116 / 4 / 45
Side-B-only-Zeilen:                        0
Final-Decision-SHA-256:
47b37f924570edc0489eec1c8f22d58a6bf13aabf3c563a86eb140b26737dd89
Binary-Result-SHA-256:
19225ef1324b31cb07845fa07b0d790d58f17e83e4bb06efe5b7b288d4cac31e
Binary-Datei-SHA-256:
09d3cdd4646f72bf072e3dc9f34dd4292ef36c9dd051dafd5ffe9c488f3f0719
```

Die unveränderte Gold-283-Regression deckt 283/283 Legacy-Anforderungen,
aber nur 563/631 Legacy-Komponentenrollen ab. 144 Gold-Zeilen sind wegen
eindeutiger Quellenzuordnung binär messbar: 137 stimmen, sieben sind falsch,
davon null False Positives und sieben False Negatives. 139 Zeilen bleiben
wegen Split-/Merge-Quellenkontext nicht binär messbar. Gegenüber dem letzten
vergleichbaren Revisionsartefakt bleiben die 137 Treffer gleich; zwei False
Positives verschwinden, dafür steigen False Negatives von fünf auf sieben.
Die Änderung ist deshalb ein belegter Root-Cause-Fix, aber kein Nettoanstieg
der Gold-Trefferzahl und kein Generalisierungs- oder 99-Prozent-Nachweis.

```text
Gold intern / Datei:
d9475c0e8145b5f326ae54ffaab58e5b2c2d154521837452993fc72712257179
9ed4ab6ba3dbd896de48ecf94e6874881391600ef2cc027afae5af5d21123a55
Gold-Regression-Datei-SHA-256:
194d67c69398cb2b7cd3e095b0822cbb9d2a97d713e745714c78fe8a1b6665c7
```

Die interne Review-XLSX wurde read-only erneut geöffnet und auf 363
eindeutige IDs, fortlaufende Nummern, 318/45 Statuswerte, Fehlerzellen,
Filter und Freeze-Panes geprüft. Alle Prüfungen bestanden; die manuelle
Bewertungsspalte ist leer.

```text
.../a-driven-v2-a-atomization-c48fc1588/
LF-1PLUS9-A-DRIVEN-V2-INTERNAL-REVIEW-fbdfdb7ee.xlsx
XLSX-SHA-256:
630b1a2c46619c5dcafaa464bd51a61e74daa828af9422ca9702f9c4bf66c483
```

Offen bleiben die fachliche Analyse der sieben eindeutig messbaren
False-Negatives, die 68 nicht rollengedeckten Legacy-Komponenten, ein kalter
End-to-End-Laufzeitnachweis und die Generalisierungs-Gates auf ungesehenen
Versicherern. Es gibt weiterhin kein Deployment und keine Kundenfreigabe.

Status: `DYNAMISCHER 1+9-LAUF 363/363 BINÄR ABGESCHLOSSEN; 318 GEFUNDEN,
45 NICHT GEFUNDEN, 0 UNKLAR; GOLD 137/144 MESSBAR RICHTIG; 7 FALSE NEGATIVES
UND 68 LEGACY-ROLLENLÜCKEN OFFEN; INTERNE XLSX PASS; KEIN DEPLOYMENT`.

### 133.56 Semantische B-Konflikte abgeschlossen und Ergebnis ohne Vollneuberechnung verbessert

Die nach Abschnitt 133.55 noch offenen eindeutigen Gold-Abweichungen wurden
an den bereits gespeicherten Primär-, Vollkorpus- und Rescue-Artefakten
zerlegt. Die richtige B-Quelle war in mehreren Fällen bereits vorhanden; der
Fehler lag in formal gültigen, aber dem Produktvertrag widersprechenden
Negativantworten. Ein ausdrücklich abweichender Umfang oder Ausschluss des
gleichen fachlichen Elements bleibt ein Gegenstück und muss seine Abweichung
separat ausweisen.

Die Commits `49b1b9ef6`, `529a1d544`, `727cd13b6`, `4b55d5fb8`,
`5bf6c17c0`, `799c99cc6`, `224b7ae1e`, `5c0b0cb1f`, `880622ac9` und
`ac3ce5631` adaptieren dafür ausschließlich `CAP-B-006` und `CAP-B-007`:

- eine erfundene Rescue-ID wird nur bei exakt einem zulässigen `RCR-*`-
  Kandidaten auf diesen eindeutigen Alias normalisiert;
- widersprüchliche Abwesenheitsantworten werden source-bound in den
  bestehenden Komponenten-Rescue geroutet;
- ein vom Modell zitierter ausdrücklicher Ausschluss derselben allgemeinen
  Gefahr wird nur bei genau einem `PERIL_OR_CAUSE`-Identitätskern, vorhandener
  `COVERAGE_EFFECT`-Komponente, expliziter Ausschlusssprache und genau einer
  belegten Gefahrenäquivalenz als `MATCH` plus `OPPOSITE` normalisiert;
- andere Ausschlüsse, mehrere Identitätskerne, bloß verwandte Klauseln und
  fehlende Quellenbindung bleiben fail-closed.

Mac-Studio-Gate auf exakt
`ac3ce5631cd062143f70188c33f5c28baa25f8cb` im isolierten Worktree
`/private/tmp/lf-semantic-ac3ce5631`:

```text
Syntax:                                    PASS
Prettier:                                  PASS
vollständige A-driven-Vertragssuite:       351/351 PASS
Rescue-Requirements/Batches:               15/15 PASS
Seed-Wiederverwendung:                     15/15
neue Modellaufrufe:                        0
Wandzeit Rescue-Rematerialisierung:         24 ms
Rescue-Decision-SHA-256:
240ffdee67c057b25f0c00e2de10c1e1c2bb5c59c2029a449be6899762e42ccb
```

`GL-17` ist jetzt source-bound `FOUND / CONTRADICTED`: Die ausgewählte
Originalklausel schließt innere Unruhen und Aufruhr ausdrücklich aus. Das
belegt dasselbe Gefahrenelement mit gegenteiliger Deckungswirkung, nicht
einen Nullfund. Zusammen mit den bereits gezielt korrigierten Fällen ergibt
sich folgende neue Finalprojektion:

```text
Requirements / Zeilen:                    363
GEFUNDEN / NICHT GEFUNDEN / UNKLAR:       322 / 41 / 0
FULL / PARTIAL / CONTRADICTED / NONE:      199 / 118 / 5 / 41
Side-B-only-Zeilen:                        0
Final-Decision-SHA-256:
5874df559ce0cc88de36339e5102be365295c517d9263aca4b2018b30af2ff34
Binary-Result-SHA-256:
e162790b809f588c28fa5440fc6deace0debd41513d776f7f8728a19ae4547b3
```

Private Artefakte:

```text
.../a-driven-v2-a-atomization-c48fc1588/
  b-rescue-semantic-final-ac3ce5631/
  final-semantic-ac3ce5631/
```

Die unveränderte Gold-283-Regression verbessert sich auf 141/144 eindeutig
messbare binäre Übereinstimmungen, null False Positives und drei False
Negatives. Die drei verbleibenden IDs sind `VS-15`, `AV-06` und `AV-22`.
`AV-06` und `AV-22` sind nach Originalquellenprüfung bereits dokumentierte
Gold-Korrekturvorschläge: Bestklausel und Günstigkeitsklausel sind nicht
dasselbe; die Erlaubnis eigener Mitarbeiter belegt keine Erstattung ihrer
Lohn- oder Gemeinkosten. `VS-15` blieb trotz separater A-Atomisierung und
erweiterter Retrievalprüfung negativ und ist weiterhin nicht als
Systemfehler bewiesen. Deshalb wurde keine zeilenspezifische Regel ergänzt
und Gold-283 nicht überschrieben.

```text
Gold intern / Datei:
d9475c0e8145b5f326ae54ffaab58e5b2c2d154521837452993fc72712257179
9ed4ab6ba3dbd896de48ecf94e6874881391600ef2cc027afae5af5d21123a55
Gold 283/283 Anforderungen / 563/631 Rollen
eindeutig messbar:                         144
binär richtig / falsch:                    141 / 3
False Positives / False Negatives:         0 / 3
Gold-Regressions-Datei-SHA-256:
2dbbf6cbf8a69942d465d9a43a33594494c7c13691cd27812f50f798f784f0fd
```

Die intern erzeugte Review-XLSX wurde im selben Schreibvorgang read-only
zurückgelesen und gegen das vollständige Binärartefakt geprüft: 363 Zeilen,
322/41 Statuswerte, eine Tabelle, keine Formeln, fortlaufende Reihenfolge,
Filter, Freeze-Panes und leere manuelle Bewertungsspalte.

```text
.../final-semantic-ac3ce5631/
LF-1PLUS9-A-DRIVEN-V2-INTERNAL-REVIEW-ac3ce5631.xlsx
XLSX-SHA-256:
70d5ecb6e26b278e01c17f1bfcf85e1e1eccddc6fee2dcb7f59b2282f3194243
```

Dieser Nachweis verbessert das bekannte LF-1+9-Regressionsset. Er ist kein
Holdout-, Generalisierungs- oder 99-Prozent-Nachweis. Es erfolgte kein
Deployment und keine Kunden-XLSX-Freigabe.

Status: `DYNAMISCHER LF-1+9-LAUF 363/363 BINÄR; 322 GEFUNDEN, 41 NICHT
GEFUNDEN, 0 UNKLAR; GOLD 141/144 MESSBAR RICHTIG; DREI GOLD-/CROSSWALK-FÄLLE
OFFEN; INTERNE XLSX PASS; KEIN DEPLOYMENT`.

### 133.57 V3.8.0-Produktaktivierung vorbereitet

Nach ausdrücklicher Kundenfreigabe wird der vollständig verdrahtete
`LF_REFERENCE_A_DRIVEN_V2`-Pfad als kontrollierter Kunden-MVP aktiviert. Es
wird keine neue Vergleichsarchitektur ergänzt: Queue, Worker, dynamische
A-Ermittlung, vollständige B-Prüfung, API, UI und XLSX werden direkt
wiederverwendet (`DIRECT_REUSE`). Angepasst werden ausschließlich bestehende
Release-, Installer- und Betriebsgrenzen (`ADAPT_EXISTING`).

Vor dem Tag und Deployment gelten fail-closed:

- Releaseversion und Doctor müssen V3.8.0 binden;
- `POLICY_A_DRIVEN_EMBEDDING_CONTRACT_FILE` muss absolut, regulär und
  geschützt konfiguriert sein;
- Vertrag, Dinghy-Modell, Dimensionen, Runtime sowie Modell- und
  Runtimeartefakte müssen hashverifiziert werden;
- das Produktartefakt muss sich als Produktlauf und die tatsächlich erzeugte
  Arbeitsmappe korrekt ausweisen;
- vollständige Release-Gates müssen auf dem exakten Release-SHA am Mac Studio
  bestehen;
- der offizielle Updater muss Sicherung, Quieszenz, Aktivierung und Doctor
  erfolgreich abschließen.

Beweisgrenze bleibt unverändert: Der bekannte dynamische 1+9-Nachweis erlaubt
den kontrollierten MVP-Betrieb, aber keine allgemeine 99-Prozent- oder
Holdout-Aussage.

Change-Set: `LF-V2-PRODUCTION-ACTIVATION-20260916-001`.

### 133.65 Releaseübergreifender partieller A-Resume

Der vollständig geprüfte Release V3.8.5 wurde auf dem Kunden-Mac-Studio
installiert. Tag, `origin/main` und der saubere Kunden-Checkout zeigen auf
`b19df17def47e02f3897da36899fbc4393c0ac3c`; Doctor, API, Dienste,
Datenbank-`quick_check` und das neue Backup
`server/storage/backups/anythingllm-before-activation-20260917-141108.db`
bestanden.

Beim anschließenden Start derselben Session 14 entstand wegen der bewusst
releasegebundenen Run-Signatur ein neuer Run-Root. Der produktive Worker
übergab die vorhandenen V3.8.4-Teilresultate jedoch nicht an den
A-Klassifikator. Dadurch begann er neue Versuche für Batch 1. Der Worker wurde
sofort über den offiziellen Cancel-Endpunkt beendet; die Session ist
`CANCELLED`, kein Prozess läuft, und die ursprünglichen Vorgängerartefakte
blieben unverändert. Dieser Fehlstart ist kein fachlicher Fortschritt.

Der allgemeine Fix adaptiert `CAP-ORCH-001`, `CAP-CACHE-001` und
`CAP-A-002`. Der Worker wählt innerhalb derselben Session den
releaseunabhängig identischen Vorgängerlauf mit den meisten vollständigen
Batchartefakten. Gebunden werden Modus, Produktprofil, Dokumenthashes,
Reihenfolge und Rollen, Modell und Kontext sowie Embeddingvertrag. Symlinks
und abweichende Verträge werden ausgeschlossen.

Der Klassifikator liest Vorgänger-Plan, Batches, PASS-Artefakte und
Versuchsjournale ausschließlich read-only. Source- und Batchplan müssen exakt
übereinstimmen. Jede einzelne Antwort wird unter V67/V16/V29 neu validiert;
erst danach wird ein neues revisionsgebundenes Batchartefakt geschrieben.
Der erste Modellaufruf darf nur die erste weiterhin offene Unit betreffen.

Mac-Studio-Nachweise auf dem Implementierungsstand
`1d4dbbc5252fdae20613cec2391ecbeefebaeb5e`:

```text
Fokussierte Suites:                    3/3 PASS
Fokussierte Tests:                     386/386 PASS
Prettier / Produktcode-Lint:           PASS / PASS
Realartefakt-Replay Batches:           5/5 PASS
Aktuell revalidierte Vorgänger-Units:  30
Neue Modellaufrufe:                    0
Vorgänger-Planbaum SHA-256:
19235cdc9200535196b60f459371deec7ec9dd4143f653377c31feedd770ad04
Vorgänger-Klassifikationsbaum SHA-256:
22df1be588cd95e96e208ede445ff8ed89a561b9449a861511da70ad4fae995b
Vorgängerartefakte nach Replay:         hashgleich
```

V3.8.6-Release-Gate, Deployment und derselbe kontrollierte Resume stehen noch
aus. Gold-283-V2 bleibt unverändert; der nicht vorhandene unabhängige
expertengelabelte Mehrversicherer-Holdout bleibt ein separates Gate.

Status: `V3.8.5 INSTALLIERT; FALSCHEN NEUSTART KONTROLLIERT ABGEBROCHEN;
CROSS-RELEASE-RESUME IM REALARTEFAKT-REPLAY 5/5 PASS; V3.8.6-GATE UND RESUME
AUSSTEHEND`.

Change-Set: `LF-V386-CROSS-RELEASE-PARTIAL-A-RESUME-20260917-001`.

### 133.66 Komplementäre Duplicate-Unit-Hüllen in Batch 6

V3.8.6 wurde nach bestandenem Release-Gate mit 212/212 Suites und
3.066/3.066 Tests sowie sämtlichen Lint-, Prisma-, Inventar-, Build- und
Installer-Prüfungen über den offiziellen Updater auf dem Kunden-Mac-Studio
aktiviert. Tag, `origin/main` und der saubere installierte Checkout zeigen auf
`3d4b63fd858a9d4bf84aabb6e228aaa145a1c990`; Doctor, API,
Datenbank-`quick_check` und Backup
`server/storage/backups/anythingllm-before-activation-20260917-143343.db`
bestanden.

Der anschließende Resume der kalten Session 14 bewies den neuen
releaseübergreifenden Pfad: Batch 1 bis 5 wurden ohne neue Modellversuche
materialisiert. In Batch 6 blieben nach zwölf begrenzten semantischen
Versuchen fünf von sechs Units aktuell valide. Nur
`AU-d85b513150561995ba8786bc` blieb offen; der Lauf stoppte korrekt
fail-closed, ohne einen unvollständigen Batch als PASS zu speichern.

Ein zweiter Resume übernahm erneut exakt diese fünf Units. Qwen erzeugte für
die letzte Unit schließlich den quantifizierten Listengovernor und das
untergeordnete versicherte Objekt vollständig source-bound, aber als zwei
Top-Level-Hüllen derselben `unitId`: einmal `LIMIT`, einmal `INSURED_OBJECT`,
jeweils zusammen mit `OPERATIVE_COVERAGE_STATEMENT`. Die bestehende
Duplicate-Normalisierung vereinigte nur Hüllen mit identischen
Terminalklassen. Der Validator meldete deshalb ausschließlich
`DUPLICATE_UNIT_RESPONSE` und stoppte nach drei Versuchen erneut korrekt
fail-closed.

Der allgemeine Fix adaptiert `CAP-A-002` und `CAP-A-003`. Mehrere Hüllen
werden nur dann vereinigt, wenn ihre ID exakt im aktuellen Batch erwartet
wird, sämtliche Klassen operative gültige Terminalklassen sind, jede
Primärklasse im eigenen Klassenarray enthalten ist und jede Hülle ein
Requirements-Array besitzt. Requirements und Klassen werden geordnet
vereinigt; unbekannte IDs, nichtoperative Klassen oder ungültige Hüllen
bleiben unverändert fail-closed. Die bestehende Shared-Governor-
Normalisierung darf zusätzlich den explizit gebundenen äußeren
`governingContext` gemeinsam mit dem internen Governor ausschließlich in die
unmittelbar untergeordneten Item-Requirements verschieben. Die vollständige
Source-, Segment-, Rollen- und Manifestvalidierung bleibt maßgeblich.

Mac-Studio-Nachweise auf dem exakten Implementierungsstand
`3bf929702fd8726313dde47ef2a376c2a2722c5c`:

```text
Fokussierter Vertragslauf:             373/373 PASS
Prettier / Produktcode-Lint:           PASS / PASS
Echter gespeicherter Batch 6:          6/6 Units, PASS
Neue Modellaufrufe im Realartefakt-Test: 0
Nichtmaterialisierte Diagnosen:        0
Attempt-Artefaktbaum SHA-256 vorher/nachher:
1baa74fdbb47819cbfbe5841dbcc21b3b720bfb3d5ca32886995fc7bb713b5ba
Vorgängerartefakte nach Revalidierung:  hashgleich
```

V3.8.7-Release-Gate, Installation und die Fortsetzung ab dem nun
materialisierbaren Batch 6 stehen noch aus. Gold-283-V2 bleibt unverändert;
der bekannte LF-1+9-Lauf bleibt Regression und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Status: `BATCH-6-ROOT-CAUSE ALLGEMEIN BEHOBEN; REALARTEFAKT 6/6 PASS OHNE
MODELLAUFRUF; V3.8.7-GATE, DEPLOYMENT UND PRODUKT-RESUME AUSSTEHEND`.

Change-Set:
`LF-V387-COMPLEMENTARY-DUPLICATE-UNIT-MERGE-20260917-001`.

### 133.67 Alte komponentenförmige Requirements in Batch 10

V3.8.7 wurde nach bestandenem vollständigem Release-Gate über den offiziellen
Updater auf dem Kunden-Mac-Studio aktiviert. Der releaseübergreifende Resume
der kalten Session 14 materialisierte Batch 1 bis 6 ohne neue Modellversuche.
Batch 7 bis 9 bestanden mit den begrenzten produktiven Modellaufrufen. Batch
10 stoppte nach vier Attempts korrekt fail-closed: fünf von sechs Units waren
gültig und resumierbar, die verbleibende Unit wurde nicht als PASS
gespeichert.

Die offene Unit ist eine konditionale Äquivalenzdefinition. Qwen lieferte sie
wiederholt source-bound, aber in einer alten Komponentenform: `type`, `label`
und `sourceBlockIds` lagen direkt auf Requirement-Ebene; `displayLabel` und
das heutige befüllte `components`-Array fehlten. Die vorhandene allgemeine
Normalisierung für „… gilt auch dann als …, wenn …“ konnte deshalb nicht
greifen. Nach dem Heben der Hülle blieb zusätzlich der alte `OBJECT`-Alias
erhalten, obwohl die Antwort selbst `PERIL_OR_DAMAGE` deklarierte.

Der allgemeine V69-Fix adaptiert `CAP-A-002` und `CAP-A-003`. Er hebt nur eine
vollständig alte, ausschließlich eigene Quellen zitierende `CLAUSE`-Antwort
ohne logische Listensegmente. Gemischte Formen, unbekannte Quellen,
zusätzliche Felder, Listen-Units und verschachtelte Komponenten bleiben
fail-closed. Innerhalb einer belegten konditionalen Äquivalenzdefinition wird
`OBJECT` nur dann zu `PERIL_OR_CAUSE`, wenn die vorhandene deklarierte
Semantik `PERIL_OR_DAMAGE` enthält. Ohne Gefahrsemantik bleibt der Objekttyp
unverändert.

Mac-Studio-Nachweise auf dem exakten Implementierungsstand
`91ee0eb833b4b29986ef3e6a68ba1727c1b538b8`:

```text
Gezielte positive/negative Vertragsfälle:  7/7 PASS
Vollständiger fokussierter Vertragslauf:   379/379 PASS
Prettier / Capability-JSON:                PASS / PASS
Echter gespeicherter Batch 10:             6/6 Units, PASS
Neue Modellaufrufe im Realartefakt-Test:   0
Nichtblockierende Diagnose:                LOCAL_SIGNAL_COMPONENT_MATERIALIZED
Attempt-Artefaktbaum SHA-256 vorher/nachher:
aa0856167dff6aa10b6872c1ccffa91cecf52bd187ac8419c03ca8b7e8a7f6a5
Vorgängerartefakte nach Revalidierung:      hashgleich
```

V3.8.8-Release-Gate, Installation und die Fortsetzung ab dem nun
materialisierbaren Batch 10 stehen noch aus. Gold-283-V2 bleibt unverändert;
der bekannte LF-1+9-Lauf bleibt Regression und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Status: `BATCH-10-ROOT-CAUSE ALLGEMEIN BEHOBEN; REALARTEFAKT 6/6 PASS OHNE
MODELLAUFRUF; V3.8.8-GATE, DEPLOYMENT UND PRODUKT-RESUME AUSSTEHEND`.

Change-Set:
`LF-V388-LEGACY-REQUIREMENT-SHAPE-LIFT-20260917-001`.

### 133.68 Kausaler Gefahralias in Batch 14

Der produktive V3.8.8-Resume materialisierte Batch 1 bis 10 ohne neue
Modellaufrufe. Batch 11 bis 13 bestanden mit den begrenzten produktiven
Modellaufrufen. Batch 14 stoppte nach drei Attempts korrekt fail-closed: fünf
von sechs Units waren gültig und resumierbar, die verbleibende Unit wurde
nicht als PASS gespeichert.

Die offene Unit enthält einen Selbstbehalt und einen ausdrücklichen
Gefahrausschluss. Qwen trennte beide Anforderungen korrekt, verwendete für
das source-bound Label „Schäden durch Graffiti“ jedoch den semantischen
Klassennamen `PERIL_OR_DAMAGE` als terminalen Komponententyp. Der gültige
Komponententyp des bestehenden Vertrages ist `PERIL_OR_CAUSE`.

Der allgemeine V70-Fix adaptiert `CAP-A-002` und `CAP-A-003`. Er normalisiert
den Alias nur bei einem wortgetreuen, vollständig eigenen Quellenbeleg und
einer expliziten kausalen Schadensformulierung aus Schaden/Beschädigung plus
„durch“, „infolge“, „aufgrund“ oder „wegen“. Ein bloßer Gefahrenbegriff und
eine nichtkausale Schadensformulierung bleiben fail-closed. Andere Rollen,
Wirkungen, Werte, Scope und Quellen werden nicht verändert.

Mac-Studio-Nachweise auf dem exakten Implementierungsstand
`ae5b8a826e3c08f5b983393bd331f930ac469fac`:

```text
Gezielte positive/negative Vertragsfälle:  6/6 PASS
Vollständiger fokussierter Vertragslauf:   385/385 PASS
Echter gespeicherter Batch 14:             6/6 Units, PASS
Neue Modellaufrufe im Realartefakt-Test:   0
Attempt-Artefaktbaum SHA-256 vorher/nachher:
8356d00040a6d29245ff2537bba736d23e0a353e018b8ce3e6342a963669525c
Vorgängerartefakte nach Revalidierung:      hashgleich
```

Das vollständige Release-Gate auf Commit
`c8260dc4c31585612725088e67fc4826d18cc0d5` bestand 212/212 Suites und
3.080/3.080 Tests sowie Server-, Frontend- und Collector-Lint, Prisma,
Capability-Inventar, Prettier, Frontend-Build und Installer-Suite. Der
annotierte Tag `v3.8.9` und `origin/main` zeigen auf denselben Commit. Der
offizielle Updater aktivierte diesen Stand auf dem Kunden-Mac-Studio; Doctor,
API und Datenbank-`quick_check` bestanden. Das Pre-Activation-Backup liegt
unter:

```text
server/storage/backups/anythingllm-before-activation-20260917-162113.db
```

Der anschließende Resume der Session 14 verwendet den neuen Run-Root
`resume-9c5fa5639e94f45e49f21bbc`. Batches 1 bis 14 wurden dort mit null neuen
Attempt-Dateien materialisiert. Der erste neue Modellversuch betraf wie
verlangt erst Batch 15; der Lauf wird ab dort produktiv fortgesetzt.
Gold-283-V2 bleibt unverändert; der bekannte LF-1+9-Lauf bleibt
Regressionsevidenz und kein unabhängiger Generalisierungs- oder
99-Prozent-Nachweis.

Status: `V3.8.9 PRODUKTIV AKTIV; DOCTOR PASS; BATCHES 1 BIS 14 OHNE NEUE
MODELLARBEIT ÜBERNOMMEN; KALTER PRODUKTLAUF AB BATCH 15 AKTIV`.

Change-Set:
`LF-V389-CAUSAL-PERIL-COMPONENT-ALIAS-20260917-001`.

### 133.69 Ein vollständiges fortgesetztes Listensegment in Batch 17

Der produktive V3.8.9-Resume materialisierte Batch 1 bis 14 ohne neue
Modellarbeit. Batch 15 und 16 bestanden. Batch 17 stoppte nach neun Attempts
korrekt fail-closed: fünf von sechs Units waren gültig und resumierbar, die
verbleibende Unit wurde nicht als PASS gespeichert.

Die offene Unit ist fachlich genau ein Listenpunkt, dessen Inhalt über zwei
physische Blöcke fortgesetzt wird. Der Source-Plan besitzt dafür exakt ein
`LIST_ITEM_WITH_CONTINUATIONS`, dessen geordnete Blockfolge mit der gesamten
Unit übereinstimmt. Qwen lieferte in drei Versuchen dieselben drei
quellengebundenen Komponenten für Rolle, Wert und Wirkung, aber in der alten
Requirement-Hülle. Der bisherige V69-Vertrag sperrte jede `LIST`-Unit
pauschal, um echte Mehrpunktlisten nicht versehentlich zusammenzuziehen.

Der allgemeine V71-Fix adaptiert `CAP-A-002` und `CAP-A-003`. Eine alte
Komponentenhülle wird bei `LIST` nur gehoben, wenn exakt ein fortgesetztes
logisches Segment die vollständige geordnete Unit-Blockfolge besitzt. Eigene
Quellen bleiben verpflichtend. Governor-Evidenz ist nur unter dem exakten
serverseitigen Evidenzkontextvertrag zulässig und muss zusätzlich über
Blockfolge, Hash und wortgetreues Label gebunden sein. Mehrsegmentlisten,
unvollständige Blockfolgen, fremde Quellen, ungebundene Governor, gemischte
Hüllen und verschachtelte Komponenten bleiben fail-closed.

Mac-Studio-Nachweise auf dem exakten Implementierungsstand
`d8425e86f95e62409c788a80570c6e9773bdae0d`:

```text
Gezielte positive/negative Vertragsfälle:  9/9 PASS
Vollständiger fokussierter Vertragslauf:   389/389 PASS
Echter gespeicherter Batch 17:             6/6 Units, PASS
Neue Modellaufrufe im Realartefakt-Test:   0
Nichtblockierende Diagnose:                LOCAL_SIGNAL_COMPONENT_MATERIALIZED
Attempt-Artefaktbaum SHA-256 vorher/nachher:
be05dd92dd2c71989e79f3320ee60e729045d8c7f0c8e7a37e3f1d63078cefe1
Vorgängerartefakte nach Revalidierung:      hashgleich
```

Das vollständige Release-Gate auf Commit
`b7654206815675afb80e8dc59a1986dc2d80b6fc` bestand 212/212 Suites und
3.084/3.084 Tests sowie Server-, Frontend- und Collector-Lint, Prisma,
Capability-Inventar, Prettier, Frontend-Build und Installer-Suite. Der
annotierte Tag `v3.9.0` und `origin/main` zeigen auf denselben Commit. Der
offizielle Updater aktivierte diesen Stand auf dem Kunden-Mac-Studio; Doctor,
API und Datenbank-`quick_check` bestanden. Das Pre-Activation-Backup liegt
unter:

```text
server/storage/backups/anythingllm-before-activation-20260917-165816.db
```

Der anschließende Resume der Session 14 verwendet den neuen Run-Root
`resume-5a180ec2f38e5a68a8e6e456`. Batches 1 bis 17 wurden dort mit null neuen
Attempt-Dateien materialisiert. Der erste neue Modellversuch betraf wie
verlangt erst Batch 18; dieser bestand. Der Lauf wird ab Batch 19 produktiv
fortgesetzt. Gold-283-V2 bleibt unverändert; der bekannte LF-1+9-Lauf bleibt
Regressionsevidenz und kein unabhängiger Generalisierungs- oder
99-Prozent-Nachweis.

Status: `V3.9.0 PRODUKTIV AKTIV; DOCTOR PASS; BATCHES 1 BIS 17 OHNE NEUE
MODELLARBEIT ÜBERNOMMEN; BATCH 18 PASS; KALTER PRODUKTLAUF AB BATCH 19 AKTIV`.

Change-Set:
`LF-V390-SINGLE-LIST-SEGMENT-LEGACY-LIFT-20260917-001`.

### 133.70 Mehrblock-Evidenz und quantifizierte Limitbasis in Batch 21

Der produktive V3.9.0-Resume materialisierte Batch 1 bis 17 ohne neue
Modellarbeit. Batch 18 bis 20 bestanden. Batch 21 stoppte nach elf Attempts
korrekt fail-closed: vier von sechs Units waren gültig und resumierbar, zwei
verbleibende Units wurden nicht als PASS gespeichert.

Die erste offene Unit ist erneut genau ein fortgesetztes Listensegment mit
servergebundenem Governor. Das fachlich korrekte Objektlabel überquert eine
physische Zweiblockgrenze, ersetzt dort aber ausschließlich den Zeilenumbruch
durch ein Leerzeichen. Zusätzlich kommt das kurze Wirkunglabel sowohl exakt
im Governor als auch als Wortanfang in der Unit vor. Die bisherige
Exact-Span-Prüfung konnte den Mehrblock-Whitespacefall nicht binden und wählte
beim kurzen Label den ersten Texttreffer statt der deklarierten Governor-ID.

Die zweite offene Unit enthält zwei quantifizierte Anforderungen. In der
ersten kombinierte Qwen Basis und Scope zu einem nicht wortgetreuen
`LIMIT_BASIS`-Kurzlabel; die Anforderung, ihr Wert und die zweite Anforderung
waren fachlich richtig und source-bound.

Der allgemeine V72-Fix adaptiert `CAP-A-002` und `CAP-A-003`. Ein
Mehrblocklabel darf ausschließlich über NFKC und Whitespace-Kollaps auf einer
eindeutig kleinsten zusammenhängenden Blockspanne gebunden werden. Bei
mehreren Texttreffern muss die vollständige Kandidatenspanne von den
deklarierten Source-IDs umfasst sein. Andere Textänderungen bleiben
unzulässig. Eine quantifizierte Satzform „Der/Die/Das X beträgt [Scope]
[Wert]“ darf ein nicht wörtliches Altlabel nur dann in die exakt gefundene
`LIMIT_BASIS` X und den optionalen `SCOPE` zerlegen, wenn genau eine gültige
Wertkomponente im selben Requirement vorhanden ist und das Altlabel exakt
diese beiden Teile verbindet.

Mac-Studio-Nachweise auf dem exakten Implementierungsstand
`a92aeae4f2b5da490288a7d35e7e701894595adc`:

```text
Gezielte positive/negative Vertragsfälle:  9/9 PASS
Vollständiger fokussierter Vertragslauf:   393/393 PASS
Echter gespeicherter Batch 21:             6/6 Units, PASS
Restdiagnosen:                             0
Neue Modellaufrufe im Realartefakt-Test:   0
Attempt-Artefaktbaum SHA-256 vorher/nachher:
c3f11c95368dc56956ddcbabedce0e9298a6b83a750e04c94deaf817927ede1e
Vorgängerartefakte nach Revalidierung:      hashgleich
```

V3.9.1-Release-Gate, Installation und die Fortsetzung ab dem nun
materialisierbaren Batch 21 stehen noch aus. Gold-283-V2 bleibt unverändert;
der bekannte LF-1+9-Lauf bleibt Regression und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Status: `BATCH-21-ROOT-CAUSES ALLGEMEIN BEHOBEN; REALARTEFAKT 6/6 PASS OHNE
MODELLAUFRUF; V3.9.1-GATE, DEPLOYMENT UND PRODUKT-RESUME AUSSTEHEND`.

Change-Set:
`LF-V391-BATCH21-EVIDENCE-NORMALIZATION-20260917-001`.

### 133.64 Kalter V3.8.4-Lauf und eingebettete List-Governor-Gruppen

V3.8.4 wurde als annotierter Tag veröffentlicht, `origin/main` und der
installierte Kunden-Checkout wurden auf den vollständig geprüften
Release-Commit `7789d0d79f63b318eaecf32d0a2fa6f939e13b01` aktualisiert. Das
Release-Gate bestand mit 211/211 Suites und 3.059/3.059 Tests sowie sämtlichen
Lint-, Prisma-, Inventar-, Frontend-Build- und Installer-Prüfungen. Der
offizielle Updater endete mit `Doctor: PASS`; das Pre-Update-Backup liegt
unter `server/storage/backups/anythingllm-before-activation-20260917-132350.db`.

Der danach mit zehn erneut hochgeladenen und hashverifizierten Dokumenten
gestartete echte kalte LF-1+9-Lauf verwendet Session 14 mit UUID
`79211e03-d5ce-44b6-9042-199e83f589a0` und den resumierbaren Run-Root:

```text
/Users/michaelmischkot/Code/polizzenvergleich-v3/server/storage/
  policy-comparisons/runs/79211e03-d5ce-44b6-9042-199e83f589a0/
  resume-5ea55381415e4c2103de5daa/
```

Die ersten vier A-Batches bestanden. Damit ist insbesondere der unter
V3.8.3 blockierende Batch 4 belegt behoben. Batch 5 stoppte korrekt
fail-closed. Die neue Root Cause liegt in Unit
`AU-0eb04c0f60adb44e246faef1`: Nach einem selbstständigen Listenpunkt folgt
innerhalb derselben Unit ein `LIST_GOVERNOR` mit drei hierarchisch
untergeordneten `LIST_ITEM`-Segmenten. Der bisherige Validator erkannte eine
gemeinsame Governor-Gruppe nur am Unit-Anfang. Dadurch wurde Scope an den
vorherigen Listenpunkt angehängt und der Governor zugleich als
eigenständiges Requirement ausgegeben.

V67/V16/V29 erkennt gemeinsame Governor-Gruppen an jeder serverseitig
belegten Segmentgrenze, bindet sie aber ausschließlich an die unmittelbar
folgenden untergeordneten Listenpunkte bis zur nächsten Grenze. Vorherige
oder spätere selbstständige Segmente dürfen den Scope nicht tragen; ein Leak
bleibt mit `LIST_GOVERNOR_SCOPE_LEAK` fail-closed. Die bestehende interne
Objekt-Governor-Materialisierung ist zudem idempotent. V28-Journale werden
unter dem neuen Vertrag neu validiert, ohne gültige Modellantworten erneut zu
berechnen.

Mac-Studio-Nachweise auf dem exakten Fix-Commit
`026f3b8e8d6833bac22d949f881f88686d06945a`:

```text
Fokussierte Vertragssuite:        369/369 PASS
Echte gespeicherte Problem-Unit:  OPERATIVE_MAPPED, 4 Requirements
Eigenständiger Governor:          entfernt
Governor-Zielsegmente:            exakt 3
Scope-Leak zum Vorgänger:         keiner
Replay der ersten fünf Batches:   5/5 PASS
Neue Modellaufrufe im Replay:     0
Verträge nach Replay:             V67 / V16 / V29
```

Ein erster Upgrade-Replay erkannte zusätzlich eine doppelte interne
Governor-Komponente in einem bereits bestandenen Batch 4. Die allgemeine
Materialisierung wurde daraufhin vor dem Fix-Commit idempotent gemacht; der
vollständige Fünf-Batch-Replay bestand erst danach. Das ist ein positives
Gate-Ergebnis, kein still übernommener Vorgängerstatus.

V3.8.5-Release-Gate, Deployment und Resume derselben Session 14 stehen noch
aus. Gold-283-V2 bleibt unverändert. Der unabhängige expertengelabelte
Mehrversicherer-Holdout ist weiterhin nicht vorhanden.

Der erste vollständige Release-Gate-Versuch auf `db7121283` deckte zusätzlich
eine reine Test-Harness-Abhängigkeit auf: Zwei bestehende Jest-Suites
importierten Storage-Module, ohne ihr benötigtes temporäres `STORAGE_DIR`
selbst zu setzen. Eine frühere Shell-Umgebung hatte diese Kopplung verdeckt.
Die Suites besitzen nun wie die übrigen Storage-Tests eine explizite lokale
Testumgebung; Produktcode und Kunden-Storage werden dadurch nicht verändert.

Status: `V3.8.4 FAIL-CLOSED NACH 4/58 PASS; ECHTER FEHLERFALL UND FÜNF-BATCH-
REPLAY UNTER V67 PASS; V3.8.5-GATE, DEPLOYMENT UND RESUME AUSSTEHEND`.

Change-Set: `LF-V385-EMBEDDED-LIST-GOVERNOR-GROUPS-20260917-001`.

### 133.63 Kalter V3.8.3-Lauf und interne Objektlisten-Provenienz

V3.8.3 wurde als annotierter Tag veröffentlicht, `origin/main` wurde auf den
vollständig geprüften Release-Commit
`fb96d2439977a154cfb22e12240bbc077552adbd` aktualisiert und der Tag über den
offiziellen Updater auf dem Kunden-Mac-Studio installiert. Der Updater endete
mit `Doctor: PASS`; Checkout und Tag waren identisch, die Datenbank bestand
`quick_check`, und das Pre-Update-Backup liegt unter
`server/storage/backups/anythingllm-before-activation-20260917-121111.db`.

Der anschließend über API, Queue und Worker gestartete echte kalte
LF-1+9-Lauf verwendete zehn hashgeprüfte Dokumente. Session 13 trägt die UUID
`f171cfa8-0566-4f25-bf04-d6ce93bd5454`; der Run-Root lautet:

```text
/Users/michaelmischkot/Code/polizzenvergleich-v3/server/storage/
  policy-comparisons/runs/
  f171cfa8-0566-4f25-bf04-d6ce93bd5454/
  resume-78a062ef3b80749fd5c0117d/
```

Die ersten drei von 58 A-Batches bestanden. Batch 4 stoppte korrekt
fail-closed. Ein kontrollierter Resume übernahm alle drei PASS-Batches und
fünf bereits gültige Units des unvollständigen Batches; nur die eine offene
Unit wurde erneut geprüft. Qwen wiederholte in zwei Zyklen mit insgesamt sechs
semantischen Versuchen deterministisch denselben Quellenbindungsfehler. Es
gab keinen Timeout, keinen Abort und keine verlorenen Artefakte.

Die Unit bestand aus einem predicate-freien internen Objekt-Listenkopf und
einem darunterliegenden, über mehrere Blöcke fortgesetzten Listenpunkt. Die
fachlichen Objektkomponenten waren vorhanden, aber der Listenkopf und der
erste Satzblock blieben aus der Komponentenprovenienz ausgespart. Der
quellenidentische, zuvor bestandene V3.8.2-Batch bestätigte die fehlenden
Bindungen unabhängig.

Der allgemeine Fix ist als Klassifikationslauf V66 implementiert. Er
materialisiert einen source-bound internen Objekt-Governor der Form `bei …`
nur bei bereits belegter `INSURED_OBJECT`-Semantik und erweitert die
Provenienz der eindeutig frühesten Objektkomponente nur innerhalb desselben
serverseitig gebundenen Fortsetzungssegments. Operative Deckungs-Governors
und ungebundene Einzel-Segment-Listen bleiben Negativgrenzen.

Der exakte Fix-Commit
`9a5d6f9e4a690b2d35f4cdf5d7dac3983c98de10` bestand auf dem Mac Studio:

```text
Prettier:                         PASS
A-Vertragssuite:                 366/366 PASS
Gespeicherte reale Problem-Unit: OPERATIVE_MAPPED
Interner Governor gebunden:      JA
Führender Satzblock gebunden:    JA
Neuer Modellaufruf für Replay:   NEIN
```

V3.8.4-Release-Gate, Deployment und ein neuer kalter Produktlauf stehen noch
aus. Gold-283-V2 bleibt unverändert. Der nicht vorhandene unabhängige,
expertengelabelte Mehrversicherer-Holdout bleibt ein separates offenes Gate.

Status: `V3.8.3 FAIL-CLOSED NACH 3/58 PASS; ROOT CAUSE UNTER V66 BEHOBEN;
V3.8.4-GATE UND NEUER KALTER LAUF AUSSTEHEND`.

Change-Set: `LF-V384-INTERNAL-OBJECT-LIST-PROVENANCE-20260917-001`.

### 133.62 Kalter V3.8.2-Lauf und parenthetische Objektausnahmen

V3.8.2 wurde am 17. September 2026 über den offiziellen Updater auf dem
Kunden-Mac-Studio aktiviert. Der exakte Release-Commit
`a0a8150ea1c7f3f1cac15733d000b89e469d3849`, Datenbank-Quick-Check,
geschütztes Pre-Update-Backup, Loopback-Dienste und Doctor bestanden. Der
danach über API, Queue und Worker gestartete neue kalte LF-1+9-Lauf verwendete
zehn erneut hochgeladene, hashgleiche Eingangsdokumente.

Der zuvor blockierende zweite A-Batch bestand unter V64 mit 6/6 terminalen
Units und null Diagnosen. Der Lauf stoppte später im fünften A-Batch korrekt
fail-closed; die ersten vier Batches blieben vollständig gültig und
resumierbar.

Die neue Root Cause war eng begrenzt: Drei selbstständige Objekt-Listenpunkte
waren bereits als drei Requirements mit korrekten Segment- und Blockgrenzen
klassifiziert. In einem Listenpunkt blieb ausschließlich eine wörtliche
parenthetische Ausnahme ohne eigene `EXCLUDED`-Wirkung. V65 materialisiert
nun parenthetische `ausgenommen …`-/`exklusive …`-Aussagen als source-bound
`COVERAGE_EFFECT`, ohne Objekt-Requirement oder Listenfortsetzung zu ändern.
Bereits negative Deckungsklauseln bilden eine harte Negativgrenze; identische
vorhandene Ausschlusswirkungen werden nicht dupliziert.

Der gespeicherte echte Fehlerfall wurde im isolierten Mac-Studio-Worktree auf
Commit `74454a388` ohne neuen Modellaufruf revalidiert:

```text
Requirements:          3 unverändert
Primärklasse:           INSURED_OBJECT
Semantische Klassen:   INSURED_OBJECT + EXCLUSION
Neue Ausschlusswirkung: exakt 1
Diagnosen:              0
Unitstatus:             PASS
```

Der fokussierte Vertragscheck bestand mit 364/364 Tests; Prettier bestand.
V3.8.3-Release-Gate, Deployment und ein neuer kalter Lauf stehen noch aus.
Gold-283-V2 bleibt unverändert; der unabhängige expertengelabelte Holdout ist
weiterhin nicht vorhanden.

Status: `V3.8.2 FAIL-CLOSED NACH 4/58 PASS; ECHTER FEHLERFALL UNTER V65 PASS;
V3.8.3-GATE UND NEUER KALTER LAUF AUSSTEHEND`.

Change-Set: `LF-V383-PARENTHETICAL-OBJECT-EXCLUSION-20260917-001`.

### 133.61 Kalter V3.8.1-Lauf und allgemeine administrative A-Normalisierung

V3.8.1 wurde am 17. September 2026 mit dem offiziellen Updater auf dem
Kunden-Mac-Studio aktiviert. Der installierte Checkout zeigte sauber und
detached auf den unveränderlichen Tag `v3.8.1`; Doctor, Datenbank-Quick-Check,
Loopback-Dienste sowie der lokale Qwen-Vertrag bestanden.

Der danach über API, Queue und Worker gestartete echte kalte LF-1+9-Lauf mit
zehn erneut hochgeladenen, hashverifizierten Dokumenten stoppte im zweiten
von 58 A-Batches korrekt fail-closed. Batch 1 war `PASS`; Batch 2 blieb mit
sämtlichen sechs gültigen Qwen-Versuchen und Resume-Artefakten erhalten. Es
gab weder Timeout noch Transportfehler.

Die Root Cause waren zwei allgemeine administrative Satztypen, bei denen das
Modell wiederholt Pflichtlabels ausließ: eine Dokumentations-/Vermerkspflicht
und eine Geltungsregel unter ausdrücklichen Voraussetzungen vor einer
Deckungsaufzählung. Der V64-Klassifikationsvertrag normalisiert diese Fälle
nun deterministisch aus den eigenen Originalblöcken als `OBLIGATION` oder
`CONDITION`. Ausdrückliche Deckungs-, Ausschluss- und Entschädigungsaussagen
sind als Negativgrenze von dieser Regel ausgeschlossen. Die Implementierung
enthält keine bekannte Dokument-ID, Seite, Versichererbezeichnung oder
Kundenformulierung.

Der gespeicherte echte Fehlerbatch wurde im isolierten Mac-Studio-Worktree
`/private/tmp/lf-v381-fix-ceb7b7107` auf Commit
`de7b09cd8d336f75cffa79b15e487cc0ad662142` ohne neuen Modellaufruf gegen
seine vorhandenen Versuchsjournale revalidiert:

```text
Erwartete Units:       6
Wiederhergestellt:     6
Batchstatus:           PASS
Diagnosen:             0
Administrative Regel: OBLIGATION, 1 Requirement
Geltungsregel:         CONDITION, 1 Requirement
```

Der fokussierte Vertragscheck bestand mit 362/362 Tests; Prettier für die
beiden geänderten Dateien bestand. V3.8.2-Release-Gate, Deployment und neuer
kalter Produktlauf stehen noch aus. Gold-283-V2 bleibt unverändert. Der nicht
vorhandene unabhängige expertengelabelte Mehrversicherer-Holdout bleibt ein
separates, offenes Abnahme-Gate.

Status: `V3.8.1 FAIL-CLOSED NACH 1/58 PASS; ECHTER FEHLERBATCH UNTER V64
6/6 PASS; V3.8.2-GATE UND NEUER KALTER 1+9-LAUF AUSSTEHEND`.

Change-Set: `LF-V382-ADMIN-CONDITION-NORMALIZATION-20260917-001`.

### 133.60 Gold-283-V2 eingefroren und V3.8.1-Release-Gate bestanden

Der occurrence-gebundene V11-Fix wurde auf dem Mac Studio im isolierten
Worktree `/private/tmp/lf-v381-fix-ceb7b7107` auf dem exakten
Release-Kandidaten `588334568f93be060ca1c078cae0c3439619ad6d` geprüft. Das
Gate bestand:

```text
Server:                  201/201 Suites, 2.948/2.948 Tests PASS
Server-/Collector-Lint:  PASS / PASS
Frontend-Lint/-Build:    PASS / PASS
Prisma:                  PASS
Capability-Inventar:     PASS
macOS-Installer-Suite:   PASS
```

Gold-283-V2 wurde ausschließlich aus den bereits hashgebundenen
Originalquellen, Gold-V1, Gold-30-V2, Vollkorpus-, Entscheidungs- und
Regressionsartefakten materialisiert. Gold-V1 blieb byteidentisch bei
`9ed4ab6ba3dbd896de48ecf94e6874881391600ef2cc027afae5af5d21123a55`.
Der neue Stand liegt geschützt auf dem Mac Studio unter:

```text
/Users/michaelmischkot/Library/Application Support/
  at.klincov.polizzenvergleich-v3/QA/
  LF-1PLUS9-GOLD-283-V2-20260917-4C917E7F/
```

Gold-Datei-SHA-256:
`f43f6216010dfc01db53fcb8c3b04b5bc5a49f657c2232ab9f2a2999021551d4`;
interner Gold-SHA-256:
`44300754f9bad315410f7805ecb1b8c4f4e65551e2dc8a5349ba41c8697edf37`.
Die 283 Zeilen verteilen sich auf 270 `FOUND` und 13 `NOT_FOUND`, davon 149
`FULL`, 113 `PARTIAL`, acht `CONTRADICTED` und 13 `NONE`. Gegen die bestehende
dynamische Baseline sind 144/144 eindeutig messbare Fälle korrekt, ohne
False Positive oder False Negative. Die 139 verbleibenden Crosswalk-Fälle
sind wegen Split/Merge nicht binär eindeutig messbar und werden nicht als
Fehler oder Erfolg umetikettiert.

Der echte kalte Produktlauf und das Kundenupdate auf V3.8.1 stehen nach dem
Release-Gate noch aus. Der fehlende unabhängige expertengelabelte
Mehrversicherer-Holdout bleibt ein separates Abnahme-Gate.

Status: `GOLD-283-V2 FROZEN; RELEASE-GATE PASS; V3.8.1-DEPLOYMENT UND KALTER
PRODUKTLAUF AUSSTEHEND; KEIN HOLDOUT-/99-PROZENT-NACHWEIS`.

Change-Set: `LF-V381-COLD-E2E-CORRECTIONS-20260917-001`.

### 133.59 Kalter V3.8.0-Produktlauf deckt occurrence-gebundene A-Limitlücke auf

Der erste neue Lauf über den echten Kundenpfad wurde am 17. September 2026
mit einer neuen Workspace-, Session- und Run-Identität gestartet. Die zehn
Eingangsdokumente waren gegen das eingefrorene 1+9-Manifest hashgleich. Der
installierte V3.8.0-Worker extrahierte alle 108 Seiten und stoppte danach
korrekt fail-closed im dritten von 58 A-Klassifikationsbatches. Batch 1 und 2
waren vollständig `PASS`; sämtliche Versuche des unvollständigen dritten
Batches blieben resumierbar erhalten.

Die Ursache ist weder ein fehlender Qwen-Text noch ein Retrievalproblem. Eine
Anforderung enthielt zwei ausdrückliche nichtnumerische Limits. Der breite
`SCOPE` zitierte beide vollständig, doch der servereigene Materializer nahm
für beide Evidenzvorkommen stets den ersten Regex-Treffer. Dadurch wurde
„Versicherungssummen nicht addiert“ zweimal auf den ersten Quellblock
materialisiert und „nur einmal pro Schadenfall“ auf dem zweiten Block blieb
ohne eigene `LIMIT_BASIS`-Rolle.

Der allgemeine Fix wird als `LF_A_REQUIREMENT_ROLE_EVIDENCE_COMPLETENESS_V11`,
Manifest V15 und Klassifikationslauf V63 versioniert. Nichtnumerische Limits
sind jetzt occurrence-gebunden: Typ, konkrete Textstelle und Quellblock müssen
gemeinsam passen. Ein breites Limit darf mehrere Vorkommen nur dann tragen,
wenn sein eigenes Label alle betreffenden Aussagen tatsächlich enthält. V10,
Manifest V14 und Lauf V62 bleiben für historische Revalidierung unverändert.
Tests decken den echten Zwei-Block-Fall, dieselbe Aussage in einem Block,
breite und zu enge vorhandene Rollenkomponenten, V10-Replay und vollständige
Manifestmaterialisierung ab.

Parallel wird das unveränderte Gold-283-V1 über einen getrennten QA-only-
Korrekturvertrag zu Gold-283-V2 fortgeschrieben. Exakt `VS-15`, `AV-06` und
`AV-22` werden aufgrund der bereits hashgebundenen Vollkorpus-Abwesenheit von
`FOUND` auf `NOT_FOUND` korrigiert; die übrigen 280 Zeilen müssen kanonisch
unverändert bleiben. Diese Korrektur verändert keine Produktregel.

Der vorhandene Dokumentbestand enthält keinen echten unabhängigen,
expertengelabelten Mehrversicherer-Holdout. UNIQA, DONAU und weitere
verfügbare Dokumente wurden bereits in der Entwicklung verwendet oder
besitzen kein eingefrorenes Fach-Oracle. Sie dürfen höchstens als
explorativer Kalt-Smoke, nicht als Generalisierungs- oder 99-Prozent-Nachweis
bezeichnet werden.

Status: `KALTER PRODUKTLAUF FAIL-CLOSED NACH 2/58 PASS; ROOT CAUSE BEHOBEN,
MAC-STUDIO-GATE UND V3.8.1-RESUME AUSSTEHEND; GOLD-283-V2 VORBEREITET; KEIN
UNABHÄNGIGER HOLDOUT VORHANDEN`.

Change-Set: `LF-V381-COLD-E2E-CORRECTIONS-20260917-001`.

### 133.58 V3.8.0 auf dem Kunden-Mac-Studio aktiviert

Der kontrollierte Kunden-MVP wurde am 16. September 2026 über den offiziellen,
rollbackfähigen Updater installiert. Der annotierte Release-Tag `v3.8.0`,
`origin/main` und der installierte detached Checkout zeigen auf denselben
Commit:

```text
8f8d70e88c0d481bc1e0a09fc9da4e5dc09b2fb7
```

Das vollständige Release-Gate lief zuvor auf genau diesem Commit in einem
isolierten Mac-Studio-Worktree und bestand:

```text
Server:                  199/199 Suites, 2.936/2.936 Tests PASS
Server-/Collector-Lint:  PASS / PASS
Prisma:                  PASS
Capability-Inventar:     PASS
Frontend-Lint/-Build:    PASS / PASS
macOS-Installer-Suite:   PASS
```

Vor dem Update bestanden Datenbank-`quick_check`, Quieszenzprüfung und
Workerprüfung. Es gab keine `QUEUED`- oder `RUNNING`-Sitzung. Das geschützte
Pre-Update-Backup liegt ausschließlich auf dem Mac Studio unter:

```text
/Users/michaelmischkot/Polizzenvergleich-Backups/
  pre-v3.8.0-20260916T175005Z
```

Der freigegebene Dinghy-Vertrag wurde unter einem stabilen, nur für den
Benutzer lesbaren Pfad materialisiert und vom neuen Doctor einschließlich
Modell-, Dimensions-, Runtime- und Artefakthashes verifiziert:

```text
/Users/michaelmischkot/Library/Application Support/
  at.klincov.polizzenvergleich-v3/contracts/
  lf-a-driven-dinghy-v1.json
Vertrags-SHA-256:
d3275eef1f47cf64c87c36a567178d11f3aa68e6cba42e1e8fe22c29c742db8b
```

Der offizielle Updater baute die Oberfläche neu, bestätigte 42 vorhandene
Migrationen ohne ausstehende Migration, aktivierte beide LaunchAgents und
endete mit `Doctor: PASS`. Server und Collector laufen ausschließlich auf
Loopback (`3004` und `8890`); Qwen 3.6 ist mit Kontext 42.496 und Parallelität
1 geladen, kein weiteres Chat- oder Embeddingmodell ist resident. Der
Checkout ist sauber und detached auf `v3.8.0`. Datenbankintegrität und die
Zählungen von Vergleichssitzungen, Workspaces, Workspace-Dokumenten und
Vektoren stimmen vor und nach dem Update überein.

Die fachliche Freigabeevidenz wurde nach dem Deployment read-only erneut
hash- und strukturverifiziert:

```text
Dynamische A-Zeilen:                       363
GEFUNDEN / NICHT GEFUNDEN / UNKLAR:       322 / 41 / 0
FULL / PARTIAL / CONTRADICTED / NONE:      199 / 118 / 5 / 41
Binärartefakt-Datei-SHA-256:
ff9a7292f10f34b0f9cb2bfc728a8ad08b3e46da3995f8fa62a8703785733d18
Interne XLSX-Datei-SHA-256:
70d5ecb6e26b278e01c17f1bfcf85e1e1eccddc6fee2dcb7f59b2282f3194243
```

Eine byteidentische, zugriffsgeschützte Nachweiskopie liegt für den Kunden
unter:

```text
/Users/michaelmischkot/Downloads/Projekt Lokale KI/Vergleiche/
  LF-IMMO-Dynamischer-Referenzvergleich-V3.8.0-2026-09-16.xlsx
```

Damit ist der dynamische `LF_REFERENCE_A_DRIVEN_V2`-Ansatz für das bekannte
LF-1+9-Set technisch und fachlich als kontrollierter Kunden-MVP aktiviert.
Die Aussage bleibt bewusst auf dieses Entwicklungs- und Regressionsset
begrenzt; ungesehene Mehrversicherer-Holdouts, allgemeine 99-Prozent-
Richtigkeit und eine allgemeine Laufzeitzusage sind weiterhin nicht bewiesen.

Status: `V3.8.0 PRODUKTIV AKTIV; DOCTOR PASS; DYNAMISCHES LF-1+9 363/363
BINÄR; KONTROLLIERTER KUNDEN-MVP, KEIN ALLGEMEINER HOLDOUT-NACHWEIS`.

Change-Set: `LF-V2-PRODUCTION-ACTIVATION-20260916-001`.
