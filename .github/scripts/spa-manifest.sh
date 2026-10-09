#!/usr/bin/env bash
# Fingerprint a built SPA directory so CD can prove production gets the exact
# files that staging verified.
#
# Usage: spa-manifest.sh <dist-dir>
# Prints two lines: "files=<count>" and "sha256=<hex>". The checksum is the
# sha256 of a manifest listing "<sha256>  <relative path>" for every file,
# sorted byte-wise, so it changes if any file is added, removed, renamed or edited.
set -euo pipefail

dir="${1:?usage: spa-manifest.sh <dist-dir>}"
[ -f "$dir/index.html" ] || { echo "No index.html in $dir" >&2; exit 1; }

manifest="$(cd "$dir" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum)"
echo "files=$(printf '%s\n' "$manifest" | wc -l | tr -d ' ')"
echo "sha256=$(printf '%s\n' "$manifest" | sha256sum | cut -d' ' -f1)"
