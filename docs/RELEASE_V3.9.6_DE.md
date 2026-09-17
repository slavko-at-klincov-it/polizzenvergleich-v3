# Polizzenvergleich V3.9.6

V3.9.6 behebt den fail-closed Stopp des kalten dynamischen A-Laufs in Batch
35, ohne gespeicherte Modellantworten neu zu berechnen oder fachliche Inhalte
frei zu ergänzen.

Der V77-Laufvertrag führt vier eng begrenzte, source-bound Normalisierungen
ein:

- ausdrückliche Auslassungen (`...` oder `…`) werden nur bei genau einer
  vollständigen Originalspanne innerhalb des kleinsten durch die bereits
  deklarierten eigenen Quellblöcke begrenzten Fensters zurückgeführt;
- ein mehrfach vorkommendes wörtliches Komponentenlabel wird nur auf die
  eindeutige Originalstelle des vollständigen Requirement-Displaylabels
  verengt, wenn sämtliche Zielblöcke bereits vom Modell deklariert wurden;
- eine kurze eindeutige Schadensüberschrift direkt nach einem reinen
  Aufzählungsmarker wird als Schadenskomponente materialisiert, sofern die
  Requirement bereits eine ausdrückliche Deckungswirkung besitzt;
- `Versicherungsschutz ... geleistet` wird als positive Deckungswirkung
  akzeptiert, bleibt aber vollständig an die Originalquelle gebunden.

Mehrdeutige, unvollständige, fremde oder nicht wörtlich belegte Fälle bleiben
fail-closed. Der unmittelbare V76-Vorgänger ist ausdrücklich resumierbar und
wird unter dem aktuellen Source-Plan und Validator erneut geprüft.

Auf dem Mac Studio bestanden 409/409 fokussierte Vertragstests. Der echte
gespeicherte Batch 35 revalidierte anschließend offline mit 6/6 Units und
null Diagnosen. Der Attempt-Baum blieb unter SHA-256
`64bc381721de32f585b80202556ece14c1c33984093ca080be43835bbe90641f`
unverändert.

Der exakte Release-Commit
`acbea5179a1392bdf993a6f540623392d0f17071` bestand auf dem Mac Studio das
vollständige Gate mit 212/212 Testsuiten und 3.104/3.104 Tests sowie Server-,
Frontend- und Collector-Lint, Prisma, Capability-Inventar, Prettier,
Frontend-Build und Installer-Suite. Nach der Installation über den offiziellen
Updater waren HEAD, der annotierte Tag `v3.9.6` und `origin/main` hashgleich;
Doctor, API und SQLite-`quick_check` bestanden. Im echten Resume-Root
`resume-e1ac1b841c9dd26d6c2f42f0` wurden Batches 1 bis 35 unter V77 als PASS
revalidiert; neue Modellarbeit begann erst bei Batch 36.

Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz und ist kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set: `LF-V396-BATCH35-EVIDENCE-BINDING-20260917-001`.
