# Polizzenvergleich V3.6.0 – kontrollierter Paketvergleich

Stand: 3. September 2026

Geplanter Release-Tag: `v3.6.0`

Status: `DEPLOYED_TECHNICAL_CUSTOMER_BUILD`

## Zweck

V3.6.0 fasst den seit V3.5.1 entwickelten paketweiten Vergleichsunterbau in
einem neuen, unveränderlichen Release zusammen. Der Stand bleibt eine
technische Kunden- und Testbereitstellung; er ist keine allgemeine
99-Prozent-Freigabe für beliebige Gebäudeversicherungsverträge.

Enthalten sind insbesondere:

- die kundenlesbare und zeilenweise neu berechnete Reviewmetrik;
- qualifizierte beidseitige Nichtfund-Gleichheit und abgesicherte einseitige
  Richtungsentscheidungen;
- typisierte Vergleiche für ausgewählte Objekt-, Gefahren-, Bedingungs-,
  Limit-, Kosten- und Definitionsfälle;
- sourcegebundene private Audits und Replays gegen Auslassung oder
  Manipulation;
- der aktuelle Produktvertrag
  `CUSTOMER_CORE_5_V103_SPECIALIZED_QUALIFICATION_REPLAY` mit Ergebnisschema
  14;
- die quellgebundene Qualifikationswiedergabe für FE-A01 und FE-C07 sowie der
  normalisierte Worksheet-Trust-Anchor für VS-08;
- die fail-closed abgesicherte Weitergabe enger Scope-Provenienz ohne
  künstliche Scope-Zuordnung bei mehrdeutigen Überschriften;
- weiterhin fünf Kundenansichten mit zusammen 224 sichtbaren Zeilen;
- weiterhin ausschließlich Qwen 3.6 MLX mit 42.496 Token Kontext und
  Parallelität 1 im produktiven Pfad.

## Release- und Sicherheitsvertrag

Der Release darf erst veröffentlicht und installiert werden, wenn derselbe
Code-Commit auf dem Mac Studio folgende Gates bestanden hat:

1. Repository-, Format-, Syntax-, Installer- und Updaterverträge;
2. vollständige relevante Unit- und Integrationsregression;
3. Produktionsbuild des Frontends;
4. gezielte FE-A01-, FE-C02- und FE-C07-Entscheidungs-, Qualifikations- und
   Auslassungsreplays sowie die VS-08-Worksheet-Trust-Anchor-Prüfung;
5. frischer Zehn-Dokument-/224-Zeilen-Vollvergleich mit unabhängig neu
   berechneten Kundenmetriken und Vergleich gegen den Favoritenlauf
   `PAV8-03D-VS14-2D964B45-20260902-073000`;
6. unveränderlicher annotierter Tag auf demselben, nach `main`
   fast-forwardeten Commit;
7. externe Sicherung, offizieller Updater, Doctor, Datenintegrität,
   Bestandserhalt und Dienstprüfung.

Der Doctor akzeptiert V3.6.0 nur, wenn der annotierte Tag `v3.6.0` exakt auf
den installierten `HEAD` zeigt. Ein ungetaggter, leichtgewichtiger oder auf
einen anderen Commit zeigender Stand ist nicht releasekonform.

## Ausgangs- und Rückfallpunkt

Vor der Aktivierung bleibt der Kundenstand unverändert:

```text
Installation: /Users/michaelmischkot/Code/polizzenvergleich-v3
Commit: c7d3b16d400ea4d65b558ef091781da5df82d610
Beschreibung: v3.5.1-3-gc7d3b16d40
```

Unmittelbar vor dem Update wird zusätzlich zur internen Updatersicherung eine
externe Sicherung von Storage, SQLite-Datenbank, aktivem Frontend,
Konfiguration, LaunchAgents und vorhandenen Vergleichsexporten erstellt. Bei
einem roten Gate wird weder `main` veröffentlicht noch der Kundenstand
verändert.

## Kandidatenstand vor der finalen Abnahme

