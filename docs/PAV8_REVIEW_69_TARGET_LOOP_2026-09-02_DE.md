# PAV8 – Target-Loop für die 69 Reviewzeilen

Stand: 3. September 2026
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

Status: `10/40 TARGET-E2E ACCEPTED`. `VS-15`, `VS-18`, `VS-21`, `VS-22`,
`VS-24`, `VS-25`, `FE-A10`, `LW-07`, `LW-12` und `ST-27` sind abgeschlossen; 30 Fälle der
ursprünglichen Familie bleiben offen.

```text
VS-02, VS-15, VS-18, VS-19, VS-21, VS-22, VS-24, VS-25, VS-36
FE-A05, FE-A10, FE-C02, FE-D01, FE-D05, FE-E16, FE-F05
LW-07, LW-08, LW-11, LW-12, LW-18, LW-26, LW-27
ST-15, ST-16, ST-17, ST-18, ST-19, ST-21, ST-25, ST-27
EL-04, EL-05, EL-08, EL-16, EL-17, EL-19, EL-21, EL-27, EL-35
```

Die Liste bleibt als unverändertes Ausgangsinventar erhalten. `VS-15`,
`VS-18`, `VS-21`, `VS-22`, `VS-24`, `VS-25`, `FE-A10`, `LW-07`, `LW-12` und `ST-27`
gehören nach den in Abschnitt 10.19, 10.27, 10.28, 10.29, 10.30, 10.25,
10.31, 10.24, 10.21 beziehungsweise 10.23 dokumentierten Zielnachweisen nicht mehr
zur operativen Restliste.

Diese 40 sind keine einheitliche Ursache. Die internen Blocker überlappen:

- fehlende Pflichtkomponenten: 24;
- unvollständige Werte oder Felder: 14;
- Deckungswirkung nicht entscheidbar: 13;
- mehrere verschiedene Atome derselben Komponente: 12;
- Scope unvollständig: 8;
- ungelöste Kandidaten: 2;
- ungelöste Dokumentpräzedenz: 1.

### R69-B – Beidseitig fehlender Beleg: 9

Status: `2/9 ACCEPTED`, `1/9 RECALL-KANDIDAT`,
`1/9 PIPELINE-KANDIDAT`; `FE-B13` und `ST-14` sind abgeschlossen. `ST-13`
hat den isolierten Recall-Audit bestanden. `LW-25` hat Recall, A-Scope,
B-Wirkung und den gerichteten Vergleichsvertrag bestanden. Beide Kandidaten
benötigen noch die Bestätigung im späteren konsistenten Vollvergleich. Fünf
Fälle bleiben ohne bestandenen Kandidaten offen.

```text
VS-04
FE-B09, FE-B13, FE-F08
LW-25
ST-10, ST-13, ST-14, ST-23
```

Abschluss: dokumentweit kontrollierte Suchfamilie je Komponente; danach
beidseitiger qualifizierter Nichtfund oder tatsächliche Fundstellen.

### R69-C – Einseitig fehlender Beleg: 7

Status: `5/7 TARGET-E2E ACCEPTED`, `2/7 PIPELINE-KANDIDATEN`. `FE-C07` ist im
echten gezielten Ergebnisweg als `VORTEIL_B`, `EL-11` als
`NICHT_VERGLEICHBAR`, `FE-C12` als `GLEICHWERTIG` und `LW-20` nach Schritt B2
als `GLEICHWERTIG` ohne Review entschieden. `VS-35` ist nach vollständiger
beidseitiger Achsenbindung als `NICHT_VERGLEICHBAR` ohne Review entschieden:
B besitzt den weiteren Wiederherstellungsort, zugleich unterscheiden sich die
Vorzustands- und Nichterfüllungsbedingungen. `EL-06` und `EL-12` haben
jeweils den gebundenen Zehn-Dokument-Pipeline-Probe bestanden, benötigen aber
noch die Bestätigung im späteren konsistenten Vollvergleich.

```text
VS-35
FE-C07, FE-C12
LW-20
EL-06, EL-11, EL-12
```

Abschluss: fundlose Seite vollständig kontrollieren; bei vollständigem
positiven Gegenbeleg wird dessen Seite zum Vorteil.

### R69-D – Vergleichsregel fehlt: 4

Status: `4/4 TARGET-E2E ACCEPTED`. `FE-A01` ist im echten
Zehn-Dokument-Zielweg als `VORTEIL_B` ohne Review entschieden. `VS-08` ist
nach vervollständigtem Recall und paketweitem Bedingungskonsens als
`GLEICHWERTIG` ohne Review entschieden.

```text
VS-08, VS-10, FE-A01, ST-01
```

`ST-01` und `VS-10` besitzen vollständige Atome; bei `ST-01` ist auf beiden
Seiten `60 km/h` gebunden. Für `VS-08` ist die geprüfte Dimension ausschließlich
`bedingt oder unbedingt`. Die unterschiedlichen konkreten Voraussetzungen
bleiben in `VS-09` erhalten und werden durch die VS-08-Gleichheit nicht
gleichgesetzt.

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

### 9.9 Vollständiger gebundener All-50-Lauf

Der neu angelegte Lauf am Release `422a4662` schloss alle 50
Dokument/Kategorie-Paare ohne technischen Abbruch ab. Er verwendete exakt das
bereits geladene Modell `qwen/qwen3.6-35b-a3b` mit Kontext `42496`; ein in LM
Studio geladenes Embeddingmodell war nicht vorhanden und der Hybridpfad blieb
deaktiviert.

```text
Release: 422a4662759e11f70ea6a085f60feddd7f415d66
Manifest-Digest: d0a140a3c9b076a9c0dbcf511b05d97b615985e348c35387e80fc99fc241d593
Manifestdatei: /private/tmp/pav8-final-422a4662-4SjFOO/manifest/targeted-qa-manifest.private.json
Run: /private/tmp/pav8-final-422a4662-4SjFOO/run
Run-Summary SHA-256: fe49a998ed6c876610ead2d4445ed54dcf50a8720da01f382166dcb4e18c3b2e
Paare: 50/50
Resume-Paare: 0
Wandzeit: 1.167.263 ms (ca. 19 min 27 s)
Modellaufrufe/-versuche: 236/236
Prompt-Tokens: 522.079
Completion-Tokens: 14.751
Gesamt-Tokens: 536.830
Modellzeit: 1.110,992 s
```

Der exakte Vergleich der 690 gezielten Dokument-Zeilen-Instanzen mit der
Baseline ergab noch keine fachliche Veränderung:

```text
Geändert: 0/690
Unverändert: 690/690
BELEGT: 74 -> 74
TEILBELEGT: 79 -> 79
UNGEKLÄRT: 537 -> 537
VS/FE/LW/ST/EL geändert: 0/190, 0/140, 0/100, 0/130, 0/130
```

Das ist kein Qualitätsgewinn, sondern der notwendige Reproduzierbarkeitsbeleg:
Der gezielte Ausführungspfad verändert das Ergebnis ohne fachlichen Fix nicht.

### 9.10 Privates 224-Zeilen-Overlay und zweistufiger 155-Guard

Die Commits `33836154`, `f4e87200` und `1ed9db0d` führen die 69 gezielten
Ergebnisse wieder in eine vollständige, ausschließlich private QA-Analyse
zurück. Vor dem Merge werden Dokument, Katalog, vollständiger
Target-Selection-Vertrag, Candidate-Partition, Target-/Judgement-Ownership,
Triage-, Evidence-, Rows- und Requested-Fields-Hashes erneut gebunden.

Der Guard arbeitet auf zwei Ebenen:

1. In jedem der 50 Dokument/Kategorie-Paare müssen alle nicht gezielten Rows,
   Worksheet-Requirements, Binding Groups, Judgements, Rollups, Targets und
   Requested Fields exakt der Baseline entsprechen.
2. Nach dem echten `buildComparisonResult` müssen zusätzlich alle 155 finalen
   Nicht-Review-Vergleichszeilen exakt der gebundenen Baseline entsprechen.

Der Orchestrator schreibt keine Markdown- oder XLSX-Kundenausgabe. Er erzeugt
nur einen privaten Minimal-Overlay-Root mit `comparison.private.json` und
`overlay-guard.private.json`.

```text
Overlay-Release: 1ed9db0de19cae289f63a49adf16159e5ad450b8
Mac-Studio-Suites: 34/34 PASS
Realer Overlay-Root: /private/tmp/pav8-overlay-1ed9db0d-BPDR0X/overlay
Paare: 50/50
Target-Zeilen: 69
Nicht-Target-Zeilen: 155
Target-Dokumentinstanzen: 690
Nicht-Target-Dokumentinstanzen: 1.550/1.550 identisch
Finale Nicht-Target-Vergleichszeilen: 155/155 identisch
Geänderte Nicht-Target-Zeilen: 0
Geänderte Target-Zeilen: 0/69
Comparison SHA-256: a57fddfa487136eeda0e8b29c09c5ae9462ff699ed0b938f1c2543d0ee1d9b35
Guard SHA-256: f02bce23588f2fa44750ff883747a4234b970dca72bf4d2c8da3b725be2cabd9
```

Die Vergleichszahlen bleiben deshalb bewusst unverändert:

```text
VORTEIL_A 2, VORTEIL_B 2, DOKUMENTATIONSUNTERSCHIED 33,
GLEICHWERTIG 110, NICHT_VERGLEICHBAR 8, UNKLAR 69.
```

Ab jetzt darf jeder fachliche Kandidat nur über dieses Overlay bewertet
werden. Jede Abweichung in einer der 155 geschützten Zeilen ist ein harter
Abbruch; ein vollständiger 224-Zeilen-Kundenlauf erfolgt erst nach Abschluss
aller gezielten Fehlerfamilien.

## 10. Fachliche Kandidaten

### 10.1 ST-01 – Sturmdefinition nach Windgeschwindigkeit

Ursache: Beide Pakete enthielten einen vollständigen, konfliktfreien und
quellengebundenen Definitionsfakt mit demselben Schwellenwert `60 km/h`. Die
Entscheidungslogik kannte aber nur Gleichheit von Einschluss/Ausschluss sowie
typisierte Geld-/Prozentwerte. Ein `DEFINITION`-Fakt mit `TEXT`-Feld fiel daher
trotz inhaltlicher Gleichheit in `NO_APPROVED_RULE_FOR_ALL_DIMENSIONS`.

Eine generische Definitionstext-Gleichheit wurde bewusst nicht freigegeben:
Der alte Feldwert allein unterscheidet weder `mehr als 60 km/h` von
`mindestens 60 km/h` noch Spitzenwind von Mittelwind. Commit `e7fad32f`
führt deshalb den engen Vertrag
`STORM_DEFINITION_THRESHOLD_EQUALITY_V1` ein. Er verlangt:

- exakt `ST-01 / storm_wind_speed_definition / DEFINITION`;
- beidseitig `DEFINED` und vollständig quellengebunden;
- genau ein gefundenes Feld `threshold` im Format km/h;
- Spitzenwind als Messbasis und den Operator `GT` (`mehr als`, `über`, `>`);
- identischen Schwellenwert;
- keine Bedingung, Optionalität, Negation oder abweichenden Feldscope.

Andere Werte, Operatoren, Einheiten oder Messbasen bleiben fail-closed. Der
Mac-Studio-Test enthält positive unterschiedliche Wortlaute sowie
adversariale Kontrollen für `75 km/h`, `mindestens`, `m/s`, Mittelwind und
bedingte Definitionen.

```text
Commit: e7fad32f45bd0629ba2076bd5ee88303a50328be
Mac-Studio-Suites: 77/77 PASS
Overlay: /private/tmp/pav8-overlay-st01-e7fad32f-1cLJjx/overlay
Geänderte Target-Zeilen: exakt 1/69 = ST:ST-01
ST-01: UNKLAR -> GLEICHWERTIG
Nicht-Target-Dokumentinstanzen: 1.550/1.550 identisch
Finale Nicht-Target-Zeilen: 155/155 identisch
Geänderte Nicht-Target-Zeilen: 0
Comparison SHA-256: e45c8149fca68f2e258d8cb7d200cbc9c819de072315f3bd1ff3918c03075e99
Guard SHA-256: 47c5fa8409c733f32bcdb6b3d2c5e59d5f44ef15ea4319612f40b2e2b07284d3
```

Metrikänderung:

```text
GLEICHWERTIG: 110 -> 111
UNKLAR: 69 -> 68
Alle anderen Point-Decision-Zahlen unverändert.
```

Bewertung: Kandidat angenommen. Er korrigiert genau die beabsichtigte Zeile
und verändert keinen der 155 geschützten Vergleichspunkte.

### 10.2 VS-10 – Vorhandensein der automatischen Indexanpassung

Ursache: Beide Pakete enthielten bereits einen vollständigen,
konfliktfreien und quellengebundenen Fakt für
`automatic_index_adjustment`. Paket A regelt die Aufwertung der
Gebäudeversicherungssummen nach dem Baukostenindex; Paket B regelt die
jährliche Erhöhung oder Verminderung der Versicherungssumme nach dem
Baukostenindex. Beide Atome waren `INCLUDED`, `GENERAL`, `PACKAGE_MEMBER`
und feldlos. Die Vergleichslogik besaß aber keine freigegebene Regel für die
Rolle `CONDITION` und fiel deshalb in
`NO_APPROVED_RULE_FOR_ALL_DIMENSIONS`.

Die fachliche Aussage ist absichtlich eng: Gleichwertig ist nur das
**Vorhandensein einer aktiven automatischen Indexanpassung der
Versicherungssumme**. Die Regel behauptet ausdrücklich nicht, dass Indexart,
Rhythmus, Beginn, Richtung oder Berechnung identisch sind. Indexart und
Aussetzung besitzen getrennte Katalogzeilen (`VS-11`, `VS-12`).

Vor der Vergleichsfreigabe wurden zwei Erkennungslücken getrennt gehärtet:

- Commit `377b2df0` verwirft negierte, aufgehobene, ausgesetzte, optionale,
  antrags-, zustimmungs- oder mehrprämienabhängige Mechanismen;
- Commit `ef4c4c65` verwirft zusätzlich nachgestellte Negationen wie
  „erhöht oder vermindert sich jährlich nicht“.

Beide Sicherheitscommits wurden auf dem Mac Studio gegen die deterministische
Kandidatenbindung und den Prepared-Evidence-Vertrag geprüft. Der zweite Stand
bestand 65/65 Tests; der erste Stand zuvor 64/64.

Commit `6521b53d` führt danach den versionierten Vergleichsvertrag
`AUTOMATIC_INDEX_ADJUSTMENT_PRESENCE_EQUALITY_V1` ein. Er verlangt:

- exakt `VS-10 / automatic_index_adjustment / CONDITION`;
- denselben versionierten Ein-Komponenten-Vertrag mit `ALL`;
- beidseitig `INCLUDED`, `GENERAL_REQUIRED` und `GENERAL`;
- feldlos `NOT_REQUIRED` ohne angeforderte oder optionale Felder;
- vollständige, konfliktfreie und rangaufgelöste Atome mit gültigen Quellen;
- in jeder kanonisch zusammengeführten Quelle eine aktive indexgebundene
  Anpassung der Gebäudeversicherungssumme beziehungsweise
  Versicherungssumme;
- keine Negation, Aufhebung, Aussetzung, Optionalität, Bedingung, Antrag,
  Zustimmung, Mehrprämie, gesonderte Vereinbarung, manuelle oder einmalige
  Neubewertung und keinen bloß historischen Wortlaut;
- keine reine Prämienindexierung, Überschrift, Indexerwähnung oder Regelung
  eines anderen Versicherungsgegenstands.

Adversarial geprüft wurden insbesondere nachgestellte Negation, optionale
Anpassung, reine Prämienindexierung, manuelle Neubewertung, historischer
Wortlaut, Hausrat statt Gebäude, reine Überschrift, abweichende Wirkung,
andere Komponente sowie gemischte aktive und inaktive Contributors. Die
positiven Kontrollen verwenden die beiden realen unterschiedlichen
Formulierungsfamilien. Der Mac-Studio-Stand bestand 85/85 Vergleichs-,
Kanonisierungs- und Ergebnisaufbau-Tests.

```text
Sicherheitscommit 1: 377b2df0c511b2fca92e317779ff4c0851fae24b
Sicherheitscommit 2: ef4c4c65354de3d5953c5ed6abdcd795fae3ed4c
Vergleichscommit: 6521b53d41e472775aa5470b751b3157c4cd67fd
Mac-Studio-Suites: 85/85 PASS
Overlay: /private/tmp/pav8-overlay-vs10-6521b53d-rerun-AwC5Cn/overlay
Delta gegenüber akzeptiertem ST-01-Overlay: exakt VS:VS-10
VS-10: UNKLAR -> GLEICHWERTIG
Target-Deltas gegenüber Ausgangsbaseline: ST:ST-01 und VS:VS-10
Nicht-Target-Dokumentinstanzen: 1.550/1.550 identisch
Finale Nicht-Target-Zeilen: 155/155 identisch
Geänderte Nicht-Target-Zeilen: 0
Comparison SHA-256: 3b4e607ebabe64b131f4568b083d7ef12e62a5a510caddae36c2d780adf5f446
Guard SHA-256: 96710bab547eaf19a63c9a7e91d52c5d182e9ae1003f3cb4b1217704550002e7
```

Kumulierte Metrik nach ST-01 und VS-10:

```text
VORTEIL_A 2, VORTEIL_B 2, DOKUMENTATIONSUNTERSCHIED 33,
GLEICHWERTIG 112, NICHT_VERGLEICHBAR 8, UNKLAR 67.
Kundenreview: 67; ohne Kundenreview: 157.
```

Bewertung: Kandidat angenommen. Gegenüber dem vorherigen akzeptierten
ST-01-Stand ändert sich exakt eine Zeile. Die 155 eingefrorenen
Nicht-Review-Zeilen bleiben vollständig identisch. Der Overlay bleibt
QA-only, nicht publishbar, nicht deploybar und ist kein Beleg für beliebige
Versicherer oder Dokumente.

### 10.3 FE-B13 – Fremdspartenfund als ehrlicher terminaler Reject

Ursache: Paket A besaß bereits einen vollständigen kontrollierten Nullbefund.
In Paket B waren acht der neun Dokumente ebenfalls echte Zero-Terminals. Nur
das Dokument `7ee81362-b5e8-421c-8eb9-6eec505bf6a0` enthielt einmal den
Wortlaut „vor Beginn des Versicherungsschutzes“. Diese Klausel steht auf
physischer Seite 2 unter der aktuellen Überschrift „Allgemeine Bedingungen
für die Leitungswasserversicherung“; Seiten- und Abschnittsscope sind beide
eindeutig `LEITUNGSWASSER_INSURANCE`. Sie schließt vorvertragliche
Leitungswasserschäden aus und belegt keinen Feuer-Ausschluss.

Die deterministische Triage erkannte dies bereits als
`MENTION_ONLY / EXPLICIT_OTHER_CATEGORY_SECTION`. Der Prepared-Target verlor
danach jedoch Basis und Scope und speicherte nur `TRIAGE_MENTION_ONLY`.
`componentSearchAudit` akzeptierte kontrollierte Fundlosigkeit ausschließlich
bei null Roh-Occurrences und null Rejections. Deshalb blieb Paket B trotz
vollständig erklärtem Fremdspartenfund `SEARCH_INCOMPLETE` und FE-B13 fiel in
`MISSING_BOTH`.

Commit `576acf27` führte den engen Vertrag
`DETERMINISTIC_OTHER_CATEGORY_TERMINAL_V1` ein. In diesem ersten Stand war er
ausschließlich für
`FE / FE-B13 / pre_inception_damage_exclusion / EXCLUSION` aktiv und
verlangte:

- die bestehende Suchpolitik
  `REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1` und
  `absenceMeaning=EXCLUSION`;
- einen eindeutigen aktuellen Leitungswasserabschnitt und denselben
  Page-Scope;
- den konkreten vorvertraglichen Ausschlusswortlaut;
- keinen Feuer-Cross-Reference-Wortlaut;
- null zugelassene und null ungelöste Kandidaten;
- vollständige 1:1-Zuordnung aller Roh-Occurrences zu servereigenen Rejects;
- Bindung von Kandidaten-ID, Alias, physischer Seite, Offsets, exaktem Text
  und Scopehints über einen SHA-256-Occurrence-Digest;
- einen separaten Rejection-Set-Digest und vollständige Provenienz im
  Search-Audit.

Die alten Tatsachen-Gates werden nicht umgeschrieben:
`zeroOccurrenceTerminal=false` und `zeroCandidateTerminal=false`. Der neue
Proof-Mode heißt stattdessen
`ALL_OCCURRENCES_DETERMINISTICALLY_OUT_OF_CATEGORY`. Das bilaterale
Abwesenheitsaudit akzeptierte diesen alternativen Beweis zunächst nur für
FE-B13 und prüfte die gesamte Provenienz erneut. Seit dem separat geprüften
ST-14-Commit in Abschnitt 10.5 erfolgt diese Freigabe über eine gemeinsame,
zielgebundene Registry; FE-B13 behält unverändert seinen engeren Vertrag.

Der harte Gegenfall `EL-06` bleibt gesperrt. Dort steht zwar eine Klausel
unter Leitungswasser, sie regelt aber ausdrücklich Kanalrückstau nach
Überschwemmung/Hochwasser und ist damit für Elementardeckung relevant. Eine
allgemeine Regel „fremde Überschrift = Nichtfund“ wäre fachlich falsch. Die
Tests enthalten deshalb Page-Scope-Mischung, veraltete
`PRECEDING_PAGE_HEADING`, Feuer-Cross-Reference, modellseitige Kandidaten,
Digest-Tampering und den EL-06-Wortlaut als Ablehnungsfälle.

Der vorhandene 69er-Targetrun enthielt naturgemäß noch nicht die neue
Rejection-Provenienz. Commit `a55edb61` erweitert deshalb ausschließlich den
QA-Overlay-Guard: Er darf servereigene `NOT_FOUND`-Targets nur dann mit neu
berechneter Provenienz auffrischen, wenn Kandidatenpartition, IDs, Gründe,
Judgement und alle übrigen Targetfelder identisch bleiben. Jede Änderung an
zugelassenen Kandidaten, Modellurteil, Wirkung oder Scope bricht weiter hart
ab. Im realen Lauf wurde exakt ein Target aufgefrischt:
`FE-B13:pre_inception_damage_exclusion` in DOC-09/FE.

```text
Fachcommit: 576acf273a2b890ef8580857daeb0c04298ba487
Mac-Studio-Fachsuites: 176/176 PASS
QA-Guard-Commit: a55edb61d7e2651128e7e9e607338fb537f37da1
Mac-Studio-QA-Suites: 114/114 PASS
Overlay: /private/tmp/pav8-overlay-feb13-a55edb61-JG6RBX/overlay
Delta gegenüber akzeptiertem VS-10-Overlay: exakt FE:FE-B13
FE-B13: UNKLAR -> GLEICHWERTIG
EL-06: unverändert UNKLAR / MISSING_ONE_SIDE
Nicht-Target-Dokumentinstanzen: 1.550/1.550 identisch
Finale Nicht-Target-Zeilen: 155/155 identisch
Geänderte Nicht-Target-Zeilen: 0
Comparison SHA-256: c2f1958e8c32bad1cecf2f6434630b84d2e546fde9ba924fa34cf3825c9cd522
Guard SHA-256: 3d86a7179be323ee55e529c2f1d271472422a28692ab4db0d815118cbd5a1c3d
```

Kumulierte Metrik:

```text
VORTEIL_A 2, VORTEIL_B 2, DOKUMENTATIONSUNTERSCHIED 33,
GLEICHWERTIG 113, NICHT_VERGLEICHBAR 8, UNKLAR 66.
Kundenreview: 66; ohne Kundenreview: 158.
```

Bewertung: Kandidat angenommen. Die Aussage ist ausschließlich gleiche
dokumentierte Fundlage nach vollständiger kontrollierter Suche. Sie behauptet
weder einen ausdrücklichen Ausschluss noch identische Deckung.

### 10.4 VS-04 – kein Nullfall, noch nicht gefixt

VS-04 wurde als erster Eintrag der beidseitigen Fehlfundgruppe untersucht,
aber bewusst nicht über den Abwesenheitsvertrag abgeschlossen. Paket A hat
neun lexikalische Kandidaten, Paket B vier. Viele sind echte Fremdtreffer:
Haftpflicht-Pauschalsummen oder ein Sachverständigengutachten zur
Schadenabwicklung beweisen keine Methode zur Ermittlung der
Gebäudeversicherungssumme. Diese Ablehnungen sind korrekt.

Der Inhalt ist dennoch nicht sicher absent. Die bereits gebundenen VS-10-
Quellen nennen auf beiden Seiten eine Anpassung der Versicherungssumme nach
dem Baukostenindex. Paket A nennt zusätzlich eine Beziehung zwischen
Neuwertschätzgutachten und Versicherungssumme. Das VS-04-Label fordert
ausdrücklich „Pauschale, Index, Gutachten“, die aktuelle Aliasfamilie sucht
diese aktiven Methoden aber nicht ausreichend. Zusätzlich existiert für das
Pflichtfeld `calculation_method` noch kein spezialisierter Extractor. Selbst
ein richtiger neuer Fund könnte deshalb derzeit nicht vollständig typisiert
werden.

Bewertung: `NO-FIX` für bilaterale Abwesenheit; eine solche Änderung wäre
inhaltlich falsch. Der spätere VS-04-Fix braucht einen versionierten
Methodenvertrag mit aktiven Index-, Gutachten- und echten
Pauschalmethodenmustern, Haftpflicht-/Schadengutachten-Negativscopes und einer
deterministischen Normalform für `calculation_method`. Erst ein gezielter
Replay darf entscheiden, ob beide Pakete über die Indexmethode gleichwertig
sind oder Paket A eine zusätzliche aktive Gutachtenmethode besitzt.

### 10.5 ST-14 – Lichtkuppeln im Glasbruchabschnitt

Ursache: `ST-14` besteht aus den beiden Pflichtkomponenten `roof_window` und
`skylight_dome`. Für `roof_window` lag auf beiden Seiten bereits eine
vollständig kontrollierte Nullsuche vor. Nur zwei Rohfundstellen für
„Lichtkuppeln“ verhinderten den Abschluss:

- Paket A, Dokument `4417a01f-7f73-44de-979a-3dcf9e65ca63`, physische Seite
  15, aktuelle Überschrift „7. Glasbruch“. Der lokale Lead lautet
  „Versichert sind im Rahmen der Gebäude-Glaspauschale ...“; die Fundstelle
  steht in einer Liste mit Firmenschildern und Reklameanlagen.
- Paket B, Dokument `c0dc339c-bf7c-4f4c-82a3-1eb84cfaee47`, physische Seite
  2, aktuelle Überschrift „Allgemeine Bedingungen für die
  Glasbruchversicherung“. Der lokale Text versichert Gebäudeverglasungen,
  Glasdächer und Lichtkuppeln gegen Glasbruch.

Beide Fundstellen belegen Glasdeckung, aber keine Sturmdeckung. Die
deterministische Triage hatte sie deshalb bereits korrekt als
`MENTION_ONLY / EXPLICIT_OTHER_CATEGORY_SECTION` abgelehnt. Wie zuvor bei
FE-B13 fehlte jedoch ein revisionsfester terminaler Beweis. Die Rohtreffer
blieben dadurch `SEARCH_INCOMPLETE`; aus zwei vollständig erklärbaren
Fremdspartenfunden entstand fälschlich `MISSING_BOTH`.

Commit `03294001` erweitert den vorhandenen Fremdspartenvertrag nur um das
registrierte Ziel `ST / ST-14 / skylight_dome`. Die Freigabe verlangt:

- `factRole=INSURED_OBJECT`, `absenceMeaning=COVERAGE_ONLY` und dieselbe
  vollständige kontrollierte Suchpolitik;
- exakt „Lichtkuppel“ beziehungsweise „Lichtkuppeln“;
- genau einen Scope `GLASBRUCH_INSURANCE` aus einer aktuellen
  `CURRENT_PAGE_HEADING`, nicht aus einer geerbten Überschrift;
- einen lokalen positiven Glasdeckungs-Governor aus „versichert sind“ und
  Glasbruch-, Glasversicherungs-, Glaspauschal- oder Verglasungswortlaut;
- keinen lokalen Sturm-, Hagel-, Schneedruck-, Felssturz-, Steinschlag-,
  Erdrutsch- oder Lawinenverweis;
- null zugelassene und null ungelöste Kandidaten sowie die vollständige
  1:1-Reject-Kette;
- den Proof-Mode
  `CURRENT_SECTION_PLUS_LOCAL_FOREIGN_COVERAGE_V1`;
- einen erweiterten Occurrence-Digest, der für diesen Proof-Mode zusätzlich
  Kontext und lokalen Scope-Lead bindet;
- erneute Prüfung von Ziel, Rolle, Abwesenheitsbedeutung, Fremdscope,
  Proof-Mode und Rejection-Set-Digest im bilateralen Abwesenheitsaudit.

Der Vertrag leitet aus Glasdeckung keinen Sturm-Ausschluss ab. Er erklärt nur,
warum diese beiden konkreten Glasfundstellen keine Treffer der ST-14-Suche
sind. Die abschließende Aussage lautet deshalb gleiche dokumentierte
Fundlage nach vollständiger kontrollierter Suche, nicht „Lichtkuppeln sind
generell unversichert“.

Adversarial geprüft wurden veraltete Überschriften, gemischte Glas-/Sturmscopes,
lokale Sturm- und Hagelerweiterungen, bloße Bauteillisten ohne positiven
Glasdeckungs-Governor, falsche Kategorie, falsche Rolle, falsche
Abwesenheitsbedeutung, unbekannter Proof-Mode und Digest-Manipulation. Der
frühere harte Gegenfall `EL-06` bleibt unverändert `UNKLAR / MISSING_ONE_SIDE`.

```text
Fachcommit: 03294001d9646774b98d699dfdb0d7cb20419530
Mac-Studio-Worktree: /private/tmp/pv3-validate-03294001
Runtime: Node 22.23.2
Mac-Studio-Suites: 109/109 PASS
Overlay: /private/tmp/pav8-overlay-st14-03294001-xRNC9X/overlay
Delta gegenüber akzeptiertem FE-B13-Overlay: exakt ST:ST-14
ST-14: UNKLAR -> GLEICHWERTIG
Aufgefrischte ST-14-Targets: exakt DOC-01/ST und DOC-04/ST,
jeweils ST-14:skylight_dome
EL-06: unverändert UNKLAR / MISSING_ONE_SIDE
Nicht-Target-Dokumentinstanzen: 1.550/1.550 identisch
Finale Nicht-Target-Zeilen: 155/155 identisch
Geänderte Nicht-Target-Zeilen: 0
Comparison SHA-256: a713c1b71a90e28bb889c4d912b5d76674d5f936e7748d95a3826c5b4200302e
Guard SHA-256: 39187daa9036a119cf9916246f5bf3c76b04d5bc4f67dcbae8419d7e1fb7b40f
```

Kumulierte Metrik:

```text
VORTEIL_A 2, VORTEIL_B 2, DOKUMENTATIONSUNTERSCHIED 33,
GLEICHWERTIG 114, NICHT_VERGLEICHBAR 8, UNKLAR 65.
Kundenreview: 65; ohne Kundenreview: 159.
MISSING_BOTH: 7.
```

Bewertung: Kandidat angenommen. Gegenüber dem zuletzt akzeptierten Overlay
ändert sich exakt `ST:ST-14`; alle anderen 223 finalen Vergleichszeilen sind
inkrementell identisch. Der QA-Overlay bleibt nicht publishbar und nicht
deploybar.

### 10.6 Bereits analysierte nächste Suchkandidaten

Die parallele Rohbelegprüfung ergab folgende Grenzen für die nächsten
Einzelfixes:

- `ST-13`: derzeit sicherster nächste Mikrofix. Der unqualifizierte Alias
  `Kamin-` trifft in DOC-03, physische Seite 12, den Feuerbegriff
  „Kaminbrand“. Das ist weder Kamin-/Schornsteinkopf noch Sturmdeckung. Der
  Fix muss die Ellipse „Kamin- und/oder Schornsteinköpfe“ erhalten, darf aber
  `Kaminbrand` nicht mehr matchen. Weil dies die Roh-Occurrence-Menge ändert,
  ist ein echter gezielter ST-13-Replay erforderlich; ein bloßer
  Provenienz-Overlay wäre unzulässig.
- `ST-10`: kein Nullfall. Paket A enthält Sicherungs-/Aufräumungs-/Abbruchkosten
  in einem mehrspartigen Deckungsabschnitt; Paket B enthält in EABS
  „Sicherungskosten“ und „Notverschalung“. Nötig sind Mehrsparten-Heading-
  Reset, semantische Aliase und lokale Limitbindung. Nicht als Mikrofix
  terminalisieren.
- `ST-23`: vorläufig `NO-FIX`. „Andere Gegenstände werden durch eine
  versicherte Gefahr geworfen“ beweist nicht sicher den geforderten Anprall
  fremder Bäume oder Äste. Eine Promotion braucht fachliche Freigabe für diese
  Äquivalenz.
- `FE-B09`: kein Nullfall. Paket B enthält in ABS 2015 einen echten
  Vorsatzausschluss mit Leistungsfreiheit, der wegen zu enger Wortstellungs-
  Aliase fehlt. Benötigt werden ein enger Konzeptvertrag aus Vorsatz,
  Herbeiführung und Leistungseffekt sowie die paketweite AFB-zu-ABS-
  Anwendbarkeit. Erwartung erst nach Replay; ein Vorteil B ist plausibel,
  aber noch nicht bewiesen.
- `FE-F08`: kein kleiner Alias- oder Nullfix. Paket B enthält zahlreiche
  Codes „Besondere Bedingung ...“ und ein Klauselverzeichnis. Erforderlich ist
  ein paketweiter Klauselcode-Resolver für Referenz, vorhandenen Klauseltext,
  Produktvariante, Anwendbarkeit und Dokumentrang. Ein
  `KLAUSELVERZEICHNIS` allein beweist keine vollständige Verfügbarkeit.

### 10.7 ST-13 – enger Recall-Kandidat für Kamin-/Schornsteinköpfe

Ursache: Der Alias `Kamin-` war kein Interpunktionsvertrag. Die kontrollierte
Aliasnormalisierung entfernte den Bindestrich und suchte dadurch das
eigenständige Wort `Kamin`. Im gebundenen Paket B entstand genau eine falsche
Rohfundstelle: DOC-03, physische Seite 12, exakter Span „Kamin“ in
„FE08 Kaminbrand – Versichert sind Schäden am Kamin durch einen Brand ...“.
Die rechte Wortgrenze verhinderte zwar einen Teiltreffer innerhalb von
„Kaminbrand“, nicht aber das spätere selbständige Körperwort. Alle übrigen
ST-13-Komponenten und Dokumente waren bereits rohfundlos.

Commit `a56132e3` entfernt den nackten Alias und ersetzt ihn ausschließlich
durch:

- direkte Flexionen von `Kaminkopf` und `Schornsteinkopf`;
- vollständige koordinierte Phrasen für „Kamin- und“, „und/oder“, „oder“,
  „sowie“, „bzw.“ und Slash-Schreibweise;
- die entsprechenden Dativ-Pluralformen „...köpfen“.

Ein Concept-Search wurde bewusst nicht ergänzt. Ein bloßes gemeinsames
Textfenster aus `kamin*` und `schornsteinkopf*` könnte den Ellipsenbindestrich
und die Koordination nicht beweisen. Es würde etwa einen Kaminbrand neben
einem echten Schornsteinkopf fälschlich zu zwei Komponenten aufwerten.

Positive Kontrollen decken alle freigegebenen Koordinations- und
Flexionsformen sowie direkte Kopfbegriffe ab. Negative Kontrollen enthalten
Kaminbrand, Schornsteinbrand, Kaminschleifen, Innenputz des Kamins, mehrere
Kamine, Kaminrohr, Kamin-/Lüftungsanlagen, Kaminsanierung und Kaminaufsatz.
23 fokussierte ST-13-Tests und die breiteren Katalog-/Produktvertrags-Suites
sind auf dem Mac Studio grün.

Da der kontrollierte Suchvertrag geändert wurde, wurde der ST-Katalog
revisionsrichtig von `st-occurrence-full-draft-v0.4` auf `v0.5` und das
Produktprofil auf `CUSTOMER_CORE_5_V12_ST13_CHIMNEY_HEAD_PRECISION` erhöht.
Das historische 69er-v0.4-Manifest und sein Overlay bleiben unverändert. Eine
Mischung aus v0.4- und v0.5-Suchplänen wäre kein ehrlicher kumulativer
Vergleich.

Commit `425cc032` ergänzt deshalb den privaten Vertrag
`TARGET_REQUIREMENT_RECALL_AUDIT_V1`. Er bindet den SHA-256 des historischen
Baseline-Paketvertrags, die zehn Dokument-UUIDs, Seiten, Dokumentartefakte,
Primary-Manifeste, alten Worksheets, aktuellen Katalog und Release-Commit.
Er vergleicht alle Requirements pro Dokument und verlangt, dass ausschließlich
das ausgewählte Requirement abweicht. Der Audit materialisiert weder
Evidenzwirkung noch Vergleich, Vorteil oder Kundenergebnis.

Realer Mac-Studio-Audit:

```text
Fachcommit: a56132e350817e31e4012624758aa3c4e57cbac9
Test-Korrekturcommit: 6a81dced16f402646dc17214321394cf52664674
Recall-Audit-Commit: 425cc03209991ce013e82f88c475248e9cbb32d2
Mac-Studio-Worktree: /private/tmp/pv3-validate-425cc032
Mac-Studio-Fachsuites nach Testkorrektur: 117/117 PASS
Mac-Studio-Recall-Audit-Suite: 3/3 PASS
Audit: /private/tmp/pav8-recall-st13-425cc032-6ZvT0F/requirement-recall.private.json
Dokumente: 10/10
Physische Seiten: 108
Paketseiten: A=1 Dokument, B=9 Dokumente
Rohfundstellen alt -> neu: 1 -> 0
Einziger Occurrence-Delta: DOC-03/B, exakter alter Span „Kamin“, 1 -> 0
Andere Requirements je Dokument: unverändert
Alle aktuellen ST-13-Komponenten: terminaler kontrollierter Nullfund
Report-Digest: 5467cffe6fd059b3ef61ee95a8352f382b5b9c81ed9b72c7ae468fbc24a947ab
Datei-SHA-256: 02a3212cd475e7dac3a731ba8c2759db4a6bd6c1904296528e57cfe183c791a5
```

Bewertung: **Recall-Kandidat bestanden, Vergleichsannahme noch offen.** Der
gebundene Zehner-Audit beweist den erwarteten eng isolierten Suchdelta. Er
beweist noch nicht die finale Zeilenentscheidung. Erwartet wird im späteren
konsistenten v0.5-Vollvergleich `ST-13: UNKLAR -> GLEICHWERTIG` und damit
Review `65 -> 64`; diese Metrik wird bis dahin nicht als Fakt ausgewiesen.

Separates fachliches Risiko: `ST-13` verwendet weiterhin `ALL` für
`chimney_head` und `smokestack_head`. Einzelne echte Sätze wie „Kaminköpfe
sind sturmversichert“ bleiben daher zeilenweit unvollständig. Ob beide Wörter
regionale Synonyme sind und deshalb ein gemeinsames Objektkonzept oder `ANY`
benötigen, ist eine eigene Fachentscheidung und wurde nicht mit dem
lexikalischen Mikrofix vermischt.

### 10.8 LW-25 – Allmählichkeit als positive Deckungsdimension

Ausgangsfehler: Der historische LW-25-Vertrag suchte fast ausschließlich
Ausschlussformulierungen. Dadurch blieb die ausdrückliche Klausel in Paket B,
DOC-03, physische Seite 12, unsichtbar:

```text
LW01 Allmählichkeitsschäden
Allmählichkeitsschäden und Schäden durch Langzeiteinwirkung sind generell
mitversichert.
```

Der gebundene Zehnerbestand enthält damit keinen beidseitigen Nullfall. Die
Rohfundstellen verteilen sich nach dem Recall-Fix wie folgt:

- Paket A, DOC-01: zwei Treffer auf physischer Seite 20. Beide gehören
  ausschließlich zur Gebäude- und Grundstückshaftpflicht. Der erste erbt die
  Überschrift von Seite 17; der zweite steht unter der aktuellen Überschrift
  „Entschädigung aus der Haftpflichtversicherung“ und bindet ausdrücklich
  AHVB/Schadenersatzverpflichtungen.
- Paket B, DOC-03/SUPPLEMENT: drei Treffer im selben Leitungswasserabsatz:
  einmal der Klauseltitel, einmal „Allmählichkeitsschäden“ im Satz und einmal
  „Schäden durch Langzeiteinwirkung“. Alle drei liegen unter der aktuellen
  Überschrift `B4 Leitungswasserversicherung (LW)`.

Der Fix wurde deshalb in getrennten Verträgen umgesetzt:

1. Commit `b902c20c` ergänzt ausschließlich die kontrollierten Begriffe
   `Allmählichkeitsschaden/-schäden`, `Schäden durch Langzeiteinwirkung` und
   `Langzeitschaden/-schäden`; Holzfäule, Schwamm, Vermorschung, Korrosion und
   Verschleiß bleiben außerhalb von LW-25.
2. Commit `ae780a14` trennt technische Audit-Gates von fachlichen
   Recall-Findings. Neue Rohfundstellen sind damit kein künstlicher
   Auditfehler mehr, sondern werden zur weiteren Triage ausgewiesen.
3. Commits `1323e584` und `8041735c` zertifizieren die zwei A-Treffer als
   Haftpflicht-Fremdfunde. Der zweite Commit korrigiert einen im Agentenreview
   gefundenen Testfehler: Die beiden realen Fundstellen besitzen zwei
   unterschiedliche Heading-Quellen und werden deshalb über zwei getrennte,
   seitengebundene Scope-Beweise geprüft.
4. Commit `f99e178d` führt
   `LW25_EXPLICIT_GRADUAL_DAMAGE_INCLUSION_V1` ein. Nur ein einzelner lokaler
   Klauselcluster mit beiden Atomen und der unbedingten Wirkung „sind
   [generell] mitversichert“ wird serverseitig `INCLUDED`. Negation,
   Bedingung, Ausnahme, Option, Mehrprämie, getrennte Klauselcluster und
   unvollständige Atome bleiben fail-closed.
5. Commit `024848f2` neutralisiert die Kundenbezeichnung. Dadurch entsteht
   nicht mehr die irreführende Ausgabe „Ausschluss ...: eingeschlossen“.
6. Commit `6cfc25f0` modelliert LW-25 semantisch als `DAMAGE` mit
   `absenceMeaning=COVERAGE_ONLY`. Das ist kein bloßes Rendering: Die Zeile
   fragt jetzt fachlich nach Deckung allmählicher Schäden und kann sowohl
   positive Einschlussklauseln als auch ausdrückliche Ausschlüsse korrekt
   abbilden. Der vorhandene gerichtete Vertrag darf dadurch eine vollständig
   belegte Inclusion gegen vollständigen kontrollierten Nichtfund werten.
7. Commit `8438c3a4` korrigiert eine vom Mac-Test gefundene zu breite
   Registry-Änderung. FE-B13 behält `EXCLUSION/EXCLUSION`; nur LW-25 erhält
   `DAMAGE/COVERAGE_ONLY`.

Realer Mac-Studio-Stand:

```text
Endcommit: 8438c3a4b32a284d933af675873c0f5f0db1c0a3
Mac-Studio-Worktree: /private/tmp/pv3-validate-8438c3a4
Runtime: Node 22.23.2
Fokussierte Abschluss-Suites: 197/197 PASS
Recall-Audit: /private/tmp/pav8-recall-lw25-8438c3a4-YDkrlN/requirement-recall.private.json
Dokumente: 10/10
Physische Seiten: 108
Paketseiten: A=1 Dokument, B=9 Dokumente
Rohfundstellen alt -> neu: 1 -> 5
Andere Requirements je Dokument: unverändert
Katalog: lw-occurrence-full-draft-v0.8
Katalog-SHA-256: d2a5265594a3cf89a6a1c6364b189b1ad51ebf0faa2a7914fc2d2df9f3fa5bad
Requirement-SHA-256: 4ede2ad4e8c9780ce8c8681ba850eb75aebe5a8e3f07946c8996405668fa9224
Report-Digest: 837651f76af365d72934d98382632000fc2e5a2ec7b0c8094472f57806a5d216
Datei-SHA-256: d181888bf826a3b02f4b93aacc0611803fea9f2bf8a1c6ef0f49f8fd8e704b92
```

Der reale komponentengenaue Pipeline-Probe auf demselben Commit ergab:

```text
Paket A / DOC-01: 2 Occurrences, 0 Kandidaten, 2 terminale Haftpflicht-Rejects,
0 ungelöste Kandidaten.
Paket B / DOC-03: 3 Occurrences, 3 DIRECT-Kandidaten, 0 Rejects,
0 ungelöste Kandidaten.
B-Urteil: FOUND + INCLUDED + NONE + GENERAL.
B-Entscheidungseigner:
SERVER_LW25_EXPLICIT_GRADUAL_DAMAGE_INCLUSION_V1:LW:LW-25.
```

Der gerichtete Vergleichstest bildet zusätzlich exakt die reale Struktur ab:
zwei verschieden geerbte/aktuelle Haftpflicht-Rejects auf A sowie eine
`SUPPLEMENT / FRAMEWORK_TERMS / CONDITIONAL`-Inclusion auf B. Ergebnis des
gehärteten Vertrags: `VORTEIL_B / INCLUDED_OVER_QUALIFIED_ABSENCE`, ohne
Kundenreview. Manipulation einer Heading-Quelle sperrt die Entscheidung
wieder fail-closed.

Bewertung: **Pipeline-Kandidat bestanden.** Erwartet wird im späteren
konsistenten Vollvergleich `LW-25: UNKLAR -> VORTEIL_B`. Dieser Vorteil und
die daraus folgende Gesamtmetrik werden bis zum echten Vollvergleich nicht
als gemessene Produktionszahl ausgewiesen. Das installierte Kundensystem
wurde nicht verändert und es erfolgte kein Deployment.

### 10.9 EL-06 – lokaler Hochwasserscope unter Leitungswasserüberschrift

Ausgangsfehler: Paket A besaß bereits einen vollständigen EL-06-Beleg. Paket B
enthielt in DOC-03 auf physischer Seite 13 ebenfalls die ausdrückliche Klausel:

```text
LW06 Kanalrückstau
Schäden aus einem Kanalrückstau nach einer Überschwemmung sind im Rahmen der
VS für Hochwasser/Überschwemmung mitversichert.
```

Die beiden kontrollierten Vorkommen im Titel und im Satz erbten jedoch die
Leitungswasserüberschrift von Seite 12. Der generische Scopevertrag wertete
sie deshalb als Fremdspartenfund. Paket B blieb trotz des ausdrücklich lokal
genannten Hochwasserscopes ohne Kandidat; die Vergleichszeile endete als
`MISSING_ONE_SIDE / UNKLAR`.

Der Fix besteht aus vier getrennten Commits und zwei realen
Validierungsschleifen:

1. Commit `11f2c176` führt den engen Vertrag
   `EL_06_LOCAL_TARGET_SCOPE_REBINDING_V1` ein. Er ist ausschließlich für
   `EL / EL-06 / sewer_backflow / PERIL` aktiv und verlangt im selben Absatz
   Kanalrückstau nach Überschwemmung, eine ausdrückliche Zuordnung zur
   Hochwasser-/Überschwemmungsversicherung und positive Deckungswirkung.
2. Commit `4cb2f38a` ergänzt die positive Singularform als separaten
   Forward-Fix und bringt alle drei betroffenen Dateien in den auf dem Mac
   Studio geprüften Formatstand.
3. Die unabhängige Gegenprüfung fand danach zwei noch zu breite Grenzen:
   Eine geerbte Leitungswasserüberschrift war zeitlich nicht begrenzt; außerdem
   war die Singularform nicht eng genug an das EL-06-Subjekt gebunden. Commit
   `34f75690` ersetzt den Vertrag deshalb durch V2. V2 verlangt exakt eine
   Seite Abstand zur geerbten Überschrift, ausschließlich beobachtete
   Leitungswasserscopes, einen subjektgebundenen positiven Gesamtsatz und
   verwirft Negation, Ausschluss, Bedingung, Ausnahme, Option, Mehrbeitrag und
   getrennte Klauseln. Dieselbe V2-Identität besitzt einen eigenen
   deterministischen Prepared-Evidence-Vertrag.
4. Der erste reale Zehner-Probe auf `34f75690` stoppte korrekt: Der neue
   Prepared-Interceptor fing auch den bereits gültigen A-Kandidaten mit der
   älteren generischen Basis `EXPLICIT_NARROW_SECTION_SCOPE` ab. Commit
   `f964b293` lässt den V2-Interceptor nur eingreifen, wenn mindestens ein
   V2-Kandidat vorhanden ist. Ein vollständig vorhandener V1-/generischer
   EL-06-Pfad fällt weiter in die bestehende Wirkungsermittlung. Eine eigene
   Regression schützt diesen A-Pfad.

Der Endstand wurde im isolierten Mac-Studio-Worktree geprüft:

```text
Endcommit: f964b293a97fb98d173f920a6b93829e70d38e72
Mac-Studio-Worktree: /private/tmp/pv3-validate-f964b293
Runtime: Node 22.23.2
Prettier: PASS
Direkte, angrenzende, Atom-, Vergleichs- und Overlay-Suites: 242/242 PASS
Baseline-Paket-SHA-256:
2b390be8aa5597a9990735151b5458e023c9b561134e4c1023f5e6a765479173
Katalog: el-occurrence-full-draft-v0.6
Target-Selection-Digest:
49e44646352e5a5a3243eed598284b3e2b8c68cb26c088a5022f6bdea30dd493
Pipeline-Probe-Digest:
6666f097d19e3d49a49342cdb80ebaa4a337974809cf4e711abc315f7b359bce
```

Der reale komponentengenaue Probe über alle zehn Paketdokumente ergab:

```text
Paket A / DOC-01 / Seite 10:
1 Occurrence, 1 NARROW_SCOPE-Kandidat, 0 Rejects, 0 ungelöst.
Urteil: FOUND + INCLUDED + NONE + NARROW_ONLY + CONDITIONAL.
Owner: SERVER_EXPLICIT_CATEGORY_CLAUSE:EL:EL-06.

Paket B / DOC-03 / Seite 13:
2 Occurrences, 2 NARROW_SCOPE-Kandidaten, 0 Rejects, 0 ungelöst.
Basis beider Kandidaten: EL_06_LOCAL_TARGET_SCOPE_REBINDING_V2.
Urteil: FOUND + INCLUDED + NONE + NARROW_ONLY + CONDITIONAL.
Owner: SERVER_EL06_EXPLICIT_LOCAL_FLOOD_COVERAGE_V2:EL:EL-06.

Übrige acht B-Dokumente:
0 Occurrences, 0 Kandidaten, unveränderte kontrollierte Nullfundlage.
```

Systemgrenze: Der bestehende sichere Overlay-Refresh darf diesen Kandidaten
nicht in den alten All-50-Lauf einschleusen, weil sich die Candidate-Partition
und das Judgement von DOC-03 tatsächlich ändern. Das ist beabsichtigt. Der
Zehner-Probe beweist den vollständigen serverseitigen Analysepfad für EL-06,
aber noch keine neue 224-Zeilen-Gesamtmetrik. Erwartet wird im späteren
konsistenten Vollvergleich `EL-06: UNKLAR -> GLEICHWERTIG`; bis dahin bleibt
die offizielle akzeptierte Metrik unverändert. Das installierte Kundensystem
blieb unangetastet und es erfolgte kein Deployment.

### 10.10 EL-12 – Vertragsfolge versus reine Hochwasser-Risikoinformation

Ausgangsfehler: EL-12 war kein fehlender Suchbegriff. Paket A und Paket B
enthielten je eine kontrollierte Fundstelle mit vollständig verschiedener
fachlicher Rolle:

- Paket A, DOC-01, physische Seite 10: echte HQ30-Vertragsbedingung. Befindet
  sich das versicherte Objekt innerhalb der HQ30-Zone, ist die
  Versicherungssumme bei Hochwasserschäden auf `EUR 10.000` begrenzt.
- Paket B, DOC-02, physische Seite 3: ausschließlich die
  Standort-Risikoinformation `Hochwasser-Risiko-Zone: unbekannt`. Im selben
  Listenblock stehen Vorschaden- und Risikodaten, aber keine Deckung, kein
  Ausschluss, kein Zuschlag, kein Selbstbehalt und kein Limit.

Der Ausgangszustand hatte drei getrennte Ursachen. Der A-Beleg war bereits
`FOUND + DEFINED`, blieb wegen der strukturellen Sturmüberschrift aber
`NARROW_ONLY / TEILBELEGT`. Der B-Infotext wurde vom Modell als
`NARROW_SCOPE` in den Target-Pool gelassen und danach ohne Auswahl verworfen;
ohne servereigenen Terminalbeweis blieb die Suche trotzdem unvollständig. Eine
neue Vorteilsregel wäre fachlich falsch, weil ein fehlender Zonenhinweis weder
Hochwassergrunddeckung noch ein besseres Limit beweist.

Die Korrektur wurde in zwei fachliche Commits getrennt:

1. Commit `6acad314` setzt ausschließlich EL-12 auf die vorhandene generische
   Scope-Policy `MATCHING_SCOPE_DEFINITIVE_SUFFICIENT`. Der EL-Katalog wurde
   revisionsrichtig von v0.6 auf v0.7 und das Produktprofil auf
   `CUSTOMER_CORE_5_V16_EL12_SCOPE_PRECISION` erhöht. Alte PAV8-v0.6-Manifeste
   bleiben historische Verträge und werden nicht umgedeutet.
2. Commit `d614fa08` ergänzt den eigenen Vertrag
   `DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_V1`. Er akzeptiert
   nur `EL / EL-12 / flood_zone_exclusion_or_surcharge / CONDITION`, den
   kontrollierten Concept-Search-Treffer und den lokal gebundenen Wert
   `Hochwasser-Risiko-Zone: unbekannt`. Seite, Offsets, Alias, exakter Text,
   Kontext, beide Scopehints, Contract-ID und Proof-Mode sind digestgebunden.
   HQ-/HORA-Einstufung, Deckung, Ausschluss, Zuschlag, Prämie, Selbstbehalt,
   Versicherungssumme, Limit, Bedingung und gemischte Vorkommen bleiben
   fail-closed Kandidaten. Die bestehenden Fremdspartenverträge für FE-B13,
   ST-14 und LW-25 behalten ihre eigene ID und Semantik.

Mac-Studio-Nachweise für Schritt 1:

```text
Commit: 6acad31459178bf23f2bf3c386a46b213f2c121e
Worktree: /private/tmp/pv3-validate-6acad314
Prettier: PASS
Scope-, Recall-, Renderer-, Produkt- und Runner-Suites: 202/202 PASS
Realer A-Render-Probe-Digest:
8f49c8eca26f1c1a9d05717bb37c035832f106ba3fc6c1788745196f2e9116c5
DOC-01/EL-12 vorher: TEILBELEGT, Deckung/Wert nicht feststellbar
DOC-01/EL-12 nachher: BELEGT, Deckung Ja, EUR 10.000
Pflichtfeld condition: FOUND; optionales Feld limit: FOUND
Quelle unverändert: physische PDF-Seite 10
```

Mac-Studio-Nachweise für Schritt 2:

```text
Commit: d614fa083db80bd46214e1154a05b4dbd5fb1f17
Worktree: /private/tmp/pv3-validate-d614fa08
Prettier: PASS
Prepared-, Terminal-, Paket-, Vergleichs- und Overlay-Suites: 205/205 PASS
Baseline-Paket-SHA-256:
2b390be8aa5597a9990735151b5458e023c9b561134e4c1023f5e6a765479173
Katalog: el-occurrence-full-draft-v0.7
Target-Selection-Digest:
26a9e234b79513bfa3f35bb5530d41a607da3abee1ea2042043874b284bcff67
Zehn-Dokument-Pipeline-Probe-Digest:
74e6ebe8c64b6cac29ebe07efe5bf1a4001f3cdab05d98592be548a4ba6eb23d
```

Der reale komponentengenaue Probe ergab:

```text
Paket A / DOC-01 / Seite 10:
1 Occurrence, 1 NARROW_SCOPE-Kandidat, 0 Rejects, 0 ungelöst.
Urteil: FOUND + DEFINED + NONE + NARROW_ONLY + CONDITIONAL.
Owner: SERVER_EXPLICIT_EL12_FLOOD_ZONE_CONSEQUENCE:EL:EL-12.

Paket B / DOC-02 / Seite 3:
1 Occurrence, 0 Kandidaten, 1 servereigener terminaler Reject, 0 ungelöst.
Reject-Basis: EXPLICIT_NON_CONTRACTUAL_RISK_INFORMATION.
Observed scopes: LEITUNGSWASSER_INSURANCE + STURM_INSURANCE.
Urteil: NOT_FOUND + UNKNOWN + NONE + UNKNOWN.

Übrige acht B-Dokumente:
0 Occurrences, 0 Kandidaten, unveränderte kontrollierte Nullfundlage.
```

Vergleichsgrenze: Der bestehende qualifizierte Abwesenheitsvertrag kann eine
vollständig belegte `CONDITION/DEFINED`-Seite gegen eine vollständig
kontrollierte `CONDITION_ONLY`-Abwesenheit bereits ohne Kundenreview als
`DOKUMENTATIONSUNTERSCHIED` abschließen. Er darf daraus absichtlich keinen
Vorteil ableiten. Ein späterer `VORTEIL_B` würde mindestens beidseitig belegte
Hochwassergrunddeckung, dieselbe tatsächlich anwendbare Risikozone und einen
positiv belegten besseren wirksamen B-Wert benötigen; ein B-Nichtfund reicht
dafür nicht.

Bewertung: **Pipeline-Kandidat bestanden.** Erwartet wird im späteren
konsistenten Vollvergleich
`EL-12: UNKLAR -> DOKUMENTATIONSUNTERSCHIED`. Diese Ergebnis- und
Gesamtmetrik wird bis zum echten Vollvergleich nicht als gemessene
Produktionszahl ausgewiesen. Das installierte Kundensystem blieb unverändert;
es gab kein Deployment.

#### 10.10a Forward-Fix: Folgegrenze vollständig provenance-gebunden

Die unabhängige Nachprüfung des ersten EL-12-Terminalvertrags zeigte eine
Restlücke: Der lokale Listenblock war zwar digestgebunden, der unmittelbar
folgende Absatz beziehungsweise die nächste physische Seite aber noch nicht.
Damit konnte V1 nicht beweisen, dass eine Vertragsfolge außerhalb des kleinen
Kontextfensters fehlte. Die Korrektur erfolgte ohne globale Aktivierung:

- `1e2826e0`, `66a5d4ac`, `864e44e2`, `21853e07`: generischer, aber je
  Komponente opt-in-pflichtiger Strukturgrenzbeweis;
- `7e1583a7`, `24576848`, `c364c3b2`: Behebung und adversariale Absicherung
  einer dabei sichtbar gewordenen Regex-Laufzeitfalle auf langen
  PDF-Leerraumzeilen;
- `8b4154c5`, `ddd51705`: strukturelle Fundkontexte enden an bereits
  erkannten Abschnitts- und Deckungsgrenzen; generische
  Versicherungsüberschriften bleiben strikt zeilengebunden;
- `4a38ae91`, `48206de6`, `3c05eb11`: EL-12 optiert als einzige neue
  Katalogkomponente ein. Neue Writes verwenden
  `DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_V2` und
  `CURRENT_RISK_INFORMATION_WITH_STRUCTURAL_BOUNDARY_V2`;
- `821e0b01`, `a697bf83`, `75a68050`, `13edcb34`: historische V1-Audits
  bleiben ausschließlich zusammen mit ihrem alten EL-Katalog v0.7 lesbar.
  Sie können nicht als neuer v0.8/V2-Nachweis ausgegeben oder unter einem
  aktuellen Suchplan umgedeutet werden.

V2 akzeptiert den Risikoinformationsblock nur bei gültiger vollständiger
Folgegrenze. `TOO_DISTANT`, unvollständige Provenienz, manipulierte Offsets,
eine folgende ungebundene Vertragsfolge sowie Wörter wie `Annahme`,
`Einzelprüfung`, `Rücksprache`, `Zuschlag`, `Selbstbehalt` oder `Limit` führen
fail-closed zurück in den normalen Kandidatenweg. Eine neue eindeutig
erkannte Abschnitts- oder Deckungsüberschrift bildet dagegen eine echte
Grenze und wird nicht dem vorherigen Risikoinformationsblock zugerechnet.

Mac-Studio-Nachweise:

```text
Infrastruktur-HEAD: ddd51705
Worktree: /private/tmp/pv3-validate-ddd51705
Worksheet-, Triage- und Produktvertrag: 136/136 PASS

EL-12-HEAD: 3c05eb11
Worktree: /private/tmp/pv3-validate-3c05eb11
EL-12-, Prepared-, Vergleichs-, Renderer- und Produkt-Suites: 243/243 PASS

Historische Lesekompatibilität-HEAD: 13edcb34
Worktree: /private/tmp/pv3-validate-13edcb34
Point-Decision und Result-Builder: 84/84 PASS
```

Der reale Neuaufbau ausschließlich der EL-12-Komponente aus den gespeicherten
PageMap-Quelldokumenten aller zehn Paketdokumente ergab auf `3c05eb11`:

```text
Katalog: el-occurrence-full-draft-v0.8
Probe-Digest:
65b37f9555b3577e584f4d0e51206caf0b751f25810df9f9b9f798b4b16cf5ef

DOC-01 / Seite 10:
1 echte HQ30-Vertragsbedingung, 1 Kandidat, 0 Rejects, 0 ungelöst.

DOC-02 / Seite 3 -> Seite 4:
1 Risikoinformationsblock, Folgegrenze `Mitversichert gelten`,
0 Kandidaten, 1 servereigener V2-Reject, 0 ungelöst.
Occurrence-Digest:
a2aecbbaf11f1950e7300ca2bcba2e6911fbcbab12da7aa68d3359ee2dda636f

DOC-03 bis DOC-10:
0 Occurrences, 0 Kandidaten, 0 Rejects, 0 ungelöst.
```

Damit ist die EL-12-Such- und Terminalursache komponentengenau geschlossen.
Noch nicht gemessen ist die neue 224-Zeilen-Gesamtmetrik; nach der vereinbarten
Arbeitsweise folgt der Vollvergleich erst nach Abschluss der gezielten
Fehlerfamilien. Die spätere Ergebnisregel muss zusätzlich die vom Auftraggeber
gewünschte Richtung für `Vertragsbedingung auf A / kontrollierter Nichtfund auf
B` explizit abbilden; dieser Forward-Fix erfindet diese Vergleichswertung nicht
innerhalb des Suchvertrags. Das installierte Kundensystem blieb unverändert;
es gab kein Deployment.

### 10.11 FE-C07 – Sauna/IR-Kabine: Feld- und Triage-Nachweis

Die reale Ausgangslage ist beidseitige Deckung mit unterschiedlich hohem,
aber fachlich gleich qualifiziertem Prozentlimit:

- Paket A, DOC-01, physische Seite 4: `5 %` der
  Gebäudeversicherungssumme, jeweils auf Erstes Risiko; zusätzlich ist lokal
  eine Ersatzpflicht-/Gefahrenbedingung belegt.
- Paket B, DOC-03, physische Seite 10: `10 %` derselben Bezugsgröße, ebenfalls
  jeweils auf Erstes Risiko; im lokalen Fundbereich wurde keine zusätzliche
  Bedingung gefunden.

Die Such- und Feldkorrektur wurde in `6e7fb287` umgesetzt und in `4041a650`
formatiert. Sie gilt ausschließlich für `FE-C07` und die Katalogkomponente
`sauna_or_infrared_cabin_in_common_room`. Das Pflichtfeld ist `limit`, das
optionale Diagnosefeld `condition`. Der Extraktor akzeptiert nur die beiden
belegten lokalen Syntaxfamilien und bindet Werte ausschließlich an die
servereigene Kandidatenquelle. Fremde Prozentwerte, entfernte Listengovernor,
abweichende Bezugsgrößen und manipulierte Provenienz bleiben fail-closed.

Mac-Studio-Vertragsnachweis:

```text
Commit: 4041a650fec793ed132618c63b9593eeb0fb87f3
Worktree: /private/tmp/pv3-validate-4041a650
Prettier: PASS
Requested-Field-, FE-Recall-, Worksheet-, Prepared-, Result- und
Produktvertrag-Suites: 244/244 PASS
```

Der anschließende komponentengenaue Neuaufbau aus den gespeicherten
PageMap-Quelldokumenten und die echte Candidate-Triage ergaben:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/FE-C07-TARGETED-4041A650-V2-20260902
Katalog: fe-occurrence-full-draft-v0.7
Target-Selection-Digest:
ffb5d6e64686be09cb6526c6f5eb62c3b77f4eebb45a4873476c8842a391c418
Summary-Digest:
9891e7d048191d2b290300eea1d9b7df6cb884992e7a79dec7adb070f0c219dd
Modellkonfiguration: qwen/qwen3.6-35b-a3b, Kontext 42496

DOC-01: 1 Ziel, DIRECT, Pflichtfeldstatus COMPLETE
limit: FOUND, 5 %, PERCENT, CAPPED, Offsets 6078–6080
condition: FOUND, Offsets 5892–6055

DOC-03: 1 Ziel, DIRECT, Pflichtfeldstatus COMPLETE
limit: FOUND, 10 %, PERCENT, CAPPED, Offsets 28401–28404
condition: NOT_FOUND

Tatsächliche Qwen-Aufrufe: 0
```

Die null Modellaufrufe sind kein ausgelassener Prüfschritt: Bei beiden Zielen
waren Rollen- und Scopeentscheidung bereits vollständig servereigen. Der
Triagevertrag leitete deshalb `DIRECT` deterministisch ab; ein Modellurteil
wäre weder nötig noch zulässig gewesen. Das Artefakt ist ein
komponentengenauer Pipeline-Probe mit versioniertem FE-v0.7-Katalog und
digestgebundener Zielauswahl, aber keine neue 224-Zeilen-Gesamtmetrik. Eine
vorangegangene technisch inhaltsgleiche Minimalprobe ohne
`targetRequirementSelection` bleibt als Vorlauf erhalten, gilt aber
ausdrücklich nicht als revisionssicherer Nachweis und wird hier nicht als
Abnahmegrundlage verwendet.

Damit waren Suche, Triage und Pflichtfeldbindung für die beiden echten Funde
geschlossen. Der damals noch offene Fehler lag ausschließlich in der
Vergleichsregel: Die allgemeine Logik sortierte Zahlen nur bei `LIMIT`- oder
`DEDUCTIBLE`-Atomen und blockierte bedingte Deckungsquellen.

#### 10.11.1 Zertifizierter Bedingungs-Nichtfund

Die folgenden kleinen Commits schließen die lokale Bedingungsprüfung, ohne
den allgemeinen Nichtfundvertrag aufzuweichen:

```text
697f9d99 feat(analysis): certify FE-C07 clause condition absence
29781432 style(analysis): format FE-C07 absence audit
2a0da4cc fix(analysis): accept FE-C07 unrelated lighting exclusion
```

Der neue Audit gilt nur für `FE-C07`. Er verlangt einen vollständigen,
absatzlokalen und bejahenden Sauna-/Infrarotkabinen-Vertragssatz, dieselbe
Objektbindung, genau einen qualifizierten Prozentwert, eine eindeutige
Bezugsgröße und keine zusätzliche Bedingung oder Referenz im geprüften
Klauselbereich. Die Formulierung `ausgenommen Beleuchtungskörper` wird nur
deshalb zugelassen, weil sie nachweislich ein anderes Objekt ausschließt; sie
darf weder als Sauna-Bedingung noch als allgemeine Freigabe interpretiert
werden.

Mac-Studio-Nachweis:

```text
Worktree: /private/tmp/pv3-validate-2a0da4cc
Relevante Tests: 172/172 PASS

QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/FE-C07-ABSENCE-AUDIT-2A0DA4CC-20260902
Summary-Digest:
8f73a22b33a58153b0b9c1630d2be2d6fc1c810a6bbe40edff15e76e6464927a

DOC-01: 5 %, condition FOUND, kein Nichtfund-Audit
DOC-03: 10 %, condition NOT_FOUND, gültiger Nichtfund-Audit
DOC-03 Klauselbereich: 28307–29016
DOC-03 Klausel-Digest:
43da5de1763793cd6e9553bf44abdcf3df59bb02da34a7e49539f48c81c2c4bb
```

Die generische Diagnose `comparisonConditionalOrOptional: true` auf DOC-03
stammte aus dem breiten generischen Bedingungsfenster und der dort enthaltenen
Beleuchtungskörper-Ausnahme. Der spezialisierte Vollklausel-Audit grenzt diesen
Hinweis korrekt auf das andere Objekt ein. Die generische Diagnose wurde nicht
global abgeschwächt.

#### 10.11.2 Enger Prozentlimit-Vergleich und Provenienzbindung

Der gerichtete Vergleich wurde anschließend komponentengenau ergänzt und nach
einem adversarialen Review weiter verschärft:

```text
3401a4c8 feat(comparison): rank certified FE-C07 percentage limits
798ba9cc style(comparison): format FE-C07 dominance contract
8af63c54 fix(comparison): bind FE-C07 limits to audited clauses
94d58167 style(test): format FE-C07 provenance cases
d4362984 fix(comparison): fail closed on invalid FE-C07 limits
8ca0da2f style(comparison): format FE-C07 null guard
6d9173ec test(comparison): expose FE-C07 atom materialization proof
222606a9 style(test): format FE-C07 atom proof
```

Der Vertrag `FE_C07_HIGHER_UNCONDITIONED_PERCENT_LIMIT_V1` entscheidet nur,
wenn beide Seiten genau einen kanonischen Kandidaten besitzen, dieselbe
Komponente, Deckungswirkung, Bezugsgröße und First-Risk-Qualifikation belegt
sind und der höhere Prozentwert direkt an den vollständig auditierten
Klauselbereich gebunden ist. Kandidat, Seite, Textspanne, exakter Prozenttext,
typisierter Wert und Klauselwert müssen übereinstimmen. Fremdwerte,
seitenübergreifende oder kandidatenübergreifende Bindungen, zusätzliche Marker
auf der höheren Seite sowie manipulierte Audits scheitern geschlossen.

Mac-Studio-Nachweise:

```text
Worktree: /private/tmp/pv3-validate-8ca0da2f
Vergleichs-, Provenienz- und angrenzende Tests: 232/232 PASS

Worktree: /private/tmp/pv3-validate-222606a9
Zusätzlicher Atom-Materialisierungsnachweis: 233/233 PASS
```

Der zusätzliche Produktionsgrenzentest beweist, dass ein gültiger Audit in das
tatsächlich verglichene Atom übernommen und ein manipulierter Audit bereits
bei der Materialisierung entfernt wird.

#### 10.11.3 Echtes gezieltes End-to-End-Ergebnis

Der reale Neuaufbau verwendete die versioniert ausgewählten FE-C07-Ziele, die
offizielle Candidate-Triage, die offizielle Prepared-Evidence-Auswertung, die
tatsächliche Tabellen- und Atommaterialisierung sowie `decidePoint`:

```text
Produzent fachlicher Effekte:
8ca0da2fba66c817879a625925ed84bc127910ab
Entscheidungs-/Grenztest-Commit:
222606a9aae14cf8db8d7d8f4a0fdee61d7a83c6

QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/FE-C07-E2E-8CA0DA2F-20260902
Ursprüngliches Entscheidungsartefakt:
decision-222606a9/summary.private.json
Korrigierter Entscheidungs-Replay:
replay-347cd39c/summary.private.json
Replay-/Validierungscommit:
347cd39c466698239a0e433dea8f256f440f570d
Target-Selection-Digest:
ffb5d6e64686be09cb6526c6f5eb62c3b77f4eebb45a4873476c8842a391c418
Korrigierter Replay-Digest:
bea08f310d83bf81c7e464a5fb10ea974819b9ac1368a0033003fdf5110ed510

DOC-01: BELEGT, INCLUDED, GENERAL, COMPLETE, 5 %, condition FOUND
DOC-03: BELEGT, INCLUDED, GENERAL, COMPLETE, 10 %, condition NOT_FOUND,
        gültiger Klausel-Nichtfund-Audit
Paketstatus A/B: BELEGT / BELEGT
Entscheidung: VORTEIL_B
Review erforderlich: nein
Regel: FE_C07_HIGHER_UNCONDITIONED_PERCENT_LIMIT_V1
Tatsächliche Qwen-Aufrufe: 0
```

Provenienzkorrektur: Das ursprüngliche Summary enthielt zwar die oben erneut
reproduzierte Entscheidung, aber zwei nicht auflösbare ausgeschriebene
40-stellige Commit-SHAs. Die achtstelligen Präfixe waren richtig; ihre
ausgeschriebenen Fortsetzungen waren falsch. Deshalb gilt der ursprüngliche
Summary-Digest
`7cc244d89721199cdc888d517a84af77682549122e7ecd899dd457462c4ade8f`
nicht als Commit-Provenienznachweis. Der neue Replay wurde im isolierten
Mac-Studio-Worktree `/private/tmp/pv3-validate-347cd39c` ausgeführt. Er bindet
die Rohbytehashes beider gespeicherten Dokument-/Atomartefakte, löst alle drei
angegebenen Commits als echte Git-Objekte auf und rekonstruiert mit dem
tatsächlichen `decidePoint` erneut exakt `VORTEIL_B`, `reviewRequired: false`
und dieselbe Regel. Sein Digest wurde anschließend in einem getrennten Prozess
neu berechnet und die Datei mit Modus `0600` geprüft.

Damit ist für den gezielten Fall revisionssicher belegt:

```text
FE-C07: UNKLAR -> VORTEIL_B
```

Das ist noch keine neue 224-Zeilen-Gesamtmetrik. Der vereinbarte Vollvergleich
folgt erst nach Abschluss der gezielten Fehlerfamilien. Als beobachtete, aber
für diesen normalen In-Process-Entscheidungsweg nicht blockierende
Härtungsgrenze bleibt: `customerMetricContract` rekonstruiert den
FE-C07-Vergleichsaudit nach der Materialisierung nicht nochmals unabhängig.
Eine spätere Härtung muss dafür einen allgemeinen, nicht FE-spezifisch
duplizierten Auditvertrag verwenden. Das installierte Kundensystem blieb
unverändert; es gab kein Deployment.

### 10.12 EL-11 – Elementar-Selbstbehalt: echter beidseitiger Wertfund

Die Baseline war kein Alias- oder Recallfehler. Sie enthielt sechs
`Erdbeben`-Occurrences in den zehn Dokumenten, verwarf aber den echten
Selbstbehalt des Pakets B fälschlich als bloße Erwähnung:

- Paket A, DOC-01, physische Seite 10: `€ 350,- pro Schadenfall`;
- Paket B, DOC-02, physische Seite 4: `Selbstbehalt EUR 350,00` im positiv
  regierten Erdbeben-Listeneintrag;
- drei weitere B-Vorkommen auf Seite 19 sind Definitionen oder
  Kumulereignistext ohne lokalen Selbstbehalt;
- das B-Vorkommen in DOC-09 steht in einer Leitungswasserausschlussklausel und
  ist ebenfalls kein Elementar-Selbstbehalt.

Der bereits vor dieser Einzelabnahme implementierte Vertrag
`EXPLICIT_PERIL_DEDUCTIBLE_SCHEDULE_ITEM_V1` stammt aus diesen Commits:

```text
2f7b1cbf fix(analysis): bind explicit EL-11 deductible schedule
569b109b test(analysis): preserve EL-11 source provenance assertion
```

Er gilt nur für `EL-11 / elemental_deductible / DEDUCTIBLE`, verlangt einen
positiv regierten strukturierten Listeneintrag im Elementar- oder Sturmscope,
genau einen Selbstbehaltsmarker und genau einen lokal daran gebundenen Geld-
oder Prozentwert. Negation, Optionalität, Mehrprämie, mehrere Werte und fremde
Sparten bleiben ausgeschlossen. Die Semikolongrenze verhindert konkret, dass
die im selben B-Listeneintrag genannte Jahreshöchstentschädigung von
`EUR 20.000,00` als Selbstbehalt übernommen wird.

Mac-Studio-Regression auf dem aktuellen Quellstand:

```text
Validierungscommit: 347cd39c466698239a0e433dea8f256f440f570d
Worktree: /private/tmp/pv3-validate-347cd39c
Relevante Analyse-, Feld-, Result- und Vergleichssuites: 337/337 PASS
```

Der erste offizielle Recall-Audit unter
`EL-11-RECALL-347CD39C-20260902` wurde erwartungsgemäß mit `FAILED` beendet.
Das ist kein EL-11-Fachfehler: Dieser historische Guard akzeptiert gegenüber
der v0.6-Baseline ausschließlich eine einzige geänderte Anforderung. Der
aktuelle EL-v0.8-Katalog enthält inzwischen mehrere andere bereits
dokumentierte Korrekturen, insbesondere EL-12. Das historische v0.6-Manifest
wurde deshalb nicht umgeschrieben oder gelockert.

Stattdessen wurde ein neuer Ein-Zeilen-Targetvertrag aus dem aktuellen
EL-v0.8-Katalog erzeugt und auf allen zehn exakt gebundenen
Baseline-Dokumentartefakten ausgeführt:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/EL-11-E2E-347CD39C-20260902
Katalog: el-occurrence-full-draft-v0.8
Target-Selection-Digest:
a2ab297de748cd5fabd129aff1366a11bf714c156ad64f1659617f8c10db773f
Entscheidungsartefakt:
decision-347cd39c/summary.private.json
Summary-Digest:
d64a6cd8e8ee96dc795a418f20279f93f406b61d20e88a73366fed435827fcb1

Dokumente: 10/10
Rohoccurrences: 6
Triage: 10/10 TECHNICAL_PASS_REVIEW_REQUIRED
Prepared Evidence: 10/10 TECHNICAL_PASS_REVIEW_REQUIRED
Tatsächliche Triage-Modellaufrufe: 0
Tatsächliche Evidence-Modellaufrufe: 0

Paket A: BELEGT / Ja / EUR 350 je Schadenfall
Paket B: BELEGT / Ja / EUR 350,00
Entscheidung: NICHT_VERGLEICHBAR
Review erforderlich: nein
Regel: ATOMIC_COMPARABILITY_GATE_V1
```

Der Summary-Digest wurde in einem getrennten Prozess erneut berechnet, die
Datei als `0600` geprüft und beide angegebenen Git-Commits als echte Objekte
aufgelöst. Das gezielte, belegbare Delta lautet daher:

```text
EL-11: UNKLAR / MISSING_ONE_SIDE / Review
    -> NICHT_VERGLEICHBAR / COMPARABILITY_GATE_FAILED / kein Review
```

`GLEICHWERTIG` wäre mit den vorhandenen Dokumenten eine zusätzliche fachliche
Annahme: Nur A nennt ausdrücklich den Bezugsqualifier `je Schadenfall`. B
dokumentiert denselben Betrag, aber keinen Bezugsqualifier. Der Wertfund ist
damit repariert und vollständig sichtbar; die Vergleichslogik erfindet B den
fehlenden Qualifier nicht. Eine spätere Fachfreigabe könnte dafür einen eigenen
versionierten Vergleichsvertrag definieren, darf aber nicht durch globale
Qualifier-Ignorierung ersetzt werden. Das ist noch keine neue
224-Zeilen-Gesamtmetrik. Das installierte Kundensystem blieb unverändert; es
gab kein Deployment.

### 10.13 FE-C12 – Gerüstdeckung versus Gerüstkosten nach Glasbruch

#### 10.13.1 Fehlerursache und enger Vertrag

Der Vorherlauf enthielt in `scaffolding` drei Rohoccurrences:

```text
DOC-01, Seite 15: Kosten für Gerüste zur Ersatzausführung
DOC-03, Seite 14: Gerüst- und Krankosten nach einem Glasschaden
DOC-10, Seite 7: Kosten für notwendige Gerüste bei der Glasreparatur
```

Alle drei Stellen belegen Kosten für ein Hilfsgerüst nach einem Glasschaden,
nicht das gesuchte versicherte Objekt `Gerüst` während einer Sanierung.
`site_equipment` und `renovation_scope` besitzen in allen zehn Dokumenten null
Occurrences. Der konkrete Vorherfehler war, dass die scope-lose lokale
DOC-10-Klausel als positive Objektdeckung materialisiert wurde. Dadurch
entstand künstlich `MISSING_ONE_SIDE`.

Die Korrektur ist ausschließlich an
`FE / FE-C12 / scaffolding / INSURED_OBJECT / COVERAGE_MIXED` gebunden:

```text
Binding-Basis:
POST_LOSS_GLASS_REPAIR_SCAFFOLDING_COST_NOT_INSURED_OBJECT
Terminalvertrag:
DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_V1
Scope-Proof:
OCCURRENCE_LOCAL_POST_LOSS_GLASS_REPAIR_COST_V1
Terminal-Gate:
deterministicPostLossScaffoldingCostTerminal
```

Der Vertrag verlangt eine quellenexakte Occurrence, gültige Offsets, Seite,
Candidate-ID und eine lokale Kostenrolle. Er akzeptiert entweder einen
aktuellen Glasbruchabschnitt oder die nachweisbar lokale scope-lose
Glas-Reparaturklausel von DOC-10. Echte Gerüstdeckung während Sanierung,
Baustelleneinrichtung, Negation, Optionalität, Mehrprämie, gemischte Klauseln,
unvollständige Offsets sowie fremde oder geerbte Scopes bleiben fail-closed.
Der ResultBuilder rekonstruiert den semantischen Proof erneut aus der
Occurrence; ein gemeinsam manipulierter Worksheet-Text und neu berechneter
Hash reicht nicht aus.

Produkt- und Implementierungscommits:

```text
99647cbf fix(analysis): reject FE-C12 post-loss scaffold costs
b60fa978 style(analysis): format FE-C12 terminal proof
43fb9cc9 fix(analysis): preserve scope-less FE-C12 proof
```

Weil sich die vertrauenswürdige kundenrelevante Entscheidungssemantik ändert,
wurde das Produktprofil auf
`CUSTOMER_CORE_5_V22_FE_C12_POST_LOSS_SCAFFOLDING_TERMINAL` erhöht. Der
FE-Katalog bleibt unverändert `fe-occurrence-full-draft-v0.7`; Alias,
Komponenten und Suchvertrag wurden nicht gelockert.

#### 10.13.2 Mac-Studio-Regression

```text
Commit: 43fb9cc9b889c80d17a65a3a090009d3b88f4c0c
Worktree: /private/tmp/pv3-validate-43fb9cc9
Formatprüfung: PASS
Fokussierte Suites: 6/6 PASS
Fokussierte Tests: 193/193 PASS
Breite Regression: 42 Suites und 873 Tests PASS
```

Vier weitere Suites mit 25 Tests scheitern mit historischen Fixturefehlern.
Sie wurden zusätzlich unverändert auf dem Vorhercommit
`347cd39c466698239a0e433dea8f256f440f570d` ausgeführt und scheitern dort mit
denselben 25 Fehlern:

- das historische Target-QA-Manifest bindet eine ältere FE-Katalogversion;
- eine statische Verteilung erwartet noch `25 COVERAGE_MIXED` und
  `91 COVERAGE_ONLY`, obwohl der bereits vorher aktuelle Katalog `24` und
  `92` enthält.

Die historischen Verträge wurden nicht umgeschrieben oder gelockert. Der
FE-C12-Fix erzeugt gegenüber dem Vorhercommit keine zusätzliche breite
Regression.

#### 10.13.3 Echter gezielter Zehn-Dokument-Lauf

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/FE-C12-AFTER-43FB9CC9-20260902
Target-Selection-Digest:
05cfcc56fa63a086c5beb44e3557810c42d27a1afc804905bf8d1ada9c0c8dff
Entscheidungsartefakt:
decision-43fb9cc9/summary.private.json
Summary-Digest:
92b2fd87446a3d83e278714820f59433768b0021c2bfc2ac9225e4e8d819987d
```

Der Lauf bindet alle zehn Dokumente und denselben FE-C12-Suchvertrag wie der
Vorherlauf:

```text
Triage: 10/10 formal PASS
Prepared Evidence: 10/10 formal PASS
Triage-Qwen-Aufrufe: 0
Evidence-Qwen-Aufrufe: 0
Triage-Serverterminals: 3
Evidence-Serverterminals: 30/30 Komponenten
DOC-01: CURRENT_PAGE_HEADING / GLASBRUCH_INSURANCE
DOC-03: CURRENT_PAGE_HEADING / GLASBRUCH_INSURANCE
DOC-10: OCCURRENCE_LOCAL_CLAUSE / leerer Heading-Scope
```

Die tatsächlichen produktiven Atom-, Paketzusammenfassungs- und
`decidePoint`-Funktionen ergeben:

```text
Paket A: vollständige kontrollierte Suche, keine passende Vertragsregelung
Paket B: vollständige kontrollierte Suche, keine passende Vertragsregelung
Entscheidung: GLEICHWERTIG
Reason: EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH
Review erforderlich: nein
Regel: EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1
```

Die Summary-Datei besitzt Modus `0600`. Ihr SHA-256 wurde in einem getrennten
Prozess erneut berechnet. Derselbe getrennte Prozess löste den Commit als
echtes Git-Objekt auf, prüfte den Hash des transienten Produzentenskripts und
rekonstruierte aus allen zehn gespeicherten Atomartefakten mit dem produktiven
`decidePoint` erneut exakt `GLEICHWERTIG`, `reviewRequired: false` und dieselbe
Regel.

Das revisionssicher belegte Delta lautet:

```text
FE-C12: UNKLAR / MISSING_ONE_SIDE / Review
     -> GLEICHWERTIG / EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH / kein Review
```

Dies behauptet nicht, dass beide Pakete eine Gerüstdeckung enthalten. Es
behauptet die nach vollständiger kontrollierter Suche gleiche dokumentierte
Fundlage: In beiden Paketen wurde für den dreiteiligen FE-C12-Vertrag keine
passende Sanierungs-Gerüstregelung gefunden. Unter Einbeziehung aller bisher
akzeptierten gezielten Deltas würde die noch unbestätigte Projektion von
`Gleichwertig 114 / Unklar 65` auf `Gleichwertig 115 / Unklar 64` wechseln.
Das ist ausdrücklich keine neue 224-Zeilen-Gesamtmetrik. Ein voller
224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der installierte
Kundenstand blieb unverändert.

### 10.14 LW-20 Schritt A – Fremdrollen terminal trennen, echten Ausschluss erhalten

#### 10.14.1 Fehlerbild und enger semantischer Vertrag

Die aktuelle LW-v0.8-Suche findet über alle zehn Dokumente genau fünf
Occurrences für `LW-20 / ground_seepage_or_retained_water / PERIL`:

```text
DOC-01, Seite 22: Behandlungskosten für nicht versicherte Sachen,
                  darunter Wasser inklusive Grundwasser
DOC-02, Seite 20: zwei Grundwasserstellen im Sturm-/Niederschlagswasserscope
DOC-08, Seite 2:  eine Grundwasserstelle im Sturmversicherungsscope
DOC-09, Seite 2:  ausdrücklicher Ausschluss durch Grundwasser in den
                  Leitungswasserbedingungen
```

DOC-01 benennt Grundwasser als zu behandelnden Stoff nach einem Schaden, nicht
als versicherte oder ausgeschlossene Gefahr. Die drei Stellen in DOC-02 und
DOC-08 sind auf die Sturmversicherung begrenzt und beantworten LW-20 nicht.
Nur DOC-09 ist eine echte Leitungswasserregelung und muss als `EXCLUDED`
erhalten bleiben. Alias-Recall oder ein zusätzliches Modell waren deshalb
nicht das Problem; die fehlende terminale Provenienz der vier bereits richtig
als `MENTION_ONLY` erkannten Fremdstellen blockierte den Paketrollup.

Der neue Vertrag ist ausschließlich an
`LW / LW-20 / ground_seepage_or_retained_water / PERIL / COVERAGE_ONLY`
gebunden:

```text
Terminalvertrag:
DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_V1
Entscheidungsbasis:
LW20_NON_TARGET_GROUNDWATER_OCCURRENCE
Scope-Proof:
LW20_LOCAL_ROLE_OR_STORM_SCOPE_V1
Terminal-Gate:
deterministicLw20NonTargetOccurrenceTerminal
```

Akzeptiert werden nur zwei eng nachprüfbare Fremdrollen:

1. ein scope-loser Absatz über Behandlungskosten nicht versicherter Sachen mit
   Wasser inklusive Grundwasser, Luft und Erdreich und ohne lokale Formulierung
   `Schäden durch Grundwasser`;
2. eine Grundwasserschaden- oder -ausschlussstelle unter einem exakt aktuellen
   Sturmheading oder einem Heading der unmittelbar vorhergehenden physischen
   Seite.

Quellenoffset, exakter Alias, physische Seite, Candidate-ID, Scopequelle,
Scope-Key und Occurrence-Digest sind gebunden. Leitungswasserscope,
Rohrbruch-/Rohrgebrechenbezug, größere Seitendistanz, falsche Seite, falsche
Offsets, positive, negative, optionale und gemischte echte LW-Regelungen
bleiben fail-closed. Der ResultBuilder rekonstruiert Text- und Scope-Proof aus
der Occurrence erneut. Für diesen Vertrag ist ausschließlich Provenienzschema
V3 zulässig; ein V2-Downgrade wird verworfen.

Produkt- und Testcommits:

```text
d670652e fix(analysis): certify LW-20 non-target occurrences
72a8d77f style(analysis): format LW-20 terminal proof
dd1d599d test(analysis): assert LW-20 audit blocker codes
```

Das Produktprofil wurde auf
`CUSTOMER_CORE_5_V23_LW20_NON_TARGET_TERMINAL` erhöht. Katalog, Aliasfamilie,
Komponentenvertrag und Suchstrategie bleiben unverändert LW v0.8.

#### 10.14.2 Mac-Studio-Regression

```text
Commit: dd1d599deab4fd6389ca9f9fbc5b8384a5dad377
Worktree: /private/tmp/pv3-validate-dd1d599d
Formatprüfung: PASS
Fokussierte Suites: 8/8 PASS
Fokussierte Tests: 276/276 PASS
Breite Regression: 46 Suites und 894 Tests PASS
```

Vier weitere breite Suites mit 25 Tests besitzen dieselben bereits vor LW-20
protokollierten historischen Fixturefehler:

- drei Target-QA-/Worksheet-Manifests erwarten eine ältere FE-Katalogbindung;
- die statische Bedeutungsverteilung erwartet noch `25 COVERAGE_MIXED` und
  `91 COVERAGE_ONLY` statt der bereits vorher aktuellen `24` und `92`.

Dateien, Fehlerzahl und Fehlersignaturen entsprechen dem dokumentierten
Vorherlauf; LW-20 erzeugt keine neue breite Regression.

#### 10.14.3 Echter gezielter Zehn-Dokument-Lauf und unabhängiger Replay

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LW-20-AFTER-DD1D599D-20260902
Target-Selection-Digest:
aca3828b4d208c20b8f932311e4ec13011f006bb636e58575fa88d2c9507c718
Summary:
summary.private.json
Summary-Digest:
1f4331d9ff861b2133de79f84ad7b6f5d34b688e27d4322774f113e913757efd
Produzentenskript-Digest:
9dc2f286691fc0323228a906949cdeaa432028f2bcf4b18da6228392d7c7e0b5
```

Der Lauf erzeugte aus den unveränderten zehn PAV8-Dokumentartefakten neue
Ein-Zeilen-Worksheets mit dem aktuellen
`lw-occurrence-full-draft-v0.8`-Vertrag. Alle zehn Triage- und alle zehn
Prepared-Evidence-Phasen bestanden formal. Es gab null Triage- und null
Evidence-Qwen-Aufrufe.

Der getrennte Replay-Prozess prüfte Dateimodus `0600`, den auflösbaren Commit,
den Produzentenskript-Hash, alle Dokument-, Worksheet-, Triage-, Effects- und
Target-Hashes sowie alle technischen Gates. Danach rekonstruierte er mit den
produktiven Funktionen erneut Atome, Paketzusammenfassungen und `decidePoint`.
Seine reale Occurrence-Matrix lautet:

```text
Rohoccurrences: 5
Terminal verworfen: 4
Terminal-Dokumente: DOC-01, DOC-02, DOC-08
Terminalseiten: DOC-01 S.22; DOC-02 S.20 zweimal; DOC-08 S.2
Ausgewählte relevante Kandidaten: 1
Ausgewähltes Dokument: DOC-09, S.2
Wirkung DOC-09: EXCLUDED
```

Die produktive Paketentscheidung lautet:

```text
Paket A: vollständiger kontrollierter Nichtfund
Paket B: ausdrücklicher Ausschluss durch Grundwasser
Entscheidung: DOKUMENTATIONSUNTERSCHIED
Reason: QUALIFIED_SEARCH_DOCUMENTATION_DIFFERENCE
Regel: QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V2
Review erforderlich: nein
```

Das revisionssicher belegte Schritt-A-Delta ist damit:

```text
LW-20: UNKLAR / MISSING_ONE_SIDE / Review
    -> DOKUMENTATIONSUNTERSCHIED / QUALIFIED_SEARCH_DOCUMENTATION_DIFFERENCE
       / kein Review
```

Unter Einbeziehung aller bisher akzeptierten gezielten Deltas verschiebt sich
die weiterhin unbestätigte Projektion von
`Dokumentationsunterschied 33 / Unklar 64` auf
`Dokumentationsunterschied 34 / Unklar 63`. Das ist keine neue
224-Zeilen-Gesamtmetrik.

Schritt B bleibt absichtlich ein eigener Fix: Nach der vom Benutzer
festgelegten Vergleichssemantik können ein kontrolliert fundloses Paket und
ein Paket mit ausdrücklichem, paketweit nicht aufgehobenem Ausschluss beide
als `nicht gedeckt` und damit als `GLEICHWERTIG` bewertet werden. Dafür ist ein
eigener versionierter, zeilenspezifischer Vergleichsvertrag mit
Override-/Konfliktprüfung nötig. Eine globale Gleichsetzung von `NOT_FOUND`
und `EXCLUDED` ist verboten, weil sie bei unvollständiger Suche oder späterer
positiver Ersatzregel falsche Gleichheit erzeugen würde.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

### 10.52 FE-C02 – Vorteilsentscheidung und Auslassungsschutz vollständig

#### 10.52.1 Ergebnis und unveränderte fachliche Grenze

Der side-neutrale Bedingungsumfang-Audit ist nun als Punktentscheidung
freigegeben. Bei vollständig gebundener Direktformel auf einer Seite und
vollständig gebundener Membership-Formel auf der Gegenseite gewinnt nur die
Seite mit dem logisch strikt breiteren vertraglichen Voraussetzungsscope.
Dokumentrolle und Dokumentstatus bleiben Provenienz; sie entscheiden den
Gewinner nicht.

Für die reale FE-C02-Zeile gilt:

```text
A: direkte allgemeine Photovoltaik-Formel, Paketstatus BELEGT
B: Membership über EABS@2023, Paketstatus TEILBELEGT
Formelrelation: B impliziert A; A impliziert B nicht
Gültige Boolesche Belegungen: 48
Ergebnis: VORTEIL_A
Review erforderlich: nein
```

Der Kundentext bewertet ausschließlich die Breite der Vertragsbedingungen.
Er behauptet weder einen ausdrücklichen Ausschluss in B noch eine konkrete
Nichterfüllung der dort genannten Eigentums-, Wiederherstellungs- oder
Neuwertbedingungen.

#### 10.52.2 Geschlossene Replay- und Omission-Lücke

Der erste Entscheidungsstand validierte eine vorhandene FE-C02-Entscheidung,
konnte aber ihre vollständige Auslassung nicht erkennen: Der private
Atomdigest wurde nur geschrieben, wenn `decidePoint()` die Spezialregel bereits
gewählt hatte. Schema 13 beseitigt diese zirkuläre Kontrollannahme.

`MEMBERSHIP_CONDITION_SCOPE_QUALIFICATION_REPLAY_V2` wird für jede FE-C02-Zeile
unabhängig vom gewählten Ergebnis erzeugt. Er enthält privat die stabil
sortierten vollständigen Atomprojektionen beider Seiten und bindet:

- Kategorie `FE:FE-C02` und Komponente
  `photovoltaic_as_damaged_object`;
- den kanonischen Vergleichsvertrag;
- den normalisierten Worksheet-Requirement-Digest `e81f4780…`;
- Dokument-UUID, Seite, Rolle, Status und PDF-SHA je Paket;
- beide Atomprojektionsdigests und den Gesamtreplay-Digest.

Der Customer-Validator rekonstruiert den Audit ausschließlich aus Replay,
Paketdaten, Dokumentmanifest und serverseitigem Katalogvertrag. Ist der Audit
entscheidungsreif, muss die exakte Spezialentscheidung vorhanden sein. Ein
alter generischer Paket-Review, ein fehlender Replay, ein Replay auf einer
anderen Kategorie, Atom-Tamper oder ein selbst neu gehashter fremder Vertrag
werden fail-closed abgewiesen. Kundenansicht, Markdown und XLSX enthalten den
privaten Voll-Replay nicht.

#### 10.52.3 Reale Digest-Abweichung und Forward-Fix

Der erste reale Schema-13-Lauf schloss alle zehn LLM-/Evidenzphasen ab, stoppte
aber korrekt vor dem Kundenergebnis mit `QUALIFICATION_REPLAY_MISSING`. Die
Diagnose zeigte keine Inkonsistenz der Dokumente:

```text
Atome: 10/10 dokument- und fingerprintgebunden
Vergleichsvertrag: 10/10 identisch
Atom-Requirement-Digest: 10/10 e81f47807371f1d565d66c1943e040066d982a9c271e18426926766502e27b5c
Irrtümlich erwarteter Rohkatalog-Digest: 4a4dd38996b2e926f5358e2916e753b221a00fd8e58a9de572483787c76cd446
```

Der Rohkatalog und das validierte Worksheet liegen absichtlich in
unterschiedlichen Digest-Domänen: Die Worksheet-Validierung ergänzt Defaults
und kanonisiert Alias-, Prädikat- und Formelarrays. Eine globale Digestmigration
wäre riskant und fachlich unnötig gewesen. `b40405e63` bindet deshalb das
Produktprofil an den tatsächlich produktiven normalisierten Digest `e81f…`.
`d69130b6e` verlangt denselben Trust-Anchor bereits bei der Auditbildung, damit
auch ein direkter `decidePoint()`-Aufruf keinen auf beiden Seiten identischen
Fremd-Digest akzeptiert.

#### 10.52.4 Commits und Mac-Studio-Validierung

```text
6a64a5357 feat(comparison): decide broader FE-C02 condition scope
35c299862 style(comparison): format FE-C02 scope decision
b7acb4f2f fix(comparison): require FE-C02 qualification replay
ff597c227 style(comparison): format FE-C02 qualification replay
46ddda645 test(comparison): harden FE-C02 qualification replay
daac8477a style(test): format FE-C02 replay hardening
b40405e63 fix(comparison): bind FE-C02 normalized requirement digest
e13a81f16 style(comparison): format FE-C02 digest binding
d69130b6e fix(comparison): enforce FE-C02 audit trust anchor
6df8f3b06 style(comparison): format FE-C02 trust anchor
```

Finaler Gate:

```text
Commit: 6df8f3b069dfde9cf68d05c4238ebaa7046d551e
Mac-Studio-Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Runtime: QWEN36-FULL-20260831-7ab999c6/repo
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Format: PASS
CommonJS-Load-Reihenfolgen: 2/2 PASS
Fokussierte Suites: 6/6 PASS
Fokussierte Tests: 185/185 PASS
```

Finales revisionsgebundenes Artefakt:

```text
Pfad: QA/FE-C02-QUALIFICATION-REPLAY-6DF8F3B0-20260903
Summary: 62a2fd833ae33bb786dc52d395840c9e0aa49d046914a1b649039bb2b0feabe4
Customer Validation: d4093178ca685e499a292d96d8381af6b98ec578e269d474fe680685396ea047
Omission Validation: 3adb2de22d8f5878997048092db4709cc5846161b1005b055b97360d67d7fa99
Target Selection: cdf7f6e9946923eae3f1ce412290249faaafa9e98282afaa8627befa8f4084aa
Qualification Replay: 841c122fe316d52af9c83ca0225eeafe266a58451c3c8b6088b65ce877dd0197
Condition-Scope Audit: 641f6fc1952fe999272e8779694fc0eb15c51347f8a91f9f356552965322d0fc
Aufrufe: 2 Triage / 0 Effects
Server: 4 Triage-Rejects / 8 Evidence-Terminals
Kundenmetrik: 1 VORTEIL_A / 0 UNKLAR / 0 Review
```

Der finale Replay verwendete die zehn unmittelbar zuvor unter `daac8477a`
persistierten und vollständig gehashten Dokument-/Triage-/Evidence-Records
erneut. Zwischen `daac8477a` und `6df8f3b06` änderten sich ausschließlich der
Requirement-Trust-Anchor und dessen Auditprüfung; Suche, Modellprompts,
Materialisierung und Evidenz blieben unverändert. Dadurch wurden keine teuren
Modellaufrufe wiederholt, ohne die Bindung des finalen Ergebnisses an den
finalen Commit zu verlieren.

Delta zum bisherigen guten Entscheidungsartefakt
`FE-C02-CONDITION-SCOPE-DECISION-35C29986-20260903`:

```text
Fachentscheidung: unverändert VORTEIL_A
Review: unverändert nein
Paketstatus: unverändert A BELEGT / B TEILBELEGT
Audit-Digest: unverändert 641f6fc1…
Triage-/Effects-Aufrufe: unverändert 2 / 0
Neu: auslassungssicherer privater Qualification-Replay
Neu: real belegte Ablehnung von generischem Review-Ersatz und fehlendem Replay
```

Die vollständige 224-Zeilen-Metrik wurde nicht neu berechnet. Es gab keinen
Vollrun, kein Deployment und keine Änderung des installierten Kundenstandes.

### 10.50 FE-C02 – globale A-Voraussetzungsformel sourcegebunden

#### 10.50.1 Ausgangslage und enger Fixumfang

Nach der vollständigen Typisierung der B-Membership-Bedingungen war FE-C02
weiter `UNKLAR`. B besaß eine vollständige EABS@2023-Quellkette mit drei
kumulativen Voraussetzungen; auf A fehlte dagegen der maschinenlesbare Bezug
zwischen dem globalen Voraussetzungssatz und dem allgemeinen
Photovoltaik-Listenpunkt. Der zweite A-Treffer lag unter dem engeren Scope
`Überspannung oder Induktion infolge Blitzschlag` und durfte den allgemeinen
Vergleich nicht tragen.

Der neue Vertrag
`SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_V1` materialisiert deshalb nur:

```text
SECTION_INSURED
AND (
  OBJECT_OWNED_BY_POLICYHOLDER_OR_BUILDING_OWNER
  OR ANAPHORIC_CONTRACTUAL_REPLACEMENT_OR_REINSTATEMENT_OBLIGATION
)
```

Er bindet den vollständigen Governor, alle Prädikatgruppen, Booleschen
Operatoren, Actor-OR-Verknüpfung, Zielkandidaten, Coverage-Governor, Seiten,
Offsets, exakte Quelltexte und Digests. `satisfaction` bleibt
`NOT_EVALUATED`, `readyForDecision` bleibt `false`; der Vertrag verändert
weder Coverage-Effekt noch Punktentscheidung.

#### 10.50.2 Reale Integrationsfehler und Forward-Fixes

Die ResultBuilder-Erstintegration löste die ausgewählten Kandidaten zunächst
aus `targets.private.json`. Ein unabhängiger Senior-Review zeigte vor der
Freigabe, dass dieser Modellvertrag den internen `coverageGovernorHint` mit
Absicht nicht transportiert. Der Forward-Fix löst selektierte IDs daher gegen
die autoritativen Worksheet-Occurrences auf und vergleicht Kandidaten-ID,
physische Seite, Dokument-Offsets und exakten Text mit dem Prepared Target.
Fehlende, doppelte oder abweichende Kandidaten brechen fail-closed mit
`COVERAGE_CONDITION_FORMULA_TARGET_REPLAY_INVALID` ab. Der Qwen-Payload blieb
unverändert.

Der erste Mac-Studio-Integrationstest legte anschließend einen allgemeinen
Offsetfehler im Regex-Fallback der Coverage-Governors offen: `text` war
getrimmt, `pageStart/pageEnd` enthielten aber führende Zeilenumbrüche. Damit
musste jeder source-exakte Replay ablehnen. `6da7e4778` berechnet die Offsets
nun aus dem tatsächlich getrimmten Text. Die Korrektur ist dokument- und
versichererunabhängig; keine fachliche Wirkung wurde erweitert.

```text
0f163b8ba feat(analysis): persist coverage condition formulas
4bbc928f7 fix(analysis): replay condition formula sources
f69d99416 style(analysis): format condition formula integration
0f77885e9 test(analysis): model narrow photovoltaic scope
6da7e4778 fix(analysis): bind trimmed coverage governors
263796c06 test(analysis): assert exact photovoltaic span
```

#### 10.50.3 Mac-Studio-Gate und echter Zehn-Dokument-Lauf

```text
Validierungscommit:
263796c062cf8a2303cf898dd31eb1962084187a
Mac-Studio-Worktree:
/private/tmp/pv3-vs19-amount-LOqa66/repo
Runtime:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/AuditRuns/QWEN36-FULL-20260831-7ab999c6/repo
Modell: qwen/qwen3.6-35b-a3b
Kontextlimit: 42496
Format: PASS
Fokussierte Suites: 8/8 PASS
Fokussierte Tests: 237/237 PASS

QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/FE-C02-COVERAGE-FORMULA-263796C0-20260903
Summary-Digest:
d574b61e8fbff01add62045d4b00f63af60728a35f1eb4c2cca67b3e49faa36a
Target-Selection-Digest:
12456418ad9653cbc51a411e54b9cfdb5f651a29604c0cef33ce5c8bb9136fae
Triage-Qwen-Aufrufe: 2
Evidence-Qwen-Aufrufe: 0
Triage-Terminalablehnungen: 4
Evidence-Serverterminals: 8
```

Der reale A-Proof ist eindeutig:

```text
Dokument: 4417a01f-7f73-44de-979a-3dcf9e65ca63
Governor-Seite: 3
Ziel-Seite: 4
Zieltext: - Solar- und Fotovoltaikanlagen;
Ziel-Governor: Versichert sind
Proof-Digest: 775c662243dfe64a13b045e158b2a64ee729363c0667c21bcc506fe22bfb01c7
Proof-Ziele: 1
Enge Blitz-/Überspannungs-Fundstelle im Proof: nein
B-Formelproofs dieses Typs: 0
```

Delta zum favorisierten Lauf
`FE-C02-TYPED-CONDITIONS-755F5D37-20260903`:

```text
A globaler Voraussetzungsscope: nicht typisiert -> vollständig sourcegebunden
B drei Membership-Bedingungen: unverändert vollständig
A Paket: BELEGT -> BELEGT
B Paket: TEILBELEGT -> TEILBELEGT
Punktentscheidung: UNKLAR -> UNKLAR
Review erforderlich: ja -> ja
Qwen-Aufrufe: 2/0 -> 2/0
```

Die unveränderte Entscheidung ist beabsichtigt: Der Schritt beweist nur die
A-Formel. Der nächste getrennte Vertrag vergleicht A-OR und B-AND als
vertragliche Voraussetzungsscopes. Dokumentrolle oder `PROPOSAL` dürfen dabei
nicht blockieren; nur ein echter Quellen-, Editions-, Ersatz-, Scope- oder
Inhaltskonflikt darf fail-closed bleiben. Kein Vollrun und kein Deployment.

### 10.51 FE-C02 – Bedingungsumfang side-neutral beweisbar

Der neue Vertrag `MEMBERSHIP_CONDITION_SCOPE_COMPARISON_V1` vergleicht keine
Dokumenttypen und bewertet nicht, ob das konkrete Gebäude die Bedingungen
erfüllt. Er vergleicht ausschließlich zwei vollständig sourcegebundene
Boolesche Vertragsformeln für dasselbe Zielobjekt, denselben Gefahrenscope und
dieselbe Komponente. Requirement-Digest und Vergleichsvertrag müssen auf allen
Atomen beider Seiten identisch sein.

```text
65c6b8c0e feat(analysis): bind membership condition scope comparison
92d0ccbe8 fix(analysis): harden condition scope contract boundary
ea8706b08 style(analysis): format condition scope comparison
f480d9e7e test(analysis): canonicalize condition formula fixture
5ddf2e9f3 test(analysis): isolate condition scope fixtures
```

Die unabhängige Architekturprüfung fand vor der Freischaltung einen
CommonJS-Importzirkel. `92d0ccbe8` verschob deshalb die reine
Katalogdefinition in ein abhängigkeitloses Policy-Analysis-Leaf. Derselbe
Forward-Fix bindet den Formula-Proof semantisch an den validierten
Katalogvertrag und prüft Section- sowie Implikationsprädikate gegen die
tatsächlichen Direkt- und Membership-Formeln.

Der erste Mac-Testlauf lieferte 7/8 grüne Suites und 205/209 grüne Tests. Die
vier Fehler lagen vollständig in der neuen Testfixture: zuerst wurde der
Digest aus dem rohen statt dem kanonisch validierten Formula-Vertrag gebildet,
danach veränderte ein adversarialer Test über eine geteilte Referenz den
importierten Katalog. `f480d9e7e` und `5ddf2e9f3` schließen beide Testfehler.

```text
Validierungscommit: 5ddf2e9f3c0b7ca07d7dd7b847d736455f3a90c9
Mac-Studio-Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Runtime: /Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/AuditRuns/QWEN36-FULL-20260831-7ab999c6/repo
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Format: PASS
Suites: 8/8 PASS
Tests: 209/209 PASS
```

Realer Zehn-Dokument-Ziellauf:

```text
Artefakt: QA/FE-C02-CONDITION-SCOPE-AUDIT-5DDF2E9F-20260903
Summary: 0afaacb6f62bdcf9989ba8e2d73b5dd2ce14f3cd2ccae2a50548b630c17084aa
Target Selection: cdf7f6e9946923eae3f1ce412290249faaafa9e98282afaa8627befa8f4084aa
Triage: 2 Aufrufe; 4 serverseitige Ablehnungen
Effects: 0 Aufrufe; 8 serverseitige Terminals
A: BELEGT
B: TEILBELEGT
Formelrelation: LEFT_STRICTLY_BROADER
Gültige Belegungen: 48
Breiterer Bedingungsumfang: A
Audit: comparisonComplete=true / readyForDecision=true
Audit-Digest: bcc272eb7f58cf89c61e0935d750b207f6cb7b3a393f24f673326a8ca8990eb3
```

Damit ist aus den echten Dokumenten belegt: Die B-Formel impliziert die
A-Formel, die A-Formel impliziert die B-Formel nicht. A hat für FE-C02 den
breiteren vertraglichen Voraussetzungsscope. Es wird weder ein ausdrücklicher
Ausschluss in B noch die konkrete Nichterfüllung der B-Bedingungen behauptet.

Der Stand bleibt absichtlich outcome-neutral:

```text
Vorher: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review
Nachher: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review
```

Erst der nächste getrennte Commit darf diesen vollständig replaybaren Audit
in `VORTEIL_A` beziehungsweise beim Seitentausch `VORTEIL_B` übersetzen. Vor
dieser Freischaltung werden noch die vollständigen Atom- und
Dokumentfingerprint-Invarianten geschlossen. Kein Vollrun, kein Deployment.

## 10.49 FE-C02 – Membership-Voraussetzungen sourcegebunden typisiert

`809ac148c`/`d853a8cc8` ergänzen für die Elternkante
`BUILDING_TECHNICAL_INSTALLATION -> BUILDING` drei kataloggesteuerte
Voraussetzungsprädikate. `3d2cd4dd6` korrigiert anschließend einen im ersten
Mac-Studio-Lauf belegten Matcherfehler: Mehrfach vorkommende Akteurswörter
werden nicht mehr global als mehrdeutig gewertet, sondern müssen je Prädikat
genau eine vollständige geordnete Aliasfolge bilden. Zwei vollständige Folgen,
fehlende Gruppen, lokale Negation und disjunktive Verknüpfung bleiben
fail-closed. `b8b376913` versioniert die geänderte Semantik als
`SOURCE_BOUND_MEMBERSHIP_CONDITION_EVIDENCE_V2`, FE-Katalog v0.19 und
Produktprofil V95/V56; `755f5d374` korrigiert die veraltete Audit-Fixture.

```text
Finaler Commit: 755f5d3749b7a3e50cab4b9fde4dbeae65b1f87f
Mac-Studio-Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Runtime: QWEN36-FULL-20260831-7ab999c6/repo
Modell: qwen/qwen3.6-35b-a3b; Kontext 42496
Formatprüfung: PASS
Fokussierte Suites: 11/11 PASS
Fokussierte Tests: 356/356 PASS
Artefakt: QA/FE-C02-TYPED-CONDITIONS-755F5D37-20260903
Summary: 87311f05b74d02cc99a59b2cd7b4a73dabd38e6ab87c8b7d17f061e3cb9c0b04
Target Selection: cd204b9df65eba2588e15c9812d41459ba7d3f31a19bc58bb141ac8f6e6b974b
Aufrufe: 2 Triage / 0 Effects
Server: 4 Triage-Rejects / 8 Evidence-Terminals
```

Delta zum letzten freigegebenen FE-C02-Ziellauf:

```text
A-Audit: weiterhin INCOMPLETE_SOURCE_CHAIN
B-Audit vorher: COMPLETE_SOURCE_CHAIN_REQUIRES_TYPED_CONDITION_AND_PRECEDENCE
B-Audit jetzt: COMPLETE_SOURCE_CHAIN_TYPED_CONDITIONS_OUTCOME_LOCKED
B-Conditions: 3/3 COMPLETE, konjunktiv, unnegiert, sourcegebunden
Kundenergebnis: weiterhin UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
Paketstatus: weiterhin A BELEGT / B TEILBELEGT
Call-Delta: keines
```

Die drei Klauseln belegen Vertragsvoraussetzungen, nicht deren tatsächliche
Erfüllung. Deshalb bleibt `satisfaction=NOT_EVALUATED` und
`readyForDecision=false`. Als nächste getrennte Schritte fehlen ausschließlich
`MEMBERSHIP_CONDITION_SCOPE_COMPARISON` und `DOCUMENT_PRECEDENCE`. Erst nach
deren sourcegebundener Prüfung darf entschieden werden, ob der B-Proof
`DEFINED` zu einer Deckungswirkung anheben kann. Kein Vollrun und kein
Deployment.

## 10.42 FE-C02 – reale Elternkante auf zehn Dokumenten

Der zielgebundene Mac-Studio-Lauf auf dem exakten Commit `70c18d2cb` hat die
neu persistierte, weiterhin wirkungsneutrale Elternkante erstmals gegen alle
zehn Paketdokumente ausgeführt.

```text
Commit: 70c18d2cb06b9823ca6b8639f347d6cd3e3a55e6
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Artefakt: QA/FE-C02-PARENT-70C18D2C-20260903
Summary-SHA: 6cefb22c4b86f7fe0c007c784a3fb4bf76de94a6a74e5840c0af05deb75b78f2
Target-Selection-SHA: f3c201fa0c7921bdee91f50a70e7871bbe24459a51fe21aa8b2904b335b40892
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Dokumente: 10
Triage-Aufrufe: 2
Effects-Aufrufe: 0
Triage-Serverablehnungen: 4
Evidence-Terminals: 8
```

Ergebnis und Laufkosten blieben gegenüber der FE-C02-Baseline unverändert:

```text
A: BELEGT / INCLUDED
B: TEILBELEGT / DEFINED
Entscheidung: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
```

In B/DOC-10 entstand genau ein zusätzlicher Elternnachweis:

```text
BUILDING_TECHNICAL_INSTALLATION --MEMBER_OF_CLASS--> BUILDING
Mitglied: PDF-Seite 2, Offset 1894–1916, „Haustechnische Anlagen“
Klasse: PDF-Seite 2, Offset 1343–1350, „Gebäude“
Klassifikation: Offset 1340–1433
Proof-Digest: 07cbeab49ad0980f9b372a316d9406dd14590ab84683198c4df77c43a08e1713
```

Der `memberContextSpan` enthält alle drei fachlich erforderlichen, kumulativen
Bedingungen: Eigentum des Gebäudeeigentümers, dessen nachweisliche Pflicht zur
Wiederherstellung und Aufnahme in den Gebäudeneuwert. Der Lauf hat aber auch
eine neue, begrenzte Boundary-Abweichung sichtbar gemacht: Der Kontext endet
erst nach dem Beginn der folgenden Klassifikationsüberschrift `Nicht als
Gebäude oder Gebäudebestandteile zählen:`. Ursache ist, dass
`structuralBoundaryLineStarts()` Objektklassifikations-Governors noch nicht als
Folgegrenze führt. Die Kante und die drei Bedingungen sind sourcegebunden,
aber der Kontext ist noch nicht minimal. Deshalb bleibt jede Ergebnisfreigabe
gesperrt, bis diese Grenze separat korrigiert und erneut real geprüft wurde.

Kein Vollrun, keine Ergebnisänderung und kein Deployment.

## 10.43 FE-C02 – Objektklassifikationsgrenze geschlossen

Commit `d5fa7a72e` führt Objektklassifikations-Governors als echte
Strukturgrenzen für Listenpunkte. Damit endet ein Mitgliedsnachweis vor einer
nachfolgenden, anders gerichteten Klassenüberschrift. Weil sich der kanonische
Belegspan und sein Digest ändern, wurde der Vertrag bewusst auf
`SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_V4`, der FE-Katalog auf `v0.14` und
das Produktprofil auf V89 versioniert.

```text
Commit: d5fa7a72ea84ff74c0009306824e9442a1f5f7dc
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Mac Studio: Format PASS; 8 Suites / 239 Tests PASS
Artefakt: QA/FE-C02-BOUNDARY-D5FA7A72-20260903
Summary-SHA: 2b1cce10adaa1635a6c937b6a0f464f6b3d0d44e5e3d237c51b392aa4ee4d3d4
Target-Selection-SHA: bfe8938b65efb1cdcef544b104c29e160c8e107acd798e88b0d1a31a9692a8ae
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
```

Der erneute Zehn-Dokument-Lauf liefert genau einen B-Elternnachweis. Sein
`memberContextSpan` ist nun source-exakt auf Offset `1893–2120` begrenzt und
endet mit `im Gebäudeneuwert enthalten sind.`. Die folgende Überschrift ist
nicht mehr enthalten.

```text
Context-SHA: 02a0810aa4d20b9353ad0c9b3ee842abfcd0dfaae802b83d7db7e7f1666940a8
Proof-Digest: da49981d791755ff6d48d9a73a5826caa34ed30e11844f2f714970a4428b0a8d
A: BELEGT / INCLUDED
B: TEILBELEGT / DEFINED
Entscheidung: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
Calls: 2 Triage / 0 Effects / 4 Serverablehnungen / 8 Terminals
```

Gegenüber Baseline, V2 und dem noch zu weiten V3-Nachweis gibt es kein
Ergebnis-, Call- oder Terminal-Delta. Der Boundary-Fix verändert ausschließlich
die Belegpräzision. Nächster Schritt bleibt der outcome-neutrale
Aktivierungs-/Referenz-Audit. Kein Vollrun und kein Deployment.

## 10.44 FE-C02 – Feuerabschnitt und EABS-Referenz sourcegebunden

`b4b97c74c` führt den outcome-neutralen Vertrag
`SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_V1` ein. Er kann nur dann
einen Proof erzeugen, wenn ein Top-Level-Feuerabschnitt zugleich genau einen
nicht negierten Gebäudeanker und genau eine Bedingungsreferenz mit einer aus
dem Quelltext extrahierten Edition enthält. Die nächste Spartengrenze beendet
den Suchraum. Der Vertrag enthält keine Deckungswirkung und verändert weder
Paketstatus noch Entscheidung.

Der erste reale Lauf auf `9246c4135` erzeugte null Proofs. Der unabhängige
Quelltext-Replay lokalisierte die Ursache auf die PDF-Verklebung
`Wohngebäude zum NeuwertEUR30.608.000,00`. `e0e1fccf2` erlaubt deshalb nur den
expliziten, getesteten Anschluss des Währungstokens `EUR`; beliebige
Teilwortsuffixe bleiben ausgeschlossen.

```text
Finaler Commit: e0e1fccf27a1498492ad4a5b31eea64e45c18c9e
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Mac Studio: Format PASS; 9 Suites / 247 Tests PASS
Artefakt: QA/FE-C02-SCOPED-REFERENCE-E0E1FCCF-20260903
Summary-SHA: 12c933b31b79242d9cfd6a44828fd297e9415444caf663aed57aaa288bd00dc0
Target-Selection-SHA: c1b1dbfb8c029e6b0417b53cd9f0e5b1aec553bae83dc45bb5467a0c1714f84d
```

Der Zehn-Dokument-Lauf erzeugt genau einen Proof in B/DOC-02:

```text
Scope: FEUER_INSURANCE, Seite 1, Offset 1250–1267
Objekt: BUILDING, Seite 1, Offset 1331–1354
Objektkontext: „-Wohngebäude zum NeuwertEUR30.608.000,00“
Referenz: EABS@2023, Seite 2, Offset 5066–5137
Nächste Spartengrenze: LEITUNGSWASSERVERSICHERUNG, Offset 5138–5164
Proof-Digest: 5bfa2686a9a3a7a2432bc5d9032d528c9165d2c017311b4f43f101fe3cfd5cbf
```

Keine der weiteren EABS-Nennungen unter Leitungswasser, Sturm oder
Haftpflicht wurde dem Feuerproof zugeschlagen. Das Ergebnis bleibt
`A BELEGT / B TEILBELEGT / UNKLAR`; Calls und Terminals bleiben `2 / 0 / 4 /
8`. Offen ist die getrennte Identitätsprüfung des tatsächlich hochgeladenen
Bedingungsdokuments. Kein Vollrun und kein Deployment.

## 10.45 FE-C02 – EABS-Dokumentidentität sourcegebunden

`ff11bf446` führt
`SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_V1` ein. Der Vertrag liest
Familie und Edition ausschließlich aus genau einem kanonischen Titelblock auf
physischer Seite 1. Dateiname, Dokumentrolle und im Katalog fest codierte
Edition sind verboten. `73f09df57` schließt einen im adversarialen Mac-Test
entdeckten Mehrdeutigkeitsfall: Mehrere passende Titelblöcke führen immer zu
null Proofs, statt still einen späteren Treffer auszuwählen.

```text
Finaler Commit: 73f09df577c872e07105f5a94fb788087d23f8ae
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Mac Studio: Format PASS; 10 Suites / 254 Tests PASS
Artefakt: QA/FE-C02-TERMS-IDENTITY-73F09DF5-20260903
Summary-SHA: 744e43ae05536a9328e6607cd1e19c089eb6bce0fc55a64587238ec24c1f87a9
Target-Selection-SHA: cf561e85872ce6e1e36bee2e2a229be443679b67ef906d97242cb4c6dc1f570e
```

Der reale Zehn-Dokument-Lauf liefert genau einen Identitätsproof in B/DOC-10:

```text
Titel: Seite 1, Offset 41–99
       „Ergänzende allgemeine Bedingungen für die\nSachversicherung“
Code: Seite 1, Offset 101–105, „EABS“
Edition: Seite 1, Offset 106–110, „2023“
Identity Context: Offset 41–111
Reference Key: EABS@2023
Proof-Digest: 042612468b3a47f75cc608906d800a02164bce6f13687d7392490d8a02c15148
```

Der bereits belegte Feuerabschnitt in B/DOC-02 referenziert denselben,
unabhängig aus der Quelle gewonnenen Schlüssel `EABS@2023`. Noch wurde kein
Paket-Join und keine Wirkung daraus abgeleitet. Ergebnis und Calls bleiben
unverändert. Nächster Schritt ist ein outcome-neutraler Kettenaudit mit
explizitem Rest-Gate für Bedingungen, Konflikt und Rang. Kein Vollrun und kein
Deployment.

## 10.46 FE-C02 – aktivierte Objektkette paketweit auditiert

`e96c1179e` ergänzt den outcome-neutralen Vertrag
`PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_V1`; `476d71401` enthält nur die
separate Formatkorrektur. Der Audit darf keine Deckungswirkung erzeugen. Er
verknüpft ausschließlich bereits gegen die Originaldokumentartefakte replayte
Nachweise über folgende exakte Schlüssel und gerichtete Kanten:

```text
Feuerabschnitt + Gebäude + EABS-Referenz
  -> gleicher dynamisch gelesener Referenzschlüssel EABS@2023
  -> EABS-Titelblock auf dem referenzierten Bedingungsdokument
  -> PHOTOVOLTAIC_INSTALLATION -> BUILDING_TECHNICAL_INSTALLATION
  -> BUILDING_TECHNICAL_INSTALLATION -> BUILDING
```

Ein Ausschluss auf derselben gerichteten Kante, ein nicht eindeutiger
Referenzschlüssel, eine fehlende Kante oder ein nicht konfliktfreier
Membership-Proof lässt den Vertrag fail-closed enden. Dokumentrolle,
Versicherername, Dateiname und fest codierte Ausgabe sind keine Join-Kriterien.

Mac-Studio-Validierung:

```text
Commit: 476d71401d1f3b410c550162f642daaefec06543
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Runtime: /Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/AuditRuns/QWEN36-FULL-20260831-7ab999c6/repo
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Format: PASS
Fokussierte Regression: 12 Suites / 340 Tests PASS
Artefakt: QA/FE-C02-PACKAGE-AUDIT-476D7140-20260903
Summary: 1031550333b4925e70f8dfc849ba4e5cdfc9219ccf885729f256aae6f0ce6e30
Target Selection: 150778e3ad58d488ec08f884a8b0e63d85c6d3bd4cca5a5a02f7acf9998e4e12
```

Der echte Lauf über alle zehn Paketdokumente rekonstruiert auf Seite B genau
eine vollständige, konfliktfreie Kette. Die scopespezifische Referenz liegt in
B/DOC-02, die EABS-Identität und beide Membership-Kanten liegen in B/DOC-10.
Der Audit bindet sie über `EABS@2023`. Die Elternkante erhält weiterhin den
vollständigen qualifizierenden Quelltext mit Eigentum, nachweislicher
Wiederherstellungspflicht und Einschluss in den Gebäudeneuwert. Status:
`COMPLETE_SOURCE_CHAIN_REQUIRES_TYPED_CONDITION_AND_PRECEDENCE`.

Seite A besitzt keine solche Paketkette und endet deshalb mit
`INCOMPLETE_SOURCE_CHAIN`. Das ist noch kein Negativnachweis für A, weil der
Audit nur die konkrete Aktivierungskette von B prüft.

Delta zum unmittelbar vorherigen favorisierten FE-C02-Lauf
`QA/FE-C02-TERMS-IDENTITY-73F09DF5-20260903`:

```text
Ergebnis vorher/nachher: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION (unverändert)
Paket A vorher/nachher: Ja / BELEGT (unverändert)
Paket B vorher/nachher: Nicht feststellbar / TEILBELEGT (unverändert)
Triage-Aufrufe vorher/nachher: 2 / 2
Effects-Aufrufe vorher/nachher: 0 / 0
Server-Rejects vorher/nachher: 4 / 4
Deterministische Evidence-Terminals vorher/nachher: 8 / 8
Neuer Befund: vollständige B-Paketkette, noch nicht entscheidungswirksam
```

Die noch offenen, jetzt präzise eingegrenzten Gates sind
`TYPED_CONDITIONS` und `DOCUMENT_PRECEDENCE`. Erst müssen die drei Bedingungen
semantisch typisiert und gegen den konkreten Versicherungsfall ausgewertet
werden; danach muss die Rangfolge beziehungsweise gemeinsame Geltung von
Polizze und referenzierten Bedingungen sourcegebunden geprüft werden. Bis dahin
bleibt `readyForDecision=false`. Kein Vollrun und kein Deployment.

## 10.47 FE-C02 – Supporting-Membership-Proofs autoritativ replayt

Der Senior-Review des Paket-Audits fand, dass die unterstützende Elternkante
im ResultBuilder noch aus dem Worksheet kopiert wurde. Die Forward-Fixes
`1fc1cc71f` bis `a881858c4` ersetzen das durch einen vollständigen Neuaufbau aus
dem servereigenen Dokumentartefakt. Vor dem Scan werden Artifact-Schema,
64-stelliger Fingerprint und die Identität
`fingerprint === document.sourceDocumentId` geprüft. Anschließend müssen
erwartete und persistierte Proof-Menge sortiert exakt übereinstimmen; fehlende,
doppelte oder manipulierte Proofs enden fail-closed. Ins Atomic Fact wird nur
die serverseitig neu erzeugte Menge übernommen.

```text
Finaler Commit: a881858c43df290ad10ced051d30cf5f1abff179
Mac Studio: Format PASS; 4 Suites / 171 Tests PASS
Artefakt: QA/FE-C02-MEMBERSHIP-REPLAY-A881858C-20260903
Summary: bb999dd458c3bf10375be44c9ee69abf57fe824af096940b21ce78930acf2cac
Target Selection: 150778e3ad58d488ec08f884a8b0e63d85c6d3bd4cca5a5a02f7acf9998e4e12
```

Der reale Zehn-Dokument-Replay reproduziert denselben B-Elternproof
`da49981d...`, dieselbe vollständige Paketkette und denselben Audit-Digest
`98017351...`. Gegenüber dem favorisierten Paket-Audit auf `476d71401` bleiben
Ergebnis, Paketstati und Laufkosten exakt stabil:

```text
UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
A: Ja / BELEGT
B: Nicht feststellbar / TEILBELEGT
2 Triage / 0 Effects / 4 Server-Rejects / 8 Evidence-Terminals
```

Damit ist die interne Membership-Provenienz gegen Worksheet-Manipulation
geschlossen. Weiter offen ist die Validierung des daraus gebauten Audits an
der finalen Kundenmetrik-Grenze; dieser Punkt wird als eigener Forward-Fix
bearbeitet. Kein Vollrun und kein Deployment.

## 10.48 FE-C02 – Paket-Audit an der Kundenmetrik-Grenze validiert

`4dc017345`/`d60c74c31` ergänzen einen strikten Validator für den
persistierten Paket-Audit und machen ihn für eine aktuelle, wegen
`PACKAGE_REVIEW_STATUS_BLOCKS_DECISION` unklare FE-C02-Zeile verpflichtend.
Geprüft werden exakte Schemaform, Vertragsidentität, Kategorie, Digest,
Status-/Reason-/Rest-Gate-Kombination, kanonische Proof-Mengen,
Kontextspan-Digest sowie die Zugehörigkeit jeder Dokument-UUID zur richtigen
Paketseite. Ein Audit außerhalb dieses Entscheidungszweigs wird abgewiesen.

```text
Finaler Commit: d60c74c3174b8fed94617568d4b770956d9cf54d
Produktprofil: CUSTOMER_CORE_5_V93_FE_C02_PACKAGE_MEMBERSHIP_AUDIT_VALIDATED
Mac Studio: Format PASS; 5 Suites / 148 Tests PASS
Artefakt: QA/FE-C02-CUSTOMER-AUDIT-D60C74C3-20260903
Summary: d75124e5caa0ff5ab20cecf78b285bc1edc28c386023b201455b9802e2d9e3ba
Target Selection: 150778e3ad58d488ec08f884a8b0e63d85c6d3bd4cca5a5a02f7acf9998e4e12
```

Der echte Lauf reproduziert die identische vollständige B-Kette, den
Audit-Digest `98017351...` und den B-Elternproof `da49981d...`. Das Delta zum
favorisierten Paket-Audit und zum autoritativen Membership-Replay ist null:

```text
Ergebnis: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
A: Ja / BELEGT
B: Nicht feststellbar / TEILBELEGT
Calls: 2 Triage / 0 Effects
Terminals: 4 Server-Rejects / 8 Evidence-Terminals
```

Damit sind die beiden im Senior-Review identifizierten Trust-Boundary-Lücken
geschlossen. Der Audit selbst bleibt `readyForDecision=false`; fachlich offen
sind weiterhin die typisierte Auswertung der drei Bedingungen und danach die
Dokumentpräzedenz. Kein Vollrun und kein Deployment.

### 10.40 FE-C02 – gerichtete Objektmitgliedschaft sourcegebunden erhalten

Der frische Ist-Lauf auf `6d3a455a5` bestätigte die bisherige Diagnose ohne
Rückgriff auf den alten Vergleichs-Report:

```text
Artefakt: QA/FE-C02-BASELINE-6D3A455A-20260903
Summary-SHA: 95e9dee7d9a21c98df954bb84e8df17aa1e5f5f9b30b7fced95140948742755f
Selection-SHA: 81c5c02c61ac2a5038fe232b521f9dfebe2796c76cb0e539dd38c2111c5fba7d
A: BELEGT / INCLUDED
B: TEILBELEGT / DEFINED
Entscheidung: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
Calls: 2 Triage, 0 Effects
```

Die zwei ausgewählten B-Fundstellen haben unterschiedliche gerichtete
Bedeutung. S. 2 beweist `PHOTOVOLTAIC_INSTALLATION EXCLUDED_FROM_CLASS
BUSINESS_CONTENT`; S. 4 beweist `PHOTOVOLTAIC_INSTALLATION MEMBER_OF_CLASS
BUILDING_TECHNICAL_INSTALLATION`. Keine dieser Kanten allein ist eine
Deckungsaussage.

Die Commits `5e5a5cf51`, `6ee2f959f` und `ee9d0493a` führen deshalb den
kataloggesteuerten Vertrag
`SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_V1` ein. Der Beweis bindet
Mitglieds- und Klassen-Span, Richtung, Originaltext, physische Seite, Offsets,
Dokumentfingerprint sowie Vertrags- und Proof-Digest. Er wird intern über
Prepared Target, originalbyte-validierte Selected Source und Atomic Source
erhalten, aber vor dem Qwen-Payload entfernt. Manipulierte Proofs oder
Dokumentbytes werden fail-closed verworfen.

Mac-Studio-Regression auf `ee9d0493a617b466388df675901c17d6b08f0588`:

```text
8/8 fokussierte Suites PASS
239/239 fokussierte Tests PASS
Arbeitsbaum: /private/tmp/pv3-vs19-amount-LOqa66/repo
Runtime: QWEN36-FULL-20260831-7ab999c6/repo
Modell: qwen/qwen3.6-35b-a3b; Kontext 42496
```

Der reale Zehn-Dokument-Lauf blieb absichtlich outcome-neutral:

```text
Artefakt: QA/FE-C02-MEMBERSHIP-EE9D0493-20260903
Summary-SHA: 0c61bb884735248216ec71db140d38419ee3be216ab3a0970be4ee0a64227b74
Selection-SHA: 4df5fbe574bfd26a2258f9946cc8ee4426fcc95e2b9a98e4968f25dc713b450c
A/B/Entscheidung: unverändert BELEGT / TEILBELEGT / UNKLAR
Calls und Server-Terminals: unverändert 2 / 0 / 4 / 8
Neue Membership-Proofs: 2 in Selected Sources und Atomic Sources
```

Damit ist nur die erste von vier Freigabestufen abgeschlossen. Noch fehlen
die sourcegebundene Kante `BUILDING_TECHNICAL_INSTALLATION -> BUILDING`, die
Paketaktivierung `FEUER + WOHNGEBAEUDE + EABS 2023` und die unveränderte
Forttragung der drei kumulativen Bedingungen Eigentum,
Wiederherstellungspflicht und Aufnahme im Gebäudeneuwert. Eine globale oder
FE-C02-lokale Umdeutung `DEFINED -> INCLUDED` bleibt verboten. Kein voller
224-Zeilen-Lauf und kein Deployment.

### 10.41 FE-C02 – qualifizierender Listenpunkt vollständig erhalten

`996ea4be0` ersetzt den Membership-Proof durch den versionierten Vertrag
`SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_V2`; `3a35c2924` enthält nur die vom
Mac-Studio-Formatter verlangte Testformatierung. V2 bindet neben Mitglieds-
und Klassenspans auch den vollständigen strukturellen Listenpunkt als
`memberContextSpan`. Dadurch kann die nächste Kante ihre kumulativen
Bedingungen beweissicher weiterreichen, statt nur den Objektnamen zu kennen.

```text
Commit: 3a35c292488ab18f16ecc13d2af3cf7e9bd7b161
Mac Studio: Format PASS; 8 Suites / 239 Tests PASS
Artefakt: QA/FE-C02-QUALIFIER-3A35C292-20260903
Summary-SHA: 7c428399e5b9906d68c44de842b08bba6a705f0328623ebbe65ea51e852350e6
Selection-SHA: 9f8c6d31457dd7f175c507189a06ebcde166c23bd97b81a1550d8c7653bcb9d6
Ergebnisdelta: keines
Call-/Terminal-Delta: keines
```

Im realen B-Atom sind beide vollständigen Listenpunkte samt eigenem SHA
vorhanden. Die Bedingungskette selbst entsteht erst mit der noch fehlenden
Elternkante `BUILDING_TECHNICAL_INSTALLATION -> BUILDING`; deshalb bleibt
`FE-C02` korrekt `UNKLAR`. Kein Vollrun und kein Deployment.

### 10.38 FE-A05 Schritt 2c2 – Effects-Runner an Originalartefakte gebunden

Der Selected-Source-Replay ist jetzt in die tatsächliche Effects-Ausführung
eingebunden. Für jede Komponente mit `objectScopeEvidenceContract` ist
`--documentArtifact` zwingend. Ein `objectScopeProof` ohne Object-Scope-Vertrag
oder ein `nestedListContinuationProof` ohne eigenen Listenproof-Vertrag wird
vor jedem Modellaufruf abgelehnt. Dokumentartefakt, Worksheet und Targets
werden über Originalbytes, Fingerprint, PageContent-SHA, PageMap,
Seitenoffsets und SHA-256-Digests gebunden. Die Proof-Felder bleiben außerhalb
des Qwen-Payloads.

Alle inventarisierten aktiven Aufrufer wurden geschlossen:

```text
run-all-categories-quality.command
run-hybrid-shadow-quality.command
runTargetedQaAll50.cjs
runHybridShadowPilotQwenPhase.cjs
```

Die historischen reinen VS-Runner bleiben kompatibel, solange ihr Worksheet
weder Object-Scope-Vertrag noch verwaiste Proofs enthält. Pfade sind nur
Auditmetadaten; die Vertrauensanker sind Artefakt-SHA, Dokumentfingerprint und
der Replay gegen Originalbytes.

Commits:

```text
6c116f959 fix(analysis): bind document artifacts in effects replay
153bf990f test(qa): track current product profile
c44f0eca9 style(analysis): format artifact replay wiring
938c5e8fb fix(qa): bind targeted effects to source artifacts
eaf9cc9d4 test(qa): canonicalize targeted artifact paths
b7156cda7 fix(qa): bind hybrid qwen effects to source artifacts
7fb93adce style(qa): format hybrid artifact binding
592317199 fix(analysis): require artifacts for object scope evidence
a2b2a662e style(analysis): format object scope gate
3324aeb5d test(qa): track current ST recall catalog
4655877c3 test(qa): declare legacy embedding fixture
```

Der Testversuch `13d1f0c17` wollte drei historische Manifest-Fixtures nur auf
aktuelle Katalog-IDs umstellen. Das nächste Hash-Gate widerlegte diesen Ansatz:
Der unveränderliche 69er-Baselinevertrag und die aktuellen Produktkataloge sind
zwei verschiedene Wahrheitsschichten. `e63b855b5` stellte deshalb die
historische Fixture-Semantik wieder her; kein Hash-Gate wurde abgeschwächt.

Mac-Studio-Nachweis:

```text
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Commit des echten Ziellaufs: a2b2a662e752e4c34a1f27c0c91be799815ce0d2
Aktueller geprüfter HEAD: e63b855b514d2494c56166eca81d84b0803c2eea
Node: v22.23.2
Chatmodell: qwen/qwen3.6-35b-a3b, Kontext 42496
Embeddingmodell: nicht geladen
Fokussiertes Gate/Wiring: 72/72 PASS
Breite Regression: 65/68 Suites und 1039/1063 Tests PASS
Rest: exakt 24 bekannte historische TARGETED_QA_PROFILE_CATALOG_MISMATCH-Fixturetests
```

Echter Zehn-Dokument-Lauf:

```text
Artefakt: QA/FE-A05-A06-EFFECTS-ARTIFACT-GATE-A2B2A662-20260903
Producer: /tmp/fe_a05_a06_targeted_producer-v05.cjs
Producer-SHA: 9dc300b27122ed51522bc640aacb1016de3e258803ef9da0c84764ba1b8608fd
Summary-SHA: dfcf80c7339b92e26bf2d288ed6c8ee20fad4c146f73c2549d77c0c17e0a1b71
Selection: 387784fb7b4506bd9cad04dbeaf127280e03cf593cc7e98cd25f865c55be0120
Effects-Reports mit vollständiger Dokument-/Targets-Bindung: 10/10
Triage-Aufrufe: 3
Effects-Aufrufe: 1
Triage-Terminals: 11
Evidence-Terminals: 15
Ergebnis: A BELEGT / B TEILBELEGT / UNKLAR
```

Gegenüber dem Favoritenlauf
`FE-A05-A06-SELECTED-REPLAY-6D70AF9B-20260903` blieben Paketstatus,
Entscheidung, Modellaufrufe und Terminalzahlen identisch. Der messbare Gewinn
ist ausschließlich die geschlossene Ausführungs- und Persistenzkette für die
vier ausgewählten Scope-Proofs. R69-A bleibt `10/40`; kein 224-Zeilen-Vollrun
und kein Deployment.

### 10.39 FE-C02 – aktuelle Ursache vor dem ersten Forward-Fix

Die letzte gebundene Baseline zeigt A `BELEGT/INCLUDED`, B
`TEILBELEGT/DEFINED` und deshalb `UNKLAR`. Recall, Pflichtfelder und
Dokumentrang sind nicht die Ursache. B enthält eine vollständige, aber derzeit
nicht zusammengesetzte Paketkette:

```text
Feuerversicherung deckt Wohngebäude
+ EABS 2023 ist im Angebot angeführt
+ Photovoltaik ist eine haustechnische Anlage
+ haustechnische Anlagen gehören unter Bedingungen zum Gebäude
```

Eine globale Umwandlung `DEFINED -> INCLUDED` bleibt verboten. Der kleinste
generische nächste Vertrag ist `PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_V1`: Er
muss aktive Oberobjektdeckung, anwendbare Bedingungen, gerichtete
Objektmitgliedschaft, fortgetragene Bedingungen und widerspruchsfreie
Paketdokumente sourcegebunden zusammensetzen. Erst danach ist zu prüfen, ob A
wegen breiterer Eigentums-/Wiederherstellungsbedingungen tatsächlich einen
beweisbaren Vorteil besitzt.

### 10.32 VS-36 – Höchstentschädigung: Feldfehler geschlossen, Dokumentrang offen

#### 10.32.1 Ausgangslage und reale Fundstellen

VS-36 wurde auf dem unveränderten Zehn-Dokument-Paket zuerst am Commit
`80955a41b` isoliert reproduziert. Der Ausgangslauf endete mit Paket A
`BELEGT`, Paket B `TEILBELEGT` und
`UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION`. Paket B trug dabei noch den
technischen Blocker `FIELD_INCOMPLETE`.

Die Fundstellen sind fachlich nicht austauschbar:

- Paket A, DOC-01, PDF-Seite 25: Die Höchstentschädigung je Schadensfall ist
  ausdrücklich auf maximal `150 %` der vereinbarten Versicherungssumme für
  das Gebäude begrenzt.
- Paket B, DOC-02: Die indexangepasste Versicherungssumme der betroffenen
  Position wird als Ersatzgrenze beschrieben.
- Paket B, DOC-03: In einem Unterversicherungsverzicht wird die Leistung durch
  Versicherungssumme oder Haftungshöchstsumme begrenzt. Eine benachbarte
  `25 %`-Angabe gehört nicht zu dieser Höchstentschädigung.
- Paket B, DOC-05: Die Entschädigung je Position ist durch deren
  Versicherungssumme begrenzt.
- Paket B, DOC-10: Die Entschädigung je Ereignis ist durch die in der Polizze
  angeführte Versicherungssumme begrenzt und mit dem Versicherungswert
  maximiert.

Damit lag kein reiner Retrievalfehler vor. Der spezialisierte Feldvertrag
konnte die vier symbolischen B-Grenzen zuvor nicht typisieren und band die
klare A-Klausel nicht vollständig an Ereignisscope und Vergleichsbasis.

#### 10.32.2 Kleine Forward-Fixes

```text
cee57f3b7 fix(analysis): type VS-36 symbolic limits
c5f2255d2 style(analysis): format VS-36 symbolic limits
dbe871d8d fix(analysis): bind VS-36 event limit semantics
d99e60dca style(analysis): format VS-36 event limits
90f40478a fix(analysis): accept VS-36 list event clauses
```

Der neue Vertrag
`server/utils/policyAnalysis/vs36MaximumIndemnityLimitContract.js` typisiert
nur exakt belegte Klauselfamilien als `SYMBOLIC_LIMIT`; er erfindet
insbesondere keine numerischen `100 %`. Die A-Klausel wird als `150 %`,
`PER_LOSS_EVENT` und `BUILDING_INSURANCE_SUM` mit exakter Basisquelle
materialisiert. Ein allgemeiner numerischer Fallback wurde für VS-36 bewusst
entfernt, damit fremde Selbstbehalte oder benachbarte Prozentwerte nicht das
Feld verdrängen.

Der Zwischenlauf auf `d99e60dca` war kein akzeptierter Abschluss: Er zeigte,
dass die richtige A-Klausel als `LIST_ITEM` strukturiert ist, während der
erste enge Vertrag nur Absatz und Wortfenster erlaubte. `90f40478a` ergänzt
genau diese Strukturart unter Beibehaltung des exakten Klauselmusters.

#### 10.32.3 Mac-Studio-Prüfung und gebundene Läufe

Alle Prüfungen liefen im isolierten Kunden-Mac-Studio-Worktree
`/private/tmp/pv3-vs19-amount-LOqa66/repo` mit Commit
`90f40478ae9b250c4a4c4ec4b226079789322b38`. Der installierte
Kundencheckout blieb unverändert.

```text
Produktprofil: CUSTOMER_CORE_5_V81_VS36_LIST_EVENT_LIMITS
Fokussiert/angrenzend: 6 Suites, 225 Tests PASS
Breit: 108/111 Suites, 1623/1647 Tests PASS
Bekannte Restfehler: ausschließlich 24 historische VS-Katalog-Fixturefehler
```

```text
Baseline: QA/VS-36-BASELINE-80955A41-20260903
Summary: 10365b9e9d54495e97c8bf20b7752d085925090560c9191e4f6fc2dcc48aa376
A BELEGT / B TEILBELEGT / FIELD_INCOMPLETE / UNKLAR

Symbolische Felder: QA/VS-36-SYMBOLIC-LIMIT-C5F2255D-20260903
Summary: ba5d19fce42c7a23d22f09e24a502c48612824a79bab1e746f61029e4d7d1fab
A BELEGT / B RANGFOLGE_PRÜFEN / UNKLAR

Verworfener Struktur-Zwischenstand: QA/VS-36-EVENT-LIMIT-D99E60DC-20260903
Summary: 0f6beccb70a259a758fa9c580b2cca8c4c1f328e849801d902614d83570a7eb7
A TEILBELEGT / B RANGFOLGE_PRÜFEN / UNKLAR

Finaler Zielstand: QA/VS-36-LIST-EVENT-90F40478-20260903
Summary: 187f91649dc341a5b29555e455a3e8ca18b74c7a073d7d8fc1b0021f4bc3e3f7
Selection: 7c92f519a569d53fd5222b3e397ccbecdc21a88a8df76888ffc5c8703e5d648a
A BELEGT / B RANGFOLGE_PRÜFEN / UNKLAR
Triage-/Evidence-Aufrufe: 3/2
Server-Rejects/-Terminals: 3/5
```

Die angrenzende VS-25-Entscheidung wurde auf demselben Endcommit erneut über
alle zehn Dokumente aufgebaut:

```text
Artefakt: QA/VS-25-POST-VS36-90F40478-20260903
Summary: 672ef9ef60f4791459e526333a175533b637f0061db886b0d44f1560dafdaa1d
Ergebnis: VORTEIL_A / kein Review
Triage-/Evidence-Aufrufe: 0/0
```

#### 10.32.4 Ergebnis und sichere Grenze

Der technische `FIELD_INCOMPLETE`-Fehler ist geschlossen. Die verbleibende
Unklarheit ist jetzt präzise: Paket B enthält mehrere wirksame
Höchstentschädigungsregeln auf unterschiedlichen Ebenen, aber der vorhandene
Dokumentvertrag beweist weder deren Rangfolge noch eine identische
Vergleichsbasis zur A-Klausel. Insbesondere liegt für die explizite
Ereignisklausel in DOC-10 kein dokumentgleich gebundener VS-01-Neuwertbeleg
vor.

Deshalb ist ein automatisches `VORTEIL_A` derzeit **NO-GO**. Dafür wären ein
versionierter, paketweiter Dokumentrangvertrag, eine belegte Basisbrücke und
der Nachweis erforderlich, dass keine höherrangige konkurrierende
Ereignisgrenze gilt. Das Ignorieren der Positionsklauseln oder ihre pauschale
Umdeutung zu `100 %` könnte bei anderen Versicherern falsche Vorteile
erzeugen.

VS-36 gilt damit als vollständig analysierter, technisch verbesserter, aber
fachlich noch nicht sicher entscheidbarer Kandidat. Er wird nicht als
abgeschlossener Ergebnis-Delta gezählt: R69-A bleibt `10/40`, und die
unbestätigte 224-Zeilen-Projektion bleibt unverändert. Ein Gesamtvollrun und
ein Deployment wurden nicht durchgeführt.

### 10.33 FE-A05 Schritt 1 – seitenübergreifende Listenprovenienz

#### 10.33.1 Reproduzierter Ausgang und Fehlerkette

Der frische FE-A05-Ziellauf auf `bf152f4b` bestätigt den historischen
Paketbefund am aktuellen Code:

```text
Artefakt: QA/FE-A05-BASELINE-BF152F4B-20260903
Summary: 0c9ec38b0d5f68e1f14c55489e862d098224e6503a922e70d98e3f1001688e45
Selection: b5623f18a1513a55ecc3c8cf5f35a12bd499d047a46a2ec02ec21dc140527303
A: BELEGT
B: TEILBELEGT
Ergebnis: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
Blocker: MULTIPLE_ATOMS_SAME_COMPONENT plus zweimal SCOPE_INCOMPLETE auf B
Triage-/Evidence-Aufrufe: 3/1
```

Das ist kein Alias- oder Nullfundfehler. A/DOC-01 und B/DOC-02/DOC-03
enthalten direkte Treffer; die weiteren sieben B-Dokumente enden nach
vollständiger kontrollierter Suche lokal ohne Kandidat.

Die neue Ursachenprüfung zeigte stattdessen einen vorgelagerten
Strukturfehler: Der A-Fund auf PDF-Seite 7 endet im normalen seitenlokalen
`LIST_ITEM`-Kontext bei `Gebäuden am Versicherungsgrundstück, an`. Die daran
hängende konkrete Objektliste beginnt auf Seite 7 und läuft auf Seite 8
weiter. Ohne einen eigenen Fortsetzungsnachweis darf A deshalb nicht als
unbegrenzter allgemeiner Scope gegen die engeren B-Klauseln gereiht werden.

#### 10.33.2 Outcome-neutraler Provenienzvertrag

```text
bc309cfb9 fix(analysis): prove nested list continuations
f59ba5f64 style(analysis): format nested list proof
79f8eec38 fix(contract): version FE-A05 continuation proof
```

`NESTED_LIST_CONTINUATION_PROOF_V1` wird nur nach explizitem Komponenten-Opt-in
erzeugt; aktuell besitzt ausschließlich
`FE-A05:indirect_lightning_damage` dieses Opt-in. Der bestehende
Occurrence-Kontext bleibt byteinhaltlich und seitenlokal unverändert.

Ein Proof wird nur erzeugt, wenn Parent-Listitem, Unterlistenstil, direkte
Folgeseite, kanonischer Seitenseparator und Seitenfortsetzung zusammenpassen.
Er enthält für jede physische Seite eigene Dokument-/Seitenoffsets, exakten
Text und SHA-256, außerdem Seitengap, Seitenkopf, Stop-Grenze und Gesamtdigest.
Leerzeile, Strukturüberschrift, gleichrangiger Listeneintrag, geschlossener
Parent-Satz oder mehr als 3.200 Zeichen führen fail-closed zu keinem Proof.

Der FE-Katalog wurde dafür auf `fe-occurrence-full-draft-v0.9` und das
Produktprofil auf
`CUSTOMER_CORE_5_V82_FE_A05_LIST_CONTINUATION_PROOF` versioniert. Der Proof
hat noch keinen fachlichen Consumer und ändert absichtlich weder
Deckungswirkung noch Ergebnis.

#### 10.33.3 Mac-Studio-Nachweis und reales Dokumentdelta

```text
Commit: 79f8eec38f17cadfbc1892de9762360d343be460
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Format: PASS
Fokussiert/angrenzend Schritt 1: 206/206 PASS
Profil-/Katalog-/Result-Nachprüfung: 159/159 PASS
Breit: 108/111 Suites, 1630/1654 Tests PASS
Restfehler: ausschließlich 24 bekannte historische VS-Katalog-Fixturefehler
```

Der akzeptierte reale Lauf nimmt FE-A05 und FE-A06 gemeinsam auf, damit Limits
aus FE-A06 nicht versehentlich nach FE-A05 verschoben werden:

```text
Artefakt: QA/FE-A05-A06-VERSIONED-PROOF-79F8EEC3-20260903
Summary: 7a5fae57bade9489ffcd4ceb4f614df25f6029fc6fb549fc100915d7ed7b96fc
Selection: d3a10795341c8e8b572957f868615c9b347377e45033b99c13060d4fc61c613b
Producer: 60c2d68a3c84152cd8c0e5a34a23c2831fd5283588a115680ac2be17f92e02b0
Dokumente: 10
Triage-/Evidence-Aufrufe: 3/1
Server-Rejects/-Terminals: 11/15
FE-A05: A BELEGT / B TEILBELEGT / UNKLAR
```

Der neue A-Proof verbindet exakt:

```text
Seite 7: Parent plus erste Objekt-Unterliste
Seite 8: fortgesetzte Objekt-Unterliste bis zur ersten Leerzeile
Proof-Digest: a0b21d86e558d1df1d79d344a853fc7d467d0065f39fcd82b92fbb958cec984c
```

#### 10.33.4 Status, Risiko und nächster Schritt

Schritt 1 behebt die fehlende Provenienz, aber noch nicht die fachliche
Scope-Modellierung. Ein sofortiges `GENERAL > NARROW` wäre weiterhin falsch:
A besitzt nun nachweislich selbst eine konkrete Objektliste, während B zwei
Klauseln mit verschiedenen Objektmengen und Geltungen enthält. Auch ein
pauschales Zusammenlegen der B-Atome würde Bedingung und Dokumentwirkung
verlieren.

Nächster zulässiger Schritt ist ein eigener typisierter Objekt-Scope-Vertrag:
sourcegebundene Scope-IDs pro Klausel, paketweite Union nur kompatibler
Einschlüsse und Erhalt von Bedingungen. Erst danach darf ein Setvergleich
identische Menge, echte Obermenge, Überlappung oder offene Dokumentbeziehung
unterscheiden. FE-A06-Werte bleiben außerhalb dieses Vertrags.

Es gibt noch kein Ergebnisdelta: FE-A05 bleibt in R69-A offen, R69-A bleibt
`10/40`, und die unbestätigte 224-Zeilen-Projektion ändert sich nicht. Kein
Gesamtvollrun und kein Deployment.

### 10.34 FE-A05 – Listenproof gegen gespeicherte und externe Manipulation abgesichert

Der in 10.33 erzeugte Seitenfortsetzungsbeweis wurde zunächst nur bei seiner
Erzeugung geprüft. Vor einer fachlichen Verwendung fehlte noch ein
eigenständiger Replay-Validator. `6a48d2dba` ergänzt deshalb
`validNestedListContinuationProof(...)`; `618bcaeb2` ist der ausschließlich
mechanische Formatierungs-Forward-Fix.

Der Validator rekonstruiert den erwarteten Proof aus den autoritativen
Dokumentbytes und der validierten PageMap. Gespeicherte Occurrence- und
Proof-Offsets, physische Seiten, Segmenttexte und -Hashes, Seitenseparator,
Seitenvorspann, Stop-Grenze und Gesamtdigest müssen kanonisch exakt
übereinstimmen. Geänderte Originalbytes oder PageMap-Grenzen werden ebenfalls
abgelehnt. Der Schritt hat weiterhin keinen fachlichen Outcome-Consumer.

Mac-Studio-Nachweis:

```text
Commit: 618bcaeb2da86b0706268039cb4d410b98ab1f6c
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Format: PASS
Fokussiert/angrenzend: 198/198 PASS
Artefakt: QA/FE-A05-A06-PROOF-VALIDATOR-618BCAEB-20260903
Summary: 3d7b99c41cb844aa38565bdb301f2b5197d0bfed7e8290c5deeb1bda11be6991
Producer: 60c2d68a3c84152cd8c0e5a34a23c2831fd5283588a115680ac2be17f92e02b0
Dokumente: 10
Triage-/Evidence-Aufrufe: 3/1
Server-Rejects/-Terminals: 11/15
FE-A05: A BELEGT / B TEILBELEGT / UNKLAR
```

Gegenüber dem gebundenen Lauf aus 10.33 bleiben Paketstatus, Ergebnis,
Aufrufzahlen und technische Kontrollzahlen unverändert. Das ist das erwartete
Ergebnis eines rein beweissichernden Schritts. R69-A bleibt `10/40`; kein
Gesamtvollrun und kein Deployment. Als nächster Schritt werden typisierte,
quellgebundene Objekt-Scope-Fakten zunächst nur diagnostisch materialisiert.

### 10.35 FE-A05 Schritt 2 – quellgebundene Objekt-Scope-Fakten materialisiert

Die bisherige Einteilung `GENERAL/NARROW` reicht für FE-A05 nicht aus: Beide
Pakete nennen konkrete, teilweise überlappende Objektgruppen. Die Commits
`aa417dec5` und `b74d5c265` ergänzen deshalb den generischen, komponentenweise
opt-in-fähigen Vertrag `SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_V1`.
`622ee50ae` versioniert FE-Katalog und Produktprofil; `bf6e87c86` korrigiert
ausschließlich die historische QA-Versionserwartung.

Der Vertrag materialisiert noch keine Deckungs- oder Vergleichsaussage. Er
erzeugt nur dann eine Scope-Assertion, wenn ein Katalogmuster vollständig in
einem lokalen `LIST_ITEM`/`PARAGRAPH` oder in einem zuvor gegen Originalbytes
und PageMap validierten Fortsetzungssegment liegt. `WORD_WINDOW_FALLBACK`,
seitenweite Texte und Nachbarklauseln sind ausgeschlossen. Jede Assertion
bindet Objekt-Key, Quellart, Seite, Offsets, exakten Text, Text-Hash,
Matcher-Contract-Digest und gegebenenfalls den Parent-Proof-Digest.

Im echten Zehn-Dokument-Lauf wurden exakt folgende Fakten erzeugt:

```text
A / DOC-01:
  BUILDING_ELECTRICAL_INSTALLATIONS
  OBJECTS_OUTSIDE_BUILDINGS
  UNDERGROUND_CABLES
  Quelle: nur validierte NESTED_LIST_CONTINUATION-Segmente

B / DOC-02:
  BUILDING_ELECTRICAL_INSTALLATIONS
  OBJECTS_OUTSIDE_BUILDINGS
  Quelle: je eigener lokaler LIST_ITEM auf Seite 1

B / DOC-03:
  UNDERGROUND_CABLES
  Quelle: eigener lokaler PARAGRAPH auf Seite 11

B / DOC-02 Seite 11:
  kein Scope-Fakt aus WORD_WINDOW_FALLBACK
```

Mac-Studio-Nachweis:

```text
Commit: bf6e87c860a4037173418cb1910315691ea5daed
Profil: CUSTOMER_CORE_5_V83_FE_A05_OBJECT_SCOPE_EVIDENCE
FE-Katalog: fe-occurrence-full-draft-v0.10
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Fokussiert/angrenzend: 212/212 PASS
Breit: 57/60 Suites, 1125/1149 Tests PASS
Restfehler: ausschließlich 24 bekannte historische VS-Profil-Fixtures
Artefakt: QA/FE-A05-A06-OBJECT-SCOPE-BF6E87C8-20260903
Summary: f78f3ac1aa0a31195359555c019c873aa5d74820cd82fe445b4ae57825c29994
Selection: 387784fb7b4506bd9cad04dbeaf127280e03cf593cc7e98cd25f865c55be0120
Producer: e570458308a3bc4707015ccba18746ea3706aaf89d40a31d8c4465205e6f7e63
Dokumente: 10
Triage-/Evidence-Aufrufe: 3/1
Server-Rejects/-Terminals: 11/15
FE-A05: A BELEGT / B TEILBELEGT / UNKLAR
```

Das unveränderte Ergebnis ist beabsichtigt: Der Proof befindet sich bisher nur
im Worksheet und darf vor ausgewählter Candidate-/Atom-Provenienz noch nicht
entscheiden. Der nächste Schritt ist die outcome-neutrale Weitergabe ausschließlich
der von der Evidenzauswahl gewählten Proofs. Erst danach werden Objekt, Ort,
Nutzung, Installation und Bedingungen zu einer Vergleichsrelation verbunden.
R69-A bleibt `10/40`; kein Gesamtvollrun und kein Deployment.

### 10.36 FE-A05 Schritt 2b – interne Candidate-Provenienz ohne Promptänderung

`be7b27c25` erhält den validierten Objekt-Scope-Proof im serverinternen
Prepared Candidate. Ein Parent-Listenproof wird nur mitgeführt, wenn eine
tatsächlich erzeugte Assertion aus dessen Fortsetzungssegment stammt.
`fc2bd524f` versioniert diese interne Artefaktsemantik als Produktprofil V84.

Vor dem Modellaufruf wird eine eigene Payload-Projektion aufgebaut, die
`objectScopeProof` und `nestedListContinuationProof` vollständig entfernt.
Gegen dasselbe Target ohne Provenienz ist die JSON-Payload bytegleich. Weder
Qwen noch das materialisierte Judgement erhalten die neuen Felder; daher
bleiben Tokenmenge, Auswahlvertrag und fachlicher Outcome unverändert. Ein
intern inkonsistenter Parent-Proof wird fail-closed nicht in den Candidate
übernommen.

Mac-Studio-Nachweis:

```text
Commit: fc2bd524f63c8f2a89111ee6a13faf5692fa1586
Profil: CUSTOMER_CORE_5_V84_FE_A05_INTERNAL_SCOPE_PROVENANCE
Fokussiert/angrenzend: 199/199 PASS
Artefakt: QA/FE-A05-A06-INTERNAL-SCOPE-FC2BD524-20260903
Summary: d15d807dfac2f01717b95bad2293de33b8743d066b533bfc887a8f0fd3aaf390
Selection: 387784fb7b4506bd9cad04dbeaf127280e03cf593cc7e98cd25f865c55be0120
Producer: e570458308a3bc4707015ccba18746ea3706aaf89d40a31d8c4465205e6f7e63
Triage-/Evidence-Aufrufe: 3/1
Server-Rejects/-Terminals: 11/15
FE-A05: A BELEGT / B TEILBELEGT / UNKLAR
```

Im realen Lauf enthalten die internen Targets einen Scope-Proof in A/DOC-01,
zwei in B/DOC-02 und einen in B/DOC-03. Die gespeicherten Modellnachrichten
enthalten null Vorkommen der drei Provenienzfelder. Auch
`selected-sources.private.json` enthält sie noch absichtlich nicht: Für diese
Trust Boundary fehlen dem bisherigen Effects-CLI die autoritativen
Dokumentbytes. Der nächste Schritt macht das Dokumentartefakt bei
Object-Scope-Opt-in verpflichtend und replayt nur ausgewählte Proofs gegen die
Originalbytes. R69-A bleibt `10/40`; kein Gesamtvollrun und kein Deployment.

### 10.37 FE-A05 Schritt 2c1 – ausgewählte Scope-Proofs gegen Originalbytes replayt

`ad3448dfc` ergänzt den gemeinsamen Selected-Source-Replay;
`69bbc48c2` ist sein Formatierungs-Forward-Fix. `6d70af9b4` versioniert den
Schritt als Produktprofil V85.

Sobald Prepared Targets Objekt-Scope-Provenienz enthalten, bindet der Replay
Worksheet, Dokumentartefakt, Target, Komponente und Occurrence gemeinsam.
Candidate- und Occurrence-Proof müssen kanonisch gleich sein. Der
Parent-Listenproof wird erneut gegen Originalbytes und PageMap validiert;
danach werden Matcher-Contract, Object-Proof und alle Match-Spans samt Seite,
Offsets, Text und SHA-256 geprüft. Fehlende, zusätzliche oder entfernte
Provenienz sowie ein Proof ohne Komponenten-Opt-in brechen fail-closed ab.
Unselektierte Proofs werden geprüft, aber nie ausgegeben.

Mac-Studio-Nachweis:

```text
Commit: 6d70af9b479dda1f67367e1e6e33a4a65b54ef96
Profil: CUSTOMER_CORE_5_V85_FE_A05_SELECTED_SCOPE_REPLAY
Fokussiert/angrenzend: 224/224 PASS
Artefakt: QA/FE-A05-A06-SELECTED-REPLAY-6D70AF9B-20260903
Summary: 0e4fff646b1417fc480935eb77f1033a05de605929ad9b690caf16fdb84a68d5
Replay: selected-scope-replay.private.json
Replay-SHA: ec8b9d984ba7ec1461a08dbe45d54105af7eebeab2424f28398f6acde21c9208
Selection: 387784fb7b4506bd9cad04dbeaf127280e03cf593cc7e98cd25f865c55be0120
Dokumente im Replay: 10
Ausgewählte Sources: 8
Davon mit validiertem Object-Scope-Proof: 4
FE-A05: A BELEGT / B TEILBELEGT / UNKLAR
```

Die vier Proof-Sources sind exakt A/DOC-01 (drei Keys), B/DOC-02 (zwei
getrennte Seite-1-Sources mit je einem Key) und B/DOC-03 (Erdkabel-Key). Nur
A/DOC-01 benötigt den Parent-Listenproof. Das Ergebnis bleibt unverändert, da
der Replay noch keine Vergleichsrelation erzeugt.

Nächster Schritt: den bereits vorhandenen Dokumentartefaktpfad im
Prepared-Evidence-CLI bei Object-Scope-Opt-in verpflichtend machen und diesen
gemeinsamen Replay für `selected-sources.private.json` verwenden. R69-A bleibt
`10/40`; kein Gesamtvollrun und kein Deployment.

### 10.30 VS-24 – Gerüstkosten nach Glasschaden ohne erfundenes Limit

#### 10.30.1 Reproduzierter Fehler und fachliche Ursache

Der gebundene Ausgangslauf behandelte bei VS-24 sowohl die Gerüstkosten als
auch ein eigenes Gerüstkostenlimit als Pflichtkomponenten. In den zehn
bereitgestellten Dokumenten existiert auf beiden Seiten ein positiver,
inhaltlich passender Gerüstkostenbeleg im Glasbruchbereich. Ein eigenes lokal
zu dieser Leistung gehörendes Limit ist dagegen auf keiner Seite dokumentiert.
Dadurch wurden zwei tatsächlich vollständige Deckungsbelege künstlich zu
Teilbelegen herabgestuft.

Die in der Nähe vorkommenden Werte sind keine Gerüstkostenlimits:

- die `50 %` auf Seite A gehören zu einer anderen Leistung;
- `EUR 5.000` und `EUR 1.000` auf Seite B gehören ebenfalls zu anderen
  Klauseln.

Ein globales Übernehmen benachbarter Zahlen hätte deshalb falsche Limits
erzeugt. Umgekehrt durfte das Weglassen des Limits nicht automatisch zu
`unbegrenzt` umgedeutet werden. Die korrekte Aussage lautet ausschließlich:
Auf beiden Seiten sind Gerüstkosten nach einem versicherten Glasschaden
dokumentiert; für keine Seite ist ein eigenes lokales Gerüstkostenlimit
dokumentiert.

#### 10.30.2 Kleine Forward-Fixes und Abhängigkeiten

Die Änderung wurde in getrennten, erhaltenen Schritten aufgebaut:

```text
ad6a1f252  fix(analysis): make VS-24 limit optional
878879a86  fix(analysis): bind VS-24 optional limits locally
c013bfbd2  style(analysis): format VS-24 local limit binding
107ec1b7f  fix(analysis): preserve exact VS-24 comparison scope
fbe80848e  style(test): format VS-24 scope cases
23f298add  test(analysis): use explicit VS-24 cost governor
e6fd49301  fix(comparison): gate VS-24 by exact scope identity
bae7e898b  style(test): format VS-24 scope hardening
aab4344bc  feat(comparison): certify VS-24 glass cost equality
507b642ac  style(comparison): format VS-24 equality contract
0c41acdee  test(comparison): replay VS-24 wording symmetrically
71a010732  test(comparison): isolate VS-24 contract fixtures
ccf4834ca  fix(comparison): replay VS-24 customer evidence
6de49731c  style(comparison): format VS-24 customer replay
```

Der Katalog `vs-occurrence-full-draft-v0.16` deklariert nur noch
`scaffolding_costs/COST` als Pflichtkomponente; `limit` bleibt ein optionales
Feld derselben Komponente. Der lokale Feldbinder darf ein Limit nur aus der
gebundenen Gerüstkostenklausel übernehmen. Die genaue enge Scope-Identität
`GLASBRUCH_INSURANCE` wird von der deterministischen Auswahl über Prepared
Evidence, Package Summary und kanonisches Atom bis in die Vergleichsprüfung
erhalten. Mehrere oder widersprüchliche enge Scopes bleiben fail-closed und
erzeugen keine Gleichheit.

Der Vergleichsvertrag akzeptiert VS-24 nur unter allen folgenden Bedingungen:

1. exakt VS-24 und `scaffolding_costs/COST`;
2. auf beiden Seiten vollständige Paketmanifeste und `BELEGT`;
3. je Seite exakt ein positives Atom mit `INCLUDED` und deterministischer
   Direktbindung;
4. auf beiden Seiten exakt `GLASBRUCH_INSURANCE`;
5. keine offenen Kandidaten, Konflikte, bedingten oder optionalen
   Deckungsformulierungen;
6. kein lokales Gerüstkostenlimit auf einer Seite;
7. keine Zahl, Prozentangabe, Kappung oder Unbegrenzt-Markierung im lokalen
   Quelltext.

Versionierte Bindungen:

```text
Produktprofil:
CUSTOMER_CORE_5_V64_VS24_CUSTOMER_REPLAY_VALIDATION
Kanonischer Atomvertrag:
PACKAGE_MEMBER_CANONICAL_ATOM_V2
Requirement-Digest:
2ccf74464a4dbc28c3855e771ba3ae9918f73da28dd5181235941a5c2ee0495d
Audit:
VS24_GLASS_LOSS_SCAFFOLDING_COST_EQUALITY_AUDIT_V1
Vergleichsregel:
VS24_EQUIVALENT_GLASS_LOSS_SCAFFOLDING_COST_WITHOUT_LOCAL_LIMIT_V1
Replay:
VS24_SOURCE_ATOM_DIGEST_REPLAY_V1
Reason-Code:
EQUIVALENT_GLASS_LOSS_SCAFFOLDING_COST_WITHOUT_LOCAL_LIMIT
```

Die Customer-Validierung rekonstruiert die Entscheidung aus den projizierten
Atomen und verwirft manipulierte private Replays. Der öffentliche Safe View
entfernt den privaten Replay-Baustein.

#### 10.30.3 Mac-Studio-Validierung

```text
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Commit: 6de49731c5f9448f52558c6e4916b649ccab72cb
Runtime: AuditRuns/QWEN36-FULL-20260831-7ab999c6/repo
Node: v22.23.2
Modell im Zielweg: qwen/qwen3.6-35b-a3b
Kontextfenster: 42496
Formatprüfung: PASS
Fokussierte Regression: 8/8 Suites, 219/219 Tests PASS
Breite Utility-Regression: 106/109 Suites, 1581/1605 Tests PASS
```

Die 24 roten Tests gehören exakt zu den drei bereits bekannten historischen
QA-Fixtures:

```text
targetedCategoryMaterializationContract.test.js
targetedQaManifestContract.test.js
baselineWorksheetRebuildContract.test.js
TARGETED_QA_PROFILE_CATALOG_MISMATCH: VS
```

Es ist keine neue VS-24- oder Nachbarfehlersignatur entstanden. Zusätzlich
wurde VS-22 auf demselben Commit erneut über alle zehn Dokumente ausgeführt:

```text
QA-Artefakt: VS-22-POST-VS24-6DE49731-20260903
Summary-Digest:
ba8a19f0410baf56c3dad8d4d3477ab74be13179fee433311999d2f65d155d36
Target-Selection-Digest:
4f10a4c48c2aa3ab0789529cf294f9ad83f7c98ff517e0606bddd09a040890df
Producer-Digest:
3a0e13e4f67abfd4d0ca08c6dc89a228f5da54e55619a6625f2984170a0eeb9a
Triage-/Evidence-Aufrufe: 3 / 3
Serverrejects/-terminals: 38 / 25
Ergebnis: VORTEIL_A / kein Review
```

Damit ist nachgewiesen, dass die VS-24-Katalogänderung den bereits
abgenommenen VS-22-Zielweg nicht zurückgesetzt hat.

#### 10.30.4 Gebundene Zehn-Dokument-Läufe

Alle Läufe verwenden dasselbe unveränderte Eingabemanifest:

```text
50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
```

```text
Lauf                          Summary-Digest                                                    Ergebnis
BASELINE-F795FE7E             4201c001f86fc84f1fa33d1bb11c4bd0fc7ee0cf0868a432bc2aff4070be054a  UNKLAR / Paketstatus blockiert
OPTIONAL-LIMIT-C013BFBD       09903156eef6d23d280390207cb210b5923238f54775d1541c8a015e463a1fd6  UNKLAR / nur Scopeblocker
SCOPE-23F298AD                0d6f79b1ce69004404f7eaaedc093323b9372723c0a3dacbf55bff504fb064b2  A/B BELEGT, noch UNKLAR
SCOPE-GATE-BAE7E898           f4c627f46f81cedd6e0681458194efb6f07baf915c9e28815a94a5ffa3298e3d  absichtlich UNKLAR
EQUALITY-71A01073             30de7bf7b6aef89f6bb19b3b7a301eb38b1485716042cd073e0d8bfc3eb487fc  GLEICHWERTIG / kein Review
CUSTOMER-REPLAY-6DE49731      d76d845bcd15c27dec393647d0159a1ff3c907a71d02f352992a02f5112deb10  GLEICHWERTIG / kein Review
```

Finale Artefaktbindungen:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-24-CUSTOMER-REPLAY-6DE49731-20260903
Katalog-Digest:
cc758d1774524484226af571ea51a7928017d805a3dcda5269f9495394c96144
Target-Selection-Digest:
8c373eee9b7d8f070666fc7a5988bbff83a97de98e1b476baecfd80572551a5b
Producer-Digest:
7b60ebcd1373059bb0eaa9cf77a6949d93e64299a56af7cbb24455d890e8a276
Dokumente: 10, davon A: 1 und B: 9
Triage-/Evidence-Modellaufrufe: 0 / 0
Triage-Serverrejects: 2
Evidence-Serverterminals: 8
```

Reale positive Quellen:

```text
A: 4417a01f-7f73-44de-979a-3dcf9e65ca63, MAIN_POLICY,
   FRAMEWORK_TERMS, physische Seite 15, "Kosten für Gerüste"
B: 6fc71468-…, SUPPLEMENT, FRAMEWORK_TERMS,
   physische Seite 14, "Gerüstkosten"
Scope beider Seiten: GLASBRUCH_INSURANCE
A-Atomdigest: 2c1029148873d6b80ff11a31992fabf7874aac17889d08956a8c690b2e52caaa
B-Atomdigest: cac24a765514f31d66771f8514b1f9584b877ecbfd4df15e71ef35a7fac495cd
```

Der gezielte Lauf bestätigt die Fachentscheidung aus den zehn Dokumenten. Er
ruft `summarizePackage` und `decidePoint` direkt auf; der Name
`CUSTOMER-REPLAY` darf deshalb nicht als echter Builder-zu-Customer-E2E-Lauf
verstanden werden. Den Customer-Validator, den Tamper-Abbruch und das
Entfernen des privaten Replays bestätigt die fokussierte Mac-Test-Suite mit
manuell aufgebautem Customer Result.

#### 10.30.5 Ergebnis, Projektion und Beweisgrenze

VS-24 ist im gebundenen Zielpaket nun `GLEICHWERTIG` ohne Kundenreview. Die
noch nicht durch einen neuen 224-Zeilen-Lauf bestätigte Projektion verschiebt
sich damit von

```text
VORTEIL_A 3 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 121 / NICHT_VERGLEICHBAR 12 / UNKLAR 52
```

auf

```text
VORTEIL_A 3 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 122 / NICHT_VERGLEICHBAR 12 / UNKLAR 51
```

R69-A steht damit bei `9/40`; `31` Fälle der Ausgangsfamilie bleiben offen.
Das ursprüngliche 40er-Inventar und die historische Komponentenliste bleiben
als Ausgangsbefund unverändert.

Der Nachweis gilt für die bekannten zehn Dokumente und die synthetischen
positiven, negativen, adversarialen und Scope-Varianten. Es wurde noch kein
unbekannter Versicherer-/Dokument-Holdout bestanden; daraus folgt keine
99-Prozent-Aussage. Der Vertrag ist bewusst auf VS-24, Glasbruchscope, exakt
eine positive Gerüstkostenquelle je Seite und fehlende lokale Limitangabe
begrenzt. Die privaten Hash-Replays belegen interne Revisionskonsistenz, sind
aber keine externe Signatur gegen vollständiges Neuschreiben aller Artefakte.
Der VS-24-Audit bezieht PDF-SHA und PageMap über das vorgelagerte
Target-Pipeline-Gate; er validiert diese beiden Provenienzen nicht nochmals
selbstständig.

Ein vollständiger 224-Zeilen-Lauf und ein Deployment wurden nicht
durchgeführt. Die installierte Kundenanwendung blieb unverändert.

#### 10.30.6 Nachaudit nach der VS-25-Härtung

Die spätere VS-25-Arbeit berührte gemeinsame Atom-, Result- und
Customer-Validierungsgrenzen. Deshalb wurde VS-24 auf dem finalen VS-25-Commit
erneut über dieselben zehn Dokumente ausgeführt:

```text
Commit: 22dab16c74ac789e2cf310a09b520593985f4290
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-24-POST-VS25-22DAB16C-20260903
Summary-Digest:
8dd5afa277a53987ef8ce4daf0785fa2d6e03dc093b64e18b38db53577f20f73
Ergebnis: GLEICHWERTIG / kein Review
Reason-Code: EQUIVALENT_GLASS_LOSS_SCAFFOLDING_COST_WITHOUT_LOCAL_LIMIT
Regel: VS24_EQUIVALENT_GLASS_LOSS_SCAFFOLDING_COST_WITHOUT_LOCAL_LIMIT_V1
Triage-/Evidence-Modellaufrufe: 0 / 0
Triage-Serverrejects: 2
Evidence-Serverterminals: 8
```

Zwei zusätzliche Forward-Fixes aus dem unabhängigen VS-24-Nachaudit bleiben
Teil der Historie:

```text
8d6d563ad  fix(comparison): disclose VS-24 proof boundary
b890d0d7a  fix(comparison): reject implicit VS-24 limit language
```

Der Nachaudit bestätigt, dass VS-25 die enge VS-24-Entscheidung nicht
verändert hat. Er ist kein neuer 224-Zeilen-Gesamtlauf.

### 10.31 VS-25 – behördliche Mehrkosten mit relativer Prozentgrenze

#### 10.31.1 Ausgangsfehler und verworfener Fehlabschluss

Im Ausgangszustand blieb VS-25 `UNKLAR`, obwohl Paket A ein direktes Limit von
`10 % auf Erstes Risiko` und Paket B ein direktes Limit von `5 % des
Neubauwerts` dokumentiert. Paket B enthält zusätzlich den errechneten
Eurobetrag `EUR 1.530.400`; der gebundene VS-01-Neubauwert beträgt
`EUR 30.608.000`. Die Rechnung `30.608.000 × 5 % = 1.530.400` geht centgenau
auf. Damit darf die Prozent- und Eurodarstellung innerhalb von Paket B als
dieselbe Grenze versöhnt werden. Der fachlich belegte Vergleich ist jedoch
nur `10 % > 5 %`; ohne einen beidseitigen Euro-Neubauwert ist kein absoluter
Eurovorteil für A bewiesen.

Ein früher Zwischenstand auf Commit `2165289ad` meldete bereits
`VORTEIL_A`. Der unabhängige Audit verwarf ihn: Ein B-Dokument hatte für beide
VS-25-Atome `NOT_FOUND`, aber zugleich `SEARCH_INCOMPLETE`, kein
Zero-Occurrence- und kein Zero-Candidate-Terminal. Die damalige Abwesenheits-
Prüfung hätte dieses Dokument trotzdem als vollständig negativ behandelt.
Dieser Lauf ist ausdrücklich **kein akzeptierter Nachweis**.

#### 10.31.2 Kleine Forward-Fixes und Sicherheitsgrenzen

Die Korrektur wurde ohne Rückbau in getrennten Commits aufgebaut:

```text
9b8939c5c  fix(comparison): validate VS-25 customer replay
52f0461e8  style(comparison): format VS-25 replay validation
ee080e52e  fix(comparison): bind VS-25 source semantics
0d0531792  style(comparison): format VS-25 source binding
cfa94300c  fix(analysis): certify VS-25 allocation-only terminals
2bf1ae8fb  style(analysis): format VS-25 terminal contract
9d29e576d  fix(comparison): bind VS-25 local limit basis
1d4060c0a  style(test): format VS-25 local basis cases
6102f192a  fix(analysis): persist VS-25 limit basis proof
22dab16c7  fix(analysis): bind section-governor basis source
```

Der finale Vertrag verlangt unter anderem:

1. für jedes erwartete Dokument exakt die gebundenen VS-25-Komponenten;
2. bei `NOT_FOUND` einen vollständig kontrollierten oder zertifizierten
   Suchabschluss beziehungsweise ein enges deterministisches Terminal;
3. direkte, ausgewählte und quellgebundene Limitfelder mit gültiger Einheit,
   `CAPPED`-Limitart, Seite und Offsets;
4. eine lokal gebundene Prozentbasis und kompatible Qualifier;
5. die Rekonstruktion des verwendeten VS-01-Basisbetrags aus dem exakten Atom,
   nicht aus einem frei übergebenen Auditwert;
6. eine centgenaue Reconciliation zwischen Prozentwert, Basis und Eurobetrag;
7. lokale Klauselcode-, Präfixbedingungs- und Scope-Prüfung;
8. Source-/Reference-Atom-Digest-Replay, Dokumentmanifest-SHA und erneute
   Customer-Validierung der Entscheidung.

Das B-Dokument `759b582e-…` enthält nur eine
`Summenausgleich`-Formulierung: behördliche Mehrkosten für Gebäude und Inhalt
gelten gemeinsam summarisch versichert. Das ist weder ein neuer Einschluss
noch ein eigenes Limit. Der versionierte Terminalvertrag
`DETERMINISTIC_VS25_SUM_EQUALIZATION_TERMINAL_V1` akzeptiert diesen Befund nur
mit exaktem lokalem Wortlaut, ohne eigene EUR-/Prozent-/Erstrisiko- oder
Leistungszusage, mit gebundenen Occurrence-Offsets, vollständiger Suche und
exaktem Rejection-Digest. Andere Formulierungen bleiben fail-closed.

Der Zwischencommit `1d4060c0a` war ebenfalls noch nicht akzeptabel: Ein
pauschales 240-Zeichen-Fenster trennte im echten A-Dokument den gültigen
Abschnitts-Governor vom Limit und führte wieder zu `UNKLAR`. Der Forward-Fix
`22dab16c7` persistiert deshalb die tatsächlich verwendete
`comparisonBasisSource`, statt die Basis später aus einem gekürzten
Reportausschnitt zu erraten.

Versionierte Bindungen:

```text
Produktprofil: CUSTOMER_CORE_5_V78_VS25_PERCENT_DOCUMENT_BASIS_PROOF
Vergleichsregel: VS25_HIGHER_BUILDING_VALUE_PERCENT_LIMIT_V1
Reason-Code: HIGHER_AUTHORITY_RECONSTRUCTION_RELATIVE_LIMIT
```

#### 10.31.3 Mac-Studio-Validierung und Nachbarprüfungen

```text
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Commit: 22dab16c74ac789e2cf310a09b520593985f4290
Runtime: AuditRuns/QWEN36-FULL-20260831-7ab999c6/repo
Node: v22.23.2
Formatprüfung: PASS
Fokussierte Regression: 8/8 Suites, 349/349 Tests PASS
Breite Utility-Regression: 107/110 Suites, 1609/1633 Tests PASS
```

Die 24 roten Tests sind ausschließlich die bereits bekannte historische
Katalog-Fixture-Abweichung `TARGETED_QA_PROFILE_CATALOG_MISMATCH: VS` in drei
Suites. Es entstand keine neue Fehlersignatur.

Nachbarläufe auf exakt demselben Commit:

```text
VS-24:
QA/VS-24-POST-VS25-22DAB16C-20260903
Summary-Digest: 8dd5afa277a53987ef8ce4daf0785fa2d6e03dc093b64e18b38db53577f20f73
Ergebnis: GLEICHWERTIG / kein Review

VS-22:
QA/VS-22-POST-VS25-22DAB16C-20260903
Summary-Digest: 83b90509ab02daa415b3704f020d3fa923763ea3576ef6e1c22b5cac3cddbf5c
Ergebnis: VORTEIL_A / kein Review
Triage-/Evidence-Aufrufe: 3 / 3
Serverrejects/-terminals: 38 / 25
```

#### 10.31.4 Finaler gebundener Zehn-Dokument-Lauf

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-25-BASIS-SOURCE-PROOF-22DAB16C-20260903
Summary-Digest:
4b76d2f4843961ccd60e1779d7dc789fd030dece30399059a03c708e2552b8db
Producer-Digest:
56c7f4656ccbed11b7167476973f151e4675369c500fecc36ec019d7b344d4ec
Target-Selection-Digest:
aed1c9e39129d53361eef4a4f3b4604398940bcbd4824f2eb93aa40e54fe4614
Dokumente: 10, davon A: 1 und B: 9
Triage-/Evidence-Modellaufrufe: 0 / 0
Triage-Serverrejects: 26
Evidence-Serverterminals: 21
Ergebnis: VORTEIL_A / kein Review
Reason-Code: HIGHER_AUTHORITY_RECONSTRUCTION_RELATIVE_LIMIT
Standalone-Replayvalidierung: PASS
```

Das Ergebnis bedeutet ausschließlich: Paket A dokumentiert mit `10 %` die
höhere relative Grenze gegenüber `5 %` in Paket B. Die zusätzliche
Eurodarstellung in B wurde auf denselben 5-Prozent-Wert zurückgeführt. Das
Ergebnis behauptet nicht, dass A in Euro höher liegt.

#### 10.31.5 Delta, Status und Beweisgrenze

Die noch nicht durch einen neuen 224-Zeilen-Lauf bestätigte Projektion
verschiebt sich gegenüber dem akzeptierten VS-24-Stand von

```text
VORTEIL_A 3 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 122 / NICHT_VERGLEICHBAR 12 / UNKLAR 51
```

auf

```text
VORTEIL_A 4 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 122 / NICHT_VERGLEICHBAR 12 / UNKLAR 50
```

R69-A steht damit bei `10/40`; `30` Fälle der Ausgangsfamilie bleiben offen.
Das ist eine aus einzeln bestätigten Deltas berechnete Projektion und keine
neue Gesamtmessung. Der Nachweis gilt für die bekannten zehn Dokumente und
die implementierten positiven, negativen, adversarialen, Scope-, Replay- und
Manipulationsprüfungen. Ein unbekannter Versicherer-/Dokument-Holdout wurde
noch nicht bestanden; daraus folgt keine 99-Prozent- oder allgemeine
Gebäudeversicherungs-Aussage.

Ein vollständiger 224-Zeilen-Lauf und ein Deployment wurden nicht
durchgeführt. Die installierte Kundenanwendung blieb unverändert.

#### 10.31.6 Nachaudit: Neubauwertbeleg im Prozentdokument

Ein weiterer unabhängiger Mehrdokument-Audit fand nach `22dab16c7` eine
generische Restlücke: Der Vertrag verlangte mindestens einen gültigen
VS-01-Neuwertbeleg auf derselben Paketseite, aber noch nicht zwingend in genau
dem Dokument, das die Prozentgrenze formuliert. Bei mehreren versicherten
Gebäuden hätte dadurch theoretisch der Neuwertbeleg eines anderen Dokuments
die Prozentbasis legitimieren können.

Commit `95e4912ad30099d8dbeec15629e4ab59f0ea264d` verlangt deshalb zusätzlich
einen vollständigen VS-01-Neuwertbeleg in der Dokument-UUID der
Prozentpräsentation. Bei der Prozent-/Euro-Reconciliation bleibt der bereits
streng gebundene Geldbasisbeleg im Dokument der Europräsentation zusätzlich
erforderlich. Die neue adversariale Prüfung entfernt nur den Neuwertbeleg im
Prozentdokument und bestätigt den fail-closed-Abbruch; der echte Kundenfall
besitzt beide Bindungen.

```text
Produktprofil: CUSTOMER_CORE_5_V78_VS25_PERCENT_DOCUMENT_BASIS_PROOF
Mac-Studio-Commit: 95e4912ad30099d8dbeec15629e4ab59f0ea264d
Formatprüfung: PASS
Fokussierte Regression: 8/8 Suites, 350/350 Tests PASS
Breite Utility-Regression: 107/110 Suites, 1610/1634 Tests PASS
Bekannte Fehler: 24 × TARGETED_QA_PROFILE_CATALOG_MISMATCH: VS

QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-25-PERCENT-DOCUMENT-BASIS-95E4912A-20260903
Summary-Digest:
8e9998d6bf6de8ec66640c81d80d3a3e94ce959365fffb2349aea2d7a070ee6a
Target-Selection-Digest:
aed1c9e39129d53361eef4a4f3b4604398940bcbd4824f2eb93aa40e54fe4614
Triage-/Evidence-Modellaufrufe: 0 / 0
Triage-Serverrejects: 26
Evidence-Serverterminals: 21
Ergebnis: VORTEIL_A / kein Review
```

Die Ergebnisprojektion bleibt unverändert. Der Nachaudit erhöht die
Generalisierungssicherheit, erzeugt aber bewusst kein zusätzliches
Kundenergebnis. Ein vollständiger 224-Zeilen-Lauf und ein Deployment wurden
nicht durchgeführt.

### 10.28 VS-21 – Aufräum-/Abbruchkosten und inkompatible Limitformen

#### 10.28.1 Frischer gebundener Ausgangslauf

VS-21 wurde auf dem nach VS-18 gesicherten Stand für alle zehn unveränderten
Kundendokumente neu aufgebaut. Es handelt sich nicht um einen Recallfehler:
beide Kostenkomponenten und die wesentlichen Limits sind vorhanden.

```text
Commit: 253dfbb23b9f12a73c149bc6cf0c6e811d1cd5e2
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-21-BASELINE-253DFBB2-20260903
Summary-Digest:
402ec9345cb383c710c5a2709ba0dfe3ee213e74ba6fa269d8a357469841d3df
Target-Selection-Digest:
52367916ba9973a34f26d4e91098bada32b74aace24516347bad0188ec4f9a4b
Producer-Digest:
69c929d1dfadeddb1485b82b97687ac38b9bbceb892650a940250354b309e710
Paket A: BELEGT / 10 %; 15 %
Paket B: TEILBELEGT / EUR 6.121.600,00 auf Erstes Risiko
Entscheidung: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review
```

Der Paket-Audit enthielt genau zwei Blocker:

1. `UNRESOLVED_CANDIDATE` für Paket B, EABS Seite 6, Komponente
   `demolition_costs`: Die Wertzustandsklausel
   `Gebäude ... zum Abbruch bestimmt` wurde über den nackten Alias `Abbruch`
   als möglicher Kostenbeleg angeboten.
2. `FIELD_INCOMPLETE` für Paket B, EABS Seite 8: Die Klausel
   `gelten die Aufräum-, Abbruch- und Feuerlöschkosten für Gebäude und Inhalt
gemeinsam summarisch versichert` besitzt korrekt kein eigenes Limit.

Die unabhängige Quellenprüfung bestätigt folgende fachliche Limitlage:

- Paket A: Feuer `15 %`, Sturm und Leitungswasser `10 %` der
  Gebäudeversicherungssumme auf Erstes Risiko;
- Paket B: Feuer, Leitungswasser, Sturm und Glas jeweils
  `EUR 6.121.600,00` auf Erstes Risiko;
- Paket A enthält in der VS-21-Quelle keine absolute Gebäudeversicherungs-
  summe. Prozent und Geldbetrag dürfen daher noch nicht gerichtet verglichen
  werden.

#### 10.28.2 Fix 1 – Abbruchreife ist keine Abbruchkostenposition

Commit `b62d160a` ergänzt eine occurrence-lokale, serverautoritative
Rollenregel nur für `VS-21 / demolition_costs`. Sie verwirft `Abbruch` genau
dann, wenn der lokale Text eine Wert-/Nutzungszustandsklausel mit
`zum/für den Abbruch bestimmt/vorgesehen` enthält und kein lokaler
Kosten-Governor vorhanden ist. Der Alias wurde nicht gelöscht. Echte
Abbruchkosten, koordinierte Aufräum-/Abbruchkosten und Kosten eines zum
Abbruch bestimmten Gebäudes bleiben Modell- beziehungsweise Evidenzkandidaten.

Versionierung:

```text
Produktprofil: CUSTOMER_CORE_5_V50_VS21_COST_ROLE
Vergleichsvertrag: ...VS21_COST_ROLE_V11
Commit: b62d160a92f5bcdc52bdc551e2c0b94c7e18baa6
Mac-Studio-Formatprüfung: PASS
Mac-Studio-Suites: 5/5 PASS
Mac-Studio-Tests: 167/167 PASS
```

Der vollständige VS-21-Ziellauf auf denselben zehn Dokumenten belegt die
isolierte Wirkung:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-21-DEMOLITION-ROLE-B62D160A-20260903
Summary-Digest:
10c664998845623d7f5d84b60c34dd7f5b19c18f4c07caddd5afae653ea00f26
Target-Selection-Digest:
52367916ba9973a34f26d4e91098bada32b74aace24516347bad0188ec4f9a4b
Triage-Qwen-Aufrufe: 5
Evidence-Qwen-Aufrufe: 5
```

```text
Vorherige Blocker: FIELD_INCOMPLETE + UNRESOLVED_CANDIDATE
Neue Blocker:      FIELD_INCOMPLETE
Ergebnis vorher:   UNKLAR / Review
Ergebnis nachher:  UNKLAR / Review
```

Damit ist ein realer Fehlkandidat entfernt, aber VS-21 noch nicht
abgeschlossen. R69-A und die unbestätigte Gesamtprojektion bleiben
unverändert. Der nächste getrennte Schritt prüft die bereits vorhandene
Binding Group: Ein gemeinsamer Limitspan darf nur dann auf beide koordinierten
Kostenkomponenten projiziert werden, wenn Gruppen-, Quellen-, Seiten- und
Spanidentität vollständig validiert sind. Eine feldlose Summenausgleichs-
klausel darf dadurch nicht still mit einem fremden Limit vervollständigt
werden.

#### 10.28.3 Fix 2 – Feldprojektion innerhalb validierter Binding Groups

Die Analyse deckte eine zuvor im sichtbaren Zeilenstatus verborgene
Atomlücke auf: Der gemeinsame Limitspan einer koordinierten Phrase wurde nur
dem Kandidaten `cleanup_costs`, nicht dem zweiten ausgewählten Kandidaten
`demolition_costs` derselben Binding Group zugeordnet. Das betraf sowohl die
LF-Prozentwerte als auch die vier gefahrenspezifischen WEVIG-Geldbeträge.

Der neue generische Vertrag
`DECLARED_BINDING_GROUP_FIELD_APPLICABILITY_V1` erhält die ursprüngliche
Feldquelle und Candidate-ID. Er projiziert das Feld nur auf ein ausgewähltes
Schwestermitglied, wenn Requirement, deklarierte Gruppe, Gruppentyp,
`SAME_CANDIDATE_BINDING`, Komponente, physische Seite und der gemeinsame
Kontextbereich vollständig übereinstimmen und der exakte Feldspan innerhalb
jedes beteiligten Kontextes liegt. Andere Requirements, Komponenten, Seiten,
unselektierte Kandidaten und außerhalb liegende Zahlen werden abgewiesen.

```text
Fachcommit: f086146aebe6c91a7d1dbe74b4b4eab65e1f1f9d
Format-Forward-Fix: d5a74814d7c94204139116fa005d5f36b2909b0a
Produktprofil: CUSTOMER_CORE_5_V51_BINDING_GROUP_FIELDS
Vergleichsvertrag: ...VS21_COST_ROLE_BINDING_GROUP_FIELDS_V12
Mac-Studio-Formatprüfung: PASS
Mac-Studio-Suites: 8/8 PASS
Mac-Studio-Tests: 335/335 PASS
```

Der erneute vollständige VS-21-Ziellauf auf allen zehn Kundendokumenten
belegt:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-21-BINDING-FIELDS-D5A74814-20260903
Summary-Digest:
df0e21b30408d611970ff0265a01e5fbb47811c4bb1d6d1b563fd0d8ee165aa0
Target-Selection-Digest:
52367916ba9973a34f26d4e91098bada32b74aace24516347bad0188ec4f9a4b
Triage-Qwen-Aufrufe: 5
Evidence-Qwen-Aufrufe: 5
```

Atomarer Vorher-/Nachher-Nachweis:

```text
Paket A, LF:
cleanup_costs    COMPLETE: 10 %, 15 %
demolition_costs NOT_FOUND -> COMPLETE: 10 %, 15 %

Paket B, Vorschlag:
cleanup_costs    COMPLETE: viermal EUR 6.121.600,00 je Gefahr
demolition_costs NOT_FOUND -> COMPLETE: viermal EUR 6.121.600,00 je Gefahr

Paket B, EABS-Summengemeinschaft:
cleanup_costs    NOT_FOUND, unverändert
demolition_costs NOT_FOUND, unverändert
```

Der verbleibende Kundenblocker ist weiterhin ausschließlich
`FIELD_INCOMPLETE` für die EABS-Summengemeinschaft. Der Fix hat dieser Klausel
kein fremdes Limit zugeschrieben. Das sichtbare Ergebnis bleibt deshalb
vorerst `UNKLAR / Review`; R69-A und die Gesamtprojektion ändern sich in
diesem Zwischenschritt nicht.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

#### 10.28.4 Fix 3 – Summenausgleich als Modifier, Limitformen typisiert abgeschlossen

Die letzte offene EABS-Fundstelle ist keine zusätzliche Limitposition. Ihr
Wortlaut bestimmt ausschließlich, dass Aufräum-, Abbruch- und
Feuerlöschkosten für Gebäude und Inhalt `gemeinsam summarisch versichert`
sind. Sie verändert damit die Verteilung einer vorhandenen
Versicherungssumme, enthält aber weder einen Eurobetrag noch einen Prozentsatz.

Der neue Vertrag `VS21_COST_LIMIT_PORTFOLIO_AUDIT_V1` trennt deshalb zwei
Ebenen, ohne Evidenz zu löschen:

1. Ein Primärportfolio gilt nur, wenn `cleanup_costs` und
   `demolition_costs` jeweils als eingeschlossen, quellengebunden,
   konfliktfrei und mit vollständigem `limit`-Feld belegt sind.
2. Eine feldlose Klausel darf nur als
   `SHARED_SUM_INSURANCE_ALLOCATION_MODIFIER_V1` klassifiziert werden, wenn
   beide Kostenkomponenten auf derselben Dokumentseite denselben lokalen
   Klauseltext zu Aufräum-, Abbruch- und Feuerlöschkosten, Gebäude und Inhalt
   sowie `gemeinsam summarisch versichert` tragen und der Text kein eigenes
   Geld- oder Prozentlimit enthält.
3. Bei `TEILBELEGT` wird der Abschluss nur zugelassen, wenn der bestehende
   Paket-Audit ausschließlich `FIELD_INCOMPLETE` für genau die Dokumente
   dieses zertifizierten Modifiers ausweist. Andere Feld-, Scope-, Konflikt-,
   Quellen-, Kandidaten- oder Rangblocker lassen den Vertrag fehlschließen.
4. Nur die inkompatible Typkombination `PERCENT` gegen `MONEY` wird durch
   diese Regel entschieden. Gleiche oder unbekannte Typen fallen in den
   normalen Vergleichsweg zurück.

Der erste Implementierungsstand war absichtlich zu streng und blieb im
frischen Ziellauf bei `UNKLAR`: Ein niedriger geranktes Bedingungsdokument
enthielt zwei ungelöste, aber laut Paket-Rollup nicht beitragende Kandidaten.
Der Forward-Fix entfernt diese Kandidaten nicht. Er bindet die Ausnahme
stattdessen an den bereits vorhandenen Paket-Audit, der im realen Fall als
einzigen Blocker die EABS-Summenausgleichsklausel bestätigt.

```text
Fachcommit: cc11ec4eaef02348c216e1815bf4c30e1c8b7b91
Format-Forward-Fix: ebf286428bcb6f7977f9660794a3585297c83df9
Fixture-Forward-Fix: e0dd36e86098f54d76b66e9b24d7abeeb2f3d135
Review-Gate-Forward-Fix: 89bfa8821ed7a0cf57341f8e54cc852b6d763a21
Produktprofil: CUSTOMER_CORE_5_V53_VS21_LIMIT_PORTFOLIO_REVIEW_GATE
Vergleichsvertrag: ...VS21_COST_ROLE_BINDING_GROUP_FIELDS_LIMIT_PORTFOLIO_REVIEW_GATE_V14
Mac-Studio-Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Mac-Studio-Commit: 89bfa8821ed7a0cf57341f8e54cc852b6d763a21
Runtime: Node v22.23.2
Modell: qwen/qwen3.6-35b-a3b
Modell-Tokenlimit: 42496
Mac-Studio-Formatprüfung: PASS
Mac-Studio-Suites: 5/5 PASS
Mac-Studio-Tests: 147/147 PASS
```

Der verbindliche frische Zehn-Dokumente-Lauf lautet:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-21-LIMIT-PORTFOLIO-89BFA882-20260903
Summary-Digest:
4bc6967d5d73147a16f598bee3d469811e438740e0a87787b1ac5217465c34b8
Target-Selection-Digest:
52367916ba9973a34f26d4e91098bada32b74aace24516347bad0188ec4f9a4b
Producer-Digest:
69c929d1dfadeddb1485b82b97687ac38b9bbceb892650a940250354b309e710
Triage-Qwen-Aufrufe: 5
Evidence-Qwen-Aufrufe: 5
Triage-Serverablehnungen: 0
```

```text
Paket A: BELEGT; Aufräum- und Abbruchkosten; 10 % / 15 %
Paket B: TEILBELEGT; Aufräum- und Abbruchkosten; EUR 6.121.600,00
EABS-Modifier: gemeinsam summarisch versichert; kein eigenes Limit

Vorher: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review
Nachher: NICHT_VERGLEICHBAR / INCOMPATIBLE_LIMIT_VALUE_TYPES / kein Review
Regel: VS21_INCOMPATIBLE_LIMIT_VALUE_TYPES_V1
```

Das Ergebnis ist bewusst kein Vorteil: Für Paket A ist im VS-21-Beleg keine
absolute, deckungsgleiche Berechnungsbasis gebunden. Der Eurobetrag von Paket B
darf weder als Bezugsbasis für Paket A verwendet noch gegen 10/15 Prozent
gerechnet werden. Damit steigt R69-A auf `7/40`; `33` Fälle bleiben offen.
Unter Einbeziehung aller akzeptierten gezielten Deltas verschiebt sich die
noch nicht durch einen frischen 224-Zeilen-Vollrun bestätigte Projektion von
`VORTEIL_A 2 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 121 / NICHT_VERGLEICHBAR 11 / UNKLAR 54` auf
`VORTEIL_A 2 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 121 / NICHT_VERGLEICHBAR 12 / UNKLAR 53`.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

### 10.29 VS-22 – Entsorgungskosten einschließlich Sondermüll

#### 10.29.1 Fehlerbild, Quellenbefund und Change-Brief

Der gebundene Ausgangslauf auf `2656487020e288ab3c415823a23652b79bbc8c85`
endete für VS-22 bei `UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review`.
Paket A war vollständig belegt; Paket B enthielt allgemeine
Entsorgungskosten, aber keine als VS-Sachdeckung gebundene allgemeine
Sondermüllkomponente und kein daran gebundenes Sondermülllimit.

```text
Baseline-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-22-BASELINE-26564870-20260903
Baseline-Summary-Digest:
98bb50bb22e1f16238958541699022532fcc70c9b8f9b1f00df05f02c85e80fd
Baseline-Selection-Digest:
0d0a8bceda173603ec83c323f22b474ea83fba502d8a5c72419e1b7adae890cc
Baseline-Katalog: vs-occurrence-full-draft-v0.12
Baseline-Qwen-Aufrufe: Triage 2 / Evidence 2
```

Die Quellenprüfung trennt vier fachliche Ebenen:

1. Paket A enthält allgemeine und spartengebundene Kosten für Sondermüll,
   gefährlichen Abfall beziehungsweise Problemstoffe. Die Fundstellen tragen
   unterschiedliche Gefahren-, Bedingungs-, Prozent- und Euro-Limits.
2. Paket B enthält allgemeine Entsorgungskosten und einen engen Teilfall für
   radioaktiv kontaminiertes Erdreich. Das ist nicht automatisch eine
   allgemeine Sondermüll-Mehrkostendeckung.
3. Der Vorschlag in Paket B nennt bei mehreren Sparten EUR 6.121.600 und den
   Klauselcode `12PA0130`; die spätere Klausel definiert die
   Entsorgungskosten. Der bisherige Feldvertrag kann Betrag und Klausel über
   diesen exakten Code noch nicht dokumentweit verbinden.
4. DOC-07 enthält den Wortlaut `gefährlichen Abfall- und Problemstoffen`,
   jedoch im Haftpflicht-/Umweltschadenabschnitt als Ausnahme von einem
   Ausschluss für kurzfristige Zwischenlagerung. Das ist weder positive
   Gebäudesachdeckung noch ein Entsorgungskostenlimit.

```text
Nutzerproblem / gewünschtes Ergebnis:
  VS-22 vollständig finden und korrekt vergleichen, ohne fremde Haftpflicht-
  oder Nachbarwerte als Deckung beziehungsweise Limit auszugeben.
Root-Cause-Klasse:
  Datenfindung + Scope/Rolle + lokale und dokumentweite Wertbindung.
Betroffene Invarianten:
  INV-003, INV-004, INV-007, INV-008 und INV-010.
Callers und Datenfluss:
  VS-Katalog -> Controlled Occurrences -> Candidate Triage -> Prepared
  Evidence -> Requested Fields -> Paket-Rollup -> Point Decision.
Persistenz/UI/Jobs:
  Katalog-, Produkt- und Vergleichsvertrags-ID ändern sich; Rohfakten werden
  nicht gelöscht. Kundenzeile und Export ändern sich erst nach einem
  bestandenen terminalen Vergleichsvertrag.
Verworfener ähnlicher Ansatz:
  allgemeine Entsorgung als Sondermüll behandeln, nächstgelegene Zahl binden,
  DOC-07 positiv übernehmen oder B-Nullfund als ausdrücklichen Ausschluss
  darstellen.
Scope Phase 1:
  nur kontrollierte deutsche Flexionen und occurrence-lokaler Fremdscope.
Nicht-Ziel Phase 1:
  kein Vorteil, keine Limitdominanz, keine Reviewfreigabe.
Riskanteste Annahme:
  ein weit gefasster Haftpflichtmarker könnte eine spätere positive
  Sachkostenklausel überfärben.
Messbare Verbesserung:
  DOC-07 wird gefunden und serverterminal verworfen; bisherige Entscheidung
  und restliche zehn Dokumente bleiben fachlich unverändert.
Abbruchgrenze:
  positiver Sachkosten-Scope wird verworfen oder VS-22 wird ohne vollständige
  Scope-/Werttypisierung reviewfrei.
Beweisgrenze:
  LF/WEVIG plus synthetische Varianten beweisen noch keine unbekannten
  Versicherer.
```

#### 10.29.2 Phase 1 – kontrollierter Flexions-Recall und lokaler Fremdscope

Die erste Implementierung in `6ca3ff5e` ergänzte die fehlenden Flexionen,
war aber noch nicht freigabefähig. Eine unabhängige Gegenprüfung fand vor dem
Mac-Lauf, dass `Schadenersatzverpflichtungen` oder `Umweltstörung` irgendwo im
breiten Kontext auch einen späteren positiven Sachkostensatz hätten verwerfen
können. Der Forward-Fix `60508274` führte deshalb den gemeinsamen Vertrag
`vs22WasteScopeContract.js` ein:

- Scope-Rejects verwenden nur den Satz der exakten Occurrence oder eine
  strukturell erkannte `HAFTPFLICHT_INSURANCE`-Section;
- der DOC-07-nahe Zwischenlagerungs-Carveback ist explizit und lokal gebunden;
- breite Kontextwörter allein besitzen keine terminale Wirkung;
- ein nachfolgender positiver Sachkostensatz bleibt nach einem
  Haftpflichtsatz erhalten;
- allgemeine Entsorgung und radioaktiv kontaminiertes Erdreich werden nicht
  zu allgemeinem Sondermüll hochgestuft;
- alle drei VS-22-Komponenten werden im Fremdscope geprüft;
- der reale Mini-Pfad Aliasfund -> Triage -> Prepared Evidence ist als
  Regression abgedeckt.

Der Katalog ist wegen der erweiterten Flexionsfamilie als
`vs-occurrence-full-draft-v0.14` versioniert. Das Produktprofil lautet
`CUSTOMER_CORE_5_V56_VS22_LOCAL_WASTE_SCOPE`, der Vergleichsvertrag endet auf
`VS22_LOCAL_WASTE_SCOPE_V17`. Die an die Katalog-ID gebundenen VS-08- und
VS-15-Requirement-Digests wurden neu berechnet; andernfalls hätten deren
bestehende Vergleichsverträge trotz unveränderter Fachzeile fail-closed
versagt.

Die Mac-Studio-Schleife machte zwei weitere Probleme sichtbar:

1. Die auf dem Mac verbindliche Prettier-Version verlangte die in
   `fb1f2939` isoliert übernommene Formatierung zweier Katalogverbraucher.
2. Der erste Testlauf auf `fb1f2939` ergab 228/234 PASS. Neben einem
   fehlerhaften Testzugriff auf `target.componentId` wurden die neue
   Abfall-Pluralform, Haftpflichtkomposita und die durch die neue Katalog-ID
   geänderten VS-08-/VS-15-Digests korrigiert (`0901eb37`). Der danach einzige
   rote Test war eine falsche Erwartung: Die Limit-Occurrence wurde korrekt
   terminal verworfen, aber mit dem präziseren bestehenden Grund
   `LIMIT_TERM_WITHOUT_LOCAL_LIMIT`. `4d207917` korrigierte nur diese
   Testerwartung.

```text
Recall-Commit: 6ca3ff5e2700eeba840af055aae5f7100d76441a
Lokaler-Scope-Forward-Fix: 6050827496dc779c6c5231bd96d116176effcec1
Mac-Format-Commit: fb1f293946ff71b5fe31849d423059f06a3cecb7
Validierungs-Forward-Fix: 0901eb37055138819495abe0cbf443b7a28a932a
Test-Forward-Fix: 4d20791796b5a9e505624df510230781b09c3e43
Mac-Studio-Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Mac-Studio-Commit: 4d20791796b5a9e505624df510230781b09c3e43
Runtime: Node v22.23.2
Modell: qwen/qwen3.6-35b-a3b
Modell-Tokenlimit: 42496
Mac-Studio-Formatprüfung: PASS
Mac-Studio-Suites: 10/10 PASS
Mac-Studio-Tests: 234/234 PASS
```

Der frische Zehn-Dokumente-Lauf lautet:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-22-INFLECTION-SCOPE-4D207917-20260903
Summary-Digest:
32f7c961479fa6cd74fe1a6f89bf06b7e9f0afaad8c29084408f5c9e586f5f52
Target-Selection-Digest:
afad90266976dd26712addf53b809e1d8abe6040be093201971518c2f8151d60
Producer-Digest:
b1b150e5d91bedb42346e9b41de315912598425be3838257b61270184788e0ea
Qwen-Aufrufe: Triage 3 / Evidence 3
```

DOC-07 erzeugt jetzt exakt zwei kontrollierte Occurrences auf physischer
PDF-Seite 5: `hazardous_waste` und `hazardous_waste_cost_limit`. Der
Dokumentreport weist `serverTerminalTargetCount = 2`, `modelTargetCount = 0`,
`modelAttemptCount = 0` und `executionMode = SERVER_ONLY` aus. Beide werden
als `MENTION_ONLY` verworfen; Prepared Evidence enthält keine ausgewählte
Quelle und materialisiert für diese Komponenten weiterhin `NOT_FOUND /
UNKNOWN`.

Der aggregierte Transient-Producer meldet daneben
`triageServerRejected = 0`, weil er fälschlich das Feld `decisionOwner` aus
der materialisierten Triage liest, obwohl dieses dort nicht persistiert wird.
Für die fachliche Aussage gilt deshalb der dokumentlokale, gehashte
Triage-Report mit zwei Server-Terminals. Diese Kennzahl darf künftig nicht als
Nullzahl ausgegeben werden; der nächste Producer muss
`report.input.serverTerminalTargetCount` summieren.

```text
Vorher: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review
Nachher: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review
Paket A: BELEGT / Ja
Paket B: TEILBELEGT / nicht feststellbar
Neue echte Fundstellen: 2, beide Fremdscope und serverterminal
R69-A: unverändert 7/40 abgeschlossen, 33 offen
```

Phase 1 ist damit als Recall-/Präzisionsverbesserung akzeptiert, aber VS-22
ist ausdrücklich noch nicht abgeschlossen. Der nächste Einzelkandidat ist
die generische, fail-closed Bindung eines Betrags an eine Klausel über einen
exakten, dokumentweit identischen Klauselcode. Sie muss Betrag und
Klauselinhalt im selben Dokument halten, fremde Codes, mehrere widersprüchliche
Werte, Nachbarpositionen, Selbstbehalte und dokumentübergreifende Joins
ablehnen. Erst danach darf das typisierte VS-22-Portfolio bewertet werden.

#### 10.29.3 Phase 2 – exakter Klauselcode bindet Aktivierungswert an allgemeinen Entsorgungsinhalt

Die Quellenprüfung von DOC-02 bestätigte zwei dokumentinterne Beziehungen:

- `12PA0130` steht auf physischer PDF-Seite 1 im Feuer-Abschnitt gemeinsam mit
  `EUR 6.121.600,00` auf Erstes Risiko. Die eindeutige Klauselüberschrift auf
  physischer Seite 8 definiert ausdrücklich allgemeine Entsorgungskosten.
- `10PA0120` steht auf den physischen Seiten 2, 4 und 5 unter
  Leitungswasser, Sturm und Glas jeweils gemeinsam mit demselben Betrag. Die
  eindeutige Klauselüberschrift auf physischer Seite 13 enthält dieselbe
  allgemeine Entsorgungsdefinition.

Der Betrag gehört damit zum belegten Bestandteil `disposal_costs`. Er beweist
weder allgemeinen Sondermüll noch ein eigenes Sondermülllimit. Insbesondere
wird die enge Klausel für radioaktiv kontaminiertes Erdreich nicht zur
allgemeinen Sondermülldeckung erweitert.

Der neue Vertrag ist kein VS-22-ID-Sonderfall. Er ist ein wiederverwendbarer,
komponentenbezogener Opt-in:

```text
fieldGovernorPolicy: SAME_DOCUMENT_EXACT_CLAUSE_CODE_V1
evidence contract: SAME_DOCUMENT_EXACT_CLAUSE_CODE_FIELD_GOVERNOR_V1
```

Er ist im aktuellen Katalog ausschließlich für
`VS-22:disposal_costs` aktiviert. Ein Wert wird nur gebunden, wenn alle
folgenden Bedingungen gleichzeitig gelten:

1. Aktivierung und Klausel gehören zum selben Dokumentfingerprint.
2. Die Schedule-Position enthält die ausdrückliche Form
   `Besondere Bedingung <CODE>`; Fuzzy-, Präfix- und Nachbardokument-Joins sind
   ausgeschlossen.
3. Code und genau ein limitartiger Geldbetrag liegen im selben strukturellen
   Listeneintrag.
4. Der Listeneintrag besitzt einen positiven lokalen
   `Mitversichert`-Governor und einen Limit-Hinweis wie `auf Erstes Risiko`.
5. Selbstbehalt, Prämie, aufgehobene oder ersetzte Positionen werden
   abgelehnt.
6. Der Schedule-Scope muss exakt zum aktivierten Clause-Scope passen.
7. Die Klauselüberschrift mit diesem Code muss dokumentweit eindeutig sein.
8. Mehrere aktivierte Scopes sind nur zulässig, wenn alle normalisierten
   Werte identisch sind; ein Wertkonflikt liefert keine Feldfakten.
9. Die Feldextraktion verwendet für diese Opt-in-Komponente ausschließlich
   den validierten Code-Governor. Lokale Zahlen im Klauseltext und der sonst
   verwendete 360-Zeichen-Nahbereich werden nicht zusätzlich geöffnet.
10. Die Ausgabe behält Body- und Wertquelle getrennt. Die Seite des
    Cross-Page-Werts wird nur über einen im Worksheet vorhandenen, mit Code,
    Fingerprint, Scope und Offset übereinstimmenden Governor akzeptiert.

Betroffene produktive Abhängigkeiten:

```text
VS-Katalog und komponentenbezogener Opt-in
  -> controlledOccurrenceWorksheet.js
     - Aktivierungsindex, Scope, Code-, Wert- und Dokumentspans
     - Eindeutigkeit der Klauselüberschrift
  -> requestedFieldEvidenceContract.js
     - erneute fail-closed Validierung
     - ausschließliche Cross-Page-Limitextraktion
     - komponenten- und gefahrgebundene Feldfakten
  -> categoryTableRenderer.js
     - getrennte Klausel- und Wertquelle
     - keine Übernahme unvalidierter Seitennummern
  -> coverageOnlyCertificationContract.js
     - Policy ist Teil des versionierten Search-Contract-Digests
  -> productContract.js sowie VS-08-/VS-15-Katalogverbraucher
```

Versionierung und Commits:

```text
Fachcommit: 326b73c0e04e4482056cc6a7c28bea4c23b30313
Mac-Format-Forward-Fix: f27a31029c03e6568d2e1fe5f6b6ece299e36fb9
Provenienz-Forward-Fix: a37748e112bb06a1f1efaeff1de30370490d3185
Mac-Format-Forward-Fix: 2f6c96bb54560f4f3b974df6d6e4dc83a6104da4
Mac-Format-Forward-Fix: 98d676cc7e56a91cdbcaaa058137ec1752465aee
VS-Katalog: vs-occurrence-full-draft-v0.15
Produktprofil: CUSTOMER_CORE_5_V57_EXACT_CLAUSE_CODE_FIELD_GOVERNOR
Vergleichsvertrag: ...VS22_LOCAL_WASTE_SCOPE_EXACT_CLAUSE_CODE_FIELD_GOVERNOR_V18
```

Der erste fokussierte Mac-Lauf auf `f27a3102` fand 365/368 grüne Tests. Zwei
Renderer-Tests bewiesen, dass die erste Fassung einer unvalidierten
`fact.source.physicalPageNumber` vertraut hätte; der VS-15-Digest war durch
die neue VS-Katalog-ID erwartungsgemäß veraltet. `a37748e1` bindet die
Cross-Page-Seite deshalb nochmals an den Worksheet-Governor und aktualisiert
den Digest. Die folgenden zwei Commits enthalten ausschließlich die auf dem
Mac verbindliche Prettier-Formatierung.

Finale Mac-Studio-Validierung:

```text
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Commit: 98d676cc7e56a91cdbcaaa058137ec1752465aee
Runtime: Node v22.23.2
Formatprüfung: PASS
Fokussierte Suites: 9/9 PASS
Fokussierte Tests: 369/369 PASS
Breite Utils-Regression: 103/106 Suites PASS, 1501/1525 Tests PASS
```

Die drei roten breiten Suites und ihre 24 Tests besitzen dieselbe bekannte
Fixture-Ursache: historische Target-QA-/Worksheet-Manifeste sind an eine alte
Produktprofil- und Katalogkombination gebunden und brechen jetzt bereits am
erwarteten `TARGETED_QA_PROFILE_CATALOG_MISMATCH: VS` ab. Alle fachlichen
Worksheet-, Triage-, Evidence-, Requested-Field-, Renderer- und
Vergleichssuites sind grün; es entstand keine neue fachliche Fehlersignatur.

Realer Zehn-Dokument-Lauf:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-22-CLAUSE-GOVERNOR-98D676CC-20260903
Summary-Digest:
bbbc309b2826999d36ba14d9881463eb19bdbf9ce57e8c50c5cbd3d6fe1a437f
Input-Selection-Digest:
a276982e4032b480359103bff926fd60f2fd1562b407edba4d873e5249277761
Target-Selection-Digest:
2150ea1e2f3f936eaa0b43ea372e120ef4d9cb7eff483c44091639c2a11fadb7
Producer: /tmp/vs22_targeted_producer-v02.cjs
Producer-Digest:
5dace643910fd40b0c5866bb5273f72923f28ad3d5bf23f459202b076a725e4d
Dokumente: 10
Qwen-Aufrufe: Triage 3 / Evidence 3
Serverterminale Triage-Ziele: 38
Serverterminale Evidence-Komponenten: 25
```

Der Producer summiert jetzt die gehashte Report-Kennzahl
`input.serverTerminalTargetCount`; die in Phase 1 dokumentierte falsche Null
aus einem nicht persistierten `decisionOwner`-Feld ist damit beseitigt.

Revisionssicheres Ergebnisdelta für DOC-02:

```text
Vor Phase 2:
  disposal_costs: INCLUDED, angefordertes Limit NOT_FOUND
  Wertquellen über Klauselcode: 0

Nach Phase 2:
  disposal_costs: INCLUDED, angefordertes Limit COMPLETE
  Feuer / 12PA0130: EUR 6.121.600,00 auf Erstes Risiko
  Leitungswasser / 10PA0120: EUR 6.121.600,00 auf Erstes Risiko
  Sturm / 10PA0120: EUR 6.121.600,00 auf Erstes Risiko
  Glas / 10PA0120: EUR 6.121.600,00 auf Erstes Risiko
  Body-Quellen: physische Seiten 8 und 13
  Wertquellen: physische Seiten 1, 2, 4 und 5
  hazardous_waste: unverändert NOT_FOUND
  hazardous_waste_cost_limit: unverändert NOT_FOUND
```

Das Paket- und Vergleichsergebnis bleibt ehrlich unverändert:

```text
Paket A: BELEGT / Ja
Paket B: TEILBELEGT / Nicht feststellbar
Entscheidung: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review
```

Phase 2 ist als belegte Feld- und Provenienzverbesserung akzeptiert. VS-22 ist
noch nicht abgeschlossen. Offen bleiben die tatsächlich fehlenden
Komponenten `hazardous_waste` und `hazardous_waste_cost_limit` in Paket B
sowie auf Paketebene mehrere Atome derselben `disposal_costs`-Komponente aus
Vorschlag und Rahmenbedingung. Diese Punkte dürfen nicht durch eine
Umbenennung allgemeiner Entsorgungskosten oder durch Auswahl eines beliebigen
Dokuments entfernt werden; sie benötigen einen eigenen Rang-/Portfoliovertrag
oder einen bestätigten kontrollierten Nichtfund.

#### 10.29.4 Unabhängiger Review und Hardening der Phase 2

Ein unabhängiger Review stufte `98d676cc` trotz grünem Zieltest zunächst als
NO-GO ein. Der echte DOC-02-Lauf war zwar fachlich richtig, aber sechs
adversariale beziehungsweise wiederverwendbare Vertragsgrenzen waren noch
nicht vollständig abgesichert:

1. Ein lokaler Ausschluss oder eine Optionsformulierung innerhalb eines
   positiven Sammel-Governors hätte als Aktivierung gelten können.
2. Von mehreren Aktivierungen desselben Codes hätte eine ungültige Position
   verworfen und eine zweite gültige Position trotzdem gewählt werden können.
3. Gleiche Beträge mit widersprüchlichen Qualifiern hätten als identisch
   gegolten.
4. Seite und Dokumentoffsets waren noch nicht gegen die Worksheet-Grenzen
   geprüft.
5. Der Renderer konnte für den Cross-Page-Wert einen unvollständig
   nachgewiesenen Hint-Text verwenden.
6. Bei einem künftigen Same-Page-Join hätte der Renderer die inhaltliche
   Klauselquelle zugunsten der Wertquelle unterdrückt.

`ae42f2a2` und `aef3ef30` schließen diese Grenzen fail-closed:

- lokale `nicht versichert`-, Ausschluss-, Ausnahme-, Options-, Wahl- und
  Mehrprämienformulierungen sperren den Code-Governor;
- jede ungültige Aktivierungsposition sperrt alle Aktivierungswerte dieses
  Codes im Dokument, statt eine günstige Teilmenge auszuwählen;
- Betrag, Qualifier, Limitart und Einheit müssen bei Mehrfachaktivierungen
  identisch sein;
- physische Seite, Gesamtseitenzahl, Dokumentlänge, Governor- und
  Betragsoffsets werden nochmals im Requested-Field-Vertrag geprüft;
- der Renderer akzeptiert den Werttext und seine Seite nur bei exakter
  Übereinstimmung von Worksheet-Fingerprint, Code, Scope, Betragstext und
  Betragsoffsets;
- für jeden validierten Exact-Code-Fakt bleiben Klausel- und Wertquelle
  sichtbar, auch wenn beide auf derselben physischen Seite liegen;
- manipulierte Cross-Page-Fakten werden nicht als Deckungssumme gerendert.

Der zweite Senior-Review fand zusätzlich, dass der Katalogbump den bestehenden
VS-08-Konsensvertrag ohne aktuellen Requirement-Digest still deaktiviert
hätte. `aef3ef30` ergänzt deshalb einen nicht selbstreferenziellen
Integrationstest gegen den aktuellen VS-Katalog. Der erste dabei eingesetzte
externe Digest war nicht der Digest des tatsächlich validierten aktuellen
Katalogobjekts; der Mac-Test ermittelte reproduzierbar
`b7a27985064b74516ef6baf7feea47014a4e5b368bc01c27106c4aedec160778`.
`f7cf1102` bindet genau diesen Wert und trennt im Test die absichtlich
mehrdeutige Mehrsparten-Feldprüfung vom positiven echten Triage-/Prepared-Pfad.

```text
Trust-Hardening: ae42f2a25109fa52a3e59f4a7c760d63bb13f4d5
Renderer-/VS-08-Fix: aef3ef302d9814e5d20e35ac5d988d542d60a7dc
Mac-Format-Forward-Fix: 739281892acac63b0276138bd143f5ad3cbd9ac2
Validierungs-Pin-Fix: f7cf11020a4a521254be558db74ae32734430363
Mac-Studio-Formatprüfung: PASS
Fokussierte Suites: 11/11 PASS
Fokussierte Tests: 457/457 PASS
Breite Utils-Regression: 103/106 Suites PASS, 1512/1536 Tests PASS
Bekannte historische Fixture-Fehler: 3 Suites / 24 Tests
Neue fachliche Fehlersignatur: keine
```

Nur der nach dem Hardening erneut erzeugte Lauf ist der finale
Phase-2-Nachweis:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-22-CLAUSE-GOVERNOR-F7CF1102-20260903
Summary-Digest:
783ba411f89c8fc525cb39cf76de91ee86fa21f278bdc014af42c7105ba93fb5
Input-Selection-Digest:
960a58def6f84180ba8469a9601123d14b24f3348e24a49e2f11541696d2e92a
Target-Selection-Digest:
2150ea1e2f3f936eaa0b43ea372e120ef4d9cb7eff483c44091639c2a11fadb7
Producer-Digest:
5dace643910fd40b0c5866bb5273f72923f28ad3d5bf23f459202b076a725e4d
Qwen-Aufrufe: Triage 3 / Evidence 3
Serverterminale Triage-Ziele: 38
Serverterminale Evidence-Komponenten: 25
```

Der finale Lauf reproduziert exakt die vier DOC-02-Wertbindungen und alle
Body-/Wertquellen. Gegenüber dem Zwischenlauf ändert sich keine fachliche
Zeile. Das Hardening verhindert ausschließlich unzulässige künftige
Aktivierungen, manipulierte Feldquellen und die unbemerkte Abschaltung des
bereits akzeptierten VS-08-Vertrags.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

#### 10.29.5 Abschluss des unabhängigen Hardening-Audits

Der in 10.29.4 zunächst als final bezeichnete Stand `f7cf1102` wurde nach
einer weiteren unabhängigen adversarialen Prüfung ausdrücklich **nicht** als
Abschluss akzeptiert. Der Gegenleser fand fünf wiederverwendbare Restlücken:

1. `kein Versicherungsschutz`, `nicht gedeckt` und `nicht eingeschlossen`
   waren noch keine lokalen Negativmarker;
2. die bereits im Aktivierungsindex zulässige Kurzform `(12PA0130)` wurde im
   Wert-Governor noch nicht als konkurrierende Aktivierung erkannt;
3. Seitennummer und Dokumentoffset waren nur gegen Gesamtseitenzahl und
   Gesamtlänge, nicht gegen eine kanonische Seitengrenze geprüft;
4. Feldmaterialisierung und Renderer hatten zwei ähnlich aussehende, aber
   unterschiedlich strenge Validatoren;
5. der Regressionstest endete vor der echten Tabellenzeile.

Die folgenden Forward-Fixes schließen diese Grenzen, ohne den akzeptierten
DOC-02-Fund oder andere Komponenten umzudeuten:

```text
98c990eb fix(analysis): harden exact clause activation provenance
14b7d761 style(analysis): format clause provenance hardening
5c8f4a9f fix(analysis): verify clause provenance through rendering
06e0029d style(analysis): format renderer provenance verification
6ee250c9 fix(analysis): bind clause evidence to canonical page map
336912fc style(analysis): format canonical page validation
```

Der Worksheet-Vertrag persistiert nun für jede physische PDF-Seite die
kanonischen Dokumentgrenzen. Der Hint enthält weiterhin seine lokale
Seitennummer und seine lokalen Grenzen, wird aber zusätzlich gegen diese
Worksheet-PageMap geprüft. Dadurch scheitert auch eine gemeinsam manipulierte
Kombination aus formal gültiger Seitennummer und dazu passend umgeschriebenen
Hint-Grenzen. Die Materialisierung exportiert ihren einzigen
`validatedExactClauseCodeGovernor`; der Renderer verwendet exakt diese
Funktion und prüft anschließend nur noch die zusätzliche Bindung zwischen
validiertem Hint, materialisiertem Fakt und gerenderter Quelle. Eine spätere
Drift zwischen beiden Vertrauensgrenzen ist damit entfernt.

Ergänzte Gegenproben:

- drei weitere lokale Negativformulierungen;
- widersprüchliche Lang- und Kurzform desselben Klauselcodes;
- falsche, aber existente physische Seite;
- gemeinsam verfälschte Seitennummer und Hint-Grenzen;
- falsche Governor-Policy;
- falscher Clause-Scope im Renderer;
- negativer Governor-Text im Renderer;
- echter Pfad `Worksheet -> Candidate Triage -> Prepared Evidence ->
Requested Fields -> Category Table Renderer` plus manipulierte Gegenprobe.

Mac-Studio-Validierung des akzeptierten Quellstands:

```text
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Commit: 336912fc435c96c974ccf5e081e25aa1c89012dd
Runtime: Node v22.23.2
Formatprüfung: PASS
Fokussierte Suites: 2/2 PASS
Fokussierte Tests: 62/62 PASS
Breite Utils-Regression: 103/106 Suites PASS, 1519/1543 Tests PASS
Bekannte historische Fixture-Fehler: 3 Suites / 24 Tests
Neue fachliche Fehlersignatur: keine
Unabhängiger adversarialer Re-Review: GO, keine Must-fixes offen
```

Der neue, auf exakt diesem Commit erzeugte Zehn-Dokument-Nachweis ersetzt den
in 10.29.4 genannten F7CF-Lauf als maßgeblichen Phase-2-Lauf:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-22-CLAUSE-GOVERNOR-336912FC-20260903
Summary-Digest:
c0d0637f94624d9e36c01dad50900633c5ad170951cf7f2575acc9dfaabbcdeb
Input-Selection-Digest:
960a58def6f84180ba8469a9601123d14b24f3348e24a49e2f11541696d2e92a
Target-Selection-Digest:
2150ea1e2f3f936eaa0b43ea372e120ef4d9cb7eff483c44091639c2a11fadb7
Producer-Digest:
5dace643910fd40b0c5866bb5273f72923f28ad3d5bf23f459202b076a725e4d
Qwen-Aufrufe: Triage 3 / Evidence 3
Serverterminale Triage-Ziele: 38
Serverterminale Evidence-Komponenten: 25
```

Das Fachresultat ist gegenüber dem letzten akzeptierten Fund erwartungsgemäß
stabil: DOC-02 behält vier korrekt gefahrgebundene Betragsfakten zu allgemeinen
Entsorgungskosten; `hazardous_waste` und `hazardous_waste_cost_limit` bleiben
`NOT_FOUND`. Paket A bleibt `BELEGT / Ja`, Paket B `TEILBELEGT / Nicht
feststellbar`, die Zeile bleibt vor dem nächsten typisierten Portfolio- und
Nichtfundschritt `UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review`.
Das Hardening verbessert die Vertrauensgrenze, nicht die Zeilenentscheidung.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

#### 10.29.6 Phase 3A – DOC-07-Fremdscope terminal und paketweiter Nichtfund vollständig

Vor der Portfolioentscheidung wurde die letzte unvollständige B-Suchzelle
geschlossen. DOC-07 enthält zwar die Wörter `gefährlichen Abfall`, aber nur in
einer Haftpflichtklausel zur kurzfristigen Zwischenlagerung. Dieser Fund darf
weder als Gebäude-Sondermülldeckung verwendet werden noch die kontrollierte
Suche dauerhaft offenlassen.

Der neue Terminalvertrag ist exakt opt-in für:

```text
VS-22 / hazardous_waste / INSURED_OBJECT / COVERAGE_MIXED
VS-22 / hazardous_waste_cost_limit / LIMIT / COVERAGE_MIXED
Contract: DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_V1
Proof: VS22_LOCAL_LIABILITY_OR_STORAGE_SCOPE_V1
```

Er bindet exakten Treffertext, Kandidaten-ID, Dokumentoffsets, lokalen
Kontext-Slice, physische Seite, Headingquelle, beobachtete Scopes sowie
Occurrence- und Rejection-Set-Digests. `CURRENT_PAGE_HEADING` ist nur auf
derselben physischen Seite zulässig; ein `PRECEDING_PAGE_HEADING` höchstens
eine bis drei Seiten davor. Der rein lokale Zwischenlagerungsweg ist nur ohne
Section- und Page-Scope-Hinweis zulässig. Sach- oder Gebäudeversicherungs-
Rückverweise sowie gemischte Scopes bleiben fail-closed.

Die unabhängige Gegenprüfung fand und schloss vor Abnahme vier Restlücken:

1. ungültige Occurrence-Offets durften nicht auf `exactText` zurückfallen;
2. der lokale Weg durfte vorhandene Scopes nicht durch `[]` ersetzen;
3. Current- und Preceding-Heading brauchten getrennte Abstandsvorgaben;
4. der bilaterale Validator musste Gate und V3-only-Contract ausdrücklich
   kennen.

Commits:

```text
1fe175b4 fix(analysis): certify VS-22 non-target waste mentions
df338a25 fix(analysis): derive VS-22 terminal from source proof
b628e437 fix(analysis): harden VS-22 terminal validation
30a66d25 fix(analysis): preserve empty VS-22 scope evidence
0e663ef2 style(analysis): format VS-22 terminal hardening
6b329bbb test(analysis): verify VS-22 terminal rebuild
c9cd0f27 style(analysis): format VS-22 rebuild test
```

Mac-Studio-Validierung des akzeptierten Stands:

```text
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Commit: c9cd0f2799fc2427c5bb465c2a2f78c1ed38bf5c
Runtime: Node v22.23.2
Fokussierte Terminal-Suites: 5/5 PASS, 179/179 Tests PASS
Dateibasierter Rebuild: 3/3 Suites PASS, 128/128 Tests PASS
Breite Utils-Regression: 103/106 Suites PASS, 1524/1548 Tests PASS
Bekannte historische Fixture-Fehler: 3 Suites / 24 Tests
Neue fachliche Fehlersignatur: keine
```

Realer Zehn-Dokument-Nachweis:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-22-NON-TARGET-WASTE-C9CD0F27-20260903
Summary-Digest:
1efa4b5e3dcee449856c89abceea667ecb26c8dad66ff7a7790661ba43e33014
Source-Input-Manifest-Digest:
50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
Target-Selection-Digest:
2150ea1e2f3f936eaa0b43ea372e120ef4d9cb7eff483c44091639c2a11fadb7
Producer-Digest:
5dace643910fd40b0c5866bb5273f72923f28ad3d5bf23f459202b076a725e4d
Qwen-Aufrufe: Triage 3 / Evidence 3
```

Das messbare Ergebnis ist jetzt vollständig:

```text
Paket B / hazardous_waste: 9/9 Dokumente kontrolliert ohne Zielbeleg
Paket B / hazardous_waste_cost_limit: 9/9 Dokumente kontrolliert ohne Zielbeleg
DOC-07: je Komponente 1 haftpflichtgebundener Fremdscope terminal verworfen
```

Die Zeile bleibt in diesem Zwischenschritt absichtlich `UNKLAR`, weil der
allgemeine Vergleich noch keine komponentenspezifische Portfolioentscheidung
für `COVERAGE_MIXED` besitzt. Phase 3A beweist nur den vollständigen Nichtfund;
sie behauptet weder einen ausdrücklichen Ausschluss noch ein Null-Euro-Limit in
Paket B. Der folgende, getrennte Phase-3B-Commit darf daraus einen Vorteil für
Paket A nur zusammen mit A-Sondermülldeckung und A-Sondermülllimit ableiten.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

#### 10.29.7 Phase 3B – paketweiter Sondermüllvergleich abgeschlossen und gehärtet

Phase 3B baut ausschließlich auf dem in 10.29.6 belegten vollständigen
Nichtfund von Paket B auf. Der neue Vergleichsvertrag entscheidet VS-22 nur,
wenn eine Seite eine quellengebundene Sondermülldeckung mit mindestens einem
typisierten Sondermülllimit besitzt und die andere Seite die kontrollierte
Paketprüfung für die fehlenden Pflichtkomponenten vollständig bestanden hat.
Er behauptet auf der Nichtfundseite weder einen ausdrücklichen Ausschluss noch
ein Null-Euro-Limit.

Die erste funktionsfähige Portfoliofassung wurde anschließend in kleinen,
getrennten Forward-Fixes gehärtet:

```text
f95afc5f8 fix(comparison): decide VS-22 hazardous waste portfolio
8946e75dc test(comparison): bind VS-22 portfolio fixture documents
197a22d44 style(comparison): format VS-22 portfolio contract
f5a6f1423 test(comparison): harden VS-22 portfolio replay
c365359d3 style(comparison): format VS-22 replay tests
7dbe27a31 fix(comparison): bind VS-22 atoms to document status
c838b92c9 fix(comparison): bind VS-22 limits to waste evidence
f7b262be2 style(comparison): format VS-22 semantic binding
d8f709759 fix(comparison): attest VS-22 hazardous limit provenance
bce5cffb8 style(comparison): format VS-22 provenance tests
4de46058c fix(comparison): anchor VS-22 audit replay externally
550a88bf8 fix(comparison): require direct basis only for VS-22 limits
1df8e1d7b style(comparison): format VS-22 replay validation
bdf2c0462 test(comparison): accept VS-22 replay rejection codes
342af830e test(comparison): reject rehashed VS-22 replay drift
d366e54c2 test(comparison): replay VS-22 through customer validation
```

Die endgültigen Gates binden:

1. Dokument-UUID, PDF-SHA, Paketseite A/B, Dokumentrolle und Dokumentstatus an
   das unveränderte Eingabemanifest sowie Quellseiten an gültige
   Dokumentgrenzen und die Kandidaten-/Feldquelle;
2. `documentApplicability` deterministisch an Status und Evidenzfund, ohne
   Angebot, Rahmenbedingung oder Nachtrag als Paketmitglied auszuschließen;
3. jeden Sondermüll-Limitwert an einen ausgewählten Kandidaten derselben
   Seite und Seite mit Sondermülllexem sowie an
   `DIRECT / EXPLICIT_HAZARDOUS_WASTE_COSTS`;
4. nur `MONEY`/`EUR` oder `PERCENT`/`%` mit `limitKind: CAPPED`;
5. die Gewinnerseite gegen aktivierungsoptionale oder mehrprämienpflichtige
   Quellen;
6. den Audit-Digest gegen einen getrennt aus den ursprünglichen Atomen
   berechneten privaten Replay-Digest;
7. die Kundenmetrik gegen diesen Replay, wobei die sichere Kundenansicht das
   private Replay-Feld wieder entfernt.

Mehrere Limits sind erlaubt, wenn jedes Limit diese Gates selbständig erfüllt.
Das ist für den realen A-Bestand fachlich notwendig: `3 %`, `1,5 %` und
`EUR 7.300` sind drei eigenständige, direkte Sublimits aus verschiedenen
Klauseln. Ebenso werden Formulierungen wie „sofern im Rahmen der Nebenkosten
keine ausreichende Deckung“ nicht als unangenommene Vertragsoption behandelt;
sie qualifizieren die Leistungsreaktion. Eine pauschale Bedingungsablehnung
oder eine Ein-Limit-Regel würde echte Deckung verwerfen.

Ein zwischenzeitlicher Lauf hat genau einen zu strengen eigenen Gatefehler
sichtbar gemacht:

```text
VS-22-ATTEST-BCE5CFFB-20260903
Summary-Digest:
c77147f70fc6b7413119130775a430396820c5e6db447b8d09e603534c3e727e
Ergebnis: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review
```

Die Ursache war die Forderung nach einem deterministischen Bindungsgrund für
jede Deckungsquelle. Ein realer, textlich und seitengenau richtiger
Deckungskandidat besitzt diese Metadaten nicht. `550a88bf8` beschränkt die
strenge `DIRECT`-Forderung deshalb auf die gefährlichen Limits; Text-, Scope-,
Manifest- und Optionalitätsgates der Deckungsquelle bleiben erhalten. Der
Fehllauf wurde nicht als Erfolg gewertet.

Der abschließende exakte Mac-Studio-Nachweis lautet:

```text
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Commit: d366e54c2e304fc47d51c5eae55cd98b89f2085e
Runtime: Node v22.23.2
Runtime-Repo:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/AuditRuns/QWEN36-FULL-20260831-7ab999c6/repo
Modell: qwen/qwen3.6-35b-a3b
Modell-Tokenlimit: 42496
Produktprofil: CUSTOMER_CORE_5_V59_VS22_HAZARDOUS_WASTE_PORTFOLIO_HARDENED
Vergleichsvertrag:
PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_LW20_EQUALITY_FIRE_DEFINITION_VS15_QUALIFIER_VS08_CONSENSUS_OBJECT_FAMILY_ANY_IDENTITY_AMOUNT_LOCAL_CONDITION_VS21_COST_ROLE_BINDING_GROUP_FIELDS_LIMIT_PORTFOLIO_REVIEW_GATE_VS22_LOCAL_WASTE_SCOPE_EXACT_CLAUSE_CODE_FIELD_GOVERNOR_HAZARDOUS_WASTE_PORTFOLIO_HARDENED_V20
Auditvertrag: VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_V2
Replayvertrag: VS22_SOURCE_ATOM_DIGEST_REPLAY_V1

Fokussierte Prüfung: 4/4 Suites PASS, 80/80 Tests PASS
Breite Utils-Regression: 104/107 Suites PASS, 1545/1569 Tests PASS
Bekannte historische Fixture-Fehler: 3 Suites / 24 Tests
Fehlersignatur: TARGETED_QA_PROFILE_CATALOG_MISMATCH: VS
Neue fachliche Fehlersignatur: keine
Adversarialer Abschlussreview: GO
```

Der verbindliche letzte Zehn-Dokumente-Lauf lautet:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-22-CUSTOMER-REPLAY-D366E54C-20260903
Summary-Digest:
168614be7d8b410a7065cba29a000e0a4ef6278bd026dd1a4f114e344d328920
Source-Input-Manifest-Digest:
50dceb20550f6c4947bf7fe852cd483ec7f452009099c7ebf697cae37190f091
Input-Selection-Dateidigest:
6d65f9693ebeb31f79574f916c48f2a0c882a98fbe1ef8c741565fbadfcd7514
Target-Selection-Digest:
2150ea1e2f3f936eaa0b43ea372e120ef4d9cb7eff483c44091639c2a11fadb7
Producer-Digest:
5dace643910fd40b0c5866bb5273f72923f28ad3d5bf23f459202b076a725e4d
Triage-Qwen-Aufrufe: 3
Evidence-Qwen-Aufrufe: 3
Triage-Serverablehnungen: 38
Evidence-Serverterminals: 25

Paket A: Ja / BELEGT
Paket B: Nicht feststellbar / TEILBELEGT
Vorher: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review
Nachher: VORTEIL_A
Grund: INCLUDED_HAZARDOUS_WASTE_OVER_COMPLETE_CONTROLLED_ABSENCE
Review erforderlich: nein
```

Die mehrfach wiederholten Zehn-Dokumente-Läufe ergaben:

```text
PORTFOLIO-197A22D4  f9222fa75bb0b12b6bd930a84deb6ee6fd982f4ffe643a440dac19f6dc8e309f  VORTEIL_A / kein Review / Audit V1
STATUS-7DBE27A3     0eb70e197ad3d8e8001c9035b2973a94fc4c3402888cfb6cd89288d75c17b018  VORTEIL_A / kein Review / Audit V1
SEMANTIC-F7B262BE   d737e7605264cd5caa47d3180e42c117263fd9cee6befe6f8456c7901ce7f99b  VORTEIL_A / kein Review / Audit V1
ATTEST-BCE5CFFB     c77147f70fc6b7413119130775a430396820c5e6db447b8d09e603534c3e727e  UNKLAR / Review / erwarteter Fail-Closed-Zwischenstand
REPLAY-BDF2C046     7b26967e96e274fc2a14c16c289633968a3a0390ab3c07367b452a95ee0802aa  VORTEIL_A / kein Review / Audit V2
FINAL-342AF830      8b8c1dd52cc3e425b044f561039d240b8ea8bba2d47614d69e31ee569dc89c13  VORTEIL_A / kein Review / Audit V2
CUSTOMER-D366E54C   168614be7d8b410a7065cba29a000e0a4ef6278bd026dd1a4f114e344d328920  VORTEIL_A / kein Review / Audit V2
```

Der letzte Ziellauf bestätigt die VS-22-Entscheidung über
`materializeAtomicFacts`, `summarizePackage` und `decidePoint`. Er ist kein
vollständiger `resultBuilder`-zu-Customer-Validator-E2E-Lauf. Der fokussierte
Mac-Test aus `d366e54c2` baut ein Customer-Result mit unabhängigem Replay auf,
prüft `validateCustomerComparison`, erkennt kohärent neu gehashte Auditdrift
und bestätigt, dass `customerSafeComparisonReadView` das private Replay-Feld
entfernt. Diese beiden Nachweise bleiben getrennt dokumentiert.

Die verbleibende Grenze ist ausdrücklich dokumentiert: Der getrennte
SHA-256-Replay schützt die interne Revisionskonsistenz und erkennt Drift
zwischen ursprünglichen Atomen und Audit. Er ist kein kryptografischer
Manipulationsschutz gegen einen Angreifer, der eine alleinstehende JSON-Datei
und sämtliche ungekeyten Digests vollständig neu schreibt. Ein HMAC oder ein
externer unveränderlicher Audit-Speicher wäre eine eigene Produktanforderung,
nicht Teil dieses Kandidaten.

VS-22 ist damit als achter R69-A-Kandidat abgeschlossen. Die noch nicht durch
einen frischen 224-Zeilen-Vollrun bestätigte Projektion verschiebt sich von
`VORTEIL_A 2 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 121 / NICHT_VERGLEICHBAR 12 / UNKLAR 53` auf
`VORTEIL_A 3 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 121 / NICHT_VERGLEICHBAR 12 / UNKLAR 52`. R69-A steht damit bei
`8/40`; `32` Fälle der Ausgangsfamilie bleiben offen.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

### 10.27 VS-18 – Einfriedungsfamilie: gerichtete Oberklasse abgeschlossen

#### 10.27.1 Aktueller gebundener Ausgangslauf

VS-18 wurde nach den VS-02- und atomlokalen Integritätskorrekturen auf dem
aktuellen V46-Stand neu erzeugt:

```text
Commit: 3193f50c574f976431c22076726ce2deaf2a5972
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-18-BASELINE-3193F50C-20260903

summarySha256:
3d36a5d7b173c2307c549c22139a38f668ba787cf07dce206283e5568a8553a7

selectionDigest:
f46a40c499d8e6fb9cf326a32fa0380de5dc9db6ccf95156feaca41727e51070

Paket A: TEILBELEGT
Paket B: TEILBELEGT
Entscheidung: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja
```

Der Katalog modellierte die Zeile als vier implizite `ALL`-Komponenten mit
rein wörtlichen Aliasen:

```text
enclosures: Einfriedung(en)
fences: Zaun/Zäune
walls: Mauer(n)
gates: Tor(e)
```

Das ist für die tatsächliche Vertragssprache zu eng. Reale Dokumente nutzen
für dieselbe Objektfamilie auch `Grundstücksbegrenzungen`,
`Grundstücksumzäunungen` und `Umzäunungen`.

Die unabhängige Dokumentprüfung bestätigte:

- Paket A, physische Seite 4: ausdrücklich zusätzlich mitversichert sind
  `Grundstücksbegrenzungen sowie Begrenzungen und Umzäunungen ... wie Mauern,
Zäune`;
- Paket B, GenVerbund, physische Seiten 9 bis 10: Versicherungsschutz für
  künstliche und natürliche `Einfriedungen, Umzäunungen` sowie AW02-
  Entschädigung für Einfriedungen;
- Paket B, Angebot, physische Seite 13: `Als mitversichert gelten:
Einfriedungen, Außenanlagen gemäß Definition EABS`;
- Paket B, EABS, physische Seite 2: Definition von Einfriedungen als Sicht-
  oder Zutrittsschutz samt Schranken und Toren.

Die EABS-Stelle ist allein nur eine Definition. Erst der explizit auf diese
Definition verweisende Einschluss im Angebot kann den definierten Objektscope
fachlich aktivieren. Der aktuelle Code besitzt diese paketweite Relation noch
nicht.

#### 10.27.2 Kleiner kontrollierter Recall-Schritt

Commit `33314452` ergänzte nur die belegten Synonymfamilien:

- `enclosures`: Grundstücksbegrenzung(en), Grundstücksumzäunung(en),
  `Begrenzungen und Umzäunungen`;
- `fences`: Umzäunung(en), Grundstücksumzäunung(en).

Der VS-Katalog wurde auf `v0.12`, das Produktprofil zunächst auf V47
angehoben. `Mauerwerk`, Gebäudeaußenmauer, Toröffnungsanlage und
Betätigungselemente wurden bewusst nicht als Ersatzaliase aufgenommen. Diese
Wörter bezeichnen andere Objekte oder nur technische Teilkomponenten.

Die Katalogmigration erforderte außerdem die neuen, auf dem Mac Studio
berechneten VS-08- und VS-15-Vertragsdigests. Diese sind in `e9bc2449` und
`8dc032a5` getrennt gebunden; `8619e1f4` enthält nur Formatter-Ausgabe.

Mac-Studio-Prüfung:

```text
Commit: 8dc032a59390a50f82691de60c3e398e698c8e35
Format: bestanden
Tests: 7 Suites / 142 Tests bestanden
```

Der isolierte reale Ziellauf bestätigte genau die erwartete Verbesserung:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-18-RECALL-8DC032A5-20260903

summarySha256:
ba8516691be81ee449cb0d8973d6808575c9a0914778a1f12a21c6f818f2550c

selectionDigest:
5bc5925fb699be95ff52275be2121ac521ef575ea191830f6f24bcdaf1217cdb

Aufrufe: Triage 15 / Effects 4
Server-Terminals: 32
```

Gegenüber dem Ausgangslauf wurden zwei falsche Nullkomponenten beseitigt:

- Paket A `enclosures`: jetzt FOUND / INCLUDED;
- Paket B `fences`: jetzt FOUND / INCLUDED.

VS-18 blieb erwartungsgemäß `TEILBELEGT / TEILBELEGT`, `UNKLAR`, Review ja.

#### 10.27.3 Eindeutige paketweite Fehlerdiagnose

Der Ziellauf zeigte außerdem, dass eine tatsächlich paketweit fehlende
Komponente einmal pro Dokument als eigener Blocker ausgegeben wurde. Das
verfälschte zwar nicht die Zahl der Kundenreview-Zeilen, blähte aber die
interne Ursachenliste auf. Commit `162f08b5` konsolidiert einen
`MISSING_REQUIRED_COMPONENT`-Blocker deshalb einmal pro Paket und Komponente,
fasst alle betroffenen Dokument-UUIDs darin zusammen und unterdrückt ihn,
solange dieselbe Komponente einen ungelösten Kandidaten besitzt. Commit
`e91f2723` enthält nur die Mac-Studio-Formatierung. Produktprofil: V48.

Mac-Studio-Prüfung:

```text
Commit: e91f2723c791a9d72e08abda1a46b4b4587d91bc
Pfad: /private/tmp/pv3-vs19-amount-LOqa66/repo
Format: bestanden
Tests: 5 Suites / 163 Tests bestanden
```

Finaler Diagnoselauf dieser Stufe:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-18-DIAGNOSTIC-E91F2723-20260903

summarySha256:
f7847aefb0cdd7ef53d718937d3ec3a614ff553402e3a1d505a5497173a15ad3

selectionDigest:
5bc5925fb699be95ff52275be2121ac521ef575ea191830f6f24bcdaf1217cdb

Paket A: TEILBELEGT
Paket B: TEILBELEGT
Entscheidung: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja

Verbleibende eindeutige Blocker:
- A: gates fehlt;
- B: walls fehlt;
- B: enclosures ist in EABS zusätzlich nur DEFINED;
- B: gates ist in EABS nur DEFINED;
- B: mehrere unterschiedliche enclosures-Atome.
```

Die drei alten B-`walls`-Blocker wurden korrekt zu einem Blocker mit drei
Dokument-UUIDs zusammengeführt. Damit beschreibt die Diagnose jetzt fünf
verschiedene fachliche Ursachen statt sieben Einträge mit Duplikaten.

#### 10.27.4 Noch nicht sicher freigegebener Folgeschritt

Ein pauschales `componentSatisfactionPolicy: ANY` wurde ausdrücklich
verworfen. Sonst könnte ein enger Tor-, Feuer- oder Einbruchbeleg die gesamte
Einfriedungszeile erfüllen.

Für den fachlich erwarteten Deckungsvergleich braucht es stattdessen einen
versionierten Hierarchie- und Definitionsvertrag:

```text
Einfriedung / Grundstücksbegrenzung
  -> Zaun / Umzäunung
  -> Einfriedungsmauer
  -> Tor / Schranke
```

Die Oberklasse darf Untertypen nur dann erfüllen, wenn eine breite positive
Deckung und entweder ein offener Beispielmarker oder eine ausdrücklich
referenzierte Definition den Umfang quellengebunden beweisen. Ein einzelner
Untertyp darf nie rückwärts die gesamte Oberklasse erfüllen. `DEFINED` darf
erst gemeinsam mit dem darauf verweisenden `INCLUDED`-Fakt wirksam werden.

Bis dieser Paketvertrag implementiert und mit positiven, negativen,
adversarialen und Scope-Varianten geprüft ist, bleibt VS-18 offen. Der
R69-A-Stand bleibt `5/40`; ein Vollrun und ein Deployment wurden nicht
durchgeführt.

Betroffene produktive Grenzen:

```text
Katalog/Aliase:
server/resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json:468-515

Occurrence-Suche:
server/utils/policyAnalysis/controlledOccurrenceWorksheet.js:2359-2381

Technische Teilkomponenten-Abwehr:
server/utils/policyAnalysis/deterministicCategoryEvidenceRules.js:351-366

Atommaterialisierung/Paketaggregation:
server/utils/policyComparison/resultBuilder.js

Paketblocker:
server/utils/policyComparison/packageReviewAudit.js:155-370

Entscheidungsregeln:
server/utils/policyComparison/pointDecision.js
```

#### 10.27.5 Gerichteter Objektfamilienvertrag und realer Abschluss

Die offene Hierarchie wurde nicht mit `ANY`, Dokumenttyp-Heuristiken oder
einer Definition-gleich-Deckung-Abkürzung geschlossen. Stattdessen besitzt
VS-18 jetzt den kataloggebundenen Vertrag
`DIRECTED_OBJECT_FAMILY_V1`:

```text
Wurzel: enclosures
Mitglieder: fences, walls, gates
Richtung: allgemeiner Wurzeleinschluss -> Mitglieder
Verbotene Rückrichtung: einzelnes Mitglied -/-> Wurzel
Vergleichsdimension: ausschließlich COVERAGE_PRESENCE_ONLY
```

Eine Seite erfüllt diesen Vertrag nur, wenn ihr rohes Wurzelatom vollständig,
allgemein, paketzugehörig und positiv `INCLUDED` ist. Konflikte, ungelöste
Kandidaten, enger Scope, ein bloßes `DEFINED`, Ausschlüsse oder bedingte
Wirkungen lassen die Regel fail-closed. Limits, Selbstbehalte und Bedingungen
werden weder übernommen noch gleichgesetzt.

Produktive Commits und getrennte Forward-Fixes:

```text
0fc34e8a feat(comparison): compare directed object families
78eee3c9 style(comparison): format object family contract
0f2fc438 test(comparison): complete object family scope fixture
8b9f2c8b test(policy): align FE-C07 absence inventory
```

Der letzte Testcommit verändert keine Produktionssemantik. Er korrigiert den
seit `FE-C07` veralteten statischen Katalogzähler von
`91 COVERAGE_ONLY / 25 COVERAGE_MIXED` auf die bereits produktiv vorhandenen
`92 / 24`.

Mac-Studio-Validierung des exakten Commits
`8b9f2c8b853623ec139f6daed077bcf5bb02485c` im isolierten Worktree
`/private/tmp/pv3-vs19-amount-LOqa66/repo`:

```text
Node: v22.23.2 aus dem installierten Audit-Runtime
Formatprüfung: PASS
Fokussierte Suites: 10/10 PASS
Fokussierte Tests: 286/286 PASS
```

Der anschließende Ziellauf baute VS-18 auf allen zehn unveränderten
Kundendokumenten neu auf:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-18-FAMILY-8B9F2C8B-20260903
Summary-Digest:
1dd461ba8809fe9063c3715cb10cc4c6cb2ea89483387b8bf8eb1878306130c0
Target-Selection-Digest:
ec490a5e216edb121261b326ec3e70ae12aa6ddc1b58b6d15d84e21b10756b91
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Dokumente: 10
Triage-Qwen-Aufrufe: 15
Evidence-Qwen-Aufrufe: 4
Triage-Server-Rejects: 0
Evidence-Terminals: 32
```

Beide Pakete besitzen darin je einen vollständigen allgemeinen
`enclosures / INCLUDED`-Wurzelbeleg. Paket A bindet die Belegstellen auf
physischer Seite 4 unter anderem an `Grundstücksbegrenzungen` sowie
`Begrenzungen und Umzäunungen`. Paket B bindet die Belegstellen auf den
physischen Seiten 9 bis 10 an `Einfriedungen`. Die unterschiedlichen zusätzlich
beobachteten Unterbegriffe bleiben im Audit sichtbar, entscheiden die
deckungsgleiche Oberklasse aber nicht rückwärts.

Revisionssicheres Delta:

```text
VS-18 vorher:
UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review

VS-18 nachher:
GLEICHWERTIG / EQUAL_DIRECTED_OBJECT_FAMILY_COVERAGE / kein Review
Regel: EQUAL_DIRECTED_OBJECT_FAMILY_COVERAGE_V1
```

Damit steigt R69-A auf `6/40`; `34` Fälle dieser Ausgangsfamilie bleiben
offen. Unter Einbeziehung aller zuvor akzeptierten gezielten Deltas ändert
sich die weiterhin nicht durch einen frischen 224-Zeilen-Lauf bestätigte
Projektion von
`VORTEIL_A 2 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 120 / NICHT_VERGLEICHBAR 11 / UNKLAR 55` auf
`VORTEIL_A 2 / VORTEIL_B 3 / DOKUMENTATIONSUNTERSCHIED 33 /
GLEICHWERTIG 121 / NICHT_VERGLEICHBAR 11 / UNKLAR 54`.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

### 10.26 VS-02 – variable Zeitwertschwellen gefunden, echter Vertragsrang bleibt offen

#### 10.26.1 Ausgangsfehler

Der gebundene Ausgangslauf auf Commit `19c12eef` erzeugte:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-02-BASELINE-19C12EEF-20260903

summarySha256:
b7e82e8f2d091eb6cb50381d834037193eff227fb580c303fe3fd1b4fcf40f7e

selectionDigest:
a9f70073b31e2b6769a26b5076e9de2a24f6ee215b6e032bea91d787befbf567

Paket A: BELEGT
Paket B: TEILBELEGT
Entscheidung: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja
```

Die ursprüngliche Diagnose `B residual_value_threshold fehlt` war sachlich
falsch. Die Dokumente enthalten drei unterschiedliche, relevante Schwellen:

- Paket A, LF-Dokument, physische Seite 26: Zeitwert mindestens `30 %` des
  Neuwerts; außerdem eine Drei-Jahres-Bedingung für die
  Neuwertentschädigung;
- Paket B, GenVerbund-Rahmenklausel, physische Seite 7: Zeitwert zumindest
  `20 %` des Neuwerts;
- Paket B, EABS, physische Seite 6: liegt der Zeitwert unter `40 %` der
  Neuherstellungskosten, wird maximal der Zeitwert ersetzt.

Die bisherige VS-02-Suche und deterministische Evidenzbindung erkannten nur
nahezu wörtliche `30 %`-Formulierungen. Insbesondere eingeschobene
Objektphrasen wie `Zeitwert der Sachen unter 40 %` und `Zeitwert der
versicherten Gebäude und Sachen ... zumindest 20 %` fielen durch. Der
historische Nulltreffer war deshalb ein Recallfehler und kein Nachweis
fehlender Deckung.

#### 10.26.2 Wiederverwendbarer Schwellenvertrag

Commit `ea3f0d2c` führte den gemeinsamen, versionierten Vertrag
`VS02_RESIDUAL_VALUE_THRESHOLD_CLAUSE_V1` ein. Derselbe Parser wird für
Konzeptsuche, deterministische Evidenzbindung und Feldextraktion verwendet.
Er akzeptiert lokal gebundene Mindestschwellen und Untergrenzenformen mit
eindeutiger Zeitwert-Rechtsfolge, typisiert den Wert als `PERCENT` und bindet
die Bezugsgröße im Qualifier. Fremde Prozente, bloße Restwertangaben und
andere Gefahren bleiben ausgeschlossen.

Der VS-Katalog wurde von `v0.10` auf `v0.11` und das Produktprofil auf V44
angehoben. Commit `913e930a` enthält ausschließlich die vom Mac-Studio-
Formatter erzeugte Darstellung. Commit `f74ea02a` aktualisierte die davon
abhängigen Katalog-/Digest-Fixtures.

Mac-Studio-Prüfung für diese Stufe:

```text
Commit: f74ea02a
Format: bestanden
Tests: 9 Suites / 239 Tests bestanden
```

Der erste echte Ziellauf fand danach die richtigen Kandidaten, konnte die
Feldwerte aber noch nicht materialisieren:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-02-THRESHOLD-RECALL-F74EA02A-20260903

summarySha256:
a8d00eec6645c5634d94554dae15224b18585de5cc0defa7dfed968b354191b1
```

Ursache war eine zweite, unabhängige Grenze: Der Parser lieferte den
Klauselspan, während die Feldbindung nur vollständig im ursprünglichen
Trefferspan liegende Fakten akzeptierte. Commit `529ecfb9` ersetzte diese
falsche Enthaltenheitsannahme durch eine kontrollierte Spanüberlappung.

Mac-Studio-Prüfung und Ziellauf:

```text
Commit: 529ecfb9
Format: bestanden
Tests: 5 Suites / 200 Tests bestanden

QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-02-THRESHOLD-SPAN-529ECFB9-20260903

summarySha256:
177ff95f7a664d9a0c45da77131036c9f449093cd748164de2b6ef4cc8353b00

selectionDigest:
04d681b111b42f97f78b41ff0da6f8c80366596c7f4bed93d1e4a5c42990a85e
```

Damit wurden `30 %`, `20 %` und `40 %` mit exakten Dokument-, Seiten- und
Kandidatenquellen materialisiert.

#### 10.26.3 Paketweite Pflichtkomponenten und atomlokale Feldstati

Der nun sichtbare Paketinhalt deckte zwei Fehler in der nachgelagerten
Prüfung auf:

1. `packageReviewAudit` meldete eine Pflichtkomponente pro Dokument als
   fehlend, obwohl sie in einem anderen Dokument derselben Seite vorhanden
   war. Commit `2c7dc05d` prüft `ALL`-Komponenten nun paketweit. Er entfernt
   ausschließlich den falschen `MISSING_REQUIRED_COMPONENT`-Blocker.
2. `materializeAtomicFacts` übernahm den Feldstatus der gesamten Anforderung
   auf jedes einzelne Atom. Dadurch konnte ein Feldfund aus einer Klausel ein
   anderes Atom ohne lokal gebundenen Feldwert fälschlich als `COMPLETE`
   markieren. Commit `3e7d08d6` leitet den Status nun aus den tatsächlich an
   das jeweilige Atom gebundenen Fakten ab; Commit `3193f50c` ist nur dessen
   Mac-Studio-Formatierung. Das Produktprofil ist deshalb V46.

Mac-Studio-Prüfung der finalen Integritätsstufe:

```text
Commit: 3193f50c574f976431c22076726ce2deaf2a5972
Pfad: /private/tmp/pv3-vs19-amount-LOqa66/repo
Runtime: gebundene Node-v22.23.2-Runtime des QWEN36-Auditlaufs
Format: bestanden
Tests: 5 Suites / 224 Tests bestanden
```

Finaler VS-02-Ziellauf:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-02-ATOM-STATUS-3193F50C-20260903

summarySha256:
010b50b53abf318da0ae74cf3940172f42473a6ed0eefaef814e7d6c2b4056a6

selectionDigest:
04d681b111b42f97f78b41ff0da6f8c80366596c7f4bed93d1e4a5c42990a85e

Aufrufe: Triage 4 / Effects 1
Server-Terminals: 15
Paket A: BELEGT
Paket B: TEILBELEGT
Entscheidung: UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja

Verbleibende Blocker:
- FIELD_INCOMPLETE auf Paket B;
- MULTIPLE_ATOMS_SAME_COMPONENT für residual_value_threshold auf Paket B.
```

Der wieder sichtbare `FIELD_INCOMPLETE`-Blocker ist kein Recallrückschritt.
Er ist die beabsichtigte Korrektur einer falschen Vollständigkeitsanzeige:
Die EABS-Zeitwertklausel besitzt einen lokalen Fund, aber der aktuell
angeforderte Bedingungswert wird an diesem Atom noch nicht materialisiert.

#### 10.26.4 Warum noch kein Vorteil freigegeben wird

Die verbleibende Unsicherheit ist dokumentinhaltlich real:

- Die EABS nennen `40 %` der Neuherstellungskosten.
- Die GenVerbund-Rahmenklausel nennt `20 %` des Neuwerts.
- Die Rahmenklausel enthält eine Günstigkeitsregel, nach der bei
  widersprüchlichen Vertragsbestandteilen die günstigere Auslegung gilt.
- Das Angebot belegt Premiumschutz und nennt eine Rahmenvereinbarung
  WEVIG/Familienwohnbau. Das konkrete GenVerbund-Dokument identifiziert sich
  jedoch anders; der eindeutige Identifier-Join zwischen Angebot und genau
  dieser Rahmenklausel fehlt.

Wären Anwendbarkeit und gemeinsamer Gebäudescope bewiesen, wäre `20 %`
fachlich günstiger als `30 %` beziehungsweise `40 %`. Eine globale Regel
`SUPPLEMENT schlägt TERMS` oder `kleinere Zahl gewinnt` wäre jedoch falsch:
Sie könnte nicht aktivierte Zusatzbedingungen, abweichende Bezugsgrößen oder
unterschiedliche Objektbereiche vermischen.

Der sichere spätere Abschluss benötigt daher einen versionierten Vertrag für
die konkrete Dokumentaktivierung, den gemeinsamen Objekt-/Wertscope und die
dokumentgebundene Günstigkeitsregel. Bis dahin bleibt VS-02 bewusst offen.
Die Zeile zählt nicht als abgeschlossener R69-A-Kandidat; der Stand bleibt
`5/40`, also `35` offen. Ein Vollrun und ein Deployment wurden nicht
durchgeführt.

Betroffene produktive Grenzen für einen späteren VS-02-Schritt:

```text
Katalog/Konzeptfamilie:
server/resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json

Gemeinsamer Schwellenparser:
server/utils/policyAnalysis/residualValueThresholdContract.js

Deterministische Kandidatenbindung:
server/utils/policyAnalysis/deterministicVsEvidenceRules.js:408-422

Feldextraktion:
server/utils/policyAnalysis/requestedFieldEvidenceContract.js:1337-1355

Atommaterialisierung und lokale Feldstati:
server/utils/policyComparison/resultBuilder.js:1031-1150

Paketblocker und paketweite Pflichtkomponenten:
server/utils/policyComparison/packageReviewAudit.js:155-300

Produkt-/Katalogidentität:
server/utils/policyComparison/productContract.js
```

### 10.25 FE-A10 – enger Einschlussscope wird vollständig, aber nicht gleichgesetzt

#### 10.25.1 Ausgangsfehler

FE-A10 vergleicht Schäden durch den Anprall von Fahrzeugen. Der frische
Ausgangslauf am unveränderten Stand `ff0dea76` fand bereits belastbare
Einschlüsse auf beiden Seiten:

```text
Paket A: BELEGT
  Fahrzeuganprall INCLUDED / GENERAL
Paket B: TEILBELEGT
  Anprall unbekannter Fahrzeuge INCLUDED / NARROW_ONLY
Entscheidung:
  UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja
```

Paket B war nicht fundlos. Zwei Dokumente enthielten ausdrücklich den engeren
Schutz für unbekannte Fahrzeuge: das Angebot auf physischer Seite 1 und der
Zusatz auf physischer Seite 10. Beide Treffer waren direkte positive
Deckungsevidenz, wurden aber allein wegen ihres engeren Scopes als
`SCOPE_INCOMPLETE` markiert. Der Fehler lag daher nicht im Recall, sondern in
der zeilenspezifischen Vollständigkeitsregel.

```text
Commit: ff0dea760dbc1aad5f7917aaac57eb037c668700
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/FE-A10-BASELINE-FF0DEA76-20260903
Summary-Digest:
184aea6705e0ee6f97e870b9b7bb6014fdffbdd387e3d906f757b5141fe9efd8
Target-Selection-Digest:
6e6780db5c6d65a2b1125404ef8f1f04ab6b32b8b04bbe938822e8b663edc55e
Producer-Digest:
196dedc26e5d8c8008158cdf514180b02fcd00bc59ab38547725b47b80b9275b
```

#### 10.25.2 Kleiner, zeilenspezifischer Fix

Der Fix aktiviert für FE-A10 den bereits vorhandenen, eng begrenzten Vertrag
`MATCHING_SCOPE_INCLUDED_SUFFICIENT`. Ein positiver `NARROW_ONLY`-Treffer darf
damit den Paket-Prüfstatus vervollständigen. Er wird ausdrücklich **nicht** zu
`GENERAL` hochgestuft und nicht mit einem allgemeinen Einschluss
gleichgesetzt. Der nachgelagerte atomare Vergleich sieht weiterhin den
Scope-Unterschied.

```text
Commit: 293c8178ddfcee4ca3e40d76ed28551961c162d6
FE-Katalog: fe-occurrence-full-draft-v0.8
Produktprofil: CUSTOMER_CORE_5_V43_FEA10_MATCHING_INCLUDED_SCOPE
Mac-Studio-Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Formatprüfung: PASS
Fokussierte Suites: 6/6 PASS
Fokussierte Tests: 162/162 PASS
```

Positive, negative und adversariale Kontrollen belegen dabei insbesondere:

- ein direkter Einschluss unbekannter Fahrzeuge wird vollständig;
- ein Ausschluss oder bloßer Kontexttreffer wird nicht positiv;
- der enge Scope bleibt typisiert und sichtbar;
- `GENERAL` gegen `NARROW_ONLY` wird nicht als Gleichwertigkeit oder Vorteil
  ausgegeben.

#### 10.25.3 Reales Zielergebnis und Risikogrenze

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/FE-A10-MATCHING-SCOPE-293C8178-20260903
Summary-Digest:
464518f719923a79ef7b16f112524acb7c828ebee0e1cd46f096dba434e6baaf
Target-Selection-Digest:
386dc246391709d0b8df4e330ff697ec7288470fbbff6f1ceb05c9fb518e57b5
Producer-Digest:
28704abf89aa7b3c92b2c2a4ca9d08eb80da0deb9e2c1cbfa9e68216f8ec79b7
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Dokumente: 10
Triage-Qwen-Aufrufe: 3
Evidence-Qwen-Aufrufe: 1
Server-Terminalkomponenten: 7
```

Revisionssicheres Delta:

```text
Vorher:
A BELEGT / B TEILBELEGT
UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja

Nachher:
A BELEGT / B BELEGT
NICHT_VERGLEICHBAR / COMPARABILITY_GATE_FAILED / Review nein
Regel: ATOMIC_COMPARABILITY_GATE_V1
```

Das Ergebnis ist absichtlich nicht `VORTEIL_A`: Allgemeiner Fahrzeuganprall
und Anprall unbekannter Fahrzeuge beschreiben unterschiedliche Scopes. Die
beiden B-Dokumente nennen zudem unterschiedliche Geldbeträge; FE-A10 fordert
derzeit keine Wertfelder an. Der Fix behauptet deshalb weder gleiche Limits
noch eine Rangfolge der Dokumente. Er entfernt ausschließlich den falschen
Review-Blocker und bewahrt den echten Scope-Unterschied.

R69-A steht damit bei `5/40` abgeschlossenen Kandidaten; `35` bleiben offen.
Die noch nicht durch einen frischen 224-Zeilen-Vollrun bestätigte Projektion
verschiebt sich von `Nicht vergleichbar 10 / Unklar 56` auf
`Nicht vergleichbar 11 / Unklar 55`. Alle übrigen Ergebnisgruppen bleiben
unverändert.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

### 10.24 LW-07 – Sanitärkeramik über operative Frostklausel wiederfinden

#### 10.24.1 Ausgangsfehler und verworfener falscher Vorteil

Der aktuelle Ausgangslauf bestätigte zunächst das historische Bild:

```text
Paket A: BELEGT
  Armaturen INCLUDED / GENERAL
  Sanitärkeramik INCLUDED / GENERAL
Paket B: TEILBELEGT
  Armaturen INCLUDED / GENERAL
  Sanitärkeramik NOT_FOUND
Entscheidung:
  UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja
```

Ein zunächst erwogener Vertrag
`A vollständig belegt + B kontrollierter Komponenten-Nichtfund => Vorteil A`
wurde nach unabhängiger Gegenprüfung verworfen. DOC-02/B enthält auf
physischer Seite 3 ausdrücklich:

```text
Schäden an angeschlossenen Einrichtungen und Armaturen anlässlich Rohrbruch,
Rohrbruch durch Korrosion und Frostschaden ...
Ersatz oder die Reparatur von WC-Schalen, Ventilen und Siphonen, auch ohne
Rohrgebrechen
```

Auf physischer Seite 14 steht zusätzlich unter der Frostklausel, dass
angeschlossene Einrichtungen innerhalb von Gebäuden mitversichert sind. Der
gespeicherte Nichtfund war damit kein belastbarer Beweis fehlender Deckung,
sondern eine zu enge Objekt- und Beziehungsfamilie. Eine sofortige
Vorteilsfreigabe hätte einen falschen `VORTEIL_A` erzeugt.

Ausgangsreproduktion:

```text
Commit: 34bd998548fb4999e425c975e82597939cdd9088
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LW-07-BASELINE-34BD9985-20260903
Summary-Digest:
71a06107954958bbb63a946f729f0aa194ee1030a323f43bdb4638c11f0b5345
Target-Selection-Digest:
eedeb613d78b0354b64d50c1da175ed5340ddb85b9fc1fdb6fd395125989cc95
```

#### 10.24.2 Erste Stufe – Sanitärgegenstände auffindbar, aber kein Delta

Der erste kleine Recall-Fix ergänzte die allgemeine Sanitärkeramik-Familie um
`WC-Schale`, `WC-Schalen`, `Toilettenbecken`, `Klosettbecken`,
`Sanitärgegenstände` und `Sanitäreinrichtungen`. Ungeprüfte Begriffe wie
`Siphon`, `WC-Sitz`, `WC-Spülkasten`, `Keramikfliesen` und
`Sanitärreinigung` blieben negative Kontrollen.

Im echten Lauf wurde `WC-Schalen` korrekt als direkter Kandidat gebunden.
Qwen übernahm den isolierten Listeneintrag `Ersatz oder Reparatur ... auch
ohne Rohrgebrechen` aber nicht als Beleg für die enger bezeichnete
Frostschaden-Komponente. Das war die richtige fail-closed Entscheidung. Die
Zeile blieb `UNKLAR`; es wurde kein Vorteil erzwungen.

```text
08455fc2 fix(analysis): recall LW-07 sanitary fixtures
994c9101 test(qa): advance LW target catalog pair
fd288ffe test(qa): advance ST target catalog pair

QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LW-07-SANITARY-FD288FFE-20260903
Summary-Digest:
771aa57121fbb9f4f94bfb6452a64203ff2d8e10737a5a1cee636dfa842375f2
Target-Selection-Digest:
346ad3ce1093635aeb0c2ce37b273b6d53106ac7a17e60b60392b6be33032ddc
Producer-Digest:
473c4c812eae10b68da38a8dc22041de86f8ab191a4bd4b9ff5b196f0f4776f0
Ergebnisdelta: keines
```

Die beiden Registry-Commits sind reine Forward-Fixes aus den Mac-Gates. Der
erste Testlauf fand den erwarteten historischen/aktuellen LW-Katalogvergleich
noch auf `v0.8`; der zweite deckte dieselbe bereits zuvor überholte
ST-Erwartung `v0.5` statt `v0.6` auf. Es wurde keine Historie umgeschrieben.

#### 10.24.3 Zweite Stufe – Frost und angeschlossene Einrichtungen lokal binden

Der zweite kleine Fix erweitert nicht die Deckungsentscheidung, sondern nur
den kontrollierten Recall um operative, in derselben Klausel gebundene
Formulierungen:

```text
Frostschaden an angeschlossenen Einrichtungen
Frostschäden an angeschlossenen Einrichtungen
Frost an angeschlossenen Einrichtungen
Schäden an angeschlossenen Einrichtungen und Armaturen anlässlich
Rohrbruch, Rohrbruch durch Korrosion und Frostschaden
```

Allgemeine Nennungen angeschlossener elektrischer Einrichtungen oder eine
Reparatur nach Überspannung bleiben ohne Frostbezug fundlos. Ein
`CLAUSE_SECTION`-Scope war nicht nötig: Gefahr, Schaden und Objekt stehen in
der produktiven B-Fundstelle bereits innerhalb derselben `LIST_ITEM`-Einheit.

Versionierung und Validierung:

```text
Commit: cd06f4d570fff5fa5923e7d0357ac6ad2a90ef35
LW-Katalog: lw-occurrence-full-draft-v0.10
Produktprofil: CUSTOMER_CORE_5_V42_LW07_CONNECTED_FIXTURE_RECALL
Mac-Studio-Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Formatprüfung: PASS
Fokussierte Suites: 5/5 PASS
Fokussierte Tests: 158/158 PASS
```

Realer Zehn-Dokument-Ziellauf:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LW-07-CONNECTED-FIXTURE-CD06F4D5-20260903
Summary-Digest:
422f34825e17d1ae264328dba396c55a7d7adec3d55cd32b5fac32e270a1b4c6
Target-Selection-Digest:
bb0a911ebc3fbbef95b9f524a638dd92518083950c6651e071ef959d5c8ae670
Producer-Digest:
79e3444bc91c5b34d096b2aba98a51e3b869644b0f94b3dce7dd3ba33bd916f0
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Dokumente: 10
Triage-Qwen-Aufrufe: 3
Evidence-Qwen-Aufrufe: 2
Server-Terminalkomponenten: 16
```

Revisionssicheres Delta:

```text
Vorher:
A BELEGT / B TEILBELEGT
UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja

Nachher:
A BELEGT / B BELEGT
GLEICHWERTIG / ALL_ATOMIC_DIMENSIONS_EQUIVALENT / Review nein
Regel: ATOMIC_COVERAGE_EQUALITY_V1
```

Beide Komponenten sind nun beidseitig quellengebunden `INCLUDED / GENERAL`.
Dokumentstatus `FRAMEWORK_TERMS` auf A und `PROPOSAL` auf B wird korrekt nur
als Paketprovenienz erhalten und blockiert den Gebäudepaketvergleich nicht.

R69-A steht damit bei `4/40` abgeschlossenen Kandidaten; `36` bleiben offen.
Die noch nicht durch einen frischen 224-Zeilen-Vollrun bestätigte Projektion
verschiebt sich von `Gleichwertig 119 / Unklar 57` auf
`Gleichwertig 120 / Unklar 56`. Alle übrigen Ergebnisgruppen bleiben
unverändert.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

### 10.23 ST-27 – passender enger Einschlussscope ist vollständige Evidenz

#### 10.23.1 Ausgangsfehler

ST-27 verlangt beide Gefahrenkomponenten `avalanche` und `snow_slide`.
Der kontrollierte Lauf hatte beide Komponenten in beiden Paketen bereits
gefunden. Trotzdem blieb Paket A `TEILBELEGT`, weil die ausdrückliche
Lawinenaufnahme als `NARROW_ONLY` klassifiziert war und die bisherige globale
Defaultregel für vollständige Evidenz zwingend `GENERAL` verlangte.

Das war kein Recallfehler und kein fehlender Dokumentrang:

```text
Paket A:
  Lawine       INCLUDED / NARROW_ONLY
  Schneerutsch INCLUDED / GENERAL
Paket B:
  Lawine       INCLUDED / GENERAL
  Schneerutsch INCLUDED / GENERAL
Vorherige Entscheidung:
  UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
  Blocker A Lawine: SCOPE_INCOMPLETE
```

Eine engere, aber exakt zur Komponente gehörende positive Deckung darf für die
Evidenzvollständigkeit nicht als fehlend behandelt werden. Sie darf zugleich
nicht auf allgemeinen Schutz hochgestuft werden. Der Katalogvertrag von ST-27
wurde deshalb ausschließlich auf
`MATCHING_SCOPE_INCLUDED_SUFFICIENT` gesetzt. Dadurch wird der gefundene enge
Scope entscheidungsfähig und bleibt als `NARROW_ONLY` im Atom und Audit
erhalten. Andere ST-Zeilen und nicht positive Wirkungen behalten ihre
bisherigen Regeln.

Versionierung und Commits:

```text
ST-Katalog: st-occurrence-full-draft-v0.6
Produktprofil: CUSTOMER_CORE_5_V40_ST27_MATCHING_INCLUDED_SCOPE
974b7b5b fix(analysis): accept matching ST-27 included scope
a7aacd90 style(analysis): format ST-27 scope test
```

#### 10.23.2 Mac-Studio-Validierung und realer Ziellauf

Die erste Formatprüfung von `974b7b5b` meldete ausschließlich die neue
ST-27-Testdatei. Der separate Forward-Fix `a7aacd90` korrigierte diese
Formatierung; es wurde keine Historie umgeschrieben. Danach liefen auf dem
Mac Studio:

```text
Commit: a7aacd9039743b21ec65374046f357bef1c7f3a5
Worktree: /private/tmp/pv3-vs19-amount-LOqa66/repo
Node: v22.23.2 aus dem installierten Audit-Runtime
Formatprüfung: PASS
Fokussierte Suites: 5/5 PASS
Fokussierte Tests: 180/180 PASS
```

Der echte Ziellauf baute ST-27 anschließend für alle zehn unveränderten
Kundendokumente neu auf:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/ST-27-MATCHING-SCOPE-A7AACD90-20260903
Summary-Digest:
c906df87f3a5356ee101593e071bd3c98a6aef4aff4cc114fac962b1d2d72dcb
Target-Selection-Digest:
4d99bd3de39f636198a70af525352755731e1433b65a10290ba634d0e482d96f
Producer-Digest:
6f2269062204daae77530b0394d94093d40ca7305ad4a8e7b05fe84d6a1e6405
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Dokumente: 10
Triage-Qwen-Aufrufe: 6
Evidence-Qwen-Aufrufe: 0
Server-Terminalkomponenten: 14
```

Revisionssicheres Delta:

```text
Vorher:
A TEILBELEGT / B BELEGT
UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja

Nachher:
A BELEGT / B BELEGT
NICHT_VERGLEICHBAR / COMPARABILITY_GATE_FAILED / Review nein
Regel: ATOMIC_COMPARABILITY_GATE_V1
```

Der Abschluss ist fachlich begründet: Die Lawinenkomponente ist auf A enger
und auf B allgemein eingeschlossen; die Schneerutschkomponente ist auf beiden
Seiten allgemein eingeschlossen. Der Fix erfindet weder einen fehlenden Fund
noch einen Vorteil, sondern macht den tatsächlich gefundenen Scope für den
bestehenden atomaren Vergleich nutzbar.

R69-A steht damit bei `3/40` abgeschlossenen Kandidaten; `37` bleiben offen.
Unter Einbeziehung aller akzeptierten gezielten Deltas verschiebt sich die
noch nicht durch einen frischen 224-Zeilen-Vollrun bestätigte Projektion von
`Nicht vergleichbar 9 / Unklar 58` auf
`Nicht vergleichbar 10 / Unklar 57`. Alle übrigen Ergebnisgruppen bleiben
unverändert.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

### 10.22 VS-19 – Objektklassifikation und komponentenbezogene Paketbeträge

#### 10.22.1 Ausgangsfehler und unveränderte Zielgrenze

VS-19 beschreibt drei alternativ erfüllbare Teilpunkte:

```text
outdoor_paths     Wege
outdoor_lighting  Außenbeleuchtung
planting          Bepflanzung
componentSatisfactionPolicy: ANY
```

Der Target-Loop verwendete weiterhin dieselben zehn Dokumentartefakte aus
`PAV8-03D-VS14-2D964B45-20260902-073000`. Angebote, Polizzen,
Rahmenbedingungen und Zusatzverträge wurden dabei als gemeinsame Dokumente
ihres Pakets A beziehungsweise B behandelt. Der Dokumentstatus allein war
weder Ausschluss- noch Entscheidungsgrund.

Der Startlauf unter dem bis dahin aktuellen Code hatte Paket A als `BELEGT`,
Paket B aber nur als `TEILBELEGT` beziehungsweise nach Zwischenfixes als
`RANGFOLGE_PRÜFEN` ausgewiesen. Zwei voneinander unabhängige Ursachen wurden
nachgewiesen:

1. DOC10 enthielt unter den Überschriften `Nicht als Gebäude oder
Gebäudebestandteile zählen` und `Nicht als Betriebsinhalt gelten` reine
   Objektklassifikationen. Sie waren keine operative Deckung für Wege oder
   Beleuchtung, wurden aber als Fund weitergereicht.
2. Der Paket-Rollup verglich `EUR 15.000` für Bepflanzung und `EUR 10.000`
   für Wege zeilenweit und erzeugte daraus fälschlich einen
   Dokumentrangkonflikt. Die Beträge gehörten zu verschiedenen
   `ANY`-Komponenten und konkurrierten nicht miteinander.

#### 10.22.2 Objektklassen-Terminal und Präambelbindung

Der neue Terminalvertrag ist ausschließlich für die beiden zertifizierten
VS-19-Komponenten `outdoor_paths` und `outdoor_lighting` aktiv. Er akzeptiert
nur:

- `EXCLUDED_FROM_CLASS` unter einer aktuellen Objektklassengrenze;
- exakt zugelassene Subjects und Zieltexte;
- eine lokale `LIST_ITEM`-Einheit mit konsistenten Offsets;
- höchstens 16 Zeichen zwischen Klassengrenze und Listeneinheit;
- keinen operativen Deckungs-, Bedingungs-, Pflicht-, Wert- oder
  Ersetzungstext.

Die generische Präambel
`Versicherungsschutz besteht ausschließlich für jene Sachen, die in der
Polizze angeführt sind` darf nur unter dem vollständigen Resetproof aus dem
Scantext entfernt werden. Der übrige Scope-Lead bleibt vollständig aktiv.
Sobald dort ein Zielbegriff, weiterer Deckungssatz, Ausschluss, eine Bedingung
oder ein Wert vorkommt, greift der Terminal nicht. Rohtext und Offsets bleiben
im Occurrence-Digest unverändert gebunden.

Versionierte Verträge:

```text
DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_V2
LOCAL_PURE_OBJECT_CLASS_EXCLUSION_V2_GENERIC_LISTING_PREAMBLE
TERMINAL_OCCURRENCE_PROVENANCE_V5_OBJECT_CLASSIFICATION_SCOPE_LEAD
GENERIC_POLICY_LISTING_ELIGIBILITY_PREAMBLE_BEFORE_OBJECT_CLASS_BOUNDARY_V1
```

Relevante Commits dieser Teilstrecke:

```text
5dd792ab fix(analysis): reject VS-19 object-class exclusions
cec452a0 fix(analysis): harden VS-19 scope reset proof
8a547ae9 fix(analysis): bind VS-19 exclusion boundary text
585584b8 fix(analysis): reject generic VS-19 path mentions
0380e29f test(analysis): bind VS-19 path rejection boundary
0987e119 fix(analysis): preserve VS-19 path semantics
cfc2c276 test(analysis): allow VS-19 path synonyms
2fd7ddc9 fix(analysis): cover inflected VS-19 path terms
995965e6 fix(comparison): resolve complete ANY identity differences
1cc28d37 fix(analysis): reject VS-19 path class exclusions
656273b8 fix(analysis): harden VS-19 path exclusion terminal
f56a9631 style(analysis): format VS-19 path terminal
b639d09f fix(analysis): preserve covered VS-19 outdoor facilities
45b01ef1 fix(analysis): neutralize generic VS-19 listing preamble
bba65246 fix(analysis): bind VS-19 preamble target guard
692ddfbd fix(analysis): reject conditional VS-19 preamble scope
```

Der erste Mac-Test von `45b01ef1` fand, dass der neue Target-Guard nicht aus
dem zertifizierten Zielobjekt weitergereicht wurde. `bba65246` band ihn an den
Proof. Der nächste Test fand die noch nicht erfasste Form `nur bei
Vereinbarung`; `692ddfbd` schloss auch diese Bedingung fail-closed. Diese
Forward-Fixes wurden nicht aus der Historie entfernt.

#### 10.22.3 Reales Ergebnis nach der Objektklassenkorrektur

```text
Commit: 692ddfbd400486b17db721076fd1a33885da4e63
Worktree: /private/tmp/pv3-vs19-scopelead-JKGTts/repo
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-19-SCOPELEAD-692DDFBD-20260903
Summary-Digest:
394748b6ccd7f5c68a580495892de9f4537f4118750025701ca61701653c8df5
Target-Selection-Digest:
47ea37f3aac68f97c9d9ff750f5570c0c95578c89809626de77c50626102d1dd
Producer v03 SHA-256:
b126663f7ff2d00c6124a704318043865d6ed189875608b8b40ff177bd5c51cc
Modell: qwen/qwen3.6-35b-a3b
Kontext: 42496
Dokumente: 10
Triage-Qwen-Aufrufe: 6
Evidence-Qwen-Aufrufe: 2
Server-Terminalkomponenten: 22
```

DOC10 terminalisierte vier reine Klassifikations-Occurrences: je zwei für
Wege und Beleuchtung unter den beiden genannten Objektklassengrenzen. Nur die
erste Wege-Occurrence benötigte die generische Präambelbehandlung. DOC10
lieferte danach für alle drei VS-19-Komponenten `NOT_FOUND/UNKNOWN`.

Paket B blieb zunächst `RANGFOLGE_PRÜFEN`, nun ausschließlich wegen des
komponentenblinden Betragsrollups und mehrerer Atome für Wege und Beleuchtung.

#### 10.22.4 Explizit komponentengebundener Betragsrollup

Der Rollup wurde nicht global gelockert. Der neue Vertrag greift nur, wenn
alle folgenden Bedingungen rekonstruiert werden:

- `componentSatisfactionPolicy === ANY`;
- exakt dieselbe Requirement-ID wie die Dokumentzeile;
- pro Rohatom genau eine Dokument-UUID und pro UUID genau eine beitragende
  Dokumentzeile;
- explizites, passendes `componentScope.id` und Label am Requested-Field-Fakt;
- exakte Rekonstruktion der gerenderten Betragszelle pro Dokument;
- atomlokaler Quellenkontext für die Betragskanonisierung;
- identische Dokumentmengen auf Zeilen- und Atomseite.

Jede fehlende, fremde, verwaiste oder mehrdeutige Bindung fällt auf die
bisherige dokumentweite Rangprüfung zurück. Unterschiedliche Werte innerhalb
derselben Komponente bleiben ebenfalls `RANGFOLGE_PRÜFEN`. Andere `ANY`-Rollen
ohne expliziten `componentScope`, zum Beispiel heutige COST-/LIMIT-Fälle,
werden durch diesen Vertrag bewusst nicht entsperrt.

Der nachgelagerte Vergleicher wurde gleichzeitig gehärtet: Gleiche
`INCLUDED`-Wirkung darf bei unterschiedlichen typisierten Feldern nicht mehr
vorzeitig `GLEICHWERTIG` ergeben. Ein einzelnes typisiertes Limit wird zuerst
verglichen; nicht freigegebene oder mehrdeutige Feldunterschiede bleiben
`UNKLAR`.

```text
ANY_EXPLICIT_COMPONENT_SCOPED_PACKAGE_AMOUNT_PRECEDENCE_V1
Produktprofil: CUSTOMER_CORE_5_V38_ANY_EXPLICIT_COMPONENT_AMOUNT_PRECEDENCE
Vergleichsvertrag: ...ANY_IDENTITY_AMOUNT_V8

c9515527 fix(comparison): scope ANY amounts by component
29f4eb8e style(comparison): format component amount rollup
```

#### 10.22.5 Mac-Studio-Validierung und zweiter Real-Lauf

```text
Finaler Commit dieser Teilstrecke:
29f4eb8e5f57f726560196815171e1d37549d932
Isolierter Worktree:
/private/tmp/pv3-vs19-amount-LOqa66/repo
Node: v22.23.2
Formatprüfung: PASS
Fokussierte Suites: 5/5 PASS
Fokussierte Tests: 146/146 PASS

Breite Utils-Regression:
93 Suites / 1390 Tests PASS
4 bekannte Fixture-Suites / 25 Tests FAIL
Neue Fehlersignatur: keine
```

Die vier bekannten roten Suites sind unverändert
`targetedCategoryMaterializationContract`, `targetedQaManifestContract`,
`baselineWorksheetRebuildContract` und `qualifiedAbsenceCatalogContract`.
Sie erwarten historische FE-Katalogbindungen beziehungsweise die alte
statische Bedeutungsverteilung.

Der erste Lauf-Producer v03 reichte die Atome noch nicht an den neuen
`summarizePackage`-Parameter weiter. Für den zweiten Lauf wurde deshalb v04
erstellt und separat gehasht:

```text
Producer v04 SHA-256:
c8cc4617bd8484942312910813ab17a36bf56e4e51e6670b3e1e76cba47007c0
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-19-COMPONENT-AMOUNT-29F4EB8E-20260903
Summary-Digest:
2d4f3711e5ac3b44e98a3669d75a3bf95bce15523e1071d6f8e0ca30276cec8b
```

Reales Delta:

```text
Paket A: BELEGT -> BELEGT
Paket B: RANGFOLGE_PRÜFEN -> BELEGT
Betrag B vorher: Mehrere dokumentbezogene Werte – Rangfolge prüfen
Betrag B jetzt:
Bepflanzung: EUR 15.000,00 auf Erstes Risiko;
Wege: EUR 10.000 auf Erstes Risiko

Punktentscheidung vorher:
UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION

Punktentscheidung jetzt:
UNKLAR / ANY_COMPONENT_EVIDENCE_INCOMPLETE
```

Damit sind beide nachgewiesenen technischen VS-19-Fehler behoben. VS-19 ist
aber noch nicht fachlich entscheidbar. Die verbliebene Unklarheit ist nicht
mehr Suche oder Paketbetrag:

- A enthält echte engere Scopes, unter anderem Beleuchtungsanlagen ohne
  Beleuchtungskörper und Bepflanzung ohne Waldbestände beziehungsweise nur im
  Zusammenhang eines ersatzpflichtigen Gebäudeschadens;
- B enthält einen echten Eigentumsvorbehalt für Bäume/Sträucher und mehrere
  nicht semantisch identische Beiträge aus Vorschlag und Zusatzvertrag;
- B besitzt für Wege und Beleuchtung jeweils mehr als ein unterschiedliches
  Atom. Ohne typisierten Gefahr-/Subobjekt-/Ersetzungsscope darf daraus weder
  Rang, Gleichheit noch Vorteil erfunden werden.

#### 10.22.6 Lokale statt paketweite Bedingungsprüfung

Der `ANY`-Pfad blockierte zunächst die gesamte Zeile, sobald irgendein
gefundenes Atom einen Bedingungs- oder Ausnahmemarker enthielt. Diese Prüfung
war redundant: `compareDimension` prüft denselben Marker bereits je konkrete
Komponente und bleibt dort fail-closed. Der globale Gate verhinderte dagegen
die präzisere Diagnose mehrerer unterschiedlicher Paketbeiträge.

`7f4dcdfd fix(comparison): localize ANY condition review` entfernte nur den
globalen Vorab-Gate. Unvollständige Atome, abweichende `ANY`-Komponentenmengen,
lokale Bedingungen und mehrere unterschiedliche Atome bleiben weiterhin
blockiert. Der Produktvertrag wurde auf V39 versioniert.

```text
Commit: 7f4dcdfd9c65c16fef6b7701247a26f61527cf4f
Produktprofil: CUSTOMER_CORE_5_V39_ANY_COMPONENT_LOCAL_CONDITION_GATE
Formatprüfung: PASS
Fokussierte Suites: 4/4 PASS
Fokussierte Tests: 116/116 PASS

QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-19-LOCAL-CONDITION-7F4DCDFD-20260903
Summary-Digest:
fef5c2d30a2eec2c662ad05c80c42e1685e90a290cc97f7e1788a2bdbbe5d3d7
Producer v04 SHA-256:
c8cc4617bd8484942312910813ab17a36bf56e4e51e6670b3e1e76cba47007c0

Paket A: BELEGT
Paket B: BELEGT
Punktentscheidung:
UNKLAR / ATOMIC_DOCUMENT_RANK_UNRESOLVED
```

Der verbliebene Blocker ist damit exakt eingegrenzt: Nicht mehr ein
unspezifischer Bedingungsmarker, sondern die tatsächlich unterschiedlichen
Paketbeiträge zu `outdoor_paths` und `outdoor_lighting` verhindern die
eindeutige atomare Paarbildung. Ob diese Beiträge additiv, enger, ersetzend
oder nur gefahrenbezogen nebeneinander gelten, ist in den heutigen Atomen
nicht typisiert.

Die unbestätigte Gesamtprojektion bleibt deshalb unverändert bei:

```text
Vorteil A: 2
Vorteil B: 3
Dokumentationsunterschied: 33
Gleichwertig: 119
Nicht vergleichbar: 9
Unklar / Kundenreview: 58
```

Dies ist keine neue 224-Zeilen-Gesamtmessung. Ein Deployment und ein voller
224-Zeilen-Lauf wurden nicht durchgeführt; der installierte Kundenstand blieb
unverändert.

#### 10.22.7 Adversariale Prüfung des verbleibenden Rangblockers: NO-GO

Zwei voneinander unabhängige Codeprüfungen haben die naheliegende Abkürzung
`mehrere vollständige INCLUDED-Atome => NICHT_VERGLEICHBAR` verworfen. Die
vorhandenen Eigenschaften `complete`, `sourceBindingValid`,
`conflictState: NONE` und unterschiedliche semantische Schlüssel beweisen nur,
dass die einzelnen Fakten intern gültig sind. Sie beweisen nicht, dass
mehrere Paketdokumente additiv nebeneinander gelten oder dass keine
nachfolgende Vereinbarung eine frühere ersetzt.

Das reale VS-19-Artefakt enthält genau die gefährlichen Gegenbeispiele:

- für Wege eine allgemeine Aufnahme ohne Betrag neben einer allgemeinen
  Aufnahme mit EUR 10.000 und Bedingungsmarkern;
- für Außenbeleuchtung eine unbedingte Aufnahme neben einer bedingten Aufnahme
  mit ansonsten gleichem Scope;
- strukturell kompatible A-B-Paare, die wegen der noch nicht typisierten
  Bedingungs-, Gefahren- oder Ersetzungsbeziehung nicht sicher als
  `NICHT_VERGLEICHBAR` abgeschlossen werden dürfen.

Der Rangblocker betrifft in der aktuell belegbaren Projektion drei Zeilen:
`VS-01`, `VS-07` und `VS-19`. Ein globaler Shortcut würde daher auch zwei
andere Anforderungen verändern. Selbst eine Beschränkung auf `ANY` würde zwar
VS-01 und VS-07 aussparen, aber die fehlende Paketbeziehung von VS-19 nicht
beweisen.

Eine spätere sichere Freigabe benötigt mindestens einen expliziten,
auditierbaren Dokumentbeziehungsvertrag wie `COEXISTING`, `ADDITIVE` oder
`NO_REPLACEMENT_APPLICABLE`, vollständig typisierte Vergleichsachsen und die
Prüfung aller A×B-Atompaarungen. Sobald ein Paar gleichwertig, vorteilhaft,
kompatibel oder weiterhin unklar ist, muss die Zeile unklar bleiben. Der
heutige Atomvertrag besitzt keinen solchen Dokumentbeziehungsnachweis.

Entscheidung für den aktuellen Loop:

```text
VS-19 bleibt UNKLAR / ATOMIC_DOCUMENT_RANK_UNRESOLVED.
Kein künstliches NICHT_VERGLEICHBAR.
Kein Vorteil ohne nachweisbare Paketbeziehung.
```

Damit sind die Such-, Objektklassifikations-, Betrags- und globale
Bedingungsfehler von VS-19 behoben. Der verbleibende Rest ist eine echte,
präzise bezeichnete Modellierungslücke und kein weiterer sicherer Kleinstfix.

### 10.21 LW-12 Schritt A – aktuelle Reproduktion der Definitionsblockade

`LW-12` wurde nach Abschluss von VS-08 auf dem aktuellen Produktprofil neu aus
allen zehn Paketdokumenten aufgebaut. Der Fall ist kein Recallfehler:

```text
Paket A: BELEGT / INCLUDED / GENERAL
Paket B: TEILBELEGT
Paket B, Quelle 1: INCLUDED / GENERAL
Paket B, Quelle 2: DEFINED / GENERAL
```

Die eingeschlossene B-Quelle versichert Bruchschäden an den Rohrleitungen einer
wasserführenden Fußbodenheizung. Die zweite B-Quelle definiert ausschließlich,
dass Fußbodenheizung beziehungsweise -kühlung ein mit Wasser oder
Frostschutzbeigabe betriebenes Rohr- und Schlauchsystem im Gebäude ist. Diese
Definition ist kein Ausschluss und widerspricht dem positiven Deckungsbeleg
nicht.

Das aktuelle Ergebnis bleibt dennoch:

```text
UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION
Blocker: COVERAGE_EFFECT_NOT_DECISIVE
betroffen: ausschließlich die B-Definition
```

Echter Ausgangsartefakt:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LW-12-BASELINE-E66B2E37-20260903
Commit: e66b2e378aeee8aa3d1f94fab1454c495d171950
Summary-Digest: 16ca5785386f338f9b4912e25906d15d69022dfae3d23fbb8efcbc90f2fd9e5e
Target-Selection-Digest: 2ea41a9d219ab73ad92e6534eac1b512d7047332cce8fb330e92d78a75b06e85
Producer-Digest: 388c1773835d7e1b86f63b496425929770b0e012a235230e3296a5175cd3089e
Triage-Qwen-Aufrufe: 1
Evidence-Qwen-Aufrufe: 1
Serverseitige Terminals: 7
```

Der erforderliche Fix darf `DEFINED` nicht global ignorieren. Er muss eng
belegen, dass innerhalb genau dieser Deckungskomponente bereits mindestens ein
vollständiger `INCLUDED`-Fakt je Paket existiert, alle übrigen Funde reine
Objektdefinitionen ohne Ausschluss-, Bedingungs- oder Aufhebungswirkung sind
und das vollständige Dokumentinventar unter demselben Suchvertrag geprüft
wurde. Gemischte positive und negative Wirkungen, enger Scope, offene
Kandidaten, unvollständige Quellenbindung oder unbekannte Definitionstypen
müssen weiterhin fail-closed bleiben.

Schritt A verändert noch kein Ergebnis. Ein voller 224-Zeilen-Lauf und ein
Deployment wurden nicht durchgeführt; der installierte Kundenstand blieb
unverändert.

#### 10.21.2 Forward-Fix – reine Objektdefinition vor dem Paket-Rollup terminal ausscheiden

Die erste Arbeitshypothese aus Schritt A sah eine LW-12-Sonderregel im
Vergleich vor. Die anschließende Prüfung des vollständigen Datenflusses hat
diese Lösung verworfen: Der Vergleich war korrekt blockiert, weil die
Dokumentanalyse die reine Objektdefinition als zweiten `DEFINED`-Deckungsfakt
materialisierte. Eine Vergleichsausnahme hätte diese falsche Rolle nur später
verdeckt und einen unnötigen zeilenspezifischen Vergleichspfad geschaffen.

Der umgesetzte Fix sitzt deshalb an der vorhandenen serverautoritativen
Terminalgrenze. Er ist ausschließlich für
`LW:LW-12:underfloor_heating / INSURED_OBJECT / COVERAGE_ONLY` zertifiziert.
Eine Fundstelle wird nur dann als Nicht-Deckungsfund ausgesondert, wenn alle
folgenden Bedingungen gleichzeitig bewiesen sind:

```text
Objektklassifikationsvertrag:
  CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1
Klassifikation:
  OBJECT / MEMBER_OF_CLASS
Quelle:
  CURRENT_PAGE_OBJECT_CLASSIFICATION
Kontext:
  LIST_ITEM, gleiche physische Seite, exakte Candidate-/Kontext-Offsets
Scope:
  keine Section-, Page- oder Coverage-Governors; leerer Scope-Lead
Inhalt:
  keine positive/negative Deckung, Bedingung, Option, Pflicht,
  Wert-/Limitangabe oder Aufhebungswirkung
```

`EXCLUDED_FROM_CLASS`, geerbte Klassifikationen von einer vorigen Seite,
`Versicherte Sachen, das sind`, echte Einschluss- oder Ausschlussklauseln,
Gefahrerhöhungs-/Meldepflichttexte, Bedingungen, Optionen, Limits,
Selbstbehalte und Overrides bleiben ausdrücklich nichtterminal. Andere
Requirements, Rollen oder Absenzbedeutungen sind nicht freigeschaltet.

Der neue Occurrence-Provenienzvertrag
`TERMINAL_OCCURRENCE_PROVENANCE_V4_OBJECT_CLASSIFICATION` bindet zusätzlich
den vollständigen Objektklassifikations- und Coverage-Governor. Eine Änderung
an Contract-ID, Membership, Seite, Offsets, Klassifikation oder
Coverage-Governor verändert damit den Hash. Die bestehenden V3-Digests und
Terminalverträge bleiben byteinhaltlich kompatibel.

Commits:

```text
9fe9506b fix(analysis): reject LW-12 object-only definitions
ec9135e2 style(analysis): format LW-12 terminal contract
```

Mac-Studio-Validierung des exakten Commits:

```text
Commit: ec9135e27bee413a6a91f37910b2cd94f5b9736f
Worktree: /private/tmp/pv3-validate-ec9135e2
Formatprüfung: PASS
Fokussierte Suites: 6/6 PASS
Fokussierte Tests: 233/233 PASS
Breite Regression: 45 Suites und 931 Tests PASS
```

Die vier bereits vorher protokollierten historischen Fixture-Suites besitzen
unverändert dieselben 25 Fehler: drei Manifests erwarten die alte
Katalogbindung, eine statische Verteilung erwartet weiterhin
`25 COVERAGE_MIXED / 91 COVERAGE_ONLY` statt `24 / 92`. Es entstand keine neue
Fehlersignatur.

Echter gezielter Zehn-Dokument-Lauf:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LW-12-OBJECT-EC9135E2-20260903
Summary-Digest:
46b2cfae7af7a88b27b22c7eec90e574fb98e5373452109c8037746e7729fc42
Target-Selection-Digest:
2ea41a9d219ab73ad92e6534eac1b512d7047332cce8fb330e92d78a75b06e85
Producer-Digest:
388c1773835d7e1b86f63b496425929770b0e012a235230e3296a5175cd3089e
Dokumente: 10
Triage-Qwen-Aufrufe: 1
Evidence-Qwen-Aufrufe: 1
Serverseitige Terminals: 8
```

Das gespeicherte DOC-10-Audit bindet genau einen verworfenen Kandidaten mit
V4-Occurrence-Digest und V3-Rejection-Set-Digest. Der echte B-Einschluss aus
DOC-09 Seite 3 bleibt unverändert erhalten. Das revisionssicher belegte Delta
ist:

```text
Vorher:
A BELEGT / B TEILBELEGT
UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review ja

Nachher:
A BELEGT / B BELEGT
GLEICHWERTIG / ALL_ATOMIC_DIMENSIONS_EQUIVALENT / Review nein
Regel: ATOMIC_COVERAGE_EQUALITY_V1
```

Der Fix behauptet für die reine Definition weder Einschluss noch Ausschluss.
Er entfernt nur ihre falsche Verwendung als operativen Deckungsfakt; das
Kundenergebnis stammt anschließend aus den zwei echten Einschlussbelegen.

R69-A steht damit bei `2/40` abgeschlossenen Kandidaten; `38` bleiben offen.
Unter Einbeziehung aller akzeptierten gezielten Deltas ändert sich die noch
nicht durch einen neuen 224-Zeilen-Vollrun bestätigte Projektion von
`Gleichwertig 118 / Unklar 59` auf `Gleichwertig 119 / Unklar 58`. Vorteil A,
Vorteil B, Dokumentationsunterschied und Nicht vergleichbar bleiben in dieser
Projektion unverändert.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

### 10.20 VS-08 Schritt A – fehlende 25-Prozent-Bedingung wiederfinden

#### 10.20.1 Reproduzierter Ausgangsfehler

Der unveränderte Zielproducer auf Commit `0dd2a7ae` lieferte für `VS-08`
beidseitig `BELEGT`, aber noch:

```text
UNKLAR / NO_APPROVED_RULE_FOR_ALL_DIMENSIONS / Review erforderlich
```

Die Quellprüfung zeigte zusätzlich einen echten Recallfehler: In einem
Zusatzvertrag von Paket B steht ein weiterer Unterversicherungsverzicht bis zu
einer Abweichung von 25 Prozent zwischen Versicherungs- beziehungsweise
Höchsthaftungssumme und Versicherungswert. Die bestehende VS-08-Suche fand
diese Klausel nicht, obwohl dieselbe Quelle im benachbarten VS-07-Kontext
bereits sichtbar war. Vor jeder Vergleichsentscheidung musste daher zuerst
das Komponenten-Inventar vervollständigt werden.

#### 10.20.2 Enger semantischer Recallvertrag

Der VS-Katalog `v0.10` ergänzt für die bestehende Komponente
`underinsurance_waiver_condition` den Konzeptvertrag
`underinsurance-waiver-deviation-condition`. Ein Treffer verlangt innerhalb
derselben kontrollierten Einheit gemeinsam:

```text
Verzicht + Unterversicherung +
(Versicherungssumme oder Höchsthaftungssumme) +
Versicherungswert + Abweichung
```

Nur eine tatsächlich wirkende Verzichtsklausel darf direkt an die Komponente
gebunden werden. Negierter oder lediglich optional angebotener Verzicht bleibt
`MENTION_ONLY`. Die Feldextraktion materialisiert die gefundene Klausel als
bedingte Regel. Es gibt keine Versicherer-, Seiten- oder Dokumentnamenregel.

Commits:

```text
c7768f0b fix(analysis): recall VS-08 deviation conditions
99d27b3b style(analysis): format VS-08 recall fixtures
2f81371c test(analysis): align VS-08 recall expectations
af25c12f style(qa): format VS-08 registry fixture
```

Die letzten beiden Commits ändern ausschließlich Testannahmen und Format. Der
Occurrence-Kontext fällt ohne erkannte Klauselüberschrift korrekt auf den
vollständigen `PARAGRAPH` zurück; der Katalogmigrationstest vergleicht nur den
historischen Ausgangsstand `v0.7` mit dem aktuellen Stand `v0.10`.

#### 10.20.3 Mac-Studio-Validierung und echter Paketbefund

```text
Commit: af25c12f1fa8bb5c2aa1bc63c48e338d6012b302
Worktree: /private/tmp/pv3-validate-af25c12f
Formatprüfung: PASS
Fokussierte Suites: 10/10 PASS
Fokussierte Tests: 331/331 PASS
```

Echter Zielartefakt:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-08-RECALL-AF25C12F-20260902
Summary-Digest: 7ab0cdfc12fe0ad42a31bd6a7dc1da5dcfc8e961d25d59573ea9ba917a57a5b6
Target-Selection-Digest: 87d5eb4070d61e6fac5ca800d433edfe0554bee68a1481e2b30001d1cc3c4061
Producer-Digest: 566a9116f07827ca1c6b1bcf46d7651fe63267f4de9396901daf3e51d7db0f44
Dokumente: 10
Triage-Qwen-Aufrufe: 0
Evidence-Qwen-Aufrufe: 0
Serverseitige Terminals: 7
```

Der echte Lauf findet nun in Paket B beide einschlägigen Quellen:

1. die Ausnahmeregeln der Wertanpassungsklausel einschließlich der
   Mehrfachversicherungsbeschränkung;
2. den zusätzlichen Verzicht bei höchstens 25 Prozent Abweichung.

Damit ist Schritt A erfolgreich: Die zuvor übersehene Klausel wird mit exaktem
Text, Dokument, physischer Seite und Offsets gebunden. Das Ergebnis bleibt
absichtlich noch nicht akzeptiert:

```text
Vorher: UNKLAR / NO_APPROVED_RULE_FOR_ALL_DIMENSIONS
Nachher: UNKLAR / ATOMIC_DOCUMENT_RANK_UNRESOLVED
```

Der neue Reason Code war diagnostisch präziser, aber noch keine korrekte
fachliche Endentscheidung. Paket B enthält zwei Quellen derselben Komponente.
Für die konkrete VS-08-Frage ist deren Rang jedoch entscheidungsinvariant:
Mit oder ohne die zusätzliche Quelle bleibt der Verzicht in Paket B bedingt.
Die Unterschiede der Voraussetzungen gehören in die getrennte Zeile `VS-09`.
Eine Auswahl oder Löschung einer der beiden Quellen ist weder nötig noch
zulässig.

Als Katalogregression wurde `VS-15` unter `v0.10` erneut vollständig auf den
zehn Paketdokumenten ausgeführt:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-15-V010-AF25C12F-20260903
Summary-Digest: 5bfefdd5fbd1a425ebddfa0fa797f66826597e57d6952bea1c53d385178eebe8
Target-Selection-Digest: c13008279873ba564bde8a9f4cd969d90594db233032cb5b8e34a604f938e918
Producer-Digest: 6ace38a2a92014a9763051ee26ab9b680189d7b8d23fb56928359983a0df5f14
Ergebnis: GLEICHWERTIG
Review erforderlich: nein
Triage-/Evidence-Qwen-Aufrufe: 0/0
```

Die bereits akzeptierte VS-15-Entscheidung bleibt damit unter dem neuen
Katalog unverändert.

#### 10.20.4 Paketweiter Konsensvertrag und finale Entscheidung

Der zweite Fix führt keine globale Deduplizierung von CONDITION-Atomen und
keine Dokumentrangannahme ein. Er ist ausschließlich an folgende endliche
Klassifikationsdimension gebunden:

```text
Kategorie: VS-08
Katalog: vs-occurrence-full-draft-v0.10
Komponente: underinsurance_waiver_condition
Rolle: CONDITION
Feld: condition
zulässiger Konsenswert: bedingt
```

Der Vertrag verlangt auf beiden Seiten das vollständige Dokumentmanifest,
genau eine Suchzelle und ein Rohatom pro Dokument, vollständige Seitenprüfung,
denselben Requirement-Digest, GENERAL-Scope, konfliktfreie und direkt
quellengebundene Funde sowie kontrollierte Nullzustände für alle übrigen
Dokumente. Alle gefundenen Quellen bleiben einzeln im Audit erhalten. Sobald
eine Quelle `unbedingt`, negiert, optional, unvollständig, scopefremd oder
konfliktbehaftet ist, greift die Regel nicht und der bisherige Fail-closed-Weg
bleibt erhalten.

Die konkreten Bedingungen werden weder zusammengeführt noch als identisch
behauptet. Der Konsens besagt nur: Alle für VS-08 gefundenen Quellen ordnen den
Verzicht als bedingt ein. Angebot, Hauptpolizze und Zusatzvertrag dürfen dabei
gemeinsam beitragen, ohne dass eine nicht bewiesene Ersetzungsrangfolge
erfunden wird.

Commits:

```text
3d54b942 fix(comparison): resolve VS-08 condition consensus
56eaa1b8 style(comparison): format VS-08 consensus contract
ab92171b fix(comparison): accept audited VS-08 null fields
bc4daa07 fix(comparison): validate VS-08 consensus audits
106804e0 style(comparison): format VS-08 audit validation
```

Der kleine Forward-Fix `ab92171b` beruht auf einer realen Artefaktabweichung:
Ein vollständig kontrollierter Nullfund besitzt im materialisierten Atom den
Feldstatus `NOT_FOUND`, nicht `INCOMPLETE`. Die Änderung lockert keine
Fundentscheidung; alle Terminal- und Vollständigkeitsgates bleiben zwingend.

Finale Mac-Studio-Validierung:

```text
Commit: 106804e0a03b4ec4170d068c66a8a773d9ee6935
Worktree: /private/tmp/pv3-validate-106804e0
Produktprofil: CUSTOMER_CORE_5_V32_VS08_CONDITION_CONSENSUS
Formatprüfung: PASS
Fokussierte Suites: 11/11 PASS
Fokussierte Tests: 344/344 PASS
```

Die Tests enthalten insbesondere Gegenbelege für alten Contract-Digest,
fehlendes Dokumentinventar, offene Kandidaten, `bedingt` gegen `unbedingt`,
negierte Quelle, gemischte Wirkung, unvollständige Seitenaudits sowie
Manipulation eines gespeicherten Audits.

Finaler echter Zielartefakt:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-08-FINAL-106804E0-20260903
Summary-Digest: 669553d3a0e3718eb40e66cf44ecdf7e0c39ed7be569058231fe8f2972a3999c
Target-Selection-Digest: 87d5eb4070d61e6fac5ca800d433edfe0554bee68a1481e2b30001d1cc3c4061
Producer-Digest: 9e56c6d596985836c0feb0b24e889201d3076e04b1e850eac9f61752abd26984
Assessment-Digest: 48f143a7ad2650986e752c4366ae14aae98e9f2177942b56077f398cf3a4a6c8
Dokumente: 10
Paket A: 1 bedingter Fund
Paket B: 2 bedingte Funde, 7 kontrollierte Null-Suchzellen
Triage-Qwen-Aufrufe: 0
Evidence-Qwen-Aufrufe: 0
Serverseitige Terminals: 7
Ergebnis: GLEICHWERTIG
Review erforderlich: nein
```

Der unabhängige Replay rekonstruierte Audit und Entscheidung aus dem
Dokumentmanifest und den gespeicherten Rohatomen identisch. Ein absichtlich
veränderter `foundAtomCount` wurde mit
`VS08_CONDITION_CONSENSUS_AUDIT_MISMATCH` abgelehnt.

Finale VS-15-Regression auf demselben Commit:

```text
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-15-V010-106804E0-20260903
Summary-Digest: 17a1fa7f7f7e80c5cef4d3b290693b7c52f81b6ae25ea56ba19955a1d48ccd51
Ergebnis: GLEICHWERTIG
Review erforderlich: nein
Triage-/Evidence-Qwen-Aufrufe: 0/0
```

Damit ist `VS-08` abgeschlossen. Die fortgeschriebene, noch nicht durch einen
neuen 224-Zeilen-Vollvergleich bestätigte Projektion ändert sich ausschließlich
von `Gleichwertig 117 / Unklar 60` auf `Gleichwertig 118 / Unklar 59`.
Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.

### 10.19 VS-15 – allgemeiner Nebengebäudeschutz und fehlende namentliche Anführung

#### 10.19.1 Reale Ursache

`VS-15` war kein Recallfehler. Die kontrollierte Primärsuche erzeugte für alle
zehn Dokumente und beide Komponenten vollständige Atome:

```text
Komponente outbuilding_cover:
  Polizze A: 1 belegter Einschluss, Limit 5 % der Gebäudeversicherungssumme
  Polizze B: 1 belegter Einschluss, Limit EUR 1.530.400

Komponente named_outbuilding_designation:
  Polizze A: 1/1 vollständiger kontrollierter Nichtfund
  Polizze B: 9/9 vollständige kontrollierte Nichtfunde
```

Der Katalog verlangt beide Komponenten mit `componentSatisfactionPolicy=ALL`.
Deshalb blieben beide Pakete trotz belegtem allgemeinem Nebengebäudeschutz auf
`TEILBELEGT`. Der generische Paket-Gate erzeugte genau zwei Blocker, je einen
`MISSING_REQUIRED_COMPONENT` für die namentliche Anführung, und fiel danach
korrekt auf `PACKAGE_REVIEW_STATUS_BLOCKS_DECISION` zurück.

Die fachlich enge Auflösung lautet ausschließlich: Für die abgefragte
namentliche Anführung besitzen beide Pakete dieselbe vollständig kontrollierte
Fundlage. Der Nichtfund wird weder als ausdrücklicher Ausschluss noch als
Beweis identischer allgemeiner Nebengebäudedeckung bezeichnet. Insbesondere
werden die verschiedenen Limits `5 %` und `EUR 1.530.400` nicht gleichgesetzt.

#### 10.19.2 Versionierter Vertrag und betroffene Abhängigkeiten

Der neue Vertrag ist gebunden an:

```text
Kategorie: VS-15
Katalog: vs-occurrence-full-draft-v0.9
Komponentenvertrag-Digest:
3618160e324ac0eac1d3d8805cd6206b0cdacb2f2f9b2370457a620bbc1cc51c
Komponenten: outbuilding_cover / INSURED_OBJECT
              named_outbuilding_designation / DEFINITION
Komponentenpolitik: ALL
Aggregationspolitik: ALL_COMPONENT_EFFECTS
Negativsuche: REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1
Absenzbedeutung: COVERAGE_MIXED
```

Der Audit bindet für beide Seiten das vollständige Dokumentmanifest mit UUID
und PDF-SHA, alle Suchzellen, Seitenzahlen, Suchplan-IDs, Aliase, Gates,
Requirement-Vertrag, Atome, Quellen, Kandidaten und abgeleiteten Digests. Er
fordert mindestens einen vollständigen, quellengebundenen allgemeinen
Nebengebäude-Einschluss je Seite und einen terminalen kontrollierten Nichtfund
der Namenskomponente in jedem Paketdokument. Konflikte, offene Kandidaten,
enger Scope, Ausschlüsse, ein tatsächlicher Namensfund, Dokumentlücken oder
Vertragsdrift führen fail-closed zurück in den bestehenden Reviewpfad.

Betroffene Produktionsgrenzen:

```text
server/utils/policyComparison/vs15NamedOutbuildingQualifierAbsenceContract.js
server/utils/policyComparison/pointDecision.js
server/utils/policyComparison/resultBuilder.js
server/utils/policyComparison/customerMetricContract.js
server/utils/policyComparison/customerResultPresenter.js
server/utils/policyComparison/productContract.js
```

Die Hookposition liegt ausschließlich innerhalb des bereits blockierten
Package-Review-Zweigs: nach Erzeugung des Paket-Audits und vor dem generischen
Fail-closed-Ergebnis. Andere Kategorien, andere VS-15-Blocker und alle bereits
entscheidbaren Zeilen werden dadurch nicht umgangen.

Das Kundenprofil wurde auf folgende gemeinsame Vertragsidentität angehoben:

```text
CUSTOMER_CORE_5_V30_VS15_QUALIFIER_ABSENCE
PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_LW20_EQUALITY_FIRE_DEFINITION_VS15_QUALIFIER_V4
```

#### 10.19.3 Forward-Fix-Verlauf und Kontrollbefunde

```text
d3e1ad66 feat(comparison): add VS-15 qualifier absence contract
92609d07 style(comparison): format VS-15 absence contract
5301f23b test(comparison): expect VS-15 audit mismatch
6e430f49 fix(comparison): resolve VS-15 qualifier absence
62479afb style(comparison): format VS-15 integration test
9fc6ef43 fix(product): validate VS-15 qualifier equality
3a577aa8 style(test): format VS-15 customer validation
f0b0cd33 fix(comparison): bind VS-15 to current catalog
cd1d8740 test(comparison): derive VS-15 worksheet digest
0dd2a7ae fix(comparison): bind VS-15 aggregation policy
```

Der erste echte Lauf auf `3a577aa8` blieb bewusst `UNKLAR`. Er legte zwei
Fixture-Lücken offen:

1. Der Vertrag war auf den vollständigen Katalog-Suchvertragsdigest `e41f…`
   statt auf den tatsächlich in Vergleichsatomen persistierten, aus dem
   normalisierten Worksheet abgeleiteten Komponentenvertragsdigest `3618…`
   gebunden.
2. Die Fixture modellierte `coverageAggregationPolicy=null`; reale Atome
   tragen explizit `ALL_COMPONENT_EFFECTS`.

Beide Abweichungen wurden in getrennten Commits korrigiert. Der Digest bleibt
statisch gepinnt, damit eine spätere Katalogänderung nicht still akzeptiert
wird. Die Fixture leitet ihren Kontrollwert jetzt über denselben
Worksheet-Pfad wie die Produktion ab. `null` oder eine andere
Aggregationspolitik wird adversarial abgelehnt.

Finale Mac-Studio-Regression:

```text
Commit: 0dd2a7ae48a3090cbc5341c06cca6f6421e32476
Worktree: /private/tmp/pv3-validate-0dd2a7ae
Formatprüfung: PASS
Suites: 6/6 PASS
Tests: 180/180 PASS
```

Geprüft wurden der spezialisierte Vertrag, `pointDecision`, `resultBuilder`,
Kundenmetrik, Kundendarstellung und Produktprofil. Die Manipulationstests
umfassen unter anderem Digestdrift, Manifestfehler, fehlende Dokumente,
unvollständige Suche, Aliasdrift, Aggregationsdrift, Narrow-Scope, Ausschluss,
offene Kandidaten, Quellenmismatch und gespeicherte Auditmanipulation.

#### 10.19.4 Echter Zehn-Dokument-Lauf

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-15-0DD2A7AE-20260902
Summary-Digest:
372bb413f87eb3a2cf018006372d25577f099c900a63fe64497cda6d3b88a9a3
Target-Selection-Digest:
823d19540ad77ac35a5b13b73dc80bf41c27061ebb0b077517533e304feab78d
Producer-Script-Digest:
4d5f95c243dedd655e7bb177103ef894c746869b0dc8f150095ef259dab31b8b
Dokumente: 10 (A: 1, B: 9)
Atome: 20
Physische Seiten: 108
Triage-Qwen-Aufrufe: 0
Evidence-Qwen-Aufrufe: 0
Serverseitige Evidenzterminals: 18
Wandzeit: 6 Sekunden
```

Revisionssicheres Zieldelta:

```text
Vorher:
UNKLAR / PACKAGE_REVIEW_STATUS_BLOCKS_DECISION / Review erforderlich

Nachher:
GLEICHWERTIG
EQUAL_VS15_CONTROLLED_NAMED_OUTBUILDING_QUALIFIER_ABSENCE_BOTH
Review erforderlich: nein
```

Unter Einbeziehung aller zuvor akzeptierten gezielten Deltas lautet die noch
nicht durch einen neuen 224-Zeilen-Vollrun bestätigte Projektion:

```text
VORTEIL_A 2, VORTEIL_B 3, DOKUMENTATIONSUNTERSCHIED 33,
GLEICHWERTIG 117, NICHT_VERGLEICHBAR 9, UNKLAR 60.
```

Ein Deployment und ein 224-Zeilen-Vollrun wurden nicht durchgeführt. Der
installierte Kundenstand blieb unverändert.

### 10.18 FE-A01 – breitere Branddefinition

#### 10.18.1 Ausgangsfehler und fachliche Ordnung

`FE-A01` war trotz beidseitig vollständig belegter Branddefinition
`UNKLAR / NO_APPROVED_RULE_FOR_ALL_DIMENSIONS`. Recall, Triage,
Dokumentgeltung und Quellenbindung waren nicht defekt. Es fehlte ausschließlich
eine freigegebene Regel für zwei unterschiedliche Definitionen:

```text
A, DOC-01, physische Seite 7:
Brand ist ein Feuer, das sich bestimmungswidrig ausbreitet.

B, DOC-06, physische Seite 2:
Brand ist ein Feuer, das bestimmungswidrig entsteht und/oder sich
bestimmungswidrig ausbreitet (Schadenfeuer).
```

Der B-Begriff ist eine echte Obermenge: Er akzeptiert bestimmungswidriges
Entstehen oder bestimmungswidrige Ausbreitung. A nennt nur die Ausbreitung.
Das ist ein fachlich begründeter Vorteil und kein Schluss aus einer fehlenden
Fundstelle.

#### 10.18.2 Vergleichsvertrag und Schutzgrenzen

Der neue Vertrag
`FE_A01_FIRE_DEFINITION_SCOPE_COMPARISON_V1` greift ausschließlich bei:

- Requirement `FE-A01`, Komponente `fire_definition`, Rolle `DEFINITION`;
- vollständig gefundenem, konfliktfreiem und quellengebundenem Atom;
- Wirkung `DEFINED`, allgemeinem Scope und identischem Requirement-Vertrag;
- keinem Requested Field oder Optionalfeld;
- exakt einer der zwei bekannten Klauselgrammatiken `SPREAD_ONLY` oder
  `ARISE_OR_SPREAD` in allen beitragenden Quellen.

Die zweite Form gewinnt gegen die erste; zwei identische bekannte Formen sind
gleichwertig. Negation, Ausschluss, Optionalität, reine UND-Verknüpfung,
unbekannte Definition, falsche Rolle/Komponente, Narrow Scope, ungelöste oder
widersprüchliche Quellen bleiben fail-closed. Ein kleiner Audit speichert die
beiden erkannten Definitionsmodi und die Gewinnerseite in der Dimension.

Betroffene Produktionsgrenzen:

```text
server/utils/policyComparison/fireDefinitionComparisonContract.js
server/utils/policyComparison/pointDecision.js
server/utils/policyComparison/customerResultPresenter.js
server/utils/policyComparison/productContract.js
server/utils/policyComparison/resultBuilder.js
```

Das Produktprofil lautet danach:

```text
CUSTOMER_CORE_5_V29_FE_A01_FIRE_DEFINITION
PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_LW20_EQUALITY_FIRE_DEFINITION_V3
```

#### 10.18.3 Commits und Mac-Studio-Prüfung

```text
d8642aeb Add FE-A01 fire definition comparator
d6a3b113 style(comparison): format fire definition tests
005274c4 fix(comparison): order FE-A01 fire definitions
80bc8f13 fix(product): expose FE-A01 definition comparison
4666b84b style(comparison): format FE-A01 integration
```

Der erste Mac-Lauf stoppte vor den Tests an der Formatprüfung der neuen
Testdatei. Der zweite Integrationslauf stoppte ebenfalls vor den Tests an zwei
Formatstellen. Beide wurden als reine Forward-Fix-Commits erhalten.

Finale Commitprüfung:

```text
Commit: 4666b84bcc1be870cfbd72d2e7eb23bbcb37de02
Worktree: /private/tmp/pv3-validate-4666b84b
Node: 22.23.2
Formatprüfung: PASS
Fokussierte Suites: 5/5 PASS
Fokussierte Tests: 145/145 PASS
```

#### 10.18.4 Echter Zehn-Dokument-Zielrun

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/FE-A01-4666B84B-20260902-R2
Summary-SHA-256:
e1afe81c24f1c8f62c61ed7d62bddc8018f64932c0dbd4e2cdee6d02e3433c58
Target-Selection-Digest:
988f5d9bfe51e26c177ede936f64f81bb0a8c68817fd1562e5a7a859d708a680
Producer-SHA-256:
459e0811dfe8de10d288904843c49e88c6ea5bb5b8d1c84bb150fa68e67af98d
Dokumente: 10
Triage-Qwen-Aufrufe: 0
Evidence-Qwen-Aufrufe: 0
Serverseitig terminal entschiedene Komponenten: 8
Paket A: Ja / BELEGT
Paket B: Ja / BELEGT
Punktentscheidung: VORTEIL_B
Regel: FE_A01_FIRE_DEFINITION_SCOPE_COMPARISON_V1
Kundenreview: nein
```

Die erste Producer-Ausführung wurde nach dem ersten Dokument durch den noch
von VS-35 übernommenen QA-Guard `atoms.length === 2` abgebrochen. FE-A01 hat
vertragsgemäß genau ein Atom; die korrigierte, gehashte R2-Probe verlangt
exakt ein Atom. Das war ein Fehler im temporären QA-Producer, nicht in der
Produktlogik und kein teilweise akzeptierter Vergleichslauf.

Das belegte Delta ist:

```text
FE-A01 vorher: UNKLAR / Review
FE-A01 nachher: VORTEIL_B / kein Review
```

Unter Einbeziehung der zuvor akzeptierten gezielten Deltas lautet die noch
nicht durch einen neuen 224-Zeilen-Vollrun bestätigte Projektion:

```text
VORTEIL_A 2, VORTEIL_B 3, DOKUMENTATIONSUNTERSCHIED 33,
GLEICHWERTIG 116, NICHT_VERGLEICHBAR 9, UNKLAR 61.
Kundenreview: 61; ohne Kundenreview: 163.
```

Ein vollständiger 224-Zeilen-Lauf und ein Deployment wurden nicht
durchgeführt; der installierte Kundenstand blieb unverändert.

### 10.17 VS-35 – Wiederherstellungsklausel und Wiederaufbaufrist

#### 10.17.1 Ausgangsfehler und Ursachenbaum

`VS-35` war in der Ausgangsbewertung `UNKLAR`. Die Diagnose trennte vier
unabhängige Ursachen, die nicht mit einer einzelnen zusätzlichen Aliaszeile
behoben werden konnten:

1. einzelne reale Klauselformen waren im kontrollierten Recall-Vertrag nicht
   enthalten;
2. lokal zusammengehörige Klauselteile wurden nicht immer als maßgebliche
   Bedingung an die VS-35-Komponenten gebunden;
3. der Requested-Field-Deduplizierer entfernte einen geteilten Fristfakt aus
   der zweiten Pflichtkomponente, weil sein Schlüssel die Komponenten-ID nicht
   enthielt;
4. nach vollständiger Evidenzbindung fehlte weiterhin eine Fachregel, die die
   unterschiedlichen Bedingungsbündel sicher zu einem Gesamtsieger ordnen
   könnte.

Direkt betroffene Produktionsgrenzen:

```text
server/resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json
server/utils/policyAnalysis/deterministicVsEvidenceRules.js
server/utils/policyAnalysis/requestedFieldEvidenceContract.js
server/utils/policyComparison/productContract.js
server/utils/policyComparison/pointDecision.js
```

Die produktive Regel blieb allgemein semantisch: Sie bindet
Wiederherstellungszweck, gesicherte Entschädigungsverwendung, Frist,
Deckungsprozess, Wiederherstellungsort, Entschädigungsobergrenze und
Vorzustandsdefinitionen. Weder Versicherername, konkrete Seite noch
Kunden-Dokument-UUID entscheiden über den Treffer.

#### 10.17.2 Kleine Forward-Fix-Commits

```text
701c38bb fix(policy): add versioned VS-35 clause recall
0e1e657d fix(analysis): bind local VS-35 clauses
0c9f495d test(analysis): guard VS-35 local clause binding
12f7e360 fix(qa): harden VS-35 negation and history
d503a041 fix(analysis): extract VS-35 condition axes
111cb8b3 style(analysis): format VS-35 field test
6855cfde fix(analysis): retain VS-35 facts per component
8c0750ad style(analysis): format VS-35 deduplication test
e2ee0355 fix(policy): add VS-35 axis recall
7e381559 fix(analysis): bind VS-35 comparison axes
d6878b6e fix(analysis): extract VS-35 symmetric axes
61406484 fix(analysis): extract remaining VS-35 scope axes
```

Die letzte Ergänzung materialisiert zwei zuvor nur im Rohtext sichtbare
Achsen source-bound:

- Entschädigungsobergrenze: Betrag eines Wiederaufbaus am bisherigen Ort und
  im gleichen Umfang;
- Vorzustandsdefinition: bei A gebäudespezifisch `in Bau / bereits
errichtet`, bei B sachbezogen `vorhanden / bestellt / in Herstellung` und
  zusätzlich für Wiederbeschaffung.

Die beiden Vorzustandsformen werden absichtlich nicht zu demselben
Normalwert verschmolzen. Ihr jeweiliger Gegenstands- und Wirkungsscope bleibt
sichtbar, damit eine spätere Vergleichsregel keinen falschen Vorteil erzeugt.

#### 10.17.3 Mac-Studio-Prüfungen

Alle Ausführungen liefen im isolierten Mac-Studio-Worktree; der installierte
Kundencheckout wurde nicht verändert.

Letzte Commitprüfung:

```text
Commit: 61406484bc40207731ea76357b94be2fc771d887
Worktree: /private/tmp/pv3-validate-61406484
Node: 22.23.2
Formatprüfung: PASS
Fokussierte Suites: 3/3 PASS
Fokussierte Tests: 141/141 PASS
Modell-/Embedding-Aufrufe: keine
```

Echte gebundene Zehn-Dokument-Zielprobe:

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-35-61406484-20260902
Commit: 61406484bc40207731ea76357b94be2fc771d887
Produktprofil: CUSTOMER_CORE_5_V28_VS35_AXIS_RECALL
Katalog: vs-occurrence-full-draft-v0.9
Summary-SHA-256:
059f3c4d43023a51abbea224d007f785ad0f37bcf301f0057cdb403ff334cd80
Target-Selection-Digest:
7d2ec786cf7f6f793b8a1966ae6b16f2521f75b535553e52c2b3a5b83ce39db8
Triage-Qwen-Aufrufe: 0
Evidence-Qwen-Aufrufe: 0
Serverseitig terminal entschiedene Komponenten: 16
Paket A: Ja / BELEGT
Paket B: Ja / BELEGT
Punktentscheidung: NICHT_VERGLEICHBAR / COMPARABILITY_GATE_FAILED
Kundenreview: nein
```

Gegenüber dem Ausgangsfall ist die Zeile damit nicht mehr unklar und fordert
kein Kundenreview. Die konservative Projektion für den späteren Vollrun sinkt
von `Unklar 63` auf `Unklar 62` und steigt von `Nicht vergleichbar 8` auf
`Nicht vergleichbar 9`. Das ist ausdrücklich noch keine neue 224-Zeilen-
Gesamtmetrik.

#### 10.17.4 Warum kein künstlicher Vorteil B freigeschaltet wurde

Die gebundenen Achsen ergeben kein einseitig dominierendes Gesamtpaket:

```text
Achse                              A                         B
Frist                              3 Jahre                   3 Jahre
gleicher Zweck                     belegt                    belegt
Deckungsprozess verlängert Frist   belegt                    belegt
Orts-/Umfang-Obergrenze            belegt                    belegt
Wiederherstellungsgebiet           Österreich                Europäische Union
bindender Auftrag wahrt Frist      nicht als Achse belegt    belegt
Vorzustandsdefinition              Gebäude                   Sachen; zusätzlich bestellt
Folge bei Nichterfüllung            Zeitwert                  Verkehrswert, höchstens Zeitwert
```

Die EU-Regel ist für den Gebäudewiederherstellungsort eine echte Erweiterung
gegenüber Österreich. B enthält außerdem eine günstige Fristwahrung durch
bindende Aufträge. Gleichzeitig ist Bs Vorzustandsausschluss breiter und die
Nichterfüllungsfolge kann unter dem Zeitwert liegen. Diese gegenläufigen
Bedingungen dürfen weder ignoriert noch durch bloßes Zählen der günstigen
Achsen kompensiert werden.

Ein eigener Dominanzvertrag wurde deshalb nach Quellprüfung und zwei
unabhängigen Code-/Adversarialreviews verworfen. Zulässig wäre er erst für
einen künftigen Fall, in dem Frist, Zweck, Cap, Vorzustandsdefinition,
Prozessverlängerung und Nichterfüllungsfolge semantisch gleich sind und nur
der explizite Ortsbereich `Österreich -> EU` erweitert wird. Für die aktuelle
Dokumentpaarung ist `NICHT_VERGLEICHBAR` die belegte fachliche Endentscheidung,
nicht ein verbliebener Such- oder Reviewfehler.

Ein vollständiger 224-Zeilen-Lauf und ein Deployment wurden nicht
durchgeführt.

### 10.16 LW-20 Schritt B2 – kontrollierten Nichtfund und gebundenen Default-Ausschluss gleichsetzen

#### 10.16.1 Fachliche Entscheidung und bewusst enge Grenze

Schritt B2 setzt ausschließlich folgenden nachgewiesenen Zustand gleich:

```text
eine Paketseite: vollständiger kontrollierter Nichtfund für LW-20
andere Paketseite: ausdrücklicher LW-20-Default-Ausschluss
gesamtes Paket: kein zielgebundener Aufhebungs- oder Ersatzhinweis
Ergebnis: GLEICHWERTIG / kein Review
```

Der Nichtfund wird weder technisch noch in der Kundenerklärung in einen
ausdrücklichen Ausschluss umgeschrieben. Die Vergleichsaussage lautet nur,
dass in beiden bereitgestellten Paketen keine dokumentierte Deckung für
LW-20 belegt ist. Diese Regel ist nicht global und gilt weder für andere
Kategorien noch für unvollständige Suchen, positive/bedingte Gegenbelege,
Konflikte oder ungeklärte Scopes.

Dokumentarten sind kein künstliches Zulassungsgate. Position A und Position B
bilden jeweils das vom Benutzer hochgeladene Versicherungspaket; ein Paket
kann aus Angebot, Polizze, Vertrag, Zusatzdokument oder Bedingungen bestehen.
Deshalb wurde der erste Entwurf korrigiert: Er verlangte ohne fachlichen Grund
mindestens ein `PROPOSAL`-Dokument auf der Ausschlussseite. Der finale Vertrag
verlangt stattdessen nur die beweisbare Paketzugehörigkeit und die tatsächliche
Geltung des Ausschlussatoms (`ACTIVE` oder korrektes
`CONDITIONAL/FRAMEWORK_TERMS/TERMS`).

#### 10.16.2 Verhinderter Fehlfix aus der ersten Implementierung

Der erste B2-Entwurf prüfte den Ausschlusstext aus `exactText` plus dem auf 240
Zeichen begrenzten `conditionCheckText`. Der adversariale Review und der reale
DOC-09-Targetdatensatz zeigten zwei Fehler:

1. Der reale gespeicherte Kurzkontext beginnt erst mit
   `chäden, so ferne nicht anders vereinbart` und enthält deshalb nicht den
   vollständigen Governor `Nicht versichert sind Schäden ...`.
2. Im benachbarten Listenpunkt b) steht `auch wenn`. Eine Prüfung des gesamten
   Nachbarschaftsfensters hätte diese fremde Bedingung fälschlich dem
   Zielpunkt c) zugeordnet.

Dieser Entwurf wurde vor einem produktiven Commit verworfen. Der finale Fix
vergrößert kein globales Textfenster, sondern erzeugt einen eigenen
serverseitigen Source-Audit aus den bereits validierten Rohartefakten.

#### 10.16.3 Artefaktgebundener Source-Audit

Der neue Vertrag
`LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_V1` wird nur für
`LW-20 / ground_seepage_or_retained_water / PERIL` erzeugt. Er verlangt:

- exakt einen ausgewählten Kandidaten und keine ungelösten Kandidaten;
- `FOUND / EXCLUDED / NONE / GENERAL`;
- `scopePolicy = GENERAL_REQUIRED`;
- dieselbe eindeutige Candidate-ID in Worksheet-Occurrence und vorbereitetem
  Target;
- direkte Bindung und den serverseitigen negativen Klausel-Governor;
- vollständige PDF-Extraktion und übereinstimmende Dokument-UUID/PDF-SHA;
- exakten Originaltext an Dokumentoffset und physischer Seite;
- exakten Kontext an seinen Originaloffsets;
- einen auf der Seite gebundenen Leitungswasser-Heading-Scope;
- den vollständigen Governor
  `Nicht versichert sind Schäden, sofern/so ferne nicht anders vereinbart`;
- den eigenen Listenpunkt c), in dem der ausgewählte Grundwasser-,
  Sickerwasser- oder Stauwasserbegriff liegt;
- keine zusätzliche Bedingung und keinen positiven Override innerhalb genau
  dieses Zielpunkts.

Eine Bedingung in einem Geschwisterpunkt blockiert nicht. Eine Bedingung oder
Formulierung wie `mitversichert`, `eingeschlossen`, `nicht ausgeschlossen`
oder `abweichend ... versichert` im Zielpunkt blockiert fail-closed.

Der Audit persistiert und bindet Dokument-UUID/PDF-SHA, Artefaktdigest,
physische Seite, Seitengrenzen und Seitendigest, Candidate-ID, Exact-
Textoffsets und -digest, Kontextgrenzen und -digest, Governorgrenzen und
-digest, Listenpunktgrenzen und -digest sowie Scopegrenzen und -digest. Der
Vergleichsvalidator bindet den Dokument-SHA zusätzlich an das
Ergebnismanifest und rekonstruiert die vollständige Entscheidung. Zusätzliche
unvertragliche Felder, parallele alte Audits, doppelte Manifest-UUIDs, leere
Manifestseiten oder geänderte Source-Audits werden abgelehnt.

Betroffene Produktionsgrenzen:

```text
server/utils/policyAnalysis/lw20DefaultExclusionSourceAudit.js
server/utils/policyComparison/lw20AbsenceDefaultExclusionEqualityContract.js
server/utils/policyComparison/pointDecision.js
server/utils/policyComparison/customerMetricContract.js
server/utils/policyComparison/customerResultPresenter.js
server/utils/policyComparison/resultBuilder.js
server/utils/policyComparison/productContract.js
```

Produktprofil und Vergleichsvertrag:

```text
CUSTOMER_CORE_5_V26_LW20_DEFAULT_EXCLUSION_EQUALITY
PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_LW20_EQUALITY_V2
```

#### 10.16.4 Commits und Mac-Studio-Regression

```text
3b367d56 fix(comparison): certify LW-20 default exclusion equality
17837d99 test(comparison): cover LW-20 exclusion equality guards
5088baed test(comparison): bind LW-20 fixture scope
0fd2fde2 test(comparison): update LW-20 terminal expectation
73df258d style(comparison): format LW-20 equality contract
54aeffce fix(comparison): scope LW-20 manifest validation
```

Der erste fokussierte Mac-Lauf entdeckte eine fehlende Scope-Angabe in der
synthetischen Integrationsfixture. Der erste breite Lauf entdeckte anschließend
eine zu globale Manifestvalidierung in einer bestehenden Schema-11-
Hilfsansicht. Beide Befunde wurden mit getrennten Forward-Fix-Commits behoben;
Produktlogik wurde nicht zurückgebaut.

Finale Validierung:

```text
Commit: 54aeffce9d24f4cfe36757e2d2a87162244de3f2
Worktree: /private/tmp/pv3-validate-54aeffce
Formatprüfung: PASS
Fokussierte Suites: 4/4 PASS
Fokussierte Tests: 115/115 PASS
Breite Regression: 47 Suites und 902 Tests PASS
```

Die exakt gleichen vier historischen Fixture-Suites mit 25 Tests bleiben rot:

- drei Target-QA-/Worksheet-Manifests erwarten die alte FE-Katalogbindung;
- eine statische Bedeutungsverteilung erwartet weiterhin
  `25 COVERAGE_MIXED / 91 COVERAGE_ONLY` statt `24 / 92`.

Es entstand keine neue breite Fehlersignatur.

#### 10.16.5 Echter Zehn-Dokument-Lauf und unabhängiger Rohartefakt-Replay

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LW-20-B2-54AEFFCE-20260902
Summary-Digest:
f8f58f20e1e4e800add3f976d02a07af3b32b3c44e658a0d26f996438e1cb73d
Target-Selection-Digest:
aca3828b4d208c20b8f932311e4ec13011f006bb636e58575fa88d2c9507c718
Dokumente: 10
Neu aufgebaute Atome im Replay: 10
Gebundene Default-Ausschluss-Source-Audits: 1
Source-Audit-Dokument: DOC-09
Triage-Qwen-Aufrufe: 0
Evidence-Qwen-Aufrufe: 0
```

Der getrennte Replay las erneut die zehn unveränderten PDF-Textartefakte,
Worksheets, Triage-, Evidence- und Targetartefakte. Er prüfte alle gespeicherten
Dateihashes und technischen Gates, erzeugte die Requested-Field-Ergebnisse,
Tabellenzeilen und Atome erneut und verglich sie byteinhaltlich mit den
gespeicherten Records. Danach rekonstruierte er beide Pakete und die
Punktentscheidung und validierte den B2-Audit gegen alle Dokument-UUIDs und
PDF-SHAs des Eingabemanifests.

Das revisionssicher belegte B2-Delta ist:

```text
LW-20 Schritt A/B1:
DOKUMENTATIONSUNTERSCHIED / QUALIFIED_SEARCH_DOCUMENTATION_DIFFERENCE

LW-20 Schritt B2:
GLEICHWERTIG
EQUAL_LW20_QUALIFIED_ABSENCE_UNOVERRIDDEN_DEFAULT_EXCLUSION
Review erforderlich: nein
```

Unter Einbeziehung aller bisher akzeptierten gezielten Deltas verschiebt B2
die weiterhin unbestätigte Projektion von
`Dokumentationsunterschied 34 / Gleichwertig 115 / Unklar 63` auf
`Dokumentationsunterschied 33 / Gleichwertig 116 / Unklar 63`. Es handelt sich
nicht um eine neue 224-Zeilen-Gesamtmetrik. Der vollständige Vergleichslauf
bleibt bis zum Abschluss der gezielten Fehlerfamilien zurückgestellt.

Ein Deployment wurde nicht durchgeführt; der installierte Kundenstand blieb
unverändert.

### 10.15 LW-20 Schritt B1 – paketweiter Audit auf Aufhebung des Default-Ausschlusses

#### 10.15.1 Warum Schritt A noch nicht für Gleichwertigkeit reichte

Der echte Fund in DOC-09 ist ein allgemeiner Ausschluss in den
Leitungswasserbedingungen:

```text
Nicht versichert sind Schäden, so ferne nicht anders vereinbart:
...
c) durch Grundwasser ...
```

Die Formulierung `so ferne nicht anders vereinbart` bedeutet, dass der
Ausschluss nur dann als Paketwirkung verwendet werden darf, wenn kein anderes
Paketdokument ihn aufhebt. Dokumenttyp, Rolle oder Rang allein beweisen das
nicht. Deshalb wurde vor der eigentlichen Vergleichsregel ein eigener
serverseitiger Volltextaudit eingeführt. Er verändert selbst weder Deckung noch
Vergleichsergebnis.

Der erste Auditvertrag V1 war absichtlich fail-closed, aber im echten Paket zu
breit. Er erzeugte 33 Review-Kandidaten:

```text
POINT_OR_ARTICLE: 21
LEITUNGSWASSER:     7
AWB:                4
DIRECT_LW20:        1
CODE:               0
```

32 Treffer waren fremde Artikel, Haftpflicht-, Kündigungs-, Hypothekar- oder
andere Leitungswasserregelungen. Der einzige direkte Grundwassertreffer lag im
bereits durch den LW-20-V3-Terminalvertrag nachgewiesenen Sturmscope. Zusätzlich
fehlten beim V1-Muster für `lit.` Wortgrenzen; dadurch konnte das Wort
`Facility` fälschlich als `lit. y` enden. Diese reale Messung widerlegt die
Verwendung allgemeiner AWB-/Artikelverweise als LW-20-Blocker.

#### 10.15.2 V2-Vertrag und Abhängigkeiten

Der produktive Audit V2 ist exakt gebunden an:

```text
Requirement: LW-20
Komponente: ground_seepage_or_retained_water
Rolle: PERIL
Absenzbedeutung im Vergleich: COVERAGE_ONLY
Audit: LW20_DEFAULT_EXCLUSION_ALIAS_FREE_OVERRIDE_AUDIT_V2
Patternvertrag: LW20_DEFAULT_EXCLUSION_ALIAS_FREE_REFERENCE_FAMILIES_V2
Produktprofil: CUSTOMER_CORE_5_V25_LW20_ALIAS_FREE_OVERRIDE_AUDIT
```

Direkte Begriffe wie Grundwasser, Sickerwasser und Stauwasser wurden aus dem
Override-Audit entfernt. Sie bleiben ausschließlich Eigentum der normalen
Occurrence-, Triage-, Scope- und Evidenzpipeline. Dadurch wird der bewiesene
Sturmscope nicht ein zweites Mal ohne Scopeverständnis bewertet.

Ein aliasfreier Override-Kandidat entsteht nur innerhalb derselben gebundenen
`PARAGRAPH`- oder `LIST_ITEM`-Einheit und nur für eine der drei Familien:

1. Leitungswasseranker plus Ausschlusslocator plus exakt `lit./Buchstabe/
Punkt/Ziffer c` plus Aufhebungswirkung;
2. Leitungswasseranker plus zitierte Default-Form
   `Nicht versichert sind Schäden, sofern/so ferne nicht anders vereinbart`
   plus Aufhebungswirkung;
3. Leitungswasseranker plus `alle/sämtliche Ausschlüsse oder
Ausschlussbestimmungen` plus Aufhebungswirkung.

Zulässige Wirkungen sind eng auf `aufgehoben`, `gestrichen`, `außer Kraft`,
`findet keine Anwendung`, `nicht anzuwenden` und `ersetzt durch` begrenzt.
Locator und Wirkung dürfen höchstens 160 UTF-16-Zeichen auseinanderliegen;
die Struktureinheit ist auf 600 Zeichen begrenzt. Seiten-, Absatz-, Listen-
und Headinggrenzen dürfen nicht übersprungen werden. `nicht aufgehoben` und
`keinesfalls gestrichen` werden ausdrücklich abgelehnt.

Der Audit bindet Dokument-UUID, PDF-SHA, semantischen Dokumentartefakt-Digest,
PageContent- und PageMap-Digest, physische Seitenzahl, Patternvertrag sowie bei
Treffern Unit-/Match-Offsets, exakten Text und Kandidatendigest. Die bestehende
Struktureinheitserkennung wurde aus
`controlledOccurrenceWorksheet.js` wiederverwendet; es entstand kein zweiter
abweichender Absatzparser.

Betroffene Produktionsgrenzen:

```text
server/utils/policyAnalysis/lw20DefaultExclusionOverrideAudit.js
server/utils/policyAnalysis/controlledOccurrenceWorksheet.js
server/utils/policyComparison/resultBuilder.js
server/utils/policyComparison/productContract.js
```

Der Audit wird nur im exakten LW-20-Komponenten-`searchAudit` materialisiert.
Alle anderen Kategorien und Komponenten bleiben unverändert.

#### 10.15.3 Commits und Mac-Studio-Regression

```text
93a0322a fix(analysis): audit LW-20 exclusion overrides
eaa06297 fix(analysis): reject negated LW-20 override phrases
517bcf19 style(analysis): format LW-20 override audit tests
cdafd0a9 fix(analysis): bind LW-20 override references to clauses
fbee7b62 style(analysis): format LW-20 alias-free audit
```

Der erste fokussierte Mac-Lauf fand die zu enge Negationsbindung. Der erste
echte Paketlauf fand danach die 33 fachfremden V1-Kandidaten. Beide Befunde
wurden als Forward-Fixes erhalten und nicht durch History-Umschreiben
verdeckt.

Finale Validierung:

```text
Commit: fbee7b62bd919ff1ae48d000450f2c337138339b
Worktree: /private/tmp/pv3-validate-fbee7b62
Formatprüfung: PASS
Fokussierte Suites: 4/4 PASS
Fokussierte Tests: 133/133 PASS
Breite Regression: 47 Suites und 901 Tests PASS
```

Die exakt gleichen vier historischen Fixture-Suites mit 25 Tests bleiben rot:

- drei Target-QA-/Worksheet-Manifests erwarten die alte FE-Katalogbindung;
- eine statische Bedeutungsverteilung erwartet weiterhin
  `25 COVERAGE_MIXED / 91 COVERAGE_ONLY` statt `24 / 92`.

Es entstand keine neue breite Fehlersignatur.

#### 10.15.4 Echter Zehn-Dokument-Audit und unabhängiger Replay

```text
QA-Artefakt:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LW-20-OVERRIDE-AUDIT-V2-FBEE7B62-20260902
Summary-Digest:
c055baa954c7108f8c5fc31f09f94ea3d6fd19849cdec13b6b17971fa3722650
Target-Selection-Digest:
aca3828b4d208c20b8f932311e4ec13011f006bb636e58575fa88d2c9507c718
Dokumente: 10
Physische Seiten im Override-Audit: 108
Zielgebundene Override-Kandidaten: 0
Triage-Qwen-Aufrufe: 0
Evidence-Qwen-Aufrufe: 0
```

Der getrennte Replay baute jedes Atom erneut aus dem unveränderten
Dokumentartefakt, Worksheet, Triage-, Evidence- und Targetartefakt auf. Danach
rekonstruierte er alle zehn Override-Audits und prüfte Identität, Seitenzahl,
Offsets, Status, Kandidatenzahl und Assessment-Digest. Alle zehn Dokumente
lieferten `NO_OVERRIDE_REFERENCE_FOUND` mit null Kandidaten.

Schritt B1 hat absichtlich kein Kundenergebnis geändert:

```text
Vor B1: DOKUMENTATIONSUNTERSCHIED / kein Review
Nach B1: DOKUMENTATIONSUNTERSCHIED / kein Review
```

Damit ist nun erstmals revisionssicher belegt, dass die zehn bereitgestellten
Paketdokumente weder eine direkte positive LW-20-Regel noch einen eng an den
Default-Ausschluss gebundenen aliasfreien Aufhebungsverweis enthalten. Erst
dieser Befund erlaubt Schritt B2: einen eigenen LW-20-Vertrag für
`kontrollierter Nichtfund` gegen `paketweit nicht aufgehobener
Default-Ausschluss`. Eine globale Gleichsetzung von Nichtfund und Ausschluss
bleibt verboten.

Ein voller 224-Zeilen-Lauf und ein Deployment wurden nicht durchgeführt; der
installierte Kundenstand blieb unverändert.
