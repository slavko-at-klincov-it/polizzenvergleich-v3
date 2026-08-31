# Audit des Qwen-3.6-Fünf-Kategorien-Vollvergleichs

Stand: 31. August 2026  
Bewertung: technisch erfolgreich, fachlich **nicht freigabereif**

## 1. Kurzurteil

Der aktuelle Entwicklungsstand hat den vollständigen LF-gegen-WEVIG-
Vergleich auf dem Mac Studio reproduzierbar abgeschlossen. Der Lauf ist mit
27:01,550 Stunden deutlich schneller als der historische Qwen-3.8-Lauf. Auf
den fünf heute gemeinsamen Kategorien beträgt die aus den persistenten
Dokumentartefakten abgeleitete Zeitverbesserung 5,07x beziehungsweise
80,29 Prozent weniger Wandzeit.

Die neue Entscheidungsschicht ist wesentlich sicherer: Sie gibt in 224
Punkten weder Polizze A noch Polizze B einen Vorteil, solange Wirkung, Wert,
Scope oder Rang nicht ausreichend belegt sind. Alle fünf Gleichwertigkeiten
und alle elf Nichtvergleichbarkeiten waren in der unabhängigen Stichprobe
vertretbar.

Der kontrollierte Negativsuchpfad ist dagegen noch nicht fachlich vollständig.
Mehrere Zeilen melden einen vollständigen Nulltreffer, obwohl im geprüften
Paket eine exakt relevante Klausel vorhanden ist. Zusätzlich wurde bei
`LW-08` ein Ausschluss über eine neue Überschrift hinweg auf versicherte
Suchkosten übertragen. Deshalb ist die Excel fachlich als Auditartefakt
brauchbar, aber noch nicht als ungeprüftes Kundenergebnis freizugeben.

## 2. Identität und Ausführungsumgebung

| Merkmal | Wert |
| --- | --- |
| Implementierungscommit | `343a665e3ffb3462fdcef5852a28ccddb64ffd1f` |
| isolierter Mac-Studio-Checkout | `/Users/michaelmischkot/Library/Application Support/at.klincov.polizzenvergleich-v3/AuditRuns/QWEN36-FULL-20260831-7ab999c6/repo` |
| installierter Kundenstand | unverändert auf `977ed40f` |
| Modell | `qwen/qwen3.6-35b-a3b` |
| Laufzeitansicht | MLX 4 Bit, text-only |
| geladener Kontext | exakt 42.496 Token |
| Parallelität | 1 |
| zusätzlich geladenes Embeddingmodell | keines |
| Session | `6c3a1a8c-9e58-4965-8720-0545aabbf889` |
| Run-Signatur | `eee75c48f18cd2726a32b582…` |
| Produktprofil | `CUSTOMER_CORE_5_V2` |
| Kategorien | VS, FE, LW, ST, EL |
| Dokumente / Seiten | 10 / 108, davon 108 mit Text |
| Dokument-Kategorie-Schritte | 50/50 |
| Resume-Schritte | 0 |
| Gesamtlaufzeit | 1.621,550 s = 27:01,550 |

Die zehn Eingabedateien wurden als physische Kopien in die isolierte
Auditinstanz übernommen. Ihre SHA-256-Identitäten stimmen mit den Dateien in
`/Users/michaelmischkot/Downloads/Projekt Lokale KI/TestDateien` überein. Die
produktive Datenbank und der installierte Kunden-Checkout wurden nicht
verändert.

## 3. Ergebnisartefakte

Der neue unveränderlich benannte Kundenexport liegt unter:

```text
/Users/michaelmischkot/Downloads/Projekt Lokale KI/Vergleiche/Gesamtvergleich-6c3a1a8c-9e58-4965-8720-0545aabbf889-eee75c48f18c.xlsx
```

SHA-256 des XLSX:  
`b8d35c4171221009311a62694c8ea9703b827cfaae79442bef57cea48330f999`

Der Export besitzt genau ein Blatt `Gesamtvergleich`, 17 Spalten, 224
Datenzeilen, Filter `A1:Q225`, Zoom 80 Prozent, Aptos Narrow 12 und keine
Formeln oder Excel-Fehlerwerte. Alle 224 Werte in den fachlichen Spalten A bis
P stimmen mit `comparison.private.json` überein. Die Quick-Look-Sichtprüfung
zeigte keine Zell- oder Spaltenüberlappung.

