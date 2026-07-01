import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type ReportStatus = "received" | "triaged" | "actioned" | "dismissed";
type TargetType = "room" | "user" | "message" | "story" | "comment";

type ReportRow = {
  id: string;
  reporter_user_id: string;
  target_type: TargetType;
  target_id: string;
  reason: string | null;
  detail: string | null;
  evidence: Record<string, unknown> | null;
  status: ReportStatus;
  priority: number | null;
  created_at: string;
  resolved_at: string | null;
  email_sent_at?: string | null;
  email_failure_reason?: string | null;
};

function html(body: string) {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": "inline",
    },
  });
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function getServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getBearer(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
}

async function assertAdmin(request: Request) {
  const token = getBearer(request);
  if (!token) return null;
  const service = getServiceClient();
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data, error } = await service
    .schema("auth")
    .from("users")
    .select("id,email,phone,is_super_admin")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error || !data?.is_super_admin) return null;
  return { service, user: data };
}

function mapById<T extends Record<string, unknown>>(rows: T[] | null | undefined) {
  const map = new Map<string, T>();
  for (const row of rows ?? []) {
    if (typeof row.id === "string") map.set(row.id, row);
  }
  return map;
}

async function loadTargetMetadata(
  service: ReturnType<typeof createClient>,
  reports: ReportRow[],
) {
  const roomIds = reports
    .filter((report) => report.target_type === "room")
    .map((report) => report.target_id);
  const userIds = [
    ...reports
      .filter((report) => report.target_type === "user")
      .map((report) => report.target_id),
    ...reports.map((report) => report.reporter_user_id),
  ];
  const messageIds = reports
    .filter((report) => report.target_type === "message")
    .map((report) => report.target_id);
  const storyIds = reports
    .filter((report) => report.target_type === "story")
    .map((report) => report.target_id);
  const commentIds = reports
    .filter((report) => report.target_type === "comment")
    .map((report) => report.target_id);

  const [
    rooms,
    users,
    messages,
    stories,
    comments,
  ] = await Promise.all([
    roomIds.length
      ? service
          .from("rooms")
          .select("id,name,category,visibility,owner_user_id,deleted_at,created_at")
          .in("id", roomIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? service
          .schema("auth")
          .from("users")
          .select("id,email,phone,created_at,is_super_admin")
          .in("id", [...new Set(userIds)])
      : Promise.resolve({ data: [] }),
    messageIds.length
      ? service
          .from("messages")
          .select("id,room_id,sender_user_id,sender_name_snapshot,kind,body,created_at,deleted_at")
          .in("id", messageIds)
      : Promise.resolve({ data: [] }),
    storyIds.length
      ? service
          .from("stories")
          .select("id,room_id,author_user_id,title,visibility,created_at,deleted_at")
          .in("id", storyIds)
      : Promise.resolve({ data: [] }),
    commentIds.length
      ? service
          .from("story_comments")
          .select("id,story_id,author_user_id,body,created_at,deleted_at")
          .in("id", commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const roomMap = mapById(rooms.data as Record<string, unknown>[]);
  const userMap = mapById(users.data as Record<string, unknown>[]);
  const messageMap = mapById(messages.data as Record<string, unknown>[]);
  const storyMap = mapById(stories.data as Record<string, unknown>[]);
  const commentMap = mapById(comments.data as Record<string, unknown>[]);

  return reports.map((report) => {
    const target =
      report.target_type === "room"
        ? roomMap.get(report.target_id)
        : report.target_type === "user"
          ? userMap.get(report.target_id)
          : report.target_type === "message"
            ? messageMap.get(report.target_id)
            : report.target_type === "story"
              ? storyMap.get(report.target_id)
              : commentMap.get(report.target_id);
    return {
      ...report,
      reporter: userMap.get(report.reporter_user_id) ?? null,
      target: target ?? null,
    };
  });
}

async function listReports(request: Request) {
  const admin = await assertAdmin(request);
  if (!admin) return json({ error: "ADMIN_ONLY" }, 403);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "open";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 80), 200);
  let query = admin.service
    .from("reports")
    .select(
      "id,reporter_user_id,target_type,target_id,reason,detail,evidence,status,priority,created_at,resolved_at,email_sent_at,email_failure_reason",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "open") query = query.in("status", ["received", "triaged"]);
  else if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);
  const reports = await loadTargetMetadata(admin.service, (data ?? []) as ReportRow[]);
  return json({ reports, admin: admin.user });
}

async function updateReport(request: Request) {
  const admin = await assertAdmin(request);
  if (!admin) return json({ error: "ADMIN_ONLY" }, 403);

  const body = await request.json().catch(() => null) as {
    id?: string;
    status?: ReportStatus;
  } | null;
  if (!body?.id || !body.status) return json({ error: "INVALID_REQUEST" }, 400);
  if (!["received", "triaged", "actioned", "dismissed"].includes(body.status)) {
    return json({ error: "INVALID_STATUS" }, 400);
  }

  const { error } = await admin.service
    .from("reports")
    .update({
      status: body.status,
      resolved_at: ["actioned", "dismissed"].includes(body.status)
        ? new Date().toISOString()
        : null,
    })
    .eq("id", body.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

function page() {
  const config = JSON.stringify({ supabaseUrl, anonKey });
  return html(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Mute 신고 관리</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <style>
    :root { color-scheme: light; --text:#1c1c1c; --muted:#777; --line:#ececec; --bg:#f7f7f7; --card:#fff; --accent:#3f9a70; --danger:#df5a73; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--text); }
    header { position:sticky; top:0; z-index:5; padding:18px 18px 14px; background:rgba(255,255,255,.92); border-bottom:1px solid var(--line); backdrop-filter:blur(14px); }
    h1 { margin:0; font-size:21px; }
    main { padding:14px; max-width:860px; margin:0 auto; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:22px; padding:16px; margin-bottom:12px; }
    .login input { width:100%; height:48px; border:1px solid #ddd; border-radius:14px; padding:0 14px; margin:8px 0; font-size:16px; }
    button { border:0; border-radius:14px; min-height:42px; padding:0 14px; font-weight:700; background:#eee; color:var(--text); }
    button.primary { background:linear-gradient(90deg,#82b9c1,#5dbb8c); color:#fff; }
    button.danger { color:#fff; background:var(--danger); }
    .tabs { display:flex; gap:8px; overflow:auto; padding:4px 0 12px; }
    .tabs button.active { color:#fff; background:var(--accent); }
    .row { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .badge { display:inline-flex; align-items:center; border-radius:999px; padding:4px 9px; background:#f1f1f1; color:#555; font-size:12px; margin:2px 3px 2px 0; }
    .badge.hot { color:#fff; background:var(--danger); }
    .muted { color:var(--muted); font-size:13px; line-height:1.45; }
    .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; overflow-wrap:anywhere; }
    .target { margin-top:10px; padding:12px; border-radius:16px; background:#fafafa; border:1px solid var(--line); }
    .actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
    .empty { padding:40px 12px; text-align:center; color:var(--muted); }
    pre { white-space:pre-wrap; word-break:break-word; margin:8px 0 0; color:#555; font-size:12px; }
  </style>
</head>
<body>
  <header><h1>Mute 신고 관리</h1><div id="session" class="muted">로그인이 필요합니다.</div></header>
  <main>
    <section id="login" class="card login">
      <b>운영자 로그인</b>
      <input id="email" placeholder="관리자 이메일 또는 전화번호" autocomplete="username" />
      <input id="password" placeholder="비밀번호" type="password" autocomplete="current-password" />
      <button class="primary" id="loginButton">로그인</button>
      <p class="muted">슈퍼관리자 계정만 신고 목록을 조회할 수 있습니다.</p>
    </section>
    <section id="app" hidden>
      <div class="tabs">
        <button data-status="open" class="active">미처리</button>
        <button data-status="received">접수</button>
        <button data-status="triaged">검토중</button>
        <button data-status="actioned">조치</button>
        <button data-status="dismissed">기각</button>
        <button data-status="all">전체</button>
      </div>
      <div id="list" class="empty">불러오는 중...</div>
    </section>
  </main>
<script>
const CONFIG = ${config};
const client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.anonKey);
const api = CONFIG.supabaseUrl + "/functions/v1/admin-reports";
let currentStatus = "open";
const $ = (id) => document.getElementById(id);
function text(value) { return value == null || value === "" ? "-" : String(value); }
function shortId(value) { value = text(value); return value.length > 10 ? value.slice(0, 8) + "..." : value; }
function formatDate(value) { return value ? new Date(value).toLocaleString("ko-KR") : "-"; }
function targetTitle(report) {
  const target = report.target || {};
  if (report.target_type === "room") return target.name || "방";
  if (report.target_type === "message") return target.body || target.kind || "메시지";
  if (report.target_type === "story") return target.title || "스토리";
  if (report.target_type === "comment") return target.body || "댓글";
  return target.email || target.phone || "사용자";
}
async function token() {
  const { data } = await client.auth.getSession();
  return data.session?.access_token;
}
async function request(path, options = {}) {
  const accessToken = await token();
  if (!accessToken) throw new Error("로그인이 필요합니다.");
  const response = await fetch(api + path, {
    ...options,
    headers: { "content-type": "application/json", authorization: "Bearer " + accessToken, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || "요청 실패");
  return payload;
}
function render(reports) {
  if (!reports.length) {
    $("list").className = "empty";
    $("list").textContent = "표시할 신고가 없습니다.";
    return;
  }
  $("list").className = "";
  $("list").innerHTML = reports.map((report) => {
    const reporter = report.reporter || {};
    const target = report.target || {};
    return '<article class="card">' +
      '<div class="row"><div><b>' + targetTitle(report) + '</b><div class="muted">' + formatDate(report.created_at) + '</div></div>' +
      '<div><span class="badge ' + (Number(report.priority || 0) >= 5 ? 'hot' : '') + '">' + text(report.status) + '</span></div></div>' +
      '<div style="margin-top:8px"><span class="badge">' + text(report.target_type) + '</span><span class="badge">우선순위 ' + text(report.priority) + '</span></div>' +
      '<p><b>사유</b><br />' + text(report.reason) + '</p>' +
      '<p><b>상세</b><br />' + text(report.detail) + '</p>' +
      '<div class="target"><b>신고자</b><div class="muted mono">' + text(report.reporter_user_id) + '</div><div class="muted">' + text(reporter.email || reporter.phone) + '</div></div>' +
      '<div class="target"><b>대상</b><div class="muted mono">' + text(report.target_id) + '</div><pre>' + text(JSON.stringify(target, null, 2)) + '</pre></div>' +
      '<div class="target"><b>증거/기기 정보</b><pre>' + text(JSON.stringify(report.evidence || {}, null, 2)) + '</pre></div>' +
      '<div class="muted">메일 발송: ' + formatDate(report.email_sent_at) + (report.email_failure_reason ? ' / 실패: ' + report.email_failure_reason : '') + '</div>' +
      '<div class="actions">' +
      '<button onclick="setStatus(\\'' + report.id + '\\',\\'triaged\\')">검토중</button>' +
      '<button class="primary" onclick="setStatus(\\'' + report.id + '\\',\\'actioned\\')">조치 완료</button>' +
      '<button onclick="setStatus(\\'' + report.id + '\\',\\'dismissed\\')">기각</button>' +
      '</div></article>';
  }).join("");
}
async function load() {
  $("list").className = "empty";
  $("list").textContent = "불러오는 중...";
  try {
    const payload = await request("/api/reports?status=" + currentStatus);
    render(payload.reports || []);
  } catch (error) {
    $("list").textContent = error.message || "불러오기 실패";
  }
}
async function setStatus(id, status) {
  if (!confirm("상태를 변경하시겠습니까?")) return;
  await request("/api/reports/status", { method:"POST", body: JSON.stringify({ id, status }) });
  await load();
}
window.setStatus = setStatus;
document.querySelectorAll("[data-status]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-status]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentStatus = button.dataset.status;
    load();
  });
});
$("loginButton").addEventListener("click", async () => {
  $("loginButton").disabled = true;
  try {
    const id = $("email").value.trim();
    const password = $("password").value;
    const email = id.includes("@") ? id : id + "@admin.mute.local";
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    $("login").hidden = true;
    $("app").hidden = false;
    $("session").textContent = id + " 로그인됨";
    await load();
  } catch (error) {
    alert(error.message || "로그인 실패");
  } finally {
    $("loginButton").disabled = false;
  }
});
client.auth.getSession().then(({ data }) => {
  if (data.session) {
    $("login").hidden = true;
    $("app").hidden = false;
    $("session").textContent = "로그인됨";
    load();
  }
});
</script>
</body>
</html>`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(request.url);
  if (url.pathname.endsWith("/api/reports")) return listReports(request);
  if (url.pathname.endsWith("/api/reports/status")) return updateReport(request);
  return page();
});
