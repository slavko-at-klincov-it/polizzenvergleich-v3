const PACKAGE_REVIEW_AUDIT_CONTRACT_ID = "PACKAGE_REVIEW_BLOCKERS_V1";
const PACKAGE_REVIEW_AUDIT_SCHEMA_VERSION = 1;

const BLOCKER_CODE = Object.freeze({
  MISSING_REQUIRED_COMPONENT: "MISSING_REQUIRED_COMPONENT",
  UNKNOWN_COVERAGE_EFFECT: "UNKNOWN_COVERAGE_EFFECT",
  COVERAGE_EFFECT_NOT_DECISIVE: "COVERAGE_EFFECT_NOT_DECISIVE",
  FIELD_INCOMPLETE: "FIELD_INCOMPLETE",
  SCOPE_INCOMPLETE: "SCOPE_INCOMPLETE",
  SOURCE_BINDING_INCOMPLETE: "SOURCE_BINDING_INCOMPLETE",
  UNRESOLVED_CANDIDATE: "UNRESOLVED_CANDIDATE",
  MULTIPLE_ATOMS_SAME_COMPONENT: "MULTIPLE_ATOMS_SAME_COMPONENT",
  UNRESOLVED_DOCUMENT_PRECEDENCE: "UNRESOLVED_DOCUMENT_PRECEDENCE",
  CONFLICTING_COVERAGE: "CONFLICTING_COVERAGE",
  UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER: "UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER",
});

const SIGNAL_CODE = Object.freeze({
  PROPOSED_ONLY: "PROPOSED_ONLY",
  CONDITIONAL_APPLICABILITY: "CONDITIONAL_APPLICABILITY",
});

const LEVEL = Object.freeze({
  COMPONENT: "COMPONENT",
  REQUIREMENT: "REQUIREMENT",
  PACKAGE: "PACKAGE",
});

const NON_COVERAGE_FACT_ROLES = new Set([
  "CONDITION",
  "DEFINITION",
  "LIMIT",
  "DEDUCTIBLE",
  "DOCUMENT_STATUS",
]);
const DEFINITIVE_NARROW_SCOPE_EFFECTS = new Set([
  "INCLUDED",
  "EXCLUDED",
  "DEFINED",
  "CONDITIONAL",
]);
const DECISIVE_COVERAGE_EFFECTS = new Set(["INCLUDED", "EXCLUDED"]);

function auditError(code, details = []) {
  throw new Error([code, ...details].join(":"));
}

function strings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
}

function observedAtom(atom) {
  return {
    evidencePresence: String(atom?.evidencePresence || ""),
    coverageEffect: String(atom?.coverageEffect || ""),
    conflictState: String(atom?.conflictState || ""),
    requestedFieldStatus: String(atom?.requestedFieldStatus || ""),
    selectedScopePicture: String(atom?.selectedScopePicture || ""),
    scopePolicy: String(atom?.scopePolicy || ""),
    documentApplicability: String(atom?.documentApplicability || ""),
    documentRole: String(atom?.documentRole || ""),
    documentStatus: String(atom?.documentStatus || ""),
    selectedCandidateIds: strings(atom?.selectedCandidateIds),
    unresolvedCandidateIds: strings(atom?.unresolvedCandidateIds),
  };
}

function auditEntry({ code, side, level, categoryId, atom, documentUuids }) {
  return {
    code,
    side,
    level,
    requirementId: categoryId,
    componentId: atom?.componentId || null,
    factRole: atom?.factRole || null,
    documentUuids: strings(documentUuids || atom?.documentUuids),
    observed: atom ? observedAtom(atom) : null,
  };
}

function entryKey(entry) {
  return JSON.stringify(entry);
}

function canonicalEntries(entries) {
  const unique = new Map();
  for (const entry of entries) unique.set(entryKey(entry), entry);
  return [...unique.values()].sort((left, right) =>
    entryKey(left).localeCompare(entryKey(right))
  );
}

function comparisonAtomKey(atom) {
  return JSON.stringify({
    componentId: atom?.componentId,
    factRole: atom?.factRole,
    evidencePresence: atom?.evidencePresence,
    coverageEffect: atom?.coverageEffect,
    conflictState: atom?.conflictState,
    requestedFieldStatus: atom?.requestedFieldStatus,
    selectedScopePicture: atom?.selectedScopePicture,
    documentApplicability: atom?.documentApplicability,
    fields: atom?.fields || [],
  });
}

