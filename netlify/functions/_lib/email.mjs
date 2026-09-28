// Branded emails sent through Resend (https://resend.com). If RESEND_API_KEY isn't set,
// emails are skipped quietly and the site keeps working.
const FROM = process.env.EMAIL_FROM || "Áille Health Clinic <info@aillehealth.ie>";
export const ADMIN_NOTIFY = process.env.ADMIN_NOTIFY_EMAIL || "info@aillehealth.ie";
export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const euro = (cents) => "€" + (cents / 100).toFixed(2);

export async function sendEmail({ to, subject, html, replyTo = ADMIN_NOTIFY }) {
  if (!emailEnabled()) return { skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html, reply_to: replyTo }),
    });
    if (!res.ok) {
      console.error("Email failed", res.status, await res.text());
      return { error: true };
    }
    return { sent: true };
  } catch (err) {
    console.error("Email failed", err);
    return { error: true };
  }
}

/** Wraps content in the Áille email layout (inline styles for email clients). */
export function layout(title, body, siteUrl = "https://aillehealth.ie") {
  return `<!doctype html><html><body style="margin:0;background:#f7f3ec;font-family:Helvetica,Arial,sans-serif;color:#2c3124">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffdf9;border-radius:14px;overflow:hidden">
<tr><td style="background:#5f6d35;padding:20px 28px;color:#fff">
  <div style="font-family:Georgia,serif;font-size:22px">Áille Health Clinic</div>
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Practitioner supply · Wexford</div>
</td></tr>
<tr><td style="padding:28px">
  <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;margin:0 0 16px">${esc(title)}</h1>
  ${body}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #eee;font-size:12px;color:#8a8c7c">
  Áille Health Clinic · Wexford, Ireland · <a href="mailto:info@aillehealth.ie" style="color:#5f6d35">info@aillehealth.ie</a> · +353 85 748 6575<br/>
  <a href="${siteUrl}" style="color:#5f6d35">${siteUrl.replace(/^https?:\/\//, "")}</a>
</td></tr></table></td></tr></table></body></html>`;
}

export const p = (html) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${html}</p>`;
export const button = (href, label) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#5f6d35;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">${esc(label)}</a></p>`;

/** Table of order lines + totals, used in several emails. */
export function orderTable(order) {
  const rows = order.items.map((i) => `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${esc(i.name)}<br/><span style="color:#8a8c7c;font-size:12px">${esc(i.code)}</span></td>
    <td style="padding:8px;border-bottom:1px solid #eee;font-size:14px;text-align:center">${i.qty}</td>
    <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right">${euro(i.total)}</td></tr>`).join("");
  const tot = (label, v, bold) => `<tr><td colspan="2" style="padding:6px 0;font-size:14px;${bold ? "font-weight:bold" : "color:#5b614f"}">${label}</td><td style="padding:6px 0;text-align:right;font-size:14px;${bold ? "font-weight:bold" : ""}">${euro(v)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 18px">
    <tr><th align="left" style="font-size:12px;color:#8a8c7c;padding-bottom:6px">Item</th><th style="font-size:12px;color:#8a8c7c">Qty</th><th align="right" style="font-size:12px;color:#8a8c7c">Total</th></tr>
    ${rows}${tot("Subtotal", order.subtotal)}${tot(esc(order.shippingName || "Postage & packing"), order.shipping)}${tot("Total paid (incl. VAT)", order.total, true)}
  </table>`;
}

export const addressHtml = (a) => a ? esc([a.name, a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join("\n")).replace(/\n/g, "<br/>") : "";
