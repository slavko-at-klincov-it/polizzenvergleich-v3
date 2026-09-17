# Polizzenvergleich V3.8.5

V3.8.5 korrigiert einen weiteren source-bound Strukturgrenzfall, den der
echte kalte V3.8.4-LF-1+9-Produktlauf sichtbar gemacht hat. Die ersten vier
A-Klassifikationsbatches bestanden; Batch 5 stoppte korrekt fail-closed und
blieb vollständig resumierbar.

Die betroffene Unit enthält vor einem internen `LIST_GOVERNOR` bereits einen
selbstständigen Listenpunkt und danach drei hierarchisch untergeordnete
Listenpunkte. Der bisherige Validator erkannte einen gemeinsamen Governor nur
am Anfang einer Unit. Qwen band dessen Scope deshalb zusätzlich an den
vorherigen Listenpunkt und gab den Governor zugleich als eigenständiges
Requirement aus.

Klassifikationslauf V67 und Manifest V16 erweitern die bestehende
Listen-Normalisierung ohne dokumentbezogene Sonderregel:

- Ein gemeinsamer Governor darf an jeder serverseitig belegten Segmentgrenze
  beginnen, aber nur unmittelbar folgende hierarchisch untergeordnete
  `LIST_ITEM`-Segmente regieren.
- Seine Komponenten werden nur in diese abhängigen Requirements
  materialisiert. Vorherige und nachfolgende selbstständige Segmente bleiben
  getrennt.
- Ein eigenständiges Governor-Requirement wird entfernt. Ein Scope-Leak über
  die belegte Gruppe hinaus bleibt mit `LIST_GOVERNOR_SCOPE_LEAK` fail-closed.
- Die Materialisierung interner Objekt-Governors ist idempotent, damit ein
  Vertragsupgrade keine bereits korrekt gebundene Komponente dupliziert.
- Gültige V28-Versuchsjournale werden unter V29 neu validiert; bestandene
  Modellantworten werden weder blind übernommen noch erneut berechnet.

Der gespeicherte echte Fehlerfall bestand auf dem Mac Studio ohne neuen
Modellaufruf. Ein Replay der ersten fünf Batches bestand 5/5 mit null neuen
Qwen-Aufrufen; die Batches wurden unter V67/V16/V29 neu materialisiert. Die
fokussierte Vertragssuite bestand mit 369/369 Tests.

Gold-283-V2 bleibt unverändert und wird nicht als Produktionsvorlage gelesen.
Der vollständige kalte Produktlauf sowie ein unabhängiger,
expertengelabelter Mehrversicherer-Holdout bleiben getrennte Nachweise. Dieser
Release allein ist kein allgemeiner 99-Prozent- oder
Generalisierungsnachweis.
