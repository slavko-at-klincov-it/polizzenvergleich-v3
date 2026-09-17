# Polizzenvergleich V3.9.5

V3.9.5 ist ein enger Resume-Hotfix für den V3.9.4-Klassifikationslauf.

Beim Wechsel von V74 auf V75 blieb der unmittelbar vorherige V74-Vertrag
versehentlich außerhalb der bereits bestehenden Allowlist resumierbarer
Vorgänger. Der erste V3.9.4-Resume stoppte deshalb korrekt vor jedem
Modellaufruf mit `LF_A_CLASSIFICATION_PREDECESSOR_BINDING_INVALID`. Es wurden
keine gespeicherten Antworten überschrieben oder neu berechnet.

Der V76-Vertrag nimmt V74 und V75 explizit in die Allowlist auf. Alle
bisherigen Sicherheitsbindungen bleiben unverändert: Source-Plan, Batch-ID,
Batchindex, erwartete Unit-IDs, Modell, Kontext, Prompt, Validator und
Raw-Response-Hash müssen passen. Ein alter PASS-Marker wird nicht vertraut;
jede Antwort wird unter dem aktuellen Validator erneut geprüft.

Auf dem Mac Studio bestand der vollständige fokussierte A-Vertrag mit
402/402 Tests. Ein eigener Test belegt den V74→V76-Upgradepfad ohne
Modellaufruf.

Der exakte Release-Commit
`46a9172ab6fb9d0f5934d13b058cf14cc4643aa4` bestand außerdem das vollständige
Release-Gate mit 212/212 Testsuiten und 3.097/3.097 Tests sowie allen Lint-,
Prisma-, Capability-, Format-, Build- und Installer-Prüfungen. Nach der
Installation wurden im echten Resume-Root
`resume-f1f8a08a27db68b615b3b79c` die Batches 1 bis 33 ohne neuen
Modellaufruf revalidiert übernommen; die Fortsetzung begann bei Batch 34.

Der Hotfix verändert weder die V3.9.4-Atomisierung noch Gold-283-V2 oder die
binäre Kundenlogik. Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz und
kein unabhängiger Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set: `LF-V395-IMMEDIATE-PREDECESSOR-RESUME-20260917-001`.
