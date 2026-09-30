import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Renders the exact customer emails for one booking (token-gated) so the in-app preview matches what was sent. */
export const previewEmails = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ bookingId: z.string().uuid(), token: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: b } = await sb
      .from("bookings")
      .select("*, clients(name, email)")
      .eq("id", data.bookingId)
      .eq("manage_token", data.token)
      .maybeSingle();
    if (!b) throw new Error("Booking not found");
    const [{ createElement }, { render }, { TEMPLATES }, { depositOf }, { BRAND }] =
      await Promise.all([
        import("react"),
        import("@react-email/components"),
        import("./email-templates/registry"),
        import("./plans"),
        import("./brand"),
      ]);
    const client = b.clients as { name: string; email: string | null } | null;
    const video = b.video_url
      ? (await sb.storage.from("car-media").createSignedUrl(b.video_url, 3600)).data?.signedUrl
      : null;
    const props = {
      name: client?.name,
      vehicle: b.vehicle_model ?? "car",
      plan: b.plan,
      date: b.date ?? "",
      time: b.time ?? "",
      location:
        b.location_type === "mobile"
          ? `${b.area ?? "Your place"} (Rai's van comes to you)`
          : "Studio, MG Marg, Gangtok",
      total: b.total,
      deposit: depositOf(b.total),
      videoUrl: video ?? "https://rai-auto-spa.lovable.app",
    };
    const out = async (name: string) => {
      const t = TEMPLATES[name]!;
      const html = await render(createElement(t.component, props));
      return { subject: typeof t.subject === "function" ? t.subject(props) : t.subject, html };
    };
    return {
      from: `${BRAND.siteName} <noreply@${BRAND.fromDomain}>`,
      to: client?.email ?? null,
      emailStatus: b.email_status,
      videoReady: !!video,
      confirmation: await out("booking-confirmation"),
      reveal: await out("reveal-video"),
    };
  });
