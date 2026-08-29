# Repository instructions for the Polizzenvergleich fork

These instructions apply to the whole repository.

## Default interaction and authorization

Questions, discussion, evaluation and planning are read-only by default. A
question is not authorization to edit code. Implement only when the user asks
for a change or the requested workflow explicitly includes implementation.

## Current implementation scope

User correction on 26 August 2026: the only current source worktree is
`polizzenvergleich-v3` on branch `codex/polizzenvergleich-v3`.
`policy-clean-implementation`, `policy-agent-orchestration`,
`anythingllm-polizzenvergleich`, earlier version worktrees, and `strategy-pocs`
are historical experiment or prior-version evidence, not current product
paths. They may be inspected read-only, but no implementation, refactor, fix,
test mutation, or release may target them unless the user explicitly names the
exact historical path.

Older dated sections in the knowledge base intentionally preserve the history
of those experiments. They are not instructions to resume implementation in
their former worktrees. Current implementation claims must be verified in
`polizzenvergleich-v3`.

- Product changes are authorized only inside the currently requested local
  optimization scope; they do not imply customer release approval.
- Keep the built-in campaign ledger and all previous proof limits active.
- Treat `Top-N 32`, temperature `0`, and vector-search mode `default` as the
  managed fire-pilot baseline, not a completeness guarantee.
- Dynamic discovery, embedding candidates, span selection and deterministic
  validation must remain separate layers.
- Do not promote an experimental candidate or formally valid model output to
  a coverage, exclusion, role, value, or A/B-advantage claim without the
  corresponding oracle gate.

Knowledge artifacts and synthetic test specifications are allowed during the
freeze. A temporary spike must be explicitly labeled, isolated and removed
after extracting its evidence; it is never current product truth.

Lead with the answer. Surface decision-relevant evidence, assumptions,
contradictions and uncertainty; do not silently omit a known side effect or a
conflict with prior evidence.

## Required context before policy-comparison work

Always read `POLIZZENVERGLEICH_KB_INDEX.md` first. Then use its knowledge
router to read the documents relevant to the question:

- `POLIZZENVERGLEICH_PROJEKTGEDAECHTNIS.md` for current status and priorities,
- `POLIZZENVERGLEICH_ARCHITEKTUR.md` for implemented data flow and invariants,
- `POLIZZENVERGLEICH_TESTS_UND_ERKENNTNISSE.md` for evidence and proof limits,
- `POLIZZENVERGLEICH_ENTSCHEIDUNGEN.md` for accepted and rejected directions,
- `POLIZZENVERGLEICH_SETUP_DE.md` for installation or customer operation,
- `POLIZZENVERGLEICH_WISSENSINTAKE.md` for new, sequential or not yet
  validated ideas, assumptions, observations, evidence hints and open
  questions,
- `POLIZZENVERGLEICH_EXPERIMENTPROTOKOLL.md` and the referenced
  `experiment-ledgers/` entry before RAG, model, prompt, context or agent-flow
  decisions.

Before substantive behavior, architecture, persistence, model-pipeline or
release changes, read project memory, decisions, and the affected architecture
and test sections in full enough to check their contracts and proof limits.

Do not call all of these files one undifferentiated "current truth". Separate
the released version, current development HEAD and newer experimental or
uncommitted evidence. Current working-tree code defines implemented behavior;
dated measurements define only the environment they measured; accepted ADRs
and invariants constrain the allowed direction. Expose unresolved conflicts
instead of silently choosing one layer.

Never call output row count, unique labels or clause-code presence `recall`
unless a complete fact-role oracle defines the denominator. They are campaign
proxies only. Keep pinned full-context runs, unpinned retrieval runs and
invalid routing/compression runs in separate causal groups.

Before a current-state claim or diagnosis, record the repository/worktree,
branch, HEAD and dirty state. For runtime, installation or customer-Mac claims,
also verify the actually running repository path, storage and env source, and
active model identifiers. Never record secret env values. Multiple local
worktrees exist and must not be assumed equivalent.

## Strategy intake before promotion

When the user provides ideas or findings sequentially, record each atomic
statement first as a stable `INT-*` entry in
`POLIZZENVERGLEICH_WISSENSINTAKE.md`. Preserve its source, type, status,
evidence limit, system impact, relations and next verification step.

Intake is never implemented truth. Do not change the quick state,
architecture, ADRs or test evidence merely because an idea was mentioned.
Promote a validated or accepted result exactly once into its canonical detail
document, retain the intake entry as provenance and link it to that canonical
outcome. Keep contradictions visible. Paraphrase customer input and never
store customer text, local paths, hashes or secrets in the intake.

## Required pause before every substantive answer

Before answering, planning or editing:

1. classify the user's intent and requested scope,
2. read the KB quick state and retrieve relevant open failures, ADRs,
   invariants, measurements and prior user corrections,
3. inspect current implementation, callers, persistence, UI or job flows and
   tests when making code claims,
4. distinguish observed fact, inference, assumption and open question,
5. check whether the proposal repeats a rejected approach or harms an adjacent
   system boundary,
6. obtain an independent specialist and critic/test perspective when the work
   is substantive and agent tooling is available,
7. answer only after contradictions are resolved or explicitly exposed.

Use the smallest useful agent set. For substantive repository analysis,
planning or implementation, normally use a read-only knowledge scout and an
independent critic/tester in addition to the primary task perspective. The main
agent owns the synthesis. Only one designated writer may edit overlapping
files. Simple factual or logistical questions are exempt.

## Change brief before substantive implementation

Before editing, establish:

- the user-visible problem and observed evidence,
- the root-cause class or explicitly open hypothesis,
- affected callers, data flow, persistence, UI, jobs, side effects and
  invariants,
- related `INV`, `FAIL` and `ADR` entries from the KB index,
- a similar rejected approach,
- scope, non-goals and the riskiest assumption,
- the metric or acceptance behavior that must improve,
- the real-structure regression and adjacent regression checks,
- what each test will explicitly not prove,
- which canonical knowledge document needs a write-back.

Do not present a plan as implementation-ready while its critical root-cause
hypothesis is untested. For a small mechanical change with no behavior or data
impact, a short statement of target, risk and verification is sufficient.

## Current critical finding

`FAIL-001` remains rejected: do not continue the full Qwen block-by-block
inventory as the normal answer path. Occurrence-centric retrieval is partly
implemented for targeted deductible questions. Use the KB quick state for the
current blocker and next acceptance target instead of repeating an older
roadmap from this file.

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

New durable knowledge must be written back in the same task when practical:

- current status, blocker or next target -> project memory,
- implemented data flow or invariant -> architecture,
- accepted, limited or rejected direction -> decisions,
- measurement, failure, root cause, regression or proof limit -> tests and
  learnings,
- installation or customer operation -> setup,
- durable communication or working-process correction -> `AGENTS.md` and, if
  it changes the knowledge routing, the KB index.

Put the detailed finding in one canonical file and link to it elsewhere. Do not
record transient speculation as fact; mark it `ASSUMPTION` or `OPEN`. If no
durable knowledge changed, do not create documentation churn.

## Response contracts

- Question/discussion: direct answer first, followed only by relevant evidence,
  assumptions and open uncertainty.
- Analysis/review: classify findings as must change, useful opportunity,
  observe only or assumption to verify, including whole-system impact.
- Plan: expose the substantive change brief, dependencies, risks, verification
  and knowledge write-back.
- Implementation: report the result, verification, proof limits, residual risk
  and durable-learning write-back.

The internal preflight does not need to be printed when its details do not help
the user.
