# Polizzenvergleich V3.3.0 RC4 – korrigierter VS-Vollvergleich

Stand: 28. August 2026

Release-Tag: `v3.3.0-rc.4`

## Zweck

RC4 ersetzt RC3 für den kontrollierten vollständigen VS-01-bis-VS-36-Lauf
mit LF und WEVIG am Kunden-Mac-Studio. Die Änderungen beheben ausschließlich
die vier beim echten Qwen-3.8-27B-RC3-Lauf nachgewiesenen Qualitäts- und
Integrationsprobleme. Es wurden weder Temperatur noch Top-N noch der
Ausführungsprompt verändert.

## Änderungen gegenüber RC3

- VS-16, VS-21 und VS-28 verwenden im Full-Katalog dieselben bereits
  erprobten Scope-Regeln wie der Pilotkatalog. Ein Vertrag kann dadurch
  beispielsweise Garagen und Tiefgaragen gemeinsam belegen, ohne dass ein
  enger Gefahrenscope die gesamte Kategorie verfälscht.
- VS-15 trennt die allgemeine Deckung von Nebengebäuden von der ausdrücklich
  namentlichen Anführung in der Polizze. Eine allgemeine Fundstelle wird nicht
  mehr als namentliche Benennung behauptet.
- Ein sicher lokal gebundener Teilbetrag bleibt bei VS-15 sichtbar, ohne als
  Deckungssumme der nicht belegten namentlichen Anführung ausgegeben zu werden.
- VS-35 materialisiert die LF-Dreijahresfrist, die Zeitwertfolge und die
  Verlängerung um die Dauer eines Deckungsprozesses aus der vorhandenen
  Vertragsklausel.
- Der Full-Katalog nutzt für den Pilot-Oracle semantische Akzeptanz mit
  Quellen- und Seitenkontrolle. Katalogbedingte Alias-IDs dürfen abweichen;
  verbotene Kandidaten, falsche Seiten, falsche Werte oder falsche
  Tabellenaussagen bleiben weiterhin ein Fehler.
- Ein Regressionstest erzwingt, dass die Pilotregeln der gemeinsam genutzten
  VS-Kategorien künftig vollständig in den Full-Katalog übernommen werden.

## Nachweis auf den echten 27B-Artefakten

Die mit RC3 am Kunden-Mac erzeugten PDF-, Triage- und Wirkungsartefakte wurden
mit dem RC4-Code vollständig neu materialisiert. Dabei wurden die echten
Qwen-3.8-27B-Entscheidungen wiederverwendet und nicht durch lokale
Modellantworten ersetzt.

```text
LF:    36 Anforderungen, 65 Komponenten, 122 Kandidaten
WEVIG: 36 Anforderungen, 65 Komponenten, 155 Kandidaten
Pilot-Oracle LF:    4/4 PASS
Pilot-Oracle WEVIG: 4/4 PASS

LF VS-15:    allgemeine Nebengebäudedeckung + 5 % Teilbeleg,
             namentliche Anführung nicht feststellbar
LF VS-16:    Ja / BELEGT
LF VS-21:    Ja / BELEGT / 10 %, 15 %
LF VS-35:    Ja / BELEGT / 3 Jahre + Bedingungen
WEVIG VS-15: allgemeine Nebengebäudedeckung + EUR 1.530.400,00 Teilbeleg,
             namentliche Anführung nicht feststellbar
WEVIG VS-21: Ja / BELEGT / EUR 6.121.600,00
```

Die quellenbezogene Neubewertung gegenüber dem eingefrorenen
V3.2.1-kompatiblen Ausgangslauf lautet damit vor dem frischen Kundenlauf:

```text
59 BESSER, 12 GLEICH, 1 UNKLAR, 0 SCHLECHTER
```

Das ist ein positiver Artefakt-Replay-Nachweis, aber noch kein Ersatz für den
frischen Qwen-3.8-27B-RC4-Volllauf am Kundenrechner.

## Release-Gates

```text
PASS: 80 Jest-Suites, 876 Tests
PASS: vollständiger Lint-Lauf
PASS: Produktionsbuild des Frontends
PASS: Syntax- und Git-Diff-Prüfung
PASS: 27B-Artefakt-Replay für LF und WEVIG
GO: kontrollierter RC4-Kundenlauf
NO CLAIM: finale fachliche Freigabe von v3.3.0
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.4
./doctor.command
```

Danach wird derselbe vollständige Vergleich mit denselben beiden PDFs und den
unveränderten Laufparametern ausgeführt. Erst dieser Lauf entscheidet, ob RC4
als Basis für die finale V3.3.0-Freigabe geeignet ist.
