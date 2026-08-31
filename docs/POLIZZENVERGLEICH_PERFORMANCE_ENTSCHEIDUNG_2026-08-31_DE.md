# Performance-Entscheidung für den paketweiten Polizzenvergleich

Stand: 31. August 2026

## Entscheidung

Die ungefähr vier Stunden entstehen nicht beim A/B-Vergleich und nicht
hauptsächlich bei Dinghy. Die dominante Ursache ist die seriell ausgeführte,
zweistufige Modellarbeit pro Dokument, Kategorie und atomarem Ziel. Im
vollständigen Referenzlauf entfielen 13.121 von 14.940 Sekunden auf 467 reguläre
Chatmodell-Aufrufe. Das sind 87,8 Prozent der gesamten Wandzeit; zusätzliche
HP-Hybridaufrufe waren in diesen 467 Calls noch nicht enthalten.

Der erste Canary bündelt deshalb ausschließlich die bis zu drei bereits
gerankten Chunks desselben HP-12-Ziels. Er bündelt keine verschiedenen
atomaren Ziele, ändert weder Ranking noch Faktvertrag und bleibt bis zum
bestandenen A/B-Oracle standardmäßig deaktiviert.

Der Canary allein kann das 60-Minuten-Ziel nicht erreichen. Ein kalter,
erstmaliger Zehn-Dokumente-Lauf benötigt dafür eine Kombination aus
nachgewiesener Modellbeschleunigung und wesentlich weniger Modellentscheidungen.
Ein warmer Wiederholungs-, UI- oder Vergleichsregellauf kann mit einem
geschichteten semantischen Cache dagegen realistisch unter 60 Minuten fallen.

## Messbasis und Grenzen

- Zielhardware: Apple M2 Max, 32 GB RAM, LM Studio.
- Referenzmodell: `qwen/qwen3.8-27b`, Kontextlimit 42.496, Reasoning aus.
- Embedder: `dinghy-embed`.
- Vollständiger Referenzlauf: 80 Kategorien, 14.940 Sekunden Wandzeit,
  13.121 Sekunden reguläre Providerzeit, 350 Triage- und 117 Effects-Calls,
  ungefähr 1,095 Millionen Prompttokens.
- Zwei große Dokumente des aktuellen Laufs: 255 reguläre Aufrufe einschließlich
  eines Retries, 7.479,35 Sekunden Providerzeit, 593.326 Prompt- und 18.013
  Completiontokens.
- Darin: 187 Triage-Calls mit 4.423,47 Sekunden und 68 Effects-Versuche mit
  3.055,88 Sekunden.
- Die beiden Dokumente verursachten zusätzlich zwölf HP-Hybridcalls mit rund
  324,6 Sekunden Providerzeit.
- Die Zahlen belegen nur die genannten Artefakte, Modelle und Konfigurationen.
  Sie sind kein Nachweis beliebiger Polizzenqualität oder des 99-Prozent-Ziels.

Selbst wenn der gesamte Nichtprovideranteil des Referenzlaufs unverändert bei
1.819 Sekunden bleibt, stehen für ein 60-Minuten-Ziel nur 1.781
Providersekunden zur Verfügung. Das erfordert gegenüber 13.121 Sekunden eine
Reduktion von 86,4 Prozent. Beim damaligen Mittelwert entspräche das ungefähr
63 statt 467 regulären Calls. Eine reine vierfache Beschleunigung der
Providerphase ergäbe noch ungefähr 85 Minuten.

## Root Cause im Code

1. Der Worker verarbeitet Dokumente nacheinander.
2. Der Shell-Runner verarbeitet die acht Kategorien nacheinander.
3. Die Triage wartet pro modelloffenem atomarem Ziel auf einen eigenen Call.
4. Die Wirkungsprüfung wartet danach erneut pro nicht deterministisch lösbarem
   Ziel auf einen eigenen Call.
5. Der HP-Hybridfallback führte bislang zusätzlich einen Chatcall pro Ziel und
   geranktem Chunk aus.
6. Der eigentliche Paketvergleich wird erst danach serverseitig erzeugt und ist
   nicht der mehrstündige Engpass.

Retries sind nicht die Root Cause: In den ersten 255 regulären Calls trat nur
ein Retry auf. Auch Embeddings und Initialisierung können die benötigte
86-prozentige Reduktion nicht liefern.

Für das vollständig ausgewertete große Referenzdokument verteilte sich die
reguläre Providerzeit wie folgt: EL 17,1 Prozent, HP 16,5 Prozent, VB 14,7
Prozent, FE 11,8 Prozent, VS 11,2 Prozent, ST 10,2 Prozent, WE 9,6 Prozent und
LW 9,0 Prozent. Die drei größten Kategorien erklären nur 48,2 Prozent. Eine
einzelne Kategorie abzuschalten wäre daher weder fachlich zulässig noch ein
ausreichender Performance-Fix.

