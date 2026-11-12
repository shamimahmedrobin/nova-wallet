import { useEffect, useState } from 'react'

export interface Coin {
  symbol: string; name: string; priceUsd: number; change24h: number
  marketCap: number; volume24h: number; spark: number[]; live: boolean
}
export const COIN_META: Record<string, { name: string; color: string; gecko: string }> = {
  BTC: { name: 'Bitcoin', color: '#f7931a', gecko: 'bitcoin' },
  ETH: { name: 'Ethereum', color: '#627eea', gecko: 'ethereum' },
  USDT: { name: 'Tether', color: '#26a17b', gecko: 'tether' },
  USDC: { name: 'USD Coin', color: '#2775ca', gecko: 'usd-coin' },
  BNB: { name: 'BNB', color: '#f0b90b', gecko: 'binancecoin' },
  SOL: { name: 'Solana', color: '#9945ff', gecko: 'solana' },
  XRP: { name: 'XRP', color: '#25a4e9', gecko: 'ripple' },
  DOGE: { name: 'Dogecoin', color: '#c2a633', gecko: 'dogecoin' },
  TRX: { name: 'TRON', color: '#ff060a', gecko: 'tron' },
  ADA: { name: 'Cardano', color: '#0033ad', gecko: 'cardano' },
  LINK: { name: 'Chainlink', color: '#2a5ada', gecko: 'chainlink' },
  AVAX: { name: 'Avalanche', color: '#e84142', gecko: 'avalanche-2' },
  DOT: { name: 'Polkadot', color: '#e6007a', gecko: 'polkadot' },
  LTC: { name: 'Litecoin', color: '#345d9d', gecko: 'litecoin' },
  BCH: { name: 'Bitcoin Cash', color: '#8dc351', gecko: 'bitcoin-cash' },
  NEAR: { name: 'NEAR Protocol', color: '#00ec97', gecko: 'near' },
  XLM: { name: 'Stellar', color: '#14b6e7', gecko: 'stellar' },
  UNI: { name: 'Uniswap', color: '#ff007a', gecko: 'uniswap' },
  ETC: { name: 'Ethereum Classic', color: '#2fbf71', gecko: 'ethereum-classic' },
  ATOM: { name: 'Cosmos', color: '#2e3148', gecko: 'cosmos' },
  HBAR: { name: 'Hedera', color: '#222222', gecko: 'hedera-hashgraph' },
  APT: { name: 'Aptos', color: '#14b8a6', gecko: 'aptos' },
  SUI: { name: 'Sui', color: '#4da2ff', gecko: 'sui' },
  ARB: { name: 'Arbitrum', color: '#28a0f0', gecko: 'arbitrum' },
  OP: { name: 'Optimism', color: '#ff0420', gecko: 'optimism' },
  POL: { name: 'Polygon', color: '#8247e5', gecko: 'polygon-ecosystem-token' },
  INJ: { name: 'Injective', color: '#00b4d8', gecko: 'injective-protocol' },
  FIL: { name: 'Filecoin', color: '#0090ff', gecko: 'filecoin' },
  ICP: { name: 'Internet Computer', color: '#29abe2', gecko: 'internet-computer' },
  TON: { name: 'Toncoin', color: '#0098ea', gecko: 'the-open-network' },
  PEPE: { name: 'Pepe', color: '#3d8130', gecko: 'pepe' },
  SHIB: { name: 'Shiba Inu', color: '#ffa409', gecko: 'shiba-inu' },
}
// Fallback snapshot (clearly labelled when used) — refreshed from CoinGecko when reachable.
const sparkOf = (p: number, up = true) => {
  const base = [0.968, 0.98, 0.975, 0.989, 0.995, 0.991, 1.005, 1]
  const pts = up ? base : [...base].reverse()
  return pts.map(m => +(p * m).toPrecision(8))
}
const FALLBACK: Coin[] = [
  { symbol: 'BTC', name: 'Bitcoin', priceUsd: 97400, change24h: 2.4, marketCap: 1.93e12, volume24h: 4.8e10, spark: [95500, 96200, 95800, 97000, 96600, 97400, 98100, 97400], live: false },
  { symbol: 'ETH', name: 'Ethereum', priceUsd: 3420, change24h: 1.8, marketCap: 4.1e11, volume24h: 2.1e10, spark: [3310, 3350, 3330, 3390, 3410, 3380, 3440, 3420], live: false },
  { symbol: 'USDT', name: 'Tether', priceUsd: 1.0, change24h: 0.01, marketCap: 1.38e11, volume24h: 5.6e10, spark: [1, 1, 0.999, 1, 1.001, 1, 1, 1], live: false },
  { symbol: 'USDC', name: 'USD Coin', priceUsd: 1.0, change24h: 0.0, marketCap: 7.5e10, volume24h: 8.2e9, spark: [1, 1, 1, 1, 1, 1, 1, 1], live: false },
  { symbol: 'BNB', name: 'BNB', priceUsd: 695, change24h: -0.9, marketCap: 1.0e11, volume24h: 1.9e9, spark: [705, 700, 702, 694, 698, 690, 697, 695], live: false },
  { symbol: 'SOL', name: 'Solana', priceUsd: 214, change24h: 4.1, marketCap: 1.03e11, volume24h: 3.8e9, spark: [202, 205, 208, 206, 211, 213, 210, 214], live: false },
  { symbol: 'XRP', name: 'XRP', priceUsd: 2.35, change24h: -1.6, marketCap: 1.35e11, volume24h: 4.4e9, spark: [2.42, 2.4, 2.38, 2.39, 2.34, 2.36, 2.33, 2.35], live: false },
  { symbol: 'DOGE', name: 'Dogecoin', priceUsd: 0.16, change24h: 3.2, marketCap: 2.4e10, volume24h: 1.6e9, spark: sparkOf(0.16), live: false },
  { symbol: 'TRX', name: 'TRON', priceUsd: 0.27, change24h: 0.8, marketCap: 2.3e10, volume24h: 6.5e8, spark: sparkOf(0.27), live: false },
  { symbol: 'ADA', name: 'Cardano', priceUsd: 0.55, change24h: -2.1, marketCap: 2.0e10, volume24h: 5.4e8, spark: sparkOf(0.55, false), live: false },
  { symbol: 'LINK', name: 'Chainlink', priceUsd: 14.2, change24h: 2.9, marketCap: 9.5e9, volume24h: 4.2e8, spark: sparkOf(14.2), live: false },
  { symbol: 'AVAX', name: 'Avalanche', priceUsd: 17.5, change24h: -1.2, marketCap: 7.4e9, volume24h: 3.1e8, spark: sparkOf(17.5, false), live: false },
  { symbol: 'DOT', name: 'Polkadot', priceUsd: 2.6, change24h: 1.1, marketCap: 4.2e9, volume24h: 1.5e8, spark: sparkOf(2.6), live: false },
  { symbol: 'LTC', name: 'Litecoin', priceUsd: 98, change24h: 0.6, marketCap: 7.5e9, volume24h: 4.8e8, spark: sparkOf(98), live: false },
  { symbol: 'BCH', name: 'Bitcoin Cash', priceUsd: 490, change24h: 3.8, marketCap: 9.7e9, volume24h: 3.6e8, spark: sparkOf(490), live: false },
  { symbol: 'NEAR', name: 'NEAR Protocol', priceUsd: 2.2, change24h: -0.7, marketCap: 2.8e9, volume24h: 1.4e8, spark: sparkOf(2.2, false), live: false },
  { symbol: 'XLM', name: 'Stellar', priceUsd: 0.24, change24h: 1.9, marketCap: 7.6e9, volume24h: 1.1e8, spark: sparkOf(0.24), live: false },
  { symbol: 'UNI', name: 'Uniswap', priceUsd: 6.4, change24h: -3.0, marketCap: 4.0e9, volume24h: 9.5e7, spark: sparkOf(6.4, false), live: false },
  { symbol: 'ETC', name: 'Ethereum Classic', priceUsd: 17.2, change24h: 0.4, marketCap: 2.6e9, volume24h: 1.2e8, spark: sparkOf(17.2), live: false },
  { symbol: 'ATOM', name: 'Cosmos', priceUsd: 4.6, change24h: -1.8, marketCap: 2.1e9, volume24h: 8.4e7, spark: sparkOf(4.6, false), live: false },
  { symbol: 'HBAR', name: 'Hedera', priceUsd: 0.17, change24h: 2.2, marketCap: 7.2e9, volume24h: 1.6e8, spark: sparkOf(0.17), live: false },
  { symbol: 'APT', name: 'Aptos', priceUsd: 5.1, change24h: 1.4, marketCap: 3.7e9, volume24h: 1.3e8, spark: sparkOf(5.1), live: false },
  { symbol: 'SUI', name: 'Sui', priceUsd: 3.4, change24h: 5.1, marketCap: 1.2e10, volume24h: 9.8e8, spark: sparkOf(3.4), live: false },
  { symbol: 'ARB', name: 'Arbitrum', priceUsd: 0.28, change24h: -2.6, marketCap: 1.5e9, volume24h: 6.8e7, spark: sparkOf(0.28, false), live: false },
  { symbol: 'OP', name: 'Optimism', priceUsd: 0.68, change24h: 1.6, marketCap: 1.3e9, volume24h: 1.1e8, spark: sparkOf(0.68), live: false },
  { symbol: 'POL', name: 'Polygon', priceUsd: 0.19, change24h: -0.5, marketCap: 2.0e9, volume24h: 5.2e7, spark: sparkOf(0.19, false), live: false },
  { symbol: 'INJ', name: 'Injective', priceUsd: 9.6, change24h: 4.4, marketCap: 9.5e8, volume24h: 8.8e7, spark: sparkOf(9.6), live: false },
  { symbol: 'FIL', name: 'Filecoin', priceUsd: 3.4, change24h: -1.1, marketCap: 2.4e9, volume24h: 1.2e8, spark: sparkOf(3.4, false), live: false },
  { symbol: 'ICP', name: 'Internet Computer', priceUsd: 4.4, change24h: 0.9, marketCap: 2.4e9, volume24h: 6.4e7, spark: sparkOf(4.4), live: false },
  { symbol: 'TON', name: 'Toncoin', priceUsd: 2.3, change24h: -2.2, marketCap: 5.8e9, volume24h: 1.5e8, spark: sparkOf(2.3, false), live: false },
  { symbol: 'PEPE', name: 'Pepe', priceUsd: 0.0000062, change24h: 6.8, marketCap: 2.6e9, volume24h: 4.5e8, spark: sparkOf(0.0000062), live: false },
  { symbol: 'SHIB', name: 'Shiba Inu', priceUsd: 0.0000095, change24h: 2.5, marketCap: 5.6e9, volume24h: 1.4e8, spark: sparkOf(0.0000095), live: false },
]

