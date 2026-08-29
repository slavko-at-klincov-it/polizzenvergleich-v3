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

Noch ausständig. RC18 wird erst nach Installation des unveränderlichen Tags,
beiden Doctor-Prüfungen und einem frischen LF-HP-Lauf mit
`qwen/qwen3.8-27b` als Zielhardwarebefund bewertet. WEVIG-HP dient als
Kontrolllauf, sofern die Änderung dort keinen passenden Jahresaggregatbeleg
findet.

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
