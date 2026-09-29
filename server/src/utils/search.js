// Turns what someone typed in a search box into a safe, literal pattern for
// MongoDB's $regex: special characters are escaped (so "(a+)+$" can't slow the
// database down) and very long input is cut short.
export const MAX_SEARCH_LENGTH = 100;

export function searchPattern(q) {
  return String(q ?? '')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
