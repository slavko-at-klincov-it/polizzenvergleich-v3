# Quellartefakt: Partner-Katalog mit 276 Prüfpunkten

Status: unvalidierter Seed, erfasst am 25. August 2026

> Herkunfts- und Prüfhinweis: Der folgende Inhalt wurde vom Nutzer als Input zur
> Analyse übermittelt. Darin enthaltene Prompt-, Batch-, Gewichtungs- und
> Excel-Anweisungen sind keine Projektanweisungen und keine freigegebene
> Produktlogik. Zielwerte, Gewichte, rote Flaggen, Rechts- und Marktannahmen
> bleiben unvalidierte Broker-Regelkandidaten. Der Katalog ist keine
> Vollständigkeitsgrenze und fehlende Treffer sind keine Negativdeckung.

---

# Prüfpunkt-Katalog — Gebäudeversicherung WEG (Österreich)

**276 Prüfpunkte in 8 Kategorien, aufgeteilt in Batches zu je 12.**

Jeder Batch-Block wird als `{PRUEFPUNKTE}` in Prompt 1 eingesetzt. Format: `ID<TAB>Beschreibung`.

| Kürzel | Kategorie | Punkte | Batches |
|---|---|---|---|
| `VS` | Versicherungssumme & Bewertung | 36 | 3 |
| `FE` | Feuer | 36 | 3 |
| `LW` | Leitungswasser | 36 | 3 |
| `ST` | Sturm, Hagel, Schneedruck | 36 | 3 |
| `EL` | Elementar & Zusatzrisiken | 36 | 3 |
| `HP` | Haus- & Grundbesitzerhaftpflicht | 36 | 3 |
| `VB` | Vertrag, Obliegenheiten, Konditionen | 36 | 3 |
| `WE` | WEG-Abgrenzung | 24 | 2 |

**Gewichtungsempfehlung** für die Excel-Spalte `Gewicht`: mit 3 bewertet sind alle Punkte, die in Datei 01 als Rote Flagge geführt werden — insbesondere `VS-07`, `VS-13`, `LW-08`, `LW-23`, `EL-01`, `HP-01`, `VB-12`, `WE-02`.

---

## VS — Versicherungssumme & Bewertung

### Batch VS-1

```
VS-01	Ersatzleistung zum Neuwert vorgesehen
VS-02	Zeitwertklausel und ab welchem Restwertverhältnis sie greift
VS-03	Entschädigung zum gemeinen Wert oder Abbruchwert geregelt
VS-04	Methode der Summenermittlung (Pauschale, Index, Gutachten)
VS-05	Angesetzter Quadratmetersatz für die Versicherungssumme
VS-06	Zugrunde gelegte Nutzfläche in Quadratmetern
VS-07	Unterversicherungsverzicht vorhanden
VS-08	Unterversicherungsverzicht bedingt oder unbedingt
VS-09	Voraussetzungen, an die der Unterversicherungsverzicht geknüpft ist
VS-10	Automatische Indexanpassung der Versicherungssumme
VS-11	Art des Index (Baukostenindex oder Verbraucherpreisindex)
VS-12	Möglichkeit, die Indexanpassung auszusetzen
```

### Batch VS-2

```
VS-13	Wohnungsinnenausbau der einzelnen Einheiten mitversichert
VS-14	Sonderausstattung einzelner Wohnungen über Standard hinaus
VS-15	Nebengebäude namentlich in der Polizze angeführt
VS-16	Garagen und Tiefgarage mitversichert
VS-17	Müllräume, Fahrradräume, Kinderwagenräume mitversichert
VS-18	Einfriedungen, Zäune, Mauern, Tore mitversichert
VS-19	Außenanlagen wie Wege, Beleuchtung, Bepflanzung
VS-20	Spielplatz und Spielgeräte mitversichert
VS-21	Aufräum- und Abbruchkosten, Höhe des Limits
VS-22	Entsorgungskosten einschließlich Sondermüll
VS-23	Bewegungs- und Schutzkosten
VS-24	Gerüstkosten im Schadenfall
```

