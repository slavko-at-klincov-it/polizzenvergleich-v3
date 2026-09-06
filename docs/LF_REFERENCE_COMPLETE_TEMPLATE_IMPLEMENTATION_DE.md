# Vollstaendige LF-Referenzvorlage: Implementierungs- und Reviewstand

Stand: 6. September 2026

## 1. Gewuenschtes Ergebnis

Der gerichtete Workspace-Modus verarbeitet genau ein LF-IMMO-Referenzdokument
auf A vollstaendig in Dokumentreihenfolge und sucht zu den servereigenen,
fachlich atomisierten A-Vergleichspunkten Gegenstuecke in bis zu neun
B-Dokumenten. Quelle, Seite, Offset, Rolle, Scope, Werte, Bedingungen und
Berechnungsbasis bleiben getrennt gebunden. B-only-Inhalte erzeugen in diesem
Modus keine Zeile. Der symmetrische Fuenf-Kategorien-Vertrag mit 224 Zeilen
bleibt unveraendert.

## 2. Verbindlicher Ausgangsstand

- Ausgangsbasis: `d266b48ae943214b4ee29e756b8ae0d49fc5f7ad`
- Arbeitsbranch: `codex/lf-reference-complete-template`
- zu pruefender Implementierungscommit:
  `126ab03b562ef598a8e40b37b3cfc6075aa99a7e`
- Kundeninstallation: nicht veraendern; kein Merge, Tag oder Deployment ohne
  ausdrueckliche Freigabe.

Der Ausgangsstand besitzt zwei persistente Workspace-Modi. Der bisherige
gerichtete LF-Vertrag verwendet 35 kuratierte, komponentenweise gehaertete
Referenzpunkte. Diese 35 Punkte sind Regressionsevidenz, aber kein
vollstaendiges LF-Inventar.

## 3. Review des Commits `126ab03b`

### 3.1 Technisch brauchbare Teilbausteine

- Ein A-Dokumentartefakt kann an Fingerprint, PageMap, physische Seite,
  Dokumentoffset und exakten Quelltext gebunden werden.
- Ein gehashtes privates Source-Manifest kann pro Session persistiert und beim
  Readback erneut gegen das Dokumentartefakt validiert werden.
- Die vorhandene Modustrennung und das Verbot von B-only-Zeilen wurden nicht
  absichtlich entfernt.
- Fehlende Prozentbasen werden nicht durch erfundene Betraege ersetzt.

Diese Punkte sind nur Infrastruktur- beziehungsweise Provenienzbelege. Sie
beweisen keine fachliche Atomisierung, Rollenbindung, Gegenstuecksuche oder
Vollstaendigkeit.

### 3.2 Releaseblocker / muss geaendert werden

1. Jeder extraktionsabhaengige Rohblock wird unmittelbar zu genau einem
   sichtbaren Vergleichspunkt und genau einer Faktenrolle. Mehrere Objekte,
   Gefahren, Bedingungen, Ausschluesse und Werte in demselben Block werden
   nicht atomisiert.
2. Der gesamte exakte A-Block ist der einzige Suchalias in B. Eine fachlich
   gleiche Paraphrase kann deshalb unentdeckt bleiben und trotzdem in den
   kontrollierten Nullfundpfad geraten.
3. Prozent- und Betragsfundstellen werden nur per Regex erkannt. Prozentbasis,
   Quellenbeziehung, Formel, Betrag und Rundung werden nicht ermittelt. Jeder
   Prozentsatz wird pauschal als `BASIS_NOT_FOUND` gespeichert.
4. Physische Seitenwechsel trennen logische Fortsetzungen. Listen, Tabellen
   und fortgesetzte Klauseln besitzen keinen seitenuebergreifenden Vertrag.
5. Der LF-Familiencheck akzeptiert acht von neun losen Textankern, prueft keine
   belastbare Dokumentversion und meldet trotzdem zehn Kategorien. Das kann
   fehlende oder umbenannte Abschnitte still der vorigen Kategorie zuordnen.
6. Die angeblich kompatible Testrevision aendert nur gespeicherte Hashfelder,
   nicht Dokumenttext, Wert, Struktur oder Layout.
