# Privacy and security

## What runs where

| Part | Where it runs | What it sends |
|---|---|---|
| Scan, build, updates | your computer (Node.js) | nothing |
| Writing names and descriptions | Claude, through your Claude Code session | the files Claude reads, the same as any Claude Code task |
| The map | your browser | it loads its layout engine from [jsDelivr](https://www.jsdelivr.com/) and fonts from Google Fonts. No code or map data is sent |
| The map's server (`serve.mjs`) | your computer, listening on `127.0.0.1` only | nothing on its own |
| Asking questions (Claude Code CLI) | a `claude -p` session on your computer, with your account | your question, and the files Claude chooses to read |
| Asking questions (Claude app) | your claude.ai account | the map (names, descriptions, structure), never your source code. Claude asks before publishing it there |

Floorplan has no analytics or telemetry, and no servers of its own.

To keep the map fully offline, put `elk.bundled.js` (elkjs 0.9.x) in `skills/floorplan/assets/vendor/`. The build then inlines it into the map instead of loading it from a CDN.

## The local server

- It listens on `127.0.0.1` only, so other machines on your network can't reach it.
- Every start creates a random token, which only the map page it serves receives. Asking questions and saving flows require that token, and those requests are refused when they come from another website.
- Questions run Claude with **read-only** tools: reading files, searching, and the map's own lookup script. It can't edit files or run other commands.
- It stops by itself two hours after the last tab closes, and `node floorplan/serve.mjs --stop` stops it immediately.

## Secrets

The Health check looks for passwords, API keys and private keys in your code, and for `.env` files that would be committed. When it finds one, it records only the file, the line, the kind of secret, and a masked hint like "starts AKIA…, 20 characters". **Secret values are never stored in the map, printed, or sent anywhere**, and Claude is instructed never to repeat them.

The check is a helpful first pass, not a security audit.

## Git

Nothing Floorplan creates is committed. See [What's in your project](project-files.md#staying-out-of-git).

## Reporting a vulnerability

Please report security problems privately, as described in [SECURITY.md](../SECURITY.md), rather than in a public issue.
