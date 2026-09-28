// Stripe calls this when a checkout is paid, so orders are recorded even if the
// customer closes their browser before returning to the site.
import { stripeClient, recordOrder } from "./_lib/orders.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return new Response("Webhook not configured", { status: 503 });

  let event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(await req.text(), req.headers.get("stripe-signature"), secret);
  } catch (err) {
    return new Response(`Bad signature: ${err.message}`, { status: 400 });
  }
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    const site = process.env.URL || new URL(req.url).origin;
    await recordOrder(event.data.object.id, site);
  }
  return new Response("ok");
};

export const config = { path: "/api/stripe-webhook" };