function validSource(atom) {
  return (
    Array.isArray(atom?.selectedCandidateIds) &&
    atom.selectedCandidateIds.length > 0 &&
    atom.selectedCandidateIds.every((candidateId) =>
      atom.sources?.some(
        (source) =>
          source.candidateId === candidateId &&
          Number.isInteger(source.physicalPageNumber) &&
          source.physicalPageNumber > 0 &&
          String(source.exactText || "").trim().length > 0
      )
    )
  );
}

function scopeComplete(atom) {
  if (atom?.selectedScopePicture !== "NARROW_ONLY") return true;
  if (atom?.scopePolicy === "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT")
    return DEFINITIVE_NARROW_SCOPE_EFFECTS.has(atom.coverageEffect);
  if (atom?.scopePolicy !== "MATCHING_SCOPE_INCLUDED_SUFFICIENT") return false;
  return NON_COVERAGE_FACT_ROLES.has(atom.factRole)
    ? ["DEFINED", "CONDITIONAL"].includes(atom.coverageEffect)
    : atom.coverageEffect === "INCLUDED";
}

function contributingAtoms({ categoryId, packageSummary, atoms }) {
  const relevant = (atoms || []).filter(
    (atom) => atom.requirementId === categoryId
  );
  const facts = packageSummary?.facts || [];
  const contributingDocuments = new Set(
    facts
      .filter(
        (fact) =>
          packageSummary.reviewStatus === "RANGFOLGE_PRÜFEN" ||
          packageSummary.reviewStatus === "WIDERSPRÜCHLICH" ||
          fact.reviewStatus !== "BELEGT"
      )
      .map(({ documentUuid }) => documentUuid)
  );
  if (contributingDocuments.size === 0) return relevant;
  return relevant.filter((atom) =>
    (atom.documentUuids || []).some((uuid) => contributingDocuments.has(uuid))
  );
}

