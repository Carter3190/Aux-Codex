export type ProviderSearchQuery = {
  q?: string | string[];
  area?: string | string[];
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function getProviderSearchFilters(params: ProviderSearchQuery) {
  return {
    search: firstValue(params.q).trim().slice(0, 100),
    area: firstValue(params.area).trim().slice(0, 100),
  };
}

export function getProviderHomeDestination(params: ProviderSearchQuery) {
  const { search, area } = getProviderSearchFilters(params);
  const query = new URLSearchParams();
  if (search) query.set("q", search);
  if (area) query.set("area", area);
  const suffix = query.toString();
  return suffix ? `/?${suffix}` : "/";
}
