export const normalizePrefixedId = (
  value: string,
  prefix: string,
  label: string,
): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return normalized.startsWith(`${prefix}-`) ? normalized : `${prefix}-${normalized}`;
};

export const normalizeNumericIndex = (value: number | string, label: string): string => {
  const normalized = String(value).trim();

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return normalized;
};