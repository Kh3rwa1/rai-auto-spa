<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Start one reveal-video job immediately after the selected plan's preview is created, then reuse it at confirmation to avoid duplicate AI jobs.
- Keep booking progression as a single-open-step wizard; plan selection starts AI silently and the visual reveal waits for slot selection.
- Booking wizard state lives in `useBookingDraft` (reducer) with one component per step under src/components/booking/ — keeps each step small and testable.
- Pure booking rules (pay gate, slot availability, dates) live in src/lib/booking-rules.ts — shared by UI, owner dashboard and unit tests.
- Brand/sender identity and the GitHub link live only in src/lib/brand.ts — one place to rebrand.
- Voice booking (Deepgram): hero mascot taps fire `rai-voice:start`; the loop mic→STT→LLM intent→TTS lives in src/components/voice/, endpoints under src/routes/api/voice/ proxy Deepgram + the AI gateway server-side. Requires the `DEEPGRAM_API_KEY` secret.
- Tests: `bun run test` (vitest; book_slot integration runs against the live backend with far-future dates and cleans up), `bun run test:e2e` (Playwright sample-car smoke).
