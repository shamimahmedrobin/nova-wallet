import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'
import { Logo } from '../components/Layout'

const UPDATED = 'Last updated: 18 November 2026'

function Shell({ icon, title, intro, children }: { icon: React.ReactNode; title: string; intro: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  // Go back to wherever the reader came from (Register, landing or Profile) —
  // never out of the app. Falls back to the home page when there is no
  // in-app history (e.g. the page was opened from a fresh tab).
  const goBack = () => { if (window.history.length > 1) navigate(-1); else navigate('/') }
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-violet-600/12 to-transparent" />
      <header className="relative max-w-3xl mx-auto px-4 pt-6 flex items-center justify-between">
        <Logo size={32} />
        <button onClick={goBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 dark:text-violet-400"><ArrowLeft size={16} /> Back</button>
      </header>
      <main className="relative max-w-3xl mx-auto px-4 py-8 pb-16">
        <div className="flex items-center gap-3.5">
          <span className="w-13 h-13 shrink-0 rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/25 p-3.5">{icon}</span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">{UPDATED}</p>
          </div>
        </div>
        <p className="mt-5 text-sm sm:text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{intro}</p>
        <div className="mt-7 space-y-4">{children}</div>
        <div className="mt-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 text-sm text-slate-500 leading-relaxed">
          Questions about these terms? Email us at <span className="font-bold text-slate-700 dark:text-slate-200">support@novawallet.app</span> — we reply within 24 hours on business days.
        </div>
      </main>
    </div>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6">
      <h2 className="font-extrabold text-[15px] sm:text-base flex items-baseline gap-2"><span className="text-violet-500">{n}.</span> {title}</h2>
      <div className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300 space-y-2">{children}</div>
    </section>
  )
}

export function TermsPage() {
  return (
    <Shell icon={<FileText size={22} />} title="Terms of Service" intro="Welcome to NovaWallet. These Terms of Service (“Terms”) are the agreement between you and NovaWallet for using our wallet, payments and crypto platform. By creating an account or using NovaWallet, you agree to these Terms and to our Privacy Policy. If you do not agree, please do not use the service.">
      <Section n={1} title="About NovaWallet">
        <p>NovaWallet is a digital finance platform that lets you hold a balance, add and withdraw money by bank transfer or crypto — the same in every country — send money to other users, buy, sell and swap cryptocurrencies, apply for loans, and earn rewards and staking interest.</p>
        <p>NovaWallet currently runs in <b>demonstration (demo) mode</b>: balances, transactions and approvals shown in the app are simulated and are stored on your own device. Demo balances have no real monetary value and cannot be withdrawn as real money. Features, limits and these Terms will be updated when the production service launches.</p>
      </Section>
      <Section n={2} title="Your account">
        <p>You must provide accurate information when you register and keep it up to date. One person may hold one account; self-referrals and duplicate accounts created to earn referral rewards are blocked and may be closed.</p>
        <p>Higher account levels require identity verification (KYC) — a government ID and a face check. We may ask you to re-verify at any time. You are responsible for everything that happens under your account.</p>
      </Section>
      <Section n={3} title="Keep your account safe">
        <p>Your password, transaction PIN, login PIN and fingerprint unlock are yours alone — never share them with anyone, including anyone claiming to be NovaWallet support. We will never ask for your PIN or password.</p>
        <p>Tell us immediately at support@novawallet.app if you believe your account has been accessed without your permission. For your protection, the app locks automatically after inactivity and after repeated wrong password or PIN attempts.</p>
      </Section>
      <Section n={4} title="Deposits, withdrawals and transfers">
        <p>Deposits may require a transaction ID and receipt and are credited after review. Withdrawals and cash-outs may be reviewed before they are completed. Transfers between NovaWallet users are instant and, once confirmed with your PIN, cannot be reversed by us — please check the recipient carefully before you send.</p>
        <p>Fees and limits depend on your account level and are always shown before you confirm a transaction. We may decline or delay a transaction where we suspect fraud, error or abuse.</p>
      </Section>
      <Section n={5} title="Cryptocurrency">
        <p>Crypto prices are volatile and can change quickly; the value of your holdings can go down as well as up. Prices shown in the app come from public market data and may differ slightly from the price at the moment a trade executes. Past performance never guarantees future results, and nothing in the app is financial advice.</p>
      </Section>
      <Section n={6} title="Loans">
        <p>Loan applications are reviewed individually. Applying does not guarantee approval. If a loan is approved, the amount, processing fee and repayment schedule shown in the app form the loan agreement between you and NovaWallet. Late repayment may reduce your account level and your ability to borrow again.</p>
      </Section>
      <Section n={7} title="Earn, staking and referrals">
        <p>Staking rates (APY) are variable, are shown before you stake, and rewards accrue daily. Early unstaking may forfeit accrued rewards for fixed terms. Referral rewards are paid only for genuine new users who complete their first approved deposit; rewards from fake or duplicate accounts will be reversed.</p>
      </Section>
      <Section n={8} title="Acceptable use">
        <p>You may not use NovaWallet for fraud, money laundering, financing of illegal activity, harassment, or to attempt to bypass security controls, level limits or verification. We may suspend or freeze an account that violates these Terms, and we may hold a balance while a suspected violation is investigated.</p>
      </Section>
      <Section n={9} title="Availability and liability">
        <p>We work to keep NovaWallet available around the clock, but the service is provided “as is” and may be interrupted for maintenance or reasons beyond our control. To the maximum extent allowed by law, NovaWallet is not liable for indirect losses, including lost profits or losses caused by market movements, incorrect recipient details you entered, or your failure to keep your credentials safe.</p>
      </Section>
      <Section n={10} title="Changes to these Terms">
        <p>We may update these Terms from time to time. Material changes will be announced in the app or by notification, and the “Last updated” date above will change. Continuing to use NovaWallet after a change means you accept the updated Terms.</p>
      </Section>
      <p className="text-sm text-slate-500">See also our <Link to="/privacy" className="font-bold text-violet-600 dark:text-violet-400 underline underline-offset-2">Privacy Policy</Link>, which explains how we handle your information.</p>
    </Shell>
  )
}

export function PrivacyPage() {
  return (
    <Shell icon={<ShieldCheck size={22} />} title="Privacy Policy" intro="Your privacy matters to us. This Privacy Policy explains what information NovaWallet collects, why we collect it, how it is stored and shared, and the choices you have. It works together with our Terms of Service — by using NovaWallet you agree to both.">
      <Section n={1} title="Information we collect">
        <p><b>Account information:</b> your name, username, email address, phone number and country/currency preference.</p>
        <p><b>Identity (KYC) information:</b> when you verify, your ID type and number, a photo of your ID document and a face photo/selfie.</p>
        <p><b>Activity information:</b> your transactions, deposits, withdrawals, loans, staking and referral activity, support conversations and notifications.</p>
        <p><b>Device and security information:</b> sign-in times, device/browser type, and security events such as failed login attempts. Your profile photo, if you add one.</p>
      </Section>
      <Section n={2} title="How we use your information">
        <p>We use your information to run your account, process transactions, verify your identity, set your account level and limits, prevent fraud and abuse, provide customer support, send you important account and security notifications, and improve the service. We do not use your personal information for advertising, and we never sell it.</p>
      </Section>
      <Section n={3} title="How your information is stored">
        <p>In the current <b>demo mode</b>, your account data is stored locally in your own browser on your own device — it is not sent to or stored on a NovaWallet server. Clearing your browser data deletes it. When the production service launches, data will be stored on secured servers with encryption in transit and at rest, and this Policy will be updated before that happens.</p>
        <p>Your password and PINs are never stored in plain text — only one-way hashes are kept, so nobody, including our team, can read them.</p>
      </Section>
      <Section n={4} title="Sharing your information">
        <p>We share the minimum necessary: with payment partners to complete a deposit or withdrawal you requested; with identity-verification providers to complete KYC; and with authorities where the law requires it. When you send money to another NovaWallet user, that user sees your name and the transfer details — nothing else. We never sell, rent or trade your personal information to third parties for marketing.</p>
      </Section>
      <Section n={5} title="Cookies and local storage">
        <p>NovaWallet uses your browser's local storage to keep you signed in, remember your theme, language and currency, remember your lock state for security, and store the demo database on your device. These are essential for the app to work; we do not use third-party advertising trackers.</p>
      </Section>
      <Section n={6} title="How we protect your information">
        <p>Access to accounts is protected by your password plus the unlock methods you choose (login PIN or fingerprint, stored only on your device). The app locks automatically after inactivity, repeated wrong attempts trigger a temporary lock, and sensitive actions require your transaction PIN. No system is perfectly secure, but we design every layer to make your account hard to reach without you.</p>
      </Section>
      <Section n={7} title="Your rights and choices">
        <p>You can view and update your profile information in the app at any time, and change your password and PINs whenever you like. You may ask us for a copy of your information, ask us to correct it, or ask us to delete your account and its data by emailing support@novawallet.app. We respond to verified requests within 30 days. In demo mode you can also erase everything instantly by clearing the app's site data in your browser.</p>
      </Section>
      <Section n={8} title="Children">
        <p>NovaWallet is for adults. You must be at least 18 years old (or the age of majority in your country) to hold an account. We do not knowingly collect information from children.</p>
      </Section>
      <Section n={9} title="Changes to this Policy">
        <p>We may update this Policy from time to time. Material changes will be announced in the app or by notification, and the “Last updated” date above will change. Continuing to use NovaWallet after a change means you accept the updated Policy.</p>
      </Section>
      <p className="text-sm text-slate-500">See also our <Link to="/terms" className="font-bold text-violet-600 dark:text-violet-400 underline underline-offset-2">Terms of Service</Link>, which govern your use of NovaWallet.</p>
    </Shell>
  )
}
