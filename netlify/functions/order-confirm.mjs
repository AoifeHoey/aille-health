// Called by the "order received" page after Stripe sends the customer back.
import { getUser, isAdmin, json, fail } from "./_lib/common.mjs";
import { recordOrder, stripeClient } from "./_lib/orders.mjs";

export default async (req) => {
  const user = await getUser(req);
  if (!user) return fail("Please log in.", 401);
  if (!process.env.STRIPE_SECRET_KEY) return fail("Payments aren't set up.", 503);
  const id = new URL(req.url).searchParams.get("session_id") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return fail("Missing order reference.");

  const s = await stripeClient().checkout.sessions.retrieve(id);
  if (s.client_reference_id !== user.uid && !isAdmin(user)) return fail("Order not found.", 404);
  const { order, pending } = await recordOrder(id, new URL(req.url).origin);
  if (pending) return json({ pending: true });
  return json({ order });
};

export const config = { path: "/api/order-confirm" };
