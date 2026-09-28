"""
Generates the SEO-friendly static pages for the public site:
  public/range/<category>.html    one page per range, listing every product
  public/products/<code>.html     one page per product
  public/privacy.html, terms.html, delivery.html   from scripts/templates/*.html
  public/sitemap.xml, public/robots.txt
It also refreshes the footer on every hand-written page.

Run after build_catalogue.py:   python scripts/build_pages.py
"""
import datetime, html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
SITE = os.environ.get("SITE_URL", "https://aillehealth.ie")
TODAY = datetime.date.today()

# Keep in step with SHIPPING_BANDS in Netlify (used on the Delivery page)
SHIPPING_BANDS = [(5, 7.50), (10, 14.50)]

e = lambda s: html.escape(str(s or ""), quote=True)
slug = lambda code: re.sub(r"[^a-z0-9]+", "-", code.lower()).strip("-")

RANGES = {
    "dry-herbs": ("Dry herbs", "cat-tcm.webp",
        "Traditional single dried herbs for decoctions and teas, supplied in 500 g packs and listed by pinyin name. "
        "VAT-exempt. Ask us if you need a herb that isn't listed."),
    "granules": ("TCM granules", "cat-tcm.webp",
        "Concentrated single-herb granules in 100 g bottles, for dispensing individual formulas in clinic. "
        "Listed by pinyin name, including prepared forms such as Chao, Zhi and Mi Zhi. VAT-exempt."),
    "minerals": ("Minerals", "cat-herbs.webp",
        "Traditional mineral substances used in Chinese herbal formulas, in 500 g packs. VAT-exempt."),
    "culinary-herbs": ("Culinary herbs", "cat-herbs.webp",
        "Goji berries, jujube dates, longan, dried mushrooms, beans and other food herbs for everyday cooking and soups. VAT-exempt."),
    "aura": ("Aura Supplements", "cat-aura.webp",
        "51 classical Chinese herbal formulas as plant-based food supplements, in bottles of 60 tablets. Made from concentrated "
        "extracts of authentic herbs, and vegan, gluten-free and made to GMP standards. Each product page gives the formula's traditional action "
        "and best-fit pattern. Choose formulas with a qualified practitioner."),
    "mycology": ("Mycology Nutrition", "cat-mycology.webp",
        "Ten organic functional mushrooms from Mycology Nutrition, as 90-capsule bottles, 60 g and 120 g powders, and three "
        "mushroom coffee blends. Grown on organic oats in California and tested for purity in certified US and German laboratories."),
    "needles": ("Acupuncture needles & supplies", "cat-acupuncture.webp",
        "Phoenix acupuncture needles in every common gauge and length, with or without guide tubes, plus 5-in-1 packs, "
        "detox needles, ear seeds, press tacks, magnets, dermal hammers and lancets."),
    "moxa": ("Moxibustion & plasters", "cat-physio.webp",
        "Pure and smokeless moxa rolls, sticks and cones, moxa kits, boxes and burners, loose moxa punk, and relief patches."),
    "ktape": ("Kinesiology tape & heat lamps", "cat-physio.webp",
        "Phoenix kinesiology tape in a range of colours, dispensers and scissors, and TDP infrared heat lamps and spare parts."),
    "herbal-hair": ("Herbal Hair", "cat-herbs.webp",
        "Botanical scalp care in a simple four-step routine: shampoo, cleanse, nourish and protect. Available as retail sizes and trade multi-packs."),
}

NAV = """  <header class="nav">
    <div class="wrap">
      <a class="brand" href="/"><img src="/img/logo.webp" alt="" /><span>Áille<small>Health Clinic</small></span></a>
      <nav class="nav-links" aria-label="Main">
        <a href="/range.html">Our range</a>
        <a href="/#practitioners">Trade accounts</a>
        <a href="/#resources">Resources</a>
        <a href="/#contact">Contact</a>
      </nav>
      <div class="nav-cta">
        <span id="navAccount" class="nav-cta"></span>
        <button class="menu-btn" aria-label="Menu"><span></span><span></span><span></span></button>
      </div>
    </div>
  </header>"""

FOOTER = """<footer class="footer">
    <div class="wrap">
      <span>© 2026 Áille Health Clinic · Wexford, Ireland · <a href="mailto:info@aillehealth.ie">info@aillehealth.ie</a> · <a href="tel:+353857486575">+353 85 748 6575</a></span>
      <span><a href="/range.html">Our range</a> · <a href="/delivery.html">Delivery &amp; returns</a> · <a href="/terms.html">Terms of sale</a> · <a href="/privacy.html">Privacy &amp; cookies</a> · <a href="/account.html">Practitioner login</a></span>
    </div>
  </footer>"""


