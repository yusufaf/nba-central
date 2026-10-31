# Changelog

## [0.5.0](https://github.com/yusufaf/nba-central/compare/web-v0.4.0...web-v0.5.0) (2026-10-31)


### Features

* per-PR previews on GitHub Pages ([#224](https://github.com/yusufaf/nba-central/issues/224)) ([38588a1](https://github.com/yusufaf/nba-central/commit/38588a18feebc40f49b562cada89fadfa4f29e24))
* **scores:** allow selecting scheduled future dates ([4da4295](https://github.com/yusufaf/nba-central/commit/4da4295946941a77ad91bd3bf81375079faeee9f))
* share/search metadata, robots.txt and sitemap, license, README ([#220](https://github.com/yusufaf/nba-central/issues/220)) ([dc97710](https://github.com/yusufaf/nba-central/commit/dc9771032ac2ed5f09ebe0ae62d82aa912492113))
* **web:** add a 30-day Daily Era archive ([d56fc31](https://github.com/yusufaf/nba-central/commit/d56fc3189d05197363aa29b9723237850c3b5dd3)), closes [#177](https://github.com/yusufaf/nba-central/issues/177)
* **web:** add a Daily Era result share ([a448847](https://github.com/yusufaf/nba-central/commit/a44884772df5f30f07e7fe09a69982fc050fc3ba))
* **web:** add builder-engagement events and remix attribution ([#221](https://github.com/yusufaf/nba-central/issues/221)) ([ccf7b52](https://github.com/yusufaf/nba-central/commit/ccf7b5201de59de22c5657af6224fe389060dc9a)), closes [#170](https://github.com/yusufaf/nba-central/issues/170)
* **web:** add the Cap Five daily game at /cap-five ([80431bf](https://github.com/yusufaf/nba-central/commit/80431bfe875c5e1f721c6d9c015fc7df07dc7c64)), closes [#183](https://github.com/yusufaf/nba-central/issues/183)
* **web:** add the Daily Era game page ([#175](https://github.com/yusufaf/nba-central/issues/175)) ([7068605](https://github.com/yusufaf/nba-central/commit/7068605be5808aba3a5e356ee297b9cab30a2f07))
* **web:** build a win probability series and rank its biggest swings ([#202](https://github.com/yusufaf/nba-central/issues/202)) ([bc97398](https://github.com/yusufaf/nba-central/commit/bc973983c52c04c7917baf26a42aacf5d3168d2d))
* **web:** credit each player with the win probability they added ([#203](https://github.com/yusufaf/nba-central/issues/203)) ([5ae3b12](https://github.com/yusufaf/nba-central/commit/5ae3b12861c47e960f6171e0a84ca78f34b76f95))
* **web:** flag big win probability swings in the play-by-play ([#203](https://github.com/yusufaf/nba-central/issues/203)) ([99bee8a](https://github.com/yusufaf/nba-central/commit/99bee8a48f21731043cf12fcb7d770333e03295c))
* **web:** give /cap-five its own link-preview page and image ([fd7df81](https://github.com/yusufaf/nba-central/commit/fd7df819495a99c544e9d02a38956358fded8593)), closes [#249](https://github.com/yusufaf/nba-central/issues/249)
* **web:** give /daily its own link preview ([15db880](https://github.com/yusufaf/nba-central/commit/15db880381f0ccf3e3875bf166f990d8915b1607))
* **web:** give /daily its own link-preview image ([5fc5d4f](https://github.com/yusufaf/nba-central/commit/5fc5d4f6bde04d2f3c6e19ae1d3af26cc8376411)), closes [#236](https://github.com/yusufaf/nba-central/issues/236)
* **web:** keep a signed-out team through sign-in and save it on return ([caae699](https://github.com/yusufaf/nba-central/commit/caae69924522688c7e4a49c15545e5f172b10e0d))
* **web:** keep Daily Era streaks and stats in local storage ([3a47951](https://github.com/yusufaf/nba-central/commit/3a4795120058b7dcb121ffd6e46d5df2cc276a44))
* **web:** launch Which Era? and Cap Five from a Daily menu ([50bb9bd](https://github.com/yusufaf/nba-central/commit/50bb9bdb43dd598f4efeb82c80f861f6aec7a31b))
* **web:** preselect a historical jersey from the builder's jersey query ([37b45a2](https://github.com/yusufaf/nba-central/commit/37b45a2fdda623889aad8d4c6548a4947aa8e0a2))
* **web:** read scores, calendar counts and box scores from /api/scores ([#263](https://github.com/yusufaf/nba-central/issues/263)) ([663d39f](https://github.com/yusufaf/nba-central/commit/663d39f657cc763b7966c0446d90d1cd9a2649ba))
* **web:** render a 404 view for unknown paths ([#222](https://github.com/yusufaf/nba-central/issues/222)) ([247cbfa](https://github.com/yusufaf/nba-central/commit/247cbfadcad997bf3da22e0b6483c672d80ded93)), closes [#167](https://github.com/yusufaf/nba-central/issues/167)
* **web:** render the home page's link preview with render:og ([a30840f](https://github.com/yusufaf/nba-central/commit/a30840f74165272e2cd129fb7e6d4265ad5cd551)), closes [#245](https://github.com/yusufaf/nba-central/issues/245)
* **web:** show a win probability chart and the biggest plays on the box score ([#202](https://github.com/yusufaf/nba-central/issues/202)) ([cfcda43](https://github.com/yusufaf/nba-central/commit/cfcda43987f7f97f6af7a2188fbc4412bac98d87))
* **web:** show empty states on scores page ([40ebf5d](https://github.com/yusufaf/nba-central/commit/40ebf5d04d0fec1f5b54d39818ee8fa81341ba71)), closes [#200](https://github.com/yusufaf/nba-central/issues/200)
* **web:** show injury status on Team Builder player cards ([#261](https://github.com/yusufaf/nba-central/issues/261)) ([0fbef05](https://github.com/yusufaf/nba-central/commit/0fbef050f32f2a1e586bc2c1edc7ed125cbc0487))
* **web:** show standings and player headshots from the cached season data ([#182](https://github.com/yusufaf/nba-central/issues/182)) ([8ccfc5f](https://github.com/yusufaf/nba-central/commit/8ccfc5fef8ec6ea73a682966d7e1389567afcef0))
* **web:** show when a player's stats are unavailable or failed to load ([8875434](https://github.com/yusufaf/nba-central/commit/8875434eb827cfa0b8c8d77583ea7762f16715e2)), closes [#208](https://github.com/yusufaf/nba-central/issues/208)
* **web:** start a team from any real NBA, BAA or ABA team-season ([e7d6007](https://github.com/yusufaf/nba-central/commit/e7d6007f3609db3ed4e18f89c6a1db3229ec8d39))


### Bug Fixes

* **scores:** keep the date picker button from shifting between dates ([39333aa](https://github.com/yusufaf/nba-central/commit/39333aab5742e43bc8a7f1d4f2b0965bb70f8c8b))
* **web:** align score card records and show game logos before tip-off ([c3f956e](https://github.com/yusufaf/nba-central/commit/c3f956e4c8f3488cf76628da5beb573fa1b443ee))
* **web:** bound each player stats request with one deadline ([738b5c5](https://github.com/yusufaf/nba-central/commit/738b5c5ea81460c114e0fdd028db29fa98221516))
* **web:** bundle current team logos instead of fetching ESPN on mount ([f01a24c](https://github.com/yusufaf/nba-central/commit/f01a24c5e5efbafeeee3866d5a7e67ee61279800)), closes [#188](https://github.com/yusufaf/nba-central/issues/188)
* **web:** catch up on Daily Era saves missed while a tab was hidden ([60c52b6](https://github.com/yusufaf/nba-central/commit/60c52b6ce5184f7d29a9e2acbaef6d457226a048))
* **web:** close the mobile menu when a link is tapped ([c1b78f4](https://github.com/yusufaf/nba-central/commit/c1b78f4608d81b79ce16c7014be63ba9e13c0465))
* **web:** fit Cap Five names in their lineup slots and relabel Legend ([6b5fb4d](https://github.com/yusufaf/nba-central/commit/6b5fb4d8eb88408402603a989e2b522d8464de72))
* **web:** follow other tabs' Daily Era saves through storage events ([e5a1d1e](https://github.com/yusufaf/nba-central/commit/e5a1d1e44667c9a596af6bf405294e4138abb97f))
* **web:** keep a newer Daily Era store instead of overwriting it ([32d8255](https://github.com/yusufaf/nba-central/commit/32d8255cb6562e59dc501237c62dd0e707c06321))
* **web:** limit concurrent player stats requests ([f66ed52](https://github.com/yusufaf/nba-central/commit/f66ed5225524f015859bd673f48e75071ddc7116)), closes [#166](https://github.com/yusufaf/nba-central/issues/166)
* **web:** load Scores calendar game counts by month ([db8c307](https://github.com/yusufaf/nba-central/commit/db8c3073528ac299816e4447a5677c483823afc0)), closes [#196](https://github.com/yusufaf/nba-central/issues/196)
* **web:** match the header avatar icon to the name, reword feedback link ([ffe3304](https://github.com/yusufaf/nba-central/commit/ffe3304a01da2218f311c10aee10e195c35a92c5))
* **web:** never let a Daily Era save move a day's game backwards ([0c4ce17](https://github.com/yusufaf/nba-central/commit/0c4ce17c4e6b773debd44c32fa28e7d18ae6b746))
* **web:** only load custom coaches, GMs and players when signed in ([924b0f1](https://github.com/yusufaf/nba-central/commit/924b0f1af60c534d423acdb48fdcb7a50a73b33e)), closes [#225](https://github.com/yusufaf/nba-central/issues/225)
* **web:** re-read Daily Era storage before a guess and adopt another tab's game ([37da6ea](https://github.com/yusufaf/nba-central/commit/37da6ea7521ffc9a66708eaa5013ca9390b38039))
* **web:** roll Daily Era over to the new day at local midnight ([e6837b4](https://github.com/yusufaf/nba-central/commit/e6837b4d1cf9a27a41bd862a4d4c39da621bbed1)), closes [#238](https://github.com/yusufaf/nba-central/issues/238)
* **web:** roll the current season over on Oct 1, not Jan 1 ([60b7d46](https://github.com/yusufaf/nba-central/commit/60b7d469a89a287aae99b3e758e73f6e1a296708)), closes [#163](https://github.com/yusufaf/nba-central/issues/163)
* **web:** show DNP reason next to DNP in box score ([3457bdb](https://github.com/yusufaf/nba-central/commit/3457bdb389a64b3a06b5b6fb3bd1532fd33d2120))
* **web:** stop fetching team logos on every page load ([f0d50c2](https://github.com/yusufaf/nba-central/commit/f0d50c2fc674ee7a1ee40b1c12d9ebbcccae1779))
* **web:** time out player stats requests ([cee6553](https://github.com/yusufaf/nba-central/commit/cee6553861b48f82c570732b071c64925120ad6a)), closes [#166](https://github.com/yusufaf/nba-central/issues/166)


### Performance Improvements

* **web:** drop backdrop blur from fullscreen picker overlays ([d0060fc](https://github.com/yusufaf/nba-central/commit/d0060fc7a5a00e2af1655897942161d2a314d645))

## [0.4.0](https://github.com/yusufaf/nba-central/compare/web-v0.3.0...web-v0.4.0) (2026-10-08)


### Features

* **web:** add a profile card with avatar and stats to Settings ([cec6c8b](https://github.com/yusufaf/nba-central/commit/cec6c8b5f91199ed3cd55c1130f7f65f652860af))
* **web:** add data export and delete to the Settings account tab ([988220a](https://github.com/yusufaf/nba-central/commit/988220aa100e7e82be08436fb452e8e161da7f04))
* **web:** add display preferences to Settings ([c6420b6](https://github.com/yusufaf/nba-central/commit/c6420b618c7bfd7daa56c9b5b1b6be941b30310a)), closes [#124](https://github.com/yusufaf/nba-central/issues/124)
* **web:** add header theme control for signed-out visitors ([5f4868d](https://github.com/yusufaf/nba-central/commit/5f4868d9d0d5150df080ee8e3948603755b3d636)), closes [#147](https://github.com/yusufaf/nba-central/issues/147)
* **web:** add light theme and theme preference ([fe5dfd9](https://github.com/yusufaf/nba-central/commit/fe5dfd9ff8341bf95dcaadd5196df15c7113c565)), closes [#125](https://github.com/yusufaf/nba-central/issues/125)
* **web:** add settings page with server-synced preferences ([19552d3](https://github.com/yusufaf/nba-central/commit/19552d3113244e7dc1e2be322ad92eeac51e3d11)), closes [#122](https://github.com/yusufaf/nba-central/issues/122)
* **web:** add team builder preferences to Settings ([b870405](https://github.com/yusufaf/nba-central/commit/b870405717920782e62e968f3911b98936d733a3))
* **web:** create custom arenas and keep arena details on teams ([93578c7](https://github.com/yusufaf/nba-central/commit/93578c76864d367cb1bdd6a0fe3a2ac861416a89)), closes [#116](https://github.com/yusufaf/nba-central/issues/116)
* **web:** design a court for custom arenas and stand the starters on it ([ad55903](https://github.com/yusufaf/nba-central/commit/ad559036c72c97032e63910682481f8af5ce9795)), closes [#117](https://github.com/yusufaf/nba-central/issues/117)
* **web:** draw freehand on a custom arena's court ([e810236](https://github.com/yusufaf/nba-central/commit/e810236d368ed8fb6891e7ecf7bc1835e9bbdae2)), closes [#118](https://github.com/yusufaf/nba-central/issues/118)
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
