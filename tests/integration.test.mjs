import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
const apiKey = process.env.API_KEY;
const userId = Number(process.env.EXAMPLE_USER_ID ?? 1);

async function apiRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  return {
    statusCode: response.status,
    data,
  };
}

test("Health endpoint works", async () => {
  const response = await apiRequest("/health");

  assert.equal(response.statusCode, 200);
  assert.equal(response.data.status, "ok");
});

test("Requests without API key are rejected", async () => {
  const response = await apiRequest("/account", {
    headers: {
      "x-api-key": "",
    },
  });

  assert.equal(response.statusCode, 401);
});

test("Consumption, idempotency, conflict and history", async () => {
  assert.ok(apiKey, "API_KEY is required");
  assert.ok(Number.isSafeInteger(userId) && userId > 0);

  const requestId = `test-${randomUUID()}`;

  const body = {
    requestId,
    userId,
    units: 1,
  };

  // First request: consume one unit
  const first = await apiRequest("/consume", {
    method: "POST",
    body: JSON.stringify(body),
  });

  assert.ok(first.statusCode >= 200 && first.statusCode < 300);
  assert.equal(first.data.status, "accepted");
  assert.equal(first.data.replayed, false);

  // Retry: must not consume again
  const retry = await apiRequest("/consume", {
    method: "POST",
    body: JSON.stringify(body),
  });

  assert.ok(retry.statusCode >= 200 && retry.statusCode < 300);
  assert.equal(retry.data.replayed, true);

  assert.equal(
    retry.data.userMonthlyUsed,
    first.data.userMonthlyUsed,
  );

  assert.equal(
    retry.data.accountMonthlyUsed,
    first.data.accountMonthlyUsed,
  );

  // Same request ID with different units: conflict
  const conflict = await apiRequest("/consume", {
    method: "POST",
    body: JSON.stringify({
      ...body,
      units: 2,
    }),
  });

  assert.equal(conflict.statusCode, 409);

  // Verify request was saved in history
  const history = await apiRequest(
    `/history?userId=${userId}&limit=10`,
  );

  assert.equal(history.statusCode, 200);
  assert.ok(Array.isArray(history.data.items));

  const savedRequest = history.data.items.find(
    (item) => item.requestId === requestId,
  );

  assert.ok(savedRequest, "Request was not found in history");
  assert.equal(savedRequest.status, "accepted");
});
