# Polizzenvergleich V3.3.0 RC16 – Vertragszusammenfassung, Laufzeit und Gesamtprämie

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.16`

## Zweck

RC16 korrigiert die Auswertung von Vertragsfakten in einer
spartenübergreifenden Angebotszusammenfassung. Im WEVIG-Dokument erbte die
Seite mit Laufzeit und Gesamtprämie bislang fälschlich den Haftpflicht-Scope
und dessen Governor von der vorherigen Seite. Fachlich allgemeine
Vertragsfakten wurden dadurch als fremde Haftpflichtaussagen verworfen.

## Änderung

- `ZUSAMMENFASSUNG SPARTE(N) UND PRÄMIE(N)` ist eine kontrollierte Grenze für
  allgemeine Vertragsbedingungen.
- Die Grenze wirkt positionsabhängig: Text vor einer späteren Überschrift kann
  weiterhin zum vorherigen Abschnitt gehören; Text danach erbt dessen
  Deckungs-Governor nicht mehr.
- `WICHTIGE INFORMATIONEN` wird bewusst nicht global als Abschnittsgrenze
  behandelt.
- `VB-01` erkennt die belegte Schreibweise `Laufzeit mind. 10 Jahre` und
  bewahrt den Mindest-Qualifier als `mindestens 10 Jahre`.
- `VB-27` bindet ausschließlich eine operativ erklärte Gesamtprämie an das
  Wertefeld `amount`; im Referenzdokument lautet sie `EUR 14.747,66
vierteljährlich`.
- Steuerinklusion bleibt eine eigene erforderliche Komponente. Ein bloßer
  Prämienbetrag ohne Steuerbeleg vervollständigt die Tabellenzeile nicht.
- Das DRAFT-Oracle prüft WEVIG `VB-01` und `VB-27` einschließlich Wert,
  Komponenteneffekt, Scope, Dokumentstatus und physischer Seite.

## Sicherheitsgrenzen

- `bis zu 10 Jahre`, Kündigungs- oder Nachforderungsfristen und bloße
  Erwähnungen der Vertragslaufzeit liefern keinen Laufzeitwert.
- Die Prämienerkennung verlangt `Gesamtprämie ... beträgt` oder `beläuft sich
auf`; spätere fremde Eurobeträge werden nicht übernommen.
- Rabattsätze werden weder als Gesamtprämie noch als Steueranteil verwendet.
- Die neue positionsabhängige Governor-Vererbung ist auf Seiten mit der
  kontrollierten allgemeinen Vertragsgrenze beschränkt. Andere Kategorien
  behalten ihr bisheriges Verhalten.

## Lokaler Nachweis vor dem Mac-Studio-Lauf

```text
91/91 Jest-Suites, 1006/1006 Tests: PASS
Server-, Frontend- und Collector-ESLint: PASS
Prettier und git diff --check: PASS
Vollständiger Worksheet-Replay für LF und WEVIG: PASS

LF:
  keine Kandidaten- oder Scope-Änderung; nur semantisch korrektes
  VB-27-Wertefeld limit -> amount

WEVIG:
  VB-01/VB-02/VB-27 wechseln aus dem falschen Haftpflicht-Scope in den
  allgemeinen Vertragsscope
  VB-01 erhält die konkrete Mindestlaufzeit-Fundstelle
  VB-27 erhält die konkrete Brutto-Gesamtprämie und beide Steuerbelege
  nur EL-21 teilt dieselbe echte Zusammenfassungsgrenze; alle anderen
  Kategorien und Fundstellen bleiben unverändert
```

## Mac-Studio-Nachweis

RC16 wurde unverändert auf dem Mac Studio installiert; Update, beide
Doctor-Läufe, Tag, SHA und sauberer Checkout waren grün. Der frische Lauf mit
`qwen/qwen3.8-27b` bestand zwar alle technischen Gates, verfehlte aber das
qualitative DRAFT-Oracle:

```text
VB-Triage:       20/20 IDs und 20/20 Kontrollen
VB-Wirkungen:    52/52 Komponenten und 52/52 Kontrollen
VB-Endtabelle:   36/36 Zeilen
DRAFT-Oracle:    nur 17/47 Aussagen

VB-02: BELEGT / Ja, Rabatt 20 % und 25 %
VB-01: weiterhin UNGEKLÄRT
VB-27: weiterhin UNGEKLÄRT
```

Die Fundstellen und der neue allgemeine Scope waren korrekt. Das 27B-Modell
stufte die operative Mindestlaufzeit, Gesamtprämie und Steuerinklusion jedoch
weiterhin als `MENTION_ONLY` ein; der Server verwarf sie deshalb vor Wirkung
und Wertebindung. RC16 ist damit ein dokumentierter negativer Zwischenstand
und nicht der empfohlene Kundenkandidat. Die enge Ursachenbehebung folgt in
RC17.

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.16
./doctor.command
```

## Beweisgrenze

Die neuen Oracle-Zeilen sind `DRAFT`, bis ein fachlicher Reviewer sie explizit
freigibt. RC16 generalisiert eine belegte Dokumentstruktur und eng begrenzte
Werteextraktion; es behauptet keine mathematische 99-Prozent-Garantie für
beliebige zukünftige Polizzen.
