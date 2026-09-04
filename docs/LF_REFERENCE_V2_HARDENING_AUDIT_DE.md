# LF-Referenzvertrag V2: Härtung und Regressionsaudit

Stand: 4. September 2026

## Zweck und Beweisgrenze

Dieses Dokument hält die Release-Härtung des gerichteten
`LF_IMMO_REFERENCE_A_TO_B_V1`-Arbeitsbereichs fest. Es trennt ausdrücklich:

- den unveränderten Kundenstand V3.6.0 auf dem Mac Studio;
- den noch nicht veröffentlichten V3.7.0-Kandidaten;
- den früheren frischen 1+9-Modelllauf auf Commit `16a502186`;
- die aktuelle reine Neuauswertung seiner gespeicherten Artefakte.

Die aktuelle Neuauswertung ist kein frischer Qwen-Lauf. Sie misst nur, wie der
gehärtete Ergebnisvertrag bereits materialisierte Zeilen, Komponenten,
Quellen, Werte, Konflikte und unaufgelöste Kandidaten bewertet. Ein neuer
1+9-Lauf und der symmetrische 224-Zeilen-Nichtregressionslauf bleiben
verpflichtende Release-Gates.

## Ausgangsproblem

Der erste LF-Ergebnisvertrag konnte zu sichere Aussagen erzeugen:

1. Wenn alle sichtbaren B-Zeilen `UNGEKLÄRT` waren, wurde das pauschal als
   kontrollierter Nullfund ohne Kundenreview ausgegeben. Dabei konnten in den
   atomaren Judgements sehr wohl unaufgelöste Kandidaten vorhanden sein.
2. Komponenten aus einer `UNGEKLÄRT`-Zeile durften ein Paket vervollständigen,
   obwohl deren Wert-, Scope- oder Quellenprüfung nicht entscheidungsreif war.
3. Interne `conflictState`-Werte wurden vor der späteren Konfliktprüfung
   herausgefiltert. Ein positiver Treffer in einem anderen Dokument konnte den
   Konflikt dadurch verdecken.
4. Sobald irgendein Nicht-`TERMS`-Dokument eine Komponente traf, wurde
   `TERMS`-Evidenz pauschal verworfen. Damit konnten Ausschlüsse allein wegen
   der Dokumentrolle verschwinden, obwohl keine typisierte Vorrang- oder
   Ersetzungsbeziehung belegt war.
5. Profil-, Katalog-, Komponenten- und Ergebnisvertrag trugen trotz
   umfangreicher Semantikänderungen weiterhin dieselbe V1-Identität.

Diese Fehler lagen in
`server/utils/policyComparison/referenceResultBuilder.js`; die
Vertragsidentität lag zusätzlich in
`server/utils/policyComparison/lfReferenceProfile.js`. Die Eingabeartefakte
entstehen in `referenceRunner.js` über Worksheet, Triage, atomare
Evidenzmaterialisierung, ausgewählte Quellen, Feldmaterialisierung und
Tabellenrenderer. Der Worker verbindet sie anschließend zum Paketresultat.

## Umgesetzte Härtung

### 1. Nullfund und unaufgelöste Fundlage getrennt

Commit `57eb33903` führt einen eigenen internen Status für einen vollständig
kontrollierten Nullfund ein. `NOT_FOUND` ist nur zulässig, wenn jedes
Pflichtelement in jedem B-Dokument genau ein terminales `NOT_FOUND`-Judgement
besitzt, keine Kandidaten ausgewählt sind, keine Kandidaten unaufgelöst sind
und kein Konflikt vorliegt. Jede andere vollständig unbekannte Fundlage bleibt
`GEGENSTUECK_UNKLAR` und reviewpflichtig.

Mac-Studio-Gate: 1 Suite, 6 Tests, PASS.

### 2. Komponenten an Quellen, Werte und Scope gebunden

Commits `50ee41568`, `b12d34d99` und `4c5992ad0` erweitern den Builder um die
Artefakte:

- `effects/materialized.private.json`;
- `effects/selected-sources.private.json`;
- `result/requested-fields.private.json`;
- `result/rows.private.json`.

Eine Paketkomponente kann nur noch tragen, wenn:

- sie atomar gefunden und konfliktfrei ist;
- keine unaufgelösten Kandidaten verbleiben;
- die Tabellenzeile nicht `UNGEKLÄRT` ist;
- jede selektierte Kandidaten-ID eine servergebundene physische Seite und
  einen exakten Text für dieselbe Anforderung und Komponente besitzt;
