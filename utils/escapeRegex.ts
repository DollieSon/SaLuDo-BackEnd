// Escape user input for safe use inside a MongoDB $regex / RegExp.
// Coerces to string (query params can be arrays/objects) and caps the length
// so search terms can't be used for ReDoS or "match everything" patterns.
const MAX_SEARCH_LENGTH = 100;

export const escapeRegex = (value: unknown): string =>
  String(value ?? "")
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