7. Der dynamische Pfad wurde nicht in einem echten LF-A-nach-B-Endlauf und
   nicht gegen den symmetrischen 224-Zeilen-Pfad geprueft. Die gemeldeten 506
   Bloecke und zehn Uebergaenge sind keine fachliche Abnahme.
8. Produktcharter, ADR-027, Architektur und Wissensrouter beschreiben weiterhin
   den versionierten 35-Zeilen-Vertrag. Ein Trackerabschnitt allein darf diese
   Entscheidung nicht still ersetzen.

### 3.3 Zusaetzliche offene Punkte aus dem Ausgangssystem

- Dokumentrang, Version und Ersetzung in Mehrdokumentpaketen sind weiterhin
  offen.
- Der Mehrfach-Geldrollenfehler `FAIL-003` ist fuer Prozent-/Betragszeilen
  direkt relevant.
- Unbekannte Versicherer- und Layout-Holdouts sowie das Expertenoracle fehlen.
- `LF-FE-02` und der symmetrische Recallfehler `FE-D01` bleiben getrennte
  bekannte Grenzen und werden durch diese Arbeit nicht still behoben.

## 4. Change Brief fuer die Korrektur

Nutzerproblem / gewuenschtes Ergebnis:
: Eine vollstaendige, source-bound und fachlich ehrliche LF-Referenzvorlage;
  keine scheinbare Vollstaendigkeit aus 506 Layoutbloecken.

Beobachtete Evidenz:
: Der Commit materialisiert Rohbloecke direkt als Anforderungen, verwendet
  exakten A-Text als einzigen B-Alias und qualifiziert den Negativsuchpfad.

Root-Cause-Klasse:
: Semantik, Datenfindung, Rollenassoziation, Persistenzdarstellung und Prozess.

Betroffene Vertraege:
: `INV-001` bis `INV-004`, `INV-008`, `INV-011`, `FAIL-003`, `FAIL-005`,
  `ADR-027` sowie die atomaren Fakten- und Wertbindungsregeln der
  Produktcharter.

Scope:
: Den falschen Rohblock-zu-Fakt- und Exact-Alias-zu-Nullfund-Pfad sperren;
  Source-Ledger und fachliches Zeilenprofil trennen; Familien-,
  Fortsetzungs-, Werte-, Resume-, Ergebnis- und UI-Vertraege pruefbar machen.

Nicht-Ziele:
: Kein Deployment, keine pauschale A/B-Semantikaenderung, kein Modellwechsel,
  keine 99-Prozent- oder Holdout-Behauptung.

Riskanteste Annahme:
: Ein extrahierter PDF-Block entspreche genau einem fachlichen Vergleichspunkt.
  Diese Annahme ist widerlegt und darf nicht produktiv verwendet werden.

Primaeres Abnahmeverhalten:
: Kein dynamischer LF-Punkt darf einen kontrollierten B-Nullfund oder einen
  Kundenvorteil erzeugen, solange sein atomarer Suchvertrag nicht versioniert
  und vollstaendig belegt ist.

Realstrukturnahe Regression:
: Bekannte 31-Seiten-LF-Struktur, geaenderter echter Wert/Text, Tabellen- und
  Seitenfortsetzung, umbenannter/fehlender/verschobener Abschnitt sowie eine
  B-Paraphrase.

Was diese Tests nicht beweisen:
: Vollstaendigkeit beliebiger LF-Fassungen, unbekannter Versicherer oder die
  fachliche Richtigkeit aller Ergebniszeilen.

Wissens-Write-back:
: Bestaetigte Ursache und Beweisgrenze nach der Korrektur in Tests und
  Erkenntnisse; geaenderter Datenfluss in Architektur; akzeptierte oder
  verworfene Produktrichtung in Entscheidungen; Schnelllage im KB-Index.

## 5. Sicherer Korrekturpfad

1. Releaseblocker mit negativen Vertragstests festschreiben.
2. Source-Ledger von kundensichtbaren atomaren Vergleichspunkten trennen.
3. Bis zu einem versionierten vollstaendigen LF-Oracle den auditierten
   35-Punkte-Vertrag als einzigen entscheidungsfaehigen Produktvertrag
   beibehalten. Das Ledger darf Vollstaendigkeitsluecken sichtbar machen, aber
   keine Nullfunde oder Vorteile zertifizieren.
