
import { db, pool } from "./client.js";
import { plans } from "./schema.js";
//هاي اريي بتحتوي على الخطط الي بدنا نضيفها وجزء الدولار ساين بخلي التايبسكريبت تتحقق من ان البيانات الي منضيفها متوافقة مع تعريف جدول بلانز
const predefinedPlans: (typeof plans.$inferInsert)[] = [
  {
    name: "Starter",
    planType: "account",
    monthlyAllowance: 10000,
    maxUnitsPerRequest: 100,
    isPredefined: true,
    ownerAccountId: null,
  },
  {
    name: "Pro",
    planType: "account",
    monthlyAllowance: 100000,
    maxUnitsPerRequest: 1000,
    isPredefined: true,
    ownerAccountId: null,
  },
  {
    name: "Basic",
    planType: "user",
    monthlyAllowance: 1000,
    maxUnitsPerRequest: 20,
    isPredefined: true,
    ownerAccountId: null,
  },
  {
    name: "Premium",
    planType: "user",
    monthlyAllowance: 5000,
    maxUnitsPerRequest: 200,
    isPredefined: true,
    ownerAccountId: null,
  },
];

try {
  await db.insert(plans)
    .values(predefinedPlans)
    .onConflictDoNothing();//معناها إذا صار تعارض مع قيد فريد، ما نحاول نضيف السجل المتعارض مرة ثانية

  console.log("Predefined plans seeded successfully.");
} catch (error) {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
