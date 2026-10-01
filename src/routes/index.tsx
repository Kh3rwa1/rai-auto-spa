import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Camera,
  Check,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";
import { BookingFlow } from "@/components/BookingFlow";
import { QuickBook } from "@/components/QuickBook";
import { BRAND } from "@/lib/brand";
import { PLANS, inr } from "@/lib/plans";
import heroImg from "@/assets/hero.jpg";

const MAPS_URL = "https://maps.google.com/?q=MG+Marg+Gangtok+737101";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: `${BRAND.siteName} — Boring to Beast · Gangtok`,
      },
      {
        name: "description",
        content:
          "Book a wash, detail or custom wrap in Gangtok. Studio or doorstep van, clear prices, live availability and no account needed.",
      },
      {
        property: "og:title",
        content: `${BRAND.siteName} — Boring to Beast`,
      },
      {
        property: "og:description",
        content: "One owner. Two studio bays. One van. Car-care booking without the back-and-forth.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CSS = `
.ras {
  --ink: #111;
  --cream: #fff8ec;
  --pink: #ff5fa2;
  --yellow: #ffd84d;
  --lilac: #b9a7ff;
  --mint: #9ee6c4;
  min-height: 100vh;
  background: var(--cream);
  color: var(--ink);
  font-family: Inter, system-ui, sans-serif;
}
.ras *, .ras *::before, .ras *::after { box-sizing: border-box; }
.ras .ras-wrap { width: min(1180px, calc(100% - 32px)); margin-inline: auto; }
.ras .ras-display {
  font-family: Outfit, Inter, system-ui, sans-serif;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -.045em;
  line-height: .94;
}
.ras .ras-panel {
  border: 3px solid var(--ink);
  border-radius: 22px;
  background: #fff;
  box-shadow: 5px 5px 0 var(--ink);
}
.ras .ras-btn {
  display: inline-flex;
  min-height: 50px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 11px 18px;
  border: 2px solid var(--ink);
  border-radius: 12px;
  background: #fff;
  color: var(--ink);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.3;
  text-decoration: none;
  box-shadow: 3px 3px 0 var(--ink);
  transition: transform .16s ease, box-shadow .16s ease;
  cursor: pointer;
}
.ras .ras-btn:hover { transform: translate(-2px, -2px); box-shadow: 5px 5px 0 var(--ink); }
.ras .ras-btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }
.ras .ras-btn-primary { background: var(--yellow); }
.ras .ras-btn-dark { background: var(--ink); color: #fff; box-shadow: 3px 3px 0 var(--pink); }
.ras .ras-btn-small { min-height: 44px; padding: 9px 12px; font-size: 12px; }
.ras :is(a, button, input, summary):focus-visible {
  outline: 3px solid #6d28d9;
  outline-offset: 4px;
}
.ras .ras-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.3;
}
.ras .ras-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.ras .ras-muted { color: #4b4945; }
.ras .ras-section { scroll-margin-top: 100px; }
.ras .ras-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  padding-block: 12px;
  background: var(--cream);
}
.ras .ras-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px 8px 17px;
  border: 2px solid var(--ink);
  border-radius: 15px;
  background: var(--cream);
}
.ras .ras-wordmark { display: inline-flex; align-items: center; gap: 7px; color: inherit; text-decoration: none; }
.ras .ras-wordmark-name { font-family: Outfit, sans-serif; font-size: 27px; font-weight: 800; letter-spacing: -.04em; }
.ras .ras-wordmark-small { font-size: 9px; font-weight: 800; line-height: 1.1; }
.ras .ras-nav-links { display: flex; align-items: center; gap: 5px; }
.ras .ras-nav-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px 12px;
  color: inherit;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}
