-- NovaWallet — account levels (Level 1–4), admin-managed
create table account_levels (
  level int primary key check (level between 1 and 4),
  name text not null, tagline text,
  daily_limit numeric(24,2) not null, monthly_limit numeric(24,2) not null,
  loan_limit numeric(24,2) not null, fee_discount_pct numeric(5,2) not null default 0,
  requirement text
);
insert into account_levels values
  (1,'Basic','Start your wallet journey',25000,200000,10000,0,'Default for every new account'),
  (2,'Silver','For verified everyday users',50000,500000,30000,5,'KYC verified'),
  (3,'Gold','Higher limits, lower fees',100000,1000000,60000,10,'KYC verified + 20 completed transactions'),
  (4,'Platinum','Maximum limits, priority support',250000,2500000,100000,20,'KYC verified + 50 transactions + admin review');
alter table users add column level int not null default 1 references account_levels(level);
create table level_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  from_level int not null, to_level int not null,
  status tx_status not null default 'pending',
  reviewed_by uuid references users(id),
  created_at timestamptz not null default now(),
  constraint next_level_only check (to_level = from_level + 1)
);
create unique index one_pending_upgrade_per_user
  on level_upgrade_requests(user_id) where status = 'pending';
alter table account_levels enable row level security;
alter table level_upgrade_requests enable row level security;
create policy public_levels on account_levels for select using (true);
create policy admin_levels_write on account_levels for all using (is_admin());
create policy own_upgrade_requests on level_upgrade_requests for all using (user_id = auth.uid() or is_admin());
-- News items carry a crypto logo key shown instead of a letter tile.
alter table news add column coin text default 'NOVA';
