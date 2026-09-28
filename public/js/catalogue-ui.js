// Product browser shared by the public range page and the trade shop.
import { esc, euro } from "/js/util.js";

const PAGE = 60;
const slugify = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * mount({ data, mode: "public" | "shop", cart })
 *   data: { categories:[{id,name,count}], products:[{code,name,pack,cat,img?,price?}] }
 *   cart (shop mode): { get(code), set(code, qty) }
 */
export function mount({ data, mode, cart, showWeights = false }) {
  const els = {
    side: document.getElementById("catList"),
    select: document.getElementById("catSelect"),
    search: document.getElementById("search"),
    list: document.getElementById("prodList"),
    count: document.getElementById("resultCount"),
    heading: document.getElementById("catHeading"),
  };
  const imgs = new Set(data.products.filter((p) => p.img).map((p) => p.code));
  let cat = location.hash.slice(1) || "all";
  if (cat !== "all" && !data.categories.some((c) => c.id === cat)) cat = "all";
  let shown = PAGE;

  const cats = [{ id: "all", name: "All products", count: data.products.length }, ...data.categories];
  els.side.innerHTML = cats.map((c) =>
    `<li><button data-cat="${c.id}"><span>${esc(c.name)}</span><small>${c.count}</small></button></li>`).join("");
  els.select.innerHTML = cats.map((c) => `<option value="${c.id}">${esc(c.name)} (${c.count})</option>`).join("");

  function setCat(id) {
    cat = id; shown = PAGE;
    history.replaceState(null, "", id === "all" ? location.pathname : "#" + id);
    render();
  }
  els.side.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setCat(b.dataset.cat); });
  els.select.addEventListener("change", () => setCat(els.select.value));
  els.search.addEventListener("input", () => { shown = PAGE; render(); });
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h && h !== cat) setCat(h); });

  function matches() {
    const q = els.search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    // A search looks across every category so nothing is missed.
    return data.products.filter((p) => {
      if (!q.length && cat !== "all" && p.cat !== cat) return false;
      if (!q.length) return true;
      const hay = (p.code + " " + p.name + " " + p.pack).toLowerCase();
      return q.every((w) => hay.includes(w));
    });
  }

  function row(p) {
    const thumb = imgs.has(p.code)
      ? `<img src="/img/products/${esc(p.code)}.webp" alt="" loading="lazy" />`
      : esc(p.name.charAt(0));
    const meta = [p.code, p.pack, showWeights && p.g ? `${p.g} g postage weight` : ""].filter(Boolean).map(esc).join(" · ");
    let buy;
    if (mode === "shop") {
      const q = cart.get(p.code);
      buy = `<div class="buy">
          <div class="price">${euro(p.price)}<small>${p.vat ? "incl. VAT" : "VAT-exempt"}</small></div>
          ${q ? `<div class="qty" data-code="${esc(p.code)}"><button data-d="-1" aria-label="Less">−</button><input inputmode="numeric" value="${q}" aria-label="Quantity" /><button data-d="1" aria-label="More">+</button></div>`
              : `<button class="btn small" data-add="${esc(p.code)}">Add</button>`}
        </div>`;
    } else {
      buy = `<div class="buy"><a class="btn ghost small" href="/account.html">Log in for price</a></div>`;
    }
    return `<article class="prod"><div class="thumb">${thumb}</div>
      <div><div class="name"><a href="/products/${slugify(p.code)}.html">${esc(p.name)}</a></div><div class="meta">${meta}</div></div>${buy}</article>`;
  }

  function render() {
    const searching = els.search.value.trim() !== "";
    els.side.querySelectorAll("button").forEach((b) => b.classList.toggle("on", !searching && b.dataset.cat === cat));
    els.select.value = cat;
    const c = cats.find((x) => x.id === cat);
    els.heading.textContent = searching ? "Search results" : (c ? c.name : "All products");
    const items = matches();
    els.count.textContent = `${items.length} product${items.length === 1 ? "" : "s"}`;
    if (!items.length) {
      els.list.innerHTML = `<div class="empty">No products match your search.<br/>Can't find something? <a href="/#contact">Send us an enquiry</a>.</div>`;
      return;
    }
    els.list.innerHTML = items.slice(0, shown).map(row).join("") +
      (items.length > shown ? `<div class="more-row"><button class="btn ghost" id="showMore">Show more (${items.length - shown} remaining)</button></div>` : "");
  }

  els.list.addEventListener("click", (e) => {
    if (e.target.id === "showMore") { shown += PAGE * 2; render(); return; }
    if (mode !== "shop") return;
    const add = e.target.closest("[data-add]");
    if (add) { cart.set(add.dataset.add, 1); render(); return; }
    const step = e.target.closest("[data-d]");
    if (step) {
      const code = step.parentElement.dataset.code;
      cart.set(code, cart.get(code) + Number(step.dataset.d));
      render();
    }
  });
  els.list.addEventListener("change", (e) => {
    const box = e.target.closest(".qty");
    if (box) { cart.set(box.dataset.code, parseInt(e.target.value, 10) || 0); render(); }
  });

  render();
  return { render };
}
