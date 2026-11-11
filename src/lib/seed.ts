import type { DB, LevelDef, User } from './types'
import { hashSecret } from './utils'

export const DEFAULT_PAY_METHODS = [
  { id: 'bkash', label: 'bKash', detail: '01712-345678 (Personal)' },
  { id: 'nagad', label: 'Nagad', detail: '01712-345678 (Personal)' },
  { id: 'rocket', label: 'Rocket', detail: '01712-3456789 (Personal)' },
  { id: 'bank', label: 'Bank Transfer', detail: 'BRAC Bank · A/C 1501200000001 · NovaWallet' },
  { id: 'usdt', label: 'USDT (TRC20)', detail: 'TNovaWalletAddressExample123456789' },
]

const d = (daysAgo: number, h = 10) => {
  const t = new Date(); t.setDate(t.getDate() - daysAgo); t.setHours(h, 15, 0, 0); return t.toISOString()
}
function mkUser(p: Partial<User> & Pick<User, 'name' | 'username' | 'email'>): User {
  return {
    id: p.id ?? 'USR-' + p.username.toUpperCase().padEnd(4, '0').slice(0, 6),
    phone: p.phone ?? '01700000000', passwordHash: hashSecret(p.passwordHash ?? '123456'),
    pinHash: hashSecret(p.pinHash ?? '1234'), role: p.role ?? 'user',
    status: p.status ?? 'active', kyc: p.kyc ?? 'verified',
    referralCode: p.referralCode ?? ('NOVA-' + p.username.toUpperCase().slice(0, 5)),
    referredBy: p.referredBy ?? null, twoFA: p.twoFA ?? false, level: p.level ?? 1, language: 'en',
    createdAt: p.createdAt ?? d(90), lastLogin: d(0, 8),
    name: p.name, username: p.username, email: p.email,
    sessions: [{ id: 's1', device: 'Android · Chrome', at: d(0, 8), current: true }],
  }
}

