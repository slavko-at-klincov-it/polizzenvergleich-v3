# LF IMMO – alle acht Kategorien mit Qwen 3.8 27B

Stand: 28. August 2026

Lauf: `LF-ALL-CATEGORIES-27B-RC4-20260828-180411`

## Kurzurteil

Der Lauf ist als vollständige 27B-Baseline des monolithischen Promptwegs
verwertbar, aber nicht als Qualitätsnachweis des neuen RC4-Evidenzwegs.

Alle acht kanonischen Kategorie-Systemprompts wurden auf demselben LF-Dokument
ausgeführt. Es entstanden alle 320 erwarteten Tabellenzeilen. Trotzdem endeten
alle acht Läufe formal mit `REVISE`. Nur 124 von 320 Zeilen sind ohne formale
Vertragsabweichung; 196 Zeilen besitzen mindestens einen Fehler.

Der entscheidende Architekturpunkt: Der verwendete Befehl rief achtmal
`pdfProvenanceLiveRun.cjs` auf. Das ist der alte monolithische Vollpromptweg.
Die in RC4 implementierte servergebundene Candidate-, Rollen-, Scope-,
Feld- und Rendererlogik wurde in diesem Lauf nicht ausgeführt. Der Name des
Ausgabeordners bezeichnet den installierten Softwarestand, nicht den aktiven
Analysepfad.

## Identität und Vollständigkeit

```text
PDF SHA-256: 2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62
PDF-Seiten: 31/31 verarbeitet
Chunks: 38
Retrieval: Top-N 38, alle 31 physischen Seiten im Kontext
LLM: qwen/qwen3.8-27b
Embedding: dinghy-embed
Temperatur: 0
Systemprompts: alle acht Hashes entsprechen den kanonischen V3-Templates
Zeilen: 320/320
```

Damit sind PDF-Erfassung und Retrieval nicht die Hauptursache der beobachteten
Fehler. Das Modell erhielt bei jedem Kategorielauf den vollständigen
Dokumentkontext.

## Formale Ergebnisse

| Ansicht    |  Zeilen | Fehlerhafte Zeilen | Formal saubere Zeilen |      Sauber |
| ---------- | ------: | -----------------: | --------------------: | ----------: |
| VS         |      36 |                 21 |                    15 |     41,67 % |
| FE         |      80 |                 54 |                    26 |     32,50 % |
| LW         |      36 |                 28 |                     8 |     22,22 % |
| ST         |      36 |                 28 |                     8 |     22,22 % |
| EL         |      36 |                 28 |                     8 |     22,22 % |
| HP         |      36 |                 21 |                    15 |     41,67 % |
| VB         |      36 |                  2 |                    34 |     94,44 % |
| WE         |      24 |                 14 |                    10 |     41,67 % |
| **Gesamt** | **320** |            **196** |               **124** | **38,75 %** |

Die 224 gemeldeten Einzelabweichungen bestehen aus:

```text
101 QUOTE_NOT_FOUND_ON_PAGE
115 INVALID_MISSING_CONTENT
  8 weitere Status-, Deckungs- oder Quellenfehler
```

`INVALID_MISSING_CONTENT` ist häufig eine falsche Variation des vorgeschriebenen
Missing-Sentinels und nicht automatisch eine fachliche Falschaussage.
`QUOTE_NOT_FOUND_ON_PAGE` ist ernster: Das Modell kürzt, kombiniert oder
paraphrasiert Quellen, obwohl ein wörtliches Seitenzitat verlangt ist.

## Laufzeit und Ressourcen

```text
Prompt-Tokens:     255.813
Completion-Tokens:  36.919
Gesamttokens:      292.732
Reine Modellzeit:  7.208,531 Sekunden = 2:00:08
Wandzeit:          7.618 Sekunden     = 2:06:58
```

Das überschreitet das angenommene Produktbudget von ungefähr einer Stunde.
Das LF-PDF wurde achtmal geparst, gechunkt und eingebettet. Dieselben rund
31.800 Dokumenttokens wurden achtmal erneut an das Modell gesendet. Ein
Produkt-Gesamtlauf muss das Dokument einmal vorbereiten und Fakten zwischen
den Kategorieansichten wiederverwenden.

## Belegte fachliche Fehlerfamilien

### 1. Enger Klauselscope wird auf eine andere Gefahr übertragen

Auf LF-Seite 10 stehen die Ausschlüsse für Fassade, Dachkonstruktion und
Dachrinnen unmittelbar unter der Zusatzdeckung `Schnee- und Eisrutsch`.
Der monolithische Lauf überträgt sie trotzdem auf:

- ST-04 Hagel an Dach und Fassade;
- ST-06 Schneedruck auf Dach und Tragkonstruktion;
- ST-11 Dachrinnen allgemein.

Dadurch entstehen belegte `Nein`-Aussagen aus einem engeren anderen Scope.

### 2. Bedingte Klausel wird als tatsächlich vereinbarte Deckung ausgegeben

VS-33 behauptet eine vereinbarte Vorsorgeversicherung. Die Quelle sagt nur:
`Wurde eine Vorsorgeversicherung vereinbart ...`. Sie definiert die Wirkung
für den Fall einer Vereinbarung, beweist aber nicht, dass die Polizze diese
Position tatsächlich enthält.

### 3. Rollen und getrennte Klauseln werden zu einer neuen Aussage verbunden

- VS-04 deutet eine allgemeine Pauschalversicherungssumme und eine spätere
  Indexanpassung als Methode der Gebäudesummenermittlung.
