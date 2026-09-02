# PAV8 – Target-Loop für die 69 Reviewzeilen

Stand: 2. September 2026  
Baseline: `PAV8-03D-VS14-2D964B45-20260902-073000`  
Fachlicher Code: `2d964b45d6bbf8a1ca0769ad25bc3b59d3a7c42b`  
Dokumentierter Arbeitsstand bei Beginn: `c6462b481cb666ee3701a236cbf5fb63e1da5743`

## 1. Ziel und unveränderliche Grenze

Die 69 Reviewzeilen werden einzeln beziehungsweise in nachweislich gleichen
Fehlerfamilien bearbeitet. Während dieses Loops werden nur die ausgewählten
Requirements auf allen zehn bereitgestellten Dokumenten neu ausgeführt. Die
155 bisherigen Nicht-Review-Zeilen bilden die eingefrorene Regressionsbasis.

Ein Fall gilt nur dann als abgeschlossen, wenn mindestens einer dieser
Endzustände mit Quell- und Vertragsbeleg erreicht ist:

1. vollständiger positiver Beleg auf beiden Seiten und typisierte
   Vergleichsentscheidung;
2. vollständiger positiver Beleg auf einer Seite und vollständig
   kontrollierter Nichtfund auf der anderen Seite; die belegte Seite gewinnt;
3. vollständig kontrollierter Nichtfund auf beiden Seiten; gleiche
   dokumentierte Fundlage;
4. typisierte Entscheidung für unterschiedliche Werte, Bedingungen, Scopes,
   Wirkungen, Alternativen oder Dokumentränge;
5. nachgewiesene dokumentbedingte Unentscheidbarkeit, die nicht durch Suche,
   Triage oder Vergleichslogik heilbar ist.

Eine Reviewreduktion ohne positiven, negativen, adversarialen und
Scope-Gegenbeleg gilt nicht als Fix. Ein kontrollierter Nichtfund bedeutet auf
Vergleichsebene "nicht enthalten beziehungsweise nicht geregelt", beweist aber
keinen ausdrücklichen Ausschluss.

## 2. Eingefrorene Ausgangsmetrik

```text
Zeilen: 224
Vorteil A: 2
Vorteil B: 2
Dokumentationsunterschied: 33
Gleichwertig: 110
Kein dokumentierter Vorteil: 0
Nicht vergleichbar: 8
Unklar / Kundenreview: 69
Ohne Kundenreview: 155
```

Die 69 verteilen sich auf:

```text
VS: 19
FE: 14
LW: 10
ST: 13
EL: 13
```

## 3. Exakte, überschneidungsfreie Hauptliste

### R69-A – Paket-Prüfstatus blockiert: 40

Status: `OPEN`

```text
VS-02, VS-15, VS-18, VS-19, VS-21, VS-22, VS-24, VS-25, VS-36
FE-A05, FE-A10, FE-C02, FE-D01, FE-D05, FE-E16, FE-F05
LW-07, LW-08, LW-11, LW-12, LW-18, LW-26, LW-27
ST-15, ST-16, ST-17, ST-18, ST-19, ST-21, ST-25, ST-27
EL-04, EL-05, EL-08, EL-16, EL-17, EL-19, EL-21, EL-27, EL-35
```

Diese 40 sind keine einheitliche Ursache. Die internen Blocker überlappen:

- fehlende Pflichtkomponenten: 24;
- unvollständige Werte oder Felder: 14;
- Deckungswirkung nicht entscheidbar: 13;
- mehrere verschiedene Atome derselben Komponente: 12;
- Scope unvollständig: 8;
- ungelöste Kandidaten: 2;
- ungelöste Dokumentpräzedenz: 1.

### R69-B – Beidseitig fehlender Beleg: 9

Status: `OPEN`

```text
VS-04
FE-B09, FE-B13, FE-F08
LW-25
ST-10, ST-13, ST-14, ST-23
```

Abschluss: dokumentweit kontrollierte Suchfamilie je Komponente; danach
beidseitiger qualifizierter Nichtfund oder tatsächliche Fundstellen.

### R69-C – Einseitig fehlender Beleg: 7

