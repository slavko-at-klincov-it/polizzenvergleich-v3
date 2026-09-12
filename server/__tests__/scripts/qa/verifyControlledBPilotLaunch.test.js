const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createLaunchRunReceipt,
  readTrustAnchorPin,
  validateInputManifestBinding,
} = require("../../../scripts/qa/verifyControlledBPilotLaunch.cjs");

function fixture() {
  const dynamicManifest = {
    manifestSha256: "a".repeat(64),
    documents: [
      {
        documentUuid: "a-document",
        documentSha256: "1".repeat(64),
        documentPosition: 0,
      },
    ],
  };
  const inputManifest = {
    documents: [
      {
        side: "A",
        uuid: "a-document",
        sha256: "1".repeat(64),
        position: 0,
      },
      {
        side: "B",
        uuid: "b-document-1",
        sha256: "2".repeat(64),
        position: 0,
      },
      {
        side: "B",
        uuid: "b-document-2",
        sha256: "3".repeat(64),
        position: 1,
      },
    ],
  };
  return { dynamicManifest, inputManifest };
}

describe("controlled B-pilot launch binding", () => {
  test("binds the exact A document and every uploaded B document", () => {
    const { dynamicManifest, inputManifest } = fixture();
    expect(
      validateInputManifestBinding({ inputManifest, dynamicManifest })
    ).toEqual([
      {
        uuid: "b-document-1",
        documentSha256: "2".repeat(64),
        position: 0,
      },
      {
        uuid: "b-document-2",
        documentSha256: "3".repeat(64),
        position: 1,
      },
    ]);
    const inputManifestBytes = Buffer.from(JSON.stringify(inputManifest));
    const receipt = createLaunchRunReceipt({
      launch: {
        launchSha256: "4".repeat(64),
        gateSha256: "5".repeat(64),
      },
      inputManifest,
      inputManifestBytes,
      dynamicManifest,
    });
    expect(receipt).toMatchObject({
      status: "CONTROLLED_B_PILOT_LAUNCH_VALIDATED",
      bDocumentCount: 2,
      inputManifestFileSha256: crypto
        .createHash("sha256")
        .update(inputManifestBytes)
        .digest("hex"),
      bPilotAllowed: true,
      fullOnePlusNineAllowed: false,
      productRoutingAllowed: false,
      customerWorkbookAllowed: false,
      deploymentAllowed: false,
    });
  });

  test("rejects a different A source or a partial/non-B document scope", () => {
    const { dynamicManifest, inputManifest } = fixture();
    inputManifest.documents[0].sha256 = "9".repeat(64);
    expect(() =>
      validateInputManifestBinding({ inputManifest, dynamicManifest })
    ).toThrow("LF_A_CONTROLLED_B_PILOT_A_DOCUMENT_MISMATCH");

    const missingB = fixture();
    missingB.inputManifest.documents = missingB.inputManifest.documents.filter(
      ({ side }) => side === "A"
    );
    expect(() => validateInputManifestBinding(missingB)).toThrow(
      "LF_A_CONTROLLED_B_PILOT_DOCUMENT_SCOPE_INVALID"
    );

    const unknownSide = fixture();
    unknownSide.inputManifest.documents.push({
      side: "C",
      uuid: "ignored-document",
      sha256: "8".repeat(64),
      position: 0,
    });
    expect(() => validateInputManifestBinding(unknownSide)).toThrow(
      "LF_A_CONTROLLED_B_PILOT_DOCUMENT_SCOPE_INVALID"
    );
  });

  test("reads the trust anchor digest only from a protected regular file", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lf-b-pilot-pin-"));
    const pin = path.join(root, "anchor.sha256");
    fs.writeFileSync(pin, `${"a".repeat(64)}\n`, { mode: 0o400 });
    expect(readTrustAnchorPin(pin)).toBe("a".repeat(64));

    const symbolic = path.join(root, "symbolic.sha256");
    fs.symlinkSync(pin, symbolic);
    expect(() => readTrustAnchorPin(symbolic)).toThrow(
      "LF_A_CONTROLLED_B_PILOT_TRUST_ANCHOR_PIN_INVALID"
    );
    fs.chmodSync(pin, 0o620);
    expect(() => readTrustAnchorPin(pin)).toThrow(
      "LF_A_CONTROLLED_B_PILOT_TRUST_ANCHOR_PIN_INVALID"
    );
  });
});
