# Releasekandidat V3.7.0

Stand: 4. September 2026  
Status: `RELEASE_CANDIDATE_AWAITING_FINAL_GATES`

## Umfang

V3.7.0 bündelt den versionierten gerichteten LF-A→B-Laufvertrag, die
paket- und dokumenttypneutrale symmetrische Entscheidungsschicht, qualifizierte
Nullfundentscheidungen, die Qwen-only-Laufzeitarchitektur und die seit V3.6
entstandenen fachlichen Forward-Fixes. LF IMMO und WEVIG bleiben bekannte
Entwicklungsfixtures; das Release behauptet weder beliebige
Versichererabdeckung noch 99 Prozent Fachrichtigkeit.

## Sicherheitsvertrag

- Unscopierte Kosten dürfen nicht als Glasbruchkosten gebunden werden; Triage
  und Preparation verwenden denselben servereigenen Vertrag. Häufige
  Singular-, Plural- und Bindestrichformen werden abgedeckt; ein struktureller
  Scope-Hinweis ist nur mit gültiger Seiten-/Offsetbindung beweiskräftig.
- Der engere Sturm-Scope von `LF-GL-02` gilt ausschließlich für
  `solar_glass`, wird im Suchdigest und Vergleichsatom gebunden und besitzt
  eine neue Profil-/Katalogidentität.
- Das Kunden-XLSX muss für jede Zeile dasselbe fachliche Outcome wie die
  private Punktentscheidung darstellen. Freigegebene Regeln sind an zulässige
  Outcomes gebunden; eine Abweichung beendet den Export fail-closed.
- Gezielte QA-Worksheets verwenden
  `QA_TARGET_REQUIREMENT_SELECTION_V2_WORKSHEET_REPLAY`; nachträgliche
  Änderungen des Requirement-/Komponenten-Suchvertrags werden verworfen.
- Ein enger Alias-Scope erhält eine stabile, aus dem versionierten
  Requirement-/Komponentenvertrag abgeleitete Identität. Zwei enge Atome ohne
  kanonische Scope-Identität dürfen nicht als gleichwertig oder als Vorteil
  entschieden werden.
- Der produktive Vergleich verwendet Qwen 3.6 ohne Embeddings oder Hybrid.
- Das aktuelle symmetrische Ergebnisschema ist V15. Es bindet das
  source-verifizierte Produktprofil
  `CUSTOMER_CORE_5_V107_VS22_SOURCE_BOUND_CONTINUATION` mit
  Vergleichsvertrag V68; die vorherigen V105/V66- und V106/V67-Verträge
  bleiben für gespeicherte Schema-15-Ergebnisse lesbar. Der gerichtete Weg bindet
  `LF_IMMO_REFERENCE_35_V5_SOURCE_BOUND_TRIAGE`.
- JSON, Markdown und XLSX werden als ein atomarer, hashgebundener Artefaktsatz
  veröffentlicht. Ergebnis- und Downloadendpunkte akzeptieren den Satz nur
  über die versionierte Export-Hashkette und liefern exakt die geprüften
  Bytes aus.

## Harte Finalgates

Auf genau dem unveränderten Dokumentations-Freeze-SHA müssen bestehen:

1. vollständige Tests, Lints, Frontend-Build und macOS-Installer-/Updatertests;
2. Prisma validate/generate sowie frische und befüllte Migration mit
   `quick_check=ok` und null Fremdschlüsselfehlern;
3. frischer LF-1+9-Lauf mit Prüfung aller 35 Zeilen;
4. frischer symmetrischer 224-Zeilen-Lauf ohne Verlust der neun bestätigten
   Vorteile; die echte Kundenreviewzahl wird zeilenweise berichtet und darf
   nur mit fachlich belegter Ursache von der bisherigen 43 abweichen;
5. unabhängiges Zurücklesen des Kunden-XLSX und zeilenweiser Outcomevergleich
   gegen `comparison.private.json`.

Vor bestandenen Gates gibt es kein Merge, Tag oder Deployment.

## Freeze-Basis vor den Finalgates

```text
Implementierungsbasis vor Dokumentations-Freeze:
c839a28342b619aa3dcc166d32cf9a7e725ea036

Mac-Studio-Checkout:
/Users/michaelmischkot/Code/validation-worktrees/v370-final-ace2b626

Node:                       22.23.2
Jest:                       171/171 Suites, 2317/2317 Tests PASS
Lint:                       PASS
Frontend-Produktionsbuild:  PASS
Prisma validate/generate:   PASS
Migration leer/befüllt:     42/42, quick_check=ok, 0 FK-Fehler
macOS-Installerverträge:    PASS
```

Diese Werte sind die Vorprüfung der Implementierungsbasis. Der Commit dieses
Dokumentations-Freeze wird anschließend als exakter Finalgate-SHA verwendet;
auf ihm werden alle statischen Gates und beide Modellläufe erneut ausgeführt.
Die signierten QA-Manifeste sind die unveränderliche Laufdokumentation, damit
der geprüfte Git-SHA nicht nachträglich durch das Eintragen seines eigenen
Hashes verändert werden muss.

