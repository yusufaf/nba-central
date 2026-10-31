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
pnpm refresh-historical-logos  # rewrite historicalLogos.json, upload images to S3/CloudFront
pnpm refresh-historical-jerseys  # rewrite historicalJerseys.json, upload images to S3/CloudFront
pnpm refresh-current-logos     # rewrite currentTeamLogos.json from ESPN's teams endpoint
pnpm refresh-daily-era         # crop Daily Era puzzle images, append them to the puzzle list
pnpm refresh-team-seasons      # publish finished seasons' rosters to S3 (only seasons not yet published)
pnpm run refresh-team-seasons -- --only NBA-1996  # re-publish just these seasons
pnpm run refresh-daily-era -- --check  # build the images and contact sheet, upload nothing
pnpm run refresh-<name> -- --check  # validate against the live source, write nothing
pnpm upload-hero-video          # upload apps/web's hero clip, rewrite heroMedia.json
pnpm run upload-hero-video -- --check  # validate the local file, upload nothing
```

`refresh-historical-logos --check`, `refresh-historical-jerseys --check`,
`refresh-daily-era --check`, `refresh-team-seasons --check` and `upload-hero-video --check` need no AWS
access - they only fetch/parse. A real (non-`--check`) run of any of them
uploads to the `assets` S3 bucket and needs `TeamBuilderAssetsCdn` already
deployed (`cdk deploy`) plus AWS credentials able to write to that bucket.
All four share that upload/CloudFront-lookup logic via
`scripts/lib/assetsCdn.ts`. `refresh-daily-era` also reads and writes
`daily-era-puzzles.json` in the `static-data` bucket.

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

### live/ (setSeasonContextData)

`live/` in the assets bucket holds files the web fetches as they are:
`standings.json`, `schedule.json`, `headshots.json`, the mirrored
`headshots/{espnId}.png` and `injuries.json`. A second rule runs the same
Lambda every 15 minutes (`cron(2/15 * * * ? *)`, so never with the hourly :07
run) with the input `{"dataset":"injuries"}`, which skips everything else and
writes only `injuries.json`: ESPN's injuries report, keyed by BBRef id through
the ESPN ids in `headshots.json`. ESPN's report has no athlete id field, so
the id is read from the athlete's link and headshot URLs. That run keeps the
previous file when it can't read `headshots.json`, when ESPN's response fails
validation or lists no one, or when under half of ten or more injured athletes
join. To invoke it by hand, pass that input.

For the hourly files, a response that fails validation, a previous file S3
fails to return, or a big drop in games or matched players keeps the previous
file, and the run's summary log says why. A previous file of the wrong shape is
replaced, like a first run. The JSON goes out with
`Cache-Control: public, max-age=300, stale-while-revalidate=60,
stale-if-error=86400`; the `live/*` cache policy's max TTL has to stay at least
the `stale-if-error` value, since CloudFront serves stale content only up to the
smaller of the two. The Lambda is production-only (`deployToTypes`), so nothing
appears until a `cdk deploy`, and its first data until the first hourly run or a
manual invoke. The headshot backfill takes about five runs.

### /api/scores/* (getScoreboardDay, getScoreboardMonth, getGameSummary)

`/scores`, its calendar counts and `/game/:id` read
`/api/scores/day/{YYYYMMDD}`, `/api/scores/month/{YYYYMM}` and
`/api/scores/game/{id}`. Each Lambda fetches ESPN server-side, and the
`/api/scores/*` CloudFront behavior (ahead of `/api/*`) caches the answer for
as long as its `Cache-Control` says, which follows game state
(`utilities/scores-cache.ts`): 10 s while a game is on or about to tip,
60 s otherwise (an empty past day included), a day once a past ET day has
games and all are final, an hour for the current month or an empty past
one, and 60 s for an unknown game (410). An empty answer is never cached for
a day, in case it's an ESPN glitch. `stale-if-error` is an
hour; the cache policy's max TTL (a day) has to cover it and every max-age. The day and game bodies are
ESPN's as sent (`plays` and `winprobability` included); the month is cut to
`{ events: [{ date }] }`, since ESPN's is ~3 MB against Lambda's 6 MB limit.
Params are validated and range-bounded before any ESPN call, and refusals
are 400/410/502, never 403/404 (see the distribution's error pages).

The web polls live games every 15 s (`LIVE_SCORES_POLL_MS` in apps/web), so a
viewer is at most ~25 s behind ESPN; change it and the 10 s live max-age
together. The web auto-deploys on merge, so a change here that the web
depends on has to be `cdk deploy`ed first, or `/api/scores/*` falls through to
`/api/*` and the SPA's `index.html`.

## Monitoring

Scheduled Lambdas pass `monitor` to `TeamBuilderLambda`. Each gets an
`<prefix>-<name>-errors` alarm on its `Errors` metric that emails
`ALERTS_TO_ADDRESS` through the `<prefix>-alerts` topic (`TeamBuilderAlerts`),
and an event that fails every async retry lands in `<prefix>-failed-events`
(SQS, kept 14 days) instead of being emailed. The email subscription stays
pending until its confirmation link is clicked, once per stage after the
first deploy; until then alarms go nowhere. An alarm fires on one failing
5-minute period in the last 24 (two hours), or three for `fetchNewsCron`,
which fails a run when any source or write fails and whose single timeouts
recover on the next run. There is no OK email, and CloudWatch emails only on
a state change: while an alarm sits in ALARM, say `fetchNewsCron`'s because
one Bluesky handle keeps failing, a later full outage sends nothing new until
it clears, while each failed run still adds a message to the failed-events
queue (96 a day, bounded by its 14-day retention). `setPlayerStatsData` and
`setSeasonContextData` alarm only when a run throws or times out (DynamoDB or
S3 errors, crashes): a BBRef block or a streak of failed careers pauses the
stats scraper and the run returns normally, and an ESPN dataset that fails
keeps the previous file, so those show only in the logs (`stoppedBy` in the
stats run summary, `Kept the previous …` lines). Six alarms in production and
four in development fill the free tier's 10; another monitored Lambda costs
$0.10 a month.

Every `TeamBuilderLambda` logs to its own CDK-managed log group with 30-day
retention (`LAMBDA_LOG_RETENTION`), not Lambda's auto-created
`/aws/lambda/<name>`, so `aws logs tail /aws/lambda/<name>` shows nothing new
after the deploy that moved it; the function's `LoggingConfig` names the
group. The old auto-created groups keep their history and had no retention,
so cap them once after deploying a stage:
`aws logs put-retention-policy --log-group-name <group> --retention-in-days 30`
for each `/aws/lambda/team-builder-*` group. The API access-log group keeps
its own (731-day) retention.

## Testing

Vitest, colocated in `test/`, mirroring `service/`. Stack tests
(`test/stack/*.test.ts`) synth a real `Stack` and assert on the CloudFormation
template via `aws-cdk-lib/assertions`; Lambda tests mock the AWS SDK clients
and assert on handler behavior directly.
