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

Status: `4/7 TARGET-E2E ACCEPTED`, `2/7 PIPELINE-KANDIDATEN`. `FE-C07` ist im
echten gezielten Ergebnisweg als `VORTEIL_B`, `EL-11` als
`NICHT_VERGLEICHBAR`, `FE-C12` als `GLEICHWERTIG` und `LW-20` nach Schritt B2
als `GLEICHWERTIG` ohne Review entschieden. `EL-06` und `EL-12` haben
jeweils den gebundenen Zehn-Dokument-Pipeline-Probe bestanden, benötigen aber
noch die Bestätigung im späteren konsistenten Vollvergleich. Ein Fall bleibt
ohne bestandenen Kandidaten offen: `VS-35`.

```text
VS-35
FE-C07, FE-C12
LW-20
EL-06, EL-11, EL-12
```

Abschluss: fundlose Seite vollständig kontrollieren; bei vollständigem
positiven Gegenbeleg wird dessen Seite zum Vorteil.

### R69-D – Vergleichsregel fehlt: 4

Status: `2/4 ACCEPTED`, offen bleiben `VS-08` und `FE-A01`

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
