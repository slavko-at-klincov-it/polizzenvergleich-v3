# Polizzenvergleich V3.3.0 RC20 – Wiederherstellungsfrist als Dauer

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.20`

## Zweck

RC20 schließt einen isolierten Übergabeverlust in `VB-26`. Im LF-Vertrag
wurden vier richtige Fundstellen zur Wiederherstellungsfrist gefunden und die
Endzeile enthielt bereits die bedingte Regel. Der angeforderte Wert `duration`
blieb trotzdem `NOT_FOUND`, weil der generische Dauer-Extraktor die gebeugte
Form `dreier Jahre` nicht verstand. Dadurch wurde die vollständig belegte
Zeile als `TEILBELEGT` ausgegeben.

## Änderung

- `VB-26` erhält eine eigene, servergebundene Extraktion für eine unmittelbar
  an Wiederbeschaffung oder Wiederherstellung gebundene Frist.
- Ziffern und deutsche Zahlwörter mit Fallendungen werden als Stunden, Tage,
  Wochen, Monate oder Jahre normalisiert.
- Der exakte Wertspan bleibt erhalten; im LF-Fall wird `dreier Jahre` als
  `3 Jahre / DURATION / YEAR` gespeichert.
- Eine ausdrückliche Verlängerung um die Dauer eines Deckungsprozesses wird im
  allgemeinen Vertragsabschnitt als definierte Fristregel gebunden. Sie
  erzeugt selbst keine numerische Dauer.

## Sicherheitsgrenzen

- Die Regel gilt ausschließlich für `VB-26/reinstatement_deadline` im
  kontrollierten allgemeinen Vertragsabschnitt.
- Zahl und Wiederherstellung müssen in derselben engen grammatischen Klausel
  über `innerhalb` oder `binnen` verbunden sein.
- Kündigungsfristen, Vertragslaufzeiten und andere nahe Dauern werden nicht
  übertragen.
- Eine bloße Erwähnung der Wiederherstellung ohne konkrete Frist bleibt offen.
- Versicherer, Dokumentname, Seite und die konkrete Dreijahreszahl sind keine
  Aktivierungsmerkmale.

## Nachweis vor dem Mac-Studio-Frischlauf

```text
91/91 Jest-Suites, 1034/1034 Tests: PASS
Server-, Frontend- und Collector-ESLint: PASS
git diff --check: PASS
Positive Jahres- und Monatsvarianten: PASS
Fremde Dauer und Wiederherstellung ohne Frist: PASS

Echter LF-VB-27B-Artefaktreplay:
  36/36 Endzeilen verglichen
  ausschließlich VB-26 verbessert
  TEILBELEGT / Nicht feststellbar
    -> BELEGT / Ja / Dauer: 3 Jahre
  exakter Quellspan: "dreier Jahre"
  übrige 35 VB-Zeilen unverändert

Echter WEVIG-VB-Kontrollreplay:
  36/36 Endzeilen verglichen
  0 semantische Änderungen
  VB-26 bleibt ehrlich UNGEKLÄRT, weil keine Fundstelle vorhanden ist
```

## Mac-Studio-Nachweis

Noch ausständig. RC20 wird erst nach Installation des unveränderlichen Tags,
beiden Doctor-Prüfungen, einem frischen LF-VB-Lauf und einem frischen
WEVIG-VB-Kontrolllauf mit `qwen/qwen3.8-27b` abschließend bewertet.

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.20
./doctor.command
```

## Beweisgrenze

LF und WEVIG belegen die bekannte positive und negative Variante. Andere
Formulierungen, Versicherer und Dokumentlayouts bleiben externe Holdouts. Der
technische Qualitätsgewinn ist keine fachliche Freigabe des gesamten
VB-Katalogs.
