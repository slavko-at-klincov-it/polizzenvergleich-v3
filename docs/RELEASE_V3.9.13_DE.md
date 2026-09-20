# Polizzenvergleich V3.9.13

V3.9.13 behebt den fail-closed Restfall aus B-Batch 71 des bekannten kalten
LF-1+9-Produktlaufs, ohne die Funddefinition oder Quellenbindung zu lockern.

Wenn ein servergebundener B-Kandidat durch eine eigenständige
Identitätskern-Komponente bereits als dasselbe fachliche Element belegt ist,
darf eine andere abweichende Identitätskern-Dimension ausschließlich als
`RELATED_ONLY` materialisiert werden. Dafür muss jeder betroffene Kandidat
einen unabhängigen `MATCH`-Kernanker und eine ausdrückliche
gleichdimensionale Abweichungsbeschreibung besitzen; zusätzliche
nichtmodifizierende Kerndifferenzen schließen die Reparatur aus. Ohne den
Anker bleibt die Antwort ungültig und fail-closed. Die Regel kann deshalb
keinen neuen Treffer erzeugen und darf eine Abweichung niemals als `MATCH`
ausgeben.

Identische Normalisierungstelemetrie aus wiederaufgenommenen Attempts wird
deterministisch dedupliziert. Gespeicherte Antworten und Originalartefakte
werden nicht überschrieben.

Auf dem Mac Studio bestanden 436/436 fokussierte Tests und Prettier. Die
unveränderten Produktartefakte wurden bis Batch 71 revalidiert: 71/71 PASS,
null Modellaufrufe und exakt eine protokollierte Normalisierung in Batch 71.
Batch 72 ist damit der nächste echte Modellaufruf. Das vollständige
Release-Gate, die Kundenaktivierung, der weitere Produktlauf und die
abschließende Gold-Regression werden vor der Freigabe ergänzt.

Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz. Er ist kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set:

- `LF-V3913-ANCHORED-IDENTITY-DIFFERENCE-20260920-001`
