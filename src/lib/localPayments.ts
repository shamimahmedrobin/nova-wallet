// Payment methods are deliberately UNIVERSAL (decided 2026-11-18): running a
// separate wallet/rail per region is not feasible, so every user in every
// region gets the same methods — bank accounts and crypto wallets, managed by
// the admin in Admin → Payment Methods (bank entries carry routing / SWIFT /
// branch; crypto entries carry coin + network + address). Withdrawal
// destinations stay the two universal choices: Bank Account / Crypto Wallet.

import type { PayMethod } from './types'
import { DEFAULT_PAY_METHODS } from './seed'

export function depositMethods(_currency?: string, adminMethods?: PayMethod[]): PayMethod[] {
  if (adminMethods?.length) return adminMethods
  return DEFAULT_PAY_METHODS as PayMethod[]
}

/** Display title for a method: bank name, or "USDT · Tron (TRC20)" for crypto. */
export const payMethodTitle = (m: PayMethod): string => m.kind === 'crypto' ? (m.network ? `${m.label} · ${m.network}` : m.label) : m.label

/** The value a user sends to / copies: the account number or wallet address (falls back to legacy free-text details). */
export const payMethodValue = (m: PayMethod): string => m.accountNumber ?? m.detail ?? ''

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
