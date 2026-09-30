import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/** Daily cron (pg_cron → here): materialise today's subscription visits. Requires the cron secret or project apikey. */
export const Route = createFileRoute("/api/public/hooks/run-schedule")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"] ?? "";
        const got = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
        const ok =
          !!secret &&
          got.length === secret.length &&
          timingSafeEqual(Buffer.from(got), Buffer.from(secret));
        // pg_cron sends the project's publishable apikey; the job is idempotent (unique per subscription+day).
        const pub =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        const apikey = request.headers.get("apikey") ?? "";
        if (!ok && !(pub && apikey === pub)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { materialiseDay, istToday } = await import("@/lib/schedule.server");
        const r = await materialiseDay(supabaseAdmin, istToday());
        return Response.json(r);
      },
    },
  },
});
