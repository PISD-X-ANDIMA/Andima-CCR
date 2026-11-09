import fs from "node:fs/promises";

const baseUrl = process.env.UPLOAD_BASE_URL ?? "http://localhost:3000";
const token = process.env.UPLOAD_AUTH_TOKEN;
const fixture = process.argv[2] ?? "FRTR/company_sales_report_2026-05.pdf";
const iterations = Number(process.env.UPLOAD_BENCHMARK_ITERATIONS ?? 5);

if (!token) {
  console.error("Set UPLOAD_AUTH_TOKEN to a valid Supabase session access token.");
  process.exit(1);
}

const bytes = await fs.readFile(fixture);
const durations = [];
for (let index = 0; index < iterations; index += 1) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), fixture.split(/[\\/]/).pop());
  form.append("document_type", fixture.toLowerCase().includes("outstanding") ? "OUTSTANDING_REPORT" : "COMPANY_SALES_REPORT");
  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/v1/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const elapsed = performance.now() - started;
  durations.push(elapsed);
  console.log(`#${index + 1}: ${Math.round(elapsed)}ms (${response.status})`);
  await response.arrayBuffer();
}

durations.sort((a, b) => a - b);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.ceil(value * durations.length) - 1)];
console.log(`p50=${Math.round(percentile(0.5))}ms p95=${Math.round(percentile(0.95))}ms target<=200ms`);
