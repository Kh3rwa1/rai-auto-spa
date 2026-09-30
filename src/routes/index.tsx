import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplets, MapPin, Sparkles, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingFlow } from "@/components/BookingFlow";
import { DemoRibbon } from "@/components/DemoRibbon";
import { HeroMedia } from "@/components/HeroMedia";
import { MOBILE_FEE, PLANS, inr, type PlanId } from "@/lib/plans";
import heroImg from "@/assets/hero.jpg";
import heroVideo from "@/assets/hero-video.mp4.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rai's Auto Spa — Car Care on MG Marg, Gangtok" },
      {
        name: "description",
        content:
          "Studio and doorstep car care in Gangtok with clear choices, transparent pricing, and availability-aware booking. Try the interactive demo — no real charges.",
      },
      {
        property: "og:title",
        content: "Rai's Auto Spa — Your car, cared for. Your booking, sorted.",
      },
      {
        property: "og:description",
        content:
          "Choose a wash, a full detail, or a custom wrap. Two-bay studio on MG Marg or mobile van to your doorstep.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Rai's Auto Spa — MG Marg, Gangtok" },
    ],
  }),
  component: Index,
});

/**
 * "The wash line" — the single signature motif: one quiet wave, a reference
 * to water movement and a clean finish. Decorative only (aria-hidden),
 * used in exactly three places: hero eyebrow, booking eyebrow, footer.
 */
function WashLine({ className = "" }: { className?: string }) {
  return (
    <svg
      width="30"
      height="8"
      viewBox="0 0 30 8"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M1.5 5.5C7 2.5 12.5 2.5 18 5.5C21 6.8 24 6.8 28.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Droplets className="h-4.5 w-4.5" aria-hidden />
      </span>
      <span className="leading-none">
        <span className="block font-display text-lg font-bold tracking-tight">
          Rai&rsquo;s <span className="font-semibold text-primary">Auto Spa</span>
        </span>
        <span
          className={`mt-1 block text-[11px] font-medium tracking-wide ${dark ? "text-charcoal-foreground/70" : "text-muted-foreground"}`}
        >
          MG Marg, Gangtok
        </span>
      </span>
    </span>
  );
}

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 rounded-full border border-border/60 bg-background/85 py-2 pl-4 pr-2 backdrop-blur-xl sm:px-5">
        <a href="#top" aria-label="Rai's Auto Spa — back to top">
          <Wordmark />
        </a>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
          <a
            href="#services"
            className="hidden min-h-[44px] items-center rounded-full px-3 py-2 font-medium hover:bg-muted sm:flex"
          >
            Services
          </a>
          <a
            href="https://maps.google.com/?q=MG+Marg+Gangtok+737101"
            target="_blank"
            rel="noreferrer"
            className="hidden min-h-[44px] items-center gap-1 rounded-full px-3 py-2 font-medium hover:bg-muted md:flex"
          >
            <MapPin className="h-4 w-4" aria-hidden /> MG Marg
          </a>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="min-h-[44px] rounded-full font-semibold"
          >
            <Link to="/owner">Explore admin demo</Link>
          </Button>
          <Button asChild size="sm" className="min-h-[44px] rounded-full font-semibold">
            <a href="#book">Try a sample booking</a>
          </Button>
        </nav>
      </div>
    </header>
  );
}

const FACTS = [
  {
    icon: Store,
    title: "2-bay studio",
    body: "Drop off at MG Marg, Gangtok — two bays, clear slot availability.",
  },
  {
    icon: Truck,
    title: "1 mobile van",
    body: "Doorstep service in Tadong, Deorali and Development Area.",
  },
  {
    icon: Droplets,
    title: "Water-aware slots",
    body: "Municipal supply runs 6–9am. Midday van visits need water on site.",
  },
] as const;

