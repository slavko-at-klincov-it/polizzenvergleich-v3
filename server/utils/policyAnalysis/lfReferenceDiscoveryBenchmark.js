const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  LF_CUSTOMER_SEARCH_STATUS,
  referenceCustomerSearchStatus,
} = require("../policyComparison/referenceCustomerPresentation");
const {
  buildPageAwareRetrievalChunks,
  cosineSimilarity,
} = require("./hybridCandidateFallback");
const {
  bm25Index,
  normalize,
  rankLexicalCandidates,
  tokens,
} = require("./counterpartRetrievalPrimitives");

const BENCHMARK_SCHEMA_VERSION = 1;
const BENCHMARK_CONTRACT_ID = "LF_REFERENCE_DISCOVERY_BENCHMARK_V1";

function benchmarkError(code, detail = "") {
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

function readRegular(file, code, fsImpl = fs) {
  if (!fsImpl.existsSync(file)) throw benchmarkError(`${code}_MISSING`, file);
  const stat = fsImpl.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw benchmarkError(`${code}_INVALID`, file);
  return fsImpl.readFileSync(file);
}

function readJson(file, code, fsImpl = fs) {
  const bytes = readRegular(file, code, fsImpl);
  try {
    return { bytes, value: JSON.parse(bytes.toString("utf8")) };
  } catch {
    throw benchmarkError(`${code}_JSON_INVALID`, file);
  }
}

function componentQuery({ row, requirement, component }) {
  const conceptTerms = (component.conceptSearches || []).flatMap((search) => [
    search.label,
    ...(search.requiredGroups || []).flatMap(({ prefixes }) => prefixes || []),
  ]);
  const terms = [
    row.categoryName,
    row.subcategoryName,
    requirement.label,
    component.label,
    ...(component.aliases || []),
    ...conceptTerms,
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());
  const uniqueTerms = [...new Set(terms)];
  const query = uniqueTerms.join("; ").slice(0, 4_000);
  const phrases = uniqueTerms
    .map(normalize)
    .filter((value) => value.length >= 8 && value.split(" ").length >= 2);
  return {
    query,
    querySha256: sha256(query),
    queryTokens: [...new Set(tokens(query))],
    phrases: [...new Set(phrases)],
  };
}

function analysisView(row) {
  const match = String(row?.analysisRowId || "").match(/^(LR\d{2})-/u);
  if (!match)
    throw benchmarkError(
      "LF_DISCOVERY_ANALYSIS_ROW_ID_INVALID",
      row?.analysisRowId
    );
  return match[1];
}

function documentDirectoryName(document) {
  return `B-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`;
}

function componentDefinition(component) {
  return {
    id: component.id,
    label: component.label,
    factRole: component.factRole,
    contextMode: component.contextMode,
    aliases: component.aliases || [],
    conceptSearches: component.conceptSearches || [],
  };
}

function validateCurrentOccurrence({ occurrence, document, targetKey }) {
  if (
    !Number.isInteger(occurrence.pageNumber) ||
    !Number.isInteger(occurrence.physicalPageNumber) ||
    !Number.isInteger(occurrence.documentStart) ||
    !Number.isInteger(occurrence.documentEnd) ||
    occurrence.documentEnd <= occurrence.documentStart ||
    typeof occurrence.exactText !== "string" ||
    !occurrence.exactText
  )
    throw benchmarkError("LF_DISCOVERY_CURRENT_SPAN_INVALID", targetKey);
  const page = document.pageMap.find(
    ({ pageNumber }) => pageNumber === occurrence.pageNumber
  );
  if (
    !page ||
    occurrence.physicalPageNumber !== occurrence.pageNumber ||
    occurrence.documentStart < page.start ||
    occurrence.documentEnd > page.end ||
    document.pageContent.slice(
      occurrence.documentStart,
      occurrence.documentEnd
    ) !== occurrence.exactText
  )
    throw benchmarkError("LF_DISCOVERY_CURRENT_SOURCE_MISMATCH", targetKey);
}

/**
 * Reads one completed LF A->B run and materializes the immutable benchmark
 * population. Side effects: filesystem reads only. Role: source + validate.
 */
function inventoryLfReferenceRun({ runRoot, fsImpl = fs }) {
  const root = path.resolve(runRoot);
  if (!fsImpl.existsSync(root) || !fsImpl.lstatSync(root).isDirectory())
    throw benchmarkError("LF_DISCOVERY_RUN_ROOT_INVALID", root);
  const files = {
    input: path.join(root, "input-manifest.private.json"),
    runContract: path.join(root, "run-contract.private.json"),
    comparison: path.join(root, "result", "comparison.private.json"),
    resultArtifacts: path.join(
      root,
      "result",
      "artifact-set-manifest.private.json"
    ),
    semanticManifest: path.join(
      root,
      "reference-template",
      "semantic-requirement-manifest.private.json"
    ),
    templateArtifacts: path.join(
      root,
      "reference-template",
      "artifact-set-manifest.private.json"
    ),
  };
  const reads = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [
      key,
      readJson(file, `LF_DISCOVERY_${key.toUpperCase()}`, fsImpl),
    ])
  );
  const input = reads.input.value;
  const runContract = reads.runContract.value;
  const comparison = reads.comparison.value;
  const resultArtifacts = reads.resultArtifacts.value;
  const semanticManifest = reads.semanticManifest.value;
  const templateArtifacts = reads.templateArtifacts.value;
  const comparisonArtifact = resultArtifacts?.artifacts?.find(
    ({ filename }) => filename === "comparison.private.json"
  );
  const inputA = (input.documents || []).filter(({ side }) => side === "A");
  const inputB = (input.documents || [])
    .filter(({ side }) => side === "B")
    .sort((left, right) => left.position - right.position);
  if (
    comparison?.contractId !== "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1" ||
    comparison?.comparisonMode !== "LF_IMMO_REFERENCE_A_TO_B_V1" ||
    input?.comparisonMode !== comparison.comparisonMode ||
    runContract?.comparisonMode !== comparison.comparisonMode ||
    inputA.length !== 1 ||
    inputB.length < 1 ||
    inputB.length > 9 ||
    runContract?.productProfile?.noEmbeddings !== true ||
    comparisonArtifact?.sha256 !== sha256(reads.comparison.bytes) ||
    templateArtifacts?.semanticRequirementManifestSha256 !==
      semanticManifest?.manifestSha256 ||
    comparison.template?.semanticRequirementManifestSha256 !==
      semanticManifest?.manifestSha256
  )
    throw benchmarkError("LF_DISCOVERY_BASE_CONTRACT_INVALID");
  for (const document of input.documents || []) {
    const runDocument = (runContract.documents || []).find(
      ({ uuid }) => uuid === document.uuid
    );
    const resultDocument = (comparison.documents || []).find(
      ({ uuid }) => uuid === document.uuid
    );
    if (
      !runDocument ||
      !resultDocument ||
      runDocument.sha256 !== document.sha256 ||
      resultDocument.sha256 !== document.sha256 ||
      runDocument.side !== document.side ||
      resultDocument.side !== document.side
    )
      throw benchmarkError(
        "LF_DISCOVERY_DOCUMENT_IDENTITY_MISMATCH",
        document.uuid
      );
  }

  const allRows = comparison.categories.flatMap((category) =>
    (category.rows || []).map((row) => ({
      ...row,
      publicCategoryView: category.categoryView,
      analysisCategoryView: analysisView(row),
    }))
  );
  const publicNotFoundRows = allRows.filter(
    (row) =>
      referenceCustomerSearchStatus(row) === LF_CUSTOMER_SEARCH_STATUS.NOT_FOUND
  );
  const publicFoundRows = allRows.filter(
    (row) =>
      referenceCustomerSearchStatus(row) === LF_CUSTOMER_SEARCH_STATUS.FOUND
  );
  const referenceUnclearRows = publicNotFoundRows.filter(
    ({ pointDecision }) => pointDecision?.outcome === "REFERENZZEILE_UNKLAR"
  );
  const notFoundSideBRows = publicNotFoundRows.filter(
    ({ pointDecision }) => pointDecision?.outcome !== "REFERENZZEILE_UNKLAR"
  );
  if (
    new Set(allRows.map(({ categoryId }) => categoryId)).size !== allRows.length
  )
    throw benchmarkError("LF_DISCOVERY_PUBLIC_ROW_ID_DUPLICATE");

  const documents = inputB.map((inputDocument) => {
    const directory = path.join(
      root,
      "documents",
      documentDirectoryName(inputDocument)
    );
    if (
      !fsImpl.existsSync(directory) ||
      !fsImpl.lstatSync(directory).isDirectory()
    )
      throw benchmarkError(
        "LF_DISCOVERY_DOCUMENT_DIRECTORY_INVALID",
        inputDocument.uuid
      );
    const artifactFile = path.join(directory, "document.private.json");
    const artifactRead = readJson(
      artifactFile,
      "LF_DISCOVERY_DOCUMENT_ARTIFACT",
      fsImpl
    );
    const artifact = artifactRead.value;
    if (
      artifact?.schemaVersion !== 1 ||
      artifact?.fingerprint !== inputDocument.sha256 ||
      artifact?.document?.sourceDocumentId !== inputDocument.sha256 ||
      artifact?.document?.pdfExtraction?.complete !== true
    )
      throw benchmarkError(
        "LF_DISCOVERY_DOCUMENT_ARTIFACT_INVALID",
        inputDocument.uuid
      );
    return {
      input: inputDocument,
      directory,
      artifactFile,
      artifactSha256: sha256(artifactRead.bytes),
      artifact,
      worksheetReads: new Map(),
    };
  });

  const targets = new Map();
  const cells = [];
  const rowOccurrenceCounts = new Map(
    allRows.map(({ categoryId }) => [categoryId, 0])
  );
  for (const row of allRows) {
    for (const documentRun of documents) {
      const worksheetFile = path.join(
        documentRun.directory,
        row.analysisCategoryView,
        "worksheet.private.json"
      );
      let worksheetRead = documentRun.worksheetReads.get(
        row.analysisCategoryView
      );
      if (!worksheetRead) {
        worksheetRead = readJson(
          worksheetFile,
          "LF_DISCOVERY_WORKSHEET",
          fsImpl
        );
        if (
          worksheetRead.value?.candidateOnly !== true ||
          worksheetRead.value?.catalog?.categoryView !==
            row.analysisCategoryView ||
          worksheetRead.value?.document?.fingerprint !==
            documentRun.input.sha256
        )
          throw benchmarkError(
            "LF_DISCOVERY_WORKSHEET_INVALID",
            `${documentRun.input.uuid}:${row.analysisCategoryView}`
          );
        documentRun.worksheetReads.set(row.analysisCategoryView, {
          ...worksheetRead,
          file: worksheetFile,
          sha256: sha256(worksheetRead.bytes),
        });
      }
      const requirement = worksheetRead.value.requirements.find(
        ({ id }) => id === row.analysisRowId
      );
      if (!requirement || !Array.isArray(requirement.components))
        throw benchmarkError(
          "LF_DISCOVERY_REQUIREMENT_MISSING",
          `${documentRun.input.uuid}:${row.analysisRowId}`
        );
      for (const component of requirement.components) {
        const targetKey = `${row.analysisRowId}:${component.id}`;
        const definition = componentDefinition(component);
        const existingTarget = targets.get(targetKey);
        if (
          existingTarget &&
          canonicalJson(existingTarget.component) !== canonicalJson(definition)
        )
          throw benchmarkError(
            "LF_DISCOVERY_COMPONENT_DEFINITION_DRIFT",
            targetKey
          );
        if (!existingTarget) {
          const query = componentQuery({ row, requirement, component });
          targets.set(targetKey, {
            targetKey,
            publicRowId: row.categoryId,
            analysisRowId: row.analysisRowId,
            categoryView: row.analysisCategoryView,
            requirementLabel: requirement.label,
            component: definition,
            ...query,
          });
        }
        if (
          !Array.isArray(component.occurrences) ||
          component.occurrenceCount !== component.occurrences.length ||
          !Number.isInteger(component.occurrenceCount)
        )
          throw benchmarkError(
            "LF_DISCOVERY_CURRENT_COUNT_INVALID",
            `${documentRun.input.uuid}:${targetKey}`
          );
        for (const occurrence of component.occurrences)
          validateCurrentOccurrence({
            occurrence,
            document: documentRun.artifact.document,
            targetKey,
          });
        rowOccurrenceCounts.set(
          row.categoryId,
          rowOccurrenceCounts.get(row.categoryId) + component.occurrenceCount
        );
        cells.push({
          cellKey: `${documentRun.input.uuid}:${targetKey}`,
          documentUuid: documentRun.input.uuid,
          documentPosition: documentRun.input.position,
          documentName: documentRun.input.originalName,
          documentSha256: documentRun.input.sha256,
          targetKey,
          publicRowId: row.categoryId,
          analysisRowId: row.analysisRowId,
          componentId: component.id,
          currentCandidateCount: component.occurrenceCount,
          currentOccurrences: component.occurrences,
        });
      }
    }
  }
  const allPureNullRows = allRows.filter(
    ({ categoryId }) => rowOccurrenceCounts.get(categoryId) === 0
  );
  const allRowsWithCurrentCandidates = allRows.filter(
    ({ categoryId }) => rowOccurrenceCounts.get(categoryId) > 0
  );
  const pureNullRows = notFoundSideBRows.filter(
    ({ categoryId }) => rowOccurrenceCounts.get(categoryId) === 0
  );
  const rowsWithCurrentCandidates = notFoundSideBRows.filter(
    ({ categoryId }) => rowOccurrenceCounts.get(categoryId) > 0
  );
  const worksheetBindings = documents.flatMap((documentRun) =>
    [...documentRun.worksheetReads.entries()].map(
      ([categoryView, worksheet]) => ({
        documentUuid: documentRun.input.uuid,
        categoryView,
        path: worksheet.file,
        sha256: worksheet.sha256,
      })
    )
  );
  const summary = {
    allReferenceRows: allRows.length,
    publicFoundRows: publicFoundRows.length,
    publicNotFoundRows: publicNotFoundRows.length,
    referenceUnclearRows: referenceUnclearRows.length,
    notFoundSideBRows: notFoundSideBRows.length,
    pureNullRows: pureNullRows.length,
    rowsWithCurrentCandidates: rowsWithCurrentCandidates.length,
    allPureNullRows: allPureNullRows.length,
    allRowsWithCurrentCandidates: allRowsWithCurrentCandidates.length,
    bDocumentCount: documents.length,
    uniqueComponentTargets: targets.size,
    componentDocumentCells: cells.length,
    currentNullCells: cells.filter(
      ({ currentCandidateCount }) => currentCandidateCount === 0
    ).length,
    currentPositiveCells: cells.filter(
      ({ currentCandidateCount }) => currentCandidateCount > 0
    ).length,
    currentOccurrenceCount: cells.reduce(
      (sum, { currentCandidateCount }) => sum + currentCandidateCount,
      0
    ),
  };
  return {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    contractId: BENCHMARK_CONTRACT_ID,
    runRoot: root,
    sourceBindings: {
      files: Object.fromEntries(
        Object.entries(files).map(([key, file]) => [
          key,
          { path: file, sha256: sha256(reads[key].bytes) },
        ])
      ),
      worksheets: worksheetBindings,
      runReleaseId: runContract.releaseId,
      runSignature: comparison.runSignature,
      semanticRequirementManifestSha256: semanticManifest.manifestSha256,
    },
    summary,
    rowSets: {
      publicFound: publicFoundRows.map(({ categoryId }) => categoryId),
      publicNotFound: publicNotFoundRows.map(({ categoryId }) => categoryId),
      referenceUnclear: referenceUnclearRows.map(
        ({ categoryId }) => categoryId
      ),
      pureNull: pureNullRows.map(({ categoryId }) => categoryId),
      withCurrentCandidates: rowsWithCurrentCandidates.map(
        ({ categoryId }) => categoryId
      ),
      allPureNull: allPureNullRows.map(({ categoryId }) => categoryId),
      allWithCurrentCandidates: allRowsWithCurrentCandidates.map(
        ({ categoryId }) => categoryId
      ),
    },
    targets: [...targets.values()].sort((left, right) =>
      left.targetKey.localeCompare(right.targetKey)
    ),
    cells,
    documents,
  };
}

