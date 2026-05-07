# OpenClaw Local Overrides Design

**Goal:** Keep local NanoClaw/OpenClaw integration behavior while minimizing conflicts when rebasing onto upstream OpenClaw.

**Decision:** Move host-specific runtime wiring out of tracked upstream files immediately. Keep Discord behavior as a small, explicit patch queue unless OpenClaw exposes a suitable hook.

## Current Local Behavior

The local deployment adds three behavior groups:

- Docker runtime wiring mounts `/project/job`, `/Agents-Harness`, and `/host-nanoclaw-config`, and passes `NANOCLAW_RESPONDER_STATE_PATH`.
- Discord final replies can render section headers such as `## 분석` and `## 결론` as ledger-style embeds.
- Discord inbound routing consults NanoClaw responder state so direct mentions go to the mentioned bot, while unmentioned messages route according to `claude`, `codex`, or `both`.

## Boundary Model

`docker-compose.yml` changes are instance configuration, not OpenClaw product code. They must live in a local override compose file and environment variables.

Discord ledger rendering belongs to the Discord channel extension. It is not OpenClaw core, but it still tracks upstream source under `extensions/discord`; keep it as a small extension patch unless a plugin replacement becomes practical.

Responder arbitration cannot be reproduced with static OpenClaw config. `requireMention` and `ignoreOtherMentions` solve only part of the problem. Dynamic `responder-state.json` gating needs either a Discord ingress sidecar that owns the gateway, or a pre-enqueue monitor patch. The sidecar would duplicate too much Discord behavior, so keep a minimal monitor patch queue.

## Target Shape

- `docker-compose.yml` returns to upstream shape.
- `docker-compose.local.yml` owns all host-specific mounts and local env.
- `/home/ubuntu/project/job` remains the mounted job workspace exposed as `/project/job`.
- `/Agents-Harness` remains read-only.
- `/home/ubuntu/.config/nanoclaw` remains read-only as `/host-nanoclaw-config`.
- Ledger code stays isolated in `extensions/discord/src/discord-response-sections.ts` plus the smallest outbound call sites.
- Responder code stays isolated in `extensions/discord/src/monitor/responder-state.ts` plus the smallest queue gate call sites.

## Patch Queue Policy

Keep local commits feature-scoped:

- `local-compose-overrides`: override file and docs only.
- `discord-ledger-embeds`: Discord outbound embed behavior only.
- `discord-responder-gate`: responder state and mention routing only.

When pulling upstream, rebase these commits one at a time. If conflict cost grows, revisit either an upstream hook proposal or a sidecar.

## Non-Goals

- Do not fork all of OpenClaw.
- Do not replace OpenClaw Discord gateway with a sidecar in this phase.
- Do not expose gateway tokens or Discord tokens in docs or chat.
- Do not move `/home/ubuntu/project/job` content into the OpenClaw repo.
