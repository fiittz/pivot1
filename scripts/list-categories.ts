import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ystgzxtxplhxuwsthmbj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzdGd6eHR4cGxoeHV3c3RobWJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxOTA1NCwiZXhwIjoyMDg0NTk1MDU0fQ.olAGlHIzdHjgIKnX8XR1IcDLqC25EeULsEnbUWQld-M",
);

async function main() {
  const { data } = await supabase
    .from("categories")
    .select("name, account_type")
    .eq("user_id", "ba6b418a-887c-4f94-a18a-8347e8a0fb77")
    .order("name");
  if (data) {
    for (const c of data) {
      console.log(`${c.name.padEnd(35)} ${c.account_type}`);
    }
  }
}

main();
