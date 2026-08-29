# Polizzenvergleich V3.3.0 RC7 – Variantenwerte und vollständige Mischzeilen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.7`

## Zweck

RC7 korrigiert die im vollständigen RC6-Lauf mit Qwen 3.8 27B nachgewiesenen
Restfehler. Die Änderungen sind keine LF-Zeilensonderregeln: Varianten-,
Objekt-, Wert- und Geltungsbereich bleiben als getrennte, quellengebundene
Fakten bis zur Ergebnistabelle erhalten.

## Wesentliche Änderungen

- vollständig geklärte unterschiedliche Objektwirkungen werden als
  `BELEGT + Gemischt` dargestellt und nicht als Widerspruch oder unbekannte
  Deckung;
- Werte bleiben ihrer C-/D-Deckungsvariante zugeordnet;
- `ohne betragliche Beschränkung` ist ein belegter unbegrenzter Limitwert und
  nicht das Fehlen eines Wertes;
- vorangestellte gemeinsame Listenlimits werden quellengebunden an die
  zugehörigen Listenpositionen weitergegeben;
- Vollständigkeit wird bei mehreren ausgewählten Varianten je Variante
  geprüft;
- Flächenlimits wie die Einzelscheibengröße eines Wintergartens werden als
  objektbezogene Limits ausgegeben;
- lokale positive Gefahrenlimits können nicht mehr durch einen älteren,
  sachfremden Ausschluss-Governor invertiert werden;
- der Elementar-Scope für Erdbeben und der ausdrückliche Mieter-Regressverzicht
  werden serverautoritär gebunden;
- ein lokales `exklusive` innerhalb einer positiven Objektliste beendet den
  positiven Listen-Governor für genau das ausgeschlossene Objekt;
- der All-Kategorien-Runner besitzt eine globale Sperre, einen exakten
  LM-Studio-Modell-Preflight und ein Resume-Manifest für Release, Modell,
  Tokenlimit, Dokumentstatus und PDF-Hash.

## Reale RC6-Artefakt-Replays

```text
LW-26:
C-Deckung: EUR 2.000 je Schadenfall;
D-Deckung: ohne betragliche Beschränkung je Schadenfall

LW-27:
C-Deckung: EUR 7.500,00 auf Erstes Risiko;
D-Deckung: EUR 10.000,00 je Schadenfall

EL-16:
Wintergarten eingeschlossen; Vitrinen ausgeschlossen;
Deckung Gemischt;
Wintergarten: Einzelscheibengröße bis 10 m²

WE-14:
Inhalt der Kellerabteile ausgeschlossen;
Deckung Nein
```

## Nachweis vor dem neuen Kundenlauf

```text
88 Jest-Suites / 961 Tests: PASS
Server-Lint: PASS
Git-Diff-Prüfung: PASS
Echte RC6-Artefakt-Replays für LW-26, LW-27 und EL-16: PASS
Echte RC6-Zielreplays für EL-04, EL-07 und HP-16: PASS
Echtes RC6-Ziel- und Tabellenreplay für WE-14: PASS
```

## Beweisgrenze

```text
GO: frischer vollständiger LF-Gesamtlauf mit Qwen 3.8 27B
REVIEW_REQUIRED: qualitativer Vergleich aller 320 Zeilen gegen RC6 und RC5
REVIEW_REQUIRED: Gegenprobe mit weiteren Dokumenten und Dokumentvarianten
NO CLAIM: allgemeine 99-Prozent-Genauigkeit oder finale V3.3.0-Freigabe
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.7
./doctor.command
```

## Vollständiger LF-Lauf

```bash
cd "$HOME/Code/polizzenvergleich-v3"

./run-all-categories-quality.command \
  "/ABSOLUTER/PFAD/LF-GENERALI.pdf" \
  FRAMEWORK_TERMS
```

Der Runner lehnt einen zweiten parallelen Gesamtlauf und einen unsicheren
Resume mit abweichendem Laufkontext ab.
