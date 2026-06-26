function env(name: string) {
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

const supabaseUrl = env('SUPABASE_URL');
const supabaseAnonKey = env('SUPABASE_ANON_KEY');

Deno.serve((request) => {
  const currentUrl = new URL(request.url);
  const verified = currentUrl.searchParams.get('verified') ?? '';

  return html(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>뮤트 운영정책</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px 16px 48px;
        font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
        color: #1c1c1c;
        background: #f6f8f7;
      }
      main { max-width: 560px; margin: 0 auto; }
      .card {
        margin-top: 14px;
        padding: 20px;
        border-radius: 20px;
        background: #fff;
        border: 1px solid #e6ece9;
      }
      h1 { margin: 0 0 8px; font-size: 22px; font-weight: 700; }
      h2 { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
      p, li { color: #6f7774; font-size: 14px; line-height: 1.65; }
      ul { padding-left: 18px; margin: 0; }
      label { display: block; margin: 14px 0 6px; color: #6f7774; font-size: 13px; }
      input {
        width: 100%;
        height: 48px;
        padding: 0 14px;
        border: 1px solid #e1e7e4;
        border-radius: 14px;
        color: #1c1c1c;
        background: #fff;
        font-size: 15px;
      }
      button {
        width: 100%;
        height: 48px;
        margin-top: 16px;
        border: 0;
        border-radius: 16px;
        color: #fff;
        background: linear-gradient(90deg, #83b9d8, #63c88d);
        font-size: 15px;
        font-weight: 600;
      }
      button:disabled { opacity: .55; }
      .status {
        display: inline-flex;
        margin: 4px 0 10px;
        padding: 7px 10px;
        border-radius: 999px;
        color: #3aa574;
        background: #edf8f2;
        font-size: 13px;
        font-weight: 600;
      }
      .error { margin-top: 10px; color: #d95073; font-size: 13px; }
      .hidden { display: none; }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>뮤트 운영정책</h1>
        <p>성인인증할 계정의 로그인 정보를 입력해주세요.</p>
      </section>

      <section id="loginCard" class="card">
        <h2>로그인</h2>
        <label for="phone">전화번호</label>
        <input id="phone" inputmode="tel" autocomplete="tel" placeholder="01012345678" />
        <label for="password">비밀번호</label>
        <input id="password" type="password" autocomplete="current-password" placeholder="비밀번호" />
        <button id="loginButton">로그인</button>
        <div id="loginError" class="error hidden"></div>
      </section>

      <section id="adultCard" class="card hidden">
        <h2>성인 카테고리 접근</h2>
        <div id="adultStatus" class="status">확인 중</div>
        <p id="adultDescription"></p>
        <button id="adultButton">성인인증</button>
        <div id="adultError" class="error hidden"></div>
      </section>

      <section class="card">
        <h2>운영 규칙</h2>
        <ul>
          <li>성인 카테고리는 신고, 차단, 금칙어 필터링 및 운영자 검토 기반으로 운영됩니다.</li>
          <li>불법 촬영물, 아동·청소년 대상 성착취물, 개인정보 노출 콘텐츠는 즉시 제한 대상이며, 관련 법령에 따라 처벌될 수 있습니다.</li>
          <li>성인 카테고리 접근은 성인인증 완료 계정에 한해서만 허용됩니다.</li>
        </ul>
      </section>
    </main>

    <script>
      const supabaseClient = window.supabase.createClient(${JSON.stringify(supabaseUrl)}, ${JSON.stringify(supabaseAnonKey)}, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      const verifiedParam = ${JSON.stringify(verified)};
      const loginCard = document.getElementById('loginCard');
      const adultCard = document.getElementById('adultCard');
      const loginButton = document.getElementById('loginButton');
      const adultButton = document.getElementById('adultButton');
      const loginError = document.getElementById('loginError');
      const adultError = document.getElementById('adultError');
      const adultStatus = document.getElementById('adultStatus');
      const adultDescription = document.getElementById('adultDescription');

      function normalizePhone(value) {
        const digits = String(value || '').replace(/\\D/g, '');
        if (digits.startsWith('82')) return '+' + digits;
        if (digits.startsWith('0')) return '+82' + digits.slice(1);
        return '+82' + digits;
      }
      function showError(el, message) {
        el.textContent = message;
        el.classList.remove('hidden');
      }
      function clearError(el) {
        el.textContent = '';
        el.classList.add('hidden');
      }
      async function refreshStatus() {
        clearError(adultError);
        const { data, error } = await supabaseClient.rpc('get_my_verification_status');
        if (error) {
          showError(adultError, error.message || '인증 상태를 불러오지 못했습니다.');
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        const isVerified = Boolean(row && row.adult_verified);
        adultStatus.textContent = isVerified ? '성인인증 됨' : '성인인증 필요';
        adultDescription.textContent = isVerified
          ? '이 계정은 성인 카테고리 접근 조건을 충족했습니다.'
          : '성인 카테고리 접근을 위해 성인인증이 필요합니다.';
        adultButton.classList.toggle('hidden', isVerified);
        if (verifiedParam === '1') {
          adultDescription.textContent = '성인인증이 완료되었습니다.';
        }
      }
      async function enterLoggedIn() {
        loginCard.classList.add('hidden');
        adultCard.classList.remove('hidden');
        await refreshStatus();
      }
      loginButton.addEventListener('click', async () => {
        clearError(loginError);
        loginButton.disabled = true;
        try {
          const phone = normalizePhone(document.getElementById('phone').value);
          const password = document.getElementById('password').value;
          const { error } = await supabaseClient.auth.signInWithPassword({ phone, password });
          if (error) throw error;
          await enterLoggedIn();
        } catch (error) {
          showError(loginError, error && error.message ? error.message : '로그인에 실패했습니다.');
        } finally {
          loginButton.disabled = false;
        }
      });
      adultButton.addEventListener('click', async () => {
        clearError(adultError);
        adultButton.disabled = true;
        try {
          const { data, error } = await supabaseClient.functions.invoke('start-adult-verification', {
            body: { returnUrl: location.origin + location.pathname }
          });
          if (error) throw error;
          if (!data || !data.url) throw new Error('성인인증 제공사가 아직 설정되지 않았습니다.');
          location.href = data.url;
        } catch (error) {
          showError(adultError, error && error.message ? error.message : '성인인증을 시작하지 못했습니다.');
          adultButton.disabled = false;
        }
      });
      if (verifiedParam === '1') {
        supabaseClient.auth.getSession().then(({ data }) => {
          if (data && data.session) enterLoggedIn();
        });
      }
    </script>
  </body>
</html>`);
});
