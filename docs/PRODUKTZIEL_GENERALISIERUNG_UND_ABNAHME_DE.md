# Produktziel, Generalisierung und fachliche Abnahme

Stand: 31. August 2026
Geltung: verbindlicher V3-Produkt- und Entwicklungsvertrag

## 1. Kurzurteil

Das Produktziel ist **keine perfekte Sonderlösung für LF IMMO**. Ziel ist eine
allgemeine, beleggebundene Analyse-Engine für zukünftige
Gebäudeversicherungs-Vertragspakete unterschiedlicher Versicherer.

LF IMMO und WEVIG sind bekannte Entwicklungs- und Regressionsexemplare. Sie
zeigen konkrete Fehler und erlauben reproduzierbare Vorher-/Nachher-Vergleiche.
Ein Erfolg auf diesen beiden Dokumenten allein beweist weder Generalisierung
noch 99 Prozent fachliche Richtigkeit.

Der derzeitige Stand erreicht dieses Gesamtziel noch nicht. Der gemeinsame
evidenzgebundene Verarbeitungspfad besitzt weiterhin Kataloge und historische
Regressionsevidenz für acht Ansichten. Das produktive, versionierte
Kundenprofil `CUSTOMER_CORE_5_V2` umfasst jedoch bewusst nur VS, FE, LW, ST
und EL mit 224 sichtbaren Zeilen. Die offene Grenze liegt bei fachlicher
Expertenabnahme, Dokumentrang/Ersetzung, unbekannten Holdouts und dem
Laufzeitbudget.

## 2. Verbindlicher Produktumfang

Ein Vertragsdokumentpaket kann aus einem bis zu neun zusammengehörigen
Dokumenten bestehen, etwa Hauptpolizze, Angebot, Rahmenvereinbarung,
allgemeinen und besonderen Bedingungen, Klauselverzeichnis sowie Feuer-,
Sturm- oder anderen Nachträgen.

Die aktuelle Kundenansicht besitzt fünf fachliche Kategorien:

```text
VS  Versicherungssumme und versicherte Sachen
FE  Feuer
LW  Leitungswasser
ST  Sturm
EL  Elementar- und Zusatzdeckungen
```

Die ausgelieferten Vorlagen dieses Kundenprofils definieren zusammen 224
sichtbare Tabellenzeilen: VS 36, FE 80, LW 36, ST 36 und EL 36. HP, VB und WE
bleiben als interne Katalog- und historische Regressionsevidenz erhalten,
werden aber nicht mehr im produktiven Vergleichslauf ausgeführt. Die 224
Zeilen sind feste Kunden- und Exportansichten, nicht die interne
Faktenstruktur und keine bewiesene Vollständigkeitsgrenze des Vertragsinhalts.

Der gewünschte Bedienablauf bleibt:

```text
Dokumentpaket hochladen -> Analyse starten -> belegte Tabellen erhalten
```

Interne Mehrpass-, Such-, Klassifikations- und Prüfphasen sind erlaubt. Der
Kunde muss sie nicht bedienen. Ein Produktlauf soll nach derzeitiger Annahme
auf der Zielhardware höchstens ungefähr eine Stunde benötigen; diese Grenze
ist noch durch vollständige neue End-to-End-Läufe zu bestätigen.

## 3. Zielarchitektur: Fakten zuerst, Kategorien danach

```text
Vertragspaket
  -> einmalige Dokumentidentität, PageMap und Strukturerfassung
  -> Dokumentrolle, Version, Rang und Ersetzungsbeziehungen
  -> atomare Requirements je fachlichem Vergleichspunkt
  -> dokumentweite kontrollierte Alias-/Occurrence-Suche
  -> kleinster vollständiger Klausel-, Listen- oder Tabellenkontext
  -> unveränderliche servereigene Evidence-Spans
  -> begrenzte LLM-Klassifikation nur für bekannte Kandidaten
  -> deterministische Rollen-, Scope-, Werte- und Konflikt-Gates
  -> paketisolierte atomare Vertragsfakten
  -> Rollup in das versionierte Kundenprofil VS/FE/LW/ST/EL
  -> serverseitig erzeugte Tabelle, Detailansicht und Export
```

Ein atomarer Fakt hält mindestens getrennt:

- betroffenes Objekt und gegebenenfalls Objektgruppe;
- Gefahr, Ursache oder Leistung;
- Wirkung: eingeschlossen, ausgeschlossen, bedingt, optionale Variante oder
  ungeklärt;
