# Polizzenvergleich V3.9.11

V3.9.11 behebt den fail-closed Restfall aus Batch 55 des bekannten kalten
LF-1+9-A-Laufs mit einer allgemeinen, source-bound Rollenregel.

Der V82-Laufvertrag entfernt eine zusätzliche ungültige
`COVERAGE_EFFECT`-Komponente nur dann, wenn dieselbe Requirement bereits eine
andere wörtlich gültige Deckungswirkung nach dem kanonischen
Manifestvalidator enthält und jeder Quellblock der zu entfernenden Komponente
durch eine andere fachlich passende Komponente erhalten bleibt. Spezifische
bestehende Reparaturen haben Vorrang. Fehlt eine gültige Schwesterwirkung
oder ginge Quellenprovenienz verloren, greift die neue Regel nicht.

Auf dem Mac Studio bestanden die fokussierte Vertrags- und Regressionssuite
mit 426/426 Tests sowie die Prettier-Prüfung. Der unveränderte echte Batch 55
wurde anschließend read-only über 14 Vorgängerwurzeln unter dem V82-Vertrag
revalidiert: 6/6 Units PASS, sechs Vorgängerantworten wiederverwendet, null
Modellaufrufe und null neue Versuche. Die gespeicherten Kundenartefakte wurden
dabei nicht verändert.

Der vollständige Release-Gate, das Kundenupdate und der anschließende Resume
des Produktlaufs sind zum Zeitpunkt dieser Releasevorbereitung noch
ausstehend. Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz und ist kein
unabhängiger Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set:

- `LF-V3911-REDUNDANT-COVERAGE-ROLE-20260918-001`
