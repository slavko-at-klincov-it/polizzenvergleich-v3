# Polizzenvergleich V3.2.2 RC1 – VS-Evidence-A/B

> **Historischer RC – nicht erneut ausrollen.** Der Qwen-3.8-27B-Kundenlauf
> endete mit LF und WEVIG jeweils bei `2/4` Oracle-Zeilen. Ursachen und lokal
> validierte Korrekturen stehen in
> `docs/VS_PILOT_27B_KUNDENBEFUND_FIX_VALIDIERUNG_DE.md`. Ein neuer RC benötigt
> vor der Freigabe einen erneuten Kundenlauf. Ersatz-RC:
> `docs/RELEASE_V3.3.0_RC1_DE.md`.

Stand: 27. August 2026
Release-Tag: `v3.2.2-rc.1`

## Zweck des Release Candidates

Dieser RC ist ein **diagnostischer Kunden-Hardware-Test**. Er vergleicht auf
demselben Mac, mit denselben zwei PDFs und demselben Qwen-Modell:

- A: den bisherigen monolithischen VS-01-bis-VS-36-Lauf;
- B: den neuen occurrence-genauen VS-Pilot für `VS-16`, `VS-17`, `VS-21`
  und `VS-28`.

Der RC ist noch keine Produktfreigabe für alle 320 sichtbaren Kategorien und
kein Nachweis, dass 100 % jedes unbekannten Vertrags erkannt werden. Er prüft
acht eingefrorene Dokument-/Zeilenfälle vollständig gegen ein serverseitiges
Oracle: vier VS-Zeilen auf LF und vier auf WEVIG.

`APPROVED` bezeichnet in diesem RC ausschließlich die technische Freigabe
dieses eingefrorenen Acht-Zellen-Oracles. Es ist weder eine allgemeine
fachjuristische Freigabe der Versicherungslogik noch eine Freigabe anderer
Dokumente, Kategorien oder Formulierungsvarianten.

## Was neu ist

Der Pilot zerlegt zusammengesetzte Kategorien in atomare Komponenten,
enumeriert alle kontrollierten Fundstellen auf allen PDF-Seiten und übergibt
Qwen nur occurrence-genaue Kandidaten. Das Modell darf ausschließlich bekannte
Candidate-IDs und begrenzte Wirkungswerte zurückgeben. Seite, Textspan, Werte,
Rollup und finale achtspaltige Tabelle werden serverseitig gebunden.

Zentrale Invarianten:

- fehlende Evidenz wird nie als `Nein` ausgegeben;
- WEVIG bleibt sichtbar `PROPOSAL / PROPOSED_ONLY`;
- unterschiedliche Sparten- oder Objektfakten sind kein Widerspruch;
- positive engere Scopefakten werden vollständig gesammelt, Ausschlüsse und
  unklare Treffer aber nicht automatisch ergänzt;
- `VS-21` bindet Limits an ausgewählte Quellen und normalisiert das belegte
  OCR-`l0 %` nachvollziehbar zu `10 %`;
- `VS-28` bindet `sechs Monaten` beziehungsweise `6 Monaten` zu `6 Monate`;
- Modellquellen, unbekannte Candidate-IDs und ungebundene Werte scheitern
  fail-closed.

Der Legacy-Lauf besitzt zusätzlich ein hartes Completion-Limit und private
Ausgaberechte, damit ein ausufernder Modelllauf den A/B-Test nicht unbegrenzt
blockiert. `polizzenvergleich-v3 update <tag>` reicht ein explizites Tag jetzt
korrekt an den Updater weiter.

## Eingefrorene Testquellen

| Dokument                             | Rolle             | Seiten | SHA-256                                                            |
| ------------------------------------ | ----------------- | -----: | ------------------------------------------------------------------ |
| LF IMMO / Generali                   | `FRAMEWORK_TERMS` |     31 | `2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62` |
| WEVIG Premiumschutz-Musterberechnung | `PROPOSAL`        |     21 | `a476cc2e0d970c0143e552bd7d901d82abd89324ba4cf316bc7ee3202a8b0b16` |

Andere PDF-Fassungen werden vom Pilotrunner wegen abweichendem Hash
abgewiesen. Die PDFs und privaten Laufartefakte sind nicht Teil des Git-Tags.

## Lokaler Vorabtest

Lokales Modell: `qwen3.5-4b-mlx`, Temperatur 0, zwei vollständige
Wiederholungen des neuen Pfads.

```text
Dokumentläufe:       4/4 PASS
Oracle-Zeilen:       16/16 PASS (8 Sollzellen × 2 Wiederholungen)
Triage-Kontrollen:   LF 5/5, WEVIG 13/13 je Wiederholung
Wirkungskontrollen:  LF 8/8, WEVIG 8/8 je Wiederholung
Tabellenvertrag:     4/4 PASS
Semantische Stabilität: LF PASS, WEVIG PASS
```

Current-Tree-Pilotreport (B, zwei Wiederholungen), SHA-256:
`899318936ae2f4dfc24c46755b6aeb0a8496e433571e938d0131c44c571d8bac`.

Zusätzlich wurde ein vollständiger lokaler A/B-Smoke mit je einer Wiederholung
ausgeführt:

| Dokument |          Legacy A | Pilot B | Legacy-Modellzeit | Pilot-Modellzeit |
| -------- | ----------------: | ------: | ----------------: | ---------------: |
| LF       | 0/4 Oracle-Zeilen |     4/4 |         229,312 s |         97,668 s |
| WEVIG    | 0/4 Oracle-Zeilen |     4/4 |         233,289 s |        179,464 s |

