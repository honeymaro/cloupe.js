# Test fixtures

The `.cloupe` files in this directory are local, git-tracked fixtures that
exercise the `File` / `Blob` reader path:

| File                     | Source                              | Exercises                                 |
| ------------------------ | ----------------------------------- | ----------------------------------------- |
| `AMLTutorial.cloupe`     | Loupe Browser installer / tutorials | Legacy aliases, multi-library aggregation |
| `ATACTutorial.cloupe`    | Loupe Browser installer / tutorials | ATAC peak features                        |
| `SpatialTutorial.cloupe` | Loupe Browser installer / tutorials | Older spatial spec, MicronsPerPixel       |

## URL-driven fixtures (opt-in, network required)

A second set of fixtures lives directly on `cf.10xgenomics.com`. These are
current-spec producer files (Cell Ranger ≥ 7.1, Space Ranger ≥ 4.1.0) read
**via HTTP Range Requests** — only a few MB of network traffic per suite, no
local download.

| URL fixture                                       | Approx. upstream size | Exercises                               |
| ------------------------------------------------- | --------------------- | --------------------------------------- |
| NSCLC 157k multiplex (Cell Ranger 7.1.0)          | 1.1 GB                | Canonical keys, modern Loupe 9.1        |
| Visium HD 11 mm Mouse Embryo (Space Ranger 4.1.0) | 5.26 GB               | Visium HD 11 mm spatial, canonical keys |

Run them with:

```bash
pnpm test:network
```

These suites are excluded from the default `pnpm test:run` so PRs do not
depend on network availability. CI may opt in explicitly when desired.

## Browser test environment

The `browser` Vitest project (Playwright + Chromium) excludes
`tests/integration.test.ts` entirely.

We probed `cf.10xgenomics.com` and confirmed it does **not** return
`Access-Control-Allow-Origin` headers, so browser-context URL fetch would be
blocked by CORS regardless. URL fixtures therefore run only under the
`node-network` project. If 10x Genomics adds permissive CORS in the future,
adding a `browser-network` project becomes straightforward.

## Why not move the local fixtures out of git?

An earlier proposal (`docs/superpowers/plans/2026-05-11-fixture-download-script.md`)
explored downloading the local fixtures on demand. The URL-driven approach
above supersedes it: local fixtures stay in git (they cover the `File`/`Blob`
path and legacy formats), and current-spec coverage comes from Range-driven
URL fixtures.
