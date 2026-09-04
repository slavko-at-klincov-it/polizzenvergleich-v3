# Manuelle Quellenprüfung LF-Referenzvergleich (35 Zeilen)

Stand: 4. September 2026

## Zweck und Prüfgrenze

Diese Prüfung bewertet ausschließlich den gerichteten Prozess: Jede Zeile wird
aus dem LF-IMMO-Dokument (Seite A) abgeleitet; anschließend wird in dem
neunteiligen Vergleichspaket B nach dem fachlichen Gegenstück gesucht. Es werden
keine zusätzlichen B-only-Leistungen erzeugt. Ein fehlender Fund ist kein
Nachweis eines Ausschlusses.

Geprüft wurden die Original-PDF-Seiten, nicht nur extrahierter Text. Das
Entwicklungsset besteht aus genau einem LF-IMMO-Dokument auf A und neun
WEVIG-/Generali-Dokumenten auf B. Die Prüfung belegt deshalb keine
Generalisierung auf beliebige Polizzen.

Abkürzungen der B-Quellen:

- B01: WEVIG-Musterberechnung/Premiumschutz
- B02: GenVerbund-Rahmenvereinbarung WGB 04/2025
- B03: ABG-W
- B04: ABS
- B05: AFB
- B06: AHVB-W
- B07: AStB
- B08: AWB
- B09: EABS

## Manuelle Sollmatrix

`Voll` bedeutet, dass zu allen LF-Unterkomponenten eine fachlich entsprechende
B-Regel vorhanden ist; Werte und Reichweiten dürfen abweichen und müssen im
Ergebnis sichtbar bleiben. `Teilweise` bedeutet, dass nur ein Teil der
LF-Unterkomponenten ein Gegenstück hat. `Nullfund` bedeutet, dass nach Prüfung
aller neun B-Dokumente kein belastbares Gegenstück für die LF-Zeile vorhanden
ist.

