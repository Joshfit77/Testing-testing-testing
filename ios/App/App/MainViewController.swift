import UIKit
import Capacitor

/// The app's bridge view controller: registers the app's own native plugins, which live in this target rather than
/// in an npm package.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RunJournalPlugin())
    }
}
