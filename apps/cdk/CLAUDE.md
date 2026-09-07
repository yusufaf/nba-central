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
pnpm refresh-historical-jerseys  # rewrite historicalJerseys.json, upload images to S3/CloudFront
pnpm run refresh-<name> -- --check  # validate against the live source, write nothing
pnpm upload-hero-video          # upload apps/web's hero clip, rewrite heroMedia.json
pnpm run upload-hero-video -- --check  # validate the local file, upload nothing
```

`refresh-historical-jerseys --check` and `upload-hero-video --check` need no
AWS access - they only read/parse locally. A real (non-`--check`) run of
either uploads to the `assets` S3 bucket and needs `TeamBuilderAssetsCdn`
already deployed (`cdk deploy`) plus AWS credentials able to write to that
bucket. Both share that upload/CloudFront-lookup logic via
`scripts/lib/assetsCdn.ts`.

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

The third half is the root `pnpm.overrides` entry for `esbuild`. Hoisting only
picks one version, so it is only well-defined while the tree holds one; the
override is what enforces that. This tree previously carried both 0.20.2 (this
package's pin) and 0.21.5 (via the old `vitest@2` → `vite@5` chain), and synth
kept working only because pnpm happened to hoist the right one. Bump the
override and this package's `esbuild` together, never one alone.

## SES (sendFeedback)

`sendFeedback` sends via a verified identity (`auth.yusufaf.dev`) in
**us-east-1**, chosen because that's the only region with SES production
access on this account today — the stack itself deploys to us-west-2, which
is still SES sandbox. Addresses/region live in `constants/index.ts`
(`FEEDBACK_SES_REGION`, `FEEDBACK_FROM_ADDRESS`, `FEEDBACK_TO_ADDRESS`), and
the shared `main-lambda-role` carries a scoped `ses:SendEmail` grant on that
one identity ARN.

None of the identity's setup is IaC: verification, DKIM, the custom MAIL FROM
domain (`mail.auth.yusufaf.dev`), and DMARC were all done by hand (AWS
console/API calls plus Porkbun DNS records), shared with the Logto deployment
that also sends from this identity. A fresh AWS account would not have any of
this — `cdk deploy` alone will not recreate a working sender, and `cdk synth`
does not validate that the identity actually exists.

## Architecture

See the root `CLAUDE.md` for the full stack list (constructs, Lambda
inventory, DynamoDB schema, S3 buckets, and the Logto auth flow) — it's not
duplicated here to avoid the two drifting apart.

## Testing

Vitest, colocated in `test/`, mirroring `service/`. Stack tests
(`test/stack/*.test.ts`) synth a real `Stack` and assert on the CloudFormation
template via `aws-cdk-lib/assertions`; Lambda tests mock the AWS SDK clients
and assert on handler behavior directly.
