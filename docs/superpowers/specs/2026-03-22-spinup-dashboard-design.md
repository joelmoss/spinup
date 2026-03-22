# Spinup Dashboard — Design Spec

## Overview

Spinup Dashboard is an always-open Electron companion app that provides a unified view of all open VS Code projects, their terminals, background processes, and AI coding agents. It connects to VS Code windows via a WebSocket bridge built into the Spinup extension, enabling real-time monitoring and bidirectional control.

The core use case: glance at the dashboard and immediately know if something needs attention — a crashed process, an agent waiting for input — and act on it without switching windows.

## Implementation Scope

This spec covers two components that are built and shipped independently but designed together:

1. **Extension bridge** (added to existing Spinup extension) — WebSocket client, state reporting, agent monitoring, command handling
2. **Electron dashboard app** (new `dashboard/` directory in the repo) — WebSocket server, project registry, UI, notifications

The implementation plan should build the extension bridge first (it can be tested independently with a simple WebSocket client), then the Electron app.

All 9 agent integrations are in scope for v1. They are modular and independent — each is a single file that implements the same internal interface, so they can be built in parallel.

## Architecture

Two components connected via WebSocket:

### Electron Companion App

- Hosts a WebSocket server on `localhost:<port>`
- Maintains a registry of connected VS Code windows (each window = a project)
- Renders the dashboard UI (Electron renderer process)
- Sends commands to VS Code windows over WebSocket
- Triggers OS notifications for events requiring attention (e.g., agent waiting for input)
- Runs in the system tray / menu bar — always available in the background, click to show the dashboard window

### Spinup VS Code Extension (Bridge)

The existing Spinup extension gains a WebSocket client that:

- Auto-connects to the dashboard app on activation
- Reports terminal, process, and agent state in real-time
- Receives and executes commands from the dashboard (start/stop/restart, focus terminal, switch window)
- Disconnects on window close (automatic discovery/removal)

### Connection Lifecycle

1. Dashboard app starts → WebSocket server listens on a known localhost port
2. VS Code window opens → Spinup extension activates → connects to dashboard
3. Extension sends `connect` message with window metadata
4. Extension pushes `state:full` with all terminals/agents/processes
5. On any state change → extension sends `state:update` with delta
6. Dashboard sends commands → extension executes them
7. VS Code window closes → WebSocket disconnects → dashboard removes project

Port discovery: the dashboard writes a JSON file to `~/.spinup-dashboard/server.json` containing `{ "port": 9500, "pid": 12345 }`. The extension reads this file on activation. Before connecting, the extension checks that the PID is still alive (`process.kill(pid, 0)`). If the PID is dead, the file is stale — the extension deletes it and enters retry mode (same as "dashboard not running"). Default port is 9500.

## WebSocket Protocol

All messages are JSON with a `type` field.

### Extension → App (State Reports)

```jsonc
// Sent on connection
{
  "type": "connect",
  "windowId": "<machineId>:<sessionId>",
  "window": {
    "kind": "workspace" | "directory",
    "name": "my-workspace" | "spinup",
    "path": "/path/to/workspace.code-workspace" | "/path/to/spinup",
    "folders": [
      { "name": "spinup", "path": "/Users/joel/dev/spinup" }
    ]
  }
}

// Full state snapshot — sent on connect and as periodic heartbeat
{
  "type": "state:full",
  "windowId": "<machineId>:<sessionId>",
  "terminals": [
    {
      "id": "term-1",
      "name": "zsh - node server.js",
      "status": "running",        // "running" | "idle" | "closed"
      "metrics": { "cpu": 2.1, "mem": 48 }
    }
  ],
  "agents": [
    {
      "id": "agent-1",
      "name": "Claude Code",
      "kind": "claude-code",
      "status": "working",        // "idle" | "working" | "waiting_for_input" | "error" | "unknown"
      "detail": "refactoring auth module",
      "terminalId": "term-3"
    }
  ],
  "processes": [
    {
      "id": "proc-1",
      "name": "dev server",
      "command": "node server.js",
      "status": "running",        // "running" | "stopped" | "errored"
      "restartCount": 0,
      "maxRestarts": 5,
      "metrics": { "cpu": 2.1, "mem": 48 }
    }
  ]
}

// Delta update — sent on every state change
// "added" contains full objects (same shape as in state:full)
// "removed" contains just ids: ["term-1", "term-3"]
// "updated" contains full replacement objects (same shape as in state:full)
{
  "type": "state:update",
  "windowId": "<machineId>:<sessionId>",
  "changes": {
    "terminals": { "added": [], "removed": ["term-2"], "updated": [{ "id": "term-1", "name": "...", "status": "..." }] },
    "agents": { "added": [], "removed": [], "updated": [] },
    "processes": { "added": [], "removed": [], "updated": [] }
  }
}

// Metrics update — sent periodically for running processes
{
  "type": "metrics",
  "windowId": "<machineId>:<sessionId>",
  "items": [
    { "id": "proc-1", "cpu": 2.1, "mem": 48 },
    { "id": "term-1", "cpu": 0.4, "mem": 120 }
  ]
}
```

