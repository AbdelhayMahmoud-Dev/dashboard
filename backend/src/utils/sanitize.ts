/**
 * Escape a user-supplied string so it can be embedded safely inside a MongoDB
 * `$regex` query. Without this, characters like `(`, `*`, `+`, `[` are
 * interpreted as regex metacharacters — at best returning wrong results, at
 * worst enabling a ReDoS (catastrophic backtracking) denial-of-service via a
 * crafted search term. Use for any free-text field matched with `$regex`.
 */
export const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
