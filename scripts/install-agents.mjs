#!/usr/bin/env node
// Install a portable Floorplan skill for Codex, Antigravity IDE or Antigravity CLI.
// Example: node scripts/install-agents.mjs --agent both --scope user
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'floorplan');
const argv = process.argv.slice(2);
const opt = (key, fallback) => {
  const idx = argv.indexOf('--' + key);
  return idx >= 0 ? argv[idx + 1] : fallback;
};
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Usage: node scripts/install-agents.mjs [--agent codex|antigravity|both] [--scope user|project] [--antigravity-surface ide|cli] [--target PROJECT_ROOT]');
  process.exit(0);
}
const agent = opt('agent', 'both');
const scope = opt('scope', 'user');
const surface = opt('antigravity-surface', 'ide');
if (!['codex', 'antigravity', 'both'].includes(agent)) throw Error('Invalid --agent');
if (!['user', 'project'].includes(scope)) throw Error('Invalid --scope');
if (!['ide', 'cli'].includes(surface)) throw Error('Invalid --antigravity-surface');
const projectRoot = path.resolve(opt('target', process.cwd()));
if (!fs.existsSync(path.join(source, 'AGENT-SKILL.md'))) throw Error('Portable skill manifest missing');
const home = os.homedir();
function destination(id) {
  if (scope === 'project') return path.join(projectRoot, '.agents', 'skills', 'floorplan');
  return id === 'codex'
    ? path.join(home, '.agents', 'skills', 'floorplan')
    : path.join(home, '.gemini', surface === 'cli' ? 'antigravity-cli' : 'config', 'skills', 'floorplan');
}
const ids = agent === 'both' ? ['codex', 'antigravity'] : [agent];
const installed = new Set();
for (const id of ids) {
  const dest = destination(id);
  if (installed.has(dest)) continue;
  if (path.resolve(dest) === source) throw Error('Cannot install over the Floorplan source skill');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(source, dest, { recursive: true, force: true });
  fs.copyFileSync(path.join(source, 'AGENT-SKILL.md'), path.join(dest, 'SKILL.md'));
  fs.rmSync(path.join(dest, 'AGENT-SKILL.md'), { force: true });
  installed.add(dest);
  console.log('Floorplan skill installed for ' + id + ': ' + dest);
}
console.log('Restart your coding agent and ask: "Make me a floorplan of this project."');
