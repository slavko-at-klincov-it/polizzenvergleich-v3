const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { SEARCH_DISPOSITION, decidePoint } = require("./pointDecision");
const {
  CATEGORY_ORDER,
  CATEGORY_ROW_COUNTS,
  EXPECTED_ROW_COUNT,
  PRODUCT_PROFILE,
} = require("./productContract");
const { customerResultText } = require("./customerResultPresenter");
const {
  deriveCustomerMetrics,
  validateCustomerComparison,
} = require("./customerMetricContract");
const {
  requirementSearchContractDigest,
} = require("../policyAnalysis/coverageOnlyCertificationContract");
const {
  FE_C07_COMPONENT_ID,
  validFeC07ConditionAbsenceAudit,
} = require("../policyAnalysis/feC07ConditionAbsenceAudit");
const {
  buildLw20DefaultExclusionOverrideAudit,
} = require("../policyAnalysis/lw20DefaultExclusionOverrideAudit");
const {
  buildLw20DefaultExclusionSourceAudit,
} = require("../policyAnalysis/lw20DefaultExclusionSourceAudit");
const {
  DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
  TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
  TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
  certifiedTerminalTarget,
  terminalOccurrenceProof,
  terminalOccurrenceDigest,
  terminalRejectionSetDigest,
} = require("../policyAnalysis/deterministicTerminalRejectionContract");
const MISSING_EVIDENCE = "keine belegte Fundstelle gefunden";
const NOT_DETERMINABLE = "Nicht feststellbar";
const CONDITION_CONTEXT_RADIUS = 240;

function worksheetRequirementContract(worksheet, requirement) {
  const catalogId = String(worksheet?.catalog?.id || "").trim();
  if (!catalogId || !requirement) return null;
  return {
    digest: requirementSearchContractDigest({ catalogId, requirement }),
    componentSatisfactionPolicy:
      requirement.componentSatisfactionPolicy || null,
    components: (requirement.components || []).map(({ id, factRole }) => ({
      id,
      factRole,
    })),
  };
}

