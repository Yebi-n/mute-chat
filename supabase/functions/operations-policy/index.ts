function optionalEnv(name: string) {
  return Deno.env.get(name)?.trim() ?? '';
}

function html(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-disposition': 'inline',
    },
  });
}

Deno.serve((request) => {
  const portalUrl = optionalEnv('OPERATIONS_POLICY_PORTAL_URL');
  const currentUrl = new URL(request.url);
  const verified = currentUrl.searchParams.get('verified');

  if (portalUrl) {
    const target = new URL(portalUrl);
    if (verified) target.searchParams.set('verified', verified);
    return Response.redirect(target.toString(), 302);
  }

  return html(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>뮤트 운영정책</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
        color: #1c1c1c;
        background: #f6f8f7;
      }
      .card {
        max-width: 560px;
        margin: 0 auto;
        padding: 22px 20px;
        border-radius: 22px;
        background: #fff;
        border: 1px solid #e6ece9;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 22px;
      }
      p {
        margin: 0;
        color: #6f7774;
        font-size: 14px;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>뮤트 운영정책</h1>
      <p>
        운영정책 웹 페이지 주소가 아직 서버에 설정되지 않았습니다.
        Supabase Edge Function secret에 OPERATIONS_POLICY_PORTAL_URL을 설정한 뒤 다시 열어주세요.
      </p>
    </main>
  </body>
</html>`);
});
