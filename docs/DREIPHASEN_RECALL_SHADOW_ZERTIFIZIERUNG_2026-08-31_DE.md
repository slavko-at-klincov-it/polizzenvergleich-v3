# Dreiphasen-Umsetzung: Recall, Shadow-Suche und Einzelzertifizierung

Stand: 31. August 2026  
Implementierungsbranch: `codex/polizzenvergleich-v3`

## Kurzurteil

Die drei Phasen sind technisch vorbereitet. Phase A erweitert den
kontrollierten Primärpfad, Phase B stellt einen strikt getrennten
Shadow-QA-Lauf bereit, und Phase C sperrt jede automatische
`COVERAGE_ONLY`-Wirkung hinter eine leere, zeilenweise
Zertifizierungsregistry.

Auf ausdrücklichen Nutzerwunsch wurden in diesem Arbeitsschritt keine Tests,
kein Lint, kein Build, kein Modelllauf und kein Mac-Studio-Lauf ausgeführt.
Damit ist dies ein Implementierungsstand, keine Abnahme oder Freigabe.

## Phase A – kontrollierter Recall

- Semantische Coverage-Überschriften setzen alten Ausschluss- und
  Variantenscope zurück, ohne bloße Inhalts- oder Referenzüberschriften als
  Deckungsbeleg zu verwenden.
- Bestätigte Nulltreffer wurden als allgemeine Alias- und Konzeptfamilien in
  FE, LW, ST, VS und EL umgesetzt. Flexionen werden über kontrollierte Stämme
  erfasst.
- Lokale Beträge, Prozente, Dauern, Wartezeiten und Selbstbehalte werden nach
  Faktrolle und Klauselscope gebunden; `EL-07` ist komponentengenau auf
  `CLAUSE_SECTION` begrenzt.
- `VS-16` wurde auf eine neutrale Dokumentationswirkung zurückgestuft. Die
  breite Parkplatzannahme und die automatische 10-Prozent-Ableitung sind
  entfernt; `ANY` wird im Vergleichspfad nicht mehr wie `ALL` behandelt.

Zugehörige Themencommits:

- `fc38bab8` – semantischer Heading-Reset;
- `5a860f8e` – kontrollierte Konzeptfamilien;
- `5eb66ebe` – lokale rollenrichtige Wertebindung;
- `6b4edf67` – flektierte Recall-Stämme;
- `c0c0dd6a` – neutrale Nullwirkung und Zertifizierungspflicht;
- `b0065a50` – klausellokale Erdbebenwerte.

## Phase B – Hybrid ausschließlich als Shadow-QA

Der Shadow-Zweig ist kein Teil des Kundenworkers, des Primärrunners, dessen
Resume-Signatur oder der Kundenmaterialisierung. Er wird ausschließlich über
`run-hybrid-shadow-quality.command` gegen einen bereits abgeschlossenen
Primärlauf gestartet und schreibt in einen neuen Ausgabeordner außerhalb von
Primärlauf und Repository.

Verbindliche Grenzen:

1. Nur Komponenten mit strikt ganzzahligem Primärwert `0`, leerer
   Occurrence-Liste und `NO_CONTROLLED_CANDIDATE` werden gesucht.
2. Breite Embedding-Chunks dienen nur der Navigation. Kandidaten entstehen
   erst aus erneut eingebetteten, serverseitig ausgeschnittenen exakten
   Quellspannen mit Dokument-, physischer Seiten- und Offsetbindung.
3. Diese Spannen durchlaufen den normalen Candidate-Triage- und
   Evidenzvertrag. Semantische Kandidaten können keine positive
   serverdeterministische Rollen- oder Scope-Freigabe umgehen.
4. Der Kundenmaterializer lehnt Shadow-Worksheets zusätzlich explizit ab.
5. Primär- und Shadow-Lauf teilen dieselbe globale Modellsperre. Ein paralleler
   Modellbetrieb ist ausgeschlossen.
6. Manifest, aktueller Dirty-/Release-Hash, Primärartefakte, Vertrag,
   Dokumentstatus, Qwen-Modell, Tokenlimit und Folgeartefakte sind über
   SHA-256 beziehungsweise exakte IDs verbunden. Resume ist absichtlich
   verboten.
7. Der Embedding-Vertrag verlangt absolute Modell- und Runtimeartefakte,
   deren SHA-256, Runtime-Revision, Dimension, Modell-ID und versionierte
   Eingabenormalisierung. Der Endpoint muss das Modell ausweisen und jede
   Embedding-Antwort dieselbe Modell-ID melden.
8. Recall, Präzision und False-Positive-Rate bleiben bis zur vollständigen
   menschlichen Kennzeichnung `null`. Die FPR bezieht sich auf Kandidaten, die
   nach normaler Triage und Evidenzprüfung tatsächlich ausgewählt wurden,
   nicht auf rohe Retrieval-Treffer.
9. Die Auswertung darf das gelabelte Review nicht überschreiben und bindet
   Quellreview-Hash, Reviewer-ID und Oracle-Version.

Zugehöriger Themencommit: `eb109085`.

Der Beispielvertrag ist deaktiviert und enthält nur Platzhalter. Es existiert
damit keine implizite produktive Embeddingkonfiguration.

## Phase C – Einzelzertifizierung

Die Registry
`server/resources/policyAnalysis/coverage-only-certifications.v0.1.json` ist
leer. Keine Zeile ist derzeit zertifiziert. Eine Registryaufnahme ist nur für
eine reine `COVERAGE_ONLY`-Zeile möglich und verlangt versionierte Nachweise
für Alias-/Konzeptfamilie, positive/negative/adversariale Varianten,
Scope/Komponente, LF/WEVIG, unbekannten Holdout, frischen Mac-Studio-Paketlauf
und unabhängige Nulltrefferprüfung.

Der Registryvertrag bindet die Freigabe an Kategorie, Requirement,
Katalog-ID, semantischen Requirement-Digest und alle Gate-Evidenzen.
`COVERAGE_MIXED`, `COST_COVERAGE`, Limits, Selbstbehalte, Bedingungen und
Definitionen werden fail-closed abgelehnt.

## Beweisgrenze und nächster Schritt

Implementiert ist die technische Sicherheits- und Datenflussgrenze. Nicht
bewiesen sind Recall-Verbesserung, False-Positive-Rate, LF-/WEVIG-
Nichtregression, unbekannte Versicherer, Laufzeit oder fachliche Richtigkeit.
Vor einer einzigen Registryfreigabe müssen die vorgesehenen Prüfungen auf dem
Mac Studio und dem unbekannten Holdout tatsächlich durchgeführt und
unabhängig geprüft werden.
