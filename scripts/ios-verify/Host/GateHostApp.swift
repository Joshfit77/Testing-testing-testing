import SwiftUI

/// Empty host app for the UI tests (XCTest needs one); the tests drive Narrow Gate Fitness itself.
@main
struct GateHostApp: App {
    var body: some Scene {
        WindowGroup { Text("GateCheck host") }
    }
}
