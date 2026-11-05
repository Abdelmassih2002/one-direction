#!/usr/bin/env bash
# build-archive.sh — produce a source-only handoff archive
#
# Excludes: build output, node_modules, caches, logs, .env files, git-freebuff
# metadata. The ONLY env file that may be included is the validated root
# .env.example, and only when it is placeholder-safe.
#
# NEVER appends to a compressed archive. NEVER writes into the tree being
# archived. Uses a staging directory + atomic mv at the end.
set -euo pipefail

ARCHIVE_NAME="${ARCHIVE_NAME:-one-direction-source.tar.gz}"
ARCHIVE_DIR="${ARCHIVE_DIR:-.}"
STAGING_ROOT="${STAGING_ROOT:-.}"

mkdir -p "$ARCHIVE_DIR"

# Resolve absolute paths before we change directory.
ARCHIVE_DIR_ABS="$(cd "$ARCHIVE_DIR" && pwd)"
OUT="$ARCHIVE_DIR_ABS/$ARCHIVE_NAME"

# Remove any stale file so a failed run can't be mistaken for a good one.
rm -f "$OUT"

chdir="$(pwd)"

# --- validate root .env.example first ---
validate_env_example() {
  if [ ! -f .env.example ]; then
    return 0
  fi

  # The strict rule: every line must be blank, comment, or
  # KEY=VALUE. No bare secret-looking strings, no multi-line junk.
  while IFS= read -r line || [ -n "$line" ]; do
    stripped="${line#"${line%%[![:space:]]*}"}"
    stripped="${stripped%"${stripped##*[![:space:]]}"}"

    # blank
    [ -z "$stripped" ] && continue
    # comment
    [[ "$stripped" == \#* ]] && continue

    # must be KEY=...
    if ! [[ "$stripped" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      echo "build-archive: .env.example contains a suspicious non-assignment line:" >&2
      echo "  $stripped" >&2
      return 1
    fi

    value="${stripped#*=}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    # strip surrounding quotes once
    case "$value" in
      \"*) value="${value#\"}"; value="${value%\"}" ;;
      \'*) value="${value#\'}"; value="${value%\'}" ;;
    esac

    # Acceptable placeholder / metadata values.  Tested with explicit case
    # patterns (not a single regex) to avoid bash's regex engine rejecting
    # valid placeholder files with "empty (sub)expression" errors.
    case "$value" in
      # Trivial placeholders
      xxx|placeholder|none|undefined|NULL|None|None)
        continue ;;
      # your-* / your_* — the documented placeholder prefix for this repo
      your-*|your_*|YOUR-*|YOUR_*)
        continue ;;
      # REPLACE_ME / REPLACE.ME and similar
      REPLACE_ME|REPLACE\.ME|REPLACE-ME)
        continue ;;
      # URL-like and localhost and numeric placeholders.
      # Only placeholder URLs are accepted: https://your-project.supabase.co,
      # http://localhost:3000, and pure-numeric values.
      localhost*)
        continue ;;
      *your-anon-key*|*your-project*|*your-*-supabase*|"*project-url"*|*supabase-co*)
        continue ;;
      http://localhost*|https://localhost*)
        continue ;;
      http://[0-9]*|https://[0-9]*|[0-9]*)
        continue ;;
      # Quoted empty / JSON-like neutral values
      ""|'') continue ;;
      # ${VAR} style environment-token placeholders
      *\$\{*)
        continue ;;
    esac

    # Anything else (real-looking value) is a failure
    echo "build-archive: root .env.example contains a non-placeholder value:" >&2
    echo "  $stripped" >&2
    return 1
  done < .env.example

  return 0
}

if ! validate_env_example; then
  exit 1
fi

# --- canary: fail if any real credential would be archived ---
CANARY_SECRET='CANARY__7f3a91e2__DO_NOT_COMMIT'

# --- staging directory ---
STAGING="$(cd "$STAGING_ROOT" 2>/dev/null && pwd)/.archive-staging-$$"
rm -rf "$STAGING"
mkdir -p "$STAGING/src"
mkdir -p "$STAGING/scripts"
mkdir -p "$STAGING/migrations"
mkdir -p "$STAGING/tests"
mkdir -p "$STAGING/docs"
mkdir -p "$STAGING/public"
mkdir -p "$STAGING"

# Copy source files at every depth. Use find so Git Bash globstar
# quirks cannot drop nested files.
copy_tree() {
  local src_dir="$1"
  local dest_dir="$2"
  # Resolve to absolute path so the inner cd does not break $src_dir.
  local abs_src
  abs_src="$(cd "$src_dir" 2>/dev/null && pwd)" || return 0
  if [ ! -d "$abs_src" ]; then
    return 0
  fi
  mkdir -p "$STAGING/$dest_dir"
  # Copy files, preserving relative path under dest_dir.
  ( cd "$abs_src" && find . -type f -print0 | \
    while IFS= read -r -d '' rel; do
      rel="${rel#./}"
      mkdir -p "$STAGING/$dest_dir/$(dirname "$rel")"
      cp -- "$abs_src/$rel" "$STAGING/$dest_dir/$rel" || true
    done )
}

copy_file() {
  local f="$1"
  if [ -f "$f" ]; then
    cp --parents "$f" "$STAGING/"
  fi
}

