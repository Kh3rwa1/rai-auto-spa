import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  LayoutDashboard,
  MapPin,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";
import { BeforeAfter } from "@/components/BeforeAfter";
import { BookingFlow } from "@/components/BookingFlow";
import { QuickBook } from "@/components/QuickBook";
import { getSlots } from "@/lib/booking.functions";
import { BRAND } from "@/lib/brand";
import { PLANS, SLOTS, WATER_FEE, inr, isDryWindow } from "@/lib/plans";

const MAPS_URL = "https://maps.google.com/?q=MG+Marg+Gangtok+737101";
const DAY_MS = 86_400_000;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.siteName} — Boring to Beast · Gangtok` },
      {
        name: "description",
        content:
          "Book a car wash, detail or custom wrap in Gangtok. Studio on MG Marg or a doorstep van, clear prices, free rescheduling and no account needed.",
      },
      { property: "og:title", content: `${BRAND.siteName} — Boring to Beast` },
      {
        property: "og:description",
        content:
          "Car wash, detail and custom wraps in Gangtok. Pick a time that works and lock it in with a 30% deposit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CSS = `
.ras{--ink:#111;--cream:#fff8ec;--pink:#ff5fa2;--yellow:#ffd84d;--lilac:#b9a7ff;--mint:#9ee6c4;min-height:100vh;background:var(--cream);color:var(--ink);font-family:Inter,system-ui,sans-serif}
.ras *,.ras *::before,.ras *::after{box-sizing:border-box}
.ras .ras-wrap{width:min(1180px,calc(100% - 32px));margin-inline:auto}
.ras .ras-display{font-family:Outfit,Inter,system-ui,sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:-.045em;line-height:.94}
.ras .ras-panel{border:3px solid var(--ink);border-radius:22px;background:#fff;box-shadow:5px 5px 0 var(--ink)}
.ras .ras-btn{display:inline-flex;min-height:50px;align-items:center;justify-content:center;gap:9px;padding:11px 18px;border:2px solid var(--ink);border-radius:12px;background:#fff;color:var(--ink);font-size:13px;font-weight:800;line-height:1.3;text-decoration:none;box-shadow:3px 3px 0 var(--ink);transition:transform .16s ease,box-shadow .16s ease;cursor:pointer}
.ras .ras-btn:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--ink)}
.ras .ras-btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.ras .ras-btn-primary{background:var(--yellow)}
.ras .ras-btn-small{min-height:44px;padding:9px 12px;font-size:12px}
.ras :is(a,button,input,summary):focus-visible{outline:3px solid #6d28d9;outline-offset:4px}
.ras .ras-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:2px solid var(--ink);border-radius:999px;font-size:11px;font-weight:800;line-height:1.3}
.ras .ras-eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.ras .ras-muted{color:#4b4945}
.ras .ras-fine{margin-top:12px;font-size:12px;line-height:1.6;color:#4b4945}
.ras .ras-section{scroll-margin-top:100px}

.ras .ras-nav{position:sticky;top:0;z-index:40;padding-block:12px;background:var(--cream)}
.ras .ras-nav-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px 8px 17px;border:2px solid var(--ink);border-radius:15px;background:var(--cream)}
.ras .ras-wordmark{display:inline-flex;align-items:center;gap:7px;color:inherit;text-decoration:none}
.ras .ras-wordmark-name{font-family:Outfit,Inter,sans-serif;font-size:27px;font-weight:800;letter-spacing:-.04em}
.ras .ras-wordmark-small{font-size:9px;font-weight:800;line-height:1.1}
.ras .ras-nav-links{display:flex;align-items:center;gap:6px}
.ras .ras-nav-link{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;color:inherit;font-size:12px;font-weight:800;text-decoration:none}
.ras .ras-nav-link:hover{text-decoration:underline;text-underline-offset:5px}
.ras .ras-owner-short{display:none}

.ras .ras-hero{display:grid;grid-template-columns:1.2fr 1fr;overflow:hidden}
.ras .ras-hero-copy{padding:clamp(24px,4vw,46px)}
.ras .ras-hero-title{margin-top:20px;font-size:clamp(62px,7.5vw,104px)}
.ras .ras-hero-subtitle{max-width:460px;margin-top:16px;font-size:20px;font-weight:800;line-height:1.3}
.ras .ras-hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px}
.ras .ras-next{display:inline-flex;align-items:center;gap:8px;min-height:44px;margin-top:14px;padding:8px 14px;border:2px solid var(--ink);border-radius:999px;background:var(--mint);color:var(--ink);font-size:13px;font-weight:800;text-decoration:none}
.ras .ras-next-dot{width:9px;height:9px;border-radius:999px;background:#0b8a4b;box-shadow:0 0 0 3px rgba(11,138,75,.25)}
.ras .ras-prices{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
.ras .ras-price{display:flex;height:100%;flex-direction:column;gap:2px;padding:10px 12px;border:2px solid var(--ink);border-radius:14px;background:#fff;color:var(--ink);text-decoration:none;transition:transform .16s ease,box-shadow .16s ease}
.ras .ras-price:hover{transform:translate(-2px,-2px);box-shadow:4px 4px 0 var(--ink)}
.ras .ras-price-name{font-size:11px;font-weight:800;line-height:1.25}
.ras .ras-price-amt{font-family:Outfit,Inter,sans-serif;font-size:22px;font-weight:800;line-height:1.1}
.ras .ras-price-meta{font-size:11px;font-weight:700;color:#4b4945}
.ras .ras-checks{display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:18px}
.ras .ras-checks li{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700}
.ras .ras-hero-art{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;min-height:410px;padding:32px;border-left:3px solid var(--ink);background:var(--pink)}
.ras .ras-hero-art{padding:0;gap:0;align-items:stretch;justify-content:flex-start;overflow:hidden;background:var(--cream)}
.ras .ras-hero-art [role="slider"],.ras .ras-compare-frame [role="slider"]{touch-action:pan-y !important}
.ras .ras-hero-art [role="slider"]{flex:1;aspect-ratio:auto;min-height:340px;border-radius:0;box-shadow:none}
.ras .ras-compare-frame [role="slider"]{border:2px solid var(--ink);border-radius:14px;box-shadow:none}
.ras .ras-hero-cap{padding:10px 14px;border-top:3px solid var(--ink);font-size:12px;font-weight:700;line-height:1.5}

.ras .ras-stats{display:grid;grid-template-columns:repeat(4,1fr);margin-top:16px;overflow:hidden}
.ras .ras-stat{display:flex;align-items:center;gap:12px;padding:17px 21px}
.ras .ras-stat+.ras-stat{border-left:2px solid var(--ink)}
.ras .ras-stat-number{font-family:Outfit,Inter,sans-serif;font-size:25px;font-weight:800;line-height:1.1}
.ras .ras-stat-label{margin-top:3px;font-size:12px;font-weight:600;color:#4b4945}

.ras .ras-section-heading{font-size:clamp(34px,5vw,56px)}
.ras .ras-book-section{padding-top:45px;padding-bottom:48px}
.ras .ras-heading-row{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:16px;margin-bottom:20px}
.ras .ras-book-shell{padding:12px}
.ras .ras-flow-switch{display:inline-flex;min-height:44px;align-items:center;gap:8px;margin-top:16px;font-size:13px;font-weight:700;text-decoration:underline;text-underline-offset:4px;cursor:pointer}

.ras .ras-rules-section{padding-bottom:50px}
.ras .ras-rules-grid{display:grid;grid-template-columns:1.05fr 1fr;align-items:center;gap:24px;margin-top:22px}
.ras .ras-slot-card{padding:20px}
.ras .ras-slot-row+.ras-slot-row{margin-top:18px}
.ras .ras-slot-title{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;font-weight:800}
.ras .ras-slot-list{display:grid;grid-template-columns:repeat(6,1fr);gap:7px}
.ras .ras-slot{padding:9px 2px;border:2px solid var(--ink);border-radius:10px;background:var(--mint);font-size:12px;font-weight:800;text-align:center}
.ras .ras-slot[data-blocked="true"]{background:#e4dfd5;color:#4b4945;text-decoration:line-through;text-decoration-thickness:2px}
.ras .ras-rule-list{display:grid;gap:12px}
.ras .ras-rule{display:flex;align-items:flex-start;gap:14px;padding:17px;border:2px solid var(--ink);border-radius:15px;background:#fff}
.ras .ras-step-icon{display:grid;flex-shrink:0;width:42px;height:42px;place-items:center;border:2px solid var(--ink);border-radius:999px}

.ras .ras-glow-grid{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:32px;padding-bottom:50px}
.ras .ras-slot-card{padding:20px}

.ras .ras-how-section{padding-bottom:50px}
.ras .ras-how-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px}
.ras .ras-how-card{display:flex;flex-direction:column;gap:12px;padding:18px;border:2px solid var(--ink);border-radius:16px;background:#fff}

.ras .ras-faq-section{padding-bottom:50px}
.ras .ras-faq-list{display:grid;gap:10px;max-width:820px;margin-top:22px}
.ras .ras-faq{border:2px solid var(--ink);border-radius:14px;background:#fff}
.ras .ras-faq summary{display:flex;min-height:48px;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;font-size:14px;font-weight:800;cursor:pointer;list-style:none}
.ras .ras-faq summary::-webkit-details-marker{display:none}
.ras .ras-faq summary::after{content:"+";font-size:22px;font-weight:800;line-height:1}
.ras .ras-faq[open] summary::after{content:"–"}
.ras .ras-faq p{padding:0 16px 14px;font-size:14px;line-height:1.7;color:#4b4945}

.ras .ras-behind{padding:clamp(20px,3vw,30px);background:var(--lilac)}
.ras .ras-behind-grid{display:grid;grid-template-columns:1fr 1.3fr;align-items:center;gap:22px}

.ras .ras-final{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:22px;margin-block:48px;padding:clamp(22px,4vw,38px);background:var(--yellow)}
.ras .ras-final-actions{display:flex;flex-wrap:wrap;gap:12px}

.ras .ras-footer{padding-top:30px;padding-bottom:100px;background:var(--ink);color:var(--cream)}
.ras .ras-footer-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px}
.ras .ras-footer-links{display:flex;flex-wrap:wrap;gap:16px}
.ras .ras-footer-links a{display:inline-flex;min-height:44px;align-items:center;gap:6px;color:inherit;font-size:13px;font-weight:700}
.ras .ras-footer-note{margin-top:6px;font-size:12px;line-height:1.6;color:#d9d2c4}
.ras .ras-mobile-cta{position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));left:12px;z-index:35}
.ras .ras-mobile-cta a{width:100%}
.ras .ras-skip{position:fixed;top:8px;left:8px;z-index:100;padding:12px 16px;border-radius:10px;background:var(--ink);color:#fff;transform:translateY(-150%)}
.ras .ras-skip:focus{transform:translateY(0)}

@media (min-width:768px){
  .ras .ras-mobile-cta{display:none}
  .ras .ras-footer{padding-bottom:30px}
}
@media (min-width:768px) and (max-width:1000px){
  .ras .ras-stats{grid-template-columns:repeat(2,1fr)}
  .ras .ras-stat:nth-child(3){border-left:0}
  .ras .ras-stat:nth-child(n+3){border-top:2px solid var(--ink)}
}
@media (max-width:1000px){
  .ras .ras-how-grid{grid-template-columns:repeat(2,1fr)}
  .ras .ras-behind-grid{grid-template-columns:1fr}
}
@media (max-width:767px){
  .ras .ras-hero{grid-template-columns:1fr}
  .ras .ras-hero-art{min-height:270px;padding:23px;gap:10px;border-top:3px solid var(--ink);border-left:0}
  .ras .ras-hero-art [role="slider"]{min-height:260px}
  .ras .ras-stats{grid-template-columns:1fr}
  .ras .ras-stat+.ras-stat{border-top:2px solid var(--ink);border-left:0}
  .ras .ras-stat{padding:13px 17px}
  .ras .ras-stat-number{font-size:22px}
  .ras .ras-glow-grid,.ras .ras-rules-grid,.ras .ras-how-grid{grid-template-columns:1fr}
  .ras .ras-glow-grid{gap:24px}
  .ras .ras-slot-list{grid-template-columns:repeat(4,1fr)}
  .ras .ras-nav-desktop{display:none}
  .ras .ras-owner-long{display:none}
  .ras .ras-owner-short{display:inline}
  .ras .ras-book-section{padding-top:32px}
  .ras .ras-book-shell{padding:7px}
  .ras .ras-prices{grid-template-columns:1fr}
  .ras .ras-price{flex-direction:row;align-items:center;justify-content:space-between;gap:8px}
}
@media (max-width:380px){
  .ras .ras-wrap{width:calc(100% - 24px)}
  .ras .ras-wordmark-name{font-size:23px}
  .ras .ras-btn-small{padding-inline:9px;font-size:11px}
  .ras .ras-hero-copy{padding:21px}
  .ras .ras-hero-title{font-size:57px}
}
@media (prefers-reduced-motion:reduce){
  .ras *,.ras *::before,.ras *::after{animation:none!important;transition:none!important}
}
`;

const timeLabel = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
};

/** Finds the soonest open studio slot using the same availability data as the booking form. */
function useNextFree() {
  const fetchSlots = useServerFn(getSlots);
  const fetchRef = useRef(fetchSlots);
  fetchRef.current = fetchSlots;
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const ist = new Date(Date.now() + 5.5 * 3_600_000);
        const today = ist.toISOString().slice(0, 10);
        const nowMin = ist.getUTCHours() * 60 + ist.getUTCMinutes();
        const r = await fetchRef.current({ data: { start: today, mobile: false, pin: null } });
        for (let i = 0; i < 7; i++) {
          const ds = new Date(Date.parse(today) + i * DAY_MS).toISOString().slice(0, 10);
          for (const t of SLOTS) {
            if (i === 0 && Number(t.slice(0, 2)) * 60 <= nowMin + 30) continue;
            const s = r.slots[`${ds} ${t}`];
            if (s && !s.blocked && s.taken < r.capacity) {
              const day =
                i === 0
                  ? "Today"
                  : i === 1
                    ? "Tomorrow"
                    : new Date(ds + "T00:00:00Z").toLocaleDateString("en-IN", {
                        weekday: "short",
                        timeZone: "UTC",
                      });
              if (live) setNext(`${day} ${timeLabel(t)}`);
              return;
            }
          }
        }
      } catch {
        /* chip simply stays hidden */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return next;
}

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
          <a href="#how" className="ras-nav-link ras-nav-desktop">
            How it works
          </a>
          <a href="#faq" className="ras-nav-link ras-nav-desktop">
            FAQ
          </a>
          <a href="#book" className="ras-btn ras-btn-small ras-btn-primary">
            Book now
          </a>
          <Link to="/owner" className="ras-btn ras-btn-small" aria-label="Owner dashboard">
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            <span className="ras-owner-long">Owner dashboard</span>
            <span className="ras-owner-short">Owner</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  const next = useNextFree();

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

          <p className="ras-eyebrow mt-5" style={{ fontSize: "14px" }}>
            Car wash · Detail · Custom wrap
          </p>

          <p className="ras-hero-subtitle">Book your car&rsquo;s glow-up in a few taps.</p>

          <div className="ras-hero-actions">
            <a href="#book" className="ras-btn ras-btn-primary">
              Book now
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a href="#how" className="ras-btn">
              <Sparkles className="h-4 w-4" aria-hidden />
              How it works
            </a>
          </div>

          {next && (
            <a href="#book" className="ras-next">
              <span className="ras-next-dot" aria-hidden />
              Next free studio slot: {next}
            </a>
          )}

          <ul className="ras-prices" aria-label="Services and prices">
            {Object.values(PLANS).map((p) => (
              <li key={p.id}>
                <a href="#book" className="ras-price">
                  <span className="ras-price-name">{p.name}</span>
                  <span className="ras-price-amt">{inr(p.price)}</span>
                  <span className="ras-price-meta">{p.duration}</span>
                </a>
              </li>
            ))}
          </ul>

          <ul className="ras-checks" aria-label="Booking benefits">
            <li>
              <Check className="h-4 w-4" aria-hidden />
              No account needed
            </li>
            <li>
              <Check className="h-4 w-4" aria-hidden />
              Free reschedule up to 12h before
            </li>
          </ul>
        </div>

        <div className="ras-hero-art">
          <BeforeAfter
            before="/samples/thar.jpg"
            after="/samples/thar-wrap.jpg"
            beforeLabel="Before"
            afterLabel="Signature Super Design"
          />
          <p className="ras-hero-cap">Sample preview, not a customer result. Drag to compare.</p>
        </div>
      </div>

      <ul className="ras-panel ras-stats" aria-label="Business at a glance">
        <li className="ras-stat" style={{ background: "var(--yellow)" }}>
          <CalendarCheck className="h-6 w-6 shrink-0" aria-hidden />
          <div>
            <p className="ras-stat-number">1,500+</p>
            <p className="ras-stat-label">Appointments completed</p>
          </div>
        </li>

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
            <p className="ras-stat-label">Prices shown before you book</p>
          </div>
        </li>
      </ul>
    </section>
  );
}

function Booking({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  const [photoFlow, setPhotoFlow] = useState(false);

  function switchFlow(next: boolean) {
    if (next === photoFlow) return;
    const confirmed = window.confirm(
      "Switch booking modes? Any unfinished selections in this form will be cleared.",
    );
    if (!confirmed) return;
    setPhotoFlow(next);
  }

  return (
    <section
      id="book"
      ref={sectionRef}
      className="ras-wrap ras-section ras-book-section"
      aria-labelledby="book-title"
    >
      <div className="ras-heading-row">
        <div>
          <p className="ras-eyebrow mb-3">Book in a few taps</p>

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

      <p className="ras-fine">
        Pay 30% now, the rest on the day. Your slot is held for 20 minutes. Checkout here is a demo,
        so no real payment is taken. AI previews are illustrative.
      </p>
    </section>
  );
}

function Rules() {
  const rules = [
    {
      title: "Doorstep? Tell us about water.",
      description: `Van bookings ask if you have a tap. No tap? The van brings a tank (+${inr(WATER_FEE)}) and the midday slots close, so nobody turns up to a dry hose.`,
      icon: Truck,
      color: "var(--mint)",
    },
  ];

  return (
    <section
      id="rules"
      className="ras-wrap ras-section ras-rules-section"
      aria-labelledby="rules-title"
    >
      <p className="ras-eyebrow mb-3">No awkward surprises</p>

      <h2 id="rules-title" className="ras-display ras-section-heading">
        Only times
        <br />
        that work.
      </h2>

      <p className="ras-muted mt-3 max-w-xl text-sm leading-relaxed">
        The booking form knows how the studio and the van run, so every slot you see is one we can
        actually do.
      </p>

      <div className="ras-rules-grid">
        <figure className="ras-panel ras-slot-card">
          <div className="ras-slot-row">
            <p className="ras-slot-title">
              <Truck className="h-4 w-4" aria-hidden />
              Doorstep van · no water at your place
            </p>
            <ul className="ras-slot-list">
              {SLOTS.map((t) => {
                const blocked = isDryWindow(t);
                return (
                  <li key={t} className="ras-slot" data-blocked={blocked}>
                    {timeLabel(t)}
                    <span className="sr-only">
                      {blocked ? " unavailable, no water" : " available"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="ras-slot-row">
            <p className="ras-slot-title">
              <Store className="h-4 w-4" aria-hidden />
              Studio bay · water on tap
            </p>
            <ul className="ras-slot-list">
              {SLOTS.map((t) => (
                <li key={t} className="ras-slot" data-blocked={false}>
                  {timeLabel(t)}
                  <span className="sr-only"> available</span>
                </li>
              ))}
            </ul>
          </div>

          <figcaption className="ras-muted pt-4 text-xs leading-relaxed">
            Example of the rule the live form applies. Struck-out times are unavailable for the van
            when there is no water on site.
          </figcaption>
        </figure>

        <ul className="ras-rule-list">
          {rules.map((rule) => (
            <li className="ras-rule" key={rule.title}>
              <span className="ras-step-icon" style={{ background: rule.color }}>
                <rule.icon className="h-5 w-5" aria-hidden />
              </span>

              <div>
                <h3 className="text-sm font-extrabold">{rule.title}</h3>
                <p className="ras-muted mt-1 text-sm leading-relaxed">{rule.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Transformation() {
  return (
    <section id="glow" className="ras-wrap ras-section ras-glow-grid" aria-labelledby="glow-title">
      <figure className="ras-panel ras-compare-frame">
        <BeforeAfter
          before="/samples/creta.jpg"
          after="/samples/creta-wrap.jpg"
          beforeLabel="Before"
          afterLabel="Signature Super Design"
        />
        <figcaption className="ras-muted px-1 pb-1 pt-3 text-xs leading-relaxed">
          Sample preview, not a customer result. Add a photo while booking to preview your own car
          with AI.
        </figcaption>
      </figure>

      <div>
        <p className="ras-eyebrow mb-3">The car gets a glow-up. Booking stays simple.</p>

        <h2 id="glow-title" className="ras-display ras-section-heading">
          Dirty to
          <br />
          <span style={{ color: "#a51e60" }}>dripping.</span>
        </h2>

        <p className="ras-muted mt-3 max-w-xl text-sm leading-relaxed">
          Drag the slider. Same car, new look.
        </p>
      </div>
    </section>
  );
}

function AfterBooking() {
  const steps = [
    {
      title: "Slot locked",
      text: "Pay the 30% deposit. A confirmation email brings your booking link.",
      icon: CalendarCheck,
      color: "var(--yellow)",
    },
    {
      title: "Quick confirmation call",
      text: "Rai's assistant rings you. Press 1 to confirm, 2 to change the time, 3 to change the plan.",
      icon: PhoneCall,
      color: "var(--mint)",
    },
    {
      title: "Change it yourself",
      text: "Reschedule free from your booking link until 12 hours before.",
      icon: RefreshCw,
      color: "var(--lilac)",
    },
    {
      title: "We turn up, you shine",
      text: "Visit the MG Marg studio or wait for the van. Pay the balance on the day.",
      icon: Truck,
      color: "var(--pink)",
    },
  ];

  return (
    <section id="how" className="ras-wrap ras-section ras-how-section" aria-labelledby="how-title">
      <p className="ras-eyebrow mb-3">After you book</p>

      <h2 id="how-title" className="ras-display ras-section-heading">
        What happens
        <br />
        next.
      </h2>

      <ol className="ras-how-grid">
        {steps.map((s, i) => (
          <li key={s.title} className="ras-how-card">
            <span className="ras-step-icon" style={{ background: s.color }}>
              <s.icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-extrabold">
                {i + 1}. {s.title}
              </h3>
              <p className="ras-muted mt-1 text-sm leading-relaxed">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: "Can I change my time?",
      a: "Yes. Use the booking link in your confirmation to reschedule for free until 12 hours before your slot.",
    },
    {
      q: "Do you come to me?",
      a: "Yes, in Gangtok. Choose Doorstep when booking, then pick MG Marg, Tadong, Deorali, Development Area or share your location. Signature Super Design happens in the studio over 2 days.",
    },
    {
      q: "What happens to my car photo?",
      a: "A photo is optional. It is used to preview how your car could look after the service. We blur the number plate when we detect one, and original photos stay private. AI previews are illustrative.",
    },
  ];

  return (
    <section id="faq" className="ras-wrap ras-section ras-faq-section" aria-labelledby="faq-title">
      <p className="ras-eyebrow mb-3">Quick answers</p>

      <h2 id="faq-title" className="ras-display ras-section-heading">
        Good to know.
      </h2>

      <div className="ras-faq-list">
        {items.map((item) => (
          <details key={item.q} className="ras-faq">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Behind() {
  return (
    <section className="ras-wrap ras-section" aria-labelledby="behind-title">
      <div className="ras-panel ras-behind">
        <div className="ras-behind-grid">
          <div>
            <p className="ras-eyebrow mb-2">Behind the booking desk</p>
            <h2 id="behind-title" className="ras-display text-3xl sm:text-4xl">
              One owner. Zero chasing.
            </h2>
          </div>

          <p className="text-sm leading-relaxed">
            Rai ran 1,500+ appointments out of a notebook. Now confirmations, reschedules and
            refilling cancelled slots run through the booking desk, so Rai spends the day on cars
            instead of on the phone. A 30% deposit keeps no-shows out of the diary.
          </p>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="ras-wrap" aria-labelledby="final-title">
      <div className="ras-panel ras-final">
        <div>
          <p className="ras-eyebrow mb-2">Ready when you are</p>
          <h2 id="final-title" className="ras-display text-3xl sm:text-5xl">
            Your car called.
            <br />
            It wants a glow-up.
          </h2>
        </div>

        <div className="ras-final-actions">
          <a href="#book" className="ras-btn" style={{ background: "#fff" }}>
            Book now
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noreferrer"
            className="ras-btn"
            style={{ background: "var(--lilac)" }}
          >
            <MapPin className="h-4 w-4" aria-hidden />
            Find the studio
          </a>
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
            <p className="ras-footer-note">
              MG Marg, Gangtok · Two studio bays and one doorstep van.
            </p>
          </div>

          <nav className="ras-footer-links" aria-label="Footer">
            <a href="#book">Prices &amp; booking</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            <Link to="/owner">
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Owner dashboard
            </Link>
            <a href={MAPS_URL} target="_blank" rel="noreferrer">
              <MapPin className="h-4 w-4" aria-hidden />
              Find us
            </a>
          </nav>
        </div>

        <p className="ras-footer-note">
          Demo build: checkout is simulated and no real money moves. AI previews are illustrative.
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        setBookingVisible(entry?.isIntersecting ?? false);
      },
      { threshold: 0 },
    );

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
        <Rules />
        <Transformation />
        <AfterBooking />
        <Faq />
        <Behind />
        <FinalCta />
      </main>
      <Footer />
      {!bookingVisible && (
        <div className="ras-mobile-cta">
          <a href="#book" className="ras-btn ras-btn-primary">
            Book now · from {inr(PLANS.wash.price)}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      )}
    </div>
  );
}
