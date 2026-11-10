# NovaWallet Architecture

## Layers
- `src/lib/store.tsx` — app state + every financial workflow (demo data layer mirroring the Supabase model 1:1).
  Every mutation writes a transaction row **and** a balanced double-entry ledger pair; balances are never
  silently edited — admin adjustments require a reason and write audit + ledger entries.
- `src/lib/market.ts` — CoinGecko public API (no key), 60s cache, labelled fallback snapshot.
- `src/lib/seed.ts` — realistic demo seed (7 users, wallets, txs, pending approvals, loans, news).
- `src/pages/` — Landing/Auth, Home, Services (Add/CashOut/Send/Receive), Market, Referral, Loan,
  Transactions, News, Notifications, Profile, Admin.
- `supabase/migrations/` — production PostgreSQL: 30 tables, enums, `transfer_funds()` atomic function, full RLS.

## Money flows
- **Deposit:** user submits (method + provider TrxID, unique) → `pending` → admin approve = credit + ledger pair (+ referral commission event) / reject = no credit.
- **Withdrawal:** request locks amount (available → locked) → admin complete = locked burned, fee recognised / reject = locked → available refund.
- **Transfer:** PIN-checked, `amount + fee ≤ available` enforced, both wallets updated atomically, receiver gets a mirror `receive` tx + notification.
- **Trade:** buy converts BDT → coin at the price confirmed in the trade sheet; sell converts back. Market (indicative) price is labelled as such.
- **Loan:** application → admin review only (never auto-approved) → disbursement credits wallet → repayments reduce `paid`; `paid ≥ total_payable` ⇒ `repaid`.

## Security checklist (implemented in demo layer / enforced in SQL layer)
Hashed passwords & PINs · RBAC (user/admin routes) · PIN gate on send/cash-out · server-side amount
validation (`transfer_funds`, CHECK constraints, `available >= 0`) · idempotency keys on transactions ·
unique (method, provider_trx_id) on deposits · no self-transfer / no self-referral constraints ·
audit log on every admin action · RLS on all tables · no secrets in frontend (`.env.example` only).

## Theming
Tailwind `dark` class strategy, persisted in `localStorage (nova.theme)`, toggle in header, sidebar and profile. Default: dark.
