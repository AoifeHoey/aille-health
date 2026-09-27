# Áille Health Clinic website and trade shop

This folder replaces Shopify. It contains:

| Page | Who can see it | What it does |
|---|---|---|
| `index.html` | Everyone | Home page with the range, how trade accounts work, posters and guides, and the enquiry form |
| `range.html` | Everyone | Browse all 1,052 products by category or search. No prices are shown |
| `account.html` | Everyone | Log in, or apply for a trade account and upload a certificate |
| `shop.html` | Approved practitioners | Full pricelist (prices include VAT), basket and card checkout through Stripe |
| `admin.html` | info@aillehealth.ie only | Review applications, view certificates, approve or reject |

Prices are held privately on the server. They are only sent to approved practitioners, and supplier costs are never included.

## How the pieces fit together

- **Netlify** hosts the site, sends new-application and enquiry emails (Netlify Forms), and stores certificates and application details (Netlify Blobs).
- **Firebase** (your existing `aille-health-clinic` project) handles logins only.
- **Stripe** takes card payments, emails receipts, and lists every order with its delivery address.

---

## One-time setup (about 30 minutes)

### 1. Stripe
1. Sign up at https://dashboard.stripe.com/register (or log in), then activate the account with your business and bank details.
2. Go to **Developers → API keys** and copy the **Secret key** (it starts with `sk_live_`). For testing first, use the `sk_test_` key.
3. Go to **Settings → Notifications**, then turn on emails for **Successful payments**. This is how you'll hear about new orders.
4. Go to **Settings → Customer emails**, then turn on **Successful payments** so practitioners get a receipt.

### 2. Firebase (logins)
1. Open https://console.firebase.google.com, then the **aille-health-clinic** project.
2. Go to **Authentication → Sign-in method** and check that **Email/Password** is enabled.
3. Go to **Authentication → Settings → Authorised domains** and add `aillehealth.ie` and `www.aillehealth.ie`, plus your `*.netlify.app` address.

### 3. Netlify
1. Deploy this folder. If you use GitHub, make the repository **private**. Functions need a build, so drag-and-drop won't work. Use either option:
   - **GitHub (recommended):** put this folder in a GitHub repository, then in Netlify go to **Add new site → Import from Git**. Every future change then deploys automatically.
   - **Netlify CLI:** run `npm install`, then `npx netlify deploy --prod`.
2. Go to **Site configuration → Environment variables** and add:

| Variable | Example | Meaning |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` | Required for checkout |
| `SHIPPING_BANDS` | `5:7.50,10:14.50` | Postage by weight: up to 5 kg €7.50, up to 10 kg €14.50. Add bands as you work them out, e.g. `5:7.50,10:14.50,20:22` |
| `PACKAGING_G` | `250` | Grams added to every order for the box and padding (default 250) |
| `SHIP_TO` | `IE` | Countries you deliver to. Add later, e.g. `IE,GB` (GB covers Northern Ireland) |
| `ALLOW_COLLECTION` | `true` | Optional: adds a free "Collect in Wexford" option |
| `ADMIN_EMAILS` | `info@aillehealth.ie` | Who can use the admin page (comma-separated) |

3. Go to **Forms → Form notifications** and add email notifications for **practitioner-application** (new trade applications) and **order-enquiry**.
4. Point the domain from Blacknight to this Netlify site, if it isn't already.

### 4. Your admin login
1. Go to `/account.html` and log in as **info@aillehealth.ie**. If you don't have a login yet, sign up with that address.
2. Click **Verify email to unlock admin**, then click the link in the email you receive.
3. Log out and back in. You'll now see **Review applications**.

---

## Day to day

- **New application:** you get an email. Open `/admin.html`, view the certificate, then click **Approve**. An email to the practitioner opens ready to send.
- **New order:** Stripe emails you. The order's items, codes, quantities, delivery address and phone number are under **Payments** in the Stripe dashboard or app.
- **Refunds:** open the payment in Stripe and click **Refund**.

## Product weights (for postage)

Postage is worked out from the basket weight. Each product's weight is in `scripts/product_weights.csv`, which opens in Excel.

- Every weight is currently an **estimate** (for example 550 g for a 500 g bag of dry herbs, 130 g for a granule bottle, 8 kg for a dual-head heat lamp).
- To correct one, change the **Weight (g)** figure. Type `yes` in **Checked** once you've weighed it, so you know which ones are done.
- Orders over the top band (currently 10 kg) can't be checked out. The basket asks the customer to split the order or contact you.

After editing, run the build command below and redeploy.

## Updating prices or products

The shop is built from `scripts/Aille_Complete_Pricelist_2026.xlsx`. When the pricelist changes:

```
python scripts/build_catalogue.py path/to/new_pricelist.xlsx
```

Then redeploy. You can also ask Claude to do this.

To add a product photo, save it as `public/img/products/<CODE>.webp` (for example `WA01.webp`) and rebuild.

## Existing Firebase users

Practitioners who registered under the old system can log in with the same email and password. They'll be asked to re-upload their certificate once, and then you approve them as normal.
