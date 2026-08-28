# VS-01 bis VS-36: qualitativer Vergleich V3.2.1 gegen V3.3

Stand: 28. August 2026
Abschlusslauf: `INC-009-VS-FULL-QUALITY-AB-LOCAL-4B-R07`

## Aktueller Abschlussbefund

Der vollständige lokale Vergleich ist positiv. Der neue servergebundene
Evidenzweg wurde für LF und WEVIG über alle 36 VS-Kategorien ausgeführt und
gegen den eingefrorenen lokalen V3.2.1-kompatiblen Ausgangslauf geprüft.

| Urteil für V3.3 gegenüber V3.2.1 |  LF | WEVIG | Gesamt |
| -------------------------------- | --: | ----: | -----: |
| BESSER                           |  27 |    30 |     57 |
| GLEICH                           |   8 |     5 |     13 |
| UNKLAR                           |   1 |     1 |      2 |
| SCHLECHTER                       |   0 |     0 |      0 |

Damit ist ein qualitativer Gesamtvorteil für die lokale Architektur belegt:
57 von 72 Dokument-Kategorie-Zellen sind besser, 13 gleichwertig, zwei bleiben
fachlich unentschieden und keine bekannte Zelle ist schlechter.

Das ist noch kein Beweis für eine hundertprozentig richtige Vertragsanalyse
und kein Ergebnis des Kundenmodells. Der Lauf verwendet lokal
`qwen3.5-4b-mlx`. Er ist der GO-Nachweis für den nächsten kontrollierten
Qwen-3.8-27B-Vollvergleich am Kunden-Mac-Studio.

## Vergleichsgrundlage

- Dokumente: LF Immo-Exklusivschutz und WEVIG Premiumschutz-Musterberechnung.
- A: eingefrorene Zeilen des lokalen V3.2.1-kompatiblen Vollvergleichs
  `INC-006-VS-FULL-QUALITY-AB-LOCAL-4B-R01`.
- B: frische vollständige V3.3-Verarbeitung mit 36 Anforderungen und 64
  atomisierten Komponenten.
- Modell: für A und B lokales Qwen-3.5-4B-Setup; der Architekturvergleich
  vermischt deshalb keinen 4B- mit einem 27B-Lauf.
- Bewertung: manuelle, quellenbezogene Qualitätsprüfung. Fehlende Fundstellen
  gelten nicht als belegtes `Nein`; fremde Beträge und Scope-Übertragungen
  werden als Fehler gewertet.

## Vollständige 72-Zellen-Matrix

