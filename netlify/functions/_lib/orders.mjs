// Turns a paid Stripe Checkout session into an Áille order record (stored in Netlify Blobs)
// and sends the confirmation + "new order" emails. Safe to call more than once per session.
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { sendEmail, layout, p, button, orderTable, addressHtml, esc, euro, ADMIN_NOTIFY } from "./email.mjs";

export const ordersStore = () => getStore({ name: "orders", consistency: "strong" });
export const stripeClient = () => new Stripe(process.env.STRIPE_SECRET_KEY);

export const STATUSES = ["paid", "packed", "dispatched", "cancelled"];

function orderNumber(session) {
  // Irish date, e.g. AH-260928-7F3K2Q
  const ymd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", year: "2-digit", month: "2-digit", day: "2-digit" })
    .format(new Date(session.created * 1000)).split("/").reverse().join("");
  return `AH-${ymd}-${session.id.slice(-6).toUpperCase()}`;
}

export async function findOrder(sessionId) {
  const store = ordersStore();
  const { blobs } = await store.list();
  const hit = blobs.find((b) => b.key.endsWith("/" + sessionId));
  return hit ? { key: hit.key, order: await store.get(hit.key, { type: "json" }) } : null;
}

export async function recordOrder(sessionId, siteUrl) {
  const existing = await findOrder(sessionId);
  if (existing) return { order: existing.order, created: false };

  const stripe = stripeClient();
  const s = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items.data.price.product"] });
  if (s.payment_status !== "paid") return { order: null, created: false, pending: true };

  const ship = s.collected_information?.shipping_details || s.shipping_details || null;
  const order = {
    id: s.id,
    number: orderNumber(s),
    uid: s.client_reference_id || "unknown",
    email: s.customer_details?.email || s.customer_email || "",
    phone: s.customer_details?.phone || "",
    practitioner: s.metadata?.practitioner || s.customer_details?.name || "",
    clinic: s.metadata?.clinic || "",
    weightKg: s.metadata?.weight_kg ? Number(s.metadata.weight_kg) : null,
    items: (s.line_items?.data || []).map((li) => ({
      code: li.price?.product?.metadata?.code || "",
      name: li.description,
      qty: li.quantity,
      unit: li.price?.unit_amount ?? Math.round(li.amount_total / li.quantity),
      total: li.amount_total,
    })),
    subtotal: s.amount_subtotal,
    shipping: s.shipping_cost?.amount_total || 0,
    shippingName: s.shipping_cost?.shipping_rate && typeof s.shipping_cost.shipping_rate === "object"
      ? s.shipping_cost.shipping_rate.display_name : "Postage & packing",
    total: s.amount_total,
    address: ship ? { name: ship.name, ...ship.address } : null,
    paymentIntent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || "",
    status: "paid",
    history: [{ status: "paid", at: new Date(s.created * 1000).toISOString() }],
    createdAt: new Date(s.created * 1000).toISOString(),
  };
  // Look up the delivery option name if Stripe only gave us its id
  if (typeof s.shipping_cost?.shipping_rate === "string") {
    try { order.shippingName = (await stripe.shippingRates.retrieve(s.shipping_cost.shipping_rate)).display_name; } catch {}
  }

  const key = `${order.uid}/${order.id}`;
  await ordersStore().setJSON(key, order);
  await sendNewOrderEmails(order, siteUrl);
  return { order, created: true };
}

async function sendNewOrderEmails(order, siteUrl) {
  const addr = order.address ? `<p style="font-size:14px;line-height:1.5;margin:0 0 14px"><b>Delivering to</b><br/>${addressHtml(order.address)}</p>` : "";
  await sendEmail({
    to: order.email,
    subject: `Order ${order.number} confirmed · Áille Health Clinic`,
    html: layout("Thank you for your order", [
      p(`Hi ${esc((order.practitioner || "").split(" ")[0] || "there")},`),
      p(`We've received your order <b>${order.number}</b> and payment. We'll email you again when it's on its way.`),
      orderTable(order), addr,
      button(`${siteUrl}/orders.html`, "View my orders"),
      p(`Questions about your order? Just reply to this email.`),
    ].join(""), siteUrl),
  });
  await sendEmail({
    to: ADMIN_NOTIFY,
    replyTo: order.email,
    subject: `New order ${order.number} · ${order.clinic || order.practitioner} · ${euro(order.total)}`,
    html: layout(`New order ${order.number}`, [
      p(`<b>${esc(order.practitioner)}</b>${order.clinic ? " · " + esc(order.clinic) : ""}<br/>${esc(order.email)} · ${esc(order.phone)}`),
      orderTable(order), addr,
      order.weightKg ? p(`Estimated weight: ${order.weightKg} kg`) : "",
      button(`${siteUrl}/admin.html#orders`, "Open orders"),
    ].join(""), siteUrl),
  });
}

export async function sendDispatchEmail(order, siteUrl) {
  const track = order.tracking ? p(`Tracking: <b>${esc(order.tracking)}</b>${order.carrier ? " (" + esc(order.carrier) + ")" : ""}`) : "";
  return sendEmail({
    to: order.email,
    subject: `Your order ${order.number} is on its way · Áille Health Clinic`,
    html: layout("Your order is on its way", [
      p(`Hi ${esc((order.practitioner || "").split(" ")[0] || "there")},`),
      p(`Good news: order <b>${order.number}</b> has been dispatched from Wexford.`),
      track, orderTable(order),
      button(`${siteUrl}/orders.html`, "View my orders"),
    ].join(""), siteUrl),
  });
}
