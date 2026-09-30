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

// Email sending activates once the sender domain is set up.
export async function sendRevealEmail(_e: RevealEmail): Promise<string> {
  return "pending_domain";
}
