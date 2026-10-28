import test from 'node:test';
import assert from 'node:assert/strict';
import { providerRequest, handleProviderEvent, parseProviderAnswer, resolveProvider } from '../skills/floorplan/assets/providers.mjs';

const mode = { instructions: 'Answer from the map only.', schema: JSON.stringify({ type: 'object', properties: { title: { type: 'string' } } }) };
const provider = id => ({ id, label: id, cmd: id, prefix: [], shell: false });
const opts = { question: 'Which file handles login?', mode, schemaFile: '/tmp/ask-schema.json' };

test('Codex Ask uses read-only sandbox, JSON events, and JSON schema', () => {
  const req = providerRequest(provider('codex'), opts);
  assert.deepEqual(req.args.slice(0, 5), ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check']);
  assert.ok(req.args.includes('--output-schema'));
  assert.equal(req.args.at(-1), '-');
  assert.match(req.input, /Which file handles login/);
});
test('Antigravity Ask uses streaming input/output and sandbox', () => {
  const req = providerRequest(provider('antigravity'), opts);
  assert.ok(req.args.includes('--input-format'));
  assert.ok(req.args.includes('stream-json'));
  assert.ok(req.args.includes('--json-schema'));
  assert.ok(req.args.includes('--sandbox'));
  assert.equal(JSON.parse(req.input).event, 'user');
});
test('Claude retains structured output and read-only tool allowlist', () => {
  const req = providerRequest(provider('claude'), { ...opts, session: 'session-123' });
  assert.ok(req.args.includes('--allowedTools'));
  assert.ok(req.args.includes('--resume'));
  assert.equal(req.input, opts.question);
});
test('Codex agent message becomes a normalized map answer', () => {
  const state = { last: '', session: null };
  handleProviderEvent(provider('codex'), { type: 'thread.started', thread_id: '123' }, state);
  handleProviderEvent(provider('codex'), { type: 'item.completed', item: { type: 'agent_message', text: '{"title":"Login","answer":"Use auth.py","items":[]}' } }, state);
  const out = handleProviderEvent(provider('codex'), { type: 'turn.completed' }, state);
  assert.equal(out.answer.title, 'Login');
  assert.equal(out.session, null);
});
test('Antigravity structured result becomes a normalized map answer', () => {
  const ev = { event: 'result', conversation_id: 'run-123', result: { status: 'SUCCESS', structured_output: { title: 'Found', answer: 'x' } } };
  const out = handleProviderEvent(provider('antigravity'), ev, {});
  assert.equal(out.answer.title, 'Found');
  assert.equal(out.session, 'run-123');
});
test('Antigravity errors do not masquerade as successful answers', () => {
  const out = handleProviderEvent(provider('antigravity'), { event: 'result', result: { status: 'ERROR', error: { message: 'authentication required' } } }, {});
  assert.match(out.failure, /authentication required/);
});
test('Claude structured outputs and session remain compatible', () => {
  const out = handleProviderEvent(provider('claude'), { type: 'result', session_id: 'abcd', structured_output: { title: 'Found' } }, {});
  assert.equal(out.answer.title, 'Found');
  assert.equal(out.session, 'abcd');
});
test('JSON fenced answers are understood', () => {
  const tick = String.fromCharCode(96).repeat(3);
  assert.deepEqual(parseProviderAnswer(tick + 'json\n{"title":"Found"}\n' + tick), { title: 'Found' });
});
test('Unknown providers fail closed', () => {
  assert.throws(() => resolveProvider('unknown'), /Unknown Floorplan provider/);
});
