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
  const headers = new Headers(corsHeaders);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  return new Response(body, {
    status: 200,
    headers,
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
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
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

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function listReports(request: Request) {
  const admin = await assertAdmin(request);
  if (!admin) return json({ error: "ADMIN_ONLY" }, 403);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "open";
  let query = admin.service
    .from("reports")
    .select("id,reporter_user_id,target_type,target_id,reason,detail,evidence,status,priority,created_at,resolved_at,email_sent_at,email_failure_reason")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status === "open") {
    query = query.in("status", ["received", "triaged"]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: reports, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const rows = (reports ?? []) as ReportRow[];
  const reporterIds = unique(rows.map((row) => row.reporter_user_id));
  const userTargetIds = unique(rows.filter((row) => row.target_type === "user").map((row) => row.target_id));
  const roomIds = unique(rows.filter((row) => row.target_type === "room").map((row) => row.target_id));
  const messageIds = unique(rows.filter((row) => row.target_type === "message").map((row) => row.target_id));
  const storyIds = unique(rows.filter((row) => row.target_type === "story").map((row) => row.target_id));
  const commentIds = unique(rows.filter((row) => row.target_type === "comment").map((row) => row.target_id));

  const usersPromise = unique([...reporterIds, ...userTargetIds]).length
    ? admin.service
        .schema("auth")
        .from("users")
        .select("id,email,phone,created_at,is_super_admin")
        .in("id", unique([...reporterIds, ...userTargetIds]))
    : Promise.resolve({ data: [] });
  const roomsPromise = roomIds.length
    ? admin.service.from("rooms").select("id,name,owner_user_id,category,is_adult,is_private,deleted_at,created_at").in("id", roomIds)
    : Promise.resolve({ data: [] });
  const messagesPromise = messageIds.length
    ? admin.service.from("messages").select("id,room_id,user_id,body,kind,created_at,deleted_at").in("id", messageIds)
    : Promise.resolve({ data: [] });
  const storiesPromise = storyIds.length
    ? admin.service.from("stories").select("id,room_id,user_id,title,visibility,created_at,deleted_at").in("id", storyIds)
    : Promise.resolve({ data: [] });
  const commentsPromise = commentIds.length
    ? admin.service.from("story_comments").select("id,story_id,user_id,body,created_at,deleted_at").in("id", commentIds)
    : Promise.resolve({ data: [] });

  const [usersResult, roomsResult, messagesResult, storiesResult, commentsResult] = await Promise.all([
    usersPromise,
    roomsPromise,
    messagesPromise,
    storiesPromise,
    commentsPromise,
  ]);

  const users = mapById(usersResult.data as Record<string, unknown>[]);
  const rooms = mapById(roomsResult.data as Record<string, unknown>[]);
  const messages = mapById(messagesResult.data as Record<string, unknown>[]);
  const stories = mapById(storiesResult.data as Record<string, unknown>[]);
  const comments = mapById(commentsResult.data as Record<string, unknown>[]);

  const enriched = rows.map((report) => {
    const target =
      report.target_type === "room"
        ? rooms.get(report.target_id)
        : report.target_type === "user"
          ? users.get(report.target_id)
          : report.target_type === "message"
            ? messages.get(report.target_id)
            : report.target_type === "story"
              ? stories.get(report.target_id)
              : comments.get(report.target_id);
    return {
      ...report,
      reporter: users.get(report.reporter_user_id) ?? null,
      target: target ?? null,
    };
  });

  return json({ reports: enriched });
}

async function updateReport(request: Request) {
  const admin = await assertAdmin(request);
  if (!admin) return json({ error: "ADMIN_ONLY" }, 403);
  const body = await request.json().catch(() => null);
  const id = body?.id;
  const status = body?.status as ReportStatus | undefined;
  if (!id || !["received", "triaged", "actioned", "dismissed"].includes(status ?? "")) {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  const { error } = await admin.service
    .from("reports")
    .update({
      status,
      resolved_at: status === "actioned" || status === "dismissed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

function page() {
  const headers = new Headers(corsHeaders);
  headers.set("location", "https://service-introduction-theta.vercel.app/admin-reports/");
  headers.set("cache-control", "no-store");
  return new Response(null, { status: 302, headers });
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(request.url);
  if (url.pathname.endsWith("/api/reports")) return listReports(request);
  if (url.pathname.endsWith("/api/reports/status")) return updateReport(request);
  return page();
});
