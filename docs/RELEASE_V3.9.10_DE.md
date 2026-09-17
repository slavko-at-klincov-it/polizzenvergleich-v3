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

Der vollständige Release-Gate bestand anschließend mit 212/212 Testsuiten und
3.118/3.118 Tests einschließlich Lints, Prisma, Capability-Inventar, Prettier,
Frontend-Build und Installer-Suite. V3.9.10 wurde über den offiziellen
Updater auf dem Kunden-Mac-Studio aktiviert; Doctor, API und SQLite
bestanden.

Der fortgesetzte Produktlauf übernahm Batches 1 bis 52 ohne neue
Modellversuche, erreichte 54/58 gültige A-Batches und stoppte Batch 55 korrekt
fail-closed. Fünf von sechs Units waren gültig; die offene Unit enthielt neben
einer gültigen Deckungswirkung zwei redundante ungültige Wirkungsrollen. Der
nachfolgende allgemeine Fix ist Bestandteil von V3.9.11. Der bekannte
LF-1+9-Lauf bleibt Regressionsevidenz und ist kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set:

- `LF-V3910-LOCAL-CONDITION-EVIDENCE-20260918-001`
