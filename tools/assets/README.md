# ODD TIDE asset tools

The live island already ships its processed assets. Ordinary development needs `bun install --frozen-lockfile`, not a fresh download or terrain bake. This folder supports asset maintenance and reconstruction of specific outputs.

| Tool | Purpose |
| --- | --- |
| [fetch-assets.ts](fetch-assets.ts) | Source acquisition and processing for the recorded asset set. Inspect its declared URLs and outputs before running it. |
| [build-terrain.ts](build-terrain.ts) | Builds the island's terrain assets. |
| [bleed-foliage.mjs](bleed-foliage.mjs) | Prepares foliage image edges for filtered rendering. |

Use [assets.manifest.json](../../assets.manifest.json) and [CREDITS.md](../../CREDITS.md) as the provenance records: source, author, licence, hashes and processing. Original downloads belong in ignored `assets-src/`; processed runtime outputs belong in `public/`. Keep acquisitions and outputs project-local.

For a changed asset, verify its source and licence, retain the original hash, record every processing step and update the manifest and credits before publication. Review it in the actual scene and at its intended quality tier. A tooling success is not a visual-quality result.

Collection tool paths and past sourcing decisions are workstation context, not dependencies of a fresh clone. Do not assume this directory's older provisioning notes describe the current shipped asset set. Poly Haven website downloads and API access have separate terms; these tools do not grant API access.
