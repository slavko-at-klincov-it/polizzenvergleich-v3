# Polizzenvergleich V3.9.2

V3.9.2 schließt den einzigen fail-closed Restfall des kalten dynamischen
Batch 29, ohne bereits gültige Modellarbeit neu zu berechnen.

Der betroffene Listenpunkt besteht aus genau einem
`LIST_ITEM_WITH_CONTINUATIONS` mit mehreren fachlichen Rollen. Qwen band
Objekt, Deckungswirkung, Bedingung, Ursache, Wirkung und Fachrolle korrekt an
die ersten drei Quellblöcke. Der vierte `BODY_LINE`-Block beendete lediglich
den im dritten Block begonnenen Satz und blieb unzitiert. Die bisherige
Fortsetzungsregel konnte einen solchen Nachlauf nur bei genau einer Komponente
sicher vervollständigen.

Der V73-Laufvertrag ordnet ein fehlendes nachlaufendes Blocksuffix nun nur
dann einer Komponente zu, wenn sämtliche Grenzen eindeutig erfüllt sind:

- genau ein logisches Fortsetzungssegment und genau eine Anforderung;
- ausschließlich ein fehlendes zusammenhängendes Suffix;
- alle fehlenden Blöcke sind `BODY_LINE` und beginnen keine neue Liste;
- der letzte bereits belegte Block endet syntaktisch offen;
- der letzte Suffixblock schließt die Aussage ab;
- im Grenzblock existiert genau ein wörtlicher Komponentenanker, der am
  spätesten endet.

Innenlücken, abgeschlossene Sätze, mehrere Anforderungen, neue Listenpunkte
oder gleichrangige letzte Anker bleiben fail-closed. Die Regel enthält keine
Dokument-ID, Seite, Versichererbezeichnung oder Kundenformulierung.

Auf dem Mac Studio bestanden Syntax und Prettier sowie 395/395 Tests des
vollständigen A-Referenzvertrags. Der echte gespeicherte Batch 29 wurde ohne
Modellaufruf mit 6/6 Units und null Restfehlern revalidiert. Sein
Attempt-Artefaktbaum blieb unter SHA-256
`d9b25a76fbc0d1592ecb9be8552cf09152d6f7f49cc9547dae27f127c1e7c69b`
unverändert.

Gold-283-V2 und die binäre Kundenlogik ändern sich nicht. Der bekannte
LF-1+9-Lauf bleibt Regressionsevidenz und kein unabhängiger
Generalisierungs- oder 99-Prozent-Nachweis.

Change-Set:
`LF-V392-TRAILING-LIST-SENTENCE-PROVENANCE-20260917-001`.
