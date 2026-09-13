#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function fail(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
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

function readJson(file) {
  const bytes = fs.readFileSync(file);
  return { bytes, sha256: sha256(bytes), value: JSON.parse(bytes.toString()) };
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("de-AT")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function typedLocator(reference) {
  const extension = path.extname(String(reference?.file || "")).toLowerCase();
  const location = String(reference?.location || "").trim();
  if (!location) return { type: "MISSING", valid: false };
  if (extension === ".pdf")
    return {
      type: "PDF_PAGE",
      valid: /(?:seite|page|s\.?)[^0-9]{0,4}[0-9]{1,3}/iu.test(location),
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

function atomicWritePrivate(file, value) {
  if (fs.existsSync(file)) fail("OUTPUT_ALREADY_EXISTS", file);
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) fail("ARGUMENT_MISSING", name);
  return path.resolve(process.argv[index + 1]);
}

function main() {
  const files = {
    matrix: getArg("matrix"),
    rowComparison: getArg("row-comparison"),
    decisions: getArg("decisions"),
    evidenceBank: getArg("evidence-bank"),
    sourceRowMap: getArg("source-row-map"),
    technicalValidation: getArg("technical-validation"),
    packet: getArg("packet"),
    goldCandidate: getArg("gold-candidate"),
  };
  const output = getArg("output");
  const inputs = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [key, { file, ...readJson(file) }])
  );
  const matrix = inputs.matrix.value;
  const comparisons = inputs.rowComparison.value;
  const decisions = inputs.decisions.value;
  const evidenceBank = inputs.evidenceBank.value;
  const sourceRowMap = inputs.sourceRowMap.value;
  const technicalValidation = inputs.technicalValidation.value;
  const packet = inputs.packet.value;
  const goldCandidate = inputs.goldCandidate.value;

  if (
    !Array.isArray(matrix.rows) ||
    matrix.rows.length !== 283 ||
    !Array.isArray(comparisons) ||
    comparisons.length !== 283 ||
    !decisions ||
    Object.keys(decisions).length !== 283 ||
    !sourceRowMap ||
    technicalValidation?.template_rows !== 283 ||
    technicalValidation?.all_input_sha256_unchanged !== true ||
    technicalValidation?.unique_row_ids !== true ||
    technicalValidation?.complete_source_blocks_reconstructed !== 276 ||
    !Array.isArray(packet.rows) ||
    packet.rows.length !== 283 ||
    !Array.isArray(goldCandidate.rows) ||
    goldCandidate.rows.length !== 283
  )
    fail("LF_GOLD283_INPUT_CARDINALITY_INVALID");

  const comparisonById = new Map(comparisons.map((row) => [row.id, row]));
  const packetById = new Map(packet.rows.map((row) => [row.requirementId, row]));
  const candidateById = new Map(
    goldCandidate.rows.map((row) => [row.requirementId, row])
  );
  const groups = packet.sourceCatalog?.evidenceGroups;
  if (!Array.isArray(groups) || groups.length < 1)
    fail("LF_GOLD283_EVIDENCE_GROUPS_INVALID");
  const groupById = new Map();
  const spanById = new Map();
  for (const group of groups) {
    if (
      !group?.evidenceGroupId ||
      groupById.has(group.evidenceGroupId) ||
      sha256(group.exactText || "") !== group.exactTextSha256 ||
      !Array.isArray(group.sourceSpans) ||
      group.sourceSpans.length < 1
    )
      fail("LF_GOLD283_EVIDENCE_GROUP_INVALID", group?.evidenceGroupId);
    groupById.set(group.evidenceGroupId, group);
    for (const span of group.sourceSpans) {
      if (
        !span?.evidenceSpanId ||
        (spanById.has(span.evidenceSpanId) &&
          stableStringify(spanById.get(span.evidenceSpanId)) !==
            stableStringify(span)) ||
        sha256(span.exactText || "") !== span.exactTextSha256 ||
        !Number.isInteger(span.physicalPageNumber) ||
        span.physicalPageNumber < 1
      )
        fail("LF_GOLD283_EVIDENCE_SPAN_INVALID", span?.evidenceSpanId);
      spanById.set(span.evidenceSpanId, span);
    }
  }

  const primaryIds = matrix.rows
    .filter((row) => row.primaryComparison?.primaryAdjudicationCandidate === true)
    .map((row) => row.requirementId);
  const commonPositiveIds = matrix.rows
    .filter((row) => {
      const primary = row.primaryComparison || {};
      const comparison = comparisonById.get(row.requirementId);
      return (
        primary.fableAstraBinaryAgreement === true &&
        primary.fableAstraCommonNull !== true &&
        comparison?.Astra_E === "Ja" &&
        comparison?.Fable_E !== "Nein"
      );
    })
    .map((row) => row.requirementId);
  if (primaryIds.length !== 29)
    fail("LF_GOLD283_PRIMARY_SCOPE_INVALID", String(primaryIds.length));
  if (commonPositiveIds.length !== 254)
    fail(
      "LF_GOLD283_COMMON_POSITIVE_SCOPE_INVALID",
      String(commonPositiveIds.length)
    );

  const validationRows = [];
  for (const requirementId of commonPositiveIds) {
    const comparison = comparisonById.get(requirementId);
    const decision = decisions[requirementId];
    const packetRow = packetById.get(requirementId);
    const candidateRow = candidateById.get(requirementId);
    const reasons = [];
    if (!comparison || !decision || !packetRow || !candidateRow) {
      reasons.push("ROW_BINDING_MISSING");
      validationRows.push({ requirementId, status: "FLAGGED", reasons });
      continue;
    }
    if (!Array.isArray(decision.refs) || decision.refs.length < 1)
      reasons.push("ASTRA_SOURCE_REFERENCE_MISSING");

    const referenceResults = [];
    for (const referenceId of decision.refs || []) {
      const reference = evidenceBank[referenceId];
      const referenceReasons = [];
      if (
        !reference ||
        !String(reference.file || "").trim() ||
        !String(reference.location || "").trim() ||
        !String(reference.text || "").trim()
      ) {
        referenceReasons.push("REFERENCE_RECORD_INVALID");
      }
      const locator = typedLocator(reference);
      if (!locator.valid) referenceReasons.push("SOURCE_LOCATOR_INVALID");
      if (!Number.isInteger(sourceRowMap[referenceId]))
        referenceReasons.push("FROZEN_SOURCE_ROW_BINDING_INVALID");
      referenceResults.push({
        referenceId,
        referenceRecordSha256: reference
          ? sha256(stableStringify(reference))
          : null,
        sourceType: reference
          ? path.extname(String(reference.file)).toLowerCase()
          : null,
        locatorType: locator.type,
        frozenSourceRow: sourceRowMap[referenceId] ?? null,
        status: referenceReasons.length === 0 ? "PASS" : "FLAGGED",
        reasons: referenceReasons,
      });
    }
    if (referenceResults.some(({ status }) => status !== "PASS"))
      reasons.push("SOURCE_OR_PAGE_BINDING_FLAGGED");

    if (
      comparison.classification !== "Kernübereinstimmung" ||
      (comparison.finding_ids || []).length > 0 ||
      !String(comparison.source_binding || "").startsWith("Beide")
    )
      reasons.push("CORE_OR_SCOPE_REVIEW_FLAGGED");

    const packetComponents = new Map(
      (packetRow.components || []).map((component) => [
        component.componentId,
        component,
      ])
    );
    const referenceASpanIds = new Set(
      (packetRow.referenceA?.sourceSpans || []).map(({ spanId }) => spanId)
    );
    const componentResults = [];
    for (const component of candidateRow.components || []) {
      const prepared = packetComponents.get(component.componentId);
      const componentReasons = [];
      if (
        !prepared ||
        prepared.factRole !== component.factRole ||
        normalize(prepared.label) !== normalize(component.label)
      )
        componentReasons.push("COMPONENT_IDENTITY_MISMATCH");
      const evidenceGroupIds = prepared?.evidence?.evidenceGroupIds || [];
      const sourceSpanIds = prepared?.sourceSpanIds || [];
      if (
        packetRow.evidenceReadiness !== "READY" ||
        prepared?.evidence?.evidenceReadiness !== "READY" ||
        evidenceGroupIds.length < 1
      )
        componentReasons.push("COMPONENT_EVIDENCE_NOT_READY");
      if (evidenceGroupIds.some((id) => !groupById.has(id)))
        componentReasons.push("COMPONENT_GROUP_REFERENCE_INVALID");
      if (
        sourceSpanIds.length < 1 ||
        sourceSpanIds.some((id) => !referenceASpanIds.has(id))
      )
        componentReasons.push("COMPONENT_A_SPAN_REFERENCE_INVALID");
      componentResults.push({
        componentId: component.componentId,
        factRole: component.factRole,
        componentLabelSha256: sha256(component.label || ""),
        candidateEvidenceGroupCount: evidenceGroupIds.length,
        candidateSourceSpanCount: sourceSpanIds.length,
        status: componentReasons.length === 0 ? "PASS" : "FLAGGED",
        reasons: componentReasons,
      });
    }
    if (
      componentResults.length !== (packetRow.components || []).length ||
      componentResults.some(({ status }) => status !== "PASS")
    )
      reasons.push("COMPONENT_BINDING_FLAGGED");

    validationRows.push({
      requirementId,
      sourceOrder: candidateRow.sourceOrder,
      status: reasons.length === 0 ? "PASS" : "FLAGGED",
      reasons,
      comparisonEvidence: {
        classification: comparison.classification,
        sourceBinding: comparison.source_binding,
        findingIds: comparison.finding_ids || [],
      },
      sourceReferences: referenceResults,
      components: componentResults,
    });
  }

  const flaggedRows = validationRows.filter(({ status }) => status === "FLAGGED");
  const payload = {
    schemaVersion: 2,
    contractId: "LF_1PLUS9_GOLD283_POSITIVE_BINDING_VALIDATION_V2",
    status:
      flaggedRows.length === 0
        ? "254_COMMON_POSITIVES_VALIDATED"
        : "COMMON_POSITIVE_FLAGS_REQUIRE_BOUNDED_ADJUDICATION",
    createdAt: new Date().toISOString(),
    qaOnly: true,
    productionRule: false,
    generalizationProof: false,
    bindings: Object.fromEntries(
      Object.entries(inputs).map(([key, input]) => [
        key,
        { file: input.file, fileSha256: input.sha256 },
      ])
    ),
    scope: {
      primaryAdjudicationIds: primaryIds,
      commonPositiveIds,
      diagnosticVoicesCanExpandScope: false,
      expansionRule:
        "Only a deterministic source, page, core/scope, or component binding flag may extend adjudication beyond the 29 primary rows.",
    },
    summary: {
      primaryRows: primaryIds.length,
      commonPositiveRows: commonPositiveIds.length,
      validatedCommonPositiveRows: validationRows.length - flaggedRows.length,
      flaggedCommonPositiveRows: flaggedRows.length,
      flaggedIds: flaggedRows.map(({ requirementId }) => requirementId),
      evidenceGroups: groupById.size,
      evidenceSpans: spanById.size,
      componentsChecked: validationRows.reduce(
        (sum, row) => sum + row.components.length,
        0
      ),
      sourceReferencesChecked: validationRows.reduce(
        (sum, row) => sum + row.sourceReferences.length,
        0
      ),
      sourceReferencesPassed: validationRows.reduce(
        (sum, row) =>
          sum +
          row.sourceReferences.filter(({ status }) => status === "PASS").length,
        0
      ),
      componentsPassed: validationRows.reduce(
        (sum, row) =>
          sum + row.components.filter(({ status }) => status === "PASS").length,
        0
      ),
    },
    rows: validationRows,
    limitation:
      "This deterministic validation proves frozen Astra source identity and type-appropriate locators (PDF page, Markdown row, or DOCX structural location), existing Fable/Astra core-scope agreement metadata, and A-component to prepared-B-evidence integrity. It does not replace source adjudication for flagged rows and is only regression evidence for the exact SHA-bound LF 1+9 fixture.",
  };
  const artifact = {
    ...payload,
    validationSha256: sha256(stableStringify(payload)),
  };
  atomicWritePrivate(output, artifact);
  process.stdout.write(
    `${JSON.stringify({
      output,
      fileSha256: sha256(fs.readFileSync(output)),
      validationSha256: artifact.validationSha256,
      status: artifact.status,
      summary: artifact.summary,
    })}\n`
  );
}

if (require.main === module) main();

module.exports = {
  normalize,
  sha256,
  stableStringify,
  typedLocator,
};
