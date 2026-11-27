import Foundation

/// Append-only journal of GPS fixes for one run or walk, written by native code as each fix arrives.
///
/// The web app keeps its own copy, but when iOS suspends the web view, or ends the app while the phone is locked,
/// fixes that only reached JavaScript can be lost. This file is written from the location delegate directly, so the
/// route survives both; the web app reads it back when it offers to continue an unfinished recording (O-01, native
/// layer). One JSON object per line; a line cut short by the app being ended is skipped on reading.
public final class RunJournalStore {
    public struct Fix: Equatable {
        public let lat: Double
        public let lng: Double
        public let accuracy: Double
        /// Milliseconds since 1970, as JavaScript's Date.now().
        public let t: Double

        public init(lat: Double, lng: Double, accuracy: Double, t: Double) {
            self.lat = lat
            self.lng = lng
            self.accuracy = accuracy
            self.t = t
        }
    }

    /// About 50 hours at one fix a second: a runaway journal can't fill the phone.
    public static let maxBytes = 16 * 1024 * 1024

    private let directory: URL
    private let queue = DispatchQueue(label: "com.narrowgatefitness.runjournal")

    public init(directory: URL) {
        self.directory = directory
    }

    /// Application Support/run-journal: not shown to the user, and excluded from iCloud and computer backups (the
    /// folder is marked when it is first written to): a route recorded on this phone never leaves it in a backup.
    public static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("run-journal", isDirectory: true)
    }

    /// A safe file name for a recording key such as "run.recording.<uuid>".
    public static func fileName(for key: String) -> String {
        let safe = key.unicodeScalars.map { scalar -> String in
            let ok = (scalar.value >= 48 && scalar.value <= 57) || (scalar.value >= 65 && scalar.value <= 90)
                || (scalar.value >= 97 && scalar.value <= 122) || scalar == "." || scalar == "-" || scalar == "_"
            return ok ? String(scalar) : "_"
        }.joined()
        return String(safe.prefix(120)) + ".jsonl"
    }

    func url(for key: String) -> URL {
        directory.appendingPathComponent(Self.fileName(for: key))
    }

    /// Append one fix and flush it to storage. Returns false when the journal is full.
    @discardableResult
    public func append(key: String, fix: Fix) throws -> Bool {
        try queue.sync {
            try ensureDirectory()
            let file = url(for: key)
            let fm = FileManager.default
            if !fm.fileExists(atPath: file.path) {
                fm.createFile(atPath: file.path, contents: nil, attributes: Self.fileAttributes)
            }
            let size = (try? fm.attributesOfItem(atPath: file.path)[.size] as? Int) ?? 0
            if size >= Self.maxBytes { return false }
            let line = String(format: "{\"lat\":%.7f,\"lng\":%.7f,\"accuracy\":%.1f,\"t\":%.0f}\n", fix.lat, fix.lng, fix.accuracy, fix.t)
            let handle = try FileHandle(forWritingTo: file)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: Data(line.utf8))
            try handle.synchronize()
            return true
        }
    }

    /// Every complete fix recorded for `key`, oldest first.
    public func read(key: String) -> [Fix] {
        queue.sync {
            guard let data = try? Data(contentsOf: url(for: key)), let text = String(data: data, encoding: .utf8) else { return [] }
            var fixes: [Fix] = []
            for line in text.split(separator: "\n") {
                guard let obj = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any],
                      let lat = obj["lat"] as? Double, let lng = obj["lng"] as? Double,
                      let accuracy = obj["accuracy"] as? Double, let t = obj["t"] as? Double,
                      lat.isFinite, lng.isFinite, accuracy >= 0 else { continue }
                fixes.append(Fix(lat: lat, lng: lng, accuracy: accuracy, t: t))
            }
            return fixes.sorted { $0.t < $1.t }
        }
    }

    /// Remove one recording's journal, or every journal when `key` is nil (sign-out, account deletion). Returns true
    /// only when it is confirmed gone afterwards, so the caller can try again later if it isn't.
    @discardableResult
    public func clear(key: String?) -> Bool {
        queue.sync {
            let fm = FileManager.default
            let target = key.map { url(for: $0) } ?? directory
            if fm.fileExists(atPath: target.path) { try? fm.removeItem(at: target) }
            return !fm.fileExists(atPath: target.path)
        }
    }

    /// Whether the journal folder is excluded from backups (false before anything has been written).
    public func isExcludedFromBackup() -> Bool {
        (try? directory.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup) == true
    }

    private var markedExcluded = false

    private func ensureDirectory() throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: Self.fileAttributes)
        if !markedExcluded {
            // Recorded routes are sensitive: keep them out of iCloud and computer backups (the whole folder).
            var url = directory
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try url.setResourceValues(values)
            markedExcluded = true
        }
    }

    /// Readable and writable while the phone is locked (after the first unlock since it started): a run recorded with
    /// the screen locked must be able to write here. Never `.complete`, which would refuse writes while locked.
    private static var fileAttributes: [FileAttributeKey: Any]? {
        #if os(iOS)
        return [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        #else
        return nil
        #endif
    }
}
