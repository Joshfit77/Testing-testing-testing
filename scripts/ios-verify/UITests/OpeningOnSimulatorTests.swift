import XCTest

/// Drives the real Narrow Gate Fitness app in the iOS Simulator (WKWebView, loading the full web app) and saves
/// timed screenshots of the opening to $SHOTS_DIR (passed as TEST_RUNNER_SHOTS_DIR), named
/// "<step>-<milliseconds since launch or tap>.png", for scripts/ios-verify/contact-sheet.py.
/// Tests run in name order: the first launch, Enter Narrow Gate, then relaunch and resume.
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

    func test1_firstLaunchPlaysTheOpeningAndEndsByItself() {
        continueAfterFailure = true
        app.launch()
        let start = Date()
        film("1-launch", from: start, for: 8)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening is still showing 8 s after launch")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after the opening")
        shot("1-launch-final")
    }

    func test2_enterNarrowGateMovesIntoTheLightAndOpensTheApp() {
        continueAfterFailure = true
        app.launch()
        let start = Date()
        let enter = app.buttons["Enter Narrow Gate"]
        XCTAssertTrue(enter.waitForExistence(timeout: 8), "no Enter Narrow Gate button")
        // The button fades in at 2.15 s and the opening moves on by itself at 3.85 s: tap in between.
        let frame = enter.frame
        while Date().timeIntervalSince(start) < 2.6 { usleep(20_000) }
        let tappedAt = ms(since: start)
        XCTAssertLessThan(tappedAt, 3700, "Enter Narrow Gate could not be tapped before the opening finished by itself")
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
        let tap = Date()
        film("2-enter", from: tap, for: 2.4)
        print("Enter Narrow Gate tapped \(tappedAt) ms after launch")
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening is still showing 2.4 s after Enter")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after Enter")
        shot("2-enter-final")
    }

    func test3_relaunchReplaysTheOpeningButReturningFromTheBackgroundDoesNot() {
        continueAfterFailure = true
        app.launch()
        let start = Date()
        XCTAssertTrue(app.buttons["Skip intro"].waitForExistence(timeout: 4), "the opening did not replay on a fresh launch")
        while Date().timeIntervalSince(start) < 2.2 { usleep(20_000) }
        shot(String(format: "3-relaunch-%05d", ms(since: start)))
        XCTAssertTrue(labelled("small is the gate and narrow the way").exists, "Matthew 7:13–14 is not on screen")
        app.buttons["Skip intro"].tap()
        sleep(1)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "Skip intro did not close the opening")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after Skip intro")
        shot("3-after-skip")
        // Home screen and back: the app resumes where it was, without the opening.
        XCUIDevice.shared.press(.home)
        sleep(2)
        app.activate()
        sleep(2)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening replayed when the app came back from the background")
        shot("3-resumed")
    }
}
