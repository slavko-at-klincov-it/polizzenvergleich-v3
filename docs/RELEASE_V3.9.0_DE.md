# Polizzenvergleich V3.9.0

V3.9.0 schließt den fail-closed Batch-17-Fall des kalten dynamischen
LF-1+9-Produktlaufs, ohne bereits gültige Modellarbeit neu zu berechnen. Die
offene Unit ist ein einzelner fachlicher Listenpunkt, dessen Text lediglich
über zwei physische Blöcke fortgesetzt wird. Qwen lieferte Objekt, Wert und
Deckungswirkung wiederholt korrekt und quellengebunden, jedoch in der alten
Komponentenform direkt auf Requirement-Ebene.

Der V71-Klassifikator hebt eine solche Antwort nun auch für eine `LIST`-Unit,
aber ausschließlich unter folgenden Grenzen: exakt ein logisches
`LIST_ITEM_WITH_CONTINUATIONS`, exakt dieselbe geordnete Blockfolge wie die
gesamte Unit, ausschließlich die bereits erlaubte alte Komponentenhülle und
wortgetreue Quellenbindung. Ein Governor ist nur zulässig, wenn er den
aktuellen serverseitigen Evidenzkontextvertrag trägt, seine Blockfolge und
sein Hash konsistent sind und das Komponentenlabel dort wortgetreu vorkommt.
Mehrsegmentlisten, unvollständige Blockfolgen, fremde IDs, ungebundene
Governor, gemischte Hüllen und verschachtelte Komponenten bleiben
fail-closed.

Der echte gespeicherte Batch 17 der kalten Session 14 wurde auf dem Mac Studio
ohne Modellaufruf revalidiert: 6/6 erwartete Units und PASS. Der einzige
nichtblockierende Diagnoseeintrag ist die vorhandene source-bound
Rollenmaterialisierung `LOCAL_SIGNAL_COMPONENT_MATERIALIZED`. Der
Attempt-Artefaktbaum blieb vor und nach der Prüfung unter SHA-256
`be05dd92dd2c71989e79f3320ee60e729045d8c7f0c8e7a37e3f1d63078cefe1`
bytegleich. Die neun gezielten Positiv-/Negativfälle und der vollständige
fokussierte Vertragslauf auf Implementierungscommit
`d8425e86f95e62409c788a80570c6e9773bdae0d` bestanden 9/9 beziehungsweise
389/389 Tests.

V3.9.0 ändert weder Gold-283-V2 noch die binäre Kundenlogik. Der bekannte
LF-1+9-Lauf bleibt Regressionsevidenz und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis. Die Installation und Fortsetzung
des kalten Produktlaufs erfolgen erst nach bestandenem vollständigem
Mac-Studio-Release-Gate.

Change-Set:
`LF-V390-SINGLE-LIST-SEGMENT-LEGACY-LIFT-20260917-001`.
