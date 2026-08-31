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
