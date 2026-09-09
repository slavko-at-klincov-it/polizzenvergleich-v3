# Polizzenvergleich V3.7.3

V3.7.3 erweitert den gerichteten LF-Referenzmodus zu einem kundenlesbaren,
beleggebundenen Review-Workflow. Der LF-Kundenexport folgt weiterhin exakt den
283 Zeilen, Kategorien, Unterkategorien und der Reihenfolge von Dokument A.
Er zeigt nun Vertragsinhalt, Werte und Fundstellen der B-Gegenstuecke getrennt,
einen kundenlesbaren KI-Fundstatus, einen Pruefhinweis und als letzte Spalte die
leere `Fachliche Bewertung (manuell)`.

Mehrere B-Fundstellen bleiben sichtbar. Abweichende Werte desselben fachlichen
Gegenstands werden als vergleichbare Gegenstuecke mit eigenem Wert dargestellt
und nicht wegen fehlender Wertgleichheit verworfen. Werte und Limits duerfen
nur an ihre belegte Komponente gebunden werden. Verwaiste Limits ohne
belegbaren Gegenstand sowie wirtschaftlich aehnliche, aber fachlich andere
Leistungen erzeugen keinen Treffer.

Ein vollstaendiger, wiederaufnehmbarer Qwen-Einzelaudit verarbeitete alle 79
Teiltreffer des produktiven V3.7.2-Laufs. Alle 79 Antworten waren technisch
gueltig; der Audit bleibt ein getrenntes, beratendes QA-Artefakt und veraendert
das produktive Basisergebnis nicht automatisch. Nach manueller Hochrisiko-
Stichprobe blieben sieben starke Hochstufungskandidaten, 56 Teiltreffer, sechs
nicht entscheidungsreife Fundlagen, sieben weiterhin unklare Faelle und drei
Faelle ohne zusaetzliches Gegenstueck. Zwei maschinell vermutete Widersprueche
und zwei maschinell vorgeschlagene Volltreffer wurden dabei bewusst
zurueckgestuft.

Auf dem Mac Studio bestanden am Implementierungs-HEAD 179/179 Server-Suites
mit 2.442/2.442 Tests, Server- und Frontend-Lint, Frontend-Produktionsbuild und
Installer-Suite. Ein LF-1-plus-9-Evidenz-Replay materialisierte 283/283 Zeilen
mit dem neuen 14-spaltigen Exportvertrag. Ein frischer symmetrischer
1-gegen-1-Modelllauf materialisierte 224/224 Zeilen; Entscheidungen,
Begruendungen und die gesamte XLSX-Zellmatrix waren identisch zum vorherigen
freigegebenen A/B-Lauf.

Das produktive LF-Basisergebnis bleibt 31 gefunden, 79 teilweise gefunden,
null kontrolliert nicht gefunden, eine referenzseitig unklare und 172
gegenstueckseitig unklare Zeilen. Die Messungen verwenden bekannte
LF-/WEVIG-Entwicklungsfixtures. Sie sind keine fachliche Expertenabnahme, kein
unbekannter Versicherer-Holdout und kein 99-Prozent-Nachweis.
