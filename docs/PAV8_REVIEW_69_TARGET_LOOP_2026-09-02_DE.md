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

| Inkrement           | Commit | Ziel-IDs      | Vorher    | Nachher | 155-Guard | Mac Studio | Entscheidung  |
| ------------------- | ------ | ------------- | --------- | ------- | --------- | ---------- | ------------- |
| Target Selection V1 | offen  | Infrastruktur | 69 Review | offen   | offen     | offen      | `IN_PROGRESS` |

Kein Deployment während dieses Loops. Der installierte Kundencheckout bleibt
bis zu einer ausdrücklichen Freigabe unverändert.
