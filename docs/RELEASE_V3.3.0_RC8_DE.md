# Polizzenvergleich V3.3.0 RC8 – stabiler Standalone-Doctor

Stand: 29. August 2026

Release-Tag: `v3.3.0-rc.8`

## Zweck

RC8 übernimmt die vollständige fachliche RC7-Korrektur unverändert und
behebt einen beim echten SSH-Update erkannten Betriebsfehler: Ein separat
gestartetes `doctor.command` fand Prisma, aber nicht die gebündelte
Node-22-Laufzeit, wenn Homebrew-Node nicht im nichtinteraktiven `PATH` lag.

Die Datenbank und ihre Migrationen waren dabei intakt. Der Doctor startet
Prisma nun ausdrücklich mit der verifizierten Projektlaufzeit
`.runtime/node-v22.23.2/bin/node`.

## Fachlicher Inhalt

Alle Scope-, Variantenwert-, Mischzeilen- und Ausschlusskorrekturen aus RC7
sind enthalten. An der Analyse- oder Modelllogik wurde für RC8 nichts weiter
geändert.

## Nachweis

```text
89 Jest-Suites / 962 Tests: PASS
Server-, Frontend- und Collector-Lint: PASS
Standalone-Doctor über SSH: PASS erforderlich vor dem 27B-Lauf
```

## Update

```bash
cd "$HOME/Code/polizzenvergleich-v3"
./update.command v3.3.0-rc.8
./doctor.command
```

## Beweisgrenze

Der vollständige LF- und anschließende WEVIG-Lauf mit
`qwen/qwen3.8-27b` bleibt das fachliche Freigabegate.
