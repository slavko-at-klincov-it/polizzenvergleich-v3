# Polizzenvergleich V3.7.1

V3.7.1 ergänzt die zwei getrennten Workspace-Vorlagen um den vollständig
gerichteten LF-IMMO-Referenzvergleich: Das Dokument auf Seite A bestimmt 13
Kategorien, 55 Unterkategorien, 283 atomare Vergleichszeilen und deren
Reihenfolge. Dokumente auf Seite B können ausschließlich Gegenstücke zu
diesen Zeilen liefern; sie erzeugen keine zusätzlichen Ergebniszeilen. Der
bisherige symmetrische 224-Zeilen-Vergleich bleibt unverändert.

Für identische Wiederholungsläufe verwendet der LF-Pfad einen
sitzungsgebundenen, inhaltsadressierten Cache bereits validierter atomarer
Modellantworten. Modell, Prompt, Phase und Laufparameter sind Teil der
Identität, und jeder Treffer wird erneut mit dem aktuellen Parser validiert.
Unbekannte Dokumente werden beim ersten Lauf weiterhin vollständig durch das
lokale Modell geprüft.

Der bekannte 1-A-plus-9-B-Entwicklungsfixture-Replay auf dem Mac Studio
benötigte 123,17 Sekunden, verwendete 610 Cachetreffer und null neue
Modellaufrufe. Er lieferte alle 283 A-Zeilen und eine validierte XLSX. Die
Ergebnisgruppen waren 26 gefunden, 79 teilweise gefunden, null kontrolliert
nicht gefunden, eine referenzseitig unklare und 177 gegenstückseitig unklare
Zeilen.

Diese Messung belegt technische Wiederholbarkeit für bekannte Fixtures. Sie
ist kein Holdout, keine fachliche Vollabnahme beliebiger Versicherer und kein
99-Prozent-Nachweis.
