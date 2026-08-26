describe("collector host binding", () => {
  const originalCollectorHost = process.env.COLLECTOR_HOST;

  afterEach(() => {
    if (originalCollectorHost === undefined) delete process.env.COLLECTOR_HOST;
    else process.env.COLLECTOR_HOST = originalCollectorHost;
    jest.resetModules();
  });

  it("accepts a configured loopback listener", () => {
    process.env.COLLECTOR_HOST = "127.0.0.1";
    const { getCollectorHost } = require("../../../utils/http");
    expect(getCollectorHost()).toBe("127.0.0.1");
  });

  it("keeps the upstream default when COLLECTOR_HOST is unset", () => {
    delete process.env.COLLECTOR_HOST;
    const { getCollectorHost } = require("../../../utils/http");
    expect(getCollectorHost()).toBe("0.0.0.0");
  });
});
