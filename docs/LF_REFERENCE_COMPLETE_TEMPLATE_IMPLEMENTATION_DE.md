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

`126ab03b` ist `NO-GO` fuer Merge, Tag oder Deployment. Die bisherigen
39 Jest-Tests, sechs Presenter-Tests, Lints und der 506-Block-Fixturecheck
belegen nur begrenzte technische Ausfuehrbarkeit. Sie bestehen nicht die im
urspruenglichen Auftrag definierte Mindestabnahme.

## 7. Sicherer Wiedereinstieg

Branch und Commit vor jeder Fortsetzung erneut pruefen. Der naechste Commit
muss zuerst den unqualifizierten dynamischen Nullfund- und
Rohblock-als-Fakt-Pfad sperren und die dazugehoerigen Negativtests enthalten.
Danach sind die ausstehenden Schritte in Abschnitt 5 in kleinen, getrennten
Commits fortzufuehren.
