# Polizzenvergleich V3.8.9

V3.8.9 schließt den fail-closed Batch-14-Fall des kalten dynamischen
LF-1+9-Produktlaufs, ohne bereits gültige Modellarbeit neu zu berechnen. Qwen
lieferte den ausdrücklichen Ausschluss „Schäden durch Graffiti“ korrekt und
quellengebunden, verwendete `PERIL_OR_DAMAGE` jedoch als terminalen
Komponententyp. Dieser Name ist im heutigen Komponentenvertrag nur eine
semantische Klasse; der gültige Komponententyp heißt `PERIL_OR_CAUSE`.

Der Klassifikator normalisiert diesen Alias nun ausschließlich dann, wenn das
wortgetreue Komponentenlabel vollständig durch die deklarierten eigenen
Source-Blöcke belegt ist und selbst eine explizite kausale Schadensrelation
enthält: Schaden oder Beschädigung in Verbindung mit „durch“, „infolge“,
„aufgrund“ oder „wegen“. Bloße Begriffe wie „Graffiti“ sowie nichtkausale
Formulierungen wie „Schäden an Gebäuden“ bleiben unverändert fail-closed.
Wirkung, Wert, Scope, übrige Rollen und Quellenbindung werden nicht verändert.

Der echte gespeicherte Batch 14 der kalten Session 14 wurde auf dem Mac Studio
ohne Modellaufruf revalidiert: 6/6 erwartete Units und PASS. Der
Attempt-Artefaktbaum blieb vor und nach der Prüfung unter SHA-256
`8356d00040a6d29245ff2537bba736d23e0a353e018b8ce3e6342a963669525c`
bytegleich. Die sechs neuen Positiv-/Negativfälle und der vollständige
fokussierte Vertragslauf auf Implementierungscommit
`ae5b8a826e3c08f5b983393bd331f930ac469fac` bestanden 6/6 beziehungsweise
385/385 Tests.

V3.8.9 ändert weder Gold-283-V2 noch die binäre Kundenlogik. Der bekannte
LF-1+9-Lauf bleibt Regressionsevidenz und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis. Die Installation und Fortsetzung
des kalten Produktlaufs erfolgen erst nach bestandenem vollständigem
Mac-Studio-Release-Gate.

Change-Set:
`LF-V389-CAUSAL-PERIL-COMPONENT-ALIAS-20260917-001`.
