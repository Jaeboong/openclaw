import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NANOCLAW_RESPONDER_STATE_PATH_ENV,
  resolveSharedResponderDecision,
  shouldSkipForSharedResponder,
} from "./responder-state.js";

function withResponderState(contents: string) {
  const dir = mkdtempSync(join(tmpdir(), "openclaw-responder-state-"));
  const path = join(dir, "responder-state.json");
  writeFileSync(path, contents, "utf8");
  return {
    env: { NANOCLAW_RESPONDER_STATE_PATH: path },
    cleanup: () => rmSync(dir, { force: true, recursive: true }),
  };
}

function withProcessResponderState<T>(contents: string, run: () => T): T {
  const state = withResponderState(contents);
  const previous = process.env[NANOCLAW_RESPONDER_STATE_PATH_ENV];
  process.env[NANOCLAW_RESPONDER_STATE_PATH_ENV] = state.env.NANOCLAW_RESPONDER_STATE_PATH;
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env[NANOCLAW_RESPONDER_STATE_PATH_ENV];
    } else {
      process.env[NANOCLAW_RESPONDER_STATE_PATH_ENV] = previous;
    }
    state.cleanup();
  }
}

describe("resolveSharedResponderDecision", () => {
  it("allows Discord messages when shared responder state is not configured", () => {
    expect(resolveSharedResponderDecision("1501435892466978886", {})).toMatchObject({
      responder: "unconfigured",
      shouldHandle: true,
    });
  });

  it("blocks OpenClaw when NanoClaw selected Claude for the channel", () => {
    const state = withResponderState(
      JSON.stringify({
        channels: {
          "dc:1501435892466978886": { responder: "claude" },
        },
      }),
    );
    try {
      expect(resolveSharedResponderDecision("1501435892466978886", state.env)).toMatchObject({
        responder: "claude",
        shouldHandle: false,
      });
    } finally {
      state.cleanup();
    }
  });

  it("allows OpenClaw when NanoClaw selected Codex or both for the channel", () => {
    const state = withResponderState(
      JSON.stringify({
        channels: {
          "dc:codex-channel": { responder: "codex" },
          "dc:both-channel": { responder: "both" },
        },
      }),
    );
    try {
      expect(resolveSharedResponderDecision("codex-channel", state.env)).toMatchObject({
        responder: "codex",
        shouldHandle: true,
      });
      expect(resolveSharedResponderDecision("both-channel", state.env)).toMatchObject({
        responder: "both",
        shouldHandle: true,
      });
    } finally {
      state.cleanup();
    }
  });
});

describe("shouldSkipForSharedResponder", () => {
  it("skips guild messages that mention another bot without mentioning OpenClaw", () => {
    expect(
      shouldSkipForSharedResponder({
        isGuildMessage: true,
        wasMentioned: false,
        mentionedOtherBot: true,
        messageChannelId: "codex-channel",
      }),
    ).toEqual({
      skip: true,
      responder: "unconfigured",
      reason: "other-bot-mention",
    });
  });

  it("skips unmentioned guild messages when shared responder state selects Claude", () => {
    withProcessResponderState(
      JSON.stringify({
        channels: {
          "dc:claude-channel": { responder: "claude" },
        },
      }),
      () => {
        expect(
          shouldSkipForSharedResponder({
            isGuildMessage: true,
            wasMentioned: false,
            mentionedOtherBot: false,
            messageChannelId: "claude-channel",
          }),
        ).toEqual({
          skip: true,
          responder: "claude",
          reason: "selected",
        });
      },
    );
  });

  it("does not skip mentioned or non-guild messages", () => {
    withProcessResponderState(
      JSON.stringify({
        channels: {
          "dc:claude-channel": { responder: "claude" },
        },
      }),
      () => {
        expect(
          shouldSkipForSharedResponder({
            isGuildMessage: true,
            wasMentioned: true,
            mentionedOtherBot: false,
            messageChannelId: "claude-channel",
          }).skip,
        ).toBe(false);
        expect(
          shouldSkipForSharedResponder({
            isGuildMessage: false,
            wasMentioned: false,
            mentionedOtherBot: false,
            messageChannelId: "claude-channel",
          }).skip,
        ).toBe(false);
      },
    );
  });
});
