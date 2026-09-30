import React from "react";
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  vehicle?: string;
  plan?: string;
  date?: string;
  time?: string;
  location?: string;
  videoUrl?: string;
}

const formatDate = (value?: string) => {
  if (!value) return "your booked date";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const formatTime = (value?: string) => {
  if (!value) return "your booked time";
  const [hours = "", minutes = ""] = value.split(":");
  const hour = Number(hours);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes || "00"} ${suffix}`;
};

const Email = ({ name, vehicle, plan, date, time, location, videoUrl }: Props) => {
  const isVan = !!location?.includes("van");
  const car = vehicle ?? "car";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{isVan ? `Rai is coming to transform your ${car}` : `See how Rai will transform your ${car}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* brand bar */}
          <Section style={brandBar}>
            <Text style={brand}>
              RAI&apos;S <span style={{ color: PINK }}>✦</span> AUTO SPA
            </Text>
            <Text style={brandSub}>MG MARG · GANGTOK</Text>
          </Section>

          {/* hero */}
          <Section style={hero}>
            <Text style={pill}>{isVan ? "BORING → BEAST · VAN" : "BORING → BEAST"}</Text>
            <Heading style={h1}>
              {isVan ? `Rai is coming to transform your ${car}.` : `Here’s what Rai has planned for your ${car}.`}
            </Heading>
            <Text style={heroText}>
              Hi{name ? ` ${name}` : ""}, here&apos;s a first look at the transformation Rai has planned for your car.
            </Text>
            {videoUrl ? (
              <Button href={videoUrl} style={button}>
                See your car&apos;s transformation&nbsp; →
              </Button>
            ) : null}
          </Section>

          {/* appointment */}
          <Section style={card}>
            <Text style={cardLabel}>
              <span style={isVan ? mintTag : yellowTag}>{isVan ? "RAI COMES TO YOU" : "YOUR VISIT TO THE STUDIO"}</span>
            </Text>
            <Text style={cardTitle}>{plan ?? "Your car care appointment"}</Text>
            <Hr style={hr} />
            <Text style={label}>WHEN</Text>
            <Text style={value}>
              {formatDate(date)} · {formatTime(time)}
            </Text>
            <Text style={label}>WHERE</Text>
            <Text style={value}>
              {location?.replace(/\s*\(Rai's van comes to you\)\s*/i, "") || "Rai’s Auto Spa, MG Marg"}
            </Text>
          </Section>

          <Text style={note}>
            Rai will take care of the rest. See you soon <span style={{ color: PINK }}>✦</span>
          </Text>

          {/* footer */}
          <Section style={footerBar}>
            <Text style={footerBrand}>
              RAI&apos;S <span style={{ color: YELLOW }}>✦</span> AUTO SPA
            </Text>
            <Text style={footerText}>MG Marg, Gangtok</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d["location"]?.includes("van")
      ? `Rai is coming to transform your ${d["vehicle"] ?? "car"} — ${formatDate(d["date"])}`
      : `Your ${d["vehicle"] ?? "car"} transformation at Rai's — ${formatDate(d["date"])}`,
  displayName: "Reveal video ready",
  previewData: {
    name: "Pema",
    vehicle: "Maruti Swift",
    plan: "Full Detail",
    date: "2026-10-02",
    time: "08:00",
    location: "Tadong (Rai's van comes to you)",
    videoUrl: "https://example.com/reveal.mp4",
  },
} satisfies TemplateEntry;

/* ───────── theme (matches the website) ───────── */
const INK = "#111111";
const CREAM = "#FFF8EC";
const PINK = "#FF5FA2";
const YELLOW = "#FFD84D";
const LILAC = "#B9A7FF";
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
const hero = { ...boxed(LILAC), padding: "22px 20px", marginBottom: "16px" };
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
  fontSize: "30px",
  lineHeight: "34px",
  textTransform: "uppercase" as const,
  letterSpacing: "-1px",
  margin: "0 0 12px",
};
const heroText = { color: INK, fontSize: "15px", lineHeight: "23px", margin: "0 0 18px" };
const button = {
  backgroundColor: YELLOW,
  color: INK,
  border: `3px solid ${INK}`,
  borderRightWidth: "6px",
  borderBottomWidth: "6px",
  borderRadius: "14px",
  padding: "15px 22px",
  fontFamily: DISPLAY,
  fontSize: "14px",
  letterSpacing: "0.5px",
  textTransform: "uppercase" as const,
  textDecoration: "none",
  display: "inline-block",
};
const card = { ...boxed("#ffffff"), padding: "18px 20px", marginBottom: "16px" };
const tag = {
  display: "inline-block",
  border: `2px solid ${INK}`,
  borderRadius: "999px",
  color: INK,
  fontSize: "10px",
  fontWeight: 700 as const,
  letterSpacing: "1.5px",
  padding: "2px 8px",
};
const mintTag = { ...tag, backgroundColor: MINT };
const yellowTag = { ...tag, backgroundColor: YELLOW };
const cardLabel = { margin: "0 0 10px" };
const cardTitle = {
  color: INK,
  fontFamily: DISPLAY,
  fontSize: "22px",
  textTransform: "uppercase" as const,
  margin: "0",
};
const hr = { borderColor: INK, borderWidth: "2px 0 0", margin: "16px 0 6px" };
const label = {
  color: "#555555",
  fontSize: "10px",
  fontWeight: 700 as const,
  letterSpacing: "2px",
  margin: "10px 0 2px",
};
const value = { color: INK, fontSize: "15px", fontWeight: 700 as const, margin: "0" };
const note = { color: INK, fontSize: "14px", lineHeight: "21px", margin: "4px 4px 0" };
const footerBar = {
  backgroundColor: INK,
  borderRadius: "18px",
  padding: "16px 20px",
  marginTop: "24px",
};
const footerBrand = { color: CREAM, fontFamily: DISPLAY, fontSize: "16px", margin: "0" };
const footerText = { color: "#BBBBBB", fontSize: "12px", margin: "4px 0 0" };
