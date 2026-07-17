---
name: tabs-vps-deploy
description: >
  DEPRECATED. TABS was renamed to ATLAS_DASH. Redirect all deploy requests
  to atlas-dash-vps-deploy. Triggers that still mention "tabs" should load
  .grok/skills/atlas-dash-vps-deploy/SKILL.md instead.
---

# DEPRECATED — use atlas-dash-vps-deploy

**TABS deploy identity is retired.** Canonical product is **ATLAS_DASH**.

| Old | New |
|-----|-----|
| Skill | `.grok/skills/atlas-dash-vps-deploy/SKILL.md` |
| Local | `C:\02_APPS\ATLAS_DASH` (not `C:\02_APPS\TABS`) |
| Host | `https://atlasdash.brandpreneur.net` |
| VPS | `/home/admin/atlas_dash/app` |
| Compose | `-p atlas_dash` |
| Containers | `atlas_dash_caddy`, `atlas_dash_api` |

**Action for the agent:** open and follow `atlas-dash-vps-deploy` for any
deploy / ship / VPS update request. Do not run the old `/home/admin/tabs`
pipeline unless the user explicitly asks for emergency rollback of the
legacy stack.
