# Spinup

A Visual Studio Code extension that lets you define and manage multiple concurrent processes from a sidebar. Configure your dev environment commands in a single `spinup.yml` (or `spinup.json`) file and start, stop, restart, and monitor them without leaving the editor.

## Key Features

- Define all your development processes (servers, watchers, compilers, etc.) in one config file
- Start, stop, and restart commands individually or all at once from a dedicated sidebar
- Auto-start commands when the workspace opens
- Auto-restart crashed commands with exponential backoff (up to 5 retries)
- File watching -- automatically restart a command when matching files change
- Per-command working directory and environment variables
- Status bar indicator showing how many processes are running
- Live-reloading configuration -- edits to `spinup.yml` / `spinup.json` are picked up automatically

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Configuration Reference](#configuration-reference)
- [Architecture](#architecture)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Packaging and Publishing](#packaging-and-publishing)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack

- **Language**: JavaScript (CommonJS)
- **Runtime**: VS Code Extension Host (Node.js)
- **Extension API**: VS Code 1.85+
- **Config Parsing**: `yaml` (YAML files), built-in `JSON.parse` (JSON files)
- **Config Validation**: `ajv` (JSON Schema draft-07)
- **Testing**: Mocha via `@vscode/test-electron`

---

## Prerequisites

- **Node.js** 18 or higher
- **npm** (ships with Node.js)
- **Visual Studio Code** 1.85 or higher (for running/debugging the extension)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <repo-url>
cd spinup
```

### 2. Install Dependencies

```bash
npm install
```

This installs both runtime dependencies (`ajv`, `yaml`) and dev dependencies (Mocha, VS Code test electron, etc.).

### 3. Run the Extension in Development

Open the project in VS Code, then press **F5** (or select **Run > Start Debugging**). This launches a new Extension Development Host window with the extension loaded. No build step is required -- the extension runs directly from the `src/` directory.

### 4. Try It Out

In the Extension Development Host window, create a `spinup.yml` file in the workspace root:

```yaml
commands:
  Server:
    command: "npm run dev"
  Worker:
    command: "npm run worker"
    autostart: false
  Watcher:
    command: "npm run watch"
    watch:
      - "src/**/*.js"
```

The Spinup sidebar will appear in the activity bar. From there you can start, stop, and restart each command.

---

## Configuration Reference

Spinup is activated when a workspace contains a `spinup.yml` or `spinup.json` file at the root. YAML is checked first. The file must conform to the JSON Schema defined in `spinup.schema.json`.

### Minimal Example

```yaml
commands:
  Server:
    command: "npm run dev"
```

### Full Example

```yaml
commands:
  Rails:
    command: "bin/rails server"
    autostart: true
    autoRestart: true
    cwd: "./backend"
    env:
      RAILS_ENV: "development"
    watch:
      - "config/**"
      - "app/**/*.rb"

  Vite:
    command: "npx vite"
    autostart: true

  Sidekiq:
    command: "bundle exec sidekiq"
    autostart: false
    autoRestart: true

  Console:
    command: "bin/rails console"
    autostart: false
    interactive: true
```

### Property Reference

| Property | Type | Default | Description |
|---|---|---|---|
| `command` | `string` | **(required)** | The shell command to execute. |
| `autostart` | `boolean` | `true` | Start this command automatically when the workspace opens. |
| `autoRestart` | `boolean` | `false` | Restart the command automatically if it exits with a non-zero code. Uses exponential backoff (1s, 2s, 4s, 8s, 16s) up to a maximum of 5 retries and a 30-second cap per delay. |
| `interactive` | `boolean` | `false` | Whether the command requires interactive terminal input. When `false`, the command runs via `exec` so process exit is detected. When `true`, the shell stays alive after the command finishes. |
| `cwd` | `string` | workspace root | Working directory for the command, relative to the workspace root. |
| `env` | `object` | `{}` | Additional environment variables passed to the terminal. Keys and values must be strings. |
| `watch` | `string[]` | `[]` | Glob patterns of files to watch. When a matching file changes, the command is automatically restarted (if it is currently running). Changes are debounced at 1 second per command. |

### Live Reload

Spinup watches `spinup.yml` and `spinup.json` for changes (debounced at 500ms). When the config file is saved:

- New commands are added and auto-started if configured.
- Removed commands are stopped and disposed.
- Existing commands have their configuration updated in place.
- If the new config has a parse or validation error, the previous valid configuration is kept and a warning is shown.

### JSON Schema Validation

Spinup ships a JSON Schema file (`spinup.schema.json`) and registers it with VS Code for both `spinup.yml` and `spinup.json`. This gives you autocomplete and inline validation when editing your config file.

---

## Architecture

### Directory Structure

```
spinup/
├── .vscode/
│   └── launch.json              # Debug/run configurations
├── resources/
│   └── icons/
│       ├── spinup.svg           # Activity bar icon
│       ├── running.svg          # Running state icon
│       ├── stopped.svg          # Stopped state icon
│       └── errored.svg          # Errored state icon
├── src/
│   ├── extension.js             # Extension entry point (activate/deactivate)
│   ├── types.js                 # Shared constants (CommandStatus enum)
│   ├── config/
│   │   ├── loader.js            # Reads and parses spinup.yml / spinup.json
│   │   ├── validator.js         # Validates config against JSON Schema via Ajv
│   │   └── watcher.js           # Watches config files for changes
│   ├── commands/
│   │   ├── commandManager.js    # Orchestrates all command processes
│   │   ├── commandProcess.js    # Manages a single command's lifecycle
│   │   └── autoRestartPolicy.js # Exponential backoff logic for auto-restart
│   ├── terminal/
│   │   ├── terminalManager.js   # Pool of SpinupTerminal instances
│   │   └── spinupTerminal.js    # Wrapper around vscode.Terminal
│   ├── ui/
│   │   ├── treeDataProvider.js  # Sidebar tree view data provider
│   │   ├── treeItems.js         # Tree item rendering (icons, labels, tooltips)
│   │   └── statusBarManager.js  # Status bar "X/Y running" indicator
│   ├── fileWatcher/
│   │   └── fileWatcherManager.js # Per-command file watchers for auto-restart
│   └── test/
│       ├── runTests.js          # Test runner entry point
│       └── suite/
│           ├── index.js                 # Mocha test suite loader
│           ├── autoRestartPolicy.test.js
│           ├── config.test.js
│           ├── commandManager.test.js
│           ├── commandProcess.test.js
│           ├── terminalManager.test.js
│           ├── spinupTerminal.test.js
│           └── treeItems.test.js
├── spinup.schema.json           # JSON Schema for spinup.yml / spinup.json
├── package.json                 # Extension manifest and scripts
├── .gitignore
└── .vscodeignore                # Files excluded from the packaged extension
```

### Extension Lifecycle

1. **Activation** -- VS Code activates Spinup when a workspace contains `spinup.yml` or `spinup.json` (defined by `activationEvents` in `package.json`).
2. **Config Loading** -- `ConfigLoader` reads the file, parses YAML/JSON, and validates it against the schema using `Ajv`. Defaults are applied for optional properties.
3. **Command Initialization** -- `CommandManager.initialize()` creates a `CommandProcess` for each configured command and auto-starts those with `autostart: true`.
4. **Terminal Creation** -- Each `CommandProcess` asks `TerminalManager` for a `SpinupTerminal`, which wraps `vscode.window.createTerminal()`. Non-interactive commands run via `exec` so process exit closes the terminal and is detected. Interactive commands use `sendText()` so the shell stays alive.
5. **UI Updates** -- `SpinupTreeDataProvider` listens to `CommandManager.onDidChange` events and refreshes the sidebar. `StatusBarManager` updates the "X/Y running" indicator.
6. **File Watching** -- `FileWatcherManager` creates `vscode.FileSystemWatcher` instances for each command's `watch` patterns. When a file changes, the corresponding running command is restarted (debounced at 1s).
7. **Config Hot Reload** -- `ConfigWatcher` monitors config file changes (debounced at 500ms) and triggers `CommandManager.reconcile()`, which diffs the old and new configs, adding/removing/updating commands as needed.
8. **Deactivation** -- All disposables registered via `context.subscriptions` are cleaned up by VS Code.

### Auto-Restart with Exponential Backoff

When a command with `autoRestart: true` exits with a non-zero code:

1. The `AutoRestartPolicy` calculates the delay: `baseDelay * 2^attempts` (starting at 1s).
2. The delay is capped at 30 seconds.
3. After 5 failed restarts, the policy gives up and the command stays in the `errored` state.
4. A successful manual start or restart resets the retry counter.

### VS Code Commands

The extension registers the following commands:

| Command ID | Title | Context |
|---|---|---|
| `spinup.startAll` | Start All | View title bar |
| `spinup.stopAll` | Stop All | View title bar |
| `spinup.restartAll` | Restart All | View title bar |
| `spinup.reloadConfig` | Reload Configuration | View title bar |
| `spinup.start` | Start | Inline on stopped/errored items |
| `spinup.stop` | Stop | Inline on running items |
| `spinup.restart` | Restart | Inline on running items |
| `spinup.clear` | Clear Terminal | Context menu |
| `spinup.openTerminal` | Show Terminal | Inline on running items |

### Keyboard Shortcuts

| Shortcut | Command | Condition |
|---|---|---|
| `Cmd+Shift+S` | Start All | Spinup view is focused |
| `Cmd+Shift+Q` | Stop All | Spinup view is focused |

### Data Flow

```
spinup.yml/json
       │
       ▼
ConfigLoader (parse + validate)
       │
       ▼
CommandManager (orchestration)
       │
       ├──▶ CommandProcess ──▶ SpinupTerminal ──▶ vscode.Terminal
       │         │                                       │
       │         ◀── onDidClose (exit code) ─────────────┘
       │
       ├──▶ SpinupTreeDataProvider ──▶ Sidebar tree view
       │
       ├──▶ StatusBarManager ──▶ Status bar item
       │
       └──▶ FileWatcherManager ──▶ vscode.FileSystemWatcher
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run lint` | Run ESLint on `src/` |
| `npm test` | Run the Mocha test suite inside a VS Code Extension Host |

---

## Testing

### Running Tests

Tests run inside a VS Code Extension Host via `@vscode/test-electron`. This is required because the extension uses `vscode` APIs that are only available inside the host.

```bash
npm test
```

This launches a headless VS Code instance to execute the Mocha test suite.

You can also run tests from VS Code using the "Extension Tests" launch configuration (press **F5** with that profile selected).

### Test Structure

```
src/test/
├── runTests.js                      # Entry point: downloads VS Code and runs the suite
└── suite/
    ├── index.js                     # Mocha loader (discovers *.test.js files)
    ├── autoRestartPolicy.test.js    # Exponential backoff logic
    ├── config.test.js               # Config validation and defaults
    ├── commandManager.test.js       # Command orchestration and reconciliation
    ├── commandProcess.test.js       # Command lifecycle and status changes
    ├── terminalManager.test.js      # Terminal pool management
    ├── spinupTerminal.test.js       # Terminal wrapper behavior
    └── treeItems.test.js            # Tree item rendering (icons, labels, tooltips)
```

### What Is Tested

- **AutoRestartPolicy** -- Initial state, delay doubling, 30s cap, 5-retry limit, and reset behavior.
- **ConfigValidator** -- Minimal config acceptance, default application, explicit value preservation, rejection of missing `commands` key, and rejection of commands without a `command` string.
- **CommandManager** -- Initialization, reconciliation (add/remove/update commands), state sorting, counts, events, and disposal.
- **CommandProcess** -- Lifecycle (start/stop/restart), status transitions, event firing, idempotency, and config updates.
- **TerminalManager** -- Pool management (getOrCreate, get, remove, disposeAll), open/closed terminal handling.
- **SpinupTerminal** -- Terminal creation, isOpen state, sendText auto-create, idempotent create, show/clear safety.
- **CommandTreeItem** -- Labels, icons, descriptions, tooltips, contextValue, and command binding across all statuses.

---

## Packaging and Publishing

### Package the Extension

Install `vsce` (the VS Code Extension CLI) if you have not already:

```bash
npm install -g @vscode/vsce
```

Then package the extension into a `.vsix` file:

```bash
vsce package
```

Files listed in `.vscodeignore` are excluded from the package.

### Install Locally

```bash
code --install-extension spinup-0.1.0.vsix
```

### Publish to the Marketplace

```bash
vsce publish
```

You will need a Personal Access Token for the `joelmoss` publisher account. See the [VS Code publishing docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for details.

---

## Troubleshooting

### Spinup Sidebar Does Not Appear

The extension only activates when `spinup.yml` or `spinup.json` exists at the workspace root. Make sure the file is present and the workspace folder is opened (not just a single file).

### Config Errors on Save

If you see "Spinup: Invalid config" or "Spinup: Failed to parse", your config file has a syntax or schema error. Common causes:

- Missing the required `commands` key at the top level.
- A command entry missing the required `command` property.
- YAML indentation issues.

The JSON Schema validation in VS Code will underline errors in the editor if you are editing `spinup.yml` or `spinup.json`.

### Command Stays in "Errored" State

If a command has `autoRestart: true` and it has crashed more than 5 times consecutively, auto-restart gives up. Click the play button on the command to manually restart it, which resets the retry counter.

### Terminal Not Appearing

When you click "Show Terminal" on a running command, VS Code should bring the corresponding terminal panel into focus. If nothing happens, the terminal may have been closed externally. Stop and start the command again to create a fresh terminal.

### Config Changes Not Picked Up

Config file changes are debounced at 500ms. If you edit and save very rapidly, wait a moment. You can also manually reload via the refresh button in the Spinup sidebar title bar, or run the **Spinup: Reload Configuration** command from the command palette.

### File Watch Restarts Not Triggering

- File watch restarts only apply to commands that are currently **running**. Stopped or errored commands are not restarted.
- Glob patterns are relative to the workspace root.
- Changes are debounced at 1 second per command to avoid rapid-fire restarts.
