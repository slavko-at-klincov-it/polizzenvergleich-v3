# Polizzenvergleich V3.8.8

V3.8.8 schließt den fail-closed Batch-10-Fall des kalten dynamischen
LF-1+9-Produktlaufs, ohne bereits gültige Modellarbeit neu zu berechnen.
Qwen lieferte eine erwartete Klausel wiederholt quellengebunden, verwendete
für ihre Komponenten aber die alte JSON-Form direkt auf Requirement-Ebene.
Die heutige fachliche Normalisierung konnte diese Inhalte deshalb bislang
nicht verarbeiten.

Der Klassifikator hebt eine solche Antwort nun ausschließlich dann in den
aktuellen Requirements-Vertrag, wenn alle Einträge derselben erwarteten
`CLAUSE`-Unit vollständig der alten Komponentenform entsprechen, gültige
Komponententypen und nichtleere wortgetreue Labels besitzen, ausschließlich
eigene Source-Block-IDs zitieren, keine verschachtelten Komponenten enthalten
und die Unit keine logischen Listensegmente besitzt. Gemischte Formen,
unbekannte Quellen, Listen-Units, zusätzliche Felder und verschachtelte
Komponenten bleiben unverändert fail-closed.

Für konditionale Äquivalenzdefinitionen der Form „… gilt auch dann als …,
wenn …“ greift danach die bereits vorhandene allgemeine Klauselzerlegung. Ist
die Antwort ausdrücklich als `PERIL_OR_DAMAGE` klassifiziert, wird ein alter
`OBJECT`-Alias des Definitionsgegenstands zu `PERIL_OR_CAUSE`; ohne diese
Gefahrsemantik bleibt `OBJECT` unverändert. Source-, Rollen-,
Atomisierungs- und Manifestvalidierung bleiben vollständig aktiv.

Der echte gespeicherte Batch 10 der kalten Session 14 wurde auf dem Mac Studio
ohne Modellaufruf revalidiert: 6/6 erwartete Units und PASS. Der einzige
nichtblockierende Diagnoseeintrag ist die serverseitige,
quellengebundene Rollenmaterialisierung
`LOCAL_SIGNAL_COMPONENT_MATERIALIZED`. Der Attempt-Artefaktbaum blieb vor und
nach der Prüfung unter SHA-256
`aa0856167dff6aa10b6872c1ccffa91cecf52bd187ac8419c03ca8b7e8a7f6a5`
bytegleich. Der fokussierte Vertragslauf auf Implementierungscommit
`91ee0eb833b4b29986ef3e6a68ba1727c1b538b8` bestand 379/379 Tests;
Prettier und Capability-JSON bestanden ebenfalls.

V3.8.8 ändert weder Gold-283-V2 noch die binäre Kundenlogik. Der bekannte
LF-1+9-Lauf bleibt Regressionsevidenz und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis. Die Installation und Fortsetzung
des kalten Produktlaufs erfolgen erst nach bestandenem vollständigem
Mac-Studio-Release-Gate.

Change-Set:
`LF-V388-LEGACY-REQUIREMENT-SHAPE-LIFT-20260917-001`.
