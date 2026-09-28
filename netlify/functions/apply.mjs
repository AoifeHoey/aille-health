import { getUser, getProfile, practitioners, certificates, json, fail } from "./_lib/common.mjs";

const MAX_FILES = 3;
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif|gif))$/;
const clean = (v, n = 300) => String(v || "").trim().slice(0, n);

export default async (req) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const user = await getUser(req);
  if (!user) return fail("Please log in.", 401);

  const existing = await getProfile(user.uid);
  if (existing?.status === "approved") return fail("Your account is already approved.");

  let form;
  try { form = await req.formData(); } catch { return fail("Upload failed. Please try smaller files."); }

  const profile = {
    uid: user.uid,
    email: user.email,
    fullName: clean(form.get("fullName"), 120),
    phone: clean(form.get("phone"), 40),
    clinic: clean(form.get("clinic"), 160),
    qualification: clean(form.get("qualification"), 200),
    memberNo: clean(form.get("memberNo"), 120),
    address: clean(form.get("address"), 500),
  };
  if (form.get("agree") !== "yes") return fail("Please tick the box to confirm you agree to the terms.");
  for (const k of ["fullName", "phone", "clinic", "qualification", "address"])
    if (!profile[k]) return fail("Please complete all the required fields.");

  const files = form.getAll("files").filter((f) => f && typeof f === "object" && f.size > 0);
  if (!files.length) return fail("Please upload your certification.");
  if (files.length > MAX_FILES) return fail(`Please upload at most ${MAX_FILES} files.`);
  if (files.reduce((n, f) => n + f.size, 0) > MAX_BYTES) return fail("Files are over 4 MB in total.");
  for (const f of files) if (!TYPES.test(f.type)) return fail(`${f.name} must be a PDF or image.`);

  const store = certificates();
  const stamp = Date.now();
  const saved = [];
  for (const [i, f] of files.entries()) {
    const name = clean(f.name, 120).replace(/[^\w.\- ]+/g, "_") || `file-${i + 1}`;
    const key = `${user.uid}/${stamp}-${i}-${name}`;
    await store.set(key, await f.arrayBuffer(), { metadata: { contentType: f.type, name } });
    saved.push({ key, name, type: f.type, size: f.size });
  }

  const record = {
    ...profile,
    status: "pending",
    files: [...saved, ...(existing?.files || [])].slice(0, 10),
    submittedAt: new Date().toISOString(),
    agreedTermsAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  await practitioners().setJSON(user.uid, record);

  // Email Áille about the new application via Netlify Forms (sent from the server so it can't be blocked by the browser).
  try {
    await fetch(new URL("/", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        "form-name": "practitioner-application",
        fullName: profile.fullName, clinic: profile.clinic, email: profile.email,
        phone: profile.phone, qualification: profile.qualification,
      }),
    });
  } catch (err) {
    console.error("Could not send application notification", err);
  }

  return json({ ok: true, status: "pending" });
};

export const config = { path: "/api/apply" };
