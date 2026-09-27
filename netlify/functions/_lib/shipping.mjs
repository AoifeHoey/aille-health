// Weight-based postage. Change bands in Netlify env var SHIPPING_BANDS without touching code:
//   "5:7.50,10:14.50"  ->  up to 5 kg €7.50, up to 10 kg €14.50
// PACKAGING_G adds the weight of the box/padding to every order (default 250 g).
export function shippingConfig() {
  const bands = (process.env.SHIPPING_BANDS || "5:7.50,10:14.50")
    .split(",")
    .map((b) => b.split(":").map((x) => parseFloat(x)))
    .filter(([kg, eur]) => kg > 0 && eur >= 0)
    .map(([kg, eur]) => ({ maxG: Math.round(kg * 1000), cents: Math.round(eur * 100) }))
    .sort((a, b) => a.maxG - b.maxG);
  const packagingG = Math.max(0, parseInt(process.env.PACKAGING_G ?? "250", 10) || 0);
  return { bands, packagingG, collection: process.env.ALLOW_COLLECTION === "true" };
}

/** Returns { grams, cents } for a basket weight, or { grams, cents: null } if it's over the top band. */
export function quote(productGrams, cfg = shippingConfig()) {
  const grams = productGrams + cfg.packagingG;
  const band = cfg.bands.find((b) => grams <= b.maxG);
  return { grams, cents: band ? band.cents : null, maxG: cfg.bands.at(-1)?.maxG ?? 0 };
}