4. Vollstaendiges LF-Inventar und Crosswalk zeilenweise erstellen, ohne
   Kundentext oder private Artefakte zu versionieren.
5. Prozent-/Betragsrollen, Basisrelationen, Formeln und Rundung als eigene
   atomare Vertraege implementieren.
6. Erst danach eine neue Profil-, Katalog-, Ergebnis- und Abnahmeversion
   aktivieren.
7. Alle Tests ausschliesslich in einem isolierten Mac-Studio-Worktree auf dem
   exakten finalen SHA ausfuehren. Danach genau einen frischen LF-Endlauf und,
   falls gemeinsame Semantik betroffen ist, einen symmetrischen
   224-Zeilen-Nichtregressionslauf ausfuehren.

## 6. Aktueller Beweisstand

`126ab03b` ist `NO-GO` fuer Merge, Tag oder Deployment. Die damaligen
39 Jest-Tests, sechs Presenter-Tests, Lints und der 506-Block-Fixturecheck
belegen nur begrenzte technische Ausfuehrbarkeit. Sie bestehen nicht die im
urspruenglichen Auftrag definierte Mindestabnahme.

Der Korrekturcommit
`31334873506f175458db1588bc983796c7b941bb` entfernt den dynamischen
Rohblock-zu-Ergebnisweg. Gegenueber der bewährten Basis `d266b48ae` sind alle
Produktdateien wieder bytegleich; nur diese Dokumentation, der Tracker und ein
Guard-Test bleiben als Aenderung uebrig.

```text
Mac-Studio-Worktree: /Users/michaelmischkot/Code/validation-worktrees/lf-review-313348735
Node:                v22.23.2
Modellzustand:       qwen/qwen3.6-35b-a3b, 42.496 Kontext geladen; kein Modellaufruf
Fokussierte Tests:   5/5 Suites, 40/40 Tests PASS
Server-Lint:         PASS
diff --check:        PASS
Kundencheckout:      sauber und unveraendert auf 2804fa563
```

Ein neuer LF- oder symmetrischer Modelllauf wurde nicht als Beleg ausgegeben,
weil nach der Korrektur keine Produktdatei von der bereits gebundenen Basis
abweicht. Das ist ein bytegenauer Nichtregressionsbeleg, aber noch kein
vollstaendiges LF-Profil.

## 7. Sicherer Wiedereinstieg

Branch und Commit vor jeder Fortsetzung erneut pruefen. Der unqualifizierte
dynamische Nullfund- und Rohblock-als-Fakt-Pfad ist gesperrt. Der naechste
Implementierungsschritt ist ein nicht entscheidungsfaehiges, deterministisch
regenerierbares Source-Block-Ledger mit Inhaltsverzeichnis-, Kopf-/Fusszeilen-,
Tabellen- und Seitenfortsetzungs-Negativtests. Erst danach folgt das getrennte
atomare Semantic-Requirement-Manifest. Beide Schritte sind in kleinen,
getrennten Commits fortzufuehren.

## 8. Wiederaufnahme zur vollstaendigen Umsetzung

Autorisierung: Der Auftraggeber hat am 6. September 2026 die Umsetzung der
vollstaendigen LF-Vorlage angefordert. Die Abnahme wird bewusst mit genau einem
LF-Dokument auf A und einem Vergleichsdokument auf B sowie einem getrennten
symmetrischen 1+1-Lauf durchgefuehrt.

### 8.1 Aktiver Change Brief

Nutzerproblem / gewuenschtes Ergebnis:
: Das hochgeladene LF-Dokument A bestimmt Kategorien, Unterkategorien,
  fachliche Vergleichszeilen und Reihenfolge. Summen, Prozentwerte, Limits,
  Selbstbehalte, Dauern, Bedingungen und Ausschluesse bleiben an ihre exakten
  A-Quellen gebunden. B wird ausschliesslich zu diesen A-Zeilen durchsucht.

