# Getting started

## What you need

- **Claude Code**: the Code tab in the Claude desktop app, or the Claude Code CLI in a terminal.
- **[Node.js](https://nodejs.org) 18 or newer.** Floorplan's scripts run on it. Check with `node --version`.
- **Recommended: the [Claude Code CLI](https://code.claude.com/docs/en/overview)**, even if you mainly use the desktop app. With it, the map's Ask bar can read your actual code when answering questions.

## Install

Run these once, in any terminal:

```bash
claude plugin marketplace add haydenschmitty/floorplan
claude plugin install floorplan@floorplan
```

The first command adds this repository as a plugin source. The second installs Floorplan for all your projects. The desktop app and the CLI share the same settings, so it shows up in both.

**Start a new session** afterwards. Plugins load when a session starts.

> In the desktop app you can also browse plugins with the **+** button next to the prompt box (**Add plugins**, or **Plugins → Browse plugins**). It lists plugins from marketplaces you've already added.

## Make your first map

1. **Open your project.** In the desktop app's Code tab, choose your project's folder in the row under the prompt box before sending your first message. In a terminal, run `claude` from the project folder.

   If your app is split across several repos (say `web/` and `api/` side by side), open the folder that contains them all. Floorplan maps them together and connects the requests between them.

2. **Ask for it:**

   > Make me a floorplan of this app.

   You can also pick **floorplan** from the **/** menu, or type `/floorplan:floorplan`.

3. **Let Claude work.** This is what happens:
   - A scan lists every file, import, endpoint and web request. This takes seconds and costs no tokens.
   - Claude reads your READMEs, setup files and entry points, then decides the main parts of your app and what each one is for.
   - Claude writes a plain-English name and a one-line description for every file and endpoint. Projects with more than about 150 files are split across parallel helpers.
   - The map is built and checked: connections, Health issues and screens.

   A small app takes a few minutes, a large one longer. You may be asked to let Claude run Floorplan's scripts (`node …`); allow them.

4. **Look around.** The map opens by itself, in the desktop app's browser pane or your web browser. A one-minute **Start here** tour runs the first time. Claude's message sums up how your app fits together and points out anything serious the Health check found.

See [Using the map](using-the-map.md) for everything you can do on it.

## Keep it up to date

After you, or Claude, have worked on the code:

> Update the floorplan.

Floorplan re-scans and compares with the last map. Moved files keep their descriptions, deleted ones disappear, and Claude rewrites only what's new or what changed in purpose. A map already open in your browser reloads itself, and the cards that just changed light up green under **Recent work**.

## Open the map yourself

The map is a folder in your project. Either:

```bash
node floorplan/serve.mjs
```

serves it at http://127.0.0.1:4378 with a working Ask bar, or double-click `floorplan/index.html`, where everything works except asking questions.

When Claude opens the map for you, the server runs in the background and stops by itself two hours after you close the last tab. To stop it sooner:

```bash
node floorplan/serve.mjs --stop
```

## Update the plugin

Plugins installed from GitHub don't update automatically unless you turn that on. To get the latest version:

```bash
claude plugin update floorplan@floorplan
```

Or turn on automatic updates: in a Claude Code session, run `/plugin`, open **Marketplaces**, and choose **Enable auto-update**. Either way, updates apply in your next session. See the [changelog](../CHANGELOG.md) for what changed.

## Remove it

```bash
claude plugin uninstall floorplan@floorplan
```

Then delete the `floorplan/` folder and the Floorplan section of `CLAUDE.local.md` from any project you used it in.
