# Polizzenvergleich – Projektgedächtnis

Stand: 26. August 2026
Dokumentationsbasis: Entwicklungsstand nach `policy-v0.3.22` (`9c6e263c`)
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

- kein, ein oder zwei logisch getrennte Vertragsdokumentpakete verwenden
  können; jedes Paket darf aus einem oder mehreren zusammengehörigen
  Dokumenten bestehen,
- nach dem fertigen Basisindex unmittelbar Fragen stellen können,
- konkrete Fragen wie „Ermittle alle Selbstbehalte“ vollständig und
  beleggebunden beantwortet bekommen,
- ein Paket analysieren oder zwei Pakete mit einem ausführlichen Maklerprompt
  vergleichen können,
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

### 2.1 Bestätigter Ergebnisvertrag für den aktuellen Kunden

Das aktuelle Zielprodukt wird vollständig lokal mit AnythingLLM als Bedien-
und Workflowoberfläche sowie LM Studio als Modellserver betrieben. Der
bestätigte aktuelle Fach- und Lieferumfang für diesen Kunden ist die
Gebäudeversicherung. Daraus folgt keine dauerhafte Beschränkung eines späteren
Gesamtprodukts auf diese Sparte.

**Modus mit genau einem Vertragsdokumentpaket:** Das Paket darf aus Polizze,
Angebot, Rahmenvereinbarung, allgemeinen und besonderen Bedingungen,
Klauselverzeichnis sowie Nachträgen bestehen. Das System erstellt eine
eigenständige, beleggebundene Vertragsanalyse. Es strukturiert die fachlich relevanten
Deckungen, versicherten Sachen, Definitionen, Grenzen, Selbstbehalte,
Bedingungen, Ausschlüsse, Obliegenheiten und Varianten. Ungeklärte, nicht
vergleichbare oder nicht belegte Punkte werden sichtbar gekennzeichnet.
Mehrere Paketdokumente dürfen dieselbe Kategorie belegen; Dokumentidentität,
Rolle, Rang, physische Seite, Originalspan, Betrag und Scope bleiben getrennt.

**Modus mit genau zwei Vertragsdokumentpaketen:** Das System versteht und
analysiert beide Pakete zunächst paketisoliert und darin jedes Quelldokument
provenienzgebunden. Danach stellt es korrespondierende
Vergleichspunkte und getrennte Faktrollen gegenüber und zeigt detaillierte
Unterschiede, Gemeinsamkeiten, Konflikte, offene Evidenz sowie relative Vor-
und Nachteile von Vertrag A und B. Jede Aussage und jede Wertung bleibt an die
kanonischen Quellen beider Pakete gebunden.

**SICHERE ARBEITSANNAHME BIS ZUR FACHLICHEN BESTÄTIGUNG:** „Besser“ wird
standardmäßig nur punktweise und innerhalb desselben Objekt-, Varianten-,
Gültigkeits- und Bewertungsscopes verwendet. Ohne bestätigtes Gebäude-/
Risikoprofil und ausdrücklich freigegebene Gewichtungen gibt es keinen
pauschalen Gesamtsieger. Zulässige Zustände pro Vergleichspunkt sind mindestens
`Vorteil A`, `Vorteil B`, `gleichwertig`, `nicht vergleichbar` und
`unklar/unresolved`. „Nur in A belegt“ bedeutet nicht automatisch „fehlt in
B“.

### 2.2 Kunden- und Domänenevidenz: Gebäudeversicherung

Quelle dieser Einordnung ist eine am 24. August 2026 übermittelte,
anonymisierte Partnerzusammenfassung direkt nach einem Kundengespräch. Das
vollständige Transkript und geschäftliche Detailangaben werden nicht im
Repository gespeichert.

**Beobachtet beziehungsweise vom Benutzer bestätigt:**

- Der aktuelle Kunde ist auf Gebäudeversicherung spezialisiert. Der Fach- und
  Lieferumfang für diesen Kunden wurde am 24. August 2026 als
  Gebäudeversicherung bestätigt. Die genaue Unterteilung in Kategorien,
  Vergleichspunkte und Abnahmetiefe bleibt offen. Das ist keine Entscheidung,
  ein späteres Gesamtprodukt dauerhaft auf diese Sparte zu begrenzen.
- Die gefundenen Punkte „Glasfassaden“ und möglicherweise „Fassungen“ wurden
  als genau die benötigte Ergebnisart bestätigt. Der Begriff „Fassungen“ muss
  wegen möglicher Transkriptionsungenauigkeit fachlich verifiziert werden.
