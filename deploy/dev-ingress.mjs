// Development ingress is intentionally small and runs as a Docker service.
// No host Nginx install, privileged shell or build is required.
import http from "node:http";
import { pipeline } from "node:stream";

const port = 8080;
const upstream = { hostname: "web", port: 3000 };
const server = http.createServer((req, res) => {
  const forwarded = {
    ...req.headers,
    "x-forwarded-proto": "http",
    "x-forwarded-host": req.headers.host || "",
  };
  const target = http.request({
    ...upstream, method: req.method, path: req.url, headers: forwarded,
  }, reply => {
    res.writeHead(reply.statusCode ?? 502, reply.headers);
    pipeline(reply, res, error => {
      if (error && !res.destroyed) res.destroy(error);
    });
  });
  target.setTimeout(60000, () => target.destroy(new Error("upstream timeout")));
  target.on("error", error => {
    console.error("dev_ingress_upstream_error", error.message);
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("Development web upstream unavailable");
  });
  pipeline(req, target, error => {
    if (error && !target.destroyed) target.destroy(error);
  });
});
server.on("upgrade", (request, socket) => {
  socket.end("HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\n\r\n");
});
server.listen(port, "0.0.0.0", () => {
  console.log("development ingress ready on port " + port);
});
