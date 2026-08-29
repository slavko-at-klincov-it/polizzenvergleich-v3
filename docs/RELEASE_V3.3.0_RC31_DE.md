# Polizzenvergleich V3.3.0 RC31 – Dachlawine als Schnee- und Eisrutsch belegen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.31`

## Zweck

RC31 schließt die Recall-Lücke bei WEVIG `ST-27`. Der Vorschlag nennt im
Sturmkapitel ausdrücklich `Dachlawinen (Schnee und Eis) auf Erstes Risiko`.
Die Pipeline erkannte bisher allgemeine Lawinen, verlor aber die
Schneerutschkomponente und gab die Zeile nur teilweise belegt aus.

RC31 führt die versichererneutralen Dachlawinen-Formen für beide atomaren
Rollen. Die serverseitige Bindung bleibt eng: Sie verlangt die Formulierung
`Dachlawine(n) (Schnee und Eis)`, `auf Erstes Risiko` und den
Sturmversicherungs-Scope. Überschriften oder bloße Lawinennennungen reichen
nicht.

## Reale 27B-Abnahme

### WEVIG

```text
17/17 Triage-Kandidaten
54/54 atomare Komponenten
36/36 ST-Endzeilen
8 ausgewählte Quellen

ST-27:
  TEILBELEGT / Nicht feststellbar
  -> BELEGT / Ja
  Lawine und Schneerutsch eingeschlossen
  Quelle: PDF-Seite 4, EUR 7.500,00 auf Erstes Risiko

Übrige 35 ST-Zeilen exakt identisch.
```

### LF

```text
53/53 Triage-Kandidaten
54/54 atomare Komponenten
36/36 ST-Endzeilen
35 ausgewählte Quellen
0 Änderungen gegenüber RC25
kein Dachlawinen-Kandidat
```

Artefakte:

```text
RC31-WEVIG-ST-CANDIDATE-20260829-125259
RC31-LF-ST-CONTROL-20260829-125402
```

## Technische Gates

```text
PASS: 93 Jest-Suites / 1067 Tests
PASS: Katalog-Recall und gemeinsamer Span für beide ST-27-Rollen
PASS: enge Positiv- und Negativtests der deterministischen Bindung
PASS: Server-Lint, Prettier und git diff --check
PASS: frische WEVIG- und LF-ST-27B-Läufe
PASS: Tag b21f7a8b auf Mac Studio installiert; beide Doctor-Läufe grün
PASS: exakter Tag/SHA und sauberer Checkout bestätigt
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.31
./doctor.command
```

## Beweisgrenze

RC31 beweist die explizite Dachlawinenklausel als Lawinen- und
Schneerutschdeckung. Risikoangaben zu Vorschäden, Definitionen oder
Überschriften ohne operative Deckung werden dadurch nicht positiv gebunden.