- Geltungsbereich und Variante;
- Faktrolle, beispielsweise Deckung, Definition, Limit, Selbstbehalt,
  Ausschluss, Obliegenheit oder Dauer;
- Wert und Einheit;
- Bedingung und zeitliche Geltung;
- Dokumentidentität, Dokumentrolle, Rang und Version;
- physische Seite und exakten servereigenen Quellspan.

Mehrere Fakten dürfen derselben Tabellenzeile zugeordnet sein. Erst der
serverseitige Rollup erzeugt daraus das sichtbare Deckungsbild. Beispiel:

```text
EL-16
Wintergarten -> INCLUDED
Vitrine       -> EXCLUDED

Gesamtbild    -> MIXED
Konflikt      -> NONE
```

Das ist kein Widerspruch, weil verschiedene Objekte betroffen sind.

## 4. Unveränderliche fachliche Regeln

1. Fehlende oder unvollständig geprüfte Evidenz ist kein `Nein`, sondern
   `UNKNOWN` beziehungsweise `NOT_DETERMINABLE`.
2. Eine bedingte Formulierung beweist nicht, dass die Leistung tatsächlich
   vereinbart wurde.
3. Ein enger Objekt-, Gefahren-, Varianten- oder Klauselscope darf nicht auf
   einen allgemeineren Scope übertragen werden.
4. Unterschiedliche Objekte, Gefahren, Rollen, Varianten oder
   Geltungsbereiche sind nicht automatisch widersprüchlich.
5. Ein echter Widerspruch erfordert gegensätzliche aktive Fakten desselben
   Scopes, die nicht durch Dokumentrang oder Ersetzung aufgelöst werden.
6. Aufzählungen und mit `und` verbundene Anforderungen werden atomar getrennt.
   Teilbelege dürfen nicht zur vollständigen Bejahung hochgestuft werden.
7. Betrag, Prozentsatz, Dauer und Bedingung müssen an die richtige Faktrolle
   und Klausel gebunden bleiben.
8. Ein vollständiger kontrollierter Nulltreffer wird getrennt von seiner
   fachlichen Wirkung gespeichert. Nicht zertifizierte Suchpläne enden als
   `NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH` und dürfen nur einen neutralen
   Dokumentationsunterschied begründen. Ein serverseitig qualifiziertes
   `NOT_FOUND_AFTER_COMPLETE_SEARCH` bleibt auf Faktenebene `UNKNOWN` und darf
   nur für ausdrücklich freigegebene, versionierte positive
   Schutz-Suchverträge als `ASSUMED_NOT_INCLUDED_V1` in eine punktweise
   Vergleichsannahme eingehen. Ein ausdrücklicher Ausschluss ist damit nie
   belegt.
9. Hauptpolizze, Bedingungen und Nachträge bleiben getrennte Dokumentfakten,
   bis Rang, Geltung und Ersetzung geklärt sind.
10. Quellen, Seiten, Werte und Ergebniszeilen gehören dem Server. Das Modell
    darf nur begrenzte bekannte Kandidaten klassifizieren und nichts erfinden.
11. Ein globales Top-N ist kein Vollständigkeitsbeweis für ein mehrteiliges
    Dokumentpaket.

## 5. Generalisierungsvertrag gegen Überanpassung

Jede Änderung muss einen wiederverwendbaren fachlichen Vertrag implementieren,
nicht nur einen Satz eines bekannten Dokuments reparieren. Zulässige
Abstraktionen sind beispielsweise:

- benanntes Einzelobjekt gegenüber allgemeiner Objektgruppe;
- allgemeiner Gefahrenscope gegenüber enger Zusatzdeckung;
- aktive Vereinbarung gegenüber bedingter oder optionaler Klausel;
- Deckung gegenüber Limit, Selbstbehalt, Kosten, Dauer oder Obliegenheit;
- Hauptvertrag gegenüber Nachtrag, Version und ersetzender Regel;
- vollständige Anforderung gegenüber mehreren getrennten Komponenten.

Versicherername, physische Seitennummer und exakter Kundenwortlaut dürfen in
Regressionstests und Diagnosen vorkommen. Sie dürfen niemals die alleinige
Produktionsregel sein.

Ein dokumentbezogener Fix erhält erst dann den Status einer allgemeinen
Verbesserung, wenn mindestens folgende Prüfungen bestanden sind:

1. bekannte LF-Regression;
2. bekannte WEVIG-Regression, sofern der Sachverhalt dort vorkommt;
3. synthetische positive Formulierungsvarianten;
4. synthetische negative und adversariale Varianten;
5. angrenzende Kategorien und Rollen ohne Regression;
6. mindestens ein zuvor nicht zum Tuning verwendetes Versicherer- oder
   Dokumentformat, sobald entsprechendes Material verfügbar ist.

Wenn nur 1 bis 4 bestanden sind, ist das Ergebnis ein kontrollierter
Entwicklungsfortschritt. Ohne Punkt 6 ist die externe Generalisierung weiterhin
`NICHT BEWIESEN`.

## 6. Bedeutung des 99-Prozent-Ziels

99 Prozent sind ein gewünschtes messbares Qualitätsziel für einen klar
definierten unterstützten Dokumentbereich, keine heutige Zusage für jedes
beliebige PDF.

Die Behauptung ist erst zulässig, wenn eine versionierte, fachlich gelabelte
und zuvor unbekannte Holdout-Sammlung mehrerer Versicherer und Dokumentarten
vorliegt. Gemessen werden mindestens:

| Messachse             | Was exakt stimmen muss                                         |
| --------------------- | -------------------------------------------------------------- |
| Requirement-Abdeckung | jede der erwarteten Zeilen terminiert                          |
| Fakten-Recall         | alle im Oracle vorhandenen relevanten atomaren Fakten gefunden |
| Fakten-Präzision      | keine erfundenen oder falsch zugeordneten Fakten               |
| Deckungswirkung       | included/excluded/conditional/option/unknown korrekt           |
| Scope und Komponenten | richtiges Objekt, richtige Gefahr und richtige Variante        |
| Werte und Rollen      | Betrag, Prozent, Dauer und Bedingung korrekt gebunden          |
| Paketlogik            | richtiges Dokument, Rang, Version und Ersetzung berücksichtigt |
| Provenienz            | physische Seite und exakter Quellspan rekonstruierbar          |
| Stabilität            | wiederholte Läufe ändern keine serverbestimmten Fakten         |
| Laufzeit/Betrieb      | kompletter Lauf besteht Zielhardware- und Fehlerpfade          |

Ein korrektes `Nicht feststellbar` bei fehlender oder uneindeutiger Evidenz ist
eine richtige Antwort. Eine selbstsichere, unbelegte Ja-/Nein-Antwort ist ein
Fehler. Formale Zeilenzahl, Promptkonformität oder ein erfolgreicher Modellcall
sind keine fachliche Genauigkeitsmetrik.

Bis dieses Holdout-Gate besteht, ist die korrekte Formulierung:

```text
Ziel: >= 99 % auf dem definierten unterstützten Dokumentkorpus
Stand: noch nicht bewiesen; menschlicher Review für offene/ambige Fälle
```

## 7. Belegter Stand am 31. August 2026

### Implementiert und positiv belegt

- kanonische physische PDF-PageMap und seitengebundene Dokumentartefakte;
- fünf produktive Kundenansichten mit 224 IDs im Profil
  `CUSTOMER_CORE_5_V2`;
- acht erhaltene Full-Draft-Kataloge mit 533 atomaren Komponenten und
  Promptparität; HP, VB und WE sind keine produktiven Kundenansichten;
- occurrence-genaue Kandidatenvorbereitung und servergebundene Evidenzbausteine;
- gemeinsamer kontrollierter Evidenzpfad für alle acht Ansichten; die
  RC33-Vollregression erzeugte auf LF und WEVIG 640/640 Zeilen mit 32
  dokumentierten Statusverbesserungen und keiner Statusverschlechterung
  gegenüber den eingefrorenen früheren Kontrollläufen;
- exakter WEVIG-Vollvergleich V3.2.1 gegen RC33 über 320/320 Zeilen; die 99
  geänderten Zeilen belegen einen Fehlertypwechsel, aber keine Qualitätsquote;
- R1-Konzeptgruppen gewinnen lexikalisch unbekannte LW-Wortlaute als enge
  Kandidaten zurück, ohne `LW-31` wieder fälschlich zu aktivieren;
