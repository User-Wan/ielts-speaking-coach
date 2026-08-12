# Public release checklist

Use this checklist before pushing a portfolio release branch.

## Privacy

- [ ] No `state.json`, `recordings`, `reports`, `pending-reviews`, `Teacher Exports`, or `app-profile` files are tracked.
- [ ] No `backups`, `trash`, `personal-materials`, browser profiles, cookies, login databases, or cache directories are tracked.
- [ ] No ChatGPT conversation URLs or real transcript text appear in tracked files.
- [ ] No machine-specific paths, access tokens, API keys, or credentials appear in tracked files.
- [ ] No commercial or OCR-extracted question bank is committed.

## Product

- [ ] README links match the actual repository and fork owner.
- [ ] Demo fixtures are explicitly synthetic.
- [ ] Audio filenames in examples are placeholders only; no audio binary is included.
- [ ] The public app starts without a personal absolute path.
- [ ] The upstream MIT notice remains unchanged.

## Verification

```powershell
npm run test:review-parser
npm run test:answer-policy
npm run test:voice-end
npm run test:review-controls
npm run test:desktop-flow
npm run test:mcp
```

Then inspect both the staged diff and the complete tracked-file list before pushing.
