// Payment methods are deliberately UNIVERSAL (decided 2026-11-18): running a
// separate wallet/rail per region is not feasible, so every user in every
// region gets exactly the same two methods — Bank Transfer and Crypto Deposit
// — for both deposits and withdrawals. An admin Settings entry with the same
// label overrides the receiving detail shown.

export interface LocalMethod { label: string; detail: string }

const BANK_IN: LocalMethod = { label: 'Bank Transfer', detail: 'NovaWallet Bank · A/C 1501200000001' }
const CRYPTO_IN: LocalMethod = { label: 'Crypto Deposit', detail: 'USDT (TRC20): TNovaWalletAddressExample123456789' }

export function depositMethods(_currency?: string, adminMethods?: { label: string; detail: string }[]): LocalMethod[] {
  const list = [BANK_IN, CRYPTO_IN]
  if (!adminMethods?.length) return list
  return list.map(m => {
    const override = adminMethods.find(a => a.label.toLowerCase() === m.label.toLowerCase())
    return override ? { ...m, detail: override.detail } : m
  })
}

export function withdrawMethods(_currency?: string): string[] {
  return ['Bank Account', 'Crypto Wallet']
}

// Crypto transfer systems / networks. When a user picks the crypto option in
// Add Money, Cash Out or Direct Withdraw, a second dropdown offers these.
// `detail` is the demo receiving address shown for deposits.
export interface CryptoNetwork { label: string; detail: string }

export const CRYPTO_NETWORKS: CryptoNetwork[] = [
  { label: 'Binance Pay', detail: 'Binance Pay ID: 123456789 · NovaWallet' },
  { label: 'BNB Smart Chain (BEP20)', detail: '0xNovaWalletBEP20AddressExample0001' },
  { label: 'Ethereum (ERC20)', detail: '0xNovaWalletERC20AddressExample0001' },
  { label: 'Tron (TRC20)', detail: 'TNovaWalletAddressExample123456789' },
  { label: 'Solana', detail: 'NovaWalletSo1anaAddressExample111111' },
  { label: 'Polygon', detail: '0xNovaWalletPolygonAddressExample01' },
  { label: 'Arbitrum One', detail: '0xNovaWalletArbitrumAddressExample1' },
  { label: 'Optimism', detail: '0xNovaWalletOptimismAddressExample1' },
  { label: 'Avalanche (C-Chain)', detail: '0xNovaWalletAvalancheAddressExample' },
  { label: 'Base', detail: '0xNovaWalletBaseAddressExample00001' },
  { label: 'Bitcoin (BTC)', detail: 'bc1qnovawalletexampleaddress000001' },
  { label: 'Litecoin (LTC)', detail: 'ltc1qnovawalletexampleaddress00001' },
  { label: 'Dogecoin (DOGE)', detail: 'DNovaWalletDogeAddressExample0001' },
  { label: 'XRP (Ripple)', detail: 'rNovaWalletXRPAddressExample000001' },
  { label: 'TON', detail: 'UQNovaWalletTONAddressExample00001' },
  { label: 'NEAR', detail: 'novawallet.near' },
]

export const CRYPTO_NETWORK_LABELS: string[] = CRYPTO_NETWORKS.map(n => n.label)
