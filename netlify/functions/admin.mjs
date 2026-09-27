import { getUser, isAdmin, practitioners, json, fail } from "./_lib/common.mjs";

export default async (req) => {
  const user = await getUser(req);
  if (!isAdmin(user)) return fail("Admins only.", 403);
  const store = practitioners();

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    return json({ practitioners: all.filter(Boolean) });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return fail("Invalid request."); }
    const status = { approve: "approved", reject: "rejected", pending: "pending" }[body?.action];
    if (!status || !body.uid) return fail("Invalid request.");
    const p = await store.get(String(body.uid), { type: "json" });
    if (!p) return fail("Application not found.", 404);
    const updated = {
      ...p,
      status,
      note: status === "rejected" ? String(body.note || "").slice(0, 300) : "",
      decidedAt: new Date().toISOString(),
      decidedBy: user.email,
    };
    await store.setJSON(p.uid, updated);
    return json({ practitioner: updated });
  }

  return fail("Method not allowed", 405);
};

export const config = { path: "/api/admin" };