Status: `OPEN`

```text
VS-35
FE-C07, FE-C12
LW-20
EL-06, EL-11, EL-12
```

Abschluss: fundlose Seite vollständig kontrollieren; bei vollständigem
positiven Gegenbeleg wird dessen Seite zum Vorteil.

### R69-D – Vergleichsregel fehlt: 4

Status: `OPEN`

```text
VS-08, VS-10, FE-A01, ST-01
```

Erste Kandidaten: `ST-01`, danach `VS-10`. Beide besitzen bereits
vollständige Atome; bei `ST-01` ist auf beiden Seiten `60 km/h` gebunden.
`VS-08` enthält unterschiedliche konkrete Bedingungen, `FE-A01`
unterschiedliche Definitionswortlaute. Diese beiden dürfen nicht allein aus
gleicher Wirkung gleichgesetzt werden.

### R69-E – Bedingung oder Ausnahme ungeklärt: 4

Status: `OPEN`

```text
VS-20, FE-A07, LW-22, EL-09
```

Abschluss: typisierter Bedingungs-/Ausnahmevertrag mit aktiver Regel,
Voraussetzung, Rückausnahme und Scope.

### R69-F – Atomarer Dokumentrang ungeklärt: 2

Status: `OPEN`

```text
VS-01, VS-07
```

Abschluss: semantische Duplikate, echte Konflikte, Version, Ersetzung und
Geltung getrennt entscheiden. Dokumenttyp allein darf nicht sperren.

### R69-G – Atomare Evidenz unvollständig: 2

Status: `OPEN`

```text
VS-31, VS-33
```

Abschluss: vollständiger Wert-/Limit-/Atomvertrag; kein Teilbeleg darf die
Gesamtanforderung bejahen.

### R69-H – ANY-Alternative unvollständig: 1

Status: `OPEN`

```text
VS-23
```

Abschluss: versionierter `ANY`-Alternativenvertrag, der sichere und bedingte
Alternativen nicht vermischt und keine Komponente still entfernt.

## 4. Komponentenlücken innerhalb R69-A

Die folgenden 24 Zeilen besitzen mindestens eine fehlende Pflichtkomponente:

```text
VS-02, VS-15, VS-18, VS-22, VS-24, VS-25
FE-D05, FE-E16, FE-F05
LW-07, LW-11
ST-15, ST-17, ST-18, ST-19, ST-25
EL-05, EL-08, EL-16, EL-17, EL-19, EL-21, EL-27, EL-35
```

Nur diese sieben besitzen ausschließlich Komponentenlücken und keinen
weiteren technischen Blocker:

```text
VS-15, FE-D05, LW-07, LW-11, ST-25, EL-05, EL-08
```

Die fehlenden Komponenten sind:

- `VS-02`: B `residual_value_threshold`;
- `VS-15`: A/B `named_outbuilding_designation`;
- `VS-18`: A `enclosures`, `gates`; B `fences`, `gates`, `walls`;
- `VS-22`: B `hazardous_waste`, `hazardous_waste_cost_limit`;
- `VS-24`: A/B `scaffolding_cost_limit`;
- `VS-25`: B `authority_reconstruction_extra_cost_limit`;
- `FE-D05`: A/B `without_own_fire`;
- `FE-E16`: B `benefit_reduction_or_release`,
  `obligation_breach_consequences`;
- `FE-F05`: A `coverage_start`;
- `LW-07`: B `sanitary_ceramics`;
- `LW-11`: B `boiler`, `radiator`;
- `ST-15`: B `satellite_system`;
- `ST-17`: B `blind`;
- `ST-18`: B `hail`, `photovoltaic_system`, `storm`;
- `ST-19`: B `photovoltaic_system`, `snow_pressure`;
- `ST-25`: A/B `branch_removal_costs`;
- `EL-05`: B `heavy_rain`, `surface_water`;
- `EL-08`: A/B `sinkhole`, `subsidence`;
- `EL-16`: B `display_case`, `winter_garden`;
- `EL-17`: A `emergency_glazing_cost_limit`;
- `EL-19`: A/B `machinery_breakdown`;
- `EL-21`: A/B `access_system`, `electronics_cover` und kombinierte Deckung;
- `EL-27`: A/B `cellar_compartments`, `common_areas`;
- `EL-35`: A/B `lockout`, `strike`.

