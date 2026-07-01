import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.resolve('.env'));

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('SUPABASE_ENV_REQUIRED');

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(account) {
  const instance = client();
  const { error } = await instance.auth.signInWithPassword({
    email: `${account}@user.mute.app`,
    password: 'mute1234!',
  });
  if (error) throw new Error(`${account.toUpperCase()}_LOGIN_FAILED: ${error.message}`);
  return instance;
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

async function rpcDelete(instance, roomId) {
  const { error } = await instance.rpc('delete_room_as_owner', {
    p_room_id: roomId,
  });
  if (error) throw error;
}

const owner = await signIn('test-alpha');
const outsider = await signIn('test-bravo');
let roomId = null;
let deleted = false;

try {
  const suffix = new Date().toISOString().slice(11, 19).replaceAll(':', '');
  const { data, error } = await owner.rpc('create_room', {
    p_name: `삭제검증${suffix}`.slice(0, 13),
    p_description: '자동 방 삭제 회귀 검증',
    p_category: 'member',
    p_max_members: 2,
    p_region: null,
  });
  if (error) throw new Error(`CREATE_FAILED: ${error.message}`);
  assert(typeof data === 'string', 'CREATE_INVALID_RESPONSE');
  roomId = data;

  const { data: before, error: beforeError } = await owner
    .from('rooms')
    .select('id')
    .eq('id', roomId)
    .is('deleted_at', null)
    .maybeSingle();
  if (beforeError) throw beforeError;
  assert(before?.id === roomId, 'ROOM_NOT_VISIBLE_BEFORE_DELETE');

  const unauthorized = await outsider.rpc('delete_room_as_owner', {
    p_room_id: roomId,
  });
  assert(Boolean(unauthorized.error), 'OUTSIDER_DELETE_UNEXPECTEDLY_SUCCEEDED');
  assert(
    String(unauthorized.error?.message).includes('FORBIDDEN'),
    `OUTSIDER_WRONG_ERROR: ${unauthorized.error?.message}`,
  );

  const { data: afterRejectedAttempt } = await owner
    .from('rooms')
    .select('id')
    .eq('id', roomId)
    .is('deleted_at', null)
    .maybeSingle();
  assert(afterRejectedAttempt?.id === roomId, 'OUTSIDER_ATTEMPT_CHANGED_ROOM');

  await rpcDelete(owner, roomId);
  deleted = true;

  const { data: after, error: afterError } = await owner
    .from('rooms')
    .select('id')
    .eq('id', roomId)
    .is('deleted_at', null)
    .maybeSingle();
  if (afterError) throw afterError;
  assert(after === null, 'ROOM_STILL_VISIBLE_AFTER_DELETE');

  const { data: memberships, error: membershipError } = await owner
    .from('room_memberships')
    .select('status')
    .eq('room_id', roomId);
  if (membershipError) throw membershipError;
  assert(
    (memberships ?? []).length > 0 && memberships.every((row) => row.status === 'left'),
    'MEMBERSHIP_NOT_LEFT_AFTER_DELETE',
  );

  await rpcDelete(owner, roomId);

  const missingId = crypto.randomUUID();
  const missing = await owner.rpc('delete_room_as_owner', {
    p_room_id: missingId,
  });
  assert(Boolean(missing.error), 'MISSING_ROOM_DELETE_UNEXPECTEDLY_SUCCEEDED');
  assert(
    String(missing.error?.message).includes('ROOM_NOT_FOUND'),
    `MISSING_ROOM_WRONG_ERROR: ${missing.error?.message}`,
  );

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'owner can see room before delete',
      'non-owner receives FORBIDDEN',
      'failed non-owner attempt does not mutate room',
      'owner delete succeeds',
      'deleted room is hidden from active reads',
      'active memberships become left',
      'repeated delete is idempotent',
      'unknown room returns ROOM_NOT_FOUND',
    ],
  }, null, 2));
} finally {
  if (roomId && !deleted) {
    await rpcDelete(owner, roomId).catch(() => undefined);
  }
  await Promise.all([
    owner.auth.signOut().catch(() => undefined),
    outsider.auth.signOut().catch(() => undefined),
  ]);
}