function Facts() {
  return (
    <section aria-label="How Rai's Auto Spa operates" className="border-b border-border bg-card">
      <dl className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3 sm:py-12">
        {FACTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
            </span>
            <span>
              <dt className="font-display text-lg font-bold tracking-tight">{title}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</dd>
            </span>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Services() {
  return (
    <section id="services" aria-labelledby="services-title" className="scroll-mt-24 bg-background">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          What you can book
        </p>
        <h2
          id="services-title"
          className="mt-2 max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Three services, honest prices
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            return (
              <a
                key={id}
                href="#book"
                aria-label={`${p.name}, ${inr(p.price)}, ${p.duration} — start booking`}
                className="group flex flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-glow)]"
              >
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {p.badge}
                </span>
                <span className="mt-1.5 font-display text-xl font-bold tracking-tight">
                  {p.name}
                </span>
                <span className="mt-2 font-display text-3xl font-bold tracking-tight">
                  {inr(p.price)}
                  <span className="ml-2 align-middle font-sans text-sm font-medium text-muted-foreground">
                    · {p.duration}
                  </span>
                </span>
                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {p.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 inline-flex min-h-[44px] items-center text-sm font-bold text-primary">
                  Start booking
                  <span aria-hidden className="ml-1 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </a>
            );
          })}
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          Mobile van adds {inr(MOBILE_FEE)}. A 30% demo deposit is taken at confirmation —
          simulated, no real charge.
        </p>
      </div>
    </section>
  );
}

function BookingEntrance() {
  return (
    <section id="book" aria-labelledby="book-title" className="scroll-mt-20 bg-muted/50">
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-5 sm:py-20">
        <div className="mb-8 max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <WashLine className="text-primary" /> Try the customer experience
          </p>
          <h2
            id="book-title"
            className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Choose your service. Find your slot.
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Start with a sample car or your own photo. Choose studio or doorstep service, then
            complete a simulated booking.
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-electric" aria-hidden />
            <span>
              <strong className="font-semibold text-foreground">
                Preview the look before you book
              </strong>{" "}
              — your AI preview can finish while you continue.
            </span>
          </p>
        </div>
        <BookingFlow />
      </div>
    </section>
  );
}

const BEFORE_STEPS = ["Inquiry", "service questions", "availability messages", "booking details"];
const WITH_STEPS = ["Service selection", "available slot", "details", "simulated confirmation"];

function ClientBrief() {
  return (
    <section
      aria-labelledby="brief-title"
      className="border-y border-border bg-charcoal text-charcoal-foreground"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-teal">
          <WashLine className="text-teal" /> The client brief
        </p>
        <h2
          id="brief-title"
          className="mt-2 max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl"
        >
          One owner. Two bays. One van.
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-charcoal-foreground/80">
          Rai&rsquo;s Auto Spa is our hypothetical Gangtok client: a solo owner coordinating studio
          jobs, mobile visits, and appointments affected by water access. This build brings service
          selection, availability, and booking details into one customer flow, with an owner
          dashboard for follow-through.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-charcoal-foreground/10 p-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-charcoal-foreground/60">
              Before
            </h3>
            <ol className="mt-3 space-y-2 text-sm">
              {BEFORE_STEPS.map((s, i) => (
                <li key={s} className="flex items-baseline gap-2.5">
                  <span aria-hidden className="font-display font-bold text-charcoal-foreground/40">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl bg-primary/25 p-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-teal">
              With this demo
            </h3>
            <ol className="mt-3 space-y-2 text-sm">
              {WITH_STEPS.map((s, i) => (
                <li key={s} className="flex items-baseline gap-2.5">
                  <span aria-hidden className="font-display font-bold text-teal">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function Index() {
  return (
    <div id="top" className="min-h-screen bg-background">
      <a
        href="#book"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to booking
      </a>
      <Nav />
      <main>
        <section
          aria-labelledby="hero-title"
          className="relative flex min-h-[82svh] items-end overflow-hidden"
        >
          <HeroMedia poster={heroImg} video={heroVideo.url} />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/95 via-charcoal/45 to-charcoal/10" />
          <div className="relative mx-auto w-full max-w-6xl px-5 pb-14 pt-36 text-charcoal-foreground sm:pb-20">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-teal">
              <WashLine className="text-teal" /> Car care on MG Marg, Gangtok
            </p>
            <h1
              id="hero-title"
              className="mt-3 max-w-2xl font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl"
            >
              Your car, cared for.
              <span className="block">Your booking, sorted.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-charcoal-foreground/85 sm:text-lg">
              Choose a wash, a full detail, or a custom wrap. Visit our two-bay studio or book the
              mobile van to your doorstep— with prices and available slots in one booking flow.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="min-h-[56px] rounded-full px-8 text-base font-bold shadow-[var(--shadow-glow)]"
              >
                <a href="#book">Try a sample booking</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-[56px] rounded-full border-charcoal-foreground/30 bg-transparent px-8 text-base font-semibold text-charcoal-foreground hover:bg-charcoal-foreground/10 hover:text-charcoal-foreground"
              >
                <Link to="/owner">Explore admin demo</Link>
              </Button>
            </div>
            <p className="mt-4 inline-block rounded-full bg-charcoal-foreground/15 px-4 py-2 text-sm font-semibold text-charcoal-foreground backdrop-blur">
              Interactive challenge demo · No real charges · No personal details needed
            </p>
          </div>
        </section>

        <Facts />
        <Services />
        <BookingEntrance />
        <ClientBrief />
      </main>
      <footer className="bg-charcoal py-12 text-charcoal-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Wordmark dark />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-charcoal-foreground/70">
              Studio and doorstep car care with clear choices, transparent pricing, and
              availability-aware booking.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-1 text-sm">
            <a
              href="#book"
              className="flex min-h-[44px] items-center font-semibold hover:underline"
            >
              Try a sample booking
            </a>
            <a
              href="#services"
              className="flex min-h-[44px] items-center text-charcoal-foreground/70 hover:underline"
            >
              Services and prices
            </a>
            <Link
              to="/owner"
              className="flex min-h-[44px] items-center text-charcoal-foreground/70 hover:underline"
            >
              Explore admin demo
            </Link>
          </nav>
          <div className="sm:text-right">
            <WashLine className="text-teal sm:ml-auto" />
            <p className="mt-2 text-sm text-charcoal-foreground/70">
              MG Marg, Gangtok, Sikkim 737101
            </p>
            <p className="mt-1 text-xs text-charcoal-foreground/50">
              Challenge demo · Simulated payments only
            </p>
          </div>
        </div>
      </footer>
      <DemoRibbon />
    </div>
  );
}
