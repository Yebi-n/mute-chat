# Mute Service Introduction

Public, login-free service introduction page for business and PG review.

Public routes:

- `/` service introduction
- `/privacy/` privacy policy
- `/account-deletion/` account deletion request guide

This page intentionally contains no account or adult-verification controls. Deploy this directory as a separate static project from `web/operations-policy`.

## Vercel

```powershell
cd C:\Users\trudy\mute-chat\web\service-introduction
npx vercel@latest --prod
```

Use the resulting HTTPS root URL as the service URL in PG applications.
