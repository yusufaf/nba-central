# Changelog

## [0.3.0](https://github.com/yusufaf/nba-central/compare/cdk-v0.2.0...cdk-v0.3.0) (2026-11-01)


### Features

* **cdk:** add Daily Era puzzle and guess API ([#173](https://github.com/yusufaf/nba-central/issues/173)) ([1cbf20b](https://github.com/yusufaf/nba-central/commit/1cbf20bfa4922f4f690294a542e4490b12c4133a))
* **cdk:** add each player's current team to getPlayers ([857d383](https://github.com/yusufaf/nba-central/commit/857d383d61a8ba71b72ee938d9e8bedfb679dacf))
* **cdk:** add refresh-current-logos script ([f0bda2d](https://github.com/yusufaf/nba-central/commit/f0bda2de41c740a2c9b9374ab0fa2e0ce459c16a))
* **cdk:** add refresh-daily-era puzzle image pipeline ([#174](https://github.com/yusufaf/nba-central/issues/174)) ([50164e3](https://github.com/yusufaf/nba-central/commit/50164e34737b7a24c50b7ec5ae914cf1088297e7))
* **cdk:** add the latest draft class to players.json ([03700e3](https://github.com/yusufaf/nba-central/commit/03700e30315d10e5013ca74e64ae60c444007c3d)), closes [#169](https://github.com/yusufaf/nba-central/issues/169)
* **cdk:** cache ESPN injuries in live/injuries.json every 15 minutes ([#261](https://github.com/yusufaf/nba-central/issues/261)) ([2593652](https://github.com/yusufaf/nba-central/commit/2593652c8d5f5b9108c67858f0c97c877d90dded))
* **cdk:** cache ESPN standings, schedule and headshots for the web ([#182](https://github.com/yusufaf/nba-central/issues/182)) ([d4fa7d3](https://github.com/yusufaf/nba-central/commit/d4fa7d3f3c9989b977dec4f8f21f026e244a9c2f))
* **cdk:** email on scheduled Lambda failures and keep failed events ([5d48735](https://github.com/yusufaf/nba-central/commit/5d4873517ee41a3ff17992e4aadb5328b3061722))
* **cdk:** keep Lambda logs for 30 days ([7b22b78](https://github.com/yusufaf/nba-central/commit/7b22b780dfc9e26431b01871e05238764773c95f))
* **cdk:** look up players by id in getPlayers ([d456939](https://github.com/yusufaf/nba-central/commit/d456939b9651279e98f51a2cdc2bc0c26582da1f))
* **cdk:** proxy ESPN scoreboards and box scores through a cached /api/scores route ([#263](https://github.com/yusufaf/nba-central/issues/263)) ([fea6f71](https://github.com/yusufaf/nba-central/commit/fea6f719998d0eff0643aa591ad736914273bf42))
* **cdk:** publish and serve the Cap Five daily puzzle ([5d701c3](https://github.com/yusufaf/nba-central/commit/5d701c35b94c6d6aa6367ab14993d8ecf464fc6d)), closes [#183](https://github.com/yusufaf/nba-central/issues/183)
* **cdk:** publish every finished season's team rosters for real-team starts ([7d0626c](https://github.com/yusufaf/nba-central/commit/7d0626c81bd5e39b400d946478cae5c8926bedbc))
* **cdk:** serve /cap-five from cap-five.html ([f371e78](https://github.com/yusufaf/nba-central/commit/f371e786fced5ad064bf9dc0d954562df4bb0aa0)), closes [#249](https://github.com/yusufaf/nba-central/issues/249)
* **cdk:** serve /daily's link preview from CloudFront ([a58b893](https://github.com/yusufaf/nba-central/commit/a58b893d70c273883e00075e301b29add8aa3ba7))
* **cdk:** serve player stats only from the snapshot ([d909e3a](https://github.com/yusufaf/nba-central/commit/d909e3a356355327b44f37753d5feaf524e6cad6)), closes [#180](https://github.com/yusufaf/nba-central/issues/180)
* **cdk:** snapshot player careers on a schedule ([411e601](https://github.com/yusufaf/nba-central/commit/411e601dfc31b476ef2d0d19b8153355371eb7bd)), closes [#180](https://github.com/yusufaf/nba-central/issues/180)
* **cdk:** throttle each HTTP API route ([3bfc8ce](https://github.com/yusufaf/nba-central/commit/3bfc8ce905500fa2fb929f6c8f25ee2e061551b2))
* **cdk:** write the current season's team rosters weekly ([6b8e80c](https://github.com/yusufaf/nba-central/commit/6b8e80cfed27337e1f1910e68d1c1128fe092115))
* per-PR previews on GitHub Pages ([#224](https://github.com/yusufaf/nba-central/issues/224)) ([38588a1](https://github.com/yusufaf/nba-central/commit/38588a18feebc40f49b562cada89fadfa4f29e24))
* share/search metadata, robots.txt and sitemap, license, README ([#220](https://github.com/yusufaf/nba-central/issues/220)) ([dc97710](https://github.com/yusufaf/nba-central/commit/dc9771032ac2ed5f09ebe0ae62d82aa912492113))


### Bug Fixes

* **cdk:** fail fetchNewsCron when a source or write fails ([56a889d](https://github.com/yusufaf/nba-central/commit/56a889de4be33debdfe78a2a9edd7c3da9c7aaa9))
* **cdk:** fail setPlayerRatingsData when the refresh fails ([6bd5cad](https://github.com/yusufaf/nba-central/commit/6bd5cad33df376acee0bc145d080a019a032b395))
* **cdk:** keep last season's players active until November ([a7cc286](https://github.com/yusufaf/nba-central/commit/a7cc2863ba3b0d57f77a4d596aedef7c63bf8ac6)), closes [#193](https://github.com/yusufaf/nba-central/issues/193)
* **cdk:** keep only real positions from 2K's ratings ([13b99c7](https://github.com/yusufaf/nba-central/commit/13b99c777448fb5b87f04d8ea7b535038415420e))
* **cdk:** mark players active by NBA season, not calendar year ([0354223](https://github.com/yusufaf/nba-central/commit/03542239f569acb8d903873885f099a7c4d8bf11)), closes [#163](https://github.com/yusufaf/nba-central/issues/163)
* **cdk:** refuse to overwrite players.json with a partial scrape ([4193788](https://github.com/yusufaf/nba-central/commit/41937886e59d25e3ec3c73ddf08f59cf22150758)), closes [#168](https://github.com/yusufaf/nba-central/issues/168)
* **cdk:** remove the unused getTeamLogos Lambda and route ([5836743](https://github.com/yusufaf/nba-central/commit/58367436db3eb46ba189a8c43139aa0808332bb2))
* **cdk:** serve stale player stats when Basketball-Reference fails ([caf2452](https://github.com/yusufaf/nba-central/commit/caf2452b0d02503c06fcf5faebb3accd26be224f)), closes [#166](https://github.com/yusufaf/nba-central/issues/166)

## [0.2.0](https://github.com/yusufaf/nba-central/compare/cdk-v0.1.1...cdk-v0.2.0) (2026-10-08)


### Features

* **cdk:** accept display settings keys ([402edf4](https://github.com/yusufaf/nba-central/commit/402edf4d14d011b3503939abb34c4e165509a9fb)), closes [#124](https://github.com/yusufaf/nba-central/issues/124)
* **cdk:** accept display.theme in user settings ([ca0687d](https://github.com/yusufaf/nba-central/commit/ca0687da8a8e712631a4a8916b794199f0333d06)), closes [#125](https://github.com/yusufaf/nba-central/issues/125)
* **cdk:** accept team builder settings keys ([05b5d18](https://github.com/yusufaf/nba-central/commit/05b5d184fd05ccdd914e6054289d14e6e8bd0589))
* **cdk:** add custom arenas and their image endpoint ([e79ffac](https://github.com/yusufaf/nba-central/commit/e79ffacb41b6e19257663db02c4e640d1e47bb24)), closes [#116](https://github.com/yusufaf/nba-central/issues/116)
* **cdk:** add endpoints to export and delete a user's data ([b2e254a](https://github.com/yusufaf/nba-central/commit/b2e254a2b0bd4306334d1f3419d14f6bafb1f7af))
* **cdk:** add profile stats, avatar upload and the avatar setting ([a1db254](https://github.com/yusufaf/nba-central/commit/a1db254a147d5eda2f829d66b3ac9c176cca9721))
* **cdk:** add user settings API and remove the Clerk-era save-data route ([0d7d0e3](https://github.com/yusufaf/nba-central/commit/0d7d0e32e6c87d8bbaf95925b632ce178c714cf9)), closes [#122](https://github.com/yusufaf/nba-central/issues/122)
* **cdk:** send feedback email via SES ([#83](https://github.com/yusufaf/nba-central/issues/83)) ([5ee5797](https://github.com/yusufaf/nba-central/commit/5ee5797d0bb2db5db1964233ee1e324facb66504)), closes [#54](https://github.com/yusufaf/nba-central/issues/54)
* **cdk:** take only a PNG for an arena's court drawing ([343f3be](https://github.com/yusufaf/nba-central/commit/343f3beb4012cf76bd14c7ffc9632a5edb254678)), closes [#118](https://github.com/yusufaf/nba-central/issues/118)
* serve historical logos from the assets CDN ([#96](https://github.com/yusufaf/nba-central/issues/96)) ([1ec96bc](https://github.com/yusufaf/nba-central/commit/1ec96bcf55ec1b341b1c6e429ee6e9d45ce5b2c5)), closes [#66](https://github.com/yusufaf/nba-central/issues/66)
* share loop — public team pages, share cards, remix ([#106](https://github.com/yusufaf/nba-central/issues/106)) ([48337ec](https://github.com/yusufaf/nba-central/commit/48337ec388f3882caee3403e906df91f1afeef4c))
* **web:** add settings page with server-synced preferences ([19552d3](https://github.com/yusufaf/nba-central/commit/19552d3113244e7dc1e2be322ad92eeac51e3d11)), closes [#122](https://github.com/yusufaf/nba-central/issues/122)


### Bug Fixes

* **cdk:** key news rows on URL so re-published stories overwrite themselves ([#93](https://github.com/yusufaf/nba-central/issues/93)) ([a12d7cf](https://github.com/yusufaf/nba-central/commit/a12d7cf38a9ea7975e61d3e2b8f71698c4288560)), closes [#92](https://github.com/yusufaf/nba-central/issues/92)
* **cdk:** make the first settings upload create-only ([0dd72f3](https://github.com/yusufaf/nba-central/commit/0dd72f3bc02b89e571ae14e904a76d8de97ee14a))
* **cdk:** three real-run bugs in refresh-historical-jerseys, upload real images ([#68](https://github.com/yusufaf/nba-central/issues/68)) ([c03e6f1](https://github.com/yusufaf/nba-central/commit/c03e6f1b9c5550171dc489cc1acac207b67bc3b8))
* derive S3 file-lambda owner from authorizer sub, not the request body ([#61](https://github.com/yusufaf/nba-central/issues/61)) ([c64be7c](https://github.com/yusufaf/nba-central/commit/c64be7ce40cde4bc640d869d7919c608eee29694))
* **web:** keep settings saves in order and never stall on a missing account ([eacbd95](https://github.com/yusufaf/nba-central/commit/eacbd955ad257b73fde7f3f7a70acfdd3ff3ef19))
* **web:** serve the hero video from the assets CDN, not Git LFS ([#82](https://github.com/yusufaf/nba-central/issues/82)) ([779006f](https://github.com/yusufaf/nba-central/commit/779006f659859f7ef1591d77c13b4ba2786cb83e))

## [0.1.1](https://github.com/yusufaf/nba-central/compare/cdk-v0.1.0...cdk-v0.1.1) (2026-09-04)


### Bug Fixes

* address dependabot vulnerabilities in vitest, esbuild, ws, form-data, brace-expansion ([#39](https://github.com/yusufaf/nba-central/issues/39)) ([58d629d](https://github.com/yusufaf/nba-central/commit/58d629dc4943dbf8686d0bd966e3c5d06b02b978)), closes [#247](https://github.com/yusufaf/nba-central/issues/247)
* address remaining code review findings ([34b29b9](https://github.com/yusufaf/nba-central/commit/34b29b9f715a32579da490b6bd65e6a88fbed0d6))
* bump cdk vitest to 4.1.11 to clear vite/esbuild alerts ([#40](https://github.com/yusufaf/nba-central/issues/40)) ([a75b3c8](https://github.com/yusufaf/nba-central/commit/a75b3c8dacde3ea7b55bb3c7e7fafd51b9fbaea5))
* bump esbuild past newly-disclosed Windows dev-server file-read range ([#41](https://github.com/yusufaf/nba-central/issues/41)) ([793bcd7](https://github.com/yusufaf/nba-central/commit/793bcd7ec6164843d12dde84e38db8831e053ce5))
* **cdk:** 400 on an invalid upload request body instead of 502 ([#52](https://github.com/yusufaf/nba-central/issues/52)) ([dc6a165](https://github.com/yusufaf/nba-central/commit/dc6a1651be2f1c314703f2b2aebf47e13cbb5c2c)), closes [#50](https://github.com/yusufaf/nba-central/issues/50)
* **cdk:** pin a single esbuild version via root override ([868addf](https://github.com/yusufaf/nba-central/commit/868addf23b47fb01056886a79fbf1a9d917309f2)), closes [#28](https://github.com/yusufaf/nba-central/issues/28)
* **cdk:** return full file name and awaited signed URL on upload completion ([#48](https://github.com/yusufaf/nba-central/issues/48)) ([b4b4e10](https://github.com/yusufaf/nba-central/commit/b4b4e104d3540c7152c812520f259fb4b1e8c1b5)), closes [#45](https://github.com/yusufaf/nba-central/issues/45)
