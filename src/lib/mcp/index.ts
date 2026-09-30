import { defineMcp } from "@lovable.dev/mcp-js";
import listPlans from "./tools/list-plans";
import listTimeSlots from "./tools/list-time-slots";

export default defineMcp({
  name: "rai-s-auto-studio",
  title: "Rai's Auto Studio",
  version: "0.1.0",
  instructions:
    "Public info for Rai's Auto Spa, a car wash and design studio on MG Marg, Gangtok. Use `list_plans` for services and prices, `list_time_slots` for daily booking times. Customers book at the site's booking link.",
  tools: [listPlans, listTimeSlots],
});
