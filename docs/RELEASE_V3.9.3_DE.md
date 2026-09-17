# Polizzenvergleich V3.9.3

V3.9.3 schließt den einzigen fail-closed Restfall des kalten dynamischen
Batch 32, ohne bereits gültige Modellarbeit neu zu berechnen.

Die betroffene Unit enthält in genau einem fortgesetzten Listenpunkt zuerst
eine ausdrücklich formulierte Voraussetzung und unmittelbar danach die
Definition des darin verwendeten Ereignisbegriffs. Qwen band Objekt und
geerbte Deckungswirkung korrekt, vermischte aber das Ende der Voraussetzung
mit der Definition zu einer überbreiten CONDITION und ließ dadurch den
Einleitungsblock unzitiert.

Der V74-Laufvertrag atomisiert diese Struktur ausschließlich bei exakten
Grenzen innerhalb derselben Segment-Anforderung:

- vollständige Voraussetzung mit ausdrücklichem „ist, dass“;
- unmittelbar folgende vollständige „Unter X versteht man Y“-Definition;
- X kommt wörtlich bereits in der Voraussetzung vor;
- vollständige source-bound Satz- und Blockspannen;
- vorhandene unabhängige Objekt- und Governor-Komponenten bleiben erhalten.

Die Voraussetzung wird `CONDITION`, X wird `PERIL_OR_CAUSE`, und die
vollständige Definition wird `FACT_ROLE`. Abweichende Begriffe, mehrere
Requirements, unvollständige Sätze oder mehrere Definitionen bleiben
fail-closed. Die Regel enthält keine Dokument-ID, Seite,
Versichererbezeichnung oder Kundenformulierung.

Auf dem Mac Studio bestanden Syntax und Prettier sowie 397/397 Tests des
vollständigen A-Referenzvertrags. Der echte gespeicherte Batch 32 wurde ohne
Modellaufruf mit 6/6 Units und null Restfehlern revalidiert. Sein
Attempt-Artefaktbaum blieb unter SHA-256
`fa98cb514fd2507829612c02938ba1c8cb2a95b4d914632e2957496380b55ae1`
unverändert.

Gold-283-V2 und die binäre Kundenlogik ändern sich nicht. Der bekannte
LF-1+9-Lauf bleibt Regressionsevidenz und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set:
`LF-V393-PREREQUISITE-DEFINITION-ATOMIZATION-20260917-001`.
