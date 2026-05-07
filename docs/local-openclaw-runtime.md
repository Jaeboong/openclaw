# Local OpenClaw Runtime

This document describes the local runtime commands and host-specific paths used
for running OpenClaw from `/home/ubuntu/openclaw`.

## Start the Gateway

Use the upstream compose file together with the local override:

```bash
docker compose -f /home/ubuntu/openclaw/docker-compose.yml -f /home/ubuntu/openclaw/docker-compose.local.yml up -d openclaw-gateway
```

## Inspect Runtime State

Follow gateway logs:

```bash
docker compose -f /home/ubuntu/openclaw/docker-compose.yml -f /home/ubuntu/openclaw/docker-compose.local.yml logs -f openclaw-gateway
```

Check the gateway workspace config:

```bash
docker compose -f /home/ubuntu/openclaw/docker-compose.yml -f /home/ubuntu/openclaw/docker-compose.local.yml exec openclaw-gateway node dist/index.js config get agents.defaults.workspace
```

Check local override wiring without exposing expanded secrets:

```bash
docker compose -f /home/ubuntu/openclaw/docker-compose.yml -f /home/ubuntu/openclaw/docker-compose.local.yml config \
  | sed -E 's/(OPENCLAW_GATEWAY_TOKEN[[:space:]]*:[[:space:]]*).*/\1<redacted>/' \
  | rg 'NANOCLAW_RESPONDER_STATE_PATH|/project/job|/Agents-Harness|/host-nanoclaw-config'
```

Do not paste unfiltered `docker compose config` output into chat or commits.

## Local Environment Paths

The local compose override can use these host-side variables to keep
machine-specific paths out of upstream compose:

- `OPENCLAW_CONFIG_DIR`: Host directory for OpenClaw configuration, including the Control UI token file.
- `OPENCLAW_WORKSPACE_DIR`: Host workspace directory mounted for OpenClaw agent work.
- `OPENCLAW_JOB_DIR`: Host job directory mounted into the runtime for job-specific files.
- `AGENTS_HARNESS_DIR`: Host checkout or install directory for Agents Harness, mounted read-only when used by the runtime.
- `NANOCLAW_CONFIG_DIR`: Host directory for Nanoclaw configuration and runtime state inputs.
- `NANOCLAW_RESPONDER_STATE_PATH`: Container-visible path to the Nanoclaw responder state file used by the Discord responder gate.

## Token Safety

The Control UI token lives in:

```text
/home/ubuntu/.config/openclaw/openclaw.json
```

Do not paste this token into chat, documentation, logs, issues, PRs, or commits.
If you need to confirm the token exists, inspect only file presence and metadata,
not the token value.

## Rebase Policy

When pulling or rebasing upstream OpenClaw, keep `docker-compose.yml` clean from
local host wiring. Put host-specific mounts and environment values in
`docker-compose.local.yml` and run compose with both files.

If local Discord behavior needs to be restored after an upstream update,
re-apply only the two local Discord patch queue commits as needed. Do not carry
unrelated source or compose edits forward.
