# Polizzenvergleich V3.9.1

V3.9.1 schließt die beiden fail-closed Restfälle des kalten dynamischen
Batch 21, ohne bereits gültige Modellarbeit neu zu berechnen.

Beim ersten Fall war ein fachlich korrektes Objektlabel über zwei physische
Quellblöcke verteilt. Qwen verband die Blockgrenze mit einem Leerzeichen,
während der kombinierte Quelltext dort einen Zeilenumbruch enthält. V72
akzeptiert dies nur über NFKC und Whitespace-Kollaps auf einer eindeutig
kleinsten zusammenhängenden Blockspanne. Wort-, OCR-, Trennstrich- und
Satzzeichenänderungen bleiben unzulässig. Kommt ein kurzes Label zugleich in
Unit und Governor vor, gilt nur ein Kandidat, dessen vollständige Blockspanne
von den ausdrücklich deklarierten Source-IDs umfasst ist.

Beim zweiten Fall enthielt eine quantifizierte Limit-Anforderung ein nicht
wortgetreues Kurzlabel, das Basis und Scope verband. Für das eng gebundene
Quellmuster „Der/Die/Das X beträgt [Scope] [Wert]“ wird dieses Altlabel nun
ausschließlich dann in die wörtliche `LIMIT_BASIS` X und den optionalen
wörtlichen `SCOPE` zerlegt, wenn im selben Requirement genau eine bereits
gültige `VALUE_AND_UNIT` vorhanden ist und das Altlabel genau aus X plus Scope
besteht. Freie Neuformulierung und mehrdeutige Sätze bleiben fail-closed.

Der echte gespeicherte Batch 21 der kalten Session 14 wurde auf dem Mac Studio
ohne Modellaufruf revalidiert: 6/6 erwartete Units, null Restdiagnosen und
PASS. Der Attempt-Artefaktbaum blieb vor und nach der Prüfung unter SHA-256
`c3f11c95368dc56956ddcbabedce0e9298a6b83a750e04c94deaf817927ede1e`
bytegleich. Die neun gezielten Positiv-/Negativfälle und der vollständige
fokussierte Vertragslauf auf Implementierungscommit
`a92aeae4f2b5da490288a7d35e7e701894595adc` bestanden 9/9 beziehungsweise
393/393 Tests.

V3.9.1 ändert weder Gold-283-V2 noch die binäre Kundenlogik. Der bekannte
LF-1+9-Lauf bleibt Regressionsevidenz und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis. Die Installation und Fortsetzung
des kalten Produktlaufs erfolgen erst nach bestandenem vollständigem
Mac-Studio-Release-Gate.

Change-Set:
`LF-V391-BATCH21-EVIDENCE-NORMALIZATION-20260917-001`.
