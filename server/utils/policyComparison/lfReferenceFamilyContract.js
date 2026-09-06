const {
  SOURCE_BLOCK_LEDGER_CONTRACT_ID,
  buildSourceBlockLedger,
  validateSourceBlockLedger,
} = require("../policyAnalysis/sourceBlockLedger");

const LF_REFERENCE_FAMILY_CONTRACT = Object.freeze({
  schemaVersion: 1,
  contractId: "LF_IMMO_REFERENCE_FAMILY_STRUCTURE_V1",
  familyId: "LF_IMMO_EXKLUSIVSCHUTZ",
  semanticOracleId: "LF_IMMO_EXKLUSIVSCHUTZ_COMPLETE_2023_V1",
  expectedPhysicalPages: 31,
  expectedStructureDigestSha256:
    "87704c07900c9a0c760a95718e47ebe2fc157936fa8d047276fad9e9e92b7ca5",
  requiredNormalizedAnchors: Object.freeze([
    "lf immo exklusivschutz <NUMBER>",
    "a. besonderer teil",
    "b. allgemeiner teil",
    "<NUMBER>. feuerversicherung",
    "<NUMBER>. sturmversicherung",
    "<NUMBER>. leitungswasserversicherung",
    "<NUMBER>. glasbruch",
    "<NUMBER>. gebäude- und grundstückshaftpflichtversicherung",
    "<NUMBER>. ökoschutz",
  ]),
});

class LfReferenceProfileRequiredError extends Error {
  constructor(diagnostics) {
    super("NEUES_LF_PROFIL_ERFORDERLICH");
    this.name = "LfReferenceProfileRequiredError";
    this.code = "NEUES_LF_PROFIL_ERFORDERLICH";
    this.diagnostics = diagnostics;
  }
}

function sourceDeclaredVersion(ledger) {
  const titleBlock = ledger.blocks.find(({ exactText }) =>
    /LF\s+IMMO\s+EXKLUSIVSCHUTZ\s+\d{4}/iu.test(exactText)
  );
  return titleBlock?.exactText.match(/\b\d{4}\b/u)?.[0] || null;
}

function validateLfReferenceFamily({
  documentArtifact,
  ledger = buildSourceBlockLedger(documentArtifact),
  contract = LF_REFERENCE_FAMILY_CONTRACT,
} = {}) {
  validateSourceBlockLedger(ledger, documentArtifact);
  const normalizedTexts = new Set(
    ledger.blocks.map(({ exactText }) =>
      String(exactText || "")
        .normalize("NFKC")
        .replace(/\b\d[\d.,]*\b/gu, "<NUMBER>")
        .replace(/\s+/gu, " ")
        .trim()
        .toLocaleLowerCase("de-AT")
    )
  );
  const missingAnchors = contract.requiredNormalizedAnchors.filter(
    (anchor) => !normalizedTexts.has(String(anchor).toLocaleLowerCase("de-AT"))
  );
  const diagnostics = {
    schemaVersion: 1,
    contractId: contract.contractId,
    familyId: contract.familyId,
    sourceBlockLedgerContractId: SOURCE_BLOCK_LEDGER_CONTRACT_ID,
    documentFingerprint: ledger.sourceDocument.fingerprint,
    physicalPages: ledger.summary.pageCount,
    expectedPhysicalPages: contract.expectedPhysicalPages,
    structureDigestSha256: ledger.structureDigestSha256,
    expectedStructureDigestSha256: contract.expectedStructureDigestSha256,
    missingAnchors,
    sourceDeclaredVersion: sourceDeclaredVersion(ledger),
  };
  const accepted =
    diagnostics.physicalPages === diagnostics.expectedPhysicalPages &&
    diagnostics.structureDigestSha256 ===
      diagnostics.expectedStructureDigestSha256 &&
    missingAnchors.length === 0;
  if (!accepted) throw new LfReferenceProfileRequiredError(diagnostics);
  return {
    ...diagnostics,
    status: "SUPPORTED_LF_FAMILY_STRUCTURE",
    semanticOracleId: contract.semanticOracleId,
    versionStatus: diagnostics.sourceDeclaredVersion
      ? "SOURCE_DECLARED"
      : "UNRESOLVED",
  };
}

module.exports = {
  LF_REFERENCE_FAMILY_CONTRACT,
  LfReferenceProfileRequiredError,
  validateLfReferenceFamily,
};
