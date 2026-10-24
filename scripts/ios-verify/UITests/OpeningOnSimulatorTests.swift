import XCTest

/// Drives the real Narrow Gate Fitness app in the iOS Simulator (WKWebView, loading the full web app) and saves
/// screenshots to $SHOTS_DIR (passed as TEST_RUNNER_SHOTS_DIR), named "<step>-<milliseconds>.png" for
/// scripts/ios-verify/contact-sheet.py. The workflow holds each page load for a few seconds (slow-start-proxy.mjs) so
/// the opening starts after launch() returns. The opening left alone is filmed without XCUITest (film.py).
/// Tests run in name order.
final class OpeningOnSimulatorTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.narrowgatefitness.app")

    private lazy var shotsDir: URL = {
        let base = ProcessInfo.processInfo.environment["SHOTS_DIR"] ?? NSTemporaryDirectory()
        let dir = URL(fileURLWithPath: base)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private func ms(since start: Date) -> Int { Int(Date().timeIntervalSince(start) * 1000) }

    private func shot(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        try? screenshot.pngRepresentation.write(to: shotsDir.appendingPathComponent("\(name).png"))
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    /// Screenshots as fast as the simulator gives them (about every 0.1–0.3 s) until `seconds` after `start`.
    private func film(_ step: String, from start: Date, for seconds: TimeInterval) {
        while Date().timeIntervalSince(start) < seconds {
            shot(String(format: "%@-%05d", step, ms(since: start)))
        }
    }

    private func labelled(_ text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    /// Launches the app and reports how long launch() took to return.
    private func launch() {
        let before = Date()
        app.launch()
        print("GATECHECK launch() returned after \(ms(since: before)) ms")
    }

    /// What the app exposes to accessibility, for the log when an element is missing.
    private func dumpTree(_ why: String) {
        print("GATECHECK \(why); accessibility tree:\n" + String(app.debugDescription.prefix(4000)))
    }

    func test1_enterNarrowGateMovesIntoTheLightAndOpensTheApp() throws {
        continueAfterFailure = true
        launch()
        let enter = app.buttons["Enter Narrow Gate"]
        guard enter.waitForExistence(timeout: 15) else {
            dumpTree("no Enter Narrow Gate button")
            shot("1-no-enter")
            XCTFail("no Enter Narrow Gate button within 15 s")
            return
        }
        let frame = enter.frame
        shot("1-before-enter")
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
        let tap = Date()
        print("GATECHECK tapped Enter Narrow Gate")
        film("1-enter", from: tap, for: 2.4)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening is still showing 2.4 s after Enter")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after Enter")
        shot("1-enter-final")
    }

    func test2_relaunchReplaysTheOpeningButReturningFromTheBackgroundDoesNot() throws {
        continueAfterFailure = true
        launch()
        let skip = app.buttons["Skip intro"]
        guard skip.waitForExistence(timeout: 15) else {
            dumpTree("no Skip intro button")
            shot("2-no-skip")
            XCTFail("the opening did not replay on a fresh launch")
            return
        }
        // Wait for the verse (it fades in at 1.7 s).
        let verse = labelled("small is the gate and narrow the way")
        XCTAssertTrue(verse.waitForExistence(timeout: 4), "Matthew 7:13–14 is not on screen")
        shot("2-relaunch")
        skip.tap()
        sleep(1)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "Skip intro did not close the opening")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after Skip intro")
        shot("2-after-skip")
        // Home screen and back: the app resumes where it was, without the opening.
        XCUIDevice.shared.press(.home)
        sleep(2)
        app.activate()
        sleep(2)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening replayed when the app came back from the background")
        shot("2-resumed")
    }
}