| VS    | LF     | WEVIG  | Wesentlicher Qualitätsgrund                                                                                                   |
| ----- | ------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| VS-01 | BESSER | GLEICH | LF quellengebundener Neuwert; WEVIG gleicher Kerninhalt einschließlich lokal gebundenem Neuwertbetrag                         |
| VS-02 | GLEICH | BESSER | LF Zeitwertschwelle und Dreijahresfrist erhalten; WEVIG keine Verwechslung mit Indexanpassung                                 |
| VS-03 | BESSER | BESSER | unbelegte Negativaussagen entfallen                                                                                           |
| VS-04 | BESSER | BESSER | Neuwert-, Schaden- und Haftpflichtstellen werden nicht mehr als Methode der Gebäudesummenermittlung ausgegeben                |
| VS-05 | BESSER | BESSER | fehlender Quadratmetersatz bleibt offen statt als unbelegtes Nein zu erscheinen                                               |
| VS-06 | BESSER | BESSER | fehlende Nutzfläche bleibt offen statt als unbelegtes Nein zu erscheinen                                                      |
| VS-07 | GLEICH | GLEICH | Unterversicherungsverzicht in beiden Wegen inhaltlich erkannt                                                                 |
| VS-08 | GLEICH | GLEICH | bedingter Verzicht vollständig und formal gültig ausgegeben                                                                   |
| VS-09 | GLEICH | BESSER | WEVIG zusätzlich mit vollständiger Mehrfachversicherungsbegrenzung                                                            |
| VS-10 | GLEICH | GLEICH | automatische jährliche Indexanpassung erhalten                                                                                |
| VS-11 | GLEICH | BESSER | WEVIG mit vollständiger, lokal gebundener BKI-Bezeichnung                                                                     |
| VS-12 | BESSER | BESSER | keine Aussetzung wird nicht mehr ohne ausdrücklichen Ausschluss als Nein behauptet                                            |
| VS-13 | BESSER | BESSER | LF-Innenausbau wiedergefunden; WEVIG bleibt ohne unbewiesenes Nein offen                                                      |
| VS-14 | BESSER | BESSER | LF-Sonderausstattung wiedergefunden; WEVIG bleibt ohne unbewiesenes Nein offen                                                |
| VS-15 | BESSER | BESSER | Nebengebäude werden quell- und Dokumentstatus-gebunden bewertet                                                               |
| VS-16 | BESSER | BESSER | Garagen und Tiefgarage werden atomar geprüft; allgemeine Nebengebäude werden nicht übertragen                                 |
| VS-17 | UNKLAR | BESSER | LF-Beleglage bleibt zwischen alter Sammelaussage und neuer strenger Atomisierung offen; WEVIG verliert das fremde Sammellimit |
| VS-18 | BESSER | UNKLAR | LF trennt Zäune und Mauern von offenen Toren; WEVIG bleibt wegen unterschiedlicher Detailwirkung fachlich unentschieden       |
| VS-19 | BESSER | BESSER | Wege, Beleuchtung und Bepflanzung werden getrennt; enger Feuer-Scope wird sichtbar statt verallgemeinert                      |
| VS-20 | BESSER | BESSER | Spielplatz und Spielgeräte sind getrennt und mit lokalem Limit gebunden                                                       |
| VS-21 | BESSER | GLEICH | LF zeigt die unterschiedlichen 10-/15-%-Regeln; WEVIG-Betrag bleibt korrekt                                                   |
| VS-22 | BESSER | BESSER | LF bindet die unterschiedlichen Limits rollenlokal; WEVIG behauptet Sondermüll nicht aus allgemeiner Entsorgung               |
| VS-23 | BESSER | BESSER | Bewegung und Schutz werden getrennt belegt; kein fremdes Limit wird übertragen                                                |
| VS-24 | BESSER | BESSER | Gerüstkosten bleiben ohne eigene Fundstelle offen statt aus anderen Kostenarten abgeleitet zu werden                          |
| VS-25 | BESSER | BESSER | behördliche Wiederaufbaukosten erhalten das jeweils lokal gebundene Limit                                                     |
| VS-26 | BESSER | BESSER | allgemeine Behördenkosten beweisen keinen Denkmalschutz; unbelegte Ja-/Nein-Aussagen entfallen                                |
| VS-27 | BESSER | BESSER | Index- oder Vorsorgeklauseln werden nicht als Technologiefortschritt umgedeutet                                               |
| VS-28 | GLEICH | BESSER | LF-Dauer bleibt sechs Monate; WEVIG wird als Vorschlag mit eigener Dauer gebunden                                             |
| VS-29 | BESSER | BESSER | Höhe oder Berechnungsgrundlage wird eigenständig statt durch Wiederholung der VS-28-Dauer beantwortet                         |
| VS-30 | BESSER | BESSER | Mietzinsentgang wird nicht als Eigennutzer-Nutzungsausfall ausgegeben                                                         |
| VS-31 | BESSER | BESSER | Unterkunftslimits und Leistungsdauer sind in beiden Dokumenten lokal gebunden                                                  |
| VS-32 | BESSER | BESSER | Miet- oder Unterkunftsfristen werden nicht als Umzugskosten übernommen                                                        |
| VS-33 | BESSER | BESSER | Vorsorgedeckung erhält das richtige lokale 10-%- beziehungsweise EUR-6.121.600,00-Limit                                       |
| VS-34 | GLEICH | BESSER | LF-Kerninhalt erhalten; WEVIG trennt Gemeinschaftsgeräte von nicht belegtem Werkzeug                                          |
| VS-35 | BESSER | BESSER | Wiederherstellung und Frist werden getrennt; eine fremde Sechsmonatsfrist wird nicht übertragen                               |
| VS-36 | BESSER | BESSER | LF 150 % wird als Ereignishöchstentschädigung gebunden; WEVIG-Jahresaggregat wird nicht als Ereignislimit ausgegeben          |

