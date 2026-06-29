import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type PushJob = {
  id: number;
  recipient_user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  attempt_count: number;
};

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}

async function authenticate(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const token = authorization.slice('Bearer '.length);
  if (token === serviceRoleKey) return true;
  const { data, error } = await supabase.auth.getUser(token);
  return !error && Boolean(data.user);
}

Deno.serve(async (request) => {
  if (!(await authenticate(request)))
    return new Response('Unauthorized', { status: 401 });

  const { data: claimed, error: claimError } = await supabase.rpc(
    'claim_push_outbox',
    { p_limit: 500 },
  );
  if (claimError) return new Response(claimError.message, { status: 500 });
  const jobs = (claimed ?? []) as PushJob[];
  if (!jobs.length) return Response.json({ processed: 0 });

  const userIds = [...new Set(jobs.map((job) => job.recipient_user_id))];
  const { data: devices, error: devicesError } = await supabase
    .from('push_devices')
    .select('user_id,push_token')
    .in('user_id', userIds)
    .eq('enabled', true);
  if (devicesError) {
    await supabase
      .from('push_outbox')
      .update({ processing_started_at: null, failure_reason: devicesError.message })
      .in('id', jobs.map((job) => job.id));
    return new Response(devicesError.message, { status: 500 });
  }

  const tokensByUser = new Map<string, string[]>();
  for (const device of devices ?? []) {
    const tokens = tokensByUser.get(device.user_id) ?? [];
    tokens.push(device.push_token);
    tokensByUser.set(device.user_id, tokens);
  }

  const imageRequests = new Map<string, { bucket: string; path: string }>();
  for (const job of jobs) {
    const avatarPath = job.data?.senderAvatarPath;
    const coverPath = job.data?.roomCoverPath;
    if (typeof avatarPath === 'string' && avatarPath)
      imageRequests.set(`profile-avatars:${avatarPath}`, {
        bucket: 'profile-avatars',
        path: avatarPath,
      });
    else if (typeof coverPath === 'string' && coverPath)
      imageRequests.set(`room-covers:${coverPath}`, {
        bucket: 'room-covers',
        path: coverPath,
      });
  }

  const signedByKey = new Map<string, string>();
  for (const bucket of ['profile-avatars', 'room-covers']) {
    const paths = [...imageRequests.values()]
      .filter((item) => item.bucket === bucket)
      .map((item) => item.path);
    if (!paths.length) continue;
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
    data?.forEach((row, index) => {
      if (row.signedUrl) signedByKey.set(`${bucket}:${paths[index]}`, row.signedUrl);
    });
  }

  const noDeviceIds: number[] = [];
  const envelopes: Array<{
    jobId: number;
    token: string;
    message: Record<string, unknown>;
  }> = [];
  for (const job of jobs) {
    const tokens = tokensByUser.get(job.recipient_user_id) ?? [];
    if (!tokens.length) {
      noDeviceIds.push(job.id);
      continue;
    }
    const avatarPath = job.data?.senderAvatarPath;
    const coverPath = job.data?.roomCoverPath;
    const notificationImage =
      typeof avatarPath === 'string'
        ? signedByKey.get(`profile-avatars:${avatarPath}`)
        : typeof coverPath === 'string'
          ? signedByKey.get(`room-covers:${coverPath}`)
          : undefined;
    tokens.forEach((to) =>
      envelopes.push({
        jobId: job.id,
        token: to,
        message: {
          to,
          sound: 'default',
          channelId: 'messages',
          priority: 'high',
          title: job.title,
          body: job.body,
          data: {
            ...job.data,
            notificationId: job.id,
            notificationImageUrl: notificationImage,
          },
          ...(notificationImage
            ? { richContent: { image: notificationImage } }
            : {}),
        },
      }),
    );
  }

  const successfulJobIds = new Set<number>();
  const failedJobIds = new Set<number>();
  const invalidTokens = new Set<string>();
  for (const batch of chunks(envelopes, 100)) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batch.map((item) => item.message)),
      });
      if (!response.ok) {
        batch.forEach((item) => failedJobIds.add(item.jobId));
        continue;
      }
      const payload = await response.json().catch(() => null) as {
        data?: Array<{
          status?: string;
          details?: { error?: string };
        }>;
      } | null;
      const tickets = Array.isArray(payload?.data) ? payload.data : [];
      if (tickets.length !== batch.length) {
        batch.forEach((item) => failedJobIds.add(item.jobId));
        continue;
      }
      tickets.forEach((ticket, index) => {
        const envelope = batch[index];
        if (ticket?.status === 'ok') {
          successfulJobIds.add(envelope.jobId);
          return;
        }
        if (ticket?.details?.error === 'DeviceNotRegistered')
          invalidTokens.add(envelope.token);
        failedJobIds.add(envelope.jobId);
      });
    } catch {
      batch.forEach((item) => failedJobIds.add(item.jobId));
    }
  }

  if (invalidTokens.size)
    await supabase
      .from('push_devices')
      .update({ enabled: false, last_seen_at: new Date().toISOString() })
      .in('push_token', [...invalidTokens]);

  const deliveredIds = jobs
    .map((job) => job.id)
    .filter((id) => successfulJobIds.has(id));
  const undeliveredJobIds = [...failedJobIds].filter(
    (id) => !successfulJobIds.has(id),
  );
  const terminalFailureIds = jobs
    .filter((job) => undeliveredJobIds.includes(job.id) && job.attempt_count >= 5)
    .map((job) => job.id);
  const retryIds = undeliveredJobIds.filter(
    (id) => !terminalFailureIds.includes(id),
  );
  const now = new Date().toISOString();

  if (deliveredIds.length)
    await supabase
      .from('push_outbox')
      .update({ sent_at: now, processing_started_at: null, failure_reason: null })
      .in('id', deliveredIds);
  if (noDeviceIds.length)
    await supabase
      .from('push_outbox')
      .update({ failed_at: now, processing_started_at: null, failure_reason: 'NO_ACTIVE_DEVICE' })
      .in('id', noDeviceIds);
  if (terminalFailureIds.length)
    await supabase
      .from('push_outbox')
      .update({ failed_at: now, processing_started_at: null, failure_reason: 'EXPO_RETRY_EXHAUSTED' })
      .in('id', terminalFailureIds);
  if (retryIds.length)
    await supabase
      .from('push_outbox')
      .update({ processing_started_at: null, failure_reason: 'EXPO_RETRY_PENDING' })
      .in('id', retryIds);

  return Response.json({
    processed: jobs.length,
    delivered: deliveredIds.length,
    retrying: retryIds.length,
    failed: noDeviceIds.length + terminalFailureIds.length,
  });
});
