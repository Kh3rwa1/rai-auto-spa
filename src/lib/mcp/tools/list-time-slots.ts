import { defineTool } from "@lovable.dev/mcp-js";
import { SLOTS, isPrime, isDryWindow } from "../../plans";

export default defineTool({
  name: "list_time_slots",
  title: "List daily time slots",
  description:
    "List the daily booking time slots (IST) and which are prime-time or dry-window slots.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const info = {
      timezone: "Asia/Kolkata",
      slots: SLOTS.map((time) => ({ time, prime: isPrime(time), dryWindow: isDryWindow(time) })),
      bookingUrl: "https://rai-auto-spa.lovable.app/#book",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});
