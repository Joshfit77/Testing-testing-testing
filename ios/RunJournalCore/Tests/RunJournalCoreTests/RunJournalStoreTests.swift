import XCTest
@testable import RunJournalCore

/// The native run journal: fixes are written one per line and flushed, survive a cut-off last line (the app ended
/// mid-write), stay per recording, and are removed on clear. (O-01, native layer.)
final class RunJournalStoreTests: XCTestCase {
    private var dir: URL!
    private var store: RunJournalStore!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent("rj-\(UUID().uuidString)", isDirectory: true)
        store = RunJournalStore(directory: dir)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    private func fix(_ i: Int) -> RunJournalStore.Fix {
        RunJournalStore.Fix(lat: 40 + Double(i) * 0.0001, lng: -75, accuracy: 5, t: 1_790_000_000_000 + Double(i) * 1000)
    }

    func testAppendsAndReadsBackInOrder() throws {
        for i in 0..<120 { XCTAssertTrue(try store.append(key: "run.recording.a", fix: fix(i))) }
        let back = store.read(key: "run.recording.a")
        XCTAssertEqual(back.count, 120)
        XCTAssertEqual(back.first?.t, fix(0).t)
        XCTAssertEqual(back.last?.lat ?? 0, fix(119).lat, accuracy: 1e-7)
    }

    func testRecordingsAreSeparateAndKeysAreMadeSafe() throws {
        try store.append(key: "run.recording.a", fix: fix(1))
        try store.append(key: "run.recording.b", fix: fix(2))
        try store.append(key: "../../etc/passwd", fix: fix(3))
        XCTAssertEqual(store.read(key: "run.recording.a").count, 1)
        XCTAssertEqual(store.read(key: "run.recording.b").count, 1)
        XCTAssertEqual(RunJournalStore.fileName(for: "../../etc/passwd"), ".._.._etc_passwd.jsonl")
        let names = try FileManager.default.contentsOfDirectory(atPath: dir.path)
        XCTAssertTrue(names.allSatisfy { !$0.contains("/") })
    }

    func testALineCutShortByTheAppEndingIsSkipped() throws {
        try store.append(key: "k", fix: fix(1))
        try store.append(key: "k", fix: fix(2))
        let file = dir.appendingPathComponent(RunJournalStore.fileName(for: "k"))
        let handle = try FileHandle(forWritingTo: file)
        try handle.seekToEnd()
        try handle.write(contentsOf: Data("{\"lat\":40.1,\"lng\":-7".utf8))
        try handle.close()
        XCTAssertEqual(store.read(key: "k").count, 2)
    }

    func testClearOneAndClearAll() throws {
        try store.append(key: "a", fix: fix(1))
        try store.append(key: "b", fix: fix(2))
        store.clear(key: "a")
        XCTAssertTrue(store.read(key: "a").isEmpty)
        XCTAssertEqual(store.read(key: "b").count, 1)
        store.clear(key: nil)
        XCTAssertTrue(store.read(key: "b").isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: dir.path))
    }

    func testMissingJournalReadsEmpty() {
        XCTAssertTrue(store.read(key: "never-written").isEmpty)
    }
}