- erforderliche Felder vollständig materialisiert und physisch gebunden sind;
- ihr Scope entscheidungsreif ist.

Ein Feld darf direkt über dieselbe Kandidaten-ID oder über denselben
physischen Klauselkontext gebunden werden. Die zweite Variante verlangt
dieselbe Seite, gültige Offsets und den exakten Feldtext innerhalb des
ausgewählten Komponentenkontexts. Dadurch bleiben legitime Fälle wie ein
Glasflächenlimit erhalten, ohne ein fremdes Limit derselben Seite zu
übernehmen.

Mac-Studio-Gates: nach jedem Commit die fokussierte Builder-Suite; zuletzt
8/8 Tests, PASS. Der Artefakt-Replay verbesserte sich während der Korrektur von
4 auf 9 und dann auf 13 vollständige, quellengebundene Gegenstücke, bevor die
Konflikthärtung hinzukam.

### 3. Konflikte, unaufgelöste Kandidaten und Dokumentrollen

Commit `aa50f38b3` wertet alle atomaren B-Judgements vor der Auswahl positiver
Komponenten aus:

- jeder interne Konflikt bleibt `WIDERSPRÜCHLICH`;
- jedes `FOUND + UNKNOWN` und jede nicht leere Liste unaufgelöster Kandidaten
  bleibt `UNGEKLÄRT`;
- positive Evidenz in einem anderen Dokument darf diese Zustände nicht
  verdecken;
- `TERMS`-Evidenz wird nicht mehr allein wegen der Dokumentrolle verworfen;
- Einschluss und Ausschluss derselben Komponente bleiben ohne belegte
  Ersetzungsbeziehung widersprüchlich.

Mac-Studio-Gate: 1 Suite, 11 Tests, PASS. Enthalten sind adversariale Fälle
für internen Konflikt plus positiven Treffer, unaufgelösten Kandidaten plus
positiven Treffer und `SUPPLEMENT INCLUDED` plus `TERMS EXCLUDED`.

### 4. Vertrag V2

Commit `273c6ce60` versioniert die geänderte Bedeutung:

```text
Profil:              LF_IMMO_REFERENCE_35_V2_CONTROLLED
Katalog:             lf-immo-reference-35-controlled-v2
Komponentenvertrag:  LF_REFERENCE_COMPONENTS_ALL_REQUIRED_V2
Negativsuche:        REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V2
Ergebnisvertrag:     LF_REFERENCE_A_TO_B_RESULT_V2
Ergebnisschema:      2
```

Auch die vier Entscheidungsregeln tragen nun V2. Ein gespeichertes V1-Resultat
wird vom aktuellen Validator ausdrücklich abgelehnt. Mac-Studio-Gate: 4
Suites, 33 Tests, PASS.

## Ergebnis der reinen Artefakt-Neuauswertung

Quelle ist der frühere frische 1+9-Lauf:

```text
Session:       c10d4c3a-4a0b-404c-b8bf-027b41879979
Run-Signatur:  fdd84a933c8df4aa58090ee8e7dc955d3bfd4d68e3cff7fd8faa01bc1c706b17
Qwen-Laufzeit: 20:05,275
```

Der alte V1-Builder meldete 16 vollständige, 15 partielle und vier
kontrollierte Nullfunde, keine unklaren B-Zeilen und 15 Kundenreviews. Der
gehärtete Builder bewertet dieselben gespeicherten Artefakte so:

```text
vollständiges Gegenstück:  12
teilweises Gegenstück:      13
kontrollierter Nullfund:     4
Referenzzeile unklar:        0
Gegenstück unklar:           6
Kundenreview erforderlich:  19
```

Unverändert vollständig bleiben:

`LF-PR-01`, `LF-VS-04`, `LF-KO-01`, `LF-ST-01`, `LF-LW-01`, `LF-LW-04`,
`LF-GL-01`, `LF-GL-02`, `LF-HP-01`, `LF-AV-01`, `LF-AV-02`, `LF-AV-03`.

Sechs B-Gegenstücke sind jetzt bewusst unklar:

- `LF-FE-02`: eingeschlossene Erweiterung und Ausschluss in verschiedenen
  Paketdokumenten; keine typisierte Ersetzung belegt;
- `LF-ST-03`: eingeschlossene Katastrophendeckung und Ausschluss in
  verschiedenen Paketdokumenten; keine typisierte Ersetzung belegt;
