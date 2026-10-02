import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  vehicle?: string;
  plan?: string;
  when?: string;
  time?: string;
  location?: string;
  depositPending?: boolean;
  balance?: number;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const Email = ({ name, vehicle, plan, when, time, location, depositPending, balance }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Tomorrow at ${time ?? ""} — your ${plan ?? "wash"} at Rai's Auto Spa`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brand}>
            RAI&apos;S <span style={{ color: PINK }}>✦</span> AUTO SPA
          </Text>
          <Text style={brandSub}>MG MARG · GANGTOK</Text>
        </Section>

        <Section style={hero}>
          <Text style={pill}>SEE YOU TOMORROW ✦</Text>
          <Heading style={h1}>Your car is next 🚗</Heading>
          <Text style={heroText}>
            Hi{name ? ` ${name}` : ""}, a quick reminder about your booking.
          </Text>
        </Section>

        <Section style={card}>
          <Text style={label}>PLAN</Text>
          <Text style={value}>{plan ?? "—"}</Text>
          {vehicle ? (
            <>
              <Text style={label}>VEHICLE</Text>
              <Text style={value}>{vehicle}</Text>
            </>
          ) : null}
          <Text style={label}>WHEN</Text>
          <Text style={value}>
            {when ?? "—"} at {time ?? "—"}
          </Text>
          <Text style={label}>WHERE</Text>
          <Text style={value}>{location ?? "—"}</Text>
          <Hr style={hr} />
          {depositPending ? (
            <Text style={moneyRow}>
              <span style={yellowTag}>DEPOSIT PENDING</span> Please pay your 30% deposit to keep this
              slot.
            </Text>
          ) : typeof balance === "number" ? (
            <Text style={moneyRow}>
              <span style={yellowTag}>BALANCE ON THE DAY</span> <strong>{inr(balance)}</strong>
            </Text>
          ) : null}
        </Section>

        <Section style={note}>
          <Text style={noteText}>
            <strong>Need another time?</strong> Rescheduling is free until 12 hours before your
            slot — just reply to this email or WhatsApp Rai.
          </Text>
        </Section>

        <Section style={{ margin: "22px 0 8px" }}>
          <Button href="https://maps.google.com/?q=MG+Marg+Gangtok+Sikkim" style={button}>
            Open map to the studio →
          </Button>
        </Section>

        <Section style={footerBar}>
          <Text style={footerBrand}>
            RAI&apos;S <span style={{ color: YELLOW }}>✦</span> AUTO SPA
          </Text>
          <Text style={footerText}>MG Marg, Gangtok, Sikkim 737101</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Tomorrow at ${d["time"] ?? ""} — your ${d["plan"] ?? "wash"} · Rai's Auto Spa`,
  displayName: "Booking reminder",
  previewData: {
    name: "Pema",
    vehicle: "Maruti Swift",
    plan: "Full Detail",
    when: "Friday, 3 October",
    time: "8 AM",
    location: "Studio, MG Marg, Gangtok",
    depositPending: false,
    balance: 1399,
  },
} satisfies TemplateEntry;

/* ───────── theme (matches the website) ───────── */
const INK = "#111111";
const CREAM = "#FFF8EC";
const PINK = "#FF5FA2";
const YELLOW = "#FFD84D";
const MINT = "#9EE6C4";
const DISPLAY = "'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const BODY = "Arial, 'Helvetica Neue', sans-serif";
/** Thick border + heavier right/bottom = the site's hard offset shadow, email-safe. */
const boxed = (bg: string) => ({
  backgroundColor: bg,
  border: `3px solid ${INK}`,
  borderRightWidth: "7px",
  borderBottomWidth: "7px",
  borderRadius: "18px",
});

const main = { backgroundColor: CREAM, fontFamily: BODY, margin: "0", padding: "0" };
const container = { padding: "24px 16px", maxWidth: "560px" };
const brandBar = { ...boxed(YELLOW), padding: "14px 20px", marginBottom: "16px" };
const brand = {
  color: INK,
  fontFamily: DISPLAY,
  fontSize: "20px",
  letterSpacing: "-0.5px",
  margin: "0",
};
const brandSub = {
  color: INK,
  fontSize: "10px",
  fontWeight: 700 as const,
  letterSpacing: "3px",
  margin: "2px 0 0",
};
const hero = { ...boxed(PINK), padding: "22px 20px", marginBottom: "16px" };
const pill = {
  display: "inline-block",
  backgroundColor: "#ffffff",
  border: `2px solid ${INK}`,
  borderRadius: "999px",
  color: INK,
  fontSize: "10px",
  fontWeight: 700 as const,
  letterSpacing: "2px",
  padding: "3px 10px",
  margin: "0 0 10px",
};
const h1 = {
  color: INK,
  fontFamily: DISPLAY,
  fontSize: "34px",
  lineHeight: "36px",
  textTransform: "uppercase" as const,
  letterSpacing: "-1px",
  margin: "0 0 10px",
};
const heroText = { color: INK, fontSize: "15px", lineHeight: "22px", margin: "0" };
const card = { ...boxed("#ffffff"), padding: "18px 20px", marginBottom: "16px" };
const label = {
  color: "#555555",
  fontSize: "10px",
  fontWeight: 700 as const,
  letterSpacing: "2px",
  margin: "10px 0 2px",
};
const value = { color: INK, fontSize: "16px", fontWeight: 700 as const, margin: "0" };
const hr = { borderColor: INK, borderWidth: "2px 0 0", margin: "16px 0 10px" };
const tag = {
  display: "inline-block",
  border: `2px solid ${INK}`,
  borderRadius: "999px",
  color: INK,
  fontSize: "10px",
  fontWeight: 700 as const,
  letterSpacing: "1.5px",
  padding: "2px 8px",
  marginRight: "6px",
};
const mintTag = { ...tag, backgroundColor: MINT };
const yellowTag = { ...tag, backgroundColor: YELLOW };
const moneyRow = { color: INK, fontSize: "16px", margin: "8px 0" };
const note = {
  backgroundColor: "#ffffff",
  border: `3px dashed ${INK}`,
  borderRadius: "14px",
  padding: "12px 16px",
};
const noteText = { color: INK, fontSize: "14px", lineHeight: "21px", margin: "0" };
const button = {
  backgroundColor: YELLOW,
  color: INK,
  border: `3px solid ${INK}`,
  borderRightWidth: "6px",
  borderBottomWidth: "6px",
  borderRadius: "14px",
  padding: "14px 22px",
  fontFamily: DISPLAY,
  fontSize: "14px",
  letterSpacing: "0.5px",
  textTransform: "uppercase" as const,
  textDecoration: "none",
  display: "inline-block",
};
const footerBar = {
  backgroundColor: INK,
  borderRadius: "18px",
  padding: "16px 20px",
  marginTop: "24px",
};
const footerBrand = { color: CREAM, fontFamily: DISPLAY, fontSize: "16px", margin: "0" };
const footerText = { color: "#BBBBBB", fontSize: "12px", margin: "4px 0 0" };