Alle 416 im Ergebnis ausgegebenen PDF-Zitate wurden programmatisch gegen die
behauptete physische Seite des zugehörigen privaten Seitenartefakts geprüft:
416/416 sind nach Unicode- und Whitespace-Normalisierung exakte Teilstrings
der behaupteten Seite. Das belegt die Provenienz der **ausgegebenen** Quellen,
nicht die Vollständigkeit der gefundenen Quellen.

## 4. Ergebnisverteilung

| Entscheidung | Zeilen |
| --- | ---: |
| Vorteil A | 0 |
| Vorteil B | 0 |
| Dokumentationsunterschied | 42 |
| Gleichwertig | 5 |
| kein dokumentierter Vorteil | 105 |
| nicht vergleichbar | 11 |
| unklar | 61 |

104 Zeilen tragen einen Reviewhinweis; die Punktentscheidung verlangt in 61
Zeilen ausdrücklich eine Prüfung. Die fünf Gleichwertigkeiten `FE-A04`,
`LW-22`, `ST-04`, `ST-06` und `ST-26` waren in der unabhängigen Prüfung
vertretbar. Die elf Nichtvergleichbarkeiten sind konservativ durch
Vorschlagsstatus, Bedingtheit oder abweichenden Scope gesperrt.

## 5. Routing und tatsächliche Reihenfolge

Der Lauf verwendete folgenden Pfad:

1. Privater A/B-Upload ohne Workspace-Indexierung.
2. SHA-256-Identität, Rolle, Geltungsstatus und Paketposition werden in der
   Vergleichssession gespeichert.
3. Der Queue-Vertrag bindet Release, Modell, exakt 42.496 Token, Profil und
   Dokumentliste in die Run-Signatur.
4. Vor jeder PDF-Verarbeitung prüft der Runner über die LM-Studio-API, dass
   genau das konfigurierte Modell mit dem exakten Kontext geladen ist.
5. Der Worker verarbeitet zunächst Paket A, danach Paket B in gespeicherter
   Dokumentreihenfolge.
6. Jedes PDF wird einmal in eine kanonische Textschicht mit physischer
   Seitenabbildung extrahiert. OCR ist in diesem Pfad nicht aktiv.
7. Pro Dokument laufen VS, FE, LW, ST und EL sequenziell. Je Ziel folgen
   kontrollierte Occurrence-Suche, Kandidatentriage, Wirkungsbewertung,
   serverseitige Feldbindung und deterministische Materialisierung.
8. Erst nach allen 50 Dokument-Kategorie-Schritten erfolgt der paketweite,
   serverseitige Rollup. Die Punktentscheidung und das XLSX werden ohne einen
   zusätzlichen freien Abschlussvergleich des LLM erzeugt.
9. Vor dem Status `COMPLETED` wird das XLSX atomar in den konfigurierten
   Vergleichsordner archiviert.

Diese Reihenfolge ist grundsätzlich legitim: Dokumente bleiben bis zum
Rollup isoliert, Quellen und Ranginformationen werden nicht vorzeitig
vermischt, und die finale Gewinnerlogik ist deterministisch. Die sortierte
Excel-Reihenfolge K/S/V ist bewusst eine Präsentationsreihenfolge und nicht
die interne Ausführungsreihenfolge.

Zwei Grenzen sind relevant:

- Die Oberfläche setzt bei automatischer Mehrfachauswahl derzeit nur das
  erste Dokument als Hauptpolizze; weitere Dateien erhalten ohne manuelle
  Korrektur nicht zuverlässig die Rollen `TERMS` und den Status
  `FRAMEWORK_TERMS`. Für diesen Auditlauf wurden die bekannten Rollen und
  Stati ausdrücklich korrekt gesetzt. Der UI-Standard ist vor unbekannten
  Kundenpaketen zu korrigieren.
- „Vollständig“ bedeutet technisch derzeit nur: alle deklarierten Aliase und
  Kandidaten des Suchplans wurden abgearbeitet. Es bedeutet nicht, dass alle
  semantisch äquivalenten Formulierungen im Dokument geprüft wurden.

## 6. Fachliche Gegenprüfung der Pflichtzeilen

