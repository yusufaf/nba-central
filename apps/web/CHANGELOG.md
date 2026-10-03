# Changelog

## [0.4.0](https://github.com/yusufaf/nba-central/compare/web-v0.3.0...web-v0.4.0) (2026-10-03)


### Features

* **web:** add a profile card with avatar and stats to Settings ([cec6c8b](https://github.com/yusufaf/nba-central/commit/cec6c8b5f91199ed3cd55c1130f7f65f652860af))
* **web:** add data export and delete to the Settings account tab ([988220a](https://github.com/yusufaf/nba-central/commit/988220aa100e7e82be08436fb452e8e161da7f04))
* **web:** add display preferences to Settings ([c6420b6](https://github.com/yusufaf/nba-central/commit/c6420b618c7bfd7daa56c9b5b1b6be941b30310a)), closes [#124](https://github.com/yusufaf/nba-central/issues/124)
* **web:** add light theme and theme preference ([fe5dfd9](https://github.com/yusufaf/nba-central/commit/fe5dfd9ff8341bf95dcaadd5196df15c7113c565)), closes [#125](https://github.com/yusufaf/nba-central/issues/125)
* **web:** add settings page with server-synced preferences ([19552d3](https://github.com/yusufaf/nba-central/commit/19552d3113244e7dc1e2be322ad92eeac51e3d11)), closes [#122](https://github.com/yusufaf/nba-central/issues/122)
* **web:** add team builder preferences to Settings ([b870405](https://github.com/yusufaf/nba-central/commit/b870405717920782e62e968f3911b98936d733a3))
* **web:** undo player removal from toast and Ctrl/Cmd+Z ([#133](https://github.com/yusufaf/nba-central/issues/133)) ([d4d7e09](https://github.com/yusufaf/nba-central/commit/d4d7e09dbbe423154eff7f91903ecb5edc2825da))
* **web:** undo/redo for swap, add and clear team ([#135](https://github.com/yusufaf/nba-central/issues/135)) ([959e063](https://github.com/yusufaf/nba-central/commit/959e063094b9de344cab63f1e49b17e5019fad0e))
* **web:** undo/redo for team customization and staff ([#136](https://github.com/yusufaf/nba-central/issues/136)) ([96ed81b](https://github.com/yusufaf/nba-central/commit/96ed81bf249c0be273a67c6577ba4e3a37851926)), closes [#113](https://github.com/yusufaf/nba-central/issues/113)


### Bug Fixes

* **web:** apply Text size before the first paint ([8f03c91](https://github.com/yusufaf/nba-central/commit/8f03c9119ef3e47c14aeb4d938bda99a3a74d235))
* **web:** hide the desktop nav on phones and make the mobile nav readable ([8c4f67d](https://github.com/yusufaf/nba-central/commit/8c4f67dea4b73938e19ed25c159dcd3c9cfa85ec))
* **web:** keep settings saves in order and never stall on a missing account ([eacbd95](https://github.com/yusufaf/nba-central/commit/eacbd955ad257b73fde7f3f7a70acfdd3ff3ef19))
* **web:** make red text readable on dark surfaces ([f32f8d2](https://github.com/yusufaf/nba-central/commit/f32f8d24ae5690254471ca69d50e4db4abef53a5))
* **web:** read the router once in PageTitle ([e4ecc6e](https://github.com/yusufaf/nba-central/commit/e4ecc6e857743da8014cc6c701f99af62905741c))
* **web:** render score cards for games with no leaders yet ([1342644](https://github.com/yusufaf/nba-central/commit/1342644a4f04f8413a795f8c76f17cae289c2bb2)), closes [#141](https://github.com/yusufaf/nba-central/issues/141)
* **web:** right-align the user menu and Login link in the header ([af46664](https://github.com/yusufaf/nba-central/commit/af4666415ebd0f4baa9bca33808b34141d36c563))
* **web:** use the header's Logout label on the settings account tab ([40787a4](https://github.com/yusufaf/nba-central/commit/40787a445c2d2f561c854270d9c1f67dbe855d18))

## [0.3.0](https://github.com/yusufaf/nba-central/compare/web-v0.2.0...web-v0.3.0) (2026-09-22)


### Features

* serve historical logos from the assets CDN ([#96](https://github.com/yusufaf/nba-central/issues/96)) ([1ec96bc](https://github.com/yusufaf/nba-central/commit/1ec96bcf55ec1b341b1c6e429ee6e9d45ce5b2c5)), closes [#66](https://github.com/yusufaf/nba-central/issues/66)
* share loop — public team pages, share cards, remix ([#106](https://github.com/yusufaf/nba-central/issues/106)) ([48337ec](https://github.com/yusufaf/nba-central/commit/48337ec388f3882caee3403e906df91f1afeef4c))
* **web:** add a send-feedback dialog behind a footer link ([#98](https://github.com/yusufaf/nba-central/issues/98)) ([80128b7](https://github.com/yusufaf/nba-central/commit/80128b7335124aafd8b8a65d079d7afc07865782)), closes [#59](https://github.com/yusufaf/nba-central/issues/59)
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
* **web:** sign out when a stale Logto session can no longer be refreshed ([#95](https://github.com/yusufaf/nba-central/issues/95)) ([0cfe18b](https://github.com/yusufaf/nba-central/commit/0cfe18bde49d49ed2c8d8011d47045eb6cdb1adb))
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
