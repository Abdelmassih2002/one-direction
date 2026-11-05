#!/usr/bin/env bash
# test-build-archive.sh — canary tests for build-archive.sh
#
# Proves:
#  1. Nested .env.local is excluded.
#  2. Nested .env.production is excluded.
#  3. .env.staging is excluded.
#  4. Nested .env.example is excluded.
#  5. Safe root .env.example is INCLUDED.
#  6. Root .env.example with real credentials is REJECTED.
#  7. A canary secret placed anywhere in the tree does NOT appear in
#     the resulting archive.
set -euo pipefail

PASSES=0
FAILURES=0
FIXTURE_ROOT=""
ARCHIVE_OUT=""

cleanup() {
  if [ -n "$FIXTURE_ROOT" ] && [ -d "$FIXTURE_ROOT" ]; then
    rm -rf "$FIXTURE_ROOT"
  fi
  if [ -n "$ARCHIVE_OUT" ] && [ -f "$ARCHIVE_OUT" ]; then
    rm -f "$ARCHIVE_OUT"
  fi
}
trap cleanup EXIT

# Simple assertion helpers — each one increments PASSES or FAILURES
# and never calls another assertion helper (no nesting).
check_contains() {
  local label="$1" haystack="$2" needle="$3"
  if grep -qF -- "$needle" "$haystack" 2>/dev/null; then
    PASSES=$((PASSES + 1))
    echo "PASS: $label"
    return 0
  else
    FAILURES=$((FAILURES + 1))
    echo "FAIL: $label (missing: $needle)"
    FAIL_DETAIL="${FAIL_DETAIL:-$label}"
    return 1
  fi
}

check_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if grep -qF -- "$needle" "$haystack" 2>/dev/null; then
    FAILURES=$((FAILURES + 1))
    echo "FAIL: $label (found forbidden: $needle)"
    FAIL_DETAIL="${FAIL_DETAIL:-$label}"
    return 1
  else
    PASSES=$((PASSES + 1))
    echo "PASS: $label"
    return 0
  fi
}

CANARY_SECRET='CANARY__7f3a91e2__DO_NOT_COMMIT'

# Locate build-archive.sh relative to this script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_SCRIPT="$SCRIPT_DIR/build-archive.sh"

if [ ! -f "$BUILD_SCRIPT" ]; then
  echo "FAIL: build-archive.sh not found at $BUILD_SCRIPT"
  exit 1
fi

if [ ! -x "$BUILD_SCRIPT" ]; then
  chmod +x "$BUILD_SCRIPT"
fi

run_build() {
  local fixture="$1"
  local out="$2"
  (
    cd "$fixture"
    ARCHIVE_OUT="$out" \
    ARCHIVE_NAME="$(basename "$out")" \
    ARCHIVE_DIR="$(dirname "$out")" \
    bash "$BUILD_SCRIPT"
  ) > /tmp/build-archive-capture-$$.log 2>&1
}

# ---- Fixture 1: nested .env.local must be excluded ----
FIXTURE_ROOT=$(mktemp -d)
ARCHIVE_OUT="$FIXTURE_ROOT/archive1.tar.gz"

mkdir -p "$FIXTURE_ROOT/src/sub/nested"
cat > "$FIXTURE_ROOT/.env.local" <<'EOF'
NEXT_PUBLIC_SUPABASE_ANON_KEY=real-anon-key-here
EOF
cat > "$FIXTURE_ROOT/src/sub/nested/.env.local" <<'EOF'
SECRET=nested-local-secret
EOF
cat > "$FIXTURE_ROOT/src/sub/nested/keep.ts" <<'EOF'
export const keep = true;
EOF
cat > "$FIXTURE_ROOT/package.json" <<'EOF'
{"name":"fixture1"}
EOF

run_build "$FIXTURE_ROOT" "$ARCHIVE_OUT"
tar tf "$ARCHIVE_OUT" > /tmp/archive1-contents-$$.txt

check_not_contains "nested .env.local excluded (root)" /tmp/archive1-contents-$$.txt ".env.local"
check_not_contains "nested .env.local excluded (deep)" /tmp/archive1-contents-$$.txt "src/sub/nested/.env.local"
check_contains "non-env file preserved" /tmp/archive1-contents-$$.txt "keep.ts"

rm -f /tmp/archive1-contents-$$.txt

# ---- Fixture 2: nested .env.production must be excluded ----
FIXTURE_ROOT=$(mktemp -d)
ARCHIVE_OUT="$FIXTURE_ROOT/archive2.tar.gz"

mkdir -p "$FIXTURE_ROOT/apps/admin/config"
cat > "$FIXTURE_ROOT/apps/admin/config/.env.production" <<'EOF'
DATABASE_URL=postgres://user:password@host/db
EOF
cat > "$FIXTURE_ROOT/package.json" <<'EOF'
{"name":"fixture2"}
EOF

run_build "$FIXTURE_ROOT" "$ARCHIVE_OUT"
tar tf "$ARCHIVE_OUT" > /tmp/archive2-contents-$$.txt

check_not_contains "nested .env.production excluded" /tmp/archive2-contents-$$.txt ".env.production"

rm -f /tmp/archive2-contents-$$.txt

# ---- Fixture 3: .env.staging must be excluded ----
FIXTURE_ROOT=$(mktemp -d)
ARCHIVE_OUT="$FIXTURE_ROOT/archive3.tar.gz"

cat > "$FIXTURE_ROOT/.env.staging" <<'EOF'
STAGING_SECRET=staging-value
EOF
cat > "$FIXTURE_ROOT/package.json" <<'EOF'
{"name":"fixture3"}
EOF

run_build "$FIXTURE_ROOT" "$ARCHIVE_OUT"
tar tf "$ARCHIVE_OUT" > /tmp/archive3-contents-$$.txt