Beobachtete Evidenz:
: Die Modustrennung, Persistenz, Uploadgrenzen, Queue, private Artefakte,
  kontrollierte Gegenstuecksuche und Exporte bestehen bereits. Der innere
  LF-Vertrag ist aber weiterhin auf 35 kuratierte Punkte und einen exakten
  Dokumenthash begrenzt.

Root-Cause-Klasse:
: Strukturinventur, semantische Atomisierung, Werte- und Basisbindung,
  dynamische Vertragsidentitaet, Resume und Darstellung.

Betroffene Vertraege:
: `INV-001` bis `INV-004`, `INV-008`, `INV-009`, `INV-011`, `FAIL-001`,
  `FAIL-003`, `FAIL-005`, `ADR-027` und `ADR-028`.

Scope:
: Neuer vollstaendiger LF-Produktvertrag fuer die bekannte LF-Familie;
  deterministisches Quellenledger; kuratiertes semantisches Oracle;
  sessiongebundenes A-Manifest; dynamische B-Kataloge, Resultate, XLSX und UI.

Nicht-Ziele:
: Keine Aenderung des symmetrischen 224-Zeilen-Vertrags, kein Deployment, kein
  stilles Akzeptieren unbekannter LF-Strukturen und keine 99-Prozent-Aussage.

Riskanteste Annahme:
: Die reine Text- und PageMap-Extraktion bildet alle visuell relevanten
  Tabellen-, Listen- und Fortsetzungsgrenzen stabil genug ab. Diese Annahme
  wird gegen alle 31 gerenderten Seiten und mit Struktur-Negativtests geprueft.

Primaeres Abnahmeverhalten:
: Jede operative A-Quelle besitzt eine terminale Disposition. Jede sichtbare
  Zeile stammt aus dem semantischen Oracle und aktuellen A-Spans. Eine
  strukturell kompatible echte Wertaenderung wird uebernommen; neue, fehlende
  oder umgeordnete operative Struktur beendet den Lauf mit
  `NEUES_LF_PROFIL_ERFORDERLICH`.

Realstrukturnahe Regression:
: 31-seitiges LF-A-Dokument plus ein WEVIG-B-Dokument; echte Wertaenderung;
  fehlende/umgeordnete Sektion; Inhaltsverzeichnis, Furniture, Liste,
  Seitenfortsetzung und Prozentbasis.

Was diese Tests nicht beweisen:
: Beliebige LF-Fassungen, unbekannte Versicherer, Mehrdokument-Ranglogik oder
  das 99-Prozent-Ziel.

Wissens-Write-back:
: Implementierter Datenfluss in Architektur und ADR-Nachfolger; Laufmessungen
  in Tests und Erkenntnisse; aktueller Stand in Tracker, Projektgedaechtnis und
  KB-Index.

### 8.2 Festgelegte Umsetzungsschichten

```text
LF-PDF A
  -> kanonisches Dokumentartefakt und SourceBlockLedger
  -> LF-Familien- und Strukturpruefung
  -> kuratiertes SemanticRequirementManifest mit vollstaendigem Crosswalk
  -> unveraenderliches Session-Profil
  -> ausschliesslich dazu kontrollierte Suche in B
  -> dynamische Resultat-, XLSX- und UI-Projektion
```

Das Ledger bleibt semantikfrei. Nicht aufgeloeste Quellbloecke werden sichtbar
reviewpflichtig und koennen weder kontrollierten Nullfund noch Vorteil
erzeugen. Der bestehende 35-Punkte-Vertrag bleibt historisch lesbar und als
Regression erhalten.

## 9. Implementierter vollstaendiger LF-Familienvertrag

Der sichere Wiedereinstieg ist umgesetzt. Der produktive LF-Zweig besteht nun
aus zwei getrennten, beim Readback erneut erzeugten beziehungsweise
validierten Wahrheitsschichten:

1. `SOURCE_BLOCK_LEDGER_V1` bindet alle 1.005 nichtleeren Quellbloecke der
   bekannten 31-seitigen LF-Fassung an physische Seite, Seiten- und
   Dokumentoffset, exakten Text sowie Inhalts- und Strukturdigests. Das Ledger
   besitzt keine fachliche Entscheidungsautoritaet.
