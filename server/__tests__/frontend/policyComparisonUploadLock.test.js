const uploadLock = require("../../../frontend/src/utils/chat/policyComparisonUploadLock.cjs");

describe("policy comparison upload lock", () => {
  test("fails closed until the persisted comparison state is known", () => {
    expect(
      uploadLock.isNormalChatUploadLocked(
        uploadLock.UNKNOWN_COMPARISON_DOCUMENT_COUNT
      )
    ).toBe(true);
  });

  test("opens only for a known empty comparison and locks for documents", () => {
    expect(uploadLock.isNormalChatUploadLocked(0)).toBe(false);
    expect(uploadLock.isNormalChatUploadLocked(1)).toBe(true);
    expect(uploadLock.isNormalChatUploadLocked(18)).toBe(true);
  });
});