function sourceSpan({
  document,
  pageNumber,
  documentStart,
  documentEnd,
  text,
}) {
  const page = document.pageMap.find(
    (candidate) => candidate.pageNumber === pageNumber
  );
  if (
    !page ||
    documentStart < page.start ||
    documentEnd > page.end ||
    documentEnd <= documentStart ||
    document.pageContent.slice(documentStart, documentEnd) !== text
  )
    throw benchmarkError("LF_DISCOVERY_SOURCE_SPAN_INVALID");
  return {
    physicalPageNumber: pageNumber,
    pageStart: documentStart - page.start,
    pageEnd: documentEnd - page.start,
    documentStart,
    documentEnd,
    exactText: text,
    exactTextSha256: sha256(text),
  };
}

function buildStructuralSpans(document, { maximumCharacters = 1_200 } = {}) {
  const units = new Map();
  for (const page of document.pageMap) {
    const pageText = document.pageContent.slice(page.start, page.end);
    const lines = [...pageText.matchAll(/[^\r\n]+/gu)]
      .map((match) => {
        let start = match.index;
        let end = start + match[0].length;
        while (start < end && /\s/u.test(pageText[start])) start += 1;
        while (end > start && /\s/u.test(pageText[end - 1])) end -= 1;
        return {
          start,
          end,
          text: pageText.slice(start, end),
        };
      })
      .filter(
        ({ text }) => text && !/^\[DOCUMENT_PAGE\s+\d+\]$/u.test(text.trim())
      );
    for (let index = 0; index < lines.length; index += 1) {
      for (let width = 1; width <= 3; width += 1) {
        const endLine = lines[index + width - 1];
        if (!endLine) break;
        const start = lines[index].start;
        const end = endLine.end;
        if (end - start > maximumCharacters) break;
        const text = pageText.slice(start, end);
        const span = sourceSpan({
          document,
          pageNumber: page.pageNumber,
          documentStart: page.start + start,
          documentEnd: page.start + end,
          text,
        });
        const firstLine = lines[index].text;
        const structuralKinds = [];
        if (/^\s*(?:[-–—•▪]|\d+[.)]|[A-Z][.)])\s+/u.test(firstLine))
          structuralKinds.push("LIST_ITEM");
        if (
          firstLine.length <= 140 &&
          (!/[.!?]$/u.test(firstLine) || /:$/u.test(firstLine))
        )
          structuralKinds.push("HEADING_OR_LABEL");
        if (/\s{2,}|\t/u.test(firstLine)) structuralKinds.push("TABLE_ROW");
        const id = `structure-span:${sha256(
          [
            document.sourceDocumentId || document.id,
            page.pageNumber,
            span.documentStart,
            span.documentEnd,
          ].join(":")
        )}`;
        units.set(id, {
          id,
          ...span,
          structuralKinds,
          normalizedText: normalize(text),
          tokenList: tokens(text),
        });
      }
    }
  }
  return [...units.values()].sort(
    (left, right) =>
      left.documentStart - right.documentStart ||
      left.documentEnd - right.documentEnd
  );
}

