# Polizzenvergleich V3.5.0 – Qwen 3.6 MLX als alleiniger Modellpfad

Stand: 31. August 2026

Release-Tag: `v3.5.0`

## Entscheidung

V3.5.0 ersetzt den produktiven Modellstandard `qwen/qwen3.8-27b` durch
`qwen/qwen3.6-35b-a3b`. Die Anwendung lädt beim Serverstart genau ein lokales
LM-Studio-Modell. Bereits geladene Chat- und Embeddingmodelle werden zuvor
entladen; Dinghy wird nicht mehr automatisch geladen oder vom produktiven
Acht-Kategorien-Runner angefordert.

Der feste Lastvertrag lautet:

```text
Quelle: lmstudio-community/Qwen3.6-35B-A3B-MLX-4bit
API-Identifier: qwen/qwen3.6-35b-a3b
Kontext: 42.496 Token
Parallelität: 1
MLX-KV-Cache: 8 Bit, Gruppe 64, Quantisierung ab Token 0
MTP-Speculative Draft: aus
Thinking: standardmäßig aus
```

Qwen 3.6 wird als reine Textansicht vorbereitet. Die großen MLX-Gewichte
werden nicht dupliziert, sondern aus dem unveränderten heruntergeladenen
Modell referenziert. Dadurch kann LM Studio die 8-Bit-KV-Cache-Quantisierung
verwenden, die der Vision-Ladepfad dieser Modellablage nicht unterstützt.

## Gemessene Entscheidungsbasis

Der direkte VS-Modellvergleich lief auf dem Kunden-Mac-Studio mit identischen
deterministischen Worksheets, identischen Systemprompts und Payload-Hashes,
42.496 Token Kontext, Temperatur 0, Parallelität 1 und Reasoning/Thinking aus.
LF enthielt 122 Kandidaten und 65 zu prüfende Komponenten, WEVIG 155
Kandidaten und 65 Komponenten.

| Modell | VS-Modellstufe LF + WEVIG | Verhältnis |
|---|---:|---:|
| Qwen 3.6 35B-A3B MLX 4 Bit | 219,324 s (3:39,3) | 1,00× |
| Qwen 3.8 27B | 1.101,400 s (18:21,4) | 5,02× langsamer |

Qwen 3.6 benötigte damit in diesem exakt begrenzten VS-Vergleich 80,1 Prozent
weniger Wandzeit beziehungsweise war 5,02-mal so schnell.

Die Qualitätsaussage ist bewusst enger als „beliebige Polizzen“:

- Qwen 3.6 traf 72 von 72 VS-Kernzeilen der akzeptierten RC33-Basis;
- der frische Qwen-3.8-Lauf traf 71 von 72 Kernzeilen;
- 71 von 72 Kernzeilen waren zwischen beiden frischen Modellläufen identisch;
- WEVIG war zwischen den Modellen 36 von 36 Kernzeilen identisch;
- der einzige Unterschied lag bei LF `VS-21`: Qwen 3.6 band die allgemeine
  Quelle auf Seite 5 korrekt ein, der frische Qwen-3.8-Lauf nicht;
- beide Läufe bestanden die formalen Gates ohne Retry; Qwen 3.6 benötigte bei
  WEVIG zwei zulässige Candidate-ID-Korrekturen, Qwen 3.8 keine.

Damit ist die bereits akzeptierte VS-Kernqualität unter diesem Laufvertrag
erhalten. Die Zahlen beweisen weder Gleichheit aller generierten Texte noch
die Qualität der übrigen sieben Kategorien oder unbekannter Versicherer.

## Änderung des Embedding- und HP-Pfads

Der bisherige Dinghy-Hybridfallback für zwei additive Komponenten von `HP-12`
ist im produktiven Runner nicht mehr aktiv. Das ist eine bewusste
Betriebsvereinfachung, aber keine fachlich bereits abgenommene
Nichtregression: In der bekannten V3.3.1-WEVIG-Evidenz reparierte dieser Pfad
einen HP-12-Falschnegativfall.

Deshalb gilt für V3.5.0:

```text
VS-MODELLENTSCHEIDUNG: belegt für den dokumentierten LF-/WEVIG-VS-Vergleich
ACHT-KATEGORIEN-NICHTREGRESSION: noch ausstehend
HP-12 OHNE DINGHY: noch ausstehend
99-PROZENT-ZIEL / BELIEBIGE POLIZZEN: nicht bewiesen
```

Alte Resume-Artefakte werden durch Schema Version 2 abgewiesen. So kann ein
Lauf mit Qwen 3.8 und Embeddingfallback nicht still unter dem neuen
Qwen-3.6-Vertrag fortgesetzt werden.

## Installation und Betrieb

Das 20,43-GB-Quellmodell muss einmalig vorhanden sein:

```bash
$HOME/.lmstudio/bin/lms get https://huggingface.co/lmstudio-community/Qwen3.6-35B-A3B-MLX-4bit
```

Danach übernimmt V3.5.0 bei `install`, `update`, `start` und `restart` über den
Server-LaunchAgent die Vorbereitung und den exakten Modellload. Die
Serverkonfiguration setzt den API-Identifier und das Tokenlimit ebenfalls
fest. Historische Legacy-A/B-Werkzeuge laden kein Embeddingmodell mehr
implizit; ein solcher historischer Lauf muss seinen Embedder ausdrücklich
angeben.

## Noch ausstehende Abnahme

Auf ausdrücklichen Wunsch wurde in diesem Änderungsschritt keine Test-, Lint-,
Build-, Doctor-, Installer- oder neue Modellvalidierung ausgeführt. Vor
Deployment/Freigabe sind mindestens nachzuholen:

1. Installer- und Start/Restart-Vertrag auf dem Mac Studio;
2. Nachweis des geladenen Zustands 42.496 / Parallelität 1 / nur Qwen 3.6;
3. vollständiger LF-/WEVIG-Acht-Kategorienlauf;
4. gezielte HP-12-Prüfung ohne Dinghy sowie Negativkontrollen;
5. persistenter A/B-Paketlauf und Exportprüfung.

Der Tag bezeichnet daher den gewünschten implementierten Produktstand, nicht
eine nachträglich behauptete vollständige Fachabnahme.
