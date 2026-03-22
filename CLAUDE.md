# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Spinup is a VS Code extension that manages multiple concurrent dev processes (servers, watchers, compilers) from a sidebar. Configuration lives in VS Code settings under `spinup.commands`.

## Commands

```bash
npm test        # Run Mocha tests inside a VS Code Extension Host (downloads VS Code if needed)
npm run lint    # ESLint on src/
```

No build step — the extension runs directly from `src/`. Press F5 in VS Code to launch the Extension Development Host for manual testing.

Tests require `@vscode/test-electron` which launches a headless VS Code instance. There is no way to run a single test file in isolation; all tests in `src/test/suite/*.test.js` run together via Mocha's TDD UI.

## Architecture

The extension is event-driven, built around VS Code's `EventEmitter` and disposable patterns.

**Activation flow** (`src/extension.js`): instantiate managers → register commands → subscribe to config changes → call `applyConfig()` → push all disposables to `context.subscriptions`.

**Key data flow:**
```
VS Code Settings (spinup.commands)
  → loadConfig() applies defaults & validates
  → CommandManager.initialize() or .reconcile()
  → CommandProcess → SpinupTerminal → vscode.Terminal
  → UI updates via onDidChange EventEmitter → TreeDataProvider + StatusBarManager
```

**Config reconciliation**: When settings change, `reconcile()` diffs old vs new config — adds new commands, removes deleted ones, updates existing ones in place. Invalid configs are rejected and the previous valid config is preserved with a warning.

**Terminal modes**: Non-interactive commands are wrapped with `exec` so the terminal closes on process exit (enabling exit code detection). Interactive commands use `sendText()` so the shell stays alive.

**Auto-restart**: `AutoRestartPolicy` implements exponential backoff (1s base, 30s cap, 5 max retries). A manual start/restart resets the counter.

## Conventions

- All classes that hold resources implement `dispose()` and are registered in `context.subscriptions`.
- State changes flow through `EventEmitter` instances — never poll for status.
- Operations are idempotent (e.g., `start()` on a running process is a no-op).
- `CommandStatus` enum in `src/types.js`: `Stopped`, `Running`, `Errored`.
- Tests use Mocha TDD style (`suite`/`test`, not `describe`/`it`).
- Config schema is defined in `package.json` under `contributes.configuration`, not in a separate schema file.

## Version Control

This repo uses Jujutsu (jj). Use `jj` commands, not `git`. Use `jj commit` (not `jj describe`) when committing.

## Dashboard

The `dashboard/` directory contains the Electron companion app (Spinup Dashboard).

```bash
cd dashboard && npm start    # Run the Electron dashboard app
cd dashboard && npm test     # Run dashboard tests (Mocha TDD)
# Run both: npm test && cd dashboard && npm test
```

The extension bridge connects to the dashboard via WebSocket (preferred port 19500, dynamic fallback). The dashboard owns the agent hook listener (preferred port 19501, dynamic fallback) and routes events to projects by matching `cwd` against registered workspace paths. Both actual ports are written to `~/.spinup/server.json`.

**Agent data flow:** Agent hooks (e.g., Claude Code) → HTTP POST to dashboard hook port → `ProjectRegistry.handleAgentEvent()` matches by cwd → updates project state. The extension does NOT handle agent events — only process/terminal state flows through the WebSocket bridge.

**Key constraint:** Claude Code hooks must use `$CLAUDE_PROJECT_DIR` (not `$PWD`) for the cwd field — hook shells may not inherit the project working directory.
