# Changelog

## [2.0.0](https://github.com/udondan/duolingo/compare/v1.0.2...v2.0.0) (2026-10-29)


### ⚠ BREAKING CHANGES

* the `duolingo-mcp` binary is replaced by `duolingo mcp`, and the `@udondan/duolingo/server` export is removed.

### Features

* add duolingo CLI with mcp subcommand ([#55](https://github.com/udondan/duolingo/issues/55)) ([41b3d82](https://github.com/udondan/duolingo/commit/41b3d8282a6ff0ffe1e3446ff2ad01e69013c376))
* publish the Docker image udondan/duolingo to Docker Hub ([#56](https://github.com/udondan/duolingo/issues/56)) ([650d361](https://github.com/udondan/duolingo/commit/650d3610f854994901c0418058e716653d727aaa))


### Dependencies

* **deps:** lock file maintenance ([#49](https://github.com/udondan/duolingo/issues/49)) ([f6b9da4](https://github.com/udondan/duolingo/commit/f6b9da4a4e452e224c1f3b431c28e17ff5c63185))
* **deps:** update dependency @modelcontextprotocol/sdk to v1.32.2 ([#50](https://github.com/udondan/duolingo/issues/50)) ([be87b89](https://github.com/udondan/duolingo/commit/be87b8938fcfc9edefd35401730206541bd5958e))
* **deps:** update dependency eslint-plugin-prettier to v5.5.7 ([#46](https://github.com/udondan/duolingo/issues/46)) ([3ddfe1d](https://github.com/udondan/duolingo/commit/3ddfe1d9023e8e2ab8699b883434a9e54e715c04))
* **deps:** update dependency typescript-eslint to v8.71.2 ([#44](https://github.com/udondan/duolingo/issues/44)) ([daae16d](https://github.com/udondan/duolingo/commit/daae16dc8e25ebf9dff59a9a92b30df66d2ee4e5))
* **deps:** update dependency typescript-eslint to v8.72.1 ([#54](https://github.com/udondan/duolingo/issues/54)) ([b74e596](https://github.com/udondan/duolingo/commit/b74e596fe4325dfab7585efe663b6de8f08eac19))
* **deps:** update dependency zod to v4.6.7 ([#45](https://github.com/udondan/duolingo/issues/45)) ([4fab786](https://github.com/udondan/duolingo/commit/4fab786c7e87b205daf02a5eb913637d0436685e))
* **deps:** update jdx/mise-action action to v5 ([#53](https://github.com/udondan/duolingo/issues/53)) ([00cd563](https://github.com/udondan/duolingo/commit/00cd5631585b1032f594d83106ae2fc37dce09b8))
* **deps:** update node.js to v26.12.0 ([#47](https://github.com/udondan/duolingo/issues/47)) ([72dcc50](https://github.com/udondan/duolingo/commit/72dcc508dd4a71f76129d123da3d208ed275d494))
* **deps:** update udondan/wait-for-turn to v1.4.0 ([#41](https://github.com/udondan/duolingo/issues/41)) ([6ba79c8](https://github.com/udondan/duolingo/commit/6ba79c898cbc68f446f6ab7c1a7aa76a34a3a568))
* **deps:** update vitest monorepo to v5.0.4 ([#43](https://github.com/udondan/duolingo/issues/43)) ([cdabf3d](https://github.com/udondan/duolingo/commit/cdabf3d5f012cfb115004cca4591a47a40506b2f))
* **deps:** update vitest monorepo to v5.0.5 ([#48](https://github.com/udondan/duolingo/issues/48)) ([7a17c2c](https://github.com/udondan/duolingo/commit/7a17c2c6de392ad9895eec4175084960852df02d))

## [1.0.2](https://github.com/udondan/duolingo/compare/v1.0.1...v1.0.2) (2026-10-14)


### Bug Fixes

* package.json & package-lock.json to reduce vulnerabilities ([f8d816e](https://github.com/udondan/duolingo/commit/f8d816e11a01b33d22f327db9be45c91a762a45e))


### Dependencies

* **deps:** [Snyk] Security upgrade zod from 4.6.5 to 4.6.6 ([#40](https://github.com/udondan/duolingo/issues/40)) ([f8d816e](https://github.com/udondan/duolingo/commit/f8d816e11a01b33d22f327db9be45c91a762a45e))
* **deps:** update actions/setup-node action to v7.1.0 ([#35](https://github.com/udondan/duolingo/issues/35)) ([a3f3469](https://github.com/udondan/duolingo/commit/a3f3469a705d3c1840c7d3f46d47c1cab2038f0a))
* **deps:** update dependency @modelcontextprotocol/sdk to v1.32.1 ([#36](https://github.com/udondan/duolingo/issues/36)) ([96ee745](https://github.com/udondan/duolingo/commit/96ee745c7f4543d0cc48e3097a9e159a4528dacd))
* **deps:** update dependency @types/node to v24.19.2 ([#33](https://github.com/udondan/duolingo/issues/33)) ([89695a4](https://github.com/udondan/duolingo/commit/89695a4cf3742e00151d34040e249578789d24c1))
* **deps:** update lint tooling ([#37](https://github.com/udondan/duolingo/issues/37)) ([fd3ec47](https://github.com/udondan/duolingo/commit/fd3ec47e878cd3822196ec36a00fcb0a70184192))
* **deps:** update node.js to v26.11.1 ([#38](https://github.com/udondan/duolingo/issues/38)) ([7e8dc54](https://github.com/udondan/duolingo/commit/7e8dc54acc4366fada251e02578e6bbd81f733bc))
* **deps:** update vitest monorepo to v5.0.3 ([#34](https://github.com/udondan/duolingo/issues/34)) ([347f1d4](https://github.com/udondan/duolingo/commit/347f1d42e0cb96e15b080ffe7fb1d22a0ad375b7))

## [1.0.1](https://github.com/udondan/duolingo/compare/v1.0.0...v1.0.1) (2026-09-30)


### Bug Fixes

* **deps:** pin dependencies ([#5](https://github.com/udondan/duolingo/issues/5)) ([a9a0387](https://github.com/udondan/duolingo/commit/a9a038701f236dcf450ad570ae642732f71410cf))
* handle users whose current course is not a language course ([#4](https://github.com/udondan/duolingo/issues/4)) ([90b4890](https://github.com/udondan/duolingo/commit/90b489067cc455d263ce1782be45c7d2430967b4))
* remove getLeaderboard, Duolingo removed its endpoint ([#27](https://github.com/udondan/duolingo/issues/27)) ([64a584c](https://github.com/udondan/duolingo/commit/64a584ce8a13b88e6395fc8834dd3b0c4912a58b))


### Dependencies

* **deps:** update actions/checkout action to v7 ([#16](https://github.com/udondan/duolingo/issues/16)) ([e2a8db8](https://github.com/udondan/duolingo/commit/e2a8db88814472343fee41874a5cb2b8b58fda8b))
* **deps:** update actions/setup-node action to v7 ([#19](https://github.com/udondan/duolingo/issues/19)) ([890da98](https://github.com/udondan/duolingo/commit/890da98eb9ae07538e70c401a81c706add8cae0a))
* **deps:** update dependency @modelcontextprotocol/sdk to v1.30.1 ([#13](https://github.com/udondan/duolingo/issues/13)) ([156e398](https://github.com/udondan/duolingo/commit/156e39836793b96ee425f01569a691030b3d2d96))
* **deps:** update dependency @modelcontextprotocol/sdk to v1.31.0 ([#24](https://github.com/udondan/duolingo/issues/24)) ([0956659](https://github.com/udondan/duolingo/commit/0956659c6664fe54be722bc151ff4d0afefa95cb))
* **deps:** update dependency @types/node to v22.20.4 ([#9](https://github.com/udondan/duolingo/issues/9)) ([14e21bc](https://github.com/udondan/duolingo/commit/14e21bc18139c6e93a5cbe5dc0b7395488b2db93))
* **deps:** update dependency @types/node to v24 ([#21](https://github.com/udondan/duolingo/issues/21)) ([e812e8b](https://github.com/udondan/duolingo/commit/e812e8bb491ce1863247d808f998376f9f8b143c))
* **deps:** update dependency axios to v1.20.0 ([#14](https://github.com/udondan/duolingo/issues/14)) ([8ce505d](https://github.com/udondan/duolingo/commit/8ce505d59714e8efafc04bb91fcd532d18e757ab))
* **deps:** update dependency eslint to v10.11.0 ([#11](https://github.com/udondan/duolingo/issues/11)) ([12a4003](https://github.com/udondan/duolingo/commit/12a4003e8eb80deecd811972a17194a3db3fac45))
* **deps:** update dependency eslint-plugin-prettier to v5.5.6 ([#8](https://github.com/udondan/duolingo/issues/8)) ([dbef606](https://github.com/udondan/duolingo/commit/dbef6068f46e2de7907c021fec908fc1dd9a3593))
* **deps:** update dependency prettier to v3.9.9 ([#12](https://github.com/udondan/duolingo/issues/12)) ([bb4770d](https://github.com/udondan/duolingo/commit/bb4770d1d66cb21031d356a801146d11aa08799a))
* **deps:** update dependency tsx to v4.23.15 ([#15](https://github.com/udondan/duolingo/issues/15)) ([e482f9e](https://github.com/udondan/duolingo/commit/e482f9eaf7927a7801f503610ca3a8334841cef7))
* **deps:** update dependency typescript-eslint to v8.70.1 ([#18](https://github.com/udondan/duolingo/issues/18)) ([dfe5096](https://github.com/udondan/duolingo/commit/dfe509660c806d5611581d5f9e4c481507e800ce))
* **deps:** update dependency zod to v4 ([#20](https://github.com/udondan/duolingo/issues/20)) ([e88ea4f](https://github.com/udondan/duolingo/commit/e88ea4f2df5adca4a0fa88ccf9b7c99a40cc9810))
* **deps:** update vitest monorepo to v3.2.7 ([#6](https://github.com/udondan/duolingo/issues/6)) ([84fea25](https://github.com/udondan/duolingo/commit/84fea25c2a342ab09d0e50d1f08ca8286d196e82))
* **deps:** update vitest monorepo to v5 ([#22](https://github.com/udondan/duolingo/issues/22)) ([7cc57f8](https://github.com/udondan/duolingo/commit/7cc57f8c7740e4f69acc90c9c8de8ae54e8ca735))
