const crypto = require("crypto");
const path = require("path");

const CONTRACT_ID = "LF_1PLUS9_GOLD_283_V1";
const ADJUDICATION_CONTRACT_ID = "LF_1PLUS9_GOLD_283_ADJUDICATION_76_V1";
const OUTCOMES = new Set([
  "FULL_COUNTERPART",
  "PARTIAL_COUNTERPART",
  "CONTRADICTED",
  "NO_COUNTERPART_ESTABLISHED",
]);

function goldError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : String(value))
    .digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value))
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function typedLocator(reference) {
  const extension = path.extname(String(reference?.file || "")).toLowerCase();
  const location = String(reference?.location || "").trim();
  if (!location) return { type: "MISSING", valid: false };
  if (extension === ".pdf")
    return {
      type: "PDF_PAGE",
      valid: /(?:seite|page|s\.?)\D{0,4}\d{1,3}/iu.test(location),
    };
  if (extension === ".md")
    return {
      type: "MARKDOWN_ROW",
      valid: /(?:zeile|row|zelle|cell)/iu.test(location),
    };
  if (extension === ".docx")
    return { type: "DOCX_STRUCTURE", valid: location.length > 0 };
  return { type: "UNSUPPORTED", valid: false };
}

function assertDigest(value, detail) {
  if (!/^[a-f0-9]{64}$/u.test(value || ""))
    throw goldError("LF_GOLD283_SHA_BINDING_INVALID", detail);
}

function uniqueIds(rows, field, expected, code) {
  if (!Array.isArray(rows) || rows.length !== expected)
    throw goldError(code, String(rows?.length));
  const ids = rows.map((row) => row?.[field]);
  if (ids.some((id) => !id) || new Set(ids).size !== expected)
    throw goldError(code, "NON_UNIQUE_ID");
  return ids;
}

