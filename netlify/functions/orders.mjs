// A practitioner's own order history.
import { getUser, json, fail } from "./_lib/common.mjs";
import { ordersStore } from "./_lib/orders.mjs";

export default async (req) => {
  const user = await getUser(req);
  if (!user) return fail("Please log in.", 401);
  const store = ordersStore();
  const { blobs } = await store.list({ prefix: user.uid + "/" });
  const orders = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ uid, paymentIntent, ...o }) => o);
  return json({ orders });
};

export const config = { path: "/api/orders" };