## 5. Nicht durch mehr Suchwörter heilbare Mindestmenge

Mindestens 29 Zeilen besitzen keine zeilenweite oder komponentenweite
Fundlücke und dürfen nicht durch zusätzliche Aliasse "gesundgesucht" werden:

```text
VS-01, VS-07, VS-08, VS-10, VS-20, VS-23, VS-31, VS-33
FE-A01, FE-A07
LW-22, EL-09
VS-19, VS-21, VS-36
FE-A05, FE-A10, FE-C02, FE-D01
LW-08, LW-12, LW-18, LW-26, LW-27
ST-16, ST-21, ST-27
EL-04
```

Für diese Zeilen sind typisierte Vergleichs-, Bedingungs-, Scope-, Wert-,
Mehrfachatom-, Kandidaten- oder Rangverträge erforderlich.

## 6. Verbindliche Bearbeitungsreihenfolge

1. QA-only Target-Runner und 155-Zeilen-Regressionsguard;
2. `ST-01` und `VS-10` als kleine vollständige Regelkandidaten;
3. 16 zeilenweite Suchlücken;
4. sieben reine Komponentenlücken;
5. 14 Wert-/Feldbindungsfälle;
6. Wirkungs- und Scopeklassifikation;
7. Mehrfachatome und Dokumentrang;
8. Bedingungen, `ANY`, Kosten und Limits;
9. einmaliger frischer 10-Dokument-/224-Zeilen-Vollrun;
10. unabhängiger Zeilen-, Quellen-, Review-, Signatur- und Favoritenaudit.

## 7. Target-Run-Vertrag

Ein Target-Run muss unveränderlich binden:

- PAV8-03D-Vergleichshash und Run-Signatur;
- alle zehn Dokument-SHAs, Seiten, Rollen, Stati und Paketpositionen;
- Commit, Node, Qwen-Modell und Kontext;
- produktives Profil und kanonische Kataloghashes;
- sortierte Ziel-IDs und eigenen Selection-Digest.

Die Zielauswahl darf die kanonische `catalogId`, Requirement-Objekte,
SearchPlan IDs oder Requirement-Digests nicht verändern. Ein Target-Resultat
ist `TARGETED_QA_ONLY`, nicht publish- oder deployfähig.

## 8. Regressionsguard für die 155

Nach jedem Verhaltenscommit:

1. Katalogdiff außerhalb der Ziel-IDs muss leer sein;
2. die 50 gespeicherten Dokument-mal-Kategorie-Worksheets werden ohne LLM neu
   aufgebaut und für Nichtziele semantisch verglichen;
3. Single-Target-Payload-Hashes außerhalb der Zielmenge müssen identisch
   bleiben; andernfalls wird die Zielmenge erweitert oder der Commit
   verworfen;
4. alte Modellantworten dürfen nur bei identischem Payload-, Prompt-, Modell-
   und Phasenvertrag erneut validiert werden;
5. das 224-Zeilen-Overlay darf außerhalb der Ziel-Allowlist weder Paketdaten,
   Atome, Outcome, Regel, Reviewflag noch Kundentext ändern;
6. positive, negative, adversariale, Scope- sowie LF-/WEVIG-Regressionen
   müssen auf dem Mac Studio bestehen.

## 9. Fortschrittsprotokoll

| Inkrement               | Commit     | Ziel-IDs      | Vorher    | Nachher   | 155-Guard     | Mac Studio                                | Entscheidung |
| ----------------------- | ---------- | ------------- | --------- | --------- | ------------- | ----------------------------------------- | ------------ |
| Target Selection V1     | `bba9670d` | Infrastruktur | 69 Review | 69 Review | nicht berührt | 203/203 direkt und angrenzend             | `PASS`       |
| Target Manifest V1      | `e15dc228` | Infrastruktur | 69 Review | 69 Review | nicht berührt | 218/218 plus reale PAV8-Bindung           | `PASS`       |
| Trusted Manifest CLI V2 | `b5a21570` | Infrastruktur | 69 Review | 69 Review | nicht berührt | 227/227 plus reale Create-/Resume-Prüfung | `PASS`       |
| Phase Digest Gate       | `3663b850` | Infrastruktur | 69 Review | 69 Review | nicht berührt | 80/80 direkte Phasenprüfungen             | `PASS`       |

