# OpenClaw Local Overrides Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Externalize host-specific OpenClaw tuning and reduce local patch surface to small, rebased feature commits.

**Architecture:** Runtime wiring moves from upstream `docker-compose.yml` into `docker-compose.local.yml`. Discord ledger and responder behavior remain local patch-queue items because current OpenClaw has no narrow hook for either outbound embed rendering or dynamic pre-enqueue responder arbitration.

**Tech Stack:** Docker Compose, OpenClaw TypeScript Discord extension, Vitest, Git patch queue.

---

### Task 1: Externalize Docker Runtime Wiring

**Files:**

- Modify: `docker-compose.yml`
- Create: `docker-compose.local.yml`
- Modify: `docs/plans/2026-05-07-openclaw-local-overrides.md`

**Step 1: Create the local compose override**

Create `docker-compose.local.yml` with `openclaw-gateway` and `openclaw-cli` overrides:

```yaml
services:
  openclaw-gateway:
    environment:
      NANOCLAW_RESPONDER_STATE_PATH: ${NANOCLAW_RESPONDER_STATE_PATH:-/host-nanoclaw-config/responder-state.json}
    volumes:
      - ${NANOCLAW_CONFIG_DIR:-/home/ubuntu/.config/nanoclaw}:/host-nanoclaw-config:ro
      - ${OPENCLAW_JOB_DIR:-/home/ubuntu/project/job}:/project/job
      - ${AGENTS_HARNESS_DIR:-/home/ubuntu/Agents-Harness}:/Agents-Harness:ro

  openclaw-cli:
    environment:
      NANOCLAW_RESPONDER_STATE_PATH: ${NANOCLAW_RESPONDER_STATE_PATH:-/host-nanoclaw-config/responder-state.json}
    volumes:
      - ${NANOCLAW_CONFIG_DIR:-/home/ubuntu/.config/nanoclaw}:/host-nanoclaw-config:ro
      - ${OPENCLAW_JOB_DIR:-/home/ubuntu/project/job}:/project/job
      - ${AGENTS_HARNESS_DIR:-/home/ubuntu/Agents-Harness}:/Agents-Harness:ro
```

**Step 2: Remove local host wiring from upstream compose**

Remove only these local additions from `docker-compose.yml`:

- `NANOCLAW_RESPONDER_STATE_PATH`
- `/host-nanoclaw-config`
- `/project/job`
- `/Agents-Harness`

Do not touch any unrelated upstream compose content.

**Step 3: Validate compose merge**

Run:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml config \
  | sed -E 's/(OPENCLAW_GATEWAY_TOKEN[[:space:]]*:[[:space:]]*).*/\1<redacted>/' \
  | rg 'NANOCLAW_RESPONDER_STATE_PATH|/project/job|/Agents-Harness|/host-nanoclaw-config'
