# INC-003F – VS-/EL-/FE-Prompt-A/B auf LF und WEVIG

Stand: 27. August 2026

## Kurzurteil

Der occurrence-genaue, atomare Vorbereitungspfad zeigt auf den bewusst kleinen
VS-, EL- und FE-Pilotkatalogen einen positiven technischen Befund. Alle sechs
Kombinationen aus Kategorie und Dokument sind mit dem angepassten Pfad grün;
die finalen kritischen Läufe wurden je Dokument/Kategorie wiederholt.

Die unveränderten fertigen Kategorieprompts bleiben als Baseline erhalten.
Alle sechs monolithischen Vollprompt-Gegenläufe endeten `REVISE`. Der neue
Pfad verbessert nicht nur die formale Quellenbindung, sondern beseitigt in den
kontrollierten Fällen konkrete Rollen-, Scope- und Komponentenfehler.

Das ist noch kein Produkt-PASS für alle 36 VS-/EL- oder 80 FE-Zeilen. Der
angepasste Pfad prüft kleine Pilotkataloge mit 5, 9, 11 beziehungsweise 13
Reviewer-Controls. Eine direkte Laufzeithochrechnung auf alle Kategorien oder
neun Dokumente ist unzulässig.

## Zustands- und Quellen-Lock

```text
Repository: polizzenvergleich-v3
Branch: codex/polizzenvergleich-v3
Ausgangs-HEAD: c2e9cb275207af4a45e49649393f9a8792805cff
Modell: qwen3.5-4b-mlx
Embedding: text-embedding-dinghy-law-4b-v1
Temperatur: 0
Baseline Top-N: 55; tatsächlich 38 LF- bzw. 39 WEVIG-Chunks
```

Testquellen:

- LF IMMO / Generali, 31 physische Seiten, SHA-256
  `2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62`.
- WEVIG Premiumschutz-Musterberechnung, 21 physische Seiten, SHA-256
  `a476cc2e0d970c0143e552bd7d901d82abd89324ba4cf316bc7ee3202a8b0b16`.
  Das Dokument ist ein Vorschlag und wird deshalb im angepassten Pfad als
  `PROPOSED_ONLY`, nicht als bereits aktive Polizze behandelt.

Die drei Originalprompts wurden nicht verändert:

```text
VS: 0ff41d99eaa30eb516af5c60f536a39f381ce7184a46bbed4ce69525e47f466a
EL: d5b1c465f20836d6d3069aaba89b1d5d22d3eaeed1649a92638c7e1d3b304628
FE: f2bf41109b04e9d907ed7a9af82c1c4270b653718e2f168beb9c5f6132039637
```

## Was gegenüber der Baseline anders ist

Die Baseline schickt alle gefundenen Chunks und den vollständigen
Kategorieauftrag in einen einzigen Modellcall. Das Modell erzeugt die gesamte
Tabelle, Status, Deckungswerte, Quellen und Zitate frei.

Der angepasste Pfad trennt dagegen fünf Schritte:

1. Kontrollierte Aliase werden auf jeder physischen Seite vollständig
   enumeriert; Originaloffsets, physische Seite und sichtbare Seitenbezeichnung
   bleiben server-owned.
2. Der kleinste erkannte Absatz/Listeneintrag wird als Evidenzeinheit verwendet.
   Ein vorangehender Scope-Kontext und explizite Seitenhinweise wie
   „Die Sturmversicherung“ bleiben getrennte Lesesignale.
3. Zusammengesetzte Requirements werden atomisiert. Beispiel EL-16:
   `winter_garden` und `display_case` sind zwei Objektfakten.
4. Qwen erhält nur kleine Kandidatengruppen und darf ausschließlich bekannte
   Candidate-IDs sowie begrenzte Rollen-/Wirkungswerte zurückgeben.
5. Der Server validiert IDs, Rollen, Scope, Quellen und Rollups. Eindeutige
   Haftpflicht- oder Sondermüll-Scopefehler werden fail-closed abgewiesen;
   Quellen und sichtbare Ergebniszustände werden nicht vom Modell erfunden.

Die Kundenkategorien bleiben dabei Views. Intern entstehen atomare Fakten;
erst danach wird eine Kundenzeile gerollt.

## Realer A/B-Vergleich

`Modellzeit` ist die vom Provider gemeldete Summe der Qwen-Zeit. Baseline und
angepasster Pilot haben unterschiedliche Ergebnisumfänge; die Zahlen zeigen den
beobachteten Betrieb, nicht die prognostizierte Vollproduktlaufzeit.

