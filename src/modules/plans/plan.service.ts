
import { db } from "../../db/client.js";
import { plans } from "../../db/schema.js";

export type CreateCustomPlanInput = {
  name: string;
  planType: "account" | "user";
  monthlyAllowance: number;
  maxUnitsPerRequest: number;
};

export async function createCustomPlan(
  accountId: number,
  input: CreateCustomPlanInput,
) {
  const name = input.name.trim();

  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error("Invalid account ID");
  }

  if (!name || name.length > 100) {
    throw new Error("Invalid plan name");
  }

  if (input.planType !== "account" && input.planType !== "user") {
    throw new Error("Invalid plan type");
  }

  if (
    !Number.isSafeInteger(input.monthlyAllowance) ||
    input.monthlyAllowance < 0
  ) {
    throw new Error("Invalid monthly allowance");
  }

  if (
    !Number.isSafeInteger(input.maxUnitsPerRequest) ||
    input.maxUnitsPerRequest <= 0
  ) {
    throw new Error("Invalid maximum units per request");
  }

  const [plan] = await db
    .insert(plans)
    .values({
      name,
      planType: input.planType,
      monthlyAllowance: input.monthlyAllowance,
      maxUnitsPerRequest: input.maxUnitsPerRequest,
      isPredefined: false,
      ownerAccountId: accountId,
    })
    .returning({
      id: plans.id,
      name: plans.name,
      planType: plans.planType,
      monthlyAllowance: plans.monthlyAllowance,
      maxUnitsPerRequest: plans.maxUnitsPerRequest,
      ownerAccountId: plans.ownerAccountId,
    });

  if (!plan) {
    throw new Error("Failed to create custom plan");
  }

  return plan;
}