| LF-Zeile | A-PDF | maßgebliche B-PDF-Seiten | manuelles Soll | Feststellung vor dem Neulauf |
|---|---:|---|---|---|
| LF-PR-01 | 2 | B01 S. 1–5; B02 S. 1–2 | Voll | Premiumschutz und beantragte Sparten waren vorhanden, aber nicht als Synonyme modelliert. |
| LF-PR-02 | 2 | B02 S. 6 und 8 | Teilweise | Die günstigere Auslegung ist vorhanden; Summenaddition und einmalige Anwendung je Schadenfall fehlen. |
| LF-VS-01 | 3 | B09 S. 2–3 | Teilweise | Gebäude und haustechnische Installationen sind belegt; Fundamente sowie An-/Zubauten nicht ausdrücklich. Das Einzelwort „Gebäude“ erzeugte Fremdtreffer. |
| LF-VS-02 | 3 | B01 S. 2 | Teilweise | Nebengebäude vorhanden, aber anderes Limit und kein Gewächshaus-Ausschluss. |
| LF-VS-03 | 4 | B02 S. 10; B01 S. 13 | Teilweise | Gemeinschaftseinrichtungen und Pflegegeräte vorhanden; Bewohnerinvestitionen fehlen. |
| LF-VS-04 | 4–5 | B01 S. 2–4; B02 S. 9–10 | Voll | Außenanlagen plus Erstrisikolimit vorhanden. Breites Alias „auf Erstes Risiko“ und Definitionen aus B09 erzeugten einen falschen Widerspruch. |
| LF-KO-01 | 5 | B01 S. 1 und 9 | Voll | Mietzinsentgang, Miet-/Pachtobjekt und sechs Monate sind vorhanden. Dauer war fälschlich als Geldlimit angefordert. |
| LF-KO-02 | 5 | B01 S. 1 und 9 | Teilweise | Ersatzunterkunft, sechs Monate und Subsidiarität vorhanden; LF-Hotel-/Pensionsalternativen mit EUR 50/120 pro Tag fehlen. |
| LF-KO-03 | 5 | B01 S. 1 und 13; B02 S. 5 | Teilweise | Mehrere Kostenarten sind vorhanden, aber nicht alle LF-Kostenarten, insbesondere kein belastbarer Lagerkostenbeleg. Die alte Komponente fasste Bewegung und Lagerung unzulässig zusammen. |
| LF-FE-01 | 7 | B05 S. 2 | Teilweise | Brand, Explosion und direkter Blitz sind vorhanden; Sprengstoffexplosion nicht als gleichwertige Deckung. |
| LF-FE-02 | 7 | B02 S. 12; B05 S. 2 | Voll | B02 schließt Rauch/Verrußung und elektrische Energie ausdrücklich ein. Der allgemeine AFB-Ausschluss wurde fälschlich als gleichrangiger Konflikt gewertet. |
| LF-FE-03 | 7–8 | B01 S. 1 und 11; B02 S. 11 | Teilweise | Indirekter Blitz und Anlagenbezug vorhanden; kein entsprechendes LF-Prozent-/Mindestlimit. Das frühere Vollergebnis verwendete irrtümlich ein Architektenkosten-Limit. |
| LF-FE-04 | 9 | keine belastbare B-Stelle | Nullfund | Kein erweiterter Vandalismus mit zugehörigem Limit, Selbstbehalt und Graffiti-Ausschluss. Breite Limit-/Selbstbehalt-Aliase erzeugten Fremdbelege. |
| LF-ST-01 | 10 | B07 S. 2 | Voll | Sturm über 60 km/h, Hagel und Schneedruck sind vorhanden. |
| LF-ST-02 | 10 | B01 S. 4; B02 S. 12 | Teilweise | Dachlawinen/Schneerutsch sind vorhanden; die vier LF-Ausschlussgruppen fehlen bzw. weichen ab. Das alte Schema nannte irrtümlich Schneefanggitter und Vordächer. |
| LF-ST-03 | 10 | B01 S. 4; B08 S. 2 | Voll | Katastrophengefahren mit B-Limits sind im Angebot vorhanden; der allgemeine AWB-Ausschluss ist durch die besondere Deckung überlagert. |
| LF-ST-04 | 10 | B01 S. 3–4 | Nullfund | B nennt eine unbekannte Hochwasserzone, aber keine HQ30-Regel. „Hochwasser“ allein ist kein HQ30-Gegenstück. |
| LF-LW-01 | 12 | B01 S. 2–3; B08 S. 2 | Voll | Leitungswasseraustritt, Rohrbruch und Frost sind im B-Paket vorhanden. |
| LF-LW-02 | 12 | B01 S. 2; B08 S. 3 | Teilweise | Rohrersatzlänge ist vorhanden; keine Inliner-Verdopplung. |
| LF-LW-03 | 12 | B01 S. 2 und 13 | Voll | Suchkosten bei begründetem Verdacht auch ohne ersatzpflichtigen Schaden samt Erstrisikolimit sind vorhanden. |
| LF-LW-04 | 13 | B01 S. 3; B02 S. 14 | Voll | Außenrohre, Armaturen, Verstopfungsbehebung und optische Wiederherstellung sind vorhanden. |
| LF-LW-05 | 14 | B01 S. 2–3; B02 S. 14 | Teilweise | 15 lfm, Wasserverlust und Regenabläufe vorhanden; Rohrreinigung ist in B betraglich begrenzt und daher kein Gegenstück zur unlimitierten LF-Regel. |
| LF-GL-01 | 15 | B01 S. 5 | Voll | Gebäudeverglasung und Einzelscheiben bis 10 m² stehen ausdrücklich im Angebot. Schreibweise/Einheitenformat verursachten den bisherigen Miss. |
| LF-GL-02 | 15 | B01 S. 4–5 | Voll | Sonderverglasung mit B-Limit sowie sturmbedingter Glasbruch an Solar-/PV-Anlagen sind vorhanden; die B-Reichweite ist enger und muss sichtbar bleiben. |
| LF-GL-03 | 15 | B02 S. 14; B09 S. 7 | Teilweise | Notverglasung, Gerüst und Entsorgung sind vorhanden; keine belastbare kurzfristige Bewachung speziell nach Glasschaden. |
| LF-HP-01 | 17 | B01 S. 5; B06 S. 4 | Voll | Pauschalversicherungssumme und dreifache Jahresleistung sind vorhanden. |
| LF-HP-02 | 18 | B01 S. 5 und 16 | Teilweise | Bauherrenhaftpflicht vorhanden, aber nicht die LF-Formel „höherer Wert aus EUR 440.000 oder 20 %“. |
| LF-HP-03 | 19 | B01 S. 5 und 16–17; B06 S. 4 | Teilweise | Umweltstörung, Sanierung, Bedingung und Sublimit vorhanden; kein LF-entsprechender bezifferter Selbstbehalt. |
| LF-OK-01 | 22 | B06 S. 5 (Abgrenzung) | Nullfund | B06 regelt nur kurzfristige Zwischenlagerung als Ausnahme; keine Behandlungskosten-Deckung entsprechend LF-Ökoschutz. |
| LF-OK-02 | 23 | B06 S. 4–5 | Voll | Zweijährige Nachmelde- und dreijährige Rückwärtsdeckung sind vorhanden; LF hat bei Rückwärtsdeckung zwei Jahre. |
| LF-AV-01 | 25 | B09 S. 6–8 | Voll | B enthält Höchstentschädigung und Erstrisiko-Regel, jedoch nicht 150 %, sondern Begrenzung auf die Versicherungssumme. |
| LF-AV-02 | 26 | B02 S. 6 und 9; B09 S. 7–8 | Voll | Neuwert, Wiederherstellungsvoraussetzung und Dreijahresfrist sind vorhanden. Dauer war im alten Profil als Geldlimit behandelt. |
| LF-AV-03 | 26 | B02 S. 6; B09 S. 6 | Voll | Entsprechende Zeitwertschwellen sind vorhanden (B02 20 %, B09 40 % statt LF 30 %). |
| LF-AV-04 | 30 | B02 S. 4 (nur Sachverständigenauswahl) | Nullfund | Keine B-Erstattung von 80 % bis EUR 36.337 ab der LF-Schadenschwelle. Das Wort „maximal“ lieferte zuvor Fremdlimits. |
| LF-AV-05 | 31 | B01 Wertanpassung; B02 S. 8 | Teilweise | Unterversicherungsverzicht und Indexbezug vorhanden; kein Neuwertschätzgutachten mit LF-Geltungsdauer von ca. drei Jahren. |

