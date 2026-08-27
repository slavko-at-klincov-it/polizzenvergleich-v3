# INC-004 - Vollkategorie-A/B auf LF und WEVIG

Stand: 27. August 2026

## Ziel

Beide kanonischen Test-PDFs sollen über alle acht V3-Kundenkategorien
vollständig geprüft werden. Die unveränderten Kategorieprompts bilden die
Baseline. Ein angepasster Gegenlauf darf nur dort als bewertet gelten, wo der
neue occurrence-genaue, atomare Evidence-Pfad tatsächlich aktiv ist und eine
vorher festgelegte Reviewer-Kontrolle besitzt.

## Eingefrorener Umfang

| Kategorie | Zeilen je Dokument | Prompt-SHA-256                                                     |
| --------- | -----------------: | ------------------------------------------------------------------ |
| VS        |                 36 | `0ff41d99eaa30eb516af5c60f536a39f381ce7184a46bbed4ce69525e47f466a` |
| FE        |                 80 | `f2bf41109b04e9d907ed7a9af82c1c4270b653718e2f168beb9c5f6132039637` |
| LW        |                 36 | `62ffa5dfebffb99674e62224eb8dc30d9803a4eb17a32cd1d2daea1567803e38` |
| ST        |                 36 | `6171bab5d615ef0b99e169fbf8813e930b21f2e19df60a9511f1d867d5e66695` |
| EL        |                 36 | `d5b1c465f20836d6d3069aaba89b1d5d22d3eaeed1649a92638c7e1d3b304628` |
| HP        |                 36 | `9b4f15daa73b4fc8fe943908765056cee1cc3c724e532e81925b715d7d114c30` |
| VB        |                 36 | `338b888cdbee3029eabb7b3c559157a57e640d2fd969fe9747ac97a70ac3c4e8` |
| WE        |                 24 | `bff3941c165c01886d32cbd44ae59857ee6451d857c77cde03d884bf3c7dfb0d` |

Das sind 320 sichtbare Ergebniszeilen pro Dokument und 640 Zeilen für beide
Dokumente.

Quellen-Lock:

- LF/Generali: 31 physische Seiten, 38 Chunks, SHA-256
  `2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62`.
- WEVIG Premiumschutz-Musterberechnung: 21 physische Seiten, 39 Chunks,
  SHA-256
  `a476cc2e0d970c0143e552bd7d901d82abd89324ba4cf316bc7ee3202a8b0b16`.
  WEVIG ist ein Vorschlag und muss im angepassten Vertrag als `PROPOSED_ONLY`
  behandelt werden.

## Bewertungsstufen

1. `FORMAL_PASS`: Tabelle, IDs, Statuskombinationen und wörtliche Quellen sind
   formal valide. Das ist kein fachlicher PASS.
2. `SEMANTIC_REVIEWED_PASS`: Rollen, Wirkung, Scope, Betrag, Komponenten und
   offene Punkte stimmen mit einem eingefrorenen Oracle überein.
3. `NOT_EVALUATED_ADAPTED`: Der neue Pfad ist für diese Zeile oder Kategorie
   nicht vollständig implementiert. Dieser Zustand darf nicht in einen PASS
   eingerechnet werden.

## Ausgangslage vor dem Vollrun

Der erste INC-003F-Pilot deckte 17 von 320 Requirements ab:

| Kategorie | Atomar katalogisiert | Vollumfang |
| --------- | -------------------: | ---------: |
| VS        |                    4 |         36 |
| EL        |                    6 |         36 |
| FE        |                    7 |         80 |
| LW        |                    0 |         36 |
| ST        |                    0 |         36 |
| HP        |                    0 |         36 |
| VB        |                    0 |         36 |
| WE        |                    0 |         24 |

Das waren 5,31 % der sichtbaren IDs. Für INC-004 wurden deshalb getrennte,
konservative Vollkatalog-Drafts erstellt. Sie verändern die bewährten
Pilotdateien nicht und enthalten jetzt alle 320 IDs mit insgesamt 533 atomaren
Komponenten.

Nach der unabhängigen Alias-, Rollen- und Relationsprüfung wurden die 16
vollständigen Candidate-Worksheets nochmals aus demselben finalen Codezustand
mit der realen V3-PageMap erzeugt:

| Kategorie  | Komponenten | LF: Komponenten mit Kandidat / Occurrences | WEVIG: Komponenten mit Kandidat / Occurrences |
| ---------- | ----------: | -----------------------------------------: | --------------------------------------------: |
| VS         |          64 |                                    26 / 63 |                                       18 / 95 |
| FE         |         138 |                                    15 / 22 |                                       10 / 44 |
| LW         |          52 |                                    11 / 15 |                                       17 / 33 |
| ST         |          53 |                                     9 / 13 |                                         5 / 7 |
| EL         |          67 |                                    14 / 25 |                                       13 / 53 |
| HP         |          63 |                                    15 / 22 |                                       11 / 30 |
| VB         |          52 |                                    10 / 16 |                                        8 / 17 |
| WE         |          44 |                                     8 / 14 |                                        6 / 17 |
| **Gesamt** |     **533** |                              **108 / 190** |                                  **88 / 296** |

