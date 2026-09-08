# LF-Referenzmodus: Audit der 79 Teiltreffer und Kundenreview

## Ergebnis

Der vollstaendige, nicht autoritative Audit der 79 Zeilen mit dem
Produktergebnis `TEILWEISES_GEGENSTUECK` ist auf dem Mac Studio abgeschlossen.
Alle 79 Ergebnisrecords und ihre Fundstellen bestanden den Gesamtvalidator.
Der produktive V3.7.2-Basisvergleich wurde nicht veraendert.

Maschinelle Auditverteilung:

- 9 vollstaendige Gegenstueck-Kandidaten;
- 52 bestaetigte Teiltreffer;
- 6 Zeilen ohne entscheidungsreife Komponente;
- 2 als Widerspruch markierte Zeilen;
- 7 Audit-unklare Zeilen;
- 3 Zeilen ohne zusaetzlichen Fund im vollstaendigen Kandidatenbestand.

Eine manuelle Hochrisikostichprobe pruefte alle neun moeglichen Promotions und
beide Widerspruchsfaelle. Sie bestaetigte sieben Promotions als starke
Regelpruefkandidaten. Vier Modellbefunde duerfen nicht produktiv uebernommen
werden:

- `LR13-002`: Rettungskosten beziehungsweise allgemeine Schaeden durch
  Rettungsmassnahmen belegen die konkrete Wirkungsfolge Zerstoerung,
  Beschaedigung und Abhandenkommen nicht gleich praezise wie LF;
- `LR13-012`: die zitierte B-Passage wahrt eine Frist durch bindende Auftraege,
  verlaengert sie aber nicht um die Dauer eines Deckungsprozesses;
- `LR09-025`: A und B schliessen staendige Emissionen uebereinstimmend aus; es
  liegt insoweit kein Widerspruch vor;
- `LR13-023`: A und B nehmen Erstes-Risiko-Positionen uebereinstimmend vom
  Summenausgleich aus; es liegt insoweit kein Widerspruch vor.

Nach dieser Stichprobe sind sieben starke Promotionskandidaten, 56
Teiltreffer, sechs Zeilen ohne entscheidungsreifes Gegenstueck, sieben
Audit-unklare Zeilen und drei Zeilen ohne zusaetzlichen Auditfund fuer die
fachliche Kundenpruefung priorisiert. Das ist weiterhin kein neuer
Produktzaehlstand.

## Gebundener Lauf

- Source-Commit: `b759c60607d48a64d19dc8c62b64269285ce927f`
- Worktree:
  `/Users/michaelmischkot/Code/validation-worktrees/lf-partial-a545928f`
- Auditroot:
  `/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/QA/LF-PARTIAL-AUDIT-V10-B759C606-20260908`
- Modell: `qwen/qwen3.6-35b-a3b`
- Kontext: 42.496 Token
- Laufzeit: 7.511.026 ms, rund 125 Minuten
- Versuche je Fall: 68 mit einem, 3 mit zwei und 8 mit drei Modellaufrufen
- Index-SHA256:
  `179d0c22e68beebc9f99fce1178a668c91644a14d20a29c5985d73f757b375b0`
- Summary-SHA256:
  `b31950ec196e2939779e247a7a3425d92cc4e25dc91595f48691faa3442c47e2`
- Review-Packet-SHA256:
  `b3e77348a5a9093ad95ed04b4e230d4fd1a5243ffa64eb7fa8525fb4e215ebdb`
- Validation-SHA256:
  `112b46aa0e5cb029f6c4f5db8cdc3772371a3e359fdcea872eacdad8385dc712`
- Gesamtvalidator: `PASS`, 79/79 Records, 0 Findings

Der Server nahm 50 konservative Normalisierungen vor: 28 fehlende semantische
Anker, 13 nach drei Versuchen nicht bindbare Zitate, 5 verwaiste Limits ohne
belegten Gegenstand, 3 zeilenlokale Rebinds eines konkreten B-Limits und 1
Limitpassage ohne konkreten Vergleichswert.

