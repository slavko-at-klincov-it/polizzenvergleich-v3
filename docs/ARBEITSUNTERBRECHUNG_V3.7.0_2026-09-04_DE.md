# Arbeitsunterbrechung V3.7.0 am 4. September 2026

## Zweck und verbindlicher Status

Dieses Dokument ist der Wiederaufnahme-Checkpoint für die noch nicht
freigegebene V3.7.0-Kandidatenlinie. Die Arbeit wurde auf ausdrücklichen Wunsch
des Auftraggebers kontrolliert beendet. Es läuft kein Test, kein
Vergleichsworker und kein Deployment. Die Kundeninstallation bleibt auf der
freigegebenen V3.6.0.

```text
Lokaler Arbeitsbranch:       codex/polizzenvergleich-v3
Geprüfter Logik-HEAD:        03c5841558ff3463eabff6ec4db8a9c904bb091a
Remote-Arbeitsbranch:        origin/codex/polizzenvergleich-v3
Checkpoint-Commit:           im Git-Verlauf direkt nach diesem Logik-HEAD
origin/main:                 f31ddcd7bde8f8cd2f7a2bb9dbb0d742a59d8747
Kundeninstallation:         2804fa56361084c0ee74fca6f54ef6365d65aeeb
Kundenversion:               V3.6.0
V3.7.0 gemergt/getaggt:      nein
V3.7.0 deployed:             nein
```

Der Arbeitsbranch war vor dem Anlegen dieses reinen Dokumentationscommits
sauber und vollständig auf seinen Remote-Branch gepusht. Die drei laufenden
Read-only-Agentenaudits wurden kontrolliert unterbrochen. Auf dem Mac Studio
wurden danach weder ein `policyComparisonWorker` noch Test-, Build- oder
Lintprozesse und keine Lockdatei des isolierten Laufs gefunden.

## Implementierter Stand seit `origin/main`

Die Kandidatenlinie enthält zwei getrennte Arbeitsblöcke:

1. den gerichteten LF-IMMO-Referenzmodus mit 35 versionierten Zeilen und
   anschließendem manuellen 35-Zeilen-Audit;
2. die V2-Härtung gegen zu optimistische Null-, Teil- und Vollentscheidungen
   sowie die V3.7.0-Release- und Modusgrenzen.

Die für die letzte Härtungsphase maßgeblichen Commits sind:

```text
57eb33903  unaufgelöste Evidenz von kontrollierten Nullfunden trennen
50ee41568  vollständige Evidenz pro Gegenstückkomponente aggregieren
b12d34d99  Feldwerte an ausgewählte Kandidatenquellen binden
4c5992ad0  Werte auf exakte Klauselkontexte begrenzen
aa50f38b3  Paketkonflikte und unaufgelöste Evidenz erhalten
273c6ce60  LF-Profil, Katalog und Ergebnisvertrag auf V2 versionieren
dd3854b31  Updates bei aktiven Vergleichsworkern sperren
6a752c211  Ergebnis und Sessionmodus verbindlich koppeln
bff715d16  Archivnamen an den Vergleichsmodus binden
02d33c475  konsistenten Workspace-Modus über die API ausgeben
52db4ca8a  Fehler beim Laden der Modusvorlage sichtbar machen
62e4fdef6  V3.7.0-Kandidatenidentität setzen
ace2b626b  historische Resultate ohne Modus nur symmetrisch lesbar halten
580c16cef  V2-Negativsuchvertrag im echten Worksheet-Builder registrieren
03c584155  reale LF-V2-Testfixture mit Release-Fingerprint vervollständigen
```

`580c16cef` und `03c584155` entstanden aus einem echten Vorlauf: Der frische
LF-V2-Lauf brach vor jedem Modellaufruf mit
`NEGATIVE_SEARCH_POLICY_INVALID: RP-01` ab. Ursache war, dass das V2-Profil
bereits `REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V2` verlangte, der produktive
Worksheet-Builder aber nur V1 zuließ. Der Vertrag wurde registriert und der
Regressionstest so erweitert, dass alle zehn generierten LF-Kataloge durch den
echten Worksheet-Builder laufen. Der fokussierte Mac-Studio-Test bestand danach
mit 2/2 Suites und 136/136 Tests.

## Bereits bestandene technische Gates

Im isolierten Mac-Studio-Worktree
`/Users/michaelmischkot/Code/validation-worktrees/v370-final-ace2b626`
bestanden auf `ace2b626b`:

```text
Gesamttests:                 167/167 Suites, 2206/2206 Tests
Laufzeit Gesamttests:        48,255 s
Lint:                        Server, Frontend und Collector PASS
Frontend-Build:              PASS, 6170 Module
Installer-/Updater-Vertrag:  PASS
Prisma validate/generate:    PASS
Frische Datenbank:           42/42 Migrationen, quick_check PASS
Befüllte V3.6-Kopie:         42/42 Migrationen, quick_check PASS
Fremdschlüsselverletzungen:  0
Geschäftstabellen:           35/35 Zeilenzahlen unverändert
```

