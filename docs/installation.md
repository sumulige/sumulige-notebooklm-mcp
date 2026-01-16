# Installation Guide

Complete guide to installing and configuring the NotebookLM MCP Server.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Authentication](#authentication)
- [Verification](#verification)
- [Uninstallation](#uninstallation)
- [Upgrade](#upgrade)

---

## Requirements

### System Requirements

| Requirement          | Minimum               | Recommended |
| -------------------- | --------------------- | ----------- |
| **Node.js**          | 18.0.0                | 20.x LTS    |
| **Operating System** | Linux, macOS, Windows | Any         |
| **Memory**           | 2 GB RAM              | 4 GB RAM    |
| **Disk Space**       | 500 MB                | 1 GB        |

### Browser Requirements

The server uses **Patchright** (a Playwright fork) to automate Chrome/Chromium:

- **Linux**: Chromium is downloaded automatically on first run
- **macOS**: System Chrome or downloaded Chromium
- **Windows**: Chrome/Edge or downloaded Chromium

### Network Requirements

- **Required**: Internet connection for accessing NotebookLM (notebooklm.google.com)
- **Optional**: Google account for NotebookLM authentication

---

## Installation

### Quick Install (Recommended)

The fastest way to install is via `npx` - no manual download required:

```bash
npx notebooklm-mcp@latest
```

This will:

1. Download the latest version automatically
2. Cache it locally for subsequent runs
3. Always use the latest available version

---

## Installation by MCP Client

### Claude Code

**Installation:**

```bash
claude mcp add notebooklm npx notebooklm-mcp@latest
```

**Verification:**

```bash
claude mcp list
# Should show: notebooklm (npx notebooklm-mcp@latest)
```

**Uninstallation:**

```bash
claude mcp remove notebooklm
```

---

### Codex

**Installation:**

```bash
codex mcp add notebooklm -- npx notebooklm-mcp@latest
```

**Verification:**

```bash
codex mcp list
```

**Uninstallation:**

```bash
codex mcp remove notebooklm
```

---

### Cursor

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "notebooklm-mcp@latest"]
    }
  }
}
```

**Notes:**

- `-y` flag auto-confirms npm updates
- Cursor must be restarted after editing

---

### Gemini

**Installation:**

```bash
gemini mcp add notebooklm npx notebooklm-mcp@latest
```

**Verification:**

```bash
gemini mcp list
```

---

### VS Code

**Installation:**

```bash
code --add-mcp '{"name":"notebooklm","command":"npx","args":["notebooklm-mcp@latest"]}'
```

Or manually edit the MCP settings (location varies by platform).

---

### Other MCP Clients

**Generic configuration pattern:**

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["notebooklm-mcp@latest"]
    }
  }
}
```

---

## Installation Methods

### Method 1: NPX (Recommended)

**Pros:**

- Always uses latest version
- No manual updates needed
- Works across all platforms

**Cons:**

- Requires internet on first run
- Slightly slower startup (caching after first run)

```bash
npx notebooklm-mcp@latest
```

### Method 2: Global NPM Install

**Installation:**

```bash
npm install -g notebooklm-mcp
```

**Usage:**

```bash
notebooklm-mcp
```

**Updates:**

```bash
npm update -g notebooklm-mcp
```

**Uninstallation:**

```bash
npm uninstall -g notebooklm-mcp
```

### Method 3: From Source

For development or custom builds:

```bash
# Clone repository
git clone https://github.com/PleasePrompto/notebooklm-mcp.git
cd notebooklm-mcp

# Install dependencies
npm install

# Build
npm run build

# Run
node dist/index.js
```

---

## Authentication

### Initial Setup (One-Time)

After installation, authenticate with NotebookLM:

1. **Start authentication** - Say to your AI agent:

   ```
   "Log me in to NotebookLM"
   ```

   or

   ```
   "Open NotebookLM auth setup"
   ```

2. **Browser opens** - A Chrome window will open automatically

3. **Sign in** - Log in with your Google account

4. **Done** - Session is saved automatically

### Authentication States

| State                 | Description              |
| --------------------- | ------------------------ |
| **Not Authenticated** | `setup_auth` required    |
| **Authenticated**     | Ready to use             |
| **Session Expired**   | Re-authentication needed |

### Switching Accounts

To use a different Google account:

```
"Re-authenticate with a different Google account"
```

Or use the `re_auth` tool directly.

### Auto-Login (Optional)

For automation workflows, enable auto-login with environment variables:

```bash
export AUTO_LOGIN_ENABLED=true
export LOGIN_EMAIL="your-email@gmail.com"
export LOGIN_PASSWORD="your-app-password"
```

**Security Notes:**

- Use an app-specific password, not your main password
- Consider using a dedicated Google account
- Store credentials securely (e.g., `~/.env` with proper permissions)

