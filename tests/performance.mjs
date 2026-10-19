import { performance } from "node:perf_hooks";

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
const apiKey = process.env.API_KEY;
const userId = Number(process.env.EXAMPLE_USER_ID ?? 1);

const totalRequests = 100;
const concurrency = 10;

async function benchmark(name, path, headers = {}) {
  const durations = [];
  let nextRequest = 0;
  let errors = 0;

  const start = performance.now();

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = nextRequest++;

      if (index >= totalRequests) {
        return;
      }

      const requestStart = performance.now();

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          headers,
          signal: AbortSignal.timeout(5000),
        });

        await response.arrayBuffer();

        if (!response.ok) {
          errors++;
        } else {
          durations.push(performance.now() - requestStart);
        }
      } catch {
        errors++;
      }
    }
  });

  await Promise.all(workers);

  const elapsed = performance.now() - start;
  durations.sort((a, b) => a - b);

  const average = durations.length
    ? durations.reduce((sum, value) => sum + value, 0) / durations.length
    : 0;

  const p95 = durations.length
    ? durations[Math.ceil(durations.length * 0.95) - 1]
    : 0;

  console.log(`\n${name}`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Successful: ${durations.length}`);
  console.log(`Failed: ${errors}`);
  console.log(`Average latency: ${average.toFixed(2)} ms`);
  console.log(`P95 latency: ${p95.toFixed(2)} ms`);
  console.log(`Throughput: ${(totalRequests / (elapsed / 1000)).toFixed(2)} req/s`);

  if (errors > 0) {
    process.exitCode = 1;
  }
}

await benchmark("Health endpoint", "/health");

if (apiKey) {
  await benchmark(
    "History endpoint",
    `/history?userId=${userId}&limit=10`,
    { "x-api-key": apiKey },
  );
} else {
  console.log("\nHistory benchmark skipped: API_KEY is missing.");
}
