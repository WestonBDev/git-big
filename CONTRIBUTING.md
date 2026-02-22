# Contributing

Thanks for helping improve `git big`.

## Development workflow

1. Install dependencies: `npm install`
2. Run quality checks before opening a PR:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Testing expectations

- Use test-driven development when adding or changing behavior.
- Add or update unit tests for all behavior changes in:
  - `tests/fetch.test.ts`
  - `tests/normalize.test.ts`
  - `tests/render.test.ts`
- Keep tests deterministic with fixed dates and mocked API calls.

## Pull request checklist

- [ ] Tests cover the new behavior
- [ ] Lint/typecheck/build pass locally
- [ ] `dist/git-big.svg` and `dist/git-big-levels.json` are only changed when intended
- [ ] README/docs updated for user-facing changes
