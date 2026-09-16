# Workflow-Maps und Capability-Wiederverwendung

Stand: 15. September 2026  
Change-Set: `CAPABILITY-INVENTORY-20260915-001`  
Kanonisches Inventar:
[`POLIZZENVERGLEICH_CAPABILITY_INVENTAR_V1.json`](./POLIZZENVERGLEICH_CAPABILITY_INVENTAR_V1.json)

Dieses Dokument ist eine lesbare Projektion des maschinenlesbaren Inventars.
Es ist keine zweite Knowledge Base und keine neue Produktarchitektur. Aktueller
Quellcode und Tests bleiben die technische Wahrheit; datierte Runs beweisen nur
ihren gebundenen Stand.

## 1. `LF_REFERENCE_A_DRIVEN_V2`

```text
CAP-ORCH-001  Modus, Sitzung, Worker, Resume
  -> CAP-INGEST-001  PDF-Extraktion
  -> CAP-PROV-001    PageMap und Quellenoffsets
  -> CAP-A-001       SourceBlockLedger und Unit-Plan
  -> CAP-A-002       begrenzte Qwen-Klassifikation/Atomisierung
  -> CAP-A-003       dynamisches A-Manifest
  -> CAP-A-004       automatisches A-Integritätsgate
  -> CAP-B-001       Komponenten-x-B-Dokument-Suchplan, BM25, Synonyme
  -> CAP-B-002       Struktur/Klausel/Nachbarschaft
  -> CAP-B-003       Dinghy
  -> CAP-B-004       Kandidatenunion und klausellokale Kompaktierung
  -> CAP-B-005       vollständiger B-Korpus
  -> CAP-B-006       komponentenweise Qwen-Gegenstückprüfung
  -> CAP-B-007       Vollkorpus-Abwesenheit, Rescue, finale Entscheidung
  -> CAP-RESULT-001  binärer A-geordneter LF-Rollup
  -> CAP-RESULT-002  atomare JSON/Markdown/XLSX-Publikation und API/UI
```

Der aktuelle V2-Runner
[`run-a-driven-reference-product-v2.command`](../run-a-driven-reference-product-v2.command)
verdrahtet diese Reihenfolge tatsächlich. Gold-283 (`CAP-QA-001`) ist ein
getrennter QA-Messpfad und keine Quelle für Produktionszeilen.

## 2. Vollständiger symmetrischer A/B-Modus

```text
CAP-ORCH-001  Modus, Sitzung, Worker, Resume
  -> CAP-INGEST-001  PDF-Extraktion
  -> CAP-PROV-001    PageMap und seitenbewusste Chunks
  -> CAP-AB-001      Occurrences/FTS, Struktur und Nachbarschaft je Kategorie
  -> CAP-SEM-001     Werte-, Rollen-, Scope-, Bedingungs- und Wirkungsbindung
  -> CAP-AB-002      sequenzielle Analyse beider Pakete und symmetrischer Rollup
  -> CAP-RESULT-002  atomare Ergebnis-/XLSX-Publikation und API/UI
```

Dieser Modus bleibt ein eigener Laufvertrag. Das dynamische A-Zeilenuniversum
des LF-Modus darf nicht in den symmetrischen 224-Zeilen-Kundenvertrag
hineininterpretiert werden.

## 3. Gemeinsame Capability-Matrix

| Capability-Gruppe | LF V2 | A/B | Befund |
| --- | --- | --- | --- |
| Upload, Modus, Sitzung, Queue, Worker, Resume | produktiv aktiv | produktiv aktiv | tatsächlich gemeinsam |
| PDF-Extraktion und PageMap | aktiv | aktiv | tatsächlich gemeinsam |
| Occurrence-/FTS-Worksheet | nicht direkt verdrahtet | aktiv | wiederverwendbare Primitive, anderer Vertrag |
| Werte-/Rollen-/Scope-/Wirkungsverträge | aktiv verwendet | aktiv verwendet | semantischer gemeinsamer Kern |
| BM25/Synonyme/Struktur/Dinghy | aktiv | Dinghy nicht produktiv verdrahtet | derzeit parallel statt vollständig gemeinsam |
| Komponentenweise Gegenstückprüfung | aktiv | nicht verdrahtet | LF-spezifische Orchestrierung über allgemeine Semantik |
| Abwesenheit/Rescue | aktiv verdrahtet, frischer Lauf noch ausständig | nicht verdrahtet | LF-Vertrag; bilaterale Semantik wäre separat zu definieren |
| Artefaktpublikation, Reader, Export, UI | produktiv aktiv | produktiv aktiv | tatsächlich gemeinsam |
| Gold-283 | QA-only | inaktiv | bekannte LF-Regression, keine Produktquelle |

## 4. Tatsächlich gemeinsam verwendete Bausteine

- `CAP-ORCH-001`: Uploadmanifest, Moduspersistenz, Worker-Lease, Run-Signatur,
  Fortschritt, Abbruch und Resume.
- `CAP-INGEST-001` und `CAP-PROV-001`: PDF-Texte, physische PageMap,
  Dokumenthash und servereigene Quellenoffsets.
- `CAP-SEM-001`: gemeinsame semantische Grundbegriffe für Rolle, Scope, Wert,
  Bedingung und Wirkung; die konkreten Aufrufverträge unterscheiden sich.
- `CAP-MODEL-001` und `CAP-CACHE-001`: lokale Modellserialisierung,
  Timeout-/Retry-Sicherheit und validierte Wiederverwendung.
- `CAP-RESULT-002`: atomare Artefaktgrenze, Ergebnisleser, Export und UI.

