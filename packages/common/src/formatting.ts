export const renderFacetValues = (facetValues: Map<string, Array<string>>): string => {
  return Array.from(facetValues.entries())
    .map(([facet, values]) => `${facet}: ${values.join(", ")}`)
    .join("\n");
};