async function prepareDocumentCandidatePools({
  document,
  chunkSize = 3_000,
  chunkOverlap = 250,
}) {
  const navigationChunks = await buildPageAwareRetrievalChunks({
    document,
    chunkSize,
    chunkOverlap,
  });
  const lexicalCandidates = navigationChunks.map((chunk) => ({
    ...chunk,
    ...sourceSpan({
      document,
      pageNumber: chunk.pageNumber,
      documentStart: chunk.documentStart,
      documentEnd: chunk.documentEnd,
      text: chunk.text,
    }),
    normalizedText: normalize(chunk.text),
    tokenList: tokens(chunk.text),
  }));
  const structuralCandidates = buildStructuralSpans(document);
  return {
    navigationChunks,
    lexicalCandidates,
    structuralCandidates,
    lexicalIndex: bm25Index(lexicalCandidates),
    structuralIndex: bm25Index(structuralCandidates),
  };
}

function occurrenceCandidate(occurrence) {
  return {
    id: occurrence.candidateId,
    physicalPageNumber: occurrence.physicalPageNumber,
    pageStart: occurrence.pageStart,
    pageEnd: occurrence.pageEnd,
    documentStart: occurrence.documentStart,
    documentEnd: occurrence.documentEnd,
    exactText: occurrence.exactText,
    exactTextSha256: sha256(occurrence.exactText),
    rank: null,
    score: null,
    discoveryMethod: occurrence.discoveryMethod,
  };
}

