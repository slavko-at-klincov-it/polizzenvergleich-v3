jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  writeFileSync: jest.fn(),
}));
jest.mock("../../../utils/vectorStore/resetAllVectorStores", () => ({
  resetAllVectorStores: jest.fn(),
}));
jest.mock("../../../models/eventLogs", () => ({
  EventLogs: { logEvent: jest.fn() },
}));

describe("local installer environment persistence", () => {
  const managed = {
    SERVER_HOST: "127.0.0.1",
    COLLECTOR_HOST: "127.0.0.1",
    COLLECTOR_API_HOST: "127.0.0.1",
    LOCAL_ONLY_MODE: "true",
  };

  afterEach(() => {
    for (const key of Object.keys(managed)) delete process.env[key];
    require("fs").writeFileSync.mockClear();
  });

  it("keeps local security settings when AnythingLLM dumps .env", () => {
    Object.assign(process.env, managed);
    const { dumpENV } = require("../../../utils/helpers/updateENV");
    dumpENV();
    const content = require("fs").writeFileSync.mock.calls[0][1];
    for (const [key, value] of Object.entries(managed)) {
      expect(content).toContain(`${key}='${value}'`);
    }
  });
});
