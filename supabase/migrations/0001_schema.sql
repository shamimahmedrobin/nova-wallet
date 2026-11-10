-- NovaWallet — production schema (Supabase PostgreSQL)
-- The shipped web app runs in demo mode on the same data model (local store);
-- deploy this migration + 0002_rls.sql and set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
-- to run against Supabase Auth + Postgres. Secrets never ship in frontend code.
create extension if not exists pgcrypto;

create type user_status as enum ('active','suspended','frozen');
create type kyc_status as enum ('unverified','pending','verified');
create type tx_status as enum ('pending','processing','completed','approved','rejected','active','repaid');
create type tx_category as enum ('add_money','cash_out','send','receive','referral','loan_disbursement','loan_repayment','crypto_buy','crypto_sell','adjustment');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null, phone text unique, username text unique not null,
  password_hash text, -- Supabase Auth owns credentials in production; never plain text
  pin_hash text not null, -- bcrypt/argon2 hash only
  role text not null default 'user' check (role in ('user','admin')),
  status user_status not null default 'active',
  referral_code text unique not null,
  referred_by uuid references users(id),
  two_fa_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint no_self_referral check (referred_by is null or referred_by <> id)
);
create table user_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  full_name text not null, avatar_url text, language text not null default 'en',
  theme text not null default 'dark', notification_prefs jsonb not null default '{}'
);
create table user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  device text, ip inet, created_at timestamptz not null default now(),
  expires_at timestamptz not null, revoked boolean not null default false
);
create table currencies (code text primary key, name text not null, kind text not null check (kind in ('fiat','crypto')), decimals int not null default 2, bdt_rate numeric(20,8));
insert into currencies values
 ('BDT','Bangladeshi Taka','fiat',2,1),('USD','US Dollar','fiat',2,121),
 ('BTC','Bitcoin','crypto',8,null),('ETH','Ethereum','crypto',8,null),
 ('USDT','Tether','crypto',6,null),('BNB','BNB','crypto',8,null),
 ('SOL','Solana','crypto',9,null),('XRP','XRP','crypto',6,null);
create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table wallet_balances (
  wallet_id uuid not null references wallets(id) on delete cascade,
  currency text not null references currencies(code),
  available numeric(24,8) not null default 0 check (available >= 0),
  locked numeric(24,8) not null default 0 check (locked >= 0),
  primary key (wallet_id, currency)
);
-- Immutable double-entry ledger: balances are derived, never edited directly.
create table transaction_ledger (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null, account text not null,
  debit numeric(24,8) not null default 0 check (debit >= 0),
  credit numeric(24,8) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  constraint debit_xor_credit check ((debit > 0) <> (credit > 0))
);
create table transactions (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null default ('TXN-' || upper(substr(md5(random()::text),1,10))),
  user_id uuid not null references users(id),
  category tx_category not null, title text not null,
  amount numeric(24,8) not null check (amount > 0), fee numeric(24,8) not null default 0,
  currency text not null references currencies(code),
  status tx_status not null default 'pending',
  note text, counterparty uuid references users(id), method text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index idx_tx_user_time on transactions(user_id, created_at desc);
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade, -- null = platform-owned receiving method
  kind text not null, label text not null, account_ref text not null, is_default boolean default false
);
create table deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id), method text not null,
  amount numeric(24,2) not null check (amount > 0), provider_trx_id text not null,
  receipt_url text, status tx_status not null default 'pending',
  reviewed_by uuid references users(id), created_at timestamptz not null default now(),
  unique (method, provider_trx_id)
);
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id), method text not null,
  amount numeric(24,2) not null check (amount > 0), fee numeric(24,2) not null default 0,
  destination text not null, status tx_status not null default 'pending',
  reviewed_by uuid references users(id), created_at timestamptz not null default now()
);
create table transfers (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id),
  from_user uuid not null references users(id), to_user uuid not null references users(id),
  amount numeric(24,2) not null check (amount > 0), fee numeric(24,2) not null default 0,
  constraint no_self_transfer check (from_user <> to_user)
);
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references users(id), referred_id uuid unique not null references users(id),
  created_at timestamptz not null default now()
);
create table referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references referrals(id),
  amount numeric(24,2) not null, source_transaction uuid references transactions(id),
  created_at timestamptz not null default now()
);
create table loan_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id), amount numeric(24,2) not null,
  months int not null check (months between 1 and 36), status tx_status not null default 'pending',
  reviewed_by uuid references users(id), created_at timestamptz not null default now()
);
create table loans (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references loan_applications(id),
  user_id uuid not null references users(id), principal numeric(24,2) not null,
  rate_pct numeric(6,2) not null, months int not null, emi numeric(24,2) not null,
  total_payable numeric(24,2) not null, paid numeric(24,2) not null default 0,
  status tx_status not null default 'active', created_at timestamptz not null default now()
);
create table loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id), amount numeric(24,2) not null check (amount > 0),
  transaction_id uuid references transactions(id), created_at timestamptz not null default now()
);
create table crypto_assets (symbol text primary key, name text not null, gecko_id text not null, is_active boolean default true);
insert into crypto_assets values ('BTC','Bitcoin','bitcoin',true),('ETH','Ethereum','ethereum',true),('USDT','Tether','tether',true),('BNB','BNB','binancecoin',true),('SOL','Solana','solana',true),('XRP','XRP','ripple',true);
create table crypto_prices (
  id bigserial primary key, symbol text not null references crypto_assets(symbol),
  price_usd numeric(24,8) not null, change_24h numeric(8,2), market_cap numeric(24,2),
  source text not null default 'coingecko', captured_at timestamptz not null default now()
);
create table watchlists (
  user_id uuid not null references users(id) on delete cascade,
  symbol text not null references crypto_assets(symbol), primary key (user_id, symbol)
);
create table news (
  id uuid primary key default gen_random_uuid(), title text not null, category text not null,
  excerpt text not null, body text not null, source text not null, featured boolean default false,
  published_by uuid references users(id), created_at timestamptz not null default now()
);
create table notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade,
  kind text not null, title text not null, body text not null, is_read boolean default false,
  created_at timestamptz not null default now()
);
create table kyc_submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id),
  doc_type text not null, doc_number text not null, doc_url text,
  status kyc_status not null default 'pending', reviewed_by uuid references users(id),
  created_at timestamptz not null default now()
);
create table support_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id),
  subject text not null, message text not null, status text not null default 'open',
  created_at timestamptz not null default now()
);
create table banners (
  id uuid primary key default gen_random_uuid(), title text not null, subtitle text,
  gradient text, is_active boolean default true, sort_order int default 0
);
create table platform_settings (key text primary key, value jsonb not null);
insert into platform_settings values
 ('fees','{"send_pct":0.5,"cashout_pct":1.5}'), ('referral','{"commission_pct":5}'),
 ('loan','{"rate_pct":12,"min":1000,"max":100000,"limit":100000}'),
 ('rates','{"bdt_per_usd":121}'), ('maintenance','{"enabled":false}');
