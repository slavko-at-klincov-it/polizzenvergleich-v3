# Dreiphasen-Umsetzung: Recall, Shadow-Suche und Einzelzertifizierung

Stand: 31. August 2026
Implementierungsbranch: `codex/polizzenvergleich-v3`

## Kurzurteil

Die drei Phasen sind technisch vorbereitet. Phase A erweitert den
kontrollierten Primärpfad, Phase B stellt einen strikt getrennten
Shadow-QA-Lauf bereit, und Phase C sperrt jede automatische
`COVERAGE_ONLY`-Wirkung hinter eine leere, zeilenweise
Zertifizierungsregistry.

Die Implementierung wurde danach auf dem Mac Studio technisch geprüft und mit
zehn LF-/WEVIG-Dokumenten unter Qwen 3.6 ausgeführt. Dieser Lauf war noch an
`e86cb782` gebunden und lieferte 2.240 von 2.240 Dokumentzeilen. Er zeigte
zugleich weitere Wert-, Scope-, Recall- und Zitatabweichungen, die in
getrennten Forward-Fix-Commits behoben wurden. Der Lauf ist ein
Regressionsnachweis für genau diese Dokumente, keine fachliche Abnahme,
Holdout-Freigabe oder 99-Prozent-Aussage.

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

Nachgelagerte Forward-Fixes:

- `841d3a25`, `d9eb368a`, `1302eb34` – verlorene Triage-, Feld- und
  Worksheet-Rückgaben wiederhergestellt;
- `1e924cd9` – Qualifier wie „auf Erstes Risiko“ über weiche
  PDF-Zeilenumbrüche innerhalb strukturierter Einheiten gebunden;
- `de1b2932` – sichtbare Quellen zeigen die Klausel statt einer bloßen
  Deckungsüberschrift;
- `dbccd9c5`, `6ec3606b`, `78e3373a` – Fahrzeug-, Baum-/Ast- und
  Zwischenlagerungsbelege gegen Scope-Überdehnung abgesichert;
- `b283b12a`, `79e4a047` – strukturierte Spartentitel, Kosten-Heading-Reset
  und Kanalrückstau erkannt;
- `033d3d27` – zonenbedingte Hochwasserfolgen einschließlich expliziter
  Limits modelliert.

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
damit keine implizite produktive Embeddingkonfiguration. Ein Live-Shadow-Lauf
bleibt gesperrt, bis Modell-, Runtime- und Embeddingartefakte vollständig
hashgebunden vorliegen.

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

Implementiert und technisch geprüft sind die Sicherheits- und
Datenflussgrenzen sowie die genannten Forward-Fixes. Der Mac-Studio-Lauf auf
den bekannten LF-/WEVIG-Dokumenten belegt konkrete Verbesserungen, ersetzt
aber weder ein unabhängiges Experten-Oracle noch einen zuvor unbekannten
Mehrversicherer-Holdout. `FE-D03` bleibt fachlich offen: Die generische
Löschfolgeschaden-Klausel benötigt einen Ausdruck „generisch ODER alle
Medien“, damit Wasser nicht fälschlich auch Schaum und Pulver beweist. Vor
einer Registryfreigabe müssen Holdout und unabhängige Prüfung tatsächlich
bestanden sein.
