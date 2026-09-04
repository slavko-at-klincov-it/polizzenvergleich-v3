# Audit der sieben offenen LF-V2-Zeilen am 4. September 2026

## Zweck und Beweisgrenze

Dieses Dokument protokolliert die Einzelquellenaudits und kleinen
Forward-Fixes für die sieben Zeilen, die der frische LF-V2-Lauf auf
`03c5841558ff3463eabff6ec4db8a9c904bb091a` strenger als die frühere manuelle
V1-Matrix bewertet hatte. Jeder produktive Fix bildet einen wiederverwendbaren
semantischen Vertrag ab; keine Regel ist an Seitenzahlen, Versicherernamen oder
die Verbesserung einer Kennzahl gebunden.

Die abschließende 35-Zeilen-Differenz ist ein kontrollierter Diagnosebefund:
Unveränderte Extraktions- und Kategorienartefakte wurden aus belegten Läufen
wiederverwendet, nur die betroffenen Ansichten wurden neu erzeugt und mit Qwen
ausgewertet. Sie ist deshalb noch kein frischer End-to-End-Release-Nachweis.
Dieser folgt erst nach den vollständigen statischen Gates auf dem finalen SHA.

## Verbindlicher Ausgangsbefund

Der frische Lauf `c9fefe38-cb55-43fa-8234-b7eb0ff2da87` auf `03c584155`
lieferte in 20:08,371 Minuten bei 237 Qwen-Aufrufen, 519.517 Prompt- und
15.995 Completion-Token:

```text
vollständig                 12
teilweise                   13
kontrollierter Nullfund      4
unklar                       6
Kundenreview                19
```

Die sechs unklaren Zeilen waren `LF-FE-02`, `LF-ST-03`, `LF-LW-03`,
`LF-KO-02`, `LF-KO-03` und `LF-GL-03`. `LF-OK-02` war teilweise belegt, aber
ebenfalls Teil des Audits, weil eine zu breite Klauselgrenze seine
Vollständigkeit verhinderte.

## Einzelbefunde und Korrekturen

| Zeile | Ursache | Korrektur | Risikoabsicherung | Ergebnis |
| --- | --- | --- | --- | --- |
| `LF-OK-02` | Die Formulierung „ist nur dann versichert, wenn“ wurde unabhängig von der Komponentenrolle als enger Scope behandelt; in der Bedingungskomponente war das eine falsche Verengung. | `cfc86686d` begrenzt die Semantik auf `CONDITION` und bindet bei mehreren Prädikaten das nächstgelegene nach dem exakten Treffer. | Negative `COST`-/`PERIL`-Fälle und ein adversariales Mehrsubjektbeispiel verhindern eine globale Aufweichung. | teilweise → vollständig |
| `LF-ST-03` | Die gerichtete Referenzansicht `RS` war nur der Sturm-, nicht aber der Elementarversicherung zugeordnet. Dadurch erschienen passende Elementarklauseln als Scope-Konflikt. | `c9989ead4` ordnet `RS` sowohl `STURM_INSURANCE` als auch `ELEMENTAR_INSURANCE` zu. | `RS-03`, `RS-04` und ein Leitungswasser-Gegenbeispiel sichern die Grenze. | unklar → vollständig |
| `LF-KO-02` | Ein lokaler Kostendefinitionssatz wurde nicht als Rollen-Governor gebunden. | `00fed8e7a` bindet den Kostengovernor nur an ein eindeutiges, nachfolgendes Ziel innerhalb von 280 normalisierten Zeichen. | Ziel-vor-Governor und mehrdeutige Vorkommen bleiben abgelehnt. | unklar → teilweise |
| `LF-KO-03` | Gleiche gerichtete Rollenlücke wie bei `LF-KO-02`. | `00fed8e7a`, ohne Änderung am Paketstatus- oder Nullfundvertrag. | Exakte Offsets und Richtungsprüfung verhindern entfernte oder rückwirkende Bindung. | unklar → teilweise |
| `LF-LW-03` | Der gültige lokale Kostenbeleg blieb aus demselben Grund ohne explizite Kostenrolle. | `00fed8e7a`. | Identische fail-closed Grenzen wie bei den KO-Zeilen. | unklar → vollständig |
| `LF-GL-03` | Natürliche Glasüberschriften und gerichteter Glas-Scope wurden nicht kanonisch erkannt; zugleich konnten allgemeine Notverschalungs-/Bewachungskosten ohne Glasbezug zu breit in `RG` gelangen. | `5577192bc`, `3a2602d68`, `96f9d8cbb` und `fdc43c3e2` ergänzen den nicht-strikten Glas-Scope, kanonisieren die Überschrift und weisen unlokalisierte Glaskosten `OTHER_SCOPE` zu. | Der strikte Glas-Scope wurde absichtlich nicht global erweitert. Ein lokaler Glasbruch-/Glasschaden-/Scheibenbezug oder eine strukturierte Glasbruchsektion bleibt erforderlich. | unklar → teilweise; fehlende Bewachung bleibt sichtbar |
| `LF-FE-02` | Ruß ist eingeschlossen. Elektrische Energie ist in B02 eingeschlossen, in B05 aber mit „so ferne nicht anders vereinbart“ ausgeschlossen. Die Quellen können eine Sondervereinbarung andeuten, beweisen jedoch ohne paketweite Dokumentidentität keinen eindeutigen B01/B02-Override. | Kein Kennzahlenfix. | Eine Rollen- oder Rangregel ohne versionierten, quellengebundenen Aktivierungsvertrag könnte echte Ausschlüsse überstimmen. | unverändert unklar |

