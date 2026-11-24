"""check-site.py SERVER_URL EXPECTED_COMMIT — checks the deployed website the iPhone app will load, before a TestFlight
build is signed or uploaded:

- the address is https:// and not a placeholder or local address;
- /api/health answers as Narrow Gate Fitness;
- the home page carries the current opening;
- the site reports which commit it serves, and it is EXPECTED_COMMIT (the commit being built). The iPhone app shows
  whatever the site serves, so a build is only uploaded alongside the exact website it was tested with.

Prints one line per check and exits 1 on the first failure. Uses only the Python standard library."""
import json
import re
import sys
import urllib.parse
import urllib.request

PLACEHOLDER_HOST = re.compile(r"^(localhost|127\..*|.*\.(example|invalid|test|localhost))$")
OPENING_MARKERS = ["data-intro-enter", "Enter Narrow Gate", "small is the gate and narrow the way"]
TIMEOUT_SECONDS = 20


def fail(message: str) -> None:
    print(f"::error::{message}")
    sys.exit(1)


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "NarrowGateFitness-TestFlight-check"})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 (https checked above)
        return response.read().decode("utf-8", "replace")


def main(server_url: str, expected_commit: str, allow_http: bool = False) -> None:
    base = server_url.strip().rstrip("/")
    parsed = urllib.parse.urlparse(base)
    if parsed.scheme != "https" and not allow_http:
        fail(f"server_url must be the https:// address of the deployed app (got '{server_url}')")
    host = parsed.hostname or ""
    if not allow_http and (not host or PLACEHOLDER_HOST.match(host)):
        fail(f"server_url ({host or 'no host'}) is a placeholder or local address")
    if not re.fullmatch(r"[0-9a-f]{40}", expected_commit.lower()):
        fail(f"the expected commit isn't a full commit id (got '{expected_commit}')")

    try:
        health = json.loads(fetch(f"{base}/api/health"))
    except Exception as err:  # noqa: BLE001 (any failure means the site isn't ready)
        fail(f"{base}/api/health did not answer ({type(err).__name__}): deploy the app there first")
    data = health.get("data") if isinstance(health, dict) else None
    if not isinstance(data, dict) or data.get("app") != "narrow-gate-fitness":
        fail(f"{base}/api/health isn't Narrow Gate Fitness: check server_url")
    print(f"ok   {base}/api/health answers")

    try:
        home = fetch(f"{base}/")
    except Exception as err:  # noqa: BLE001
        fail(f"{base}/ did not answer ({type(err).__name__})")
    for marker in OPENING_MARKERS:
        if marker not in home:
            fail(f"{base} doesn't serve the current opening ('{marker}' missing): deploy the release candidate there first")
    print("ok   the home page carries the current opening")

    served = str(data.get("commit") or "").strip().lower()
    if not served:
        fail(
            f"{base} doesn't say which commit it serves (/api/health 'commit' is empty). Deploy it with Vercel's Git "
            "integration from the release branch, so the build can be matched to it"
        )
    if served != expected_commit.lower():
        fail(
            f"{base} serves commit {served[:12]}, but this build is from {expected_commit.lower()[:12]}. Deploy this "
            "commit to the site (or run the workflow on the commit the site serves), then run it again"
        )
    print(f"ok   the site serves the commit being built ({served[:12]})")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
