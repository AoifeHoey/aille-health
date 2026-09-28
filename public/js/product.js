// On a product page: approved practitioners see the trade price and can add to basket.
import { currentUser, api, esc, euro } from "/js/app.js";

const box = document.getElementById("buyBox");
const code = document.querySelector(".product")?.dataset.code;

if (box && code && (await currentUser())) {
  try {
    const data = await api("catalogue");
    const p = data.products.find((x) => x.code === code);
    if (p) {
      box.innerHTML = `<div class="price">${euro(p.price)} <small>${p.vat ? "incl. VAT" : "VAT-exempt"}</small></div>
        <div class="buy-row">
          <div class="qty"><button data-d="-1" aria-label="Less">−</button><input id="q" inputmode="numeric" value="1" aria-label="Quantity" /><button data-d="1" aria-label="More">+</button></div>
          <button class="btn" id="add">Add to basket</button>
          <a class="btn ghost" href="/shop.html#basket">View basket</a>
        </div>
        <p class="hint" id="added" style="margin-top:10px"></p>`;
      const q = document.getElementById("q");
      box.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => { q.value = Math.max(1, (parseInt(q.value, 10) || 1) + Number(b.dataset.d)); });
      document.getElementById("add").onclick = () => {
        let cart = {};
        try { cart = JSON.parse(localStorage.getItem("aille-cart") || "{}"); } catch {}
        const n = Math.max(1, Math.min(999, parseInt(q.value, 10) || 1));
        cart[code] = Math.min(999, (cart[code] || 0) + n);
        try { localStorage.setItem("aille-cart", JSON.stringify(cart)); } catch {}
        document.getElementById("added").textContent = `Added ${n} to your basket (${cart[code]} in basket).`;
      };
    }
  } catch {
    // Not approved yet: keep the "log in for price" message.
  }
}