- Beide Punkte waren dem Kunden bereits bekannt. Ihr Wert lag trotzdem darin,
  dass die Pipeline sie in diesen beiden Fällen wiederfand und damit laut
  Partnerbericht Vertrauen in die Arbeitsweise erzeugte. Für diese
  Kundenvalidierung war Neuigkeitswert daher kein notwendiges Erfolgskriterium.
- Die vorhandene Vergleichs-Excel ist bewusst kuratiert und enthält je Bereich
  nur die wichtigsten Punkte.
- Gewünscht ist eine deutlich breitere, belegte Abarbeitung der feinen
  Vergleichspunkte über mehrere Kategorien der Gebäudeversicherung. Es besteht
  kurzfristiger geschäftlicher Zeitdruck; der absolute Liefertermin und die
  erwartete Abnahmestufe müssen außerhalb relativer Angaben wie „morgen“ oder
  „Mittwoch“ ausdrücklich bestätigt werden.

**SCHÄTZUNG, noch keine Abnahmeanforderung:** Der Partner beschrieb ungefähr
fünf bis zehn Kategorien, häufig etwa 30 bis 70 beziehungsweise rund 50
Detailpunkte je Kategorie und insgesamt grob 250 bis 500 „Sachen“. Diese Zahlen
belegen nur die erwartete Größenordnung. „Sache“ ist noch nicht eindeutig als
Vergleichspunkt, Klausel, Fakt oder Ergebniszeile definiert.

**FOLGERUNG:** Die Vergleichs-Excel darf als priorisierter Seed und mögliche
Darstellungsreferenz verwendet werden, aber nicht als geschlossene Taxonomie,
vollständiger Goldstandard oder Beweis für das Fehlen weiterer Klauseln.

**ARBEITSHYPOTHESE, fachlich noch zu bestätigen:** Ein skalierbares Datenmodell
für diese Anforderung könnte wie folgt strukturiert sein:

```text
Gebäudeversicherung
  -> Kategorie/Risikofamilie
    -> stabiler Vergleichspunkt
      -> Gültigkeits-, Objekt- und Variantenscope
        -> eine oder mehrere Quellklauseln
          -> getrennte Faktrollen
            -> exakte Evidenz
              -> Vergleichsdarstellung für Dokument A/B
```

Ein Vergleichspunkt wie „Glasfassaden“ kann pro Dokument getrennte Fakten für
Deckung, versicherte Sache, Definition, Limit, Selbstbehalt, Ausschluss,
Bedingung oder Obliegenheit besitzen. Vergleichspunkt, Faktrolle, Klausel und
Excel-Zeile dürfen nicht gleichgesetzt oder nur über ein freies Themenlabel
dedupliziert werden. Die Beziehung zwischen Vergleichspunkten und Fakten ist
grundsätzlich mehrwertig und kann mehrere Klauselblöcke umfassen.

#### Versionierte Arbeitskataloge seit 25. August 2026

Der sichtbare Claude-Share wurde als unvalidierter, maschinenlesbarer Seed in
[`knowledge-catalogs/`](./knowledge-catalogs/README.md) übernommen. Die
korrekte sichtbare Zahl beträgt 202 Zeilen: 190 Vergleichs-/Intake-Kandidaten
und 12 getrennte Broker-Regelkandidaten. Zusätzlich existieren sechs erste
Leitungswasser-TargetSpecs, 25 Golden-Case-Klassen und ein Broker-Regelschema,
das automatisches Scoring in Version 0.1 verbietet.

Diese Artefakte sind ein versioniertes Arbeits- und Review-Backlog, keine
fachlich freigegebene Ontologie und keine Vollständigkeitsquelle. Kategorien
sind Views; Wissensart und Faktrolle hängen an separaten Requirements. Weitere
belegte Vertragsinhalte dürfen durch den Katalog nie verworfen werden.

#### Lokal geprüfte Referenzartefakte, nicht versioniert

Am 24. August 2026 wurden die zwei vom Benutzer lokal bereitgestellten
Referenzdateien read-only und ausschließlich strukturell geprüft. Sie bleiben
wegen personen-, kontakt-, vertrags- und finanzbezogener Inhalte vollständig
außerhalb von Git, Fixtures, Logs und versionierten Extrakten. Lokale Pfade,
Dateihashes, Metadatenfingerprints und Originalwortlaut werden nicht
dokumentiert.

**Vergleichs-Excel:**

- ein sichtbares Arbeitsblatt mit einem logischen Inhaltsbereich von drei
  Spalten und 191 Zeilen,
- linke Spalte mit Vergleichsmerkmalen, zwei rechte Spalten mit den
  gegenübergestellten Produktständen,
