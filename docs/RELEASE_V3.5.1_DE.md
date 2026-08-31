# Polizzenvergleich V3.5.1 – technischer Fünf-Kategorien-Release

Stand: 31. August 2026

Release-Tag: `v3.5.1`

## Zweck

V3.5.1 liefert die nach V3.5.0 entstandenen technischen Produktänderungen als
vorwärts gerichteten, unveränderlichen macOS-Release aus. Der Modellvertrag
bleibt Qwen 3.6 MLX mit exakt 42.496 Token Kontext und Parallelität 1.

Enthalten sind insbesondere:

- das produktive Profil `CUSTOMER_CORE_5_V2` mit VS, FE, LW, ST und EL sowie
  224 sichtbaren Zeilen;
- der einblättrige 17-Spalten-Kundenexport im freigegebenen
  `Gesamtvergleich`-Format;
- die getrennte, typisierte Behandlung kontrollierter Nulltreffer;
- die deterministische, fail-closed Punktentscheidung ohne Gesamtsieger;
- die atomare Archivierung fertiger Arbeitsmappen unter
  `~/Downloads/Projekt Lokale KI/Vergleiche`;
- den Laufzeitguard, der vor der PDF-Verarbeitung das exakt geladene Modell
  und den Kontext 42.496 prüft;
- die V3.4.0-RC2-Sicherheitskorrekturen für lokale Bedingungs- und
  Rückausnahmescopes.

## Fachliche Freigabegrenze

Dieser Release ist ein technischer Betriebs- und Teststand. Der frische
Fünf-Kategorien-Vollvergleich ist technisch erfolgreich, aber fachlich nicht
ungeprüft kundenfreigegeben. Bestätigte offene Fehler betreffen unter anderem:

- zu enge Alias-/Konzeptsuche und dadurch falsche Nulltreffer;
- Überschriften- und Klauselscope bei `LW-08`;
- `ANY`-Komponentenaggregation sowie Objekt- und Limitbindung bei `VS-16`;
- unvollständige Bindung mehrerer Werte und allgemeiner Vertragsgrenzen;
- automatische Rollen-/Statusvorgaben unbekannter Mehrdokumentpakete.

Das vollständige Audit steht in
`docs/VOLLLAUF_AUDIT_QWEN36_2026-08-31_DE.md`. Ergebnisse dieses Releases
benötigen bis zur Fehlerbehebung weiterhin fachlichen Review. Weder beliebige
Polizzen noch das 99-Prozent-Ziel sind bewiesen.

## Deploymentvertrag

Das Update verwendet ausschließlich den annotierten Tag `v3.5.1` auf dem
veröffentlichten `main`-Stand. Der macOS-Updater:

1. verlangt einen sauberen installierten Checkout;
2. stoppt die V3-LaunchAgents;
3. sichert die SQLite-Datenbank vor der Aktivierung;
4. installiert Abhängigkeiten und baut das Frontend;
5. führt Prisma-Migrationen aus;
6. aktiviert den neuen Build und startet die Dienste;
7. führt den integrierten Doctor aus;
8. stellt bei einem Fehler Code, Datenbank, Frontend und zuvor laufende
   Dienste wieder her.

Der Vergleichsexport, hochgeladene Dokumente und vorhandene private
Laufartefakte bleiben im V3-Speicher beziehungsweise im konfigurierten
Vergleichsordner erhalten.

## Deployment auf dem Mac Studio

Der annotierte Tag `v3.5.1` wurde am 31. August 2026 als technischer
Test-/Betriebsstand auf dem Kunden-Mac-Studio installiert.

```text
TAG: v3.5.1
COMMIT: ca2add77ddee4b21099f24983774dc8b35b046d7
INSTALLATION: /Users/michaelmischkot/Code/polizzenvergleich-v3
VORHER: v3.4.0 / 977ed40f735762132aec5aa5cfd91a46c2c2efcf
EXTERNE SICHERUNG:
  /Users/michaelmischkot/Polizzenvergleich-Backups/
  pre-v3.5.1-20260831-093731
```

Vor dem Update bestanden auf dem exakten Releasekandidaten:

- der macOS-Installervertrag;
- sieben fokussierte Vergleichssuites mit 65 Tests;
- Bash-Syntax aller geänderten Start-/Update-/Doctorpfade;
- Prettier der geänderten Produkt-, Test- und Dokumentdateien;
- der Frontend-Produktionsbuild mit 6.170 Modulen im isolierten Worktree.

Der offizielle Updater installierte Abhängigkeiten, erzeugte den Prisma-
Client, baute das Produktionsfrontend mit 6.181 Modulen, sicherte die
Produktionsdatenbank, bestätigte 41 Migrationen ohne offenen Migrationsschritt,
führte den Seed aus, aktivierte den Build und startete beide LaunchAgents.

Nach dem Update bestanden:

- integrierter und separater Doctor vollständig;
- sauberer, abgetrennter Checkout exakt auf Tag und Commit;
- SQLite `PRAGMA quick_check` für aktuelle und externe Sicherungsdatenbank;
- identische Bestandszahlen vor/nach Update: 8 Workspaces, 3
  Workspace-Dokumente, 2 Vergleichssessions und 10 Vergleichsdokumente;
- Server und Collector erreichbar und ausschließlich an Loopback gebunden;
- ausschließlich `qwen/qwen3.6-35b-a3b`, Kontext 42.496, Parallelität 1;
- Server-, Collector- und Frontend-Environment mit Modus 600;
- Storage und Vergleichsexportordner mit Modus 700;
- unveränderte vorhandene Vergleichsexporte und private
  Vergleichsartefakte.

Die fachliche Freigabegrenze dieses Dokuments bleibt durch das erfolgreiche
Deployment unverändert: Der Stand ist technisch installiert, aber die
bestätigten Recall-/Scopefehler sind weiterhin offen.
