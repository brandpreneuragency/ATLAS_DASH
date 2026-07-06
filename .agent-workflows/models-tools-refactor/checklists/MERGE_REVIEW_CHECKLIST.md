# Merge Review Checklist

Use this after each branch merge.

## Git sanity

```bash
git status
git diff --stat HEAD~1..HEAD
git diff --name-only HEAD~1..HEAD
```

- [ ] No unrelated files changed.
- [ ] No generated files committed accidentally.
- [ ] No `.env` or secrets committed.
- [ ] No package lock churn unless dependencies genuinely changed.
- [ ] No new UI library added.

## Architecture sanity

- [ ] Settings remains inside current Settings document structure.
- [ ] No separate route was created.
- [ ] Zustand store patterns are preserved.
- [ ] Dexie patterns are preserved.
- [ ] secureStorage patterns are preserved.
- [ ] Existing import provider service is reused where possible.

## Conflict priorities

If conflicts happen, prefer:

1. Current SettingsPanels/SettingsDocument architecture.
2. ToolsSection for search providers.
3. ProviderDetailPanel + tabs over accordion center UX.
4. Rich ProviderStatus over weak generic statuses.
5. Existing secure key handling over raw key exposure.
6. Token-based CSS over hardcoded styling.

## Checks

Run available commands:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

- [ ] Commands that exist were run.
- [ ] Failures are copied into the merge report.
- [ ] Any fix is scoped to the merged branch's changes.
