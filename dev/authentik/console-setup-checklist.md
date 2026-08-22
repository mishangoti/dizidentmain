# Authentik console setup checklist — DiziDental HMS

Use with local stack at http://localhost:9000 (image `2026.5.6`).

## Prerequisites

- [ ] Docker Compose stack healthy (`docker compose ps`)
- [ ] Initial admin created (`akadmin`) via http://localhost:9000/if/flow/initial-setup/
- [ ] Logged into Admin UI http://localhost:9000/if/admin/

## Automated path (preferred)

- [ ] Run `scripts/configure_hms.py` via `ak shell` (see README)
- [ ] Confirm discovery document opens:
  `http://localhost:9000/application/o/dizidental-hms/.well-known/openid-configuration`

## Manual path (if needed)

### Groups (Directory → Groups)

- [ ] `hms-superadmin` → maps to app role `SUPERADMIN`
- [ ] `hms-org` → `ORG`
- [ ] `hms-doctor` → `DOCTOR`
- [ ] `hms-service-provider` → `SERVICE_PROVIDER`
- [ ] `hms-patient` → `PATIENT`

### Scope mapping (Customization → Property Mappings → Scope Mapping)

- [ ] Name: `HMS role and mobile claims`
- [ ] Scope name: `hms`
- [ ] Expression returns dict with `hms_role` and `mobile` (see `scripts/configure_hms.py`)

### OAuth2 provider (Applications → Providers)

- [ ] Name: `DiziDental HMS OIDC`
- [ ] Client type: **Public**
- [ ] Client ID: `dizidental-hms-spa`
- [ ] Redirect URIs (strict):
  - `http://localhost:5173/auth/callback`
  - `http://127.0.0.1:5173/auth/callback`
- [ ] Auth flow: `default-authentication-flow`
- [ ] Authorization flow: `default-provider-authorization-implicit-consent`
- [ ] Include scopes: `openid`, `profile`, `email`, `offline_access`, `hms`

### Application (Applications → Applications)

- [ ] Name: `DiziDental HMS`
- [ ] Slug: `dizidental-hms`
- [ ] Provider: `DiziDental HMS OIDC`
- [ ] Launch URL: `http://localhost:5173/`

## Values for later app iterations (do not commit secrets)

| Key | Value |
|-----|--------|
| Issuer | `http://localhost:9000/application/o/dizidental-hms/` |
| JWKS | `http://localhost:9000/application/o/dizidental-hms/jwks/` |
| Client ID | `dizidental-hms-spa` |
| Client type | public (PKCE; no secret) |
| Scopes | `openid profile email offline_access hms` |

Copy into clinic env from [env/backend.env.example](./env/backend.env.example) and [env/frontend.env.example](./env/frontend.env.example).

## Out of scope for Iteration 1

- App Spring/React cutover
- User seed sync into Authentik
- SSO Sources (Google/Microsoft) — Iteration 6