Der erste LF-Versuch auf dem Freeze `2309a52f4` deckte vor dem eigentlichen
Gesamtlauf eine Prompt-/Parser-Drift auf: Beide Triage-Prompts verlangten noch
Schema V6, während der source-gebundene Parser V7 voraussetzt. Der Versuch
endete nach zwei Antworten fail-closed und wird nicht gewertet. Der
Forward-Fix aktualisiert beide Promptbeispiele und schützt sie durch einen
gemeinsamen Versionstest; damit ist dieser Commit der neue Finalgate-Freeze.

Der daraufhin vollständige LF-Lauf bestand die unabhängige Artefaktprüfung,
zeigte jedoch bei genau einem unveränderten Kandidaten eine Modellvarianz:
`RH-03` wertete einen LIMIT-Span unter der source-verifizierten
Haftpflichtüberschrift anders als der Vorlauf. Der gerichteten Ansicht `RH`
fehlte – anders als `HP`, `RS` und `RG` – die entsprechende allgemeine
Spartenzuordnung. Der nächste kleine Forward-Fix bindet `RH` deshalb an
`HAFTPFLICHT_INSURANCE` und lehnt fremde Versicherungssparten weiterhin
strict fail-closed ab. Dieser neue Commit ersetzt den vorherigen Freeze; alle
noch ausstehenden Finalgates beziehen sich ausschließlich auf seinen exakten
SHA oder einen späteren, ausdrücklich dokumentierten Nachfolger.

Der frische LF-Nachlauf auf `2ec71e4e6` bestätigte den RH-Scope-Fix für
`RH-03`, deckte aber eine zweite Modellvarianz bei `RH-01` auf: Der
source-verifizierte Satz zur dreifachen Jahreshöchstleistung wurde bei
identischem Kandidaten einmal als passende und einmal als unpassende Rolle
bewertet. Der nächste isolierte Forward-Fix bindet ausschließlich die
vollständige Haftpflicht-Jahresaggregat-Klausel deterministisch und terminiert
ihren Effekt nur bei ausschließlich direkten, vollständig aufgelösten
Kandidaten. Negation, Optionalität, fehlender Summen- oder Jahresbezug und
Fremdsparten bleiben fail-closed. Auch dieser Nachfolger muss sämtliche Gates
erneut auf seinem exakten SHA bestehen.

Der LF-Nachlauf auf `67dcb847a` bestand anschließend mit der erwarteten
Partition 15 vollständig / 15 teilweise / 4 kontrolliert ohne Gegenstück /
0 Referenz unklar / 1 Gegenstück unklar und null XLSX-Zellabweichungen. Der
darauf folgende, semantikneutrale Runner-Fix vervollständigt den seit der
Source-Bindung verpflichtenden `documentArtifact`-Parameter in den manuellen
All-Category-, Hybrid-Shadow- und historischen VS-A/B-Pfaden. Weil auch dieser
Fix den Release-SHA ändert, sind beide Modell-Finalgates auf seinem Nachfolger
erneut erforderlich.

Der LF-Finalgate auf `eb7004273` bestand anschließend in 1.198.772 ms mit
unveränderter 15/15/4/0/1-Partition, genau einer tatsächlich unklaren Zeile,
null XLSX-Zellabweichungen und gültiger Artefakt-Hashkette. Der unmittelbar
darauf gestartete symmetrische Gate brach vor dem ersten Modellaufruf
fail-closed ab: Der nun korrekt weitergereichte Dokumentartefaktvertrag deckte
zwei ältere, intern widersprüchliche Concept-Search-Spans unter 948
historischen Kandidaten auf. Einer verband zwei Geschwister-Listeneinträge;
der andere verband einen echten Deckungs-Governor mit seinem ersten
Listeneintrag.

Der isolierte Forward-Fix filtert Concept-Search-Spans vor der
Überlappungsauswahl gegen ihren source-genauen Strukturkontext. Ein
Einleitungs-Governor darf kontrolliert mit ausschließlich seinem ersten
Listeneintrag verbunden werden; Geschwisterpunkte bleiben getrennte Fakten.
Direkte Aliase und der fail-closed Source-Validator werden nicht gelockert.
Die veränderte symmetrische Suchsemantik ist als V106/V67 versioniert; V105/V66
bleibt als historische Schema-15-Identität lesbar. Der Fix benötigt erneut
fokussierte Mac-Studio-Tests sowie frische LF- und symmetrische Finalgates.