## Nachbarregression `LF-GL-02` und Forward-Fix

Nach der korrekten Sichtbarkeit des Glas-Scope wurde `LF-GL-02` zunächst von
vollständig auf teilweise zurückgestuft. Das war keine fachliche Verschlechterung
der Quelle: Das B-Dokument deckt den Glasbruch an Solar- und
Photovoltaikanlagen ausdrücklich aufgrund eines Sturmschadens, also gültig in
einem engeren Sturm-Scope.

`05b222937` sollte deshalb für genau diese versionierte Referenzkomponente
einen eingeschlossenen `STURM_INSURANCE`-Gegenpart erlauben. Der nachgelagerte
Review zeigte jedoch, dass die erste Umsetzung den Scope requirementweit
speicherte. `b63d71828` und
`60d87bff6` schließen gleichzeitig die bisherige Validierungslücke: Eine
`NARROW_ONLY`-Entscheidung ist nur gültig, wenn der beobachtete Scope nicht leer
ist, im Vertrag deklariert wurde und vollständig innerhalb der erlaubten
Scope-Schlüssel liegt. Dadurch wurde `LF-GL-02` wieder vollständig, ohne
beliebige enge Quellen zuzulassen. `0c2fd07c6` korrigiert ausschließlich die
zugehörige Testfixture.

## Nachtrag: nachgelagerte Releaseblocker

Der vollständige Vorfix-Lauf auf `14c2bb1b0` bestätigte die erwartete
LF-Partition, war aber noch kein Releasebeleg. Der anschließende Code- und
Artefaktaudit fand:

- einen Triage→Prepared-Bypass für unscopierte RG-Kosten, geschlossen durch
  `2405de721` und `82ccabf3a`;
- den requirementweiten `LF-GL-02`-Sturm-Scope, komponentengenau und
  versioniert geschlossen durch `faad2e2ba`, `a66f91071`, `f385a75e0`,
  `9f2b75a0d` und `7de9306b8`;
- vier gültige JSON-Entscheidungen, die im Kunden-XLSX fälschlich `UNKLAR`
  wurden, geschlossen durch `9065aac91` und `6c9cc7ae4`.

Ein zweiter Senior-Review fand weitere Eingangs- und Replaygrenzen. Sie sind
auf Implementierungsbasis `528083b1d` geschlossen:

- `4d27cf5bf`: vollständiger versionierter Regel→Outcome-Vertrag für alle 33
  freigegebenen Kundenpresenter-Regeln;
- `e29cbe897`: Plural- und Bindestrichformen für
  `Glasschäden`/`Glasbruchschäden`;
- `8658d82be`: source-gebundene Section-Scope-Validierung und autoritative
  Fremd-Scope-Ablehnung in Preparation auch bei `DIRECT` oder ohne Triage;
- `95727b701` und `525e2601e`: V2-Target-Selection mit Replay des normalisierten
  Worksheet-Suchvertrags;
- `1be7264e3` und `528083b1d`: kanonische Narrow-Alias-Scopeidentität sowie
  Fail-Closed für vergleichbare beidseitig enge Atome ohne Identität.

Die alte XLSX-Prüfung verwendete denselben Presenter als Soll-Oracle und
belegte daher nur Serialisierungsparität. Der tatsächliche Vorfix-Befund war:

```text
JSON: A 5 / B 4 / Doku 34 / Gleich 125 / NC 13 / Unklar 43
XLSX: A 4 / B 4 / Doku 34 / Gleich 123 / NC 12 / Unklar 47
Abweichende IDs: VS-10, VS-25, ST-01, VS-34
```

Die erneuten vollständigen statischen Gates sowie frischen LF- und
symmetrischen Läufe auf dem Dokumentations-Freeze-SHA bleiben offen.

