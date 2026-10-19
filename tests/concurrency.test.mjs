import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
const apiKey = process.env.API_KEY;
const userId = Number(process.env.EXAMPLE_USER_ID ?? 1);

async function consume(body) {
  const response = await fetch(`${baseUrl}/consume`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  return {
    statusCode: response.status,
    data: await response.json(),
  };
}

test("10 concurrent requests are counted correctly", async () => {
  assert.ok(apiKey, "API_KEY is required");

  const batchId = randomUUID();

  const requests = Array.from({ length: 10 }, (_, i) =>
    consume({
      userId,
      requestId: `concurrent-${batchId}-${i}`,
      units: 1,
    }),
  );

  const results = await Promise.all(requests);

  for (const result of results) {
    assert.equal(result.statusCode, 200);
    assert.equal(result.data.status, "accepted");
    assert.equal(result.data.replayed, false);
  }

  const totals = results.map(
    (result) => Number(result.data.userMonthlyUsed),
  );

  assert.equal(new Set(totals).size, 10);
  assert.equal(Math.max(...totals) - Math.min(...totals), 9);
});

test("5 simultaneous retries consume only once", async () => {
  assert.ok(apiKey, "API_KEY is required");

  const body = {
    userId,
    requestId: `same-${randomUUID()}`,
    units: 1,
  };

  const results = await Promise.all(
    Array.from({ length: 5 }, () => consume(body)),
  );

  for (const result of results) {
    assert.equal(result.statusCode, 200);
    assert.equal(result.data.status, "accepted");
  }

  const firstTime = results.filter(
    (result) => result.data.replayed === false,
  );

  const replays = results.filter(
    (result) => result.data.replayed === true,
  );

  assert.equal(firstTime.length, 1);
  assert.equal(replays.length, 4);

  const totals = results.map(
    (result) => result.data.userMonthlyUsed,
  );

  assert.equal(new Set(totals).size, 1);
});
