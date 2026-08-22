# Cutover + hardening runbook (U7)

## Auth modes

| Profile | Legacy cookie login | Authentik OIDC | Seed |
|---------|---------------------|----------------|------|
| `dev` | on | on (hybrid) | on |
| `prod` | **off** | **on** | **off** |

Rollback: set `app.auth.legacy-enabled=true` (and FE `VITE_LEGACY_AUTH_ENABLED=true`) without redeploying IdP.

## Cutover checklist (when approved)

1. All roles can sign in via Authentik (password and/or SSO Sources).
2. `/api/auth/me` works with Bearer for each role; `authentik_user_id` linked.
3. SPA uses Authentik only (`VITE_LEGACY_AUTH_ENABLED=false`, `VITE_AUTHENTIK_ENABLED=true`).
4. Backend `prod`: `app.auth.legacy-enabled=false`, `app.authentik.enabled=true`, `app.seed.enabled=false`.
5. CORS origins explicit HTTPS; `app.security.cookie-secure=true`.
6. Swagger off; actuator limited to health/info.
7. Authentik HTTPS, backups of Postgres volume, admin MFA recommended.
8. Confirm legacy `POST /api/auth/login` returns **410 Gone**.

## Authentik upgrade

1. Note current `AUTHENTIK_TAG` in `.env`.
2. Backup: `docker compose exec` Postgres dump of Authentik DB volume.
3. Pull new compose/tag from https://docs.goauthentik.io/compose.yml / release notes.
4. `docker compose pull && docker compose up -d`
5. Re-check discovery: `.../application/o/dizidental-hms/.well-known/openid-configuration`
6. Smoke: admin login, seed user login, SPA PKCE, `/api/auth/me`.

## Secrets

- Never commit `AUTHENTIK_TOKEN`, OAuth client secrets, DB passwords.
- Rotate Authentik API tokens and Google/Entra secrets on schedule.