2. `LF_A_SEMANTIC_REQUIREMENT_MANIFEST_V1` bindet 283 fachlich atomisierte
   Anforderungen in 13 Kategorien und Dokumentreihenfolge an konkrete
   Quellspans. Es enthaelt 631 Komponenten, 116 typisierte Werte, sechs
   gemeinsame Wertregeln und eine gemeinsame semantische Regel. Jeder
   Ledgerblock besitzt genau eine terminale Crosswalk-Disposition; im
   bekannten Referenzdokument bleiben null offene Quellbloecke.

Das Profil wird nicht mehr durch einen festen PDF-SHA zugelassen. Ein
wertunabhaengiger Vollstruktur-Digest, 31 physische Seiten und verbindliche
Strukturanker identifizieren die unterstuetzte LF-Familie. Numerische und
Jahres-Aenderungen werden aus dem aktuellen Dokument A uebernommen. Fehlende,
neue, textlich geaenderte oder umgeordnete operative Struktur bricht mit
`NEUES_LF_PROFIL_ERFORDERLICH` ab. Die UI uebersetzt diesen internen Code in
eine konkrete Handlungsanweisung.

Die 116 Werte werden nur aus rollenpassenden, source-bound Spans
materialisiert. Prozentwert, Basis, Formel, Waehrung, Rundungsregel und
berechneter Betrag bleiben getrennt. Eine Berechnung entsteht nur bei genau
einer eindeutigen, in derselben Kategorie source-bound gebundenen
Betragsbasis. Sonst bleibt `calculatedAmount` leer. Damit werden insbesondere
mehrere Geldrollen in derselben Klausel nicht mehr vermischt.

Alle dynamischen B-Kataloge entstehen ausschliesslich aus dem A-Manifest.
Seite B darf Gegenstueckbelege liefern, aber weder Kategorien noch Zeilen
hinzufuegen. Alle 283 Suchplaene sind derzeit bewusst
`EXPLORATORY_INCOMPLETE`; deshalb kann ein leerer B-Fund niemals als
kontrollierter Nullfund oder Kundenvorteil ausgegeben werden. Das ist
fail-closed und keine Behauptung vollstaendiger Synonymabdeckung.

Historische 35-Zeilen-Ergebnisse bleiben ueber ihren alten Resultatvertrag
lesbar. Der symmetrische `SYMMETRIC_A_B_CORE5_V1`-Zweig, sein Katalog mit 224
Zeilen und sein Resultatbuilder wurden nicht durch den dynamischen LF-Vertrag
ersetzt.

Wesentliche Implementierungsmodule:

- `server/utils/policyAnalysis/sourceBlockLedger.js`
- `server/utils/policyComparison/lfReferenceFamilyContract.js`
- `server/utils/policyComparison/lfSemanticRequirementManifest.js`
- `server/utils/policyComparison/lfDynamicReferenceProfile.js`
- `server/utils/policyComparison/dynamicReferenceRunner.js`
- `server/utils/policyComparison/dynamicReferenceResultBuilder.js`
- `server/resources/policyAnalysis/lf-immo-reference-complete.v1.json`

## 10. Frischer LF-1-gegen-1-Endlauf

Der frische Lauf verwendete wie vereinbart genau ein LF-Dokument A und genau
ein WEVIG-Dokument B. Er lief seriell und ohne parallelen Modellprozess im
isolierten Mac-Studio-Worktree auf dem exakten Produktcode-Commit
`81f9601506a6f27711e00c5cf392e25cabf29058`. Die nachfolgende UI-Korrektur
`db9f9eba79b7adea5e3dd22e045bec55d3a3973a` aendert keinen Analyse-, Manifest-
oder Ergebnisvertrag.

```text
Mac-Studio-Worktree: /Users/michaelmischkot/Code/validation-worktrees/lf-complete-template
QA-Root:             /tmp/lf-one-to-one-e2e.CYnbJJ
Node:                v22.23.2
Modell / Kontext:    qwen/qwen3.6-35b-a3b / 42496
Dokumente:           A 1 / B 1
Laufzeit:            ca. 35:34 Minuten
Kategorien:          13/13
Zeilen:              283/283 eindeutig
Source-Bloecke:      1005, davon Review 0
Komponenten:         631/631 technisch verarbeitet
B-only-Zeilen:       0
Gefunden / teilweise: 16 / 70
Referenz unklar / Gegenstueck unklar: 1 / 196
Kontrollierter Nullfund: 0
Kundenreview:        267
XLSX:                1 Blatt / 12 Spalten / 283 Datenzeilen
```

