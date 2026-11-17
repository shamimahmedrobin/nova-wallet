import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ---- PWA: manifest + icons (base-aware so dev and GitHub Pages both work) ----
const base = import.meta.env.BASE_URL
const manifestLink = document.createElement('link')
manifestLink.rel = 'manifest'
manifestLink.href = base + 'manifest.webmanifest'
document.head.appendChild(manifestLink)
const appleIcon = document.createElement('link')
appleIcon.rel = 'apple-touch-icon'
appleIcon.href = base + 'icons/apple-touch-icon.png'
document.head.appendChild(appleIcon)
const themeMeta = document.createElement('meta')
themeMeta.name = 'theme-color'
themeMeta.content = '#020617'
document.head.appendChild(themeMeta)
const capableMeta = document.createElement('meta')
capableMeta.name = 'mobile-web-app-capable'
capableMeta.content = 'yes'
document.head.appendChild(capableMeta)
const appleCapable = document.createElement('meta')
appleCapable.name = 'apple-mobile-web-app-capable'
appleCapable.content = 'yes'
document.head.appendChild(appleCapable)
const appleTitle = document.createElement('meta')
appleTitle.name = 'apple-mobile-web-app-title'
appleTitle.content = 'NovaWallet'
document.head.appendChild(appleTitle)
// Capture the install prompt so the Profile "Install App" row can trigger it.
;(window as any).__nwInstallPrompt = null
window.addEventListener('beforeinstallprompt', (e: any) => {
  e.preventDefault()
  ;(window as any).__nwInstallPrompt = e
  window.dispatchEvent(new Event('nw-install-ready'))
})
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register(base + 'sw.js').catch(() => {}) })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
