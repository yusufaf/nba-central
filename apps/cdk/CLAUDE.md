# CLAUDE.md — apps/cdk

Guidance for Claude Code working in this package. This file is the authority
for the infrastructure/backend; the root CLAUDE.md covers the whole monorepo
(this package and `apps/web`) and the release/milestone convention.

## Commands

Run from the repo root with `pnpm --filter cdk <script>`, or `cd apps/cdk` and
drop the filter — both work, the workspace has one lockfile.

```bash
pnpm build                 # tsc
pnpm watch                 # tsc -w
pnpm test                  # vitest
pnpm exec cdk synth        # generate CloudFormation
pnpm exec cdk diff         # compare with deployed
pnpm exec cdk deploy       # deploy to AWS

pnpm refresh-arenas            # rewrite apps/web's arenas.json from Wikipedia
pnpm refresh-coaches           # rewrite coaches.json from Basketball-Reference
pnpm refresh-execs             # rewrite execs.json from Basketball-Reference
pnpm refresh-historical-logos  # rewrite historicalLogos.json + public/logos/historical/
pnpm rekey-historical-logos    # re-key the transparent background on already-checked-in PNGs
pnpm run refresh-<name> -- --check  # validate against the live source, write nothing
```

Requires a `.env` file with: `account`, `region`, `appName`, `deploymentType`.
`deploymentType` (`"development"` or `"production"`) is not optional for a
correct synth — some constructs (e.g. `TeamBuilderLambda`) branch on it to
decide whether to create a Lambda's IAM role or look one up via the
`resources/roles` registry, and the registry only gets populated on the
`"production"`-adjacent code path in `team-builder-api.ts`. Omitting it (or
running `cdk synth` with only `account`/`region`/`appName` set, as the CI
dummy-env pattern might tempt you to abbreviate) fails with `Role not in the
lookup` deep in Lambda construction — set all four env vars, always.

## esbuild / pnpm gotcha

`aws-cdk-lib` resolves `esbuild` from its own package location to decide
whether it can bundle Lambdas locally. Under pnpm's default strict
`node_modules`, it can't see this package's `esbuild`, silently falls back to
Docker bundling, and every Lambda fails with `Could not resolve "<package>"`
— because pnpm's symlinked deps don't resolve inside that Docker context
either. The root `.npmrc`'s `public-hoist-pattern[]=esbuild` is what keeps
bundling local and fast; if `cdk synth` starts failing that way, check that
line survived whatever change you're reviewing. `pnpm-workspace.yaml`'s
`onlyBuiltDependencies: [esbuild, vue-demi]` is the second half of this — pnpm
ignores dependency postinstall scripts by default, so without it `esbuild`
never fetches its platform binary in the first place.

## Architecture

See the root `CLAUDE.md` for the full stack list (constructs, Lambda
inventory, DynamoDB schema, S3 buckets, and the Logto auth flow) — it's not
duplicated here to avoid the two drifting apart.

## Testing

Vitest, colocated in `test/`, mirroring `service/`. Stack tests
(`test/stack/*.test.ts`) synth a real `Stack` and assert on the CloudFormation
template via `aws-cdk-lib/assertions`; Lambda tests mock the AWS SDK clients
and assert on handler behavior directly.
