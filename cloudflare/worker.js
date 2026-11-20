// NovaWallet API — Cloudflare Worker (draft foundation, 2026-11-20)
//
// Architecture: Firebase Auth owns identity; this Worker is the only door
// to the D1 database. Every /v1/* request must carry a Firebase ID token
// (Authorization: Bearer <token>); the Worker verifies it against Google's
// securetoken JWKS and uses the token's uid as the D1 users.id.
//
// Implemented in this draft: CORS, token verification, GET /health,
// POST /v1/bootstrap (first-login user + wallet creation), GET /v1/me.
// Money endpoints (send/deposit/withdraw/loans/…) return 501 until the
// money phase; transaction PIN hashing gets a dedicated server-side
// treatment there (never trust a client-computed hash as the final design).

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname === "/health") {
      return json(request, { ok: true, service: "novawallet-api" });
    }

    if (!url.pathname.startsWith("/v1/")) {
      return json(request, { error: "not_found" }, 404);
    }

    const user = await requireAuth(request);
    if (!user) return json(request, { error: "unauthorized" }, 401);

    // First login after Firebase registration: create the D1 rows once.
    if (url.pathname === "/v1/bootstrap" && request.method === "POST") {
      const existing = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
        .bind(user.uid)
        .first();
      if (existing) return json(request, { ok: true, created: false });
      const body = await request.json().catch(() => ({}));
      const username = String(body.username || "").trim();
      const fullName = String(body.fullName || "").trim();
      const pinHash = String(body.pinHash || "");
      if (!username || !fullName || !pinHash) {
        return json(request, { error: "username, fullName and pinHash are required" }, 400);
      }
      const referralCode =
        "NW" + user.uid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
      const walletId = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO users (id, email, username, pin_hash, referral_code) VALUES (?, ?, ?, ?, ?)"
        ).bind(user.uid, user.email, username, pinHash, referralCode),
        env.DB.prepare("INSERT INTO user_profiles (user_id, full_name) VALUES (?, ?)").bind(
          user.uid,
          fullName
        ),
        env.DB.prepare("INSERT INTO wallets (id, user_id) VALUES (?, ?)").bind(walletId, user.uid),
      ]);
      return json(request, { ok: true, created: true });
    }

    if (url.pathname === "/v1/me" && request.method === "GET") {
      const profile = await env.DB.prepare(
        `SELECT u.id, u.email, u.username, u.role, u.status, u.level, u.referral_code,
                p.full_name, p.language, p.theme
           FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
          WHERE u.id = ?`
      )
        .bind(user.uid)
        .first();
      if (!profile) return json(request, { error: "not_bootstrapped" }, 404);
      const balances = await env.DB.prepare(
        `SELECT wb.currency, wb.available, wb.locked
           FROM wallet_balances wb JOIN wallets w ON w.id = wb.wallet_id
          WHERE w.user_id = ?`
      )
        .bind(user.uid)
        .all();
      return json(request, { user: profile, balances: balances.results });
    }

    return json(request, { error: "not_implemented" }, 501);
  },
};
