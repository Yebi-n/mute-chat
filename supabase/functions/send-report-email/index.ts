import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer '))
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const reportTo = Deno.env.get('REPORT_EMAIL_TO') ?? 'muteappcontact@gmail.com';
  const reportFrom = Deno.env.get('REPORT_EMAIL_FROM') ?? 'Mute Reports <onboarding@resend.dev>';
  const service = createClient(supabaseUrl, serviceRoleKey);
  const jwt = authorization.slice('Bearer '.length);
  const { data: authData, error: authError } = await service.auth.getUser(jwt);
  if (authError || !authData.user)
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: corsHeaders });

  const { reportId } = await request.json().catch(() => ({ reportId: null }));
  if (typeof reportId !== 'string')
    return Response.json({ error: 'INVALID_REPORT_ID' }, { status: 400, headers: corsHeaders });

  const { data: report, error: reportError } = await service
    .from('reports')
    .select('id,reporter_user_id,target_type,target_id,reason,detail,priority,created_at,email_sent_at')
    .eq('id', reportId)
    .maybeSingle();
  if (reportError || !report)
    return Response.json({ error: 'REPORT_NOT_FOUND' }, { status: 404, headers: corsHeaders });
  if (report.reporter_user_id !== authData.user.id)
    return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: corsHeaders });
  if (report.email_sent_at) return Response.json({ sent: true, duplicate: true }, { headers: corsHeaders });
  if (!resendKey) {
    await service.from('reports').update({ email_failure_reason: 'RESEND_API_KEY_MISSING' }).eq('id', report.id);
    return Response.json({ error: 'EMAIL_NOT_CONFIGURED' }, { status: 503, headers: corsHeaders });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: reportFrom,
      to: [reportTo],
      subject: `[Mute 신고] ${report.target_type} / ${report.reason}`,
      text: [
        `신고 ID: ${report.id}`,
        `신고자 ID: ${report.reporter_user_id}`,
        `대상: ${report.target_type} / ${report.target_id}`,
        `사유: ${report.reason}`,
        `우선순위: ${report.priority}`,
        `접수 시각: ${report.created_at}`,
        `상세: ${report.detail || '(없음)'}`,
      ].join('\n'),
    }),
  });
  if (!response.ok) {
    const failure = `RESEND_${response.status}:${(await response.text()).slice(0, 300)}`;
    await service.from('reports').update({ email_failure_reason: failure }).eq('id', report.id);
    return Response.json({ error: 'EMAIL_SEND_FAILED' }, { status: 502, headers: corsHeaders });
  }
  await service
    .from('reports')
    .update({ email_sent_at: new Date().toISOString(), email_failure_reason: null })
    .eq('id', report.id);
  return Response.json({ sent: true }, { headers: corsHeaders });
});
