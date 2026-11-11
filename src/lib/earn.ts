// Reward-earn configuration: daily check-in, ads, spin wheel, scratch cards,
// tasks and the daily quiz. All rewards are credited in BDT by the store.
export const CHECKIN_REWARDS = [10, 15, 20, 25, 30, 40, 50]
export const ADS_PER_DAY = 10
export const SPINS_PER_DAY = 5
export const SCRATCH_PER_DAY = 3
export const WHEEL_PRIZES = [5, 20, 2, 50, 10, 0, 15, 5]
export const SCRATCH_PRIZES = [0, 5, 10, 5, 25, 5, 50, 10]
export const QUIZ_PER_CORRECT = 4

export interface EarnTask { id: string; icon: string; title: string; desc: string; reward: number }
export const EARN_TASKS: EarnTask[] = [
  { id: 'yt', icon: '▶️', title: 'Subscribe on YouTube', desc: 'Subscribe to the NovaWallet YouTube channel', reward: 15 },
  { id: 'tg', icon: '✈️', title: 'Join Telegram community', desc: 'Join our Telegram channel for news and offers', reward: 10 },
  { id: 'fb', icon: '👍', title: 'Follow on Facebook', desc: 'Follow the NovaWallet Facebook page', reward: 10 },
  { id: 'tutorial', icon: '🎓', title: 'Watch the app tutorial', desc: 'Watch the 2-minute getting-started video', reward: 20 },
  { id: 'share', icon: '📣', title: 'Share NovaWallet', desc: 'Share the app link with a friend', reward: 12 },
  { id: 'rate', icon: '⭐', title: 'Rate us 5 stars', desc: 'Give NovaWallet a 5-star rating', reward: 25 },
]

export interface QuizQ { q: string; options: string[]; answer: number }
export const QUIZ: QuizQ[] = [
  { q: 'What is BTC?', options: ['Bitcoin', 'Bitcash', 'Bytecoin', 'Bancor Token'], answer: 0 },
  { q: 'Which of these is a stablecoin?', options: ['Bitcoin', 'Ethereum', 'USDT', 'Solana'], answer: 2 },
  { q: 'What does KYC mean?', options: ['Keep Your Coins', 'Know Your Customer', 'Key Yield Code', 'Korean Yen Currency'], answer: 1 },
  { q: 'What should you do with your wallet PIN?', options: ['Share it with support', 'Post it online', 'Never share it with anyone', 'Use your birthday'], answer: 2 },
  { q: "What is a wallet's locked balance?", options: ['Money lost forever', 'Funds held for staking or pending requests', 'A fee the app charges', 'Coins you cannot see'], answer: 1 },
]
