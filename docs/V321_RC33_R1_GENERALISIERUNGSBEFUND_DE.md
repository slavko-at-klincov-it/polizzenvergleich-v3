# V3.2.1–RC33-Vergleich und R1-Generalisierungsbefund

Stand: 29. August 2026  
Status: technisch und qualitativ geprüft; keine 99-Prozent-Freigabe

## Zweck

Dieser Befund trennt drei Fragen:

1. Was änderte der kontrollierte V3.3-Pfad gegenüber V3.2.1?
2. Behebt die erste allgemeine Recall-Erweiterung `R1` nachweislich echte
   Verluste, ohne alte Scope-Fehler wieder einzuführen?
3. Was fehlt weiterhin für eine belastbare 99-Prozent-Aussage?

LF IMMO und WEVIG sind Entwicklungs- und Regressionsfixtures. Öffentliche
Unterlagen anderer Versicherer dienen hier nur als Wortlaut-, Layout- und
Nichtaktivierungs-Holdouts. Keine dieser Prüfungen ersetzt ein vollständiges,
fachlich gelabeltes Vertragsoracle.

## Exakte Vergleichsbasis V3.2.1 gegen RC33

- Baseline: Tag `v3.2.1`, Commit
  `c2e9cb275207af4a45e49649393f9a8792805cff`;
- kontrollierter Pfad: Tag `v3.3.0-rc.33`, Commit
  `3ef0e950d694bef6ed0988d4a41593b3534a47b3`;
- Dokument: WEVIG-Musterberechnung, SHA-256
  `a476cc2e0d970c0143e552bd7d901d82abd89324ba4cf316bc7ee3202a8b0b16`;
- Modell: `qwen/qwen3.8-27b`;
- Parameter: Chunk 3000, Overlap 250, Top N 55, Tokenlimit 42496;
- Dokumentrolle: `PROPOSAL`;
- 320 erwartete und 320 ausgegebene Zeilen über VS, FE, LW, ST, EL, HP, VB
  und WE.

Es gibt keinen finalen Tag `v3.3.0`. Die korrekte Vergleichsbezeichnung ist
daher `v3.2.1` gegen `v3.3.0-rc.33`.

Für VS lief der historische Tag unverändert. Für FE bis WE wurde nur die
damalige QA-ID-RegEx testseitig um die schon damals vorhandenen
alphanumerischen Kategorie-IDs ergänzt. Prompt, Retrieval, Analyse,
Modellparameter und Tabelleninhalt des historischen Pfads blieben
unverändert.

## Ergebnis des vollständigen Versionsvergleichs

| Kategorie | Zeilen | gleicher Kern | geänderter Kern |
| --- | ---: | ---: | ---: |
| VS | 36 | 23 | 13 |
| FE | 80 | 72 | 8 |
| LW | 36 | 24 | 12 |
| ST | 36 | 28 | 8 |
| EL | 36 | 14 | 22 |
| HP | 36 | 25 | 11 |
| VB | 36 | 22 | 14 |
| WE | 24 | 13 | 11 |
| **Gesamt** | **320** | **221** | **99** |

Die 99 geänderten Zeilen sind keine Fehler- oder Qualitätsquote. Der Vergleich
zeigt einen Fehlertypwechsel:

- RC33 verhindert zahlreiche unzulässige Zusammenschlüsse verschiedener
  Objekte, Gefahren, Scopes, Rollen und Beträge;
- RC33 bindet Quellen und Wertrollen deutlich enger;
- RC33 verliert gleichzeitig echte Klauseln, wenn die kontrollierte
  Kandidatensuche eine fremde Formulierung nicht erkennt;
- weniger `BELEGT` kann deshalb korrekt vorsichtig oder ein Recall-Fehler sein.

Klare Sicherheitsgewinne sind unter anderem EL-16
(Wintergärten ungleich Vitrinen), LW-31/ST-34
(Gebäudesumme ungleich Spartenmaximum), HP-08
(Bausummengrenze ungleich Haftpflichtsublimit) und VB-14
(Grobfahrlässigkeitslimit ungleich Obliegenheitenerweiterung).

