import { getUser, isAdmin, certificates, fail } from "./_lib/common.mjs";

export default async (req) => {
  const user = await getUser(req);
  if (!isAdmin(user)) return fail("Admins only.", 403);
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return fail("Missing file.");
  const res = await certificates().getWithMetadata(key, { type: "arrayBuffer" });
  if (!res) return fail("File not found.", 404);
  return new Response(res.data, {
    headers: {
      "Content-Type": res.metadata?.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${String(res.metadata?.name || "certificate").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
};

export const config = { path: "/api/admin-file" };