function deriveSideAudit({ categoryId, side, packageSummary, atoms }) {
  if (packageSummary?.reviewStatus === "BELEGT")
    return { blockers: [], signals: [] };

  const relevant = contributingAtoms({ categoryId, packageSummary, atoms });
  const factDocumentUuids = strings(
    (packageSummary?.facts || [])
      .filter(
        (fact) =>
          packageSummary.reviewStatus === "RANGFOLGE_PRÜFEN" ||
          packageSummary.reviewStatus === "WIDERSPRÜCHLICH" ||
          fact.reviewStatus !== "BELEGT"
      )
      .map(({ documentUuid }) => documentUuid)
  );
  const documentUuids =
    factDocumentUuids.length > 0
      ? factDocumentUuids
      : strings(relevant.flatMap(({ documentUuids: uuids }) => uuids || []));
  const blockers = [];
  const signals = [];

  if (packageSummary?.reviewStatus === "RANGFOLGE_PRÜFEN")
    blockers.push(
      auditEntry({
        code: BLOCKER_CODE.UNRESOLVED_DOCUMENT_PRECEDENCE,
        side,
        level: LEVEL.PACKAGE,
        categoryId,
        documentUuids,
      })
    );
  if (packageSummary?.reviewStatus === "WIDERSPRÜCHLICH")
    blockers.push(
      auditEntry({
        code: BLOCKER_CODE.CONFLICTING_COVERAGE,
        side,
        level: LEVEL.PACKAGE,
        categoryId,
        documentUuids,
      })
    );

  const satisfactionPolicy = relevant[0]?.componentSatisfactionPolicy || "ALL";
  const anyAlternativeFound =
    satisfactionPolicy === "ANY" &&
    relevant.some(({ evidencePresence }) => evidencePresence === "FOUND");

  const fieldStatuses = new Set(
    relevant.map(({ requestedFieldStatus }) => requestedFieldStatus)
  );
  if (
    [...fieldStatuses].some(
      (status) => !["COMPLETE", "NOT_REQUIRED"].includes(status)
    )
  )
    blockers.push(
      auditEntry({
        code: BLOCKER_CODE.FIELD_INCOMPLETE,
        side,
        level: LEVEL.REQUIREMENT,
        categoryId,
        documentUuids,
      })
    );

  const foundByComponent = new Map();
  for (const atom of relevant) {
    if (atom.documentApplicability === "PROPOSED_ONLY")
      signals.push(
        auditEntry({
          code: SIGNAL_CODE.PROPOSED_ONLY,
          side,
          level: LEVEL.COMPONENT,
          categoryId,
          atom,
        })
      );
    if (atom.documentApplicability === "CONDITIONAL")
      signals.push(
        auditEntry({
          code: SIGNAL_CODE.CONDITIONAL_APPLICABILITY,
          side,
          level: LEVEL.COMPONENT,
          categoryId,
          atom,
        })
      );

    if ((atom.unresolvedCandidateIds || []).length > 0) {
      blockers.push(
        auditEntry({
          code: BLOCKER_CODE.UNRESOLVED_CANDIDATE,
          side,
          level: LEVEL.COMPONENT,
          categoryId,
          atom,
        })
      );
      continue;
    }
    if (atom.evidencePresence !== "FOUND") {
      if (satisfactionPolicy === "ALL" && !anyAlternativeFound)
        blockers.push(
          auditEntry({
            code: BLOCKER_CODE.MISSING_REQUIRED_COMPONENT,
            side,
            level: LEVEL.COMPONENT,
            categoryId,
            atom,
          })
        );
      continue;
    }

    if (!foundByComponent.has(atom.componentId))
      foundByComponent.set(atom.componentId, []);
    foundByComponent.get(atom.componentId).push(atom);

    if (atom.conflictState === "UNRESOLVED_PRECEDENCE")
      blockers.push(
        auditEntry({
          code: BLOCKER_CODE.UNRESOLVED_DOCUMENT_PRECEDENCE,
          side,
          level: LEVEL.COMPONENT,
          categoryId,
          atom,
        })
      );
    if (atom.conflictState === "ACTIVE_SAME_SCOPE")
      blockers.push(
        auditEntry({
          code: BLOCKER_CODE.CONFLICTING_COVERAGE,
          side,
          level: LEVEL.COMPONENT,
          categoryId,
          atom,
        })
      );
    if (atom.coverageEffect === "UNKNOWN")
      blockers.push(
        auditEntry({
          code: BLOCKER_CODE.UNKNOWN_COVERAGE_EFFECT,
          side,
          level: LEVEL.COMPONENT,
          categoryId,
          atom,
        })
      );
    else if (
      !NON_COVERAGE_FACT_ROLES.has(atom.factRole) &&
      !DECISIVE_COVERAGE_EFFECTS.has(atom.coverageEffect)
    )
      blockers.push(
        auditEntry({
          code: BLOCKER_CODE.COVERAGE_EFFECT_NOT_DECISIVE,
          side,
          level: LEVEL.COMPONENT,
          categoryId,
          atom,
        })
      );
    if (!scopeComplete(atom))
      blockers.push(
        auditEntry({
          code: BLOCKER_CODE.SCOPE_INCOMPLETE,
          side,
          level: LEVEL.COMPONENT,
          categoryId,
          atom,
        })
      );
    if (!validSource(atom))
      blockers.push(
        auditEntry({
          code: BLOCKER_CODE.SOURCE_BINDING_INCOMPLETE,
          side,
          level: LEVEL.COMPONENT,
          categoryId,
          atom,
        })
      );
  }

  for (const componentAtoms of foundByComponent.values()) {
    if (new Set(componentAtoms.map(comparisonAtomKey)).size < 2) continue;
    blockers.push(
      auditEntry({
        code: BLOCKER_CODE.MULTIPLE_ATOMS_SAME_COMPONENT,
        side,
        level: LEVEL.COMPONENT,
        categoryId,
        atom: componentAtoms[0],
        documentUuids: componentAtoms.flatMap(
          ({ documentUuids: uuids }) => uuids || []
        ),
      })
    );
  }

  if (blockers.length === 0)
    blockers.push(
      auditEntry({
        code: BLOCKER_CODE.UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER,
        side,
        level: LEVEL.PACKAGE,
        categoryId,
        documentUuids,
      })
    );

  return {
    blockers: canonicalEntries(blockers),
    signals: canonicalEntries(signals),
  };
}

function derivePackageReviewAudit({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
}) {
  const a = deriveSideAudit({
    categoryId,
    side: "A",
    packageSummary: packageA,
    atoms: atomsA,
  });
  const b = deriveSideAudit({
    categoryId,
    side: "B",
    packageSummary: packageB,
    atoms: atomsB,
  });
  const audit = {
    schemaVersion: PACKAGE_REVIEW_AUDIT_SCHEMA_VERSION,
    contractId: PACKAGE_REVIEW_AUDIT_CONTRACT_ID,
    packageStatuses: Object.freeze({
      A: packageA?.reviewStatus || null,
      B: packageB?.reviewStatus || null,
    }),
    blockers: Object.freeze(canonicalEntries([...a.blockers, ...b.blockers])),
    signals: Object.freeze(canonicalEntries([...a.signals, ...b.signals])),
  };
  validatePackageReviewAudit(audit, {
    categoryId,
    packageAStatus: packageA?.reviewStatus,
    packageBStatus: packageB?.reviewStatus,
  });
  return Object.freeze(audit);
}