---

## Verification

### Verify Installation

**Check if server is accessible:**

```bash
# Should show NotebookLM MCP tools
npx notebooklm-mcp@latest --help 2>&1 | head -20
```

**Check MCP client registration:**

```bash
# Claude Code
claude mcp list | grep notebooklm

# Codex
codex mcp list | grep notebooklm
```

### Verify Authentication

Ask your AI agent:

```
"Check NotebookLM connection status"
```

Or use the `get_health` tool to verify:

- Authentication state
- Active sessions
- Server health

### Test with a Query

1. Create a notebook in [NotebookLM](https://notebooklm.google.com)
2. Add some content
3. Share: ⚙️ → Share → Anyone with link → Copy
4. Ask your agent:
   ```
   "Add this NotebookLM to my library: [paste link]"
   "Ask the notebook: [your question]"
   ```

---

## Storage Paths

The server stores data in platform-specific locations:

| Platform    | Data Directory                                  |
| ----------- | ----------------------------------------------- |
| **Linux**   | `~/.local/share/notebooklm-mcp/`                |
| **macOS**   | `~/Library/Application Support/notebooklm-mcp/` |
| **Windows** | `%LOCALAPPDATA%\notebooklm-mcp\`                |

**What's stored:**

- `chrome_profile/` - Persistent Chrome browser profile
- `browser_state/` - Browser context and cookies
- `library.json` - Your notebook library
- `chrome_profile_instances/` - Isolated profiles for concurrent sessions

---

## Uninstallation

### Remove from MCP Client

**Claude Code:**

```bash
claude mcp remove notebooklm
```

**Codex:**

```bash
codex mcp remove notebooklm
```

**Cursor:**
Edit `~/.cursor/mcp.json` and remove the `notebooklm` entry.

### Remove Data

**Option 1: Clean uninstall (preserve library)**

```
"Run NotebookLM cleanup but keep my library"
```

**Option 2: Complete removal**

```
"Delete all NotebookLM data"
```

Or manually delete the data directory (see [Storage Paths](#storage-paths)).

### Remove Global NPM Package

```bash
npm uninstall -g notebooklm-mcp
```

---

## Upgrade

### Automatic Upgrade (NPX)

When using `npx notebooklm-mcp@latest`, updates are automatic:

- New version downloaded on next run
- No manual intervention needed

### Manual Upgrade (Global Install)

```bash
# Check current version
npm list -g notebooklm-mcp

# Update to latest
npm update -g notebooklm-mcp

# Verify new version
npm list -g notebooklm-mcp
```

### Check Version

```bash
npx notebooklm-mcp@latest --version
```

Or check in the AI agent:

```
"What version of NotebookLM MCP is installed?"
```

---

## Configuration

After installation, you can configure the server via:

- **Environment Variables** - See [Configuration Guide](./configuration.md)
- **Tool Profiles** - Minimal, Standard, or Full tool sets

### Tool Profiles

Reduce token usage by loading only the tools you need:

```bash
# Minimal (5 tools) - Query only
npx notebooklm-mcp@latest --profile minimal

# Standard (10 tools) - + Library management
npx notebooklm-mcp@latest --profile standard

# Full (16 tools) - All features
npx notebooklm-mcp@latest --profile full
```

Or set via environment variable:

```bash
export NOTEBOOKLM_PROFILE=minimal
```

---

## Troubleshooting

### Installation Issues

**"Command not found" after global install**

```bash
# Add npm global bin to PATH
export PATH="$PATH:$(npm config get prefix)/bin"

# Add to ~/.bashrc or ~/.zshrc for persistence
echo 'export PATH="$PATH:$(npm config get prefix)/bin"' >> ~/.bashrc
```

**Permission denied**

```bash
# Use sudo (not recommended) or fix npm permissions
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH="~/.npm-global/bin:$PATH"
```

### Browser Issues

**"Chrome not found"**

- Linux: Install Chromium: `sudo apt install chromium-browser`
- macOS: Chrome should be installed automatically
- Windows: Install Chrome or Edge

**"ProcessSingleton" error**

- Close all Chrome windows
- Try again, or set `NOTEBOOK_PROFILE_STRATEGY=isolated`

### Authentication Issues

**"Session expired"**

- Run: "Re-authenticate with NotebookLM"
- Or: "Run NotebookLM cleanup and re-auth"

**"Login loop"**

1. Close all Chrome windows
2. Run: "Run NotebookLM cleanup with library preservation"
3. Re-authenticate

For more troubleshooting, see [Troubleshooting Guide](./troubleshooting.md).

---

## Next Steps

- [Usage Guide](./usage-guide.md) - Learn patterns and workflows
- [Tool Reference](./tools.md) - Complete MCP API documentation
- [Configuration](./configuration.md) - Advanced configuration options
