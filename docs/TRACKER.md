# V3 Kurzstatus und Leseführung

Stand: 31. August 2026

> Dieses Dokument ist eine kompakte Orientierung. Verbindlich sind das
> Produktziel, der ausführliche Implementierungstracker, der aktuelle Quellcode
> und die jeweils exakt bezeichneten Laufberichte.

## Aktiver Produktvertrag

- Produktprofil: `CUSTOMER_CORE_5_V2`
- Kundenkategorien: `VS`, `FE`, `LW`, `ST`, `EL`
- Sichtbare Ergebniszeilen: 224 (`36 + 80 + 36 + 36 + 36`)
- Export: ein Tabellenblatt, 17 Kundenspalten
- Laufzeitmodell: `qwen/qwen3.6-35b-a3b`
- Kontext: 42.496 Token
- Parallelität: 1
- Embeddingmodell: kein automatisches Laden im Produktlauf

`HP`, `VB` und `WE` bleiben interne Katalog- und Regressionsevidenz. Sie sind
nicht Bestandteil des aktiven Produktprofils und dürfen durch interne
Katalogpflege weder zusätzlich gestartet noch in Kundenergebnisse gerollt
werden.

## Aktueller Release- und Qualitätsstand

Der installierte Kundenstand ist `v3.5.1` auf Commit `ca2add77`. Er wurde am
Mac Studio technisch abgenommen und bereitgestellt. Das ist keine fachliche
Freigabe beliebiger Ergebnisse.

Der erste vollständige Qwen-3.6-Lauf des Fünf-Kategorien-Profils benötigte
27:01,550. Der faire gemeinsame Laufabschnitt war gegenüber dem historischen
Qwen-3.8-Lauf 5,073-mal schneller beziehungsweise 80,29 Prozent kürzer.
Wegen gleichzeitiger Katalog- und Codeänderungen ist das kein isolierter
Modellbenchmark.

Der Lauf bestand die technischen Mengen- und Quellenprüfungen, erhielt aber
fachlich `NO GO`: Mehrere vorhandene Klauseln wurden von der kontrollierten
Suche nicht gefunden, und einzelne Scope-, Aggregations- und Wertebindungen
waren fehlerhaft. Ergebnisse benötigen weiterhin fachlichen Review.

## Invarianten

1. Fehlende oder unvollständige Evidenz ist nicht automatisch `Nein`.
2. Ein kontrollierter Nulltreffer und seine fachliche Vergleichswirkung sind
   getrennte Zustände.
3. Quellen, Seiten, Werte und Ergebniszeilen werden serverseitig gebunden.
4. Das Modell klassifiziert bekannte Kandidaten; es darf keine Quellen oder
   Werte erfinden.
5. Objekt-, Gefahren-, Rollen-, Varianten- und Dokumentscopes dürfen nicht
   verallgemeinert werden.
6. Ein technisches `PASS` ist kein Beweis allgemeiner fachlicher Richtigkeit.
7. LF IMMO und WEVIG sind Regressionsexemplare, kein Generalisierungsnachweis.
8. Das 99-Prozent-Ziel ist erst nach einem versionierten, expertengelabelten,
   zuvor unbekannten Mehrversicherer-Holdout belegbar.

## Interner Katalogschritt: HP-25

Der interne HP-Katalog ist von v0.1 auf v0.2 versioniert. HP-25 behandelt den
weltweiten räumlichen Geltungsbereich als wiederverwendbares Konzept aus
`weltweit` plus Schadenereignis beziehungsweise Versicherungsfall. Dieselbe
Fundstelle bindet die Rollen `territorial_scope` und `foreign_coverage`; die
Deckungsaggregation wertet nur Deckungsrollen aus.

Der Vertrag deckt exakte Formulierungen, Umstellungen, Flexionen und typische
OCR-Trennungen ab. Negativ- und Downstream-Tests sichern ab, dass bloße
weltweite Erwähnungen keine Deckung werden und dass Einschluss sowie
Ausschluss weiterhin erst aus der Evidenzklassifikation stammen.

Der Code-Commit `5457309c` ändert weder `CUSTOMER_CORE_5_V2` noch die 224
Kundenzeilen. Im isolierten Mac-Studio-Repository bestanden 9 relevante
Suites mit 221 Tests. Der Schritt ist nicht deployed und beweist ohne
unbekannten Holdout keine allgemeine HP-Qualität.

## Verbindliche Lesereihenfolge

1. [`PRODUKTZIEL_GENERALISIERUNG_UND_ABNAHME_DE.md`](./PRODUKTZIEL_GENERALISIERUNG_UND_ABNAHME_DE.md)
   – Produktziel, Invarianten, Generalisierungs- und Abnahmevertrag.
2. [`POLIZZENANALYSE_IMPLEMENTIERUNGS_TRACKER_DE.md`](./POLIZZENANALYSE_IMPLEMENTIERUNGS_TRACKER_DE.md)
   – chronologisches Implementierungs-, Test- und Release-Ledger.
3. [`VOLLLAUF_AUDIT_QWEN36_2026-08-31_DE.md`](./VOLLLAUF_AUDIT_QWEN36_2026-08-31_DE.md)
   – exakter Fünf-Kategorien-Lauf, Befunde und fachliches `NO GO`.
4. `server/utils/policyComparison/productContract.js`
   – maschinenlesbarer aktiver Produktvertrag.
5. `server/resources/policyAnalysis/`
   – versionierte Such- und Komponentenverträge.

Historische Detailabschnitte bleiben im ausführlichen Tracker und in der
Knowledge Base erhalten. Sie dürfen aktuelle Quellverträge, Releases oder
Laufberichte nicht überschreiben.
