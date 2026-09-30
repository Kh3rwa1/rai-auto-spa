import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronRight, Droplets, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingFlow } from "@/components/BookingFlow";
import { MOBILE_FEE, PLANS, inr, type PlanId } from "@/lib/plans";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rai's Auto Spa — Car Care on MG Marg, Gangtok" },
      {
        name: "description",
        content:
          "Wash, full detail or custom wrap in Gangtok — studio or doorstep, priced upfront. Book in five quick steps.",
      },
      {
        property: "og:title",
        content: "Rai's Auto Spa — Your car, cared for. Your booking, sorted.",
      },
      {
        property: "og:description",
        content:
          "Two-bay studio on MG Marg or mobile van to your doorstep. Clear prices, live slots.",
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
 * to water movement and a clean finish. Decorative only (aria-hidden).
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

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Droplets className="h-4.5 w-4.5" aria-hidden />
      </span>
      <span className="leading-none">
        <span className="block font-display text-lg font-bold tracking-tight">
          Rai&rsquo;s <span className="font-semibold text-primary">Auto Spa</span>
        </span>
        <span className="mt-1 block text-[11px] font-medium tracking-wide text-muted-foreground">
          MG Marg, Gangtok
        </span>
      </span>
    </span>
  );
}

const MAPS_URL = "https://maps.google.com/?q=MG+Marg+Gangtok+737101";

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
          <Button asChild size="sm" className="min-h-[44px] rounded-full font-semibold">
            <a href="#book">Book now</a>
          </Button>
        </nav>
      </div>
    </header>
  );
}

const ASSURANCES = ["2 studio bays", "1 mobile van", "No account needed"] as const;

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="bg-background">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-10 pt-28 sm:pt-32 md:grid-cols-[1.05fr_0.95fr] md:pb-14">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <WashLine className="text-primary" /> Car care · MG Marg, Gangtok
          </p>
          <h1
            id="hero-title"
            className="mt-3 font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl"
          >
            Your car, cared for.
            <span className="block">Your booking, sorted.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Wash, detail or custom wrap — studio or doorstep, priced upfront.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="min-h-[54px] rounded-full px-8 text-base font-bold"
            >
              <a href="#book">Book now</a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-[54px] rounded-full px-7 text-base font-semibold"
            >
              <a href="#services">Services &amp; prices</a>
            </Button>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            {ASSURANCES.map((a) => (
              <li key={a} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </div>
        <a
          href="#book"
          aria-label="Book now — Essential Wash, 499 rupees, 45 minutes"
          className="group relative block overflow-hidden rounded-3xl shadow-[var(--shadow-soft)]"
        >
          <img
            src={heroImg}
            alt="Freshly washed car at Rai's Auto Spa"
            fetchPriority="high"
            decoding="async"
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] md:aspect-[5/4]"
          />
          <span className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-2xl bg-charcoal/85 px-4 py-3 text-charcoal-foreground backdrop-blur">
            <span className="text-sm">
              <span className="block font-display text-base font-bold">
                Essential Wash · {inr(PLANS.wash.price)}
              </span>
              <span className="block text-xs opacity-75">45 min · studio or doorstep</span>
            </span>
            <span className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </span>
          </span>
        </a>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="scroll-mt-24 border-y border-border bg-card"
    >
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
        <h2
          id="services-title"
          className="font-display text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Services &amp; prices
        </h2>
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-3xl border border-border">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            return (
              <li key={id}>
                <a
                  href="#book"
                  aria-label={`${p.name}, ${inr(p.price)}, ${p.duration} — book now`}
                  className="group flex min-h-[64px] items-center justify-between gap-3 bg-background px-4 py-3 transition-colors hover:bg-accent/50 sm:px-6"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg font-bold tracking-tight">
                      {p.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">{p.duration}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-display text-xl font-bold tracking-tight">
                      {inr(p.price)}
                    </span>
                    <ChevronRight
                      className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Van adds {inr(MOBILE_FEE)} · 30% deposit secures your slot.
        </p>
      </div>
    </section>
  );
}

function BookingEntrance() {
  return (
    <section id="book" aria-labelledby="book-title" className="scroll-mt-20 bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-5 sm:py-14">
        <div className="mb-6 max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <WashLine className="text-primary" /> Booking
          </p>
          <h2
            id="book-title"
            className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Book in five quick steps.
          </h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Snap your car, pick a service, grab a slot — done.
          </p>
        </div>
        <BookingFlow />
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
        <Hero />
        <Services />
        <BookingEntrance />
      </main>
      <footer className="border-t border-border bg-charcoal py-8 text-charcoal-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-base font-bold">
            Rai&rsquo;s <span className="font-semibold text-teal">Auto Spa</span>
            <span className="ml-2 align-middle font-sans text-xs font-medium text-charcoal-foreground/60">
              MG Marg, Gangtok
            </span>
          </p>
          <nav aria-label="Footer" className="flex items-center gap-1 text-sm">
            <a
              href="#book"
              className="flex min-h-[44px] items-center rounded-full px-3 font-semibold hover:underline"
            >
              Book now
            </a>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-charcoal-foreground/70 hover:underline"
            >
              <MapPin className="h-4 w-4" aria-hidden /> Map
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
