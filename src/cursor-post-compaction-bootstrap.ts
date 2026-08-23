import { getCursorSessionScopeKey } from "./cursor-session-scope.js";

const pendingByScope = new Set<string>();

/** Mark the next local Cursor send for this scope as a post-compaction bootstrap. */
export function markPostCompactionBootstrapRequired(
  scopeKey: string = getCursorSessionScopeKey(),
): void {
  pendingByScope.add(scopeKey);
}

/** Consume the post-compaction bootstrap marker for one turn. */
export function consumePostCompactionBootstrapRequired(
  scopeKey: string = getCursorSessionScopeKey(),
): boolean {
  if (!pendingByScope.delete(scopeKey)) return false;
  return true;
}

export function __testUtils_resetPostCompactionBootstrap(): void {
  pendingByScope.clear();
}
