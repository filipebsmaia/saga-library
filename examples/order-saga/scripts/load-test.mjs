#!/usr/bin/env node

// Saga Load Test — fires all saga flow types concurrently with weighted distribution.
// Usage: node scripts/load-test.mjs [--rps 10] [--duration 30] [--base-url http://localhost:3000]

// ─── CLI args ────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE_URL = arg("--base-url", "http://localhost:3000");
const TARGET_RPS = parseInt(arg("--rps", "10"), 10);
const DURATION_SEC = parseInt(arg("--duration", "10"), 10);

// ─── Flow definitions ────────────────────────────────────────
const FLOWS = [
  { name: "recurring", path: "/recurrings", weight: 30 },
  { name: "sim-swap", path: "/sim-swaps", weight: 20 },
  { name: "upgrade", path: "/upgrades", weight: 15 },
  { name: "upgrade-fail", path: "/upgrades?fail=true", weight: 15 },
  { name: "recurring-fail", path: "/recurrings?paymentFail=true", weight: 10 },
  { name: "bulk-activation", path: "/bulk-activations?lines=3", weight: 10 },
];

const totalWeight = FLOWS.reduce((s, f) => s + f.weight, 0);
const cumulative = [];
let acc = 0;
for (const f of FLOWS) {
  acc += f.weight;
  cumulative.push({ ...f, cum: acc });
}

function pickFlow() {
  const r = Math.random() * totalWeight;
  return cumulative.find((f) => r < f.cum);
}

// ─── Stats ───────────────────────────────────────────────────
const stats = {
  total: 0,
  success: 0,
  errors: 0,
  byFlow: {},
  latencies: [],
  errorBreakdown: {}, // "reason" → { count, flows: Set, lastDetail, lastLatency }
};

for (const f of FLOWS) {
  stats.byFlow[f.name] = { count: 0, errors: 0, latencies: [] };
}

function classifyError(result) {
  if (result.error) return `NETWORK: ${result.error}`;
  if (result.status >= 500)
    return `HTTP ${result.status}: ${result.body ?? "Server Error"}`;
  if (result.status >= 400)
    return `HTTP ${result.status}: ${result.body ?? "Client Error"}`;
  return null;
}

function recordResult(result) {
  stats.total++;
  const fs = stats.byFlow[result.flow];
  fs.count++;

  const errKey = classifyError(result);
  if (errKey) {
    stats.errors++;
    fs.errors++;
    const entry = (stats.errorBreakdown[errKey] ??= {
      count: 0,
      flows: new Set(),
      lastLatency: 0,
    });
    entry.count++;
    entry.flows.add(result.flow);
    entry.lastLatency = result.latency;
  } else {
    stats.success++;
    fs.latencies.push(result.latency);
    stats.latencies.push(result.latency);
  }
}

// ─── Request ─────────────────────────────────────────────────
async function fireRequest(flow) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${flow.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const latency = Math.round(performance.now() - start);
    let body;
    try {
      const text = await res.text();
      body = text.length > 200 ? text.slice(0, 200) + "…" : text;
    } catch {
      body = undefined;
    }
    return {
      flow: flow.name,
      status: res.status,
      latency,
      body: res.ok ? undefined : body,
    };
  } catch (err) {
    return {
      flow: flow.name,
      error: err.message,
      latency: Math.round(performance.now() - start),
    };
  }
}

