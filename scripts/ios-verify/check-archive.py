"""check-archive.py APP_BUNDLE MIN_SDK_MAJOR — checks a Release archive of the iPhone app (App.app inside
App.xcarchive/Products/Applications; unsigned on every push, and the signed TestFlight build before it is uploaded)
against what App Store Connect and TestFlight need, without Apple's servers:
the bundle ID, version and build number, the SDK and Xcode it was built with, the deployment target, a 64-bit-only
binary, the device capability, the permission texts every native feature needs, the privacy manifest, the app icon,
App Transport Security, that it loads the online app over HTTPS rather than the offline edition, and that the offline
Bible is inside the app. EXPECTED_BUNDLE_ID overrides the bundle ID (default com.narrowgatefitness.app).

Prints one line per check and exits 1 if any fails. It doesn't sign: signing needs the Apple Developer account."""
import json
import os
import plistlib
import subprocess
import sys

app, min_sdk = sys.argv[1], int(sys.argv[2])
# The TestFlight job passes the bundle ID it signs with (its bundle_id input); the default is the app's own.
bundle_id = os.environ.get("EXPECTED_BUNDLE_ID") or "com.narrowgatefitness.app"
info = plistlib.load(open(os.path.join(app, "Info.plist"), "rb"))
failures: list[str] = []


def check(ok: bool, what: str, detail: str = "") -> None:
    print(f"{'ok  ' if ok else 'FAIL'} {what}{f' ({detail})' if detail else ''}")
    if not ok:
        failures.append(what)


check(info.get("CFBundleIdentifier") == bundle_id, f"bundle ID is {bundle_id}", str(info.get("CFBundleIdentifier")))
check(info.get("CFBundleDisplayName") == "Narrow Gate Fitness", "display name", str(info.get("CFBundleDisplayName")))
version, build = str(info.get("CFBundleShortVersionString", "")), str(info.get("CFBundleVersion", ""))
check(bool(version) and all(p.isdigit() for p in version.split(".")) and len(version.split(".")) <= 3, "marketing version is numeric (x.y.z)", version)
check(build.replace(".", "").isdigit(), "build number is numeric", build)

sdk = str(info.get("DTSDKName", ""))
sdk_version = str(info.get("DTPlatformVersion", ""))
check(sdk.startswith("iphoneos"), "built with the iPhoneOS SDK (a device build, not the Simulator)", sdk)
try:
    sdk_major = int(sdk_version.split(".")[0])
except ValueError:
    sdk_major = 0
check(sdk_major >= min_sdk, f"iOS SDK {min_sdk} or later (App Store Connect's minimum)", sdk_version)
xcode = str(info.get("DTXcode", ""))
check(len(xcode) >= 4 and int(xcode[:2]) >= min_sdk, f"Xcode {min_sdk} or later", f"DTXcode {xcode}, build {info.get('DTXcodeBuild')}")
minimum = str(info.get("MinimumOSVersion", ""))
check(minimum != "" and int(minimum.split(".")[0]) >= 15, "deployment target iOS 15 or later (required from April 2027)", minimum)

binary = os.path.join(app, str(info.get("CFBundleExecutable", "App")))
archs = subprocess.run(["lipo", "-archs", binary], capture_output=True, text=True).stdout.split()
check(archs == ["arm64"], "binary is arm64 only", " ".join(archs) or "unreadable")
check(info.get("UIRequiredDeviceCapabilities") == ["arm64"], "required device capability is arm64", str(info.get("UIRequiredDeviceCapabilities")))
check(info.get("LSRequiresIPhoneOS") is True, "LSRequiresIPhoneOS")
check(info.get("ITSAppUsesNonExemptEncryption") is False, "export compliance answered (only standard HTTPS encryption)")

