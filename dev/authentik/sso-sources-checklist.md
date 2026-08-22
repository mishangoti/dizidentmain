# Authentik SSO Sources checklist (Google + Microsoft)

Do **not** commit client secrets. Configure in Authentik Admin or pass via local `.env` for the optional script.

Official docs:

- [Google Cloud OAuth](https://docs.goauthentik.io/users-sources/sources/social-logins/google/cloud/)
- [Entra ID OAuth](https://docs.goauthentik.io/users-sources/sources/social-logins/entra-id/oauth/)

## A. Google OAuth Source

1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application).
2. Authorized redirect URI (slug must match Authentik source slug, default `google`):

   `http://localhost:9000/source/oauth/callback/google/`

3. Authentik Admin → Directory → **Federation and Social login** → New Source → **Google OAuth Source**
   - Name: `Google`
   - Slug: `google`
   - Consumer key / secret: from Google
4. Add the source to the **default authentication / identification** stage so it appears on Authentik login (see Authentik “Add sources to default login page”).

## B. Microsoft Entra ID OAuth Source

1. Entra portal → App registrations → New registration (Web).
2. Redirect URI (slug default `entra-id` or `microsoft` — must match Authentik slug):

   `http://localhost:9000/source/oauth/callback/entra-id/`

3. Create a client secret; note Application (client) ID and Directory (tenant) ID.
4. Authentik → New Source → **Entra ID OAuth Source**
   - Slug: `entra-id` (or `microsoft` if you prefer; keep FE env in sync)
   - Consumer key: Application (client) ID
   - Consumer secret: client secret value
   - Single-tenant URLs use `https://login.microsoftonline.com/<tenant_id>/oauth2/v2.0/...`
5. Add source to the same identification stage as Google.

## C. Account linking / HMS readiness

1. Seed/sync HMS users first (U3): mobile + `hms-*` group + `attributes.mobile`.
2. In Authentik, link the Google/Entra identity to that user (or enroll then set mobile + group).
3. Confirm OIDC login still returns claims `hms_role` and `mobile` (scope `hms`).
4. SPA: **Sign in with Google/Microsoft** → Authentik → callback → `/api/auth/me`.

## D. Optional API script

If `AUTHENTIK_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (and/or Entra vars) are set in `dev/authentik/.env`:

```powershell
cd dizidentmain/dev/authentik
.\scripts\configure-sso-sources.ps1
```

Still add the source to the login flow in the Admin UI after the script runs.
