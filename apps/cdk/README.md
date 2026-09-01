# @team-builder/cdk

AWS CDK (TypeScript) infrastructure: API Gateway, Lambda, DynamoDB, S3,
CloudFront. See [`CLAUDE.md`](./CLAUDE.md) for the esbuild/pnpm gotcha and
required `.env` vars before running anything here.

Part of the [TeamBuilder](../../README.md) monorepo — run commands from the
repo root with `pnpm --filter cdk <script>`, or `cd` here and drop the filter.

```bash
pnpm build
pnpm test
pnpm exec cdk synth   # generate CloudFormation
pnpm exec cdk diff    # compare with deployed
pnpm exec cdk deploy  # deploy to AWS

pnpm refresh-arenas   # rewrite apps/web's static data from source
pnpm refresh-coaches
pnpm refresh-execs
```
