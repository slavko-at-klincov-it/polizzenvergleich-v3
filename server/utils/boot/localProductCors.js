function localProductCorsOrigin(origin, callback) {
  if (process.env.POLICY_SINGLE_USER_NO_AUTH !== "true") {
    callback(null, true);
    return;
  }

  // Requests without an Origin header are local non-browser calls (Doctor,
  // launchd health checks). Browser calls must come from the served product UI.
  if (!origin) {
    callback(null, true);
    return;
  }

  const host = process.env.SERVER_HOST || "127.0.0.1";
  const port = process.env.SERVER_PORT || "3001";
  callback(null, origin === `http://${host}:${port}`);
}

function rejectForeignProductOrigin(request, response, next) {
  if (process.env.POLICY_SINGLE_USER_NO_AUTH !== "true") return next();

  const host = process.env.SERVER_HOST || "127.0.0.1";
  const port = process.env.SERVER_PORT || "3001";
  const allowedOrigin = `http://${host}:${port}`;
  const origin = request.get("origin");
  const fetchSite = request.get("sec-fetch-site");
  if (
    (origin && origin !== allowedOrigin) ||
    (!origin && fetchSite === "cross-site")
  ) {
    response.status(403).json({ error: "Foreign browser origin rejected." });
    return;
  }
  next();
}

module.exports = { localProductCorsOrigin, rejectForeignProductOrigin };
