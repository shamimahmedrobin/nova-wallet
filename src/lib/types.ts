export type Role = 'user' | 'admin'
export type UserStatus = 'active' | 'suspended' | 'frozen'
export type KycStatus = 'unverified' | 'pending' | 'verified'
export type TxStatus = 'pending' | 'processing' | 'completed' | 'approved' | 'rejected' | 'active' | 'repaid' | 'held' | 'cancelled'
export type TxCategory =
  | 'add_money' | 'cash_out' | 'send' | 'receive' | 'referral'
  | 'loan_disbursement' | 'loan_repayment' | 'crypto_buy' | 'crypto_sell' | 'adjustment'
  | 'direct_withdraw' | 'earn' | 'swap'

export interface User {
  id: string; name: string; username: string; email: string; phone: string
  passwordHash: string; pinHash: string; role: Role; status: UserStatus; kyc: KycStatus
  referralCode: string; referredBy: string | null; twoFA: boolean; level: number; loanLimitOverride?: number
  /** Firebase UID once the account is linked to the backend (Phase 1+). */
  fbUid?: string
  /** RBAC scope for admin accounts (server-side, D1 users.admin_scope):
      'full' (owner) | 'finance' | 'content' | 'support'. Absent = full. */
  adminScope?: string
  /** Directory-only record hydrated from the server (not a local account):
      exists so Send/Admin can find real users across devices. Never a
      login target. */
  stub?: boolean
  payMethods?: { id: string; type: 'bank' | 'crypto'; label: string; detail: string }[]
  language: string; currency?: string; photo?: string; kycDocType?: string; kycDocNumber?: string; kycDocPhoto?: string; kycFacePhoto?: string; kycSubmittedAt?: string; resetOtpHash?: string; resetOtpExpires?: number; createdAt: string; lastLogin: string
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
  /** Automation-ready routing data: which channel (PayMethod id + kind), how it
      settles, and the normalized reference (trxId trimmed + uppercased) that a
      future provider/matcher keys on. providerRef is filled by the provider
      when it settles the deposit. */
  methodId?: string; kind?: 'bank' | 'crypto'; verification?: 'manual' | 'auto'
  reference?: string; providerRef?: string
}
export interface WithdrawReq {
  id: string; userId: string; method: string; amount: number; fee: number; destination: string
  status: 'pending' | 'processing' | 'completed' | 'rejected'; createdAt: string
}
export interface Loan {
  id: string; userId: string; amount: number; months: number; ratePct: number
  emi: number; totalPayable: number; paid: number
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'repaid'; createdAt: string
  applicantName?: string; phone?: string; whatsapp?: string; nid?: string; photo?: string
  idType?: string; idPhoto?: string
  guarantorName?: string; guarantorPhone?: string
  processingFee?: number; feeStatus?: 'unpaid' | 'submitted' | 'paid'; feeMethod?: string; feeTxRef?: string
}
export interface LoanInfo { applicantName: string; phone: string; whatsapp: string; nid: string; photo: string; guarantorName: string; guarantorPhone: string; idType: string; idPhoto: string }

export interface EarnState { userId: string; day: string; lastCheckin: string; streak: number; ads: number; spins: number; scratches: number; tasksDone: string[]; quizDay: string }
export interface PayMethod {
  id: string
  kind: 'bank' | 'crypto'
  /** Bank name (e.g. "BRAC Bank") or coin name (e.g. "USDT"). */
  label: string
  accountName?: string
  /** Bank account number, or the crypto wallet address. */
  accountNumber?: string
  routing?: string
  swift?: string
  branch?: string
  /** Crypto only, e.g. "Tron (TRC20)". */
  network?: string
  /** Legacy free-text details (older entries). */
  detail?: string
  /** How deposits on this channel settle: 'manual' = admin review (default);
      'auto' = a connected provider (bank API / gateway callback / SMS-webhook
      matcher) settles them through the same pipeline — see settleDepositExternal. */
  verification?: 'manual' | 'auto'
}
export interface NewsItem {
  id: string; title: string; category: string; excerpt: string; body: string
  source: string; date: string; featured: boolean; gradient: string; coin?: string
}
export interface LevelDef {
  level: number; name: string; tagline: string; dailyLimit: number; monthlyLimit: number
  loanLimit: number; depositRequired: number; feeDiscountPct: number; requirement: string; gradient: string
}
export interface LevelRequest {
  id: string; userId: string; fromLevel: number; toLevel: number
  status: 'pending' | 'approved' | 'rejected'; createdAt: string
}
export interface Banner { id: string; title: string; subtitle: string; gradient: string; active: boolean }
export interface Notif { id: string; userId: string; title: string; body: string; kind: string; read: boolean; createdAt: string; /** Exact deep link (route, may carry ?tab= / ?user= for Admin) — wins over the kind-based route when set. */ link?: string }
export interface Settings {
  sendFeePct: number; cashoutFeePct: number; referralPct: number
  loanRatePct: number; minLoan: number; maxLoan: number; loanLimit: number
  bdtPerUsd: number; maintenance: boolean; platformName: string
  payMethods: PayMethod[]
  /** Per-feature switches the owner can flip from Admin → Settings.
   * The Worker enforces them server-side; the app only mirrors them. */
  features?: { deposits: boolean; withdrawals: boolean; trading: boolean; loans: boolean; registration: boolean }
}
export interface Audit { id: string; actor: string; action: string; detail: string; createdAt: string }
export interface ChatMsg { id: string; from: 'user' | 'admin'; text: string; at: string }
export interface SupportTicket { id: string; userId: string; subject: string; message?: string; status: 'pending' | 'processing' | 'resolved'; createdAt: string; updatedAt: string; messages: ChatMsg[] }

export interface Stake { id: string; userId: string; amount: number; apy: number; termDays: number; startAt: string; status: 'active' | 'closed'; /** Set once the 'stake matured' notification has been sent. */ maturedNotified?: boolean }
export interface DB {
  users: User[]; wallets: Wallet[]; txs: Tx[]; ledger: LedgerEntry[]
  deposits: DepositReq[]; withdrawals: WithdrawReq[]; loans: Loan[]
  news: NewsItem[]; banners: Banner[]; notifications: Notif[]
  settings: Settings; audit: Audit[]; tickets: SupportTicket[]
  levels: LevelDef[]; levelRequests: LevelRequest[]; stakes: Stake[]; earnStates: EarnState[]; sec: Record<string, { fails: number; lockedUntil: number }>
  watchlist: Record<string, string[]>; referralEarnings: { id: string; userId: string; fromUser: string; amount: number; createdAt: string }[]
}
