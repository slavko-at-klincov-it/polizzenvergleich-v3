# Polizzenvergleich V3.3.0 RC10 – Klauselaktivierung und harte Spartengrenzen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.10`

## Zweck

RC10 korrigiert die im vollständigen WEVIG-RC9-Lauf mit
`qwen/qwen3.8-27b` sichtbar gewordene Übertragung von Belegen zwischen
Versicherungssparten. Eine Fundstelle darf nicht mehr allein deshalb in einer
Kategorie wirken, weil dort dasselbe Wort vorkommt.

## Änderungen

- Besondere-Bedingungsnummern werden aus dem Vorschlag zu den Sparten
  zurückverfolgt, unter denen sie tatsächlich aktiviert wurden. Diese
  Aktivierung gilt anschließend auch für den zugehörigen Klauseltext im
  Bedingungsanhang.
- Eindeutige Klauselfamilien (`12`, `41`, `62`, `64`, `81`) erhalten einen
  kontrollierten Feuer-, Glas-, Leitungswasser-, Sturm- oder
  Haftpflichtscope. Mehrfach aktivierte generische Klauseln behalten die
  vollständige Menge ihrer Aktivierungssparten.
- FE, LW, ST, EL, HP und WE weisen einen Beleg aus einer ausdrücklich anderen
  Versicherungssparte serverseitig als `MENTION_ONLY` ab. Allgemeine
  Vertragsbestimmungen bleiben als möglicher spartenübergreifender Beleg
  offen; ausdrücklich katalogisierte enge Scopes bleiben zulässig.
- Engere Formulierungen bleiben sichtbar eng: „Anprall unbekannter
  Landfahrzeuge“ erfüllt nicht mehr unbemerkt die allgemeinere Frage nach
  allen fremden Fahrzeugen; eine Solarthermieanlage, die nur bei Glasbruch
  infolge Sturm genannt ist, bleibt ein Teilbeleg.
- Ein Betrag im selben strukturellen Listenpunkt wie eine Nicht-VS-Gefahr
  wird quellengebunden übernommen. Dadurch erhält EL-04 das im Vorschlag
  unmittelbar angeführte gemeinsame Limit von `EUR 20.000,00`.

## Reale WEVIG-RC9-Artefakt-Replays

```text
FE-A10: enger Teilbeleg „unbekannte Landfahrzeuge“
LW-20:  UNGEKLÄRT; Grundwasser-Ausschlüsse stammen aus 64er-Sturmklauseln
ST-16:  UNGEKLÄRT; 10PA0230 wurde nur unter Feuer aktiviert
ST-21:  enger Teilbeleg; belegt ist nur Glasbruch infolge Sturm
EL-04:  Limit COMPLETE, EUR 20.000,00
HP-05:  UNGEKLÄRT; Einsturzfundstelle stammt aus 64PA0021
HP-13:  UNGEKLÄRT; 10PG0050 wurde nur unter Feuer und Sturm aktiviert
HP-21:  UNGEKLÄRT; 72-Stunden-Klausel stammt aus 64PA0021
WE-07/09/12/17: fremde Sachspartenbelege entfernt
```

## Nachweis vor dem Kundenlauf

```text
89 Jest-Suites / 972 Tests: PASS
Server-, Frontend- und Collector-Lint: PASS
Syntax- und Git-Diff-Prüfung: PASS
Replays gegen das exakt extrahierte WEVIG-RC9-Dokumentartefakt: PASS
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.10
./doctor.command
```

## Beweisgrenze

Ein frischer vollständiger WEVIG-Lauf mit Qwen 3.8 27B ist das primäre
RC10-Gate. Anschließend muss mindestens ein LF-Regressionslauf bestätigen,
dass die vorher akzeptierten Varianten-, Misch- und Wertbindungen erhalten
bleiben. Ohne vollständige fachliche Oracles für alle 320 Zeilen ist weiterhin
keine 99-Prozent- oder Endfreigabe-Aussage zulässig.
