import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookingFlow } from "@/components/BookingFlow";
import { DemoRibbon } from "@/components/DemoRibbon";
import { MOBILE_FEE, PLANS, inr, type PlanId } from "@/lib/plans";
import {
  DetailDoodle,
  HeroCar,
  OwnerDoodle,
  WrapDoodle,
  WashDoodle,
} from "@/components/landing/DoodleArt";
import {
  LandingMotion,
  setDoodlesPaused,
  useDoodlesPaused,
} from "@/components/landing/LandingMotion";
import "@/components/landing/landing.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rai's Auto Spa — Car Care Washbook, MG Marg Gangtok" },
      {
        name: "description",
        content:
          "A fictional Gangtok car-care studio: two wash bays, one mobile van, and one clear booking flow. Try the interactive challenge demo.",
      },
      { property: "og:title", content: "Rai's Auto Spa — Gangtok Washbook" },
      {
        property: "og:description",
        content:
          "Wash, full detail and custom wraps with honest prices and live slots — plus the owner's side of the day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Rai's Auto Spa — Gangtok Washbook" },
    ],
  }),
  component: Index,
});

function Wordmark() {
  return (
    <a
      href="#top"
      className="inline-flex min-h-[44px] items-center gap-2.5"
      aria-label="Rai's Auto Spa — back to top"
    >
      <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" focusable="false">
        <circle cx={9} cy={13} r={6} fill="none" stroke="#2b333c" strokeWidth={2.5} />
        <circle cx={22} cy={8} r={4} fill="none" stroke="#0d9488" strokeWidth={2.5} />
        <path
          d="M2,21 C10,17 20,17 32,21"
          fill="none"
          stroke="#2b333c"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
      <span className="leading-none">
        <span className="block font-display text-xl font-extrabold tracking-tight">
          Rai&rsquo;s Auto Spa
        </span>
        <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--wb-ink-soft)]">
          Gangtok washbook · MG Marg
        </span>
      </span>
    </a>
  );
}

function DoodleToggle() {
  const paused = useDoodlesPaused();
  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => setDoodlesPaused(!paused)}
      className="inline-flex min-h-[44px] items-center rounded-full border-2 border-[var(--wb-ink)] bg-[#fffdf7] px-4 text-sm font-bold"
    >
      {paused ? "Play doodles" : "Pause doodles"}
    </button>
  );
}

function Header() {
  return (
    <header className="border-b-2 border-[var(--wb-ink)] bg-[var(--wb-paper)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
        <Wordmark />
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1.5 text-sm">
          <a
            href="#services"
            className="inline-flex min-h-[44px] items-center rounded-full px-3 py-2 font-bold"
          >
            Services
          </a>
          <a
            href="#book"
            className="inline-flex min-h-[44px] items-center rounded-full px-3 py-2 font-bold"
          >
            Booking
          </a>
          <Link
            to="/owner"
            className="inline-flex min-h-[44px] items-center rounded-full px-3 py-2 font-bold"
          >
            Admin demo
          </Link>
          <DoodleToggle />
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="bg-[var(--wb-paper)]">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-10 sm:pt-14 md:grid-cols-[1.02fr_0.98fr]">
        <div>
          <p className="wb-tag">Rai&rsquo;s washbook · Gangtok</p>
          <h1
            id="hero-title"
            className="mt-3 font-display text-4xl font-extrabold leading-[1.04] sm:text-6xl"
          >
            Hill-road cars deserve a clear booking.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
            Rai&rsquo;s Auto Spa is a fictional Gangtok car-care studio: two wash bays on MG Marg,
            one mobile van for the hill colonies, and one booking flow with honest prices and live
            slots. This demo shows both sides — the customer booking and the owner&rsquo;s day.
          </p>
          <p
            role="note"
            className="mt-4 inline-block rounded-full border-2 border-[var(--wb-ink)] bg-[var(--wb-mint)] px-4 py-2 text-sm font-bold"
          >
            Challenge demo · Fictional business · No real charges
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="#book" className="wb-btn wb-btn-primary">
              Try a demo booking
            </a>
            <Link to="/owner" className="wb-btn wb-btn-quiet">
              Explore admin demo
            </Link>
          </div>
        </div>
        <LandingMotion art={<HeroCar />} animation="bubbles" />
      </div>
    </section>
  );
}

const FACTS = [
  { title: "2 wash bays", body: "Studio on MG Marg with visible slot availability." },
  { title: "1 mobile van", body: "Doorstep visits in Tadong, Deorali and Development Area." },
  {
    title: "Water-aware slots",
    body: "Municipal supply runs 6–9am; midday van slots need water on site.",
  },
] as const;

function Facts() {
  return (
    <section aria-label="How the studio operates" className="bg-[var(--wb-paper-deep)] py-3">
      <dl className="mx-auto grid max-w-6xl gap-3 px-5 py-6 sm:grid-cols-3">
        {FACTS.map((f, i) => (
          <div key={f.title} className="wb-card flex gap-3.5 p-5">
            <span className="wb-stepnum" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <dt className="font-display text-lg font-extrabold">{f.title}</dt>
              <dd className="mt-1 text-sm leading-relaxed">{f.body}</dd>
            </span>
          </div>
        ))}
      </dl>
    </section>
  );
}

