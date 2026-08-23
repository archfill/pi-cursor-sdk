import { describe, it, expect } from "vitest";
import type { Context } from "@earendil-works/pi-ai";
import { computeCursorContextFingerprint } from "../src/context.js";
import {
  buildCursorSessionSendPrompt,
  MAX_COMPLETED_INCREMENTAL_SENDS_BEFORE_REBOOTSTRAP,
  planCursorSessionSend,
} from "../src/cursor-session-send-policy.js";
import { getCursorToolTailGuardText } from "../src/context.js";

describe("cursor-session-send-policy", () => {
  it("plans initial bootstrap without resetting the agent", () => {
    const context: Context = {
      messages: [{ role: "user", content: "Hello", timestamp: 1 }],
    };
    const plan = planCursorSessionSend(
      { bootstrapped: false, contextFingerprint: "", incrementalSendCount: 0 },
      context,
    );

    expect(plan).toEqual({
      mode: "bootstrap",
      resetAgent: false,
      reason: "initial",
    });
  });

  it("plans incremental sends below the rebootstrap threshold", () => {
    const priorContext: Context = {
      messages: [{ role: "user", content: "Hello", timestamp: 1 }],
    };
    const context: Context = {
      messages: [
        { role: "user", content: "Hello", timestamp: 1 },
        { role: "user", content: "Follow up", timestamp: 2 },
      ],
    };
    const sendState = {
      bootstrapped: true,
      contextFingerprint: computeCursorContextFingerprint(priorContext),
      incrementalSendCount:
        MAX_COMPLETED_INCREMENTAL_SENDS_BEFORE_REBOOTSTRAP - 1,
    };

    expect(planCursorSessionSend(sendState, context)).toEqual({
      mode: "incremental",
      resetAgent: false,
      reason: "incremental",
    });
  });

  it("plans agent reset and bootstrap at the incremental threshold", () => {
    const priorContext: Context = {
      messages: [{ role: "user", content: "Hello", timestamp: 1 }],
    };
    const context: Context = {
      messages: [
        { role: "user", content: "Hello", timestamp: 1 },
        { role: "user", content: "Follow up", timestamp: 2 },
      ],
    };
    const sendState = {
      bootstrapped: true,
      contextFingerprint: computeCursorContextFingerprint(priorContext),
      incrementalSendCount: MAX_COMPLETED_INCREMENTAL_SENDS_BEFORE_REBOOTSTRAP,
    };

    expect(planCursorSessionSend(sendState, context)).toEqual({
      mode: "bootstrap",
      resetAgent: true,
      reason: "incremental_threshold",
    });
  });

  it("reinjects tool boundary on incremental sends after compaction", () => {
    const priorContext: Context = {
      messages: [{ role: "user", content: "Hello", timestamp: 1 }],
    };
    const context: Context = {
      messages: [
        { role: "user", content: "Hello", timestamp: 1 },
        { role: "user", content: "Follow up", timestamp: 2 },
      ],
    };
    const sendState = {
      bootstrapped: true,
      contextFingerprint: computeCursorContextFingerprint(priorContext),
      incrementalSendCount: 1,
    };

    expect(
      planCursorSessionSend(sendState, context, {
        forcePostCompactionBootstrap: true,
      }),
    ).toEqual({
      mode: "incremental",
      resetAgent: false,
      reason: "post_compaction",
    });
  });
  it("plans context-divergence bootstrap with agent reset", () => {
    const priorContext: Context = {
      messages: [{ role: "user", content: "Hello", timestamp: 1 }],
    };
    const editedContext: Context = {
      messages: [{ role: "user", content: "Hello edited", timestamp: 1 }],
    };
    const sendState = {
      bootstrapped: true,
      contextFingerprint: computeCursorContextFingerprint(priorContext),
      incrementalSendCount: 2,
    };

    expect(planCursorSessionSend(sendState, editedContext)).toEqual({
      mode: "bootstrap",
      resetAgent: true,
      reason: "context_divergence",
    });
  });

  it("builds bootstrap and incremental prompts from the send plan", () => {
    const context: Context = {
      systemPrompt: "Be helpful.",
      messages: [{ role: "user", content: "Follow up", timestamp: 3 }],
    };
    const bootstrapPrompt = buildCursorSessionSendPrompt(
      context,
      {},
      {
        mode: "bootstrap",
        resetAgent: false,
        reason: "initial",
      },
    );
    const incrementalPrompt = buildCursorSessionSendPrompt(
      context,
      {},
      {
        mode: "incremental",
        resetAgent: false,
        reason: "incremental",
      },
    );

    expect(bootstrapPrompt.text).toContain("Cursor SDK tool boundary:");
    expect(bootstrapPrompt.text.endsWith(getCursorToolTailGuardText())).toBe(
      true,
    );
    expect(incrementalPrompt.text).not.toContain("Cursor SDK tool boundary:");
    expect(incrementalPrompt.text.endsWith(getCursorToolTailGuardText())).toBe(
      true,
    );
  });

  it("builds post-compaction prompts with tool boundary and manifest but without transcript tool-call lines", () => {
    const manifest = "Callable tool surfaces this run:\n- Pi bridge: pi__read";
    const context: Context = {
      systemPrompt: "Be helpful.",
      messages: [
        { role: "user", content: "Earlier", timestamp: 1 },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I will inspect the directory." },
            {
              type: "toolCall",
              id: "tc1",
              name: "bash",
              arguments: { command: "ls" },
            },
          ],
          api: "cursor-sdk",
          provider: "cursor",
          model: "test",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          stopReason: "toolUse",
          timestamp: 2,
        },
        { role: "user", content: "Follow up after compaction", timestamp: 3 },
      ],
    };
    const prompt = buildCursorSessionSendPrompt(
      context,
      { toolManifest: manifest },
      {
        mode: "incremental",
        resetAgent: false,
        reason: "post_compaction",
      },
    );

    expect(prompt.text).toContain("Cursor SDK tool boundary:");
    expect(prompt.text).toContain(manifest);
    expect(prompt.text).toContain("User: Follow up after compaction");
    expect(prompt.text).not.toContain("System instructions from pi:");
    expect(prompt.text).not.toContain("User: Earlier");
    expect(prompt.text).not.toContain("Tool call (bash, call tc1)");
    expect(prompt.text.endsWith(getCursorToolTailGuardText())).toBe(true);
  });
});