Der modellfreie Neuaufbau des zuerst gescheiterten realen A-Dokuments bestand
danach für alle 224 Anforderungen und 326 erzeugten Fundstellen ohne einen
Source-Range-Fehler. Vor dem Modellgate wurde die einzige Sonderfreigabe weiter
gehärtet: Governor und erster Listeneintrag dürfen nur dann einen gemeinsamen
Concept-Search-Span bilden, wenn die Governor-Zeile bereits durch den
bestehenden semantischen Coverage-Parser exakt registriert ist. Überschriften
und beliebige offene Fließtextsätze können diese Ausnahme nicht mehr auslösen;
der gültige `ST-08`-Fall und die Geschwistergrenze bleiben regressionsgeschützt.

Der vollständige LF-Lauf auf `7ccef337a` bestand anschließend ohne Resume in
1.206.334 ms: 35/35 Zeilen und alle 385 Kundenzellen blieben stabil; nach der
verbindlichen Kundenmetrik ist genau `LF-FE-02 / RF-02` unklar. Der frische
symmetrische Lauf auf demselben SHA terminierte technisch valide in
1.698.241 ms mit 224 Zeilen und null JSON-/XLSX-Abweichungen. Gegen den
bevorzugten Vorlauf änderten sich exakt drei Punktentscheidungen:

- `VS-22` verlor `VORTEIL_A`, weil ein konfliktfreies eingeschlossenes Atom
  mit zwölf direkt gebundenen Sondermüllquellen und einer echten
  Seitenfortsetzung als `GENERAL_AND_NARROW` vorlag, der spezialisierte
  Portfoliovertrag aber ausschließlich `GENERAL` akzeptierte;
- `FE-A10` wechselte von `NICHT_VERGLEICHBAR` zu `UNKLAR`. Der neue Ausgang
  ist fachlich sicherer, weil die alte Entscheidung unterschiedliche enge
  Fahrzeugobjektmengen ohne vollständigen source-bound Scope-Vektor
  verglich; dieser größere Vertrag bleibt offen und wird nicht durch einen
  Release-Bypass ersetzt;
- `FE-D01` blieb `UNKLAR`, verlor aber A-Evidenz, weil eine mehrzeilige
  kombinierte Feuer-/Sturm-/Leitungswasser-/Haftpflichtüberschrift nur über
  ihren Haftpflicht-Suffix klassifiziert wurde. Dieser Heading-Vertrag bleibt
  ein getrennter Forward-Fix.

V107/V68 ergänzt ausschließlich für `VS-22/hazardous_waste` einen
source-bound Cross-Page-Fortsetzungsbeweis. Er bindet Candidate- und
Source-Bijektion, Dokumentfingerprint, Originaloffsets, Text-Hashes, PageMap,
den kanonischen Seitenmarker, seitengenaue Candidate-Kontexte, Paketmanifest,
eine im selben Satzteil an Sondermüll gebundene getrennte positive allgemeine
Quelle und die lokal positive Fortsetzung. Der Atomstatus bleibt ehrlich
`GENERAL_AND_NARROW`; nur Portfolioaudit V3 darf ihn mit gültigem Proof
akzeptieren. Audit V2 und Source-Replay V1 bleiben über den historischen
strikten `GENERAL`-Pfad lesbar. Vor Freigabe sind fokussierte und vollständige
Mac-Studio-Gates sowie ein neuer symmetrischer Lauf auf dem exakten
V107-Commit erforderlich.

Die technischen Mac-Studio-Gates wurden im isolierten Worktree auf
`494f0cb74eed2f2cdfb547b5bab7ccad78e7d061` unter Node `v22.23.2`
bestanden: 5 fokussierte Suites mit 145 Tests, 172 vollständige Suites mit
2.396 Tests, Prettier, Server-/Frontend-/Collector-Lint,
Frontend-Produktionsbuild, Prisma-Validierung/-Generierung,
macOS-Installer-Suite sowie Neu- und Bestandskopie-Migration mit 42/42
Migrationen und stabilen Datenzeilen. Ein vorangegangener ungültiger Versuch
unter ungepinnter Homebrew-Node `v26.7.0` traf ausschließlich die bekannte
`SlowBuffer`-Inkompatibilität einer Alt-Abhängigkeit; der verbindliche
Node-22-Lauf war vollständig grün. Der Real-Artefakt-Replay und der frische
symmetrische 224-Zeilen-Vollvergleich bleiben vor Merge, Tag und Deployment
offen. Die installierte Kundenfassung blieb dabei unverändert auf
`2804fa56361084c0ee74fca6f54ef6365d65aeeb`.

## First-Hop V3.6.0 → V3.7.0

Der installierte V3.6-Updater besitzt noch nicht alle neuen
Quieszenzprüfungen. Vor dem ersten Update müssen Server und Collector gestoppt,
null `QUEUED`/`RUNNING`-Sessions sowie null aktive Vergleichsworker unabhängig
bestätigt und eine vollständige externe Sicherung von Storage, SQLite,
öffentlichen Artefakten, Environments, LaunchAgents und Exporten angelegt
werden. Ein Rollback muss Code und Daten gemeinsam wiederherstellen; ein
Code-only-Rollback gegen migrierte Daten ist unzulässig.