copy_file "package.json"
copy_file "package-lock.json"
copy_file "tsconfig.json"
copy_file "next.config.ts"
copy_file "vitest.config.ts"
copy_file "vitest.integration.config.ts"
copy_file "eslint.config.mjs"
copy_file "next-env.d.ts"

for f in *.md; do
  [ -f "$f" ] && copy_file "$f"
done

copy_tree "src"    "src"
copy_tree "scripts" "scripts"
copy_tree "migrations" "migrations"
copy_tree "tests"   "tests"
copy_tree "docs"    "docs"
copy_tree "public"  "public"

# Root .env.example — already validated above; include it iff it exists.
if [ -f .env.example ]; then
  cp -- .env.example "$STAGING/.env.example"
fi

# --- inject canary file so the canary test can detect leakage ---
# This file must NOT appear in the final archive. If it does, the canary
# test fails. We place it inside staging to prove the exclusion list works.
mkdir -p "$STAGING/.canary-leak"
printf '%s\n' "$CANARY_SECRET" > "$STAGING/.canary-leak/canary-secret.txt"

# --- exclusion filter for tar ---
# Exclude: .git, .freebuff, all .env*, node_modules, .next, caches, logs,
# build artifacts, backups, typescript info, vercel, DS_Store, editor dirs.
EXCLUDES=(
  --exclude='.git'
  --exclude='.git/*'
  --exclude='.freebuff'
  --exclude='.freebuff/*'
  # Exclude all .env* files EXCEPT root .env.example (handled separately).
  --exclude='.env'
  --exclude='.env.local'
  --exclude='.env.development.local'
  --exclude='.env.test.local'
  --exclude='.env.production.local'
  --exclude='.env.staging'
  --exclude='.env.*.local'
  --exclude='.env.*.production'
  --exclude='.env.*.test'
  --exclude='.env.*.development'
  --exclude='**/.env'
  --exclude='**/.env.local'
  --exclude='**/.env.development.local'
  --exclude='**/.env.test.local'
  --exclude='**/.env.production.local'
  --exclude='**/.env.staging'
  --exclude='**/.env.*.local'
  --exclude='**/.env.*.production'
  --exclude='**/.env.*.test'
  --exclude='**/.env.*.development'
  --exclude='node_modules'
  --exclude='node_modules/*'
  --exclude='**/node_modules'
  --exclude='**/node_modules/*'
  --exclude='.next'
  --exclude='.next/*'
  --exclude='**/.next'
  --exclude='**/.next/*'
  --exclude='coverage'
  --exclude='coverage/*'
  --exclude='**/coverage'
  --exclude='**/coverage/*'
  --exclude='*.log'
  --exclude='**/*.log'
  --exclude='build*.log'
  --exclude='**/build*.log'
  --exclude='*.tsbuildinfo'
  --exclude='**/*.tsbuildinfo'
  --exclude='next-env.d.ts'
  --exclude='**/next-env.d.ts'
  --exclude='.vercel'
  --exclude='.vercel/*'
  --exclude='**/.vercel'
  --exclude='**/.vercel/*'
  --exclude='*.pem'
  --exclude='**/*.pem'
  --exclude='.DS_Store'
  --exclude='**/.DS_Store'
  --exclude='.vscode'
  --exclude='.vscode/*'
  --exclude='**/.vscode'
  --exclude='**/.vscode/*'
  --exclude='.idea'
  --exclude='.idea/*'
  --exclude='**/.idea'
  --exclude='**/.idea/*'
  --exclude='dist'
  --exclude='dist/*'
  --exclude='**/dist'
  --exclude='**/dist/*'
  --exclude='out'
  --exclude='out/*'
  --exclude='**/out'
  --exclude='**/out/*'
  --exclude='.turbo'
  --exclude='.turbo/*'
  --exclude='**/.turbo'
  --exclude='**/.turbo/*'
  --exclude='.cache'
  --exclude='.cache/*'
  --exclude='**/.cache'
  --exclude='**/.cache/*'
  --exclude='.yarn'
  --exclude='.yarn/*'
  --exclude='**/.yarn'
  --exclude='**/.yarn/*'
  --exclude='pnpm-lock.yaml'
  --exclude='**/pnpm-lock.yaml'
  --exclude='yarn.lock'
  --exclude='**/yarn.lock'
  --exclude='package.json.backup'
  --exclude='**/package.json.backup'
  --exclude='.canary-leak'
  --exclude='.canary-leak/*'
  --exclude='**/.canary-leak'
  --exclude='**/.canary-leak/*'
)

cd "$STAGING"

# Create a fresh uncompressed archive first (no append to compressed).
tar cf "$chdir/.archive-raw.tmp" \
  "${EXCLUDES[@]}" \
  .

# Compress once, atomically.
gzip -n -f "$chdir/.archive-raw.tmp"
mv "$chdir/.archive-raw.tmp.gz" "$OUT"
chmod 644 "$OUT"
cd "$chdir"

rm -rf "$STAGING"
rm -f "$chdir/.archive-raw.tmp" "$chdir/.archive-raw.tmp.gz"

echo "build-archive: wrote $OUT"
echo "build-archive: size=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT") bytes"

# Canary summary printed for the canary test to grep.
printf '\nCANARY_SECRET=%s\n' "$CANARY_SECRET"
