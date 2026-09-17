# Polizzenvergleich V3.8.4

V3.8.4 korrigiert einen source-bound Strukturgrenzfall, den der echte kalte
V3.8.3-LF-1+9-Produktlauf sichtbar gemacht hat. Der Lauf stoppte korrekt
fail-closed im vierten A-Klassifikationsbatch. Drei vorherige Batches blieben
vollständig und resumierbar erhalten.

Die betroffene Listen-Unit bestand aus einem predicate-freien internen
Objekt-Listenkopf und einem darunterliegenden, über mehrere PDF-Textblöcke
fortgesetzten Listenpunkt. Qwen erzeugte wiederholt die fachlichen
Objektkomponenten, ließ aber sowohl den internen Listenkopf als auch den
ersten Satzblock aus der Komponentenprovenienz aus. Der Validator akzeptierte
die unvollständige Quellenbindung deshalb nicht.

Der Klassifikationslauf V66 erweitert die vorhandene Listen-Normalisierung in
zwei eng begrenzten Schritten:

- Ein predicate-freier interner `LIST_GOVERNOR` der Form `bei …` wird nur bei
  einer bereits belegten `INSURED_OBJECT`-Klassifikation als wörtliche
  `OBJECT`-Komponente in die abhängige Requirement übernommen.
- Beginnt derselbe serverseitig gebundene
  `LIST_ITEM_WITH_CONTINUATIONS`-Satz vor dem ersten atomaren Objektwort, wird
  die Provenienz genau der eindeutig frühesten Objektkomponente bis an den
  Satzanfang erweitert.

Operative Deckungs-Governors werden nicht als Objekt umgedeutet. Ein
ungebundener Einzel-Segment-Listenkopf bleibt unverändert fail-closed. Die
Regel enthält keine bekannte Dokument-ID, Seite, Versichererbezeichnung oder
Kundenzeile.

Der gespeicherte echte V3.8.3-Fehlerfall wurde auf dem Mac Studio ohne neuen
Modellaufruf revalidiert. Die Unit ist unter V66 `OPERATIVE_MAPPED`; der
interne Listenkopf und der führende Satzblock sind quellengebunden, die
fachliche Requirement-Anzahl bleibt unverändert. Der fokussierte
Vertragscheck bestand mit 366/366 Tests.

Gold-283-V2 bleibt unverändert und wird nicht als Produktionsvorlage gelesen.
Der vollständige kalte V3.8.4-Produktlauf und ein unabhängiger,
expertengelabelter Mehrversicherer-Holdout bleiben getrennte Nachweise. Dieser
Release allein ist kein allgemeiner 99-Prozent- oder
Generalisierungsnachweis.
