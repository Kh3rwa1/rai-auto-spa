import { CalendarDays, Hourglass, Images, Inbox, MapPinned, Palette, Repeat } from "lucide-react";

export const TABS = [
  { value: "route", label: "Route", icon: MapPinned },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "subs", label: "Subscriptions", icon: Repeat },
  { value: "waitlist", label: "Waitlist", icon: Hourglass },
  { value: "leads", label: "Leads", icon: Inbox },
  { value: "wraps", label: "Wrap Approvals", icon: Palette },
  { value: "gallery", label: "Gallery", icon: Images },
] as const;

export type TabValue = (typeof TABS)[number]["value"];