| Kategorie | Dokument | Unveränderter Vollprompt | Modellzeit |                                Angepasster Pilot | Modellzeit | Controls |
| --------- | -------- | -----------------------: | ---------: | -----------------------------------------------: | ---------: | -------: |
| VS        | LF       |      `REVISE`, 36 Zeilen |    228,9 s |                            `PASS`, 17 Kandidaten |     19,8 s |      5/5 |
| VS        | WEVIG    |      `REVISE`, 36 Zeilen |    200,2 s |  `TECHNICAL_PASS_REVIEW_REQUIRED`, 28 Kandidaten |     52,5 s |    13/13 |
| EL        | LF       |      `REVISE`, 36 Zeilen |    248,2 s | `TECHNICAL_PASS_REVIEW_REQUIRED`, 12 Komponenten |     41,8 s |    11/11 |
| EL        | WEVIG    |      `REVISE`, 36 Zeilen |    317,2 s | `TECHNICAL_PASS_REVIEW_REQUIRED`, 12 Komponenten |     52,5 s |    11/11 |
| FE        | LF       |      `REVISE`, 80 Zeilen |    271,0 s |  `TECHNICAL_PASS_REVIEW_REQUIRED`, 9 Komponenten |     16,7 s |      9/9 |
| FE        | WEVIG    |      `REVISE`, 80 Zeilen |    234,1 s |  `TECHNICAL_PASS_REVIEW_REQUIRED`, 9 Komponenten |     22,3 s |      9/9 |

Finale Stabilitätswiederholungen:

```text
VS LF:      R03 5/5, R04 5/5
VS WEVIG:   R02 13/13, R03 13/13
EL LF:      R05 11/11, R06 11/11
EL WEVIG:   R05 11/11, R06 11/11
FE LF:      R03 9/9, R04 9/9
FE WEVIG:   R02 9/9, R03 9/9
```

Ein zusätzlicher EL-WEVIG-R04 fiel wegen einer schwankenden
`DEFINED`/`INCLUDED`-Etikettierung auf 10/11 zurück. Daraufhin wurde ein enges
serverseitiges Positivregel-Gate ergänzt. Es normalisiert `DEFINED` nur dann,
wenn der ausgewählte Originalspan für `PERIL`, `DAMAGE`, `INSURED_OBJECT` oder
`COST` einen expliziten positiven Marker wie „Versicherte Gefahren“,
„mitversichert“ oder „eingeschlossen“ enthält. R05 und R06 bestätigen diese
Regel mit jeweils 11/11; ohne positiven Marker greift sie nicht.

## Konkrete Unterschiede in den Beispielen

### VS – rechtsköpfige Kostenkoordination

LF Seite 5 enthält sinngemäß `Aufräumungs-, Abbruch-, ... Reinigungskosten`.
WEVIG enthält `Aufräum-, Abbruch- ... Isolierungskosten` in engerem
Radioaktivitätsscope. Der neue, katalogdeklarierte
`RIGHT_HEADED_COORDINATION`-Binder verbindet nur die aufgezählten
Hyphenkomponenten mit einem späteren gemeinsamen `-kosten`-Kopf.

Ergebnis:

- LF Aufräumung und Abbruch: beide `DIRECT`;
- allgemeine 10-%-Regel und engere Feuer-15-%-Regel bleiben getrennte Fakten;
- WEVIG Radioaktivitätsvarianten: `NARROW_SCOPE`;
- Abbrucharbeiten in der Bauherrenhaftpflicht: kein COST-Direktbeleg;
- allgemeine WEVIG-Definitionen auf physischen Seiten 8 und 13: `DIRECT`,
  nicht durch eine nachfolgende Radioaktivitätsklausel überfärbt.

### EL – EL-16 und Komponentenabdeckung

Der unveränderte LF-Vollprompt schrieb bei EL-16 sinngemäß: Wintergärten sind
versichert, Vitrinen ausgeschlossen, gab als sichtbare Deckung aber trotzdem
nur `Ja` aus. Der alte Vertrag konnte den gemischten Zustand nicht ausdrücken.

Der angepasste Pfad erzeugt:

```text
winter_garden: INCLUDED
display_case: EXCLUDED
evidenceCompleteness: COMPLETE
coveragePicture: MIXED
conflictState: NONE
```

Weitere kontrollierte Verbesserungen:

- EL-08 LF: nur Erdrutsch gefunden; Erdfall und Erdsenkung bleiben offen.
  Der Vollprompt hatte alle drei aus einem Teilbeleg pauschal bejaht.
- EL-19: Aufzugsobjekte belegen keinen Maschinenbruch. Objekt und Schadenart
  sind getrennte Komponenten.
- WEVIG-EL-16: Glasdächer/Glastrennwände werden nicht als Wintergarten oder
  Vitrine umgedeutet.
- EL-34 WEVIG: Terror ist belegt, Sabotage bleibt als fehlende Komponente offen.
- Erdrutsch in einer Bauherren-Haftpflichtklausel bleibt als serverseitig
  abgelehnter Treffer auditierbar, erreicht die EL-Deckungsentscheidung aber
  nicht.

### FE – Rollen- und Betragsbindung

