# Changelog

## [0.3.0](https://github.com/yusufaf/nba-central/compare/web-v0.2.0...web-v0.3.0) (2026-09-11)


### Features

* **web:** let jersey drawing take any color, not just five swatches ([#90](https://github.com/yusufaf/nba-central/issues/90)) ([2320639](https://github.com/yusufaf/nba-central/commit/2320639f1b984400300ec75b9e00b258dc3f3671))
* **web:** replace jersey's native color input with a real picker ([#91](https://github.com/yusufaf/nba-central/issues/91)) ([40a2f16](https://github.com/yusufaf/nba-central/commit/40a2f165844296a6381a520af025ae0b64e235e3))
* **web:** restore jersey drawing in Team Customization, this time persisted ([#87](https://github.com/yusufaf/nba-central/issues/87)) ([43ef6d1](https://github.com/yusufaf/nba-central/commit/43ef6d15c405f12e99199a299d471d203deb9a7b))


### Bug Fixes

* **cdk:** three real-run bugs in refresh-historical-jerseys, upload real images ([#68](https://github.com/yusufaf/nba-central/issues/68)) ([c03e6f1](https://github.com/yusufaf/nba-central/commit/c03e6f1b9c5550171dc489cc1acac207b67bc3b8))
* guard QuarterScores against a missing competitor ([#62](https://github.com/yusufaf/nba-central/issues/62)) ([f11de09](https://github.com/yusufaf/nba-central/commit/f11de0934194a3f4c708a0d2b305d36c69e95363)), closes [#46](https://github.com/yusufaf/nba-central/issues/46)
* **web:** box score line score, DNP headshots, and stat-tab typography ([#80](https://github.com/yusufaf/nba-central/issues/80)) ([8289c47](https://github.com/yusufaf/nba-central/commit/8289c47aeff236704b0c932c917c7d0be155bd3f))
* **web:** put Scores date/conference/view in the URL, fix line score overflow ([#79](https://github.com/yusufaf/nba-central/issues/79)) ([6376da2](https://github.com/yusufaf/nba-central/commit/6376da289f28e16efe32474e9430684502d3a263))
* **web:** serve the hero video from the assets CDN, not Git LFS ([#82](https://github.com/yusufaf/nba-central/issues/82)) ([779006f](https://github.com/yusufaf/nba-central/commit/779006f659859f7ef1591d77c13b4ba2786cb83e))
* **web:** show login/logout state in Header, fix stale-session redirect loop ([#69](https://github.com/yusufaf/nba-central/issues/69)) ([dc8a026](https://github.com/yusufaf/nba-central/commit/dc8a02641cf9f5dadad40b68eafef288fd8c9578))
* **web:** stop jersey picker's selected checkmark clipping at tile border ([#70](https://github.com/yusufaf/nba-central/issues/70)) ([8b15d41](https://github.com/yusufaf/nba-central/commit/8b15d419fc1d4040d55353d4d203c5c6b3afd049))
* **web:** wire up dead filter checkboxes in Arena/Coach/GM drawers ([#81](https://github.com/yusufaf/nba-central/issues/81)) ([00700d0](https://github.com/yusufaf/nba-central/commit/00700d055a651384e1a2821ff009c345b99ce6e8))

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
