// Local payment rails per currency/country. The app keys the rails off the
// user's selected display currency (auto-detected from their country), so a
// user in India sees UPI / Google Pay / PhonePe, a user in Bangladesh sees
// bKash / Nagad / Rocket, and so on. Every list also ends with a bank option
// and a crypto option, which work everywhere. Details are demo values; an
// admin Settings entry with the same label overrides the detail shown.

export interface LocalMethod { label: string; detail: string }

const BANK_IN: LocalMethod = { label: 'Bank Transfer', detail: 'NovaWallet Bank · A/C 1501200000001' }
const CRYPTO_IN: LocalMethod = { label: 'Crypto Deposit', detail: 'USDT (TRC20): TNovaWalletAddressExample123456789' }

const DEMO_DETAILS: Record<string, string> = {
  bKash: '01712-345678 (Personal)', Nagad: '01712-345678 (Personal)', Rocket: '01712-3456789 (Personal)',
  UPI: 'novawallet@okhdfcbank', 'Google Pay': 'novawallet@okhdfcbank', PhonePe: 'novawallet@ybl', Paytm: 'novawallet@paytm',
  'Cash App': '$NovaWallet', Venmo: '@NovaWallet', Zelle: 'payments@novawallet.app',
  Revolut: '@novawallet', Wise: 'payments@novawallet.app', 'SEPA Transfer': 'IBAN DE00 1234 5678 9000 0000 00 · NovaWallet',
  JazzCash: '0300 1234567 (NovaWallet)', Easypaisa: '0345 1234567 (NovaWallet)',
  'STC Pay': '+966 50 123 4567', Payit: '+971 50 123 4567',
  'Touch n Go eWallet': '+60 12-345 6789', DuitNow: '+60 12-345 6789',
  OVO: '+62 812-3456-7890', DANA: '+62 812-3456-7890', GoPay: '+62 812-3456-7890',
  GCash: '+63 912 345 6789', Maya: '+63 912 345 6789',
  MoMo: '+84 912 345 678', ZaloPay: '+84 912 345 678',
  PromptPay: '081-234-5678', TrueMoney: '081-234-5678',
  PayNow: 'UEN 202600001A · NovaWallet', FPS: '+852 9123 4567',
  Alipay: 'payments@novawallet.app', 'WeChat Pay': 'NovaWalletPay',
  PayPay: 'novawallet', KakaoPay: 'novawallet',
  PayID: 'payments@novawallet.app', 'Interac e-Transfer': 'payments@novawallet.app',
  Pix: 'pagamentos@novawallet.com.br', 'Mercado Pago': 'novawallet.mp',
  Papara: '1234567890', BLIK: '+48 600 100 200',
  'M-Pesa': '+254 712 345 678', 'MTN MoMo': '+233 24 123 4567', OPay: '+234 812 345 6789',
  'Vodafone Cash': '+20 100 123 4567', InstaPay: 'novawallet@instapay',
  eSewa: '9841-234567', Khalti: '9841-234567',
}

const RAILS: Record<string, string[]> = {
  BDT: ['bKash', 'Nagad', 'Rocket'],
  INR: ['UPI', 'Google Pay', 'PhonePe', 'Paytm'],
  USD: ['Cash App', 'Venmo', 'Zelle'],
  EUR: ['Revolut', 'Wise', 'SEPA Transfer'],
  GBP: ['Revolut', 'Wise'],
  PKR: ['JazzCash', 'Easypaisa'],
  AED: ['Payit'],
  SAR: ['STC Pay'],
  MYR: ['Touch n Go eWallet', 'DuitNow'],
  IDR: ['OVO', 'DANA', 'GoPay'],
  PHP: ['GCash', 'Maya'],
  VND: ['MoMo', 'ZaloPay'],
  THB: ['PromptPay', 'TrueMoney'],
  SGD: ['PayNow'],
  HKD: ['FPS'],
  CNY: ['Alipay', 'WeChat Pay'],
  JPY: ['PayPay'],
  KRW: ['KakaoPay'],
  AUD: ['PayID'],
  CAD: ['Interac e-Transfer'],
  BRL: ['Pix'],
  MXN: ['Mercado Pago'],
  TRY: ['Papara'],
  PLN: ['BLIK'],
  KES: ['M-Pesa'],
  GHS: ['MTN MoMo'],
  NGN: ['OPay'],
  EGP: ['Vodafone Cash', 'InstaPay'],
  NPR: ['eSewa', 'Khalti'],
}

export function depositMethods(currency: string, adminMethods?: { label: string; detail: string }[]): LocalMethod[] {
  const rails = (RAILS[currency] ?? []).map(label => ({ label, detail: DEMO_DETAILS[label] ?? 'NovaWallet · details in the app' }))
  const list = [...rails, BANK_IN, CRYPTO_IN]
  if (!adminMethods?.length) return list
  return list.map(m => {
    const override = adminMethods.find(a => a.label.toLowerCase() === m.label.toLowerCase())
    return override ? { ...m, detail: override.detail } : m
  })
}

export function withdrawMethods(currency: string): string[] {
  return [...(RAILS[currency] ?? []), 'Bank Account', 'Crypto Wallet']
}
