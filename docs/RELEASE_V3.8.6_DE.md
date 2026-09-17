# Polizzenvergleich V3.8.6

V3.8.6 korrigiert den produktiven Resume über Releasegrenzen. Ein Release
ändert bewusst die Run-Signatur und erzeugt deshalb einen neuen, unveränderlich
gebundenen Run-Root. Bis V3.8.5 wurde die bereits vorhandene partielle
A-Evidenz einer identischen Session dem neuen Run jedoch nicht übergeben. Ein
erneuter Start begann deshalb fälschlich wieder bei Batch 1.

Der Worker wählt nun read-only den kompatiblen Vorgängerlauf mit den meisten
vollständigen Batchartefakten. Die Auswahl ist an Modus, Produktprofil,
Dokumenthashes und -reihenfolge, Modell und Kontext sowie den
Embeddingvertrag gebunden. Symlinks und abweichende Verträge werden nicht
verwendet.

Der A-Klassifikator übernimmt keine alten PASS-Labels. Er prüft zuerst den
vollständigen Source- und Batchplan und validiert danach jede vorhandene
Batch- oder Versuchsjournalantwort unter dem aktuellen V67/V16/V29-Vertrag.
Nur aktuell gültige Unit-Antworten werden in neue revisionsgebundene
Batchartefakte materialisiert. Der erste Modellaufruf betrifft ausschließlich
die erste danach noch offene Unit; die Vorgängerartefakte bleiben bytegleich.

Ein Realartefakt-Replay der ersten fünf Batches der kalten Session 14 bestand
5/5 mit 30 übernommenen, aktuell revalidierten Units und null Modellaufrufen.
Plan- und Klassifikationsbäume des Vorgängers blieben vor und nach dem Replay
hashgleich.

Gold-283-V2 bleibt unverändert und ist Regression für das bekannte LF-1+9-Set,
nicht Produktionsvorlage oder allgemeiner Generalisierungsnachweis. Der
vollständige fortgesetzte Produktlauf und ein unabhängiger,
expertengelabelter Mehrversicherer-Holdout bleiben getrennte Nachweise.
