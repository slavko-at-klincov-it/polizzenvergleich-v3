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
  `CUSTOMER_CORE_5_V101_SPECIALIZED_QUALIFICATION_REPLAY` mit Ergebnisschema
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
4. gezielte FE-C02-Entscheidungs- und Auslassungsreplays;
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

## Abnahmeprotokoll

Exakter Release-Commit, Testzahlen, Laufzeit, Ergebnisverteilung,
Artefakthashes, Backup-Pfad, Doctor- und Deploymentbefund werden nach den
tatsächlichen Prüfungen in einem getrennten, append-only
Deployment-Dokumentationscommit festgehalten. Der zuvor vollständig geprüfte
und veröffentlichte Release-Tag wird dafür niemals verschoben. Bis zu diesem
Nachweis ist dieses Dokument ausdrücklich keine Deploymentfreigabe.
