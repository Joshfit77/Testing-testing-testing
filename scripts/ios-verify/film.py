"""film.py UDID OUT_DIR — films the real app in a booted simulator on its own timeline: the screen is recorded from
before `simctl launch` (no XCUITest, so nothing delays the launch), then frames.swift finds the launch in the video and
writes a frame every 0.25 s, named "<step>-<milliseconds since launch>.png" for contact-sheet.py. Steps: a fresh
launch left alone (0-launch) and a relaunch after the app is closed (5-relaunch). A first, unfilmed launch warms the
app up (the first launch after installing can take much longer)."""
import os
import signal
import subprocess
import sys
import time

udid, out = sys.argv[1], sys.argv[2]
app = "com.narrowgatefitness.app"
here = os.path.dirname(os.path.abspath(__file__))
os.makedirs(out, exist_ok=True)


def simctl(*args: str) -> None:
    subprocess.run(["xcrun", "simctl", *args], capture_output=True)


def film(step: str, seconds: float) -> None:
    simctl("terminate", udid, app)
    time.sleep(1.5)
    video = os.path.join(out, f"{step}.mp4")
    recorder = subprocess.Popen(["xcrun", "simctl", "io", udid, "recordVideo", "--codec=h264", "--force", video])
    time.sleep(2.5)  # the recorder needs a moment before it captures
    began = time.monotonic()
    simctl("launch", udid, app)
    print(f"{step}: launch command returned after {int((time.monotonic() - began) * 1000)} ms", flush=True)
    time.sleep(max(0.0, seconds + 1 - (time.monotonic() - began)))
    recorder.send_signal(signal.SIGINT)
    recorder.wait(timeout=60)
    result = subprocess.run(["swift", os.path.join(here, "frames.swift"), video, out, step, str(seconds)], capture_output=True, text=True)
    print(result.stdout.strip() or result.stderr.strip()[-2000:], flush=True)


simctl("launch", udid, app)
time.sleep(12)
film("0-launch", 10)
film("5-relaunch", 8)
