# Release checklist

This checklist is evidence-driven. Do not mark runtime items complete without logs from the target environment.

## Before release

- [ ] Production secrets are supplied by a secret manager; none are committed or printed.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, integration, and E2E gates pass.
- [ ] `pnpm verify:deployment` passes.
- [ ] A backup was created, checksum verified, and retained in protected storage.
- [ ] A restore test succeeded in an explicitly provisioned empty database (record target and timestamp without credentials).
- [ ] Drizzle migrations were reviewed; backup exists before migration; roll-forward/rollback plan is documented.

## Deployment

- [ ] Reverse proxy terminates HTTPS, redirects HTTP, and forwards only the application service.
- [ ] PostgreSQL remains private; `docker/compose.yaml` binds it to `127.0.0.1` and no firewall rule exposes it.
- [ ] Secure cookies, CSP, allowed origins, credentials-login configuration, and `APP_BASE_URL` match the operator-owned domain.
- [ ] Health endpoint and database health are green after deployment.

## Evidence

Record commands, UTC date, result, and log paths in `PROGRESS.md`. Never record URLs containing credentials, tokens, or keys.