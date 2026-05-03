# Pickup: SES email delivery (Render + staff portal test email)

Use this doc when you resume on another machine. It summarizes what we verified in the app and the **AWS / Render steps** to get messages into inboxes (not just accepted by SES).

---

## What we already know (from the app)

- The staff portal **Send test email** call succeeds at the API level: the backend returns a **SES `messageId`** (e.g. `010f019de95d54a0-...`).
- That means **Render has valid SES credentials** and SES **accepted** the send request.
- If you still do not see mail in the inbox, the problem is almost always one of:
  - SES **sandbox** (only verified recipients),
  - **From** identity not verified in the **same region** as `AWS_REGION`,
  - recipient on SES **suppression list**,
  - or **Google Workspace / spam / quarantine** filtering.

Related code paths:

- Backend: `admin-web/backend/routes/notifications.js` → `POST /api/notifications/test-email`
- Mail: `admin-web/backend/services/emailService.js` (SES first, SMTP fallback)
- Portal: `admin-web/src/components/UserSettings.tsx` → **Send Test Email** (shows provider + hints)

Longer AWS checklist already in repo: [AWS SES production access](./AWS_SES_PRODUCTION_ACCESS.md) and [Email go-live checklist](./EMAIL_GO_LIVE_CHECKLIST.md).

---

## Render environment variables (backend service)

Set on the **Render backend** service (not only the static web app):

| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` | IAM access key for SES |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `AWS_REGION` | Must match the SES region where identities live (e.g. `us-east-2`) |
| `EMAIL_FROM` | Must be a **verified** SES identity in that region (e.g. `noreply@oxfordhouse.org`) |
| `EMAIL_FROM_NAME` | Optional display name |
| `EMAIL_ENABLED` | Default `true`; set `false` only to hard-disable mail |

Optional SMTP fallback (only if you use SMTP instead of SES):

- `EMAIL_HOST` / `EMAIL_PORT`, `EMAIL_USER` / `EMAIL_PASS` (see `emailService.js`)

After any env change: **Redeploy** the backend on Render.

---

## IAM access key (new key on the other computer)

When creating a new access key in IAM:

1. Choose use case: **Application running outside AWS** (correct for Render + env vars).
2. Attach a policy that allows sending via SES API, minimally:
   - `ses:SendEmail`
   - `ses:SendRawEmail`
   - (Optional diagnostics) `ses:GetAccount`, `ses:GetAccountSendingEnabled`, `ses:ListIdentities`, `ses:GetIdentityVerificationAttributes` if you add stricter tooling later.

3. Put the new key/secret in Render → **Save** → redeploy.
4. **Deactivate and delete** the old access key in IAM once mail works.

**Security:** Never commit access keys to git. If a key was ever pasted in chat or a screenshot, **rotate** it and use only the new pair in Render.

---

## AWS SES console checklist (same region as `AWS_REGION`)

1. Open [SES console](https://console.aws.amazon.com/ses/) and set the region dropdown to **`AWS_REGION`** (e.g. **Ohio / us-east-2**).

2. **Account dashboard**
   - If status is **Sandbox**: either  
     - verify **each recipient** you test with, **or**  
     - request **production access** (see [AWS_SES_PRODUCTION_ACCESS.md](./AWS_SES_PRODUCTION_ACCESS.md)).

3. **Verified identities**
   - Verify **domain** `oxfordhouse.org` (recommended) **or** verify the single address `noreply@oxfordhouse.org`.
   - Status must be **Verified** before production sends.

4. **Suppression list**
   - Ensure the test recipient (e.g. `greg.weisz@oxfordhouse.org`) is **not** on the suppression list for bounces/complaints.

5. **Recipient mailbox**
   - Check **Spam**, **Quarantine** (Google Workspace admin), and allowlist rules for `EMAIL_FROM` / domain.

---

## Verify from the staff portal

1. Deploy backend + web (Vercel auto-deploy on `main` for `admin-web/` if configured).
2. Log in → **User Settings** → **Send Test Email**.
3. Read the full banner message (it stays visible longer and includes SES hints).
4. If you see `via SES` and a `messageId` but no inbox mail, focus on SES sandbox / identity / suppression / Workspace filtering per above.

---

## Repo session notes (for continuity)

Recent themes on `main` (high level):

- Multi-vehicle support (mobile SQLite + portal/backend vehicles API).
- GPS pause reminder (driving-speed detection + alert).
- Backend migration fix so Render boot does not fail on `vehicleId` index before column exists.
- Test-email UX: longer alert, diagnostics (`emailConfigStatus`, `deliveryHints`).

If `git status` is clean, everything in this workspace is already committed and pushed; pull `main` on the other machine.

---

## Quick command on the other machine

```bash
git pull origin main
```

Then open this file: `docs/deployment/SES_EMAIL_SETUP_PICKUP.md`.
