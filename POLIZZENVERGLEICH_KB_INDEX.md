# Polizzenvergleich – KB-Index und Arbeitsmatrix

Stand: 31. August 2026

Dieser Index ist der kurze Einstieg vor jeder projektbezogenen Antwort,
Diagnose, Planung oder Änderung. Er ersetzt weder Quellcode und Tests noch die
Fachdokumente. Er sorgt dafür, dass die richtige Wissensquelle bewusst geladen
und Release-, Entwicklungs- und Versuchswahrheit nicht vermischt werden.

## 0. Verbindlicher aktueller Produktvertrag

Vor jeder substanziellen V3-Arbeit ist zuerst der aktuelle
[Produkt-, Generalisierungs- und Abnahmevertrag](../polizzenvergleich-v3/docs/PRODUKTZIEL_GENERALISIERUNG_UND_ABNAHME_DE.md)
zu lesen. Er legt verbindlich fest:

- Das Produkt ist eine allgemeine beleggebundene Analyse-Engine für zukünftige
  Gebäudeversicherungs-Vertragspakete und kein LF-IMMO-spezifischer Parser.
- LF IMMO und WEVIG sind bekannte Entwicklungs- und Regressionsexemplare,
  keine ausreichende Generalisierungs- oder 99-Prozent-Evidenz.
- Bis zu neun Paketdokumente werden in acht Kundenansichten mit derzeit 320
  sichtbaren Zeilen ausgewertet; Kategorien sind Views über atomare Fakten.
- Jede dokumentbezogene Korrektur muss einen allgemeinen semantischen Vertrag
  implementieren und Varianten- sowie Holdout-Gates bestehen.
- Ein 99-Prozent-Anspruch erfordert ein versioniertes fachliches Oracle und
  zuvor unbekannte Mehrversicherer-Holdouts auf Fakten-, Scope-, Werte-,
  Paket- und Provenienzebene.

Der Vertrag beschreibt das Ziel und die Abnahmebedingungen. Implementierter
Iststand bleibt durch aktuellen V3-Code und Tests zu verifizieren; datierte
Läufe beweisen nur ihre jeweilige Umgebung und ihren tatsächlich aktiven Pfad.

## 1. Zustands-Lock

Vor einer Aussage über den aktuellen Stand sind immer neu zu prüfen:

```text
Repository/Worktree -> Branch -> HEAD -> Dirty State
-> tatsächlich gestarteter Repo-Pfad -> Storage/.env -> Modell-IDs
```

Bekannte Bezugspunkte beim Anlegen dieses Index:

| Ebene | Bezug | Bedeutung |
| --- | --- | --- |
| getaggter Referenzstand | `policy-v0.3.22` / `17a556dc` | letzter getaggter technischer Stand; keine fachliche Kundenfreigabe |
| getaggter V3-Pilotstand | `v3.2.0` / `c0b00218` | sauberer Upstream-basierter Einzeldokumentpilot mit PageMap und page-aware Retrieval; fachlicher VS-Kundenlauf bleibt `CONDITIONAL GO` |
| Entwicklungsbasis | `9c6e263c` | Targeted-Selbstbehalt-Pfad nach dem Release |
| jüngste Versuchsevidenz | vollständige Original-AnythingLLM-Built-in-Kampagne mit elf Ausführungen über zehn Konfigurationen; danach Agentic-Prototyp als getrennte Arbeitsphase | [Tests, Abschnitt 17](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#17-original-anythingllm-vollständige-built-in-konfigurationskampagne); Commit- und Worktreestatus vor Verwendung neu prüfen |

Ein Dokumentheader ist keine Garantie, dass die gesamte Datei nur denselben
Stand beschreibt. Neuere datierte Evidenz darf ältere Annahmen widerlegen,
muss aber ausdrücklich als Release-, Entwicklungs- oder Versuchsaussage
gekennzeichnet werden.

## 2. Schnelllage

| Statusachse | Aktueller Stand | Kanonischer Beleg |
| --- | --- | --- |
| Produktziel | Lokal über AnythingLLM + LM Studio: Eine allgemeine, beleggebundene Analyse-Engine verarbeitet zukünftige Gebäudeversicherungs-Vertragspakete verschiedener Versicherer. LF IMMO und WEVIG sind Regressionsexemplare, nicht das Produktziel. Ein Paket wird isoliert analysiert; zwei Pakete werden erst danach verglichen. | [Produkt-, Generalisierungs- und Abnahmevertrag](../polizzenvergleich-v3/docs/PRODUKTZIEL_GENERALISIERUNG_UND_ABNAHME_DE.md), [bestätigter Ergebnisvertrag](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#21-bestätigter-ergebnisvertrag-für-den-aktuellen-kunden) |
| Aktueller V3-Beweisstand | Der stabile Release `v3.4.0` / `977ed40f` ist auf dem Mac Studio installiert; Doctor PASS. Ein frischer LF-gegen-neun-WEVIG-Lauf verarbeitet 10/10 Dokumente, 80/80 Dokument-Kategorie-Schritte und 320/320 Vergleichszeilen. Die bedingungssichere Ergebnisschicht liefert nach deterministischem Replay 0 Vorteile A/B, 4 Gleichwertigkeiten, 11 nicht vergleichbare und 305 unklare Punkte. `LW-22`, `ST-16` und `HP-26` werden wegen lokaler Bedingungen oder Ausnahmen nicht mehr unsicher als Vorteil beziehungsweise Gleichwertigkeit ausgegeben. Das beweist den technischen End-to-End-Weg für diese Fixtures, aber weder 99 Prozent Fachrichtigkeit noch beliebige Polizzen; der Lauf benötigte ungefähr vier Stunden. | [V3-Tracker, Abschnitt 69](../polizzenvergleich-v3/docs/POLIZZENANALYSE_IMPLEMENTIERUNGS_TRACKER_DE.md#69-v340-rc2-frischer-zehn-dokumente-lauf-und-bedingungssichere-entscheidung), [ADR-021](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-021-vorteile-sind-punktweise-atomar-und-regelgebunden), [Tests, Abschnitt 45](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#45-v340-frischer-zehn-dokumente-lauf-und-bedingungssichere-punktentscheidung) |
| Eingefrorene Gesamtbaseline | Der frühere LF-Lauf über alle acht Ansichten erzeugte 320/320 Zeilen, verwendete aber achtmal den alten monolithischen Promptweg. 196/320 Zeilen hatten mindestens eine formale Abweichung; Laufzeit 2:06:58. Diese Altweg-Baseline bleibt der Vergleichspunkt und ist kein Nachweis des neuen Evidenzwegs. | [vollständiger Befund](../polizzenvergleich-v3/docs/LF_ALL_CATEGORIES_27B_MONOLITHISCHER_BEFUND_DE.md) |
| Aktueller Kundenfokus | Gebäudeversicherung ist als aktueller Fach- und Lieferumfang bestätigt. „LF Immo Exklusivschutz“ ist das kundenseitige Referenzprodukt und damit der priorisierte, aber neutral zu bewertende A/B-Anwendungsfall. Genaue Kategorien, Vergleichspunktgranularität, Abnahmetiefe und die Bedeutung einer möglichen Gesamtempfehlung bleiben offen. Die kuratierte Excel ist keine Vollständigkeitsgrenze. | [Kunden- und Domänenevidenz](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#22-kunden--und-domänenevidenz-gebäudeversicherung), [Referenzprodukt](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#23-kundenseitiges-referenzprodukt-lf-immo-exklusivschutz) |
| Kundenvalidierung | Zwei bereits bekannte Glas-Detailpunkte wurden laut Partnerbericht positiv als benötigte Ergebnisart bewertet. Das bestätigt den wahrgenommenen Nutzen dieser zwei Beispiele, aber weder Gesamt-Recall noch fachliche Freigabe. | [Kunden- und Domänenevidenz](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#22-kunden--und-domänenevidenz-gebäudeversicherung) |
| Implementierung | Der ältere Selbstbehaltpfad bleibt Evidenz. Der aktuelle experimentelle Feuerpilot auf Upstream-Basis besitzt kanonische PageMap, dokumentisolierte Occurrence- plus Dinghy-Kandidaten, feste serverseitige Ergebniszeilen und seit der uncommitteten Iteration dynamische Label-Discovery sowie servereigene Evidence-Spans. | [Experimenteller Feuerpilot](./POLIZZENVERGLEICH_ARCHITEKTUR.md#14-experimenteller-feuerpilot-dynamische-discovery-und-span-id-vertrag), [Tests, Abschnitt 21](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#21-span-id-und-dynamische-discovery-iteration-im-feuerpilot) |
| Technischer Teststand | Der ungetaggte Entwicklungsstand durchlief die dokumentierten Targeted- und technischen Gate-Prüfungen; daraus entstand keine fachliche Freigabe | [Tests, Abschnitt 13](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#13-vertikale-abnahme-selbstbehalt-nach-policy-v0322) |
| Realstruktur/Laufzeit | Fundstellenenumeration und Warmstart funktionieren ohne generatives Vollinventar | [Tests, Abschnitt 14](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#14-lokale-realstruktur-abnahme-des-selbstbehalt-pfads) |
| Originalprodukt: Built-in-Kampagne | Pinning, BGE/Dinghy bei N6/N10, Temperatur 0,7/0, Default-N32 und Qwen/Gemma sind vollständig registriert. Dinghy hat in der getesteten ungepinnten Accuracy-Pipeline die höheren Breiten-Proxys, BGE ist lokal teils tiefer; kein Lauf besteht die Quellen-, Rollen-, Pflichtstruktur- und Vollständigkeits-Hard-Gates. | [Tests, Abschnitt 17](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#17-original-anythingllm-vollständige-built-in-konfigurationskampagne), [Run-Ledger](./experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json) |
| Originalprodukt: Neun-Dokumente-Paket | Zwei Default-N32-Läufe auf Kundenhardware übertrugen nur 6/9 beziehungsweise 7/9 Paketdokumente. Nur 6/18 beziehungsweise 2/29 ausgegebene Quellenfragmente waren nach reiner Unicode-/Leerraumnormalisierung wörtliche Teilstrings des Modellinputs. Globales Top-N und freie Modellzitate sind kein vollständiger Mehrdokumentvertrag. | [Tests, Abschnitt 22](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#22-neun-dokumente-paket-mit-globalem-n32), [Run-Ledger](./experiment-ledgers/multidocument-built-in-runs.v0.1.json) |
| V3.2.0-Einzeldokumentpilot | Der VS-01-bis-VS-36-Lauf auf dem Kunden-Mac bestand Installation, PageMap, seitengebundenes Retrieval und 36×8-Struktur. 20/40 Zitate waren streng wortgetreu, weitere 16 nur nach Layout-/Interpunktionsnormalisierung; mindestens sechs Zeilen waren fachlich zu sicher. Beaufsichtigter Pilot `CONDITIONAL GO`, ungeprüfte Deckungsaussage `NO GO`. | [Tests, Abschnitt 25](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#25-v320-einzeldokumentlauf-vs-01-bis-vs-36-auf-kundenhardware), [Projektgedächtnis](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#v320-einzeldokumentpilot-auf-kundenhardware) |
| V3-Workspace-Fachvorlagen | `v3.2.0` ist Rückkehrbasis, die UI-Nachfolge `v3.2.1`; die damaligen unveröffentlichten CLI-Preset-Tags `v3.3.0`/`v3.3.1` wurden zurückgezogen. Die acht Vorlagen `VS/FE/LW/ST/EL/HP/VB/WE` werden optional im normalen Workspace-Dialog gewählt. Der am 30. August 2026 neu vergebene Tag `v3.3.1` gehört zur aktuellen evidenzgebundenen Release-Linie und nicht zum verworfenen CLI-Preset. | [ADR-019](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-019-fachvorlagen-werden-beim-normalen-workspace-anlegen-ausgewählt), [ADR-020](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-020-breite-chunks-nur-als-navigation-zu-exakter-evidenz) |
| Isolierte Strategie-PoCs | Katalog-/Occurrence-Pfad und bidirektionaler Vertrags-Diff bestehen auf demselben synthetischen A/B-Korpus nun auch den vollständigen lokalen REST-Dokumentpfad: AnythingLLM-Upload, Collector-PageMap, getrennte A/B-Workspaces, Dinghy-4B/2560D, LanceDB, Vector Search, Agent-Skill, Strategiecode und Qwen. Der Partnerseed wurde mit 276/276 IDs geplant, bleibt mangels atomarer Rollen/Aliase vollständig `unresolved`; der atomare 8-Punkte-Pfad und der 16-Zeilen-Diff liefern die erwarteten Ergebnisse. UI-Auswahl, Realstruktur, Qwen 27B und Fachlichkeit bleiben `REVISE`. | [Tests, Abschnitt 18](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#18-zwei-isolierte-strategie-pocs-auf-synthetischem-ab-korpus) |
| Fachliche Korrektheit | **REVISE:** `FAIL-003` bleibt im Produktcode offen. Ein temporärer, danach entfernter Rollenbinder-Spike trennte `EUR 350`, `EUR 20.000` und die fremde Bedingung synthetisch korrekt; Übernahme und Realstrukturbeweis sind nicht entschieden. | [Tests, Abschnitt 15](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#15-nicht-übernommener-rollenbinder-spike-für-fail-003) |
| Kundenfreigabe | Gesamter Dokumentvergleich weiterhin nicht fachlich kundenreif; auch der Targeted-Selbstbehalt-Pfad bleibt bis zur Realstruktur- und Original-PDF-Abnahme **REVISE / nicht kundenfreigegeben** | [ADR-015](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-015-exhaustive-selbstbehalt-abfrage-vor-dem-vollinventar) |
| Aktuelle Arbeitsphase | Einziger aktiver Implementierungspfad ist `polizzenvergleich-v3` / Branch `codex/polizzenvergleich-v3`. `policy-clean-implementation`, `policy-agent-orchestration`, frühere Versionsworktrees und `strategy-pocs` sind ausschließlich historische Versuchsevidenz. Konzepte daraus dürfen erst nach Prüfung gegen V3 übernommen werden; dort wird nichts weiterimplementiert, sofern der Nutzer nicht den exakten historischen Pfad ausdrücklich beauftragt. | [Projektgedächtnis, Pfadkorrektur](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#aktuelle-implementierungsquelle-v3), [historischer Feuerpilot](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#historische-arbeitsphase-lokaler-experimenteller-feuerpilot) |
| Verbindlicher Testausführungsort | Sämtliche Unit-, Integrations-, Regressions-, Lint-, Format-, Build-, QA-, PDF-, LLM-, Embedding-, Release-, Installer- und Doctor-Prüfungen laufen ausschließlich auf dem Mac Studio über `ssh macstudio`. Das lokale MacBook dient nur Quellinspektion, Bearbeitung, Dokumentation und Git-Vorbereitung. Vor jedem Lauf müssen exakter Commit, Prüf-Worktree, Runtime, Modell-IDs und Konfiguration feststehen; der installierte Kunden-Checkout bleibt ohne ausdrückliches Deployment unangetastet. | [`polizzenvergleich-v3/AGENTS.md`](../polizzenvergleich-v3/AGENTS.md) |
| Nächste kontrollierte Abnahme | Anforderungen, Architekturhypothesen, Golden Cases, Realstrukturtests und Auswahlkriterien so weit schärfen, dass ein nachvollziehbarer Implementierungsplan und eine saubere Baseline entschieden werden können | [Projektgedächtnis, nächste Abnahme](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#9-nächste-kontrollierte-abnahme) |

Ein einzelnes `PASS` ist unzulässig. Mindestens Implementierung,
Datenintegrität, Laufzeit, fachliche Golden Cases, Kundenhardware und
Restrisiko werden getrennt bewertet.

## 3. Wissensrouter

| Frage | Zuerst lesen | Danach verifizieren |
| --- | --- | --- |
| Was bauen wir, wie verhindern wir LF-Überanpassung und wann wäre ein 99-Prozent-Anspruch zulässig? | [Produkt-, Generalisierungs- und Abnahmevertrag](../polizzenvergleich-v3/docs/PRODUKTZIEL_GENERALISIERUNG_UND_ABNAHME_DE.md) | aktueller V3-Code, Holdout-Oracles und neueste Run-Berichte |
| Welche neue Idee, Annahme oder offene Frage wurde genannt und wie hängt sie mit anderem Wissen zusammen? | [Wissensintake](./POLIZZENVERGLEICH_WISSENSINTAKE.md) | Quelle, Beziehungen, Hard-Gates und kanonischer Ausgang |
| Was ist das Produktziel, der aktuelle Blocker oder die nächste Abnahme? | [Projektgedächtnis](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md) | neueste Tests/Messungen und Dirty State |
| Wie läuft der tatsächlich implementierte Pfad? | [Architektur](./POLIZZENVERGLEICH_ARCHITEKTUR.md) | aktueller Quellcode, Caller, Schema und Tests |
| Was wurde schon versucht, begrenzt oder verworfen? | [Entscheidungen](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md) | zugehörige Messungen und Git-Historie |
| Was beweisen Tests und reale Läufe – und was nicht? | [Tests und Erkenntnisse](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md) | Testfixture, Umgebung, Commit und Reproduktion |
| Wie wird installiert oder am Kunden-Mac betrieben? | [Setup](./POLIZZENVERGLEICH_SETUP_DE.md) | tatsächlich verwendeter Pfad, `.env`, Storage und Modelle |
| Ist eine konkrete Implementierungsbehauptung heute wahr? | Quellcode im aktuellen Worktree | Caller, Datenfluss, Seiteneffekte und fokussierter Test |
| Welche versionierten Fachkandidaten, Pilot-TargetSpecs oder Broker-Regelverträge existieren? | [`knowledge-catalogs/README.md`](./knowledge-catalogs/README.md) | Freigabestatus, Version, Provenienz und lokale Strukturprüfung |
| Wie werden Versuche aus getrennten Chats vergleichbar und wann reichen sie für einen Implementierungsplan? | [Experimentprotokoll](./POLIZZENVERGLEICH_EXPERIMENTPROTOKOLL.md) | vollständiges Run-Manifest, nur eine geänderte Variable, Golden-Set und Hard-Gates |
| Welche Built-in-Konstellationen wurden tatsächlich getestet und welche Vergleiche sind zulässig? | [Run-Ledger](./experiment-ledgers/original-anythingllm-built-in-runs.v0.1.json) | [kanonische fachliche Auswertung](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#17-original-anythingllm-vollständige-built-in-konfigurationskampagne), Runtime-Evidenzstatus und Konfounder |

Quellcode und Tests sind die Wahrheit über den aktuellen Arbeitsbaum, nicht
automatisch über einen davon abweichenden laufenden Build oder Kunden-Mac.
Runtime-Aussagen benötigen Runtime-Evidenz.
Messungen sind die Wahrheit über genau die dokumentierte Umgebung. Akzeptierte
ADRs und Invarianten definieren die erlaubte Richtung. Chatverläufe und alte
Kommentare sind nur Hinweise, bis sie gegen diese Quellen geprüft wurden.

## 4. Invarianten- und Fehlerindex

Die IDs dienen als kurze Referenzen in Plänen und Reviews. Details bleiben in
den verlinkten Fachdokumenten.

| ID | Verbindliche Aussage | Quelle |
| --- | --- | --- |
| `INV-001` | Physische PDF-Seiten stammen nur aus der kanonischen PageMap. | [Architektur, Abschnitt 3](./POLIZZENVERGLEICH_ARCHITEKTUR.md#3-collector-und-kanonische-provenienz) |
| `INV-002` | Fehlende Evidenz ist kein Beweis für fehlenden Versicherungsschutz. | [Projektgedächtnis, Abschnitt 3](./POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md#3-ehrliche-qualitätsgrenze) |
| `INV-003` | Kein globales Top-N in einem Pfad mit dem Anspruch „alle“ oder „vollständig“. Ein überschrittenes Ambiguitätsbudget oder ungelöste Kandidaten müssen die Antwort sichtbar als unvollständig markieren oder fail-closed beenden. | [ADR-003](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-003-occurrence-zentrierter-pfad-für-konkrete-exhaustive-fragen), [ADR-015](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-015-exhaustive-selbstbehalt-abfrage-vor-dem-vollinventar) |
| `INV-004` | Der Server besitzt Fakten, Rollen, Quellen und sämtliche Ergebniszeilen. | [ADR-012](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-012-das-modell-formuliert-der-server-besitzt-die-rows) |
| `INV-005` | Analysefehler dürfen Basisindex und letzten Published Snapshot nicht löschen oder mutieren. | [ADR-001](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-001-basisindex-und-faktenanalyse-sind-getrennte-phasen), [ADR-008](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-008-atomare-staging-publikation) |
| `INV-006` | Lokale Modelloperationen sind global seriell; Dinghy bleibt bei 2.560 Dimensionen; genau ein Chatmodell ist geladen. | [ADR-009](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-009-modelloperationen-werden-global-serialisiert), [ADR-010](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-010-genau-ein-geladenes-chatmodell) |
| `INV-007` | „Besser“ ist nur punktweise innerhalb desselben atomaren Vergleichsscopes und einer versionierten Serverregel zulässig. Fehlender Beleg ist kein Nachteil; es gibt keinen Gesamtsieger. | [ADR-021](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-021-vorteile-sind-punktweise-atomar-und-regelgebunden) |

| ID | Fehler/Learning | Status | Nicht wieder als Lösung anbieten |
| --- | --- | --- | --- |
| `FAIL-001` | Blockweises generatives Vollinventar skaliert auf realen Policen nicht. | [Architektur verworfen](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-002-kein-großes-generatives-vollinventar-im-kritischen-pfad) | Batchgröße, Outputlimit, Retry oder Modellwechsel als Root-Cause-Fix |
| `FAIL-002` | Kurze Fragen wurden nach richtiger Entkopplung wieder an die Vollanalyse gekoppelt. | [Targeted für Selbstbehalt korrigiert](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#dual-mode-und-atomare-faktenpipeline) | Faktenqualität durch synchronen Vollscan erzwingen |
| `FAIL-003` | Mehrere Geldrollen im selben dichten Block wurden falsch an den Selbstbehalt gebunden. | [**OPEN / SPIKE NICHT ÜBERNOMMEN**](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#15-nicht-übernommener-rollenbinder-spike-für-fail-003) | größeres Modell oder weiter Kontext statt lokaler Rollenbindung |
| `FAIL-004` | Eine freie monolithische Built-in-Ein-Prompt-Ausgabe bleibt trotz breiterer Kontextzufuhr, T0 und Generatorwechsel fachlich und quellenbezogen instabil. | [**KAMPAGNE GESCHLOSSEN / PRODUKT REVISE**](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#17-original-anythingllm-vollständige-built-in-konfigurationskampagne), [ADR-017](./POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md#adr-017-built-in-parametersuche-schließen-mehrpass-workflow-prüfen) | weiteres freies Top-N-, Search-, Temperatur- oder Modellroulette ohne neue falsifizierbare Hypothese |
| `FAIL-005` | Ein globales Retrieval-Top-N über ein mehrteiliges Vertragsdokumentpaket garantiert weder Dokument- noch Kategorienabdeckung. Zwei N32-Läufe über neun Dokumente übertrugen nur sechs beziehungsweise sieben Dokumente; die Modellantwort durfte die fehlenden Retrievalzellen dennoch nicht als dokumentweite Abwesenheit behandeln. | [**AUF KUNDENHARDWARE BEOBACHTET / PRODUKT REVISE**](./POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md#22-neun-dokumente-paket-mit-globalem-n32) | Top-N-Erhöhung, ein breiter Einzelquery oder Volltextduplizierung als Vollständigkeitsgarantie |

## 5. Pflicht-Preflight vor einer substanziellen Antwort

1. Nutzerabsicht und Autorisierung bestimmen: Gespräch, Analyse, Plan oder
   Implementierung.
2. Zustands-Lock aus Abschnitt 1 durchführen.
3. Relevante offene Fehler, ADRs, Invarianten, Messungen und letzte
   Nutzerkorrekturen abrufen.
4. Bei Codeaussagen mindestens Implementierung, Caller, Seiteneffekte und
   einschlägige Tests prüfen.
5. Beobachtung, Schlussfolgerung, Annahme und offene Frage voneinander trennen.
6. Prüfen, ob der Vorschlag einen verworfenen Ansatz wiederholt oder ein
   Nachbarsystem verschlechtert.
7. Passende unabhängige Fach- und Gegenprüfung einholen, wenn die Frage
   substantiell ist.
8. Mit der direkten Antwort beginnen und relevante Unsicherheit sichtbar
   machen. Keine erkannte Kollision oder Nebenwirkung still weglassen.

Eine Frage oder Diskussion ist keine automatische Erlaubnis, Code zu ändern.

## 6. Pflicht-Change-Brief vor einer Implementierung

```text
Nutzerproblem / gewünschtes Ergebnis:
Beobachtete Evidenz:
Root-Cause-Klasse oder noch offene Hypothese:
Betroffene INV-/FAIL-/ADR-IDs:
Callers, Datenfluss, Persistenz, UI, Jobs und Seiteneffekte:
Ähnlicher verworfener Ansatz:
Scope und ausdrückliche Nicht-Ziele:
Riskanteste Annahme:
Messbare Verbesserung / Abbruchgrenze:
Realstrukturnahe Regression:
Was dieser Test ausdrücklich nicht beweist:
Notwendiger Wissens-Write-back:
```

Die Root-Cause-Klasse wird mindestens als Datenfindung, Semantik,
Rollenassoziation, Persistenz, Ressourcen, Routing, Darstellung, Prozess oder
Umgebung benannt.

## 7. Durable-Learning-Routing

Ein neues Learning erhält genau einen kanonischen Detailort:

| Learning | Kanonischer Ort |
| --- | --- |
| neue, noch ungeprüfte Idee, Annahme, Beobachtung, Evidenzhinweis oder offene Frage | `POLIZZENVERGLEICH_WISSENSINTAKE.md` |
| aktueller Status, Blocker oder nächstes Ziel | `POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md` |
| tatsächlich geänderter Datenfluss oder neue Invariante | `POLIZZENVERGLEICH_ARCHITEKTUR.md` |
| akzeptierte, begrenzte oder verworfene Richtung | `POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md` |
| Messung, Fehler, Root Cause, Regression und Beweisgrenze | `POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md` |
| Installation oder Kundenbetrieb | `POLIZZENVERGLEICH_SETUP_DE.md` |

Andere Dateien verlinken nur auf den kanonischen Eintrag. Unbestätigte
Interpretationen werden als `ANNAHME` oder `OFFEN` markiert. Flüchtige
Terminalausgabe oder Chatwissen gilt erst nach diesem Write-back als
dauerhaftes Projektwissen.

## 8. Intake-Lifecycle

Neue sequenzielle Nutzerinputs werden zunächst atomar als `INT-*` in
[`POLIZZENVERGLEICH_WISSENSINTAKE.md`](./POLIZZENVERGLEICH_WISSENSINTAKE.md)
erfasst. Intake ist Herkunfts- und Prüfungswissen, keine Aussage über den
implementierten Stand.

Nach Bestätigung wird das Detail genau einmal in den passenden kanonischen
Zielort aus Abschnitt 7 übernommen. Der Intake-Eintrag bleibt erhalten, erhält
den Status `PROMOTED` und verlinkt auf diesen Ausgang. Widersprüche werden über
typisierte Beziehungen sichtbar gehalten. Das aktive Strategieziel ist
[`INT-20260824-001`](./POLIZZENVERGLEICH_WISSENSINTAKE.md#int-20260824-001--bestmögliche-lokale-ki-strategie-aus-verbundenem-wissen-ableiten);
der Architekturinput zu Wortmatrix, Occurrences, Dokumentfluss und Coverage
wurde in `INT-20260824-002` bis `INT-20260824-006` atomisiert. Die bestätigten
Produktmodi, lokale Zielplattform, Gebäudeversicherungsscope und offene
„besser“-Definition stehen in `INT-20260824-007` bis `INT-20260824-011`. Der
am 24. August 2026 analysierte Claude-Verlauf wurde in
`INT-20260824-012` bis `INT-20260824-019` in Fachkatalog, Workflow,
Extraktionsvertrag, LLM-Batches, Vergleichslogik, Dokumentnavigation,
Modellannahmen und Pilotwahl zerlegt. Der nächste konkrete Einzelinput beginnt
mit `INT-20260825-020`; dort ist die bestätigte Analysephase vor einer späteren
Neuimplementierung verankert. Der nachgereichte 276-Zeilen-Partnerkatalog und
der lokale Qwen/XLSX-Kategorienversuch sind getrennt in `INT-20260825-023`
erfasst; sie erweitern den Seed, ersetzen ihn aber nicht ohne Crosswalk. Die
nachträglich vervollständigte Built-in-Kampagne und die Pflicht zum
maschinenlesbaren Run-Ledger sind in `INT-20260825-027` verankert. Das
bestätigte kundenseitige Referenzprodukt „LF Immo Exklusivschutz“ und seine
neutral priorisierte A/B-Rolle sind in `INT-20260825-031` verankert.
