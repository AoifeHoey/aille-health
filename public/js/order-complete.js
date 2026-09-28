import { currentUser, api, esc, euro } from "/js/app.js";

try { localStorage.removeItem("aille-cart"); } catch {}
const box = document.getElementById("orderBox");
const id = new URLSearchParams(location.search).get("session_id");
const fallback = `<p class="lead">Your payment was successful and a receipt has been emailed to you. We'll let you know when your order is on its way.</p>`;

async function confirm(tries = 0) {
  try {
    const res = await api("order-confirm?session_id=" + encodeURIComponent(id));
    if (res.pending && tries < 5) return setTimeout(() => confirm(tries + 1), 2000);
    const o = res.order;
    if (!o) { box.innerHTML = fallback; return; }
    box.innerHTML = `<p class="lead" style="margin-bottom:16px">Your order <b>${esc(o.number)}</b> is confirmed. A confirmation has been sent to ${esc(o.email)}.</p>
      <table class="items-table"><thead><tr><th>Product</th><th class="n">Qty</th><th class="n">Total</th></tr></thead>
      <tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}<div class="hint">${esc(i.code)}</div></td><td class="n">${i.qty}</td><td class="n">${euro(i.total)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="2">Subtotal</td><td class="n">${euro(o.subtotal)}</td></tr>
      <tr><td colspan="2">${esc(o.shippingName || "Postage & packing")}</td><td class="n">${euro(o.shipping)}</td></tr>
      <tr><td colspan="2">Total paid</td><td class="n">${euro(o.total)}</td></tr></tfoot></table>`;
  } catch { box.innerHTML = fallback; }
}

if (id && (await currentUser())) confirm(); else box.innerHTML = fallback;
