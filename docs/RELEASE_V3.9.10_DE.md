# Polizzenvergleich V3.9.10

V3.9.10 behebt den fail-closed Restfall aus Batch 52 des bekannten kalten
LF-1+9-A-Laufs, ohne eine dokument- oder fallbezogene Sonderregel einzuführen.

Der V81-Laufvertrag verschärft die bestehende source-bound
Rollenvollständigkeit: Jede vom allgemeinen Signalvertrag erkannte explizite
lokale Bedingung (`wenn`, `sofern`, `falls`, `soweit`, `vorausgesetzt` oder
`unter der Voraussetzung`) benötigt eine eigene `CONDITION`-Komponente aus
ihren vollständigen eigenen Quellblöcken. Eine andere Bedingung derselben
Requirement aus anderen Blöcken erfüllt diesen Nachweis nicht. Der Server
materialisiert die vollständige lokale Klausel nur bis zu einer sicheren
Satz-, Klausel- oder Listengrenze. Fremde Blöcke, überlange oder nicht sicher
begrenzte Klauseln bleiben fail-closed.

Auf dem Mac Studio bestanden die fokussierte Vertrags- und Regressionssuite
mit 423/423 Tests sowie die Prettier-Prüfung. Der unveränderte echte Batch 52
wurde anschließend read-only über 13 Vorgängerwurzeln unter dem V81-Vertrag
revalidiert: 6/6 Units PASS, sechs Vorgängerantworten wiederverwendet, null
Modellaufrufe und null neue Versuche. Die gespeicherten Kundenartefakte wurden
dabei nicht verändert.

Der vollständige Release-Gate, das Kundenupdate und der anschließende Resume
des Produktlaufs sind zum Zeitpunkt dieser Releasevorbereitung noch
ausstehend. Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz und ist kein
unabhängiger Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set:

- `LF-V3910-LOCAL-CONDITION-EVIDENCE-20260918-001`