## Priorisierte Maßnahmen

| Priorität | Maßnahme | Erwartete Wirkung | Aufwand | Qualitätsrisiko | Beweistest |
|---|---|---|---|---|---|
| 1 | Streng deterministische Call-Elimination für einstimmige Shared-Spans und explizite lokale Klauseln | Größter kalter Call-Hebel; auf zwei Dokumenten höchstens 52 Shared-Span-Triagecalls beziehungsweise rund 20,5 Provider-Minuten, belastbarer Anteil noch zu messen | Mittel | Mittel bis hoch bei gemischter Rolle, Scope, Negation oder fehlendem Governor | Offline-Replay aller eingefrorenen Targets, positive/negative/adversariale Varianten und ungesehener Holdout; bytegenaue Fakten-/Quellen-/Zeilenprüfung |
| 2 | Qwen-35/36B-A3B als Challenger mit Reasoning aus | Potenziell deutlich schnelleres Decode durch rund 3B aktive Parameter; allein selbst bei 4× noch nicht ausreichend | Niedrig für Benchmark, mittel für Betriebsvertrag | Mittel: JSON, österreichische Fachsemantik, Truncation und Stabilität unbewiesen | Identische versionierte Triage-/Effects-Payloads, kritisches Expertenoracle, zwei Wiederholungen, mindestens 2,5× Providergewinn, kein Swap/Decodefehler |
| 3 | Target-internes HP-Chunk-Batching 3→1 | Maximal 60→20 versteckte Calls bei zehn langen Dokumenten; Zeitgewinn muss gemessen werden | Niedrig | Niedrig bis mittel: Cross-Chunk-Konditionierung und größerer Retry-Radius | Eingefrorene Rankings, positive und negative Dokumente, Reihenfolgevarianten, identische Quotes/Candidate-IDs/HP-Zeilen, mindestens 25 Prozent Hybridzeitgewinn |
| 4 | Geschichteter content-addressed Cache plus Facts-/Comparison-Replay | Warm theoretisch bis zu 3:38 Stunden Providerarbeit wiederverwendbar; Restzeitrechnung etwa 30 Minuten, kein Benchmark | Hoch | Hoch bei falscher Invalidierung, Rollen-/Nachtragsverlust, Privacy oder unvollständigem Publish | Layer-Key-Mutationstests, Crash-/Atomicity-/GC-/Owner-Isolationstests und Paketrollup-Replay |
| 5 | Dinghy paketweit vorbereiten, Rankings persistieren, einmal entladen | Primär Speicherfreigabe für A3B; geringe direkte Zeitwirkung | Mittel | Niedrig bei unveränderten Chunk-IDs/Rankings, sonst hoch | Identische Rankings/Spans mit Prepare- und Replay-Pfad; Speicher, Swap und Modellreload messen |
| 6 | Homogene Cross-Target-Batches | Potenziell großer Callhebel, derzeit nicht freigegeben | Hoch | Hoch: Rollen-, Scope-, Target-ID- und Retryvermischung | Erst nach Target-Chunk-Canary; per Item isolierter Parser, Fallback und vollständiges Fachoracle |

## Modellentscheidung

Das aktuelle `Qwen/Qwen3.8-27B` ist ein dichtes 27B-Modell. Der passende
Challenger ist `Qwen/Qwen3.6-35B-A3B` (alternativ die ältere
`Qwen/Qwen3.5-35B-A3B`-Familie): ungefähr 35/36B Gesamt- und 3B aktive
Parameter. Die LM-Studio-MLX-4-bit-Datei der 3.6-Variante liegt bei ungefähr
20,4 GB. Das ist größer als die aktuell geladene 27B-Quantisierung mit rund
16,1 GB; die aktive MoE-Größe verspricht Decode-Geschwindigkeit, nicht weniger
Modellspeicher.

`google/gemma-4-26B-A4B-it` ist mit ungefähr 25,2B Gesamt- und 3,8B aktiven
Parametern ebenfalls schnellheitsrelevant. Frühere projektinterne Evidenz zeigte
jedoch trotz rund 33,9 Prozent Zeitgewinn deutliche Breitenverluste. Es ist
deshalb kein primärer MVP-Challenger.

Ein kleines 4B-Modell darf Triage zunächst nur im Shadow-Modus ausführen. Ein
falsches `MENTION_ONLY` entfernt Evidenz irreversibel, bevor 27B die Wirkung
prüfen kann.

Primärquellen:

