import { supabase } from "@/integrations/supabase/client";

export async function checkAccountantApproval(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("approved_accountants")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Error checking accountant approval:", error);
    return false;
  }

  return !!data;
}
