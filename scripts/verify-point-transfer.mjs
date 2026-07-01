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
    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[name]) process.env[name] = value;
  }
}

loadEnv(path.resolve('.env'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('SUPABASE_ENV_REQUIRED');

function makeClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(account) {
  const instance = makeClient();
  const { data, error } = await instance.auth.signInWithPassword({
    email: `${account}@user.mute.app`,
    password: 'mute1234!',
  });
  if (error || !data.user)
    throw new Error(`${account.toUpperCase()}_LOGIN_FAILED: ${error?.message ?? 'NO_USER'}`);
  return { client: instance, userId: data.user.id };
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

async function wallet(instance) {
  const { data, error } = await instance.rpc('get_my_wallet');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return Number(row?.point_balance ?? Number.NaN);
}

async function transfer(instance, roomId, recipientUserId, amount, requestId) {
  return instance.rpc('transfer_room_points', {
    p_room_id: roomId,
    p_recipient_user_id: recipientUserId,
    p_amount: amount,
    p_request_id: requestId,
  });
}

function expectError(result, code) {
  assert(Boolean(result.error), `${code}_EXPECTED`);
  assert(
    String(result.error?.message).includes(code),
    `${code}_WRONG_ERROR: ${result.error?.message}`,
  );
}

const owner = await signIn('test-bravo');
const member = await signIn('test-alpha');
let roomId = null;
let forwardCompleted = false;
let reverseCompleted = false;
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const forwardRequestId = `verify-point-forward-${stamp}`;
const reverseRequestId = `verify-point-reverse-${stamp}`;

async function deleteTestRoom(roomIdToDelete) {
  try {
    await owner.client.rpc('delete_room_as_owner', {
      p_room_id: roomIdToDelete,
    });
  } catch {
    // Cleanup is best effort; the main assertions report mutation failures.
  }
}

async function cleanupStaleTestRooms() {
  const { data } = await owner.client
    .from('rooms')
    .select('id')
    .like('name', '포인트검증%')
    .is('deleted_at', null);
  for (const room of data ?? []) await deleteTestRoom(room.id);
}

if (process.argv.includes('--cleanup-only')) {
  await cleanupStaleTestRooms();
  await Promise.all([
    owner.client.auth.signOut().catch(() => undefined),
    member.client.auth.signOut().catch(() => undefined),
  ]);
  console.log(JSON.stringify({ ok: true, cleanup: true }));
  process.exit(0);
}

try {
  await cleanupStaleTestRooms();
  const ownerBefore = await wallet(owner.client);
  const memberBefore = await wallet(member.client);
  assert(Number.isFinite(ownerBefore) && ownerBefore >= 1, 'OWNER_TEST_BALANCE_REQUIRED');
  assert(Number.isFinite(memberBefore), 'MEMBER_TEST_BALANCE_INVALID');

  const { data: createdRoomId, error: createError } = await owner.client.rpc('create_room', {
    p_name: `포인트검증${new Date().toISOString().slice(14, 19).replace(':', '')}`.slice(0, 13),
    p_description: '자동 포인트 전송 회귀 검증',
    p_category: 'member',
    p_max_members: 2,
    p_region: null,
  });
  if (createError) throw new Error(`CREATE_FAILED: ${createError.message}`);
  assert(typeof createdRoomId === 'string', 'CREATE_INVALID_RESPONSE');
  roomId = createdRoomId;

  expectError(
    await transfer(owner.client, roomId, member.userId, 0, `verify-invalid-${stamp}`),
    'POINT_TRANSFER_AMOUNT_INVALID',
  );
  expectError(
    await transfer(owner.client, roomId, owner.userId, 1, `verify-self-${stamp}`),
    'POINT_TRANSFER_RECIPIENT_INVALID',
  );
  expectError(
    await transfer(member.client, roomId, owner.userId, 1, `verify-sender-${stamp}`),
    'POINT_TRANSFER_MEMBER_REQUIRED',
  );
  expectError(
    await transfer(owner.client, roomId, member.userId, 1, `verify-recipient-${stamp}`),
    'POINT_TRANSFER_RECIPIENT_INVALID',
  );

  const join = await member.client.rpc('request_room_join', {
    p_room_id: roomId,
    p_name: '포인트검증멤버',
    p_introduction: '자동 검증 프로필',
  });
  if (join.error) throw join.error;
  const { data: requests, error: requestError } = await owner.client
    .from('room_join_requests')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', member.userId)
    .eq('status', 'pending')
    .limit(1);
  if (requestError) throw requestError;
  const requestId = requests?.[0]?.id;
  assert(typeof requestId === 'string', 'JOIN_REQUEST_NOT_FOUND');
  const approval = await owner.client.rpc('decide_room_join', {
    p_request_id: requestId,
    p_approve: true,
  });
  if (approval.error) throw approval.error;

  const first = await transfer(
    owner.client,
    roomId,
    member.userId,
    1,
    forwardRequestId,
  );
  if (first.error) throw first.error;
  const firstRow = Array.isArray(first.data) ? first.data[0] : first.data;
  assert(typeof firstRow?.message_id === 'string', 'TRANSFER_MESSAGE_ID_MISSING');
  assert(Number(firstRow?.point_balance) === ownerBefore - 1, 'SENDER_RESPONSE_BALANCE_WRONG');
  forwardCompleted = true;

  assert((await wallet(owner.client)) === ownerBefore - 1, 'SENDER_BALANCE_NOT_DEBITED');
  assert((await wallet(member.client)) === memberBefore + 1, 'RECIPIENT_BALANCE_NOT_CREDITED');

  const duplicate = await transfer(
    owner.client,
    roomId,
    member.userId,
    1,
    forwardRequestId,
  );
  if (duplicate.error) throw duplicate.error;
  const duplicateRow = Array.isArray(duplicate.data) ? duplicate.data[0] : duplicate.data;
  assert(duplicateRow?.message_id === firstRow.message_id, 'IDEMPOTENT_MESSAGE_CHANGED');
  assert((await wallet(owner.client)) === ownerBefore - 1, 'IDEMPOTENT_RETRY_DOUBLE_DEBITED');
  assert((await wallet(member.client)) === memberBefore + 1, 'IDEMPOTENT_RETRY_DOUBLE_CREDITED');

  expectError(
    await transfer(owner.client, roomId, member.userId, 2, forwardRequestId),
    'POINT_TRANSFER_IDEMPOTENCY_CONFLICT',
  );
  expectError(
    await transfer(
      owner.client,
      roomId,
      member.userId,
      ownerBefore + 1,
      `verify-insufficient-${stamp}`,
    ),
    'INSUFFICIENT_POINTS',
  );

  const { data: message, error: messageError } = await owner.client
    .from('messages')
    .select('id,kind,body')
    .eq('id', firstRow.message_id)
    .maybeSingle();
  if (messageError) throw messageError;
  assert(message?.kind === 'system', 'TRANSFER_MESSAGE_KIND_WRONG');
  assert(String(message?.body).includes('1p를 보냈습니다.'), 'TRANSFER_MESSAGE_BODY_WRONG');

  for (const [account, expectedAmount] of [[owner, -1], [member, 1]]) {
    const { data: ledger, error: ledgerError } = await account.client
      .from('point_ledger')
      .select('amount,reason,reference_id')
      .eq('reference_id', forwardRequestId);
    if (ledgerError) throw ledgerError;
    assert(
      ledger?.length === 1 &&
        Number(ledger[0].amount) === expectedAmount &&
        ledger[0].reason === 'point_transfer',
      'POINT_LEDGER_ENTRY_WRONG',
    );
  }

  const reverse = await transfer(
    member.client,
    roomId,
    owner.userId,
    1,
    reverseRequestId,
  );
  if (reverse.error) throw reverse.error;
  reverseCompleted = true;
  assert((await wallet(owner.client)) === ownerBefore, 'OWNER_BALANCE_NOT_RESTORED');
  assert((await wallet(member.client)) === memberBefore, 'MEMBER_BALANCE_NOT_RESTORED');

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'zero amount rejected',
      'self transfer rejected',
      'non-member sender rejected',
      'non-member recipient rejected',
      'valid transfer debits and credits atomically',
      'response contains new balance and message id',
      'same request id is idempotent',
      'changed payload with same request id is rejected',
      'insufficient balance is rejected without mutation',
      'point ledger has matching debit and credit',
      'system message is created',
      'reverse transfer restores both test balances',
    ],
  }, null, 2));
} finally {
  if (roomId && forwardCompleted && !reverseCompleted) {
    await transfer(
      member.client,
      roomId,
      owner.userId,
      1,
      `verify-point-emergency-reverse-${stamp}`,
    ).catch(() => undefined);
  }
  if (roomId) {
    await deleteTestRoom(roomId);
  }
  await Promise.all([
    owner.client.auth.signOut().catch(() => undefined),
    member.client.auth.signOut().catch(() => undefined),
  ]);
}
