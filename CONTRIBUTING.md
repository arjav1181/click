# Contributing

Thanks for helping build an open, self-hostable AI meeting assistant.

## Ground rules

1. **Clean room.** Do not copy code, assets, copy text, logos, or design files
   from Fireflies.ai, Gronola, Otter.ai or any other product. Build from the
   written contracts in `replica/` and from first principles.
2. **Public sources only.** No reverse engineering, no inspecting private APIs,
   no copying bundled JavaScript, no unlicensed assets.
3. **Own your dependencies.** Any dependency must be OSS-compatible with the
   project licence and must not require a paid service to run the core flow.

## Workflow

1. Open or find an issue before starting on anything larger than a bugfix.
2. Branch from `main`: `feat/short-slug`, `fix/short-slug`, `docs/short-slug`.
3. Keep commits small and readable; write the commit subject in the imperative
   mood ("Add transcript search index").
4. Open a pull request that references the issue and describes how you tested
   it.
5. CI must pass: lint, typecheck, tests, build.

## Commit message style

```
type(scope): short summary

Why this change is needed. What changed. Anything a reviewer should watch out
for.
```

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `chore`.

## Local development

Setup instructions are generated once the stack is locked in
`replica/architecture.md`; until then see `docs/`.

## Reporting security issues

Do not open a public issue. Follow `SECURITY.md`.
