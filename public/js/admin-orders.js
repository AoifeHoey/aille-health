// Admin orders dashboard: see paid orders, print packing slips, mark packed / dispatched.
import { currentUser, api, esc, euro } from "/js/app.js";

const $ = (id) => document.getElementById(id);
const list = $("olist");
let orders = [], filter = "paid";

const LABEL = { paid: "To pack", packed: "Packed", dispatched: "Dispatched", cancelled: "Cancelled" };
const when = (s) => s ? new Date(s).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const addr = (a) => a ? [a.name, a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).map(esc).join("<br/>") : "Collection / not given";

const user = await currentUser();
if (user) load();

async function load() {
  try {
    const me = await api("me");
    if (!me.isAdmin) { list.innerHTML = `<div class="notice error">This page is for Áille staff only.</div>`; return; }
    orders = (await api("admin-orders")).orders;
    draw();
  } catch (err) { list.innerHTML = `<div class="notice error">${esc(err.message)}</div>`; }
}

$("ofilters").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  filter = b.dataset.f;
  document.querySelectorAll("#ofilters button").forEach((x) => x.classList.toggle("on", x === b));
  draw();
};
$("oq").oninput = draw;

function itemsTable(o) {
  return `<table class="items-table"><thead><tr><th>Code</th><th>Product</th><th class="n">Qty</th><th class="n">Each</th><th class="n">Total</th></tr></thead>
    <tbody>${o.items.map((i) => `<tr><td>${esc(i.code)}</td><td>${esc(i.name)}</td><td class="n"><b>${i.qty}</b></td><td class="n">${euro(i.unit)}</td><td class="n">${euro(i.total)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="4">Subtotal</td><td class="n">${euro(o.subtotal)}</td></tr>
      <tr><td colspan="4">${esc(o.shippingName || "Postage & packing")}</td><td class="n">${euro(o.shipping)}</td></tr>
      <tr><td colspan="4">Total paid</td><td class="n">${euro(o.total)}</td></tr></tfoot></table>`;
}

function card(o) {
  const units = o.items.reduce((n, i) => n + i.qty, 0);
  return `<article class="admin-card" data-key="${esc(o.key)}">
    <div class="top">
      <div><h3>${esc(o.number)} · ${esc(o.clinic || o.practitioner)}</h3>
        <div class="hint">${when(o.createdAt)} · ${units} item${units === 1 ? "" : "s"} · ${euro(o.total)}${o.weightKg ? ` · ~${o.weightKg} kg` : ""}</div></div>
      <span class="status-badge ${esc(o.status)}">${LABEL[o.status] || esc(o.status)}</span>
    </div>
    <div class="order-grid">
      <div>${itemsTable(o)}</div>
      <dl style="grid-template-columns:90px 1fr">
        <dt>Customer</dt><dd>${esc(o.practitioner)}${o.clinic ? "<br/>" + esc(o.clinic) : ""}</dd>
        <dt>Email</dt><dd><a href="mailto:${esc(o.email)}">${esc(o.email)}</a></dd>
        <dt>Phone</dt><dd><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></dd>
        <dt>Deliver to</dt><dd>${addr(o.address)}</dd>
        ${o.tracking ? `<dt>Tracking</dt><dd>${esc(o.tracking)}${o.carrier ? " · " + esc(o.carrier) : ""}</dd>` : ""}
        ${o.history?.length > 1 ? `<dt>History</dt><dd>${o.history.map((h) => `${LABEL[h.status] || esc(h.status)} ${when(h.at)}`).join("<br/>")}</dd>` : ""}
      </dl>
    </div>
    <div class="acts">
      <button class="btn small ghost" data-act="slip">Print packing slip</button>
      ${o.status === "paid" ? `<button class="btn small" data-act="packed">Mark packed</button>` : ""}
      ${["paid", "packed"].includes(o.status) ? `<button class="btn small" data-act="dispatched">Mark dispatched</button>` : ""}
      ${o.paymentIntent ? `<a class="btn small ghost" target="_blank" rel="noopener" href="https://dashboard.stripe.com/payments/${esc(o.paymentIntent)}">Open in Stripe</a>` : ""}
      ${o.status !== "cancelled" && o.status !== "dispatched" ? `<button class="link-btn" data-act="cancelled">Cancel order</button>` : ""}
    </div>
  </article>`;
}

function draw() {
  const q = $("oq").value.trim().toLowerCase();
  const counts = orders.reduce((m, o) => (m[o.status] = (m[o.status] || 0) + 1, m), {});
  $("ordersBadge").textContent = counts.paid || "";
  document.querySelectorAll("#ofilters button").forEach((b) => {
    const n = b.dataset.f === "all" ? orders.length : counts[b.dataset.f] || 0;
    b.textContent = (b.dataset.f === "all" ? "All" : LABEL[b.dataset.f]) + ` (${n})`;
  });
  const rows = orders
    .filter((o) => filter === "all" || o.status === filter)
    .filter((o) => !q || [o.number, o.clinic, o.practitioner, o.email, ...o.items.map((i) => i.code)].join(" ").toLowerCase().includes(q));
  list.innerHTML = rows.length ? rows.map(card).join("")
    : `<div class="empty">${orders.length ? "No orders here." : "No orders yet. Paid orders will appear here automatically."}</div>`;
}

function printSlip(o) {
  const slip = $("slip");
  slip.innerHTML = `<div style="font-family:Inter,Arial,sans-serif;padding:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 style="font-family:Georgia,serif">Packing slip</h1><div>Order <b>${esc(o.number)}</b> · ${when(o.createdAt)}</div></div>
      <div style="text-align:right"><b>Áille Health Clinic</b><br/>Wexford, Ireland<br/>info@aillehealth.ie · +353 85 748 6575</div>
    </div>
    <div style="display:flex;gap:40px;margin:18px 0">
      <div><b>Deliver to</b><br/>${addr(o.address)}</div>
      <div><b>Customer</b><br/>${esc(o.practitioner)}${o.clinic ? "<br/>" + esc(o.clinic) : ""}<br/>${esc(o.phone)}</div>
    </div>
    <table class="items-table"><thead><tr><th>✓</th><th>Code</th><th>Product</th><th class="n">Qty</th></tr></thead>
      <tbody>${o.items.map((i) => `<tr><td><span class="check"></span></td><td>${esc(i.code)}</td><td>${esc(i.name)}</td><td class="n"><b>${i.qty}</b></td></tr>`).join("")}</tbody></table>
    <p style="margin-top:18px">Thank you for your order.</p></div>`;
  slip.hidden = false;
  window.print();
  slip.hidden = true;
}

list.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const key = e.target.closest(".admin-card").dataset.key;
  const o = orders.find((x) => x.key === key);
  const act = el.dataset.act;
  if (act === "slip") return printSlip(o);

  const body = { key, status: act };
  if (act === "dispatched") {
    const tracking = prompt("Tracking number (optional). The customer will be emailed that their order is on its way.", "");
    if (tracking === null) return;
    body.tracking = tracking.trim();
    body.carrier = body.tracking ? (prompt("Courier name (optional), e.g. An Post, DPD, Fastway", "") || "").trim() : "";
  }
  if (act === "cancelled" && !confirm(`Cancel ${o.number}? This only changes the status here. Refund the payment in Stripe if needed.`)) return;

  el.disabled = true;
  try {
    const { order, emailed } = await api("admin-orders", { method: "POST", body });
    Object.assign(o, order);
    draw();
    if (act === "dispatched" && !emailed && confirm("Dispatch email couldn't be sent automatically. Open an email to the customer?")) {
      const msg = `Hi ${(o.practitioner || "").split(" ")[0]},\n\nYour order ${o.number} has been dispatched from Wexford.${o.tracking ? `\nTracking: ${o.tracking}${o.carrier ? " (" + o.carrier + ")" : ""}` : ""}\n\nKind regards,\nÁille Health Clinic`;
      location.href = `mailto:${o.email}?subject=${encodeURIComponent(`Your order ${o.number} is on its way`)}&body=${encodeURIComponent(msg)}`;
    }
  } catch (err) { alert(err.message); el.disabled = false; }
});
