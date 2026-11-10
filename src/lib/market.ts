import { useEffect, useState } from 'react'

export interface Coin {
  symbol: string; name: string; priceUsd: number; change24h: number
  marketCap: number; volume24h: number; spark: number[]; live: boolean
}
export const COIN_META: Record<string, { name: string; color: string; gecko: string }> = {
  BTC: { name: 'Bitcoin', color: '#f7931a', gecko: 'bitcoin' },
  ETH: { name: 'Ethereum', color: '#627eea', gecko: 'ethereum' },
  USDT: { name: 'Tether', color: '#26a17b', gecko: 'tether' },
  BNB: { name: 'BNB', color: '#f0b90b', gecko: 'binancecoin' },
  SOL: { name: 'Solana', color: '#9945ff', gecko: 'solana' },
  XRP: { name: 'XRP', color: '#25a4e9', gecko: 'ripple' },
}
// Fallback snapshot (clearly labelled when used) — refreshed from CoinGecko when reachable.
const FALLBACK: Coin[] = [
  { symbol: 'BTC', name: 'Bitcoin', priceUsd: 97400, change24h: 2.4, marketCap: 1.93e12, volume24h: 4.8e10, spark: [95500, 96200, 95800, 97000, 96600, 97400, 98100, 97400], live: false },
  { symbol: 'ETH', name: 'Ethereum', priceUsd: 3420, change24h: 1.8, marketCap: 4.1e11, volume24h: 2.1e10, spark: [3310, 3350, 3330, 3390, 3410, 3380, 3440, 3420], live: false },
  { symbol: 'USDT', name: 'Tether', priceUsd: 1.0, change24h: 0.01, marketCap: 1.38e11, volume24h: 5.6e10, spark: [1, 1, 0.999, 1, 1.001, 1, 1, 1], live: false },
  { symbol: 'BNB', name: 'BNB', priceUsd: 695, change24h: -0.9, marketCap: 1.0e11, volume24h: 1.9e9, spark: [705, 700, 702, 694, 698, 690, 697, 695], live: false },
  { symbol: 'SOL', name: 'Solana', priceUsd: 214, change24h: 4.1, marketCap: 1.03e11, volume24h: 3.8e9, spark: [202, 205, 208, 206, 211, 213, 210, 214], live: false },
  { symbol: 'XRP', name: 'XRP', priceUsd: 2.35, change24h: -1.6, marketCap: 1.35e11, volume24h: 4.4e9, spark: [2.42, 2.4, 2.38, 2.39, 2.34, 2.36, 2.33, 2.35], live: false },
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
