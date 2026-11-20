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

// Balance delta statement (upsert). Negative results are rejected by the
// table's CHECK constraints, which aborts the whole batch.
function adjStmt(db, walletId, currency, dAvail, dLocked = 0) {
  return db.prepare(
    `INSERT INTO wallet_balances (wallet_id, currency, available, locked) VALUES (?, ?, ?, ?)
     ON CONFLICT(wallet_id, currency) DO UPDATE SET available = available + excluded.available, locked = locked + excluded.locked`
  ).bind(walletId, currency, dAvail, dLocked);
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
async function loadState(db, uid) {
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
  return {
    profile: {
      id: me.id, email: me.email, username: me.username, name: me.full_name || "",
      role: me.role, status: me.status, level: Number(me.level), referralCode: me.referral_code,
    },
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
}

async function loadDirectory(db) {
  const rows = await db.prepare(
    `SELECT u.id, u.email, u.username, u.role, u.status, u.level, u.referral_code, u.created_at, p.full_name
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id ORDER BY u.created_at ASC`
  ).all();
  return rows.results.map((u) => ({
    id: u.id, email: u.email, username: u.username, name: u.full_name || "",
    role: u.role, status: u.status, level: Number(u.level), referralCode: u.referral_code,
    createdAt: isoOf(u.created_at),
  }));
}

async function loadOverview(db) {
  const users = await loadDirectory(db);
  const wallets = {}, transactions = [], deposits = [], withdrawals = [], loans = [], stakes = [];
  for (const u of users) {
    const st = await loadState(db, u.id);
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
  return { users, wallets, transactions, deposits, withdrawals, loans, stakes };
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
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleWithdraw(request, env, auth, body) {
  const db = env.DB;
  const { method, amount, destination, pin } = body;
  if (badAmount(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  const pinErr = await checkPin(db, auth.uid, pin);
  if (pinErr) return json(request, { error: pinErr }, 400);
  const me = await getUserRow(db, auth.uid);
  if (!me) return json(request, { error: "Account not found." }, 404);
  if (me.status === "frozen") return json(request, { error: "Your wallet is frozen. Contact support." }, 400);
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
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleDirectWithdraw(request, env, auth, body) {
  const db = env.DB;
  const { method, amount, destination } = body;
  if (badAmount(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  const me = await getUserRow(db, auth.uid);
  if (!me) return json(request, { error: "Account not found." }, 404);
  if (Number(me.level) < 2) return json(request, { error: "Direct Withdraw needs a Level 2 account. Please upgrade first." }, 400);
  if (me.status === "frozen") return json(request, { error: "Your wallet is frozen. Contact support." }, 400);
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
  const { symbol, priceUsd } = body;
  if (!symbol || !(priceUsd > 0)) return json(request, { error: "Enter a valid amount." }, 400);
  const target = body.forUserId && auth.role === "admin" ? body.forUserId : auth.uid;
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
  const t = txStmt(db, { userId: auth.uid, category: "earn", title: "Staked in Earn (" + apy + "% APY)", amount });
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
  const r = await unstakeCore(db, auth.uid, body.stakeId, false);
  if (r.error) return json(request, { error: r.error }, 400);
  try { await db.batch(r.stmts); } catch (e) { return json(request, { error: "Unstake failed: " + String(e?.message || e) }, 500); }
  return json(request, { ok: true, state: await loadState(db, auth.uid) });
}

async function handleLoanApply(request, env, auth, body) {
  const db = env.DB;
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

// ---- Admin endpoints ----------------------------------------------------------

async function handleDecideDeposit(request, env, auth, body) {
  const db = env.DB;
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
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleDecideWithdraw(request, env, auth, body) {
  const db = env.DB;
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
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleDecideLoan(request, env, auth, body) {
  const db = env.DB;
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
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminAdjust(request, env, auth, body) {
  const db = env.DB;
  const { userId, amount, title, note } = body;
  if (!userId || !amount || !isFinite(amount)) return json(request, { error: "Enter a valid amount." }, 400);
  if (!title) return json(request, { error: "A title is required." }, 400);
  const wallet = await getWallet(db, userId);
  if (!wallet) return json(request, { error: "Wallet not found." }, 404);
  const bals = await getBalances(db, wallet.id);
  if (amount < 0 && Math.abs(amount) > balOf(bals, "BDT")) return json(request, { error: "Deduction exceeds the available balance." }, 400);
  const t = txStmt(db, { userId, category: "adjustment", title: String(title).slice(0, 80), amount: Math.abs(amount), note: note || undefined });
  try {
    await db.batch([adjStmt(db, wallet.id, "BDT", amount), t.stmt]);
  } catch (e) {
    return json(request, { error: "Adjustment failed: " + String(e?.message || e) }, 500);
  }
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminReleaseStake(request, env, auth, body) {
  const db = env.DB;
  const r = await unstakeCore(db, body.userId, body.stakeId, true);
  if (r.error) return json(request, { error: r.error }, 400);
  try { await db.batch(r.stmts); } catch (e) { return json(request, { error: "Release failed: " + String(e?.message || e) }, 500); }
  return json(request, { ok: true, overview: await loadOverview(db) });
}

async function handleAdminClearLocked(request, env, auth, body) {
  const db = env.DB;
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

    if (!path.startsWith("/v1/")) return json(request, { error: "not_found" }, 404);

    const auth = await requireAuth(request);
    if (!auth) return json(request, { error: "unauthorized" }, 401);
    // The D1 row is the source of truth for role/status (Firebase tokens
    // carry neither), so admin checks read it fresh per request.
    const meRow = await getUserRow(env.DB, auth.uid);
    if (meRow) { auth.role = meRow.role; auth.status = meRow.status; }

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
        }
        if (path.startsWith("/v1/admin/")) {
          if (auth.role !== "admin") return json(request, { error: "admin_only" }, 403);
          switch (path) {
            case "/v1/admin/decide-deposit": return await handleDecideDeposit(request, env, auth, body);
            case "/v1/admin/decide-withdraw": return await handleDecideWithdraw(request, env, auth, body);
            case "/v1/admin/decide-loan": return await handleDecideLoan(request, env, auth, body);
            case "/v1/admin/adjust": return await handleAdminAdjust(request, env, auth, body);
            case "/v1/admin/trade": return await handleTrade(request, env, auth, body, body.side === "sell" ? "sell" : "buy");
            case "/v1/admin/release-stake": return await handleAdminReleaseStake(request, env, auth, body);
            case "/v1/admin/clear-locked": return await handleAdminClearLocked(request, env, auth, body);
          }
        }
      }
      return json(request, { error: "not_found" }, 404);
    } catch (e) {
      return json(request, { error: "server_error", detail: String(e?.message || e) }, 500);
    }
  },
};
