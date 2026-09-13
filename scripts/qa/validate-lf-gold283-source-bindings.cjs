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

function tokens(value) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length >= 4)
  );
}

function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return common / (left.size + right.size - common);
}

function documentCompatible(left, right) {
  const a = normalize(path.basename(String(left || "")));
  const b = normalize(path.basename(String(right || "")));
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return jaccard(tokens(a), tokens(b)) >= 0.6;
}

function parsePageNumbers(location) {
  const explicit = [
    ...String(location || "").matchAll(
      /(?:seite|page|s\.?)[^0-9]{0,4}([0-9]{1,3})/giu
    ),
  ].map((match) => Number(match[1]));
  return [...new Set(explicit.filter(Number.isInteger))];
}

function textCompatible(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  const shorter = Math.min(a.length, b.length);
  if (shorter >= 40 && (a.includes(b) || b.includes(a))) return true;
  return jaccard(tokens(a), tokens(b)) >= 0.82;
}

function atomicWritePrivate(file, value) {
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
  const packet = inputs.packet.value;
  const goldCandidate = inputs.goldCandidate.value;

  if (
    !Array.isArray(matrix.rows) ||
    matrix.rows.length !== 283 ||
    !Array.isArray(comparisons) ||
    comparisons.length !== 283 ||
    !decisions ||
    Object.keys(decisions).length !== 283 ||
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

    const matchedGroupIds = new Set();
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
      const pages = parsePageNumbers(reference?.location);
      if (pages.length === 0) referenceReasons.push("PAGE_NOT_MACHINE_READABLE");
      const matches = reference
        ? groups.filter((group) => {
            if (!textCompatible(reference.text, group.exactText)) return false;
            const relevantSpans = group.sourceSpans.filter((span) =>
              documentCompatible(reference.file, span.documentName)
            );
            if (relevantSpans.length === 0) return false;
            if (pages.length === 0) return true;
            return relevantSpans.some((span) =>
              pages.includes(span.physicalPageNumber)
            );
          })
        : [];
      for (const match of matches) matchedGroupIds.add(match.evidenceGroupId);
      if (matches.length === 0)
        referenceReasons.push("REFERENCE_NOT_REBOUND_TO_FROZEN_SOURCE_GROUP");
      referenceResults.push({
        referenceId,
        referenceRecordSha256: reference
          ? sha256(stableStringify(reference))
          : null,
        pageNumbers: pages,
        matchedEvidenceGroupIds: matches.map(({ evidenceGroupId }) =>
          evidenceGroupId
        ),
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
        prepared?.evidenceReadiness !== "READY" ||
        prepared?.evidence?.evidenceReadiness !== "READY" ||
        evidenceGroupIds.length < 1
      )
        componentReasons.push("COMPONENT_EVIDENCE_NOT_READY");
      if (evidenceGroupIds.some((id) => !groupById.has(id)))
        componentReasons.push("COMPONENT_GROUP_REFERENCE_INVALID");
      if (sourceSpanIds.some((id) => !spanById.has(id)))
        componentReasons.push("COMPONENT_SPAN_REFERENCE_INVALID");
      const selectedGroupIntersection = evidenceGroupIds.filter((id) =>
        matchedGroupIds.has(id)
      );
      componentResults.push({
        componentId: component.componentId,
        factRole: component.factRole,
        componentLabelSha256: sha256(component.label || ""),
        candidateEvidenceGroupCount: evidenceGroupIds.length,
        candidateSourceSpanCount: sourceSpanIds.length,
        selectedGroupIntersection,
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
    schemaVersion: 1,
    contractId: "LF_1PLUS9_GOLD283_POSITIVE_BINDING_VALIDATION_V1",
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
    },
    rows: validationRows,
    limitation:
      "This deterministic validation proves frozen source identity, machine-readable page linkage, existing Fable/Astra core-scope agreement metadata, and component-to-prepared-evidence integrity. It does not replace human source adjudication for flagged rows and is only regression evidence for the exact SHA-bound LF 1+9 fixture.",
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

main();
