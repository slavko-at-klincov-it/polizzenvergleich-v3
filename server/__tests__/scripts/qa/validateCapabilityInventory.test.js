const fs = require("fs");
const {
  DEFAULT_INVENTORY,
  validateCapabilityInventory,
} = require("../../../scripts/qa/validateCapabilityInventory.cjs");

function inventory() {
  return JSON.parse(fs.readFileSync(DEFAULT_INVENTORY, "utf8"));
}

describe("canonical policy capability inventory", () => {
  test("binds current files, entrypoints, callers, tests, contracts and workflows", () => {
    const summary = validateCapabilityInventory(inventory());
    expect(summary).toEqual(
      expect.objectContaining({
        inventoryId: "POLIZZENVERGLEICH_CAPABILITY_INVENTAR_V1",
        capabilities: expect.any(Number),
        workflows: 2,
        contractBindings: expect.any(Number),
      })
    );
    expect(summary.capabilities).toBeGreaterThanOrEqual(15);
    expect(summary.contractBindings).toBeGreaterThanOrEqual(15);
  });

  test("rejects an ACTIVE capability without a verified caller", () => {
    const value = inventory();
    const active = value.capabilities.find(({ activationStatus }) =>
      activationStatus.startsWith("ACTIVE_")
    );
    active.callers = [];
    expect(() => validateCapabilityInventory(value)).toThrow(
      "ACTIVE_CAPABILITY_CALLER_REQUIRED"
    );
  });

  test("rejects an unknown workflow capability", () => {
    const value = inventory();
    value.workflowMaps[0].nodes.push("CAP-UNKNOWN-999");
    expect(() => validateCapabilityInventory(value)).toThrow(
      "CAPABILITY_WORKFLOW_NODE_UNKNOWN"
    );
  });

  test("rejects a contract ID not present in its bound source", () => {
    const value = inventory();
    value.contractBindings[0].id = "LF_NONEXISTENT_CONTRACT_V999";
    expect(() => validateCapabilityInventory(value)).toThrow(
      "CAPABILITY_CONTRACT_BINDING_MISSING"
    );
  });
});