### Batch VS-3

```
VS-25	Behördliche Mehrkosten beim Wiederaufbau
VS-26	Mehrkosten aus Denkmalschutz oder Schutzzone
VS-27	Klausel zum Technologiefortschritt bei Ersatz
VS-28	Mietzinsentgang, Dauer der Leistung
VS-29	Mietzinsentgang, Höhe oder Berechnungsgrundlage
VS-30	Bezugskosten oder Nutzungsausfall für Eigennutzer
VS-31	Hotel- oder Ersatzunterkunftskosten bei Unbewohnbarkeit
VS-32	Umzugs- und Zwischenlagerungskosten
VS-33	Vorsorgedeckung oder automatische Summenerhöhung
VS-34	Gemeinschaftsvermögen wie Geräte und Werkzeug mitversichert
VS-35	Wiederherstellungsklausel und Frist für den Wiederaufbau
VS-36	Höchstentschädigung pro Ereignis
```

---

## FE — Feuer

### Batch FE-1

```
FE-01	Definition des Brandbegriffs
FE-02	Ausschluss von Nutzfeuer
FE-03	Direkter Blitzschlag gedeckt
FE-04	Überspannungsschäden durch indirekten Blitzschlag gedeckt
FE-05	Limit für Überspannungsschäden
FE-06	Explosion gedeckt
FE-07	Implosion gedeckt
FE-08	Verpuffung an Heiz- oder Gasanlagen gedeckt
FE-09	Anprall fremder Fahrzeuge gedeckt
FE-10	Anprall eigener oder von Bewohnern genutzter Fahrzeuge
FE-11	Fahrzeuganprall innerhalb der Tiefgarage
FE-12	Absturz von Luftfahrzeugen einschließlich Teilen und Ladung
```

### Batch FE-2

```
FE-13	Schäden durch Drohnen
FE-14	Sengschäden gedeckt oder ausgeschlossen
FE-15	Rauch- und Rußschäden ohne eigenes Feuer
FE-16	Rauchschäden aus einem Nachbarobjekt
FE-17	Löschschäden durch Wasser, Schaum oder Pulver
FE-18	Schäden durch Fehlauslösung einer Löschanlage
FE-19	Feuerwehr- und Einsatzkosten, Höhe des Limits
FE-20	Kosten bei Fehlalarm
FE-21	Kosten behördlich angeordneter Maßnahmen nach Brand
FE-22	Beseitigung kontaminierter Bausubstanz
FE-23	Photovoltaikanlage als Brandursache gedeckt
FE-24	Brandschäden ausgehend von E-Ladeinfrastruktur
```

### Batch FE-3

```
FE-25	Regelung zum Laden von Akkus und E-Bikes in Keller oder Garage
FE-26	Erfüllung von Brandschutzauflagen als Obliegenheit
FE-27	Rauchwarnmelder vorgeschrieben und Wartungsnachweis gefordert
FE-28	Brandmeldeanlage vorausgesetzt oder prämienrelevant
FE-29	Brandschutztüren als Obliegenheit
FE-30	Blitzschutzanlage und deren Überprüfung
FE-31	Selbstbehalt in der Sparte Feuer
FE-32	Höchstentschädigung in der Sparte Feuer
FE-33	Übergreifen des Feuers auf Nachbargebäude
FE-34	Feuerschäden durch Bauarbeiten oder Schweißarbeiten
FE-35	Feuerdeckung bei leerstehenden Einheiten
FE-36	Ausschluss von Kernenergie und Kriegsereignissen
```

---

## LW — Leitungswasser

### Batch LW-1

