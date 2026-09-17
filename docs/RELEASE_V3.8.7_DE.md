# Polizzenvergleich V3.8.7

V3.8.7 vervollständigt die sichere Normalisierung mehrerer Modellhüllen für
dieselbe erwartete A-Source-Unit. Qwen kann fachlich getrennte Anforderungen
einer Unit gelegentlich als mehrere Top-Level-Objekte mit identischer
`unitId`, aber komplementären Terminalklassen ausgeben. Bis V3.8.6 wurden nur
Duplikathüllen mit vollständig identischen Klassen serverseitig vereinigt.

Der Klassifikator vereinigt nun ausschließlich operative Hüllen derselben im
aktuellen Batch erwarteten `unitId`. Jede Hülle muss eine gültige
Terminalklasse, ein nichtleeres gültiges Klassenarray mit enthaltener
Primärklasse und ein Requirements-Array besitzen. Unbekannte IDs,
nichtoperative Klassen und ungültige Hüllen bleiben unverändert fail-closed.
Requirements und Terminalklassen werden lediglich geordnet vereinigt; es
werden keine Komponenten, Quellen oder fachlichen Aussagen erfunden.

Die bestehende Shared-List-Governor-Normalisierung berücksichtigt dabei
zusätzlich den explizit gebundenen äußeren `governingContext`. Ein
quantifizierter Listengovernor samt Bedingung und Deckungswirkung wird dadurch
in das unmittelbar folgende typografisch untergeordnete Item verschoben,
anstatt als eigene Kundenanforderung stehen zu bleiben. Die vollständige
Source-, Segment-, Rollen- und Manifestvalidierung bleibt unverändert aktiv.

Der echte gespeicherte Batch-6-Fehlerfall der kalten Session 14 wurde auf dem
Mac Studio ohne Modellaufruf revalidiert: 6/6 Units, null Diagnosen und PASS.
Der Attempt-Artefaktbaum blieb vor und nach der Prüfung unter SHA-256
`1baa74fdbb47819cbfbe5841dbcc21b3b720bfb3d5ca32886995fc7bb713b5ba`
bytegleich. Der fokussierte Vertragslauf bestand 373/373 Tests; Prettier und
Produktcode-Lint bestanden ebenfalls.

V3.8.7 ändert weder Gold-283-V2 noch die binäre Kundenlogik. Der bekannte
LF-1+9-Lauf bleibt Regressionsevidenz und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis. Der vollständige fortgesetzte
Produktlauf muss nach dem Release-Gate erneut ab Batch 6 materialisiert
werden.

Change-Set:
`LF-V387-COMPLEMENTARY-DUPLICATE-UNIT-MERGE-20260917-001`.
