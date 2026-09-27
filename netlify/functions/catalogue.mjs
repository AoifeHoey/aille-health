import { getUser, getProfile, isAdmin, json, fail } from "./_lib/common.mjs";
import catalogue from "./_data/catalogue.json";
import { shippingConfig } from "./_lib/shipping.mjs";

// Prices are only ever sent to approved practitioners (and admins).
export default async (req) => {
  const user = await getUser(req);
  if (!user) return fail("Please log in.", 401);
  if (!isAdmin(user)) {
    const p = await getProfile(user.uid);
    if (p?.status !== "approved") return fail("Your trade account isn't approved yet.", 403);
  }
  return json({
    categories: catalogue.categories,
    products: catalogue.products.map(({ code, name, pack, cat, price, vat, img, g }) => ({ code, name, pack, cat, price, vat, img, g })),
    shipping: shippingConfig(),
  });
};

export const config = { path: "/api/catalogue" };
