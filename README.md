# Rai's Auto Spa — From Boring to Beast

**Snap your dirty car, see it shine with AI, book a bay or the van in four taps.**
A premium car wash and custom-wrap studio on MG Marg, Gangtok, run by one founder (Rai) with 2 studio bays and 1 mobile van. Before this, she ran 1,500 appointments from a notebook.

Live: https://rai-auto-spa.lovable.app · Owner dashboard: `/owner`

| Home | Booking wizard | Owner dashboard | Mobile |
|---|---|---|---|
| ![Home](docs/screenshots/home.png) | ![Booking](docs/screenshots/booking.png) | ![Owner](docs/screenshots/owner.png) | ![Mobile](docs/screenshots/mobile.png) |

## What it does

**Customer**
1. **Snap**: upload or take a photo, or use one of three sample cars. A vision model detects the car and the number plate, and the plate is pixelated before the photo is stored. The original stays private.
2. **Plan**: Essential Wash (Rs.499), Full Detail (Rs.1,999), or Signature Super Design (Rs.25,000, 2 days, AI colour change). Picking a plan quietly starts the AI "after" image and the reveal video in the background.
3. **Where & when**: studio (free, 2 bays) or van (+Rs.200, map pin). The grid handles water: without water on site, the van carries a tank (+Rs.150) and 11am–4pm is blocked. The grid refreshes live.
4. **Reveal**: once a slot is picked, a curtain-wipe before/after slider appears with confetti.
5. **Pay**: 30% deposit through a simulated checkout (UPI / Card / Netbanking, with a "Simulate failure" option). After paying you get calendar, WhatsApp and reschedule links (free until 12h before), plus an in-app preview of both emails. The finished reveal video is emailed automatically.

**Owner (`/owner`)**: an optimised van route with fuel and water stats (every formula shown in a tooltip), a calendar where you drag to block water shortages (bay/van use shown per slot), 40 daily-wash subscriptions (Skip / Pause / Change time, which update the route straight away), a waitlist with automatic backfill offers, leads, wrap approvals, and a gallery.

## 2-minute judge demo

1. Open `/`. In **Snap**, tap **Maruti Swift** under "Try with a sample car". The car is detected and the plate blurred.
2. Pick **Full Detail**. Choose **Come to Studio** and tap any free slot to see the reveal.
3. Enter a name, `+91 98320 12345` and your email. Tap **Pay**, tick **Simulate failure** once to see the retry, then pay for real (demo).
4. On **You're Booked**, tap **Preview your emails**.
5. Open `/owner` and tap **Reset demo data** (under 5s). Walk through **Route**, then **Calendar** (drag a few cells to block them; back on `/` the slots disappear within 10s), then **Waitlist** (cancel a booking to see up to 3 offers; open two claim links at once and exactly one wins).

## Architecture

```text
TanStack Start (React 19, SSR) ── server functions ──> Lovable Cloud (Postgres + Storage)
  src/components/booking/*   one component per wizard step, state in useBookingDraft (reducer)
  src/lib/booking-rules.ts   pure rules: pay gate, slot availability, dates (unit-tested)
  src/lib/booking.functions  upload/validate/blur, previews, slots, confirm, simulatePayment
  src/lib/owner.functions    all owner reads/writes, gated by DEMO_MODE or admin role
  book_slot() (SQL)          atomic booking: advisory lock, IST past check, slot list,
                             blocked slots, dry window, capacity (2 bays / 1 van), 2-day Signature
  Lovable AI Gateway         vision (car + plate box), image edit (preview), video (reveal)
  Lovable Emails             booking confirmation + reveal video from notify.tinytales.tech
  pg_cron 06:00 IST          materialises today's subscription visits
```

Private media is served only through short-lived signed URLs. `deposit_paid` can only be set by `simulatePayment` (enforced by a database trigger).

## Demo mode (intentional)

`DEMO_MODE = true` in `src/lib/owner.functions.ts`:
- **Payments are simulated** and labelled "Demo payment - no real money". Payment rows are stored with `demo = true`.
- **`/owner` is open to guests** so judges can try it. Setting `DEMO_MODE = false` requires the `admin` role (via the `user_roles` table and `has_role()`).
- **AI usage is not rate-limited.**
- **Reset demo data** reseeds with idempotent seed data using dates relative to today in India time. It also runs automatically when there are no upcoming bookings.

Sender identity and the GitHub link live in `src/lib/brand.ts`.

## Development

```bash
bun install
bun run dev          # http://localhost:8080
bun run lint         # eslint + prettier, zero warnings
bun run test         # 27 vitest tests (unit + book_slot integration against the backend)
bun run test:e2e     # Playwright smoke: full booking with a sample car
```

The `book_slot` integration tests use dates 400+ days out and delete everything they create. They are skipped when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are not set.

## Accessibility & performance

- Skip link, landmarks and a correct heading order.
- The before/after slider works with the keyboard (arrow keys, `role="slider"`).
- Labelled step accordion with `aria-expanded` and `aria-current` progress.
- Checkout dialog with focus management and Escape to close.
- Live regions for upload, reveal and payment status.
- `prefers-reduced-motion` turns off confetti, the curtain wipe and the hero video.
- Contrast meets WCAG AA.
- The hero poster paints first. The 11 MB loop loads after hydration and is skipped with data-saver on. Images below the fold are lazy-loaded.
