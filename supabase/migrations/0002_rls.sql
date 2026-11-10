-- NovaWallet — Row Level Security
-- Principle: users see only their own rows; admins (admin_users) see all.
-- All balance mutations go through SECURITY DEFINER functions / Edge Functions
-- that re-validate amounts server-side. The client never writes wallet_balances directly.
alter table users enable row level security;
alter table user_profiles enable row level security;
alter table user_sessions enable row level security;
alter table wallets enable row level security;
alter table wallet_balances enable row level security;
alter table transaction_ledger enable row level security;
alter table transactions enable row level security;
alter table deposits enable row level security;
alter table withdrawals enable row level security;
alter table transfers enable row level security;
alter table referrals enable row level security;
alter table referral_commissions enable row level security;
alter table loan_applications enable row level security;
alter table loans enable row level security;
alter table loan_repayments enable row level security;
alter table watchlists enable row level security;
alter table notifications enable row level security;
alter table kyc_submissions enable row level security;
alter table support_tickets enable row level security;
alter table news enable row level security;
alter table banners enable row level security;
alter table audit_logs enable row level security;

create or replace function is_admin() returns boolean language sql stable as
$$ select exists (select 1 from admin_users where user_id = auth.uid()) $$;

create policy own_profile on user_profiles for all using (user_id = auth.uid() or is_admin());
create policy own_sessions on user_sessions for all using (user_id = auth.uid() or is_admin());
create policy own_wallet on wallets for select using (user_id = auth.uid() or is_admin());
create policy own_balances on wallet_balances for select using (
  wallet_id in (select id from wallets where user_id = auth.uid()) or is_admin());
create policy own_ledger on transaction_ledger for select using (
  account = 'wallet:' || auth.uid()::text or is_admin());
create policy own_tx on transactions for select using (user_id = auth.uid() or is_admin());
create policy own_deposits on deposits for all using (user_id = auth.uid() or is_admin());
create policy own_withdrawals on withdrawals for all using (user_id = auth.uid() or is_admin());
create policy own_transfers on transfers for select using (from_user = auth.uid() or to_user = auth.uid() or is_admin());
create policy own_referrals on referrals for select using (referrer_id = auth.uid() or referred_id = auth.uid() or is_admin());
create policy own_commissions on referral_commissions for select using (
  referral_id in (select id from referrals where referrer_id = auth.uid()) or is_admin());
create policy own_loan_apps on loan_applications for all using (user_id = auth.uid() or is_admin());
create policy own_loans on loans for select using (user_id = auth.uid() or is_admin());
create policy own_repayments on loan_repayments for select using (
  loan_id in (select id from loans where user_id = auth.uid()) or is_admin());
create policy own_watchlist on watchlists for all using (user_id = auth.uid());
create policy own_notifications on notifications for all using (user_id = auth.uid() or is_admin());
create policy own_kyc on kyc_submissions for all using (user_id = auth.uid() or is_admin());
create policy own_tickets on support_tickets for all using (user_id = auth.uid() or is_admin());
create policy public_news on news for select using (true);
create policy admin_news_write on news for all using (is_admin());
create policy public_banners on banners for select using (is_active);
create policy admin_audit on audit_logs for select using (is_admin());
-- users table: read own row / admin reads all; writes via Edge Functions only.
create policy own_user_row on users for select using (id = auth.uid() or is_admin());