function conditionCheckText(candidate) {
  const contextText = String(candidate?.contextText || "");
  const contextStart = Number(candidate?.contextDocumentStart);
  const documentStart = Number(candidate?.documentStart);
  const documentEnd = Number(candidate?.documentEnd);
  if (
    !contextText ||
    !Number.isFinite(contextStart) ||
    !Number.isFinite(documentStart) ||
    !Number.isFinite(documentEnd)
  )
    return String(candidate?.exactText || "");
  const relativeStart = documentStart - contextStart;
  const relativeEnd = documentEnd - contextStart;
  if (
    relativeStart < 0 ||
    relativeEnd < relativeStart ||
    relativeStart > contextText.length
  )
    return String(candidate?.exactText || "");
  return contextText.slice(
    Math.max(0, relativeStart - CONDITION_CONTEXT_RADIUS),
    Math.min(contextText.length, relativeEnd + CONDITION_CONTEXT_RADIUS)
  );
}

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function isEvidenceRow(row) {
  return !(
    normalized(row?.documentedContent) === normalized(MISSING_EVIDENCE) &&
    normalized(row?.source) === normalized(MISSING_EVIDENCE)
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function decimalParts(value) {
  const compact = String(value || "")
    .replace(/[\s\u00a0]/gu, "")
    .trim();
  if (!/^\d[\d.,]*$/u.test(compact)) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let decimalSeparator = null;
  if (lastComma >= 0 && lastDot >= 0)
    decimalSeparator = lastComma > lastDot ? "," : ".";
  else if (lastComma >= 0 && compact.length - lastComma - 1 <= 2)
    decimalSeparator = ",";
  else if (lastDot >= 0 && compact.length - lastDot - 1 <= 2)
    decimalSeparator = ".";
  const parts = decimalSeparator
    ? compact.split(decimalSeparator)
    : [compact, ""];
  const integerDigits = parts[0].replace(/[.,]/gu, "");
  const decimalDigits = String(parts[1] || "").replace(/[.,]/gu, "");
  if (!integerDigits || integerDigits.length > 30 || decimalDigits.length > 2)
    return null;
  return {
    integer: BigInt(integerDigits),
    fraction: BigInt(decimalDigits.padEnd(2, "0") || "0"),
  };
}

function singleCurrencyAmount(value) {
  const text = String(value || "");
  const matches = [
    ...text.matchAll(/(?:EUR|\u20ac)\s*([0-9][0-9.,\s\u00a0]*)/giu),
    ...text.matchAll(/([0-9][0-9.,\s\u00a0]*)\s*(?:EUR|\u20ac)/giu),
  ];
  const amounts = unique(
    matches
      .map((match) => decimalParts(match[1]))
      .filter(Boolean)
      .map(({ integer, fraction }) => `${integer * 100n + fraction}`)
  );
  return amounts.length === 1 ? BigInt(amounts[0]) : null;
}

function singlePercentage(value) {
  const percentages = unique(
    [...String(value || "").matchAll(/([0-9]+(?:[.,][0-9]{1,2})?)\s*%/gu)]
      .map((match) => decimalParts(match[1]))
      .filter(Boolean)
      .map(({ integer, fraction }) => `${integer * 100n + fraction}`)
  );
  return percentages.length === 1 ? BigInt(percentages[0]) : null;
}

function nativeAmountKey(value) {
  const currency = singleCurrencyAmount(value);
  if (currency !== null) return `EUR:${currency}`;
  const percentage = singlePercentage(value);
  if (percentage !== null) return `PERCENT:${percentage}`;
  return `TEXT:${normalized(value)}`;
}

function clauseCodes(fact) {
  return unique(
    [
      ...`${fact.documentedContent || ""}\n${fact.source || ""}`.matchAll(
        /\b\d{2}[A-Z]{2}\d{4}\b/gu
      ),
    ].map(([code]) => code)
  );
}

function sharedClauseCodes(facts) {
  const sets = facts.map((fact) => new Set(clauseCodes(fact)));
  if (sets.length === 0) return [];
  return [...sets[0]].filter((code) =>
    sets.slice(1).every((set) => set.has(code))
  );
}

function amountQualifier(fact) {
  const text = `${fact.coverageAmount || ""}\n${fact.source || ""}`;
  const qualifiers = [];
  if (/\b(?:Jahresh[oö]chst|pro\s+Jahr|je\s+Versicherungsjahr)\b/iu.test(text))
    qualifiers.push("ANNUAL");
  if (/\b(?:je|pro)\s+(?:Schadenfall|Ereignis)\b/iu.test(text))
    qualifiers.push("EVENT");
  if (/\bauf\s+[,„“"']*Erstes\s+Risiko\b/iu.test(text))
    qualifiers.push("FIRST_RISK");
  return qualifiers.sort().join("+") || "GENERAL";
}

function newBuildingValueBases(referenceEntries) {
  return unique(
    (referenceEntries || [])
      .filter(({ row }) => isEvidenceRow(row))
      .filter(({ row }) => row.reviewStatus === "BELEGT")
      .filter(({ row }) => row.categoryId === "VS-01")
      .filter(({ row }) =>
        /\b(?:NBW|Neubauwert|Wohngeb[aä]ude\s+zum\s+Neuwert)\b/iu.test(
          `${row.documentedContent || ""}\n${row.source || ""}`
        )
      )
      .map(({ row }) => singleCurrencyAmount(row.coverageAmount))
      .filter((value) => value !== null)
      .map(String)
  ).map(BigInt);
}

function canonicalAmountKeys(facts, referenceEntries) {
  const commonClauseCodes = sharedClauseCodes(
    facts.filter(
      ({ coverageAmount }) =>
        normalized(coverageAmount) !== normalized(NOT_DETERMINABLE)
    )
  );
  const commonClauseKey = commonClauseCodes.join(",");
  const values = facts
    .filter(
      ({ coverageAmount }) =>
        normalized(coverageAmount) !== normalized(NOT_DETERMINABLE)
    )
    .map((fact) => ({
      fact,
      nativeKey: nativeAmountKey(fact.coverageAmount),
    }));
  const preserveClauseQualifier =
    values.length > 0 &&
    values.every(({ fact }) => amountQualifier(fact) !== "GENERAL");
  const canonicalQualifier = (fact) =>
    preserveClauseQualifier ? amountQualifier(fact) : "GENERAL";
  const bases = newBuildingValueBases(referenceEntries);
  const currencyTargets = [
    ...new Map(
      values
        .filter(({ nativeKey }) => nativeKey.startsWith("EUR:"))
        .map(({ fact, nativeKey }) => {
          const amount = nativeKey.slice(4);
          const qualifier = canonicalQualifier(fact);
          return [
            `${amount}:${qualifier}`,
            { amount: BigInt(amount), qualifier },
          ];
        })
    ).values(),
  ];

  return values.map(({ fact, nativeKey }) => {
    if (!nativeKey.startsWith("PERCENT:"))
      return commonClauseKey
        ? `CLAUSE:${commonClauseKey}:${nativeKey}:QUALIFIER:${canonicalQualifier(fact)}`
        : `${nativeKey}:QUALIFIER:${amountQualifier(fact)}`;
    if (
      !commonClauseKey ||
      !/\b(?:des\s+NBW|vom\s+NBW|des\s+Neubauwerts?)\b/iu.test(
        `${fact.documentedContent || ""}\n${fact.source || ""}`
      )
    )
      return commonClauseKey
        ? `CLAUSE:${commonClauseKey}:${nativeKey}:QUALIFIER:${canonicalQualifier(fact)}`
        : `${nativeKey}:QUALIFIER:${amountQualifier(fact)}`;
    const percentageHundredths = BigInt(nativeKey.slice("PERCENT:".length));
    const matchingTargets = unique(
      bases
        .flatMap((base) =>
          currencyTargets.filter(({ amount }) => {
            const numerator = base * percentageHundredths;
            const rounded = (numerator + 5_000n) / 10_000n;
            return rounded === amount;
          })
        )
        .map(({ amount, qualifier }) => `${amount}:${qualifier}`)
    );
    return matchingTargets.length === 1
      ? `CLAUSE:${commonClauseKey}:EUR:${matchingTargets[0].replace(":", ":QUALIFIER:")}`
      : `CLAUSE:${commonClauseKey}:${nativeKey}:QUALIFIER:${canonicalQualifier(fact)}`;
  });
}

function roleLabel(role) {
  return (
    {
      MAIN_POLICY: "Hauptpolizze",
      SUPPLEMENT: "Zusatzvertrag",
      ENDORSEMENT: "Nachtrag / Änderung",
      TERMS: "Bedingungen",
      OTHER: "Sonstiges",
    }[role] || role
  );
}

function summarizePackage(
  entries,
  { referenceEntries = entries, searchAudit = null } = {}
) {
  const evidenceEntries = entries.filter(({ row }) => isEvidenceRow(row));
  if (evidenceEntries.length === 0) {
    if (
      [
        SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND,
        SEARCH_DISPOSITION.VERIFIED_NOT_FOUND,
      ].includes(searchAudit?.disposition)
    ) {
      const assumedNotIncluded =
        searchAudit.comparisonTreatment === "ASSUMED_NOT_INCLUDED_V1";
      return {
        evidenceFound: false,
        documentedContent:
          searchAudit.disposition === SEARCH_DISPOSITION.VERIFIED_NOT_FOUND
            ? "IM VOLLSTÄNDIG GEPRÜFTEN BEREITGESTELLTEN PAKET NICHT GEFUNDEN"
            : "IM VOLLSTÄNDIGEN KONTROLLIERTEN SUCHLAUF DES BEREITGESTELLTEN PAKETS NICHT GEFUNDEN",
        coverage: assumedNotIncluded
          ? "Für diesen Vergleich als nicht enthalten angenommen"
          : NOT_DETERMINABLE,
        coverageAmount: NOT_DETERMINABLE,
        source: `Dokumentweite kontrollierte Suche über ${searchAudit.documentCount} Dokument(e) und ${searchAudit.physicalPagesChecked} physische Textseite(n); Suchplan: ${searchAudit.searchPlanIds.join(", ")}. Mit den ausgewiesenen Suchbegriffen wurde keine entsprechende Fundstelle ermittelt.`,
        reviewStatus: assumedNotIncluded
          ? "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG"
          : "KEIN_TREFFER_NACH_VOLLSTÄNDIGER_KONTROLLIERTER_SUCHE",
        searchDisposition: searchAudit.disposition,
        comparisonTreatment: searchAudit.comparisonTreatment,
        searchAudit,
        facts: [],
      };
    }
    return {
      evidenceFound: false,
      documentedContent: MISSING_EVIDENCE,
      coverage: NOT_DETERMINABLE,
      coverageAmount: NOT_DETERMINABLE,
      source: MISSING_EVIDENCE,
      reviewStatus: "UNGEKLÄRT",
      searchDisposition: SEARCH_DISPOSITION.INCOMPLETE,
      comparisonTreatment: null,
      searchAudit,
      facts: [],
    };
  }

  const facts = evidenceEntries.map(({ document, row }) => ({
    documentUuid: document.uuid,
    documentName: document.originalName,
    role: document.role,
    documentStatus: document.documentStatus,
    documentedContent: row.documentedContent,
    coverage: row.coverage,
    coverageAmount: row.coverageAmount,
    source: row.source,
    reviewStatus: row.reviewStatus,
  }));
  const coverageValues = unique(
    facts
      .map(({ coverage }) => coverage)
      .filter((value) => normalized(value) !== normalized(NOT_DETERMINABLE))
  );
  const amountValues = unique(
    facts
      .map(({ coverageAmount }) => coverageAmount)
      .filter((value) => normalized(value) !== normalized(NOT_DETERMINABLE))
  );
  const amountKeys = unique(canonicalAmountKeys(facts, referenceEntries));
  const unresolvedPrecedence =
    coverageValues.length > 1 || amountKeys.length > 1;
  const reviewStatus = facts.some(
    ({ reviewStatus: status }) => status === "WIDERSPRÜCHLICH"
  )
    ? "WIDERSPRÜCHLICH"
    : unresolvedPrecedence
      ? "RANGFOLGE_PRÜFEN"
      : facts.every(({ reviewStatus: status }) => status === "BELEGT")
        ? "BELEGT"
        : "TEILBELEGT";

  return {
    evidenceFound: true,
    documentedContent: facts
      .map(
        (fact) =>
          `[${fact.documentName} · ${roleLabel(fact.role)}] ${fact.documentedContent}`
      )
      .join("\n"),
    coverage:
      coverageValues.length === 0
        ? NOT_DETERMINABLE
        : coverageValues.length === 1
          ? coverageValues[0]
          : "Mehrere dokumentbezogene Werte – Rangfolge prüfen",
    coverageAmount:
      amountKeys.length === 0
        ? NOT_DETERMINABLE
        : amountKeys.length === 1
          ? amountValues.reduce(
              (selected, candidate) =>
                candidate.length > selected.length ? candidate : selected,
              amountValues[0]
            )
          : "Mehrere dokumentbezogene Werte – Rangfolge prüfen",
    source: facts
      .map(
        (fact) =>
          `[${fact.documentName} · ${roleLabel(fact.role)}] ${fact.source}`
      )
      .join("\n"),
    reviewStatus,
    searchDisposition: SEARCH_DISPOSITION.RELEVANT_FOUND,
    comparisonTreatment: null,
    searchAudit,
    facts,
  };
}

function comparableDocumentedContent(fact) {
  const text = String(fact?.documentedContent || "");
  const prefix = {
    PROPOSAL: "Vorschlag (PROPOSED_ONLY):",
    FRAMEWORK_TERMS: "Rahmenbedingung (FRAMEWORK_TERMS):",
  }[fact?.documentStatus];
  return prefix && text.startsWith(prefix)
    ? text.slice(prefix.length).trimStart()
    : text;
}

function statusNeutralComparable(packageSummary) {
  const unique = new Map();
  for (const fact of packageSummary.facts) {
    const comparableFact = {
      documentedContent: normalized(comparableDocumentedContent(fact)),
      coverage: normalized(fact.coverage),
      coverageAmount: normalized(fact.coverageAmount),
    };
    unique.set(JSON.stringify(comparableFact), comparableFact);
  }
  return [...unique.values()].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right), "de-AT")
  );
}

function comparable(packageSummary) {
  return packageSummary.facts
    .map((fact) => ({
      documentedContent: normalized(fact.documentedContent),
      coverage: normalized(fact.coverage),
      coverageAmount: normalized(fact.coverageAmount),
      documentStatus: fact.documentStatus,
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "de-AT")
    );
}

function comparePackages(packageA, packageB) {
  const completeNotFound = (packageSummary) =>
    [
      SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND,
      SEARCH_DISPOSITION.VERIFIED_NOT_FOUND,
    ].includes(packageSummary?.searchDisposition);
  const absentA = completeNotFound(packageA);
  const absentB = completeNotFound(packageB);
  if (absentA && absentB)
    return {
      outcome: "BEIDSEITIG_VOLLSTÄNDIG_NICHT_GEFUNDEN",
      difference:
        "In beiden vollständig kontrolliert geprüften bereitgestellten Paketen wurde mit den ausgewiesenen Suchplänen keine entsprechende Fundstelle ermittelt. Das belegt weder ausdrückliche Gleichheit noch einen ausdrücklichen Ausschluss.",
    };
  if (packageA.evidenceFound && absentB)
    return {
      outcome: "A_BELEGT_B_VOLLSTÄNDIG_NICHT_GEFUNDEN",
      difference:
        "Paket A enthält belegten Inhalt; der vollständige kontrollierte Suchlauf für Paket B blieb ohne entsprechende Fundstelle. Die Punktentscheidung darf daraus nur eine ausdrücklich freigegebene fachliche Wirkung ableiten.",
    };
  if (absentA && packageB.evidenceFound)
    return {
      outcome: "B_BELEGT_A_VOLLSTÄNDIG_NICHT_GEFUNDEN",
      difference:
        "Paket B enthält belegten Inhalt; der vollständige kontrollierte Suchlauf für Paket A blieb ohne entsprechende Fundstelle. Die Punktentscheidung darf daraus nur eine ausdrücklich freigegebene fachliche Wirkung ableiten.",
    };
  if (!packageA.evidenceFound && !packageB.evidenceFound)
    return {
      outcome: "BEIDSEITIG_KEIN_BELEG",
      difference:
        "Beidseitig keine belegte Fundstelle; daraus folgt keine Deckungsaussage.",
    };
  if (packageA.evidenceFound && !packageB.evidenceFound)
    return {
      outcome: "NUR_A_BELEGT",
      difference:
        "Nur Paket A enthält belegten Inhalt. Ein automatischer Vorteilsschluss ist nicht zulässig.",
    };
  if (!packageA.evidenceFound && packageB.evidenceFound)
    return {
      outcome: "NUR_B_BELEGT",
      difference:
        "Nur Paket B enthält belegten Inhalt. Ein automatischer Vorteilsschluss ist nicht zulässig.",
    };
  const comparableView =
    packageA.reviewStatus === "BELEGT" &&
    packageB.reviewStatus === "BELEGT" &&
    [...packageA.facts, ...packageB.facts].some(({ documentStatus }) =>
      ["FRAMEWORK_TERMS", "PROPOSAL"].includes(documentStatus)
    )
      ? statusNeutralComparable
      : comparable;
  if (
    JSON.stringify(comparableView(packageA)) ===
    JSON.stringify(comparableView(packageB))
  )
    return {
      outcome: "INHALTLICH_GLEICH",
      difference:
        "Die belegten dokumentbezogenen Werte sind in beiden Paketen gleich.",
    };
  return {
    outcome: "UNTERSCHIED_FACHLICH_PRÜFEN",
    difference:
      "Die belegten Inhalte unterscheiden sich. Vorteil, Rangfolge und Vertragswirkung sind fachlich zu prüfen.",
  };
}

function readJsonIfPresent(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function completeTextExtraction(documentArtifact) {
  const extraction = documentArtifact?.document?.pdfExtraction;
  return Boolean(
    documentArtifact?.schemaVersion === 1 &&
      extraction?.complete === true &&
      Number.isInteger(extraction.totalPages) &&
      extraction.totalPages > 0 &&
      extraction.processedPages === extraction.totalPages &&
      extraction.pagesWithText === extraction.totalPages
  );
}

function completeCategoryTechnicalContract({
  documentArtifact,
  worksheet,
  materializedEvidence,
  targets,
  report,
}) {
  const componentCount = Number(worksheet?.summary?.componentCount || 0);
  return Boolean(
    completeTextExtraction(documentArtifact) &&
      worksheet?.document?.physicalPages ===
        documentArtifact.document.pdfExtraction.totalPages &&
      ["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"].includes(report?.status) &&
      Number.isInteger(report?.rowCount) &&
      report.rowCount > 0 &&
      report.rowCount === report.expectedRowCount &&
      report?.gates &&
      Object.values(report.gates).length > 0 &&
      Object.values(report.gates).every(Boolean) &&
      componentCount > 0 &&
      materializedEvidence?.judgements?.length === componentCount &&
      targets?.length === componentCount
  );
}

function deterministicTerminalRejectionAudit({
  requirement,
  component,
  target,
}) {
  const certifiedTarget = certifiedTerminalTarget({
    categoryView: String(requirement?.id || "").split("-")[0],
    requirementId: requirement?.id,
    componentId: component?.id,
  });
  const occurrences = component?.occurrences;
  const rejections = target?.serverRejectedCandidates;
  if (
    !certifiedTarget ||
    !Array.isArray(occurrences) ||
    occurrences.length === 0 ||
    component?.occurrenceCount !== occurrences.length ||
    !Array.isArray(target?.candidates) ||
    target.candidates.length !== 0 ||
    !Array.isArray(target?.unresolvedCandidateIds) ||
    target.unresolvedCandidateIds.length !== 0 ||
    !Array.isArray(rejections) ||
    rejections.length !== occurrences.length
  )
    return null;

  const occurrenceIds = [
    ...new Set(occurrences.map(({ candidateId }) => candidateId)),
  ].sort();
  const rejectionIds = [
    ...new Set(rejections.map(({ candidateId }) => candidateId)),
  ].sort();
  const occurrenceById = new Map(
    occurrences.map((occurrence) => [occurrence.candidateId, occurrence])
  );
  if (
    occurrenceIds.length !== occurrences.length ||
    rejectionIds.length !== rejections.length ||
    JSON.stringify(occurrenceIds) !== JSON.stringify(rejectionIds) ||
    rejections.some((rejection) => {
      const occurrence = occurrenceById.get(rejection?.candidateId);
      const occurrenceProof = terminalOccurrenceProof(
        certifiedTarget,
        occurrence
      );
      return (
        !occurrenceProof ||
        rejection?.reason !== "TRIAGE_MENTION_ONLY" ||
        rejection?.terminalRejectionContractId !== certifiedTarget.contractId ||
        rejection?.occurrenceDigestContractId !==
          TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID ||
        rejection?.decisionOwner !== "SERVER" ||
        rejection?.decisionBasis !== certifiedTarget.decisionBasis ||
        !certifiedTarget.sectionScopeSources.includes(
          rejection?.sectionScopeSource
        ) ||
        !Number.isInteger(rejection?.physicalPageNumber) ||
        rejection.physicalPageNumber < 1 ||
        rejection.physicalPageNumber !== occurrenceProof.physicalPageNumber ||
        rejection?.sectionScopeSource !== occurrenceProof.sectionScopeSource ||
        JSON.stringify(rejection?.observedScopeKeys) !==
          JSON.stringify(occurrenceProof.observedScopeKeys) ||
        (rejection?.scopeProofMode || null) !==
          certifiedTarget.scopeProofMode ||
        rejection?.occurrenceDigestSha256 !==
          terminalOccurrenceDigest({
            ...occurrence,
            ...(rejection?.scopeProofMode
              ? { scopeProofMode: rejection.scopeProofMode }
              : {}),
          })
      );
    })
  )
    return null;

  return {
    schemaVersion: 3,
    contractId: certifiedTarget.contractId,
    requirementId: requirement?.id || null,
    componentId: component?.id || null,
    decisionOwner: "SERVER",
    decisionBasis: certifiedTarget.decisionBasis,
    proofMode: certifiedTarget.auditProofMode,
    rejectedOccurrenceCount: rejections.length,
    rejectedCandidateIds: rejectionIds,
    rejectionDigestContractId: TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
    rejectionDigestSha256: terminalRejectionSetDigest(rejections),
    rejections: rejections
      .map(
        ({
          candidateId,
          terminalRejectionContractId,
          occurrenceDigestContractId,
          decisionBasis,
          occurrenceDigestSha256,
          physicalPageNumber,
          sectionScopeSource,
          observedScopeKeys,
          scopeProofMode,
        }) => ({
          candidateId,
          terminalRejectionContractId,
          occurrenceDigestContractId,
          decisionBasis,
          occurrenceDigestSha256,
          physicalPageNumber,
          sectionScopeSource,
          observedScopeKeys,
          ...(scopeProofMode ? { scopeProofMode } : {}),
        })
      )
      .sort((left, right) =>
        left.candidateId.localeCompare(right.candidateId, "de-AT")
      ),
  };
}

function componentSearchAudit({
  document,
  documentArtifact,
  worksheet,
  materializedEvidence,
  targets,
  report,
  requirement,
  component,
  judgement,
  target,
}) {
  const extraction = documentArtifact?.document?.pdfExtraction || {};
  const searchPlanId = `${worksheet?.catalog?.id || "unknown"}/${requirement?.id || judgement?.requirementId}/${component?.id || judgement?.componentId}`;
  const zeroOccurrenceTerminal =
    component?.terminalState === "NO_CONTROLLED_CANDIDATE" &&
    component?.occurrenceCount === 0 &&
    Array.isArray(component?.occurrences) &&
    component.occurrences.length === 0;
  const zeroCandidateTerminal =
    Array.isArray(target?.candidates) &&
    target.candidates.length === 0 &&
    Array.isArray(target?.serverRejectedCandidates) &&
    target.serverRejectedCandidates.length === 0 &&
    Array.isArray(target?.unresolvedCandidateIds) &&
    target.unresolvedCandidateIds.length === 0;
  const terminalRejectionAudit = deterministicTerminalRejectionAudit({
    requirement,
    component,
    target,
  });
  const deterministicOutOfCategoryTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID
  );
  const deterministicNonContractualRiskInformationTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID
  );
  const deterministicPostLossScaffoldingCostTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID
  );
  const deterministicLw20NonTargetOccurrenceTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID
  );
  const deterministicRejectionTerminal = Boolean(terminalRejectionAudit);
  const lw20DefaultExclusionOverrideAudit =
    buildLw20DefaultExclusionOverrideAudit({
      document,
      documentArtifact,
      requirementId: requirement?.id,
      componentId: component?.id,
    });
  const lw20DefaultExclusionSourceAudit = buildLw20DefaultExclusionSourceAudit({
    document,
    documentArtifact,
    requirement,
    component,
    judgement,
    target,
  });
  const serverNegativeTerminal = Boolean(
    judgement?.evidencePresence === "NOT_FOUND" &&
      judgement?.coverageEffect === "UNKNOWN" &&
      judgement?.conflictState === "NONE" &&
      judgement?.decisionOwner === "SERVER" &&
      Array.isArray(judgement?.selectedCandidateIds) &&
      judgement.selectedCandidateIds.length === 0 &&
      Array.isArray(judgement?.unresolvedCandidateIds) &&
      judgement.unresolvedCandidateIds.length === 0
  );
  const negativeSearchApproved = [
    "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
    "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1",
  ].includes(requirement?.negativeSearchPolicy);
  const completeControlledSearch = Boolean(
    negativeSearchApproved &&
      completeCategoryTechnicalContract({
        documentArtifact,
        worksheet,
        materializedEvidence,
        targets,
        report,
      }) &&
      ((zeroOccurrenceTerminal && zeroCandidateTerminal) ||
        deterministicRejectionTerminal) &&
      serverNegativeTerminal
  );
  const verified = Boolean(
    completeControlledSearch &&
      requirement?.negativeSearchPolicy ===
        "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1" &&
      requirement?.absenceCertification?.requirementDigest
  );
  const comparisonTreatment =
    verified &&
    requirement?.absenceComparisonPolicy ===
      "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1"
      ? "ASSUMED_NOT_INCLUDED_V1"
      : completeControlledSearch
        ? "DOCUMENTATION_ONLY_V1"
        : null;
  return {
    disposition:
      judgement?.evidencePresence === "FOUND"
        ? SEARCH_DISPOSITION.RELEVANT_FOUND
        : verified
          ? SEARCH_DISPOSITION.VERIFIED_NOT_FOUND
          : completeControlledSearch
            ? SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND
            : SEARCH_DISPOSITION.INCOMPLETE,
    comparisonTreatment,
    negativeSearchPolicy: requirement?.negativeSearchPolicy || null,
    absenceMeaning: requirement?.absenceMeaning || null,
    comparisonPolicy: requirement?.absenceComparisonPolicy || null,
    absenceCertification: requirement?.absenceCertification || null,
    requirementContract: worksheetRequirementContract(worksheet, requirement),
    searchPlanId,
    documentUuid: document.uuid,
    catalogId: worksheet?.catalog?.id || null,
    physicalPagesChecked: completeTextExtraction(documentArtifact)
      ? extraction.totalPages
      : 0,
    totalPhysicalPages: Number(extraction.totalPages || 0),
    aliases: component?.aliases || [],
    conceptSearchIds: (component?.conceptSearches || []).map(({ id }) => id),
    ...(terminalRejectionAudit ? { terminalRejectionAudit } : {}),
    ...(lw20DefaultExclusionOverrideAudit
      ? { lw20DefaultExclusionOverrideAudit }
      : {}),
    ...(lw20DefaultExclusionSourceAudit
      ? { lw20DefaultExclusionSourceAudit }
      : {}),
    gates: {
      negativeSearchApproved,
      certifiedNegativeSearch: verified,
      completeTextExtraction: completeTextExtraction(documentArtifact),
      completeCategoryTechnicalContract: completeCategoryTechnicalContract({
        documentArtifact,
        worksheet,
        materializedEvidence,
        targets,
        report,
      }),
      zeroOccurrenceTerminal,
      zeroCandidateTerminal,
      serverNegativeTerminal,
      ...(deterministicOutOfCategoryTerminal
        ? { deterministicOutOfCategoryTerminal: true }
        : {}),
      ...(deterministicNonContractualRiskInformationTerminal
        ? { deterministicNonContractualRiskInformationTerminal: true }
        : {}),
      ...(deterministicPostLossScaffoldingCostTerminal
        ? { deterministicPostLossScaffoldingCostTerminal: true }
        : {}),
      ...(deterministicLw20NonTargetOccurrenceTerminal
        ? { deterministicLw20NonTargetOccurrenceTerminal: true }
        : {}),
    },
  };
}

