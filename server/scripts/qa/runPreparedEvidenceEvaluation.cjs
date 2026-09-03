#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { releaseIdentity } = require("../../utils/policyAnalysis/runIdentity");
const {
  rebuildTargetedSelectedSources,
} = require("../../utils/policyAnalysis/targetedSelectedSourcesContract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");

function fail(message) {
  console.error(`[prepared-evidence] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function inspectObjectScopeProvenance(worksheet) {
  let objectScopeEvidenceRequired = false;
  for (const requirement of worksheet?.requirements || [])
    for (const component of requirement.components || []) {
      const componentHasContract = Boolean(
        component.objectScopeEvidenceContract
      );
      const componentHasNestedListContract = Boolean(
        component.nestedListContinuationProofContractId
      );
      objectScopeEvidenceRequired ||= componentHasContract;
      for (const occurrence of component.occurrences || []) {
        const objectScopeProofWithoutContract =
          Object.prototype.hasOwnProperty.call(
            occurrence,
            "objectScopeProof"
          ) && !componentHasContract;
        const nestedListProofWithoutContract =
          Object.prototype.hasOwnProperty.call(
            occurrence,
            "nestedListContinuationProof"
          ) && !componentHasNestedListContract;
        if (objectScopeProofWithoutContract || nestedListProofWithoutContract)
          return {
            objectScopeEvidenceRequired,
            orphanProof: `${String(requirement.id || "requirement")}:${String(
              component.id || "component"
            )}:${String(occurrence.candidateId || "candidate")}`,
          };
      }
    }
  return { objectScopeEvidenceRequired, orphanProof: null };
}

function validDocumentArtifactBinding({ worksheet, documentArtifact }) {
  const document = documentArtifact?.document;
  const worksheetDocument = worksheet?.document;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    typeof documentArtifact.fingerprint !== "string" ||
    !documentArtifact.fingerprint.trim() ||
    documentArtifact.fingerprint !== document?.sourceDocumentId ||
    document?.pdfExtraction?.schemaVersion !== 1 ||
    document?.pdfExtraction?.complete !== true ||
    typeof document?.pageContent !== "string" ||
    !Array.isArray(document?.pageMap) ||
    document.pageMap.length === 0 ||
    document.pdfExtraction.totalPages !== document.pageMap.length ||
    document.pdfExtraction.processedPages !==
      document.pdfExtraction.totalPages ||
    worksheet?.candidateOnly !== true ||
    worksheetDocument?.fingerprint !== documentArtifact.fingerprint ||
    worksheetDocument?.sourceDocumentId !== document.sourceDocumentId ||
    worksheetDocument?.physicalPages !== document.pageMap.length ||
    worksheetDocument?.pageContentLength !== document.pageContent.length ||
    worksheetDocument?.pageContentSha256 !== sha256(document.pageContent) ||
    !Array.isArray(worksheetDocument?.pageBoundaries) ||
    worksheetDocument.pageBoundaries.length !== document.pageMap.length
  )
    return false;
  let previousEnd = 0;
  return document.pageMap.every((page, index) => {
    const valid =
      Number.isInteger(page?.pageNumber) &&
      Number.isInteger(page?.start) &&
      Number.isInteger(page?.end) &&
      page.pageNumber === index + 1 &&
      page.start >= previousEnd &&
      page.end > page.start &&
      page.end <= document.pageContent.length &&
      worksheetDocument.pageBoundaries[index]?.physicalPageNumber ===
        page.pageNumber &&
      worksheetDocument.pageBoundaries[index]?.documentStart === page.start &&
      worksheetDocument.pageBoundaries[index]?.documentEnd === page.end;
    previousEnd = page.end;
    return valid;
  });
}

function writePrivateJson(outputDirectory, fileName, value) {
  const file = path.join(outputDirectory, fileName);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(file, 0o600);
}

function aggregateCompletionMetrics(calls, model) {
  const totals = calls.reduce(
    (result, call) => {
      result.prompt_tokens += call.metrics?.prompt_tokens || 0;
      result.completion_tokens += call.metrics?.completion_tokens || 0;
      result.total_tokens += call.metrics?.total_tokens || 0;
      result.duration += call.metrics?.duration || 0;
      return result;
    },
    { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, duration: 0 }
  );
  const responseModels = [
    ...new Set(
      calls.map((call) => call.metrics?.responseModel).filter(Boolean)
    ),
  ];
  return {
    callCount: calls.length,
    ...totals,
    model,
    responseModel:
      responseModels.length === 1 && calls.length > 0
        ? responseModels[0]
        : null,
    responseModelComplete:
      calls.length === 0 ||
      calls.every(({ metrics }) => metrics?.responseModel === model),
    executionMode: calls.length === 0 ? "SERVER_ONLY" : "MODEL_ASSISTED",
  };
}

function selectedSources({ targets, materialized }) {
  const sourceById = new Map();
  for (const target of targets)
    for (const candidate of target.candidates)
      sourceById.set(candidate.candidateId, {
        requirementId: target.requirementId,
        componentId: target.componentId,
        candidateId: candidate.candidateId,
        candidateBinding: candidate.candidateBinding || null,
        physicalPageNumber: candidate.physicalPageNumber,
        printedPageLabel: candidate.printedPageLabel || null,
        exactText: candidate.exactText,
        contextText: candidate.contextText,
        contextDocumentStart: candidate.contextDocumentStart,
      });
  return materialized.judgements.flatMap((judgement) =>
    judgement.selectedCandidateIds.map((candidateId) =>
      sourceById.get(candidateId)
    )
  );
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowedArguments = new Set([
    "worksheet",
    "systemPromptFile",
    "controlFile",
    "controlMode",
    "triageFile",
    "output",
    "model",
    "modelTokenLimit",
    "documentStatus",
    "maxAttemptsPerTarget",
    "allowUniqueCandidateIdRepair",
    "expectedTargetSelectionDigestSha256",
    "documentArtifact",
  ]);
  const unknownArguments = Object.keys(args).filter(
    (argument) => !allowedArguments.has(argument)
  );
  if (unknownArguments.length)
    fail(`Unbekannte Argumente: ${unknownArguments.join(",")}`);
  const worksheetFile = path.resolve(args.worksheet || "");
  const systemPromptFile = path.resolve(args.systemPromptFile || "");
  const controlFile = args.controlFile ? path.resolve(args.controlFile) : null;
  const controlMode = args.controlMode || "file";
  const triageFile = args.triageFile ? path.resolve(args.triageFile) : null;
  const documentArtifactFile = args.documentArtifact
    ? path.resolve(args.documentArtifact)
    : null;
  const outputDirectory = path.resolve(args.output || "");
  for (const [label, file] of [
    ["Worksheet", worksheetFile],
    ["Systemprompt", systemPromptFile],
  ]) {
    if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  }
  if (!["file", "technical-review"].includes(controlMode))
    fail(`Ungültiger --controlMode: ${controlMode}`);
  if (controlMode === "file" && (!controlFile || !fs.existsSync(controlFile)))
    fail(`Kontrollen fehlen: ${controlFile}`);
  if (controlMode === "technical-review" && controlFile)
    fail(
      "--controlFile und --controlMode technical-review schließen einander aus"
    );
  if (triageFile && !fs.existsSync(triageFile))
    fail(`Triage fehlt: ${triageFile}`);
  if (documentArtifactFile) {
    let documentArtifactStat;
    try {
      documentArtifactStat = fs.lstatSync(documentArtifactFile);
    } catch {
      fail(`Dokumentartefakt fehlt: ${documentArtifactFile}`);
    }
    if (documentArtifactStat.isSymbolicLink() || !documentArtifactStat.isFile())
      fail(
        `Dokumentartefakt muss eine reguläre Nicht-Symlink-Datei sein: ${documentArtifactFile}`
      );
  }
  if (!args.output) fail("--output ist erforderlich");
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  fs.chmodSync(outputDirectory, 0o700);

  process.env.LMSTUDIO_BASE_PATH =
    process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  process.env.LMSTUDIO_MODEL_PREF =
    args.model || process.env.LMSTUDIO_MODEL_PREF || "qwen/qwen3.6-35b-a3b";
  process.env.LMSTUDIO_MODEL_TOKEN_LIMIT =
    args.modelTokenLimit || process.env.LMSTUDIO_MODEL_TOKEN_LIMIT || "42496";

  const {
    DOCUMENT_STATUS,
    buildDeterministicPreparedEvidenceJudgement,
    buildPreparedEvidenceTargets,
    buildSinglePreparedEvidencePayload,
    materializePreparedEvidence,
    parseAndValidatePreparedEvidenceResponse,
  } = require("../../utils/policyAnalysis/preparedEvidenceContract");
  const { LMStudioLLM } = require("../../utils/AiProviders/lmStudio");
  const {
    buildTechnicalReviewControlSet,
    evaluatePreparedEvidenceControls,
  } = require("../../utils/policyAnalysis/preparedEvidenceControls");

  const worksheet = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
  const objectScopeProvenance = inspectObjectScopeProvenance(worksheet);
  if (objectScopeProvenance.orphanProof)
    fail(
      `Worksheet-Provenienz ohne passenden Komponentenvertrag ist unzulässig: ${objectScopeProvenance.orphanProof}`
    );
  if (
    objectScopeProvenance.objectScopeEvidenceRequired &&
    !documentArtifactFile
  )
    fail(
      "Worksheet mit objectScopeEvidenceContract erfordert --documentArtifact"
    );
  const documentArtifactBytes = documentArtifactFile
    ? fs.readFileSync(documentArtifactFile)
    : null;
  const documentArtifactSha256 = documentArtifactBytes
    ? sha256(documentArtifactBytes)
    : null;
  const documentArtifact = documentArtifactBytes
    ? JSON.parse(documentArtifactBytes.toString("utf8"))
    : null;
  if (
    documentArtifact &&
    !validDocumentArtifactBinding({ worksheet, documentArtifact })
  )
    fail("Dokumentartefakt ist nicht fail-closed an das Worksheet gebunden");
  const expectedTargetSelectionDigestSha256 =
    args.expectedTargetSelectionDigestSha256 || null;
  if (
    expectedTargetSelectionDigestSha256 &&
    !/^[a-f0-9]{64}$/u.test(expectedTargetSelectionDigestSha256)
  )
    fail("--expectedTargetSelectionDigestSha256 muss ein SHA-256 sein");
  if (
    worksheet.targetRequirementSelection &&
    !expectedTargetSelectionDigestSha256
  )
    fail("Target-Worksheet erfordert --expectedTargetSelectionDigestSha256");
  if (
    !worksheet.targetRequirementSelection &&
    expectedTargetSelectionDigestSha256
  )
    fail(
      "--expectedTargetSelectionDigestSha256 ist nur für Target-Worksheets zulässig"
    );
  const systemPrompt = fs.readFileSync(systemPromptFile, "utf8");
  const controlSet =
    controlMode === "technical-review"
      ? buildTechnicalReviewControlSet({
          worksheet,
          controlSetId: `${String(
            worksheet.catalog?.categoryView || "category"
          ).toLowerCase()}-full-technical-review:${path.basename(worksheetFile)}`,
        })
      : JSON.parse(fs.readFileSync(controlFile, "utf8"));
  const candidateTriage = triageFile
    ? JSON.parse(fs.readFileSync(triageFile, "utf8"))
    : null;
  const reviewStatus = controlSet.reviewStatus || "NOT_DECLARED";
  if (!["NOT_DECLARED", "REVIEW_REQUIRED", "APPROVED"].includes(reviewStatus))
    fail(`Ungültiger Control-Reviewstatus: ${reviewStatus}`);
  const documentStatus = args.documentStatus;
  if (!Object.values(DOCUMENT_STATUS).includes(documentStatus))
    fail(`Ungültiger --documentStatus: ${documentStatus}`);
  const targets = buildPreparedEvidenceTargets({
    worksheet,
    documentStatus,
    candidateTriage,
    expectedTargetSelectionDigestSha256,
  });
  const llm = new LMStudioLLM(null, process.env.LMSTUDIO_MODEL_PREF);
  const allowUniqueCandidateIdRepair =
    String(args.allowUniqueCandidateIdRepair || "false") === "true";
  const maxAttemptsPerTarget = Number(args.maxAttemptsPerTarget || 2);
  if (
    !Number.isInteger(maxAttemptsPerTarget) ||
    maxAttemptsPerTarget < 1 ||
    maxAttemptsPerTarget > 3
  )
    fail("--maxAttemptsPerTarget muss zwischen 1 und 3 liegen");
  const startedAt = new Date();
  const calls = [];
  const messages = [];
  const judgements = [];
  let validationError = null;

  for (const target of targets.filter(({ candidates }) => candidates.length)) {
    const deterministicJudgement =
      buildDeterministicPreparedEvidenceJudgement(target);
    if (deterministicJudgement) {
      judgements.push(deterministicJudgement);
      continue;
    }
    const payload = buildSinglePreparedEvidencePayload({ target });
    let targetComplete = false;
    let previousError = null;
    for (let attempt = 1; attempt <= maxAttemptsPerTarget; attempt += 1) {
      const retryPayload = previousError
        ? {
            ...payload,
            retryInstruction:
              "Die vorige Antwort war formal ungültig. Kopiere ausschließlich Candidate-IDs aus allowedCandidateIds exakt und gib erneut nur das verlangte JSON-Objekt aus.",
            previousErrorCode: previousError.code,
            allowedCandidateIds: target.candidates.map(
              ({ candidateId }) => candidateId
            ),
          }
        : payload;
      const promptMessages = llm.constructPrompt({
        systemPrompt,
        contextTexts: [],
        chatHistory: [],
        userPrompt: JSON.stringify(retryPayload),
      });
      const completion = await llm.getChatCompletion(promptMessages, {
        temperature: 0,
        // A valid response may contain many server-owned candidate IDs for one
        // atomic component. Keep the cap finite, but large enough for the full
        // validated ID list instead of truncating otherwise valid JSON.
        maxTokens: 2048,
      });
      if (
        completion?.metrics?.responseModel !== process.env.LMSTUDIO_MODEL_PREF
      )
        fail(
          `Falsches LM-Studio-Chatmodell bei ${target.targetId}: erwartet ${process.env.LMSTUDIO_MODEL_PREF}, erhalten ${completion?.metrics?.responseModel || "NICHT_GEMELDET"}. Lauf sofort abgebrochen.`
        );
      calls.push({
        targetId: target.targetId,
        attempt,
        payloadSha256: sha256(JSON.stringify(retryPayload)),
        responseText: completion?.textResponse || "",
        metrics: completion?.metrics || null,
      });
      messages.push({
        targetId: target.targetId,
        attempt,
        messages: promptMessages,
      });
      try {
        judgements.push(
          parseAndValidatePreparedEvidenceResponse({
            responseText: completion?.textResponse || "",
            target,
            allowUniqueCandidateIdRepair,
          })
        );
        targetComplete = true;
        break;
      } catch (error) {
        previousError = {
          code: error.code || "UNKNOWN",
          message: error.message,
        };
      }
    }
    if (!targetComplete) {
      validationError = {
        ...previousError,
        targetId: target.targetId,
        attempts: maxAttemptsPerTarget,
      };
      break;
    }
  }

  let materialized = null;
  let sources = [];
  let controls = [];
  if (!validationError) {
    try {
      materialized = materializePreparedEvidence({
        worksheet,
        targets,
        judgements,
      });
      sources = documentArtifact
        ? rebuildTargetedSelectedSources({
            targets,
            materializedEvidence: materialized,
            documentArtifact,
            worksheet,
          })
        : selectedSources({ targets, materialized });
      controls = evaluatePreparedEvidenceControls({
        controlSet,
        materialized,
        sources,
      });
    } catch (error) {
      validationError = {
        code: error.code || "UNKNOWN",
        message: error.message,
      };
    }
  }

  writePrivateJson(outputDirectory, "answers.private.json", calls);
  writePrivateJson(outputDirectory, "messages.private.json", messages);
  writePrivateJson(outputDirectory, "targets.private.json", targets);
  if (materialized) {
    writePrivateJson(
      outputDirectory,
      "materialized.private.json",
      materialized
    );
    writePrivateJson(outputDirectory, "selected-sources.private.json", sources);
  }
  const technicalPass =
    materialized && controls.every(({ pass }) => pass) && !validationError;
  const requestedFieldsNotEvaluated =
    materialized?.rollups.filter(
      ({ requestedFieldStatus }) => requestedFieldStatus === "NOT_EVALUATED"
    ).length || 0;
  const report = {
    status: technicalPass
      ? reviewStatus === "APPROVED" && requestedFieldsNotEvaluated === 0
        ? "PASS"
        : "TECHNICAL_PASS_REVIEW_REQUIRED"
      : "REVISE",
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    implementation: {
      releaseId: releaseIdentity(REPOSITORY_ROOT),
      nodeVersion: process.versions.node,
    },
    model: {
      provider: "LMStudioLLM",
      id: process.env.LMSTUDIO_MODEL_PREF,
      declaredTokenLimit: Number(process.env.LMSTUDIO_MODEL_TOKEN_LIMIT),
      temperature: 0,
      seed: null,
    },
    contracts: {
      worksheetPath: worksheetFile,
      worksheetSha256: sha256File(worksheetFile),
      documentArtifactPath: documentArtifactFile,
      documentArtifactSha256,
      documentFingerprint: documentArtifact?.fingerprint || null,
      systemPromptPath: systemPromptFile,
      systemPromptSha256: sha256File(systemPromptFile),
      controlPath: controlFile,
      controlSha256: controlFile
        ? sha256File(controlFile)
        : sha256(JSON.stringify(controlSet)),
      controlMode,
      triagePath: triageFile,
      triageSha256: triageFile ? sha256File(triageFile) : null,
      targetsSha256: sha256File(
        path.join(outputDirectory, "targets.private.json")
      ),
      documentStatus,
      materializedEvidenceSha256: materialized
        ? sha256File(path.join(outputDirectory, "materialized.private.json"))
        : null,
      selectedSourcesSha256: materialized
        ? sha256File(
            path.join(outputDirectory, "selected-sources.private.json")
          )
        : null,
      expectedTargetSelectionDigestSha256,
      targetSelectionDigestSha256:
        worksheet.targetRequirementSelection?.selectionDigestSha256 || null,
    },
    input: {
      requirementCount: worksheet.requirements.length,
      componentCount: targets.length,
      serverTerminalCount: targets.filter(
        ({ candidates }) => !candidates.length
      ).length,
      deterministicTargetCount: judgements.filter(({ decisionOwner }) =>
        String(decisionOwner).startsWith("SERVER_EXPLICIT_")
      ).length,
      modelTargetCount: new Set(calls.map(({ targetId }) => targetId)).size,
      modelAttemptCount: calls.length,
      candidateCount: targets.reduce(
        (sum, target) => sum + target.candidates.length,
        0
      ),
      maxAttemptsPerTarget,
      allowUniqueCandidateIdRepair,
    },
    completion: aggregateCompletionMetrics(
      calls,
      process.env.LMSTUDIO_MODEL_PREF
    ),
    validation: {
      pass: Boolean(materialized && !validationError),
      error: validationError,
      judgementCount: materialized?.judgements.length || 0,
      requestedFieldsNotEvaluated,
      candidateIdCorrections:
        materialized?.judgements.flatMap(
          ({ targetId, candidateIdCorrections = [] }) =>
            candidateIdCorrections.map((correction) => ({
              targetId,
              ...correction,
            }))
        ) || [],
    },
    controls: {
      pass: Boolean(technicalPass),
      reviewStatus,
      passed: controls.filter(({ pass }) => pass).length,
      total: controls.length,
      results: controls,
    },
  };
  writePrivateJson(outputDirectory, "report.json", report);
  console.log(
    `[prepared-evidence] ${report.status}: ${report.validation.judgementCount}/${targets.length} Komponenten, ${report.controls.passed}/${report.controls.total} Kontrollen`
  );
  if (!technicalPass) process.exitCode = 2;
}

run().catch((error) => fail(error.stack || error.message));