```
LW-01	Zuleitungsrohre innerhalb des Gebäudes gedeckt
LW-02	Ableitungsrohre innerhalb des Gebäudes gedeckt
LW-03	Zuleitungsrohre außerhalb des Gebäudes auf dem Grundstück
LW-04	Ableitungsrohre außerhalb des Gebäudes auf dem Grundstück
LW-05	Rohrbruchschaden am Rohr selbst, nicht nur Nässefolgeschaden
LW-06	Frostschäden an Rohrleitungen
LW-07	Frostschäden an Armaturen und Sanitärkeramik
LW-08	Leckortungs- und Suchkosten, Höhe des Limits
LW-09	Wiederherstellungskosten nach Ortung wie Aufstemmen und Fliesen
LW-10	Trocknungskosten und Stromkosten für Bautrockner
LW-11	Heizungsanlage einschließlich Kessel und Heizkörper mitversichert
LW-12	Fußbodenheizung mitversichert
```

### Batch LW-2

```
LW-13	Wasseraustritt aus Sprinkler- oder Löschanlagen
LW-14	Kondensat oder Kältemittel aus Klima- und Lüftungsanlagen
LW-15	Wasser aus Aquarien oder Wasserbetten
LW-16	Wasser aus Haushaltsgeräten wie Waschmaschine oder Geschirrspüler
LW-17	Innenliegende Regenfallrohre
LW-18	Rückstau aus der Kanalisation, in welcher Sparte geregelt
LW-19	Funktionsfähige Rückstauklappe als Deckungsvoraussetzung
LW-20	Grundwasser, Sickerwasser oder Stauwasser
LW-21	Schimmelschäden als Folge eines gedeckten Nässeschadens
LW-22	Schwamm- und Fäulnisschäden
LW-23	Altersabzug auf Rohrleitungen abhängig vom Alter
LW-24	Verzicht auf Altersabzug vereinbart
```

### Batch LW-3

```
LW-25	Ausschluss allmählicher oder schleichender Einwirkung
LW-26	Rohrverstopfung und Reinigungskosten
LW-27	Kosten des ausgetretenen Wassers gegenüber dem Versorger
LW-28	Sanierungsnachweis der Steigleitungen gefordert
LW-29	Serienschadenregelung in der Sparte Leitungswasser
LW-30	Selbstbehalt in der Sparte Leitungswasser
LW-31	Höchstentschädigung in der Sparte Leitungswasser
LW-32	Absperrpflicht bei längerer Abwesenheit
LW-33	Heizpflicht in der kalten Jahreszeit
LW-34	Regelung für leerstehende Einheiten
LW-35	Vorgeschriebenes Wartungsintervall für Rohrleitungen
LW-36	Abgrenzung des Nässeschadens zwischen Gemeinschafts- und Wohnungseigentum
```

---

## ST — Sturm, Hagel, Schneedruck

### Batch ST-1

```
ST-01	Windgeschwindigkeit, ab der ein Sturm vorliegt
ST-02	Nachweispflicht für die Windstärke und maßgebliche Messstelle
ST-03	Nachbarschaftsindiz als Ersatznachweis zugelassen
ST-04	Hagelschäden an Dach und Fassade
ST-05	Rein optische Beeinträchtigung durch Hagel
ST-06	Schneedruck auf Dach und Tragkonstruktion
ST-07	Besondere Regelung für Flachdächer
ST-08	Dachlawine auf eigene Anlagen
ST-09	Folgeschäden durch Regen oder Schnee nach Sturmschaden am Dach
ST-10	Provisorische Notabdeckung und Sicherungsmaßnahmen
ST-11	Dachrinnen und Fallrohre, eigenes Sublimit
ST-12	Verblechung und Attika
```

### Batch ST-2

