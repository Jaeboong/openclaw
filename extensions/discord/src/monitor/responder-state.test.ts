import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSharedResponderDecision } from "./responder-state.js";

function withResponderState(contents: string) {
  const dir = mkdtempSync(join(tmpdir(), "openclaw-responder-state-"));
  const path = join(dir, "responder-state.json");
  writeFileSync(path, contents, "utf8");
  return {
    env: { NANOCLAW_RESPONDER_STATE_PATH: path },
    cleanup: () => rmSync(dir, { force: true, recursive: true }),
  };
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
