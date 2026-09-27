// Shared helpers: Firebase sign-in, API calls, nav state.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Public Firebase web config (safe to publish — it only identifies the project).
export const firebaseConfig = {
  apiKey: "AIzaSyC-4pUYzJt5cIB3WBT4CIQHAHXyrl9serY",
  authDomain: "aille-health-clinic.firebaseapp.com",
  projectId: "aille-health-clinic",
  appId: "1:1015659627183:web:ea3807b6b671a7ef1fca5a",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/** Resolves once Firebase knows whether someone is signed in. */
export function currentUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (u) => { stop(); resolve(u); });
  });
}

/** Call one of our Netlify functions with the signed-in user's token. */
export async function api(path, { method = "GET", body, form } = {}) {
  const user = auth.currentUser;
  const headers = {};
  if (user) headers.Authorization = "Bearer " + (await user.getIdToken());
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch("/api/" + path, { method, headers, body: payload });
  const isJson = (res.headers.get("content-type") || "").includes("json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

export { euro, esc } from "/js/util.js";

export async function logout() {
  await signOut(auth);
  try { localStorage.removeItem("aille-cart"); } catch {}
  location.href = "/";
}

// ---- nav: signed-in state ----

onAuthStateChanged(auth, async (user) => {
  const slot = document.getElementById("navAccount");
  if (!slot) return;
  if (!user) {
    slot.innerHTML = `<a class="btn ghost small" href="/account.html">Practitioner login</a>
      <a class="btn small" href="/account.html#apply">Apply for access</a>`;
    return;
  }
  slot.innerHTML = `<a class="btn ghost small" href="/account.html">My account</a>
    <a class="btn small" href="/shop.html">Shop</a>`;
});
