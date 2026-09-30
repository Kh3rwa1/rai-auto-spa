import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/** Daily cron (pg_cron → here): materialise today's subscription visits. Requires the cron secret. */
export const Route = createFileRoute("/api/public/hooks/run-schedule")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"] ?? "";
        const got = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
        const ok = !!secret && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { materialiseDay, istToday } = await import("@/lib/schedule.server");
        const r = await materialiseDay(supabaseAdmin, istToday());
        return Response.json(r);
      },
    },
  },
});
