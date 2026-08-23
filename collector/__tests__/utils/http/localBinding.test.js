describe("collector local binding", () => {
  afterEach(() => {
    delete process.env.COLLECTOR_HOST;
    jest.resetModules();
  });

  it("accepts the installer loopback host", () => {
    process.env.COLLECTOR_HOST = "127.0.0.1";
    const { getCollectorHost } = require("../../../utils/http");
    expect(getCollectorHost()).toBe("127.0.0.1");
  });

  it("uses the configured shared hotdir", () => {
    process.env.COLLECTOR_HOTDIR_PATH = "/private/policy-hotdir";
    const { WATCH_DIRECTORY } = require("../../../utils/constants");
    expect(WATCH_DIRECTORY).toBe("/private/policy-hotdir");
    delete process.env.COLLECTOR_HOTDIR_PATH;
  });
});