function materializeAtomicFacts({
  document,
  worksheet,
  materializedEvidence,
  requestedFields,
  targets,
  documentArtifact,
  report,
}) {
  if (!worksheet || !materializedEvidence || !requestedFields || !targets)
    return [];
  const requirements = new Map(
    (worksheet.requirements || []).map((requirement) => [
      requirement.id,
      requirement,
    ])
  );
  const fieldResults = new Map(
    (requestedFields.requirements || []).map((requirement) => [
      requirement.requirementId,
      requirement,
    ])
  );
  const targetsById = new Map(
    (targets || []).map((target) => [target.targetId, target])
  );
  return (materializedEvidence.judgements || []).map((judgement) => {
    const requirement = requirements.get(judgement.requirementId);
    const component = requirement?.components?.find(
      ({ id }) => id === judgement.componentId
    );
    const fieldResult = fieldResults.get(judgement.requirementId) || {
      requestedFieldStatus: "NOT_EVALUATED",
      fields: [],
    };
    const selectedCandidateIds = judgement.selectedCandidateIds || [];
    const selectedSet = new Set(selectedCandidateIds);
    const fields = (fieldResult.fields || []).map((field) => {
      const facts = (field.facts || []).filter((fact) =>
        selectedSet.has(fact.source?.candidateId)
      );
      const absenceAudit =
        requirement?.id === "FE-C07" &&
        component?.id === FE_C07_COMPONENT_ID &&
        field.field === "condition" &&
        field.status === "NOT_FOUND" &&
        facts.length === 0 &&
        selectedSet.has(field.absenceAudit?.source?.candidateId) &&
        validFeC07ConditionAbsenceAudit(field.absenceAudit)
          ? field.absenceAudit
          : null;
      return {
        field: field.field,
        status: facts.length > 0 ? field.status : "NOT_FOUND",
        ...(facts.length === 0 && absenceAudit ? { absenceAudit } : {}),
        facts,
      };
    });
    const target = targetsById.get(judgement.targetId);
    const sources = (target?.candidates || [])
      .filter(({ candidateId }) => selectedSet.has(candidateId))
      .map((candidate) => {
        const { candidateId, physicalPageNumber, printedPageLabel, exactText } =
          candidate;
        return {
          candidateId,
          physicalPageNumber,
          printedPageLabel,
          exactText,
          conditionCheckText: conditionCheckText(candidate),
        };
      });
    return {
      requirementId: judgement.requirementId,
      componentId: judgement.componentId,
      componentLabel: component?.label || judgement.componentId,
      factRole: component?.factRole || target?.factRole || "UNKNOWN",
      documentUuids: [document.uuid],
      documentRole: document.role,
      documentStatus: document.documentStatus,
      evidencePresence: judgement.evidencePresence,
      coverageEffect: judgement.coverageEffect,
      conflictState: judgement.conflictState,
      selectedScopePicture: judgement.selectedScopePicture,
      documentApplicability: judgement.documentApplicability,
      selectedCandidateIds,
      unresolvedCandidateIds: judgement.unresolvedCandidateIds || [],
      requestedFieldStatus: fieldResult.requestedFieldStatus,
      fields,
      sources,
      componentSatisfactionPolicy:
        requirement?.componentSatisfactionPolicy || "ALL",
      coverageAggregationPolicy: requirement?.coverageAggregationPolicy || null,
      scopePolicy: requirement?.scopePolicy || null,
      requestedFields: Array.isArray(requirement?.requestedFields)
        ? [...requirement.requestedFields]
        : [],
      optionalFields: Array.isArray(requirement?.optionalFields)
        ? requirement.optionalFields.filter(
            (field) => !(requirement?.requestedFields || []).includes(field)
          )
        : [],
      requirementContractDigest:
        worksheetRequirementContract(worksheet, requirement)?.digest || null,
      declaredComponents: (requirement?.components || []).map(
        ({ id, factRole }) => ({ id, factRole })
      ),
      searchAudit: componentSearchAudit({
        document,
        documentArtifact,
        worksheet,
        materializedEvidence,
        targets,
        report,
        requirement,
        component,
        judgement,
        target,
      }),
    };
  });
}