- fünf Hauptbereiche: Feuer, Sturm, Leitungswasser, Glas und Haftpflicht,
- Leitungswasser zusätzlich in mehrere Deckungsstufen gegliedert,
- ungefähr 153 ausgefüllte fachliche Vergleichszeilen; diese Zahl ist keine
  Anzahl atomarer Fakten oder freigegebener Vergleichspunkte,
- keine Berechnungsformeln; die Werte mischen Ja-/Nein-Aussagen, Quoten,
  Beträge und freie Erläuterungen.

Die Datei bestätigt die konkrete Vergleichs- und Darstellungsstruktur. Dass sie
bewusst nur eine Auswahl wichtiger Punkte enthält, bleibt eine Aussage aus dem
Partnerbericht. Weder die Datei allein noch ihre Zeilenzahl beweist
Vollständigkeit, fachliche Freigabe oder die Schätzung von 250 bis 500 Punkten.

**Musterberechnung / Versicherungsvorschlag:**

- 21 physische A4-Seiten mit nativer Textschicht,
- Vorschlag beziehungsweise Musterberechnung für ein Wohngebäude, keine
  ausgestellte oder ausgehandelte Polizze,
- erste sieben Seiten mit Objekt-, Sparten-, Deckungs-, Varianten- und
  Zusammenfassungsinformationen,
- Seiten 8 bis 21 mit ausführlichen besonderen Bedingungen,
- dieselben fünf fachlichen Sparten wie in der Vergleichs-Excel sowie
  zusätzliche allgemeine und spartenbezogene Detailklauseln.

Der Vorschlag eignet sich als lokales Realstruktur-Beispiel für die Verteilung
von Übersichtswerten und Detailbedingungen über verschiedene Seiten und
Klauseln. Eine exakte Produkt-/Versionsidentität zwischen einer Excel-Spalte
und diesem Vorschlag ist nicht belegt. Ebenso bleibt offen, welche zwei
fassadenbezogenen Begriffe im Gespräch exakt gemeint waren.

**OFFEN vor einer Roadmap- oder Lieferzusage:**

1. verbindliche Gebäudekategorien und Abgrenzungen,
2. Definition und gewünschte Granularität eines „Vergleichspunkts“,
3. maßgebliche Excel-Version, Spaltenlogik und gewünschtes Ausgabeformat,
4. exakte fachliche Bedeutung der zwei Glas-Beispiele,
5. sichtbare Tiefe: vollständige Matrix, kuratierte Hauptansicht oder beides,
6. kurzfristiger Lieferumfang: Demo, Arbeitsvergleich oder fachlich
   freigegebener Gesamtvergleich,
7. ob der aktuelle Implementierungsfokus vom Selbstbehalt auf priorisierte
   Gebäudekategorien umgestellt werden soll.
8. ob „besser“ dauerhaft nur punktweise und vertragsinhaltlich ausgewiesen
   werden soll oder zusätzlich eine profilbasierte Gesamtempfehlung mit
   ausdrücklich freigegebenen Gebäude-/Risikoprioritäten und Gewichtungen
   gewünscht ist.

Die zwei positiv bestätigten Beispiele sind Kandidaten für anonymisierte
Referenzfälle, aber ohne exakten synthetischen Solltext noch keine Golden Cases
und kein Vollständigkeitsbeweis.

### 2.3 Kundenseitiges Referenzprodukt: LF Immo Exklusivschutz

Der Benutzer hat am 25. August 2026 bestätigt, dass der aktuelle Kunde „LF
Immo Exklusivschutz“ als eigenes beziehungsweise kundenseitiges
Referenzprodukt verwendet. Der wichtigste wiederkehrende Anwendungsfall ist
daher voraussichtlich der Vergleich dieses Referenzprodukts mit anderen
Gebäudeversicherungsprodukten. Vergleiche zweier anderer Polizzen bleiben ein
vollwertiger Produktmodus.

Eine lokale, ausschließlich read-only geprüfte Referenzunterlage bestätigt die
konkrete Bezeichnung „LF IMMO EXKLUSIVSCHUTZ 2023“. Die Unterlage war bereits
Teil des lokalen Strukturinventars der 13 Dokumente. Weder Originaltext noch
lokaler Dateipfad, Hash oder sonstige Kundendaten werden in der Knowledge Base
gespeichert.

**Verbindliche Einordnung für die weitere Planung:**

- `LF Immo Exklusivschutz` ist die kanonische Produktfamilienbezeichnung;
  Groß-/Kleinschreibung, Leerzeichen und Bindestrichvarianten dürfen als
  normalisierte Aliase erkannt werden.
- Eine vorhandene Jahreszahl wie `2023` ist eine eigene Versionsangabe und
  darf nicht still mit älteren oder künftigen Fassungen zusammengeführt
  werden.
