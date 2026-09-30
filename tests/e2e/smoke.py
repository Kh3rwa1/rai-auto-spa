"""Smoke test: full booking with a sample car only (demo payment), then the in-app email preview.
Usage: python3 tests/e2e/smoke.py [base_url]   (default http://localhost:8080)"""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
OUT = Path("/tmp/browser/smoke"); OUT.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await b.new_page(viewport={"width": 1280, "height": 1800})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE + "/#book", wait_until="networkidle")
        await page.get_by_role("button", name="Maruti Swift").click()
        await expect(page.get_by_text("Pick your plan")).to_be_visible()
        await expect(page.locator("#step-2-body")).to_be_visible(timeout=60000)
        await page.locator("#step-2-body").get_by_role("button", name="Essential Wash").click()
        await page.get_by_role("radio", name="Come to Studio").click()
        await page.get_by_role("button", name="Next →").click()  # next week: never past, rarely full
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)
        slot = page.locator("#step-3-body button[aria-pressed='false']:not([disabled])").filter(has_text=":00").first
        await slot.click()
        await page.get_by_role("button", name="Pay & confirm").click()
        await page.get_by_label("Your name").fill("Smoke Test")
        await page.get_by_label("WhatsApp number").fill("+91 98320 12345")
        await page.get_by_label("Email (for your reveal video)").fill("smoke@example.com")
        await page.locator("#step-5-body").get_by_role("button", name="Deposit").click()
        await expect(page.get_by_text("Demo payment - no real money").first).to_be_visible()
        await page.get_by_role("dialog").get_by_role("button", name="Pay Rs.").click()
        await expect(page.get_by_role("heading", name="You're Booked")).to_be_visible(timeout=60000)
        await page.screenshot(path=str(OUT / "booked.png"))
        await page.get_by_role("button", name="Preview your emails").click()
        await expect(page.locator("iframe")).to_be_visible(timeout=30000)
        await page.screenshot(path=str(OUT / "email.png"))
        await b.close()
        assert not errors, errors
        print("SMOKE OK")

asyncio.run(main())
