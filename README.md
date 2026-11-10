# NovaWallet — Crypto Wallet & Digital Finance Platform

A premium, mobile-first crypto wallet & digital finance app inspired by bKash, Binance and Trust Wallet.
Deep Purple / Royal Blue + Electric Cyan, **light & dark mode**, bottom navigation on mobile, sidebar on desktop.

**Live demo:** https://shamimahmedrobin.github.io/nova-wallet/

## Demo accounts

| Role | Login | Password | PIN |
|---|---|---|---|
| User | `shamim@novawallet.app` | `123456` | `1234` |
| Admin | `admin@novawallet.app` | `admin123` | `9999` |

Other seeded users (arif, nusrat, tanvir, priya, karim) use password `123456` / PIN `1234` — search them in Send Money.

> Demo mode runs on a local, fully-functional data store that mirrors the production Supabase schema
> (same tables, statuses and double-entry ledger rules). Nothing is a static mockup: every form,
> approval and balance change really executes against the store and persists on the device.
> No payment is claimed processed without an admin approval step.

## Features

- **Home dashboard** — total / available / locked balance, BDT + USD equivalent, hide/show toggle,
  crypto holdings value, 8 quick actions, promo banners, market overview, referral summary, latest news, recent transactions
- **Add Money** — bKash / Nagad / Rocket / Bank / Crypto Deposit, Transaction ID + receipt upload, Pending → Approved / Rejected (admin-reviewed)
- **Cash Out** — fee + payable preview, PIN confirmation, amount locked until Completed / Rejected (auto-refund)
- **Send Money** — search by username / email / User ID, recipient card, fee preview, PIN confirm, instant receipt with unique TXN ID, over-balance always blocked
- **Receive** — QR code, payment ID, copy & share, incoming history
- **Crypto Market** — live CoinGecko prices for BTC, ETH, USDT, BNB, SOL, XRP (cached snapshot clearly labelled when offline),
  24h change, market cap, 7-day sparkline charts, watchlist, search — buy/sell executes against your BDT wallet at the confirmed price
- **Referral** — unique code + link, referred/active counts, earnings history, leaderboard, admin-configurable commission, self-referral blocked
- **Loans** — eligibility (KYC) checker, EMI / interest / total-payable calculator, admin-reviewed applications, disbursement, repayments, outstanding tracking
- **Transactions** — search by ID, category / status / date filters, detail view, PDF receipt (print)
- **News** — featured + category filters, search, detail pages with source attribution, admin-managed publishing
- **Account Levels (1–4)** — Basic / Silver / Gold / Platinum with admin-managed limits, loan caps and fee discounts; users request the next level with the **Upgrade** button (Profile + Home balance card), admins approve/reject and can set levels directly in the Admin **Levels** tab
- **Profile** — edit profile, change password & PIN, 2FA toggle, KYC submission, linked methods, notification prefs, EN/বাংলা toggle, sessions, support tickets, Terms & Privacy
- **Notifications** — deposits, withdrawals, transfers, referral rewards, loan updates, security & market alerts, unread counter
- **Admin Panel** (`/admin`) — live stats & volume chart, deposit/withdrawal approvals, user management
  (suspend / activate / freeze / audited balance adjustment), KYC review, loan approvals, referral oversight,
  news & banner management, platform settings (fees, rates, limits, maintenance mode), audit log

## Tech

React + Vite + TypeScript · Tailwind CSS v4 · React Router · Recharts · Lucide · qrcode.react ·
Supabase (Auth + PostgreSQL + RLS) schema in `supabase/migrations/`.

## Run locally

```bash
npm install
npm run dev
```

## Production (Supabase)

1. Create a Supabase project, run `supabase/migrations/0001_schema.sql` then `0002_rls.sql`.
2. Copy `.env.example` → `.env` with your project URL + anon key (service-role keys never go in frontend code).
3. Financial mutations run through the `transfer_funds()` SQL function / Edge Functions with
   server-side amount validation, idempotency keys and atomic updates — see `docs/ARCHITECTURE.md`.

## Security model

Passwords & PINs hashed (bcrypt via Supabase Auth in production), role-based access, PIN/OTP gates on
sensitive actions, server-side balance validation, immutable double-entry ledger, idempotency protection,
audit logging on every admin action, RLS on every table.
