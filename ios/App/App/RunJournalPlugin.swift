import Capacitor
import CoreLocation

/// The native GPS recorder behind the run journal. One per app process (not per web view), so a Capacitor bridge
/// reset, a web-content-process crash or iOS disconnecting the scene doesn't stop it: only stop, clear, or the app
/// process ending does. It never asks for location permission itself; the run screen asks when the member taps Start.
final class RunJournalRecorder: NSObject, CLLocationManagerDelegate {
    static let shared = RunJournalRecorder()

    let store = RunJournalStore(directory: RunJournalStore.defaultDirectory())
    private var manager: CLLocationManager?
    private(set) var activeKey: String?
    private(set) var written = 0

    /// Must run on the main thread (CLLocationManager needs a run loop).
    func start(key: String) -> Bool {
        if activeKey != key { written = 0 }
        activeKey = key
        let m = manager ?? CLLocationManager()
        m.delegate = self
        m.desiredAccuracy = kCLLocationAccuracyBest
        m.distanceFilter = kCLDistanceFilterNone
        m.activityType = .fitness
        m.pausesLocationUpdatesAutomatically = false
        // Requires "location" in UIBackgroundModes (Info.plist), which the app declares for run recording.
        m.allowsBackgroundLocationUpdates = true
        m.showsBackgroundLocationIndicator = true
        manager = m
        m.startUpdatingLocation()
        return Self.isAuthorized(m.authorizationStatus)
    }

    /// Must run on the main thread.
    func stop() {
        manager?.stopUpdatingLocation()
        activeKey = nil
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let key = activeKey else { return }
        // Every location in the batch (iOS delivers several at once after a pause), not only the last.
        for location in locations where location.horizontalAccuracy >= 0 {
            if location.sourceInformation?.isSimulatedBySoftware == true { continue }
            let fix = RunJournalStore.Fix(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                accuracy: location.horizontalAccuracy,
                t: location.timestamp.timeIntervalSince1970 * 1000
            )
            do {
                if try store.append(key: key, fix: fix) {
                    written += 1
                } else {
                    stop() // the journal is full (about 50 hours): stop rather than drain the battery
                }
            } catch {
                CAPLog.print("RunJournal: could not write a fix: \(error.localizedDescription)")
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // Permission granted after Start (the run screen's prompt was answered): begin recording now.
        if activeKey != nil && Self.isAuthorized(manager.authorizationStatus) { manager.startUpdatingLocation() }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        CAPLog.print("RunJournal: location error: \(error.localizedDescription)")
    }

    static func isAuthorized(_ status: CLAuthorizationStatus) -> Bool {
        status == .authorizedAlways || status == .authorizedWhenInUse
    }
}

/// JavaScript interface to the run journal: start, stop, status, read, clear.
@objc(RunJournalPlugin)
public class RunJournalPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RunJournalPlugin"
    public let jsName = "RunJournal"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ensurePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private var recorder: RunJournalRecorder { RunJournalRecorder.shared }

    @objc public func start(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("A recording key is required")
            return
        }
        DispatchQueue.main.async {
            let authorized = self.recorder.start(key: key)
            call.resolve(["recording": true, "authorized": authorized])
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.recorder.stop()
            call.resolve()
        }
    }

    @objc public func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            var result: [String: Any] = ["active": self.recorder.activeKey != nil, "written": self.recorder.written]
            if let key = self.recorder.activeKey { result["key"] = key }
            call.resolve(result)
        }
    }

    /// iOS: the background-geolocation plugin asks for permission itself; nothing to do here.
    @objc public func ensurePermission(_ call: CAPPluginCall) {
        call.resolve(["granted": true])
    }

    @objc public func read(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("A recording key is required")
            return
        }
        let fixes = recorder.store.read(key: key).map { ["lat": $0.lat, "lng": $0.lng, "accuracy": $0.accuracy, "t": $0.t] }
        call.resolve(["fixes": fixes])
    }

    @objc public func clear(_ call: CAPPluginCall) {
        let key = call.getString("key")
        DispatchQueue.main.async {
            if key == nil || key == self.recorder.activeKey { self.recorder.stop() }
            let cleared = self.recorder.store.clear(key: key)
            call.resolve(["cleared": cleared])
        }
    }
}
