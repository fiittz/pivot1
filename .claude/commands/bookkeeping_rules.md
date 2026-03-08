# Bookkeeping Rules (Double Entry)

Load this context when working on transaction categorization, journal entries, bank reconciliation, or any bookkeeping task.

---

## DEAD CLIC Rule

Every transaction has two entries. Use DEAD CLIC to determine debit vs credit:

| Type | Debit when... | Credit when... |
|------|--------------|----------------|
| **D**ebit expenses | Increase | Decrease |
| **E**xpenses | Increase | Decrease |
| **A**ssets | Increase | Decrease |
| **D**rawings | Increase | Decrease |
| **C**redits | Decrease | Increase |
| **L**iabilities | Decrease | Increase |
| **I**ncome | Decrease | Increase |
| **C**apital | Decrease | Increase |

---

## Books of Prime Entry

| Book | Records | Debit | Credit |
|------|---------|-------|--------|
| Sales Day Book | Credit sales invoices | Trade Receivables | Sales + VAT |
| Purchases Day Book | Credit purchase invoices | Purchases + VAT | Trade Payables |
| Sales Returns Day Book | Credit notes to customers | Sales Returns + VAT | Trade Receivables |
| Purchases Returns Day Book | Credit notes from suppliers | Trade Payables | Purchases Returns + VAT |
| Cash Book (receipts) | Money in | Bank | Various (Sales/Receivables/Capital) |
| Cash Book (payments) | Money out | Various (Purchases/Payables/Expenses) | Bank |
| Petty Cash Book | Small cash expenses | Expenses + VAT | Petty Cash |

---

## Cash Book VAT Rule

When recording payments received from trade receivables (debtors) or payments made to trade payables (creditors), **do not analyse VAT again** in the cash book. VAT was already captured when the original invoice was recorded in the day book. The cash book entry is simply:
- DR Bank / CR Trade Receivables (payment received)
- DR Trade Payables / CR Bank (payment made)

VAT analysis in the cash book applies **only** to direct cash transactions (not settlements of existing invoices).

---

## Discount Types

| Discount | When | Bookkeeping Treatment |
|----------|------|----------------------|
| **Trade discount** | Given to trade customers (e.g., 20% off list price) | Deduct BEFORE recording — never appears in accounts |
| **Bulk/quantity discount** | Volume-based price reduction | Deduct BEFORE recording — never appears in accounts |
| **Prompt payment discount** | Early payment incentive (e.g., 2% if paid within 14 days) | Record at FULL price initially; book discount only when taken |

**Prompt payment discount entries (when taken):**
- Discount allowed (to customer): DR Discounts Allowed / CR Trade Receivables
- Discount received (from supplier): DR Trade Payables / CR Discounts Received

---

## Capital vs Revenue Expenditure

| Test | Capital | Revenue |
|------|---------|---------|
| **Purpose** | Acquire/enhance asset | Day-to-day running costs |
| **Useful life** | >1 year | Consumed within period |
| **Threshold** | Above user's capitalisation limit | Below threshold |
| **Examples** | Vehicles, machinery, building improvements | Repairs, fuel, materials, wages |
| **Accounting** | Statement of Financial Position (Balance Sheet) | Statement of Profit or Loss (P&L) |

**Capital income** = disposal of non-current assets (sale of van, equipment, etc.)
**Revenue income** = trading income (sales, fees, rental income)

---

## Ledger Structure

```
General Ledger (nominal accounts)
├── Assets (Bank, Trade Receivables control, Equipment, etc.)
├── Liabilities (Trade Payables control, VAT, Loans)
├── Capital (Owner's equity, Drawings)
├── Income (Sales, Discounts Received)
└── Expenses (Purchases, Wages, Rent, Motor, Discounts Allowed)

Subsidiary Ledgers (individual accounts)
├── Sales Ledger → individual customer accounts (supports Trade Receivables control)
└── Purchases Ledger → individual supplier accounts (supports Trade Payables control)
```

**Control account rule:** The total of all individual balances in a subsidiary ledger must equal the control account balance in the general ledger.

---

## Petty Cash (Imprest System)

- Fixed float (e.g., €200) set at start of period
- Expenses paid from float, each with a voucher
- At period end, reimburse exact amount spent to restore float
- Imprest amount = opening balance = closing balance after reimbursement
- All petty cash expenses require receipts/vouchers

---

