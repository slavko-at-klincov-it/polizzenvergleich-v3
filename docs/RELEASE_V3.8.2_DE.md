# Polizzenvergleich V3.8.2

V3.8.2 korrigiert den zweiten source-bound Befund aus dem echten kalten
V3.8.1-LF-1+9-Produktlauf. Der Lauf stoppte nach einem gültigen ersten
A-Batch im zweiten Batch korrekt fail-closed. Alle sechs Modellaufrufe waren
technisch gültig; zwei administrative A-Aussagen blieben jedoch wegen
fehlender Pflichtlabels semantisch unvollständig.

Der Klassifikationslauf V64 materialisiert nun zwei allgemeine, eng begrenzte
Satztypen deterministisch aus der Originalquelle:

- administrative Vermerk-, Ausweis- und Dokumentationspflichten als
  `OBLIGATION` mit source-bound `CONDITION`;
- Geltungsregeln unter ausdrücklich genannten Voraussetzungen als
  `CONDITION`, getrennt von einer nachfolgenden Deckungsaufzählung.

Die Regel enthält keine Kunden-ID, Seite, Versichererbezeichnung oder fest
codierte Ergebniszeile. Aussagen mit ausdrücklicher Deckungs-, Ausschluss-
oder Entschädigungswirkung sind vom administrativen Normalisierer
ausgeschlossen und verbleiben im bestehenden fachlichen Pfad.

Der gespeicherte echte V3.8.1-Fehlerbatch wurde auf dem Mac Studio ohne neuen
Modellaufruf gegen V64 revalidiert: 6/6 Units wurden aus den vorhandenen
Versuchsartefakten wiederhergestellt, der Batch bestand ohne Diagnose. V63
bleibt als historischer Resume-Vorgänger lesbar; neu erzeugte Läufe verwenden
V64.

Gold-283-V2 bleibt unverändert. Der Fix verändert keine Goldzeile und liest
Gold weder als Produktvorlage noch als Produktionsregel ein.

Dieser Release ist weiterhin ein kontrollierter Kunden-MVP für den bekannten
LF-1+9-Fall. Der vollständige kalte V3.8.2-Produktlauf, die daraus erzeugte
Kunden-XLSX und ein unabhängiger, expertengelabelter Mehrversicherer-Holdout
sind getrennte Nachweise. Insbesondere ist V3.8.2 allein kein allgemeiner
99-Prozent- oder Generalisierungsnachweis.