Manuelles Soll vor dem Neulauf: 16 Voll, 15 Teilweise, 4 kontrollierte
Nullfunde, 0 unklare A-Referenzzeilen. Dieses Soll ist eine prüfbare
Entwicklerannotation für genau das vorliegende 1+9-Dokumentenset, keine
allgemeine Qualitätsquote.

## Gefundene systemische Ursachen und Korrekturen

1. Produkt- und Bedingungssynonyme fehlten, obwohl das Gegenstück wortgleich
   oder fachlich eindeutig vorhanden war.
2. Einwort-Aliase wie „Gebäude“, „maximal“, „Selbstbehalt“ oder „auf Erstes
   Risiko“ banden Werte aus fremden Klauseln.
3. Eine Definition (`DEFINED`) erfüllte fälschlich versicherte Objekte,
   Leistungen, Kosten und Gefahren, obwohl dafür eine Einbeziehung (`INCLUDED`)
   erforderlich ist.
4. Jede Variation von `INCLUDED`, `DEFINED` und `CONDITIONAL` wurde als
   Widerspruch behandelt. Jetzt gelten nur echte Gegenwirkungen als Konflikt;
   paketbezogene Haupt-/Ergänzungsdokumente gehen allgemeinen Bedingungen für
   dieselbe Komponente vor.
5. Jede Bedingung erzwang bisher ein zusätzlich extrahiertes Freitextfeld. Das
   Komponentenbeweismittel genügt nun, sofern die LF-Zeile kein eigenes
   strukturiertes Bedingungsfeld verlangt.
6. Zeitspannen wurden als Geld-/Prozentlimit angefordert. Mietausfall-,
   Ersatzunterkunft-, Wiederherstellungs- und Verzichtsfristen verwenden nun
   das Feld `duration`.
7. Zusammengesetzte LF-Aussagen waren teilweise zu grob. KO-02, KO-03 und ST-02
   wurden in fachlich unabhängig prüfbare Pflichtkomponenten zerlegt.
8. Visuelle PDF-Zeilenumbrüche trennten Subjekt, Bedingung und operatives Verb.
   Operative Zusagen werden nun bis zur echten Satzgrenze statt nur bis zum
   nächsten Layout-Zeilenumbruch ausgewertet.
9. Subsidiäre Zusagen wie „soweit ... keine Deckung finden, ...
   mitversichert“ dürfen wegen der inneren Negation nicht als Ausschluss
   gewertet werden.
