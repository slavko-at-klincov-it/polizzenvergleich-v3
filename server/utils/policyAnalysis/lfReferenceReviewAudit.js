const crypto = require("crypto");

const AUDIT_CASE_SCHEMA_VERSION = 1;
const AUDIT_CASE_CONTRACT_ID = "LF_REFERENCE_REVIEW_AUDIT_CASE_V1";
const AUDIT_RESULT_SCHEMA_VERSION = 1;
const AUDIT_RESULT_CONTRACT_ID = "LF_REFERENCE_REVIEW_AUDIT_RESULT_V1";

const COMPONENT_FINDINGS = Object.freeze([
  "DIRECT_SUPPORT",
  "NARROWER_SUPPORT",
  "CONTRADICTION",
  "RELATED_ONLY",
  "MENTION_ONLY",
  "NO_MATCH_IN_CANDIDATES",
  "UNCLEAR",
]);
const ROW_DISPOSITIONS = Object.freeze([
  "COMPLETE_COUNTERPART_CANDIDATE",
  "PARTIAL_REMAINS_WITH_EVIDENCE",
  "PRESENT_BUT_NO_DECISION_READY_COMPONENT",
  "CONTRADICTION_REVIEW_REQUIRED",
  "AUDIT_UNCLEAR",
  "NO_ADDITIONAL_MATCH_IN_CANDIDATES",
]);
const ROOT_CAUSES = Object.freeze([
  "TRUE_PARTIAL",
  "FALSE_POSITIVE_CURRENT_SOURCE",
  "MISSED_COUNTERPART_CANDIDATE",
  "COMPONENT_MODELING_GAP",
  "SCOPE_ROLE_CONDITION_OR_VALUE_MISMATCH",
  "PACKAGE_PRECEDENCE_UNCLEAR",
  "INSUFFICIENT_EVIDENCE",
]);
const RECOMMENDED_ACTIONS = Object.freeze([
  "KEEP_PARTIAL",
  "PROMOTE_TO_FOUND_AFTER_RULE_FIX",
  "DEMOTE_TO_UNCLEAR_AFTER_RULE_FIX",
  "MARK_CONTRADICTED_AFTER_RULE_FIX",
  "REVIEW_COMPONENT_MODEL",
  "MANUAL_REVIEW_REQUIRED",
]);
const CURRENT_SOURCE_ASSESSMENTS = Object.freeze([
  "VALID_COMPLETE_EVIDENCE",
  "VALID_PARTIAL_EVIDENCE",
  "RELATED_ONLY",
  "WRONG_SCOPE_OR_ROLE",
  "CONTRADICTORY",
  "UNCLEAR",
]);
const COVERAGE_EFFECTS = Object.freeze([
  "INCLUDED",
  "LIMITED",
  "EXCLUDED",
  "DEFINED",
  "UNKNOWN",
]);
const VALUE_COMPARISONS = Object.freeze([
  "SAME",
  "DIFFERENT",
  "NOT_APPLICABLE",
  "UNCLEAR",
]);
const CONFIDENCE_LEVELS = Object.freeze(["HIGH", "MEDIUM", "LOW"]);
const SCOPE_RELATIONS = Object.freeze([
  "SAME_OR_BROADER",
  "NARROWER",
  "DIFFERENT",
  "NOT_APPLICABLE",
  "UNCLEAR",
]);

const STOPWORDS = new Set(
  "aber alle allen als also am an auch auf aus bei beim bis da das dass dem den der des die dies diese diesem diesen dieser dieses doch durch ein eine einem einen einer eines er es für gegen hat im in ins ist je kann kein keine mit nach nicht noch nur oder ohne pro sein sind so sowie über um und unter vom von vor war werden wie wird zu zum zur".split(
    " "
  )
);

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : String(value))
    .digest("hex");
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/ß/gu, "ss")
    .replace(/[^a-z0-9€%]+/gu, " ")
    .trim();
}

