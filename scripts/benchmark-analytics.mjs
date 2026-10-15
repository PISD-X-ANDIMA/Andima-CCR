const baseUrl = process.env.ANALYTICS_BASE_URL ?? "http://localhost:3000";
const token = process.env.ANALYTICS_AUTH_TOKEN;
const iterations = Math.max(3, Number(process.env.ANALYTICS_BENCHMARK_ITERATIONS ?? 20));
const startPeriod = process.env.ANALYTICS_START_PERIOD ?? "2026-08";
const endPeriod = process.env.ANALYTICS_END_PERIOD ?? "2026-10";

if (!token) {
  console.error("Set ANALYTICS_AUTH_TOKEN to a valid Supabase session access token.");
  process.exit(1);
}

const endpoints = [
  `/api/v1/analytics/macro?start_period=${encodeURIComponent(startPeriod)}&end_period=${encodeURIComponent(endPeriod)}&refresh=${Date.now()}`,
  "/api/v1/customers/analytics?page=1&limit=5&branch=Semua%20Cabang&search=&paymentCycle=Semua%20Siklus%20Pembayaran&sortBy=sales_profit&sortOrder=desc",
];

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};

for (const endpoint of endpoints) {
  const url = `${baseUrl}${endpoint}`;
  const request = () => fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const warmup = await request();
  await warmup.arrayBuffer();
  const durations = [];
  let status = 0;
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const response = await request();
    status = response.status;
    await response.arrayBuffer();
    durations.push(performance.now() - started);
  }
  console.log(`${endpoint.split("?")[0]} status=${status} p50=${Math.round(percentile(durations, 0.5))}ms p95=${Math.round(percentile(durations, 0.95))}ms samples=${iterations}`);
}
