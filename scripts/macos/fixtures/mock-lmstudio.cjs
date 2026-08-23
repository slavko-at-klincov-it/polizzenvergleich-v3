#!/usr/bin/env node
const fs = require("fs");
const http = require("http");

const portFile = process.argv[2];
const requestLog = process.argv[3] || null;
const vector = Array(2560).fill(0);
vector[0] = 1;
const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/api/v1/models") {
      response.end(
        JSON.stringify({
          models: [
            {
              type: "llm",
              key: "qwen/qwen3.8-27b",
              selected_variant: "qwen/qwen3.8-27b@4bit",
              format: "mlx",
              size_bytes: 16081678494,
              max_context_length: 262144,
              loaded_instances: [
                {
                  id: "qwen/qwen3.8-27b",
                  // MLX auto-fit may raise the effective context above the
                  // requested 32k while AnythingLLM remains capped at 32k.
                  config: { context_length: 42496, parallel: 1 },
                },
              ],
              capabilities: {
                reasoning: {
                  allowed_options: ["off", "low", "medium", "xhigh", "on"],
                  default: "off",
                },
              },
            },
            {
              type: "llm",
              key: "google/gemma-4-26b-a4b",
              selected_variant: "google/gemma-4-26b-a4b",
              format: "mlx",
              max_context_length: 131072,
              loaded_instances: [
                {
                  id: "gemma",
                  config: { context_length: 80128, parallel: 1 },
                },
              ],
              capabilities: {
                reasoning: {
                  allowed_options: ["off", "on"],
                  default: "on",
                },
              },
            },
            {
              type: "embedding",
              key: "text-embedding-dinghy-law-4b-v1",
              loaded_instances: [
                {
                  id: "dinghy-embed",
                  config: { context_length: 8192 },
                },
              ],
            },
          ],
        })
      );
      return;
    }
    if (request.url === "/v1/embeddings") {
      response.end(JSON.stringify({ data: [{ embedding: vector }] }));
      return;
    }
    if (request.url === "/v1/chat/completions") {
      let input = {};
      try {
        input = JSON.parse(body || "{}");
      } catch {}
      if (requestLog)
        fs.appendFileSync(requestLog, `${JSON.stringify(input)}\n`);
      const maxTokens = Number(input.max_tokens);
      if (
        input.model === "gemma-reasoning-only" ||
        (input.model === "gemma" &&
          (!Number.isFinite(maxTokens) || maxTokens < 256))
      ) {
        response.end(
          JSON.stringify({
            choices: [
              {
                message: { content: "", reasoning_content: "thinking" },
                finish_reason: "length",
              },
            ],
          })
        );
        return;
      }
      if (!["qwen/qwen3.8-27b", "gemma"].includes(input.model)) {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: "unexpected chat model" }));
        return;
      }
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "bereit",
                ...(input.model === "gemma"
                  ? { reasoning_content: "reasoning used 75 tokens" }
                  : {}),
              },
              finish_reason: "stop",
            },
          ],
          usage:
            input.model === "gemma"
              ? {
                  completion_tokens: 80,
                  completion_tokens_details: { reasoning_tokens: 75 },
                }
              : undefined,
        })
      );
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
  });
});
server.listen(0, "127.0.0.1", () => {
  fs.writeFileSync(portFile, String(server.address().port));
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
