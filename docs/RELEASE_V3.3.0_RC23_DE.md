# Polizzenvergleich V3.3.0 RC23 – Elementarwerte im deklarierten Sturm-Host-Scope

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.23`

## Zweck

RC23 schließt zwei falsche Scope-Herabstufungen bei bereits vollständig
gebundenen Elementarwerten. LF `EL-01` und `EL-11` enthielten eindeutige
Werte, vollständige Pflichtfelder, physische Quellen und serverautoritäre
`DEFINED`-Wirkungen. Der Katalog erlaubte für beide Anforderungen bereits
`STURM_INSURANCE` als Host-Scope, aktivierte aber die zugehörige
Zeilenabschluss-Policy nicht.

## Änderung

- `EL-01` und `EL-11` verwenden
  `MATCHING_SCOPE_INCLUDED_SUFFICIENT`.
- Der bereits deklarierte Host-Scope `STURM_INSURANCE` bleibt unverändert.
- Eine vollständig definierte `LIMIT`- oder `DEDUCTIBLE`-Komponente kann in
  diesem erlaubten Scope die Zeile abschließen.
- Werte, Qualifier, exakte Quellspannen und enger Scope bleiben sichtbar.

## Sicherheitsgrenzen

- Die Policy gilt ausschließlich für `EL-01` und `EL-11`.
- Ohne Wert, Quelle oder passende Komponente bleibt die Zeile offen.
- Andere Sturm-Kapitelstellen werden nicht automatisch zu Elementarbelegen.
- `UNKNOWN`, `OPTION_ONLY`, ungelöste Kandidaten und nicht deklarierte Scopes
  bleiben gesperrt.
- Versicherer, Seite und konkrete Beträge sind keine Aktivierungsmerkmale.

## Lokaler Nachweis

```text
91/91 Jest-Suites, 1040/1040 Tests: PASS
Server-, Frontend- und Collector-ESLint: PASS
git diff --check: PASS

LF-EL-Artefaktreplay:
  36/36 Zeilen verglichen
  nur EL-01 und EL-11 verbessert
  übrige 34 Zeilen semantisch identisch

WEVIG-EL-Kontrollreplay:
  36/36 Zeilen verglichen
  0 semantische Änderungen
```

## Mac-Studio-Nachweis

Der funktionale Commit `9fc53931` wurde mit `qwen/qwen3.8-27b` geprüft:

```text
LF-EL:
  48/48 Triage-Kandidaten
  69/69 atomare Komponenten
  36/36 Endzeilen
  40 ausgewählte Quellen
  gegenüber RC15 nur EL-01 und EL-11 verbessert
  EL-01 -> BELEGT / Ja /
           1 %; mindestens EUR 20.000; maximal EUR 100.000,
           jeweils auf Erstes Risiko
  EL-11 -> BELEGT / Ja / EUR 350 je Schadenfall
  übrige 34 EL-Zeilen semantisch identisch

WEVIG-EL:
  58/58 Triage-Kandidaten
  69/69 atomare Komponenten
  36/36 Endzeilen
  42 ausgewählte Quellen
  0 semantische Änderungen gegenüber RC17
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.23
./doctor.command
```

## Beweisgrenze

LF belegt den positiven Wert-/Host-Scope-Vertrag, WEVIG die fehlende Evidenz
als Negativgate. Andere Anforderungen oder Host-Scopes werden nicht
automatisch freigegeben. Externe Holdouts und die fachliche Gesamtfreigabe
bleiben offen.
