# Polizzenvergleich V3.8.3

V3.8.3 korrigiert den dritten source-bound Befund aus den echten kalten
LF-1+9-Produktläufen. Der V3.8.2-Lauf überschritt den zuvor blockierenden
zweiten A-Batch, stoppte aber im fünften A-Batch korrekt fail-closed.

Die betroffene Unit war bereits in drei selbstständige Listen-Requirements
zerlegt. Objektrollen, Segmentgrenzen und Quellenblöcke waren korrekt. In
einem Objekt-Listenpunkt blieb jedoch eine ausdrücklich parenthetisch
formulierte Ausnahme ohne eigene Ausschlusswirkung.

Der Klassifikationslauf V65 materialisiert parenthetische Objektausnahmen der
Form `ausgenommen …` oder `exklusive …` nun als separate source-bound
`COVERAGE_EFFECT` mit `EXCLUDED`. Das umgebende Objekt-Requirement und seine
Listen-/Fortsetzungsgrenzen bleiben erhalten. Bereits negative
Deckungsklauseln sind eine harte Negativgrenze, damit eine Ausnahme zu einem
Ausschluss nicht fälschlich erneut negiert wird. Bereits vorhandene identische
Ausschlusswirkungen werden nicht dupliziert.

Die Implementierung enthält keine bekannte Dokument-ID, Seite,
Versichererbezeichnung oder fest codierte Kundenzeile. V64 bleibt als
historischer Resume-Vorgänger revalidierbar; neue Läufe verwenden V65.

Der gespeicherte echte V3.8.2-Fehlerfall wurde auf dem Mac Studio ohne neuen
Modellaufruf revalidiert: drei Requirements blieben erhalten, genau eine
`EXCLUDED`-Wirkung wurde ergänzt und die Unit bestand ohne Diagnose. Der
fokussierte Vertragscheck bestand mit 364/364 Tests.

Gold-283-V2 bleibt unverändert und wird nicht als Produktionsvorlage gelesen.
Der vollständige kalte V3.8.3-Produktlauf und ein unabhängiger,
expertengelabelter Mehrversicherer-Holdout bleiben getrennte Nachweise. Dieser
Release allein ist kein allgemeiner 99-Prozent- oder Generalisierungsnachweis.
