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
  `CUSTOMER_CORE_5_V105_SOURCE_BOUND_TRIAGE` mit Vergleichsvertrag V66; der
  gerichtete Weg bindet `LF_IMMO_REFERENCE_35_V5_SOURCE_BOUND_TRIAGE`.
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
   Vorteile und mit höchstens 43 echten Kundenreviews;
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

## First-Hop V3.6.0 → V3.7.0

Der installierte V3.6-Updater besitzt noch nicht alle neuen
Quieszenzprüfungen. Vor dem ersten Update müssen Server und Collector gestoppt,
null `QUEUED`/`RUNNING`-Sessions sowie null aktive Vergleichsworker unabhängig
bestätigt und eine vollständige externe Sicherung von Storage, SQLite,
öffentlichen Artefakten, Environments, LaunchAgents und Exporten angelegt
werden. Ein Rollback muss Code und Daten gemeinsam wiederherstellen; ein
Code-only-Rollback gegen migrierte Daten ist unzulässig.