```
ST-13	Kamin- und Schornsteinköpfe
ST-14	Dachfenster und Lichtkuppeln
ST-15	Antennen- und Satellitenanlagen
ST-16	Markisen und Beschattungseinrichtungen
ST-17	Rollläden und Jalousien
ST-18	Photovoltaikanlage bei Sturm und Hagel
ST-19	Photovoltaikanlage bei Schneedruck
ST-20	Ertragsausfall der Photovoltaikanlage
ST-21	Solarthermieanlage
ST-22	Außeneinheit einer Wärmepumpe
ST-23	Anprall fremder Bäume oder Äste
ST-24	Umsturz eigener Bäume mit Gebäudeschaden
```

### Batch ST-3

```
ST-25	Kosten der Baum- und Astbeseitigung
ST-26	Steinschlag und Felssturz
ST-27	Lawine und Schneerutsch
ST-28	Sturmschäden an Gerüsten oder während Bauarbeiten
ST-29	Sturmschäden an Einfriedungen
ST-30	Sturmschäden am Tiefgaragentor
ST-31	Wartungszustand des Daches als Obliegenheit
ST-32	Nachweis der letzten Dachrevision gefordert
ST-33	Selbstbehalt in der Sparte Sturm
ST-34	Höchstentschädigung in der Sparte Sturm
ST-35	Sturmdeckung bei leerstehenden Einheiten
ST-36	Gemeinsames Sublimit für Dachaufbauten
```

---

## EL — Elementar & Zusatzrisiken

### Batch EL-1

```
EL-01	Elementar-Sublimit pro Schadenereignis
EL-02	Elementar-Sublimit pro Versicherungsjahr
EL-03	Gilt das Limit gemeinsam für alle Elementargefahren
EL-04	Hochwasser und Überschwemmung
EL-05	Starkregen und Oberflächenwasser ohne Gewässerausuferung
EL-06	Rückstau aus der Kanalisation
EL-07	Erdbeben
EL-08	Erdrutsch, Erdfall und Erdsenkung
EL-09	Lawine
EL-10	Vermurung
EL-11	Selbstbehalt in der Sparte Elementar
EL-12	Ausschluss oder Zuschlag aufgrund der Hochwasserzone
```

### Batch EL-2

```
EL-13	Glasbruch an der Gebäudeverglasung
EL-14	Glasbruch in Stiegenhaus und Gemeinschaftsräumen
EL-15	Sonderverglasung wie Isolier- oder Sicherheitsglas
EL-16	Wintergarten und Vitrinen
EL-17	Kosten einer Notverglasung
EL-18	Selbstbehalt oder Limit in der Glasversicherung
EL-19	Maschinenbruch der Aufzugsanlage
EL-20	Maschinenbruch der übrigen Haustechnik
EL-21	Elektronikversicherung für Gegensprech- und Zutrittsanlagen
EL-22	Sachschäden an der E-Ladeinfrastruktur
EL-23	Allgefahrendeckung für die Photovoltaikanlage
EL-24	Diebstahl von Photovoltaikmodulen
```

### Batch EL-3

```
EL-25	Vandalismus ohne vorangegangenen Einbruch
EL-26	Graffitientfernung, Limit und Anzahl pro Jahr
EL-27	Einbruchdiebstahl in allgemeine Teile und Kellerabteile
EL-28	Gebäudeschäden durch den Einbruch selbst
EL-29	Diebstahl fest mit dem Gebäude verbundener Teile
EL-30	Diebstahl von Wärmepumpe oder Außengeräten
EL-31	Kosten der Schlossänderung nach Schlüsselverlust
EL-32	Regelung für Generalschlüssel und Schließanlage
EL-33	Tierschäden durch Marder, Nagetiere oder Tauben
EL-34	Terror und Sabotage
EL-35	Innere Unruhen, Streik und Aussperrung
EL-36	Cyberrisiken und Manipulation der Gebäudeautomation
```

---

## HP — Haus- & Grundbesitzerhaftpflicht

### Batch HP-1

