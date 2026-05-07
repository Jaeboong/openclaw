# OpenClaw Discord Second-Stage Modularization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce the remaining Discord patch queue by moving local behavior into explicit modules, while keeping upstream OpenClaw rebase conflicts bounded and reversible.

**Architecture:** Keep OpenClaw upstream source as the baseline, keep `origin` pointed at the Jaeboong fork, and treat the current three local commits as the starting patch queue. Extract pure local behavior into a local Discord integration module first. Leave only minimal Discord call-site patches for hooks that OpenClaw does not expose yet. Defer a full Discord gateway sidecar unless hook/plugin replacement proves impossible and patch conflicts become expensive.

**Tech Stack:** OpenClaw TypeScript extensions, Discord channel plugin, Vitest, `tsgo`, Docker Compose local override, Git patch queue.

---

## Current Baseline

Current local patch queue on top of upstream `a8d8d49ab8`:

```text
629b3d635b feat(discord): gate shared responder messages
7bfeaf96d6 feat(discord): render ledger sections as embeds
8153703ba9 chore: isolate local openclaw overrides
```

Remote policy:

```text
origin   https://github.com/Jaeboong/openclaw.git
upstream https://github.com/openclaw/openclaw.git
upstream push disabled
```

Already completed:

- `docker-compose.yml` is clean from host-specific wiring.
- `docker-compose.local.yml` owns local mounts and `NANOCLAW_RESPONDER_STATE_PATH`.
- Discord ledger and responder behavior are split into two feature commits.

Remaining patch surface:

- `extensions/discord/src/outbound-adapter.ts`
- `extensions/discord/src/outbound-payload.ts`
- `extensions/discord/src/send.shared.ts`
- `extensions/discord/src/monitor/message-handler.ts`
- `extensions/discord/src/monitor/message-handler.preflight.ts`
- `extensions/discord/src/monitor/message-handler.preflight.types.ts`
- related tests

---

### Task 1: Prove the Local Module Boundary

**Files:**

- Read: `tsconfig.json`
- Read: `tsconfig.extensions.json`
- Read: `docs/plugins/sdk-channel-plugins.md`
- Read: `scripts/check-no-extension-src-imports.ts`
- Read: `scripts/check-extension-plugin-sdk-boundary.mjs`
- Create: `docs/plans/2026-05-07-openclaw-discord-module-boundary.md`

**Step 1: Inspect extension import boundary rules**

Run:

```bash
sed -n '1,220p' tsconfig.json
sed -n '1,220p' tsconfig.extensions.json
sed -n '1,220p' scripts/check-no-extension-src-imports.ts
sed -n '1,220p' scripts/check-extension-plugin-sdk-boundary.mjs
```

Expected: identify whether one extension can import another local extension module without failing boundary checks.

**Step 2: Document candidate module locations**

Create `docs/plans/2026-05-07-openclaw-discord-module-boundary.md` with this decision table:

```markdown
# Discord Local Module Boundary

| Candidate                                | Example Import                                              | Pros                           | Risks                                        | Decision |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------ | -------------------------------------------- | -------- |
| `extensions/nanoclaw-discord-local`      | `@openclaw/nanoclaw-discord-local/src/response-sections.js` | Outside upstream Discord files | May violate extension boundary checks        | TBD      |
| `extensions/discord/src/local-overrides` | `./local-overrides/response-sections.js`                    | Guaranteed local compile path  | Still inside upstream Discord extension tree | TBD      |
| `packages/nanoclaw-openclaw-discord`     | package import                                              | Product-independent module     | Requires package path/export wiring          | TBD      |
```

**Step 3: Pick implementation target**

Decision rule:

- Prefer `extensions/nanoclaw-discord-local` if boundary checks allow Discord to import it.
- Use `extensions/discord/src/local-overrides` if cross-extension imports fail.
- Do not add root `tsconfig` path aliases in this phase unless there is no other working option.

**Step 4: Commit boundary decision**

Run:

```bash
git add docs/plans/2026-05-07-openclaw-discord-module-boundary.md
git commit -m "docs: record discord local module boundary"
```

Expected: one docs-only commit.

---

### Task 2: Extract Ledger Renderer Into the Local Module

**Files:**

