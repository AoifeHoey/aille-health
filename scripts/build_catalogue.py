"""
Rebuild the shop catalogue from the Áille Complete Pricelist.

Usage:  python scripts/build_catalogue.py [path/to/Aille_Complete_Pricelist_2026.xlsx]

Writes two files:
  netlify/functions/_data/catalogue.json  -> PRIVATE: codes + prices (only served to approved practitioners)
  public/data/range.json                  -> PUBLIC: codes + names + packs, NO prices

Supplier £ prices and wholesale costs are never copied out of the workbook.
"""
import csv, json, os, re, sys
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "scripts", "Aille_Complete_Pricelist_2026.xlsx")

# Sheet name -> (category id, public blurb)
CATEGORIES = {
    "Dry Herbs": ("dry-herbs", "Single dried herbs for traditional decoctions, 500g packs."),
    "Granules": ("granules", "Concentrated single-herb granules for dispensing, 100g packs."),
    "Minerals": ("minerals", "Traditional mineral substances used in formula preparation."),
    "Culinary Herbs": ("culinary-herbs", "Goji, jujube, longan and other food herbs for everyday use."),
    "Aura Supplements": ("aura", "51 classical formulas in convenient 60-tablet bottles."),
    "Mycology": ("mycology", "Organic functional mushroom capsules, powders and coffee blends."),
    "Acupuncture Needles": ("needles", "Phoenix and Magrain needles, ear seeds, press tacks and clinic supplies."),
    "Moxibustion & Plasters": ("moxa", "Moxa rolls, cones, kits, boxes and accessories."),
    "K Tape & Heat Lamps": ("ktape", "Kinesiology tape and TDP heat lamps."),
    "Herbal Hair": ("herbal-hair", "Botanical scalp-care shampoos and tonics."),
}

# Product photos carried over from the old Shopify store (file stem -> product code)
IMAGES = {
    "Ba_Zhen_Yi_Mu_Tang": "WA02", "Ban_Xia_Hou_Pu_Tang": "WA03", "Bi_Yan_Pian": "WA04",
    "Bu_Zhong_Yi_Qi_Wan": "WA05", "Chai_Hu_Shu_Gan_San": "WA06", "Dang_Gui_Shao_Yao_San": "WA08",
    "Du_Huo_Ji_Sheng_Tang": "WA09", "Mai_Men_Dong_Tang": "WA25", "Shi_Du_Qing_Pian": "WA34",
    "Yao_Tong_Pian": "WA48", "Agaricus_Mushroom_Capsules": "WM010", "Chaga_Mushroom_Capsules": "WM020",
    "Hericium_Mushroom_Capsules": "WM050", "Reishi_Mushroom_Capsules": "WM080",
    "Shiitake_Mushroom_Capsules": "WM090", "Focus_Mushroom_Coffee": "WM620",
}


WEIGHTS_XLSX = os.path.join(ROOT, "scripts", "Product_Weights.xlsx")
WEIGHTS_CSV = os.path.join(ROOT, "scripts", "product_weights.csv")  # older format, read once then replaced


def estimate_grams(cid, code, name, pack):
    """First-guess shipping weight (product + its own packaging) in grams. Check and correct in the CSV."""
    n, pk = name.lower(), (pack or "").lower()
    m = re.search(r"(\d+(?:\.\d+)?)\s*(kg|g)\b", n + " " + pk)
    if cid == "dry-herbs": return 550
    if cid == "granules": return 130
    if cid == "minerals": return 550
    if cid == "culinary-herbs":
        if m: return int(float(m.group(1)) * (1000 if m.group(2) == "kg" else 1) * 1.1) + 20
        return 270
    if cid == "aura": return 120
    if cid == "mycology":
        if "capsule" in n: return 150
        if "coffee" in n: return 100
        if "120g" in n: return 180
        return 100
    if cid == "needles":
        if "500 / box" in pk: return 400
        if "200 / box" in pk: return 200
        if "/ box" in pk: return 120
        return 60
    if cid == "moxa":
        table = {"MM218": 500, "MM222": 500, "CA245": 300, "MM217": 100, "CA244": 150, "CA247": 800, "MM210": 250,
                 "MM211": 250, "MM212": 100, "MM214": 150, "MM213": 150, "MM221": 150, "MM216": 300, "MM215": 400,
                 "MM219": 100, "MM220": 100, "CA246": 150, "MP010": 200, "MP020": 50, "MP030": 50}
        return table.get(code, 200)
    if cid == "ktape":
        table = {"MT37": 150, "MT38": 50, "CE010": 5000, "CE012": 1000, "CE012D": 1000, "CE014": 1500,
                 "CE023": 8000, "CE024": 8000}
        return table.get(code, 60)
    if cid == "herbal-hair":
        table = {"MO080": 180, "MO090": 180, "MO100": 180, "MO110": 450, "MO120": 450, "MO130": 450, "MO140": 280,
                 "MO150": 100, "W/MO080": 1800, "W/MO090": 1800, "W/MO100": 1800, "W/MO110": 2700, "W/MO120": 2700,
                 "W/MO130": 2700, "W/MO140": 6500}
        return table.get(code, 200)
    return 200


