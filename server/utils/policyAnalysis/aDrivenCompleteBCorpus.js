const crypto = require("crypto");
const { buildClauseBoundaries } = require("./aDrivenCounterpartRetrieval");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

const A_DRIVEN_COMPLETE_B_CORPUS_CONTRACT_ID =
  "LF_A_DRIVEN_COMPLETE_B_CORPUS_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function corpusError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function sourceDocument(item) {
  const document = item?.document;
  const artifact = item?.artifact;
  if (
    !document?.uuid ||
    !Number.isInteger(document.position) ||
    document.position < 0 ||
    !/^[a-f0-9]{64}$/u.test(String(document.sha256 || "")) ||
    artifact?.fingerprint !== document.sha256 ||
    typeof artifact?.document?.pageContent !== "string" ||
    !Array.isArray(artifact?.document?.pageMap)
  )
    throw corpusError("LF_A_DRIVEN_COMPLETE_B_DOCUMENT_INVALID");
  return {
    uuid: document.uuid,
    sha256: document.sha256,
    pageContent: artifact.document.pageContent,
    pageContentSha256: sha256(artifact.document.pageContent),
    pageMap: artifact.document.pageMap,
  };
}

function buildADrivenCompleteBCorpus({ documents } = {}) {
  if (!Array.isArray(documents) || documents.length === 0)
    throw corpusError("LF_A_DRIVEN_COMPLETE_B_INPUT_INVALID");
  const ordered = [...documents].sort(
    (left, right) => left.document.position - right.document.position
  );
  if (
    new Set(ordered.map(({ document }) => document.uuid)).size !==
      ordered.length ||
    ordered.some(({ document }, index) => document.position !== index)
  )
    throw corpusError("LF_A_DRIVEN_COMPLETE_B_DOCUMENT_SET_INVALID");
  const documentRecords = [];
  const clauses = [];
  for (const item of ordered) {
    const source = sourceDocument(item);
    const documentClauses = buildClauseBoundaries(source).map((clause) => ({
      clauseBoundaryId: clause.clauseBoundaryId,
      documentUuid: source.uuid,
      documentSha256: source.sha256,
      documentPosition: item.document.position,
      documentRole: item.document.role || "OTHER",
      documentStatus: item.document.documentStatus || "ACTIVE",
      physicalPageNumber: clause.physicalPageNumber,
      documentStart: clause.documentStart,
      documentEnd: clause.documentEnd,
      exactText: clause.exactText,
      exactTextSha256: sha256(clause.exactText),
    }));
    documentRecords.push({
      documentUuid: source.uuid,
      documentSha256: source.sha256,
      documentPosition: item.document.position,
      documentRole: item.document.role || "OTHER",
      documentStatus: item.document.documentStatus || "ACTIVE",
      originalName: item.document.originalName || null,
      clauses: documentClauses.length,
    });
    clauses.push(...documentClauses);
  }
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_COMPLETE_B_CORPUS_CONTRACT_ID,
    documents: documentRecords,
    clauses,
    summary: {
      documents: documentRecords.length,
      clauses: clauses.length,
      pages: new Set(
        clauses.map(
          ({ documentUuid, physicalPageNumber }) =>
            `${documentUuid}:${physicalPageNumber}`
        )
      ).size,
      sourceCoverage: "ALL_EXTRACTED_B_CLAUSE_BOUNDARIES",
      customerNotFoundEligible: false,
    },
  };
  return {
    ...payload,
    corpusSha256: sha256(
      `${A_DRIVEN_COMPLETE_B_CORPUS_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function validateADrivenCompleteBCorpus(corpus, { searchPlan } = {}) {
  if (
    corpus?.contractId !== A_DRIVEN_COMPLETE_B_CORPUS_CONTRACT_ID ||
    !Array.isArray(corpus.documents) ||
    corpus.documents.length === 0 ||
    !Array.isArray(corpus.clauses) ||
    corpus.summary?.documents !== corpus.documents.length ||
    corpus.summary?.clauses !== corpus.clauses.length ||
    corpus.summary?.sourceCoverage !== "ALL_EXTRACTED_B_CLAUSE_BOUNDARIES" ||
    corpus.summary?.customerNotFoundEligible !== false ||
    !/^[a-f0-9]{64}$/u.test(String(corpus.corpusSha256 || ""))
  )
    throw corpusError("LF_A_DRIVEN_COMPLETE_B_CORPUS_INVALID");
  const { corpusSha256, ...payload } = corpus;
  if (
    corpusSha256 !==
    sha256(
      `${A_DRIVEN_COMPLETE_B_CORPUS_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    )
  )
    throw corpusError("LF_A_DRIVEN_COMPLETE_B_CORPUS_DIGEST_INVALID");
  const documents = new Map(
    corpus.documents.map((document) => [document.documentUuid, document])
  );
  if (
    documents.size !== corpus.documents.length ||
    corpus.clauses.some((clause) => {
      const document = documents.get(clause.documentUuid);
      return (
        !document ||
        document.documentSha256 !== clause.documentSha256 ||
        document.documentPosition !== clause.documentPosition ||
        !Number.isInteger(clause.physicalPageNumber) ||
        clause.physicalPageNumber < 1 ||
        !Number.isInteger(clause.documentStart) ||
        !Number.isInteger(clause.documentEnd) ||
        clause.documentEnd <= clause.documentStart ||
        typeof clause.exactText !== "string" ||
        !clause.exactText ||
        sha256(clause.exactText) !== clause.exactTextSha256
      );
    })
  )
    throw corpusError("LF_A_DRIVEN_COMPLETE_B_CORPUS_SOURCE_INVALID");
  if (searchPlan) {
    const expected = searchPlan.documents.map((document) => ({
      documentUuid: document.documentUuid,
      documentSha256: document.documentSha256,
      documentPosition: document.documentPosition,
    }));
    const observed = corpus.documents.map((document) => ({
      documentUuid: document.documentUuid,
      documentSha256: document.documentSha256,
      documentPosition: document.documentPosition,
    }));
    if (stableStringify(observed) !== stableStringify(expected))
      throw corpusError("LF_A_DRIVEN_COMPLETE_B_CORPUS_PLAN_MISMATCH");
  }
  return true;
}

module.exports = {
  A_DRIVEN_COMPLETE_B_CORPUS_CONTRACT_ID,
  buildADrivenCompleteBCorpus,
  validateADrivenCompleteBCorpus,
};
