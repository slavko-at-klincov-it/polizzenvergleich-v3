# Polizzenvergleich – kontrolliertes Experimentprotokoll

Stand: 25. August 2026

Dieses Protokoll verbindet Versuche aus getrennten Chats, ohne aus einzelnen
guten Antworten vorschnell eine Architektur- oder Produktentscheidung
abzuleiten. Es gilt für lokale Tests mit AnythingLLM, LM Studio, Qwen,
Embeddings und einem oder zwei Versicherungsdokumenten.

Kundendokumente, Originaltexte, lokale Pfade, Dokumenthashes, Datenbanken,
Vektoren, Rohlogs und Geheimnisse werden nicht versioniert. In die
Wissensbasis kommen nur anonymisierte Konfigurationen, Messwerte, Fehlerklassen
und Beweisgrenzen.

## 1. Drei getrennte Versuchsebenen

| Ebene | Zulässige Aussage | Nicht bewiesen |
| --- | --- | --- |
| Konfigurationstest | Eine konkrete Modell-/RAG-Konfiguration läuft unter den dokumentierten Bedingungen besser oder schlechter als die Baseline. | Zielarchitektur, Vollständigkeit oder Kundenfähigkeit |
| Architekturexperiment | Eine abgegrenzte Aufgabenverteilung oder Datenstruktur verbessert eine definierte Metrik an Golden Cases. | Generalisierung auf alle Policen oder fachliche Freigabe |
| Produktabnahme | Der vollständige Nutzerpfad erfüllt vorab festgelegte fachliche, technische und betriebliche Gates. | garantierte rechtliche Vollprüfung |

Ein Lauf darf mehrere Beobachtungen erzeugen, erhält aber immer nur die
niedrigste nachweisbare Einstufung. Ein langer oder überzeugend formulierter
Output ist kein eigener Qualitätsnachweis.

## 2. Run-Manifest

Jeder vergleichbare Lauf erhält eine stabile ID `EXP-YYYYMMDD-NNN` und genau
eine bewusst geänderte Variable gegenüber einer benannten Baseline.

```text
Run-ID:
Fragestellung/Hypothese:
Versuchsebene: KONFIGURATION | ARCHITEKTUR | PRODUKT
Baseline-Run:
Einzige geänderte Variable:

Runtime:
  Repository/Branch/HEAD:
  tatsächlich gestarteter Pfad:
  AnythingLLM-Version:
  LM-Studio-Version/Runtime:
  Hardware/RAM:
  geladene Modelle und Serialisierung:

Dokumentprofil, anonymisiert:
  Dokumentart und Versionshierarchie:
  Seitenzahl:
  native Textschicht/OCR:
  Tabellen/Spalten/Varianten:
  Seitenfortsetzungen/Querverweise:
  bekannter Golden-Scope:

Ingestion/Retrieval:
  Parser/OCR:
  Chunk- oder Clause-Strategie:
  Chunkgröße/Overlap:
  Embeddingmodell/Dimension/Query-Präfix:
  Search-Modus/Top-N/Threshold/Reranking:
  Index neu oder wiederverwendet:

Generator:
  exakte Modell-ID/Quantisierung:
  Kontextlänge:
  Temperature/Sampling/Thinking:
  Outputlimit:
  System- und Nutzerprompt-Version:
  neuer oder fortgesetzter Chat:

Erwartetes Soll:
  bekannte Occurrences:
  erwartete Fact-Rollen und Werte:
  erwartete Evidenz/PageMap-Seiten:
  erwartete unresolved-/Negativfälle:

Messung:
  Cold-/Warm-Laufzeit:
  Prompt-/Outputtokens:
  Peak-RAM/Swap:
  Modell-/Embeddingaufrufe:
  Runtimefehler/Finish-Reason:

Ergebnis und Beweisgrenze:
  bestandene Gates:
  fehlgeschlagene Gates:
  zusätzliche Funde:
  was der Lauf ausdrücklich nicht beweist:
  Entscheidung: BEIBEHALTEN | VERWERFEN | WEITER_PRÜFEN
```

Ändern sich mehrere Variablen, ist der Lauf als Exploration zulässig, aber
nicht kausal auswertbar. Eine nachfolgende kontrollierte Wiederholung muss die
vermutete Ursache isolieren.

## 3. Getrennte Messachsen