### App → Extension (Commands)

```jsonc
// Process control
{ "type": "command:start", "processId": "proc-1" }
{ "type": "command:stop", "processId": "proc-1" }
{ "type": "command:restart", "processId": "proc-1" }

// Terminal actions
{ "type": "terminal:focus", "terminalId": "term-1" }
{ "type": "terminal:create" }
{ "type": "terminal:send", "terminalId": "term-1", "text": "npm test" }

// Window actions
{ "type": "window:focus" }
```

### Window Identity

`windowId` is `vscode.env.machineId + ":" + vscode.env.sessionId` — unique per window, stable for the session.

Windows can be either a VS Code workspace (multi-root) or a single directory. The `window` object in the `connect` message distinguishes them:

- **Workspace**: `kind: "workspace"`, `name` is the workspace name, `folders` lists all root folders
- **Directory**: `kind: "directory"`, `name` is the folder name, `folders` has one entry

## Agent Detection & State Monitoring

### Agent States

All agents report one of these states:

| State | Meaning | Visual Treatment |
|-------|---------|-----------------|
| `idle` | Agent is present but not active | Gray indicator |
| `working` | Agent is actively processing | Yellow/amber indicator |
| `waiting_for_input` | Agent needs user attention | Amber pulse + OS notification |
| `error` | Agent encountered an error | Red indicator |
| `unknown` | Agent detected but state unavailable | Gray, dimmed |

### One-Time Setup

The dashboard app provides a "Configure Agents" step on first run. This installs native hooks for each detected agent so they report state to the extension's agent hook listener.

### Agent Hook Listener

The Spinup extension runs a lightweight HTTP server on `localhost:9501` (configurable) to receive hook callbacks from terminal-based agents. The server exposes a single endpoint:

```
POST /agent-event
Content-Type: application/json

{
  "agent": "claude-code",           // agent kind identifier
  "event": "waiting_for_input",     // mapped agent state
  "detail": "permission_prompt",    // agent-specific event detail
  "terminalPid": 12345              // used to match to a VS Code terminal
}
```

The extension matches incoming events to terminals via PID, updates the agent's state, and pushes a `state:update` to the dashboard over WebSocket.

Each agent's hook configuration is set up to POST to this endpoint. For example, Claude Code's `~/.claude/settings.json` gets a `Notification` hook that runs a shell command: `curl -s -X POST http://localhost:9501/agent-event -H 'Content-Type: application/json' -d '{"agent":"claude-code","event":"waiting_for_input","detail":"idle_prompt"}'`.

Extension-based agents (Roo Code) bypass this HTTP listener entirely — they use the VS Code extension API directly.

### Supported Agents (Native Integrations)

#### Claude Code
- **Detection**: Terminal name/process matching
- **State reporting**: Hook system in `~/.claude/settings.json`
  - `Notification` hook with `idle_prompt` matcher → `waiting_for_input`
  - `Notification` hook with `permission_prompt` matcher → `waiting_for_input`
  - `Stop` hook → `idle`
  - `SessionStart` hook → `working`