- V3.3.1 verwendete breite `3000/250`-Chunks und Dinghy ausschließlich als
  Navigation zu exakten Hybridspans; auf WEVIG/Qwen 27B wurde nur `HP-12`
  korrigiert. V3.5.0 entfernt diesen produktiven Embeddingfallback zugunsten
  eines einzigen Qwen-3.6-Modellzustands; die HP-12-Nichtregression ohne
  Dinghy ist deshalb wieder ein offenes Abnahmegate;
- der begrenzte LF-/WEVIG-VS-Modellvergleich belegt für Qwen 3.6 gegenüber
  Qwen 3.8 eine 5,02-fache Geschwindigkeit (219,324 statt 1.101,400 Sekunden)
  und 72/72 Kernzeilen gegen die akzeptierte RC33-VS-Basis;
- der persistente technische A/B-Vergleich nimmt je Paket bis zu neun private,
  nicht indexierte PDFs auf, erhält Rolle und Geltungsstatus pro Dokument und
  erzeugt aus dem produktiven Fünf-Kategorien-Profil eine UI- sowie
  Einblatt-XLSX-Gegenüberstellung;
- Ergebnisschema V2 ergänzt eine servereigene, punktweise und fail-closed
  Entscheidungsschicht. Sie darf Vorteile nur aus vollständigen atomaren
  Fakten mit übereinstimmendem Vergleichsscope und versionierter Regel
  ableiten; fehlender Beleg bleibt `UNKLAR`, und es gibt keinen
  Gesamtsieger;
- der frische LF-gegen-neun-WEVIG-Lauf auf dem Mac Studio verarbeitet 10/10
  Dokumente und 80/80 Dokument-Kategorie-Schritte zu 320/320 Zeilen; der
  bedingungssichere RC2-Replay liefert 0 `VORTEIL_A`, 0 `VORTEIL_B`, 4
  `GLEICHWERTIG`, 11 `NICHT_VERGLEICHBAR` und 305 `UNKLAR`;
- Bedingungen und Rückausnahmen im lokalen, an den Quellspan gebundenen
  Klauselkontext sperren Vorteil und Gleichwertigkeit fail-closed; auf den
  beiden gespeicherten Vollartefakten korrigiert dies `LW-22`, `ST-16` und
  `HP-26`, ohne die reine Gefahren-Definition `FE-A04` zu sperren;
- 94 Jest-Suites mit 1.098 Tests unter der gebündelten Node-22-Runtime
  bestanden für V3.3.1; der additive Punktentscheidungsstand besteht auf dem
  Mac Studio 90 Suites mit 1.039 Tests unter Node 18 sowie den
  Frontend-Produktionsbuild.

Diese Aussagen gelten für die dokumentierten Fixtures, Artefakte und Gates.
Eine abschließende fachliche Freigabe oder allgemeine 99-Prozent-Aussage folgt
daraus nicht.

### Teilweise belegt

- die Full-Draft-Kataloge und vollständigen Läufe beweisen ID-, Reihenfolge-
  und technische Pfadabdeckung, aber noch keine vollständige Semantik,
  Wertbindung oder Fachrichtigkeit;
- der semantische Hybridfallback ist technisch allgemein, fachlich produktiv
  aber zunächst nur für die zwei Komponenten von `HP-12` aktiviert;
- LF und WEVIG decken zwei wichtige Dokumentformen ab, sind aber kein
  unabhängiges Mehrversicherer-Holdout.

### Noch offen

- die fachliche Expertenabnahme der fünf produktiven Ansichten und aller 224
  sichtbaren Zeilen; historische Acht-Kategorien-Läufe bleiben gesonderte
  Versuchsevidenz;
- Paketlogik mit einem, drei und neun Dokumenten einschließlich Nachträgen,
  Rang, Version und Ersetzung;
- strukturierte Überschriften-, Klausel-, Tabellen- und Fortsetzungslogik über
  alle relevanten Dokumentlayouts;
- ein vollständiges fachliches Oracle und unbekannte Holdouts mehrerer
  Versicherer;
- ein einmaliger paketweiter Vorbereitungslauf mit Wiederverwendung der Fakten
  für alle Kategorien;
- ein kompletter Lauf auf Zielhardware innerhalb des Laufzeitbudgets;
- ein fachlich freigegebener Veröffentlichungsweg; persistenter Ein-Klick-Job,
  content-addressed Resume, Progress, Cancel und privater Ergebnisdownload
  sind im A/B-MVP technisch umgesetzt, benötigen aber noch die frische
  Release-Candidate-End-to-End-Abnahme.

