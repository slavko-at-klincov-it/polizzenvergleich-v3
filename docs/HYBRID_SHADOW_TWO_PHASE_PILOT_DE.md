# Zweiphasiger Hybrid-Shadow-Pilot

## Zweck und Beweisgrenze

Der Pilot prüft ausschließlich 10 bis 20 vorab gelabelte
Primär-Nullkomponenten. Er verändert weder Primär-Worksheets noch
Kundenergebnisse und ist nicht an den Kundenworker angebunden.

Der Lauf kann belegen:

- ob Dinghy bestätigte Primär-Misses in den ersten ein beziehungsweise drei
  exakten Spans findet;
- ob der normale Qwen-Triage- und Evidenzvertrag diese Fundstellen korrekt
  übernimmt;
- ob semantisch ähnliche, aber unzureichende Fundstellen abgelehnt werden;
- wie viele echte Nullkontrollen fälschlich ausgewählt werden;
- wie lange Embedding, Modellwechsel und zusätzliche Qwen-Aufrufe dauern.

Der additive Pilot kann keine reale Zeitersparnis des unveränderten
Primärlaufs beweisen. Primär-Nullkomponenten erzeugen heute keine Qwen-Aufrufe;
der Shadow fügt zunächst Arbeit hinzu. Eine spätere produktive
Routingentscheidung benötigt einen eigenen, versionierten Versuch gegen
bestehende Primär-Qwen-Aufrufe.

## Sicherheitsvertrag

Der Lauf ist fail-closed:

1. Das Pilot-Oracle muss 10 bis 20 eindeutige Fälle und alle Primärlauf-Hashes
   enthalten.
2. Oracle-Labels und erwartete Quote-Hashes werden nie in Suchquery,
   Shadow-Worksheet oder Qwen-Prompt übernommen.
3. Dinghy verarbeitet alle ausgewählten Dokumente vollständig, bevor Qwen
   geladen wird.
4. Dokumentchunks werden pro Dokument genau einmal embeddet und für alle
   ausgewählten Kategorien wiederverwendet.
5. Navigations- und exakte Span-Rankings werden mit Offsets und Quote-Hashes
   persistiert.
6. Das Search-Gate prüft vor Qwen alle erwarteten Dokumente, Kategorien,
   Fälle und Artefakt-Hashes. Ein partieller Search-Lauf sperrt Qwen.
7. Qwen läuft nur über die unveränderlichen Shadow-Worksheets. Komponenten
   ohne akzeptierten Span bleiben server-terminal und erzeugen keinen
   Modellaufruf.
8. Ein Fehler nach dem ersten Modellwechsel stellt Qwen im `EXIT`-Pfad wieder
   mit 42.496 Token Kontext her. Der Lauf gilt erst dann als fertig, wenn der
   Qwen-Zustand erneut verifiziert wurde.

Der auf dem Mac Studio real ausgewiesene Dinghy-Kontext beträgt 2.048 Token.
Der Runner fordert und verifiziert deshalb exakt 2.048 Token. Die
Retrievalchunks sind zusätzlich auf 3.000 Zeichen, die exakten Prüfspans auf
1.200 Zeichen begrenzt.

## Oracle-Klassen

- `POSITIVE`: bestätigte Primär-Miss-Fundstelle; erwartete Downstream-Auswahl.
- `ADVERSARIAL`: verwandte Fundstelle, die wegen Rolle, Scope oder fehlender
  Spezifität abgelehnt werden muss.
- `TRUE_NULL`: vollständige Negativkontrolle ohne ausreichende Fundstelle.

Die technische DRAFT-Auswahl ersetzt keine unabhängige fachliche Freigabe.

## Ausführung auf dem Mac Studio

Der Lauf darf gemäß Projektvertrag ausschließlich in einem isolierten
Mac-Studio-Validierungscheckout ausgeführt werden:

```bash
./run-hybrid-shadow-pilot.command \
  '/ABSOLUTER/PFAD/pilot.private.json' \
  '/ABSOLUTER/PFAD/embedding-contract.private.json' \
  '/ABSOLUTER/NEUER/PFAD/PILOT-AUSGABE'
```

Der Runner erwartet zu Beginn das exakt geladene Qwen-Modell. Danach führt er
in dieser Reihenfolge aus:

```text
Manifest und Primär-Hashes binden
→ Qwen gezielt entladen
→ Dinghy über die LM-Studio-CLI mit explizitem Kontext laden und Zustand prüfen
→ alle Embedding-Suchen
→ Search-Completion und Hash-Gate
→ Dinghy gezielt entladen
→ Qwen exakt wiederherstellen
→ Triage und Evidenzprüfung
→ Evaluation und erneute Qwen-Zustandsprüfung
```

## Ergebnisartefakte

- `manifest.private.json`: unveränderliche Primär-, Pilot- und Modellidentität;
- `search/complete.private.json`: Embeddingrequests und Suchwandzeit;
- `search-gate.private.json`: vollständiger Hash-Gate-Nachweis;
- `qwen/evaluation.private.json`: fallgenaue Oracle-Auswertung;
- `qwen/summary.json`: kompakte Qualitäts- und Qwen-Zeitmetriken;
- `qwen/complete.private.json`: Qwen-Phasenabschluss;
- `lifecycle.private.json`: Entlade-/Ladezeiten und Gesamtwandzeit.

Ausgewiesen werden getrennt:

- roher Recall@1 und Recall@3;
- Recall@1 und Recall@3 nach Mindestscore;
- Retrieval der bekannten adversarialen Spans;
- Pipeline-Recall nach Qwen;
- adversariale Ablehnungsquote;
- Auswahl-False-Positive-Rate auf echten Nullkontrollen;
- Embedding-API-Zeit und Requestanzahl;
- Qwen-Entlade-, Dinghy-Lade-, Dinghy-Entlade- und Qwen-Ladezeit;
- zusätzliche Qwen-Aufrufe, Providerzeit und gesamte Shadow-Wandzeit.
