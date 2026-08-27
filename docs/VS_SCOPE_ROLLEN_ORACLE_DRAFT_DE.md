# VS-Scope-/Rollen-Oracle - Draft 0.1

Stand: 27. August 2026

## Zweck und Beweisgrenze

Dieses Dokument erweitert die drei bisherigen LF-Golden-Controls um
positive, negative und absichtlich offene Kandidatenfälle aus LF und WEVIG.
Es prüft ausschließlich Kandidatenrolle und Scope. Es entscheidet keine
Deckung, keinen Betrag, keinen Konflikt und keinen Kundenstatus.

`TECHNISCH_GRÜN` bedeutet nur, dass der aktuelle isolierte Pfad den
aufgeführten Draftwert reproduziert. `REVIEW_REQUIRED` bedeutet, dass der
Makler die fachliche Erwartung bestätigen oder korrigieren muss, bevor daraus
ein verbindliches Golden Control wird.

## Quellen-Lock

| Kürzel | Dokument                                 | Physische Seiten | SHA-256                                                            |
| ------ | ---------------------------------------- | ---------------: | ------------------------------------------------------------------ |
| LF     | LF-IMMO Exklusivschutz `_mod.pdf`        |               31 | `2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62` |
| WEVIG  | Musterberechnung WEVIG Premiumschutz.pdf |               21 | `a476cc2e0d970c0143e552bd7d901d82abd89324ba4cf316bc7ee3202a8b0b16` |

Die WEVIG-Datei bezeichnet sich selbst als Vorschlag. Sie ist die
autoritative lokale Testquelle, aber keine abgeschlossene Polizze.

## Oracle-Fälle

| ID    | Quelle / Seite | Kurzer Originalanker                                                | Draft-Erwartung                                      | Aktueller Istwert                         | Status / Prüferfrage                                                                                            |
| ----- | -------------- | ------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| OR-01 | LF / 4         | `Tiefgaragen und Autoabstellplätze`                                 | `INSURED_OBJECT MATCH`, `GENERAL`                    | `DIRECT`                                  | `REVIEW_REQUIRED`: Ist die namentliche Position allgemein oder wegen der konkreten Liste enger Scope?           |
| OR-02 | LF / 4         | `Einrichtungen von Gemeinschaftsräumen ... Fahrradabstellräume`     | Rolle offen                                          | `DIRECT`                                  | `REVIEW_REQUIRED`: Belegt das den Raum selbst oder nur dessen Einrichtung?                                      |
| OR-03 | LF / 5         | `Sicherungs-, Aufräumungs-, Abbruch-, Feuerlösch-`                  | beide `COST MATCH`, Scope wahrscheinlich `GENERAL`   | beide `UNRESOLVED`                        | `IMPLEMENTATION_GAP` und `REVIEW_REQUIRED`: Sind 10 % allgemein und 15 % Feuer als zwei Scopefakten zu trennen? |
| OR-04 | LF / 18        | `Bauvorhaben (insbesondere Abbruch- ... Arbeiten)`                  | kein Abbruchkostenbeleg                              | `UNRESOLVED`                              | `TECHNISCH_GRÜN`; keine Negation aus dem offenen Wert ableiten                                                  |
| OR-05 | LF / 27        | `Kosten für Aufräumung, Abbruch und Isolierung` plus Radioaktivität | beide `COST MATCH`, `NARROW`                         | beide `NARROW_SCOPE`                      | `TECHNISCH_GRÜN`                                                                                                |
| OR-06 | LF / 5         | `der Mietverlust ... bis zu sechs Monaten`                          | `BENEFIT MATCH`, `GENERAL`                           | `DIRECT`                                  | `REVIEW_REQUIRED` für die Scopebezeichnung; Rollenbeleg technisch grün                                          |
| OR-07 | WEVIG / 1      | `Aufräum-, Abbruch- und Feuerlöschkosten`                           | beide `COST MATCH`, Draft `NARROW` wegen Feuersparte | beide `NARROW_SCOPE`                      | `TECHNISCH_GRÜN`, fachlicher Scope `REVIEW_REQUIRED`                                                            |
| OR-08 | WEVIG / 8      | `Aufräum- und Abbruchkosten sind Kosten für ...`                    | beide `COST MATCH`; Scope offen                      | beide `NARROW_SCOPE`                      | `REVIEW_REQUIRED`: Ist jede besondere Bedingung narrow oder ist dies die allgemeine Definition der Komponente?  |
| OR-09 | WEVIG / 8      | `radioaktiv ... Aufräum-, Abbruch- ... Isolierungskosten`           | beide `COST MATCH`, `NARROW`                         | isoliertes `Abbruch` derzeit `UNRESOLVED` | `IMPLEMENTATION_GAP`: rechtsköpfige Kostenkoordination noch nicht gebunden                                      |
| OR-10 | WEVIG / 17     | `Bauherr ... Abbruch-, Grab-, Bau- ... Arbeiten`                    | kein Abbruchkostenbeleg                              | `UNRESOLVED`                              | `TECHNISCH_GRÜN`; fail-closed statt falschem Direktbeleg                                                        |
| OR-11 | WEVIG / 18     | `Schäden an Müllsammelgefäßen`                                      | kein kontrollierter Müllraum-Kandidat                | `NO_CONTROLLED_CANDIDATE`                 | `TECHNISCH_GRÜN`; Müllsammelgefäß darf nicht als Müllraum-Alias ergänzt werden                                  |
| OR-12 | WEVIG / 1      | `Entgang von Mietzinseinnahmen ... 6 Monaten`                       | `BENEFIT MATCH`, Draft `NARROW` wegen Feuersparte    | `NARROW_SCOPE`                            | `TECHNISCH_GRÜN`, fachlicher Scope `REVIEW_REQUIRED`                                                            |

## Aktuelle automatische Gates

Die neun WEVIG-Draft-Controls prüfen derzeit:

- vier spartenbezogene Aufräum-/Abbruchkostenpositionen auf den Seiten 1, 2,
  4 und 5;
- drei spartenbezogene Positionen zum Entgang von Mietzinseinnahmen auf den
  Seiten 1, 2 und 4;
- zwei negative Haftpflicht-/Bauherr-Abbruchvorkommen auf Seite 17.

Zwei unveränderte Läufe R03 und R04 bestanden jeweils mit 22/22 Kandidaten und
9/9 Draft-Controls. Die validierten Ergebnisdateien sind bytegenau identisch.
Dies ist ein technischer Draft-PASS, keine fachliche Freigabe der mit
`REVIEW_REQUIRED` markierten Scopewerte.

## Entscheidungen vor der nächsten Ausweitung

1. Scope-Definition festlegen: Ist jede Sparte/besondere Bedingung relativ zur
   sichtbaren VS-Zeile `NARROW`, oder kann eine besondere Bedingung die
   allgemeine Definition der Komponente darstellen?
2. OR-02 entscheiden: Raum oder nur Einrichtung des Raums?
3. OR-03 und OR-09 fachlich bestätigen, bevor die rechtsköpfige
   Kostenkoordination als eigenes Inkrement implementiert wird.
4. Erst bestätigte Fälle von `REVIEW_REQUIRED` auf verbindliche Golden
   Controls hochstufen.