LF besitzt damit für 80/320 Requirements mindestens einen lexikalischen
Kandidaten; nur 44 Requirements haben für jede atomare Komponente mindestens
einen Kandidaten. Bei WEVIG sind es 65/320 beziehungsweise 36/320.

Diese Zahlen sind keine Deckungs- und keine Recall-Metrik. Die niedrigeren
Trefferzahlen gegenüber den ersten Drafts sind überwiegend beabsichtigt:
generische Objektwörter, Schein-Limits und dokumentweit zusammengesetzte
Relationen wurden entfernt. Die absichtlich engen Aliase verhindern
Cross-Scope-Treffer. Eine Komponente ohne Kandidat
bleibt `UNKNOWN`; sie beweist weder Ausschluss noch fehlende Deckung. Die
Vollkatalog-Drafts erfüllen Prompt/Katalog-ID-Parität, besitzen aber noch keine
flächendeckenden Reviewer-Controls und dürfen daher nicht als
`SEMANTIC_REVIEWED_PASS` gelten.

## Bereits belegter Vorbereitungseffekt

Der neue Pfad verändert nicht nur den Prompt. Er zerlegt eine Kundenzeile in
atomare Fakten und enumeriert deren occurrence-genaue Fundstellen vor dem
Modellaufruf. Am LF-Dokument sind dadurch drei alte Fehlerklassen bereits in
der deterministischen Vorbereitung getrennt:

| Fall  | Alter Vollpromptlauf                                                            | Neue atomare Vorbereitung                                                                                      |
| ----- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| EL-08 | `BELEGT + Ja` allein aus Erdrutsch                                              | Erdrutsch 2 Kandidaten, Erdfall 0, Erdsenkung 0; daher höchstens `PARTIAL/UNKNOWN`                             |
| EL-16 | Wintergarten und Vitrine in einer Zeile, Legacyvertrag ohne gemischtes Ergebnis | Wintergarten 1 Kandidat und Vitrine 1 Kandidat als getrennte Objekte; Rollup kann `MIXED` ohne Konflikt bilden |
| EL-19 | Aufzugserwähnung wurde als Maschinenbruchdeckung bejaht                         | Aufzug 3 Kandidaten, Maschinenbruch 0; daher keine vollständige positive Aussage                               |

Das ist ein positiver Befund für die Vorbereitung und gegen die monolithische
Schlussfolgerung. Noch nicht bewiesen ist damit die vollständige Kundenzeile:
Beträge, Dauer, Bedingungen und Bezugsbasis werden im aktuellen
Prepared-Evidence-Vertrag noch als `NOT_EVALUATED` ausgewiesen. Das betrifft
179/320 Requirements mit zusammen 203 angeforderten Feldern je Dokument.

## Harte PASS-Gates

- 16/16 terminale Läufe und 640/640 sichtbare Zeilen;
- keine ausgelassene PDF-Seite und kein unbehandelter Retrieval-Overflow;
- Quellen, Seiten und Originalspans serverseitig gebunden;
- keine erfundene Quelle und kein `Nein` aus fehlender Evidenz;
- keine Rollen-, Betrags-, Bezugsbasis-, Perioden-, Sparten-, Objekt- oder
  Variantenvermischung;
- mehrteilige Requirements atomar, `MIXED` nicht als Widerspruch;
- jede Prepared-Komponente besitzt mindestens eine eindeutige
  Reviewer-Kontrolle;
- ein kritischer Fehler blockiert den Gesamt-PASS und wird nicht durch einen
  Durchschnitt verdeckt;
- Laufzeit und Ressourcen werden gemessen, nicht hochgerechnet.

## Laufstatus

```text
Originalprompt-Baseline: COMPLETE / 15 REVISE, 1 FORMAL_PASS_ONLY
Adapted-Pilot VS/EL/FE:  6/6 TECHNICAL_PASS_REVIEW_REQUIRED
Adapted-Vollkatalog:     16/16 PRE_LLM_WORKSHEETS, fachlich NOT_EVALUATED
Gesamturteil:            POSITIVER PILOTBEFUND, PRODUKTGESAMTSTATUS REVISE
```

### Originalprompt-Baseline

