// node slow-start-proxy.mjs LISTEN_PORT TARGET_PORT DELAY_FILE
// Forwards 127.0.0.1:LISTEN_PORT to the app on 127.0.0.1:TARGET_PORT, holding each page load (an HTML GET) for the
// number of milliseconds written in DELAY_FILE (0 or missing = no delay). XCUITest's launch() waits for the app to
// settle before it returns; holding the first page load makes the opening start after that, so the test can reach
// Enter Narrow Gate in time. Used only by the iOS workflow's simulator check.
import http from "node:http";
import { readFileSync } from "node:fs";

const [listenPort = "3001", targetPort = "3000", delayFile = "/tmp/ngf-delay-ms"] = process.argv.slice(2);

function delayMs() {
  try {
    return Number(readFileSync(delayFile, "utf8").trim()) || 0;
  } catch {
    return 0;
  }
}

http
  .createServer((req, res) => {
    const page = req.method === "GET" && (req.headers.accept ?? "").includes("text/html");
    setTimeout(() => {
      const upstream = http.request({ host: "127.0.0.1", port: Number(targetPort), path: req.url, method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      upstream.on("error", () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    }, page ? delayMs() : 0);
  })
  .listen(Number(listenPort), "127.0.0.1");