function readDocumentAnalysis(documentRun) {
  const documentArtifact = readJsonIfPresent(
    path.join(documentRun.outputDirectory, "document.private.json")
  );
  const categories = {};
  const atomicFacts = {};
  for (const categoryView of CATEGORY_ORDER) {
    const categoryDirectory = path.join(
      documentRun.outputDirectory,
      categoryView
    );
    const file = path.join(categoryDirectory, "result", "rows.private.json");
    if (!fs.existsSync(file))
      throw new Error(
        `COMPARISON_CATEGORY_RESULT_MISSING:${documentRun.document.uuid}:${categoryView}`
      );
    categories[categoryView] = JSON.parse(fs.readFileSync(file, "utf8"));
    const report = readJsonIfPresent(
      path.join(categoryDirectory, "result", "report.json")
    );
    atomicFacts[categoryView] = materializeAtomicFacts({
      document: documentRun.document,
      worksheet: readJsonIfPresent(
        path.join(categoryDirectory, "worksheet.private.json")
      ),
      materializedEvidence: readJsonIfPresent(
        path.join(categoryDirectory, "effects", "materialized.private.json")
      ),
      requestedFields: readJsonIfPresent(
        path.join(categoryDirectory, "result", "requested-fields.private.json")
      ),
      targets: readJsonIfPresent(
        path.join(categoryDirectory, "effects", "targets.private.json")
      ),
      documentArtifact,
      report,
    });
  }
  return { categories, atomicFacts };
}

