# Polizzenvergleich V3.8.0

V3.8.0 aktiviert für neu gestartete LF-IMMO-Referenzvergleiche den
versionierten Laufvertrag `LF_REFERENCE_A_DRIVEN_V2`. Paket A bestimmt bei
jedem Lauf dynamisch Kategorien, Reihenfolge, fachliche Anforderungen,
Komponenten und sichtbare Ergebniszeilen. Der bekannte 283-Zeilen-Katalog ist
nur noch Regression und niemals Produktionseingang.

Zu jeder dynamischen A-Anforderung durchsucht der Lauf das vollständige
Paket B über lexikalische, strukturelle, rollen- und wertbezogene sowie
Dinghy-Embedding-Kandidaten. Die komponentenweise Qwen-Prüfung, die
Vollkorpus-Abwesenheitsprüfung und der Rescue enden für die Kundenansicht
binär in `Gefunden` oder `Nicht gefunden`. Abweichende Werte, Bedingungen,
Limits, Scopes und ausdrückliche Ausschlüsse bleiben als Unterschiede
sichtbar und ändern den Fundstatus nicht, wenn dasselbe fachliche Element in
B quellengebunden vorhanden ist.

Upload, Queue, Worker, Resume, Ergebnisleser, API, UI und XLSX-Download sind
in demselben Produktpfad verdrahtet. Der Embeddingvertrag ist eine
verpflichtende lokale, absolute und geschützte Konfiguration. Installer und
Doctor prüfen Vertrag, Modell, Dimensionen, Runtime und die lokalen
Artefakthashes fail-closed.

Der bekannte dynamische LF-1+9-Nachweis umfasst:

- 363 dynamisch aus A erzeugte Anforderungen und 1.282 Komponenten;
- 363/363 terminale Kundenzeilen;
- 322 `Gefunden`, 41 `Nicht gefunden`, 0 ungeklärt;
- 199 vollständige, 118 teilweise und 5 gegensätzliche Gegenstücke;
- keine B-only-Zeile;
- 141/144 eindeutig messbare Gold-Übereinstimmungen und 0 False Positives;
- technisch validierte interne XLSX mit 363 Zeilen.

Die verbleibenden Gold-Abweichungen `AV-06` und `AV-22` sind dokumentierte
Korrekturvorschläge am eingefrorenen Gold. `VS-15` ist nicht als Produktfehler
bewiesen. Es wurde keine bekannte Kundenzeile hart codiert.

Dieser Release beweist den dynamischen Ansatz für das bekannte
LF-1+9-Entwicklungsset und erlaubt den kontrollierten Kundenbetrieb. Er ist
kein unbekannter Mehrversicherer-Holdout, kein allgemeiner
99-Prozent-Nachweis und keine Laufzeitzusage für beliebige zukünftige
Dokumentpakete.
