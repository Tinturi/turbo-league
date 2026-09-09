// Creates only isolated, clearly marked QA profiles and removes precisely those IDs.
// Never changes an existing player's ownership, avatar, DD allowance or statistics.
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const site = 'https://turbo-league-s2.netlify.app';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const qaPlayers = [];
let before;
const prefix = `qa_${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('base64url');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, body, cookie, origin = site, contentType = 'application/json') {
  const response = await fetch(site + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin, ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': contentType }) },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
async function expectStatus(result, status, label) {
  assert.equal(result.status, status, `${label}: ${JSON.stringify(result.data).slice(0,500)}`);
  console.log(`PASS: ${label}`);
  return result;
}
async function snapshot() {
  const players = await db.from('players').select('*').order('id');
  const matches = await db.from('matches').select('*').order('player_id').order('match_id');
  if (players.error || matches.error) throw new Error('Cannot snapshot existing statistics');
  return { players: players.data, matches: matches.data };
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const result = await request('/api/auth'); if (result.status === 200 && result.data.release === 'accounts-20260909-v4') { ready = true; break; } } catch {}
    await sleep(10000);
  }
  assert.ok(ready, 'New deployment did not become ready');
  // Exact orphaned QA identities from the two pre-fix verification runs.
  // Refuse cleanup unless both metadata and the absence of a real profile match.
  for (const qa of [
    { id: '81f822ac-eb9f-464a-bb1f-02b1459f8ee2', username: 'qa_516cf1bd0411', playerId: 14 },
    { id: '6b080a3e-0f5b-4376-9c75-673ac603eb29', username: 'qa_9ef987eb0def', playerId: 18 },
  ]) {
    const { data, error } = await db.auth.admin.getUserById(qa.id);
    if (error?.status === 404 || error?.code === 'user_not_found') continue;
    if (error || !data.user) throw new Error('Could not verify abandoned QA identity');
    assert.equal(data.user.app_metadata.league_username, qa.username);
    assert.equal(Number(data.user.app_metadata.league_player_id), qa.playerId);
    const profile = await db.from('players').select('id').eq('id', qa.playerId).maybeSingle();
    assert.ok(!profile.error && !profile.data, 'Refusing to remove an identity with a player profile');
    const removed = await db.auth.admin.deleteUser(qa.id);
    if (removed.error) throw new Error('Abandoned QA identity cleanup failed');
  }
  before = await snapshot();
  for (let i = 0; i < 2; i++) {
    const { data, error } = await db.from('players').insert({ name: `QA verification ${prefix} ${i + 1}`, account_id: 8000000000 + randomInt(100000000, 2000000000), rating: 0, wins: 0, losses: 0, active: true }).select('id,account_id').single();
    if (error) throw new Error('Could not create isolated QA profile');
    qaPlayers.push(data);
  }
  const [a, b] = qaPlayers;
  await expectStatus(await request('/api/double-down', { playerId: a.id }), 401, 'Anonymous DD rejected');
  const anonymousAvatar = await request(`/api/avatar/${a.account_id}`, Buffer.from('test'), undefined, site, 'image/png');
  assert.ok([401,403].includes(anonymousAvatar.status), 'Anonymous avatar write must be denied');
  console.log('PASS: anonymous avatar change rejected');
  const registration = await expectStatus(await request('/api/auth', { action: 'register', username: prefix, password, playerId: a.id }), 200, 'Registration and automatic login');
  assert.ok(registration.cookie?.startsWith('tl-session='), 'Session cookie missing');
  assert.match(registration.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(registration.headers.get('set-cookie'), /Secure/i);
  const available = await request('/api/auth', undefined, registration.cookie);
  assert.equal(Number(available.data.account.player_id), a.id);
  assert.ok(!available.data.players.some(p => p.id === a.id), 'Claimed profile is still available');
  await expectStatus(await request('/api/auth', { action: 'register', username: `${prefix}_other`, password, playerId: a.id }), 409, 'Duplicate profile binding rejected');
  await expectStatus(await request('/api/auth', { action: 'register', username: prefix.toUpperCase(), password, playerId: b.id }), 409, 'Duplicate normalized login rejected');
  const login = await expectStatus(await request('/api/auth', { action: 'login', username: prefix.toUpperCase(), password }), 200, 'Login accepts normalized username');
  await expectStatus(await request('/api/auth', { action: 'login', username: prefix, password: password + 'wrong' }), 401, 'Wrong password rejected');
  await expectStatus(await request('/api/double-down', { playerId: b.id }, login.cookie), 403, 'Other profile DD rejected');
  await expectStatus(await request('/api/double-down', { playerId: a.id }, login.cookie, 'https://example.org'), 403, 'Cross-origin DD rejected');
  const racing = await Promise.all([request('/api/double-down', { playerId: a.id }, login.cookie), request('/api/double-down', { playerId: a.id }, login.cookie)]);
  assert.deepEqual(racing.map(r => r.status).sort(), [200,409], 'Concurrent DD requests must reserve exactly once');
  console.log('PASS: owner DD accepted exactly once under concurrent requests');
  await expectStatus(await request('/api/double-down', { playerId: a.id }, login.cookie), 409, 'Duplicate DD rejected');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1xkAAAAASUVORK5CYII=', 'base64');
  await expectStatus(await request(`/api/avatar/${b.account_id}`, png, login.cookie, site, 'image/png'), 403, 'Other profile avatar change rejected');
  await expectStatus(await request(`/api/avatar/${a.account_id}`, Buffer.from('<svg onload="alert(1)"></svg>'), login.cookie, site, 'image/svg+xml'), 400, 'SVG avatar rejected');
  await expectStatus(await request(`/api/avatar/${a.account_id}`, png, login.cookie, site, 'image/png'), 200, 'Owner avatar change accepted');
  const avatar = await request(`/api/avatar/${a.account_id}`);
  assert.equal(avatar.data.avatar, `data:image/png;base64,${png.toString('base64')}`);
  console.log('PASS: custom avatar readback');
  const logout = await expectStatus(await request('/api/auth', { action: 'logout' }, login.cookie), 200, 'Logout');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/i);
  assert.equal((await request('/api/auth')).data.account, null);
  for (const path of ['/', '/stats', `/player/${before.players.find(p => p.active).id}`]) {
    const response = await fetch(site + path, { signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200, `Existing page ${path}`);
    assert.ok(!(await response.text()).includes('Не удалось загрузить рейтинг'), 'Leaderboard data failed');
  }
  console.log('PASS: existing leaderboard, statistics and player pages');
} finally {
  // IDs are returned from this run's inserts; never select real profiles by name.
  for (const p of qaPlayers) {
    const { data: accounts, error: lookupError } = await db.from('player_accounts').select('user_id').eq('player_id', p.id);
    if (lookupError) throw new Error('QA cleanup could not look up owned test account');
    for (const account of accounts ?? []) {
      const { error } = await db.auth.admin.deleteUser(account.user_id);
      if (error) throw new Error('QA auth cleanup failed');
    }
    for (const table of ['player_avatars', 'double_down_activations', 'double_down_bonuses']) {
      const { error } = await db.from(table).delete().eq('player_id', p.id);
      if (error) throw new Error('QA supporting row cleanup failed');
    }
    const { error } = await db.from('players').delete().eq('id', p.id).eq('account_id', p.account_id);
    if (error) throw new Error('QA profile cleanup failed');
  }
  if (before) {
    const after = await snapshot();
    assert.deepEqual(after, before, 'Existing statistics changed during verification; inspect concurrent sync before attributing changes');
    console.log(`PASS: all QA rows removed; ${before.players.length} existing players and ${before.matches.length} matches unchanged`);
  }
}
