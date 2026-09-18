# Polizzenvergleich V3.9.12

V3.9.12 behebt den fail-closed Restfall aus B-Batch 35 des bekannten kalten
LF-1+9-Produktlaufs und erweitert den B-Entscheidungspfad um strikt gebundene
Cross-Release-Wiederaufnahme.

Wenn Qwen eine vom Server vorgelegte `RCE-*`-/`RCR-*`-Kandidaten-ID nur durch
das Auslassen von ein oder zwei zusammenhängenden Hex-Zeichen verkürzt, wird
sie ausschließlich bei genau einem erlaubten Kandidaten derselben Requirement
mechanisch wiederhergestellt. Präfixwechsel, Ersetzungen, Vertauschungen,
längere Kürzungen und mehrdeutige Treffer bleiben fail-closed. Anschließend
gilt weiterhin der vollständige bestehende Fach- und Quellenvalidator.

Planidentische gültige B-Batches und einzeln gültige Antworten aus einem
unvollständigen Vorgängerjournal können read-only unter dem aktuellen Vertrag
revalidiert und ohne erneuten Modellaufruf rematerialisiert werden. Die
Originalartefakte werden nicht verändert.

Auf dem Mac Studio bestanden 452/452 fokussierte Tests und Prettier. Der
unveränderte echte Lauf wurde bis einschließlich Batch 35 revalidiert:
35/35 Batches PASS, null Modellaufrufe, null neue Versuche und kontrollierter
Resume ab Batch 36. Der exakte Releasekandidat
`ef3bb09d980ef51516300250ece2a02a0e49cae7` bestand außerdem 212/212 Suites
mit 3.128/3.128 Tests, alle drei Lints, Prisma, Capability-Inventar,
Frontend-Build und macOS-Installer-Suite. Kundenupdate, vollständiger
Produkt-Resume und Gold-Regression stehen zum Zeitpunkt dieser
Releasevorbereitung noch aus.

Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz. Er ist kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set:

- `LF-V3912-BOUND-CANDIDATE-ID-RESUME-20260918-001`
