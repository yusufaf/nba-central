# Changelog

## [0.2.1](https://github.com/yusufaf/nba-central/compare/web-v0.2.0...web-v0.2.1) (2026-09-05)


### Bug Fixes

* **cdk:** three real-run bugs in refresh-historical-jerseys, upload real images ([#68](https://github.com/yusufaf/nba-central/issues/68)) ([c03e6f1](https://github.com/yusufaf/nba-central/commit/c03e6f1b9c5550171dc489cc1acac207b67bc3b8))
* guard QuarterScores against a missing competitor ([#62](https://github.com/yusufaf/nba-central/issues/62)) ([f11de09](https://github.com/yusufaf/nba-central/commit/f11de0934194a3f4c708a0d2b305d36c69e95363)), closes [#46](https://github.com/yusufaf/nba-central/issues/46)

## [0.2.0](https://github.com/yusufaf/nba-central/compare/web-v0.1.0...web-v0.2.0) (2026-09-04)


### Features

* add self-hosted Umami analytics ([#55](https://github.com/yusufaf/nba-central/issues/55)) ([ea1fac8](https://github.com/yusufaf/nba-central/commit/ea1fac8fd8162d0d049c787fad2a5c65a053a953))
* **web:** browser notifications for followed game score changes ([#36](https://github.com/yusufaf/nba-central/issues/36)) ([68736bc](https://github.com/yusufaf/nba-central/commit/68736bceff695de06bec8467e139e05f495fb5af))
* **web:** persist Scores filter preferences to localStorage ([#37](https://github.com/yusufaf/nba-central/issues/37)) ([9d15662](https://github.com/yusufaf/nba-central/commit/9d15662c47db9dfded8e621ec154ce25d3526a5d)), closes [#27](https://github.com/yusufaf/nba-central/issues/27)


### Bug Fixes

* address code review findings on the monorepo consolidation ([179206b](https://github.com/yusufaf/nba-central/commit/179206b71b0dd91cb9c5caa53b4130c5f040c165))
* address remaining code review findings ([34b29b9](https://github.com/yusufaf/nba-central/commit/34b29b9f715a32579da490b6bd65e6a88fbed0d6))
* point Umami tracker at analytics.yusufaf.dev ([#56](https://github.com/yusufaf/nba-central/issues/56)) ([32b7d6a](https://github.com/yusufaf/nba-central/commit/32b7d6acda3184d773215a34cf7efabe66a42285))
* **web:** migrate ESLint config to flat config ([5b2a5a3](https://github.com/yusufaf/nba-central/commit/5b2a5a32c624841b2f1ad17f251706e00f4daf2d)), closes [#25](https://github.com/yusufaf/nba-central/issues/25)
* **web:** use a factory for usePlayerStatsPreferences defaults ([#57](https://github.com/yusufaf/nba-central/issues/57)) ([4cae904](https://github.com/yusufaf/nba-central/commit/4cae904eea01833c243a462cde9e0327209b703f)), closes [#38](https://github.com/yusufaf/nba-central/issues/38)
