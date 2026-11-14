import json, hashlib
from pathlib import Path
import argparse

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    raise SystemExit(
        "Install optional browser tooling: python3 -m pip install playwright; python3 -m playwright install chromium"
    )

parser = argparse.ArgumentParser(
    description="Check raw-map failure, empty-data and zoom-unmount behavior in a running build."
)
parser.add_argument("--base-url", default="http://127.0.0.1:4173")
parser.add_argument("--chromium", help="Optional existing Chromium executable")
args = parser.parse_args()
base = args.base_url.rstrip("/")
repo = Path(__file__).resolve().parents[1]
manifest_path = repo / "app/public/data/detection-review/v1/manifest.json"
manifest_original = json.loads(manifest_path.read_text())
first_date = manifest_original["start_date"]
expected = f"{manifest_original['sources']['viirs']['days'][0]['count']:,} detections"
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=args.chromium, headless=True, args=["--no-sandbox"]
    )
    context = browser.new_context(
        viewport={"width": 1280, "height": 1000}, ignore_https_errors=True
    )
    context.route(
        "**/data/v1/manifest.json",
        lambda route: route.fulfill(status=503, body="unavailable"),
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error.stack)))
    page.goto(base + "/?view=map", wait_until="domcontentloaded")
    page.locator(".review-summary").filter(has_text=expected).wait_for()
    results.append("Map remains usable when calendar manifest returns HTTP 503")
    if manifest_original.get("pantanal"):
        page.get_by_label("Geographic view", exact=True).select_option("pantanal")
        regional_count = manifest_original["pantanal"]["sources"]["viirs"]["days"][0][
            "count"
        ]
        page.locator(".review-summary").filter(
            has_text=f"{regional_count:,} detections"
        ).wait_for()
        page.get_by_role("button", name="Fit boundary", exact=True).click()
        page.locator(".leaflet-control-attribution").filter(
            has_text="IBGE 2025"
        ).wait_for()
        page.get_by_label("Geographic view", exact=True).select_option("brazil")
        page.locator(".review-summary").filter(has_text=expected).wait_for()
        page.wait_for_function(
            '!document.querySelector(".leaflet-control-attribution").textContent.includes("IBGE 2025")'
        )
        results.append(
            "Official regional selector loads the subset and removes the reference boundary on return to Brazil"
        )

    page.get_by_role("button", name="Calendar", exact=True).click()
    page.get_by_role("alert").filter(has_text="Unable to interpret the data").wait_for()
    page.get_by_role("button", name="Map", exact=True).click()
    page.locator(".review-summary").filter(has_text=expected).wait_for()
    page.route("https://gibs.earthdata.nasa.gov/**", lambda route: route.abort())
    for _ in range(2):
        page.get_by_label("Satellite context", exact=True).check()
        page.locator(".leaflet-control-attribution").filter(
            has_text="NASA GIBS"
        ).wait_for()
        page.get_by_label("Satellite context", exact=True).uncheck()
        page.wait_for_function(
            '!document.querySelector(".leaflet-control-attribution").textContent.includes("NASA GIBS")'
        )
    results.append(
        "Imagery toggles clean up source attribution without accumulating duplicates"
    )
    for _ in range(5):
        page.get_by_role("button", name="Zoom in", exact=True).click()
        page.get_by_role("button", name="Calendar", exact=True).click()
        page.get_by_role("button", name="Map", exact=True).click()
        page.locator(".review-summary").filter(has_text=expected).wait_for()
    assert not errors, errors
    results.append(
        "Repeated navigation during zoom/unmount produces no JavaScript errors"
    )
    context.close()
    context = browser.new_context(
        viewport={"width": 320, "height": 800}, ignore_https_errors=True
    )
    manifest = json.loads(manifest_path.read_text())
    manifest.pop("pantanal", None)
    data = json.dumps(
        {
            "schema_version": "detection-review/1.0.0",
            "source": "viirs",
            "date": first_date,
            "points": [],
        },
        separators=(",", ":"),
    )
    item = manifest["sources"]["viirs"]["days"][0]
    manifest["sources"]["viirs"]["record_count"] -= item["count"]
    item.update(
        count=0,
        bytes=len(data.encode()),
        sha256=hashlib.sha256(data.encode()).hexdigest(),
    )
    context.route(
        "**/data/detection-review/v1/manifest.json",
        lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(manifest)
        ),
    )
    context.route(
        f"**/data/detection-review/v1/viirs/{first_date}.json*",
        lambda route: route.fulfill(
            status=200, content_type="application/json", body=data
        ),
    )
    page = context.new_page()
    page.goto(base + "/?view=map", wait_until="domcontentloaded")
    page.get_by_text(
        "No detection records match these filters.", exact=False
    ).wait_for()
    assert page.get_by_role("button", name="Fit selected detections").is_disabled()
    assert page.locator(".review-cluster").count() == 0
    assert not page.evaluate("document.documentElement.scrollWidth>innerWidth")
    results.append(
        "Empty-record data at 320px shows the unknown-coverage notice with no stale markers or page overflow"
    )
    browser.close()
print(json.dumps(results, indent=2))
