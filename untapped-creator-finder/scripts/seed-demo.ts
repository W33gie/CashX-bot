/**
 * Load or clear the FICTIONAL demo dataset.
 *   npm run db:seed-demo
 *   npm run db:clear-demo
 */
import "dotenv/config";
import { seedDemoData, clearDemoData } from "../src/server/demo";
import { prisma } from "../src/lib/db";

async function main() {
  if (process.argv.includes("--clear")) {
    console.log(`Removed ${await clearDemoData()} demo creators.`);
  } else {
    console.log(`Loaded ${await seedDemoData()} fictional demo creators.`);
  }
}
main().finally(() => prisma.$disconnect());