```

Expected: command exits successfully and filtered merged config contains `/project/job`, `/Agents-Harness`, `/host-nanoclaw-config`, and `NANOCLAW_RESPONDER_STATE_PATH`. Do not run or paste unfiltered `docker compose config` output because it can expand secrets.

**Step 4: Check git status**

Run:

```bash
git status --short
```

Expected: `docker-compose.yml` is no longer modified by the mount/env changes; `docker-compose.local.yml` is new.

**Task 1 status:** Completed on 2026-05-07. Host-specific responder state env and local bind mounts were moved from `docker-compose.yml` into `docker-compose.local.yml`; compose merge validation succeeded.

### Task 2: Freeze Discord Ledger Patch Boundary

**Files:**

- Modify: `docs/plans/2026-05-07-openclaw-local-overrides.md`

**Step 1: Verify ledger files**

Run:

```bash
git diff -- extensions/discord/src/outbound-adapter.ts extensions/discord/src/outbound-payload.ts extensions/discord/src/send.shared.ts
git status --short -- extensions/discord/src/discord-response-sections.ts extensions/discord/src/discord-response-sections.test.ts
```

Expected: ledger changes are confined to Discord outbound files and the parser/test files.

**Step 2: Decide patch queue scope**

Keep these files in the `discord-ledger-embeds` patch queue:

- `extensions/discord/src/discord-response-sections.ts`
- `extensions/discord/src/discord-response-sections.test.ts`
- `extensions/discord/src/outbound-adapter.ts`
- `extensions/discord/src/outbound-adapter.test.ts`
- `extensions/discord/src/outbound-payload.ts`
- `extensions/discord/src/send.shared.ts`
- `extensions/discord/src/send.sends-basic-channel-messages.test.ts`

**Step 3: Run focused tests**

Run:

```bash
npm test -- extensions/discord/src/discord-response-sections.test.ts extensions/discord/src/outbound-adapter.test.ts extensions/discord/src/send.sends-basic-channel-messages.test.ts
```

Expected: focused Discord outbound tests pass.

### Task 3: Freeze Responder Gate Patch Boundary

**Files:**

- Modify: `docs/plans/2026-05-07-openclaw-local-overrides.md`

**Step 1: Verify responder files**

Run:

```bash
git diff -- extensions/discord/src/monitor/message-handler.ts extensions/discord/src/monitor/message-handler.preflight.ts extensions/discord/src/monitor/message-handler.preflight.types.ts
git status --short -- extensions/discord/src/monitor/responder-state.ts extensions/discord/src/monitor/responder-state.test.ts
```

Expected: responder changes are confined to preflight metadata, pre-enqueue queue gate, and responder state reader.

**Step 2: Decide patch queue scope**

Keep these files in the `discord-responder-gate` patch queue:

- `extensions/discord/src/monitor/responder-state.ts`
- `extensions/discord/src/monitor/responder-state.test.ts`
- `extensions/discord/src/monitor/message-handler.ts`
- `extensions/discord/src/monitor/message-handler.queue.test.ts`
- `extensions/discord/src/monitor/message-handler.preflight.ts`
- `extensions/discord/src/monitor/message-handler.preflight.types.ts`
- `extensions/discord/src/monitor/message-handler.preflight.test.ts`
- `extensions/discord/src/monitor/message-handler.preflight.test-helpers.ts`

**Step 3: Run focused tests**

Run:

```bash
npm test -- extensions/discord/src/monitor/responder-state.test.ts extensions/discord/src/monitor/message-handler.queue.test.ts extensions/discord/src/monitor/message-handler.preflight.test.ts
```

Expected: focused Discord monitor tests pass.

### Task 4: Document Local Runtime Commands

**Files:**

- Create: `docs/local-openclaw-runtime.md`

**Step 1: Add local run commands**

Document these commands without including secrets:

```bash
docker compose -f /home/ubuntu/openclaw/docker-compose.yml -f /home/ubuntu/openclaw/docker-compose.local.yml up -d openclaw-gateway
docker compose -f /home/ubuntu/openclaw/docker-compose.yml -f /home/ubuntu/openclaw/docker-compose.local.yml logs -f openclaw-gateway
docker compose -f /home/ubuntu/openclaw/docker-compose.yml -f /home/ubuntu/openclaw/docker-compose.local.yml exec openclaw-gateway node dist/index.js config get agents.defaults.workspace
```

**Step 2: Add token safety note**

State that the Control UI token lives in `/home/ubuntu/.config/openclaw/openclaw.json` and must not be pasted in chat or committed.

**Step 3: Add rebase policy**

State that upstream pulls should keep `docker-compose.yml` clean and re-apply only the two Discord patch queue commits if necessary.

### Task 5: Verify Final State

**Files:**

- No source edits expected.

**Step 1: Run extension type checks**

Run:

```bash
npm run tsgo:extensions
npm run tsgo:extensions:test
```

Expected: both extension type checks pass. OpenClaw does not define an `npm run typecheck` script.

**Step 2: Run focused test groups**

Run:

```bash
npm test -- extensions/discord/src/discord-response-sections.test.ts extensions/discord/src/outbound-adapter.test.ts extensions/discord/src/send.sends-basic-channel-messages.test.ts extensions/discord/src/monitor/responder-state.test.ts extensions/discord/src/monitor/message-handler.queue.test.ts extensions/discord/src/monitor/message-handler.preflight.test.ts
```

Expected: focused tests pass.

**Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: compose upstream file is clean or only contains unrelated upstream changes; local override/docs are explicit; Discord patch files remain the only OpenClaw source modifications.
