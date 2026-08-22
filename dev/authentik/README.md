# Authentik Compose has moved

Canonical host (official GHCR image `2026.5.6`, Compose project name **`authentik`**, volume **`authentik_database`**):

`e:\Java Spring boot\DiziDental\authentik\dizidental-host`

From the DiziDental workspace:

```text
authentik/dizidental-host
```

Do **not** run `docker compose` in this folder. `compose.yml` was relocated so a second Docker project is not created.

```powershell
cd e:\Java Spring boot\DiziDental\authentik\dizidental-host
docker compose up -d
```

See that folder's README, checklists, and scripts. Local `.env` here is leftover only; the live `.env` is next to the new compose file.
