# Research source snapshot manifest

Audit date: 2026-08-28. The workspace could authenticate to GitHub through
`gh api`, but direct `git clone` failed in the runtime with a connection reset.
The listed folders were extracted from GitHub API tarballs so the source review
could still use repository files rather than secondary descriptions. None of the
folders is a Git working tree (`.git` is intentionally absent); treat them as
immutable audit snapshots and do not call them clones.

| Folder | Repository | Default branch | Commit observed | Archive | License file |
| --- | --- | --- | --- | --- | --- |
| [`opentrip`](./opentrip) | `stvlynn/OpenTrip` | `main` | `cfc78a04d0eeba3daaec4b755b110d89938ae4fc` | [`archives/opentrip2.tar.gz`](./archives/opentrip2.tar.gz) | `LICENSE` (Apache-2.0) |
| [`cairn`](./cairn) | `thkleinert/cairn` | `main` | `e75db6a6aabad914fb31cfcd3cb224256ca61269` | [`archives/cairn.tar.gz`](./archives/cairn.tar.gz) | `LICENSE` (MIT) |
| [`bloub`](./bloub) | `jeremy-prt/bloub` | `main` | `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749` | [`archives/bloub.tar.gz`](./archives/bloub.tar.gz) | `LICENSE` (MIT code; visual likeness separately restricted) |
| [`react-masonry-css`](./react-masonry-css) | `paulcollett/react-masonry-css` | `master` | `72dd46dc71742af15b4f3cfcdb7681e7be9f7773` | [`archives/react-masonry-css.tar.gz`](./archives/react-masonry-css.tar.gz) | `LICENSE` (MIT) |
| [`lucide`](./lucide) | `lucide-icons/lucide` | `main` | `be0956479b6fd5c492336a9bf258a7b3b6d11c85b` | [`archives/lucide.tar.gz`](./archives/lucide.tar.gz) | `LICENSE` (ISC) |
| [`simple-icons`](./simple-icons) | `simple-icons/simple-icons` | `develop` | `1bd24ad0645f18ec68b17a087daa5649644bd303` | [`archives/simple-icons.tar.gz`](./archives/simple-icons.tar.gz) | `LICENSE.md` (CC0-1.0) |
| [`better-auth`](./better-auth) | `better-auth/better-auth` | `main` | `9fc749867592536b6e472381581cee8f00f6b59b` | [`archives/better-auth.tar.gz`](./archives/better-auth.tar.gz) | `LICENSE.md` (MIT) |

## Run checks

- `bloub`: `pnpm test` passed (14 files, 211 tests); `pnpm run build` passed
  (Vue typecheck + Vite build).
- `cairn`: `pnpm run build` passed (TypeScript + Vite build + service-worker
  stamp).
- `react-masonry-css`: its checked-in source and `dist/` were read; its legacy
  build script was attempted after a local install but stopped because the
  generated dependency tree could not resolve `@babel/types`.
- `opentrip`, `lucide`, `simple-icons`, and `better-auth`: source and package
  manifests were audited; a full monorepo build was not claimed for this pass.

`archives/opentrip.tar.gz` is the failed zero-byte direct fallback and is kept
only as a transport diagnostic. The usable OpenTrip snapshot is
`archives/opentrip2.tar.gz`.
