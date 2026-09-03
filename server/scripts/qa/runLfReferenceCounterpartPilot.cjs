#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  COUNTERPART_STATUS,
  bindReferenceEvidence,
  chunksFromArtifacts,
  jsonFromModelText,
  queryText,
  selectCandidates,
  sha256,
  validateCatalog,
  validateModelResults,
} = require("../../utils/policyAnalysis/lfReferenceCounterpartPilot");

function fail(message) {
  console.error(`[lf-reference-pilot] ${message}`);
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

function readJson(file, label) {
  if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file || "-"}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} ist ungültig: ${error.message}`);
  }
}

function regularFile(file, label) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    fail(`${label} fehlt: ${file}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    fail(`${label} muss eine reguläre Nicht-Symlink-Datei sein: ${file}`);
}

function walkRegularFiles(root, fileName) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) continue;
    if (stat.isFile()) {
      if (path.basename(current) === fileName) files.push(current);
      continue;
    }
    if (!stat.isDirectory()) continue;
    for (const entry of fs.readdirSync(current))
      pending.push(path.join(current, entry));
  }
  return files;
}

function artifactMap(runRoot) {
  const artifacts = new Map();
  for (const file of walkRegularFiles(
    path.join(runRoot, "documents"),
    "document.private.json"
  )) {
    const artifact = readJson(file, "Dokumentartefakt");
    const directory = path.basename(path.dirname(file));
    const uuid = directory.match(/^[AB]-\d+-(.+)$/u)?.[1];
    if (!uuid || artifacts.has(uuid))
      fail(`Dokumentartefakt-UUID ist nicht eindeutig: ${directory}`);
    artifacts.set(uuid, artifact);
  }
  return artifacts;
}

function validateManifest(manifest, catalog) {
  if (!Array.isArray(manifest?.documents) || manifest.documents.length < 2)
    fail("Manifest enthält keine Vergleichsdokumente");
  const reference = manifest.documents.filter(({ side }) => side === "A");
  const counterparts = manifest.documents.filter(({ side }) => side === "B");
  if (reference.length !== 1 || counterparts.length < 1)
    fail(
      "Der Pilot erfordert genau ein Referenzdokument auf A und mindestens ein Dokument auf B"
    );
  if (reference[0].sha256 !== catalog.sourceProduct.documentSha256)
    fail(
      "Paket A stimmt nicht mit dem versionierten LF-Referenzdokument überein"
    );
  if (
    new Set(manifest.documents.map(({ uuid }) => uuid)).size !==
    manifest.documents.length
  )
    fail("Dokument-UUIDs im Manifest sind nicht eindeutig");
  return { reference: reference[0], counterparts };
}

async function embed(client, model, inputs, label) {
  const vectors = [];
  const batches = [];
  for (let start = 0; start < inputs.length; start += 32) {
    const batch = inputs.slice(start, start + 32);
    const started = performance.now();
    const response = await client.embeddings.create({
      model,
      input: batch,
      encoding_format: "float",
    });
    const rows = [...(response.data || [])].sort(
      (left, right) => left.index - right.index
    );
    if (
      rows.length !== batch.length ||
      rows.some(
        (row, index) => row.index !== index || !Array.isArray(row.embedding)
      )
    )
      throw new Error(`Embedding-Antwort ungültig: ${label}:${start}`);
    vectors.push(...rows.map(({ embedding }) => embedding));
    batches.push({
      label,
      start,
      inputCount: batch.length,
      durationMs: Math.round(performance.now() - started),
      responseModel: response.model || null,
    });
  }
  return { vectors, batches };
}

