# Polizzenvergleich V3.3.0 RC17 – Operative allgemeine Vertragsfakten

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.17`

## Zweck

RC17 schließt die in RC16 sichtbar gewordene letzte Lücke zwischen korrekter
Fundstelle und sichtbarer Tabelle. Das 27B-Modell bewertete drei eindeutige
allgemeine Vertragsformen als `MENTION_ONLY`; der Server verwarf deshalb
Mindestlaufzeit, Brutto-Gesamtprämie und Steuerinklusion trotz richtigem Scope.

## Änderung

Nur folgende operative, serverprüfbare Formen im kontrollierten
`GENERAL_CONTRACT_TERMS`-Scope werden autoritativ gebunden:

- `VB-01`: eine lokale Vertrags-/Laufzeit mit numerischer Jahresangabe;
- `VB-27`: `Gesamtprämie ... beträgt|beläuft sich auf ... EUR`;
- `VB-27`: Steuerinklusion direkt in der Gesamtprämienzeile oder die Aussage,
  dass Steuern und Abgaben in der Gesamtprämie enthalten sind.

Für diese Formen materialisiert der Server die Wirkung `DEFINED`. Quelle,
Seite, Textspanne und Werte bleiben vollständig servergebunden; das Modell
kann keine Fundstelle oder Zahl erfinden.

## Sicherheitsgrenzen

- Die Regel verlangt Kategorie `VB`, die konkrete allgemeine Abschnittsgrenze,
  die passende Requirement-/Komponenten-ID und die operative Satzform.
- `Laufzeit bis zu 10 Jahre`, Kündigungsfristen und bloße
  Vertragslaufzeit-Erwähnungen bleiben modelloffen bzw. ohne Wert.
- `Gesamtprämie wird separat ausgewiesen` gefolgt von einem fremden
  periodischen Betrag wird nicht gebunden.
- Ein Prämienbetrag ohne eigene Steuerinklusion vervollständigt `VB-27` nicht.
- LF erhält keine neue autoritative Bindung. Im vollständigen LF-/WEVIG-Replay
  werden exakt vier WEVIG-Kandidaten auf Seite 6 autoritativ gebunden.

## Nachweis vor dem Mac-Studio-Lauf

```text
91/91 Jest-Suites, 1013/1013 Tests: PASS
Server-, Frontend- und Collector-ESLint: PASS
Prettier und git diff --check: PASS
Gezielte Vertrags-, Triage-, Wirkungs-, Werte- und Materializer-Tests: PASS
Replay des echten RC16-27B-Artefakts ohne neuen Modellaufruf: PASS

36/36 VB-Endzeilen verglichen; exakt zwei qualitative Änderungen:
  VB-01: UNGEKLÄRT -> BELEGT / Ja
         Dauer: mindestens 10 Jahre
  VB-27: UNGEKLÄRT -> BELEGT / Ja
         EUR 14.747,66 vierteljährlich; Steuerinklusion belegt

VB-02 und alle übrigen 33 VB-Zeilen semantisch unverändert.
20 % und 25 % bleiben ausschließlich Rabattwerte von VB-02.
```

## Mac-Studio-Nachweis

Der frische RC17-Lauf mit `qwen/qwen3.8-27b`, das DRAFT-Oracle und der
36-Zeilen-Vergleich werden nach Installation des unveränderlichen Tags hier
protokolliert.

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.17
./doctor.command
```

## Beweisgrenze

Die neuen Oracle-Zeilen bleiben `DRAFT`, bis ein fachlicher Reviewer sie
explizit freigibt. RC17 bindet eng definierte operative Vertragsformen und ist
keine globale Freigabe beliebiger Prämien- oder Laufzeitformulierungen.
