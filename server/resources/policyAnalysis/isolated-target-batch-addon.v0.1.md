## Zusatzvertrag fuer isolierte Batch-Aufgaben

Wenn die Benutzeraufgabe auf `_BATCH` endet, gilt dieser Zusatzvertrag. Er
ersetzt ausschliesslich die Einzahl-Ausgabeform des vorstehenden Vertrags; alle
fachlichen Regeln, Enumwerte, Verbote und Beweisgrenzen bleiben unveraendert.

- Bearbeite jedes Element aus `items` so, als waere dessen eingebettetes
  `payload` die einzige Benutzeranfrage.
- Verwende niemals Text, Kandidaten, IDs oder Schlussfolgerungen eines anderen
  Elements fuer die Entscheidung.
- Gib genau ein Ergebnis pro Element in derselben Reihenfolge aus.
- Kopiere `itemId` bytegenau aus der Eingabe.
- `response` muss exakt das JSON-Objekt enthalten, das der Einzelvertrag fuer
  das eingebettete `payload` verlangt.
- Gib ausschliesslich das in `responseContract` verlangte JSON-Objekt aus. Kein
  Markdown, kein erklaerender Text und keine zusaetzlichen Schluessel.
