# AWS SES: Long-Term Fix for Email (Production Access)

Use this checklist to move off SES sandbox so you can send to any recipient (e.g. any `@oxfordhouse.org` address) without verifying each one, and avoid "Maximum sending rate exceeded" and "Email address is not verified" errors.

---

## 1. Request production access in SES

1. Open **[AWS SES Console](https://console.aws.amazon.com/ses/)** and select the **same region** your app uses (e.g. **US-EAST-2** from your error logs).
2. In the left sidebar, go to **Account dashboard** (or **Sending statistics**).
3. If you see **Sandbox** status, click **Request production access** (or **Get set up** → **Request production access**).
4. Fill out the form:
   - **Mail type:** Choose **Transactional** (alerts, reports, notifications) or **Promotional** as appropriate; for expense/approval emails, **Transactional** is typical.
   - **Website URL:** Your app URL (e.g. `https://oxford-mileage-tracker.vercel.app` or your Render backend URL).
   - **Use case description:** e.g. "Transactional email for expense report notifications and approval workflow. Recipients are employees with @oxfordhouse.org addresses. We send reminders, approval requests, and report links. Volume: low (tens to hundreds per day)."
   - **Compliance:** Confirm you have a process for bounces/complaints and that you only send to users who expect mail.
5. Submit. AWS usually reviews within **24–48 hours**. You may get an email asking for more detail; reply with use case and volume.

After approval, your account is no longer in sandbox: you can send to **any** address; you only need the **sender** (From) identity verified.

---

## 2. Keep your sending identity verified

You must verify **who is sending** (domain or email):

- **Option A – Verify a domain (recommended):** e.g. `oxfordhouse.org`
  - SES → **Verified identities** → **Create identity** → **Domain**.
  - Enter the domain. Add the DNS records (CNAME/TXT) SES shows you to your DNS host (e.g. Route 53, GoDaddy, Cloudflare).
  - After DNS propagates, SES marks the domain verified. You can then use any address at that domain as **From** (e.g. `noreply@oxfordhouse.org`).

- **Option B – Verify a single email (simpler, less flexible):** e.g. `noreply@oxfordhouse.org`
  - SES → **Verified identities** → **Create identity** → **Email address**.
  - Enter the address, then click the verification link AWS sends to that inbox.

Your backend should send **From** an address on the verified domain (or the verified email). Check your app config (e.g. `EMAIL_FROM`, `MAIL_FROM`, or your `emailService`/SMTP settings) and set it to a verified identity.

---

## 3. After production access

- **Recipients:** No need to verify each recipient; you can send to any `@oxfordhouse.org` (or any) address.
- **Rate:** Your sending rate will be higher (AWS will show the new limit in the SES console). If you still hit "Maximum sending rate exceeded," add rate limiting or a queue in the app (e.g. one email per second) until you request a further increase.
- **Region:** Keep using the same region (e.g. US-EAST-2) in your app that you used to request production access and where the identity is verified.

---

## 4. Quick reference

| Step | Action |
|------|--------|
| 1 | SES → Account dashboard → Request production access (correct region). |
| 2 | Verify a **domain** (e.g. oxfordhouse.org) or **email** for the **From** address. |
| 3 | Set app **From** address to a verified identity. |
| 4 | After approval, send to any recipient; no per-address verification. |

If you want, we can add a small rate limit or queue in the backend to avoid throttling even after production access.
