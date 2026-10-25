import UIKit
import XCTest

/// Drives the real Narrow Gate Fitness app in the iOS Simulator (WKWebView, loading the full web app) and saves
/// screenshots to $SHOTS_DIR (passed as TEST_RUNNER_SHOTS_DIR), named "<step>-<milliseconds>.jpg" for
/// scripts/ios-verify/contact-sheet.py, which checks what each filmed step showed.
///
/// Most of launch()'s time is closing the previous run; the app has only just started when it returns, so filming
/// from there sees the whole opening. Accessibility queries into the web view take about a second each, too slow for
/// the two seconds Enter Narrow Gate is on screen, so the button is found in the screenshot itself.
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

    /// Saves a screenshot 402 px wide (JPEG), and attaches the full one to the test result.
    @discardableResult
    private func shot(_ name: String) -> XCUIScreenshot {
        let screenshot = XCUIScreen.main.screenshot()
        let image = screenshot.image
        let size = CGSize(width: 402, height: (402 * image.size.height / image.size.width).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let small = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        try? small.jpegData(compressionQuality: 0.85)?.write(to: shotsDir.appendingPathComponent("\(name).jpg"))
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        return screenshot
    }

    private func stamp(_ step: String, _ start: Date) -> String { String(format: "%@-%05d", step, ms(since: start)) }

    /// Screenshots as fast as the simulator gives them until `seconds` after `start`.
    private func film(_ step: String, from start: Date, for seconds: TimeInterval) {
        while Date().timeIntervalSince(start) < seconds { shot(stamp(step, start)) }
    }

    private func labelled(_ text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func launch() -> Date {
        let before = Date()
        app.launch()
        print("GATECHECK launch() returned after \(ms(since: before)) ms")
        return Date()
    }

    /// Where Enter Narrow Gate is, in points, if the screenshot shows the opening with the door open and the button
    /// shown: the doorway is bright, and a wide, solid gold shape sits in the lower part of the screen.
    private func enterButton(in screenshot: XCUIScreenshot) -> CGPoint? {
        guard let cg = screenshot.image.cgImage else { return nil }
        let w = 134
        let h = Int((CGFloat(w) * CGFloat(cg.height) / CGFloat(cg.width)).rounded())
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let drawn: Bool = px.withUnsafeMutableBytes { buffer in
            guard let ctx = CGContext(data: buffer.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        guard drawn else { return nil }
        func rgb(_ x: Int, _ y: Int) -> (Int, Int, Int) { let i = (y * w + x) * 4; return (Int(px[i]), Int(px[i + 1]), Int(px[i + 2])) }
        // Doorway (same box as contact-sheet.py): bright once the door is open.
        var sum = 0, n = 0
        for y in Int(Double(h) * 0.22)..<Int(Double(h) * 0.55) {
            for x in Int(Double(w) * 0.38)..<Int(Double(w) * 0.62) { let (r, g, b) = rgb(x, y); sum += (r * 299 + g * 587 + b * 114) / 1000; n += 1 }
        }
        guard n > 0, sum / n > 140 else { return nil }
        var rows: [(y: Int, centre: Double)] = []
        for y in Int(Double(h) * 0.55)..<Int(Double(h) * 0.98) {
            var best = (start: 0, length: 0), run = 0
            for x in 0..<w {
                let (r, g, b) = rgb(x, y)
                let gold = r > 140 && g > 100 && b * 4 < g * 3 && r > b + 60
                run = gold ? run + 1 : 0
                if run > best.length { best = (x - run + 1, run) }
            }
            if best.length >= 22 { rows.append((y, Double(best.start) + Double(best.length) / 2)) }
        }
        guard rows.count >= 3 else { return nil }
        let size = screenshot.image.size  // points
        let x = rows.map(\.centre).reduce(0, +) / Double(rows.count) * size.width / Double(w)
        let y = Double(rows.map(\.y).reduce(0, +)) / Double(rows.count) * size.height / Double(h)
        return CGPoint(x: x, y: y)
    }

    func test0_freshLaunchPlaysTheOpeningAndEndsByItself() throws {
        let start = launch()
        film("0-launch", from: start, for: 12)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening is still showing 12 s after launch")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after the opening")
    }

    func test1_enterNarrowGateMovesIntoTheLightAndOpensTheApp() throws {
        continueAfterFailure = true
        let start = launch()
        var target: CGPoint?
        while target == nil && Date().timeIntervalSince(start) < 10 {
            target = enterButton(in: shot(stamp("1w-before-enter", start)))
        }
        guard let point = target else {
            XCTFail("Enter Narrow Gate never showed (no open door with the gold button) within 10 s of launch")
            return
        }
        print(String(format: "GATECHECK Enter Narrow Gate seen at (%.0f, %.0f) pt, %d ms after launch", point.x, point.y, ms(since: start)))
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: point.x, dy: point.y)).tap()
        let tap = Date()
        print("GATECHECK tapped it \(ms(since: start)) ms after launch")
        film("1-enter", from: tap, for: 2.4)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening is still showing 2.4 s after Enter")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after Enter")
        shot("1-enter-final")
    }

    func test2_relaunchReplaysTheOpeningButReturningFromTheBackgroundDoesNot() throws {
        continueAfterFailure = true
        _ = launch()
        let skip = app.buttons["Skip intro"]
        guard skip.waitForExistence(timeout: 20) else {
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