Der A/B-Gesamtreport ist `PASS`, `positiveEffectObserved: true`; SHA-256:
`23e805fdbc9b31ab584c8b3342cf024d1075aaa17e63291ca9cee12a3783409b`.
Diese Laufzeiten sind lokale Messwerte mit Qwen 3.5 4B, keine Prognose für
Qwen 3.8 27B auf der Kundenhardware.

Die finalen Gates vergleichen nicht nur erwartete Mindestbelege. Ausgewählte
Candidate-IDs, gerenderte Seiten und Wertquellen müssen als geschlossene Menge
mit dem Oracle übereinstimmen. Dadurch wurde insbesondere verhindert, dass die
WEVIG-Dauer für `VS-28` aus dem davorstehenden Ersatzunterkunftsabschnitt auf
Seite 9 übernommen wird: die Dauer `6 Monate` ist nun ausschließlich an die
Mietzinspositionen auf den physischen Seiten 1, 2 und 4 gebunden. Auch
ungelöste Kandidaten, zusätzliche Quellen sowie ein abweichendes tatsächliches
Antwort- oder Embeddingmodell lassen den Lauf fail-closed scheitern.

Wichtige erwartete Ergebnisse:

- LF `VS-16`: Garagen und Tiefgarage `BELEGT / Ja`;
- LF `VS-17`: nur Fahrradräume sprachlich berührt, daher
  `TEILBELEGT / Nicht feststellbar`;
- LF `VS-21`: `BELEGT / Ja`, Limits `10 %` und `15 %` getrennt;
- LF `VS-28`: `BELEGT / Ja`, Dauer `6 Monate`;
- WEVIG `VS-16` und `VS-17`: `UNGEKLÄRT / Nicht feststellbar`, niemals
  pauschal `Nein` oder `Ja`;
- WEVIG `VS-21`: im Vorschlag enthalten, `EUR 6.121.600,00`, Belege aus
  Feuer, Leitungswasser, Sturm und Glas;
- WEVIG `VS-28`: im Vorschlag enthalten, `6 Monate`, getrennte
  spartenspezifische Positionen.

## Installation auf dem Kunden-Mac

Der Release ist ein annotierter Git-Tag auf `origin/main`; ein separates ZIP
oder GitHub-Release ist nicht erforderlich.

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./doctor.command
./update.command v3.2.2-rc.1
./doctor.command
open http://127.0.0.1:3004
```

Der Updater aktiviert ausschließlich den angegebenen Forward-Tag. Schlägt die
Aktivierung fehl, stellt der Update-Fehlerpfad den vorherigen Code-, Datenbank-
und Frontendzustand wieder her. Ein erfolgreicher Forward-Update ist kein
automatisch erlaubter Downgrade; dafür wäre ein neuer Forward-Fix-Tag nötig.

## Kunden-A/B-Test mit Qwen 3.8 27B

Voraussetzungen in LM Studio:

- Chatmodell-ID: `qwen/qwen3.8-27b`;
- Embeddingmodell-ID: `dinghy-embed`;
- beide Modelle über den lokalen OpenAI-kompatiblen Server auf Port 1234
  erreichbar.

Dann mit den absoluten Pfaden zu exakt den beiden eingefrorenen PDFs starten:

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./run-vs-pilot-ab.command \
  "/ABSOLUTER/PFAD/LF-GENERALI.pdf" \
  "/ABSOLUTER/PFAD/Musterberechnung-WEVIG-Premiumschutz.pdf"
```

Der Runner führt A und B zweimal sequenziell aus. Er schreibt private
Artefakte mit Verzeichnisrechten `700` und Dateirechten `600` nach
`$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/VS-PILOT-27B-<Zeitstempel>`.
Dieser lokale Application-Support-Pfad vermeidet insbesondere eine mögliche
iCloud-Synchronisierung des macOS-Ordners `Documents`.

Entscheidend sind:

- `report.json`: muss `PASS` zeigen;
- `comparison.md`: zeigt Legacy A neben Pilot B;
- `run-*/LF/adapted/answer.md` und
  `run-*/WEVIG/adapted/answer.md`: serverseitig gerenderte Pilottabellen;
- `manifest.private.json`: Modell-, Runtime-, Git- und Vertragshashes.

Ein `REVISE` wird nicht automatisch wiederholt oder als PASS umgedeutet. Der
komplette Ausgabeordner bleibt wegen Vertragsinhalten außerhalb von Git und
Cloud-Synchronisation.

Ein vollständiger A/B-Lauf erhält nur dann `PASS`, wenn der Pilot B in jedem
LF-/WEVIG-Lauf mehr der vier eingefrorenen Oracle-Zeilen korrekt trifft als
Legacy A, alle Pilotzeilen das Oracle erfüllen, die Pilot-Endtabellen über
beide Wiederholungen stabil bleiben und LM Studio exakt das angeforderte,
geladene Modell meldet. Ein Gleichstand bedeutet daher bewusst `REVISE`: Dann
ist auf dieser Hardware kein positiver Effekt nachgewiesen.

## Release-Grenzen

- Der neue Kundenrunner ist ein expliziter QA-/Diagnosepfad, noch kein
  produktiver UI-Analysejob.
- Vollkatalog-Drafts für alle acht Kategorien sind Kandidateninventare, aber
  ohne flächendeckende Werte-, Relations- und Reviewer-Oracles kein
  Produkt-PASS.
- LF und WEVIG sind Entwicklungskorpora, keine unabhängigen Holdouts.
- Dokumentrang, Nachträge, neun Dokumente und das Unter-60-Minuten-SLO werden
  mit diesem RC nicht freigegeben.
- Es gibt keine Datenbankmigration in diesem RC.

Releaseentscheidung: `GO` für den begrenzten VS-A/B-Test auf Kundenhardware;
`NO PRODUCT PASS` außerhalb der acht eingefrorenen Pilotzellen.
