const DEFAULT_PORTAL_URL = "https://operations-policy.vercel.app/";

function env(name: string) {
  return Deno.env.get(name)?.trim() ?? "";
}

Deno.serve((request) => {
  const sourceUrl = new URL(request.url);
  const portalUrl = new URL(env("OPERATIONS_POLICY_PORTAL_URL") || DEFAULT_PORTAL_URL);

  sourceUrl.searchParams.forEach((value, key) => {
    portalUrl.searchParams.set(key, value);
  });

  return Response.redirect(portalUrl.toString(), 302);
});