Die Release-Codebasis reicht bis `c1dc185cd`. Aktiv sind Produktprofil
`CUSTOMER_CORE_5_V103_SPECIALIZED_QUALIFICATION_REPLAY`, Vergleichsvertrag
V64 und Ergebnisschema 14. Der erste frische vollständige 224-Zeilen-Lauf auf
`35308a11a` war technisch vollständig, aber fachlich kein Release-GO. Seine
Ergebnisverteilung war 5 Vorteile A, 5 Vorteile B, 34
Dokumentationsunterschiede, 120 Gleichwertigkeiten, 10 nicht vergleichbare und
50 unklare Zeilen bei 50 Kundenreviews. Der Lauf dauerte 29 Minuten und 35
Sekunden reine Workerzeit.

Der unabhängige Diff fand vier Replay-Regressionen durch widersprüchliche
Heading-Offets (`EL-07`, `EL-11`, `EL-13`, `VS-24`) und einen bereits zuvor
vorhandenen falschen Vorteil bei `FE-A09`. Die folgenden Forward-Fixes wurden
deshalb vor jeder Veröffentlichung ergänzt:

- `7a45a4c09` richtet getrimmte Headingtexte und sourcegebundene Offsets aus;
- `df0ad7fac` dedupliziert Überschriften anhand desselben normalisierten
  Startoffsets;
- `78bce51c3` bindet numerische Gefahrenfelder an den kleinsten gültigen
  lokalen Gefahrenkontext und verhindert die Zuordnung eines HQ30-Limits zu
  Erdbeben;
- `a075bc564` bis `53dd4c2bc` verlangen für `FE-A09` einen echten
  Heizungs-, Gas- oder Feuerungsanlagen-Scope und versionieren FE-Katalog,
  Trust-Anker und Produktvertrag;
- `a7510e2db` und `c1dc185cd` führen für `EL-13` ein side-neutrales,
  sourcegebundenes Objekt-Scope-Identity-Gate ein. Unterschiedliche
  Objektumfänge werden nicht mehr als gleichwertig dargestellt; ohne
  vollständige Provenienz bleibt der Vergleich fail-closed.

Die fokussierten Mac-Studio-Gates bestanden zuletzt mit 130/130, 243/243 und
315/315 Tests. Ein frischer vollständiger 224-Zeilen-Lauf auf dem
abschließenden Dokumentationscommit steht noch aus. Bis zu dessen erfolgreicher
Abnahme bleibt der Status `RELEASE_CANDIDATE_IN_VALIDATION`; es gibt noch keine
Deploymentfreigabe.

## Abnahmeprotokoll

Exakter Release-Commit, Testzahlen, Laufzeit, Ergebnisverteilung,
Artefakthashes, Backup-Pfad, Doctor- und Deploymentbefund werden nach den
tatsächlichen Prüfungen in einem getrennten, append-only
Deployment-Dokumentationscommit festgehalten. Der zuvor vollständig geprüfte
und veröffentlichte Release-Tag wird dafür niemals verschoben. Bis zu diesem
Nachweis ist dieses Dokument ausdrücklich keine Deploymentfreigabe.

## Finales Abnahme- und Deploymentprotokoll

V3.6.0 wurde am 3. September 2026 nach einem frischen vollständigen Lauf auf
dem Mac Studio technisch freigegeben und über den offiziellen Updater auf dem
Kundenstand installiert. Der unveränderliche annotierte Tag zeigt auf exakt
denselben Commit, der alle statischen und dynamischen Gates bestanden hat.

```text
Release-Commit: 2804fa56361084c0ee74fca6f54ef6365d65aeeb
Tag: v3.6.0
Tagobjekt: 5f0bab6757fd8c383db1f7a1c71ca69de38364d9
Installation: /Users/michaelmischkot/Code/polizzenvergleich-v3
Vorheriger Stand: c7d3b16d400ea4d65b558ef091781da5df82d610
Mac-Studio-QA-Checkout: /private/tmp/pv3-v360-8546057c.J8oNuw/repo
QA-Root: QA/RELEASE-V3.6.0-FULL-2804FA56-20260903-182148
Session: 27918d93-4f0d-47a5-88a7-c13e418b05e5
Modell: qwen/qwen3.6-35b-a3b
Kontext / Parallelitaet: 42496 / 1
Workerzeit: 29:06,430
Dokumente / Kategorien / Zeilen: 10 / 50 / 224
```

Die vollständige Mac-Studio-Regressionsprüfung auf demselben Commit bestand
mit 162 von 162 Testsuites und 2162 von 2162 Tests. Zusätzlich bestanden
Lint, macOS-Installerverträge und der Frontend-Produktionsbuild. Der frische
Vollrun ergab:

| Kundenergebnis              | Zeilen |
| --------------------------- | -----: |
| Vorteil A                   |      5 |
| Vorteil B                   |      4 |
| Dokumentationsunterschied   |     34 |
| Gleichwertig                |    125 |
| Kein dokumentierter Vorteil |      0 |
| Nicht vergleichbar          |     13 |
| Unklar / Kundenreview       |     43 |

Gegen den unmittelbar vorherigen frischen Lauf auf `35308a11a` sank der
Kundenreview von 50 auf 43. Die neun bestätigten Vorteile blieben exakt
erhalten. Der falsche Vorteil `FE-A09` wurde zu `GLEICHWERTIG` korrigiert;
`VS-24` wurde wieder korrekt gleichwertig; `EL-07` und `EL-11` wurden korrekt
nicht vergleichbar; `EL-13` wurde wegen unterschiedlicher sourcegebundener
Objektumfänge nicht vergleichbar. `EL-06`, `EL-09` und `EL-10` wurden ohne
Reviewregression korrekt gleichwertig. Gegen den früheren Favoriten sank der
Kundenreview von 69 auf 43. Es gab weder eine Favoriten- noch eine
Replay-Regression von einer abgeschlossenen Zeile zu Kundenreview und keinen
neuen Vorteil, der einen zusätzlichen Quellenaudit erfordert hätte.

Der unabhängige Ergebnisvalidator bestätigte exakt 224 eindeutige Schlüssel,
die Kategorieverteilung 36/80/36/36/36, dieselben zehn Eingabedokumente und
den Kundenmetrikvertrag V2. Der separate XLSX-Audit bestätigte ein Blatt,
225 Zeilen einschließlich Header, 17 Spalten und keine Abweichung in den
224 mal 17 exportierten Datenzellen.

```text
comparison.private.json:
  82c9d7ee46046eabd2bfba1c483ebee5f8317867d6c07776be1cf5388e106c60
comparison.md:
  8b77d105242a1b0a6f0d5193ab30f0718d4a7b1430d4ef3ef4c8e255524789ed
polizzenvergleich.xlsx:
  9088f78768e2c64d7dad075fa6f1802078639cd1f534065105249f46a81373d3
export.private.json:
  028620d191353c0a746923118f4a6bbf4455943a64fdb4ab6f4aa56700f56fae
Favoriten-/Replay-Audit:
  6f88e0e6ad0f9b1a0fb89235b29e7171579f064e1a5bdf96b61cd6647848882e
XLSX-Audit:
  c1e710ddae5e3dc71cbe0aecb431dee0fd8a7fbecd15b8420302cbf4a62e5fb1
Archivierter Kundenexport:
  /Users/michaelmischkot/Downloads/Projekt Lokale KI/Vergleiche/
  Gesamtvergleich-27918d93-4f0d-47a5-88a7-c13e418b05e5-59d2b5f41787.xlsx
```

Vor dem Update wurde eine externe Sicherung angelegt:

```text
/Users/michaelmischkot/Polizzenvergleich-Backups/
pre-v3.6.0-20260903-185658
```

Die konsistente Sicherungsdatenbank und die installierte Produktionsdatenbank
bestanden `PRAGMA quick_check`. Die Bestandszahlen blieben vor und nach dem
Update identisch: 10 Workspaces, 3 Workspace-Dokumente, 5
Vergleichssessions und 22 Vergleichsdokumente. Alle 23 vorhandenen
Vergleichsexporte blieben erhalten. Der integrierte sowie ein separater Doctor
bestanden. Der installierte Checkout ist sauber und exakt auf `v3.6.0` und
`2804fa563`; Server und Collector laufen ausschließlich auf
`127.0.0.1:3004` beziehungsweise `127.0.0.1:8890`. Ausschließlich
`qwen/qwen3.6-35b-a3b` ist mit 42.496 Token Kontext geladen.

Diese Freigabe belegt die technische Installation und die beschriebenen zehn
Dokumente. Sie ist weiterhin kein Beweis für beliebige Gebäudeversicherer,
unbekannte Holdouts oder das 99-Prozent-Ziel des Produktvertrags.
