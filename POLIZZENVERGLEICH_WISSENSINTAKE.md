# Polizzenvergleich – Wissensintake und Strategie-Verknüpfung

Stand: 26. August 2026

## 1. Zweck und Wahrheitsgrenze

Dieses Dokument ist der kanonische Eingang für nacheinander übermittelte Ideen,
Beobachtungen, Annahmen, Evidenzhinweise, offene Fragen und
Entscheidungskandidaten zur lokalen KI und zum Polizzenvergleich.

Ein `INT-*`-Eintrag ist **keine implementierte oder akzeptierte Wahrheit**. Er
dokumentiert Herkunft, Bedeutung, Beziehungen und Prüfbedarf. Bestätigtes
Wissen wird genau einmal in den passenden kanonischen Detailort übernommen;
der Intake-Eintrag bleibt als Herkunftsnachweis bestehen und verlinkt dorthin.

Quellcode und Tests bleiben die Wahrheit über den aktuellen Arbeitsbaum.
Messungen gelten nur für ihre dokumentierte Umgebung. Akzeptierte ADRs und
Invarianten begrenzen die zulässige Richtung.

## 2. Arbeitsablauf für neue Inputs

1. Mehrteiligen Input in atomare Aussagen zerlegen.
2. Jede Aussage mit stabiler `INT-YYYYMMDD-NNN`-ID erfassen.
3. Typ, Status, Quelle, Beweisgrenze und Systembezug festhalten.
4. Beziehungen zu anderen `INT-*`, `INV-*`, `FAIL-*` und `ADR-*` verlinken.
5. Die kleinste passende Fachprüfung einholen: Local-AI/RAG-Architektur,
   Kunden-/Versicherungsnutzen, Datenschutz/Betrieb und kritische
   Gegenprüfung.
6. Hard-Gates prüfen, Nutzen und Evidenz bewerten und den billigsten
   Falsifikationstest bestimmen.
7. Den Eintrag akzeptieren, begrenzen, verwerfen oder zurückstellen.
8. Nur bestätigtes Wissen in den kanonischen Zielort übernehmen und den
   Ausgang im Intake verlinken.

## 3. Typen, Status und Beziehungen

Zulässige Typen:

- `ZIEL`
- `IDEE`
- `ANNAHME`
- `BEOBACHTUNG`
- `EVIDENZHINWEIS`
- `OFFENE_FRAGE`
- `ENTSCHEIDUNGSKANDIDAT`

Zulässige Statuswerte:

- `OFFEN`
- `IN_PRÜFUNG`
- `PROMOTED`
- `GESCHLOSSEN`

Zulässige Beziehungen:

- `stützt`
- `widerspricht`
- `hängt_ab_von`
- `verfeinert`
- `ersetzt`
- `prüft`

Ein `EVIDENZHINWEIS` ist noch kein Beweis. Widersprüche werden verlinkt und
sichtbar aufgelöst, nicht still überschrieben.

## 4. Verbindliches Ideen-Gate

Ein Kandidat bleibt `OFFEN` oder höchstens Pilot, wenn eines dieser Hard-Gates
nicht erfüllt oder bewusst begrenzt ist:

1. **Kundennutzen:** konkreter Benutzer, Arbeitsproblem, sichtbares Ergebnis
   und Lieferumfang sind benannt.
2. **Datenschutz/Lokalität:** keine unkontrollierten Cloud-, Telemetrie- oder
   Datenabflüsse; reale Kundendaten gelangen nicht in Git oder Fixtures.
3. **Provenienz:** Aussagen sind an kanonische Dokumentstellen gebunden;
   physische PDF-Seiten stammen nur aus der PageMap.
4. **Vollständigkeitsehrlichkeit:** kein stilles Top-N für „alle“; ungelöste
   Kandidaten führen zu sichtbarer Unvollständigkeit oder Fail-Closed.
5. **Faktkontrolle:** Servercode besitzt Fakten, Rollen, Quellen und alle
   Ergebniszeilen; ein Modell darf sie nicht auswählen oder auslassen.
6. **Isolation und Persistenz:** Dokument-, Thread-, A/B- und Variantenscope
   bleiben erhalten; ein neuer Lauf gefährdet keinen veröffentlichten Stand.
7. **Lokaler Betrieb:** Modell-, Speicher-, Queue- und Laufzeitvertrag ist auf
   der tatsächlichen Kundenhardware prüfbar.

## 5. Bewertungsmatrix für Strategieoptionen

Nach bestandenen Hard-Gates wird jede Option von 1 bis 5 bewertet. Eine hohe
Gesamtpunktzahl darf kein fehlgeschlagenes Hard-Gate kompensieren.

| Kriterium                                        | Gewicht |
| ------------------------------------------------ | ------: |
| Fachliche Korrektheit und Rollenbindung          |      25 |
| Ehrliche Evidenz- und Coverage-Grenze            |      20 |
| Kundennutzen und Bedienablauf                    |      15 |
| Laufzeit und Ressourcen auf dem Kunden-Mac       |      15 |
| Erweiterbarkeit auf viele Vergleichspunkte       |      10 |
| Wartbarkeit, Testbarkeit und klare Modulverträge |       8 |
| Betrieb, Recovery und Diagnose                   |       7 |

Zusätzlich wird die Evidenzqualität getrennt markiert:

- `BEOBACHTET_CODE`
- `GEMESSEN_KUNDENHARDWARE`
- `GEMESSEN_ENTWICKLUNGSUMGEBUNG`
- `SYNTHETISCH_GETESTET`
- `NUTZERANGABE`
- `ANNAHME`

## 6. Aktives Intake-Register

| ID                 | Kurztitel                                                                | Typ                     | Status        | Nächster Schritt                                                                                                        |
| ------------------ | ------------------------------------------------------------------------ | ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `INT-20260824-001` | Bestmögliche lokale KI-Strategie aus verbundenem Wissen ableiten         | `ZIEL`                  | `IN_PRÜFUNG`  | kommende Inputs einzeln erfassen und verbinden                                                                          |
| `INT-20260824-002` | Versionierte Wort-/Rollenmatrix als Retrievalvertrag                     | `IDEE`                  | `IN_PRÜFUNG`  | TargetSpec für Selbstbehalt und Limit fachlich definieren                                                               |
| `INT-20260824-003` | Occurrence-zentrierte strukturelle Kontextexpansion                      | `ENTSCHEIDUNGSKANDIDAT` | `PROMOTED`    | vorhandene ADRs durch echte Offset-Occurrences implementierbar machen                                                   |
| `INT-20260824-004` | Dokumentfluss als typisierter Relationsgraph                             | `IDEE`                  | `IN_PRÜFUNG`  | minimalen In-Memory-Graph an Realstrukturfällen prüfen                                                                  |
| `INT-20260824-005` | Drei Retrievalschichten ergeben 100 Prozent Dokumentverständnis          | `ANNAHME`               | `GESCHLOSSEN` | nur getrennte, messbare Coverage-Verträge verwenden                                                                     |
| `INT-20260824-006` | Generischer Heuristikkern statt Regelkopien je Thema                     | `IDEE`                  | `IN_PRÜFUNG`  | zuerst Selbstbehalt, danach Limits als zweiten vertikalen Beweis nutzen                                                 |
| `INT-20260824-007` | Lokale Zielplattform AnythingLLM und LM Studio                           | `ZIEL`                  | `PROMOTED`    | tatsächliche Kunden-Runtime vor Betriebsbehauptungen verifizieren                                                       |
| `INT-20260824-008` | Beleggebundene Einzeldokumentanalyse                                     | `ZIEL`                  | `PROMOTED`    | Ergebnisvertrag durch fachliche Golden Cases konkretisieren                                                             |
| `INT-20260824-009` | Dokumentisolierter A/B-Vergleich mit Detailunterschieden                 | `ZIEL`                  | `PROMOTED`    | stabile Vergleichspunkte und Comparability Gate definieren                                                              |
| `INT-20260824-010` | Gebäudeversicherung als aktueller Lieferumfang                           | `ZIEL`                  | `PROMOTED`    | Kategorien, Granularität und Abnahmetiefe schärfen                                                                      |
| `INT-20260824-011` | Fachliche Bedeutung von „Vertrag A ist besser“                           | `OFFENE_FRAGE`          | `OFFEN`       | punktweise Bewertung oder zusätzliche profilbasierte Empfehlung klären                                                  |
| `INT-20260824-012` | Claude-Prüfkatalog als fachlicher Taxonomie-Seed                         | `EVIDENZHINWEIS`        | `IN_PRÜFUNG`  | Punkte atomisieren, deduplizieren und durch Gebäudeversicherungsexperten freigeben                                      |
| `INT-20260824-013` | Dokumentisolierte Analyse je Kategorie vor dem A/B-Join                  | `ENTSCHEIDUNGSKANDIDAT` | `IN_PRÜFUNG`  | als internen Workflow ohne manuelle Pflichtschritte konkretisieren                                                      |
| `INT-20260824-014` | Stabile Prüfpunkt-IDs und beleggebundener Extraktionsvertrag             | `IDEE`                  | `PROMOTED`    | Kandidatenschema fachlich klassifizieren und erst danach aktivieren                                                     |
| `INT-20260824-015` | Serielle LLM-Batches mit LLM-Selbstverifikation                          | `ENTSCHEIDUNGSKANDIDAT` | `GESCHLOSSEN` | nur als begrenzter Eval-Baseline, nicht als Produktionspfad verwenden                                                   |
| `INT-20260824-016` | Deterministischer Vergleich und pauschales Punkteschema                  | `ENTSCHEIDUNGSKANDIDAT` | `IN_PRÜFUNG`  | deterministischen Join übernehmen, universelle Scores verwerfen                                                         |
| `INT-20260824-017` | Generatives Inhaltsverzeichnis mit Markdown-Zeilenreferenzen             | `IDEE`                  | `GESCHLOSSEN` | höchstens als Navigationshinweis, nie als Coverage- oder Provenienzbasis                                                |
| `INT-20260824-018` | Qwen-3.8-Konfiguration und 32-GB-Laufzeitannahmen                        | `EVIDENZHINWEIS`        | `IN_PRÜFUNG`  | tatsächliche LM-Studio-Runtime und A/B-Eval messen                                                                      |
| `INT-20260824-019` | Leitungswasser als erster breiter Kategorienpilot                        | `IDEE`                  | `IN_PRÜFUNG`  | 25 Golden-Case-Klassen konkretisieren und nach Realstruktur-Gate ausführen                                              |
| `INT-20260825-020` | Analysephase vor sauberem Neuimplementierungsbranch                      | `ZIEL`                  | `PROMOTED`    | vorbereiteten Branch unverändert halten und Baseline vor Implementierung bestätigen                                     |
| `INT-20260825-021` | Original-AnythingLLM Default-N32-Vollkontextprobe                        | `EVIDENZHINWEIS`        | `PROMOTED`    | Leitungswasser-Mehrpass statt weiterem Top-N-/Generator-Roulette prüfen                                                 |
| `INT-20260825-022` | Vertrauliche Realpolicen als lokale strukturdiverse Testkohorte          | `ENTSCHEIDUNGSKANDIDAT` | `PROMOTED`    | zunächst synthetische Fälle, danach wenige lokale Entwicklungs- und Holdoutpakete                                       |
| `INT-20260825-023` | Partner-Katalog mit 276 Prüfpunkten und Qwen/XLSX-Kategorienlauf         | `EVIDENZHINWEIS`        | `IN_PRÜFUNG`  | Quellkatalog gegen 202er Seed crosswalken und einen kontrollierten Challenger messen                                    |
| `INT-20260825-024` | Isolierter lokaler PDF-Ordner-Batch-Harness                              | `EVIDENZHINWEIS`        | `PROMOTED`    | zunächst Dry-Run und synthetische Challenger-Batches, keine Kundenfreigabe                                              |
| `INT-20260825-025` | Dokumenteigene Kategorien und Unterkategorien wortgetreu inventarisieren | `ZIEL`                  | `PROMOTED`    | separaten strukturellen Inventarlauf vor dem Partner-Katalog-Crosswalk definieren                                       |
| `INT-20260825-026` | Strukturinventar und belegtes Inhaltsinventar strikt trennen             | `ENTSCHEIDUNGSKANDIDAT` | `PROMOTED`    | Struktur zuerst roh erfassen, danach rollenbezogene Inhalte aus allen Text- und Tabellenbereichen extrahieren           |
| `INT-20260825-027` | Vollständige Built-in-Konfigurationskampagne und Run-Ledger              | `EVIDENZHINWEIS`        | `PROMOTED`    | Ledger vor jeder RAG-, Modell- oder Agentic-Entscheidung laden; Proxys nie als Faktenrecall ausgeben                    |
| `INT-20260825-028` | Taxonomiegetriebener occurrence-zentrierter A/B-Zeilenworkflow           | `ENTSCHEIDUNGSKANDIDAT` | `IN_PRÜFUNG`  | Strukturinventar qualitätsprüfen, Partner-Crosswalk erstellen und TargetSpec-/Row-Vertrag an Golden Cases falsifizieren |
| `INT-20260825-029` | Zwei-Polizzen-Vergleich hat aktuelle Produktpriorität                    | `ZIEL`                  | `PROMOTED`    | Strategie und Abnahme primär an dokumentisoliertem A/B-Vergleich ausrichten                                             |
| `INT-20260825-030` | Bidirektionaler Klauselabgleich als katalogunabhängiger Vergleichspfad   | `IDEE`                  | `IN_PRÜFUNG`  | an einem anonymisierten A/B-Paar gegen manuell markierte Klauselunterschiede falsifizieren                              |
| `INT-20260831-031` | Fünf Kategorien und ein Einblatt-Kundenexport                            | `ENTSCHEIDUNGSKANDIDAT` | `PROMOTED`    | fachliche 224-Zeilen-Abnahme auf unbekannten Paketen getrennt vom Layoutvertrag durchführen                             |

## INT-20260824-001 — Bestmögliche lokale KI-Strategie aus verbundenem Wissen ableiten

- Erfasst: 2026-08-24
- Typ: `ZIEL`
- Status: `IN_PRÜFUNG`
- Aussage: Aus den nacheinander übermittelten Ideen, Beobachtungen und
  Anforderungen soll eine begründete Strategie für die bestmögliche lokale
  KI-Variante des Kunden entstehen.
- Ist-Wahrheit: `NEIN` – Ziel und Intake, keine implementierte oder akzeptierte
  Architekturentscheidung.
- Quelle: paraphrasierter Nutzerauftrag vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: eine zusammenhängende,
  priorisierte und prüfbare Strategie statt einer unverbundenen Ideensammlung.
- Scope und ausdrückliche Nicht-Ziele: zunächst Wissensaufnahme, Analyse und
  Verbindung; noch keine vorschnelle Produkt-, Modell- oder
  Implementierungsentscheidung.
- Evidenz und Beweisgrenze: Das bestehende KB belegt technische Randbedingungen
  und frühere Tests. Die kommenden fachlichen und geschäftlichen Inputs sind
  noch nicht erfasst.
- Systembezug: Gesamtprodukt, Local-AI/RAG, Faktenmodell, Bedienablauf,
  Kundenhardware, Betrieb, Datenschutz und Abnahme; insbesondere `INV-001` bis
  `INV-006`, `FAIL-001` bis `FAIL-003` und `ADR-001` bis `ADR-015`.
- Beziehungen:
  - hängt_ab_von -> kommende atomare `INT-*`-Einträge
  - prüft -> Vereinbarkeit neuer Ideen mit bestehenden `INV-*`, `FAIL-*` und
    `ADR-*`
- Spezialistenurteil:
  - Local-AI/RAG: Optionen gegen eine beleggebundene Hybridpipeline aus
    deterministischer Verarbeitung, vollständiger Fundstellenlogik,
    Embeddings und gezieltem LLM-Einsatz prüfen.
  - Kunde/Versicherung: zuerst Kundenproblem, sichtbares Ergebnis,
    Vertrauensgrenze und Lieferstufe klären; Modellwahl ist nachgeordnet.
  - Datenschutz/Betrieb: Lokalität, Datenfluss, Löschung, Recovery und reale
    32-GB-Hardware bleiben Hard-Gates.
  - Kritik/Test: Keine Strategie ohne messbare Golden Cases, Realstrukturtest,
    Laufzeitbudget und ausdrückliche Beweisgrenzen als „beste“ bezeichnen.
- Hard-Gates: `OFFEN` – erst nach den konkreten Inputs bewertbar.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `NUTZERANGABE` für das Ziel; vorhandene technische
  Randbedingungen sind in den kanonischen Fachdokumenten getrennt belegt.
- Riskanteste Annahme: Dass bereits genug Kunden- und Lieferanforderungen für
  eine endgültige Architekturentscheidung bekannt seien.
- Nächster Prüfschritt: Den ersten konkreten Nutzerinput atomisieren,
  dokumentieren, mit bestehendem Wissen verbinden und fachlich gegenprüfen.
- Entscheidung: offen.
- Kanonischer Ausgang: noch keiner.

## INT-20260824-002 — Versionierte Wort-/Rollenmatrix als Retrievalvertrag

- Erfasst: 2026-08-24
- Typ: `IDEE`
- Status: `IN_PRÜFUNG`
- Aussage: Eine Wortmatrix soll bekannte Vergleichspunkte, Begriffsvarianten
  und erwartete Faktrollen je Thema als kontrollierten Retrieval-Seed
  bereitstellen.
- Ist-Wahrheit: `NEIN` – ein additiver Alias-Katalog existiert, die
  vorgeschlagene umfassendere Wort-/Rollenmatrix noch nicht als vollständiger
  Vertrag.
- Quelle: paraphrasierter Nutzerinput vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: bekannte fachliche Punkte
  in unterschiedlich aufgebauten Dokumenten reproduzierbar finden und in
  getrennte Rollen ausgeben.
- Scope und ausdrückliche Nicht-Ziele: Kandidaten erzeugen und Regeln steuern;
  weder geschlossene Taxonomie noch Abwesenheits- oder Vollständigkeitsbeweis.
- Evidenz und Beweisgrenze: Der bestehende
  `ComparisonTermAliasCatalog` bestätigt den Nutzen eines versionierten,
  additiven Katalogs. Die kuratierte Kunden-Excel und eine Wortliste beweisen
  keine vollständige Themenmenge.
- Systembezug: Retrieval, Fachmodell, Tests und Wartbarkeit; stützt `ADR-003`
  und `ADR-005`, darf `INV-002` und `INV-003` nicht verletzen.
- Beziehungen:
  - verfeinert -> `ADR-003`, `ADR-005`
  - hängt_ab_von -> fachlich bestätigten Vergleichspunkten und Golden Cases
  - stützt -> `INT-20260824-003`, `INT-20260824-006`
- Spezialistenurteil: Als `TargetSpec` mit Konzept-ID, starken und schwachen
  Aliasen, OCR-/Trennvarianten, erlaubten Rollen und Werttypen,
  Konfliktrollen, Strukturregeln, Katalogversion und positiven/negativen
  Golden Cases sinnvoll. Eine freie Gewichtssumme darf harte Rollen- oder
  Coverage-Gates nicht überstimmen.
- Hard-Gates: `OFFEN` – fachliche Pflegeverantwortung und Katalogumfang fehlen.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `BEOBACHTET_CODE` plus `NUTZERANGABE`.
- Riskanteste Annahme: Dass bekannte Wörter die fachliche Themenwelt
  abschließend beschreiben.
- Nächster Prüfschritt: Einen gemeinsamen TargetSpec für `deductible` und
  `limit` definieren und gegen die dichten Rollenfälle prüfen.
- Entscheidung: begrenzen – als Retrievalvertrag verwenden, niemals als
  Vollständigkeitsgrenze.
- Kanonischer Ausgang:
  [`knowledge-catalogs/water-target-specs.v0.1.json`](./knowledge-catalogs/water-target-specs.v0.1.json)
  als erster begrenzter Pilotvertrag.

## INT-20260824-003 — Occurrence-zentrierte strukturelle Kontextexpansion

- Erfasst: 2026-08-24
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `PROMOTED`
- Aussage: Jede konkrete Erwähnung wird als Offset-gebundener Anker erfasst,
  auf ihren kleinsten vollständigen Klauselkontext erweitert und anschließend
  getrennt nach Rolle, Betrag, Bedingung, Ausschluss und Quelle ausgewertet.
- Ist-Wahrheit: `NEIN` als vollständige Implementierungsbehauptung – der
  Selbstbehaltpfad ist block-zentriert teilweise umgesetzt; echte stabile
  Occurrence-Spans und ein allgemeiner Context Resolver fehlen.
- Quelle: Nutzerinput und überprüfte Codex-Voranalyse vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: nicht nur Wörter finden,
  sondern belegte, fachlich korrekt verbundene Klauselfakten ausgeben.
- Scope und ausdrückliche Nicht-Ziele: strukturadaptive Expansion; kein starres
  `±500 Wörter`, kein pauschales Seitenfenster und kein LLM-Vollinventar.
