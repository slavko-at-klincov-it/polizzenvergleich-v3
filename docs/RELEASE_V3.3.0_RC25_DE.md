# Polizzenvergleich V3.3.0 RC25 – Physische Beschattungseinrichtungen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.25`

## Zweck

LF nennt in einer versicherten Objektliste gemeinsam `Markisen, Jalousien
und Rollläden`. `ST-17` erkannte Jalousien und Rollläden bereits vollständig.
`ST-16` zeigte trotzdem nur die Markise und behauptete, eine
Beschattungseinrichtung sei nicht feststellbar.

## Änderung

Die kontrollierten Aliase der Objektkomponente `shading_system` umfassen nun
auch Jalousien und Rollläden als physische Ausprägungen einer
Beschattungseinrichtung. `ST-17` bleibt als eigene Detailzeile unverändert.

## Sicherheitsgrenzen

- Es ändert sich nur der Recall für `ST-16/shading_system`.
- Scope-, Aktivierungs-, Wirkungs- und Wertelogik bleiben unverändert.
- Eine Markise allein erfüllt die zweite Pflichtkomponente nicht.
- Fremdspartenquellen bleiben durch die vorhandene Spartenaktivierung
  gesperrt.

## Nachweis

```text
92/92 Jest-Suites, 1055/1055 Tests: PASS
Server-ESLint und git diff --check: PASS

LF-ST mit qwen/qwen3.8-27b:
  53/53 Triage-Kandidaten
  54/54 atomare Komponenten
  36/36 Endzeilen
  ST-16: TEILBELEGT -> BELEGT / Ja
  ST-17 und übrige 34 ST-Zeilen unverändert

WEVIG-ST mit qwen/qwen3.8-27b:
  15/15 Triage-Kandidaten
  54/54 atomare Komponenten
  36/36 Endzeilen
  0 Änderungen
  ST-16 und ST-17 bleiben UNGEKLÄRT
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.25
./doctor.command
```

## Beweisgrenze

Bewiesen sind die deutschen Objektbegriffe Jalousie und Rollladen im
kontrollierten Sachkontext der beiden Testdokumente. Andere Bauteile oder
unbekannte Versicherer bleiben Holdouts.
