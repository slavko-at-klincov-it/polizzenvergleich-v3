function coverageError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function collectUniqueIds(values, getId, duplicateCode) {
  const ids = [];
  const seen = new Set();
  for (const value of values) {
    const id = String(getId(value) || "").trim();
    if (!id) throw coverageError("CATEGORY_COVERAGE_ID_REQUIRED");
    if (seen.has(id)) throw coverageError(duplicateCode, id);
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Compares the visible customer rows from the finished prompt with the
 * requirements actually represented by an adapted occurrence catalog.
 * Role: validate. Inputs/outputs are plain data. Side effects: none.
 */
function evaluateCategoryCatalogCoverage({ categoryDefinitions, catalog }) {
  if (!Array.isArray(categoryDefinitions) || categoryDefinitions.length === 0)
    throw coverageError("CATEGORY_DEFINITIONS_EMPTY");
  if (!catalog || !Array.isArray(catalog.requirements))
    throw coverageError("CATEGORY_OCCURRENCE_CATALOG_INVALID");

  const expectedIds = collectUniqueIds(
    categoryDefinitions,
    ({ id }) => id,
    "CATEGORY_DEFINITION_ID_DUPLICATE"
  );
  const catalogIds = collectUniqueIds(
    catalog.requirements,
    ({ id }) => id,
    "CATEGORY_CATALOG_ID_DUPLICATE"
  );
  const expected = new Set(expectedIds);
  const represented = new Set(catalogIds);
  const missingIds = expectedIds.filter((id) => !represented.has(id));
  const extraIds = catalogIds.filter((id) => !expected.has(id));
  const orderMatches =
    expectedIds.length === catalogIds.length &&
    expectedIds.every((id, index) => id === catalogIds[index]);
  const catalogById = new Map(
    catalog.requirements.map((requirement) => [
      String(requirement.id || "").trim(),
      requirement,
    ])
  );
  const labelMismatches = categoryDefinitions.flatMap((definition) => {
    const catalogRequirement = catalogById.get(definition.id);
    if (!catalogRequirement || catalogRequirement.label === definition.label)
      return [];
    return [
      {
        id: definition.id,
        expected: definition.label,
        observed: catalogRequirement.label || null,
      },
    ];
  });

  return {
    pass:
      missingIds.length === 0 &&
      extraIds.length === 0 &&
      orderMatches &&
      labelMismatches.length === 0,
    categoryView: catalog.categoryView || null,
    expectedCount: expectedIds.length,
    representedCount: expectedIds.length - missingIds.length,
    coveragePercent: Number(
      (
        ((expectedIds.length - missingIds.length) / expectedIds.length) *
        100
      ).toFixed(2)
    ),
    missingIds,
    extraIds,
    orderMatches,
    labelMismatches,
  };
}

function assertCompleteCategoryCatalogCoverage(input) {
  const result = evaluateCategoryCatalogCoverage(input);
  if (!result.pass)
    throw coverageError(
      "CATEGORY_CATALOG_COVERAGE_INCOMPLETE",
      `missing=${result.missingIds.join(",")};extra=${result.extraIds.join(
        ","
      )};order=${result.orderMatches};labels=${result.labelMismatches
        .map(({ id }) => id)
        .join(",")}`
    );
  return result;
}

module.exports = {
  assertCompleteCategoryCatalogCoverage,
  evaluateCategoryCatalogCoverage,
};