10. Deutsche Dauerangaben werden auch in flektierter Form wie „innerhalb
    dreier Jahre“ als strukturierter Wert erkannt.
11. Die B-Formulierungen „Entgang von Mietzinseinnahmen“ und „Entgang an
    Erträgen aus Miet-, Pacht-, Leasingverträgen“ fehlten als fachliche
    Mietverlustvarianten.
12. Das tabellarische Glaslimit „Einzelscheiben bis m²: 10“ wurde weder als
    lokales Limit noch als strukturierter Dimensionswert erkannt.
13. Eine ausdrücklich bepreiste Erstrisikoleistung und die operative Zusage
    „ersetzt der Versicherer“ wurden bei der optischen Wiederherstellung nur
    als Definition statt als eingeschlossene Leistung bewertet. Positive und
    negative Formulierungen werden nun getrennt geprüft.
14. Eine Höchstentschädigung in Form der vertraglichen Versicherungssumme ist
    ein symbolisches Limit. Sie wird jetzt mit ihrer tatsächlichen
    Vertragsbasis erfasst und nicht in eine erfundene Prozentzahl umgerechnet.

## Änderungs- und Prüfnachweis

Kleine Zwischencommits:

- `a7a7cb3`: Produktbasis und Günstigkeitsklausel
- `fdcaf06`: rollenrichtige Komponenten- und Dokumentaggregation
- `86495b9`: Versicherungsumfang und atomisierte Kostenklauseln
- `b58db17`: Feuer, Sturm und Leitungswasser
- `8689a1b`: Glas, Haftpflicht, Ökoschutz und allgemeine Vertragsklauseln
- `23d9b7a`: vollständige Semantik der LF-Referenzzeilen
- `b6ff252`: deterministische Bindung kuratierter Referenzklauseln
- `00a7638`: operative Wiederherstellungsklauseln
- `f3bc691`: Kontexttest für fortgeführte Referenzlisten
- `e7e0c47`: negative Polarität fortgeführter Listen
- `e47467d`: operative Klauseln über PDF-Zeilenumbrüche
- `c0b0de6`: verbleibende Gebäude-, Subsidiaritäts- und Schwellenklauseln
- `1ce62e0`: Mietzinsentgang und tabellarisches Glasflächenlimit
- `16a5021`: eingeschlossene Erstrisikoleistung und symbolische
  Entschädigungsgrenze
- `34217eb`: separater Formatierungscommit ohne Logikänderung

Alle fokussierten Tests dieser Zwischenstände wurden ausschließlich im
isolierten Mac-Studio-Worktree ausgeführt. Am Commit `c0b0de626` wurden alle
35 von 35 A-Referenzzeilen als vollständig belegt materialisiert. Dessen
frischer 1+9-Lauf stimmte bei 31 von 35 gerichteten Entscheidungen mit der
manuellen Sollmatrix überein. Die vier Abweichungen `LF-KO-01`, `LF-LW-04`,
`LF-GL-01` und `LF-AV-01` wurden durch die beiden anschließenden
Korrekturcommits behoben.

## Endlauf und zeilenweise Nachkontrolle

Der frische Endlauf wurde auf dem exakten Logikcommit
`16a502186b4eda0bda6b062b39af948205457270` im isolierten
Mac-Studio-Worktree ausgeführt. `34217eb8163b8bd6362e59d7121b23f58bbef425`
änderte danach ausschließlich die Formatierung derselben Regeldatei. Der
installierte Kundencheckout blieb unverändert auf V3.6.0 beziehungsweise
`2804fa56361084c0ee74fca6f54ef6365d65aeeb`.

```text
Session:                     c10d4c3a-4a0b-404c-b8bf-027b41879979
Run-Signatur:                fdd84a933c8df4aa58090ee8e7dc955d3bfd4d68e3cff7fd8faa01bc1c706b17
Modus:                       LF_IMMO_REFERENCE_A_TO_B_V1
Profil:                      LF_IMMO_REFERENCE_35_V1_CONTROLLED
Dokumente:                   1 A / 9 B
Dokument-/Kategorieschritte: 100 / 100, davon wiederaufgenommen 0
Kategorien / Zeilen:         10 / 35
Pflichtkomponenten:          113
A-Zeilen belegt:             35 / 35
B-only-Zeilen:               0
vollständiges Gegenstück:    16
teilweises Gegenstück:       15
kontrollierter Nullfund:     4
Referenzzeile unklar:        0
Gegenstück unklar:           0
Kundenreview erforderlich:   15
Workerzeit:                  1.205,275 s (20:05,275)
Qwen-Aufrufe:                237
Prompt-/Completiontoken:     519.517 / 15.995
```

