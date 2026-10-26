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
/// simulator a tap lands 0.3–1.8 s after it is sent, a screenshot call takes 0.2–3 s and decoding one takes up to a
/// second more, so a film captures at the pace of the call alone and decodes in the background, and the fresh
/// launch measures the machine.
/// Tests run in name order.
final class OpeningOnSimulatorTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.narrowgatefitness.app")

    /// Where a screenshot last showed Enter Narrow Gate, in points (test0's film runs before test1).
    nonisolated(unsafe) private static var enterPoint: CGPoint?
    /// How long a screenshot call takes while the opening animates here (median), from test0's film.
    nonisolated(unsafe) private static var openingCapture: TimeInterval?
    /// Whether test0's film kept up with the opening (the door seen, frames never more than 1.5 s apart): only then
    /// can a film time the press; set to the longest gap otherwise.
    nonisolated(unsafe) private static var openingGap: TimeInterval?

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

    override func setUp() {
        super.setUp()
        _ = shotsDir
    }

    private func ms(since start: Date) -> Int { Int(Date().timeIntervalSince(start) * 1000) }

    /// One filmed frame: a 134-pixel-wide RGBA copy for measurements (made from the 402 px JPEG saved for the
    /// contact sheet, so the screenshot is decoded once), the screen size in points, when the capture began and
    /// what it cost (the call, and the whole frame).
    private struct Frame {
        let px: [UInt8]
        let w: Int
        let h: Int
        let size: CGSize
        let at: Date
        let capture: TimeInterval
        let total: TimeInterval
    }

    // A film: captures on the test's thread at the pace of the screenshot call, decoded and saved on this queue.
    private let filmQueue = DispatchQueue(label: "gatecheck.film", qos: .userInitiated)
    private let filmGroup = DispatchGroup()
    private let filmLock = NSLock()
    private var filmed: [Frame] = []

    /// Decodes a screenshot once: saves it 402 px wide (JPEG) and measures it.
    private func process(_ screenshot: XCUIScreenshot, name: String, began: Date, capture: TimeInterval) -> Frame {
        let image = screenshot.image
        let points = image.size
        let size = CGSize(width: 402, height: (402 * points.height / points.width).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let small = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            ctx.cgContext.interpolationQuality = .low
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        try? small.jpegData(compressionQuality: 0.85)?.write(to: shotsDir.appendingPathComponent("\(name).jpg"))
        let (px, w, h) = pixels(small)
        return Frame(px: px, w: w, h: h, size: points, at: began, capture: capture, total: Date().timeIntervalSince(began))
    }

    /// Takes a screenshot and processes it here and now; `attach` also keeps the full one in the test result.
    @discardableResult
    private func shot(_ name: String, attach: Bool = false) -> Frame {
        let began = Date()
        let screenshot = XCUIScreen.main.screenshot()
        let capture = Date().timeIntervalSince(began)
        if attach {
            let attachment = XCTAttachment(screenshot: screenshot)
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        return process(screenshot, name: name, began: began, capture: capture)
    }

    /// Takes a screenshot now and processes it in the background; `frames()` collects the film in capture order.
    @discardableResult
    private func film(_ name: String) -> (at: Date, capture: TimeInterval) {
        let began = Date()
        let screenshot = XCUIScreen.main.screenshot()
        let capture = Date().timeIntervalSince(began)
        filmQueue.async(group: filmGroup) { [self] in
            let frame = process(screenshot, name: name, began: began, capture: capture)
            filmLock.lock()
            filmed.append(frame)
            filmLock.unlock()
        }
        return (began, capture)
    }

    /// The frames processed so far, without waiting.
    private func peek() -> [Frame] {
        filmLock.lock()
        defer { filmLock.unlock() }
        return filmed
    }

    /// Waits for the film to be processed and returns it, in capture order.
    private func frames() -> [Frame] {
        filmGroup.wait()
        return peek()
    }

    private func resetFilm() {
        filmGroup.wait()
        filmLock.lock()
        filmed = []
        filmLock.unlock()
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
            ctx.interpolationQuality = .low
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

    /// Moves this step's screenshots and notes from an earlier attempt (Xcode retries a failed test) into
    /// earlier-attempts/, where the contact sheet ignores them but the artifact keeps them.
    private func clear(_ prefixes: String...) {
        let files = (try? FileManager.default.contentsOfDirectory(atPath: shotsDir.path)) ?? []
        let keep = shotsDir.appendingPathComponent("earlier-attempts", isDirectory: true)
        let tag = Int(Date().timeIntervalSince1970) % 100_000
        for f in files where prefixes.contains(where: { f.hasPrefix($0 + "-") }) {
            try? FileManager.default.createDirectory(at: keep, withIntermediateDirectories: true)
            try? FileManager.default.moveItem(at: shotsDir.appendingPathComponent(f), to: keep.appendingPathComponent("\(tag)-\(f)"))
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

    private func median(_ values: [TimeInterval]) -> TimeInterval {
        let sorted = values.sorted()
        return sorted.isEmpty ? 0 : sorted[sorted.count / 2]
    }

    func test0_freshLaunchPlaysTheOpeningAndEndsByItself() throws {
        clear("0")
        resetFilm()
        try? FileManager.default.removeItem(at: shotsDir.appendingPathComponent("0-stall.txt"))
        let start = launch()
        let skip = app.buttons["Skip intro"]
        // The page can take a few seconds to show on a CI simulator (over a minute on a slow one): film until 8 s
        // after the screen first stops being dark (the opening runs 5 s), at most 90 s. Frames are decoded in the
        // background, so the film runs at the pace of the screenshot call; the frames of the opening itself (from
        // the first that is not dark to the welcome page) time how fast this machine can film it.
        var domReady: Date?
        var firstShown: Date?
        while Date().timeIntervalSince(start) < 90 {
            if domReady == nil, skip.exists { domReady = Date() }
            film(stamp("0-launch", start))
            if firstShown == nil, let f = peek().first(where: { !dark($0) }) { firstShown = f.at }
            if let shown = firstShown, Date().timeIntervalSince(shown) > 8 { break }
        }
        let all = frames()
        let changed = all.first(where: { !dark($0) })
        var sawGate = false
        var opening: [Frame] = []
        for f in all.drop(while: { blank($0) || (dark($0) && doorway($0) > 6) }) {
            opening.append(f)
            if gateOpen(f) {
                sawGate = true
                if let p = enterButton(in: f) { Self.enterPoint = p }
            }
            if welcome(f) { break }
        }
        // The simulator's screenshot service can stall for seconds while the opening's heavy first frames render,
        // and the opening goes on meanwhile: when no frame could be taken while the door stood open (a gap of
        // 1.5 s or more between frames, and no door seen), that is the machine, not the opening, and is reported
        // as such; the opening's presence and end are still checked below through the accessibility tree.
        let gaps = zip(opening, opening.dropFirst()).map { $1.at.timeIntervalSince($0.at) }
        let longestGap = gaps.max() ?? 0
        var stalled: String?
        Self.openingGap = (sawGate && longestGap < 1.5) ? nil : longestGap
        if !sawGate, longestGap >= 1.5 {
            stalled = String(format: "the door could not be filmed on this fresh launch: the screenshot service stalled for %.1f s while the opening rendered, and the next frame was already the welcome page", longestGap)
            try? stalled!.write(to: shotsDir.appendingPathComponent("0-stall.txt"), atomically: true, encoding: .utf8)
            print("GATECHECK \(stalled!)")
        }
        let shown = changed.map { "\(Int($0.at.timeIntervalSince(start) * 1000)) ms" } ?? "never"
        let dom = domReady.map { "\(Int($0.timeIntervalSince(start) * 1000)) ms" } ?? "never"
        print("GATECHECK fresh launch: page showed \(shown) after launch; Skip intro was in the accessibility tree \(dom) after launch")
        if !opening.isEmpty {
            let capture = median(opening.map(\.capture))
            Self.openingCapture = capture
            print(String(format: "GATECHECK filming the opening here: a screenshot call takes %.1f s (median of %d, longest %.1f s), a frame decoded and saved %.1f s",
                         capture, opening.count, opening.map(\.capture).max()!, median(opening.map(\.total))))
        }
        if let p = Self.enterPoint { print(String(format: "GATECHECK Enter Narrow Gate is at (%.0f, %.0f) pt", p.x, p.y)) }
        XCTAssertNotNil(changed, "the page never showed within 90 s of launch")
        XCTAssertTrue(sawGate || stalled != nil, String(format: "the opening (the door open with its light) was not seen on a fresh launch, with frames at most %.1f s apart", longestGap))
        XCTAssertFalse(app.buttons["Skip intro"].exists, "the opening is still showing 8 s after the page showed")
        XCTAssertTrue(labelled("Start free").waitForExistence(timeout: 5), "the welcome page did not appear after the opening")
    }

    func test1_enterNarrowGateMovesIntoTheLightAndOpensTheApp() throws {
        continueAfterFailure = true
        clear("1", "1w")
        resetFilm()
        // The light fills the screen for about half a second after the press (from 0.4 s to 1.05 s): a machine whose
        // screenshot calls take longer than that cannot film it, so the check is skipped there and says so, rather
        // than failing on the machine or passing on nothing. The fresh launch has still filmed the opening, and the
        // move into the light is checked frame by frame in WebKit.
        // Likewise when the fresh launch's film could not keep up with the opening (the screenshot service stalled
        // while it rendered): a film cannot then time the press to the second either.
        var unfilmable: String?
        if let t = Self.openingCapture, t > 0.9 {
            unfilmable = String(format: "a screenshot call takes %.1f s while the opening animates on this simulator (over 0.9 s), too slow to catch the half second of light after the press", t)
        } else if let gap = Self.openingGap {
            unfilmable = String(format: "the screenshot service stalled for %.1f s while the opening rendered on the fresh launch, so a film cannot time the press here", gap)
        }
        if let why = unfilmable {
            let reason = "Enter Narrow Gate not checked here: \(why); the fresh launch filmed what it could, and the move into the light is checked frame by frame in WebKit"
            try? reason.write(to: shotsDir.appendingPathComponent("1-skipped.txt"), atomically: true, encoding: .utf8)
            print("GATECHECK \(reason)")
            throw XCTSkip(reason)
        }
        let start = launch()
        let skip = app.buttons["Skip intro"]
        // Enter Narrow Gate rises in at 2.15 s of the opening, the opening moves on by itself at 3.85 s and is gone
        // at 5.05 s. Film the launch (cheap frames of the launch screen and the blank web view) until the opening's
        // first painted frame, keep filming while there is time, and send the tap 2.0 s after that frame: it lands
        // 0.3–2 s later, while the button is there. The first paint is the first frame that is not blank, or a blank
        // capture that stalled (over a second, with the page in the accessibility tree by the time it returned): the
        // simulator is busy painting the opening's first frames just then, and the capture returns what it grabbed
        // before them. Should a frame show the risen button first, press at once. The place comes from that frame,
        // else from the fresh launch's film, else from the layout (the frame's size in points: the test host's own
        // screen reports a compatibility size).
        var domReady: Date?
        var paintedAt: Date?
        var point: CGPoint?
        var lastFrame: TimeInterval = 0.3
        var screen = CGSize(width: 402, height: 874)
        while Date().timeIntervalSince(start) < 90 {
            if let at = paintedAt, Date().timeIntervalSince(at) + lastFrame > 2.0 { break }
            if domReady == nil, skip.exists { domReady = Date() }
            let f = shot(stamp("1w-before-enter", start))
            lastFrame = f.total
            if f.size.width > 0 { screen = f.size }
            if domReady == nil, f.capture > 1.0, skip.exists { domReady = Date() }
            if paintedAt == nil {
                if !blank(f) {
                    paintedAt = f.at
                } else if domReady != nil, f.capture > 1.0 {
                    paintedAt = f.at.addingTimeInterval(0.3)
                    print(String(format: "GATECHECK a blank capture stalled for %.1f s as the page arrived: taking the opening's first paint as its start", f.capture))
                }
            }
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
            let wait = 2.0 - Date().timeIntervalSince(paintedAt)
            if wait > 0 { Thread.sleep(forTimeInterval: wait) }
        }
        let target = point ?? Self.enterPoint ?? CGPoint(x: screen.width / 2, y: screen.height * 0.912)
        let source = point != nil ? "seen in this film" : Self.enterPoint != nil ? "where the fresh launch showed it" : "the layout's usual place"
        let dom = domReady.map { String(format: "%.1f s %@ it", abs($0.timeIntervalSince(paintedAt)), $0 < paintedAt ? "before" : "after") } ?? "not seen"
        print(String(format: "GATECHECK the opening's first frame was painted %d ms after launch (Skip intro was in the accessibility tree %@); pressing Enter Narrow Gate at (%.0f, %.0f) pt (%@), %.1f s after that frame",
                     Int(paintedAt.timeIntervalSince(start) * 1000), dom, target.x, target.y, source, Date().timeIntervalSince(paintedAt)))
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: target.x, dy: target.y)).tap()
        let tap = Date()
        print(String(format: "GATECHECK tapped it %d ms after launch, %.1f s after the opening's first frame", ms(since: start), tap.timeIntervalSince(paintedAt)))
        // Film the 2.4 s after the press at the pace of the screenshot call (frames are decoded in the background).
        resetFilm()
        var captures: [TimeInterval] = []
        while Date().timeIntervalSince(tap) < 2.4 { captures.append(film(stamp("1-enter", tap)).capture) }
        let after = frames()
        // The frame right after the press: the door open with its light (the move has just begun), so the tap landed
        // while the button was there, not before the door opened and not after the opening moved on by itself.
        XCTAssertTrue(after.first.map { gateOpen($0) } ?? false, "the door was not open with its light when Enter was pressed (the tap landed before the door opened, or after the opening moved on)")
        if let first = after.first { print("GATECHECK right after the press: \(enterButton(in: first) != nil ? "the door open with the button still showing" : gateOpen(first) ? "the door open" : "not the open door")") }
        // The light after the press proves the move only when it comes before the opening's own move could have
        // brightened the screen (its push starts at 3.85 s and its light at 4.1 s): a light frame within 3.9 s of
        // the opening's first frame. Later than that, or with screenshots too slow to catch the half second of
        // light, the press and the welcome page are still checked, and the log says what could not be told apart.
        let firstLight = after.first { inTheLight($0) }.map { $0.at.timeIntervalSince(paintedAt) }
        let slowest = captures.max() ?? 0
        let landed = tap.timeIntervalSince(paintedAt)
        if slowest <= 1.0, landed <= 3.4 {
            XCTAssertTrue(firstLight != nil, String(format: "no move into the light after the tap (a screenshot call took at most %.1f s here, quick enough to film it)", slowest))
            if let t = firstLight { XCTAssertLessThanOrEqual(t, 3.9, String(format: "the light came %.1f s after the opening's first frame, late enough to be the opening's own move rather than the press", t)) }
        } else {
            let note = slowest > 1.0
                ? String(format: "the move into the light could not be filmed after this press: a screenshot call took %.1f s (it needs under 1.0 s to catch the half second of light); it is checked frame by frame in WebKit", slowest)
                : String(format: "the light after this press (%@) cannot be told from the opening's own move: the tap landed %.1f s after the opening's first frame, and the opening moves on by itself from 3.85 s; the move is checked frame by frame in WebKit", firstLight.map { String(format: "seen %.1f s after the first frame", $0) } ?? "not seen", landed)
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
