# Polizzenvergleich V3.9.8

V3.9.8 behebt den fail-closed Stopp des kalten dynamischen A-Laufs in Batch 38. Die vier offenen Units lagen hinter nummerierten Abschnittsüberschriften
wie `1. Wann gilt die Versicherung?` und `2. Wo gilt die Versicherung?`.
Diese Units wurden bereits deterministisch als Struktur terminalisiert,
beendeten im Evidenzplan aber den älteren operativen Governor nicht. Dadurch
wurde eine vorausgehende Ausschlussüberschrift unzulässig in positive Zeit-,
Rückwirkungs- und Ortsklauseln getragen.

Der V79-Laufvertrag und der V7-Evidenzkontextvertrag adaptieren die bestehende
bounded A-Klassifikation:

- eine vollständig aus `HEADING_CANDIDATE`-Blöcken bestehende nummerierte
  Strukturüberschrift beendet den aktiven operativen Überschriften-Governor;
- eine nummerierte direkte Frage mit abschließendem Fragezeichen gilt dabei
  als Struktur und nicht als operative Aussage;
- nummerierte operative Aussagesätze mit eigenem Prädikat bleiben unter den
  normalen source-bound Evidenzregeln;
- vorhandene PASS-Batches und Attempt-Journale werden unter dem neuen
  Evidenzkontext vollständig revalidiert; kein alter PASS-Marker wird blind
  übernommen.

Auf dem Mac Studio bestand der vollständige fokussierte A-Vertrag mit
413/413 Tests. Die Offline-Revalidierung veränderte keinen gespeicherten
Versuch. Unter der korrigierten Evidenzgrenze bleiben aus den alten Antworten
in Batch 37 noch 5/6 und in Batch 38 noch 2/6 Units gültig; ausschließlich die
nun evidenzfalsch gewordenen beziehungsweise weiterhin offenen Units müssen
neu klassifiziert werden.

Der bekannte LF-1+9-Lauf bleibt Regressionsevidenz und ist kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Der vollständige Release-Gate bestand anschließend auf Commit
`00de36d5cd803bd5296b6a76330950c4574342b2` mit 212/212 Testsuiten und
3.108/3.108 Tests sowie allen Lints, Prisma, Capability-Inventar, Prettier,
Frontend-Build und Installer-Suite. V3.9.8 wurde über den offiziellen Updater
installiert; Doctor, API und SQLite bestanden. Der Produkt-Resume schloss
Batch 37 ab und brachte Batch 38 auf 5/6 gültige Units. Die letzte Unit stoppte
korrekt fail-closed, weil das Modell in einem ansonsten source-bound Zeitlabel
ein Originalwort veränderte. Diese Restursache und die dabei sichtbar
gewordene mehrstufige Resume-Lücke werden ausschließlich im Nachfolgerelease
V3.9.9 behoben.

Change-Set:
`LF-V398-NUMBERED-HEADING-GOVERNOR-BOUNDARY-20260917-001`.
