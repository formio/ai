---
'@formio/mcp': patch
---

Build the container image without emulation.

No change to the server itself. The published `formio/mcp` image is now built with one architecture per native runner instead of building `linux/arm64` under QEMU, where `npm install` died with SIGILL on two of three releases and left Docker Hub a version behind. Build time dropped from 128s to about 45s per architecture in parallel.

One consequence for image consumers: the per-architecture builds no longer attach a provenance attestation, because with `push-by-digest` an attestation makes the pushed digest an image index rather than a single-platform manifest, which is not what the manifest join combines. Tags published from 0.8.4 list `amd64` and `arm64` only, where earlier tags also carried two attestation manifests.
