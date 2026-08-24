# Repository instructions for the Polizzenvergleich fork

These instructions apply to the whole repository.

## Required context before policy-comparison work

Read these files before analyzing or changing the comparison pipeline:

1. `POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md`
2. `POLIZZENVERGLEICH_ARCHITEKTUR.md`
3. `POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md`
4. `POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md`
5. `POLIZZENVERGLEICH_SETUP_DE.md` when installation or customer operation is in scope.

The project-memory documents describe the current `policy-v0.3.22` truth and
supersede stale comments or older design notes when they conflict.

## Current critical finding

Do not continue the full Qwen block-by-block inventory as the normal answer
path. A real 690-block run left 577 blocks pending and extrapolated to well over
one hour. The next accepted direction is exhaustive occurrence-centric
retrieval for concrete topics using Clause FTS, deterministic structure/signals
and Dinghy, with an LLM only for genuinely ambiguous clause groups.

## Hard constraints

- Never commit customer PDFs, extracted customer text, local databases,
  vectors, logs, `.env` files or secrets.
- Do not add real customer wording to fixtures. Use anonymized synthetic
  structures and the documented Golden Cases.
- Physical PDF page numbers come only from the canonical PageMap.
- Missing evidence is not proof that a risk is not insured.
- No global Top-N is allowed in a path advertised as `all` or `complete`.
- Keep OCR/FTS/Lance basis readiness independent from optional analysis.
- Preserve the managed Dinghy identifier and 2560-dimensional Lance contract.
- Never run Qwen and Gemma concurrently on the 32-GB customer Mac.
- Keep local model operations globally serialized through the shared queue.
- Never delete or mutate the last published analysis run while staging a new
  run.
- Qwen may formulate fixed facts/rows but may not select or omit them.

## Change discipline

Before implementation, identify the real failure, its root-cause category and
the measurement that must improve. Check `POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md`
to avoid repeating a rejected approach.

During implementation run only directly affected focused tests. Afterwards run
the full release gate exactly once when a release is actually requested. Green
unit tests do not replace realistic coverage and wall-clock acceptance on the
customer hardware.

Update the project-memory documents whenever a release changes architecture,
known limitations, test evidence, model contracts or next decisions.
