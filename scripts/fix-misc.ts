/**
 * One-off: reset transactions incorrectly assigned to "Miscellaneous Expenses" back to uncategorised.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ystgzxtxplhxuwsthmbj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzdGd6eHR4cGxoeHV3c3RobWJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxOTA1NCwiZXhwIjoyMDg0NTk1MDU0fQ.olAGlHIzdHjgIKnX8XR1IcDLqC25EeULsEnbUWQld-M",
);
const userId = "ba6b418a-887c-4f94-a18a-8347e8a0fb77";

async function main() {
  // Find the Miscellaneous Expenses category
  const { data: miscCat } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Miscellaneous Expenses")
    .limit(1);

  if (!miscCat || miscCat.length === 0) {
    console.log("No Miscellaneous Expenses category found");
    return;
  }

  const miscId = miscCat[0].id;

  // Find transactions in Miscellaneous Expenses
  const { data: txns } = await supabase
    .from("transactions")
    .select("id, description, amount")
    .eq("user_id", userId)
    .eq("category_id", miscId);

  if (!txns || txns.length === 0) {
    console.log("No transactions in Miscellaneous Expenses");
    return;
  }

  console.log(`Found ${txns.length} transactions in Miscellaneous Expenses. Resetting to uncategorised...\n`);

  for (const txn of txns) {
    const { error } = await supabase
      .from("transactions")
      .update({ category_id: null, notes: null })
      .eq("id", txn.id);

    if (error) {
      console.log(`  FAILED: ${txn.description} — ${error.message}`);
    } else {
      console.log(`  Reset: ${txn.description} (€${txn.amount})`);
    }
  }

  console.log(`\nDone. ${txns.length} transactions reset to uncategorised.`);
}

main().catch(console.error);
