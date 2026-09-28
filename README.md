# Áille Health Clinic website and trade shop

This folder replaces Shopify. It contains:

| Page | Who can see it | What it does |
|---|---|---|
| `index.html` | Everyone | Home page with the range, how trade accounts work, posters and guides, and the enquiry form |
| `range.html` | Everyone | Browse all 1,052 products by category or search. No prices are shown |
| `account.html` | Everyone | Log in, or apply for a trade account and upload a certificate |
| `shop.html` | Approved practitioners | Full pricelist (prices include VAT), basket and card checkout through Stripe |
| `admin.html` | info@aillehealth.ie only | **Orders** (print packing slips, mark packed or dispatched) and **Applications** (view certificates, approve or reject) |
| `orders.html` | Practitioners | Their order history, tracking, and "order these again" |
| `range/…`, `products/…` | Everyone | A page for every range and product, generated automatically for Google |
| `privacy.html`, `terms.html`, `delivery.html` | Everyone | Policy pages, generated from `scripts/templates/` |

Prices are held privately on the server. They are only sent to approved practitioners, and supplier costs are never included.

## How the pieces fit together

- **Netlify** hosts the site, sends new-application and enquiry emails (Netlify Forms), and stores certificates and application details (Netlify Blobs).
- **Firebase** (your existing `aille-health-clinic` project) handles logins only.
- **Stripe** takes card payments and tells the site when an order is paid.
- **Resend** sends the branded emails: approval, order confirmation, new-order alert and dispatch notice.
- When Netlify deploys, it runs `scripts/build_pages.py`, which builds the product, range and policy pages, `sitemap.xml` and `robots.txt`. Don't upload those generated files yourself.

---

## One-time setup (about 30 minutes)

### 1. Stripe
1. Sign up at https://dashboard.stripe.com/register (or log in), then activate the account with your business and bank details.
2. Go to **Developers → API keys** and copy the **Secret key** (it starts with `sk_live_`). For testing first, use the `sk_test_` key.
3. Go to **Settings → Notifications**, then turn on emails for **Successful payments**. This is a backup; the site also emails you about each new order.
4. Go to **Settings → Customer emails**, then turn on **Successful payments** so practitioners get a receipt.
5. **Webhook** (records orders even if a customer closes their browser after paying):
   1. In Stripe, go to **Developers → Webhooks → Add endpoint**.
   2. For the URL, enter `https://aillehealth.ie/api/stripe-webhook`.
   3. Choose the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
   4. Copy the **Signing secret** (it starts with `whsec_`) into Netlify as `STRIPE_WEBHOOK_SECRET`.

### 1b. Resend (automatic emails)
1. Sign up free at https://resend.com. The free plan allows 3,000 emails a month and 100 a day.
2. Go to **Domains → Add domain** and enter `aillehealth.ie`.
3. Resend shows a few DNS records (DKIM, SPF and MX, usually for a `send.` subdomain). Add them at **Blacknight** under DNS management. They don't affect your Microsoft 365 email.
4. When the domain shows **Verified**, go to **API Keys → Create** and copy the key into Netlify as `RESEND_API_KEY`.

Until this is set up, the site still works. Approval and dispatch emails fall back to opening a ready-written email in Outlook, and order confirmations come from Stripe's receipt.

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
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | From the Stripe webhook (see 1.5) |
| `RESEND_API_KEY` | `re_…` | Turns on automatic emails |
| `EMAIL_FROM` | `Áille Health Clinic <info@aillehealth.ie>` | Optional: the sender name and address |
| `ADMIN_NOTIFY_EMAIL` | `info@aillehealth.ie` | Optional: where new-order alerts go |

3. Go to **Forms → Form notifications** and add email notifications for **practitioner-application** (new trade applications) and **order-enquiry**.
4. Point the domain from Blacknight to this Netlify site, if it isn't already.

### 4. Your admin login
1. Go to `/account.html` and log in as **info@aillehealth.ie**. If you don't have a login yet, sign up with that address.
2. Click **Verify email to unlock admin**, then click the link in the email you receive.
3. Log out and back in. You'll now see **Review applications**.

---

## Day to day

- **New application:** you get an email. Open `/admin.html`, view the certificate, then click **Approve**. An email to the practitioner opens ready to send.
- **New order:** you get an email. Open `/admin.html`, where the order is under **To pack** with items, codes, quantities, address and phone.
   1. Click **Print packing slip**.
   2. Pick the items and click **Mark packed**.
   3. When it has gone to the courier, click **Mark dispatched** and add the tracking number if there is one. The practitioner is emailed automatically.
- **Refunds:** open the payment in Stripe and click **Refund**.

## Product weights (for postage)

Postage is worked out from the basket weight. Each product's weight is in `scripts/Product_Weights.xlsx`.

- **Red rows** are guesses. The pricelist gives no size for these, so please weigh them first.
- **Yellow rows** are estimates based on the pack size (for example 550 g for a 500 g bag).
- To correct a weight, change **Weight (g)**, then choose **yes** under **Checked** so the row stops being highlighted.
- When logged in as admin, the shop shows each product's postage weight so you can spot-check as you browse.
- Orders over the top band (currently 10 kg) can't be checked out. The basket asks the customer to split the order or contact you.

After editing, send the file to Claude, or run the build command below and upload the changed files to GitHub.

## Updating prices or products

The shop is built from `scripts/Aille_Complete_Pricelist_2026.xlsx`. When the pricelist changes:

```
python scripts/build_catalogue.py path/to/new_pricelist.xlsx
```

Then redeploy. You can also ask Claude to do this.

To add a product photo, save it as `public/img/products/<CODE>.webp` (for example `WA01.webp`) and rebuild.

## Policy pages

The Privacy policy, Terms of sale and Delivery & returns pages are drafts, written in `scripts/templates/privacy.html`, `terms.html` and `delivery.html`.

- Anything highlighted in yellow on the site, such as `[business address]` or `[14 days]`, is a placeholder for you to fill in or delete.
- These are a sensible starting point, not legal advice. It's worth having them checked, especially the returns policy for clinical products.
- If you change the postage bands in Netlify, also change `SHIPPING_BANDS` at the top of `scripts/build_pages.py`, so the Delivery page matches.

## Product descriptions

Product pages show a description when there's one in `scripts/descriptions.json` (keyed by product code). At the moment that covers Aura, Mycology Nutrition and Herbal Hair, taken from your promo guides. Add more at any time.

## Existing Firebase users

Practitioners who registered under the old system can log in with the same email and password. They'll be asked to re-upload their certificate once, and then you approve them as normal.
