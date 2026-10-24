"""film.py UDID OUT_DIR — films the real app in a booted simulator straight after `simctl launch`: a fresh launch
(left alone, 9 s) and a relaunch after the app is closed (6 s). Each screenshot is named
"<step>-<milliseconds since the launch command>.png" for contact-sheet.py. No XCUITest here, so nothing delays the
launch; the timeline is the app's own."""
import os
import subprocess
import sys
import time

udid, out = sys.argv[1], sys.argv[2]
app = "com.narrowgatefitness.app"
os.makedirs(out, exist_ok=True)


def film(step: str, seconds: float) -> None:
    subprocess.run(["xcrun", "simctl", "terminate", udid, app], capture_output=True)
    time.sleep(1.0)
    start = time.monotonic()
    subprocess.run(["xcrun", "simctl", "launch", udid, app], check=True, capture_output=True)
    print(f"{step}: launched in {int((time.monotonic() - start) * 1000)} ms", flush=True)
    while (elapsed := time.monotonic() - start) < seconds:
        path = os.path.join(out, f"{step}-{int(elapsed * 1000):05d}.png")
        subprocess.run(["xcrun", "simctl", "io", udid, "screenshot", "--type=png", path], capture_output=True)


film("0-launch", 9)
film("5-relaunch", 6)
