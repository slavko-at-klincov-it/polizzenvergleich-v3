jest.mock("../../../utils/comKey", () => ({
  CommunicationKey: jest.fn(() => ({})),
}));
jest.mock("../../../utils/EncryptionManager", () => ({
  EncryptionManager: jest.fn(),
}));

describe("CollectorApi host configuration", () => {
  const originalHost = process.env.COLLECTOR_API_HOST;
  const originalPort = process.env.COLLECTOR_PORT;

  afterEach(() => {
    if (originalHost === undefined) delete process.env.COLLECTOR_API_HOST;
    else process.env.COLLECTOR_API_HOST = originalHost;
    if (originalPort === undefined) delete process.env.COLLECTOR_PORT;
    else process.env.COLLECTOR_PORT = originalPort;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it("builds the endpoint from a configured host and port", () => {
    process.env.COLLECTOR_API_HOST = "127.0.0.1";
    process.env.COLLECTOR_PORT = "8899";
    const { CollectorApi } = require("../../../utils/collectorApi");

    expect(new CollectorApi().endpoint).toBe("http://127.0.0.1:8899");
  });

  it("keeps the upstream-compatible host default", () => {
    delete process.env.COLLECTOR_API_HOST;
    delete process.env.COLLECTOR_PORT;
    const { CollectorApi } = require("../../../utils/collectorApi");

    expect(new CollectorApi().endpoint).toBe("http://0.0.0.0:8888");
  });

  it("accepts service hostnames and IPv6 addresses", () => {
    const { CollectorApi } = require("../../../utils/collectorApi");

    process.env.COLLECTOR_API_HOST = "collector.internal";
    expect(new CollectorApi().endpoint).toBe("http://collector.internal:8888");
    process.env.COLLECTOR_API_HOST = "::1";
    expect(new CollectorApi().endpoint).toBe("http://[::1]:8888");
  });

  it("rejects schemes, paths, ports, and malformed hostnames", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { CollectorApi } = require("../../../utils/collectorApi");

    for (const host of [
      "https://collector.internal",
      "collector.internal/path",
      "collector.internal:9999",
      "-collector.internal",
    ]) {
      process.env.COLLECTOR_API_HOST = host;
      expect(new CollectorApi().endpoint).toBe("http://0.0.0.0:8888");
    }
    expect(warn).toHaveBeenCalledTimes(4);
  });
});
