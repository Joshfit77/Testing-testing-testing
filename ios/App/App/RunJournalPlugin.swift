import Capacitor
import CoreLocation

/// Records GPS fixes natively, into RunJournalStore, for as long as a run or walk is recording.
///
/// The background-geolocation plugin delivers fixes to the web app for the live screen; this plugin keeps its own
/// location updates going (the app already has background location mode) and writes every fix to a file from the
/// location delegate, with no JavaScript involved, so nothing is lost if iOS suspends the web view or ends the app.
/// It never asks for location permission itself: the run screen asks when the member taps Start.
@objc(RunJournalPlugin)
public class RunJournalPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "RunJournalPlugin"
    public let jsName = "RunJournal"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private let store = RunJournalStore(directory: RunJournalStore.defaultDirectory())
    private var manager: CLLocationManager?
    private var activeKey: String?

    @objc public func start(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("A recording key is required")
            return
        }
        DispatchQueue.main.async {
            self.activeKey = key
            let m = self.manager ?? CLLocationManager()
            m.delegate = self
            m.desiredAccuracy = kCLLocationAccuracyBest
            m.distanceFilter = kCLDistanceFilterNone
            m.activityType = .fitness
            m.pausesLocationUpdatesAutomatically = false
            // Requires "location" in UIBackgroundModes (Info.plist), which the app declares for run recording.
            m.allowsBackgroundLocationUpdates = true
            m.showsBackgroundLocationIndicator = true
            self.manager = m
            m.startUpdatingLocation()
            call.resolve(["recording": true, "authorized": Self.isAuthorized(m.authorizationStatus)])
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.manager?.stopUpdatingLocation()
            self.activeKey = nil
            call.resolve()
        }
    }

    @objc public func read(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("A recording key is required")
            return
        }
        let fixes = store.read(key: key).map { ["lat": $0.lat, "lng": $0.lng, "accuracy": $0.accuracy, "t": $0.t] }
        call.resolve(["fixes": fixes])
    }

    @objc public func clear(_ call: CAPPluginCall) {
        let key = call.getString("key")
        if key == nil || key == activeKey {
            DispatchQueue.main.async {
                self.manager?.stopUpdatingLocation()
                self.activeKey = nil
            }
        }
        store.clear(key: key)
        call.resolve()
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let key = activeKey else { return }
        for location in locations where location.horizontalAccuracy >= 0 {
            if location.sourceInformation?.isSimulatedBySoftware == true { continue }
            let fix = RunJournalStore.Fix(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                accuracy: location.horizontalAccuracy,
                t: location.timestamp.timeIntervalSince1970 * 1000
            )
            do {
                if try !store.append(key: key, fix: fix) { manager.stopUpdatingLocation() }
            } catch {
                CAPLog.print("RunJournal: could not write a fix: \(error.localizedDescription)")
            }
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // Permission granted after Start (the run screen's prompt was answered): begin recording now.
        if activeKey != nil && Self.isAuthorized(manager.authorizationStatus) { manager.startUpdatingLocation() }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        CAPLog.print("RunJournal: location error: \(error.localizedDescription)")
    }

    private static func isAuthorized(_ status: CLAuthorizationStatus) -> Bool {
        status == .authorizedAlways || status == .authorizedWhenInUse
    }
}
