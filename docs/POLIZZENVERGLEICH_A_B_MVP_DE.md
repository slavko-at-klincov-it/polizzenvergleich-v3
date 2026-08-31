# Polizzenvergleich A/B – technischer MVP-Vertrag

Stand: 30. August 2026  
Kanonischer Implementierungszweig: `codex/polizzenvergleich-v3`

## 1. Zweck

Der Vergleich ist eine eigene, persistente Produktfunktion unterhalb des
Chat-Eingabefelds. Paket A und Paket B enthalten jeweils ein bis neun PDFs.
Jedes Dokument behält seine Seite, Rolle und seinen Geltungsstatus. Die
Funktion ersetzt den bisherigen manuellen Ablauf „Kategorie einzeln laufen
lassen, Ergebnisse in Excel nebeneinander kopieren und erneut vom LLM
vergleichen“ durch einen reproduzierbaren technischen Job.

Die Funktion ist keine LF- oder WEVIG-Sonderlogik. Sie verwendet für jedes
Quelldokument den aktuellen gemeinsamen Acht-Kategorien-Evidenzpfad und rollt
dessen belegte Ergebnisse anschließend paketweise zusammen.

## 2. Verbindlicher Ablauf

```text
Paket A (1–9 PDFs)          Paket B (1–9 PDFs)
        |                           |
        +-- private Uploadablage ---+
                    |
          Rolle + Geltungsstatus
                    |
       SHA-256-Identitätsprüfung
                    |
    je PDF einmaliger Acht-Kategorien-Lauf
                    |
       dokumentisolierte Ergebnisfakten
                    |
      Paketrollup je sichtbarer Kategorie-ID
                    |
       UI-Tabelle + JSON + Markdown + XLSX
```

Die Uploads liegen unter der privaten Vergleichsablage und werden weder als
normale Chat-Anhänge noch als Workspace-Dokumente indexiert. Der Server
veröffentlicht keine privaten Speicherpfade oder Worker-Manifeste über die
API.

## 3. Dokumentmetadaten

Pro Dokument werden mindestens gespeichert:

- Paketseite `A` oder `B`;
- Rolle: Hauptpolizze, Zusatzvertrag, Nachtrag/Änderung, Bedingungen oder
  Sonstiges;
- Geltungsstatus: vertragswirksam, Rahmenbedingung oder Vorschlag/Angebot;
- Originalname, Größe, MIME-Typ, SHA-256 und stabile Dokumentidentität;
- private Speicherposition und Reihenfolge innerhalb des Pakets.

Diese Metadaten verhindern noch keine fachlich falsche Rangentscheidung. Sie
sorgen dafür, dass die spätere Paketlogik die Dokumente nicht vorher
untrennbar vermischt.

## 4. Vergleichssemantik und Beweisgrenze

Der Paketrollup erhält die dokumentbezogenen Inhalte, Quellen, Rollen,
Geltungsstatus, Deckungswerte und Prüfstati. Mehrere unterschiedliche Werte
werden nicht automatisch als Widerspruch behandelt, sondern mit
`RANGFOLGE_PRÜFEN` markiert. Ein echter bereits im Dokumentlauf ausgewiesener
Widerspruch bleibt sichtbar.

Auch eine nur auf einer Seite belegte Leistung erzeugt keinen automatischen
Vorteil. Der Vergleich unterscheidet technisch:

- beidseitig kein Beleg;
- nur A oder nur B belegt;
- dokumentbezogene Inhalte gleich;
- Inhalte verschieden und fachlich zu prüfen.

Zusätzlich besitzt jede Zeile ab Ergebnisschema V2 eine servereigene
`pointDecision` mit den Zuständen `VORTEIL_A`, `VORTEIL_B`,
`GLEICHWERTIG`, `NICHT_VERGLEICHBAR` und `UNKLAR`. Sie liest nicht die
Anzeigetexte, sondern die bereits erzeugten atomaren Komponenten,
Wirkungsurteile, Geltungs- und Scopebilder sowie typisierten Werte und
servergebundenen Quellen.

Automatisch freigegeben sind derzeit ausschließlich:

- `INCLUDED` gegenüber `EXCLUDED` für dieselbe atomare Deckungskomponente;
- ein höheres gleichartig qualifiziertes Geld-/Prozent-Deckungslimit;
- ein niedrigerer gleichartig qualifizierter Geld-/Prozent-Selbstbehalt;
- echte Gleichwertigkeit vollständig belegter atomarer Fakten.

Jede Seite muss `BELEGT`, vollständig, konfliktfrei, rangaufgelöst und mit
einer gültigen Quelle gebunden sein. Geltung, Scope, Variante, Werttyp,
Einheit, Limitart und Qualifier müssen übereinstimmen. Fehlender Beleg,
`TEILBELEGT`, Bedingungen/Optionen, Rangfragen oder gemischte Gewinner enden
fail-closed `UNKLAR`. Unterschiedliche Vergleichsschlüssel enden
`NICHT_VERGLEICHBAR`. Der frühere technische `outcome` bleibt additiv
erhalten.