def page(title, description, path, main, extra_head="", scripts="", og_image="/img/hero.webp"):
    url = SITE + path
    return f"""<!DOCTYPE html>
<html lang="en-IE">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{e(title)}</title>
  <meta name="description" content="{e(description)}" />
  <link rel="canonical" href="{url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Áille Health Clinic" />
  <meta property="og:title" content="{e(title)}" />
  <meta property="og:description" content="{e(description)}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{SITE}{og_image}" />
  <link rel="icon" href="/favicon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/site.css" />
{extra_head}</head>
<body>
{NAV}

  <main>
{main}
  </main>

  {FOOTER}
  <script type="module" src="/js/util.js"></script>
  <script type="module" src="/js/app.js"></script>
{scripts}</body>
</html>
"""


def ld(obj):
    return '  <script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False) + "</script>\n"


def crumbs(items):
    return ld({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u} for i, (n, u) in enumerate(items)]})


def write(rel, content):
    path = os.path.join(PUB, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    data = json.load(open(os.path.join(PUB, "data", "range.json"), encoding="utf-8"))
    desc = json.load(open(os.path.join(ROOT, "scripts", "descriptions.json"), encoding="utf-8"))
    by_cat = {}
    for p in data["products"]:
        by_cat.setdefault(p["cat"], []).append(p)
    urls = ["/", "/range.html", "/delivery.html", "/terms.html", "/privacy.html"]

    # ---- range pages ----
    for cid, (name, img, intro) in RANGES.items():
        prods = by_cat.get(cid, [])
        rows = "\n".join(
            f'        <a class="prod link" href="/products/{slug(p["code"])}.html"><div class="thumb">'
            + (f'<img src="/img/products/{e(p["code"])}.webp" alt="" loading="lazy" />' if p.get("img") else e(p["name"][0]))
            + f'</div><div><div class="name">{e(p["name"])}</div><div class="meta">{e(" · ".join(x for x in [p["code"], p["pack"]] if x))}</div></div>'
            + '<div class="buy"><span class="more">View →</span></div></a>'
            for p in prods)
        path = f"/range/{cid}.html"
        main_html = f"""    <div class="wrap" style="padding:28px 0 64px">
      <nav class="crumbs"><a href="/">Home</a> › <a href="/range.html">Our range</a> › {e(name)}</nav>
      <div class="range-hero">
        <div><p class="kicker">Our range</p><h1>{e(name)}</h1><p class="lead">{e(intro)}</p>
          <p style="margin-top:18px"><a class="btn" href="/account.html">Log in for trade prices</a> <a class="btn ghost" href="/account.html#apply">Apply for a trade account</a></p></div>
        <div class="range-img"><img src="/img/{img}" alt="{e(name)} from Áille Health Clinic" /></div>
      </div>
      <p class="result-count" style="margin:22px 0 10px">{len(prods)} products</p>
      <div class="prod-list">
{rows}
      </div>
    </div>"""
        head = crumbs([("Home", "/"), ("Our range", "/range.html"), (name, path)])
        write(path.lstrip("/"), page(f"{name} | Áille Health Clinic, Ireland", intro[:155], path, main_html, head, og_image=f"/img/{img}"))
        urls.append(path)

    # ---- product pages ----
    for cid, prods in by_cat.items():
        cname = RANGES[cid][0]
        for p in prods:
            code, name = p["code"], p["name"]
            path = f"/products/{slug(code)}.html"
            d = desc.get(code, "")
            size = f" ({p['pack']})" if p["pack"] else ""
            meta_desc = (d or f"{name}{size}, code {code}. Available to qualified practitioners from Áille Health Clinic, Wexford, Ireland.")[:158]
            img_html = (f'<img src="/img/products/{e(code)}.webp" alt="{e(name)}" />' if p.get("img")
                        else f'<div class="mono">{e(name[0])}</div>')
            siblings = [x for x in prods if x["code"] != code][:6]
            related = "".join(f'<li><a href="/products/{slug(x["code"])}.html">{e(x["name"])}</a></li>' for x in siblings)
            main_html = f"""    <div class="wrap" style="padding:28px 0 64px">
      <nav class="crumbs"><a href="/">Home</a> › <a href="/range.html">Our range</a> › <a href="/range/{cid}.html">{e(cname)}</a> › {e(name)}</nav>
      <article class="product" data-code="{e(code)}">
        <div class="product-img">{img_html}</div>
        <div>
          <p class="kicker">{e(cname)}</p>
          <h1>{e(name)}</h1>
          <dl class="spec"><dt>Code</dt><dd>{e(code)}</dd>{f'<dt>Pack</dt><dd>{e(p["pack"])}</dd>' if p["pack"] else ""}</dl>
          {f'<p class="lead">{e(d)}</p>' if d else ""}
          <div id="buyBox" class="buy-box">
            <p><b>Trade price available to approved practitioners.</b></p>
            <p style="margin-top:10px"><a class="btn" href="/account.html?next={path}">Log in for price</a> <a class="btn ghost" href="/account.html#apply">Apply for access</a></p>
          </div>
        </div>
      </article>
      {f'<h2 style="font-size:1.4rem;margin:40px 0 12px">More in {e(cname)}</h2><ul class="related">{related}</ul><p><a href="/range/{cid}.html">See all {e(cname).lower()} →</a></p>' if related else ""}
    </div>"""
            prod_ld = {"@context": "https://schema.org", "@type": "Product", "name": name, "sku": code, "category": cname,
                       "brand": {"@type": "Brand", "name": "Aura" if cid == "aura" else "Mycology Nutrition" if cid == "mycology" else "Phoenix" if "Phoenix" in name else "Áille Health Clinic"}}
            if d: prod_ld["description"] = d
            if p.get("img"): prod_ld["image"] = f"{SITE}/img/products/{code}.webp"
            head = ld(prod_ld) + crumbs([("Home", "/"), ("Our range", "/range.html"), (cname, f"/range/{cid}.html"), (name, path)])
            write(path.lstrip("/"), page(f"{name}{size} | {cname} | Áille Health Clinic", meta_desc, path, main_html, head,
                                         '  <script type="module" src="/js/product.js"></script>\n',
                                         og_image=f"/img/products/{code}.webp" if p.get("img") else "/img/hero.webp"))
            urls.append(path)

    # ---- legal pages ----
    band_rows = "".join(
        f'<tr><td>{"Up to" if i == 0 else f"{SHIPPING_BANDS[i-1][0]}.1 kg to"} {kg} kg</td><td class="n">€{eur:.2f}</td></tr>'
        for i, (kg, eur) in enumerate(SHIPPING_BANDS))
    for name in ["privacy", "terms", "delivery"]:
        src = open(os.path.join(ROOT, "scripts", "templates", f"{name}.html"), encoding="utf-8").read()
        title = re.search(r"<!--title: (.*?)-->", src).group(1)
        description = re.search(r"<!--description: (.*?)-->", src).group(1)
        body = re.sub(r"<!--(title|description):.*?-->\n?", "", src)
        body = body.replace("<!--updated-->", TODAY.strftime("%-d %B %Y")).replace("<!--shipping-rows-->", band_rows) \
                   .replace("<!--max-kg-->", str(SHIPPING_BANDS[-1][0]))
        main_html = f'    <div class="wrap legal"><p class="kicker">Áille Health Clinic</p><h1>{e(title)}</h1>\n{body}\n    </div>'
        write(f"{name}.html", page(f"{title} | Áille Health Clinic", description, f"/{name}.html", main_html))

    # ---- sitemap & robots ----
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f"  <url><loc>{SITE}{u}</loc><lastmod>{TODAY.isoformat()}</lastmod></url>" for u in urls]
    sm.append("</urlset>")
    write("sitemap.xml", "\n".join(sm) + "\n")
    write("robots.txt", "User-agent: *\n" + "".join(f"Disallow: {p}\n" for p in
          ["/admin.html", "/account.html", "/shop.html", "/orders.html", "/order-complete.html", "/thanks.html", "/api/"])
          + f"\nSitemap: {SITE}/sitemap.xml\n")

    # ---- refresh footer on hand-written pages ----
    for f in os.listdir(PUB):
        if f.endswith(".html"):
            path = os.path.join(PUB, f)
            s = open(path, encoding="utf-8").read()
            s2 = re.sub(r"<footer class=\"footer\">.*?</footer>", FOOTER, s, flags=re.S)
            if s2 != s:
                open(path, "w", encoding="utf-8").write(s2)

    print(f"{len(RANGES)} range pages, {sum(len(v) for v in by_cat.values())} product pages, {len(urls)} URLs in sitemap")


if __name__ == "__main__":
    main()
