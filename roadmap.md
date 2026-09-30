# Roadmap — challenge hardening (demo mode)

- [x] Phase 1: book_slot (advisory lock, IST past check, slot list, blocked, dry window, capacity, 2-day Signature), confirm/reschedule use it, manage_token, slot-full recovery
- [x] Phase 1 follow-up: concurrent race test
- [x] Phase 2: payments table + simulatePayment, checkout sequence + failure toggle, /pay deep link, real revenue at risk
- [x] Phase 3: owner.functions.ts, DEMO_MODE, drop claim_owner + anon storage read, seed_demo + reset button, tooltip
- [x] Phase 4 automation
- [x] Phase 5: real plate blur, upload validation
- [x] Phase 6 (GitHub link is a placeholder until a repo is connected)
- [x] Phase 7: BookingFlow split, eslint clean
- [ ] Phase 7 follow-up: split OwnerDashboard.tsx (867) and booking.functions.ts (618) under 300 lines
- [x] Phase 8: 27 vitest tests + Playwright smoke (tests/e2e/smoke.py)
- [x] Phase 9: a11y, performance, favicon/OG, README

## Close-out (10 items)
- [x] 1 book_slot p_status + un-confirmed race test (28 vitest tests)
- [x] 2 README: pitch, Mermaid diagram, judge click-path, DEMO_MODE, "Simulated on purpose", tests, live URL
- [x] 3 BRAND.githubUrl -> github.com/Kh3rwa1/rai-auto-spa
- [ ] 4 Remove drizzle — SKIPPED: the Lovable migration tool authors/applies drizzle/migrations via drizzle-kit; removing it breaks all future schema changes
- [x] 5 resetDemo confirm dialog + 60s cooldown + is_seed-only deletes
- [x] 6 createPaymentLink uses ownerDb() + server-derived origin
- [x] 7 run-schedule: cron secret only; claimed offers get manage_token + pending_deposit
- [x] 8 BeforeAfter Home/End/PageUp/PageDown + reduced motion; CaptureStep real plate status
- [x] 9 tests/e2e/smoke.spec.ts (@playwright/test) replaces smoke.py; .github/workflows/ci.yml; "integration tests SKIPPED: no service key"
- [x] 10 email registry verified: booking-confirmation + reveal-video
