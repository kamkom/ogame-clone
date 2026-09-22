# SQLite driver that installs with Node alone

Research for [#4](https://github.com/kamkom/ogame-clone/issues/4), part of the map [#1](https://github.com/kamkom/ogame-clone/issues/1).
Researched 2026-09-22.

**Question.** Which SQLite driver lets `npm install && npm start` work on a clean macOS, Linux or Windows machine that has only Node installed (no Python, no C/C++ compiler, no Docker)?

## Answer

- **Use Node's built-in `node:sqlite` (`DatabaseSync`).** There is nothing to install and no native binary to download, so there is no platform matrix and no build fallback that can break. It is synchronous, which suits a single-process local game server. Since Node v24.15.0 / v25.7.0 it is a **Release Candidate (stability 1.2)** and no longer prints an `ExperimentalWarning`.
- **Put `"engines": { "node": ">=24.15.0" }` in `package.json`.** That is the first Node LTS line where `node:sqlite` is a Release Candidate with no warning. It also covers Node 26, which becomes LTS on 2026-10-28.
- **Keep `better-sqlite3@13` as the drop-in fallback.** It is stable and mature, and since v13 its prebuilt binaries ship inside the npm tarball with no install step. Switch to it if `node:sqlite` has a blocking gap, or if the query layer we pick only supports it.
- **Reject `@libsql/client` and `sql.js`.** `@libsql/client` is async-only and depends on a per-platform native binary with no Windows ARM64 build. `sql.js` keeps the whole database in memory and never writes to disk itself.

## Comparison

| | `node:sqlite` | `better-sqlite3` 13.0.3 | `@libsql/client` 0.18.0 | `sql.js` 1.14.2 |
|---|---|---|---|---|
| What gets installed | Nothing (built into Node) | npm tarball with 8 bundled N-API `.node` prebuilds | JS client plus `libsql` 0.5.x, which pulls a per-platform native optional dependency (Rust/Neon) | Pure JS + WASM |
| Needs Python/compiler on a clean machine? | No | No on darwin/linux(glibc+musl)/win32 × x64/arm64. **Other targets:** it doesn't compile on install and fails at `require` time. | No on the 9 published targets. **No win32-arm64 build.** | No |
| Stability | 1.2 Release Candidate (Node ≥24.15 / ≥25.7). Still 1.1 "Active development" on Node 22. | Stable, mature (v13 = first N-API release, 2026-07-21) | 0.x. Turso itself labels it "battle-tested" but points new work at `@tursodatabase/*` | Stable, but its own docs say to use a native binding in Node |
| Min Node | 22.13 unflagged (with warning). **24.15 without warning.** | `engines: >=22` (CI tests 22/24/25/26) | No `engines` field | Any |
| Sync / async | Sync only | Sync only | Async only (Promises) | Sync (init is async) |
| Transactions | SQL `BEGIN`/`COMMIT`/`ROLLBACK` via `db.exec`; `db.isTransaction` (v24.0+). No helper. | `db.transaction(fn)` helper (nesting via savepoints) | `client.transaction()` (interactive) and `client.batch()` | SQL `BEGIN`/`COMMIT` |
| On-disk file | Yes | Yes | Yes (`file:` URL) | **No.** In-memory; you `export()` a `Uint8Array` and write it yourself |
| Drizzle | `drizzle-orm/node-sqlite`: **only in 1.0 RC** (`drizzle-orm@rc` = 1.0.0-rc.4), not in `latest` 0.45.3 | `drizzle-orm/better-sqlite3` (latest + RC) | `drizzle-orm/libsql` (latest + RC) | `drizzle-orm/sql-js` (latest + RC) |
| Kysely | Community dialect `kysely-node-native-sqlite` | **Built-in** `SqliteDialect` | Community `@libsql/kysely-libsql` | Community (WASM) |

## Findings and sources

### `node:sqlite`

- **Stability history.** Added in v22.5.0 behind `--experimental-sqlite`. Unflagged in v23.4.0 / v22.13.0 but "still experimental". Marked **Release Candidate** in v25.7.0 (released 2026-02-24) and backported to **v24.15.0** (released 2026-04-16). Sources: [Node v26 docs](https://nodejs.org/api/sqlite.html), [Node v24 docs](https://nodejs.org/docs/latest-v24.x/api/sqlite.html), [v24.15.0 release notes](https://github.com/nodejs/node/releases/tag/v24.15.0).
- **Warning removed.** PR [nodejs/node#61262](https://github.com/nodejs/node/pull/61262) ("mark as release candidate and remove the experimental warning") deletes `emitExperimentalWarning('SQLite')` from `lib/sqlite.js`.
  - Checked locally: Node **v24.14.0** still prints `ExperimentalWarning: SQLite is an experimental feature`, so the `engines` floor must be 24.15.0, not 24.0.
- **Node 22.** The [Node 22 docs](https://nodejs.org/docs/latest-v22.x/api/sqlite.html) (v22.23.2) still say "1.1 – Active development" and lack newer APIs such as `createTagStore()`.
- **API.** The module is fully synchronous ("All APIs exposed by this class execute synchronously"). Main classes: `DatabaseSync`, `StatementSync`, `Session`, `SQLTagStore`.
  - Transactions are plain SQL through `db.exec('BEGIN')` etc.
  - `db.isTransaction` was added in v24.0.0.
  - Other additions in the 24 line: `createTagStore()` (v24.9), `setAuthorizer()` (v24.10), the `defensive` option (v24.12, on by default in v24.14), `limits` (v24.15), `serialize()` / `deserialize()` (v24.16).
  - The bundled SQLite is 3.51.2 on local v24.14.0.
- **Release lines** ([nodejs/Release schedule.json](https://github.com/nodejs/Release/blob/main/schedule.json)):

  | Line | Status on 2026-09-22 |
  |---|---|
  | 20 | EOL (2026-04-30) |
  | 22 | Maintenance until 2027-04-30 |
  | 24 | Active LTS; moves to maintenance on 2026-10-20; EOL 2028-04-30 |
  | 25 | EOL (2026-06-01) |
  | 26 | Current; becomes LTS on 2026-10-28; EOL 2029-04-30 |

### `better-sqlite3`

- **Current version.** 13.0.3 is `latest` (npm, 2026-08-05) with `engines.node: ">=22"`. The 12.x line declared `20.x || … || 26.x`.
- **v13.0.0 release notes.** [v13.0.0](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0) is "the first version … to run on the N-API". It removed `prebuild-install`, and prebuilt binaries "are now published directly with the `better-sqlite3` code itself". Because they target N-API, one binary works across Node versions.
- **Bundled prebuilds.** Checked in the published 13.0.3 tarball: `prebuilds/` contains `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `linuxmusl-x64`, `linuxmusl-arm64`, `win32-x64` and `win32-arm64` (about 2 MB each). The loader is `lib/binding.js`.
- **Linux glibc floor.** The Linux prebuilds are built on `ubuntu-22.04` / `ubuntu-22.04-arm` ([build.yml](https://github.com/WiseLibs/better-sqlite3/blob/master/.github/workflows/build.yml); [PR #1510](https://github.com/WiseLibs/better-sqlite3/pull/1510) moved ARM to 22.04 so Debian 12 works). In practice that is roughly glibc ≥ 2.35. Very old distros fail to load the binary.
- **Windows install bug (fixed).** v13.0.0 and v13.0.1 still ran node-gyp on install and failed on Windows without Python/MSVC ([issue #1503](https://github.com/WiseLibs/better-sqlite3/issues/1503)). [v13.0.2](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.2) added `"gypfile": false` ([PR #1505](https://github.com/WiseLibs/better-sqlite3/pull/1505)). **Pin `^13.0.2` or later.**
- **Fallback behaviour.** This is inferred from the 13.0.3 source, not documented.
  - With `gypfile: false` and no install script, npm doesn't compile anything.
  - On a platform/arch with no prebuild, `getBinding()` falls through to `build/Release/better_sqlite3.node`, which doesn't exist, so `require` throws at runtime.
  - Recovering needs a manual `npm run build-release` inside the package, which requires Python and a C++20 compiler.
  - The v13.0.0 note says "it should compile during install as before", but that describes v13.0.0/13.0.1, before `gypfile: false`.
- **Checked locally.** On macOS arm64 with Node 24.14.0, `npm install better-sqlite3@13.0.3` added 2 packages in about 0.5 s and ran no build. `db.transaction()` worked, and it bundles SQLite 3.53.4.
- **CI.** Tests run on Node 22, 24, 25 and 26 on ubuntu-22.04, macos-15, macos-15-intel and windows-2022 ([build.yml](https://github.com/WiseLibs/better-sqlite3/blob/master/.github/workflows/build.yml)).

### `@libsql/client`

- **Dependencies.** 0.18.0 depends on `libsql` ^0.5.28. That package ships native binaries as `optionalDependencies`: `@libsql/darwin-x64`, `darwin-arm64`, `linux-x64-gnu`, `linux-x64-musl`, `linux-arm64-gnu`, `linux-arm64-musl`, `linux-arm-gnueabihf`, `linux-arm-musleabihf` and `win32-x64-msvc` (npm registry). **There is no win32-arm64 build.** Neither package declares `engines`.
- **API.** Async only. Transactions are available through `batch()` and interactive `transaction()`. Most of the feature set (remote Turso, embedded replicas, vector search, sync) is irrelevant for a local-only game.
- **Status.** The [libsql-client-ts README](https://github.com/tursodatabase/libsql-client-ts) now steers new users to `@tursodatabase/serverless`. The [libsql-js README](https://github.com/tursodatabase/libsql-js) promotes the from-scratch Rust "Turso database" (beta). The libsql line looks like it is being superseded.

### `sql.js`

- **Install.** Pure WASM, so it installs anywhere with nothing to compile.
- **Persistence.** The [README](https://github.com/sql-js/sql.js) says it keeps "the entire database in memory", cannot "work on database files directly", and recommends a native binding for Node. Persisting means calling `db.export()` and writing the file ourselves, and a crash between writes loses data. That is a poor fit for a game server that must keep queue state.

### Type-safety layers

- **Drizzle.**
  - `latest` 0.45.3 ships `better-sqlite3`, `libsql` and `sql-js` drivers, but **no `node-sqlite`**. Checked in the published tarball.
  - `drizzle-orm@rc` (1.0.0-rc.4, 2026-06-27) adds `drizzle-orm/node-sqlite`.
  - In 1.0 RC the node-sqlite, better-sqlite3 and sql-js sessions are all `'sync'`-mode SQLite sessions, and libsql is `'async'`.
  - The [Drizzle SQLite getting-started page](https://orm.drizzle.team/docs/get-started-sqlite) lists `node:sqlite` alongside `libsql` and `better-sqlite3`.
  - `drizzle-kit` `rc` is also 1.0.0-rc.4.
- **Kysely.**
  - 0.29.6 (`engines: >=22`) has a built-in `SqliteDialect`. It is written against better-sqlite3's interface and needs `statement.reader`, `all`, `run` and `iterate`.
  - `node:sqlite` needs the community dialect [`kysely-node-native-sqlite`](https://github.com/wolfie/kysely-node-native-sqlite). libsql needs [`kysely-libsql`](https://github.com/libsql/kysely-libsql). Both are listed on [kysely.dev/docs/dialects](https://kysely.dev/docs/dialects).

## Trade-offs of the recommendation

- **For `node:sqlite`.**
  - It fits the "Node only" standing decision most literally.
  - It has no native artefact, so there's no glibc floor, no missing-arch case, and no chance of an install-time node-gyp regression like better-sqlite3 13.0.0/13.0.1 had.
  - It adds no dependency to audit.
  - It is synchronous, like better-sqlite3, so switching between the two is cheap.
- **Against `node:sqlite`.**
  - It is RC, not Stable (2), so minor API changes are still possible.
  - Its SQLite version follows the Node release.
  - It has no `transaction(fn)` helper.
  - Drizzle support exists only in the 1.0 RC line.
- **Mitigation.** Keep all SQL behind one persistence module. If we use Drizzle, both `drizzle-orm/node-sqlite` and `drizzle-orm/better-sqlite3` are sync-mode drivers with the same query API. If `node:sqlite` or Drizzle 1.0 RC bites, swap to `better-sqlite3@^13.0.2`, which needs no build on the three target OSes on x64/arm64.
