# Polizzenvergleich V3.3.0 RC21 – Leckortung und Suchkosten als Alternativwortlaut

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.21`

## Zweck

RC21 schließt eine taxonomische Scheindifferenz in `LW-08`. Der aktive
Katalog verlangte bisher sowohl `Leckortungskosten` als auch `Suchkosten`.
LF und WEVIG verwendeten jeweils den belegten Vertragswortlaut `Suchkosten`
mit einem eigenen Limit. Obwohl historische Taxonomie, Golden Cases und
Versicherungssprache beide Begriffe als alternative Benennungen desselben
Lecksuche-Sachverhalts behandeln, blieben beide Endzeilen deshalb
`TEILBELEGT`.

## Änderung

- `LW-08` verwendet die bereits kontrollierte
  `componentSatisfactionPolicy: ANY`.
- `Leckortungskosten` oder `Suchkosten` können den Wortlaut-Sachverhalt
  einzeln vollständig belegen.
- Sind mehrere Alternativen tatsächlich belegt, bleiben alle gefundenen
  Wirkungen und eine mögliche Konfliktprüfung erhalten.
- Unbelegte Alternativformulierungen werden nach einem positiven Treffer
  nicht mehr als scheinbar eigenständige fehlende Objektfakten gerendert.
- Limit und Quelle bleiben unverändert an den ausgewählten Kandidaten
  gebunden.

## Sicherheitsgrenzen

- Die Änderung gilt ausschließlich für `LW-08`.
- Ohne Fundstelle bleibt die Zeile offen; `ANY` erzeugt keine Evidenz.
- Ein Betrag ohne Leckortungs-/Suchkosten-Kontext erfüllt den Sachverhalt
  nicht.
- Rohrreparatur, Wiederherstellung und andere Kostenrollen bleiben getrennte
  Kategorien bzw. Komponenten.
- Versicherer, Dokumentname, konkrete Seite und Betrag sind keine
  Aktivierungsmerkmale.

## Lokaler Nachweis

```text
91/91 Jest-Suites, 1037/1037 Tests: PASS
Server-, Frontend- und Collector-ESLint: PASS
git diff --check: PASS
Positive Varianten "Leckortungskosten" und "Suchkosten": PASS
ANY-Zeilenvertrag ohne erfundene fehlende Alternative: PASS
```

## Mac-Studio-Nachweis

Der funktionale Commit `147936fc` wurde sauber auf dem Mac Studio geprüft.
Doctor, Checkout und SHA bestanden. Zwei frische Läufe mit
`qwen/qwen3.8-27b` ergaben:

```text
LF-LW:
  33/33 Triage-Kandidaten
  52/52 atomare Komponenten
  36/36 Endzeilen
  25 ausgewählte Quellen
  gegenüber RC12 genau LW-08 verbessert
  TEILBELEGT / Nicht feststellbar
    -> BELEGT / Ja / EUR 2.500 auf Erstes Risiko
  übrige 35 LW-Zeilen semantisch identisch

WEVIG-LW:
  33/33 Triage-Kandidaten
  52/52 atomare Komponenten
  36/36 Endzeilen
  24 ausgewählte Quellen
  gegenüber RC15 genau LW-08 verbessert
  TEILBELEGT / Nicht feststellbar
    -> BELEGT / Ja / EUR 1.500,00 auf Erstes Risiko
  übrige 35 LW-Zeilen semantisch identisch
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.21
./doctor.command
```

## Beweisgrenze

LF und WEVIG belegen zwei unterschiedliche Dokumente und Beträge mit dem
Wortlaut `Suchkosten`; der separate synthetische Vertrag belegt zusätzlich
`Leckortungskosten`. Unbekannte Versicherer und Formulierungen bleiben externe
Holdouts. RC21 ist keine fachliche Freigabe sämtlicher LW-Kategorien.
