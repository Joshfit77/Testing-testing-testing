import UIKit
import XCTest

/// Drives the real Narrow Gate Fitness app in the iOS Simulator (WKWebView, loading the full web app) and saves
/// screenshots to $SHOTS_DIR (passed as TEST_RUNNER_SHOTS_DIR), named "<step>-<milliseconds>.jpg" for
/// scripts/ios-verify/contact-sheet.py, which checks what each filmed step showed.
///
/// Most of launch()'s time is closing the previous run; the app has only just started when it returns, so filming
/// from there sees the whole opening. On a shared CI simulator a screenshot of the animated opening takes 0.3–3 s and
/// a synthesized tap lands 0.3–1.8 s after it is sent, while an accessibility query takes a fraction of a second: the
/// moment to press Enter Narrow Gate comes from the accessibility tree, and the place from the screenshots.
/// Tests run in name order.
final class OpeningOnSimulatorTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.narrowgatefitness.app")

    /// Where a screenshot last showed Enter Narrow Gate, in points (test0's film runs before test1).
    nonisolated(unsafe) private static var enterPoint: CGPoint?

    /// XCUITest waits for the app to be idle (no animations) before and after each tap; the opening animates
    /// throughout, so on a slow CI simulator that wait put the tap seconds after Enter Narrow Gate was found, after
    /// the opening had moved on by itself. Taps go through straight away instead (XCUITest's own method, emptied).
    override class func setUp() {
        super.setUp()
        guard let process = NSClassFromString("XCUIApplicationProcess") else { return }
        let twoFlags: @convention(block) (AnyObject, Bool, Bool) -> Void = { _, _, _ in }
        let oneFlag: @convention(block) (AnyObject, Bool) -> Void = { _, _ in }
        for (name, block) in [("waitForQuiescenceIncludingAnimationsIdle:isPreEvent:", unsafeBitCast(twoFlags, to: AnyObject.self)),
                              ("waitForQuiescenceIncludingAnimationsIdle:", unsafeBitCast(oneFlag, to: AnyObject.self))] {
            if let method = class_getInstanceMethod(process, NSSelectorFromString(name)) {
                method_setImplementation(method, imp_implementationWithBlock(block))
                print("GATECHECK taps no longer wait for the app to be idle (\(name))")
            }
        }
    }

    private lazy var shotsDir: URL = {
        let base = ProcessInfo.processInfo.environment["SHOTS_DIR"] ?? NSTemporaryDirectory()
        let dir = URL(fileURLWithPath: base)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private func ms(since start: Date) -> Int { Int(Date().timeIntervalSince(start) * 1000) }

    /// Saves a screenshot 402 px wide (JPEG) for the contact sheet; `attach` also keeps the full one in the test
    /// result (slow on a busy simulator, so the timed frames of a film are not attached).
    @discardableResult
    private func shot(_ name: String, attach: Bool = false) -> XCUIScreenshot {
        let screenshot = XCUIScreen.main.screenshot()
        let image = screenshot.image
        let size = CGSize(width: 402, height: (402 * image.size.height / image.size.width).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let small = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        try? small.jpegData(compressionQuality: 0.85)?.write(to: shotsDir.appendingPathComponent("\(name).jpg"))
        if attach {
            let attachment = XCTAttachment(screenshot: screenshot)
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        return screenshot
    }

    private func stamp(_ step: String, _ start: Date) -> String { String(format: "%@-%05d", step, ms(since: start)) }

    private func labelled(_ text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func launch() -> Date {
        let before = Date()
        app.launch()
        print("GATECHECK launch() returned after \(ms(since: before)) ms")
        return Date()
    }

    /// A 134-pixel-wide RGBA copy of a screenshot, for quick measurements.
    private func pixels(_ screenshot: XCUIScreenshot) -> (px: [UInt8], w: Int, h: Int)? {
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
        return drawn ? (px, w, h) : nil
    }

    /// Average brightness (0–255) of a box given as fractions of the screen.
    private func brightness(_ p: (px: [UInt8], w: Int, h: Int), x: ClosedRange<Double> = 0...1, y: ClosedRange<Double> = 0...1) -> Double {
        var sum = 0, n = 0
        for row in Int(Double(p.h) * y.lowerBound)..<max(Int(Double(p.h) * y.upperBound), 1) {
            for col in Int(Double(p.w) * x.lowerBound)..<max(Int(Double(p.w) * x.upperBound), 1) {
                let i = (row * p.w + col) * 4
                sum += (Int(p.px[i]) * 299 + Int(p.px[i + 1]) * 587 + Int(p.px[i + 2]) * 114) / 1000
                n += 1
            }
        }
        return n > 0 ? Double(sum) / Double(n) : 0
    }

    /// The door is open with its light: the doorway (same box as contact-sheet.py) is bright, the screen isn't white.
    private func gateOpen(_ screenshot: XCUIScreenshot) -> Bool {
        guard let p = pixels(screenshot) else { return false }
        return brightness(p, x: 0.38...0.62, y: 0.22...0.55) > 140 && brightness(p) < 100
    }

    /// The camera is moving into the light, or the light fills the screen.
    private func inTheLight(_ screenshot: XCUIScreenshot) -> Bool {
        guard let p = pixels(screenshot) else { return false }
        return brightness(p) > 120
    }

    /// Removes this step's screenshots from an earlier attempt (Xcode retries a failed test).
    private func clear(_ prefixes: String...) {
        let files = (try? FileManager.default.contentsOfDirectory(atPath: shotsDir.path)) ?? []
        for f in files where prefixes.contains(where: { f.hasPrefix($0 + "-") }) {
            try? FileManager.default.removeItem(at: shotsDir.appendingPathComponent(f))
        }
    }

    /// Where Enter Narrow Gate is, in points, if the screenshot shows the opening with the door open and the button
    /// shown: the doorway is bright, and a wide, solid gold shape sits in the lower part of the screen.
    private func enterButton(in screenshot: XCUIScreenshot) -> CGPoint? {
        guard gateOpen(screenshot), let p = pixels(screenshot) else { return nil }
        var rows: [(y: Int, centre: Double)] = []
        for y in Int(Double(p.h) * 0.55)..<Int(Double(p.h) * 0.98) {
            var best = (start: 0, length: 0), run = 0
            for x in 0..<p.w {
                let i = (y * p.w + x) * 4
                let (r, g, b) = (Int(p.px[i]), Int(p.px[i + 1]), Int(p.px[i + 2]))
                let gold = r > 140 && g > 100 && b * 4 < g * 3 && r > b + 60
                run = gold ? run + 1 : 0
                if run > best.length { best = (x - run + 1, run) }
            }
            if best.length >= 22 { rows.append((y, Double(best.start) + Double(best.length) / 2)) }
        }
        guard rows.count >= 3 else { return nil }
        let size = screenshot.image.size  // points
        let x = rows.map(\.centre).reduce(0, +) / Double(rows.count) * size.width / Double(p.w)
        let y = Double(rows.map(\.y).reduce(0, +)) / Double(rows.count) * size.height / Double(p.h)
        return CGPoint(x: x, y: y)
    }

    /// The launch screen, the blank web view or the opening's first dark moments (same test as contact-sheet.py).
    private func dark(_ screenshot: XCUIScreenshot) -> Bool {
        guard let p = pixels(screenshot) else { return true }
        return brightness(p) < 15 && brightness(p, x: 0.38...0.62, y: 0.22...0.55) < 40
    }

    /// The launch screen or the empty web view, before the page has painted: near-black (about 9–12) with at most
    /// the small launch logo in the centre. The opening's first frame is pure black (about 5), and its logo, verse
    /// and door are brighter, so the first frame that is not blank is the opening's first frame.
    private func blank(_ screenshot: XCUIScreenshot) -> Bool {
        guard let p = pixels(screenshot) else { return true }
        let screen = brightness(p)
        return screen >= 8 && screen <= 13.5 && brightness(p, x: 0.38...0.62, y: 0.22...0.55) < 40
    }

    func test0_freshLaunchPlaysTheOpeningAndEndsByItself() throws {
        clear("0")
        let start = launch()
        // The page can take a few seconds to show on a CI simulator (over a minute on a slow one): film until 8 s
        // after the screen first stops being dark (the opening runs 5 s), at most 90 s.
        var changed: Date?
        var sawGate = false
        var captures: [TimeInterval] = []
        while Date().timeIntervalSince(start) < 90 {
            let before = Date()
            let s = shot(stamp("0-launch", start))
            if changed == nil, !dark(s) { changed = Date() }
            if changed != nil { captures.append(Date().timeIntervalSince(before)) }
            if gateOpen(s) {
                sawGate = true
                if let p = enterButton(in: s) { Self.enterPoint = p }
            }
            if let c = changed, Date().timeIntervalSince(c) > 8 { break }
        }
        print("GATECHECK fresh launch: page showed \(changed.map { "\(Int($0.timeIntervalSince(start) * 1000)) ms" } ?? "never") after launch")
        if !captures.isEmpty {
            let sorted = captures.sorted()
            print(String(format: "GATECHECK a screenshot of the opening takes %.1f s here (median of %d; longest %.1f s)", sorted[sorted.count / 2], sorted.count, sorted.last!))
        }
        if let p = Self.enterPoint { print(String(format: "GATECHECK Enter Narrow Gate is at (%.0f, %.0f) pt", p.x, p.y)) }
        XCTAssertNotNil(changed, "the page never showed within 90 s of launch")
        XCTAssertTrue(sawGate, "the opening (the door open with its light) was not seen on a fresh launch")
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening is still showing 8 s after the page showed")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after the opening")
    }

    func test1_enterNarrowGateMovesIntoTheLightAndOpensTheApp() throws {
        continueAfterFailure = true
        clear("1", "1w")
        let start = launch()
        let skip = app.buttons["Skip intro"]
        let enter = app.buttons["Enter Narrow Gate"]
        // Film the launch (the launch screen and the blank web view: cheap frames) until the opening is on screen:
        // Skip intro is in the accessibility tree from the opening's first frame. The check comes before each frame
        // so that no slow screenshot of the animated opening delays what follows.
        var opened = false
        while Date().timeIntervalSince(start) < 90 {
            if skip.exists { opened = true; break }
            let s = shot(stamp("1w-before-enter", start))
            if !blank(s) { opened = true; break }
        }
        guard opened else {
            shot("1-no-opening", attach: true)
            XCTFail("the opening never started: the launch screen or a blank page for 90 s after launch")
            return
        }
        let openingSeen = Date()
        // Enter Narrow Gate is hidden until it rises in at 2.15 s, then joins the accessibility tree: poll for it
        // closely and press at once (the opening moves on by itself at 3.85 s and is gone at 5.05 s), where the
        // fresh launch's film showed the button, else where the accessibility tree puts it, else the layout's place.
        var found = false
        while Date().timeIntervalSince(openingSeen) < 15 {
            if enter.exists { found = true; break }
            Thread.sleep(forTimeInterval: 0.1)
        }
        guard found else {
            shot("1-no-enter", attach: true)
            XCTFail("Enter Narrow Gate never appeared within 15 s of the opening")
            return
        }
        let appeared = Date()
        var source = "where the fresh launch showed it"
        var target = Self.enterPoint
        if target == nil {
            let f = enter.frame
            if f.width > 0 { target = CGPoint(x: f.midX, y: f.midY); source = "where the accessibility tree puts it" }
        }
        let screen = UIScreen.main.bounds.size
        let point = target ?? CGPoint(x: screen.width / 2, y: screen.height * 0.912)
        if target == nil { source = "the layout's usual place" }
        print(String(format: "GATECHECK pressing Enter Narrow Gate at (%.0f, %.0f) pt (%@), %d ms after launch, %.1f s after the opening was first seen",
                     point.x, point.y, source, ms(since: start), appeared.timeIntervalSince(openingSeen)))
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: point.x, dy: point.y)).tap()
        let tap = Date()
        print(String(format: "GATECHECK tapped it %d ms after launch; the tap took %.1f s to land", ms(since: start), tap.timeIntervalSince(appeared)))
        // The frame right after the press: the door open with its light (the move has just begun), so the tap landed
        // while the button was there, not before the door opened and not after the opening moved on by itself.
        let first = shot(stamp("1-enter", tap))
        let capture = Date().timeIntervalSince(tap)
        XCTAssertTrue(gateOpen(first), "the door was not open with its light when Enter was pressed (the tap landed before the door opened, or after the opening moved on)")
        var light = inTheLight(first)
        while Date().timeIntervalSince(tap) < 2.4 { if inTheLight(shot(stamp("1-enter", tap))) { light = true } }
        // The light fills the screen for about half a second (from 0.55 s to 1.05 s after the press): a machine whose
        // screenshots take longer than that cannot film it, and says so instead of guessing either way. The press
        // itself, the door open at the press, the opening ending and the welcome page are still checked.
        if capture <= 1.0 {
            XCTAssertTrue(light, String(format: "no move into the light after the tap (a screenshot takes %.1f s here, quick enough to film it)", capture))
        } else {
            let note = String(format: "the move into the light could not be filmed here: a screenshot of the opening takes %.1f s (it needs under 1.0 s to catch the half second of light); it is checked frame by frame in WebKit", capture)
            print("GATECHECK \(note)")
            try? note.write(to: shotsDir.appendingPathComponent("1-nolight.txt"), atomically: true, encoding: .utf8)
        }
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening is still showing 2.4 s after Enter")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after Enter")
        shot("1-enter-final", attach: true)
    }

    func test2_relaunchReplaysTheOpeningButReturningFromTheBackgroundDoesNot() throws {
        continueAfterFailure = true
        clear("2")
        _ = launch()
        let skip = app.buttons["Skip intro"]
        guard skip.waitForExistence(timeout: 20) else {
            shot("2-no-skip", attach: true)
            XCTFail("the opening did not replay on a fresh launch")
            return
        }
        // Wait for the verse (it fades in at 1.7 s).
        let verse = labelled("small is the gate and narrow the way")
        XCTAssertTrue(verse.waitForExistence(timeout: 4), "Matthew 7:13–14 is not on screen")
        shot("2-relaunch", attach: true)
        skip.tap()
        sleep(1)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "Skip intro did not close the opening")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after Skip intro")
        shot("2-after-skip", attach: true)
        // Home screen and back: the app resumes where it was, without the opening.
        XCUIDevice.shared.press(.home)
        sleep(2)
        app.activate()
        sleep(2)
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening replayed when the app came back from the background")
        shot("2-resumed", attach: true)
    }
}
