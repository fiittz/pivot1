-- Seed filing deadlines for all active clients with accountant links.
-- CT1 due: 21 September (23 September for ROS e-filers, we use 21 Sept as the base)
-- Form 11 due: 31 October (mid-November for ROS e-filers, we use 31 Oct as the base)
--
-- This seeds 2025 tax year deadlines. The filing-deadline-check cron will
-- pick these up 90 days before due date and start the finalization flow.

-- CT1 deadlines for 2025 (due 21 Sept 2026) — all active clients
INSERT INTO filing_deadlines (user_id, report_type, tax_year, due_date)
SELECT
  ac.client_user_id,
  'ct1',
  2025,
  '2026-09-21'::date
FROM accountant_clients ac
WHERE ac.status = 'active'
  AND ac.client_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Form 11 deadlines for 2025 (due 31 Oct 2026) — all active clients
INSERT INTO filing_deadlines (user_id, report_type, tax_year, due_date)
SELECT
  ac.client_user_id,
  'form11',
  2025,
  '2026-10-31'::date
FROM accountant_clients ac
WHERE ac.status = 'active'
  AND ac.client_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Allow accountants to read finalization requests for their clients
CREATE POLICY "Accountants can view client finalization requests"
  ON finalization_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.client_user_id = finalization_requests.user_id
        AND ac.accountant_id = auth.uid()
        AND ac.status = 'active'
    )
  );

-- Allow accountants to read client reports they created
CREATE POLICY "Accountants can manage own client reports"
  ON client_reports FOR ALL
  USING (auth.uid() = accountant_id)
  WITH CHECK (auth.uid() = accountant_id);

-- Allow service role to insert finalization requests (for cron function)
-- The existing "Service role manages filing deadlines" policy covers filing_deadlines
-- but we need one for finalization_requests too
CREATE POLICY "Service role manages finalization requests"
  ON finalization_requests FOR ALL
  USING (true)
  WITH CHECK (true);
