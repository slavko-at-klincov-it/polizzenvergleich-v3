jest.mock("@mintplex-labs/express-ws", () => ({ default: jest.fn() }));
jest.mock("../../../models/telemetry", () => ({
  Telemetry: { flush: jest.fn() },
}));
jest.mock("../../../utils/BackgroundWorkers", () => ({
  BackgroundService: jest.fn(() => ({ boot: jest.fn() })),
}));
jest.mock("../../../utils/EncryptionManager", () => ({
  EncryptionManager: jest.fn(),
}));
jest.mock("../../../utils/comKey", () => ({ CommunicationKey: jest.fn() }));
jest.mock("../../../utils/telemetry", () => jest.fn());
jest.mock("../../../utils/boot/eagerLoadContextWindows", () => jest.fn());
jest.mock("../../../utils/boot/markOnboarded", () => jest.fn());
jest.mock("../../../utils/PushNotifications", () => ({
  PushNotifications: { setupPushNotificationService: jest.fn() },
}));
jest.mock("../../../utils/telegramBot", () => ({
  TelegramBotService: { bootIfActive: jest.fn() },
}));

describe("server host binding", () => {
  const originalServerHost = process.env.SERVER_HOST;
  const originalHttpsKeyPath = process.env.HTTPS_KEY_PATH;
  const originalHttpsCertPath = process.env.HTTPS_CERT_PATH;

  afterEach(() => {
    if (originalServerHost === undefined) delete process.env.SERVER_HOST;
    else process.env.SERVER_HOST = originalServerHost;
    if (originalHttpsKeyPath === undefined) delete process.env.HTTPS_KEY_PATH;
    else process.env.HTTPS_KEY_PATH = originalHttpsKeyPath;
    if (originalHttpsCertPath === undefined) delete process.env.HTTPS_CERT_PATH;
    else process.env.HTTPS_CERT_PATH = originalHttpsCertPath;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it("uses SERVER_HOST for the HTTP listener", () => {
    process.env.SERVER_HOST = "127.0.0.1";
    const { bootHTTP, getServerHost } = require("../../../utils/boot");
    const on = jest.fn();
    const listen = jest.fn(() => ({ on }));

    bootHTTP({ listen }, 3003);

    expect(getServerHost()).toBe("127.0.0.1");
    expect(listen).toHaveBeenCalledWith(
      3003,
      "127.0.0.1",
      expect.any(Function)
    );
    expect(on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("uses SERVER_HOST for the HTTPS listener", () => {
    process.env.SERVER_HOST = "127.0.0.1";
    process.env.HTTPS_KEY_PATH = "/tmp/test-key.pem";
    process.env.HTTPS_CERT_PATH = "/tmp/test-cert.pem";
    const fs = require("fs");
    const https = require("https");
    jest.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from("test"));
    const on = jest.fn();
    const listen = jest.fn(() => ({ on }));
    jest.spyOn(https, "createServer").mockReturnValue({ listen });
    const { bootSSL } = require("../../../utils/boot");

    bootSSL({}, 3443);

    expect(listen).toHaveBeenCalledWith(
      3443,
      "127.0.0.1",
      expect.any(Function)
    );
    expect(on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("keeps the upstream default when SERVER_HOST is unset", () => {
    delete process.env.SERVER_HOST;
    const { getServerHost } = require("../../../utils/boot");
    expect(getServerHost()).toBe("0.0.0.0");
  });
});
