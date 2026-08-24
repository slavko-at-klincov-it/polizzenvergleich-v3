const {
  PromptOutputContractParser,
  DEFAULT_COLUMNS,
} = require("./PromptOutputContractParser");
const { ComparisonFactRowPlanner } = require("./ComparisonFactRowPlanner");

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\|/gu, "\\|")
    .replace(/\r?\n/gu, " ")
    .trim();
}

const ComparisonFactTable = {
  columns: DEFAULT_COLUMNS.map((column) => column.label),

  isCompleteAnalysisRequest(query = "") {
    return PromptOutputContractParser.isCompleteAnalysisRequest(query);
  },

  plan(inventories = [], { userPrompt = "" } = {}) {
    const outputContract = PromptOutputContractParser.parse({ userPrompt });
    return ComparisonFactRowPlanner.plan({ inventories, outputContract });
  },

  assertCoverage(plan) {
    return ComparisonFactRowPlanner.assertCoverage(plan);
  },

  render(plan) {
    ComparisonFactRowPlanner.assertCoverage(plan);
    const hasRows = plan.documents.some((document) =>
      document.sections.some((section) => section.rows.length > 0)
    );
    if (!hasRows)
      return "Im vollständig verarbeiteten Dokument wurde kein belegter Vertragsfakt gefunden.";

    const output = [];
    for (const document of plan.documents) {
      output.push(`# Dokument ${document.slot} – ${document.title}`);
      for (const section of document.sections) {
        const depth = Math.min(6, Math.max(2, Number(section.level || 1) + 1));
        output.push(`${"#".repeat(depth)} ${section.key}. ${section.label}`);
        output.push(
          `| ${plan.outputContract.columns.map((column) => column.label).join(" | ")} |`
        );
        output.push(
          `| ${plan.outputContract.columns.map(() => "---").join(" | ")} |`
        );
        if (section.rows.length === 0) {
          const empty = Object.fromEntries(
            plan.outputContract.columns.map((column) => [
              column.key,
              column.role === "label" ? "im Dokument nicht gefunden" : "—",
            ])
          );
          output.push(
            `| ${plan.outputContract.columns.map((column) => escapeCell(empty[column.key])).join(" | ")} |`
          );
        } else {
          for (const row of section.rows)
            output.push(
              `| ${plan.outputContract.columns.map((column) => escapeCell(row.cells[column.key])).join(" | ")} |`
            );
        }
        output.push("");
      }
    }
    return output.join("\n").trim();
  },
};

module.exports = { ComparisonFactTable };
