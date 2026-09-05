# Arbeitsunterbrechung: VS-28 Source-bound Mehrfach-Scope

Stand: 5. September 2026

## 1. Woran gearbeitet wurde

Die Arbeit setzte unmittelbar an dem dokumentierten Ergebnis des vollständigen
Runs auf `d266b48ae943214b4ee29e756b8ae0d49fc5f7ad` an. Dort war `VS-28`
inhaltlich gefunden: Mietverlust und sechs Monate Leistungsdauer waren belegt.
Die Zeile blieb trotzdem `UNKLAR`, weil eine einzige Fundstelle unter der
kombinierten Überschrift Feuer, Sturm und Leitungswasser drei zulässige
Vergleichs-Scopes besitzt, der Prepared-Evidence-Vertrag aber bislang nur einen
singularen `comparisonScopeKey` sicher transportieren konnte.

Ziel dieses kleinen Changes war ausschließlich, eine exakt aus den
Dokumentbytes belegte kombinierte Versicherungsüberschrift als kanonische
Mehrfach-Scope-Menge bis in den Vergleichsatom zu erhalten. Es wurde keine
allgemeine Such-, Alias-, Triage-, Abwesenheits- oder Vorteilsregel gelockert.

## 2. Umgesetzte Änderungen

Der neue Vertrag heißt
`SOURCE_BOUND_MULTI_COMPARISON_SCOPE_SET_V1` und wirkt nur unter folgenden
Bedingungen:

1. Das vollständige Dokumentartefakt ist an Fingerprint, PageMap,
   Worksheet-Grenzen, Dokumentbytes und Offsets gebunden.
2. Die Überschrift erfüllt den bereits eingeführten Vertrag für eine
   zertifizierte kombinierte Versicherungsüberschrift.
3. Die gefundenen Scope-Schlüssel gehören zum zulässigen Narrow-Scope-Vertrag
   der betroffenen Komponente.
4. Der Kandidat ist tatsächlich `NARROW_SCOPE`.
5. Es existiert keine konkretere singuläre lokale Bindung. Eine passende
   Narrow-Alias-Klausel beziehungsweise lokale Scope-Neubindung gewinnt damit
   weiterhin gegen die breitere Sammelüberschrift.

Ohne gebundenes Dokumentartefakt werden weder die neue Vertragsbasis noch
`comparisonScopeKeys` erzeugt. Die frühere rein strukturelle Ambiguität bleibt
in diesem Fall unverändert bestehen.

Die Mehrfachmenge wird anschließend durch folgende Grenzen transportiert und
geprüft:

- Prepared Candidate und deterministisches Prepared Judgement;
- serverseitig rekonstruierte Selected-Source-Provenienz;
- materialisierte Source und Vergleichsatom;
- kanonische Atomprüfung und Ergebnisprofil.

Die Source-zu-Atom-Prüfung arbeitet fail-closed. Sie weist fehlende,
vertauschte, duplizierte oder abweichende Scope-Mengen, eine fehlende oder
falsche Vertragsbasis, gleichzeitige Singular-/Pluralfelder und eine falsche
Candidate-Bindung zurück. Der bestehende Legacy-Fall mit mehreren einzelnen
Narrow-Quellen bleibt erlaubt, wenn deren singuläre Scope-Mengen zusammen
exakt der Atom-Scope-Menge entsprechen.

Das aktuelle Produktprofil wurde deshalb von V108/V69 auf
`CUSTOMER_CORE_5_V109_SOURCE_BOUND_MULTI_COMPARISON_SCOPE_SET` und
Vergleichsvertrag V70 versioniert. V108/V69 bleibt als lesbare historische
Schema-15-Identität erhalten.

## 3. Betroffene Dateien und Abhängigkeiten

Produktionscode:

- `server/utils/policyAnalysis/sourceBoundSectionScopeContract.js`
- `server/utils/policyAnalysis/preparedEvidenceContract.js`
- `server/utils/policyAnalysis/targetedSelectedSourcesContract.js`
- `server/utils/policyComparison/comparisonAtomCanonicalization.js`
- `server/utils/policyComparison/resultBuilder.js`
- `server/utils/policyComparison/productContract.js`

Vertragstests:

- `server/__tests__/utils/policyAnalysis/preparedEvidenceContract.test.js`
- `server/__tests__/utils/policyAnalysis/sourceBoundSectionScopeContract.test.js`
- `server/__tests__/utils/policyAnalysis/targetedSelectedSourcesContract.test.js`
- `server/__tests__/utils/policyComparisonAtomCanonicalization.test.js`
- `server/__tests__/utils/policyComparisonProductContract.test.js`
- `server/__tests__/utils/policyComparisonResultBuilder.test.js`

## 4. Prüfung vor der Unterbrechung

Die fokussierte Prüfung lief ausschließlich auf dem Mac Studio:

```text
Worktree: /Users/michaelmischkot/Code/validation-worktrees/v370-vs28-e491bf64
Ausgangsbasis: e491bf64004aeca09c5a14807af51dc60612e83b
Runtime: Node v22.23.2 über fnm
Ergebnis: 6/6 Jest-Suites, 140/140 Tests PASS
```

Ein paralleler Senior-Review bestätigte Artifact-only-Bindung,
Alias-vor-Mehrfachscope und die Kompatibilität des Legacy-Singular-Unions.
Sein letzter Befund war, auch das rohe Atomarray auf kanonische Reihenfolge und
Duplikatfreiheit zu prüfen. Dieser Befund wurde umgesetzt und durch zusätzliche
Negativtests abgedeckt; die oben genannten 140 Tests liefen danach erfolgreich.
Der angeforderte abschließende Re-Review wurde wegen der Arbeitsunterbrechung
gestoppt.

## 5. Was ausdrücklich nicht mehr durchgeführt wurde

- keine vollständige Serversuite;
- kein Lint, Build, Prisma-, Migrations- oder Installer-Gate;
- kein Artefakt-Replay des realen VS-28-Falls;
- kein neuer 224-Zeilen-Modelllauf;
- kein Vergleich gegen den Favoriten-Report;
- kein Deployment, Merge oder Tag.

Der installierte Kundencheckout
`/Users/michaelmischkot/Code/polizzenvergleich-v3` wurde nicht verändert und
blieb auf `2804fa56361084c0ee74fca6f54ef6365d65aeeb`.

## 6. Sicherer Wiedereinstieg

Der nach dieser Notiz erzeugte Commit ist ein gesicherter Zwischenstand, aber
noch keine Deploymentfreigabe. Beim Fortsetzen ist in dieser Reihenfolge
vorzugehen:

1. exakten Commit in einen frischen isolierten Mac-Studio-Worktree übernehmen;
2. fokussierte Tests wiederholen und vollständige statische Gates ausführen;
3. realen Artefakt-Rebuild/Replay durchführen und prüfen, dass nur die
   erwartete VS-28-Scope-Projektion hinzukommt;
4. erst danach einen frischen vollständigen Fünferlauf starten und alle 224
   Outcomes sowie die neun bestätigten Vorteile gegen den Favoriten-Report
   differenzieren;
5. Ergebnis und Hashes getrennt dokumentieren; erst dann über Deployment
   entscheiden.

`VS-23` ist nicht Teil dieses Changes. Dessen noch offene
`ANY_ALTERNATIVE_SCOPE_DIFFERS`-Modellierung muss als eigener Vertrag und
eigener Commit behandelt werden.
