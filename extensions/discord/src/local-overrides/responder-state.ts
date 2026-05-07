import { readFileSync } from "node:fs";

export const NANOCLAW_RESPONDER_STATE_PATH_ENV = "NANOCLAW_RESPONDER_STATE_PATH";

export type SharedResponder = "claude" | "codex" | "both" | "unconfigured";

export type SharedResponderDecision = {
  responder: SharedResponder;
  shouldHandle: boolean;
  reason: "not-configured" | "selected" | "missing-channel" | "invalid-state";
};

type Env = Record<string, string | undefined>;
type SharedResponderGateReason =
  | SharedResponderDecision["reason"]
  | "other-bot-mention"
  | "mentioned"
  | "not-guild";

export type SharedResponderGateDecision = {
  responder: SharedResponder;
  skip: boolean;
  reason: SharedResponderGateReason;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isResponder(value: unknown): value is Exclude<SharedResponder, "unconfigured"> {
  return value === "claude" || value === "codex" || value === "both";
}

function readChannelResponder(state: unknown, channelJid: string): SharedResponderDecision {
  if (!isRecord(state)) {
    return { responder: "claude", shouldHandle: false, reason: "invalid-state" };
  }

  const channels = state.channels;
  if (!isRecord(channels)) {
    return { responder: "claude", shouldHandle: false, reason: "invalid-state" };
  }

  const channelState = channels[channelJid];
  if (!isRecord(channelState)) {
    return { responder: "claude", shouldHandle: false, reason: "missing-channel" };
  }

  const responder = channelState.responder;
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

export function shouldSkipForSharedResponder(params: {
  readonly isGuildMessage: boolean;
  readonly wasMentioned: boolean;
  readonly mentionedOtherBot: boolean;
  readonly messageChannelId: string;
}): SharedResponderGateDecision {
  if (!params.isGuildMessage) {
    return { skip: false, responder: "unconfigured", reason: "not-guild" };
  }

  if (params.wasMentioned) {
    return { skip: false, responder: "unconfigured", reason: "mentioned" };
  }

  if (params.mentionedOtherBot) {
    return { skip: true, responder: "unconfigured", reason: "other-bot-mention" };
  }

  const decision = resolveSharedResponderDecision(params.messageChannelId);
  return {
    skip: !decision.shouldHandle,
    responder: decision.responder,
    reason: decision.reason,
  };
}
