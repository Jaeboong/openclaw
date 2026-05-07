# Discord Plugin Replacement Feasibility

Date: 2026-05-07

## Question

Can a local Discord plugin replace bundled `@openclaw/discord` without patching
OpenClaw source?

## Findings

- Duplicate plugin id behavior: feasible only when the local replacement uses
  the same plugin id, `discord`, and is discovered as a config-origin plugin.
  `src/plugins/discovery.ts` loads `plugins.load.paths` entries with
  `origin: "config"`, and `src/plugins/manifest-registry.ts` resolves duplicate
  plugin ids by precedence before runtime loading. Config-origin duplicates win
  over bundled duplicates, so the bundled `discord` manifest is dropped instead
  of loaded beside the local one.
- Duplicate channel id behavior: a different plugin id that registers channel id
  `discord` is not a clean replacement. `src/plugins/registry.ts` rejects a
  runtime channel registration when another plugin already owns the same channel
  id, and reports `channel already registered: discord (...)`.
- Required config knobs: the local package would need to be pinned through
  `plugins.load.paths` and enabled through normal plugin activation policy. If
  an allowlist is present, the replacement plugin id must be allowed explicitly;
  channel-config auto-enablement is a bundled-plugin bypass and does not make a
  non-bundled duplicate pass an allowlist by itself.
- Required local package shape: the replacement must be a full Discord plugin,
  not just override helpers. It needs plugin id `discord`, channel metadata for
  `channels.discord`, the setup/configured-state surfaces, runtime registration,
  dependencies, package metadata, and any current `@openclaw/discord` public
  API/runtime API expected by OpenClaw.
- Runtime risk: replacement avoids patching upstream source only by carrying a
  full fork of the Discord plugin. That shifts rebase conflicts from a small
  call-site patch queue to a larger plugin fork that must track upstream
  manifest, setup, dependency, runtime, and channel contract changes.

## Decision

- `replacement-plugin-now`: no. It is technically possible with a same-id
  config-origin plugin, but it is larger and riskier than the current local
  module plus small call-site patch queue.
- `patch-queue-until-upstream-hook`: yes. Keep pure local logic in
  `extensions/discord/src/local-overrides` and carry only the narrow Discord
  call-site patches until OpenClaw exposes an upstream channel hook for
  responder gating and outbound section rendering.
