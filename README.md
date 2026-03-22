# Spinup

A Visual Studio Code extension that lets you define and manage multiple concurrent processes from a sidebar. Configure your dev environment commands in VS Code settings and start, stop, restart, and monitor them without leaving the editor. Includes an optional Electron companion dashboard for cross-project monitoring and AI agent awareness.

## Key Features

- Define all your development processes (servers, watchers, compilers, etc.) in VS Code settings
- Start, stop, and restart commands individually or all at once from a dedicated sidebar
- Auto-start commands when the workspace opens
- Auto-restart crashed commands with exponential backoff (up to 5 retries)
- File watching -- automatically restart a command when matching files change
- Per-command working directory and environment variables
- Live CPU and memory metrics for running processes
- Status bar indicator showing how many processes are running
- Live-reloading configuration -- changes to settings are picked up automatically
- Companion Electron dashboard for monitoring all projects from a single window
- AI agent detection -- surfaces the status of Claude Code, Codex CLI, Copilot CLI, Gemini CLI, Amp, Cline, OpenCode, Goose, and Roo Code agents running in your workspace

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Configuration Reference](#configuration-reference)
- [Architecture](#architecture)
- [Dashboard (Companion App)](#dashboard-companion-app)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Packaging and Publishing](#packaging-and-publishing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Tech Stack

- **Language**: JavaScript (CommonJS, no build step)
- **Runtime**: VS Code Extension Host (Node.js)
- **Extension API**: VS Code 1.85+
- **Config**: VS Code native settings API (`vscode.workspace.getConfiguration`)
- **Testing**: Mocha (TDD style) via `@vscode/test-electron`
- **Linting**: ESLint 10
- **Dashboard**: Electron 33 with Electron Forge
- **Bridge Protocol**: WebSocket (`ws` library) on preferred port 19500 (dynamic fallback)
- **Agent Hook Listener**: HTTP server in the dashboard on preferred port 19501 (dynamic fallback)

---

## Prerequisites

- **Node.js** 18 or higher
- **npm** (ships with Node.js)
- **Visual Studio Code** 1.85 or higher (for running/debugging the extension)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/joelmoss/spinup.git
cd spinup
```

### 2. Install Dependencies

```bash
npm install
```

This installs dev dependencies (Mocha, ESLint, VS Code test electron) and the `ws` runtime dependency used for WebSocket communication with the dashboard.

### 3. Run the Extension in Development

Open the project in VS Code, then press **F5** (or select **Run > Start Debugging**). This launches a new Extension Development Host window with the extension loaded. No build step is required -- the extension runs directly from the `src/` directory.

The `.vscode/launch.json` file contains two launch configurations:

- **Run Extension** -- starts the Extension Development Host for manual testing.
- **Extension Tests** -- runs the Mocha test suite inside a headless VS Code instance.

### 4. Try It Out

In the Extension Development Host window, open your workspace settings (`.vscode/settings.json`) and add:

```json
{
  "spinup.commands": {
    "Server": {
      "command": "npm run dev"
    },
    "Worker": {
      "command": "npm run worker",
      "autostart": false
    },
    "Watcher": {
      "command": "npm run watch",
      "watch": ["src/**/*.js"]
    }
  }
}
```

The Spinup sidebar will appear in the Explorer view. From there you can start, stop, and restart each command. A status bar item at the bottom shows "Spinup: X/Y running".

---

## Configuration Reference

Spinup is configured via the `spinup.commands` setting in VS Code settings. You can set it in workspace settings (`.vscode/settings.json`), user settings, or via the Settings UI. The schema is validated by VS Code's built-in settings validation and is defined in `package.json` under `contributes.configuration`.

### Minimal Example

```json
{
  "spinup.commands": {
    "Server": {
      "command": "npm run dev"
    }
  }
}
```

### Full Example

```json
{
  "spinup.commands": {
    "Rails": {
      "command": "bin/rails server",
      "autostart": true,
      "autoRestart": true,
      "cwd": "./backend",
      "env": {
        "RAILS_ENV": "development"
      },
      "watch": ["config/**", "app/**/*.rb"]
    },
    "Vite": {
      "command": "npx vite",
      "autostart": true
    },
    "Sidekiq": {
      "command": "bundle exec sidekiq",
      "autostart": false,
      "autoRestart": true
    },
    "Console": {
      "command": "bin/rails console",
      "autostart": false,
      "interactive": true
    }
  }
}
```

### Property Reference

| Property | Type | Default | Description |
|---|---|---|---|
| `command` | `string` | **(required)** | The shell command to execute. |
| `autostart` | `boolean` | `true` | Start this command automatically when the workspace opens. |
| `autoRestart` | `boolean` | `false` | Restart the command automatically if it exits with a non-zero code. Uses exponential backoff (1s, 2s, 4s, 8s, 16s) up to a maximum of 5 retries and a 30-second cap per delay. |
| `interactive` | `boolean` | `false` | Whether the command requires interactive terminal input. When `false`, the command is wrapped so process exit is detected and the terminal closes on success. When `true`, the shell stays alive after the command finishes. |
| `cwd` | `string` | workspace root | Working directory for the command, relative to the workspace root. |
| `env` | `object` | `{}` | Additional environment variables passed to the terminal. Keys and values must be strings. |
| `watch` | `string[]` | `[]` | Glob patterns of files to watch. When a matching file changes, the command is automatically restarted (if it is currently running). Changes are debounced at 1 second per command. |

### Live Reload

Spinup listens for changes to VS Code settings via `onDidChangeConfiguration`. When the `spinup.commands` setting changes:

- New commands are added and auto-started if configured.
- Removed commands are stopped and disposed.
- Existing commands have their configuration updated in place.
- If the new config is invalid, the previous valid configuration is kept and a warning is shown.

VS Code's built-in settings UI provides autocomplete and validation for the `spinup.commands` setting.

---

## Architecture

### Directory Structure

```
spinup/
├── .vscode/
│   ├── launch.json                # Debug/run configurations
│   └── settings.json              # Workspace settings
├── resources/
│   └── icons/                     # Activity bar and state icons
├── src/
│   ├── extension.js               # Extension entry point (activate/deactivate)
│   ├── types.js                   # Shared constants (CommandStatus enum)
│   ├── config/
│   │   └── settings.js            # Reads + validates config from VS Code settings
│   ├── commands/
│   │   ├── commandManager.js      # Orchestrates all command processes
│   │   ├── commandProcess.js      # Manages a single command's lifecycle
│   │   └── autoRestartPolicy.js   # Exponential backoff logic for auto-restart
│   ├── terminal/
│   │   ├── terminalManager.js     # Pool of SpinupTerminal instances (with split grouping)
│   │   └── spinupTerminal.js      # Wrapper around vscode.Terminal
│   ├── ui/
│   │   ├── treeDataProvider.js    # Sidebar tree view data provider
│   │   ├── treeItems.js           # Tree item rendering (icons, labels, tooltips, metrics)
│   │   └── statusBarManager.js    # Status bar "X/Y running" indicator
│   ├── fileWatcher/
│   │   └── fileWatcherManager.js  # Per-command file watchers for auto-restart
│   ├── metrics/
│   │   └── processMetrics.js      # CPU% and RSS (MB) via `ps` for process trees
│   ├── bridge/
│   │   ├── bridgeClient.js        # WebSocket client connecting to the dashboard
│   │   ├── stateReporter.js       # Computes full state and deltas for the dashboard
│   │   ├── commandHandler.js      # Handles incoming commands from the dashboard
│   │   ├── agentHookListener.js   # HTTP server receiving agent hook events
│   │   └── agents/
│   │       ├── agentDetector.js   # Detects and tracks AI coding agents
│   │       ├── claudeCode.js      # Claude Code hook configuration
│   │       ├── codexCli.js        # Codex CLI hook configuration
│   │       ├── copilotCli.js      # Copilot CLI hook configuration
│   │       ├── geminiCli.js       # Gemini CLI hook configuration
│   │       ├── amp.js             # Amp hook configuration
│   │       ├── clineCli.js        # Cline CLI hook configuration
│   │       ├── opencode.js        # OpenCode hook configuration
│   │       ├── goose.js           # Goose hook configuration
│   │       └── rooCode.js         # Roo Code hook configuration
│   └── test/
│       ├── runTests.js            # Test runner entry point
│       └── suite/
│           ├── index.js                    # Mocha test suite loader
│           ├── autoRestartPolicy.test.js
│           ├── config.test.js
│           ├── commandManager.test.js
│           ├── commandProcess.test.js
│           ├── terminalManager.test.js
│           ├── spinupTerminal.test.js
│           ├── treeItems.test.js
│           ├── keybindings.test.js
│           ├── processMetrics.test.js
│           ├── bridgeClient.test.js
│           ├── bridgeIntegration.test.js
│           ├── commandHandler.test.js
│           ├── stateReporter.test.js
│           ├── agentDetector.test.js
│           ├── agentHookListener.test.js
│           └── agentModules.test.js
├── dashboard/                     # Electron companion app (see Dashboard section)
├── package.json                   # Extension manifest and scripts
├── eslint.config.js               # ESLint configuration
├── .gitignore
├── .vscodeignore                  # Files excluded from the packaged extension
└── LICENSE                        # MIT License
```

### Extension Lifecycle

1. **Activation** -- VS Code activates Spinup when the sidebar view or a command is triggered. The extension requires at least one workspace folder to be open; it silently returns otherwise.

2. **Manager Construction** -- `activate()` creates `TerminalManager`, `CommandManager`, `SpinupTreeDataProvider`, `StatusBarManager`, and `FileWatcherManager`. All are registered in `context.subscriptions` for automatic disposal.

3. **Config Loading** -- `loadConfig()` reads from `vscode.workspace.getConfiguration('spinup')` and applies defaults for optional properties (`autostart: true`, `autoRestart: false`, `interactive: false`). If any command is missing a valid `command` string, the entire config is rejected.

4. **Command Initialization** -- `CommandManager.initialize()` creates a `CommandProcess` for each configured command and auto-starts those with `autostart: true`.

5. **Terminal Creation** -- Each `CommandProcess` asks `TerminalManager` for a `SpinupTerminal`, which wraps `vscode.window.createTerminal()`. The first terminal is created normally; subsequent terminals are split from an existing one so they appear grouped in the terminal panel.

6. **Command Execution** -- Non-interactive commands are wrapped with an exit-code detection wrapper: on success the shell exits (triggering `onDidCloseTerminal`), on failure the shell stays open so error output is visible and shell integration reports the exit code. Interactive commands use `sendText()` so the shell stays alive.

7. **UI Updates** -- `SpinupTreeDataProvider` listens to `CommandManager.onDidChange` events and refreshes the sidebar. Each tree item shows the command name, a status icon (green play for running, red error for errored, grey circle for stopped), and live CPU/memory metrics for running processes. `StatusBarManager` updates the "Spinup: X/Y running" indicator.

8. **Metrics Collection** -- Every 3 seconds, `CommandManager` calls `getMetrics()` for each running process. This uses `ps -eo pid,ppid,pcpu,rss` to collect CPU% and RSS for the entire process tree rooted at the terminal's shell PID.

9. **File Watching** -- `FileWatcherManager` creates `vscode.FileSystemWatcher` instances for each command's `watch` patterns. When a file changes, the corresponding running command is restarted (debounced at 1s).

10. **Config Hot Reload** -- `onDidChangeConfig` listens for VS Code settings changes filtered to `spinup` and triggers `CommandManager.reconcile()`, which diffs the old and new configs, adding/removing/updating commands as needed.

11. **Bridge Initialization** -- `initBridge()` checks for `~/.spinup/server.json` to find the dashboard's WebSocket port. If the dashboard is not running, it polls every 10 seconds. Once found, it sets up the bridge components (see Dashboard Bridge section below).

12. **Deactivation** -- All disposables registered via `context.subscriptions` are cleaned up by VS Code.

### Auto-Restart with Exponential Backoff

When a command with `autoRestart: true` exits with a non-zero code:

1. The `AutoRestartPolicy` calculates the delay: `baseDelay * 2^attempts` (starting at 1s).
2. The delay is capped at 30 seconds.
3. After 5 failed restarts, the policy gives up and the command stays in the `errored` state.
4. A successful manual start or restart resets the retry counter.
5. The terminal stays open after a crash so error output remains visible.

### VS Code Commands

The extension registers the following commands:

| Command ID | Title | Context |
|---|---|---|
| `spinup.startAll` | Start All | View title bar |
| `spinup.stopAll` | Stop All | View title bar |
| `spinup.restartAll` | Restart All | View title bar |
| `spinup.start` | Start | Inline on stopped/errored items |
| `spinup.stop` | Stop | Inline on running items |
| `spinup.restart` | Restart | Inline on running items |
| `spinup.clear` | Clear Terminal | Context menu |
| `spinup.openTerminal` | Show Terminal | Inline on running items, context menu |
| `spinup.toggleStartStop` | Toggle Start/Stop | Keybinding only |
| `spinup.startOrShowTerminal` | Start or Show Terminal | Keybinding only |
| `spinup.openSettings` | Open Settings | Welcome view link |

### Keyboard Shortcuts

| Shortcut | Command | Condition |
|---|---|---|
| `Cmd+Shift+S` | Start All | Spinup view is focused |
| `Cmd+Shift+Q` | Stop All | Spinup view is focused |
| `s` | Toggle Start/Stop | Spinup tree item is focused |
| `r` | Restart | Spinup tree item is focused |
| `Enter` | Start or Show Terminal | Spinup tree item is focused |

### Data Flow

```
VS Code Settings (spinup.commands)
       │
       ▼
loadConfig() (read + defaults + validation)
       │
       ▼
CommandManager (orchestration, metrics timer)
       │
       ├──▶ CommandProcess ──▶ SpinupTerminal ──▶ vscode.Terminal
       │         │                                       │
       │         ◀── onDidClose / onDidShellExecEnd ─────┘
       │         │
       │         ◀── AutoRestartPolicy (exponential backoff)
       │
       ├──▶ SpinupTreeDataProvider ──▶ Sidebar tree view (with CPU/mem metrics)
       │
       ├──▶ StatusBarManager ──▶ Status bar item
       │
       ├──▶ FileWatcherManager ──▶ vscode.FileSystemWatcher (debounced restart)
       │
       └──▶ Bridge ──▶ BridgeClient ──▶ WebSocket ──▶ Dashboard
                 │
                 ├──▶ StateReporter (full state + deltas)
                 ├──▶ CommandHandler (incoming commands from dashboard)
                 └──▶ AgentHookListener ──▶ AgentDetector (AI agent tracking)
```

### Terminal Grouping

The `TerminalManager` groups all Spinup terminals together in the VS Code terminal panel. The first terminal is created normally via `createTerminal()`. Each subsequent terminal is created by splitting from an existing Spinup terminal via the `workbench.action.terminal.split` command. This keeps all Spinup terminals visually grouped.

### Process States

The `CommandStatus` enum in `src/types.js` defines three states:

| Status | Icon | Description |
|---|---|---|
| `stopped` | Grey circle | Process is not running |
| `running` | Green play | Process is active |
| `errored` | Red error | Process exited with a non-zero code |

---

## Dashboard (Companion App)

The `dashboard/` directory contains the Spinup Dashboard, an Electron companion application that provides a unified view of all your Spinup-managed projects across multiple VS Code windows.

### Dashboard Features

- See all connected VS Code windows and their processes in one place
- Start, stop, and restart commands remotely from the dashboard
- View live CPU and memory metrics
- Monitor AI coding agent status (working, waiting for input, idle)
- Desktop notifications when agents need attention or processes crash
- System tray integration -- close the window and it stays in the tray
- Persistent window position across restarts
- Click a project to focus its VS Code window

### Running the Dashboard

```bash
cd dashboard
npm install
npm start
```

This launches the Electron app via Electron Forge. The dashboard listens on `ws://127.0.0.1:19500` (preferred port, with dynamic fallback) for VS Code extension connections. It writes a `server.json` file to `~/.spinup/` so extensions can discover it.

### Dashboard Architecture

```
dashboard/
├── main/
│   ├── main.js              # Electron main process (window, tray, IPC)
│   ├── wsServer.js          # WebSocket server for VS Code extension connections
│   ├── projectRegistry.js   # In-memory registry of connected projects and their state
│   ├── notifications.js     # Desktop notification manager (agent + process alerts)
│   └── agentSetup.js        # Agent hook installation helpers
├── renderer/
│   ├── index.html           # Dashboard UI entry point
│   ├── preload.js           # Electron preload script (contextBridge)
│   ├── app.js               # Renderer app logic (sorts projects by status priority)
│   ├── components/
│   │   ├── projectCard.js   # Renders a project card with processes and agents
│   │   ├── processRow.js    # Renders a single process row with status and metrics
│   │   └── actionButtons.js # Start/stop/restart/focus buttons
│   └── styles/
│       └── dashboard.css    # Dashboard styling
├── test/
│   ├── wsServer.test.js
│   ├── projectRegistry.test.js
│   ├── notifications.test.js
│   └── agentSetup.test.js
├── forge.config.js          # Electron Forge configuration
└── package.json
```

### Bridge Protocol

The VS Code extension communicates with the dashboard over WebSocket using JSON messages. The protocol supports these message types:

**Extension to Dashboard:**

| Type | Description | Payload |
|---|---|---|
| `connect` | Initial handshake | `windowId`, `window` (name, path, folders) |
| `state:full` | Complete state snapshot | `terminals`, `agents`, `processes` |
| `state:update` | Delta update | `changes` (added, removed, updated per category) |
| `metrics` | Process metrics | `items` (id, cpu, mem) |

**Dashboard to Extension:**

| Type | Description | Payload |
|---|---|---|
| `command:start` | Start a process | `processId` |
| `command:stop` | Stop a process | `processId` |
| `command:restart` | Restart a process | `processId` |
| `terminal:focus` | Focus a terminal | `terminalId` |
| `window:focus` | Focus the VS Code window | (none) |

State is sent as a full snapshot on connection and every 30 seconds (heartbeat). Between heartbeats, only deltas are sent when state changes. Metrics are sent every 3 seconds.

### AI Agent Detection

Spinup detects AI coding agents running in your workspace via two mechanisms:

1. **Agent Hook Events** -- An HTTP server in the dashboard (`AgentHookListener`) on preferred port 19501 (with dynamic fallback) receives POST requests from agent lifecycle hooks. Agents like Claude Code can be configured to send events (session start, idle prompt, permission prompt, stop) to this endpoint.

2. **Terminal Name Pattern Matching** -- `AgentDetector` matches terminal names against known patterns (e.g., `/\bclaude\b/i` for Claude Code) to detect agents started in VS Code terminals.

Supported agents:

| Agent | Kind | Detection Pattern |
|---|---|---|
| Claude Code | `claude-code` | `/\bclaude\b/i` |
| Codex CLI | `codex-cli` | `/\bcodex\b/i` |
| Copilot CLI | `copilot-cli` | `/\bcopilot\b/i` |
| Gemini CLI | `gemini-cli` | `/\bgemini\b/i` |
| Amp | `amp` | `/\bamp\b/i` |
| Cline CLI | `cline-cli` | `/\bcline\b/i` |
| OpenCode | `opencode` | `/\bopencode\b/i` |
| Goose | `goose` | `/\bgoose\b/i` |
| Roo Code | `roo-code` | (Roo Code integration) |

Agent events are scoped to the workspace -- only agents whose working directory falls within the workspace folders are shown. When the dashboard receives agent state, it can trigger desktop notifications (e.g., when an agent is waiting for user input).

---

## Available Scripts

### Extension (root)

| Command | Description |
|---|---|
| `npm run lint` | Run ESLint on `src/` |
| `npm test` | Run the Mocha test suite inside a VS Code Extension Host |

### Dashboard (`dashboard/`)

| Command | Description |
|---|---|
| `npm start` | Launch the Electron dashboard app via Electron Forge |
| `npm test` | Run dashboard Mocha tests (TDD style) |
| `npm run package` | Package the dashboard app |
| `npm run make` | Build distributable packages (zip) |

---

## Testing

### Extension Tests

Tests run inside a VS Code Extension Host via `@vscode/test-electron`. This is required because the extension uses `vscode` APIs that are only available inside the host.

```bash
npm test
```

This downloads a VS Code instance (if needed), launches it headless, and runs the full Mocha test suite. There is no way to run a single test file in isolation; all tests in `src/test/suite/*.test.js` run together.

You can also run tests from VS Code using the **Extension Tests** launch configuration (press **F5** with that profile selected).

Tests use Mocha's TDD UI (`suite`/`test`, not `describe`/`it`).

### Dashboard Tests

```bash
cd dashboard
npm test
```

Dashboard tests run directly with Mocha (no Electron required) and cover the WebSocket server, project registry, notifications, and agent setup modules.

### Test Coverage

**Extension tests cover:**

- **AutoRestartPolicy** -- Initial state, delay doubling, 30s cap, 5-retry limit, and reset behavior.
- **Settings** -- Config loading from VS Code settings, default application, explicit value preservation, and rejection of commands without a `command` string.
- **CommandManager** -- Initialization, reconciliation (add/remove/update commands), state sorting, counts, events, and disposal.
- **CommandProcess** -- Lifecycle (start/stop/restart), status transitions, event firing, idempotency, and config updates.
- **TerminalManager** -- Pool management (getOrCreate, get, remove, disposeAll), open/closed terminal handling.
- **SpinupTerminal** -- Terminal creation, isOpen state, sendText auto-create, idempotent create, show/clear safety.
- **CommandTreeItem** -- Labels, icons, descriptions, tooltips, contextValue, and command binding across all statuses.
- **Keybindings** -- Keyboard shortcut definitions and conditions.
- **ProcessMetrics** -- CPU and memory aggregation for process trees.
- **BridgeClient** -- WebSocket connection, reconnection, message sending.
- **BridgeIntegration** -- End-to-end bridge communication flow.
- **CommandHandler** -- Handling of incoming dashboard commands.
- **StateReporter** -- Full state snapshots and delta computation.
- **AgentDetector** -- Agent pattern matching and state management.
- **AgentHookListener** -- HTTP server for agent events.
- **AgentModules** -- Individual agent hook configurations.

**Dashboard tests cover:**

- **WebSocket Server** -- Connection handling, message routing, client management.
- **ProjectRegistry** -- Project add/remove/update, state management, delta application.
- **Notifications** -- Notification triggering and deduplication.
- **AgentSetup** -- Agent hook installation helpers.

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

Files listed in `.vscodeignore` are excluded from the package. The dashboard, tests, docs, and development configuration are all excluded. The `ws` dependency is included for WebSocket support.

### Install Locally

```bash
code --install-extension spinup-0.1.0.vsix
```

### Publish to the Marketplace

```bash
vsce publish
```

You will need a Personal Access Token for the `joelmoss` publisher account. See the [VS Code publishing docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for details.

### Package the Dashboard

```bash
cd dashboard
npm run make
```

This uses Electron Forge to create distributable packages (zip format).

---

## Troubleshooting

### Spinup Sidebar Does Not Appear

Make sure you have a workspace folder opened (not just a single file). The extension requires at least one workspace folder; `activate()` returns early without one.

### Config Errors

If you see "Spinup: Command ... is missing a valid command string", check that each entry in `spinup.commands` has a `command` property with a string value. VS Code's Settings UI provides validation and autocomplete for the setting.

### Command Stays in "Errored" State

If a command has `autoRestart: true` and it has crashed more than 5 times consecutively, auto-restart gives up. Click the play button on the command to manually restart it, which resets the retry counter.

### Terminal Not Appearing

When you click "Show Terminal" on a running command, VS Code should bring the corresponding terminal panel into focus. If nothing happens, the terminal may have been closed externally. Stop and start the command again to create a fresh terminal.

### Config Changes Not Picked Up

Settings changes are detected via VS Code's `onDidChangeConfiguration` event. If changes are not reflected, try editing the setting again or reloading the VS Code window (`Developer: Reload Window`).

### File Watch Restarts Not Triggering

- File watch restarts only apply to commands that are currently **running**. Stopped or errored commands are not restarted.
- Glob patterns are relative to the workspace root.
- Changes are debounced at 1 second per command to avoid rapid-fire restarts.

### Dashboard Not Connecting

- Make sure the dashboard is running (`cd dashboard && npm start`).
- The dashboard writes its port and PID to `~/.spinup/server.json`. If this file is stale (pointing to a dead process), the extension will clean it up and poll for a new one.
- The extension polls every 10 seconds for the dashboard. After starting the dashboard, allow up to 10 seconds for the extension to connect.
- Both the dashboard WebSocket server (preferred port 19500) and the agent hook listener (preferred port 19501) bind to `127.0.0.1` only. Ports are dynamically allocated if the preferred port is unavailable.

### Agent Detection Not Working

- Agent hook events are only shown for agents whose working directory is within the current workspace folders.
- The `AgentHookListener` in the dashboard starts on preferred port 19501 (with dynamic fallback). The actual port is recorded in `~/.spinup/server.json`.
- Agents must be configured to send HTTP POST requests to the agent event endpoint (see `server.json` for the actual port) with a JSON body containing at minimum `agent` (kind) and `event` (status) fields.

### Metrics Not Showing

- Metrics are collected every 3 seconds for running processes only.
- The metrics system uses `ps -eo pid,ppid,pcpu,rss` to aggregate CPU and memory across the entire process tree. This requires the `ps` command to be available (standard on macOS and Linux).
- If a process exits between metric collection cycles, its metrics are cleared automatically.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
