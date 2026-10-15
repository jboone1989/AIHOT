import type { FastifyInstance } from "fastify";
import { getSpot, SPOT_ASSETS, type SpotAsset } from "@aihot/backend/market-spot";

/** Public read-only snapshot, separate from article processing. */
export function registerMarket(app: FastifyInstance) {
  app.get("/api/market/spot", async (req, reply) => {
    const query = req.query as Record<string, unknown>;
    if (Object.keys(query).some(k => k !== "asset") || typeof query.asset !== "string") {
      return reply.code(400).send({ error: "asset=BTC|ETH|SOL|XRP|BNB required" });
    }
    const asset = query.asset.toUpperCase();
    if (!SPOT_ASSETS.some(s => s === asset)) return reply.code(400).send({ error: "unsupported asset" });
    const result = await getSpot(asset as SpotAsset);
    reply.header("Cache-Control", "public, max-age=30, s-maxage=60");
    if (!result.observations.length) return reply.code(503).send(result);
    return reply.send(result);
  });
}
