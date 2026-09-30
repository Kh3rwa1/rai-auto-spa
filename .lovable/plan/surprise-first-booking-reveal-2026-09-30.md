# Surprise-first booking reveal

## Changes
- Keep AI work silent after plan selection: remove preview-generation and background-rendering messages.
- Generate the clean preview first, then immediately start its matching reveal-video job before payment.
- Reuse that early video job at confirmation instead of starting a duplicate.
- Remove the before/after comparison from the booking-confirmed screen; show the video only when ready.
- Remove preview images from customer emails so the reveal email contains only the video action.

## Technical details
- Store the early video job on the existing booking record and preserve the current polling/storage/email flow.
- If early video creation fails, keep the preview and booking usable; confirmation can retry video creation once.
- Keep Signature plan generation tied to the selected colour and style after the existing short settle delay.

## Verification
- Check the booking flow at desktop and mobile sizes.
- Confirm there are no preview/rendering messages, no confirmed-page comparison, and no preview image in either email template.
- Confirm the project builds cleanly.