## Wiederverwendbare Vertraege

Der Audit ist eine getrennte, advisory-only Sidecar-Pipeline. Er bindet jeden
Fall an Basiszeile, Dokumentinventar, Dokumenthashes, physische Seiten,
Run-Signatur, Modellidentitaet und Source-Commit. Er darf den Basisvergleich
nicht mutieren.

Die sicheren, dokumentneutralen Regeln sind:

1. Ersatzunterkunft ist kein Gegenstueck fuer Zwischenlagerung; wirtschaftlich
   benachbarte Kostenarten duerfen sich nicht gegenseitig belegen.
2. Ein Limit darf keinen Teiltreffer tragen, wenn kein zugehoeriger Gegenstand,
   keine Gefahr, Kostenart oder Leistung belegt ist.
3. Ein abweichender B-Betrag bleibt ein vergleichbarer Wert desselben
   Gegenstands und wird getrennt von A dargestellt.
4. Ein zeilenlokaler Limit-Rebind darf nur aus einer bereits belegten
   Gegenstands-, Gefahren-, Kosten- oder Leistungspassage stammen, nie allein
   aus Dauer-, Melde- oder Nebenbedingungen.
5. Nicht wortgetreu bindbare Zitate werden hoechstens zweimal korrigiert und
   danach fail-closed als unklar markiert.
6. Mehrere B-Fundstellen bleiben getrennt nach Dokument und physischer
   PDF-Seite erhalten.

## Kundenarbeitsmappe

Die erzeugte Arbeitsmappe liegt lokal unter:

`/Users/slavkoklincov/Code/AnythingLLMStudio-Versicherung/outputs/01a07c4a-fefe-73a2-a868-8fa7930b3cef/LF-IMMO-Review-V3.7.2-2026-09-08.xlsx`

SHA256:
`8ab9fd46bb43d1400baa63f8a4764600736e3dbcefabcebde5961edfdd2ee030`

Sie enthaelt drei Blaetter:

1. `LF Review`: 283 LF-Zeilen in unveraenderter Quellreihenfolge mit A-Inhalt,
   A-Werten, A-Fundstelle, B-Gegenstuecken, B-Werten, B-Fundstellen,
   kundenlesbarem KI-Status, Pruefhinweis und leerer letzter Spalte
   `Fachliche Bewertung (manuell)`;
2. `Auditbelege`: 253 komponentenbezogene Zeilen fuer alle 79 Teiltreffer mit
   Dokument, physischer PDF-Seite und exaktem Zitat;
3. `Hinweise unklare Zeilen`: die auf 172 verbleibende Zeilen gebundenen
   Vorschlaege des vollstaendig validierten 177er Alt-Audits, ausdruecklich
   getrennt und nicht autoritativ.

Der unabhaengige XLSX-Readback bestaetigte 283/283 A:G-Zeilen zellgenau gegen
die V3.7.2-Referenz, 283 leere manuelle Bewertungszellen, 79 Auditzeilen, 253
Belegzeilen, 172 Alt-Audit-Hinweise und null Tabellenfehler.

## Beweisgrenze

Der Audit betrifft ausschliesslich die 79 Teiltreffer des bekannten,
entwicklungsnahen LF-/WEVIG-1+9-Laufs. Auch die sieben starken
Promotionskandidaten benoetigen eine produktive Regel, positive und negative
Regressionen sowie fachliche Freigabe. `NO_ADDITIONAL_MATCH_IN_CANDIDATES` ist
kein kontrollierter Paket-Nullfund. Es gibt weiterhin keinen unbekannten
Mehrversicherer-Holdout und keinen 99-Prozent-Nachweis. Kein Merge, Tag oder
Deployment wurde durch diesen Audit freigegeben.