Der Status des Gesamtergebnisses bleibt
`TECHNICAL_RESULT_REVIEW_REQUIRED`. Es gibt keinen Gesamtsieger, keinen
Score und keine Addition gewonnener Zeilen zu einer Vertragsempfehlung.

## 5. Bedien- und Betriebsvertrag

- Normale Chat-Anhänge und Vergleichspakete sind gegenseitig gesperrt.
- Ein Lauf ist nach dem Start schreibgeschützt und kann abgebrochen werden.
- Status und Fortschritt bleiben persistent; die UI fragt laufende Jobs
  regelmäßig ab.
- Der Fortschritt zählt in neuen Läufen die abgeschlossenen Kategorien aller
  Dokumente und zeigt aktuelles Paket, Dokument und Kategorie.
- Abgeschlossene Ergebnisse sind in acht UI-Ansichten sichtbar und als Excel
  mit einer Tabelle pro Kategorie verfügbar.
- Ein Lauf setzt nach Prozess- oder Rechnerunterbrechung content-addressiert
  bei der ersten noch nicht abgeschlossenen Kategorie fort, sofern
  Dokumente, Release und Laufvertrag unverändert sind.
- Verwaiste private Vergleichsartefakte werden durch einen eigenen
  Hintergrundjob bereinigt.

## 6. Am Mac Studio belegter Stand

Auf einer vom installierten Kundenstand getrennten Validierungsinstanz wurden
belegt:

- Prisma-Migration und aktuelle Datenbankschemata;
- Server- und Frontend-Lint sowie Frontend-Produktionsbuild;
- gezielte Modell-, Worker- und Ergebnisverträge;
- vollständige bestehende Jest-Regression mit 97 Suites und 1.108 Tests;
- echte LF- und WEVIG-PDFs als Paket A/B mit Rollen- und Statuspersistenz;
- Ablehnung einer ungültigen PDF und Entfernung ihres Uploadrestes;
- Datenbanknachweis `comparison=2`, `indexed=0`, `parsed=0`;
- beide UI-Sperrrichtungen im gebauten Produktionsfrontend;
- vollständiger realer LF/WEVIG-Acht-Kategorien-Vergleich auf Qwen 3.8 27B:
  beide Dokumentläufe mit jeweils 320/320 materialisierten Zeilen;
- gemeinsamer Rollup mit acht Ansichten und 320 Zeilen, davon 132 als
  fachlich prüfpflichtig gezählt;
- Ergebnisverteilung: 188 `BEIDSEITIG_KEIN_BELEG`, 66 `NUR_A_BELEGT`,
  18 `NUR_B_BELEGT` und 48 `UNTERSCHIED_FACHLICH_PRÜFEN`;
- keine privaten Speicherpfade im veröffentlichten Ergebnis;
- XLSX mit acht intakten Arbeitsblättern, 15 Spalten und exakt den erwarteten
  Kategoriezeilen zuzüglich Kopfzeile;
- fertiges Ergebnis im gebauten Produktionsfrontend mit acht Tabs,
  320-Zeilen-Hinweis, aktivem Excel-Download und gesperrtem normalem
  Chat-Upload.

### Punktentscheidung V2

Commit `b761e3c4` ergänzt den technischen MVP additiv. Auf dem Mac Studio
bestanden 90 Jest-Suites mit 1.039 Tests, die fokussierten
Entscheidungsverträge mit 21 Tests, die Prettier-Prüfung und der
Frontend-Produktionsbuild.

Der unveränderte gespeicherte LF-gegen-neun-WEVIG-Lauf wurde mit der neuen
serverseitigen Ergebnisschicht erneut materialisiert, ohne Modellantworten
umzuschreiben:

| Zustand              | Zeilen |
| -------------------- | -----: |
| `VORTEIL_A`          |      0 |
| `VORTEIL_B`          |      1 |
| `GLEICHWERTIG`       |      7 |
| `NICHT_VERGLEICHBAR` |      9 |
| `UNKLAR`             |    303 |

Der freigegebene Vorteil ist `LW-22`: Paket A schließt Schwamm- und
Fäulnisschäden ausdrücklich aus, Paket B schließt beide ein. Die sieben
Gleichwertigkeiten sind `FE-A04`, `FE-A06`, `ST-04`, `ST-06`,
`ST-16`, `ST-26` und `HP-26`. Die strenge Verteilung ist beabsichtigt:
Ein nicht belegter oder nur ähnlich aussehender Tabellenwert darf keine
Vorteilsaussage erzeugen.

JSON verwendet Schema V2. Markdown enthält zusätzlich Prüfstatus und Quellen.
Die bestehenden 15 XLSX-Spalten bleiben in derselben Reihenfolge; angehängt
werden `Punktentscheidung`, `Entscheidungsbegründung` und
`Entscheidungsregel` als Spalten P bis R. Alte Schema-V1-Ergebnisse werden in
der UI unverändert gespeichert und sicher als `UNKLAR` dargestellt.

### Qualifizierter Negativbefund in Ergebnisschema V3

Ab Ergebnisschema V3 sind Faktenwirkung, Suchbefund und Vergleichswertung
getrennte Achsen:

