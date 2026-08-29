# Polizzenvergleich V3.3.0 RC11 – VS-Kostenscope und EL-Zusatzdeckungen

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.11`

## Zweck

RC11 ist die kleine Nachschärfung aus dem vollständigen WEVIG-RC10-Lauf mit
`qwen/qwen3.8-27b`. RC10s Klauselaktivierung bleibt unverändert. RC11 schließt
eine falsche VS-Kostenableitung und deklariert vier bereits fachlich zur
EL-Taxonomie gehörende Zusatzdeckungsscopes ausdrücklich.

## Änderungen

- `VS-21` darf eine bloße Abbruch-Erwähnung aus einer eindeutig aktivierten
  Haftpflichtklausel nicht als globale Aufräum-/Abbruchkostenwirkung werten.
  Diese Fundstelle ist nun `MENTION_ONLY`; echte Sachkostenklauseln bleiben
  erhalten.
- `EL-10` akzeptiert die aktivierte 64er Sturm-/Katastrophenklausel als engen
  Scope für Muren/Vermurung.
- `EL-21`, `EL-27` und `EL-34` akzeptieren aktivierte 12er
  Feuer-/Zusatzklauseln als engen Scope für die jeweils atomar verlangten
  Zusatzdeckungsfakten.
- Nicht katalogisierte Fremdsparten bleiben weiterhin serverseitig gesperrt.
  Die Regeln enthalten weder Dokumentnamen noch Seitenzahlen oder
  anbieterspezifische Textkopien.

## Nachweis

```text
89 Jest-Suites / 975 Tests: PASS
Server-, Frontend- und Collector-Lint: PASS
Syntax- und Git-Diff-Prüfung: PASS
Replay mit dem vollständigen echten WEVIG-RC10-Worksheet: PASS
```

Der Replay entfernt bei `VS-21` genau die zwei Haftpflichttreffer und erhält
zwölf echte Abbruchkostenfundstellen. Für `EL-10`, `EL-21`, `EL-27` und
`EL-34` werden die aktivierten, fachlich vorgesehenen engen Scopes wieder
zugelassen, ohne die allgemeine Fremdspartenregel zu öffnen.

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.11
./doctor.command
```

## Beweisgrenze

Vor einer finalen V3.3.0-Freigabe müssen ein frischer WEVIG-Volltest und ein
LF-Regressionslauf auf dem Mac Studio bestätigen, dass die RC10-Verbesserungen
und die bereits akzeptierten LF-Varianten-, Misch- und Wertbindungen gemeinsam
erhalten bleiben. Ohne vollständige fachliche Oracles für alle 320 Zeilen wird
weiterhin keine 99-Prozent-Aussage getroffen.