// ─── Percentile ──────────────────────────────────────────────
function pct(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

// ─── Progress ────────────────────────────────────────────────
function printProgress(elapsed) {
  const rps = stats.total > 0 ? (stats.total / elapsed).toFixed(1) : "0";
  const p50 = pct(stats.latencies, 50);
  process.stdout.write(
    `\r  [${Math.floor(elapsed)}s/${DURATION_SEC}s] ${stats.total} req | ${rps} req/s | p50: ${p50}ms | err: ${stats.errors}   `,
  );
}

// ─── Report ──────────────────────────────────────────────────
function printReport() {
  console.log("\n");
  console.log(
    "╔══════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║                      LOAD TEST REPORT                           ║",
  );
  console.log(
    "╠══════════════════════════════════════════════════════════════════╣",
  );
  console.log(
    `║  Duration:  ${DURATION_SEC}s    Target RPS: ${TARGET_RPS}    Base: ${BASE_URL}`,
  );
  console.log(
    `║  Total:     ${stats.total}      Success: ${stats.success}      Errors: ${stats.errors}`,
  );
  console.log(
    "╠══════════════════════════════════════════════════════════════════╣",
  );
  console.log(
    "║  Flow                  Count   Err   p50    p90    p95    p99   ║",
  );
  console.log(
    "╠══════════════════════════════════════════════════════════════════╣",
  );

  for (const f of FLOWS) {
    const s = stats.byFlow[f.name];
    const name = f.name.padEnd(20);
    const count = String(s.count).padStart(5);
    const err = String(s.errors).padStart(5);
    const p50 = String(pct(s.latencies, 50) + "ms").padStart(6);
    const p90 = String(pct(s.latencies, 90) + "ms").padStart(6);
    const p95 = String(pct(s.latencies, 95) + "ms").padStart(6);
    const p99 = String(pct(s.latencies, 99) + "ms").padStart(6);
    console.log(`║  ${name} ${count} ${err} ${p50} ${p90} ${p95} ${p99}   ║`);
  }

  console.log(
    "╠══════════════════════════════════════════════════════════════════╣",
  );
  const p50 = String(pct(stats.latencies, 50) + "ms").padStart(6);
  const p90 = String(pct(stats.latencies, 90) + "ms").padStart(6);
  const p95 = String(pct(stats.latencies, 95) + "ms").padStart(6);
  const p99 = String(pct(stats.latencies, 99) + "ms").padStart(6);
  console.log(
    `║  ${"TOTAL".padEnd(20)} ${String(stats.total).padStart(5)} ${String(stats.errors).padStart(5)} ${p50} ${p90} ${p95} ${p99}   ║`,
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════════╝",
  );

  // ── Error breakdown ──
  const errEntries = Object.entries(stats.errorBreakdown).sort(
    (a, b) => b[1].count - a[1].count,
  );
  if (errEntries.length > 0) {
    console.log(
      "\n┌──────────────────────────────────────────────────────────────────┐",
    );
    console.log(
      "│                      ERROR BREAKDOWN                             │",
    );
    console.log(
      "├──────────────────────────────────────────────────────────────────┤",
    );
    for (const [reason, info] of errEntries) {
      const pctOfTotal = ((info.count / stats.total) * 100).toFixed(1);
      const flows = [...info.flows].join(", ");
      console.log(`│  ${reason}`);
      console.log(
        `│    Count: ${info.count} (${pctOfTotal}%)   Flows: ${flows}`,
      );
      console.log("│");
    }
    console.log(
      "└──────────────────────────────────────────────────────────────────┘",
    );
  }
}

// ─── Main ────────────────────────────────────────────────────
async function run() {
  console.log(
    `\n  Saga Load Test — ${TARGET_RPS} rps for ${DURATION_SEC}s against ${BASE_URL}\n`,
  );

  const intervalMs = 1000 / TARGET_RPS;
  const startTime = Date.now();
  const endTime = startTime + DURATION_SEC * 1000;
  const promises = [];

  const progressTimer = setInterval(() => {
    printProgress((Date.now() - startTime) / 1000);
  }, 500);

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (Date.now() >= endTime) {
        clearInterval(timer);
        resolve();
        return;
      }
      const flow = pickFlow();
      promises.push(fireRequest(flow).then(recordResult));
    }, intervalMs);
  });

  // Drain in-flight requests (max 5s)
  process.stdout.write(
    "\r  Draining in-flight requests...                                   ",
  );
  await Promise.race([
    Promise.allSettled(promises),
    new Promise((r) => setTimeout(r, 5000)),
  ]);

  clearInterval(progressTimer);
  printReport();
}

run().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