Die beiden nachfolgenden Commits ändern nur die Registrierung des
LF-V2-Negativsuchvertrags und die dazugehörige Testfixture. Der fokussierte
Test auf dem finalen Logikstand `03c584155` ist bestanden. Der vollständige
statische Gate-Satz wurde nach diesen beiden kleinen Commits noch nicht erneut
ausgeführt und bleibt deshalb offen.

Der historische V3.6-Ergebnisleser wurde zusätzlich mit dem echten
224-Zeilen-V3.6-Artefakt geprüft. Das Resultat blieb exakt 224 Zeilen mit
`5 Vorteil A / 4 Vorteil B / 34 Dokumentationsunterschied / 125 Gleichwertig /
13 Nicht vergleichbar / 43 Unklar beziehungsweise Review`. Ein LF-Leseversuch
wurde wegen des Moduskonflikts erwartungsgemäß abgelehnt.

## Erfolgreicher frischer LF-V2-Lauf

Der frische Lauf wurde nach der Worksheet-Korrektur auf dem exakten Commit
`03c5841558ff3463eabff6ec4db8a9c904bb091a` durchgeführt. Er verwendete Node
22.23.2, Qwen `qwen/qwen3.6-35b-a3b`, 42.496 Token Kontext, ein A-Dokument und
neun B-Dokumente. Es wurde keine Embeddingphase ausgeführt und kein
Embeddingmodell geladen.

```text
Session:                    c9fefe38-cb55-43fa-8234-b7eb0ff2da87
Status:                     COMPLETED
Run-Verzeichnis:            resume-282d14a6196831124b4acc8d
Fortschritt:                100/100 Dokument-/Kategorieschritte
Resume-Schritte:            0
Laufzeit:                   20:08,371
Kategorien / Zeilen:        10 / 35
A vollständig analysiert:   35/35
B vollständig / teilweise:  12 / 13
kontrollierter Nullfund:     4
B unklar:                   6
Kundenreview:               19
```

Die Partition entspricht der vorab gespeicherten V2-Neuauswertung ohne eine
einzige Abweichung:

```text
Vollständig (12): LF-PR-01, LF-VS-04, LF-KO-01, LF-ST-01, LF-LW-01,
                  LF-LW-04, LF-GL-01, LF-GL-02, LF-HP-01, LF-AV-01,
                  LF-AV-02, LF-AV-03
Teilweise (13):   LF-PR-02, LF-VS-01, LF-VS-02, LF-VS-03, LF-FE-01,
                  LF-FE-03, LF-ST-02, LF-LW-02, LF-LW-05, LF-HP-02,
                  LF-HP-03, LF-OK-02, LF-AV-05
Nullfund (4):     LF-FE-04, LF-ST-04, LF-OK-01, LF-AV-04
Unklar (6):       LF-FE-02, LF-ST-03, LF-LW-03, LF-KO-02, LF-KO-03,
                  LF-GL-03
```

Der unabhängige Ergebnisvalidator bestand. Der XLSX-Export enthält exakt das
Blatt `LF Referenz A nach B` mit 36 Zeilen und elf Spalten. Alle 35 mal elf
Datenzellen stimmen mit dem privaten JSON überein; es gab null Abweichungen.
Die Dokumente stimmen in Reihenfolge, Name, Rolle, Status und SHA mit der
Session überein. Das Ergebnisformat persistiert absichtlich keine zusätzliche
`position` je Dokument; ein Vergleich, der dieses nicht vorhandene Feld
verlangt, ist daher kein valider Metadatenfehler.

```text
QA-Root:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/RELEASE-V3.7.0-GATE-ACE2B626-20260904-113526

Ergebnis-Root:
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/RELEASE-V3.7.0-GATE-ACE2B626-20260904-113526/isolated-storage/policy-comparisons/runs/c9fefe38-cb55-43fa-8234-b7eb0ff2da87/resume-282d14a6196831124b4acc8d/result

comparison.private.json:
574d9f42ac17e096493478e0450f5ee0345a60a1c3a936abd29570bf8fed4272

comparison.md:
4c2757e7664d2df075f37dc54be9f6bc58ad60e39a76b6f4aa4483b3ee0b543f

polizzenvergleich.xlsx:
a408f2e5690dce70fe19851c46cce22dc0e7294c1f6b758cf51eea190fae60fd

Archivexport (hashgleich mit polizzenvergleich.xlsx):
/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/RELEASE-V3.7.0-GATE-ACE2B626-20260904-113526/export/LF-IMMO-Referenzvergleich-c9fefe38-cb55-43fa-8234-b7eb0ff2da87-282d14a61968.xlsx
```

Die exakte Zahl der Qwen-Aufrufe und Token dieses frischen V2-Laufs wurde vor
der Arbeitsunterbrechung noch nicht belastbar aus den privaten Antwortdateien
aggregiert. Hier darf bei der Wiederaufnahme keine Schätzung eingetragen
werden.

