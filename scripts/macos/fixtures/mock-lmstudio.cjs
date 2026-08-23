#!/usr/bin/env node
const fs = require("fs");
const http = require("http");

const portFile = process.argv[2];
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
                  config: { context_length: 32768, parallel: 1 },
                },
              ],
              capabilities: {
                reasoning: {
                  allowed_options: ["off", "low", "medium", "xhigh", "on"],
                  default: "off",
                },
              },
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
      response.end(
        JSON.stringify({ choices: [{ message: { content: "bereit" } }] })
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
