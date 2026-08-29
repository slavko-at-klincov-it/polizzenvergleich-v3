# Fachkataloge für den Polizzenvergleich

Stand: 25. August 2026

Dieses Verzeichnis enthält versionierte, maschinenlesbare Fachkandidaten und
Pilotverträge. Ein Katalogeintrag ist weder implementierter Produktumfang noch
fachlich freigegebene Wahrheit.

## Trennung der Wissensebenen

```text
category_view
  -> Navigation und Darstellung

comparison_point
  -> stabile fachliche Bedeutung

point_requirement
  -> benötigte Wissensart und Faktrolle

knowledge_record
  -> konkrete Aussage mit eigener Provenienz
```

Ein Vergleichspunkt kann gleichzeitig Dokumentfakten, Kundeneingaben,
externe Risikodaten, Broker-Regeln und rechtliche Prüfung benötigen. Deshalb
darf `knowledgeKind` nicht direkt am Vergleichspunkt hängen.

Zulässige Wissensarten für Requirements:

- `document_fact`
- `customer_input`
- `external_risk`
- `broker_rule`
- `legal_review`

## Harte Grenzen

- Fehlende Evidenz ist kein Ausschluss und keine Negativaussage.
- Kategorien sind Views und keine Faktenidentitäten.
- Ein Vergleichspunkt erzeugt null bis viele Fakten und Evidenzspannen.
- Broker-Regeln, Zielwerte, Marktannahmen und Gewichte sind niemals
  `DocumentFact`.
- Ein validierter Dokumentfakt benötigt kanonische Dokumentevidenz mit
  Source Hash, Run-/Dokument-/Blockscope, Originaloffsets und PageMap-Seite.
- Kataloge sind Seeds. Weitere belegte Vertragsinhalte bleiben erlaubt und
  müssen als Discoveries sichtbar werden.
- Dokument A und B werden nie gemeinsam dedupliziert.
- Unterschiedliche Werte, Varianten oder Polaritäten bleiben getrennt oder
  werden als Konflikt markiert.

## Outputklassen

1. `DocumentFact` – atomarer, dokumentisolierter Fakt ohne Wertung.
2. `DocumentAnalysisFinding` – serverseitig aus Fact-IDs abgeleitete Aussage.
3. `RelativeComparison` – A/B-Urteil nach bestandenem Comparability Gate.
4. `BrokerBenchmarkAssessment` – versionierte externe Broker-Regel gegen
   Facts und bestätigtes Profil.
5. `CustomerRecommendation` – profilgebunden und fachlich freigegeben.
6. `OpenQuestion` – fehlende Unterlage, Widerspruch oder Rückfrage.
7. `ProcessCoverageStatus` – technische Coverage, getrennt von Deckung.
8. `ExternalObjectEvidence` – etwa HORA, Wartung, Gutachten oder
   Kundeneingabe mit eigener Provenienz.

## Dateien

- `building-insurance-claude-seed.v0.1.json`: 190 unvalidierte fachliche
  Vergleichs-/Intake-Kandidaten und 12 getrennte Broker-Regelkandidaten aus
  dem sichtbaren Claude-Share. Nur die Punktbezeichnungen wurden übernommen.
- `building-insurance-partner-276-seed.v0.1.source.md`: unveränderter
  Quellsnapshot des nachgereichten 276-Zeilen-Partnerkatalogs. Enthaltene
  Prompt-, Batch-, Gewichtungs- und Excel-Anweisungen sind nicht freigegeben;
  Quell-IDs sind noch keine kanonischen Punkt-IDs.
- `water-target-specs.v0.1.json`: erster Pilotvertrag für Leitungswasser mit
  Rollen-, Kontext- und Ambiguitätsgrenzen.
- `water-golden-case-classes.v0.1.json`: 25 synthetische/anonymisierte
  Struktur- und Rollenklassen für die fachliche Pilotabnahme.
- `broker-rule-contract.v0.1.schema.json`: gesperrter Governancevertrag für
  spätere fachlich freigegebene Broker-Regeln; automatisches Scoring bleibt in
  dieser Version verboten.

## Import- und Freigaberegel

Jede gemischte Quellzeile wird vor Aktivierung atomisiert. Ein Requirement ist
eindeutig über:

```text
pointId + knowledgeKind + factRole + applicabilityScope + version
```

Ein Broker-Regelkandidat benötigt vor Aktivierung mindestens Quelle,
Gültigkeitszeitraum, Jurisdiktion, Objekt-/Profilbezug, Operator, Einheit,
Ausnahmen, verantwortliche Fachfreigabe und Golden Cases. Der Default ist
`autoScoreAllowed=false`.

Veröffentlichte Katalog- und Regelversionen werden nicht überschrieben.

Bei einer Nachfolgefassung wird der alte Seed nicht still ersetzt. Jede
Quellzeile erhält zunächst einen Crosswalkstatus wie `SAME`, `SPLIT`, `MERGE`,
`NEW`, `RECLASSIFIED`, `RULE_ONLY` oder `REJECTED`. Die normalisierte Zahl der
Vergleichspunkte und Requirements darf von der Zahl der Quellzeilen abweichen.

Lokale Strukturprüfung:

```bash
node knowledge-catalogs/validate-catalogs.js
```
