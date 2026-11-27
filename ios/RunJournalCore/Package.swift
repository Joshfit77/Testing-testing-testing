// swift-tools-version:5.9
// Unit tests for the app's native run journal (ios/App/App/RunJournalStore.swift, linked into Sources).
// Run on a Mac: swift test --package-path ios/RunJournalCore   (the iOS workflow's "native-tests" job does this).
import PackageDescription

let package = Package(
    name: "RunJournalCore",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [.library(name: "RunJournalCore", targets: ["RunJournalCore"])],
    targets: [
        .target(name: "RunJournalCore"),
        .testTarget(name: "RunJournalCoreTests", dependencies: ["RunJournalCore"]),
    ]
)
