# LF-1+9 Gold-283-V2 – versionierter Korrekturvertrag

Stand: 17. September 2026
Change-Set: `LF-V381-COLD-E2E-CORRECTIONS-20260917-001`

## Kurzurteil

`Gold-283-V1` bleibt bytegenau unverändert. Drei nachträglich belegte
Fehlbindungen (`VS-15`, `AV-06`, `AV-22`) werden ausschließlich über das
QA-only-Artefakt `LF_1PLUS9_GOLD_283_CORRECTION_SET_V1` versioniert und in
ein neues, unveränderliches `LF_1PLUS9_GOLD_283_V2` übernommen. Weder das
dynamische A-Manifest noch Suche, Produktentscheidung, UI, XLSX oder
Kundenbetrieb werden dadurch verändert.

## Change-Brief

- Nutzerproblem: Die letzte bekannte Regression misst drei belegte
  Gold-/Crosswalk-Abweichungen als Produktfehler.
- Root-Cause-Klasse: QA-Oracle/Semantik, nicht Produkt-Retrieval.
- Betroffene Invarianten: `INV-002`, `INV-004`, `INV-011`, `INV-012`.
- Wiederverwendung: `ADAPT_EXISTING` für `CAP-QA-001`; keine neue
  Produktfähigkeit.
- Nicht-Ziele: keine zeilenspezifische Produktionsregel, kein Modelllauf,
  kein Deployment, kein Holdout- oder 99-Prozent-Nachweis.
- Abbruchgrenze: Jede Hashabweichung, eine vierte ID, ein nicht vollständig
  zertifizierter Nullfund oder eine Mutation einer der übrigen 280 Zeilen
  stoppt fail-closed.

## Belegte Korrekturen

| ID | Falsche V1-Bindung | V2-Entscheidung |
|---|---|---|
| `VS-15` | allgemeine Gebäude-/Haustechnikdefinition statt Keller-/Abstellabteil samt Türen und Inhaltsausschluss | `NO_COUNTERPART_ESTABLISHED` |
| `AV-06` | Günstigkeits-/Auslegungsklausel statt Recht auf neue Bedingungen/Tarife und Prämienherabsetzung | `NO_COUNTERPART_ESTABLISHED` |
| `AV-22` | Erlaubnis eigener Mitarbeiter/allgemeine Ersatzleistung statt Gemeinkostenzuschlag und Fachfirmen-Cap | `NO_COUNTERPART_ESTABLISHED` |

Alle drei dynamischen Zielrequirements sind im bereits abgeschlossenen
1+9-Lauf terminal `NOT_FOUND`, `absenceCertified: true` und über
`COMPLETE_CORPUS_ABSENCE` abgeschlossen. Der gebundene Korpus umfasst neun
B-Dokumente, 322 Klauseln und 77 Seiten. Das neue Gold darf ausschließlich
aus diesen hashgebundenen Artefakten materialisiert werden; die bloße
Produktentscheidung allein wäre kein ausreichender Goldbeweis.

## Unveränderliche Eingänge

Kanonisches V1-Artefakt:

```text
/Users/michaelmischkot/Library/Application Support/
  at.klincov.polizzenvergleich-v3/QA/
  LF-1PLUS9-GOLD-283-V1-20260914-61665410/gold-283-v1.private.json
Datei-SHA-256: 9ed4ab6ba3dbd896de48ecf94e6874881391600ef2cc027afae5af5d21123a55
Gold-SHA-256:  d9475c0e8145b5f326ae54ffaab58e5b2c2d154521837452993fc72712257179
```

Gebundene V2-Laufartefakte liegen unter:

```text
/Users/michaelmischkot/Library/Application Support/
  at.klincov.polizzenvergleich-v3/QA/
  LF-A-DRIVEN-V2-FRESH-1PLUS9-20260915-001743EE/
  a-driven-v2-a-atomization-c48fc1588/
```

Relevante Dateihashes:

```text
complete-b-corpus-peril-atom-51b522ce9.private.json
44adf1b282fabe65debd58c3e53b48877ffa4c2480655d71864f9a7dd0825e11

final-semantic-ac3ce5631/final-requirement-decisions.private.json
e04211668273b01fc7f416782fc62f5952d0d9f8b3c62968636c7833f694fbe8

final-semantic-ac3ce5631/gold-result-regression.private.json
2dbbf6cbf8a69942d465d9a43a33594494c7c13691cd27812f50f798f784f0fd
```

## Materialisierung und erwartetes Ergebnis

Der neue Materializer veröffentlicht Correction Set und Gold-V2 gemeinsam in
einem neuen Verzeichnis. Ein vorhandenes Ziel wird niemals überschrieben.

Erwartete Gold-V2-Verteilung:

```text
Zeilen:                 283
GEFUNDEN:               270
NICHT GEFUNDEN:          13
FULL:                   149
PARTIAL:                113
CONTRADICTED:             8
NO_COUNTERPART:          13
geänderte Zeilen:         3
unveränderte Zeilen:    280
```

Nach erneuter QA-Regression gegen dasselbe finale dynamische Ergebnis werden
für die 144 eindeutig messbaren Crosswalk-Zeilen 144 binäre
Übereinstimmungen sowie null False Positives und null False Negatives
erwartet. Das ist ausschließlich eine korrigierte bekannte
Fixture-Regression und keine zusätzliche Produktqualitätssteigerung.

## Verifikation

Auszuführen ausschließlich auf dem Mac Studio, nachdem kein anderer
LLM-/E2E-Lauf aktiv ist:

1. neuer fokussierter Gold-283-V2-Vertragstest;
2. vorhandener A-driven-Gold-Regressionsvertrag für V1 und V2;
3. Materialisierung in ein neues privates QA-Verzeichnis;
4. V1-Datei- und interner Goldhash erneut prüfen;
5. exakt drei geänderte und 280 unveränderte Zeilen prüfen;
6. Gold-V2 erneut gegen das finale Binärartefakt auswerten;
7. 144/144, 0/0 FP/FN und sämtliche neuen Hashes dokumentieren.
