import { defineTool } from "@lovable.dev/mcp-js";
import { PLANS, MOBILE_FEE, WATER_FEE, STUDIO } from "../../plans";

export default defineTool({
  name: "list_plans",
  title: "List plans and prices",
  description:
    "List Rai's Auto Spa service plans with prices (INR), duration, features and add-on fees.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const plans = Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      priceInr: p.price,
      depositInr: Math.round(p.price * 0.3),
      duration: p.duration,
      badge: p.badge,
      features: [...p.features],
    }));
    const info = {
      plans,
      studio: STUDIO.name,
      mobileVanFeeInr: MOBILE_FEE,
      waterSupplyFeeInr: WATER_FEE,
      depositPercent: 30,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});