Die 35 Laufentscheidungen wurden einzeln gegen die obige manuelle
PDF-Sollmatrix verglichen. Es gab 35 Übereinstimmungen und 0 Abweichungen:

- Vollständiges Gegenstück (16): `LF-PR-01`, `LF-VS-04`, `LF-KO-01`,
  `LF-FE-02`, `LF-ST-01`, `LF-ST-03`, `LF-LW-01`, `LF-LW-03`, `LF-LW-04`,
  `LF-GL-01`, `LF-GL-02`, `LF-HP-01`, `LF-OK-02`, `LF-AV-01`, `LF-AV-02`,
  `LF-AV-03`.
- Teilweises Gegenstück (15): `LF-PR-02`, `LF-VS-01`, `LF-VS-02`,
  `LF-VS-03`, `LF-KO-02`, `LF-KO-03`, `LF-FE-01`, `LF-FE-03`, `LF-ST-02`,
  `LF-LW-02`, `LF-LW-05`, `LF-GL-03`, `LF-HP-02`, `LF-HP-03`, `LF-AV-05`.
- Kontrollierter Nullfund (4): `LF-FE-04`, `LF-ST-04`, `LF-OK-01`,
  `LF-AV-04`.

Die vier zuletzt korrigierten Fälle sind im Ergebnis quellen- und
wertgebunden:

1. `LF-KO-01`: B01 Seiten 1/2/4/9 belegt Mietzinsentgang,
   Miet-/Pacht-/Leasingobjekt und sechs Monate Haftungszeit.
2. `LF-LW-04`: B01 Seiten 13–15 und B02 Seiten 5/13 belegen Außenrohre,
   Armaturen, Verstopfungsbehebung und die operative optische
   Wiederherstellungsleistung.
3. `LF-GL-01`: B01 Seite 5 liefert gemeinsam Gebäudeverglasung und das
   strukturierte Limit „Einzelscheibengröße bis 10 m²“.
4. `LF-AV-01`: B09 Seite 6 liefert Höchstentschädigung,
   Erstrisikosummenregel und das strukturierte symbolische Limit
   „Versicherungssumme, maximiert mit dem Versicherungswert pro
   Schadenereignis“. Das Ergebnis behauptet nicht 150 Prozent für B.

Auf dem finalen Formatierungscommit bestanden auf dem Mac Studio:

```text
ESLint der geänderten Produktionsdateien: PASS
Fokussierte Tests:                        6/6 Suites, 284/284 Tests
Gesamttests:                              156/156 Suites, 2.089/2.089 Tests
35-Zeilen-Sollmatrix:                     35/35, 0 Abweichungen
```

Ergebnishashes:

```text
comparison.private.json  b875f079899885881e836bf475df4d0dc2b20b20ddcce6f7a0868172dce010f0
comparison.md            33da555ba729f54980f0ec208e06707b80922a436ad055d046f4921e62c5b172
polizzenvergleich.xlsx   bd727960c2d5b9d1aec1c0177bc9a412917be2e1ddd9bdfca3b77606aec6e7be
```

Der Laufvertrag enthält `noEmbeddings: true`. Der Referenzrunner ruft weder
eine Embed-Funktion noch einen Embedding-Endpunkt auf. Eine generische
Initialisierungsmeldung für einen `NativeEmbedder` im Prozessbootstrap ist
kein Embedding-Aufruf und wurde nicht für die LF-Suche verwendet.

## Beweisgrenze

Das Ergebnis belegt für genau das versionierte LF-Dokument und genau diese
neun B-Dokumente eine vollständige Übereinstimmung der 35 gerichteten
Entscheidungen mit der manuellen Entwicklerannotation. Es belegt weder die
Vollständigkeit des gesamten LF-Produkts noch unbekannte Versicherer,
beliebige Dokumentvarianten oder das 99-Prozent-Ziel. Die 15 partiellen Zeilen
bleiben fachlich richtige partielle Gegenstücke und dürfen nicht künstlich zu
Volltreffern aufgewertet werden; die vier kontrollierten Nullfunde sind keine
ausdrücklichen Ausschlüsse.
