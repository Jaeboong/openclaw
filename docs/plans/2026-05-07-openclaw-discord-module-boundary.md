# OpenClaw Discord Local Module Boundary

Date: 2026-05-07

## Goal

Prove the safe local module boundary for the second-stage Discord modularization
work before moving ledger/responder pure logic.

## Boundary Rules

- `tsconfig.json` includes all `extensions/**/*` and has a broad
  `@openclaw/*` path mapping to `./extensions/*`. Relying on that root alias
  would make a cross-extension local module compile in the repo, but it is not a
  package-local contract.
- `tsconfig.extensions.json` extends the root config and compiles extension
  sources together. It does not add package-specific wiring for a local
  `nanoclaw` Discord module.
- `scripts/check-no-extension-src-imports.ts` checks production extension source
  files and rejects direct relative imports into the repo `src/` tree. The
  prescribed replacement is a focused `openclaw/plugin-sdk/<subpath>` surface or
  the extension's own public barrel.
- `scripts/check-extension-plugin-sdk-boundary.mjs` enforces that production
  bundled plugins do not import core `src/**` outside `src/plugin-sdk/**`, do
  not import `src/plugin-sdk-internal/**`, and do not use relative imports that
  escape their own package root. Its relative-package mode explicitly treats a
  relative import into another bundled plugin as a boundary violation.
- `docs/plugins/sdk-channel-plugins.md` points channel plugins toward narrow
  `openclaw/plugin-sdk/*` seams, public setup/runtime entrypoints, and
  plugin-owned code paths instead of ad hoc shared-core imports.

## Candidate Boundary

| Candidate                                | Example Import                                              | Pros                           | Risks                                        | Decision                                                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extensions/nanoclaw-discord-local`      | `@openclaw/nanoclaw-discord-local/src/response-sections.js` | Outside upstream Discord files | May violate extension boundary checks        | Do not use in this phase. A bare cross-extension `src` import depends on root `@openclaw/*` path alias behavior or package/workspace wiring, and is not a proven package-local boundary. |
| `extensions/discord/src/local-overrides` | `./local-overrides/response-sections.js`                    | Guaranteed local compile path  | Still inside upstream Discord extension tree | Use for this phase. The import stays inside the Discord package root, so it avoids cross-extension and package-export ambiguity.                                                         |
| `packages/nanoclaw-openclaw-discord`     | package import                                              | Product-independent module     | Requires package path/export wiring          | Defer. This is the cleanest long-term product-independent shape, but it requires package/export/path wiring outside the docs-only boundary proof.                                        |

## Final Decision

Use `extensions/discord/src/local-overrides` for the ledger/responder pure logic
move in this phase.

This keeps the import path inside the `@openclaw/discord` package root and uses
normal relative imports such as `./local-overrides/response-sections.js`. That
matches the boundary checks' allowed shape: production extension files can import
within their own package, while relative imports escaping the package root are
forbidden and bare cross-extension `src` imports are not proven safe without
root alias or package wiring.

Do not add root `tsconfig` path aliases in this phase. Revisit
`extensions/nanoclaw-discord-local` or `packages/nanoclaw-openclaw-discord` only
after adding explicit package exports/workspace dependency wiring and boundary
checks that prove the public import surface.
