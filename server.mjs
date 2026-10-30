// x402 seller starter: sell any HTTP endpoint to AI agents for USDC on Base.
// Run: PAY_TO=0xYourWallet node server.mjs
import express from "express";
import { paymentMiddleware } from "x402-express";

const PAY_TO = process.env.PAY_TO;               // your wallet address (receives USDC)
const NETWORK = process.env.NETWORK || "base-sepolia"; // "base" for mainnet
const FACILITATOR = process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const PORT = Number(process.env.PORT || 4021);
if (!/^0x[0-9a-fA-F]{40}$/.test(PAY_TO || "")) { console.error("Set PAY_TO to your 0x wallet address"); process.exit(1); }

const app = express();
app.use(express.json());

// 1) Declare what is paid and how much. Descriptions and schemas are what buyer agents
//    and directories (x402scan, Bazaar) read, so make them concrete.
app.use(paymentMiddleware(PAY_TO, {
  "GET /api/weather": {
    price: "$0.001",
    network: NETWORK,
    config: {
      description: "Current weather for a city: temperature C, wind km/h, conditions",
      inputSchema: { queryParams: { city: "string, e.g. Madrid" } },
      outputSchema: { city: "Madrid", tempC: 18.2, windKmh: 9.1, code: 2 },
      discoverable: true,
    },
  },
}, { url: FACILITATOR }));

// 2) The handler runs only after payment was verified.
app.get("/api/weather", async (req, res) => {
  const city = String(req.query.city || "").trim();
  if (!city) return res.status(400).json({ error: "city required" });
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`).then(r => r.json());
  const p = geo.results?.[0];
  if (!p) return res.status(404).json({ error: "city not found" });
  const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current_weather=true`).then(r => r.json());
  res.json({ city: p.name, tempC: w.current_weather.temperature, windKmh: w.current_weather.windspeed, code: w.current_weather.weathercode });
});

// 3) Free endpoints: health and a machine-readable catalogue for discovery.
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`x402 seller on :${PORT} network=${NETWORK} payTo=${PAY_TO}`));
