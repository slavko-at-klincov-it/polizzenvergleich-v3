# Polizzenvergleich V3.9.14

V3.9.14 korrigiert die Resume-Orchestrierung des dynamischen LF-V2-Pfads.
A-Klassifikation und B-Gegenstückprüfung wählen ihre Vorgänger nun
unabhängig. Dadurch fällt ein fachlich weiter fortgeschrittener B-Pfad nicht
mehr auf den zufällig für A stärksten Vorgänger zurück.

Die B-Auswahl akzeptiert ausschließlich echte, nicht symbolische
Resume-Verzeichnisse derselben Session und derselben release-unabhängigen
Run-Identität. Maßgeblich ist der größte lückenlose Präfix vollständiger
B-Batches. Danach bleiben die bestehenden Hard-Gates unverändert: Der
B-Runner verlangt einen byte-semantisch identischen Entscheidungsplan und
revalidiert jede gespeicherte Antwort beziehungsweise jedes Attempt-Journal
unter dem aktuellen Prompt-, Modell-, Kontext-, Transport- und
Validatorvertrag. Originalartefakte werden nur gelesen und nie überschrieben.

Der reale V3.9.13-Produktresume hatte fälschlich den A-Vorgänger mit nur 34
B-Batches verwendet und dadurch Batches 36 bis 55 neu berechnet. Nach dem Fix
wählt derselbe Datenstand den korrekten B-Vorgänger mit 70 vollständigen
Batches. Ein frischer privater QA-Lauf rematerialisierte Batches 1 bis 71 mit
null Modellaufrufen; Batch 72 bleibt der nächste neue Qwen-Aufruf. Der
Vorgängerbaum blieb vor und nach der Revalidierung hashgleich.

Auf dem exakten Code- und Teststand `f0173d8ba` bestanden 17/17 fokussierte
Resume-/Worker-Tests und Prettier. Der Releasekandidat `0093ccc30` bestand
anschließend den vollständigen Mac-Studio-Gate mit 212/212 Suites und
3.133/3.133 Tests, allen drei Lints, Prisma, Capability-Inventar, Prettier,
Frontend-Produktionsbuild und macOS-Installer-Suite. Der nachfolgende
dokumentarische Inventarabschluss verändert keinen Produkt- oder Testcode.

Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz. Er ist kein unabhängiger
Generalisierungs-, Holdout- oder 99-Prozent-Nachweis.

Change-Set:

- `LF-V3914-INDEPENDENT-B-RESUME-SELECTION-20260920-001`

Paired Knowledge-Commit: `2451438c0`.