## 5. Parallel oder doppelt implementierte Fähigkeiten

1. Kandidatensuche: Der A/B-Pfad verwendet `CAP-AB-001`; LF V2 verwendet
   `CAP-B-001` bis `CAP-B-004`. Beide besitzen lexikalische und strukturelle
   Navigation, aber unterschiedliche Eingabe- und Vollständigkeitsverträge.
   Das ist derzeit eine begründete Parallelität, keine freigegebene
   Doppelimplementierung zum Zusammenlegen.
2. Modellorchestrierung: A/B-Triage/Evidence und LF-A-/B-Klassifikation haben
   getrennte CLI-Runner mit verwandten Timeout-/Cache-Primitiven. Ein späterer
   gemeinsamer Transportkern ist eine sinnvolle `EXTRACT_SHARED_CORE`-Option,
   darf aber den laufenden fachlichen Vertrag nicht verändern.
3. Ergebnisrollup: A/B rollt zwei gleichberechtigte Pakete in ein fixes
   Kundenprofil; LF V2 rollt ausschließlich dynamische A-Requirements gegen B.
   Die getrennte Semantik ist erforderlich, die atomare Publikation ist bereits
   gemeinsam.

## 6. Vorhanden, aber nicht verdrahtet

- Dinghy ist im LF-V2-Produktpfad aktiv, im vollständigen A/B-Produktpfad aber
  nur als frühere Shadow-/PoC-Fähigkeit vorhanden.
- Die LF-V2-Komponentensuchmatrix könnte langfristig einen gemeinsamen
  A/B-Retrievalkern speisen; aktuell existiert dafür kein bilateraler
  Produktcaller.
- Der bidirektionale Vertrags-Diff (`CAP-EXP-002`) bleibt `DEFERRED` und
  `AVAILABLE_NOT_WIRED`.

## 7. Verworfen oder später reaktivierbar

- Das freie monolithische LLM-Vollinventar (`CAP-EXP-001`) bleibt
  `REJECTED`/`INACTIVE`. Mehr Kontext, ein größeres Modell oder weitere Retries
  sind kein Root-Cause-Fix für Vollständigkeit und Quellenbindung.
- Der bidirektionale Diff-PoC (`CAP-EXP-002`) darf erst erneut geprüft werden,
  wenn ein gemeinsames Komponenten-/Kandidatenschema und ein echter unbekannter
  A/B-Holdout existieren.
- Das feste LF-283er-Profil (`CAP-LEGACY-001`) bleibt für historische
  Lesbarkeit aktiv, ist für neue LF-V2-Zeilen aber `SUPERSEDED`.

## 8. Bewertung der 204 primären B-Batches

Kurzurteil: Für den bereits hashgebunden gestarteten V62-Lauf sind die 204
Planbatches **unverändert notwendig**. Sie bilden die aktuelle semantische
Gegenstückentscheidung zwischen vollständigem Mehrkanal-Retrieval und
Vollkorpus-Abwesenheitsprüfung. Eine nachträgliche Verkürzung würde den
Laufvertrag und damit die Vergleichbarkeit des laufenden Ergebnisses ändern.

- Bereits reduziert: Requirement-Gruppierung, Kandidatenkompaktierung,
  validiertes Resume und adaptiver Split nach sicher gesetteltem Timeout.
- Bereits deterministisch: Dokument-/Komponentenmatrix, Queryvarianten, BM25,
  Klauselgrenzen, Kandidatenunion, Hash-/ID-/Quellenprüfung und PASS-Persistenz.
- Noch nicht deterministisch ersetzbar: Die fachliche Entscheidung, ob
  sprachlich verschiedene B-Klauseln denselben Identitätskern tragen, nur
  verwandt sind oder eine Gegenwirkung formulieren.
- Mögliche spätere Reduktion: Erst nach dem fertigen Lauf können nachweislich
  triviale Cluster als allgemeine deterministische Regeln identifiziert und
  gegen Gold plus Holdouts geprüft werden. Das ist derzeit eine Hypothese,
  keine aktive Capability.
- Gemeinsamer A/B-Kern: Die Retrievalprimitiven sind ein Kandidat für
  `EXTRACT_SHARED_CORE`, ersetzen aber nicht rückwirkend diese 204
  Entscheidungen und dürfen die zwei Produktmodi nicht semantisch vermischen.

## 9. Schnellster bestehender Produktpfad

1. Den laufenden frischen V62-Primär-B-Pass unverändert bis 204/204
   terminalisieren.
2. Danach die bereits verdrahtete Vollkorpus-Abwesenheits- und Rescuephase
   ausführen; keinen neuen Parallelpfad bauen.
3. Binäres Ergebnis und Gold-283-Regression materialisieren und nur
   quellengebundene Abweichungen als Root-Cause-Cluster öffnen.
4. Allgemeine Regeln ausschließlich dann ergänzen, wenn sie Known-Fixture,
   adversariale Varianten und verfügbare Holdouts nicht verschlechtern.
5. Erst nach vollständigem dynamischem Lauf, Ressourcenmessung und Audit über
   Kunden-XLSX oder Deployment entscheiden.

## 10. Beweis- und Betriebsgrenze dieses Arbeitsschritts

Diese Konsolidierung startet keinen Modelllauf und kein Deployment. Der bereits
vor Beginn separat autorisierte V62-B-Lauf läuft in einem isolierten
Mac-Studio-Worktree weiter und wird dadurch weder neu gestartet noch verändert.
Inventar- und Workflowstatus werden erst nach Prüfung des neuen Validators auf
einem exakten Mac-Studio-Commit als validiert bezeichnet.
