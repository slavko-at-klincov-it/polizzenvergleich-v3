# Polizzenvergleich V3.8.1

V3.8.1 ist ein gezielter Korrekturrelease für den dynamischen
`LF_REFERENCE_A_DRIVEN_V2`-Produktpfad. Der erste kalte V3.8.0-Lauf über den
echten Kundenpfad hat nach zwei erfolgreichen A-Batches korrekt fail-closed
gestoppt: Eine A-Anforderung enthielt zwei ausdrückliche nichtnumerische
Limits, deren Evidenz vollständig vorhanden war, von der deterministischen
Materialisierung aber beide auf den ersten Regex-Treffer gebunden wurden.

Der neue, allgemeine Evidenzvertrag bindet solche Rollen an das konkrete
Textvorkommen und dessen Quellblock. Typ, Text und Quelle müssen gemeinsam
passen. Dadurch können mehrere Grenzen in derselben Anforderung weder
zusammenfallen noch durch eine nur teilweise passende vorhandene Rolle
verdeckt werden. Die Regel enthält keine bekannte Kunden-ID, Seite,
Versichererbezeichnung oder fest codierte Ergebniszeile.

Die Änderung versioniert:

- `LF_A_REQUIREMENT_ROLE_EVIDENCE_COMPLETENESS_V11`;
- das dynamische Manifest auf V15;
- den Klassifikationslauf auf V63.

V10, Manifest V14 und Lauf V62 bleiben für historische QA-Revalidierung
akzeptiert, werden aber nicht als aktueller Produktvertrag erzeugt.

Parallel wurde das bekannte, unveränderte Gold-283-V1 durch einen separaten
QA-Korrekturvertrag zu Gold-283-V2 fortgeschrieben. Die drei bereits
quellengebunden entschiedenen Fälle `VS-15`, `AV-06` und `AV-22` wechseln von
`FOUND` zu `NOT_FOUND`; alle anderen 280 Zeilen bleiben kanonisch unverändert.
Das produktive System liest weder Gold-V1 noch Gold-V2 als Vorlage ein.

Der eingefrorene bekannte LF-1+9-Goldstand umfasst:

- 283 Zeilen;
- 270 `GEFUNDEN`, 13 `NICHT GEFUNDEN`;
- 149 `FULL`, 113 `PARTIAL`, 8 `CONTRADICTED`, 13 `NONE`;
- 144/144 eindeutig messbare dynamische Baseline-Fälle korrekt;
- 0 False Positives und 0 False Negatives in dieser messbaren Teilmenge.

Dieser Stand ist Regression für genau das bekannte, hashgebundene
LF-1+9-Entwicklungsset. Er ist kein unabhängiger Mehrversicherer-Holdout,
kein Nachweis beliebiger Policen, keine allgemeine 99-Prozent-Aussage und
keine Laufzeitzusage. Ein solcher unabhängiger Holdout ist derzeit nicht als
vollständiges, expertengelabeltes Paket vorhanden und bleibt ein separates
Abnahme-Gate.
