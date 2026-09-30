import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplets, MapPin, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingFlow } from "@/components/BookingFlow";
import { DemoRibbon } from "@/components/DemoRibbon";
import { HeroMedia } from "@/components/HeroMedia";
import heroImg from "@/assets/hero.jpg";
import heroVideo from "@/assets/hero-video.mp4.asset.json";
import raiFounder from "@/assets/rai-founder.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rai's Auto Spa — Premium Car Wash & Super Design, Gangtok" },
      {
        name: "description",
        content:
          "Snap your car and see it shine with AI. Foam wash, full detail and custom wraps at MG Marg, Gangtok — or our van comes to you.",
      },
      { property: "og:title", content: "Rai's Auto Spa — From Boring to Beast" },
      {
        property: "og:description",
        content:
          "Premium car wash & super design studio in MG Marg, Gangtok. Instant AI previews, mobile van service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Rai's Auto Spa — From Boring to Beast" },
    ],
  }),
  component: Index,
});

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 rounded-full border border-border/60 bg-background/80 px-4 py-2 backdrop-blur-xl sm:px-6">
        <a href="#top" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Droplets className="h-4 w-4" aria-hidden />
          </span>
          <span className="hidden sm:inline">Rai's Auto Spa</span>
          <span className="sr-only sm:hidden">Rai's Auto Spa home</span>
        </a>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-4">
          <a href="#services" className="rounded-full px-3 py-1.5 hover:bg-muted">
            Services
          </a>
          <a
            href="https://maps.google.com/?q=MG+Marg+Gangtok+737101"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 rounded-full px-3 py-1.5 hover:bg-muted md:flex"
          >
            <MapPin className="h-4 w-4" aria-hidden /> MG Marg, Gangtok
          </a>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/owner">Owner Dashboard</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Index() {
  return (
    <div id="top" className="min-h-screen bg-background">
      <a href="#book" className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to booking
      </a>
      <Nav />
      <main>
      <section className="relative flex min-h-[92svh] items-end overflow-hidden">
        <HeroMedia poster={heroImg} video={heroVideo.url} />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/30 to-transparent" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-32 text-charcoal-foreground">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-background/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> AI-powered car spa · Gangtok
          </p>
          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[0.95] sm:text-7xl">
            RAI'S AUTO SPA
            <span className="block text-primary">From Boring to Beast</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg opacity-90 sm:text-xl">
            Snap your dirty car. See it shine or super-designed instantly with AI.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-14 rounded-full px-8 text-base shadow-[var(--shadow-glow)]"
          >
            <a href="#book"><span aria-hidden>📸</span> Snap Your Ride</a>
          </Button>
        </div>
      </section>

      <section id="services" aria-labelledby="services-title" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
        <h2 id="services-title" className="sr-only">Services</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Droplets,
              t: "Studio, 2 bays",
              d: "MG Marg, Gangtok. Drop in, sip a tea, drive out gleaming.",
            },
            {
              icon: Truck,
              t: "Van comes to you",
              d: "Tadong, Deorali, Development Area — water-aware scheduling around municipal supply.",
            },
            {
              icon: Sparkles,
              t: "Super design",
              d: "Full colour wraps and body kits, previewed on your own car with AI first.",
            },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="rounded-3xl bg-muted/60 p-6">
              <I className="h-6 w-6 text-primary" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold">{t}</h3>
              <p className="mt-1 text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-charcoal text-charcoal-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:py-20">
          <div className="overflow-hidden rounded-2xl">
            <img
              src={raiFounder}
              alt="Rai, founder of Rai's Auto Spa"
              loading="lazy"
              width={1200}
              height={1008}
              className="aspect-[6/5] w-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase text-teal">Meet Rai</p>
            <h2 className="mt-2 font-display text-4xl font-bold sm:text-5xl">
              One founder. 200+ cars transformed.
            </h2>
            <p className="mt-5 max-w-xl text-lg text-charcoal-foreground/75">
              Rai runs the studio at MG Marg herself. Before this booking system, she managed 1,500
              appointments in a notebook—one customer, one car, and one promise at a time.
            </p>
          </div>
        </div>
      </section>

      <section id="book" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-24 sm:px-5">
        <div className="mb-8 text-center">
          <h2 className="font-display text-4xl font-bold sm:text-5xl">Book in 4 taps</h2>
          <p className="mt-2 text-muted-foreground">Snap, preview, pick a slot, pay 30% deposit.</p>
        </div>
        <BookingFlow />
      </section>

      </main>
      <footer className="border-t border-border bg-charcoal py-10 text-charcoal-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 text-sm sm:flex-row sm:justify-between">
          <p className="font-display text-lg font-semibold">Rai's Auto Spa</p>
          <p className="opacity-70">
            Premium Car Wash & Super Design Studio · MG Marg, Gangtok, Sikkim 737101
          </p>
        </div>
      </footer>
      <DemoRibbon />
    </div>
  );
}