| Zeile | Auditbefund |
| --- | --- |
| `VS-16` | PASS: B findet `überdachte Abstellplätze` in GenVerbund S. 10; `UNKLAR` ist konservativ. |
| `VS-02` | FEHLER: EABS S. 6 nennt ausdrücklich 40 Prozent; das Ergebnis sagt dennoch, das Restwertverhältnis sei nicht feststellbar. GenVerbund S. 7 nennt zusätzlich 20 Prozent. Rang und Bindung beider Werte bleiben offen. |
| `VS-21` | PASS mit offenem Rang: Quellen und Betrag sind belegt, B mischt Vorschlag und Bedingungen; `UNKLAR` ist sicher. |
| `VS-25` | PASS mit offenem Rang: unterschiedliche Bezugsgrößen und mehrere B-Werte bleiben sichtbar; `UNKLAR` ist sicher. |
| `VS-36` | FEHLER: ABS S. 3 nennt die Versicherungssumme als Entschädigungsgrenze. Der behauptete Dokumentationsunterschied beruht damit auf einem falschen Nulltreffer. |
| `FE-A02` | Im Ergebnis kein unsicherer Vorteil. AFB S. 2 enthält jedoch eine stärkere unmittelbare Nutzfeuer-Ausschlussstelle als den ausgegebenen Ausschnitt; Kundentext sprachlich zu verbessern. |
| `FE-A06` | PASS: der B-Beleg betrifft nur indirekten Blitzschaden an Erdkabeln; `UNKLAR` verhindert eine falsche Gleichsetzung. |
| `LW-06` | PASS: beide Frostbelege gefunden; der Vorschlagsstatus von B führt korrekt zu `NICHT_VERGLEICHBAR`. |
| `LW-08` | FEHLER: AWB S. 2 überschreibt mit `Versicherte Kosten ... Suchkosten` den vorherigen Ausschlusskontext. Das System materialisiert diesen Beleg trotzdem als ausgeschlossen. Heading-/Scope-Grenze wurde nicht zurückgesetzt; `UNKLAR` verhindert immerhin einen Gewinner. |
| `LW-21` | PASS: kein wörtlicher Schimmelbeleg; die alte unbelegte Gleichsetzung Schimmel = Vermorschung wird vermieden. |
| `LW-31` | FEHLER/OFFEN: die allgemeine Entschädigungsgrenze aus ABS S. 3 fehlt; ihre LW-spezifische Anwendbarkeit muss geprüft werden. Der Dokumentationsunterschied ist nicht nachgewiesen. |
| `ST-11` | PASS: A enthält nur einen engen Ausschluss-/Reparaturkontext; kein Vorteil wird konstruiert. |
| `EL-07` | PASS: Erdbeben wird auf beiden Seiten gefunden; Vorschlagsstatus und Bedingungen führen sicher zu `NICHT_VERGLEICHBAR`. |

## 7. Bestätigte Recall-Fehler außerhalb der Pflichtzeilen

Unabhängige Agenten fanden außerdem folgende exakte Gegenstellen zu
ausgegebenen oder rollupwirksamen Nulltreffern:

- `FE-A10` A: LF S. 8 und 23, Schäden durch unbekannte Fahrzeuge;
- `FE-A13` B: AFB S. 2, Luftfahrzeugabsturz einschließlich Teilen und Ladung;
- `LW-13` A: LF S. 12 und 14, Ausschluss bei ordnungsgemäßer
  Sprinklerbetätigung;
- `LW-18` B: GenVerbund S. 13, `LW06 Kanalrückstau` im Hochwasser-/
  Überschwemmungsscope;
- `ST-01` B: AStB S. 2, Sturmdefinition über 60 km/h;
- `ST-02` B: AStB S. 2, ausdrückliche meteorologische Stelle;
- `ST-08` B: GenVerbund S. 12, Schneeabrutsch und Dachlawine;
- `ST-23` B: AStB S. 2, durch die versicherte Gefahr geworfene Gegenstände;
- `ST-25` B: GenVerbund S. 12, Sicherung/Entsorgung von Bäumen bis EUR 3.000;
- `FE-C02` A und B: LF S. 3 sowie EABS S. 2/4, Photovoltaikanlagen;
- `FE-D03` B: AFB S. 2, Lösch-, Niederreiß- und Aufräumschäden;
- `VS-32` A: LF S. 6, Zwischenlagerung bis sechs Monate;
- `EL-12` A: LF S. 10, HQ30-Zonenbegrenzung.

