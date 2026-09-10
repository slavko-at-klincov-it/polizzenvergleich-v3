# Polizzenvergleich V3.7.4

V3.7.4 trennt im gerichteten LF-Referenzmodus die interne fachliche Analyse
von der Kundendarstellung. Intern bleiben die fünf differenzierten Outcomes
für Diagnose, Audit und Weiterentwicklung erhalten. Neu erzeugte LF-Ergebnisse
zeigen dem Kunden dagegen ausschließlich `Gefunden` oder `Nicht gefunden`.
`Gefunden` bedeutet, dass eine darstellbare Fundstelle oder ein darstellbarer
Inhalt des Gegenstücks vorliegt; es behauptet weder Gleichwertigkeit noch
Versicherungsschutz. `Nicht gefunden` bedeutet nur, dass dieser Lauf keine
robuste Fundstelle darstellen konnte.

Der neue öffentliche Vertrag
`LF_REFERENCE_CUSTOMER_PRESENTATION_V1` wird bereits beim Erzeugen des
privaten Ergebnisses markiert. Dadurch bleiben historische V3.7.3-Ergebnisse
und ihre damaligen XLSX-Dateien unverändert. Die öffentliche LF-API entfernt
interne Outcomes, Regelcodes und Reviewfelder. Oberfläche und 14-spaltiger
LF-Export zählen den sichtbaren Binärstatus aus den tatsächlich darstellbaren
B-Inhalten und B-Fundstellen nach. Die letzte Spalte
`Fachliche Bewertung (manuell)` bleibt leer und für die Prüfung von oben nach
unten vorgesehen.

Die Suchverbesserungen sind als versionierte Discovery-V2-Tranche umgesetzt.
Sie ergänzen eng begrenzte Synonyme und Konzeptsuche für zuvor manuell
bestätigte Fundstellen bei Gebäudezubehör, Photovoltaik, Mess- und
Steuergeräten, Hindernisbeseitigung, Oberflächenschäden, Haftpflicht,
Eigenschäden und zeitlichen Geltungsbedingungen. Zusätzlich wurden drei
getrennte Semantikfehler behoben: lokale Genitiv-Kostenformulierungen,
source-gebundene Kategorien bei dynamischen LF-Anforderungen und die korrekte
Abbildung einer Dauer als Bedingung statt Limit.

Die Regeln bleiben komponentenlokal und fail-closed. Teilweise belegte,
abweichende oder ausgeschlossene Gegenstücke dürfen als Fundstelle sichtbar
sein, werden intern aber nicht zu Gleichwertigkeit hochgestuft. Ein im echten
B01-Dokument gefundener Fehlalarm einer zu breiten Eigenschaden-Suchphrase
wurde vor der Freigabe entfernt. Bloße Tätigkeitsnennungen reichen weiterhin
nicht als Kostenfundstelle.

Am Implementierungsstand bestanden auf dem Mac Studio 37/37 breit betroffene
Server-Suites mit 840/840 Tests sowie die zusätzlichen Candidate- und
Discovery-Verträge mit 77/77 beziehungsweise 6/6 Tests. Echte gezielte
Qwen-Canaries bestätigten die vorgesehenen Fundstellen und die Nullkontrolle.

Der frische symmetrische 1+1-Nichtregressionslauf verwendete exakt ein
LF-Dokument und ein WEVIG-Musterdokument. Er schloss in 16 Minuten und
59,345 Sekunden 2/2 Dokumente und 10/10 Kategorieprüfungen ab. Die 224
eindeutigen Vergleichszeilen zeigen unverändert 13 Vorteile A, einen Vorteil
B, 38 Dokumentationsunterschiede, 126 gleichwertige Punkte, null Punkte ohne
dokumentierten Vorteil, 16 nicht vergleichbare und 30 unklare Punkte;
Kundenreview bleibt 30. Artefaktmanifest und die XLSX mit einem Blatt, 17
Spalten und 224 Datenzeilen bestanden die unabhängige Nachprüfung. Der neue
LF-Kundenmarker ist im symmetrischen Ergebnis erwartungsgemäß nicht vorhanden.

Die vollständigen technischen Release-Gates und der frische LF-1+9-Endlauf
werden vor Tag und Deployment in diesem Dokument mit ihren endgültigen
Artefakt- und Ergebniskennzahlen ergänzt.

Alle Messungen verwenden bekannte LF-/WEVIG-Entwicklungsdokumente. Sie sind
keine fachliche Expertenabnahme, kein unbekannter Versicherer-Holdout und kein
99-Prozent-Nachweis.
