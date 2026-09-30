import { sendTemplateEmail } from "@/lib/email-templates/send-email";

export type RevealEmail = {
  to: string;
  bookingId: string;
  name: string;
  vehicle: string;
  plan: string;
  date: string;
  time: string;
  location: string;
  total: number;
  videoUrl: string;
  previewUrl: string;
};

export async function sendRevealEmail(e: RevealEmail): Promise<string> {
  const r = await sendTemplateEmail("reveal-video", e.to, {
    templateData: {
      name: e.name,
      vehicle: e.vehicle,
      plan: e.plan,
      date: e.date,
      time: e.time,
      location: e.location,
      videoUrl: e.videoUrl,
      previewUrl: e.previewUrl,
    },
    idempotencyKey: `reveal-video-${e.bookingId}`,
  });
  return r.sent ? "sent" : "suppressed";
}
