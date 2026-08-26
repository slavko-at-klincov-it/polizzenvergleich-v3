# Polizzenvergleich V3 auf macOS installieren

Voraussetzungen:

- Apple-Silicon-Mac
- angemeldete grafische macOS-Sitzung
- Internetzugang während der ersten Installation
- LM Studio kann später über die AnythingLLM-Oberfläche konfiguriert werden

## Installation

```bash
cd ~/Code/polizzenvergleich-v3
git fetch origin --tags
git checkout v3.1.0
./install.command
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
LM-Studio-Modelle werden vom Installer nicht heruntergeladen, entladen oder
verändert.
