const path = require("path");

const repo = path.resolve(__dirname, "../../..");
const frontendFormats = require(path.join(
  repo,
  "frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/supportedComparisonFiles.cjs"
));
const serverFormats = require(path.join(
  repo,
  "server/utils/comparisonDocuments/supportedFormats.js"
));
const {
  SUPPORTED_FILETYPE_CONVERTERS,
} = require(path.join(repo, "collector/utils/constants.js"));

const allowed = [
  ["pdf", "application/pdf"],
  [
    "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ["odt", "application/vnd.oasis.opendocument.text"],
  ["txt", "text/plain"],
  ["md", "text/markdown"],
  ["csv", "text/csv"],
  [
    "xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  [
    "pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
];

describe("comparison document format contract", () => {
  test.each(allowed)("accepts .%s consistently", (extension, mime) => {
    const name = `Police.${extension}`;
    expect(
      frontendFormats.isSupportedComparisonFile({ name, type: mime })
    ).toBe(true);
    expect(
      serverFormats.isSupportedComparisonDocument({ filename: name, mime })
    ).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        SUPPORTED_FILETYPE_CONVERTERS,
        `.${extension}`
      )
    ).toBe(true);
  });

  test.each(["docx", "odt", "xlsx", "pptx"])(
    "accepts browser zip MIME for .%s while retaining the extension allowlist",
    (extension) => {
      const file = { name: `Police.${extension}`, type: "application/zip" };
      expect(frontendFormats.isSupportedComparisonFile(file)).toBe(true);
      expect(
        serverFormats.isSupportedComparisonDocument({
          filename: file.name,
          mime: file.type,
        })
      ).toBe(true);
    }
  );

  test("rejects unsupported or mismatched formats in frontend and server", () => {
    for (const file of [
      { name: "malware.exe", type: "application/octet-stream" },
      { name: "fake.pdf", type: "application/x-msdownload" },
    ]) {
      expect(frontendFormats.isSupportedComparisonFile(file)).toBe(false);
      expect(
        serverFormats.isSupportedComparisonDocument({
          filename: file.name,
          mime: file.type,
        })
      ).toBe(false);
    }
  });
});
