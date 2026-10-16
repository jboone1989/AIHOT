// Make an existing host-loopback proxy reachable only on a private Docker gateway.
import net from "node:net";

const bind = process.env.EGRESS_BRIDGE_BIND ?? "";
if (net.isIP(bind) !== 4 || !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(bind)) {
  throw new Error("EGRESS_BRIDGE_BIND must be a private IPv4 address");
}
const server = net.createServer(client => {
  const upstream = net.connect({ host: "127.0.0.1", port: 18123 });
  client.setTimeout(30_000, () => client.destroy());
  upstream.setTimeout(30_000, () => upstream.destroy());
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
  client.on("close", () => upstream.destroy());
  upstream.on("close", () => client.destroy());
  client.pipe(upstream).pipe(client);
});
server.maxConnections = 64;
server.listen(18124, bind);
