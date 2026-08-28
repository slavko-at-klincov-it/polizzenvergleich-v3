# Produktziel, Generalisierung und fachliche Abnahme

Stand: 28. August 2026  
Geltung: verbindlicher V3-Produkt- und Entwicklungsvertrag

## 1. Kurzurteil

Das Produktziel ist **keine perfekte Sonderlösung für LF IMMO**. Ziel ist eine
allgemeine, beleggebundene Analyse-Engine für zukünftige
Gebäudeversicherungs-Vertragspakete unterschiedlicher Versicherer.

LF IMMO und WEVIG sind bekannte Entwicklungs- und Regressionsexemplare. Sie
zeigen konkrete Fehler und erlauben reproduzierbare Vorher-/Nachher-Vergleiche.
Ein Erfolg auf diesen beiden Dokumenten allein beweist weder Generalisierung
noch 99 Prozent fachliche Richtigkeit.

Der derzeitige Stand erreicht dieses Gesamtziel noch nicht. Der neue
evidenzgebundene Verarbeitungspfad ist für `VS-01` bis `VS-36` weit
fortgeschritten und auf LF/WEVIG kontrolliert verglichen. Für die anderen
sieben Ansichten ist derselbe vollständige, validierte End-to-End-Pfad noch
nicht vorhanden.

## 2. Verbindlicher Produktumfang

Ein Vertragsdokumentpaket kann aus einem bis zu neun zusammengehörigen
Dokumenten bestehen, etwa Hauptpolizze, Angebot, Rahmenvereinbarung,
allgemeinen und besonderen Bedingungen, Klauselverzeichnis sowie Feuer-,
Sturm- oder anderen Nachträgen.

Die aktuelle Kundenansicht besitzt acht fachliche Kategorien:

```text
VS  Versicherungssumme und versicherte Sachen
FE  Feuer
LW  Leitungswasser
ST  Sturm
EL  Elementar- und Zusatzdeckungen
HP  Haus- und Grundbesitzhaftpflicht
VB  Vertragsbestimmungen
WE  Wohnungseigentum
```

Die ausgelieferten Vorlagen definieren derzeit zusammen 320 sichtbare
Tabellenzeilen. Diese Zeilen sind feste Kunden- und Exportansichten. Sie sind
nicht die interne Faktenstruktur und keine bewiesene Vollständigkeitsgrenze
des Vertragsinhalts.

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
  -> Rollup in VS/FE/LW/ST/EL/HP/VB/WE
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

1. Fehlende Evidenz ist kein `Nein`, sondern `UNKNOWN` beziehungsweise
   `NOT_DETERMINABLE`.
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
8. Hauptpolizze, Bedingungen und Nachträge bleiben getrennte Dokumentfakten,
   bis Rang, Geltung und Ersetzung geklärt sind.
9. Quellen, Seiten, Werte und Ergebniszeilen gehören dem Server. Das Modell
   darf nur begrenzte bekannte Kandidaten klassifizieren und nichts erfinden.
10. Ein globales Top-N ist kein Vollständigkeitsbeweis für ein mehrteiliges
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

| Messachse | Was exakt stimmen muss |
| --- | --- |
| Requirement-Abdeckung | jede der erwarteten Zeilen terminiert |
| Fakten-Recall | alle im Oracle vorhandenen relevanten atomaren Fakten gefunden |
| Fakten-Präzision | keine erfundenen oder falsch zugeordneten Fakten |
| Deckungswirkung | included/excluded/conditional/option/unknown korrekt |
| Scope und Komponenten | richtiges Objekt, richtige Gefahr und richtige Variante |
| Werte und Rollen | Betrag, Prozent, Dauer und Bedingung korrekt gebunden |
| Paketlogik | richtiges Dokument, Rang, Version und Ersetzung berücksichtigt |
| Provenienz | physische Seite und exakter Quellspan rekonstruierbar |
| Stabilität | wiederholte Läufe ändern keine serverbestimmten Fakten |
| Laufzeit/Betrieb | kompletter Lauf besteht Zielhardware- und Fehlerpfade |

Ein korrektes `Nicht feststellbar` bei fehlender oder uneindeutiger Evidenz ist
eine richtige Antwort. Eine selbstsichere, unbelegte Ja-/Nein-Antwort ist ein
Fehler. Formale Zeilenzahl, Promptkonformität oder ein erfolgreicher Modellcall
sind keine fachliche Genauigkeitsmetrik.

Bis dieses Holdout-Gate besteht, ist die korrekte Formulierung:

```text
Ziel: >= 99 % auf dem definierten unterstützten Dokumentkorpus
Stand: noch nicht bewiesen; menschlicher Review für offene/ambige Fälle
```

