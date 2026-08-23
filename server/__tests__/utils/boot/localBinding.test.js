describe("local deployment binding", () => {
  const originalServerHost = process.env.SERVER_HOST;
  const originalCollectorHost = process.env.COLLECTOR_API_HOST;
  const originalCollectorPort = process.env.COLLECTOR_PORT;

  afterEach(() => {
    if (originalServerHost === undefined) delete process.env.SERVER_HOST;
    else process.env.SERVER_HOST = originalServerHost;
    if (originalCollectorHost === undefined)
      delete process.env.COLLECTOR_API_HOST;
    else process.env.COLLECTOR_API_HOST = originalCollectorHost;
    if (originalCollectorPort === undefined) delete process.env.COLLECTOR_PORT;
    else process.env.COLLECTOR_PORT = originalCollectorPort;
    jest.resetModules();
  });

  it("allows the installer to restrict the primary server to loopback", () => {
    process.env.SERVER_HOST = "127.0.0.1";
    const { getServerHost } = require("../../../utils/boot");
    expect(getServerHost()).toBe("127.0.0.1");
  });

  it("uses loopback for server-to-collector calls", () => {
    process.env.COLLECTOR_API_HOST = "127.0.0.1";
    process.env.COLLECTOR_PORT = "8888";
    const { CollectorApi } = require("../../../utils/collectorApi");
    expect(new CollectorApi().endpoint).toBe("http://127.0.0.1:8888");
  });
});
