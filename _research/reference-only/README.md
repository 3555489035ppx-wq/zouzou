# Reference-only sources

This directory is intentionally isolated from production imports.

## turistar

The V4 brief identifies turistar as AGPL-only. It is not cloned or copied into
the local product. If it is fetched later, keep it under this directory, record
the exact commit and license in `docs/THIRD_PARTY.md`, and do not import any
source or asset into `src` without a separate copyleft/compliance decision.

## Other private visual references

Bloub's MIT code snapshot is audited under [`../bloub`](../bloub), while any
private local adaptation belongs under `src/private-assets/bloub/` and must not
be published as a general-purpose public asset. Code license and visual/trademark
rights are separate questions.