- Move: `extensions/discord/src/discord-response-sections.ts`
- Move: `extensions/discord/src/discord-response-sections.test.ts`
- Modify: `extensions/discord/src/outbound-adapter.ts`
- Modify: `extensions/discord/src/outbound-payload.ts`
- Test: moved ledger renderer test file

**Step 1: Move pure renderer implementation**

If Task 1 chose cross-extension module:

```text
extensions/nanoclaw-discord-local/src/response-sections.ts
extensions/nanoclaw-discord-local/src/response-sections.test.ts
extensions/nanoclaw-discord-local/package.json
```

If Task 1 chose in-Discord local overrides:

```text
extensions/discord/src/local-overrides/response-sections.ts
extensions/discord/src/local-overrides/response-sections.test.ts
```

Move the existing parser/renderer without behavior changes:

```ts
export function buildDiscordResponseEmbedMessages(text: string): DiscordResponseEmbedMessage[] {
  // existing implementation moved as-is
}
```

**Step 2: Update outbound call sites**

Update imports only.

For cross-extension module:

```ts
import { buildDiscordResponseEmbedMessages } from "@openclaw/nanoclaw-discord-local/src/response-sections.js";
```

For in-Discord fallback:

```ts
import { buildDiscordResponseEmbedMessages } from "./local-overrides/response-sections.js";
```

Do not change send behavior in this task.

**Step 3: Run focused ledger tests**

Run:

```bash
npm test -- extensions/**/response-sections.test.ts extensions/discord/src/outbound-adapter.test.ts extensions/discord/src/send.sends-basic-channel-messages.test.ts
```

Expected: ledger parser and outbound embed tests pass.

**Step 4: Run extension type/boundary checks**

Run:

```bash
npm run tsgo:extensions
npm run tsgo:extensions:test
npm run lint:extensions:no-relative-outside-package
npm run lint:plugins:no-extension-src-imports
```

Expected: all checks pass. If a boundary check fails because cross-extension import is disallowed, move the module to `extensions/discord/src/local-overrides` and re-run.

**Step 5: Commit**

Run:

```bash
git add extensions
git commit -m "refactor(discord): move ledger renderer to local module"
```

Expected: one commit that preserves behavior and shrinks outbound call-site changes.

---

### Task 3: Extract Responder Decision Logic Into the Local Module

**Files:**

- Move: `extensions/discord/src/monitor/responder-state.ts`
- Move: `extensions/discord/src/monitor/responder-state.test.ts`
- Modify: `extensions/discord/src/monitor/message-handler.ts`
- Test: moved responder state test file

**Step 1: Move responder state reader**

If Task 1 chose cross-extension module:

```text
extensions/nanoclaw-discord-local/src/responder-state.ts
extensions/nanoclaw-discord-local/src/responder-state.test.ts
```

If Task 1 chose in-Discord fallback:

```text
extensions/discord/src/local-overrides/responder-state.ts
extensions/discord/src/local-overrides/responder-state.test.ts
```

Move existing logic without behavior changes:

```ts
export function resolveSharedResponderDecision(
  channelId: string,
  env: Record<string, string | undefined> = process.env,
): SharedResponderDecision {
  // existing implementation moved as-is
}
```

**Step 2: Update monitor call site**

For cross-extension module:

```ts
import { resolveSharedResponderDecision } from "@openclaw/nanoclaw-discord-local/src/responder-state.js";
```

For in-Discord fallback:

```ts
import { resolveSharedResponderDecision } from "./local-overrides/responder-state.js";
```

Do not change queue gate behavior in this task.

**Step 3: Run focused responder tests**

Run:

```bash
npm test -- extensions/**/responder-state.test.ts extensions/discord/src/monitor/message-handler.queue.test.ts extensions/discord/src/monitor/message-handler.preflight.test.ts
```

Expected: responder state and monitor routing tests pass.

**Step 4: Run extension type/boundary checks**

Run:

```bash
npm run tsgo:extensions
npm run tsgo:extensions:test
npm run lint:extensions:no-relative-outside-package
npm run lint:plugins:no-extension-src-imports
```

Expected: all checks pass.

**Step 5: Commit**

Run:

