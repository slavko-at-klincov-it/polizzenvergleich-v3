# Polizzenvergleich V3.3.0 RC18 – Jahreshöchstleistung als Vielfaches

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.18`

## Zweck

RC18 schließt einen eng begrenzten Wertverlust in `HP-02`. Der kontrollierte
Pfad fand und klassifizierte die LF-Klausel zur Jahreshöchstleistung bereits
korrekt als allgemeine Definition. Das exakte Vielfache `dreimal` wurde jedoch
nicht als Wert materialisiert. Dadurch blieb die Zeile trotz vollständiger
Evidenz `TEILBELEGT / Nicht feststellbar`.

## Änderung

Der servereigene Wertevertrag erkennt ein Jahresaggregat als Vielfaches nur,
wenn derselbe kontrollierte Klauselkontext alle folgenden Rollen enthält:

- Jahresbezug wie `Versicherungsfälle eines Jahres` oder
  `Jahreshöchstleistung`;
- die zu vervielfachende Deckungs- oder Pauschalversicherungssumme;
- eine begrenzende Form wie `maximal`, `höchstens` oder `bis zu`;
- ein numerisches oder ausgeschriebenes Vielfaches mit `mal` oder `fach`.

Der Wert wird mit exaktem servereigenem Quellspan als `MULTIPLE` normalisiert,
zum Beispiel `dreimal -> 3-fach`. Eine gleich eng begrenzte Regel bindet die
operative Klausel in der Haftpflicht-Sektion autoritativ als `DIRECT /
DEFINED`. Das Modell kann weder Quelle noch Wert erzeugen.

## Sicherheitsgrenzen

- Die Regel verlangt Kategorie `HP`, Requirement `HP-02`, Komponente
  `annual_aggregate_multiple`, Faktrolle `LIMIT` und den kontrollierten
  Haftpflicht-Scope.
- Eine dreimalige Prämienzahlung ist kein Jahresaggregat.
- Eine Pauschalversicherungssumme ohne Jahresbezug reicht nicht.
- Eine Jahresklausel ohne Deckungssummenbasis reicht nicht.
- Versicherername, Dokumentname und Seitennummer sind kein Teil der
  Produktionsentscheidung.

## Nachweis vor dem Mac-Studio-Lauf

```text
91/91 Jest-Suites, 1021/1021 Tests: PASS
Server-, Frontend- und Collector-ESLint: PASS
Prettier und git diff --check: PASS
Positive numerische und ausgeschriebene Formulierungsvarianten: PASS
Negative Rollen- und Kontextvarianten: PASS
Scan über 24 aktuelle LF-/WEVIG-Worksheets: genau ein autoritativer Treffer
Replay des echten LF-HP-27B-Artefakts: 36/36 Zeilen verglichen

Exakt eine qualitative Änderung:
  HP-02: TEILBELEGT / Nicht feststellbar
       -> BELEGT / Ja / 3-fach

Alle übrigen 35 HP-Zeilen bytegenau unverändert.
```

## Mac-Studio-Nachweis

RC18 wurde als unveränderlicher Tag auf dem Mac Studio installiert. Update,
integrierter Doctor, separater Doctor, Tag, SHA und sauberer Checkout wurden
geprüft. Zwei frische Läufe mit `qwen/qwen3.8-27b` ergaben:

```text
LF-HP:
  37/37 Triage-Kandidaten
  63/63 atomare Komponenten
  36/36 Endzeilen
  27 ausgewählte Quellen

Vollständiger Vergleich gegen den akzeptierten RC12-HP-Lauf:
  nur HP-02 verbessert
  TEILBELEGT / Nicht feststellbar -> BELEGT / Ja / 3-fach
  Quelle und dokumentierter Inhalt unverändert
  übrige 35 HP-Zeilen semantisch identisch

WEVIG-HP-Kontrolllauf:
  23/23 Triage-Kandidaten
  63/63 atomare Komponenten
  36/36 Endzeilen
  8 ausgewählte Quellen
  0 semantische Änderungen gegenüber dem akzeptierten RC11-HP-Lauf
```

WEVIG `HP-02` bleibt korrekt `UNGEKLÄRT / Nicht feststellbar`; der Server
findet dort weder Jahresaggregat noch Wert und erzeugt keinen Ersatzbeleg.

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.18
./doctor.command
```

## Beweisgrenze

LF und WEVIG sind bekannte Regressionsexemplare. Positive synthetische
Varianten belegen den semantischen Vertrag, aber ohne zuvor unbekanntes
Versicherer-/Dokumentformat ist externe Generalisierung weiterhin nicht
bewiesen. Ein DRAFT-Oracle ist keine fachliche Freigabe.
