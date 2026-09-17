# Polizzenvergleich V3.9.9

V3.9.9 schließt den letzten fail-closed Restfall des bekannten kalten
LF-1+9-A-Laufs und verhindert zugleich unnötige Neuberechnung über mehrere
Resume-Generationen.

Der V80-Laufvertrag adaptiert die bestehende bounded A-Klassifikation mit zwei
allgemeinen Regeln:

- Ein ansonsten wörtliches Komponentenlabel darf genau ein morphologisch nahes
  Modellwort auf eine eindeutige, zusammenhängende Originalspanne innerhalb
  der bereits deklarierten Quellblöcke zurückführen. Zahlen, Zahlwörter,
  Negationen, Deckungs-/Ausschlusspolarität, Modalität, mehrere Abweichungen,
  mehrdeutige Spannen und fremde Blöcke bleiben fail-closed.
- Ein Partial-Resume revalidiert die vollständige explizite
  `LF_A_PARTIAL_RESUME_SOURCE_V1`-Kette. Jede Planwurzel muss identisch sein;
  Symlinks, Zyklen, ungültige Verträge und mehr als 64 Vorgänger stoppen
  fail-closed. Neuere gültige Antworten haben Vorrang, ältere Quellen füllen
  ausschließlich noch fehlende Unit-IDs.

Die fokussierte Mac-Studio-Suite bestand mit 420/420 Tests. Die echte
Batch-38-Kette wurde anschließend read-only über 13 Vorgängerwurzeln
revalidiert: 6/6 Units PASS, sechs Vorgängerantworten wiederverwendet, null
Modellaufrufe und null neue Versuche. Die gespeicherten Kundenartefakte wurden
dabei nicht verändert.

Der vollständige Release-Gate bestand anschließend mit 212/212 Testsuiten und
3.115/3.115 Tests einschließlich Lints, Prisma, Capability-Inventar, Prettier,
Frontend-Build und Installer-Suite. V3.9.9 wurde über den offiziellen Updater
auf dem Kunden-Mac-Studio aktiviert; Doctor, API und SQLite bestanden.

Der fortgesetzte Produktlauf erreichte 51/58 gültige A-Batches und stoppte in
Batch 52 korrekt fail-closed. Fünf von sechs Units waren gültig; die offene
Unit besaß zwei verschiedene lokale Bedingungen, von denen nur eine
quellengebunden war. Dieser nachfolgende Befund wird in V3.9.10 allgemein
behoben. Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz und ist kein
unabhängiger Generalisierungs- oder 99-Prozent-Nachweis.

Change-Sets:

- `LF-V399-EXACT-SINGLE-TOKEN-SOURCE-ALIGNMENT-20260917-001`
- `LF-V399-MULTIHOP-PARTIAL-RESUME-20260917-002`