## 8. Was der LF-Gesamtlauf bewiesen hat

Der Lauf `LF-ALL-CATEGORIES-27B-RC4-20260828-180411` erzeugte zwar alle 320
Zeilen, verwendete aber achtmal den alten monolithischen
`pdfProvenanceLiveRun.cjs`. Der Ordnername `RC4` bezeichnete den installierten
Softwarestand, nicht den neuen Evidenzpfad für alle Kategorien.

```text
320/320 Zeilen erzeugt
124/320 formal sauber
196/320 mit mindestens einer formalen Vertragsabweichung
101 nicht seitengetreue Zitate
115 unzulässige Missing-Formulierungen
2:06:58 Stunden Wandzeit
292.732 Tokens
```

Alle 31 Seiten und 38 Chunks waren jeweils vorhanden. Hauptursache war daher
nicht die PDF-Erfassung, sondern die monolithische Schlussfolgerung und freie
Ausgabe: Scopeübertragung, Aktivierung bedingter Klauseln, falsche
Rollen-/Wertbindung und Verlust einzelner Komponenten.

Entscheidung: Dieser Lauf ist die eingefrorene alte Gesamtbaseline und ein
`NO-GO` für weitere identische Großläufe. Er ist kein Test des neuen
All-Kategorien-Zielwegs.

## 9. Entwicklungs- und Abnahmereihenfolge

1. Dokumentpaket einmal vorbereiten und Fakten/Evidence-Spans
   ansichtenübergreifend wiederverwenden.
2. Den bereits belegten VS-Vertrag als Referenzimplementierung stabil halten.
3. Jeweils eine weitere Kategorie als kleinen End-to-End-Vertical-Slice auf
   dieselbe allgemeine Fakten- und Scope-Infrastruktur bringen. `ST` ist wegen
   der belegten Scopefehler ein sinnvoller nächster Kandidat, aber kein
   LF-spezifisches Tuningprojekt.
4. Jeden Slice gegen LF, WEVIG, synthetische Varianten und verfügbare
   unbekannte Holdouts prüfen.
5. Nach allen fünf produktiven Ansichten Paketläufe mit einem, drei und neun
   Dokumenten sowie Dokumentrang/Nachträgen validieren. Interne HP-, VB- und
   WE-Forschung bleibt ein getrenntes Gate und erweitert nicht still das
   Kundenprofil.
6. Danach den neuen vollständigen Lauf gegen die eingefrorene monolithische
   Baseline vergleichen und Laufzeit, Genauigkeit und Stabilität messen.
7. Erst nach bestandenem Expertenoracle und Holdout-Gate eine fachliche
   Freigabe oder 99-Prozent-Aussage erwägen.

Kleine Schritte bleiben verbindlich. Ein Schritt ist nur dann wertvoll, wenn
er entweder eine allgemeine Systemfähigkeit hinzufügt oder eine allgemeine
Hypothese messbar falsifiziert. Ein ausschließlich dokumentkosmetischer Fix
ist kein Produktfortschritt.

### Stand nach INC-011

Schritt 1 wurde im damaligen Acht-Kategorien-Runner technisch umgesetzt: Er
bereitete ein Dokument einmal vor und verwendete das private Seitenartefakt
für alle acht Ansichten.
ST ist als erster zusätzlicher Vertikalschnitt auf die gemeinsame Rollen-,
Scope-, Wirkungs- und Wertearchitektur gehoben. Die reale LF-Gegenprobe
korrigiert die nachweislich falsche Übertragung einer Schnee-/Eisrutsch-Ausnahme
auf Hagel und Schneedruck; WEVIG belegt, dass der Pfad auch abweichende
Formulierungen und andere Vertragsinhalte verarbeitet.

Die technische Aktivierung von FE, LW, EL, HP, VB und WE ist damit erfolgt.
Ihre Full-Draft-Kataloge sind dadurch jedoch noch nicht fachlich freigegeben.
Der nächste vollständige Zielhardwarelauf ist der erste Gesamtvergleich des
neuen Evidenzwegs gegen die eingefrorene monolithische 320-Zeilen-Baseline.

### Stand nach V3.3.1