```bash
git add extensions
git commit -m "refactor(discord): move responder state to local module"
```

Expected: one commit that preserves behavior and shrinks monitor call-site changes.

---

### Task 4: Minimize the Ledger Call-Site Patch

**Files:**

- Modify: `extensions/discord/src/outbound-adapter.ts`
- Modify: `extensions/discord/src/outbound-payload.ts`
- Modify: `extensions/discord/src/send.shared.ts`
- Test: `extensions/discord/src/outbound-adapter.test.ts`
- Test: `extensions/discord/src/send.sends-basic-channel-messages.test.ts`

**Step 1: Identify repeated embed send code**

Run:

```bash
rg -n "buildDiscordResponseEmbedMessages|embeds: message.embeds|sendFormattedText" extensions/discord/src
```

Expected: locate duplicated embed send logic in outbound adapter and payload delivery.

**Step 2: Extract transport helper if duplication remains**

If both outbound paths still duplicate embed-only send loops, create one helper near the Discord outbound code:

```text
extensions/discord/src/local-overrides/send-response-sections.ts
```

or inside the chosen local module if cross-extension imports passed:

```text
extensions/nanoclaw-discord-local/src/send-response-sections.ts
```

The helper should accept transport dependencies from Discord call sites rather than importing Discord runtime directly:

```ts
export async function sendDiscordResponseSectionMessages(params: {
  text: string;
  sendEmbed: (message: DiscordResponseEmbedMessage) => Promise<void>;
}): Promise<boolean> {
  const messages = buildDiscordResponseEmbedMessages(params.text);
  if (messages.length === 0) {
    return false;
  }
  for (const message of messages) {
    await params.sendEmbed(message);
  }
  return true;
}
```

**Step 3: Keep `send.shared.ts` patch isolated**

Do not mix embed-only send allowance with ledger parsing. `send.shared.ts` should only allow structured payloads with empty text:

```ts
const hasStructuredPayload = Boolean(components?.length || embeds?.length);
if (!text.trim() && !hasStructuredPayload) {
  throw new Error("Message must be non-empty for Discord sends");
}
```

**Step 4: Verify**

Run:

```bash
npm test -- extensions/discord/src/outbound-adapter.test.ts extensions/discord/src/send.sends-basic-channel-messages.test.ts
npm run tsgo:extensions
```

Expected: outbound tests and extension type check pass.

**Step 5: Commit**

Run:

```bash
git add extensions/discord/src
```

If Task 1 chose `extensions/nanoclaw-discord-local`, also run:

```bash
git add extensions/nanoclaw-discord-local
```

Then run:

```bash
git commit -m "refactor(discord): minimize ledger outbound patch"
```

Expected: one refactor commit with no behavior change.

---

### Task 5: Minimize the Responder Gate Call-Site Patch

**Files:**

- Modify: `extensions/discord/src/monitor/message-handler.ts`
- Modify: `extensions/discord/src/monitor/message-handler.preflight.ts`
- Modify: `extensions/discord/src/monitor/message-handler.preflight.types.ts`
- Test: `extensions/discord/src/monitor/message-handler.queue.test.ts`
- Test: `extensions/discord/src/monitor/message-handler.preflight.test.ts`

**Step 1: Extract gate decision wrapper**

Move all non-OpenClaw-specific decision logic into the local module:

```ts
export function shouldSkipForSharedResponder(params: {
  isGuildMessage: boolean;
  wasMentioned: boolean;
  mentionedOtherBot: boolean;
  messageChannelId: string;
}): { skip: boolean; reason: string; responder: SharedResponder } {
  // pure decision logic
}
```

`message-handler.ts` should only:

- call this function
- log result
- commit replay keys when skipped
- avoid enqueue

**Step 2: Keep preflight patch minimal**

`message-handler.preflight.ts` should only add `mentionedOtherBot` metadata. Do not add responder state reads to preflight.

**Step 3: Verify**

Run:

```bash
npm test -- extensions/discord/src/monitor/responder-state.test.ts extensions/discord/src/monitor/message-handler.queue.test.ts extensions/discord/src/monitor/message-handler.preflight.test.ts
npm run tsgo:extensions
npm run tsgo:extensions:test
```

Expected: monitor tests and type checks pass.

