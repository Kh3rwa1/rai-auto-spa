# Rai's Auto Studio

Build Rai's Auto Spa - Premium Car Wash & Super Design Studio, MG Marg, Gangtok, Sikkim 737101.

BRAND:
Owner is Rai, solo female founder, 1 studio with 2 bays + 1 mobile van. Brand is 3M Car Care x Apple x Glossier. Colors: Premium white #FFFFFF, deep charcoal #111827, teal accent #0D9488, electric blue #2563EB for Signature plan. Font: Inter + Outfit. Mobile-first, super polished, no fake buttons. All functional end-to-end.

HERO SECTION - VIDEO INSPIRED:
Full-width hero with looping video background. First frame is: 3 cars (black, red, white) hanging on a rope clothesline over bright blue water splash, water droplets frozen in air, like laundry. Playful but premium. Headline over video: "RAI'S AUTO SPA - From Boring to Beast" Sub: "Snap your dirty car. See it shine or super-designed instantly with AI." CTA button: "📸 Snap Your Ride" - scrolls to booking. Top nav: Logo, Services, Location: MG Marg Gangtok, Owner Dashboard button.

BOOKING FLOW - SINGLE PAGE APP / (THIS IS THE CORE):
Step 1 - CAPTURE:
Big camera card: "Snap your dirty / boring car" - Allow camera capture or upload. Accept 1 image. After upload, detect vehicle type automatically (show tag: "Detected: Swift") and store image.

Step 2 - SELECT 3 PLANS (NO BIKE):
Show 3 cards in grid, middle popular:
- Card 1: Essential Wash - Rs.499 - 45min - Foam wash, tyre black, wet look - Badge: Quick
- Card 2: Full Detail - Rs.1,999 - 120min - Interior vacuum + Exterior detail + Dashboard shine + Ceramic spray - Badge: Most Popular, highlighted with teal border
- Card 3: Signature Super Design - Rs.25,000 - 2 days - Full Colour Wrap + Custom Body Kit + Ceramic + Design Consultation - Badge: Rai's Signature, dark background, electric blue accent, "AI Colour Change"

When user taps a card, trigger AI INSTANT PREVIEW:
Use fal.ai Flux Pro image-to-image with same angle/background preservation.
- If Essential Wash: Prompt = "Transform this exact car from the input photo into freshly foam washed, wet look, tyre black, remove all dirt and dust, same exact angle, same parking background, same number plate blurred, photorealistic, studio light, showroom wet shine"
- If Full Detail: Prompt = "Same exact car, deep interior and exterior detailed, vacuumed seats, dashboard shine, paint glossy showroom condition, same angle and background, photorealistic"
- If Signature Super Design: First show colour picker (Electric Blue, Matte Black, Racing Red, Chameleon Purple, Pearl White) + Style picker (Racing Stripes, Blacked Out, Carbon Hood, Lowered Sporty). Then prompt = "Transform this exact car into custom wrapped super design with [selected colour] metallic wrap, [selected style], blacked out rims, lowered stance, aggressive sporty body kit, ceramic mirror gloss, same angle and background, photorealistic, premium customization"

Show result as draggable Before/After slider with labels "Your Car Now" vs "After Rai's [Plan Name]". Show slider instantly (cache). Keep number plate blurred.

Step 3 - LOCATION + TIME (HYBRID MODEL):
Toggle:
○ Come to Studio, MG Marg, Gangtok (Free, 2 bays)
● We Come To You +Rs.200 (Mobile Van)
If Mobile selected, show:
- Map pin picker (Google Maps style) + Text: Building / Apartment Name + Floor + Parking slot + Checkbox: Guard permission taken? + Checkbox: Water available? (Important: Gangtok municipal water only 6-9am. If user books 11am-4pm and checks Water NOT available, block slot and show "Water needed, pick morning or provide water")
If Studio selected, just show bay availability.

Below that, Calendar:
Week view, water-aware: Block 11am-4pm slots if water not available. Show prime slots 7-10am and 5-7pm in teal. Show other slots greyed. Show travel time if mobile and clustered. Show dynamic price total = Plan + Mobile fee + Water fee if needed.

Step 4 - PAY & CONFIRM:
Show summary: Plan, Vehicle, Location, Time, Total, Deposit 30% to confirm. Mock Razorpay/UPI button "Pay Rs.[deposit] Deposit". On pay, show full-screen "You're Booked 🔥" with confetti, Add to Google Calendar button, WhatsApp confirmation preview, Reschedule link (free till 12h before), and before/after image.

Step 5 - BACKGROUND VIDEO GENERATION + EMAIL (THE WOW):
After payment, in background trigger fal.ai Luma Dream Machine image-to-video using the CLEAN preview as input.
- Wash: Prompt "Cinematic 6s slow dolly, foam dripping, water beading on glossy paint, professional car commercial"
- Detail: Prompt "Cinematic interior + exterior spin, light gliding over glossy paint, 6s"
- Super Design: Prompt "Cinematic 6s, car colour shifting from old to new electric blue with black stripes, slow spin, dramatic studio light, water beading, supercar reveal"
When video ready, mock send email via Resend UI + WhatsApp: Subject "Your [Car Model] is ready to shine tomorrow 8am - Rai's Auto Spa" Body: Booking details + Embedded video player + Map link + "Rai is coming". Show status in UI "Video sent to email".

OWNER DASHBOARD /owner - PROTECTED:
Top stats: Today's bookings, Total KM today, Fuel saved by clustering, Revenue at risk (bookings without deposit), Water needed (liters).
- Today's Route Map: Leaflet map with pins clustered by area Tadong/MG Marg/Deorali, optimized route line, total KM.
- Calendar Week: Drag to block water shortage time, see bays.
- Subscription Manager: Table of 40 daily wash customers with Skip Today / Change Time / Pause buttons. Shows 1500 appointments/mo handled automatically.
- Waitlist Auto-Backfill: If someone cancels, show "Auto-offering to 3 waitlisted in same area" with WhatsApp template.
- Leads Inbox: Abandoned photo uploads without payment, one-click "Send Payment Link"
- Wrap Approvals: For Signature plan, show customer uploaded car + AI design + colour + Approve / Request Change
- Gallery: Before/After and videos sent.

DATABASE - SUPABASE:
Tables: clients (name, phone, building, floor, water_access), bookings (id, client_id, vehicle_model, photo_url, clean_preview_url, video_url, plan, colour, style, location_type, map_pin, guard_permission, water_needed, date, time, total, deposit_paid, status), subscriptions (client_id, plan, active, skip_dates), waitlist (client_id, area, date). Seed with 40 daily wash clients in Gangtok + 5 upcoming bookings + 2 wrap consultations.

POLISH REQUIREMENTS:
- No lorem ipsum. Real car names: Swift, Baleno, Thar, Innova, Creta.
- Real Gangtok areas: Tadong, MG Marg, Deorali, Development Area.
- Loading states for AI preview: "Rai is shining your car..."
- Before/After slider component, not two images.
- Mobile responsive, fast.
- Make project Public.

Make everything functional. No dead buttons.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rai-auto-spa.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/efd09a7d-5092-4436-bb28-0d10d77cc064).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