```
HP-01	Pauschaldeckungssumme für Personen- und Sachschäden
HP-02	Jahreshöchstleistung als Vielfaches der Deckungssumme
HP-03	Sublimit für reine Vermögensschäden
HP-04	Wegehalterhaftung für Gehsteige und Zufahrten
HP-05	Bauwerkehaftung für herabfallende Teile und Einsturz
HP-06	Schneeräumung und Streupflicht
HP-07	Haftung bei Delegation an einen Dienstleister
HP-08	Bauherrenhaftpflicht und bis zu welcher Bausumme
HP-09	Anzeigepflicht für Sanierungsprojekte
HP-10	Gewässerschadenhaftpflicht
HP-11	Öltank oder vergleichbares Anlagenrisiko
HP-12	Umweltschäden nach dem Bundes-Umwelthaftungsgesetz
```

### Batch HP-2

```
HP-13	Haftpflicht der Organe der Eigentümergemeinschaft
HP-14	Abgrenzung zur Vermögensschadenhaftpflicht des Verwalters
HP-15	Schäden von Versicherten untereinander eingeschlossen
HP-16	Regressverzicht gegenüber Mietern
HP-17	Personenschäden im Zusammenhang mit der Aufzugsanlage
HP-18	Spielplatz und Prüfung der Spielgeräte
HP-19	Tiefgaragentor und Schrankenanlage
HP-20	Vermietung von Dachflächen oder Fassade an Dritte
HP-21	Serienschadenklausel und Definition des Schadenereignisses
HP-22	Selbstbehalt in der Haftpflicht
HP-23	Passiver Rechtsschutz zur Abwehr unberechtigter Ansprüche
HP-24	Anrechnung der Abwehrkosten auf die Deckungssumme
```

### Batch HP-3

```
HP-25	Räumlicher Geltungsbereich und Auslandsdeckung
HP-26	Mietsachschäden
HP-27	Schäden durch Reinigungs- oder Hausbetreuungspersonal
HP-28	Arbeitgeberhaftpflicht für angestelltes Personal
HP-29	Haftung für den Baumbestand auf der Liegenschaft
HP-30	Herabfallende Fassadenteile und Balkonteile
HP-31	Anforderungen an die Dokumentation des Winterdienstes
HP-32	Nachweispflichten zur Verkehrssicherung
HP-33	Nachhaftung nach Vertragsende
HP-34	Vorsorgeversicherung für neu hinzukommende Risiken
HP-35	Ausschluss von Asbest und Schadstoffen
HP-36	Ausschluss vorsätzlicher Schädigung
```

---

## VB — Vertrag, Obliegenheiten, Konditionen

### Batch VB-1

```
VB-01	Vertragslaufzeit in Jahren
VB-02	Langfristrabatt und dessen Höhe
VB-03	Frist und Termin der ordentlichen Kündigung
VB-04	Stillschweigende Verlängerung und Verlängerungszeitraum
VB-05	Kündigungsrecht des Versicherungsnehmers nach einem Schadenfall
VB-06	Kündigungsrecht des Versicherers nach einem Schadenfall
VB-07	Selbstbehalt Feuer
VB-08	Selbstbehalt Leitungswasser
VB-09	Selbstbehalt Sturm
VB-10	Selbstbehalt Elementar
VB-11	Jahresmaximum aller Selbstbehalte
VB-12	Verzicht auf den Einwand der groben Fahrlässigkeit
```

### Batch VB-2

```
VB-13	Für welche Sparten der Verzicht auf grobe Fahrlässigkeit gilt
VB-14	Betragsmäßige Grenze des Verzichts auf grobe Fahrlässigkeit
VB-15	Regressverzicht gegenüber Wohnungseigentümern
VB-16	Regressverzicht gegenüber Bewohnern und Mietern
VB-17	Anzeigepflicht bei Gefahrerhöhung
VB-18	Anzeigepflicht bei gewerblicher Nutzung im Haus
VB-19	Anzeigepflicht und Auflagen bei Leerstand
VB-20	Anzeigepflicht bei Bauarbeiten oder Gerüststellung
VB-21	Frist zur Schadenmeldung
VB-22	Rechtsfolgen der Versäumung der Meldefrist
VB-23	Ersatz von Rettungs- und Schadenminderungskosten
VB-24	Sachverständigenverfahren und Kostentragung
```

