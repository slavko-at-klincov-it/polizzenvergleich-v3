const BATCH_SCHEMA_VERSION = 1;
const DEFAULT_MAX_SERIALIZED_PAYLOAD_CHARS = 72_000;

function batchError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function exactKeys(value, expectedKeys, code) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw batchError(code, actual.join(","));
}

function normalizedBatchSize(value) {
  const parsed = Number(value ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4)
    throw batchError("ISOLATED_BATCH_SIZE_INVALID", String(value));
  return parsed;
}

function normalizedResponse(responseText) {
  const response = String(responseText || "").trim();
  const fenced = response.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/iu);
  return fenced ? fenced[1].trim() : response;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0)
    throw batchError("ISOLATED_BATCH_ITEMS_INVALID");
  const ids = new Set();
  for (const item of items) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      typeof item.itemId !== "string" ||
      item.itemId.length === 0 ||
      !item.payload ||
      typeof item.payload !== "object" ||
      Array.isArray(item.payload)
    )
      throw batchError("ISOLATED_BATCH_ITEM_INVALID");
    if (ids.has(item.itemId))
      throw batchError("ISOLATED_BATCH_ITEM_DUPLICATE", item.itemId);
    ids.add(item.itemId);
  }
}

function buildIsolatedTargetBatches({
  items,
  maxTargetsPerCall = 1,
  maxSerializedPayloadChars = DEFAULT_MAX_SERIALIZED_PAYLOAD_CHARS,
}) {
  validateItems(items);
  const batchSize = normalizedBatchSize(maxTargetsPerCall);
  if (
    !Number.isInteger(maxSerializedPayloadChars) ||
    maxSerializedPayloadChars < 1_000
  )
    throw batchError("ISOLATED_BATCH_PAYLOAD_LIMIT_INVALID");

  const batches = [];
  let current = [];
  let currentChars = 0;
  for (const item of items) {
    const itemChars = Buffer.byteLength(JSON.stringify(item), "utf8");
    const mustSplit =
      current.length > 0 &&
      (current.length >= batchSize ||
        currentChars + itemChars > maxSerializedPayloadChars);
    if (mustSplit) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(item);
    currentChars += itemChars;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function buildIsolatedTargetBatchPayload({ task, items, exampleResponse }) {
  validateItems(items);
  if (typeof task !== "string" || !task.endsWith("_BATCH"))
    throw batchError("ISOLATED_BATCH_TASK_INVALID", String(task));
  if (
    !exampleResponse ||
    typeof exampleResponse !== "object" ||
    Array.isArray(exampleResponse)
  )
    throw batchError("ISOLATED_BATCH_EXAMPLE_INVALID");
  return {
    batchSchemaVersion: BATCH_SCHEMA_VERSION,
    task,
    isolationContract: {
      independentItems: true,
      noCrossItemEvidence: true,
      preserveItemOrder: true,
      oneResponsePerItem: true,
    },
    items,
    responseContract: {
      exactRootKeys: ["batchSchemaVersion", "results"],
      exactResultKeys: ["itemId", "response"],
      output: "JSON_ONLY",
      example: {
        batchSchemaVersion: BATCH_SCHEMA_VERSION,
        results: [
          {
            itemId: items[0].itemId,
            response: exampleResponse,
          },
        ],
      },
    },
  };
}

function parseAndValidateIsolatedTargetBatch({
  responseText,
  items,
  parseItemResponse,
}) {
  validateItems(items);
  if (typeof parseItemResponse !== "function")
    throw batchError("ISOLATED_BATCH_PARSER_INVALID");
  let parsed;
  try {
    parsed = JSON.parse(normalizedResponse(responseText));
  } catch (error) {
    throw batchError("ISOLATED_BATCH_JSON_INVALID", error.message);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw batchError("ISOLATED_BATCH_ROOT_INVALID");
  exactKeys(
    parsed,
    ["batchSchemaVersion", "results"],
    "ISOLATED_BATCH_ROOT_KEYS_INVALID"
  );
  if (parsed.batchSchemaVersion !== BATCH_SCHEMA_VERSION)
    throw batchError(
      "ISOLATED_BATCH_SCHEMA_INVALID",
      String(parsed.batchSchemaVersion)
    );
  if (!Array.isArray(parsed.results) || parsed.results.length !== items.length)
    throw batchError("ISOLATED_BATCH_RESULT_COUNT_INVALID");

  return parsed.results.map((result, index) => {
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw batchError("ISOLATED_BATCH_RESULT_INVALID", String(index));
    exactKeys(
      result,
      ["itemId", "response"],
      "ISOLATED_BATCH_RESULT_KEYS_INVALID"
    );
    if (result.itemId !== items[index].itemId)
      throw batchError(
        "ISOLATED_BATCH_RESULT_ORDER_INVALID",
        `${String(result.itemId)}:${items[index].itemId}`
      );
    if (
      !result.response ||
      typeof result.response !== "object" ||
      Array.isArray(result.response)
    )
      throw batchError("ISOLATED_BATCH_ITEM_RESPONSE_INVALID", result.itemId);
    return parseItemResponse({
      item: items[index],
      responseText: JSON.stringify(result.response),
    });
  });
}

module.exports = {
  BATCH_SCHEMA_VERSION,
  DEFAULT_MAX_SERIALIZED_PAYLOAD_CHARS,
  buildIsolatedTargetBatchPayload,
  buildIsolatedTargetBatches,
  normalizedBatchSize,
  parseAndValidateIsolatedTargetBatch,
};
