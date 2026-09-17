# Polizzenvergleich V3.9.7

V3.9.7 behebt den fail-closed Stopp des kalten dynamischen A-Laufs in Batch 36. Fünf von sechs Units waren bereits gültig. Die offene Unit enthielt drei
fachlich getrennte Aussagen: eine positive Definition versicherter Sachen,
eine bedingte zusätzliche Objektdeckung und einen nachlaufenden Ausschluss.
Keiner der fünf gespeicherten Modellversuche erfasste alle drei Aussagen
korrekt.

Der V78-Laufvertrag und der V12-Signalvertrag adaptieren die bestehende
source-bound Atomisierung:

- eine vollständige eigene Formulierung `Als versicherte Sachen gelten ...`
  setzt einen zuvor verknüpften negativen Governor zurück;
- Grundobjekte, bedingte Zusatzobjekte und ausgeschlossene Objekte werden nur
  bei einer vollständigen, eindeutigen Satzfolge getrennt materialisiert;
- Wirkung, Bedingung und jedes Objekt bleiben wörtlich an die eigenen
  Quellblöcke gebunden;
- negative Formulierungen wie `nicht versichert sind` dürfen niemals als
  positiver Reset gelten;
- unvollständige oder abweichende Strukturen bleiben fail-closed.

Der unmittelbare V77-Vorgänger sowie dessen append-only Attempt-Journale
bleiben resumierbar, werden jedoch vollständig unter dem aktuellen
Normalizer und Validator revalidiert. Es wird kein alter PASS-Marker blind
übernommen.

Auf dem Mac Studio bestanden 412/412 fokussierte Vertragstests. Der echte
gespeicherte Batch 36 revalidierte anschließend offline mit 6/6 Units. Der
Attempt-Baum blieb unter SHA-256
`af641edaf2faec4dcd7263e06c1cdb1bbf4fa445ab892e977642618e6a5ec753`
unverändert.

Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz und ist kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set: `LF-V397-LOCAL-COVERAGE-RESET-ATOMIZATION-20260917-001`.