## Was gegenüber dem ersten Vollversuch geändert wurde

Die Verbesserung beruht nicht auf höherem Top-N, größerer Temperatur oder
einem größeren Kontextfenster. Der Server bereitet die Belege fachlich vor:

- kontrollierte Alias- und Klauselabschnittsuche statt reinem globalem
  Retrieval;
- atomare Komponenten mit `ALL`- oder fachlich begründetem `ANY`-Rollup;
- getrennte Rollen für Objekt, Wirkung, Limit, Bedingung und
  Berechnungsgrundlage;
- explizite Scope-Gates für Sparte, Gefahr, Haftpflicht und engere Sonderfälle;
- deterministische Extraktion lokal gebundener Beträge, Prozentsätze, Dauer und
  Berechnungsgrundlagen;
- Qwen entscheidet nur verbleibende Mehrdeutigkeit und darf keine Quellen,
  Seiten oder Kandidaten erfinden;
- formal gültige Kombinationen aus Deckung und Prüfstatus werden serverseitig
  gerendert.

Gerade VS-04 und VS-36 zeigen den Nutzen: Eine bloße
`Pauschalversicherungssumme` oder ein Jahreshöchstbetrag beantwortet weder die
Methode der Gebäudesummenermittlung noch eine Höchstentschädigung pro Ereignis.

## Technischer Laufbefund

```text
PASS: LF 36/36 Zeilen, 64/64 Komponenten, 64/64 Kontrollen
PASS: WEVIG 36/36 Zeilen, 64/64 Komponenten, 64/64 Kontrollen
PASS: Tabellenvertrag für beide Dokumente
PASS: 57 besser, 13 gleich, 2 unklar, 0 schlechter
REVIEW_REQUIRED: noch kein fachlich freigegebenes absolutes 72-Zellen-Oracle
REVIEW_REQUIRED: Qwen-3.8-27B-Verhalten auf dem Kunden-Mac-Studio
```

Das `REVIEW_REQUIRED` im technischen Materialisierungsreport betrifft das noch
nicht eingefrorene absolute Volloracle und den absichtlich nicht als lokale
4B-Baseline verwendbaren alten 27B-Report. Es ändert den positiven
quellenbezogenen A/B-Befund nicht.

## Entscheidung

```text
GO: lokaler Architekturvergleich gegenüber V3.2.1
GO: kontrolliertes Release-Candidate-Paket für den 27B-Kundenvergleich
NO CLAIM: hundertprozentige fachliche Vollständigkeit
NO CLAIM: 27B-Qualitätsgewinn, bevor derselbe Vollvergleich am Kundenrechner lief
```

## Laufartefakte

Die privaten Dokument- und Quellenartefakte liegen bewusst außerhalb des
Repositories im lokalen QA-Archiv. Enthalten sind pro Dokument das
vollständige Worksheet, Candidate-Triage,
Evidence-Materialisierung, 36-Zeilen-Ergebnis, Quellenbindungen, Reports und
die eingefrorenen V3.2.1-Baseline-Zeilen.

## Historischer Verlauf

Der erste Vollversuch R01 ergab 31 bessere, 31 schlechtere, vier gleiche und
sechs unklare Zellen. Die Ursachen waren zu enge Kandidatensuche, fehlende
Klauselblock-Bindung, unvollständige Feldextraktion und falsche Scope- oder
Rollenübertragung. Die Korrekturen wurden zunächst familienweise geprüft
(VS-07 bis VS-11, danach VS-01/VS-02) und erst anschließend mit dem hier
dokumentierten vollständigen R07-Lauf über beide Dokumente regressionsgeprüft.
