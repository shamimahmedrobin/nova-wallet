export type Role = 'user' | 'admin'
export type UserStatus = 'active' | 'suspended' | 'frozen'
export type KycStatus = 'unverified' | 'pending' | 'verified'
export type TxStatus = 'pending' | 'processing' | 'completed' | 'approved' | 'rejected' | 'active' | 'repaid'
export type TxCategory =
  | 'add_money' | 'cash_out' | 'send' | 'receive' | 'referral'
  | 'loan_disbursement' | 'loan_repayment' | 'crypto_buy' | 'crypto_sell' | 'adjustment'

export interface User {
  id: string; name: string; username: string; email: string; phone: string
  passwordHash: string; pinHash: string; role: Role; status: UserStatus; kyc: KycStatus
  referralCode: string; referredBy: string | null; twoFA: boolean
  language: 'en' | 'bn'; createdAt: string; lastLogin: string
  sessions: { id: string; device: string; at: string; current: boolean }[]
}
export interface Wallet { userId: string; available: number; locked: number; holdings: Record<string, number> }
export interface Tx {
  id: string; userId: string; category: TxCategory; title: string
  amount: number; fee: number; currency: string; status: TxStatus
  note?: string; counterparty?: string; method?: string; createdAt: string
}
export interface LedgerEntry { id: string; txId: string; account: string; debit: number; credit: number; createdAt: string }
export interface DepositReq {
  id: string; userId: string; method: string; amount: number; trxId: string
  receipt?: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string
}
export interface WithdrawReq {
  id: string; userId: string; method: string; amount: number; fee: number; destination: string
  status: 'pending' | 'processing' | 'completed' | 'rejected'; createdAt: string
}
export interface Loan {
  id: string; userId: string; amount: number; months: number; ratePct: number
  emi: number; totalPayable: number; paid: number
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'repaid'; createdAt: string
}
export interface NewsItem {
  id: string; title: string; category: string; excerpt: string; body: string
  source: string; date: string; featured: boolean; gradient: string
}
export interface Banner { id: string; title: string; subtitle: string; gradient: string; active: boolean }
export interface Notif { id: string; userId: string; title: string; body: string; kind: string; read: boolean; createdAt: string }
export interface Settings {
  sendFeePct: number; cashoutFeePct: number; referralPct: number
  loanRatePct: number; minLoan: number; maxLoan: number; loanLimit: number
  bdtPerUsd: number; maintenance: boolean; platformName: string
}
export interface Audit { id: string; actor: string; action: string; detail: string; createdAt: string }
export interface SupportTicket { id: string; userId: string; subject: string; message: string; status: 'open' | 'closed'; createdAt: string }

export interface DB {
  users: User[]; wallets: Wallet[]; txs: Tx[]; ledger: LedgerEntry[]
  deposits: DepositReq[]; withdrawals: WithdrawReq[]; loans: Loan[]
  news: NewsItem[]; banners: Banner[]; notifications: Notif[]
  settings: Settings; audit: Audit[]; tickets: SupportTicket[]
  watchlist: Record<string, string[]>; referralEarnings: { id: string; userId: string; fromUser: string; amount: number; createdAt: string }[]
}