### Dokument- und Retrieval-Coverage

- kanonische physische Seiten und Primärblöcke verarbeitet,
- bekannte lexikalische Occurrences gefunden/gesamt,
- semantische Kandidaten und Kandidaten-Overflow,
- kontrollierte Occurrences terminal `resolved`, `rejected` oder `unresolved`,
- unbekannte zusätzliche Klauseln sichtbar statt durch den Katalog verworfen.

### Fakten- und Relationsqualität

- Precision/Recall getrennt nach Deckung, versicherter Sache, Definition,
  Limit, Selbstbehalt, Bedingung, Ausschluss und Obliegenheit,
- korrekte Bindung von Betrag, Einheit, Basis, Periode und Aggregation,
- Objekt-, Sparten-, Varianten- und Gültigkeitsscope,
- Cross-Reference-, Tabellen- und Seitenfortsetzungsbeziehungen,
- False Positives, Duplikate, Fremdkontext und ungelöste Kandidaten.

### Provenienz und Ehrlichkeit

- exakte Belegspanne und physische PageMap-Seite,
- keine erfundenen Seiten, Klauseln oder Quellen,
- `nicht belegt` getrennt von `ausdrücklich ausgeschlossen`,
- keine stille Auslassung einer Pflichtsektion,
- jede Zusammenfassung referenziert feste Fact-/Finding-IDs.

### Betrieb und Nutzerwert

- Upload bis Basisbereitschaft,
- Cold-/Warm-Antwortzeit,
- Prompt-/Outputtokens und Modellaufrufe,
- Peak-RAM, Swap, Absturz- und Neustartverhalten,
- verständliche Hauptansicht plus vollständiger Drill-down,
- keine technischen Pflichtschritte für den Kunden.

## 4. Harte Abbruch- und Ungültigkeitsregeln

Ein Lauf ist kein Produkt-PASS, sobald mindestens eines zutrifft:

1. erfundene oder falsche Quelle/PageMap-Seite,
2. kritische Rollenverwechslung wie Selbstbehalt gegen Jahreslimit,
3. Retrieval-Miss wird als fehlende Deckung oder `nein` ausgegeben,
4. Dokument-, Varianten- oder Spartenscope wird vermischt,
5. bekannte Pflichtsektion oder kontrollierte Occurrence wird still ausgelassen,
6. globales Top-N wird als Vollständigkeitsbeweis verwendet,
7. mehrere Variablen wurden geändert, aber die Verbesserung einer einzelnen
   Ursache zugeschrieben,
8. Runtime, Modell-ID, Quantisierung, Indexzustand oder Promptversion sind nicht
   reproduzierbar dokumentiert,
9. ein zweiter Lauf desselben Modells wird als unabhängige Verifikation gewertet,
10. Kundenhardware-/SLA-Grenze wird überschritten.

Solche Läufe dürfen weiterhin wertvolle Fehlerklassen oder Kandidaten liefern.
Ihr zulässiges Urteil lautet dann `EXPLORATION`, `CONFIG_REVISE` oder
`ARCHITECTURE_REVISE`, nicht `kundenfähig`.

## 5. Minimales Golden-Set vor einem Implementierungsplan

Mindestens enthalten sein müssen:

- positive Deckung, expliziter Ausschluss, bedingte Deckung und Obliegenheit,
- mehrere Geldrollen im selben Block,
- Prozentwert mit Minimum/Maximum und Bezugsbasis,
- allgemeine AVB plus besondere Bedingung oder Nachtrag,
- Querverweis über Dokumentteile und Fortsetzung über Seiten,
- mehrseitige Tabelle mit Varianten-/Spaltenbindung,
- WEG-Objektscope und spartenfremder Nachbarkontext,
- Paraphrase ohne Katalogkeyword sowie OCR-/Trennstrichvariante,
- katalogfremde Klausel und widersprüchliche Klauseln,
- nicht belegter Prüfpunkt, der `unresolved` statt `nein` bleibt,
- korrekte physische PageMap trotz abweichender gedruckter Seitennummer.

Für den späteren A/B-Modus kommen Paarfälle hinzu: gleicher Punkt bei gleichem
Scope, gleiches Label bei anderem Scope, nur einseitig belegte Evidenz,
gegensätzliche Trade-offs, unterschiedliche Perioden/Basen, AVB-/Nachtrag-
Hierarchie und strikte Quellenisolation zwischen A und B.