function normalizedChannelCandidate(candidate, channel) {
  return {
    candidateId:
      candidate.id ||
      `benchmark-candidate:${sha256(
        [
          candidate.physicalPageNumber,
          candidate.documentStart,
          candidate.documentEnd,
        ].join(":")
      )}`,
    source: {
      physicalPageNumber: candidate.physicalPageNumber,
      pageStart: candidate.pageStart,
      pageEnd: candidate.pageEnd,
      documentStart: candidate.documentStart,
      documentEnd: candidate.documentEnd,
      exactText: candidate.exactText || candidate.text,
      exactTextSha256:
        candidate.exactTextSha256 ||
        sha256(candidate.exactText || candidate.text),
    },
    trace: {
      channel,
      rank: candidate.rank,
      score: candidate.score,
      retrievalId: candidate.id || null,
      discoveryMethod: candidate.discoveryMethod || null,
      matchedTokens: candidate.matchedTokens || [],
      phraseHits: candidate.phraseHits || [],
      structuralKinds: candidate.structuralKinds || [],
    },
  };
}

function fuseCandidateChannels(channels, identity) {
  const identityParts = [
    identity?.analysisRowId,
    identity?.componentId,
    identity?.documentUuid,
    identity?.documentPosition,
    identity?.documentFingerprint,
  ];
  if (
    identityParts.some(
      (value) =>
        (typeof value !== "string" && !Number.isInteger(value)) || value === ""
    )
  )
    throw benchmarkError("LF_DISCOVERY_UNION_IDENTITY_INVALID");
  const fused = new Map();
  for (const [channel, candidates] of Object.entries(channels)) {
    for (const [candidateIndex, candidate] of candidates.entries()) {
      const normalizedCandidate = normalizedChannelCandidate(
        candidate,
        channel
      );
      if (!Number.isInteger(normalizedCandidate.trace.rank))
        normalizedCandidate.trace.rank = candidateIndex + 1;
      const key = [
        normalizedCandidate.source.physicalPageNumber,
        normalizedCandidate.source.documentStart,
        normalizedCandidate.source.documentEnd,
      ].join(":");
      if (!fused.has(key))
        fused.set(key, {
          unionCandidateId: `lf-discovery-union:${sha256(
            [...identityParts, key].join(":")
          )}`,
          source: normalizedCandidate.source,
          channelTraces: [],
        });
      fused.get(key).channelTraces.push(normalizedCandidate.trace);
    }
  }
  return [...fused.values()]
    .map((candidate) => {
      const channelTraces = candidate.channelTraces.sort((left, right) =>
        left.channel.localeCompare(right.channel)
      );
      return {
        ...candidate,
        channelTraces,
        fusion: {
          method: "CHANNEL_RECIPROCAL_RANK_SUM_K60",
          score: Number(
            channelTraces
              .reduce((sum, trace) => sum + 1 / (60 + trace.rank), 0)
              .toFixed(10)
          ),
          channelCount: channelTraces.length,
          bestRank: Math.min(...channelTraces.map(({ rank }) => rank)),
        },
      };
    })
    .sort(
      (left, right) =>
        right.fusion.score - left.fusion.score ||
        right.fusion.channelCount - left.fusion.channelCount ||
        left.fusion.bestRank - right.fusion.bestRank ||
        left.source.physicalPageNumber - right.source.physicalPageNumber ||
        left.source.documentStart - right.source.documentStart ||
        left.source.documentEnd - right.source.documentEnd
    )
    .map((candidate, index) => ({
      ...candidate,
      unionRank: index + 1,
    }));
}

function rankEmbeddingCandidates({
  target,
  targetVector,
  candidates,
  candidateVectors,
  topK = 3,
  minimumScore = -1,
}) {
  if (candidates.length !== candidateVectors.length)
    throw benchmarkError("LF_DISCOVERY_EMBEDDING_VECTOR_COUNT_MISMATCH");
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      score: cosineSimilarity(targetVector, candidateVectors[index]),
    }))
    .filter(({ score }) => score >= minimumScore)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.documentStart - right.documentStart ||
        left.documentEnd - right.documentEnd
    )
    .slice(0, topK)
    .map((candidate, rank) => ({
      ...candidate,
      rank: rank + 1,
      score: Number(candidate.score.toFixed(8)),
      targetQuerySha256: target.querySha256,
    }));
}

module.exports = {
  BENCHMARK_CONTRACT_ID,
  BENCHMARK_SCHEMA_VERSION,
  bm25Index,
  buildStructuralSpans,
  canonicalJson,
  componentQuery,
  fuseCandidateChannels,
  inventoryLfReferenceRun,
  normalize,
  occurrenceCandidate,
  prepareDocumentCandidatePools,
  rankEmbeddingCandidates,
  rankLexicalCandidates,
  sha256,
  tokens,
};