- FE-D01 verbindet versicherte Schäden durch Feuerwehreinsätze mit dem
  separaten 15-%-Limit für Feuerlöschkosten und behauptet daraus eine
  vollständige Kostenregel.
- HP-03 bejaht die Kategorie trotz fehlendem verlangtem Sublimit und fällt
  dadurch zusätzlich in eine unzulässige Status-/Deckungskombination.

### 4. Mehrteilige Kategorien werden zu früh vollständig bejaht oder verlieren

Einzelwirkungen

- VS-18 verlangt Einfriedungen, Zäune, Mauern und Tore. Die Quelle belegt
  Mauern und Zäune, nicht Tore; trotzdem lautet das Ergebnis `Ja / BELEGT`.
- FE-D05 verlangt Rauch und Ruß ohne eigenes Feuer. Die Quelle nennt nur
  Verrußung, auch bei Glimm- oder Schmorbrand; trotzdem lautet die gesamte
  Kategorie `Ja / BELEGT`.
- LW-20 verlangt Grund-, Sicker- oder Stauwasser. Belegt ist nur der Ausschluss
  von Grund- oder Hochwasser; das Ergebnis verneint trotzdem die ganze Zeile.
- EL-16 erkennt Wintergarten als eingeschlossen und Vitrinen als ausgeschlossen,
  kann den gemischten Zustand aber nur als `Nicht feststellbar / TEILBELEGT`
  darstellen. Die Einzelwirkungen gehen in der sichtbaren Deckungsspalte
  verloren.

### 5. Teil- oder Sonderfall wird als allgemeine Antwort behandelt

- LW-13 belegt nur den Ausschluss der _bestimmungsgemäßen_ Auslösung einer
  Sprinkleranlage und verneint daraus Wasseraustritt aus Sprinkler- oder
  Löschanlagen insgesamt.
- HP-15 verwendet den Ausschluss für den Versicherungsnehmer und bestimmte
  Angehörige als allgemeines Nein für Schäden sämtlicher versicherter Personen
  untereinander.
- WE-01 liest das kombinierte Feld
  `Versicherungsnehmer bzw. Verwalter- und Treuhänder` als eindeutigen Beweis,
  dass keine Eigentümergemeinschaft Versicherungsnehmerin ist.

## Positive Befunde

- Alle 320 IDs und Tabellenzeilen sind vorhanden.
- Die Modell- und Promptidentitäten sind vollständig nachvollziehbar.
- EL-08 bleibt bei nur belegtem Erdrutsch korrekt teilbelegt.
- EL-16 erkennt beide getrennten Objektwirkungen in der Beschreibung.
- EL-19 leitet aus der bloßen Aufzugsnennung keinen Maschinenbruch ab.
- VB ist mit 34 von 36 formal sauberen Zeilen deutlich stabiler als die
  übrigen Ansichten.
- VS-15 trennt die allgemeine Nebengebäudedeckung sprachlich von der nicht
  belegten namentlichen Anführung; der servergebundene RC4-Weg ist dennoch
  vollständiger, weil er das 5-%-Limit als sicheren Teilbeleg erhält.

## Stabilitätsbefund innerhalb desselben 27B-Setups

Der VS-Teil wurde mit dem früheren 27B-Legacy-Replay verglichen. Der
Systemprompt, das PDF, Modell und die Retrievalparameter sind gleich; der
Ausführungsprompt war diesmal generisch statt ausdrücklich
`VS-01 bis VS-36`.

```text
Nur 3/36 Zeilen sind textlich exakt gleich.
33/36 Zeilen unterscheiden sich in mindestens einem Feld.
VS-24, VS-30 und VS-32 ändern zusätzlich Deckung oder Prüfstatus.
Modellzeit vorher: 302,633 Sekunden
Modellzeit jetzt:  866,474 Sekunden
```

Das beweist keine alleinige Promptursache, zeigt aber, dass Temperatur 0 und
vollständiger Kontext den monolithischen Tabellenlauf nicht stabil machen.

## Entscheidung

```text
PASS: vollständige 27B-Baseline über alle acht LF-Kategorieansichten
PASS: starke Evidenz, dass PDF-Erfassung und Top-N nicht das Hauptproblem sind
NO-GO: monolithischer Promptweg als zuverlässiger Produkt-Gesamtlauf
NO-GO: Lauf als Nachweis einer RC4-Verbesserung außerhalb von VS
NO-GO: aktuelle Laufzeit gegenüber dem Zielbudget von etwa einer Stunde
```

## Nächster kleiner Schritt

Keinen weiteren identischen Acht-Prompt-Lauf starten. Zuerst muss ein echter
All-Kategorien-Runner den vorhandenen servergebundenen Weg aktivieren:

1. PDF und PageMap einmal erzeugen und für alle Ansichten wiederverwenden.
2. Pro Ansicht den vorhandenen Full-Katalog verwenden.
3. Scope-, Rollen-, Komponenten- und Feldentscheidungen serverseitig
   materialisieren.
4. Fehlende Evidenz zentral als `UNGEKLÄRT` rendern und Quellen ausschließlich
   aus exakten servereigenen Spans ausgeben.
5. Pro Kategorie sichtbar kennzeichnen, welche Zeilen bereits fachlich
   kontrolliert sind und welche nur `REVIEW_REQUIRED` bleiben.
6. Erst dann denselben LF-Gesamtlauf als A/B gegen diese eingefrorene Baseline
   ausführen.