Kein Deployment während dieses Loops. Der installierte Kundencheckout bleibt
bis zu einer ausdrücklichen Freigabe unverändert.

### 9.1 Target Selection V1 – Ergebnis

Der bisherige `--requirementIds`-Pfad war kein zulässiger Target-Runner, weil
er `:subset:<ids>` an die fachliche `catalogId` angehängt und damit
Requirement-/Zertifizierungsidentitäten verändert hat. Commit `bba9670d`
trennt nun fachlichen Vertrag und QA-Auswahl:

- kanonische `catalogId`, Katalogreihenfolge und vollständige
  Requirement-Objekte bleiben erhalten;
- ein versionierter Selection-Digest bindet Kategorie, Ziel-IDs und die
  kanonischen `requirementSearchContractDigest`-Werte;
- Triage und Prepared Evidence können den extern erwarteten Selection-Digest
  verlangen und lehnen fehlende oder manipulierte Provenienz fail-closed ab;
- leere, unbekannte, doppelte oder kategoriefremde IDs werden abgelehnt;
- reale `VS-16`-/`VS-21`-/`VS-23`-Verträge beweisen `ANY`-, Binding-Group-,
  Candidate- und Requirement-Digest-Parität zum Full-Worksheet;
- ein synthetischer zertifizierter Schema-2-Vertrag beweist, dass nur die
  kanonische Katalog-ID akzeptiert wird.

Mac-Studio-Prüfung im isolierten Checkout
`/private/tmp/pv3-pav8-03b-dca1dfb5-7sIPQu/repo`:

```text
Commit: bba9670d5f314df50f4ffb43c710d2cb9818b0fe
Node: 22.23.2
Modellaufrufe: keine
Prettier: 6/6 PASS
Direkte Vertragsprüfungen: 88/88 PASS
Angrenzende Worksheet-/Materializer-Prüfungen: 115/115 PASS
Breite Policy-Analysis-Suite: 574/575 PASS
```

Der einzige breite Fehler (`ST-11`-ScopeLead-Erwartung) wurde auf dem
unveränderten Favoriten-Commit `2d964b45` identisch reproduziert. Er ist damit
kein Regressionssignal von Target Selection V1 und wird getrennt als
vorhandener Test-/Vertragsbefund behandelt.

Noch nicht bewiesen sind Target-Paketmaterialisierung, die vollständige
10-Dokument-Matrix, das 224-Zeilen-Overlay und der 155-Zeilen-Guard. Diese
Grenzen bilden das nächste kleine Inkrement. Der installierte Kundencheckout
blieb sauber und unverändert auf `c7d3b16d`.

### 9.2 Target Manifest V1 – Ergebnis

Commit `e15dc228b82692a9befd7ed57f4a352eea26248f` führt einen privaten,
nicht publizierbaren Manifestvertrag für genau den PAV8-03D-Target-Lauf ein.
Der Builder akzeptiert Paketvertrag, Baseline-Vergleich, Registry und Kataloge
nur als Rohbytes. Paket und Vergleich werden vor dem JSON-Parsing gehasht und
gegen die Registry gebunden.

Der Vertrag erzwingt:

- den Baseline-Commit `2d964b45`, die Run-Signatur sowie Paket- und
  Vergleichshash;
- genau zehn Dokumente in der Matrix `A:0` und `B:0..8`, einschließlich
  Rollen, Stati, Namen, Dokument-SHAs und `primaryManifestSha256`;
- das Produktprofil mit 224 Zeilen sowie exakt 69 Review- und 155
  Nicht-Review-Zeilen;