Damit ist nicht nur ein einzelner Alias falsch. Betroffen sind mindestens vier
allgemeine Fehlerklassen: zu enge Synonym-/Konzeptpläne, nicht übernommene
allgemeine Vertragsgrenzen, fehlende Struktur-/Heading-Resets und ungenügende
Bindung mehrerer Werte aus Dokumenten unterschiedlichen Rangs.

## 8. Vergleich mit früheren Ergebnissen

Der historische persistente Qwen-3.8-Lauf benötigte für acht Kategorien
14.777,335 Sekunden (4:06:17,335). Der neue Gesamtlauf benötigt 1.621,550
Sekunden. Der rohe Faktor 9,11 ist wegen der Reduktion von acht auf fünf
Kategorien nicht als reiner Modellvergleich zulässig.

Für dieselben zehn Dokumente, dieselbe Reihenfolge und die gemeinsamen fünf
Kategorien ergibt die Summe der persistenten Dokumentartefakt-Zeitfenster:

| Lauf | VS/FE/LW/ST/EL |
| --- | ---: |
| historischer Qwen-3.8-Lauf | 8.206,345 s = 2:16:46,345 |
| aktueller Qwen-3.6-Lauf | 1.617,626 s = 26:57,626 |
| Differenz | 6.588,719 s weniger |
| Faktor | 5,073x |
| Zeitreduktion | 80,29 % |

Diese Messung ist ein Artefaktvergleich, kein isolierter Modellbenchmark:
Zwischen den Läufen änderten sich zusätzlich Kataloge, Profil und
Verarbeitungslogik. Sie bestätigt aber die Größenordnung des früheren
kontrollierten VS-Vergleichs mit 5,02x.

Die manuell kuratierte ältere `Gesamtvergleich.xlsx` enthielt 61 Vorteile für
A und 36 für B. Bei 78 dieser 97 Vorteile war mindestens eine Seite nicht
`BELEGT`; 58 stellten `BELEGT` gegen `UNGEKLÄRT`. Der neue Lauf reduziert
diese riskante Ableitung auf null Vorteile. Das ist eine klare Verbesserung
der Entscheidungssicherheit, ersetzt aber nicht den Recall: 20 der 42 neuen
Dokumentationsunterschiede und 42 der 105 beidseitigen Nullbefunde hatten im
historischen Ergebnis mindestens auf einer heute fehlenden Seite Evidenz.
Die alten Ergebnisse sind kein Oracle, die oben direkt geprüften PDF-Stellen
beweisen den aktuellen Fehler jedoch unabhängig.

## 9. Freigabeentscheidung und nächste Reihenfolge

```text
PASS  End-to-End-Ausführung, Modell-/Kontextvertrag und Persistenz
PASS  Einblatt-XLSX, Zielordner, Inhalt-zu-JSON-Parität und Zitatprovenienz
PASS  konservative Gewinnerlogik: 0 unbelegte Vorteile
FAIL  fachliche Vollständigkeit kontrollierter Nulltreffer
FAIL  Heading-/Scope-Reset bei LW-08
OPEN  automatische Rollen-/Statuszuordnung unbekannter Mehrdokumentpakete
NO GO ungeprüfte Kundenfreigabe dieses Ergebnisses
```

Die richtige nächste Reihenfolge ist:

1. Die bestätigten Gegenstellen als allgemeine positive und negative
   Katalog-/Strukturregressionen aufnehmen, nicht als PDF-Seiten-Sonderregeln.
2. Heading- und Klauselgrenzen so modellieren, dass Wirkungsscope an einer
   neuen semantischen Überschrift endet oder neu bewertet wird.
3. Allgemeine Vertragsgrenzen paketweit als mögliche spartenübergreifende
   Fakten routen und ihre konkrete Anwendbarkeit separat entscheiden.
4. Rollen-/Status-UX für Mehrdokumentpakete vor dem Start verbindlich machen.
5. Danach denselben Vollvergleich frisch auf dem Mac Studio wiederholen und
   erst nach einem erneuten unabhängigen Quellen-/Nulltrefferaudit freigeben.

Dieser Lauf beweist weder beliebige Polizzen, unbekannte Versicherer, OCR-
Vollständigkeit noch das 99-Prozent-Ziel.
