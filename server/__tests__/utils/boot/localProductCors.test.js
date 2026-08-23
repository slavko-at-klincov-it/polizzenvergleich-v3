const {
  localProductCorsOrigin,
  rejectForeignProductOrigin,
} = require("../../../utils/boot/localProductCors");

describe("managed local product CORS", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function allowed(origin) {
    return new Promise((resolve, reject) => {
      localProductCorsOrigin(origin, (error, value) =>
        error ? reject(error) : resolve(value)
      );
    });
  }

  test("allows only the local product UI and origin-less health checks", async () => {
    Object.assign(process.env, {
      POLICY_SINGLE_USER_NO_AUTH: "true",
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: "3002",
    });

    await expect(allowed("http://127.0.0.1:3002")).resolves.toBe(true);
    await expect(allowed(undefined)).resolves.toBe(true);
    await expect(allowed("https://attacker.example")).resolves.toBe(false);
    await expect(allowed("http://localhost:3002")).resolves.toBe(false);
  });

  test("preserves upstream permissive behavior outside managed mode", async () => {
    delete process.env.POLICY_SINGLE_USER_NO_AUTH;
    await expect(allowed("https://example.test")).resolves.toBe(true);
  });

  test("rejects a foreign browser request before endpoint mutation", () => {
    Object.assign(process.env, {
      POLICY_SINGLE_USER_NO_AUTH: "true",
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: "3002",
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

    rejectForeignProductOrigin(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
