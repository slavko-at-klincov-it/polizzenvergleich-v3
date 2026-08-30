# Polizzenvergleich V3.3.1 – evidenzgebundener Hybrid-Fallback

Stand: 30. August 2026

Release-Tag: `v3.3.1`

## Zweck

V3.3.1 übernimmt den nachgewiesenen Recall-Vorteil des breiten
V3.2.1-Chunkings, ohne dessen monolithische Schlussfolgerung zu reaktivieren.
Breite, seitengebundene `3000/250`-Chunks und Dinghy dienen ausschließlich der
Navigation zu möglichen Fundstellen. Nur ein exakter, eindeutiger Originalspan
darf danach als modelloffener Kandidat in die bestehende Rollen-, Scope- und
Wirkungsprüfung gelangen.

Der erste produktiv aktivierte Vertikalfall ist `HP-12`:
Umweltschäden und der Bezug zum Bundes-Umwelthaftungsgesetz. Die technische
Grundlage ist wiederverwendbar; die fachliche Aktivierung weiterer Ziele
benötigt jeweils eigene Positiv-, Negativ- und Stabilitätskontrollen.

## Sicherheitsvertrag

```text
ungelöste atomare Komponente
  -> page-aware 3000/250-Navigationschunks
  -> Dinghy-Ranking mit höchstens drei Chunks je Ziel
  -> getrennte semantische Auswahl je Ziel und Chunk
  -> exakter eindeutiger Originalspan, maximal 900 Zeichen
  -> serverseitiger Zielanker und Offsetprüfung
  -> normale Rollen-/Scope-Triage
  -> normale Wirkungsprüfung und serverseitige Tabelle
```

- Ein Ähnlichkeitsscore ist niemals ein Vertragsfakt.
- Ein breiter Chunk wird niemals als Beleg weitergereicht.
- Erfundenes, nicht eindeutiges oder fachlich unankertes Zitat endet
  `UNRESOLVED` und wird nicht automatisch repariert.
- Hybridspans bleiben modelloffen und erhalten keine deterministische
  Positivbindung.
- Der Hybrid-Semantikvertrag präzisiert nur die fachliche Frage. Er ist kein
  Beweis und erzwingt kein `MATCH`.
- Der Hybrid-Zusatzprompt wird nur für Hybridziele geladen. Normale Kandidaten
  verwenden byteidentisch den bisherigen Triage-Systemprompt.
- Modell- und Embedding-ID sind Bestandteil des Laufmanifests; ein unsicherer
  Resume oder ein falsches LM-Studio-Modell bricht den Lauf ab.

## Reale Zielhardware-Abnahme mit Qwen 3.8 27B

Dokument: WEVIG-Musterberechnung, SHA-256
`a476cc2e0d970c0143e552bd7d901d82abd89324ba4cf316bc7ee3202a8b0b16`.

Konfiguration: `qwen/qwen3.8-27b`, Temperatur 0, Tokenlimit 42496,
`dinghy-embed`, Dokumentrolle `PROPOSAL`.

```text
PASS: 38/38 Triage-Kandidaten und Kontrollen
PASS: 63/63 atomare Komponenten und Kontrollen
PASS: 36/36 HP-Endzeilen
PASS: genau HP-12 geändert, übrige 35 HP-Zeilen unverändert
PASS: HP-25 nach Promptisolation wieder exakt identisch zur Basis
PASS: normaler Basis-Systemprompt vor/nach Änderung byteidentisch
```

`HP-12` ändert sich kontrolliert:

```text
vorher: Umweltschäden ausgeschlossen; B-UHG geregelt / Nein
danach: Umweltschäden eingeschlossen; B-UHG geregelt / Ja
Quelle: exakter positiver Versicherungsschutzspan auf PDF-Seite 16
```

Der zuvor verwendete breite Kontext enthielt zusätzlich einen benachbarten
Ausschluss und erzeugte dadurch eine falsche Polarität. V3.3.1 übergibt nur
den gewählten exakten Span; positive Grundregel und benachbarte Ausschlüsse
werden nicht zu einem künstlichen Gesamtfakt verschmolzen.

## Weitere Kontrollen

```text
PASS: lokaler WEVIG-4B-Vergleich verbessert HP-12, 35 HP-Zeilen stabil
PASS: GRAWE-Negativkontrolle – 0 Hybridkandidaten zugelassen
PASS: UNIQA-Negativkontrolle – 0 Hybridkandidaten zugelassen
PASS: erfundene, mehrdeutige und zielunverankerte Zitate fail-closed
PASS: 94 Jest-Suites / 1.098 Tests mit gebündelter Node 22.23.2
PASS: Syntaxprüfung, Shellprüfung und git diff --check
```

GRAWE und UNIQA sind in diesem Test nur Nichtaktivierungskontrollen, keine
vollständigen fachlichen Vertragsoracles.

## Update

Nach Veröffentlichung von Commit und annotiertem Tag auf `origin/main`:

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.1
./doctor.command
```

## Beweisgrenze

V3.3.1 beweist eine sichere Kombination aus breiter Navigation und enger
Evidenzbindung für den aktivierten `HP-12`-Fall sowie Stabilität der übrigen
HP-Zeilen im dokumentierten WEVIG-Lauf. Es beweist weder 99 Prozent
Endergebnisqualität noch beliebige Polizzen, vollständige Mehrdokumentpakete
oder fachliche Generalisierung auf unbekannte Versicherer. Dafür fehlen
weiterhin versionierte Expertenoracles und zuvor ungesehene vollständige
Multi-Versicherer-Holdouts.