### Batch VB-3

```
VB-25	Akontozahlung oder Vorschuss bei Großschäden
VB-26	Frist für die Wiederherstellung
VB-27	Gesamtprämie inklusive Steuer
VB-28	Prämie je Sparte gesondert ausgewiesen
VB-29	Versicherungssteuer gesondert ausgewiesen
VB-30	Zahlungsweise und Zuschlag bei unterjähriger Zahlung
VB-31	Bindefrist des Angebots
VB-32	Berücksichtigung von Vorschäden
VB-33	Auflistung der Wartungsobliegenheiten
VB-34	Geforderte Prüfnachweise für Aufzug, Heizung, Rückstauklappe
VB-35	Bündelrabatt oder Sanierungsrabatt ausgewiesen
VB-36	Regelung zur Schadenabwicklung und Ansprechpartner
```

---

## WE — WEG-Abgrenzung

### Batch WE-1

```
WE-01	Versicherungsnehmer ist die Eigentümergemeinschaft
WE-02	Systematik der Deckung: nur allgemeine Teile oder gesamte Baulichkeit
WE-03	Bodenbeläge in den Wohnungen mitversichert
WE-04	Innentüren mitversichert
WE-05	Sanitärinstallation innerhalb der Wohnungen
WE-06	Küchen und Einbaumöbel
WE-07	Malerei, Tapeten, Wandbeläge
WE-08	Verbesserungen über die Standardausführung hinaus
WE-09	Zuordnung von Fenstern und Außentüren
WE-10	Abdichtung von Balkonen, Loggien und Terrassen
WE-11	Beläge und Geländer von Balkonen
WE-12	Balkonverglasung und individuell angebrachte Markisen
```

### Batch WE-2

```
WE-13	Kellerabteile als Gebäudeteil mitversichert
WE-14	Inhalt der Kellerabteile
WE-15	Abgrenzung zur Haushaltsversicherung der Eigentümer
WE-16	Regelung bei Doppelversicherung und Vorrang
WE-17	Mietzinsentgang für vermietete Einheiten
WE-18	Regelung zu Kurzzeitvermietung
WE-19	Gewerblich genutzte Einheiten im Haus
WE-20	Auszahlung an die Gemeinschaft oder an einzelne Eigentümer
WE-21	Verfügungsberechtigung über die Entschädigungssumme
WE-22	Beschlusserfordernis für einen Versicherungswechsel
WE-23	Informationspflicht gegenüber den Wohnungseigentümern
WE-24	Tragung des Selbstbehalts innerhalb der Gemeinschaft
```

---

## Reduzierte Testliste

Für einen schnellen Vorabvergleich, falls der Volldurchlauf zu lange dauert. 12 Punkte, die erfahrungsgemäß die größten Unterschiede zwischen Angeboten aufzeigen.

```
VS-07	Unterversicherungsverzicht vorhanden
VS-13	Wohnungsinnenausbau der einzelnen Einheiten mitversichert
VS-28	Mietzinsentgang, Dauer der Leistung
LW-03	Zuleitungsrohre außerhalb des Gebäudes auf dem Grundstück
LW-08	Leckortungs- und Suchkosten, Höhe des Limits
LW-23	Altersabzug auf Rohrleitungen abhängig vom Alter
EL-01	Elementar-Sublimit pro Schadenereignis
EL-06	Rückstau aus der Kanalisation
ST-01	Windgeschwindigkeit, ab der ein Sturm vorliegt
HP-01	Pauschaldeckungssumme für Personen- und Sachschäden
VB-12	Verzicht auf den Einwand der groben Fahrlässigkeit
WE-02	Systematik der Deckung: nur allgemeine Teile oder gesamte Baulichkeit
```