function aggregatePackageSearchAudit({
  loadedRuns,
  side,
  categoryView,
  categoryId,
}) {
  const sideRuns = loadedRuns.filter(({ document }) => document.side === side);
  const perDocument = sideRuns.map((run) => {
    const atoms = (run.atomicFacts[categoryView] || []).filter(
      (atom) => atom.requirementId === categoryId
    );
    return {
      documentUuid: run.document.uuid,
      atoms,
      completeNotFound:
        atoms.length > 0 &&
        atoms.every((atom) =>
          [
            SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND,
            SEARCH_DISPOSITION.VERIFIED_NOT_FOUND,
          ].includes(atom.searchAudit?.disposition)
        ),
      verified:
        atoms.length > 0 &&
        atoms.every(
          (atom) =>
            atom.searchAudit?.disposition ===
            SEARCH_DISPOSITION.VERIFIED_NOT_FOUND
        ),
    };
  });
  const completeNotFound =
    perDocument.length > 0 &&
    perDocument.every((entry) => entry.completeNotFound);
  const verified =
    perDocument.length > 0 && perDocument.every((entry) => entry.verified);
  const audits = perDocument.flatMap(({ atoms }) =>
    atoms.map(({ searchAudit }) => searchAudit).filter(Boolean)
  );
  const requirementContracts = unique(
    audits.map(({ requirementContract }) =>
      requirementContract ? JSON.stringify(requirementContract) : null
    )
  ).map((value) => JSON.parse(value));
  return {
    disposition: verified
      ? SEARCH_DISPOSITION.VERIFIED_NOT_FOUND
      : completeNotFound
        ? SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND
        : SEARCH_DISPOSITION.INCOMPLETE,
    comparisonTreatment: verified
      ? audits.every(
          ({ comparisonTreatment }) =>
            comparisonTreatment === "ASSUMED_NOT_INCLUDED_V1"
        )
        ? "ASSUMED_NOT_INCLUDED_V1"
        : "DOCUMENTATION_ONLY_V1"
      : completeNotFound
        ? "DOCUMENTATION_ONLY_V1"
        : null,
    documentCount: perDocument.length,
    documentUuids: perDocument.map(({ documentUuid }) => documentUuid).sort(),
    physicalPagesChecked: unique(
      audits.map(
        ({ documentUuid, physicalPagesChecked }) =>
          `${documentUuid}:${physicalPagesChecked}`
      )
    ).reduce(
      (sum, value) => sum + Number(value.slice(value.lastIndexOf(":") + 1)),
      0
    ),
    searchPlanIds: unique(
      audits.map(({ searchPlanId }) => searchPlanId)
    ).sort(),
    requirementContract:
      requirementContracts.length === 1 ? requirementContracts[0] : null,
    components: audits,
  };
}

