// NovaWallet API client — the Cloudflare Worker is the only door to the D1
// database. Every call carries the current Firebase ID token. All helpers
// are best-effort: a backend hiccup must never block sign-in (the local
// store still runs the app until the data phase moves server-side).
export const API_BASE = 'https://novawallet-api.solution-home-bd.workers.dev'

async function call(path: string, token: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(API_BASE + path, {
      ...init,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

// First sign-in after registration: creates the users / user_profiles /
// wallets rows in D1 (idempotent — the Worker returns created:false after).
export function apiBootstrap(token: string, data: { username: string; fullName: string; pinHash: string }): Promise<any | null> {
  return call('/v1/bootstrap', token, { method: 'POST', body: JSON.stringify(data) })
}

// The signed-in user's server-side profile + wallet balances.
export function apiMe(token: string): Promise<any | null> {
  return call('/v1/me', token)
}
