# Paddie Studio

Paddie Studio is a fork of [OpenCode](https://github.com/anomalyco/opencode) focused on a desktop-first AI coding workbench.

This fork keeps the upstream agent/runtime and adds:

- an integrated filesystem browser
- a Monaco-based editor
- terminal-driven localhost preview
- fork-owned branding, issue routing, and desktop identity
- separate desktop storage paths so it does not share local state with upstream OpenCode

## Fork Layout

- Official fork: `https://github.com/michaelegbo/opencode`
- Upstream remote: `https://github.com/anomalyco/opencode`
- Active work branch: `codex/paddie-studio`

## Main Packages

- `packages/app` - web UI and workbench route
- `packages/desktop` - Tauri desktop shell
- `packages/opencode` - server and agent runtime

## Development

```bash
bun install
bun run dev:web
bun run dev:desktop
```

Typecheck from package directories:

```bash
cd packages/app
bun run typecheck

cd ../desktop
bun run typecheck
```

## Desktop Build

```bash
cd packages/desktop
bun run tauri build
```

Windows artifacts are written to:

- `packages/desktop/src-tauri/target/release/PaddieStudio.exe`
- `packages/desktop/src-tauri/target/release/bundle/nsis/`

## Notes

- This repo is still structurally close to upstream OpenCode, so many internal package names remain unchanged for compatibility.
- User-facing desktop branding and storage paths now identify as Paddie Studio.

## License

MIT. See upstream notices and this fork's commit history for provenance.