const SERVICE_ART = { wash: WashDoodle, detail: DetailDoodle, signature: WrapDoodle } as const;
const SERVICE_ANIMATION = { wash: "bubbles", detail: "sparkles", signature: "route" } as const;

function Services() {
  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="scroll-mt-6 bg-[var(--wb-paper)]"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <p className="wb-tag">The washbook menu</p>
        <h2
          id="services-title"
          className="mt-2 max-w-xl font-display text-3xl font-extrabold sm:text-4xl"
        >
          Wash, detail, or full custom wrap
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            const Art = SERVICE_ART[id];
            return (
              <article
                key={id}
                aria-label={`${p.name}, ${inr(p.price)}, ${p.duration}`}
                className="wb-card flex flex-col p-6"
              >
                <LandingMotion art={<Art />} animation={SERVICE_ANIMATION[id]} />
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[var(--wb-ink-soft)]">
                  {p.badge}
                </p>
                <h3 className="mt-1 font-display text-xl font-extrabold">{p.name}</h3>
                <p className="mt-1.5 font-display text-3xl font-extrabold">
                  {inr(p.price)}
                  <span className="ml-2 align-middle font-sans text-sm font-semibold text-[var(--wb-ink-soft)]">
                    · {p.duration}
                  </span>
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {p.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="mt-5 text-sm">
          Mobile van adds {inr(MOBILE_FEE)}. A 30% deposit secures each slot at confirmation.
        </p>
        <p className="mt-2">
          <a href="#book" className="wb-link">
            See available slots below
          </a>
        </p>
      </div>
    </section>
  );
}

const HOW_STEPS = [
  { title: "Show your car", body: "One photo — or a sample car. The studio detects the model." },
  {
    title: "Pick service + slot",
    body: "Studio or van, with live availability and water rules built in.",
  },
  {
    title: "Confirm details",
    body: "Contact details plus a simulated deposit. Free reschedule till 12h before.",
  },
] as const;

function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="bg-[var(--wb-paper-deep)]">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
        <p className="wb-tag">How the booking works</p>
        <h2 id="how-title" className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
          Three moves, five guided steps
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed">
          The live booking below walks you through five guided steps. In short, it goes like this:
        </p>
        <ol className="mt-7 grid gap-4 md:grid-cols-3">
          {HOW_STEPS.map((s, i) => (
            <li key={s.title} className="wb-mintwash flex gap-3.5 p-5">
              <span className="wb-stepnum" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <h3 className="font-display text-lg font-extrabold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed">{s.body}</p>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function BookingEntrance() {
  return (
    <section id="book" aria-labelledby="book-title" className="scroll-mt-6 bg-[var(--wb-paper)]">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          <p className="wb-tag" style={{ justifyContent: "center" }}>
            The customer booking
          </p>
          <h2 id="book-title" className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
            Try the booking below
          </h2>
          <p className="mt-3 leading-relaxed">
            Use a sample car inside the booking flow. Please use fictional contact details.
          </p>
        </div>
        <div className="mx-auto max-w-4xl">
          <BookingFlow />
        </div>
      </div>
    </section>
  );
}

function OwnerContext() {
  return (
    <section
      aria-labelledby="owner-title"
      className="border-y-2 border-[var(--wb-ink)] bg-[var(--wb-paper-deep)]"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:py-20 md:grid-cols-[0.95fr_1.05fr]">
        <LandingMotion art={<OwnerDoodle />} animation="route" />
        <div>
          <p className="wb-tag">The owner&rsquo;s side</p>
          <h2 id="owner-title" className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
            One owner, two bays, one van
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed">
            Rai coordinates studio jobs, mobile visits and water-blocked slots from a single
            dashboard: today&rsquo;s route, the availability calendar, subscriptions, the waitlist,
            leads and wrap approvals. Open the guest admin demo to click through it — no sign-in
            needed.
          </p>
          <div className="mt-6">
            <Button asChild size="lg" className="min-h-[48px] rounded-full px-7 font-bold">
              <Link to="/owner">Explore admin demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[var(--wb-ink)] py-10 text-[#faf5ea]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-xl font-extrabold tracking-tight">Rai&rsquo;s Auto Spa</p>
          <p className="mt-1 text-sm opacity-75">MG Marg, Gangtok · Sikkim 737101</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-1 text-sm">
          <a href="#services" className="inline-flex min-h-[44px] items-center font-bold">
            Services
          </a>
          <a href="#book" className="inline-flex min-h-[44px] items-center font-bold">
            Booking
          </a>
          <Link to="/owner" className="inline-flex min-h-[44px] items-center font-bold">
            Admin demo
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-6 max-w-6xl px-5 text-xs opacity-60">
        Challenge demo · fictional business · no real charges.
      </p>
    </footer>
  );
}

function Index() {
  return (
    <div id="top" className="washbook min-h-screen">
      <a
        href="#book"
        className="sr-only z-50 rounded-full bg-[var(--color-primary)] px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to booking
      </a>
      <Header />
      <main>
        <Hero />
        <Facts />
        <Services />
        <HowItWorks />
        <BookingEntrance />
        <OwnerContext />
      </main>
      <Footer />
      <DemoRibbon />
    </div>
  );
}