## Offene fachliche Einzelquellenaudits

Vor dem Abbruch liefen drei rein lesende Audits. Sie wurden ohne Codeänderung
unterbrochen und sind daher nicht als Ergebnis zu behandeln:

1. `LF-OK-02`: Warum zwei B-Quellen nur `TEILBELEGT` ergeben und ob
   `NARROW_ONLY` eine wiederverwendbare Scope-Typisierung erlaubt.
2. `LF-FE-02` und `LF-ST-03`: Ob die gemeldeten Paketkonflikte durch
   Dokumentrang und Klauselwirkung eindeutig auflösbar sind.
3. `LF-KO-02`, `LF-KO-03`, `LF-LW-03` und `LF-GL-03`: Ob die unaufgelösten
   Kandidaten mit einem allgemeinen semantischen Vertrag entscheidbar sind.

Keiner dieser sieben Fälle darf allein zur Verbesserung der Kennzahl
umklassifiziert werden. Ein Fix ist nur zulässig, wenn Quelle, Rolle, Scope,
Wirkung und Gegenbeispiele einen allgemein gültigen Vertrag belegen. Andernfalls
bleibt die strengere V2-Einstufung das korrekte Resultat.

## Noch nicht ausgeführte Release-Gates

Folgende Arbeiten sind ausdrücklich offen:

1. Qwen-Aufrufe und Token des frischen LF-V2-Laufs belastbar zählen.
2. Die sieben Einzelquellenaudits nacheinander abschließen; pro tatsächlich
   allgemeinem Fix eigener Commit und fokussierter Mac-Studio-Test.
3. Auf dem danach finalen Logik-SHA den kompletten statischen Gate-Satz erneut
   ausführen.
4. Auf genau diesem Logik-SHA einen frischen symmetrischen 224-Zeilen-Lauf
   starten und gegen den V3.6-Favoritenlauf prüfen.
5. Harte Nichtregressionsgrenzen: höchstens 43 Reviewzeilen, keine bisher
   abgeschlossene Zeile wird ohne belegten Grund Review, und die neun
   bestätigten Vorteile bleiben erhalten.
6. JSON, Markdown und XLSX des symmetrischen Laufs unabhängig auf vollständige
   Zeilen- und Zellparität prüfen.
7. Releaseprotokoll V3.7.0 und veraltete V2/V7-Aussagen in Produktcharter und
   Wissensindex aktualisieren.
8. Erst nach grünen Gates über Merge, Tag und Deployment entscheiden.

Der frische symmetrische Vollrun wurde noch nicht gestartet. Das verhindert,
dass ein rund 29 Minuten teurer Lauf auf einem Stand ausgeführt wird, der nach
den Einzelquellenaudits eventuell noch einen kleinen allgemeinen Fix erhält.

## Deploymentgrenze V3.6.0 nach V3.7.0

Der neue Updater enthält eine Quieszenzprüfung. Beim allerersten Sprung von der
installierten V3.6.0 kann jedoch noch der alte V3.6-Updater starten. Deshalb
muss ein später ausdrücklich autorisiertes Deployment vor dem Updater manuell:

1. Server und Collector kontrolliert stoppen;
2. in der Datenbank unabhängig bestätigen, dass kein Vergleich `QUEUED` oder
   `RUNNING` ist;
3. bestätigen, dass kein `policyComparisonWorker.cjs` läuft;
4. erst danach den V3.7.0-Updater ausführen;
5. bei einem Fehler V3.6.0 unverändert wieder starten.

Ohne diesen First-Hop-Preflight darf V3.7.0 nicht deployed werden.

## Sichere Wiederaufnahme

Bei der Wiederaufnahme zuerst den Branch und die drei maßgeblichen Zustände
verifizieren:

```text
lokal:        codex/polizzenvergleich-v3 auf dokumentiertem Checkpoint
remote:       origin/codex/polizzenvergleich-v3 identisch
Kunde:        sauber auf 2804fa563 / V3.6.0
```

Danach ausschließlich lesend prüfen, ob auf dem Mac Studio kein alter Worker
und keine alte Lockdatei aktiv ist. Anschließend die offenen Punkte in der oben
genannten Reihenfolge fortsetzen. Vorhandene Ergebnisartefakte bleiben
unverändert; ein neuer Lauf erhält eine neue isolierte QA-Root- und
Run-Identität.

## Beweisgrenze

Der erfolgreiche 35-Zeilen-Lauf beweist den V2-Vertrag auf dem bekannten
LF-/WEVIG-Entwicklungsset. Er beweist weder Nichtregression der symmetrischen
224 Zeilen noch Generalisierung auf unbekannte Versicherer, beliebige
Gebäudeversicherungspakete oder das 99-Prozent-Produktziel. Deshalb bleibt
V3.7.0 bis zu den offenen Gates ein Kandidat mit Releaseentscheidung `NO-GO`.