# Every native feature the app uses needs its permission text, or iOS ends the app when the feature asks.
for key, feature in [
    ("NSCameraUsageDescription", "camera (barcodes, meal photos, progress and Body Scan photos)"),
    ("NSHealthShareUsageDescription", "reading Apple Health"),
    ("NSHealthUpdateUsageDescription", "HealthKit's write-permission text (required with the HealthKit entitlement)"),
    ("NSLocationWhenInUseUsageDescription", "location during a run or walk"),
    ("NSLocationAlwaysAndWhenInUseUsageDescription", "location while the phone is locked during a run"),
]:
    text = str(info.get(key, ""))
    check(len(text) >= 20, f"{key}: {feature}", f"{len(text)} characters")
check("location" in (info.get("UIBackgroundModes") or []), "background location mode (runs keep recording when locked)")

ats = info.get("NSAppTransportSecurity") or {}
check(not ats.get("NSAllowsArbitraryLoads"), "App Transport Security: no arbitrary HTTP loads", json.dumps(ats) if ats else "default (HTTPS only)")

privacy = os.path.join(app, "PrivacyInfo.xcprivacy")
check(os.path.exists(privacy), "privacy manifest is in the app")
if os.path.exists(privacy):
    p = plistlib.load(open(privacy, "rb"))
    check(p.get("NSPrivacyTracking") is False, "privacy manifest: no tracking")
    kinds = {t["NSPrivacyCollectedDataType"] for t in p.get("NSPrivacyCollectedDataTypes", [])}
    for k in ["Health", "Fitness", "PreciseLocation", "PhotosorVideos", "EmailAddress", "UserID", "PurchaseHistory", "ProductInteraction"]:
        check(f"NSPrivacyCollectedDataType{k}" in kinds, f"privacy manifest declares {k}")
    check(any(a.get("NSPrivacyAccessedAPIType") == "NSPrivacyAccessedAPICategoryUserDefaults" for a in p.get("NSPrivacyAccessedAPITypes", [])), "privacy manifest gives a reason for UserDefaults")

icons = [f for f in os.listdir(app) if f.startswith("AppIcon")]
check(os.path.exists(os.path.join(app, "Assets.car")) and bool(icons or info.get("CFBundleIcons")), "app icon compiled into the app", ", ".join(icons) or str(info.get("CFBundleIcons")))
check(str(info.get("UILaunchStoryboardName", "")) == "LaunchScreen", "launch screen")

cap = json.load(open(os.path.join(app, "capacitor.config.json")))
server = cap.get("server", {})
check(str(server.get("url", "")).startswith("https://"), "loads the online app over HTTPS", str(server.get("url")))
check(not server.get("cleartext"), "no cleartext (http) traffic allowed")
check(server.get("errorPath") == "error.html" and os.path.exists(os.path.join(app, "public", "error.html")), "offline page bundled (shown when the site can't be reached)")
check(cap.get("webDir") != "standalone" and bool(server.get("url")), "not the offline edition (it has no server address)")
check(cap.get("appId") == bundle_id, "Capacitor appId matches the bundle ID", str(cap.get("appId")))
# With no connection the offline page offers "Read the Bible": the reader and every book must be inside the app, and
# "Try again" needs the site's address (capacitor.config.ts copies them into native-shell/ on every sync).
public = os.path.join(app, "public")
books = os.path.join(public, "bible", "bsb", "books")
book_count = len([f for f in os.listdir(books) if f.endswith(".json")]) if os.path.isdir(books) else 0
reader = all(os.path.exists(os.path.join(public, f)) for f in ["bible-offline.html", "bible-offline.js", "bible/bsb/meta.json", "bible/bsb/wj.json"])
check(reader and book_count == 66, "offline Bible inside the app (reader and all 66 books)", f"{book_count} books")
check(os.path.exists(os.path.join(public, "server-url.js")), "offline page knows the site's address (its Try again button)")

print()
print(f"{len(failures)} check(s) failed" if failures else "All archive checks passed.")
sys.exit(1 if failures else 0)
