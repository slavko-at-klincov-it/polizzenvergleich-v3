# V3 development instructions

These instructions apply to the entire `polizzenvergleich-v3` repository.

## Product direction

Build a general, evidence-bound analysis engine for future building-insurance
contract packages. Do not build an LF-IMMO-specific parser. LF IMMO and WEVIG
are known development and regression fixtures, not proof that the engine
generalizes to arbitrary insurers, document layouts, or contract packages.

The current customer contract consists of up to nine input documents per
contract package and eight output views (`VS`, `FE`, `LW`, `ST`, `EL`, `HP`,
`VB`, `WE`) with 320 currently defined visible rows. Categories are views over
atomic facts; they are not the internal fact identity.

Before substantive work, read completely:

1. `docs/PRODUKTZIEL_GENERALISIERUNG_UND_ABNAHME_DE.md`;
2. the relevant current sections of
   `docs/POLIZZENANALYSE_IMPLEMENTIERUNGS_TRACKER_DE.md`;
3. `../policy-project-documentation/POLIZZENVERGLEICH_KB_INDEX.md`, then the
   relevant knowledge documents selected by its router;
4. the affected current source, callers, schemas, and tests.

If the external knowledge repository is unavailable, the product charter in
this repository remains the minimum binding context. Never infer current V3
behavior from a historical repository.

## Generalization and evidence gates

- Every production rule must represent a reusable semantic contract such as
  object, peril, effect, role, scope, condition, amount, duration, document
  role, rank, version, or replacement.
- Insurer names, physical page numbers, and exact customer phrases may be used
  in fixtures and diagnostics, but never as the sole production decision rule.
- Validate changes on known fixtures, adversarial positive/negative wording
  variants, and previously unseen holdout documents when available.
- Missing evidence means unknown or not determinable, not automatically no.
- Different objects, perils, scopes, variants, or document roles are not a
  contradiction.
- The server owns evidence, facts, values, sources, and rendered rows. The LLM
  may classify bounded ambiguity but may not invent candidates, sources,
  pages, values, or rows.
- A formal table pass, 320 generated rows, a successful model call, or success
  on LF and WEVIG is not a fachlicher correctness or 99-percent proof.
- Keep release truth, current-HEAD truth, experimental evidence, and customer
  runtime evidence explicitly separate.

## Mandatory test host

Run every test and validation command on the customer Mac Studio through the
configured Tailscale SSH alias `ssh macstudio`. This includes Jest/unit,
integration, regression, lint, formatting, build, QA, PDF-fixture, LLM,
embedding, release, installer, and Doctor runs. Do not execute these checks on
the local MacBook.

The local workspace is limited to source inspection, editing, documentation,
and Git preparation. Before remote validation, make the exact commit available
on the Mac Studio and record checkout path, commit SHA, Node/runtime version,
model IDs, and relevant run configuration. Use an isolated Mac Studio
validation worktree when the installed customer checkout must remain stable.
Change the installed checkout only for an explicitly authorized deployment or
release update.

## Change and knowledge discipline

Before implementation, identify the observed failure, root-cause class,
affected data flow and invariants, prior related experiments/rejections, one
primary success metric, regressions, and proof limits. Prefer small vertical
increments, but judge each increment by whether it advances the general engine
rather than merely repairing one known output.

Write durable outcomes back during the same task:

- implemented flow and current status -> V3 tracker/architecture docs;
- measurements and proof limits -> test/run findings;
- accepted or rejected general direction -> knowledge-base decisions;
- new unvalidated ideas -> knowledge-base intake;
- changed product target or acceptance contract -> product charter and KB
  index.

Do not use the `test-fix-loop` skill unless the user explicitly requests it.