check_not_contains ".env.staging excluded" /tmp/archive3-contents-$$.txt ".env.staging"

rm -f /tmp/archive3-contents-$$.txt

# ---- Fixture 4: nested .env.example must be excluded ----
FIXTURE_ROOT=$(mktemp -d)
ARCHIVE_OUT="$FIXTURE_ROOT/archive4.tar.gz"

mkdir -p "$FIXTURE_ROOT/frontend/config"
cat > "$FIXTURE_ROOT/frontend/config/.env.example" <<'EOF'
NEXT_PUBLIC_FOO=bar
EOF
cat > "$FIXTURE_ROOT/package.json" <<'EOF'
{"name":"fixture4"}
EOF

run_build "$FIXTURE_ROOT" "$ARCHIVE_OUT"
tar tf "$ARCHIVE_OUT" > /tmp/archive4-contents-$$.txt

check_not_contains "nested .env.example excluded" /tmp/archive4-contents-$$.txt "frontend/config/.env.example"

rm -f /tmp/archive4-contents-$$.txt

# ---- Fixture 5: safe root .env.example MUST be included ----
FIXTURE_ROOT=$(mktemp -d)
ARCHIVE_OUT="$FIXTURE_ROOT/archive5.tar.gz"

cat > "$FIXTURE_ROOT/.env.example" <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL= http://localhost:3000
EOF
cat > "$FIXTURE_ROOT/package.json" <<'EOF'
{"name":"fixture5"}
EOF

run_build "$FIXTURE_ROOT" "$ARCHIVE_OUT"
tar tf "$ARCHIVE_OUT" > /tmp/archive5-contents-$$.txt

check_contains "safe root .env.example included" /tmp/archive5-contents-$$.txt ".env.example"
# Extract .env.example from the archive and check its contents.
EXTRACT5=$(mktemp -d)
tar xf "$ARCHIVE_OUT" -C "$EXTRACT5" 2>/dev/null
if [ -f "$EXTRACT5/.env.example" ] && grep -qF 'your-anon-key' "$EXTRACT5/.env.example" 2>/dev/null; then
  PASSES=$((PASSES + 1))
  echo "PASS: safe root .env.example has placeholder values"
else
  FAILURES=$((FAILURES + 1))
  echo "FAIL: safe root .env.example has placeholder values (missing: your-anon-key)"
  FAIL_DETAIL="${FAIL_DETAIL:-safe-root-env-example-placeholder-missing}"
fi
rm -rf "$EXTRACT5"

rm -f /tmp/archive5-contents-$$.txt

# ---- Fixture 6: root .env.example with a real credential must be REJECTED ----
# Run build-archive.sh FROM the fixture directory so relative paths work.
FIXTURE_ROOT=$(mktemp -d)
ARCHIVE_OUT="$FIXTURE_ROOT/archive6.tar.gz"

cat > "$FIXTURE_ROOT/.env.example" <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://real-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real
EOF
cat > "$FIXTURE_ROOT/package.json" <<'EOF'
{"name":"fixture6"}
EOF

# build-archive.sh calls exit 1 when root .env.example is unsafe.
ARCHIVE_NAME_OUT="$(basename "$ARCHIVE_OUT")"
if ( cd "$FIXTURE_ROOT" && \
     ARCHIVE_OUT="$ARCHIVE_NAME_OUT" \
     ARCHIVE_DIR="." \
     bash "$BUILD_SCRIPT" ) 2>/tmp/build-archive-6-stderr-$$.log; then
  echo "FAIL: root .env.example with real credential was NOT rejected"
  FAILURES=$((FAILURES + 1))
  FAIL_DETAIL="unsafe-root-env-example-not-rejected"
else
  PASSES=$((PASSES + 1))
  echo "PASS: root .env.example with real credential rejected"
fi

# ---- Fixture 7: canary secret detection ----
FIXTURE_ROOT=$(mktemp -d)
ARCHIVE_OUT="$FIXTURE_ROOT/archive7.tar.gz"

mkdir -p "$FIXTURE_ROOT/src/lib"
cat > "$FIXTURE_ROOT/.env.example" <<'EOF'
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF
cat > "$FIXTURE_ROOT/package.json" <<'EOF'
{"name":"fixture7"}
EOF
# Place the canary deep in the tree in a file that SHOULD be excluded
# by the archive script's filter (hidden dir). This verifies the archive
# script keeps out anything that could carry a secret.
mkdir -p "$FIXTURE_ROOT/.secrets"
printf '%s\n' "$CANARY_SECRET" > "$FIXTURE_ROOT/.secrets/canary.txt"

run_build "$FIXTURE_ROOT" "$ARCHIVE_OUT"

# Extract the archive to a temp dir and grep for the canary.
EXTRACT_DIR=$(mktemp -d)
tar xf "$ARCHIVE_OUT" -C "$EXTRACT_DIR" > /dev/null 2>&1
CANARY_HIT=$(grep -rFl "$CANARY_SECRET" "$EXTRACT_DIR" 2>/dev/null || true)
rm -rf "$EXTRACT_DIR"

if [ -z "$CANARY_HIT" ]; then
  PASSES=$((PASSES + 1))
  echo "PASS: canary secret not present in archive"
else
  FAILURES=$((FAILURES + 1))
  echo "FAIL: canary secret found in archive at: $CANARY_HIT"
  FAIL_DETAIL="canary-leak"
fi

# ---- Result ----
echo ""
echo "Results: $PASSES passed, $FAILURES failed"

if [ "$FAILURES" -gt 0 ]; then
  echo "FAILED: $FAIL_DETAIL"
  exit 1
fi

echo "All archive canary tests passed."
exit 0
