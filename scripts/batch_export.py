#!/usr/bin/env python3
"""Batch-export every Presenta project to PDF and/or PPTX.

Presenta's export (src/lib/exportDeck.ts) runs entirely in the browser — it
rasterizes each slide with html-to-image and assembles the images with
jsPDF/pptxgenjs, then triggers a browser download. There is no server API for
it, so this script drives a real Chrome browser (Selenium) against a locally
running copy of the app: for each project it opens the editor, clicks the
Export menu, and waits for the file to land in --out.

Usage:
    pip install -r scripts/requirements-batch-export.txt
    python scripts/batch_export.py --port 3001 --out ./exports --format both

IMPORTANT — this runs a PRODUCTION build (`next build` + `next start`), not
`next dev`. That's not just a style choice: a real headless (and even
headed) Chrome, driven by Selenium, was found to crash outright ("tab
crashed") on this app's *dev*-mode Turbopack bundle — reproducibly, on every
single page including the plain home page — while the exact same pages load
fine once served from a production build. The dev bundle is much heavier
(eval-based module wrapping, an HMR client that keeps trying to open a
WebSocket) and something in that combination trips a real Chrome engine bug
on at least one tested machine. Production mode sidesteps it entirely, and
is the right way to drive this kind of automation regardless. Building takes
only a few seconds for this app, so this happens on every run rather than
trying to detect whether a good build already exists.

If --port is already serving this app, this script reuses it as-is (assumed
to already be safe/production-like) instead of building again. Otherwise it
runs `npm run build` then starts `npm run start` on --port, and shuts that
server down when done.

The project list itself is fetched directly from Supabase's REST API (using
the same URL/anon key the app reads from .env.local) rather than by scraping
the home page — simpler and one less thing that depends on the browser.
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print(
        "Missing dependencies. Install them first:\n"
        "  pip install -r scripts/requirements-batch-export.txt",
        file=sys.stderr,
    )
    raise

REPO_ROOT = Path(__file__).resolve().parent.parent

# Windows terminals often default stdout/stderr to cp1252, which can't encode
# the ✓/✗/…/→ used below — replace instead of crashing mid-export.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(errors="replace")


def is_presenta_running(port: int) -> bool:
    """True if something on this port is already serving THIS app (not just
    any process) — checked by content, not just a successful connection, so
    we never assume an unrelated server is safe to reuse."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2) as res:
            body = res.read(4096).decode("utf-8", errors="ignore")
            return "Presenta" in body
    except Exception:
        return False


