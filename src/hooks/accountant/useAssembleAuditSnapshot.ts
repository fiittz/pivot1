import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { assembleAuditSnapshot } from "@/lib/cro/assembleAuditSnapshot";

export function useAssembleAuditSnapshot() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientUserId, taxYear, croCompanyId }: { clientUserId: string; taxYear: string; croCompanyId: string }) => {
      const snapshot = await assembleAuditSnapshot(clientUserId, taxYear);
      snapshot.snapshot_by = user?.id || "";

      const bs = snapshot.abridged_accounts.balance_sheet;
      const pl = snapshot.abridged_accounts.profit_and_loss;

      // Upsert into cro_annual_accounts
      const { error } = await supabase
        .from("cro_annual_accounts")
        .upsert({
          cro_company_id: croCompanyId,
          financial_year_end: `${taxYear}-12-31`,
          period_start: `${taxYear}-01-01`,
          data_source: "balnce_auto",
          // Balance sheet columns
          fixed_assets_tangible: bs.fixed_assets.tangible,
          current_assets_stock: bs.current_assets.stock,
          current_assets_debtors: bs.current_assets.debtors,
          current_assets_cash: bs.current_assets.cash_at_bank,
          creditors_within_one_year: bs.creditors_amounts_falling_due_within_one_year,
          net_current_assets: bs.net_current_assets,
          creditors_after_one_year: bs.creditors_amounts_falling_due_after_one_year,
          net_assets: bs.net_assets,
          share_capital: bs.capital_and_reserves.called_up_share_capital,
          retained_profits: bs.capital_and_reserves.profit_and_loss_account,
          shareholders_funds: bs.capital_and_reserves.shareholders_funds,
          // P&L columns
          turnover: pl.turnover,
          cost_of_sales: pl.cost_of_sales,
          gross_profit: pl.gross_profit,
          operating_expenses: pl.administrative_expenses,
          operating_profit: pl.operating_profit,
          profit_before_tax: pl.profit_on_ordinary_activities_before_tax,
          taxation: pl.tax_on_profit,
          profit_after_tax: pl.profit_for_the_financial_year,
          dividends_paid: pl.dividends_paid,
          retained_profit_for_year: pl.retained_profit_for_year,
          // Full audit trail in notes
          notes: snapshot as never,
          updated_at: new Date().toISOString(),
        }, { onConflict: "cro_company_id,financial_year_end" });

      if (error) throw error;
      return snapshot;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cro-annual-accounts", variables.croCompanyId] });
    },
  });
}