def basis(cid, name, pack):
    """Plain-English note on where an estimate came from, so it's easy to see which ones need weighing."""
    if pack and re.search(r"\d+\s*(kg|g)\b", pack.lower()):
        return f"Pack size {pack} + packaging"
    if re.search(r"\d+(?:\.\d+)?\s*(kg|g|ml)\b", name.lower()):
        return "Size taken from product name + packaging"
    if pack:
        return f"Typical weight for '{pack}'"
    return "GUESS - no size in pricelist, please weigh"


def load_weights():
    if os.path.exists(WEIGHTS_XLSX):
        ws = openpyxl.load_workbook(WEIGHTS_XLSX, data_only=True).active
        head = [str(c.value or "").strip() for c in ws[1]]
        ci, wi, ki = head.index("Code"), head.index("Weight (g)"), head.index("Checked")
        out = {}
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row[ci]:
                continue
            try:
                out[str(row[ci]).strip()] = (int(float(row[wi])), str(row[ki] or "").strip())
            except (TypeError, ValueError):
                pass
        return out
    if not os.path.exists(WEIGHTS_CSV):
        return {}
    with open(WEIGHTS_CSV, encoding="utf-8-sig", newline="") as f:
        out = {}
        for r in csv.DictReader(f):
            try: out[r["Code"].strip()] = (int(float(r["Weight (g)"])), r.get("Checked", "").strip())
            except (KeyError, ValueError): pass
        return out


def cents(v):
    return int(round(float(v) * 100))


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    img_dir = os.path.join(ROOT, "public", "img", "products")
    have_img = {os.path.splitext(f)[0] for f in os.listdir(img_dir)} if os.path.isdir(img_dir) else set()

    weights = load_weights()
    weight_rows = []
    private, public, cats = [], [], []
    seen = set()
    for sheet, (cid, blurb) in CATEGORIES.items():
        ws = wb[sheet]
        count = 0
        for row in ws.iter_rows(min_row=5, values_only=True):
            if not row or not row[0]:
                continue
            code, name, pack = str(row[0]).strip(), str(row[1]).strip(), row[2]
            ex_vat, vat, inc_vat = row[5], row[6], row[7]
            if not isinstance(inc_vat, (int, float)):
                continue
            if code in seen:
                raise SystemExit(f"Duplicate product code {code} in {sheet}")
            seen.add(code)
            pack = str(pack).strip() if pack not in (None, "") else ""
            name = re.sub(r"\s+", " ", name)
            image = code if code in have_img else None
            grams, checked = weights.get(code) or (estimate_grams(cid, code, name, pack), "")
            weight_rows.append({"Code": code, "Product": name, "Pack": pack, "Category": sheet,
                                "Weight (g)": grams, "Checked": checked,
                                "How estimated": "" if checked else basis(cid, name, pack)})
            private.append({
                "code": code, "name": name, "pack": pack, "cat": cid,
                "price": cents(inc_vat),          # what the practitioner pays, € cents incl. VAT
                "vat": float(vat or 0),
                "g": grams,                        # shipping weight in grams
                **({"img": True} if image else {}),
            })
            public.append({"code": code, "name": name, "pack": pack, "cat": cid, "img": image})
            count += 1
        cats.append({"id": cid, "name": sheet, "blurb": blurb, "count": count})

    os.makedirs(os.path.join(ROOT, "netlify", "functions", "_data"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "public", "data"), exist_ok=True)
    with open(os.path.join(ROOT, "netlify", "functions", "_data", "catalogue.json"), "w", encoding="utf-8") as f:
        json.dump({"source": os.path.basename(SRC), "categories": cats, "products": private}, f, ensure_ascii=False)
    with open(os.path.join(ROOT, "public", "data", "range.json"), "w", encoding="utf-8") as f:
        json.dump({"categories": cats, "products": public}, f, ensure_ascii=False)
    # Rewrite the weights workbook so new products appear in it (existing weights are kept).
    from openpyxl.styles import Font, PatternFill
    from openpyxl.worksheet.datavalidation import DataValidation
    wb_out = openpyxl.Workbook()
    ws_out = wb_out.active
    ws_out.title = "Weights"
    cols = ["Code", "Product", "Pack", "Category", "Weight (g)", "Checked", "How estimated"]
    ws_out.append(cols)
    for c in ws_out[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="5F6D35")
    guess = PatternFill("solid", fgColor="F8D7C8")
    est = PatternFill("solid", fgColor="FFF2CC")
    for r in weight_rows:
        ws_out.append([r[k] for k in cols])
        if not r["Checked"]:
            fill = guess if r["How estimated"].startswith("GUESS") else est
            for c in ws_out[ws_out.max_row]:
                c.fill = fill
    for col, width in zip("ABCDEFG", [12, 60, 14, 22, 12, 10, 44]):
        ws_out.column_dimensions[col].width = width
    ws_out.freeze_panes = "A2"
    ws_out.auto_filter.ref = ws_out.dimensions
    dv = DataValidation(type="list", formula1='"yes"', allow_blank=True)
    ws_out.add_data_validation(dv)
    dv.add(f"F2:F{ws_out.max_row}")
    wb_out.save(WEIGHTS_XLSX)
    if os.path.exists(WEIGHTS_CSV):
        os.remove(WEIGHTS_CSV)
    unchecked = sum(1 for r in weight_rows if not r["Checked"])
    print(f"Weights: {len(weight_rows) - unchecked} checked, {unchecked} still estimated (see scripts/Product_Weights.xlsx)")
    print(f"{len(private)} products in {len(cats)} categories from {os.path.basename(SRC)}")


if __name__ == "__main__":
    main()