Der unveränderte LF-FE-Lauf bewertete unter anderem Luft-/Raumfahrzeuge als
Beleg für Drohnen und Schäden durch Feuerwehreinsätze als Feuerwehrkosten. Der
unveränderte WEVIG-Lauf übernahm für FE-D05 sogar eine Blitzschlag-an-Bäumen-
Klausel als Rauch-/Rußdeckung und fand FE-D01 nicht.

Der angepasste Pfad trennt:

- indirekten Blitzschlag von seinem Limit;
- Feuerlöschkosten von Schäden durch Feuerwehreinsätze;
- allgemeine Feuerlöschkosten von engeren Sondermüllkosten;
- Rauch/Ruß von der zusätzlichen Bedingung „ohne eigenes Feuer“;
- einen Fahrzeuganprall von bloßen Fahrzeugobjekten;
- Drohnen von allgemeinen Luftfahrzeugen.

Der FE-ID-Validator akzeptiert jetzt sowohl `EL-01`-artige IDs als auch
`FE-A01` bis `FE-F10`. PDF-konkatenierte Klauselcodes wie
`...Elektroinstallationen12PG0340` gelten als zulässige Wortgrenze, ohne
gewöhnliche Wort-Suffixe wie `Garageneinrichtung` fälschlich zu treffen.

## Verifikation

```text
6 fokussierte Jest-Suites / 87 Tests: PASS
Prettier: PASS nach Formatierung
Originalprompts: Hash unverändert
Baseline-Vollpromptläufe: 6/6 REVISE
Finale angepasste Dokument/Kategorie-Paare: 6/6 technisch positiv
Private Laufordner: außerhalb Git unter ~/Documents/Polizzenvergleich-QA
Produktive Caller: keine
Kundenrelease: keiner
```

Kanonische finale Report-Hashes:

```text
VS LF adapted:       e23f39eb79e53447dd0bf3d0bde2cf11c4908814d5779befb56bf13dcedf1773
VS WEVIG adapted:    b46df4bb20e9b7efade9ff391e8849daa0cfae394accb0592b15f72104d40167
EL LF adapted:       acea92b278505fe9f0ecef6eaef48b54233e9478df2d5f41b5df60f5ca24287c
EL WEVIG adapted:    a042a83198b8fadfbd22fcfb7321bd48a519b0eeaa91aae1159f4c101f8de08e
FE LF adapted:       c3b4fed99eb776a9dd7519b5698fb3de9a895b5d5c04724b65e38c228418f5fe
FE WEVIG adapted:    28649936c25c6ce173b9b7b7e8e6b0c13bff42cb5ba4a6d900509698917bdcf9
```

## Grenzen und Reviewstatus

- Alle Fachcontrols tragen bei WEVIG und bei den generischen EL-/FE-Piloten
  weiterhin `REVIEW_REQUIRED`. Der technische Befund ersetzt keine
  Maklerfreigabe.
- Der Pilotkatalog ist keine vollständige Ontologie. Insbesondere die
  kontrollierten Aliaslisten müssen je Versicherer gegen Holdouts erweitert
  werden, ohne die heute grünen Negativfälle zu verlieren.
- Der aktuelle Plaintext-PDFLoader besitzt keine robuste Font-/Layoutgeometrie.
  Seiten-Scope-Hinweise sind deshalb bewusst eng und kein vollständiger
  Überschriftenbaum.
- Dokumentrang, Nachträge und Ersetzungsbeziehungen sind noch nicht Teil dieses
  Inkrements.
- Der neue Pfad besitzt noch keinen produktiven Analysejob, Renderer, Excel-
  Export oder UI-Caller.
- Der positive Laufzeitbefund gilt für die Pilotkomponenten, nicht für alle
  320 Sichtpunkte und nicht für neun Dokumente.

## Nächster kontrollierter Schritt

1. Die 5/13/11/9 Controls mit dem Makler als technische Golden Cases
   bestätigen oder korrigieren.
2. Den Pilotvertrag auf die vollständigen EL-36-Requirements ausweiten, jedoch
   weiter atomar und in kleinen Batches; Holdout-Fälle getrennt halten.
3. Erst bei stabilem EL-36-PASS einen internen Release Candidate bauen.
4. Auf dem Kunden-Mac-Studio denselben Baseline-/Adapted-Vergleich mit
   identischen PDF-, Prompt-, Katalog-, Runner- und Modellhashes in einem
   frischen Workspace wiederholen.
5. Erst danach Produktintegration, VS-Vollausbau und FE-80-Ausbau planen.

Empfohlene Releaseentscheidung für INC-003F:

```text
PASS: isolierter technischer Pilot und lokale A/B-Evidenz
REVIEW_REQUIRED: Fachoracle und WEVIG-Dokumentstatus
NO_RELEASE: noch keine produktive Integration und kein Kunden-Mac-Test
```
