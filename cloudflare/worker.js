// NovaWallet API — Cloudflare Worker (v2, 2026-11-21)
//
// Architecture: Firebase Auth owns identity; this Worker is the only door
// to the D1 database. Every /v1/* request must carry a Firebase ID token
// (Authorization: Bearer <token>); the Worker verifies it against Google's
// securetoken JWKS and uses the token's uid as the D1 users.id.
//
// v2 makes the server the source of truth for BALANCES and TRANSACTIONS:
// wallet balances, holdings, transactions, deposits, withdrawals, loans and
// stakes live in D1 and every money action below validates (PIN, balance,
// role, status) and settles server-side, mirroring the app's fee/rounding
// rules exactly. The frontend hydrates its state from GET /v1/state.
// PIN verification replicates the app's hashSecret so the pin_hash written
// at bootstrap can be checked here; a stronger KDF comes with the dedicated
// server-side PIN phase (never trust a client-computed hash as final).

const PROJECT_ID = "novawallet-4596c";
const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ALLOWED_ORIGINS = new Set([
  "https://novawallet.pp.ua",
  "https://www.novawallet.pp.ua",
  "https://nova-wallet-wine.vercel.app",
  "https://solutionhomebd-oss.github.io",
  "https://shamimahmedrobin.github.io",
  "http://localhost:5173",
]);

let jwksCache = { keys: null, fetchedAt: 0 };

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

function b64urlToBytes(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function getJwks() {
  const now = Date.now();
  if (jwksCache.keys && now - jwksCache.fetchedAt < 3600_000) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("jwks_fetch_failed");
  const data = await res.json();
  jwksCache = { keys: data.keys, fetchedAt: now };
  return data.keys;
}

// Returns { uid, email } for a valid Firebase ID token, or null.
async function verifyFirebaseToken(token) {
  try {
    const [h, p, sig] = token.split(".");
    if (!h || !p || !sig) return null;
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    const keys = await getJwks();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(sig),
      new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
    if (payload.aud !== PROJECT_ID) return null;
    if (!payload.sub) return null;
    return { uid: payload.sub, email: payload.email || null };
  } catch {
    return null;
  }
}

async function requireAuth(request) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyFirebaseToken(auth.slice(7));
}

// ---- App-compatible helpers -------------------------------------------------

// Exact replica of the app's hashSecret (src/lib/utils.ts) so PIN hashes
// written by the client at bootstrap verify identically here.
function hashSecret(s) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const str = "nova::" + s;
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2 ^ str.charCodeAt(i), 0x811c9dc5);
  }
  return "h$" + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

const nowISO = () => new Date().toISOString();
const rand = (n) => {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  for (let i = 0; i < n; i++) s += c[a[i] % c.length];
  return s;
};
const pubId = (prefix) => prefix + "-" + rand(8);
const badAmount = (n) => !(typeof n === "number" && isFinite(n) && n > 0);
const round2 = (n) => Math.round(n * 100) / 100;

function emiCalc(principal, annualRatePct, months) {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return { emi: principal / months, total: principal };
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return { emi, total: emi * months };
}

async function getSettings(db) {
  const rows = await db.prepare("SELECT key, value FROM platform_settings").all();
  const m = {};
  for (const r of rows.results) { try { m[r.key] = JSON.parse(r.value); } catch { m[r.key] = {}; } }
  return {
    sendPct: m.fees?.send_pct ?? 0.5,
    cashoutPct: m.fees?.cashout_pct ?? 1.5,
    referralPct: m.referral?.commission_pct ?? 5,
    loanRatePct: m.loan?.rate_pct ?? 12,
    minLoan: m.loan?.min ?? 1000,
    maxLoan: m.loan?.max ?? 100000,
    loanLimit: m.loan?.limit ?? 100000,
    bdtPerUsd: m.rates?.bdt_per_usd ?? 121,
  };
}

async function feeDiscount(db, level) {
  const row = await db.prepare("SELECT fee_discount_pct FROM account_levels WHERE level = ?").bind(level).first();
  return row ? Number(row.fee_discount_pct) : 0;
}

async function getUserRow(db, uid) {
  return db.prepare(
    `SELECT u.*, p.full_name FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?`
  ).bind(uid).first();
}

async function getWallet(db, uid) {
  return db.prepare("SELECT * FROM wallets WHERE user_id = ?").bind(uid).first();
}

// Returns a Map: currency -> { available, locked }
async function getBalances(db, walletId) {
  const rows = await db.prepare("SELECT currency, available, locked FROM wallet_balances WHERE wallet_id = ?").bind(walletId).all();
  const map = new Map();
  for (const r of rows.results) map.set(r.currency, { available: Number(r.available), locked: Number(r.locked) });
  return map;
}

const balOf = (map, cur) => map.get(cur)?.available ?? 0;
const lockedOf = (map, cur) => map.get(cur)?.locked ?? 0;

// Balance delta statement (upsert). The INSERT values are clamped at 0
// because D1/SQLite checks the proposed INSERT row against the CHECK
// constraints BEFORE taking the ON CONFLICT path — a raw negative delta
// fails even when the existing balance covers it. The UPDATE applies the
// real delta, and its result is still CHECK-enforced, so an overdraft
// aborts the whole batch. (Every debit path pre-checks the balance, so a
// negative delta never legitimately meets a missing row.)
function adjStmt(db, walletId, currency, dAvail, dLocked = 0) {
  return db.prepare(
    `INSERT INTO wallet_balances (wallet_id, currency, available, locked) VALUES (?, ?, ?, ?)
     ON CONFLICT(wallet_id, currency) DO UPDATE SET available = available + ?, locked = locked + ?`
  ).bind(walletId, currency, Math.max(dAvail, 0), Math.max(dLocked, 0), dAvail, dLocked);
}

function ensureCurrencyStmt(db, symbol) {
  return db.prepare(
    "INSERT OR IGNORE INTO currencies (code, name, kind, decimals) VALUES (?, ?, 'crypto', 8)"
  ).bind(symbol, symbol);
}

