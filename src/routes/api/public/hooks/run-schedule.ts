import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/** Daily cron (pg_cron → here): materialise today's subscription visits. Requires LOVABLE_CRON_SECRET. */
export const Route = createFileRoute("/api/public/hooks/run-schedule")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"] ?? "";
        const got = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
        if (got.length < 32) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // pg_cron signs with a vault-held key (never the public project key); manual calls may use LOVABLE_CRON_SECRET.
        const envOk =
          !!secret &&
          got.length === secret.length &&
          timingSafeEqual(Buffer.from(got), Buffer.from(secret));
        const ok =
          envOk ||
          (await supabaseAdmin.rpc("check_cron_token" as never, { p_token: got } as never)).data ===
            true;
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const { materialiseDay, istToday } = await import("@/lib/schedule.server");
        const r = await materialiseDay(supabaseAdmin, istToday());
        return Response.json(r);
      },
    },
  },
});
