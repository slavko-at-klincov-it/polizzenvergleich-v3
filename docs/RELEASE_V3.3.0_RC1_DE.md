# Polizzenvergleich V3.3.0 RC1 – korrigierter VS-27B-Pilot

Stand: 27. August 2026

Release-Tag: `v3.3.0-rc.1`

## Zweck

Dieser Release Candidate ersetzt `v3.2.2-rc.1` für den kontrollierten
VS-A/B-Test auf dem Kunden-Mac. Er korrigiert die im ersten Lauf mit
`qwen/qwen3.8-27b` gefundenen Fehler in Scope-Erkennung, Wertebindung,
Kategorie-Renderer, Oracle und A/B-Auswertung.

Der Sprung auf V3.3.0 ist bewusst gewählt: Die Änderung betrifft mehrere
fachliche Verträge des Pilotworkflows und ist daher mehr als ein kleiner
V3.2.2-Patch. Der normale VS-Chat in der UI ist weiterhin nicht automatisch
auf diesen QA-/Pilotpfad umgestellt.

## Lokale Freigabeevidenz

```text
Kundenartefakt-Replay LF:       4/4 Oracle-Zeilen PASS
Kundenartefakt-Replay WEVIG:    4/4 Oracle-Zeilen PASS
WEVIG-Scopes:                   7/7 exakt serverseitig zugeordnet
Fokussierte Tests:              6 Suites / 108 Tests PASS
Policy-Analyse:                 10 Suites / 157 Tests PASS
Gesamte V3-Testsuite:           77 Suites / 816 Tests PASS
Frontend-Produktionsbuild:      PASS
macOS-Installer-Test:           PASS
Prettier / Syntax / Diff-Check: PASS
Finaler Read-only-Code-Review:  PASS
```

Der Replay verwendet die echten gespeicherten 31-seitige LF- und 21-seitige
WEVIG-Extraktion sowie die gelieferten 27B-Kundenentscheidungen. Er ersetzt
nicht den erneuten Live-Lauf auf der Kundenhardware.

## Update auf dem Kunden-Mac

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./doctor.command
./update.command v3.3.0-rc.1
./doctor.command
```

Der Updater akzeptiert ausschließlich einen annotierten Tag, der auf dem
veröffentlichten `origin/main` liegt. Bei einem fehlgeschlagenen Update wird
der vorherige Code- und Dienstzustand wiederhergestellt.

## Erneuter 27B-A/B-Test

LM Studio muss weiterhin exakt diese Modelle melden:

- Chatmodell: `qwen/qwen3.8-27b`
- Embeddingmodell: `dinghy-embed`

Danach denselben Lauf mit den beiden unveränderten PDFs starten:

```bash
cd "$HOME/Code/polizzenvergleich-v3"

./run-vs-pilot-ab.command \
  "/ABSOLUTER/PFAD/LF-GENERALI.pdf" \
  "/ABSOLUTER/PFAD/Musterberechnung-WEVIG-Premiumschutz.pdf"
```

Der Runner führt beide Dokumente zweimal aus. Für die Kundenfreigabe muss
`report.json` folgende Bedingungen erfüllen:

```text
status = PASS
LF:    4/4 Oracle-Zeilen in beiden Wiederholungen
WEVIG: 4/4 Oracle-Zeilen in beiden Wiederholungen
Stabilität: PASS
Modell- und Embeddingmodell-Gate: PASS
```

Legacy A wird nur noch informativ dargestellt. Es ist kein Release-Gate und
ein Gleichstand mit einem absolut bestandenen Pilot B verhindert keinen PASS.
`positiveEffectObserved` wird nur dann `true`, wenn Pilot B selbst vollständig
besteht, nicht regressiert und mindestens einmal strikt besser ist.

## Erwartete korrigierte Pilotzeilen

| Dokument | ID    | Deckung            | Deckungssumme      | Prüfstatus |
| -------- | ----- | ------------------ | ------------------ | ---------- |
| LF       | VS-16 | Ja                 | Nicht feststellbar | BELEGT     |
| LF       | VS-17 | Nicht feststellbar | Nicht feststellbar | TEILBELEGT |
| LF       | VS-21 | Ja                 | 10 %, 15 %         | BELEGT     |
| LF       | VS-28 | Ja                 | Nicht feststellbar | BELEGT     |
| WEVIG    | VS-16 | Nicht feststellbar | Nicht feststellbar | UNGEKLÄRT  |
| WEVIG    | VS-17 | Nicht feststellbar | Nicht feststellbar | UNGEKLÄRT  |
| WEVIG    | VS-21 | Ja                 | EUR 6.121.600,00   | BELEGT     |
| WEVIG    | VS-28 | Ja                 | Nicht feststellbar | BELEGT     |

Der vollständige Ursachen- und Validierungsbericht steht in
`docs/VS_PILOT_27B_KUNDENBEFUND_FIX_VALIDIERUNG_DE.md`.

## Freigabegrenze

`v3.3.0-rc.1` ist für diesen beaufsichtigten Kunden-A/B-Test freigegeben. Es
ist noch keine Produktfreigabe für VS-01 bis VS-36, alle acht Kategorien,
unbekannte Dokumente, neun Dokumente oder den gewöhnlichen UI-Chatpfad.