create table admin_users (user_id uuid primary key references users(id), created_at timestamptz not null default now());
create table admin_roles (id uuid primary key default gen_random_uuid(), name text unique not null);
insert into admin_roles (name) values ('super_admin'),('finance'),('content'),('support');
create table admin_permissions (
  role_id uuid not null references admin_roles(id), permission text not null,
  primary key (role_id, permission)
);
create table audit_logs (
  id uuid primary key default gen_random_uuid(), actor uuid references users(id),
  action text not null, detail jsonb, ip inet, created_at timestamptz not null default now()
);
-- Atomic transfer function: validates balance server-side, writes both tx rows + ledger pair.
create or replace function transfer_funds(p_from uuid, p_to uuid, p_amount numeric, p_fee numeric, p_idem text)
returns uuid language plpgsql as $$
declare v_tx uuid; v_avail numeric;
begin
  if p_from = p_to then raise exception 'self transfer not allowed'; end if;
  select available into v_avail from wallet_balances wb join wallets w on w.id = wb.wallet_id
    where w.user_id = p_from and wb.currency = 'BDT' for update;
  if v_avail is null or v_avail < p_amount + p_fee then raise exception 'insufficient balance'; end if;
  insert into transactions (user_id, category, title, amount, fee, currency, status, counterparty, idempotency_key)
    values (p_from, 'send', 'Send money', p_amount, p_fee, 'BDT', 'completed', p_to, p_idem) returning id into v_tx;
  update wallet_balances set available = available - (p_amount + p_fee)
    where wallet_id = (select id from wallets where user_id = p_from) and currency = 'BDT';
  update wallet_balances set available = available + p_amount
    where wallet_id = (select id from wallets where user_id = p_to) and currency = 'BDT';
  insert into transaction_ledger (transaction_id, account, debit) values (v_tx, 'wallet:' || p_from, p_amount + p_fee);
  insert into transaction_ledger (transaction_id, account, credit) values (v_tx, 'wallet:' || p_to, p_amount + p_fee);
  insert into transfers (transaction_id, from_user, to_user, amount, fee) values (v_tx, p_from, p_to, p_amount, p_fee);
  return v_tx;
end $$;
