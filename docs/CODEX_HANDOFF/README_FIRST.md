# CODEX HANDOFF PACKAGE — TABS Web on VPS as Hermes Client

One file per phase. Each file is **fully self-contained** — paste the whole file
as a single Codex prompt (or run `codex "$(cat docs/CODEX_HANDOFF/NN_*.md)"`).
Run phases strictly in order (exception: 07 and 08 may run in parallel after 06).

Canonical spec: `docs/superpowers/plans/2026-07-16-tabs-vps-hermes-client.md`
Constraints:     `docs/MASTER_PLAN.md` · Progress: `docs/PROGRESS.md`

## Model per phase

Legend: **MAX** = gpt-5.1-codex-max · **STD** = gpt-5.1-codex · **MINI** = gpt-5.1-codex-mini.
If a newer flagship Codex model exists, substitute it for MAX.

| File | Phase | Model | Reasoning | Why |
|------|-------|-------|-----------|-----|
| 00 | Commit & push | MINI | low | trivial git |
| 01 | VPS teardown (destructive) | STD | medium | precision ops, zero creativity |
| 02 | tabs_api server | MAX | high | security-sensitive path handling |
| 03 | Deploy assets | STD | medium | verbatim file creation |
| 04 | VPS install | STD | medium | ops + one user question |
| 05 | Hermes token | MAX | high | one-shot risky ops on live agent host |
| 06 | Services + WS protocol extraction | MAX | **xhigh** | reverse-engineering; errors poison 08/09 |
| 07 | RemoteFolderConnector | MAX | high | must not regress Tauri Doc Mode |
| 08 | CHAT mode | MAX | high | largest UI surface, store rewiring |
| 09 | Approvals inbox | MAX | high | protocol correctness, app-wide subscription |
| 10 | Memory browser | MINI | low | tiny UI change |
| 11 | Redeploy + acceptance | STD | medium | checklist execution |

## Human checkpoints (Codex must stop and ask)

- **04**: asks you for the basic-auth username/password.
- **05**: requires you to literally type "Approve" before recreating the hermes container.

## Resume after clearing context

Paste: `Read CLAUDE.md, docs/PROGRESS.md, and docs/MASTER_PLAN.md. Continue with the next phase. Run acceptance criteria when done.`
Then paste the next phase file.