Ein dritter, unabhängiger Artefaktreview fand danach sechs Grenzen außerhalb
der fachlichen Entscheidung: unvollständige XLSX-Rückprüfung, fehlende
Finalisierungswiederaufnahme nach einem Crash, einen vom Exportvertrag
umgangenen JSON-Endpunkt, verwaiste Publish-Claims, eine unnötige
Downloadabhängigkeit von der Archivkopie und ein Read/Send-Zeitfenster. Die
Commits `73db76ec9` bis `c839a2834` schließen diese Grenzen durch:

- atomare Veröffentlichung von JSON, Markdown und XLSX als ein manifest- und
  hashgebundener Satz;
- vollständige Prüfung jeder exportierten Datenzelle gegen die kanonische
  Projektion;
- versionierte Export-Hashkette und gespeicherten Zugriffvertrag für JSON und
  XLSX;
- Wiederaufnahme einer bereits vollständig publizierten Finalisierung;
- PID-/Nonce-gebundene Publish-Claims mit sicherer Stale-Recovery und
  Verzeichnis-Fsync;
- Auslieferung exakt der zuvor verifizierten Workbook-Bytes ohne erneutes
  ungeschütztes Einlesen.

Der source-gebundene Such-/Triagevertrag ist gleichzeitig als Produktprofil
`CUSTOMER_CORE_5_V105_SOURCE_BOUND_TRIAGE` mit Vergleichsvertrag V66 und als
LF-Profil `LF_IMMO_REFERENCE_35_V5_SOURCE_BOUND_TRIAGE` versioniert. Der
vorherige V104-/LF-V4-Stand bleibt ausschließlich als historische
Validierungsidentität erhalten.

## Mac-Studio-Prüfungen pro kleinem Fix

Alle Prüfungen liefen im isolierten Mac-Studio-Worktree
`/Users/michaelmischkot/Code/validation-worktrees/v370-final-ace2b626` mit
Node 22.23.2. Der Kundencheckout blieb unverändert.

```text
cfc86686d  deterministische Kategorieregeln             98/98 PASS
c9989ead4  deterministische Kategorieregeln            100/100 PASS
00fed8e7a  Kandidatentriage                              53/53 PASS
5577192bc  deterministische Kategorieregeln            101/101 PASS
96f9d8cbb  Occurrence-Worksheet                        132/132 PASS
fdc43c3e2  Kandidatentriage                              57/57 PASS
b63d71828  LF-Profil + Referenzergebnis                  19/19 PASS
60d87bff6  Renderer + Profil + Referenzergebnis          58/58 PASS
4d27cf5bf  Kunden-Regel→Outcome-Vertrag                  38/38 PASS
e29cbe897  RG-Pluralformen                              103/103 PASS
8658d82be  Source-bound Fremd-Scope                     134/135; 1 alte Assertion
86a2c7b22  Fremd-Scope-Test-Forward-Fix                 135/135 PASS
c8b821440  Target-Selection-Replay                      153/158; Normalisierung offen
95727b701  V2-Worksheet-Replay                          175/176; Registry-Dopplung offen
525e2601e  Auswahl-Normalisierung getrennt              176/176 PASS
1be7264e3  Narrow-Alias-Identität                         0/0; Initialisierung blockiert
0d82cc3ea  Initialisierungs-Forward-Fix                 196/200; Gate zu breit
528083b1d  Eng-gegen-Eng-Gate begrenzt                  200/200 PASS
```

Die erste natürliche Glasüberschrift auf `3a2602d68` deckte nur die
Kanonisierung ab; der Test zeigte korrekt, dass „Die Glasversicherung“ noch
nicht als Struktur erkannt wurde. Dieser Befund wurde nicht kaschiert, sondern
mit `96f9d8cbb` als eigenem Forward-Fix geschlossen.

## Diagnose 1: exakt sieben Komponenten

Auf `fdc43c3e2` wurden ausschließlich `RK-02`, `RK-03`, `RF-02`, `RS-03`,
`RW-03`, `RG-03` und `RO-02` über zehn Dokumente neu triagiert und bewertet.
Es wurden nur zuvor verifizierte, unveränderliche Extraktionsartefakte
wiederverwendet.

```text
QA-Root: /Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/TARGETED-LF-7-FDC43C3E2-20260904-143724
Wandzeit: 332 s
Triage: 60 Reports, 0 Fehler, 32 Qwen-Aufrufe, 64.157/538 Token
Wirkung: 60 Reports, 0 Fehler, 25 Qwen-Aufrufe, 67.262/4.093 Token
Metadaten-SHA256: d2d36f26d6d49f5b11f2ca797d7aa7ad1632ed8871311155d784388a946eef44
```

Der gezielte Komponentenlauf ist kein gültiges 35-Zeilen-Paketergebnis; der
produktive Materialisierer verbietet zu Recht unvollständige Ziel-Worksheets.

## Diagnose 2: sechs neu ausgewertete Ansichten