- `LF-LW-03`: positiver Suchkostentreffer neben einem unaufgelösten Kandidaten;
- `LF-KO-02`, `LF-KO-03`, `LF-GL-03`: zuvor partielle Zeilen mit mindestens
  einem weiterhin unaufgelösten atomaren Kandidaten.

`LF-OK-02` ist nicht mehr vollständig, sondern teilweise: Eine der beiden
Pflichtbedingungen ist nur mit `NARROW_ONLY` markiert, ohne dass der
LF-Katalog einen passenden, versionierten Scope-Vertrag besitzt. Der alte
Builder hatte dieses Scope-Problem auf Paketebene übergangen.

Diese sieben Änderungen widerlegen nicht den zugrunde liegenden PDF-Inhalt.
Sie zeigen, dass die frühere 35/35-Sollmatrix an diesen Stellen zu grob war:
Sie prüfte sichtbare Texttreffer, aber nicht vollständig Konflikt,
Ersetzungsrang, unaufgelöste Kandidaten und komponentenbezogenen Scope. Die
betroffenen Zeilen dürfen erst nach einer erneuten Einzelprüfung entweder als
V2-Sollmatrix bestätigt oder durch einen wiederverwendbaren typisierten
Vorrang-/Scope-Vertrag geschlossen werden.

## Weitere Release-Härtung außerhalb der LF-Fachlogik

- `dd3854b31`: Installer und Updater stoppen nach dem Dienststopp, wenn die
  Datenbank `QUEUED`/`RUNNING` enthält oder noch ein abgekoppelter Worker lebt.
  Mac-Studio-Installertest PASS.
- `6a752c211`: Ergebnis und XLSX-Download validieren den Resultatmodus gegen
  den persistenten Sessionmodus. Zwei Modus-Mismatch-Tests PASS.
- `bff715d16`: dauerhafte Archive tragen modusabhängig
  `Gesamtvergleich-*` oder `LF-IMMO-Referenzvergleich-*` und speichern den
  Modus in der Exportmetadatei. Zwei Suites, zwölf Tests, PASS.
- `02d33c475`: die öffentliche Workspace-API akzeptiert den dokumentierten
  Namen `analysisMode`, den bisherigen Alias `policyComparisonMode` und lehnt
  widersprüchliche Doppelangaben ab. Sieben Tests, PASS.
- `52db4ca8a`: Template-Ladefehler werden in beiden Erstellungsdialogen
  sichtbar und können erneut geladen werden. Frontend-Lint und
  Produktionsbuild mit 6.170 Modulen PASS.
- `62e4fdef6`: Kandidatenidentität V3.7.0 und versionsneutrale Beschreibung
  des symmetrischen Modus. Mac-Studio-Installertest PASS.

## Offene Punkte vor Freigabe oder Deployment

1. Einzelquellenaudit der sieben geänderten LF-Zeilen und Entscheidung, ob
   ein allgemeiner typisierter Vorrang-/Scope-Vertrag fachlich belegbar ist.
2. Vollständige Server-, Frontend-, Collector-, Installer-, Prisma- und
   Migrationsgates auf dem exakten finalen Commit.
3. Upgrade-Test auf einer Kopie der befüllten V3.6.0-Kundendatenbank;
   Bestandszahlen, Defaultmodi, alte Resultatlesbarkeit, `quick_check` und
   `foreign_key_check` müssen protokolliert werden.
4. Frischer 1+9-LF-Lauf mit Profil V2; jede Abweichung vom gehärteten Replay
   braucht einen Quellenentscheid.
5. Frischer symmetrischer 224-Zeilen-Lauf gegen die unveränderliche
   V3.6.0-Baseline. Die neun bestätigten Vorteile müssen erhalten bleiben,
   Kundenreview darf nicht über 43 steigen und kein zuvor abgeschlossener
   Punkt darf ohne Einzelbegründung zu Review wechseln.
6. Der automatische erste Workspace aus Onboarding/Home verwendet weiterhin
   den dokumentierten symmetrischen Kompatibilitätsdefault. Eine zwingende
   Modusauswahl auch für diesen allgemeinen Chat-Einstieg ist eine offene
   UX-Produktentscheidung, kein stiller fachlicher Fix.

Bis diese Gates erfüllt sind, bleibt der Kandidat **NO-GO**. `origin/main`,
der annotierte Release-Tag und die Kundeninstallation bleiben unverändert auf
dem freigegebenen V3.6.0-Stand.