- dieselben 69 Zeilen in Reviewmenge und Ergebnis `UNKLAR`;
- die Registry-Verteilung `VS 19 / FE 14 / LW 10 / ST 13 / EL 13`;
- die Rohbyte-SHAs aller fünf kanonischen Kataloge und daraus intern neu
  erzeugte Target-Selections;
- neuen Commit, Modell, Kontext, Node-Version und Prompt-SHA je Kategorie;
- `TARGETED_QA_ONLY`, keine Produktmutation und keinen Full-Materializer.

Mac-Studio-Prüfung im isolierten Checkout
`/private/tmp/pv3-pav8-03b-dca1dfb5-7sIPQu/repo`:

```text
Commit: e15dc228b82692a9befd7ed57f4a352eea26248f
Node: 22.23.2
Prettier: 3/3 PASS
Direkte Manifest-/Selection-/Registry-Prüfungen: 27/27 PASS
Full-Materializer-/Worker-Grenzen: 18/18 PASS
Worksheet-/Triage-/Evidence-/Katalog-Prüfungen: 173/173 PASS
Gesamt in diesem Inkrement: 218/218 PASS
Realer PAV8-Manifestaufbau: PASS
Manifest-Digest der Strukturprüfung: 14909319b0ef2b8a33ad7c60f03175c853f0ab93492f873d370b6e4c82aa8e5e
Modell-/Embedding-Aufrufe: keine
```

Die reale Gegenprobe bestätigte `A:1/B:9`, die Zielverteilung
`19/14/10/13/13` und die drei erwarteten Baseline-Hashes. Der Digest dieser
Strukturprüfung enthält absichtlich synthetische gültige Prompt-SHAs; der
nächste Runner-Einstieg muss die echten Promptdateien selbst hashen und darf
diesen Struktur-Digest deshalb nicht als Laufmanifest wiederverwenden.

Noch offen ist der feste CLI-Trust-Anchor: Der nächste kleine Commit muss die
Registry ausschließlich vom versionierten Repositorypfad laden, deren
erwarteten SHA
`1499605578113e9d287ea83861dc567694046c7482ce380fe23d92ee075bad1e`
prüfen, reale Prompt-SHAs und Runtimewerte selbst bestimmen und den erzeugten
Manifest-Digest beim Materialisieren verpflichtend als externe Erwartung
weiterreichen. Erst danach beginnt die Target-Artefaktmaterialisierung.

### 9.3 Trusted Manifest CLI V2 – Ergebnis

Commit `b5a2157046a4b1171af80152664d7d821072d6b3` schließt den offenen
Trust-Anchor und erhöht den inkompatibel erweiterten Manifestvertrag
ordnungsgemäß auf Schema 2 / `TARGETED_QA_MANIFEST_V2`.

Die produktive QA-CLI akzeptiert ausschließlich:

```text
--baselineRoot --output --model --modelTokenLimit
```

Repository, Registry, fünf Kataloge, alle Kategorie-/Triage-/Effects-Prompts,
der deaktivierte Hybrid-Addon-Prompt und der Manifestname sind fest
vorgegeben. Der Registry-Rohbytehash wird gegen
`1499605578113e9d287ea83861dc567694046c7482ce380fe23d92ee075bad1e`
geprüft. Der reale Commit und Node werden von der CLI selbst ermittelt.

Zwei unabhängige Reviews führten vor der Freigabe zu zusätzlichen Gates:

- physische statt nur lexikalische Pfadprüfung; Symlink-Umleitungen in
  Repository oder Baseline werden abgelehnt;
- atomare No-Clobber-Veröffentlichung per privater Tempdatei, Hard Link,
  Datei- und Verzeichnis-`fsync`;
- bereits vorhandene leere, fremde, korrupte oder zusätzliche Ausgaben
  werden nicht übernommen;
- ein identischer Resume validiert alle Quellen erneut und schreibt das
  Manifest nicht neu;
- `hybridShadowEnabled` ist fest `false`; eine spätere Aktivierung benötigt
  eine neue Manifestidentität.

Mac-Studio-Nachweis:

```text
Commit: b5a2157046a4b1171af80152664d7d821072d6b3
Prettier: 4/4 PASS
Direkte CLI-/Manifest-/Selection-/Registry-Prüfungen: 36/36 PASS
Angrenzende Materializer-/Worker-/Worksheet-/Triage-/Evidence-Prüfungen: 191/191 PASS
Gesamt: 227/227 PASS
Reale Erstanlage: PASS
Identischer realer Resume ohne Rewrite: PASS
Dokumentmatrix: A:0 + B:0..8
Targetverteilung: 19/14/10/13/13
Manifestdatei SHA-256: d88d1fc077460fc9f4c4adc22044c05e9b8150ae1831f36822fd95da55ff905d
Interner Manifest-Digest: 9da51e813953f456e958ed501d6ec6bf546ea4f1b86a7f05bb8e5ea8a9d77f75
Ausgabe: /private/tmp/pav8-targeted-qa-manifest-b5a21570
Rechte: Verzeichnis 0700, Manifest 0600
Modell-/Embedding-Aufrufe: keine
```

Der installierte Kundencheckout blieb sauber und unverändert auf
`c7d3b16d400ea4d65b558ef091781da5df82d610`. Als nächste Boundary muss der
Target-Materializer den internen Manifest-Digest sowie die komplette
Execution-/Promptidentität erneut als externe Erwartung verlangen.

### 9.4 Phase Digest Gate – Ergebnis

Commit `3663b850fc7067e65612276b8be486ed13bfb61b` reicht den extern erwarteten
Target-Selection-Digest verpflichtend durch Candidate Triage und Prepared
Evidence. Ein Target-Worksheet ohne externen Digest sowie ein Full-Worksheet
mit Target-Digest werden vor der Modellinstanz fail-closed abgelehnt.

Beide Phasenreports speichern den erwarteten und den tatsächlich im Worksheet
beobachteten Digest. Der unveränderte Full-Pfad bleibt ohne Marker und Digest
kompatibel.

```text
Mac Studio Commit: 3663b850fc7067e65612276b8be486ed13bfb61b
Prettier: 3/3 PASS
Direkte Selection-/Triage-/Evidence-/CLI-Prüfungen: 80/80 PASS
Modell-/Embedding-Aufrufe: keine
```

Der noch fehlende Target-Materializer muss beide Reportfelder gegen den
Manifest-Selection-Digest prüfen; ein intern nur selbstkonsistenter Report ist
nicht ausreichend.

### 9.5 Target-Input-Grenze und Manifest V3

Die Commits `07a81b0d`, `fce036ed`, `122ba6d4`, `5aee6ff9` und `b5792a4e`
schließen die Provenienzkette vor der eigentlichen Target-Materialisierung:

- Triage und Effects persistieren Modell-ID und deklariertes Kontextlimit;
- beide Phasen persistieren zusätzlich den tatsächlich laufenden Release und
  die Node-Version;
- Kategorie-, Triage- und Effects-Prompt werden als echte Rohbytes gegen das
  Manifest geprüft; bei deaktiviertem Hybridlauf muss der Hybrid-Prompthash im
  Triage-Report `null` sein;
- Worksheet, Triage, Effects und Selected Sources sind durch exakte
  Rohbytehashes miteinander verbunden;
- der Consumer baut das Target-Worksheet aus Dokumentartefakt, Katalog und den
  69 kanonischen Anforderungen neu auf und verlangt semantische Parität;
- Manifest Schema 3 / `TARGETED_QA_MANIFEST_V3` verankert für jede UUID den
  exakten Rohbytehash von `document.private.json`;
- die CLI akzeptiert am PAV8-Baselinepfad ausschließlich die zehn erwarteten
  Verzeichnisse `DOC-01-<uuid>` bis `DOC-10-<uuid>` in Paketreihenfolge und
  lehnt fehlende, zusätzliche, falsch nummerierte oder symlink-basierte
  Artefakte ab;
- UUID, Seite, Position, PDF-SHA und Artefakt-SHA müssen gemeinsam passen. Zwei
  identische PDF-Uploads bleiben dadurch über ihre UUID unterscheidbar.

Mac-Studio-Nachweis im isolierten Checkout:

