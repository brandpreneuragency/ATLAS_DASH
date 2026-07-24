# Phase 7 security review

- PostgreSQL is bound to `127.0.0.1` only in the repository Compose artifact; no public database mapping is present.
- Database credentials and application secrets are environment inputs, not repository defaults. `.env.example` contains placeholders only.
- Backup scripts use custom format, checksums, restrictive permissions, no-password mode, and do not print connection strings.
- Restore requires a caller-supplied target, explicit `--confirm-empty`, and an empty-database check; it refuses the configured application database.
- HTTPS and reverse-proxy configuration are operator responsibilities and are documented in `RELEASE_CHECKLIST.md`; no domain or certificate is invented here.

## Unverified runtime items

No Docker services, live database, restore, firewall, reverse proxy, or public endpoint were started or inspected in this repository-only hardening pass.