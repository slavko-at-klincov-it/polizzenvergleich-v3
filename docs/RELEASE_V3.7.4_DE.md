# Polizzenvergleich V3.7.4

V3.7.4 trennt im gerichteten LF-Referenzmodus die interne fachliche Analyse
von der Kundendarstellung. Intern bleiben die fünf differenzierten Outcomes
für Diagnose, Audit und Weiterentwicklung erhalten. Neu erzeugte LF-Ergebnisse
zeigen dem Kunden dagegen ausschließlich `Gefunden` oder `Nicht gefunden`.
`Gefunden` bedeutet, dass eine darstellbare Fundstelle oder ein darstellbarer
Inhalt des Gegenstücks vorliegt; es behauptet weder Gleichwertigkeit noch
Versicherungsschutz. `Nicht gefunden` bedeutet nur, dass dieser Lauf keine
robuste Fundstelle darstellen konnte.

Der neue öffentliche Vertrag
`LF_REFERENCE_CUSTOMER_PRESENTATION_V1` wird bereits beim Erzeugen des
privaten Ergebnisses markiert. Dadurch bleiben historische V3.7.3-Ergebnisse
und ihre damaligen XLSX-Dateien unverändert. Die öffentliche LF-API entfernt
interne Outcomes, Regelcodes und Reviewfelder. Oberfläche und 14-spaltiger
LF-Export zählen den sichtbaren Binärstatus aus den tatsächlich darstellbaren
B-Inhalten und B-Fundstellen nach. Die letzte Spalte
`Fachliche Bewertung (manuell)` bleibt leer und für die Prüfung von oben nach
unten vorgesehen.

Die Suchverbesserungen sind als versionierte Discovery-V2-Tranche umgesetzt.
Sie ergänzen eng begrenzte Synonyme und Konzeptsuche für zuvor manuell
bestätigte Fundstellen bei Gebäudezubehör, Photovoltaik, Mess- und
Steuergeräten, Hindernisbeseitigung, Oberflächenschäden, Haftpflicht,
Eigenschäden und zeitlichen Geltungsbedingungen. Zusätzlich wurden drei
getrennte Semantikfehler behoben: lokale Genitiv-Kostenformulierungen,
source-gebundene Kategorien bei dynamischen LF-Anforderungen und die korrekte
Abbildung einer Dauer als Bedingung statt Limit.

Die Regeln bleiben komponentenlokal und fail-closed. Teilweise belegte,
abweichende oder ausgeschlossene Gegenstücke dürfen als Fundstelle sichtbar
sein, werden intern aber nicht zu Gleichwertigkeit hochgestuft. Ein im echten
B01-Dokument gefundener Fehlalarm einer zu breiten Eigenschaden-Suchphrase
wurde vor der Freigabe entfernt. Bloße Tätigkeitsnennungen reichen weiterhin
nicht als Kostenfundstelle.

Der erste vollständige LF-Endlauf deckte zusätzlich eine reproduzierbare
Modellgrenze auf: Bei einer positiven, lokal vollständigen Klausel `auf Erstes
Risiko` gab Qwen zweimal eine formal ungültige Candidate-ID-Antwort aus und
bezeichnete die Klausel zugleich fälschlich als Ausschluss. Der strikte
Validator brach korrekt ab. Solche ausdrücklich auf Erstes Risiko gestellten
Klauseln werden deshalb nun mit einer engen serverseitigen Positivregel
klassifiziert; explizite negative Versicherungssätze haben weiterhin Vorrang.
Der echte B01/LR07-Canary besteht mit 67/67 Komponenten und Kontrollen.

Am Implementierungsstand bestanden auf dem Mac Studio 37/37 breit betroffene
Server-Suites mit 840/840 Tests sowie die zusätzlichen Candidate- und
Discovery-Verträge mit 77/77 beziehungsweise 6/6 Tests. Echte gezielte
Qwen-Canaries bestätigten die vorgesehenen Fundstellen und die Nullkontrolle.