Die unabhaengige Nachpruefung validierte Artefakt-Digestkette, dynamischen
Resultatvertrag, 283 eindeutige und manifestgleiche Row-IDs, Reihenfolge,
Dokumentzuordnung, Outcome-Summen und XLSX-Paritaet. Der persistente Readback
regenerierte das semantische Manifest erneut aus dem gespeicherten
A-Dokumentartefakt und bestand.

```text
Semantic-Manifest: f25a3a71246cee23bf7062787c5f4e94d6ff01ce7e9a7737f8733606e18e1863
Source-Ledger:      b3b10f6585a2bbf8933e4d04a557977cbab12c8e24af2fc5e6441168a38cad1f
comparison.json:    0ed3a2252bf501323fd47848236f4fccf7312d18a6b558a09d525bb633767cc3
comparison.md:      8af692939a73f939d9e6df160e3a3bc393b9e4db8683bb0e7a4d99c75bb95561
XLSX:               5a3ad53e0f515874a24acf682b11bac3f3acde5788860524ac1eb45f5cc389a9
```

Beweisgrenze: Der Lauf belegt technische Vollstaendigkeit und
Provenienzbindung fuer diese bekannte LF-Familie und dieses einzelne
B-Dokument. Er ist kein unbekannter Versicherer-/LF-Fassungs-Holdout, keine
fachliche Expertenabnahme aller 283 Zeilen und kein 99-Prozent-Nachweis.

## 11. Symmetrischer 1-gegen-1-Nichtregressionslauf

Auf dem UI-korrigierten Produktcode-Commit
`db9f9eba79b7adea5e3dd22e045bec55d3a3973a` lief danach derselbe
Dokumentensatz mit genau einem Dokument je Seite durch den unveraenderten
symmetrischen `CUSTOMER_CORE_5_V108_SOURCE_BOUND_MULTI_SCOPE_HEADING`-Vertrag.
Beide Dokumente erzeugten jeweils 224/224 Kategoriezeilen; der
Paket-Resultatbuilder materialisierte daraus wieder genau 224 eindeutige
Vergleichszeilen.

```text
QA-Root:             /tmp/symmetric-one-to-one-e2e.O1Afhr
Node:                v22.23.2
Modell / Kontext:    qwen/qwen3.6-35b-a3b / 42496
Dokumente:           A 1 / B 1
Kategorien / Zeilen: 5 / 224 eindeutig
Vorteil A / B:       13 / 1
Dokumentationsunterschied / gleichwertig: 38 / 126
Kein dokumentierter Vorteil / nicht vergleichbar: 0 / 16
Unklar / Kundenreview: 30 / 30
XLSX:                1 Blatt / 17 Spalten / 224 Datenzeilen
comparison.json:     63b633220530f85869ee0dc084f6918678909c591767980fe6682758f83b388b
comparison.md:       ca0031eb6eed3b69ca50fe8c897c2118f597d2838df4c01ba3e60b7d4927631d
XLSX:                bd490f903db79e05f95a9bf853f86d81a4b9ecfc1984eb27643b64a9eca9c34b
```

Der unabhaengige Validator bestaetigte Ergebnisprofil, 224 eindeutige Keys,
Outcome-Summen, Kundenreviewmetrik, Artefaktdigestkette und XLSX-Paritaet. Der
erste Harnessstart endete vor jedem Modellaufruf, weil im isolierten Worktree
der erwartete `.runtime`-Link fehlte. Nach Verknuepfung der vorhandenen
Node-22-Runtime lief derselbe Commit ohne Produktkorrektur vollstaendig durch.

Auch dieser Lauf ist technische Nichtregression fuer genau zwei bekannte
Dokumente, keine neue fachliche 224-Zeilen-Abnahme und kein Holdoutnachweis.
