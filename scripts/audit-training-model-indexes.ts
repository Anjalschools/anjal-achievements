import { auditTrainingPartnershipModelIndexes } from "@/lib/partnerships/training-model-index-audit";

const duplicateWarnings: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = args.map(String).join(" ");
  if (message.includes("Duplicate schema index")) {
    duplicateWarnings.push(message);
  }
  originalWarn(...args);
};

const main = async () => {
  const { inventory, duplicates, modelCount } = await auditTrainingPartnershipModelIndexes();

  console.log("\n=== T.2.5.D Mongo Index Inventory ===\n");
  console.log("Model | Index | Status");
  console.log("--- | --- | ---");
  for (const row of inventory) {
    console.log(`${row.model} | ${row.index} | ${row.status}`);
  }

  console.log("\n=== Startup Duplicate Index Warnings ===\n");
  if (duplicateWarnings.length === 0) {
    console.log("NONE");
  } else {
    for (const warning of duplicateWarnings) {
      console.log(warning);
    }
  }

  console.log("\n=== Duplicate Field Declarations ===\n");
  if (duplicates.length === 0) {
    console.log("NONE");
  } else {
    for (const issue of duplicates) {
      console.log(`${issue.model}.${issue.field} (${issue.fieldFlags.join(", ")}) -> ${issue.conflictingIndex}`);
    }
  }

  console.log(`\nModels audited: ${modelCount}`);
  console.log(`Inventory rows: ${inventory.length}`);

  if (duplicateWarnings.length > 0 || duplicates.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
