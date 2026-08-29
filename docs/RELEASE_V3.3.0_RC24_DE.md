# Polizzenvergleich V3.3.0 RC24 – Allgemeine Sparten-Höchstentschädigung

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.24`

## Zweck

RC24 schließt eine gemeinsame Evidenzlücke in Feuer, Leitungswasser und
Sturm. LF enthält im allgemeinen Vertragsteil eine Höchstentschädigung von
150 Prozent, die ausdrücklich für die jeweilige Sparte gilt. VS konnte diese
Klausel bereits korrekt verwenden. ST stufte sie dagegen als engen Teilbeleg
ein; FE und LW riefen sie nicht zuverlässig ab.

## Änderung

- `FE-F02`, `LW-31` und `ST-34` rufen die allgemeine
  Höchstentschädigungsklausel kontrolliert ab.
- Eine serverautoritäre Bindung entsteht nur, wenn derselbe Satz alle drei
  Anker enthält:
  - operative Höchstentschädigung im Schadenfall,
  - ausdrückliche Geltung für die jeweilige Sparte,
  - numerischer Prozentsatz der vereinbarten Versicherungssumme.
- FE-Jahreshöchstleistung bleibt eine getrennte Pflichtkomponente und wird aus
  der Schadenfall-Höchstentschädigung nicht erfunden.
- Wert und Quelle stammen weiterhin aus der tatsächlich gefundenen Klausel.

## Sicherheitsgrenzen

- Nur `FE-F02/fire_maximum_indemnity`, `LW-31` und `ST-34` dürfen die Regel
  verwenden.
- Die Klausel muss im kontrollierten allgemeinen Vertragsteil stehen.
- Ohne `jeweilige Sparte`, Prozentwert oder Versicherungssummenbasis erfolgt
  keine autoritative Bindung.
- Fremde Versicherungskapitel und Jahresaggregate bleiben gesperrt.
- Versicherer, Dokumentname, Seite und der konkrete Wert 150 sind keine
  Aktivierungsmerkmale.

## Lokaler Nachweis

```text
92/92 Jest-Suites, 1054/1054 Tests: PASS
Server-ESLint: PASS
git diff --check: PASS

Positive Varianten:
  FE-F02 Höchstentschädigung
  LW-31 Höchstentschädigung
  ST-34 Höchstentschädigung

Negative Varianten:
  falsches Versicherungskapitel
  fehlender Spartenanker
  fehlender Prozent-/Versicherungssummenanker
  FE-Jahreshöchstleistung
```

## Mac-Studio-Nachweis mit Qwen 3.8 27B

Der funktionale Commit `bb306a71` wurde mit `qwen/qwen3.8-27b` gegen LF und
WEVIG geprüft.

```text
LF-FE:
  27/27 Triage-Kandidaten
  138/138 atomare Komponenten
  80/80 Endzeilen
  FE-F02: UNGEKLÄRT -> TEILBELEGT
  Höchstentschädigung 150 % belegt; Jahreshöchstleistung offen
  übrige 79 FE-Zeilen unverändert

LF-LW:
  35/35 Triage-Kandidaten
  52/52 atomare Komponenten
  36/36 Endzeilen
  LW-31: UNGEKLÄRT -> BELEGT / Ja / 150 %
  übrige 35 LW-Zeilen unverändert

LF-ST:
  51/51 Triage-Kandidaten
  54/54 atomare Komponenten
  36/36 Endzeilen
  ST-34: TEILBELEGT -> BELEGT / Ja / 150 %
  übrige 35 ST-Zeilen unverändert

WEVIG-FE/LW/ST:
  152/152 Endzeilen verglichen
  0 Änderungen
  FE-F02, LW-31 und ST-34 bleiben UNGEKLÄRT
```

Damit stehen drei gezielten LF-Verbesserungen 301 unveränderte Kontrollzeilen
gegenüber.

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.24
./doctor.command
```

## Beweisgrenze

LF belegt den positiven allgemeinen Spartenvertrag, WEVIG das Verhalten ohne
diese Klausel. Noch nicht bewiesen sind unbekannte Formulierungsvarianten und
weitere Versicherer. Die Regel ist deshalb grammatisch und zielbezogen eng;
externe Holdouts und die fachliche Gesamtfreigabe bleiben offen.