- Eine Namensfundstelle erzeugt zunächst nur einen Kandidaten für die
  Produktidentität. Dokumentart, Vertragspaket, Geltungsbereich, ausgewählte
  Variante und tatsächlich einbezogene Bedingungen müssen weiterhin belegt
  werden.
- Nach bestätigter Produktidentität darf die Oberfläche das Produkt als
  `Referenzprodukt` und das andere Dokument als `Vergleichsprodukt`
  darstellen. Diese Rollen beeinflussen Reihenfolge und Schwerpunkt, nicht
  die fachliche Bewertung.
- Das Referenzprodukt erhält keinen automatischen Bonus, keine versteckte
  Gewichtung und keine Siegerrolle. Punktweise Vorteile, Nachteile,
  Gleichwertigkeit, Nichtvergleichbarkeit und Unklarheit werden nach denselben
  Regeln wie bei jedem anderen A/B-Paar ermittelt.

**Architekturfolge für eine spätere Umsetzung:** Die Zuordnung gehört in ein
versioniertes Kunden-/Projektprofil beziehungsweise Produktregister mit
kanonischer Produkt-ID, Aliasen, Versionsmerkmalen und bevorzugter
Vergleichsrolle. Ein System-Prompt darf diesen Kontext zusätzlich erklären,
aber nicht die alleinige Wahrheitsquelle sein. So bleibt die Erkennung
deterministisch, testbar und auch für Excel-/Markdown-Export oder andere
Modelle verfügbar.

Ein späterer System-Prompt kann sinngemäß festhalten:

```text
Wenn die serverseitig bestätigte Produktidentität LF Immo Exklusivschutz ist,
behandle dieses Dokument als kundenseitiges Referenzprodukt. Vergleiche es
neutral und beleggebunden mit dem anderen Dokument. Leite aus dem Produktnamen
keine Deckung, Geltung, Qualität oder Empfehlung ab.
```

