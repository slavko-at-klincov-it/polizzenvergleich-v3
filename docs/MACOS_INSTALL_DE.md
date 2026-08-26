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
git checkout v3.2.0
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

## Update einer bestehenden V3-Installation

```bash
cd ~/Code/polizzenvergleich-v3
./doctor.command
./update.command v3.2.0
./doctor.command
```

Das Update verwendet einen unveränderlichen Release-Tag und erhält die
V3-Datenbank, hochgeladene Dokumente und Konfiguration. Für die neue
PDF-Seitenprovenienz müssen Original-PDFs in einem neuen Workspace erneut
hochgeladen und indexiert werden. Alte flache PDF-Vektoren können nicht
nachträglich zuverlässig einer physischen Seite zugeordnet werden.

Der genaue Kundentest mit den externen Kategorie-Systemprompts ist in
`docs/RELEASE_V3.2.0_DE.md` beschrieben. Die Promptdateien werden nicht
automatisch in der V3-Datenbank gespeichert.
