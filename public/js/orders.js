import { currentUser, api, esc, euro } from "/js/app.js";

const box = document.getElementById("myOrders");
const LABEL = { paid: "Received", packed: "Being packed", dispatched: "Dispatched", cancelled: "Cancelled" };
const date = (s) => new Date(s).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" });
let orders = [];

const user = await currentUser();
if (!user) location.href = "/account.html?next=/orders.html";
else {
  try {
    orders = (await api("orders")).orders;
    box.innerHTML = orders.length ? orders.map(card).join("")
      : `<div class="empty">You haven't placed any orders yet.<br/><a class="btn" style="margin-top:14px" href="/shop.html">Go to the shop</a></div>`;
  } catch (err) { box.innerHTML = `<div class="notice error">${esc(err.message)}</div>`; }
}

function card(o) {
  return `<article class="admin-card" data-id="${esc(o.id)}">
    <div class="top">
      <div><h3>Order ${esc(o.number)}</h3><div class="hint">${date(o.createdAt)} · ${euro(o.total)}</div></div>
      <span class="status-badge ${esc(o.status)}">${LABEL[o.status] || esc(o.status)}</span>
    </div>
    ${o.tracking ? `<div class="notice info">Tracking: <b>${esc(o.tracking)}</b>${o.carrier ? " · " + esc(o.carrier) : ""}</div>` : ""}
    <table class="items-table"><thead><tr><th>Product</th><th class="n">Qty</th><th class="n">Total</th></tr></thead>
      <tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}<div class="hint">${esc(i.code)}</div></td><td class="n">${i.qty}</td><td class="n">${euro(i.total)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="2">${esc(o.shippingName || "Postage & packing")}</td><td class="n">${euro(o.shipping)}</td></tr>
      <tr><td colspan="2">Total paid</td><td class="n">${euro(o.total)}</td></tr></tfoot></table>
    <div class="acts"><button class="btn small" data-reorder>Order these again</button></div>
  </article>`;
}

box.addEventListener("click", (e) => {
  if (!e.target.closest("[data-reorder]")) return;
  const o = orders.find((x) => x.id === e.target.closest(".admin-card").dataset.id);
  let cart = {};
  try { cart = JSON.parse(localStorage.getItem("aille-cart") || "{}"); } catch {}
  for (const i of o.items) if (i.code) cart[i.code] = Math.min(999, (cart[i.code] || 0) + i.qty);
  try { localStorage.setItem("aille-cart", JSON.stringify(cart)); } catch {}
  location.href = "/shop.html#basket";
});