function normalizeQuote(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function tokens(value) {
  return normalize(value)
    .split(/\s+/u)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function parseDocumentPages(pageContent, pageMap) {
  const markers = [
    ...String(pageContent ?? "").matchAll(/\[DOCUMENT_PAGE (\d+)\]\r?\n/gu),
  ];
  const pages = markers.map((marker, index) => ({
    pageNumber: Number(marker[1]),
    text: String(pageContent)
      .slice(
        marker.index + marker[0].length,
        markers[index + 1]?.index ?? String(pageContent).length
      )
      .trim(),
  }));
  if (
    !Array.isArray(pageMap) ||
    pages.length !== pageMap.length ||
    pages.some((page, index) => page.pageNumber !== pageMap[index]?.pageNumber)
  )
    throw new Error("LF_REFERENCE_AUDIT_PAGE_MAP_MISMATCH");
  return pages;
}

function buildSourceChunks(documents, { windowSize = 1800, overlap = 350 } = {}) {
  if (windowSize < 900 || overlap < 0 || overlap >= windowSize)
    throw new Error("LF_REFERENCE_AUDIT_CHUNK_CONFIGURATION_INVALID");
  const chunks = [];
  for (const document of [...documents].sort(
    (left, right) => left.position - right.position
  )) {
    for (const page of document.pages) {
      const text = page.text.replace(/\r/gu, "");
      let start = 0;
      while (start < text.length) {
        let end = Math.min(text.length, start + windowSize);
        if (end < text.length) {
          const boundary = text.lastIndexOf("\n", end);
          if (boundary > start + Math.floor(windowSize / 2)) end = boundary;
        }
        const chunkText = text.slice(start, end).trim();
        if (!chunkText) break;
        const chunkIdentity = {
          documentSha256: document.sha256,
          pageNumber: page.pageNumber,
          pageOffsetStart: start,
          pageOffsetEnd: end,
          textSha256: sha256(chunkText),
        };
        const chunk = {
          id: `candidate:${sha256(canonicalJson(chunkIdentity))}`,
          documentUuid: document.uuid,
          documentSha256: document.sha256,
          documentName: document.name,
          documentRole: document.role,
          documentStatus: document.documentStatus,
          documentPosition: document.position,
          pageNumber: page.pageNumber,
          pageOffsetStart: start,
          pageOffsetEnd: end,
          text: chunkText,
          textSha256: chunkIdentity.textSha256,
        };
        chunks.push({
          ...chunk,
          normalizedText: normalize(chunkText),
          tokenSet: new Set(tokens(chunkText)),
        });
        if (end >= text.length) break;
        start = Math.max(start + 1, end - overlap);
      }
    }
  }
  return chunks;
}

function contributorPages(contributor) {
  return [
    ...String(contributor?.source ?? "").matchAll(/PDF-Seite\s+(\d+)/gu),
  ].map((match) => Number(match[1]));
}

function contributorQuotes(contributor) {
  return [
    ...String(contributor?.source ?? "").matchAll(/„([^“]{12,})“/gu),
  ].map((match) => normalize(match[1]));
}

function rankCandidates({ row, requirement, chunks, topK = 14 }) {
  const documentFrequency = new Map();
  for (const chunk of chunks)
    for (const token of chunk.tokenSet)
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);

  const componentText = (requirement.components ?? [])
    .flatMap((component) => [component.label, ...(component.aliases ?? [])])
    .join(" ");
  const valueText = (requirement.values ?? [])
    .map((value) => canonicalJson(value))
    .join(" ");
  const queryText = [
    row.categoryName,
    row.subcategoryName,
    row.packageA?.documentedContent,
    componentText,
    valueText,
  ].join(" ");
  const queryTokens = [...new Set(tokens(queryText))];
  const primaryTokens = new Set(
    tokens([row.categoryName, componentText, valueText].join(" "))
  );
  const phrases = [
    row.categoryName,
    ...(requirement.components ?? []).flatMap((component) => [
      component.label,
      ...(component.aliases ?? []),
    ]),
  ]
    .map(normalize)
    .filter((phrase) => phrase.split(" ").length >= 2 && phrase.length >= 8);
  const scored = chunks.map((chunk) => {
    let score = 0;
    const matchedTokens = [];
    for (const token of queryTokens) {
      if (!chunk.tokenSet.has(token)) continue;
      const frequency = documentFrequency.get(token) ?? 1;
      const inverseFrequency = Math.log(
        1 + (chunks.length + 0.5) / (frequency + 0.5)
      );
      score += inverseFrequency * (primaryTokens.has(token) ? 4 : 1);
      matchedTokens.push(token);
    }
    const phraseHits = phrases.filter((phrase) =>
      chunk.normalizedText.includes(phrase)
    );
    score += phraseHits.length * 8;
    return { chunk, score, matchedTokens, phraseHits };
  });
  scored.sort(
    (left, right) =>
      right.score - left.score || left.chunk.id.localeCompare(right.chunk.id)
  );

  const selected = new Map();
  for (const item of scored.slice(0, topK)) selected.set(item.chunk.id, item);
  const documentUuids = [...new Set(chunks.map(({ documentUuid }) => documentUuid))];
  for (const documentUuid of documentUuids) {
    const best = scored.find((item) => item.chunk.documentUuid === documentUuid);
    if (best) selected.set(best.chunk.id, best);
  }
  const currentContributorGroups = (row.packageB?.contributors ?? []).map(
    (contributor) => {
      const pages = contributorPages(contributor);
      const quotes = contributorQuotes(contributor);
      const matchingCandidateIds = [];
      const currentSourceItems = scored
        .filter(
          ({ chunk }) =>
            chunk.documentUuid === contributor.documentUuid &&
            pages.includes(chunk.pageNumber)
        )
        .sort((left, right) => {
          const leftQuoteHits = quotes.filter((quote) =>
            left.chunk.normalizedText.includes(quote)
          ).length;
          const rightQuoteHits = quotes.filter((quote) =>
            right.chunk.normalizedText.includes(quote)
          ).length;
          return (
            rightQuoteHits - leftQuoteHits ||
            right.score - left.score ||
            left.chunk.id.localeCompare(right.chunk.id)
          );
        })
        .slice(0, 2);
      for (const item of currentSourceItems) {
        selected.set(item.chunk.id, item);
        matchingCandidateIds.push(item.chunk.id);
      }
      return {
        documentUuid: contributor.documentUuid,
        documentName: contributor.documentName,
        documentStatus: contributor.documentStatus,
        currentReviewStatus: contributor.reviewStatus,
        currentSource: contributor.source,
        pageNumbers: pages,
        matchingCandidateIds: [...new Set(matchingCandidateIds)].sort(),
      };
    }
  );
  return {
    queryTokens,
    currentContributorGroups,
    candidates: [...selected.values()]
      .sort(
        (left, right) =>
          right.score - left.score || left.chunk.id.localeCompare(right.chunk.id)
      )
      .map(({ chunk, score, matchedTokens, phraseHits }) => ({
        id: chunk.id,
        documentUuid: chunk.documentUuid,
        documentName: chunk.documentName,
        documentRole: chunk.documentRole,
        documentStatus: chunk.documentStatus,
        documentPosition: chunk.documentPosition,
        pageNumber: chunk.pageNumber,
        pageOffsetStart: chunk.pageOffsetStart,
        pageOffsetEnd: chunk.pageOffsetEnd,
        retrievalScore: Number(score.toFixed(4)),
        matchedTokens,
        phraseHits,
        text: chunk.text,
        textSha256: chunk.textSha256,
      })),
  };
}

function buildAuditCase({
  row,
  requirement,
  retrieval,
  sourceInventory,
  productionEvidence,
  bindings,
}) {
  if (row.outcome !== "TEILWEISES_GEGENSTUECK")
    throw new Error("LF_REFERENCE_AUDIT_TARGET_IS_NOT_PARTIAL");
  if (row.categoryId !== requirement.requirementId)
    throw new Error("LF_REFERENCE_AUDIT_REQUIREMENT_MISMATCH");
  const auditCase = {
    schemaVersion: AUDIT_CASE_SCHEMA_VERSION,
    contractId: AUDIT_CASE_CONTRACT_ID,
    caseId: row.analysisRowId,
    sourceOrder: row.sourceOrder,
    requirementId: row.categoryId,
    categoryName: row.categoryName,
    subcategoryId: row.subcategoryId,
    subcategoryName: row.subcategoryName,
    originalDecision: {
      outcome: row.outcome,
      packageBReviewStatus: row.packageB?.reviewStatus,
      pointDecision: row.pointDecision,
      packageB: row.packageB,
      rowSha256: sha256(canonicalJson(row)),
    },
    packageA: row.packageA,
    semanticRequirement: requirement,
    productionEvidence,
    retrieval: {
      method: "DETERMINISTIC_NORMALIZED_LEXICAL_IDF_WITH_CURRENT_SOURCES_V2",
      searchedDocumentCount: sourceInventory.length,
      searchedPageCount: sourceInventory.reduce(
        (sum, document) => sum + document.pageCount,
        0
      ),
      queryTokens: retrieval.queryTokens,
      selectedCandidateCount: retrieval.candidates.length,
      currentContributorGroups: retrieval.currentContributorGroups,
    },
    candidates: retrieval.candidates,
    sourceInventory,
    bindings,
    advisoryOnly: true,
    primaryResultMutationAllowed: false,
  };
  auditCase.inputSha256 = sha256(canonicalJson(auditCase));
  return auditCase;
}

const SYSTEM_PROMPT = `Du auditierst genau EINEN bestehenden Teiltreffer eines gerichteten Versicherungsvergleichs. Prüfe jede ausdrücklich gelieferte semantische Komponente einzeln und streng quellengebunden. Prüfe außerdem, ob die bisher vom Produktionslauf verwendeten Fundstellen fachlich passen.

Regeln:
1. Erfinde keine Quelle, Seite, Klausel, Zahl, Komponente oder Rechtsfolge.
2. Verwende ausschließlich gelieferte Kandidaten-IDs und Komponenten-IDs. Zitate müssen wörtlich und zusammenhängend im Kandidatentext vorkommen.
3. Der A-Text liefert Kontext. Bewertet werden nur die gelieferten Komponenten und Werte; verlange keine unmodellierten Details.
4. DIRECT_SUPPORT: Kandidat trägt dieselbe fachliche Funktion und einen gleichen oder breiteren wesentlichen Scope.
5. NARROWER_SUPPORT: echtes Gegenstück, aber engerer Scope oder zusätzliche Bedingung. Andere Werte allein machen ein Gegenstück nicht enger; erfasse sie getrennt.
6. CONTRADICTION: dieselbe Komponente ist in einer maßgeblichen B-Quelle ausdrücklich ausgeschlossen oder gegenteilig geregelt.
7. RELATED_ONLY oder MENTION_ONLY: thematische Nähe, anderer Gegenstand, andere Faktrolle, anderer Scope oder bloße Erwähnung sind kein tragfähiger Komponentenbeleg.
8. NO_MATCH_IN_CANDIDATES bedeutet nur, dass die gelieferten Kandidaten keinen Beleg enthalten. Es ist niemals ein vollständiger Paket-Nullfund.
9. UNCLEAR: die gelieferten Kandidaten reichen für diese Komponente nicht aus.
10. Liefere für jede Komponente genau ein assessment. Setze keinen finalen Zeilenstatus; der Server rollt die Komponenten deterministisch auf.
11. Beurteile die bisher verwendeten Fundstellen separat. Produktionsdiagnosen sind Kontext und dürfen nicht ungeprüft übernommen werden.
12. Das Ergebnis ist nur ein KI-Prüfvorschlag. Empfehle keine automatische Ergebnisänderung ohne Regeländerung, Replay und Regressionstests.
13. Antworte ausschließlich mit validem JSON ohne Markdown.`;

function promptPayload(auditCase) {
  return {
    caseId: auditCase.caseId,
    requirement: {
      id: auditCase.requirementId,
      label: auditCase.categoryName,
      subcategory: auditCase.subcategoryName,
      sourceTextA: auditCase.packageA?.documentedContent,
      sourceA: auditCase.packageA?.source,
      components: auditCase.semanticRequirement.components,
      values: auditCase.semanticRequirement.values,
    },
    currentPartialResult: {
      documentedContent: String(
        auditCase.originalDecision.packageB?.documentedContent ?? ""
      ).slice(0, 10000),
      coverage: auditCase.originalDecision.packageB?.coverage,
      coverageAmount: auditCase.originalDecision.packageB?.coverageAmount,
      contributorGroups: auditCase.retrieval.currentContributorGroups.map(
        (group) => ({
          ...group,
          currentSource: String(group.currentSource ?? "").slice(0, 4000),
        })
      ),
      productionEvidence: auditCase.productionEvidence,
    },
    sources: auditCase.candidates.map((candidate) => ({
      candidateId: candidate.id,
      documentName: candidate.documentName,
      documentRole: candidate.documentRole,
      documentStatus: candidate.documentStatus,
      physicalPdfPage: candidate.pageNumber,
      isCurrentSource: auditCase.retrieval.currentContributorGroups.some(
        ({ matchingCandidateIds }) => matchingCandidateIds.includes(candidate.id)
      ),
      text: candidate.text,
    })),
    requiredOutput: {
      componentAssessments: [
        {
          componentId: "component_id",
          finding: COMPONENT_FINDINGS.join(" | "),
          supportingCandidateIds: ["candidate:sha256"],
          contradictingCandidateIds: ["candidate:sha256"],
          exactQuotes: [
            { candidateId: "candidate:sha256", quote: "kurzes exaktes Zitat" },
          ],
          coverageEffect: COVERAGE_EFFECTS.join(" | "),
          scopeRelation: SCOPE_RELATIONS.join(" | "),
          observedBValues: [
            {
              candidateId: "candidate:sha256",
              value: "exakter B-Wert oder Bedingung",
              relationToA: "SAME | DIFFERENT | ADDITIONAL | UNCLEAR",
            },
          ],
          note: "knappe komponentenbezogene Begründung",
        },
      ],
      currentSourceAssessment: CURRENT_SOURCE_ASSESSMENTS.join(" | "),
      rootCause: ROOT_CAUSES.join(" | "),
      recommendedAction: RECOMMENDED_ACTIONS.join(" | "),
      valueComparison: VALUE_COMPARISONS.join(" | "),
      reasoning: "knappe, fachlich nachvollziehbare Begründung auf Deutsch",
      confidence: CONFIDENCE_LEVELS.join(" | "),
    },
  };
}

function jsonFromModelText(content) {
  return JSON.parse(
    String(content ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/iu, "")
      .replace(/\s*```$/u, "")
  );
}

function exactArray(value, label) {
  if (!Array.isArray(value) || new Set(value).size !== value.length)
    throw new Error(`LF_REFERENCE_AUDIT_${label}_INVALID`);
  return value;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value ?? {}).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  )
    throw new Error(`LF_REFERENCE_AUDIT_${label}_KEYS_INVALID`);
}

function deriveRowDisposition(componentAssessments) {
  const findings = new Set(componentAssessments.map(({ finding }) => finding));
  if (findings.has("CONTRADICTION")) return "CONTRADICTION_REVIEW_REQUIRED";
  if (findings.has("UNCLEAR")) return "AUDIT_UNCLEAR";
  const supported = componentAssessments.filter(({ finding }) =>
    ["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(finding)
  ).length;
  if (supported === componentAssessments.length)
    return "COMPLETE_COUNTERPART_CANDIDATE";
  if (supported > 0) return "PARTIAL_REMAINS_WITH_EVIDENCE";
  if (findings.has("RELATED_ONLY") || findings.has("MENTION_ONLY"))
    return "PRESENT_BUT_NO_DECISION_READY_COMPONENT";
  return "NO_ADDITIONAL_MATCH_IN_CANDIDATES";
}

function validateAuditResult(auditCase, result) {
  exactKeys(
    result,
    [
      "componentAssessments",
      "currentSourceAssessment",
      "rootCause",
      "recommendedAction",
      "valueComparison",
      "reasoning",
      "confidence",
      ...(Object.hasOwn(result ?? {}, "rowDisposition")
        ? ["rowDisposition"]
        : []),
    ],
    "RESULT"
  );
  if (
    !result ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    !CURRENT_SOURCE_ASSESSMENTS.includes(result.currentSourceAssessment) ||
    !ROOT_CAUSES.includes(result.rootCause) ||
    !RECOMMENDED_ACTIONS.includes(result.recommendedAction) ||
    !VALUE_COMPARISONS.includes(result.valueComparison) ||
    !CONFIDENCE_LEVELS.includes(result.confidence) ||
    typeof result.reasoning !== "string" ||
    result.reasoning.trim().length < 12
  )
    throw new Error("LF_REFERENCE_AUDIT_RESULT_ENUM_OR_REASON_INVALID");

  const candidateById = new Map(
    auditCase.candidates.map((candidate) => [candidate.id, candidate])
  );
  const componentIds = new Set(
    auditCase.semanticRequirement.components.map((component) => component.id)
  );
  const componentAssessments = exactArray(
    result.componentAssessments,
    "COMPONENT_ASSESSMENTS"
  );
  if (
    componentAssessments.length !== componentIds.size ||
    new Set(componentAssessments.map(({ componentId }) => componentId)).size !==
      componentIds.size ||
    componentAssessments.some(
      ({ componentId }) => !componentIds.has(componentId)
    )
  )
    throw new Error("LF_REFERENCE_AUDIT_COMPONENT_PARTITION_INVALID");
  for (const assessment of componentAssessments) {
    exactKeys(
      assessment,
      [
        "componentId",
        "finding",
        "supportingCandidateIds",
        "contradictingCandidateIds",
        "exactQuotes",
        "coverageEffect",
        "scopeRelation",
        "observedBValues",
        "note",
      ],
      "COMPONENT_ASSESSMENT"
    );
    if (
      !COMPONENT_FINDINGS.includes(assessment.finding) ||
      !COVERAGE_EFFECTS.includes(assessment.coverageEffect) ||
      !SCOPE_RELATIONS.includes(assessment.scopeRelation) ||
      typeof assessment.note !== "string" ||
      assessment.note.trim().length < 8
    )
      throw new Error("LF_REFERENCE_AUDIT_COMPONENT_ASSESSMENT_INVALID");
    const supportingCandidateIds = exactArray(
      assessment.supportingCandidateIds,
      "SUPPORTING_CANDIDATES"
    );
    const contradictingCandidateIds = exactArray(
      assessment.contradictingCandidateIds,
      "CONTRADICTING_CANDIDATES"
    );
    const evidenceCandidateIds = new Set([
      ...supportingCandidateIds,
      ...contradictingCandidateIds,
    ]);
    if (
      [...evidenceCandidateIds].some(
        (candidateId) => !candidateById.has(candidateId)
      ) ||
      supportingCandidateIds.some((candidateId) =>
        contradictingCandidateIds.includes(candidateId)
      )
    )
      throw new Error("LF_REFERENCE_AUDIT_CANDIDATE_INVALID");
    const quotes = exactArray(assessment.exactQuotes, "EXACT_QUOTES");
    for (const quote of quotes) {
      const candidate = candidateById.get(quote?.candidateId);
      const normalized = normalizeQuote(quote?.quote);
      if (
        !candidate ||
        !evidenceCandidateIds.has(quote.candidateId) ||
        normalized.length < 12 ||
        !normalizeQuote(candidate.text).includes(normalized)
      )
        throw new Error("LF_REFERENCE_AUDIT_QUOTE_INVALID");
    }
    for (const candidateId of evidenceCandidateIds)
      if (!quotes.some((quote) => quote.candidateId === candidateId))
        throw new Error("LF_REFERENCE_AUDIT_EVIDENCE_WITHOUT_QUOTE");
    const needsSupport = [
      "DIRECT_SUPPORT",
      "NARROWER_SUPPORT",
      "RELATED_ONLY",
      "MENTION_ONLY",
    ].includes(assessment.finding);
    if (
      (needsSupport && supportingCandidateIds.length === 0) ||
      (assessment.finding === "CONTRADICTION" &&
        contradictingCandidateIds.length === 0) ||
      (["NO_MATCH_IN_CANDIDATES", "UNCLEAR"].includes(assessment.finding) &&
        evidenceCandidateIds.size > 0)
    )
      throw new Error("LF_REFERENCE_AUDIT_COMPONENT_EVIDENCE_INVALID");
    const observedValues = exactArray(
      assessment.observedBValues,
      "OBSERVED_VALUES"
    );
    for (const observedValue of observedValues)
      if (
        !evidenceCandidateIds.has(observedValue?.candidateId) ||
        typeof observedValue.value !== "string" ||
        !["SAME", "DIFFERENT", "ADDITIONAL", "UNCLEAR"].includes(
          observedValue.relationToA
        )
      )
        throw new Error("LF_REFERENCE_AUDIT_OBSERVED_VALUE_INVALID");
  }

  const rowDisposition = deriveRowDisposition(componentAssessments);
  if (
    Object.hasOwn(result, "rowDisposition") &&
    result.rowDisposition !== rowDisposition
  )
    throw new Error("LF_REFERENCE_AUDIT_ROW_DISPOSITION_INVALID");
  if (
    (result.rootCause === "TRUE_PARTIAL" &&
      rowDisposition !== "PARTIAL_REMAINS_WITH_EVIDENCE") ||
    (result.rootCause === "MISSED_COUNTERPART_CANDIDATE" &&
      rowDisposition !== "COMPLETE_COUNTERPART_CANDIDATE") ||
    (result.recommendedAction === "KEEP_PARTIAL" &&
      rowDisposition !== "PARTIAL_REMAINS_WITH_EVIDENCE") ||
    (result.recommendedAction === "PROMOTE_TO_FOUND_AFTER_RULE_FIX" &&
      rowDisposition !== "COMPLETE_COUNTERPART_CANDIDATE") ||
    (result.recommendedAction === "MARK_CONTRADICTED_AFTER_RULE_FIX" &&
      rowDisposition !== "CONTRADICTION_REVIEW_REQUIRED")
  )
    throw new Error("LF_REFERENCE_AUDIT_RECOMMENDATION_INCOHERENT");
  return { ...result, rowDisposition };
}

function buildAuditResultRecord({
  auditCase,
  result,
  model,
  endpoint,
  startedAt,
  finishedAt,
  rawResponse,
}) {
  const validatedResult = validateAuditResult(auditCase, result);
  const record = {
    schemaVersion: AUDIT_RESULT_SCHEMA_VERSION,
    contractId: AUDIT_RESULT_CONTRACT_ID,
    status: "COMPLETED",
    advisoryOnly: true,
    primaryResultMutationAllowed: false,
    caseId: auditCase.caseId,
    caseInputSha256: auditCase.inputSha256,
    endpoint,
    model,
    temperature: 0,
    systemPromptSha256: sha256(SYSTEM_PROMPT),
    userPromptSha256: sha256(canonicalJson(promptPayload(auditCase))),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    result: validatedResult,
    rawResponse,
  };
  record.recordSha256 = sha256(canonicalJson(record));
  return record;
}

function validateAuditResultRecord(auditCase, record, { model } = {}) {
  if (
    record?.schemaVersion !== AUDIT_RESULT_SCHEMA_VERSION ||
    record?.contractId !== AUDIT_RESULT_CONTRACT_ID ||
    record?.status !== "COMPLETED" ||
    record?.advisoryOnly !== true ||
    record?.primaryResultMutationAllowed !== false ||
    record?.caseId !== auditCase.caseId ||
    record?.caseInputSha256 !== auditCase.inputSha256 ||
    record?.systemPromptSha256 !== sha256(SYSTEM_PROMPT) ||
    record?.userPromptSha256 !==
      sha256(canonicalJson(promptPayload(auditCase))) ||
    (model && record.model !== model)
  )
    throw new Error("LF_REFERENCE_AUDIT_RECORD_BINDING_INVALID");
  const expectedDigest = record.recordSha256;
  const withoutDigest = { ...record };
  delete withoutDigest.recordSha256;
  if (expectedDigest !== sha256(canonicalJson(withoutDigest)))
    throw new Error("LF_REFERENCE_AUDIT_RECORD_DIGEST_INVALID");
  validateAuditResult(auditCase, record.result);
  return record;
}

module.exports = {
  AUDIT_CASE_CONTRACT_ID,
  AUDIT_CASE_SCHEMA_VERSION,
  AUDIT_RESULT_CONTRACT_ID,
  AUDIT_RESULT_SCHEMA_VERSION,
  CONFIDENCE_LEVELS,
  COVERAGE_EFFECTS,
  CURRENT_SOURCE_ASSESSMENTS,
  COMPONENT_FINDINGS,
  RECOMMENDED_ACTIONS,
  ROOT_CAUSES,
  ROW_DISPOSITIONS,
  SCOPE_RELATIONS,
  SYSTEM_PROMPT,
  VALUE_COMPARISONS,
  buildAuditCase,
  buildAuditResultRecord,
  buildSourceChunks,
  canonicalJson,
  deriveRowDisposition,
  jsonFromModelText,
  normalize,
  parseDocumentPages,
  promptPayload,
  rankCandidates,
  sha256,
  validateAuditResult,
  validateAuditResultRecord,
};
