const {
  localOnlyCorsOrigin,
  rejectForeignLocalOrigin,
} = require("../../../utils/boot/localOnlyCors");

describe("local-only product CORS", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function allowed(origin) {
    return new Promise((resolve, reject) => {
      localOnlyCorsOrigin(origin, (error, value) =>
        error ? reject(error) : resolve(value)
      );
    });
  }

  test("allows loopback UI origins and origin-less health checks", async () => {
    Object.assign(process.env, {
      LOCAL_ONLY_MODE: "true",
      SERVER_PORT: "3004",
    });

    await expect(allowed("http://127.0.0.1:3004")).resolves.toBe(true);
    await expect(allowed("http://localhost:3004")).resolves.toBe(true);
    await expect(allowed("http://[::1]:3004")).resolves.toBe(true);
    await expect(allowed(undefined)).resolves.toBe(true);
    await expect(allowed("https://attacker.example")).resolves.toBe(false);
  });

  test("preserves upstream behavior outside local-only mode", async () => {
    delete process.env.LOCAL_ONLY_MODE;
    await expect(allowed("https://example.test")).resolves.toBe(true);
  });

  test("rejects foreign browser mutations", () => {
    Object.assign(process.env, {
      LOCAL_ONLY_MODE: "true",
      SERVER_PORT: "3004",
    });
    const request = {
      get: (key) =>
        ({
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        })[key],
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    rejectForeignLocalOrigin(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
