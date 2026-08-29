# Polizzenvergleich V3.3.0 RC9 – deterministische Variantenbindung und Haftpflichtgrenze

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.9`

## Zweck

RC9 korrigiert die zwei im frischen vollständigen RC8-Lauf mit
`qwen/qwen3.8-27b` nachgewiesenen Restfehler. Die Regeln bleiben
dokument- und Kategorie-ID-unabhängig, soweit die Vertragsstruktur dies
zulässt.

## Änderungen

- Ein Listeneintrag unter einer ausdrücklich benannten Deckungsvariante und
  einem eindeutigen positiven oder negativen Deckungs-Governor wird
  serverautoritär gebunden. Ein zufälliges `UNRESOLVED` der Modell-Triage kann
  diesen strukturell bewiesenen Kandidaten nicht mehr entfernen.
- Dieselbe effektive Bindung wird in der quellengebundenen Wertextraktion
  verwendet; Wirkung und Variantenwert können deshalb nicht mehr
  auseinanderlaufen.
- `exklusive` wirkt nur innerhalb seines eigenen Satzes beziehungsweise
  Listeneintrags und nicht als geerbter Kapitel-Governor für spätere Objekte.
- Ein Öltank, der nur als versicherte Gebäudesache genannt ist, beweist keine
  Haftpflicht- oder Anlagenrisikodeckung. HP-11 benötigt einen ausdrücklichen
  Haftpflicht-, Gewässerschaden- oder Anlagenrisiko-Kontext.

## Reale RC8-Artefakt-Replays

```text
LW-26: BELEGT + Ja
C-Deckung: EUR 2.000 je Schadenfall
D-Deckung: ohne betragliche Beschränkung je Schadenfall

HP-11: UNGEKLÄRT
Begründung: Heizöltank nur als Gebäudesache genannt, kein Haftpflichtbeleg

WE-14: BELEGT + Nein
Begründung: Kellerabteile versichert, deren Inhalt ausdrücklich exklusive
```

## Nachweis vor dem Kundenlauf

```text
89 Jest-Suites / 966 Tests: PASS erforderlich
Server-, Frontend- und Collector-Lint: PASS erforderlich
Echte frische RC8-Artefakt-Replays für LW-26 und HP-11: PASS
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.9
./doctor.command
```

## Beweisgrenze

Ein frischer vollständiger LF-Lauf mit Qwen 3.8 27B ist das RC9-Gate.
WEVIG folgt erst nach einem positiven LF-Befund.
