# Polizzenvergleich V3.3.0 RC26 – Rechtsfolgen von Obliegenheitsverletzungen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.26`

## Zweck

LF und WEVIG enthielten vollständige Regeln zu Obliegenheitsverletzungen und
deren Rechtsfolgen. `FE-E16` erkannte jeweils die Leistungsfreiheit, verlor
aber die sprachlich abweichende erste Pflichtkomponente. Beide Zeilen blieben
dadurch trotz vorhandener Quelle `TEILBELEGT`.

## Änderung

- Der kontrollierte FE-Recall erkennt zwei allgemeine Vertragsvarianten:
  - `Verletzung dieser Verpflichtungen`,
  - `Verletzungen von vereinbarten Obliegenheiten`.
- Rechtsfolge und Leistungskürzung beziehungsweise Leistungsfreiheit bleiben
  getrennte Komponenten und müssen beide belegt sein.
- Die deterministische Textmaterialisierung bewahrt Rechtsabkürzungen wie
  `Abs.`, `Art.` und `lit.` innerhalb desselben Satzes.
- PDF-Layoutumbrüche werden nur in strukturierten Absätzen oder nach
  eindeutigen grammatischen Fortsetzungswörtern überbrückt.

## Sicherheitsgrenzen

- Eine beliebige Erwähnung von `Verletzung` genügt nicht.
- Die Ergänzungen sind reine Recall-Anker; Scope-, Wirkungs- und
  Konfliktregeln bleiben unverändert.
- Echte Satzzeichen, Abschnittsgrenzen und nicht verbundene Fensterinhalte
  bleiben harte Grenzen.
- WEVIG-Ausnahmen für gesetzliche, behördliche und vereinbarte
  Sicherheitsvorschriften bleiben vollständig sichtbar.

## Nachweis

```text
93/93 Jest-Suites, 1059/1059 Tests: PASS
Server-ESLint und git diff --check: PASS

LF-FE mit qwen/qwen3.8-27b:
  28/28 Triage-Kandidaten
  138/138 atomare Komponenten
  80/80 Endzeilen
  FE-E16: TEILBELEGT -> BELEGT / Ja
  vollständiger §-6-/§-62-VersVG-Satz
  übrige 79 FE-Zeilen unverändert

WEVIG-FE mit qwen/qwen3.8-27b:
  46/46 Triage-Kandidaten
  138/138 atomare Komponenten
  80/80 Endzeilen
  FE-E16: TEILBELEGT -> BELEGT / Ja
  Deckungserweiterung und Ausnahmen vollständig erhalten
  übrige 79 FE-Zeilen unverändert
```

Der unveränderliche Tag `v3.3.0-rc.26` wurde anschließend mit SHA
`a58fc9d8b1346cf1256b868a8760beb1ef521046` auf dem Mac Studio installiert.
Update-Doctor, separate Doctor-Wiederholung, Tag-/SHA-Prüfung und sauberer
Checkout bestanden.

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.26
./doctor.command
```

## Beweisgrenze

Bewiesen sind die beiden realen deutschen Vertragsvarianten in LF und WEVIG.
Andere Rechtsfolgenformulierungen und externe Versicherer bleiben Holdouts.
