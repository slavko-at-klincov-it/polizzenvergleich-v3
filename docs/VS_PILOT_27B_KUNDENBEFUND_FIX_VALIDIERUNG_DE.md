# VS-Pilot – Korrektur des Qwen-3.8-27B-Kundenbefunds

Stand: 27. August 2026

Status: **V3.3.0 RC1 LOKAL PASS / ERNEUTER KUNDENLAUF ERFORDERLICH**

## Ausgangsbefund

Der Kundenlauf mit `qwen/qwen3.8-27b` war reproduzierbar `REVISE`. In beiden
Wiederholungen erreichten LF und WEVIG jeweils nur `2/4` Oracle-Zeilen.

| Dokument | Fehlerhafte Zeilen | Hauptursache                                                                                                                        |
| -------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| LF       | VS-16, VS-21       | enger Objekt-Scope wurde pauschal abgewertet; `DIRECT` verdrängte gültige enge Werte; ein `MISMATCH` blieb wegen `UNRESOLVED` offen |
| WEVIG    | VS-21, VS-28       | spartenspezifische Vorschlagspositionen wurden vom 27B-Modell nicht stabil als enger Scope klassifiziert                            |

Die damalige Meldung `positiveEffectObserved: true` war kein positiver
Qualitätsnachweis: Pilot B war zwar besser als Legacy A, bestand aber selbst
nicht das absolute Oracle.

## Implementierte Korrekturen

1. `DIRECT`- und zulässige `NARROW_SCOPE`-Werte bleiben als getrennte Fakten
   mit ihren eigenen Quellen erhalten.
2. Bei mehrteiligen Kategorien wird ein Wert nur übernommen, wenn dieselbe
   Binding-Gruppe alle Komponenten mit derselben Bindungsart abdeckt. Das gilt
   für `DIRECT` und `NARROW_SCOPE`.
3. Ein definitives Rollen-`MISMATCH` oder `OTHER_SCOPE` wird nicht mehr durch
   ein zusätzliches `UNRESOLVED` überstimmt.
4. VS-16 erlaubt einen vollständig belegten engeren **Einschluss**, ohne den
   engeren Geltungsbereich zu verstecken. Engere Ausschlüsse, Bedingungen,
   Optionen oder unbekannte Wirkungen bleiben offen und werden nicht auf die
   ganze Kategorie verallgemeinert.
5. WEVIG-Abschnitte werden serverseitig aus den tatsächlichen Überschriften
   `FEUER`, `LEITUNGSWASSER`, `STURM` und `GLASPAUSCHALVERSICHERUNG`
   kanonisiert. Unbekannte neue `…VERSICHERUNG`-Überschriften beenden die
   Vererbung. Der Ursprung einer geerbten Überschrift bleibt mit physischer
   Seite erhalten.
6. Der Oracle verwendet fail-closed `required ⊆ observed ⊆ allowed`. Dadurch
   ist der fachlich erlaubte zusätzliche WEVIG-Kandidat zugelassen, beliebige
   Zusatzquellen aber weiterhin nicht.
7. Legacy A ist im A/B-Report nur noch ein informativer semantischer Vergleich.
   Release-Gate ist ausschließlich der vollständige Pilot-B-Oracle. Der
   Kundenprompt und sein SHA-256 werden im Manifest festgehalten.
8. Semantische Legacy-Werte werden mit Grenzen geprüft: `110 %` ist kein
   Treffer für `10 %`, `16 Monate` keiner für `6 Monate`.

## Lokale Beweise

### Reale gespeicherte Dokumentextraktionen

Die gespeicherten 31-seitige LF- und 21-seitige WEVIG-Extraktion wurden mit
dem neuen Code erneut zu Worksheets aufgebaut. Anschließend wurden die echten
27B-Wirkungsentscheidungen aus `VS-PILOT-27B-DETAIL.zip` durch die korrigierte
deterministische Nachverarbeitung und den aktuellen Oracle geführt.

| Dokument | Kundenbaseline | Korrigierter Artefakt-Replay |
| -------- | -------------: | ---------------------------: |
| LF       |            2/4 |                 **4/4 PASS** |
| WEVIG    |            2/4 |                 **4/4 PASS** |

Korrigierte Ergebniszeilen:

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

Der frisch aufgebaute reale WEVIG-Worksheet weist die sieben kritischen
Vorschlagspositionen jetzt serverseitig exakt zu:

```text
VS-21 Seite 1 -> FEUER_INSURANCE          (Heading Seite 1)
VS-21 Seite 2 -> LEITUNGSWASSER_INSURANCE (Heading Seite 2)
VS-21 Seite 4 -> STURM_INSURANCE           (Heading Seite 3)
VS-21 Seite 5 -> GLASBRUCH_INSURANCE       (GLASPAUSCHAL, Heading Seite 4)
VS-28 Seite 1 -> FEUER_INSURANCE
VS-28 Seite 2 -> LEITUNGSWASSER_INSURANCE
VS-28 Seite 4 -> STURM_INSURANCE
```

### Automatisierte Regression

```text
Fokussierte Fehler- und Negativtests: 6 Suites / 108 Tests PASS
Alle Policy-Analyse-Tests:            10 Suites / 157 Tests PASS
Gesamte V3-Testsuite:                 77 Suites / 816 Tests PASS
Prettier:                             PASS
git diff --check:                     PASS
```

## Beweisgrenze und nächstes Gate

Der lokale Befund beweist die deterministische Verarbeitung der echten
gespeicherten Extraktionen und der echten Kundenentscheidungen. Er ist kein
neuer Live-Inferenzlauf mit Qwen 3.8 27B.

Für die Kundenfreigabe müssen deshalb noch genau diese Schritte erfolgen:

1. `v3.3.0-rc.1` installieren;
2. denselben A/B-Befehl auf dem Kunden-Mac zweimal ausführen;
3. Pilot B muss in allen vier Dokumentläufen absolut `4/4` erreichen;
4. die sieben WEVIG-Scope-Entscheidungen müssen als servereigene
   `CATALOG_NARROW_SECTION`-Entscheidungen erscheinen;
5. erst danach Kundenentscheidung `PASS` oder `REVISE`.

Der Pfad bleibt ein expliziter QA-/Pilotpfad. Der gewöhnliche VS-Chat in der UI
ist dadurch noch nicht automatisch auf diese Verarbeitung umgestellt.
