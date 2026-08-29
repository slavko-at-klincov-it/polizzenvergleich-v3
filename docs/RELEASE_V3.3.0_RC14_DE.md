# Polizzenvergleich V3.3.0 RC14 – operative Deckungsklauseln und Dokument-Oracle

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.14`

## Zweck

RC14 schließt eine allgemeine Lücke zwischen Fundstelle und Wirkungsprüfung:
Eine ausdrückliche Deckungszusage konnte vom Modell als `MENTION_ONLY` oder
`UNRESOLVED` verworfen werden, obwohl Sparte, lokale Klausel und atomarer
Sachverhalt eindeutig übereinstimmten.

Die Korrektur ist nicht auf einen Versicherer oder eine Seitenzahl begrenzt.
Sie erkennt zwei kontrollierte Vertragsformen:

- Listenpositionen unter einem ausdrücklichen lokalen Deckungs-Governor wie
  `Mitversichert gelten`;
- operative Sätze wie `Es werden die Kosten ... ersetzt` einschließlich ihrer
  negativen Form `... werden nicht ersetzt`.

Reine Stichworttreffer, Fremdsparten und Sätze ohne operative Deckungswirkung
bleiben modell- beziehungsweise serverseitig abgelehnt.

## Konkreter Ausgangsbefund

Im vollständigen WEVIG-RC11-Lauf wurden vier eindeutige Komponenten verworfen:

```text
LW-05 pipe_break:     UNRESOLVED
LW-05 pipe_itself:    UNRESOLVED
LW-26 pipe_blockage:  MENTION_ONLY
LW-26 cleaning_costs: MENTION_ONLY
```

Die Originalklauseln lauten sinngemäß `Rohrersatz bei Rohrbruch ...` unter
`Mitversichert gelten` sowie `Es werden die Kosten für die Beseitigung von
Verstopfungen ... ersetzt`.

## Änderung

- Lokale, spartengleiche Listen-Governor dürfen eine falsche Modell-Triage
  serverautoritär korrigieren.
- Operative Ersatz-, Entschädigungs- und Vergütungssätze werden innerhalb des
  exakten Satzes positiv oder negativ gebunden.
- Rohrbegriffe sind als versicherte Objekte rollenfähig.
- Ein generisches sparsames Dokument-Oracle prüft Endzeile,
  Komponentenwirkung, Applicability, Scope/Konflikt, Werte/Rollen und Quellen.
- `APPROVED`-Zeilen können Releases sperren; `DRAFT`-Zeilen bleiben sichtbare
  Diagnostik und erfinden keine fachliche Freigabe.
- Die Offline-CLI liest bestehende QA-Artefakte unverändert und schreibt nur
  `quality-oracle-report.json`.

## Lokaler Nachweis vor dem Mac-Studio-Lauf

```text
91/91 Jest-Suites, 986/986 Tests: PASS
ESLint, Prettier und git diff --check: PASS
Artefakt-Replay WEVIG:
  LW-05 beide Komponenten INCLUDED, BELEGT / Ja
  LW-26 beide Komponenten INCLUDED, TEILBELEGT
  Limit bleibt korrekt NOT_FOUND statt erfunden
Zwei-Dokument-Seiteneffektprüfung:
  exakt vier neue Overrides, nur die vier erwarteten WEVIG-Komponenten
  keine LF-Zeile und keine andere Kategorie betroffen
Oracle auf altem RC11-Artefakt:
  DRAFT 34/65 Aussagen grün, beide Zielzeilen erwartungsgemäß rot
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.14
./doctor.command
```

## Beweisgrenze

Die serverseitige RED-/GREEN-Prüfung und der echte Zwei-Dokument-
Seiteneffektvergleich sind positiv. Vor einer fachlichen Hochstufung der neuen
DRAFT-Oracle-Zeilen ist zusätzlich ein frischer Qwen-3.8-27B-Lauf auf dem Mac
Studio erforderlich. RC14 behauptet weiterhin keine mathematische
99-Prozent-Garantie für beliebige zukünftige Polizzen.