// Builds a transaction insert statement; returns { stmt, pub } where pub is
// the public TXN id the app uses for display and deep links.
function txStmt(db, t) {
  const pub = pubId("TXN");
  const id = crypto.randomUUID();
  const stmt = db.prepare(
    `INSERT INTO transactions (id, public_id, user_id, category, title, amount, fee, currency, status, note, counterparty, method, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, pub, t.userId, t.category, t.title, t.amount, t.fee ?? 0, t.currency ?? "BDT",
    t.status ?? "completed", t.note ?? null, t.counterparty ?? null, t.method ?? null, nowISO());
  return { stmt, pub, id };
}

const isoOf = (s) => (s && s.includes("T") ? s : (s || "").replace(" ", "T") + "Z");

// Maps D1 rows into the app's client shapes.
async function loadState(db, uid, lite = false) {
  const me = await getUserRow(db, uid);
  if (!me) return null;
  const wallet = await getWallet(db, uid);
  const bals = wallet ? await getBalances(db, wallet.id) : new Map();
  const holdings = {};
  for (const [cur, b] of bals) {
    if (cur !== "BDT" && b.available > 0) holdings[cur] = b.available;
  }
  const names = new Map();
  const allUsers = await db.prepare("SELECT u.id AS id, p.full_name AS full_name FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id").all();
  for (const r of allUsers.results) names.set(r.id, r.full_name || "");
  const mapTx = (t) => ({
    id: t.public_id, userId: t.user_id, category: t.category, title: t.title,
    amount: Number(t.amount), fee: Number(t.fee), currency: t.currency, status: t.status,
    note: t.note && t.note.startsWith("earn:") ? undefined : (t.note || undefined), counterparty: t.counterparty ? (names.get(t.counterparty) || undefined) : undefined,
    method: t.method || undefined, createdAt: isoOf(t.created_at),
  });
  const txRows = await db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200").bind(uid).all();
  const depRows = await db.prepare("SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC").bind(uid).all();
  const wdrRows = await db.prepare("SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC").bind(uid).all();
  const loanRows = await db.prepare("SELECT * FROM loans WHERE user_id = ? ORDER BY created_at DESC").bind(uid).all();
  const stkRows = await db.prepare("SELECT * FROM stakes WHERE user_id = ? ORDER BY created_at DESC").bind(uid).all();
  const kycRow = await db.prepare("SELECT status, doc_type, doc_number, created_at FROM kyc_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(uid).first();
  const pmRows = await db.prepare("SELECT * FROM user_payment_methods WHERE user_id = ? ORDER BY created_at").bind(uid).all();
  const state = {
    profile: {
      id: me.id, email: me.email, username: me.username, name: me.full_name || "",
      role: me.role, status: me.status, level: Number(me.level), referralCode: me.referral_code,
      ...(me.admin_scope ? { adminScope: me.admin_scope } : {}),
      kyc: kycRow?.status ?? "unverified",
      ...(kycRow ? { kycDocType: kycRow.doc_type, kycDocNumber: kycRow.doc_number, kycSubmittedAt: isoOf(kycRow.created_at) } : {}),
    },
    payMethods: pmRows.results.map((m) => ({ id: m.id, type: m.type, label: m.label, detail: m.detail })),
    wallet: {
      userId: uid,
      available: balOf(bals, "BDT"),
      locked: lockedOf(bals, "BDT"),
      holdings,
    },
    transactions: txRows.results.map(mapTx),
    deposits: depRows.results.map((d) => ({
      id: d.id, userId: d.user_id, method: d.method, amount: Number(d.amount), trxId: d.provider_trx_id,
      receipt: d.receipt_url || undefined, status: d.status, createdAt: isoOf(d.created_at),
      methodId: d.method_id || undefined, kind: d.kind || undefined, verification: d.verification || undefined,
    })),
    withdrawals: wdrRows.results.map((w) => ({
      id: w.id, userId: w.user_id, method: w.method, amount: Number(w.amount), fee: Number(w.fee),
      destination: w.destination, status: w.status, createdAt: isoOf(w.created_at),
    })),
    loans: loanRows.results.map((l) => ({
      id: l.id, userId: l.user_id, amount: Number(l.principal), months: Number(l.months),
      ratePct: Number(l.rate_pct), emi: Number(l.emi), totalPayable: Number(l.total_payable),
      paid: Number(l.paid), status: l.status, createdAt: isoOf(l.created_at),
      ...(l.info ? JSON.parse(l.info) : {}),
      ...(l.processing_fee != null ? { processingFee: Number(l.processing_fee) } : {}),
      ...(l.fee_status ? { feeStatus: l.fee_status } : {}),
      ...(l.fee_method ? { feeMethod: l.fee_method } : {}),
      ...(l.fee_tx_ref ? { feeTxRef: l.fee_tx_ref } : {}),
    })),
    stakes: stkRows.results.map((s) => ({
      id: s.id, userId: s.user_id, amount: Number(s.amount), apy: Number(s.apy),
      termDays: Number(s.term_days), startAt: isoOf(s.start_at), status: s.status,
    })),
  };
  if (!lite) {
    // Phase 3 slices: platform content, own support tickets, own level
    // requests and server-side notifications (broadcasts, admin alerts,
    // decision notices) — merged by the client store on every pull.
    state.content = await loadContent(db);
    state.tickets = await loadTickets(db, uid);
    state.levelRequests = await loadLevelRequests(db, uid);
    state.notifications = await loadServerNotifications(db, uid);
  }
  return state;
}

async function loadDirectory(db) {
  const rows = await db.prepare(
    `SELECT u.id, u.email, u.username, u.role, u.status, u.level, u.referral_code, u.admin_scope, u.created_at, p.full_name,
       (SELECT status FROM kyc_submissions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) AS kyc_status,
       (SELECT doc_type FROM kyc_submissions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) AS kyc_doc_type,
       (SELECT doc_number FROM kyc_submissions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) AS kyc_doc_number,
       (SELECT created_at FROM kyc_submissions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) AS kyc_created_at
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id ORDER BY u.created_at ASC`
  ).all();
  return rows.results.map((u) => ({
    id: u.id, email: u.email, username: u.username, name: u.full_name || "",
    role: u.role, status: u.status, level: Number(u.level), referralCode: u.referral_code,
    ...(u.admin_scope ? { adminScope: u.admin_scope } : {}),
    createdAt: isoOf(u.created_at),
    kyc: u.kyc_status || "unverified",
    ...(u.kyc_status ? { kycDocType: u.kyc_doc_type, kycDocNumber: u.kyc_doc_number, kycSubmittedAt: isoOf(u.kyc_created_at) } : {}),
  }));
}

async function loadOverview(db) {
  const users = await loadDirectory(db);
  const wallets = {}, transactions = [], deposits = [], withdrawals = [], loans = [], stakes = [];
  for (const u of users) {
    const st = await loadState(db, u.id, true);
    if (!st) continue;
    wallets[u.id] = st.wallet;
    transactions.push(...st.transactions);
    deposits.push(...st.deposits);
    withdrawals.push(...st.withdrawals);
    loans.push(...st.loans);
    stakes.push(...st.stakes);
  }
  const byDate = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);
  transactions.sort(byDate); deposits.sort(byDate); withdrawals.sort(byDate); loans.sort(byDate); stakes.sort(byDate);
  const errRows = await db.prepare("SELECT * FROM client_errors ORDER BY created_at DESC LIMIT 50").all();
  return {
    users, wallets, transactions, deposits, withdrawals, loans, stakes,
    tickets: await loadTickets(db, null),
    levelRequests: await loadLevelRequests(db, null),
    content: await loadContent(db),
    errors: errRows.results.map((e) => ({ id: e.id, userId: e.user_id, message: e.message, url: e.url, createdAt: isoOf(e.created_at) })),
  };
}

// ---- Identity endpoints -----------------------------------------------------

async function handleBootstrap(request, env, auth) {
  const db = env.DB;
  const existing = await getUserRow(db, auth.uid);
  if (existing) {
    return json(request, {
      ok: true,
      created: false,
      user: { id: existing.id, email: existing.email, username: existing.username, role: existing.role },
    });
  }
  if (await featureOff(db, "registration")) {
    return json(request, { error: "New registrations are temporarily closed. Please try again later." }, 403);
  }
  let body = {};
  try { body = await request.json(); } catch { /* empty body */ }
  const username = String(body.username || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim();
  const pinHash = String(body.pinHash || "");
  const phone = body.phone ? String(body.phone).trim() : null;
  if (!username || !fullName || !pinHash) {
    return json(request, { error: "username, fullName and pinHash are required" }, 400);
  }
  const email = auth.email || String(body.email || "");
  const referralCode = "NW" + auth.uid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  let referrerId = null;
  if (body.referralCode) {
    const ref = await db.prepare("SELECT id FROM users WHERE referral_code = ?").bind(String(body.referralCode).trim()).first();
    if (ref && ref.id !== auth.uid) referrerId = ref.id;
  }
  const walletId = crypto.randomUUID();
  const stmts = [
    db.prepare(
      "INSERT INTO users (id, email, phone, username, pin_hash, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(auth.uid, email, phone, username, pinHash, referralCode, referrerId),
    db.prepare("INSERT INTO user_profiles (user_id, full_name) VALUES (?, ?)").bind(auth.uid, fullName),
    db.prepare("INSERT INTO wallets (id, user_id) VALUES (?, ?)").bind(walletId, auth.uid),
    db.prepare("INSERT INTO wallet_balances (wallet_id, currency, available, locked) VALUES (?, 'BDT', 0, 0)").bind(walletId),
  ];
  if (referrerId) {
    stmts.push(db.prepare("INSERT OR IGNORE INTO referrals (id, referrer_id, referred_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), referrerId, auth.uid));
  }
  try {
    await db.batch(stmts);
  } catch (e) {
    return json(request, { error: "bootstrap_failed", detail: String(e?.message || e) }, 500);
  }
  return json(request, { ok: true, created: true, user: { id: auth.uid, email, username, role: "user" } });
}

async function handleMe(request, env, auth) {
  const db = env.DB;
  const row = await getUserRow(db, auth.uid);
  if (!row) return json(request, { error: "profile_not_bootstrapped" }, 404);
  const wallet = await getWallet(db, auth.uid);
  return json(request, {
    user: {
      id: row.id, email: row.email, username: row.username, fullName: row.full_name,
      phone: row.phone, role: row.role, status: row.status, level: row.level,
      referralCode: row.referral_code, pinHash: row.pin_hash,
      walletId: wallet ? wallet.id : null,
    },
  });
}

// ---- Shared money logic (returns { error } or { stmts, ... }) ---------------

async function checkPin(db, uid, pin) {
  const row = await db.prepare("SELECT pin_hash FROM users WHERE id = ?").bind(uid).first();
  if (!row) return "Account not found.";
  if (row.pin_hash !== hashSecret(String(pin || ""))) return "Incorrect transaction PIN.";
  return null;
}

async function buyLogic(db, uid, symbol, amount, priceUsd) {
  const settings = await getSettings(db);
  const rate = settings.bdtPerUsd;
  const wallet = await getWallet(db, uid);
  if (!wallet) return { error: "Wallet not found." };
  const bals = await getBalances(db, wallet.id);
  const avail = balOf(bals, "BDT");
  const stmts = [ensureCurrencyStmt(db, symbol)];
  if (symbol === "USDT") {
    if (amount > avail) return { error: "Insufficient BDT balance." };
    const coins = amount / rate;
    stmts.push(adjStmt(db, wallet.id, "BDT", -amount));
    stmts.push(adjStmt(db, wallet.id, "USDT", coins));
    const t = txStmt(db, { userId: uid, category: "crypto_buy", title: "Bought USDT", amount, currency: "USDT", note: coins.toFixed(2) + " USDT @ 1.00 USDT" });
    stmts.push(t.stmt);
    return { stmts };
  }
  const heldUsdt = balOf(bals, "USDT");
  const shortfall = Math.max(0, amount - heldUsdt);
  if (shortfall * rate > avail) return { error: "Insufficient balance. Add money first." };
  const coins = amount / priceUsd;
  stmts.push(adjStmt(db, wallet.id, "USDT", -Math.min(amount, heldUsdt)));
  if (shortfall > 0) stmts.push(adjStmt(db, wallet.id, "BDT", -Math.round(shortfall * rate)));
  stmts.push(adjStmt(db, wallet.id, symbol, coins));
  const t = txStmt(db, { userId: uid, category: "crypto_buy", title: "Bought " + symbol, amount: Math.round(amount * rate), currency: symbol, note: coins.toFixed(6) + " " + symbol + " @ " + priceUsd + " USDT" });
  stmts.push(t.stmt);
  return { stmts };
}

async function sellLogic(db, uid, symbol, coinAmount, priceUsd) {
  const settings = await getSettings(db);
  const rate = settings.bdtPerUsd;
  const wallet = await getWallet(db, uid);
  if (!wallet) return { error: "Wallet not found." };
  const bals = await getBalances(db, wallet.id);
  if (coinAmount > balOf(bals, symbol)) return { error: "Insufficient " + symbol + " balance." };
  const stmts = [ensureCurrencyStmt(db, symbol)];
  if (symbol === "USDT") {
    const bdt = coinAmount * rate;
    stmts.push(adjStmt(db, wallet.id, "USDT", -coinAmount));
    stmts.push(adjStmt(db, wallet.id, "BDT", bdt));
    const t = txStmt(db, { userId: uid, category: "crypto_sell", title: "Sold USDT", amount: Math.round(bdt), currency: "USDT", note: coinAmount + " USDT @ 1.00 USDT" });
    stmts.push(t.stmt);
    return { stmts };
  }
  const usdt = coinAmount * priceUsd;
  stmts.push(adjStmt(db, wallet.id, symbol, -coinAmount));
  stmts.push(adjStmt(db, wallet.id, "USDT", usdt));
  const t = txStmt(db, { userId: uid, category: "crypto_sell", title: "Sold " + symbol, amount: Math.round(usdt * rate), currency: symbol, note: coinAmount + " " + symbol + " @ " + priceUsd + " USDT" });
  stmts.push(t.stmt);
  return { stmts };
}

// ---- Money endpoints ----------------------------------------------------------

// Account-status gate: a frozen wallet cannot move or commit money; a
// suspended account cannot transact at all (money-in included).
async function statusGate(db, uid, opts = {}) {
  const u = await getUserRow(db, uid);
  if (!u) return "Account not found.";
  if (u.status === "suspended") return "Your account is suspended. Contact support.";
  if (u.status === "frozen" && !opts.moneyIn) return "Your wallet is frozen. Contact support.";
  return null;
}

async function handleSend(request, env, auth, body) {
  const db = env.DB;
  const { toUserId, amount, note, pin } = body;
  if (badAmount(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  if (!toUserId || toUserId === auth.uid) return json(request, { error: "You cannot send money to yourself." }, 400);
  const pinErr = await checkPin(db, auth.uid, pin);
  if (pinErr) return json(request, { error: pinErr }, 400);
  const sender = await getUserRow(db, auth.uid);
  if (!sender) return json(request, { error: "Account not found." }, 404);
  if (sender.status === "frozen") return json(request, { error: "Your wallet is frozen." }, 400);
  if (sender.status === "suspended") return json(request, { error: "Your account is suspended." }, 400);
  const recipient = await getUserRow(db, toUserId);
  if (!recipient) return json(request, { error: "Recipient not found." }, 404);
  const settings = await getSettings(db);
  const disc = await feeDiscount(db, Number(sender.level));
  const fee = round2(amount * (settings.sendPct * (1 - disc / 100)) / 100);
  const sw = await getWallet(db, auth.uid);
  const rw = await getWallet(db, toUserId);
  if (!sw || !rw) return json(request, { error: "Wallet not found." }, 404);
  const sBals = await getBalances(db, sw.id);
  if (amount + fee > balOf(sBals, "BDT")) return json(request, { error: "Insufficient balance (amount + fee exceeds available balance)." }, 400);
  const sendTx = txStmt(db, { userId: auth.uid, category: "send", title: "Sent to " + (recipient.full_name || recipient.username), amount, fee, note: note || undefined, counterparty: toUserId });
  const recvTx = txStmt(db, { userId: toUserId, category: "receive", title: "Received from " + (sender.full_name || sender.username), amount, fee: 0, counterparty: auth.uid });
  try {
    await db.batch([
      adjStmt(db, sw.id, "BDT", -(amount + fee)),
      adjStmt(db, rw.id, "BDT", amount),
      sendTx.stmt, recvTx.stmt,
      db.prepare("INSERT INTO transfers (id, transaction_id, from_user, to_user, amount, fee) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), sendTx.id, auth.uid, toUserId, amount, fee),
    ]);
  } catch (e) {
    return json(request, { error: "Send failed: " + String(e?.message || e) }, 500);
  }
  const state = await loadState(db, auth.uid);
  return json(request, {
    ok: true, state,
    tx: { id: sendTx.pub, userId: auth.uid, category: "send", title: "Sent to " + (recipient.full_name || recipient.username), amount, fee, currency: "BDT", status: "completed", note: note || undefined, counterparty: recipient.full_name || recipient.username, createdAt: nowISO() },
  });
}

async function handleDeposit(request, env, auth, body) {
  const db = env.DB;
  if (await featureOff(db, "deposits")) return json(request, { error: "Deposits are temporarily unavailable. Please try again later." }, 403);
  const sgd = await statusGate(db, auth.uid, { moneyIn: true });
  if (sgd) return json(request, { error: sgd }, 400);
  const { method, amount, trxId } = body;
  if (badAmount(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  if (!method || !trxId) return json(request, { error: "Method and transaction ID are required." }, 400);
  const id = pubId("DEP");
  const t = txStmt(db, { userId: auth.uid, category: "add_money", title: "Add Money via " + method, amount, status: "pending", method });
  try {
    await db.batch([
      db.prepare("INSERT INTO deposits (id, user_id, method, amount, provider_trx_id, receipt_url, status, method_id, kind, verification, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)")
        .bind(id, auth.uid, method, amount, trxId, body.receipt || null, body.methodId || null, body.kind || null, body.verification || null, nowISO()),
      t.stmt,
    ]);
  } catch (e) {
    if (String(e?.message || e).includes("UNIQUE")) return json(request, { error: "This transaction ID has already been submitted." }, 400);
    return json(request, { error: "Deposit failed: " + String(e?.message || e) }, 500);
  }
  await notifyAdminsServer(db, "deposit", "💰 New deposit request", "A deposit of " + amount + " via " + method + " is waiting for review.", "/admin?tab=finance");
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleWithdraw(request, env, auth, body) {
  const db = env.DB;
  if (await featureOff(db, "withdrawals")) return json(request, { error: "Withdrawals are temporarily unavailable. Please try again later." }, 403);
  const { method, amount, destination, pin } = body;
  if (badAmount(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  const pinErr = await checkPin(db, auth.uid, pin);
  if (pinErr) return json(request, { error: pinErr }, 400);
  const me = await getUserRow(db, auth.uid);
  if (!me) return json(request, { error: "Account not found." }, 404);
  if (me.status === "frozen") return json(request, { error: "Your wallet is frozen. Contact support." }, 400);
  if (me.status === "suspended") return json(request, { error: "Your account is suspended. Contact support." }, 400);
  const settings = await getSettings(db);
  const disc = await feeDiscount(db, Number(me.level));
  const fee = Math.round(amount * (settings.cashoutPct * (1 - disc / 100)) / 100);
  const wallet = await getWallet(db, auth.uid);
  const bals = await getBalances(db, wallet.id);
  if (amount > balOf(bals, "BDT")) return json(request, { error: "Insufficient available balance." }, 400);
  const id = pubId("WDR");
  const t = txStmt(db, { userId: auth.uid, category: "cash_out", title: "Cash Out to " + method, amount, fee, status: "pending", method });
  try {
    await db.batch([
      adjStmt(db, wallet.id, "BDT", -amount, amount),
      db.prepare("INSERT INTO withdrawals (id, user_id, method, amount, fee, destination, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)").bind(id, auth.uid, method, amount, fee, destination, nowISO()),
      t.stmt,
    ]);
  } catch (e) {
    return json(request, { error: "Cash out failed: " + String(e?.message || e) }, 500);
  }
  await notifyAdminsServer(db, "withdraw", "🏧 New cash out request", "A cash out of " + amount + " to " + method + " is waiting for review.", "/admin?tab=finance");
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleDirectWithdraw(request, env, auth, body) {
  const db = env.DB;
  if (await featureOff(db, "withdrawals")) return json(request, { error: "Withdrawals are temporarily unavailable. Please try again later." }, 403);
  const { method, amount, destination } = body;
  if (badAmount(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  const me = await getUserRow(db, auth.uid);
  if (!me) return json(request, { error: "Account not found." }, 404);
  if (Number(me.level) < 2) return json(request, { error: "Direct Withdraw needs a Level 2 account. Please upgrade first." }, 400);
  if (me.status === "frozen") return json(request, { error: "Your wallet is frozen. Contact support." }, 400);
  if (me.status === "suspended") return json(request, { error: "Your account is suspended. Contact support." }, 400);
  const settings = await getSettings(db);
  const disc = await feeDiscount(db, Number(me.level));
  const fee = Math.round(amount * (settings.cashoutPct * (1 - disc / 100)) / 100);
  const wallet = await getWallet(db, auth.uid);
  const bals = await getBalances(db, wallet.id);
  if (amount > balOf(bals, "BDT")) return json(request, { error: "Insufficient available balance." }, 400);
  const id = pubId("WDR");
  const t = txStmt(db, { userId: auth.uid, category: "direct_withdraw", title: "Direct Withdraw to " + method, amount, fee, status: "completed", method, note: "Instant withdrawal — no admin review" });
  try {
    await db.batch([
      adjStmt(db, wallet.id, "BDT", -amount),
      db.prepare("INSERT INTO withdrawals (id, user_id, method, amount, fee, destination, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)").bind(id, auth.uid, method, amount, fee, destination, nowISO()),
      t.stmt,
    ]);
  } catch (e) {
    return json(request, { error: "Direct withdraw failed: " + String(e?.message || e) }, 500);
  }
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleTrade(request, env, auth, body, side) {
  const db = env.DB;
  if (auth.role !== "admin" && await featureOff(db, "trading")) return json(request, { error: "Trading is temporarily unavailable. Please try again later." }, 403);
  const { symbol, priceUsd } = body;
  if (!symbol || !(priceUsd > 0)) return json(request, { error: "Enter a valid amount." }, 400);
  const target = body.forUserId && auth.role === "admin" ? body.forUserId : auth.uid;
  if (target === auth.uid) { const sg = await statusGate(db, auth.uid); if (sg) return json(request, { error: sg }, 400); }
  let r;
  if (side === "buy") {
    if (badAmount(body.amount)) return json(request, { error: "Enter a valid amount." }, 400);
    r = await buyLogic(db, target, symbol, body.amount, priceUsd);
  } else {
    if (badAmount(body.coinAmount)) return json(request, { error: "Enter a valid amount." }, 400);
    r = await sellLogic(db, target, symbol, body.coinAmount, priceUsd);
  }
  if (r.error) return json(request, { error: r.error }, 400);
  try { await db.batch(r.stmts); } catch (e) { return json(request, { error: "Trade failed: " + String(e?.message || e) }, 500); }
  if (target !== auth.uid) return json(request, { ok: true, overview: await loadOverview(db) });
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleSwap(request, env, auth, body) {
  const db = env.DB;
  if (await featureOff(db, "trading")) return json(request, { error: "Trading is temporarily unavailable. Please try again later." }, 403);
  const sgs = await statusGate(db, auth.uid);
  if (sgs) return json(request, { error: sgs }, 400);
  const { fromSym, toSym, amountFrom, prices } = body;
  if (fromSym === toSym) return json(request, { error: "Choose two different assets." }, 400);
  if (badAmount(amountFrom)) return json(request, { error: "Enter a valid amount." }, 400);
  const settings = await getSettings(db);
  const rate = settings.bdtPerUsd;
  const priceOf = (sym) => sym === "BDT" ? 1 / rate : sym === "USDT" ? 1 : (prices?.[sym] ?? 0);
  if (!priceOf(fromSym) || !priceOf(toSym)) return json(request, { error: "Live price unavailable for this pair." }, 400);
  const wallet = await getWallet(db, auth.uid);
  const bals = await getBalances(db, wallet.id);
  const avail = balOf(bals, "BDT");
  const heldFrom = balOf(bals, fromSym);
  const spendableFrom = fromSym === "BDT" ? avail : fromSym === "USDT" ? heldFrom + avail / rate : heldFrom;
  if (amountFrom > spendableFrom) return json(request, { error: "Insufficient " + fromSym + " balance." }, 400);
  const usdGross = amountFrom * priceOf(fromSym);
  const feeUsd = usdGross * 0.005;
  const toAmt = (usdGross - feeUsd) / priceOf(toSym);
  const stmts = [ensureCurrencyStmt(db, fromSym), ensureCurrencyStmt(db, toSym)];
  if (fromSym === "BDT") stmts.push(adjStmt(db, wallet.id, "BDT", -amountFrom));
  else if (fromSym === "USDT") {
    const fromHeld = Math.min(amountFrom, heldFrom);
    stmts.push(adjStmt(db, wallet.id, "USDT", -fromHeld));
    const rest = amountFrom - fromHeld;
    if (rest > 0) stmts.push(adjStmt(db, wallet.id, "BDT", -Math.round(rest * rate)));
  } else stmts.push(adjStmt(db, wallet.id, fromSym, -amountFrom));
  if (toSym === "BDT") stmts.push(adjStmt(db, wallet.id, "BDT", toAmt));
  else stmts.push(adjStmt(db, wallet.id, toSym, toAmt));
  const note = amountFrom + " " + fromSym + " → " + (toSym === "BDT" ? Math.round(toAmt) : toSym === "USDT" ? toAmt.toFixed(2) : toAmt.toFixed(6)) + " " + toSym;
  const t = txStmt(db, { userId: auth.uid, category: "swap", title: "Swap " + fromSym + " → " + toSym, amount: Math.round(usdGross * rate), fee: Math.round(feeUsd * rate), note });
  stmts.push(t.stmt);
  try { await db.batch(stmts); } catch (e) { return json(request, { error: "Swap failed: " + String(e?.message || e) }, 500); }
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleStake(request, env, auth, body) {
  const db = env.DB;
  const sgk = await statusGate(db, auth.uid);
  if (sgk) return json(request, { error: sgk }, 400);
  const { amount, apy, termDays } = body;
  if (badAmount(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  const settings = await getSettings(db);
  const rate = settings.bdtPerUsd;
  const wallet = await getWallet(db, auth.uid);
  const bals = await getBalances(db, wallet.id);
  const heldUsdt = balOf(bals, "USDT");
  const usdtPart = Math.min(heldUsdt, amount / rate);
  const cashPart = amount - Math.round(usdtPart * rate);
  if (cashPart > balOf(bals, "BDT")) return json(request, { error: "Insufficient balance. Add money first." }, 400);
  const id = pubId("STK");
  const t = txStmt(db, { userId: auth.uid, category: "stake", title: "Staked in Earn (" + apy + "% APY)", amount });
  const stmts = [];
  if (usdtPart > 0) stmts.push(adjStmt(db, wallet.id, "USDT", -usdtPart));
  stmts.push(adjStmt(db, wallet.id, "BDT", -cashPart, amount));
  stmts.push(db.prepare("INSERT INTO stakes (id, user_id, amount, apy, term_days, start_at, status) VALUES (?, ?, ?, ?, ?, ?, 'active')").bind(id, auth.uid, amount, apy, termDays ?? 0, nowISO()));
  stmts.push(t.stmt);
  try { await db.batch(stmts); } catch (e) { return json(request, { error: "Stake failed: " + String(e?.message || e) }, 500); }
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function unstakeCore(db, uid, stakeId, ignoreTerm) {
  const st = await db.prepare("SELECT * FROM stakes WHERE id = ? AND user_id = ?").bind(stakeId, uid).first();
  if (!st || st.status !== "active") return { error: "Stake not found." };
  const startMs = new Date(st.start_at).getTime();
  if (!ignoreTerm && Number(st.term_days) > 0) {
    const unlockAt = startMs + Number(st.term_days) * 86_400_000;
    if (Date.now() < unlockAt) {
      return { error: "This " + st.term_days + "-day plan is locked until " + new Date(unlockAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ". For an early release, please message Support." };
    }
  }
  const days = Math.max(0, (Date.now() - startMs) / 86_400_000);
  const amount = Number(st.amount);
  const interest = Math.round(amount * Number(st.apy) / 100 * days / 365);
  const wallet = await getWallet(db, uid);
  const t = txStmt(db, { userId: uid, category: "earn", title: "Earn unstaked + interest", amount: amount + interest, note: "Interest earned: " + interest + " BDT over " + days.toFixed(2) + " days" });
  const stmts = [
    adjStmt(db, wallet.id, "BDT", amount + interest, -amount),
    db.prepare("UPDATE stakes SET status = 'closed' WHERE id = ?").bind(stakeId),
    t.stmt,
  ];
  return { stmts };
}

async function handleUnstake(request, env, auth, body) {
  const db = env.DB;
  const sgu = await statusGate(db, auth.uid);
  if (sgu) return json(request, { error: sgu }, 400);
  const r = await unstakeCore(db, auth.uid, body.stakeId, false);
  if (r.error) return json(request, { error: r.error }, 400);
  try { await db.batch(r.stmts); } catch (e) { return json(request, { error: "Unstake failed: " + String(e?.message || e) }, 500); }
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleLoanApply(request, env, auth, body) {
  const db = env.DB;
  if (await featureOff(db, "loans")) return json(request, { error: "Loan applications are temporarily unavailable. Please try again later." }, 403);
  const sgl = await statusGate(db, auth.uid);
  if (sgl) return json(request, { error: sgl }, 400);
  const { amount, months, info } = body;
  if (badAmount(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  const settings = await getSettings(db);
  if (amount < settings.minLoan || amount > settings.maxLoan) return json(request, { error: "Loan amount must be between ৳" + settings.minLoan.toLocaleString() + " and ৳" + settings.maxLoan.toLocaleString() + "." }, 400);
  if (!(months >= 1 && months <= 36)) return json(request, { error: "Choose a term between 1 and 36 months." }, 400);
  const { emi, total } = emiCalc(amount, settings.loanRatePct, months);
  const id = pubId("LOAN");
  try {
    await db.prepare("INSERT INTO loans (id, user_id, principal, rate_pct, months, emi, total_payable, paid, status, info, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?)")
      .bind(id, auth.uid, amount, settings.loanRatePct, months, Math.round(emi), Math.round(total), info ? JSON.stringify(info) : null, nowISO()).run();
  } catch (e) {
    return json(request, { error: "Loan application failed: " + String(e?.message || e) }, 500);
  }
  await notifyAdminsServer(db, "loan", "🏦 New loan application", "A loan application of " + amount + " is waiting for review.", "/admin?tab=loans");
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleLoanRepay(request, env, auth, body) {
  const db = env.DB;
  const { loanId, amount } = body;
  if (badAmount(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  const loan = await db.prepare("SELECT * FROM loans WHERE id = ? AND user_id = ?").bind(loanId, auth.uid).first();
  if (!loan || loan.status !== "active") return json(request, { error: "Active loan not found." }, 404);
  const remaining = Number(loan.total_payable) - Number(loan.paid);
  if (amount > remaining) return json(request, { error: "Amount exceeds outstanding balance of ৳" + remaining.toLocaleString() + "." }, 400);
  const wallet = await getWallet(db, auth.uid);
  const bals = await getBalances(db, wallet.id);
  if (amount > balOf(bals, "BDT")) return json(request, { error: "Insufficient balance." }, 400);
  const newPaid = Number(loan.paid) + amount;
  const done = newPaid >= Number(loan.total_payable);
  const t = txStmt(db, { userId: auth.uid, category: "loan_repayment", title: "Loan repayment", amount });
  try {
    await db.batch([
      adjStmt(db, wallet.id, "BDT", -amount),
      db.prepare("UPDATE loans SET paid = ?, status = ? WHERE id = ?").bind(newPaid, done ? "repaid" : "active", loanId),
      db.prepare("INSERT INTO loan_repayments (id, loan_id, amount) VALUES (?, ?, ?)").bind(crypto.randomUUID(), loanId, amount),
      t.stmt,
    ]);
  } catch (e) {
    return json(request, { error: "Repayment failed: " + String(e?.message || e) }, 500);
  }
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleLoanFee(request, env, auth, body) {
  const db = env.DB;
  const { loanId, action } = body;
  const loan = await db.prepare("SELECT * FROM loans WHERE id = ?").bind(loanId).first();
  if (!loan) return json(request, { error: "Loan not found." }, 404);
  if (action === "set") {
    if (auth.role !== "admin") return json(request, { error: "Admin only." }, 403);
    await db.prepare("UPDATE loans SET processing_fee = ?, fee_status = 'unpaid' WHERE id = ?").bind(body.amount, loanId).run();
    return json(request, { ok: true, overview: await loadOverview(db) });
  }
  if (action === "submit") {
    if (loan.user_id !== auth.uid) return json(request, { error: "Not your loan." }, 403);
    await db.prepare("UPDATE loans SET fee_status = 'submitted', fee_method = ?, fee_tx_ref = ? WHERE id = ?").bind(body.method || null, body.ref || null, loanId).run();
    return json(request, { ok: true, state: await loadState(db, auth.uid) });
  }
  if (action === "confirm") {
    if (auth.role !== "admin") return json(request, { error: "Admin only." }, 403);
    await db.prepare("UPDATE loans SET fee_status = 'paid' WHERE id = ?").bind(loanId).run();
    return json(request, { ok: true, overview: await loadOverview(db) });
  }
  return json(request, { error: "Unknown fee action." }, 400);
}

const EARN_CAPS = {
  checkin: { perDay: 1, max: 100 }, ad: { perDay: 10, max: 50 },
  spin: { perDay: 5, max: 150 }, scratch: { perDay: 5, max: 150 },
  task: { perDay: 20, max: 250 }, quiz: { perDay: 1, max: 250 },
};

async function handleEarnClaim(request, env, auth, body) {
  const db = env.DB;
  const sge = await statusGate(db, auth.uid, { moneyIn: true });
  if (sge) return json(request, { error: sge }, 400);
  const { kind, amount, title } = body;
  const cap = EARN_CAPS[kind];
  if (!cap) return json(request, { error: "Unknown reward kind." }, 400);
  if (badAmount(amount) || amount > cap.max) return json(request, { error: "Invalid reward amount." }, 400);
  const today = new Date().toISOString().slice(0, 10);
  const cnt = await db.prepare(
    "SELECT COUNT(*) AS c FROM transactions WHERE user_id = ? AND category = 'earn' AND note = ? AND created_at LIKE ?"
  ).bind(auth.uid, "earn:" + kind, today + "%").first();
  if (Number(cnt?.c ?? 0) >= cap.perDay) return json(request, { error: "Daily limit reached for this reward." }, 400);
  const wallet = await getWallet(db, auth.uid);
  const safeTitle = String(title || "Earn reward").slice(0, 80);
  const t = txStmt(db, { userId: auth.uid, category: "earn", title: safeTitle, amount, note: "earn:" + kind });
  try {
    await db.batch([adjStmt(db, wallet.id, "BDT", amount), t.stmt]);
  } catch (e) {
    return json(request, { error: "Claim failed: " + String(e?.message || e) }, 500);
  }
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

// ---- Phase 3: content, tickets, levels, notifications, RBAC --------------------

async function getSettingKey(db, key, fallback) {
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(key).first();
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}
async function setSettingKey(db, key, value) {
  await db.prepare("INSERT INTO platform_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, JSON.stringify(value)).run();
}

const FEATURE_DEFAULTS = { deposits: true, withdrawals: true, trading: true, loans: true, registration: true };
async function getFeatures(db) {
  return { ...FEATURE_DEFAULTS, ...(await getSettingKey(db, "features", {})) };
}
async function featureOff(db, name) {
  const f = await getFeatures(db);
  return f[name] === false;
}

async function loadContent(db) {
  const s = await getSettings(db);
  const maint = await getSettingKey(db, "maintenance", { enabled: false });
  const plat = await getSettingKey(db, "platform", { name: "NovaWallet" });
  const payMethods = await getSettingKey(db, "paymethods", []);
  const newsRows = await db.prepare("SELECT * FROM news ORDER BY created_at DESC LIMIT 50").all();
  const bannerRows = await db.prepare("SELECT * FROM banners ORDER BY sort_order ASC").all();
  return {
    settings: {
      sendFeePct: s.sendPct, cashoutFeePct: s.cashoutPct, referralPct: s.referralPct,
      loanRatePct: s.loanRatePct, minLoan: s.minLoan, maxLoan: s.maxLoan, loanLimit: s.loanLimit,
      bdtPerUsd: s.bdtPerUsd, maintenance: !!maint.enabled, platformName: plat.name || "NovaWallet",
      features: await getFeatures(db), payMethods,
    },
    news: newsRows.results.map((n) => ({
      id: n.id, title: n.title, category: n.category, excerpt: n.excerpt, body: n.body,
      source: n.source, date: isoOf(n.created_at), featured: !!n.featured,
      gradient: n.gradient || "from-violet-600 via-purple-600 to-indigo-600",
      ...(n.coin ? { coin: n.coin } : {}),
    })),
    banners: bannerRows.results.map((b) => ({
      id: b.id, title: b.title, subtitle: b.subtitle, gradient: b.gradient, active: !!b.is_active,
    })),
    levels: await getSettingKey(db, "levels", null),
  };
}

async function loadTickets(db, uid) {
  const rows = uid
    ? await db.prepare("SELECT * FROM support_tickets WHERE user_id = ? ORDER BY COALESCE(updated_at, created_at) DESC").bind(uid).all()
    : await db.prepare("SELECT * FROM support_tickets ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 100").all();
  const out = [];
  for (const t of rows.results) {
    const msgs = await db.prepare("SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC").bind(t.id).all();
    out.push({
      id: t.id, userId: t.user_id, subject: t.subject, status: t.status,
      createdAt: isoOf(t.created_at), updatedAt: isoOf(t.updated_at || t.created_at),
      messages: msgs.results.map((m) => ({ id: m.id, from: m.sender, text: m.text, at: isoOf(m.created_at) })),
    });
  }
  return out;
}

async function loadLevelRequests(db, uid) {
  const rows = uid
    ? await db.prepare("SELECT * FROM level_upgrade_requests WHERE user_id = ? ORDER BY created_at DESC").bind(uid).all()
    : await db.prepare("SELECT * FROM level_upgrade_requests ORDER BY created_at DESC LIMIT 100").all();
  return rows.results.map((r) => ({
    id: r.id, userId: r.user_id, fromLevel: Number(r.from_level), toLevel: Number(r.to_level),
    status: r.status, createdAt: isoOf(r.created_at),
  }));
}

async function loadServerNotifications(db, uid) {
  const rows = await db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(uid).all();
  return rows.results.map((n) => ({
    id: n.id, userId: n.user_id, title: n.title, body: n.body, kind: n.kind,
    read: !!n.is_read, createdAt: isoOf(n.created_at), ...(n.link ? { link: n.link } : {}),
  }));
}

async function notifyServer(db, userId, kind, title, body, link) {
  try {
    await db.prepare("INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(pubId("NTF"), userId, kind, title, body, link || null).run();
  } catch { /* notifications never block the money path */ }
}
async function notifyAdminsServer(db, kind, title, body, link) {
  const rows = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
  for (const r of rows.results) await notifyServer(db, r.id, kind, title, body, link);
}
async function auditLog(db, auth, action, detail) {
  try {
    await db.prepare("INSERT INTO audit_logs (id, actor, action, detail) VALUES (?, ?, ?, ?)")
      .bind(pubId("AUD"), auth.uid, action, String(detail || "").slice(0, 300)).run();
  } catch { /* best effort */ }
}
function scopeAllowed(auth, scopes) {
  return auth.role === "admin" && (auth.scope === "full" || scopes.includes(auth.scope));
}

// ---- Phase 3 handlers -----------------------------------------------------------

// The customer's OWN linked payment methods (their bank account / crypto
// wallet) — full CRUD, synced via loadState.
async function handlePayMethodSave(request, env, auth, body) {
  const db = env.DB;
  const type = body.type === "crypto" ? "crypto" : body.type === "bank" ? "bank" : null;
  const label = String(body.label || "").trim().slice(0, 80);
  const detail = String(body.detail || "").trim().slice(0, 200);
  if (!type || !label || !detail) return json(request, { error: "Name and account details are required." }, 400);
  const id = String(body.id || "");
  if (id) {
    const r = await db.prepare("UPDATE user_payment_methods SET type = ?, label = ?, detail = ? WHERE id = ? AND user_id = ?").bind(type, label, detail, id, auth.uid).run();
    if (!r.meta?.changes) return json(request, { error: "Payment method not found." }, 404);
  } else {
    await db.prepare("INSERT INTO user_payment_methods (id, user_id, type, label, detail) VALUES (?, ?, ?, ?, ?)").bind(pubId("PM"), auth.uid, type, label, detail).run();
  }
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handlePayMethodDelete(request, env, auth, body) {
  const db = env.DB;
  await db.prepare("DELETE FROM user_payment_methods WHERE id = ? AND user_id = ?").bind(String(body.id || ""), auth.uid).run();
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleTicketCreate(request, env, auth, body) {
  const db = env.DB;
  const subject = String(body.subject || "").trim().slice(0, 120);
  const message = String(body.message || "").trim().slice(0, 2000);
  if (!subject || !message) return json(request, { error: "Subject and message are required." }, 400);
  const id = pubId("TKT");
  await db.prepare("INSERT INTO support_tickets (id, user_id, subject, message, status, updated_at) VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)")
    .bind(id, auth.uid, subject, message).run();
  await db.prepare("INSERT INTO ticket_messages (id, ticket_id, sender, text) VALUES (?, ?, 'user', ?)")
    .bind(pubId("MSG"), id, message).run();
  const me = await getUserRow(db, auth.uid);
  await notifyAdminsServer(db, "support", "New support chat", (me?.username || "A user") + " opened a support chat: " + subject, "/admin?tab=support");
  return json(request, { ok: true, ticketId: id, state: await loadState(db, auth.uid) });
}

async function handleTicketReply(request, env, auth, body) {
  const db = env.DB;
  const ticketId = String(body.ticketId || "");
  const text = String(body.text || "").trim().slice(0, 2000);
  if (!text) return json(request, { error: "Message is empty." }, 400);
  const tk = await db.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  if (!tk) return json(request, { error: "Ticket not found." }, 404);
  // A reply sent from the admin panel counts as a support reply even on
  // the admin's OWN ticket (the client passes asAdmin); from the user app
  // the same person replies as the customer.
  const asAdmin = auth.role === "admin" && (tk.user_id !== auth.uid || body.asAdmin === true);
  if (!asAdmin && tk.user_id !== auth.uid) return json(request, { error: "Not your ticket." }, 403);
  if (asAdmin && !scopeAllowed(auth, ["support"])) return json(request, { error: "scope_denied" }, 403);
  if (tk.status === "resolved") return json(request, { error: "This chat is resolved and closed." }, 400);
  await db.prepare("INSERT INTO ticket_messages (id, ticket_id, sender, text) VALUES (?, ?, ?, ?)")
    .bind(pubId("MSG"), ticketId, asAdmin ? "admin" : "user", text).run();
  await db.prepare("UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?")
    .bind(asAdmin && tk.status === "pending" ? "processing" : tk.status, ticketId).run();
  if (asAdmin) {
    if (tk.user_id !== auth.uid) await notifyServer(db, tk.user_id, "support", "Support replied", "The support team replied to your chat: " + tk.subject, null);
    return json(request, { ok: true, overview: await loadOverview(db) });
  }
  await notifyAdminsServer(db, "support", "Support chat reply", "New reply in: " + tk.subject, "/admin?tab=support");
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleTicketResolve(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["support"])) return json(request, { error: "scope_denied" }, 403);
  const ticketId = String(body.ticketId || "");
  const tk = await db.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  if (!tk) return json(request, { error: "Ticket not found." }, 404);
  await db.prepare("UPDATE support_tickets SET status = 'resolved', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(ticketId).run();
  await notifyServer(db, tk.user_id, "support", "Support chat resolved", "Your support chat \"" + tk.subject + "\" was marked resolved and closed.", null);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleLevelRequest(request, env, auth, body) {
  const db = env.DB;
  const toLevel = Number(body.toLevel);
  const me = await getUserRow(db, auth.uid);
  if (!me) return json(request, { error: "profile_not_bootstrapped" }, 404);
  const cur = Number(me.level);
  if (toLevel !== cur + 1 || toLevel > 4) return json(request, { error: "You can only request the next level." }, 400);
  if (toLevel === 2) {
    const kycRow = await db.prepare("SELECT status FROM kyc_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(auth.uid).first();
    if (kycRow?.status !== "verified") return json(request, { error: "KYC required: submit your ID first (Profile → KYC verification)." }, 400);
  }
  const pending = await db.prepare("SELECT id FROM level_upgrade_requests WHERE user_id = ? AND status = 'pending'").bind(auth.uid).first();
  if (pending) return json(request, { error: "You already have a pending upgrade request." }, 400);
  const id = pubId("LVR");
  await db.prepare("INSERT INTO level_upgrade_requests (id, user_id, from_level, to_level, status) VALUES (?, ?, ?, ?, 'pending')")
    .bind(id, auth.uid, cur, toLevel).run();
  await notifyAdminsServer(db, "upgrade", "⬆️ Level upgrade request", (me.username || "A user") + " requested Level " + toLevel + " — review it in Levels.", "/admin?tab=levels");
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

// Level definitions live in platform_settings ('levels') so admin edits
// persist server-side and reach every device; mirrors the app seed.
const LEVEL_DEFAULTS = [
  { level: 1, name: 'Level 1', tagline: 'Start your wallet journey', dailyLimit: 25000, monthlyLimit: 200000, loanLimit: 10000, depositRequired: 0, feeDiscountPct: 0, requirement: 'Default for every new account', gradient: 'from-slate-500 to-slate-700' },
  { level: 2, name: 'Level 2', tagline: 'For verified everyday users', dailyLimit: 50000, monthlyLimit: 500000, loanLimit: 30000, depositRequired: 10000, feeDiscountPct: 5, requirement: 'KYC verified', gradient: 'from-slate-400 to-slate-600' },
  { level: 3, name: 'Level 3', tagline: 'Higher limits, lower fees', dailyLimit: 100000, monthlyLimit: 1000000, loanLimit: 60000, depositRequired: 50000, feeDiscountPct: 10, requirement: 'KYC verified + 20 completed transactions', gradient: 'from-amber-500 to-yellow-600' },
  { level: 4, name: 'Level 4', tagline: 'Maximum limits, priority support', dailyLimit: 250000, monthlyLimit: 2500000, loanLimit: 100000, depositRequired: 200000, feeDiscountPct: 20, requirement: 'KYC verified + 50 transactions + admin review', gradient: 'from-violet-600 to-indigo-700' },
];

async function handleAdminSetStatus(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const target = String(body.userId || "");
  const status = String(body.status || "");
  if (!["active", "frozen", "suspended"].includes(status)) return json(request, { error: "Invalid status." }, 400);
  const u = await getUserRow(db, target);
  if (!u) return json(request, { error: "User not found." }, 404);
  if (target === auth.uid && status !== "active") return json(request, { error: "You cannot freeze or suspend your own account." }, 400);
  await db.prepare("UPDATE users SET status = ? WHERE id = ?").bind(status, target).run();
  await auditLog(db, auth, "user." + status, target);
  await notifyServer(db, target, "security",
    status === "frozen" ? "❄️ Wallet frozen" : status === "suspended" ? "⛔ Account suspended" : "✅ Account reactivated",
    status === "frozen" ? "Your wallet has been frozen by an admin. You cannot send, withdraw or trade until it is unfrozen. Contact support if this is unexpected."
      : status === "suspended" ? "Your account has been suspended by an admin. All transactions are blocked. Contact support for help."
      : "Your account is active again. All features are available.", null);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminSetLevel(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const target = String(body.userId || "");
  const level = Math.round(Number(body.level));
  if (!(level >= 1 && level <= 4)) return json(request, { error: "Level must be between 1 and 4." }, 400);
  const u = await getUserRow(db, target);
  if (!u) return json(request, { error: "User not found." }, 404);
  await db.prepare("UPDATE users SET level = ? WHERE id = ?").bind(level, target).run();
  await auditLog(db, auth, "level.set", target + " → Level " + level);
  await notifyServer(db, target, "security", "Account level changed", "An admin set your account to Level " + level + ".", null);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminLevelDef(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const level = Math.round(Number(body.level));
  const patch = body.patch || {};
  const defs = await getSettingKey(db, "levels", null) || LEVEL_DEFAULTS.slice();
  const def = defs.find((x) => x.level === level);
  if (!def) return json(request, { error: "Level not found." }, 404);
  for (const k of ["name", "tagline", "requirement", "gradient"]) if (typeof patch[k] === "string") def[k] = patch[k].slice(0, 200);
  for (const k of ["dailyLimit", "monthlyLimit", "loanLimit", "depositRequired", "feeDiscountPct"]) if (typeof patch[k] === "number" && isFinite(patch[k])) def[k] = Math.max(0, Math.round(patch[k]));
  await setSettingKey(db, "levels", defs);
  if (typeof patch.feeDiscountPct === "number") {
    await db.prepare("UPDATE account_levels SET fee_discount_pct = ? WHERE level = ?").bind(def.feeDiscountPct, level).run();
  }
  await auditLog(db, auth, "level.update", "Level " + level + " definition updated");
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminLevelDecide(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const row = await db.prepare("SELECT * FROM level_upgrade_requests WHERE id = ?").bind(String(body.id || "")).first();
  if (!row || row.status !== "pending") return json(request, { error: "Request not found or already decided." }, 404);
  const ok = !!body.ok;
  await db.prepare("UPDATE level_upgrade_requests SET status = ?, reviewed_by = ? WHERE id = ?")
    .bind(ok ? "approved" : "rejected", auth.uid, row.id).run();
  if (ok) await db.prepare("UPDATE users SET level = ? WHERE id = ?").bind(Number(row.to_level), row.user_id).run();
  await auditLog(db, auth, ok ? "level.approve" : "level.reject", row.user_id + " → Level " + row.to_level);
  await notifyServer(db, row.user_id, "security", ok ? "🎉 Level upgraded" : "Upgrade request rejected",
    ok ? "Your account is now Level " + row.to_level + ". Higher limits are active." : "Your upgrade request was not approved. Check the level requirements and try again.", null);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminNewsSave(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["content"])) return json(request, { error: "scope_denied" }, 403);
  const n = body.item || {};
  const title = String(n.title || "").trim().slice(0, 200);
  if (!title) return json(request, { error: "A headline is required." }, 400);
  const fields = [title, String(n.category || "Market").slice(0, 40), String(n.excerpt || "").slice(0, 300),
    String(n.body || "").slice(0, 8000), String(n.source || "NovaWallet").slice(0, 60),
    n.featured ? 1 : 0, n.coin ? String(n.coin).slice(0, 10) : null, String(n.gradient || "from-violet-600 via-purple-600 to-indigo-600").slice(0, 80)];
  if (n.id) {
    await db.prepare("UPDATE news SET title = ?, category = ?, excerpt = ?, body = ?, source = ?, featured = ?, coin = ?, gradient = ? WHERE id = ?")
      .bind(...fields, String(n.id)).run();
  } else {
    await db.prepare("INSERT INTO news (id, title, category, excerpt, body, source, featured, coin, published_by, gradient) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(pubId("NEWS"), ...fields.slice(0, 6), fields[6], auth.uid, fields[7]).run();
  }
  await auditLog(db, auth, "news.publish", title);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminNewsDelete(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["content"])) return json(request, { error: "scope_denied" }, 403);
  await db.prepare("DELETE FROM news WHERE id = ?").bind(String(body.id || "")).run();
  await auditLog(db, auth, "news.delete", String(body.id || ""));
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminBannerToggle(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["content"])) return json(request, { error: "scope_denied" }, 403);
  await db.prepare("UPDATE banners SET is_active = 1 - is_active WHERE id = ?").bind(String(body.id || "")).run();
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminSettings(request, env, auth, body) {
  const db = env.DB;
  if (auth.scope !== "full") return json(request, { error: "scope_denied" }, 403);
  const s = body.settings || {};
  if (s.sendFeePct != null || s.cashoutFeePct != null) {
    const cur = await getSettingKey(db, "fees", {});
    await setSettingKey(db, "fees", { send_pct: s.sendFeePct ?? cur.send_pct ?? 0.5, cashout_pct: s.cashoutFeePct ?? cur.cashout_pct ?? 1.5 });
  }
  if (s.referralPct != null) await setSettingKey(db, "referral", { commission_pct: s.referralPct });
  if (s.loanRatePct != null || s.minLoan != null || s.maxLoan != null || s.loanLimit != null) {
    const cur = await getSettingKey(db, "loan", {});
    await setSettingKey(db, "loan", { rate_pct: s.loanRatePct ?? cur.rate_pct ?? 12, min: s.minLoan ?? cur.min ?? 1000, max: s.maxLoan ?? cur.max ?? 100000, limit: s.loanLimit ?? cur.limit ?? 100000 });
  }
  if (s.bdtPerUsd != null) await setSettingKey(db, "rates", { bdt_per_usd: s.bdtPerUsd });
  if (s.maintenance != null) await setSettingKey(db, "maintenance", { enabled: !!s.maintenance });
  if (s.platformName != null) await setSettingKey(db, "platform", { name: String(s.platformName).slice(0, 40) });
  if (s.features != null) await setSettingKey(db, "features", { ...FEATURE_DEFAULTS, ...s.features });
  if (Array.isArray(s.payMethods)) await setSettingKey(db, "paymethods", s.payMethods);
  await auditLog(db, auth, "settings.update", Object.keys(s).join(","));
  return json(request, { ok: true, overview: await loadOverview(db), state: await loadState(db, auth.uid) });
}

async function handleAdminBroadcast(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["content"])) return json(request, { error: "scope_denied" }, 403);
  const title = String(body.title || "").trim().slice(0, 120);
  const text = String(body.body || "").trim().slice(0, 500);
  if (!title || !text) return json(request, { error: "Title and message are required." }, 400);
  const users = await db.prepare("SELECT id FROM users").all();
  const stmts = users.results.map((u) => db.prepare("INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES (?, ?, 'announcement', ?, ?, NULL)")
    .bind(pubId("NTF"), u.id, title, text));
  if (stmts.length) await db.batch(stmts);
  await auditLog(db, auth, "broadcast", title + " → " + users.results.length + " users");
  return json(request, { ok: true, sent: users.results.length, overview: await loadOverview(db) });
}

async function handleAdminSetScope(request, env, auth, body) {
  const db = env.DB;
  if (auth.scope !== "full") return json(request, { error: "scope_denied" }, 403);
  const target = String(body.userId || "");
  const scope = ["full", "finance", "content", "support"].includes(body.scope) ? body.scope : null;
  if (!scope) return json(request, { error: "Invalid scope." }, 400);
  const row = await getUserRow(db, target);
  if (!row || row.role !== "admin") return json(request, { error: "Target is not an admin." }, 400);
  await db.prepare("UPDATE users SET admin_scope = ? WHERE id = ?").bind(scope === "full" ? null : scope, target).run();
  await auditLog(db, auth, "admin.scope", target + " → " + scope);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminSetRole(request, env, auth, body) {
  const db = env.DB;
  if (auth.scope !== "full") return json(request, { error: "scope_denied" }, 403);
  const target = String(body.userId || "");
  if (target === auth.uid) return json(request, { error: "You cannot change your own role." }, 400);
  const role = body.role === "admin" ? "admin" : "user";
  const row = await getUserRow(db, target);
  if (!row) return json(request, { error: "User not found." }, 404);
  await db.prepare("UPDATE users SET role = ?, admin_scope = ? WHERE id = ?")
    .bind(role, role === "admin" ? (row.admin_scope || "support") : null, target).run();
  await auditLog(db, auth, "admin.role", target + " → " + role);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminBackup(request, env, auth) {
  const db = env.DB;
  if (auth.scope !== "full") return json(request, { error: "scope_denied" }, 403);
  const tables = ["users", "user_profiles", "wallets", "wallet_balances", "transactions", "deposits", "withdrawals", "loans", "stakes", "kyc_submissions", "support_tickets", "ticket_messages", "level_upgrade_requests", "notifications", "news", "banners", "platform_settings"];
  const dump = { exportedAt: new Date().toISOString(), service: "novawallet-backup", tables: {} };
  for (const t of tables) {
    const rows = await db.prepare(`SELECT * FROM ${t}`).all();
    dump.tables[t] = rows.results;
  }
  // Returned as JSON; the admin client turns it into a file download so
  // the normal CORS/JSON path applies.
  return json(request, { ok: true, backup: dump });
}

// ---- KYC ----------------------------------------------------------------------
// Submissions live in kyc_submissions (photos as data URLs in doc_url /
// face_url). The latest row's status IS the user's KYC status — state and
// directory expose the status + document meta, photos are served only by
// the admin review endpoint so state pulls stay light.
async function handleKycSubmit(request, env, auth, body) {
  const db = env.DB;
  const docType = String(body.docType || "").slice(0, 30);
  const docNumber = String(body.docNumber || "").trim().slice(0, 60);
  if (!docType || !docNumber) return json(request, { error: "Document type and number are required." }, 400);
  const docPhoto = typeof body.docPhoto === "string" && body.docPhoto.startsWith("data:image/") ? body.docPhoto : null;
  const facePhoto = typeof body.facePhoto === "string" && body.facePhoto.startsWith("data:image/") ? body.facePhoto : null;
  if ((docPhoto && docPhoto.length > 900000) || (facePhoto && facePhoto.length > 900000)) {
    return json(request, { error: "A photo is too large — please retake it." }, 400);
  }
  const id = pubId("KYC");
  await db.prepare("INSERT INTO kyc_submissions (id, user_id, doc_type, doc_number, doc_url, face_url, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')")
    .bind(id, auth.uid, docType, docNumber, docPhoto, facePhoto).run();
  await notifyAdminsServer(db, "security", "🪪 New KYC submission", "A user submitted KYC documents (" + docType + ") for review.", "/admin?tab=kyc");
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleAdminKycGet(request, env, auth, targetUid) {
  const row = await env.DB.prepare("SELECT * FROM kyc_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(targetUid).first();
  if (!row) return json(request, { ok: true, kyc: null });
  return json(request, {
    ok: true,
    kyc: {
      status: row.status, docType: row.doc_type, docNumber: row.doc_number,
      docPhoto: row.doc_url, facePhoto: row.face_url, submittedAt: isoOf(row.created_at),
    },
  });
}

async function handleAdminKycDecide(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["support"])) return json(request, { error: "scope_denied" }, 403);
  const target = String(body.userId || "");
  const row = await db.prepare("SELECT id FROM kyc_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(target).first();
  if (!row) {
    // Manual verification: an admin may verify a user who never submitted
    // documents. Recorded as a 'manual' submission so the profile can
    // show "Verified by NovaWallet" instead of document details.
    if (!body.ok) return json(request, { error: "No KYC submission found for this user." }, 404);
    await db.prepare("INSERT INTO kyc_submissions (id, user_id, doc_type, doc_number, status, reviewed_by) VALUES (?, ?, 'manual', '', 'verified', ?)")
      .bind(pubId("KYC"), target, auth.uid).run();
    await notifyServer(db, target, "security", "✅ Verified by NovaWallet", "Your identity was verified by the NovaWallet team. All limits and features are unlocked.", null);
    return json(request, { ok: true, overview: await loadOverview(db) });
  }
  await db.prepare("UPDATE kyc_submissions SET status = ?, reviewed_by = ? WHERE id = ?")
    .bind(body.ok ? "verified" : "unverified", auth.uid, row.id).run();
  await notifyServer(db, target, "security", body.ok ? "✅ KYC verified" : "KYC not approved", body.ok ? "Your identity is verified. All limits and features are unlocked." : "Your KYC submission was not approved. Please check your documents and submit again.", null);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

// ---- Admin endpoints ----------------------------------------------------------

async function handleDecideDeposit(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const dep = await db.prepare("SELECT * FROM deposits WHERE id = ?").bind(body.id).first();
  if (!dep || dep.status !== "pending") return json(request, { error: "Deposit not pending." }, 400);
  const ok = !!body.ok;
  const wallet = await getWallet(db, dep.user_id);
  const stmts = [
    db.prepare("UPDATE deposits SET status = ?, reviewed_by = ? WHERE id = ?").bind(ok ? "approved" : "rejected", auth.uid, dep.id),
    db.prepare("UPDATE transactions SET status = ? WHERE user_id = ? AND category = 'add_money' AND status = 'pending' AND amount = ?")
      .bind(ok ? "completed" : "rejected", dep.user_id, dep.amount),
  ];
  if (ok) {
    stmts.push(adjStmt(db, wallet.id, "BDT", Number(dep.amount)));
    // Referral commission on approved deposits (mirrors the app: 10% of the
    // referral percentage of the deposit amount, rounded).
    const depUser = await getUserRow(db, dep.user_id);
    if (depUser?.referred_by) {
      const settings = await getSettings(db);
      const commission = Math.round(Number(dep.amount) * settings.referralPct / 100 * 0.1);
      if (commission > 0) {
        const refWallet = await getWallet(db, depUser.referred_by);
        if (refWallet) {
          const rt = txStmt(db, { userId: depUser.referred_by, category: "referral", title: "Referral commission", amount: commission });
          stmts.push(adjStmt(db, refWallet.id, "BDT", commission));
          stmts.push(rt.stmt);
          const refRow = await db.prepare("SELECT id FROM referrals WHERE referred_id = ?").bind(dep.user_id).first();
          if (refRow) {
            stmts.push(db.prepare("INSERT INTO referral_commissions (id, referral_id, amount, source_transaction) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), refRow.id, commission, rt.pub));
          }
        }
      }
    }
  }
  try { await db.batch(stmts); } catch (e) { return json(request, { error: "Decision failed: " + String(e?.message || e) }, 500); }
  await notifyServer(db, dep.user_id, "deposit", ok ? "Deposit approved" : "Deposit rejected", ok ? "Your deposit of " + dep.amount + " was approved and credited." : "Your deposit of " + dep.amount + " was rejected. Please check the details and try again.", null);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleDecideWithdraw(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const wd = await db.prepare("SELECT * FROM withdrawals WHERE id = ?").bind(body.id).first();
  if (!wd || wd.status !== "pending") return json(request, { error: "Withdrawal not pending." }, 400);
  const ok = !!body.ok;
  const wallet = await getWallet(db, wd.user_id);
  const stmts = [
    adjStmt(db, wallet.id, "BDT", ok ? 0 : Number(wd.amount), -Number(wd.amount)),
    db.prepare("UPDATE withdrawals SET status = ?, reviewed_by = ? WHERE id = ?").bind(ok ? "completed" : "rejected", auth.uid, wd.id),
    db.prepare("UPDATE transactions SET status = ? WHERE user_id = ? AND category = 'cash_out' AND status = 'pending' AND amount = ?").bind(ok ? "completed" : "rejected", wd.user_id, wd.amount),
  ];
  try { await db.batch(stmts); } catch (e) { return json(request, { error: "Decision failed: " + String(e?.message || e) }, 500); }
  await notifyServer(db, wd.user_id, "withdraw", ok ? "Cash out completed" : "Cash out rejected", ok ? "Your cash out of " + wd.amount + " has been sent." : "Your cash out of " + wd.amount + " was rejected and the amount returned to your balance.", null);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleDecideLoan(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const loan = await db.prepare("SELECT * FROM loans WHERE id = ?").bind(body.id).first();
  if (!loan || loan.status !== "pending") return json(request, { error: "Loan not pending." }, 400);
  const ok = !!body.ok;
  const stmts = [db.prepare("UPDATE loans SET status = ? WHERE id = ?").bind(ok ? "active" : "rejected", loan.id)];
  if (ok) {
    const wallet = await getWallet(db, loan.user_id);
    const t = txStmt(db, { userId: loan.user_id, category: "loan_disbursement", title: "Loan disbursed", amount: Number(loan.principal) });
    stmts.push(adjStmt(db, wallet.id, "BDT", Number(loan.principal)));
    stmts.push(t.stmt);
  }
  try { await db.batch(stmts); } catch (e) { return json(request, { error: "Decision failed: " + String(e?.message || e) }, 500); }
  await notifyServer(db, loan.user_id, "loan", ok ? "Loan approved" : "Loan rejected", ok ? "Your loan of " + loan.principal + " was approved and credited to your wallet." : "Your loan application of " + loan.principal + " was not approved.", null);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminAdjust(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const { userId, amount, title, note } = body;
  if (!userId || !amount || !isFinite(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  if (!title) return json(request, { error: "A title is required." }, 400);
  const wallet = await getWallet(db, userId);
  if (!wallet) return json(request, { error: "Wallet not found." }, 404);
  const bals = await getBalances(db, wallet.id);
  if (amount < 0 && Math.abs(amount) > balOf(bals, "BDT")) return json(request, { error: "Deduction exceeds the available balance." }, 400);
  const t = txStmt(db, { userId, category: "adjustment", title: String(title).slice(0, 80), amount, note: note || undefined });
  try {
    await db.batch([adjStmt(db, wallet.id, "BDT", amount), t.stmt]);
  } catch (e) {
    return json(request, { error: "Adjustment failed: " + String(e?.message || e) }, 500);
  }
  return json(request, { ok: true, overview: await loadOverview(db) });
}

// ---- Transaction hold / unhold / cancel (admin ecosystem) -------------------
// Hold freezes the transaction amount in the owner's Locked balance (it
// shows in the wallet's Locked figure everywhere). Unhold releases it.
// Cancel reverses the transaction's balance effect entirely — for a send /
// receive pair BOTH sides are reversed and marked cancelled together.
const TX_IN_CATS = ["add_money", "receive", "referral", "loan_disbursement", "crypto_sell", "earn"];
const TX_OUT_CATS = ["cash_out", "send", "loan_repayment", "crypto_buy", "direct_withdraw", "stake"];
const TX_CANCELLABLE = ["send", "receive", "referral", "adjustment", "direct_withdraw", "earn"];
function txDirOf(tx) {
  if (tx.category === "adjustment") return Number(tx.amount) < 0 ? "out" : "in";
  if (TX_IN_CATS.includes(tx.category)) return "in";
  if (TX_OUT_CATS.includes(tx.category)) return "out";
  return "neutral";
}
async function loadTxByPublic(db, pub) {
  if (!pub) return null;
  return await db.prepare("SELECT * FROM transactions WHERE public_id = ?").bind(String(pub)).first();
}

async function handleAdminTxHold(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const tx = await loadTxByPublic(db, body.txId);
  if (!tx) return json(request, { error: "Transaction not found." }, 404);
  if (tx.status !== "completed") return json(request, { error: "Only a completed transaction can be held (this one is " + tx.status + ")." }, 400);
  const wallet = await getWallet(db, tx.user_id);
  if (!wallet) return json(request, { error: "Wallet not found." }, 404);
  const amt = Math.abs(Number(tx.amount));
  const bals = await getBalances(db, wallet.id);
  if (balOf(bals, tx.currency) < amt) return json(request, { error: "Cannot hold: the money from this transaction is no longer fully available (already spent or locked)." }, 400);
  try {
    await db.batch([
      adjStmt(db, wallet.id, tx.currency, -amt, amt),
      db.prepare("UPDATE transactions SET status = 'held' WHERE id = ?").bind(tx.id),
    ]);
  } catch (e) { return json(request, { error: "Hold failed: " + String(e?.message || e) }, 500); }
  await auditLog(db, auth, "tx.hold", tx.public_id + " · " + tx.title + " · " + amt + " " + tx.currency);
  await notifyServer(db, tx.user_id, "tx", "\u{1F512} Transaction held", "Your transaction \"" + tx.title + "\" (" + tx.public_id + ") has been placed on hold. The amount is locked and cannot be spent until it is released.", "/transactions?tx=" + tx.public_id);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminTxUnhold(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const tx = await loadTxByPublic(db, body.txId);
  if (!tx) return json(request, { error: "Transaction not found." }, 404);
  if (tx.status !== "held") return json(request, { error: "This transaction is not on hold." }, 400);
  const wallet = await getWallet(db, tx.user_id);
  if (!wallet) return json(request, { error: "Wallet not found." }, 404);
  const amt = Math.abs(Number(tx.amount));
  const bals = await getBalances(db, wallet.id);
  if (lockedOf(bals, tx.currency) < amt) return json(request, { error: "This hold was already released (for example via Clear all locked)." }, 400);
  try {
    await db.batch([
      adjStmt(db, wallet.id, tx.currency, amt, -amt),
      db.prepare("UPDATE transactions SET status = 'completed' WHERE id = ?").bind(tx.id),
    ]);
  } catch (e) { return json(request, { error: "Unhold failed: " + String(e?.message || e) }, 500); }
  await auditLog(db, auth, "tx.unhold", tx.public_id + " · " + tx.title + " · " + amt + " " + tx.currency);
  await notifyServer(db, tx.user_id, "tx", "\u{1F513} Hold released", "The hold on your transaction \"" + tx.title + "\" (" + tx.public_id + ") has been released. The amount is available again.", "/transactions?tx=" + tx.public_id);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminTxCancel(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const tx = await loadTxByPublic(db, body.txId);
  if (!tx) return json(request, { error: "Transaction not found." }, 404);
  if (tx.status === "cancelled") return json(request, { error: "This transaction was already cancelled." }, 400);
  if (tx.status !== "completed" && tx.status !== "held") return json(request, { error: "Only a completed or held transaction can be cancelled (this one is " + tx.status + ")." }, 400);
  if (!TX_CANCELLABLE.includes(tx.category)) return json(request, { error: "A " + tx.category + " transaction cannot be cancelled here — it is tied to its own record (deposit / withdrawal / loan / stake / trade). You can still place it on Hold." }, 400);
  const amt = Math.abs(Number(tx.amount));
  const fee = Number(tx.fee) || 0;
  const dir = txDirOf(tx);
  if (dir === "neutral") return json(request, { error: "This transaction has no reversible balance effect." }, 400);
  const wallet = await getWallet(db, tx.user_id);
  if (!wallet) return json(request, { error: "Wallet not found." }, 404);
  const bals = await getBalances(db, wallet.id);
  let avail = balOf(bals, tx.currency);
  const stmts = [];
  if (tx.status === "held") { stmts.push(adjStmt(db, wallet.id, tx.currency, amt, -amt)); avail += amt; }
  if (dir === "in") {
    if (avail < amt) return json(request, { error: "Cannot cancel: the money from this transaction has already been spent." }, 400);
    stmts.push(adjStmt(db, wallet.id, tx.currency, -amt));
  } else {
    stmts.push(adjStmt(db, wallet.id, tx.currency, amt + fee));
  }
  // A send / receive pair reverses together.
  let pair = null;
  if (tx.category === "send") {
    const tr = await db.prepare("SELECT * FROM transfers WHERE transaction_id = ?").bind(tx.id).first();
    if (tr) pair = await db.prepare("SELECT * FROM transactions WHERE user_id = ? AND counterparty = ? AND category = 'receive' AND amount = ? AND status IN ('completed','held') ORDER BY created_at ASC LIMIT 1").bind(tr.to_user, tr.from_user, Number(tx.amount)).first();
  } else if (tx.category === "receive" && tx.counterparty) {
    pair = await db.prepare("SELECT * FROM transactions WHERE user_id = ? AND counterparty = ? AND category = 'send' AND amount = ? AND status IN ('completed','held') ORDER BY created_at ASC LIMIT 1").bind(tx.counterparty, tx.user_id, Number(tx.amount)).first();
  }
  if (pair) {
    const pWallet = await getWallet(db, pair.user_id);
    if (!pWallet) return json(request, { error: "Counterparty wallet not found." }, 404);
    const pBals = await getBalances(db, pWallet.id);
    let pAvail = balOf(pBals, pair.currency);
    if (pair.status === "held") { stmts.push(adjStmt(db, pWallet.id, pair.currency, amt, -amt)); pAvail += amt; }
    const pDir = txDirOf(pair);
    if (pDir === "in") {
      if (pAvail < amt) return json(request, { error: "Cannot cancel: the recipient has already spent this money." }, 400);
      stmts.push(adjStmt(db, pWallet.id, pair.currency, -amt));
    } else if (pDir === "out") {
      stmts.push(adjStmt(db, pWallet.id, pair.currency, amt + (Number(pair.fee) || 0)));
    }
    stmts.push(db.prepare("UPDATE transactions SET status = 'cancelled', note = ? WHERE id = ?").bind(((pair.note ? pair.note + " · " : "") + "Cancelled by admin — reversed").slice(0, 300), pair.id));
  }
  stmts.push(db.prepare("UPDATE transactions SET status = 'cancelled', note = ? WHERE id = ?").bind(((tx.note ? tx.note + " · " : "") + "Cancelled by admin — reversed").slice(0, 300), tx.id));
  try { await db.batch(stmts); } catch (e) { return json(request, { error: "Cancel failed: " + String(e?.message || e) }, 500); }
  await auditLog(db, auth, "tx.cancel", tx.public_id + " · " + tx.title + " · " + amt + " " + tx.currency + (pair ? " · pair " + pair.public_id : ""));
  await notifyServer(db, tx.user_id, "tx", "\u21A9\uFE0F Transaction cancelled", "Your transaction \"" + tx.title + "\" (" + tx.public_id + ") was cancelled by the NovaWallet team and its amount has been reversed.", "/transactions?tx=" + tx.public_id);
  if (pair) await notifyServer(db, pair.user_id, "tx", "\u21A9\uFE0F Transaction cancelled", "A transaction involving you (" + pair.public_id + ") was cancelled by the NovaWallet team and its amount has been reversed.", "/transactions?tx=" + pair.public_id);
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminReleaseStake(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const r = await unstakeCore(db, body.userId, body.stakeId, true);
  if (r.error) return json(request, { error: r.error }, 400);
  try { await db.batch(r.stmts); } catch (e) { return json(request, { error: "Release failed: " + String(e?.message || e) }, 500); }
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminClearLocked(request, env, auth, body) {
  const db = env.DB;
  if (!scopeAllowed(auth, ["finance"])) return json(request, { error: "scope_denied" }, 403);
  const uid = body.userId;
  const wallet = await getWallet(db, uid);
  if (!wallet) return json(request, { error: "Wallet not found." }, 404);
  const bals = await getBalances(db, wallet.id);
  const locked = lockedOf(bals, "BDT");
  const stmts = [];
  // Close active stakes with accrued interest.
  const stk = await db.prepare("SELECT * FROM stakes WHERE user_id = ? AND status = 'active'").bind(uid).all();
  let interestTotal = 0, principalTotal = 0;
  for (const s of stk.results) {
    const days = Math.max(0, (Date.now() - new Date(s.start_at).getTime()) / 86_400_000);
    interestTotal += Math.round(Number(s.amount) * Number(s.apy) / 100 * days / 365);
    principalTotal += Number(s.amount);
    stmts.push(db.prepare("UPDATE stakes SET status = 'closed' WHERE id = ?").bind(s.id));
  }
  if (principalTotal > 0) {
    const t = txStmt(db, { userId: uid, category: "earn", title: "Stakes released by support", amount: principalTotal + interestTotal, note: "Principal + accrued interest released early by support." });
    stmts.push(t.stmt);
  }
  // Cancel pending cash outs (their locked amounts return via the release below).
  const wds = await db.prepare("SELECT * FROM withdrawals WHERE user_id = ? AND status = 'pending'").bind(uid).all();
  for (const w of wds.results) {
    stmts.push(db.prepare("UPDATE withdrawals SET status = 'rejected' WHERE id = ?").bind(w.id));
    stmts.push(db.prepare("UPDATE transactions SET status = 'rejected' WHERE user_id = ? AND category = 'cash_out' AND status = 'pending' AND amount = ?").bind(uid, w.amount));
  }
  // Held transactions in BDT release with the rest of the locked balance.
  stmts.push(db.prepare("UPDATE transactions SET status = 'completed' WHERE user_id = ? AND status = 'held' AND currency = 'BDT'").bind(uid));
  if (locked > 0 || interestTotal > 0) {
    stmts.push(adjStmt(db, wallet.id, "BDT", locked + interestTotal, -locked));
  }
  try { await db.batch(stmts); } catch (e) { return json(request, { error: "Clear locked failed: " + String(e?.message || e) }, 500); }
  return json(request, { ok: true, overview: await loadOverview(db) });
}

// ---- Router -------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (path === "/health") return json(request, { ok: true, service: "novawallet-api", version: 2 });

    // Crash reports from the app's error boundary (auth optional — a crash
    // can happen before sign-in). Stored so the exact error can be read
    // back and fixed instead of guessed from a screenshot.
    if (path === "/v1/client-error" && request.method === "POST") {
      let b = {};
      try { b = await request.json(); } catch { /* ignore */ }
      const a = await requireAuth(request).catch(() => null);
      try {
        await env.DB.prepare("INSERT INTO client_errors (user_id, message, stack, url) VALUES (?, ?, ?, ?)")
          .bind(a?.uid ?? null, String(b.message || "").slice(0, 500), String(b.stack || "").slice(0, 2000), String(b.url || "").slice(0, 300)).run();
      } catch { /* ignore */ }
      return json(request, { ok: true });
    }

    if (!path.startsWith("/v1/")) return json(request, { error: "not_found" }, 404);

    const auth = await requireAuth(request);
    if (!auth) return json(request, { error: "unauthorized" }, 401);
    // The D1 row is the source of truth for role/status (Firebase tokens
    // carry neither), so admin checks read it fresh per request.
    const meRow = await getUserRow(env.DB, auth.uid);
    if (meRow) { auth.role = meRow.role; auth.status = meRow.status; auth.scope = meRow.admin_scope || (meRow.role === "admin" ? "full" : null); }

    const bodyOf = async () => { try { return await request.json(); } catch { return {}; } };

    try {
      if (path === "/v1/bootstrap" && request.method === "POST") return await handleBootstrap(request, env, auth);
      if (path === "/v1/me" && request.method === "GET") return await handleMe(request, env, auth);
      if (path === "/v1/state" && request.method === "GET") {
        const state = await loadState(env.DB, auth.uid);
        if (!state) return json(request, { error: "profile_not_bootstrapped" }, 404);
        return json(request, { ok: true, state });
      }
      if (path === "/v1/directory" && request.method === "GET") {
        return json(request, { ok: true, users: await loadDirectory(env.DB) });
      }
      if (path === "/v1/admin/overview" && request.method === "GET") {
        if (auth.role !== "admin") return json(request, { error: "admin_only" }, 403);
        return json(request, { ok: true, overview: await loadOverview(env.DB) });
      }
      if (path.startsWith("/v1/admin/kyc/") && request.method === "GET") {
        if (auth.role !== "admin") return json(request, { error: "admin_only" }, 403);
        return await handleAdminKycGet(request, env, auth, decodeURIComponent(path.slice("/v1/admin/kyc/".length)));
      }
      if (path === "/v1/admin/backup" && request.method === "GET") {
        if (auth.role !== "admin") return json(request, { error: "admin_only" }, 403);
        return await handleAdminBackup(request, env, auth);
      }
      if (request.method === "POST") {
        const body = await bodyOf();
        switch (path) {
          case "/v1/send": return await handleSend(request, env, auth, body);
          case "/v1/deposit": return await handleDeposit(request, env, auth, body);
          case "/v1/withdraw": return await handleWithdraw(request, env, auth, body);
          case "/v1/direct-withdraw": return await handleDirectWithdraw(request, env, auth, body);
          case "/v1/trade/buy": return await handleTrade(request, env, auth, body, "buy");
          case "/v1/trade/sell": return await handleTrade(request, env, auth, body, "sell");
          case "/v1/swap": return await handleSwap(request, env, auth, body);
          case "/v1/stake": return await handleStake(request, env, auth, body);
          case "/v1/unstake": return await handleUnstake(request, env, auth, body);
          case "/v1/loan/apply": return await handleLoanApply(request, env, auth, body);
          case "/v1/loan/repay": return await handleLoanRepay(request, env, auth, body);
          case "/v1/loan/fee": return await handleLoanFee(request, env, auth, body);
          case "/v1/earn/claim": return await handleEarnClaim(request, env, auth, body);
          case "/v1/kyc/submit": return await handleKycSubmit(request, env, auth, body);
          case "/v1/paymethods/save": return await handlePayMethodSave(request, env, auth, body);
          case "/v1/paymethods/delete": return await handlePayMethodDelete(request, env, auth, body);
          case "/v1/tickets": return await handleTicketCreate(request, env, auth, body);
          case "/v1/tickets/reply": return await handleTicketReply(request, env, auth, body);
          case "/v1/tickets/resolve": return await handleTicketResolve(request, env, auth, body);
          case "/v1/levels/request": return await handleLevelRequest(request, env, auth, body);
        }
        if (path.startsWith("/v1/admin/")) {
          if (auth.role !== "admin") return json(request, { error: "admin_only" }, 403);
          switch (path) {
            case "/v1/admin/decide-deposit": return await handleDecideDeposit(request, env, auth, body);
            case "/v1/admin/decide-withdraw": return await handleDecideWithdraw(request, env, auth, body);
            case "/v1/admin/decide-loan": return await handleDecideLoan(request, env, auth, body);
            case "/v1/admin/adjust": return await handleAdminAdjust(request, env, auth, body);
            case "/v1/admin/tx/hold": return await handleAdminTxHold(request, env, auth, body);
            case "/v1/admin/tx/unhold": return await handleAdminTxUnhold(request, env, auth, body);
            case "/v1/admin/tx/cancel": return await handleAdminTxCancel(request, env, auth, body);
            case "/v1/admin/trade": return await handleTrade(request, env, auth, body, body.side === "sell" ? "sell" : "buy");
            case "/v1/admin/release-stake": return await handleAdminReleaseStake(request, env, auth, body);
            case "/v1/admin/clear-locked": return await handleAdminClearLocked(request, env, auth, body);
            case "/v1/admin/kyc/decide": return await handleAdminKycDecide(request, env, auth, body);
            case "/v1/admin/levels/decide": return await handleAdminLevelDecide(request, env, auth, body);
            case "/v1/admin/set-level": return await handleAdminSetLevel(request, env, auth, body);
            case "/v1/admin/set-status": return await handleAdminSetStatus(request, env, auth, body);
            case "/v1/admin/levels/def": return await handleAdminLevelDef(request, env, auth, body);
            case "/v1/admin/news": return await handleAdminNewsSave(request, env, auth, body);
            case "/v1/admin/news/delete": return await handleAdminNewsDelete(request, env, auth, body);
            case "/v1/admin/banners/toggle": return await handleAdminBannerToggle(request, env, auth, body);
            case "/v1/admin/settings": return await handleAdminSettings(request, env, auth, body);
            case "/v1/admin/broadcast": return await handleAdminBroadcast(request, env, auth, body);
            case "/v1/admin/set-scope": return await handleAdminSetScope(request, env, auth, body);
            case "/v1/admin/set-role": return await handleAdminSetRole(request, env, auth, body);
          }
        }
      }
      return json(request, { error: "not_found" }, 404);
    } catch (e) {
      return json(request, { error: "server_error", detail: String(e?.message || e) }, 500);
    }
  },
};
