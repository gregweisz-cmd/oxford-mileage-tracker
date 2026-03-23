# Email Go-Live Checklist (Render + AWS SES)

Use this checklist to enable and validate backend email notifications.

## A) AWS SES (One-time)

1. Open AWS SES in your target region (recommended: `us-east-2`).
2. Confirm account is out of sandbox (or request production access).
3. Verify sender identity:
   - Preferred: verified domain (e.g. `oxfordhouse.org`)
   - Minimum: verified sender email (e.g. `noreply@oxfordhouse.org`)
4. Confirm the exact sender you will use for `EMAIL_FROM` is verified.

## B) Render Environment Variables (Backend)

Set these in your backend service environment:

```env
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-2
EMAIL_FROM=noreply@oxfordhouse.org
EMAIL_FROM_NAME=Oxford House Expense Tracker
EMAIL_ENABLED=true
```

If you use a different sender address, make sure that exact sender/domain is verified in SES.

## C) Re-enable Email in Backend Code

In `admin-web/backend/services/emailService.js`, change:

```js
const EMAIL_ENABLED = false;
```

to:

```js
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';
```

Deploy/restart backend after this change.

## D) Quick Verification Commands

From repo root:

1) Config test (no send):

```bash
cd admin-web/backend
node scripts/test/test-email-config.js
```

2) Send test email via API:

```bash
API_BASE_URL=https://YOUR_BACKEND_URL TEST_EMAIL=you@oxfordhouse.org node scripts/test/test-email.js
```

or:

```bash
node scripts/test/test-email.js you@oxfordhouse.org
```

## E) Direct API Smoke Test (Optional)

```bash
curl -X POST https://YOUR_BACKEND_URL/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"you@oxfordhouse.org"}'
```

Expected response includes:
- `success: true`
- `messageId`

## F) End-to-End Workflow Validation

1. Staff submits a report -> supervisor should receive email.
2. Supervisor approves/rejects/requests revision -> staff should receive email.
3. Validate links/content in each message and check spam folder.

## G) Common Failure Fixes

- `"Email is disabled"`  
  - Ensure `EMAIL_ENABLED=true` and code is env-driven (not hardcoded `false`).
- `MessageRejected` / identity errors  
  - Verify sender identity and sandbox status in SES.
- Credential errors  
  - Recheck `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
- Region mismatch  
  - SES identity and backend `AWS_REGION` must match.

## Reference

- `docs/deployment/AWS_SES_PRODUCTION_ACCESS.md`
- `admin-web/backend/services/emailService.js`
- `admin-web/backend/routes/utility.js` (`POST /api/test-email`)
- `admin-web/backend/scripts/test/test-email-config.js`
- `admin-web/backend/scripts/test/test-email.js`
