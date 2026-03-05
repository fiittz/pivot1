import { createClient } from "@supabase/supabase-js";
import { autoCategorise, findMatchingCategory } from "../src/lib/autocat";

const supabase = createClient(
  "https://ystgzxtxplhxuwsthmbj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzdGd6eHR4cGxoeHV3c3RobWJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxOTA1NCwiZXhwIjoyMDg0NTk1MDU0fQ.olAGlHIzdHjgIKnX8XR1IcDLqC25EeULsEnbUWQld-M",
);
const userId = "ba6b418a-887c-4f94-a18a-8347e8a0fb77";

async function main() {
  const { data: categories } = await supabase.from("categories").select("*").eq("user_id", userId).order("name");
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, description, amount, type, transaction_date, category_id, account_id")
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false });
  const { data: accounts } = await supabase.from("accounts").select("id, account_type").eq("user_id", userId);
  const { data: directorRows } = await supabase
    .from("director_onboarding")
    .select("director_name")
    .eq("user_id", userId);

  const accountTypeMap = new Map<string, string>();
  for (const a of accounts || []) accountTypeMap.set(a.id, a.account_type);
  const directorNames = (directorRows || []).map((d: { director_name: string | null }) => d.director_name).filter((n): n is string => !!n);

  const skipped: { desc: string; amount: number; cat: string; conf: number; reason: string }[] = [];

  for (const txn of transactions || []) {
    const dir = txn.type === "income" ? "income" : "expense";
    const acctType = txn.account_id ? accountTypeMap.get(txn.account_id) : undefined;
    const result = autoCategorise({
      amount: txn.amount,
      date: txn.transaction_date,
      currency: "EUR",
      description: txn.description,
      merchant_name: txn.description,
      direction: dir as "income" | "expense",
      user_industry: "carpentry_joinery",
      user_business_type: "carpentry_joinery",
      account_type: acctType,
      director_names: directorNames,
    });
    const matched = findMatchingCategory(result.category, categories!, dir as "income" | "expense", acctType);

    if (!matched || result.confidence_score < 40) {
      const reason = !matched ? `NO DB MATCH for "${result.category}"` : `Low confidence (${result.confidence_score})`;
      skipped.push({ desc: txn.description, amount: txn.amount, cat: result.category, conf: result.confidence_score, reason });
    }
  }

  console.log(`Skipped: ${skipped.length}\n`);
  for (const s of skipped) {
    console.log(`${s.desc.substring(0, 42).padEnd(44)} €${String(s.amount).padStart(9)}  cat: ${s.cat.padEnd(20)} conf: ${String(s.conf).padEnd(4)} reason: ${s.reason}`);
  }
}

main().catch(console.error);
