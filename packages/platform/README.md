# Platform packages

Each directory here is one npm platform package. A platform package carries
the release binary of exactly one operating system and architecture pair, the
digest of that binary, and the operating system and architecture it applies to
in npm's own vocabulary. The registry resolves exactly one of them for a host,
and the main package installs it as an optional dependency.

These packages are published to the npm registry by the release pipeline
(`.github/workflows/publish.yml`). They are not consumed from this repository.

## Naming convention

The package name is `@spec-driven-steroids/<npm-os>-<npm-cpu>`, where the two
suffixes are npm's own values for the operating system and the architecture:

| Go build target | npm `os` | npm `cpu` | Package |
| --- | --- | --- | --- |
| `linux/amd64` | `linux` | `x64` | `@spec-driven-steroids/linux-x64` |
| `linux/arm64` | `linux` | `arm64` | `@spec-driven-steroids/linux-arm64` |
| `darwin/amd64` | `darwin` | `x64` | `@spec-driven-steroids/darwin-x64` |
| `darwin/arm64` | `darwin` | `arm64` | `@spec-driven-steroids/darwin-arm64` |
| `windows/amd64` | `win32` | `x64` | `@spec-driven-steroids/win32-x64` |
| `windows/arm64` | `win32` | `arm64` | `@spec-driven-steroids/win32-arm64` |

The suffix is therefore the host identity npm itself reports: a host resolves
its package as `@spec-driven-steroids/${process.platform}-${process.arch}`.
Go names the same pairs differently (`amd64` is `x64`, `windows` is `win32`),
so the release pipeline maps the build targets onto this table explicitly.

## What each manifest declares

| Field | Meaning |
| --- | --- |
| `os` | The operating system the package applies to, in npm's vocabulary |
| `cpu` | The architecture the package applies to, in npm's vocabulary |
| `bin` | The binary the package carries, as `sds` and `spec-driven-steroids` |
| `sha256` | The SHA-256 digest of the binary the package carries |

## The digest is a placeholder in this repository

The `sha256` field in this repository is a placeholder: it holds
`0000000000000000000000000000000000000000000000000000000000000000` and does
not describe any binary, because the binary is not committed here.

The release pipeline fills the field at publish time. It copies the built
binary into `bin/`, computes the digest of the copied file, writes that digest
into the manifest, and cross-checks it against the checksum published with the
GitHub Release before the package is published. The installer reads the digest
from the manifest of the package the registry resolved, so a package that was
published without its digest filled is refused rather than installed.

The binary itself is not committed either. The `bin/` directory of each
platform package is ignored, and the release pipeline creates it.
