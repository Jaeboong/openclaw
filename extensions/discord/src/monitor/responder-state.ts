import { readFileSync } from "node:fs";

export const NANOCLAW_RESPONDER_STATE_PATH_ENV = "NANOCLAW_RESPONDER_STATE_PATH";

export type SharedResponder = "claude" | "codex" | "both" | "unconfigured";

export type SharedResponderDecision = {
  responder: SharedResponder;
  shouldHandle: boolean;
  reason: "not-configured" | "selected" | "missing-channel" | "invalid-state";
};

type Env = Record<string, string | undefined>;

function isResponder(value: unknown): value is Exclude<SharedResponder, "unconfigured"> {
  return value === "claude" || value === "codex" || value === "both";
}

function readChannelResponder(state: unknown, channelJid: string): SharedResponderDecision {
  if (!state || typeof state !== "object") {
    return { responder: "claude", shouldHandle: false, reason: "invalid-state" };
  }

  const channels = (state as { channels?: unknown }).channels;
  if (!channels || typeof channels !== "object") {
    return { responder: "claude", shouldHandle: false, reason: "invalid-state" };
  }

  const channelState = (channels as Record<string, unknown>)[channelJid];
  if (!channelState || typeof channelState !== "object") {
    return { responder: "claude", shouldHandle: false, reason: "missing-channel" };
  }

  const responder = (channelState as { responder?: unknown }).responder;
  if (!isResponder(responder)) {
    return { responder: "claude", shouldHandle: false, reason: "invalid-state" };
  }

  return {
    responder,
    shouldHandle: responder === "codex" || responder === "both",
    reason: "selected",
  };
}

export function resolveSharedResponderDecision(
  channelId: string,
  env: Env = process.env,
): SharedResponderDecision {
  const statePath = env[NANOCLAW_RESPONDER_STATE_PATH_ENV]?.trim();
  if (!statePath) {
    return { responder: "unconfigured", shouldHandle: true, reason: "not-configured" };
  }

  try {
    const state = JSON.parse(readFileSync(statePath, "utf8")) as unknown;
    return readChannelResponder(state, `dc:${channelId}`);
  } catch {
    return { responder: "claude", shouldHandle: false, reason: "invalid-state" };
  }
}
