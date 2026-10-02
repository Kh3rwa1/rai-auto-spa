import {
  BellRing,
  CalendarDays,
  Hourglass,
  Images,
  Inbox,
  MapPinned,
  Palette,
  PhoneCall,
  Repeat,
} from "lucide-react";

export const TABS = [
  { value: "route", label: "Route", icon: MapPinned },
  { value: "reminders", label: "Reminders", icon: BellRing },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "calls", label: "Calls", icon: PhoneCall },
  { value: "subs", label: "Subscriptions", icon: Repeat },
  { value: "waitlist", label: "Waitlist", icon: Hourglass },
  { value: "leads", label: "Leads", icon: Inbox },
  { value: "wraps", label: "Wrap Approvals", icon: Palette },
  { value: "gallery", label: "Gallery", icon: Images },
] as const;

export type TabValue = (typeof TABS)[number]["value"];