function buildComparisonResult(documentRuns, metadata = {}) {
  const loadedRuns = documentRuns.map((run) => ({
    ...run,
    ...readDocumentAnalysis(run),
  }));
  const packageEntries = Object.fromEntries(
    ["A", "B"].map((side) => [
      side,
      loadedRuns
        .filter(({ document }) => document.side === side)
        .flatMap(({ document, categories }) =>
          CATEGORY_ORDER.flatMap((categoryView) =>
            categories[categoryView].map((row) => ({ document, row }))
          )
        ),
    ])
  );
  const categories = CATEGORY_ORDER.map((categoryView) => {
    const byDocument = loadedRuns.map((run) => ({
      document: run.document,
      rows: run.categories[categoryView],
    }));
    const rowIds =
      byDocument[0]?.rows.map(({ categoryId }) => categoryId) || [];
    const rows = rowIds.map((categoryId) => {
      const entries = byDocument.map(({ document, rows: documentRows }) => {
        const row = documentRows.find(
          (candidate) => candidate.categoryId === categoryId
        );
        if (!row)
          throw new Error(
            `COMPARISON_ROW_MISSING:${document.uuid}:${categoryId}`
          );
        return { document, row };
      });
      const first = entries[0].row;
      const searchAuditA = aggregatePackageSearchAudit({
        loadedRuns,
        side: "A",
        categoryView,
        categoryId,
      });
      const searchAuditB = aggregatePackageSearchAudit({
        loadedRuns,
        side: "B",
        categoryView,
        categoryId,
      });
      const packageA = summarizePackage(
        entries.filter(({ document }) => document.side === "A"),
        { referenceEntries: packageEntries.A, searchAudit: searchAuditA }
      );
      const packageB = summarizePackage(
        entries.filter(({ document }) => document.side === "B"),
        { referenceEntries: packageEntries.B, searchAudit: searchAuditB }
      );
      const comparison = comparePackages(packageA, packageB);
      const expectedDocumentsA = loadedRuns
        .filter(({ document }) => document.side === "A")
        .map(({ document }) => document);
      const expectedDocumentsB = loadedRuns
        .filter(({ document }) => document.side === "B")
        .map(({ document }) => document);
      const pointDecision = decidePoint({
        categoryId,
        packageA,
        packageB,
        atomsA: loadedRuns
          .filter(({ document }) => document.side === "A")
          .flatMap(({ atomicFacts }) => atomicFacts[categoryView] || []),
        atomsB: loadedRuns
          .filter(({ document }) => document.side === "B")
          .flatMap(({ atomicFacts }) => atomicFacts[categoryView] || []),
        expectedDocumentsA,
        expectedDocumentsB,
      });
      return {
        categoryId,
        stage: first.stage,
        categoryName: first.categoryName,
        packageA,
        packageB,
        ...comparison,
        pointDecision,
      };
    });
    return { categoryView, rows };
  });
  const totals = deriveCustomerMetrics(categories);
  const result = {
    schemaVersion: 11,
    status: "COMPARISON_RESULT_MATERIALIZED",
    generatedAt: new Date().toISOString(),
    ...metadata,
    productProfile: PRODUCT_PROFILE,
    documents: loadedRuns.map(({ document }) => ({
      uuid: document.uuid,
      side: document.side,
      role: document.role,
      documentStatus: document.documentStatus,
      originalName: document.originalName,
      sha256: document.sha256,
    })),
    categories,
    totals,
    proofLimit:
      "Punktweise, regelgebundene Vergleichsentscheidung. Ein vollständig belegter reiner Einschluss darf gegenüber einer unter demselben versionierten Komponenten- und Suchvertrag vollständig kontrolliert fundlosen Gegenseite als dokumentierter Vorteil ausgewiesen werden. Ausschließlich für LW-20 darf ein vollständiger kontrollierter Nichtfund mit einem belegten, paketweit nicht aufgehobenen Standardausschluss als gleiche dokumentierte Nichtdeckung bewertet werden; der Negativbefund wird dabei niemals in einen ausdrücklichen Ausschluss umgeschrieben. Für FE-A01 darf die vollständig quellengebundene Branddefinition 'bestimmungswidriges Entstehen oder Ausbreiten' gegenüber einer Definition nur über die bestimmungswidrige Ausbreitung als breiterer Begriffsumfang bewertet werden. Andere Suchbefunde bleiben von ihrer fachlichen Wirkung getrennt. Es gibt keinen Gesamtsieger; Dokumentrang, Ersatzwirkung und unvollständige Fakten bleiben sichtbar prüfpflichtig.",
  };
  validateCustomerComparison(result);
  return result;
}