Kanonische Herkunft und offene Prüfschritte stehen in
[`INT-20260825-031`](./POLIZZENVERGLEICH_WISSENSINTAKE.md#int-20260825-031--lf-immo-exklusivschutz-als-kundenseitiges-referenzprodukt).

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

### Originalprodukt-Baseline: Built-in-Konfigurationskampagne

Vor der Agentic-Umsetzung wurden im unveränderten Original-AnythingLLM elf
Ausführungen über zehn Konfigurationen dokumentiert: BGE-M3 und Dinghy,
gepinnt und ungepinnt, Accuracy N6 und N10, Temperatur 0,7 und 0, Default N32
sowie Qwen und Gemma. Die falsche N32-Chatmodell-Konfiguration wurde einmal
ohne und einmal mit Instrumentierung ausgeführt; beide Läufe sind
ausdrücklich als ungültige Qualitätsläufe klassifiziert.

Die wichtigsten belastbaren Ergebnisse sind:

- Pinning ist ein anderer Vollkontextpfad und kein valider Embeddervergleich.
- Dinghy lieferte in der ungepinnten Accuracy-Pipeline auf dem einen
  Referenzdokument deutlich mehr Breiten-Proxys als BGE; BGE war in einzelnen
  geholten Klauseln teils tiefer und vorsichtiger.
- N10 verbesserte BGE klar; Dinghy lag zwischen N6 und N10 bei den
  Breiten-Proxys nahe einem Plateau.
- Korrektes Default-N32 beseitigte einen großen Kontextzufuhrengpass und war
  der breiteste valide Qwen-Lauf.
- Temperatur 0 und der Wechsel auf Gemma korrigierten die freie
  Ein-Prompt-Architektur nicht.
- Kein Lauf bestand gemeinsam Quellen-, Rollen-, Pflichtstruktur-,
  Negativstatus- und Vollständigkeits-Hard-Gates.

Zeilen, eindeutige Positionsnamen und Klauselcodes waren Diagnoseproxies, kein
gemessener Faktenrecall. Die vollständige Matrix und ihre Konfounder stehen in
[Tests und Erkenntnisse, Abschnitt 17](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#17-original-anythingllm-vollständige-built-in-konfigurationskampagne);
das maschinenlesbare Register liegt unter
[`experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json`](./experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json).

### Mehrdokument-Baseline: neun Dokumente mit globalem N32

Am 26. August 2026 wurden auf der Kundenhardware zwei weitere Built-in-Läufe
mit einem neun Dokumente umfassenden Vertragsdokumentpaket instrumentiert. Die
vom Nutzer bestätigte Workspace-Konfiguration blieb gegenüber der
Default-N32-Baseline unverändert; geändert wurde beim ersten Lauf die
Dokumentmenge. Der zweite Lauf verwendete zusätzlich einen anderen
Fachkatalog und ist deshalb kein Einvariablenvergleich zum ersten.

- Der VS-Lauf übertrug 32 Chunks aus sechs von neun Dokumenten.
- Der Leitungswasserlauf übertrug 32 Chunks aus sieben von neun Dokumenten;
  das fachlich zentrale Bedingungsdokument erhielt nur einen Chunk.
- Beide Ausgaben enthielten exakt 36 Strukturzeilen, bestanden aber weder
  Dokument-/Kategorienabdeckung noch den wörtlichen Quellenvertrag.
- Nach NFKC- und reiner Leerraumnormalisierung waren nur 6/18 VS- und 2/29
  Leitungswasser-Quellenfragmente exakte zusammenhängende Teilstrings des
  tatsächlichen Modellinputs.
- Die unterschiedliche Dokumentabdeckung der beiden Läufe ist eine
  queryabhängige Retrievalbeobachtung, keine Qualitätsverbesserung. Status- und
  Zeilenzahlen sind wegen der verschiedenen Fachkataloge nicht direkt
  vergleichbar.

Der Befund bestätigt `INV-003` jetzt auch für Vertragsdokumentpakete:
Vollständige Analyse benötigt terminale Abdeckung je Kategorie und Dokument,
nicht ein globales Top-N. Mehrere Dokumente dürfen gemeinsam eine Kategorie
belegen, müssen aber mit Dokumentrolle, Dokumentidentität, physischer Seite,
Originalspan, Betrag und Geltungsbereich getrennt bleiben. Detailmessung und
Beweisgrenze: [Tests, Abschnitt 22](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#22-neun-dokumente-paket-mit-globalem-n32). Das anonymisierte Laufregister liegt
unter [`experiment-ledgers/multidocument-built-in-runs.v0.1.json`](./experiment-ledgers/multidocument-built-in-runs.v0.1.json).

### Aktueller vertikaler Nachweisstand: Rollenlokale Betragszuordnung

Ein lokaler Realstruktur-Test mit 21 rekonstruierten physischen Seiten hat die
Laufzeitentscheidung bestätigt, aber die fachliche Abnahme noch nicht erfüllt:

- Basisindex: 62,9 Sekunden,
- erster gezielter Selbstbehaltlauf inklusive Ledger: 67,3 Sekunden,
- identische Abfrage nach Neustart: 2,6 Sekunden,
- 79 Clause Blocks und 10 Dinghy-Batches,
- keine generative Vollinventarisierung und kein Fact-Mapper-Aufruf.

Alle drei relevanten Selbstbehalt-Fundstellen auf den physischen Seiten 4, 5
und 8 wurden gefunden. Auf Seite 4 wurden jedoch `EUR 350` Selbstbehalt und
`EUR 20.000` Jahreshöchstentschädigung fälschlich gemeinsam als
Selbstbehaltbetrag ausgegeben; zusätzlich wurde eine entfernte Passage als
Bedingung übernommen.

Dieser Fehler liegt in der deterministischen Block-/Betrags-/Bedingungs-
Assoziation, nicht am lokal verwendeten kleinen Qwen-Modell. Am 25. August 2026
wurde ein temporärer Rollenbinder-Spike zuerst rot und danach synthetisch grün
getestet. Der Spike trennte `EUR 350` als Selbstbehalt von `EUR 20.000` als
Limit und übernahm die fremde Bedingung nicht. Neun fokussierte beziehungsweise
angrenzende Suites mit 93 Tests waren während dieses Experiments grün.

Der Spike wurde anschließend vollständig aus dem Produktcode entfernt, weil
die Implementierungsphase noch nicht freigegeben ist. `FAIL-003` bleibt im
aktuellen Code offen. Die Versuchsevidenz beweist nur, dass eine
rollenpartitionierende, fail-closed Bindung eine prüfenswerte Option ist. Sie
beweist weder, dass dieser konkrete Entwurf übernommen werden soll, noch
21-Seiten-Realstruktur, Original-PDF-/Tabellengeometrie, unbekannte
Rollenformulierungen, Seitenfortsetzungen oder Variantenbindungen.

### Isolierter Realinput-Nachweis der Strategie-PoCs

Außerhalb des eingefrorenen Produktcodes wurde die katalog-/occurrence-
zentrierte Strategie am 25. August 2026 als lokaler Kandidaten-Harness mit
einem textnativen 21-Seiten-Paket und einer kuratierten Referenzliste geprüft.
Der Lauf plante 153 bereinigte Referenzzeilen und 276 Partner-Seed-Zeilen
vollständig, fand 58 lexikalische sowie einen konservativen semantischen
Referenzkandidaten und benötigte im deterministischen Hauptpfad null
Qwen-Aufrufe. Eine begrenzte Qwen-4B-Prüfung bestand nur in 3/8 Fällen den
formalen ID-/Schema-/Teilzitatvalidator; 5/8 wurden korrekt `unresolved`.

Dieser Nachweis ändert `FAIL-003` nicht und ist keine fachliche Freigabe. Er
bestätigt nur die kontrollierbare Arbeitsteilung: Code besitzt Targetmenge,
Occurrences, Fact-/Reviewzeilen und Provenienz; Dinghy ergänzt Kandidaten;
Qwen darf begrenzte Evidenz prüfen, aber seine Rollenbehauptung bleibt ohne
Oracle ungeprüft. Die vollständige Evidenz und Beweisgrenze stehen in
[Tests und Erkenntnisse, Abschnitt 19](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#19-reales-ein-dokument-lernexperiment-der-katalog-occurrence-variante).

Die unabhängige strukturzentrierte Gegenprobe auf derselben Quelle erzeugte
35 begrenzte, terminale Dokumentgruppen aus allen 21 physischen Seiten und
spiegelte diese ohne LLM gegen beide Katalogquellen. Ein Realfehler bei der
Erkennung vierstelliger Orts-/Adresszeilen als Überschrift wurde dabei
gefunden, regressionsgesichert und geschlossen. Der Strukturpfad bleibt
Discovery-/Auditmechanismus; sein Crosswalk ist keine Fact- oder
Deckungsautorität. Die zwei PoCs sind damit komplementär, nicht zwei
konkurrierende Wahrheiten.

### Aktuelle Implementierungsquelle: V3

Nutzerkorrektur vom 26. August 2026: Der einzige aktuelle
Implementierungsbereich ist:

```text
Ordner: polizzenvergleich-v3
Branch: codex/polizzenvergleich-v3
```

`policy-clean-implementation`, `policy-agent-orchestration`,
`anythingllm-polizzenvergleich`, frühere Versionsworktrees und `strategy-pocs`
sind historische Versuchsevidenz. Sie bleiben für Erfahrungen, verworfene
Ansätze, Tests und kleine nachweislich brauchbare Konzepte lesbar, sind aber
keine aktuellen Arbeitsbereiche. Produktcode wird dort nur nach einer
ausdrücklichen, pfadgenauen Nutzeranweisung verändert.

Die nachfolgende Beschreibung des Feuerpiloten bleibt als datierte Historie
erhalten und ist keine Anweisung, diesen Worktree fortzusetzen.

### Aktueller V3-Nachweisstand: RC33

Der exakt getaggte Stand `v3.3.0-rc.33` wurde am 29. August 2026 auf der
Kundenhardware installiert und mit Qwen 3.8 27B über alle acht Ansichten
ausgeführt. Beide bekannten Regressionsexemplare terminierten vollständig:

- WEVIG: 320/320 Zeilen, 15 Statusverbesserungen und 0 Statusregressionen
  gegenüber dem eingefrorenen Altweg-Lauf;
- LF: 320/320 Zeilen, 17 Statusverbesserungen und 0 Statusregressionen
  gegenüber dem eingefrorenen Altweg-Lauf;
- kumulativ: 640/640 Zeilen und 32 Statusverbesserungen.

Der gemeinsame evidenzgebundene Pfad ist damit für alle acht Ansichten auf
diesen beiden Fixtures technisch und regressionsbezogen positiv belegt. Das
ersetzt die frühere monolithische Gesamtbaseline als Zielweg, widerlegt aber
nicht deren dokumentierte Fehlerbefunde. LF und WEVIG waren beide Teil der
Entwicklung; ohne fachlich gelabelten, zuvor unbekannten Mehrversicherer-
Holdout folgt daraus weder eine allgemeine 99-Prozent-Aussage noch eine
ungeprüfte fachliche Kundenfreigabe. Details stehen in
[Tests und Erkenntnisse, Abschnitt 41](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#41-v330-rc33--schadenservice-und-ansprechpartner)
und im
[RC33-Releasevertrag](../polizzenvergleich-v3/docs/RELEASE_V3.3.0_RC33_DE.md).

### Historische Arbeitsphase: lokaler experimenteller Feuerpilot

Am 25. August 2026 hatte der Nutzer diese damalige experimentelle
Implementierungsphase ausdrücklich wieder aufgenommen. Damals verwendete
Codequelle war:

```text
Ordner: policy-clean-implementation
Branch: codex/policy-clean-implementation
sauberer Ausgangs-HEAD: a1935f16
Status der neuen Iteration: lokal geändert, noch nicht committed und nicht kundenfreigegeben
```

Der frühere `policy-agent-orchestration`-Prototyp bleibt Versuchs- und
Evidenzquelle, nicht aktueller Produktpfad. Die vollständige Built-in-Kampagne,
ADR-017 und alle Hard-Gates bleiben verbindlich; die Wiederaufnahme erlaubt
keine Rückkehr zum freien monolithischen Prompt.

Die damalige Iteration sammelte dynamische Dokumentlabels katalogunabhängig
in Code und ersetzte freie Qwen-Zitate durch servereigene Span-IDs. Die
Workspace-Baseline `Top-N 32 / Temperatur 0 / default` war bereits idempotent
im Feuerpilot provisioniert und wird nun durch einen reinen Konfigurations-
und Regressionstest gesichert. Erste lokale Messungen bestehen auditierbare
Source-Line-Disposition, Row-Set und occurrence-genaue
Span-/Seiten-/Offsetbindung. Kandidatenverlust wird im Span-Manifest sichtbar;
source-bound Modellwahlen bleiben ausdrücklich ungeprüft und können weder
Gleichwertigkeit noch Vorteil erzeugen. Rollen-, Scope- oder A/B-Fachlichkeit
sind noch nicht bestanden. Der Produktparser ist auf drei Modellspalten
reduziert. Retrieval-Sampling und Span-Overflow werden getrennt manifestiert;
vollständige Discovery-Ledger werden content-addressiert einmal lokal
gespeichert und in Chats nur referenziert. Details: [Tests, Abschnitt 21](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#21-span-id-und-dynamische-discovery-iteration-im-feuerpilot).
Ungeklärte Nummerierungspfade propagieren nun an Unterpunkte; alte
Discovery-Ledger ohne verbliebene Chat-Referenz werden mit kurzer
Race-Schutzfrist automatisch bereinigt. Lang laufende Analysen werden dabei
durch persistente In-flight-Leases geschützt, die nach Chat-Persistenz
freigegeben werden; abgebrochene Leases laufen zeitgebunden aus.

### Reales FEUER-A/B-Lernresultat

Ein isolierter lokaler Zwei-Dokument-Lauf bestätigte den technischen
Kandidatenpfad `Strukturledger -> lexikalische Enumeration -> additive
Dinghy-Kandidaten -> begrenztes Qwen-Review -> fail-closed A/B-Zeilen`.
Dinghy lieferte nachweislich zusätzliche semantische Kandidaten. Die stabile
Runtime erforderte eine echte Phasentrennung: Embeddings persistieren,
Dinghy entladen und Qwen anschließend allein seriell ausführen.

Der Lauf ist kein fachlicher Vergleichs-PASS. Das lokale Qwen-4B-Modell
bestand nur 41 von 71 formalen Reviews, und 40 dieser 41 Zeilen blieben
fachlich `unresolved`. Deshalb bleibt die Richtung unverändert: Code besitzt
Seiten, Zielmengen, Kandidaten und Ergebniszeilen; Qwen darf nur echte
Ambiguität prüfen. Vor einer Kundenaussage fehlen FEUER-Oracle, Rollen- und
Scopebindung, Vertragsrang, Tabellen/Querverweise und ein gehaltenes
A/B-Paar. Details: [Tests, Abschnitt 20](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#20-reales-feuer-ab-kandidatenexperiment-mit-dinghy-und-qwen).

### V3.2.0-Einzeldokumentpilot auf Kundenhardware

Am 26. August 2026 bestand ein V3.2.0-Einzeldokumentlauf mit Qwen 27B und
Dinghy auf dem Kunden-Mac den technischen PageMap-, Retrieval- und
36-Zeilen-/8-Spalten-Strukturpfad für VS-01 bis VS-36. Die autoritative
Dokumentfassung hatte 31 physische Seiten; eine zunächst zur Nachprüfung
verwendete 40-seitige Arbeitsfassung war nicht das Laufdokument und wurde als
Beweisquelle verworfen. Alle 40 geprüften Quellenangaben verwiesen auf die
richtige physische Seite, aber nur 20 waren streng wortgetreu und weitere 16
erst nach Layout-/Interpunktionsnormalisierung zusammenhängend auffindbar.

Mindestens sechs Zeilen blieben bei Sparten-, Sonderfall-, verbundenen
Kategorieelementen oder bedingter tatsächlicher Vereinbarung zu sicher. Der
Stand ist deshalb ein `CONDITIONAL GO` für einen beaufsichtigten Kundenpilot,
nicht für ungeprüfte produktive Deckungsaussagen. Der nächste kontrollierte
Versuch verwendet bei ansonsten unverändertem Laufvertrag den
EL-01-bis-EL-36-Katalog. Messwerte und Beweisgrenze stehen in
[Tests, Abschnitt 25](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#25-v320-einzeldokumentlauf-vs-01-bis-vs-36-auf-kundenhardware).

### V3-Workspace-Fachvorlagen

`v3.2.0` bleibt die Rückkehrbasis; die UI-Nachfolge wird als `v3.2.1`
ausgeliefert. Die nachfolgenden CLI-Preset-Tags
`v3.3.0` und `v3.3.1` werden zurückgezogen: Sie änderten zwar keinen
Chatpfad, führten aber einen zweiten, nicht sichtbaren Workspace-Erstellweg
ein. Die beauftragte Nachfolge integriert die Auswahl direkt in den normalen
zentralen Dialog `Neuer Workspace`.

Die kanonischen Fachvorlagen liegen jetzt ohne Versionssuffix und ohne
führende Nummern unter `kategorie-systemprompts/`:
`VS`, `FE`, `LW`, `ST`, `EL`, `HP`, `VB`, `WE`. Ohne Auswahl bleibt der
AnythingLLM-Default-Systemprompt aktiv. Neue Dialog-Workspaces erhalten
providerneutral System Default, Chatmodus `chat`, Verlauf `1`, Temperatur
`0`, Default-Suche, Top N `55` und Schwelle `0`. Bestehende Workspaces und
globale Modell-/Embeddingeinstellungen bleiben unverändert. Die verbindliche
Entscheidung steht in [ADR-019](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-019-fachvorlagen-werden-beim-normalen-workspace-anlegen-ausgewählt).

Der lokale Abnahmelauf bestätigte die bytegenaue EL-Promptpersistenz, den
AnythingLLM-Defaultprompt ohne Auswahl und sämtliche Startwerte in SQLite.
Zusätzlich wurde ein bereits in `v3.2.0` vorhandener Routerfehler behoben, der
beim Wechsel auf `/workspace/:slug/t/:threadSlug` eine leere Oberfläche
rendern konnte. Der Browser-Smoke erzeugte danach einen neuen Thread samt
Modellantwort ohne UI-Verlust oder Routerwarnung.

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
- kein weiteres freies Search-/Top-N-/Temperatur-/Generator-Roulette als
  Root-Cause-Fix für den monolithischen Ein-Prompt-Volloutput,
- keine reine Keyword-Suche als Beweis, dass eine Klausel nicht existiert,
- kein gleichzeitiges Laden von Qwen und Gemma auf dem 32-GB-Mac,
- keine parallele aktive Qwen- und Dinghy-Inferenz,
- kein Löschen eines guten Basisindexes wegen eines Analysefehlers,
- keine echten Kundendokumente, Namen oder Vertragsdaten in Git oder Fixtures,
- kein neues Release allein aufgrund grüner Unit-Tests ohne realistische
  Laufzeit- und Coverage-Abnahme.

## 9. Nächste kontrollierte Abnahme

Die nächste Abnahme ist kein Deployment-Meilenstein, sondern ein
**Evidenz-/Decision-Gate vor weiterer Agentic-Umsetzung**. Mindestens müssen
vorliegen:

1. bestätigter Ergebnisvertrag für Einzeldokumentanalyse und A/B-Vergleich,
2. fachlich geprüfte Bedeutung von Vergleichspunkt, Faktrolle, Klausel,
   Objekt-, Varianten- und Gültigkeitsscope,
3. getrennte Architekturvarianten mit Nutzen, Risiken, Abbruchkriterien und
   günstigstem Falsifikationstest,
4. Golden Cases für Occurrences, Tabellen, Seitenfortsetzungen, Querverweise,
   mehrere Geldrollen, Varianten und sichere Negativaussagen,
5. messbarer Coverage-, Korrektheits-, Laufzeit- und Ressourcenvertrag,
6. vollständiges Built-in-Run-Ledger als feste Baseline sowie ein definierter
   Vergleich, den ein Agentic- oder Mehrpasslauf tatsächlich schlagen muss,
7. Review des prototypischen Stands `fb5198ab`: behalten, reduzieren oder
   ersetzen; keine stillschweigende Gleichsetzung von grünem Kontrollfluss mit
   fachlicher Produktqualität,
8. Bestätigung der autoritativen Kunden-Release-/Installer-Basis und
   Rollbackgrenzen,
9. ausdrückliche Nutzerfreigabe zur Fortsetzung der Implementierung.

Der exhaustive Selbstbehaltfall bleibt ein wichtiger vertikaler
Falsifikationstest, ist aber nicht mehr automatisch der nächste
Implementierungsschritt.

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
