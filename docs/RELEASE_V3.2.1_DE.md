# Polizzenvergleich V3.2.1

V3.2.1 basiert direkt auf V3.2.0. Die zwischenzeitlichen CLI-Preset-Releases
V3.3.0 und V3.3.1 wurden zurückgezogen und gehören nicht zu dieser Linie.

## Änderungen

- Der normale Dialog **Neuer Workspace** bietet optional die Fachvorlagen
  `VS`, `FE`, `LW`, `ST`, `EL`, `HP`, `VB` und `WE` an.
- Die Vorlagen werden als geprüfte Server-Ressourcen ausgeliefert. Der Browser
  sendet nur die ausgewählte ID; freie Dateipfade oder Prompts werden von der
  Workspace-Anlage nicht akzeptiert.
- Ohne Fachvorlage bleibt der normale AnythingLLM-Standardprompt erhalten.
- Jeder neu angelegte Workspace erhält die vereinbarten Startwerte:
  System-LLM, Chat-Modus, Verlauf 1, Temperatur 0, Standardsuche, Top-N 55 und
  keine Dokumentähnlichkeitsschwelle.
- Die Workspace-Liste wird nach einer Anlage ohne Seitenreload aktualisiert.
  Laufende Chats in anderen Workspaces werden dadurch nicht abgebrochen.
- Die Thread-Route wurde korrigiert. Der Wechsel in einen neu erzeugten Thread
  rendert weiterhin die Chat-Oberfläche statt einer leeren Seite.
- Laufzeitdateien unter `collector/storage/direct-uploads/` werden nicht in Git
  aufgenommen.

## Verifikation

- 65 Jest-Suites / 654 Tests grün mit der ausgelieferten Node-Version 22.23.2.
- Produktions-Frontend erfolgreich gebaut.
- Browser-Smoke: Dialog, Default-Workspace, EL-Workspace, Sidebar-Aktualisierung
  sowie neuer Thread mit Modellantwort erfolgreich.
- Der EL-Systemprompt wurde bytegenau gegen die ausgelieferte Markdown-Datei
  geprüft; die übrigen sieben Vorlagen werden durch denselben Unit-Testvertrag
  abgedeckt.
