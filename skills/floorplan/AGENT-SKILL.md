---
name: floorplan
description: Create or update an interactive codebase architecture map with subsystems, files, API routes, dependencies, health checks and recent work. Use when asked to visualize, explain, map or diagram a codebase, including monorepos and multi-repo projects.
---

# Floorplan for Codex and Antigravity

This skill uses Node.js 18+ scripts shipped alongside this SKILL.md. Resolve the absolute directory containing this file as SKILL_ROOT and the user's codebase (or supplied path) as PROJECT_ROOT. Use your normal file-read and terminal tools; do not assume Claude Code-specific variables or Bash tool names exist.

## First run

1. Run: node "<SKILL_ROOT>/scripts/scan.mjs" "<PROJECT_ROOT>". Read its summary; do not dump the entire .cache/scan.json into context.
2. Read <SKILL_ROOT>/references/schema.md, choosing-boundaries.md and writing-descriptions.md.
3. Inspect the project's README, manifests and main entrypoints. Choose 3–9 high-level subsystems based on the real code and write <PROJECT_ROOT>/floorplan/architecture.json following the schema. Include accurate edges, 1–3 primary flows and a short tour. Describe purposes in clear language. Do not invent dependencies.
4. Run: node "<SKILL_ROOT>/scripts/build.mjs" "<PROJECT_ROOT>" --no-claude-md. Fix validation errors and ensure >90% of code is assigned.
5. Run: node "<SKILL_ROOT>/scripts/describe.mjs" "<PROJECT_ROOT>". Read worksheets under floorplan/.cache/worksheets/ and fill floorplan/descriptions/*.json with a concise, accurate name and description for every file and route. For large sets, split worksheets among independent helpers if available. Rebuild until files and routes are 100% described.
6. Run: node "<SKILL_ROOT>/scripts/recent.mjs" "<PROJECT_ROOT>". Write floorplan/recent-work.json using the schema, and rebuild. Highlight meaningful work without revealing secrets.
7. Open the viewer: node "<SKILL_ROOT>/scripts/open.mjs" "<PROJECT_ROOT>" --provider <provider>. Use codex when running in Codex, antigravity when running in Antigravity. On a remote/headless environment, use --no-open and report the local URL, or explain how to open floorplan/index.html.
8. Report the URL, architecture overview, high-severity Health findings and uncertainty.

## Refresh an existing map

When floorplan/graph.json and architecture.json exist, do not start over:
- Run: node "<SKILL_ROOT>/scripts/refresh.mjs" "<PROJECT_ROOT>" --no-claude-md.
- Follow the NEXT section, describe only new or flagged items and rebuild.
- Run recent.mjs, update recent-work.json, rebuild, then open the viewer.

## Ask and privacy

The viewer is self-contained. Its optional local Ask server runs the selected coding agent CLI on the user's computer. Start it from the codebase root with node floorplan/serve.mjs --provider codex or --provider antigravity. Choose --provider auto when multiple agents are installed. Only ask the agent to inspect files. Avoid source modifications, secret disclosure and auto-approved write permissions. Codex uses a read-only sandbox. Antigravity uses its sandbox and permission controls, which should be verified in the target environment.

Generated floorplan/ ignores itself in git. Do not modify tracked .gitignore, tracked AGENTS.md, application code or deployment as part of mapping. Confirm the underlying code before making changes based on the map.

Queries from the project root:
- node floorplan/query.mjs overview
- node floorplan/query.mjs find "<words>"
- node floorplan/query.mjs show "<file path | module id | GET /path>"
- node floorplan/query.mjs path "<from>" "<to>"
