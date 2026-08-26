# Polizzenvergleich V3

V3 basiert direkt auf dem unveränderten AnythingLLM-Upstream und ergänzt nur
zwei allgemeine Funktionen:

1. Eine laufende Chat-Antwort bleibt bei der Navigation zu einem anderen
   Workspace oder Thread aktiv. Beim Zurückkehren zeigt die Oberfläche wieder
   denselben laufenden oder abgeschlossenen Stand an.
2. Nicht-Bild-Dateien, die im Chat abgelegt werden, werden automatisch gelesen
   und anschließend in den normalen Workspace-Vektorindex eingebettet. Der
   Senden-Button wird erst freigegeben, wenn alle aktuell laufenden
   Indexierungen beendet sind. Am Datei-Chip wird die Tokenzahl des extrahierten
   Dokumenttexts angezeigt.

Die Tokenzahl beschreibt den extrahierten Dokumenttext. Sie ist keine Anzahl
"generierter Embedding-Tokens": Ein Embedding-Modell erzeugt Vektoren, keine
Texttokens. Ist ein passender lokaler Modell-Tokenizer konfiguriert, zeigt V3
eine exakte Modell-Tokenzahl. Andernfalls wird die Collector-Schätzung sichtbar
als `ca.` gekennzeichnet.

## Bewusste Grenzen

- Die Chat-Fortsetzung gilt für normale LLM-Streams bei Navigation innerhalb
  der laufenden Web-App. Ein Browser-Reload, Tab-Schließen oder Server-Neustart
  ist keine persistente Hintergrund-Job-Garantie. Interaktive Agent-Sitzungen
  behalten vorerst das originale AnythingLLM-Lifecycle-Verhalten.
- Eingebettete Chat-Dateien sind normale, ungepinnte Workspace-Dokumente. Sie
  sind nicht auf einen einzelnen Thread oder eine einzelne Frage beschränkt.
- V3 enthält keine Feuerlogik, FE-/CAT-Taxonomie, A/B-Slots,
  `comparison_documents`, Vergleichsprompts, spezielle Vergleichs-Retrievals,
  FTS-Vergleichsindizes oder Tiefenanalyse aus früheren Varianten.
- Bilder bleiben normale Prompt-Anhänge und werden nicht automatisch in den
  Vektorindex eingebettet.

## Optionale exakte Tokenzählung

Für einen exakten Count des lokalen Chatmodells werden dessen
`tokenizer.json` und `tokenizer_config.json` benötigt:

```env
MODEL_TOKENIZER_PATH=/absoluter/pfad/zum/modellordner
MODEL_TOKENIZER_LABEL=Lokales-Modell
```

Ohne diese Konfiguration bleibt Upload und Embedding voll funktionsfähig; V3
zeigt dann die geschätzte Dokument-Tokenzahl an.

## macOS-Installation

Ab Version 3.1 steht ein eigener, produktneutraler macOS-Installer zur
Verfügung. Er nutzt die V3-eigenen Ports 3004 und 8890 und startet Server und
Collector als lokale LaunchAgents. Details stehen in
`docs/MACOS_INSTALL_DE.md`.
