import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminEmails = new Set((Deno.env.get("ADMIN_EMAILS") ?? "")
  .split(/[,\s;]+/)
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean));
const allowedOrigin = (Deno.env.get("ALLOWED_ORIGIN") ?? "").trim();
const bucketName = "catalog-images";
const MAX_CUSTOMER_SESSIONS = 3;
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function response(body: unknown, status: number, origin = ""): Response {
  const headers = new Headers(jsonHeaders);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  headers.set("Vary", "Origin");
  return new Response(JSON.stringify(body), { status, headers });
}

function getClientIp(request: Request): string {
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp) return cloudflareIp.trim().slice(0, 64);
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim().slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",").at(-1)?.trim().slice(0, 64) ?? "" : "";
}

function codeHash(code: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))
    .then((digest) => Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
}

function newAccessCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `DT-${random.slice(0, 8)}-${random.slice(8)}`;
}

function customerName(user: User): string {
  const metadata = user.user_metadata ?? {};
  const name = metadata.full_name ?? metadata.name ?? "";
  return typeof name === "string" ? name.trim().slice(0, 200) : "";
}

function storageName(value: unknown): string {
  if (typeof value !== "string" || value.startsWith("http:") || value.startsWith("https:")) return "";
  const name = value.split(/[\\/]/).at(-1) ?? "";
  return name !== "." && name !== ".." && /^[A-Za-z0-9_.-]{1,160}$/.test(name) ? name : "";
}