Der vollständige V3.2.1/RC33-Vergleich und R1 haben den Recall-/Präzisions-
Trade-off konkretisiert. V3.3.1 übernimmt das historische breite Chunking nur
als begrenzte Navigation: Dinghy schlägt Chunks vor, der Server akzeptiert nur
einen exakten zielverankerten Span, und erst die vorhandenen Rollen-, Scope-
und Wirkungsgates dürfen daraus einen Tabellenbeleg machen. Der erste reale
27B-Vertikalbeweis korrigiert `HP-12`, ohne die übrigen 35 HP-Zeilen zu
verändern. Weitere Kategorien werden nicht pauschal aktiviert, sondern nur
mit eigenen fachlichen Verträgen und Negativkontrollen.

### Stand nach V3.5.0

Der produktive Betriebsvertrag lädt nur noch Qwen 3.6 35B-A3B in einer
text-only MLX-Ansicht mit 42.496 Kontext, Parallelität 1, 8-Bit-KV-Cache und
Thinking aus. Die VS-Entscheidung ist für die dokumentierten LF-/WEVIG-
Payloads messbar schneller und gegen die akzeptierte VS-Basis stabil. Weil
Dinghy und damit der HP-12-Hybridfallback entfernt wurden, ist daraus keine
Freigabe weiterer Kategorien ableitbar. Ein vollständiger Lauf des aktuellen
Fünf-Kategorien-Profils, die interne HP-12-Nichtregression und unbekannte
Versicherer-Holdouts bleiben offen.

### Stand nach dem ersten Fünf-Kategorien-Vollvergleich

Der isolierte Mac-Studio-Lauf vom 31. August 2026 verarbeitet mit Qwen 3.6
alle zehn LF-/WEVIG-Dokumente, 108/108 Textseiten, 50/50 Dokument-Kategorie-
Schritte und 224/224 Ergebniszeilen in 27:01,550. Die deterministische
Entscheidungsschicht erzeugt 0 Vorteile A/B und verhindert damit die früheren
Vorteile aus `BELEGT` gegen `UNGEKLÄRT`.

Der Lauf widerlegt jedoch eine fachliche Vollständigkeit der allgemeinen
Negativsuche. Unabhängig geprüfte exakte Klauseln wurden unter anderem bei
`VS-36`, `FE-A10`, `FE-A13`, `LW-13`, `LW-18`, `ST-01`, `ST-08`, `ST-23`,
`ST-25`, `FE-C02`, `FE-D03`, `VS-32` und `EL-12` nicht in den zugehörigen
Nullbefund übernommen. `LW-08` zeigt zusätzlich einen Strukturfehler: Ein
Ausschlussscope wurde über eine neue Überschrift hinweg auf ausdrücklich
versicherte Suchkosten übertragen.

Damit bedeutet „vollständiger kontrollierter Suchlauf“ derzeit ausschließlich
die vollständige Abarbeitung des deklarierten Alias-/Kandidatenplans, nicht
eine vollständige semantische Suche im Dokument. Bis Alias-/Konzeptbreite,
Heading-Reset, allgemeine Vertragsgrenzen und Mehrdokumentrang nachgebessert
und erneut auf Zielhardware auditiert sind, ist der Vollvergleich fachlich
nicht ungeprüft kundenfreizugeben. Der vollständige Befund steht in
`docs/VOLLLAUF_AUDIT_QWEN36_2026-08-31_DE.md`.

Auch der bisher zertifizierte `VS-16`-Pfad ist nach dem Realbefund enger zu
prüfen: `überdachte Abstellplätze` wurde ohne ausreichende Objektbindung zu
Kfz-Stell-/Parkplätzen erweitert, ein 10-Prozent-Limit ging verloren, und die
Punktentscheidung bildet die Katalogpolicy `ANY` nicht konsistent ab. Der
konservative Endzustand `UNKLAR` verhindert zwar einen falschen Gewinner,
heilt aber die unvollständige Tatsachenmaterialisierung nicht.

### Stand nach technischem Deployment V3.5.1

Der kombinierte, vorwärts gerichtete Release `v3.5.1` ist auf dem Mac Studio
installiert. Datenbank, Dokumentbestände, private Vergleichsartefakte und
vorhandene Exporte blieben erhalten; beide Doctor-Läufe, SQLite-Integrität,
Loopback-Dienste und der exakte Qwen-3.6-Vertrag mit 42.496 Kontext bestanden.
Neue fertige Vergleichsarbeitsmappen werden dauerhaft unter
`~/Downloads/Projekt Lokale KI/Vergleiche` archiviert.

