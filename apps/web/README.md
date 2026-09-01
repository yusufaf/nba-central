# @team-builder/web

Vue 3 + Vite + TypeScript frontend. See [`CLAUDE.md`](./CLAUDE.md) for stack
details and [`DESIGN.md`](./DESIGN.md) before touching any UI.

Part of the [TeamBuilder](../../README.md) monorepo — run commands from the
repo root with `pnpm --filter web <script>`, or `cd` here and drop the filter.

```bash
pnpm start           # dev server on :3000
pnpm build
pnpm type-check
pnpm test
pnpm check:styles    # design-system guard
pnpm test:visual     # Playwright screenshots of every route
```

Deployed to S3 + CloudFront at `nba.yusufaf.dev` — see `apps/cdk`'s
`TeamBuilderWeb` construct.