async function signedProduct(product: Record<string, unknown>, storage: SupabaseClient["storage"]) {
  const copy = { ...product };
  const paths = [
    storageName(copy.imagePath),
    ...(Array.isArray(copy.additionalImagePaths) ? copy.additionalImagePaths.map(storageName) : [])
  ].filter(Boolean);
  const uniquePaths = Array.from(new Set(paths));
  const { data: signed, error } = uniquePaths.length
    ? await storage.from(bucketName).createSignedUrls(uniquePaths, 300)
    : { data: [], error: null };
  if (error) throw new Error("Could not prepare a private product image.");
  const urls = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
  const mainPath = storageName(copy.imagePath);
  copy.imageUrl = mainPath ? urls.get(mainPath) ?? "" : "";
  copy.imagePath = "";
  copy.additionalImagePaths = Array.isArray(product.additionalImagePaths)
    ? product.additionalImagePaths.map(storageName).filter(Boolean).map((path) => urls.get(path) ?? "").filter(Boolean)
    : [];
  return copy;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return response({}, 200, allowedOrigin);
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405, allowedOrigin);
  if (!allowedOrigin || origin !== allowedOrigin) return response({ error: "This site is not authorized." }, 403, allowedOrigin || origin);
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !adminEmails.size) {
    return response({ error: "The private catalogue backend is not fully configured." }, 503, allowedOrigin);
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return response({ error: "Sign in to continue." }, 401, allowedOrigin);
    }

    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } }
    });
    const { data: authData, error: authError } = await publicClient.auth.getUser();
    const user = authData.user;
    if (authError || !user || !user.email) return response({ error: "Sign in with your account to continue." }, 401, allowedOrigin);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const isAdmin = adminEmails.has((user.email ?? "").trim().toLowerCase());
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      body = await request.json();
    }
    const action = body.action;

    if (action === "catalog" || action === "session-heartbeat") {
      const { data: grant, error: grantError } = await admin
        .from("private_catalog_customer_access")
        .select("expires_at, blocked_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (grantError) throw new Error("Could not verify catalogue access.");
      if (!grant || grant.blocked_at || new Date(grant.expires_at).getTime() <= Date.now()) {
        return response({ error: "Catalogue access is not active. Enter your code or contact the shop." }, 403, allowedOrigin);
      }

      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
        return response({ error: "Could not verify this browser session. Sign in again." }, 400, allowedOrigin);
      }
      const { data: reservation, error: reservationError } = await admin.rpc("private_catalog_reserve_session", {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_max_sessions: MAX_CUSTOMER_SESSIONS
      });
      if (reservationError) throw new Error("Could not reserve a catalogue session.");
      if (!reservation?.ok) {
        const message = reservation?.error === "session_limit"
          ? `The shop allows up to ${MAX_CUSTOMER_SESSIONS} customer sessions at once. Sign out on another device and wait up to 90 seconds, then try again.`
          : "Catalogue access is not active. Contact the shop.";
        return response({ error: message }, 403, allowedOrigin);
      }

      if (action === "session-heartbeat") {
        return response({ ok: true, activeSessions: reservation.active_sessions, expiresAt: reservation.expires_at }, 200, allowedOrigin);
      }

      const { error: logError } = await admin.from("private_catalog_access_logs").insert({
        user_id: user.id,
        email: user.email,
        full_name: customerName(user),
        ip_address: getClientIp(request)
      });
      if (logError) throw new Error("Could not record catalogue access.");

      const { data: rows, error: productsError } = await admin
        .from("private_catalog_products")
        .select("product")
        .order("sku");
      if (productsError) throw new Error("Could not load the private catalogue.");
      const products = await Promise.all((rows ?? []).map((row) => signedProduct(row.product, admin.storage)));
      return response({
        products,
        expiresAt: grant.expires_at,
        activeSessions: reservation.active_sessions,
        maxSessions: MAX_CUSTOMER_SESSIONS
      }, 200, allowedOrigin);
    }

    if (!isAdmin) return response({ error: "Shop-owner permission is required." }, 403, allowedOrigin);

    if (action === "owner-list") {
      const [{ data: codes, error: codesError }, { data: customers, error: customersError }, { data: logs, error: logsError }] = await Promise.all([
        admin.from("private_catalog_access_codes")
          .select("id, email, duration_seconds, created_at, redeemed_by, redeemed_at, revoked_at")
          .order("created_at", { ascending: false }).limit(500),
        admin.from("private_catalog_customer_access")
          .select("user_id, email, full_name, expires_at, blocked_at, updated_at")
          .order("updated_at", { ascending: false }).limit(500),
        admin.from("private_catalog_access_logs")
          .select("id, user_id, email, full_name, ip_address, accessed_at")
          .order("accessed_at", { ascending: false }).limit(1000)
      ]);
      if (codesError || customersError || logsError) throw new Error("Could not load owner records.");
      return response({ codes, customers, logs }, 200, allowedOrigin);
    }

    if (action === "issue-code") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const amount = Number(body.duration);
      const unit = body.unit;
      const multiplier = unit === "hours" ? 3600 : unit === "days" ? 86400 : 0;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Number.isInteger(amount) || amount < 1 || amount * multiplier > 31536000) {
        return response({ error: "Enter a valid customer email and a duration from 1 hour to 365 days." }, 400, allowedOrigin);
      }
      if (adminEmails.has(email)) {
        return response({ error: "Owner accounts already have owner access and cannot be issued customer codes." }, 400, allowedOrigin);
      }
      const code = newAccessCode();
      const { error } = await admin.from("private_catalog_access_codes").insert({
        email,
        code_hash: await codeHash(code),
        duration_seconds: amount * multiplier
      });
      if (error) throw new Error("Could not issue the customer code.");
      return response({ code, email, duration: amount, unit }, 200, allowedOrigin);
    }

    if (action === "disable-code") {
      const codeId = typeof body.codeId === "string" ? body.codeId : "";
      const { data: code, error: findError } = await admin
        .from("private_catalog_access_codes").select("id, email, redeemed_by").eq("id", codeId).maybeSingle();
      if (findError || !code) return response({ error: "Code not found." }, 404, allowedOrigin);
      if (adminEmails.has(code.email.trim().toLowerCase())) {
        return response({ error: "Owner accounts cannot be blocked or have their access disabled by another owner." }, 403, allowedOrigin);
      }
      if (code.redeemed_by) {
        const { data: account, error: accountError } = await admin
          .from("private_catalog_customer_access").select("email").eq("user_id", code.redeemed_by).maybeSingle();
        if (accountError) throw new Error("Could not verify the code owner.");
        if (account && adminEmails.has(account.email.trim().toLowerCase())) {
          return response({ error: "Owner accounts cannot be blocked or have their access disabled by another owner." }, 403, allowedOrigin);
        }
      }
      const { error: revokeError } = await admin
        .from("private_catalog_access_codes").update({ revoked_at: new Date().toISOString() }).eq("id", code.id);
      if (revokeError) throw new Error("Could not disable the code.");
      if (code.redeemed_by) {
        const { error: blockError } = await admin
          .from("private_catalog_customer_access").update({ blocked_at: new Date().toISOString() }).eq("user_id", code.redeemed_by);
        if (blockError) throw new Error("The code was disabled, but the customer account could not be blocked.");
      }
      return response({ ok: true }, 200, allowedOrigin);
    }

    if (action === "set-blocked") {
      const userId = typeof body.userId === "string" ? body.userId : "";
      const blocked = body.blocked === true;
      const { data: customer, error: customerError } = await admin
        .from("private_catalog_customer_access").select("email").eq("user_id", userId).maybeSingle();
      if (customerError) throw new Error("Could not verify the customer account.");
      if (!customer) return response({ error: "Customer account not found." }, 404, allowedOrigin);
      if (adminEmails.has(customer.email.trim().toLowerCase())) {
        return response({ error: "Owner accounts cannot be blocked by another owner." }, 403, allowedOrigin);
      }
      const { error } = await admin.from("private_catalog_customer_access")
        .update({ blocked_at: blocked ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw new Error("Could not update customer access.");
      return response({ ok: true }, 200, allowedOrigin);
    }

    if (action === "replace-catalog") {
      const products = body.products;
      if (!Array.isArray(products) || products.length > 10000) {
        return response({ error: "Choose a valid catalogue containing no more than 10,000 products." }, 400, allowedOrigin);
      }
      const seen = new Set<string>();
      for (const product of products) {
        if (!product || typeof product !== "object" || Array.isArray(product)
            || typeof product.sku !== "string" || !product.sku.trim() || product.sku.length > 128) {
          return response({ error: "Every product must have a valid item code." }, 400, allowedOrigin);
        }
        const sku = product.sku.trim();
        if (seen.has(sku)) return response({ error: `Duplicate item code: ${sku}` }, 400, allowedOrigin);
        seen.add(sku);
      }
      const { data: count, error } = await admin.rpc("private_catalog_replace_products", { p_products: products });
      if (error) throw new Error("Could not safely replace the private catalogue.");
      return response({ ok: true, count }, 200, allowedOrigin);
    }

    if (action === "upload-image") {
      const file = body.file;
      if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024
          || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
        return response({ error: "Choose a JPG, PNG, WebP, or GIF image up to 8 MB." }, 400, allowedOrigin);
      }
      const path = storageName(file.name);
      if (!path) return response({ error: "The image filename contains unsupported characters." }, 400, allowedOrigin);
      const { error } = await admin.storage.from(bucketName).upload(path, file, {
        contentType: file.type,
        upsert: true,
        cacheControl: "0"
      });
      if (error) throw new Error("Could not upload the private product image.");
      return response({ ok: true, path }, 200, allowedOrigin);
    }

    return response({ error: "Unknown action." }, 400, allowedOrigin);
  } catch (error) {
    console.error("Private catalogue request failed:", error);
    return response({ error: error instanceof Error ? error.message : "The request failed." }, 500, allowedOrigin);
  }
});