let cache: { at: number; coins: Coin[] } | null = null
export async function fetchMarket(): Promise<Coin[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.coins
  try {
    const ids = Object.values(COIN_META).map(m => m.gecko).join(',')
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h`)
    if (!res.ok) throw new Error('market http ' + res.status)
    const rows = await res.json()
    const coins: Coin[] = rows.map((r: any) => {
      const sym = Object.keys(COIN_META).find(k => COIN_META[k].gecko === r.id)!
      return {
        symbol: sym, name: r.name, priceUsd: r.current_price, change24h: r.price_change_percentage_24h ?? 0,
        marketCap: r.market_cap, volume24h: r.total_volume, spark: r.sparkline_in_7d?.price ?? [], live: true,
      }
    })
    coins.sort((a, b) => b.marketCap - a.marketCap)
    cache = { at: Date.now(), coins }
    return coins
  } catch {
    return FALLBACK
  }
}
export function useMarket(refreshMs = 60_000) {
  const [coins, setCoins] = useState<Coin[]>(cache?.coins ?? FALLBACK)
  const [loading, setLoading] = useState(!cache)
  useEffect(() => {
    let alive = true
    const load = async () => { const c = await fetchMarket(); if (alive) { setCoins(c); setLoading(false) } }
    load(); const t = setInterval(load, refreshMs)
    return () => { alive = false; clearInterval(t) }
  }, [refreshMs])
  return { coins, loading, isLive: coins[0]?.live ?? false }
}