def wait_for_server(port: int, timeout: float = 60.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if is_presenta_running(port):
            return True
        time.sleep(1)
    return False


def run_command(args: list[str], extra_env: dict | None = None, timeout: float | None = None) -> tuple[int, str]:
    """Runs a one-shot command to completion and returns (exit_code, output)."""
    import os

    full_env = {**os.environ, **(extra_env or {})}
    command = " ".join(args) if sys.platform == "win32" else args
    proc = subprocess.run(
        command,
        cwd=str(REPO_ROOT),
        env=full_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=(sys.platform == "win32"),
        timeout=timeout,
    )
    return proc.returncode, proc.stdout


def stop_process_tree(proc: subprocess.Popen) -> None:
    """Stops the server and its children. On Windows, shell=True spawns
    cmd.exe -> npm.cmd -> node, and Popen.terminate() only kills the cmd.exe
    wrapper — the actual `next start` node process survives as an orphan,
    still holding the port. taskkill /T kills the whole tree."""
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


def build_app() -> bool:
    print("Building a production bundle (npm run build) …")
    code, output = run_command(["npm", "run", "build"], timeout=600)
    if code != 0:
        print("Build failed:", file=sys.stderr)
        print(output[-4000:], file=sys.stderr)
        return False
    return True


def start_prod_server(port: int) -> subprocess.Popen:
    """Starts `npm run start` (production) with PORT set. On Windows, `npm`
    resolves to npm.cmd, which CreateProcess can't launch directly — needs
    shell=True, and shell=True wants a single command string, not an argv
    list (a list gets mis-quoted and silently does nothing useful)."""
    print(f"Starting production server on port {port} …")
    import os

    full_env = {**os.environ, "PORT": str(port)}
    command = "npm run start" if sys.platform == "win32" else ["npm", "run", "start"]
    proc = subprocess.Popen(
        command,
        cwd=str(REPO_ROOT),
        env=full_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=(sys.platform == "win32"),
    )
    return proc


def make_driver(download_dir: Path) -> "webdriver.Chrome":
    download_dir.mkdir(parents=True, exist_ok=True)
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1400,900")
    # Headless Chrome has been observed to crash the tab outright on some
    # machines/versions while rendering this app's canvas-heavy editor —
    # these flags are the standard fix for that class of instability.
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-software-rasterizer")
    prefs = {
        "download.default_directory": str(download_dir.resolve()),
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True,
    }
    options.add_experimental_option("prefs", prefs)
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    # Headless Chrome blocks downloads by default unless explicitly allowed
    # via this devtools command.
    driver.execute_cdp_cmd(
        "Page.setDownloadBehavior",
        {"behavior": "allow", "downloadPath": str(download_dir.resolve())},
    )
    return driver


def read_env_local() -> dict:
    """Reads NEXT_PUBLIC_SUPABASE_URL/ANON_KEY straight from .env.local — the
    same values the app itself bundles into its client-side JS."""
    env_path = REPO_ROOT / ".env.local"
    values = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def list_projects(driver: "webdriver.Chrome", base_url: str) -> list[dict]:
    """Lists projects via a direct Supabase REST call rather than scraping the
    home page's client-rendered list — the home page's own fetch has been
    unreliable to reproduce from an automated/headless browser in this setup
    (works fine from a plain curl with the same key), so this sidesteps that
    entirely. `driver`/`base_url` are unused here but kept in the signature in
    case a future revision wants to fall back to page-scraping."""
    env = read_env_local()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("Could not find NEXT_PUBLIC_SUPABASE_URL/ANON_KEY in .env.local.", file=sys.stderr)
        return []

    endpoint = f"{url}/rest/v1/projects?select=id,name&order=updated_at.desc"
    req = urllib.request.Request(endpoint, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=15) as res:
        rows = json.loads(res.read().decode("utf-8"))
    return [{"id": r["id"], "name": r["name"]} for r in rows]


def sanitize_filename(name: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9-_ ]", "", name).strip()
    name = re.sub(r"\s+", "-", name)
    return name[:80] or "presenta-deck"


DOWNLOAD_EXTENSIONS = (".pdf", ".pptx")


def wait_for_new_file(download_dir: Path, before: set[str], timeout: float = 120.0) -> Path | None:
    """Waits for exactly one new, fully-written PDF/PPTX (no .crdownload
    sibling) to appear — export can take a while for a large deck, so this
    polls rather than assuming a fixed delay. Only considers files with the
    expected extension: Chrome/Windows can drop other incidental files into
    the download directory (e.g. a stray "downloads.htm" was observed once
    during testing) that would otherwise be mistaken for the real output."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        after = {f.name for f in download_dir.iterdir()}
        new = after - before
        finished = [n for n in new if n.lower().endswith(DOWNLOAD_EXTENSIONS)]
        in_progress = any(n.endswith(".crdownload") for n in new)
        if finished and not in_progress:
            return download_dir / finished[0]
        time.sleep(0.5)
    return None


def export_project(
    driver: "webdriver.Chrome",
    base_url: str,
    project: dict,
    formats: list[str],
    out_dir: Path,
    export_timeout: float = 300,
) -> None:
    project_id = project["id"]
    name = project["name"] or project_id
    print(f"\n[{name}] opening editor…")
    driver.get(f"{base_url}/p/{project_id}/edit")

    export_button = WebDriverWait(driver, 30).until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Export')]"))
    )

    for fmt in formats:
        label = "Export as PDF" if fmt == "pdf" else "Export as PPTX"
        print(f"[{name}] exporting {fmt.upper()}…")

        before = {f.name for f in out_dir.iterdir()}
        export_button.click()
        option = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, f"//button[contains(., '{label}')]"))
        )
        option.click()

        # Large decks take a while to rasterize (this app renders each slide
        # to a PNG before assembling the PDF/PPTX) — small decks finish in
        # seconds regardless, but a 150+ slide deck may need --export-timeout
        # raised well past the default.
        downloaded = wait_for_new_file(out_dir, before, timeout=export_timeout)
        if not downloaded:
            print(f"[{name}] ✗ {fmt.upper()} export timed out — no file appeared in {out_dir}", file=sys.stderr)
            continue

        # Distinct filename per project id, not just per name — several
        # projects here are named "xx"/"zzz" etc, and a bare sanitized-name
        # collision would silently overwrite one export with another.
        wanted_name = f"{sanitize_filename(name)}-{project_id[-8:]}.{fmt}"
        final_path = out_dir / wanted_name
        if downloaded != final_path:
            if final_path.exists():
                final_path.unlink()
            # Windows can briefly hold the file locked (e.g. an AV scan
            # right after download completes) — a couple of short retries
            # is cheap insurance against a spurious failure here.
            for attempt in range(5):
                try:
                    downloaded.rename(final_path)
                    break
                except PermissionError:
                    if attempt == 4:
                        raise
                    time.sleep(0.5)
        print(f"[{name}] ✓ {fmt.upper()} → {final_path}")

        # Re-fetch the export button reference — the page may have
        # re-rendered its status text in place, but staleness is cheap to
        # guard against by just re-locating it before the next format.
        export_button = WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Export')]"))
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=3001, help="Port to serve/reach the app on (default: 3001, distinct from the default dev port 3000)")
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "exports", help="Directory to write exported files to")
    parser.add_argument("--format", choices=["pdf", "pptx", "both"], default="both")
    parser.add_argument("--only", nargs="*", default=None, help="Only export projects whose name contains one of these substrings")
    parser.add_argument("--export-timeout", type=float, default=300, help="Seconds to wait for each file to finish downloading (default: 300; raise this for very large decks, e.g. 150+ slides)")
    args = parser.parse_args()

    formats = ["pdf", "pptx"] if args.format == "both" else [args.format]
    out_dir = args.out.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    base_url = f"http://127.0.0.1:{args.port}"

    server_proc = None
    started_server = False
    if is_presenta_running(args.port):
        print(f"Reusing already-running app at {base_url}")
    else:
        if not build_app():
            return 1
        server_proc = start_prod_server(args.port)
        started_server = True
        if not wait_for_server(args.port, timeout=60):
            print(f"Production server didn't come up on port {args.port} in time.", file=sys.stderr)
            stop_process_tree(server_proc)
            if server_proc.stdout:
                print("--- server output ---", file=sys.stderr)
                print(server_proc.stdout.read(4000), file=sys.stderr)
            return 1
        print(f"Production server is up at {base_url}")

    driver = None
    try:
        driver = make_driver(out_dir)
        projects = list_projects(driver, base_url)
        if args.only:
            projects = [p for p in projects if any(s.lower() in (p["name"] or "").lower() for s in args.only)]

        if not projects:
            print("No projects found to export.")
            return 0

        print(f"Found {len(projects)} project(s): {', '.join(p['name'] or p['id'] for p in projects)}")
        for project in projects:
            export_project(driver, base_url, project, formats, out_dir, export_timeout=args.export_timeout)

        print(f"\nDone. Files are in {out_dir}")
        return 0
    finally:
        if driver:
            driver.quit()
        if started_server and server_proc:
            print("Stopping the server this script started…")
            stop_process_tree(server_proc)


if __name__ == "__main__":
    raise SystemExit(main())