```text
Commit: b5792a4ef20fb1bc1432876a7df07e0c377a7270
Node: 22.23.2
Prettier: PASS
Fokussierte Manifest-/CLI-/Materializer-/Selection-Prüfungen: 50/50 PASS
Reale V3-Erstanlage: PASS
Identischer realer Resume ohne Rewrite: PASS
Dokumente mit Artefakthash: 10/10
Targets: 69
Manifestdatei SHA-256: 4978df6e49f006633822cc808bd6c819b36660f0291f3f54ca95d134d228e52e
Interner Manifest-Digest: 842243b889c71f167b7d0b6a0b557712aac2b6cf733a6b625f192e12b0ede887
Ausgabe: /private/tmp/pav8-targeted-qa-manifest-v3-b5792a4e
Dateirechte: 0600
Modell-/Embedding-Aufrufe: keine
```

Beweisgrenze: Schema 3 friert die exakten Artefaktbytes ab dem Zeitpunkt der
Manifest-Erzeugung ein. Es kann nicht rückwirkend kryptografisch beweisen,
dass ein lokaler Akteur die historische Run-Ablage davor nie verändert hat.
Für den nächsten Schritt muss der Runner zusätzlich die aktuellen Artefakte
gegen die vorhandenen Baseline-Worksheets neu aufbauen; erst danach dürfen die
69 neuen Target-Artefakte erzeugt werden.

### 9.6 Baseline-Neubau und Target-Worksheet-Paket

Die Commits `ece288a6`, `4ca4aa86`, `7ae4233c`, `65c12278` und `07fbfb51`
schließen die Lücke zwischen eingefrorenem Dokumentartefakt und neuem
Target-Worksheet:

- jeder historische `manifest.private.json`-Rohbytehash muss dem gebundenen
  Paketvertrag entsprechen; Release, PDF-SHA und Dokumentstatus werden erneut
  geprüft;
- alle 50 historischen Dokument/Kategorie-Worksheets werden aus den
  verankerten Dokumentbytes und aktuellen Katalogbytes vollständig neu gebaut
  und semantisch mit der Baseline verglichen;
- erst nach dieser 50/50-Parität werden ausschließlich die 69 registrierten
  Anforderungen projiziert;
- Candidate-Ownership, physische Seite, Offsets, exakter Text und Kontext
  werden für jede selektierte Quelle aus dem Dokumentartefakt rekonstruiert;
- das vorbereitete Paket enthält genau 10 Dokumente × 5 Kategorien, private
  0600-Dateien und einen 0700-Ausgaberoot; fremde oder abweichende Resume-Daten
  werden abgelehnt.

Reale Mac-Studio-Gegenprobe vor dem Modelllauf:

```text
Historische Worksheet-Neubauten: 50/50 semantisch identisch
Full-Requirement-Zahlen: VS=36, FE=80, LW=36, ST=36, EL=36
Target-Paare: 50
Target-Instanzen: 690 (= 69 Anforderungen × 10 Dokumente)
Candidate-belegte Komponenten: 283
Komponenten ohne Kandidat: 1027
Candidate-Vorkommen: 663
Prepared-Dateien: 101
Modell-/Embedding-Aufrufe: keine
```

Der Befund ist wichtig für spätere Diagnosen: Eine Zielzeile kann in einzelnen
Dokumenten mehrere Komponenten und Kandidaten besitzen. `69` ist daher die
Zahl der Vergleichszeilen, nicht die Zahl der Modellentscheidungen.

### 9.7 Private Ergebnismaterialisierung und 50-Paar-Runner

Die Commits `30e1eda9`, `9108fd6c`, `7e651202` und `63942e0d` führen den
QA-only Ausführungspfad bis zum privaten Ergebnis fort:

- der Result-Contract baut Triage, Evidence, Selected Sources,
  Requested Fields und Tabellenzeilen aus ihren gebundenen Rohbytes neu auf;
- pro Dokument/Kategorie werden ausschließlich
  `rows.private.json`, `requested-fields.private.json`, `answer.private.md`
  und `report.private.json` ausgegeben;
- der erlaubte interne Zielpfad ist exakt
  `DOC-<nn>-<uuid>/<Kategorie>/result`; Triage und Effects können nicht als
  Result-Ziel überschrieben werden;