- Evidenz und Beweisgrenze: [quanteda KWIC](https://quanteda.io/reference/kwic.html)
  bestätigt Keyword-Kontextfenster als Diagnoseprinzip. Es modelliert keine
  Klausel-, Tabellen-, Varianten- oder Rollenbeziehungen. Der aktuelle Code
  enumeriert FTS-Trefferblöcke, aber noch keine einzelnen Match-Offsets.
- Systembezug: `ComparisonClauseBlockIndex`, Context-Aufbau,
  `ComparisonDeterministicFactExtractor`, Targeted Retriever, Fakten- und
  Evidenzpersistenz; entspricht `ADR-003`, `ADR-004`, `ADR-007` und `ADR-015`.
- Beziehungen:
  - stützt -> `INT-20260824-001`
  - hängt_ab_von -> `INT-20260824-002`, `INT-20260824-004`
  - widerspricht -> fixer `±500 Wörter`-Kontext als fachliche Primärgrenze
  - prüft -> `FAIL-003`
- Spezialistenurteil: KWIC ist eine passende Bezeichnung für die Trefferansicht.
  Die fachliche Pipeline muss `Occurrence -> Segment/Zelle -> Clause -> belegte
Tabellen-/Fortsetzungsrelation -> Heading/Variante` folgen; ein kleines
  Wortfenster bleibt nur UI-/Diagnoseausschnitt oder Sicherheits-Fallback.
- Hard-Gates: `BEGRENZT` – architektonisch akzeptiert, Implementierung und
  Realstrukturabnahme noch offen.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `BEOBACHTET_CODE`, `NUTZERANGABE` und bestehende ADRs.
- Riskanteste Annahme: Dass Blocknähe bereits eine fachliche Relation beweist.
- Nächster Prüfschritt: FTS-Blocktreffer in eindeutige Occurrences mit
  Originaloffsets zerlegen und den `EUR 350`-/`EUR 20.000`-Fall daran prüfen.
- Entscheidung: akzeptieren mit strukturgebundener statt fixer Expansion.
- Kanonischer Ausgang:
  [ADR-003](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-003-occurrence-zentrierter-pfad-für-konkrete-exhaustive-fragen),
  [ADR-004](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-004-clause-struktur-statt-seitenfenster-als-primärer-kontext)
  und [ADR-015](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-015-exhaustive-selbstbehalt-abfrage-vor-dem-vollinventar).

## INT-20260824-004 — Dokumentfluss als typisierter Relationsgraph

- Erfasst: 2026-08-24
- Typ: `IDEE`
- Status: `IN_PRÜFUNG`
- Aussage: Unterschiedliche Dokumentcharakteristiken brauchen typisierte
  Beziehungen zwischen Klauselabschnitten, Überschriften, Tabellen,
  Seitenfortsetzungen, Varianten und Querverweisen.
- Ist-Wahrheit: `NEIN` – Reihenfolge, Heading-Pfad und Layoutart existieren,
  aber noch kein belastbarer Relationsgraph.
- Quelle: paraphrasierter Nutzerinput vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: zu einem Suchpunkt auch
  fachlich zugehörige vorherige, nachfolgende oder referenzierte Stellen
  erfassen, ohne fremden Kontext zu übernehmen.
- Scope und ausdrückliche Nicht-Ziele: kleiner typisierter Kontextgraph auf
  bestehenden Clause Blocks; kein vorschnelles allgemeines GraphRAG-System.
- Evidenz und Beweisgrenze: Der aktuelle Builder beginnt den Heading-Pfad pro
  Seite neu und erzeugt nur 240 Zeichen Nachbarkontext auf derselben Seite.
  Das Blockschema besitzt Ordinal und Heading-Pfad, aber keine expliziten
  Fortsetzungs-, Tabellen-, Varianten- oder Referenzkanten.
- Systembezug: Collector/Layout, Clause Builder, Ledger/Persistenz,
  Context Resolver, Rollenbindung und Tests; verfeinert `ADR-004`.
- Beziehungen:
  - stützt -> `INT-20260824-003`, `INT-20260824-006`
  - prüft -> `FAIL-003`
  - hängt_ab_von -> Qualität der Layoutdaten und anonymisierten
    Realstrukturfixtures
- Spezialistenurteil: Benötigte Kanten sind mindestens `under_heading`,
  `continues_on`, `table_cell_under`, `in_variant`, `references` und
  `next_sibling`. Nur belegte Strukturkanten dürfen Werte attribuieren;
  Nachbarschaft darf sonst lediglich Anzeigekontext liefern.
- Hard-Gates: `OFFEN` – Tabellengeometrie und Cross-Page-Kontinuität sind an
  echten layouttreuen Strukturen noch nicht bewiesen.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `BEOBACHTET_CODE`, `NUTZERANGABE` und dokumentierte
  Realstrukturmessung.
- Riskanteste Annahme: Dass linearisierter Text ausreichend Struktur für alle
  Relationen enthält.
- Nächster Prüfschritt: Zunächst einen rein im Speicher aufgebauten Graphen an
  Heading-, Tabellen-, Fortsetzungs-, Varianten- und Cross-Reference-Fällen
  testen; erst bei bewiesenem Persistenzbedarf das Schema erweitern.
- Entscheidung: offen.
- Kanonischer Ausgang: noch keiner.

## INT-20260824-005 — Drei Retrievalschichten ergeben 100 Prozent Dokumentverständnis

- Erfasst: 2026-08-24
- Typ: `ANNAHME`
- Status: `GESCHLOSSEN`
- Aussage: Wortmatrix, RAG und occurrence-zentriertes Retrieval zusammen
  würden quasi alle Inhalte beziehungsweise 100 Prozent des Dokuments
  fachlich abdecken.
- Ist-Wahrheit: `NEIN` – diese Kombination kann Prozess- und kontrollierte
  lexikalische Coverage stark erhöhen, aber keine universelle semantische oder
  juristische Vollständigkeit beweisen.
- Quelle: paraphrasierter Nutzerinput vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: die fehlenden relevanten
  Dokumentteile nicht still übersehen.
- Evidenz und Beweisgrenze: Der Realstrukturtest fand alle drei gesuchten
  Selbstbehaltstellen, verband aber Rollen und Beträge falsch. Dinghy liefert
  im aktuellen Targeted-Pfad nur `topN: 16`; Kandidaten außerhalb dieses
  Fensters werden nicht als Overflow sichtbar. OCR-, Tabellen-, Referenz- und
  unbekannte Paraphrasenfehler bleiben zusätzliche Grenzen.
- Systembezug: Qualitätsversprechen, Coverage Manifest, UI, Tests und
  Kundenfreigabe; berührt `INV-002`, `INV-003`, `ADR-006` und `FAIL-003`.
- Beziehungen:
  - hängt_ab_von -> `INT-20260824-003`, `INT-20260824-004`
  - widerspricht -> sichere juristische Vollständigkeitsbehauptung
- Spezialistenurteil: Getrennt messbar sind 100 Prozent kanonische
  Seiten-/Blockverarbeitung, 100 Prozent der versionierten lexikalischen
  Vorkommen, Settlement aller erzeugten Kandidaten und verlustfreie Ausgabe
  aller validierten Fakten. Semantische oder juristische 100 Prozent bleiben
  nicht garantierbar.
- Hard-Gates: `NICHT_BESTANDEN` für die universelle 100-Prozent-Aussage.
- Bewertung: nicht anwendbar; Annahme wurde begrenzt.
- Evidenzqualität: `BEOBACHTET_CODE`, `GEMESSEN_ENTWICKLUNGSUMGEBUNG` und
  bestehende Beweisgrenzen.
- Riskanteste Annahme: Dass Retrieval-Recall mit korrektem Dokumentverständnis
  gleichgesetzt werden kann.
- Nächster Prüfschritt: Ein `CoverageManifest` mit getrennten Zählern und
  sichtbarem `incomplete/unresolved`-Status definieren.
- Entscheidung: begrenzen.
- Kanonischer Ausgang:
  [Qualitätsgrenze](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#3-ehrliche-qualitätsgrenze)
  und [ADR-006](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-006-vollständigkeit-bedeutet-terminale-primärblock-coverage).

## INT-20260824-006 — Generischer Heuristikkern statt Regelkopien je Thema

- Erfasst: 2026-08-24
- Typ: `IDEE`
- Status: `IN_PRÜFUNG`
- Aussage: Möglichst viel soll deterministisch in Code geschehen, ohne für
  jedes Thema einen eigenen, anwachsenden Regel- und Retrieverblock zu bauen.
- Ist-Wahrheit: `NEIN` – der aktuelle Selbstbehaltpfad beweist das Prinzip,
  enthält aber noch duplizierte Alias-/Regex-/Routing- und Ausgabelogik.
- Quelle: paraphrasierter Nutzerinput vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: schnelle, lokale,
  reproduzierbare Ergebnisse mit wenigen Modellaufrufen und konsistenter
  Behandlung vieler Vergleichspunkte.
- Scope und ausdrückliche Nicht-Ziele: generische Verträge für Enumeration,
  Kontext, Rollenbindung, Ambiguität und Coverage; keine abstrakte
  Node-Plattform und keine Heuristikflut.
- Evidenz und Beweisgrenze: FTS, Dinghy, positionierte Signale, Ledger,
  Evidenzgates, Queue und serverseitiges Rendering sind wiederverwendbare
  Grundlagen. Nur der Selbstbehalt ist bisher occurrence-zentriert geroutet.
- Systembezug: Target-Katalog, Occurrence Enumerator, Context Graph, Role Span
  Binder, Semantic Candidate Provider, Ambiguity Resolver, Orchestrator und
  Coverage Manifest.
- Beziehungen:
  - hängt_ab_von -> `INT-20260824-002`, `INT-20260824-003`,
    `INT-20260824-004`
  - prüft -> Erweiterbarkeit nach Selbstbehalt auf Limits
- Spezialistenurteil: Fachvokabular und Rollenkompatibilität deklarativ im
  TargetSpec halten; Algorithmen generisch implementieren. Harte
  Dokument-/Offset-/Rollen-Gates dürfen durch keinen Heuristikscore
  überschrieben werden. Unklarheit endet als `unresolved` oder kleine,
  beleggebundene Modellprüfung.
- Hard-Gates: `OFFEN` – der generische Kern muss erst an zwei unterschiedlichen
  vertikalen Resolvern ohne Regression bewiesen werden.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `BEOBACHTET_CODE` und `NUTZERANGABE`.
- Riskanteste Annahme: Dass eine frühe Generalisierung die fachlichen
  Unterschiede zwischen Selbstbehalt, Limit, Ausschluss und Obliegenheit
  korrekt abbildet.
- Nächster Prüfschritt: Zuerst den dichten Selbstbehalt-/Limit-Rollenfall mit
  einem `ClauseSegmenter` und `RoleSpanBinder` lösen; danach erst einen
  generischen Orchestrator extrahieren.
- Entscheidung: offen.
- Kanonischer Ausgang: noch keiner.

## INT-20260824-007 — Lokale Zielplattform AnythingLLM und LM Studio

- Erfasst: 2026-08-24
- Typ: `ZIEL`
- Status: `PROMOTED`
- Aussage: AnythingLLM bildet die lokale Bedien- und Workflowoberfläche; LM
  Studio stellt die lokalen Modelle für Analyse und Vergleich bereit.
- Ist-Wahrheit: `NEIN` als aktuelle Runtime-Behauptung – dies ist der
  bestätigte Ziel- und Betriebsvertrag. Tatsächlich gestarteter Repo-Pfad,
  Storage, `.env` und Modell-IDs müssen vor Runtime-Aussagen neu geprüft werden.
- Quelle: bestätigter Nutzerinput vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: lokale Verarbeitung der
  sensiblen Versicherungsdokumente in einem verständlichen AnythingLLM-Ablauf.
- Scope und ausdrückliche Nicht-Ziele: lokale Zielplattform; keine neue
  Behauptung über aktuellen Kunden-Mac- oder Releasezustand.
- Evidenz und Beweisgrenze: bestehende Architektur- und Setup-Dokumentation;
  keine neue Runtime-Prüfung in diesem Intake.
- Systembezug: UI, Workflow, LM-Studio-Modelle, Queue, Betrieb und Datenschutz.
- Beziehungen:
  - stützt -> `INT-20260824-008`, `INT-20260824-009`
  - verfeinert -> `INT-20260824-001`
- Spezialistenurteil: Ziel ist eindeutig und mit der bestehenden lokalen
  Systemgrenze vereinbar.
- Hard-Gates: `BEGRENZT` – Ziel bestätigt, tatsächliche Kunden-Runtime offen.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `NUTZERANGABE` plus bestehende Architektur.
- Riskanteste Annahme: Dass Zielkonfiguration und tatsächlich laufende
  Kundenkonfiguration identisch seien.
- Nächster Prüfschritt: Runtime-Zustands-Lock vor jeder Betriebsabnahme.
- Entscheidung: akzeptieren.
- Kanonischer Ausgang:
  [bestätigter Ergebnisvertrag](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#21-bestätigter-ergebnisvertrag-für-den-aktuellen-kunden).

## INT-20260824-008 — Beleggebundene Einzeldokumentanalyse

- Erfasst: 2026-08-24
- Typ: `ZIEL`
- Status: `PROMOTED`
- Aussage: Mit genau einem hochgeladenen Gebäudeversicherungsdokument erhält
  der Kunde eine eigenständige, detaillierte und beleggebundene Analyse.
- Ist-Wahrheit: `NEIN` als Kundenfreigabe – bestätigtes Produktziel, dessen
  breite fachliche Abnahme noch aussteht.
- Quelle: bestätigter Nutzerinput vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Deckungen, versicherte
  Sachen, Definitionen, Limits, Selbstbehalte, Bedingungen, Ausschlüsse,
  Obliegenheiten, Varianten und offene Punkte des Dokuments verstehen.
- Scope und ausdrückliche Nicht-Ziele: Analyse des Vertragsinhalts; ohne
  externen Benchmark keine Behauptung „marktweit gut/schlecht“.
- Evidenz und Beweisgrenze: Produktziel bestätigt; bestehende technische Tests
  beweisen noch keine vollständige fachliche Einzeldokumentabnahme.
- Systembezug: Einzelmodus, vollständiges Clause Ledger, Faktenrollen,
  Provenienz, Coverage Manifest und Ausgabe.
- Beziehungen:
  - hängt_ab_von -> `INT-20260824-002` bis `INT-20260824-006`
  - stützt -> `INT-20260824-001`
- Spezialistenurteil: Eigenständiges Deckungsprofil mit sichtbaren
  Einschränkungen und `unresolved`-Punkten; keine freie LLM-Zusammenfassung als
  einzige Analysegrundlage.
- Hard-Gates: `BEGRENZT` – Ziel klar, fachliche Breitenabnahme offen.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `NUTZERANGABE` und bestehende Projektziele.
- Riskanteste Annahme: Dass „Analyse“ ohne definierte Kategorien und
  Abnahmetiefe bereits eindeutig genug sei.
- Nächster Prüfschritt: Kategorien, sichtbare Tiefe und Golden Cases festlegen.
- Entscheidung: akzeptieren.
- Kanonischer Ausgang:
  [bestätigter Ergebnisvertrag](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#21-bestätigter-ergebnisvertrag-für-den-aktuellen-kunden).

## INT-20260824-009 — Dokumentisolierter A/B-Vergleich mit Detailunterschieden

- Erfasst: 2026-08-24
- Typ: `ZIEL`
- Status: `PROMOTED`
- Aussage: Mit genau zwei hochgeladenen Gebäudeversicherungsdokumenten werden
  beide zunächst separat verstanden und anschließend über korrespondierende
  Vergleichspunkte und Faktrollen detailliert verglichen.
- Ist-Wahrheit: `NEIN` als fachliche Kundenfreigabe – dies ist der bestätigte
  Ergebnisvertrag, nicht der aktuelle breite Implementierungsnachweis.
- Quelle: bestätigter Nutzerinput vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: konkrete Unterschiede,
  Gemeinsamkeiten, Konflikte, offene Evidenz und kriterienbezogene Vor- und
  Nachteile von Vertrag A und B mit Quellen beider Dokumente.
- Scope und ausdrückliche Nicht-Ziele: dokumentisolierte Analyse vor dem Join;
  kein Themen-Dedupe über A/B und kein pauschaler Gewinner ohne Kriterien.
- Evidenz und Beweisgrenze: Produktziel bestätigt; `FAIL-003` zeigt, dass
  richtiges Finden allein noch keinen richtigen Detailvergleich beweist.
- Systembezug: Dokument-/A-B-Isolation, Comparability Gate, Faktenmodell,
  Join/Row Planner, Quellen und Bewertungslogik; berührt `INV-001` bis
  `INV-004`.
- Beziehungen:
  - hängt_ab_von -> `INT-20260824-002` bis `INT-20260824-006`
  - hängt_ab_von -> `INT-20260824-011`
  - prüft -> `FAIL-003`
- Spezialistenurteil: Der Vergleich darf erst nach dokumentisolierter
  Faktbildung joinen. Nicht vergleichbare Dokumentart, Variante, Objekt- oder
  Gültigkeitsscopes bleiben ausdrücklich `nicht vergleichbar`.
- Hard-Gates: `BEGRENZT` – Ziel bestätigt, Vergleichs- und Bewertungsregeln
  noch nicht fachlich abgenommen.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `NUTZERANGABE` und bestehende Invarianten.
- Riskanteste Annahme: Dass gleich benannte Punkte in zwei Verträgen fachlich
  denselben Scope besitzen.
- Nächster Prüfschritt: stabile Vergleichspunkt-IDs und Comparability Gate
  definieren.
- Entscheidung: akzeptieren.
- Kanonischer Ausgang:
  [bestätigter Ergebnisvertrag](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#21-bestätigter-ergebnisvertrag-für-den-aktuellen-kunden).

## INT-20260824-010 — Gebäudeversicherung als aktueller Lieferumfang

- Erfasst: 2026-08-24
- Typ: `ZIEL`
- Status: `PROMOTED`
- Aussage: Einzelanalyse und A/B-Vergleich werden für den aktuellen Kunden im
  Spektrum der Gebäudeversicherung entwickelt und abgenommen.
- Ist-Wahrheit: `NEIN` als vollständige fachliche Lieferfreigabe – der Scope
  ist bestätigt, Kategorien und Abnahmetiefe sind noch offen.
- Quelle: bestätigter Nutzerinput vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: fachlich relevante
  Detailunterschiede innerhalb der Gebäudeversicherung statt eines generischen
  Dokumentenchats.
- Scope und ausdrückliche Nicht-Ziele: aktueller Kunden- und Lieferfokus; keine
  dauerhafte Produktbegrenzung auf diese Sparte.
- Evidenz und Beweisgrenze: Nutzerbestätigung und bestehende Domänenevidenz;
  keine Bestätigung einer geschlossenen Kategorien- oder Vergleichspunktliste.
- Systembezug: Fachkatalog, Golden Cases, Produktumfang und Abnahme.
- Beziehungen:
  - verfeinert -> `INT-20260824-008`, `INT-20260824-009`
  - hängt_ab_von -> offenen Gebäudekategorien und Vergleichspunktdefinitionen
- Spezialistenurteil: Scope ist klar genug für weitere Inputs; Feuer, Sturm,
  Leitungswasser, Glas und Haftpflicht sind vorhandene Referenzbereiche, aber
  noch keine abschließende Taxonomie.
- Hard-Gates: `BEGRENZT` – Fachscope bestätigt, Detailtaxonomie offen.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `NUTZERANGABE` und lokale strukturelle Referenzevidenz.
- Riskanteste Annahme: Dass die vorhandene Excel den gesamten Lieferumfang
  definiert.
- Nächster Prüfschritt: priorisierte Kategorien, Vergleichspunkte und
  Abnahmetiefe bestimmen.
- Entscheidung: akzeptieren.
- Kanonischer Ausgang:
  [Kunden- und Domänenevidenz](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#22-kunden--und-domänenevidenz-gebäudeversicherung).

## INT-20260824-011 — Fachliche Bedeutung von „Vertrag A ist besser“

- Erfasst: 2026-08-24
- Typ: `OFFENE_FRAGE`
- Status: `OFFEN`
- Aussage: Zu klären ist, ob „besser“ nur punktweise anhand des
  Vertragsinhalts oder zusätzlich als profilbasierte Gesamtempfehlung mit
  bestätigten Gebäude-/Risikoprioritäten und Gewichtungen ausgegeben werden
  soll.
- Ist-Wahrheit: `NEIN` – die Bewertungssemantik ist noch nicht vom Benutzer
  beziehungsweise Kunden bestätigt.
- Quelle: notwendige Präzisierung aus dem Nutzerziel vom 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: nachvollziehbare Vorteile
  ohne irreführende universelle Rangliste.
- Scope und ausdrückliche Nicht-Ziele: Vertragsbewertung; nicht mit der
  Strategie-Bewertungsmatrix in Abschnitt 5 dieses Dokuments verwechseln.
- Evidenz und Beweisgrenze: Ohne Kunden-/Gebäudeprofil sind nur
  dimensionsbezogene Aussagen belastbar. Preis/Prämie ist nur bei gleicher
  Summenbasis, Variante, Laufzeit, Steuer und Zahlungsweise vergleichbar.
- Systembezug: Comparability Gate, Bewertungsregeln, UI, Explainability und
  fachliche Freigabe.
- Beziehungen:
  - hängt_ab_von -> `INT-20260824-009`
  - verfeinert -> `INT-20260824-001`
- Spezialistenurteil: Sichere Arbeitsannahme ist eine punktweise Bewertung ohne
  Gesamtsieger. Pro Punkt werden `Vorteil A`, `Vorteil B`, `gleichwertig`,
  `nicht vergleichbar` oder `unklar/unresolved` ausgegeben.
- Hard-Gates: `OFFEN` – Gesamtwertung ist bis zur Bestätigung nicht zulässig.
- Bewertung: noch nicht bewertet.
- Evidenzqualität: `ANNAHME` aus fachlicher Gegenprüfung.
- Riskanteste Annahme: Dass ein allgemeines Vertragsranking ohne individuelles
  Risikoprofil fachlich sinnvoll sei.
- Nächster Prüfschritt: Nutzer beziehungsweise Kunde bestätigt punktweise
  Bewertung oder zusätzliche profilbasierte Gesamtempfehlung.
- Entscheidung: sichere Arbeitsannahme punktweise; fachliche Bestätigung offen.
- Kanonischer Ausgang:
  [bestätigter Ergebnisvertrag](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#21-bestätigter-ergebnisvertrag-für-den-aktuellen-kunden).

## INT-20260824-012 — Claude-Prüfkatalog als fachlicher Taxonomie-Seed

- Erfasst: 2026-08-24
- Typ: `EVIDENZHINWEIS`
- Status: `IN_PRÜFUNG`
- Aussage: Ein geteilter Claude-Verlauf enthält einen umfangreichen Kandidatenkatalog
  für WEG-Gebäudeversicherungen. Die ausgebaute Fassung umfasst 202
  Tabellenpunkte: 190 fachliche Vergleichs-/Intake-Kandidaten und 12
  unvalidierte Broker-Regelkandidaten. Sie verteilen sich auf
  Objekt-/Vertragsgrunddaten, Versicherungssumme/Bewertung,
  Feuer, Leitungswasser, Sturm/Hagel/Schneedruck, Elementar/Zusatzrisiken,
  Haus-/Grundbesitzerhaftpflicht, Vertrag/Obliegenheiten, WEG-Abgrenzung und
  pauschalen roten Flaggen.
- Ist-Wahrheit: `NEIN` – Quelle ist ein KI-generierter Chat ohne sichtbare
  fachliche Abnahme. Im geteilten Snapshot möglicherweise vorhandene Anhänge
  oder Zusatzdaten waren nicht sichtbar.
- Quelle: paraphrasierter, öffentlich geteilter Claude-Chat, vom Benutzer am 24. August 2026 zur Gegenprüfung übermittelt.
- Gewünschter Kundennutzen und sichtbares Ergebnis: breiter Startpunkt für die
  gewünschten 250 bis 500 Detailpunkte und ein strukturierter Broker-Review.
- Scope und ausdrückliche Nicht-Ziele: Kandidaten-Backlog; keine geschlossene
  Taxonomie, keine Marktstandards, keine verbindlichen Mindestwerte und keine
  automatischen Ausschlussregeln.
- Evidenz und Beweisgrenze: Die Themen überschneiden sich stark mit der lokalen
  Vergleichs-Excel und dem bestätigten Gebäudeversicherungsscope. Der Katalog
  mischt jedoch Dokumentfakten, Objekt-/Kundenfragen, externe Risikodaten,
  Rechtsfragen und unbelegte normative Zielwerte. Mehrfach vorkommende Themen
  wie PV, Selbstbehalt oder Rückstau sind keine unabhängigen atomaren Fakten.
- Systembezug: TargetSpec, Vergleichspunkt-Ontologie, Kundenintake,
  Fach-Golden-Cases und Ergebnisdarstellung; verfeinert `INT-20260824-010`.
- Beziehungen:
  - stützt -> `INT-20260824-002`, `INT-20260824-008`, `INT-20260824-009`
  - hängt_ab_von -> Maklerfreigabe, Objekt-/Variantenscope und stabiler
    Vergleichspunktdefinition
  - widerspricht -> Verwendung einer KI-Liste als vollständige Wahrheit
- Spezialistenurteil: Die Kategorien und Punkte übernehmen wir als versionierten
  Kandidaten-Pool. Vor technischer Verwendung werden sie in
  `Dokument-extrahierbar`, `extern zu erheben`, `kundenprofilabhängig` und
  `rechtlich/fachlich zu validieren` klassifiziert, atomisiert und
  dedupliziert. Zielwerte wie Mindestlimits oder Laufzeiten bleiben außerhalb
  der Faktenextraktion, bis sie fachlich und zeitlich versioniert freigegeben
  sind.
- Hard-Gates: `BEGRENZT` – Kundennutzen hoch, fachliche Autorität und
  Vollständigkeit nicht belegt.
- Bewertung: als Taxonomie-Seed sinnvoll; als Bewertungsstandard abgelehnt.
- Evidenzqualität: `EVIDENZHINWEIS` aus nicht unabhängig validiertem KI-Chat.
- Riskanteste Annahme: Dass Umfang und Detailreichtum fachliche Richtigkeit oder
  Vollständigkeit ersetzen.
- Nächster Prüfschritt: Alle 202 Punkte normalisieren und zunächst die
  Leitungswasser-Kandidaten mit Makler, Referenz-Excel und anonymisierten
  Dokumentstrukturen abgleichen.
- Entscheidung: begrenzen und als Arbeitsmaterial übernehmen.
- Kanonischer Ausgang:
  [`knowledge-catalogs/building-insurance-claude-seed.v0.1.json`](./knowledge-catalogs/building-insurance-claude-seed.v0.1.json)
  mit 190 Vergleichs-/Intake-Kandidaten und 12 getrennten
  Broker-Regelkandidaten; weiterhin unvalidierter Seed.

## INT-20260824-013 — Dokumentisolierte Analyse je Kategorie vor dem A/B-Join

- Erfasst: 2026-08-24
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `IN_PRÜFUNG`
- Aussage: Jedes Dokument wird zunächst isoliert und fachbereichsweise
  analysiert; erst normalisierte Fakten von A und B werden verglichen.
- Ist-Wahrheit: `TEILWEISE` – Dokumentisolation und der spätere serverseitige
  Join sind bereits Ziel und Invariante. Eine zwingende Folge manueller
  Kategorieprompts ist nicht Teil des Produkts.
- Quelle: paraphrasierter Partner-/Claude-Vorschlag aus dem geteilten Chat.
- Gewünschter Kundennutzen und sichtbares Ergebnis: keine Vermischung von A und
  B, nachvollziehbare Kategorieergebnisse und ein stabiler Gesamtvergleich.
- Scope und ausdrückliche Nicht-Ziele: interne Orchestrierung; der Kunde soll
  nicht 16 bis 64 Läufe starten, Dateien manuell zusammenführen oder technische
  Kategorien auswählen müssen.
- Evidenz und Beweisgrenze: Entspricht `INT-20260824-009`, `ADR-012` und der
  Dokument-/Variantenscope-Invariante. Eine Kategorie ist jedoch keine sichere
  Kontextgrenze; Querverweise und allgemeine Bedingungen können mehrere
  Fachbereiche betreffen.
- Systembezug: Workflow-Router, Clause Ledger, TargetSpec, Faktenpersistenz,
  A/B-Join, UI und Recovery.
- Beziehungen:
  - stützt -> `INT-20260824-008`, `INT-20260824-009`
  - hängt_ab_von -> `INT-20260824-004`, Comparability Gate und atomarem
    Faktenmodell
  - widerspricht -> manuelle Kategorie- und Dateizusammenführung als
    Produktvoraussetzung
- Spezialistenurteil: Dokumentisolation übernehmen. Kategorien dienen als
  fachliche Views und Arbeitsbatches, nicht als harte Dokumentgrenzen.
  Allgemeine Klauseln, Definitionen und Querverweise müssen über typisierte
  Relationen in jeden betroffenen Vergleichspunkt einfließen.
- Hard-Gates: `BESTANDEN` für Isolation; `NICHT_BESTANDEN` für den manuellen
  Benutzerworkflow.
- Bewertung: akzeptieren mit interner, checkpointbarer Orchestrierung.
- Evidenzqualität: `NUTZERANGABE` plus akzeptierte Architekturverträge.
- Riskanteste Annahme: Dass dieselbe Kategorienstruktur in jedem Dokument
  explizit vorhanden sei.
- Nächster Prüfschritt: Workflow-Vertrag `ein Dokument -> Faktenunion ->
Kategorieviews -> A/B-Join` definieren, ohne zusätzliche Benutzeraktion.
- Entscheidung: Kern übernehmen, manuelle Ausprägung verwerfen.
- Kanonischer Ausgang: nach Bestätigung Zielarchitektur/ADR.

## INT-20260824-014 — Stabile Prüfpunkt-IDs und beleggebundener Extraktionsvertrag

- Erfasst: 2026-08-24
- Typ: `IDEE`
- Status: `IN_PRÜFUNG`
- Aussage: Versionierte Prüfpunkt-IDs bilden den stabilen Merge-Schlüssel;
  positive Aussagen benötigen eine kanonische Quelle und Evidenz. Fehlende
  Evidenz bleibt ein sichtbarer Ergebniszustand.
- Ist-Wahrheit: `TEILWEISE` – stabile Fact-/Row-IDs und Evidenzgates existieren;
  ein fachlicher Katalog stabiler Vergleichspunkt-IDs fehlt noch.
- Quelle: paraphrasierter Claude-Vorschlag mit TSV-Spalten für Status, Wert,
  Selbstbehalt, Bedingung, Fundstelle, Zitat und Konfidenz.
- Gewünschter Kundennutzen und sichtbares Ergebnis: reproduzierbare
  Vollständigkeitsprüfung je bekannter Frage und verlustfreier A/B-Merge.
- Scope und ausdrückliche Nicht-Ziele: ID und Sollrollen je Vergleichspunkt;
  nicht exakt eine Ergebniszeile und nicht genau ein Fakt pro Prüfpunkt.
- Evidenz und Beweisgrenze: `ADR-007` verlangt ein mehrwertiges Faktmodell.
  `JA/NEIN/TEILWEISE/NICHT_GEFUNDEN` vermischt Deckung, Ausschluss, Bedingung
  und Evidenzstatus. Ein Zitatlimit von 25 Wörtern kann entscheidende
  Qualifier abschneiden; Markdown-Zeilen sind keine kanonischen Seiten.
- Systembezug: TargetSpec, Faktenrollen, Evidence Spans, Coverage Manifest,
  Row Planner und Export.
- Beziehungen:
  - verfeinert -> `INT-20260824-002`, `ADR-007`, `ADR-012`
  - stützt -> `INT-20260824-013`, `INT-20260824-016`
  - widerspricht -> ein Skalarstatus oder eine Zeile als vollständiges
    Vertragsverständnis
- Spezialistenurteil: IDs, erwartete Rollen, Werttypen und Belegpflicht
  übernehmen. Deckung, Ausschluss, Limit, Selbstbehalt, Bedingung,
  Obliegenheit, Scope und Evidenzstatus bleiben getrennt. Pro Vergleichspunkt
  sind null bis viele Fakten zulässig. Kurzzitate sind nur Anzeigeauszüge;
  gespeichert werden exakte Offsets, minimal vollständiger Klauselkontext und
  physische PageMap-Seite.
- Hard-Gates: `BEGRENZT` – die vorgeschlagene flache Tabelle verletzt in
  unveränderter Form Faktkontrolle und Provenienz.
- Bewertung: struktureller Kern hoch, konkrete TSV-Semantik zu ersetzen.
- Evidenzqualität: bestehende ADRs plus `EVIDENZHINWEIS` aus Claude-Chat.
- Riskanteste Annahme: Dass ein Vergleichspunkt genau eine eindeutige
  Vertragsantwort besitzt.
- Nächster Prüfschritt: TargetSpec-Schema und Ergebniszustände an den
  Vandalismus- und Selbstbehalt/Limit-Golden-Cases modellieren.
- Entscheidung: Kern übernehmen, flaches Ein-Zeilen-Schema verwerfen.
- Kanonischer Ausgang:
  [`knowledge-catalogs/README.md`](./knowledge-catalogs/README.md),
  [`knowledge-catalogs/building-insurance-claude-seed.v0.1.json`](./knowledge-catalogs/building-insurance-claude-seed.v0.1.json),
  [`knowledge-catalogs/water-target-specs.v0.1.json`](./knowledge-catalogs/water-target-specs.v0.1.json)
  und
  [`knowledge-catalogs/broker-rule-contract.v0.1.schema.json`](./knowledge-catalogs/broker-rule-contract.v0.1.schema.json).

## INT-20260824-015 — Serielle LLM-Batches mit LLM-Selbstverifikation

- Erfasst: 2026-08-24
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `GESCHLOSSEN`
- Aussage: Ein lokales Qwen prüft je Dokument, Kategorie und Batch zehn bis
  zwölf vorgegebene IDs, erzeugt die Extraktionszeilen und kontrolliert sie in
  einem zweiten Modelllauf. Für zwei Dokumente wurden ungefähr 64 Aufrufe und
  drei bis vier Stunden Laufzeit geschätzt.
- Ist-Wahrheit: `NEIN` – Vorschlag und ungemessene Schätzung; kein Nachweis auf
  der aktuellen Kunden-Runtime.
- Quelle: paraphrasierter Claude-Vorschlag aus dem geteilten Chat.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Drift langer Ausgaben
  begrenzen und jeden Prüfpunkt explizit abarbeiten.
- Scope und ausdrückliche Nicht-Ziele: höchstens Eval-Baseline oder kleine
  Ambiguitätsgruppen; kein normaler Produktions- oder Antwortpfad.
- Evidenz und Beweisgrenze: `FAIL-001` hat die Root Cause eines seriellen
  generativen Vollinventars bereits gemessen und verworfen. Ein zweiter Lauf
  desselben Modells ist keine unabhängige fachliche Prüfung. Wörtliche
  Zitatexistenz kann Code exakter prüfen; Rollenfehler wie `FAIL-003` können in
  beiden Läufen gleich bleiben. Im vorgeschlagenen Kernprompt steht zudem der
  je Batch wechselnde Prüfpunktblock vor dem wiederholten Dokumenttext; ein
  übliches Prefix-/KV-Cache kann dadurch gerade den großen Dokumentteil nicht
  als gemeinsamen Präfix wiederverwenden.
- Systembezug: LLM-Queue, Laufzeit, Recovery, Extraktion, Evidenzvalidierung,
  Nutzerworkflow und Kundenfreigabe.
- Beziehungen:
  - widerspricht -> `ADR-002`, `ADR-005`, `ADR-009`, `ADR-012`, `ADR-013`
  - prüft -> `FAIL-001`, `FAIL-003`
  - hängt_ab_von -> kleiner, beleggebundener Ambiguitätsrestmenge
- Spezialistenurteil: Zehn bis zwölf IDs können ein nützlicher Eval-Batch sein.
  In Produktion enumeriert und plant der Server alle Kandidaten und Rows;
  deterministischer Code löst Beleg- und Rollenfälle, Qwen erhält nur eng
  begrenzte ungelöste Gruppen oder formuliert feste Fakten.
- Hard-Gates: `NICHT_BESTANDEN` als Hauptpfad wegen serverseitiger
  Faktkontrolle, Laufzeit und Benutzerworkflow.
- Bewertung: Produktionsrichtung verwerfen; als Vergleichsbaseline begrenzt
  zulässig.
- Evidenzqualität: `EVIDENZHINWEIS`; entgegenstehende reale Messung in
  `FAIL-001` ist stärker.
- Riskanteste Annahme: Dass Prompt-Caching und kleinere Ausgaben die lineare
  Zahl notwendiger Modellaufrufe als Root Cause lösen.
- Nächster Prüfschritt: Kein Produktionsbau. Falls benötigt, exakt denselben
  anonymisierten Leitungswasser-Batch als Offline-Baseline gegen den
  occurrence-zentrierten Pfad messen.
- Entscheidung: als Produktionspfad verwerfen.
- Kanonischer Ausgang: [ADR-002](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-002-kein-großes-generatives-vollinventar-im-kritischen-pfad).

## INT-20260824-016 — Deterministischer Vergleich und pauschales Punkteschema

- Erfasst: 2026-08-24
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `IN_PRÜFUNG`
- Aussage: Der A/B-Vergleich soll aus normalisierten Fakten deterministisch
  entstehen; der Chat schlägt zusätzlich Statuspunkte `JA=3`,
  `TEILWEISE=2`, `NEIN=0`, Gewichte und Limitvergleiche in Excel vor.
- Ist-Wahrheit: `TEILWEISE` – deterministische serverseitige Row-Planung ist
  akzeptiert. Das konkrete Score- und Gewichtungsschema ist weder fachlich
  freigegeben noch ausreichend scopesensitiv.
- Quelle: paraphrasierter Claude-Vorschlag aus dem geteilten Chat.
- Gewünschter Kundennutzen und sichtbares Ergebnis: nachvollziehbare Spalten
  für Vorteil A/B, Gleichstand, Unklarheit, rote Flaggen und Rückfragen.
- Scope und ausdrückliche Nicht-Ziele: deterministische Regeln auf typisierten,
  vergleichbaren Fakten; kein universeller Gesamtsieger und kein Excel als
  Autorität des Produkts.
- Evidenz und Beweisgrenze: `INT-20260824-011` lässt nur punktweise Wertung als
  sichere Arbeitsannahme zu. Gleicher Status bedeutet nicht Gleichwertigkeit;
  Beträge sind nur bei gleicher Rolle, Währung, Basis, Periode, Aggregation,
  Variante und Objekt vergleichbar. `TEILWEISE` kann Limit, Ausschluss oder
  Obliegenheit nicht als eine Qualitätsstufe abbilden.
- Systembezug: Comparability Gate, Typed Fact Join, Bewertungsregeln, UI,
  Explainability und optionaler Excel-Export.
- Beziehungen:
  - stützt -> `INT-20260824-009`, `ADR-012`
  - hängt_ab_von -> `INT-20260824-011`, `INT-20260824-014`
  - widerspricht -> versteckte Universalgewichte und pauschales Ranking
- Spezialistenurteil: Deterministischen Join, feste Ergebniszustände und
  transparente Regelbegründungen übernehmen. Excel/TSV ist ein optionales
  Exportformat. Profilgewichte bleiben ausgeschaltet, bis Kunde und Makler sie
  ausdrücklich bestätigen; selbst dann mit Scope- und Sensitivitätsanzeige.
- Hard-Gates: `BESTANDEN` für deterministischen Join; `NICHT_BESTANDEN` für
  das pauschale Scoremodell.
- Bewertung: Kern übernehmen, konkrete Punkteformeln verwerfen.
- Evidenzqualität: akzeptierte ADRs plus offener Nutzerentscheid.
- Riskanteste Annahme: Dass höhere Zahl oder `JA` unabhängig von Bedingungen,
  Prämie und Risikoprofil immer besser bedeutet.
- Nächster Prüfschritt: Comparability Gate und regelbasierte Punkturteile an
  mehreren Rollen-/Variantenfällen spezifizieren.
- Entscheidung: begrenzen.
- Kanonischer Ausgang: noch keiner.

## INT-20260824-017 — Generatives Inhaltsverzeichnis mit Markdown-Zeilenreferenzen

- Erfasst: 2026-08-24
- Typ: `IDEE`
- Status: `GESCHLOSSEN`
- Aussage: Qwen erzeugt aus der 200-seitigen Markdown-Datei ein
  Inhaltsverzeichnis mit Start-/Endzeilen und Themenlabels, das anschließend
  die relevanten Dokumentteile auswählt.
- Ist-Wahrheit: `NEIN` – Vorschlag; keine Abnahme auf den Dokumenten.
- Quelle: paraphrasierter Claude-Vorschlag aus dem geteilten Chat.
- Gewünschter Kundennutzen und sichtbares Ergebnis: lange Dokumente in kleinere
  fachliche Kontexte zerlegen.
- Scope und ausdrückliche Nicht-Ziele: optionaler Navigationshinweis; keine
  kanonische Struktur, Provenienz oder Coverage-Grenze.
- Evidenz und Beweisgrenze: Ein generatives Inhaltsverzeichnis kann Abschnitte
  oder Querverweise auslassen. Markdown-Zeilennummern sind nach
  Aufbereitungsänderungen instabil und ersetzen weder Source Hash, PageMap,
  Clause Blocks noch exakte Offsets.
- Systembezug: Collector, PageMap, Clause Ledger, Context Graph, Retrieval und
  Provenienz.
- Beziehungen:
  - widerspricht -> `INV-001`, `INV-003`, `ADR-001`, `ADR-004`
  - hängt_ab_von -> deterministisch erfasstem Layout und Heading-Pfad
- Spezialistenurteil: Der vorhandene kanonische Collector-/Ledger-Pfad bleibt
  Autorität. Ein Modell darf Überschriften oder Themen als additive Kandidaten
  annotieren, aber nie entscheiden, welche Dokumentteile überhaupt verarbeitet
  werden.
- Hard-Gates: `NICHT_BESTANDEN` als Retrievalbasis; `BEGRENZT` als
  Navigationshilfe.
- Bewertung: vorgeschlagene Hauptrolle verwerfen.
- Evidenzqualität: `EVIDENZHINWEIS` ohne Messung.
- Riskanteste Annahme: Dass ein plausibles Inhaltsverzeichnis lückenlos ist.
- Nächster Prüfschritt: keiner als Hauptpfad; Strukturverbesserungen am
  deterministischen Context Graph prüfen.
- Entscheidung: begrenzen auf additive Annotation.
- Kanonischer Ausgang: [ADR-001](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-001-basisindex-und-faktenanalyse-sind-getrennte-phasen) und [ADR-004](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-004-clause-struktur-statt-seitenfenster-als-primärer-kontext).

## INT-20260824-018 — Qwen-3.8-Konfiguration und 32-GB-Laufzeitannahmen

- Erfasst: 2026-08-24
- Typ: `EVIDENZHINWEIS`
- Status: `IN_PRÜFUNG`
- Aussage: Der Chat korrigiert das Modell auf Qwen 3.8 27B, nennt 262.144
  native Kontexttokens, `xhigh` als Standard-Reasoning und empfiehlt für die
  Extraktion abweichend vom Hersteller `temperature=0.3`,
  `reasoning_effort=medium/low`, Q4 sowie kleine Kontexte. Er schätzt zwei bis
  vier Minuten je Aufruf und drei bis vier Stunden Gesamtzeit.
- Ist-Wahrheit: `TEILWEISE` – Modell, nativer Kontext und Reasoning-Stufen sind
  durch die offizielle Modellkarte gestützt. Speicher-, Token/s-,
  Temperaturqualitäts- und Laufzeitaussagen sind für unsere LM-Studio-Version,
  Quantisierung und den M2 Max nicht belegt.
- Quelle: Claude-Chat plus offizielle Qwen-Modellkarte und LM-Studio-Dokumentation,
  geprüft am 24. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: stabiler lokaler Betrieb
  ohne Kontextüberlauf, Drift oder unnötig lange Thinking-Ausgaben.
- Scope und ausdrückliche Nicht-Ziele: Eval-Parameter; keine Übernahme von
  Communityschätzungen oder `sysctl`-Änderungen in den Betriebsvertrag.
- Evidenz und Beweisgrenze: Die offizielle Qwen-Karte empfiehlt im Thinking-
  Modus andere Samplingwerte als der Chat. LM Studio kann Speicher vor dem
  Laden mit Kontextlänge schätzen. Die vorhandene KB hat Qwen 4-bit am
  Kunden-Mac mit 32.768 Kontext als Vertrag und reale Ressourcenregeln; sie
  beweist noch keine Extraktionsqualität von `low` gegen `medium`.
- Systembezug: LM-Studio-Load-Vertrag, Queue, Context Budget, Modellprofil,
  Evals und Setup.
- Beziehungen:
  - verfeinert -> `ADR-009`, `ADR-010`
  - hängt_ab_von -> tatsächlicher LM-Studio-Runtime, Quant und Modellidentifier
  - widerspricht -> beworbenes Maximalfenster als praktisch verfügbares
    Kundenfenster
- Spezialistenurteil: Aktuellen 32K-Vertrag beibehalten, bis `lms load
--estimate-only` und reale A/B-Läufe mehr belegen. `medium` und `low` sowie
  Samplingprofile werden auf identischen Golden Cases nach Korrektheit,
  Evidence Coverage, Laufzeit und Speicher verglichen. Keine ungemessene
  Systemtuning-Anweisung übernehmen.
- Hard-Gates: `OFFEN` – reale Kundenhardware-Eval fehlt.
- Bewertung: als Testhypothese übernehmen, nicht als Setupwahrheit.
- Evidenzqualität: offizielle Primärquelle für Modellfähigkeiten;
  `ANNAHME` für lokale Qualität und Laufzeit.
- Riskanteste Annahme: Dass Hersteller-Kontext und Modellbenchmarks die
  nutzbare lokale Extraktionsqualität vorhersagen.
- Nächster Prüfschritt: tatsächliche Modell-ID, Engine-Version, Quantisierung,
  Kontext, Speicherestimate und Golden-Case-Messung erfassen.
- Entscheidung: begrenzen und messen.
- Kanonischer Ausgang: noch keiner.

## INT-20260824-019 — Leitungswasser als erster breiter Kategorienpilot

- Erfasst: 2026-08-24
- Typ: `IDEE`
- Status: `IN_PRÜFUNG`
- Aussage: Leitungswasser eignet sich wegen Innen-/Außenabgrenzung,
  Rohrbruch/Folgeschaden, Such-/Wiederherstellungskosten, Altersabzug,
  Rückstau und Obliegenheiten als anspruchsvoller erster Kategorienpilot.
- Ist-Wahrheit: `NEIN` – plausible Pilotwahl, noch keine priorisierte
  Kundenentscheidung oder gemessene Abnahme.
- Quelle: paraphrasierter Claude-Vorschlag aus dem geteilten Chat.
- Gewünschter Kundennutzen und sichtbares Ergebnis: eine fachlich anspruchsvolle
  Demo, die mehr beweist als ein einfacher Feuerfall.
- Scope und ausdrückliche Nicht-Ziele: vertikaler Breitenpilot; kein Beweis für
  alle 202 oder 250 bis 500 Vergleichspunkte.
- Evidenz und Beweisgrenze: Die lokale Referenz-Excel enthält Leitungswasser in
  mehreren Deckungsstufen. `FAIL-003` ist seit 25. August 2026 synthetisch
  regressionsgeprüft, aber noch nicht am 21-Seiten-Fall oder an der
  Original-PDF-Struktur nachgewiesen.
- Systembezug: TargetSpec, Context Graph, Role Span Binder, Comparability Gate,
  Golden Cases, Laufzeit und UI.
- Beziehungen:
  - stützt -> `INT-20260824-006`, `INT-20260824-010`, `INT-20260824-012`
  - hängt_ab_von -> bestandenem `FAIL-003`-Realstruktur-Gate und
    Maklerpriorität
- Spezialistenurteil: Gute zweite Vertikale nach Selbstbehalt/Limit-Rollenbindung.
  Pilot muss positive, ausgeschlossene, bedingte, fehlende, referenzierte,
  variantenabhängige und tabellarische Fälle enthalten.
- Hard-Gates: `OFFEN` – 25 Sollfallklassen und technische Abbruchgrenzen sind
  versioniert, aber die konkreten Fixtures, fachliche Freigabe und
  Realstruktur-Abnahme fehlen.
- Bewertung: sinnvoller Pilotkandidat, nicht sofortige Produktionszusage.
- Evidenzqualität: `EVIDENZHINWEIS` plus lokale strukturelle Referenzevidenz.
- Riskanteste Annahme: Dass Erfolg in einer Kategorie auf alle anderen Rollen
  und Dokumentstrukturen generalisiert.
- Nächster Prüfschritt: Priorität mit Kunde/Makler bestätigen, die 25 Klassen
  in konkrete synthetische Fixtures überführen und nach dem
  Rollenbinder-Realstruktur-Gate ausführen.
- Entscheidung: Pilot vorbereiten; Produktionszusage weiter zurückstellen.
- Kanonischer Ausgang:
  [`knowledge-catalogs/water-target-specs.v0.1.json`](./knowledge-catalogs/water-target-specs.v0.1.json)
  und
  [`knowledge-catalogs/water-golden-case-classes.v0.1.json`](./knowledge-catalogs/water-golden-case-classes.v0.1.json).

## INT-20260825-020 — Analysephase vor sauberem Neuimplementierungsbranch

- Erfasst: 2026-08-25
- Typ: `ZIEL`
- Status: `PROMOTED`
- Aussage: Der aktuelle Stand ist nicht verwendbar und der bestehende Branch
  enthält zu viele Änderungen, um sicher zu wissen, was funktioniert. Weitere
  Produktimplementierung ist deshalb vorerst gestoppt. Zuerst werden Wissen,
  Tests, Gegenargumente und Architekturvarianten gesammelt, bis ein logisch
  nachvollziehbarer Plan vorliegt. Erst danach soll auf einem neuen Branch von
  einer bewusst gewählten sauberen Baseline implementiert werden.
- Ist-Wahrheit: `JA` – vom Benutzer ausdrücklich als gewünschte Arbeitsweise
  bestätigt; die versehentlich begonnene Rollenbinder-Implementierung wurde
  aus dem bestehenden Branch wieder entfernt.
- Quelle: direkte Nutzerkorrektur vom 25. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: eine nachvollziehbare,
  prüfbare Zielarchitektur, bei der spätere Implementierung einem entschiedenen
  Plan folgt und Altlasten nicht unbemerkt übernommen werden.
- Scope und ausdrückliche Nicht-Ziele: Analyse, Wissensaufnahme, Testdesign,
  Falsifikation, Entscheidungsunterlagen und Baseline-Vergleich. Noch keine
  Produktcode-, Schema-, Migrations- oder Runtimeänderung. Der später auf
  Nutzerwunsch vorbereitete Branch bleibt währenddessen unverändert.
- Evidenz und Beweisgrenze: Der bestehende Branch enthält nachweislich
  wertvolle Experimente, aber der aktuelle Produktstand ist nicht
  kundenverwendbar. Daraus folgt nicht automatisch, dass alles neu geschrieben
  werden muss; die spätere Übernahmeentscheidung bleibt komponentenweise offen.
- Systembezug: gesamter Produktpfad, Git-/Releaseprozess, Teststrategie,
  Wissenssystem und Implementierungsplanung.
- Beziehungen:
  - verfeinert -> `INT-20260824-001`
  - begrenzt -> alle offenen Implementierungskandidaten
  - hängt_ab_von -> vollständigem Decision-Gate und gewählter Git-Baseline
  - prüft -> welche Teile aus `FAIL-001` bis `FAIL-003` nur Learning, Testidee
    oder wiederverwendbarer Code sind
- Spezialistenurteil: Ein neuer Branch ist sinnvoll, aber erst nach der
  Baseline-Entscheidung. Sonst entsteht lediglich ein neuer Name über
  ungeklärten Annahmen. Der bestehende Branch bleibt Beweis- und
  Vergleichsquelle; Codeübernahme wird explizit pro Modul entschieden.
- Hard-Gates: `BESTANDEN` für Analyse-Freeze; `OFFEN` für Baseline und
  Implementierungsfreigabe.
- Bewertung: akzeptiert als verbindlicher Arbeitsprozess.
- Evidenzqualität: `NUTZERANGABE` plus beobachteter nicht kundenfähiger
  Entwicklungsstand.
- Riskanteste Annahme: Dass „frisch anfangen“ automatisch weniger Risiko
  bedeutet; ohne Test- und Datenverträge könnten dieselben Fehler neu gebaut
  werden.
- Nächster Prüfschritt: Decision-Gate-Checkliste vervollständigen, den
  vorbereiteten offiziellen Upstream-Commit `72aabbd1` pinnen oder bewusst
  aktualisieren und jede mögliche Übernahme aus dem alten Branch hinsichtlich
  Aufwand, Altlasten und Testbarkeit prüfen.
- Entscheidung: Analysephase jetzt; neuer Implementierungsbranch erst nach
  ausdrücklicher Freigabe.
- Kanonischer Ausgang:
  [ADR-016](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-016-analysephase-vor-neuer-implementierungsbasis)
  und
  [Projektgedächtnis, nächste kontrollierte Abnahme](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#9-nächste-kontrollierte-abnahme).

## INT-20260825-021 — Original-AnythingLLM Default-N32-Vollkontextprobe

- Erfasst: 2026-08-25
- Typ: EVIDENZHINWEIS
- Status: PROMOTED
- Aussage: Korrektes Modellrouting und Default-N32 erhöhten den wirksamen
  Qwen-Prompt von 2.450 auf 29.882 Tokens und verbesserten die dokumentweiten
  Breiten-Proxys stark. Ein kontrollierter Wechsel auf Gemma mit
  30.524 Prompttokens war schneller, verlor aber rund die Hälfte der
  eindeutigen Positionen. Beide freien Ein-Prompt-Ausgaben blieben wegen
  Quellen-, Rollen-, Sparten- oder Vollständigkeitsfehlern nicht kundenfähig.
- Ist-Wahrheit: `JA` für den gemessenen Original-AnythingLLM-Lauf auf der
  dokumentierten Kundenhardware; `NEIN` als allgemeiner Modell- oder
  Produktbeweis.
- Quelle: kontrollierte lokale Laufserie vom 25. August 2026; Rohlog und
  Rohantwort wegen Dokument- und Vertragsdaten nicht versioniert.
- Gewünschter Kundennutzen und sichtbares Ergebnis: belastbar feststellen, wie
  weit das unveränderte Produkt mit eingebauten RAG-, Kontext- und
  Modellparametern eine vollständige Gebäudeversicherungsblaupause erzeugt.
- Scope und ausdrückliche Nicht-Ziele: Originalprodukt, ein Referenzdokument,
  ein Prompt und ein ungepinnter Workspace-Index. Keine Produktcodeänderung,
  keine allgemeine Universalitäts- oder Kundenfreigabe.
- Evidenz und Beweisgrenze: Qwen verarbeitete 29.882 Prompttokens und lieferte
  98 achtspaltige Zeilen mit 75 eindeutigen Positionen; Gemma verarbeitete
  30.524 Prompttokens und lieferte 45 Zeilen mit 37 eindeutigen Positionen.
  Beide Logs zeigten als letzten sichtbaren Kontextmarker 31. Vollständige
  Chunkkörper, Finish-Reason, Outputtokens und Reproduzierbarkeit bleiben
  offen.
- Systembezug: RAG-Kontextaufbereitung, Modellrouting, Generator,
  Quellenrekonstruktion, Rollenbindung, Ausgabevalidierung; stützt `INV-003`,
  `INV-004` und `FAIL-001`.
- Beziehungen:
  - stützt -> `INT-20260824-013`, `INT-20260824-014`
  - begrenzt -> `INT-20260824-017`
  - verfeinert -> `INT-20260824-018`
  - prüft -> Reichweite einer monolithischen Originalprodukt-Ein-Prompt-Lösung
- Spezialistenurteil:
  - Local-AI/RAG: N32 beseitigt einen großen Retrievalengpass; weder weiteres
    Top-N-Tuning noch isolierter Generatorwechsel ist der nächste Hebel.
  - Kunde/Versicherung: hohe Breite genügt ohne korrekte Rollen, Ausschlüsse
    und auditierbare Quellen nicht.
  - Datenschutz/Betrieb: nur anonymisierte Messwerte versionieren.
  - Kritik/Test: Qwen scheitert unter anderem an 0/98 Klauselquellen,
    unmöglichen Seiten, 98 unbelegten Premium-Nein, fehlendem Einbruchabschnitt
    und Terror-Rollenfehler. Gemma scheitert an 0/45 vollständigen Quellen und
    massiven Wasser-, Sturm-, Einbruch- und Glasfassaden-Auslassungen.
- Hard-Gates: `BEGRENZT` für Retrievalbreite; `NICHT_BESTANDEN` für
  beweissicheren Volloutput.
- Bewertung: `REVISE`.
- Evidenzqualität: `GEMESSEN_KUNDENHARDWARE`
- Riskanteste Annahme: Dass die eingebauten Workflowmöglichkeiten der
  installierten AnythingLLM-Version den Dokumenttext ohne unkontrollierte
  Zwischenparaphrase abschnittsweise verarbeiten können.
- Nächster Prüfschritt: Leitungswasser als Sektions-Golden-Case mit getrennten
  Schritten für Enumeration, Faktrollenextraktion und Quellen-/Anchor-Prüfung.
- Entscheidung: Kein weiteres Search-/Top-N- oder Generator-Roulette;
  abschnittsweise Mehrpass-Extraktion plus Auditpass prüfen. Ein sichtbarer
  Nutzerauftrag darf mehrere interne Schritte auslösen.
- Kanonischer Ausgang:
  [Tests und Erkenntnisse, Abschnitt 16](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#16-original-anythingllm-default-n32-vollkontextprobe).

## INT-20260825-022 — Vertrauliche Realpolicen als lokale strukturdiverse Testkohorte

- Erfasst: 2026-08-25
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `PROMOTED`
- Aussage: Echte Dokumente dürfen nicht an Codex übermittelt werden. Sie sollen
  deshalb ausschließlich lokal mit Qwen/AnythingLLM geprüft und nur in
  datenschutzgeprüfte, aggregierte Messwerte und abstrakte Fehlerklassen
  übersetzt werden. Nicht alle Dokumente werden sofort frei vollanalysiert.
- Ist-Wahrheit: `JA` für die Datenschutzgrenze; `ENTSCHEIDUNG` für die lokale
  Testkampagne.
- Quelle: direkte Nutzerangabe vom 25. August 2026 plus `INT-20260825-021`.
- Gewünschter Kundennutzen und sichtbares Ergebnis: reale Strukturvielfalt
  prüfen, ohne Vertragsinhalte oder Kundendaten offenzulegen und ohne auf ein
  bekanntes Dokument zu überfitten.
- Scope und ausdrückliche Nicht-Ziele: lokale Experimentkohorte und manuelles
  Oracle; keine Cloudanalyse, keine Übermittlung von Rohtexten, Zitaten,
  Screenshots, Logs, Pfaden, Hashes, Vektoren oder Qwen-Rohantworten.
- Evidenz und Beweisgrenze: Der freie Ein-Prompt-Lauf ist bereits an Quellen,
  Rollen und Vollständigkeit gescheitert. Mehr gleiche Vollanalysen würden den
  Fehler vervielfachen, aber seine Ursache nicht isolieren.
- Systembezug: Datenschutz, Experimentdesign, TargetSpecs, Golden Cases,
  Dokumentpaket-/Variantenmodell und spätere A/B-Abnahme.
- Beziehungen:
  - verfeinert -> `INT-20260824-008`, `INT-20260824-019`
  - hängt_ab_von -> lokaler Verarbeitungsfreigabe, Aufbewahrungs-/Löschregel
    und manuellem fachlichen Oracle
  - begrenzt -> freie Vollanalyse aller vorhandenen echten Dokumente
  - stützt -> `INT-20260825-020`, `INT-20260825-021`
- Spezialistenurteil: Erst synthetische Leitungswasserfälle, dann idealerweise
  sechs lokale Vertragspakete: zwei Entwicklungsdokumente und vier unangetastete
  Holdouts. Auswahl nach Struktur statt Versicherername: native/OCR,
  kurz/lang, tabellen-/variantenreich, AVB/Nachtrag/Querverweis und dichte
  Mehrbetragsklausel. Kategorien sind Views; Start mit Selbstbehalt/Limit und
  Leitungswasser, danach eine strukturell andere Kategorie und ein
  dokumentweiter Discovery-Restpass.
- Hard-Gates: Originale und Rohartefakte bleiben lokal; Holdouts werden nicht
  zum Prompt-Tuning verwendet; fehlende Paketbestandteile führen zu
  `Paket unvollständig`, nicht zu einer Negativdeckung; Qwen-Selbstprüfung
  ersetzt kein manuelles Oracle.
- Bewertung: akzeptiert als datenschutzkonformer Realstruktur-Testpfad.
- Evidenzqualität: `NUTZERANGABE` plus gemessene Grenzen aus `INT-021`.
- Riskanteste Annahme: Dass lokale Verarbeitung allein Datenschutz garantiert;
  Logs, Backups, Sync-/Share-Funktionen und re-identifizierende Aggregate
  bleiben gesondert zu kontrollieren.
- Nächster Prüfschritt: lokal eine strukturdiverse Kohorte auswählen und pro
  Vertragspaket 20 bis 30 schwierige Oracle-Fälle definieren; zunächst nur den
  Leitungswasser-Mehrpass mit eingefrorener Konfiguration ausführen.
- Entscheidung: begrenzte lokale Kohorte statt Vollanalyse aller Dokumente.
- Kanonischer Ausgang:
  [Experimentprotokoll, vertrauliche Real-Dokument-Kampagne](./POLIZZENVERGLEICH_EXPERIMENTPROTOKOLL.md#8-vertrauliche-real-dokument-kampagne).

## INT-20260825-023 — Partner-Katalog mit 276 Prüfpunkten und Qwen/XLSX-Kategorienlauf

- Erfasst: 2026-08-25
- Typ: `EVIDENZHINWEIS`
- Status: `IN_PRÜFUNG`
- Aussage: Ein vom Partner übermittelter WEG-Katalog enthält 276 Quellzeilen in
  acht Views und 23 Zwölfer-Batches. Vorgeschlagen wird, jedes Batch lokal mit
  Qwen 3.8 27B gegen ein Dokument zu prüfen, die Ergebnisse in XLSX zu sammeln
  und anschließend A/B-Spalten zu vergleichen und zu bewerten.
- Ist-Wahrheit: `JA` für Quellartefakt, Screenshots und beobachtete Laufzeit;
  `NEIN` für fachliche Richtigkeit, Vollständigkeit und Produktionsreife.
- Quelle: Partnernachrichten, vier lokale Qwen-Screenshots und
  [`building-insurance-partner-276-seed.v0.1.source.md`](./knowledge-catalogs/building-insurance-partner-276-seed.v0.1.source.md).
- Gewünschter Kundennutzen und sichtbares Ergebnis: ein breiter, nachvollziehbar
  strukturierter Prüfkatalog und eine für Makler prüfbare A/B-Matrix.
- Scope und ausdrückliche Nicht-Ziele: Der Katalog ist ein unvalidierter
  Taxonomie-, Review- und TargetSpec-Seed. Er ist weder Vollständigkeitsgrenze
  noch Versicherungsstandard, Brokerregel, automatischer Score oder
  autoritative Excel-Datenquelle.
- Evidenz und Beweisgrenze:
  - Die Quellzählung ist konsistent: sieben Views zu je 36 und eine WEG-View zu
    24 Punkten ergeben 276; die Ausführungssicht umfasst 23 Batches.
  - Der bestehende Seed hat 202 Quellzeilen, davon 190 Vergleichspunkt- und 12
    getrennte Broker-Regelkandidaten. `276 - 202` sind nicht 74 neue Fakten:
    der neue Katalog atomisiert alte Sammelzeilen, enthält Duplikate über Views
    und lässt die alte Objekt-/Kundengrunddaten-View weg.
  - Ein Screenshot zeigt für eine Feuer-Ausgabe rund 9:06 Minuten. Bei 23
    gleich langen Batches sind das ungefähr 3:27 bis 3:50 Stunden je Dokument,
    rund 6:54 bis 7:40 Stunden für A und B vor Audit und Vergleich.
  - Die Screenshots belegen keine vollständige physische Seiten-, Offset-,
    Varianten- oder Quellenkette und kein unabhängiges Oracle.
- Systembezug: Fachkatalog, TargetSpecs, Golden Cases, lokale Qwen-Orchestrierung,
  Rollenbindung, Coverage, XLSX-Review und späterer deterministischer A/B-Join;
  betrifft `FAIL-001`, `FAIL-003`, `INV-002`, `ADR-007`, `ADR-012` und
  `ADR-013`.
- Beziehungen:
  - verfeinert -> `INT-20260824-012`, `INT-20260824-014`
  - stützt -> `INT-20260824-013`, `INT-20260825-022`
  - begrenzt -> `INT-20260824-015`, `INT-20260824-016`
  - hängt_ab_von -> fachlichem Crosswalk, Atomisierung, Quellenvalidator,
    Rollen-/Scope-Oracle und bestätigtem Laufzeit-SLA
- Spezialistenurteil:
  - Katalog: Die stärkere Zerlegung ist wertvoll, etwa bei Zu-/Ableitung,
    Innen-/Außenrohren, WEG-Innenausbau, Kostenarten und technischen Anlagen.
    Cross-View-Dubletten wie Rückstau, Lawine, Selbstbehalt, Leerstand und
    Wiederherstellungsfrist dürfen aber nicht zu verschiedenen
    Faktenidentitäten werden. Kategorien bleiben Views.
  - Fachlichkeit: Promptvorgaben wie „oft 5–10 T€“, „zu wenig“, „Drohnen
    zunehmend relevant“, rote Flaggen und Gewicht 3 sind unvalidierte
    Broker-Regelkandidaten. Aussagen zu Markt, Recht, Angemessenheit oder
    Empfehlung sind keine `DocumentFact`-Werte.
  - Qwen-Ausgabe: `✅`, `❌` und „teilweise“ kollabieren Definition, Deckung,
    Ausschluss, Bedingung, Limit, Evidenzstatus und Unsicherheit. Sichtbare
    Beispiele wie „Branddefinition = gedeckt“, Drohnen-Subsumtion, „solide
    Basis“ und „Totalverlust der Deckung“ zeigen Prompt-Bias und unzulässige
    Ebenenvermischung. Sie sind Fehlerklassen, keine verifizierten Ergebnisse.
  - XLSX: sinnvoll als Makler-Review, Export, Oracle und Crosswalk; nicht als
    kanonisches Faktmodell oder direkte Scoreautorität. Eine Ergebniszeile muss
    genau eine Occurrence/Faktrolle tragen und mindestens Dokumentslot,
    Punkt-ID, Occurrence-ID, Faktrolle, Evidenzstatus, Wert/Einheit/Basis,
    Scope/Variante, exakten Beleg, physische Seite und Reviewstatus enthalten.
  - Laufweg: Ein vollständiger 23-Batch-Lauf darf einmal als kontrollierter
    Challenger gemessen werden. Als Zielpipeline wiederholt er das serielle
    generative Vollinventar aus `FAIL-001`; ein zweiter Lauf desselben Modells
    ist Kritik, keine unabhängige Verifikation.
- Hard-Gates: `BEGRENZT`. Keine Negativdeckung aus `not_found`; keine
  akzeptierte Zeile ohne exakten lokalen Beleg und gültige physische Seite;
  keine Rollenverwechslung von Selbstbehalt/Limit; unbekannte Zusatzfunde
  bleiben erlaubt; Gewichte und Empfehlungen bleiben außerhalb der
  Dokumentfakten; A/B erst nach dokumentisolierter Validierung und
  Comparability Gate.
- Bewertung: wertvoller fachlicher Ausbau und guter Experiment-Challenger;
  nicht als Produktionsworkflow oder automatische Bewertungsmatrix akzeptiert.
- Evidenzqualität: `NUTZERANGABE` plus visuell beobachteter lokaler Lauf;
  fachliche Aussagen weiterhin `ANNAHME`.
- Riskanteste Annahme: Dass viele strukturierte Qwen-Zeilen automatisch hohen
  Recall und korrektes Vertragsverständnis bedeuten; die Screenshots zeigen
  bereits echte Kandidaten zusammen mit unbelegter Subsumtion und Bewertung.
- Nächster Prüfschritt: Bestehenden 202er Seed unverändert lassen; für alle 276
  Quellzeilen einen `SAME/SPLIT/MERGE/NEW/RECLASSIFIED/RULE_ONLY`-Crosswalk
  erstellen. Vor dem Volllauf zwei schwierige Zwölfer-Batches mit eingefrorener
  Konfiguration, strukturiertem Output und lokalem Oracle prüfen. Erst bei
  bestandenen Quellen-, Rollen- und Coverage-Gates einen vollständigen
  Kalibrierungslauf und danach einen unangetasteten Holdout starten.
- Entscheidung: Quellenkatalog dauerhaft aufnehmen; fachlich atomisieren und
  crosswalken; Kategorienlauf nur als Experiment begrenzen; XLSX nur als
  Review-/Exportartefakt verwenden; automatisches Scoring gesperrt lassen.
- Kanonischer Ausgang: noch keiner; Quellsnapshot und dieser Intake-Eintrag.

## INT-20260825-024 — Isolierter lokaler PDF-Ordner-Batch-Harness

- Erfasst: 2026-08-25
- Typ: `EVIDENZHINWEIS`
- Status: `PROMOTED`
- Aussage: Auf ausdrücklichen Nutzerwunsch wurde außerhalb des AnythingLLM-
  Produktcodes ein eigenständiger experimenteller Ordner-Harness erstellt. Er
  verarbeitet lokale PDFs isoliert und seriell über genau ein geladenes
  LM-Studio-Chatmodell. Version 0.2.0 führt standardmäßig den katalogfreien,
  wortgetreuen Strukturinventarlauf aus; der ursprüngliche Lauf über 276
  unvalidierte Quellpunkte bleibt getrennt als expliziter
  `--mode catalog`-Challenger erreichbar.
- Ist-Wahrheit: `JA` für vorhandenes Experimentwerkzeug und synthetische Tests;
  `NEIN` für fachliche Richtigkeit, Kundenreife, effiziente Produktarchitektur
  oder A/B-Vergleich.
- Quelle: direkte Implementierungsanforderung des Nutzers vom 25. August 2026;
  Werkzeugordner `policy-pdf-batch-analyzer`.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Viele lokale Beispiel-PDFs
  ohne manuelle Einzelaufrufe verarbeiten und je PDF einen wiederaufnehmbaren,
  nachvollziehbaren Analyseentwurf erhalten.
- Scope und ausdrückliche Nicht-Ziele: lokaler Challenger/Discovery-Harness;
  keine Änderung am vorbereiteten AnythingLLM-Implementierungsworktree, kein
  Produktpfad, kein automatischer Score, keine Rechts-/Marktbewertung, kein
  Vertragspaket-Merge, kein A/B-Join und keine Maklerfreigabe.
- Evidenz und Beweisgrenze:
  - Katalogvalidator: 276 eindeutige IDs und 23 logische Batches.
  - 24 synthetische Unit-/Contracttests bestehen für Katalog, physische Seiten,
    Chunküberlappung, Quellenoffset, Loopback, Status-/ID-Gates, unzulässige
    Rollen, abgeschnittene Antworten, OCR-PageMap-Verlust, Provider-Timeout-
    Gesamtstopp und `nicht belegt != ausgeschlossen`.
  - Ein externer synthetischer Dry-Run aus einem fremden Arbeitsordner erkannte
    eine PDF, eine physische Seite, einen Batch und das tatsächlich geladene
    Chatmodell ohne Generierung.
  - Kein realer Qwen-27B-Volllauf, kein OCR-Integrationstest und kein
    fachliches Golden Oracle wurden ausgeführt.
  - Kunden-Mac-Dry-Run vom 25. August 2026: 13 lokale PDFs, aggregiert 274
    physische Seiten, 16 vollständige Dokumentchunks und 368 geplante
    Seiten-mal-Batch-Modellaufgaben; null Dokumentfehler. Geladen war dabei
    `Gemma 4 26B A4B` unter Alias `gemma` mit 80.128 Kontexttokens, nicht Qwen
    27B. Der Dry-Run führte keine Generierung aus und beweist nur Discovery,
    Extraktion, Planung und Modell-Preflight, nicht Analysequalität oder
    Laufzeit. Originaldateinamen und Dokumentinhalte wurden nicht übernommen.
- Systembezug: kontrolliertes Experiment zu `INT-023`; betrifft `FAIL-001`,
  `FAIL-003`, `INV-001` bis `INV-004`, `INV-006`, `ADR-002`, `ADR-007`,
  `ADR-012`, `ADR-013` und `ADR-016`.
- Beziehungen:
  - operationalisiert_begrenzt -> `INT-20260825-023`
  - stützt -> `INT-20260825-022`
  - kollidiert_mit_wenn_als_produkt_genutzt -> `FAIL-001`, `ADR-002`
  - hängt_ab_von -> lokaler Datenschutz-/Aufbewahrungsregel, OCR-Qualität,
    fachlichem Rollenoracle und gemessener Kundenhardware-Laufzeit
- Spezialistenurteil:
  - Positiv: Loopback-Zwang, deaktivierte Proxyverwendung, PDF-Isolation,
    physische PageMap, vollständige Seiten-mal-Batch-Planung ohne Top-N,
    Checkpoints, restriktive Dateirechte, Prozesslock, reguläres
    Finish-Reason-Gate sowie exakte Zitat-/Seitenprüfung.
  - Kritische Grenze: Wortgetreues Zitat beweist keine fachlich richtige
    Point-, Rollen-, Wert-, Scope- oder Ausschlusspolaritätszuordnung. Nach
    Gegenprüfung wurde der Report deshalb auf „lexikalisch validierte
    Modellkandidaten – fachliche Zuordnung ungeprüft“ zurückgestuft.
  - Unvollständige PDF-/OCR-Abdeckung sperrt punktweise
    Nichtbelegtaussagen. Modelltimeout stoppt den Gesamtlauf, weil der
    Providerzustand unbekannt sein kann.
  - Chunküberlappung reduziert harte Grenzverluste, beweist aber keine
    Klausel-/Tabellen-/Variantenrekonstruktion. Katalogfremder Discovery-
    Restpass und fachlicher Rollenbinder fehlen sichtbar.
- Hard-Gates: `BEGRENZT`. Internes Experiment zulässig; Kundenbericht und
  Produktübernahme nicht freigegeben. Echte Dokumente, Reports und State
  bleiben lokal außerhalb Git/Cloud-Sync; keine gleichzeitige aktive
  AnythingLLM-/Qwen-Inferenz.
- Bewertung: akzeptiert als isoliertes Mess- und Automatisierungswerkzeug;
  verworfen als Beweis für vollständiges Vertragsverständnis.
- Evidenzqualität: `SYNTHETISCH_GETESTET` plus `BEOBACHTET_CODE`.
- Riskanteste Annahme: Dass Vollseiten-mal-Katalogbreite trotz Resume auf
  realen langen Policen wirtschaftlich ausführbar ist. Das Werkzeug macht
  `FAIL-001` messbar, löst ihn aber nicht. Der konkrete Dry-Run plant bereits
  368 Generierungen; bei hypothetischen 9 bis 10 Minuten je Aufgabe wären das
  etwa 55 bis 61 Stunden reine Modellzeit. Die tatsächliche Gemma-/Qwen-Zeit
  ist erst durch einen einzelnen kontrollierten Pilotbatch zu messen.
- Nächster Prüfschritt: zuerst `--dry-run`, danach genau zwei synthetische oder
  lokal manuell georacle-te Challenger-Batches. Erst nach Quellen-/Rollenreview
  einen vollständigen Einzel-PDF-Lauf; reale Kundendokumente nie an Codex
  übermitteln.
- Entscheidung: als isolierten experimentellen Harness behalten; nicht in den
  sauberen Produktbranch übernehmen und Ergebnisse nur als ungeprüfte
  Kandidaten behandeln.
- Kanonischer Ausgang: Werkzeug-README und Architekturkarte im isolierten
  Ordner `policy-pdf-batch-analyzer`.

## INT-20260825-025 — Dokumenteigene Kategorien und Unterkategorien wortgetreu inventarisieren

- Erfasst: 2026-08-25
- Typ: `ZIEL`
- Status: `PROMOTED`
- Aussage: Der lokale Real-PDF-Lauf soll keine Kategorien oder Unterkategorien
  erzeugen und zunächst auch nicht gegen die 276 Partnerpunkte prüfen. Er soll
  ausschließlich die in jedem Dokument tatsächlich ausgeschriebenen
  Strukturbezeichnungen wortgetreu ablesen und speichern: Überschriften,
  Unterüberschriften, Abschnitts-, Klausel- und gegebenenfalls Tabellentitel.
  Daraus wird eine dokumentisolierte und anschließend dokumentübergreifende
  Gesamtliste erstellt. Erst danach wird diese beobachtete Liste dem
  Partner-Katalog gegenübergestellt, um Nähe, Lücken, abweichende Granularität
  und nötige Kataloganpassungen zu analysieren.
- Ist-Wahrheit: `JA` für den isolierten Strukturinventar-Harness v0.2.0 und
  synthetische Contracttests; `NEIN` für gemessenen Recall auf vertraulichen
  Real-PDFs oder fachliche Freigabe. Der Standardlauf lädt den Partner-Katalog
  nicht, plant jede extrahierte Quellzeile genau einmal und akzeptiert nur
  vollständige wortgleiche Quellzeilen mit passender Zeilen-ID und physischer
  Seite.
- Beweis-/Interpretationsgrenze:
  - Keine vom Modell erfundenen oder normalisierten Kategorien im
    Rohinventar; Originalschreibweise und physische Seite bleiben erhalten.
  - Eine Eltern-Kind-Beziehung darf nur aus expliziter Nummerierung,
    Überschriftenebene oder Layoutstruktur stammen; sonst `Hierarchie
ungeklärt`.
  - Inhaltlich relevante Themen, die nur im Fließtext vorkommen, sind keine
    dokumentierten Unterkategorien und dürfen im Strukturinventar nicht so
    umbenannt werden.
  - Synonyme, Deduplikation und semantische Zuordnung erfolgen erst im
    getrennten Crosswalk; das Rohinventar bleibt unverändert und
    dokumentisoliert.
- Gewünschte Artefakte:
  - je PDF eine Liste aus Originalbezeichnung, beobachteter Ebene,
    Elternbezeichnung, physischer Seite und Strukturtyp;
  - eine verlustfreie Gesamtliste aller beobachteten Bezeichnungen mit
    Vorkommenszählung, ohne Originalvarianten zusammenzuziehen;
  - ein späterer separater Crosswalk `beobachtete Dokumentstruktur <->
Partner-Katalog` mit `gleich`, `ähnlich`, `fehlt im Partner-Katalog`,
    `nur im Partner-Katalog` und `Zuordnung ungeklärt`.
- Beziehung:
  - korrigiert_Zielinterpretation_von -> `INT-20260825-024`
  - liefert_Evidenz_für -> `INT-20260825-023`
  - darf_nicht_vermischt_werden_mit -> fachlicher Deckungsstatus,
    Brokerbewertung oder automatischem Score
- Entscheidung: Vor einem kataloggeführten Voll-Lauf zuerst diesen
  wortgetreuen Strukturinventarlauf definieren und lokal messen.
- Kanonischer Ausgang: eigenständiges Paket `policy-structure-inventory-v2`
  v2.0.0 ohne Katalog-, Legacy-Code- oder `.venv`-Abhängigkeit; noch keine
  Real-PDF-/Qwen-Abnahme.

## INT-20260825-026 — Strukturinventar und belegtes Inhaltsinventar strikt trennen

- Erfasst: 2026-08-25
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `PROMOTED`
- Aussage: Der empirische Real-PDF-Lauf besteht aus zwei getrennten Ebenen.
  Ebene 1 inventarisiert ausschließlich wortgetreue Dokumentstruktur. Ebene 2
  extrahiert zusätzlich belegte Vertragselemente aus Fließtext,
  Tabellenzellen, Verweisen und Anhängen, auch wenn dafür keine eigene
  Überschrift existiert. Keine Ebene darf Kategorien oder Fakten erfinden.
- Ebene 1 – wortgetreues Strukturinventar:
  - Kapitel, Unterkapitel, Klauselnummer und -titel, Tabellenüberschrift,
    Nummerierung, beobachtete Hierarchie, physische Seite und
    Originalschreibweise;
  - zusätzlich kanonische Block-/Span-ID und Originaloffset, damit gleiche
    Bezeichnungen auf derselben Seite unterscheidbar und später beweisbar
    bleiben;
  - wiederholte Kopf-/Fußzeilen separat erkennen und nicht als zusätzliche
    Klauseln oder Vorkommen zählen;
  - unklare Layout- oder Elternbeziehung bleibt `unresolved`.
- Ebene 2 – belegtes Inhaltsinventar:
  - versicherte Gefahr/Leistung, versicherte Sache, Definition, Limit,
    Sublimit, Selbstbehalt, Bedingung, Ausschluss, Obliegenheit, Variante,
    Geltungsscope und Querverweis als getrennte Rollen;
  - jede Rolle mit exaktem Span, physischer PageMap-Seite, Block-/Klausel-ID,
    Tabellenzeilen-/Spaltenkopf und dokumentisoliertem Scope;
  - Fließtextinhalt darf als belegter Vertragsfakt erscheinen, aber nicht
    rückwirkend als vom Dokument ausgewiesene Unterkategorie umbenannt werden.
- Crosswalk-Reihenfolge: dokumenteigene Struktur erfassen -> verlustfreie
  Gesamtliste bilden -> Schreibvarianten/Synonyme nachvollziehbar gruppieren ->
  Partner-Katalog gegenüberstellen -> gemeinsame Vergleichstaxonomie fachlich
  freigeben -> belegte Vertragsfakten auf stabile Taxonomiepunkte abbilden ->
  A/B nur nach Comparability Gate verbinden.
- Aggregationsvertrag:
  - `Vorkommenszahl` zählt gültige, nicht bloß wiederholte Layoutvorkommen;
  - `Dokumenthäufigkeit` zählt unterschiedliche Dokumente mit mindestens einem
    gültigen Vorkommen und ist für Katalogpriorisierung meist aussagekräftiger;
  - Originalvarianten bleiben in der Rohschicht getrennt; Gruppierung und
    Partnerzuordnung sind eigene, reversible Crosswalk-Datensätze.
- Minimale Review-/XLSX-Sicht: neutrale Dokument-ID, physische Seite,
  Originalbezeichnung, Strukturtyp, Ebene, wortgetreuer Parent,
  Klauselnummer, Vorkommenszahl, Dokumenthäufigkeit, normalisierte Zuordnung,
  Partner-Katalog-Zuordnung und Reviewstatus. Kanonische Persistenz soll
  zusätzlich Block-/Span-ID, Offset und Versions-/Run-Provenienz enthalten;
  XLSX/Markdown bleiben abgeleitete Reviewartefakte.
- Ist-Wahrheit: `TEILWEISE`. Ebene 1 ist im isolierten Ordner-Harness v0.2.0
  synthetisch implementiert: Layoutzeilen, ein katalogfreier Prompt je Chunk,
  exakte Zeilen-/Seiten-/Offsetbindung, mehrzeilige Strukturbezeichnungen,
  Wiederholungserkennung, Markdown je PDF sowie Gesamt-Markdown und
  Excel-kompatible CSV. Ebene 2 und der Partner-Crosswalk sind ausdrücklich
  noch nicht implementiert.
- Beziehung:
  - erweitert -> `INT-20260825-025`
  - liefert_Evidenz_für -> `INT-20260825-023`
  - operationalisiert_später -> `INT-20260824-003`, `INT-20260824-004`
  - schützt_vor -> `FAIL-001`, `FAIL-003`, `INV-002`, `INV-003`
- Entscheidung: als Zielvertrag für den lokalen empirischen Vorlauf übernehmen;
  Struktur- und Inhaltsinventar sowie Crosswalk nicht in einem Modellprompt
  oder einer unversionierten Excel-Tabelle vermischen.
- Kanonischer Ausgang: Ebene 1 im eigenständigen Paket
  `policy-structure-inventory-v2` v2.0.0; Ebene 2 und Crosswalk weiterhin nur
  dieser Zielvertrag. Das Paket erstellt seine eigene lokale `.venv` und
  enthält keinen Partner-Katalog oder alten Katalog-Challenger.

## INT-20260825-027 — Vollständige Built-in-Konfigurationskampagne und Run-Ledger

- Erfasst: 2026-08-25
- Typ: `EVIDENZHINWEIS`
- Status: `PROMOTED`
- Aussage: Vor weiterer Agentic-Umsetzung müssen nicht nur die letzten
  Default-N32-/Generatorläufe, sondern sämtliche zuvor getesteten
  Original-AnythingLLM-Konstellationen dauerhaft abrufbar sein. Die Kampagne
  umfasst Pinning, BGE-M3/Dinghy, N6/N10, Temperatur 0,7/0, Default-N32,
  ungültiges Modellrouting sowie Qwen/Gemma.
- Ist-Wahrheit: `JA`. Die zuvor fehlende Gesamtmatrix wurde nachträglich aus
  Konfigurationsangaben, Runtime-Logs und Antwortaudits rekonstruiert.
- Quelle: direkte Nutzerkorrektur vom 25. August 2026 und die lokale
  Versuchskampagne vom 24. bis 25. August 2026. Rohdaten bleiben wegen
  Dokument- und Vertragsinhalten außerhalb des Repositorys.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Pläne und
  Architekturentscheidungen sollen nicht erneut bereits gemessene Grenzen
  übersehen oder aus einer einzelnen guten Kennzahl einen falschen Sieger
  ableiten.
- Scope und ausdrückliche Nicht-Ziele: vollständiges, anonymisiertes
  Metadatenregister der bisherigen Built-in-Läufe. Keine nachträgliche
  Erfindung nicht geloggter Runtimewerte, kein vollständiges Faktrollen-Oracle
  und keine Kundenfreigabe.
- Evidenz und Beweisgrenze: Für die instrumentierten Läufe sind Modellrouting,
  höchster Kontextmarker, Prompttokens und Streamende beobachtet. Andere
  Konfigurationen beruhen ausdrücklich auf Nutzerangabe plus Antwortaudit.
  Zeilenzahl, eindeutige Positionsnamen und Klauselcodes sind Proxys, nicht
  tatsächlicher Faktenrecall.
- Systembezug: Experimentsteuerung, Knowledge Base, Retrieval, Reranking,
  Promptkompression, Generator, Quellenrekonstruktion, Rollenbindung,
  Validierung und Agentic-Planung.
- Beziehungen:
  - erweitert -> `INT-20260825-021`
  - stützt -> `INT-20260824-013`, `INT-20260824-014`, `INT-20260824-019`
  - begrenzt -> `INT-20260824-018`
  - invalidiert als Qualitätslauf -> `OAL-08A`, `OAL-08B`
- Spezialistenurteil:
  - Knowledge-Kuration: Das fehlende Kampagnenregister war ein operativer
    Gedächtnisfehler; Kurzurteile allein waren nicht ausreichend abrufbar.
  - RAG/Local-AI: Dinghy erreicht auf diesem Dokument im ungepinnten
    Accuracy-Pfad die höheren Breiten-Proxys, ist aber kein universeller
    reiner Embedder-Sieger.
  - Fachlichkeit: Mehr Zeilen oder Codes ersetzen keine korrekte Rolle,
    Wirkungsrichtung, Quelle oder Negativsemantik.
  - Kritik/Test: Pin-Läufe, ungepinnte Retrievalläufe und ungültige
    Routingläufe dürfen nicht in dieselbe Kausalreihe gemischt werden.
- Hard-Gates: `BESTANDEN` für vollständige Metadateninventur der bekannten
  Runs; `NICHT_BESTANDEN` für universelle Produkt- oder Modellentscheidung.
- Bewertung: `PROMOTED`.
- Evidenzqualität: `GEMISCHT_GEMESSEN_UND_NUTZERBESTÄTIGT`
- Riskanteste Annahme: Dass keine weitere, außerhalb des dokumentierten
  Verlaufs liegende Konfiguration getestet wurde. Neue Belege werden als neue
  Run-ID ergänzt, nicht still eingearbeitet.
- Nächster Prüfschritt: Vor dem nächsten Agentic- oder Mehrpasslauf die
  Built-in-Baseline als Vergleichsgruppe und die Hard-Gates festschreiben.
- Entscheidung: Die freie Built-in-Parametersuche ist geschlossen. Neue
  Versuche müssen eine andere Workflowhypothese oder eine klar isolierte
  Variable prüfen.
- Kanonischer Ausgang:
  [Tests und Erkenntnisse, Abschnitt 17](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#17-original-anythingllm-vollständige-built-in-konfigurationskampagne)
  und
  [`experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json`](./experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json).

## INT-20260825-028 — Taxonomiegetriebener occurrence-zentrierter A/B-Zeilenworkflow

- Erfasst: 2026-08-25
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `IN_PRÜFUNG`
- Aussage: Nach dem wortgetreuen Strukturinventar soll dessen empirische
  Gesamtliste mit der tatsächlich maßgeblichen Version des Partnerkatalogs
  gecrosswalkt werden. Daraus entsteht eine versionierte gemeinsame
  Vergleichstaxonomie. Bei einer Ein- oder Zwei-Dokument-Anfrage enumeriert
  Servercode die ausgewählten Vergleichspunkt-/Requirement-/Row-IDs,
  occurrence-zentriertes Retrieval sammelt je Dokument alle belegbaren
  Fundstellen und Qwen bearbeitet nur strukturell begrenzte ambige Kontexte.
  Dokument A und B werden strikt getrennt faktisiert; erst anschließend füllt
  ein deterministischer Join die abgeleitete Excel-/Chat-Sicht.
- Ist-Wahrheit: `NEIN` für einen implementierten oder fachlich freigegebenen
  Gesamtworkflow. `JA` für einen isolierten synthetischen Mechanik- und
  vollständigen AnythingLLM-REST-Dokument-Pipeline-PoC einschließlich
  Collector-PageMap, Dinghy/LanceDB, Vector Search und Agent-Skill. Der echte
  Partnerseed lässt sich mit 276/276 IDs planen, besitzt aber noch keine
  validierten atomaren Rollen/Aliase und
  erzeugt deshalb nur Kandidaten, keine fachlichen Partnerzeilen.
- Quelle: Paraphrasierter Nutzergedanke vom 25. August 2026; keine lokalen
  Dateinamen, Kataloginhalte oder Kundentexte gespeichert.
- Gewünschter Kundennutzen und sichtbares Ergebnis:
  - ein Dokument -> beleggebundene Analyse je stabiler fachlicher Dimension;
  - zwei Dokumente -> dieselben Dimensionen dokumentisoliert befüllen und
    erst danach punktweise vergleichen;
  - Bedienung weiterhin `Dokument(e) hochladen -> Frage senden -> Antwort`,
    ohne technische Pflichtschritte für den Benutzer;
  - Excel/Markdown als nachvollziehbare Review- und Exportsicht mit festen
    Zeilen, A-/B-Fakten, Evidenz, Vergleichsstatus und offenen Punkten.
- Scope und ausdrückliche Nicht-Ziele:
  - Eine Excel-Zeile ist ein stabiler Target-/Ausgabevertrag, nicht automatisch
    genau eine Klausel, Occurrence, Faktrolle oder ein freier LLM-Aufruf.
  - Ein Vergleichspunkt darf `0..n` Occurrences und `0..n` Fakten je Dokument
    besitzen. Selbstbehalte, Limits, Bedingungen und Ausschlüsse bleiben je
    Gefahr, versicherter Sache, Variante, Periode und Geltungsscope getrennt.
  - Nicht `Zeilen x Dokumentchunks x Dokumente` generativ abarbeiten. Text,
    Struktur, Occurrences und Fakten werden je Dokument einmal erschlossen und
    anschließend für mehrere Zeilen wiederverwendet.
  - Kein automatischer Gesamtscore, kein pauschaler Vertragsgewinner und keine
    Negativbehauptung aus fehlender Retrievalevidenz.
- Vorgesehener Datenfluss:
  1. PDF/PageMap/Layout, Dokumentart, Version, Variante und Paketstatus lokal
     erfassen; Struktur-, Clause-, Tabellen- und Querverweis-Ledger aufbauen.
  2. Wort-/Aliasmatrix enumeriert alle kontrollierten exakten Occurrences ohne
     globales Top-N; Dinghy ergänzt nur additive semantische Kandidaten.
  3. Kontext strukturell erweitern: Satz oder Tabellenzelle -> Klausel ->
     belegte Fortsetzung/Tabelle -> Heading, Variante und Scope.
  4. Rollenlokale Spans für Deckung, Sache, Definition, Betrag, Limit,
     Selbstbehalt, Bedingung, Ausschluss und Obliegenheit binden. Ambiges bleibt
     `unresolved` oder geht als kleine beleggebundene Gruppe an Qwen.
  5. Servercode validiert Quellen und besitzt Fact-/Row-IDs. Qwen darf feste
     Zellen formulieren, aber keine Fakten oder Zeilen auswählen oder auslassen.
  6. A/B-Join erst nach Comparability Gate für Punkt, Rolle, Objekt, Variante,
     Basis, Währung, Zeitraum und Aggregation. Zulässige Ergebnisse bleiben
     `Vorteil A`, `Vorteil B`, `gleichwertig`, `nicht vergleichbar` und
     `unresolved`.
- Katalog-/Crosswalkvertrag:
  - Die Zahl der Partnerzeilen wird nicht angenommen. Ob eine Fassung 276, 290
    oder anders viele Quellzeilen enthält, muss über `catalogId`, Version und
    exakte stabile Point-ID-Liste festgestellt werden.
  - Rohstruktur und Partnerpunkte werden reversibel als `gleich`, `ähnlich`,
    `split`, `merge`, `fehlt im Partnerkatalog`, `nur im Partnerkatalog`,
    `Regel statt Dokumentfakt` oder `ungeklärt` verbunden.
  - Dokumentfluss bestimmt Fundstellen- und Kontextauflösung; die fachliche
    Taxonomie bestimmt Reihenfolge und Darstellung. Beide Reihenfolgen dürfen
    nicht gleichgesetzt werden.
- Evidenz und Beweisgrenze: Stützt sich auf `INT-20260825-025/026`,
  `ADR-003`, `ADR-005`, `ADR-012`, `ADR-013` und `ADR-015`. `FAIL-003` zeigt,
  dass Fundstellenexistenz allein keine korrekte Rollenbindung beweist;
  `FAIL-001/004` schließen eine freie monolithische oder zeilenweise
  Vollprompt-Schleife als Produktionsbeweis aus.
- Systembezug: Taxonomie, Ingestion, PageMap, Clause-/Occurrence-Ledger,
  FTS/Dinghy, Rollenbindung, Qwen-Orchestrierung, Persistenz, serverseitiger
  Row Planner, AnythingLLM-Chat, Excel-/Markdown-Export und A/B-Comparability.
- Beziehungen:
  - verfeinert -> `INT-20260824-002`, `INT-20260824-003`,
    `INT-20260824-013`, `INT-20260824-014`
  - baut_auf -> `INT-20260825-025`, `INT-20260825-026`
  - erfüllt_später -> `INT-20260824-008`, `INT-20260824-009`
  - begrenzt_durch -> `FAIL-001`, `FAIL-003`, `FAIL-004`, `INV-002`,
    `INV-003`, `INV-004`
- Hard-Gates: `OFFEN`. Vor Implementierung sind Crosswalk, atomare
  Requirement-Rollen, Golden Cases, Rollen-/Scopebindung, PageMap-Provenienz,
  Holdout-Qualität und Laufzeit auf Kundenhardware zu prüfen.
- Bewertung: strategisch `akzeptieren mit Grenzen`; noch kein
  Implementierungsauftrag und keine Kundenfreigabe.
- Evidenzqualität: `NUTZERANGABE` plus `BEOBACHTET_CODE/ADRS` für die
  bestehenden Architekturgrenzen; keine Real-PDF-Fachmessung.
- Riskanteste Annahme: Dass eine zeilenorientierte Vergleichstaxonomie nach
  Atomisierung und Crosswalk alle fachlich wichtigen Inhaltsrelationen ohne
  Verlust repräsentieren kann. Unbekannte Klauselinhalte müssen deshalb auch
  außerhalb des bekannten Katalogs terminal verarbeitet werden.
- Nächster Prüfschritt: Partnerpunkte atomisieren und fachlich bestätigte
  Rollen/Aliase/Scopes definieren, danach ein schwierigeres synthetisches
  Paket und getrennte Holdouts prüfen. REST-Upload, Collector, getrennte
  A/B-Workspaces, Dinghy/LanceDB, Vector Search und Chattrigger sind
  synthetisch bestanden; offen bleibt die grafische A/B-Auswahl.
- Entscheidung: als zentrale Strategiehypothese aufnehmen; keine Umsetzung
  während des Evidenzaudits.
- Kanonischer Ausgang: detaillierter, weiterhin ungeprüfter Umsetzungsvorschlag
  [`slavko_umsetzungsidee1.md`](./slavko_umsetzungsidee1.md); der Intake bleibt
  bis zur Validierung `IN_PRÜFUNG`.
- Versuchsevidenz: synthetischer Mechanik-PoC `PASS`, Realstruktur und
  Fachlichkeit `REVISE`; siehe
  [Tests, Abschnitt 18](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#18-zwei-isolierte-strategie-pocs-auf-synthetischem-ab-korpus).
  Der nachgelagerte vollständige AnythingLLM-Dokumentlauf enumerierte 276/276
  Seed-IDs ohne fachliche Hochstufung und führte den atomaren 8-Punkte-Lauf
  über Collector-PageMap, Dinghy/LanceDB und den importierten Agent-Skill aus.

## INT-20260825-029 — Zwei-Polizzen-Vergleich hat aktuelle Produktpriorität

- Erfasst: 2026-08-25
- Typ: `ZIEL`
- Status: `PROMOTED`
- Aussage: Der detaillierte Vergleich zweier Gebäudeversicherungspolizzen ist
  das aktuelle Hauptziel. Die Analyse eines einzelnen Dokuments bleibt
  erforderlich, weil A und B zunächst isoliert verstanden werden müssen, ist
  aber gegenüber dem A/B-Ergebnis nachgeordnet.
- Ist-Wahrheit: `JA` als direkt bestätigte Produktpriorität; keine Aussage über
  einen bereits kundenfähigen Implementierungsstand.
- Quelle: Paraphrasierte Nutzerkorrektur vom 25. August 2026.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Zwei hochgeladene Polizzen
  werden detailliert und beleggebunden gegenübergestellt; Unterschiede,
  Gemeinsamkeiten, Einschränkungen und punktweise Vor-/Nachteile sind das
  primäre sichtbare Ergebnis.
- Beziehungen:
  - priorisiert -> `INT-20260824-009`
  - ordnet_nach -> `INT-20260824-008`
  - begrenzt_durch -> `INT-20260824-011`, `FAIL-003`
- Entscheidung: Produktstrategie, Versuchsreihenfolge und spätere Abnahme am
  A/B-Vergleich ausrichten; Einzeldokumentanalyse als interne Voraussetzung
  und weiterhin zulässigen Nebenmodus erhalten.
- Kanonischer Ausgang:
  [Projektgedächtnis, bestätigter Ergebnisvertrag](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#21-bestätigter-ergebnisvertrag-für-den-aktuellen-kunden).

## INT-20260825-030 — Bidirektionaler Klauselabgleich als katalogunabhängiger Vergleichspfad

- Erfasst: 2026-08-25
- Typ: `IDEE`
- Status: `IN_PRÜFUNG`
- Aussage: Als von einer Excel-/Partnerkatalog-Schleife unabhängige Strategie
  können beide Dokumente vollständig in belegbare Klausel-, Tabellen- und
  Verweisgruppen zerlegt und anschließend in beide Richtungen semantisch sowie
  strukturell aufeinander ausgerichtet werden. Der primäre Vergleich entsteht
  dann als Vertrags-Diff zwischen korrespondierenden, nur in A vorhandenen,
  nur in B vorhandenen und nicht sicher zuordenbaren Klauselgruppen.
- Ist-Wahrheit: `NEIN` als fachlich bewiesener Produktpfad. `JA` als
  isolierter synthetischer Mechanik- und vollständiger AnythingLLM-REST-
  Dokument-Pipeline-PoC mit Collector-PageMap, Dinghy/LanceDB sowie Agent-Skill
  und 12 bestätigten 1:1-Paaren, einer katalogfremden B-Gruppe und 16 festen
  Diff-Zeilen.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Auch Unterschiede, die in
  keinem vorgegebenen Katalog stehen, können als Kandidaten sichtbar werden.
  Die Ausgabe folgt dem tatsächlichen Vertragsinhalt und kann danach zusätzlich
  fachlichen Kategorien zugeordnet werden.
- Vorgesehener Kern:
  1. Jeden Primärblock beider Dokumente dokumentisoliert erfassen.
  2. Kandidatenpaare aus Überschrift, Nummerierung, Wortlaut, Tabellenstruktur,
     Querverweisen und semantischer Ähnlichkeit bilden.
  3. A->B und B->A abgleichen; `1:1`, `1:n`, `n:1`, nur A, nur B und
     `unresolved` zulassen.
  4. Nur begrenzte korrespondierende Klauselgruppen an Qwen geben, damit es
     konkrete Unterschiede formuliert; Quellen und Ergebniszeilen bleiben
     serverseitig vollständig.
  5. Jede Klausel muss terminal als zugeordnet, fachlich ohne Gegenstück oder
     ungelöst enden. Fehlendes Gegenstück ist noch kein Beweis fehlender
     Deckung.
- Systembezug: Clause Ledger, PageMap, Tabellen-/Querverweisgraph,
  bidirektionales Retrieval, Qwen für begrenzte Differenzformulierung,
  Vergleichsausgabe und Coverage Manifest.
- Beziehungen:
  - stützt -> `INT-20260824-009`, `ADR-006`, `ADR-012`
  - ergänzt_unabhängig -> `INT-20260825-028`
  - begrenzt_durch -> `FAIL-001`, `FAIL-003`, `FAIL-004`, `INV-002`,
    `INV-003`, `INV-004`
- Hard-Gates: `OFFEN`; besonders Many-to-many-Zuordnung, Varianten,
  AVB/Nachträge, Querverweise, unbekannte Klauseln und Laufzeit sind noch
  unbewiesen.
- Riskanteste Annahme: Dass strukturell oder semantisch ähnliche Klauseln
  tatsächlich dieselbe fachliche Funktion und denselben Scope besitzen.
- Nächster Prüfschritt: schwierige 1:n-/n:m-, Tabellen-, Varianten-, Nachtrags-
  und Querverweisfälle ergänzen, anschließend ein lokal markiertes Holdout-
  Paar und den echten AnythingLLM-PDF-Upload mit A/B-Auswahl prüfen.
- Entscheidung: Als unabhängigen Challenger zur kataloggetriebenen Strategie
  prüfen, nicht vorschnell mit ihr vermischen und noch nicht implementieren.
- Kanonischer Ausgang: detaillierter, weiterhin ungeprüfter Umsetzungsvorschlag
  [`codex_umsetzungsidee1.md`](./codex_umsetzungsidee1.md); der Intake bleibt
  bis zur Validierung `IN_PRÜFUNG`.
- Versuchsevidenz: synthetischer 1:1- und katalogfremder Discovery-PoC `PASS`,
  Many-to-many, Realstruktur und Fachlichkeit `REVISE`; siehe
  [Tests, Abschnitt 18](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#18-zwei-isolierte-strategie-pocs-auf-synthetischem-ab-korpus).
  Der nachgelagerte AnythingLLM-Smoke rief den isolierten Diff-Skill auf,
  erzeugte 16/16 feste Diff-IDs und spiegelte 25 Inhaltsgruppen
  kandidatenbasiert gegen den 276er Partnerseed.

## INT-20260825-031 — LF Immo Exklusivschutz als kundenseitiges Referenzprodukt

- Erfasst: 2026-08-25
- Typ: `ZIEL`
- Status: `PROMOTED`
- Aussage: Der aktuelle Kunde verwendet das Produkt beziehungsweise
  Deckungskonzept „LF Immo Exklusivschutz“ als eigenes Referenzprodukt und
  wird voraussichtlich besonders häufig andere Gebäudeversicherungsprodukte
  dagegen vergleichen. Allgemeine A/B-Vergleiche anderer Polizzen bleiben
  weiterhin möglich.
- Ist-Wahrheit: `JA` als direkt bestätigter Kunden- und Produktkontext. Eine
  lokal read-only geprüfte Referenzunterlage bestätigt die konkrete
  Bezeichnung „LF IMMO EXKLUSIVSCHUTZ 2023“. Daraus folgt weder, dass jede
  Erwähnung dieselbe Version bezeichnet, noch dass der Name allein die
  Anwendbarkeit des Deckungskonzepts auf ein konkretes Vertragspaket beweist.
- Quelle: Paraphrasierte Nutzerangabe vom 25. August 2026 sowie lokale
  Prüfung der Produktidentität; keine Vertragsinhalte, Dateipfade, Hashes oder
  Kundendaten werden gespeichert.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Das System erkennt das
  kundenseitige Referenzprodukt zuverlässig, bezeichnet es in der Ausgabe
  konsistent und kann standardmäßig `Referenzprodukt` gegen
  `Vergleichsprodukt` darstellen, ohne die fachliche Bewertung vorwegzunehmen.
- Scope und ausdrückliche Nicht-Ziele:
  - Produktalias und bevorzugte Vergleichsrolle dürfen die Erkennung,
    Spaltenreihenfolge, Testpriorität und Darstellung steuern.
  - Sie dürfen keine Deckungstatsache, Vertragsgeltung, positive Gewichtung,
    Empfehlung oder automatische Siegerrolle erzeugen.
  - Jahrgang, Dokumentart, Versicherer, Variante, Geltungsbereich und
    einbezogene Bedingungen bleiben getrennte, belegpflichtige Merkmale.
- Evidenz und Beweisgrenze: Der konkrete Name und die Referenzrolle sind
  bestätigt. Noch nicht bewiesen sind vollständige Aliasliste, historische
  Versionen, Verwechslungsmöglichkeiten und die robuste Erkennung über alle
  realen Vertragspakete.
- Systembezug: Kunden-/Projektprofil, versioniertes Produktregister,
  Dokumentklassifikation, A/B-Rollen, UI-Spaltenbeschriftung, Promptkontext,
  Evaluation und Golden Cases. Die Erkennung sollte serverseitig
  konfiguriert werden; ein System-Prompt darf sie spiegeln, ist aber nicht die
  einzige Wahrheitsquelle.
- Beziehungen:
  - priorisiert -> `INT-20260825-029`
  - konkretisiert -> `INT-20260824-007`, `INT-20260824-009`
  - nutzt -> `INT-20260825-025`, `INT-20260825-026`, `INT-20260825-028`,
    `INT-20260825-030`
  - begrenzt_durch -> `INV-002`, `INV-004`, `FAIL-003`
- Hard-Gates: `BEGRENZT`; Referenzrolle und Produktname sind bestätigt,
  versions- und paketbezogene Anwendbarkeit muss weiterhin belegt werden.
- Bewertung: `akzeptieren mit Grenzen`.
- Evidenzqualität: `NUTZERANGABE` plus lokal beobachtete Produktbezeichnung.
- Riskanteste Annahme: Dass jede textliche Erwähnung des Produktnamens das
  tatsächlich geltende Produkt des hochgeladenen Vertragspakets bezeichnet.
- Nächster Prüfschritt: Einen kleinen versionsbewussten Product-Identity-
  Vertrag mit positiven, negativen und mehrdeutigen Beispielen definieren;
  anschließend die Referenzrolle in A/B-Ausgabe und Evaluation testen, ohne
  Ergebnisbias einzuführen.
- Entscheidung: Als dauerhaften Kundenkontext und primären Vergleichsfall
  aufnehmen; Produktidentität und Bewertungslogik strikt trennen.
- Kanonischer Ausgang:
  [Projektgedächtnis, kundenseitiges Referenzprodukt](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#23-kundenseitiges-referenzprodukt-lf-immo-exklusivschutz).

## INT-20260825-032 — Reale Gegenprobe bestätigt zwei komplementäre Kandidatenpfade

- Erfasst: 2026-08-25
- Typ: `EVIDENZHINWEIS`
- Status: `PROMOTED`
- Aussage: Eine lokale Realstruktur-Gegenprobe bestätigt, dass ein
  XLSX-/Occurrence-Pfad und ein davon unabhängiger Struktur-/Crosswalk-Pfad
  technisch getrennt, reproduzierbar und candidate-only orchestriert werden
  können.
- Ist-Wahrheit: `JA` als gemessener Kandidaten-/Review-Harness; `NEIN` als
  fachlich vollständige Dokumentanalyse oder A/B-Produktfreigabe.
- Evidenz: 153 bereinigte Referenzzeilen, 276 Partner-Seed-Zeilen, 21
  physische Seiten, 58 lexikalische Referenzkandidaten, ein konservativer
  Dinghy-Kandidat und Qwen-Stichprobe mit 3/8 formal validen Antworten. Der
  unabhängige Strukturpfad erzeugte aus denselben 21 Seiten 35 begrenzte,
  terminale Strukturgruppen und candidate-only Crosswalks ohne LLM-Aufruf.
- Beziehungen:
  - stützt -> `INT-20260825-028`, `INT-20260824-002`, `ADR-012`
  - begrenzt_durch -> `FAIL-003`, `INV-002`, `INV-003`
  - vorbereitet -> `INT-20260825-029`
- Hard-Gates: `NICHT_BESTANDEN`; kein manuelles Fact-Oracle, keine
  Tabellen-/Varianten-/Cross-Page-/WEG-Abnahme und kein reales A/B-Paar.
- Entscheidung: Katalog-/Occurrence-Pfad als kontrollierbaren Hauptkandidaten
  für feste Review-/Excel-Zeilen weiter testen; Struktur-/Crosswalk-Pfad als
  unabhängigen Discovery-/Auditpfad erhalten. Dinghy bleibt additiv, Qwen
  bleibt begrenzt und formal validierte Modellausgabe ist noch keine
  Rollenfreigabe.
- Kanonischer Ausgang:
  [Tests, Abschnitt 19](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#19-reales-ein-dokument-lernexperiment-der-katalog-occurrence-variante).

## INT-20260825-033 — Reales FEUER-A/B-Kandidatenexperiment mit Dinghy und Qwen

- Erfasst: 2026-08-25
- Typ: `EVIDENZHINWEIS`
- Status: `PROMOTED`
- Aussage: Ein isolierter lokaler FEUER-Gegenlauf über zwei reale
  Dokumentpakete bestätigt, dass vollständige physische Seitenerfassung,
  begrenztes Strukturledger, feste Partner- und Taxonomie-IDs, lexikalische
  Enumeration, additive Dinghy-Kandidaten, streng validierte Qwen-Einzelzeilen
  und eine fail-closed A/B-Ausgabe technisch zusammenarbeiten.
- Ist-Wahrheit: `JA` als lokales Architektur- und Kandidatenexperiment; `NEIN`
  als fachlich freigegebener FEUER-Vergleich oder Aussage, welcher Vertrag
  besser ist.
- Evidenz: 40/21 physische Seiten, davon eine terminale Blankoseite; alle
  39/21 inhaltlichen Seiten im Ledger; 36 Partnerpunkte und 22 getrennte
  Taxonomie-Discovery-IDs; 331 Retrieval-Kandidaten, darunter 12 ausschließlich
  semantische Dinghy-Kandidaten; 71 Qwen-Einzelaufrufe, davon 41 formal gültig
  und 30 fail-closed. Von den 41 gültigen Antworten blieben 40 fachlich
  `unresolved`. Originaltexte, Namen, Pfade und Fingerprints sind nicht Teil
  der Wissensbasis.
- Systembezug: `INV-001`, `INV-002`, `INV-003`, `INV-004`, `INV-006`,
  `FAIL-003`, `ADR-003`, `ADR-004`, `ADR-007`, `ADR-012`.
- Beziehungen:
  - stützt -> `INT-20260825-028`, `INT-20260825-029`, `INT-20260825-030`
  - verfeinert -> `INT-20260825-032`
  - begrenzt_durch -> `FAIL-003`, fehlendes FEUER-Faktenoracle
- Spezialistenurteil:
  - Local-AI/RAG: Dinghy ergänzt die lexikalische Spur nachweislich, bleibt
    aber Top-K-Kandidatengenerator. Embedding und Qwen müssen phasengetrennt
    laufen; gemeinsame Residenz führte lokal zu Modellverlust.
  - Kunde/Versicherung: Die feste FEUER-Zeilenmenge ist als Review-Queue
    brauchbar, aber ohne Rollen-, Varianten- und Vertragsrangprüfung kein
    Deckungsvergleich.
  - Datenschutz/Betrieb: Lokale Artefakte `0700/0600`; Volltexte, Gruppen und
    Zitate bleiben sensible lokale Daten und dürfen nicht committed werden.
  - Kritik/Test: Qwen 4B erreichte nur 41/71 formale Grounding-Pässe; 29
    Antworten scheiterten an nicht exaktem Zitat, eine an Truncation.
- Hard-Gates: `NICHT_BESTANDEN` für fachlichen Vergleich; `BESTANDEN` für den
  fail-closed Architekturversuch.
- Evidenzqualität: `GEMESSEN_ENTWICKLUNGSUMGEBUNG`.
- Riskanteste Annahme: Dass die ausgewählten lokalen Kandidatengruppen alle
  fachlich relevanten Occurrences und Scopes eines FEUER-Punkts enthalten.
- Nächster Prüfschritt: Manuelles FEUER-Oracle für Rollen, Varianten,
  Vertragsrang und Querverweise; occurrence-lokale Spans statt Gruppenanfang;
  Qwen nur für echte Ambiguität; Resume-Artefakte kryptografisch binden.
- Entscheidung: Architekturpfad weiterführen, Ergebnissemantik und
  Qwen-Breite begrenzen; keine Promotion zu Kundenvergleich.
- Kanonischer Ausgang:
  [Tests, Abschnitt 20](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#20-reales-feuer-ab-kandidatenexperiment-mit-dinghy-und-qwen).

## INT-20260825-034 — Dynamische Discovery und servereigene Span-IDs im Feuerpilot

- Erfasst: 2026-08-25
- Typ: `ENTSCHEIDUNGSKANDIDAT` plus `EVIDENZHINWEIS`
- Status: `PROMOTED`
- Aussage: Der Nutzer hat die lokale Implementierungsphase ausdrücklich
  wieder aufgenommen. Der Feuerpilot soll katalogunabhängig dynamische
  Dokumentstruktur sammeln und kleine lokale Modelle durch mehr
  deterministische Codearbeit entlasten. Die verwaltete Workspace-Baseline
  bleibt Top-N 32, Temperatur 0 und Suchmodus `default`.
- Ist-Wahrheit: `JA` als uncommitteter lokaler Entwicklungsstand im Worktree
  `policy-clean-implementation`; `NEIN` als Kundenfreigabe oder perfekte
  Dokumentanalyse.
- Quelle: Nutzerauftrag, Quellcodeprüfung, fokussierte Tests und lokale
  aggregierte Smoke-Messungen; keine Vertragswörter, Dateinamen, Pfade oder
  Fingerprints wurden übernommen.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Dokumenteigene Kategorien
  und Unterbezeichnungen bleiben wortgetreu sichtbar, während feste
  Partnerpunkte weiterhin getrennt abgearbeitet werden. Qwen wählt nur eine
  servereigene Evidenz-Span-ID oder `NONE`; Seite und Wortlaut stammen aus
  Code, nicht aus freier Modellgenerierung.
- Scope und ausdrückliche Nicht-Ziele: Kandidaten-/Reviewpfad für FEUER und
  dynamische Struktur; keine Rechtsauslegung, kein Vollständigkeitsversprechen,
  kein automatischer Gesamtsieger und noch keine fachliche Rollenfreigabe.
- Evidenz und Beweisgrenze:
  - zwei lokale Realstrukturen mit 40/21 Seiten und 1.193/1.544 nichtleeren
    Zeilen wurden in stabilen Line-Ledgern vollständig disponiert;
  - der katalogunabhängige Collector erzeugte 166/517 wortgetreue
    Struktur-/Inhaltslabel-Vorkommen; diese Anzahl ist kein Faktenrecall;
  - der Qwen-4B-Span-Smoke lieferte für zwei Dokumente jeweils 4/4 feste
    Ergebniszeilen; Per-Category waren 4/8, im reduzierten
    Drei-Spalten-Batch 6/8 servergebundene und vom kontrollierten Matcher
    passende Kandidaten. Alle blieben fachlich ungeprüft; beide Batches
    meldeten vorgelagertes Occurrence-Sampling sichtbar. Ein reicherer
    7/8-Lauf wurde wegen
    unvalidierter freier Modellfelder nicht als Vertrag beibehalten;
  - ein synthetischer Lauf bestand 2/2 Span-Zuordnungen und bestätigte den
    Dinghy-4B-Vertrag mit 2.560 Dimensionen;
  - Dinghy 0,6B rangierte im winzigen synthetischen Dreiervergleich ebenfalls
    den richtigen Kandidaten zuerst, war schneller, besitzt aber 1.024 statt
    2.560 Dimensionen. Das erlaubt keinen Wechsel ohne getrennten Namespace
    und vollständige Neueinbettung.
- Systembezug: `INV-001`, `INV-002`, `INV-004`, `INV-006`, `FAIL-003`,
  `FAIL-004`, `ADR-012`, `ADR-017`; Quellledger, Retrieval, Modellvertrag,
  deterministische Ausgabe, Workspace-Provisionierung und lokale Runtime.
- Beziehungen:
  - verfeinert -> `INT-20260825-033`
  - stützt -> `INT-20260824-002`, `INT-20260824-003`, `INT-20260824-004`
  - begrenzt_durch -> `FAIL-003`, fehlendes FEUER-Faktenoracle
- Spezialistenurteil:
  - Local-AI/RAG: Span-IDs beheben den häufigsten formalen Groundingfehler;
    Dinghy bleibt additive Kandidatenspur. Spans sind nun an
    Quellfingerprint, Originaloffset und exakten PageMap-Substring gebunden;
    Retrieval-Sampling und Span-Overflow bleiben getrennt sichtbar. Der
    Modellparser akzeptiert nur drei Spalten. Der nächste Engpass ist ein manuelles Oracle
    für Kandidatenpräzision und Rollen-/Scopebindung.
  - Kunde/Versicherung: Dynamische Labels dürfen nur Discovery sein. A/B wird
    weiterhin über belegte Fakten im gleichen Scope verbunden, nicht über
    ähnliche Überschriften.
  - Datenschutz/Betrieb: Tests blieben lokal; Wissensbasis enthält nur
    Aggregate. Der bestehende 2.560D-Index darf nicht mit 1.024D gemischt
    werden. Vollständige Discovery-Ledger werden content-addressiert einmal
    lokal mit `0600` gespeichert; Chats halten nur Referenzen und Kurzmetriken.
    Persistente In-flight-Leases schützen lang laufende Analysen bis zur
    Chat-Persistenz; abgebrochene Leases laufen zeitgebunden aus. Ein
    referenzbasierter Garbage Collector entfernt alte Orphans bei neuen Läufen
    und Löschvorgängen. Ungeklärte Nummerierungshierarchie bleibt auch in
    tieferen Nachfahren ungeklärt.
  - Kritik/Test: 4/4 feste Zeilen je Dokument beweisen nur formale
    Row-Ownership. Source-bound Kandidaten sind keine Dokumentfakten und keine
    Qualitätsquote.
- Hard-Gates: `BESTANDEN` für deterministische
  Row-/Span-/Seiten-/Offsetbindung, sichtbaren Overflow und auditierbare
  Source-Line-Disposition; `NICHT_BESTANDEN` für Fachlichkeit und A/B-Vorteil.
- Evidenzqualität: `GEMESSEN_ENTWICKLUNGSUMGEBUNG` plus
  `BEOBACHTET_CODE`.
- Riskanteste Annahme: Dass textzeilenbasierte Strukturkandidaten ohne
  vollständige PDF-Geometrie die fachlich relevanten Dokumentgliederungen mit
  ausreichender Präzision abbilden.
- Nächster Prüfschritt: manuelles FEUER-Occurrence-/Rollenoracle; danach
  Kandidatenpakete pro Einzelpunkt verkleinern, Betrag/Rolle/Negation/Variante
  deterministisch binden und Dinghy-0,6B nur in einem neu eingebetteten
  Vergleichsnamespace gegen Dinghy-4B messen.
- Entscheidung: Richtung begrenzt akzeptieren; nicht zu Kundenanalyse oder
  Embeddingmodellwechsel promoten.
- Kanonischer Ausgang:
  [Tests, Abschnitt 21](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#21-span-id-und-dynamische-discovery-iteration-im-feuerpilot).

## INT-20260826-035 — Globales N32 deckt ein Neun-Dokumente-Paket nicht vollständig ab

- Erfasst: 2026-08-26
- Typ: `BEOBACHTUNG` plus `EVIDENZHINWEIS`
- Status: `PROMOTED`
- Aussage: Zwei instrumentierte Built-in-Läufe über neun gemeinsam zu
  betrachtende Vertragsdokumente übertrugen bei globalem Default-N32 nur sechs
  beziehungsweise sieben Dokumente an Qwen. Ein globales Top-N ist damit auch
  empirisch kein Dokument- oder Kategorien-Coveragevertrag.
- Ist-Wahrheit: `JA` für die gemessenen Modellinputs; `NEIN` als Aussage, dass
  die nicht übertragenen Dokumente nicht importiert oder eingebettet wurden.
- Quelle: Nutzerbestätigte unveränderte Konfiguration sowie mechanisch
  ausgewertete Modellinput-Logs und Outputs auf Kundenhardware; keine
  Kundendokumentnamen, Texte, Pfade oder Fingerprints wurden übernommen.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Eine einzige sichtbare
  Anfrage soll intern jedes Dokument für jede Fachkategorie terminal prüfen,
  ohne manuelle Chatblöcke und ohne stille Top-N-Auslassung.
- Scope und ausdrückliche Nicht-Ziele: Mehrdokument-Coverage und
  Quellenprovenienz; keine Behauptung eines gemessenen Faktenrecalls, keine
  fachliche Freigabe und kein Beweis für Top-N 55.
- Evidenz und Beweisgrenze: VS 32 Kontexte aus 6/9 Dokumenten;
  Leitungswasser 32 Kontexte aus 7/9 Dokumenten. Die Aufgaben verwendeten
  unterschiedliche Fachkataloge und sind kein fachlicher A/B-Vergleich.
- Systembezug: `INV-003`, `INV-004`, `FAIL-004`, `FAIL-005`, Retrieval,
  Coverage-Manifest, Mehrdokument-Orchestrierung.
- Beziehungen:
  - stützt -> `INT-20260824-004`, `INT-20260825-027`, `ADR-017`
  - verfeinert -> `INT-20260825-034`
  - begrenzt_durch -> fehlendes vollständiges Faktenoracle
- Spezialistenurteil:
  - Local-AI/RAG: Dokumentgebundene Kategorieabdeckung muss vor globaler
    Synthese hergestellt werden; Dinghy bleibt additive Kandidatenspur.
  - Kunde/Versicherung: Mehrere Dokumente dürfen gemeinsam einen Vertrag
    belegen, dürfen aber nicht ohne Rolle, Rang und Scope verschmolzen werden.
  - Datenschutz/Betrieb: Nur aggregierte Laufmetriken werden versioniert.
  - Kritik/Test: Sechs oder sieben vertretene Dokumente messen
    Kontextdiversität, nicht Faktenrecall oder Importvollständigkeit.
- Hard-Gates: `NICHT_BESTANDEN` für vollständige Mehrdokumentanalyse.
- Evidenzqualität: `GEMESSEN_KUNDENHARDWARE`.
- Riskanteste Annahme: Dass alle neun Dokumente tatsächlich zum selben
  Vertragsbestand und zur selben Gültigkeitshierarchie gehören.
- Nächster Prüfschritt: Importmanifest und terminale Coverage-Matrix
  `Kategorie × Dokument` instrumentieren und gegen ein anonymisiertes Oracle
  prüfen.
- Entscheidung: globales N32 als Vollständigkeitspfad verwerfen; als normale
  Chat-Retrievalgrenze weiter zulässig.
- Kanonischer Ausgang:
  [Tests, Abschnitt 22](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#22-neun-dokumente-paket-mit-globalem-n32).

## INT-20260826-036 — Freie Modellzitate scheitern im Mehrdokumentlauf

- Erfasst: 2026-08-26
- Typ: `BEOBACHTUNG` plus `EVIDENZHINWEIS`
- Status: `PROMOTED`
- Aussage: Trotz eines expliziten wörtlichen Quellenvertrags waren nach
  NFKC-/Leerraumnormalisierung nur 6/18 VS- und 2/29
  Leitungswasser-Quellenfragmente exakte zusammenhängende Teilstrings des
  tatsächlichen Modellinputs.
- Ist-Wahrheit: `JA` als formale Groundingmessung; `NEIN` als Behauptung, dass
  jedes nicht exakte Fragment fachlich falsch war.
- Quelle: Mechanischer Vergleich der ausgegebenen Quellenfragmente mit den
  tatsächlichen Modellinputs; Rohtexte und Fragmente werden nicht versioniert.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Dokumentname, physische
  Seite und wörtlicher Beleg müssen technisch prüfbar und nicht frei von Qwen
  rekonstruiert sein.
- Scope und ausdrückliche Nicht-Ziele: formale Zitat- und Quellenprovenienz;
  keine fachliche Wahrheitsermittlung allein durch Stringvergleich.
- Evidenz und Beweisgrenze: Beide Tabellen besaßen 36 Zeilen, verletzten aber
  den wörtlichen Quellenvertrag überwiegend durch Ellipsen, zusammengesetzte
  Satzteile oder neu verbundene Beträge.
- Systembezug: `INV-001`, `INV-004`, `FAIL-004`, `ADR-018`, servereigene
  Evidence-Spans und deterministischer Renderer.
- Beziehungen:
  - stützt -> `INT-20260825-033`, `INT-20260825-034`, `ADR-018`
  - verfeinert -> `INT-20260826-035`
- Spezialistenurteil:
  - Local-AI/RAG: Mehr Promptstrenge ersetzt keinen serverseitigen
    Teilstring-/Spanvertrag.
  - Kunde/Versicherung: Ein inhaltlich plausibles Paraphrasat ist kein
    wörtliches Vertragszitat.
  - Datenschutz/Betrieb: Nur Zähler und Methode werden gespeichert.
  - Kritik/Test: String-Grounding ist ein notwendiges Quellen-Gate, aber kein
    Rollen-, Scope- oder Vertragsrang-Gate.
- Hard-Gates: `NICHT_BESTANDEN` für wörtliche Quellen; Fachlichkeit offen.
- Evidenzqualität: `GEMESSEN_KUNDENHARDWARE`.
- Riskanteste Annahme: Dass die linearisierte Textebene selbst den sichtbaren
  Vertragswortlaut vollständig und richtig wiedergibt.
- Nächster Prüfschritt: Qwen nur Span-IDs auswählen lassen; Seite und Wortlaut
  aus kanonischer PageMap und Originaloffset übernehmen.
- Entscheidung: freie Modellzitate für kundenfähige Ausgabe verwerfen.
- Kanonischer Ausgang:
  [Tests, Abschnitt 22](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#22-neun-dokumente-paket-mit-globalem-n32).

## INT-20260826-037 — Mehrere Dokumente dürfen gemeinsam belegen, aber nicht verschmelzen

- Erfasst: 2026-08-26
- Typ: `ZIEL` plus `ENTSCHEIDUNGSKANDIDAT`
- Status: `PROMOTED`
- Aussage: Mehrere Dokumente eines Vertragsbestands dürfen Belege zur selben
  Fachkategorie beitragen. Jede Fundstelle muss jedoch Dokumentidentität,
  Dokumentrolle, physische Seite, Originalspan, Betrag und Geltungsbereich
  getrennt behalten; Beträge und Bedingungen werden nicht automatisch
  addiert oder verschmolzen.
- Ist-Wahrheit: `JA` als bestätigter Ergebnisbedarf; die konkrete
  Vertragsranglogik ist noch offen.
- Quelle: Nutzerklarstellung im Zusammenhang mit dem Neun-Dokumente-Test,
  gegen die bestehenden Provenienz- und Scope-Invarianten geprüft.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Der Makler sieht alle
  getrennten, belegten Regelungen eines Dokumentpakets in derselben
  Kategorienzeile und kann sie fachlich beurteilen.
- Scope und ausdrückliche Nicht-Ziele: gemeinsamer Vertragsbestand; keine
  Vermischung unabhängiger Verträge, Varianten oder zeitlich abgelöster
  Fassungen und kein automatischer Gesamtsieger.
- Evidenz und Beweisgrenze: Produktziel bestätigt; Priorität von Polizze,
  Nachtrag, Rahmenvereinbarung sowie allgemeinen und besonderen Bedingungen
  benötigt ein eigenes fachliches Gate.
- Systembezug: `INV-001`, `INV-004`, Rollen-/Scopebindung,
  Vertragsdokumentpaket, deterministischer Renderer.
- Beziehungen:
  - verfeinert -> `INT-20260824-007`, `INT-20260824-008`, `INT-20260824-010`
  - hängt_ab_von -> Dokumentrollen- und Vertragsrangmodell
  - stützt -> `INT-20260826-035`
- Spezialistenurteil:
  - Local-AI/RAG: Coverage-Zellen werden je Kategorie und Dokument getrennt
    erzeugt und erst anschließend serverseitig zusammengeführt.
  - Kunde/Versicherung: Widersprüche sind nur im gleichen Scope und Rang als
    solche zu bewerten; unterschiedliche Geltungsbereiche bleiben getrennt.
  - Datenschutz/Betrieb: Dokument-IDs und Rollen sind lokal zu halten; keine
    Kundendetails in der Wissensbasis.
  - Kritik/Test: Zwei Dokumente mit derselben Seite und ähnlicher Klausel
    müssen im Output weiterhin eindeutig unterscheidbar sein.
- Hard-Gates: `BEGRENZT`; Ergebnisbedarf bestätigt, Vertragsrangmodell offen.
- Evidenzqualität: `NUTZERANGABE` plus `BEOBACHTET_CODE`.
- Riskanteste Annahme: Dass die Dokumentrolle aus Dateityp oder Titel sicher
  ableitbar ist; sie sollte explizit oder überprüfbar erfasst werden.
- Nächster Prüfschritt: synthetischer Mehrdokument-Golden-Case mit allgemeiner
  Bedingung, besonderer Bedingung, Nachtrag, getrennten Limits und echtem
  Widerspruch.
- Entscheidung: als Ergebnisvertrag akzeptieren; konkrete Ranglogik vor
  Implementierung offen halten.
- Kanonischer Ausgang:
  [Tests, Abschnitt 22](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#22-neun-dokumente-paket-mit-globalem-n32).

## INT-20260826-038 — Kontrollierte Mehrdokument-Kategorienserie vor Lösungsdiskussion

- Erfasst: 2026-08-26
- Typ: `ZIEL` plus `EVIDENZHINWEIS`
- Status: `IN_PRÜFUNG`
- Aussage: Mit demselben bereits eingebetteten Neun-Dokumente-Paket und
  unveränderter technischer Konfiguration werden getrennte Läufe für
  Leitungswasser, Sturm, Elementar und FEUER durchgeführt. Lösungen und
  Architekturansätze sollen erst nach Abschluss und gemeinsamer Auswertung
  der Serie diskutiert werden.
- Ist-Wahrheit: `JA` als bestätigter Versuchsplan. Sturm- und Elementar-Output
  sind als `MDP-20260826-ST01` und `MDP-20260826-EL01` identifiziert und
  formal gemessen; die zugehörigen Modellinput-Logs liegen noch nicht vor.
  Der FEUER-Lauf war beim Chatabschluss noch in Verarbeitung und besitzt noch
  keine registrierte Run-ID.
- Quelle: Nutzerangabe; keine Kundendokumente, Rohtexte, Pfade oder
  Fingerprints übernommen.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Erst eine breitere,
  vergleichbar protokollierte Fachkategorienserie soll die wiederkehrenden und
  kategoriebesonderen Fehlerklassen sichtbar machen.
- Scope und ausdrückliche Nicht-Ziele: Messung und Protokollierung; noch keine
  Konfigurationsänderung, Lösungsauswahl, Architekturentscheidung oder
  Produktfreigabe.
- Evidenz und Beweisgrenze: Der bereits registrierte Leitungswasserlauf wird
  bei neuen Artefakten per Hash auf Doppelung geprüft. Statuszahlen
  unterschiedlicher Kataloge sind nicht direkt als Qualitätsrangfolge
  vergleichbar. Der Sturm-Output beweist 36/36 Strukturzeilen, 11/6/19
  `BELEGT`/`TEILBELEGT`/`UNGEKLÄRT`, fünf formale Deckung-/Statusverstöße und
  fehlende Dokumentkennungen in den Quellen; ohne Modellinput sind Retrieval,
  Zitattreue und Fachrichtigkeit offen. Der Elementar-Output enthält 36-mal
  `UNGEKLÄRT`; zwei Zeilen verletzen dabei die zwingende Fallback-Zellbelegung.
  Ihre Zitate tragen außerdem nicht die dort behaupteten Sparten- und
  Rollenzuordnungen.
  Dieses Nulltrefferbild beweist ohne Modellinput weder tatsächliches Fehlen
  der Themen noch einen bestimmten Retrievalfehler.
- Systembezug: Experimentprotokoll, `FAIL-004`, `FAIL-005`,
  Mehrdokument-Run-Ledger und Kategorien-Golden-Cases.
- Beziehungen:
  - folgt_auf -> `INT-20260826-035`, `INT-20260826-036`
  - hängt_ab_von -> vollständige Modellinput-Logs und Outputs je Fachlauf
- Spezialistenurteil:
  - Local-AI/RAG: Pro Lauf sind tatsächliche Kontextanzahl,
    Dokumentverteilung und Chunkverteilung neu zu messen.
  - Kunde/Versicherung: Fachkataloge werden getrennt bewertet; gleiche
    Statuszählung bedeutet nicht gleiche fachliche Qualität.
  - Datenschutz/Betrieb: Nur anonymisierte Aggregate werden versioniert.
  - Kritik/Test: Run-ID erst nach Artefaktidentifikation vergeben, um den
    vorhandenen LW-Lauf nicht doppelt zu zählen.
- Hard-Gates: `OFFEN` bis alle vorgesehenen Artefakte geprüft sind.
- Evidenzqualität: `NUTZERANGABE`.
- Riskanteste Annahme: Dass zwischen den Fachläufen außer Katalog und Auftrag
  tatsächlich keine Workspace-, Index- oder Runtimevariable verändert wird.
- Nächster Prüfschritt: Je Lauf Modellinput und Tabellenoutput hashen,
  mechanisch messen und in das anonymisierte Mehrdokument-Ledger aufnehmen;
  als Nächstes den FEUER-Output und soweit vorhanden seine Token-/Modelllogs.
- Entscheidung: Lösungsdiskussion bis zum Abschluss der Serie zurückstellen.
- Kanonischer Ausgang: noch keiner; geplante Konsolidierung nach Eingang der
  vollständigen Kategorienserie.

## INT-20260826-039 — Top-N-Provenienz ist von Einbettungsprovenienz getrennt

- Erfasst: 2026-08-26
- Typ: `EVIDENZHINWEIS` plus `ENTSCHEIDUNGSKANDIDAT`
- Status: `IN_PRÜFUNG`
- Aussage: Ein neuer Einzeldokument-Output wurde mit gemeldetem Top N 32 gegen
  einen früher als Top N 55 bezeichneten Output verglichen. Top N ist ein
  Chat-Abruflimit und kein Einbettungsparameter; ein Wechsel 32/55 erfordert
  kein Re-Embedding.
- Ist-Wahrheit: `JA` für die Codewirkung und die gemessenen Outputs; `NEIN`
  für einen kausalen Qualitätsvorteil von 32 oder 55.
- Quelle: anonymisierte Outputaggregate, vorhandener Modellinput und
  Codeprüfung; keine Kundendokumente, Rohtexte, Pfade oder Fingerprints
  übernommen.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Konfigurationstests sollen
  nur dann als A/B gelten, wenn Einstellung, Indexidentität und tatsächlich
  übertragener Kontext eindeutig protokolliert sind.
- Scope und ausdrückliche Nicht-Ziele: Provenienz- und Outputvergleich; keine
  Produktfreigabe und keine Aussage, dass ein höheres Top N generell besser
  ist.
- Evidenz und Beweisgrenze: Der frühere Lauf übertrug 27 Kontexte und ist
  deshalb mit Top N 32 wie 55 vereinbar. Der neue Output erreicht 25/33 statt
  27/33 Oracle-Statusmatches, besitzt aber noch keinen Modellinput. Die
  gecachte Dokumentvariante ist nicht eindeutig identifiziert. Ein
  Side-by-Side-Screenshot bestätigt links/rechts die beiden Outputidentitäten;
  die dort nicht sichtbaren Top-N-Werte bleiben Nutzerzuordnung.
- Systembezug: Retrievalkonfiguration, Experimentprotokoll, `FAIL-004`,
  `FAIL-005`.
- Beziehungen:
  - folgt_auf -> `INT-20260826-038`
  - verfeinert -> Trennung von Textchunk, Vektoranzahl und Top N
  - hängt_ab_von -> vollständiger Modellinput und Konfigurationssnapshot des
    neuen Laufs
- Spezialistenurteil:
  - Local-AI/RAG: Höchstens 32 übertragene Kontexte identifizieren das
    konfigurierte Limit nicht; 55 kann ebenfalls weniger Treffer liefern.
  - Kunde/Versicherung: Höhere Positivquote ist kein Accuracy-Beleg; der neue
    Lauf ist beim Arbeitsoracle schwächer.
  - Datenschutz/Betrieb: Nur anonymisierte Aggregate versionieren.
  - Kritik/Test: Sauberer 32/55-A/B-Test ohne Re-Embedding, mit unverändertem
    Index, neuem Chat, Einstellungsnachweis und Modellinput je Lauf.
- Hard-Gates: `OFFEN` wegen fehlender Runtimenachweise des neuen Laufs.
- Evidenzqualität: `GEMESSEN_KUNDENHARDWARE` plus `BEOBACHTET_CODE`.
- Riskanteste Annahme: Dass die gecachte Dokumentvariante denselben Indexinhalt
  wie der frühere Lauf besitzt.
- Nächster Prüfschritt: Dokumentidentität und aktuellen Indexstand sichern,
  danach denselben Index nacheinander mit Top N 32 und 55 abfragen und beide
  Modellinputs protokollieren.
- Entscheidung: Historische Läufe ohne direkten Top-N-Beleg als nicht
  identifizierbar führen; keine Neueinbettung nur wegen Top-N-Änderung.
- Kanonischer Ausgang:
  [Tests, Abschnitt 23](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#23-top-n-32-gegen-früher-als-55-bezeichneten-einzeldokumentlauf).

## INT-20260826-040 — Prompt-Cache-Belegung ist kein Tokenkontext

- Erfasst: 2026-08-26
- Typ: `BEOBACHTUNG`
- Status: `PROMOTED`
- Aussage: LM-Studio-Felder `used_mib`, `cap_mib` und
  `lifetime_evicted_mib` beschreiben Prompt-Cache-Speicher und dürfen nicht als
  Anzahl der Kontext-Tokens interpretiert werden.
- Ist-Wahrheit: `JA` für die Loginterpretation; `OFFEN` für das Tokenbudget
  des konkreten Laufs.
- Quelle: Anonymisierte LM-Studio-INFO-Meldungen aus einem lokalen
  Kategorienlauf und Code-/Dokumentationsprüfung; keine Dokumentinhalte.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Kontextprobleme werden
  anhand echter Tokenmetriken diagnostiziert und laufende Analysen nicht wegen
  einer zufällig ähnlichen MiB-Zahl unnötig abgebrochen.
- Scope und ausdrückliche Nicht-Ziele: Gilt für die Cache-Loginterpretation;
  beweist weder die fachliche Richtigkeit des Laufs noch, dass der aktuelle
  Prompt in das Modellfenster passt.
- Evidenz und Beweisgrenze: Cacheverdrängung ist belegt. Ein Kontextüberlauf
  erfordert getrennt Model-Input-/Tokenstatistiken, Kürzungsmarker oder eine
  ausdrückliche Fehlermeldung.
- Systembezug: Modell | Betrieb | Datenfluss; betroffen sind `FAIL-004` und
  die lokale Kontextbudgetierung.
- Beziehungen:
  - verfeinert -> `INT-20260826-039`
- Spezialistenurteil:
  - Local-AI/RAG: Primär Performance-/Cache-Reuse-Signal, kein Recall-Beleg.
  - Kunde/Versicherung: Keine fachliche Aussage über die FEUER-Ausgabe.
  - Datenschutz/Betrieb: Nur anonymisierte Betriebsmetriken gespeichert.
  - Kritik/Test: Geladenes Kontextfenster sowie Prompt- und Completion-Tokens
    getrennt erfassen.
- Hard-Gates: `BEGRENZT`
- Bewertung: 94/100
- Evidenzqualität: `GEMESSEN_KUNDENHARDWARE` plus `BEOBACHTET_CODE`
- Riskanteste Annahme: Der Model-Input des konkreten Laufs liegt noch nicht
  als vollständige Tokenmessung vor.
- Nächster Prüfschritt: Model-Input und Tokenstatistiken gegen die geladene
  Kontextlänge prüfen und ausreichend Ausgabebudget nachweisen.
- Entscheidung: akzeptieren
- Kanonischer Ausgang: Tests, Abschnitt 24; Auswertungsentscheidung D-017.

## INT-20260831-001 — Qualifiziertes Nichtfinden als Vergleichsannahme

- Erfasst: 2026-08-31
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `PROMOTED`
- Aussage: Ein nach einem versionierten, vollständig ausgeführten Suchvertrag
  nicht gefundener Vergleichspunkt darf als eigener Dokumentbefund und als
  punktweise Annahme „für diesen Vergleich nicht enthalten“ behandelt werden,
  ohne daraus einen ausdrücklichen Vertragsausschluss zu erfinden.
- Ist-Wahrheit: `JA` für die implementierte opt-in Vergleichsregel bei
  `VS-16`; `NEIN` für eine globale Abwesenheits- oder beliebige
  Polizzenbehauptung.
- Quelle: paraphrasierte Nutzeranforderung, V3-Codeprüfung und synthetische
  Mac-Studio-Vertragstests; keine Kundentexte oder Kunden-PDFs übernommen.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Ein ausdrücklich
  eingeschlossener Garagen-/Stellplatzschutz erhält gegenüber einem
  vollständig geprüften Paket ohne entsprechenden kontrollierten Treffer
  einen verständlich begründeten Punktvorteil.
- Scope und ausdrückliche Nicht-Ziele: zunächst nur `VS-16`; kein
  `coverageEffect: EXCLUDED`, kein Gesamtsieger, keine Aussage über nicht
  bereitgestellte Vertragsdokumente und kein OCR-Vollständigkeitsversprechen.
- Evidenz und Beweisgrenze: 11 relevante Suites / 189 Tests, Prettier,
  geänderte Server-/JSX-Lintpfade und Frontend-Build auf dem Mac Studio am
  exakten Codecommit `a4e286d6395de9c921098d2883f72d4e13391f90`.
- Systembezug: Produkt, Datenfluss, UI, Export; verfeinert `INV-002` und
  `INV-007`, führt `INV-008` und `ADR-022` ein.
- Beziehungen:
  - verfeinert -> `ADR-021`
  - begrenzt_durch -> `INV-002`, `INV-003`, `INV-004`
- Spezialistenurteil:
  - Local-AI/RAG: Null Occurrences sind nur bei vollständiger Textseiten- und
    Prozesscoverage aussagefähig; Bildseiten und offene Kandidaten bleiben
    fail-closed.
  - Kunde/Versicherung: Vergleichsannahme und ausdrücklicher Ausschluss müssen
    sprachlich und maschinenlesbar getrennt bleiben.
  - Datenschutz/Betrieb: Nur Suchplan- und Zählmetadaten werden persistiert;
    keine neuen Kundentexte in der Knowledge Base.
  - Kritik/Test: exakte Wortgrenzen und adversariale Nachbartreffer verhindern
    rohe `GARAG*`-Fehlschlüsse.
- Hard-Gates: `BEGRENZT`
- Bewertung: 91/100 für den eng freigegebenen `VS-16`-Vertrag.
- Evidenzqualität: `SYNTHETISCH_GETESTET` plus `GEMESSEN_KUNDENHARDWARE`
- Riskanteste Annahme: Der kontrollierte `VS-16`-Wortschatz deckt die
  relevanten Garagen-/Stellplatzformulierungen unbekannter Versicherer noch
  nicht empirisch vollständig ab.
- Nächster Prüfschritt: fremde, fachlich gelabelte Dokumentholdouts und
  seitenweise OCR-Qualifikation für gemischte PDFs.
- Entscheidung: begrenzt akzeptieren
- Kanonischer Ausgang: [ADR-022](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-022-qualifiziertes-nichtfinden-ist-vergleichsannahme-kein-ausschluss),
  Architektur Abschnitt 17, Projektgedächtnis Abschnitt 13 und Tests Abschnitt 46.

## 7. Bestätigte Produktzielkarte

```text
AnythingLLM (lokale Bedien- und Workflowoberfläche)
  -> LM Studio (lokale Modelle)
  -> genau 1 Vertragsdokumentpaket
       -> 1..n zusammengehörige Quelldokumente
       -> paketisolierte Gebäudeversicherungsanalyse
       -> pro Dokument getrennte Rolle, Seite, Span, Wert und Scope
       -> Fakten, Einschränkungen, Quellen und offene Punkte zusammenführen
  -> genau 2 Vertragsdokumentpakete
       -> Paket A isoliert analysieren
       -> Paket B isoliert analysieren
       -> nur vergleichbare Punkte und Faktrollen verbinden
       -> Unterschiede, Gemeinsamkeiten und punktweise Vor-/Nachteile
```

Eine profilbasierte Gesamtwertung ist kein bestätigter Bestandteil. Bis zur
Klärung von `INT-20260824-011` bleibt der Vergleich punktweise und ohne
pauschalen Gesamtsieger.

## INT-20260831-031 — Fünf Kategorien und ein Einblatt-Kundenexport

- Erfasst: 2026-08-31
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `PROMOTED`
- Aussage: Der produktive A/B-Lauf soll ausschließlich VS, FE, LW, ST und EL
  ausführen und die 224 Punkte in einem Arbeitsblatt im Stil der manuellen
  `Gesamtvergleich`-Vorlage ausgeben.
- Ist-Wahrheit: `JA` für die implementierte und synthetisch validierte
  Lauf-/Exportstruktur; `NEIN` für eine fachliche 224-Zeilen-Freigabe.
- Quelle: Nutzerangabe und lokal bereitgestellte Referenzarbeitsmappe; keine
  Vertragsinhalte oder Kundendaten werden in der KB gespeichert.
- Gewünschter Kundennutzen und sichtbares Ergebnis: eine kompakte,
  durchgehende A/B-Tabelle mit genau einem verständlichen KI-Ergebnis je
  Vergleichspunkt.
- Scope und ausdrückliche Nicht-Ziele: HP, VB und WE nicht produktiv starten,
  aber Kataloge nicht löschen; kein Gesamtsieger; keine freie LLM-Nachwertung;
  technische Auditdaten nicht aus dem privaten JSON entfernen.
- Evidenz und Beweisgrenze: Mac-Studio-Struktur- und Layoutprüfung mit 224
  synthetisch materialisierten Zeilen; kein neuer Modell- oder Fachlauf.
- Systembezug: Produkt, Runner, Resume, Persistenz, UI, Export; `INV-007`,
  `INV-008`, `INV-009`, `ADR-021`, `ADR-022`, `ADR-023`.
- Hard-Gates: `BEGRENZT`
- Bewertung: akzeptiert als sichtbarer Produkt- und Exportvertrag.
- Evidenzqualität: `SYNTHETISCH_GETESTET` und `BEOBACHTET_CODE`
- Riskanteste Annahme: Dass die fünf gewählten Ansichten den gewünschten
  Lieferumfang dauerhaft vollständig repräsentieren.
- Nächster Prüfschritt: fachliche 224-Zeilen-Abnahme mit versioniertem Oracle
  und zuvor unbekannten Mehrversicherer-Paketen.
- Entscheidung: akzeptieren und versionieren.
- Kanonischer Ausgang: `ADR-023`, Architektur Abschnitt 18, Tests Abschnitt 47.

## INT-20260901-032 — Jede Zeile entscheidet und einseitig belegter Schutz kann gewinnen

- Erfasst: 2026-09-01
- Typ: `ENTSCHEIDUNGSKANDIDAT`
- Status: `IN_PRÜFUNG`
- Aussage: Jede sichtbare Vergleichszeile soll ein verständliches Ergebnis
  liefern. Wenn ein positiver Schutz in genau einer Polizze belegt ist und in
  der anderen nach einem vollständig validierten Alias-/Konzept-Suchvertrag
  keine passende Regelung gefunden wird, soll die belegte Seite als
  punktweiser Vorteil ausgewiesen werden. Der Text muss gleichzeitig sichtbar
  sagen, dass auf der anderen Seite nichts gefunden und kein ausdrücklicher
  Ausschluss belegt wurde.
- Ist-Wahrheit: Der allgemeine Mechanismus für zertifizierte Schutzpositionen
  existiert, aber die produktive Registry ist leer. Der Wunsch ist deshalb
  noch nicht für die 224 Zeilen aktiviert.
- Quelle: ausdrückliche Nutzerkorrektur nach dem V7-Fünferlauf.
- Gewünschter Kundennutzen und sichtbares Ergebnis: Jede Zeile ist verständlich
  entschieden; einseitig dokumentierter Schutz verschwindet nicht hinter
  einer neutralen technischen Meldung.
- Scope und ausdrückliche Nicht-Ziele: Kein erfundener Gewinner bei echter
  Gleichheit, unterschiedlichen Scopes, gemischten Gewinnern oder
  unvollständiger Suche. Nicht gefundene Limits, Selbstbehalte, Ausschlüsse,
  Bedingungen oder Definitionen erhalten ohne eigenen typisierten Vertrag
  keine automatische Vorteilsrichtung.
- Evidenz und Beweisgrenze: Nutzeranforderung plus aktueller
  `ASSUMED_NOT_INCLUDED`-Mechanismus; produktive Zeilenfreigaben und unbekannte
  Holdouts fehlen.
- Systembezug: Punktentscheidung, Negativsuchvertrag, Registry, UI, XLSX,
  Produktcharter; `INV-002`, `INV-007`, `INV-008`, `ADR-021`, `ADR-022`,
  `ADR-024`.
- Beziehungen:
  - verfeinert -> `INT-20260831-031`
  - hängt_ab_von -> zeilenweise Alias-/Konzept-, Scope- und Holdout-Prüfung
- Spezialistenurteil:
  - Local-AI/RAG: Suchvollständigkeit muss digest- und paketgebunden sein.
  - Kunde/Versicherung: „nicht gefunden“ und „ausgeschlossen“ bleiben sichtbar
    getrennt; die Vergleichsannahme darf trotzdem einen punktweisen Vorteil
    tragen.
  - Datenschutz/Betrieb: keine neue externe Verarbeitung erforderlich.
  - Kritik/Test: Eine pauschale Aktivierung aller Zeilen würde bekannte
    False-Negatives in falsche Vorteile umwandeln.
- Hard-Gates: `BEGRENZT`
- Bewertung: als Zielrichtung bestätigt; Aktivierung weiterhin zeilenweise.
- Evidenzqualität: `NUTZERANGABE` und `BEOBACHTET_CODE`
- Riskanteste Annahme: Dass ein als vollständig geltender Suchvertrag keine
  relevante unbekannte Formulierung übersieht.
- Nächster Prüfschritt: Versionierten Vergleichsvertrag V4 implementieren und
  reine Schutzpositionen einzeln gegen positive, negative, adversariale und
  unbekannte Dokumentvarianten zertifizieren.
- Entscheidung: Richtung akzeptieren, produktive Zeilenaktivierung begrenzen.
- Kanonischer Ausgang: Entscheidung/Charter-Update nach erster bestandener
  Einzelzertifizierung.

## 8. Vorläufige Strategiekarte aus `INT-20260824-002` bis `INT-20260824-006`

Status: `IN_PRÜFUNG`; dies ist eine verknüpfte Arbeitshypothese, keine neue
Implementierungsbehauptung oder ADR.

```text
kanonischer Text + PageMap + Layout
  -> lückenloses Clause Ledger
  -> TargetSpec aus versionierter Wort-/Rollenmatrix
  -> alle kontrollierten FTS-Vorkommen + additive Dinghy-Kandidaten
  -> einzelne Occurrence-Spans mit Originaloffsets
  -> strukturadaptiver Context Graph
       Satz/Zelle -> Klausel -> belegte Fortsetzung/Tabelle -> Heading/Variante
  -> Role Span Binder
       Rolle -> Wert | Bedingung | Ausschluss | Obliegenheit | Quelle
  -> unresolved oder kleine beleggebundene Modellprüfung
  -> Coverage Manifest
  -> serverseitig vollständige Ausgabe aller validierten Fact-IDs
```

Die Wortmatrix beschreibt bekannte Such- und Rollenverträge. FTS enumeriert
alle kontrollierten exakten Vorkommen. Dinghy ergänzt semantische Kandidaten.
Der Context Graph bildet Dokumentfluss und Strukturbeziehungen ab. Erst der
Role Span Binder entscheidet, welche Spans fachlich zusammengehören. Keine
dieser Schichten darf allein eine sichere Negativ- oder
Vollständigkeitsbehauptung erzeugen.

## 9. Eintragstemplate

```md
## INT-YYYYMMDD-NNN — Kurztitel

- Erfasst: YYYY-MM-DD
- Typ: ZIEL | IDEE | ANNAHME | BEOBACHTUNG | EVIDENZHINWEIS |
  OFFENE_FRAGE | ENTSCHEIDUNGSKANDIDAT
- Status: OFFEN | IN_PRÜFUNG | PROMOTED | GESCHLOSSEN
- Aussage: Eine einzelne, präzise Aussage.
- Ist-Wahrheit: NEIN – Intake, nicht als implementiert oder akzeptiert bestätigt.
- Quelle: Paraphrasierte Benutzerangabe, Gespräch, Testhinweis oder Codefund;
  keine Geheimnisse oder realen Kundentexte.
- Gewünschter Kundennutzen und sichtbares Ergebnis:
- Scope und ausdrückliche Nicht-Ziele:
- Evidenz und Beweisgrenze: Link oder `noch keine`.
- Systembezug: Produkt | Datenfluss | Persistenz | UI | Modell | Betrieb |
  Datenschutz; betroffene INV-/FAIL-/ADR-IDs.
- Beziehungen:
  - stützt -> INT-... / ADR-...
  - widerspricht -> INT-... / FAIL-...
  - hängt_ab_von -> INT-...
  - verfeinert -> INT-...
- Spezialistenurteil:
  - Local-AI/RAG:
  - Kunde/Versicherung:
  - Datenschutz/Betrieb:
  - Kritik/Test:
- Hard-Gates: BESTANDEN | BEGRENZT | NICHT_BESTANDEN | OFFEN
- Bewertung: noch nicht bewertet | N/100
- Evidenzqualität: ANNAHME | NUTZERANGABE | SYNTHETISCH_GETESTET |
  GEMESSEN_ENTWICKLUNGSUMGEBUNG | GEMESSEN_KUNDENHARDWARE | BEOBACHTET_CODE
- Riskanteste Annahme:
- Nächster Prüfschritt: konkrete Frage, Messung oder Codeprüfung.
- Entscheidung: offen | akzeptieren | begrenzen | verwerfen | zurückstellen
- Kanonischer Ausgang: noch keiner | Link auf Projektgedächtnis, Architektur,
  Entscheidungen, Tests oder Setup.
```

## 10. Datenschutz beim Erfassen

- Kundenangaben werden so knapp wie möglich paraphrasiert.
- Keine echten Kundendokumente, Volltexte, Namen, Adressen, Vertragsnummern,
  lokalen Dateipfade, Hashes, Datenbanken, Vektoren, Logs, `.env`-Werte oder
  Geheimnisse eintragen.
- Golden Cases verwenden nur synthetische oder vollständig anonymisierte
  Strukturen.
