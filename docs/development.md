# Developing Floorplan

## Repo layout

```
.claude-plugin/
  plugin.json          the plugin: name, version, author
  marketplace.json     this repo as its own one-plugin marketplace
  icon.png
skills/floorplan/
  SKILL.md             the workflow Claude follows
  references/          formats and style guides Claude reads while working
    schema.md                architecture.json and recent-work.json
    choosing-boundaries.md   how to carve a codebase into a good map
    writing-descriptions.md  plain-language names and descriptions
  scripts/             Node.js, no dependencies; Claude runs these
    status.mjs     is there a map, and how stale is it (runs when the skill loads)
    scan.mjs       repos, files, imports, endpoints, requests → .cache/scan.json
    build.mjs      validate, assign files, connect, Health, screens → graph.json + index.html
    describe.mjs   worksheets for Claude to name and describe files and endpoints
    refresh.mjs    incremental update: re-scan, carry over, flag changes, rebuild
    recent.mjs     facts for marking recent work
    open.mjs       start or reuse the map's server, and open the browser
    lib/           extraction, import resolution, route matching, Health, screens, helpers
  assets/
    viewer.html    the map (template the build fills in)
    ui/            viewer extensions: glossary, Health, recent work, screens, tour, waitlist card
    graph-query.js shared map lookups (viewer, query.mjs, Ask instructions)
    serve.mjs      copied into each project's floorplan/ folder
    query-cli.mjs  becomes floorplan/query.mjs
    logo.png, favicon.png
    vendor/        bundled layout engine (elkjs) and fonts, with their licenses
docs/                  these guides
```

## Try your working copy

Install from your local folder instead of GitHub:

```bash
claude plugin marketplace add /path/to/floorplan
claude plugin install floorplan@floorplan
```

A plugin installed from a local folder runs straight from it, so edits apply in the next session with no update step.

The scripts also run on their own, which is the fastest way to work on them:

```bash
node skills/floorplan/scripts/scan.mjs /path/to/project
node skills/floorplan/scripts/build.mjs /path/to/project
node skills/floorplan/scripts/open.mjs /path/to/project
```

`build.mjs` needs a `floorplan/architecture.json` in the project, so run the skill once first, or write a small one by hand ([schema](../skills/floorplan/references/schema.md)).

## Extending the viewer

Files in `skills/floorplan/assets/ui/` are inlined into every map, in name order. They talk to the viewer only through `window.Floorplan`, which offers:
- the graph and lookups;
- navigation (`go`, `open`, `reveal`, `showBoard`, `playFlow`);
- `addHeaderButton` and `addPanelSection('overview' | 'item', fn)`;
- `modal`, `toast`, `store`;
- events (`on('ready' | 'render' | 'panel' | 'technical')`).

`20-health.js` and `25-recent.js` are good examples.

## Guidelines

- **No dependencies.** The scripts must run anywhere Node 18+ does, with nothing to install.
- **Plain language first.** Anything the map shows people should make sense to an app's owner, not just its engineers.
- **Never store or print secret values.** Health findings record where a secret is and a masked hint, never the value.
- **Keep examples generic.** Code comments, docs and prompts must not describe any real private project.

## Releasing

1. Update `CHANGELOG.md`.
2. Bump `version` in `.claude-plugin/plugin.json`. Users only receive an update when the version changes.
3. Check the manifests, including the official plugin directory's requirements:
   ```bash
   claude plugin validate . --profile directory
   ```
4. Commit, then create the release tag, which checks that `plugin.json` and the marketplace entry agree:
   ```bash
   claude plugin tag
   git push --follow-tags
   ```
