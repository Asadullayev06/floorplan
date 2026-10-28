// Provider adapters for Floorplan's local Ask server.
// The map stays provider-independent; only CLI invocation and event parsing vary.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const PROVIDER_NAMES = { claude: 'Claude Code', codex: 'Codex', antigravity: 'Antigravity' };
const BIN = { claude: 'claude', codex: 'codex', antigravity: 'agy' };
const MODULES = {
  claude: [['@anthropic-ai', 'claude-code', 'cli.js']],
  codex: [['@openai', 'codex', 'bin', 'codex.js']],
  antigravity: [],
};
const ORDER = ['claude', 'codex', 'antigravity'];

function which(name) {
  try {
    return execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000,
    }).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch { return []; }
}

function executable(id, explicit) {
  const name = BIN[id];
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidates = explicit ? [explicit] : [
    ...which(name),
    path.join(home, '.local', 'bin', process.platform === 'win32' ? name + '.exe' : name),
    ...(process.platform === 'win32' ? [path.join(process.env.APPDATA || '', 'npm', name + '.cmd')] : []),
  ];
  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    if (/\.(m?js)$/i.test(candidate)) {
      return { cmd: process.execPath, prefix: [candidate], path: candidate, shell: false };
    }
    if (process.platform === 'win32' && /\.(cmd|bat|ps1)$/i.test(candidate)) {
      for (const parts of MODULES[id]) {
        const file = path.join(path.dirname(candidate), 'node_modules', ...parts);
        if (fs.existsSync(file)) return { cmd: process.execPath, prefix: [file], path: candidate, shell: false };
      }
      const exe = candidate.replace(/\.(cmd|bat|ps1)$/i, '.exe');
      if (fs.existsSync(exe)) return { cmd: exe, prefix: [], path: exe, shell: false };
      if (/\.ps1$/i.test(candidate)) continue;
      // Windows npm-style shims require a shell if no native/JS entrypoint was found.
      return { cmd: candidate, prefix: [], path: candidate, shell: true };
    }
    return { cmd: candidate, prefix: [], path: candidate, shell: false };
  }
  return null;
}

export function resolveProvider(requested = 'auto', paths = {}) {
  if (requested !== 'auto' && !ORDER.includes(requested))
    throw new Error('Unknown Floorplan provider: ' + requested + '. Use claude, codex, antigravity or auto.');
  const ids = requested === 'auto' ? ORDER : [requested];
  for (const id of ids) {
    const found = executable(id, paths[id]);
    if (found) return { id, label: PROVIDER_NAMES[id], ...found };
  }
  return null;
}

export function providerEnv(provider) {
  const env = { ...process.env };
  if (provider?.id === 'claude') {
    for (const k of Object.keys(env))
      if (/^CLAUDE_?CODE_(SESSION|ENTRYPOINT|CHILD|MESSAGING|HOST|SDK)|^CLAUDECODE$/.test(k)) delete env[k];
  }
  return env;
}

export function providerRequest(provider, { question, mode, session, model, schemaFile }) {
  const safeQuestion = String(question || '').slice(0, 4000);
  const instructions = mode.instructions + '\n\nThe request is read-only. Never edit source files, execute mutating commands, or reveal secret values. Return a JSON object matching the supplied schema.';
  const schema = mode.schema;
  const selectedModel = model && /^[\w.\/:-]+$/.test(model) ? model : '';
  let args, input;
  if (provider.id === 'claude') {
    args = ['-p', '--output-format', 'stream-json', '--verbose',
      '--json-schema', schema, '--append-system-prompt', mode.instructions,
      '--tools', 'Read,Grep,Glob,Bash', '--allowedTools',
      'Bash(node floorplan/query.mjs:*)', 'Read', 'Grep', 'Glob'];
    if (session && /^[a-zA-Z0-9_-]+$/.test(session)) args.push('--resume', session);
    input = safeQuestion;
  } else if (provider.id === 'codex') {
    args = ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check',
      '--output-schema', schemaFile];
    if (selectedModel) args.push('--model', selectedModel);
    args.push('-');
    input = instructions + '\n\nSchema:\n' + schema + '\n\nUser question:\n' + safeQuestion;
  } else {
    args = ['--input-format', 'stream-json', '--output-format', 'stream-json',
      '--json-schema', schemaFile, '--sandbox'];
    if (session && /^[a-zA-Z0-9_-]+$/.test(session)) args.push('--conversation', session);
    if (selectedModel) args.push('--model', selectedModel);
    input = JSON.stringify({ event: 'user', message: { content: instructions + '\n\nSchema:\n' + schema + '\n\nUser question:\n' + safeQuestion } }) + '\n';
  }
  return { args: [...provider.prefix, ...args], input };
}

export function parseProviderAnswer(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const t = String(value ?? '');
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  for (const candidate of [t, fence?.[1], t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return { title: 'Answer', answer: t, items: [] };
}

// One normalized event per call. state lasts only for a single Ask request.
export function handleProviderEvent(provider, ev, state) {
  if (provider.id === 'claude') {
    if (ev.type === 'assistant') {
      const tool = (ev.message?.content || []).find(c => c.type === 'tool_use');
      if (tool) return { progress: { name: tool.name, input: tool.input || {} } };
    }
    if (ev.type === 'result') {
      if (ev.is_error) return { failure: String(ev.result || ev.subtype || 'Claude Code failed') };
      return { answer: parseProviderAnswer(ev.structured_output || ev.result), session: ev.session_id || null };
    }
  } else if (provider.id === 'codex') {
    if (ev.type === 'thread.started') state.session = ev.thread_id;
    if ((ev.type === 'item.started' || ev.type === 'item.completed') && ev.item?.type === 'command_execution')
      return { progress: { name: 'Command', input: { command: ev.item.command || '' } } };
    if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') state.last = ev.item.text || '';
    if (ev.type === 'turn.failed' || ev.type === 'error')
      return { failure: String(ev.error?.message || ev.message || 'Codex failed') };
    if (ev.type === 'turn.completed')
      return { answer: parseProviderAnswer(state.last || ''), session: null };
  } else {
    if (ev.event === 'step_update' && ev.step_update?.tool_info)
      return { progress: { name: ev.step_update.tool_info.name || 'Tool', input: ev.step_update.tool_info.parameters || {} } };
    if (ev.event === 'result') {
      const r = ev.result || {};
      if (r.status !== 'SUCCESS' && r.status !== 'COMPLETED')
        return { failure: String(r.error?.message || r.error || 'Antigravity: ' + (r.status || 'no result')) };
      return { answer: parseProviderAnswer(r.structured_output || r.response), session: ev.conversation_id || r.conversation_id || null };
    }
  }
  return null;
}