Der frische symmetrische 1+1-Nichtregressionslauf verwendete exakt ein
LF-Dokument und ein WEVIG-Musterdokument. Er schloss in 16 Minuten und
59,345 Sekunden 2/2 Dokumente und 10/10 Kategorieprüfungen ab. Die 224
eindeutigen Vergleichszeilen zeigen unverändert 13 Vorteile A, einen Vorteil
B, 38 Dokumentationsunterschiede, 126 gleichwertige Punkte, null Punkte ohne
dokumentierten Vorteil, 16 nicht vergleichbare und 30 unklare Punkte;
Kundenreview bleibt 30. Artefaktmanifest und die XLSX mit einem Blatt, 17
Spalten und 224 Datenzeilen bestanden die unabhängige Nachprüfung. Der neue
LF-Kundenmarker ist im symmetrischen Ergebnis erwartungsgemäß nicht vorhanden.

Auf dem endgültigen Implementierungscommit
`e8e9e94862acf1e48a7f8110382af084e5d37439` bestanden auf dem Mac Studio
190/190 Suites mit 2.570/2.570 Tests, Server-, Frontend- und Collector-Lint,
Frontend-Produktionsbuild, Prisma-Validierung und die vollständige
macOS-Installer-Suite. Der frische cachefreie LF-1+9-Endlauf unter Session
`df7d7179-1c49-412b-b2ff-0ec6b1fdc52f` verarbeitete exakt das LF-Dokument
und alle neun B-Dokumente der V3.7.3-Baseline. Er schloss nach 44 Minuten und
30,203 Sekunden mit 10/10 Dokumenten und 117/117 Kategorieprüfungen ab.

Das private Ergebnis enthält weiterhin genau 13 Kategorien und 283
eindeutige A-Zeilen ohne B-only-Zeile: 40 Gegenstücke gefunden, 91 teilweise
gefunden, 151 gegenstückseitig unklar und eine Referenzzeile unklar. In der
neuen Kundensicht sind 148 Zeilen `Gefunden` und 135 `Nicht gefunden`. Alle 13
geplanten neuen Fundstellen sind vorhanden. Gegenüber der abgeleiteten
V3.7.3-Kundensicht mit 136/147 kommt netto eine Verbesserung um zwölf Zeilen
zustande, weil zugleich der alte Fehlbeleg `ST-07` entfernt wurde: Eine
Fundstelle zu einem Regenablaufrohr „in der Außenmauer“ war kein Beleg für
einen Fassadenschaden. Es ging daher keine valide Kundenfundstelle verloren.
Die bisherigen Fehlrichtungen bei `LW-G-15` und `HP-18` wurden von
`ausgeschlossen` auf den tatsächlich dokumentierten Einschluss korrigiert;
die Fundstellen bleiben sichtbar und intern vorsichtig teilweise
beziehungsweise unklar.

Der neue Lauf benötigte 550 Modellaufrufe, 1.227.028 Prompt-Tokens und 30.618
Completion-Tokens bei null Cachetreffern und null Cache-Schreibfehlern. Das
sind gegenüber V3.7.3 86 Modellaufrufe, 429.922 Prompt-Tokens und 10.386
Completion-Tokens weniger; die Laufzeit sank um 17 Minuten und 2,572 Sekunden
beziehungsweise 27,7 Prozent. Das ist ein Messwert dieses bekannten Laufs,
keine allgemeine Leistungszusage.

Strikter gespeicherter Readback, Artefaktmanifest, Exportvertrag samt
archivierter Datei und öffentliche API-Projektion bestanden. Das LF-
Source-Block-Ledger blieb bytegleich. Im semantischen Manifest änderten sich
ausschließlich die elf geplanten Dauer-/Fristkomponenten von `LIMIT` auf
`CONDITION`; nach Rücknahme genau dieser Änderungen ist das Manifest
strukturell identisch zur Baseline. Alle 283 A-Zeilen und ihre Reihenfolge
blieben nach Abzug der laufabhängigen Dokument-UUID unverändert. Die XLSX
bestand den unabhängigen ExcelJS-Readback und die Sichtkontrolle mit
LibreOffice/Calc: ein Blatt, 14 Spalten, 283 Datenzeilen, ausschließlich
`Gefunden`/`Nicht gefunden` und 283 leere manuelle Bewertungsfelder. SHA-256:
`972d6a7db623d71d1f98f32e2e80effde786e9d82421bb4699498e6dbd982b8c`.
Die Kundenkopie heißt
`LF-IMMO-Referenzvergleich-V3.7.4-2026-09-10.xlsx`.

Alle Messungen verwenden bekannte LF-/WEVIG-Entwicklungsdokumente. Sie sind
keine fachliche Expertenabnahme, kein unbekannter Versicherer-Holdout und kein
99-Prozent-Nachweis.
