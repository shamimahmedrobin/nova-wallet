import React from 'react'

// Last-resort guard: a render/runtime error must never strand the user on a
// permanent white screen. Stale lazy chunks after a fresh deploy (or a
// chunk that fails on a flaky connection) trigger ONE guarded auto-reload
// to pick up the current build; anything else shows a friendly reload card.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    try { console.error('NovaWallet crash:', err, info?.componentStack) } catch { /* ignore */ }
    const msg = String((err && err.message) || err || '')
    if (/loading chunk|dynamically imported module|importing a module script failed|failed to fetch/i.test(msg)) {
      try {
        const last = Number(sessionStorage.getItem('nw.chunkReloadAt') ?? 0)
        if (Date.now() - last > 30000) {
          sessionStorage.setItem('nw.chunkReloadAt', String(Date.now()))
          window.location.reload()
        }
      } catch { /* ignore */ }
    }
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Something went wrong</h1>
            <p style={{ fontSize: 14, opacity: 0.7, margin: '0 0 20px' }}>The app hit a snag. Your money and data are safe on the server.</p>
            <p style={{ fontSize: 11, opacity: 0.45, margin: '0 0 20px', wordBreak: 'break-word' }}>{String(this.state.err.message || this.state.err)}</p>
            <button onClick={() => window.location.reload()} style={{ background: '#7c3aed', color: '#fff', border: 0, borderRadius: 14, padding: '12px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Reload the app</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
