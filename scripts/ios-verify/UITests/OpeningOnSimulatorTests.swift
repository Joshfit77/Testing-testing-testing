import UIKit
import XCTest

/// Drives the real Narrow Gate Fitness app in the iOS Simulator (WKWebView, loading the full web app) and saves
/// screenshots to $SHOTS_DIR (passed as TEST_RUNNER_SHOTS_DIR), named "<step>-<milliseconds>.jpg" for
/// scripts/ios-verify/contact-sheet.py, which checks what each filmed step showed.
///
/// Most of launch()'s time is closing the previous run; the app has only just started when it returns, so filming
/// from there sees the whole opening. The opening's clock is its first painted frame (CSS animations start with the
/// first rendering update), which the film catches to within one cheap frame of the blank page. The accessibility
/// tree is no use for Enter Narrow Gate (WebKit does not update it for the button's animated visibility), so the
/// press is timed from that clock and placed where the fresh launch's film showed the button. On a shared CI
/// simulator a tap lands 0.3–1.8 s after it is sent and a screenshot of the animated opening takes 0.3–3 s, so
/// each frame is decoded once and the fresh launch measures the machine.
/// Tests run in name order.
final class OpeningOnSimulatorTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.narrowgatefitness.app")

    /// Where a screenshot last showed Enter Narrow Gate, in points (test0's film runs before test1).
    nonisolated(unsafe) private static var enterPoint: CGPoint?
    /// How long one frame of the animated opening takes to film here (capture, decode, measure, save), from test0.
    nonisolated(unsafe) private static var openingFrame: TimeInterval?

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

    /// One filmed frame: a 134-pixel-wide RGBA copy for measurements (made from the 402 px JPEG saved for the
    /// contact sheet, so the screenshot is decoded once), the screen size in points, and what the frame cost.
    private struct Frame {
        let px: [UInt8]
        let w: Int
        let h: Int
        let size: CGSize
        let capture: TimeInterval
        let total: TimeInterval
    }

    /// Takes a screenshot, saves it 402 px wide (JPEG) and measures it; `attach` also keeps the full one in the test
    /// result (slow on a busy simulator, so the timed frames of a film are not attached).
    @discardableResult
    private func shot(_ name: String, attach: Bool = false) -> Frame {
        let began = Date()
        let screenshot = XCUIScreen.main.screenshot()
        let capture = Date().timeIntervalSince(began)
        let image = screenshot.image
        let points = image.size
        let size = CGSize(width: 402, height: (402 * points.height / points.width).rounded())
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
        let (px, w, h) = pixels(small)
        return Frame(px: px, w: w, h: h, size: points, capture: capture, total: Date().timeIntervalSince(began))
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

    /// A 134-pixel-wide RGBA copy of an image, for quick measurements.
    private func pixels(_ image: UIImage) -> ([UInt8], Int, Int) {
        let w = 134
        guard let cg = image.cgImage else { return ([], w, 0) }
        let h = Int((CGFloat(w) * CGFloat(cg.height) / CGFloat(cg.width)).rounded())
        var px = [UInt8](repeating: 0, count: w * h * 4)
        px.withUnsafeMutableBytes { buffer in
            guard let ctx = CGContext(data: buffer.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        }
        return (px, w, h)
    }

    /// Average brightness (0–255) of a box given as fractions of the screen.
    private func brightness(_ f: Frame, x: ClosedRange<Double> = 0...1, y: ClosedRange<Double> = 0...1) -> Double {
        guard f.h > 0 else { return 0 }
        var sum = 0, n = 0
        for row in Int(Double(f.h) * y.lowerBound)..<max(Int(Double(f.h) * y.upperBound), 1) {
            for col in Int(Double(f.w) * x.lowerBound)..<max(Int(Double(f.w) * x.upperBound), 1) {
                let i = (row * f.w + col) * 4
                sum += (Int(f.px[i]) * 299 + Int(f.px[i + 1]) * 587 + Int(f.px[i + 2]) * 114) / 1000
                n += 1
            }
        }
        return n > 0 ? Double(sum) / Double(n) : 0
    }

    /// The doorway, the same box as contact-sheet.py.
    private func doorway(_ f: Frame) -> Double { brightness(f, x: 0.38...0.62, y: 0.22...0.55) }

    /// The launch screen, the blank web view or the opening's first dark moments (same test as contact-sheet.py).
    private func dark(_ f: Frame) -> Bool { brightness(f) < 15 && doorway(f) < 40 }

    /// The launch screen or the empty web view, before the page has painted: near-black (about 9–12) with at most
    /// the small launch logo in the centre. The opening's first frame is pure black (about 5), and its logo, verse
    /// and door are brighter, so the first frame that is not blank is the opening's first frame.
    private func blank(_ f: Frame) -> Bool {
        let screen = brightness(f)
        return screen >= 8 && screen <= 13.5 && doorway(f) < 40
    }

    /// The door is open with its light: the doorway is bright, the screen isn't white.
    private func gateOpen(_ f: Frame) -> Bool { doorway(f) > 140 && brightness(f) < 100 }

    /// The camera is moving into the light, or the light fills the screen.
    private func inTheLight(_ f: Frame) -> Bool { brightness(f) > 120 }

    /// The welcome page: dark, with its small lit doorway (same bands as contact-sheet.py).
    private func welcome(_ f: Frame) -> Bool {
        let d = doorway(f)
        return brightness(f) < 40 && d > 60 && d < 120
    }

    /// Removes this step's screenshots and notes from an earlier attempt (Xcode retries a failed test).
    private func clear(_ prefixes: String...) {
        let files = (try? FileManager.default.contentsOfDirectory(atPath: shotsDir.path)) ?? []
        for f in files where prefixes.contains(where: { f.hasPrefix($0 + "-") }) {
            try? FileManager.default.removeItem(at: shotsDir.appendingPathComponent(f))
        }
    }

    /// Where Enter Narrow Gate is, in points, if the frame shows the opening with the door open and the button shown:
    /// the doorway is bright, and a wide, solid gold shape sits in the lower part of the screen.
    private func enterButton(in f: Frame) -> CGPoint? {
        guard gateOpen(f), f.h > 0 else { return nil }
        var rows: [(y: Int, centre: Double)] = []
        for y in Int(Double(f.h) * 0.55)..<Int(Double(f.h) * 0.98) {
            var best = (start: 0, length: 0), run = 0
            for x in 0..<f.w {
                let i = (y * f.w + x) * 4
                let (r, g, b) = (Int(f.px[i]), Int(f.px[i + 1]), Int(f.px[i + 2]))
                let gold = r > 140 && g > 100 && b * 4 < g * 3 && r > b + 60
                run = gold ? run + 1 : 0
                if run > best.length { best = (x - run + 1, run) }
            }
            if best.length >= 22 { rows.append((y, Double(best.start) + Double(best.length) / 2)) }
        }
        guard rows.count >= 3 else { return nil }
        let x = rows.map(\.centre).reduce(0, +) / Double(rows.count) * f.size.width / Double(f.w)
        let y = Double(rows.map(\.y).reduce(0, +)) / Double(rows.count) * f.size.height / Double(f.h)
        return CGPoint(x: x, y: y)
    }

    func test0_freshLaunchPlaysTheOpeningAndEndsByItself() throws {
        clear("0")
        let start = launch()
        let skip = app.buttons["Skip intro"]
        // The page can take a few seconds to show on a CI simulator (over a minute on a slow one): film until 8 s
        // after the screen first stops being dark (the opening runs 5 s), at most 90 s. The frames of the opening
        // itself (from the first that is not dark to the welcome page) time how fast this machine can film it.
        var domReady: Date?
        var changed: Date?
        var sawGate = false
        var ended = false
        var opening: [Frame] = []
        while Date().timeIntervalSince(start) < 90 {
            if domReady == nil, skip.exists { domReady = Date() }
            let f = shot(stamp("0-launch", start))
            if changed == nil, !dark(f) { changed = Date() }
            if changed != nil, !ended { opening.append(f) }
            if gateOpen(f) {
                sawGate = true
                if let p = enterButton(in: f) { Self.enterPoint = p }
            }
            if sawGate, welcome(f) { ended = true }
            if let c = changed, Date().timeIntervalSince(c) > 8 { break }
        }
        let shown = changed.map { "\(Int($0.timeIntervalSince(start) * 1000)) ms" } ?? "never"
        let dom = domReady.map { "\(Int($0.timeIntervalSince(start) * 1000)) ms" } ?? "never"
        print("GATECHECK fresh launch: page showed \(shown) after launch; Skip intro was in the accessibility tree \(dom) after launch")
        if !opening.isEmpty {
            let totals = opening.map(\.total).sorted()
            let captures = opening.map(\.capture).sorted()
            Self.openingFrame = totals[totals.count / 2]
            print(String(format: "GATECHECK a frame of the opening takes %.1f s to film here (median of %d; the screenshot itself %.1f s; longest frame %.1f s)",
                         totals[totals.count / 2], totals.count, captures[captures.count / 2], totals.last!))
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
        // The light fills the screen for about half a second after the press (from 0.4 s to 1.05 s): a machine that
        // needs longer than that for one frame cannot film it, so the check is skipped there and says so, rather
        // than failing on the machine or passing on nothing. The fresh launch has still filmed the opening, and the
        // move into the light is checked frame by frame in WebKit.
        if let t = Self.openingFrame, t > 0.9 {
            let reason = String(format: "Enter Narrow Gate not checked here: a frame of the opening takes %.1f s to film on this simulator (over 0.9 s), too slow to catch the half second of light after the press; the fresh launch filmed the opening, and the move into the light is checked frame by frame in WebKit", t)
            try? reason.write(to: shotsDir.appendingPathComponent("1-skipped.txt"), atomically: true, encoding: .utf8)
            print("GATECHECK \(reason)")
            throw XCTSkip(reason)
        }
        let start = launch()
        let skip = app.buttons["Skip intro"]
        // Enter Narrow Gate rises in at 2.15 s of the opening, the opening moves on by itself at 3.85 s and is gone
        // at 5.05 s. Film the launch (cheap frames of the launch screen and the blank web view) until the opening's
        // first painted frame, keep filming while there is time, and send the tap 2.3 s after that frame was taken:
        // it lands 0.3–1.8 s later, while the button is there. Should a frame show the risen button first, press at
        // once. The place comes from that frame, else from the fresh launch's film, else from the layout.
        var domReady: Date?
        var paintedAt: Date?
        var point: CGPoint?
        var lastFrame: TimeInterval = 0.3
        while Date().timeIntervalSince(start) < 90 {
            if let at = paintedAt, Date().timeIntervalSince(at) + max(lastFrame, Self.openingFrame ?? 0) > 2.3 { break }
            if domReady == nil, skip.exists { domReady = Date() }
            let began = Date()
            let f = shot(stamp("1w-before-enter", start))
            lastFrame = f.total
            if paintedAt == nil, !blank(f) { paintedAt = began }
            if paintedAt != nil, let p = enterButton(in: f) {
                point = p
                Self.enterPoint = p
                break
            }
        }
        guard let paintedAt else {
            shot("1-no-opening", attach: true)
            XCTFail("the opening never started: the launch screen or a blank page for 90 s after launch")
            return
        }
        if point == nil {
            let wait = 2.3 - Date().timeIntervalSince(paintedAt)
            if wait > 0 { Thread.sleep(forTimeInterval: wait) }
        }
        let screen = UIScreen.main.bounds.size
        let target = point ?? Self.enterPoint ?? CGPoint(x: screen.width / 2, y: screen.height * 0.912)
        let source = point != nil ? "seen in this film" : Self.enterPoint != nil ? "where the fresh launch showed it" : "the layout's usual place"
        let dom = domReady.map { String(format: "%.1f s %@ it", abs($0.timeIntervalSince(paintedAt)), $0 < paintedAt ? "before" : "after") } ?? "not seen"
        print(String(format: "GATECHECK the opening's first frame was painted %d ms after launch (Skip intro was in the accessibility tree %@); pressing Enter Narrow Gate at (%.0f, %.0f) pt (%@), %.1f s after that frame",
                     Int(paintedAt.timeIntervalSince(start) * 1000), dom, target.x, target.y, source, Date().timeIntervalSince(paintedAt)))
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: target.x, dy: target.y)).tap()
        let tap = Date()
        print(String(format: "GATECHECK tapped it %d ms after launch, %.1f s after the opening's first frame", ms(since: start), tap.timeIntervalSince(paintedAt)))
        // The frame right after the press: the door open with its light (the move has just begun), so the tap landed
        // while the button was there, not before the door opened and not after the opening moved on by itself.
        let first = shot(stamp("1-enter", tap))
        XCTAssertTrue(gateOpen(first), "the door was not open with its light when Enter was pressed (the tap landed before the door opened, or after the opening moved on)")
        var light = inTheLight(first)
        var slowest = first.total
        while Date().timeIntervalSince(tap) < 2.4 {
            let f = shot(stamp("1-enter", tap))
            slowest = max(slowest, f.total)
            if inTheLight(f) { light = true }
        }
        if slowest <= 1.0 {
            XCTAssertTrue(light, String(format: "no move into the light after the tap (a frame took at most %.1f s here, quick enough to film it)", slowest))
        } else {
            let note = String(format: "the move into the light could not be filmed after this press: a frame took %.1f s (it needs under 1.0 s to catch the half second of light); it is checked frame by frame in WebKit", slowest)
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