function markdownResult(result) {
  const lines = [
    "# Polizzenvergleich A/B",
    "",
    `Status: ${result.status}`,
    "",
    `Zeilen: ${result.totals.rows}; Kundenprüfung erforderlich: ${result.totals.customerReviewRequired}.`,
    "",
    result.proofLimit,
    "",
  ];
  for (const category of result.categories) {
    lines.push(
      `## ${category.categoryView}`,
      "",
      "| Kategorie-ID | Kategorie | Paket A | A-Prüfstatus | A-Quellen | Paket B | B-Prüfstatus | B-Quellen | Punktentscheidung | Begründung | Technischer Prüfhinweis |",
      "|---|---|---|---|---|---|---|---|---|---|---|"
    );
    for (const row of category.rows) {
      const cells = [
        row.categoryId,
        row.categoryName,
        row.packageA.documentedContent,
        row.packageA.reviewStatus,
        row.packageA.source,
        row.packageB.documentedContent,
        row.packageB.reviewStatus,
        row.packageB.source,
        row.pointDecision.outcome,
        row.pointDecision.reason,
        row.difference,
      ].map((value) =>
        String(value || "")
          .replace(/\r?\n/gu, "<br>")
          .replace(/\|/gu, "\\|")
      );
      lines.push(`| ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function estimatedWrappedLines(value, width) {
  const capacity = Math.max(8, Math.floor(width * 1.05));
  return String(value || "")
    .split(/\r?\n/gu)
    .reduce((total, paragraph) => {
      const words = paragraph.split(/\s+/gu).filter(Boolean);
      if (words.length === 0) return total + 1;
      let lines = 1;
      let used = 0;
      for (const word of words) {
        const required = Math.min(word.length, capacity);
        if (used > 0 && used + 1 + required > capacity) {
          lines += 1;
          used = required;
        } else {
          used += (used > 0 ? 1 : 0) + required;
        }
        if (word.length > capacity) {
          lines += Math.floor((word.length - 1) / capacity);
          used = word.length % capacity;
        }
      }
      return total + lines;
    }, 0);
}

async function writeWorkbook(result, outputFile) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Polizzenvergleich V3";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Gesamtvergleich");
  sheet.properties.defaultRowHeight = 16;
  sheet.views = [{ state: "normal", zoomScale: 80 }];
  sheet.columns = [
    { header: "A_Kategorie-ID", key: "aCategoryId", width: 10.83203125 },
    { header: "A_Stufe", key: "aStage", width: 10.83203125 },
    { header: "A_Kategorie-Name", key: "aCategoryName", width: 56.83203125 },
    { header: "A_Vertragsinhalt", key: "aContent", width: 42 },
    { header: "A_Deckung", key: "aCoverage", width: 19 },
    { header: "A_Deckungssumme", key: "aAmount", width: 20.5 },
    { header: "A_Quelle", key: "aSource", width: 39.6640625 },
    { header: "A_Prüfstatus", key: "aReview", width: 10.83203125 },
    { header: "B_Kategorie-ID", key: "bCategoryId", width: 10.83203125 },
    { header: "B_Stufe", key: "bStage", width: 10.83203125 },
    { header: "B_Kategorie-Name", key: "bCategoryName", width: 30.33203125 },
    { header: "B_Vertragsinhalt", key: "bContent", width: 41.83203125 },
    { header: "B_Deckung", key: "bCoverage", width: 19.83203125 },
    { header: "B_Deckungssumme", key: "bAmount", width: 20 },
    { header: "B_Quelle", key: "bSource", width: 25.33203125 },
    { header: "B_Prüfstatus", key: "bReview", width: 17.1640625 },
    { header: "KI-Ergebnis", key: "customerResult", width: 54.33203125 },
  ];
  const stageOrder = new Map(
    ["K", "S", "V"].map((stage, index) => [stage, index])
  );
  const workbookRows = result.categories
    .flatMap((category, categoryIndex) =>
      category.rows.map((row, rowIndex) => ({
        row,
        categoryIndex,
        rowIndex,
      }))
    )
    .sort(
      (left, right) =>
        (stageOrder.get(left.row.stage) ?? Number.MAX_SAFE_INTEGER) -
          (stageOrder.get(right.row.stage) ?? Number.MAX_SAFE_INTEGER) ||
        left.categoryIndex - right.categoryIndex ||
        left.rowIndex - right.rowIndex
    );
  for (const { row } of workbookRows) {
    sheet.addRow({
      aCategoryId: row.categoryId,
      aStage: row.stage,
      aCategoryName: row.categoryName,
      aContent: row.packageA.documentedContent,
      aCoverage: row.packageA.coverage,
      aAmount: row.packageA.coverageAmount,
      aSource: row.packageA.source,
      aReview: row.packageA.reviewStatus,
      bCategoryId: row.categoryId,
      bStage: row.stage,
      bCategoryName: row.categoryName,
      bContent: row.packageB.documentedContent,
      bCoverage: row.packageB.coverage,
      bAmount: row.packageB.coverageAmount,
      bSource: row.packageB.source,
      bReview: row.packageB.reviewStatus,
      customerResult: customerResultText(row),
    });
  }
  const wrappedColumns = new Set([4, 7, 11, 12, 14, 15, 17]);
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.height =
      rowNumber === 1
        ? 17
        : Math.min(
            409.6,
            Math.max(
              2,
              ...[...wrappedColumns].map((columnNumber) =>
                estimatedWrappedLines(
                  row.getCell(columnNumber).value,
                  sheet.getColumn(columnNumber).width
                )
              )
            ) * 17
          );
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = {
        name: "Aptos Narrow",
        size: 12,
        bold: rowNumber === 1 && columnNumber === 17,
      };
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: wrappedColumns.has(columnNumber),
      };
    });
  });
  sheet.autoFilter = `A1:Q${sheet.rowCount}`;
  sheet.pageMargins = {
    left: 0.7,
    right: 0.7,
    top: 0.787401575,
    bottom: 0.787401575,
    header: 0.3,
    footer: 0.3,
  };
  await workbook.xlsx.writeFile(outputFile);
  fs.chmodSync(outputFile, 0o600);
}

async function writeComparisonArtifacts({
  documentRuns,
  outputDirectory,
  metadata,
  enforceProductProfile = false,
}) {
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const result = buildComparisonResult(documentRuns, metadata);
  if (enforceProductProfile) {
    for (const category of result.categories) {
      if (category.rows.length !== CATEGORY_ROW_COUNTS[category.categoryView])
        throw new Error(
          `COMPARISON_CATEGORY_ROW_COUNT_MISMATCH:${category.categoryView}:${category.rows.length}:${CATEGORY_ROW_COUNTS[category.categoryView]}`
        );
    }
    if (result.totals.rows !== EXPECTED_ROW_COUNT)
      throw new Error(
        `COMPARISON_TOTAL_ROW_COUNT_MISMATCH:${result.totals.rows}:${EXPECTED_ROW_COUNT}`
      );
  }
  const jsonFile = path.join(outputDirectory, "comparison.private.json");
  const markdownFile = path.join(outputDirectory, "comparison.md");
  const workbookFile = path.join(outputDirectory, "polizzenvergleich.xlsx");
  fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.writeFileSync(markdownFile, markdownResult(result), {
    encoding: "utf8",
    mode: 0o600,
  });
  await writeWorkbook(result, workbookFile);
  return { result, jsonFile, markdownFile, workbookFile };
}

module.exports = {
  CATEGORY_ORDER,
  buildComparisonResult,
  comparePackages,
  materializeAtomicFacts,
  summarizePackage,
  writeComparisonArtifacts,
};
