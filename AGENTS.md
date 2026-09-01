# V3 development instructions

These instructions apply to the entire `polizzenvergleich-v3` repository.

## Product direction

Build a general, evidence-bound analysis engine for future building-insurance
contract packages. Do not build an LF-IMMO-specific parser. LF IMMO and WEVIG
are known development and regression fixtures, not proof that the engine
generalizes to arbitrary insurers, document layouts, or contract packages.

The current productive customer contract consists of up to nine input
documents per contract package and five output views (`VS`, `FE`, `LW`, `ST`,
`EL`) with 224 defined visible rows. `HP`, `VB`, and `WE` remain historical or
internal regression evidence and are not part of the productive customer
profile. Categories are views over atomic facts; they are not the internal
fact identity.

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
- A formal table pass, 224 generated rows, a successful model call, or success
  on LF and WEVIG is not a fachlicher correctness or 99-percent proof.
- Keep release truth, current-HEAD truth, experimental evidence, and customer
  runtime evidence explicitly separate.

## Mandatory metric-truth protocol

Before reporting any count, percentage, status total, quality metric, review
queue size, advantage total, timing, or run comparison to the user:

1. Bind the statement to the exact run artifact, commit SHA, profile version,
   and relevant artifact SHA-256.
2. Recompute the metric from row- or case-level records; do not trust a stored
   aggregate merely because it is present in the result schema.
3. Independently reconcile the recomputed groups to the declared total. Every
   reported partition must state whether its groups are mutually exclusive or
   overlapping. Every subgroup count must carry its exact grain and persisted
   member keys; without those keys it is not reportable as a verified fact.
4. Compare the recomputed metric with every stored aggregate and every
   customer-facing rendering that names the same concept. If they disagree,
   stop and report the discrepancy before using any of them as a fact.
5. Preserve the metric's exact meaning. Never rename a legacy technical
   difference counter, audit signal, search status, or internal blocker as a
   customer-review count.
6. Separate observed facts, deterministic derivations, simulations, and
   hypotheses explicitly. Simulated values must never be phrased as current
   product results.
7. Use customer-readable wording in the visible answer. Define unavoidable
   technical terms once, and do not use internal shorthand such as
   `Nulltreffer` as though it were a customer concept.

For comparison runs, the mandatory reconciliation is at least:

```text
all visible rows
= advantage A
+ advantage B
+ documentation difference
+ equivalent
+ no matching provision found on either side
+ not comparable
+ unclear
```

The customer-review count is derived only from row-level point decisions whose
outcome is `UNKLAR`. Audit-only differences must be reported separately.

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
