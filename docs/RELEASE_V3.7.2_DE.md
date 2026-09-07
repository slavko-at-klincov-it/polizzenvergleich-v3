# Polizzenvergleich V3.7.2

V3.7.2 verbessert im gerichteten LF-IMMO-Referenzvergleich die Suche nach
Gegenstücken auf Seite B. Eine versionierte, quellgebundene Discovery-Schicht
ergänzt eng abgegrenzte Suchbegriffe und Begriffskombinationen für bestätigte
Fälle, ohne die 283 Zeilen, Kategorien, Unterkategorien oder Reihenfolge der
Seite A zu verändern.

Der Fix deckt Neu- und Konvertierungsanträge, Maklerbetreuung, die
Produktvariante Premiumschutz, beantragte Grundsparten und die
Haftpflicht-Pauschalsumme ab. Ein Deckungsname innerhalb einer Ausnahme zu
einem fremden Ausschluss wird als bloße Referenz behandelt und nicht mehr als
direkter Ausschluss der genannten Deckung. Die Regel ist auf den gerichteten
LF-Pfad und die konkrete Grundspartenanforderung beschränkt.

Auf dem Mac Studio bestanden 187/187 Server-Suites mit 2.499/2.499 Tests und
der vollständige Server-Lint. Der frische 1-A-plus-9-B-Lauf mit
`qwen/qwen3.6-35b-a3b` benötigte 60 Minuten und 59,628 Sekunden. Er
verarbeitete 117/117 Kategorieprüfungen und lieferte 31 gefundene, 79
teilweise gefundene, null kontrolliert nicht gefundene, eine referenzseitig
unklare und 172 gegenstückseitig unklare Zeilen. Gegenüber V3.7.1 wurden fünf
belegte Gegenstücke zusätzlich erkannt.

API-Readback, Artefaktmanifest, Ergebnisdateien und XLSX bestanden die
Integritätsprüfungen. Source-Block-Ledger und Semantic-Requirement-Manifest
blieben bytegleich; alle 283 A-Zeilen blieben strukturell stabil und die
XLSX-Spalten A:G zellgenau unverändert.

Diese Messung verwendet bekannte LF-/WEVIG-Entwicklungsfixtures. Sie ist keine
fachliche Expertenabnahme, kein unbekannter Versicherer-Holdout und kein
99-Prozent-Nachweis.
