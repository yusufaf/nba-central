# TeamBuilder

NBA team-building app — draft custom rosters from the full all-time player
pool, plus coaches, arenas, and GMs. Serverless backend, self-hosted OIDC auth.

Live at [nba.yusufaf.dev](https://nba.yusufaf.dev).

## Stack

- **apps/web** — Vue 3 + Vite + TypeScript, Pinia, Tailwind v4, shadcn-vue
- **apps/cdk** — AWS CDK (TypeScript): API Gateway, Lambda, DynamoDB, S3, CloudFront

pnpm workspace, one lockfile. Each package versions and deploys independently.

## Quickstart

```bash
pnpm install

pnpm --filter web start          # dev server on :3000
pnpm --filter cdk exec cdk synth # generate CloudFormation
```

See [`CLAUDE.md`](./CLAUDE.md) for full architecture, commands, and the
release/milestone convention. Package-specific notes: [`apps/web/CLAUDE.md`](./apps/web/CLAUDE.md),
[`apps/cdk/CLAUDE.md`](./apps/cdk/CLAUDE.md).

## Auth

[Logto](https://logto.io) (self-hosted OIDC) — no Cognito, no Clerk.

## Releases

Each package tags and releases independently via
[release-please](https://github.com/googleapis/release-please):
`web-vX.Y.Z`, `cdk-vX.Y.Z`.