**Step 4: Commit**

Run:

```bash
git add extensions
git commit -m "refactor(discord): minimize responder gate patch"
```

Expected: one refactor commit with no behavior change.

---

### Task 6: Investigate Full Discord Plugin Replacement

**Files:**

- Read: `src/plugins/registry.ts`
- Read: `src/plugins/discovery.ts`
- Read: `src/plugins/config-state.ts`
- Read: `extensions/discord/package.json`
- Create: `docs/plans/2026-05-07-openclaw-discord-plugin-replacement.md`

**Step 1: Confirm duplicate channel id behavior**

Run:

```bash
rg -n "duplicate|channel.*id|plugin.*id|plugins.load.paths|OPENCLAW_EXTENSIONS" src/plugins extensions/discord docs/plugins docs/cli
sed -n '780,860p' src/plugins/registry.ts
```

Expected: determine whether a loaded external plugin can override bundled channel id `discord`, or whether duplicate ids are rejected.

**Step 2: Document replacement options**

Create `docs/plans/2026-05-07-openclaw-discord-plugin-replacement.md`:

```markdown
# Discord Plugin Replacement Feasibility

## Question

Can a local Discord plugin replace bundled `@openclaw/discord` without patching OpenClaw source?

## Findings

- Duplicate channel id behavior:
- Required config knobs:
- Required local package shape:
- Runtime risk:

## Decision

- `replacement-plugin-now`: yes/no
- `patch-queue-until-upstream-hook`: yes/no
```

**Step 3: Do not implement replacement yet**

This task is read-only plus docs. Do not disable the current Discord plugin and do not restart gateway.

**Step 4: Commit**

Run:

```bash
git add docs/plans/2026-05-07-openclaw-discord-plugin-replacement.md
git commit -m "docs: assess discord plugin replacement"
```

Expected: one docs-only commit.

---

### Task 7: Decide Final 2차 Shape

**Files:**

- Modify: `docs/plans/2026-05-07-openclaw-discord-second-stage-modularization.md`
- Modify: `docs/local-openclaw-runtime.md`

**Step 1: Summarize results**

Update this plan with actual outcomes:

```markdown
## 2차 Result

- Local module target:
- Ledger pure logic location:
- Responder pure logic location:
- Remaining Discord call-site patch files:
- Full plugin replacement status:
- Next trigger to revisit sidecar:
```

**Step 2: Update runtime docs**

Add a short section to `docs/local-openclaw-runtime.md`:

```markdown
## Local Discord Patch Queue

Local Discord behavior is split into:

- ledger section rendering
- shared responder gating

When rebasing upstream, reapply these commits after `chore: isolate local openclaw overrides`.
```

**Step 3: Verify final state**

Run:

```bash
git status --short
git diff --check HEAD~5..HEAD
npm test -- extensions/**/response-sections.test.ts extensions/**/responder-state.test.ts extensions/discord/src/outbound-adapter.test.ts extensions/discord/src/send.sends-basic-channel-messages.test.ts extensions/discord/src/monitor/message-handler.queue.test.ts extensions/discord/src/monitor/message-handler.preflight.test.ts
npm run tsgo:extensions
npm run tsgo:extensions:test
```

Expected: clean status except intentional docs update before commit; tests and type checks pass.

**Step 4: Commit final docs**

Run:

```bash
git add docs/plans/2026-05-07-openclaw-discord-second-stage-modularization.md docs/local-openclaw-runtime.md
git commit -m "docs: finalize discord modularization plan"
```

Expected: one docs commit.

---

## Stop Conditions

Stop and ask the user before proceeding if any of these occur:

- A required path would modify `docker-compose.yml` again.
- A proposed fix requires pushing to `upstream`.
- A plugin replacement requires disabling the running Discord bot.
- Boundary checks require broad root `tsconfig` path changes.
- Tests fail in a way unrelated to the touched module.

## Expected End State

After this plan:

- Host-specific runtime remains externalized.
- Pure ledger and responder logic live in an explicit local module location.
- Discord source patches are reduced to narrow call sites.
- Full Discord plugin replacement feasibility is documented.
- If complete no-patch modularization is not feasible yet, the reason is written down with exact missing hook/plugin constraints.