## Accruals & Prepayments (Matching Principle)

The matching principle requires that income and expenses are recognised in the period they relate to, not when cash changes hands. FRS 102 Section 2.36.

### The Four Accrual Types

| Type | Balance Sheet | What it is | Example |
|------|--------------|------------|---------|
| **Prepaid Expense** | Current Asset | Expense paid in advance, not yet consumed | Annual insurance paid Jan — 11 months prepaid at year end |
| **Accrued Expense** | Current Liability | Expense incurred but not yet paid | Electricity used in Dec, bill arrives Jan |
| **Accrued Income** | Current Asset | Income earned but not yet received/invoiced | Work completed in Dec, invoice sent Jan |
| **Deferred Income** | Current Liability | Cash received for work not yet done | Deposit received for a job starting next year |

### Journal Entries

**Prepaid Expense (year-end adjustment):**
- DR Prepayments (Current Asset) / CR Expense account
- Reverses next period: DR Expense / CR Prepayments

**Accrued Expense (year-end adjustment):**
- DR Expense account / CR Accruals (Current Liability)
- Reverses next period: DR Accruals / CR Expense

**Accrued Income (year-end adjustment):**
- DR Accrued Income (Current Asset) / CR Income account
- Reverses next period: DR Income / CR Accrued Income

**Deferred Income (year-end adjustment):**
- DR Income account / CR Deferred Income (Current Liability)
- Reverses next period: DR Deferred Income / CR Income

### Trading Profit Impact

```
Adjusted Profit = Cash-basis Profit
  + Prepayment Movement    (closing - opening: increases profit)
  - Accrual Movement       (closing - opening: reduces profit)
  + Accrued Income Movement (closing - opening: increases profit)
  - Deferred Income Movement (closing - opening: reduces profit)
```

### How to Identify Accruals in Bank Transactions

When reviewing CSV bank imports, look for these patterns:

| Pattern | Likely Accrual Type | Action |
|---------|-------------------|--------|
| Annual insurance/subscription paid in one lump | **Prepayment** | Apportion: only current-period portion is an expense |
| No utility bill in final month(s) | **Accrued expense** | Estimate and accrue the missing bill |
| Work completed, no matching income in bank | **Accrued income** | Recognise income for completed work |
| Large deposit received, job not started | **Deferred income** | Don't recognise as income until work done |
| Rent paid covering next period | **Prepayment** | Apportion to current period only |
| Professional fees incurred, invoice not yet received | **Accrued expense** | Estimate and accrue |
| Retainer/subscription income received in advance | **Deferred income** | Release monthly as earned |

### Opening vs Closing Balances

- **Opening balance** = last year's closing balance (auto-carried forward)
- **Movement** = closing - opening (the P&L adjustment)
- Only the movement affects profit — not the absolute balance
- Prior year import seeds the opening balances for year 1 on the platform

### Stock Valuation Rule

Stock is valued at the **lower of cost and net realisable value** (FRS 102 Section 13):
- **Cost** = purchase price + conversion costs + other costs to bring to current location/condition
- **Net realisable value (NRV)** = estimated selling price minus costs to complete and sell
- Never write stock UP above cost; must write DOWN if NRV < cost (prudence principle)
- Work-in-progress: valued at cost of direct materials + labour + attributable overheads at normal activity levels

---

## Trial Balance

- List all general ledger account balances
- Total debits MUST equal total credits
- If they don't balance → locate error (transposition, omission, single entry, etc.)
- Trial balance does NOT prove all entries are correct (compensating errors, errors of commission, errors of principle, errors of original entry can still exist)

### Extended Trial Balance (ETB)

The ETB adds adjustment columns to the trial balance for year-end accruals:

```
Account | TB Dr | TB Cr | Adjustments Dr | Adjustments Cr | P&L Dr | P&L Cr | BS Dr | BS Cr
--------|-------|-------|----------------|----------------|--------|--------|-------|------
Sales   |       | 100k  |                |                |        | 100k   |       |
Expenses| 60k   |       | 2k (accrual)   |                | 62k    |        |       |
Prepay  |       |       | 3k             |                |        |        | 3k    |
Accruals|       |       |                | 2k             |        |        |       | 2k
```

- Adjustment columns capture accruals, prepayments, depreciation, bad debt provisions
- P&L columns = trading profit/loss
- BS columns = balance sheet items
- Each adjustment row must still balance (Dr = Cr)
