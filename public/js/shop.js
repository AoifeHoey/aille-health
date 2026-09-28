import { currentUser, api, euro, esc } from "/js/app.js";
import { mount } from "/js/catalogue-ui.js";

const $ = (id) => document.getElementById(id);
const gateMsg = $("gateMsg");

function gate(html) { gateMsg.innerHTML = html; }

const user = await currentUser();
if (!user) {
  gate(`<h2>Trade shop</h2><p class="lead" style="margin:10px auto 20px">Please log in with your approved practitioner account to see prices and order.</p>
    <a class="btn" href="/account.html?next=/shop.html">Log in</a> <a class="btn ghost" href="/account.html#apply">Apply for access</a>`);
} else {
  try {
    const me = await api("me");
    const status = me.profile?.status;
    if (status !== "approved" && !me.isAdmin) {
      gate(status
        ? `<h2>Almost there</h2><p class="lead" style="margin:10px auto 20px">Your trade account is <span class="status-badge ${esc(status)}">${esc(status)}</span>. You'll be able to order as soon as it's approved.</p><a class="btn ghost" href="/account.html">View my account</a>`
        : `<h2>Complete your application</h2><p class="lead" style="margin:10px auto 20px">Upload your certification so we can approve your trade account.</p><a class="btn" href="/account.html">Continue</a>`);
    } else {
      const data = await api("catalogue");
      start(data, me.isAdmin);
    }
  } catch (err) {
    gate(`<div class="notice error">${esc(err.message)}</div>`);
  }
}

function start(data, isAdmin) {
  $("gateWrap").hidden = true;
  $("shopWrap").hidden = false;
  $("cartBtn").hidden = false;

  const byCode = new Map(data.products.map((p) => [p.code, p]));
  let items = {};
  try { items = JSON.parse(localStorage.getItem("aille-cart") || "{}"); } catch {}
  for (const c of Object.keys(items)) if (!byCode.has(c)) delete items[c];

  const cart = {
    get: (code) => items[code] || 0,
    set(code, qty) {
      qty = Math.max(0, Math.min(999, qty | 0));
      if (qty) items[code] = qty; else delete items[code];
      try { localStorage.setItem("aille-cart", JSON.stringify(items)); } catch {}
      drawCart();
    },
  };

  const ui = mount({ data, mode: "shop", cart, showWeights: isAdmin });

  function drawCart() {
    const lines = Object.entries(items).map(([code, qty]) => ({ p: byCode.get(code), qty }));
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const sub = lines.reduce((n, l) => n + l.p.price * l.qty, 0);
    const ship = data.shipping || { bands: [], packagingG: 0 };
    const grams = lines.reduce((n, l) => n + (l.p.g || 0) * l.qty, 0) + (count ? ship.packagingG : 0);
    const band = ship.bands.find((b) => grams <= b.maxG);
    const maxG = ship.bands.at(-1)?.maxG || 0;
    const post = count && band ? band.cents : 0;
    $("cartWeight").textContent = count ? `· approx. ${(grams / 1000).toFixed(1)} kg` : "";
    $("cartShip").textContent = !count ? "–" : band ? euro(band.cents) : "Contact us";
    $("cartGrand").textContent = euro(sub + post);
    const over = count && !band;
    $("shipWarn").hidden = !over;
    if (over) $("shipWarn").textContent = `Orders over ${maxG / 1000} kg can't be posted online yet. Please split your order, or contact info@aillehealth.ie and we'll arrange delivery.`;
    // Update the page-top prices text in the bands hint from live settings
    const hint = document.querySelector(".drawer footer .hint");
    if (hint && ship.bands.length) hint.textContent = "Prices include VAT where applicable. Postage is by weight: " +
      ship.bands.map((b) => `up to ${b.maxG / 1000} kg ${euro(b.cents)}`).join(", ") + " (Ireland).";
    $("cartCount").textContent = count;
    $("cartTotal").textContent = count ? "· " + euro(sub) : "";
    $("cartSub").textContent = euro(sub);
    $("checkoutBtn").disabled = !count || over;
    $("cartItems").innerHTML = lines.length
      ? lines.map(({ p, qty }) => `<div class="line">
          <div><div class="n">${esc(p.name)}</div><div class="m">${esc(p.code)}${p.pack ? " · " + esc(p.pack) : ""} · ${euro(p.price)} each</div></div>
          <div style="text-align:right"><b>${euro(p.price * qty)}</b></div>
          <div class="qty" data-code="${esc(p.code)}"><button data-d="-1" aria-label="Less">−</button><input inputmode="numeric" value="${qty}" aria-label="Quantity" /><button data-d="1" aria-label="More">+</button></div>
          <div style="text-align:right"><button class="link-btn" data-rm="${esc(p.code)}">Remove</button></div>
        </div>`).join("")
      : `<div class="empty">Your basket is empty.</div>`;
  }

  $("cartItems").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]");
    if (rm) { cart.set(rm.dataset.rm, 0); ui.render(); return; }
    const step = e.target.closest("[data-d]");
    if (step) { const c = step.parentElement.dataset.code; cart.set(c, cart.get(c) + Number(step.dataset.d)); ui.render(); }
  });
  $("cartItems").addEventListener("change", (e) => {
    const box = e.target.closest(".qty");
    if (box) { cart.set(box.dataset.code, parseInt(e.target.value, 10) || 0); ui.render(); }
  });

  const open = (on) => { $("drawer").hidden = !on; $("drawerBg").hidden = !on; };
  $("cartBtn").onclick = () => open(true);
  $("closeCart").onclick = () => open(false);
  $("drawerBg").onclick = () => open(false);

  $("checkoutBtn").onclick = async () => {
    const btn = $("checkoutBtn"), err = $("checkoutErr");
    err.hidden = true; btn.disabled = true; btn.textContent = "Opening secure checkout…";
    try {
      const { url } = await api("checkout", {
        method: "POST",
        body: { items: Object.entries(items).map(([code, qty]) => ({ code, qty })) },
      });
      location.href = url;
    } catch (e) {
      err.textContent = e.message; err.hidden = false;
      btn.disabled = false; btn.textContent = "Checkout securely";
    }
  };

  drawCart();
  if (location.hash === "#basket") { history.replaceState(null, "", location.pathname); open(true); }
}
