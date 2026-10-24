// swift frames.swift VIDEO OUT_DIR STEP SECONDS
// Finds the launch in a simulator screen recording (the first frame that differs clearly from the home screen at the
// start) and writes a frame every 0.25 s for SECONDS from there, as OUT_DIR/STEP-<milliseconds since launch>.png
// (402 pt wide), for contact-sheet.py.
import AVFoundation
import AppKit

let args = CommandLine.arguments
let video = URL(fileURLWithPath: args[1])
let outDir = args[2]
let step = args[3]
let seconds = Double(args[4]) ?? 10
let every = 0.25

let asset = AVURLAsset(url: video)
let generator = AVAssetImageGenerator(asset: asset)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
generator.appliesPreferredTrackTransform = true
generator.maximumSize = CGSize(width: 402, height: 2000)
let duration = CMTimeGetSeconds(asset.duration)

func frame(at t: Double) -> CGImage? {
    try? generator.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil)
}

/// A 16 × 32 grey thumbnail, to compare frames.
func thumb(_ image: CGImage) -> [UInt8] {
    var pixels = [UInt8](repeating: 0, count: 16 * 32)
    let ctx = CGContext(data: &pixels, width: 16, height: 32, bitsPerComponent: 8, bytesPerRow: 16,
                        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: 16, height: 32))
    return pixels
}

guard let first = frame(at: 0) else { print("\(step): no frames in \(video.path)"); exit(1) }
let home = thumb(first)
var launch = 0.0
var t = every
while t < duration {
    if let image = frame(at: t) {
        let diff = zip(home, thumb(image)).map { abs(Int($0) - Int($1)) }.reduce(0, +) / home.count
        if diff > 12 { launch = t; break }
    }
    t += every
}

var written = 0
t = launch
while t < min(duration, launch + seconds) {
    if let image = frame(at: t), let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) {
        let ms = Int(((t - launch) * 1000).rounded())
        try? png.write(to: URL(fileURLWithPath: "\(outDir)/\(step)-\(String(format: "%05d", ms)).png"))
        written += 1
    }
    t += every
}
print("\(step): launch seen at \(String(format: "%.2f", launch)) s of \(String(format: "%.1f", duration)) s of video; \(written) frames")