```text
Faktenwirkung:     UNKNOWN
Suchbefund:        NOT_FOUND_AFTER_COMPLETE_SEARCH
Vergleichswertung: ASSUMED_NOT_INCLUDED_V1
```

Der Negativbefund ist nur zulässig, wenn der jeweilige Vergleichspunkt den
Suchvertrag ausdrücklich freigibt, sämtliche bereitgestellten Paketdokumente
verarbeitet wurden, jede physische Seite Text enthält, alle technischen
Kategorie-Gates bestanden sind und jede kontrollierte Komponente ohne
Occurrence, Kandidat, Reject oder ungelösten Treffer serverseitig terminiert.
Alte Artefakte, Bildseiten in gemischten PDFs und nicht freigegebene
Katalogpunkte bleiben `SEARCH_INCOMPLETE` und damit `UNKLAR`.

Freigegebene Regeln:

- `INCLUDED_OVER_ASSUMED_NOT_INCLUDED_V1`: ausdrücklicher Einschluss gewinnt
  punktweise gegen qualifiziertes Nichtfinden;
- `COMPLETE_SEARCH_ABSENCE_BOTH_V1`: beidseitiges qualifiziertes Nichtfinden
  ergibt `KEIN_DOKUMENTIERTER_VORTEIL`, nicht `GLEICHWERTIG`.

Der erste freigegebene Suchvertrag ist `VS-16`. Der kontrollierte Wortschatz
umfasst Garagen, Tiefgaragen, Garagierung, Garagenanlagen, Stell- und
Abstellplätze, Parkplätze, Parkdecks und Carports. Ein roher Stamm wie
`GARAG*` wird nicht verwendet, damit Nachbartreffer wie Garagentor,
Garagenhaftpflicht oder Garagengasse keinen Negativ- oder Positivbefund
verfälschen.

XLSX behält A bis R unverändert und ergänzt S/T um den maschinenlesbaren
Dokumentbefund von Paket A und B. UI und Markdown nennen ausdrücklich, dass
die Annahme nur für das bereitgestellte Paket gilt und keinen ausdrücklichen
Ausschluss belegt.

Der reale Lauf begann am 30. August 2026 um 11:51:02 Uhr und endete um
13:53:36 Uhr (Europe/Vienna). Die gemessene Laufzeit für zwei sequenziell
analysierte Dokumente betrug 2:02:35 Stunden. Damit besteht die technische
End-to-End-Abnahme, das Ziel von ungefähr einer Stunde für diesen
Zwei-Dokument-Vergleich jedoch nicht.

Die 320 Ergebniszeilen sind die vollständige Abbildung der vorgegebenen
Taxonomie, kein Nachweis von 320 gefundenen Leistungen: Im konkreten Lauf
waren bei LF 86 und bei WEVIG 46 Zeilen als `BELEGT` materialisiert. WEVIG-WE
blieb in allen 24 Zeilen ohne belegte Fundstelle. Ob das fachlich vollständige
Abwesenheit oder verbleibender Recall ist, darf ohne Oracle nicht entschieden
werden.

## 7. Offene MVP-Risiken

1. Die allgemeine Rang-, Versions- und Ersetzungslogik für mehrteilige Pakete
   ist noch nicht fachlich implementiert; die Metadaten und der
   Review-Status bereiten sie nur sicher vor.
2. Die Verarbeitung läuft derzeit dokumentweise sequenziell. Ein Paket mit
   bis zu 18 PDFs kann das Ziel von ungefähr einer Stunde deutlich
   überschreiten.
3. Resume ist technisch vorhanden. Noch zu prüfen sind absichtlich
   inkompatible Release-/Dokumentänderungen sowie reale Unterbrechungen mitten
   in unterschiedlichen Dokumentrollen.
4. LF und WEVIG belegen Regression und Integration, nicht beliebige Polizzen
   und nicht das 99-Prozent-Ziel.
5. Die Qualität des Vergleichs kann nie höher sein als die beleggebundene
   Faktenqualität der beiden zugrunde liegenden Dokumentanalysen.
6. `NOT_FOUND_AFTER_COMPLETE_SEARCH` ist derzeit bewusst opt-in und für
   `VS-16` freigegeben. Weitere Punkte benötigen eigene versionierte
   Synonymverträge sowie positive, negative und adversariale Tests.

## 8. Nächste fachliche Gates

1. Den neuen Build als Release Candidate installieren und den vollständigen
   LF-gegen-neun-WEVIG-Lauf frisch ausführen.
2. Paketweite Rang-, Geltungs- und Ersetzungsregeln als atomare semantische
   Verträge implementieren und mit Positiv-/Negativvarianten testen.
3. Die neue Punktentscheidung fachlich gegen die erzeugten Quellen und
   insbesondere `LW-22` abnehmen.
4. Laufzeit durch paketweite Wiederverwendung und gezielte Parallelisierung
   reduzieren, ohne Modell- oder Evidenzpfade unkontrolliert zu vermischen.
5. Erst danach unbekannte, fachlich gelabelte Versicherer-Holdouts für eine
   messbare Genauigkeits- oder 99-Prozent-Aussage verwenden.
