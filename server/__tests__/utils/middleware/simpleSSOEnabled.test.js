const settingsPath = require.resolve("../../../models/systemSettings");
const middlewarePath =
  require.resolve("../../../utils/middleware/simpleSSOEnabled");

function loadMiddleware(policyNoAuthMode) {
  jest.resetModules();
  jest.doMock(settingsPath, () => ({
    SystemSettings: {
      isPolicyNoAuthMode: jest.fn().mockResolvedValue(policyNoAuthMode),
      isMultiUserMode: jest.fn().mockResolvedValue(true),
    },
  }));
  return require(middlewarePath);
}

describe("managed no-login middleware", () => {
  test("blocks Simple SSO and invitation-based user creation", async () => {
    const { simpleSSOEnabled, simpleSSOLoginDisabledMiddleware } =
      loadMiddleware(true);
    const response = {
      locals: {},
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await simpleSSOEnabled({}, response, next);
    await simpleSSOLoginDisabledMiddleware({}, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
