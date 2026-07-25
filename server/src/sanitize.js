export const NAME_MAX_LEN = 40;

// Absent/empty values resolve to `fallback` — only a present-but-wrong-typed
// value (e.g. a number, array, or object where a name/label was expected) is
// treated as a real validation failure and reported via `ok: false`.
export function sanitizeName(value, fallback, maxLen = NAME_MAX_LEN) {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: fallback };
  }
  if (typeof value !== "string") {
    return { ok: false, value: null };
  }
  const trimmed = value.trim().slice(0, maxLen);
  return { ok: true, value: trimmed || fallback };
}
