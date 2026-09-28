// Admin: list every order and update its status (packed / dispatched / cancelled).
import { getUser, isAdmin, json, fail } from "./_lib/common.mjs";
import { ordersStore, STATUSES, sendDispatchEmail } from "./_lib/orders.mjs";

export default async (req) => {
  const user = await getUser(req);
  if (!isAdmin(user)) return fail("Admins only.", 403);
  const store = ordersStore();

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const orders = (await Promise.all(blobs.map(async (b) => ({ key: b.key, ...(await store.get(b.key, { type: "json" })) }))))
      .filter((o) => o.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json({ orders });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return fail("Invalid request."); }
    const key = String(body?.key || "");
    const order = key && (await store.get(key, { type: "json" }));
    if (!order) return fail("Order not found.", 404);
    if (!STATUSES.includes(body.status)) return fail("Invalid status.");

    order.status = body.status;
    if (body.status === "dispatched") {
      order.tracking = String(body.tracking || "").slice(0, 80);
      order.carrier = String(body.carrier || "").slice(0, 40);
    }
    if (body.note !== undefined) order.note = String(body.note).slice(0, 500);
    order.history = [...(order.history || []), { status: body.status, at: new Date().toISOString(), by: user.email }];

    let emailed = false;
    if (body.status === "dispatched" && body.notify !== false) {
      const r = await sendDispatchEmail(order, new URL(req.url).origin);
      emailed = !!r.sent;
      if (emailed) order.dispatchEmailedAt = new Date().toISOString();
    }
    await store.setJSON(key, order);
    return json({ order: { key, ...order }, emailed });
  }
  return fail("Method not allowed", 405);
};

export const config = { path: "/api/admin-orders" };
