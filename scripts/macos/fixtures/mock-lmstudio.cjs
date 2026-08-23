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