.ras .ras-nav-link:hover { text-decoration: underline; text-underline-offset: 5px; }
.ras .ras-hero { display: grid; grid-template-columns: 1.2fr 1fr; overflow: hidden; }
.ras .ras-hero-copy { padding: clamp(24px, 4vw, 46px); }
.ras .ras-hero-title { margin-top: 20px; font-size: clamp(62px, 7.5vw, 104px); }
.ras .ras-hero-subtitle { max-width: 460px; margin-top: 18px; font-size: 19px; font-weight: 800; line-height: 1.35; }
.ras .ras-hero-description { max-width: 450px; margin-top: 10px; font-size: 15px; line-height: 1.8; color: #444; }
.ras .ras-hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.ras .ras-checks { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-top: 19px; }
.ras .ras-checks li { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; }
.ras .ras-hero-art {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  min-height: 410px;
  padding: 32px;
  border-left: 3px solid var(--ink);
  background: var(--pink);
}
.ras .ras-hero-art::before, .ras .ras-hero-art::after {
  content: "✦";
  position: absolute;
  font-size: 30px;
}
.ras .ras-hero-art::before { top: 25px; left: 25px; }
.ras .ras-hero-art::after { bottom: 27px; right: 25px; font-size: 23px; }
.ras .ras-mascot { width: min(68%, 235px); height: auto; animation: ras-bob 4s ease-in-out infinite; }
.ras .ras-art-note {
  width: min(100%, 300px);
  padding: 14px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--cream);
  text-align: center;
  box-shadow: 4px 4px 0 var(--ink);
}
.ras .ras-stats { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 16px; overflow: hidden; }
.ras .ras-stat { display: flex; align-items: center; gap: 12px; padding: 17px 21px; }
.ras .ras-stat + .ras-stat { border-left: 2px solid var(--ink); }
.ras .ras-stat-number { font-family: Outfit, sans-serif; font-size: 25px; font-weight: 800; line-height: 1.1; }
.ras .ras-stat-label { margin-top: 3px; font-size: 12px; font-weight: 600; color: #4b4945; }
.ras .ras-section-heading { font-size: clamp(34px, 5vw, 56px); }
.ras .ras-book-section { padding-top: 45px; padding-bottom: 48px; }
.ras .ras-heading-row { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.ras .ras-book-shell { padding: 12px; }
.ras .ras-demo-note { padding: 10px 13px; border: 1px dashed #817465; border-radius: 10px; background: var(--cream); font-size: 12px; line-height: 1.6; }
.ras .ras-flow-switch { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; margin-top: 16px; font-size: 13px; font-weight: 700; text-decoration: underline; text-underline-offset: 4px; }
.ras .ras-glow-grid { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 32px; padding-bottom: 50px; }
.ras .ras-compare-frame { padding: 10px; }
.ras .ras-compare { position: relative; aspect-ratio: 4 / 3; overflow: hidden; border: 2px solid var(--ink); border-radius: 14px; }
.ras .ras-compare img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ras .ras-compare-label { position: absolute; top: 12px; z-index: 2; padding: 5px 9px; border: 2px solid var(--ink); border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.ras .ras-compare-range { position: absolute; inset: 0; z-index: 4; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: ew-resize; touch-action: pan-y; }
.ras .ras-compare-line { position: absolute; top: 0; bottom: 0; z-index: 3; width: 3px; background: var(--ink); pointer-events: none; transform: translateX(-50%); }
.ras .ras-compare-knob { position: absolute; top: 50%; left: 50%; display: grid; width: 44px; height: 44px; place-items: center; border: 3px solid var(--ink); border-radius: 999px; background: var(--yellow); font-size: 20px; font-weight: 800; transform: translate(-50%, -50%); }
.ras .ras-compare:focus-within { outline: 3px solid #6d28d9; outline-offset: 4px; }
.ras .ras-step-list { display: grid; gap: 12px; margin-top: 23px; }
.ras .ras-step { display: flex; align-items: flex-start; gap: 14px; padding: 17px; border: 2px solid var(--ink); border-radius: 15px; background: #fff; }
.ras .ras-step-icon { display: grid; flex-shrink: 0; width: 42px; height: 42px; place-items: center; border: 2px solid var(--ink); border-radius: 999px; }
.ras .ras-owner-section { padding-block: 40px; border-block: 3px solid var(--ink); background: var(--lilac); }
.ras .ras-owner-heading { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 22px; }
.ras .ras-owner-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 25px; }
.ras .ras-owner-card { padding: 24px; }
.ras .ras-owner-list { display: grid; gap: 13px; margin-top: 18px; }
.ras .ras-owner-list li { display: flex; align-items: flex-start; gap: 9px; font-size: 14px; line-height: 1.6; }
.ras .ras-footer { padding-top: 30px; padding-bottom: 100px; background: var(--ink); color: var(--cream); }
.ras .ras-footer-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; }
.ras .ras-footer-links { display: flex; flex-wrap: wrap; gap: 16px; }
.ras .ras-footer-links a { display: inline-flex; min-height: 44px; align-items: center; gap: 6px; color: inherit; font-size: 13px; font-weight: 700; }
.ras .ras-mobile-cta { position: fixed; right: 12px; bottom: 12px; left: 12px; z-index: 35; }
.ras .ras-mobile-cta a { width: 100%; }
.ras .ras-skip { position: fixed; top: 8px; left: 8px; z-index: 100; padding: 12px 16px; border-radius: 10px; background: var(--ink); color: #fff; transform: translateY(-150%); }
.ras .ras-skip:focus { transform: translateY(0); }
@keyframes ras-bob {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-7px) rotate(2deg); }
}
@media (min-width: 768px) {
  .ras .ras-mobile-cta { display: none; }
  .ras .ras-footer { padding-bottom: 30px; }
}
@media (max-width: 767px) {
  .ras .ras-hero { grid-template-columns: 1fr; }
  .ras .ras-hero-art { min-height: 290px; border-top: 3px solid var(--ink); border-left: 0; gap: 10px; padding: 23px; }
  .ras .ras-mascot { width: 145px; }
  .ras .ras-art-note { padding: 10px; }
  .ras .ras-stats { grid-template-columns: 1fr; }
  .ras .ras-stat + .ras-stat { border-top: 2px solid var(--ink); border-left: 0; }
  .ras .ras-stat { padding: 13px 17px; }
  .ras .ras-stat-number { font-size: 22px; }
  .ras .ras-glow-grid, .ras .ras-owner-grid { grid-template-columns: 1fr; }
  .ras .ras-glow-grid { gap: 24px; }
  .ras .ras-nav-desktop { display: none; }
  .ras .ras-book-section { padding-top: 32px; }
  .ras .ras-book-shell { padding: 7px; }
}
@media (max-width: 380px) {
  .ras .ras-wrap { width: calc(100% - 24px); }
  .ras .ras-wordmark-name { font-size: 23px; }
  .ras .ras-btn-small { padding-inline: 9px; font-size: 11px; }
  .ras .ras-hero-copy { padding: 21px; }
  .ras .ras-hero-title { font-size: 57px; }
}
@media (prefers-reduced-motion: reduce) {
  .ras *, .ras *::before, .ras *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;

function Wordmark() {
  return (
    <span className="ras-wordmark">
      <span className="ras-wordmark-name">RAI&rsquo;S</span>
      <span aria-hidden>✦</span>
      <span className="ras-wordmark-small">
        AUTO
        <br />
        SPA
      </span>
    </span>
  );
}

function Navigation() {
  return (
    <header className="ras-nav">
      <div className="ras-wrap ras-nav-inner">
        <a href="#top" aria-label={`${BRAND.siteName} — back to top`}>
          <Wordmark />
        </a>
        <nav className="ras-nav-links" aria-label="Main navigation">
          <a href="#book" className="ras-nav-link ras-nav-desktop">
            Prices &amp; booking
          </a>
          <a href="#owner-story" className="ras-nav-link ras-nav-desktop">
            For Rai
          </a>
          <Link to="/owner" className="ras-btn ras-btn-small">
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Try owner demo
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Mascot() {
  const foam = [
    [60, 68, 17],
    [84, 52, 19],
    [111, 47, 20],
    [137, 56, 18],
    [152, 76, 13],
    [44, 86, 11],
  ];

  return (
    <svg viewBox="0 0 200 220" className="ras-mascot" aria-hidden focusable="false">
      <ellipse cx="100" cy="210" rx="56" ry="7" fill="#111" />
      <path d="M80 172v24M120 172v24" stroke="#111" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M58 202q0-15 23-13q10 1 10 13zM109 202q0-12 10-13q23-2 23 13z"
        fill="#b9a7ff"
        stroke="#111"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M47 122q-22 2-24-18M153 122q20-6 26-28"
        stroke="#111"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="22" cy="98" r="9" fill="#fff" stroke="#111" strokeWidth="4" />
      <rect x="170" y="72" width="22" height="18" rx="5" fill="#9ee6c4" stroke="#111" strokeWidth="4" />
      <rect x="45" y="62" width="110" height="114" rx="26" fill="#ffd84d" stroke="#111" strokeWidth="5" />
      <circle cx="62" cy="150" r="5" fill="#e9b824" />
      <circle cx="140" cy="140" r="6" fill="#e9b824" />
      <circle cx="100" cy="162" r="3" fill="#e9b824" />
      {foam.map(([x, y, r], index) => (
        <circle key={`edge-${index}`} cx={x} cy={y} r={r + 3} fill="#111" />
      ))}
      {foam.map(([x, y, r], index) => (
        <circle key={`foam-${index}`} cx={x} cy={y} r={r} fill="#cff5ff" />
      ))}
      <ellipse cx="80" cy="104" rx="12" ry="15" fill="#fff" stroke="#111" strokeWidth="4" />
      <ellipse cx="120" cy="104" rx="12" ry="15" fill="#fff" stroke="#111" strokeWidth="4" />
      <circle cx="83" cy="107" r="6" fill="#111" />
      <circle cx="123" cy="107" r="6" fill="#111" />
      <circle cx="63" cy="126" r="7" fill="#ff5fa2" />
      <circle cx="137" cy="126" r="7" fill="#ff5fa2" />
      <path d="M82 128q18 26 36 0z" fill="#111" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M92 138q8 6 16 0q-2 7-8 7t-8-7z" fill="#ff5fa2" />
    </svg>
  );
}

function Hero() {
  return (
    <section className="ras-wrap" aria-labelledby="hero-title">
      <div className="ras-panel ras-hero">
        <div className="ras-hero-copy">
          <span className="ras-pill" style={{ background: "var(--mint)" }}>
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            MG Marg, Gangtok
          </span>

          <h1 id="hero-title" className="ras-display ras-hero-title">
            Boring
            <br />
            to beast.
          </h1>

          <p className="ras-eyebrow mt-5">Wash · Detail · Custom wrap</p>

          <p className="ras-hero-subtitle">
            Your next car-care booking.
            <br />
            Minus the back-and-forth.
          </p>

          <p className="ras-hero-description">
            One owner. Two studio bays. One van. Pick your service and an available time—at the studio or your
            doorstep—without calling Rai.
          </p>

          <div className="ras-hero-actions">
            <a href="#book" className="ras-btn ras-btn-primary">
              Book a slot
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a href="#glow" className="ras-btn">
              <Sparkles className="h-4 w-4" aria-hidden />
              See the glow-up
            </a>
          </div>

          <ul className="ras-checks" aria-label="Booking benefits">
            <li>
              <Check className="h-4 w-4" aria-hidden />
              No account needed
            </li>
            <li>
              <Check className="h-4 w-4" aria-hidden />
              Prices upfront
            </li>
            <li>
              <Check className="h-4 w-4" aria-hidden />
              30% deposit to confirm
            </li>
          </ul>
        </div>

        <div className="ras-hero-art">
          <span className="ras-pill" style={{ background: "var(--cream)" }}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />A little dirty? A lot of potential.
          </span>
          <Mascot />
          <div className="ras-art-note">
            <p className="ras-display text-2xl">You pick. We shine.</p>
            <p className="mt-2 text-xs leading-relaxed">
              Wash, detail or a whole new look.
              <br />
              Start with a service. Add a photo for an AI preview.
            </p>
          </div>
        </div>
      </div>

      <ul className="ras-panel ras-stats" aria-label="Business at a glance">
        <li className="ras-stat">
          <Store className="h-6 w-6 shrink-0" aria-hidden />
          <div>
            <p className="ras-stat-number">2 studio bays</p>
            <p className="ras-stat-label">Visit us on MG Marg</p>
          </div>
        </li>
        <li className="ras-stat">
          <Truck className="h-6 w-6 shrink-0" aria-hidden />
          <div>
            <p className="ras-stat-number">1 doorstep van</p>
            <p className="ras-stat-label">Choose your area when booking</p>
          </div>
        </li>
        <li className="ras-stat" style={{ background: "var(--lilac)" }}>
          <Sparkles className="h-6 w-6 shrink-0" aria-hidden />
          <div>
            <p className="ras-stat-number">From {inr(PLANS.wash.price)}</p>
            <p className="ras-stat-label">See service prices below</p>
          </div>
        </li>
      </ul>
    </section>
  );
}

function Booking({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [photoFlow, setPhotoFlow] = useState(false);

  function switchFlow(next: boolean) {
    if (next === photoFlow) return;
    if (!window.confirm("Switch booking modes? Any unfinished selections in this form will be cleared.")) return;

    setPhotoFlow(next);
  }

  return (
    <section id="book" ref={sectionRef} className="ras-wrap ras-section ras-book-section" aria-labelledby="book-title">
      <div className="ras-heading-row">
        <div>
          <p className="ras-eyebrow mb-3">Less messaging. More moving.</p>
          <h2 id="book-title" className="ras-display ras-section-heading">
            Your glow-up
            <br />
            starts here.
          </h2>
          <p className="ras-muted mt-3 max-w-xl text-sm leading-relaxed">
            {photoFlow
              ? "Upload your car, explore your design, then choose a time."
              : "Choose a service, find a time and complete your booking below."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="ras-pill" style={{ background: "var(--mint)" }}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            No account
          </span>
          <span className="ras-pill" style={{ background: "var(--yellow)" }}>
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
            Live availability
          </span>
        </div>
      </div>

      <div className="ras-panel ras-book-shell">
        {photoFlow ? (
          <>
            <BookingFlow />
            <button type="button" className="ras-flow-switch" onClick={() => switchFlow(false)}>
              <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
              Back to quick booking
            </button>
          </>
        ) : (
          <QuickBook onUsePhotoFlow={() => switchFlow(true)} />
        )}
      </div>

      <details className="ras-demo-note mt-5">
        <summary className="cursor-pointer font-bold">Trying the contest demo? Start here.</summary>
        <p className="mt-2">
          Choose a service, then use a sample car or type a car model. Pick a time and try the simulated checkout. No
          real money is charged. Open the owner demo to explore routes, calendars and subscriptions.
        </p>
        <p className="mt-2">AI previews are illustrative. You can still book if a preview is unavailable.</p>
      </details>
    </section>
  );
}

function Transformation() {
  const [position, setPosition] = useState(50);

  const steps = [
    {
      title: "Pick your service",
      description: "Essential wash, full detail or a custom wrap. See the price before you begin.",
      icon: Sparkles,
      color: "var(--mint)",
    },
    {
      title: "Choose where and when",
      description: "Studio or doorstep. Choose from available times, with water constraints handled.",
      icon: CalendarCheck,
      color: "var(--yellow)",
    },
    {
      title: "Confirm your booking",
      description: "Add your details and complete the 30% deposit checkout. Photo previews are optional.",
      icon: Check,
      color: "var(--lilac)",
    },
  ];

  return (
    <section id="glow" className="ras-wrap ras-section ras-glow-grid" aria-labelledby="glow-title">
      <figure className="ras-panel ras-compare-frame">
        <div className="ras-compare">
          <img src={heroImg} alt="Illustration of a car-care transformation" loading="lazy" decoding="async" />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} aria-hidden>
            <img
              src={heroImg}
              alt=""
              loading="lazy"
              decoding="async"
              style={{ filter: "grayscale(.5) sepia(.45) brightness(.65)" }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 25% 75%, rgba(90,60,25,.55), transparent 28%), linear-gradient(to top, rgba(88,60,26,.5), transparent 60%)",
              }}
            />
          </div>

          <span className="ras-compare-label left-3" style={{ background: "var(--cream)" }}>
            Before
          </span>
          <span className="ras-compare-label right-3" style={{ background: "var(--yellow)" }}>
            After
          </span>

          <input
            className="ras-compare-range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            aria-label="Before image visibility"
            aria-valuetext={`${position}% of the before illustration visible`}
          />

          <div className="ras-compare-line" style={{ left: `${position}%` }} aria-hidden>
            <span className="ras-compare-knob">↔</span>
          </div>
        </div>
        <figcaption className="ras-muted px-1 pb-1 pt-3 text-xs leading-relaxed">
          Illustration, not a customer result. Add a photo during booking to generate your own car&rsquo;s AI preview.
        </figcaption>
      </figure>

      <div>
        <p className="ras-eyebrow mb-3">The car gets a glow-up. Booking gets simpler.</p>
        <h2 id="glow-title" className="ras-display ras-section-heading">
          Dirty to
          <br />
          <span style={{ color: "#a51e60" }}>dripping.</span>
        </h2>

        <ol className="ras-step-list">
          {steps.map((step, index) => (
            <li className="ras-step" key={step.title}>
              <span className="ras-step-icon" style={{ background: step.color }}>
                <step.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-extrabold">
                  {index + 1}. {step.title}
                </h3>
                <p className="ras-muted mt-1 text-sm leading-relaxed">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function OwnerStory() {
  const before = [
    "Check the notebook before promising a time.",
    "Ask each customer: studio or van, where, and is water available?",
    "Coordinate changes and chase the next booking manually.",
  ];

  const after = [
    "Customers choose a service and check available times themselves.",
    "Location and water details are collected during booking.",
    "Rai manages bookings, subscriptions and waitlist offers in one dashboard.",
  ];

  return (
    <section id="owner-story" className="ras-section ras-owner-section" aria-labelledby="owner-title">
      <div className="ras-wrap">
        <div className="ras-owner-heading">
          <div>
            <p className="ras-eyebrow mb-3">Built for the person behind the business</p>
            <h2 id="owner-title" className="ras-display ras-section-heading">
              Less chasing.
              <br />
              More car care.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed">
              Rai is one owner juggling two bays and a mobile van. The booking flow collects the details. The dashboard
              keeps the day in view.
            </p>
          </div>
          <Link to="/owner" className="ras-btn ras-btn-primary">
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Try the owner demo
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="ras-owner-grid">
          <article className="ras-panel ras-owner-card">
            <span className="ras-pill" style={{ background: "var(--cream)" }}>
              Before · The notebook
            </span>
            <h3 className="ras-display mt-4 text-3xl">Every booking, a conversation.</h3>
            <ul className="ras-owner-list">
              {before.map((item) => (
                <li key={item}>
                  <span className="mt-1 shrink-0 font-black" aria-hidden>
                    —
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="ras-panel ras-owner-card" style={{ background: "var(--mint)" }}>
            <span className="ras-pill" style={{ background: "#fff" }}>
              After · The booking desk
            </span>
            <h3 className="ras-display mt-4 text-3xl">Customers book. Rai runs the day.</h3>
            <ul className="ras-owner-list">
              {after.map((item) => (
                <li key={item}>
                  <Check className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="ras-footer">
      <div className="ras-wrap">
        <div className="ras-footer-row">
          <div>
            <Wordmark />
            <p className="mt-2 text-xs leading-relaxed text-[#e5dfd4]">MG Marg, Gangtok · Studio + doorstep van</p>
          </div>
          <nav className="ras-footer-links" aria-label="Footer navigation">
            <a href="#book">
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Book a slot
            </a>
            <Link to="/owner">
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Owner demo
            </Link>
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
              <MapPin className="h-4 w-4" aria-hidden />
              Find the studio
            </a>
          </nav>
        </div>
        <p className="mt-6 border-t border-[#777] pt-4 text-xs leading-relaxed text-[#d5cec2]">
          Contest demo for a hypothetical small business. Payments are simulated. AI previews illustrate a possible
          finish and do not guarantee service results.
        </p>
      </div>
    </footer>
  );
}

function Index() {
  const bookingRef = useRef<HTMLElement | null>(null);
  const [bookingVisible, setBookingVisible] = useState(false);

  useEffect(() => {
    const section = bookingRef.current;
    if (!section || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) => setBookingVisible(entry?.isIntersecting ?? false), {
      threshold: 0,
    });

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div id="top" className="ras">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <a href="#book" className="ras-skip">
        Skip to booking
      </a>

      <Navigation />

      <main>
        <Hero />
        <Booking sectionRef={bookingRef} />
        <Transformation />
        <OwnerStory />
      </main>

      <Footer />

      {!bookingVisible && (
        <div className="ras-mobile-cta">
          <a href="#book" className="ras-btn ras-btn-primary">
            Book a slot · from {inr(PLANS.wash.price)}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      )}
    </div>
  );
}