function promptForCategory(category, candidatesByRequirement) {
  const payload = category.requirements
    .filter(({ pilot }) => pilot)
    .map((requirement) => ({
      requirementId: requirement.id,
      referenceLabel: requirement.label,
      factRole: requirement.factRole,
      comparisonQuestion: requirement.query,
      lfReference: {
        physicalPageNumber: requirement.reference.page,
        exactNeedle: requirement.reference.needle,
      },
      candidates: (candidatesByRequirement.get(requirement.id) || []).map(
        (candidate) => ({
          candidateId: candidate.candidateId,
          documentName: candidate.documentName,
          physicalPageNumber: candidate.physicalPageNumber,
          lexicalScore: Number(candidate.lexicalScore.toFixed(4)),
          semanticScore: Number(candidate.semanticScore.toFixed(6)),
          exactText: candidate.exactText.slice(0, 1800),
        })
      ),
    }));

  return [
    {
      role: "system",
      content: `Du prüfst ausschließlich, ob vorgegebene Quellenkandidaten aus einem Gebäudeversicherungs-Dokumentpaket B ein semantisches Gegenstück zu einem LF-IMMO-Referenzpunkt bilden.\n\nZulässige Stati:\n- DIRECT_COUNTERPART: gleiche fachliche Funktion und derselbe wesentliche Objekt-/Gefahr-/Rollen-Scope; Werte oder Bedingungen dürfen abweichen.\n- PARTIAL_COUNTERPART: nur ein echter Teil des Referenzpunkts ist abgedeckt oder eine wesentliche Dimension fehlt.\n- RELATED_ONLY: gleiches Thema, aber andere Faktrolle, anderer Gegenstand oder anderer Geltungsbereich.\n- NO_COUNTERPART_IN_CANDIDATES: keiner der Kandidaten ist ein fachliches Gegenstück. Das bedeutet niemals automatisch Ausschluss oder fehlende Deckung im vollständigen Paket.\n- UNCLEAR: die Kandidaten reichen für eine sichere Zuordnung nicht aus.\n\nVerwende ausschließlich vorhandene candidateIds. Erfinde keine Quelle, Seite, Deckung, Wirkung oder Bewertung. Mehrere candidateIds sind erlaubt, wenn das Gegenstück über mehrere Paketdokumente verteilt ist. Gib für jeden requirementId genau ein Objekt aus. Ausgabe ausschließlich als JSON-Array ohne Markdown. Jedes Objekt hat exakt: requirementId, status, candidateIds, matchSummary, unresolved. Formuliere matchSummary und unresolved knapp auf Deutsch.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        categoryId: category.id,
        categoryLabel: category.label,
        requirements: payload,
      }),
    },
  ];
}

async function classifyCategory({
  client,
  model,
  category,
  candidatesByRequirement,
}) {
  const requirements = category.requirements.filter(({ pilot }) => pilot);
  const messages = promptForCategory(category, candidatesByRequirement);
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const started = performance.now();
    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: 0,
        max_tokens: 5000,
      });
      const text = response.choices?.[0]?.message?.content || "";
      const results = validateModelResults(
        jsonFromModelText(text),
        requirements,
        candidatesByRequirement
      );
      return {
        results,
        metrics: {
          categoryId: category.id,
          attempt,
          durationMs: Math.round(performance.now() - started),
          requestedModel: model,
          responseModel: response.model || null,
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function markdownReport(report, catalog, candidatesByRequirement) {
  const labels = new Map(
    catalog.categories.flatMap((category) =>
      category.requirements.map((requirement) => [
        requirement.id,
        { ...requirement, categoryLabel: category.label },
      ])
    )
  );
  const lines = [
    "# LF-IMMO-Referenzpilot: Gegenstücke in Paket B",
    "",
    `Run-ID: \`${report.runId}\``,
    `Commit: \`${report.commitSha}\``,
    `Katalog: \`${report.catalog.contractId}\``,
    `Referenzdokument: LF IMMO Exklusivschutz ${report.catalog.sourceProduct.version}, ${report.catalog.sourceProduct.physicalPages} physische Seiten`,
    `Vergleichspaket: ${report.documents.sideBCount} Dokumente`,
    `Modelle: \`${report.runtime.chatModel}\`, \`${report.runtime.embeddingModel}\``,
    "",
    "Dieser QA-Pilot sucht semantische Gegenstücke zu LF-Referenzpunkten. Ein fehlendes Gegenstück in den ausgewählten Kandidaten beweist weder einen Ausschluss noch das Fehlen einer Deckung im vollständigen Paket. Die Ergebnisse sind nicht fachlich freigegeben.",
    "",
    "## Ergebnisübersicht",
    "",
    ...Object.values(COUNTERPART_STATUS).map(
      (status) => `- ${status}: ${report.totals[status] || 0}`
    ),
    "",
  ];
  let currentCategory = null;
  for (const result of report.results) {
    const requirement = labels.get(result.requirementId);
    if (requirement.categoryLabel !== currentCategory) {
      currentCategory = requirement.categoryLabel;
      lines.push(`## ${currentCategory}`, "");
    }
    lines.push(`### ${result.requirementId} · ${requirement.label}`, "");
    lines.push(
      `- LF-Beleg: PDF-Seite ${requirement.reference.page} · „${requirement.reference.needle}“`
    );
    lines.push(`- Zuordnung: \`${result.status}\``);
    lines.push(`- Kurzbegründung: ${result.matchSummary}`);
    if (result.unresolved) lines.push(`- Offen: ${result.unresolved}`);
    for (const candidateId of result.candidateIds) {
      const candidate = (
        candidatesByRequirement.get(result.requirementId) || []
      ).find((entry) => entry.candidateId === candidateId);
      lines.push(
        `- Paket-B-Beleg: ${candidate.documentName}, PDF-Seite ${candidate.physicalPageNumber} · „${candidate.exactText.slice(0, 420).replace(/\s+/gu, " ").trim()}${candidate.exactText.length > 420 ? "…" : ""}“`
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function writePrivate(file, value) {
  fs.writeFileSync(file, value, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set([
    "catalog",
    "manifest",
    "runRoot",
    "output",
    "model",
    "embeddingModel",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(", ")}`);
  for (const required of ["catalog", "manifest", "runRoot", "output"])
    if (!args[required]) fail(`--${required} ist erforderlich`);

  const catalogFile = path.resolve(args.catalog);
  const manifestFile = path.resolve(args.manifest);
  const runRoot = path.resolve(args.runRoot);
  const output = path.resolve(args.output);
  regularFile(catalogFile, "Katalog");
  regularFile(manifestFile, "Manifest");
  if (!fs.existsSync(runRoot) || !fs.lstatSync(runRoot).isDirectory())
    fail(`Run-Verzeichnis fehlt: ${runRoot}`);
  if (fs.existsSync(output)) {
    const outputStat = fs.lstatSync(output);
    if (!outputStat.isDirectory() || outputStat.isSymbolicLink())
      fail(`Ausgabeziel muss ein Nicht-Symlink-Verzeichnis sein: ${output}`);
  } else {
    fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  }

  const catalogBytes = fs.readFileSync(catalogFile);
  const manifestBytes = fs.readFileSync(manifestFile);
  const catalog = validateCatalog(JSON.parse(catalogBytes));
  const manifest = JSON.parse(manifestBytes);
  const { reference, counterparts } = validateManifest(manifest, catalog);
  const artifactsByUuid = artifactMap(runRoot);
  if (artifactsByUuid.size !== manifest.documents.length)
    fail(
      `Dokumentartefakte unvollständig: ${artifactsByUuid.size}/${manifest.documents.length}`
    );
  const referenceEvidence = bindReferenceEvidence(
    catalog,
    artifactsByUuid.get(reference.uuid)
  );
  const chunks = chunksFromArtifacts(counterparts, artifactsByUuid);
  const requirements = catalog.categories
    .flatMap(({ requirements }) => requirements)
    .filter(({ pilot }) => pilot);

  const baseURL = process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  const chatModel = args.model || "qwen/qwen3.6-35b-a3b";
  const embeddingModel =
    args.embeddingModel || "text-embedding-dinghy-law-4b-v1";
  const client = new OpenAI({
    baseURL,
    apiKey: process.env.LMSTUDIO_AUTH_TOKEN || "local-no-key",
    timeout: 600000,
    maxRetries: 0,
  });

  console.log(
    `[lf-reference-pilot] ${requirements.length} Referenzpunkte, ${chunks.length} Paket-B-Kandidatenfenster`
  );
  const chunkEmbeddingRun = await embed(
    client,
    embeddingModel,
    chunks.map(({ exactText }) => exactText),
    "counterpart-chunks"
  );
  const queryEmbeddingRun = await embed(
    client,
    embeddingModel,
    requirements.map(queryText),
    "reference-queries"
  );
  const candidatesByRequirement = new Map();
  requirements.forEach((requirement, index) => {
    candidatesByRequirement.set(
      requirement.id,
      selectCandidates({
        requirement,
        chunks,
        queryEmbedding: queryEmbeddingRun.vectors[index],
        chunkEmbeddings: chunkEmbeddingRun.vectors,
        topK: 5,
      })
    );
  });

  const results = [];
  const chatMetrics = [];
  for (const category of catalog.categories) {
    if (!category.requirements.some(({ pilot }) => pilot)) continue;
    console.log(`[lf-reference-pilot] ${category.id} · ${category.label}`);
    const classified = await classifyCategory({
      client,
      model: chatModel,
      category,
      candidatesByRequirement,
    });
    results.push(...classified.results);
    chatMetrics.push(classified.metrics);
  }

  const totals = Object.fromEntries(
    Object.values(COUNTERPART_STATUS).map((status) => [status, 0])
  );
  for (const result of results) totals[result.status] += 1;
  if (
    Object.values(totals).reduce((sum, count) => sum + count, 0) !==
    requirements.length
  )
    fail("Ergebnisgruppen decken nicht alle Referenzpunkte ab");

  const commitSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: path.resolve(__dirname, "../../.."),
    encoding: "utf8",
  }).trim();
  const runId = `LF-REFERENCE-${commitSha.slice(0, 8).toUpperCase()}-${new Date()
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\..+$/u, "Z")}`;
  const report = {
    schemaVersion: 1,
    contractId: "LF_REFERENCE_COUNTERPART_RESULT_V1",
    runId,
    createdAt: new Date().toISOString(),
    commitSha,
    catalog: {
      contractId: catalog.contractId,
      sha256: sha256(catalogBytes),
      sourceProduct: catalog.sourceProduct,
      requirementCount: requirements.length,
      categoryCount: catalog.categories.length,
    },
    input: {
      manifestSha256: sha256(manifestBytes),
      sessionUuid: manifest.sessionUuid || null,
      runRootBinding: path.basename(runRoot),
    },
    documents: {
      sideACount: 1,
      sideBCount: counterparts.length,
      sourceSha256: reference.sha256,
      sideBSha256: counterparts.map(({ sha256 }) => sha256),
    },
    runtime: {
      baseURL,
      chatModel,
      embeddingModel,
      embeddingBatches: [
        ...chunkEmbeddingRun.batches,
        ...queryEmbeddingRun.batches,
      ],
      chatMetrics,
    },
    referenceEvidence: Object.fromEntries(referenceEvidence),
    totals,
    mutuallyExclusiveTotals: true,
    results: results.map((result) => ({
      ...result,
      candidates: (candidatesByRequirement.get(result.requirementId) || []).map(
        (candidate) => ({
          candidateId: candidate.candidateId,
          documentUuid: candidate.documentUuid,
          documentName: candidate.documentName,
          physicalPageNumber: candidate.physicalPageNumber,
          pageStart: candidate.pageStart,
          pageEnd: candidate.pageEnd,
          lexicalScore: candidate.lexicalScore,
          semanticScore: candidate.semanticScore,
          exactTextSha256: sha256(candidate.exactText),
        })
      ),
    })),
    proofLimits: [
      "QA-only pilot; no production rule was changed.",
      "Model classifications are not an expert-labelled oracle.",
      "NO_COUNTERPART_IN_CANDIDATES is not evidence of exclusion or complete package absence.",
      "The pilot does not discover provisions unique to package B.",
    ],
  };
  writePrivate(
    path.join(output, "lf-reference-counterpart.private.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  writePrivate(
    path.join(output, "lf-reference-counterpart.md"),
    markdownReport(report, catalog, candidatesByRequirement)
  );
  console.log(`[lf-reference-pilot] FERTIG: ${output}`);
  console.log(`[lf-reference-pilot] Run-ID: ${runId}`);
}

run().catch((error) => fail(error.stack || error.message));