## 6. Decision-Gate „genug Informationen für Implementierungsplan“

Das Gate ist erst bestanden, wenn:

1. eine Zielvertikale und ihr sichtbarer Ergebnisvertrag feststehen,
2. Baseline und Varianten über vollständige Run-Manifeste reproduzierbar sind,
3. ein eingefrorenes, nicht zum Prompt-Tuning verwendetes Golden-Set existiert,
4. Retrieval, Faktenrollen, Relationen, Provenienz, Unresolved-Verhalten,
   Laufzeit und Ressourcen getrennt gemessen wurden,
5. aus der Evidenz eindeutig folgt, was deterministischer Code, Retrieval,
   begrenzte Modellprüfung und reine Formulierung leisten sollen,
6. für die erste Implementierung eine falsifizierbare Hypothese, Zielmetrik und
   Abbruchgrenze benannt sind.

Dieses Gate reicht für einen nachvollziehbaren Plan, noch nicht automatisch für
eine Kundenfreigabe.

## 7. Aktuelle Vollkontext- und Generatorprobe

Dieser Abschnitt ist das Kurzurteil der letzten beiden Läufe. Die vollständige
Built-in-Kampagne einschließlich Pinning, BGE-/Dinghy-A/B bei N6 und N10,
Temperaturvergleich, ungültigem Routinglauf und N32-Korrektur steht kanonisch
in
[Tests und Erkenntnisse, Abschnitt 17](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#17-original-anythingllm-vollständige-built-in-konfigurationskampagne)
und maschinenlesbar im
[Run-Ledger](./experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json).

Die Default-N32-Vollkontextprobe aus
[`INT-20260825-021`](./POLIZZENVERGLEICH_WISSENSINTAKE.md#int-20260825-021--original-anythingllm-default-n32-vollkontextprobe)
ist ein `KONFIGURATIONS-PASS` für breitere Kontextzufuhr, aber für beide
getesteten Generatoren ein `PRODUKT-REVISE`:

- korrekte `dinghy`-zu-`qwen`-Route,
- 29.882 statt 2.450 wirksame Prompttokens,
- deutlich breiterer Faktenfund,
- dennoch 0 von 98 belastbare Klausel-/Punktquellen,
- 15 unmögliche Seitenangaben,
- Rollen-, Sparten-, Pflichtstruktur- und Negativstatusfehler,
- etwa 16 Minuten End-to-End-Laufzeit.

Der kontrollierte Wechsel bei identischem Dinghy-/Default-N32-Pfad auf Gemma
bestätigte die Grenze: 30.524 Prompttokens, aber nur 45 Tabellenzeilen und 37
eindeutige Positionen statt Qwens 98 beziehungsweise 75. Leitungswasser sank
von 31 auf 5 und Sturm von 18 auf 4 Zeilen. Gemma war rund ein Drittel
schneller und bei der Premiumrolle vorsichtiger, verfehlte aber ebenfalls die
Provenienz-, Pflichtstruktur- und Vollständigkeits-Gates.

Damit ist der isolierte Generator-A/B abgeschlossen. Der nächste Test ändert
nicht erneut Search, Top-N oder Chatmodell, sondern prüft abschnittsweise
Mehrpass-Extraktion mit einem getrennten Quellen-/Anchor-Validator. Erster
Golden Case ist Leitungswasser. Ein sichtbarer Nutzerauftrag darf mehrere
kontrollierte interne Schritte auslösen; ein einziger freier Modellaufruf ist
keine Produktanforderung.

## 8. Vertrauliche Real-Dokument-Kampagne

Echte Vertragspakete bleiben vollständig lokal. Ein Paket umfasst das
Polizzenblatt beziehungsweise Angebot und die tatsächlich einbezogenen
AVB/BVB, Klauseln, Nachträge sowie die ausgewählte Variante. Fehlt ein Teil,
lautet der Status `Paket unvollständig`, niemals automatisch `nicht versichert`.

### Auswahl statt Vollanalyse aller Dokumente

Minimal sinnvoll sind sechs strukturverschiedene Pakete:

- zwei Entwicklungsdokumente für Prompt-/Workflowlernen,
- vier unangetastete Holdouts,
- gemeinsam native und OCR-Texte, kurze und lange Bedingungen, Tabellen und
  Varianten, Nachträge/Overrides, Querverweise sowie dichte Mehrbetragsklauseln.

Zuerst werden synthetische Golden Cases ausgeführt. Danach folgt lokal nur der
Leitungswasser-Mehrpass: Scope/Inventar, Occurrence-Enumeration,
Faktrollenextraktion, Quellen-/Anchor-Prüfung und sichtbare Unresolved-Fälle.
Erst nach Bestehen wird eine strukturell andere Kategorie geprüft. Ein
dokumentweiter Discovery-Restpass verhindert, dass katalogfremde Klauseln
stumm verschwinden.

### Lokales Oracle

Pro Paket werden lokal 20 bis 30 absichtlich schwierige Fälle mit erwarteten
0..n Fakten, Rolle, Wert/Basis, Bedingung, Objekt-/Variantenscope, physischer
Seite und erlaubten Relationen erfasst. Entwicklungsdokumente dürfen das
Promptdesign ändern; Holdouts werden nur mit eingefrorenem Prompt, Katalog,
Index und Pipelineprofil ausgeführt.

### Zulässige Rückmeldung an die Wissensbasis

Nur manuell datenschutzgeprüfte Aggregate:

- grobe Strukturklassen und Dokumentzahl,
- Anzahl Oracle-Fälle je Rolle/Kategorie,
- True/False Positive, False Negative und korrektes `unresolved`,
- Precision/Recall sowie Rollen-, Wert-, Bedingungs-, Scope- und
  Provenienzfehler,
- Laufzeitbereiche, Token-/Modellaufrufzahlen und Ressourcenklasse,
- abstrakte Fehlercodes wie `ROLE_AMOUNT_CROSS_BIND`,
- neu erfundene synthetische Minimalfälle ohne Originalwerte.

Nicht übertragen werden Originale, Ausschnitte, Zitate, Screenshots,
Produkt-/Kundennamen, Vertragswerte, seltene Objektmerkmale, Seitenbilder,
Dateinamen, Pfade, Hashes, Chunk-IDs, Vektoren, Datenbanken, Prompts mit
Kundentext, Rohantworten oder Logs. Qwen-Anonymisierung benötigt abschließende
menschliche Prüfung.

## 9. Verbindliches Laufregister

Für abgeschlossene Kampagnen reicht eine Zusammenfassung im Chat nicht. Jeder
Lauf erhält dauerhaft:

- stabile ID und Kampagnenzuordnung,
- Nutzer-/UI-Konfiguration getrennt von im Runtime-Log beobachteter
  Konfiguration,
- Pin-, Upload- oder ungepinnten Workspace-Transferweg,
- Indexprovenienz und ob neu indexiert wurde,
- beabsichtigte Einzelvariable sowie tatsächlich weitere Unterschiede,
- technischen Evidenzstatus,
- Antwort-Proxys und fachliche Hard-Gate-Fehler,
- `PROVES` und `DOES_NOT_PROVE`,
- Vergleichsgruppe und Entscheidungsausgang.

Das aktuelle Register ist
[`experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json`](./experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json).
Neue Runs dürfen bestehende Zeilen nicht still überschreiben. Korrekturen
erhalten eine eigene Run-ID oder eine ausdrücklich verlinkte
Invalidierungsbeziehung.

Zeilenzahl, Wörter, eindeutige Positionsnamen und Klauselcodes sind
Diagnoseproxies. Sie werden nie als `Recall` bezeichnet, solange kein
vollständiges Faktrollen-Oracle den Nenner definiert. Ein Modell kann mehr
Zeilen durch Duplikation erzeugen, einen Code nennen und trotzdem Limit,
Selbstbehalt, Bedingung oder Wirkungsrichtung falsch extrahieren.

Ein Kampagnenurteil wird erst geschlossen, wenn:

1. alle Läufe im Register erfasst sind,
2. ungültige Läufe von Qualitätsläufen getrennt sind,
3. direkte A/B-Paare und ihre Konfounder benannt sind,
4. fachliche Hard-Gates getrennt von Runtime-PASS bewertet sind,
5. der nächste Versuch entweder eine neue falsifizierbare Hypothese oder eine
   andere Workflowarchitektur prüft.
