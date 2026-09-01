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
