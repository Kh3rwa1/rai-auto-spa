# Wizard booking flow and surprise reveal

## What will change
- Keep the existing hero, services, and three plan designs intact.
- Turn the booking area into a five-step accordion wizard with only one step open at a time.
- Add a sticky progress strip showing Snap, Plan, Where & When, Preview, and Pay, with completed and current states.
- Automatically advance after a successful photo upload, plan selection, slot selection, and preview reveal. Completed steps stay editable through their compact summary.

## Surprise flow
- Selecting “Preview this” starts the existing preview and reveal-video work silently in the background, without notifications or progress copy.
- Keep Step 4 concealed until a slot is selected, showing a blurred car teaser and “Pick your slot in Step 3 to reveal your car ✨”.
- After slot selection, scroll to Step 4. If the preview is ready, reveal the before/after slider with a curtain wipe and confetti. Otherwise, show “Adding final shine...” with a shimmer for at least two seconds, then reveal when ready.

## Booking and payment
- Add a mobile sticky booking bar with the live plan, selected date/time, total, deposit, and Pay button.
- Enable payment only when the required photo, plan, location, slot, name, WhatsApp number, and email are complete. Studio bookings will not require a map pin; mobile bookings will.
- Keep the existing payment and confirmation behavior.

## Meet Rai
- Generate a Pixar-style 3D founder portrait matching the supplied description.
- Add a Meet Rai section between the hero/services area and “Book in 4 taps,” with the requested founder story: solo founder, MG Marg, 200+ cars, previously managed 1,500 bookings in a notebook.

## Validation
- Check the full wizard on desktop and mobile, including automatic transitions, surprise reveal, sticky payment bar, validation, and completed-step editing.
- Confirm the page builds cleanly and has no browser errors.
