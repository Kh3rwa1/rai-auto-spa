import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Daily job: email tomorrow's real bookings. Same auth as run-schedule.
 * Schedule it for 08:30 UTC (2:00 pm IST) so the 12-hour free-reschedule window is still open.
 * Add ?dry=1 to count what would be sent without sending anything.
 */
export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"] ?? "";
        const got = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
        if (got.length < 32) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const envOk =
          !!secret &&
          got.length === secret.length &&
          timingSafeEqual(Buffer.from(got), Buffer.from(secret));
        const ok =
          envOk ||
          (await supabaseAdmin.rpc("check_cron_token" as never, { p_token: got } as never)).data ===
            true;
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const dryRun = new URL(request.url).searchParams.get("dry") === "1";
        const { sendDueReminders } = await import("@/lib/reminders.server");
        return Response.json(await sendDueReminders(supabaseAdmin, { dryRun }));
      },
    },
  },
});