Die Installation ändert den fachlichen Beweisstand nicht. Sie stellt den
aktuellen technischen Pfad für weitere Prüfungen bereit; der Full-Run bleibt
wegen der dokumentierten Recall-, Heading-, Komponenten- und Wertbindungsfehler
`NO GO` für eine ungeprüfte Kundenentscheidung.

### Stand nach technischem A/B-MVP

Die bisher manuelle Gegenüberstellung ist als persistente Produktfunktion
umgesetzt. Paket A und B bleiben getrennt, normale Chat-Anhänge können nicht
gleichzeitig verwendet werden, und jedes PDF durchläuft das versionierte
Fünf-Kategorien-Profil. Der serverseitige Rollup erhält Dokumentprovenienz und
markiert ungeklärte Rangfolgen, statt einen Widerspruch oder Vorteil zu
erfinden. Der Einblatt-Export trennt die kundenlesbare Entscheidung von den
privaten Auditdetails. Damit steht die technische Vergleichsgrenze;
Paketpräzedenz, Ersetzung, Laufzeit für große Pakete und fachliche
Holdout-Abnahme bleiben offen. Der genaue Implementierungs- und
Abnahmevertrag steht in
`docs/POLIZZENVERGLEICH_A_B_MVP_DE.md`.

## 10. Wahrheitsquellen für weitere Chats

Vor substanzieller Arbeit sind diese Quellen in dieser Reihenfolge zu prüfen:

1. `AGENTS.md` im V3-Repository für verpflichtende Arbeitsregeln;
2. dieses Dokument für Ziel, Generalisierung und Abnahme;
3. `../policy-project-documentation/POLIZZENVERGLEICH_KB_INDEX.md` als Router
   zu historischem Wissen, Entscheidungen, Fehlern und Experimenten;
4. `docs/POLIZZENANALYSE_IMPLEMENTIERUNGS_TRACKER_DE.md` für den aktuellen
   V3-Inkrement- und Teststand;
5. aktueller V3-Quellcode, Caller und Tests für implementiertes Verhalten;
6. datierte Release- und Run-Berichte für exakt begrenzte Laufzeitevidenz.

Dabei gelten unterschiedliche Wahrheitsebenen:

- Quellcode und Tests: aktueller implementierter Zustand;
- Release-Tag: ausgelieferter Codezustand;
- Run-Bericht: Verhalten genau dieser Umgebung und dieses aktiven Pfads;
- Knowledge Base: Erfahrungen, Entscheidungen, verworfene Ansätze und
  Beweisgrenzen;
- dieses Dokument: verbindliches Zielbild, nicht die Behauptung, es sei schon
  vollständig umgesetzt.

## 11. Kanonische Detailbelege

- Aktueller V3-Inkrement- und Testverlauf:
  `docs/POLIZZENANALYSE_IMPLEMENTIERUNGS_TRACKER_DE.md`
- Vollständige LF-Gesamtbaseline des alten monolithischen Pfads:
  `docs/LF_ALL_CATEGORIES_27B_MONOLITHISCHER_BEFUND_DE.md`
- VS-Qualitätsvergleich V3.2.1 gegen V3.3:
  `docs/VS_01_36_QUALITAETSVERGLEICH_V321_V33_DE.md`
- RC4-Releasevertrag:
  `docs/RELEASE_V3.3.0_RC4_DE.md`
- RC5-Releasevertrag für den gemeinsamen Acht-Kategorien-Evidenzpfad:
  `docs/RELEASE_V3.3.0_RC5_DE.md`
- V3.3.1-Releasevertrag für den evidenzgebundenen Hybridfallback:
  `docs/RELEASE_V3.3.1_DE.md`
- V3.5.0-Modell-, Performance- und Betriebsvertrag:
  `docs/RELEASE_V3.5.0_DE.md`
- Technischer A/B-MVP-Vertrag, Tests und offene Paketlogik:
  `docs/POLIZZENVERGLEICH_A_B_MVP_DE.md`
- Wissensrouter und historische Erfahrungsbasis:
  `../policy-project-documentation/POLIZZENVERGLEICH_KB_INDEX.md`
- Entscheidungen und verworfene Richtungen:
  `../policy-project-documentation/POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md`
- Tests, reale Läufe und Beweisgrenzen:
  `../policy-project-documentation/POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md`
