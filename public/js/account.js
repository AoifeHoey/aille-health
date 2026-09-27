import { auth, api, esc, logout } from "/js/app.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = (id) => document.getElementById(id);
const next = new URLSearchParams(location.search).get("next");
const MAX_FILES = 3, MAX_BYTES = 4 * 1024 * 1024;
let files = [];

function msg(el, text, kind = "error") {
  const n = $(el);
  n.className = "notice " + kind; n.textContent = text; n.hidden = !text;
}
function show(which) {
  for (const id of ["signedOut", "applyForm", "statusView"]) $(id).hidden = id !== which;
}
function tab(apply) {
  $("tabLogin").classList.toggle("on", !apply);
  $("tabApply").classList.toggle("on", apply);
  $("loginForm").hidden = apply;
  $("signupForm").hidden = !apply;
}
$("tabLogin").onclick = () => tab(false);
$("tabApply").onclick = () => tab(true);
if (location.hash === "#apply") tab(true);

const friendly = (e) => ({
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "No account found with that email.",
  "auth/email-already-in-use": "An account already exists for that email. Please log in instead.",
  "auth/weak-password": "Please choose a password of at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/invalid-email": "Please enter a valid email address.",
}[e.code] || e.message);

// ---- log in ----
$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  msg("liMsg", "Signing in…", "info");
  try { await signInWithEmailAndPassword(auth, $("liEmail").value.trim(), $("liPass").value); msg("liMsg", ""); }
  catch (err) { msg("liMsg", friendly(err)); }
};
$("forgot").onclick = async () => {
  const email = $("liEmail").value.trim();
  if (!email) return msg("liMsg", "Enter your email above, then click “Forgot password?” again.");
  try { await sendPasswordResetEmail(auth, email); msg("liMsg", "Password reset email sent. Check your inbox.", "ok"); }
  catch (err) { msg("liMsg", friendly(err)); }
};

// ---- sign up (step 1) ----
$("signupForm").onsubmit = async (e) => {
  e.preventDefault();
  if ($("suPass").value !== $("suPass2").value) return msg("suMsg", "Passwords don't match.");
  msg("suMsg", "Creating your account…", "info");
  try {
    const cred = await createUserWithEmailAndPassword(auth, $("suEmail").value.trim(), $("suPass").value);
    sendEmailVerification(cred.user).catch(() => {});
    msg("suMsg", "");
  } catch (err) { msg("suMsg", friendly(err)); }
};

// ---- application (step 2) ----
function drawFiles() {
  $("fileList").innerHTML = files.map((f, i) =>
    `<li><span>${esc(f.name)} <span class="hint">${(f.size / 1024).toFixed(0)} KB</span></span><button type="button" class="link-btn" data-i="${i}">Remove</button></li>`).join("");
}
function addFiles(list) {
  for (const f of list) {
    if (!/^(application\/pdf|image\/)/.test(f.type)) { msg("apMsg", `${f.name} isn't a PDF or image.`); continue; }
    files.push(f);
  }
  if (files.length > MAX_FILES) { files = files.slice(0, MAX_FILES); msg("apMsg", `Up to ${MAX_FILES} files please.`); }
  if (files.reduce((n, f) => n + f.size, 0) > MAX_BYTES) msg("apMsg", "Files are over 4 MB in total. Try a smaller scan or photo.");
  drawFiles();
}
$("apFiles").onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
$("fileList").onclick = (e) => { const i = e.target.dataset.i; if (i !== undefined) { files.splice(+i, 1); drawFiles(); } };
const drop = $("drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("drag"); addFiles(e.dataTransfer.files); });

$("applyForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!files.length) return msg("apMsg", "Please upload your certification.");
  if (files.reduce((n, f) => n + f.size, 0) > MAX_BYTES) return msg("apMsg", "Files are over 4 MB in total. Try a smaller scan or photo.");
  const btn = $("apBtn"); btn.disabled = true; btn.textContent = "Uploading…";
  msg("apMsg", "");
  const fd = new FormData($("applyForm"));
  files.forEach((f) => fd.append("files", f, f.name));
  try {
    await api("apply", { method: "POST", form: fd });
    // Ping Netlify Forms so Áille gets an email about the new application.
    const note = new URLSearchParams({
      "form-name": "practitioner-application", fullName: fd.get("fullName"), clinic: fd.get("clinic"),
      email: auth.currentUser.email, phone: fd.get("phone"), qualification: fd.get("qualification"),
    });
    fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: note }).catch(() => {});
    files = [];
    await refresh(auth.currentUser);
  } catch (err) {
    msg("apMsg", err.message);
  } finally { btn.disabled = false; btn.textContent = "Submit application"; }
};

// ---- status ----
async function refresh(user) {
  if (!user) { show("signedOut"); return; }
  $("statusView").innerHTML = `<p>Loading your account…</p>`; show("statusView");
  let me;
  try { me = await api("me"); }
  catch (err) { $("statusView").innerHTML = `<div class="notice error">${esc(err.message)}</div>`; return; }
  const p = me.profile;
  if (!p && !me.isAdmin) { show("applyForm"); return; }
  if (p?.status === "approved" && next) { location.href = next; return; }

  const status = p?.status || "admin";
  const copy = {
    pending: "Thanks! We've received your application and will review your certification shortly. We'll email you once you're approved.",
    approved: "Your trade account is approved. You can now see trade prices and order online.",
    rejected: "We weren't able to approve your account. " + (p?.note ? esc(p.note) + " " : "") + "Please contact us at info@aillehealth.ie.",
    admin: me.adminNeedsVerification ? "This is the admin email address. Please verify it to unlock the admin tools." : "You're signed in as an administrator.",
  }[status];
  $("statusView").innerHTML = `
    <h2 style="font-size:1.8rem;margin-bottom:8px">${esc(p?.fullName || user.email)}</h2>
    <p class="hint" style="margin-bottom:16px">${esc(user.email)}${p?.clinic ? " · " + esc(p.clinic) : ""}</p>
    ${p ? `<p style="margin-bottom:10px">Account status: <span class="status-badge ${esc(status)}">${esc(status)}</span></p>` : ""}
    <p class="lead" style="margin-bottom:22px">${copy}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${status === "approved" || me.isAdmin ? `<a class="btn" href="/shop.html">Go to the shop</a>` : ""}
      ${me.isAdmin ? `<a class="btn gold" href="/admin.html">Review applications</a>` : ""}
      ${me.adminNeedsVerification ? `<button class="btn gold" id="verifyBtn">Verify email to unlock admin</button>` : ""}
      ${status === "rejected" ? `<button class="btn ghost" id="reapply">Submit new documents</button>` : ""}
      <button class="btn ghost" id="logoutBtn">Log out</button>
    </div>`;
  $("logoutBtn").onclick = logout;
  const vb = $("verifyBtn");
  if (vb) vb.onclick = async () => {
    try { await sendEmailVerification(user); vb.textContent = "Email sent. Click the link, then log out and back in."; vb.disabled = true; }
    catch (err) { alert(friendly(err)); }
  };
  const re = $("reapply");
  if (re) re.onclick = () => {
    for (const [k, id] of [["fullName", "apName"], ["phone", "apPhone"], ["clinic", "apClinic"], ["qualification", "apQual"], ["memberNo", "apBody"], ["address", "apAddr"]]) $(id).value = p[k] || "";
    show("applyForm");
  };
}

onAuthStateChanged(auth, refresh);
