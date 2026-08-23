import { describe, expect, it, beforeEach } from "vitest";
import {
  consumePostCompactionBootstrapRequired,
  markPostCompactionBootstrapRequired,
  __testUtils_resetPostCompactionBootstrap,
} from "../src/cursor-post-compaction-bootstrap.js";

describe("cursor-post-compaction-bootstrap", () => {
  beforeEach(() => {
    __testUtils_resetPostCompactionBootstrap();
  });

  it("marks and consumes bootstrap once per scope", () => {
    const scopeKey = "/tmp/sessions/test.jsonl";
    markPostCompactionBootstrapRequired(scopeKey);
    expect(consumePostCompactionBootstrapRequired(scopeKey)).toBe(true);
    expect(consumePostCompactionBootstrapRequired(scopeKey)).toBe(false);
  });

  it("tracks scopes independently", () => {
    markPostCompactionBootstrapRequired("scope-a");
    markPostCompactionBootstrapRequired("scope-b");
    expect(consumePostCompactionBootstrapRequired("scope-a")).toBe(true);
    expect(consumePostCompactionBootstrapRequired("scope-b")).toBe(true);
  });
});