- der All-50-Runner führt fest `10 × (VS, FE, LW, ST, EL)` sequenziell aus,
  hält dabei die bestehende globale Modellsperre und verwendet ein bereits
  geladenes Qwen-Modell ohne Modellwechsel;
- ein geladener Embedder, ein zweites geladenes Modell, falsches Modell oder
  falsches Kontextlimit führen vor dem ersten Modellaufruf zum Abbruch;
- Hybrid-Prompt und Hybrid-Suche werden nicht übergeben;
  `allowUniqueCandidateIdRepair` ist fest `false`;
- Triage, Effects und Result werden nur bei übereinstimmenden Release-, Node-,
  Modell-, Prompt-, Worksheet-, Selection- und Artefakthashes fortgesetzt;
- Lauf und Resultate sind ausdrücklich `TARGETED_QA_ONLY`, nicht
  veröffentlichbar und nicht deploybar.

Mac-Studio-Nachweis für den Runner-Commit:

```text
Commit: 63942e0d723e9d57bc34d537b9273eba27094945
Prettier: PASS
Fokussierte und angrenzende Suites: 32/32 PASS
Geladener Modellzustand vor Realrun:
  qwen/qwen3.6-35b-a3b, LLM, Kontext 42496
Geladene Embeddingmodelle: 0
NO DEPLOY: installierter Kundencheckout unverändert
```

Noch nicht bewiesen sind die tatsächlichen 50 Modellphasen dieses finalen
Commits, der 69-Zeilen-Vorher/Nachher-Vergleich, das 224-Zeilen-Overlay und der
155-Zeilen-Nicht-Review-Guard. Diese Nachweise folgen in dieser Reihenfolge.

### 9.8 Erster All-50-Versuch: kontrollierter Replay-Abbruch

Der erste reale Modellversuch am Commit `8f5661dc` wurde nach 9 vollständig
materialisierten Paaren beim zehnten Paar `Dokument 2 / EL` fail-closed
gestoppt:

```text
Pfad: /private/tmp/pav8-final-8f5661dc-ld66Er
Vollständige Paare: Dokument 1 = VS/FE/LW/ST/EL; Dokument 2 = VS/FE/LW/ST
Abbruch: TARGETED_RESULT_MODEL_JUDGEMENT_MISMATCH
Betroffen: prepared-target:EL-04:flood und :inundation
```

Die Rohartefakte zeigten keinen fachlichen Modellfehler. Beide Komponenten
hatten eine serverseitig normalisierte Entscheidung:

```text
Rohwirkung des Modells: DEFINED
Persistierte Wirkung nach Serverregel: INCLUDED
Decision Owner: MODEL_SELECTION_SERVER_EFFECT_RULE
Persistierte Auswahl: jeweils 2 Kandidaten
Fehlerhaftes Replay: behandelte INCLUDED erneut als Modellrohwert und
                    erweiterte dadurch auf jeweils 4 Kandidaten
```

Commit `b0a1a9d3` korrigiert ausschließlich die Kontrollwiedergabe. Bei diesem
expliziten Decision Owner wird für die Replay-Validierung der belegte Rohwert
`DEFINED` rekonstruiert; danach muss dieselbe Servernormalisierung wieder exakt
die persistierte Semantik erzeugen. Andere Decision Owner bleiben unverändert.
Der Fehlercode enthält künftig zusätzlich die konkrete Target-ID.

```text
Commit: b0a1a9d38995d3646b623cd94720150eb37dbcf8
Mac Studio: Prettier PASS
Target-Result, Prepared-Evidence, Einzel-CLI und All-50-Runner: 38/38 PASS
Adversarial: DEFINED->INCLUDED plus zusätzlicher Narrow-Scope-Kandidat PASS
Produktsemantik geändert: nein
Kundenergebnis geändert: nein
```

Wegen der Release-Bindung dürfen die neun Ergebnisse des abgebrochenen Laufs
nicht unter dem neuen Commit fortgesetzt werden. Der nächste Lauf erhält ein
neues Manifest, neue Worksheets und einen neuen Ausgabepfad.
