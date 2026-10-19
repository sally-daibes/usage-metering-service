import { randomUUID } from "node:crypto";

const apiKey = process.env.API_KEY;
const userId = Number(process.env.EXAMPLE_USER_ID ?? 1);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";

if (!apiKey) {
  console.error("Missing API_KEY");
  process.exit(1);
}

if (!Number.isSafeInteger(userId) || userId <= 0) {
  console.error("Invalid EXAMPLE_USER_ID");
  process.exit(1);
}

async function callApi(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  const requestId = `example-${randomUUID()}`;

  const body = {
    userId,
    requestId,
    units: 1,
  };

  console.log("1. Sending consumption request...");

  const first = await callApi("/consume", {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log(first);

  console.log("\n2. Retrying the same request...");

  const second = await callApi("/consume", {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log(second);

  if (second.replayed !== true) {
    throw new Error("Idempotency test failed");
  }

  if (
    first.accountMonthlyUsed !== second.accountMonthlyUsed ||
    first.userMonthlyUsed !== second.userMonthlyUsed
  ) {
    throw new Error("Usage changed during retry");
  }

  console.log("\n3. Fetching request history...");

  const history = await callApi(
    `/history?userId=${userId}&limit=5`,
  );

  console.table(history.items);

  const saved = history.items.some(
    (item) => item.requestId === requestId,
  );

  if (!saved) {
    throw new Error("Request not found in history");
  }

  console.log("\nExample Client completed successfully!");
}

main().catch((error) => {
  console.error("Example Client failed:", error.message);
  process.exit(1);
});
