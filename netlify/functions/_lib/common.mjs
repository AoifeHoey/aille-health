// Shared helpers for the Netlify functions.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getStore } from "@netlify/blobs";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "aille-health-clinic";
const JWKS = createRemoteJWKSet(new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "info@aillehealth.ie")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
export const fail = (error, status = 400) => json({ error }, status);

/** Verifies the Firebase ID token sent by the browser. Returns the user or null. */
export async function getUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") || "");
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    if (!payload.sub) return null;
    return {
      uid: payload.sub,
      email: String(payload.email || "").toLowerCase(),
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return null;
  }
}

export const isAdmin = (user) => !!user && user.emailVerified && ADMIN_EMAILS.includes(user.email);

export const practitioners = () => getStore({ name: "practitioners", consistency: "strong" });
export const certificates = () => getStore({ name: "certificates", consistency: "strong" });

export async function getProfile(uid) {
  return (await practitioners().get(uid, { type: "json" })) || null;
}