- [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B)
- [Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
- [LM Studio Qwen3.6-35B-A3B](https://lmstudio.ai/models/qwen/qwen3.6-35b-a3b)
- [Gemma 4 26B-A4B](https://huggingface.co/google/gemma-4-26B-A4B-it)

## Dinghy-Entscheidung

Dinghy wird produktiv derzeit nicht in jeder Kategorie benötigt. Es arbeitet
im HP-Hybridfallback für zwei additive HP-12-Ziele mit jeweils Top-3-Ranking.
Es darf nicht ersatzlos entfernt werden: In der bekannten WEVIG-Evidenz
reparierte der Hybridpfad einen HP-12-Falschnegativfall, während 35 andere
HP-Zeilen stabil blieben.

Ein Entladen nach jedem Dokument wäre in der aktuellen dokumentweisen Pipeline
Modellchurn, weil das nächste Dokument Dinghy erneut benötigt. Der Zielpfad ist:

1. alle Dokumente extrahieren und chunken;
2. alle Dinghy-Embeddings und Rankings paketweit persistieren;
3. Dinghy einmal entladen;
4. das Chatmodell für Spanwahl, Triage und Wirkung verwenden.

Dinghy bleibt Navigation, niemals Beweis. Beleg, Seite, Offset und exakter Span
bleiben servervalidiert.

## Cache- und Invalidierungsvertrag

Der heutige Resume-Key hasht Releaseidentität, Modellkonfiguration und die
gesamte Dokumentliste. Die Releaseidentität umfasst HEAD sowie alle dirty und
untracked Dateien. Dadurch invalidieren UI-, Test- oder Dokumentationsänderungen
bei einem Neulauf unnötig semantische Dokumentarbeit; ein Paketdokument ändert
den Key aller übrigen Dokumente. Cross-Session-Reuse identischer PDF-SHAs ist
nicht möglich.

Erforderliche unabhängige Schichten:

1. PDF-SHA + Extraktor-/PageMap-Vertrag;
2. Extraktion + Katalog + Worksheet-Builder;
3. Chunk-, Embedding- und Ranking-Key;
4. geordneter Spanselection-Payload + Prompt/Modell/Parser/Batchvertrag;
5. Single-Target-Triage-Key;
6. Effects/Facts + Dokumentstatus + deterministische Regeln;
7. Rows/Quellen + Renderer;
8. Paketrollup + Rollen, Status, Reihenfolge und Rangregeln;
9. Vergleichsregel separat;
10. UI, XLSX und Markdown separat.

Artefakte müssen immutable, owner-/workspace-scoped, atomar publiziert und erst
nach vollständiger Schema-/Dependency-Prüfung sichtbar werden. Reset,
Retention, Leases und referenzsichere Garbage Collection gehören zum Vertrag;
ein vollständiger CAS-Umbau ist kein verantwortbares Vier-Stunden-Änderungspaket.

## Canary-Implementierung

Commit: `dfd981a2c9caca2592f88a1ffccedbee9816da3d`

Der Hybridrunner unterstützt nun `--maxChunksPerCall 1..3`, standardmäßig
weiterhin `1`. Bei `3` bleiben alle Chunks innerhalb desselben atomaren Ziels.
Der bestehende Parser validiert jede Chunk-ID und jedes Zitat einzeln. Ein nach
Retries formal ungültiger Mehrfachbatch bricht sichtbar ab und fällt nicht
still auf das negative Base-Worksheet zurück.

Für den A/B-Test kann `--frozenRankingsReport` exakt dieselben geordneten
Chunk-IDs und Scores wiederherstellen, ohne Dinghy erneut aufzurufen. Der
Runner prüft Dokumentfingerprint, Katalog, Chunkvertrag, Zielmenge, Chunk-IDs
und Scores. Report-Telemetrie enthält Batchvertrag, Batch- und Modellcallzahl.

Die produktive Shell-Pipeline übergibt den neuen Parameter noch nicht. Der
Canary verändert daher den laufenden oder den nächsten Kundenlauf nicht.

## Kontrollierter Benchmark

Mac-Studio-Validation-Worktree:
`/Users/michaelmischkot/Code/polizzenvergleich-v3-validation-35b26a0c`

- Commit: `dfd981a2c9caca2592f88a1ffccedbee9816da3d`
- Runtime: Node `v22.23.2`
- Modell: `qwen/qwen3.8-27b`, Kontextlimit 42.496, Temperatur 0,
  maximal 1.024 Outputtokens, zwei Versuche
- Rankings: drei private, eingefrorene aktuelle Dokumentartefakte; zwei
  positive und ein negativer Hybridfall
- Vergleich: 18 Single-Chunk-Calls gegen 6 Target-Batches; zweite
  Batch-Wiederholung für Stabilität

Harte Abbruchkriterien:

- irgendein unzulässiger neuer positiver oder negativer Fakt;
- anderer akzeptierter Originalspan oder andere Candidate-ID;
- Änderung der HP-12-Endaussage oder einer Nachbarzeile;
- Reihenfolge-/Wiederholungsinstabilität;
- stiller Fallback nach strukturellem Batchfehler;
- mehr Retries oder weniger als 25 Prozent Hybrid-Stufenzeitgewinn.

### Messergebnis

Der Benchmark begann erst nach vollständigem Ende des Kunden-Workers. Syntax,
ESLint und die reinen Vertragschecks waren grün. Zwei fokussierte Jest-Suites
mit insgesamt elf Tests bestanden auf dem Mac Studio.

Der erste positive Holdout reichte für einen harten Abbruch:

| Metrik | Single-Chunk | Target-Batch 3→1 | Änderung |
|---|---:|---:|---:|
| Modellcalls | 6 | 2 | −66,7 % |
| Providerzeit | 138,181 s | 84,025 s | −39,2 % |
| Wandzeit der Stufe | 138,299 s | 84,155 s | −39,1 % |
| Prompttokens | 10.133 | 6.715 | −33,7 % |
| Completiontokens | 909 | 881 | −3,1 % |
| Retries | 0 | 0 | unverändert |
| akzeptierte/ergänzte Kandidaten | 1 | 2 | **nicht äquivalent** |

Der frische Single-Lauf reproduzierte exakt den bisherigen Kandidaten für
`HP-12:environmental-damage`, einschließlich Candidate-ID, Relation, Seite und
Offsets. Der Batch ergänzte denselben Kandidaten, akzeptierte durch den
gemeinsamen Kontext aber zusätzlich einen `PARTIAL_EXPLICIT`-Kandidaten auf
einem anderen Chunk. Ohne fachlich approbiertes Oracle darf diese Abweichung
weder als Verbesserung noch als Fehler umgedeutet werden. Sie belegt jedoch,
dass das Batching die Modellentscheidung verändert und den geforderten
Äquivalenz-Gate verletzt.

Entscheidung: **No-Go für produktives `maxChunksPerCall=3`**. Die vorbereitete
zweite Wiederholung und die beiden weiteren Dokumente wurden nach dem ersten
harten Qualitätsfehler gezielt beendet. Die aktive Shell bleibt bei
Einzelcalls. Der gemessene Zeitgewinn ist real, aber unter dem bindenden
Qualitätsvertrag nicht nutzbar.

## Vier-Stunden-MVP-Plan

1. Minute 0–45: Messbasis, Codepfade, Qualitätsinvarianten und Oracle
   einfrieren.
2. Minute 45–90: Target-internen Hybrid-Canary standardmäßig inaktiv
   implementieren und reine Vertragschecks ausführen.
3. Minute 90–120: Nach Ende des Kundenlaufs Single gegen Batch auf identischen Rankings
   messen; nur bei vollständigem Oracle-Pass und mindestens 25 Prozent Gewinn
   produktiv aktivieren.
4. Minute 120–180: Einen A3B-Challenger auf identischen
   Triage-/Effects-Payloads vorbereiten; ein Modell-Download oder -Wechsel zählt
   nur dann zum Zeitfenster, wenn der Kundenlauf beendet ist. Thinking explizit
   aus, Dinghy vorher paketweit abgeschlossen und entladen.
5. Minute 120–210 parallel: Einen reinen Artifact-Replay zählen lassen, wie viele
   Shared-Span-Ziele der einstimmige deterministische Vertrag wirklich lösen
   kann. Erst danach Code ändern.
6. Minute 180–240: Messergebnis, Go/No-Go und Layer-Key-ADR dokumentieren sowie
   Facts-/Comparison-Replay planen; keinen ad-hoc Shared Cache ohne Privacy-,
   Publish- und Löschvertrag bauen.

## Prognose für höchstens 60 Minuten

- Warmer Wiederholungs-, UI- oder Vergleichsregellauf: realistisch, sobald
  Facts und Schichten korrekt wiederverwendbar sind.
- Kalter unbekannter Zehn-Dokumente-Lauf: mit dem heutigen Pfad und nur einem
  Modellwechsel nicht belegt. Er benötigt ungefähr 86 Prozent weniger
  Providerzeit, also eine Kombination aus validierter A3B-Beschleunigung,
  deterministischer Call-Elimination und anschließend vorsichtig erweitertem
  Batching.
- Die aktuelle Evidenz erlaubt deshalb keine Zusage von höchstens 60 Minuten,
  aber einen klaren, messbaren Pfad dorthin.