Die Ansichten `RF`, `RS`, `RW`, `RK`, `RG` und `RO` wurden auf `fdc43c3e2`
neu ausgewertet, während `RP`, `RV`, `RH` und `RA` unverändert aus dem frischen
V2-Basislauf übernommen wurden.

```text
QA-Root: /Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/V370-LF-SEVEN-FDC43C3E2-20260904-144405
Wandzeit: 628.989,347 ms
vorher: 12 vollständig / 13 teilweise / 4 Null / 6 unklar / 19 Review
danach: 14 vollständig / 16 teilweise / 4 Null / 1 unklar / 17 Review
comparison.private.json: 6a3c98d0c4ba41b6b955f40c7996204b97ce1e32fa3c6d6d8e229a250535771d
polizzenvergleich.xlsx:  eb42e828ebd91920de8a849957cb7bbf0f5bc1d2299a8f89a8ef61624248276b
Audit-SHA256:             63fb4c95e02aff704a88c55ec72f304a8bf0b6e466348f083e614742e2dbd372
```

Dieser Lauf deckte die `LF-GL-02`-Nachbarregression auf und war deshalb kein
Abschlussnachweis.

## Diagnose 3: Glas-Forward-Fix und finale Mischpartition

Nach dem eng validierten Scope-Forward-Fix wurde `RG` auf dem aktuellen
Logikstand `60d87bff6162371b454ecd6e2876a9aa46d97a32` erneut ausgeführt und
mit den unveränderten Ansichten materialisiert.

```text
QA-Root: /Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/V370-LF-GLASS-60D87BFF6-20260904-150312
Wandzeit RG: 34.681,115 ms
Zeilen / Kategorien: 35 / 10
vollständig:          15
teilweise:            15
kontrollierter Null:   4
unklar:                1
Kundenreview:         16
comparison.private.json: 304b316ff439e0fcb36a9206ffdda684aaea2fb44cdb8434b2dcad49cb8b4777
polizzenvergleich.xlsx:  702df40412cbd0ced01848d7732ff6e325d190958baa4433c9a3c148cfbd475d
Differential-Audit:      c868360be94473d5cd5e4149cd0bde967741f335272f168e2eb5f2ace315261b
```

Exakte Änderung gegenüber dem frischen LF-V2-Basislauf:

```text
LF-KO-02  unklar    -> teilweise   Review bleibt
LF-KO-03  unklar    -> teilweise
LF-ST-03  unklar    -> vollständig Review entfällt
LF-LW-03  unklar    -> vollständig Review entfällt
LF-GL-03  unklar    -> teilweise
LF-OK-02  teilweise -> vollständig Review entfällt
LF-FE-02  unklar    -> unklar
LF-GL-02  vollständig, enger Sturm-Scope sichtbar und gültig
```

Die Kundenreview-Zahl fällt nicht auf eins, weil eine teilweise belegte
Referenzzeile weiterhin eine echte, sichtbare Teilabweichung zur manuellen
Prüfung darstellt. `unklar = 1` bezeichnet dagegen ausschließlich den noch
nicht eindeutig auflösbaren Paketkonflikt von `LF-FE-02`.

## Abgebrochene Versuche

Ein früher Zielkomponentenversuch auf `a6e657042` wurde nach neu erkannten
Scope-Blockern bewusst beendet. Ein weiterer Aufruf scheiterte vor dem Lauf an
einer falschen erwarteten SHA. Beide erzeugten weder einen gültigen
Ergebnisnachweis noch eine übernommene Entscheidung; auf dem Mac Studio blieb
kein Worker und keine Lockdatei aktiv.

## Noch offene Freigabegates

1. Vollständige Tests, Lint, Build, Installer/Updater, Prisma und
   Migrationsprüfungen auf demselben finalen Commit.
2. Frischer vollständiger LF-1-gegen-9-Lauf auf exakt diesem Commit; erwartet
   wird aufgrund des Diagnosebefunds 15/15/4/1 mit 16 Reviews, nicht als
   vorweggenommene Behauptung, sondern als zu prüfende Hypothese.
3. Frischer symmetrischer 224-Zeilen-Nichtregressionslauf. Die V3.6-Grenzen
   sind höchstens 43 Reviewzeilen und Erhalt der neun bestätigten Vorteile.
4. Unabhängige JSON-/Markdown-/XLSX-Paritätsprüfung und vollständige Hashes.
5. Erst danach Releaseentscheidung, Merge, Tag und ausdrücklich autorisiertes
   Deployment mit V3.6-First-Hop-Quieszenzprüfung.

Bis diese Gates bestanden sind, bleibt V3.7.0 `NO-GO`. Der Befund gilt nur für
das bekannte LF-/WEVIG-Entwicklungsset und beweist weder unbekannte Versicherer
noch das 99-Prozent-Produktziel.