function setEqual(left, right) {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function bindReference(referenceId, evidenceBank, sourceRowMap) {
  const reference = evidenceBank[referenceId];
  const locator = typedLocator(reference);
  if (
    !reference ||
    !String(reference.file || "").trim() ||
    !String(reference.location || "").trim() ||
    !String(reference.text || "").trim() ||
    !locator.valid ||
    !Number.isInteger(sourceRowMap[referenceId])
  )
    throw goldError("LF_GOLD283_SOURCE_BINDING_INVALID", referenceId);
  return {
    referenceId,
    file: reference.file,
    location: reference.location,
    locatorType: locator.type,
    frozenSourceRow: sourceRowMap[referenceId],
    exactText: reference.text,
    exactTextSha256: sha256(reference.text),
    sourceRecordSha256: sha256(stableStringify(reference)),
  };
}

function automaticOutcome(status, requirementId) {
  if (status === "Ja" || status === "Nein" || status === "Vertragsregel")
    return "FULL_COUNTERPART";
  if (status === "Teilweise") return "PARTIAL_COUNTERPART";
  throw goldError(
    "LF_GOLD283_AUTOMATIC_POSITIVE_STATUS_INVALID",
    `${requirementId}:${status}`
  );
}

function outcomeCounts(rows) {
  return Object.fromEntries(
    [...OUTCOMES].map((outcome) => [
      outcome,
      rows.filter((row) => row.goldDecision.outcome === outcome).length,
    ])
  );
}

function buildLfKnownFixtureGold283({
  matrix,
  validation,
  comparisons,
  astraDecisions,
  evidenceBank,
  sourceRowMap,
  technicalValidation,
  runManifest,
  packet,
  goldCandidate,
  gold30,
  adjudication,
  fileBindings,
  createdAt = new Date().toISOString(),
}) {
  const matrixIds = uniqueIds(
    matrix?.rows,
    "requirementId",
    283,
    "LF_GOLD283_MATRIX_INVALID"
  );
  uniqueIds(
    comparisons,
    "id",
    283,
    "LF_GOLD283_COMPARISON_INVALID"
  );
  uniqueIds(
    packet?.rows,
    "requirementId",
    283,
    "LF_GOLD283_PACKET_INVALID"
  );
  uniqueIds(
    goldCandidate?.rows,
    "requirementId",
    283,
    "LF_GOLD283_CANDIDATE_INVALID"
  );
  if (
    Object.keys(astraDecisions || {}).length !== 283 ||
    validation?.contractId !==
      "LF_1PLUS9_GOLD283_POSITIVE_BINDING_VALIDATION_V2" ||
    validation?.summary?.commonPositiveRows !== 254 ||
    validation?.summary?.flaggedCommonPositiveRows !== 47 ||
    validation?.summary?.validatedCommonPositiveRows !== 207 ||
    validation?.rows?.length !== 254 ||
    technicalValidation?.template_rows !== 283 ||
    technicalValidation?.all_input_sha256_unchanged !== true ||
    runManifest?.model_id !== "gpt-6-astra" ||
    runManifest?.reasoning !== "xhigh" ||
    runManifest?.blindness?.status !== "BLIND_UNTIL_FREEZE" ||
    adjudication?.contractId !== ADJUDICATION_CONTRACT_ID ||
    adjudication?.rows?.length !== 76 ||
    gold30?.contractId !== "LF_1PLUS9_GOLD_30_V1" ||
    gold30?.rows?.length !== 30
  )
    throw goldError("LF_GOLD283_INPUT_CONTRACT_INVALID");

  for (const [name, binding] of Object.entries(fileBindings || {})) {
    assertDigest(binding?.fileSha256, name);
    if (!String(binding?.file || "").trim())
      throw goldError("LF_GOLD283_FILE_BINDING_INVALID", name);
  }

  const comparisonById = new Map(comparisons.map((row) => [row.id, row]));
  const packetById = new Map(
    packet.rows.map((row) => [row.requirementId, row])
  );
  const candidateById = new Map(
    goldCandidate.rows.map((row) => [row.requirementId, row])
  );
  const gold30ById = new Map(
    gold30.rows.map((row) => [row.requirementId, row])
  );
  const validationById = new Map(
    validation.rows.map((row) => [row.requirementId, row])
  );
  const adjudicationById = new Map(
    adjudication.rows.map((row) => [row.requirementId, row])
  );
  const primaryIds = new Set(
    matrix.rows
      .filter(
        (row) => row.primaryComparison?.primaryAdjudicationCandidate === true
      )
      .map((row) => row.requirementId)
  );
  const flaggedIds = new Set(validation.summary.flaggedIds);
  const explicitIds = new Set([...primaryIds, ...flaggedIds]);
  const adjudicationIds = new Set(adjudicationById.keys());
  if (
    primaryIds.size !== 29 ||
    flaggedIds.size !== 47 ||
    explicitIds.size !== 76 ||
    !setEqual(explicitIds, adjudicationIds)
  )
    throw goldError("LF_GOLD283_ADJUDICATION_SCOPE_INVALID");

  const commonPositiveIds = new Set(validation.scope.commonPositiveIds);
  const automaticIds = new Set(
    validation.rows
      .filter((row) => row.status === "PASS")
      .map((row) => row.requirementId)
  );
  if (
    commonPositiveIds.size !== 254 ||
    automaticIds.size !== 207 ||
    [...automaticIds].some((id) => explicitIds.has(id)) ||
    [...matrixIds].some((id) => !explicitIds.has(id) && !automaticIds.has(id))
  )
    throw goldError("LF_GOLD283_AUTOMATIC_SCOPE_INVALID");

  const rows = matrix.rows
    .slice()
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
    .map((matrixRow) => {
      const requirementId = matrixRow.requirementId;
      const comparison = comparisonById.get(requirementId);
      const astraDecision = astraDecisions[requirementId];
      const packetRow = packetById.get(requirementId);
      const candidateRow = candidateById.get(requirementId);
      if (!comparison || !astraDecision || !packetRow || !candidateRow)
        throw goldError("LF_GOLD283_ROW_BINDING_INVALID", requirementId);

      const explicit = adjudicationById.get(requirementId);
      const frozenGold30Row = gold30ById.get(requirementId);
      const outcome = explicit
        ? explicit.outcome
        : frozenGold30Row?.goldDecision?.outcome ||
          automaticOutcome(comparison.Astra_F, requirementId);
      if (!OUTCOMES.has(outcome))
        throw goldError("LF_GOLD283_OUTCOME_INVALID", requirementId);
      const customerFound = outcome !== "NO_COUNTERPART_ESTABLISHED";
      const selectedReferenceIds = explicit
        ? explicit.selectedSourceRefs
        : astraDecision.refs;
      const reviewedReferenceIds = explicit
        ? explicit.reviewedSourceRefs
        : astraDecision.refs;
      if (
        !Array.isArray(selectedReferenceIds) ||
        !Array.isArray(reviewedReferenceIds) ||
        reviewedReferenceIds.length < 1 ||
        (customerFound && selectedReferenceIds.length < 1) ||
        (!customerFound && selectedReferenceIds.length !== 0) ||
        !String(
          explicit?.rationale ||
            frozenGold30Row?.goldDecision?.rationale ||
            comparison.assessment ||
            ""
        ).trim()
      )
        throw goldError("LF_GOLD283_DECISION_EVIDENCE_INVALID", requirementId);

      const sources = selectedReferenceIds.map((referenceId) =>
        bindReference(referenceId, evidenceBank, sourceRowMap)
      );
      const reviewedSources = reviewedReferenceIds.map((referenceId) =>
        bindReference(referenceId, evidenceBank, sourceRowMap)
      );
      if (
        !Array.isArray(packetRow.searchedDocuments) ||
        packetRow.searchedDocuments.length !== 9
      )
        throw goldError("LF_GOLD283_SEARCH_SCOPE_INVALID", requirementId);

      return {
        analysisRowId: matrixRow.analysisRowId,
        requirementId,
        sourceOrder: candidateRow.sourceOrder,
        category: candidateRow.category,
        subcategory: candidateRow.subcategory,
        point: candidateRow.point,
        referenceA: packetRow.referenceA,
        components: candidateRow.components,
        goldDecision: {
          reviewStatus: "SOURCE_BOUND_FINAL_FOR_KNOWN_FIXTURE",
          reviewMethod: explicit
            ? "BOUNDED_76_SOURCE_ADJUDICATION"
            : "VALIDATED_207_COMMON_POSITIVE_ACCEPTANCE",
          decisionProvenance: explicit
            ? "VERSIONED_76_SOURCE_ADJUDICATION"
            : frozenGold30Row
              ? "FROZEN_GOLD30_V1_CARRIED_FORWARD"
              : "ASTRA_FABLE_COMMON_POSITIVE_WITH_VALIDATED_BINDINGS",
          outcome,
          customerFound,
          rationale: String(
            explicit?.rationale ||
              frozenGold30Row?.goldDecision?.rationale ||
              comparison.assessment
          ).trim(),
          sources,
          reviewedSources,
          absenceSearch: customerFound
            ? null
            : {
                certifiedForKnownFixture: true,
                documentsSearched: packetRow.searchedDocuments,
                reviewedAndRejectedSourceRefs: reviewedReferenceIds,
              },
        },
        evidenceHistory: {
          fableFound: comparison.Fable_E,
          fableDetail: comparison.Fable_F,
          astraFound: comparison.Astra_E,
          astraDetail: comparison.Astra_F,
          astraSourceRefs: astraDecision.refs,
          validationStatus:
            validationById.get(requirementId)?.status || "PRIMARY_REVIEW",
        },
      };
    });

  if (
    rows.length !== 283 ||
    rows.some(
      (row) =>
        !row.goldDecision ||
        !OUTCOMES.has(row.goldDecision.outcome) ||
        row.goldDecision.reviewStatus !==
          "SOURCE_BOUND_FINAL_FOR_KNOWN_FIXTURE"
    )
  )
    throw goldError("LF_GOLD283_FINAL_CARDINALITY_INVALID");

  const rowsById = new Map(rows.map((row) => [row.requirementId, row]));
  const gold30Differences = gold30.rows
    .map((row) => {
      const current = rowsById.get(row.requirementId)?.goldDecision;
      const previous = row.goldDecision;
      if (
        current?.customerFound === previous?.customerFound &&
        current?.outcome === previous?.outcome
      )
        return null;
      return {
        requirementId: row.requirementId,
        gold30Outcome: previous?.outcome,
        gold283Outcome: current?.outcome,
        gold30CustomerFound: previous?.customerFound,
        gold283CustomerFound: current?.customerFound,
      };
    })
    .filter(Boolean);

  const payload = {
    schemaVersion: 1,
    contractId: CONTRACT_ID,
    status: "FROZEN_SOURCE_BOUND_GOLD_FOR_KNOWN_LF_1PLUS9_283_ROWS",
    goldAuthority: true,
    scope: "KNOWN_LF_1PLUS9_283_ONLY",
    qaOnly: true,
    productionRule: false,
    releaseApproval: false,
    generalizationProof: false,
    createdAt,
    bindings: fileBindings,
    reviewerRun: {
      runId: runManifest.run_id,
      modelId: runManifest.model_id,
      reasoning: runManifest.reasoning,
      startUtc: runManifest.start_utc,
      endUtc: runManifest.end_utc,
      host: runManifest.host,
      blindUntilFreeze: runManifest.blindness.status === "BLIND_UNTIL_FREEZE",
    },
    sourceDocuments: packet.rows[0].searchedDocuments,
    adjudicationScope: {
      primaryRows: [...primaryIds].sort(),
      flaggedCommonPositiveRows: [...flaggedIds].sort(),
      explicitlyAdjudicatedRows: [...explicitIds].sort(),
      automaticallyAcceptedRows: [...automaticIds].sort(),
      scopeExpansionBeyond76: false,
    },
    rejectedUnverifiableReferences:
      adjudication.technicallyUnverifiableRejectedRefs || [],
    summary: {
      rows: rows.length,
      customerFound: rows.filter((row) => row.goldDecision.customerFound).length,
      customerNotFound: rows.filter(
        (row) => !row.goldDecision.customerFound
      ).length,
      outcomeCounts: outcomeCounts(rows),
      sourceBoundFoundRows: rows.filter(
        (row) =>
          row.goldDecision.customerFound && row.goldDecision.sources.length > 0
      ).length,
      knownFixtureAbsenceCertified: rows.filter(
        (row) =>
          row.goldDecision.absenceSearch?.certifiedForKnownFixture === true
      ).length,
      explicitAdjudications: explicitIds.size,
      validatedAutomaticAcceptances: automaticIds.size,
      gold30RowsCompared: gold30.rows.length,
      gold30Differences: gold30Differences.length,
    },
    gold30Comparison: {
      frozenGold30FileSha256: fileBindings.gold30.fileSha256,
      artifactUnchanged: true,
      differencesAreVersionedCorrectionsFromBounded76Review: true,
      differences: gold30Differences,
    },
    rows,
    limitation:
      "This Gold is a source-bound regression oracle only for the exact SHA-bound LF 1+9 fixture. It is not a fixed production row template, deployment approval, arbitrary-policy generalization proof, or 99-percent claim.",
  };
  return { ...payload, goldSha256: sha256(stableStringify(payload)) };
}

module.exports = {
  ADJUDICATION_CONTRACT_ID,
  CONTRACT_ID,
  OUTCOMES,
  buildLfKnownFixtureGold283,
  sha256,
  stableStringify,
  typedLocator,
};
