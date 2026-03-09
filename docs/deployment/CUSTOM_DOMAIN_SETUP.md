# Custom domain: oxford-house-expenses.org

This guide walks through setting up **oxford-house-expenses.org** for the web portal (frontend on Vercel). The backend CORS already allows this domain.

---

## 1. Register the domain

1. Choose a registrar (e.g. [Namecheap](https://www.namecheap.com), [Cloudflare](https://www.cloudflare.com/products/registrar/), [Google Domains](https://domains.google), [Porkbun](https://porkbun.com)).
2. Search for **oxford-house-expenses.org** and complete purchase.
3. You will manage DNS at the registrar (or, if you use Cloudflare, you can move nameservers there and manage DNS in Cloudflare).

---

## 2. Add the domain in Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) and select the project that deploys the **admin-web** frontend (e.g. `oxford-house-mileage-tracker`).
2. Go to **Settings → Domains**.
3. Click **Add** and enter:
   - **oxford-house-expenses.org**
   - Optionally **www.oxford-house-expenses.org** if you want both.
4. Vercel will show the DNS records you need to add (e.g. **A** or **CNAME**). Leave this tab open.

---

## 3. Configure DNS at your registrar

In your domain’s DNS settings, add the records Vercel shows. Typical setup:

| Type  | Name | Value                    |
|-------|------|--------------------------|
| **A** | `@`  | `76.76.21.21`            |
| **CNAME** | `www` | `cname.vercel-dns.com` |

(Use the exact values Vercel shows for your project; the above are common for Vercel.)

- **Root domain (oxford-house-expenses.org):** Usually an **A** record pointing to Vercel’s IP, or a CNAME to `cname.vercel-dns.com` if your registrar supports CNAME flattening.
- **www:** Usually a **CNAME** for `www` → `cname.vercel-dns.com`.

Save the DNS changes. Propagation can take from a few minutes up to 48 hours.

---

## 4. SSL

Vercel will issue an SSL certificate for **oxford-house-expenses.org** (and **www** if added) automatically once DNS is correct. No extra steps needed.

---

## 5. Backend (Render) – already done in repo

The backend **CORS** config in this repo already allows:

- `https://oxford-house-expenses.org`
- `https://www.oxford-house-expenses.org`

So once the domain is live on Vercel, the existing backend at `https://oxford-mileage-backend.onrender.com` will accept requests from the new domain. No backend config change is required unless you add a custom domain for the API (e.g. **api.oxford-house-expenses.org** on Render).

---

## 6. Optional: custom domain for the API

If you want the API at **api.oxford-house-expenses.org** instead of `oxford-mileage-backend.onrender.com`:

1. **Render:** Service → **Settings → Custom Domain** → add **api.oxford-house-expenses.org** and follow Render’s DNS instructions.
2. **Vercel:** In the same project, **Settings → Environment Variables** → set **REACT_APP_API_URL** to `https://api.oxford-house-expenses.org` for **Production** (and Preview if desired).
3. Redeploy the frontend so the new env is used.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Register **oxford-house-expenses.org** at a registrar. |
| 2 | In Vercel: add **oxford-house-expenses.org** (and optionally **www**) under **Settings → Domains**. |
| 3 | At the registrar, add the A/CNAME records Vercel provides. |
| 4 | Wait for DNS to propagate; Vercel will enable SSL automatically. |
| 5 | Backend CORS is already configured in the repo; deploy backend if you haven’t so the new origins are active. |

After that, the web portal will be available at **https://oxford-house-expenses.org** (and **https://www.oxford-house-expenses.org** if you added it).
