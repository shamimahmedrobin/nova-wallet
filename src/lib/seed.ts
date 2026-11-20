import type { DB, LevelDef } from './types'

export const DEFAULT_PAY_METHODS = [
  { id: 'bank', kind: 'bank' as const, label: 'BRAC Bank', accountName: 'NovaWallet', accountNumber: '1501200000001', routing: '060261234', swift: 'BRAKBDDH', branch: 'Sylhet Branch' },
  { id: 'crypto', kind: 'crypto' as const, label: 'USDT', network: 'Tron (TRC20)', accountName: 'NovaWallet', accountNumber: 'TNovaWalletAddressExample123456789' },
]

export const DEFAULT_LEVELS: LevelDef[] = [
  { level: 1, name: 'Level 1', tagline: 'Start your wallet journey', dailyLimit: 25000, monthlyLimit: 200000, loanLimit: 10000, depositRequired: 0, feeDiscountPct: 0, requirement: 'Default for every new account', gradient: 'from-slate-500 to-slate-700' },
  { level: 2, name: 'Level 2', tagline: 'For verified everyday users', dailyLimit: 50000, monthlyLimit: 500000, loanLimit: 30000, depositRequired: 10000, feeDiscountPct: 5, requirement: 'KYC verified', gradient: 'from-slate-400 to-slate-600' },
  { level: 3, name: 'Level 3', tagline: 'Higher limits, lower fees', dailyLimit: 100000, monthlyLimit: 1000000, loanLimit: 60000, depositRequired: 50000, feeDiscountPct: 10, requirement: 'KYC verified + 20 completed transactions', gradient: 'from-amber-500 to-yellow-600' },
  { level: 4, name: 'Level 4', tagline: 'Maximum limits, priority support', dailyLimit: 250000, monthlyLimit: 2500000, loanLimit: 100000, depositRequired: 200000, feeDiscountPct: 20, requirement: 'KYC verified + 50 transactions + admin review', gradient: 'from-violet-600 to-indigo-700' },
]

// Clean production seed (2026-11-21, at the owner's order): NO demo users,
// balances, transactions, loans, tickets or news. The database starts empty
// and fills with real accounts only. What remains is platform configuration
// (levels, fees, payment rails, marketing banners) that an admin manages.
export function seedDB(): DB {
  return {
    users: [], wallets: [], txs: [], ledger: [],
    deposits: [], withdrawals: [], loans: [], news: [],
    banners: [
      { id: 'b1', title: 'Earn 5% on every referral', subtitle: 'Invite friends, earn commission on their fees — forever.', gradient: 'from-violet-600 via-purple-600 to-indigo-600', active: true },
      { id: 'b2', title: 'Instant loan up to ৳100,000', subtitle: 'Apply in 2 minutes. Admin-reviewed, transparent EMI.', gradient: 'from-cyan-600 via-blue-600 to-indigo-700', active: true },
      { id: 'b3', title: 'Zero-fee USDT deposits', subtitle: 'Deposit crypto directly to your NovaWallet address.', gradient: 'from-emerald-600 via-teal-600 to-cyan-700', active: true },
    ],
    notifications: [],
    settings: { sendFeePct: 0.5, cashoutFeePct: 1.5, referralPct: 5, loanRatePct: 12, minLoan: 1000, maxLoan: 100000, loanLimit: 100000, bdtPerUsd: 121, maintenance: false, platformName: 'NovaWallet', payMethods: DEFAULT_PAY_METHODS },
    audit: [], tickets: [],
    levels: DEFAULT_LEVELS,
    levelRequests: [], stakes: [], earnStates: [],
    watchlist: {},
    sec: {},
    referralEarnings: [],
  }
}
