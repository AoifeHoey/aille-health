import { auth, currentUser, api, esc } from "/js/app.js";

const list = document.getElementById("list");

// Switch between the Orders and Applications sections
function showSection() {
  const sec = location.hash === "#applications" ? "applications" : "orders";
  document.querySelectorAll("#sectionSwitch a").forEach((a) => a.classList.toggle("on", a.dataset.sec === sec));
  document.getElementById("sec-orders").hidden = sec !== "orders";
  document.getElementById("sec-applications").hidden = sec !== "applications";
}
window.addEventListener("hashchange", showSection);
showSection();
let people = [], filter = "pending";

const user = await currentUser();
if (!user) location.href = "/account.html?next=/admin.html";
else load();

async function load() {
  try {
    const me = await api("me");
    if (!me.isAdmin) { list.innerHTML = `<div class="notice error">This page is for Áille staff only.</div>`; return; }
    people = (await api("admin")).practitioners;
    draw();
  } catch (err) { list.innerHTML = `<div class="notice error">${esc(err.message)}</div>`; }
}

document.getElementById("filters").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  filter = b.dataset.f;
  document.querySelectorAll("#filters button").forEach((x) => x.classList.toggle("on", x === b));
  draw();
};
document.getElementById("q").oninput = draw;

const date = (s) => s ? new Date(s).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" }) : "";

function draw() {
  const q = document.getElementById("q").value.toLowerCase();
  const rows = people
    .filter((p) => filter === "all" || p.status === filter)
    .filter((p) => !q || [p.fullName, p.clinic, p.email].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  const counts = people.reduce((m, p) => (m[p.status] = (m[p.status] || 0) + 1, m), {});
  document.getElementById("appsBadge").textContent = counts.pending || "";
  document.querySelectorAll("#filters button").forEach((b) => {
    const n = b.dataset.f === "all" ? people.length : counts[b.dataset.f] || 0;
    b.textContent = b.dataset.f[0].toUpperCase() + b.dataset.f.slice(1) + ` (${n})`;
  });
  list.innerHTML = rows.length ? rows.map(card).join("") : `<div class="empty">Nothing here.</div>`;
}

function card(p) {
  return `<article class="admin-card" data-uid="${esc(p.uid)}">
    <div class="top">
      <div><h3>${esc(p.fullName)}</h3><div class="hint">${esc(p.clinic)} · applied ${date(p.submittedAt)}</div></div>
      <span class="status-badge ${esc(p.status)}">${esc(p.status)}</span>
    </div>
    <dl>
      <dt>Email</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd>
      <dt>Phone</dt><dd><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></dd>
      <dt>Qualification</dt><dd>${esc(p.qualification)}</dd>
      ${p.memberNo ? `<dt>Membership</dt><dd>${esc(p.memberNo)}</dd>` : ""}
      <dt>Address</dt><dd style="white-space:pre-line">${esc(p.address)}</dd>
      <dt>Certification</dt><dd>${(p.files || []).map((f) =>
        `<button class="link-btn" data-file="${esc(f.key)}">${esc(f.name)}</button>`).join("<br/>") || "none"}</dd>
      ${p.decidedAt ? `<dt>Decision</dt><dd>${esc(p.status)} ${date(p.decidedAt)}${p.note ? " · " + esc(p.note) : ""}</dd>` : ""}
    </dl>
    <div class="acts">
      ${p.status !== "approved" ? `<button class="btn small" data-act="approve">Approve</button>` : ""}
      ${p.status !== "rejected" ? `<button class="btn small ghost" data-act="reject">${p.status === "approved" ? "Revoke access" : "Reject"}</button>` : ""}
    </div>
  </article>`;
}

list.addEventListener("click", async (e) => {
  const cardEl = e.target.closest(".admin-card"); if (!cardEl) return;
  const uid = cardEl.dataset.uid;
  const p = people.find((x) => x.uid === uid);

  const fileBtn = e.target.closest("[data-file]");
  if (fileBtn) {
    const win = window.open("", "_blank");
    try {
      const res = await fetch(`/api/admin-file?key=${encodeURIComponent(fileBtn.dataset.file)}`, {
        headers: { Authorization: "Bearer " + (await auth.currentUser.getIdToken()) },
      });
      if (!res.ok) throw new Error("Couldn't open file");
      win.location = URL.createObjectURL(await res.blob());
    } catch (err) { win?.close(); alert(err.message); }
    return;
  }

  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  let note = "";
  if (act === "reject") {
    note = prompt("Optional reason (shown to the practitioner on their account page):", "") ?? null;
    if (note === null) return;
  }
  e.target.disabled = true;
  try {
    const { practitioner, emailed } = await api("admin", { method: "POST", body: { uid, action: act, note } });
    Object.assign(p, practitioner);
    draw();
    if (act === "approve" && emailed) {
      alert(`${p.fullName} is approved and has been emailed.`);
    } else if (act === "approve") {
      const subject = "Your Áille Health trade account is approved";
      const body = `Hi ${p.fullName.split(" ")[0]},\n\nThank you for registering with Áille Health Clinic. Your trade account has been approved, so you can now log in to see our full pricelist and order online:\n\n${location.origin}/shop.html\n\nIf you have any questions, just reply to this email.\n\nKind regards,\nÁille Health Clinic\n+353 85 748 6575`;
      if (confirm(`${p.fullName} is approved. Open an email to let them know?`))
        location.href = `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  } catch (err) { alert(err.message); e.target.disabled = false; }
});
