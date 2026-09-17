# Polizzenvergleich V3 auf macOS installieren

Voraussetzungen:

- Apple-Silicon-Mac
- angemeldete grafische macOS-Sitzung
- Internetzugang während der ersten Installation
- LM Studio samt CLI unter `$HOME/.lmstudio/bin/lms`
- das einmalig geladene Chatmodell
  `lmstudio-community/Qwen3.6-35B-A3B-MLX-4bit` (20,43 GB)
- für den dynamischen LF-V2-Modus das lokale Embeddingmodell
  `Hanno-Labs/dinghy-law-4b-v1-gguf` und der auf dem Zielsystem
  hashverifizierte Embeddingvertrag

## Installation

```bash
cd ~/Code/polizzenvergleich-v3
git fetch origin --tags
git checkout v3.8.3
V3_A_DRIVEN_EMBEDDING_CONTRACT_FILE="/ABSOLUTER/PFAD/ZUM/embedding-contract.json" ./install.command
```

Der Installer lädt eine eigene geprüfte Node-Laufzeit, installiert die
Abhängigkeiten, richtet die Datenbank ein, baut die Oberfläche und startet
Server und Collector als LaunchAgents. Danach öffnet sich
`http://127.0.0.1:3004` automatisch. Es müssen keine Terminals geöffnet
bleiben.

V3 verwendet ausschließlich die lokalen Ports `3004` und `8890`. Vorhandene
V1-/V2-Installationen werden weder gestoppt noch verändert.

## Bedienung

- `start.command`: V3 starten und öffnen
- `stop.command`: V3 stoppen
- `doctor.command`: Installation prüfen
- `update.command`: auf den neuesten unveränderlichen V3-Release aktualisieren
- `uninstall.command`: nur V3-Dienste und die V3-CLI entfernen

Die Anwendungskonfiguration und Dokumente liegen ausschließlich im V3-Ordner.
Das Quellmodell wird nicht automatisch heruntergeladen. Fehlt es, zeigt der
Start den dafür notwendigen `lms get`-Befehl an. V3 erstellt daraus eine
platzsparende reine Textansicht und lädt ausschließlich
`qwen/qwen3.6-35b-a3b` mit 42.496 Token Kontext, Parallelität 1, 8-Bit-MLX-
KV-Cache und ausgeschaltetem Thinking. Andere geladene Chat- oder
Embeddingmodelle werden beim V3-Serverstart entladen. Der dynamische
LF-V2-Lauf wechselt kontrolliert auf Dinghy und stellt danach Qwen wieder her.
Der Doctor prüft den lokalen Embeddingvertrag sowie Modell- und Runtimehash.

## Update einer bestehenden V3-Installation

```bash
cd ~/Code/polizzenvergleich-v3
./doctor.command
V3_A_DRIVEN_EMBEDDING_CONTRACT_FILE="/ABSOLUTER/PFAD/ZUM/embedding-contract.json" ./update.command v3.8.3
./doctor.command
```

Das Update verwendet einen unveränderlichen Release-Tag und erhält die
V3-Datenbank, hochgeladene Dokumente und Konfiguration. Für die neue
PDF-Seitenprovenienz müssen Original-PDFs in einem neuen Workspace erneut
hochgeladen und indexiert werden. Alte flache PDF-Vektoren können nicht
nachträglich zuverlässig einer physischen Seite zugeordnet werden.

Modellentscheidung, Messwerte und Beweisgrenzen stehen in
`docs/RELEASE_V3.8.3_DE.md`.
