// Small helpers with no external dependencies.
export const euro = (cents) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Mobile menu (kept here so it works even if sign-in scripts are slow to load)
const menuBtn = document.querySelector(".menu-btn");
const navLinks = document.querySelector(".nav-links");
menuBtn?.addEventListener("click", () => navLinks.classList.toggle("open"));
navLinks?.addEventListener("click", (e) => { if (e.target.closest("a")) navLinks.classList.remove("open"); });
