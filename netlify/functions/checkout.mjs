import Stripe from "stripe";
import { getUser, getProfile, isAdmin, json, fail } from "./_lib/common.mjs";
import catalogue from "./_data/catalogue.json";
import { shippingConfig, quote } from "./_lib/shipping.mjs";

const byCode = new Map(catalogue.products.map((p) => [p.code, p]));

function shippingOptions(q, cfg) {
  const kg = (q.grams / 1000).toFixed(1);
  const opts = [{
    shipping_rate_data: {
      display_name: `Postage & packing (${kg} kg)`,
      type: "fixed_amount",
      fixed_amount: { amount: q.cents, currency: "eur" },
      delivery_estimate: { minimum: { unit: "business_day", value: 2 }, maximum: { unit: "business_day", value: 5 } },
    },
  }];
  if (cfg.collection) {
    opts.push({ shipping_rate_data: { display_name: "Collect in Wexford (we'll contact you)", type: "fixed_amount", fixed_amount: { amount: 0, currency: "eur" } } });
  }
  return opts;
}

export default async (req) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);
  if (!process.env.STRIPE_SECRET_KEY) return fail("Online payments aren't set up yet. Please contact us to order.", 503);

  const user = await getUser(req);
  if (!user) return fail("Please log in.", 401);
  const profile = await getProfile(user.uid);
  if (profile?.status !== "approved" && !isAdmin(user)) return fail("Your trade account isn't approved yet.", 403);

  let body;
  try { body = await req.json(); } catch { return fail("Invalid basket."); }
  const wanted = new Map();
  for (const it of Array.isArray(body?.items) ? body.items : []) {
    const p = byCode.get(String(it.code));
    const qty = Math.floor(Number(it.qty));
    if (p && qty > 0) wanted.set(p.code, Math.min(999, (wanted.get(p.code) || 0) + qty));
  }
  if (!wanted.size) return fail("Your basket is empty.");
  if (wanted.size > 100) return fail("Please split orders of more than 100 different products into two orders.");

  // Prices always come from the server-side pricelist, never from the browser.
  let grams = 0;
  const line_items = [...wanted].map(([code, qty]) => {
    const p = byCode.get(code);
    grams += (p.g || 0) * qty;
    return {
      quantity: qty,
      price_data: {
        currency: "eur",
        unit_amount: p.price,
        product_data: {
          name: `${p.name}${p.pack ? " · " + p.pack : ""}`.slice(0, 250),
          description: `Code ${p.code} · ${p.vat ? `incl. ${Math.round(p.vat * 100)}% VAT` : "VAT-exempt"}`,
          metadata: { code: p.code },
        },
      },
    };
  });

  const cfg = shippingConfig();
  const q = quote(grams, cfg);
  if (q.cents === null) {
    return fail(`This order weighs about ${(q.grams / 1000).toFixed(1)} kg, which is over our ${q.maxG / 1000} kg online postage limit. Please split it into smaller orders or contact us at info@aillehealth.ie and we'll arrange delivery.`);
  }

  const origin = new URL(req.url).origin;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const countries = (process.env.SHIP_TO || "IE").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const summary = [...wanted].map(([c, q]) => `${q}x${c}`).join(", ");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    customer_email: user.email,
    client_reference_id: user.uid,
    phone_number_collection: { enabled: true },
    shipping_address_collection: { allowed_countries: countries },
    shipping_options: shippingOptions(q, cfg),
    metadata: {
      practitioner: (profile?.fullName || user.email).slice(0, 450),
      clinic: (profile?.clinic || "").slice(0, 450),
      items: summary.slice(0, 450),
      weight_kg: (q.grams / 1000).toFixed(2),
    },
    payment_intent_data: {
      description: `Áille order: ${profile?.clinic || user.email}`.slice(0, 900),
      metadata: { clinic: (profile?.clinic || "").slice(0, 450), items: summary.slice(0, 450) },
    },
    success_url: `${origin}/order-complete.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/shop.html`,
    locale: "en",
  });

  return json({ url: session.url });
};

export const config = { path: "/api/checkout" };
