function allowedLocalOrigins() {
  const port = String(process.env.SERVER_PORT || "3001");
  return new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://[::1]:${port}`,
  ]);
}

function localOnlyCorsOrigin(origin, callback) {
  if (process.env.LOCAL_ONLY_MODE !== "true") {
    callback(null, true);
    return;
  }

  // Native health checks and other non-browser local clients omit Origin.
  if (!origin) {
    callback(null, true);
    return;
  }
  callback(null, allowedLocalOrigins().has(origin));
}

function rejectForeignLocalOrigin(request, response, next) {
  if (process.env.LOCAL_ONLY_MODE !== "true") return next();

  const origin = request.get("origin");
  const fetchSite = request.get("sec-fetch-site");
  if (
    (origin && !allowedLocalOrigins().has(origin)) ||
    (!origin && fetchSite === "cross-site")
  ) {
    response.status(403).json({ error: "Foreign browser origin rejected." });
    return;
  }
  next();
}

module.exports = { localOnlyCorsOrigin, rejectForeignLocalOrigin };
