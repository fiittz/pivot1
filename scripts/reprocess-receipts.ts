import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ystgzxtxplhxuwsthmbj.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const AUTO_MATCH_THRESHOLD = 0.85;

function scoreCandidate(
  candidateAmount: number,
  candidateDesc: string,
  candidateDate: string,
  receiptAmount: number,
  receiptVendor: string | null,
  receiptDate: string | null,
): { score: number; explanation: string } {
  let score = 0;
  const reasons: string[] = [];

  const candidateAbs = Math.abs(candidateAmount);
  const receiptAbs = Math.abs(receiptAmount);
  if (Math.abs(candidateAbs - receiptAbs) < 0.005) {
    score += 0.5;
    reasons.push(`Amount match: ${receiptAbs.toFixed(2)}`);
  }

  if (receiptVendor && candidateDesc) {
    const descLower = candidateDesc.toLowerCase();
    const vendorLower = receiptVendor.toLowerCase().trim();

    if (vendorLower && descLower.includes(vendorLower)) {
      score += 0.3;
      reasons.push(`Vendor full: "${receiptVendor}"`);
    } else {
      const vendorWords = vendorLower.split(/[\s,.\-()]+/).filter((w) => w.length >= 3);
      const matchedWord = vendorWords.find((word) => descLower.includes(word));
      if (matchedWord) {
        score += 0.3;
        reasons.push(`Vendor partial: "${matchedWord}"`);
      }
    }
  }

  if (receiptDate && candidateDate) {
    const rDate = new Date(receiptDate);
    const tDate = new Date(candidateDate);
    const diffMs = Math.abs(rDate.getTime() - tDate.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0.5) {
      score += 0.2;
      reasons.push("Same day");
    } else if (diffDays <= 1.5) {
      score += 0.15;
      reasons.push("±1 day");
    }
  }

  return { score: Math.round(score * 100) / 100, explanation: reasons.join("; ") };
}

async function main() {
  // 1. Find user
  const { data: users } = await supabase.auth.admin.listUsers();
  const jamie = users.users.find((u) => u.email === "jamie@oakmont.ie");
  if (!jamie) throw new Error("User not found");
  const userId = jamie.id;
  console.log(`User: ${jamie.email} (${userId})\n`);

  // 2. Delete duplicate receipts — keep only the FIRST receipt per (vendor_name, amount, receipt_date)
  const { data: allReceipts } = await supabase
    .from("receipts")
    .select("id, vendor_name, amount, receipt_date, transaction_id, image_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  for (const r of allReceipts || []) {
    const key = `${r.vendor_name}|${r.amount}|${r.receipt_date}`;
    if (seen.has(key)) {
      duplicateIds.push(r.id);
    } else {
      seen.add(key);
    }
  }

  if (duplicateIds.length > 0) {
    // Unlink duplicates from transactions first
    for (const id of duplicateIds) {
      await supabase.from("receipts").update({ transaction_id: null }).eq("id", id);
    }
    // Delete duplicates in chunks
    for (let i = 0; i < duplicateIds.length; i += 50) {
      const chunk = duplicateIds.slice(i, i + 50);
      await supabase.from("receipts").delete().in("id", chunk);
    }
    console.log(`Deleted ${duplicateIds.length} duplicate receipts`);
  }

  // 3. Get deduplicated unmatched receipts
  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, vendor_name, amount, receipt_date, transaction_id, image_url")
    .eq("user_id", userId)
    .is("transaction_id", null)
    .order("receipt_date", { ascending: true });

  console.log(`Unmatched receipts after dedup: ${receipts?.length}\n`);

  // 4. Get unlinked transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, amount, description, transaction_date, receipt_url")
    .eq("user_id", userId)
    .is("receipt_url", null)
    .order("transaction_date", { ascending: true });

  console.log(`Unlinked transactions: ${transactions?.length}\n`);

  // 5. Run matching with improved vendor logic
  let matched = 0;
  let notMatched = 0;
  const linkedTxIds = new Set<string>();

  for (const receipt of receipts || []) {
    // Find candidates in ±2 day window
    const candidates = (transactions || []).filter((t) => {
      if (linkedTxIds.has(t.id)) return false; // already linked this run
      if (!receipt.receipt_date) return true;
      const rDate = new Date(receipt.receipt_date);
      const tDate = new Date(t.transaction_date);
      const from = new Date(rDate);
      from.setDate(from.getDate() - 2);
      const to = new Date(rDate);
      to.setDate(to.getDate() + 2);
      return tDate >= from && tDate <= to;
    });

    let bestScore = 0;
    let bestCandidate: (typeof transactions)[0] | null = null;
    let bestExplanation = "";

    for (const c of candidates) {
      const { score, explanation } = scoreCandidate(
        c.amount,
        c.description || "",
        c.transaction_date,
        receipt.amount,
        receipt.vendor_name,
        receipt.receipt_date,
      );
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = c;
        bestExplanation = explanation;
      }
    }

    if (bestScore >= AUTO_MATCH_THRESHOLD && bestCandidate) {
      // Link receipt to transaction
      await supabase.from("receipts").update({ transaction_id: bestCandidate.id }).eq("id", receipt.id);
      await supabase
        .from("transactions")
        .update({ receipt_url: receipt.image_url })
        .eq("id", bestCandidate.id);

      linkedTxIds.add(bestCandidate.id);
      matched++;
      console.log(
        `MATCHED: ${receipt.vendor_name} €${receipt.amount} → ${bestCandidate.description} (${bestScore}) ${bestExplanation}`,
      );
    } else {
      notMatched++;
      if (bestCandidate) {
        console.log(
          `  MISS: ${receipt.vendor_name} €${receipt.amount} best=${bestScore} (${bestExplanation}) → ${bestCandidate.description} €${Math.abs(bestCandidate.amount)}`,
        );
      } else {
        console.log(`  MISS: ${receipt.vendor_name} €${receipt.amount} (no candidates in window)`);
      }
    }
  }

  console.log(`\n=== RESULTS: ${matched} matched, ${notMatched} not matched ===`);
}

main().catch(console.error);
