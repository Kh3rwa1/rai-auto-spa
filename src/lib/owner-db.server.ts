import { DEMO_MODE } from "./demo-mode";

/**
 * The single gate every owner read/write passes through.
 * DEMO_MODE: open to guests. Otherwise: requires a signed-in admin (user_roles.role = 'admin').
 * Server-only — always reach it with `await import("@/lib/owner-db.server")` inside a handler.
 */
export async function ownerDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (DEMO_MODE) return supabaseAdmin;

  const { getRequest } = await import("@tanstack/react-start/server");
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer /, "");
  const { data: u } = await supabaseAdmin.auth.getUser(token);
  const uid = u.user?.id;
  const { data: role } = uid
    ? await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle()
    : { data: null };
  if (!role) throw new Error("Owner access only.");
  return supabaseAdmin;
}