## 7. Belegter Stand am 28. August 2026

### Implementiert und positiv belegt

- kanonische physische PDF-PageMap und seitengebundene Dokumentartefakte;
- acht feste Kundenansichten mit 320 IDs;
- acht Full-Draft-Kataloge mit 533 atomaren Komponenten und Promptparität;
- occurrence-genaue Kandidatenvorbereitung und servergebundene Evidenzbausteine;
- vollständiger kontrollierter VS-Pfad für 36 Anforderungen auf LF und WEVIG;
- RC4-Replay der echten 27B-Entscheidungen mit `59 BESSER`, `12 GLEICH`,
  `1 UNKLAR`, `0 SCHLECHTER` gegenüber V3.2.1;
- 80 Jest-Suites mit 876 Tests, Lint, Syntaxprüfung und Produktionsbuild für
  RC4 bestanden.

Diese Aussagen gelten für die dokumentierten Fixtures, Artefakte und Gates.
Eine abschließende fachliche Freigabe oder allgemeine 99-Prozent-Aussage folgt
daraus nicht.

### Teilweise belegt

- EL und FE besitzen kontrollierte Pilotfälle, aber noch keinen vollständigen
  freigegebenen End-to-End-Pfad über alle sichtbaren Zeilen;
- die Full-Draft-Kataloge beweisen ID-, Reihenfolge- und Labelabdeckung, aber
  noch keine vollständige Semantik, Wertbindung oder Fachrichtigkeit;
- LF und WEVIG decken zwei wichtige Dokumentformen ab, sind aber kein
  unabhängiges Mehrversicherer-Holdout.

### Noch offen

- der neue evidenzgebundene Pfad für alle acht Ansichten und alle 320 Zeilen;
- Paketlogik mit einem, drei und neun Dokumenten einschließlich Nachträgen,
  Rang, Version und Ersetzung;
- strukturierte Überschriften-, Klausel-, Tabellen- und Fortsetzungslogik über
  alle relevanten Dokumentlayouts;
- ein vollständiges fachliches Oracle und unbekannte Holdouts mehrerer
  Versicherer;
- ein einmaliger paketweiter Vorbereitungslauf mit Wiederverwendung der Fakten
  für alle Kategorien;
- ein kompletter Lauf auf Zielhardware innerhalb des Laufzeitbudgets;
- persistenter Ein-Klick-Job mit Progress, Resume, Cancel und sicherer
  Veröffentlichung.

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
5. Nach allen acht Ansichten Paketläufe mit einem, drei und neun Dokumenten
   sowie Dokumentrang/Nachträgen validieren.
6. Danach den neuen vollständigen Lauf gegen die eingefrorene monolithische
   Baseline vergleichen und Laufzeit, Genauigkeit und Stabilität messen.
7. Erst nach bestandenem Expertenoracle und Holdout-Gate eine fachliche
   Freigabe oder 99-Prozent-Aussage erwägen.

Kleine Schritte bleiben verbindlich. Ein Schritt ist nur dann wertvoll, wenn
er entweder eine allgemeine Systemfähigkeit hinzufügt oder eine allgemeine
Hypothese messbar falsifiziert. Ein ausschließlich dokumentkosmetischer Fix
ist kein Produktfortschritt.

### Stand nach INC-011

Schritt 1 ist technisch umgesetzt: Der neue Runner bereitet ein Dokument
einmal vor und verwendet das private Seitenartefakt für alle acht Ansichten.
ST ist als erster zusätzlicher Vertikalschnitt auf die gemeinsame Rollen-,
Scope-, Wirkungs- und Wertearchitektur gehoben. Die reale LF-Gegenprobe
korrigiert die nachweislich falsche Übertragung einer Schnee-/Eisrutsch-Ausnahme
auf Hagel und Schneedruck; WEVIG belegt, dass der Pfad auch abweichende
Formulierungen und andere Vertragsinhalte verarbeitet.

Die technische Aktivierung von FE, LW, EL, HP, VB und WE ist damit erfolgt.
Ihre Full-Draft-Kataloge sind dadurch jedoch noch nicht fachlich freigegeben.
Der nächste vollständige Zielhardwarelauf ist der erste Gesamtvergleich des
neuen Evidenzwegs gegen die eingefrorene monolithische 320-Zeilen-Baseline.

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
- Wissensrouter und historische Erfahrungsbasis:
  `../policy-project-documentation/POLIZZENVERGLEICH_KB_INDEX.md`
- Entscheidungen und verworfene Richtungen:
  `../policy-project-documentation/POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md`
- Tests, reale Läufe und Beweisgrenzen:
  `../policy-project-documentation/POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md`
