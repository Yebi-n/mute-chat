import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (request) => {
  if (request.headers.get('authorization') !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const { data: jobs, error: jobsError } = await supabase
    .from('push_outbox')
    .select('id,recipient_user_id,title,body,data')
    .is('sent_at', null)
    .is('failed_at', null)
    .order('created_at')
    .limit(100);

  if (jobsError) return new Response(jobsError.message, { status: 500 });
  if (!jobs?.length) return Response.json({ processed: 0 });

  const userIds = [...new Set(jobs.map((job) => job.recipient_user_id))];
  const { data: devices, error: devicesError } = await supabase
    .from('push_devices')
    .select('user_id,push_token')
    .in('user_id', userIds)
    .eq('enabled', true);
  if (devicesError) return new Response(devicesError.message, { status: 500 });

  const tokensByUser = new Map<string, string[]>();
  for (const device of devices ?? []) {
    const tokens = tokensByUser.get(device.user_id) ?? [];
    tokens.push(device.push_token);
    tokensByUser.set(device.user_id, tokens);
  }

  for (const job of jobs) {
    const tokens = tokensByUser.get(job.recipient_user_id) ?? [];
    if (!tokens.length) {
      await supabase.from('push_outbox').update({
        failed_at: new Date().toISOString(),
        failure_reason: 'NO_ACTIVE_DEVICE',
      }).eq('id', job.id);
      continue;
    }

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title: job.title,
      body: job.body,
      data: job.data,
    }));
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(messages),
    });
    await supabase.from('push_outbox').update(response.ok ? {
      sent_at: new Date().toISOString(),
      failure_reason: null,
    } : {
      failed_at: new Date().toISOString(),
      failure_reason: `EXPO_${response.status}`,
    }).eq('id', job.id);
  }

  return Response.json({ processed: jobs.length });
});
