// Floorplan Cloud waitlist: a tiny Cloud Run service that adds opt-in sign-ups to a Google Sheet.
//
// Its address is in the plugin's public code, so it's built to be harmless when someone finds it:
//   - write-only: it never returns anything from the sheet, and a repeat sign-up looks exactly like a new
//     one, so nobody can check whether an address is on the list;
//   - strict input: POST only, a 1 KB body, an email address and "solo" or "team", nothing else;
//     values are written as plain text, never as formulas;
//   - rate limits per IP address (IPv6 by /64) and overall, a cap on total rows, and short timeouts;
//   - deployed with max-instances 1, so the limits hold across all requests and the cost can't run away.
// IP addresses are only held in memory for the rate limits, never written to the sheet.
//
// Zero dependencies: Node 20+. Talks to Google Sheets with the service's own identity, from the metadata
// server. DRY_RUN=1 logs sign-ups instead of writing them, for local testing.
import http from 'node:http';
import crypto from 'node:crypto';

const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
const SHEET_ID = process.env.SHEET_ID || '';
const TAB = process.env.SHEET_TAB || 'Waitlist';
const DRY_RUN = process.env.DRY_RUN === '1';
const MAX_ROWS = num(process.env.MAX_ROWS, 20000);
const PER_IP_HOUR = num(process.env.PER_IP_HOUR, 5);        // requests per IP per hour, valid or not
const GLOBAL_MINUTE = num(process.env.GLOBAL_MINUTE, 30);   // sign-ups per minute, everyone together
const GLOBAL_DAY = num(process.env.GLOBAL_DAY, 2000);       // sign-ups per day, everyone together
const EMAIL = /^[A-Za-z0-9][^\s@]{0,63}@[^\s@]+\.[^\s@]{2,}$/;

// ---------- rate limits ----------
const HOUR = 3600e3, MIN = 60e3, DAY = 86400e3;
const perIp = new Map(); // key -> timestamps in the last hour
const writes = [];       // timestamps of sign-ups in the last day
function ipKey(req) {
  // Cloud Run appends the real client address last; anything before it was sent by the client
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim().replace(/^::ffff:/, '');
  if (!ip.includes(':')) return ip;
  // IPv6: one household or server usually has a whole /64, so limit by that
  const [head, tail = ''] = ip.split('::');
  const a = head ? head.split(':') : [], b = tail ? tail.split(':') : [];
  const full = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b];
  return full.slice(0, 4).join(':') + '::/64';
}
function allowIp(key, now) {
  const hits = (perIp.get(key) || []).filter((t) => now - t < HOUR);
  if (hits.length >= PER_IP_HOUR) { perIp.set(key, hits); return false; }
  hits.push(now); perIp.set(key, hits);
  return true;
}
function allowWrite(now) {
  while (writes.length && now - writes[0] > DAY) writes.shift();
  const lastMinute = writes.filter((t) => now - t < MIN).length;
  return lastMinute < GLOBAL_MINUTE && writes.length < GLOBAL_DAY;
}
// forget old addresses; if a flood fills memory anyway, start over rather than run out
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of perIp) if (!v.some((t) => now - t < HOUR)) perIp.delete(k);
}, 5 * MIN).unref();
const trimIps = () => { if (perIp.size > 100000) perIp.clear(); };

// ---------- Google Sheets ----------
let token = null, tokenExp = 0;
async function accessToken() {
  if (token && Date.now() < tokenExp) return token;
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=https://www.googleapis.com/auth/spreadsheets', { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`metadata token: ${r.status}`);
  const j = await r.json();
  token = j.access_token; tokenExp = Date.now() + (j.expires_in - 60) * 1000;
  return token;
}
async function sheets(method, range, suffix = '', body) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}${suffix}`;
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`sheets ${method}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// who's already on the list, as hashes, so repeats don't add rows
const known = new Set();
let rows = 0;
const hash = (email) => crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
async function loadKnown() {
  if (DRY_RUN) return;
  const r = await sheets('GET', `${TAB}!B2:B`);
  for (const [e] of r.values || []) if (e) known.add(hash(e));
  rows = (r.values || []).length;
  // a brand-new sheet: add the headings
  if (!rows) await sheets('POST', `${TAB}!A1:C1`, ':append?valueInputOption=RAW', { values: [['Signed up', 'Email', 'How they would use it']] });
}
async function append(email, use) {
  const row = [new Date().toISOString(), email, use === 'team' ? 'With my team' : 'Just me'];
  if (DRY_RUN) { console.log('sign-up (dry run):', row[0], row[2]); return; }
  await sheets('POST', `${TAB}!A:C`, ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { values: [row] });
}

// ---------- http ----------
const reply = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || new URL(req.url, 'http://x').pathname !== '/') return reply(res, 404, { ok: false, error: 'not_found' });
  const now = Date.now();
  trimIps();
  if (!allowIp(ipKey(req), now)) return reply(res, 429, { ok: false, error: 'rate_limited' });
  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (d) => { raw += d; if (raw.length > 1024) { reply(res, 413, { ok: false, error: 'too_large' }); req.destroy(); } });
  req.on('end', async () => {
    if (res.writableEnded) return;
    let body = null; try { body = JSON.parse(raw); } catch {}
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const use = body?.use === 'team' ? 'team' : body?.use === 'solo' ? 'solo' : null;
    if (!use || email.length > 254 || !EMAIL.test(email)) return reply(res, 400, { ok: false, error: 'bad_email' });
    const key = hash(email);
    if (known.has(key)) return reply(res, 200, { ok: true });
    if (!allowWrite(now) || rows >= MAX_ROWS) return reply(res, 429, { ok: false, error: 'rate_limited' });
    // claim it before the await, so two requests at once can't both add a row
    known.add(key); writes.push(now); rows++;
    try { await append(email, use); reply(res, 200, { ok: true }); }
    catch (e) { known.delete(key); rows--; console.error(e.message); reply(res, 503, { ok: false, error: 'unavailable' }); }
  });
});
server.requestTimeout = 10000;
server.headersTimeout = 5000;

if (!SHEET_ID && !DRY_RUN) { console.error('Set SHEET_ID (or DRY_RUN=1).'); process.exit(1); }
// read the list at start; if the sheet isn't reachable yet (not shared, wrong tab name), keep trying
const load = () => loadKnown().then(() => true, (e) => { console.error('couldn\'t read the sheet yet:', e.message); return false; });
if (!(await load())) { const retry = setInterval(async () => { if (await load()) clearInterval(retry); }, MIN); retry.unref(); }
server.listen(num(process.env.PORT, 8080), () => console.log(`waitlist listening on ${server.address().port}${DRY_RUN ? ' (dry run)' : ''}`));
