# Polizzenvergleich V3.6.0 – kontrollierter Paketvergleich

Stand: 3. September 2026

Geplanter Release-Tag: `v3.6.0`

Status: `RELEASE_CANDIDATE_IN_VALIDATION`

## Zweck

V3.6.0 fasst den seit V3.5.1 entwickelten paketweiten Vergleichsunterbau in
einem neuen, unveränderlichen Release zusammen. Der Stand bleibt eine
technische Kunden- und Testbereitstellung; er ist keine allgemeine
99-Prozent-Freigabe für beliebige Gebäudeversicherungsverträge.

Enthalten sind insbesondere:

- die kundenlesbare und zeilenweise neu berechnete Reviewmetrik;
- qualifizierte beidseitige Nichtfund-Gleichheit und abgesicherte einseitige
  Richtungsentscheidungen;
- typisierte Vergleiche für ausgewählte Objekt-, Gefahren-, Bedingungs-,
  Limit-, Kosten- und Definitionsfälle;
- sourcegebundene private Audits und Replays gegen Auslassung oder
  Manipulation;
- der aktuelle Produktvertrag
  `CUSTOMER_CORE_5_V103_SPECIALIZED_QUALIFICATION_REPLAY` mit Ergebnisschema
  14;
- die quellgebundene Qualifikationswiedergabe für FE-A01 und FE-C07 sowie der
  normalisierte Worksheet-Trust-Anchor für VS-08;
- die fail-closed abgesicherte Weitergabe enger Scope-Provenienz ohne
  künstliche Scope-Zuordnung bei mehrdeutigen Überschriften;
- weiterhin fünf Kundenansichten mit zusammen 224 sichtbaren Zeilen;
- weiterhin ausschließlich Qwen 3.6 MLX mit 42.496 Token Kontext und
  Parallelität 1 im produktiven Pfad.

## Release- und Sicherheitsvertrag

Der Release darf erst veröffentlicht und installiert werden, wenn derselbe
Code-Commit auf dem Mac Studio folgende Gates bestanden hat:

1. Repository-, Format-, Syntax-, Installer- und Updaterverträge;
2. vollständige relevante Unit- und Integrationsregression;
3. Produktionsbuild des Frontends;
4. gezielte FE-A01-, FE-C02- und FE-C07-Entscheidungs-, Qualifikations- und
   Auslassungsreplays sowie die VS-08-Worksheet-Trust-Anchor-Prüfung;
5. frischer Zehn-Dokument-/224-Zeilen-Vollvergleich mit unabhängig neu
   berechneten Kundenmetriken und Vergleich gegen den Favoritenlauf
   `PAV8-03D-VS14-2D964B45-20260902-073000`;
6. unveränderlicher annotierter Tag auf demselben, nach `main`
   fast-forwardeten Commit;
7. externe Sicherung, offizieller Updater, Doctor, Datenintegrität,
   Bestandserhalt und Dienstprüfung.

Der Doctor akzeptiert V3.6.0 nur, wenn der annotierte Tag `v3.6.0` exakt auf
den installierten `HEAD` zeigt. Ein ungetaggter, leichtgewichtiger oder auf
einen anderen Commit zeigender Stand ist nicht releasekonform.

## Ausgangs- und Rückfallpunkt

Vor der Aktivierung bleibt der Kundenstand unverändert:

```text
Installation: /Users/michaelmischkot/Code/polizzenvergleich-v3
Commit: c7d3b16d400ea4d65b558ef091781da5df82d610
Beschreibung: v3.5.1-3-gc7d3b16d40
```

Unmittelbar vor dem Update wird zusätzlich zur internen Updatersicherung eine
externe Sicherung von Storage, SQLite-Datenbank, aktivem Frontend,
Konfiguration, LaunchAgents und vorhandenen Vergleichsexporten erstellt. Bei
einem roten Gate wird weder `main` veröffentlicht noch der Kundenstand
verändert.

## Aktueller Kandidatenstand

Die Release-Codebasis reicht bis `c1dc185cd`. Aktiv sind Produktprofil
`CUSTOMER_CORE_5_V103_SPECIALIZED_QUALIFICATION_REPLAY`, Vergleichsvertrag
V64 und Ergebnisschema 14. Der erste frische vollständige 224-Zeilen-Lauf auf
`35308a11a` war technisch vollständig, aber fachlich kein Release-GO. Seine
Ergebnisverteilung war 5 Vorteile A, 5 Vorteile B, 34
Dokumentationsunterschiede, 120 Gleichwertigkeiten, 10 nicht vergleichbare und
50 unklare Zeilen bei 50 Kundenreviews. Der Lauf dauerte 29 Minuten und 35
Sekunden reine Workerzeit.

Der unabhängige Diff fand vier Replay-Regressionen durch widersprüchliche
Heading-Offets (`EL-07`, `EL-11`, `EL-13`, `VS-24`) und einen bereits zuvor
vorhandenen falschen Vorteil bei `FE-A09`. Die folgenden Forward-Fixes wurden
deshalb vor jeder Veröffentlichung ergänzt:

- `7a45a4c09` richtet getrimmte Headingtexte und sourcegebundene Offsets aus;
- `df0ad7fac` dedupliziert Überschriften anhand desselben normalisierten
  Startoffsets;
- `78bce51c3` bindet numerische Gefahrenfelder an den kleinsten gültigen
  lokalen Gefahrenkontext und verhindert die Zuordnung eines HQ30-Limits zu
  Erdbeben;
- `a075bc564` bis `53dd4c2bc` verlangen für `FE-A09` einen echten
  Heizungs-, Gas- oder Feuerungsanlagen-Scope und versionieren FE-Katalog,
  Trust-Anker und Produktvertrag;
- `a7510e2db` und `c1dc185cd` führen für `EL-13` ein side-neutrales,
  sourcegebundenes Objekt-Scope-Identity-Gate ein. Unterschiedliche
  Objektumfänge werden nicht mehr als gleichwertig dargestellt; ohne
  vollständige Provenienz bleibt der Vergleich fail-closed.

Die fokussierten Mac-Studio-Gates bestanden zuletzt mit 130/130, 243/243 und
315/315 Tests. Ein frischer vollständiger 224-Zeilen-Lauf auf dem
abschließenden Dokumentationscommit steht noch aus. Bis zu dessen erfolgreicher
Abnahme bleibt der Status `RELEASE_CANDIDATE_IN_VALIDATION`; es gibt noch keine
Deploymentfreigabe.

## Abnahmeprotokoll

Exakter Release-Commit, Testzahlen, Laufzeit, Ergebnisverteilung,
Artefakthashes, Backup-Pfad, Doctor- und Deploymentbefund werden nach den
tatsächlichen Prüfungen in einem getrennten, append-only
Deployment-Dokumentationscommit festgehalten. Der zuvor vollständig geprüfte
und veröffentlichte Release-Tag wird dafür niemals verschoben. Bis zu diesem
Nachweis ist dieses Dokument ausdrücklich keine Deploymentfreigabe.
