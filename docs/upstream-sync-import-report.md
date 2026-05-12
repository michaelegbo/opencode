# Upstream Sync Import Report

Branch: `codex/upstream-sync-dev`

Base Paddie commit: `0323d6067`

Upstream commit tested: `59e6967b8`

Merge commit: `705e4e8b8`

## Summary

The upstream `anomalyco/opencode` `dev` branch was merged into a separate worktree and branch so it would not overwrite the active Paddie work. The final tested branch keeps the Paddie desktop app, Studio templates, Workflow Builder, and Tauri installer path intact.

The branch imports upstream work that is mostly outside the Paddie product surface, plus a small dependency/type compatibility set needed to keep typechecking green. The branch does not wholesale import upstream's app, desktop, or runtime rewrites because those changes delete or replace Paddie-specific features.

## Test Result

These checks passed after resolving the sync branch:

```powershell
bun typecheck
```

Run from:

- `packages/app`
- `packages/desktop`
- `packages/opencode`

## What Was Imported

| Area | Status | What landed | Risk to Paddie |
| --- | --- | --- | --- |
| `packages/core` | Imported | New upstream shared core package and tests. | Low by itself, but medium if used to replace existing Paddie runtime code too quickly. |
| `packages/llm` | Imported | New upstream LLM abstraction package, providers, recorded tests, and route code. | Low while isolated. Medium if wired into Paddie runtime without migration work. |
| `packages/http-recorder` | Imported | New HTTP recording package and tests. | Low while isolated. |
| `packages/console` | Imported | Console billing, model, key, Zen route, i18n, and webhook updates. | Low for desktop Paddie unless this console is deployed as part of the product. |
| `packages/web` | Imported | Docs and web content updates. | Low. Mostly website/docs. |
| `.github` workflows | Imported | CI, publish, review, setup-bun, and cleanup changes. | Medium. Needs review before relying on release automation. |
| `.opencode` agent/tool config | Imported | Agent, command, theme, TUI smoke, and skill updates. | Low to medium. Useful for dev workflow, not core product UI. |
| `patches` | Imported | Upstream npm-agent, photon-node, and Korean IME patch files. | Low, but apply only if needed by install/runtime path. |
| `specs` | Imported | New v2 session and todo specs. | Low. Good reference material. |
| `infra`, `nix`, `sst`, scripts | Imported | Monitoring, deploy, publish, stats, version, and upgrade script changes. | Medium. Review before production deployment. |
| `package.json`, `bun.lock` | Imported with edits | Added upstream catalog entries for `@effect/opentelemetry`, OpenTUI packages, `@types/bun@1.3.12`, and `@types/node@24.12.2`. | Medium. Required for this sync branch to install and typecheck. |
| `packages/opencode/package.json` and `tsconfig.json` | Imported with edits | Added package-level Node types and enabled `types: ["node"]`. | Low. Required for `node:sqlite` and Buffer typechecking. |

## What Was Not Imported Wholesale

These are the areas upstream changed heavily, but the sync branch intentionally kept Paddie versions.

| Area | Upstream changed | What we did | Why it was not overwritten |
| --- | ---: | --- | --- |
| `packages/opencode` | 879 files | Kept Paddie runtime source, only changed package/type config. | Wholesale import caused type and runtime drift with Paddie app contracts. |
| `packages/desktop` | 422 files | Kept Paddie Tauri desktop package and installer paths. | Upstream moved desktop toward Electron-style packaging and icon layout; that would risk the Windows exe workflow. |
| `packages/app` | 207 files | Kept Paddie app source, templates, Workflow Builder, and Studio UI. | Upstream deletes or replaces Paddie-specific templates/workbench/workflow files. |
| `packages/ui` | 93 files | Kept Paddie UI package. | Needs to stay aligned with the preserved Paddie app. |
| `packages/util` | 15 files | Kept Paddie util package. | Upstream moved much of this into `packages/core`; migration should be planned, not forced. |
| `packages/sdk` | 13 files | Kept Paddie SDK package. | SDK must match the Paddie app/runtime event contract. |
| `packages/plugin` | 8 files | Kept Paddie plugin package. | Upstream OpenTUI/plugin changes require coordinated runtime migration. |

## Best Candidates To Import Next

These can be imported or kept from the sync branch with relatively low risk:

| Candidate | Recommendation | Reason |
| --- | --- | --- |
| `packages/core` | Keep, but do not rewire Paddie to it yet. | Useful upstream foundation. Safe while isolated. |
| `packages/http-recorder` | Keep. | New package, isolated, useful for testing and provider recording. |
| `packages/llm` | Keep isolated, evaluate later. | May be useful for provider routing, but should not replace Paddie runtime without tests. |
| Type/catalog fixes | Keep. | Required for install and typecheck on the sync branch. |
| `patches` | Keep if install remains stable. | Upstream compatibility patches are low risk when not invasive. |
| `specs` | Keep. | Good architecture reference with no runtime effect. |
| Docs/web updates | Keep if branding is reviewed. | Low code risk, but product wording should remain Paddie-first. |

## Import Selectively, Not As Overwrite

These areas may contain useful upstream work, but should be cherry-picked feature by feature.

| Area | What to cherry-pick | What to avoid |
| --- | --- | --- |
| `packages/opencode` | Provider fixes, session fixes, storage fixes, tool bug fixes, CLI fixes. | Full package overwrite until app, SDK, plugin, and util migrations are planned together. |
| `packages/app` | Terminal fixes, sync reducer fixes, prompt improvements, session stability fixes. | Any change that removes `template-panel`, `workflow-builder`, `workbench`, Paddie auth, or Studio routes. |
| `packages/desktop` | Build/release bug fixes that still fit Tauri. | Electron package replacement, icon path relocation, or installer hook deletion. |
| `packages/ui` | Individual component bug fixes after visual review. | Whole UI overwrite because it can break Paddie layout and Studio styling. |
| `packages/sdk` | Generated API updates only after server contract is confirmed. | SDK overwrite without matching server/app changes. |
| `.github` workflows | Publish/test improvements after secrets and release path review. | Release automation changes that assume upstream package names or artifacts. |

## Do Not Overwrite These Yet

These are Paddie core features and should stay protected.

| Paddie area | Why it must be protected |
| --- | --- |
| Studio templates page | It is the product entry for templates and the current logged-in Paddie flow. |
| Workflow Builder iframe and controls | This is a new Paddie feature and upstream does not carry it. |
| Paddie auth/session bridge | Required so Studio templates and Workflow Builder use the same logged-in account. |
| Tauri desktop package and Windows installer | Required for the current `.exe` build path. |
| Paddie titlebar/nav layout | User-facing app shell; upstream layout changes can blank or hide Studio. |
| `packages/app/src/lib/paddie-api.ts` and `paddie-links.ts` | Paddie-specific web/studio integration. |
| Paddie SDK/app/runtime event contract | App, SDK, and server need to move together or not at all. |

## Can Do Without For Now

These upstream items are optional for the Paddie desktop product right now:

- Translated README updates.
- Upstream web docs mode changes.
- Console billing/redeem/black-plan changes unless Paddie deploys that console.
- Enterprise sharing updates unless used by Paddie.
- Vouch workflow removals.
- Most recorded LLM cassettes until the new `packages/llm` package is wired in.
- Monitoring/SST changes until deployment ownership is reviewed.
- Electron desktop migration files.

## Cannot Do Without

These are required for Paddie to keep working:

- `packages/app` Paddie Studio UI, templates, Workflow Builder, workbench, and Paddie API helpers.
- `packages/desktop` Tauri build config, installer hooks, and Windows artifact path.
- `packages/opencode` runtime behavior expected by the Paddie app.
- `packages/sdk`, `packages/ui`, `packages/plugin`, and `packages/util` staying compatible with the Paddie app/runtime pair.
- Typechecks from `packages/app`, `packages/desktop`, and `packages/opencode`.

## Recommended Next Sync Plan

1. Keep `codex/upstream-sync-dev` as the reference branch.
2. Do not merge it into the production Paddie branch yet.
3. Create smaller follow-up branches for specific imports:
   - `codex/import-core-packages`
   - `codex/import-runtime-fixes`
   - `codex/import-ci-updates`
   - `codex/import-docs-specs`
4. For each follow-up branch, run:
   - `bun install`
   - `bun typecheck` in `packages/app`
   - `bun typecheck` in `packages/desktop`
   - `bun typecheck` in `packages/opencode`
5. Only overwrite a Paddie-owned file when the upstream change is understood and Paddie templates, Workflow Builder, login, and exe build path are still intact.

## Practical Decision

The best immediate path is not a full overwrite. Keep the upstream sync branch as an integration reference, then cherry-pick safe packages and fixes into Paddie in small groups. The branch proves we can pull from upstream without losing Paddie work, but it also proves a wholesale app/desktop/runtime overwrite would remove or break key Paddie features.
