# Changelog

## [0.2.0](https://github.com/yusufaf/nba-central/compare/nba-team-builder-v0.1.0...nba-team-builder-v0.2.0) (2026-08-31)


### Features

* add game count tooltips to scoreboard calendar ([d8e20b9](https://github.com/yusufaf/nba-central/commit/d8e20b97c6c4c89301dff1ad0cb9eb15f2aefb80))
* add historical team names dropdown and team builder fixes ([170687a](https://github.com/yusufaf/nba-central/commit/170687a58a82982c44ec76acc7f48dd50a9b09ba))
* **auth:** replace Clerk with Logto ([9e98308](https://github.com/yusufaf/nba-central/commit/9e98308bc23c33f2073fee32d43338496d7c6e28))
* **custom-entities:** Add UI for creating custom GMs, Coaches, and Players ([10cc7d1](https://github.com/yusufaf/nba-central/commit/10cc7d1a96d3f237adf79aaf9f128b28aa36ab6f))
* improve Team Builder drawer UX with shadcn-vue components ([690f045](https://github.com/yusufaf/nba-central/commit/690f04533e7686d0319cb69f71a7a9b3377ceeeb))
* major refactor and feature additions ([d00badc](https://github.com/yusufaf/nba-central/commit/d00badc6ba2d130f19520bc68898406b71d478f1))
* **player-stats:** highlight career highs in the season table ([#11](https://github.com/yusufaf/nba-central/issues/11)) ([bf984b0](https://github.com/yusufaf/nba-central/commit/bf984b04044c5ef860349df61e026862c687e38e))
* **player-stats:** stats display preferences and per-slot add feedback ([#10](https://github.com/yusufaf/nba-central/issues/10)) ([d2fa2fe](https://github.com/yusufaf/nba-central/commit/d2fa2fed91a7a0e1027e1cfb903024e73930303b))
* **team-builder:** add an all-time historical logo picker ([#19](https://github.com/yusufaf/nba-central/issues/19)) ([8a7e950](https://github.com/yusufaf/nba-central/commit/8a7e95014fdb8c5ab0425e842bdc418f5b250ce2))
* **team-builder:** add drag and drop roster reordering ([#9](https://github.com/yusufaf/nba-central/issues/9)) ([d3bab35](https://github.com/yusufaf/nba-central/commit/d3bab3585407bfd2a16fab954448673853778ed5))
* **team-builder:** persist full teams and make /teams real ([#18](https://github.com/yusufaf/nba-central/issues/18)) ([22e69af](https://github.com/yusufaf/nba-central/commit/22e69afb41df7574c83a645795a2191492dc79af))
* **team-builder:** rework the all-time logo picker ([#20](https://github.com/yusufaf/nba-central/issues/20)) ([42a8038](https://github.com/yusufaf/nba-central/commit/42a8038387cf15f7110e376feceddb9bf544884f))
* **team-builder:** source players from getPlayers API with 2K ratings ([c0f1ab7](https://github.com/yusufaf/nba-central/commit/c0f1ab73e6f960fcf852c7a06cfd7d743e08f7f5))


### Bug Fixes

* **auth:** surface Logto sign-in errors instead of hanging on Redirecting ([#17](https://github.com/yusufaf/nba-central/issues/17)) ([3013d71](https://github.com/yusufaf/nba-central/commit/3013d71646688ba7e1a60a82355f61ca3169bc16))
* **build:** pin typescript to 6.x and repair tsconfig resolution ([3d74f2d](https://github.com/yusufaf/nba-central/commit/3d74f2ddea1b6a4f6fb7747561e7cd0295a5bff2))
* **data:** regenerate arenas/coaches/execs.json from fixed ETL parsers ([#12](https://github.com/yusufaf/nba-central/issues/12)) ([346528b](https://github.com/yusufaf/nba-central/commit/346528bf58022e5c4da292dd3c343327c648ea97))
* **deploy:** drop environment: production, it breaks OIDC's sub claim ([#15](https://github.com/yusufaf/nba-central/issues/15)) ([b7a3314](https://github.com/yusufaf/nba-central/commit/b7a3314952abba7ae01ac57e1eea42009a7b45b8))
* **deps:** bump axios to fix GHSA-3p68-rc4w-qgx5 ([a6675ed](https://github.com/yusufaf/nba-central/commit/a6675edb5304fe38327f71b18f78cb8a167165d7))
* **login:** redirect home instead of hanging when already authenticated ([11f6495](https://github.com/yusufaf/nba-central/commit/11f649513d579ab453c5c561491fa316053d86f0))
* Rename basketbalL_jersey.png to basketball_jersey.png ([f5953d5](https://github.com/yusufaf/nba-central/commit/f5953d5871c24c80ff3377c25849d4f889e91674))
* resolve 31 Dependabot alerts (vite 6, clerk, and transitive deps) ([3ba57fe](https://github.com/yusufaf/nba-central/commit/3ba57fe069e4f3481b013823a9652b21648014c7))
* resolve remaining Dependabot alert for micromatch ([e71adcb](https://github.com/yusufaf/nba-central/commit/e71adcbe2d1960a0a5d40e4fece4ad1d2377e135))
* resolve remaining Dependabot alert for uuid ([76c01ef](https://github.com/yusufaf/nba-central/commit/76c01ef86e57218ba69d69ba3001a3d9c36f725f))
* restore fixed positioning for side drawers and dialogs ([ccda944](https://github.com/yusufaf/nba-central/commit/ccda9446273257af6b59ebc89fa4f0ea664a3181))
* **test:** stub interceptors.request.use in the axios mock ([173e37b](https://github.com/yusufaf/nba-central/commit/173e37b09a56fe717d6262a059232fb6de4564be))
* **ui:** improve dark theme consistency and component UX ([690fed1](https://github.com/yusufaf/nba-central/commit/690fed124e7f9eabb81022d101fe9cfdcc7303e6))
* unbreak all-time logo picker fullscreen view ([#22](https://github.com/yusufaf/nba-central/issues/22)) ([5602501](https://github.com/yusufaf/nba-central/commit/5602501fe01e06387b8a5122b6b2838da7334ae0))
* unbreak search input in fullscreen all-time logo picker ([#23](https://github.com/yusufaf/nba-central/issues/23)) ([a0750e5](https://github.com/yusufaf/nba-central/commit/a0750e5998995624a1c9723282116f1b0eff0ea4))
* Update pnpm-lock.yaml to sync with package.json ([1b25e46](https://github.com/yusufaf/nba-central/commit/1b25e46ba3e29796adea81fc9f82d7d01daab2cc))
* upgrade vue-tsc to v2 and resolve type-check errors ([d13bab9](https://github.com/yusufaf/nba-central/commit/d13bab93ecf219d1d8f70caba8df3e26f660cbc7))