- **Quality**: Exact

#### OpenAI Codex CLI
- **Detection**: Terminal name/process matching
- **State reporting**: JSONL stream (`--json` flag) or Codex SDK JSON-RPC
  - `turn.completed` → `idle` / `waiting_for_input`
  - `turn.started` → `working`
  - `permission_request` (SDK) → `waiting_for_input`
- **Quality**: Exact

#### GitHub Copilot CLI
- **Detection**: Terminal name/process matching
- **State reporting**: Hooks in `.github/hooks/*.json`, SDK via JSON-RPC
  - `sessionStart` → `working`
  - `sessionEnd` → `idle`
  - `onPermissionRequest` (SDK) → `waiting_for_input`
  - No explicit `awaitingUserInput` hook yet (Issue #1128) — inferred from turn completion
- **Quality**: Good (waiting state is inferred, not exact)

#### Cline CLI
- **Detection**: Terminal name/process matching
- **State reporting**: `--json` stream + hooks (v3.36+)
  - JSON stream events for state transitions
  - Hooks receive JSON via stdin
- **Quality**: Exact

#### Roo Code
- **Detection**: `vscode.extensions.getExtension('RooVeterinaryInc.roo-cline')`
- **State reporting**: VS Code extension API (`@roo-code/types`)
  - `onDidStartTask` → `working`
  - `onDidEndTask` → `idle`
  - `ask` message state → `waiting_for_input`
- **Quality**: Exact

#### Amp (Sourcegraph)
- **Detection**: Terminal name/process matching
- **State reporting**: `--stream-json` output
  - Structured messages: `init`, `user`, `assistant`, `result`
  - Parse stream for state transitions
- **Quality**: Exact

#### Gemini CLI
- **Detection**: Terminal name/process matching
- **State reporting**: Hooks in `~/.gemini/settings.json`
  - `AfterAgent` hook → `idle` (inferred)
  - `BeforeAgent` hook → `working`
  - `SessionEnd` hook → `idle`
- **Quality**: Inferred (no explicit waiting event)

#### OpenCode
- **Detection**: Terminal name/process matching
- **State reporting**: HTTP API + SSE streaming
  - Real-time events via SSE
  - Plugin hooks for pre/post tool execution
- **Quality**: Exact

#### Goose (Block)
- **Detection**: Terminal name/process matching
- **State reporting**: `goosed` REST + SSE API
  - HTTP endpoints for status
  - SSE stream for real-time updates
- **Quality**: Exact

### Extensible Provider Model (Future)

The system is designed so additional agents can register themselves via a simple interface:

```typescript
interface AgentProvider {
  name: string;
  kind: string;
  detectPresence(): boolean;
  onStateChange(callback: (state: AgentState) => void): Disposable;
}
```

This interface is not implemented in v1 but the architecture accommodates it — agent integrations are modular and independent.

## UI Design

### Layout

A flat, vertical dashboard. Every project is visible with all its terminals, processes, and agents as individual rows. No expand/collapse — the point is at-a-glance visibility.

### Project Card Structure

```
┌─────────────────────────────────────────────────────┐
│ ● spinup              ~/dev/spinup          [Focus] │
├─────────────────────────────────────────────────────┤
│ ● TERM  node server.js      2.1% · 48MB    [↻] [■] │
│ ● TERM  npm test --watch                   [↻] [■] │
│ ○ TERM  zsh                                    [↗] │
│ ◉ AGENT Claude Code    refactoring auth        [↗] │
└─────────────────────────────────────────────────────┘
```

### Visual Indicators

- **Project-level status dot**: Worst status of its children — if any child is errored, the project dot is red
- **Row-level status dot**: Green (running/healthy), Red (errored/crashed), Amber/Yellow (working/waiting), Gray (idle/stopped)
- **`waiting_for_input`**: Amber pulsing dot — distinct from static working indicator
- **Errored projects sort to top** of the dashboard

### Row Actions (Contextual)

| Row State | Available Actions |
|-----------|-------------------|
| Running process | Restart, Stop |
| Errored process | Restart, Show |
| Idle terminal | Show |
| Working agent | Show |
| Waiting agent | Show (jump to provide input) |

### OS Notifications

The dashboard fires macOS/Windows/Linux notifications when:

- An agent enters `waiting_for_input` state
- A process enters `errored` state

Notifications are clickable — they focus the relevant VS Code window and terminal.

## Project Structure

```
spinup/
├── src/                          # Existing Spinup extension source
│   ├── bridge/                   # New: WebSocket client + agent monitoring
│   │   ├── bridgeClient.js       # WebSocket connection to dashboard
│   │   ├── stateReporter.js      # Aggregates and reports extension state
│   │   ├── commandHandler.js     # Handles incoming commands from dashboard
│   │   └── agents/               # Agent-specific integrations
│   │       ├── agentDetector.js   # Detects agents in terminals
│   │       ├── claudeCode.js      # Claude Code hook integration
│   │       ├── codexCli.js        # Codex CLI JSONL integration
│   │       ├── copilotCli.js      # Copilot CLI hook integration
│   │       ├── clineCli.js        # Cline CLI integration
│   │       ├── rooCode.js         # Roo Code extension API integration
│   │       ├── amp.js             # Amp stream-json integration
│   │       ├── geminiCli.js       # Gemini CLI hook integration
│   │       ├── opencode.js        # OpenCode HTTP/SSE integration
│   │       └── goose.js           # Goose REST/SSE integration
│   └── ...                       # Existing extension files
├── dashboard/                    # New: Electron companion app
│   ├── main/                     # Electron main process
│   │   ├── main.js               # App entry, window management
│   │   ├── wsServer.js           # WebSocket server
│   │   ├── projectRegistry.js    # Tracks connected VS Code windows
│   │   └── notifications.js      # OS notification manager
│   ├── renderer/                 # Electron renderer process
│   │   ├── index.html
│   │   ├── app.js                # Dashboard UI
│   │   ├── components/           # UI components
│   │   │   ├── projectCard.js    # Project card with rows
│   │   │   ├── processRow.js     # Terminal/process/agent row
│   │   │   └── actionButtons.js  # Contextual action buttons
│   │   └── styles/
│   │       └── dashboard.css
│   ├── package.json              # Electron app dependencies
│   └── forge.config.js           # Electron Forge for packaging
└── package.json                  # Extension manifest (updated)
```

## Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Companion app | Electron | Same JS/Node ecosystem as the extension; cross-platform |
| WebSocket | `ws` (npm) | Lightweight, well-tested, no framework overhead |
| UI rendering | Vanilla JS + CSS | Dashboard is simple enough; no framework needed |
| App packaging | Electron Forge | Standard Electron packaging/distribution tool |
| Agent hooks HTTP | Built-in `http` module | Extension-side listener for hook callbacks; no deps |

## Error Handling

- **Dashboard not running**: Extension silently retries connection every 5 seconds. No error shown to user — the extension works fine without the dashboard.
- **Extension disconnects**: Dashboard removes the project from the registry. If the extension reconnects (e.g., after VS Code reload), it sends a fresh `connect` + `state:full`.
- **Agent hook misconfigured**: The agent shows as `unknown` state. Dashboard's "Configure Agents" can re-run setup.
- **Stale state**: Periodic `state:full` heartbeat every 30 seconds ensures the dashboard resyncs even if a delta was missed.
- **Metrics refresh**: Every 3 seconds (matching the existing Spinup metrics interval).

## Out of Scope (v1)

- Persisting project list across dashboard restarts (only shows currently connected windows)
- Terminal output streaming to the dashboard (just status, not content)
- Multiple dashboard instances
- Remote VS Code windows (SSH, Codespaces)
- Extensible provider model implementation (architecture supports it, but no registration API in v1)
- Custom themes for the dashboard
