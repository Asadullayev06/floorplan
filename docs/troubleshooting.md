# Troubleshooting

### The Ask bar says it needs the Claude Code CLI
The map is open without a way to ask questions. Either:
- install the [Claude Code CLI](https://code.claude.com/docs/en/overview), sign in, then ask Claude to update the floorplan or run `node floorplan/serve.mjs`;
- or open the map in the Claude app: ask Claude to "publish my floorplan to the Claude app". Answers there come from the map only.

### The CLI is installed but isn't found
`serve.mjs` looks for `claude` on your PATH and in `~/.local/bin`. If it lives somewhere else:

```bash
node floorplan/serve.mjs --claude /path/to/claude
```

### `node` isn't recognized
Install [Node.js](https://nodejs.org) 18 or newer, then start a new session so Claude Code picks it up.

### Claude keeps asking to run `node` scripts
Floorplan pre-approves its own scripts while it's running, but Claude Code may still ask in some setups. Choose the option to always allow them for this project.

### The skill doesn't show up
Plugins load when a session starts, so start a new one after installing. Check that it's installed and enabled:

```bash
claude plugin list
```

Plain requests like "make me a floorplan" work without the slash command. If you do want it, it's `/floorplan:floorplan`.

### The map looks out of date
Ask Claude to "update the floorplan". If a tab was already open, it reloads itself once the update finishes.

### The map is blank, or stuck on "Laying out"
The map loads its layout engine from a CDN, so check your internet connection or any content blocker. For fully offline maps, see [Privacy and security](privacy-and-security.md#what-runs-where).

### A connection is missing
Floorplan finds most web requests and imports by reading the code, but not all of them, for example requests to an address that only exists in settings. Ask Claude to add the missing connection to the floorplan; it records it in `architecture.json` and it stays on every update.

### A file is in the wrong part, or under "Unassigned"
Ask Claude to move it, or edit the `paths` patterns in `floorplan/architecture.json` and ask for an update.

### "floorplan/ already exists here and isn't a map"
Your project has its own folder called `floorplan`, which Floorplan won't write into. Rename your folder, or ask Claude to build the map somewhere else; the scan and build scripts accept `--out <folder>`.

### `git status` shows files under `floorplan/`
They were committed before Floorplan started ignoring the folder. Untrack them, keeping the files on disk:

```bash
git rm -r --cached floorplan
```

### Port 4378 is in use
Nothing to do. The server moves to the next free port, and the URL it prints, or that Claude gives you, is the right one.

### Stopping the background server

```bash
node floorplan/serve.mjs --stop
```

It also stops by itself two hours after the last tab closes.

### Still stuck?
[Open an issue](https://github.com/haydenschmitty/floorplan/issues/new/choose) with what you asked, what happened, and the output Claude showed. Please leave out anything private from your code.