function validateEntries(
  entries,
  { categoryId, allowedCodes, blockedSides, allowedDocumentUuidsBySide }
) {
  if (!Array.isArray(entries))
    auditError("PACKAGE_REVIEW_AUDIT_ARRAY_REQUIRED");
  const canonical = canonicalEntries(entries);
  if (JSON.stringify(entries) !== JSON.stringify(canonical))
    auditError("PACKAGE_REVIEW_AUDIT_ENTRIES_NOT_CANONICAL");
  for (const entry of entries) {
    if (!allowedCodes.has(entry?.code))
      auditError("PACKAGE_REVIEW_AUDIT_CODE_INVALID", [entry?.code]);
    if (!blockedSides.has(entry?.side))
      auditError("PACKAGE_REVIEW_AUDIT_SIDE_INVALID", [entry?.side]);
    if (!Object.values(LEVEL).includes(entry?.level))
      auditError("PACKAGE_REVIEW_AUDIT_LEVEL_INVALID", [entry?.level]);
    if (entry?.requirementId !== categoryId)
      auditError("PACKAGE_REVIEW_AUDIT_REQUIREMENT_MISMATCH", [
        entry?.requirementId,
        categoryId,
      ]);
    if (
      !Array.isArray(entry?.documentUuids) ||
      entry.documentUuids.length === 0 ||
      entry.documentUuids.some((uuid) => !String(uuid || "").trim()) ||
      JSON.stringify(entry.documentUuids) !==
        JSON.stringify(strings(entry.documentUuids))
    )
      auditError("PACKAGE_REVIEW_AUDIT_DOCUMENT_UUIDS_INVALID");
    const allowedDocumentUuids = allowedDocumentUuidsBySide?.[entry.side];
    if (
      allowedDocumentUuids &&
      entry.documentUuids.some((uuid) => !allowedDocumentUuids.has(uuid))
    )
      auditError("PACKAGE_REVIEW_AUDIT_DOCUMENT_UUID_UNKNOWN", [entry.side]);
    if (entry.level === LEVEL.COMPONENT && !entry.componentId)
      auditError("PACKAGE_REVIEW_AUDIT_COMPONENT_REQUIRED");
    if (entry.level !== LEVEL.COMPONENT && entry.componentId !== null)
      auditError("PACKAGE_REVIEW_AUDIT_COMPONENT_FORBIDDEN");
  }
}

function validatePackageReviewAudit(
  audit,
  { categoryId, packageAStatus, packageBStatus, allowedDocumentUuidsBySide }
) {
  if (audit?.schemaVersion !== PACKAGE_REVIEW_AUDIT_SCHEMA_VERSION)
    auditError("PACKAGE_REVIEW_AUDIT_SCHEMA_MISMATCH", [audit?.schemaVersion]);
  if (audit?.contractId !== PACKAGE_REVIEW_AUDIT_CONTRACT_ID)
    auditError("PACKAGE_REVIEW_AUDIT_CONTRACT_MISMATCH", [audit?.contractId]);
  if (
    audit?.packageStatuses?.A !== packageAStatus ||
    audit?.packageStatuses?.B !== packageBStatus
  )
    auditError("PACKAGE_REVIEW_AUDIT_STATUS_MISMATCH");
  const blockedSides = new Set(
    [
      ["A", packageAStatus],
      ["B", packageBStatus],
    ]
      .filter(([, status]) => status !== "BELEGT")
      .map(([side]) => side)
  );
  validateEntries(audit.blockers, {
    categoryId,
    allowedCodes: new Set(Object.values(BLOCKER_CODE)),
    blockedSides,
    allowedDocumentUuidsBySide,
  });
  validateEntries(audit.signals, {
    categoryId,
    allowedCodes: new Set(Object.values(SIGNAL_CODE)),
    blockedSides,
    allowedDocumentUuidsBySide,
  });
  for (const side of blockedSides) {
    if (!audit.blockers.some((blocker) => blocker.side === side))
      auditError("PACKAGE_REVIEW_AUDIT_BLOCKED_SIDE_MISSING", [side]);
  }
  return audit;
}

module.exports = {
  BLOCKER_CODE,
  PACKAGE_REVIEW_AUDIT_CONTRACT_ID,
  PACKAGE_REVIEW_AUDIT_SCHEMA_VERSION,
  SIGNAL_CODE,
  derivePackageReviewAudit,
  validatePackageReviewAudit,
};
