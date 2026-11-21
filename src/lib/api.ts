// NovaWallet API client — talks to the Cloudflare Worker, which is the
// source of truth for balances and transactions (D1). Every call carries
// the current Firebase ID token; the Worker verifies it and derives the
// user from it. Bootstrap/me stay best-effort, while money calls throw an
// Error with the server's message so the UI can show exactly what the
// server decided.
import { firebaseAuth } from './firebase'

export const API_BASE = 'https://novawallet-api.solution-home-bd.workers.dev'

export async function authToken(): Promise<string | null> {
  try {
    return (await firebaseAuth.currentUser?.getIdToken()) ?? null
  } catch {
    return null
  }
}

async function call(path: string, init: RequestInit): Promise<any> {
  const token = await authToken()
  if (!token) throw new Error('Not signed in to the server. Please log in again.')
  let sid: string | null = null
  try { sid = localStorage.getItem('nova.sessionId') } catch { /* storage unavailable */ }
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(sid ? { 'X-Session-Id': sid } : {}), ...(init.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // This device's session was revoked from another device — drop the
    // local sign-in and start over from the login screen.
    if (data.error === 'session_revoked') {
      try { localStorage.removeItem('novawallet.session'); localStorage.removeItem('nova.sessionId') } catch { /* ignore */ }
      location.reload()
    }
    throw new Error(data.error || ('Server error (' + res.status + ')'))
  }
  return data
}

export const apiGet = (path: string) => call(path, { method: 'GET' })
export const apiPost = (path: string, body: unknown) => call(path, { method: 'POST', body: JSON.stringify(body) })

export async function apiBootstrap(
  token: string,
  profile: { username: string; fullName: string; pinHash: string; phone?: string; referralCode?: string; sessionId?: string; deviceLabel?: string; turnstileToken?: string },
): Promise<any> {
  try {
    const res = await fetch(API_BASE + '/v1/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(profile),
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function apiMe(token: string): Promise<any | null> {
  try {
    const res = await fetch(API_BASE + '/v1/me', {
      headers: { Authorization: 'Bearer ' + token },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
