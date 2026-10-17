import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminEmails = new Set((Deno.env.get("ADMIN_EMAILS") ?? "")
  .split(/[,\s;]+/)
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean));
const deployedOrigin = (Deno.env.get("ALLOWED_ORIGIN") ?? "").trim();
const localImporterOrigins = new Set(["http://127.0.0.1:8765", "http://localhost:8765"]);
const bucketName = "catalog-images";
const MAX_CUSTOMER_SESSIONS = 3;
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function response(body: unknown, status: number, origin = ""): Response {
  const headers = new Headers(jsonHeaders);
  headers.set("Cache-Control", "private, no-store");
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
  const allowedOrigin = origin === deployedOrigin || localImporterOrigins.has(origin) ? origin : "";
  if (request.method === "OPTIONS") {
    if (!allowedOrigin) return response({ error: "This site is not authorized." }, 403);
    return response({}, 200, allowedOrigin);
  }
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405, allowedOrigin);
  if (!allowedOrigin) return response({ error: "This site is not authorized." }, 403);
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !adminEmails.size) {
    return response({ error: "The private catalogue backend is not fully configured." }, 503, allowedOrigin);
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return response({ error: "Sign in to continue." }, 401, allowedOrigin);
    }
    const accessToken = authorization.slice("Bearer ".length).trim();
    if (!accessToken) return response({ error: "Sign in to continue." }, 401, allowedOrigin);

    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false }
    });
    const { data: authData, error: authError } = await publicClient.auth.getUser(accessToken);
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

    if (action === "verify-owner") {
      if (!isAdmin) return response({ error: "Shop-owner permission is required." }, 403, allowedOrigin);
      return response({ ok: true }, 200, allowedOrigin);
    }

    if (action === "release-session") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
        return response({ error: "Could not verify this browser session." }, 400, allowedOrigin);
      }
      const { error } = await admin.rpc("private_catalog_release_session", {
        p_user_id: user.id,
        p_session_id: sessionId
      });
      if (error) throw new Error("Could not release this browser session.");
      return response({ ok: true }, 200, allowedOrigin);
    }

    if (action === "catalog" || action === "session-heartbeat" || action === "refresh-images") {
      const { data: grant, error: grantError } = await admin
        .from("private_catalog_customer_access")
        .select("expires_at, blocked_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (grantError) throw new Error("Could not verify catalogue access.");
      if (!grant || grant.blocked_at || new Date(grant.expires_at).getTime() <= Date.now()) {
        return response({ error: "Catalogue access is not active. Contact the shop owner." }, 403, allowedOrigin);
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

      if (action === "catalog") {
        const { error: logError } = await admin.from("private_catalog_access_logs").insert({
          user_id: user.id,
          email: user.email,
          full_name: customerName(user),
          ip_address: getClientIp(request)
        });
        if (logError) throw new Error("Could not record catalogue access.");
      }

      const { data: rows, error: productsError } = await admin
        .from("private_catalog_products")
        .select("product")
        .order("sku");
      if (productsError) throw new Error("Could not load the private catalogue.");
      const products = await Promise.all((rows ?? []).map((row) => signedProduct(row.product, admin.storage)));
      return response(action === "catalog"
        ? {
          products,
          expiresAt: grant.expires_at,
          activeSessions: reservation.active_sessions,
          maxSessions: MAX_CUSTOMER_SESSIONS
        }
        : { products }, 200, allowedOrigin);
    }

    if (!isAdmin) return response({ error: "Shop-owner permission is required." }, 403, allowedOrigin);

    if (action === "owner-list") {
      const activeSince = new Date(Date.now() - 90_000).toISOString();
      const [{ data: customers, error: customersError }, { data: logs, error: logsError }, { count: activeSessions, error: sessionsError }] = await Promise.all([
        admin.from("private_catalog_customer_access")
          .select("user_id, email, full_name, expires_at, blocked_at, updated_at")
          .order("updated_at", { ascending: false }).limit(500),
        admin.from("private_catalog_access_logs")
          .select("id, user_id, email, full_name, ip_address, accessed_at")
          .order("accessed_at", { ascending: false }).limit(1000),
        admin.from("private_catalog_active_sessions")
          .select("session_id", { count: "exact", head: true })
          .gte("last_seen_at", activeSince)
      ]);
      if (customersError || logsError || sessionsError) throw new Error("Could not load owner records.");
      const accountLogs = (logs ?? []).map((log) => ({
        ...log,
        account_type: adminEmails.has(log.email.trim().toLowerCase()) ? "Owner" : "Customer"
      }));
      return response({ customers, logs: accountLogs, activeSessions: activeSessions ?? 0, maxSessions: MAX_CUSTOMER_SESSIONS }, 200, allowedOrigin);
    }

    if (action === "owner-access") {
      const { error } = await admin.from("private_catalog_access_logs").insert({
        user_id: user.id,
        email: user.email,
        full_name: customerName(user),
        ip_address: getClientIp(request)
      });
      if (error) throw new Error("Could not record owner catalogue access.");
      return response({ ok: true }, 200, allowedOrigin);
    }

    if (action === "create-customer") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 200) : "";
      const password = typeof body.password === "string" ? body.password : "";
      const amount = Number(body.duration);
      const unit = body.unit;
      const multiplier = unit === "hours" ? 3600 : unit === "days" ? 86400 : 0;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12
          || !Number.isInteger(amount) || amount < 1 || amount * multiplier > 31536000) {
        return response({ error: "Enter a valid email, a password with at least 12 characters, and a duration from 1 hour to 365 days." }, 400, allowedOrigin);
      }
      if (adminEmails.has(email)) {
        return response({ error: "An owner email cannot be added as a customer account." }, 400, allowedOrigin);
      }
      let existingUser: User | null = null;
      for (let page = 1; page <= 1000; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error("Could not check for an existing customer account.");
        existingUser = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === email) ?? null;
        if (existingUser || data.users.length < 1000) break;
      }

      let userId: string;
      let createdUser = false;
      if (existingUser) {
        const { data, error } = await admin.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: { ...existingUser.user_metadata, full_name: fullName }
        });
        if (error || !data.user) throw new Error("Could not update this customer's password.");
        userId = data.user.id;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName }
        });
        if (error || !data.user) throw new Error(error?.message ?? "Could not create the customer account.");
        userId = data.user.id;
        createdUser = true;
      }

      const { error: grantError } = await admin.from("private_catalog_customer_access").upsert({
        user_id: userId,
        email,
        full_name: fullName,
        code_id: null,
        expires_at: new Date(Date.now() + amount * multiplier * 1000).toISOString(),
        blocked_at: null,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (grantError) {
        if (createdUser) {
          const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
          if (deleteError) throw new Error("Catalogue access could not be saved, and the new authentication account could not be removed. Contact support.");
        }
        throw new Error("The account was created but catalogue access could not be saved.");
      }
      const { error: sessionsError } = await admin.from("private_catalog_active_sessions").delete().eq("user_id", userId);
      if (sessionsError) throw new Error("Customer access was updated, but active sessions could not be cleared.");
      return response({ ok: true, email, duration: amount, unit }, 200, allowedOrigin);
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
      if (blocked) {
        const { error: sessionError } = await admin.from("private_catalog_active_sessions").delete().eq("user_id", userId);
        if (sessionError) throw new Error("The account was blocked, but its active sessions could not be cleared.");
      }
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
