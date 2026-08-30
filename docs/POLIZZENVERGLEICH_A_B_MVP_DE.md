# Polizzenvergleich A/B – technischer MVP-Vertrag

Stand: 30. August 2026  
Implementierungszweig: `codex/policy-comparison-mvp`

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

Der Status des Gesamtergebnisses lautet deshalb
`TECHNICAL_RESULT_REVIEW_REQUIRED`. Dokumentrang, Ersetzung, Vertragswirkung
und der fachliche Vorteil bleiben prüfpflichtig, solange sie nicht durch eine
eigene allgemeine Paketregel belegt sind.

## 5. Bedien- und Betriebsvertrag

- Normale Chat-Anhänge und Vergleichspakete sind gegenseitig gesperrt.
- Ein Lauf ist nach dem Start schreibgeschützt und kann abgebrochen werden.
- Status und Fortschritt bleiben persistent; die UI fragt laufende Jobs
  regelmäßig ab.
- Der Fortschritt zählt in neuen Läufen die abgeschlossenen Kategorien aller
  Dokumente und zeigt aktuelles Paket, Dokument und Kategorie.
- Abgeschlossene Ergebnisse sind in acht UI-Ansichten sichtbar und als Excel
  mit einer Tabelle pro Kategorie verfügbar.
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
3. Resume nach Prozess- oder Rechnerabbruch fehlt; Cancel und erneuter Start
   sind vorhanden.
4. LF und WEVIG belegen Regression und Integration, nicht beliebige Polizzen
   und nicht das 99-Prozent-Ziel.
5. Die Qualität des Vergleichs kann nie höher sein als die beleggebundene
   Faktenqualität der beiden zugrunde liegenden Dokumentanalysen.

## 8. Nächste fachliche Gates

1. Ein echtes Mehrdokumentpaket mit Hauptpolizze, Zusatz oder Nachtrag prüfen.
2. Paketweite Rang-, Geltungs- und Ersetzungsregeln als atomare semantische
   Verträge implementieren und mit Positiv-/Negativvarianten testen.
3. Laufzeit durch paketweite Wiederverwendung und gezielte Parallelisierung
   reduzieren, ohne Modell- oder Evidenzpfade unkontrolliert zu vermischen.
4. Erst danach unbekannte, fachlich gelabelte Versicherer-Holdouts für eine
   messbare Genauigkeits- oder 99-Prozent-Aussage verwenden.