Klare Recall- oder Polaritätslücken wurden unter anderem bei LW-09/13/14/27,
ST-05/29, EL-05/06/11/19/20/28, HP-12/18/22 und
VB-10/12/13/20/32 gefunden. Sie sind als priorisierte Arbeitsliste zu
behandeln, nicht durch eine globale Promptlockerung.

## R1: kontrollierte lexikalische Konzeptgruppen

Commit `27cb643a3026c97f46e2ed3e1af3377bb8600325` ergänzt einen optionalen,
deklarativen Kandidatenvertrag:

- atomare Konzeptgruppen und normalisierte Wortpräfixe statt nur exakter
  Ganzphrasen;
- alle Gruppen müssen in einer begrenzten Klauselspanne vorkommen;
- 1 bis 3 physische Zeilen, maximal 900 Zeichen;
- verschiedene Gruppen müssen durch verschiedene Quellwörter erfüllt sein;
- Originaloffsets, Seite und Originaltext bleiben erhalten;
- exakte Aliase haben Vorrang;
- der Treffer ist nur Kandidat und nie automatisch ein Vertragsfakt.

R1 ist zunächst ausschließlich für ausgewählte LW-Komponenten aktiviert. Das
ist ein vertikaler Beweis des allgemeinen Mechanismus, keine
WEVIG-Sonderregel: Produktionsregeln enthalten weder Versicherername,
Seitennummer noch Kundenphrase als alleinigen Auslöser.

## Zielhardware-Ergebnis für WEVIG LW

Der isolierte Commit wurde auf dem Mac Studio mit
`qwen/qwen3.8-27b`, Temperatur 0 und Tokenlimit 42496 ausgeführt.

```text
PASS: 41/41 Kandidaten und Kontrollen
PASS: 52/52 Komponenten und Kontrollen
PASS: 36/36 Tabellenzeilen
PASS: gegenüber RC33 exakt vier beabsichtigte Kernänderungen
PASS: übrige 32 Zeilen in Status, Deckung und Betrag unverändert
PASS: 4B- und 27B-Lauf für alle 36 Kernzeilen identisch
```

Die vier Änderungen:

- `LW-09`: `UNGEKLÄRT` -> `TEILBELEGT`; Wiederherstellung in den
  ursprünglichen Zustand ist belegt, die vollständige Kategorie- und
  Betragsbindung aber nicht;
- `LW-13`: `UNGEKLÄRT` -> `BELEGT / Ja`; Wasser-/Löschmittelaustritt aus
  Sprinkler- oder Löschanlagen ist ausdrücklich geregelt;
- `LW-14`: `UNGEKLÄRT` -> `TEILBELEGT`; Kältemittel aus Klimaanlagen ist
  belegt, Lüftungsanlagen sind nicht belegt;
- `LW-27`: `UNGEKLÄRT` -> `TEILBELEGT`; Wasserverlust und EUR 7.500 auf
  Erstes Risiko sind belegt, die verlangte Rolle `gegenüber dem Versorger`
  bleibt unbewiesen.

`LW-31` bleibt `UNGEKLÄRT`. Damit kehrt der alte Fehler nicht zurück, die
Gebäudesumme als Höchstentschädigung der Sparte auszugeben.

Der R1-Statusmix lautet 8 `BELEGT`, 5 `TEILBELEGT` und 23 `UNGEKLÄRT`.
Diese Verteilung ist kein Qualitätsmaß; entscheidend sind die belegten
atomaren Rollen und die 32 unveränderten Kontrollzeilen.

## Fremdformulierungsprüfungen

Vier offizielle Dokumente von UNIQA, DONAU, GRAWE und Wiener Städtische
wurden visuell und textuell als Holdouts geprüft. Sie dürfen nicht als aktive
Kundenpolizzen interpretiert werden.

Für eine eingefrorene UNIQA-LW-Mikroreferenz mit acht klaren direkten
Nennungen gilt:

```text
RC33 exakte Aliase: 1/8 Anforderungsgruppen als Kandidat
R1:                8/8 Anforderungsgruppen als Kandidat
Abwesenheitsset:   0/16 unerwünschte Kandidaten
4B-Triage:         7/8 direkt oder eng belegt
```