| Kategorie | LF               | WEVIG  | Zeilen LF/WEVIG |   Modellzeit LF/WEVIG |
| --------- | ---------------- | ------ | --------------: | --------------------: |
| VS        | REVISE           | REVISE |         36 / 36 | 268,563 s / 249,197 s |
| FE        | REVISE           | REVISE |         77 / 79 | 366,262 s / 249,184 s |
| LW        | REVISE           | REVISE |         36 / 36 | 202,569 s / 300,464 s |
| ST        | REVISE           | REVISE |         36 / 36 | 242,871 s / 146,105 s |
| EL        | REVISE           | REVISE |         36 / 36 | 186,405 s / 262,155 s |
| HP        | REVISE           | REVISE |         36 / 36 | 243,806 s / 180,991 s |
| VB        | FORMAL_PASS_ONLY | REVISE |         36 / 36 | 142,850 s / 146,590 s |
| WE        | REVISE           | REVISE |         24 / 24 | 153,081 s / 149,206 s |

Der Lauf erzeugte 636/640 erwarteten Zeilen. 15/16 Zellen waren formal
`REVISE`. Der einzige formale PASS, VB/LF, enthielt 36/36 mal
`UNGEKLÄRT` und ist daher kein fachlicher Erfolg. Die 16 Modellaufrufe
verbrauchten zusammen 3.490,299 Sekunden Modellzeit, 592.432 Tokens und
4.648,965 Sekunden beziehungsweise 77:29 Minuten Wandzeit.

### Aktueller kontrollierter Gegenlauf

| Lauf     | Modellziele | Kontrollen | Status                         | Modellzeit |
| -------- | ----------: | ---------: | ------------------------------ | ---------: |
| VS/LF    |           5 |        5/5 | TECHNICAL_PASS_REVIEW_REQUIRED |   20,735 s |
| VS/WEVIG |          12 |      13/13 | TECHNICAL_PASS_REVIEW_REQUIRED |   55,440 s |
| EL/LF    |           7 |      12/12 | TECHNICAL_PASS_REVIEW_REQUIRED |   45,795 s |
| EL/WEVIG |           3 |      12/12 | TECHNICAL_PASS_REVIEW_REQUIRED |   55,830 s |
| FE/LF    |           6 |        9/9 | TECHNICAL_PASS_REVIEW_REQUIRED |   34,734 s |
| FE/WEVIG |           5 |        9/9 | TECHNICAL_PASS_REVIEW_REQUIRED |   51,010 s |

Damit sind 60/60 vorhandene Reviewer-Kontrollen grün. Die sechs Läufe
benötigten 263,544 Sekunden Modellzeit und 264,754 Sekunden Wandzeit. Dieser
Laufzeitvergleich ist nur ein Pilotvergleich: Der Gegenlauf bewertet 17/320
Requirements, die Baseline alle 320 sichtbaren Zeilen.

Im aktuellen EL/LF-Gegenlauf ist EL-16 tatsächlich `COMPLETE + MIXED + NONE`:
Wintergarten `INCLUDED`, Vitrine `EXCLUDED`, kein Widerspruch. EL-08 und EL-19
sind jeweils `PARTIAL + NOT_DETERMINABLE`. Damit sind die drei vorab benannten
Fehlerklassen im aktuellen Code-/Promptstand positiv behoben.

Der erste Start mit System-Node 26.7.0 scheiterte vor der PDF-Verarbeitung an
einer inkompatiblen historischen Node-Abhängigkeit. Der Lauf wurde ohne
fachliches Ergebnis als Umweltfehler verworfen und mit einer kompatiblen
Workspace-Node-Laufzeit neu gestartet.

Als erstes zusätzliches Sicherheitsgate wurde der Prepared-Control-Vertrag
fail-closed gemacht: leere Kontrollmengen, doppelte Kontroll-IDs, unbekannte
Komponenten und nicht kontrollierte Komponenten können nicht mehr durch eine
leere `every()`-Auswertung formal grün werden.

Zusätzlich erzwingt ein persistenter Test für alle acht Kategorien exakte
Prompt/Katalog-Parität bei ID, Reihenfolge und sichtbarem Kategorienamen. Ein
Kontrollsatz kann nur mit explizitem Status `APPROVED` zu einem echten PASS
führen; `NOT_DECLARED` und `REVIEW_REQUIRED` bleiben review-pflichtig.

## Beweisgrenze

LF und WEVIG wurden bereits für die Entwicklung benutzt. Sie sind deshalb
Regressionstestquellen, keine unabhängigen Holdouts. Selbst ein späterer
`SEMANTIC_REVIEWED_PASS` über alle 640 Zeilen beweist die Wirkung auf diesen
beiden Dokumenten, aber noch nicht die Generalisierung auf unbekannte
Versicherer, OCR-Varianten oder Mehrdokumentpakete.