export const DEFAULT_LEVELS: LevelDef[] = [
  { level: 1, name: 'Level 1', tagline: 'Start your wallet journey', dailyLimit: 25000, monthlyLimit: 200000, loanLimit: 10000, feeDiscountPct: 0, requirement: 'Default for every new account', gradient: 'from-slate-500 to-slate-700' },
  { level: 2, name: 'Level 2', tagline: 'For verified everyday users', dailyLimit: 50000, monthlyLimit: 500000, loanLimit: 30000, feeDiscountPct: 5, requirement: 'KYC verified', gradient: 'from-slate-400 to-slate-600' },
  { level: 3, name: 'Level 3', tagline: 'Higher limits, lower fees', dailyLimit: 100000, monthlyLimit: 1000000, loanLimit: 60000, feeDiscountPct: 10, requirement: 'KYC verified + 20 completed transactions', gradient: 'from-amber-500 to-yellow-600' },
  { level: 4, name: 'Level 4', tagline: 'Maximum limits, priority support', dailyLimit: 250000, monthlyLimit: 2500000, loanLimit: 100000, feeDiscountPct: 20, requirement: 'KYC verified + 50 transactions + admin review', gradient: 'from-violet-600 to-indigo-700' },
]
export function seedDB(): DB {
  const admin = mkUser({ id: 'USR-ADMIN1', name: 'Nova Admin', username: 'admin', email: 'admin@novawallet.app', phone: '01900000001', passwordHash: 'admin123', pinHash: '9999', role: 'admin', level: 4 })
  const shamim = mkUser({ id: 'USR-SHAMIM', name: 'Shamim Ahmed Robin', username: 'shamim', email: 'shamim@novawallet.app', phone: '01712345678', referralCode: 'NOVA-SHAMIM', level: 2 })
  const arif = mkUser({ name: 'Arif Hossain', username: 'arif', email: 'arif@gmail.com', phone: '01811112222', referredBy: shamim.id, level: 2 })
  const nusrat = mkUser({ name: 'Nusrat Jahan', username: 'nusrat', email: 'nusrat@gmail.com', phone: '01633334444', referredBy: shamim.id, level: 3 })
  const tanvir = mkUser({ name: 'Tanvir Islam', username: 'tanvir', email: 'tanvir@gmail.com', phone: '01555556666', referredBy: shamim.id, kyc: 'pending' })
  const priya = mkUser({ name: 'Priya Das', username: 'priya', email: 'priya@gmail.com', phone: '01777778888', referredBy: arif.id, level: 2 })
  const karim = mkUser({ name: 'Karim Ullah', username: 'karim', email: 'karim@gmail.com', phone: '01999990000', status: 'suspended', kyc: 'unverified' })
  const users = [admin, shamim, arif, nusrat, tanvir, priya, karim]

  const wallets: DB['wallets'] = [
    { userId: admin.id, available: 0, locked: 0, holdings: {} },
    { userId: shamim.id, available: 84500, locked: 5000, holdings: { BTC: 0.0482, ETH: 0.85, USDT: 1250, BNB: 1.4, SOL: 6.2, XRP: 900 } },
    { userId: arif.id, available: 23500, locked: 0, holdings: { BTC: 0.012, USDT: 300 } },
    { userId: nusrat.id, available: 41200, locked: 2000, holdings: { ETH: 0.4, SOL: 3 } },
    { userId: tanvir.id, available: 9800, locked: 0, holdings: { USDT: 150 } },
    { userId: priya.id, available: 15750, locked: 0, holdings: { BNB: 0.6 } },
    { userId: karim.id, available: 3200, locked: 0, holdings: {} },
  ]

  let n = 0
  const tx = (userId: string, category: any, title: string, amount: number, status: any, days: number, extra: any = {}) => ({
    id: 'TXN-' + (884120 + ++n), userId, category, title, amount, fee: extra.fee ?? 0,
    currency: extra.currency ?? 'BDT', status, note: extra.note, counterparty: extra.counterparty,
    method: extra.method, createdAt: d(days, 9 + (n % 10)),
  })

  const txs = [
    tx(shamim.id, 'add_money', 'Add Money via bKash', 50000, 'completed', 12, { method: 'bKash' }),
    tx(shamim.id, 'crypto_buy', 'Bought Bitcoin', 62000, 'completed', 11, { currency: 'BTC' }),
    tx(shamim.id, 'send', 'Sent to Arif Hossain', 5000, 'completed', 9, { fee: 25, counterparty: 'Arif Hossain' }),
    tx(shamim.id, 'receive', 'Received from Nusrat Jahan', 7500, 'completed', 8, { counterparty: 'Nusrat Jahan' }),
    tx(shamim.id, 'referral', 'Referral commission', 250, 'completed', 7),
    tx(shamim.id, 'cash_out', 'Cash Out to Nagad', 10000, 'completed', 6, { fee: 150, method: 'Nagad' }),
    tx(shamim.id, 'crypto_sell', 'Sold Solana', 8400, 'completed', 4, { currency: 'SOL' }),
    tx(shamim.id, 'loan_disbursement', 'Loan disbursed', 30000, 'completed', 20),
    tx(shamim.id, 'loan_repayment', 'Loan repayment (EMI 1)', 2713, 'completed', 5),
    tx(shamim.id, 'add_money', 'Add Money via Nagad', 20000, 'completed', 2, { method: 'Nagad' }),
    tx(shamim.id, 'send', 'Sent to Tanvir Islam', 2500, 'completed', 1, { fee: 12.5, counterparty: 'Tanvir Islam' }),
    tx(arif.id, 'receive', 'Received from Shamim Ahmed Robin', 5000, 'completed', 9, { counterparty: 'Shamim Ahmed Robin' }),
    tx(nusrat.id, 'send', 'Sent to Shamim Ahmed Robin', 7500, 'completed', 8, { fee: 37.5, counterparty: 'Shamim Ahmed Robin' }),
  ]

  return {
    users, wallets, txs,
    ledger: txs.map((t, i) => ({ id: 'LED-' + (5000 + i), txId: t.id, account: 'wallet:' + t.userId, debit: t.amount, credit: t.amount, createdAt: t.createdAt })),
    deposits: [
      { id: 'DEP-101', userId: nusrat.id, method: 'bKash', amount: 15000, trxId: 'BKX92KD81P', status: 'pending', createdAt: d(0, 11) },
      { id: 'DEP-102', userId: tanvir.id, method: 'Nagad', amount: 8000, trxId: 'NGD77XA20Q', status: 'pending', createdAt: d(0, 9) },
      { id: 'DEP-099', userId: shamim.id, method: 'bKash', amount: 50000, trxId: 'BKX51MN90Z', status: 'approved', createdAt: d(12) },
    ],
    withdrawals: [
      { id: 'WDR-201', userId: arif.id, method: 'bKash', amount: 12000, fee: 180, destination: '01811112222', status: 'pending', createdAt: d(0, 10) },
      { id: 'WDR-199', userId: shamim.id, method: 'Nagad', amount: 10000, fee: 150, destination: '01712345678', status: 'completed', createdAt: d(6) },
    ],
    loans: [
      { id: 'LOAN-301', userId: shamim.id, amount: 30000, months: 12, ratePct: 12, emi: 2665, totalPayable: 31980, paid: 2665, status: 'active', createdAt: d(20) },
      { id: 'LOAN-302', userId: priya.id, amount: 50000, months: 6, ratePct: 12, emi: 8627, totalPayable: 51764, paid: 0, status: 'pending', createdAt: d(0, 12) },
    ],
    news: [
      { id: 'n1', title: 'Bitcoin Holds Above Key Support as ETF Inflows Return', category: 'Bitcoin', excerpt: 'BTC steadied this week as spot ETF inflows turned positive again and exchange reserves kept falling.', body: 'Bitcoin traded in a tight range this week as institutional demand through spot ETFs returned. Analysts point to falling exchange balances as a sign that long-term holders are not selling into strength.\n\nOn-chain data shows the number of addresses holding at least 0.1 BTC at a record high. Traders are watching the next resistance zone closely; a daily close above it would open the door to a fresh leg up.\n\nAs always, market prices shown in NovaWallet come from public market data and are indicative — the executable price at the moment of a trade is confirmed before you buy or sell.', source: 'Nova Market Desk', date: d(0), featured: true, coin: 'BTC', gradient: 'from-orange-500 to-amber-600' },
      { id: 'n2', title: 'Ethereum Upgrade Promises Cheaper Layer-2 Fees', category: 'Ethereum', excerpt: 'The next Ethereum upgrade focuses on blob capacity, which should push L2 transaction costs even lower.', body: 'Ethereum developers confirmed the next network upgrade will increase blob throughput, cutting data costs for layer-2 rollups.\n\nCheaper L2 fees matter for everyday users in markets like Bangladesh, where small transaction sizes make fees proportionally painful.\n\nStaking yields remain stable, and ETH supply has been roughly flat since the merge.', source: 'Nova Market Desk', date: d(1), featured: false, coin: 'ETH', gradient: 'from-indigo-500 to-violet-600' },
      { id: 'n3', title: 'Stablecoins in Remittance: Why USDT Volumes Keep Growing in South Asia', category: 'Market Analysis', excerpt: 'Low cost and speed are driving stablecoin use for cross-border transfers across the region.', body: 'Stablecoin transfer volumes in South Asia have grown steadily as freelancers and remote workers look for faster settlement than traditional banking rails.\n\nUSDT remains the dominant pair against BDT in peer markets. Users should remember that stablecoins carry issuer and regulatory risk, and prices can deviate briefly from one dollar during stress.', source: 'Nova Research', date: d(2), featured: false, coin: 'USDT', gradient: 'from-emerald-500 to-teal-600' },
      { id: 'n4', title: 'What Is a Double-Entry Ledger — and Why Your Wallet Needs One', category: 'Blockchain', excerpt: 'Every taka in NovaWallet is backed by balanced ledger entries. Here is how that protects you.', body: 'In a double-entry system, every movement of money creates equal debit and credit entries. Balances are never edited directly; they are the sum of audited entries.\n\nThat means any discrepancy can be traced to an exact transaction, timestamp and actor — the same standard banks use.\n\nNovaWallet records an immutable ledger entry for every deposit, withdrawal, transfer, trade and loan event.', source: 'Nova Academy', date: d(3), featured: false, coin: 'NOVA', gradient: 'from-violet-500 to-purple-700' },
      { id: 'n5', title: 'Solana DeFi Activity Reaches New Highs', category: 'Blockchain', excerpt: 'DEX volumes and active addresses on Solana climbed again this month.', body: 'Solana decentralised exchange volumes hit fresh highs as memecoin activity cooled and real payment use cases grew.\n\nNetwork fees remain a fraction of a cent, keeping Solana popular for high-frequency applications.', source: 'Nova Market Desk', date: d(4), featured: false, coin: 'SOL', gradient: 'from-fuchsia-500 to-pink-600' },
    ],
    banners: [
      { id: 'b1', title: 'Earn 5% on every referral', subtitle: 'Invite friends, earn commission on their fees — forever.', gradient: 'from-violet-600 via-purple-600 to-indigo-600', active: true },
      { id: 'b2', title: 'Instant loan up to ৳1,00,000', subtitle: 'Apply in 2 minutes. Admin-reviewed, transparent EMI.', gradient: 'from-cyan-600 via-blue-600 to-indigo-700', active: true },
      { id: 'b3', title: 'Zero-fee USDT deposits', subtitle: 'Deposit crypto directly to your NovaWallet address.', gradient: 'from-emerald-600 via-teal-600 to-cyan-700', active: true },
    ],
    notifications: [
      { id: 'nt1', userId: shamim.id, title: 'Money received', body: 'You received ৳7,500 from Nusrat Jahan.', kind: 'receive', read: false, createdAt: d(0, 9) },
      { id: 'nt2', userId: shamim.id, title: 'Loan EMI reminder', body: 'Your next EMI of ৳2,665 is due in 5 days.', kind: 'loan', read: false, createdAt: d(0, 8) },
      { id: 'nt3', userId: shamim.id, title: 'Price alert: BTC', body: 'Bitcoin moved +2.4% in the last 24 hours.', kind: 'market', read: true, createdAt: d(1) },
    ],
    settings: { sendFeePct: 0.5, cashoutFeePct: 1.5, referralPct: 5, loanRatePct: 12, minLoan: 1000, maxLoan: 100000, loanLimit: 100000, bdtPerUsd: 121, maintenance: false, platformName: 'NovaWallet', payMethods: DEFAULT_PAY_METHODS },
    audit: [
      { id: 'a1', actor: 'admin', action: 'deposit.approve', detail: 'Approved DEP-099 ৳50,000 for shamim', createdAt: d(12) },
      { id: 'a2', actor: 'system', action: 'loan.disburse', detail: 'LOAN-301 ৳30,000 disbursed to shamim', createdAt: d(20) },
    ],
    tickets: [],
    levels: DEFAULT_LEVELS,
    levelRequests: [
      { id: 'LVR-101', userId: tanvir.id, fromLevel: 1, toLevel: 2, status: 'pending', createdAt: d(0, 12) },
    ], stakes: [],
    watchlist: { [shamim.id]: ['BTC', 'ETH', 'SOL'] },
    referralEarnings: [
      { id: 're1', userId: shamim.id, fromUser: 'Arif Hossain', amount: 125, createdAt: d(7) },
      { id: 're2', userId: shamim.id, fromUser: 'Nusrat Jahan', amount: 80, createdAt: d(5) },
      { id: 're3', userId: shamim.id, fromUser: 'Tanvir Islam', amount: 45, createdAt: d(3) },
    ],
  }
}