Die achte Tabellenangabe `Wasserverlust EUR 1.000` bleibt auf Faktenebene
offen. Ursache ist nicht mehr der Kandidaten-Recall, sondern die noch fehlende
Bindung von Tabellenkopf, Produktvariante, Zeile und Betrag. Das ist das
nächste eigenständige Architekturproblem.

Der ungetunte DONAU-Gegencheck liefert enge Bruch-, Frost- und
Rohrreinigungskandidaten, aktiviert aber bloße Wasserverlust- oder
Folgeschadenformulierungen nicht als vollständige Deckungsfakten. Das ist ein
positiver Nichtaktivierungsbefund, aber kein Vertragsoracle.

Breites semantisches Retrieval wurde ebenfalls geprüft und verworfen:
Ähnlichkeitsschwellen fanden zwar echte Formulierungen, bewerteten aber
bewusst abwesende Anforderungen teilweise höher. Dinghy oder Embeddings
dürfen daher später nur Kandidaten für weiterhin ungelöste Komponenten
vorschlagen; sie dürfen nie selbst `BELEGT` erzeugen.

## Automatisierter Testbefund

Mit der im Projekt gebündelten Node-22-Runtime:

```text
PASS: 93 Jest-Suites
PASS: 1.088 Tests
```

Ein Lauf mit der global installierten Node-26-Runtime scheiterte bereits beim
Laden des alten JWT-Abhängigkeitsbaums. Das ist ein reproduzierbarer
Umgebungsfehler und keine R1-Regression. Release- und QA-Befehle müssen die
gebündelte Runtime verwenden.

## Aussage zum 99-Prozent-Ziel

Noch nicht bewiesen sind 99 Prozent Endergebnisqualität oder die Eignung für
beliebige Polizzen. Bewiesen ist:

- der komplette V3.2.1/RC33-Vergleich ist reproduzierbar;
- der kontrollierte Pfad reduziert konkrete, gefährliche Scope- und
  Wertbindungsfehler;
- R1 gewinnt echte, fremd formulierte Kandidaten zurück;
- R1 verbessert auf Zielhardware genau vier bekannte LW-Zeilen und lässt die
  übrigen 32 stabil;
- ein unsicherer Teilbeleg wird nicht in ein bequemes Gesamt-`Ja`
  hochgestuft;
- reine semantische Ähnlichkeit ist als Entscheidungsregel ungeeignet.

Für eine echte 99-Prozent-Abnahme fehlen weiterhin:

1. ein versioniertes, atomar und fachlich gelabeltes Oracle;
2. zuvor ungesehene vollständige Vertrags- und Zusatzpakete mehrerer
   Versicherer;
3. Feldmetriken für Recall, Precision, Polarität, Wertbindung,
   Scope/Objekt/Rolle und Zitierbarkeit;
4. Wiederholung auf Zielhardware mit eingefrorener Version, Konfiguration und
   Dokumentidentität;
5. fachliche Abnahme der verbleibenden `UNGEKLÄRT`- und
   `TEILBELEGT`-Cluster.

## Nächste priorisierte Ausbaustufen

1. Den R1-Vertrag kontrolliert auf die bereits nachgewiesenen Recall-Lücken in
   ST, EL, HP und VB übertragen; jede Kategorie behält Positiv-, Negativ- und
   Stabilitätskontrollen.
2. Positive Grundregel und lokale Ausschlüsse gemeinsam auffinden, aber
   getrennt nach Scope und Polarität bewerten; HP-12 ist der wichtigste
   Regressionstest.
3. Tabellenkopf, Zeilenlabel, Variantenspalte und Betrag strukturell binden;
   UNIQA `Wasserverlust EUR 1.000` ist der erste eingefrorene Testfall.
4. Erst danach einen begrenzten semantischen Fallback ausschließlich für
   weiterhin ungelöste Komponenten testen.
5. Sobald weitere echte Kunden-Zusatzverträge verfügbar sind, Dokumentrolle,
   Rang, Ersetzung und Haupt-/Zusatzvertragszusammenführung als eigenes Oracle
   ergänzen.

R1 ist damit ein positiver, releasefähiger Codekandidat für den geprüften
LW-Schnitt, aber noch keine Freigabe des Gesamtprodukts oder des
99-Prozent-Ziels.
