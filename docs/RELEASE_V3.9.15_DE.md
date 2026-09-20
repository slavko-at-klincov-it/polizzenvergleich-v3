# Polizzenvergleich V3.9.15

V3.9.15 korrigiert einen Portabilitätsfehler im dynamischen LF-V2-Runner.
Unter der auf macOS vorhandenen Bash 3.2 konnte eine initialisierte, aber
leere optionale Argumentliste bei aktivem `set -u` als ungebundene Variable
abbrechen. Der reale V3.9.14-Produktlauf traf diesen Fehler unmittelbar nach
der vollständig abgeschlossenen komponentenweisen B-Prüfung und vor der
Vollkorpus-Abwesenheitsprüfung.

Alle drei optionalen Argumentlisten für A-Resume, B-Resume und
Abwesenheits-Seed verwenden nun die Bash-3.2-sichere nounset-Expansion. Eine
nicht gesetzte Option übergibt exakt null Argumente; ein gesetztes
Flag-/Wert-Paar bleibt unverändert. Prompt, Modell, Retrieval, Gold und
fachliche Entscheidung ändern sich nicht. Die vorhandenen 210 vollständigen
B-Batches und 362 terminalen Requirements bleiben wiederverwendbar und
müssen beim Produktresume nicht neu berechnet werden.

Auf dem exakten Produkt- und Teststand
`26c723da6dfa4da538eba05490f03da340f33b73` bestanden auf dem Mac Studio der
ausführbare Runnervertrag mit 7/7 Tests und der vollständige Gate mit 212/212
Suites und 3.134/3.134 Tests, allen drei Lints, Prisma,
Capability-Inventar, Prettier, Frontend-Produktionsbuild und
macOS-Installer-Suite. Der nachfolgende Inventar- und Releaseabschluss
verändert keinen Produkt- oder Testcode.

Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz. Er ist kein unabhängiger
Generalisierungs-, Holdout- oder 99-Prozent-Nachweis.

Change-Set:

- `LF-V3915-EMPTY-OPTIONAL-ARGUMENTS-20260920-001`

Paired Knowledge-Commit: `98f75baa5`.
